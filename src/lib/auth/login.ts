
import "server-only";

import {
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";

import { Pool, type PoolClient } from "pg";

import {
  generateSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";

/* ============================================================
   FAHRSCHULE TAYM
   AUTHENTICATION — LOGIN SERVICE

   File:
   src/lib/auth/login.ts

   Database:
   PostgreSQL

   Authentication:
   - Email address
   - International phone number
   - Password verification
   - Candidate account verification
   - Secure session creation
   - Remember me

   Existing tables:
   - users
   - user_sessions

   No fictional data.
   No new database table.
   No UI component.
   ============================================================ */

/* ============================================================
   1. CONFIGURATION
   ============================================================ */

const SESSION_STANDARD_SECONDS =
  60 * 60 * 24;

const SESSION_REMEMBER_SECONDS =
  60 * 60 * 24 * 7;

const MAX_IDENTIFIER_LENGTH = 254;

const MAX_PASSWORD_BYTES = 1024;

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PHONE_PATTERN =
  /^\+[1-9]\d{7,14}$/;

const HEX_PATTERN =
  /^[0-9a-f]+$/i;

const ALLOWED_HASH_LENGTHS = [
  32,
  64,
];

/*
 * Used when the account does not exist.
 * Reduces timing differences between
 * existing and unknown accounts.
 */
const DUMMY_PASSWORD_HASH =
  "scrypt$0123456789abcdef0123456789abcdef$" +
  "a".repeat(128);

/* ============================================================
   2. TYPES
   ============================================================ */

export type LoginInput = {
  identifier: string;
  password: string;
  rememberMe?: boolean;
};

export type LoginErrorCode =
  | "INVALID_INPUT"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_UNAVAILABLE"
  | "DATABASE_UNAVAILABLE";

export type LoginUser = {
  id: string;

  firstName: string;
  lastName: string;
  fullName: string;

  email: string;
  phoneE164: string;
  countryCode: string;

  role: "CANDIDATE";
  status: "ACTIVE";

  emailVerified: true;
  phoneVerified: boolean;
};

export type LoginSession = {
  id: string;
  token: string;
  expiresAt: Date;
  rememberMe: boolean;

  cookieName: string;

  cookieOptions: {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: string;
    priority: "high";
    maxAge?: number;
    expires?: Date;
  };
};

export type LoginResult = {
  user: LoginUser;
  session: LoginSession;
  redirectTo: "/dashboard";
};

type LoginUserRow = {
  id: string;

  first_name: string;
  last_name: string;
  full_name: string;

  email: string;
  phone_e164: string;
  country_code: string;

  password_hash: string;

  role: string;
  status: string;

  email_verified_at: Date | null;
  phone_verified_at: Date | null;
};

type NormalizedIdentifier = {
  type: "EMAIL" | "PHONE";
  value: string;
};

type ValidatedLoginInput = {
  identifier: NormalizedIdentifier;
  password: string;
  rememberMe: boolean;
};

type ParsedPasswordHash = {
  salt: string | Buffer;
  expectedHash: Buffer;
};

/* ============================================================
   3. AUTHENTICATION ERRORS
   ============================================================ */

export class LoginError extends Error {
  readonly code: LoginErrorCode;

  readonly status: 400 | 401 | 403 | 503;

  constructor(code: LoginErrorCode) {
    const messages: Record<
      LoginErrorCode,
      string
    > = {
      INVALID_INPUT:
        "Invalid login information.",

      INVALID_CREDENTIALS:
        "Invalid email, phone number or password.",

      ACCOUNT_UNAVAILABLE:
        "This account is currently unavailable.",

      DATABASE_UNAVAILABLE:
        "The authentication service is temporarily unavailable.",
    };

    super(messages[code]);

    this.name = "LoginError";
    this.code = code;

    switch (code) {
      case "INVALID_INPUT":
        this.status = 400;
        break;

      case "INVALID_CREDENTIALS":
        this.status = 401;
        break;

      case "ACCOUNT_UNAVAILABLE":
        this.status = 403;
        break;

      case "DATABASE_UNAVAILABLE":
        this.status = 503;
        break;
    }

    Object.setPrototypeOf(
      this,
      LoginError.prototype
    );
  }
}

/* ============================================================
   4. POSTGRESQL CONNECTION

   Uses the same global pool as:
   - src/lib/auth/session.ts
   - src/lib/dashboard.ts

   No new pool for every login request.
   ============================================================ */

const globalForTaym =
  globalThis as typeof globalThis & {
    taymResendPool?: Pool;
  };

function getDatabasePool(): Pool {
  const connectionString =
    process.env.DATABASE_URL;

  if (!connectionString) {
    console.error(
      "[TAYM][LOGIN] DATABASE_URL is missing."
    );

    throw new LoginError(
      "DATABASE_UNAVAILABLE"
    );
  }

  if (!globalForTaym.taymResendPool) {
    const pool = new Pool({
      connectionString,

      max: 5,
      min: 0,

      idleTimeoutMillis: 30_000,

      connectionTimeoutMillis: 10_000,

      allowExitOnIdle: false,
    });

    pool.on("error", (error) => {
      console.error(
        "[TAYM][LOGIN] PostgreSQL pool error:",
        error.name
      );
    });

    globalForTaym.taymResendPool = pool;
  }

  return globalForTaym.taymResendPool;
}

/* ============================================================
   5. EMAIL AND PHONE NORMALIZATION
   ============================================================ */

function normalizeEmail(
  value: string
): string {
  return value
    .trim()
    .toLowerCase();
}

function normalizePhone(
  value: string
): string {
  let phone = value.trim();

  /*
   * Accept common visual separators.
   *
   * +49 151 12345678
   * +49-151-12345678
   * 004915112345678
   */

  phone = phone.replace(
    /[\s().-]/g,
    ""
  );

  if (phone.startsWith("00")) {
    phone = `+${phone.slice(2)}`;
  }

  return phone;
}

function normalizeIdentifier(
  value: string
): NormalizedIdentifier {
  const identifier = value.trim();

  if (
    identifier.length === 0 ||
    identifier.length >
      MAX_IDENTIFIER_LENGTH
  ) {
    throw new LoginError(
      "INVALID_INPUT"
    );
  }

  /* Email login */

  if (identifier.includes("@")) {
    const email =
      normalizeEmail(identifier);

    if (!EMAIL_PATTERN.test(email)) {
      throw new LoginError(
        "INVALID_INPUT"
      );
    }

    return {
      type: "EMAIL",
      value: email,
    };
  }

  /* Phone login */

  const phone =
    normalizePhone(identifier);

  if (!PHONE_PATTERN.test(phone)) {
    throw new LoginError(
      "INVALID_INPUT"
    );
  }

  return {
    type: "PHONE",
    value: phone,
  };
}

/* ============================================================
   6. VALIDATE LOGIN INPUT

   Passwords are never trimmed,
   normalized or converted to lowercase.
   ============================================================ */

function validateLoginInput(
  input: unknown
): ValidatedLoginInput {
  if (
    input === null ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw new LoginError(
      "INVALID_INPUT"
    );
  }

  const data =
    input as Record<string, unknown>;

  if (
    typeof data.identifier !== "string" ||
    typeof data.password !== "string"
  ) {
    throw new LoginError(
      "INVALID_INPUT"
    );
  }

  if (
    data.password.length === 0 ||
    Buffer.byteLength(
      data.password,
      "utf8"
    ) > MAX_PASSWORD_BYTES
  ) {
    throw new LoginError(
      "INVALID_INPUT"
    );
  }

  if (
    data.rememberMe !== undefined &&
    typeof data.rememberMe !== "boolean"
  ) {
    throw new LoginError(
      "INVALID_INPUT"
    );
  }

  return {
    identifier: normalizeIdentifier(
      data.identifier
    ),

    password: data.password,

    rememberMe:
      data.rememberMe === true,
  };
}

/* ============================================================
   7. PASSWORD HASH PARSER

   Supported scrypt formats:

   scrypt$salt$hash
   scrypt:salt:hash
   salt:hash
   salt$hash

   Salt: hexadecimal string
   Hash: hexadecimal string

   Derived key: 32 or 64 bytes

   The registration service must use
   the same salt representation and
   scrypt parameters.

   Unsupported hashes fail securely.
   ============================================================ */

function parsePasswordHash(
  storedHash: string
): ParsedPasswordHash | null {
  if (
    typeof storedHash !== "string" ||
    storedHash.length > 512
  ) {
    return null;
  }

  let salt: string;
  let hash: string;
  let binarySalt = false;

  const separator =
    storedHash.includes("$")
      ? "$"
      : ":";

  const parts =
    storedHash.split(separator);

  if (parts.length === 7 && parts[0] === "scrypt" && parts[1] === "v1" && parts[2] === "16384" && parts[3] === "8" && parts[4] === "1") {
    salt = parts[5];
    hash = parts[6];
    binarySalt = true;
  } else if (
    parts.length === 3 &&
    parts[0].toLowerCase() === "scrypt"
  ) {
    salt = parts[1];
    hash = parts[2];
  } else if (parts.length === 2) {
    salt = parts[0];
    hash = parts[1];
  } else {
    return null;
  }

  if (
    !salt ||
    !hash ||
    salt.length < 32 ||
    salt.length > 128 ||
    salt.length % 2 !== 0 ||
    hash.length % 2 !== 0 ||
    !HEX_PATTERN.test(salt) ||
    !HEX_PATTERN.test(hash)
  ) {
    return null;
  }

  const expectedHash =
    Buffer.from(hash, "hex");

  if (
    !ALLOWED_HASH_LENGTHS.includes(
      expectedHash.length
    )
  ) {
    return null;
  }

  return {
    salt: binarySalt ? Buffer.from(salt, "hex") : salt,
    expectedHash,
  };
}

/* ============================================================
   8. ASYNCHRONOUS SCRYPT

   Explicit default scrypt parameters:
   N = 16384
   r = 8
   p = 1

   Uses asynchronous Node.js crypto
   instead of blocking the event loop.
   ============================================================ */

function derivePasswordKey(
  password: string,
  salt: string | Buffer,
  keyLength: number
): Promise<Buffer> {
  return new Promise(
    (resolve, reject) => {
      scrypt(
        password,
        salt,
        keyLength,
        {
          N: 16_384,
          r: 8,
          p: 1,
          maxmem: 64 * 1024 * 1024,
        },
        (error, derivedKey) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(
            Buffer.from(derivedKey)
          );
        }
      );
    }
  );
}

/* ============================================================
   9. PASSWORD VERIFICATION

   timingSafeEqual is used to compare
   the derived key with the stored hash.

   Never compares plaintext passwords.
   ============================================================ */

export async function verifyLoginPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  if (
    typeof password !== "string" ||
    Buffer.byteLength(
      password,
      "utf8"
    ) > MAX_PASSWORD_BYTES
  ) {
    return false;
  }

  const parsed =
    parsePasswordHash(storedHash);

  if (!parsed) {
    return false;
  }

  const actualHash =
    await derivePasswordKey(
      password,
      parsed.salt,
      parsed.expectedHash.length
    );

  if (
    actualHash.length !==
      parsed.expectedHash.length
  ) {
    return false;
  }

  return timingSafeEqual(
    actualHash,
    parsed.expectedHash
  );
}

/* ============================================================
   10. FIND CANDIDATE ACCOUNT

   Only parameterized SQL queries.

   Does not return password hashes
   to the browser.
   ============================================================ */

async function findLoginUser(
  identifier: NormalizedIdentifier
): Promise<LoginUserRow | null> {
  const db = getDatabasePool();

  const columns = `
    id,
    first_name,
    last_name,
    full_name,
    email,
    phone_e164,
    country_code,
    password_hash,
    role,
    status,
    email_verified_at,
    phone_verified_at
  `;

  if (identifier.type === "EMAIL") {
    const result =
      await db.query<LoginUserRow>(
        `
        SELECT ${columns}

        FROM users

        WHERE email = $1

        LIMIT 1
        `,
        [identifier.value]
      );

    return result.rows[0] ?? null;
  }

  const result =
    await db.query<LoginUserRow>(
      `
      SELECT ${columns}

      FROM users

      WHERE phone_e164 = $1

      LIMIT 1
      `,
      [identifier.value]
    );

  return result.rows[0] ?? null;
}

/* ============================================================
   11. CANDIDATE ACCESS CONTROL
   ============================================================ */

function isCandidateAvailable(
  user: LoginUserRow
): boolean {
  return (
    user.role === "CANDIDATE" &&
    user.status === "ACTIVE" &&
    user.email_verified_at !== null
  );
}

function toLoginUser(
  user: LoginUserRow
): LoginUser {
  return {
    id: user.id,

    firstName: user.first_name,
    lastName: user.last_name,
    fullName: user.full_name,

    email: user.email,
    phoneE164: user.phone_e164,
    countryCode: user.country_code,

    role: "CANDIDATE",
    status: "ACTIVE",

    emailVerified: true,
    phoneVerified: user.phone_verified_at !== null,
  };
}

/* ============================================================
   12. LOCK AND RECHECK ACCOUNT

   Rechecks the user's password hash,
   account status and role immediately
   before creating a session.

   Prevents login from completing
   using an outdated account state.
   ============================================================ */

async function lockCandidate(
  client: PoolClient,
  userId: string
): Promise<LoginUserRow | null> {
  const result =
    await client.query<LoginUserRow>(
      `
      SELECT
        id,
        first_name,
        last_name,
        full_name,
        email,
        phone_e164,
        country_code,
        password_hash,
        role,
        status,
        email_verified_at,
        phone_verified_at

      FROM users

      WHERE id = $1

      FOR UPDATE
      `,
      [userId]
    );

  return result.rows[0] ?? null;
}

/* ============================================================
   13. SESSION COOKIE CONFIGURATION

   Standard login:
   - Browser session cookie
   - Database expiration after 24 hours

   Remember me:
   - Persistent cookie
   - Database expiration after 7 days

   Uses the existing taym_session name.
   ============================================================ */

function buildLoginCookieOptions(
  rememberMe: boolean,
  expiresAt: Date
): LoginSession["cookieOptions"] {
  const base =
    getSessionCookieOptions();

  const options: LoginSession["cookieOptions"] =
    {
      httpOnly: base.httpOnly,

      secure: base.secure,

      sameSite: base.sameSite,

      path: base.path,

      priority: base.priority,
    };

  if (rememberMe) {
    options.maxAge =
      SESSION_REMEMBER_SECONDS;

    options.expires = expiresAt;
  }

  return options;
}

/* ============================================================
   14. CREATE SECURE LOGIN SESSION

   A new random token is generated
   for each successful login.

   PostgreSQL stores only its hash,
   never the plaintext session token.

   UUID is explicitly generated
   because raw SQL does not execute
   Prisma's client-side uuid() default.
   ============================================================ */

async function createLoginSession(
  client: PoolClient,
  userId: string,
  rememberMe: boolean
): Promise<LoginSession> {
  const sessionId = randomUUID();

  const { token, tokenHash } =
    generateSessionToken();

  const duration = rememberMe
    ? SESSION_REMEMBER_SECONDS
    : SESSION_STANDARD_SECONDS;

  const expiresAt = new Date(
    Date.now() + duration * 1000
  );

  await client.query(
    `
    INSERT INTO user_sessions (
      id,
      user_id,
      token_hash,
      created_at,
      expires_at,
      revoked_at
    )

    VALUES (
      $1,
      $2,
      $3,
      NOW(),
      $4,
      NULL
    )
    `,
    [
      sessionId,
      userId,
      tokenHash,
      expiresAt,
    ]
  );

  return {
    id: sessionId,

    token,

    expiresAt,

    rememberMe,

    cookieName: SESSION_COOKIE_NAME,

    cookieOptions:
      buildLoginCookieOptions(
        rememberMe,
        expiresAt
      ),
  };
}

/* ============================================================
   15. MAIN LOGIN SERVICE

   Called by:
   src/app/api/auth/login/route.ts

   Password verification happens
   before opening the SQL transaction.

   The account is checked again
   before session creation.

   Never expose LoginResult.session
   directly in a JSON response.
   ============================================================ */

export async function loginCandidate(
  input: LoginInput
): Promise<LoginResult> {
  /* Validate and normalize input */

  const validated =
    validateLoginInput(input);

  /* Find matching account */

  const user = await findLoginUser(
    validated.identifier
  );

  /* Verify password or dummy hash */

  const storedHash =
    user?.password_hash ??
    DUMMY_PASSWORD_HASH;

  const parsed =
    parsePasswordHash(storedHash);

  /*
   * A malformed or unsupported stored
   * hash must not bypass verification.
   */

  const passwordValid =
    await verifyLoginPassword(
      validated.password,
      parsed
        ? storedHash
        : DUMMY_PASSWORD_HASH
    );

  if (
    !user ||
    !parsed ||
    !passwordValid
  ) {
    throw new LoginError(
      "INVALID_CREDENTIALS"
    );
  }

  /*
   * Account status is checked only
   * after successful password verification.
   */

  if (!isCandidateAvailable(user)) {
    throw new LoginError(
      "ACCOUNT_UNAVAILABLE"
    );
  }

  /* Open PostgreSQL transaction */

  const db = getDatabasePool();

  const client = await db.connect();

  let transactionOpen = false;

  let releaseWithError:
    | Error
    | undefined;

  try {
    await client.query("BEGIN");

    transactionOpen = true;

    /*
     * Lock and recheck the current account.
     */

    const currentUser =
      await lockCandidate(
        client,
        user.id
      );

    if (!currentUser) {
      throw new LoginError(
        "INVALID_CREDENTIALS"
      );
    }

    /*
     * If the password changed while
     * authentication was in progress,
     * do not create a session.
     */

    if (
      currentUser.password_hash !==
      user.password_hash
    ) {
      throw new LoginError(
        "INVALID_CREDENTIALS"
      );
    }

    if (
      !isCandidateAvailable(
        currentUser
      )
    ) {
      throw new LoginError(
        "ACCOUNT_UNAVAILABLE"
      );
    }

    /* Create a fresh authenticated session */

    const session =
      await createLoginSession(
        client,
        currentUser.id,
        validated.rememberMe
      );

    await client.query("COMMIT");

    transactionOpen = false;

    return {
      user: toLoginUser(currentUser),

      session,

      redirectTo: "/dashboard",
    };
  } catch (error: unknown) {
    if (transactionOpen) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {
        releaseWithError = new Error(
          "PostgreSQL rollback failed."
        );

        console.error(
          "[TAYM][LOGIN] Transaction rollback failed."
        );
      }
    }

    /*
     * Authentication errors are handled
     * by the API route.
     *
     * Database errors are not converted
     * into invalid credentials.
     */

    throw error;
  } finally {
    client.release(
      releaseWithError
    );
  }
}
