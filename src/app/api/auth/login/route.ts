
import { NextRequest, NextResponse } from "next/server";

import { createHash, randomUUID } from "node:crypto";

import {
  loginCandidate,
  LoginError,
  type LoginInput,
} from "@/lib/auth/login";

/* ============================================================
   FAHRSCHULE TAYM
   AUTHENTICATION — LOGIN API

   File:
   src/app/api/auth/login/route.ts

   Endpoint:
   POST /api/auth/login

   Database:
   PostgreSQL

   Authentication:
   - Email
   - International phone number
   - Password
   - Remember me

   Security:
   - HttpOnly session cookie
   - Secure cookie in production
   - SameSite protection
   - Origin validation
   - Login rate limiting
   - Request size limitation
   - No sensitive data in JSON
   - No authentication response caching

   Supported interfaces:
   - Desktop
   - Tablet
   - Mobile

   No new layout.
   No new navigation.
   No fictional data.
   ============================================================ */

/* ============================================================
   1. NEXT.JS CONFIGURATION
   ============================================================ */




/* ============================================================
   2. API CONFIGURATION
   ============================================================ */

const MAX_BODY_BYTES = 8_192;

const MAX_IDENTIFIER_LENGTH = 254;

const MAX_PASSWORD_BYTES = 1024;

const RATE_LIMIT_WINDOW_MS =
  15 * 60 * 1000;

const MAX_IDENTIFIER_ATTEMPTS = 8;

const MAX_IP_ATTEMPTS = 30;

const MAX_RATE_LIMIT_ENTRIES = 20_000;

/* ============================================================
   3. TYPES
   ============================================================ */

type ApiErrorCode =
  | "INVALID_INPUT"
  | "INVALID_JSON"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_UNAVAILABLE"
  | "FORBIDDEN_ORIGIN"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "TOO_MANY_ATTEMPTS"
  | "DATABASE_UNAVAILABLE"
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

type RateLimitEntry = {
  attempts: number;
  expiresAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfter: number;
};

type RateLimitStore = Map<
  string,
  RateLimitEntry
>;

/* ============================================================
   4. RESPONSE HEADERS

   Authentication responses must
   never be stored in browser,
   proxy or CDN caches.
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
   5. API ERRORS
   ============================================================ */

class RequestValidationError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string
  ) {
    super(message);

    this.name = "RequestValidationError";
  }
}

function errorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
  retryAfter?: number
): NextResponse<ApiErrorResponse> {
  const headers = new Headers(
    RESPONSE_HEADERS
  );

  if (
    retryAfter !== undefined &&
    retryAfter > 0
  ) {
    headers.set(
      "Retry-After",
      String(retryAfter)
    );
  }

  return NextResponse.json(
    {
      success: false,

      error: {
        code,
        message,

        ...(retryAfter !== undefined
          ? { retryAfter }
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
   6. ORIGIN VALIDATION

   Authorized origin:
   NEXT_PUBLIC_APP_URL

   Development:
   http://localhost:3000

   Production:
   https://fahrschule-taym.de

   Prevents login requests initiated
   from unauthorized external websites.
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

function isAllowedOrigin(
  request: NextRequest
): boolean {
  const origin =
    request.headers.get("origin");

  const fetchSite =
    request.headers.get("sec-fetch-site");

  if (fetchSite === "cross-site") {
    return false;
  }

  if (!origin || origin === "null") {
    return false;
  }

  try {
    const normalizedOrigin =
      new URL(origin).origin;

    return getAllowedOrigins().has(
      normalizedOrigin
    );
  } catch {
    return false;
  }
}

/* ============================================================
   7. CLIENT IP ADDRESS

   Forwarded IP headers are trusted
   only when explicitly enabled
   behind a trusted reverse proxy.

   The proxy must remove or overwrite
   incoming client-supplied IP headers.

   Without a trusted proxy, login
   protection remains identifier-based.
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

  const ip =
    forwardedFor
      ?.split(",")[0]
      ?.trim() ||
    realIp?.trim();

  if (!ip || ip.length > 64) {
    return null;
  }

  return ip;
}

/* ============================================================
   8. LOGIN RATE LIMITING

   Maximum:
   - 8 requests per identifier
   - 30 requests per trusted IP
   - 15-minute fixed window

   Store is local to the Node.js process.

   For multi-instance production,
   use a shared rate limiter such as
   Redis or a trusted gateway.
   ============================================================ */

const globalForLogin =
  globalThis as typeof globalThis & {
    taymLoginRateLimits?: RateLimitStore;
  };

const rateLimitStore =
  globalForLogin.taymLoginRateLimits ??
  new Map<string, RateLimitEntry>();

globalForLogin.taymLoginRateLimits =
  rateLimitStore;

function hashRateLimitKey(
  value: string
): string {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

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

function consumeRateLimit(
  key: string,
  maxAttempts: number
): RateLimitResult {
  const now = Date.now();

  const existing =
    rateLimitStore.get(key);

  if (
    existing &&
    existing.expiresAt > now
  ) {
    const retryAfter = Math.max(
      1,
      Math.ceil(
        (existing.expiresAt - now) /
          1000
      )
    );

    if (
      existing.attempts >= maxAttempts
    ) {
      return {
        allowed: false,
        retryAfter,
      };
    }

    existing.attempts += 1;

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
    attempts: 1,

    expiresAt:
      now + RATE_LIMIT_WINDOW_MS,
  });

  return {
    allowed: true,
    retryAfter: 0,
  };
}

/* ============================================================
   9. IDENTIFIER RATE LIMIT KEY

   Normalizes equivalent email and
   international phone representations
   to the same rate-limit identity.

   Examples:
   USER@example.com
   user@example.com

   +49 151 12345678
   004915112345678
   ============================================================ */

function normalizeIdentifierForRateLimit(
  value: string
): string {
  let identifier = value
    .trim()
    .toLowerCase();

  if (!identifier.includes("@")) {
    identifier = identifier.replace(
      /[\s().-]/g,
      ""
    );

    if (
      identifier.startsWith("00")
    ) {
      identifier =
        `+${identifier.slice(2)}`;
    }
  }

  return identifier;
}

function getIdentifierRateLimitKey(
  identifier: string
): string {
  const normalized =
    normalizeIdentifierForRateLimit(
      identifier
    );

  return `identifier:${hashRateLimitKey(
    normalized
  )}`;
}

/* ============================================================
   10. REQUEST BODY READING

   Protects against oversized JSON
   bodies, even if Content-Length
   is absent or incorrect.
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
      "Content-Type must be application/json."
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
        "Invalid request length."
      );
    }

    if (length > MAX_BODY_BYTES) {
      throw new RequestValidationError(
        413,
        "PAYLOAD_TOO_LARGE",
        "Request body is too large."
      );
    }
  }

  if (!request.body) {
    throw new RequestValidationError(
      400,
      "INVALID_JSON",
      "A JSON request body is required."
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
          "PAYLOAD_TOO_LARGE",
          "Request body is too large."
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
      { fatal: true }
    ).decode(buffer);

    return JSON.parse(text);
  } catch {
    throw new RequestValidationError(
      400,
      "INVALID_JSON",
      "Invalid JSON request body."
    );
  }
}

/* ============================================================
   11. LOGIN INPUT VALIDATION

   Expected JSON:

   {
     "identifier": "...",
     "password": "...",
     "rememberMe": false
   }

   The password is never trimmed.
   ============================================================ */

function validateRequestBody(
  body: unknown
): LoginInput {
  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    throw new RequestValidationError(
      400,
      "INVALID_INPUT",
      "Invalid login information."
    );
  }

  const data =
    body as Record<string, unknown>;

  if (
    typeof data.identifier !== "string" ||
    typeof data.password !== "string"
  ) {
    throw new RequestValidationError(
      400,
      "INVALID_INPUT",
      "Email or phone number and password are required."
    );
  }

  const identifier =
    data.identifier.trim();

  const password = data.password;

  if (
    identifier.length === 0 ||
    identifier.length >
      MAX_IDENTIFIER_LENGTH
  ) {
    throw new RequestValidationError(
      400,
      "INVALID_INPUT",
      "Invalid email or phone number."
    );
  }

  if (
    password.length === 0 ||
    Buffer.byteLength(
      password,
      "utf8"
    ) > MAX_PASSWORD_BYTES
  ) {
    throw new RequestValidationError(
      400,
      "INVALID_INPUT",
      "Invalid password."
    );
  }

  if (
    data.rememberMe !== undefined &&
    typeof data.rememberMe !== "boolean"
  ) {
    throw new RequestValidationError(
      400,
      "INVALID_INPUT",
      "Invalid rememberMe value."
    );
  }

  return {
    identifier,

    password,

    rememberMe:
      data.rememberMe === true,
  };
}

/* ============================================================
   12. DATABASE ERROR DETECTION
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

  const code = (
    error as { code?: unknown }
  ).code;

  return (
    typeof code === "string" &&
    DATABASE_CONNECTION_ERRORS.has(
      code
    )
  );
}

/* ============================================================
   13. CENTRALIZED ERROR HANDLING

   No password.
   No session token.
   No SQL query.
   No database credentials.

   Sensitive information is never
   returned to the browser.
   ============================================================ */

function handleLoginError(
  error: unknown,
  requestId: string
): NextResponse<ApiErrorResponse> {
  /* Request validation errors */

  if (
    error instanceof
      RequestValidationError
  ) {
    return errorResponse(
      error.status,
      error.code,
      error.message
    );
  }

  /* Authentication service errors */

  if (error instanceof LoginError) {
    switch (error.code) {
      case "INVALID_INPUT":
        return errorResponse(
          400,
          "INVALID_INPUT",
          "Invalid login information."
        );

      case "INVALID_CREDENTIALS":
        return errorResponse(
          401,
          "INVALID_CREDENTIALS",
          "Invalid email, phone number or password."
        );

      case "ACCOUNT_UNAVAILABLE":
        return errorResponse(
          403,
          "ACCOUNT_UNAVAILABLE",
          "This account is currently unavailable."
        );

      case "DATABASE_UNAVAILABLE":
        return errorResponse(
          503,
          "DATABASE_UNAVAILABLE",
          "The authentication service is temporarily unavailable."
        );
    }
  }

  /* Database connection errors */

  if (isDatabaseUnavailable(error)) {
    console.error(
      "[TAYM][LOGIN][DATABASE]",
      {
        requestId,
        message:
          "Database connection unavailable.",
      }
    );

    return errorResponse(
      503,
      "DATABASE_UNAVAILABLE",
      "The authentication service is temporarily unavailable."
    );
  }

  /* Unexpected server errors */

  console.error(
    "[TAYM][LOGIN][ERROR]",
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
    "INTERNAL_ERROR",
    "An unexpected error occurred."
  );
}

/* ============================================================
   14. POST /api/auth/login

   Execution:

   1. Validate request origin
   2. Check trusted IP rate limit
   3. Read and validate JSON
   4. Check identifier rate limit
   5. Authenticate candidate
   6. Create PostgreSQL session
   7. Set secure HttpOnly cookie
   8. Return dashboard destination
   ============================================================ */

export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  const requestId = randomUUID();

  try {
    /* --------------------------------------------------------
       STEP 1 — ORIGIN VALIDATION
       -------------------------------------------------------- */

    if (!isAllowedOrigin(request)) {
      return errorResponse(
        403,
        "FORBIDDEN_ORIGIN",
        "This request is not allowed."
      );
    }

    /* --------------------------------------------------------
       STEP 2 — IP RATE LIMIT
       -------------------------------------------------------- */

    const clientIp =
      getClientIp(request);

    if (clientIp) {
      const ipKey =
        `ip:${hashRateLimitKey(
          clientIp
        )}`;

      const ipLimit =
        consumeRateLimit(
          ipKey,
          MAX_IP_ATTEMPTS
        );

      if (!ipLimit.allowed) {
        return errorResponse(
          429,
          "TOO_MANY_ATTEMPTS",
          "Too many login attempts. Please try again later.",
          ipLimit.retryAfter
        );
      }
    }

    /* --------------------------------------------------------
       STEP 3 — READ REQUEST
       -------------------------------------------------------- */

    const body =
      await readJsonBody(request);

    const input =
      validateRequestBody(body);

    /* --------------------------------------------------------
       STEP 4 — IDENTIFIER RATE LIMIT
       -------------------------------------------------------- */

    const identifierKey =
      getIdentifierRateLimitKey(
        input.identifier
      );

    const identifierLimit =
      consumeRateLimit(
        identifierKey,
        MAX_IDENTIFIER_ATTEMPTS
      );

    if (!identifierLimit.allowed) {
      return errorResponse(
        429,
        "TOO_MANY_ATTEMPTS",
        "Too many login attempts. Please try again later.",
        identifierLimit.retryAfter
      );
    }

    /* --------------------------------------------------------
       STEP 5 — REAL AUTHENTICATION

       src/lib/auth/login.ts verifies:

       - Email or phone number
       - Password hash
       - Candidate role
       - Active account
       - Verified email
       - Verified phone number

       Creates a real session
       inside PostgreSQL.
       -------------------------------------------------------- */

    const result =
      await loginCandidate(input);

    /* --------------------------------------------------------
       STEP 6 — SAFE JSON RESPONSE

       Never serialize result.session
       directly into the JSON response.

       The session token must remain
       exclusively in the HttpOnly cookie.
       -------------------------------------------------------- */

    const response = NextResponse.json(
      {
        success: true,

        data: {
          user: {
            id: result.user.id,

            firstName:
              result.user.firstName,

            lastName:
              result.user.lastName,

            fullName:
              result.user.fullName,

            email:
              result.user.email,

            phoneE164:
              result.user.phoneE164,

            countryCode:
              result.user.countryCode,

            role:
              result.user.role,

            status:
              result.user.status,

            emailVerified:
              result.user.emailVerified,

            phoneVerified:
              result.user.phoneVerified,
          },

          session: {
            authenticated: true,

            expiresAt:
              result.session.expiresAt
                .toISOString(),

            rememberMe:
              result.session.rememberMe,
          },

          redirectTo:
            result.redirectTo,
        },
      },
      {
        status: 200,

        headers: RESPONSE_HEADERS,
      }
    );

    /* --------------------------------------------------------
       STEP 7 — SECURE SESSION COOKIE

       Same cookie as registration
       and dashboard authentication:

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
       STEP 8 — RESET IDENTIFIER LIMIT

       Only after successful
       authentication and cookie setup.

       The IP limit remains active
       to prevent repeated abuse.
       -------------------------------------------------------- */

    rateLimitStore.delete(
      identifierKey
    );

    return response;
  } catch (error: unknown) {
    return handleLoginError(
      error,
      requestId
    );
  }
}
