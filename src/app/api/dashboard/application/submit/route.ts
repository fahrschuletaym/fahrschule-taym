
import { NextRequest, NextResponse } from "next/server";

import { randomUUID } from "node:crypto";

import {
  requireCandidateSession,
  SessionAuthError,
} from "@/lib/auth/session";

import {
  ApplicationValidationError,
  normalizeApplicationLocale,
  getApplicationErrorMessage,
  isValidUuid,
  type ApplicationLocale,
  type ApplicationFormInput,
  type ApplicationErrorCode,
  type ValidationIssue,
} from "@/lib/applications/validation";

import {
  submitLicenseApplication,
} from "@/lib/applications/application";

import {
  dispatchApplicationSubmissionEmails,
} from "@/lib/applications/email";

/* ============================================================
   FAHRSCHULE TAYM

   APPLICATION — FINAL SUBMISSION API

   File:
   src/app/api/dashboard/application/submit/route.ts

   Endpoint:
   POST /api/dashboard/application/submit

   Countries:
   DE — Germany
   AT — Austria
   BE — Belgium
   IT — Italy
   ES — Spain

   Languages:
   DE — German
   AR — Arabic
   TR — Turkish
   ES — Spanish

   Responsibilities:
   - Authenticate candidate
   - Validate request origin
   - Validate submission payload
   - Validate application ownership
   - Validate country and license category
   - Validate server-side pricing
   - Validate residential address
   - Validate required documents
   - Validate candidate confirmations
   - Submit application in PostgreSQL
   - Prevent duplicate submissions
   - Trigger candidate confirmation email
   - Trigger administrator notification email

   No new layout.
   No additional navigation.
   No fictional data.
   ============================================================ */

/* ============================================================
   1. NEXT.JS CONFIGURATION
   ============================================================ */




/* ============================================================
   2. API CONFIGURATION
   ============================================================ */

const MAX_BODY_BYTES = 16_384;

const APPLICATION_PATH =
  "/dashboard/application";

const DASHBOARD_PATH =
  "/dashboard";

/* ============================================================
   3. API ERROR TYPES
   ============================================================ */

type SubmitErrorCode =
  | ApplicationErrorCode
  | "INVALID_JSON"
  | "FORBIDDEN_ORIGIN"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "APPLICATION_NOT_FOUND"
  | "PRICE_CHANGED"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

type ApiErrorResponse = {
  success: false;

  error: {
    code: SubmitErrorCode;

    message: string;

    issues?: ValidationIssue[];
  };

  timestamp: string;
};

/* ============================================================
   4. SUBMISSION REQUEST

   Personal identity and country
   are never accepted from the client.

   The selected tariff version is used
   only to detect a tariff change.

   All monetary amounts are calculated
   by the authenticated server service.
   ============================================================ */

type SubmitApplicationBody = {
  applicationId: string;

  locale: ApplicationLocale;

  expectedPricingVersion: string;

  form: ApplicationFormInput;
};

/* ============================================================
   5. SUBMISSION SERVICE CONTRACT

   The application.ts service must
   implement this return structure.

   All returned information must come
   from the committed database record.

   Pricing is stored in integer cents.
   ============================================================ */

type SubmissionRecord = {
  applicationId: string;

  reference: string;

  status: string;

  alreadySubmitted: boolean;

  submittedAt: string;

  countryCode:
    | "DE"
    | "AT"
    | "BE"
    | "IT"
    | "ES";

  category: string;

  pricing: {
    currency: "EUR";

    trainingPriceCents: number;

    registrationFeeCents: number;

    totalPriceCents: number;

    pricingVersion: string;
  };

  admissionReviewRequired: boolean;

  documentCount: number;
};

/* ============================================================
   6. EMAIL DELIVERY CONTRACT

   ACCEPTED:
   Resend accepted the email request.
   Does not mean inbox delivery confirmed.

   PENDING:
   Email is durably queued in PostgreSQL
   and requires a delivery attempt.

   FAILED:
   Last sending attempt failed.

   A submitted application must remain
   saved even if an email fails.
   ============================================================ */

type EmailDeliveryStatus =
  | "ACCEPTED"
  | "PENDING"
  | "FAILED";

type SubmissionEmailResult = {
  candidate: EmailDeliveryStatus;

  administrator: EmailDeliveryStatus;
};

/* ============================================================
   7. SUCCESS RESPONSE
   ============================================================ */

type ApiSuccessResponse = {
  success: true;

  data: {
    application: {
      id: string;

      reference: string;

      status: string;

      countryCode: string;

      category: string;

      submittedAt: string;

      documentCount: number;

      alreadySubmitted: boolean;

      admissionReviewRequired: boolean;
    };

    pricing: SubmissionRecord["pricing"];

    emails: SubmissionEmailResult;

    message: string;

    applicationPath: string;

    redirectTo: string;
  };

  timestamp: string;
};

/* ============================================================
   8. SECURITY RESPONSE HEADERS

   Application information contains
   private candidate data.

   Responses must never be cached.
   ============================================================ */

const RESPONSE_HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, max-age=0, must-revalidate",

  Pragma: "no-cache",

  Expires: "0",

  Vary: "Cookie, Origin",

  "X-Content-Type-Options": "nosniff",

  "X-Frame-Options": "DENY",

  "Referrer-Policy": "no-referrer",
};

/* ============================================================
   9. MULTILINGUAL API MESSAGES
   ============================================================ */

type AdditionalErrorCode =
  | "INVALID_JSON"
  | "FORBIDDEN_ORIGIN"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "APPLICATION_NOT_FOUND"
  | "PRICE_CHANGED"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

type ApiTranslations = {
  submitted: string;

  alreadySubmitted: string;

  emailsPending: string;

  errors: Record<
    AdditionalErrorCode,
    string
  >;
};

const TRANSLATIONS: Record<
  ApplicationLocale,
  ApiTranslations
> = {
  /* ========================================================
     GERMAN — DEFAULT LANGUAGE
     ======================================================== */

  de: {
    submitted:
      "Ihr Führerscheinantrag wurde erfolgreich eingereicht.",

    alreadySubmitted:
      "Ihr Führerscheinantrag wurde bereits eingereicht.",

    emailsPending:
      "Ihr Antrag wurde gespeichert. Die E-Mail-Bestätigung wird noch verarbeitet.",

    errors: {
      INVALID_JSON:
        "Die Anfrage konnte nicht verarbeitet werden.",

      FORBIDDEN_ORIGIN:
        "Diese Anfrage ist nicht erlaubt.",

      UNSUPPORTED_MEDIA_TYPE:
        "Das Anfrageformat wird nicht unterstützt.",

      PAYLOAD_TOO_LARGE:
        "Die eingegebenen Daten sind zu lang.",

      APPLICATION_NOT_FOUND:
        "Der Führerscheinantrag wurde nicht gefunden.",

      PRICE_CHANGED:
        "Der Preis wurde geändert. Bitte überprüfen und bestätigen Sie den aktuellen Preis.",

      SERVICE_UNAVAILABLE:
        "Der Dienst ist vorübergehend nicht verfügbar. Bitte versuchen Sie es erneut.",

      INTERNAL_ERROR:
        "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
    },
  },

  /* ========================================================
     ARABIC
     ======================================================== */

  ar: {
    submitted:
      "تم تقديم طلب رخصة القيادة بنجاح.",

    alreadySubmitted:
      "تم تقديم طلب رخصة القيادة مسبقاً.",

    emailsPending:
      "تم حفظ طلبك. لا يزال إرسال رسالة التأكيد قيد المعالجة.",

    errors: {
      INVALID_JSON:
        "تعذر معالجة الطلب.",

      FORBIDDEN_ORIGIN:
        "هذا الطلب غير مسموح به.",

      UNSUPPORTED_MEDIA_TYPE:
        "تنسيق الطلب غير مدعوم.",

      PAYLOAD_TOO_LARGE:
        "البيانات المدخلة طويلة جداً.",

      APPLICATION_NOT_FOUND:
        "لم يتم العثور على طلب رخصة القيادة.",

      PRICE_CHANGED:
        "تم تغيير السعر. يرجى مراجعة السعر الحالي وتأكيده.",

      SERVICE_UNAVAILABLE:
        "الخدمة غير متاحة مؤقتاً. يرجى المحاولة مرة أخرى.",

      INTERNAL_ERROR:
        "حدث خطأ. يرجى المحاولة مرة أخرى.",
    },
  },

  /* ========================================================
     TURKISH
     ======================================================== */

  tr: {
    submitted:
      "Ehliyet başvurunuz başarıyla gönderildi.",

    alreadySubmitted:
      "Ehliyet başvurunuz daha önce gönderildi.",

    emailsPending:
      "Başvurunuz kaydedildi. E-posta onayı henüz işleniyor.",

    errors: {
      INVALID_JSON:
        "İstek işlenemedi.",

      FORBIDDEN_ORIGIN:
        "Bu isteğe izin verilmiyor.",

      UNSUPPORTED_MEDIA_TYPE:
        "İstek biçimi desteklenmiyor.",

      PAYLOAD_TOO_LARGE:
        "Girilen bilgiler çok uzun.",

      APPLICATION_NOT_FOUND:
        "Ehliyet başvurusu bulunamadı.",

      PRICE_CHANGED:
        "Fiyat değişti. Lütfen güncel fiyatı kontrol edin ve onaylayın.",

      SERVICE_UNAVAILABLE:
        "Hizmet geçici olarak kullanılamıyor. Lütfen tekrar deneyin.",

      INTERNAL_ERROR:
        "Bir hata oluştu. Lütfen tekrar deneyin.",
    },
  },

  /* ========================================================
     SPANISH
     ======================================================== */

  es: {
    submitted:
      "Su solicitud de permiso de conducir se ha enviado correctamente.",

    alreadySubmitted:
      "Su solicitud de permiso de conducir ya se ha enviado.",

    emailsPending:
      "Su solicitud se ha guardado. La confirmación por correo electrónico está pendiente.",

    errors: {
      INVALID_JSON:
        "No se pudo procesar la solicitud.",

      FORBIDDEN_ORIGIN:
        "Esta solicitud no está permitida.",

      UNSUPPORTED_MEDIA_TYPE:
        "El formato de la solicitud no es compatible.",

      PAYLOAD_TOO_LARGE:
        "Los datos introducidos son demasiado largos.",

      APPLICATION_NOT_FOUND:
        "No se ha encontrado la solicitud de permiso de conducir.",

      PRICE_CHANGED:
        "El precio ha cambiado. Revise y confirme el precio actual.",

      SERVICE_UNAVAILABLE:
        "El servicio no está disponible temporalmente. Inténtelo de nuevo.",

      INTERNAL_ERROR:
        "Ha ocurrido un error. Inténtelo de nuevo.",
    },
  },
};

/* ============================================================
   10. REQUEST ERROR CLASS
   ============================================================ */

class SubmitRequestError extends Error {
  readonly code: SubmitErrorCode;

  readonly status: number;

  constructor(
    code: SubmitErrorCode,
    status = 400
  ) {
    super(code);

    this.name =
      "SubmitRequestError";

    this.code = code;

    this.status = status;

    Object.setPrototypeOf(
      this,
      SubmitRequestError.prototype
    );
  }
}

/* ============================================================
   11. LOCALIZED ERROR MESSAGES

   Reuses validation.ts translations.

   Avoids duplicating the complete
   application validation dictionary.
   ============================================================ */

function getErrorMessage(
  code: SubmitErrorCode,

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
   12. ERROR RESPONSE
   ============================================================ */

function errorResponse(
  status: number,

  code: SubmitErrorCode,

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

      headers: RESPONSE_HEADERS,
    }
  );
}

/* ============================================================
   13. DETECT REQUEST LANGUAGE

   Priority:
   1. Existing language cookie
   2. Browser language
   3. German default

   The validated request body can
   subsequently specify the current
   interface language.
   ============================================================ */

function getRequestLocale(
  request: NextRequest
): ApplicationLocale {
  const cookieLocale =
    request.cookies.get(
      "taym-locale"
    )?.value;

  if (cookieLocale) {
    return normalizeApplicationLocale(
      cookieLocale
    );
  }

  const preferredLanguage =
    request.headers
      .get("accept-language")
      ?.split(",")[0]
      ?.split(";")[0];

  return normalizeApplicationLocale(
    preferredLanguage
  );
}

/* ============================================================
   14. AUTHORIZED WEBSITE ORIGINS

   Production:
   https://fahrschule-taym.de

   Development:
   http://localhost:3000

   Uses existing environment variables.
   ============================================================ */

function getAllowedOrigins():
  Set<string> {
  const origins =
    new Set<string>();

  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL;

  if (configuredUrl) {
    let url: URL;

    try {
      url = new URL(
        configuredUrl
      );
    } catch {
      throw new SubmitRequestError(
        "SERVICE_UNAVAILABLE",
        503
      );
    }

    if (
      process.env.NODE_ENV ===
        "production" &&

      url.protocol !== "https:"
    ) {
      throw new SubmitRequestError(
        "SERVICE_UNAVAILABLE",
        503
      );
    }

    origins.add(url.origin);

  } else if (
    process.env.NODE_ENV ===
    "production"
  ) {
    throw new SubmitRequestError(
      "SERVICE_UNAVAILABLE",
      503
    );
  }

  if (
    process.env.NODE_ENV !==
    "production"
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
   15. CSRF / ORIGIN VALIDATION

   Only requests from authorized
   Fahrschule TAYM origins are accepted.
   ============================================================ */

function assertAllowedOrigin(
  request: NextRequest
): void {
  const origin =
    request.headers.get("origin");

  const fetchSite =
    request.headers.get(
      "sec-fetch-site"
    );

  if (
    !origin ||

    origin === "null" ||

    fetchSite === "cross-site"
  ) {
    throw new SubmitRequestError(
      "FORBIDDEN_ORIGIN",
      403
    );
  }

  let normalizedOrigin: string;

  try {
    normalizedOrigin =
      new URL(origin).origin;
  } catch {
    throw new SubmitRequestError(
      "FORBIDDEN_ORIGIN",
      403
    );
  }

  if (
    origin !== normalizedOrigin ||

    !getAllowedOrigins().has(
      normalizedOrigin
    )
  ) {
    throw new SubmitRequestError(
      "FORBIDDEN_ORIGIN",
      403
    );
  }
}

/* ============================================================
   16. SECURE JSON BODY READING

   Documents are uploaded separately.

   This endpoint receives only the
   application form and identifiers.

   Maximum body size: 16 KB.
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
    contentType !==
    "application/json"
  ) {
    throw new SubmitRequestError(
      "UNSUPPORTED_MEDIA_TYPE",
      415
    );
  }

  const contentLength =
    request.headers.get(
      "content-length"
    );

  if (contentLength !== null) {
    const length =
      Number(contentLength);

    if (
      !Number.isSafeInteger(length) ||

      length < 0
    ) {
      throw new SubmitRequestError(
        "INVALID_INPUT"
      );
    }

    if (
      length > MAX_BODY_BYTES
    ) {
      throw new SubmitRequestError(
        "PAYLOAD_TOO_LARGE",
        413
      );
    }
  }

  if (!request.body) {
    throw new SubmitRequestError(
      "INVALID_JSON"
    );
  }

  const reader =
    request.body.getReader();

  const chunks: Uint8Array[] = [];

  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } =
        await reader.read();

      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      totalBytes +=
        value.byteLength;

      if (
        totalBytes >
        MAX_BODY_BYTES
      ) {
        try {
          await reader.cancel();
        } catch {
          // Request already rejected.
        }

        throw new SubmitRequestError(
          "PAYLOAD_TOO_LARGE",
          413
        );
      }

      chunks.push(value);
    }

  } finally {
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
    throw new SubmitRequestError(
      "INVALID_JSON"
    );
  }
}

/* ============================================================
   17. REQUEST BODY VALIDATION

   Expected payload:

   {
     applicationId: "...",
     locale: "de",
     expectedPricingVersion: "...",
     category: "B",
     residentialAddress: "...",
     postalCode: "13509",
     city: "Berlin",
     confirmedInformation: true,
     acceptedDocumentProcessing: true
   }

   Rejected:
   - userId
   - email
   - firstName
   - lastName
   - phone
   - countryCode
   - prices
   - status
   - document storage keys

   These are server-controlled values.
   ============================================================ */

function validateRequestBody(
  body: unknown
): SubmitApplicationBody {
  if (
    !body ||

    typeof body !== "object" ||

    Array.isArray(body)
  ) {
    throw new SubmitRequestError(
      "INVALID_INPUT"
    );
  }

  const data =
    body as Record<string, unknown>;

  const allowedFields =
    new Set([
      "applicationId",
      "locale",
      "expectedPricingVersion",
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
    throw new SubmitRequestError(
      "INVALID_INPUT"
    );
  }

  /* Application identifier */

  if (
    !isValidUuid(
      data.applicationId
    )
  ) {
    throw new SubmitRequestError(
      "INVALID_INPUT"
    );
  }

  /* Price version accepted by candidate */

  if (
    typeof data.expectedPricingVersion !==
      "string" ||

    !/^[A-Za-z0-9._:-]{1,100}$/.test(
      data.expectedPricingVersion
    )
  ) {
    throw new SubmitRequestError(
      "INVALID_INPUT"
    );
  }

  /* Interface language */

  const locale =
    normalizeApplicationLocale(
      data.locale
    );

  /*
   * Detailed validation is performed
   * by validation.ts through application.ts.
   *
   * It receives trusted candidate data,
   * database document records and the
   * server-side license catalog.
   */

  const form: ApplicationFormInput = {
    category:
      data.category,

    residentialAddress:
      data.residentialAddress,

    postalCode:
      data.postalCode,

    city:
      data.city,

    confirmedInformation:
      data.confirmedInformation,

    acceptedDocumentProcessing:
      data.acceptedDocumentProcessing,
  };

  return {
    applicationId:
      data.applicationId,

    locale,

    expectedPricingVersion:
      data.expectedPricingVersion,

    form,
  };
}

/* ============================================================
   18. POSTGRESQL AVAILABILITY ERRORS
   ============================================================ */

const DATABASE_ERRORS =
  new Set([
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

function isDatabaseUnavailable(
  error: unknown
): boolean {
  const code =
    getTechnicalErrorCode(error);

  return (
    code !== null &&

    DATABASE_ERRORS.has(code)
  );
}

/* ============================================================
   19. APPLICATION SERVICE ERRORS

   Expected business errors exported
   by application.ts.

   No arbitrary service error message
   is returned to the browser.
   ============================================================ */

function handleApplicationServiceError(
  error: unknown,

  locale: ApplicationLocale
): NextResponse<ApiErrorResponse> | null {
  const code =
    getTechnicalErrorCode(error);

  switch (code) {
    case "APPLICATION_NOT_FOUND":

      return errorResponse(
        404,
        "APPLICATION_NOT_FOUND",
        locale
      );

    case "PRICE_CHANGED":

      return errorResponse(
        409,
        "PRICE_CHANGED",
        locale
      );

    case "INVALID_APPLICATION_STATE":

      return errorResponse(
        409,
        "INVALID_APPLICATION_STATE",
        locale
      );

    case "PRICING_UNAVAILABLE":

      return errorResponse(
        409,
        "PRICING_UNAVAILABLE",
        locale
      );

    case "DOCUMENT_NOT_READY":

      return errorResponse(
        409,
        "DOCUMENT_NOT_READY",
        locale
      );

    case "SERVICE_UNAVAILABLE":

      return errorResponse(
        503,
        "SERVICE_UNAVAILABLE",
        locale
      );

    default:

      return null;
  }
}

/* ============================================================
   20. CENTRALIZED ERROR HANDLING

   Never logs:
   - candidate name
   - email
   - phone number
   - residential address
   - identity documents
   - storage keys
   - session tokens
   - Resend API credentials
   ============================================================ */

function handleSubmissionError(
  error: unknown,

  requestId: string,

  locale: ApplicationLocale
): NextResponse<ApiErrorResponse> {
  /* Request validation errors */

  if (
    error instanceof
    SubmitRequestError
  ) {
    return errorResponse(
      error.status,

      error.code,

      locale
    );
  }

  /* Authentication errors */

  if (
    error instanceof
    SessionAuthError
  ) {
    if (error.status === 403) {
      return errorResponse(
        403,

        "ACCOUNT_UNAVAILABLE",

        locale
      );
    }

    return errorResponse(
      401,

      "UNAUTHORIZED",

      locale
    );
  }

  /* Application validation errors */

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

  /* Business service errors */

  const serviceResponse =
    handleApplicationServiceError(
      error,
      locale
    );

  if (serviceResponse) {
    return serviceResponse;
  }

  /* PostgreSQL errors */

  if (
    isDatabaseUnavailable(error)
  ) {
    console.error(
      "[TAYM][APPLICATION_SUBMIT][DATABASE]",

      {
        requestId,

        code:
          getTechnicalErrorCode(
            error
          ),
      }
    );

    return errorResponse(
      503,

      "SERVICE_UNAVAILABLE",

      locale
    );
  }

  /* Unexpected errors */

  console.error(
    "[TAYM][APPLICATION_SUBMIT][ERROR]",

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
   21. EMAIL DISPATCH

   The email service must:

   - Read persisted notification records.
   - Read the submitted application.
   - Send confirmation to the candidate.
   - Send notification to the administrator.
   - Persist each email status separately.
   - Prevent duplicate accepted emails.
   - Use stable Resend idempotency keys.

   Email notification jobs must already
   exist in PostgreSQL before this
   function is called.

   Never create email jobs only in memory.
   ============================================================ */

async function dispatchSubmissionEmails(
  applicationId: string,

  requestId: string
): Promise<SubmissionEmailResult> {
  try {
    const result: SubmissionEmailResult =
      await dispatchApplicationSubmissionEmails({
        applicationId,
      });

    return result;

  } catch (error: unknown) {
    /*
     * Application is already committed.
     *
     * A provider failure must not cause
     * the application to be submitted again.
     *
     * Persisted email jobs remain available
     * for controlled retry.
     */

    console.error(
      "[TAYM][APPLICATION_SUBMIT][EMAIL]",

      {
        requestId,

        type:
          error instanceof Error
            ? error.name
            : "UnknownError",
      }
    );

    return {
      candidate: "PENDING",

      administrator: "PENDING",
    };
  }
}

/* ============================================================
   22. SUCCESS MESSAGE SELECTION
   ============================================================ */

function getSuccessMessage(
  record: SubmissionRecord,

  emails: SubmissionEmailResult,

  locale: ApplicationLocale
): string {
  const t =
    TRANSLATIONS[locale];

  if (
    emails.candidate !== "ACCEPTED"
  ) {
    return t.emailsPending;
  }

  if (record.alreadySubmitted) {
    return t.alreadySubmitted;
  }

  return t.submitted;
}

/* ============================================================
   23. POST /api/dashboard/application/submit

   Execution order:

   1. Determine current language.
   2. Validate request origin.
   3. Authenticate candidate.
   4. Read and validate JSON body.
   5. Lock and load candidate application.
   6. Verify ownership.
   7. Load actual candidate information.
   8. Load country-specific catalog.
   9. Validate category and pricing.
   10. Validate residential information.
   11. Validate required documents.
   12. Validate candidate confirmations.
   13. Record final application.
   14. Record status history.
   15. Persist both email jobs.
   16. Commit database transaction.
   17. Attempt automatic email dispatch.
   18. Return submitted application.

   Application submission must be
   transactional and idempotent.

   No payment is initiated by this API.
   No official driving license is issued.
   ============================================================ */

export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  const requestId =
    randomUUID();

  let locale =
    getRequestLocale(request);

  try {
    /* --------------------------------------------------------
       STEP 1 — REQUEST ORIGIN
       -------------------------------------------------------- */

    assertAllowedOrigin(request);

    /* --------------------------------------------------------
       STEP 2 — AUTHENTICATED CANDIDATE

       Uses existing taym_session cookie.

       The session service checks:
       - token hash
       - expiration
       - revocation
       - candidate role
       - account status
       - verified email
       - verified phone
       -------------------------------------------------------- */

    const session =
      await requireCandidateSession(
        request
      );

    if (
      !session ||

      !session.userId
    ) {
      throw new SubmitRequestError(
        "UNAUTHORIZED",
        401
      );
    }

    /* --------------------------------------------------------
       STEP 3 — READ REQUEST
       -------------------------------------------------------- */

    const body =
      await readJsonBody(request);

    /*
     * Set language before validation,
     * so validation errors use the
     * requested interface language.
     */

    if (
      body &&

      typeof body === "object" &&

      !Array.isArray(body)
    ) {
      const rawBody =
        body as Record<string, unknown>;

      if (
        rawBody.locale !== undefined
      ) {
        locale =
          normalizeApplicationLocale(
            rawBody.locale
          );
      }
    }

    /* --------------------------------------------------------
       STEP 4 — VALIDATE REQUEST PAYLOAD
       -------------------------------------------------------- */

    const input =
      validateRequestBody(body);

    /*
     * Preserve detected language when
     * locale is absent from request.
     */

    const rawBody =
      body as Record<string, unknown>;

    if (rawBody.locale !== undefined) {
      locale = input.locale;
    }

    /* --------------------------------------------------------
       STEP 5 — FINAL APPLICATION SUBMISSION

       application.ts must perform all
       security and validation operations
       within a consistent transaction.

       Required guarantees:

       A. Lock candidate and application.
       B. Recheck active session/account.
       C. Filter application by candidate ID.
       D. Return existing committed submission
          if this application was already sent.
       E. Load trusted document records.
       F. Load trusted country/category prices.
       G. Compare expected pricing version.
       H. Call validateApplicationSubmission().
       I. Store all final values.
       J. Generate unique application reference.
       K. Record status history.
       L. Create two unique notification jobs.
       M. Commit.

       Personal details are taken from
       PostgreSQL, never from request JSON.
       -------------------------------------------------------- */

    const result: SubmissionRecord =
      await submitLicenseApplication({
        applicationId:
          input.applicationId,

        authenticatedUserId:
          session.userId,

        authenticatedSessionId:
          session.sessionId,

        form:
          input.form,

        expectedPricingVersion:
          input.expectedPricingVersion,

        locale,
      });

    /* --------------------------------------------------------
       STEP 6 — AUTOMATIC EMAIL DISPATCH

       The application is already stored.

       The two email recipients are
       determined by the email service:

       - candidate email from database
       - administrator email from server config

       Never from browser-supplied addresses.
       -------------------------------------------------------- */

    const emails =
      await dispatchSubmissionEmails(
        result.applicationId,

        requestId
      );

    /* --------------------------------------------------------
       STEP 7 — LOCALIZED SUCCESS MESSAGE
       -------------------------------------------------------- */

    const message =
      getSuccessMessage(
        result,

        emails,

        locale
      );

    /* --------------------------------------------------------
       STEP 8 — SAFE JSON RESPONSE

       Documents and private storage
       credentials are never included.
       -------------------------------------------------------- */

    return NextResponse.json<ApiSuccessResponse>(
      {
        success: true,

        data: {
          application: {
            id:
              result.applicationId,

            reference:
              result.reference,

            status:
              result.status,

            countryCode:
              result.countryCode,

            category:
              result.category,

            submittedAt:
              result.submittedAt,

            documentCount:
              result.documentCount,

            alreadySubmitted:
              result.alreadySubmitted,

            admissionReviewRequired:
              result.admissionReviewRequired,
          },

          pricing: {
            currency:
              result.pricing.currency,

            trainingPriceCents:
              result.pricing.trainingPriceCents,

            registrationFeeCents:
              result.pricing.registrationFeeCents,

            totalPriceCents:
              result.pricing.totalPriceCents,

            pricingVersion:
              result.pricing.pricingVersion,
          },

          emails: {
            candidate:
              emails.candidate,

            administrator:
              emails.administrator,
          },

          message,

          applicationPath:
            APPLICATION_PATH,

          redirectTo:
            DASHBOARD_PATH,
        },

        timestamp:
          new Date().toISOString(),
      },

      {
        status:
          result.alreadySubmitted
            ? 200
            : 201,

        headers:
          RESPONSE_HEADERS,
      }
    );

  } catch (error: unknown) {
    return handleSubmissionError(
      error,

      requestId,

      locale
    );
  }
}
