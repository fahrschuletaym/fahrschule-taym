
import "server-only";

import { randomUUID } from "node:crypto";
import { prepareDecisionEmail } from "@/lib/admin/notifications";

import {
  Pool,
  type PoolClient,
} from "pg";

import {
  COUNTRY_NAMES,
  getDocumentLabel,
  formatApplicationPrice,
  normalizeApplicationLocale,
  isSupportedCountry,
  isLicenseCategory,
  isApplicationDocumentType,
  isValidUuid,
  type ApplicationCountry,
  type ApplicationLocale,
  type ApplicationDocumentType,
  type ApplicationPricing,
  type LicenseCategory,
} from "@/lib/applications/validation";

/* ============================================================
   FAHRSCHULE TAYM

   File:
   src/lib/applications/email.ts

   APPLICATION EMAIL SERVICE

   Provider:
   Resend REST API

   Events:
   - Candidate application confirmation
   - Administrator application notification

   Countries:
   DE | AT | BE | IT | ES

   Languages:
   DE | AR | TR | ES

   Features:
   - Responsive HTML emails
   - Plain text email fallback
   - Secure application links
   - PostgreSQL persistent email queue
   - Stable idempotency keys
   - Independent delivery statuses
   - Controlled retry
   - Concurrent dispatch protection
   - No sensitive document attachments

   Compatible:
   Desktop | Tablet | Mobile
   ============================================================ */

/* ============================================================
   1. CONFIGURATION
   ============================================================ */

const BRAND_NAME = "Fahrschule TAYM";

const RESEND_API_URL =
  "https://api.resend.com/emails";

const EMAIL_TIMEOUT_MS = 15_000;

const EMAIL_LEASE_SECONDS = 120;

const MAX_EMAIL_ATTEMPTS = 6;

/*
 * Resend retains idempotency keys for
 * 24 hours.
 *
 * Automatic retries stop before that
 * period expires to reduce duplicate
 * sending after ambiguous failures.
 */

const MAX_RETRY_WINDOW_HOURS = 23;

const MAX_RETRY_BATCH_SIZE = 20;

const DEFAULT_RETRY_BATCH_SIZE = 10;

const APPLICATION_PAGE_PATH =
  "/dashboard/application";

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BRAND_COLORS = {
  dark: "#111811",

  green: "#397c00",

  lime: "#8ac926",

  gold: "#d4af37",

  background: "#f4f7f2",

  white: "#ffffff",

  text: "#172019",

  muted: "#68736a",

  border: "#e1e7de",
} as const;

/* ============================================================
   2. EMAIL TYPES
   ============================================================ */

export type ApplicationEmailKind =
  | "CANDIDATE"
  | "ADMINISTRATOR"
  | "DECISION_APPROVED"
  | "DECISION_REJECTED";

export type ApplicationEmailDeliveryStatus =
  | "ACCEPTED"
  | "PENDING"
  | "FAILED";

type InternalEmailStatus =
  | "PENDING"
  | "SENDING"
  | "ACCEPTED"
  | "FAILED";

export type ApplicationSubmissionEmailResult = {
  candidate: ApplicationEmailDeliveryStatus;

  administrator: ApplicationEmailDeliveryStatus;
};

export type ApplicationEmailDocument = {
  type: ApplicationDocumentType;

  fileName: string;
};

/* ============================================================
   3. TRUSTED APPLICATION SNAPSHOT

   This object must be built from the
   committed application and authenticated
   database information.

   Never use arbitrary browser JSON
   as an email snapshot.
   ============================================================ */

export type ApplicationEmailSnapshot = {
  applicationId: string;

  reference: string;

  submittedAt: string;

  locale: ApplicationLocale;

  candidate: {
    userId: string;

    firstName: string;

    lastName: string;

    fullName: string;

    email: string;

    phoneE164: string;

    countryCode: ApplicationCountry;
  };

  category: LicenseCategory;

  residentialAddress: string;

  postalCode: string;

  city: string;

  pricing: ApplicationPricing;

  documents: ApplicationEmailDocument[];

  confirmedInformation: boolean;

  acceptedDocumentProcessing: boolean;

  admissionReviewRequired: boolean;
};

/* ============================================================
   4. RESEND PAYLOAD

   The exact payload is persisted.

   Retrying the same job always sends
   the same content with the same
   idempotency key.
   ============================================================ */

type ResendEmailPayload = {
  from: string;

  to: string[];

  subject: string;

  html: string;

  text: string;

  reply_to?: string;
};

type ApplicationEmailJob = {
  id: string;

  applicationId: string;

  kind: ApplicationEmailKind;

  status: InternalEmailStatus;

  payload: ResendEmailPayload;

  attempts: number;

  idempotencyKey: string;

  leaseToken: string | null;

  providerEmailId: string | null;
};

/* ============================================================
   5. EMAIL CONFIGURATION
   ============================================================ */

type EmailConfiguration = {
  apiKey: string;

  fromEmail: string;

  administratorEmail: string;

  administratorLocale: ApplicationLocale;

  replyTo: string | null;

  appUrl: string;

  adminApplicationUrl: string | null;
};

export class ApplicationEmailError extends Error {
  readonly code: string;

  readonly retryable: boolean;

  readonly retryAfterSeconds: number;

  constructor(
    code: string,

    retryable = false,

    retryAfterSeconds = 0
  ) {
    super(code);

    this.name = "ApplicationEmailError";

    this.code = code;

    this.retryable = retryable;

    this.retryAfterSeconds =
      retryAfterSeconds;
  }
}

/* ============================================================
   6. EMAIL ADDRESS VALIDATION
   ============================================================ */

function isValidEmail(
  value: unknown
): boolean {
  return (
    typeof value === "string" &&

    value.length <= 254 &&

    !/[\r\n]/.test(value) &&

    EMAIL_PATTERN.test(value)
  );
}

function normalizeEmail(
  value: string
): string {
  return value.trim().toLowerCase();
}

function isValidSender(
  value: string
): boolean {
  if (
    !value ||

    value.length > 320 ||

    /[\r\n]/.test(value)
  ) {
    return false;
  }

  if (isValidEmail(value)) {
    return true;
  }

  const match =
    value.match(
      /^[^<>]+<([^<>]+)>$/
    );

  return Boolean(
    match &&
    isValidEmail(match[1].trim())
  );
}

/* ============================================================
   7. APPLICATION URL VALIDATION
   ============================================================ */

function getApplicationBaseUrl(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL;

  if (!configuredUrl) {
    if (
      process.env.NODE_ENV !==
      "production"
    ) {
      return "http://localhost:3000";
    }

    throw new ApplicationEmailError(
      "INVALID_APP_URL"
    );
  }

  let url: URL;

  try {
    url = new URL(configuredUrl);

  } catch {
    throw new ApplicationEmailError(
      "INVALID_APP_URL"
    );
  }

  if (
    url.username ||
    url.password ||
    !["http:", "https:"].includes(
      url.protocol
    ) ||
    (
      process.env.NODE_ENV ===
        "production" &&

      url.protocol !== "https:"
    )
  ) {
    throw new ApplicationEmailError(
      "INVALID_APP_URL"
    );
  }

  return url.origin;
}

function getAdminApplicationUrl(
  appUrl: string
): string | null {
  const configuredPath =
    process.env
      .APPLICATION_ADMIN_DASHBOARD_PATH
      ?.trim();

  /*
   * Do not invent an admin page.
   *
   * The link is enabled only when
   * the actual admin route is configured.
   */

  if (!configuredPath) {
    return null;
  }

  if (
    !configuredPath.startsWith("/") ||

    configuredPath.startsWith("//") ||

    configuredPath.includes("\\") ||

    /[\r\n]/.test(configuredPath)
  ) {
    throw new ApplicationEmailError(
      "INVALID_ADMIN_APPLICATION_URL"
    );
  }

  const url =
    new URL(configuredPath, appUrl);

  if (
    url.origin !==
    new URL(appUrl).origin
  ) {
    throw new ApplicationEmailError(
      "INVALID_ADMIN_APPLICATION_URL"
    );
  }

  return url.toString();
}

/* ============================================================
   8. LOAD SERVER CONFIGURATION

   No secret is exposed to the client.
   ============================================================ */

function getEmailConfiguration():
  EmailConfiguration {
  const apiKey =
    process.env.RESEND_API_KEY?.trim();

  const fromEmail =
    process.env.RESEND_FROM_EMAIL?.trim();

  const administratorEmail =
    normalizeEmail(
      process.env
        .APPLICATION_ADMIN_EMAIL ?? ""
    );

  const replyTo =
    process.env
      .APPLICATION_REPLY_TO_EMAIL
      ?.trim() || null;

  if (
    !apiKey ||
    !fromEmail ||
    !isValidSender(fromEmail)
  ) {
    throw new ApplicationEmailError(
      "EMAIL_CONFIGURATION_UNAVAILABLE"
    );
  }

  if (!isValidEmail(administratorEmail)) {
    throw new ApplicationEmailError(
      "INVALID_ADMIN_EMAIL"
    );
  }

  if (
    replyTo &&
    !isValidEmail(replyTo)
  ) {
    throw new ApplicationEmailError(
      "INVALID_REPLY_TO_EMAIL"
    );
  }

  const appUrl =
    getApplicationBaseUrl();

  return {
    apiKey,

    fromEmail,

    administratorEmail,

    administratorLocale:
      normalizeApplicationLocale(
        process.env
          .APPLICATION_ADMIN_LOCALE
      ),

    replyTo,

    appUrl,

    adminApplicationUrl:
      getAdminApplicationUrl(appUrl),
  };
}

/* ============================================================
   9. SHARED POSTGRESQL CONNECTION

   Reuses the same pool convention
   as the authentication services.

   No new database connection pool
   is created for every email.
   ============================================================ */

const globalForApplicationEmail =
  globalThis as typeof globalThis & {
    taymResendPool?: Pool;
  };

function getDatabasePool(): Pool {
  if (
    globalForApplicationEmail
      .taymResendPool
  ) {
    return globalForApplicationEmail
      .taymResendPool;
  }

  const databaseUrl =
    process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new ApplicationEmailError(
      "DATABASE_UNAVAILABLE",
      true
    );
  }

  const pool = new Pool({
    connectionString:
      databaseUrl,

    max: 5,

    min: 0,

    idleTimeoutMillis: 30_000,

    connectionTimeoutMillis: 10_000,

    allowExitOnIdle: false,
  });

  pool.on("error", () => {
    console.error(
      "[TAYM][APPLICATION_EMAIL][DATABASE_POOL]"
    );
  });

  globalForApplicationEmail
    .taymResendPool = pool;

  return pool;
}

/* ============================================================
   10. MULTILINGUAL EMAIL CONTENT
   ============================================================ */

type EmailTranslations = {
  candidateSubject: string;

  administratorSubject: string;

  candidateTitle: string;

  administratorTitle: string;

  greeting: string;

  candidateIntroduction: string;

  administratorIntroduction: string;

  detailsTitle: string;

  documentsTitle: string;

  reference: string;

  fullName: string;

  email: string;

  phone: string;

  country: string;

  category: string;

  address: string;

  postalCode: string;

  city: string;

  trainingPrice: string;

  registrationFee: string;

  totalPrice: string;

  submittedAt: string;

  status: string;

  received: string;

  confirmedInformation: string;

  documentProcessing: string;

  yes: string;

  no: string;

  reviewRequired: string;

  candidateNextStep: string;

  administratorNextStep: string;

  candidateButton: string;

  administratorButton: string;

  administratorPrivateDocuments: string;

  feeNotice: string;

  legalNotice: string;

  automaticEmail: string;

  confidentiality: string;

  regards: string;

  team: string;
};

const TRANSLATIONS: Record<
  ApplicationLocale,
  EmailTranslations
> = {
  /* ========================================================
     GERMAN — DEFAULT
     ======================================================== */

  de: {
    candidateSubject:
      "Bestätigung Ihres Führerscheinantrags",

    administratorSubject:
      "Neuer Führerscheinantrag",

    candidateTitle:
      "Ihr Antrag wurde eingereicht",

    administratorTitle:
      "Neuer Antrag eingegangen",

    greeting:
      "Guten Tag",

    candidateIntroduction:
      "Vielen Dank für Ihren Antrag bei Fahrschule TAYM. Wir haben Ihre Angaben und Unterlagen erhalten.",

    administratorIntroduction:
      "Ein Kandidat hat einen neuen Führerscheinantrag über die Plattform eingereicht.",

    detailsTitle:
      "Antragsübersicht",

    documentsTitle:
      "Eingereichte Dokumente",

    reference:
      "Antragsnummer",

    fullName:
      "Vor- und Nachname",

    email:
      "E-Mail-Adresse",

    phone:
      "Telefonnummer",

    country:
      "Land",

    category:
      "Führerscheinklasse",

    address:
      "Wohnadresse",

    postalCode:
      "Postleitzahl",

    city:
      "Stadt",

    trainingPrice:
      "Preis der Führerscheinausbildung",

    registrationFee:
      "Anmelde- und Bearbeitungsgebühr",

    totalPrice:
      "Gesamtbetrag",

    submittedAt:
      "Eingereicht am",

    status:
      "Status",

    received:
      "Eingegangen",

    confirmedInformation:
      "Richtigkeit der Angaben bestätigt",

    documentProcessing:
      "Dokumentenverarbeitung bestätigt",

    yes: "Ja",

    no: "Nein",

    reviewRequired:
      "Die Zulassungsvoraussetzungen müssen geprüft werden.",

    candidateNextStep:
      "Unser Team wird Ihren Antrag und Ihre Unterlagen prüfen. Den aktuellen Bearbeitungsstand können Sie in Ihrem persönlichen Bereich einsehen.",

    administratorNextStep:
      "Bitte prüfen Sie den Antrag, die eingereichten Dokumente und die geltenden Zulassungsvoraussetzungen.",

    candidateButton:
      "Meinen Antrag ansehen",

    administratorButton:
      "Antrag bearbeiten",

    administratorPrivateDocuments:
      "Die Originaldokumente befinden sich im geschützten Verwaltungsbereich. Sie werden aus Datenschutzgründen nicht als E-Mail-Anhang versendet.",

    feeNotice:
      "Die Anmelde- und Bearbeitungsgebühr ist eine Servicegebühr von TAYM. Eventuelle externe oder behördliche Gebühren sind nur enthalten, wenn dies ausdrücklich vereinbart wurde.",

    legalNotice:
      "Diese Bestätigung ist keine behördliche Fahrerlaubnis und ersetzt keine vorgeschriebenen Prüfungen oder Zulassungsvoraussetzungen.",

    automaticEmail:
      "Dies ist eine automatisch erstellte E-Mail.",

    confidentiality:
      "Diese Nachricht enthält vertrauliche Informationen und ist ausschließlich für den vorgesehenen Empfänger bestimmt.",

    regards:
      "Mit freundlichen Grüßen",

    team:
      "Ihr Fahrschule TAYM Team",
  },

  /* ========================================================
     ARABIC — RTL
     ======================================================== */

  ar: {
    candidateSubject:
      "تأكيد طلب رخصة القيادة",

    administratorSubject:
      "طلب رخصة قيادة جديد",

    candidateTitle:
      "تم تقديم طلبك بنجاح",

    administratorTitle:
      "تم استلام طلب جديد",

    greeting:
      "مرحباً",

    candidateIntroduction:
      "شكراً لتقديم طلبك لدى مدرسة تعليم القيادة TAYM. لقد استلمنا معلوماتك ومستنداتك.",

    administratorIntroduction:
      "قدم أحد المتقدمين طلباً جديداً لرخصة القيادة عبر المنصة.",

    detailsTitle:
      "ملخص الطلب",

    documentsTitle:
      "المستندات المقدمة",

    reference:
      "رقم الطلب",

    fullName:
      "الاسم الكامل",

    email:
      "البريد الإلكتروني",

    phone:
      "رقم الهاتف",

    country:
      "الدولة",

    category:
      "فئة رخصة القيادة",

    address:
      "عنوان الإقامة",

    postalCode:
      "الرمز البريدي",

    city:
      "المدينة",

    trainingPrice:
      "تكلفة التدريب على القيادة",

    registrationFee:
      "رسوم التسجيل ومعالجة الملف",

    totalPrice:
      "المبلغ الإجمالي",

    submittedAt:
      "تاريخ تقديم الطلب",

    status:
      "الحالة",

    received:
      "تم الاستلام",

    confirmedInformation:
      "تم تأكيد صحة المعلومات",

    documentProcessing:
      "تم تأكيد معالجة المستندات",

    yes: "نعم",

    no: "لا",

    reviewRequired:
      "يجب التحقق من شروط القبول.",

    candidateNextStep:
      "سيقوم فريقنا بمراجعة طلبك ومستنداتك. يمكنك متابعة حالة الطلب من خلال حسابك الشخصي.",

    administratorNextStep:
      "يرجى مراجعة الطلب والمستندات المقدمة وشروط القبول المعمول بها.",

    candidateButton:
      "عرض طلبي",

    administratorButton:
      "معالجة الطلب",

    administratorPrivateDocuments:
      "المستندات الأصلية محفوظة في لوحة الإدارة المحمية، ولا يتم إرسالها كمرفقات بالبريد الإلكتروني حفاظاً على الخصوصية.",

    feeNotice:
      "رسوم التسجيل ومعالجة الملف هي رسوم خدمات TAYM. لا تشمل الرسوم الخارجية أو الحكومية إلا إذا تم الاتفاق على ذلك صراحة.",

    legalNotice:
      "هذا التأكيد ليس رخصة قيادة رسمية ولا يحل محل الاختبارات أو شروط القبول الإلزامية.",

    automaticEmail:
      "تم إنشاء هذه الرسالة تلقائياً.",

    confidentiality:
      "تحتوي هذه الرسالة على معلومات سرية وهي مخصصة للمستلم المعني فقط.",

    regards:
      "مع أطيب التحيات",

    team:
      "فريق مدرسة تعليم القيادة TAYM",
  },

  /* ========================================================
     TURKISH
     ======================================================== */

  tr: {
    candidateSubject:
      "Ehliyet başvurunuzun onayı",

    administratorSubject:
      "Yeni ehliyet başvurusu",

    candidateTitle:
      "Başvurunuz gönderildi",

    administratorTitle:
      "Yeni başvuru alındı",

    greeting:
      "Merhaba",

    candidateIntroduction:
      "Fahrschule TAYM'a yaptığınız başvuru için teşekkür ederiz. Bilgilerinizi ve belgelerinizi aldık.",

    administratorIntroduction:
      "Bir aday platform üzerinden yeni bir ehliyet başvurusu gönderdi.",

    detailsTitle:
      "Başvuru özeti",

    documentsTitle:
      "Gönderilen belgeler",

    reference:
      "Başvuru numarası",

    fullName:
      "Ad ve soyad",

    email:
      "E-posta adresi",

    phone:
      "Telefon numarası",

    country:
      "Ülke",

    category:
      "Ehliyet sınıfı",

    address:
      "İkamet adresi",

    postalCode:
      "Posta kodu",

    city:
      "Şehir",

    trainingPrice:
      "Sürücü eğitimi ücreti",

    registrationFee:
      "Kayıt ve dosya işlem ücreti",

    totalPrice:
      "Toplam tutar",

    submittedAt:
      "Başvuru tarihi",

    status:
      "Durum",

    received:
      "Alındı",

    confirmedInformation:
      "Bilgilerin doğruluğu onaylandı",

    documentProcessing:
      "Belgelerin işlenmesi onaylandı",

    yes: "Evet",

    no: "Hayır",

    reviewRequired:
      "Kabul şartları kontrol edilmelidir.",

    candidateNextStep:
      "Ekibimiz başvurunuzu ve belgelerinizi inceleyecektir. Başvurunuzun durumunu kişisel hesabınızdan takip edebilirsiniz.",

    administratorNextStep:
      "Lütfen başvuruyu, gönderilen belgeleri ve geçerli kabul şartlarını kontrol edin.",

    candidateButton:
      "Başvurumu görüntüle",

    administratorButton:
      "Başvuruyu incele",

    administratorPrivateDocuments:
      "Orijinal belgeler güvenli yönetim alanında saklanır. Gizlilik nedeniyle e-posta eki olarak gönderilmez.",

    feeNotice:
      "Kayıt ve dosya işlem ücreti TAYM'ın hizmet ücretidir. Harici veya resmi ücretler yalnızca açıkça belirtilmişse dahildir.",

    legalNotice:
      "Bu onay resmi bir sürücü belgesi değildir ve zorunlu sınavların veya kabul şartlarının yerine geçmez.",

    automaticEmail:
      "Bu e-posta otomatik olarak oluşturulmuştur.",

    confidentiality:
      "Bu mesaj gizli bilgiler içerir ve yalnızca belirtilen alıcıya yöneliktir.",

    regards:
      "Saygılarımızla",

    team:
      "Fahrschule TAYM Ekibi",
  },

  /* ========================================================
     SPANISH
     ======================================================== */

  es: {
    candidateSubject:
      "Confirmación de su solicitud de permiso de conducir",

    administratorSubject:
      "Nueva solicitud de permiso de conducir",

    candidateTitle:
      "Su solicitud se ha enviado",

    administratorTitle:
      "Nueva solicitud recibida",

    greeting:
      "Hola",

    candidateIntroduction:
      "Gracias por presentar su solicitud en Fahrschule TAYM. Hemos recibido sus datos y documentos.",

    administratorIntroduction:
      "Un candidato ha presentado una nueva solicitud de permiso de conducir a través de la plataforma.",

    detailsTitle:
      "Resumen de la solicitud",

    documentsTitle:
      "Documentos presentados",

    reference:
      "Número de solicitud",

    fullName:
      "Nombre y apellidos",

    email:
      "Correo electrónico",

    phone:
      "Número de teléfono",

    country:
      "País",

    category:
      "Categoría del permiso",

    address:
      "Domicilio",

    postalCode:
      "Código postal",

    city:
      "Ciudad",

    trainingPrice:
      "Precio de la formación de conducción",

    registrationFee:
      "Tasa de inscripción y tramitación",

    totalPrice:
      "Importe total",

    submittedAt:
      "Fecha de presentación",

    status:
      "Estado",

    received:
      "Recibida",

    confirmedInformation:
      "Exactitud de los datos confirmada",

    documentProcessing:
      "Tratamiento de documentos confirmado",

    yes: "Sí",

    no: "No",

    reviewRequired:
      "Deben comprobarse los requisitos de admisión.",

    candidateNextStep:
      "Nuestro equipo revisará su solicitud y sus documentos. Puede consultar el estado de su solicitud desde su cuenta personal.",

    administratorNextStep:
      "Revise la solicitud, los documentos presentados y los requisitos de admisión aplicables.",

    candidateButton:
      "Consultar mi solicitud",

    administratorButton:
      "Revisar solicitud",

    administratorPrivateDocuments:
      "Los documentos originales se conservan en el área de administración protegida. No se envían como archivos adjuntos por motivos de privacidad.",

    feeNotice:
      "La tasa de inscripción y tramitación corresponde a los servicios de TAYM. Los gastos externos u oficiales solo están incluidos si se ha acordado expresamente.",

    legalNotice:
      "Esta confirmación no constituye un permiso de conducir oficial ni sustituye las pruebas o requisitos de admisión obligatorios.",

    automaticEmail:
      "Este correo electrónico se ha generado automáticamente.",

    confidentiality:
      "Este mensaje contiene información confidencial y está destinado exclusivamente a su destinatario.",

    regards:
      "Atentamente",

    team:
      "El equipo de Fahrschule TAYM",
  },
};

/* ============================================================
   11. HTML ESCAPING

   All candidate-supplied values must
   be escaped before HTML generation.
   ============================================================ */

function escapeHtml(
  value: unknown
): string {
  return String(value ?? "")

    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;")

    .replace(/'/g, "&#39;");
}

function safeSubject(
  value: string
): string {
  return value
    .replace(/[\r\n\u0000]/g, " ")
    .trim()
    .slice(0, 240);
}

/* ============================================================
   12. COUNTRY TIME ZONES
   ============================================================ */

const COUNTRY_TIME_ZONES: Record<
  ApplicationCountry,
  string
> = {
  DE: "Europe/Berlin",

  AT: "Europe/Vienna",

  BE: "Europe/Brussels",

  IT: "Europe/Rome",

  ES: "Europe/Madrid",
};

const FORMAT_LOCALES: Record<
  ApplicationLocale,
  string
> = {
  de: "de-DE",

  ar: "ar",

  tr: "tr-TR",

  es: "es-ES",
};

function formatSubmissionDate(
  value: string,

  country: ApplicationCountry,

  locale: ApplicationLocale
): string {
  const date = new Date(value);

  if (
    !Number.isFinite(date.getTime())
  ) {
    throw new ApplicationEmailError(
      "INVALID_SUBMISSION_DATE"
    );
  }

  return new Intl.DateTimeFormat(
    FORMAT_LOCALES[locale],

    {
      dateStyle: "medium",

      timeStyle: "short",

      timeZone:
        COUNTRY_TIME_ZONES[country],
    }
  ).format(date);
}

/* ============================================================
   13. VALIDATE APPLICATION SNAPSHOT

   This validation is additional
   protection for email generation.

   The full application must already
   have passed validation.ts.
   ============================================================ */

function validateEmailSnapshot(
  snapshot: ApplicationEmailSnapshot
): void {
  if (
    !snapshot ||

    !isValidUuid(
      snapshot.applicationId
    ) ||

    !isValidUuid(
      snapshot.candidate?.userId
    ) ||

    !isSupportedCountry(
      snapshot.candidate.countryCode
    ) ||

    !isLicenseCategory(
      snapshot.category
    ) ||

    !isValidEmail(
      snapshot.candidate.email
    ) ||

    typeof snapshot.reference !==
      "string" ||

    !/^[a-zA-Z0-9._-]{1,100}$/.test(
      snapshot.reference
    ) ||

    !Number.isFinite(
      Date.parse(
        snapshot.submittedAt
      )
    )
  ) {
    throw new ApplicationEmailError(
      "INVALID_APPLICATION_EMAIL_DATA"
    );
  }

  const requiredTextValues = [
    snapshot.candidate.firstName,

    snapshot.candidate.lastName,

    snapshot.candidate.fullName,

    snapshot.residentialAddress,

    snapshot.postalCode,

    snapshot.city,
  ];

  if (
    requiredTextValues.some(
      (value) =>
        typeof value !== "string" ||
        value.trim().length === 0 ||
        value.length > 250
    ) ||

    typeof snapshot.candidate.phoneE164 !==
      "string" ||

    !/^\+[1-9]\d{7,14}$/.test(
      snapshot.candidate.phoneE164
    )
  ) {
    throw new ApplicationEmailError(
      "INVALID_APPLICATION_EMAIL_DATA"
    );
  }

  const pricing =
    snapshot.pricing;

  if (
    !pricing ||

    pricing.currency !== "EUR" ||

    !Number.isSafeInteger(
      pricing.trainingPriceCents
    ) ||

    !Number.isSafeInteger(
      pricing.registrationFeeCents
    ) ||

    !Number.isSafeInteger(
      pricing.totalPriceCents
    ) ||

    pricing.trainingPriceCents <= 0 ||

    pricing.registrationFeeCents < 0 ||

    pricing.totalPriceCents !==
      pricing.trainingPriceCents +
        pricing.registrationFeeCents
  ) {
    throw new ApplicationEmailError(
      "INVALID_APPLICATION_PRICING"
    );
  }

  if (
    !Array.isArray(snapshot.documents) ||

    snapshot.documents.length < 5 ||

    snapshot.documents.length > 30 ||

    snapshot.documents.some(
      (document) =>
        !isApplicationDocumentType(
          document.type
        ) ||

        typeof document.fileName !==
          "string"
    ) ||

    snapshot.confirmedInformation !== true ||

    snapshot.acceptedDocumentProcessing !== true
  ) {
    throw new ApplicationEmailError(
      "INVALID_APPLICATION_EMAIL_DATA"
    );
  }
}

/* ============================================================
   14. PROTECTED APPLICATION LINKS
   ============================================================ */

function createCandidateApplicationLink(
  snapshot: ApplicationEmailSnapshot,

  config: EmailConfiguration
): string {
  const url = new URL(
    APPLICATION_PAGE_PATH,

    config.appUrl
  );

  url.searchParams.set(
    "applicationId",

    snapshot.applicationId
  );

  return url.toString();
}

function createAdminApplicationLink(
  snapshot: ApplicationEmailSnapshot,

  config: EmailConfiguration
): string | null {
  if (
    !config.adminApplicationUrl
  ) {
    return null;
  }

  const url = new URL(
    config.adminApplicationUrl
  );

  url.searchParams.set(
    "applicationId",

    snapshot.applicationId
  );

  return url.toString();
}

/* ============================================================
   15. APPLICATION EMAIL DETAILS
   ============================================================ */

type EmailDetailRow = {
  label: string;

  value: string;

  ltr?: boolean;

  highlight?: boolean;
};

function buildApplicationRows(
  snapshot: ApplicationEmailSnapshot,

  locale: ApplicationLocale
): EmailDetailRow[] {
  const t =
    TRANSLATIONS[locale];

  return [
    {
      label: t.reference,

      value: snapshot.reference,

      ltr: true,

      highlight: true,
    },

    {
      label: t.fullName,

      value:
        snapshot.candidate.fullName,
    },

    {
      label: t.email,

      value:
        snapshot.candidate.email,

      ltr: true,
    },

    {
      label: t.phone,

      value:
        snapshot.candidate.phoneE164,

      ltr: true,
    },

    {
      label: t.country,

      value:
        COUNTRY_NAMES[
          snapshot.candidate.countryCode
        ][locale],
    },

    {
      label: t.category,

      value:
        snapshot.category,

      ltr: true,
    },

    {
      label: t.address,

      value:
        snapshot.residentialAddress,
    },

    {
      label: t.postalCode,

      value:
        snapshot.postalCode,

      ltr: true,
    },

    {
      label: t.city,

      value:
        snapshot.city,
    },

    {
      label: t.submittedAt,

      value:
        formatSubmissionDate(
          snapshot.submittedAt,

          snapshot.candidate.countryCode,

          locale
        ),
    },

    {
      label: t.status,

      value: t.received,

      highlight: true,
    },
  ];
}

/* ============================================================
   16. PRICING DETAILS
   ============================================================ */

function buildPricingRows(
  snapshot: ApplicationEmailSnapshot,

  locale: ApplicationLocale
): EmailDetailRow[] {
  const t =
    TRANSLATIONS[locale];

  return [
    {
      label:
        t.trainingPrice,

      value:
        formatApplicationPrice(
          snapshot.pricing
            .trainingPriceCents,

          locale
        ),
    },

    {
      label:
        t.registrationFee,

      value:
        formatApplicationPrice(
          snapshot.pricing
            .registrationFeeCents,

          locale
        ),
    },

    {
      label:
        t.totalPrice,

      value:
        formatApplicationPrice(
          snapshot.pricing
            .totalPriceCents,

          locale
        ),

      highlight: true,
    },
  ];
}

/* ============================================================
   17. ADMINISTRATIVE CONFIRMATIONS
   ============================================================ */

function buildConfirmationRows(
  snapshot: ApplicationEmailSnapshot,

  locale: ApplicationLocale
): EmailDetailRow[] {
  const t =
    TRANSLATIONS[locale];

  return [
    {
      label:
        t.confirmedInformation,

      value:
        snapshot.confirmedInformation
          ? t.yes
          : t.no,
    },

    {
      label:
        t.documentProcessing,

      value:
        snapshot.acceptedDocumentProcessing
          ? t.yes
          : t.no,
    },
  ];
}

/* ============================================================
   18. RESPONSIVE EMAIL DETAIL TABLE

   Table-based layout is used for
   Gmail, Outlook and Apple Mail.

   No JavaScript.
   No external CSS dependency.
   ============================================================ */

function renderEmailTable(
  rows: EmailDetailRow[],

  locale: ApplicationLocale
): string {
  const rtl =
    locale === "ar";

  const startAlignment =
    rtl ? "right" : "left";

  const endAlignment =
    rtl ? "left" : "right";

  const content = rows.map((row) => {
    const background =
      row.highlight
        ? "#f0f7e9"
        : "#ffffff";

    const color =
      row.highlight
        ? BRAND_COLORS.green
        : BRAND_COLORS.text;

    return `
      <tr>
        <td
          class="detail-label"
          valign="top"
          align="${startAlignment}"
          width="45%"
          style="
            padding:12px 14px;
            border-bottom:1px solid #e1e7de;
            background:${background};
            font-size:13px;
            line-height:20px;
            color:#68736a;
            font-weight:600;
          "
        >
          ${escapeHtml(row.label)}
        </td>

        <td
          class="detail-value"
          valign="top"
          align="${endAlignment}"
          style="
            padding:12px 14px;
            border-bottom:1px solid #e1e7de;
            background:${background};
            font-size:14px;
            line-height:22px;
            color:${color};
            font-weight:700;
            overflow-wrap:anywhere;
            word-break:break-word;
          "
        >
          <span dir="${row.ltr ? "ltr" : "auto"}">
            ${escapeHtml(row.value)}
          </span>
        </td>
      </tr>
    `;
  }).join("");

  return `
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="
        width:100%;
        border:1px solid #e1e7de;
        border-radius:10px;
        border-collapse:separate;
      "
    >
      ${content}
    </table>
  `;
}

/* ============================================================
   19. DOCUMENT LIST

   Only localized document names are
   included in emails.

   No identity document images.
   No signature attachments.
   No bank statement attachments.
   No storage access credentials.
   ============================================================ */

function renderDocumentList(
  snapshot: ApplicationEmailSnapshot,

  locale: ApplicationLocale
): string {
  const alignment =
    locale === "ar"
      ? "right"
      : "left";

  const documentTypes =
    Array.from(
      new Set(
        snapshot.documents.map(
          (document) => document.type
        )
      )
    );

  return documentTypes.map(
    (type) => `
      <tr>
        <td
          align="${alignment}"
          style="
            padding:11px 14px;
            border-bottom:1px solid #e1e7de;
            font-size:14px;
            line-height:22px;
            color:#263329;
          "
        >
          <span
            style="
              color:#397c00;
              font-weight:bold;
            "
          >&#10003;</span>

          &nbsp;

          ${escapeHtml(
            getDocumentLabel(
              type,
              locale
            )
          )}
        </td>
      </tr>
    `
  ).join("");
}

/* ============================================================
   20. EMAIL SECTION TITLE
   ============================================================ */

function renderSectionTitle(
  title: string
): string {
  return `
    <h2 style="
      margin:26px 0 12px;
      font-size:17px;
      line-height:24px;
      font-weight:700;
      color:#172019;
    ">
      ${escapeHtml(title)}
    </h2>
  `;
}

/* ============================================================
   21. EMAIL ACTION BUTTON
   ============================================================ */

function renderActionButton(
  label: string,

  url: string | null
): string {
  if (!url) {
    return "";
  }

  return `
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="margin:28px 0;"
    >
      <tr>
        <td
          align="center"
          bgcolor="#397c00"
          style="
            border-radius:10px;
            background:#397c00;
          "
        >
          <a
            href="${escapeHtml(url)}"
            class="email-button"
            style="
              display:block;
              padding:16px 24px;
              font-size:15px;
              line-height:22px;
              font-weight:700;
              text-decoration:none;
              color:#ffffff;
              border-radius:10px;
            "
          >
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

/* ============================================================
   22. RESPONSIVE HTML TEMPLATE
   ============================================================ */

function renderApplicationEmail({
  snapshot,

  locale,

  kind,

  actionUrl,
}: {
  snapshot: ApplicationEmailSnapshot;

  locale: ApplicationLocale;

  kind: ApplicationEmailKind;

  actionUrl: string | null;
}): string {
  const t =
    TRANSLATIONS[locale];

  const admin =
    kind === "ADMINISTRATOR";

  const direction =
    locale === "ar"
      ? "rtl"
      : "ltr";

  const alignment =
    direction === "rtl"
      ? "right"
      : "left";

  const title =
    admin

      ? t.administratorTitle

      : t.candidateTitle;

  const introduction =
    admin

      ? t.administratorIntroduction

      : t.candidateIntroduction;

  const details =
    renderEmailTable(
      buildApplicationRows(
        snapshot,
        locale
      ),

      locale
    );

  const pricing =
    renderEmailTable(
      buildPricingRows(
        snapshot,
        locale
      ),

      locale
    );

  const confirmations =
    admin

      ? renderEmailTable(
          buildConfirmationRows(
            snapshot,
            locale
          ),

          locale
        )

      : "";

  const documentList =
    renderDocumentList(
      snapshot,
      locale
    );

  return `<!DOCTYPE html>

<html
  lang="${locale}"
  dir="${direction}"
>

<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  >

  <meta
    name="color-scheme"
    content="light"
  >

  <meta
    name="supported-color-schemes"
    content="light"
  >

  <title>
    ${escapeHtml(title)}
  </title>

  <style>
    body {
      margin:0;
      padding:0;
      width:100%;
      -webkit-text-size-adjust:100%;
      -ms-text-size-adjust:100%;
    }

    table {
      mso-table-lspace:0pt;
      mso-table-rspace:0pt;
    }

    a {
      color:#397c00;
    }

    @media only screen and (max-width:600px) {
      .email-container {
        width:100% !important;
        max-width:100% !important;
      }

      .outer-padding {
        padding:10px !important;
      }

      .content-padding {
        padding:22px 17px !important;
      }

      .email-title {
        font-size:24px !important;
        line-height:32px !important;
      }

      .detail-label,
      .detail-value {
        padding:10px !important;
        font-size:12px !important;
      }

      .email-button {
        padding:15px 12px !important;
        font-size:14px !important;
      }
    }
  </style>
</head>

<body
  bgcolor="${BRAND_COLORS.background}"
  style="
    margin:0;
    padding:0;
    background:${BRAND_COLORS.background};
    font-family:Arial,Helvetica,sans-serif;
    color:${BRAND_COLORS.text};
  "
>

  <div style="
    display:none;
    max-height:0;
    overflow:hidden;
    opacity:0;
    font-size:1px;
    line-height:1px;
  ">
    ${escapeHtml(title)}
  </div>

  <table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
  >
    <tr>
      <td
        align="center"
        class="outer-padding"
        style="padding:30px 12px;"
      >

        <table
          role="presentation"
          width="620"
          cellpadding="0"
          cellspacing="0"
          border="0"
          class="email-container"
          style="
            width:100%;
            max-width:620px;
            background:#ffffff;
            border:1px solid #e1e7de;
            border-radius:16px;
            overflow:hidden;
          "
        >

          <!-- BRAND HEADER -->

          <tr>
            <td
              align="center"
              bgcolor="#111811"
              style="
                background:#111811;
                padding:30px 20px;
                border-bottom:4px solid #8ac926;
              "
            >
              <div
                dir="ltr"
                style="
                  font-size:27px;
                  line-height:35px;
                  font-weight:800;
                  letter-spacing:-0.5px;
                  color:#ffffff;
                "
              >
                Fahrschule

                <span style="
                  color:#d4af37;
                ">
                  TAYM
                </span>
              </div>
            </td>
          </tr>

          <!-- MAIN CONTENT -->

          <tr>
            <td
              dir="${direction}"
              align="${alignment}"
              class="content-padding"
              style="
                padding:32px;
                background:#ffffff;
              "
            >

              <!-- SUCCESS ICON -->

              <table
                role="presentation"
                width="60"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                  margin:0 auto 20px;
                  width:60px;
                "
              >
                <tr>
                  <td
                    align="center"
                    bgcolor="#edf7e4"
                    style="
                      width:60px;
                      height:60px;
                      background:#edf7e4;
                      color:#397c00;
                      border-radius:30px;
                      font-size:30px;
                      line-height:60px;
                      font-weight:bold;
                    "
                  >
                    &#10003;
                  </td>
                </tr>
              </table>

              <h1
                class="email-title"
                style="
                  margin:0 0 20px;
                  text-align:center;
                  font-size:29px;
                  line-height:38px;
                  font-weight:800;
                  color:#172019;
                "
              >
                ${escapeHtml(title)}
              </h1>

              ${
                !admin

                  ? `
                    <p style="
                      margin:0 0 14px;
                      font-size:15px;
                      line-height:25px;
                      font-weight:700;
                    ">
                      ${escapeHtml(t.greeting)}

                      ${escapeHtml(
                        snapshot.candidate
                          .firstName
                      )},

                    </p>
                  `

                  : ""
              }

              <p style="
                margin:0 0 20px;
                font-size:15px;
                line-height:26px;
                color:#525f55;
              ">
                ${escapeHtml(introduction)}
              </p>

              <!-- APPLICATION INFORMATION -->

              ${renderSectionTitle(
                t.detailsTitle
              )}

              ${details}

              <!-- DOCUMENT LIST -->

              ${renderSectionTitle(
                t.documentsTitle
              )}

              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                  width:100%;
                  border:1px solid #e1e7de;
                  border-radius:10px;
                  background:#f8faf7;
                "
              >
                ${documentList}
              </table>

              <!-- PRICING -->

              <div style="height:24px;">
                &nbsp;
              </div>

              ${pricing}

              <p style="
                margin:12px 0 0;
                font-size:12px;
                line-height:20px;
                color:#68736a;
              ">
                ${escapeHtml(t.feeNotice)}
              </p>

              <!-- ADMIN CONFIRMATIONS -->

              ${
                admin

                  ? `
                    <div style="height:24px;">
                      &nbsp;
                    </div>

                    ${confirmations}
                  `

                  : ""
              }

              <!-- NEXT STEPS -->

              <p style="
                margin:25px 0 0;
                font-size:15px;
                line-height:25px;
                color:#525f55;
              ">
                ${
                  escapeHtml(
                    admin

                      ? t.administratorNextStep

                      : t.candidateNextStep
                  )
                }
              </p>

              ${
                snapshot.admissionReviewRequired

                  ? `
                    <p style="
                      margin:14px 0;
                      padding:14px;
                      background:#f6f7f2;
                      border:1px solid #e6e9df;
                      border-radius:8px;
                      font-size:13px;
                      line-height:22px;
                      color:#525f55;
                    ">
                      ${escapeHtml(
                        t.reviewRequired
                      )}
                    </p>
                  `

                  : ""
              }

              ${
                renderActionButton(
                  admin

                    ? t.administratorButton

                    : t.candidateButton,

                  actionUrl
                )
              }

              ${
                admin

                  ? `
                    <p style="
                      margin:20px 0;
                      font-size:13px;
                      line-height:22px;
                      color:#68736a;
                    ">
                      ${escapeHtml(
                        t.administratorPrivateDocuments
                      )}
                    </p>
                  `

                  : `
                    <p style="
                      margin:20px 0;
                      font-size:13px;
                      line-height:22px;
                      color:#68736a;
                    ">
                      ${escapeHtml(
                        t.legalNotice
                      )}
                    </p>
                  `
              }

              <!-- EMAIL SIGNATURE -->

              <p style="
                margin:24px 0 0;
                font-size:14px;
                line-height:24px;
              ">
                ${escapeHtml(t.regards)}

                <br>

                <strong>
                  ${escapeHtml(t.team)}
                </strong>
              </p>

            </td>
          </tr>

          <!-- FOOTER -->

          <tr>
            <td
              align="center"
              bgcolor="#f7f9f6"
              style="
                background:#f7f9f6;
                padding:24px 20px;
                border-top:1px solid #e1e7de;
              "
            >

              <p style="
                margin:0 0 8px;
                color:#263329;
                font-size:14px;
                line-height:20px;
                font-weight:700;
              ">
                Fahrschule TAYM
              </p>

              <p style="
                margin:0 0 12px;
                font-size:12px;
                line-height:20px;
              ">
                <span
                  dir="ltr"
                  style="color:#397c00;"
                >
                  fahrschule-taym.de
                </span>
              </p>

              <p style="
                margin:0 0 8px;
                font-size:11px;
                line-height:18px;
                color:#7a847b;
              ">
                ${escapeHtml(
                  t.automaticEmail
                )}
              </p>

              <p style="
                margin:0;
                font-size:11px;
                line-height:18px;
                color:#7a847b;
              ">
                ${escapeHtml(
                  t.confidentiality
                )}
              </p>

              <p style="
                margin:14px 0 0;
                font-size:11px;
                color:#7a847b;
              ">
                &copy;

                ${
                  new Date(
                    snapshot.submittedAt
                  ).getUTCFullYear()
                }

                Fahrschule TAYM
              </p>

            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

/* ============================================================
   23. PLAIN TEXT EMAIL FALLBACK
   ============================================================ */

function renderPlainTextEmail({
  snapshot,

  locale,

  kind,

  actionUrl,
}: {
  snapshot: ApplicationEmailSnapshot;

  locale: ApplicationLocale;

  kind: ApplicationEmailKind;

  actionUrl: string | null;
}): string {
  const t =
    TRANSLATIONS[locale];

  const admin =
    kind === "ADMINISTRATOR";

  const lines: string[] = [
    BRAND_NAME,

    "",

    admin

      ? t.administratorTitle

      : t.candidateTitle,

    "",

    ...(
      admin
        ? []
        : [
            `${t.greeting} ${snapshot.candidate.firstName},`,
            "",
          ]
    ),

    admin

      ? t.administratorIntroduction

      : t.candidateIntroduction,

    "",

    t.detailsTitle,

    "-----------------------------",
  ];

  for (
    const row
    of buildApplicationRows(
      snapshot,
      locale
    )
  ) {
    lines.push(
      `${row.label}: ${row.value}`
    );
  }

  lines.push(
    "",

    t.documentsTitle,

    "-----------------------------"
  );

  const documentTypes =
    Array.from(
      new Set(
        snapshot.documents.map(
          (document) =>
            document.type
        )
      )
    );

  for (const type of documentTypes) {
    lines.push(
      `- ${getDocumentLabel(
        type,
        locale
      )}`
    );
  }

  lines.push(
    "",

    "-----------------------------"
  );

  for (
    const row
    of buildPricingRows(
      snapshot,
      locale
    )
  ) {
    lines.push(
      `${row.label}: ${row.value}`
    );
  }

  lines.push(
    "",

    t.feeNotice
  );

  if (admin) {
    lines.push("");

    for (
      const row
      of buildConfirmationRows(
        snapshot,
        locale
      )
    ) {
      lines.push(
        `${row.label}: ${row.value}`
      );
    }
  }

  if (
    snapshot.admissionReviewRequired
  ) {
    lines.push(
      "",

      t.reviewRequired
    );
  }

  lines.push(
    "",

    admin

      ? t.administratorNextStep

      : t.candidateNextStep
  );

  if (actionUrl) {
    lines.push(
      "",

      admin

        ? t.administratorButton

        : t.candidateButton,

      actionUrl
    );
  }

  lines.push(
    "",

    admin

      ? t.administratorPrivateDocuments

      : t.legalNotice,

    "",

    t.regards,

    t.team,

    "",

    "fahrschule-taym.de",

    "",

    t.automaticEmail,

    t.confidentiality
  );

  return lines.join("\n");
}

/* ============================================================
   24. BUILD CANDIDATE EMAIL
   ============================================================ */

function buildCandidateEmail(
  snapshot: ApplicationEmailSnapshot,

  configuration: EmailConfiguration
): ResendEmailPayload {
  const locale =
    normalizeApplicationLocale(
      snapshot.locale
    );

  const t =
    TRANSLATIONS[locale];

  const actionUrl =
    createCandidateApplicationLink(
      snapshot,
      configuration
    );

  return {
    from:
      configuration.fromEmail,

    to: [
      normalizeEmail(
        snapshot.candidate.email
      ),
    ],

    subject:
      safeSubject(
        `${t.candidateSubject} — ${snapshot.reference}`
      ),

    html:
      renderApplicationEmail({
        snapshot,

        locale,

        kind: "CANDIDATE",

        actionUrl,
      }),

    text:
      renderPlainTextEmail({
        snapshot,

        locale,

        kind: "CANDIDATE",

        actionUrl,
      }),

    ...(
      configuration.replyTo

        ? {
            reply_to:
              configuration.replyTo,
          }

        : {}
    ),
  };
}

/* ============================================================
   25. BUILD ADMINISTRATOR EMAIL

   Administrator email address must
   come from server configuration.

   Candidate email can never override
   the administrator recipient.
   ============================================================ */

function buildAdministratorEmail(
  snapshot: ApplicationEmailSnapshot,

  configuration: EmailConfiguration
): ResendEmailPayload {
  const locale =
    configuration.administratorLocale;

  const t =
    TRANSLATIONS[locale];

  const actionUrl =
    createAdminApplicationLink(
      snapshot,
      configuration
    );

  return {
    from:
      configuration.fromEmail,

    to: [
      configuration.administratorEmail,
    ],

    subject:
      safeSubject(
        `${t.administratorSubject} — ${snapshot.reference}`
      ),

    html:
      renderApplicationEmail({
        snapshot,

        locale,

        kind: "ADMINISTRATOR",

        actionUrl,
      }),

    text:
      renderPlainTextEmail({
        snapshot,

        locale,

        kind: "ADMINISTRATOR",

        actionUrl,
      }),

    ...(
      configuration.replyTo

        ? {
            reply_to:
              configuration.replyTo,
          }

        : {}
    ),
  };
}

/* ============================================================
   26. PERSISTENT EMAIL JOB CREATION

   Must be called inside the same
   PostgreSQL transaction as final
   application submission.

   Unique constraint:
   application_id + kind

   Repeated submission cannot create
   another candidate or admin email job.
   ============================================================ */

export async function enqueueApplicationSubmissionEmails({
  client,

  snapshot,
}: {
  client: PoolClient;

  snapshot: ApplicationEmailSnapshot;
}): Promise<void> {
  validateEmailSnapshot(
    snapshot
  );

  const configuration =
    getEmailConfiguration();

  const jobs: {
    kind: ApplicationEmailKind;

    payload: ResendEmailPayload;
  }[] = [
    {
      kind: "CANDIDATE",

      payload:
        buildCandidateEmail(
          snapshot,
          configuration
        ),
    },

    {
      kind: "ADMINISTRATOR",

      payload:
        buildAdministratorEmail(
          snapshot,
          configuration
        ),
    },
  ];

  for (const job of jobs) {
    const id =
      randomUUID();

    const idempotencyKey =
      `taym-application/${snapshot.applicationId}/${job.kind.toLowerCase()}`;

    await client.query(
      `
        INSERT INTO application_email_jobs (
          id,
          application_id,
          kind,
          status,
          payload,
          idempotency_key,
          attempts,
          next_attempt_at,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          'PENDING',
          $4::jsonb,
          $5,
          0,
          NOW(),
          NOW(),
          NOW()
        )
        ON CONFLICT (
          application_id,
          kind
        )
        DO NOTHING
      `,

      [
        id,

        snapshot.applicationId,

        job.kind,

        JSON.stringify(
          job.payload
        ),

        idempotencyKey,
      ]
    );
  }
}

export async function enqueueApplicationDecisionEmail({
  client, applicationId, reference, recipient, firstName, lastName,
  countryCode, locale, decision, reason,
}: {
  client: PoolClient;
  applicationId: string;
  reference: string;
  recipient: string;
  firstName: string;
  lastName: string;
  countryCode: ApplicationCountry;
  locale: ApplicationLocale;
  decision: "APPROVED" | "REJECTED";
  reason: string | null;
}): Promise<void> {
  const kind = decision === "APPROVED" ? "DECISION_APPROVED" : "DECISION_REJECTED";
  const content = prepareDecisionEmail({
    applicationId, applicationReference: reference, decision, reason,
    countryCode, firstName, lastName,
  }, locale);
  const payload: ResendEmailPayload = {
    from: process.env.RESEND_FROM_EMAIL?.trim() || process.env.TAYM_MAIL_FROM?.trim() || "",
    to: [recipient.trim().toLowerCase()],
    ...content,
  };
  await client.query(
    `INSERT INTO application_email_jobs
      (id, application_id, kind, status, payload, idempotency_key, attempts, next_attempt_at, created_at, updated_at)
     VALUES ($1::uuid, $2::uuid, $3, 'PENDING', $4::jsonb, $5, 0, NOW(), NOW(), NOW())
     ON CONFLICT (application_id, kind) DO NOTHING`,
    [randomUUID(), applicationId, kind, JSON.stringify(payload), `taym-application/${applicationId}/${kind.toLowerCase()}`]
  );
}

/* ============================================================
   27. DATABASE JOB ROW
   ============================================================ */

type EmailJobDatabaseRow = {
  id: string;

  application_id: string;

  kind: ApplicationEmailKind;

  status: InternalEmailStatus;

  payload: ResendEmailPayload;

  attempts: number;

  idempotency_key: string;

  lease_token: string | null;

  provider_email_id: string | null;
};

function mapEmailJob(
  row: EmailJobDatabaseRow
): ApplicationEmailJob {
  return {
    id:
      row.id,

    applicationId:
      row.application_id,

    kind:
      row.kind,

    status:
      row.status,

    payload:
      row.payload,

    attempts:
      row.attempts,

    idempotencyKey:
      row.idempotency_key,

    leaseToken:
      row.lease_token,

    providerEmailId:
      row.provider_email_id,
  };
}

/* ============================================================
   28. FINALIZE EXPIRED JOBS

   Prevent automatic resending after
   the provider idempotency window.

   Ambiguous delivery must be reviewed
   manually instead of blindly resent.
   ============================================================ */

async function finalizeExpiredEmailJobs(
  applicationId?: string
): Promise<void> {
  const pool =
    getDatabasePool();

  await pool.query(
    `
      UPDATE application_email_jobs

      SET
        status = 'FAILED',
        next_attempt_at = NULL,
        lease_token = NULL,
        lease_expires_at = NULL,

        last_error_code = CASE
          WHEN attempts >= $1
            THEN 'MAX_ATTEMPTS_REACHED'
          ELSE 'IDEMPOTENCY_WINDOW_EXPIRED'
        END,

        updated_at = NOW()

      WHERE status IN (
        'PENDING',
        'FAILED',
        'SENDING'
      )

      AND (
        status <> 'SENDING'

        OR lease_expires_at <= NOW()
      )

      AND (
        attempts >= $1

        OR (
          first_attempt_at IS NOT NULL

          AND first_attempt_at <=
            NOW() - ($2 * INTERVAL '1 hour')
        )
      )

      AND (
        $3::uuid IS NULL

        OR application_id = $3::uuid
      )
    `,

    [
      MAX_EMAIL_ATTEMPTS,

      MAX_RETRY_WINDOW_HOURS,

      applicationId ?? null,
    ]
  );
}

/* ============================================================
   29. CLAIM EMAIL JOB ATOMICALLY

   Protects concurrent workers and
   repeated candidate submissions.

   Every job receives an exclusive
   temporary lease token.
   ============================================================ */

async function claimEmailJob({
  applicationId,

  kind,
}: {
  applicationId?: string;

  kind?: ApplicationEmailKind;
}): Promise<ApplicationEmailJob | null> {
  const pool =
    getDatabasePool();

  const leaseToken =
    randomUUID();

  const result =
    await pool.query<EmailJobDatabaseRow>(
      `
        WITH selected_job AS (
          SELECT id

          FROM application_email_jobs

          WHERE (
            (
              status IN (
                'PENDING',
                'FAILED'
              )

              AND next_attempt_at IS NOT NULL

              AND next_attempt_at <= NOW()
            )

            OR (
              status = 'SENDING'

              AND lease_expires_at <= NOW()
            )
          )

          AND attempts < $1

          AND (
            first_attempt_at IS NULL

            OR first_attempt_at >
              NOW() - ($2 * INTERVAL '1 hour')
          )

          AND (
            $3::uuid IS NULL

            OR application_id = $3::uuid
          )

          AND (
            $4::text IS NULL

            OR kind = $4::text
          )

          ORDER BY
            created_at ASC,
            id ASC

          LIMIT 1

          FOR UPDATE SKIP LOCKED
        )

        UPDATE application_email_jobs AS job

        SET
          status = 'SENDING',

          attempts = job.attempts + 1,

          first_attempt_at =
            COALESCE(
              job.first_attempt_at,
              NOW()
            ),

          lease_token = $5,

          lease_expires_at =
            NOW() + ($6 * INTERVAL '1 second'),

          updated_at = NOW()

        FROM selected_job

        WHERE job.id = selected_job.id

        RETURNING
          job.id,
          job.application_id,
          job.kind,
          job.status,
          job.payload,
          job.attempts,
          job.idempotency_key,
          job.lease_token,
          job.provider_email_id
      `,

      [
        MAX_EMAIL_ATTEMPTS,

        MAX_RETRY_WINDOW_HOURS,

        applicationId ?? null,

        kind ?? null,

        leaseToken,

        EMAIL_LEASE_SECONDS,
      ]
    );

  if (
    result.rows.length === 0
  ) {
    return null;
  }

  return mapEmailJob(
    result.rows[0]
  );
}

/* ============================================================
   30. VALIDATE PERSISTED RESEND PAYLOAD
   ============================================================ */

function validateResendPayload(
  payload: ResendEmailPayload
): void {
  if (
    !payload ||

    typeof payload.from !== "string" ||

    !isValidSender(payload.from) ||

    !Array.isArray(payload.to) ||

    payload.to.length !== 1 ||

    !isValidEmail(payload.to[0]) ||

    typeof payload.subject !== "string" ||

    payload.subject.length === 0 ||

    /[\r\n]/.test(payload.subject) ||

    typeof payload.html !== "string" ||

    typeof payload.text !== "string" ||

    payload.html.length > 250_000 ||

    payload.text.length > 100_000
  ) {
    throw new ApplicationEmailError(
      "INVALID_EMAIL_PAYLOAD"
    );
  }

  if (
    payload.reply_to &&

    !isValidEmail(payload.reply_to)
  ) {
    throw new ApplicationEmailError(
      "INVALID_EMAIL_PAYLOAD"
    );
  }
}

/* ============================================================
   31. RESEND RETRY-AFTER HEADER
   ============================================================ */

function getProviderRetryAfter(
  response: Response
): number {
  const value =
    response.headers.get(
      "retry-after"
    );

  if (!value) {
    return 0;
  }

  const seconds =
    Number(value);

  if (
    Number.isFinite(seconds) &&
    seconds > 0
  ) {
    return Math.min(
      3600,

      Math.ceil(seconds)
    );
  }

  const date =
    Date.parse(value);

  if (Number.isFinite(date)) {
    return Math.min(
      3600,

      Math.max(
        0,

        Math.ceil(
          (date - Date.now()) / 1000
        )
      )
    );
  }

  return 0;
}

/* ============================================================
   32. SEND REAL EMAIL THROUGH RESEND

   Existing REST integration.
   No additional SDK required.

   The same idempotency key is reused
   for all attempts of the same job.
   ============================================================ */

async function sendResendEmail(
  job: ApplicationEmailJob
): Promise<string> {
  if (!job.payload.from) {
    job.payload.from = process.env.RESEND_FROM_EMAIL?.trim() || process.env.TAYM_MAIL_FROM?.trim() || "";
    if (!job.payload.from) {
      throw new ApplicationEmailError("RESEND_CONFIGURATION_UNAVAILABLE", true, 300);
    }
  }
  validateResendPayload(
    job.payload
  );

  const apiKey =
    process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    throw new ApplicationEmailError(
      "RESEND_CONFIGURATION_UNAVAILABLE",

      true,

      300
    );
  }

  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),

    EMAIL_TIMEOUT_MS
  );

  try {
    const response =
      await fetch(
        RESEND_API_URL,

        {
          method: "POST",

          cache: "no-store",

          redirect: "error",

          headers: {
            Authorization:
              `Bearer ${apiKey}`,

            "Content-Type":
              "application/json",

            Accept:
              "application/json",

            "Idempotency-Key":
              job.idempotencyKey,
          },

          body:
            JSON.stringify(
              job.payload
            ),

          signal:
            controller.signal,
        }
      );

    /*
     * Never log the provider response.
     * It may contain candidate data.
     */

    if (!response.ok) {
      const retryAfter =
        getProviderRetryAfter(
          response
        );

      let providerCode =
        "";

      try {
        const data =
          await response.json() as {
            name?: string;

            code?: string;
          };

        providerCode =
          data.name ??
          data.code ??
          "";

      } catch {
        // Provider response unavailable.
      }

      if (
        response.status === 429
      ) {
        throw new ApplicationEmailError(
          "RESEND_RATE_LIMIT",

          true,

          retryAfter || 60
        );
      }

      if (
        response.status === 408 ||

        response.status >= 500
      ) {
        throw new ApplicationEmailError(
          "RESEND_TEMPORARY_ERROR",

          true,

          retryAfter
        );
      }

      if (
        response.status === 409 &&

        providerCode ===
          "concurrent_idempotent_requests"
      ) {
        throw new ApplicationEmailError(
          "RESEND_CONCURRENT_REQUEST",

          true,

          30
        );
      }

      if (
        response.status === 409
      ) {
        throw new ApplicationEmailError(
          "RESEND_IDEMPOTENCY_CONFLICT"
        );
      }

      if (
        response.status === 401 ||

        response.status === 403
      ) {
        throw new ApplicationEmailError(
          "RESEND_AUTHORIZATION_ERROR"
        );
      }

      throw new ApplicationEmailError(
        `RESEND_HTTP_${response.status}`
      );
    }

    const result =
      await response.json() as {
        id?: unknown;
      };

    if (
      typeof result.id !== "string" ||

      result.id.length === 0 ||

      result.id.length > 200
    ) {
      /*
       * The provider may have accepted
       * the request despite an unexpected
       * response format.
       *
       * Retry with the exact same key.
       */

      throw new ApplicationEmailError(
        "INVALID_RESEND_RESPONSE",

        true
      );
    }

    return result.id;

  } catch (error: unknown) {
    if (
      error instanceof
        ApplicationEmailError
    ) {
      throw error;
    }

    if (
      controller.signal.aborted
    ) {
      throw new ApplicationEmailError(
        "RESEND_TIMEOUT",

        true
      );
    }

    throw new ApplicationEmailError(
      "RESEND_NETWORK_ERROR",

      true
    );

  } finally {
    clearTimeout(timeout);
  }
}

/* ============================================================
   33. MARK EMAIL ACCEPTED

   ACCEPTED means Resend accepted
   the message for sending.

   It does not guarantee delivery
   to the recipient inbox.
   ============================================================ */

async function markEmailAccepted(
  job: ApplicationEmailJob,

  providerEmailId: string
): Promise<boolean> {
  const pool =
    getDatabasePool();

  const result =
    await pool.query(
      `
        UPDATE application_email_jobs

        SET
          status = 'ACCEPTED',

          provider_email_id = $3,

          accepted_at = NOW(),

          next_attempt_at = NULL,

          lease_token = NULL,

          lease_expires_at = NULL,

          last_error_code = NULL,

          updated_at = NOW()

        WHERE id = $1

        AND lease_token = $2

        AND status = 'SENDING'
      `,

      [
        job.id,

        job.leaseToken,

        providerEmailId,
      ]
    );

  return result.rowCount === 1;
}

/* ============================================================
   34. CONTROLLED RETRY DELAY

   Approximate retry schedule:
   1st failure:  1 minute
   2nd failure:  5 minutes
   3rd failure: 15 minutes
   4th failure: 30 minutes
   5th failure: 60 minutes
   ============================================================ */

function getRetryDelaySeconds(
  attempts: number,

  retryAfter: number
): number {
  const schedule = [
    60,

    300,

    900,

    1800,

    3600,
  ];

  const index =
    Math.min(
      schedule.length - 1,

      Math.max(
        0,

        attempts - 1
      )
    );

  return Math.max(
    schedule[index],

    retryAfter
  );
}

/* ============================================================
   35. MARK EMAIL FAILED

   A failed email does not cancel
   or delete the submitted application.
   ============================================================ */

async function markEmailFailed(
  job: ApplicationEmailJob,

  error: ApplicationEmailError
): Promise<void> {
  const pool =
    getDatabasePool();

  const canRetry =
    error.retryable &&

    job.attempts <
      MAX_EMAIL_ATTEMPTS;

  const retryDelay =
    getRetryDelaySeconds(
      job.attempts,

      error.retryAfterSeconds
    );

  await pool.query(
    `
      UPDATE application_email_jobs

      SET
        status = 'FAILED',

        last_error_code = $3,

        next_attempt_at = CASE

          WHEN $4::boolean

          AND (
            NOW() +
              ($5 * INTERVAL '1 second')
          ) < (
            first_attempt_at +
              ($6 * INTERVAL '1 hour')
          )

          THEN
            NOW() +
              ($5 * INTERVAL '1 second')

          ELSE NULL

        END,

        lease_token = NULL,

        lease_expires_at = NULL,

        updated_at = NOW()

      WHERE id = $1

      AND lease_token = $2

      AND status = 'SENDING'
    `,

    [
      job.id,

      job.leaseToken,

      error.code.slice(0, 100),

      canRetry,

      retryDelay,

      MAX_RETRY_WINDOW_HOURS,
    ]
  );
}

/* ============================================================
   36. PROCESS ONE EMAIL JOB
   ============================================================ */

async function processEmailJob(
  job: ApplicationEmailJob
): Promise<ApplicationEmailDeliveryStatus> {
  let providerEmailId: string;

  try {
    providerEmailId =
      await sendResendEmail(job);

  } catch (error: unknown) {
    const emailError =
      error instanceof ApplicationEmailError

        ? error

        : new ApplicationEmailError(
            "EMAIL_SEND_FAILED",

            true
          );

    await markEmailFailed(
      job,

      emailError
    );

    console.error(
      "[TAYM][APPLICATION_EMAIL][SEND_FAILED]",

      {
        jobId: job.id,

        kind: job.kind,

        code: emailError.code,

        attempts: job.attempts,
      }
    );

    return "FAILED";
  }

  /*
   * Persist acceptance separately.
   *
   * If PostgreSQL fails after Resend
   * acceptance, leave the lease in place.
   * A later attempt reuses the same
   * provider idempotency key.
   */

  try {
    const saved =
      await markEmailAccepted(
        job,

        providerEmailId
      );

    return saved
      ? "ACCEPTED"
      : "PENDING";

  } catch {
    console.error(
      "[TAYM][APPLICATION_EMAIL][ACCEPTANCE_PERSIST_FAILED]",

      {
        jobId: job.id,

        kind: job.kind,
      }
    );

    return "PENDING";
  }
}

export async function dispatchApplicationDecisionEmail(
  applicationId: string,
  decision: "APPROVED" | "REJECTED"
): Promise<ApplicationEmailDeliveryStatus> {
  const kind = decision === "APPROVED" ? "DECISION_APPROVED" : "DECISION_REJECTED";
  const job = await claimEmailJob({ applicationId, kind });
  if (!job) return "PENDING";
  return processEmailJob(job);
}

/* ============================================================
   37. LOAD ACTUAL EMAIL STATUSES
   ============================================================ */

export async function getApplicationSubmissionEmailStatuses({
  applicationId,
}: {
  applicationId: string;
}): Promise<ApplicationSubmissionEmailResult> {
  if (
    !isValidUuid(applicationId)
  ) {
    throw new ApplicationEmailError(
      "INVALID_APPLICATION_ID"
    );
  }

  const pool =
    getDatabasePool();

  const result =
    await pool.query<{
      kind: ApplicationEmailKind;

      status: InternalEmailStatus;

      next_attempt_at: Date | null;
    }>(
      `
        SELECT
          kind,

          status,

          next_attempt_at

        FROM application_email_jobs

        WHERE application_id = $1
      `,

      [applicationId]
    );

  const statuses:
    ApplicationSubmissionEmailResult = {
      candidate: "FAILED",

      administrator: "FAILED",
    };

  for (const row of result.rows) {
    let status:
      ApplicationEmailDeliveryStatus;

    if (
      row.status === "ACCEPTED"
    ) {
      status = "ACCEPTED";

    } else if (
      row.status === "PENDING" ||

      row.status === "SENDING" ||

      (
        row.status === "FAILED" &&

        row.next_attempt_at !== null
      )
    ) {
      status = "PENDING";

    } else {
      status = "FAILED";
    }

    if (
      row.kind === "CANDIDATE"
    ) {
      statuses.candidate =
        status;
    }

    if (
      row.kind === "ADMINISTRATOR"
    ) {
      statuses.administrator =
        status;
    }
  }

  return statuses;
}

/* ============================================================
   38. DISPATCH APPLICATION EMAILS

   Main function used by:

   src/app/api/dashboard/application/submit/route.ts

   Exact return contract:

   {
     candidate: "ACCEPTED" | "PENDING" | "FAILED",
     administrator: "ACCEPTED" | "PENDING" | "FAILED"
   }

   Only committed PostgreSQL jobs
   can be dispatched.

   No email is built directly from
   browser-submitted data.
   ============================================================ */

export async function dispatchApplicationSubmissionEmails({
  applicationId,
}: {
  applicationId: string;
}): Promise<ApplicationSubmissionEmailResult> {
  if (
    !isValidUuid(applicationId)
  ) {
    throw new ApplicationEmailError(
      "INVALID_APPLICATION_ID"
    );
  }

  await finalizeExpiredEmailJobs(
    applicationId
  );

  const kinds:
    ApplicationEmailKind[] = [
      "CANDIDATE",

      "ADMINISTRATOR",
    ];

  /*
   * Each recipient is processed
   * independently.
   *
   * A failed candidate email must
   * not block the administrator email.
   */

  for (const kind of kinds) {
    try {
      const job =
        await claimEmailJob({
          applicationId,

          kind,
        });

      if (!job) {
        continue;
      }

      await processEmailJob(
        job
      );

    } catch {
      console.error(
        "[TAYM][APPLICATION_EMAIL][DISPATCH_ERROR]",

        {
          kind,
        }
      );
    }
  }

  return getApplicationSubmissionEmailStatuses({
    applicationId,
  });
}

/* ============================================================
   39. RETRY PENDING EMAILS

   Server-only worker function.

   Intended for a trusted scheduled
   job or existing internal worker.

   Never expose directly through
   an unauthenticated public endpoint.
   ============================================================ */

export async function retryPendingApplicationEmails(
  limit = DEFAULT_RETRY_BATCH_SIZE
): Promise<{
  processed: number;

  accepted: number;

  pending: number;

  failed: number;
}> {
  const batchSize =
    Number.isSafeInteger(limit)

      ? Math.min(
          MAX_RETRY_BATCH_SIZE,

          Math.max(1, limit)
        )

      : DEFAULT_RETRY_BATCH_SIZE;

  await finalizeExpiredEmailJobs();

  const result = {
    processed: 0,

    accepted: 0,

    pending: 0,

    failed: 0,
  };

  for (
    let index = 0;

    index < batchSize;

    index += 1
  ) {
    const job =
      await claimEmailJob({});

    if (!job) {
      break;
    }

    result.processed += 1;

    try {
      const status =
        await processEmailJob(
          job
        );

      switch (status) {
        case "ACCEPTED":
          result.accepted += 1;
          break;

        case "PENDING":
          result.pending += 1;
          break;

        case "FAILED":
          result.failed += 1;
          break;
      }

    } catch {
      /*
       * Lease expiration allows
       * controlled recovery.
       */

      result.pending += 1;

      console.error(
        "[TAYM][APPLICATION_EMAIL][RETRY_ERROR]",

        {
          jobId: job.id,

          kind: job.kind,
        }
      );
    }
  }

  return result;
}
