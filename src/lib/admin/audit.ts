
import "server-only";

import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";

import type {
  Pool,
  PoolClient,
} from "pg";

import {
  getAdminSessionDatabase,
} from "@/lib/admin/session";

import {
  requireAdminRequest,
  isSupportedAdminCountry,
  type AdminCountry,
} from "@/lib/admin/permissions";

/* ============================================================
   FAHRSCHULE TAYM
   ADMIN AUDIT SERVICE

   FILE:
   src/lib/admin/audit.ts

   PURPOSE:
   - Record administrative activities
   - Record important platform events
   - Maintain an activity timeline
   - Filter events by country and type
   - Search historical activity
   - Paginate PostgreSQL results
   - Read activity statistics
   - Support atomic transaction writes
   - Avoid storing sensitive information

   DATABASE:
   PostgreSQL

   TABLE:
   taym_admin_activity_logs

   COMPATIBLE WITH:
   - Admin dashboard API
   - Admin applications API
   - Application decision API
   - Admin session module
   - Admin permissions module

   IMPORTANT SECURITY PRINCIPLES:
   - Server-only code
   - Parameterized SQL
   - No client-controlled actor identity
   - No raw document contents
   - No session tokens
   - No password hashes
   - No OTP values
   - No raw IP addresses
   - No arbitrary untrusted descriptions
   - Audits inside existing transactions

   ============================================================ */

/* ============================================================
   1. CONSTANTS
   ============================================================ */

export const AUDIT_DEFAULT_PAGE = 1;

export const AUDIT_DEFAULT_PAGE_SIZE = 15;

export const AUDIT_MAX_PAGE_SIZE = 50;

export const AUDIT_MAX_PAGE = 100_000;

export const AUDIT_MAX_SEARCH_LENGTH = 120;

const MAX_REFERENCE_LENGTH = 120;

const MAX_DESCRIPTION_LENGTH = 500;

const MAX_ACTOR_LENGTH = 150;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/* ============================================================
   2. EVENT TYPES

   Must match the types used by:

   /api/admin/dashboard

   and the existing PostgreSQL
   activity type constraint.

   Do not introduce other values
   without updating the database
   and frontend together.
   ============================================================ */

export const AUDIT_EVENT_TYPES = [
  "APPLICATION_CREATED",
  "APPLICATION_UPDATED",
  "APPLICATION_APPROVED",
  "APPLICATION_REJECTED",
  "USER_REGISTERED",
  "EMAIL_VERIFIED",
  "PHONE_VERIFIED",
  "DOCUMENT_UPLOADED",
  "DOCUMENT_VERIFIED",
  "RESERVATION_CREATED",
  "OTHER",
] as const;

export type AuditEventType =
  (typeof AUDIT_EVENT_TYPES)[number];

/* ============================================================
   3. TYPES
   ============================================================ */

export type AuditDatabase =
  Pool | PoolClient;

export type AuditActor =
  | "ADMIN"
  | "CANDIDATE"
  | "SYSTEM";

export type AuditEventInput = {
  type: AuditEventType;

  /*
   * Trusted backend identity.
   *
   * Never derive this from a
   * client-supplied role header.
   */
  actor: AuditActor;

  countryCode?: AdminCountry | null;

  /*
   * Required for application events.
   * Optional for platform events.
   */
  applicationId?: string | null;

  applicationReference?: string | null;
};

export type AuditActivity = {
  id: string;

  type: AuditEventType;

  createdAt: string;

  countryCode: AdminCountry | null;

  applicationId: string | null;

  applicationReference: string | null;

  actorName: string | null;

  description: string | null;
};

export type AuditFilters = {
  page: number;
  pageSize: number;

  country: AdminCountry | null;

  type: AuditEventType | null;

  search: string | null;
};

export type PaginatedAudit = {
  items: AuditActivity[];

  page: number;

  pageSize: number;

  total: number;

  totalPages: number;
};

export type AuditStatistics = {
  total: number;
  applicationCreated: number;
  applicationApproved: number;
  applicationRejected: number;
  documentsUploaded: number;
  documentsVerified: number;
};

export type AuditWriteResult = {
  id: string;
  type: AuditEventType;
  createdAt: string;
};

export type AuditHistoryResult = {
  activities: PaginatedAudit;
  generatedAt: string;
};

type AuditDatabaseRow = {
  id: string;

  type: string;

  country_code: string | null;

  application_id: string | null;

  application_reference: string | null;

  actor_name: string | null;

  description: string | null;

  created_at: Date | string;
};

type CountRow = {
  total: string | number;
};

type StatisticsRow = {
  total: string | number;
  application_created: string | number;
  application_approved: string | number;
  application_rejected: string | number;
  documents_uploaded: string | number;
  documents_verified: string | number;
};

type SqlFilter = {
  where: string;
  values: string[];
};

/* ============================================================
   4. ERRORS
   ============================================================ */

export type AuditErrorCode =
  | "INVALID_AUDIT_EVENT"
  | "INVALID_AUDIT_FILTER"
  | "INVALID_AUDIT_PAGE"
  | "INVALID_AUDIT_DATA";

export class AdminAuditError extends Error {
  readonly status: number;
  readonly code: AuditErrorCode;

  constructor(
    status: number,
    code: AuditErrorCode
  ) {
    super(code);

    this.name = "AdminAuditError";

    this.status = status;

    this.code = code;
  }
}

export function getAdminAuditError(
  error: unknown
): {
  status: number;
  code: AuditErrorCode;
} | null {
  if (!(error instanceof AdminAuditError)) {
    return null;
  }

  return {
    status: error.status,
    code: error.code,
  };
}

/* ============================================================
   5. DATABASE

   Reuse the shared PostgreSQL pool
   from src/lib/admin/session.ts.

   Do not create another pool.

   IMPORTANT:
   For atomic writes, the caller
   must supply the same PoolClient
   used by the business transaction.
   ============================================================ */

export function getAdminAuditDatabase(): Pool {
  return getAdminSessionDatabase();
}

/* ============================================================
   6. ENUM VALIDATION
   ============================================================ */

export function isAuditEventType(
  value: unknown
): value is AuditEventType {
  return (
    typeof value === "string" &&
    AUDIT_EVENT_TYPES.some(
      (type) => type === value
    )
  );
}

export function isAuditActor(
  value: unknown
): value is AuditActor {
  return (
    value === "ADMIN" ||
    value === "CANDIDATE" ||
    value === "SYSTEM"
  );
}

/* ============================================================
   7. VALIDATION HELPERS
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
    throw new AdminAuditError(
      503,
      "INVALID_AUDIT_DATA"
    );
  }

  return value;
}

function optionalText(
  value: unknown,
  maximum: number
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value !== "string" ||
    value.length > maximum
  ) {
    throw new AdminAuditError(
      503,
      "INVALID_AUDIT_DATA"
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
    throw new AdminAuditError(
      503,
      "INVALID_AUDIT_DATA"
    );
  }

  const number = Number(value);

  if (
    !Number.isSafeInteger(number) ||
    number < 0
  ) {
    throw new AdminAuditError(
      503,
      "INVALID_AUDIT_DATA"
    );
  }

  return number;
}

function isoDate(
  value: Date | string
): string {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new AdminAuditError(
      503,
      "INVALID_AUDIT_DATA"
    );
  }

  return date.toISOString();
}

function isUuid(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    UUID_PATTERN.test(value)
  );
}

/* ============================================================
   8. EVENT DESCRIPTION CATALOG

   Descriptions are generated by
   trusted server-side code.

   Never use descriptions supplied
   directly by an API request body.

   No private identity data, tokens,
   document contents or rejection
   reasons appear in this catalog.

   These stable English descriptions
   identify events internally.

   The frontend may translate
   the event type into German,
   Arabic, Turkish or Spanish.
   ============================================================ */

const EVENT_DESCRIPTIONS:
  Readonly<Record<AuditEventType, string>> = {
    APPLICATION_CREATED:
      "Application created",

    APPLICATION_UPDATED:
      "Application updated",

    APPLICATION_APPROVED:
      "Application approved",

    APPLICATION_REJECTED:
      "Application rejected",

    USER_REGISTERED:
      "Candidate registered",

    EMAIL_VERIFIED:
      "Email address verified",

    PHONE_VERIFIED:
      "Phone number verified",

    DOCUMENT_UPLOADED:
      "Document uploaded",

    DOCUMENT_VERIFIED:
      "Document verified",

    RESERVATION_CREATED:
      "Reservation created",

    OTHER:
      "System activity recorded",
  };

/* ============================================================
   9. ACTOR LABELS

   Never accept an actor name from
   an untrusted request.

   Administrative events are
   attributed to the administrator.

   Candidate and system events
   use generic labels.

   The existing audit schema
   does not include an actor ID.
   ============================================================ */

const ACTOR_NAMES:
  Readonly<Record<AuditActor, string>> = {
    ADMIN: "Administrator",
    CANDIDATE: "Candidate",
    SYSTEM: "System",
  };

/* ============================================================
   10. EVENT / ACTOR RULES

   Administrative decisions must
   come from an admin-authorized
   workflow.

   Some candidate/system events
   are generated by the registration
   or verification APIs.

   Authentication and authorization
   must happen before calling
   this function.

   TypeScript types alone are
   not a security boundary.
   ============================================================ */

function isAllowedActorForEvent(
  type: AuditEventType,
  actor: AuditActor
): boolean {
  switch (type) {
    case "APPLICATION_APPROVED":
    case "APPLICATION_REJECTED":
      return actor === "ADMIN";

    case "DOCUMENT_VERIFIED":
      return actor === "ADMIN";

    case "EMAIL_VERIFIED":
    case "PHONE_VERIFIED":
      return (
        actor === "CANDIDATE" ||
        actor === "SYSTEM"
      );

    case "USER_REGISTERED":
      return (
        actor === "CANDIDATE" ||
        actor === "SYSTEM"
      );

    case "APPLICATION_CREATED":
    case "APPLICATION_UPDATED":
    case "DOCUMENT_UPLOADED":
    case "RESERVATION_CREATED":
      return (
        actor === "ADMIN" ||
        actor === "CANDIDATE" ||
        actor === "SYSTEM"
      );

    case "OTHER":
      return (
        actor === "ADMIN" ||
        actor === "SYSTEM"
      );
  }
}

/* ============================================================
   11. VALIDATE AUDIT INPUT

   Required:
   - Valid event type
   - Trusted actor category
   - Supported country if provided

   Application-specific events
   require a dossier UUID.

   Optional references are strictly
   limited in length.

   No arbitrary metadata object
   is stored in this activity table.
   ============================================================ */

function validateAuditInput(
  input: AuditEventInput
): {
  type: AuditEventType;
  actorName: string;
  countryCode: AdminCountry | null;
  applicationId: string | null;
  applicationReference: string | null;
  description: string;
} {
  if (
    !isAuditEventType(input.type) ||
    !isAuditActor(input.actor)
  ) {
    throw new AdminAuditError(
      400,
      "INVALID_AUDIT_EVENT"
    );
  }

  if (
    !isAllowedActorForEvent(
      input.type,
      input.actor
    )
  ) {
    throw new AdminAuditError(
      403,
      "INVALID_AUDIT_EVENT"
    );
  }

  let countryCode: AdminCountry | null =
    null;

  if (
    input.countryCode !== null &&
    input.countryCode !== undefined
  ) {
    if (
      !isSupportedAdminCountry(
        input.countryCode
      )
    ) {
      throw new AdminAuditError(
        400,
        "INVALID_AUDIT_EVENT"
      );
    }

    countryCode = input.countryCode;
  }

  let applicationId: string | null =
    null;

  if (
    input.applicationId !== null &&
    input.applicationId !== undefined
  ) {
    if (!isUuid(input.applicationId)) {
      throw new AdminAuditError(
        400,
        "INVALID_AUDIT_EVENT"
      );
    }

    applicationId =
      input.applicationId.toLowerCase();
  }

  let applicationReference: string | null =
    null;

  if (
    input.applicationReference !== null &&
    input.applicationReference !== undefined
  ) {
    const reference =
      input.applicationReference.trim();

    /*
     * Reference comes from the
     * authoritative database row,
     * not directly from a browser.
     */

    if (
      reference.length === 0 ||
      reference.length >
        MAX_REFERENCE_LENGTH ||
      !/^[\p{L}\p{N}._/-]+$/u.test(
        reference
      )
    ) {
      throw new AdminAuditError(
        400,
        "INVALID_AUDIT_EVENT"
      );
    }

    applicationReference = reference;
  }

  const applicationEvents:
    ReadonlySet<AuditEventType> =
      new Set([
        "APPLICATION_CREATED",
        "APPLICATION_UPDATED",
        "APPLICATION_APPROVED",
        "APPLICATION_REJECTED",
        "DOCUMENT_UPLOADED",
        "DOCUMENT_VERIFIED",
      ]);

  if (
    applicationEvents.has(input.type) &&
    applicationId === null
  ) {
    throw new AdminAuditError(
      400,
      "INVALID_AUDIT_EVENT"
    );
  }

  /*
   * The dashboard can display a
   * country-specific activity if
   * its source provided a country.
   */

  const description =
    EVENT_DESCRIPTIONS[input.type];

  if (
    description.length >
    MAX_DESCRIPTION_LENGTH
  ) {
    throw new AdminAuditError(
      503,
      "INVALID_AUDIT_DATA"
    );
  }

  const actorName =
    ACTOR_NAMES[input.actor];

  if (
    actorName.length >
    MAX_ACTOR_LENGTH
  ) {
    throw new AdminAuditError(
      503,
      "INVALID_AUDIT_DATA"
    );
  }

  return {
    type: input.type,
    actorName,
    countryCode,
    applicationId,
    applicationReference,
    description,
  };
}

/* ============================================================
   12. WRITE AUDIT EVENT

   CRITICAL:
   Accepts a PoolClient, not Pool.

   Caller must provide a client
   obtained from pool.connect().

   For business events:
   - BEGIN before calling
   - Perform business changes
   - Write audit event
   - COMMIT both together

   If audit insertion fails,
   the transaction must roll back.

   The function never commits
   or rolls back the transaction
   on behalf of the caller.

   It does not authenticate users:
   the trusted caller must already
   have completed authorization.
   ============================================================ */

export async function writeAdminAuditEvent(
  client: PoolClient,
  input: AuditEventInput
): Promise<AuditWriteResult> {
  const event =
    validateAuditInput(input);

  const id = randomUUID();

  const result =
    await client.query<{
      id: string;
      type: string;
      created_at: Date | string;
    }>(
      `
      INSERT INTO taym_admin_activity_logs (
        id,
        type,
        country_code,
        application_id,
        application_reference,
        actor_name,
        description,
        created_at
      )
      VALUES (
        $1::uuid,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        NOW()
      )
      RETURNING
        id::text AS id,
        type,
        created_at
      `,
      [
        id,
        event.type,
        event.countryCode,
        event.applicationId,
        event.applicationReference,
        event.actorName,
        event.description,
      ]
    );

  const row = result.rows[0];

  if (
    !row ||
    row.id !== id ||
    row.type !== event.type
  ) {
    throw new AdminAuditError(
      503,
      "INVALID_AUDIT_DATA"
    );
  }

  return {
    id: row.id,
    type: event.type,
    createdAt: isoDate(row.created_at),
  };
}

/* ============================================================
   13. DECISION AUDIT HELPER

   Called inside the decision API
   AFTER authorization and AFTER
   the dossier row has been locked.

   Both the decision and the audit
   event must use the SAME client.

   Rejection reasons are NOT stored
   in the general timeline.
   ============================================================ */

export async function auditApplicationDecision(
  client: PoolClient,
  input: {
    applicationId: string;
    applicationReference: string;
    countryCode: AdminCountry;
    decision: "APPROVED" | "REJECTED";
  }
): Promise<AuditWriteResult> {
  return writeAdminAuditEvent(
    client,
    {
      type:
        input.decision === "APPROVED"
          ? "APPLICATION_APPROVED"
          : "APPLICATION_REJECTED",

      actor: "ADMIN",

      countryCode: input.countryCode,

      applicationId:
        input.applicationId,

      applicationReference:
        input.applicationReference,
    }
  );
}

/* ============================================================
   14. APPLICATION CREATED HELPER

   Call after successfully creating
   a candidate's application.

   Must be included in the same
   transaction as the application
   INSERT whenever possible.
   ============================================================ */

export async function auditApplicationCreated(
  client: PoolClient,
  input: {
    applicationId: string;
    applicationReference: string;
    countryCode: AdminCountry;
    actor?: "CANDIDATE" | "ADMIN" | "SYSTEM";
  }
): Promise<AuditWriteResult> {
  return writeAdminAuditEvent(
    client,
    {
      type: "APPLICATION_CREATED",

      actor:
        input.actor ?? "CANDIDATE",

      applicationId:
        input.applicationId,

      applicationReference:
        input.applicationReference,

      countryCode:
        input.countryCode,
    }
  );
}

/* ============================================================
   15. APPLICATION UPDATED HELPER
   ============================================================ */

export async function auditApplicationUpdated(
  client: PoolClient,
  input: {
    applicationId: string;
    applicationReference: string;
    countryCode: AdminCountry;
    actor: AuditActor;
  }
): Promise<AuditWriteResult> {
  return writeAdminAuditEvent(
    client,
    {
      type: "APPLICATION_UPDATED",

      actor: input.actor,

      countryCode: input.countryCode,

      applicationId:
        input.applicationId,

      applicationReference:
        input.applicationReference,
    }
  );
}

/* ============================================================
   16. DOCUMENT AUDIT HELPERS

   Do not record:
   - Filename
   - Storage key
   - ID card number
   - Document bytes
   - Verification code

   The application reference
   identifies the dossier.
   ============================================================ */

export async function auditDocumentUploaded(
  client: PoolClient,
  input: {
    applicationId: string;
    applicationReference: string;
    countryCode: AdminCountry;
    actor?: "CANDIDATE" | "ADMIN" | "SYSTEM";
  }
): Promise<AuditWriteResult> {
  return writeAdminAuditEvent(
    client,
    {
      type: "DOCUMENT_UPLOADED",

      actor:
        input.actor ?? "CANDIDATE",

      countryCode:
        input.countryCode,

      applicationId:
        input.applicationId,

      applicationReference:
        input.applicationReference,
    }
  );
}

export async function auditDocumentVerified(
  client: PoolClient,
  input: {
    applicationId: string;
    applicationReference: string;
    countryCode: AdminCountry;
  }
): Promise<AuditWriteResult> {
  return writeAdminAuditEvent(
    client,
    {
      type: "DOCUMENT_VERIFIED",

      actor: "ADMIN",

      countryCode:
        input.countryCode,

      applicationId:
        input.applicationId,

      applicationReference:
        input.applicationReference,
    }
  );
}

/* ============================================================
   17. REGISTRATION AND VERIFICATION

   These events are generated by
   the trusted public backend.

   They should be inserted only
   after genuine verification
   or registration success.

   Never accept a browser flag
   saying "verified" as proof.
   ============================================================ */

export async function auditCandidateRegistered(
  client: PoolClient,
  countryCode: AdminCountry
): Promise<AuditWriteResult> {
  return writeAdminAuditEvent(
    client,
    {
      type: "USER_REGISTERED",
      actor: "SYSTEM",
      countryCode,
    }
  );
}

export async function auditEmailVerified(
  client: PoolClient,
  countryCode: AdminCountry
): Promise<AuditWriteResult> {
  return writeAdminAuditEvent(
    client,
    {
      type: "EMAIL_VERIFIED",
      actor: "SYSTEM",
      countryCode,
    }
  );
}

export async function auditPhoneVerified(
  client: PoolClient,
  countryCode: AdminCountry
): Promise<AuditWriteResult> {
  return writeAdminAuditEvent(
    client,
    {
      type: "PHONE_VERIFIED",
      actor: "SYSTEM",
      countryCode,
    }
  );
}

/* ============================================================
   18. RESERVATION EVENT

   Use only after a real booking
   has been written successfully.

   No simulated reservations.
   ============================================================ */

export async function auditReservationCreated(
  client: PoolClient,
  countryCode: AdminCountry
): Promise<AuditWriteResult> {
  return writeAdminAuditEvent(
    client,
    {
      type: "RESERVATION_CREATED",

      actor: "SYSTEM",

      countryCode,
    }
  );
}

/* ============================================================
   19. OTHER SYSTEM EVENT

   The current dashboard supports
   the type OTHER.

   This helper records a generic
   system event without arbitrary
   descriptions.

   For richer security auditing,
   add dedicated event types and
   columns through a migration.
   ============================================================ */

export async function auditSystemEvent(
  client: PoolClient,
  countryCode?: AdminCountry | null
): Promise<AuditWriteResult> {
  return writeAdminAuditEvent(
    client,
    {
      type: "OTHER",

      actor: "SYSTEM",

      countryCode:
        countryCode ?? null,
    }
  );
}

/* ============================================================
   20. FILTER VALIDATION
   ============================================================ */

function parseInteger(
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

export function parseAdminAuditFilters(
  params: URLSearchParams
): AuditFilters {
  const allowed = new Set([
    "page",
    "pageSize",
    "country",
    "type",
    "search",
  ]);

  if (
    [...params.keys()].length > 5
  ) {
    throw new AdminAuditError(
      400,
      "INVALID_AUDIT_FILTER"
    );
  }

  for (const key of params.keys()) {
    if (
      !allowed.has(key) ||
      params.getAll(key).length !== 1
    ) {
      throw new AdminAuditError(
        400,
        "INVALID_AUDIT_FILTER"
      );
    }
  }

  const page = parseInteger(
    params.get("page"),
    AUDIT_DEFAULT_PAGE,
    AUDIT_MAX_PAGE
  );

  const pageSize = parseInteger(
    params.get("pageSize"),
    AUDIT_DEFAULT_PAGE_SIZE,
    AUDIT_MAX_PAGE_SIZE
  );

  if (
    page === null ||
    pageSize === null
  ) {
    throw new AdminAuditError(
      400,
      "INVALID_AUDIT_FILTER"
    );
  }

  const countryRaw =
    params.get("country");

  let country: AdminCountry | null =
    null;

  if (
    countryRaw !== null &&
    countryRaw !== "ALL"
  ) {
    if (
      !isSupportedAdminCountry(countryRaw)
    ) {
      throw new AdminAuditError(
        400,
        "INVALID_AUDIT_FILTER"
      );
    }

    country = countryRaw;
  }

  const typeRaw =
    params.get("type");

  let type: AuditEventType | null =
    null;

  if (
    typeRaw !== null &&
    typeRaw !== "ALL"
  ) {
    if (!isAuditEventType(typeRaw)) {
      throw new AdminAuditError(
        400,
        "INVALID_AUDIT_FILTER"
      );
    }

    type = typeRaw;
  }

  const searchRaw =
    params.get("search");

  let search: string | null = null;

  if (searchRaw !== null) {
    const normalized =
      searchRaw.normalize("NFC").trim();

    if (
      normalized.length >
        AUDIT_MAX_SEARCH_LENGTH ||
      /[\u0000-\u001f\u007f]/u.test(
        normalized
      )
    ) {
      throw new AdminAuditError(
        400,
        "INVALID_AUDIT_FILTER"
      );
    }

    search = normalized || null;
  }

  return {
    page,
    pageSize,
    country,
    type,
    search,
  };
}

/* ============================================================
   21. BUILD SAFE SQL FILTERS

   All user-controlled values are
   SQL parameters.

   No browser-controlled column
   or table names.

   Search includes:
   - Actor label
   - Application reference
   - Event description

   POSITION() treats % and _
   as ordinary characters.
   ============================================================ */

function buildAuditFilter(
  filters: AuditFilters
): SqlFilter {
  const conditions: string[] = [];

  const values: string[] = [];

  if (filters.country) {
    values.push(filters.country);

    conditions.push(
      `country_code = $${values.length}`
    );
  }

  if (filters.type) {
    values.push(filters.type);

    conditions.push(
      `type = $${values.length}`
    );
  }

  if (filters.search) {
    values.push(
      filters.search.toLowerCase()
    );

    const parameter =
      `$${values.length}`;

    conditions.push(
      `(
        POSITION(
          ${parameter}
          IN LOWER(
            COALESCE(actor_name, '')
          )
        ) > 0

        OR POSITION(
          ${parameter}
          IN LOWER(
            COALESCE(
              application_reference,
              ''
            )
          )
        ) > 0

        OR POSITION(
          ${parameter}
          IN LOWER(
            COALESCE(description, '')
          )
        ) > 0
      )`
    );
  }

  return {
    where:
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "",

    values,
  };
}

/* ============================================================
   22. MAP ACTIVITY ROW

   Matches the existing dashboard
   response contract:

   {
     id,
     type,
     createdAt,
     countryCode,
     applicationId,
     applicationReference,
     actorName,
     description
   }
   ============================================================ */

function mapAuditActivity(
  row: AuditDatabaseRow
): AuditActivity {
  if (!isAuditEventType(row.type)) {
    throw new AdminAuditError(
      503,
      "INVALID_AUDIT_DATA"
    );
  }

  if (
    row.country_code !== null &&
    !isSupportedAdminCountry(
      row.country_code
    )
  ) {
    throw new AdminAuditError(
      503,
      "INVALID_AUDIT_DATA"
    );
  }

  return {
    id: requiredText(row.id, 150),

    type: row.type,

    createdAt:
      isoDate(row.created_at),

    countryCode:
      row.country_code,

    applicationId:
      optionalText(
        row.application_id,
        150
      ),

    applicationReference:
      optionalText(
        row.application_reference,
        MAX_REFERENCE_LENGTH
      ),

    actorName:
      optionalText(
        row.actor_name,
        MAX_ACTOR_LENGTH
      ),

    description:
      optionalText(
        row.description,
        MAX_DESCRIPTION_LENGTH
      ),
  };
}

/* ============================================================
   23. COUNT MATCHING ACTIVITIES
   ============================================================ */

async function countAuditActivities(
  database: AuditDatabase,
  filter: SqlFilter
): Promise<number> {
  const result =
    await database.query<CountRow>(
      `
      SELECT COUNT(*) AS total

      FROM taym_admin_activity_logs

      ${filter.where}
      `,
      filter.values
    );

  return safeCount(
    result.rows[0]?.total
  );
}

/* ============================================================
   24. READ PAGINATED ACTIVITIES
   ============================================================ */

async function findAuditPage(
  database: AuditDatabase,
  filter: SqlFilter,
  page: number,
  pageSize: number
): Promise<AuditActivity[]> {
  const offset =
    (page - 1) * pageSize;

  const limitPosition =
    filter.values.length + 1;

  const offsetPosition =
    filter.values.length + 2;

  const result =
    await database.query<AuditDatabaseRow>(
      `
      SELECT
        id::text AS id,
        type,
        country_code,
        application_id,
        application_reference,
        actor_name,
        description,
        created_at

      FROM taym_admin_activity_logs

      ${filter.where}

      ORDER BY
        created_at DESC,
        id DESC

      LIMIT $${limitPosition}

      OFFSET $${offsetPosition}
      `,
      [
        ...filter.values,
        pageSize,
        offset,
      ]
    );

  return result.rows.map(
    mapAuditActivity
  );
}

/* ============================================================
   25. LOW-LEVEL AUDIT READER

   This function does NOT verify
   administrator permissions.

   Only use from trusted server
   code after authorization.

   The protected reader below
   performs authorization first.
   ============================================================ */

export async function readAuditHistoryFromDatabase(
  filters: AuditFilters,
  database: AuditDatabase
): Promise<PaginatedAudit> {
  const filter =
    buildAuditFilter(filters);

  const total =
    await countAuditActivities(
      database,
      filter
    );

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        total / filters.pageSize
      )
    );

  if (filters.page > totalPages) {
    throw new AdminAuditError(
      400,
      "INVALID_AUDIT_PAGE"
    );
  }

  const items =
    await findAuditPage(
      database,
      filter,
      filters.page,
      filters.pageSize
    );

  return {
    items,

    page: filters.page,

    pageSize: filters.pageSize,

    total,

    totalPages,
  };
}

/* ============================================================
   26. PROTECTED AUDIT HISTORY

   Server-side session check:
   ADMIN_AUDIT_READ

   PostgreSQL transaction:
   REPEATABLE READ / READ ONLY

   A consistent snapshot ensures
   the total count and paginated
   activities agree.

   An unauthorized request cannot
   read historical activity.
   ============================================================ */

export async function getAdminAuditHistory(
  request: NextRequest,
  filters: AuditFilters
): Promise<AuditHistoryResult> {
  const pool =
    getAdminAuditDatabase();

  const client =
    await pool.connect();

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
      "ADMIN_AUDIT_READ",
      client
    );

    const activities =
      await readAuditHistoryFromDatabase(
        filters,
        client
      );

    await client.query("COMMIT");

    transactionOpen = false;

    return {
      activities,

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
   27. AUDIT STATISTICS

   Reads actual counts from
   taym_admin_activity_logs.

   Unlike application statistics,
   these are counts of EVENTS,
   not counts of candidate dossiers.

   One application may generate
   multiple events.
   ============================================================ */

export async function readAdminAuditStatistics(
  database: AuditDatabase
): Promise<AuditStatistics> {
  const result =
    await database.query<StatisticsRow>(
      `
      SELECT
        COUNT(*) AS total,

        COUNT(*) FILTER (
          WHERE type = 'APPLICATION_CREATED'
        ) AS application_created,

        COUNT(*) FILTER (
          WHERE type = 'APPLICATION_APPROVED'
        ) AS application_approved,

        COUNT(*) FILTER (
          WHERE type = 'APPLICATION_REJECTED'
        ) AS application_rejected,

        COUNT(*) FILTER (
          WHERE type = 'DOCUMENT_UPLOADED'
        ) AS documents_uploaded,

        COUNT(*) FILTER (
          WHERE type = 'DOCUMENT_VERIFIED'
        ) AS documents_verified

      FROM taym_admin_activity_logs
      `
    );

  const row = result.rows[0];

  if (!row) {
    throw new AdminAuditError(
      503,
      "INVALID_AUDIT_DATA"
    );
  }

  return {
    total:
      safeCount(row.total),

    applicationCreated:
      safeCount(
        row.application_created
      ),

    applicationApproved:
      safeCount(
        row.application_approved
      ),

    applicationRejected:
      safeCount(
        row.application_rejected
      ),

    documentsUploaded:
      safeCount(
        row.documents_uploaded
      ),

    documentsVerified:
      safeCount(
        row.documents_verified
      ),
  };
}

/* ============================================================
   28. PROTECTED AUDIT STATISTICS

   This wrapper requires a valid
   administrator request.

   Use this function when serving
   audit statistics over HTTP.
   ============================================================ */

export async function getAdminAuditStatistics(
  request: NextRequest
): Promise<AuditStatistics> {
  const pool =
    getAdminAuditDatabase();

  const client =
    await pool.connect();

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
      "ADMIN_AUDIT_READ",
      client
    );

    const statistics =
      await readAdminAuditStatistics(
        client
      );

    await client.query("COMMIT");

    transactionOpen = false;

    return statistics;
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
   END — FAHRSCHULE TAYM
   ============================================================ */
