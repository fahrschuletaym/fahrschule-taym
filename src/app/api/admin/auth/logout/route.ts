
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
   ADMIN AUTHENTICATION — LOGOUT

   File:
   src/app/api/admin/auth/logout/route.ts

   Method:
   POST /api/admin/auth/logout

   Compatible with:
   src/app/api/admin/auth/login/route.ts

   Cookie:
   taym_admin_session

   PostgreSQL table:
   taym_admin_sessions

   Features:
   - Server-side session revocation
   - SHA-256 session token hashing
   - HttpOnly cookie deletion
   - Same-origin CSRF protection
   - HTML form redirect (303)
   - JSON response for fetch()
   - No credentials or tokens in logs
   - No fake logout success on DB failure
   ============================================================ */


/* ============================================================
   1. CONSTANTS

   Must remain identical to login API.
   ============================================================ */

const SESSION_COOKIE =
  "taym_admin_session";

const ADMIN_ID =
  "primary";

const SESSION_PATTERN =
  /^[a-f0-9]{64}$/;

const LOGIN_PATH =
  "/admin/login";

/* ============================================================
   2. RESPONSE SECURITY HEADERS
   ============================================================ */

const SECURITY_HEADERS = {
  "Cache-Control":
    "no-store, max-age=0, must-revalidate",

  Pragma: "no-cache",

  "X-Content-Type-Options":
    "nosniff",

  "Referrer-Policy":
    "no-referrer",
};

/* ============================================================
   3. SHARED POSTGRESQL CONNECTION

   Reuse the pool created by the
   previous admin login API.

   The global key is intentionally
   identical:

   __taymAdminAuthPool

   No extra database connection
   is created if the existing pool
   is available in the same process.
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
   4. APPLICATION ORIGIN

   Redirect to a fixed configured
   application origin.

   Never use an untrusted Host
   or X-Forwarded-Host header
   to construct the redirect.
   ============================================================ */

function getAppOrigin(): string {
  const configured =
    process.env.TAYM_APP_ORIGIN
      ?.trim();

  if (!configured) {
    throw new Error(
      "TAYM_APP_ORIGIN_NOT_CONFIGURED"
    );
  }

  const url =
    new URL(configured);

  const localDevelopment =
    process.env.NODE_ENV !==
      "production" &&
    url.protocol === "http:" &&
    (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1"
    );

  if (
    url.protocol !== "https:" &&
    !localDevelopment
  ) {
    throw new Error(
      "APP_ORIGIN_PROTOCOL_INVALID"
    );
  }

  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "APP_ORIGIN_INVALID"
    );
  }

  return url.origin;
}

/* ============================================================
   5. CONTENT NEGOTIATION

   The layout submits an HTML form:

   <form
     action="/api/admin/auth/logout"
     method="POST"
   >

   This should redirect to login.

   An API fetch can request:

   Accept: application/json

   This should receive JSON.
   ============================================================ */

function wantsJson(
  request: NextRequest
): boolean {
  const accept =
    request.headers.get(
      "accept"
    ) ?? "";

  return accept
    .toLowerCase()
    .includes(
      "application/json"
    );
}

/* ============================================================
   6. ORIGIN / CSRF CHECK

   Cookies authenticate the request,
   therefore POST must be restricted
   to this website's origin.

   Prefer the Origin header.

   A same-origin browser form may use
   Referer as a fallback only when
   Sec-Fetch-Site is same-origin.

   Requests without a verifiable
   origin are rejected.
   ============================================================ */

function isAllowedOrigin(
  request: NextRequest,
  expectedOrigin: string
): boolean {
  const origin =
    request.headers.get(
      "origin"
    );

  const fetchSite =
    request.headers.get(
      "sec-fetch-site"
    );

  if (
    fetchSite &&
    fetchSite !== "same-origin"
  ) {
    return false;
  }

  if (origin) {
    try {
      return (
        new URL(origin).origin ===
        expectedOrigin
      );
    } catch {
      return false;
    }
  }

  /*
   * Fallback for an HTML form
   * whose browser omits Origin.
   *
   * Sec-Fetch-Site must be
   * explicitly same-origin.
   */

  if (
    fetchSite !== "same-origin"
  ) {
    return false;
  }

  const referer =
    request.headers.get(
      "referer"
    );

  if (!referer) {
    return false;
  }

  try {
    return (
      new URL(referer).origin ===
      expectedOrigin
    );
  } catch {
    return false;
  }
}

/* ============================================================
   7. HASH SESSION TOKEN

   Login stores SHA-256(token bytes).

   Logout must use the EXACT
   same hashing algorithm.

   Never compare or store
   the plaintext session token
   in PostgreSQL.
   ============================================================ */

function hashSessionToken(
  token: string
): string | null {
  if (
    !SESSION_PATTERN.test(
      token
    )
  ) {
    return null;
  }

  return createHash("sha256")
    .update(
      Buffer.from(
        token,
        "hex"
      )
    )
    .digest("hex");
}

/* ============================================================
   8. COOKIE DELETION

   Cookie options must be
   compatible with login:

   name:
     taym_admin_session

   path:
     /

   sameSite:
     strict

   secure:
     true in production

   httpOnly:
     true

   An expired cookie invalidates
   the browser's stored token.
   ============================================================ */

function removeAdminCookie(
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
   9. RESPONSE HELPERS
   ============================================================ */

function errorResponse(
  status: number,
  code: string
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      code,
    },
    {
      status,

      headers:
        SECURITY_HEADERS,
    }
  );
}

function logoutSuccess(
  request: NextRequest,
  appOrigin: string
): NextResponse {
  let response: NextResponse;

  if (wantsJson(request)) {
    response =
      NextResponse.json(
        {
          success: true,
        },
        {
          status: 200,

          headers:
            SECURITY_HEADERS,
        }
      );
  } else {
    response =
      NextResponse.redirect(
        new URL(
          LOGIN_PATH,
          appOrigin
        ),
        {
          status: 303,

          headers:
            SECURITY_HEADERS,
        }
      );
  }

  removeAdminCookie(response);

  return response;
}

/* ============================================================
   10. REVOKE POSTGRESQL SESSION

   Security properties:

   - Parameterized SQL
   - Restrict to primary administrator
   - Revoke only matching session
   - Never delete other sessions
   - Retain audit-relevant timestamps

   A session already revoked or
   expired is handled idempotently.

   No success is returned if
   PostgreSQL throws an error.
   ============================================================ */

async function revokeSession(
  pool: Pool,
  tokenHash: string
): Promise<void> {
  await pool.query(
    `
    UPDATE taym_admin_sessions
    SET
      revoked_at = NOW()
    WHERE
      token_hash = $1
      AND admin_id = $2
      AND revoked_at IS NULL
    `,
    [
      tokenHash,
      ADMIN_ID,
    ]
  );
}

/* ============================================================
   11. POST /api/admin/auth/logout

   Steps:
   1. Validate configured origin
   2. Validate request source
   3. Read HttpOnly session cookie
   4. Hash token using SHA-256
   5. Revoke session in PostgreSQL
   6. Expire cookie
   7. Return JSON or redirect

   If the cookie is missing or malformed:
   - No valid session can be authenticated
     with that cookie.
   - Remove it.
   - Return idempotent logout success.

   If PostgreSQL fails:
   - Do not report successful revocation.
   ============================================================ */

export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  try {
    /* ------------------------------------------------------
       A. Read server configuration
       ------------------------------------------------------ */

    const appOrigin =
      getAppOrigin();

    /* ------------------------------------------------------
       B. CSRF protection
       ------------------------------------------------------ */

    if (
      !isAllowedOrigin(
        request,
        appOrigin
      )
    ) {
      return errorResponse(
        403,
        "ORIGIN_NOT_ALLOWED"
      );
    }

    /* ------------------------------------------------------
       C. Read session cookie
       ------------------------------------------------------ */

    const token =
      request.cookies.get(
        SESSION_COOKIE
      )?.value;

    /* ------------------------------------------------------
       D. Missing session

       No database lookup needed
       for an absent cookie.
       ------------------------------------------------------ */

    if (!token) {
      return logoutSuccess(
        request,
        appOrigin
      );
    }

    /* ------------------------------------------------------
       E. Validate token format
       ------------------------------------------------------ */

    const tokenHash =
      hashSessionToken(
        token
      );

    if (!tokenHash) {
      return logoutSuccess(
        request,
        appOrigin
      );
    }

    /* ------------------------------------------------------
       F. PostgreSQL connection
       ------------------------------------------------------ */

    const pool =
      getDatabase();

    /* ------------------------------------------------------
       G. Persist revocation

       This must complete before
       logout success is returned.
       ------------------------------------------------------ */

    await revokeSession(
      pool,
      tokenHash
    );

    /* ------------------------------------------------------
       H. Remove browser cookie
       and return success
       ------------------------------------------------------ */

    return logoutSuccess(
      request,
      appOrigin
    );
  } catch (error) {
    /*
     * Do not log:
     * - session cookies
     * - raw tokens
     * - password hashes
     * - request headers
     * - personal data
     */

    console.error(
      "[TAYM_ADMIN_LOGOUT]",
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
   END
   ============================================================ */
