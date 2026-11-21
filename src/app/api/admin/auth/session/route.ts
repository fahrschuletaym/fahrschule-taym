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
   ADMIN AUTHENTICATION — SESSION

   FILE:
   src/app/api/admin/auth/session/route.ts

   ENDPOINT:
   GET /api/admin/auth/session

   COMPATIBLE WITH:
   - /api/admin/auth/login
   - /api/admin/auth/logout

   DATABASE:
   PostgreSQL

   TABLE:
   taym_admin_sessions

   SESSION COOKIE:
   taym_admin_session

   ADMINISTRATOR ID:
   primary

   SECURITY:
   - Server-side session validation
   - SHA-256 token hashing
   - PostgreSQL authorization check
   - Expiration validation
   - Revocation validation
   - HttpOnly cookie compatibility
   - No sensitive data returned
   - No caching of authentication state
   - Fail closed on database errors

   ============================================================ */




/* ============================================================
   1. CONFIGURATION

   These values MUST match
   the login and logout APIs.
   ============================================================ */

const SESSION_COOKIE =
  "taym_admin_session";

const ADMIN_ID =
  "primary";

const SESSION_TOKEN_PATTERN =
  /^[a-f0-9]{64}$/;

/* ============================================================
   2. HTTP SECURITY HEADERS

   Authentication information must
   never be cached by browsers,
   proxies or CDNs.
   ============================================================ */

const SECURITY_HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, max-age=0, must-revalidate",

  Pragma:
    "no-cache",

  Expires:
    "0",

  "X-Content-Type-Options":
    "nosniff",

  "Referrer-Policy":
    "no-referrer",
};

/* ============================================================
   3. POSTGRESQL CONNECTION

   Reuse the exact shared pool key
   from the login and logout APIs.

   The database URL is read only
   on the server.

   No PostgreSQL credentials
   are sent to the browser.
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

  if (
    !shared.__taymAdminAuthPool
  ) {
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

  return shared.__taymAdminAuthPool;
}

/* ============================================================
   4. RESPONSE TYPES
   ============================================================ */

type SessionSuccessResponse = {
  success: true;

  authenticated: true;

  admin: {
    role: "ADMIN";
  };

  expiresAt: string;
};

type SessionErrorCode =
  | "UNAUTHENTICATED"
  | "SESSION_EXPIRED"
  | "SERVICE_UNAVAILABLE";

type SessionErrorResponse = {
  success: false;

  authenticated: false;

  code: SessionErrorCode;
};

/* ============================================================
   5. SUCCESS RESPONSE

   Do not expose:
   - raw session token
   - token hash
   - administrator password
   - password hash
   - database identifiers
   - private user information
   ============================================================ */

function authenticatedResponse(
  expiresAt: Date
): NextResponse<SessionSuccessResponse> {
  return NextResponse.json(
    {
      success: true,

      authenticated: true,

      admin: {
        role: "ADMIN",
      },

      expiresAt:
        expiresAt.toISOString(),
    },
    {
      status: 200,

      headers:
        SECURITY_HEADERS,
    }
  );
}

/* ============================================================
   6. ERROR RESPONSE
   ============================================================ */

function errorResponse(
  status: number,
  code: SessionErrorCode
): NextResponse<SessionErrorResponse> {
  return NextResponse.json(
    {
      success: false,

      authenticated: false,

      code,
    },
    {
      status,

      headers:
        SECURITY_HEADERS,
    }
  );
}

/* ============================================================
   7. CLEAR INVALID COOKIE

   Compatible with the cookie
   configuration from login.

   This function only clears
   an invalid browser cookie.

   It does not revoke any other
   administrator session.
   ============================================================ */

function clearSessionCookie(
  response: NextResponse
): void {
  response.cookies.set({
    name:
      SESSION_COOKIE,

    value: "",

    httpOnly: true,

    secure:
      process.env.NODE_ENV ===
      "production",

    sameSite: "strict",

    path: "/",

    expires:
      new Date(0),

    maxAge: 0,

    priority: "high",
  });
}

/* ============================================================
   8. UNAUTHENTICATED RESPONSE

   The cookie is removed when
   absent, malformed, expired,
   revoked or unknown.

   This prevents browsers from
   repeatedly sending unusable
   session tokens.
   ============================================================ */

function unauthenticatedResponse(
  code:
    | "UNAUTHENTICATED"
    | "SESSION_EXPIRED" =
      "UNAUTHENTICATED"
): NextResponse {
  const response =
    errorResponse(
      401,
      code
    );

  clearSessionCookie(
    response
  );

  return response;
}

/* ============================================================
   9. HASH SESSION TOKEN

   Login generates:
   randomBytes(32).toString("hex")

   Login stores:
   SHA-256(Buffer.from(token, "hex"))

   Session validation MUST use
   the identical algorithm.

   Never query PostgreSQL using
   the plaintext cookie token.
   ============================================================ */

function hashSessionToken(
  rawToken: string
): string | null {
  if (
    !SESSION_TOKEN_PATTERN.test(
      rawToken
    )
  ) {
    return null;
  }

  return createHash(
    "sha256"
  )
    .update(
      Buffer.from(
        rawToken,
        "hex"
      )
    )
    .digest("hex");
}

/* ============================================================
   10. DATABASE SESSION TYPES
   ============================================================ */

type DatabaseAdminSession = {
  admin_id: string;

  expires_at:
    | Date
    | string;
};

type SessionLookupResult =
  | {
      valid: true;
      expiresAt: Date;
    }
  | {
      valid: false;
    };

/* ============================================================
   11. VALIDATE SESSION IN POSTGRESQL

   The session is accepted ONLY
   when all conditions are true:

   1. Token hash exists
   2. Administrator ID matches
   3. revoked_at IS NULL
   4. expires_at > NOW()

   Expiration is evaluated
   using PostgreSQL server time.

   The database query is
   parameterized to prevent
   SQL injection.
   ============================================================ */

async function verifyAdminSession(
  pool: Pool,
  tokenHash: string
): Promise<SessionLookupResult> {
  const result =
    await pool.query<DatabaseAdminSession>(
      `
      SELECT
        admin_id,
        expires_at

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

  const session =
    result.rows[0];

  if (!session) {
    return {
      valid: false,
    };
  }

  /*
   * Defense in depth:
   * SQL already checked admin_id.
   */

  if (
    session.admin_id !==
    ADMIN_ID
  ) {
    return {
      valid: false,
    };
  }

  const expiresAt =
    session.expires_at instanceof Date
      ? session.expires_at
      : new Date(
          session.expires_at
        );

  if (
    !Number.isFinite(
      expiresAt.getTime()
    )
  ) {
    throw new Error(
      "INVALID_SESSION_EXPIRATION"
    );
  }

  return {
    valid: true,
    expiresAt,
  };
}

/* ============================================================
   12. GET /api/admin/auth/session

   STEP BY STEP:

   A. Read session cookie
   B. Validate token format
   C. Generate token hash
   D. Query PostgreSQL
   E. Check the authorized admin
   F. Check expiration/revocation
   G. Return minimal safe response

   No login action is performed.
   No new session is created.
   No session is automatically extended.
   ============================================================ */

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  await connection();
  try {
    /* ------------------------------------------------------
       A. Read HttpOnly session cookie

       Reading the cookie on the
       server does not expose it
       to client-side JavaScript.
       ------------------------------------------------------ */

    const rawToken =
      request.cookies.get(
        SESSION_COOKIE
      )?.value;

    /* ------------------------------------------------------
       B. Missing cookie

       No authentication is possible.
       ------------------------------------------------------ */

    if (!rawToken) {
      return unauthenticatedResponse();
    }

    /* ------------------------------------------------------
       C. Validate and hash token

       Reject unexpected token
       lengths and characters.
       ------------------------------------------------------ */

    const tokenHash =
      hashSessionToken(
        rawToken
      );

    if (!tokenHash) {
      return unauthenticatedResponse();
    }

    /* ------------------------------------------------------
       D. Connect to PostgreSQL
       ------------------------------------------------------ */

    const pool =
      getDatabase();

    /* ------------------------------------------------------
       E. Verify session

       Check:
       - matching token hash
       - primary admin identity
       - not revoked
       - not expired
       ------------------------------------------------------ */

    const verification =
      await verifyAdminSession(
        pool,
        tokenHash
      );

    /* ------------------------------------------------------
       F. Invalid / expired / revoked

       Do not provide access.
       Remove unusable cookie.
       ------------------------------------------------------ */

    if (!verification.valid) {
      return unauthenticatedResponse(
        "SESSION_EXPIRED"
      );
    }

    /* ------------------------------------------------------
       G. Successful authentication

       Session must be confirmed
       in PostgreSQL first.

       Only non-sensitive metadata
       is returned.
       ------------------------------------------------------ */

    return authenticatedResponse(
      verification.expiresAt
    );
  } catch (error) {
    /*
     * Security:
     *
     * Never log:
     * - request cookies
     * - session tokens
     * - token hashes
     * - passwords
     * - database credentials
     *
     * Do not report authentication
     * success when PostgreSQL fails.
     */

    console.error(
      "[TAYM_ADMIN_SESSION]",
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
