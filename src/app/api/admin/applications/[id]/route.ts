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
  type PoolClient,
} from "pg";

/* ============================================================
   FAHRSCHULE TAYM
   ADMIN — APPLICATION DETAIL API

   FILE:
   src/app/api/admin/applications/[id]/route.ts

   ENDPOINT:
   GET /api/admin/applications/[id]

   FRONTEND:
   /admin/applications/[id]

   COMPATIBLE WITH:
   - Admin login API
   - Admin logout API
   - Admin session API
   - Admin applications list
   - Admin application detail page

   DATABASE:
   PostgreSQL

   REQUIRED TABLES:
   taym_admin_sessions
   taym_driving_license_applications
   taym_application_details
   taym_application_documents
   taym_application_decisions

   AUTHENTICATION:
   HttpOnly cookie: taym_admin_session

   ADMIN ID:
   primary

   IMPORTANT:
   This API does not return:
   - Document storage keys
   - Raw document files
   - Passwords
   - Verification codes
   - Session tokens
   - Payment credentials

   Documents are opened separately
   through the protected document API.

   ============================================================ */




/* ============================================================
   1. SECURITY CONFIGURATION
   ============================================================ */

const SESSION_COOKIE =
  "taym_admin_session";

const ADMIN_ID =
  "primary";

const SESSION_TOKEN_PATTERN =
  /^[a-f0-9]{64}$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_DOCUMENTS = 100;

const MAX_EXTRA_FIELDS = 100;

/* ============================================================
   2. ALLOWED VALUES
   ============================================================ */

const COUNTRIES = [
  "DE",
  "AT",
  "BE",
  "IT",
  "ES",
] as const;

type Country =
  (typeof COUNTRIES)[number];

const APPLICATION_STATUSES = [
  "PENDING",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
] as const;

type ApplicationStatus =
  (typeof APPLICATION_STATUSES)[number];

const DOCUMENT_TYPES = [
  "IDENTITY_FRONT",
  "IDENTITY_BACK",
  "PROOF_OF_ADDRESS",
  "PORTRAIT",
  "SIGNATURE",
  "OTHER",
] as const;

type DocumentType =
  (typeof DOCUMENT_TYPES)[number];

const VERIFICATION_STATUSES = [
  "PENDING",
  "VERIFIED",
  "REJECTED",
  "NOT_REQUIRED",
] as const;

type VerificationStatus =
  (typeof VERIFICATION_STATUSES)[number];

/* ============================================================
   3. RESPONSE TYPES
   ============================================================ */

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

type ApplicationDecision = {
  decidedAt: string;
  reason: string | null;
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

  applicant: Applicant;

  documents: ApplicationDocument[];

  additionalFields: ExtraField[];

  decision: ApplicationDecision | null;
};

type SuccessResponse = {
  success: true;
  application: ApplicationDetail;
};

type ErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_APPLICATION_ID"
  | "APPLICATION_NOT_FOUND"
  | "SERVICE_UNAVAILABLE";

type ErrorResponse = {
  success: false;
  code: ErrorCode;
};

/* ============================================================
   4. DATABASE ROW TYPES

   PostgreSQL uses snake_case.

   The frontend receives camelCase.
   ============================================================ */

type ApplicationRow = {
  id: string;

  reference: string;

  status: string;
  country_code: string;

  license_class: string;
  request_type: string | null;

  notes: string | null;

  created_at: Date | string;
  updated_at: Date | string;

  first_name: string;
  last_name: string;

  email: string;

  date_of_birth:
    | Date
    | string
    | null;

  nationality: string | null;

  phone_e164: string;

  email_verified: boolean;
  phone_verified: boolean;

  street_address: string | null;
  postal_code: string | null;
  city: string | null;

  additional_fields: unknown;

  details_present: boolean;

  decided_at: Date | string | null;
  decision_reason: string | null;
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

type SessionRow = {
  admin_id: string;
};

type ReadResult =
  | {
      kind: "unauthorized";
    }
  | {
      kind: "not_found";
    }
  | {
      kind: "found";
      application: ApplicationDetail;
    };

/* ============================================================
   5. HTTP SECURITY HEADERS
   ============================================================ */

const SECURITY_HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, max-age=0, must-revalidate",

  Pragma: "no-cache",

  Expires: "0",

  "X-Content-Type-Options": "nosniff",

  "Referrer-Policy": "no-referrer",

  Vary: "Cookie",
};

/* ============================================================
   6. POSTGRESQL CONNECTION

   Uses the SAME shared pool key
   as previous administrator APIs:

   __taymAdminAuthPool

   No second database URL.
   No separate credentials.
   ============================================================ */

const shared =
  globalThis as typeof globalThis & {
    __taymAdminAuthPool?: Pool;
  };

function getDatabase(): Pool {
  const databaseUrl =
    process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL_NOT_CONFIGURED"
    );
  }

  if (!shared.__taymAdminAuthPool) {
    shared.__taymAdminAuthPool =
      new Pool({
        connectionString: databaseUrl,

        max: 5,

        idleTimeoutMillis: 30_000,

        connectionTimeoutMillis: 5_000,

        application_name:
          "fahrschule_taym_admin",
      });
  }

  if (shared.__taymAdminAuthPool.listenerCount("error") === 0) {
    shared.__taymAdminAuthPool.on("error", (error) => {
      console.error("[TAYM][ADMIN][DATABASE_POOL]", { code: (error as NodeJS.ErrnoException).code });
    });
  }

  return shared.__taymAdminAuthPool;
}

/* ============================================================
   7. RESPONSE HELPERS
   ============================================================ */

function errorResponse(
  status: number,
  code: ErrorCode
): NextResponse<ErrorResponse> {
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

function successResponse(
  application: ApplicationDetail
): NextResponse<SuccessResponse> {
  return NextResponse.json(
    {
      success: true,
      application,
    },
    {
      status: 200,
      headers: SECURITY_HEADERS,
    }
  );
}

/* ============================================================
   8. SESSION TOKEN HASHING

   Compatible with login/logout:

   SHA-256(
     Buffer.from(token, "hex")
   )

   Never use the raw cookie value
   in a database query.
   ============================================================ */

function hashSessionToken(
  rawToken: string | undefined
): string | null {
  if (
    !rawToken ||
    !SESSION_TOKEN_PATTERN.test(rawToken)
  ) {
    return null;
  }

  return createHash("sha256")
    .update(
      Buffer.from(rawToken, "hex")
    )
    .digest("hex");
}

/* ============================================================
   9. SERVER-SIDE SESSION VALIDATION

   The session must:
   - Exist in PostgreSQL
   - Belong to admin "primary"
   - Not be revoked
   - Not have expired

   A cookie alone is not proof
   of authorization.
   ============================================================ */

async function verifyAdminSession(
  client: PoolClient,
  tokenHash: string
): Promise<boolean> {
  const result =
    await client.query<SessionRow>(
      `
      SELECT
        admin_id

      FROM
        taym_admin_sessions

      WHERE
        token_hash = $1

        AND admin_id = $2

        AND revoked_at IS NULL

        AND expires_at > NOW()

      LIMIT 1
      `,
      [
        tokenHash,
        ADMIN_ID,
      ]
    );

  return (
    result.rows.length === 1 &&
    result.rows[0].admin_id === ADMIN_ID
  );
}

/* ============================================================
   10. INPUT VALIDATION

   Application IDs are UUIDs.

   The ID is received from the
   dynamic Next.js route.

   Only one dossier is retrieved.
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
   11. ENUM VALIDATION
   ============================================================ */

function isCountry(
  value: unknown
): value is Country {
  return COUNTRIES.some(
    (country) => country === value
  );
}

function isApplicationStatus(
  value: unknown
): value is ApplicationStatus {
  return APPLICATION_STATUSES.some(
    (status) => status === value
  );
}

function isDocumentType(
  value: unknown
): value is DocumentType {
  return DOCUMENT_TYPES.some(
    (type) => type === value
  );
}

function isVerificationStatus(
  value: unknown
): value is VerificationStatus {
  return VERIFICATION_STATUSES.some(
    (status) => status === value
  );
}

/* ============================================================
   12. DATA VALIDATION HELPERS

   Malformed database records should
   not be silently returned as
   successful application data.
   ============================================================ */

function requiredText(
  value: unknown,
  maximum: number
): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maximum
  ) {
    throw new Error(
      "INVALID_APPLICATION_FIELD"
    );
  }

  return value;
}

function optionalText(
  value: unknown,
  maximum: number
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value !== "string" ||
    value.length > maximum
  ) {
    throw new Error(
      "INVALID_OPTIONAL_FIELD"
    );
  }

  return value;
}

function requiredBoolean(
  value: unknown
): boolean {
  if (typeof value !== "boolean") {
    throw new Error(
      "INVALID_VERIFICATION_FIELD"
    );
  }

  return value;
}

function timestampToIso(
  value: Date | string
): string {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (
    !Number.isFinite(
      date.getTime()
    )
  ) {
    throw new Error(
      "INVALID_TIMESTAMP"
    );
  }

  return date.toISOString();
}

function optionalTimestampToIso(
  value: Date | string | null
): string | null {
  if (value === null) {
    return null;
  }

  return timestampToIso(value);
}

/* ============================================================
   13. DATE OF BIRTH

   PostgreSQL DATE is a calendar
   date, not an event timestamp.

   Return a stable UTC calendar date
   to avoid shifting birthdays due
   to browser time zone differences.

   The existing frontend expects
   an ISO-compatible date string.
   ============================================================ */

function birthDateToIso(
  value: Date | string | null
): string | null {
  if (value === null) {
    return null;
  }

  let calendarDate: string;

  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) {
      throw new Error("INVALID_BIRTH_DATE");
    }

    calendarDate =
      value.toISOString().slice(0, 10);
  } else {
    calendarDate = value.slice(0, 10);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(calendarDate)) {
    throw new Error("INVALID_BIRTH_DATE");
  }

  const iso =
    `${calendarDate}T00:00:00.000Z`;

  const parsed = new Date(iso);

  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !==
      calendarDate
  ) {
    throw new Error("INVALID_BIRTH_DATE");
  }

  return iso;
}

/* ============================================================
   14. ADDITIONAL APPLICATION FIELDS

   The detail page supports:
   additionalFields: [
     {
       key,
       label,
       value
     }
   ]

   These fields represent other
   non-secret answers actually
   collected by the candidate.

   Never include passwords, session
   credentials or OTP verification
   codes in the additional fields.
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

function isSensitiveFieldName(
  value: string
): boolean {
  return /password|passwd|passwort|mot.?de.?passe|otp|verification.?code|confirmation.?code|secret|token|api.?key|access.?key|code.?de.?verification/i.test(
    value
  );
}

function parseAdditionalFields(
  value: unknown
): ExtraField[] {
  let parsed = value;

  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw new Error(
        "INVALID_ADDITIONAL_FIELDS"
      );
    }
  }

  if (!Array.isArray(parsed)) {
    throw new Error(
      "INVALID_ADDITIONAL_FIELDS"
    );
  }

  if (parsed.length > MAX_EXTRA_FIELDS) {
    throw new Error(
      "TOO_MANY_ADDITIONAL_FIELDS"
    );
  }

  const result: ExtraField[] = [];
  const seenKeys = new Set<string>();

  for (const entry of parsed) {
    if (!isRecord(entry)) {
      throw new Error(
        "INVALID_ADDITIONAL_FIELD"
      );
    }

    const key =
      requiredText(entry.key, 120);

    const label =
      requiredText(entry.label, 160);

    const fieldValue =
      requiredText(entry.value, 3000);

    if (
      isSensitiveFieldName(key) ||
      isSensitiveFieldName(label)
    ) {
      continue;
    }

    if (seenKeys.has(key)) {
      throw new Error(
        "DUPLICATE_ADDITIONAL_FIELD"
      );
    }

    seenKeys.add(key);

    result.push({
      key,
      label,
      value: fieldValue,
    });
  }

  return result;
}

/* ============================================================
   15. DOCUMENT MAPPING

   The API returns document metadata.

   It NEVER returns:
   - storage_key
   - S3 bucket credentials
   - filesystem paths
   - private object URLs

   The document reader endpoint
   must independently check
   access rights before serving
   file bytes.
   ============================================================ */

function mapDocument(
  row: DocumentRow
): ApplicationDocument {
  if (!isDocumentType(row.document_type)) {
    throw new Error(
      "INVALID_DOCUMENT_TYPE"
    );
  }

  if (
    !isVerificationStatus(
      row.verification_status
    )
  ) {
    throw new Error(
      "INVALID_DOCUMENT_STATUS"
    );
  }

  return {
    id: requiredText(row.id, 150),

    type: row.document_type,

    label: optionalText(row.label, 150),

    fileName: optionalText(
      row.file_name,
      250
    ),

    mimeType: optionalText(
      row.mime_type,
      100
    ),

    status:
      row.verification_status,

    uploadedAt:
      optionalTimestampToIso(
        row.uploaded_at
      ),
  };
}

/* ============================================================
   16. COMPLETE APPLICATION MAPPING

   Maps the PostgreSQL dossier into
   exactly the shape expected by:

   src/app/(admin)/admin/(protected)/
   applications/[id]/page.tsx
   ============================================================ */

function mapApplication(
  row: ApplicationRow,
  documents: ApplicationDocument[]
): ApplicationDetail {
  if (
    !isApplicationStatus(row.status) ||
    !isCountry(row.country_code)
  ) {
    throw new Error(
      "INVALID_APPLICATION_STATUS_OR_COUNTRY"
    );
  }

  if (row.details_present !== true) {
    throw new Error(
      "APPLICATION_DETAILS_MISSING"
    );
  }

  let decision: ApplicationDecision | null =
    null;

  if (row.decided_at !== null) {
    decision = {
      decidedAt:
        timestampToIso(
          row.decided_at
        ),

      reason:
        optionalText(
          row.decision_reason,
          1000
        ),
    };
  }

  return {
    id: requiredText(row.id, 150),

    reference:
      requiredText(row.reference, 120),

    status: row.status,

    countryCode: row.country_code,

    licenseClass:
      requiredText(
        row.license_class,
        100
      ),

    requestType:
      optionalText(
        row.request_type,
        150
      ),

    notes:
      optionalText(
        row.notes,
        3000
      ),

    createdAt:
      timestampToIso(
        row.created_at
      ),

    updatedAt:
      timestampToIso(
        row.updated_at
      ),

    applicant: {
      firstName:
        requiredText(
          row.first_name,
          150
        ),

      lastName:
        requiredText(
          row.last_name,
          150
        ),

      dateOfBirth:
        birthDateToIso(
          row.date_of_birth
        ),

      nationality:
        optionalText(
          row.nationality,
          120
        ),

      email:
        requiredText(
          row.email,
          254
        ),

      emailVerified:
        requiredBoolean(
          row.email_verified
        ),

      phoneE164:
        requiredText(
          row.phone_e164,
          40
        ),

      phoneVerified:
        requiredBoolean(
          row.phone_verified
        ),

      countryCode:
        row.country_code,

      streetAddress:
        optionalText(
          row.street_address,
          250
        ),

      postalCode:
        optionalText(
          row.postal_code,
          20
        ),

      city:
        optionalText(
          row.city,
          150
        ),
    },

    documents,

    additionalFields:
      parseAdditionalFields(
        row.additional_fields
      ),

    decision,
  };
}

/* ============================================================
   17. LOAD APPLICATION FROM POSTGRESQL

   One application is selected
   using its UUID.

   The main table is the same
   table used by the admin list.

   Additional details are joined
   by application ID.

   This prevents returning documents
   belonging to another candidate.

   No applicant document content
   is loaded in this query.
   ============================================================ */

async function getApplicationRow(
  client: PoolClient,
  applicationId: string
): Promise<ApplicationRow | null> {
  const result =
    await client.query<ApplicationRow>(
      `
      SELECT
        a.id::text AS id,

        COALESCE(a.reference, a.application_number) AS reference,

        CASE WHEN a.status = 'SUBMITTED' THEN 'PENDING'
             WHEN a.status IN ('REVIEWING', 'NEEDS_INFO') THEN 'IN_REVIEW'
             ELSE a.status END AS status,

        a.country_code,

        a.license_class,

        a.created_at,

        a.updated_at,

        a.first_name,

        a.last_name,

        a.email,

        TRUE AS details_present,
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
        '[]'::jsonb AS additional_fields,
        dec.created_at AS decided_at,
        dec.public_note AS decision_reason

      FROM
        license_applications a
      JOIN users u ON u.id = a.applicant_id
      LEFT JOIN LATERAL (
        SELECT created_at, public_note FROM application_status_history
        WHERE application_id = a.id AND new_status IN ('APPROVED', 'REJECTED')
        ORDER BY created_at DESC LIMIT 1
      ) dec ON TRUE

      WHERE
        a.id = $1::uuid

        AND a.status IN ('SUBMITTED', 'REVIEWING', 'NEEDS_INFO', 'APPROVED', 'REJECTED')

        AND a.country_code IN (
          'DE',
          'AT',
          'BE',
          'IT',
          'ES'
        )

      LIMIT 1
      `,
      [
        applicationId,
      ]
    );

  return result.rows[0] ?? null;
}

/* ============================================================
   18. LOAD DOCUMENT METADATA

   Documents must belong to the
   SAME application.

   No storage key selected.

   The document files themselves
   remain inaccessible through
   this endpoint.
   ============================================================ */

async function getDocumentMetadata(
  client: PoolClient,
  applicationId: string
): Promise<ApplicationDocument[]> {
  const result =
    await client.query<DocumentRow>(
      `
      SELECT
        id::text AS id,

        CASE COALESCE(type, document_type)
          WHEN 'ADDRESS_PROOF' THEN 'PROOF_OF_ADDRESS'
          WHEN 'PASSPORT_PHOTO' THEN 'PORTRAIT'
          WHEN 'IDENTITY_FRONT' THEN 'IDENTITY_FRONT'
          WHEN 'IDENTITY_BACK' THEN 'IDENTITY_BACK'
          WHEN 'SIGNATURE' THEN 'SIGNATURE'
          ELSE 'OTHER' END AS document_type,

        title AS label,

        COALESCE(file_name, original_name) AS file_name,

        mime_type,

        CASE review_status WHEN 'APPROVED' THEN 'VERIFIED'
          WHEN 'REJECTED' THEN 'REJECTED' ELSE 'PENDING' END AS verification_status,

        created_at AS uploaded_at

      FROM
        candidate_documents

      WHERE
        application_id = $1::uuid AND deleted_at IS NULL

      ORDER BY
        created_at ASC NULLS LAST,
        id ASC

      LIMIT $2
      `,
      [
        applicationId,
        MAX_DOCUMENTS + 1,
      ]
    );

  if (
    result.rows.length > MAX_DOCUMENTS
  ) {
    throw new Error(
      "DOCUMENT_LIMIT_EXCEEDED"
    );
  }

  return result.rows.map(
    mapDocument
  );
}

/* ============================================================
   19. CONSISTENT TRANSACTIONAL READ

   Ensures:
   - Session check
   - Application details
   - Documents
   - Decision

   are read from one consistent
   PostgreSQL snapshot.

   Read-only transaction.

   No modifications to applicant
   accounts or application status.
   ============================================================ */

async function readApplicationDetail(
  pool: Pool,
  tokenHash: string,
  applicationId: string
): Promise<ReadResult> {
  const client =
    await pool.connect();

  let transactionOpen = false;

  try {
    await client.query(
      `
      BEGIN TRANSACTION
      ISOLATION LEVEL REPEATABLE READ
      READ ONLY
      `
    );

    transactionOpen = true;

    /* ------------------------------------------------------
       A. Verify admin session
       ------------------------------------------------------ */

    const authenticated =
      await verifyAdminSession(
        client,
        tokenHash
      );

    if (!authenticated) {
      await client.query(
        "ROLLBACK"
      );

      transactionOpen = false;

      return {
        kind: "unauthorized",
      };
    }

    /* ------------------------------------------------------
       B. Load requested application
       ------------------------------------------------------ */

    const row =
      await getApplicationRow(
        client,
        applicationId
      );

    if (!row) {
      await client.query(
        "ROLLBACK"
      );

      transactionOpen = false;

      return {
        kind: "not_found",
      };
    }

    /* ------------------------------------------------------
       C. Load private document metadata

       No file bytes or storage keys.
       ------------------------------------------------------ */

    const documents =
      await getDocumentMetadata(
        client,
        applicationId
      );

    /* ------------------------------------------------------
       D. Map full applicant dossier
       ------------------------------------------------------ */

    const application =
      mapApplication(
        row,
        documents
      );

    /* ------------------------------------------------------
       E. Finish transaction
       ------------------------------------------------------ */

    await client.query(
      "COMMIT"
    );

    transactionOpen = false;

    return {
      kind: "found",
      application,
    };
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query(
          "ROLLBACK"
        );
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
   20. NEXT.JS DYNAMIC ROUTE TYPES

   Compatible with Next.js App Router
   versions where params is a Promise.
   ============================================================ */

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/* ============================================================
   21. GET /api/admin/applications/[id]

   STEP BY STEP:

   1. Read HttpOnly admin cookie
   2. Validate session token format
   3. Hash token
   4. Validate application UUID
   5. Open PostgreSQL connection
   6. Verify admin session in database
   7. Load one application
   8. Load associated documents metadata
   9. Load decision metadata
   10. Return JSON

   Never return private data for
   an unauthenticated session.
   ============================================================ */

export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  await connection();
  try {
    /* ------------------------------------------------------
       A. Read admin session
       ------------------------------------------------------ */

    const rawToken =
      request.cookies.get(
        SESSION_COOKIE
      )?.value;

    const tokenHash =
      hashSessionToken(
        rawToken
      );

    if (!tokenHash) {
      return errorResponse(
        401,
        "UNAUTHENTICATED"
      );
    }

    /* ------------------------------------------------------
       B. Read dynamic application ID
       ------------------------------------------------------ */

    const params =
      await context.params;

    const applicationId =
      normalizeApplicationId(
        params.id
      );

    if (!applicationId) {
      return errorResponse(
        400,
        "INVALID_APPLICATION_ID"
      );
    }

    /* ------------------------------------------------------
       C. PostgreSQL
       ------------------------------------------------------ */

    const pool =
      getDatabase();

    /* ------------------------------------------------------
       D. Authenticated detail read
       ------------------------------------------------------ */

    const result =
      await readApplicationDetail(
        pool,
        tokenHash,
        applicationId
      );

    /* ------------------------------------------------------
       E. Session invalid or revoked
       ------------------------------------------------------ */

    if (
      result.kind ===
      "unauthorized"
    ) {
      return errorResponse(
        401,
        "UNAUTHENTICATED"
      );
    }

    /* ------------------------------------------------------
       F. Application not found
       ------------------------------------------------------ */

    if (
      result.kind ===
      "not_found"
    ) {
      return errorResponse(
        404,
        "APPLICATION_NOT_FOUND"
      );
    }

    /* ------------------------------------------------------
       G. Return complete dossier
       ------------------------------------------------------ */

    return successResponse(
      result.application
    );
  } catch (error) {
    /*
     * Never log:
     * - Applicant identity
     * - Application contents
     * - Document metadata
     * - Session tokens
     * - Token hashes
     * - Database credentials
     */

    console.error(
      "[TAYM_ADMIN_APPLICATION_DETAIL]",
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
