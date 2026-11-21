
import "server-only";

import type {
  NextRequest,
} from "next/server";

import type {
  Pool,
  PoolClient,
} from "pg";

import {
  ADMIN_SESSION_COOKIE,
  getAdminSessionFromToken,
  getAdminSessionDatabase,
  type AdminSession,
} from "@/lib/admin/session";

/* ============================================================
   FAHRSCHULE TAYM
   ADMIN PERMISSIONS & ACCESS CONTROL

   FILE:
   src/lib/admin/permissions.ts

   PURPOSE:
   - Verify administrator access
   - Protect administrative API routes
   - Authorize application access
   - Authorize private document access
   - Check application status transitions
   - Prevent cross-application document access
   - Enforce supported countries
   - Centralize permission errors

   ADMINISTRATOR:
   One primary administrator.

   AUTHENTICATION:
   PostgreSQL-backed session.

   SESSION COOKIE:
   taym_admin_session

   DATABASE:
   taym_admin_sessions
   taym_driving_license_applications
   taym_application_documents

   SECURITY:
   - Server-only module
   - No browser-controlled roles
   - No browser-controlled admin ID
   - Strict UUID validation
   - Parameterized PostgreSQL queries
   - Session expiry and revocation checks
   - Private document ownership checks
   - Minimal authorization metadata
   - No document contents or storage keys
     in public API responses
   ============================================================ */

/* ============================================================
   1. CONSTANTS
   ============================================================ */

export const SUPPORTED_ADMIN_COUNTRIES = [
  "DE",
  "AT",
  "BE",
  "IT",
  "ES",
] as const;

export const APPLICATION_STATUSES = [
  "PENDING",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
] as const;

export const DOCUMENT_TYPES = [
  "IDENTITY_FRONT",
  "IDENTITY_BACK",
  "PROOF_OF_ADDRESS",
  "PORTRAIT",
  "SIGNATURE",
  "OTHER",
] as const;

export const DOCUMENT_VERIFICATION_STATUSES = [
  "PENDING",
  "VERIFIED",
  "REJECTED",
  "NOT_REQUIRED",
] as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/* ============================================================
   2. TYPES
   ============================================================ */

export type AdminCountry =
  (typeof SUPPORTED_ADMIN_COUNTRIES)[number];

export type AdminApplicationStatus =
  (typeof APPLICATION_STATUSES)[number];

export type AdminDocumentType =
  (typeof DOCUMENT_TYPES)[number];

export type AdminDocumentVerificationStatus =
  (typeof DOCUMENT_VERIFICATION_STATUSES)[number];

export type AdminDecision =
  | "APPROVED"
  | "REJECTED";

export type AdminPermission =
  | "ADMIN_DASHBOARD_READ"
  | "ADMIN_APPLICATION_LIST"
  | "ADMIN_APPLICATION_READ"
  | "ADMIN_APPLICATION_DECIDE"
  | "ADMIN_DOCUMENT_READ"
  | "ADMIN_AUDIT_READ";

export type AdminPermissionDatabase =
  Pool | PoolClient;

export type AuthorizedAdmin = {
  adminId: "primary";
  role: "ADMIN";
  session: AdminSession;
};

export type AuthorizedApplication = {
  id: string;
  reference: string;
  countryCode: AdminCountry;
  status: AdminApplicationStatus;
  createdAt: string;
  updatedAt: string;
};

export type AuthorizedDocument = {
  id: string;
  applicationId: string;

  documentType: AdminDocumentType;

  verificationStatus:
    AdminDocumentVerificationStatus;

  fileName: string | null;
  mimeType: string | null;

  /*
   * Sensitive internal storage key.
   *
   * Only for server-side storage
   * adapters after authorization.
   *
   * Never serialize this object
   * directly into public JSON.
   */
  storageKey: string;
};

export type ApplicationAccessContext = {
  admin: AuthorizedAdmin;
  application: AuthorizedApplication;
};

export type DocumentAccessContext = {
  admin: AuthorizedAdmin;
  application: AuthorizedApplication;
  document: AuthorizedDocument;
};

export type DecisionTransitionResult =
  | {
      allowed: true;
      nextStatus: AdminDecision;
    }
  | {
      allowed: false;
      reason:
        | "ALREADY_DECIDED"
        | "INVALID_TRANSITION";
    };

/* ============================================================
   3. PERMISSION ERRORS

   Authentication:
   401

   Invalid identifiers:
   400

   Unsupported operation:
   403

   Missing protected resource:
   404

   Conflicting transition:
   409

   Database failures are NOT
   converted into access success.
   ============================================================ */

export type AdminPermissionErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_APPLICATION_ID"
  | "INVALID_DOCUMENT_ID"
  | "APPLICATION_NOT_FOUND"
  | "DOCUMENT_NOT_FOUND"
  | "ALREADY_DECIDED"
  | "INVALID_TRANSITION";

export class AdminPermissionError extends Error {
  readonly status: number;
  readonly code: AdminPermissionErrorCode;

  constructor(
    status: number,
    code: AdminPermissionErrorCode
  ) {
    super(code);

    this.name = "AdminPermissionError";
    this.status = status;
    this.code = code;

    Object.setPrototypeOf(
      this,
      AdminPermissionError.prototype
    );
  }
}

/* ============================================================
   4. DATABASE ACCESS

   Reuse the same PostgreSQL pool
   as the administrator session.

   A PoolClient may be provided
   by an existing transaction.

   IMPORTANT:
   Use the same PoolClient for
   permission checks that must
   be part of an atomic decision.
   ============================================================ */

function resolveDatabase(
  database?: AdminPermissionDatabase
): AdminPermissionDatabase {
  return database ?? getAdminSessionDatabase();
}

/* ============================================================
   5. ALLOWED VALUE VALIDATION
   ============================================================ */

export function isSupportedAdminCountry(
  value: unknown
): value is AdminCountry {
  return (
    typeof value === "string" &&
    SUPPORTED_ADMIN_COUNTRIES.some(
      (country) => country === value
    )
  );
}

export function isAdminApplicationStatus(
  value: unknown
): value is AdminApplicationStatus {
  return (
    typeof value === "string" &&
    APPLICATION_STATUSES.some(
      (status) => status === value
    )
  );
}

export function isAdminDocumentType(
  value: unknown
): value is AdminDocumentType {
  return (
    typeof value === "string" &&
    DOCUMENT_TYPES.some(
      (type) => type === value
    )
  );
}

export function isAdminDocumentVerificationStatus(
  value: unknown
): value is AdminDocumentVerificationStatus {
  return (
    typeof value === "string" &&
    DOCUMENT_VERIFICATION_STATUSES.some(
      (status) => status === value
    )
  );
}

export function isAdminDecision(
  value: unknown
): value is AdminDecision {
  return (
    value === "APPROVED" ||
    value === "REJECTED"
  );
}

/* ============================================================
   6. UUID VALIDATION

   Application and document IDs
   are generated by PostgreSQL or
   the trusted backend.

   Do not accept:
   - File paths
   - Email addresses
   - Arbitrary search expressions
   - URL fragments
   - SQL expressions

   Only valid UUID identifiers.
   ============================================================ */

export function normalizeAdminUuid(
  value: unknown
): string | null {
  if (
    typeof value !== "string" ||
    !UUID_PATTERN.test(value)
  ) {
    return null;
  }

  return value.toLowerCase();
}

export function requireApplicationId(
  value: unknown
): string {
  const id = normalizeAdminUuid(value);

  if (!id) {
    throw new AdminPermissionError(
      400,
      "INVALID_APPLICATION_ID"
    );
  }

  return id;
}

export function requireDocumentId(
  value: unknown
): string {
  const id = normalizeAdminUuid(value);

  if (!id) {
    throw new AdminPermissionError(
      400,
      "INVALID_DOCUMENT_ID"
    );
  }

  return id;
}

/* ============================================================
   7. PERMISSION POLICY

   Only the primary administrator
   can access these functions.

   No arbitrary role string from
   request headers or JSON bodies
   is accepted.

   Permissions are checked in
   the server-side session context.
   ============================================================ */

const PRIMARY_ADMIN_PERMISSIONS:
  ReadonlySet<AdminPermission> =
    new Set<AdminPermission>([
      "ADMIN_DASHBOARD_READ",
      "ADMIN_APPLICATION_LIST",
      "ADMIN_APPLICATION_READ",
      "ADMIN_APPLICATION_DECIDE",
      "ADMIN_DOCUMENT_READ",
      "ADMIN_AUDIT_READ",
    ]);

export function hasAdminPermission(
  admin: AuthorizedAdmin,
  permission: AdminPermission
): boolean {
  return (
    admin.adminId === "primary" &&
    admin.role === "ADMIN" &&
    admin.session.adminId === "primary" &&
    admin.session.role === "ADMIN" &&
    PRIMARY_ADMIN_PERMISSIONS.has(permission)
  );
}

export function requireAdminPermission(
  admin: AuthorizedAdmin,
  permission: AdminPermission
): void {
  if (
    !hasAdminPermission(admin, permission)
  ) {
    throw new AdminPermissionError(
      403,
      "FORBIDDEN"
    );
  }
}

/* ============================================================
   8. AUTHENTICATE ADMIN REQUEST

   Every protected API operation
   must verify the session against
   PostgreSQL.

   The module does NOT trust:
   - Client role
   - Client administrator ID
   - localStorage
   - Session cookie presence alone

   Expired/revoked sessions return
   UNAUTHENTICATED.

   Database errors propagate to
   the route, which should fail
   closed with HTTP 503.
   ============================================================ */

export async function requireAdminRequest(
  request: NextRequest,
  permission: AdminPermission,
  database?: AdminPermissionDatabase
): Promise<AuthorizedAdmin> {
  const token = request.cookies.get(
    ADMIN_SESSION_COOKIE
  )?.value;

  if (!token) {
    throw new AdminPermissionError(
      401,
      "UNAUTHENTICATED"
    );
  }

  const session = await getAdminSessionFromToken(
    token,
    resolveDatabase(database)
  );

  if (!session) {
    throw new AdminPermissionError(
      401,
      "UNAUTHENTICATED"
    );
  }

  const admin: AuthorizedAdmin = {
    adminId: "primary",
    role: "ADMIN",
    session,
  };

  requireAdminPermission(
    admin,
    permission
  );

  return admin;
}

/* ============================================================
   9. APPLICATION ROW TYPES
   ============================================================ */

type ApplicationRow = {
  id: string;
  reference: string;
  country_code: string;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type DocumentRow = {
  id: string;
  application_id: string;
  document_type: string;
  verification_status: string;
  file_name: string | null;
  mime_type: string | null;
  storage_key: string;
};

/* ============================================================
   10. DATE AND DATABASE MAPPING
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
    throw new Error(
      "INVALID_ADMIN_RESOURCE_DATE"
    );
  }

  return date.toISOString();
}

function requiredText(
  value: unknown,
  maximum: number
): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maximum
  ) {
    throw new Error(
      "INVALID_ADMIN_RESOURCE_DATA"
    );
  }

  return value;
}

function mapApplication(
  row: ApplicationRow
): AuthorizedApplication {
  if (
    !isSupportedAdminCountry(
      row.country_code
    ) ||
    !isAdminApplicationStatus(
      row.status
    )
  ) {
    throw new Error(
      "INVALID_APPLICATION_ENUM"
    );
  }

  return {
    id: requiredText(row.id, 150),

    reference: requiredText(
      row.reference,
      120
    ),

    countryCode:
      row.country_code,

    status:
      row.status,

    createdAt:
      toIsoDate(row.created_at),

    updatedAt:
      toIsoDate(row.updated_at),
  };
}

function mapDocument(
  row: DocumentRow
): AuthorizedDocument {
  if (
    !isAdminDocumentType(
      row.document_type
    ) ||
    !isAdminDocumentVerificationStatus(
      row.verification_status
    )
  ) {
    throw new Error(
      "INVALID_DOCUMENT_ENUM"
    );
  }

  return {
    id: requiredText(row.id, 150),

    applicationId: requiredText(
      row.application_id,
      150
    ),

    documentType:
      row.document_type,

    verificationStatus:
      row.verification_status,

    fileName:
      row.file_name,

    mimeType:
      row.mime_type,

    storageKey:
      requiredText(
        row.storage_key,
        1024
      ),
  };
}

/* ============================================================
   11. READ AN APPLICATION

   The query checks:
   - Requested UUID
   - Supported country

   Only minimum authorization
   metadata is returned.

   Detailed candidate information
   is retrieved separately by the
   protected detail API.
   ============================================================ */

async function findApplication(
  applicationId: string,
  database: AdminPermissionDatabase
): Promise<AuthorizedApplication | null> {
  const result =
    await database.query<ApplicationRow>(
      `
      SELECT
        id::text AS id,
        reference,
        country_code,
        status,
        created_at,
        updated_at

      FROM
        taym_driving_license_applications

      WHERE
        id = $1::uuid

        AND country_code IN (
          'DE',
          'AT',
          'BE',
          'IT',
          'ES'
        )

      LIMIT 1
      `,
      [applicationId]
    );

  const row = result.rows[0];

  return row
    ? mapApplication(row)
    : null;
}

/* ============================================================
   12. REQUIRE APPLICATION ACCESS

   Authorizes a candidate dossier.

   Steps:
   1. Validate ID
   2. Validate admin session
   3. Check permission
   4. Read actual application
   5. Return minimal metadata

   No application is exposed
   to an unauthenticated user.
   ============================================================ */

export async function requireApplicationAccess(
  request: NextRequest,
  rawApplicationId: unknown,
  options?: {
    permission?: AdminPermission;
    database?: AdminPermissionDatabase;
  }
): Promise<ApplicationAccessContext> {
  /*
   * Authenticate first, so an
   * unauthenticated caller cannot
   * probe ID validation behavior.
   */

  const database =
    resolveDatabase(options?.database);

  const permission =
    options?.permission ??
    "ADMIN_APPLICATION_READ";

  const admin =
    await requireAdminRequest(
      request,
      permission,
      database
    );

  const applicationId =
    requireApplicationId(
      rawApplicationId
    );

  const application =
    await findApplication(
      applicationId,
      database
    );

  if (!application) {
    throw new AdminPermissionError(
      404,
      "APPLICATION_NOT_FOUND"
    );
  }

  return {
    admin,
    application,
  };
}

/* ============================================================
   13. DOCUMENT OWNERSHIP LOOKUP

   A document must belong to the
   exact application ID requested.

   Database JOIN ensures:
   - Application exists
   - Document exists
   - Document belongs to application

   A document from another dossier
   is treated as NOT FOUND.

   No direct access by document ID
   alone is allowed.
   ============================================================ */

async function findDocumentInApplication(
  applicationId: string,
  documentId: string,
  database: AdminPermissionDatabase
): Promise<AuthorizedDocument | null> {
  const result =
    await database.query<DocumentRow>(
      `
      SELECT
        d.id::text AS id,

        d.application_id::text
          AS application_id,

        d.document_type,

        d.verification_status,

        d.file_name,

        d.mime_type,

        d.storage_key

      FROM
        taym_application_documents d

      INNER JOIN
        taym_driving_license_applications a

        ON a.id = d.application_id

      WHERE
        d.id = $1::uuid

        AND d.application_id = $2::uuid

        AND a.country_code IN (
          'DE',
          'AT',
          'BE',
          'IT',
          'ES'
        )

      LIMIT 1
      `,
      [
        documentId,
        applicationId,
      ]
    );

  const row = result.rows[0];

  return row
    ? mapDocument(row)
    : null;
}

/* ============================================================
   14. REQUIRE DOCUMENT ACCESS

   Protected document authorization.

   Steps:
   1. Verify administrator session
   2. Validate application ID
   3. Validate document ID
   4. Verify application exists
   5. Verify document belongs to it
   6. Return server-only metadata

   IMPORTANT:
   The returned storageKey must
   only be used by trusted backend
   code to retrieve private bytes.

   Never return this object directly
   through NextResponse.json().
   ============================================================ */

export async function requireDocumentAccess(
  request: NextRequest,
  rawApplicationId: unknown,
  rawDocumentId: unknown,
  options?: {
    database?: AdminPermissionDatabase;
  }
): Promise<DocumentAccessContext> {
  const database =
    resolveDatabase(options?.database);

  const admin =
    await requireAdminRequest(
      request,
      "ADMIN_DOCUMENT_READ",
      database
    );

  const applicationId =
    requireApplicationId(
      rawApplicationId
    );

  const documentId =
    requireDocumentId(
      rawDocumentId
    );

  const application =
    await findApplication(
      applicationId,
      database
    );

  if (!application) {
    throw new AdminPermissionError(
      404,
      "APPLICATION_NOT_FOUND"
    );
  }

  const document =
    await findDocumentInApplication(
      applicationId,
      documentId,
      database
    );

  if (!document) {
    throw new AdminPermissionError(
      404,
      "DOCUMENT_NOT_FOUND"
    );
  }

  /*
   * Defense in depth:
   * Verify both identifiers after
   * mapping database results.
   */

  if (
    document.id !== documentId ||
    document.applicationId !== applicationId
  ) {
    throw new Error(
      "DOCUMENT_OWNERSHIP_MISMATCH"
    );
  }

  return {
    admin,
    application,
    document,
  };
}

/* ============================================================
   15. APPLICATION DECISION RULES

   Only pending or in-review
   applications may receive
   a new final decision.

   Allowed:
   PENDING -> APPROVED
   PENDING -> REJECTED

   IN_REVIEW -> APPROVED
   IN_REVIEW -> REJECTED

   Not allowed:
   APPROVED -> REJECTED
   REJECTED -> APPROVED

   A new procedure for reopening
   rejected applications would
   require a separate authorized
   workflow and audit record.
   ============================================================ */

export function checkApplicationDecisionTransition(
  currentStatus: AdminApplicationStatus,
  decision: AdminDecision
): DecisionTransitionResult {
  if (
    currentStatus === "APPROVED" ||
    currentStatus === "REJECTED"
  ) {
    return {
      allowed: false,
      reason: "ALREADY_DECIDED",
    };
  }

  if (
    currentStatus !== "PENDING" &&
    currentStatus !== "IN_REVIEW"
  ) {
    return {
      allowed: false,
      reason: "INVALID_TRANSITION",
    };
  }

  return {
    allowed: true,
    nextStatus: decision,
  };
}

/* ============================================================
   16. REQUIRE VALID TRANSITION

   Throws an explicit 409 error
   when the requested transition
   is forbidden.

   This function should be called
   after locking the application
   row inside the decision transaction.

   Do not rely only on a status
   read performed outside the
   transaction.
   ============================================================ */

export function requireApplicationDecisionTransition(
  currentStatus: AdminApplicationStatus,
  decision: AdminDecision
): void {
  const result =
    checkApplicationDecisionTransition(
      currentStatus,
      decision
    );

  if (result.allowed) {
    return;
  }

  throw new AdminPermissionError(
    409,
    result.reason
  );
}

/* ============================================================
   17. REQUIRE ADMIN DECISION ACCESS

   This function checks:
   - Administrator authentication
   - Decision permission
   - Application existence
   - Whether the dossier currently
     has a transitionable status

   IMPORTANT:

   It does NOT write the decision.

   Final authorization must be
   repeated or performed using
   the locked row inside the
   PostgreSQL decision transaction.

   The decision API must still
   compare expectedUpdatedAt
   and expectedStatus.
   ============================================================ */

export async function requireApplicationDecisionAccess(
  request: NextRequest,
  rawApplicationId: unknown,
  decision: AdminDecision,
  options?: {
    database?: AdminPermissionDatabase;
  }
): Promise<ApplicationAccessContext> {
  if (!isAdminDecision(decision)) {
    throw new AdminPermissionError(
      403,
      "FORBIDDEN"
    );
  }

  const context =
    await requireApplicationAccess(
      request,
      rawApplicationId,
      {
        permission:
          "ADMIN_APPLICATION_DECIDE",

        database:
          options?.database,
      }
    );

  requireApplicationDecisionTransition(
    context.application.status,
    decision
  );

  return context;
}

/* ============================================================
   18. FORMAT AUTHORIZATION ERROR

   Converts known access errors
   into a minimal public error.

   Other errors, such as PostgreSQL
   failures, must be handled as
   internal server failures.

   Never expose raw database errors
   to the browser.
   ============================================================ */

export function getAdminPermissionError(
  error: unknown
): {
  status: number;
  code: AdminPermissionErrorCode;
} | null {
  if (
    !(error instanceof AdminPermissionError)
  ) {
    return null;
  }

  return {
    status: error.status,
    code: error.code,
  };
}

/* ============================================================
   END — FAHRSCHULE TAYM
   ============================================================ */
