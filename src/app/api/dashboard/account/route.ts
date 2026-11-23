
import { NextRequest, NextResponse } from "next/server";
import { getCurrentCandidateSession } from "@/lib/auth/session";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";

import {
  ACCOUNT_MAX_PATCH_BODY_BYTES,
  validateAccountProfilePatch,
  type AccountProfile,
  type AccountProfilePatch,
} from "@/lib/account/validation";

/* ============================================================
   FAHRSCHULE TAYM
   CANDIDATE ACCOUNT API

   src/app/api/dashboard/account/route.ts

   GET:
   Read authenticated candidate profile.

   PATCH:
   Validate and update editable profile data.

   IMPORTANT INTEGRATION POINTS:
   1. "@/auth" must expose auth().
   2. "@/lib/prisma" must expose prisma.
   3. prisma.user must match your actual schema.

   Do not use a client-supplied user ID.

   Phone changes require a separate
   completed SMS verification workflow.
   ============================================================ */

const globalAccount = globalThis as typeof globalThis & { taymAccountPool?: Pool };
function accountPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  if (!globalAccount.taymAccountPool) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    pool.on("error", (error) => {
      console.error("[TAYM][ACCOUNT][DATABASE_POOL]", { code: (error as NodeJS.ErrnoException).code });
    });
    globalAccount.taymAccountPool = pool;
  }
  return globalAccount.taymAccountPool;
}

const NO_STORE = {
  "Cache-Control": "no-store, max-age=0",
  "Pragma": "no-cache",
  "X-Content-Type-Options": "nosniff",
};

/* ============================================================
   1. RESPONSE HELPERS
   ============================================================ */

function json(
  body: Record<string, unknown>,
  status: number
) {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE,
  });
}

function failure(
  status: number,
  code: string,
  extra: Record<string, unknown> = {}
) {
  return json(
    {
      success: false,
      code,
      ...extra,
    },
    status
  );
}

/* ============================================================
   2. AUTHENTICATED IDENTITY

   Never accept userId from:
   - query parameters
   - request body
   - custom request headers

   The ID must come from a verified
   server-side session.
   ============================================================ */

async function getCandidateId():
  Promise<string | null> {
  const session = await getCurrentCandidateSession();

  const id = session?.userId;

  if (
    typeof id !== "string" ||
    id.length === 0
  ) {
    return null;
  }

  return id;
}

/* ============================================================
   3. DATABASE SELECT

   This selection assumes the User model
   contains these columns.

   Adjust only this mapping if your
   Prisma schema uses different names.

   Sensitive fields must never be
   included in the response.
   ============================================================ */

/* ============================================================
   4. PROFILE RESPONSE

   Return only account information
   required by the candidate UI.

   No password, OTP, secret,
   authentication token or session data.
   ============================================================ */

type DatabaseProfile = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  email: string;
  emailVerified: boolean | Date | null;
  phoneE164: string | null;
  phoneVerified: boolean | Date | null;
  countryCode: string;
  streetAddress: string | null;
  postalCode: string | null;
  city: string | null;
  updatedAt: Date;
};

function isVerified(
  value: boolean | Date | null
): boolean {
  return value === true ||
    value instanceof Date;
}

function toPublicProfile(
  user: DatabaseProfile
): AccountProfile {
  const allowedCountries = [
    "DE",
    "AT",
    "BE",
    "IT",
    "ES",
  ] as const;

  const country =
    user.countryCode.toUpperCase();

  if (
    !allowedCountries.some(
      (value) => value === country
    )
  ) {
    throw new Error(
      "UNSUPPORTED_ACCOUNT_COUNTRY"
    );
  }

  return {
    id: user.id,

    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    dateOfBirth: user.dateOfBirth ?? "",

    email: user.email,
    emailVerified:
      isVerified(user.emailVerified),

    phoneE164: user.phoneE164 ?? "",
    phoneVerified:
      isVerified(user.phoneVerified),

    countryCode:
      country as AccountProfile["countryCode"],

    streetAddress:
      user.streetAddress ?? "",

    postalCode:
      user.postalCode ?? "",

    city: user.city ?? "",
  };
}

/* ============================================================
   5. DATABASE PROFILE LOOKUP
   ============================================================ */

async function loadAccount(
  userId: string
) {
  const result = await accountPool().query<DatabaseProfile>(
    `SELECT u.id, u.first_name AS "firstName", u.last_name AS "lastName", u.email,
      u.email_verified_at AS "emailVerified", u.phone_e164 AS "phoneE164",
      u.phone_verified_at AS "phoneVerified", u.country_code AS "countryCode",
      to_char(p.date_of_birth, 'YYYY-MM-DD') AS "dateOfBirth", p.street_address AS "streetAddress", p.postal_code AS "postalCode", p.city,
      u.updated_at AS "updatedAt"
     FROM users u LEFT JOIN candidate_profiles p ON p.user_id = u.id WHERE u.id = $1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

/* ============================================================
   6. CSRF / ORIGIN PROTECTION

   For cookie-authenticated PATCH requests.

   Requests must come from the same
   origin as the application.

   For reverse proxies, configure
   NEXT_PUBLIC_APP_URL with the exact
   production origin.
   ============================================================ */

function hasValidOrigin(
  request: NextRequest
): boolean {
  const origin = request.headers.get(
    "origin"
  );

  const fetchSite = request.headers.get(
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

  if (
    process.env.NODE_ENV === "production" &&
    origin === "https://fahrschule-taym.de"
  ) {
    return true;
  }

  const expected =
    process.env.NEXT_PUBLIC_APP_URL ||
    request.nextUrl.origin;

  try {
    return (
      new URL(origin).origin ===
      new URL(expected).origin
    );
  } catch {
    return false;
  }
}

/* ============================================================
   7. SAFE REQUEST BODY

   Reject oversized bodies before parsing.

   JSON only.
   No multipart file uploads.
   No arbitrary objects.
   ============================================================ */

async function readPatchBody(
  request: NextRequest
): Promise<
  | { success: true; body: unknown }
  | {
      success: false;
      status: number;
      code: string;
    }
> {
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
      success: false,
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
      length >
        ACCOUNT_MAX_PATCH_BODY_BYTES
    ) {
      return {
        success: false,
        status: 413,
        code: "BODY_TOO_LARGE",
      };
    }
  }

  const reader =
    request.body?.getReader();

  if (!reader) {
    return {
      success: false,
      status: 400,
      code: "INVALID_BODY",
    };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const result =
        await reader.read();

      if (result.done) {
        break;
      }

      total += result.value.byteLength;

      if (
        total >
        ACCOUNT_MAX_PATCH_BODY_BYTES
      ) {
        await reader.cancel();

        return {
          success: false,
          status: 413,
          code: "BODY_TOO_LARGE",
        };
      }

      chunks.push(result.value);
    }

    const bytes =
      new Uint8Array(total);

    let offset = 0;

    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const raw =
      new TextDecoder(
        "utf-8",
        { fatal: true }
      ).decode(bytes);

    return {
      success: true,
      body: JSON.parse(raw),
    };
  } catch {
    return {
      success: false,
      status: 400,
      code: "INVALID_JSON",
    };
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Reader is already released.
    }
  }
}

/* ============================================================
   8. DATABASE UPDATE ALLOWLIST

   Only normalized editable fields can
   be written.

   Email, country, verification flags,
   password and role never appear here.
   ============================================================ */

function createUpdateData(
  patch: AccountProfilePatch
) {
  const data: AccountProfilePatch = {};

  if (patch.firstName !== undefined) {
    data.firstName = patch.firstName;
  }

  if (patch.lastName !== undefined) {
    data.lastName = patch.lastName;
  }
  if (patch.dateOfBirth !== undefined) data.dateOfBirth = patch.dateOfBirth;

  if (
    patch.streetAddress !== undefined
  ) {
    data.streetAddress =
      patch.streetAddress;
  }

  if (patch.postalCode !== undefined) {
    data.postalCode =
      patch.postalCode;
  }

  if (patch.city !== undefined) {
    data.city = patch.city;
  }

  /*
   * Deliberately exclude phoneE164.
   *
   * A changed telephone number needs
   * verified ownership before becoming
   * the active account phone.
   *
   * The separate SMS confirmation API
   * will handle the verified change.
   */

  return data;
}

/* ============================================================
   9. GET /api/dashboard/account

   Reads only the authenticated user's
   profile from PostgreSQL.
   ============================================================ */

export async function GET() {
  try {
    const userId =
      await getCandidateId();

    if (!userId) {
      return failure(
        401,
        "AUTHENTICATION_REQUIRED"
      );
    }

    const user =
      await loadAccount(userId);

    if (!user) {
      return failure(
        404,
        "ACCOUNT_NOT_FOUND"
      );
    }

    const profile =
      toPublicProfile(user);

    return json(
      {
        success: true,
        profile,
      },
      200
    );
  } catch (error) {
    console.error(
      "[TAYM_ACCOUNT_GET]",
      error instanceof Error
        ? error.name
        : "UNKNOWN_ERROR"
    );

    return failure(
      500,
      "INTERNAL_SERVER_ERROR"
    );
  }
}

/* ============================================================
   10. PATCH /api/dashboard/account

   Update candidate profile securely.
   ============================================================ */

export async function PATCH(
  request: NextRequest
) {
  try {
    /* ------------------------------------------------------
       A. Check origin
       ------------------------------------------------------ */

    if (!hasValidOrigin(request)) {
      return failure(
        403,
        "ORIGIN_NOT_ALLOWED"
      );
    }

    /* ------------------------------------------------------
       B. Authenticate
       ------------------------------------------------------ */

    const userId =
      await getCandidateId();

    if (!userId) {
      return failure(
        401,
        "AUTHENTICATION_REQUIRED"
      );
    }

    /* ------------------------------------------------------
       C. Read current trusted profile
       ------------------------------------------------------ */

    const currentUser =
      await loadAccount(userId);

    if (!currentUser) {
      return failure(
        404,
        "ACCOUNT_NOT_FOUND"
      );
    }

    const currentProfile =
      toPublicProfile(currentUser);

    /* ------------------------------------------------------
       D. Read and validate request
       ------------------------------------------------------ */

    const bodyResult =
      await readPatchBody(request);

    if (!bodyResult.success) {
      return failure(
        bodyResult.status,
        bodyResult.code
      );
    }

    const validation =
      validateAccountProfilePatch(
        bodyResult.body,

        /*
         * Country comes from the account
         * stored in PostgreSQL.
         */
        currentProfile.countryCode,

        {
          firstName:
            currentProfile.firstName,

          lastName:
            currentProfile.lastName,

          dateOfBirth: currentProfile.dateOfBirth,

          phoneE164:
            currentProfile.phoneE164,

          streetAddress:
            currentProfile.streetAddress,

          postalCode:
            currentProfile.postalCode,

          city:
            currentProfile.city,
        }
      );

    if (!validation.success) {
      return failure(
        400,
        "VALIDATION_FAILED",
        {
          issues: validation.issues,
        }
      );
    }

    /* ------------------------------------------------------
       E. Telephone change safety

       Do not save an unverified number.

       The new phone must first complete
       an independent SMS workflow.

       Return an explicit error rather than
       pretending that verification exists.
       ------------------------------------------------------ */

    if (
      validation.requiresPhoneVerification
    ) {
      return failure(
        409,
        "PHONE_VERIFICATION_REQUIRED",
        {
          field: "phoneE164",
        }
      );
    }

    /* ------------------------------------------------------
       F. No modifications
       ------------------------------------------------------ */

    if (
      validation.changedFields.length === 0
    ) {
      return json(
        {
          success: true,
          changed: false,
          profile: currentProfile,
        },
        200
      );
    }

    /* ------------------------------------------------------
       G. Explicit update allowlist
       ------------------------------------------------------ */

    const updateData =
      createUpdateData(
        validation.data
      );

    /* ------------------------------------------------------
       H. Optimistic concurrency

       Prevent silently overwriting a
       profile that another request has
       changed since it was read.

       Requires an updatedAt field
       in the actual Prisma model.
       ------------------------------------------------------ */

    const client = await accountPool().connect();
    let updated = false;
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `UPDATE users SET first_name = $1, last_name = $2, full_name = $3, updated_at = NOW()
         WHERE id = $4 AND updated_at = $5`,
        [updateData.firstName ?? currentUser.firstName, updateData.lastName ?? currentUser.lastName,
          `${updateData.firstName ?? currentUser.firstName} ${updateData.lastName ?? currentUser.lastName}`.trim(),
          userId, currentUser.updatedAt]
      );
      if (result.rowCount === 1) {
        await client.query(
          `INSERT INTO candidate_profiles (id, user_id, street_address, postal_code, city, date_of_birth, updated_at)
           VALUES ($1, $2, $3, $4, $5, NULLIF($6, '')::date, NOW())
           ON CONFLICT (user_id) DO UPDATE SET street_address = EXCLUDED.street_address,
             postal_code = EXCLUDED.postal_code, city = EXCLUDED.city, date_of_birth = EXCLUDED.date_of_birth, updated_at = NOW()`,
          [randomUUID(), userId, updateData.streetAddress ?? currentUser.streetAddress,
            updateData.postalCode ?? currentUser.postalCode, updateData.city ?? currentUser.city,
            updateData.dateOfBirth ?? currentUser.dateOfBirth ?? ""]
        );
        updated = true;
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    if (!updated) {
      return failure(
        409,
        "PROFILE_CHANGED_RELOAD_REQUIRED"
      );
    }

    /* ------------------------------------------------------
       I. Read profile after commit

       The candidate receives only data
       actually persisted in PostgreSQL.
       ------------------------------------------------------ */

    const updatedUser =
      await loadAccount(userId);

    if (!updatedUser) {
      return failure(
        404,
        "ACCOUNT_NOT_FOUND"
      );
    }

    return json(
      {
        success: true,
        changed: true,
        changedFields:
          validation.changedFields,
        profile:
          toPublicProfile(
            updatedUser
          ),
      },
      200
    );
  } catch (error) {
    console.error(
      "[TAYM_ACCOUNT_PATCH]",
      error instanceof Error
        ? error.name
        : "UNKNOWN_ERROR"
    );

    return failure(
      500,
      "INTERNAL_SERVER_ERROR"
    );
  }
}

/* ============================================================
   END
   ============================================================ */
