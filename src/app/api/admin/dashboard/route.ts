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
   ADMIN DASHBOARD API

   FILE:
   src/app/api/admin/dashboard/route.ts

   ENDPOINT:
   GET /api/admin/dashboard

   AUTHENTICATION:
   Cookie: taym_admin_session
   Table:  taym_admin_sessions
   Admin:  primary

   DATABASE:
   PostgreSQL

   APPLICATION TABLE:
   taym_driving_license_applications

   ACTIVITY TABLE:
   taym_admin_activity_logs

   RESPONSE:
   {
     success: true,
     stats: {
       total,
       pending,
       approved,
       rejected
     },
     activities: {
       items,
       page,
       pageSize,
       total,
       totalPages
     },
     generatedAt
   }

   SECURITY:
   - Real server-side session validation
   - Session revocation check
   - Parameterized SQL queries
   - Strict filter validation
   - Limited pagination
   - No sensitive document contents
   - No fake activity or statistics
   - PostgreSQL consistent snapshot
   - No HTTP response caching
   ============================================================ */




/* ============================================================
   1. CONSTANTS
   ============================================================ */

const SESSION_COOKIE =
  "taym_admin_session";

const ADMIN_ID =
  "primary";

const TOKEN_PATTERN =
  /^[a-f0-9]{64}$/;

const DEFAULT_PAGE = 1;

const DEFAULT_PAGE_SIZE = 15;

const MAX_PAGE_SIZE = 50;

const MAX_PAGE = 100_000;

const MAX_SEARCH_LENGTH = 120;

const MAX_QUERY_PARAMETERS = 5;

/* ============================================================
   2. TYPES
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

const ACTIVITY_TYPES = [
  "APPLICATION_CREATED",
  "APPLICATION_UPDATED",
  "APPLICATION_APPROVED",
  "APPLICATION_REJECTED",
  "USER_REGISTERED",
  "EMAIL_VERIFIED",
  "PHONE_VERIFIED",
  "DOCUMENT_UPLOADED",
  "DOCUMENT_VERIFIED",
  "RESERVATION_CREATED",
  "OTHER",
] as const;

type ActivityType =
  (typeof ACTIVITY_TYPES)[number];

type QueryFilters = {
  page: number;
  pageSize: number;
  country: Country | null;
  type: ActivityType | null;
  search: string | null;
};

type DashboardStats = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};

type DashboardActivity = {
  id: string;
  type: ActivityType;
  createdAt: string;
  countryCode: Country | null;
  applicationId: string | null;
  applicationReference: string | null;
  actorName: string | null;
  description: string | null;
};

type ActivitiesResponse = {
  items: DashboardActivity[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type SuccessResponse = {
  success: true;
  stats: DashboardStats;
  activities: ActivitiesResponse;
  generatedAt: string;
};

type ErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_QUERY"
  | "SERVICE_UNAVAILABLE";

type ErrorResponse = {
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

type ActivityRow = {
  id: string;
  type: string;
  created_at: Date | string;
  country_code: string | null;
  application_id: string | null;
  application_reference: string | null;
  actor_name: string | null;
  description: string | null;
};

type SessionRow = {
  admin_id: string;
};

type SqlFilter = {
  where: string;
  values: Array<string>;
};

/* ============================================================
   3. RESPONSE HEADERS

   Never cache administrator data.
   ============================================================ */

const HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, max-age=0, must-revalidate",

  Pragma: "no-cache",

  Expires: "0",

  "X-Content-Type-Options":
    "nosniff",

  "Referrer-Policy":
    "no-referrer",

  "Vary": "Cookie",
};

/* ============================================================
   4. DATABASE CONNECTION

   Reuse the same global pool key
   configured in the admin login,
   logout and session APIs.

   Environment:
   DATABASE_URL
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
   5. RESPONSE HELPERS
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
      headers: HEADERS,
    }
  );
}

function successResponse(
  data: Omit<SuccessResponse, "success">
): NextResponse<SuccessResponse> {
  return NextResponse.json(
    {
      success: true,
      ...data,
    },
    {
      status: 200,
      headers: HEADERS,
    }
  );
}

/* ============================================================
   6. SESSION TOKEN HASH

   Must match admin login:

   randomBytes(32).toString("hex")

   SHA256(Buffer.from(token, "hex"))

   No raw session token is stored
   in PostgreSQL.
   ============================================================ */

function hashSessionToken(
  token: string | undefined
): string | null {
  if (
    !token ||
    !TOKEN_PATTERN.test(token)
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
   7. SERVER-SIDE AUTHORIZATION

   Do not trust:
   - Local storage
   - Browser-provided admin ID
   - The mere presence of a cookie

   PostgreSQL must confirm:
   - Token hash exists
   - Admin identity matches
   - Session is not revoked
   - Session is not expired

   Returns false for invalid sessions.
   Throws on database failures.
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
   8. QUERY VALIDATION

   Supported:
   ?page=1
   &pageSize=15
   &country=DE
   &type=APPLICATION_CREATED
   &search=Max

   Unknown or duplicate parameters
   are rejected.

   This prevents ambiguous queries
   and unnecessarily large requests.
   ============================================================ */

function parsePositiveInteger(
  value: string | null,
  defaultValue: number,
  maximum: number
): number | null {
  if (value === null) {
    return defaultValue;
  }

  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const number = Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number > maximum
  ) {
    return null;
  }

  return number;
}

function isCountry(
  value: string
): value is Country {
  return COUNTRIES.some(
    (country) => country === value
  );
}

function isActivityType(
  value: string
): value is ActivityType {
  return ACTIVITY_TYPES.some(
    (type) => type === value
  );
}

function parseFilters(
  request: NextRequest
): QueryFilters | null {
  const params =
    request.nextUrl.searchParams;

  const supported = new Set([
    "page",
    "pageSize",
    "country",
    "type",
    "search",
  ]);

  if (
    [...params.keys()].length >
    MAX_QUERY_PARAMETERS
  ) {
    return null;
  }

  for (const key of params.keys()) {
    if (
      !supported.has(key) ||
      params.getAll(key).length !== 1
    ) {
      return null;
    }
  }

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

  const countryRaw =
    params.get("country");

  let country: Country | null = null;

  if (
    countryRaw !== null &&
    countryRaw !== "ALL"
  ) {
    if (!isCountry(countryRaw)) {
      return null;
    }

    country = countryRaw;
  }

  const typeRaw =
    params.get("type");

  let type: ActivityType | null = null;

  if (
    typeRaw !== null &&
    typeRaw !== "ALL"
  ) {
    if (!isActivityType(typeRaw)) {
      return null;
    }

    type = typeRaw;
  }

  const searchRaw =
    params.get("search");

  let search: string | null = null;

  if (searchRaw !== null) {
    const normalized =
      searchRaw.normalize("NFC").trim();

    if (
      normalized.length >
        MAX_SEARCH_LENGTH ||
      /[\u0000-\u001F\u007F]/u.test(
        normalized
      )
    ) {
      return null;
    }

    search = normalized || null;
  }

  return {
    page,
    pageSize,
    country,
    type,
    search,
  };
}

/* ============================================================
   9. SAFE COUNT CONVERSION

   PostgreSQL COUNT(*) can return
   bigint values as strings.

   Do not silently convert invalid
   or unsafe values into zero.
   ============================================================ */

function safeCount(
  value: string | number | undefined
): number {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    throw new Error(
      "INVALID_COUNT_VALUE"
    );
  }

  const number = Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number < 0
  ) {
    throw new Error(
      "UNSAFE_COUNT_VALUE"
    );
  }

  return number;
}

/* ============================================================
   10. STATISTICS

   Important:

   total:
     Every driving-license request

   pending:
     PENDING + IN_REVIEW

   approved:
     APPROVED

   rejected:
     REJECTED

   These statistics always cover
   all five countries.

   Activity filters must not
   modify the four counters.
   ============================================================ */

async function getStatistics(
  client: PoolClient
): Promise<DashboardStats> {
  const result =
    await client.query<StatsRow>(
      `
      SELECT

        COUNT(*) AS total,

        COUNT(*) FILTER (
          WHERE status IN (
            'SUBMITTED',
            'REVIEWING',
            'NEEDS_INFO'
          )
        ) AS pending,

        COUNT(*) FILTER (
          WHERE status = 'APPROVED'
        ) AS approved,

        COUNT(*) FILTER (
          WHERE status = 'REJECTED'
        ) AS rejected

      FROM
        license_applications

      WHERE
        status IN ('SUBMITTED', 'REVIEWING', 'NEEDS_INFO', 'APPROVED', 'REJECTED') AND
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
      "STATISTICS_NOT_RETURNED"
    );
  }

  return {
    total: safeCount(row.total),

    pending: safeCount(
      row.pending
    ),

    approved: safeCount(
      row.approved
    ),

    rejected: safeCount(
      row.rejected
    ),
  };
}

/* ============================================================
   11. SQL FILTER GENERATOR

   Only whitelisted columns.

   Values are always parameterized.

   Search includes:
   - Actor name
   - Application reference
   - Activity description

   Documents, passwords, security
   tokens and verification codes
   must NEVER be indexed into
   activity descriptions.
   ============================================================ */

function escapeLike(
  value: string
): string {
  return value.replace(
    /[\\%_]/g,
    "\\$&"
  );
}

function buildActivityFilter(
  filters: QueryFilters
): SqlFilter {
  const clauses: string[] = [];

  const values: string[] = [];

  if (filters.country) {
    values.push(filters.country);

    clauses.push(
      `country_code = $${values.length}`
    );
  }

  if (filters.type) {
    values.push(filters.type);

    clauses.push(
      `type = $${values.length}`
    );
  }

  if (filters.search) {
    values.push(
      `%${escapeLike(filters.search)}%`
    );

    const position =
      values.length;

    clauses.push(
      `(
        actor_name ILIKE $${position}
          ESCAPE E'\\\\'
        OR application_reference
          ILIKE $${position}
          ESCAPE E'\\\\'
        OR description
          ILIKE $${position}
          ESCAPE E'\\\\'
      )`
    );
  }

  return {
    where:
      clauses.length > 0
        ? `WHERE ${clauses.join(" AND ")}`
        : "",

    values,
  };
}

/* ============================================================
   12. ACTIVITY LOG COUNT

   Pagination counts are calculated
   in PostgreSQL, not in JavaScript.

   Country, event type and search
   are applied to the SQL query.
   ============================================================ */

async function countActivities(
  client: PoolClient,
  filter: SqlFilter
): Promise<number> {
  const result =
    await client.query<CountRow>(
      `
      SELECT
        COUNT(*) AS total

      FROM
        taym_admin_activity_logs

      ${filter.where}
      `,
      filter.values
    );

  return safeCount(
    result.rows[0]?.total
  );
}

/* ============================================================
   13. ACTIVITY LOG LIST

   Server-side pagination:
   LIMIT + OFFSET

   Newest events first.

   Each event must already have
   been recorded by the backend.

   The API does not manufacture
   missing audit events.
   ============================================================ */

async function listActivities(
  client: PoolClient,
  filter: SqlFilter,
  page: number,
  pageSize: number
): Promise<DashboardActivity[]> {
  const offset =
    (page - 1) * pageSize;

  const limitPosition =
    filter.values.length + 1;

  const offsetPosition =
    filter.values.length + 2;

  const values = [
    ...filter.values,
    pageSize,
    offset,
  ];

  const result =
    await client.query<ActivityRow>(
      `
      SELECT
        id,
        type,
        created_at,
        country_code,
        application_id,
        application_reference,
        actor_name,
        description

      FROM
        taym_admin_activity_logs

      ${filter.where}

      ORDER BY
        created_at DESC,
        id DESC

      LIMIT $${limitPosition}

      OFFSET $${offsetPosition}
      `,
      values
    );

  return result.rows.map(
    (row) => {
      const createdAt =
        row.created_at instanceof Date
          ? row.created_at
          : new Date(
              row.created_at
            );

      if (
        !Number.isFinite(
          createdAt.getTime()
        )
      ) {
        throw new Error(
          "INVALID_ACTIVITY_DATE"
        );
      }

      if (
        !isActivityType(row.type)
      ) {
        throw new Error(
          "INVALID_ACTIVITY_TYPE"
        );
      }

      if (
        row.country_code !== null &&
        !isCountry(
          row.country_code
        )
      ) {
        throw new Error(
          "INVALID_ACTIVITY_COUNTRY"
        );
      }

      return {
        id: row.id,

        type: row.type,

        createdAt:
          createdAt.toISOString(),

        countryCode:
          row.country_code,

        applicationId:
          row.application_id,

        applicationReference:
          row.application_reference,

        actorName:
          row.actor_name,

        description:
          row.description,
      };
    }
  );
}

/* ============================================================
   14. TRANSACTIONAL DASHBOARD READ

   A REPEATABLE READ snapshot keeps:
   - statistics
   - activity count
   - activity page

   internally consistent during
   a single API request.

   The session is also verified
   inside the transaction.

   No write operations are made.
   ============================================================ */

async function readDashboard(
  pool: Pool,
  tokenHash: string,
  filters: QueryFilters
): Promise<
  | {
      authenticated: false;
    }
  | {
      authenticated: true;
      data: Omit<
        SuccessResponse,
        "success"
      >;
    }
> {
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
       A. Verify authorized session
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
        authenticated: false,
      };
    }

    /* ------------------------------------------------------
       B. Aggregate statistics
       ------------------------------------------------------ */

    const stats =
      await getStatistics(
        client
      );

    /* ------------------------------------------------------
       C. Activity filters
       ------------------------------------------------------ */

    const sqlFilter =
      buildActivityFilter(
        filters
      );

    /* ------------------------------------------------------
       D. Total matching events
       ------------------------------------------------------ */

    const total =
      await countActivities(
        client,
        sqlFilter
      );

    const totalPages =
      Math.max(
        1,
        Math.ceil(
          total /
            filters.pageSize
        )
      );

    /* ------------------------------------------------------
       E. Get requested page

       An out-of-range page returns
       an empty array, with actual
       pagination metadata.
       ------------------------------------------------------ */

    const items =
      filters.page > totalPages
        ? []
        : await listActivities(
            client,
            sqlFilter,
            filters.page,
            filters.pageSize
          );

    /* ------------------------------------------------------
       F. Finish consistent read
       ------------------------------------------------------ */

    await client.query(
      "COMMIT"
    );

    transactionOpen = false;

    return {
      authenticated: true,

      data: {
        stats,

        activities: {
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
        // Preserve original error.
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

/* ============================================================
   15. GET /api/admin/dashboard

   Steps:

   1. Check session cookie
   2. Validate token
   3. Validate filters
   4. Open PostgreSQL transaction
   5. Verify administrator session
   6. Fetch statistics
   7. Count matching activities
   8. Fetch paginated activities
   9. Return the frontend contract

   Never report success if a database
   query fails or the session is invalid.
   ============================================================ */

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  await connection();
  try {
    /* ------------------------------------------------------
       A. Read cookie

       Authentication is determined
       exclusively on the server.
       ------------------------------------------------------ */

    const token =
      request.cookies.get(
        SESSION_COOKIE
      )?.value;

    const tokenHash =
      hashSessionToken(
        token
      );

    if (!tokenHash) {
      return errorResponse(
        401,
        "UNAUTHENTICATED"
      );
    }

    /* ------------------------------------------------------
       B. Validate query parameters
       ------------------------------------------------------ */

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
       C. Read PostgreSQL
       ------------------------------------------------------ */

    const pool =
      getDatabase();

    const result =
      await readDashboard(
        pool,
        tokenHash,
        filters
      );

    /* ------------------------------------------------------
       D. Expired / revoked session
       ------------------------------------------------------ */

    if (!result.authenticated) {
      return errorResponse(
        401,
        "UNAUTHENTICATED"
      );
    }

    /* ------------------------------------------------------
       E. Successful response
       ------------------------------------------------------ */

    return successResponse(
      result.data
    );
  } catch (error) {
    /*
     * Do not leak:
     * - SQL details
     * - Session tokens
     * - Personal data
     * - Database credentials
     */

    console.error(
      "[TAYM_ADMIN_DASHBOARD]",
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
