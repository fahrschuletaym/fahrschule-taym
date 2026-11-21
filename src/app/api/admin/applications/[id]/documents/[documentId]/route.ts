import { connection } from "next/server";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createHash,
} from "node:crypto";

import {
  constants as fsConstants,
} from "node:fs";

import {
  lstat,
  open,
  realpath,
  type FileHandle,
} from "node:fs/promises";

import path from "node:path";

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
      d.file_name,
      d.mime_type

    FROM taym_application_documents d

    INNER JOIN
      taym_driving_license_applications a
      ON a.id = d.application_id

    WHERE
      d.id = $1::uuid
      AND d.application_id = $2::uuid
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

async function getPrivateRoot(): Promise<string> {
  const configured =
    process.env.TAYM_PRIVATE_DOCUMENTS_DIR;

  if (
    !configured ||
    !path.isAbsolute(configured)
  ) {
    throw new Error(
      "PRIVATE_DOCUMENT_ROOT_NOT_CONFIGURED"
    );
  }

  const root = await realpath(configured);

  const stat = await lstat(root);

  if (!stat.isDirectory()) {
    throw new Error(
      "PRIVATE_DOCUMENT_ROOT_INVALID"
    );
  }

  return root;
}

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

async function resolvePrivateFile(
  root: string,
  storageKey: string
): Promise<string> {
  const segments =
    storageSegments(storageKey);

  const filePath =
    path.resolve(root, ...segments);

  const relative =
    path.relative(root, filePath);

  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new DocumentError(
      "DOCUMENT_UNAVAILABLE",
      404
    );
  }

  /*
   * Reject symbolic links in the
   * intermediate path components.
   */

  let current = root;

  for (
    let index = 0;
    index < segments.length - 1;
    index++
  ) {
    current = path.join(
      current,
      segments[index]
    );

    const stat = await lstat(current);

    if (
      stat.isSymbolicLink() ||
      !stat.isDirectory()
    ) {
      throw new DocumentError(
        "DOCUMENT_UNAVAILABLE",
        404
      );
    }
  }

  /*
   * Ensure final parent still resolves
   * within private root.
   */

  const parent = await realpath(
    path.dirname(filePath)
  );

  const parentRelative =
    path.relative(root, parent);

  if (
    parentRelative === ".." ||
    parentRelative.startsWith(
      `..${path.sep}`
    ) ||
    path.isAbsolute(parentRelative)
  ) {
    throw new DocumentError(
      "DOCUMENT_UNAVAILABLE",
      404
    );
  }

  return filePath;
}

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

async function loadPrivateDocument(
  document: DocumentRow
): Promise<LoadedDocument> {
  const root = await getPrivateRoot();

  const filePath = await resolvePrivateFile(
    root,
    document.storage_key
  );

  let handle: FileHandle | null = null;

  try {
    /*
     * Reject a final symbolic link
     * before opening the file.
     */

    const initialStat =
      await lstat(filePath);

    if (
      initialStat.isSymbolicLink() ||
      !initialStat.isFile()
    ) {
      throw new DocumentError(
        "DOCUMENT_UNAVAILABLE",
        404
      );
    }

    handle = await open(
      filePath,
      fsConstants.O_RDONLY |
        fsConstants.O_NOFOLLOW |
        fsConstants.O_NONBLOCK
    );

    /*
     * Verify the opened file itself,
     * not just the pathname.
     */

    const stat = await handle.stat();

    if (!stat.isFile()) {
      throw new DocumentError(
        "DOCUMENT_UNAVAILABLE",
        404
      );
    }

    if (stat.size <= 0) {
      throw new DocumentError(
        "DOCUMENT_UNAVAILABLE",
        404
      );
    }

    if (stat.size > MAX_FILE_BYTES) {
      throw new DocumentError(
        "DOCUMENT_TOO_LARGE",
        413
      );
    }

    /*
     * Allocate only after checking
     * the file's reported size.
     */

    const buffer = Buffer.alloc(
      stat.size
    );

    let total = 0;

    while (total < buffer.length) {
      const result = await handle.read(
        buffer,
        total,
        buffer.length - total,
        total
      );

      if (result.bytesRead === 0) {
        break;
      }

      total += result.bytesRead;
    }

    /*
     * A file truncated during reading
     * must not be served partially.
     */

    if (total !== buffer.length) {
      throw new DocumentError(
        "DOCUMENT_UNAVAILABLE",
        404
      );
    }

    /*
     * Detect a file modified between
     * initial size and final read.
     *
     * Deployment should additionally
     * keep uploaded objects immutable.
     */

    const finalStat =
      await handle.stat();

    if (
      !finalStat.isFile() ||
      finalStat.size !== stat.size ||
      finalStat.mtimeMs !== stat.mtimeMs
    ) {
      throw new DocumentError(
        "DOCUMENT_UNAVAILABLE",
        404
      );
    }

    const mimeType = validateMime(
      detectMimeType(buffer),
      document.mime_type
    );

    return {
      bytes: new Uint8Array(buffer),
      mimeType,
      fileName: safeFileName(
        document.id,
        mimeType
      ),
    };
  } catch (error) {
    if (error instanceof DocumentError) {
      throw error;
    }

    /*
     * Storage paths and operating
     * system errors must not be
     * exposed to the browser.
     */

    throw new DocumentError(
      "DOCUMENT_UNAVAILABLE",
      404
    );
  } finally {
    if (handle) {
      await handle.close().catch(() => {
        // File descriptor cleanup.
      });
    }
  }
}

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

    const file =
      await loadPrivateDocument(
        authorization.document
      );

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
