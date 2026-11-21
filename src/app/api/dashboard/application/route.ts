
import { connection, NextRequest, NextResponse } from "next/server";

import { randomUUID } from "node:crypto";

import {
  requireCandidateSession,
  SessionAuthError,
} from "@/lib/auth/session";

import {
  ApplicationValidationError,
  normalizeApplicationLocale,
  normalizeApplicationCountry,
  getApplicationErrorMessage,
  getDocumentLabel,
  getAdmissionReviewMessage,
  getRequiredApplicationDocuments,
  getAllowedDocumentMimeTypes,
  formatApplicationPrice,
  isValidUuid,
  isApplicationDocumentType,
  isDocumentReadyForSubmission,
  COUNTRY_NAMES,
  POSTAL_CODE_RULES,
  MAX_DOCUMENT_SIZE_BYTES,
  type ApplicationLocale,
  type ApplicationCountry,
  type ApplicationFormInput,
  type ApplicationErrorCode,
  type ApplicationPricing,
  type LicenseCategory,
  type TrustedApplicationDocument,
  type AdmissionReviewIssue,
  type ValidationIssue,
} from "@/lib/applications/validation";

import {
  getCandidateApplicationPage,
  saveCandidateApplicationDraft,
} from "@/lib/applications/application";

/* ============================================================
   FAHRSCHULE TAYM

   APPLICATION — READ AND SAVE DRAFT API

   File:
   src/app/api/dashboard/application/route.ts

   Endpoints:
   GET   — Read authenticated application page
   POST  — Create or save draft
   PATCH — Update existing draft

   Countries:
   DE | AT | BE | IT | ES

   Languages:
   DE | AR | TR | ES

   Database:
   PostgreSQL

   Authentication:
   Existing taym_session

   Compatible:
   Desktop | Tablet | Mobile

   No additional layout.
   No additional navigation.
   No fictional candidate information.
   ============================================================ */

/* ============================================================
   1. NEXT.JS CONFIGURATION
   ============================================================ */




/* ============================================================
   2. API CONFIGURATION
   ============================================================ */

const MAX_BODY_BYTES = 16_384;

const DOCUMENT_API_PATH =
  "/api/dashboard/application/documents";

const APPLICATION_API_PATH =
  "/api/dashboard/application";

const SUBMISSION_API_PATH =
  "/api/dashboard/application/submit";

const APPLICATION_PAGE_PATH =
  "/dashboard/application";

const DASHBOARD_PATH =
  "/dashboard";

const LOGIN_PATH =
  "/login";

/* ============================================================
   3. ERROR TYPES
   ============================================================ */

type AdditionalErrorCode =
  | "APPLICATION_NOT_FOUND"
  | "APPLICATION_CONFLICT"
  | "PRICE_CHANGED"
  | "INVALID_JSON"
  | "FORBIDDEN_ORIGIN"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "REQUEST_TIMEOUT"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

type ApplicationApiErrorCode =
  | ApplicationErrorCode
  | AdditionalErrorCode;

type ApiErrorResponse = {
  success: false;

  error: {
    code: ApplicationApiErrorCode;

    message: string;

    issues?: ValidationIssue[];
  };

  timestamp: string;
};

/* ============================================================
   4. CANDIDATE INFORMATION

   Retrieved exclusively from
   authenticated PostgreSQL records.
   ============================================================ */

type CandidateRecord = {
  userId: string;

  firstName: string;

  lastName: string;

  fullName: string;

  email: string;

  phoneE164: string;

  countryCode: ApplicationCountry;

  emailVerified: boolean;

  phoneVerified: boolean;
};

/* ============================================================
   5. COUNTRY AND CATEGORY CONTRACT

   application.ts must retrieve these
   values from driving-licenses.ts.

   Images must reference the existing
   local assets of Fahrschule TAYM.

   No external image substitution.
   ============================================================ */

type LocalizedText = Record<
  ApplicationLocale,
  string
>;

type LicenseCategoryRecord = {
  category: LicenseCategory;

  enabled: boolean;

  pricingApproved: boolean;

  name: LocalizedText;

  description: LocalizedText;

  imagePath: string | null;

  minimumAge: number | null;

  currency: "EUR";

  trainingPriceCents: number;

  registrationFeeCents: number | null;

  pricingVersion: string;
};

type CountryConfigurationRecord = {
  countryCode: ApplicationCountry;

  currency: "EUR";

  registrationFeeCents: number | null;

  categories: LicenseCategoryRecord[];
};

/* ============================================================
   6. EXISTING DOCUMENT RECORD

   Private storage keys remain
   on the server.
   ============================================================ */

type ApplicationDocumentRecord =
  TrustedApplicationDocument & {
    createdAt: string;

    updatedAt: string;
  };

/* ============================================================
   7. APPLICATION RECORD

   A draft may be incomplete.

   A submitted application must use
   its original persisted price snapshot.
   ============================================================ */

type ApplicationRecord = {
  id: string;

  reference: string | null;

  status: string;

  countryCode: ApplicationCountry;

  category: LicenseCategory | null;

  residentialAddress: string | null;

  postalCode: string | null;

  city: string | null;

  confirmedInformation: boolean;

  acceptedDocumentProcessing: boolean;

  pricing: ApplicationPricing | null;

  admissionReviewRequired: boolean;

  admissionReviewIssues:
    AdmissionReviewIssue[];

  documents: ApplicationDocumentRecord[];

  createdAt: string;

  updatedAt: string;

  submittedAt: string | null;

  /*
   * Used for optimistic concurrency.
   * Prevents one device from silently
   * overwriting changes from another.
   */

  revision: number;
};

/* ============================================================
   8. APPLICATION SERVICE CONTRACT

   Implemented in:
   src/lib/applications/application.ts
   ============================================================ */

type ApplicationPageRecord = {
  candidate: CandidateRecord;

  country: CountryConfigurationRecord;

  application: ApplicationRecord | null;

  lastUpdatedAt: string;
};

type SaveDraftResult = {
  created: boolean;

  page: ApplicationPageRecord;
};

/* ============================================================
   9. API REQUEST TYPES
   ============================================================ */

type SaveDraftRequest = {
  applicationId: string | null;

  expectedRevision: number | null;

  locale: ApplicationLocale;

  form: ApplicationFormInput;
};

/* ============================================================
   10. SECURITY RESPONSE HEADERS
   ============================================================ */

const RESPONSE_HEADERS: Record<string, string> = {
  "Cache-Control":
    "private, no-store, no-cache, max-age=0, must-revalidate",

  Pragma: "no-cache",

  Expires: "0",

  Vary: "Cookie, Origin, Accept-Language",

  "X-Content-Type-Options": "nosniff",

  "X-Frame-Options": "DENY",

  "Cross-Origin-Resource-Policy":
    "same-origin",

  "Referrer-Policy":
    "no-referrer",

  "X-Robots-Tag":
    "noindex, nofollow, noarchive",
};

/* ============================================================
   11. MULTILINGUAL TRANSLATIONS
   ============================================================ */

type ApplicationTranslations = {
  draftSaved: string;

  draftCreated: string;

  draftStatus: string;

  notSubmitted: string;

  statuses: Record<string, string>;

  errors: Record<
    AdditionalErrorCode,
    string
  >;
};

const TRANSLATIONS: Record<
  ApplicationLocale,
  ApplicationTranslations
> = {
  /* German — default */

  de: {
    draftSaved:
      "Ihr Entwurf wurde gespeichert.",

    draftCreated:
      "Ihr Entwurf wurde erstellt.",

    draftStatus:
      "Entwurf",

    notSubmitted:
      "Ihr Antrag wurde noch nicht eingereicht.",

    statuses: {
      DRAFT: "Entwurf",
      SUBMITTED: "Eingereicht",
      UNDER_REVIEW: "In Bearbeitung",
      DOCUMENTS_REQUIRED: "Unterlagen erforderlich",
      APPROVED: "Angenommen",
      REJECTED: "Abgelehnt",
      CANCELLED: "Storniert",
    },

    errors: {
      APPLICATION_NOT_FOUND:
        "Der Antrag wurde nicht gefunden.",

      APPLICATION_CONFLICT:
        "Der Antrag wurde inzwischen geändert. Bitte laden Sie die aktuellen Daten neu.",

      PRICE_CHANGED:
        "Der Preis wurde geändert. Bitte überprüfen Sie den aktuellen Preis.",

      INVALID_JSON:
        "Die Anfrage konnte nicht verarbeitet werden.",

      FORBIDDEN_ORIGIN:
        "Diese Anfrage ist nicht erlaubt.",

      UNSUPPORTED_MEDIA_TYPE:
        "Das Anfrageformat wird nicht unterstützt.",

      PAYLOAD_TOO_LARGE:
        "Die eingegebenen Daten sind zu lang.",

      REQUEST_TIMEOUT:
        "Die Anfrage hat zu lange gedauert.",

      SERVICE_UNAVAILABLE:
        "Der Dienst ist vorübergehend nicht verfügbar.",

      INTERNAL_ERROR:
        "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
    },
  },

  /* Arabic — RTL */

  ar: {
    draftSaved:
      "تم حفظ مسودة طلبك.",

    draftCreated:
      "تم إنشاء مسودة طلبك.",

    draftStatus:
      "مسودة",

    notSubmitted:
      "لم يتم تقديم طلبك بعد.",

    statuses: {
      DRAFT: "مسودة",
      SUBMITTED: "تم تقديم الطلب",
      UNDER_REVIEW: "قيد المراجعة",
      DOCUMENTS_REQUIRED: "مستندات مطلوبة",
      APPROVED: "مقبول",
      REJECTED: "مرفوض",
      CANCELLED: "ملغى",
    },

    errors: {
      APPLICATION_NOT_FOUND:
        "لم يتم العثور على الطلب.",

      APPLICATION_CONFLICT:
        "تم تعديل الطلب في هذه الأثناء. يرجى تحديث البيانات.",

      PRICE_CHANGED:
        "تم تغيير السعر. يرجى مراجعة السعر الحالي.",

      INVALID_JSON:
        "تعذر معالجة الطلب.",

      FORBIDDEN_ORIGIN:
        "هذا الطلب غير مسموح به.",

      UNSUPPORTED_MEDIA_TYPE:
        "تنسيق الطلب غير مدعوم.",

      PAYLOAD_TOO_LARGE:
        "البيانات المدخلة طويلة جداً.",

      REQUEST_TIMEOUT:
        "استغرق الطلب وقتاً طويلاً.",

      SERVICE_UNAVAILABLE:
        "الخدمة غير متاحة مؤقتاً.",

      INTERNAL_ERROR:
        "حدث خطأ. يرجى المحاولة مرة أخرى.",
    },
  },

  /* Turkish */

  tr: {
    draftSaved:
      "Taslağınız kaydedildi.",

    draftCreated:
      "Taslağınız oluşturuldu.",

    draftStatus:
      "Taslak",

    notSubmitted:
      "Başvurunuz henüz gönderilmedi.",

    statuses: {
      DRAFT: "Taslak",
      SUBMITTED: "Gönderildi",
      UNDER_REVIEW: "İnceleniyor",
      DOCUMENTS_REQUIRED: "Belge gerekli",
      APPROVED: "Kabul edildi",
      REJECTED: "Reddedildi",
      CANCELLED: "İptal edildi",
    },

    errors: {
      APPLICATION_NOT_FOUND:
        "Başvuru bulunamadı.",

      APPLICATION_CONFLICT:
        "Başvuru değiştirildi. Lütfen güncel verileri yeniden yükleyin.",

      PRICE_CHANGED:
        "Fiyat değişti. Lütfen güncel fiyatı kontrol edin.",

      INVALID_JSON:
        "İstek işlenemedi.",

      FORBIDDEN_ORIGIN:
        "Bu isteğe izin verilmiyor.",

      UNSUPPORTED_MEDIA_TYPE:
        "İstek biçimi desteklenmiyor.",

      PAYLOAD_TOO_LARGE:
        "Girilen bilgiler çok uzun.",

      REQUEST_TIMEOUT:
        "İstek zaman aşımına uğradı.",

      SERVICE_UNAVAILABLE:
        "Hizmet geçici olarak kullanılamıyor.",

      INTERNAL_ERROR:
        "Bir hata oluştu. Lütfen tekrar deneyin.",
    },
  },

  /* Spanish */

  es: {
    draftSaved:
      "Su borrador se ha guardado.",

    draftCreated:
      "Su borrador se ha creado.",

    draftStatus:
      "Borrador",

    notSubmitted:
      "Su solicitud aún no se ha enviado.",

    statuses: {
      DRAFT: "Borrador",
      SUBMITTED: "Enviada",
      UNDER_REVIEW: "En revisión",
      DOCUMENTS_REQUIRED: "Documentos requeridos",
      APPROVED: "Aceptada",
      REJECTED: "Rechazada",
      CANCELLED: "Cancelada",
    },

    errors: {
      APPLICATION_NOT_FOUND:
        "No se ha encontrado la solicitud.",

      APPLICATION_CONFLICT:
        "La solicitud ha cambiado. Vuelva a cargar los datos actuales.",

      PRICE_CHANGED:
        "El precio ha cambiado. Revise el precio actual.",

      INVALID_JSON:
        "No se pudo procesar la solicitud.",

      FORBIDDEN_ORIGIN:
        "Esta solicitud no está permitida.",

      UNSUPPORTED_MEDIA_TYPE:
        "El formato de la solicitud no es compatible.",

      PAYLOAD_TOO_LARGE:
        "Los datos introducidos son demasiado largos.",

      REQUEST_TIMEOUT:
        "La solicitud ha tardado demasiado.",

      SERVICE_UNAVAILABLE:
        "El servicio no está disponible temporalmente.",

      INTERNAL_ERROR:
        "Ha ocurrido un error. Inténtelo de nuevo.",
    },
  },
};

/* ============================================================
   12. API ERROR CLASS
   ============================================================ */

class ApplicationRequestError extends Error {
  readonly code: ApplicationApiErrorCode;

  readonly status: number;

  constructor(
    code: ApplicationApiErrorCode,
    status = 400
  ) {
    super(code);

    this.name = "ApplicationRequestError";

    this.code = code;

    this.status = status;
  }
}

/* ============================================================
   13. LOCALIZED ERRORS
   ============================================================ */

function getErrorMessage(
  code: ApplicationApiErrorCode,

  locale: ApplicationLocale
): string {
  const dictionary =
    TRANSLATIONS[locale].errors;

  if (
    Object.prototype.hasOwnProperty.call(
      dictionary,
      code
    )
  ) {
    return dictionary[
      code as AdditionalErrorCode
    ];
  }

  return getApplicationErrorMessage(
    code as ApplicationErrorCode,
    locale
  );
}

/* ============================================================
   14. RESPONSE HELPERS
   ============================================================ */

function getResponseHeaders(
  locale: ApplicationLocale
): Record<string, string> {
  return {
    ...RESPONSE_HEADERS,

    "Content-Language": locale,
  };
}

function errorResponse(
  status: number,

  code: ApplicationApiErrorCode,

  locale: ApplicationLocale,

  issues?: ValidationIssue[]
): NextResponse<ApiErrorResponse> {
  return NextResponse.json<ApiErrorResponse>(
    {
      success: false,

      error: {
        code,

        message: getErrorMessage(
          code,
          locale
        ),

        ...(issues?.length
          ? { issues }
          : {}),
      },

      timestamp:
        new Date().toISOString(),
    },

    {
      status,

      headers:
        getResponseHeaders(locale),
    }
  );
}

/* ============================================================
   15. LANGUAGE DETECTION

   Same language mechanism as
   the existing login and recovery pages.
   ============================================================ */

function getRequestLocale(
  request: NextRequest
): ApplicationLocale {
  const queryLocale =
    request.nextUrl.searchParams.get(
      "locale"
    );

  const cookieLocale =
    request.cookies.get(
      "taym-locale"
    )?.value;

  const browserLocale =
    request.headers
      .get("accept-language")
      ?.split(",")[0]
      ?.split(";")[0];

  return normalizeApplicationLocale(
    queryLocale ??
      cookieLocale ??
      browserLocale
  );
}

/* ============================================================
   16. ALLOWED ORIGINS
   ============================================================ */

function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>();

  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL;

  if (configuredUrl) {
    try {
      const url =
        new URL(configuredUrl);

      if (
        process.env.NODE_ENV === "production" &&
        url.protocol !== "https:"
      ) {
        throw new Error(
          "Production HTTPS required."
        );
      }

      origins.add(url.origin);

    } catch {
      throw new ApplicationRequestError(
        "SERVICE_UNAVAILABLE",
        503
      );
    }

  } else if (
    process.env.NODE_ENV === "production"
  ) {
    throw new ApplicationRequestError(
      "SERVICE_UNAVAILABLE",
      503
    );
  }

  if (
    process.env.NODE_ENV !== "production"
  ) {
    origins.add(
      "http://localhost:3000"
    );

    origins.add(
      "http://127.0.0.1:3000"
    );
  }

  return origins;
}

/* ============================================================
   17. CROSS-SITE REQUEST PROTECTION

   GET may not contain an Origin header.

   POST and PATCH must originate
   from the authorized website.
   ============================================================ */

function assertAllowedOrigin(
  request: NextRequest,

  mutation: boolean
): void {
  const origin =
    request.headers.get("origin");

  const fetchSite =
    request.headers.get(
      "sec-fetch-site"
    );

  if (
    fetchSite === "cross-site" ||
    fetchSite === "same-site" ||
    origin === "null"
  ) {
    throw new ApplicationRequestError(
      "FORBIDDEN_ORIGIN",
      403
    );
  }

  if (!origin) {
    if (mutation) {
      throw new ApplicationRequestError(
        "FORBIDDEN_ORIGIN",
        403
      );
    }

    return;
  }

  let normalizedOrigin: string;

  try {
    normalizedOrigin =
      new URL(origin).origin;

  } catch {
    throw new ApplicationRequestError(
      "FORBIDDEN_ORIGIN",
      403
    );
  }

  if (
    normalizedOrigin !== origin ||

    !getAllowedOrigins().has(
      normalizedOrigin
    )
  ) {
    throw new ApplicationRequestError(
      "FORBIDDEN_ORIGIN",
      403
    );
  }
}

/* ============================================================
   18. AUTHENTICATED CANDIDATE

   No user ID or country supplied
   by the browser is trusted.
   ============================================================ */

async function authenticateCandidate(
  request: NextRequest
) {
  const session =
    await requireCandidateSession(
      request
    );

  if (
    !session ||

    !isValidUuid(session.userId) ||

    !isValidUuid(session.sessionId)
  ) {
    throw new ApplicationRequestError(
      "UNAUTHORIZED",
      401
    );
  }

  const countryCode =
    normalizeApplicationCountry(
      session.countryCode
    );

  if (!countryCode) {
    throw new ApplicationRequestError(
      "UNSUPPORTED_COUNTRY",
      403
    );
  }

  return {
    session,

    countryCode,
  };
}

/* ============================================================
   19. SECURE JSON REQUEST READING

   Actual size is limited even when
   Content-Length is not provided.
   ============================================================ */

async function readJsonBody(
  request: NextRequest
): Promise<unknown> {
  const contentType =
    request.headers
      .get("content-type")
      ?.split(";")[0]
      ?.trim()
      .toLowerCase();

  if (
    contentType !== "application/json"
  ) {
    throw new ApplicationRequestError(
      "UNSUPPORTED_MEDIA_TYPE",
      415
    );
  }

  const contentLength =
    request.headers.get(
      "content-length"
    );

  if (contentLength !== null) {
    if (
      !/^\d+$/.test(contentLength)
    ) {
      throw new ApplicationRequestError(
        "INVALID_INPUT"
      );
    }

    const length =
      Number(contentLength);

    if (
      !Number.isSafeInteger(length)
    ) {
      throw new ApplicationRequestError(
        "INVALID_INPUT"
      );
    }

    if (
      length > MAX_BODY_BYTES
    ) {
      throw new ApplicationRequestError(
        "PAYLOAD_TOO_LARGE",
        413
      );
    }
  }

  if (!request.body) {
    throw new ApplicationRequestError(
      "INVALID_JSON"
    );
  }

  const reader =
    request.body.getReader();

  const chunks: Uint8Array[] = [];

  let totalBytes = 0;

  let timedOut = false;

  let aborted =
    request.signal.aborted;

  function cancelRead() {
    void reader.cancel().catch(
      () => undefined
    );
  }

  function handleAbort() {
    aborted = true;

    cancelRead();
  }

  const timeout = setTimeout(() => {
    timedOut = true;

    cancelRead();
  }, 10_000);

  request.signal.addEventListener(
    "abort",

    handleAbort,

    { once: true }
  );

  try {
    if (aborted) {
      throw new ApplicationRequestError(
        "REQUEST_TIMEOUT",
        408
      );
    }

    while (true) {
      const { done, value } =
        await reader.read();

      if (timedOut || aborted) {
        throw new ApplicationRequestError(
          "REQUEST_TIMEOUT",
          408
        );
      }

      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      totalBytes +=
        value.byteLength;

      if (
        totalBytes > MAX_BODY_BYTES
      ) {
        throw new ApplicationRequestError(
          "PAYLOAD_TOO_LARGE",
          413
        );
      }

      chunks.push(value);
    }

  } catch (error) {
    cancelRead();

    if (timedOut || aborted) {
      throw new ApplicationRequestError(
        "REQUEST_TIMEOUT",
        408
      );
    }

    throw error;

  } finally {
    clearTimeout(timeout);

    request.signal.removeEventListener(
      "abort",

      handleAbort
    );

    reader.releaseLock();
  }

  try {
    const buffer =
      Buffer.concat(
        chunks.map(
          (chunk) =>
            Buffer.from(chunk)
        )
      );

    const text =
      new TextDecoder(
        "utf-8",

        { fatal: true }
      ).decode(buffer);

    return JSON.parse(text);

  } catch {
    throw new ApplicationRequestError(
      "INVALID_JSON"
    );
  }
}

/* ============================================================
   20. VALIDATE OPTIONAL APPLICATION ID

   GET:
   applicationId is optional.

   POST:
   applicationId may be null
   for initial draft creation.

   PATCH:
   applicationId is required.
   ============================================================ */

function normalizeApplicationId(
  value: unknown
): string | null {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  if (!isValidUuid(value)) {
    throw new ApplicationRequestError(
      "INVALID_INPUT"
    );
  }

  return value.toLowerCase();
}

/* ============================================================
   21. REVISION VALIDATION

   The revision number is not an
   authorization credential.

   It detects stale draft updates.
   ============================================================ */

function normalizeExpectedRevision(
  value: unknown
): number | null {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  if (
    typeof value !== "number" ||

    !Number.isSafeInteger(value) ||

    value < 0
  ) {
    throw new ApplicationRequestError(
      "INVALID_INPUT"
    );
  }

  return value;
}

/* ============================================================
   22. DRAFT REQUEST VALIDATION

   Expected JSON:

   {
     applicationId: null,
     expectedRevision: null,
     locale: "de",
     category: "B",
     residentialAddress: "...",
     postalCode: "...",
     city: "...",
     confirmedInformation: false,
     acceptedDocumentProcessing: false
   }

   No candidate identity.
   No browser-supplied prices.
   No arbitrary application status.
   ============================================================ */

function validateDraftRequest(
  body: unknown,

  locale: ApplicationLocale,

  requireExistingApplication: boolean
): SaveDraftRequest {
  if (
    !body ||

    typeof body !== "object" ||

    Array.isArray(body)
  ) {
    throw new ApplicationRequestError(
      "INVALID_INPUT"
    );
  }

  const data =
    body as Record<string, unknown>;

  const allowedFields =
    new Set([
      "applicationId",
      "expectedRevision",
      "locale",
      "category",
      "residentialAddress",
      "postalCode",
      "city",
      "confirmedInformation",
      "acceptedDocumentProcessing",
    ]);

  if (
    Object.keys(data).some(
      (key) =>
        !allowedFields.has(key)
    )
  ) {
    throw new ApplicationRequestError(
      "INVALID_INPUT"
    );
  }

  const applicationId =
    normalizeApplicationId(
      data.applicationId
    );

  const expectedRevision =
    normalizeExpectedRevision(
      data.expectedRevision
    );

  if (
    requireExistingApplication &&
    !applicationId
  ) {
    throw new ApplicationRequestError(
      "INVALID_INPUT"
    );
  }

  /*
   * Existing drafts require a revision.
   */

  if (
    applicationId !== null &&
    expectedRevision === null
  ) {
    throw new ApplicationRequestError(
      "INVALID_INPUT"
    );
  }

  if (
    applicationId === null &&
    expectedRevision !== null
  ) {
    throw new ApplicationRequestError(
      "INVALID_INPUT"
    );
  }

  /*
   * Only include fields actually
   * provided in the current request.
   *
   * application.ts must merge them
   * with the stored draft before
   * running validateApplicationDraft().
   */

  const form: ApplicationFormInput = {};

  const editableFields = [
    "category",
    "residentialAddress",
    "postalCode",
    "city",
    "confirmedInformation",
    "acceptedDocumentProcessing",
  ] as const;

  for (const field of editableFields) {
    if (
      Object.prototype.hasOwnProperty.call(
        data,

        field
      )
    ) {
      form[field] = data[field];
    }
  }

  return {
    applicationId,

    expectedRevision,

    locale,

    form,
  };
}

/* ============================================================
   23. FORMAT SERVER-SIDE PRICING

   Amounts remain in integer cents.

   Formatting is adapted to the
   selected interface language.
   ============================================================ */

function toPublicPricing(
  pricing: ApplicationPricing | null,

  locale: ApplicationLocale
) {
  if (!pricing) {
    return null;
  }

  return {
    currency: pricing.currency,

    trainingPriceCents:
      pricing.trainingPriceCents,

    registrationFeeCents:
      pricing.registrationFeeCents,

    totalPriceCents:
      pricing.totalPriceCents,

    pricingVersion:
      pricing.pricingVersion,

    formatted: {
      trainingPrice:
        formatApplicationPrice(
          pricing.trainingPriceCents,
          locale
        ),

      registrationFee:
        formatApplicationPrice(
          pricing.registrationFeeCents,
          locale
        ),

      totalPrice:
        formatApplicationPrice(
          pricing.totalPriceCents,
          locale
        ),
    },
  };
}

/* ============================================================
   24. EXISTING LOCAL IMAGE PATH

   Allows local project assets only.

   No remote image URL or data URL.
   ============================================================ */

function getSafeLocalImagePath(
  value: string | null
): string | null {
  if (
    typeof value !== "string" ||

    !value.startsWith("/") ||

    value.startsWith("//") ||

    value.includes("\\") ||

    value.includes("..") ||

    !/^\/[a-zA-Z0-9/_\-.%]+$/.test(value) ||

    !/\.(png|jpg|jpeg|webp|avif)$/i.test(value)
  ) {
    return null;
  }

  /*
   * Reject encoded traversal,
   * separators and control characters.
   */

  try {
    const decoded =
      decodeURIComponent(value);

    if (
      decoded.includes("..") ||

      decoded.includes("\\") ||

      decoded.startsWith("//") ||

      /[\u0000-\u001f\u007f]/.test(decoded) ||

      decoded.includes("?") ||

      decoded.includes("#")
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return value;
}

/* ============================================================
   25. SERIALIZE COUNTRY CATEGORY

   Commercial prices come from
   the trusted country configuration.

   Unapproved prices are indicative.
   They cannot authorize submission.
   ============================================================ */

function toPublicLicenseCategory(
  item: LicenseCategoryRecord,

  locale: ApplicationLocale
) {
  const trainingPriceValid =
    Number.isSafeInteger(
      item.trainingPriceCents
    ) &&

    item.trainingPriceCents > 0;

  const registrationFeeValid =
    item.registrationFeeCents !== null &&

    Number.isSafeInteger(
      item.registrationFeeCents
    ) &&

    item.registrationFeeCents >= 0;

  const trainingPriceCents =
    trainingPriceValid
      ? item.trainingPriceCents
      : null;

  const registrationFeeCents =
    registrationFeeValid
      ? item.registrationFeeCents
      : null;

  const calculatedTotal =
    trainingPriceCents !== null &&
    registrationFeeCents !== null

      ? trainingPriceCents +
        registrationFeeCents

      : null;

  const totalPriceCents =
    calculatedTotal !== null &&

    Number.isSafeInteger(
      calculatedTotal
    )

      ? calculatedTotal

      : null;

  const canSubmit =
    item.enabled === true &&

    item.pricingApproved === true &&

    totalPriceCents !== null;

  return {
    category: item.category,

    name:
      item.name[locale] ??
      item.name.de,

    description:
      item.description[locale] ??
      item.description.de,

    imagePath:
      getSafeLocalImagePath(
        item.imagePath
      ),

    minimumAge:
      item.minimumAge,

    enabled:
      item.enabled,

    pricingApproved:
      item.pricingApproved,

    canSubmit,

    currency:
      item.currency,

    trainingPriceCents,

    registrationFeeCents,

    totalPriceCents,

    pricingVersion:
      item.pricingVersion,

    formatted: {
      trainingPrice:
        trainingPriceCents !== null

          ? formatApplicationPrice(
              trainingPriceCents,
              locale
            )

          : null,

      registrationFee:
        registrationFeeCents !== null

          ? formatApplicationPrice(
              registrationFeeCents,
              locale
            )

          : null,

      totalPrice:
        totalPriceCents !== null

          ? formatApplicationPrice(
              totalPriceCents,
              locale
            )

          : null,
    },
  };
}

/* ============================================================
   26. DOCUMENT ACCESS STATUS
   ============================================================ */

function isDocumentAccessible(
  document: ApplicationDocumentRecord
): boolean {
  return (
    document.uploadStatus ===
      "UPLOADED" &&

    document.securityStatus !==
      "REJECTED"
  );
}

/* ============================================================
   27. SERIALIZE PROTECTED DOCUMENT

   No storage key or private bucket
   URL is returned to the browser.
   ============================================================ */

function toPublicDocument(
  document: ApplicationDocumentRecord,

  locale: ApplicationLocale
) {
  const accessible =
    isDocumentAccessible(
      document
    );

  const imagePreview =
    accessible &&

    (
      document.mimeType ===
        "image/jpeg" ||

      document.mimeType ===
        "image/png"
    );

  const documentPath =
    `${DOCUMENT_API_PATH}/${document.id}`;

  return {
    id:
      document.id,

    applicationId:
      document.applicationId,

    type:
      document.type,

    label:
      getDocumentLabel(
        document.type,

        locale
      ),

    fileName:
      document.fileName,

    mimeType:
      document.mimeType,

    sizeBytes:
      document.sizeBytes,

    uploadStatus:
      document.uploadStatus,

    securityStatus:
      document.securityStatus,

    reviewStatus:
      document.reviewStatus,

    ready:
      isDocumentReadyForSubmission(
        document
      ),

    previewUrl:
      imagePreview

        ? `${documentPath}?locale=${locale}`

        : null,

    downloadUrl:
      accessible

        ? `${documentPath}?download=1&locale=${locale}`

        : null,

    createdAt:
      document.createdAt,

    updatedAt:
      document.updatedAt,
  };
}

/* ============================================================
   28. REQUIRED DOCUMENT CONFIGURATION

   Existing five mandatory documents.

   Uploaded, missing, pending and
   rejected documents are distinguished.
   ============================================================ */

function toRequiredDocuments(
  records: readonly ApplicationDocumentRecord[],

  locale: ApplicationLocale
) {
  return getRequiredApplicationDocuments()
    .map((type) => {
      const matching =
        records.filter(
          (document) =>

            document.type === type &&

            document.uploadStatus !==
              "DELETED"
        );

      const currentDocument =
        matching.length === 1
          ? matching[0]
          : null;

      const document =
        currentDocument

          ? toPublicDocument(
              currentDocument,
              locale
            )

          : null;

      return {
        type,

        label:
          getDocumentLabel(
            type,
            locale
          ),

        required: true,

        allowedMimeTypes:
          getAllowedDocumentMimeTypes(
            type
          ),

        maxSizeBytes:
          MAX_DOCUMENT_SIZE_BYTES,

        accept:
          getAllowedDocumentMimeTypes(type)
            .join(","),

        uploaded:
          currentDocument?.uploadStatus ===
            "UPLOADED",

        ready:
          document?.ready === true,

        document,
      };
    });
}

/* ============================================================
   29. LOCALIZED APPLICATION STATUS
   ============================================================ */

function getStatusLabel(
  status: string,

  locale: ApplicationLocale
): string {
  const statuses =
    TRANSLATIONS[locale].statuses;

  if (
    Object.prototype.hasOwnProperty.call(
      statuses,

      status
    )
  ) {
    return statuses[status];
  }

  return status;
}

/* ============================================================
   30. VERIFY SERVICE RECORD OWNERSHIP

   application.ts must perform the
   actual authenticated database queries.

   These checks add a second layer
   of protection before serialization.
   ============================================================ */

function assertPageOwnership(
  page: ApplicationPageRecord,

  userId: string,

  countryCode: ApplicationCountry,

  requestedApplicationId?: string | null
): void {
  if (
    !page ||

    !page.candidate ||

    page.candidate.userId !== userId ||

    page.candidate.countryCode !==
      countryCode ||

    page.country.countryCode !==
      countryCode
  ) {
    throw new ApplicationRequestError(
      "INTERNAL_ERROR",
      500
    );
  }

  if (
    requestedApplicationId &&

    page.application?.id !==
      requestedApplicationId
  ) {
    throw new ApplicationRequestError(
      "APPLICATION_NOT_FOUND",
      404
    );
  }

  const application =
    page.application;

  if (!application) {
    return;
  }

  if (
    !isValidUuid(
      application.id
    ) ||

    application.countryCode !==
      countryCode ||

    !Number.isSafeInteger(
      application.revision
    ) ||

    application.revision < 0
  ) {
    throw new ApplicationRequestError(
      "INTERNAL_ERROR",
      500
    );
  }

  for (
    const document
    of application.documents
  ) {
    if (
      !isValidUuid(document.id) ||

      document.userId !== userId ||

      document.applicationId !==
        application.id ||

      !isApplicationDocumentType(
        document.type
      )
    ) {
      throw new ApplicationRequestError(
        "INTERNAL_ERROR",
        500
      );
    }
  }
}

/* ============================================================
   31. BUILD PAGE RESPONSE

   Contains everything required
   by the responsive application page.

   No new request is needed for
   each candidate information field.
   ============================================================ */

function toPublicApplicationPage(
  page: ApplicationPageRecord,

  locale: ApplicationLocale
) {
  const candidate =
    page.candidate;

  const country =
    page.country;

  const application =
    page.application;

  const activeDocuments =
    (
      application?.documents ?? []
    ).filter(
      (document) =>

        document.uploadStatus !==
          "DELETED"
    );

  const requiredDocuments =
    toRequiredDocuments(
      activeDocuments,
      locale
    );

  const requiredDocumentCount =
    requiredDocuments.length;

  const readyDocumentCount =
    requiredDocuments.filter(
      (document) =>
        document.ready
    ).length;

  const uploadedDocumentCount =
    requiredDocuments.filter(
      (document) =>
        document.uploaded
    ).length;

  const categories =
    country.categories

      .filter(
        (category) =>
          category.enabled
      )

      .map(
        (category) =>
          toPublicLicenseCategory(
            category,
            locale
          )
      );

  const selectedCategory =
    categories.find(
      (category) =>

        category.category ===
          application?.category
    ) ?? null;

  const isEditable =
    application === null ||

    application.status === "DRAFT";

  /*
   * This is an interface readiness
   * indicator only.
   *
   * The submit API must perform
   * complete validation again.
   */

  const formComplete =
    Boolean(
      application?.category &&

      application.residentialAddress &&

      application.postalCode &&

      application.city
    );

  const confirmationsComplete =
    application?.confirmedInformation ===
      true &&

    application.acceptedDocumentProcessing ===
      true;

  const documentsComplete =
    readyDocumentCount ===
      requiredDocumentCount;

  const pricingAvailable =
    selectedCategory?.canSubmit ===
      true;

  const canAttemptSubmission =
    isEditable &&

    application !== null &&

    formComplete &&

    confirmationsComplete &&

    documentsComplete &&

    pricingAvailable;

  const completedSections =
    Number(
      candidate.emailVerified
    ) +

    Number(
      formComplete &&
      pricingAvailable
    ) +

    Number(documentsComplete) +

    Number(confirmationsComplete);

  return {
    /* --------------------------------------------------------
       LANGUAGE
       -------------------------------------------------------- */

    locale,

    direction:
      locale === "ar"
        ? "rtl"
        : "ltr",

    /* --------------------------------------------------------
       PERSONAL INFORMATION

       Read-only candidate information.
       -------------------------------------------------------- */

    candidate: {
      id:
        candidate.userId,

      firstName:
        candidate.firstName,

      lastName:
        candidate.lastName,

      fullName:
        candidate.fullName,

      email:
        candidate.email,

      phoneE164:
        candidate.phoneE164,

      countryCode:
        candidate.countryCode,

      countryName:
        COUNTRY_NAMES[
          candidate.countryCode
        ][locale],

      emailVerified:
        candidate.emailVerified,

      phoneVerified:
        candidate.phoneVerified,

      personalInformationReadOnly:
        true,
    },

    /* --------------------------------------------------------
       COUNTRY CONFIGURATION
       -------------------------------------------------------- */

    country: {
      code:
        country.countryCode,

      name:
        COUNTRY_NAMES[
          country.countryCode
        ][locale],

      currency:
        country.currency,

      registrationFeeCents:
        country.registrationFeeCents,

      formattedRegistrationFee:
        country.registrationFeeCents !== null

          ? formatApplicationPrice(
              country.registrationFeeCents,

              locale
            )

          : null,

      postalCode: {
        length:
          POSTAL_CODE_RULES[
            country.countryCode
          ].length,

        example:
          POSTAL_CODE_RULES[
            country.countryCode
          ].example,
      },

      categories,
    },

    /* --------------------------------------------------------
       ORIGINAL POSTGRESQL APPLICATION
       -------------------------------------------------------- */

    application:
      application

        ? {
            id:
              application.id,

            reference:
              application.reference,

            status:
              application.status,

            statusLabel:
              getStatusLabel(
                application.status,
                locale
              ),

            countryCode:
              application.countryCode,

            category:
              application.category,

            residentialAddress:
              application.residentialAddress,

            postalCode:
              application.postalCode,

            city:
              application.city,

            confirmedInformation:
              application.confirmedInformation,

            acceptedDocumentProcessing:
              application.acceptedDocumentProcessing,

            pricing:
              toPublicPricing(
                application.pricing,
                locale
              ),

            admissionReviewRequired:
              application.admissionReviewRequired,

            admissionReviewIssues:
              application.admissionReviewIssues
                .map(
                  (issue) => ({
                    code:
                      issue.code,

                    documentType:
                      issue.documentType,

                    message:
                      getAdmissionReviewMessage(
                        issue.code,
                        locale
                      ),
                  })
                ),

            createdAt:
              application.createdAt,

            updatedAt:
              application.updatedAt,

            submittedAt:
              application.submittedAt,

            revision:
              application.revision,
          }

        : null,

    /* --------------------------------------------------------
       CURRENT FORM

       No invented address or other
       personal details for new drafts.
       -------------------------------------------------------- */

    form: {
      category:
        application?.category ?? "",

      residentialAddress:
        application?.residentialAddress ?? "",

      postalCode:
        application?.postalCode ?? "",

      city:
        application?.city ?? "",

      confirmedInformation:
        application?.confirmedInformation ??
          false,

      acceptedDocumentProcessing:
        application?.acceptedDocumentProcessing ??
          false,
    },

    /* --------------------------------------------------------
       SELECTED CATEGORY AND LIVE PRICE

       For drafts, the live catalog
       remains the price source.

       For submitted applications,
       the persisted pricing snapshot
       remains the historical price.
       -------------------------------------------------------- */

    selectedCategory,

    pricing:
      application &&
      application.status !== "DRAFT"

        ? toPublicPricing(
            application.pricing,

            locale
          )

        : selectedCategory

          ? {
              currency:
                selectedCategory.currency,

              trainingPriceCents:
                selectedCategory.trainingPriceCents,

              registrationFeeCents:
                selectedCategory.registrationFeeCents,

              totalPriceCents:
                selectedCategory.totalPriceCents,

              pricingVersion:
                selectedCategory.pricingVersion,

              formatted:
                selectedCategory.formatted,
            }

          : null,

    /* --------------------------------------------------------
       DOCUMENTS
       -------------------------------------------------------- */

    documents:
      activeDocuments.map(
        (document) =>
          toPublicDocument(
            document,
            locale
          )
      ),

    requiredDocuments,

    /* --------------------------------------------------------
       PROGRESS
       -------------------------------------------------------- */

    progress: {
      personalInformationComplete:
        candidate.emailVerified,

      formComplete,

      documentsComplete,

      confirmationsComplete,

      pricingAvailable,

      requiredDocumentCount,

      uploadedDocumentCount,

      readyDocumentCount,

      completedSections,

      totalSections: 4,

      percentage:
        Math.round(
          (completedSections / 4) *
            100
        ),
    },

    /* --------------------------------------------------------
       AVAILABLE ACTIONS
       -------------------------------------------------------- */

    permissions: {
      canEdit:
        isEditable,

      canSaveDraft:
        isEditable,

      canUploadDocuments:
        isEditable &&
        application !== null,

      canDeleteDocuments:
        isEditable &&
        application !== null,

      canAttemptSubmission,
    },

    /* --------------------------------------------------------
       EXISTING ROUTES
       -------------------------------------------------------- */

    links: {
      page:
        APPLICATION_PAGE_PATH,

      dashboard:
        DASHBOARD_PATH,

      login:
        LOGIN_PATH,

      application:
        APPLICATION_API_PATH,

      documents:
        DOCUMENT_API_PATH,

      submit:
        SUBMISSION_API_PATH,
    },

    lastUpdatedAt:
      page.lastUpdatedAt,
  };
}

/* ============================================================
   32. TECHNICAL ERROR IDENTIFICATION
   ============================================================ */

function getTechnicalErrorCode(
  error: unknown
): string | null {
  if (
    !error ||

    typeof error !== "object" ||

    !("code" in error)
  ) {
    return null;
  }

  const code =
    (error as {
      code?: unknown;
    }).code;

  return typeof code === "string"
    ? code
    : null;
}

/* ============================================================
   33. DATABASE AVAILABILITY ERRORS
   ============================================================ */

const DATABASE_ERRORS = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "08007",
  "57P01",
  "57P02",
  "57P03",
  "53300",
  "55P03",
  "57014",
  "40001",
  "40P01",
]);

/* ============================================================
   34. CENTRALIZED ERROR HANDLING

   No personal candidate information
   or internal SQL errors are exposed.
   ============================================================ */

function handleApplicationError(
  error: unknown,

  requestId: string,

  locale: ApplicationLocale
): NextResponse<ApiErrorResponse> {
  if (
    error instanceof SessionAuthError
  ) {
    return errorResponse(
      error.status === 403
        ? 403
        : 401,

      error.status === 403
        ? "ACCOUNT_UNAVAILABLE"
        : "UNAUTHORIZED",

      locale
    );
  }

  if (
    error instanceof
      ApplicationRequestError
  ) {
    return errorResponse(
      error.status,

      error.code,

      locale
    );
  }

  if (
    error instanceof
      ApplicationValidationError
  ) {
    return errorResponse(
      error.status,

      error.code,

      locale,

      error.issues
    );
  }

  const code =
    getTechnicalErrorCode(error);

  switch (code) {
    case "APPLICATION_NOT_FOUND":
    case "APPLICATION_ACCESS_DENIED":

      return errorResponse(
        404,

        "APPLICATION_NOT_FOUND",

        locale
      );

    case "UNAUTHORIZED":
    case "INVALID_SESSION":

      return errorResponse(
        401,

        "UNAUTHORIZED",

        locale
      );

    case "ACCOUNT_UNAVAILABLE":

      return errorResponse(
        403,

        "ACCOUNT_UNAVAILABLE",

        locale
      );

    case "ACCOUNT_NOT_VERIFIED":

      return errorResponse(
        403,

        "ACCOUNT_NOT_VERIFIED",

        locale
      );

    case "UNSUPPORTED_COUNTRY":

      return errorResponse(
        403,

        "UNSUPPORTED_COUNTRY",

        locale
      );

    case "INVALID_APPLICATION_STATE":

      return errorResponse(
        409,

        "INVALID_APPLICATION_STATE",

        locale
      );

    case "APPLICATION_CONFLICT":
    case "REVISION_CONFLICT":

      return errorResponse(
        409,

        "APPLICATION_CONFLICT",

        locale
      );

    case "PRICE_CHANGED":

      return errorResponse(
        409,

        "PRICE_CHANGED",

        locale
      );

    case "PRICING_UNAVAILABLE":

      return errorResponse(
        409,

        "PRICING_UNAVAILABLE",

        locale
      );

    case "DATABASE_UNAVAILABLE":
    case "SERVICE_UNAVAILABLE":

      return errorResponse(
        503,

        "SERVICE_UNAVAILABLE",

        locale
      );
  }

  if (
    code !== null &&
    DATABASE_ERRORS.has(code)
  ) {
    console.error(
      "[TAYM][APPLICATION][DATABASE]",

      {
        requestId,
        code,
      }
    );

    return errorResponse(
      503,

      "SERVICE_UNAVAILABLE",

      locale
    );
  }

  console.error(
    "[TAYM][APPLICATION][ERROR]",

    {
      requestId,

      type:
        error instanceof Error
          ? error.name
          : "UnknownError",
    }
  );

  return errorResponse(
    500,

    "INTERNAL_ERROR",

    locale
  );
}

/* ============================================================
   35. GET — LOAD APPLICATION PAGE

   Endpoint:
   GET /api/dashboard/application

   Optional:
   ?locale=de
   ?applicationId=UUID

   Execution:

   1. Validate request origin.
   2. Authenticate candidate.
   3. Retrieve registered country.
   4. Load actual personal information.
   5. Load country-specific categories.
   6. Load existing draft or requested dossier.
   7. Load protected document metadata.
   8. Calculate page readiness.
   9. Return localized response.

   GET must never create a new draft.
   ============================================================ */

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  await connection();
  const requestId =
    randomUUID();

  const locale =
    getRequestLocale(request);

  try {
    assertAllowedOrigin(
      request,

      false
    );

    const {
      session,

      countryCode,
    } =
      await authenticateCandidate(
        request
      );

    const applicationIds =
      request.nextUrl.searchParams.getAll(
        "applicationId"
      );

    if (applicationIds.length > 1) {
      throw new ApplicationRequestError(
        "INVALID_INPUT"
      );
    }

    const applicationId =
      normalizeApplicationId(
        applicationIds[0] ?? null
      );

    /*
     * application.ts must query using
     * both session identity and
     * authenticated candidate identity.
     *
     * Without an explicit ID, load the
     * candidate's current draft, if any.
     */

    const page: ApplicationPageRecord =
      await getCandidateApplicationPage({
        authenticatedUserId:
          session.userId,

        authenticatedSessionId:
          session.sessionId,

        applicationId,

        locale,
      });

    assertPageOwnership(
      page,

      session.userId,

      countryCode,

      applicationId
    );

    return NextResponse.json(
      {
        success: true,

        data:
          toPublicApplicationPage(
            page,

            locale
          ),

        timestamp:
          new Date().toISOString(),
      },

      {
        status: 200,

        headers:
          getResponseHeaders(
            locale
          ),
      }
    );

  } catch (error: unknown) {
    return handleApplicationError(
      error,

      requestId,

      locale
    );
  }
}

/* ============================================================
   36. SHARED DRAFT SAVING HANDLER

   Used by POST and PATCH.

   application.ts must:

   - Recheck current session.
   - Lock the candidate account.
   - Verify application ownership.
   - Verify DRAFT status.
   - Prevent duplicate draft creation.
   - Check expected revision.
   - Merge editable fields.
   - Call validateApplicationDraft().
   - Calculate trusted pricing.
   - Invalidate previous confirmations
     if relevant dossier data changes.
   - Save actual PostgreSQL data.
   - Increment revision on changes.
   - Return the current application page.

   No submission.
   No payment.
   No email dispatch.
   ============================================================ */

async function handleSaveDraft(
  request: NextRequest,

  requireExistingApplication: boolean
): Promise<NextResponse> {
  const requestId =
    randomUUID();

  let locale =
    getRequestLocale(request);

  try {
    /* Origin protection */

    assertAllowedOrigin(
      request,

      true
    );

    /* Authentication */

    const {
      session,

      countryCode,
    } =
      await authenticateCandidate(
        request
      );

    /* Read actual JSON */

    const body =
      await readJsonBody(
        request
      );

    /* Current language */

    if (
      body &&

      typeof body === "object" &&

      !Array.isArray(body) &&

      "locale" in body
    ) {
      locale =
        normalizeApplicationLocale(
          body.locale
        );
    }

    /* Validate editable fields */

    const input =
      validateDraftRequest(
        body,

        locale,

        requireExistingApplication
      );

    /*
     * Create or update a real draft.
     *
     * This operation must be
     * transactional in application.ts.
     */

    const result: SaveDraftResult =
      await saveCandidateApplicationDraft({
        authenticatedUserId:
          session.userId,

        authenticatedSessionId:
          session.sessionId,

        applicationId:
          input.applicationId,

        expectedRevision:
          input.expectedRevision,

        form:
          input.form,

        locale,
      });

    /*
     * Validate the committed record
     * before sending it to the browser.
     */

    if (
      !result ||

      typeof result.created !==
        "boolean" ||

      !result.page?.application ||

      result.page.application.status !==
        "DRAFT" ||

      (
        input.applicationId !== null &&
        result.created
      )
    ) {
      throw new ApplicationRequestError(
        "INTERNAL_ERROR",

        500
      );
    }

    assertPageOwnership(
      result.page,

      session.userId,

      countryCode,

      input.applicationId
    );

    const translations =
      TRANSLATIONS[locale];

    return NextResponse.json(
      {
        success: true,

        data: {
          ...toPublicApplicationPage(
            result.page,

            locale
          ),

          saved: true,

          created:
            result.created,

          message:
            result.created

              ? translations.draftCreated

              : translations.draftSaved,
        },

        timestamp:
          new Date().toISOString(),
      },

      {
        status:
          result.created
            ? 201
            : 200,

        headers:
          getResponseHeaders(
            locale
          ),
      }
    );

  } catch (error: unknown) {
    return handleApplicationError(
      error,

      requestId,

      locale
    );
  }
}

/* ============================================================
   37. POST — CREATE OR SAVE DRAFT

   Creates a draft when necessary.

   If a draft already exists and no ID
   is supplied, return the existing draft
   without overwriting its saved fields.
   ============================================================ */

export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  return handleSaveDraft(
    request,

    false
  );
}

/* ============================================================
   38. PATCH — UPDATE EXISTING DRAFT

   Requires:
   - applicationId
   - expectedRevision

   Only provided editable fields
   are updated.

   Prevents stale changes from another
   browser, desktop or mobile device.
   ============================================================ */

export async function PATCH(
  request: NextRequest
): Promise<NextResponse> {
  return handleSaveDraft(
    request,

    true
  );
}
