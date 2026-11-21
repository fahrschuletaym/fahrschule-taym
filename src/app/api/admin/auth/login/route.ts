
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import * as argon2 from "argon2";
import { Pool } from "pg";

/* ============================================================
   FAHRSCHULE TAYM
   ADMIN AUTHENTICATION — LOGIN

   File:
   src/app/api/admin/auth/login/route.ts

   Method:
   POST /api/admin/auth/login

   Authentication:
   - One configured administrator email
   - Argon2id password hash
   - PostgreSQL-backed sessions
   - HttpOnly cookie
   - CSRF origin validation
   - Login rate limiting
   - No credentials exposed to the browser

   Dependencies:
   npm install pg argon2
   npm install -D @types/pg

   Database tables:
   - taym_admin_sessions
   - taym_admin_login_limits

   Environment:
   - DATABASE_URL
   - TAYM_ADMIN_EMAIL
   - TAYM_ADMIN_PASSWORD_HASH
   - TAYM_APP_ORIGIN
   - TAYM_ADMIN_IP_HASH_SECRET
   ============================================================ */


const SESSION_COOKIE =
  "taym_admin_session";

const ADMIN_ID = "primary";

const SESSION_TTL_MS =
  12 * 60 * 60 * 1000;

const MAX_REQUEST_BYTES = 4096;

const MAX_LOGIN_ATTEMPTS = 5;

const LIMIT_WINDOW_MS =
  15 * 60 * 1000;

const MAX_PASSWORD_BYTES = 1024;

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SESSION_TOKEN_PATTERN =
  /^[a-f0-9]{64}$/;

/* ============================================================
   1. DATABASE CONNECTION

   Dedicated shared pool for development.

   PostgreSQL connections are not
   opened when the module is imported.

   The existing project pool may replace
   this adapter later.
   ============================================================ */

const shared = globalThis as typeof globalThis & {
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
   2. RESPONSES

   Never expose:
   - password hashes
   - database errors
   - session tokens
   - configured admin email
   - rate-limit identifiers
   ============================================================ */

const RESPONSE_HEADERS = {
  "Cache-Control":
    "no-store, max-age=0, must-revalidate",

  Pragma: "no-cache",

  "X-Content-Type-Options":
    "nosniff",
};

function respond(
  status: number,
  code: string,
  additionalHeaders?: Record<string, string>
) {
  return NextResponse.json(
    {
      success: false,
      code,
    },
    {
      status,
      headers: {
        ...RESPONSE_HEADERS,
        ...additionalHeaders,
      },
    }
  );
}

function successResponse() {
  return NextResponse.json(
    {
      success: true,
    },
    {
      status: 200,
      headers: RESPONSE_HEADERS,
    }
  );
}

/* ============================================================
   3. ADMIN CONFIGURATION

   Password hash must come from
   an environment variable.

   Never use a plaintext password
   as a fallback.
   ============================================================ */

type AdminConfig = {
  email: string;
  passwordHash: string;
  appOrigin: string;
  ipHashSecret: string;
};

function getAdminConfig(): AdminConfig {
  const email =
    process.env.TAYM_ADMIN_EMAIL
      ?.trim()
      .toLowerCase();

  const passwordHash =
    process.env.TAYM_ADMIN_PASSWORD_HASH
      ?.trim();

  const appOrigin =
    process.env.TAYM_APP_ORIGIN
      ?.trim();

  const ipHashSecret =
    process.env.TAYM_ADMIN_IP_HASH_SECRET;

  if (
    !email ||
    !EMAIL_PATTERN.test(email) ||
    !passwordHash ||
    !passwordHash.startsWith(
      "$argon2id$"
    ) ||
    !appOrigin ||
    !ipHashSecret ||
    ipHashSecret.length < 32
  ) {
    throw new Error(
      "ADMIN_CONFIGURATION_INVALID"
    );
  }

  let normalizedOrigin: string;

  try {
    const parsed =
      new URL(appOrigin);

    if (
      parsed.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !==
          "production" &&
        parsed.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(
          parsed.hostname
        )
      )
    ) {
      throw new Error(
        "INVALID_APP_PROTOCOL"
      );
    }

    if (
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error(
        "INVALID_APP_ORIGIN"
      );
    }

    normalizedOrigin =
      parsed.origin;
  } catch {
    throw new Error(
      "ADMIN_APP_ORIGIN_INVALID"
    );
  }

  return {
    email,
    passwordHash,
    appOrigin: normalizedOrigin,
    ipHashSecret,
  };
}

/* ============================================================
   4. CROSS-SITE REQUEST PROTECTION

   Only allow requests from the
   configured application origin.

   This avoids trusting proxy-host
   headers when validating the origin.
   ============================================================ */

function validRequestOrigin(
  request: NextRequest,
  expectedOrigin: string
): boolean {
  const origin =
    request.headers.get("origin");

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

  if (!origin) {
    return false;
  }

  try {
    return (
      new URL(origin).origin ===
      expectedOrigin
    );
  } catch {
    return false;
  }
}

/* ============================================================
   5. REQUEST BODY SIZE CONTROL

   Enforce the actual byte limit,
   not only Content-Length.
   ============================================================ */

type CredentialsResult =
  | {
      ok: true;
      email: string;
      password: string;
    }
  | {
      ok: false;
      status: number;
      code: string;
    };

async function readCredentials(
  request: NextRequest
): Promise<CredentialsResult> {
  const contentType =
    request.headers.get(
      "content-type"
    ) ?? "";

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

  const declaredLength =
    request.headers.get(
      "content-length"
    );

  if (declaredLength !== null) {
    const length =
      Number(declaredLength);

    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > MAX_REQUEST_BYTES
    ) {
      return {
        ok: false,
        status: 413,
        code: "REQUEST_TOO_LARGE",
      };
    }
  }

  const reader =
    request.body?.getReader();

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
      const chunk =
        await reader.read();

      if (chunk.done) {
        break;
      }

      total +=
        chunk.value.byteLength;

      if (
        total > MAX_REQUEST_BYTES
      ) {
        await reader.cancel();

        return {
          ok: false,
          status: 413,
          code: "REQUEST_TOO_LARGE",
        };
      }

      chunks.push(chunk.value);
    }

    const combined =
      new Uint8Array(total);

    let position = 0;

    for (const chunk of chunks) {
      combined.set(
        chunk,
        position
      );

      position +=
        chunk.byteLength;
    }

    const raw =
      new TextDecoder(
        "utf-8",
        { fatal: true }
      ).decode(combined);

    const parsed: unknown =
      JSON.parse(raw);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {
        ok: false,
        status: 400,
        code: "INVALID_INPUT",
      };
    }

    const body =
      parsed as Record<
        string,
        unknown
      >;

    const keys =
      Object.keys(body);

    if (
      keys.some(
        (key) =>
          key !== "email" &&
          key !== "password"
      )
    ) {
      return {
        ok: false,
        status: 400,
        code: "INVALID_INPUT",
      };
    }

    if (
      typeof body.email !==
        "string" ||
      typeof body.password !==
        "string"
    ) {
      return {
        ok: false,
        status: 400,
        code: "INVALID_INPUT",
      };
    }

    const email =
      body.email
        .trim()
        .toLowerCase();

    const password =
      body.password;

    if (
      !EMAIL_PATTERN.test(email) ||
      email.length > 254 ||
      password.length === 0 ||
      password.length > 256 ||
      Buffer.byteLength(
        password,
        "utf8"
      ) > MAX_PASSWORD_BYTES
    ) {
      return {
        ok: false,
        status: 400,
        code: "INVALID_INPUT",
      };
    }

    return {
      ok: true,
      email,
      password,
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
      // Reader already released.
    }
  }
}

/* ============================================================
   6. EMAIL COMPARISON

   Compare fixed-length hashes to
   avoid a basic variable-time
   string comparison.
   ============================================================ */

function isAdminEmail(
  provided: string,
  configured: string
): boolean {
  const providedHash =
    createHash("sha256")
      .update(provided)
      .digest();

  const configuredHash =
    createHash("sha256")
      .update(configured)
      .digest();

  return timingSafeEqual(
    providedHash,
    configuredHash
  );
}

/* ============================================================
   7. RATE LIMIT IDENTIFIER

   Never store plaintext IP addresses
   in the rate-limit table.

   In production, do not trust arbitrary
   X-Forwarded-For headers supplied by
   the public Internet.

   This implementation only accepts a
   proxy-provided IP when explicitly
   enabled by deployment configuration.

   The reverse proxy must overwrite
   client-supplied forwarding headers.
   ============================================================ */

function clientFingerprint(
  request: NextRequest,
  config: AdminConfig
): string {
  let ip = "unidentified";

  if (
    process.env.TAYM_TRUST_PROXY ===
    "true"
  ) {
    const forwarded =
      request.headers.get(
        "x-forwarded-for"
      );

    if (forwarded) {
      ip =
        forwarded
          .split(",")[0]
          .trim()
          .slice(0, 128) ||
        "unidentified";
    }
  }

  /*
   * If a deployment has no trusted
   * client IP source, all login attempts
   * share one conservative rate bucket.
   *
   * For production at scale, use
   * trusted proxy or edge rate limiting.
   */

  const material =
    `${ip}|${ADMIN_ID}`;

  return createHash("sha256")
    .update(
      `${config.ipHashSecret}:${material}`
    )
    .digest("hex");
}

/* ============================================================
   8. PERSISTENT RATE LIMIT

   PostgreSQL handles concurrent
   increments atomically.

   Attempt count is increased BEFORE
   the password verification.

   This is not an in-memory counter.
   ============================================================ */

async function registerLoginAttempt(
  pool: Pool,
  fingerprint: string
): Promise<boolean> {
  const expiresAt =
    new Date(
      Date.now() +
      LIMIT_WINDOW_MS
    );

  const result =
    await pool.query<{
      attempts: number;
    }>(
      `
      INSERT INTO taym_admin_login_limits (
        fingerprint,
        attempts,
        expires_at
      )
      VALUES ($1, 1, $2)
      ON CONFLICT (fingerprint)
      DO UPDATE SET
        attempts =
          CASE
            WHEN
              taym_admin_login_limits.expires_at
              <= NOW()
            THEN 1
            ELSE
              taym_admin_login_limits.attempts + 1
          END,

        expires_at =
          CASE
            WHEN
              taym_admin_login_limits.expires_at
              <= NOW()
            THEN EXCLUDED.expires_at
            ELSE
              taym_admin_login_limits.expires_at
          END

      RETURNING attempts
      `,
      [
        fingerprint,
        expiresAt,
      ]
    );

  const attempts =
    result.rows[0]?.attempts;

  return (
    typeof attempts === "number" &&
    attempts <=
      MAX_LOGIN_ATTEMPTS
  );
}

async function clearLoginAttempts(
  pool: Pool,
  fingerprint: string
) {
  await pool.query(
    `
    DELETE FROM taym_admin_login_limits
    WHERE fingerprint = $1
    `,
    [fingerprint]
  );
}

/* ============================================================
   9. SESSION GENERATION

   Random 256-bit session token.

   Database stores SHA-256 hash only.
   Raw token is sent only as the
   HttpOnly session cookie.
   ============================================================ */

function createSessionToken() {
  const token =
    randomBytes(32)
      .toString("hex");

  if (
    !SESSION_TOKEN_PATTERN.test(
      token
    )
  ) {
    throw new Error(
      "SESSION_GENERATION_FAILED"
    );
  }

  const tokenHash =
    createHash("sha256")
      .update(
        Buffer.from(
          token,
          "hex"
        )
      )
      .digest("hex");

  return {
    token,
    tokenHash,
  };
}

/* ============================================================
   10. SAVE SESSION IN POSTGRESQL

   Only one configured administrator.

   The session is persisted BEFORE
   returning authentication success.
   ============================================================ */

async function createAdminSession(
  pool: Pool
) {
  const {
    token,
    tokenHash,
  } = createSessionToken();

  const now = new Date();

  const expiresAt =
    new Date(
      now.getTime() +
      SESSION_TTL_MS
    );

  await pool.query(
    `
    INSERT INTO taym_admin_sessions (
      token_hash,
      admin_id,
      created_at,
      expires_at,
      revoked_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      NULL
    )
    `,
    [
      tokenHash,
      ADMIN_ID,
      now,
      expiresAt,
    ]
  );

  return {
    token,
    expiresAt,
  };
}

/* ============================================================
   11. POST /api/admin/auth/login
   ============================================================ */

export async function POST(
  request: NextRequest
) {
  try {
    /* ------------------------------------------------------
       A. Validate server configuration
       ------------------------------------------------------ */

    const config =
      getAdminConfig();

    /* ------------------------------------------------------
       B. Validate request origin
       ------------------------------------------------------ */

    if (
      !validRequestOrigin(
        request,
        config.appOrigin
      )
    ) {
      return respond(
        403,
        "ORIGIN_NOT_ALLOWED"
      );
    }

    /* ------------------------------------------------------
       C. Read credentials
       ------------------------------------------------------ */

    const credentials =
      await readCredentials(
        request
      );

    if (!credentials.ok) {
      return respond(
        credentials.status,
        credentials.code
      );
    }

    /* ------------------------------------------------------
       D. Database
       ------------------------------------------------------ */

    const pool =
      getDatabase();

    /* ------------------------------------------------------
       E. Rate limiting
       ------------------------------------------------------ */

    const fingerprint =
      clientFingerprint(
        request,
        config
      );

    const attemptAllowed =
      await registerLoginAttempt(
        pool,
        fingerprint
      );

    if (!attemptAllowed) {
      return respond(
        429,
        "RATE_LIMITED",
        {
          "Retry-After": "900",
        }
      );
    }

    /* ------------------------------------------------------
       F. Check configured email

       Still verify the password hash
       for a well-formed unknown email
       to avoid an obvious fast path.
       ------------------------------------------------------ */

    const emailMatches =
      isAdminEmail(
        credentials.email,
        config.email
      );

    let passwordMatches = false;

    try {
      passwordMatches =
        await argon2.verify(
          config.passwordHash,
          credentials.password
        );
    } catch {
      throw new Error(
        "PASSWORD_HASH_VERIFICATION_FAILED"
      );
    }

    if (
      !emailMatches ||
      !passwordMatches
    ) {
      return respond(
        401,
        "INVALID_CREDENTIALS"
      );
    }

    /* ------------------------------------------------------
       G. Create verified session
       ------------------------------------------------------ */

    const session =
      await createAdminSession(
        pool
      );

    /* ------------------------------------------------------
       H. Prepare success response

       Set cookie only after database
       session insertion succeeds.
       ------------------------------------------------------ */

    const response =
      successResponse();

    response.cookies.set({
      name: SESSION_COOKIE,

      value: session.token,

      httpOnly: true,

      secure:
        process.env.NODE_ENV ===
        "production",

      sameSite: "strict",

      path: "/",

      expires:
        session.expiresAt,

      priority: "high",
    });

    /* ------------------------------------------------------
       I. Clear rate counter

       Failure to clear is not treated
       as a failed authentication because
       the session already exists.
       ------------------------------------------------------ */

    try {
      await clearLoginAttempts(
        pool,
        fingerprint
      );
    } catch {
      console.error(
        "[TAYM_ADMIN_LOGIN] " +
        "RATE_LIMIT_CLEANUP_FAILED"
      );
    }

    return response;
  } catch (error) {
    /*
     * Never log credentials, raw
     * request bodies, hashes or tokens.
     */

    console.error(
      "[TAYM_ADMIN_LOGIN]",
      error instanceof Error
        ? error.message
        : "UNKNOWN_SERVER_ERROR"
    );

    return respond(
      503,
      "SERVICE_UNAVAILABLE"
    );
  }
}

/* ============================================================
   12. UNSUPPORTED METHODS

   Next.js automatically returns
   method-not-allowed for unsupported
   HTTP methods on this route.
   ============================================================ */
