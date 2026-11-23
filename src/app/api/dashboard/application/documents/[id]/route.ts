
import { connection, NextRequest, NextResponse } from "next/server";

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
  isApplicationDocumentType,
  isAllowedDocumentMimeType,
  isValidDocumentSize,
  sanitizeDocumentFileName,
  detectDocumentMimeType,
  MAX_DOCUMENT_SIZE_BYTES,
  type ApplicationLocale,
  type ApplicationErrorCode,
  type ApplicationDocumentType,
  type AllowedDocumentMimeType,
  type ValidationIssue,
} from "@/lib/applications/validation";

import {
  getCandidateApplicationDocument,
  downloadCandidateApplicationDocument,
} from "@/lib/applications/documents";

/* ============================================================
   FAHRSCHULE TAYM

   APPLICATION — SECURE DOCUMENT ACCESS

   File:
   src/app/api/dashboard/application/documents/[id]/route.ts

   Endpoints:

   GET /api/dashboard/application/documents/[id]

   GET /api/dashboard/application/documents/[id]?download=1

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

   Security:
   - Authenticated candidate session
   - Document ownership verification
   - Application ownership verification
   - Private Supabase Storage
   - File type validation
   - File size validation
   - Security status validation
   - Secure document download
   - No public storage URLs
   - No cache
   - No arbitrary redirects

   Compatible:
   - Desktop
   - Tablet
   - Mobile

   No additional layout.
   No additional navigation.
   ============================================================ */

/* ============================================================
   1. NEXT.JS CONFIGURATION
   ============================================================ */




/* ============================================================
   2. ROUTE PARAMETERS

   Next.js App Router
   Dynamic route parameters are asynchronous.
   ============================================================ */

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/* ============================================================
   3. API CONFIGURATION
   ============================================================ */

const MAX_FILENAME_LENGTH = 180;

const SUPPORTED_COUNTRIES = new Set([
  "DE",
  "AT",
  "BE",
  "IT",
  "ES",
]);


/* ============================================================
   4. API ERROR TYPES
   ============================================================ */

type AdditionalErrorCode =
  | "DOCUMENT_NOT_FOUND"
  | "DOCUMENT_ACCESS_DENIED"
  | "DOCUMENT_UNAVAILABLE"
  | "INVALID_DOCUMENT_ID"
  | "INVALID_DOWNLOAD_MODE"
  | "FORBIDDEN_ORIGIN"
  | "STORAGE_UNAVAILABLE"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

type DocumentApiErrorCode =
  | ApplicationErrorCode
  | AdditionalErrorCode;

type ApiErrorResponse = {
  success: false;

  error: {
    code: DocumentApiErrorCode;

    message: string;

    issues?: ValidationIssue[];
  };

  timestamp: string;
};

/* ============================================================
   5. DOCUMENT ACCESS MODE
   ============================================================ */

type DocumentAccessMode =
  | "PREVIEW"
  | "DOWNLOAD";

/* ============================================================
   6. DOCUMENT SERVICE CONTRACT

   documents.ts must return this structure
   from authenticated PostgreSQL queries.

   Never construct this record from
   browser-provided metadata.

   storageKey must remain server-side.
   ============================================================ */

type CandidateDocumentRecord = {
  id: string;

  applicationId: string;

  userId: string;

  countryCode:
    | "DE"
    | "AT"
    | "BE"
    | "IT"
    | "ES";

  type: ApplicationDocumentType;

  fileName: string;

  mimeType: string;

  sizeBytes: number;

  storageKey: string;

  uploadStatus:
    | "UPLOADING"
    | "UPLOADED"
    | "FAILED"
    | "DELETED";

  securityStatus:
    | "PENDING"
    | "CLEAN"
    | "REJECTED";

  reviewStatus:
    | "PENDING"
    | "APPROVED"
    | "REJECTED";
};

/* ============================================================
   7. PRIVATE STORAGE DOWNLOAD CONTRACT

   The documents.ts service must:

   - Recheck candidate ownership.
   - Recheck application ownership.
   - Recheck current session.
   - Read the actual private storage object.
   - Enforce the maximum file size.
   - Return the complete binary content.

   No public URL.
   No service-role key exposed.
   ============================================================ */

type CandidateDocumentDownload = {
  document: CandidateDocumentRecord;

  content: Uint8Array;
};

/* ============================================================
   8. MULTILINGUAL ERROR MESSAGES
   ============================================================ */

const TRANSLATIONS: Record<
  ApplicationLocale,
  Record<AdditionalErrorCode, string>
> = {
  /* German — default */

  de: {
    DOCUMENT_NOT_FOUND:
      "Das Dokument wurde nicht gefunden.",

    DOCUMENT_ACCESS_DENIED:
      "Sie haben keinen Zugriff auf dieses Dokument.",

    DOCUMENT_UNAVAILABLE:
      "Dieses Dokument ist derzeit nicht verfügbar.",

    INVALID_DOCUMENT_ID:
      "Die Dokument-ID ist ungültig.",

    INVALID_DOWNLOAD_MODE:
      "Die Download-Anfrage ist ungültig.",

    FORBIDDEN_ORIGIN:
      "Diese Anfrage ist nicht erlaubt.",

    STORAGE_UNAVAILABLE:
      "Der Dokumentenspeicher ist vorübergehend nicht verfügbar.",

    SERVICE_UNAVAILABLE:
      "Der Dienst ist vorübergehend nicht verfügbar.",

    INTERNAL_ERROR:
      "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
  },

  /* Arabic — RTL */

  ar: {
    DOCUMENT_NOT_FOUND:
      "لم يتم العثور على المستند.",

    DOCUMENT_ACCESS_DENIED:
      "ليس لديك صلاحية الوصول إلى هذا المستند.",

    DOCUMENT_UNAVAILABLE:
      "هذا المستند غير متاح حالياً.",

    INVALID_DOCUMENT_ID:
      "معرف المستند غير صالح.",

    INVALID_DOWNLOAD_MODE:
      "طلب التنزيل غير صالح.",

    FORBIDDEN_ORIGIN:
      "هذا الطلب غير مسموح به.",

    STORAGE_UNAVAILABLE:
      "خدمة تخزين المستندات غير متاحة مؤقتاً.",

    SERVICE_UNAVAILABLE:
      "الخدمة غير متاحة مؤقتاً.",

    INTERNAL_ERROR:
      "حدث خطأ. يرجى المحاولة مرة أخرى.",
  },

  /* Turkish */

  tr: {
    DOCUMENT_NOT_FOUND:
      "Belge bulunamadı.",

    DOCUMENT_ACCESS_DENIED:
      "Bu belgeye erişim izniniz yok.",

    DOCUMENT_UNAVAILABLE:
      "Bu belge şu anda kullanılamıyor.",

    INVALID_DOCUMENT_ID:
      "Belge kimliği geçersiz.",

    INVALID_DOWNLOAD_MODE:
      "İndirme isteği geçersiz.",

    FORBIDDEN_ORIGIN:
      "Bu isteğe izin verilmiyor.",

    STORAGE_UNAVAILABLE:
      "Belge depolama hizmeti geçici olarak kullanılamıyor.",

    SERVICE_UNAVAILABLE:
      "Hizmet geçici olarak kullanılamıyor.",

    INTERNAL_ERROR:
      "Bir hata oluştu. Lütfen tekrar deneyin.",
  },

  /* Spanish */

  es: {
    DOCUMENT_NOT_FOUND:
      "No se ha encontrado el documento.",

    DOCUMENT_ACCESS_DENIED:
      "No tiene acceso a este documento.",

    DOCUMENT_UNAVAILABLE:
      "Este documento no está disponible actualmente.",

    INVALID_DOCUMENT_ID:
      "El identificador del documento no es válido.",

    INVALID_DOWNLOAD_MODE:
      "La solicitud de descarga no es válida.",

    FORBIDDEN_ORIGIN:
      "Esta solicitud no está permitida.",

    STORAGE_UNAVAILABLE:
      "El almacenamiento de documentos no está disponible temporalmente.",

    SERVICE_UNAVAILABLE:
      "El servicio no está disponible temporalmente.",

    INTERNAL_ERROR:
      "Ha ocurrido un error. Inténtelo de nuevo.",
  },
};

/* ============================================================
   9. SECURITY RESPONSE HEADERS

   Sensitive documents must not be
   cached by browsers, proxies or CDNs.

   Same-origin embedding is permitted
   for document previews inside TAYM.
   ============================================================ */

const SECURITY_HEADERS: Record<string, string> = {
  "Cache-Control":
    "private, no-store, no-cache, max-age=0, must-revalidate",

  Pragma: "no-cache",

  Expires: "0",

  Vary: "Cookie, Accept-Language",

  "X-Content-Type-Options":
    "nosniff",

  "X-Frame-Options":
    "SAMEORIGIN",

  "Cross-Origin-Resource-Policy":
    "same-origin",

  "Referrer-Policy":
    "no-referrer",

  "X-Robots-Tag":
    "noindex, nofollow, noarchive, nosnippet",

  "Content-Security-Policy":
    "default-src 'none'; frame-ancestors 'self'; sandbox",
};

/* ============================================================
   10. DOCUMENT ACCESS ERROR
   ============================================================ */

class DocumentAccessError extends Error {
  readonly code: DocumentApiErrorCode;

  readonly status: number;

  constructor(
    code: DocumentApiErrorCode,

    status = 400
  ) {
    super(code);

    this.name =
      "DocumentAccessError";

    this.code = code;

    this.status = status;

    Object.setPrototypeOf(
      this,
      DocumentAccessError.prototype
    );
  }
}

/* ============================================================
   11. GET LOCALIZED ERROR MESSAGE
   ============================================================ */

function getErrorMessage(
  code: DocumentApiErrorCode,

  locale: ApplicationLocale
): string {
  const dictionary =
    TRANSLATIONS[locale];

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

  code: DocumentApiErrorCode,

  locale: ApplicationLocale,

  issues?: ValidationIssue[]
): NextResponse<ApiErrorResponse> {
  return NextResponse.json<ApiErrorResponse>(
    {
      success: false,

      error: {
        code,

        message:
          getErrorMessage(
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

      headers: {
        ...SECURITY_HEADERS,

        "Content-Language": locale,
      },
    }
  );
}

/* ============================================================
   13. LANGUAGE DETECTION

   Priority:
   - Selected interface language
   - Existing language cookie
   - Browser language
   - German default

   Language affects messages only.
   It does not affect authorization.
   ============================================================ */

function getRequestLocale(
  request: NextRequest
): ApplicationLocale {
  const queryLocale =
    request.nextUrl.searchParams.get(
      "locale"
    );

  if (queryLocale) {
    return normalizeApplicationLocale(
      queryLocale
    );
  }

  const cookieLocale =
    request.cookies.get(
      "taym-locale"
    )?.value;

  if (cookieLocale) {
    return normalizeApplicationLocale(
      cookieLocale
    );
  }

  const browserLanguage =
    request.headers
      .get("accept-language")
      ?.split(",")[0]
      ?.split(";")[0];

  return normalizeApplicationLocale(
    browserLanguage
  );
}

/* ============================================================
   14. VALIDATE DOCUMENT IDENTIFIER

   Documents use UUID identifiers.

   Never accept a file path or a private
   Supabase Storage key from the URL.
   ============================================================ */

function validateDocumentId(
  value: unknown
): string {
  if (!isValidUuid(value)) {
    throw new DocumentAccessError(
      "INVALID_DOCUMENT_ID",
      400
    );
  }

  return value.toLowerCase();
}

/* ============================================================
   15. VALIDATE DOWNLOAD MODE

   Default:
   Inline preview for safe raster images.

   download=1:
   Download as attachment.

   PDF files are always attachments
   to reduce inline active-content risks.
   ============================================================ */

function getDocumentAccessMode(
  request: NextRequest
): DocumentAccessMode {
  const values =
    request.nextUrl.searchParams.getAll(
      "download"
    );

  if (values.length > 1) {
    throw new DocumentAccessError(
      "INVALID_DOWNLOAD_MODE",
      400
    );
  }

  const value =
    values[0] ?? null;

  if (
    value === null ||
    value === "0"
  ) {
    return "PREVIEW";
  }

  if (value === "1") {
    return "DOWNLOAD";
  }

  throw new DocumentAccessError(
    "INVALID_DOWNLOAD_MODE",
    400
  );
}

/* ============================================================
   16. SAME-ORIGIN ACCESS CONTROL

   GET requests made by image elements,
   browser navigation or download links
   may not contain an Origin header.

   A missing Origin is therefore allowed.

   Cross-site requests are rejected when
   the relevant browser headers exist.

   Actual access always requires
   authenticated ownership.
   ============================================================ */

function assertAllowedDocumentRequest(
  request: NextRequest
): void {
  const fetchSite =
    request.headers.get(
      "sec-fetch-site"
    );

  if (
    fetchSite === "cross-site" ||
    fetchSite === "same-site"
  ) {
    throw new DocumentAccessError(
      "FORBIDDEN_ORIGIN",
      403
    );
  }

  const origin =
    request.headers.get("origin");

  if (!origin) {
    return;
  }

  const allowedOrigins = new Set<string>();
  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    allowedOrigins.add("https://fahrschule-taym.de");
  } else {
    allowedOrigins.add("http://localhost:3000");
    allowedOrigins.add("http://127.0.0.1:3000");
  }
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (configuredUrl) {
    try {
      const url = new URL(configuredUrl);
      if (!isProduction || url.protocol === "https:") allowedOrigins.add(url.origin);
    } catch {
      console.error("[TAYM][DOCUMENTS] Invalid NEXT_PUBLIC_APP_URL");
    }
  }

  if (!allowedOrigins.has(origin)) {
    throw new DocumentAccessError(
      "FORBIDDEN_ORIGIN",
      403
    );
  }
}

/* ============================================================
   17. DOCUMENT OWNERSHIP

   A valid document UUID does not grant
   permission to access a document.

   Unauthorized and nonexistent documents
   deliberately produce the same response.
   ============================================================ */

function assertDocumentOwnership(
  document: CandidateDocumentRecord | null,

  documentId: string,

  authenticatedUserId: string,

  authenticatedCountryCode: string
): asserts document is CandidateDocumentRecord {
  if (
    !document ||

    document.id.toLowerCase() !==
      documentId ||

    document.userId !==
      authenticatedUserId ||

    !isValidUuid(
      document.applicationId
    ) ||

    document.countryCode !==
      authenticatedCountryCode ||

    document.uploadStatus ===
      "DELETED"
  ) {
    throw new DocumentAccessError(
      "DOCUMENT_NOT_FOUND",
      404
    );
  }

  if (
    !SUPPORTED_COUNTRIES.has(
      document.countryCode
    )
  ) {
    throw new DocumentAccessError(
      "UNSUPPORTED_COUNTRY",
      403
    );
  }
}

/* ============================================================
   18. DOCUMENT AVAILABILITY

   Security status and administrative
   review status are different.

   A document rejected administratively
   may still be viewed by its owner if
   the file itself is safe.

   Rejected files must not be served.
   ============================================================ */

function assertDocumentAvailable(
  document: CandidateDocumentRecord
): void {
  if (
    document.uploadStatus !==
    "UPLOADED"
  ) {
    throw new DocumentAccessError(
      "DOCUMENT_NOT_READY",
      409
    );
  }

  if (
    document.securityStatus ===
    "REJECTED"
  ) {
    throw new DocumentAccessError(
      "DOCUMENT_UNAVAILABLE",
      403
    );
  }

  if (
    !isApplicationDocumentType(
      document.type
    ) ||

    !isAllowedDocumentMimeType(
      document.type,
      document.mimeType
    ) ||

    !isValidDocumentSize(
      document.sizeBytes
    ) ||

    typeof document.storageKey !==
      "string" ||

    document.storageKey.length === 0
  ) {
    throw new DocumentAccessError(
      "DOCUMENT_UNAVAILABLE",
      409
    );
  }
}

/* ============================================================
   19. VERIFY ACTUAL DOWNLOAD CONTENT

   Never trust database metadata alone.

   Recheck:
   - Actual binary size
   - Expected stored size
   - Maximum permitted size
   - Actual file signature
   - MIME type
   - Document type

   A signature check is not a replacement
   for malware scanning.
   ============================================================ */

function validateDownloadedContent(
  document: CandidateDocumentRecord,

  content: Uint8Array
): AllowedDocumentMimeType {
  if (
    !(content instanceof Uint8Array) ||

    content.byteLength === 0 ||

    content.byteLength >
      MAX_DOCUMENT_SIZE_BYTES ||

    content.byteLength !==
      document.sizeBytes
  ) {
    throw new DocumentAccessError(
      "DOCUMENT_UNAVAILABLE",
      409
    );
  }

  const detectedMimeType =
    detectDocumentMimeType(
      content
    );

  if (
    !detectedMimeType ||

    detectedMimeType !==
      document.mimeType ||

    !isAllowedDocumentMimeType(
      document.type,
      detectedMimeType
    )
  ) {
    throw new DocumentAccessError(
      "DOCUMENT_UNAVAILABLE",
      409
    );
  }

  return detectedMimeType;
}

/* ============================================================
   20. SAFE DOWNLOAD FILE NAME

   Protects against:
   - Header injection
   - Path traversal
   - Invalid file extensions
   - Control characters
   - Unsafe bidirectional characters

   Supports Unicode file names.
   ============================================================ */

function getFileExtension(
  mimeType: AllowedDocumentMimeType
): string {
  switch (mimeType) {
    case "application/pdf":
      return "pdf";

    case "image/jpeg":
      return "jpg";

    case "image/png":
      return "png";
  }
}

function getSafeDownloadFileName(
  document: CandidateDocumentRecord,

  mimeType: AllowedDocumentMimeType
): string {
  const extension =
    getFileExtension(
      mimeType
    );

  const sanitized =
    sanitizeDocumentFileName(
      document.fileName
    );

  if (!sanitized) {
    return (
      `taym-${document.type.toLowerCase()}` +
      `-${document.id}.${extension}`
    );
  }

  /*
   * Ensure the extension matches
   * the verified binary file type.
   */

  const lastDot =
    sanitized.lastIndexOf(".");

  const base =
    lastDot > 0
      ? sanitized.slice(0, lastDot)
      : sanitized;

  /*
   * Array.from prevents truncation in
   * the middle of Unicode surrogate pairs.
   */

  const safeBase =
    Array.from(base)
      .slice(
        0,
        MAX_FILENAME_LENGTH -
          extension.length -
          1
      )
      .join("");

  return (
    `${safeBase || "document"}.${extension}`
  );
}

/* ============================================================
   21. CONTENT DISPOSITION

   Unicode-compatible download file name.

   RFC 5987 filename* support.

   ASCII fallback for older browsers.
   ============================================================ */

function encodeHeaderFileName(
  value: string
): string {
  return encodeURIComponent(value)
    .replace(
      /['()*]/g,

      (character) =>
        "%" +
        character
          .charCodeAt(0)
          .toString(16)
          .toUpperCase()
    );
}

function createContentDisposition(
  fileName: string,

  mode: DocumentAccessMode,

  mimeType: AllowedDocumentMimeType
): string {
  /*
   * Only JPEG and PNG may be opened
   * inline after security validation.
   *
   * PDF files must be downloaded.
   */

  const allowInline =
    mode === "PREVIEW" &&

    (
      mimeType === "image/jpeg" ||
      mimeType === "image/png"
    );

  const disposition =
    allowInline
      ? "inline"
      : "attachment";

  const fallback =
    fileName
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, MAX_FILENAME_LENGTH);

  const encodedFileName =
    encodeHeaderFileName(
      fileName
    );

  return (
    `${disposition}; ` +
    `filename="${fallback || "document"}"; ` +
    `filename*=UTF-8''${encodedFileName}`
  );
}

/* ============================================================
   22. BUILD SECURE BINARY RESPONSE

   The actual file is returned directly
   by the authenticated Next.js API.

   No private storage URL is exposed.

   The response does not expose:
   - Supabase service-role key
   - Storage bucket credentials
   - Database storage key
   - Candidate private metadata
   ============================================================ */

function createDocumentResponse({
  document,

  content,

  mimeType,

  mode,

  locale,
}: {
  document: CandidateDocumentRecord;

  content: Uint8Array;

  mimeType: AllowedDocumentMimeType;

  mode: DocumentAccessMode;

  locale: ApplicationLocale;
}): NextResponse {
  const fileName =
    getSafeDownloadFileName(
      document,
      mimeType
    );

  const disposition =
    createContentDisposition(
      fileName,

      mode,

      mimeType
    );

  const headers =
    new Headers(
      SECURITY_HEADERS
    );

  headers.set(
    "Content-Type",
    mimeType
  );

  headers.set(
    "Content-Length",
    String(
      content.byteLength
    )
  );

  headers.set(
    "Content-Disposition",
    disposition
  );

  headers.set(
    "Content-Language",
    locale
  );

  /*
   * Range requests are not currently
   * implemented for these small files.
   */

  headers.set(
    "Accept-Ranges",
    "none"
  );

  /*
   * Copy into a standard ArrayBuffer.
   *
   * Compatible with Next.js Response
   * and recent TypeScript versions.
   */

  const responseBuffer =
    new ArrayBuffer(
      content.byteLength
    );

  new Uint8Array(
    responseBuffer
  ).set(content);

  return new NextResponse(
    responseBuffer,

    {
      status: 200,

      headers,
    }
  );
}

/* ============================================================
   23. TECHNICAL ERROR IDENTIFICATION
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
   24. DATABASE AVAILABILITY ERRORS
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

function isDatabaseUnavailable(
  error: unknown
): boolean {
  const code =
    getTechnicalErrorCode(
      error
    );

  return (
    code !== null &&

    DATABASE_ERRORS.has(code)
  );
}

/* ============================================================
   25. DOCUMENT SERVICE ERROR HANDLING

   documents.ts must use consistent
   business error codes.

   Access failures are intentionally
   returned as DOCUMENT_NOT_FOUND.
   ============================================================ */

function handleDocumentServiceError(
  error: unknown,

  locale: ApplicationLocale
): NextResponse<ApiErrorResponse> | null {
  const code =
    getTechnicalErrorCode(
      error
    );

  switch (code) {
    case "DOCUMENT_NOT_FOUND":

    case "APPLICATION_NOT_FOUND":

    case "DOCUMENT_ACCESS_DENIED":

      return errorResponse(
        404,

        "DOCUMENT_NOT_FOUND",

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

    case "DOCUMENT_NOT_READY":

      return errorResponse(
        409,

        "DOCUMENT_NOT_READY",

        locale
      );

    case "DOCUMENT_REJECTED":

    case "DOCUMENT_UNAVAILABLE":

      return errorResponse(
        409,

        "DOCUMENT_UNAVAILABLE",

        locale
      );

    case "STORAGE_UNAVAILABLE":

    case "STORAGE_DOWNLOAD_FAILED":

      return errorResponse(
        503,

        "STORAGE_UNAVAILABLE",

        locale
      );

    case "SERVICE_UNAVAILABLE":

    case "DATABASE_UNAVAILABLE":

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
   26. CENTRALIZED ERROR HANDLING

   Never logs:
   - Identity documents
   - Signature images
   - Residential addresses
   - Bank statements
   - Personal photos
   - Session tokens
   - Storage credentials
   - File binary content
   ============================================================ */

function handleDocumentError(
  error: unknown,

  requestId: string,

  locale: ApplicationLocale
): NextResponse<ApiErrorResponse> {
  /* Authentication errors */

  if (
    error instanceof
    SessionAuthError
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

  /* Document access errors */

  if (
    error instanceof
    DocumentAccessError
  ) {
    return errorResponse(
      error.status,

      error.code,

      locale
    );
  }

  /* Validation errors */

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
    handleDocumentServiceError(
      error,

      locale
    );

  if (serviceResponse) {
    return serviceResponse;
  }

  /* Database errors */

  if (
    isDatabaseUnavailable(error)
  ) {
    console.error(
      "[TAYM][DOCUMENT_ACCESS][DATABASE]",

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

  /* Unexpected technical error */

  console.error(
    "[TAYM][DOCUMENT_ACCESS][ERROR]",

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
   27. GET — SECURE DOCUMENT ACCESS

   GET /api/dashboard/application/documents/[id]

   GET /api/dashboard/application/documents/[id]?download=1

   Execution order:

   1. Detect interface language.
   2. Reject cross-site requests.
   3. Validate candidate session.
   4. Validate document UUID.
   5. Validate download mode.
   6. Load document from PostgreSQL.
   7. Verify candidate ownership.
   8. Verify application ownership.
   9. Verify country.
   10. Verify document security status.
   11. Download from private Supabase Storage.
   12. Recheck current document information.
   13. Verify actual file content.
   14. Return protected binary response.

   The candidate cannot access
   another candidate's documents.
   ============================================================ */

export async function GET(
  request: NextRequest,

  context: RouteContext
): Promise<NextResponse> {
  await connection();
  const requestId =
    randomUUID();

  const locale =
    getRequestLocale(
      request
    );

  try {
    /* --------------------------------------------------------
       STEP 1 — REQUEST ACCESS CONTROL
       -------------------------------------------------------- */

    assertAllowedDocumentRequest(
      request
    );

    /* --------------------------------------------------------
       STEP 2 — CANDIDATE SESSION

       Uses our existing taym_session.

       Checks:
       - Session token
       - Session expiration
       - Session revocation
       - Active account
       - Candidate role
       - Email verification
       - Phone verification
       -------------------------------------------------------- */

    const session =
      await requireCandidateSession(
        request
      );

    if (
      !session ||

      !isValidUuid(
        session.userId
      ) ||

      !isValidUuid(
        session.sessionId
      )
    ) {
      throw new DocumentAccessError(
        "UNAUTHORIZED",
        401
      );
    }

    /* --------------------------------------------------------
       STEP 3 — COUNTRY VALIDATION
       -------------------------------------------------------- */

    const countryCode =
      session.countryCode;

    if (
      !SUPPORTED_COUNTRIES.has(
        countryCode
      )
    ) {
      throw new DocumentAccessError(
        "UNSUPPORTED_COUNTRY",
        403
      );
    }

    /* --------------------------------------------------------
       STEP 4 — DYNAMIC DOCUMENT ID
       -------------------------------------------------------- */

    const params =
      await context.params;

    const documentId =
      validateDocumentId(
        params.id
      );

    /* --------------------------------------------------------
       STEP 5 — ACCESS MODE
       -------------------------------------------------------- */

    const mode =
      getDocumentAccessMode(
        request
      );

    /* --------------------------------------------------------
       STEP 6 — DATABASE DOCUMENT LOOKUP

       documents.ts must query using:
       - documentId
       - authenticatedUserId

       It must also verify the ownership
       of the related driving application.
       -------------------------------------------------------- */

    const document:
      CandidateDocumentRecord | null =
      await getCandidateApplicationDocument({
        documentId,

        authenticatedUserId:
          session.userId,

        authenticatedSessionId:
          session.sessionId,
      });

    /* --------------------------------------------------------
       STEP 7 — OWNERSHIP VERIFICATION
       -------------------------------------------------------- */

    assertDocumentOwnership(
      document,

      documentId,

      session.userId,

      countryCode
    );

    /* --------------------------------------------------------
       STEP 8 — DOCUMENT READINESS
       -------------------------------------------------------- */

    assertDocumentAvailable(
      document
    );

    /* --------------------------------------------------------
       STEP 9 — PRIVATE STORAGE DOWNLOAD

       No storage key supplied by
       the browser is accepted.

       The service loads and downloads
       the authorized document itself.

       It must enforce the 10 MB limit
       while reading the storage response.
       -------------------------------------------------------- */

    const downloaded:
      CandidateDocumentDownload =
      await downloadCandidateApplicationDocument({
        documentId,

        authenticatedUserId:
          session.userId,

        authenticatedSessionId:
          session.sessionId,

        maxBytes:
          MAX_DOCUMENT_SIZE_BYTES,
      });

    /* --------------------------------------------------------
       STEP 10 — RECHECK DOWNLOADED RECORD

       The database record could have
       changed during the first lookup.

       Never serve a different storage
       object under the current request.
       -------------------------------------------------------- */

    assertDocumentOwnership(
      downloaded.document,

      documentId,

      session.userId,

      countryCode
    );

    assertDocumentAvailable(
      downloaded.document
    );

    if (
      downloaded.document.applicationId !==
        document.applicationId ||

      downloaded.document.storageKey !==
        document.storageKey ||

      downloaded.document.type !==
        document.type ||

      downloaded.document.sizeBytes !==
        document.sizeBytes ||

      downloaded.document.mimeType !==
        document.mimeType
    ) {
      throw new DocumentAccessError(
        "DOCUMENT_UNAVAILABLE",
        409
      );
    }

    /* --------------------------------------------------------
       STEP 11 — ACTUAL FILE VALIDATION
       -------------------------------------------------------- */

    const mimeType =
      validateDownloadedContent(
        downloaded.document,

        downloaded.content
      );

    /* --------------------------------------------------------
       STEP 12 — FINAL SESSION CHECK

       Prevent delivery if the candidate
       session was revoked or expired
       during the storage download.
       -------------------------------------------------------- */

    const currentSession =
      await requireCandidateSession(
        request
      );

    if (
      currentSession.userId !==
        session.userId ||

      currentSession.sessionId !==
        session.sessionId ||

      currentSession.countryCode !==
        session.countryCode
    ) {
      throw new DocumentAccessError(
        "UNAUTHORIZED",
        401
      );
    }

    /* --------------------------------------------------------
       STEP 13 — FINAL DOCUMENT CHECK

       Recheck that the document was not
       deleted, replaced or quarantined
       while the file was being fetched.
       -------------------------------------------------------- */

    const currentDocument:
      CandidateDocumentRecord | null =
      await getCandidateApplicationDocument({
        documentId,

        authenticatedUserId:
          currentSession.userId,

        authenticatedSessionId:
          currentSession.sessionId,
      });

    assertDocumentOwnership(
      currentDocument,

      documentId,

      currentSession.userId,

      currentSession.countryCode
    );

    assertDocumentAvailable(
      currentDocument
    );

    if (
      currentDocument.storageKey !==
        downloaded.document.storageKey ||

      currentDocument.applicationId !==
        downloaded.document.applicationId ||

      currentDocument.type !==
        downloaded.document.type ||

      currentDocument.mimeType !==
        downloaded.document.mimeType ||

      currentDocument.sizeBytes !==
        downloaded.document.sizeBytes
    ) {
      throw new DocumentAccessError(
        "DOCUMENT_UNAVAILABLE",
        409
      );
    }

    /* --------------------------------------------------------
       STEP 14 — SECURE FILE RESPONSE
       -------------------------------------------------------- */

    return createDocumentResponse({
      document:
        currentDocument,

      content:
        downloaded.content,

      mimeType,

      mode,

      locale,
    });

  } catch (error: unknown) {
    return handleDocumentError(
      error,

      requestId,

      locale
    );
  }
}
