
/* ============================================================
   FAHRSCHULE TAYM
   ACCOUNT PROFILE VALIDATION

   File:
   src/lib/account/validation.ts

   Purpose:
   - Validate candidate profile updates
   - Normalize editable fields
   - Reject unauthorized fields
   - Apply country-specific postal rules
   - Validate phone numbers in E.164 format
   - Identify changes requiring SMS verification
   - Return structured validation errors

   Countries:
   DE | AT | BE | IT | ES

   Security:
   - Server-side validation
   - Explicit field allowlist
   - No account ID from client
   - No email/country changes through PATCH
   - No verification status changes
   - No automatic phone verification
   - No database access inside this module

   Compatible with Next.js + TypeScript.
   No external dependency required.
   ============================================================ */

/* ============================================================
   1. SUPPORTED COUNTRIES
   ============================================================ */

export const ACCOUNT_COUNTRIES = [
  "DE",
  "AT",
  "BE",
  "IT",
  "ES",
] as const;

export type AccountCountry =
  (typeof ACCOUNT_COUNTRIES)[number];

/* ============================================================
   2. EDITABLE PROFILE FIELDS

   Only these fields can be submitted
   through the account update API.

   Email, country, password and
   security attributes are excluded.
   ============================================================ */

export const ACCOUNT_EDITABLE_FIELDS = [
  "firstName",
  "lastName",
  "phoneE164",
  "streetAddress",
  "postalCode",
  "city",
] as const;

export type AccountEditableField =
  (typeof ACCOUNT_EDITABLE_FIELDS)[number];

export type AccountProfilePatch =
  Partial<{
    firstName: string;
    lastName: string;
    phoneE164: string;
    streetAddress: string;
    postalCode: string;
    city: string;
  }>;

/* ============================================================
   3. PROFILE DATA CONTRACT

   The API should return this public
   representation after reading the
   authenticated account from PostgreSQL.

   Never return password hashes,
   OTP secrets or session tokens.
   ============================================================ */

export type AccountProfile = {
  id: string;

  firstName: string;
  lastName: string;

  email: string;
  emailVerified: boolean;

  phoneE164: string;
  phoneVerified: boolean;

  countryCode: AccountCountry;

  streetAddress: string;
  postalCode: string;
  city: string;
};

/* ============================================================
   4. VALIDATION ERROR CODES

   Codes are independent of language.

   The interface can translate messages
   into German, Arabic, Turkish
   or Spanish.

   Do not trust client-provided text
   as an error message.
   ============================================================ */

export const ACCOUNT_VALIDATION_CODES = [
  "INVALID_BODY",
  "EMPTY_UPDATE",
  "UNKNOWN_FIELD",
  "INVALID_TYPE",
  "REQUIRED",
  "TOO_SHORT",
  "TOO_LONG",
  "INVALID_CHARACTERS",
  "INVALID_PHONE",
  "INVALID_POSTAL_CODE",
  "UNSUPPORTED_COUNTRY",
] as const;

export type AccountValidationCode =
  (typeof ACCOUNT_VALIDATION_CODES)[number];

export type AccountValidationIssue = {
  field: string;
  code: AccountValidationCode;
};

export type AccountValidationResult =
  | {
      success: true;
      data: AccountProfilePatch;
      changedFields: AccountEditableField[];
      requiresPhoneVerification: boolean;
      phoneVerificationValue: string | null;
      issues: [];
    }
  | {
      success: false;
      data: null;
      changedFields: [];
      requiresPhoneVerification: false;
      phoneVerificationValue: null;
      issues: AccountValidationIssue[];
    };

/* ============================================================
   5. SECURITY LIMITS

   Limits are measured by Unicode
   code points after normalization.
   ============================================================ */

export const ACCOUNT_FIELD_LIMITS = {
  firstName: {
    min: 1,
    max: 80,
  },

  lastName: {
    min: 1,
    max: 80,
  },

  streetAddress: {
    min: 4,
    max: 180,
  },

  city: {
    min: 2,
    max: 100,
  },

  postalCode: {
    min: 4,
    max: 10,
  },

  phoneE164: {
    min: 9,
    max: 16,
  },
} as const;

/*
 * Apply this limit to the raw request
 * body before JSON parsing in the API.
 *
 * Maximum request size: 8 KiB.
 */

export const ACCOUNT_MAX_PATCH_BODY_BYTES =
  8 * 1024;

/* ============================================================
   6. INTERNAL SECURITY HELPERS
   ============================================================ */

const EDITABLE_FIELD_SET:
  ReadonlySet<string> = new Set(
    ACCOUNT_EDITABLE_FIELDS
  );

/*
 * Reject:
 * - ASCII controls
 * - DEL / C1 controls
 * - Unicode bidirectional controls
 * - Invisible formatting characters
 *
 * This helps prevent confusing or
 * misleading account profile values.
 */

const UNSAFE_CONTROL_PATTERN =
  /[\p{Cc}\p{Cf}]/u;

/*
 * Reject angle brackets and markup-like
 * input from editable profile fields.

 * Output encoding and parameterized
 * SQL queries remain necessary.
 */

const UNSAFE_MARKUP_PATTERN =
  /[<>]/;

/*
 * Common characters found in names
 * and addresses are accepted.

 * We intentionally do not restrict
 * names to Latin characters.
 */

const NAME_PATTERN =
  /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} '\u2019.\-]*$/u;

const CITY_PATTERN =
  /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} '\u2019.,()\-\/]*$/u;

const STREET_PATTERN =
  /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} '\u2019.,()\-\/#]*$/u;

/* ============================================================
   7. OBJECT VALIDATION

   Reject arrays, null, class instances,
   malformed JSON values and objects
   with unexpected prototypes.
   ============================================================ */

function isPlainRecord(
  value: unknown
): value is Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype =
    Object.getPrototypeOf(value);

  return (
    prototype === Object.prototype ||
    prototype === null
  );
}

/* ============================================================
   8. NORMALIZE TEXT
   ============================================================ */

export function normalizeAccountText(
  value: string
): string {
  return value
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ");
}

function textLength(
  value: string
): number {
  return Array.from(value).length;
}

/* ============================================================
   9. COUNTRY NORMALIZATION

   Country is read from the authenticated
   account, never changed through PATCH.
   ============================================================ */

export function normalizeAccountCountry(
  value: unknown
): AccountCountry | null {
  if (typeof value !== "string") {
    return null;
  }

  const country = value
    .trim()
    .toUpperCase();

  return (
    ACCOUNT_COUNTRIES as
      readonly string[]
  ).includes(country)
    ? (country as AccountCountry)
    : null;
}

/* ============================================================
   10. POSTAL CODE RULES

   DE: 5 digits
   AT: 4 digits
   BE: 4 digits
   IT: 5 digits
   ES: 5 digits

   Postal format validation is not
   proof that an address exists.
   ============================================================ */

export const ACCOUNT_POSTAL_PATTERNS:
  Record<AccountCountry, RegExp> = {
    DE: /^\d{5}$/,
    AT: /^\d{4}$/,
    BE: /^\d{4}$/,
    IT: /^\d{5}$/,
    ES: /^\d{5}$/,
  };

/*
 * Broad structural validation, including
 * leading zeroes.

 * Actual postal-code existence must be
 * verified separately when required.
 */

export function normalizeAccountPostalCode(
  value: string
): string {
  return normalizeAccountText(value);
}

export function isValidAccountPostalCode(
  value: string,
  country: AccountCountry
): boolean {
  const pattern =
    ACCOUNT_POSTAL_PATTERNS[country];

  return pattern.test(
    normalizeAccountPostalCode(value)
  );
}

/* ============================================================
   11. PHONE NORMALIZATION

   Expected storage format:
   E.164

   Examples:
   +491701234567
   +436641234567
   +32470123456
   +393331234567
   +34600123456

   Does not automatically validate
   the phone number as verified.
   ============================================================ */

export function normalizeAccountPhone(
  value: string
): string {
  return value
    .normalize("NFC")
    .trim()
    .replace(/[\s().-]/g, "");
}

export function isValidAccountPhone(
  value: string
): boolean {
  const normalized =
    normalizeAccountPhone(value);

  /*
   * E.164:
   * + followed by 8 to 15 digits,
   * beginning with a non-zero digit.
   *
   * This is syntax validation only.
   * Number reachability and ownership
   * require independent verification.
   */

  return /^\+[1-9]\d{7,14}$/.test(
    normalized
  );
}

/* ============================================================
   12. FIELD VALIDATION
   ============================================================ */

type FieldCheck =
  | {
      success: true;
      value: string;
    }
  | {
      success: false;
      code: AccountValidationCode;
    };

function checkTextField(
  value: unknown,
  field:
    | "firstName"
    | "lastName"
    | "streetAddress"
    | "city"
): FieldCheck {
  if (typeof value !== "string") {
    return {
      success: false,
      code: "INVALID_TYPE",
    };
  }

  const normalized =
    normalizeAccountText(value);

  if (!normalized) {
    return {
      success: false,
      code: "REQUIRED",
    };
  }

  const limits =
    ACCOUNT_FIELD_LIMITS[field];

  const length =
    textLength(normalized);

  if (length < limits.min) {
    return {
      success: false,
      code: "TOO_SHORT",
    };
  }

  if (length > limits.max) {
    return {
      success: false,
      code: "TOO_LONG",
    };
  }

  if (
    UNSAFE_CONTROL_PATTERN.test(normalized) ||
    UNSAFE_MARKUP_PATTERN.test(normalized)
  ) {
    return {
      success: false,
      code: "INVALID_CHARACTERS",
    };
  }

  const pattern =
    field === "firstName" ||
    field === "lastName"
      ? NAME_PATTERN
      : field === "city"
        ? CITY_PATTERN
        : STREET_PATTERN;

  if (!pattern.test(normalized)) {
    return {
      success: false,
      code: "INVALID_CHARACTERS",
    };
  }

  return {
    success: true,
    value: normalized,
  };
}

/* ============================================================
   13. PHONE FIELD VALIDATION
   ============================================================ */

function checkPhoneField(
  value: unknown
): FieldCheck {
  if (typeof value !== "string") {
    return {
      success: false,
      code: "INVALID_TYPE",
    };
  }

  const normalized =
    normalizeAccountPhone(value);

  if (!normalized) {
    return {
      success: false,
      code: "REQUIRED",
    };
  }

  if (
    textLength(normalized) >
    ACCOUNT_FIELD_LIMITS.phoneE164.max
  ) {
    return {
      success: false,
      code: "TOO_LONG",
    };
  }

  if (!isValidAccountPhone(normalized)) {
    return {
      success: false,
      code: "INVALID_PHONE",
    };
  }

  return {
    success: true,
    value: normalized,
  };
}

/* ============================================================
   14. POSTAL FIELD VALIDATION
   ============================================================ */

function checkPostalCodeField(
  value: unknown,
  country: AccountCountry
): FieldCheck {
  if (typeof value !== "string") {
    return {
      success: false,
      code: "INVALID_TYPE",
    };
  }

  const normalized =
    normalizeAccountPostalCode(value);

  if (!normalized) {
    return {
      success: false,
      code: "REQUIRED",
    };
  }

  if (
    textLength(normalized) >
    ACCOUNT_FIELD_LIMITS.postalCode.max
  ) {
    return {
      success: false,
      code: "TOO_LONG",
    };
  }

  if (
    !isValidAccountPostalCode(
      normalized,
      country
    )
  ) {
    return {
      success: false,
      code: "INVALID_POSTAL_CODE",
    };
  }

  return {
    success: true,
    value: normalized,
  };
}

/* ============================================================
   15. VALIDATE ONE FIELD
   ============================================================ */

export function validateAccountField(
  field: AccountEditableField,
  value: unknown,
  country: AccountCountry
): FieldCheck {
  switch (field) {
    case "firstName":
    case "lastName":
    case "streetAddress":
    case "city":
      return checkTextField(
        value,
        field
      );

    case "postalCode":
      return checkPostalCodeField(
        value,
        country
      );

    case "phoneE164":
      return checkPhoneField(
        value
      );
  }
}

/* ============================================================
   16. VALIDATE PROFILE PATCH

   Main function for:

   PATCH /api/dashboard/account

   Inputs:
   - unknown raw JSON body
   - trusted country from authenticated
     PostgreSQL user profile
   - optional current trusted account values

   The client cannot supply the country
   to change the applicable rules.
   ============================================================ */

export function validateAccountProfilePatch(
  input: unknown,
  countryInput: unknown,
  currentProfile?: Readonly<
    AccountProfilePatch
  >
): AccountValidationResult {
  /* --------------------------------------------------------
     Validate object
     -------------------------------------------------------- */

  if (!isPlainRecord(input)) {
    return {
      success: false,
      data: null,
      changedFields: [],
      requiresPhoneVerification: false,
      phoneVerificationValue: null,
      issues: [
        {
          field: "body",
          code: "INVALID_BODY",
        },
      ],
    };
  }

  /* --------------------------------------------------------
     Validate trusted country
     -------------------------------------------------------- */

  const country =
    normalizeAccountCountry(
      countryInput
    );

  if (!country) {
    return {
      success: false,
      data: null,
      changedFields: [],
      requiresPhoneVerification: false,
      phoneVerificationValue: null,
      issues: [
        {
          field: "countryCode",
          code: "UNSUPPORTED_COUNTRY",
        },
      ],
    };
  }

  const entries =
    Object.entries(input);

  if (entries.length === 0) {
    return {
      success: false,
      data: null,
      changedFields: [],
      requiresPhoneVerification: false,
      phoneVerificationValue: null,
      issues: [
        {
          field: "body",
          code: "EMPTY_UPDATE",
        },
      ],
    };
  }

  /* --------------------------------------------------------
     Reject forbidden and unexpected keys.

     This includes:
     id
     userId
     email
     countryCode
     password
     role
     isAdmin
     emailVerified
     phoneVerified
     createdAt
     updatedAt

     Any other unrecognized key is
     also rejected.
     -------------------------------------------------------- */

  const issues:
    AccountValidationIssue[] = [];

  for (
    const [field]
    of entries
  ) {
    if (
      !EDITABLE_FIELD_SET.has(
        field
      )
    ) {
      issues.push({
        field,
        code: "UNKNOWN_FIELD",
      });
    }
  }

  /* --------------------------------------------------------
     Validate allowed fields
     -------------------------------------------------------- */

  const normalizedData:
    AccountProfilePatch = {};

  const changedFields:
    AccountEditableField[] = [];

  for (
    const field
    of ACCOUNT_EDITABLE_FIELDS
  ) {
    if (
      !Object.prototype.hasOwnProperty.call(
        input,
        field
      )
    ) {
      continue;
    }

    const checked =
      validateAccountField(
        field,
        input[field],
        country
      );

    if (!checked.success) {
      issues.push({
        field,
        code: checked.code,
      });

      continue;
    }

    const currentValue =
      currentProfile?.[field];

    /*
     * Compare normalized values to avoid
     * unnecessary database updates.
     */

    let normalizedCurrent:
      string | undefined;

    if (
      typeof currentValue === "string"
    ) {
      normalizedCurrent =
        field === "phoneE164"
          ? normalizeAccountPhone(
              currentValue
            )
          : normalizeAccountText(
              currentValue
            );
    }

    if (
      normalizedCurrent ===
      checked.value
    ) {
      continue;
    }

    normalizedData[field] =
      checked.value;

    changedFields.push(field);
  }

  /* --------------------------------------------------------
     Fail atomically.

     Never return partial data if
     any field is invalid.
     -------------------------------------------------------- */

  if (issues.length > 0) {
    return {
      success: false,
      data: null,
      changedFields: [],
      requiresPhoneVerification: false,
      phoneVerificationValue: null,
      issues,
    };
  }

  /* --------------------------------------------------------
     No changes after normalization.

     Valid no-op: useful when the
     user clicks Save without edits.
     -------------------------------------------------------- */

  if (changedFields.length === 0) {
    return {
      success: true,
      data: {},
      changedFields: [],
      requiresPhoneVerification: false,
      phoneVerificationValue: null,
      issues: [],
    };
  }

  /* --------------------------------------------------------
     New phone verification requirement

     A changed number must be verified
     independently by SMS.

     NEVER mark the new phone as verified
     inside this function.
     -------------------------------------------------------- */

  const requiresPhoneVerification =
    changedFields.includes(
      "phoneE164"
    );

  const phoneVerificationValue =
    requiresPhoneVerification
      ? normalizedData.phoneE164 ??
        null
      : null;

  return {
    success: true,
    data: normalizedData,
    changedFields,
    requiresPhoneVerification,
    phoneVerificationValue,
    issues: [],
  };
}

/* ============================================================
   17. LEGACY / DATABASE FIELD MAPPING

   Optional helper:
   Pick only allowed profile fields.

   This is safe for API responses
   that need an editable profile.

   Do not pass complete Prisma user
   records directly to the browser.
   ============================================================ */

export function pickEditableAccountFields(
  profile: Readonly<AccountProfilePatch>
): AccountProfilePatch {
  const result:
    AccountProfilePatch = {};

  for (
    const field
    of ACCOUNT_EDITABLE_FIELDS
  ) {
    const value =
      profile[field];

    if (
      typeof value === "string"
    ) {
      result[field] = value;
    }
  }

  return result;
}

/* ============================================================
   18. CHECK WHETHER A FIELD IS EDITABLE
   ============================================================ */

export function isEditableAccountField(
  field: string
): field is AccountEditableField {
  return EDITABLE_FIELD_SET.has(
    field
  );
}

/* ============================================================
   19. PUBLIC ERROR MESSAGE KEYS

   The frontend should translate these
   codes using the project's existing
   four-language i18n system.

   Do not hardcode a single language
   inside server-side validation.
   ============================================================ */

export const ACCOUNT_ERROR_TRANSLATION_KEYS:
  Record<AccountValidationCode, string> = {
    INVALID_BODY:
      "account.validation.invalidBody",

    EMPTY_UPDATE:
      "account.validation.emptyUpdate",

    UNKNOWN_FIELD:
      "account.validation.unknownField",

    INVALID_TYPE:
      "account.validation.invalidType",

    REQUIRED:
      "account.validation.required",

    TOO_SHORT:
      "account.validation.tooShort",

    TOO_LONG:
      "account.validation.tooLong",

    INVALID_CHARACTERS:
      "account.validation.invalidCharacters",

    INVALID_PHONE:
      "account.validation.invalidPhone",

    INVALID_POSTAL_CODE:
      "account.validation.invalidPostalCode",

    UNSUPPORTED_COUNTRY:
      "account.validation.unsupportedCountry",
  };

/* ============================================================
   END — FAHRSCHULE TAYM ACCOUNT VALIDATION
   ============================================================ */
