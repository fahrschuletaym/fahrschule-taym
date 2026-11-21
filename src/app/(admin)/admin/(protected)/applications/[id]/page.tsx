
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import Link from "next/link";
import { useParams } from "next/navigation";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileImage,
  FileText,
  FolderOpen,
  Globe2,
  Home,
  IdCard,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  Signature,
  UserRound,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";

/* ==========================================================
   FAHRSCHULE TAYM
   ADMIN — APPLICATION DETAILS

   File:
   src/app/(admin)/admin/(protected)/
   applications/[id]/page.tsx

   URL:
   /admin/applications/[id]

   APIs:
   GET  /api/admin/applications/[id]
   POST /api/admin/applications/[id]/decision
   GET  /api/admin/applications/[id]/
        documents/[documentId]

   No fake applicant data.
   No public document URLs.
   No client-provided administrator ID.
   No fake email notifications.

   Requires secure backend APIs.
   ========================================================== */

const API_ROOT = "/api/admin/applications";

type Locale = "de" | "ar" | "tr" | "es";
type Country = "DE" | "AT" | "BE" | "IT" | "ES";

type Status =
  | "PENDING"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED";

type VerificationStatus =
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "NOT_REQUIRED";

type DocumentType =
  | "IDENTITY_FRONT"
  | "IDENTITY_BACK"
  | "PROOF_OF_ADDRESS"
  | "PORTRAIT"
  | "SIGNATURE"
  | "OTHER";

type Decision = "APPROVED" | "REJECTED";

type Applicant = {
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  nationality: string | null;
  email: string;
  emailVerified: boolean;
  phoneE164: string;
  phoneVerified: boolean;
  countryCode: Country;
  streetAddress: string | null;
  postalCode: string | null;
  city: string | null;
};

type ApplicationDocument = {
  id: string;
  type: DocumentType;
  label: string | null;
  fileName: string | null;
  mimeType: string | null;
  status: VerificationStatus;
  uploadedAt: string | null;
};

type ExtraField = {
  key: string;
  label: string;
  value: string;
};

type Application = {
  id: string;
  reference: string;
  status: Status;
  countryCode: Country;
  licenseClass: string;
  requestType: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  applicant: Applicant;
  documents: ApplicationDocument[];
  additionalFields: ExtraField[];
  decision: {
    decidedAt: string;
    reason: string | null;
  } | null;
};

type Alert = {
  kind: "success" | "error" | "warning";
  message: string;
};

type DecisionResult = {
  success: true;
  application: Application;
  notificationStatus:
    | "QUEUED"
    | "SENT"
    | "FAILED"
    | "NOT_CONFIGURED";
};

type PageState =
  | "loading"
  | "ready"
  | "error"
  | "unauthorized"
  | "not-found";

/* ==========================================================
   TRANSLATIONS
   ========================================================== */

const TEXT = {
  de: {
    back: "Zurück zu den Anträgen",
    title: "Antragsdetails",
    reference: "Antragsnummer",
    submitted: "Eingereicht am",
    updated: "Aktualisiert am",
    refresh: "Aktualisieren",
    loading: "Antrag wird geladen...",
    loadError: "Der Antrag konnte nicht geladen werden.",
    retry: "Erneut versuchen",
    notFound: "Dieser Antrag wurde nicht gefunden.",
    unauthorized: "Die Administratorsitzung ist ungültig.",
    login: "Zur Anmeldung",
    personal: "Persönliche Angaben",
    contact: "Kontakt und Wohnadresse",
    request: "Führerscheinantrag",
    documents: "Dokumente und Nachweise",
    documentsHelp:
      "Dokumente werden einzeln über den geschützten Serverzugang geöffnet.",
    noDocuments: "Für diesen Antrag sind keine Dokumente hinterlegt.",
    verification: "Verifizierungsstatus",
    decision: "Administrative Entscheidung",
    decisionHelp:
      "Prüfe die Angaben und Dokumente, bevor du eine Entscheidung triffst.",
    firstName: "Vorname",
    lastName: "Nachname",
    dateOfBirth: "Geburtsdatum",
    nationality: "Staatsangehörigkeit",
    email: "E-Mail-Adresse",
    phone: "Telefonnummer",
    country: "Land",
    street: "Straße und Hausnummer",
    postal: "Postleitzahl",
    city: "Stadt",
    licenseClass: "Führerscheinklasse",
    requestType: "Art des Antrags",
    notes: "Anmerkungen",
    additional: "Weitere Angaben aus dem Antrag",
    missing: "Nicht angegeben",
    emailVerification: "E-Mail-Verifizierung",
    phoneVerification: "Telefon-Verifizierung",
    verified: "Bestätigt",
    unverified: "Nicht bestätigt",
    pending: "Eingegangen",
    inReview: "In Prüfung",
    approved: "Genehmigt",
    rejected: "Abgelehnt",
    docPending: "Noch nicht geprüft",
    docVerified: "Geprüft",
    docRejected: "Abgelehnt",
    docNotRequired: "Nicht erforderlich",
    identityFront: "Ausweis – Vorderseite",
    identityBack: "Ausweis – Rückseite",
    proofAddress: "Wohnsitznachweis",
    portrait: "Passfoto",
    signature: "Unterschrift",
    otherDocument: "Weiteres Dokument",
    openDocument: "Dokument ansehen",
    openDocumentHelp:
      "Für jedes Dokument wird die Berechtigung erneut geprüft.",
    approve: "Antrag genehmigen",
    reject: "Antrag ablehnen",
    confirmApprove: "Genehmigung bestätigen",
    confirmReject: "Ablehnung bestätigen",
    approveQuestion:
      "Möchtest du diesen Antrag wirklich genehmigen?",
    rejectQuestion:
      "Möchtest du diesen Antrag wirklich ablehnen?",
    rejectReason: "Grund der Ablehnung",
    rejectPlaceholder:
      "Erkläre, welche Angaben oder Unterlagen korrigiert werden müssen...",
    reasonRequired:
      "Bitte gib einen Grund mit mindestens 10 Zeichen an.",
    reasonTooLong:
      "Der Grund darf höchstens 1000 Zeichen enthalten.",
    cancel: "Abbrechen",
    confirm: "Entscheidung speichern",
    saving: "Entscheidung wird gespeichert...",
    saved: "Die Entscheidung wurde gespeichert.",
    emailQueued:
      "Die Benachrichtigung wurde für den E-Mail-Versand vorgemerkt.",
    emailSent: "Der E-Mail-Anbieter hat die Nachricht angenommen.",
    emailFailed:
      "Die Entscheidung wurde gespeichert, aber die E-Mail konnte nicht versendet werden.",
    emailNotConfigured:
      "Die Entscheidung wurde gespeichert. Der E-Mail-Versand ist noch nicht eingerichtet.",
    decisionError:
      "Die Entscheidung konnte nicht gespeichert werden.",
    conflict:
      "Der Antrag wurde inzwischen verändert. Lade ihn erneut.",
    alreadyDecided:
      "Dieser Antrag wurde bereits entschieden.",
    reasonRecorded: "Grund der Entscheidung",
    decidedAt: "Entschieden am",
    confidentiality:
      "Vertrauliche Dokumente dürfen nur zur berechtigten Bearbeitung dieses Antrags verwendet werden.",
    noPermitIssued:
      "Die Genehmigung des Antrags ist keine behördliche Erteilung eines Führerscheins.",
  },

  ar: {
    back: "العودة إلى الطلبات",
    title: "تفاصيل الطلب",
    reference: "رقم الطلب",
    submitted: "تاريخ الإرسال",
    updated: "آخر تحديث",
    refresh: "تحديث",
    loading: "جارٍ تحميل الطلب...",
    loadError: "تعذر تحميل الطلب.",
    retry: "إعادة المحاولة",
    notFound: "لم يتم العثور على هذا الطلب.",
    unauthorized: "جلسة المسؤول غير صالحة.",
    login: "تسجيل الدخول",
    personal: "المعلومات الشخصية",
    contact: "الاتصال وعنوان الإقامة",
    request: "طلب رخصة القيادة",
    documents: "المستندات والإثباتات",
    documentsHelp:
      "يتم فتح كل مستند عبر الخادم المحمي بشكل مستقل.",
    noDocuments: "لا توجد مستندات مسجلة لهذا الطلب.",
    verification: "حالة التحقق",
    decision: "القرار الإداري",
    decisionHelp:
      "راجع المعلومات والمستندات قبل اتخاذ القرار.",
    firstName: "الاسم الأول",
    lastName: "اسم العائلة",
    dateOfBirth: "تاريخ الميلاد",
    nationality: "الجنسية",
    email: "البريد الإلكتروني",
    phone: "رقم الهاتف",
    country: "الدولة",
    street: "عنوان الإقامة ورقم المنزل",
    postal: "الرمز البريدي",
    city: "المدينة",
    licenseClass: "فئة الرخصة",
    requestType: "نوع الطلب",
    notes: "ملاحظات",
    additional: "معلومات إضافية في الطلب",
    missing: "غير محدد",
    emailVerification: "التحقق من البريد",
    phoneVerification: "التحقق من الهاتف",
    verified: "تم التحقق",
    unverified: "لم يتم التحقق",
    pending: "تم الاستلام",
    inReview: "قيد المراجعة",
    approved: "تمت الموافقة",
    rejected: "مرفوض",
    docPending: "لم تتم مراجعته",
    docVerified: "تمت مراجعته",
    docRejected: "مرفوض",
    docNotRequired: "غير مطلوب",
    identityFront: "الهوية – الوجه الأمامي",
    identityBack: "الهوية – الوجه الخلفي",
    proofAddress: "إثبات الإقامة",
    portrait: "الصورة الشخصية",
    signature: "التوقيع",
    otherDocument: "مستند آخر",
    openDocument: "عرض المستند",
    openDocumentHelp:
      "يتم التحقق من الصلاحيات عند فتح كل مستند.",
    approve: "الموافقة على الطلب",
    reject: "رفض الطلب",
    confirmApprove: "تأكيد الموافقة",
    confirmReject: "تأكيد الرفض",
    approveQuestion: "هل تريد الموافقة على هذا الطلب؟",
    rejectQuestion: "هل تريد رفض هذا الطلب؟",
    rejectReason: "سبب الرفض",
    rejectPlaceholder:
      "اشرح ما يجب تصحيحه من المعلومات أو المستندات...",
    reasonRequired:
      "أدخل سبباً من 10 أحرف على الأقل.",
    reasonTooLong: "الحد الأقصى 1000 حرف.",
    cancel: "إلغاء",
    confirm: "حفظ القرار",
    saving: "جارٍ حفظ القرار...",
    saved: "تم حفظ القرار.",
    emailQueued: "تمت جدولة إشعار البريد الإلكتروني.",
    emailSent: "قبل مزود البريد الإلكتروني الرسالة.",
    emailFailed:
      "تم حفظ القرار لكن تعذر إرسال البريد.",
    emailNotConfigured:
      "تم حفظ القرار، لكن خدمة البريد غير مجهزة بعد.",
    decisionError: "تعذر حفظ القرار.",
    conflict: "تم تعديل الطلب. يرجى تحديثه.",
    alreadyDecided: "تم اتخاذ قرار لهذا الطلب مسبقاً.",
    reasonRecorded: "سبب القرار",
    decidedAt: "تاريخ القرار",
    confidentiality:
      "المستندات سرية ويجب استخدامها فقط لمعالجة الطلب.",
    noPermitIssued:
      "الموافقة على الطلب لا تعني إصدار رخصة رسمية من السلطات.",
  },

  tr: {
    back: "Başvurulara dön",
    title: "Başvuru ayrıntıları",
    reference: "Başvuru numarası",
    submitted: "Başvuru tarihi",
    updated: "Güncelleme tarihi",
    refresh: "Yenile",
    loading: "Başvuru yükleniyor...",
    loadError: "Başvuru yüklenemedi.",
    retry: "Tekrar dene",
    notFound: "Başvuru bulunamadı.",
    unauthorized: "Yönetici oturumu geçersiz.",
    login: "Giriş yap",
    personal: "Kişisel bilgiler",
    contact: "İletişim ve ikamet adresi",
    request: "Ehliyet başvurusu",
    documents: "Belgeler ve kanıtlar",
    documentsHelp:
      "Her belge korumalı sunucu üzerinden açılır.",
    noDocuments: "Bu başvuruya ait belge bulunmuyor.",
    verification: "Doğrulama durumu",
    decision: "Yönetici kararı",
    decisionHelp:
      "Karar vermeden önce bilgileri ve belgeleri inceleyin.",
    firstName: "Ad",
    lastName: "Soyad",
    dateOfBirth: "Doğum tarihi",
    nationality: "Uyruk",
    email: "E-posta adresi",
    phone: "Telefon numarası",
    country: "Ülke",
    street: "Cadde ve kapı numarası",
    postal: "Posta kodu",
    city: "Şehir",
    licenseClass: "Ehliyet sınıfı",
    requestType: "Başvuru türü",
    notes: "Notlar",
    additional: "Başvurudaki diğer bilgiler",
    missing: "Belirtilmedi",
    emailVerification: "E-posta doğrulaması",
    phoneVerification: "Telefon doğrulaması",
    verified: "Doğrulandı",
    unverified: "Doğrulanmadı",
    pending: "Alındı",
    inReview: "İnceleniyor",
    approved: "Onaylandı",
    rejected: "Reddedildi",
    docPending: "İncelenmedi",
    docVerified: "İncelendi",
    docRejected: "Reddedildi",
    docNotRequired: "Gerekli değil",
    identityFront: "Kimlik – ön yüz",
    identityBack: "Kimlik – arka yüz",
    proofAddress: "İkamet belgesi",
    portrait: "Vesikalık fotoğraf",
    signature: "İmza",
    otherDocument: "Diğer belge",
    openDocument: "Belgeyi görüntüle",
    openDocumentHelp:
      "Her belge açılışında yetki yeniden denetlenir.",
    approve: "Başvuruyu onayla",
    reject: "Başvuruyu reddet",
    confirmApprove: "Onayı doğrula",
    confirmReject: "Reddi doğrula",
    approveQuestion:
      "Bu başvuruyu onaylamak istiyor musunuz?",
    rejectQuestion:
      "Bu başvuruyu reddetmek istiyor musunuz?",
    rejectReason: "Ret nedeni",
    rejectPlaceholder:
      "Düzeltilmesi gereken bilgileri veya belgeleri açıklayın...",
    reasonRequired:
      "En az 10 karakterlik bir neden girin.",
    reasonTooLong: "En fazla 1000 karakter.",
    cancel: "İptal",
    confirm: "Kararı kaydet",
    saving: "Karar kaydediliyor...",
    saved: "Karar kaydedildi.",
    emailQueued: "E-posta bildirimi gönderim sırasına alındı.",
    emailSent: "E-posta sağlayıcısı mesajı kabul etti.",
    emailFailed:
      "Karar kaydedildi ancak e-posta gönderilemedi.",
    emailNotConfigured:
      "Karar kaydedildi. E-posta hizmeti henüz kurulmadı.",
    decisionError: "Karar kaydedilemedi.",
    conflict:
      "Başvuru başka bir işlemle değiştirildi. Yenileyin.",
    alreadyDecided: "Bu başvuru için karar zaten verilmiş.",
    reasonRecorded: "Karar gerekçesi",
    decidedAt: "Karar tarihi",
    confidentiality:
      "Gizli belgeler yalnızca yetkili başvuru işlemleri için kullanılmalıdır.",
    noPermitIssued:
      "Başvurunun onayı resmi ehliyet verildiği anlamına gelmez.",
  },

  es: {
    back: "Volver a las solicitudes",
    title: "Detalle de la solicitud",
    reference: "Número de solicitud",
    submitted: "Presentada el",
    updated: "Actualizada el",
    refresh: "Actualizar",
    loading: "Cargando solicitud...",
    loadError: "No se pudo cargar la solicitud.",
    retry: "Reintentar",
    notFound: "No se encontró la solicitud.",
    unauthorized: "La sesión de administrador no es válida.",
    login: "Iniciar sesión",
    personal: "Información personal",
    contact: "Contacto y residencia",
    request: "Solicitud de permiso",
    documents: "Documentos y justificantes",
    documentsHelp:
      "Cada documento se abre mediante el servidor protegido.",
    noDocuments: "No hay documentos asociados a esta solicitud.",
    verification: "Estado de verificación",
    decision: "Decisión administrativa",
    decisionHelp:
      "Revise los datos y documentos antes de decidir.",
    firstName: "Nombre",
    lastName: "Apellidos",
    dateOfBirth: "Fecha de nacimiento",
    nationality: "Nacionalidad",
    email: "Correo electrónico",
    phone: "Teléfono",
    country: "País",
    street: "Calle y número",
    postal: "Código postal",
    city: "Ciudad",
    licenseClass: "Categoría de permiso",
    requestType: "Tipo de solicitud",
    notes: "Observaciones",
    additional: "Otros datos de la solicitud",
    missing: "No indicado",
    emailVerification: "Verificación del correo",
    phoneVerification: "Verificación del teléfono",
    verified: "Verificado",
    unverified: "Sin verificar",
    pending: "Recibida",
    inReview: "En revisión",
    approved: "Aprobada",
    rejected: "Rechazada",
    docPending: "Sin revisar",
    docVerified: "Revisado",
    docRejected: "Rechazado",
    docNotRequired: "No requerido",
    identityFront: "Identidad – anverso",
    identityBack: "Identidad – reverso",
    proofAddress: "Justificante de residencia",
    portrait: "Foto de identidad",
    signature: "Firma",
    otherDocument: "Otro documento",
    openDocument: "Ver documento",
    openDocumentHelp:
      "Se comprueban los permisos cada vez que se abre un documento.",
    approve: "Aprobar solicitud",
    reject: "Rechazar solicitud",
    confirmApprove: "Confirmar aprobación",
    confirmReject: "Confirmar rechazo",
    approveQuestion:
      "¿Desea aprobar esta solicitud?",
    rejectQuestion:
      "¿Desea rechazar esta solicitud?",
    rejectReason: "Motivo del rechazo",
    rejectPlaceholder:
      "Explique qué información o documentos deben corregirse...",
    reasonRequired:
      "Introduzca un motivo de al menos 10 caracteres.",
    reasonTooLong: "Máximo de 1000 caracteres.",
    cancel: "Cancelar",
    confirm: "Guardar decisión",
    saving: "Guardando decisión...",
    saved: "La decisión se ha guardado.",
    emailQueued:
      "La notificación se ha puesto en cola para enviarla.",
    emailSent: "El proveedor de correo ha aceptado el mensaje.",
    emailFailed:
      "La decisión se guardó, pero falló el envío del correo.",
    emailNotConfigured:
      "La decisión se guardó. El servicio de correo aún no está configurado.",
    decisionError: "No se pudo guardar la decisión.",
    conflict:
      "La solicitud ha cambiado. Actualice los datos.",
    alreadyDecided:
      "Esta solicitud ya tiene una decisión.",
    reasonRecorded: "Motivo de la decisión",
    decidedAt: "Fecha de decisión",
    confidentiality:
      "Los documentos confidenciales solo deben utilizarse para tramitar esta solicitud.",
    noPermitIssued:
      "La aprobación no implica la expedición oficial de un permiso de conducir.",
  },
} as const;

type Dictionary = (typeof TEXT)[keyof typeof TEXT];

/* ==========================================================
   LANGUAGE HELPERS
   ========================================================== */

function asLocale(value: unknown): Locale | null {
  if (typeof value !== "string") return null;

  const lang = value
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];

  return lang === "de" ||
    lang === "ar" ||
    lang === "tr" ||
    lang === "es"
    ? lang
    : null;
}

function cookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;

  const item = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!item) return null;

  try {
    return decodeURIComponent(
      item.slice(name.length + 1)
    );
  } catch {
    return null;
  }
}

function activeLocale(): Locale {
  if (typeof document === "undefined") return "de";

  const html = asLocale(document.documentElement.lang);
  if (html) return html;

  const cookie =
    asLocale(cookieValue("taym-locale")) ??
    asLocale(cookieValue("NEXT_LOCALE"));

  if (cookie) return cookie;

  try {
    return asLocale(
      localStorage.getItem("taym-locale")
    ) ?? "de";
  } catch {
    return "de";
  }
}

/* ==========================================================
   STRICT RESPONSE READING
   ========================================================== */

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function requiredString(
  value: unknown,
  max = 500
): string {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > max
  ) {
    throw new Error("INVALID_SERVER_RESPONSE");
  }

  return value;
}

function nullableString(
  value: unknown,
  max = 2000
): string | null {
  if (value === null || value === undefined) return null;

  if (
    typeof value !== "string" ||
    value.length > max
  ) {
    throw new Error("INVALID_SERVER_RESPONSE");
  }

  return value;
}

function dateValue(
  value: unknown
): string {
  if (
    typeof value !== "string" ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error("INVALID_DATE");
  }

  return value;
}

function nullableDate(
  value: unknown
): string | null {
  return value === null || value === undefined
    ? null
    : dateValue(value);
}

function countryValue(value: unknown): Country {
  if (
    value === "DE" ||
    value === "AT" ||
    value === "BE" ||
    value === "IT" ||
    value === "ES"
  ) {
    return value;
  }

  throw new Error("INVALID_COUNTRY");
}

function statusValue(value: unknown): Status {
  if (
    value === "PENDING" ||
    value === "IN_REVIEW" ||
    value === "APPROVED" ||
    value === "REJECTED"
  ) {
    return value;
  }

  throw new Error("INVALID_STATUS");
}

function docStatus(
  value: unknown
): VerificationStatus {
  if (
    value === "PENDING" ||
    value === "VERIFIED" ||
    value === "REJECTED" ||
    value === "NOT_REQUIRED"
  ) {
    return value;
  }

  throw new Error("INVALID_DOCUMENT_STATUS");
}

function docType(value: unknown): DocumentType {
  if (
    value === "IDENTITY_FRONT" ||
    value === "IDENTITY_BACK" ||
    value === "PROOF_OF_ADDRESS" ||
    value === "PORTRAIT" ||
    value === "SIGNATURE"
  ) {
    return value;
  }

  return "OTHER";
}

function parseDocument(
  value: unknown
): ApplicationDocument {
  if (!isRecord(value)) {
    throw new Error("INVALID_DOCUMENT");
  }

  return {
    id: requiredString(value.id, 150),
    type: docType(value.type),
    label: nullableString(value.label, 150),
    fileName: nullableString(value.fileName, 250),
    mimeType: nullableString(value.mimeType, 100),
    status: docStatus(value.status),
    uploadedAt: nullableDate(value.uploadedAt),
  };
}

function parseApplication(value: unknown): Application {
  if (
    !isRecord(value) ||
    !isRecord(value.applicant) ||
    !Array.isArray(value.documents) ||
    !Array.isArray(value.additionalFields)
  ) {
    throw new Error("INVALID_APPLICATION");
  }

  const person = value.applicant;

  if (
    typeof person.emailVerified !== "boolean" ||
    typeof person.phoneVerified !== "boolean"
  ) {
    throw new Error("INVALID_VERIFICATION_FLAGS");
  }

  let decision: Application["decision"] = null;

  if (value.decision != null) {
    if (!isRecord(value.decision)) {
      throw new Error("INVALID_DECISION");
    }

    decision = {
      decidedAt: dateValue(value.decision.decidedAt),
      reason: nullableString(
        value.decision.reason,
        1000
      ),
    };
  }

  return {
    id: requiredString(value.id, 150),
    reference: requiredString(value.reference, 120),
    status: statusValue(value.status),
    countryCode: countryValue(value.countryCode),
    licenseClass: requiredString(
      value.licenseClass,
      100
    ),
    requestType: nullableString(
      value.requestType,
      150
    ),
    notes: nullableString(value.notes, 3000),
    createdAt: dateValue(value.createdAt),
    updatedAt: dateValue(value.updatedAt),

    applicant: {
      firstName: requiredString(person.firstName, 150),
      lastName: requiredString(person.lastName, 150),
      dateOfBirth: nullableDate(person.dateOfBirth),
      nationality: nullableString(
        person.nationality,
        120
      ),
      email: requiredString(person.email, 254),
      emailVerified: person.emailVerified,
      phoneE164: requiredString(
        person.phoneE164,
        40
      ),
      phoneVerified: person.phoneVerified,
      countryCode: countryValue(person.countryCode),
      streetAddress: nullableString(
        person.streetAddress,
        250
      ),
      postalCode: nullableString(
        person.postalCode,
        20
      ),
      city: nullableString(person.city, 150),
    },

    documents: value.documents.map(parseDocument),

    additionalFields: value.additionalFields.map(
      (field: unknown) => {
        if (!isRecord(field)) {
          throw new Error("INVALID_EXTRA_FIELD");
        }

        return {
          key: requiredString(field.key, 120),
          label: requiredString(field.label, 160),
          value: requiredString(field.value, 3000),
        };
      }
    ),

    decision,
  };
}

function parseDecisionResponse(
  value: unknown
): DecisionResult {
  if (
    !isRecord(value) ||
    value.success !== true
  ) {
    throw new Error("INVALID_DECISION_RESPONSE");
  }

  const status = value.notificationStatus;

  if (
    status !== "QUEUED" &&
    status !== "SENT" &&
    status !== "FAILED" &&
    status !== "NOT_CONFIGURED"
  ) {
    throw new Error("INVALID_NOTIFICATION_STATUS");
  }

  return {
    success: true,
    application: parseApplication(value.application),
    notificationStatus: status,
  };
}

/* ==========================================================
   FORMATTING AND DISPLAY
   ========================================================== */

const INTL: Record<Locale, string> = {
  de: "de-DE",
  ar: "ar",
  tr: "tr-TR",
  es: "es-ES",
};

const COUNTRY_NAMES: Record<
  Country,
  Record<Locale, string>
> = {
  DE: {
    de: "Deutschland",
    ar: "ألمانيا",
    tr: "Almanya",
    es: "Alemania",
  },
  AT: {
    de: "Österreich",
    ar: "النمسا",
    tr: "Avusturya",
    es: "Austria",
  },
  BE: {
    de: "Belgien",
    ar: "بلجيكا",
    tr: "Belçika",
    es: "Bélgica",
  },
  IT: {
    de: "Italien",
    ar: "إيطاليا",
    tr: "İtalya",
    es: "Italia",
  },
  ES: {
    de: "Spanien",
    ar: "إسبانيا",
    tr: "İspanya",
    es: "España",
  },
};

const FLAGS: Record<Country, string> = {
  DE: "🇩🇪",
  AT: "🇦🇹",
  BE: "🇧🇪",
  IT: "🇮🇹",
  ES: "🇪🇸",
};

function formatDate(
  value: string | null,
  locale: Locale,
  dateOnly = false
): string {
  if (!value) return "—";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) return "—";

  return new Intl.DateTimeFormat(
    INTL[locale],
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      ...(dateOnly
        ? { timeZone: "UTC" }
        : {
            timeZone: "Europe/Berlin",
            hour: "2-digit" as const,
            minute: "2-digit" as const,
          }),
    }
  ).format(date);
}

function statusLabel(
  status: Status,
  t: Dictionary
) {
  switch (status) {
    case "PENDING":
      return t.pending;
    case "IN_REVIEW":
      return t.inReview;
    case "APPROVED":
      return t.approved;
    case "REJECTED":
      return t.rejected;
  }
}

const DOCUMENTS: Record<
  DocumentType,
  {
    icon: LucideIcon;
    label:
      | "identityFront"
      | "identityBack"
      | "proofAddress"
      | "portrait"
      | "signature"
      | "otherDocument";
  }
> = {
  IDENTITY_FRONT: {
    icon: IdCard,
    label: "identityFront",
  },
  IDENTITY_BACK: {
    icon: IdCard,
    label: "identityBack",
  },
  PROOF_OF_ADDRESS: {
    icon: Home,
    label: "proofAddress",
  },
  PORTRAIT: {
    icon: FileImage,
    label: "portrait",
  },
  SIGNATURE: {
    icon: Signature,
    label: "signature",
  },
  OTHER: {
    icon: FileText,
    label: "otherDocument",
  },
};

function StatusBadge({
  status,
  t,
}: {
  status: Status;
  t: Dictionary;
}) {
  const styles: Record<Status, string> = {
    PENDING:
      "border-amber-200 bg-amber-50 text-amber-800",
    IN_REVIEW:
      "border-blue-200 bg-blue-50 text-blue-800",
    APPROVED:
      "border-green-200 bg-lime-50 text-green-800",
    REJECTED:
      "border-red-200 bg-red-50 text-red-800",
  };

  const Icon =
    status === "APPROVED"
      ? CheckCircle2
      : status === "REJECTED"
        ? XCircle
        : Clock3;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-extrabold ${styles[status]}`}
    >
      <Icon size={15} aria-hidden="true" />
      {statusLabel(status, t)}
    </span>
  );
}

function VerifyBadge({
  verified,
  t,
}: {
  verified: boolean;
  t: Dictionary;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${
        verified
          ? "border-green-200 bg-lime-50 text-green-800"
          : "border-amber-200 bg-amber-50 text-amber-800"
      }`}
    >
      {verified ? (
        <CheckCircle2 size={14} />
      ) : (
        <Clock3 size={14} />
      )}
      {verified ? t.verified : t.unverified}
    </span>
  );
}

function DocBadge({
  status,
  t,
}: {
  status: VerificationStatus;
  t: Dictionary;
}) {
  const labels = {
    PENDING: t.docPending,
    VERIFIED: t.docVerified,
    REJECTED: t.docRejected,
    NOT_REQUIRED: t.docNotRequired,
  };

  const styles = {
    PENDING: "bg-amber-50 text-amber-800",
    VERIFIED: "bg-lime-50 text-green-800",
    REJECTED: "bg-red-50 text-red-800",
    NOT_REQUIRED: "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function Field({
  label,
  value,
  icon: Icon,
  locale,
}: {
  label: string;
  value: string | null | undefined;
  icon?: LucideIcon;
  locale: Locale;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        {Icon && (
          <Icon size={15} aria-hidden="true" />
        )}
        <span>{label}</span>
      </div>

      <p
        dir="auto"
        className="mt-2 whitespace-pre-wrap wrap-break-word text-sm font-bold leading-relaxed text-slate-900"
      >
        {value || TEXT[locale].missing}
      </p>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
  subtitle,
}: {
  title: string;
  icon: LucideIcon;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-start gap-3 border-b border-slate-100 p-4 sm:p-6">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-green-800">
          <Icon size={22} aria-hidden="true" />
        </span>

        <div>
          <h2 className="text-base font-black text-slate-950 sm:text-lg">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">
              {subtitle}
            </p>
          )}
        </div>
      </header>

      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

/* ==========================================================
   MAIN PAGE
   ========================================================== */

export default function AdminApplicationDetailPage() {
  const params = useParams();

  const routeId =
    typeof params.id === "string"
      ? params.id
      : null;

  const validId =
    routeId !== null &&
    /^[A-Za-z0-9_-]{1,150}$/.test(routeId);

  const [locale, setLocale] =
    useState<Locale>("de");

  const [application, setApplication] =
    useState<Application | null>(null);

  const [pageState, setPageState] =
    useState<PageState>("loading");

  const [refreshKey, setRefreshKey] =
    useState(0);

  const [modal, setModal] =
    useState<Decision | null>(null);

  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);

  const [saving, setSaving] = useState(false);

  const [alert, setAlert] =
    useState<Alert | null>(null);

  const submitLock = useRef(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const t = TEXT[locale];
  const rtl = locale === "ar";

  const detailUrl = useMemo(
    () =>
      validId
        ? `${API_ROOT}/${encodeURIComponent(routeId)}`
        : null,
    [routeId, validId]
  );

  /* --------------------------------------------------------
     Language synchronization
     -------------------------------------------------------- */

  useEffect(() => {
    const sync = (event?: Event) => {
      if (event instanceof CustomEvent) {
        const detail: unknown = event.detail;

        const next = asLocale(
          typeof detail === "string"
            ? detail
            : isRecord(detail)
              ? detail.locale
              : null
        );

        if (next) {
          setLocale(next);
          return;
        }
      }

      setLocale(activeLocale());
    };

    sync();

    const observer = new MutationObserver(() => sync());

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });

    window.addEventListener(
      "taym:language-change",
      sync
    );

    window.addEventListener("storage", sync);

    return () => {
      observer.disconnect();
      window.removeEventListener(
        "taym:language-change",
        sync
      );
      window.removeEventListener("storage", sync);
    };
  }, []);

  /* --------------------------------------------------------
     Load one application

     Do not pass user or administrator IDs.
     The server determines permissions.
     -------------------------------------------------------- */

  const load = useCallback(
    async (signal: AbortSignal) => {
      if (!detailUrl) {
        setApplication(null);
        setPageState("not-found");
        return;
      }

      setPageState("loading");

      try {
        const response = await fetch(detailUrl, {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
          signal,
        });

        if (signal.aborted) return;

        if (response.status === 401 ||
            response.status === 403) {
          setApplication(null);
          setPageState("unauthorized");
          return;
        }

        if (response.status === 404) {
          setApplication(null);
          setPageState("not-found");
          return;
        }

        if (!response.ok) {
          throw new Error("LOAD_FAILED");
        }

        const json: unknown = await response.json();

        if (
          !isRecord(json) ||
          json.success !== true
        ) {
          throw new Error("INVALID_RESPONSE");
        }

        const result = parseApplication(
          json.application
        );

        if (result.id !== routeId) {
          throw new Error("APPLICATION_ID_MISMATCH");
        }

        if (signal.aborted) return;

        setApplication(result);
        setPageState("ready");
      } catch (error) {
        if (
          signal.aborted ||
          (error instanceof Error &&
            error.name === "AbortError")
        ) {
          return;
        }

        setApplication(null);
        setPageState("error");
      }
    },
    [detailUrl, routeId]
  );

  useEffect(() => {
    const controller = new AbortController();

    const timer = window.setTimeout(() => void load(controller.signal), 0);

    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, refreshKey]);

  const refresh = () => {
    if (saving) return;
    setAlert(null);
    setRefreshKey((previous) => previous + 1);
  };

  /* --------------------------------------------------------
     Decision modal
     -------------------------------------------------------- */

  function openDecision(type: Decision) {
    if (
      !application ||
      saving ||
      (application.status !== "PENDING" &&
       application.status !== "IN_REVIEW")
    ) {
      return;
    }

    setModal(type);
    setReason("");
    setReasonError(false);
    setAlert(null);
  }

  function closeDecision() {
    if (saving) return;
    setModal(null);
    setReason("");
    setReasonError(false);
  }

  useEffect(() => {
    if (!modal) return;

    const previousFocus = document.activeElement;

    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !saving) {
        closeDecision();
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        modalRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),textarea:not([disabled])'
        ) ?? []
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (
        event.shiftKey &&
        document.activeElement === first
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKey);

    const first = modalRef.current?.querySelector<
      HTMLButtonElement | HTMLTextAreaElement
    >("textarea,button");

    first?.focus();

    return () => {
      document.removeEventListener("keydown", handleKey);

      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
    // closeDecision is intentionally bound to modal/saving state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal, saving]);

  /* --------------------------------------------------------
     Save decision

     Expected server contract:
     POST /api/admin/applications/[id]/decision

     Body:
     {
       decision: "APPROVED" | "REJECTED",
       reason: string | null,
       expectedStatus: Status,
       expectedUpdatedAt: string
     }

     Success:
     {
       success: true,
       application: Application,
       notificationStatus:
         "QUEUED" | "SENT" |
         "FAILED" | "NOT_CONFIGURED"
     }

     The backend must make the status,
     audit record and email outbox
     write atomic in PostgreSQL.

     -------------------------------------------------------- */

  async function submitDecision(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !modal ||
      !application ||
      !detailUrl ||
      submitLock.current ||
      saving
    ) {
      return;
    }

    const normalizedReason = reason
      .normalize("NFC")
      .trim()
      .replace(/\s+/gu, " ");

    if (
      modal === "REJECTED" &&
      (normalizedReason.length < 10 ||
       normalizedReason.length > 1000)
    ) {
      setReasonError(true);
      return;
    }

    submitLock.current = true;
    setSaving(true);
    setReasonError(false);

    const decision = modal;

    try {
      const response = await fetch(
        `${detailUrl}/decision`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },

          body: JSON.stringify({
            decision,
            reason:
              decision === "REJECTED"
                ? normalizedReason
                : null,
            expectedStatus:
              application.status,
            expectedUpdatedAt:
              application.updatedAt,
          }),
        }
      );

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        setModal(null);
        setApplication(null);
        setPageState("unauthorized");
        return;
      }

      if (response.status === 409) {
        setModal(null);
        setAlert({
          kind: "warning",
          message: t.conflict,
        });
        setRefreshKey((value) => value + 1);
        return;
      }

      if (!response.ok) {
        throw new Error("DECISION_FAILED");
      }

      const json: unknown = await response.json();
      const result = parseDecisionResponse(json);

      if (
        result.application.id !== application.id ||
        result.application.status !== decision
      ) {
        throw new Error("INVALID_DECISION_RESULT");
      }

      setApplication(result.application);
      setPageState("ready");
      setModal(null);
      setReason("");

      const notificationMessage =
        result.notificationStatus === "SENT"
          ? t.emailSent
          : result.notificationStatus === "QUEUED"
            ? t.emailQueued
            : result.notificationStatus === "FAILED"
              ? t.emailFailed
              : t.emailNotConfigured;

      setAlert({
        kind:
          result.notificationStatus === "FAILED" ||
          result.notificationStatus === "NOT_CONFIGURED"
            ? "warning"
            : "success",
        message: `${t.saved} ${notificationMessage}`,
      });
    } catch {
      setAlert({
        kind: "error",
        message: t.decisionError,
      });
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  }

  /* ========================================================
     RENDER
     ======================================================== */

  const readOnlyDecision =
    application?.status === "APPROVED" ||
    application?.status === "REJECTED";

  return (
    <div
      lang={locale}
      dir={rtl ? "rtl" : "ltr"}
      className="min-w-0 px-4 py-6 text-slate-950 sm:px-6 sm:py-8 lg:px-8"
    >
      <div className="mx-auto max-w-none space-y-6">

        {/* TOP NAVIGATION */}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin/applications"
            className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-green-800 hover:text-green-950"
          >
            {rtl ? (
              <ArrowRight size={17} />
            ) : (
              <ArrowLeft size={17} />
            )}
            {t.back}
          </Link>

          <button
            type="button"
            disabled={pageState === "loading" || saving}
            onClick={refresh}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} />
            {t.refresh}
          </button>
        </div>

        {/* PAGE STATES */}

        {pageState === "loading" && (
          <div
            role="status"
            className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center"
          >
            <Loader2
              size={34}
              className="animate-spin text-green-800"
            />

            <p className="mt-4 text-sm text-slate-600">
              {t.loading}
            </p>
          </div>
        )}

        {pageState === "unauthorized" && (
          <div className="rounded-2xl border border-amber-200 bg-white p-8 text-center">
            <LockKeyhole
              size={38}
              className="mx-auto text-amber-700"
            />

            <p className="mt-4 font-bold">
              {t.unauthorized}
            </p>

            <Link
              href="/admin/login"
              className="mt-5 inline-flex rounded-xl bg-green-800 px-5 py-3 text-sm font-bold text-white"
            >
              {t.login}
            </Link>
          </div>
        )}

        {(pageState === "error" ||
          pageState === "not-found") && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-white p-8 text-center"
          >
            <AlertCircle
              size={38}
              className="mx-auto text-red-700"
            />

            <p className="mt-4 text-sm font-bold">
              {pageState === "not-found"
                ? t.notFound
                : t.loadError}
            </p>

            <button
              type="button"
              onClick={refresh}
              className="mt-5 rounded-xl bg-green-800 px-5 py-3 text-sm font-bold text-white"
            >
              {t.retry}
            </button>
          </div>
        )}

        {/* APPLICATION CONTENT */}

        {pageState === "ready" && application && (
          <>
            {/* SUMMARY HEADER */}

            <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="h-2 bg-linear-to-r from-green-900 to-lime-500" />

              <div className="p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-2 rounded-full bg-lime-50 px-3 py-1.5 text-xs font-bold text-green-800">
                      <ClipboardCheck size={15} />
                      {t.title}
                    </span>

                    <h1 className="mt-4 wrap-break-word text-2xl font-black sm:text-3xl">
                      {application.applicant.firstName}{" "}
                      {application.applicant.lastName}
                    </h1>

                    <p
                      dir="auto"
                      className="mt-2 break-all text-sm font-semibold text-slate-500"
                    >
                      {t.reference}: {application.reference}
                    </p>
                  </div>

                  <StatusBadge
                    status={application.status}
                    t={t}
                  />
                </div>

                <div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3">
                  <Field
                    label={t.country}
                    icon={Globe2}
                    locale={locale}
                    value={`${FLAGS[application.countryCode]} ${
                      COUNTRY_NAMES[
                        application.countryCode
                      ][locale]
                    }`}
                  />

                  <Field
                    label={t.submitted}
                    icon={CalendarDays}
                    locale={locale}
                    value={formatDate(
                      application.createdAt,
                      locale
                    )}
                  />

                  <Field
                    label={t.updated}
                    icon={Clock3}
                    locale={locale}
                    value={formatDate(
                      application.updatedAt,
                      locale
                    )}
                  />
                </div>
              </div>
            </header>

            {/* ALERTS */}

            {alert && (
              <div
                role={
                  alert.kind === "error"
                    ? "alert"
                    : "status"
                }
                className={`flex items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed ${
                  alert.kind === "success"
                    ? "border-green-200 bg-lime-50 text-green-900"
                    : alert.kind === "warning"
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                {alert.kind === "success" ? (
                  <CheckCircle2
                    size={19}
                    className="shrink-0"
                  />
                ) : (
                  <AlertCircle
                    size={19}
                    className="shrink-0"
                  />
                )}

                <span>{alert.message}</span>
              </div>
            )}

            {/* PERSONAL INFORMATION */}

            <Section
              title={t.personal}
              icon={UserRound}
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field
                  label={t.firstName}
                  value={application.applicant.firstName}
                  icon={UserRound}
                  locale={locale}
                />

                <Field
                  label={t.lastName}
                  value={application.applicant.lastName}
                  icon={UserRound}
                  locale={locale}
                />

                <Field
                  label={t.dateOfBirth}
                  value={formatDate(
                    application.applicant.dateOfBirth,
                    locale,
                    true
                  )}
                  icon={CalendarDays}
                  locale={locale}
                />

                <Field
                  label={t.nationality}
                  value={application.applicant.nationality}
                  icon={Globe2}
                  locale={locale}
                />
              </div>
            </Section>

            {/* CONTACT AND ADDRESS */}

            <Section
              title={t.contact}
              icon={Home}
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <Mail size={15} />
                    {t.email}
                  </p>

                  <p
                    dir="auto"
                    className="mt-2 break-all text-sm font-bold text-slate-900"
                  >
                    {application.applicant.email}
                  </p>

                  <div className="mt-3">
                    <VerifyBadge
                      verified={
                        application.applicant.emailVerified
                      }
                      t={t}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <Phone size={15} />
                    {t.phone}
                  </p>

                  <p
                    dir="ltr"
                    className="mt-2 text-start text-sm font-bold text-slate-900"
                  >
                    {application.applicant.phoneE164}
                  </p>

                  <div className="mt-3">
                    <VerifyBadge
                      verified={
                        application.applicant.phoneVerified
                      }
                      t={t}
                    />
                  </div>
                </div>

                <Field
                  label={t.country}
                  value={`${FLAGS[application.applicant.countryCode]} ${
                    COUNTRY_NAMES[
                      application.applicant.countryCode
                    ][locale]
                  }`}
                  icon={Globe2}
                  locale={locale}
                />

                <Field
                  label={t.street}
                  value={
                    application.applicant.streetAddress
                  }
                  icon={Home}
                  locale={locale}
                />

                <Field
                  label={t.postal}
                  value={
                    application.applicant.postalCode
                  }
                  icon={MapPin}
                  locale={locale}
                />

                <Field
                  label={t.city}
                  value={application.applicant.city}
                  icon={MapPin}
                  locale={locale}
                />
              </div>
            </Section>

            {/* APPLICATION INFORMATION */}

            <Section
              title={t.request}
              icon={ClipboardCheck}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label={t.licenseClass}
                  value={application.licenseClass}
                  icon={BadgeCheck}
                  locale={locale}
                />

                <Field
                  label={t.requestType}
                  value={application.requestType}
                  icon={FileText}
                  locale={locale}
                />
              </div>

              {application.notes && (
                <div className="mt-3">
                  <Field
                    label={t.notes}
                    value={application.notes}
                    icon={FileText}
                    locale={locale}
                  />
                </div>
              )}

              {application.additionalFields.length > 0 && (
                <div className="mt-6">
                  <h3 className="mb-3 text-sm font-extrabold text-slate-900">
                    {t.additional}
                  </h3>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {application.additionalFields.map(
                      (field) => (
                        <Field
                          key={field.key}
                          label={field.label}
                          value={field.value}
                          locale={locale}
                        />
                      )
                    )}
                  </div>
                </div>
              )}
            </Section>

            {/* VERIFICATION */}

            <Section
              title={t.verification}
              icon={ShieldCheck}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                  <span className="text-sm font-bold text-slate-800">
                    {t.emailVerification}
                  </span>

                  <VerifyBadge
                    verified={
                      application.applicant.emailVerified
                    }
                    t={t}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                  <span className="text-sm font-bold text-slate-800">
                    {t.phoneVerification}
                  </span>

                  <VerifyBadge
                    verified={
                      application.applicant.phoneVerified
                    }
                    t={t}
                  />
                </div>
              </div>
            </Section>

            {/* DOCUMENTS */}

            <Section
              title={t.documents}
              icon={FolderOpen}
              subtitle={t.documentsHelp}
            >
              {application.documents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <FolderOpen
                    size={32}
                    className="mx-auto text-slate-400"
                  />

                  <p className="mt-3 text-sm text-slate-600">
                    {t.noDocuments}
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {application.documents.map((document) => {
                    const meta =
                      DOCUMENTS[document.type];

                    const Icon = meta.icon;

                    const documentUrl =
                      `${detailUrl}/documents/` +
                      encodeURIComponent(document.id);

                    return (
                      <article
                        key={document.id}
                        className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/50 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-green-800">
                            <Icon size={22} />
                          </span>

                          <div className="min-w-0 flex-1">
                            <h3 className="wrap-break-word text-sm font-extrabold text-slate-900">
                              {document.label ||
                                t[meta.label]}
                            </h3>

                            {document.fileName && (
                              <p
                                dir="auto"
                                className="mt-1 break-all text-xs text-slate-500"
                              >
                                {document.fileName}
                              </p>
                            )}

                            {document.uploadedAt && (
                              <p className="mt-1 text-xs text-slate-500">
                                {formatDate(
                                  document.uploadedAt,
                                  locale
                                )}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4">
                          <DocBadge
                            status={document.status}
                            t={t}
                          />
                        </div>

                        <a
                          href={documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          referrerPolicy="no-referrer"
                          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-lime-200 bg-white px-4 py-2.5 text-sm font-bold text-green-800 hover:bg-lime-50"
                        >
                          <FileText size={17} />
                          {t.openDocument}
                        </a>
                      </article>
                    );
                  })}
                </div>
              )}

              <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
                <LockKeyhole
                  size={15}
                  className="mt-0.5 shrink-0"
                />
                {t.openDocumentHelp}
              </p>
            </Section>

            {/* ADMIN DECISION */}

            <Section
              title={t.decision}
              icon={ClipboardCheck}
              subtitle={t.decisionHelp}
            >
              {readOnlyDecision ? (
                <div className="space-y-4">
                  <StatusBadge
                    status={application.status}
                    t={t}
                  />

                  <p className="text-sm text-slate-600">
                    {t.alreadyDecided}
                  </p>

                  {application.decision && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field
                        label={t.decidedAt}
                        value={formatDate(
                          application.decision.decidedAt,
                          locale
                        )}
                        icon={CalendarDays}
                        locale={locale}
                      />

                      {application.decision.reason && (
                        <Field
                          label={t.reasonRecorded}
                          value={
                            application.decision.reason
                          }
                          icon={FileText}
                          locale={locale}
                        />
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() =>
                        openDecision("APPROVED")
                      }
                      className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-green-800 px-5 py-3.5 text-sm font-extrabold text-white hover:bg-green-900"
                    >
                      <CheckCircle2 size={19} />
                      {t.approve}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        openDecision("REJECTED")
                      }
                      className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-5 py-3.5 text-sm font-extrabold text-red-800 hover:bg-red-100"
                    >
                      <XCircle size={19} />
                      {t.reject}
                    </button>
                  </div>

                  <p className="mt-4 text-xs leading-relaxed text-slate-500">
                    {t.noPermitIssued}
                  </p>
                </>
              )}
            </Section>

            {/* PRIVACY NOTE */}

            <div className="flex items-start gap-3 rounded-xl border border-lime-200 bg-lime-50 p-4 text-xs leading-relaxed text-green-950">
              <ShieldCheck
                size={21}
                className="shrink-0"
              />
              <p>{t.confidentiality}</p>
            </div>
          </>
        )}
      </div>

      {/* ================================================
         CONFIRMATION MODAL
         ================================================ */}

      {modal && application && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center overflow-y-auto bg-slate-950/65 p-4"
          role="presentation"
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="decision-modal-title"
            className="my-auto w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span
                  className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${
                    modal === "APPROVED"
                      ? "bg-lime-100 text-green-800"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {modal === "APPROVED" ? (
                    <CheckCircle2 size={23} />
                  ) : (
                    <XCircle size={23} />
                  )}
                </span>

                <div>
                  <h2
                    id="decision-modal-title"
                    className="text-lg font-black text-slate-950"
                  >
                    {modal === "APPROVED"
                      ? t.confirmApprove
                      : t.confirmReject}
                  </h2>

                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {modal === "APPROVED"
                      ? t.approveQuestion
                      : t.rejectQuestion}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={closeDecision}
                aria-label={t.cancel}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="wrap-break-word text-sm font-bold text-slate-950">
                {application.applicant.firstName}{" "}
                {application.applicant.lastName}
              </p>

              <p
                dir="auto"
                className="mt-1 break-all text-xs text-slate-500"
              >
                {application.reference}
              </p>
            </div>

            <form
              onSubmit={submitDecision}
              className="mt-5 space-y-4"
            >
              {modal === "REJECTED" && (
                <div>
                  <label
                    htmlFor="rejection-reason"
                    className="block text-sm font-extrabold text-slate-800"
                  >
                    {t.rejectReason}
                    <span className="ms-1 text-red-600">
                      *
                    </span>
                  </label>

                  <textarea
                    id="rejection-reason"
                    rows={5}
                    minLength={10}
                    maxLength={1000}
                    required
                    disabled={saving}
                    value={reason}
                    onChange={(event) => {
                      setReason(event.target.value);
                      setReasonError(false);
                    }}
                    aria-invalid={reasonError}
                    placeholder={t.rejectPlaceholder}
                    className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-900 outline-none focus:border-lime-500 focus:ring-2 focus:ring-lime-500/20"
                  />

                  <div className="mt-1 flex items-center justify-between gap-3">
                    <span className="text-xs text-red-700">
                      {reasonError
                        ? reason.trim().length > 1000
                          ? t.reasonTooLong
                          : t.reasonRequired
                        : ""}
                    </span>

                    <span className="text-xs text-slate-500">
                      {reason.length}/1000
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeDecision}
                  disabled={saving}
                  className="min-h-12 rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {t.cancel}
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold text-white disabled:opacity-60 ${
                    modal === "APPROVED"
                      ? "bg-green-800 hover:bg-green-900"
                      : "bg-red-700 hover:bg-red-800"
                  }`}
                >
                  {saving ? (
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />
                  ) : modal === "APPROVED" ? (
                    <Check size={18} />
                  ) : (
                    <XCircle size={18} />
                  )}

                  {saving ? t.saving : t.confirm}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
