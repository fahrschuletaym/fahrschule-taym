
import { NextRequest, NextResponse } from "next/server";

import {
  createHmac,
  randomUUID,
} from "node:crypto";

import { isIP } from "node:net";

import {
  requestPasswordReset,
  PasswordResetError,
  RESET_RESEND_DELAY_SECONDS,
  type PasswordResetErrorCode,
  type RequestPasswordResetInput,
  type ResetLocale,
} from "@/lib/auth/password-reset";

/* ============================================================
   FAHRSCHULE TAYM

   AUTHENTICATION — FORGOT PASSWORD API

   File:
   src/app/api/auth/forgot-password/route.ts

   Endpoint:
   POST /api/auth/forgot-password

   Responsibilities:
   - Validate request origin
   - Validate email address
   - Validate selected language
   - Apply request rate limiting
   - Generate secure six-digit code
   - Store code hash in PostgreSQL
   - Send verification email through Resend
   - Handle resend requests
   - Return challenge identifier
   - Return code expiration
   - Prevent account enumeration

   Database:
   - users
   - password_reset_requests

   Email provider:
   - Resend

   Languages:
   - German
   - Arabic
   - Turkish
   - Spanish

   Compatible:
   - Desktop
   - Tablet
   - Mobile

   No additional layout.
   No additional navigation.
   ============================================================ */

/* ============================================================
   1. NEXT.JS CONFIGURATION
   ============================================================ */




/* ============================================================
   2. API CONFIGURATION
   ============================================================ */

const MAX_BODY_BYTES = 4096;

const MAX_EMAIL_LENGTH = 254;

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RATE_LIMIT_WINDOW_MS =
  15 * 60 * 1000;

const MAX_IP_REQUESTS = 20;

const MAX_GLOBAL_REQUESTS = 500;

const MAX_RATE_LIMIT_ENTRIES = 20_000;

/*
 * Additional response timing normalization.
 *
 * Reduces basic timing differences between
 * existing and unknown accounts.
 *
 * Does not completely eliminate timing
 * differences caused by the email provider.
 */

const MIN_RESPONSE_TIME_MS = 1200;

/* ============================================================
   3. API TYPES
   ============================================================ */

type ApiErrorCode =
  | PasswordResetErrorCode
  | "INVALID_JSON"
  | "FORBIDDEN_ORIGIN"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_ERROR";

type ApiErrorResponse = {
  success: false;

  error: {
    code: ApiErrorCode;
    message: string;
    retryAfter?: number;
  };

  timestamp: string;
};

type ApiSuccessResponse = {
  success: true;

  data: {
    challengeId: string;

    expiresAt: string;

    resendAfter: number;

    codeLength: 6;

    nextStep: "VERIFY_CODE";

    message: string;
  };

  timestamp: string;
};

type RateLimitEntry = {
  count: number;
  expiresAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfter: number;
};

/* ============================================================
   4. RESPONSE SECURITY HEADERS
   ============================================================ */

const RESPONSE_HEADERS: Record<string, string> = {
  "Cache-Control":
    "private, no-store, no-cache, max-age=0, must-revalidate",

  Pragma: "no-cache",

  Expires: "0",

  Vary: "Cookie, Origin",

  "X-Content-Type-Options": "nosniff",

  "X-Frame-Options": "DENY",

  "Referrer-Policy": "no-referrer",
};

/* ============================================================
   5. PUBLIC ERROR MESSAGES

   Error codes will be translated by
   the forgot-password page.

   Internal PostgreSQL and Resend
   errors are never exposed.
   ============================================================ */

const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  INVALID_INPUT:
    "Invalid request information.",

  INVALID_EMAIL:
    "Please enter a valid email address.",

  INVALID_CODE:
    "Invalid verification code.",

  CODE_EXPIRED:
    "The verification code has expired.",

  TOO_MANY_ATTEMPTS:
    "Too many requests. Please try again later.",

  INVALID_RESET_TOKEN:
    "Invalid password reset authorization.",

  RESET_TOKEN_EXPIRED:
    "Password reset authorization has expired.",

  PASSWORD_TOO_SHORT:
    "The password is too short.",

  PASSWORD_TOO_LONG:
    "The password is too long.",

  PASSWORD_MISMATCH:
    "The passwords do not match.",

  RESET_NOT_AVAILABLE:
    "Password reset is not available.",

  INVALID_JSON:
    "Invalid JSON request body.",

  FORBIDDEN_ORIGIN:
    "This request is not allowed.",

  UNSUPPORTED_MEDIA_TYPE:
    "Content-Type must be application/json.",

  PAYLOAD_TOO_LARGE:
    "The request body is too large.",

  SERVICE_UNAVAILABLE:
    "The service is temporarily unavailable.",

  INTERNAL_ERROR:
    "An unexpected error occurred.",
};

/* ============================================================
   6. GENERIC SUCCESS MESSAGES

   The response must not reveal whether
   the email address belongs to an
   existing candidate account.
   ============================================================ */

const SUCCESS_MESSAGES: Record<ResetLocale, string> = {
  de:
    "Wenn ein entsprechendes Konto vorhanden ist, erhalten Sie einen Bestätigungscode per E-Mail.",

  ar:
    "إذا كان هناك حساب مرتبط بهذا البريد الإلكتروني، فستتلقى رمز التحقق عبر البريد الإلكتروني.",

  tr:
    "Bu e-posta adresine bağlı bir hesap varsa, e-posta yoluyla bir doğrulama kodu alacaksınız.",

  es:
    "Si existe una cuenta asociada a este correo electrónico, recibirá un código de verificación.",
};

/* ============================================================
   7. REQUEST VALIDATION ERROR
   ============================================================ */

class RequestValidationError extends Error {
  readonly status: number;

  readonly code: ApiErrorCode;

  constructor(
    status: number,
    code: ApiErrorCode
  ) {
    super(ERROR_MESSAGES[code]);

    this.name = "RequestValidationError";

    this.status = status;

    this.code = code;
  }
}

/* ============================================================
   8. ERROR RESPONSE
   ============================================================ */

function errorResponse(
  status: number,
  code: ApiErrorCode,
  retryAfter?: number
): NextResponse<ApiErrorResponse> {
  const headers = new Headers(
    RESPONSE_HEADERS
  );

  const validRetryAfter =
    typeof retryAfter === "number" &&
    Number.isFinite(retryAfter) &&
    retryAfter > 0
      ? Math.ceil(retryAfter)
      : undefined;

  if (validRetryAfter !== undefined) {
    headers.set(
      "Retry-After",
      String(validRetryAfter)
    );
  }

  return NextResponse.json<ApiErrorResponse>(
    {
      success: false,

      error: {
        code,

        message: ERROR_MESSAGES[code],

        ...(validRetryAfter !== undefined
          ? {
              retryAfter: validRetryAfter,
            }
          : {}),
      },

      timestamp: new Date().toISOString(),
    },

    {
      status,
      headers,
    }
  );
}

/* ============================================================
   9. AUTHORIZED ORIGINS

   Development:
   http://localhost:3000

   Production:
   https://fahrschule-taym.de

   Uses NEXT_PUBLIC_APP_URL
   from the existing environment.
   ============================================================ */

function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>();

  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL;

  if (configuredUrl) {
    try {
      const url = new URL(
        configuredUrl
      );

      if (
        process.env.NODE_ENV === "production" &&
        url.protocol !== "https:"
      ) {
        throw new Error(
          "Production HTTPS is required."
        );
      }

      origins.add(url.origin);

    } catch {
      throw new PasswordResetError(
        "SERVICE_UNAVAILABLE",
        503
      );
    }

  } else if (
    process.env.NODE_ENV === "production"
  ) {
    throw new PasswordResetError(
      "SERVICE_UNAVAILABLE",
      503
    );
  }

  if (
    process.env.NODE_ENV !== "production"
  ) {
    origins.add(
      "http://localhost:3000"
    );

    origins.add(
      "http://127.0.0.1:3000"
    );
  }

  return origins;
}

/* ============================================================
   10. REQUEST ORIGIN VALIDATION
   ============================================================ */

function assertAllowedOrigin(
  request: NextRequest
): void {
  const origin =
    request.headers.get("origin");

  const fetchSite =
    request.headers.get("sec-fetch-site");

  if (
    fetchSite === "cross-site" ||
    !origin ||
    origin === "null"
  ) {
    throw new RequestValidationError(
      403,
      "FORBIDDEN_ORIGIN"
    );
  }

  let normalizedOrigin: string;

  try {
    normalizedOrigin =
      new URL(origin).origin;

  } catch {
    throw new RequestValidationError(
      403,
      "FORBIDDEN_ORIGIN"
    );
  }

  const allowedOrigins =
    getAllowedOrigins();

  if (
    !allowedOrigins.has(
      normalizedOrigin
    )
  ) {
    throw new RequestValidationError(
      403,
      "FORBIDDEN_ORIGIN"
    );
  }
}

/* ============================================================
   11. CLIENT IP ADDRESS

   Forwarded headers must only be trusted
   behind a configured reverse proxy.

   The proxy must remove or overwrite
   client-supplied forwarding headers.
   ============================================================ */

function getClientIp(
  request: NextRequest
): string | null {
  if (
    process.env.TRUST_PROXY_HEADERS !== "true"
  ) {
    return null;
  }

  const forwardedFor =
    request.headers.get(
      "x-forwarded-for"
    );

  const realIp =
    request.headers.get(
      "x-real-ip"
    );

  const candidateIp =
    forwardedFor
      ?.split(",")[0]
      ?.trim() ||
    realIp?.trim();

  if (
    !candidateIp ||
    candidateIp.length > 64 ||
    isIP(candidateIp) === 0
  ) {
    return null;
  }

  return candidateIp;
}

/* ============================================================
   12. RATE LIMIT STORE

   Additional process-level protection.

   Persistent per-email protection remains
   managed by password-reset.ts in PostgreSQL.

   For distributed production deployments,
   use a shared gateway or Redis limiter.
   ============================================================ */

const globalForForgotPassword =
  globalThis as typeof globalThis & {
    taymForgotPasswordLimits?: Map<
      string,
      RateLimitEntry
    >;
  };

const rateLimitStore =
  globalForForgotPassword
    .taymForgotPasswordLimits ??
  new Map<string, RateLimitEntry>();

globalForForgotPassword
  .taymForgotPasswordLimits =
  rateLimitStore;

/* ============================================================
   13. PROTECTED RATE LIMIT KEYS

   Avoid storing raw IP addresses
   inside the rate-limit map.
   ============================================================ */

function hashRateLimitKey(
  value: string
): string {
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

  return createHmac(
    "sha256",
    secret
  )
    .update(
      `forgot-password:rate-limit:${value}`,
      "utf8"
    )
    .digest("hex");
}

/* ============================================================
   14. RATE LIMIT CLEANUP
   ============================================================ */

function cleanupRateLimits(
  now: number
): void {
  for (
    const [key, entry]
    of rateLimitStore.entries()
  ) {
    if (entry.expiresAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

/* ============================================================
   15. CONSUME RATE LIMIT

   Fixed window rate limiting.
   ============================================================ */

function consumeRateLimit(
  key: string,
  maxRequests: number
): RateLimitResult {
  const now = Date.now();

  const existing =
    rateLimitStore.get(key);

  if (
    existing &&
    existing.expiresAt > now
  ) {
    if (
      existing.count >= maxRequests
    ) {
      return {
        allowed: false,

        retryAfter: Math.max(
          1,

          Math.ceil(
            (existing.expiresAt - now) /
              1000
          )
        ),
      };
    }

    existing.count += 1;

    return {
      allowed: true,
      retryAfter: 0,
    };
  }

  if (
    rateLimitStore.size >=
    MAX_RATE_LIMIT_ENTRIES
  ) {
    cleanupRateLimits(now);

    if (
      rateLimitStore.size >=
      MAX_RATE_LIMIT_ENTRIES
    ) {
      return {
        allowed: false,
        retryAfter: 60,
      };
    }
  }

  rateLimitStore.set(key, {
    count: 1,

    expiresAt:
      now + RATE_LIMIT_WINDOW_MS,
  });

  return {
    allowed: true,
    retryAfter: 0,
  };
}

/* ============================================================
   16. SECURE JSON BODY READING

   Rejects oversized request bodies,
   even if Content-Length is missing.
   ============================================================ */

async function readJsonBody(
  request: NextRequest
): Promise<unknown> {
  const contentType =
    request.headers
      .get("content-type")
      ?.split(";")[0]
      ?.trim()
      .toLowerCase();

  if (
    contentType !== "application/json"
  ) {
    throw new RequestValidationError(
      415,
      "UNSUPPORTED_MEDIA_TYPE"
    );
  }

  const contentLength =
    request.headers.get(
      "content-length"
    );

  if (contentLength !== null) {
    const length =
      Number(contentLength);

    if (
      !Number.isSafeInteger(length) ||
      length < 0
    ) {
      throw new RequestValidationError(
        400,
        "INVALID_INPUT"
      );
    }

    if (
      length > MAX_BODY_BYTES
    ) {
      throw new RequestValidationError(
        413,
        "PAYLOAD_TOO_LARGE"
      );
    }
  }

  if (!request.body) {
    throw new RequestValidationError(
      400,
      "INVALID_JSON"
    );
  }

  const reader =
    request.body.getReader();

  const chunks: Uint8Array[] = [];

  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } =
        await reader.read();

      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      totalBytes += value.byteLength;

      if (
        totalBytes > MAX_BODY_BYTES
      ) {
        try {
          await reader.cancel();

        } catch {
          // Request already rejected.
        }

        throw new RequestValidationError(
          413,
          "PAYLOAD_TOO_LARGE"
        );
      }

      chunks.push(value);
    }

  } finally {
    reader.releaseLock();
  }

  try {
    const buffer = Buffer.concat(
      chunks.map(
        (chunk) => Buffer.from(chunk)
      )
    );

    const text = new TextDecoder(
      "utf-8",
      {
        fatal: true,
      }
    ).decode(buffer);

    return JSON.parse(text);

  } catch {
    throw new RequestValidationError(
      400,
      "INVALID_JSON"
    );
  }
}

/* ============================================================
   17. EMAIL NORMALIZATION
   ============================================================ */

function normalizeEmail(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new RequestValidationError(
      400,
      "INVALID_EMAIL"
    );
  }

  const email = value
    .trim()
    .toLowerCase();

  if (
    email.length === 0 ||
    email.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(email)
  ) {
    throw new RequestValidationError(
      400,
      "INVALID_EMAIL"
    );
  }

  return email;
}

/* ============================================================
   18. LANGUAGE NORMALIZATION

   German is the default language.
   ============================================================ */

function normalizeLocale(
  value: unknown
): ResetLocale {
  if (typeof value !== "string") {
    return "de";
  }

  const locale = value
    .trim()
    .toLowerCase()
    .split("-")[0];

  switch (locale) {
    case "de":
    case "ar":
    case "tr":
    case "es":
      return locale;

    default:
      return "de";
  }
}

/* ============================================================
   19. REQUEST BODY VALIDATION

   Expected JSON:

   {
     "email": "candidate@example.com",
     "locale": "de"
   }

   The same endpoint is used to send
   the initial code and resend it.
   ============================================================ */

function validateRequestBody(
  body: unknown
): RequestPasswordResetInput & {
  locale: ResetLocale;
} {
  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    throw new RequestValidationError(
      400,
      "INVALID_INPUT"
    );
  }

  const data =
    body as Record<string, unknown>;

  return {
    email:
      normalizeEmail(data.email),

    locale:
      normalizeLocale(data.locale),
  };
}

/* ============================================================
   20. RESPONSE TIMING NORMALIZATION

   Additional mitigation against
   simple account-enumeration attempts.

   This does not guarantee identical
   response times for all accounts.
   ============================================================ */

async function normalizeResponseTime(
  startedAt: number
): Promise<void> {
  const elapsed =
    Date.now() - startedAt;

  const remaining =
    MIN_RESPONSE_TIME_MS - elapsed;

  if (remaining > 0) {
    await new Promise<void>(
      (resolve) => {
        setTimeout(
          resolve,
          remaining
        );
      }
    );
  }
}

/* ============================================================
   21. DATABASE CONNECTION ERRORS
   ============================================================ */

const DATABASE_CONNECTION_ERRORS =
  new Set([
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "EAI_AGAIN",
    "08000",
    "08001",
    "08003",
    "08004",
    "08006",
    "08007",
    "57P01",
    "57P02",
    "57P03",
    "53300",
    "55P03",
    "57014",
    "40001",
    "40P01",
  ]);

function isDatabaseUnavailable(
  error: unknown
): boolean {
  if (
    error === null ||
    typeof error !== "object" ||
    !("code" in error)
  ) {
    return false;
  }

  const code =
    (error as { code?: unknown }).code;

  return (
    typeof code === "string" &&

    DATABASE_CONNECTION_ERRORS.has(
      code
    )
  );
}

/* ============================================================
   22. CENTRALIZED ERROR HANDLING

   Never logs:
   - Email address
   - Verification code
   - Reset token
   - Password
   - Resend API key
   - Database credentials
   ============================================================ */

function handleForgotPasswordError(
  error: unknown,
  requestId: string
): NextResponse<ApiErrorResponse> {
  /* --------------------------------------------------------
     Request validation errors
     -------------------------------------------------------- */

  if (
    error instanceof RequestValidationError
  ) {
    return errorResponse(
      error.status,
      error.code
    );
  }

  /* --------------------------------------------------------
     Password reset service errors
     -------------------------------------------------------- */

  if (
    error instanceof PasswordResetError
  ) {
    switch (error.code) {
      case "INVALID_EMAIL":

        return errorResponse(
          400,
          "INVALID_EMAIL"
        );

      case "INVALID_INPUT":

        return errorResponse(
          400,
          "INVALID_INPUT"
        );

      case "TOO_MANY_ATTEMPTS":

        return errorResponse(
          429,
          "TOO_MANY_ATTEMPTS",
          error.retryAfter ??
            RESET_RESEND_DELAY_SECONDS
        );

      case "SERVICE_UNAVAILABLE":

        console.error(
          "[TAYM][FORGOT_PASSWORD][SERVICE]",

          {
            requestId,

            code: "SERVICE_UNAVAILABLE",
          }
        );

        return errorResponse(
          503,
          "SERVICE_UNAVAILABLE"
        );

      default:

        /*
         * Unexpected account-specific errors
         * must not expose account information.
         */

        console.error(
          "[TAYM][FORGOT_PASSWORD][SERVICE_ERROR]",

          {
            requestId,

            type: error.name,
          }
        );

        return errorResponse(
          500,
          "INTERNAL_ERROR"
        );
    }
  }

  /* --------------------------------------------------------
     PostgreSQL unavailable
     -------------------------------------------------------- */

  if (isDatabaseUnavailable(error)) {
    console.error(
      "[TAYM][FORGOT_PASSWORD][DATABASE]",

      {
        requestId,

        message:
          "Database temporarily unavailable.",
      }
    );

    return errorResponse(
      503,
      "SERVICE_UNAVAILABLE"
    );
  }

  /* --------------------------------------------------------
     Unexpected technical error
     -------------------------------------------------------- */

  console.error(
    "[TAYM][FORGOT_PASSWORD][ERROR]",

    {
      requestId,

      type:
        error instanceof Error
          ? error.name
          : "UnknownError",
    }
  );

  return errorResponse(
    500,
    "INTERNAL_ERROR"
  );
}

/* ============================================================
   23. POST /api/auth/forgot-password

   Execution order:

   1. Validate request origin
   2. Apply global rate limit
   3. Apply trusted IP rate limit
   4. Read request body
   5. Validate email and language
   6. Request password reset
   7. Generate random six-digit code
   8. Store protected challenge in PostgreSQL
   9. Send email through Resend
   10. Return challenge information

   Code generation, storage and email
   delivery are handled by the existing
   password-reset.ts service.

   No authentication session is created
   during this first step.
   ============================================================ */

export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  const requestId =
    randomUUID();

  const startedAt =
    Date.now();

  try {
    /* --------------------------------------------------------
       STEP 1 — VALIDATE REQUEST ORIGIN
       -------------------------------------------------------- */

    assertAllowedOrigin(request);

    /* --------------------------------------------------------
       STEP 2 — GLOBAL RATE LIMIT

       Protects this Node.js instance
       against excessive reset requests,
       including requests for random emails.
       -------------------------------------------------------- */

    const globalLimit =
      consumeRateLimit(
        "forgot-password:global",

        MAX_GLOBAL_REQUESTS
      );

    if (!globalLimit.allowed) {
      return errorResponse(
        429,

        "TOO_MANY_ATTEMPTS",

        globalLimit.retryAfter
      );
    }

    /* --------------------------------------------------------
       STEP 3 — TRUSTED IP RATE LIMIT
       -------------------------------------------------------- */

    const clientIp =
      getClientIp(request);

    if (clientIp) {
      const ipKey =
        `ip:${hashRateLimitKey(clientIp)}`;

      const ipLimit =
        consumeRateLimit(
          ipKey,

          MAX_IP_REQUESTS
        );

      if (!ipLimit.allowed) {
        return errorResponse(
          429,

          "TOO_MANY_ATTEMPTS",

          ipLimit.retryAfter
        );
      }
    }

    /* --------------------------------------------------------
       STEP 4 — READ REQUEST BODY
       -------------------------------------------------------- */

    const body =
      await readJsonBody(request);

    /* --------------------------------------------------------
       STEP 5 — VALIDATE EMAIL AND LANGUAGE
       -------------------------------------------------------- */

    const input =
      validateRequestBody(body);

    /* --------------------------------------------------------
       STEP 6 — REAL PASSWORD RESET REQUEST

       The existing service handles:

       - Candidate lookup
       - Active account verification
       - Email verification status
       - Persistent email rate limiting
       - 60-second resend cooldown
       - Secure random six-digit code
       - HMAC-SHA256 code protection
       - PostgreSQL challenge storage
       - Ten-minute code expiration
       - Resend email delivery

       Unknown emails receive an equivalent
       generic response without email delivery.
       -------------------------------------------------------- */

    const result =
      await requestPasswordReset(
        input
      );

    /* --------------------------------------------------------
       STEP 7 — RESPONSE TIMING

       Reduce basic timing differences.
       -------------------------------------------------------- */

    await normalizeResponseTime(
      startedAt
    );

    /* --------------------------------------------------------
       STEP 8 — SAFE JSON RESPONSE

       Never return:
       - Generated verification code
       - Verification code hash
       - Candidate identifier
       - Account existence
       - Resend API credentials

       A successful response indicates
       that the request was processed.

       It does not guarantee that the
       email was delivered to the inbox.
       -------------------------------------------------------- */

    return NextResponse.json<ApiSuccessResponse>(
      {
        success: true,

        data: {
          challengeId:
            result.challengeId,

          expiresAt:
            result.expiresAt,

          resendAfter:
            result.resendAfter,

          codeLength: 6,

          nextStep: "VERIFY_CODE",

          message:
            SUCCESS_MESSAGES[input.locale],
        },

        timestamp:
          new Date().toISOString(),
      },

      {
        status: 200,

        headers: RESPONSE_HEADERS,
      }
    );

  } catch (error: unknown) {
    return handleForgotPasswordError(
      error,

      requestId
    );
  }
}
