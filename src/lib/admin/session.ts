
import "server-only";

import { cookies } from "next/headers";

import {
  NextResponse,
} from "next/server";

import {
  createHash,
  randomBytes,
} from "node:crypto";

import {
  Pool,
  type PoolClient,
} from "pg";

/* ============================================================
   FAHRSCHULE TAYM
   ADMIN SESSION MANAGEMENT

   File:
   src/lib/admin/session.ts

   Purpose:
   - Create administrator sessions
   - Verify active sessions
   - Read sessions in Server Components
   - Revoke a single session
   - Revoke all administrator sessions
   - Manage secure session cookies
   - Clean expired/revoked sessions

   Compatible with:
   - Admin login API
   - Admin logout API
   - Admin session API
   - Admin protected layout
   - Dashboard and application APIs

   PostgreSQL:
   taym_admin_sessions

   Cookie:
   taym_admin_session

   Administrator:
   primary

   Requirements:
   - Next.js App Router
   - Node.js runtime
   - PostgreSQL
   - pg
   - server-only

   This module never uses:
   - localStorage
   - Client-side session validation
   - JWT tokens
   - Plaintext session tokens in SQL
   - Hardcoded administrator passwords
   ============================================================ */

/* ============================================================
   1. SESSION CONFIGURATION
   ============================================================ */

export const ADMIN_SESSION_COOKIE =
  "taym_admin_session";

export const PRIMARY_ADMIN_ID =
  "primary" as const;

export const ADMIN_SESSION_DURATION_MS =
  12 * 60 * 60 * 1000;

export const ADMIN_SESSION_TOKEN_BYTES = 32;

const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

const TOKEN_HASH_PATTERN = /^[a-f0-9]{64}$/;

/*
 * Database table columns:
 *
 * token_hash VARCHAR(64) PRIMARY KEY
 * admin_id VARCHAR(50) NOT NULL
 * created_at TIMESTAMPTZ NOT NULL
 * expires_at TIMESTAMPTZ NOT NULL
 * revoked_at TIMESTAMPTZ NULL
 */

/* ============================================================
   2. TYPES
   ============================================================ */

export type AdminRole = "ADMIN";

export type AdminSession = {
  adminId: typeof PRIMARY_ADMIN_ID;
  role: AdminRole;
  createdAt: string;
  expiresAt: string;
};

export type CreatedAdminSession = {
  /*
   * Raw session token.
   *
   * Sensitive: only use when placing
   * a secure HttpOnly cookie.
   *
   * Never log or serialize this
   * object into a public response.
   */
  token: string;
  expiresAt: Date;
};

export type AdminSessionDatabase =
  Pool | PoolClient;

export type RevokeSessionResult = {
  revoked: boolean;
};

export type SessionCleanupResult = {
  deletedSessions: number;
};

export type AdminSessionCookieOptions = {
  /*
   * Explicitly control HTTPS cookie
   * behavior in a reverse-proxy setup.
   *
   * Production defaults to secure.
   */
  secure?: boolean;
};

type DatabaseSessionRow = {
  admin_id: string;
  created_at: Date | string;
  expires_at: Date | string;
};

type DatabaseCountRow = {
  count: string | number;
};

/* ============================================================
   3. SHARED POSTGRESQL CONNECTION

   Uses the same global pool key as
   the existing administration APIs.

   Pool sharing works within the
   same Node.js process.

   DATABASE_URL must already exist.
   ============================================================ */

const shared =
  globalThis as typeof globalThis & {
    __taymAdminAuthPool?: Pool;
  };

export function getAdminSessionDatabase(): Pool {
  const connectionString =
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL_NOT_CONFIGURED"
    );
  }

  if (!shared.__taymAdminAuthPool) {
    shared.__taymAdminAuthPool = new Pool({
      connectionString,

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
   4. SAFE DATE CONVERSION
   ============================================================ */

function readDatabaseDate(
  value: Date | string
): Date {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new Error(
      "INVALID_ADMIN_SESSION_DATE"
    );
  }

  return date;
}

/* ============================================================
   5. SESSION TOKEN VALIDATION

   Login generates a random token
   using randomBytes(32).

   32 bytes encoded as hex gives
   a 64-character lowercase token.
   ============================================================ */

export function isValidAdminSessionToken(
  token: unknown
): token is string {
  return (
    typeof token === "string" &&
    TOKEN_PATTERN.test(token)
  );
}

/* ============================================================
   6. SESSION TOKEN HASHING

   IMPORTANT:

   The existing login API uses:

   createHash("sha256")
     .update(Buffer.from(token, "hex"))
     .digest("hex")

   This module uses the exact
   same algorithm.

   Never hash the hex token as
   a UTF-8 string instead.
   ============================================================ */

export function hashAdminSessionToken(
  rawToken: string
): string | null {
  if (!isValidAdminSessionToken(rawToken)) {
    return null;
  }

  return createHash("sha256")
    .update(
      Buffer.from(rawToken, "hex")
    )
    .digest("hex");
}

/* ============================================================
   7. GENERATE CRYPTOGRAPHIC SESSION

   256-bit random token.

   Only the SHA-256 hash is stored
   in PostgreSQL.

   The original token is returned
   only to set a secure cookie.
   ============================================================ */

function generateSessionToken(): {
  token: string;
  tokenHash: string;
} {
  const token = randomBytes(
    ADMIN_SESSION_TOKEN_BYTES
  ).toString("hex");

  if (!isValidAdminSessionToken(token)) {
    throw new Error(
      "ADMIN_SESSION_GENERATION_FAILED"
    );
  }

  const tokenHash = hashAdminSessionToken(token);

  if (!tokenHash) {
    throw new Error(
      "ADMIN_SESSION_HASH_FAILED"
    );
  }

  return {
    token,
    tokenHash,
  };
}

/* ============================================================
   8. CREATE SESSION IN POSTGRESQL

   Called after:
   - Admin email verification
   - Argon2id password verification
   - Login rate-limit verification

   Stores the token hash only.

   No public response should contain
   the returned raw token.
   ============================================================ */

export async function createAdminSession(
  database: AdminSessionDatabase =
    getAdminSessionDatabase()
): Promise<CreatedAdminSession> {
  const {
    token,
    tokenHash,
  } = generateSessionToken();

  const createdAt = new Date();

  const expiresAt = new Date(
    createdAt.getTime() +
      ADMIN_SESSION_DURATION_MS
  );

  await database.query(
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
      PRIMARY_ADMIN_ID,
      createdAt,
      expiresAt,
    ]
  );

  return {
    token,
    expiresAt,
  };
}

/* ============================================================
   9. LOOK UP A SESSION

   The token hash must:
   - Exist in PostgreSQL
   - Belong to the primary admin
   - Not be revoked
   - Not be expired

   Returns null for an invalid
   session.

   Database errors are thrown so
   callers can fail closed.
   ============================================================ */

async function lookupAdminSession(
  tokenHash: string,
  database: AdminSessionDatabase
): Promise<AdminSession | null> {
  if (!TOKEN_HASH_PATTERN.test(tokenHash)) {
    return null;
  }

  const result =
    await database.query<DatabaseSessionRow>(
      `
      SELECT
        admin_id,
        created_at,
        expires_at

      FROM taym_admin_sessions

      WHERE
        token_hash = $1

        AND admin_id = $2

        AND revoked_at IS NULL

        AND expires_at > NOW()

      LIMIT 1
      `,
      [
        tokenHash,
        PRIMARY_ADMIN_ID,
      ]
    );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  if (row.admin_id !== PRIMARY_ADMIN_ID) {
    return null;
  }

  const createdAt =
    readDatabaseDate(row.created_at);

  const expiresAt =
    readDatabaseDate(row.expires_at);

  /*
   * Defense in depth.
   *
   * The SQL query already checks
   * expiration using PostgreSQL time.
   */

  if (expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return {
    adminId: PRIMARY_ADMIN_ID,

    role: "ADMIN",

    createdAt: createdAt.toISOString(),

    expiresAt: expiresAt.toISOString(),
  };
}

/* ============================================================
   10. VERIFY SESSION BY RAW TOKEN

   Useful for:
   - Route handlers
   - Middleware alternatives
   - Explicit server-side checks

   Raw token is never returned.
   ============================================================ */

export async function verifyAdminSessionToken(
  rawToken: string | null | undefined,
  database: AdminSessionDatabase =
    getAdminSessionDatabase()
): Promise<AdminSession | null> {
  if (!rawToken) {
    return null;
  }

  const tokenHash =
    hashAdminSessionToken(rawToken);

  if (!tokenHash) {
    return null;
  }

  return lookupAdminSession(
    tokenHash,
    database
  );
}

/* ============================================================
   11. READ SERVER-SIDE SESSION

   THIS FUNCTION IS USED BY:

   src/app/(admin)/admin/
   (protected)/layout.tsx

   Example:

   const adminSession =
     await getAdminSession();

   if (!adminSession) {
     redirect("/admin/login");
   }

   Reads the Next.js server cookie
   and checks PostgreSQL.

   No client-side trust involved.
   ============================================================ */

export async function getAdminSession(): Promise<
  AdminSession | null
> {
  const cookieStore = await cookies();

  const rawToken = cookieStore.get(
    ADMIN_SESSION_COOKIE
  )?.value;

  if (!rawToken) {
    return null;
  }

  return verifyAdminSessionToken(rawToken);
}

/* ============================================================
   12. REQUIRE ADMIN SESSION

   Use this in server-only
   operations that must never
   continue without authentication.

   Returns AdminSession on success.

   Throws an authorization error
   on missing/invalid session.

   In route handlers, you may
   instead use getAdminSession()
   and return HTTP 401 explicitly.
   ============================================================ */

export class AdminUnauthorizedError extends Error {
  constructor() {
    super("ADMIN_UNAUTHENTICATED");
    this.name = "AdminUnauthorizedError";
  }
}

export async function requireAdminSession(): Promise<
  AdminSession
> {
  const session = await getAdminSession();

  if (!session) {
    throw new AdminUnauthorizedError();
  }

  return session;
}

/* ============================================================
   13. VERIFY EXPLICIT TOKEN IN API

   This function avoids depending
   on ambient Next.js cookies when
   a route already has a request.

   Example:

   const admin = await
     getAdminSessionFromToken(
       request.cookies.get(
         ADMIN_SESSION_COOKIE
       )?.value
     );

   Useful in route handlers.
   ============================================================ */

export async function getAdminSessionFromToken(
  token: string | null | undefined,
  database: AdminSessionDatabase =
    getAdminSessionDatabase()
): Promise<AdminSession | null> {
  return verifyAdminSessionToken(
    token,
    database
  );
}

/* ============================================================
   14. REVOKE A SINGLE SESSION

   A session is revoked by its
   SHA-256 token hash.

   Other administrator sessions
   remain active.

   The operation is idempotent:
   already revoked/unknown sessions
   return revoked=false.

   Database errors are thrown.
   ============================================================ */

export async function revokeAdminSessionByToken(
  rawToken: string | null | undefined,
  database: AdminSessionDatabase =
    getAdminSessionDatabase()
): Promise<RevokeSessionResult> {
  if (!rawToken) {
    return {
      revoked: false,
    };
  }

  const tokenHash =
    hashAdminSessionToken(rawToken);

  if (!tokenHash) {
    return {
      revoked: false,
    };
  }

  const result = await database.query(
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
      PRIMARY_ADMIN_ID,
    ]
  );

  return {
    revoked:
      result.rowCount === 1,
  };
}

/* ============================================================
   15. REVOKE CURRENT SERVER SESSION

   Useful for:
   - Server Actions
   - Protected server-side workflows
   - Account security operations

   Reads the current session cookie
   and revokes the associated record.

   Does not automatically modify
   the HTTP response cookie.

   Use clearAdminSessionCookie()
   on the outgoing response.
   ============================================================ */

export async function revokeCurrentAdminSession(
  database: AdminSessionDatabase =
    getAdminSessionDatabase()
): Promise<RevokeSessionResult> {
  const cookieStore = await cookies();

  const token = cookieStore.get(
    ADMIN_SESSION_COOKIE
  )?.value;

  return revokeAdminSessionByToken(
    token,
    database
  );
}

/* ============================================================
   16. REVOKE ALL ADMIN SESSIONS

   Security action useful when:
   - Password is changed
   - Administrator access is reset
   - A session compromise is suspected

   Must only be callable from
   a trusted authorized server
   workflow.

   Do not expose as a public API
   without strong authorization.
   ============================================================ */

export async function revokeAllAdminSessions(
  database: AdminSessionDatabase =
    getAdminSessionDatabase()
): Promise<number> {
  const result = await database.query(
    `
    UPDATE taym_admin_sessions

    SET
      revoked_at = NOW()

    WHERE
      admin_id = $1

      AND revoked_at IS NULL
    `,
    [PRIMARY_ADMIN_ID]
  );

  return result.rowCount ?? 0;
}

/* ============================================================
   17. COOKIE CONFIGURATION

   Login uses:
   - HttpOnly
   - Secure in production
   - SameSite Strict
   - Path /
   - 12-hour expiration
   - High priority

   All APIs must use the same
   cookie name and path.
   ============================================================ */

function shouldUseSecureCookie(
  options?: AdminSessionCookieOptions
): boolean {
  if (process.env.NODE_ENV === "production") {
    return true;
  }

  return options?.secure ?? false;
}

/* ============================================================
   18. WRITE SESSION COOKIE

   Use only after createAdminSession()
   successfully stores the session.

   The response must not contain
   the raw token in JSON.

   Example:

   const session =
     await createAdminSession();

   const response = NextResponse.json({
     success: true
   });

   setAdminSessionCookie(response, session);
   ============================================================ */

export function setAdminSessionCookie(
  response: NextResponse,
  session: CreatedAdminSession,
  options?: AdminSessionCookieOptions
): void {
  if (!isValidAdminSessionToken(session.token)) {
    throw new Error(
      "INVALID_CREATED_SESSION_TOKEN"
    );
  }

  if (
    !Number.isFinite(
      session.expiresAt.getTime()
    ) ||
    session.expiresAt.getTime() <= Date.now()
  ) {
    throw new Error(
      "INVALID_CREATED_SESSION_EXPIRATION"
    );
  }

  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,

    value: session.token,

    httpOnly: true,

    secure: shouldUseSecureCookie(options),

    sameSite: "strict",

    path: "/",

    expires: session.expiresAt,

    priority: "high",
  });
}

/* ============================================================
   19. DELETE SESSION COOKIE

   Used by:
   - Logout API
   - Expired session handling
   - Invalid session handling

   This only deletes the browser
   cookie.

   Revocation in PostgreSQL must
   be performed separately.
   ============================================================ */

export function clearAdminSessionCookie(
  response: NextResponse,
  options?: AdminSessionCookieOptions
): void {
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,

    value: "",

    httpOnly: true,

    secure: shouldUseSecureCookie(options),

    sameSite: "strict",

    path: "/",

    expires: new Date(0),

    maxAge: 0,

    priority: "high",
  });
}

/* ============================================================
   20. CLEAN EXPIRED / REVOKED SESSIONS

   This function removes:
   - Expired sessions
   - Revoked sessions older than
     the retention threshold

   Do not run on every request.

   Run from a trusted maintenance
   job on an appropriate schedule.

   Retention defaults to 30 days
   for revoked records.

   Review retention against
   applicable compliance needs.
   ============================================================ */

export async function cleanupAdminSessions(
  options?: {
    revokedRetentionDays?: number;
    database?: AdminSessionDatabase;
  }
): Promise<SessionCleanupResult> {
  const retentionDays =
    options?.revokedRetentionDays ?? 30;

  if (
    !Number.isSafeInteger(retentionDays) ||
    retentionDays < 0 ||
    retentionDays > 3650
  ) {
    throw new Error(
      "INVALID_SESSION_RETENTION"
    );
  }

  const database =
    options?.database ??
    getAdminSessionDatabase();

  const result = await database.query(
    `
    DELETE FROM taym_admin_sessions

    WHERE
      expires_at <= NOW()

      OR (
        revoked_at IS NOT NULL

        AND revoked_at <=
          NOW() - ($1::integer * INTERVAL '1 day')
      )
    `,
    [retentionDays]
  );

  return {
    deletedSessions:
      result.rowCount ?? 0,
  };
}

/* ============================================================
   21. COUNT ACTIVE ADMIN SESSIONS

   Useful for diagnostics or
   future administrator security
   settings.

   Only call from trusted server
   code after authorization.

   Do not expose publicly.
   ============================================================ */

export async function countActiveAdminSessions(
  database: AdminSessionDatabase =
    getAdminSessionDatabase()
): Promise<number> {
  const result =
    await database.query<DatabaseCountRow>(
      `
      SELECT
        COUNT(*) AS count

      FROM taym_admin_sessions

      WHERE
        admin_id = $1

        AND revoked_at IS NULL

        AND expires_at > NOW()
      `,
      [PRIMARY_ADMIN_ID]
    );

  const value = Number(
    result.rows[0]?.count
  );

  if (
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(
      "INVALID_ACTIVE_SESSION_COUNT"
    );
  }

  return value;
}

/* ============================================================
   END — FAHRSCHULE TAYM
   ============================================================ */
