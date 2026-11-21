
import { NextRequest, NextResponse } from "next/server";

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
  isValidUuid,
  isApplicationDocumentType,
  validateDocumentUpload,
  MAX_DOCUMENT_SIZE_BYTES,
  type ApplicationLocale,
  type ApplicationCountry,
  type ApplicationDocumentType,
  type ApplicationErrorCode,
  type ValidationIssue,
} from "@/lib/applications/validation";

import {
  uploadCandidateApplicationDocument,
  deleteCandidateApplicationDocument,
} from "@/lib/applications/documents";

/* ============================================================
   FAHRSCHULE TAYM

   APPLICATION — DOCUMENT MANAGEMENT API

   File:
   src/app/api/dashboard/application/documents/route.ts

   Endpoints:
   POST   — Upload or replace a document
   DELETE — Delete a document from a draft

   Storage:
   Private Supabase Storage

   Database:
   PostgreSQL

   Countries:
   DE | AT | BE | IT | ES

   Languages:
   DE | AR | TR | ES

   Compatible:
   Desktop | Tablet | Mobile

   No additional layout.
   No additional navigation.
   No public document URL.
   ============================================================ */

/* ============================================================
   1. NEXT.JS CONFIGURATION
   ============================================================ */




/* ============================================================
   2. API CONFIGURATION
   ============================================================ */

const DOCUMENT_API_PATH =
  "/api/dashboard/application/documents";

const MAX_MULTIPART_OVERHEAD_BYTES =
  256 * 1024;

const MAX_UPLOAD_BODY_BYTES =
  MAX_DOCUMENT_SIZE_BYTES +
  MAX_MULTIPART_OVERHEAD_BYTES;

const MAX_DELETE_BODY_BYTES = 4096;

const MAX_MULTIPART_PARTS = 4;

const UPLOAD_TIMEOUT_MS = 30_000;

/* ============================================================
   3. ERROR TYPES
   ============================================================ */

type AdditionalErrorCode =
  | "APPLICATION_NOT_FOUND"
  | "DOCUMENT_NOT_FOUND"
  | "DOCUMENT_ACCESS_DENIED"
  | "DOCUMENT_UNAVAILABLE"
  | "FILE_REQUIRED"
  | "INVALID_MULTIPART"
  | "INVALID_JSON"
  | "FORBIDDEN_ORIGIN"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "REQUEST_TIMEOUT"
  | "UPLOAD_FAILED"
  | "DELETE_FAILED"
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
   4. DOCUMENT SERVICE CONTRACT

   Returned by documents.ts after
   successful storage and database writes.

   Never accept these values directly
   from browser-supplied metadata.
   ============================================================ */

type StoredDocumentRecord = {
  id: string;

  applicationId: string;

  userId: string;

  countryCode: ApplicationCountry;

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

  createdAt: string;

  updatedAt: string;
};

type DocumentUploadResult = {
  document: StoredDocumentRecord;

  replaced: boolean;
};

type DocumentDeleteResult = {
  documentId: string;

  applicationId: string;

  documentType: ApplicationDocumentType;

  deleted: true;
};

/* ============================================================
   5. PUBLIC DOCUMENT RESPONSE

   Never exposes:
   - storageKey
   - userId
   - Supabase credentials
   - public storage access
   ============================================================ */

type PublicDocument = {
  id: string;

  applicationId: string;

  type: ApplicationDocumentType;

  label: string;

  fileName: string;

  mimeType: string;

  sizeBytes: number;

  uploadStatus: StoredDocumentRecord["uploadStatus"];

  securityStatus: StoredDocumentRecord["securityStatus"];

  reviewStatus: StoredDocumentRecord["reviewStatus"];

  ready: boolean;

  previewUrl: string | null;

  downloadUrl: string | null;

  createdAt: string;

  updatedAt: string;
};

type UploadApiResponse = {
  success: true;

  data: {
    document: PublicDocument;

    replaced: boolean;

    message: string;
  };

  timestamp: string;
};

type DeleteApiResponse = {
  success: true;

  data: {
    documentId: string;

    applicationId: string;

    documentType: ApplicationDocumentType;

    deleted: true;

    message: string;
  };

  timestamp: string;
};

/* ============================================================
   6. SECURITY RESPONSE HEADERS
   ============================================================ */

const RESPONSE_HEADERS: Record<string, string> = {
  "Cache-Control":
    "private, no-store, no-cache, max-age=0, must-revalidate",

  Pragma: "no-cache",

  Expires: "0",

  Vary: "Cookie, Origin, Accept-Language",

  "X-Content-Type-Options": "nosniff",

  "X-Frame-Options": "DENY",

  "Cross-Origin-Resource-Policy": "same-origin",

  "Referrer-Policy": "no-referrer",

  "X-Robots-Tag":
    "noindex, nofollow, noarchive",
};

/* ============================================================
   7. MULTILINGUAL TRANSLATIONS
   ============================================================ */

type DocumentTranslations = {
  uploaded: string;

  replaced: string;

  deleted: string;

  processing: string;

  rejected: string;

  errors: Record<
    AdditionalErrorCode,
    string
  >;
};

const TRANSLATIONS: Record<
  ApplicationLocale,
  DocumentTranslations
> = {
  /* ========================================================
     GERMAN — DEFAULT LANGUAGE
     ======================================================== */

  de: {
    uploaded:
      "Das Dokument wurde erfolgreich hochgeladen.",

    replaced:
      "Das Dokument wurde erfolgreich ersetzt.",

    deleted:
      "Das Dokument wurde erfolgreich entfernt.",

    processing:
      "Das Dokument wurde hochgeladen und wird noch geprüft.",

    rejected:
      "Das Dokument hat die Sicherheitsprüfung nicht bestanden. Bitte ersetzen Sie es.",

    errors: {
      APPLICATION_NOT_FOUND:
        "Der Führerscheinantrag wurde nicht gefunden.",

      DOCUMENT_NOT_FOUND:
        "Das Dokument wurde nicht gefunden.",

      DOCUMENT_ACCESS_DENIED:
        "Sie haben keinen Zugriff auf dieses Dokument.",

      DOCUMENT_UNAVAILABLE:
        "Dieses Dokument ist derzeit nicht verfügbar.",

      FILE_REQUIRED:
        "Bitte wählen Sie eine Datei aus.",

      INVALID_MULTIPART:
        "Die hochgeladene Datei konnte nicht verarbeitet werden.",

      INVALID_JSON:
        "Die Anfrage konnte nicht verarbeitet werden.",

      FORBIDDEN_ORIGIN:
        "Diese Anfrage ist nicht erlaubt.",

      UNSUPPORTED_MEDIA_TYPE:
        "Das Anfrageformat wird nicht unterstützt.",

      PAYLOAD_TOO_LARGE:
        "Die hochgeladene Datei ist zu groß.",

      REQUEST_TIMEOUT:
        "Die Anfrage hat zu lange gedauert. Bitte versuchen Sie es erneut.",

      UPLOAD_FAILED:
        "Das Dokument konnte nicht hochgeladen werden.",

      DELETE_FAILED:
        "Das Dokument konnte nicht entfernt werden.",

      STORAGE_UNAVAILABLE:
        "Der Dokumentenspeicher ist vorübergehend nicht verfügbar.",

      SERVICE_UNAVAILABLE:
        "Der Dienst ist vorübergehend nicht verfügbar.",

      INTERNAL_ERROR:
        "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
    },
  },

  /* ========================================================
     ARABIC — RTL
     ======================================================== */

  ar: {
    uploaded:
      "تم رفع المستند بنجاح.",

    replaced:
      "تم استبدال المستند بنجاح.",

    deleted:
      "تم حذف المستند بنجاح.",

    processing:
      "تم رفع المستند وهو قيد الفحص.",

    rejected:
      "لم يجتز المستند فحص الأمان. يرجى استبداله.",

    errors: {
      APPLICATION_NOT_FOUND:
        "لم يتم العثور على طلب رخصة القيادة.",

      DOCUMENT_NOT_FOUND:
        "لم يتم العثور على المستند.",

      DOCUMENT_ACCESS_DENIED:
        "ليس لديك صلاحية الوصول إلى هذا المستند.",

      DOCUMENT_UNAVAILABLE:
        "هذا المستند غير متاح حالياً.",

      FILE_REQUIRED:
        "يرجى اختيار ملف.",

      INVALID_MULTIPART:
        "تعذر معالجة الملف المرفوع.",

      INVALID_JSON:
        "تعذر معالجة الطلب.",

      FORBIDDEN_ORIGIN:
        "هذا الطلب غير مسموح به.",

      UNSUPPORTED_MEDIA_TYPE:
        "تنسيق الطلب غير مدعوم.",

      PAYLOAD_TOO_LARGE:
        "حجم الملف المرفوع كبير جداً.",

      REQUEST_TIMEOUT:
        "استغرق الطلب وقتاً طويلاً. يرجى المحاولة مرة أخرى.",

      UPLOAD_FAILED:
        "تعذر رفع المستند.",

      DELETE_FAILED:
        "تعذر حذف المستند.",

      STORAGE_UNAVAILABLE:
        "خدمة تخزين المستندات غير متاحة مؤقتاً.",

      SERVICE_UNAVAILABLE:
        "الخدمة غير متاحة مؤقتاً.",

      INTERNAL_ERROR:
        "حدث خطأ. يرجى المحاولة مرة أخرى.",
    },
  },

  /* ========================================================
     TURKISH
     ======================================================== */

  tr: {
    uploaded:
      "Belge başarıyla yüklendi.",

    replaced:
      "Belge başarıyla değiştirildi.",

    deleted:
      "Belge başarıyla kaldırıldı.",

    processing:
      "Belge yüklendi ve kontrol ediliyor.",

    rejected:
      "Belge güvenlik kontrolünü geçemedi. Lütfen belgeyi değiştirin.",

    errors: {
      APPLICATION_NOT_FOUND:
        "Ehliyet başvurusu bulunamadı.",

      DOCUMENT_NOT_FOUND:
        "Belge bulunamadı.",

      DOCUMENT_ACCESS_DENIED:
        "Bu belgeye erişim izniniz yok.",

      DOCUMENT_UNAVAILABLE:
        "Bu belge şu anda kullanılamıyor.",

      FILE_REQUIRED:
        "Lütfen bir dosya seçin.",

      INVALID_MULTIPART:
        "Yüklenen dosya işlenemedi.",

      INVALID_JSON:
        "İstek işlenemedi.",

      FORBIDDEN_ORIGIN:
        "Bu isteğe izin verilmiyor.",

      UNSUPPORTED_MEDIA_TYPE:
        "İstek biçimi desteklenmiyor.",

      PAYLOAD_TOO_LARGE:
        "Yüklenen dosya çok büyük.",

      REQUEST_TIMEOUT:
        "İstek zaman aşımına uğradı. Lütfen tekrar deneyin.",

      UPLOAD_FAILED:
        "Belge yüklenemedi.",

      DELETE_FAILED:
        "Belge kaldırılamadı.",

      STORAGE_UNAVAILABLE:
        "Belge depolama hizmeti geçici olarak kullanılamıyor.",

      SERVICE_UNAVAILABLE:
        "Hizmet geçici olarak kullanılamıyor.",

      INTERNAL_ERROR:
        "Bir hata oluştu. Lütfen tekrar deneyin.",
    },
  },

  /* ========================================================
     SPANISH
     ======================================================== */

  es: {
    uploaded:
      "El documento se ha subido correctamente.",

    replaced:
      "El documento se ha sustituido correctamente.",

    deleted:
      "El documento se ha eliminado correctamente.",

    processing:
      "El documento se ha subido y está siendo comprobado.",

    rejected:
      "El documento no ha superado la comprobación de seguridad. Sustitúyalo.",

    errors: {
      APPLICATION_NOT_FOUND:
        "No se ha encontrado la solicitud de permiso de conducir.",

      DOCUMENT_NOT_FOUND:
        "No se ha encontrado el documento.",

      DOCUMENT_ACCESS_DENIED:
        "No tiene acceso a este documento.",

      DOCUMENT_UNAVAILABLE:
        "Este documento no está disponible actualmente.",

      FILE_REQUIRED:
        "Seleccione un archivo.",

      INVALID_MULTIPART:
        "No se pudo procesar el archivo subido.",

      INVALID_JSON:
        "No se pudo procesar la solicitud.",

      FORBIDDEN_ORIGIN:
        "Esta solicitud no está permitida.",

      UNSUPPORTED_MEDIA_TYPE:
        "El formato de la solicitud no es compatible.",

      PAYLOAD_TOO_LARGE:
        "El archivo subido es demasiado grande.",

      REQUEST_TIMEOUT:
        "La solicitud ha tardado demasiado. Inténtelo de nuevo.",

      UPLOAD_FAILED:
        "No se pudo subir el documento.",

      DELETE_FAILED:
        "No se pudo eliminar el documento.",

      STORAGE_UNAVAILABLE:
        "El almacenamiento de documentos no está disponible temporalmente.",

      SERVICE_UNAVAILABLE:
        "El servicio no está disponible temporalmente.",

      INTERNAL_ERROR:
        "Ha ocurrido un error. Inténtelo de nuevo.",
    },
  },
};

/* ============================================================
   8. API ERROR CLASS
   ============================================================ */

class DocumentRequestError extends Error {
  readonly code: DocumentApiErrorCode;

  readonly status: number;

  constructor(
    code: DocumentApiErrorCode,
    status = 400
  ) {
    super(code);

    this.name = "DocumentRequestError";

    this.code = code;

    this.status = status;

    Object.setPrototypeOf(
      this,
      DocumentRequestError.prototype
    );
  }
}

/* ============================================================
   9. LOCALIZED ERROR MESSAGES

   Reuses existing validation.ts messages.
   ============================================================ */

function getErrorMessage(
  code: DocumentApiErrorCode,
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
   10. JSON RESPONSE HELPERS
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

  code: DocumentApiErrorCode,

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
   11. REQUEST LANGUAGE

   Priority:
   - Interface query parameter
   - Existing language cookie
   - Browser language
   - German default
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

  const browserLocale =
    request.headers
      .get("accept-language")
      ?.split(",")[0]
      ?.split(";")[0];

  return normalizeApplicationLocale(
    browserLocale
  );
}

/* ============================================================
   12. AUTHORIZED WEBSITE ORIGINS
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
        process.env.NODE_ENV ===
          "production" &&

        url.protocol !== "https:"
      ) {
        throw new Error(
          "HTTPS required."
        );
      }

      origins.add(url.origin);

    } catch {
      throw new DocumentRequestError(
        "SERVICE_UNAVAILABLE",
        503
      );
    }

  } else if (
    process.env.NODE_ENV ===
    "production"
  ) {
    throw new DocumentRequestError(
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
   13. CSRF / ORIGIN PROTECTION

   Upload and deletion require
   an authorized website origin.
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
    throw new DocumentRequestError(
      "FORBIDDEN_ORIGIN",
      403
    );
  }

  let normalizedOrigin: string;

  try {
    normalizedOrigin =
      new URL(origin).origin;

  } catch {
    throw new DocumentRequestError(
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
    throw new DocumentRequestError(
      "FORBIDDEN_ORIGIN",
      403
    );
  }
}

/* ============================================================
   14. AUTHENTICATED CANDIDATE

   The actual user identity and country
   come exclusively from session.ts.

   No client-supplied userId, email
   or country is accepted.
   ============================================================ */

async function getAuthenticatedCandidate(
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
    throw new DocumentRequestError(
      "UNAUTHORIZED",
      401
    );
  }

  const countryCode =
    normalizeApplicationCountry(
      session.countryCode
    );

  if (!countryCode) {
    throw new DocumentRequestError(
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
   15. CONTENT LENGTH VALIDATION

   Checks declared size before
   reading the actual request body.
   ============================================================ */

function validateContentLength(
  request: NextRequest,

  maximumBytes: number
): void {
  const contentLength =
    request.headers.get(
      "content-length"
    );

  if (contentLength === null) {
    return;
  }

  if (!/^\d+$/.test(contentLength)) {
    throw new DocumentRequestError(
      "INVALID_INPUT"
    );
  }

  const length =
    Number(contentLength);

  if (
    !Number.isSafeInteger(length) ||

    length < 0
  ) {
    throw new DocumentRequestError(
      "INVALID_INPUT"
    );
  }

  if (
    length > maximumBytes
  ) {
    throw new DocumentRequestError(
      "PAYLOAD_TOO_LARGE",
      413
    );
  }
}

/* ============================================================
   16. LIMITED REQUEST BODY READER

   Enforces the actual received size,
   even when Content-Length is missing.

   Also protects against excessively
   slow request body reads.
   ============================================================ */

async function readLimitedBody(
  request: NextRequest,

  maximumBytes: number,

  timeoutMs: number
): Promise<ArrayBuffer> {
  validateContentLength(
    request,
    maximumBytes
  );

  if (!request.body) {
    throw new DocumentRequestError(
      "INVALID_INPUT"
    );
  }

  const reader =
    request.body.getReader();

  const chunks: Uint8Array[] = [];

  let totalBytes = 0;

  let timeoutId:
    | ReturnType<typeof setTimeout>
    | undefined;

  let cancelled = false;

  function cancelReader() {
    if (!cancelled) {
      cancelled = true;

      void reader.cancel().catch(
        () => undefined
      );
    }
  }

  const timeoutPromise =
    new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new DocumentRequestError(
            "REQUEST_TIMEOUT",
            408
          )
        );

        cancelReader();

      }, timeoutMs);
    });

  let abortHandler = () => {};

  const abortPromise =
    new Promise<never>((_, reject) => {
      abortHandler = () => {
        reject(
          new DocumentRequestError(
            "REQUEST_TIMEOUT",
            408
          )
        );

        cancelReader();
      };
    });

  if (request.signal.aborted) {
    abortHandler();
  } else {
    request.signal.addEventListener(
      "abort",
      abortHandler,
      { once: true }
    );
  }

  const readPromise =
    async (): Promise<ArrayBuffer> => {
      while (true) {
        const { done, value } =
          await reader.read();

        if (cancelled) {
          throw new DocumentRequestError(
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
          totalBytes > maximumBytes
        ) {
          throw new DocumentRequestError(
            "PAYLOAD_TOO_LARGE",
            413
          );
        }

        chunks.push(value);
      }

      const buffer =
        new ArrayBuffer(totalBytes);

      const output =
        new Uint8Array(buffer);

      let offset = 0;

      for (const chunk of chunks) {
        output.set(chunk, offset);

        offset += chunk.byteLength;
      }

      return buffer;
    };

  try {
    return await Promise.race([
      readPromise(),
      timeoutPromise,
      abortPromise,
    ]);

  } catch (error) {
    cancelReader();

    throw error;

  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    request.signal.removeEventListener(
      "abort",
      abortHandler
    );

    reader.releaseLock();
  }
}

/* ============================================================
   17. SECURE MULTIPART READING

   Used for browser FormData uploads.

   The complete request size is limited
   before parsing multipart content.

   Files remain in server memory only
   for the duration of processing.
   ============================================================ */

async function readMultipartBody(
  request: NextRequest
): Promise<FormData> {
  const contentType =
    request.headers.get(
      "content-type"
    );

  if (
    !contentType ||

    contentType
      .split(";")[0]
      .trim()
      .toLowerCase() !==
        "multipart/form-data"
  ) {
    throw new DocumentRequestError(
      "UNSUPPORTED_MEDIA_TYPE",
      415
    );
  }

  if (
    !/;\s*boundary=(?:"[^"]+"|[^;\s]+)/i
      .test(contentType)
  ) {
    throw new DocumentRequestError(
      "INVALID_MULTIPART"
    );
  }

  const body =
    await readLimitedBody(
      request,

      MAX_UPLOAD_BODY_BYTES,

      UPLOAD_TIMEOUT_MS
    );

  let formData: FormData;

  try {
    const multipartResponse =
      new Response(body, {
        headers: {
          "Content-Type": contentType,
        },
      });

    formData =
      await multipartResponse.formData();

  } catch {
    throw new DocumentRequestError(
      "INVALID_MULTIPART"
    );
  }

  let partCount = 0;

  const seenFields =
    new Set<string>();

  const allowedFields =
    new Set([
      "applicationId",
      "type",
      "file",
      "locale",
    ]);

  for (const [key] of formData.entries()) {
    partCount += 1;

    if (
      partCount > MAX_MULTIPART_PARTS ||

      !allowedFields.has(key) ||

      seenFields.has(key)
    ) {
      throw new DocumentRequestError(
        "INVALID_INPUT"
      );
    }

    seenFields.add(key);
  }

  return formData;
}

/* ============================================================
   18. UPLOAD REQUEST VALIDATION

   Expected FormData:

   applicationId: UUID
   type: document type
   file: actual File
   locale: de | ar | tr | es

   No userId.
   No countryCode.
   No storageKey.
   No security status.
   ============================================================ */

type UploadRequest = {
  applicationId: string;

  type: ApplicationDocumentType;

  file: File;
};

function validateUploadRequest(
  formData: FormData
): UploadRequest {
  const applicationId =
    formData.get("applicationId");

  const type =
    formData.get("type");

  const file =
    formData.get("file");

  if (
    !isValidUuid(applicationId)
  ) {
    throw new DocumentRequestError(
      "INVALID_INPUT"
    );
  }

  if (
    !isApplicationDocumentType(type)
  ) {
    throw new DocumentRequestError(
      "INVALID_DOCUMENT"
    );
  }

  if (
    file === null ||

    typeof file === "string" ||

    typeof file.arrayBuffer !==
      "function"
  ) {
    throw new DocumentRequestError(
      "FILE_REQUIRED"
    );
  }

  if (file.size === 0) {
    throw new DocumentRequestError(
      "INVALID_DOCUMENT"
    );
  }

  if (
    file.size >
      MAX_DOCUMENT_SIZE_BYTES
  ) {
    throw new DocumentRequestError(
      "PAYLOAD_TOO_LARGE",
      413
    );
  }

  return {
    applicationId:
      applicationId.toLowerCase(),

    type,

    file,
  };
}

/* ============================================================
   19. SECURE DELETE JSON READING
   ============================================================ */

async function readDeleteBody(
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
    throw new DocumentRequestError(
      "UNSUPPORTED_MEDIA_TYPE",
      415
    );
  }

  const body =
    await readLimitedBody(
      request,

      MAX_DELETE_BODY_BYTES,

      10_000
    );

  try {
    const text =
      new TextDecoder(
        "utf-8",

        { fatal: true }
      ).decode(body);

    return JSON.parse(text);

  } catch {
    throw new DocumentRequestError(
      "INVALID_JSON"
    );
  }
}

/* ============================================================
   20. DELETE REQUEST VALIDATION

   Expected JSON:

   {
     applicationId: "...",
     documentId: "...",
     locale: "de"
   }

   Only identifiers are accepted.

   The service determines ownership
   and the private storage object.
   ============================================================ */

type DeleteRequest = {
  applicationId: string;

  documentId: string;
};

function validateDeleteRequest(
  body: unknown
): DeleteRequest {
  if (
    !body ||

    typeof body !== "object" ||

    Array.isArray(body)
  ) {
    throw new DocumentRequestError(
      "INVALID_INPUT"
    );
  }

  const data =
    body as Record<string, unknown>;

  const allowedFields =
    new Set([
      "applicationId",
      "documentId",
      "locale",
    ]);

  if (
    Object.keys(data).some(
      (key) =>
        !allowedFields.has(key)
    )
  ) {
    throw new DocumentRequestError(
      "INVALID_INPUT"
    );
  }

  if (
    !isValidUuid(
      data.applicationId
    ) ||

    !isValidUuid(
      data.documentId
    )
  ) {
    throw new DocumentRequestError(
      "INVALID_INPUT"
    );
  }

  return {
    applicationId:
      data.applicationId.toLowerCase(),

    documentId:
      data.documentId.toLowerCase(),
  };
}

/* ============================================================
   21. FILE READINESS

   Uploaded does not mean approved.

   Unscanned uploads can be used; a previously
   rejected document remains unavailable.
   ============================================================ */

function isDocumentReady(
  document: StoredDocumentRecord
): boolean {
  return (
    document.uploadStatus ===
      "UPLOADED" &&

    document.securityStatus !==
      "REJECTED" &&

    document.reviewStatus !==
      "REJECTED"
  );
}

function isDocumentAccessible(
  document: StoredDocumentRecord
): boolean {
  return (
    document.uploadStatus ===
      "UPLOADED" &&

    document.securityStatus !==
      "REJECTED"
  );
}

/* ============================================================
   22. SECURE DOCUMENT API LINKS

   Uses existing [id]/route.ts.

   A link alone does not grant access.
   Every request requires authentication.
   ============================================================ */

function createDocumentLinks(
  document: StoredDocumentRecord,

  locale: ApplicationLocale
): {
  previewUrl: string | null;

  downloadUrl: string | null;
} {
  if (
    !isDocumentAccessible(document)
  ) {
    return {
      previewUrl: null,

      downloadUrl: null,
    };
  }

  const path =
    `${DOCUMENT_API_PATH}/${document.id}`;

  const previewSupported =
    document.mimeType ===
      "image/jpeg" ||

    document.mimeType ===
      "image/png";

  return {
    previewUrl:
      previewSupported
        ? `${path}?locale=${locale}`
        : null,

    downloadUrl:
      `${path}?download=1&locale=${locale}`,
  };
}

/* ============================================================
   23. PUBLIC DOCUMENT SERIALIZATION

   Private storage metadata is removed
   before returning JSON to the client.
   ============================================================ */

function toPublicDocument(
  document: StoredDocumentRecord,

  locale: ApplicationLocale
): PublicDocument {
  const links =
    createDocumentLinks(
      document,
      locale
    );

  return {
    id: document.id,

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
      isDocumentReady(document),

    previewUrl:
      links.previewUrl,

    downloadUrl:
      links.downloadUrl,

    createdAt:
      document.createdAt,

    updatedAt:
      document.updatedAt,
  };
}

/* ============================================================
   24. VERIFY SERVICE RESULT

   Additional defense against an
   unexpected or incorrect service result.
   ============================================================ */

function assertUploadResult(
  result: DocumentUploadResult,

  expected: {
    applicationId: string;

    userId: string;

    countryCode: ApplicationCountry;

    documentType: ApplicationDocumentType;
  }
): void {
  const document =
    result?.document;

  if (
    !document ||

    !isValidUuid(document.id) ||

    document.applicationId !==
      expected.applicationId ||

    document.userId !==
      expected.userId ||

    document.countryCode !==
      expected.countryCode ||

    document.type !==
      expected.documentType ||

    document.uploadStatus !==
      "UPLOADED" ||

    ![
      "PENDING",
      "CLEAN",
      "REJECTED",
    ].includes(
      document.securityStatus
    ) ||

    ![
      "PENDING",
      "APPROVED",
      "REJECTED",
    ].includes(
      document.reviewStatus
    ) ||

    typeof result.replaced !==
      "boolean"
  ) {
    throw new DocumentRequestError(
      "INTERNAL_ERROR",
      500
    );
  }
}

/* ============================================================
   25. SUCCESS MESSAGE
   ============================================================ */

function getUploadSuccessMessage(
  result: DocumentUploadResult,

  locale: ApplicationLocale
): string {
  const translations =
    TRANSLATIONS[locale];

  if (
    result.document.securityStatus ===
      "REJECTED"
  ) {
    return translations.rejected;
  }

  return result.replaced
    ? translations.replaced
    : translations.uploaded;
}

/* ============================================================
   26. TECHNICAL ERROR IDENTIFICATION
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
   27. DATABASE AVAILABILITY ERRORS
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
   28. DOCUMENT SERVICE ERRORS

   Expected business errors from
   src/lib/applications/documents.ts.
   ============================================================ */

function handleDocumentServiceError(
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

    case "DOCUMENT_NOT_FOUND":

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

    case "DOCUMENT_NOT_READY":

      return errorResponse(
        409,
        "DOCUMENT_NOT_READY",
        locale
      );

    case "DUPLICATE_DOCUMENT":

      return errorResponse(
        409,
        "DUPLICATE_DOCUMENT",
        locale
      );

    case "DOCUMENT_REJECTED":

      return errorResponse(
        422,
        "DOCUMENT_REJECTED",
        locale
      );

    case "TOO_MANY_DOCUMENTS":

      return errorResponse(
        409,
        "TOO_MANY_DOCUMENTS",
        locale
      );

    case "DOCUMENT_UNAVAILABLE":

      return errorResponse(
        409,
        "DOCUMENT_UNAVAILABLE",
        locale
      );

    case "UPLOAD_FAILED":

      return errorResponse(
        503,
        "UPLOAD_FAILED",
        locale
      );

    case "DELETE_FAILED":

      return errorResponse(
        503,
        "DELETE_FAILED",
        locale
      );

    case "STORAGE_UNAVAILABLE":

    case "STORAGE_UPLOAD_FAILED":

    case "STORAGE_DELETE_FAILED":

      return errorResponse(
        503,
        "STORAGE_UNAVAILABLE",
        locale
      );

    case "DATABASE_UNAVAILABLE":

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
   29. CENTRALIZED ERROR HANDLING

   Never logs:
   - original file contents
   - identity document information
   - residential address
   - bank statement information
   - signature
   - private storage keys
   - candidate session token
   ============================================================ */

function handleDocumentError(
  error: unknown,

  requestId: string,

  locale: ApplicationLocale
): NextResponse<ApiErrorResponse> {
  /* Authentication errors */

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

  /* Request errors */

  if (
    error instanceof DocumentRequestError
  ) {
    return errorResponse(
      error.status,

      error.code,

      locale
    );
  }

  /* Existing validation.ts errors */

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

  /* Document service errors */

  const serviceResponse =
    handleDocumentServiceError(
      error,
      locale
    );

  if (serviceResponse) {
    return serviceResponse;
  }

  /* PostgreSQL unavailable */

  if (
    isDatabaseUnavailable(error)
  ) {
    console.error(
      "[TAYM][DOCUMENTS][DATABASE]",

      {
        requestId,

        code:
          getTechnicalErrorCode(error),
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
    "[TAYM][DOCUMENTS][ERROR]",

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
   30. POST — UPLOAD OR REPLACE DOCUMENT

   Endpoint:
   POST /api/dashboard/application/documents

   Execution:

   1. Validate request origin.
   2. Authenticate candidate.
   3. Determine registered country.
   4. Read limited multipart body.
   5. Validate application identifier.
   6. Validate document category.
   7. Validate actual file.
   8. Recheck authenticated session.
   9. Call private document service.
   10. Save or replace document.
   11. Return protected document data.

   Service responsibilities:

   - Verify application ownership.
   - Verify application is DRAFT.
   - Recheck session and account.
   - Enforce document count.
   - Use private Supabase Storage.
   - Generate a unique storage key.
   - Validate document format and size.
   - Persist document metadata.
   - Coordinate concurrent uploads.
   - Replace old files safely.
   - Handle storage cleanup failures.

   Uploaded files must never be marked
   CLEAN solely from a MIME signature.
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
       STEP 1 — ORIGIN VALIDATION
       -------------------------------------------------------- */

    assertAllowedOrigin(request);

    /* --------------------------------------------------------
       STEP 2 — AUTHENTICATION
       -------------------------------------------------------- */

    const {
      session,
      countryCode,
    } =
      await getAuthenticatedCandidate(
        request
      );

    /* --------------------------------------------------------
       STEP 3 — MULTIPART REQUEST

       Maximum file size:
       10 MiB per document.
       -------------------------------------------------------- */

    const formData =
      await readMultipartBody(
        request
      );

    /* --------------------------------------------------------
       STEP 4 — CURRENT INTERFACE LANGUAGE
       -------------------------------------------------------- */

    const requestedLocale =
      formData.get("locale");

    if (
      requestedLocale !== null
    ) {
      if (
        typeof requestedLocale !==
          "string"
      ) {
        throw new DocumentRequestError(
          "INVALID_INPUT"
        );
      }

      locale =
        normalizeApplicationLocale(
          requestedLocale
        );
    }

    /* --------------------------------------------------------
       STEP 5 — UPLOAD INPUT
       -------------------------------------------------------- */

    const input =
      validateUploadRequest(
        formData
      );

    /* --------------------------------------------------------
       STEP 6 — READ ACTUAL FILE
       -------------------------------------------------------- */

    const content =
      new Uint8Array(
        await input.file.arrayBuffer()
      );

    /* --------------------------------------------------------
       STEP 7 — VALIDATE DOCUMENT

       Reuses validation.ts:
       - maximum file size
       - valid document type
       - safe file name
       - authorized MIME type
       - actual binary signature
       - matching file extension
       -------------------------------------------------------- */

    const validatedDocument =
      validateDocumentUpload(
        {
          type:
            input.type,

          fileName:
            input.file.name,

          mimeType:
            input.file.type,

          sizeBytes:
            input.file.size,

          content,
        },

        locale
      );

    /* --------------------------------------------------------
       STEP 8 — RECHECK SESSION

       Prevent processing after the
       session expired during an upload.
       -------------------------------------------------------- */

    const current =
      await getAuthenticatedCandidate(
        request
      );

    if (
      current.session.userId !==
        session.userId ||

      current.session.sessionId !==
        session.sessionId ||

      current.countryCode !==
        countryCode
    ) {
      throw new DocumentRequestError(
        "UNAUTHORIZED",
        401
      );
    }

    /* --------------------------------------------------------
       STEP 9 — REAL STORAGE SERVICE

       Replaces an existing core document
       of the same type when applicable.

       The service must serialize concurrent
       modifications of the same application.

       No arbitrary storage key accepted.
       -------------------------------------------------------- */

    const result: DocumentUploadResult =
      await uploadCandidateApplicationDocument({
        applicationId:
          input.applicationId,

        authenticatedUserId:
          current.session.userId,

        authenticatedSessionId:
          current.session.sessionId,

        document:
          validatedDocument,

        locale,
      });

    /* --------------------------------------------------------
       STEP 10 — VERIFY RETURNED RECORD
       -------------------------------------------------------- */

    assertUploadResult(
      result,

      {
        applicationId:
          input.applicationId,

        userId:
          current.session.userId,

        countryCode,

        documentType:
          input.type,
      }
    );

    /* --------------------------------------------------------
       STEP 11 — SAFE JSON RESPONSE

       The returned document does not
       contain any private storage key.
       -------------------------------------------------------- */

    return NextResponse.json<UploadApiResponse>(
      {
        success: true,

        data: {
          document:
            toPublicDocument(
              result.document,
              locale
            ),

          replaced:
            result.replaced,

          message:
            getUploadSuccessMessage(
              result,
              locale
            ),
        },

        timestamp:
          new Date().toISOString(),
      },

      {
        status:
          result.replaced
            ? 200
            : 201,

        headers:
          getResponseHeaders(locale),
      }
    );

  } catch (error: unknown) {
    return handleDocumentError(
      error,

      requestId,

      locale
    );
  }
}

/* ============================================================
   31. DELETE — REMOVE DOCUMENT

   Endpoint:
   DELETE /api/dashboard/application/documents

   Expected JSON:
   {
     applicationId,
     documentId,
     locale
   }

   Security:
   - authenticated candidate
   - document ownership
   - related application ownership
   - draft application only
   - no arbitrary file path
   - coordinated database/storage deletion
   - safe repeated requests

   A submitted application cannot be
   silently modified or have its
   documents removed by the candidate.
   ============================================================ */

export async function DELETE(
  request: NextRequest
): Promise<NextResponse> {
  const requestId =
    randomUUID();

  let locale =
    getRequestLocale(request);

  try {
    /* --------------------------------------------------------
       STEP 1 — ORIGIN VALIDATION
       -------------------------------------------------------- */

    assertAllowedOrigin(request);

    /* --------------------------------------------------------
       STEP 2 — AUTHENTICATED CANDIDATE
       -------------------------------------------------------- */

    const {
      session,
    } =
      await getAuthenticatedCandidate(
        request
      );

    /* --------------------------------------------------------
       STEP 3 — READ JSON
       -------------------------------------------------------- */

    const body =
      await readDeleteBody(
        request
      );

    /* --------------------------------------------------------
       STEP 4 — LANGUAGE
       -------------------------------------------------------- */

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

    /* --------------------------------------------------------
       STEP 5 — VALIDATE IDENTIFIERS
       -------------------------------------------------------- */

    const input =
      validateDeleteRequest(body);

    /* --------------------------------------------------------
       STEP 6 — DELETE REAL DOCUMENT

       The service must:

       1. Recheck current session.
       2. Lock application.
       3. Verify candidate owns it.
       4. Verify application is DRAFT.
       5. Verify document ownership.
       6. Prevent concurrent submission.
       7. Mark document logically deleted.
       8. Persist storage cleanup task.
       9. Complete database transaction.
       10. Attempt private storage cleanup.

       Logical deletion immediately blocks
       access through the [id] API.

       Physical deletion failures must
       remain recorded for retry.
       -------------------------------------------------------- */

    const result: DocumentDeleteResult =
      await deleteCandidateApplicationDocument({
        applicationId:
          input.applicationId,

        documentId:
          input.documentId,

        authenticatedUserId:
          session.userId,

        authenticatedSessionId:
          session.sessionId,

        locale,
      });

    /* --------------------------------------------------------
       STEP 7 — VERIFY DELETE RESULT
       -------------------------------------------------------- */

    if (
      !result ||

      result.deleted !== true ||

      result.documentId !==
        input.documentId ||

      result.applicationId !==
        input.applicationId ||

      !isApplicationDocumentType(
        result.documentType
      )
    ) {
      throw new DocumentRequestError(
        "INTERNAL_ERROR",
        500
      );
    }

    /* --------------------------------------------------------
       STEP 8 — SUCCESS RESPONSE
       -------------------------------------------------------- */

    return NextResponse.json<DeleteApiResponse>(
      {
        success: true,

        data: {
          documentId:
            result.documentId,

          applicationId:
            result.applicationId,

          documentType:
            result.documentType,

          deleted: true,

          message:
            TRANSLATIONS[locale].deleted,
        },

        timestamp:
          new Date().toISOString(),
      },

      {
        status: 200,

        headers:
          getResponseHeaders(locale),
      }
    );

  } catch (error: unknown) {
    return handleDocumentError(
      error,

      requestId,

      locale
    );
  }
}
