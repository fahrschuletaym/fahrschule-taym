
import "server-only";

import {
  createHash,
  timingSafeEqual,
} from "node:crypto";

import type { NextRequest } from "next/server";

import * as argon2 from "argon2";

import {
  Pool,
  type PoolClient,
} from "pg";

/* ============================================================
   FAHRSCHULE TAYM
   ADMIN AUTHENTICATION MODULE

   FILE:
   src/lib/admin/auth.ts

   PURPOSE:
   - Single administrator authentication
   - Administrator email verification
   - Argon2id password verification
   - PostgreSQL login rate limiting
   - Temporary brute-force protection
   - Safe shared database connection

   COMPATIBLE WITH:
   src/app/api/admin/auth/login/route.ts

   DATABASE TABLE:
   taym_admin_login_limits

   ENVIRONMENT:
   DATABASE_URL
   TAYM_ADMIN_EMAIL
   TAYM_ADMIN_PASSWORD_HASH
   TAYM_ADMIN_IP_HASH_SECRET
   TAYM_TRUST_PROXY

   IMPORTANT:
   This module does not:
   - Create sessions
   - Set cookies
   - Send authentication emails
   - Create administrator accounts
   - Return password hashes to clients

   Sessions are managed separately
   by src/lib/admin/session.ts.
   ============================================================ */

/* ============================================================
   1. SECURITY CONSTANTS
   ============================================================ */

export const ADMIN_ID = "primary" as const;

export const MAX_LOGIN_ATTEMPTS = 5;

export const LOGIN_WINDOW_MS =
  15 * 60 * 1000;

export const MAX_ADMIN_EMAIL_LENGTH = 254;

export const MAX_ADMIN_PASSWORD_LENGTH = 256;

export const MAX_ADMIN_PASSWORD_BYTES = 1024;

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FINGERPRINT_PATTERN =
  /^[a-f0-9]{64}$/;

/* ============================================================
   2. TYPES
   ============================================================ */

export type AdminCredentials = {
  email: string;
  password: string;
};

export type AdminAuthConfig = {
  email: string;
  passwordHash: string;
  ipHashSecret: string;
  trustProxy: boolean;
};

export type LoginAttemptResult = {
  allowed: boolean;
  attempts: number;
  remainingAttempts: number;
  retryAfterSeconds: number;
};

export type AdminAuthenticationResult =
  | {
      authenticated: true;
      adminId: typeof ADMIN_ID;
    }
  | {
      authenticated: false;
      reason: "INVALID_CREDENTIALS";
    }
  | {
      authenticated: false;
      reason: "RATE_LIMITED";
      retryAfterSeconds: number;
    };

export type AdminAuthDatabase =
  Pool | PoolClient;

type AttemptRow = {
  attempts: number;
  expires_at: Date | string;
};

/* ============================================================
   3. POSTGRESQL CONNECTION

   Reuses the same pool name as
   the previously developed
   administrator APIs.

   Pool sharing applies within
   the same Node.js process.

   DATABASE_URL must be defined.
   ============================================================ */

const shared =
  globalThis as typeof globalThis & {
    __taymAdminAuthPool?: Pool;
  };

export function getAdminAuthDatabase(): Pool {
  const databaseUrl =
    process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL_NOT_CONFIGURED"
    );
  }

  if (!shared.__taymAdminAuthPool) {
    shared.__taymAdminAuthPool = new Pool({
      connectionString: databaseUrl,

      max: 5,

      idleTimeoutMillis: 30_000,

      connectionTimeoutMillis: 5_000,

      application_name:
        "fahrschule_taym_admin",
    });
  }

  return shared.__taymAdminAuthPool;
}

/* ============================================================
   4. NORMALIZE EMAIL

   The existing login API uses a
   lower-case, trimmed email address.

   Preserve this exact convention.
   ============================================================ */

export function normalizeAdminEmail(
  value: string
): string {
  return value.trim().toLowerCase();
}

/* ============================================================
   5. VALIDATE EMAIL
   ============================================================ */

export function isValidAdminEmailFormat(
  value: unknown
): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const email =
    normalizeAdminEmail(value);

  return (
    email.length > 0 &&
    email.length <= MAX_ADMIN_EMAIL_LENGTH &&
    EMAIL_PATTERN.test(email)
  );
}

/* ============================================================
   6. VALIDATE PASSWORD INPUT

   Never trim the password.

   Password spaces may be
   intentional and significant.

   Limits prevent unnecessarily
   expensive password verification.
   ============================================================ */

export function isValidAdminPasswordInput(
  value: unknown
): value is string {
  if (typeof value !== "string") {
    return false;
  }

  if (
    value.length === 0 ||
    value.length > MAX_ADMIN_PASSWORD_LENGTH
  ) {
    return false;
  }

  return (
    Buffer.byteLength(value, "utf8") <=
    MAX_ADMIN_PASSWORD_BYTES
  );
}

/* ============================================================
   7. READ CONFIGURATION

   Never embed a plaintext
   administrator password.

   TAYM_ADMIN_PASSWORD_HASH must
   contain a real Argon2id hash.

   No fallback administrator.
   No development bypass.
   ============================================================ */

export function getAdminAuthConfig(): AdminAuthConfig {
  const email =
    normalizeAdminEmail(
      process.env.TAYM_ADMIN_EMAIL ?? ""
    );

  const passwordHash =
    process.env.TAYM_ADMIN_PASSWORD_HASH
      ?.trim() ?? "";

  const ipHashSecret =
    process.env.TAYM_ADMIN_IP_HASH_SECRET ?? "";

  if (!isValidAdminEmailFormat(email)) {
    throw new Error(
      "ADMIN_EMAIL_NOT_CONFIGURED"
    );
  }

  if (
    !passwordHash.startsWith("$argon2id$") ||
    passwordHash.length > 512
  ) {
    throw new Error(
      "ADMIN_PASSWORD_HASH_INVALID"
    );
  }

  if (ipHashSecret.length < 32) {
    throw new Error(
      "ADMIN_IP_HASH_SECRET_INVALID"
    );
  }

  return {
    email,
    passwordHash,
    ipHashSecret,

    trustProxy:
      process.env.TAYM_TRUST_PROXY === "true",
  };
}

/* ============================================================
   8. CONSTANT-TIME EMAIL COMPARISON

   Hash both normalized emails to
   fixed-size digests, then compare
   the resulting bytes.

   Do not expose which field failed
   in a public login response.
   ============================================================ */

export function verifyAdminEmail(
  suppliedEmail: string,
  authorizedEmail?: string
): boolean {
  const configured =
    authorizedEmail ??
    getAdminAuthConfig().email;

  if (
    !isValidAdminEmailFormat(suppliedEmail) ||
    !isValidAdminEmailFormat(configured)
  ) {
    return false;
  }

  const suppliedDigest =
    createHash("sha256")
      .update(
        normalizeAdminEmail(suppliedEmail),
        "utf8"
      )
      .digest();

  const authorizedDigest =
    createHash("sha256")
      .update(
        normalizeAdminEmail(configured),
        "utf8"
      )
      .digest();

  return timingSafeEqual(
    suppliedDigest,
    authorizedDigest
  );
}

/* ============================================================
   9. ARGON2ID PASSWORD VERIFICATION

   The stored hash comes only
   from trusted server configuration.

   Never store the supplied password
   in logs, database rows or responses.

   Never compare plaintext passwords.
   ============================================================ */

export async function verifyAdminPassword(
  suppliedPassword: string,
  storedHash?: string
): Promise<boolean> {
  if (!isValidAdminPasswordInput(suppliedPassword)) {
    return false;
  }

  const passwordHash =
    storedHash ??
    getAdminAuthConfig().passwordHash;

  if (
    !passwordHash.startsWith("$argon2id$") ||
    passwordHash.length > 512
  ) {
    throw new Error(
      "ADMIN_PASSWORD_HASH_INVALID"
    );
  }

  /*
   * argon2.verify() reads the salt
   * and parameters from the hash.
   */

  return argon2.verify(
    passwordHash,
    suppliedPassword
  );
}

/* ============================================================
   10. CLIENT IP SOURCE

   By default, all attempts use
   one conservative shared bucket.

   When TAYM_TRUST_PROXY=true:
   use X-Forwarded-For.

   IMPORTANT:
   Activate this ONLY when your
   trusted reverse proxy overwrites
   all client-supplied forwarding
   headers.

   Otherwise attackers may spoof
   addresses to bypass rate limits.

   Add edge/WAF rate limiting
   in production.
   ============================================================ */

export function getAdminClientIdentifier(
  request: NextRequest,
  trustProxy: boolean
): string {
  if (!trustProxy) {
    return "unidentified";
  }

  const forwarded =
    request.headers.get("x-forwarded-for");

  if (!forwarded) {
    return "unidentified";
  }

  const firstAddress =
    forwarded
      .split(",")[0]
      ?.trim();

  if (!firstAddress) {
    return "unidentified";
  }

  /*
   * Limit the amount of data
   * incorporated into the key.
   */

  return firstAddress.slice(0, 128);
}

/* ============================================================
   11. LOGIN RATE-LIMIT FINGERPRINT

   Compatible with the previous
   login API:

   SHA-256(
     secret + ":" + ip + "|primary"
   )

   This preserves the same keys
   in taym_admin_login_limits when
   login is refactored to use
   this shared module.

   It avoids storing raw IPs.
   ============================================================ */

export function createAdminLoginFingerprint(
  clientIdentifier: string,
  secret?: string
): string {
  const ipHashSecret =
    secret ??
    getAdminAuthConfig().ipHashSecret;

  if (ipHashSecret.length < 32) {
    throw new Error(
      "ADMIN_IP_HASH_SECRET_INVALID"
    );
  }

  const identifier =
    clientIdentifier.trim() ||
    "unidentified";

  const material =
    `${identifier}|${ADMIN_ID}`;

  return createHash("sha256")
    .update(
      `${ipHashSecret}:${material}`,
      "utf8"
    )
    .digest("hex");
}

export function fingerprintAdminLoginRequest(
  request: NextRequest,
  config?: AdminAuthConfig
): string {
  const currentConfig =
    config ?? getAdminAuthConfig();

  const identifier =
    getAdminClientIdentifier(
      request,
      currentConfig.trustProxy
    );

  return createAdminLoginFingerprint(
    identifier,
    currentConfig.ipHashSecret
  );
}

/* ============================================================
   12. FINGERPRINT VALIDATION
   ============================================================ */

function validateFingerprint(
  fingerprint: string
): void {
  if (!FINGERPRINT_PATTERN.test(fingerprint)) {
    throw new Error(
      "INVALID_LOGIN_FINGERPRINT"
    );
  }
}

/* ============================================================
   13. REGISTER LOGIN ATTEMPT

   Each login attempt is counted
   BEFORE password verification.

   PostgreSQL performs the update
   atomically.

   5 attempts are allowed within
   a 15-minute window.

   The sixth attempt is blocked.

   The counter resets after the
   window expires.

   Shared across server instances
   using the same PostgreSQL DB.
   ============================================================ */

export async function registerAdminLoginAttempt(
  fingerprint: string,
  database: AdminAuthDatabase =
    getAdminAuthDatabase()
): Promise<LoginAttemptResult> {
  validateFingerprint(fingerprint);

  const expiresAt =
    new Date(
      Date.now() + LOGIN_WINDOW_MS
    );

  const result =
    await database.query<AttemptRow>(
      `
      INSERT INTO taym_admin_login_limits (
        fingerprint,
        attempts,
        expires_at
      )
      VALUES (
        $1,
        1,
        $2
      )

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
            THEN
              EXCLUDED.expires_at
            ELSE
              taym_admin_login_limits.expires_at
          END

      RETURNING
        attempts,
        expires_at
      `,
      [
        fingerprint,
        expiresAt,
      ]
    );

  const row =
    result.rows[0];

  if (
    !row ||
    !Number.isSafeInteger(row.attempts) ||
    row.attempts < 1
  ) {
    throw new Error(
      "INVALID_LOGIN_LIMIT_RESULT"
    );
  }

  const expiration =
    row.expires_at instanceof Date
      ? row.expires_at
      : new Date(row.expires_at);

  if (
    !Number.isFinite(
      expiration.getTime()
    )
  ) {
    throw new Error(
      "INVALID_LOGIN_LIMIT_EXPIRATION"
    );
  }

  const allowed =
    row.attempts <= MAX_LOGIN_ATTEMPTS;

  const remainingAttempts =
    Math.max(
      0,
      MAX_LOGIN_ATTEMPTS - row.attempts
    );

  const retryAfterSeconds =
    allowed
      ? 0
      : Math.max(
          1,
          Math.ceil(
            (expiration.getTime() -
              Date.now()) / 1000
          )
        );

  return {
    allowed,
    attempts: row.attempts,
    remainingAttempts,
    retryAfterSeconds,
  };
}

/* ============================================================
   14. CLEAR SUCCESSFUL LOGIN ATTEMPTS

   Called only after the
   administrator's credentials
   have been verified successfully.

   If this operation fails, the
   caller should report/log an
   internal cleanup error without
   exposing database information.

   An authenticated session must
   still be created separately.
   ============================================================ */

export async function clearAdminLoginAttempts(
  fingerprint: string,
  database: AdminAuthDatabase =
    getAdminAuthDatabase()
): Promise<void> {
  validateFingerprint(fingerprint);

  await database.query(
    `
    DELETE FROM taym_admin_login_limits
    WHERE fingerprint = $1
    `,
    [fingerprint]
  );
}

/* ============================================================
   15. CHECK STORED RATE LIMIT

   This is useful for diagnostics
   and administrative monitoring.

   It does not increment the counter.

   Login must use
   registerAdminLoginAttempt(),
   never this check alone.
   ============================================================ */

export async function getAdminLoginLimitStatus(
  fingerprint: string,
  database: AdminAuthDatabase =
    getAdminAuthDatabase()
): Promise<LoginAttemptResult> {
  validateFingerprint(fingerprint);

  const result =
    await database.query<AttemptRow>(
      `
      SELECT
        attempts,
        expires_at

      FROM taym_admin_login_limits

      WHERE
        fingerprint = $1
        AND expires_at > NOW()

      LIMIT 1
      `,
      [fingerprint]
    );

  const row =
    result.rows[0];

  if (!row) {
    return {
      allowed: true,
      attempts: 0,
      remainingAttempts:
        MAX_LOGIN_ATTEMPTS,
      retryAfterSeconds: 0,
    };
  }

  if (
    !Number.isSafeInteger(row.attempts) ||
    row.attempts < 0
  ) {
    throw new Error(
      "INVALID_LOGIN_LIMIT_RESULT"
    );
  }

  const expiration =
    row.expires_at instanceof Date
      ? row.expires_at
      : new Date(row.expires_at);

  if (
    !Number.isFinite(
      expiration.getTime()
    )
  ) {
    throw new Error(
      "INVALID_LOGIN_LIMIT_EXPIRATION"
    );
  }

  const allowed =
    row.attempts < MAX_LOGIN_ATTEMPTS;

  return {
    allowed,

    attempts:
      row.attempts,

    remainingAttempts:
      Math.max(
        0,
        MAX_LOGIN_ATTEMPTS -
          row.attempts
      ),

    retryAfterSeconds:
      allowed
        ? 0
        : Math.max(
            1,
            Math.ceil(
              (expiration.getTime() -
                Date.now()) / 1000
            )
          ),
  };
}

/* ============================================================
   16. AUTHENTICATE ADMINISTRATOR

   Main shared authentication
   function for the login API.

   Input:
   - NextRequest
   - email
   - password

   Processing:
   1. Validate supplied credentials
   2. Identify the rate-limit bucket
   3. Register a login attempt
   4. Check whether attempt is allowed
   5. Compare configured admin email
   6. Verify Argon2id password
   7. Return only minimal result

   Does NOT create a session.

   Rate limit stays in PostgreSQL.
   ============================================================ */

export async function authenticateAdministrator(
  request: NextRequest,
  credentials: AdminCredentials,
  database: AdminAuthDatabase =
    getAdminAuthDatabase()
): Promise<AdminAuthenticationResult> {
  const config =
    getAdminAuthConfig();

  /*
   * Validate the input format.
   *
   * The public route should still
   * enforce its own JSON body limit.
   */

  if (
    !isValidAdminEmailFormat(
      credentials.email
    ) ||
    !isValidAdminPasswordInput(
      credentials.password
    )
  ) {
    return {
      authenticated: false,
      reason: "INVALID_CREDENTIALS",
    };
  }

  /*
   * Generate request-specific
   * fingerprint.
   */

  const fingerprint =
    fingerprintAdminLoginRequest(
      request,
      config
    );

  /*
   * Count the attempt before
   * checking the password.
   */

  const limit =
    await registerAdminLoginAttempt(
      fingerprint,
      database
    );

  if (!limit.allowed) {
    return {
      authenticated: false,
      reason: "RATE_LIMITED",
      retryAfterSeconds:
        limit.retryAfterSeconds,
    };
  }

  /*
   * Both checks run for a valid
   * credential format.
   *
   * Do not return distinct email
   * or password errors.
   */

  const emailMatches =
    verifyAdminEmail(
      credentials.email,
      config.email
    );

  const passwordMatches =
    await verifyAdminPassword(
      credentials.password,
      config.passwordHash
    );

  if (
    !emailMatches ||
    !passwordMatches
  ) {
    return {
      authenticated: false,
      reason: "INVALID_CREDENTIALS",
    };
  }

  /*
   * Successful credential check.
   *
   * The caller must now create
   * the PostgreSQL session.
   *
   * Do not clear the attempts yet:
   * clearing is safer after the
   * session was actually created.
   */

  return {
    authenticated: true,
    adminId: ADMIN_ID,
  };
}

/* ============================================================
   17. CLEANUP OF EXPIRED RATE LIMITS

   Run from a trusted maintenance
   job or scheduled server task.

   Not called on every login to
   avoid unnecessary table scans.
   ============================================================ */

export async function cleanupExpiredAdminLoginLimits(
  database: AdminAuthDatabase =
    getAdminAuthDatabase()
): Promise<number> {
  const result =
    await database.query(
      `
      DELETE FROM taym_admin_login_limits
      WHERE expires_at <= NOW()
      `
    );

  return result.rowCount ?? 0;
}

/* ============================================================
   18. SAFE RESPONSE MAPPING

   Utility for translating a
   credential validation result
   into a public API status.

   Never return:
   - Valid admin email
   - Stored password hash
   - Login fingerprint
   - Real client IP address
   ============================================================ */

export function mapAdminAuthenticationFailure(
  result: AdminAuthenticationResult
):
  | {
      status: 401;
      code: "INVALID_CREDENTIALS";
    }
  | {
      status: 429;
      code: "RATE_LIMITED";
      retryAfterSeconds: number;
    }
  | null {
  if (result.authenticated) {
    return null;
  }

  if (
    result.reason ===
    "RATE_LIMITED"
  ) {
    return {
      status: 429,
      code: "RATE_LIMITED",
      retryAfterSeconds:
        result.retryAfterSeconds,
    };
  }

  return {
    status: 401,
    code: "INVALID_CREDENTIALS",
  };
}

/* ============================================================
   END — FAHRSCHULE TAYM
   ============================================================ */
