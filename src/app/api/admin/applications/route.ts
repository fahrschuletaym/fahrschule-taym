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
   ADMIN — APPLICATIONS API

   FILE:
   src/app/api/admin/applications/route.ts

   ENDPOINT:
   GET /api/admin/applications

   FRONTEND:
   /admin/applications

   DATABASE:
   PostgreSQL

   APPLICATION TABLE:
   taym_driving_license_applications

   SESSION TABLE:
   taym_admin_sessions

   SESSION COOKIE:
   taym_admin_session

   ADMINISTRATOR:
   primary

   SUPPORTED FILTERS:
   - page
   - pageSize
   - search
   - country
   - status

   SECURITY:
   - Server-side admin authentication
   - Session expiration verification
   - Session revocation verification
   - Parameterized SQL
   - Strict query validation
   - Server-side pagination
   - Database-consistent reads
   - No document storage keys
   - No private document contents
   - No response caching

   ============================================================ */




/* ============================================================
   1. CONFIGURATION
   ============================================================ */

const SESSION_COOKIE =
  "taym_admin_session";

const ADMIN_ID =
  "primary";

const SESSION_TOKEN_REGEX =
  /^[a-f0-9]{64}$/;

const DEFAULT_PAGE = 1;

const DEFAULT_PAGE_SIZE = 15;

const MAX_PAGE = 100_000;

const MAX_PAGE_SIZE = 50;

const MAX_SEARCH_LENGTH = 120;

const MAX_QUERY_LENGTH = 1024;

// Read the same submitted applications as the candidate dashboard.
const APPLICATIONS_SOURCE = `(
  SELECT id, COALESCE(reference, application_number) AS reference,
    first_name, last_name, email, country_code, license_class, created_at, updated_at,
    CASE WHEN status = 'SUBMITTED' THEN 'PENDING'
         WHEN status IN ('REVIEWING', 'NEEDS_INFO') THEN 'IN_REVIEW'
         ELSE status END AS status
  FROM license_applications
  WHERE status IN ('SUBMITTED', 'REVIEWING', 'NEEDS_INFO', 'APPROVED', 'REJECTED')
) AS candidate_applications`;

/* ============================================================
   2. ALLOWED COUNTRIES AND STATUSES
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

const STATUSES = [
  "PENDING",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
] as const;

type ApplicationStatus =
  (typeof STATUSES)[number];

/* ============================================================
   3. TYPES
   ============================================================ */

type ApplicationFilters = {
  page: number;
  pageSize: number;
  country: Country | null;
  status: ApplicationStatus | null;
  search: string | null;
};

type ApplicationRecord = {
  id: string;
  reference: string;
  firstName: string;
  lastName: string;
  email: string;
  countryCode: Country;
  licenseClass: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
};

type ApplicationStatistics = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};

type PaginatedApplications = {
  items: ApplicationRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type ApplicationsSuccess = {
  success: true;
  stats: ApplicationStatistics;
  applications: PaginatedApplications;
  generatedAt: string;
};

type ErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_QUERY"
  | "INVALID_PAGE"
  | "SERVICE_UNAVAILABLE";

type ApplicationsError = {
  success: false;
  code: ErrorCode;
};

type StatsRow = {
  total: string | number;
  pending: string | number;
  approved: string | number;
  rejected: string | number;
};

type CountRow = {
  total: string | number;
};

type DatabaseApplicationRow = {
  id: string;
  reference: string;
  first_name: string;
  last_name: string;
  email: string;
  country_code: string;
  license_class: string;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type QueryCondition = {
  where: string;
  params: Array<string>;
};

type ReadResult =
  | {
      kind: "unauthorized";
    }
  | {
      kind: "invalid_page";
    }
  | {
      kind: "success";
      result: Omit<
        ApplicationsSuccess,
        "success"
      >;
    };

/* ============================================================
   4. RESPONSE SECURITY HEADERS
   ============================================================ */

const SECURITY_HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, max-age=0, must-revalidate",

  Pragma: "no-cache",

  Expires: "0",

  "X-Content-Type-Options":
    "nosniff",

  "Referrer-Policy":
    "no-referrer",

  Vary: "Cookie",
};

/* ============================================================
   5. DATABASE CONNECTION

   Uses the same pool key as:
   - admin login
   - admin logout
   - admin session
   - admin dashboard

   No new independent pool is
   created when an existing pool
   is available in the process.
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
        connectionString:
          databaseUrl,

        max: 5,

        idleTimeoutMillis:
          30_000,

        connectionTimeoutMillis:
          5_000,

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
   6. RESPONSE HELPERS
   ============================================================ */

function errorResponse(
  status: number,
  code: ErrorCode
): NextResponse<ApplicationsError> {
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
  value: Omit<
    ApplicationsSuccess,
    "success"
  >
): NextResponse<ApplicationsSuccess> {
  return NextResponse.json(
    {
      success: true,
      ...value,
    },
    {
      status: 200,
      headers: SECURITY_HEADERS,
    }
  );
}

/* ============================================================
   7. HASH SESSION TOKEN

   Same algorithm as admin login:

   createHash("sha256")
     .update(Buffer.from(token, "hex"))
     .digest("hex")

   Never query PostgreSQL with the
   plaintext session token.
   ============================================================ */

function hashSessionToken(
  token: string | undefined
): string | null {
  if (
    !token ||
    !SESSION_TOKEN_REGEX.test(token)
  ) {
    return null;
  }

  return createHash("sha256")
    .update(
      Buffer.from(token, "hex")
    )
    .digest("hex");
}

/* ============================================================
   8. VERIFY ADMINISTRATOR SESSION

   Every request must confirm:

   - Matching session hash
   - Administrator = primary
   - Session not revoked
   - Session not expired

   Merely possessing a cookie
   does not grant access.
   ============================================================ */

async function verifyAdminSession(
  client: PoolClient,
  tokenHash: string
): Promise<boolean> {
  const result =
    await client.query<{
      admin_id: string;
    }>(
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
   9. FILTER VALIDATION
   ============================================================ */

function isCountry(
  value: unknown
): value is Country {
  return COUNTRIES.some(
    (country) => country === value
  );
}

function isStatus(
  value: unknown
): value is ApplicationStatus {
  return STATUSES.some(
    (status) => status === value
  );
}

function parsePositiveInteger(
  raw: string | null,
  defaultValue: number,
  maximum: number
): number | null {
  if (raw === null) {
    return defaultValue;
  }

  if (!/^[1-9]\d*$/.test(raw)) {
    return null;
  }

  const value = Number(raw);

  if (
    !Number.isSafeInteger(value) ||
    value > maximum
  ) {
    return null;
  }

  return value;
}

function parseFilters(
  request: NextRequest
): ApplicationFilters | null {
  /*
   * Reject excessively long queries.
   */

  if (
    request.nextUrl.search.length >
    MAX_QUERY_LENGTH
  ) {
    return null;
  }

  const params =
    request.nextUrl.searchParams;

  const allowed = new Set([
    "page",
    "pageSize",
    "search",
    "country",
    "status",
  ]);

  /*
   * Reject duplicate and unknown
   * query parameters.
   */

  if ([...params.keys()].length > 5) {
    return null;
  }

  for (const key of params.keys()) {
    if (
      !allowed.has(key) ||
      params.getAll(key).length !== 1
    ) {
      return null;
    }
  }

  /* --------------------------------------------------------
     Pagination
     -------------------------------------------------------- */

  const page =
    parsePositiveInteger(
      params.get("page"),
      DEFAULT_PAGE,
      MAX_PAGE
    );

  const pageSize =
    parsePositiveInteger(
      params.get("pageSize"),
      DEFAULT_PAGE_SIZE,
      MAX_PAGE_SIZE
    );

  if (
    page === null ||
    pageSize === null
  ) {
    return null;
  }

  /* --------------------------------------------------------
     Country
     -------------------------------------------------------- */

  const rawCountry =
    params.get("country");

  let country: Country | null =
    null;

  if (
    rawCountry !== null &&
    rawCountry !== "ALL"
  ) {
    if (!isCountry(rawCountry)) {
      return null;
    }

    country = rawCountry;
  }

  /* --------------------------------------------------------
     Application status
     -------------------------------------------------------- */

  const rawStatus =
    params.get("status");

  let status: ApplicationStatus | null =
    null;

  if (
    rawStatus !== null &&
    rawStatus !== "ALL"
  ) {
    if (!isStatus(rawStatus)) {
      return null;
    }

    status = rawStatus;
  }

  /* --------------------------------------------------------
     Search query
     -------------------------------------------------------- */

  const rawSearch =
    params.get("search");

  let search: string | null =
    null;

  if (rawSearch !== null) {
    const normalized =
      rawSearch
        .normalize("NFC")
        .trim();

    if (
      normalized.length >
        MAX_SEARCH_LENGTH ||
      /[\u0000-\u001F\u007F]/u.test(
        normalized
      )
    ) {
      return null;
    }

    search =
      normalized || null;
  }

  return {
    page,
    pageSize,
    country,
    status,
    search,
  };
}

/* ============================================================
   10. SAFE DATABASE COUNT CONVERSION

   PostgreSQL returns COUNT(*)
   as BIGINT, often represented
   by the pg driver as a string.

   Never silently replace an
   invalid count with zero.
   ============================================================ */

function safeCount(
  value: string | number | undefined
): number {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    throw new Error(
      "INVALID_DATABASE_COUNT"
    );
  }

  const count = Number(value);

  if (
    !Number.isSafeInteger(count) ||
    count < 0
  ) {
    throw new Error(
      "UNSAFE_DATABASE_COUNT"
    );
  }

  return count;
}

/* ============================================================
   11. SAFE DATABASE DATE CONVERSION
   ============================================================ */

function toIsoDate(
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
      "INVALID_DATABASE_DATE"
    );
  }

  return date.toISOString();
}

/* ============================================================
   12. VALIDATE DATABASE ROW

   Prevent malformed database data
   from being silently reported as
   a valid application.

   The frontend requires these fields.
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
      "INVALID_APPLICATION_DATA"
    );
  }

  return value;
}

function mapApplication(
  row: DatabaseApplicationRow
): ApplicationRecord {
  if (
    !isCountry(row.country_code) ||
    !isStatus(row.status)
  ) {
    throw new Error(
      "INVALID_APPLICATION_ENUM"
    );
  }

  return {
    id: requiredText(
      row.id,
      150
    ),

    reference: requiredText(
      row.reference,
      120
    ),

    firstName: requiredText(
      row.first_name,
      150
    ),

    lastName: requiredText(
      row.last_name,
      150
    ),

    email: requiredText(
      row.email,
      254
    ),

    countryCode:
      row.country_code,

    licenseClass: requiredText(
      row.license_class,
      80
    ),

    status: row.status,

    createdAt: toIsoDate(
      row.created_at
    ),

    updatedAt: toIsoDate(
      row.updated_at
    ),
  };
}

/* ============================================================
   13. GLOBAL STATISTICS

   These counts cover all five
   supported countries.

   They are intentionally NOT
   affected by list filters.

   pending = PENDING + IN_REVIEW

   approved = APPROVED

   rejected = REJECTED
   ============================================================ */

async function getStatistics(
  client: PoolClient
): Promise<ApplicationStatistics> {
  const result =
    await client.query<StatsRow>(
      `
      SELECT
        COUNT(*) AS total,

        COUNT(*) FILTER (
          WHERE status IN (
            'PENDING',
            'IN_REVIEW'
          )
        ) AS pending,

        COUNT(*) FILTER (
          WHERE status = 'APPROVED'
        ) AS approved,

        COUNT(*) FILTER (
          WHERE status = 'REJECTED'
        ) AS rejected

      FROM
        ${APPLICATIONS_SOURCE}

      WHERE
        country_code IN (
          'DE',
          'AT',
          'BE',
          'IT',
          'ES'
        )
      `
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new Error(
      "STATISTICS_NOT_AVAILABLE"
    );
  }

  return {
    total:
      safeCount(row.total),

    pending:
      safeCount(row.pending),

    approved:
      safeCount(row.approved),

    rejected:
      safeCount(row.rejected),
  };
}

/* ============================================================
   14. BUILD PARAMETERIZED FILTERS

   No dynamic SQL column names
   are accepted from the browser.

   Country and status are validated
   using strict allowlists.

   Search:
   - first name
   - last name
   - full name
   - email
   - application reference

   POSITION() treats "%" and "_"
   as literal search characters,
   unlike unescaped LIKE patterns.
   ============================================================ */

function buildWhere(
  filters: ApplicationFilters
): QueryCondition {
  const clauses: string[] = [
    `country_code IN (
      'DE',
      'AT',
      'BE',
      'IT',
      'ES'
    )`,
  ];

  const values: string[] = [];

  /* --------------------------------------------------------
     Country
     -------------------------------------------------------- */

  if (filters.country) {
    values.push(
      filters.country
    );

    clauses.push(
      `country_code = $${values.length}`
    );
  }

  /* --------------------------------------------------------
     Status
     -------------------------------------------------------- */

  if (filters.status) {
    values.push(
      filters.status
    );

    clauses.push(
      `status = $${values.length}`
    );
  }

  /* --------------------------------------------------------
     Search

     All user input is parameterized.
     -------------------------------------------------------- */

  if (filters.search) {
    values.push(
      filters.search.toLowerCase()
    );

    const position =
      values.length;

    clauses.push(
      `(
        POSITION(
          $${position}
          IN LOWER(first_name)
        ) > 0

        OR POSITION(
          $${position}
          IN LOWER(last_name)
        ) > 0

        OR POSITION(
          $${position}
          IN LOWER(
            CONCAT_WS(
              ' ',
              first_name,
              last_name
            )
          )
        ) > 0

        OR POSITION(
          $${position}
          IN LOWER(
            CONCAT_WS(
              ' ',
              last_name,
              first_name
            )
          )
        ) > 0

        OR POSITION(
          $${position}
          IN LOWER(email)
        ) > 0

        OR POSITION(
          $${position}
          IN LOWER(reference)
        ) > 0
      )`
    );
  }

  return {
    where:
      `WHERE ${clauses.join(" AND ")}`,

    params: values,
  };
}

/* ============================================================
   15. COUNT MATCHING APPLICATIONS

   Used for pagination metadata.

   The count is filtered by:
   - Country
   - Status
   - Search
   ============================================================ */

async function countApplications(
  client: PoolClient,
  condition: QueryCondition
): Promise<number> {
  const result =
    await client.query<CountRow>(
      `
      SELECT
        COUNT(*) AS total

      FROM
        ${APPLICATIONS_SOURCE}

      ${condition.where}
      `,
      condition.params
    );

  return safeCount(
    result.rows[0]?.total
  );
}

/* ============================================================
   16. FETCH APPLICATIONS

   Read only the fields required
   by the administration list.

   Do not select:
   - Identity documents
   - Storage keys
   - Identity images
   - Signatures
   - Passwords
   - Verification codes
   - Session tokens

   Those belong to a separate
   protected detail/document API.
   ============================================================ */

async function listApplications(
  client: PoolClient,
  condition: QueryCondition,
  page: number,
  pageSize: number
): Promise<ApplicationRecord[]> {
  const offset =
    (page - 1) * pageSize;

  const limitIndex =
    condition.params.length + 1;

  const offsetIndex =
    condition.params.length + 2;

  const params = [
    ...condition.params,
    pageSize,
    offset,
  ];

  const result =
    await client.query<DatabaseApplicationRow>(
      `
      SELECT
        id::text AS id,
        reference,
        first_name,
        last_name,
        email,
        country_code,
        license_class,
        status,
        created_at,
        updated_at

      FROM
        ${APPLICATIONS_SOURCE}

      ${condition.where}

      ORDER BY
        created_at DESC,
        id DESC

      LIMIT $${limitIndex}

      OFFSET $${offsetIndex}
      `,
      params
    );

  return result.rows.map(
    mapApplication
  );
}

/* ============================================================
   17. CONSISTENT READ TRANSACTION

   One PostgreSQL snapshot for:

   - Authentication
   - Global statistics
   - Filtered count
   - Filtered application list

   No insert, update or delete.

   Session validation is part of
   the protected read operation.
   ============================================================ */

async function readApplications(
  pool: Pool,
  tokenHash: string,
  filters: ApplicationFilters
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
       A. Verify administrator session
       -------------------------------------------------------- */

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
       B. Get global statistics
       -------------------------------------------------------- */

    const stats =
      await getStatistics(
        client
      );

    /* ------------------------------------------------------
       C. Build list filters
       -------------------------------------------------------- */

    const condition =
      buildWhere(
        filters
      );

    /* ------------------------------------------------------
       D. Count filtered results
       -------------------------------------------------------- */

    const total =
      await countApplications(
        client,
        condition
      );

    const totalPages =
      Math.max(
        1,
        Math.ceil(
          total / filters.pageSize
        )
      );

    /* ------------------------------------------------------
       E. Handle out-of-range page

       The current frontend expects:
       page <= totalPages.

       Returning HTTP 400 avoids
       a malformed success response.
       -------------------------------------------------------- */

    if (
      filters.page > totalPages
    ) {
      await client.query(
        "ROLLBACK"
      );

      transactionOpen = false;

      return {
        kind: "invalid_page",
      };
    }

    /* ------------------------------------------------------
       F. Read matching applications
       -------------------------------------------------------- */

    const items =
      await listApplications(
        client,
        condition,
        filters.page,
        filters.pageSize
      );

    /* ------------------------------------------------------
       G. Commit read-only transaction
       -------------------------------------------------------- */

    await client.query(
      "COMMIT"
    );

    transactionOpen = false;

    return {
      kind: "success",

      result: {
        stats,

        applications: {
          items,

          page:
            filters.page,

          pageSize:
            filters.pageSize,

          total,

          totalPages,
        },

        generatedAt:
          new Date().toISOString(),
      },
    };
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {
        // Preserve the original failure.
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

/* ============================================================
   18. GET /api/admin/applications

   Security flow:

   1. Read session cookie
   2. Validate token format
   3. Hash session token
   4. Validate query parameters
   5. Open PostgreSQL transaction
   6. Verify active admin session
   7. Fetch real statistics
   8. Count filtered applications
   9. Fetch paginated records
   10. Return JSON response

   Never return applicant records
   for an unauthenticated request.
   ============================================================ */

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  await connection();
  try {
    /* ------------------------------------------------------
       A. Read the admin session cookie
       -------------------------------------------------------- */

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
       B. Validate pagination and filters
       -------------------------------------------------------- */

    const filters =
      parseFilters(
        request
      );

    if (!filters) {
      return errorResponse(
        400,
        "INVALID_QUERY"
      );
    }

    /* ------------------------------------------------------
       C. Connect to PostgreSQL
       -------------------------------------------------------- */

    const pool =
      getDatabase();

    /* ------------------------------------------------------
       D. Read authenticated data
       -------------------------------------------------------- */

    const result =
      await readApplications(
        pool,
        tokenHash,
        filters
      );

    /* ------------------------------------------------------
       E. Reject invalid/expired session
       -------------------------------------------------------- */

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
       F. Reject invalid page
       -------------------------------------------------------- */

    if (
      result.kind ===
      "invalid_page"
    ) {
      return errorResponse(
        400,
        "INVALID_PAGE"
      );
    }

    /* ------------------------------------------------------
       G. Return real data
       -------------------------------------------------------- */

    return successResponse(
      result.result
    );
  } catch (error) {
    /*
     * Never log:
     * - Session tokens
     * - Session hashes
     * - Applicant details
     * - Search contents
     * - Database connection strings
     */

    console.error(
      "[TAYM_ADMIN_APPLICATIONS]",
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
