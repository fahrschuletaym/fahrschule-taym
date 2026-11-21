
import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
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
   PASSWORD RESET SERVICE

   File:
   src/lib/auth/password-reset.ts

   Database:
   PostgreSQL

   Email provider:
   Resend

   Workflow:
   1. Request password reset
   2. Send six-digit email code
   3. Verify email code
   4. Generate temporary reset authorization
   5. Save new password
   6. Revoke previous sessions
   7. Create new authenticated session

   Supported languages:
   DE | AR | TR | ES

   No UI component.
   No new layout.
   ============================================================ */

/* ============================================================
   1. CONFIGURATION
   ============================================================ */

export const RESET_CODE_LENGTH = 6;

export const RESET_CODE_DURATION_SECONDS =
  10 * 60;

export const RESET_TOKEN_DURATION_SECONDS =
  10 * 60;

export const RESET_RESEND_DELAY_SECONDS = 60;

export const RESET_MAX_ATTEMPTS = 5;

export const RESET_MAX_REQUESTS_PER_HOUR = 5;

export const RESET_COOKIE_NAME =
  "taym_password_reset";

export const PASSWORD_MIN_LENGTH = 12;

const PASSWORD_MAX_BYTES = 1024;

const RESEND_API_URL =
  "https://api.resend.com/emails";

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TOKEN_PATTERN =
  /^[A-Za-z0-9_-]{43}$/;

/* ============================================================
   2. TYPES
   ============================================================ */

export type ResetLocale =
  | "de"
  | "ar"
  | "tr"
  | "es";

export type RequestPasswordResetInput = {
  email: string;
  locale?: ResetLocale;
};

export type VerifyResetCodeInput = {
  email: string;
  challengeId: string;
  code: string;
};

export type CompletePasswordResetInput = {
  challengeId: string;
  resetToken: string;
  password: string;
  confirmPassword: string;
};

export type RequestPasswordResetResult = {
  success: true;
  challengeId: string;
  expiresAt: string;
  resendAfter: number;
};

export type VerifyResetCodeResult = {
  success: true;
  challengeId: string;

  // Server only. Set this in an HttpOnly cookie.
  resetToken: string;

  expiresAt: Date;
};

export type CompletePasswordResetResult = {
  success: true;

  redirectTo: "/dashboard";

  user: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
  };

  session: {
    id: string;
    token: string;
    expiresAt: Date;
    cookieName: string;
    cookieOptions: ReturnType<
      typeof getSessionCookieOptions
    >;
  };
};

export type PasswordResetErrorCode =
  | "INVALID_INPUT"
  | "INVALID_EMAIL"
  | "INVALID_CODE"
  | "CODE_EXPIRED"
  | "TOO_MANY_ATTEMPTS"
  | "INVALID_RESET_TOKEN"
  | "RESET_TOKEN_EXPIRED"
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_TOO_LONG"
  | "PASSWORD_MISMATCH"
  | "RESET_NOT_AVAILABLE"
  | "SERVICE_UNAVAILABLE";

type ResetUserRow = {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  password_hash: string;
  status: string;
  role: string;
  email_verified_at: Date | null;
  phone_verified_at: Date | null;
};

type PasswordResetRow = {
  id: string;
  user_id: string | null;
  email: string;

  code_hash: string;
  code_expires_at: Date;

  attempts: number;

  request_count: number;
  request_window_started_at: Date;

  last_sent_at: Date;

  verified_at: Date | null;

  reset_token_hash: string | null;
  reset_token_expires_at: Date | null;

  password_fingerprint: string | null;

  consumed_at: Date | null;

  created_at: Date;
  updated_at: Date;
};

/* ============================================================
   3. ERROR HANDLING
   ============================================================ */

export class PasswordResetError extends Error {
  readonly code: PasswordResetErrorCode;
  readonly status: number;
  readonly retryAfter?: number;

  constructor(
    code: PasswordResetErrorCode,
    status = 400,
    retryAfter?: number
  ) {
    super(code);

    this.name = "PasswordResetError";
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;

    Object.setPrototypeOf(
      this,
      PasswordResetError.prototype
    );
  }
}

/* ============================================================
   4. POSTGRESQL CONNECTION

   Shared pool:
   - registration
   - login
   - session
   - dashboard
   - password reset
   ============================================================ */

const globalForTaym =
  globalThis as typeof globalThis & {
    taymResendPool?: Pool;
  };

function getDatabasePool(): Pool {
  const connectionString =
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new PasswordResetError(
      "SERVICE_UNAVAILABLE",
      503
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
        "[TAYM][PASSWORD_RESET][DATABASE]",
        error.name
      );
    });

    globalForTaym.taymResendPool = pool;
  }

  return globalForTaym.taymResendPool;
}

/* ============================================================
   5. DATABASE TRANSACTIONS
   ============================================================ */

async function withTransaction<T>(
  callback: (
    client: PoolClient
  ) => Promise<T>
): Promise<T> {
  const pool = getDatabasePool();

  const client = await pool.connect();

  let transactionOpen = false;

  let releaseError: Error | undefined;

  try {
    await client.query("BEGIN");

    transactionOpen = true;

    await client.query(
      "SET LOCAL statement_timeout = '10000ms'"
    );

    await client.query(
      "SET LOCAL lock_timeout = '5000ms'"
    );

    const result =
      await callback(client);

    await client.query("COMMIT");

    transactionOpen = false;

    return result;
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query("ROLLBACK");
      } catch {
        releaseError = new Error(
          "Password reset transaction rollback failed."
        );
      }
    }

    throw error;
  } finally {
    client.release(releaseError);
  }
}

/* ============================================================
   6. INPUT VALIDATION
   ============================================================ */

function normalizeEmail(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new PasswordResetError(
      "INVALID_EMAIL"
    );
  }

  const email =
    value.trim().toLowerCase();

  if (
    email.length === 0 ||
    email.length > 254 ||
    !EMAIL_PATTERN.test(email)
  ) {
    throw new PasswordResetError(
      "INVALID_EMAIL"
    );
  }

  return email;
}

function normalizeLocale(
  locale: unknown
): ResetLocale {
  switch (locale) {
    case "ar":
    case "tr":
    case "es":
    case "de":
      return locale;

    default:
      return "de";
  }
}

function validateChallengeId(
  value: unknown
): string {
  if (
    typeof value !== "string" ||
    !UUID_PATTERN.test(value)
  ) {
    throw new PasswordResetError(
      "INVALID_INPUT"
    );
  }

  return value;
}

function normalizeCode(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new PasswordResetError(
      "INVALID_CODE"
    );
  }

  const code = value
    .trim()
    .replace(/[\s-]/g, "")
    .replace(
      /[٠-٩]/g,
      (digit) =>
        String(
          digit.charCodeAt(0) - 0x0660
        )
    )
    .replace(
      /[۰-۹]/g,
      (digit) =>
        String(
          digit.charCodeAt(0) - 0x06f0
        )
    );

  if (!/^\d{6}$/.test(code)) {
    throw new PasswordResetError(
      "INVALID_CODE"
    );
  }

  return code;
}

function validateResetToken(
  value: unknown
): string {
  if (
    typeof value !== "string" ||
    !TOKEN_PATTERN.test(value)
  ) {
    throw new PasswordResetError(
      "INVALID_RESET_TOKEN",
      401
    );
  }

  return value;
}

function validateNewPassword(
  password: unknown,
  confirmPassword: unknown
): string {
  if (
    typeof password !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    throw new PasswordResetError(
      "INVALID_INPUT"
    );
  }

  if (
    Array.from(password).length <
    PASSWORD_MIN_LENGTH
  ) {
    throw new PasswordResetError(
      "PASSWORD_TOO_SHORT"
    );
  }

  if (
    Buffer.byteLength(
      password,
      "utf8"
    ) > PASSWORD_MAX_BYTES
  ) {
    throw new PasswordResetError(
      "PASSWORD_TOO_LONG"
    );
  }

  if (password !== confirmPassword) {
    throw new PasswordResetError(
      "PASSWORD_MISMATCH"
    );
  }

  return password;
}

/* ============================================================
   7. CRYPTOGRAPHIC SECURITY
   ============================================================ */

function getVerificationSecret(): string {
  const secret =
    process.env.VERIFICATION_SECRET;

  if (
    !secret ||
    Buffer.byteLength(
      secret,
      "utf8"
    ) < 32
  ) {
    throw new PasswordResetError(
      "SERVICE_UNAVAILABLE",
      503
    );
  }

  return secret;
}

function generateResetCode(): string {
  return randomInt(
    0,
    1_000_000
  )
    .toString()
    .padStart(6, "0");
}

/**
 * HMAC instead of simple SHA-256.
 *
 * A six-digit OTP has limited entropy.
 * A server-side secret protects its stored
 * representation against offline guessing.
 */

function hashResetCode(
  challengeId: string,
  email: string,
  code: string
): string {
  return createHmac(
    "sha256",
    getVerificationSecret()
  )
    .update(
      `password-reset:otp:${challengeId}:${email}:${code}`,
      "utf8"
    )
    .digest("hex");
}

function generateResetToken(): string {
  return randomBytes(32)
    .toString("base64url");
}

function hashResetToken(
  token: string
): string {
  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

function getPasswordFingerprint(
  passwordHash: string
): string {
  return createHmac(
    "sha256",
    getVerificationSecret()
  )
    .update(
      `password-reset:password:${passwordHash}`,
      "utf8"
    )
    .digest("hex");
}

function safeHashEqual(
  first: string,
  second: string
): boolean {
  if (
    !/^[a-f0-9]{64}$/i.test(first) ||
    !/^[a-f0-9]{64}$/i.test(second)
  ) {
    return false;
  }

  const firstBuffer =
    Buffer.from(first, "hex");

  const secondBuffer =
    Buffer.from(second, "hex");

  return timingSafeEqual(
    firstBuffer,
    secondBuffer
  );
}

/* ============================================================
   8. PASSWORD HASHING

   Compatible with verifyLoginPassword()
   in src/lib/auth/login.ts.

   Format:
   scrypt$salt$hash

   N = 16384
   r = 8
   p = 1
   Key length = 64 bytes

   Password is never stored in plaintext.
   ============================================================ */

async function hashNewPassword(
  password: string
): Promise<string> {
  const salt =
    randomBytes(32).toString("hex");

  const derivedKey =
    await new Promise<Buffer>(
      (resolve, reject) => {
        scrypt(
          password,
          salt,
          64,
          {
            N: 16_384,
            r: 8,
            p: 1,
            maxmem:
              64 * 1024 * 1024,
          },
          (error, key) => {
            if (error) {
              reject(error);
              return;
            }

            resolve(
              Buffer.from(key)
            );
          }
        );
      }
    );

  return [
    "scrypt",
    salt,
    derivedKey.toString("hex"),
  ].join("$");
}

/* ============================================================
   9. EMAIL TRANSLATIONS

   Same four languages as the website.
   ============================================================ */

const EMAIL_TRANSLATIONS = {
  de: {
    subject:
      "Passwort zurücksetzen – Fahrschule TAYM",

    title:
      "Passwort zurücksetzen",

    introduction:
      "Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.",

    instruction:
      "Verwenden Sie den folgenden Bestätigungscode:",

    expiration:
      "Dieser Code ist 10 Minuten gültig.",

    security:
      "Geben Sie diesen Code niemals an andere Personen weiter.",

    ignore:
      "Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.",

    footer:
      "Automatische Sicherheitsnachricht",
  },

  ar: {
    subject:
      "إعادة تعيين كلمة المرور – Fahrschule TAYM",

    title:
      "إعادة تعيين كلمة المرور",

    introduction:
      "لقد طلبت إعادة تعيين كلمة المرور الخاصة بك.",

    instruction:
      "استخدم رمز التحقق التالي:",

    expiration:
      "هذا الرمز صالح لمدة 10 دقائق.",

    security:
      "لا تشارك هذا الرمز مع أي شخص.",

    ignore:
      "إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة.",

    footer:
      "رسالة أمان تلقائية",
  },

  tr: {
    subject:
      "Şifre sıfırlama – Fahrschule TAYM",

    title:
      "Şifrenizi sıfırlayın",

    introduction:
      "Şifrenizi sıfırlamak için bir istekte bulundunuz.",

    instruction:
      "Aşağıdaki doğrulama kodunu kullanın:",

    expiration:
      "Bu kod 10 dakika geçerlidir.",

    security:
      "Bu kodu hiç kimseyle paylaşmayın.",

    ignore:
      "Bu isteği siz yapmadıysanız bu e-postayı dikkate almayabilirsiniz.",

    footer:
      "Otomatik güvenlik bildirimi",
  },

  es: {
    subject:
      "Restablecer contraseña – Fahrschule TAYM",

    title:
      "Restablecer contraseña",

    introduction:
      "Ha solicitado restablecer su contraseña.",

    instruction:
      "Utilice el siguiente código de verificación:",

    expiration:
      "Este código es válido durante 10 minutos.",

    security:
      "No comparta este código con nadie.",

    ignore:
      "Si no ha solicitado este cambio, puede ignorar este correo electrónico.",

    footer:
      "Mensaje automático de seguridad",
  },
} satisfies Record<
  ResetLocale,
  {
    subject: string;
    title: string;
    introduction: string;
    instruction: string;
    expiration: string;
    security: string;
    ignore: string;
    footer: string;
  }
>;

/* ============================================================
   10. EMAIL TEMPLATE

   Responsive email:
   - Desktop
   - Mobile
   - Tablet

   No external image required.
   ============================================================ */

function buildResetEmail(
  code: string,
  locale: ResetLocale
) {
  const t =
    EMAIL_TRANSLATIONS[locale];

  const direction =
    locale === "ar"
      ? "rtl"
      : "ltr";

  const html = `
<!DOCTYPE html>
<html lang="${locale}" dir="${direction}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport"
        content="width=device-width, initial-scale=1.0">
  <title>${t.title}</title>
</head>

<body style="
  margin:0;
  padding:0;
  background:#f3f6f2;
  font-family:Arial,Helvetica,sans-serif;
  color:#172019;
">

  <table role="presentation"
         width="100%"
         cellpadding="0"
         cellspacing="0"
         style="background:#f3f6f2;">

    <tr>
      <td align="center"
          style="padding:24px 12px;">

        <table role="presentation"
               width="100%"
               cellpadding="0"
               cellspacing="0"
               style="
                 max-width:560px;
                 background:#ffffff;
                 border:1px solid #dfe6db;
                 border-radius:18px;
                 overflow:hidden;
               ">

          <tr>
            <td align="center"
                style="
                  padding:26px 20px;
                  background:#101c15;
                ">

              <span style="
                font-size:24px;
                font-weight:bold;
                color:#ffffff;
              ">
                Fahrschule
              </span>

              <span style="
                font-size:24px;
                font-weight:bold;
                color:#d5ab54;
              ">
                TAYM
              </span>

            </td>
          </tr>

          <tr>
            <td style="padding:30px 24px;">

              <h1 style="
                margin:0 0 18px;
                font-size:25px;
                line-height:1.3;
                color:#172019;
              ">
                ${t.title}
              </h1>

              <p style="
                font-size:15px;
                line-height:1.7;
                color:#465249;
              ">
                ${t.introduction}
              </p>

              <p style="
                font-size:15px;
                line-height:1.7;
                color:#465249;
              ">
                ${t.instruction}
              </p>

              <div dir="ltr"
                   style="
                     margin:26px 0;
                     padding:23px 10px;
                     background:#eff8e6;
                     border:1px solid #b7d991;
                     border-radius:12px;
                     text-align:center;
                     font-family:monospace;
                     font-size:32px;
                     font-weight:bold;
                     letter-spacing:6px;
                     color:#327900;
                   ">
                ${code}
              </div>

              <p style="
                font-size:14px;
                font-weight:bold;
                color:#327900;
              ">
                ${t.expiration}
              </p>

              <div style="
                margin-top:24px;
                padding:15px;
                background:#f5f7f4;
                border-radius:10px;
                font-size:13px;
                line-height:1.7;
                color:#465249;
              ">
                ${t.security}
                <br><br>
                ${t.ignore}
              </div>

            </td>
          </tr>

          <tr>
            <td align="center"
                style="
                  padding:20px 16px;
                  border-top:1px solid #e7ebe5;
                  color:#748076;
                  font-size:12px;
                  line-height:1.7;
                ">

              Fahrschule TAYM
              <br>
              ${t.footer}
              <br>
              fahrschule-taym.de

            </td>
          </tr>

        </table>

      </td>
    </tr>

  </table>

</body>
</html>
`;

  const text = [
    "Fahrschule TAYM",
    "",
    t.title,
    "",
    t.introduction,
    t.instruction,
    "",
    code,
    "",
    t.expiration,
    t.security,
    "",
    t.ignore,
  ].join("\n");

  return {
    subject: t.subject,
    html,
    text,
  };
}

/* ============================================================
   11. RESEND CONFIGURATION
   ============================================================ */

function getResendConfiguration() {
  const apiKey =
    process.env.RESEND_API_KEY;

  const from =
    process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new PasswordResetError(
      "SERVICE_UNAVAILABLE",
      503
    );
  }

  return {
    apiKey,
    from,
  };
}

/* ============================================================
   12. SEND RESET CODE

   Uses the official Resend HTTP API.

   No additional SDK installation needed.
   No email code logged to the terminal.
   ============================================================ */

async function sendResetCodeEmail(
  email: string,
  code: string,
  locale: ResetLocale,
  challengeId: string
): Promise<void> {
  const config =
    getResendConfiguration();

  const template =
    buildResetEmail(
      code,
      locale
    );

  const controller =
    new AbortController();

  const timeout =
    setTimeout(() => {
      controller.abort();
    }, 15_000);

  try {
    const response =
      await fetch(RESEND_API_URL, {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${config.apiKey}`,

          "Content-Type":
            "application/json",

          "Idempotency-Key":
            `taym-password-reset-${challengeId}`,
        },

        body: JSON.stringify({
          from: config.from,

          to: [email],

          subject:
            template.subject,

          html:
            template.html,

          text:
            template.text,
        }),

        cache: "no-store",

        signal:
          controller.signal,
      });

    if (!response.ok) {
      console.error(
        "[TAYM][PASSWORD_RESET][RESEND]",
        {
          status: response.status,
          challengeId,
        }
      );

      throw new PasswordResetError(
        "SERVICE_UNAVAILABLE",
        503
      );
    }
  } catch (error) {
    if (
      error instanceof
      PasswordResetError
    ) {
      throw error;
    }

    console.error(
      "[TAYM][PASSWORD_RESET][EMAIL_ERROR]",
      {
        challengeId,

        type:
          error instanceof Error
            ? error.name
            : "UnknownError",
      }
    );

    throw new PasswordResetError(
      "SERVICE_UNAVAILABLE",
      503
    );
  } finally {
    clearTimeout(timeout);
  }
}

/* ============================================================
   13. FIND CANDIDATE

   Only active, verified candidate accounts
   can complete password recovery.
   ============================================================ */

async function findCandidateByEmail(
  client: PoolClient,
  email: string
): Promise<ResetUserRow | null> {
  const result =
    await client.query<ResetUserRow>(
      `
      SELECT
        id,
        first_name,
        last_name,
        full_name,
        email,
        password_hash,
        status,
        role,
        email_verified_at,
        phone_verified_at

      FROM users

      WHERE email = $1

        AND role = 'CANDIDATE'

        AND status = 'ACTIVE'

        AND email_verified_at IS NOT NULL


      LIMIT 1
      `,
      [email]
    );

  return result.rows[0] ?? null;
}

/* ============================================================
   14. REQUEST PASSWORD RESET

   Creates a real PostgreSQL challenge.

   Security:
   - Generic response for unknown accounts
   - No public account-existence indicator
   - Resend cooldown
   - Persistent per-email request limit
   - Concurrent request locking
   - Old code replaced by new code
   ============================================================ */

export async function requestPasswordReset(
  input: RequestPasswordResetInput
): Promise<RequestPasswordResetResult> {
  const email =
    normalizeEmail(input?.email);

  const locale =
    normalizeLocale(input?.locale);

  getVerificationSecret();

  getResendConfiguration();

  const result =
    await withTransaction(async (client) => {
      /*
       * Serialize reset requests for
       * the same normalized email.
       */

      await client.query(
        `
        SELECT pg_advisory_xact_lock(
          hashtextextended($1, 0)
        )
        `,
        [`taym:password-reset:${email}`]
      );

      const existingResult =
        await client.query<PasswordResetRow>(
          `
          SELECT *

          FROM password_reset_requests

          WHERE email = $1

          FOR UPDATE
          `,
          [email]
        );

      const existing =
        existingResult.rows[0] ?? null;

      const now = Date.now();

      const requestWindowMs =
        60 * 60 * 1000;

      const sameWindow =
        existing !== null &&
        existing.request_window_started_at
          .getTime() +
          requestWindowMs >
          now;

      const requestCount =
        sameWindow
          ? existing!.request_count
          : 0;

      /*
       * Apply exactly the same cooldown
       * for existing and unknown accounts.
       */

      if (existing) {
        const lastSent =
          existing.last_sent_at.getTime();

        const cooldownEnd =
          lastSent +
          RESET_RESEND_DELAY_SECONDS *
            1000;

        if (cooldownEnd > now) {
          return {
            challengeId:
              existing.id,

            expiresAt:
              existing.code_expires_at,

            resendAfter:
              Math.ceil(
                (cooldownEnd - now) /
                  1000
              ),

            emailToSend: null,

            codeToSend: null,
          };
        }
      }

      /*
       * Maximum five reset requests
       * per normalized email per hour.
       */

      if (
        requestCount >=
        RESET_MAX_REQUESTS_PER_HOUR
      ) {
        const retryAfter =
          Math.max(
            1,
            Math.ceil(
              (
                existing!
                  .request_window_started_at
                  .getTime() +
                requestWindowMs -
                now
              ) / 1000
            )
          );

        throw new PasswordResetError(
          "TOO_MANY_ATTEMPTS",
          429,
          retryAfter
        );
      }

      const user =
        await findCandidateByEmail(
          client,
          email
        );

      const challengeId =
        randomUUID();

      const code =
        generateResetCode();

      const codeHash =
        hashResetCode(
          challengeId,
          email,
          code
        );

      const expiresAt =
        new Date(
          now +
          RESET_CODE_DURATION_SECONDS *
            1000
        );

      const windowStartedAt =
        sameWindow
          ? existing!
              .request_window_started_at
          : new Date(now);

      const fingerprint =
        user
          ? getPasswordFingerprint(
              user.password_hash
            )
          : null;

      /*
       * The same challenge structure is
       * created even for unknown emails.
       *
       * user_id is then NULL.
       * No reset email is sent.
       */

      await client.query(
        `
        INSERT INTO password_reset_requests (
          id,
          user_id,
          email,
          code_hash,
          code_expires_at,
          attempts,
          request_count,
          request_window_started_at,
          last_sent_at,
          password_fingerprint,
          verified_at,
          reset_token_hash,
          reset_token_expires_at,
          consumed_at,
          created_at,
          updated_at
        )

        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          0,
          $6,
          $7,
          NOW(),
          $8,
          NULL,
          NULL,
          NULL,
          NULL,
          NOW(),
          NOW()
        )

        ON CONFLICT (email)

        DO UPDATE SET
          id = EXCLUDED.id,
          user_id = EXCLUDED.user_id,
          code_hash = EXCLUDED.code_hash,
          code_expires_at = EXCLUDED.code_expires_at,
          attempts = 0,
          request_count = EXCLUDED.request_count,
          request_window_started_at =
            EXCLUDED.request_window_started_at,
          last_sent_at = NOW(),
          password_fingerprint =
            EXCLUDED.password_fingerprint,
          verified_at = NULL,
          reset_token_hash = NULL,
          reset_token_expires_at = NULL,
          consumed_at = NULL,
          created_at = NOW(),
          updated_at = NOW()
        `,
        [
          challengeId,

          user?.id ?? null,

          email,

          codeHash,

          expiresAt,

          requestCount + 1,

          windowStartedAt,

          fingerprint,
        ]
      );

      return {
        challengeId,

        expiresAt,

        resendAfter:
          RESET_RESEND_DELAY_SECONDS,

        emailToSend:
          user?.email ?? null,

        codeToSend:
          user ? code : null,
      };
    });

  /*
   * Send email only after PostgreSQL commits.
   *
   * Provider failures do not disclose whether
   * a particular account exists.
   */

  if (
    result.emailToSend &&
    result.codeToSend
  ) {
    try {
      await sendResetCodeEmail(
        result.emailToSend,
        result.codeToSend,
        locale,
        result.challengeId
      );
    } catch {
      /*
       * A failed or uncertain delivery is
       * not returned as an account-specific
       * public error.
       *
       * The user may request another code
       * after the resend cooldown.
       */

      console.error(
        "[TAYM][PASSWORD_RESET] Email delivery not confirmed.",
        {
          challengeId:
            result.challengeId,
        }
      );
    }
  }

  return {
    success: true,

    challengeId:
      result.challengeId,

    expiresAt:
      result.expiresAt.toISOString(),

    resendAfter:
      result.resendAfter,
  };
}

/* ============================================================
   15. VERIFY SIX-DIGIT CODE

   Security:
   - Challenge identification
   - Email binding
   - Expiration
   - Maximum five failed attempts
   - Constant-time hash comparison
   - One-time code usage
   - Temporary reset token
   ============================================================ */

export async function verifyPasswordResetCode(
  input: VerifyResetCodeInput
): Promise<VerifyResetCodeResult> {
  const email =
    normalizeEmail(input?.email);

  const challengeId =
    validateChallengeId(
      input?.challengeId
    );

  const code =
    normalizeCode(input?.code);

  const providedHash =
    hashResetCode(
      challengeId,
      email,
      code
    );

  /*
   * Return expected failures from
   * the transaction instead of throwing.
   *
   * This ensures failed attempts
   * are committed to PostgreSQL.
   */

  const result =
    await withTransaction(async (client) => {
      const query =
        await client.query<PasswordResetRow>(
          `
          SELECT *

          FROM password_reset_requests

          WHERE id = $1
            AND email = $2

          FOR UPDATE
          `,
          [
            challengeId,
            email,
          ]
        );

      const row =
        query.rows[0];

      if (
        !row ||
        row.consumed_at ||
        row.verified_at
      ) {
        return {
          ok: false as const,

          code:
            "INVALID_CODE" as const,

          status: 400,
        };
      }

      if (
        row.code_expires_at.getTime() <=
        Date.now()
      ) {
        return {
          ok: false as const,

          code:
            "CODE_EXPIRED" as const,

          status: 400,
        };
      }

      if (
        row.attempts >=
        RESET_MAX_ATTEMPTS
      ) {
        return {
          ok: false as const,

          code:
            "TOO_MANY_ATTEMPTS" as const,

          status: 429,
        };
      }

      const codeMatches =
        safeHashEqual(
          providedHash,
          row.code_hash
        );

      if (
        !codeMatches ||
        !row.user_id
      ) {
        const attempts =
          row.attempts + 1;

        await client.query(
          `
          UPDATE password_reset_requests

          SET
            attempts = $2,
            updated_at = NOW()

          WHERE id = $1
          `,
          [
            challengeId,
            attempts,
          ]
        );

        return {
          ok: false as const,

          code:
            attempts >=
            RESET_MAX_ATTEMPTS
              ? "TOO_MANY_ATTEMPTS" as const
              : "INVALID_CODE" as const,

          status:
            attempts >=
            RESET_MAX_ATTEMPTS
              ? 429
              : 400,
        };
      }

      const user =
        await findCandidateByEmail(
          client,
          email
        );

      if (
        !user ||
        user.id !== row.user_id ||
        !row.password_fingerprint ||
        !safeHashEqual(
          row.password_fingerprint,
          getPasswordFingerprint(
            user.password_hash
          )
        )
      ) {
        return {
          ok: false as const,

          code:
            "INVALID_CODE" as const,

          status: 400,
        };
      }

      const resetToken =
        generateResetToken();

      const resetTokenHash =
        hashResetToken(
          resetToken
        );

      const expiresAt =
        new Date(
          Date.now() +
          RESET_TOKEN_DURATION_SECONDS *
            1000
        );

      /*
       * The code is now verified.
       *
       * It cannot generate another
       * reset authorization.
       */

      await client.query(
        `
        UPDATE password_reset_requests

        SET
          verified_at = NOW(),
          reset_token_hash = $2,
          reset_token_expires_at = $3,
          updated_at = NOW()

        WHERE id = $1
        `,
        [
          challengeId,

          resetTokenHash,

          expiresAt,
        ]
      );

      return {
        ok: true as const,

        resetToken,

        expiresAt,
      };
    });

  if (!result.ok) {
    throw new PasswordResetError(
      result.code,
      result.status
    );
  }

  return {
    success: true,

    challengeId,

    resetToken:
      result.resetToken,

    expiresAt:
      result.expiresAt,
  };
}

/* ============================================================
   16. PASSWORD RESET COOKIE

   This temporary token is separate
   from the authenticated session.

   API verify-reset-code must set
   this cookie as HttpOnly.

   Never expose the raw token in JSON.
   ============================================================ */

export function getResetCookieOptions() {
  return {
    httpOnly: true as const,

    secure:
      process.env.NODE_ENV ===
      "production",

    sameSite: "strict" as const,

    path:
      "/api/auth/reset-password",

    maxAge:
      RESET_TOKEN_DURATION_SECONDS,

    priority: "high" as const,
  };
}

export function getResetCookieClearOptions() {
  return {
    ...getResetCookieOptions(),

    maxAge: 0,

    expires: new Date(0),
  };
}

/* ============================================================
   17. RESET AUTHORIZATION VALIDATION
   ============================================================ */

function assertResetAuthorization(
  row: PasswordResetRow | undefined,
  providedTokenHash: string
): asserts row is PasswordResetRow {
  if (
    !row ||
    !row.user_id ||
    !row.verified_at ||
    row.consumed_at ||
    !row.reset_token_hash ||
    !row.reset_token_expires_at
  ) {
    throw new PasswordResetError(
      "INVALID_RESET_TOKEN",
      401
    );
  }

  if (
    row.reset_token_expires_at.getTime() <=
    Date.now()
  ) {
    throw new PasswordResetError(
      "RESET_TOKEN_EXPIRED",
      401
    );
  }

  if (
    !safeHashEqual(
      row.reset_token_hash,
      providedTokenHash
    )
  ) {
    throw new PasswordResetError(
      "INVALID_RESET_TOKEN",
      401
    );
  }
}

/* ============================================================
   18. COMPLETE PASSWORD RESET

   Atomic PostgreSQL transaction:

   1. Validate temporary reset token
   2. Lock the candidate account
   3. Check current account status
   4. Update password hash
   5. Revoke all old sessions
   6. Consume reset authorization
   7. Create new session

   If any database operation fails,
   all changes are rolled back.
   ============================================================ */

export async function resetCandidatePassword(
  input: CompletePasswordResetInput
): Promise<CompletePasswordResetResult> {
  const challengeId =
    validateChallengeId(
      input?.challengeId
    );

  const resetToken =
    validateResetToken(
      input?.resetToken
    );

  const password =
    validateNewPassword(
      input?.password,
      input?.confirmPassword
    );

  const providedTokenHash =
    hashResetToken(
      resetToken
    );

  /*
   * Validate the authorization before
   * running the expensive scrypt operation.
   */

  const db =
    getDatabasePool();

  const preliminary =
    await db.query<PasswordResetRow>(
      `
      SELECT *

      FROM password_reset_requests

      WHERE id = $1
      `,
      [challengeId]
    );

  assertResetAuthorization(
    preliminary.rows[0],
    providedTokenHash
  );

  /*
   * Hash the password outside the
   * transaction to reduce lock duration.
   */

  const passwordHash =
    await hashNewPassword(
      password
    );

  return withTransaction(
    async (client) => {
      const query =
        await client.query<PasswordResetRow>(
          `
          SELECT *

          FROM password_reset_requests

          WHERE id = $1

          FOR UPDATE
          `,
          [challengeId]
        );

      const row =
        query.rows[0];

      /*
       * Recheck authorization under lock.
       * Prevents two simultaneous requests
       * from consuming the same reset token.
       */

      assertResetAuthorization(
        row,
        providedTokenHash
      );

      const userResult =
        await client.query<ResetUserRow>(
          `
          SELECT
            id,
            first_name,
            last_name,
            full_name,
            email,
            password_hash,
            status,
            role,
            email_verified_at,
            phone_verified_at

          FROM users

          WHERE id = $1

          FOR UPDATE
          `,
          [row.user_id]
        );

      const user =
        userResult.rows[0];

      if (
        !user ||
        user.email !== row.email ||
        user.role !== "CANDIDATE" ||
        user.status !== "ACTIVE" ||
        !user.email_verified_at
      ) {
        throw new PasswordResetError(
          "RESET_NOT_AVAILABLE",
          403
        );
      }

      /*
       * Invalidate old recovery requests
       * if the password changed meanwhile.
       */

      if (
        !row.password_fingerprint ||
        !safeHashEqual(
          row.password_fingerprint,
          getPasswordFingerprint(
            user.password_hash
          )
        )
      ) {
        throw new PasswordResetError(
          "INVALID_RESET_TOKEN",
          401
        );
      }

      /* Update password */

      await client.query(
        `
        UPDATE users

        SET
          password_hash = $2,
          updated_at = NOW()

        WHERE id = $1
        `,
        [
          user.id,
          passwordHash,
        ]
      );

      /* Revoke every previous session */

      await client.query(
        `
        UPDATE user_sessions

        SET revoked_at = NOW()

        WHERE user_id = $1

          AND revoked_at IS NULL
        `,
        [user.id]
      );

      /* Consume the recovery authorization */

      await client.query(
        `
        UPDATE password_reset_requests

        SET
          consumed_at = NOW(),
          reset_token_hash = NULL,
          reset_token_expires_at = NULL,
          password_fingerprint = NULL,
          code_expires_at = NOW(),
          updated_at = NOW()

        WHERE id = $1
        `,
        [challengeId]
      );

      /* Create a new secure session */

      const sessionId =
        randomUUID();

      const {
        token,
        tokenHash,
        expiresAt,
      } =
        generateSessionToken();

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

          user.id,

          tokenHash,

          expiresAt,
        ]
      );

      return {
        success: true as const,

        redirectTo:
          "/dashboard" as const,

        user: {
          id: user.id,

          firstName:
            user.first_name,

          lastName:
            user.last_name,

          fullName:
            user.full_name,

          email:
            user.email,
        },

        session: {
          id: sessionId,

          token,

          expiresAt,

          cookieName:
            SESSION_COOKIE_NAME,

          cookieOptions:
            getSessionCookieOptions(),
        },
      };
    }
  );
}

/* ============================================================
   19. REMOVE OLD RESET REQUESTS

   Maintenance function.

   Keeps recent request records long
   enough to enforce the hourly limit.

   Can later be called by a secured
   maintenance job.

   Never expose as a public endpoint.
   ============================================================ */

export async function cleanupExpiredPasswordResets():
  Promise<number> {
  const db =
    getDatabasePool();

  const result =
    await db.query(
      `
      DELETE FROM password_reset_requests

      WHERE updated_at <
        NOW() - INTERVAL '24 hours'

        AND code_expires_at < NOW()

        AND (
          reset_token_expires_at IS NULL

          OR reset_token_expires_at < NOW()
        )
      `
    );

  return result.rowCount ?? 0;
}
