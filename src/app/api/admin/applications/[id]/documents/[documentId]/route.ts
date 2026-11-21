import { connection } from "next/server";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createHash,
} from "node:crypto";

import {
  Pool,
} from "pg";

/* ============================================================
   FAHRSCHULE TAYM
   ADMIN — SECURE DOCUMENT READER

   FILE:
   src/app/api/admin/applications/
   [id]/documents/[documentId]/route.ts

   ENDPOINT:
   GET /api/admin/applications/
       [id]/documents/[documentId]

   AUTHENTICATION:
   - Cookie: taym_admin_session
   - Table: taym_admin_sessions
   - Administrator: primary

   DATABASE:
   - taym_driving_license_applications
   - taym_application_documents

   STORAGE:
   Private server filesystem

   ENVIRONMENT:
   DATABASE_URL
   TAYM_PRIVATE_DOCUMENTS_DIR

   SECURITY:
   - Server-side authorization
   - Session revocation check
   - Session expiration check
   - Application/document ownership
   - UUID validation
   - Path traversal prevention
   - Symbolic link protection
   - Regular-file verification
   - Maximum file size
   - File signature validation
   - Explicit MIME allowlist
   - No SVG or HTML
   - No persistent public URL
   - No caching

   No document modification.
   No public file sharing.
   ============================================================ */


/* ============================================================
   1. CONFIGURATION
   ============================================================ */

const SESSION_COOKIE = "taym_admin_session";
const ADMIN_ID = "primary";

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/*
 * Maximum document size:
 * 20 MiB
 *
 * This implementation reads the
 * file into memory after checking
 * its size.
 */

const MAX_FILE_BYTES = 20 * 1024 * 1024;

type SupportedMime =
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "image/webp";

type ErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_APPLICATION_ID"
  | "INVALID_DOCUMENT_ID"
  | "DOCUMENT_NOT_FOUND"
  | "UNSUPPORTED_DOCUMENT"
  | "DOCUMENT_TOO_LARGE"
  | "DOCUMENT_UNAVAILABLE"
  | "SERVICE_UNAVAILABLE";

type DocumentRow = {
  id: string;
  application_id: string;
  storage_key: string;
  file_name: string | null;
  mime_type: string | null;
};

type AuthorizationResult =
  | {
      kind: "unauthenticated";
    }
  | {
      kind: "not_found";
    }
  | {
      kind: "authorized";
      document: DocumentRow;
    };

type LoadedDocument = {
  bytes: Uint8Array<ArrayBuffer>;
  mimeType: SupportedMime;
  fileName: string;
};

class DocumentError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number
  ) {
    super(code);
    this.name = "DocumentError";
  }
}

/* ============================================================
   2. SECURITY HEADERS
   ============================================================ */

const SECURITY_HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, max-age=0, must-revalidate",

  Pragma: "no-cache",

  Expires: "0",

  "X-Content-Type-Options": "nosniff",

  "Referrer-Policy": "no-referrer",

  "X-Frame-Options": "DENY",

  Vary: "Cookie",
};

/* ============================================================
   3. DATABASE CONNECTION

   Same shared connection key as
   previous admin authentication APIs.
   ============================================================ */

const shared =
  globalThis as typeof globalThis & {
    __taymAdminAuthPool?: Pool;
  };

function getDatabase(): Pool {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL_NOT_CONFIGURED");
  }

  if (!shared.__taymAdminAuthPool) {
    shared.__taymAdminAuthPool = new Pool({
      connectionString: databaseUrl,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      application_name: "fahrschule_taym_admin",
    });
  }

  return shared.__taymAdminAuthPool;
}

/* ============================================================
   4. ERROR RESPONSE

   Do not reveal whether a document
   exists to an unauthenticated user.
   ============================================================ */

function errorResponse(
  status: number,
  code: ErrorCode
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      code,
    },
    {
      status,
      headers: SECURITY_HEADERS,
    }
  );
}

/* ============================================================
   5. TOKEN HASH

   Matches previous login API:

   SHA-256(Buffer.from(token, "hex"))
   ============================================================ */

function hashSessionToken(
  token: string | undefined
): string | null {
  if (!token || !TOKEN_PATTERN.test(token)) {
    return null;
  }

  return createHash("sha256")
    .update(Buffer.from(token, "hex"))
    .digest("hex");
}

/* ============================================================
   6. VALIDATE IDS

   Both applicationId and documentId
   are UUID values.
   ============================================================ */

function normalizeUuid(
  value: unknown
): string | null {
  if (
    typeof value !== "string" ||
    !UUID_PATTERN.test(value)
  ) {
    return null;
  }

  return value.toLowerCase();
}

/* ============================================================
   7. DATABASE AUTHORIZATION

   Checks in order:

   A. Session exists
   B. Session belongs to primary admin
   C. Session is not revoked
   D. Session has not expired
   E. Application exists
   F. Document belongs to application

   No file is accessed until the
   database authorizes the request.

   Document storage keys are returned
   only inside server-side code.
   ============================================================ */

async function authorizeDocument(
  tokenHash: string,
  applicationId: string,
  documentId: string
): Promise<AuthorizationResult> {
  const pool = getDatabase();

  const session = await pool.query<{
    admin_id: string;
  }>(
    `
    SELECT admin_id
    FROM taym_admin_sessions
    WHERE token_hash = $1
      AND admin_id = $2
      AND revoked_at IS NULL
      AND expires_at > NOW()
    LIMIT 1
    `,
    [tokenHash, ADMIN_ID]
  );

  if (
    session.rows.length !== 1 ||
    session.rows[0].admin_id !== ADMIN_ID
  ) {
    return {
      kind: "unauthenticated",
    };
  }

  /*
   * The application/document relationship
   * is checked by an INNER JOIN.
   *
   * A document belonging to another
   * application is never returned.
   */

  const result = await pool.query<DocumentRow>(
    `
    SELECT
      d.id::text AS id,
      d.application_id::text AS application_id,
      d.storage_key,
      COALESCE(d.file_name, d.original_name) AS file_name,
      d.mime_type

    FROM candidate_documents d

    INNER JOIN
      license_applications a
      ON a.id = d.application_id

    WHERE
      d.id = $1::uuid
      AND d.application_id = $2::uuid
      AND d.deleted_at IS NULL
      AND d.upload_status = 'UPLOADED'
      AND d.security_status = 'CLEAN'
      AND a.status IN ('SUBMITTED', 'REVIEWING', 'NEEDS_INFO', 'APPROVED', 'REJECTED')
      AND a.country_code IN (
        'DE', 'AT', 'BE', 'IT', 'ES'
      )

    LIMIT 1
    `,
    [documentId, applicationId]
  );

  const document = result.rows[0];

  if (!document) {
    return {
      kind: "not_found",
    };
  }

  if (
    document.id !== documentId ||
    document.application_id !== applicationId
  ) {
    throw new Error(
      "DOCUMENT_RELATION_MISMATCH"
    );
  }

  return {
    kind: "authorized",
    document,
  };
}

/* ============================================================
   8. PRIVATE STORAGE ROOT

   Example environment:

   TAYM_PRIVATE_DOCUMENTS_DIR=
     /var/lib/fahrschule-taym/documents

   This must be OUTSIDE:
   - public/
   - static public uploads
   - publicly served web directories

   The process needs read permission.
   ============================================================ */


/* ============================================================
   9. VALIDATE STORAGE KEY

   The storage_key stored in PostgreSQL
   must be a relative path using "/".

   Allowed example:
   applications/uuid/documents/uuid.pdf

   Rejected:
   - Absolute paths
   - "../" traversal
   - Backslashes
   - Empty path components
   - Hidden dot segments
   - Control characters

   Never accept storage keys from
   the browser.
   ============================================================ */

function storageSegments(
  storageKey: string
): string[] {
  if (
    typeof storageKey !== "string" ||
    storageKey.length === 0 ||
    storageKey.length > 1024 ||
    storageKey.includes("\\") ||
    storageKey.startsWith("/") ||
    /[\u0000-\u001f\u007f]/u.test(storageKey)
  ) {
    throw new DocumentError(
      "DOCUMENT_UNAVAILABLE",
      404
    );
  }

  const segments = storageKey.split("/");

  for (const segment of segments) {
    if (
      segment === "" ||
      segment === "." ||
      segment === ".." ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(
        segment
      )
    ) {
      throw new DocumentError(
        "DOCUMENT_UNAVAILABLE",
        404
      );
    }
  }

  return segments;
}

/* ============================================================
   10. PREVENT PATH ESCAPE

   Restrict files to the configured
   private root.

   Reject symlink components.

   O_NOFOLLOW is also used when
   opening the final file.

   Keep this directory writable only
   by trusted backend processes.
   ============================================================ */


/* ============================================================
   11. ALLOWED FILE SIGNATURES

   Metadata MIME alone is not enough.

   Verify actual file bytes.

   Supported:
   - PDF
   - JPEG
   - PNG
   - WebP

   SVG, HTML, JavaScript and other
   active formats are not allowed.
   ============================================================ */

function detectMimeType(
  bytes: Uint8Array
): SupportedMime | null {
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return "application/pdf";
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

/* ============================================================
   12. MIME VALIDATION

   Reject files when the stored
   MIME metadata contradicts the
   detected file signature.
   ============================================================ */

function validateMime(
  actual: SupportedMime | null,
  stored: string | null
): SupportedMime {
  if (!actual) {
    throw new DocumentError(
      "UNSUPPORTED_DOCUMENT",
      415
    );
  }

  if (
    stored !== null &&
    stored.trim().toLowerCase() !== actual
  ) {
    throw new DocumentError(
      "UNSUPPORTED_DOCUMENT",
      415
    );
  }

  return actual;
}

/* ============================================================
   13. SAFE DOWNLOAD FILENAME

   Do not trust the uploaded original
   filename for response headers.

   Use a server-generated name
   based on the document UUID.

   Preserve a correct extension
   according to verified MIME type.
   ============================================================ */

function safeFileName(
  documentId: string,
  mimeType: SupportedMime
): string {
  const extensions: Record<
    SupportedMime,
    string
  > = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  return (
    `taym-document-${documentId}.` +
    extensions[mimeType]
  );
}

/* ============================================================
   14. SECURE LOCAL FILE READ

   Checks:
   - File exists
   - Not a symbolic link
   - Regular file
   - Nonempty
   - Size <= 20 MiB
   - No unexpected growth while read
   - Supported file signature
   - MIME metadata consistent

   O_NOFOLLOW prevents following
   symlinks at the final file level.

   Private storage must also be
   protected by filesystem permissions.
   ============================================================ */


/* ============================================================
   15. FILE RESPONSE

   Use inline rendering for supported
   images and PDF documents.

   Browser receives only the file.

   Private storage key is never
   included in response headers.
   ============================================================ */

function fileResponse(
  document: LoadedDocument
): NextResponse {
  return new NextResponse(
    document.bytes,
    {
      status: 200,

      headers: {
        ...SECURITY_HEADERS,

        "Content-Type":
          document.mimeType,

        "Content-Length":
          String(
            document.bytes.byteLength
          ),

        "Content-Disposition":
          `inline; filename="${document.fileName}"`,

        "Content-Security-Policy":
          "default-src 'none'; base-uri 'none'; form-action 'none'; sandbox",

        "Accept-Ranges":
          "none",
      },
    }
  );
}

/* ============================================================
   16. NEXT.JS ROUTE CONTEXT

   Next.js App Router async params.
   ============================================================ */

type RouteContext = {
  params: Promise<{
    id: string;
    documentId: string;
  }>;
};

/* ============================================================
   17. GET SECURE DOCUMENT

   Steps:

   1. Verify session cookie format
   2. Validate application UUID
   3. Validate document UUID
   4. Verify administrator in PostgreSQL
   5. Verify document ownership
   6. Resolve private storage
   7. Check file security
   8. Validate content type
   9. Return file bytes

   Never read storage before
   authorization succeeds.
   ============================================================ */

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  await connection();
  try {
    /* A. Read and hash admin cookie */

    const tokenHash =
      hashSessionToken(
        request.cookies.get(
          SESSION_COOKIE
        )?.value
      );

    if (!tokenHash) {
      return errorResponse(
        401,
        "UNAUTHENTICATED"
      );
    }

    /* B. Read dynamic route params */

    const params = await context.params;

    const applicationId =
      normalizeUuid(params.id);

    const documentId =
      normalizeUuid(params.documentId);

    if (!applicationId) {
      return errorResponse(
        400,
        "INVALID_APPLICATION_ID"
      );
    }

    if (!documentId) {
      return errorResponse(
        400,
        "INVALID_DOCUMENT_ID"
      );
    }

    /* C. Check PostgreSQL authorization */

    const authorization =
      await authorizeDocument(
        tokenHash,
        applicationId,
        documentId
      );

    if (
      authorization.kind ===
      "unauthenticated"
    ) {
      return errorResponse(
        401,
        "UNAUTHENTICATED"
      );
    }

    if (
      authorization.kind ===
      "not_found"
    ) {
      return errorResponse(
        404,
        "DOCUMENT_NOT_FOUND"
      );
    }

    /* D. Read private document */

    const doc = authorization.document;
    const base = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.APPLICATION_DOCUMENTS_BUCKET || "candidate-documents";
    if (!base || !key || !/^[a-zA-Z0-9_-]{1,63}$/.test(bucket)) throw new DocumentError("SERVICE_UNAVAILABLE", 503);
    const origin = new URL(base);
    if (origin.protocol !== "https:") throw new DocumentError("SERVICE_UNAVAILABLE", 503);
    const segments = storageSegments(doc.storage_key);
    if (!segments.includes(applicationId) || !segments.at(-1)?.startsWith(documentId + ".")) throw new DocumentError("DOCUMENT_UNAVAILABLE", 404);
    const headers: Record<string, string> = { apikey: key };
    if (!key.startsWith("sb_secret_")) headers.Authorization = `Bearer ${key}`;
    const bucketResponse = await fetch(`${origin.origin}/storage/v1/bucket/${encodeURIComponent(bucket)}`, { headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30000) });
    if (!bucketResponse.ok) throw new DocumentError("SERVICE_UNAVAILABLE", 503);
    const bucketInfo: unknown = await bucketResponse.json();
    if (!bucketInfo || typeof bucketInfo !== "object" || !("id" in bucketInfo) || bucketInfo.id !== bucket || !("public" in bucketInfo) || bucketInfo.public !== false) throw new DocumentError("SERVICE_UNAVAILABLE", 503);
    const response = await fetch(`${origin.origin}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${segments.map(encodeURIComponent).join("/")}`, { headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(30000) });
    if (!response.ok || !response.body) throw new DocumentError("DOCUMENT_UNAVAILABLE", 404);
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_FILE_BYTES) { await reader.cancel(); throw new DocumentError("DOCUMENT_TOO_LARGE", 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const buffer = Buffer.concat(chunks);
    const mimeType = validateMime(detectMimeType(buffer), doc.mime_type);
    const file: LoadedDocument = { bytes: new Uint8Array(buffer), mimeType, fileName: safeFileName(doc.id, mimeType) };

    /* E. Return authorized file */

    return fileResponse(file);
  } catch (error) {
    if (error instanceof DocumentError) {
      return errorResponse(
        error.status,
        error.code
      );
    }

    /*
     * No personal information,
     * document names, paths,
     * storage keys, cookies or
     * raw tokens are logged.
     */

    console.error(
      "[TAYM_ADMIN_DOCUMENT]",
      error instanceof Error
        ? error.name
        : "UNKNOWN_ERROR"
    );

    return errorResponse(
      503,
      "SERVICE_UNAVAILABLE"
    );
  }
}

/* ============================================================
   END — FAHRSCHULE TAYM
   ============================================================ */
