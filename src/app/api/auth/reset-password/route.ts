
import { NextRequest, NextResponse } from "next/server";

import { randomUUID } from "node:crypto";

import {
  resetCandidatePassword,
  PasswordResetError,
  getResetCookieClearOptions,
  RESET_COOKIE_NAME,
  PASSWORD_MIN_LENGTH,
  type CompletePasswordResetInput,
} from "@/lib/auth/password-reset";

/* ============================================================
   FAHRSCHULE TAYM

   AUTHENTICATION — RESET PASSWORD API

   File:
   src/app/api/auth/reset-password/route.ts

   Endpoint:
   POST /api/auth/reset-password

   Responsibilities:
   - Validate request origin
   - Validate request body
   - Read temporary HttpOnly reset cookie
   - Validate verified reset challenge
   - Validate new password and confirmation
   - Update password in PostgreSQL
   - Revoke all previous sessions
   - Consume temporary reset authorization
   - Create new authenticated session
   - Remove temporary reset cookie
   - Redirect candidate to dashboard

   Database:
   - users
   - user_sessions
   - password_reset_requests

   Compatible:
   - Desktop
   - Tablet
   - Mobile

   Languages:
   - German
   - Arabic
   - Turkish
   - Spanish

   No additional layout.
   No additional navigation.
   ============================================================ */

/* ============================================================
   1. NEXT.JS CONFIGURATION
   ============================================================ */




/* ============================================================
   2. API CONFIGURATION
   ============================================================ */

const MAX_BODY_BYTES = 16_384;

const MAX_PASSWORD_BYTES = 1024;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const RESET_TOKEN_PATTERN =
  /^[A-Za-z0-9_-]{43}$/;

/* ============================================================
   3. API TYPES
   ============================================================ */

type ResetPasswordBody = {
  challengeId: string;
  password: string;
  confirmPassword: string;
};

type ApiErrorCode =
  | "INVALID_INPUT"
  | "INVALID_JSON"
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
  | "FORBIDDEN_ORIGIN"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "SERVICE_UNAVAILABLE"
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
    passwordUpdated: true;

    user: {
      id: string;
      firstName: string;
      lastName: string;
      fullName: string;
      email: string;
    };

    session: {
      authenticated: true;
      expiresAt: string;
    };

    redirectTo: "/dashboard";
  };

  timestamp: string;
};

/* ============================================================
   4. RESPONSE HEADERS

   Authentication responses must never
   be stored in browser, proxy or CDN caches.
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
   5. REQUEST VALIDATION ERROR
   ============================================================ */

class RequestValidationError extends Error {
  readonly status: number;

  readonly code: ApiErrorCode;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string
  ) {
    super(message);

    this.name = "RequestValidationError";

    this.status = status;

    this.code = code;
  }
}

/* ============================================================
   6. PUBLIC ERROR MESSAGES

   The frontend will translate these
   error codes into DE, AR, TR and ES.

   Internal SQL errors are never exposed.
   ============================================================ */

const ERROR_MESSAGES: Record<
  ApiErrorCode,
  string
> = {
  INVALID_INPUT:
    "Invalid request information.",

  INVALID_JSON:
    "Invalid JSON request body.",

  INVALID_EMAIL:
    "Invalid email address.",

  INVALID_CODE:
    "Invalid verification code.",

  CODE_EXPIRED:
    "The verification code has expired.",

  TOO_MANY_ATTEMPTS:
    "Too many attempts. Please try again later.",

  INVALID_RESET_TOKEN:
    "Password reset authorization is invalid.",

  RESET_TOKEN_EXPIRED:
    "Password reset authorization has expired.",

  PASSWORD_TOO_SHORT:
    `The password must contain at least ${PASSWORD_MIN_LENGTH} characters.`,

  PASSWORD_TOO_LONG:
    "The password is too long.",

  PASSWORD_MISMATCH:
    "The passwords do not match.",

  RESET_NOT_AVAILABLE:
    "Password reset is not available.",

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
   7. ERROR RESPONSE
   ============================================================ */

function errorResponse(
  status: number,
  code: ApiErrorCode,
  options?: {
    retryAfter?: number;
    clearResetCookie?: boolean;
  }
): NextResponse<ApiErrorResponse> {
  const headers = new Headers(
    RESPONSE_HEADERS
  );

  const retryAfter =
    options?.retryAfter;

  if (
    typeof retryAfter === "number" &&
    Number.isFinite(retryAfter) &&
    retryAfter > 0
  ) {
    headers.set(
      "Retry-After",
      String(Math.ceil(retryAfter))
    );
  }

  const response = NextResponse.json<ApiErrorResponse>(
    {
      success: false,

      error: {
        code,

        message:
          ERROR_MESSAGES[code],

        ...(typeof retryAfter === "number"
          ? {
              retryAfter:
                Math.max(
                  0,
                  Math.ceil(retryAfter)
                ),
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

  /*
   * Clear invalid or expired temporary
   * password recovery authorization.
   */

  if (options?.clearResetCookie) {
    response.cookies.set(
      RESET_COOKIE_NAME,

      "",

      getResetCookieClearOptions()
    );
  }

  return response;
}

/* ============================================================
   8. AUTHORIZED ORIGINS

   Development:
   http://localhost:3000

   Production:
   https://fahrschule-taym.de

   Uses the existing NEXT_PUBLIC_APP_URL
   environment variable.
   ============================================================ */

function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>();

  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL;

  if (configuredUrl) {
    try {
      const url =
        new URL(configuredUrl);

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
   9. REQUEST ORIGIN VALIDATION

   Prevents cross-site requests from
   modifying the candidate's password.

   Does not trust arbitrary Host headers.
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
      "FORBIDDEN_ORIGIN",
      ERROR_MESSAGES.FORBIDDEN_ORIGIN
    );
  }

  let normalizedOrigin: string;

  try {
    normalizedOrigin =
      new URL(origin).origin;
  } catch {
    throw new RequestValidationError(
      403,
      "FORBIDDEN_ORIGIN",
      ERROR_MESSAGES.FORBIDDEN_ORIGIN
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
      "FORBIDDEN_ORIGIN",
      ERROR_MESSAGES.FORBIDDEN_ORIGIN
    );
  }
}

/* ============================================================
   10. READ TEMPORARY RESET COOKIE

   The reset token is never accepted
   from a query parameter or JSON body.

   It must come from the HttpOnly cookie
   created by verify-reset-code/route.ts.
   ============================================================ */

function getResetTokenFromCookie(
  request: NextRequest
): string {
  const resetToken =
    request.cookies.get(
      RESET_COOKIE_NAME
    )?.value;

  if (
    !resetToken ||
    !RESET_TOKEN_PATTERN.test(
      resetToken
    )
  ) {
    throw new PasswordResetError(
      "INVALID_RESET_TOKEN",
      401
    );
  }

  return resetToken;
}

/* ============================================================
   11. SECURE JSON BODY READING

   Maximum request size is checked
   even when Content-Length is missing.

   Prevents oversized request bodies.
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

      "UNSUPPORTED_MEDIA_TYPE",

      ERROR_MESSAGES.UNSUPPORTED_MEDIA_TYPE
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

        "INVALID_INPUT",

        ERROR_MESSAGES.INVALID_INPUT
      );
    }

    if (length > MAX_BODY_BYTES) {
      throw new RequestValidationError(
        413,

        "PAYLOAD_TOO_LARGE",

        ERROR_MESSAGES.PAYLOAD_TOO_LARGE
      );
    }
  }

  if (!request.body) {
    throw new RequestValidationError(
      400,

      "INVALID_JSON",

      ERROR_MESSAGES.INVALID_JSON
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

          "PAYLOAD_TOO_LARGE",

          ERROR_MESSAGES.PAYLOAD_TOO_LARGE
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

      "INVALID_JSON",

      ERROR_MESSAGES.INVALID_JSON
    );
  }
}

/* ============================================================
   12. VALIDATE RESET REQUEST

   Expected body:

   {
     "challengeId": "...",
     "password": "...",
     "confirmPassword": "..."
   }

   No userId.
   No email-based authorization.
   No reset token in the JSON body.

   Passwords are never trimmed.
   ============================================================ */

function validateResetBody(
  body: unknown
): ResetPasswordBody {
  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    throw new RequestValidationError(
      400,

      "INVALID_INPUT",

      ERROR_MESSAGES.INVALID_INPUT
    );
  }

  const data =
    body as Record<string, unknown>;

  /* Validate challenge ID */

  if (
    typeof data.challengeId !== "string" ||
    !UUID_PATTERN.test(
      data.challengeId
    )
  ) {
    throw new RequestValidationError(
      400,

      "INVALID_INPUT",

      ERROR_MESSAGES.INVALID_INPUT
    );
  }

  /* Validate password fields */

  if (
    typeof data.password !== "string" ||
    typeof data.confirmPassword !== "string"
  ) {
    throw new RequestValidationError(
      400,

      "INVALID_INPUT",

      ERROR_MESSAGES.INVALID_INPUT
    );
  }

  const password =
    data.password;

  const confirmPassword =
    data.confirmPassword;

  /* Maximum byte length */

  if (
    Buffer.byteLength(
      password,
      "utf8"
    ) > MAX_PASSWORD_BYTES ||

    Buffer.byteLength(
      confirmPassword,
      "utf8"
    ) > MAX_PASSWORD_BYTES
  ) {
    throw new RequestValidationError(
      400,

      "PASSWORD_TOO_LONG",

      ERROR_MESSAGES.PASSWORD_TOO_LONG
    );
  }

  /* Minimum password length */

  if (
    Array.from(password).length <
    PASSWORD_MIN_LENGTH
  ) {
    throw new RequestValidationError(
      400,

      "PASSWORD_TOO_SHORT",

      ERROR_MESSAGES.PASSWORD_TOO_SHORT
    );
  }

  /* Password confirmation */

  if (
    password !== confirmPassword
  ) {
    throw new RequestValidationError(
      400,

      "PASSWORD_MISMATCH",

      ERROR_MESSAGES.PASSWORD_MISMATCH
    );
  }

  return {
    challengeId:
      data.challengeId,

    password,

    confirmPassword,
  };
}

/* ============================================================
   13. DATABASE CONNECTION ERRORS
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
   14. CENTRALIZED ERROR HANDLING

   Never logs:
   - Password
   - Confirmation password
   - Reset token
   - Verification code
   - Session token
   - Database credentials
   ============================================================ */

function handleResetPasswordError(
  error: unknown,
  requestId: string
): NextResponse<ApiErrorResponse> {
  /* Request validation */

  if (
    error instanceof RequestValidationError
  ) {
    return errorResponse(
      error.status,
      error.code
    );
  }

  /* Password reset service errors */

  if (
    error instanceof PasswordResetError
  ) {
    switch (error.code) {
      case "INVALID_RESET_TOKEN":

        return errorResponse(
          401,

          "INVALID_RESET_TOKEN",

          {
            clearResetCookie: true,
          }
        );

      case "RESET_TOKEN_EXPIRED":

        return errorResponse(
          401,

          "RESET_TOKEN_EXPIRED",

          {
            clearResetCookie: true,
          }
        );

      case "RESET_NOT_AVAILABLE":

        return errorResponse(
          403,

          "RESET_NOT_AVAILABLE",

          {
            clearResetCookie: true,
          }
        );

      case "PASSWORD_TOO_SHORT":

        return errorResponse(
          400,

          "PASSWORD_TOO_SHORT"
        );

      case "PASSWORD_TOO_LONG":

        return errorResponse(
          400,

          "PASSWORD_TOO_LONG"
        );

      case "PASSWORD_MISMATCH":

        return errorResponse(
          400,

          "PASSWORD_MISMATCH"
        );

      case "TOO_MANY_ATTEMPTS":

        return errorResponse(
          429,

          "TOO_MANY_ATTEMPTS",

          {
            retryAfter:
              error.retryAfter,
          }
        );

      case "SERVICE_UNAVAILABLE":

        console.error(
          "[TAYM][RESET_PASSWORD][SERVICE]",
          {
            requestId,

            code:
              "SERVICE_UNAVAILABLE",
          }
        );

        return errorResponse(
          503,

          "SERVICE_UNAVAILABLE"
        );

      default:

        return errorResponse(
          error.status,

          error.code
        );
    }
  }

  /* Database connection or transaction error */

  if (isDatabaseUnavailable(error)) {
    console.error(
      "[TAYM][RESET_PASSWORD][DATABASE]",
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

  /* Unexpected technical error */

  console.error(
    "[TAYM][RESET_PASSWORD][ERROR]",
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
   15. POST /api/auth/reset-password

   Execution order:

   1. Validate request origin
   2. Read temporary HttpOnly cookie
   3. Read and validate JSON
   4. Validate new password
   5. Verify reset authorization
   6. Update password in PostgreSQL
   7. Revoke all previous sessions
   8. Consume reset authorization
   9. Create new session
   10. Set authenticated session cookie
   11. Clear temporary reset cookie
   12. Return dashboard destination

   Database updates are handled atomically
   by src/lib/auth/password-reset.ts.
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
       STEP 2 — READ RESET AUTHORIZATION

       The temporary cookie is created
       only after successful OTP validation.
       -------------------------------------------------------- */

    const resetToken =
      getResetTokenFromCookie(
        request
      );

    /* --------------------------------------------------------
       STEP 3 — READ REQUEST BODY
       -------------------------------------------------------- */

    const body =
      await readJsonBody(
        request
      );

    /* --------------------------------------------------------
       STEP 4 — VALIDATE PASSWORDS
       -------------------------------------------------------- */

    const validated =
      validateResetBody(body);

    /* --------------------------------------------------------
       STEP 5 — BUILD SERVER-SIDE INPUT

       The reset token comes exclusively
       from the HttpOnly cookie.

       The browser cannot supply an
       arbitrary candidate identity.
       -------------------------------------------------------- */

    const input: CompletePasswordResetInput = {
      challengeId:
        validated.challengeId,

      resetToken,

      password:
        validated.password,

      confirmPassword:
        validated.confirmPassword,
    };

    /* --------------------------------------------------------
       STEP 6 — RESET PASSWORD

       The existing service performs:

       - Validate temporary token hash
       - Check expiration
       - Check successful OTP verification
       - Check account status
       - Check candidate role
       - Check email and phone verification
       - Hash new password with scrypt
       - Update users.password_hash
       - Revoke all previous sessions
       - Consume reset authorization
       - Create new secure session

       All database writes run inside
       the same PostgreSQL transaction.
       -------------------------------------------------------- */

    const result =
      await resetCandidatePassword(
        input
      );

    /* --------------------------------------------------------
       STEP 7 — CREATE SAFE JSON RESPONSE

       Never return:
       - Session token
       - Reset token
       - Password hash
       - Internal database information
       -------------------------------------------------------- */

    const response =
      NextResponse.json<ApiSuccessResponse>(
        {
          success: true,

          data: {
            passwordUpdated: true,

            user: {
              id:
                result.user.id,

              firstName:
                result.user.firstName,

              lastName:
                result.user.lastName,

              fullName:
                result.user.fullName,

              email:
                result.user.email,
            },

            session: {
              authenticated: true,

              expiresAt:
                result.session.expiresAt
                  .toISOString(),
            },

            redirectTo:
              result.redirectTo,
          },

          timestamp:
            new Date().toISOString(),
        },

        {
          status: 200,

          headers:
            RESPONSE_HEADERS,
        }
      );

    /* --------------------------------------------------------
       STEP 8 — SET NEW SESSION COOKIE

       Existing authentication cookie:

       taym_session

       HttpOnly
       Secure in production
       SameSite Lax
       Path /
       -------------------------------------------------------- */

    response.cookies.set(
      result.session.cookieName,

      result.session.token,

      result.session.cookieOptions
    );

    /* --------------------------------------------------------
       STEP 9 — CLEAR TEMPORARY RESET COOKIE

       Cookie:
       taym_password_reset

       Uses the exact same cookie path
       and configuration as creation.
       -------------------------------------------------------- */

    response.cookies.set(
      RESET_COOKIE_NAME,

      "",

      getResetCookieClearOptions()
    );

    /* --------------------------------------------------------
       STEP 10 — RETURN SUCCESS
       -------------------------------------------------------- */

    return response;

  } catch (error: unknown) {
    return handleResetPasswordError(
      error,

      requestId
    );
  }
}
