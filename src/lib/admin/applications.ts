
import "server-only";

import type { NextRequest } from "next/server";
import type { Pool, PoolClient } from "pg";

import {
  getAdminSessionDatabase,
} from "@/lib/admin/session";

import {
  requireAdminRequest,
  isSupportedAdminCountry,
  isAdminApplicationStatus,
  isAdminDocumentType,
  isAdminDocumentVerificationStatus,
  requireApplicationId,
  requireApplicationDecisionTransition,
  type AdminCountry,
  type AdminApplicationStatus,
  type AdminDecision,
  type AdminDocumentType,
  type AdminDocumentVerificationStatus,
} from "@/lib/admin/permissions";

/* ============================================================
   FAHRSCHULE TAYM
   ADMIN APPLICATION SERVICE

   FILE:
   src/lib/admin/applications.ts

   PURPOSE:
   - List real driving licence applications
   - Search by candidate name / email / reference
   - Filter by country and status
   - Calculate global application statistics
   - Server-side pagination
   - Read complete candidate dossiers
   - Read document metadata
   - Read administrative decisions
   - Validate status transitions
   - Lock applications for decisions
   - Check optimistic concurrency

   EXISTING DATABASE TABLES:
   taym_driving_license_applications
   taym_application_details
   taym_application_documents
   taym_application_decisions

   AUTHENTICATION:
   src/lib/admin/session.ts

   AUTHORIZATION:
   src/lib/admin/permissions.ts

   IMPORTANT:
   - No mock data
   - No automatic status modifications
   - No document storage keys in responses
   - No email sending in this module
   - No audit writes in this module
   - All database values are parameterized

   The decision API remains responsible
   for the final PostgreSQL transaction.
   ============================================================ */

/* ============================================================
   1. CONFIGURATION
   ============================================================ */

export const ADMIN_APPLICATION_PAGE_SIZE = 15;

export const MAX_ADMIN_APPLICATION_PAGE_SIZE = 50;

export const MAX_ADMIN_APPLICATION_SEARCH_LENGTH = 120;

export const MAX_ADMIN_APPLICATION_PAGE = 100_000;

const MAX_DOCUMENTS_PER_APPLICATION = 100;

const MAX_ADDITIONAL_FIELDS = 100;

/* ============================================================
   2. APPLICATION TYPES
   ============================================================ */

export type ApplicationStatus =
  AdminApplicationStatus;

export type ApplicationCountry =
  AdminCountry;

export type ApplicationDecision =
  AdminDecision;

export type ApplicationFilters = {
  page: number;
  pageSize: number;
  search: string | null;
  country: ApplicationCountry | null;
  status: ApplicationStatus | null;
};

export type ApplicationStatistics = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};

export type ApplicationListItem = {
  id: string;
  reference: string;
  firstName: string;
  lastName: string;
  email: string;
  countryCode: ApplicationCountry;
  licenseClass: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
};

export type PaginatedApplications = {
  items: ApplicationListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ApplicationListResult = {
  stats: ApplicationStatistics;
  applications: PaginatedApplications;
  generatedAt: string;
};

export type ApplicationApplicant = {
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  nationality: string | null;
  email: string;
  emailVerified: boolean;
  phoneE164: string;
  phoneVerified: boolean;
  countryCode: ApplicationCountry;
  streetAddress: string | null;
  postalCode: string | null;
  city: string | null;
};

export type ApplicationDocument = {
  id: string;
  type: AdminDocumentType;
  label: string | null;
  fileName: string | null;
  mimeType: string | null;
  status: AdminDocumentVerificationStatus;
  uploadedAt: string | null;
};

export type ApplicationExtraField = {
  key: string;
  label: string;
  value: string;
};

export type ApplicationDecisionRecord = {
  decidedAt: string;
  reason: string | null;
};

export type ApplicationDetail = {
  id: string;
  reference: string;
  status: ApplicationStatus;
  countryCode: ApplicationCountry;
  licenseClass: string;
  requestType: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  applicant: ApplicationApplicant;
  documents: ApplicationDocument[];
  additionalFields: ApplicationExtraField[];
  decision: ApplicationDecisionRecord | null;
};

export type DecisionPrecondition = {
  expectedStatus: ApplicationStatus;
  expectedUpdatedAt: string;
};

export type LockedApplication = {
  id: string;
  reference: string;
  firstName: string;
  lastName: string;
  email: string;
  countryCode: ApplicationCountry;
  status: ApplicationStatus;
  licenseClass: string;
  updatedAt: string;
};

/* ============================================================
   3. ERRORS
   ============================================================ */

export type ApplicationServiceErrorCode =
  | "INVALID_QUERY"
  | "INVALID_PAGE"
  | "APPLICATION_NOT_FOUND"
  | "APPLICATION_INCOMPLETE"
  | "ALREADY_DECIDED"
  | "DECISION_CONFLICT"
  | "INVALID_APPLICATION_DATA";

export class ApplicationServiceError extends Error {
  readonly status: number;
  readonly code: ApplicationServiceErrorCode;

  constructor(
    status: number,
    code: ApplicationServiceErrorCode
  ) {
    super(code);

    this.name = "ApplicationServiceError";
    this.status = status;
    this.code = code;
  }
}

export function getApplicationServiceError(
  error: unknown
): {
  status: number;
  code: ApplicationServiceErrorCode;
} | null {
  if (!(error instanceof ApplicationServiceError)) {
    return null;
  }

  return {
    status: error.status,
    code: error.code,
  };
}

/* ============================================================
   4. DATABASE TYPES
   ============================================================ */

export type ApplicationDatabase =
  Pool | PoolClient;

type CountRow = {
  total: string | number;
};

type StatisticsRow = {
  total: string | number;
  pending: string | number;
  approved: string | number;
  rejected: string | number;
};

type ApplicationRow = {
  id: string;
  reference: string;
  first_name: string;
  last_name: string;
  email: string;
  country_code: string;
  license_class: string;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type ApplicationDetailsRow = {
  application_id: string;
  request_type: string | null;
  notes: string | null;
  date_of_birth: Date | string | null;
  nationality: string | null;
  phone_e164: string;
  email_verified: boolean;
  phone_verified: boolean;
  street_address: string | null;
  postal_code: string | null;
  city: string | null;
  additional_fields: unknown;
};

type DocumentRow = {
  id: string;
  document_type: string;
  label: string | null;
  file_name: string | null;
  mime_type: string | null;
  verification_status: string;
  uploaded_at: Date | string | null;
};

type DecisionRow = {
  decided_at: Date | string;
  reason: string | null;
};

type FilterQuery = {
  where: string;
  values: string[];
};

/* ============================================================
   5. DATABASE HELPER

   Reuse src/lib/admin/session.ts,
   which already exposes the shared
   PostgreSQL pool.

   No extra global connection is needed.
   ============================================================ */

export function getApplicationsDatabase(): Pool {
  return getAdminSessionDatabase();
}

/* ============================================================
   6. SAFE DATA CONVERSION
   ============================================================ */

function requiredText(
  value: unknown,
  maximum: number
): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maximum
  ) {
    throw new ApplicationServiceError(
      503,
      "INVALID_APPLICATION_DATA"
    );
  }

  return value;
}

function optionalText(
  value: unknown,
  maximum: number
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value !== "string" ||
    value.length > maximum
  ) {
    throw new ApplicationServiceError(
      503,
      "INVALID_APPLICATION_DATA"
    );
  }

  return value;
}

function safeCount(
  value: unknown
): number {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    throw new ApplicationServiceError(
      503,
      "INVALID_APPLICATION_DATA"
    );
  }

  const count = Number(value);

  if (
    !Number.isSafeInteger(count) ||
    count < 0
  ) {
    throw new ApplicationServiceError(
      503,
      "INVALID_APPLICATION_DATA"
    );
  }

  return count;
}

function isoDate(
  value: Date | string
): string {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new ApplicationServiceError(
      503,
      "INVALID_APPLICATION_DATA"
    );
  }

  return date.toISOString();
}

function optionalIsoDate(
  value: Date | string | null
): string | null {
  return value === null ? null : isoDate(value);
}

function birthDate(
  value: Date | string | null
): string | null {
  if (value === null) return null;

  const calendarDate =
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : value.slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(calendarDate)) {
    throw new ApplicationServiceError(
      503,
      "INVALID_APPLICATION_DATA"
    );
  }

  const normalized =
    `${calendarDate}T00:00:00.000Z`;

  const date = new Date(normalized);

  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !==
      calendarDate
  ) {
    throw new ApplicationServiceError(
      503,
      "INVALID_APPLICATION_DATA"
    );
  }

  return normalized;
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function validateCountry(
  value: unknown
): ApplicationCountry {
  if (!isSupportedAdminCountry(value)) {
    throw new ApplicationServiceError(
      503,
      "INVALID_APPLICATION_DATA"
    );
  }

  return value;
}

function validateStatus(
  value: unknown
): ApplicationStatus {
  if (!isAdminApplicationStatus(value)) {
    throw new ApplicationServiceError(
      503,
      "INVALID_APPLICATION_DATA"
    );
  }

  return value;
}

/* ============================================================
   7. FILTER VALIDATION

   Accepted query parameters:
   - page
   - pageSize
   - search
   - country
   - status

   This function can be reused
   by the applications list API.
   ============================================================ */

function positiveInteger(
  raw: string | null,
  fallback: number,
  maximum: number
): number | null {
  if (raw === null) {
    return fallback;
  }

  if (!/^[1-9]\d*$/.test(raw)) {
    return null;
  }

  const value = Number(raw);

  if (
    !Number.isSafeInteger(value) ||
    value > maximum
  ) {
    return null;
  }

  return value;
}

export function parseApplicationFilters(
  searchParams: URLSearchParams
): ApplicationFilters {
  const allowed = new Set([
    "page",
    "pageSize",
    "search",
    "country",
    "status",
  ]);

  if ([...searchParams.keys()].length > 5) {
    throw new ApplicationServiceError(
      400,
      "INVALID_QUERY"
    );
  }

  for (const key of searchParams.keys()) {
    if (
      !allowed.has(key) ||
      searchParams.getAll(key).length !== 1
    ) {
      throw new ApplicationServiceError(
        400,
        "INVALID_QUERY"
      );
    }
  }

  const page = positiveInteger(
    searchParams.get("page"),
    1,
    MAX_ADMIN_APPLICATION_PAGE
  );

  const pageSize = positiveInteger(
    searchParams.get("pageSize"),
    ADMIN_APPLICATION_PAGE_SIZE,
    MAX_ADMIN_APPLICATION_PAGE_SIZE
  );

  if (page === null || pageSize === null) {
    throw new ApplicationServiceError(
      400,
      "INVALID_QUERY"
    );
  }

  const rawCountry =
    searchParams.get("country");

  const country =
    rawCountry === null ||
    rawCountry === "ALL"
      ? null
      : rawCountry;

  if (
    country !== null &&
    !isSupportedAdminCountry(country)
  ) {
    throw new ApplicationServiceError(
      400,
      "INVALID_QUERY"
    );
  }

  const rawStatus =
    searchParams.get("status");

  const status =
    rawStatus === null ||
    rawStatus === "ALL"
      ? null
      : rawStatus;

  if (
    status !== null &&
    !isAdminApplicationStatus(status)
  ) {
    throw new ApplicationServiceError(
      400,
      "INVALID_QUERY"
    );
  }

  const rawSearch =
    searchParams.get("search");

  let search: string | null = null;

  if (rawSearch !== null) {
    search = rawSearch.normalize("NFC").trim();

    if (
      search.length >
        MAX_ADMIN_APPLICATION_SEARCH_LENGTH ||
      /[\u0000-\u001f\u007f]/u.test(search)
    ) {
      throw new ApplicationServiceError(
        400,
        "INVALID_QUERY"
      );
    }

    if (search === "") {
      search = null;
    }
  }

  return {
    page,
    pageSize,
    search,
    country,
    status,
  };
}

/* ============================================================
   8. PARAMETERIZED FILTER QUERY

   Search in:
   - First name
   - Last name
   - Full name
   - Email
   - Application reference

   POSITION() treats "%", "_" and
   other LIKE wildcard characters
   literally.

   User input cannot become
   SQL syntax.
   ============================================================ */

function buildApplicationFilter(
  filters: ApplicationFilters
): FilterQuery {
  const clauses: string[] = [
    `country_code IN (
      'DE', 'AT', 'BE', 'IT', 'ES'
    )`,
  ];

  const values: string[] = [];

  if (filters.country) {
    values.push(filters.country);

    clauses.push(
      `country_code = $${values.length}`
    );
  }

  if (filters.status) {
    values.push(filters.status);

    clauses.push(
      `status = $${values.length}`
    );
  }

  if (filters.search) {
    values.push(filters.search.toLowerCase());

    const parameter = `$${values.length}`;

    clauses.push(
      `(
        POSITION(
          ${parameter} IN LOWER(first_name)
        ) > 0

        OR POSITION(
          ${parameter} IN LOWER(last_name)
        ) > 0

        OR POSITION(
          ${parameter} IN LOWER(
            CONCAT_WS(
              ' ',
              first_name,
              last_name
            )
          )
        ) > 0

        OR POSITION(
          ${parameter} IN LOWER(
            CONCAT_WS(
              ' ',
              last_name,
              first_name
            )
          )
        ) > 0

        OR POSITION(
          ${parameter} IN LOWER(email)
        ) > 0

        OR POSITION(
          ${parameter} IN LOWER(reference)
        ) > 0
      )`
    );
  }

  return {
    where: `WHERE ${clauses.join(" AND ")}`,
    values,
  };
}

/* ============================================================
   9. APPLICATION LIST ITEM MAPPING

   Only expose the information
   required by the list page.

   No identity document storage keys,
   signatures, OTPs or passwords.
   ============================================================ */

function mapListItem(
  row: ApplicationRow
): ApplicationListItem {
  return {
    id: requiredText(row.id, 150),

    reference: requiredText(
      row.reference,
      120
    ),

    firstName: requiredText(
      row.first_name,
      150
    ),

    lastName: requiredText(
      row.last_name,
      150
    ),

    email: requiredText(
      row.email,
      254
    ),

    countryCode:
      validateCountry(row.country_code),

    licenseClass: requiredText(
      row.license_class,
      100
    ),

    status:
      validateStatus(row.status),

    createdAt:
      isoDate(row.created_at),

    updatedAt:
      isoDate(row.updated_at),
  };
}

/* ============================================================
   10. GLOBAL STATISTICS

   These are NOT changed by
   search or filter settings.

   pending includes:
   - PENDING
   - IN_REVIEW
   ============================================================ */

export async function readApplicationStatistics(
  database: ApplicationDatabase =
    getApplicationsDatabase()
): Promise<ApplicationStatistics> {
  const result =
    await database.query<StatisticsRow>(
      `
      SELECT
        COUNT(*) AS total,

        COUNT(*) FILTER (
          WHERE status IN (
            'PENDING',
            'IN_REVIEW'
          )
        ) AS pending,

        COUNT(*) FILTER (
          WHERE status = 'APPROVED'
        ) AS approved,

        COUNT(*) FILTER (
          WHERE status = 'REJECTED'
        ) AS rejected

      FROM taym_driving_license_applications

      WHERE country_code IN (
        'DE', 'AT', 'BE', 'IT', 'ES'
      )
      `
    );

  const row = result.rows[0];

  if (!row) {
    throw new ApplicationServiceError(
      503,
      "INVALID_APPLICATION_DATA"
    );
  }

  return {
    total: safeCount(row.total),
    pending: safeCount(row.pending),
    approved: safeCount(row.approved),
    rejected: safeCount(row.rejected),
  };
}

/* ============================================================
   11. COUNT FILTERED APPLICATIONS
   ============================================================ */

async function countFilteredApplications(
  database: ApplicationDatabase,
  filter: FilterQuery
): Promise<number> {
  const result =
    await database.query<CountRow>(
      `
      SELECT COUNT(*) AS total

      FROM taym_driving_license_applications

      ${filter.where}
      `,
      filter.values
    );

  return safeCount(result.rows[0]?.total);
}

/* ============================================================
   12. PAGINATED APPLICATION QUERY

   Stable order:
   created_at DESC, id DESC

   Pagination is handled by
   PostgreSQL LIMIT and OFFSET.
   ============================================================ */

async function findApplicationPage(
  database: ApplicationDatabase,
  filter: FilterQuery,
  page: number,
  pageSize: number
): Promise<ApplicationListItem[]> {
  const offset =
    (page - 1) * pageSize;

  const limitParam =
    filter.values.length + 1;

  const offsetParam =
    filter.values.length + 2;

  const result =
    await database.query<ApplicationRow>(
      `
      SELECT
        id::text AS id,
        reference,
        first_name,
        last_name,
        email,
        country_code,
        license_class,
        status,
        created_at,
        updated_at

      FROM taym_driving_license_applications

      ${filter.where}

      ORDER BY
        created_at DESC,
        id DESC

      LIMIT $${limitParam}
      OFFSET $${offsetParam}
      `,
      [
        ...filter.values,
        pageSize,
        offset,
      ]
    );

  return result.rows.map(mapListItem);
}

/* ============================================================
   13. PROTECTED LIST SERVICE

   Entry point for:
   GET /api/admin/applications

   Session is verified inside the
   same PostgreSQL read transaction.

   A consistent snapshot covers:
   - Authentication
   - Statistics
   - Filtered count
   - Application page

   Return:
   {
     stats,
     applications,
     generatedAt
   }

   The route adds success: true.
   ============================================================ */

export async function getAdminApplications(
  request: NextRequest,
  filters: ApplicationFilters
): Promise<ApplicationListResult> {
  const pool = getApplicationsDatabase();
  const client = await pool.connect();

  let transactionOpen = false;

  try {
    await client.query(
      `
      BEGIN TRANSACTION
      ISOLATION LEVEL REPEATABLE READ
      READ ONLY
      `
    );

    transactionOpen = true;

    await requireAdminRequest(
      request,
      "ADMIN_APPLICATION_LIST",
      client
    );

    const stats =
      await readApplicationStatistics(client);

    const filter =
      buildApplicationFilter(filters);

    const total =
      await countFilteredApplications(
        client,
        filter
      );

    const totalPages = Math.max(
      1,
      Math.ceil(total / filters.pageSize)
    );

    if (filters.page > totalPages) {
      throw new ApplicationServiceError(
        400,
        "INVALID_PAGE"
      );
    }

    const items =
      await findApplicationPage(
        client,
        filter,
        filters.page,
        filters.pageSize
      );

    await client.query("COMMIT");
    transactionOpen = false;

    return {
      stats,

      applications: {
        items,
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages,
      },

      generatedAt:
        new Date().toISOString(),
    };
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve original error.
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

/* ============================================================
   14. READ ONE APPLICATION RECORD
   ============================================================ */

async function findApplicationById(
  database: ApplicationDatabase,
  applicationId: string
): Promise<ApplicationRow | null> {
  const result =
    await database.query<ApplicationRow>(
      `
      SELECT
        id::text AS id,
        reference,
        first_name,
        last_name,
        email,
        country_code,
        license_class,
        status,
        created_at,
        updated_at

      FROM taym_driving_license_applications

      WHERE id = $1::uuid

        AND country_code IN (
          'DE', 'AT', 'BE', 'IT', 'ES'
        )

      LIMIT 1
      `,
      [applicationId]
    );

  return result.rows[0] ?? null;
}

/* ============================================================
   15. READ ADDITIONAL DOSSIER DETAILS
   ============================================================ */

async function findApplicationDetails(
  database: ApplicationDatabase,
  applicationId: string
): Promise<ApplicationDetailsRow | null> {
  const result =
    await database.query<ApplicationDetailsRow>(
      `
      SELECT
        application_id::text AS application_id,
        request_type,
        notes,
        date_of_birth,
        nationality,
        phone_e164,
        email_verified,
        phone_verified,
        street_address,
        postal_code,
        city,
        additional_fields

      FROM taym_application_details

      WHERE application_id = $1::uuid

      LIMIT 1
      `,
      [applicationId]
    );

  return result.rows[0] ?? null;
}

/* ============================================================
   16. READ DOCUMENT METADATA

   Do not retrieve storage_key.

   File contents are accessible
   only through the protected
   document reader endpoint.
   ============================================================ */

export async function readApplicationDocuments(
  applicationId: string,
  database: ApplicationDatabase =
    getApplicationsDatabase()
): Promise<ApplicationDocument[]> {
  const id = requireApplicationId(applicationId);

  const result =
    await database.query<DocumentRow>(
      `
      SELECT
        id::text AS id,
        document_type,
        label,
        file_name,
        mime_type,
        verification_status,
        uploaded_at

      FROM taym_application_documents

      WHERE application_id = $1::uuid

      ORDER BY
        uploaded_at ASC NULLS LAST,
        id ASC

      LIMIT $2
      `,
      [
        id,
        MAX_DOCUMENTS_PER_APPLICATION + 1,
      ]
    );

  if (
    result.rows.length >
    MAX_DOCUMENTS_PER_APPLICATION
  ) {
    throw new ApplicationServiceError(
      503,
      "INVALID_APPLICATION_DATA"
    );
  }

  return result.rows.map((row) => {
    if (
      !isAdminDocumentType(row.document_type) ||
      !isAdminDocumentVerificationStatus(
        row.verification_status
      )
    ) {
      throw new ApplicationServiceError(
        503,
        "INVALID_APPLICATION_DATA"
      );
    }

    return {
      id: requiredText(row.id, 150),
      type: row.document_type,
      label: optionalText(row.label, 150),
      fileName: optionalText(row.file_name, 250),
      mimeType: optionalText(row.mime_type, 100),
      status: row.verification_status,
      uploadedAt: optionalIsoDate(
        row.uploaded_at
      ),
    };
  });
}

/* ============================================================
   17. READ ADMINISTRATIVE DECISION
   ============================================================ */

async function findApplicationDecision(
  database: ApplicationDatabase,
  applicationId: string
): Promise<ApplicationDecisionRecord | null> {
  const result =
    await database.query<DecisionRow>(
      `
      SELECT
        decided_at,
        reason

      FROM taym_application_decisions

      WHERE application_id = $1::uuid

      LIMIT 1
      `,
      [applicationId]
    );

  const row = result.rows[0];

  return row
    ? {
        decidedAt: isoDate(row.decided_at),
        reason: optionalText(row.reason, 1000),
      }
    : null;
}

/* ============================================================
   18. READ SAFE ADDITIONAL FIELDS

   Only structured non-secret answers
   should be stored in this column.

   Filtering is defense in depth.
   Field selection must also be
   controlled when saving data.

   Never expose OTPs, passwords
   or token values.
   ============================================================ */

function readAdditionalFields(
  raw: unknown
): ApplicationExtraField[] {
  let value = raw;

  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      throw new ApplicationServiceError(
        503,
        "INVALID_APPLICATION_DATA"
      );
    }
  }

  if (
    !Array.isArray(value) ||
    value.length > MAX_ADDITIONAL_FIELDS
  ) {
    throw new ApplicationServiceError(
      503,
      "INVALID_APPLICATION_DATA"
    );
  }

  const fields: ApplicationExtraField[] = [];
  const keys = new Set<string>();

  for (const item of value) {
    if (!isRecord(item)) {
      throw new ApplicationServiceError(
        503,
        "INVALID_APPLICATION_DATA"
      );
    }

    const key = requiredText(item.key, 120);
    const label = requiredText(item.label, 160);
    const fieldValue = requiredText(
      item.value,
      3000
    );

    if (
      /password|passwd|passwort|mot.?de.?passe|otp|secret|token|api.?key|verification.?code|confirmation.?code|code.?de.?verification/i.test(
        `${key} ${label}`
      )
    ) {
      continue;
    }

    if (keys.has(key)) {
      throw new ApplicationServiceError(
        503,
        "INVALID_APPLICATION_DATA"
      );
    }

    keys.add(key);

    fields.push({
      key,
      label,
      value: fieldValue,
    });
  }

  return fields;
}

/* ============================================================
   19. BUILD COMPLETE APPLICATION DETAIL

   JSON shape matches the existing
   page:

   /admin/applications/[id]

   and the decision API response.
   ============================================================ */

function buildApplicationDetail(
  row: ApplicationRow,
  details: ApplicationDetailsRow,
  documents: ApplicationDocument[],
  decision: ApplicationDecisionRecord | null
): ApplicationDetail {
  const base = mapListItem(row);

  if (
    typeof details.email_verified !== "boolean" ||
    typeof details.phone_verified !== "boolean"
  ) {
    throw new ApplicationServiceError(
      503,
      "INVALID_APPLICATION_DATA"
    );
  }

  if (details.application_id !== base.id) {
    throw new ApplicationServiceError(
      503,
      "INVALID_APPLICATION_DATA"
    );
  }

  return {
    id: base.id,
    reference: base.reference,
    status: base.status,
    countryCode: base.countryCode,
    licenseClass: base.licenseClass,
    requestType: optionalText(
      details.request_type,
      150
    ),
    notes: optionalText(details.notes, 3000),
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,

    applicant: {
      firstName: base.firstName,
      lastName: base.lastName,
      dateOfBirth: birthDate(
        details.date_of_birth
      ),
      nationality: optionalText(
        details.nationality,
        120
      ),
      email: base.email,
      emailVerified: details.email_verified,
      phoneE164: requiredText(
        details.phone_e164,
        40
      ),
      phoneVerified: details.phone_verified,
      countryCode: base.countryCode,
      streetAddress: optionalText(
        details.street_address,
        250
      ),
      postalCode: optionalText(
        details.postal_code,
        20
      ),
      city: optionalText(
        details.city,
        150
      ),
    },

    documents,

    additionalFields: readAdditionalFields(
      details.additional_fields
    ),

    decision,
  };
}

/* ============================================================
   20. READ COMPLETE APPLICATION

   This lower-level function expects
   a VALIDATED and AUTHORIZED caller.

   Do not expose it directly to an
   unauthenticated HTTP endpoint.

   The public service below handles
   the administrator permission check.
   ============================================================ */

export async function readApplicationDetailFromDatabase(
  applicationId: string,
  database: ApplicationDatabase
): Promise<ApplicationDetail> {
  const id = requireApplicationId(applicationId);

  const row = await findApplicationById(
    database,
    id
  );

  if (!row) {
    throw new ApplicationServiceError(
      404,
      "APPLICATION_NOT_FOUND"
    );
  }

  const details = await findApplicationDetails(
    database,
    id
  );

  if (!details) {
    throw new ApplicationServiceError(
      422,
      "APPLICATION_INCOMPLETE"
    );
  }

  const documents = await readApplicationDocuments(
    id,
    database
  );

  const decision = await findApplicationDecision(
    database,
    id
  );

  return buildApplicationDetail(
    row,
    details,
    documents,
    decision
  );
}

/* ============================================================
   21. PROTECTED APPLICATION DETAIL

   Entry point for:
   GET /api/admin/applications/[id]

   Verifies permission inside a
   read-only PostgreSQL transaction.

   All fields come from one
   consistent database snapshot.
   ============================================================ */

export async function getAdminApplicationDetail(
  request: NextRequest,
  rawApplicationId: unknown
): Promise<ApplicationDetail> {
  const pool = getApplicationsDatabase();
  const client = await pool.connect();

  let transactionOpen = false;

  try {
    await client.query(
      `
      BEGIN TRANSACTION
      ISOLATION LEVEL REPEATABLE READ
      READ ONLY
      `
    );

    transactionOpen = true;

    /*
     * Authenticate before validating
     * the requested identifier.
     */

    await requireAdminRequest(
      request,
      "ADMIN_APPLICATION_READ",
      client
    );

    const applicationId =
      requireApplicationId(rawApplicationId);

    const application =
      await readApplicationDetailFromDatabase(
        applicationId,
        client
      );

    await client.query("COMMIT");
    transactionOpen = false;

    return application;
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve original error.
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

/* ============================================================
   22. TRANSITION RULES

   Allowed:
   PENDING -> IN_REVIEW
   PENDING -> APPROVED
   PENDING -> REJECTED

   IN_REVIEW -> APPROVED
   IN_REVIEW -> REJECTED

   Forbidden:
   APPROVED -> any other status
   REJECTED -> any other status

   "IN_REVIEW" may be set by a
   separate authorized review
   workflow.

   The existing decision API only
   processes APPROVED / REJECTED.
   ============================================================ */

export type StatusTransitionResult =
  | {
      allowed: true;
      from: ApplicationStatus;
      to: ApplicationStatus;
    }
  | {
      allowed: false;
      from: ApplicationStatus;
      to: ApplicationStatus;
      code:
        | "ALREADY_DECIDED"
        | "DECISION_CONFLICT";
    };

export function checkApplicationStatusTransition(
  currentStatus: ApplicationStatus,
  nextStatus: ApplicationStatus
): StatusTransitionResult {
  if (
    currentStatus === "APPROVED" ||
    currentStatus === "REJECTED"
  ) {
    return {
      allowed: false,
      from: currentStatus,
      to: nextStatus,
      code: "ALREADY_DECIDED",
    };
  }

  const allowed =
    (currentStatus === "PENDING" &&
      (
        nextStatus === "IN_REVIEW" ||
        nextStatus === "APPROVED" ||
        nextStatus === "REJECTED"
      )) ||
    (currentStatus === "IN_REVIEW" &&
      (
        nextStatus === "APPROVED" ||
        nextStatus === "REJECTED"
      ));

  return allowed
    ? {
        allowed: true,
        from: currentStatus,
        to: nextStatus,
      }
    : {
        allowed: false,
        from: currentStatus,
        to: nextStatus,
        code: "DECISION_CONFLICT",
      };
}

export function requireApplicationStatusTransition(
  currentStatus: ApplicationStatus,
  nextStatus: ApplicationStatus
): void {
  const result = checkApplicationStatusTransition(
    currentStatus,
    nextStatus
  );

  if (!result.allowed) {
    throw new ApplicationServiceError(
      409,
      result.code
    );
  }
}

/* ============================================================
   23. REJECTION REASON VALIDATION

   Must match:
   - Admin application detail page
   - Decision API

   Rejection:
   10 to 1000 characters

   Approval:
   reason must be null.
   ============================================================ */

export function normalizeRejectionReason(
  raw: unknown
): string {
  if (typeof raw !== "string") {
    throw new ApplicationServiceError(
      400,
      "INVALID_QUERY"
    );
  }

  const reason = raw
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ");

  if (
    reason.length < 10 ||
    reason.length > 1000
  ) {
    throw new ApplicationServiceError(
      400,
      "INVALID_QUERY"
    );
  }

  return reason;
}

export function validateDecisionReason(
  decision: ApplicationDecision,
  reason: unknown
): string | null {
  if (decision === "APPROVED") {
    if (reason !== null) {
      throw new ApplicationServiceError(
        400,
        "INVALID_QUERY"
      );
    }

    return null;
  }

  return normalizeRejectionReason(reason);
}

/* ============================================================
   24. OPTIMISTIC CONCURRENCY

   The frontend sends:
   expectedStatus
   expectedUpdatedAt

   Compare them against the
   locked PostgreSQL row before
   making a decision.

   This avoids using stale details
   when another request changes
   the same application.
   ============================================================ */

export function requireDecisionPrecondition(
  current: LockedApplication,
  expected: DecisionPrecondition
): void {
  if (
    current.status !== expected.expectedStatus ||
    current.updatedAt !== expected.expectedUpdatedAt
  ) {
    throw new ApplicationServiceError(
      409,
      "DECISION_CONFLICT"
    );
  }
}

/* ============================================================
   25. LOCK APPLICATION FOR DECISION

   IMPORTANT:
   This function must be called
   using a PoolClient INSIDE an
   already-open transaction.

   SELECT ... FOR UPDATE prevents
   two concurrent transactions from
   changing the same application
   without serialization.

   The caller is responsible for:
   - BEGIN
   - Session authorization
   - Decision write
   - Audit write
   - Email outbox write
   - COMMIT / ROLLBACK

   Do NOT pass a Pool here.
   ============================================================ */

export async function lockApplicationForDecision(
  client: PoolClient,
  rawApplicationId: unknown,
  decision: ApplicationDecision,
  expected: DecisionPrecondition
): Promise<LockedApplication> {
  const id = requireApplicationId(
    rawApplicationId
  );

  const result =
    await client.query<ApplicationRow>(
      `
      SELECT
        id::text AS id,
        reference,
        first_name,
        last_name,
        email,
        country_code,
        license_class,
        status,
        created_at,
        updated_at

      FROM taym_driving_license_applications

      WHERE id = $1::uuid

        AND country_code IN (
          'DE', 'AT', 'BE', 'IT', 'ES'
        )

      LIMIT 1

      FOR UPDATE
      `,
      [id]
    );

  const row = result.rows[0];

  if (!row) {
    throw new ApplicationServiceError(
      404,
      "APPLICATION_NOT_FOUND"
    );
  }

  const application = mapListItem(row);

  /*
   * Validate both the allowed
   * transition and the client's
   * expected version.
   */

  requireApplicationDecisionTransition(
    application.status,
    decision
  );

  requireDecisionPrecondition(
    {
      id: application.id,
      reference: application.reference,
      firstName: application.firstName,
      lastName: application.lastName,
      email: application.email,
      countryCode: application.countryCode,
      status: application.status,
      licenseClass: application.licenseClass,
      updatedAt: application.updatedAt,
    },
    expected
  );

  return {
    id: application.id,
    reference: application.reference,
    firstName: application.firstName,
    lastName: application.lastName,
    email: application.email,
    countryCode: application.countryCode,
    status: application.status,
    licenseClass: application.licenseClass,
    updatedAt: application.updatedAt,
  };
}

/* ============================================================
   END — FAHRSCHULE TAYM
   ============================================================ */
