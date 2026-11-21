
import "server-only";

import {
  randomUUID,
  createHash,
} from "node:crypto";

import {
  Pool,
  type PoolClient,
} from "pg";

import {
  createConnection,
} from "node:net";

import {
  ApplicationValidationError,
  normalizeApplicationLocale,
  normalizeApplicationCountry,
  getApplicationErrorMessage,
  isValidUuid,
  isApplicationDocumentType,
  isAllowedDocumentMimeType,
  isValidDocumentSize,
  validateDocumentUpload,
  assertApplicationEditable,
  detectDocumentMimeType,
  REQUIRED_DOCUMENT_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_APPLICATION_DOCUMENTS,
  type ApplicationLocale,
  type ApplicationCountry,
  type ApplicationDocumentType,
  type ApplicationErrorCode,
  type ValidatedDocumentUpload,
  type TrustedApplicationDocument,
} from "@/lib/applications/validation";

/* ============================================================
   FAHRSCHULE TAYM

   File:
   src/lib/applications/documents.ts

   PRIVATE DOCUMENT MANAGEMENT SERVICE

   Database: PostgreSQL
   Storage: Supabase Storage
   Security scanner: Private ClamAV service

   Countries:
   DE | AT | BE | IT | ES

   Languages:
   DE | AR | TR | ES

   Supports:
   - Upload
   - Replacement
   - Secure download
   - Logical deletion
   - Physical storage cleanup
   - Persistent cleanup jobs
   - File integrity verification
   - Candidate ownership validation
   - Transactional application locking

   No public storage URLs.
   No client-side secrets.
   ============================================================ */

/* ============================================================
   1. CONFIGURATION
   ============================================================ */

const DEFAULT_STORAGE_BUCKET =
  "candidate-documents";

const STORAGE_TIMEOUT_MS = 30_000;

const SCAN_TIMEOUT_MS = 30_000;

const MAX_SCAN_RESPONSE_BYTES = 4096;

const SCAN_CHUNK_BYTES = 64 * 1024;

const CLEANUP_BATCH_SIZE = 10;

const MAX_CLEANUP_BATCH_SIZE = 50;

const ORPHAN_CLEANUP_DELAY_MINUTES = 15;

const CLEANUP_RETRY_DELAY_SECONDS = 300;

/* ============================================================
   2. TYPES
   ============================================================ */

export type StoredApplicationDocument =
  TrustedApplicationDocument & {
    countryCode: ApplicationCountry;

    createdAt: string;

    updatedAt: string;
  };

export type UploadCandidateDocumentInput = {
  applicationId: string;

  authenticatedUserId: string;

  authenticatedSessionId: string;

  document: ValidatedDocumentUpload;

  locale?: ApplicationLocale;
};

export type UploadCandidateDocumentResult = {
  document: StoredApplicationDocument;

  replaced: boolean;
};

export type DeleteCandidateDocumentInput = {
  applicationId: string;

  documentId: string;

  authenticatedUserId: string;

  authenticatedSessionId: string;

  locale?: ApplicationLocale;
};

export type DeleteCandidateDocumentResult = {
  documentId: string;

  applicationId: string;

  documentType: ApplicationDocumentType;

  deleted: true;
};

export type CandidateDocumentAccessInput = {
  documentId: string;

  authenticatedUserId: string;

  authenticatedSessionId: string;
};

export type DownloadCandidateDocumentInput =
  CandidateDocumentAccessInput & {
    maxBytes?: number;
  };

export type DownloadCandidateDocumentResult = {
  document: StoredApplicationDocument;

  content: Uint8Array;
};

type CandidateDatabaseRecord = {
  user_id: string;

  country_code: string;
};

type ApplicationDatabaseRecord = {
  id: string;

  user_id: string;

  country_code: string;

  status: string;
};

type DocumentDatabaseRecord = {
  id: string;

  application_id: string;

  user_id: string;

  country_code: string;

  type: ApplicationDocumentType;

  storage_key: string;

  file_name: string;

  mime_type: string;

  size_bytes: number | string;

  sha256_hash: string;

  upload_status:
    TrustedApplicationDocument["uploadStatus"];

  security_status:
    TrustedApplicationDocument["securityStatus"];

  review_status:
    TrustedApplicationDocument["reviewStatus"];

  created_at: Date | string;

  updated_at: Date | string;
};

type StorageConfiguration = {
  url: string;

  serviceRoleKey: string;

  bucket: string;
};

type CleanupJob = {
  id: string;

  bucket: string;

  storage_key: string;
};

/* ============================================================
   3. SERVICE ERROR
   ============================================================ */

export type DocumentServiceErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_SESSION"
  | "ACCOUNT_UNAVAILABLE"
  | "UNSUPPORTED_COUNTRY"
  | "APPLICATION_NOT_FOUND"
  | "INVALID_APPLICATION_STATE"
  | "DOCUMENT_NOT_FOUND"
  | "DOCUMENT_NOT_READY"
  | "DOCUMENT_REJECTED"
  | "DOCUMENT_UNAVAILABLE"
  | "DOCUMENT_ACCESS_DENIED"
  | "TOO_MANY_DOCUMENTS"
  | "DUPLICATE_DOCUMENT"
  | "UPLOAD_FAILED"
  | "DELETE_FAILED"
  | "STORAGE_UNAVAILABLE"
  | "STORAGE_UPLOAD_FAILED"
  | "STORAGE_DOWNLOAD_FAILED"
  | "STORAGE_DELETE_FAILED"
  | "DATABASE_UNAVAILABLE"
  | "SERVICE_UNAVAILABLE";

export class ApplicationDocumentError
  extends Error {
  readonly code: DocumentServiceErrorCode;

  readonly status: number;

  constructor(
    code: DocumentServiceErrorCode,
    status = 400
  ) {
    super(code);

    this.name =
      "ApplicationDocumentError";

    this.code = code;

    this.status = status;
  }
}

/* ============================================================
   4. LOCALIZED VALIDATION ERRORS

   Reuses our existing four-language
   validation service.
   ============================================================ */

function throwValidationError(
  code: ApplicationErrorCode,

  field: string,

  locale: ApplicationLocale,

  status = 400
): never {
  throw new ApplicationValidationError(
    [
      {
        code,

        field,

        message:
          getApplicationErrorMessage(
            code,
            locale
          ),
      },
    ],

    status
  );
}

/* ============================================================
   5. SHARED POSTGRESQL CONNECTION
   ============================================================ */

const globalForDocuments =
  globalThis as typeof globalThis & {
    taymResendPool?: Pool;
  };

function getDatabasePool(): Pool {
  if (
    globalForDocuments.taymResendPool
  ) {
    return globalForDocuments.taymResendPool;
  }

  const databaseUrl =
    process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new ApplicationDocumentError(
      "DATABASE_UNAVAILABLE",
      503
    );
  }

  const pool = new Pool({
    connectionString: databaseUrl,

    max: 5,

    min: 0,

    idleTimeoutMillis: 30_000,

    connectionTimeoutMillis: 10_000,

    allowExitOnIdle: false,
  });

  pool.on("error", () => {
    console.error(
      "[TAYM][DOCUMENTS][DATABASE_POOL]"
    );
  });

  globalForDocuments.taymResendPool =
    pool;

  return pool;
}

/* ============================================================
   6. DATABASE TRANSACTION
   ============================================================ */

async function withTransaction<T>(
  callback: (
    client: PoolClient
  ) => Promise<T>
): Promise<T> {
  const pool =
    getDatabasePool();

  const client =
    await pool.connect();

  let destroyConnection = false;

  try {
    await client.query("BEGIN");

    await client.query(
      "SET LOCAL lock_timeout = '10s'"
    );

    await client.query(
      "SET LOCAL statement_timeout = '30s'"
    );

    const result =
      await callback(client);

    await client.query("COMMIT");

    return result;

  } catch (error: unknown) {
    try {
      await client.query("ROLLBACK");

    } catch {
      destroyConnection = true;
    }

    throw error;

  } finally {
    client.release(destroyConnection);
  }
}

/* ============================================================
   7. SUPABASE STORAGE CONFIGURATION

   SUPABASE_SERVICE_ROLE_KEY must
   remain server-only.
   ============================================================ */

function getStorageConfiguration():
  StorageConfiguration {
  const rawUrl =
    process.env.SUPABASE_URL?.trim() ||

    process.env.NEXT_PUBLIC_SUPABASE_URL
      ?.trim();

  const serviceRoleKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  const bucket =
    process.env
      .APPLICATION_DOCUMENTS_BUCKET
      ?.trim() ||

    DEFAULT_STORAGE_BUCKET;

  if (
    !rawUrl ||
    !serviceRoleKey ||

    !/^[a-zA-Z0-9_-]{1,63}$/.test(
      bucket
    )
  ) {
    throw new ApplicationDocumentError(
      "STORAGE_UNAVAILABLE",
      503
    );
  }

  let url: URL;

  try {
    url = new URL(rawUrl);

  } catch {
    throw new ApplicationDocumentError(
      "STORAGE_UNAVAILABLE",
      503
    );
  }

  if (
    url.protocol !== "https:" ||

    url.username ||

    url.password ||

    url.search ||

    url.hash
  ) {
    throw new ApplicationDocumentError(
      "STORAGE_UNAVAILABLE",
      503
    );
  }

  return {
    url: url.origin,

    serviceRoleKey,

    bucket,
  };
}

/* ============================================================
   8. SERVER-SIDE STORAGE HEADERS
   ============================================================ */

function getStorageHeaders(
  config: StorageConfiguration
): Record<string, string> {
  return {
    apikey: config.serviceRoleKey,
    ...(config.serviceRoleKey.startsWith("sb_secret_")
      ? {}
      : { Authorization: `Bearer ${config.serviceRoleKey}` }),
  };
}

/* ============================================================
   9. VERIFY PRIVATE BUCKET

   An accidentally public bucket
   must never receive identity files.
   ============================================================ */

async function assertPrivateStorageBucket(
  config: StorageConfiguration
): Promise<void> {
  try {
    const response = await fetch(
      `${config.url}/storage/v1/bucket/${encodeURIComponent(config.bucket)}`,

      {
        method: "GET",

        cache: "no-store",

        redirect: "error",

        headers:
          getStorageHeaders(config),

        signal:
          AbortSignal.timeout(
            STORAGE_TIMEOUT_MS
          ),
      }
    );

    if (!response.ok) {
      throw new Error(
        "Bucket unavailable"
      );
    }

    const bucket =
      await response.json() as {
        id?: string;

        public?: boolean;
      };

    if (
      bucket.id !== config.bucket ||

      bucket.public !== false
    ) {
      throw new Error(
        "Private bucket required"
      );
    }

  } catch {
    throw new ApplicationDocumentError(
      "STORAGE_UNAVAILABLE",
      503
    );
  }
}

/* ============================================================
   10. SESSION AND CANDIDATE VALIDATION

   Every operation rechecks the actual
   PostgreSQL session.

   User IDs and session IDs must have
   been obtained from requireCandidateSession().
   ============================================================ */

async function requireActiveCandidate(
  client: PoolClient,

  userId: string,

  sessionId: string,

  lock = false
): Promise<{
  userId: string;

  countryCode: ApplicationCountry;
}> {
  if (
    !isValidUuid(userId) ||

    !isValidUuid(sessionId)
  ) {
    throw new ApplicationDocumentError(
      "UNAUTHORIZED",
      401
    );
  }

  const result =
    await client.query<CandidateDatabaseRecord>(
      `
        SELECT
          u.id AS user_id,

          u.country_code

        FROM users AS u

        INNER JOIN user_sessions AS s
          ON s.user_id = u.id

        WHERE u.id = $1::uuid

          AND s.id = $2::uuid

          AND s.revoked_at IS NULL

          AND s.expires_at > NOW()

          AND u.role = 'CANDIDATE'

          AND u.status = 'ACTIVE'

          AND u.email_verified_at IS NOT NULL


        LIMIT 1

        ${lock ? "FOR UPDATE OF u, s" : ""}
      `,

      [
        userId,

        sessionId,
      ]
    );

  const candidate =
    result.rows[0];

  if (!candidate) {
    throw new ApplicationDocumentError(
      "UNAUTHORIZED",
      401
    );
  }

  const countryCode =
    normalizeApplicationCountry(
      candidate.country_code
    );

  if (!countryCode) {
    throw new ApplicationDocumentError(
      "UNSUPPORTED_COUNTRY",
      403
    );
  }

  return {
    userId:
      candidate.user_id,

    countryCode,
  };
}

/* ============================================================
   11. APPLICATION OWNERSHIP

   Locks the application before
   uploading, replacing or deleting.

   application.ts must use the same
   locking order:
   candidate -> application -> documents
   ============================================================ */

async function requireOwnedApplication(
  client: PoolClient,

  applicationId: string,

  userId: string,

  countryCode: ApplicationCountry,

  lock = false
): Promise<ApplicationDatabaseRecord> {
  if (!isValidUuid(applicationId)) {
    throw new ApplicationDocumentError(
      "APPLICATION_NOT_FOUND",
      404
    );
  }

  const result =
    await client.query<ApplicationDatabaseRecord>(
      `
        SELECT
          id,

          user_id,

          country_code,

          status

        FROM license_applications

        WHERE id = $1::uuid

          AND user_id = $2::uuid

          AND country_code = $3

        LIMIT 1

        ${lock ? "FOR UPDATE" : ""}
      `,

      [
        applicationId,

        userId,

        countryCode,
      ]
    );

  const application =
    result.rows[0];

  if (!application) {
    throw new ApplicationDocumentError(
      "APPLICATION_NOT_FOUND",
      404
    );
  }

  return application;
}

/* ============================================================
   12. DATE SERIALIZATION
   ============================================================ */

function toIsoDate(
  value: Date | string
): string {
  const date =
    value instanceof Date

      ? value

      : new Date(value);

  if (
    !Number.isFinite(date.getTime())
  ) {
    throw new ApplicationDocumentError(
      "DOCUMENT_UNAVAILABLE",
      409
    );
  }

  return date.toISOString();
}

/* ============================================================
   13. DATABASE DOCUMENT MAPPING
   ============================================================ */

function mapDocument(
  row: DocumentDatabaseRecord
): StoredApplicationDocument {
  const countryCode =
    normalizeApplicationCountry(
      row.country_code
    );

  const sizeBytes =
    Number(row.size_bytes);

  if (
    !countryCode ||

    !isApplicationDocumentType(
      row.type
    ) ||

    !isValidUuid(row.id) ||

    !isValidUuid(row.application_id) ||

    !isValidUuid(row.user_id) ||

    !isValidDocumentSize(sizeBytes) ||

    !isAllowedDocumentMimeType(
      row.type,
      row.mime_type
    )
  ) {
    throw new ApplicationDocumentError(
      "DOCUMENT_UNAVAILABLE",
      409
    );
  }

  return {
    id: row.id,

    applicationId:
      row.application_id,

    userId:
      row.user_id,

    countryCode,

    type: row.type,

    storageKey:
      row.storage_key,

    fileName:
      row.file_name,

    mimeType:
      row.mime_type,

    sizeBytes,

    uploadStatus:
      row.upload_status,

    securityStatus:
      row.security_status,

    reviewStatus:
      row.review_status,

    createdAt:
      toIsoDate(row.created_at),

    updatedAt:
      toIsoDate(row.updated_at),
  };
}

/* ============================================================
   14. SECURE STORAGE KEY

   Original filenames are never used
   as storage paths.

   Each file receives a unique UUID.
   Existing files are never overwritten.
   ============================================================ */

function getFileExtension(
  mimeType: string
): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";

    case "image/png":
      return "png";

    case "application/pdf":
      return "pdf";

    default:
      throw new ApplicationDocumentError(
        "DOCUMENT_UNAVAILABLE",
        409
      );
  }
}

function createStorageKey({
  countryCode,

  userId,

  applicationId,

  documentId,

  documentType,

  mimeType,
}: {
  countryCode: ApplicationCountry;

  userId: string;

  applicationId: string;

  documentId: string;

  documentType: ApplicationDocumentType;

  mimeType: string;
}): string {
  return [
    countryCode.toLowerCase(),

    userId.toLowerCase(),

    applicationId.toLowerCase(),

    documentType.toLowerCase(),

    `${documentId}.${getFileExtension(mimeType)}`,
  ].join("/");
}

/* ============================================================
   15. STORAGE PATH VALIDATION
   ============================================================ */

function validateStorageKey(
  key: string
): void {
  if (
    typeof key !== "string" ||

    key.length === 0 ||

    key.length > 500 ||

    key.startsWith("/") ||

    key.includes("..") ||

    key.includes("\\") ||

    key.includes("//") ||

    !/^[a-zA-Z0-9/_\-.]+$/.test(key)
  ) {
    throw new ApplicationDocumentError(
      "DOCUMENT_UNAVAILABLE",
      409
    );
  }
}

function encodeStorageKey(
  key: string
): string {
  validateStorageKey(key);

  return key
    .split("/")
    .map(encodeURIComponent)
    .join("/");
}

function assertDocumentStorageKey(
  document: StoredApplicationDocument
): void {
  const expectedKey =
    createStorageKey({
      countryCode:
        document.countryCode,

      userId:
        document.userId,

      applicationId:
        document.applicationId,

      documentId:
        document.id,

      documentType:
        document.type,

      mimeType:
        document.mimeType,
    });

  if (
    document.storageKey !== expectedKey
  ) {
    throw new ApplicationDocumentError(
      "DOCUMENT_UNAVAILABLE",
      409
    );
  }
}

/* ============================================================
   16. FILE INTEGRITY HASH

   Detects any unexpected modification
   of the stored binary content.
   ============================================================ */

function calculateFileHash(
  content: Uint8Array
): string {
  return createHash("sha256")
    .update(content)
    .digest("hex");
}

/* ============================================================
   17. CLAMAV SECURITY SCANNER

   Real malware scan using the
   ClamAV INSTREAM protocol.

   The scanner must be deployed on
   a private trusted network.

   Never expose its TCP port publicly.

   If the scanner is unavailable,
   the upload is rejected temporarily.

   No fake CLEAN status.
   ============================================================ */

async function scanDocumentContent(
  content: Uint8Array
): Promise<"CLEAN" | "REJECTED"> {
  const host =
    process.env.CLAMAV_HOST?.trim();

  const port =
    Number(
      process.env.CLAMAV_PORT || "3310"
    );

  if (
    !host ||

    !Number.isInteger(port) ||

    port < 1 ||

    port > 65535
  ) {
    throw new ApplicationDocumentError(
      "SERVICE_UNAVAILABLE",
      503
    );
  }

  if (
    !isValidDocumentSize(
      content.byteLength
    )
  ) {
    throw new ApplicationDocumentError(
      "DOCUMENT_UNAVAILABLE",
      409
    );
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    let response =
      Buffer.alloc(0);

    const socket =
      createConnection({
        host,
        port,
      });

    const timer = setTimeout(() => {
      finishError();
    }, SCAN_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timer);

      socket.destroy();
    }

    function finishError() {
      if (settled) {
        return;
      }

      settled = true;

      cleanup();

      reject(
        new ApplicationDocumentError(
          "SERVICE_UNAVAILABLE",
          503
        )
      );
    }

    function finishSuccess(
      result: "CLEAN" | "REJECTED"
    ) {
      if (settled) {
        return;
      }

      settled = true;

      cleanup();

      resolve(result);
    }

    socket.on("error", finishError);

    socket.on("end", () => {
      if (!settled) {
        finishError();
      }
    });

    socket.on("close", () => {
      if (!settled) {
        finishError();
      }
    });

    socket.on("data", (chunk: Buffer) => {
      if (
        response.length + chunk.length >
          MAX_SCAN_RESPONSE_BYTES
      ) {
        finishError();

        return;
      }

      response =
        Buffer.concat([
          response,
          chunk,
        ]);

      const separator =
        response.indexOf(0);

      if (separator === -1) {
        return;
      }

      const message =
        response
          .subarray(0, separator)
          .toString("utf8")
          .trim();

      if (
        message === "stream: OK"
      ) {
        finishSuccess("CLEAN");

        return;
      }

      if (
        /^stream: .+ FOUND$/.test(message)
      ) {
        finishSuccess("REJECTED");

        return;
      }

      finishError();
    });

    socket.once("connect", () => {
      socket.setNoDelay(true);

      /*
       * INSTREAM command terminated
       * with a null byte.
       */

      socket.write(
        Buffer.from(
          "zINSTREAM\0",
          "ascii"
        )
      );

      let offset = 0;

      function writeNextChunk() {
        if (
          settled ||
          socket.destroyed
        ) {
          return;
        }

        while (
          offset < content.byteLength
        ) {
          const end =
            Math.min(
              offset + SCAN_CHUNK_BYTES,

              content.byteLength
            );

          const chunk =
            content.subarray(
              offset,
              end
            );

          const length =
            Buffer.alloc(4);

          length.writeUInt32BE(
            chunk.byteLength,
            0
          );

          const packet =
            Buffer.concat([
              length,

              Buffer.from(chunk),
            ]);

          offset = end;

          const writable =
            socket.write(packet);

          if (!writable) {
            socket.once(
              "drain",

              writeNextChunk
            );

            return;
          }
        }

        /*
         * A zero-length chunk marks
         * the end of the stream.
         */

        socket.write(
          Buffer.alloc(4)
        );
      }

      writeNextChunk();
    });
  });
}

/* ============================================================
   18. SUPABASE PRIVATE FILE UPLOAD

   Uses a new unique object key.
   Upsert is deliberately disabled.
   ============================================================ */

async function uploadStorageObject({
  config,

  storageKey,

  content,

  mimeType,
}: {
  config: StorageConfiguration;

  storageKey: string;

  content: Uint8Array;

  mimeType: string;
}): Promise<void> {
  const url =
    `${config.url}/storage/v1/object/` +

    `${encodeURIComponent(config.bucket)}/` +

    encodeStorageKey(storageKey);

  const buffer =
    new ArrayBuffer(
      content.byteLength
    );

  new Uint8Array(buffer)
    .set(content);

  try {
    const response =
      await fetch(url, {
        method: "POST",

        cache: "no-store",

        redirect: "error",

        headers: {
          ...getStorageHeaders(config),

          "Content-Type": mimeType,

          "Cache-Control": "no-store",

          "x-upsert": "false",
        },

        body: buffer,

        signal:
          AbortSignal.timeout(
            STORAGE_TIMEOUT_MS
          ),
      });

    if (!response.ok) {
      throw new Error(
        "Storage upload failed"
      );
    }

    await response.body?.cancel();

  } catch {
    throw new ApplicationDocumentError(
      "STORAGE_UPLOAD_FAILED",
      503
    );
  }
}

/* ============================================================
   19. LIMITED STORAGE RESPONSE READER

   Enforces the actual file size while
   reading the Supabase response.
   ============================================================ */

async function readStorageResponse(
  response: Response,

  maxBytes: number
): Promise<Uint8Array> {
  const contentLength =
    response.headers.get(
      "content-length"
    );

  if (
    contentLength !== null
  ) {
    const length =
      Number(contentLength);

    if (
      !Number.isSafeInteger(length) ||

      length < 1 ||

      length > maxBytes
    ) {
      await response.body
        ?.cancel()
        .catch(() => undefined);

      throw new ApplicationDocumentError(
        "DOCUMENT_UNAVAILABLE",
        409
      );
    }
  }

  if (!response.body) {
    throw new ApplicationDocumentError(
      "DOCUMENT_UNAVAILABLE",
      409
    );
  }

  const reader =
    response.body.getReader();

  const chunks: Uint8Array[] = [];

  let total = 0;

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

      total += value.byteLength;

      if (total > maxBytes) {
        throw new ApplicationDocumentError(
          "DOCUMENT_UNAVAILABLE",
          409
        );
      }

      chunks.push(value);
    }

    if (total === 0) {
      throw new ApplicationDocumentError(
        "DOCUMENT_UNAVAILABLE",
        409
      );
    }

    const content =
      new Uint8Array(total);

    let offset = 0;

    for (const chunk of chunks) {
      content.set(
        chunk,
        offset
      );

      offset += chunk.byteLength;
    }

    return content;

  } catch (error) {
    await reader.cancel()
      .catch(() => undefined);

    throw error;

  } finally {
    reader.releaseLock();
  }
}

/* ============================================================
   20. PRIVATE STORAGE DOWNLOAD
   ============================================================ */

async function downloadStorageObject({
  config,

  storageKey,

  maxBytes,
}: {
  config: StorageConfiguration;

  storageKey: string;

  maxBytes: number;
}): Promise<Uint8Array> {
  const url =
    `${config.url}/storage/v1/object/authenticated/` +

    `${encodeURIComponent(config.bucket)}/` +

    encodeStorageKey(storageKey);

  try {
    const response =
      await fetch(url, {
        method: "GET",

        cache: "no-store",

        redirect: "error",

        headers: {
          ...getStorageHeaders(config),

          Accept:
            "application/octet-stream",
        },

        signal:
          AbortSignal.timeout(
            STORAGE_TIMEOUT_MS
          ),
      });

    if (!response.ok) {
      throw new ApplicationDocumentError(
        "STORAGE_DOWNLOAD_FAILED",
        503
      );
    }

    return await readStorageResponse(
      response,

      maxBytes
    );

  } catch (error: unknown) {
    if (
      error instanceof
        ApplicationDocumentError
    ) {
      throw error;
    }

    throw new ApplicationDocumentError(
      "STORAGE_DOWNLOAD_FAILED",
      503
    );
  }
}

/* ============================================================
   21. PHYSICAL STORAGE DELETION

   Storage deletion is idempotent.

   Never delete an arbitrary browser
   supplied path.
   ============================================================ */

async function deleteStorageObject({
  config,

  storageKey,
}: {
  config: StorageConfiguration;

  storageKey: string;
}): Promise<void> {
  validateStorageKey(
    storageKey
  );

  try {
    const response =
      await fetch(
        `${config.url}/storage/v1/object/${encodeURIComponent(config.bucket)}`,

        {
          method: "DELETE",

          cache: "no-store",

          redirect: "error",

          headers: {
            ...getStorageHeaders(config),

            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            prefixes: [storageKey],
          }),

          signal:
            AbortSignal.timeout(
              STORAGE_TIMEOUT_MS
            ),
        }
      );

    if (
      !response.ok
    ) {
      throw new Error(
        "Storage deletion failed"
      );
    }

    await response.body?.cancel();

  } catch {
    throw new ApplicationDocumentError(
      "STORAGE_DELETE_FAILED",
      503
    );
  }
}

/* ============================================================
   22. PERSISTENT STORAGE CLEANUP JOB

   Protects against orphan files when:

   - PostgreSQL writes fail
   - Upload is interrupted
   - Document is replaced
   - Document is logically deleted
   - Supabase is temporarily unavailable
   ============================================================ */

async function enqueueStorageCleanup(
  client: Pool | PoolClient,

  bucket: string,

  storageKey: string,

  delaySeconds = 0
): Promise<string> {
  validateStorageKey(
    storageKey
  );

  const jobId =
    randomUUID();

  const result =
    await client.query<{
      id: string;
    }>(
      `
        INSERT INTO application_storage_cleanup_jobs (
          id,

          bucket,

          storage_key,

          attempts,

          next_attempt_at,

          created_at,

          updated_at
        )

        VALUES (
          $1::uuid,

          $2,

          $3,

          0,

          NOW() + ($4::int * INTERVAL '1 second'),

          NOW(),

          NOW()
        )

        ON CONFLICT (
          bucket,
          storage_key
        )

        DO UPDATE SET

          next_attempt_at = LEAST(
            application_storage_cleanup_jobs.next_attempt_at,

            EXCLUDED.next_attempt_at
          ),

          updated_at = NOW()

        RETURNING id
      `,

      [
        jobId,

        bucket,

        storageKey,

        delaySeconds,
      ]
    );

  return result.rows[0].id;
}

/* ============================================================
   23. DOCUMENT QUERY

   Selects only documents belonging to
   both the authenticated candidate
   and the corresponding application.
   ============================================================ */

async function findOwnedDocument(
  client: PoolClient,

  documentId: string,

  userId: string,

  countryCode: ApplicationCountry,

  includeDeleted = false
): Promise<DocumentDatabaseRecord | null> {
  const result =
    await client.query<DocumentDatabaseRecord>(
      `
        SELECT
          d.id,

          d.application_id,

          d.user_id,

          a.country_code,

          d.type,

          d.storage_key,

          d.file_name,

          d.mime_type,

          d.size_bytes,

          d.sha256_hash,

          d.upload_status,

          d.security_status,

          d.review_status,

          d.created_at,

          d.updated_at

        FROM candidate_documents AS d

        INNER JOIN license_applications AS a

          ON a.id = d.application_id

          AND a.user_id = d.user_id

        WHERE d.id = $1::uuid

          AND d.user_id = $2::uuid

          AND a.country_code = $3

          AND (
            $4::boolean

            OR d.upload_status <> 'DELETED'
          )

        LIMIT 1
      `,

      [
        documentId,

        userId,

        countryCode,

        includeDeleted,
      ]
    );

  return result.rows[0] ?? null;
}

/* ============================================================
   24. DOCUMENT ACCESS VALIDATION
   ============================================================ */

function assertDocumentAccessible(
  document: StoredApplicationDocument
): void {
  if (
    document.uploadStatus === "DELETED"
  ) {
    throw new ApplicationDocumentError(
      "DOCUMENT_NOT_FOUND",
      404
    );
  }

  if (
    document.securityStatus === "REJECTED"
  ) {
    throw new ApplicationDocumentError(
      "DOCUMENT_REJECTED",
      409
    );
  }

  if (
    document.uploadStatus !== "UPLOADED" ||

    document.securityStatus !== "CLEAN"
  ) {
    throw new ApplicationDocumentError(
      "DOCUMENT_NOT_READY",
      409
    );
  }

  assertDocumentStorageKey(
    document
  );
}

/* ============================================================
   25. INVALIDATE PREVIOUS CONFIRMATIONS

   Uploading or removing a document
   changes the application dossier.

   Revision protects draft changes
   between desktop and mobile.
   ============================================================ */

async function updateApplicationRevision(
  client: PoolClient,

  applicationId: string,

  userId: string
): Promise<void> {
  const result =
    await client.query(
      `
        UPDATE license_applications

        SET
          revision = revision + 1,

          confirmed_information = FALSE,

          accepted_document_processing = FALSE,

          updated_at = NOW()

        WHERE id = $1::uuid

          AND user_id = $2::uuid

          AND status = 'DRAFT'
      `,

      [
        applicationId,

        userId,
      ]
    );

  if (result.rowCount !== 1) {
    throw new ApplicationDocumentError(
      "INVALID_APPLICATION_STATE",
      409
    );
  }
}

/* ============================================================
   26. CHECK UPLOAD CAPACITY

   Mandatory document types:
   one active file per type.

   Additional documents:
   multiple files allowed, subject
   to the overall document limit.
   ============================================================ */

function isCoreDocument(
  type: ApplicationDocumentType
): boolean {
  return (
    REQUIRED_DOCUMENT_TYPES as
      readonly ApplicationDocumentType[]
  ).includes(type);
}

async function getActiveApplicationDocuments(
  client: PoolClient,

  applicationId: string,

  userId: string
): Promise<DocumentDatabaseRecord[]> {
  const result =
    await client.query<DocumentDatabaseRecord>(
      `
        SELECT
          d.*,

          a.country_code

        FROM candidate_documents AS d

        INNER JOIN license_applications AS a

          ON a.id = d.application_id

          AND a.user_id = d.user_id

        WHERE d.application_id = $1::uuid

          AND d.user_id = $2::uuid

          AND d.upload_status <> 'DELETED'

        ORDER BY d.created_at ASC

        FOR UPDATE OF d
      `,

      [
        applicationId,

        userId,
      ]
    );

  return result.rows;
}

function assertUploadCapacity(
  documents: DocumentDatabaseRecord[],

  type: ApplicationDocumentType,

  locale: ApplicationLocale
): DocumentDatabaseRecord | null {
  const matching =
    isCoreDocument(type)

      ? documents.filter(
          (document) =>
            document.type === type
        )

      : [];

  if (matching.length > 1) {
    throwValidationError(
      "DUPLICATE_DOCUMENT",

      "documents",

      locale,

      409
    );
  }

  const replacement =
    matching[0] ?? null;

  if (
    !replacement &&

    documents.length >=
      MAX_APPLICATION_DOCUMENTS
  ) {
    throwValidationError(
      "TOO_MANY_DOCUMENTS",

      "documents",

      locale,

      409
    );
  }

  return replacement;
}

/* ============================================================
   27. UPLOAD OR REPLACE DOCUMENT

   Used by:
   POST /api/dashboard/application/documents

   Security sequence:

   1. Validate file.
   2. Verify candidate and draft.
   3. Scan actual file content.
   4. Create orphan cleanup protection.
   5. Lock candidate and application.
   6. Recheck ownership and status.
   7. Upload private storage object.
   8. Replace previous document logically.
   9. Record new document metadata.
   10. Update application revision.
   11. Commit PostgreSQL transaction.
   12. Attempt old-file cleanup.
   ============================================================ */

export async function uploadCandidateApplicationDocument(
  input: UploadCandidateDocumentInput
): Promise<UploadCandidateDocumentResult> {
  const locale =
    normalizeApplicationLocale(
      input.locale
    );

  const document =
    validateDocumentUpload(
      input.document,

      locale
    );

  /*
   * Make an independent copy so that
   * scanned bytes and uploaded bytes
   * are exactly the same.
   */

  const content =
    new Uint8Array(
      document.content
    );

  /*
   * First authentication check.
   * Avoid unnecessary scanning for
   * unauthorized applications.
   */

  const candidate =
    await withTransaction(
      async (client) => {
        const currentCandidate =
          await requireActiveCandidate(
            client,

            input.authenticatedUserId,

            input.authenticatedSessionId
          );

        const application =
          await requireOwnedApplication(
            client,

            input.applicationId,

            currentCandidate.userId,

            currentCandidate.countryCode
          );

        assertApplicationEditable(
          application.status,

          locale
        );

        return currentCandidate;
      }
    );

  const scanResult =
    await scanDocumentContent(
      content
    );

  if (scanResult !== "CLEAN") {
    throwValidationError(
      "DOCUMENT_REJECTED",

      "file",

      locale,

      422
    );
  }

  const config =
    getStorageConfiguration();

  await assertPrivateStorageBucket(
    config
  );

  const documentId =
    randomUUID();

  const storageKey =
    createStorageKey({
      countryCode:
        candidate.countryCode,

      userId:
        candidate.userId,

      applicationId:
        input.applicationId,

      documentId,

      documentType:
        document.type,

      mimeType:
        document.mimeType,
    });

  const fileHash =
    calculateFileHash(
      content
    );

  const pool =
    getDatabasePool();

  /*
   * Persist cleanup protection BEFORE
   * creating the Supabase object.
   *
   * If the process crashes during
   * upload, the cleanup worker can
   * eventually remove the orphan file.
   */

  const cleanupJobId =
    await enqueueStorageCleanup(
      pool,

      config.bucket,

      storageKey,

      ORPHAN_CLEANUP_DELAY_MINUTES * 60
    );

  let replacementKey:
    string | null = null;

  const result =
    await withTransaction(
      async (client) => {
        /*
         * Locks in the same order as
         * the application submission service.
         */

        const currentCandidate =
          await requireActiveCandidate(
            client,

            input.authenticatedUserId,

            input.authenticatedSessionId,

            true
          );

        if (
          currentCandidate.countryCode !==
            candidate.countryCode
        ) {
          throw new ApplicationDocumentError(
            "UNAUTHORIZED",
            401
          );
        }

        const application =
          await requireOwnedApplication(
            client,

            input.applicationId,

            currentCandidate.userId,

            currentCandidate.countryCode,

            true
          );

        assertApplicationEditable(
          application.status,

          locale
        );

        const activeDocuments =
          await getActiveApplicationDocuments(
            client,

            application.id,

            currentCandidate.userId
          );

        const oldDocument =
          assertUploadCapacity(
            activeDocuments,

            document.type,

            locale
          );

        /*
         * Lock the orphan cleanup task.
         * The cleanup worker cannot delete
         * this object during the transaction.
         */

        const cleanupLock =
          await client.query(
            `
              SELECT id

              FROM application_storage_cleanup_jobs

              WHERE id = $1::uuid

                AND bucket = $2

                AND storage_key = $3

              FOR UPDATE
            `,

            [
              cleanupJobId,

              config.bucket,

              storageKey,
            ]
          );

        if (
          cleanupLock.rowCount !== 1
        ) {
          throw new ApplicationDocumentError(
            "UPLOAD_FAILED",
            503
          );
        }

        /*
         * Upload the already scanned bytes.
         */

        await uploadStorageObject({
          config,

          storageKey,

          content,

          mimeType:
            document.mimeType,
        });

        /*
         * Recheck expiry after the external
         * storage operation using clock_timestamp().
         *
         * NOW() is fixed at transaction start.
         */

        const activeSession =
          await client.query(
            `
              SELECT id

              FROM user_sessions

              WHERE id = $1::uuid

                AND user_id = $2::uuid

                AND revoked_at IS NULL

                AND expires_at > clock_timestamp()

              LIMIT 1
            `,

            [
              input.authenticatedSessionId,

              currentCandidate.userId,
            ]
          );

        if (
          activeSession.rowCount !== 1
        ) {
          throw new ApplicationDocumentError(
            "UNAUTHORIZED",
            401
          );
        }

        /*
         * The previous file remains valid
         * until the new file is successfully
         * uploaded and the transaction commits.
         */

        if (oldDocument) {
          const mappedOldDocument =
            mapDocument(
              oldDocument
            );

          assertDocumentStorageKey(
            mappedOldDocument
          );

          await client.query(
            `
              UPDATE candidate_documents

              SET
                upload_status = 'DELETED',

                deleted_at = NOW(),

                updated_at = NOW()

              WHERE id = $1::uuid

                AND application_id = $2::uuid

                AND user_id = $3::uuid
            `,

            [
              oldDocument.id,

              application.id,

              currentCandidate.userId,
            ]
          );

          await enqueueStorageCleanup(
            client,

            config.bucket,

            oldDocument.storage_key
          );

          replacementKey =
            oldDocument.storage_key;
        }

        /*
         * Store only metadata and the
         * protected object reference.
         *
         * Actual files remain in Supabase.
         */

        const inserted =
          await client.query<DocumentDatabaseRecord>(
            `
              INSERT INTO candidate_documents (
                id,

                application_id,
                uploaded_by_id, document_type, title, original_name,
                user_id,

                type,

                storage_key,

                file_name,

                mime_type,

                size_bytes,

                sha256_hash,

                upload_status,

                security_status,

                review_status,

                scanned_at,

                created_at,

                updated_at
              )

              VALUES (
                $1::uuid,

                $2::uuid,
                $3::uuid, $4, $6, $6,
                $3::uuid,

                $4,

                $5,

                $6,

                $7,

                $8,

                $9,

                'UPLOADED',

                'CLEAN',

                'PENDING',

                clock_timestamp(),

                NOW(),

                NOW()
              )

              RETURNING
                *,

                $10::text AS country_code
            `,

            [
              documentId,

              application.id,

              currentCandidate.userId,

              document.type,

              storageKey,

              document.fileName,

              document.mimeType,

              content.byteLength,

              fileHash,

              currentCandidate.countryCode,
            ]
          );

        await updateApplicationRevision(
          client,

          application.id,

          currentCandidate.userId
        );

        /*
         * The uploaded file is now linked
         * to a real document record.
         *
         * Remove orphan cleanup protection
         * in the very same transaction.
         */

        await client.query(
          `
            DELETE FROM application_storage_cleanup_jobs

            WHERE id = $1::uuid
          `,

          [cleanupJobId]
        );

        return {
          document:
            mapDocument(
              inserted.rows[0]
            ),

          replaced:
            oldDocument !== null,
        };
      }
    );

  /*
   * This executes only after a successful
   * PostgreSQL commit.
   *
   * If cleanup fails, its persistent job
   * remains available for retry.
   */

  if (replacementKey !== null) {
    await attemptDocumentCleanup(
      config.bucket,

      replacementKey
    ).catch(() => {
      console.error(
        "[TAYM][DOCUMENTS][REPLACEMENT_CLEANUP_PENDING]"
      );
    });
  }

  return result;
}

/* ============================================================
   28. READ CANDIDATE DOCUMENT

   Used by:
   GET /api/dashboard/application/documents/[id]

   Returns null when the document
   does not belong to the candidate.
   ============================================================ */

export async function getCandidateApplicationDocument(
  input: CandidateDocumentAccessInput
): Promise<StoredApplicationDocument | null> {
  if (
    !isValidUuid(input.documentId)
  ) {
    return null;
  }

  return withTransaction(
    async (client) => {
      const candidate =
        await requireActiveCandidate(
          client,

          input.authenticatedUserId,

          input.authenticatedSessionId
        );

      const row =
        await findOwnedDocument(
          client,

          input.documentId,

          candidate.userId,

          candidate.countryCode
        );

      if (!row) {
        return null;
      }

      const document =
        mapDocument(row);

      assertDocumentStorageKey(
        document
      );

      return document;
    }
  );
}

/* ============================================================
   29. DOWNLOAD CANDIDATE DOCUMENT

   Rechecks:
   - Session
   - Ownership
   - File availability
   - Private storage path
   - Actual file size
   - File signature
   - SHA-256 integrity
   ============================================================ */

export async function downloadCandidateApplicationDocument(
  input: DownloadCandidateDocumentInput
): Promise<DownloadCandidateDocumentResult> {
  if (
    !isValidUuid(input.documentId)
  ) {
    throw new ApplicationDocumentError(
      "DOCUMENT_NOT_FOUND",
      404
    );
  }

  const maxBytes =
    input.maxBytes === undefined

      ? MAX_DOCUMENT_SIZE_BYTES

      : Math.min(
          input.maxBytes,

          MAX_DOCUMENT_SIZE_BYTES
        );

  if (
    !Number.isSafeInteger(maxBytes) ||

    maxBytes < 1
  ) {
    throw new ApplicationDocumentError(
      "DOCUMENT_UNAVAILABLE",
      409
    );
  }

  const initial =
    await withTransaction(
      async (client) => {
        const candidate =
          await requireActiveCandidate(
            client,

            input.authenticatedUserId,

            input.authenticatedSessionId
          );

        const row =
          await findOwnedDocument(
            client,

            input.documentId,

            candidate.userId,

            candidate.countryCode
          );

        if (!row) {
          throw new ApplicationDocumentError(
            "DOCUMENT_NOT_FOUND",
            404
          );
        }

        const document =
          mapDocument(row);

        assertDocumentAccessible(
          document
        );

        if (
          document.sizeBytes > maxBytes
        ) {
          throw new ApplicationDocumentError(
            "DOCUMENT_UNAVAILABLE",
            409
          );
        }

        return {
          document,

          hash:
            row.sha256_hash,
        };
      }
    );

  const config =
    getStorageConfiguration();

  await assertPrivateStorageBucket(
    config
  );

  const content =
    await downloadStorageObject({
      config,

      storageKey:
        initial.document.storageKey,

      maxBytes:
        Math.min(
          maxBytes,

          initial.document.sizeBytes
        ),
    });

  const detectedMimeType =
    detectDocumentMimeType(
      content
    );

  const calculatedHash =
    calculateFileHash(
      content
    );

  if (
    content.byteLength !==
      initial.document.sizeBytes ||

    detectedMimeType !==
      initial.document.mimeType ||

    calculatedHash !== initial.hash
  ) {
    throw new ApplicationDocumentError(
      "DOCUMENT_UNAVAILABLE",
      409
    );
  }

  /*
   * Recheck the document after reading
   * its binary content from Supabase.
   */

  const current =
    await withTransaction(
      async (client) => {
        const candidate =
          await requireActiveCandidate(
            client,

            input.authenticatedUserId,

            input.authenticatedSessionId
          );

        const row =
          await findOwnedDocument(
            client,

            input.documentId,

            candidate.userId,

            candidate.countryCode
          );

        if (!row) {
          throw new ApplicationDocumentError(
            "DOCUMENT_NOT_FOUND",
            404
          );
        }

        const document =
          mapDocument(row);

        assertDocumentAccessible(
          document
        );

        if (
          document.storageKey !==
            initial.document.storageKey ||

          document.applicationId !==
            initial.document.applicationId ||

          document.sizeBytes !==
            initial.document.sizeBytes ||

          row.sha256_hash !== calculatedHash ||

          document.mimeType !==
            detectedMimeType
        ) {
          throw new ApplicationDocumentError(
            "DOCUMENT_UNAVAILABLE",
            409
          );
        }

        return document;
      }
    );

  return {
    document: current,

    content,
  };
}

/* ============================================================
   30. DELETE CANDIDATE DOCUMENT

   Used by:
   DELETE /api/dashboard/application/documents

   Logical deletion blocks access
   immediately after transaction commit.

   Physical deletion occurs only after
   the database transaction succeeds.
   ============================================================ */

export async function deleteCandidateApplicationDocument(
  input: DeleteCandidateDocumentInput
): Promise<DeleteCandidateDocumentResult> {
  const locale =
    normalizeApplicationLocale(
      input.locale
    );

  if (
    !isValidUuid(input.applicationId) ||

    !isValidUuid(input.documentId)
  ) {
    throwValidationError(
      "INVALID_INPUT",

      "documentId",

      locale
    );
  }

  const config =
    getStorageConfiguration();

  const committed =
    await withTransaction(
      async (client) => {
        const candidate =
          await requireActiveCandidate(
            client,

            input.authenticatedUserId,

            input.authenticatedSessionId,

            true
          );

        const application =
          await requireOwnedApplication(
            client,

            input.applicationId,

            candidate.userId,

            candidate.countryCode,

            true
          );

        const row =
          await findOwnedDocument(
            client,

            input.documentId,

            candidate.userId,

            candidate.countryCode,

            true
          );

        if (
          !row ||

          row.application_id !==
            application.id
        ) {
          throw new ApplicationDocumentError(
            "DOCUMENT_NOT_FOUND",
            404
          );
        }

        const document =
          mapDocument(row);

        assertDocumentStorageKey(
          document
        );

        /*
         * A repeated deletion of an already
         * deleted document is idempotent.
         */

        if (
          document.uploadStatus === "DELETED"
        ) {
          return {
            document,

            alreadyDeleted: true,
          };
        }

        assertApplicationEditable(
          application.status,

          locale
        );

        const deleted =
          await client.query(
            `
              UPDATE candidate_documents

              SET
                upload_status = 'DELETED',

                deleted_at = NOW(),

                updated_at = NOW()

              WHERE id = $1::uuid

                AND application_id = $2::uuid

                AND user_id = $3::uuid

                AND upload_status <> 'DELETED'
            `,

            [
              document.id,

              application.id,

              candidate.userId,
            ]
          );

        if (deleted.rowCount !== 1) {
          throw new ApplicationDocumentError(
            "DELETE_FAILED",
            503
          );
        }

        /*
         * Record the physical deletion job
         * in the same transaction.
         */

        await enqueueStorageCleanup(
          client,

          config.bucket,

          document.storageKey
        );

        await updateApplicationRevision(
          client,

          application.id,

          candidate.userId
        );

        return {
          document,

          alreadyDeleted: false,
        };
      }
    );

  /*
   * Never remove a physical object
   * before committing logical deletion.
   */

  await attemptDocumentCleanup(
    config.bucket,

    committed.document.storageKey
  ).catch(() => {
    console.error(
      "[TAYM][DOCUMENTS][DELETE_CLEANUP_PENDING]"
    );
  });

  return {
    documentId:
      committed.document.id,

    applicationId:
      committed.document.applicationId,

    documentType:
      committed.document.type,

    deleted: true,
  };
}

/* ============================================================
   31. LIST CANDIDATE DOCUMENTS

   Available to application.ts when
   building the authenticated page.

   The private storage key is returned
   to server-side services only.

   The API serialization must remove it.
   ============================================================ */

export async function listCandidateApplicationDocuments({
  applicationId,

  authenticatedUserId,

  authenticatedSessionId,
}: {
  applicationId: string;

  authenticatedUserId: string;

  authenticatedSessionId: string;
}): Promise<StoredApplicationDocument[]> {
  return withTransaction(
    async (client) => {
      const candidate =
        await requireActiveCandidate(
          client,

          authenticatedUserId,

          authenticatedSessionId
        );

      const application =
        await requireOwnedApplication(
          client,

          applicationId,

          candidate.userId,

          candidate.countryCode
        );

      const result =
        await client.query<DocumentDatabaseRecord>(
          `
            SELECT
              d.*,

              a.country_code

            FROM candidate_documents AS d

            INNER JOIN license_applications AS a

              ON a.id = d.application_id

              AND a.user_id = d.user_id

            WHERE d.application_id = $1::uuid

              AND d.user_id = $2::uuid

              AND d.upload_status <> 'DELETED'

            ORDER BY
              d.created_at ASC,

              d.id ASC
          `,

          [
            application.id,

            candidate.userId,
          ]
        );

      return result.rows.map(
        mapDocument
      );
    }
  );
}

/* ============================================================
   32. PROCESS ONE STORAGE CLEANUP JOB

   Maintains a database row lock while
   deleting the object.

   Before deleting, verifies that no
   active document references the key.

   Unique immutable object keys prevent
   deleting a newer replacement file.
   ============================================================ */

async function processStorageCleanupJob({
  bucket,

  storageKey,
}: {
  bucket?: string;

  storageKey?: string;
} = {}): Promise<
  "DELETED" |
  "RETAINED" |
  "FAILED" |
  "EMPTY"
> {
  const config =
    getStorageConfiguration();

  return withTransaction(
    async (client) => {
      const jobs =
        await client.query<CleanupJob>(
          `
            SELECT
              id,

              bucket,

              storage_key

            FROM application_storage_cleanup_jobs

            WHERE next_attempt_at <= NOW()

              AND bucket = $1

              AND (
                $2::text IS NULL

                OR bucket = $2
              )

              AND (
                $3::text IS NULL

                OR storage_key = $3
              )

            ORDER BY
              next_attempt_at ASC,

              id ASC

            LIMIT 1

            FOR UPDATE SKIP LOCKED
          `,

          [
            config.bucket,

            bucket ?? null,

            storageKey ?? null,
          ]
        );

      const job =
        jobs.rows[0];

      if (!job) {
        return "EMPTY";
      }

      /*
       * Never delete a referenced
       * active document.
       */

      const referenced =
        await client.query(
          `
            SELECT id

            FROM candidate_documents

            WHERE storage_key = $1

              AND upload_status <> 'DELETED'

            LIMIT 1
          `,

          [
            job.storage_key,
          ]
        );

      if (
        (referenced.rowCount ?? 0) > 0
      ) {
        await client.query(
          `
            DELETE FROM application_storage_cleanup_jobs

            WHERE id = $1::uuid
          `,

          [job.id]
        );

        return "RETAINED";
      }

      try {
        await deleteStorageObject({
          config,

          storageKey:
            job.storage_key,
        });

      } catch {
        /*
         * Persist the failure.
         * Worker can retry later.
         */

        await client.query(
          `
            UPDATE application_storage_cleanup_jobs

            SET
              attempts = attempts + 1,

              last_error_code =
                'STORAGE_DELETE_FAILED',

              next_attempt_at =
                NOW() + ($2::int * INTERVAL '1 second'),

              updated_at = NOW()

            WHERE id = $1::uuid
          `,

          [
            job.id,

            CLEANUP_RETRY_DELAY_SECONDS,
          ]
        );

        return "FAILED";
      }

      await client.query(
        `
          DELETE FROM application_storage_cleanup_jobs

          WHERE id = $1::uuid
        `,

        [job.id]
      );

      return "DELETED";
    }
  );
}

/* ============================================================
   33. IMMEDIATE CLEANUP ATTEMPT

   Called after replacement or deletion.
   ============================================================ */

async function attemptDocumentCleanup(
  bucket: string,

  storageKey: string
): Promise<void> {
  await processStorageCleanupJob({
    bucket,

    storageKey,
  });
}

/* ============================================================
   34. RETRY STORAGE CLEANUP

   Server-only scheduled worker.

   Can be called from an existing
   authenticated internal cron job.

   Never expose this directly through
   a public endpoint.
   ============================================================ */

export async function retryApplicationStorageCleanup(
  limit = CLEANUP_BATCH_SIZE
): Promise<{
  processed: number;

  deleted: number;

  retained: number;

  failed: number;
}> {
  const batchSize =
    Number.isSafeInteger(limit)

      ? Math.max(
          1,

          Math.min(
            MAX_CLEANUP_BATCH_SIZE,

            limit
          )
        )

      : CLEANUP_BATCH_SIZE;

  const result = {
    processed: 0,

    deleted: 0,

    retained: 0,

    failed: 0,
  };

  for (
    let index = 0;

    index < batchSize;

    index += 1
  ) {
    const status =
      await processStorageCleanupJob();

    if (status === "EMPTY") {
      break;
    }

    result.processed += 1;

    switch (status) {
      case "DELETED":
        result.deleted += 1;
        break;

      case "RETAINED":
        result.retained += 1;
        break;

      case "FAILED":
        result.failed += 1;
        break;
    }
  }

  return result;
}
