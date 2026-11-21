
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createHash,
  randomUUID,
} from "node:crypto";

import {
  Pool,
  type PoolClient,
} from "pg";
import { REQUIRED_DOCUMENT_TYPES } from "@/lib/applications/validation";

/* ============================================================
   FAHRSCHULE TAYM
   ADMIN APPLICATION DECISION API

   File:
   src/app/api/admin/applications/[id]/decision/route.ts

   Method:
   POST /api/admin/applications/[id]/decision

   Authentication:
   - taym_admin_session cookie
   - taym_admin_sessions PostgreSQL table
   - Primary administrator only

   Transaction:
   1. Verify administrator session
   2. Lock requested application
   3. Check expected status and timestamp
   4. Update application status
   5. Insert administrative decision
   6. Insert activity log
   7. Report that decision email is not configured
   8. Read updated application
   9. Commit

   All changes are atomic.

   This API does NOT issue an official
   driving licence and does NOT claim
   an email was delivered.
   ============================================================ */


/* ============================================================
   1. CONSTANTS
   ============================================================ */

const SESSION_COOKIE = "taym_admin_session";
const ADMIN_ID = "primary";

const SESSION_PATTERN = /^[a-f0-9]{64}$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_BODY_BYTES = 4096;
const MIN_REJECTION_REASON = 10;
const MAX_REJECTION_REASON = 1000;
const MAX_DOCUMENTS = 100;
const MAX_EXTRA_FIELDS = 100;

const HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  Vary: "Cookie",
};

type Country = "DE" | "AT" | "BE" | "IT" | "ES";

type ApplicationStatus =
  | "PENDING"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED";

type Decision = "APPROVED" | "REJECTED";

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

type DecisionInput = {
  decision: Decision;
  reason: string | null;
  expectedStatus: ApplicationStatus;
  expectedUpdatedAt: string;
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

type AdditionalField = {
  key: string;
  label: string;
  value: string;
};

type ApplicationDetail = {
  id: string;
  reference: string;
  status: ApplicationStatus;
  countryCode: Country;
  licenseClass: string;
  requestType: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;

  applicant: {
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

  documents: ApplicationDocument[];
  additionalFields: AdditionalField[];

  decision: {
    decidedAt: string;
    reason: string | null;
  } | null;
};

type DatabaseApplicationRow = {
  id: string;
  reference: string;
  status: string;
  country_code: string;
  license_class: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type ApplicationDetailRow = {
  application_id: string;
  request_type: string | null;
  notes: string | null;
  date_of_birth: Date | string | null;
  nationality: string | null;
  phone_e164: string;
  email_verified: boolean;
  phone_verified: boolean;
  street_address: string | null;
  postal_code: string | null;
  city: string | null;
  additional_fields: unknown;
};

type DocumentRow = {
  id: string;
  document_type: string;
  label: string | null;
  file_name: string | null;
  mime_type: string | null;
  verification_status: string;
  uploaded_at: Date | string | null;
};

type DecisionRow = {
  decided_at: Date | string;
  reason: string | null;
};

type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "ORIGIN_NOT_ALLOWED"
  | "INVALID_APPLICATION_ID"
  | "INVALID_INPUT"
  | "REQUEST_TOO_LARGE"
  | "UNSUPPORTED_CONTENT_TYPE"
  | "APPLICATION_NOT_FOUND"
  | "DECISION_CONFLICT"
  | "ALREADY_DECIDED"
  | "APPLICATION_INCOMPLETE"
  | "SERVICE_UNAVAILABLE";

type ProcessResult =
  | { kind: "unauthenticated" }
  | { kind: "not_found" }
  | { kind: "conflict" }
  | { kind: "already_decided" }
  | { kind: "incomplete" }
  | {
      kind: "success";
      application: ApplicationDetail;
    };

/* ============================================================
   2. DATABASE

   Reuse the same pool key as the
   existing admin login/logout APIs.
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
   3. RESPONSE HELPERS
   ============================================================ */

function errorResponse(
  status: number,
  code: ApiErrorCode
): NextResponse {
  return NextResponse.json(
    { success: false, code },
    { status, headers: HEADERS }
  );
}

function successResponse(
  application: ApplicationDetail
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      application,
      notificationStatus: "NOT_CONFIGURED",
    },
    {
      status: 200,
      headers: HEADERS,
    }
  );
}

/* ============================================================
   4. SERVER ORIGIN / CSRF PROTECTION

   POST authenticated with cookies
   must not accept foreign origins.

   Set TAYM_APP_ORIGIN to the exact
   production origin.
   ============================================================ */

function getExpectedOrigin(): string {
  const raw = process.env.TAYM_APP_ORIGIN;

  if (!raw) {
    throw new Error("TAYM_APP_ORIGIN_MISSING");
  }

  const url = new URL(raw);

  const isLocal =
    process.env.NODE_ENV !== "production" &&
    url.protocol === "http:" &&
    (url.hostname === "localhost" ||
      url.hostname === "127.0.0.1");

  if (
    (url.protocol !== "https:" && !isLocal) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("INVALID_APP_ORIGIN");
  }

  return url.origin;
}

function isAllowedOrigin(
  request: NextRequest,
  expectedOrigin: string
): boolean {
  const origin = request.headers.get("origin");
  const fetchSite =
    request.headers.get("sec-fetch-site");

  if (fetchSite && fetchSite !== "same-origin") {
    return false;
  }

  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === expectedOrigin;
  } catch {
    return false;
  }
}

/* ============================================================
   5. ADMIN SESSION

   Login stores the SHA-256 hash of
   the 32 random token bytes.
   ============================================================ */

function hashSessionToken(
  raw: string | undefined
): string | null {
  if (!raw || !SESSION_PATTERN.test(raw)) {
    return null;
  }

  return createHash("sha256")
    .update(Buffer.from(raw, "hex"))
    .digest("hex");
}

async function verifyAndLockSession(
  client: PoolClient,
  tokenHash: string
): Promise<boolean> {
  /*
   * FOR SHARE ensures a concurrent
   * revocation UPDATE waits until
   * this short transaction finishes.
   */

  const result = await client.query<{
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
    FOR SHARE
    `,
    [tokenHash, ADMIN_ID]
  );

  return (
    result.rows.length === 1 &&
    result.rows[0].admin_id === ADMIN_ID
  );
}

/* ============================================================
   6. VALIDATE ROUTE IDENTIFIER
   ============================================================ */

function normalizeApplicationId(
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
   7. REQUEST VALIDATION
   ============================================================ */

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function isStatus(
  value: unknown
): value is ApplicationStatus {
  return (
    value === "PENDING" ||
    value === "IN_REVIEW" ||
    value === "APPROVED" ||
    value === "REJECTED"
  );
}

function isDecision(
  value: unknown
): value is Decision {
  return value === "APPROVED" ||
    value === "REJECTED";
}

function isCountry(
  value: unknown
): value is Country {
  return (
    value === "DE" ||
    value === "AT" ||
    value === "BE" ||
    value === "IT" ||
    value === "ES"
  );
}

function normalizeReason(value: string): string {
  return value
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ");
}

function parseDecisionInput(
  value: unknown
): DecisionInput | null {
  if (!isRecord(value)) return null;

  const keys = Object.keys(value);

  if (
    keys.length !== 4 ||
    keys.some(
      (key) =>
        key !== "decision" &&
        key !== "reason" &&
        key !== "expectedStatus" &&
        key !== "expectedUpdatedAt"
    )
  ) {
    return null;
  }

  if (
    !isDecision(value.decision) ||
    !isStatus(value.expectedStatus) ||
    typeof value.expectedUpdatedAt !== "string"
  ) {
    return null;
  }

  /*
   * The frontend reads updatedAt
   * as an ISO timestamp from the
   * protected detail API.
   */

  const expectedDate =
    new Date(value.expectedUpdatedAt);

  if (
    !Number.isFinite(expectedDate.getTime()) ||
    expectedDate.toISOString() !==
      value.expectedUpdatedAt
  ) {
    return null;
  }

  if (
    value.expectedStatus !== "PENDING" &&
    value.expectedStatus !== "IN_REVIEW"
  ) {
    return null;
  }

  if (value.decision === "APPROVED") {
    if (value.reason !== null) return null;

    return {
      decision: "APPROVED",
      reason: null,
      expectedStatus: value.expectedStatus,
      expectedUpdatedAt: value.expectedUpdatedAt,
    };
  }

  if (typeof value.reason !== "string") {
    return null;
  }

  const reason = normalizeReason(value.reason);

  if (
    reason.length < MIN_REJECTION_REASON ||
    reason.length > MAX_REJECTION_REASON
  ) {
    return null;
  }

  return {
    decision: "REJECTED",
    reason,
    expectedStatus: value.expectedStatus,
    expectedUpdatedAt: value.expectedUpdatedAt,
  };
}

/* ============================================================
   8. LIMITED JSON BODY

   Verify actual bytes, not only
   Content-Length.
   ============================================================ */

type ReadBodyResult =
  | { ok: true; value: unknown }
  | {
      ok: false;
      status: number;
      code:
        | "INVALID_INPUT"
        | "REQUEST_TOO_LARGE"
        | "UNSUPPORTED_CONTENT_TYPE";
    };

async function readLimitedJson(
  request: NextRequest
): Promise<ReadBodyResult> {
  const contentType =
    request.headers.get("content-type") ?? "";

  if (
    !/^application\/json(?:\s*;|$)/i.test(
      contentType
    )
  ) {
    return {
      ok: false,
      status: 415,
      code: "UNSUPPORTED_CONTENT_TYPE",
    };
  }

  const declared = request.headers.get(
    "content-length"
  );

  if (declared !== null) {
    const size = Number(declared);

    if (
      !Number.isSafeInteger(size) ||
      size < 0 ||
      size > MAX_BODY_BYTES
    ) {
      return {
        ok: false,
        status: 413,
        code: "REQUEST_TOO_LARGE",
      };
    }
  }

  const reader = request.body?.getReader();

  if (!reader) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_INPUT",
    };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      total += value.byteLength;

      if (total > MAX_BODY_BYTES) {
        await reader.cancel();

        return {
          ok: false,
          status: 413,
          code: "REQUEST_TOO_LARGE",
        };
      }

      chunks.push(value);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;

    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const json = new TextDecoder("utf-8", {
      fatal: true,
    }).decode(bytes);

    return {
      ok: true,
      value: JSON.parse(json) as unknown,
    };
  } catch {
    return {
      ok: false,
      status: 400,
      code: "INVALID_INPUT",
    };
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Reader may already be released.
    }
  }
}

/* ============================================================
   9. RESPONSE MAPPING HELPERS

   These match the existing detail
   page's complete JSON contract.
   ============================================================ */

function requiredText(
  value: unknown,
  max: number
): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > max
  ) {
    throw new Error("INVALID_APPLICATION_DATA");
  }

  return value;
}

function optionalText(
  value: unknown,
  max: number
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value !== "string" ||
    value.length > max
  ) {
    throw new Error("INVALID_OPTIONAL_DATA");
  }

  return value;
}

function isoTimestamp(
  value: Date | string
): string {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new Error("INVALID_TIMESTAMP");
  }

  return date.toISOString();
}

function isoCalendarDate(
  value: Date | string | null
): string | null {
  if (value === null) return null;

  const datePart =
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : value.slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    throw new Error("INVALID_BIRTH_DATE");
  }

  const parsed = new Date(
    `${datePart}T00:00:00.000Z`
  );

  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== datePart
  ) {
    throw new Error("INVALID_BIRTH_DATE");
  }

  return parsed.toISOString();
}

function isDocumentType(
  value: unknown
): value is DocumentType {
  return (
    value === "IDENTITY_FRONT" ||
    value === "IDENTITY_BACK" ||
    value === "PROOF_OF_ADDRESS" ||
    value === "PORTRAIT" ||
    value === "SIGNATURE" ||
    value === "OTHER"
  );
}

function isVerificationStatus(
  value: unknown
): value is VerificationStatus {
  return (
    value === "PENDING" ||
    value === "VERIFIED" ||
    value === "REJECTED" ||
    value === "NOT_REQUIRED"
  );
}

function mapDocument(
  row: DocumentRow
): ApplicationDocument {
  if (
    !isDocumentType(row.document_type) ||
    !isVerificationStatus(row.verification_status)
  ) {
    throw new Error("INVALID_DOCUMENT_DATA");
  }

  return {
    id: requiredText(row.id, 150),
    type: row.document_type,
    label: optionalText(row.label, 150),
    fileName: optionalText(row.file_name, 250),
    mimeType: optionalText(row.mime_type, 100),
    status: row.verification_status,
    uploadedAt: row.uploaded_at === null
      ? null
      : isoTimestamp(row.uploaded_at),
  };
}

function parseAdditionalFields(
  value: unknown
): AdditionalField[] {
  const fields =
    typeof value === "string"
      ? JSON.parse(value) as unknown
      : value;

  if (
    !Array.isArray(fields) ||
    fields.length > MAX_EXTRA_FIELDS
  ) {
    throw new Error("INVALID_EXTRA_FIELDS");
  }

  const results: AdditionalField[] = [];
  const knownKeys = new Set<string>();

  for (const item of fields) {
    if (!isRecord(item)) {
      throw new Error("INVALID_EXTRA_FIELD");
    }

    const key = requiredText(item.key, 120);
    const label = requiredText(item.label, 160);
    const fieldValue = requiredText(
      item.value,
      3000
    );

    /*
     * Defensive check.
     * A strict allowlist at data
     * collection is still required.
     */

    if (
      /password|passwd|passwort|otp|token|secret|verification.?code|confirmation.?code|api.?key/i.test(
        `${key} ${label}`
      )
    ) {
      continue;
    }

    if (knownKeys.has(key)) {
      throw new Error("DUPLICATE_EXTRA_FIELD");
    }

    knownKeys.add(key);

    results.push({
      key,
      label,
      value: fieldValue,
    });
  }

  return results;
}

/* ============================================================
   10. APPLICATION QUERIES

   The primary application row is
   locked using SELECT ... FOR UPDATE.

   This ensures that concurrent
   decisions cannot both succeed.
   ============================================================ */

async function lockApplication(
  client: PoolClient,
  id: string
): Promise<DatabaseApplicationRow | null> {
  const result =
    await client.query<DatabaseApplicationRow>(
      `
      SELECT
        id::text AS id,
        COALESCE(reference, application_number) AS reference,
        CASE WHEN status = 'SUBMITTED' THEN 'PENDING' WHEN status IN ('REVIEWING', 'NEEDS_INFO') THEN 'IN_REVIEW' ELSE status END AS status,
        country_code,
        license_class,
        first_name,
        last_name,
        email,
        created_at,
        updated_at
      FROM license_applications
      WHERE id = $1::uuid
        AND status IN ('SUBMITTED', 'REVIEWING', 'NEEDS_INFO', 'APPROVED', 'REJECTED')
        AND country_code IN (
          'DE', 'AT', 'BE', 'IT', 'ES'
        )
      LIMIT 1
      FOR UPDATE
      `,
      [id]
    );

  return result.rows[0] ?? null;
}

async function loadDetails(
  client: PoolClient,
  id: string
): Promise<ApplicationDetailRow | null> {
  const result =
    await client.query<ApplicationDetailRow>(
      `
      SELECT
        a.id::text AS application_id,
        a.application_type AS request_type,
        a.applicant_notes AS notes,
        a.date_of_birth,
        a.nationality,
        a.phone_e164,
        (u.email_verified_at IS NOT NULL) AS email_verified,
        (u.phone_verified_at IS NOT NULL) AS phone_verified,
        COALESCE(a.residential_address, a.street_address) AS street_address,
        a.postal_code,
        a.city,
        '[]'::jsonb AS additional_fields
      FROM license_applications a JOIN users u ON u.id = a.applicant_id
      WHERE a.id = $1::uuid
      LIMIT 1
      `,
      [id]
    );

  return result.rows[0] ?? null;
}

async function loadDocuments(
  client: PoolClient,
  id: string
): Promise<ApplicationDocument[]> {
  const result =
    await client.query<DocumentRow>(
      `
      SELECT
        id::text AS id,
        CASE COALESCE(type, document_type) WHEN 'ADDRESS_PROOF' THEN 'PROOF_OF_ADDRESS' WHEN 'PASSPORT_PHOTO' THEN 'PORTRAIT' WHEN 'IDENTITY_FRONT' THEN 'IDENTITY_FRONT' WHEN 'IDENTITY_BACK' THEN 'IDENTITY_BACK' WHEN 'SIGNATURE' THEN 'SIGNATURE' ELSE 'OTHER' END AS document_type,
        title AS label,
        COALESCE(file_name, original_name) AS file_name,
        mime_type,
        CASE review_status WHEN 'APPROVED' THEN 'VERIFIED' WHEN 'REJECTED' THEN 'REJECTED' ELSE 'PENDING' END AS verification_status,
        created_at AS uploaded_at
      FROM candidate_documents
      WHERE application_id = $1::uuid AND deleted_at IS NULL
      ORDER BY created_at ASC NULLS LAST, id ASC
      LIMIT $2
      `,
      [id, MAX_DOCUMENTS + 1]
    );

  if (result.rows.length > MAX_DOCUMENTS) {
    throw new Error("TOO_MANY_DOCUMENTS");
  }

  return result.rows.map(mapDocument);
}

async function loadDecision(
  client: PoolClient,
  id: string
): Promise<DecisionRow | null> {
  const result =
    await client.query<DecisionRow>(
      `
      SELECT created_at AS decided_at, public_note AS reason
      FROM application_status_history
      WHERE application_id = $1::uuid AND new_status IN ('APPROVED', 'REJECTED')
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [id]
    );

  return result.rows[0] ?? null;
}

function toApplicationDetail(
  row: DatabaseApplicationRow,
  details: ApplicationDetailRow,
  documents: ApplicationDocument[],
  decision: DecisionRow | null
): ApplicationDetail {
  if (!isCountry(row.country_code) ||
      !isStatus(row.status)) {
    throw new Error("INVALID_APPLICATION_ENUM");
  }

  if (
    typeof details.email_verified !== "boolean" ||
    typeof details.phone_verified !== "boolean"
  ) {
    throw new Error("INVALID_VERIFICATION_DATA");
  }

  return {
    id: requiredText(row.id, 150),
    reference: requiredText(row.reference, 120),
    status: row.status,
    countryCode: row.country_code,
    licenseClass: requiredText(
      row.license_class,
      100
    ),
    requestType: optionalText(
      details.request_type,
      150
    ),
    notes: optionalText(details.notes, 3000),
    createdAt: isoTimestamp(row.created_at),
    updatedAt: isoTimestamp(row.updated_at),

    applicant: {
      firstName: requiredText(row.first_name, 150),
      lastName: requiredText(row.last_name, 150),
      dateOfBirth: isoCalendarDate(
        details.date_of_birth
      ),
      nationality: optionalText(
        details.nationality,
        120
      ),
      email: requiredText(row.email, 254),
      emailVerified: details.email_verified,
      phoneE164: requiredText(
        details.phone_e164,
        40
      ),
      phoneVerified: details.phone_verified,
      countryCode: row.country_code,
      streetAddress: optionalText(
        details.street_address,
        250
      ),
      postalCode: optionalText(
        details.postal_code,
        20
      ),
      city: optionalText(details.city, 150),
    },

    documents,

    additionalFields: parseAdditionalFields(
      details.additional_fields
    ),

    decision: decision
      ? {
          decidedAt: isoTimestamp(
            decision.decided_at
          ),
          reason: optionalText(
            decision.reason,
            1000
          ),
        }
      : null,
  };
}

/* ============================================================
   11. WRITE DECISION

   Table: taym_application_decisions

   One record per application.

   Requires a UNIQUE or PRIMARY KEY
   on application_id.
   ============================================================ */

async function insertDecision(
  client: PoolClient,
  applicationId: string,
  decision: Decision,
  reason: string | null
): Promise<void> {
  await client.query(
    `
    INSERT INTO application_status_history (id, application_id, previous_status, new_status, public_note, created_at)
    SELECT $4::uuid, id, status, $2, $3, NOW()
    FROM license_applications WHERE id = $1::uuid
    `,
    [applicationId, decision, reason, randomUUID()]
  );
}

/* ============================================================
   12. UPDATE APPLICATION STATUS

   updated_at is changed on the
   primary application record.

   The candidate dashboard can later
   read this same status.
   ============================================================ */

async function updateStatus(
  client: PoolClient,
  applicationId: string,
  decision: Decision
): Promise<void> {
  const result = await client.query(
    `
    UPDATE license_applications
    SET
      status = $2,
      reviewed_at = clock_timestamp(),
      updated_at = clock_timestamp()
    WHERE id = $1::uuid
      AND status IN ('SUBMITTED', 'REVIEWING', 'NEEDS_INFO')
    `,
    [applicationId, decision]
  );

  if (result.rowCount !== 1) {
    throw new Error("STATUS_UPDATE_FAILED");
  }
}

/* ============================================================
   13. WRITE AUDIT ACTIVITY

   Do not store rejection reason
   or identity document content in
   the general activity timeline.

   The full rejection reason is
   retained in the decision table.
   ============================================================ */

async function writeActivity(
  client: PoolClient,
  application: DatabaseApplicationRow,
  decision: Decision
): Promise<void> {
  const type =
    decision === "APPROVED"
      ? "APPLICATION_APPROVED"
      : "APPLICATION_REJECTED";

  await client.query(
    `
    INSERT INTO taym_admin_activity_logs (
      id,
      type,
      country_code,
      application_id,
      application_reference,
      actor_name,
      description,
      created_at
    )
    VALUES (
      $1::uuid,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      NOW()
    )
    `,
    [
      randomUUID(),
      type,
      application.country_code,
      application.id,
      application.reference,
      "Administrator",
      decision === "APPROVED"
        ? "Application approved"
        : "Application rejected",
    ]
  );
}

/* ============================================================
   14. NOTIFICATION

   The previous outbox references a different application
   table. Do not claim that an email was queued until an
   outbox for the candidate application is configured.
   ============================================================ */


/* ============================================================
   15. DECISION TRANSACTION

   READ COMMITTED + row locks.

   The primary application row is
   locked before reading/modifying
   its decision status.

   We compare:
   - Current status
   - Current updatedAt
   - Client's expected values

   This prevents processing a stale
   decision after another update.
   ============================================================ */

async function processDecision(
  pool: Pool,
  tokenHash: string,
  applicationId: string,
  input: DecisionInput
): Promise<ProcessResult> {
  const client = await pool.connect();
  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;

    /*
     * Bound transaction duration so a
     * stuck request does not retain a
     * dossier lock indefinitely.
     */

    await client.query(
      `SET LOCAL lock_timeout = '5s'`
    );

    await client.query(
      `SET LOCAL statement_timeout = '15s'`
    );

    /* A. Verify administrator */

    const authenticated =
      await verifyAndLockSession(
        client,
        tokenHash
      );

    if (!authenticated) {
      await client.query("ROLLBACK");
      transactionOpen = false;

      return { kind: "unauthenticated" };
    }

    /* B. Lock application */

    const current = await lockApplication(
      client,
      applicationId
    );

    if (!current) {
      await client.query("ROLLBACK");
      transactionOpen = false;

      return { kind: "not_found" };
    }

    /* C. Prevent duplicate decisions */

    if (
      current.status === "APPROVED" ||
      current.status === "REJECTED"
    ) {
      await client.query("ROLLBACK");
      transactionOpen = false;

      return { kind: "already_decided" };
    }

    if (!isStatus(current.status)) {
      throw new Error("INVALID_CURRENT_STATUS");
    }

    /*
     * The detail API emits JS ISO
     * timestamps (millisecond precision).
     * Compare those representations
     * consistently.
     */

    const currentUpdatedAt = isoTimestamp(
      current.updated_at
    );

    if (
      current.status !== input.expectedStatus ||
      currentUpdatedAt !== input.expectedUpdatedAt
    ) {
      await client.query("ROLLBACK");
      transactionOpen = false;

      return { kind: "conflict" };
    }

    /* D. Ensure detail record exists */

    const details = await loadDetails(
      client,
      applicationId
    );

    if (!details) {
      await client.query("ROLLBACK");
      transactionOpen = false;

      return { kind: "incomplete" };
    }

    /*
     * Minimal integrity checks.
     *
     * Actual document requirements vary
     * by country and license procedure.
     * This API does not invent rules
     * about mandatory documents.
     */

    requiredText(current.reference, 120);
    requiredText(current.first_name, 150);
    requiredText(current.last_name, 150);
    requiredText(current.email, 254);
    requiredText(current.license_class, 100);
    requiredText(details.phone_e164, 40);

    if (input.decision === "APPROVED") {
      const required = await client.query<{ type: string }>(
        `SELECT DISTINCT type FROM candidate_documents
         WHERE application_id = $1::uuid AND deleted_at IS NULL
           AND upload_status = 'UPLOADED' AND security_status = 'CLEAN' AND review_status <> 'REJECTED'
           AND type = ANY($2::text[])`,
        [applicationId, REQUIRED_DOCUMENT_TYPES]
      );
      const found = new Set(required.rows.map((row) => row.type));
      if (!REQUIRED_DOCUMENT_TYPES.every((type) => found.has(type))) {
        await client.query("ROLLBACK");
        transactionOpen = false;
        return { kind: "incomplete" };
      }
    }

    /* E. Update application */

    await insertDecision(client, applicationId, input.decision, input.reason);

    await updateStatus(
      client,
      applicationId,
      input.decision
    );

    /* F. Save administrative decision */

    /* G. Record audit event */

    await writeActivity(
      client,
      current,
      input.decision
    );

    /* H. Queue email notification */

    /* I. Return updated dossier */

    const updated = await lockApplication(
      client,
      applicationId
    );

    if (!updated) {
      throw new Error(
        "UPDATED_APPLICATION_MISSING"
      );
    }

    const documents = await loadDocuments(
      client,
      applicationId
    );

    const decision = await loadDecision(
      client,
      applicationId
    );

    if (!decision) {
      throw new Error(
        "DECISION_RECORD_MISSING"
      );
    }

    const application = toApplicationDetail(
      updated,
      details,
      documents,
      decision
    );

    if (application.status !== input.decision) {
      throw new Error(
        "DECISION_STATUS_MISMATCH"
      );
    }

    /* J. Commit all four writes */

    await client.query("COMMIT");
    transactionOpen = false;

    return {
      kind: "success",
      application,
    };
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve original error.
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

/* ============================================================
   16. NEXT.JS ROUTE CONTEXT
   ============================================================ */

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/* ============================================================
   17. POST HANDLER
   ============================================================ */

export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    /* A. Authenticate cookie format */

    const tokenHash = hashSessionToken(
      request.cookies.get(SESSION_COOKIE)?.value
    );

    if (!tokenHash) {
      return errorResponse(
        401,
        "UNAUTHENTICATED"
      );
    }

    /* B. CSRF origin check */

    const expectedOrigin = getExpectedOrigin();

    if (
      !isAllowedOrigin(
        request,
        expectedOrigin
      )
    ) {
      return errorResponse(
        403,
        "ORIGIN_NOT_ALLOWED"
      );
    }

    /* C. Validate application ID */

    const { id } = await context.params;

    const applicationId =
      normalizeApplicationId(id);

    if (!applicationId) {
      return errorResponse(
        400,
        "INVALID_APPLICATION_ID"
      );
    }

    /* D. Read JSON safely */

    const body = await readLimitedJson(
      request
    );

    if (!body.ok) {
      return errorResponse(
        body.status,
        body.code
      );
    }

    /* E. Validate decision data */

    const input = parseDecisionInput(
      body.value
    );

    if (!input) {
      return errorResponse(
        400,
        "INVALID_INPUT"
      );
    }

    /* F. Transactional processing */

    const result = await processDecision(
      getDatabase(),
      tokenHash,
      applicationId,
      input
    );

    switch (result.kind) {
      case "unauthenticated":
        return errorResponse(
          401,
          "UNAUTHENTICATED"
        );

      case "not_found":
        return errorResponse(
          404,
          "APPLICATION_NOT_FOUND"
        );

      case "already_decided":
        return errorResponse(
          409,
          "ALREADY_DECIDED"
        );

      case "conflict":
        return errorResponse(
          409,
          "DECISION_CONFLICT"
        );

      case "incomplete":
        return errorResponse(
          422,
          "APPLICATION_INCOMPLETE"
        );

      case "success":
        return successResponse(
          result.application
        );
    }
  } catch (error) {
    /*
     * Do not print:
     * - Rejection reasons
     * - Candidate information
     * - Passwords or session tokens
     * - SQL parameters or connection URLs
     */

    console.error(
      "[TAYM_ADMIN_APPLICATION_DECISION]",
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
