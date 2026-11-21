
import "server-only";

import {
  randomUUID,
} from "node:crypto";

import {
  Pool,
  type PoolClient,
} from "pg";

import {
  ApplicationValidationError,
  normalizeApplicationLocale,
  normalizeApplicationCountry,
  getApplicationErrorMessage,
  findAvailableLicenseOffering,
  validateApplicationDraft,
  validateApplicationSubmission,
  assertApplicationEditable,
  isValidUuid,
  isLicenseCategory,
  isApplicationDocumentType,
  isValidDocumentSize,
  isAllowedDocumentMimeType,
  type ApplicationCountry,
  type ApplicationLocale,
  type ApplicationFormInput,
  type ApplicationErrorCode,
  type ApplicationPricing,
  type ApplicationDocumentType,
  type AuthenticatedApplicationCandidate,
  type TrustedApplicationDocument,
  type TrustedLicenseOffering,
  type AdmissionReviewIssue,
  type LicenseCategory,
  type ValidatedApplicationData,
} from "@/lib/applications/validation";

import {
  enqueueApplicationSubmissionEmails,
  type ApplicationEmailSnapshot,
} from "@/lib/applications/email";

import {
  getCountryLicenseConfiguration,
  getCountryLicenseOfferings,
} from "@/config/driving-licenses";

/* ============================================================
   FAHRSCHULE TAYM

   File:
   src/lib/applications/application.ts

   LICENSE APPLICATION SERVICE

   Database:
   PostgreSQL / Supabase

   Countries:
   DE — Germany
   AT — Austria
   BE — Belgium
   IT — Italy
   ES — Spain

   Languages:
   DE — German
   AR — Arabic
   TR — Turkish
   ES — Spanish

   Responsibilities:
   - Authenticate candidate
   - Read personal information
   - Read country configuration
   - Read license categories and prices
   - Create application drafts
   - Save application drafts
   - Retrieve application documents
   - Manage application revisions
   - Validate final submission
   - Persist final pricing
   - Record application status history
   - Persist candidate and admin emails
   - Prevent duplicate submissions

   No UI.
   No navigation.
   No additional layout.
   ============================================================ */

/* ============================================================
   1. APPLICATION CONFIGURATION
   ============================================================ */

const DATABASE_CONNECTION_TIMEOUT_MS =
  10_000;

const DATABASE_IDLE_TIMEOUT_MS =
  30_000;

const DATABASE_MAX_CONNECTIONS = 5;

const INITIAL_APPLICATION_REVISION = 0;

const APPLICATION_CURRENCY =
  "EUR" as const;

/*
 * Version of the confirmation displayed
 * in the application form.
 *
 * Update when the actual confirmation
 * text or applicable privacy notice changes.
 */

const APPLICATION_CONFIRMATION_VERSION =
  "2026-11-v1";

/* ============================================================
   2. APPLICATION STATUS
   ============================================================ */

export type LicenseApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "DOCUMENTS_REQUIRED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

const SUBMITTED_APPLICATION_STATUSES =
  new Set<string>([
    "SUBMITTED",
    "UNDER_REVIEW",
    "DOCUMENTS_REQUIRED",
    "APPROVED",
    "REJECTED",
    "CANCELLED",
  ]);

/* ============================================================
   3. SERVICE ERROR TYPES
   ============================================================ */

export type ApplicationServiceErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_SESSION"
  | "ACCOUNT_UNAVAILABLE"
  | "ACCOUNT_NOT_VERIFIED"
  | "UNSUPPORTED_COUNTRY"
  | "APPLICATION_NOT_FOUND"
  | "APPLICATION_ACCESS_DENIED"
  | "INVALID_APPLICATION_STATE"
  | "APPLICATION_CONFLICT"
  | "REVISION_CONFLICT"
  | "PRICE_CHANGED"
  | "PRICING_UNAVAILABLE"
  | "DOCUMENT_NOT_READY"
  | "DATABASE_UNAVAILABLE"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export class ApplicationServiceError
  extends Error {
  readonly code:
    ApplicationServiceErrorCode;

  readonly status: number;

  constructor(
    code: ApplicationServiceErrorCode,

    status = 400
  ) {
    super(code);

    this.name =
      "ApplicationServiceError";

    this.code = code;

    this.status = status;
  }
}

/* ============================================================
   4. LOCALIZED CONFIGURATION TYPES

   Contract expected from:

   src/config/driving-licenses.ts
   ============================================================ */

export type LocalizedApplicationText =
  Record<ApplicationLocale, string>;

export type LicenseCategoryConfiguration = {
  category: LicenseCategory;

  enabled: boolean;

  pricingApproved: boolean;

  name: LocalizedApplicationText;

  description: LocalizedApplicationText;

  imagePath: string | null;

  minimumAge: number | null;

  currency: "EUR";

  trainingPriceCents: number;

  registrationFeeCents: number | null;

  pricingVersion: string;
};

export type ApplicationCountryConfiguration = {
  countryCode: ApplicationCountry;

  currency: "EUR";

  registrationFeeCents: number | null;

  categories:
    LicenseCategoryConfiguration[];
};

/* ============================================================
   5. AUTHENTICATED CANDIDATE RECORD
   ============================================================ */

export type ApplicationCandidateRecord = {
  userId: string;

  firstName: string;

  lastName: string;

  fullName: string;

  email: string;

  phoneE164: string;

  countryCode: ApplicationCountry;

  emailVerified: boolean;

  phoneVerified: boolean;
};

/* ============================================================
   6. APPLICATION DOCUMENT RECORD
   ============================================================ */

export type ApplicationDocumentRecord =
  TrustedApplicationDocument & {
    createdAt: string;

    updatedAt: string;
  };

/* ============================================================
   7. APPLICATION RECORD

   This structure matches:

   src/app/api/dashboard/application/route.ts
   ============================================================ */

export type LicenseApplicationRecord = {
  id: string;

  reference: string | null;

  status: string;

  countryCode: ApplicationCountry;

  category: LicenseCategory | null;

  residentialAddress: string | null;

  postalCode: string | null;

  city: string | null;

  confirmedInformation: boolean;

  acceptedDocumentProcessing: boolean;

  pricing: ApplicationPricing | null;

  admissionReviewRequired: boolean;

  admissionReviewIssues:
    AdmissionReviewIssue[];

  documents:
    ApplicationDocumentRecord[];

  createdAt: string;

  updatedAt: string;

  submittedAt: string | null;

  revision: number;
};

/* ============================================================
   8. PAGE DATA RECORD
   ============================================================ */

export type CandidateApplicationPage = {
  candidate:
    ApplicationCandidateRecord;

  country:
    ApplicationCountryConfiguration;

  application:
    LicenseApplicationRecord | null;

  lastUpdatedAt: string;
};

/* ============================================================
   9. AUTHENTICATED REQUEST TYPES

   User and session identifiers
   must come from requireCandidateSession().
   ============================================================ */

type AuthenticatedServiceInput = {
  authenticatedUserId: string;

  authenticatedSessionId: string;

  locale?: ApplicationLocale;
};

export type GetCandidateApplicationPageInput =
  AuthenticatedServiceInput & {
    applicationId?: string | null;
  };

export type SaveCandidateApplicationDraftInput =
  AuthenticatedServiceInput & {
    applicationId: string | null;

    expectedRevision: number | null;

    form: ApplicationFormInput;
  };

export type SaveCandidateApplicationDraftResult = {
  created: boolean;

  page: CandidateApplicationPage;
};

export type SubmitLicenseApplicationInput =
  AuthenticatedServiceInput & {
    applicationId: string;

    expectedPricingVersion: string;

    form: ApplicationFormInput;
  };

/* ============================================================
   10. FINAL SUBMISSION RESULT

   Exact contract used by:

   src/app/api/dashboard/application/submit/route.ts
   ============================================================ */

export type SubmitLicenseApplicationResult = {
  applicationId: string;

  reference: string;

  status: string;

  alreadySubmitted: boolean;

  submittedAt: string;

  countryCode: ApplicationCountry;

  category: string;

  pricing: ApplicationPricing;

  admissionReviewRequired: boolean;

  documentCount: number;
};

/* ============================================================
   11. DATABASE ROW TYPES
   ============================================================ */

type CandidateDatabaseRow = {
  user_id: string;

  first_name: string;

  last_name: string;

  full_name: string;

  email: string;

  phone_e164: string;

  country_code: string;

  role: string;

  status: string;

  email_verified_at: Date | string | null;

  phone_verified_at: Date | string | null;
};

type ApplicationDatabaseRow = {
  id: string;

  user_id: string;

  reference: string | null;

  status: string;

  country_code: string;

  category: string | null;

  residential_address: string | null;

  postal_code: string | null;

  city: string | null;

  confirmed_information: boolean;

  accepted_document_processing: boolean;

  currency: string | null;

  training_price_cents: number | null;

  registration_fee_cents: number | null;

  total_price_cents: number | null;

  pricing_version: string | null;

  admission_review_required: boolean;

  admission_review_issues: unknown;

  document_count: number;

  locale: string;

  revision: number;

  created_at: Date | string;

  updated_at: Date | string;

  submitted_at: Date | string | null;
};

type DocumentDatabaseRow = {
  id: string;

  application_id: string;

  user_id: string;

  type: ApplicationDocumentType;

  storage_key: string;

  file_name: string;

  mime_type: string;

  size_bytes: number | string;

  upload_status:
    TrustedApplicationDocument["uploadStatus"];

  security_status:
    TrustedApplicationDocument["securityStatus"];

  review_status:
    TrustedApplicationDocument["reviewStatus"];

  created_at: Date | string;

  updated_at: Date | string;
};

/* ============================================================
   12. SHARED POSTGRESQL POOL

   Reuses the same global pool as:
   - Authentication
   - Password reset
   - Documents
   - Emails
   ============================================================ */

const globalForApplications =
  globalThis as typeof globalThis & {
    taymResendPool?: Pool;
  };

function getDatabasePool(): Pool {
  if (
    globalForApplications
      .taymResendPool
  ) {
    return globalForApplications
      .taymResendPool;
  }

  const databaseUrl =
    process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new ApplicationServiceError(
      "DATABASE_UNAVAILABLE",

      503
    );
  }

  const pool = new Pool({
    connectionString:
      databaseUrl,

    max:
      DATABASE_MAX_CONNECTIONS,

    min: 0,

    idleTimeoutMillis:
      DATABASE_IDLE_TIMEOUT_MS,

    connectionTimeoutMillis:
      DATABASE_CONNECTION_TIMEOUT_MS,

    allowExitOnIdle: false,
  });

  pool.on("error", () => {
    console.error(
      "[TAYM][APPLICATION][DATABASE_POOL]"
    );
  });

  globalForApplications
    .taymResendPool = pool;

  return pool;
}

/* ============================================================
   13. DATABASE TRANSACTION

   Every write is transactional.

   Application documents and final
   submission use the same locking order:

   Candidate -> Application -> Documents
   ============================================================ */

async function withTransaction<T>(
  callback: (
    client: PoolClient
  ) => Promise<T>,

  readOnly = false
): Promise<T> {
  const pool =
    getDatabasePool();

  const client =
    await pool.connect();

  let destroyConnection = false;

  try {
    await client.query(
      readOnly

        ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"

        : "BEGIN"
    );

    await client.query(
      "SET LOCAL lock_timeout = '10s'"
    );

    await client.query(
      "SET LOCAL statement_timeout = '30s'"
    );

    const result =
      await callback(client);

    await client.query("COMMIT");

    return result;

  } catch (error: unknown) {
    try {
      await client.query("ROLLBACK");

    } catch {
      destroyConnection = true;
    }

    throw error;

  } finally {
    client.release(
      destroyConnection
    );
  }
}

/* ============================================================
   14. LOCALIZED VALIDATION ERROR
   ============================================================ */

function throwLocalizedValidationError(
  code: ApplicationErrorCode,

  field: string,

  locale: ApplicationLocale,

  status = 400
): never {
  throw new ApplicationValidationError(
    [
      {
        code,

        field,

        message:
          getApplicationErrorMessage(
            code,

            locale
          ),
      },
    ],

    status
  );
}

/* ============================================================
   15. DATE SERIALIZATION
   ============================================================ */

function toIsoDate(
  value: Date | string
): string {
  const date =
    value instanceof Date

      ? value

      : new Date(value);

  if (
    !Number.isFinite(
      date.getTime()
    )
  ) {
    throw new ApplicationServiceError(
      "INTERNAL_ERROR",

      500
    );
  }

  return date.toISOString();
}

function toNullableIsoDate(
  value: Date | string | null
): string | null {
  return value === null

    ? null

    : toIsoDate(value);
}

/* ============================================================
   16. AUTHENTICATED DATABASE CANDIDATE

   Rechecks actual session and account.

   Country is read from the user account,
   never from browser-supplied data.
   ============================================================ */

async function requireCandidate(
  client: PoolClient,

  input: AuthenticatedServiceInput,

  lock = false
): Promise<AuthenticatedApplicationCandidate> {
  if (
    !isValidUuid(
      input.authenticatedUserId
    ) ||

    !isValidUuid(
      input.authenticatedSessionId
    )
  ) {
    throw new ApplicationServiceError(
      "UNAUTHORIZED",

      401
    );
  }

  const result =
    await client.query<CandidateDatabaseRow>(
      `
        SELECT
          u.id AS user_id,

          u.first_name,

          u.last_name,

          u.full_name,

          u.email,

          u.phone_e164,

          u.country_code,

          u.role,

          u.status,

          u.email_verified_at,

          u.phone_verified_at

        FROM users AS u

        INNER JOIN user_sessions AS s

          ON s.user_id = u.id

        WHERE u.id = $1::uuid

          AND s.id = $2::uuid

          AND s.revoked_at IS NULL

          AND s.expires_at > clock_timestamp()

        LIMIT 1

        ${lock ? "FOR UPDATE OF u, s" : ""}
      `,

      [
        input.authenticatedUserId,

        input.authenticatedSessionId,
      ]
    );

  const row =
    result.rows[0];

  if (!row) {
    throw new ApplicationServiceError(
      "UNAUTHORIZED",

      401
    );
  }

  if (
    row.role !== "CANDIDATE" ||

    row.status !== "ACTIVE"
  ) {
    throw new ApplicationServiceError(
      "ACCOUNT_UNAVAILABLE",

      403
    );
  }

  if (
    row.email_verified_at === null
  ) {
    throw new ApplicationServiceError(
      "ACCOUNT_NOT_VERIFIED",

      403
    );
  }

  const countryCode =
    normalizeApplicationCountry(
      row.country_code
    );

  if (!countryCode) {
    throw new ApplicationServiceError(
      "UNSUPPORTED_COUNTRY",

      403
    );
  }

  return {
    userId:
      row.user_id,

    firstName:
      row.first_name,

    lastName:
      row.last_name,

    fullName:
      row.full_name,

    email:
      row.email,

    phoneE164:
      row.phone_e164,

    countryCode,

    role:
      row.role,

    status:
      row.status,

    emailVerified:
      row.email_verified_at !== null,

    phoneVerified:
      row.phone_verified_at !== null,
  };
}

/* ============================================================
   17. CANDIDATE PUBLIC RECORD
   ============================================================ */

function mapCandidate(
  candidate: AuthenticatedApplicationCandidate
): ApplicationCandidateRecord {
  const countryCode =
    normalizeApplicationCountry(
      candidate.countryCode
    );

  if (!countryCode) {
    throw new ApplicationServiceError(
      "UNSUPPORTED_COUNTRY",

      403
    );
  }

  const firstName =
    candidate.firstName.trim();

  const lastName =
    candidate.lastName.trim();

  return {
    userId:
      candidate.userId,

    firstName,

    lastName,

    fullName:
      `${firstName} ${lastName}`,

    email:
      candidate.email
        .trim()
        .toLowerCase(),

    phoneE164:
      candidate.phoneE164,

    countryCode,

    emailVerified:
      candidate.emailVerified,

    phoneVerified:
      candidate.phoneVerified,
  };
}

/* ============================================================
   18. TRUSTED COUNTRY CONFIGURATION

   Prices and categories come from
   the server-side configuration.

   No price duplication in this module.
   ============================================================ */

function loadCountryConfiguration(
  countryCode: ApplicationCountry
): {
  country:
    ApplicationCountryConfiguration;

  offerings:
    readonly TrustedLicenseOffering[];
} {
  const country:
    ApplicationCountryConfiguration =
      getCountryLicenseConfiguration(
        countryCode
      );

  const offerings:
    readonly TrustedLicenseOffering[] =
      getCountryLicenseOfferings(
        countryCode
      );

  if (
    !country ||

    country.countryCode !==
      countryCode ||

    country.currency !==
      APPLICATION_CURRENCY ||

    !Array.isArray(
      country.categories
    ) ||

    !Array.isArray(
      offerings
    ) ||

    offerings.some(
      (offering) =>

        offering.countryCode !==
          countryCode
    )
  ) {
    throw new ApplicationServiceError(
      "SERVICE_UNAVAILABLE",

      503
    );
  }

  const categories =
    new Set<string>();

  for (
    const item
    of country.categories
  ) {
    if (
      !isLicenseCategory(
        item.category
      ) ||

      categories.has(
        item.category
      )
    ) {
      throw new ApplicationServiceError(
        "SERVICE_UNAVAILABLE",

        503
      );
    }

    categories.add(item.category);

    const matching =
      offerings.filter(
        (offering) =>

          offering.category ===
            item.category
      );

    if (matching.length !== 1) {
      throw new ApplicationServiceError(
        "SERVICE_UNAVAILABLE",

        503
      );
    }

    const offering =
      matching[0];

    /*
     * Ensure public display and
     * server validation use the same prices.
     */

    if (
      item.enabled !==
        offering.enabled ||

      item.pricingApproved !==
        offering.pricingApproved ||

      item.trainingPriceCents !==
        offering.trainingPriceCents ||

      item.registrationFeeCents !==
        offering.registrationFeeCents ||

      item.pricingVersion !==
        offering.pricingVersion ||

      item.currency !==
        offering.currency ||

      item.registrationFeeCents !==
        country.registrationFeeCents
    ) {
      throw new ApplicationServiceError(
        "SERVICE_UNAVAILABLE",

        503
      );
    }
  }

  return {
    country,

    offerings,
  };
}

/* ============================================================
   19. OWNED APPLICATION LOOKUP

   Ensures the application belongs to
   the authenticated candidate.
   ============================================================ */

async function findOwnedApplication(
  client: PoolClient,

  applicationId: string,

  userId: string,

  countryCode: ApplicationCountry,

  lock = false
): Promise<ApplicationDatabaseRow | null> {
  if (
    !isValidUuid(applicationId)
  ) {
    return null;
  }

  const result =
    await client.query<ApplicationDatabaseRow>(
      `
        SELECT *

        FROM license_applications

        WHERE id = $1::uuid

          AND user_id = $2::uuid

          AND country_code = $3

        LIMIT 1

        ${lock ? "FOR UPDATE" : ""}
      `,

      [
        applicationId,

        userId,

        countryCode,
      ]
    );

  return result.rows[0] ?? null;
}

async function requireOwnedApplication(
  client: PoolClient,

  applicationId: string,

  userId: string,

  countryCode: ApplicationCountry,

  lock = false
): Promise<ApplicationDatabaseRow> {
  const application =
    await findOwnedApplication(
      client,

      applicationId,

      userId,

      countryCode,

      lock
    );

  if (!application) {
    throw new ApplicationServiceError(
      "APPLICATION_NOT_FOUND",

      404
    );
  }

  return application;
}

/* ============================================================
   20. FIND CURRENT DRAFT
   ============================================================ */

async function findCurrentDraft(
  client: PoolClient,

  userId: string,

  countryCode: ApplicationCountry,

  lock = false
): Promise<ApplicationDatabaseRow | null> {
  const result =
    await client.query<ApplicationDatabaseRow>(
      `
        SELECT *

        FROM license_applications

        WHERE user_id = $1::uuid

          AND country_code = $2

          AND status = 'DRAFT'

        ORDER BY

          updated_at DESC,

          id DESC

        LIMIT 2

        ${lock ? "FOR UPDATE" : ""}
      `,

      [
        userId,

        countryCode,
      ]
    );

  /*
   * Existing duplicate drafts indicate
   * inconsistent database state.
   *
   * Never silently select or delete
   * an arbitrary duplicate.
   */

  if (result.rows.length > 1) {
    throw new ApplicationServiceError(
      "APPLICATION_CONFLICT",

      409
    );
  }

  return result.rows[0] ?? null;
}

/* ============================================================
   21. FIND MOST RECENT APPLICATION

   Used when no draft exists.

   Allows the candidate to retrieve
   their previously submitted dossier.
   ============================================================ */

async function findLatestApplication(
  client: PoolClient,

  userId: string,

  countryCode: ApplicationCountry
): Promise<ApplicationDatabaseRow | null> {
  const result =
    await client.query<ApplicationDatabaseRow>(
      `
        SELECT *

        FROM license_applications

        WHERE user_id = $1::uuid

          AND country_code = $2

          AND submitted_at IS NOT NULL

        ORDER BY

          submitted_at DESC,

          created_at DESC,

          id DESC

        LIMIT 1
      `,

      [
        userId,

        countryCode,
      ]
    );

  return result.rows[0] ?? null;
}

/* ============================================================
   22. READ APPLICATION DOCUMENTS

   Uses the same transaction as the
   application lookup and submission.

   No separate nested database transaction.
   ============================================================ */

async function readApplicationDocuments(
  client: PoolClient,

  applicationId: string,

  userId: string,

  lock = false
): Promise<ApplicationDocumentRecord[]> {
  const result =
    await client.query<DocumentDatabaseRow>(
      `
        SELECT
          d.id,

          d.application_id,

          d.user_id,

          d.type,

          d.storage_key,

          d.file_name,

          d.mime_type,

          d.size_bytes,

          d.upload_status,

          d.security_status,

          d.review_status,

          d.created_at,

          d.updated_at

        FROM candidate_documents AS d

        INNER JOIN license_applications AS a

          ON a.id = d.application_id

          AND a.user_id = d.user_id

        WHERE d.application_id = $1::uuid

          AND d.user_id = $2::uuid

          AND d.upload_status <> 'DELETED'

        ORDER BY

          d.created_at ASC,

          d.id ASC

        ${lock ? "FOR UPDATE OF d" : ""}
      `,

      [
        applicationId,

        userId,
      ]
    );

  return result.rows.map(
    (row) => {
      const sizeBytes =
        Number(row.size_bytes);

      if (
        !isValidUuid(row.id) ||

        row.application_id !==
          applicationId ||

        row.user_id !== userId ||

        !isApplicationDocumentType(
          row.type
        ) ||

        !isValidDocumentSize(
          sizeBytes
        ) ||

        !isAllowedDocumentMimeType(
          row.type,

          row.mime_type
        )
      ) {
        throw new ApplicationServiceError(
          "SERVICE_UNAVAILABLE",

          503
        );
      }

      return {
        id:
          row.id,

        applicationId:
          row.application_id,

        userId:
          row.user_id,

        type:
          row.type,

        storageKey:
          row.storage_key,

        fileName:
          row.file_name,

        mimeType:
          row.mime_type,

        sizeBytes,

        uploadStatus:
          row.upload_status,

        securityStatus:
          row.security_status,

        reviewStatus:
          row.review_status,

        createdAt:
          toIsoDate(
            row.created_at
          ),

        updatedAt:
          toIsoDate(
            row.updated_at
          ),
      };
    }
  );
}

/* ============================================================
   23. PERSISTED PRICING SNAPSHOT

   Historical submitted prices never
   change when the catalog is updated.
   ============================================================ */

function readPersistedPricing(
  row: ApplicationDatabaseRow
): ApplicationPricing | null {
  const values = [
    row.training_price_cents,

    row.registration_fee_cents,

    row.total_price_cents,

    row.pricing_version,
  ];

  if (
    values.every(
      (value) => value === null
    )
  ) {
    return null;
  }

  if (
    row.currency !== "EUR" ||

    typeof row.training_price_cents !==
      "number" ||

    typeof row.registration_fee_cents !==
      "number" ||

    typeof row.total_price_cents !==
      "number" ||

    !Number.isSafeInteger(
      row.training_price_cents
    ) ||

    !Number.isSafeInteger(
      row.registration_fee_cents
    ) ||

    !Number.isSafeInteger(
      row.total_price_cents
    ) ||

    row.training_price_cents <= 0 ||

    row.registration_fee_cents < 0 ||

    typeof row.pricing_version !==
      "string" ||

    row.pricing_version.length === 0 ||

    row.total_price_cents !==

      row.training_price_cents +
      row.registration_fee_cents
  ) {
    throw new ApplicationServiceError(
      "SERVICE_UNAVAILABLE",

      503
    );
  }

  return {
    currency: "EUR",

    trainingPriceCents:
      row.training_price_cents,

    registrationFeeCents:
      row.registration_fee_cents,

    totalPriceCents:
      row.total_price_cents,

    pricingVersion:
      row.pricing_version,
  };
}

/* ============================================================
   24. ADMISSION REVIEW RECORDS
   ============================================================ */

const ADMISSION_REVIEW_CODES =
  new Set<string>([
    "AGE_REVIEW_REQUIRED",

    "MINIMUM_AGE_REVIEW_REQUIRED",

    "EXISTING_LICENSE_REVIEW_REQUIRED",

    "HABITUAL_RESIDENCE_REVIEW_REQUIRED",

    "MEDICAL_REVIEW_REQUIRED",

    "VISION_REVIEW_REQUIRED",

    "FIRST_AID_REVIEW_REQUIRED",

    "PROFESSIONAL_QUALIFICATION_REVIEW_REQUIRED",

    "ADDITIONAL_DOCUMENT_REVIEW_REQUIRED",

    "MANUAL_ADMISSION_REVIEW_REQUIRED",
  ]);

function readAdmissionReviewIssues(
  value: unknown
): AdmissionReviewIssue[] {
  if (value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new ApplicationServiceError(
      "SERVICE_UNAVAILABLE",

      503
    );
  }

  return value.map(
    (item: unknown) => {
      if (
        !item ||

        typeof item !== "object" ||

        !("code" in item) ||

        typeof item.code !== "string" ||

        !ADMISSION_REVIEW_CODES.has(
          item.code
        )
      ) {
        throw new ApplicationServiceError(
          "SERVICE_UNAVAILABLE",

          503
        );
      }

      const code =
        item.code as
          AdmissionReviewIssue["code"];

      if (
        "documentType" in item &&

        item.documentType !== undefined
      ) {
        if (
          !isApplicationDocumentType(
            item.documentType
          )
        ) {
          throw new ApplicationServiceError(
            "SERVICE_UNAVAILABLE",

            503
          );
        }

        return {
          code,

          documentType:
            item.documentType,
        };
      }

      return {
        code,
      };
    }
  );
}

/* ============================================================
   25. MAP APPLICATION DATABASE RECORD
   ============================================================ */

function mapApplication(
  row: ApplicationDatabaseRow,

  documents:
    ApplicationDocumentRecord[]
): LicenseApplicationRecord {
  const countryCode =
    normalizeApplicationCountry(
      row.country_code
    );

  if (
    !countryCode ||

    !isValidUuid(row.id) ||

    !Number.isSafeInteger(row.revision) ||

    row.revision < 0 ||

    (
      row.category !== null &&

      !isLicenseCategory(
        row.category
      )
    )
  ) {
    throw new ApplicationServiceError(
      "SERVICE_UNAVAILABLE",

      503
    );
  }

  const category =
    row.category !== null &&

    isLicenseCategory(row.category)

      ? row.category

      : null;

  return {
    id:
      row.id,

    reference:
      row.reference,

    status:
      row.status,

    countryCode,

    category,

    residentialAddress:
      row.residential_address,

    postalCode:
      row.postal_code,

    city:
      row.city,

    confirmedInformation:
      row.confirmed_information,

    acceptedDocumentProcessing:
      row.accepted_document_processing,

    pricing:
      readPersistedPricing(row),

    admissionReviewRequired:
      row.admission_review_required,

    admissionReviewIssues:
      readAdmissionReviewIssues(
        row.admission_review_issues
      ),

    documents,

    createdAt:
      toIsoDate(row.created_at),

    updatedAt:
      toIsoDate(row.updated_at),

    submittedAt:
      toNullableIsoDate(
        row.submitted_at
      ),

    revision:
      row.revision,
  };
}

/* ============================================================
   26. BUILD AUTHENTICATED APPLICATION PAGE
   ============================================================ */

async function buildApplicationPage(
  client: PoolClient,

  candidate:
    AuthenticatedApplicationCandidate,

  country:
    ApplicationCountryConfiguration,

  application:
    ApplicationDatabaseRow | null
): Promise<CandidateApplicationPage> {
  let record:
    LicenseApplicationRecord | null =
      null;

  if (application) {
    const documents =
      await readApplicationDocuments(
        client,

        application.id,

        candidate.userId
      );

    record =
      mapApplication(
        application,

        documents
      );
  }

  return {
    candidate:
      mapCandidate(candidate),

    country,

    application:
      record,

    lastUpdatedAt:
      new Date().toISOString(),
  };
}

/* ============================================================
   27. GET APPLICATION PAGE

   Used by:

   GET /api/dashboard/application

   Returns:
   - Actual candidate information
   - Country configuration
   - Localized category configuration
   - Current application
   - Existing document metadata
   - Historical application prices

   GET does not create a draft.
   ============================================================ */

export async function getCandidateApplicationPage(
  input: GetCandidateApplicationPageInput
): Promise<CandidateApplicationPage> {
  return withTransaction(
    async (client) => {
      const candidate =
        await requireCandidate(
          client,

          input
        );

      const publicCandidate =
        mapCandidate(candidate);

      const configuration =
        loadCountryConfiguration(
          publicCandidate.countryCode
        );

      let application:
        ApplicationDatabaseRow | null =
          null;

      if (
        input.applicationId !== undefined &&

        input.applicationId !== null
      ) {
        application =
          await requireOwnedApplication(
            client,

            input.applicationId,

            candidate.userId,

            publicCandidate.countryCode
          );

      } else {
        application =
          await findCurrentDraft(
            client,

            candidate.userId,

            publicCandidate.countryCode
          );

        if (!application) {
          application =
            await findLatestApplication(
              client,

              candidate.userId,

              publicCandidate.countryCode
            );
        }
      }

      return buildApplicationPage(
        client,

        candidate,

        configuration.country,

        application
      );
    },

    true
  );
}

/* ============================================================
   28. EDITABLE APPLICATION FIELDS

   Only these fields can be updated
   by a candidate.
   ============================================================ */

const EDITABLE_APPLICATION_FIELDS = [
  "category",

  "residentialAddress",

  "postalCode",

  "city",

  "confirmedInformation",

  "acceptedDocumentProcessing",
] as const;

function assertEditableFormInput(
  input: unknown,

  locale: ApplicationLocale
): asserts input is ApplicationFormInput {
  if (
    !input ||

    typeof input !== "object" ||

    Array.isArray(input) ||

    Object.keys(input).some(
      (key) =>

        !(
          EDITABLE_APPLICATION_FIELDS as
            readonly string[]
        ).includes(key)
    )
  ) {
    throwLocalizedValidationError(
      "INVALID_INPUT",

      "application",

      locale
    );
  }
}

/* ============================================================
   29. MERGE EXISTING DRAFT

   PATCH changes only the editable
   fields explicitly supplied.
   ============================================================ */

function mergeDraftForm(
  row: ApplicationDatabaseRow | null,

  input: ApplicationFormInput
): ApplicationFormInput {
  const form: ApplicationFormInput = {
    category:
      row?.category ?? null,

    residentialAddress:
      row?.residential_address ?? null,

    postalCode:
      row?.postal_code ?? null,

    city:
      row?.city ?? null,

    confirmedInformation:
      row?.confirmed_information ?? false,

    acceptedDocumentProcessing:
      row?.accepted_document_processing ?? false,
  };

  for (
    const field
    of EDITABLE_APPLICATION_FIELDS
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        input,

        field
      )
    ) {
      form[field] = input[field];
    }
  }

  return form;
}

/* ============================================================
   30. CHECK WHETHER DOSSIER DATA CHANGED
   ============================================================ */

function hasMaterialApplicationChanges(
  row: ApplicationDatabaseRow,

  data: ValidatedApplicationData
): boolean {
  return (
    row.category !==
      data.category ||

    row.residential_address !==
      data.residentialAddress ||

    row.postal_code !==
      data.postalCode ||

    row.city !==
      data.city ||

    row.training_price_cents !==

      (
        data.pricing
          ?.trainingPriceCents ?? null
      ) ||

    row.registration_fee_cents !==

      (
        data.pricing
          ?.registrationFeeCents ?? null
      ) ||

    row.total_price_cents !==

      (
        data.pricing
          ?.totalPriceCents ?? null
      ) ||

    row.pricing_version !==

      (
        data.pricing
          ?.pricingVersion ?? null
      )
  );
}

/* ============================================================
   31. APPLICATION REFERENCE

   Uses the complete UUID to avoid
   collision-prone short references.

   Example:
   TAYM-DE-2026-4F23...32HEXCHARACTERS

   Database reference must also have
   a unique constraint.
   ============================================================ */

function createApplicationReference(
  applicationId: string,

  countryCode: ApplicationCountry,

  submittedAt: Date
): string {
  if (
    !isValidUuid(applicationId)
  ) {
    throw new ApplicationServiceError(
      "INTERNAL_ERROR",

      500
    );
  }

  return [

    "TAYM",

    countryCode,

    submittedAt.getUTCFullYear(),

    applicationId

      .replace(/-/g, "")

      .toUpperCase(),

  ].join("-");
}

/* ============================================================
   32. STATUS HISTORY

   Application history is written in
   the same transaction as the state change.
   ============================================================ */

async function recordApplicationStatus({
  client,

  applicationId,

  previousStatus,

  newStatus,

  changedByUserId,
}: {
  client: PoolClient;

  applicationId: string;

  previousStatus:
    LicenseApplicationStatus | null;

  newStatus:
    LicenseApplicationStatus;

  changedByUserId: string;
}): Promise<void> {
  await client.query(
    `
      INSERT INTO application_status_history (
        id,

        application_id,

        previous_status,

        new_status,

        changed_by_id,

        created_at
      )

      VALUES (
        $1::uuid,

        $2::uuid,

        $3,

        $4,

        $5::uuid,

        clock_timestamp()
      )
    `,

    [
      randomUUID(),

      applicationId,

      previousStatus,

      newStatus,

      changedByUserId,
    ]
  );
}

/* ============================================================
   33. CREATE APPLICATION DRAFT

   No email.
   No payment.
   No official submission.
   ============================================================ */

async function insertApplicationDraft({
  client,

  data,

  locale,
}: {
  client: PoolClient;

  data: ValidatedApplicationData;

  locale: ApplicationLocale;
}): Promise<ApplicationDatabaseRow> {
  const id =
    randomUUID();

  const pricing =
    data.pricing;

  const result =
    await client.query<ApplicationDatabaseRow>(
      `
        INSERT INTO license_applications (
          id,
          application_number, applicant_id, license_class, first_name, last_name, email, phone_e164,
          user_id,

          country_code,

          locale,

          status,

          category,

          residential_address,

          postal_code,

          city,

          confirmed_information,

          accepted_document_processing,

          currency,

          training_price_cents,

          registration_fee_cents,

          total_price_cents,

          pricing_version,

          admission_review_required,

          admission_review_issues,

          document_count,

          revision,

          created_at,

          updated_at
        )

        VALUES (
          $1::uuid,
          $17, $2::uuid, COALESCE($5, ''), $18, $19, $20, $21,
          $2::uuid,

          $3,

          $4,

          'DRAFT',

          $5,

          $6,

          $7,

          $8,

          FALSE,

          FALSE,

          $9,

          $10,

          $11,

          $12,

          $13,

          $14,

          $15::jsonb,

          0,

          $16,

          clock_timestamp(),

          clock_timestamp()
        )

        RETURNING *
      `,

      [
        id,

        data.candidate.userId,

        data.candidate.countryCode,

        locale,

        data.category,

        data.residentialAddress,

        data.postalCode,

        data.city,

        APPLICATION_CURRENCY,

        pricing
          ?.trainingPriceCents ?? null,

        pricing
          ?.registrationFeeCents ?? null,

        pricing
          ?.totalPriceCents ?? null,

        pricing
          ?.pricingVersion ?? null,

        data.admissionReviewRequired,

        JSON.stringify(
          data.admissionReviewIssues
        ),

        INITIAL_APPLICATION_REVISION,
        `DRAFT-${id.replaceAll("-", "")}`,
        data.candidate.firstName, data.candidate.lastName, data.candidate.email, data.candidate.phoneE164,
      ]
    );

  const application =
    result.rows[0];

  if (!application) {
    throw new ApplicationServiceError(
      "INTERNAL_ERROR",

      500
    );
  }

  await recordApplicationStatus({
    client,

    applicationId: id,

    previousStatus: null,

    newStatus: "DRAFT",

    changedByUserId:
      data.candidate.userId,
  });

  return application;
}

/* ============================================================
   34. UPDATE APPLICATION DRAFT

   Revision prevents overwriting changes
   made from another phone or computer.

   Material changes invalidate previously
   saved confirmations.
   ============================================================ */

async function updateApplicationDraft({
  client,

  application,

  data,

  locale,

  documentCount,
}: {
  client: PoolClient;

  application:
    ApplicationDatabaseRow;

  data:
    ValidatedApplicationData;

  locale: ApplicationLocale;

  documentCount: number;
}): Promise<ApplicationDatabaseRow> {
  const materialChanges =
    hasMaterialApplicationChanges(
      application,

      data
    );

  const confirmedInformation =
    materialChanges

      ? false

      : data.confirmedInformation;

  const acceptedDocumentProcessing =
    materialChanges

      ? false

      : data.acceptedDocumentProcessing;

  const pricing =
    data.pricing;

  const result =
    await client.query<ApplicationDatabaseRow>(
      `
        UPDATE license_applications

        SET

          category = $3::text,
          license_class = COALESCE($3::text, ''),

          residential_address = $4,

          postal_code = $5,

          city = $6,

          confirmed_information = $7,

          accepted_document_processing = $8,

          currency = $9,

          training_price_cents = $10,

          registration_fee_cents = $11,

          total_price_cents = $12,

          pricing_version = $13,

          admission_review_required = $14,

          admission_review_issues = $15::jsonb,

          locale = $16,

          document_count = $17,

          revision = revision + 1,

          updated_at = clock_timestamp()

        WHERE id = $1::uuid

          AND user_id = $2::uuid

          AND status = 'DRAFT'

          AND revision = $18

        RETURNING *
      `,

      [
        application.id,

        data.candidate.userId,

        data.category,

        data.residentialAddress,

        data.postalCode,

        data.city,

        confirmedInformation,

        acceptedDocumentProcessing,

        APPLICATION_CURRENCY,

        pricing
          ?.trainingPriceCents ?? null,

        pricing
          ?.registrationFeeCents ?? null,

        pricing
          ?.totalPriceCents ?? null,

        pricing
          ?.pricingVersion ?? null,

        data.admissionReviewRequired,

        JSON.stringify(
          data.admissionReviewIssues
        ),

        locale,

        documentCount,

        application.revision,
      ]
    );

  const updated =
    result.rows[0];

  if (!updated) {
    throw new ApplicationServiceError(
      "APPLICATION_CONFLICT",

      409
    );
  }

  return updated;
}

/* ============================================================
   35. SAVE CANDIDATE APPLICATION DRAFT

   Used by:

   POST  /api/dashboard/application
   PATCH /api/dashboard/application

   Supports:
   - First draft creation
   - Existing draft retrieval
   - Draft updates
   - Cross-device revision protection
   - Country-specific prices
   - Partial form updates
   ============================================================ */

export async function saveCandidateApplicationDraft(
  input: SaveCandidateApplicationDraftInput
): Promise<SaveCandidateApplicationDraftResult> {
  const locale =
    normalizeApplicationLocale(
      input.locale
    );

  assertEditableFormInput(
    input.form,

    locale
  );

  if (
    input.applicationId !== null &&

    !isValidUuid(input.applicationId)
  ) {
    throwLocalizedValidationError(
      "INVALID_INPUT",

      "applicationId",

      locale
    );
  }

  if (
    input.applicationId === null &&

    input.expectedRevision !== null
  ) {
    throwLocalizedValidationError(
      "INVALID_INPUT",

      "expectedRevision",

      locale
    );
  }

  return withTransaction(
    async (client) => {
      /*
       * Lock candidate first.
       *
       * Concurrent draft creation
       * requests cannot both proceed.
       */

      const candidate =
        await requireCandidate(
          client,

          input,

          true
        );

      const publicCandidate =
        mapCandidate(candidate);

      const countryCode =
        publicCandidate.countryCode;

      const configuration =
        loadCountryConfiguration(
          countryCode
        );

      /* ====================================================
         NEW DRAFT
         ==================================================== */

      if (
        input.applicationId === null
      ) {
        const existing =
          await findCurrentDraft(
            client,

            candidate.userId,

            countryCode,

            true
          );

        /*
         * Existing draft is returned
         * without overwriting its fields.
         */

        if (existing) {
          return {
            created: false,

            page:
              await buildApplicationPage(
                client,

                candidate,

                configuration.country,

                existing
              ),
          };
        }

        const initialForm =
          mergeDraftForm(
            null,

            input.form
          );

        const validated =
          validateApplicationDraft(
            initialForm,

            {
              candidate,

              offerings:
                configuration.offerings,

              documents: [],

              locale,
            }
          );

        const application =
          await insertApplicationDraft({
            client,

            data: validated,

            locale,
          });

        return {
          created: true,

          page:
            await buildApplicationPage(
              client,

              candidate,

              configuration.country,

              application
            ),
        };
      }

      /* ====================================================
         EXISTING DRAFT
         ==================================================== */

      if (
        typeof input.expectedRevision !==
          "number" ||

        !Number.isSafeInteger(
          input.expectedRevision
        ) ||

        input.expectedRevision < 0
      ) {
        throwLocalizedValidationError(
          "INVALID_INPUT",

          "expectedRevision",

          locale
        );
      }

      const application =
        await requireOwnedApplication(
          client,

          input.applicationId,

          candidate.userId,

          countryCode,

          true
        );

      assertApplicationEditable(
        application.status,

        locale
      );

      if (
        application.revision !==
          input.expectedRevision
      ) {
        throw new ApplicationServiceError(
          "APPLICATION_CONFLICT",

          409
        );
      }

      const documents =
        await readApplicationDocuments(
          client,

          application.id,

          candidate.userId,

          true
        );

      const mergedForm =
        mergeDraftForm(
          application,

          input.form
        );

      const validated =
        validateApplicationDraft(
          mergedForm,

          {
            candidate,

            offerings:
              configuration.offerings,

            applicationId:
              application.id,

            documents,

            locale,
          }
        );

      const updated =
        await updateApplicationDraft({
          client,

          application,

          data:
            validated,

          locale,

          documentCount:
            documents.length,
        });

      return {
        created: false,

        page:
          await buildApplicationPage(
            client,

            candidate,

            configuration.country,

            updated
          ),
      };
    }
  );
}

/* ============================================================
   36. VALID FINAL APPLICATION DATA

   Enforces non-null final fields
   before PostgreSQL submission.
   ============================================================ */

type CompleteApplicationData =
  ValidatedApplicationData & {
    category: LicenseCategory;

    residentialAddress: string;

    postalCode: string;

    city: string;

    pricing: ApplicationPricing;
  };

function assertCompleteApplicationData(
  data: ValidatedApplicationData,

  locale: ApplicationLocale
): asserts data is CompleteApplicationData {
  if (!data.category) {
    throwLocalizedValidationError(
      "CATEGORY_REQUIRED",

      "category",

      locale
    );
  }

  if (!data.residentialAddress) {
    throwLocalizedValidationError(
      "ADDRESS_REQUIRED",

      "residentialAddress",

      locale
    );
  }

  if (!data.postalCode) {
    throwLocalizedValidationError(
      "POSTAL_CODE_REQUIRED",

      "postalCode",

      locale
    );
  }

  if (!data.city) {
    throwLocalizedValidationError(
      "CITY_REQUIRED",

      "city",

      locale
    );
  }

  if (!data.pricing) {
    throwLocalizedValidationError(
      "PRICING_UNAVAILABLE",

      "pricing",

      locale,

      409
    );
  }

  if (
    data.confirmedInformation !== true
  ) {
    throwLocalizedValidationError(
      "INFORMATION_CONFIRMATION_REQUIRED",

      "confirmedInformation",

      locale
    );
  }

  if (
    data.acceptedDocumentProcessing !== true
  ) {
    throwLocalizedValidationError(
      "DOCUMENT_PROCESSING_REQUIRED",

      "acceptedDocumentProcessing",

      locale
    );
  }
}

/* ============================================================
   37. RECHECK SESSION BEFORE FINAL WRITE
   ============================================================ */

async function assertSessionStillActive(
  client: PoolClient,

  input: AuthenticatedServiceInput
): Promise<void> {
  const result =
    await client.query(
      `
        SELECT id

        FROM user_sessions

        WHERE id = $1::uuid

          AND user_id = $2::uuid

          AND revoked_at IS NULL

          AND expires_at > clock_timestamp()

        LIMIT 1
      `,

      [
        input.authenticatedSessionId,

        input.authenticatedUserId,
      ]
    );

  if (
    result.rowCount !== 1
  ) {
    throw new ApplicationServiceError(
      "UNAUTHORIZED",

      401
    );
  }
}

/* ============================================================
   38. CHECK PRICE VERSION

   If the tariff changed, the candidate
   must review and confirm the new amount.

   Pricing versions must change whenever
   prices or included services change.
   ============================================================ */

function assertPricingVersion(
  data: CompleteApplicationData,

  expectedPricingVersion: string
): void {
  if (
    typeof expectedPricingVersion !==
      "string" ||

    expectedPricingVersion.length === 0 ||

    expectedPricingVersion.length > 100 ||

    data.pricing.pricingVersion !==
      expectedPricingVersion
  ) {
    throw new ApplicationServiceError(
      "PRICE_CHANGED",

      409
    );
  }
}

/* ============================================================
   39. PERSIST FINAL APPLICATION

   - Store original pricing
   - Store identity snapshot
   - Record candidate confirmations
   - Store language
   - Record original submission time
   - Prevent later candidate modification
   ============================================================ */

async function persistFinalApplication({
  client,

  application,

  data,

  reference,

  submittedAt,

  locale,

  documentCount,
}: {
  client: PoolClient;

  application:
    ApplicationDatabaseRow;

  data:
    CompleteApplicationData;

  reference: string;

  submittedAt: Date;

  locale:
    ApplicationLocale;

  documentCount: number;
}): Promise<ApplicationDatabaseRow> {
  const identitySnapshot = {
    userId:
      data.candidate.userId,

    firstName:
      data.candidate.firstName,

    lastName:
      data.candidate.lastName,

    fullName:
      data.candidate.fullName,

    email:
      data.candidate.email,

    phoneE164:
      data.candidate.phoneE164,

    countryCode:
      data.candidate.countryCode,
  };

  const result =
    await client.query<ApplicationDatabaseRow>(
      `
        UPDATE license_applications

        SET

          reference = $3,
          application_number = $3,

          status = 'SUBMITTED',

          category = $4,
          license_class = $4,

          residential_address = $5,

          postal_code = $6,

          city = $7,

          currency = $8,

          training_price_cents = $9,

          registration_fee_cents = $10,

          total_price_cents = $11,

          pricing_version = $12,

          locale = $13,

          confirmed_information = TRUE,

          accepted_document_processing = TRUE,

          information_confirmed_at = $14,

          document_processing_accepted_at = $14,

          confirmation_version = $15,

          admission_review_required = $16,

          admission_review_issues = $17::jsonb,

          candidate_snapshot = $18::jsonb,

          document_count = $19,

          submitted_at = $14,

          updated_at = clock_timestamp(),

          revision = revision + 1

        WHERE id = $1::uuid

          AND user_id = $2::uuid

          AND status = 'DRAFT'

          AND revision = $20

        RETURNING *
      `,

      [
        application.id,

        data.candidate.userId,

        reference,

        data.category,

        data.residentialAddress,

        data.postalCode,

        data.city,

        data.pricing.currency,

        data.pricing.trainingPriceCents,

        data.pricing.registrationFeeCents,

        data.pricing.totalPriceCents,

        data.pricing.pricingVersion,

        locale,

        submittedAt,

        APPLICATION_CONFIRMATION_VERSION,

        data.admissionReviewRequired,

        JSON.stringify(
          data.admissionReviewIssues
        ),

        JSON.stringify(
          identitySnapshot
        ),

        documentCount,

        application.revision,
      ]
    );

  const submitted =
    result.rows[0];

  if (!submitted) {
    throw new ApplicationServiceError(
      "INVALID_APPLICATION_STATE",

      409
    );
  }

  return submitted;
}

/* ============================================================
   40. BUILD EMAIL SNAPSHOT

   Candidate and administrator emails
   use the actual submitted information.

   No document binary content or
   private storage keys are included.
   ============================================================ */

function buildApplicationEmailSnapshot({
  application,

  data,

  documents,

  locale,
}: {
  application:
    ApplicationDatabaseRow;

  data:
    CompleteApplicationData;

  documents:
    ApplicationDocumentRecord[];

  locale:
    ApplicationLocale;
}): ApplicationEmailSnapshot {
  if (
    !application.reference ||

    !application.submitted_at
  ) {
    throw new ApplicationServiceError(
      "INTERNAL_ERROR",

      500
    );
  }

  return {
    applicationId:
      application.id,

    reference:
      application.reference,

    submittedAt:
      toIsoDate(
        application.submitted_at
      ),

    locale,

    candidate: {
      userId:
        data.candidate.userId,

      firstName:
        data.candidate.firstName,

      lastName:
        data.candidate.lastName,

      fullName:
        data.candidate.fullName,

      email:
        data.candidate.email,

      phoneE164:
        data.candidate.phoneE164,

      countryCode:
        data.candidate.countryCode,
    },

    category:
      data.category,

    residentialAddress:
      data.residentialAddress,

    postalCode:
      data.postalCode,

    city:
      data.city,

    pricing:
      data.pricing,

    documents:
      documents.map(
        (document) => ({
          type:
            document.type,

          fileName:
            document.fileName,
        })
      ),

    confirmedInformation:
      data.confirmedInformation,

    acceptedDocumentProcessing:
      data.acceptedDocumentProcessing,

    admissionReviewRequired:
      data.admissionReviewRequired,
  };
}

/* ============================================================
   41. BUILD SUBMISSION RESULT

   Returns only committed application
   data and the historical price.
   ============================================================ */

function buildSubmissionResult(
  application: ApplicationDatabaseRow,

  alreadySubmitted: boolean
): SubmitLicenseApplicationResult {
  const countryCode =
    normalizeApplicationCountry(
      application.country_code
    );

  const pricing =
    readPersistedPricing(
      application
    );

  if (
    !countryCode ||

    !application.reference ||

    !application.submitted_at ||

    !isLicenseCategory(
      application.category
    ) ||

    !pricing ||

    !Number.isSafeInteger(
      application.document_count
    ) ||

    application.document_count < 0
  ) {
    throw new ApplicationServiceError(
      "INTERNAL_ERROR",

      500
    );
  }

  return {
    applicationId:
      application.id,

    reference:
      application.reference,

    status:
      application.status,

    alreadySubmitted,

    submittedAt:
      toIsoDate(
        application.submitted_at
      ),

    countryCode,

    category:
      application.category,

    pricing,

    admissionReviewRequired:
      application.admission_review_required,

    documentCount:
      application.document_count,
  };
}

/* ============================================================
   42. SUBMIT LICENSE APPLICATION

   Used by:

   POST /api/dashboard/application/submit

   Transaction:

   1. Lock and authenticate candidate.
   2. Lock candidate application.
   3. Prevent duplicate submission.
   4. Verify country.
   5. Read trusted category configuration.
   6. Lock existing documents.
   7. Validate complete application.
   8. Validate current pricing version.
   9. Recheck session expiration.
   10. Save final application.
   11. Save status history.
   12. Create candidate email job.
   13. Create administrator email job.
   14. Commit PostgreSQL transaction.

   Actual email delivery happens after
   commit in the existing submit API.

   Submission does not issue an
   official driving license.
   ============================================================ */

export async function submitLicenseApplication(
  input: SubmitLicenseApplicationInput
): Promise<SubmitLicenseApplicationResult> {
  const locale =
    normalizeApplicationLocale(
      input.locale
    );

  if (
    !isValidUuid(
      input.applicationId
    )
  ) {
    throwLocalizedValidationError(
      "INVALID_INPUT",

      "applicationId",

      locale
    );
  }

  assertEditableFormInput(
    input.form,

    locale
  );

  return withTransaction(
    async (client) => {
      /* ----------------------------------------------------
         STEP 1 — AUTHENTICATED CANDIDATE
         ---------------------------------------------------- */

      const candidate =
        await requireCandidate(
          client,

          input,

          true
        );

      const publicCandidate =
        mapCandidate(candidate);

      const countryCode =
        publicCandidate.countryCode;

      /* ----------------------------------------------------
         STEP 2 — LOCK OWNED APPLICATION
         ---------------------------------------------------- */

      const application =
        await requireOwnedApplication(
          client,

          input.applicationId,

          candidate.userId,

          countryCode,

          true
        );

      /* ----------------------------------------------------
         STEP 3 — IDEMPOTENT SUBMISSION

         A repeated request returns the
         existing committed application.

         No duplicated dossier.
         No duplicated status history.
         No duplicated email jobs.
         ---------------------------------------------------- */

      if (
        application.submitted_at !== null &&

        SUBMITTED_APPLICATION_STATUSES.has(
          application.status
        )
      ) {
        return buildSubmissionResult(
          application,

          true
        );
      }

      assertApplicationEditable(
        application.status,

        locale
      );

      /* ----------------------------------------------------
         STEP 4 — TRUSTED COUNTRY CONFIGURATION
         ---------------------------------------------------- */

      const configuration =
        loadCountryConfiguration(
          countryCode
        );

      /* ----------------------------------------------------
         STEP 5 — LOCK DOCUMENT RECORDS

         Document upload and deletion use
         the same candidate/application locks.
         ---------------------------------------------------- */

      const documents =
        await readApplicationDocuments(
          client,

          application.id,

          candidate.userId,

          true
        );

      /* ----------------------------------------------------
         STEP 6 — COMPLETE FORM

         Final request must explicitly
         contain all final form fields.

         Do not silently reuse stale
         confirmation values from a draft.
         ---------------------------------------------------- */

      if (
        input.form.confirmedInformation !==
          true
      ) {
        throwLocalizedValidationError(
          "INFORMATION_CONFIRMATION_REQUIRED",

          "confirmedInformation",

          locale
        );
      }

      if (
        input.form.acceptedDocumentProcessing !==
          true
      ) {
        throwLocalizedValidationError(
          "DOCUMENT_PROCESSING_REQUIRED",

          "acceptedDocumentProcessing",

          locale
        );
      }

      /* ----------------------------------------------------
         STEP 7 — AUTHORITATIVE VALIDATION
         ---------------------------------------------------- */

      const validated =
        validateApplicationSubmission(
          input.form,

          {
            candidate,

            offerings:
              configuration.offerings,

            applicationId:
              application.id,

            documents,

            locale,
          }
        );

      assertCompleteApplicationData(
        validated,

        locale
      );

      /* ----------------------------------------------------
         STEP 8 — VERIFY SELECTED CATEGORY
         ---------------------------------------------------- */

      const offering =
        findAvailableLicenseOffering(
          countryCode,

          validated.category,

          configuration.offerings
        );

      if (!offering) {
        throwLocalizedValidationError(
          "CATEGORY_UNAVAILABLE",

          "category",

          locale
        );
      }

      /* ----------------------------------------------------
         STEP 9 — PRICE VERSION CHECK
         ---------------------------------------------------- */

      assertPricingVersion(
        validated,

        input.expectedPricingVersion
      );

      /* ----------------------------------------------------
         STEP 10 — DOCUMENT CONSISTENCY
         ---------------------------------------------------- */

      const validatedDocumentIds =
        new Set(
          validated.documentIds
        );

      if (
        validatedDocumentIds.size !==
          documents.length ||

        documents.some(
          (document) =>

            !validatedDocumentIds.has(
              document.id
            )
        )
      ) {
        throw new ApplicationServiceError(
          "DOCUMENT_NOT_READY",

          409
        );
      }

      /* ----------------------------------------------------
         STEP 11 — FINAL SESSION CHECK
         ---------------------------------------------------- */

      await assertSessionStillActive(
        client,

        input
      );

      /* ----------------------------------------------------
         STEP 12 — UNIQUE REFERENCE
         ---------------------------------------------------- */

      const dateResult =
        await client.query<{
          submitted_at: Date;
        }>(
          `
            SELECT
              clock_timestamp()
                AS submitted_at
          `
        );

      const submittedAt =
        dateResult.rows[0]
          ?.submitted_at;

      if (
        !(submittedAt instanceof Date) ||

        !Number.isFinite(
          submittedAt.getTime()
        )
      ) {
        throw new ApplicationServiceError(
          "INTERNAL_ERROR",

          500
        );
      }

      const reference =
        createApplicationReference(
          application.id,

          countryCode,

          submittedAt
        );

      /* ----------------------------------------------------
         STEP 13 — SAVE FINAL APPLICATION
         ---------------------------------------------------- */

      const submitted =
        await persistFinalApplication({
          client,

          application,

          data:
            validated,

          reference,

          submittedAt,

          locale,

          documentCount:
            documents.length,
        });

      /* ----------------------------------------------------
         STEP 14 — STATUS HISTORY
         ---------------------------------------------------- */

      await recordApplicationStatus({
        client,

        applicationId:
          submitted.id,

        previousStatus:
          "DRAFT",

        newStatus:
          "SUBMITTED",

        changedByUserId:
          candidate.userId,
      });

      /* ----------------------------------------------------
         STEP 15 — PREPARE BOTH EMAILS

         These jobs are persisted in
         the same PostgreSQL transaction.
         ---------------------------------------------------- */

      const snapshot =
        buildApplicationEmailSnapshot({
          application:
            submitted,

          data:
            validated,

          documents,

          locale,
        });

      await enqueueApplicationSubmissionEmails({
        client,

        snapshot,
      });

      /* ----------------------------------------------------
         STEP 16 — BUILD SUBMISSION RESULT

         withTransaction() commits
         before returning this result
         to submit/route.ts.
         ---------------------------------------------------- */

      return buildSubmissionResult(
        submitted,

        false
      );
    }
  );
}
