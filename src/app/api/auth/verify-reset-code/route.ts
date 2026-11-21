
import { NextRequest, NextResponse } from "next/server";

import { randomUUID } from "node:crypto";

import {
  verifyPasswordResetCode,
  PasswordResetError,
  getResetCookieOptions,
  RESET_COOKIE_NAME,
  type VerifyResetCodeInput,
  type PasswordResetErrorCode,
} from "@/lib/auth/password-reset";

/* ============================================================
   FAHRSCHULE TAYM

   AUTHENTICATION — VERIFY RESET CODE API

   File:
   src/app/api/auth/verify-reset-code/route.ts

   Endpoint:
   POST /api/auth/verify-reset-code

   Responsibilities:
   - Validate request origin
   - Validate email address
   - Validate challenge identifier
   - Validate six-digit verification code
   - Check PostgreSQL reset request
   - Check code expiration
   - Enforce maximum verification attempts
   - Generate temporary reset authorization
   - Set secure HttpOnly reset cookie
   - Authorize the new password step

   Database:
   - users
   - password_reset_requests

   Email provider:
   - Resend

   Supported languages:
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
   No fictional verification.
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CODE_PATTERN = /^\d{6}$/;

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

    verified: true;

    canResetPassword: true;

    expiresAt: string;

    nextStep: "NEW_PASSWORD";
  };

  timestamp: string;
};

/* ============================================================
   4. RESPONSE SECURITY HEADERS

   Password recovery responses must never
   be stored by browser, proxy or CDN caches.
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

   The frontend translates the error codes
   into the four supported languages.

   No internal PostgreSQL error is exposed.
   ============================================================ */

const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  INVALID_INPUT:
    "Invalid request information.",

  INVALID_EMAIL:
    "Invalid email address.",

  INVALID_CODE:
    "The verification code is invalid.",

  CODE_EXPIRED:
    "The verification code has expired.",

  TOO_MANY_ATTEMPTS:
    "Too many verification attempts. Please request a new code when available.",

  INVALID_RESET_TOKEN:
    "Password reset authorization is invalid.",

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
   6. REQUEST VALIDATION ERROR
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
   7. ERROR RESPONSE
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

      timestamp:
        new Date().toISOString(),
    },

    {
      status,

      headers,
    }
  );
}

/* ============================================================
   8. AUTHORIZED ORIGINS

   Development:
   http://localhost:3000

   Production:
   https://fahrschule-taym.de

   Uses NEXT_PUBLIC_APP_URL from .env.local.
   ============================================================ */

function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>();
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    origins.add("https://fahrschule-taym.de");
  } else {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }

  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (configuredUrl) {
    try {
      const url = new URL(configuredUrl);
      if (!isProduction || url.protocol === "https:") origins.add(url.origin);
    } catch {
      console.error("[TAYM][AUTH] Invalid NEXT_PUBLIC_APP_URL");
    }
  }

  return origins;
}

/* ============================================================
   9. VALIDATE REQUEST ORIGIN

   Prevents requests initiated by
   unauthorized external websites.

   Arbitrary Host headers are not trusted.
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
   10. SECURE JSON BODY READING

   Rejects oversized request bodies,
   including requests without Content-Length.
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
    request.headers.get("content-length");

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

    if (length > MAX_BODY_BYTES) {
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
          // The request is already rejected.
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
   11. EMAIL NORMALIZATION
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
   12. CHALLENGE ID VALIDATION

   The challenge ID identifies the actual
   reset request created by PostgreSQL.

   It does not authorize a password change
   on its own.
   ============================================================ */

function validateChallengeId(
  value: unknown
): string {
  if (
    typeof value !== "string" ||
    !UUID_PATTERN.test(value)
  ) {
    throw new RequestValidationError(
      400,

      "INVALID_INPUT"
    );
  }

  return value.toLowerCase();
}

/* ============================================================
   13. VERIFICATION CODE NORMALIZATION

   Supports:
   - Standard numeric digits
   - Arabic numeric digits
   - Persian numeric digits
   - Code copied directly from email
   - Spaces and visual separators

   The code remains a string to preserve
   leading zeros.
   ============================================================ */

function normalizeVerificationCode(
  value: unknown
): string {
  if (typeof value !== "string") {
    throw new RequestValidationError(
      400,

      "INVALID_CODE"
    );
  }

  if (value.length > 64) {
    throw new RequestValidationError(
      400,

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

  if (!CODE_PATTERN.test(code)) {
    throw new RequestValidationError(
      400,

      "INVALID_CODE"
    );
  }

  return code;
}

/* ============================================================
   14. REQUEST BODY VALIDATION

   Expected JSON:

   {
     "email": "...",
     "challengeId": "...",
     "code": "012345"
   }

   Never accepts a userId, password
   or reset authorization from the client.
   ============================================================ */

function validateRequestBody(
  body: unknown
): VerifyResetCodeInput {
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

    challengeId:
      validateChallengeId(
        data.challengeId
      ),

    code:
      normalizeVerificationCode(
        data.code
      ),
  };
}

/* ============================================================
   15. POSTGRESQL CONNECTION ERRORS
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
    DATABASE_CONNECTION_ERRORS.has(code)
  );
}

/* ============================================================
   16. CENTRALIZED ERROR HANDLING

   Never logs:
   - Verification code
   - Reset token
   - Email address
   - Password
   - Database credentials
   ============================================================ */

function handleVerificationError(
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
      case "INVALID_CODE":

        return errorResponse(
          400,

          "INVALID_CODE"
        );

      case "CODE_EXPIRED":

        return errorResponse(
          400,

          "CODE_EXPIRED"
        );

      case "TOO_MANY_ATTEMPTS":

        return errorResponse(
          429,

          "TOO_MANY_ATTEMPTS",

          error.retryAfter
        );

      case "INVALID_EMAIL":

        return errorResponse(
          400,

          "INVALID_EMAIL"
        );

      case "RESET_NOT_AVAILABLE":

        return errorResponse(
          400,

          "INVALID_CODE"
        );

      case "SERVICE_UNAVAILABLE":

        console.error(
          "[TAYM][VERIFY_RESET_CODE][SERVICE]",

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

        return errorResponse(
          error.status,

          error.code,

          error.retryAfter
        );
    }
  }

  /* --------------------------------------------------------
     PostgreSQL unavailable
     -------------------------------------------------------- */

  if (isDatabaseUnavailable(error)) {
    console.error(
      "[TAYM][VERIFY_RESET_CODE][DATABASE]",

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
     Unexpected server error
     -------------------------------------------------------- */

  console.error(
    "[TAYM][VERIFY_RESET_CODE][ERROR]",

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
   17. POST /api/auth/verify-reset-code

   Execution order:

   1. Validate request origin
   2. Read JSON request
   3. Validate email, challenge and code
   4. Verify code in PostgreSQL
   5. Check expiration and attempts
   6. Consume the verification code
   7. Generate temporary reset token
   8. Set HttpOnly reset cookie
   9. Authorize the new password step

   IMPORTANT:

   Verification does not authenticate
   the candidate yet.

   The candidate becomes authenticated
   only after successful password reset.
   ============================================================ */

export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  const requestId =
    randomUUID();

  try {
    /* --------------------------------------------------------
       STEP 1 — VALIDATE REQUEST ORIGIN
       -------------------------------------------------------- */

    assertAllowedOrigin(request);

    /* --------------------------------------------------------
       STEP 2 — READ REQUEST BODY
       -------------------------------------------------------- */

    const body =
      await readJsonBody(request);

    /* --------------------------------------------------------
       STEP 3 — VALIDATE INPUT
       -------------------------------------------------------- */

    const input =
      validateRequestBody(body);

    /* --------------------------------------------------------
       STEP 4 — VERIFY REAL CODE

       The existing password-reset service
       checks PostgreSQL for:

       - Challenge ID
       - Correct email address
       - Existing candidate
       - Active account
       - Verification code hash
       - Code expiration
       - Failed verification attempts
       - Previous code consumption
       - Current password fingerprint

       Failed attempts are persisted
       in PostgreSQL.

       No fake verification.
       -------------------------------------------------------- */

    const result =
      await verifyPasswordResetCode(
        input
      );

    /* --------------------------------------------------------
       STEP 5 — BUILD SAFE RESPONSE

       The raw reset token is never
       returned in the JSON response.

       The client receives only the
       information needed to open
       the new password form.
       -------------------------------------------------------- */

    const response =
      NextResponse.json<ApiSuccessResponse>(
        {
          success: true,

          data: {
            challengeId:
              result.challengeId,

            verified: true,

            canResetPassword: true,

            expiresAt:
              result.expiresAt.toISOString(),

            nextStep: "NEW_PASSWORD",
          },

          timestamp:
            new Date().toISOString(),
        },

        {
          status: 200,

          headers: RESPONSE_HEADERS,
        }
      );

    /* --------------------------------------------------------
       STEP 6 — TEMPORARY RESET COOKIE

       Cookie name:
       taym_password_reset

       HttpOnly: true
       Secure: true in production
       SameSite: strict
       Validity: 10 minutes

       Restricted to:
       /api/auth/reset-password

       This cookie does not grant access
       to the candidate Dashboard.
       -------------------------------------------------------- */

    response.cookies.set(
      RESET_COOKIE_NAME,

      result.resetToken,

      {
        ...getResetCookieOptions(),

        expires: result.expiresAt,
      }
    );

    /* --------------------------------------------------------
       STEP 7 — RETURN SUCCESS

       The frontend can now display:
       - New password
       - Confirm new password
       - Save button
       -------------------------------------------------------- */

    return response;

  } catch (error: unknown) {
    return handleVerificationError(
      error,

      requestId
    );
  }
}
