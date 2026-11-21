
import "server-only";

import { Pool, type PoolClient } from "pg";

/* =========================================================
   FAHRSCHULE TAYM
   DASHBOARD DATA SERVICE

   Source : PostgreSQL

   Fonction :
   - Identifier le candidat actif
   - Lire les demandes de permis
   - Lire les documents
   - Calculer la progression théorique
   - Lire les séances de conduite
   - Lire les rendez-vous
   - Lire les paiements
   - Lire les notifications
   - Lire les messages
   - Lire le suivi administratif public

   Aucune donnée fictive.
   Aucune donnée d'un autre candidat.
   Aucun commentaire administratif interne.

   Utilisation prévue :
   src/app/api/dashboard/route.ts

   Runtime Node.js uniquement.
   ========================================================= */

/* =========================================================
   TYPES
   ========================================================= */

export type DashboardApplication = {
  id: string;
  applicationNumber: string;
  countryCode: string;
  licenseClass: string;
  applicationType: string;
  status: string;
  currentStep: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DashboardDocument = {
  id: string;
  applicationId: string | null;
  documentType: string;
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: string;
  status: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type DashboardCourse = {
  id: string;
  title: string;
  countryCode: string;
  licenseClass: string;
  languageCode: string;
  status: string;
  totalLessons: number;
  completedLessons: number;
  progressPercent: number | null;
  startedAt: string;
  completedAt: string | null;
};

export type DashboardDrivingLesson = {
  id: string;
  applicationId: string | null;
  licenseClass: string;
  startsAt: string;
  endsAt: string;
  status: string;
  location: string | null;
};

export type DashboardAppointment = {
  id: string;
  applicationId: string | null;
  type: string;
  title: string;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  status: string;
  publicNotes: string | null;
};

export type DashboardPayment = {
  id: string;
  applicationId: string | null;
  reference: string;
  amount: string;
  currency: string;
  purpose: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
};

export type DashboardNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  linkPath: string | null;
  readAt: string | null;
  createdAt: string;
};

export type DashboardMessage = {
  id: string;
  subject: string | null;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export type DashboardStatusEvent = {
  id: string;
  applicationId: string;
  previousStatus: string | null;
  newStatus: string;
  publicNote: string | null;
  createdAt: string;
};

export type DashboardUpcomingEvent = {
  id: string;
  kind: "APPOINTMENT" | "DRIVING_LESSON";
  title: string;
  startsAt: string;
  endsAt: string | null;
  status: string;
  location: string | null;
};

export type CandidateDashboard = {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    countryCode: string;
    role: string;
    emailVerified: boolean;
    phoneVerified: boolean;
  };

  summary: {
    totalApplications: number;
    activeApplications: number;
    totalDocuments: number;
    approvedDocuments: number;
    pendingDocuments: number;
    rejectedDocuments: number;
    totalCourses: number;
    totalTheoryLessons: number;
    completedTheoryLessons: number;
    theoryProgressPercent: number | null;
    totalDrivingLessons: number;
    completedDrivingLessons: number;
    upcomingEvents: number;
    unreadNotifications: number;
    unreadMessages: number;
    pendingPayments: number;
  };

  currentApplication: DashboardApplication | null;
  applications: DashboardApplication[];

  documents: DashboardDocument[];
  courses: DashboardCourse[];
  drivingLessons: DashboardDrivingLesson[];
  appointments: DashboardAppointment[];

  nextEvent: DashboardUpcomingEvent | null;
  upcomingEvents: DashboardUpcomingEvent[];

  payments: DashboardPayment[];
  notifications: DashboardNotification[];
  messages: DashboardMessage[];
  statusHistory: DashboardStatusEvent[];

  lastUpdatedAt: string;
};

/* =========================================================
   ERREURS
   ========================================================= */

export class DashboardAccessError extends Error {
  constructor(
    public readonly code:
      | "INVALID_USER"
      | "UNAUTHORIZED"
      | "ACCOUNT_INACTIVE"
      | "DATABASE_NOT_CONFIGURED"
  ) {
    super(code);
    this.name = "DashboardAccessError";
  }
}

/* =========================================================
   CONNEXION POSTGRESQL

   Réutilise le même Pool global que
   les API d'inscription existantes.

   Ne crée pas une nouvelle connexion
   PostgreSQL à chaque requête.
   ========================================================= */

const globalForDashboard = globalThis as typeof globalThis & {
  taymResendPool?: Pool;
};

function getDatabase(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new DashboardAccessError(
      "DATABASE_NOT_CONFIGURED"
    );
  }

  if (!globalForDashboard.taymResendPool) {
    const pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });

    pool.on("error", (error) => {
      console.error(
        "[TAYM][DASHBOARD] PostgreSQL:",
        error.name
      );
    });

    globalForDashboard.taymResendPool = pool;
  }

  return globalForDashboard.taymResendPool;
}

/* =========================================================
   OUTILS
   ========================================================= */

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function toIso(
  value: Date | string | null | undefined
): string | null {
  if (value == null) return null;

  const date =
    value instanceof Date ? value : new Date(value);

  return Number.isFinite(date.getTime())
    ? date.toISOString()
    : null;
}

function requiredIso(
  value: Date | string
): string {
  const result = toIso(value);

  if (!result) {
    throw new Error(
      "Invalid date returned by PostgreSQL."
    );
  }

  return result;
}

function safeCount(value: unknown): number {
  const count = Number(value);

  return Number.isSafeInteger(count) && count >= 0
    ? count
    : 0;
}

function percent(
  completed: number,
  total: number
): number | null {
  if (total <= 0) return null;

  return Math.min(
    100,
    Math.max(0, Math.round((completed / total) * 100))
  );
}

/* =========================================================
   ROWS POSTGRESQL
   ========================================================= */

type UserRow = {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  country_code: string;
  role: string;
  status: string;
  email_verified_at: Date | null;
  phone_verified_at: Date | null;
};

type ApplicationRow = {
  id: string;
  application_number: string;
  country_code: string;
  license_class: string;
  application_type: string;
  status: string;
  current_step: string | null;
  submitted_at: Date | null;
  reviewed_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type DocumentRow = {
  id: string;
  application_id: string | null;
  document_type: string;
  title: string;
  original_name: string;
  mime_type: string;
  size_bytes: string;
  status: string;
  rejection_reason: string | null;
  reviewed_at: Date | null;
  created_at: Date;
};

type CourseRow = {
  id: string;
  title: string;
  country_code: string;
  license_class: string;
  language_code: string;
  status: string;
  total_lessons: string;
  completed_lessons: string;
  started_at: Date;
  completed_at: Date | null;
};

type DrivingRow = {
  id: string;
  application_id: string | null;
  license_class: string;
  starts_at: Date;
  ends_at: Date;
  status: string;
  location: string | null;
};

type AppointmentRow = {
  id: string;
  application_id: string | null;
  type: string;
  title: string;
  location: string | null;
  starts_at: Date;
  ends_at: Date | null;
  status: string;
  public_notes: string | null;
};

type PaymentRow = {
  id: string;
  application_id: string | null;
  reference: string;
  amount: string;
  currency: string;
  purpose: string;
  status: string;
  paid_at: Date | null;
  created_at: Date;
};

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  link_path: string | null;
  read_at: Date | null;
  created_at: Date;
};

type MessageRow = {
  id: string;
  subject: string | null;
  body: string;
  read_at: Date | null;
  created_at: Date;
};

type HistoryRow = {
  id: string;
  application_id: string;
  previous_status: string | null;
  new_status: string;
  public_note: string | null;
  created_at: Date;
};

/* =========================================================
   LECTURE DU CANDIDAT

   Ne retourne jamais :
   - password_hash
   - token_hash
   - données d'autres utilisateurs
   ========================================================= */

async function loadUser(
  client: PoolClient,
  userId: string
) {
  const result = await client.query<UserRow>(
    `
    SELECT
      id,
      first_name,
      last_name,
      full_name,
      email,
      country_code,
      role,
      status,
      email_verified_at,
      phone_verified_at
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [userId]
  );

  const row = result.rows[0];

  if (!row) {
    throw new DashboardAccessError("UNAUTHORIZED");
  }

  if (row.status !== "ACTIVE") {
    throw new DashboardAccessError("ACCOUNT_INACTIVE");
  }

  if (row.role !== "CANDIDATE") {
    throw new DashboardAccessError("UNAUTHORIZED");
  }

  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: row.full_name,
    email: row.email,
    countryCode: row.country_code,
    role: row.role,
    emailVerified: row.email_verified_at !== null,
    phoneVerified: row.phone_verified_at !== null,
  };
}

/* =========================================================
   DEMANDES DE PERMIS

   Les notes internes de l'administration
   ne sont jamais sélectionnées.
   ========================================================= */

async function loadApplications(
  client: PoolClient,
  userId: string
): Promise<DashboardApplication[]> {
  const result = await client.query<ApplicationRow>(
    `
    SELECT
      id,
      application_number,
      country_code,
      license_class,
      application_type,
      status,
      current_step,
      submitted_at,
      reviewed_at,
      completed_at,
      created_at,
      updated_at
    FROM license_applications
    WHERE applicant_id = $1
    ORDER BY created_at DESC, id DESC
    LIMIT 100
    `,
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    applicationNumber: row.application_number,
    countryCode: row.country_code,
    licenseClass: row.license_class,
    applicationType: row.application_type,
    status: row.status,
    currentStep: row.current_step,
    submittedAt: toIso(row.submitted_at),
    reviewedAt: toIso(row.reviewed_at),
    completedAt: toIso(row.completed_at),
    createdAt: requiredIso(row.created_at),
    updatedAt: requiredIso(row.updated_at),
  }));
}

/* =========================================================
   DOCUMENTS

   Aucun lien direct de stockage privé
   n'est exposé au navigateur.

   Le téléchargement sécurisé sera géré
   séparément par une API autorisée.
   ========================================================= */

async function loadDocuments(
  client: PoolClient,
  userId: string
): Promise<DashboardDocument[]> {
  const result = await client.query<DocumentRow>(
    `
    SELECT
      d.id,
      d.application_id,
      d.document_type,
      d.title,
      d.original_name,
      d.mime_type,
      d.size_bytes::text AS size_bytes,
      d.status,
      d.rejection_reason,
      d.reviewed_at,
      d.created_at
    FROM candidate_documents d
    LEFT JOIN license_applications a
      ON a.id = d.application_id
    WHERE d.uploaded_by_id = $1
       OR (
         a.applicant_id = $1
         AND d.application_id IS NOT NULL
       )
    ORDER BY d.created_at DESC, d.id DESC
    LIMIT 100
    `,
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    applicationId: row.application_id,
    documentType: row.document_type,
    title: row.title,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    status: row.status,
    rejectionReason: row.rejection_reason,
    reviewedAt: toIso(row.reviewed_at),
    createdAt: requiredIso(row.created_at),
  }));
}

/* =========================================================
   COURS ET PROGRESSION THÉORIQUE

   Progression calculée depuis :
   - inscriptions aux cours
   - leçons publiées
   - TheoryProgress COMPLETED

   Aucune progression inventée.
   ========================================================= */

async function loadCourses(
  client: PoolClient,
  userId: string
): Promise<DashboardCourse[]> {
  const result = await client.query<CourseRow>(
    `
    SELECT
      c.id,
      c.title,
      c.country_code,
      c.license_class,
      c.language_code,
      e.status,
      e.started_at,
      e.completed_at,
      COUNT(l.id)::text AS total_lessons,
      COUNT(l.id) FILTER (
        WHERE p.status = 'COMPLETED'
      )::text AS completed_lessons
    FROM course_enrollments e
    INNER JOIN training_courses c
      ON c.id = e.course_id
    LEFT JOIN theory_lessons l
      ON l.course_id = c.id
     AND l.is_published = TRUE
    LEFT JOIN theory_progress p
      ON p.lesson_id = l.id
     AND p.user_id = e.user_id
    WHERE e.user_id = $1
    GROUP BY
      c.id,
      c.title,
      c.country_code,
      c.license_class,
      c.language_code,
      e.id,
      e.status,
      e.started_at,
      e.completed_at
    ORDER BY e.started_at DESC, e.id DESC
    LIMIT 100
    `,
    [userId]
  );

  return result.rows.map((row) => {
    const total = safeCount(row.total_lessons);
    const completed = safeCount(row.completed_lessons);

    return {
      id: row.id,
      title: row.title,
      countryCode: row.country_code,
      licenseClass: row.license_class,
      languageCode: row.language_code,
      status: row.status,
      totalLessons: total,
      completedLessons: completed,
      progressPercent: percent(completed, total),
      startedAt: requiredIso(row.started_at),
      completedAt: toIso(row.completed_at),
    };
  });
}

/* =========================================================
   SÉANCES DE CONDUITE

   Les notes privées des moniteurs
   ne sont pas renvoyées.
   ========================================================= */

async function loadDrivingLessons(
  client: PoolClient,
  userId: string
): Promise<DashboardDrivingLesson[]> {
  const result = await client.query<DrivingRow>(
    `
    SELECT
      id,
      application_id,
      license_class,
      starts_at,
      ends_at,
      status,
      location
    FROM driving_lessons
    WHERE student_id = $1
    ORDER BY starts_at DESC, id DESC
    LIMIT 100
    `,
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    applicationId: row.application_id,
    licenseClass: row.license_class,
    startsAt: requiredIso(row.starts_at),
    endsAt: requiredIso(row.ends_at),
    status: row.status,
    location: row.location,
  }));
}

/* =========================================================
   RENDEZ-VOUS

   Consultation, examens, suivi du dossier,
   rendez-vous administratifs.
   ========================================================= */

async function loadAppointments(
  client: PoolClient,
  userId: string
): Promise<DashboardAppointment[]> {
  const result = await client.query<AppointmentRow>(
    `
    SELECT
      id,
      application_id,
      type,
      title,
      location,
      starts_at,
      ends_at,
      status,
      public_notes
    FROM appointments
    WHERE candidate_id = $1
    ORDER BY starts_at DESC, id DESC
    LIMIT 100
    `,
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    applicationId: row.application_id,
    type: row.type,
    title: row.title,
    location: row.location,
    startsAt: requiredIso(row.starts_at),
    endsAt: toIso(row.ends_at),
    status: row.status,
    publicNotes: row.public_notes,
  }));
}

/* =========================================================
   PROCHAIN RENDEZ-VOUS

   Mélange les rendez-vous classiques
   et les séances de conduite.

   Seuls les événements futurs non annulés
   sont affichés.
   ========================================================= */

async function loadUpcomingEvents(
  client: PoolClient,
  userId: string
): Promise<DashboardUpcomingEvent[]> {
  type UpcomingRow = {
    id: string;
    kind: DashboardUpcomingEvent["kind"];
    title: string;
    starts_at: Date;
    ends_at: Date | null;
    status: string;
    location: string | null;
  };

  const result = await client.query<UpcomingRow>(
    `
    SELECT *
    FROM (
      SELECT
        a.id,
        'APPOINTMENT'::text AS kind,
        a.title,
        a.starts_at,
        a.ends_at,
        a.status,
        a.location
      FROM appointments a
      WHERE a.candidate_id = $1
        AND a.starts_at >= NOW()
        AND a.status IN ('SCHEDULED', 'CONFIRMED')

      UNION ALL

      SELECT
        l.id,
        'DRIVING_LESSON'::text AS kind,
        l.license_class AS title,
        l.starts_at,
        l.ends_at,
        l.status,
        l.location
      FROM driving_lessons l
      WHERE l.student_id = $1
        AND l.starts_at >= NOW()
        AND l.status IN ('SCHEDULED', 'CONFIRMED')
    ) events
    ORDER BY starts_at ASC, id ASC
    LIMIT 20
    `,
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    startsAt: requiredIso(row.starts_at),
    endsAt: toIso(row.ends_at),
    status: row.status,
    location: row.location,
  }));
}

/* =========================================================
   PAIEMENTS

   Les montants restent des chaînes
   décimales afin de préserver la précision.

   Aucune information bancaire sensible.
   ========================================================= */

async function loadPayments(
  client: PoolClient,
  userId: string
): Promise<DashboardPayment[]> {
  const result = await client.query<PaymentRow>(
    `
    SELECT
      id,
      application_id,
      reference,
      amount::text AS amount,
      currency,
      purpose,
      status,
      paid_at,
      created_at
    FROM payments
    WHERE user_id = $1
    ORDER BY created_at DESC, id DESC
    LIMIT 50
    `,
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    applicationId: row.application_id,
    reference: row.reference,
    amount: row.amount,
    currency: row.currency,
    purpose: row.purpose,
    status: row.status,
    paidAt: toIso(row.paid_at),
    createdAt: requiredIso(row.created_at),
  }));
}

/* =========================================================
   NOTIFICATIONS

   Limitées au candidat authentifié.
   ========================================================= */

async function loadNotifications(
  client: PoolClient,
  userId: string
): Promise<DashboardNotification[]> {
  const result =
    await client.query<NotificationRow>(
      `
      SELECT
        id,
        type,
        title,
        body,
        link_path,
        read_at,
        created_at
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 30
      `,
      [userId]
    );

  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    linkPath:
      row.link_path?.startsWith("/") &&
      !row.link_path.startsWith("//")
        ? row.link_path
        : null,
    readAt: toIso(row.read_at),
    createdAt: requiredIso(row.created_at),
  }));
}

/* =========================================================
   MESSAGES

   Seulement les messages reçus.
   ========================================================= */

async function loadMessages(
  client: PoolClient,
  userId: string
): Promise<DashboardMessage[]> {
  const result = await client.query<MessageRow>(
    `
    SELECT
      id,
      subject,
      body,
      read_at,
      created_at
    FROM messages
    WHERE recipient_id = $1
    ORDER BY created_at DESC, id DESC
    LIMIT 30
    `,
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    subject: row.subject,
    body: row.body,
    readAt: toIso(row.read_at),
    createdAt: requiredIso(row.created_at),
  }));
}

/* =========================================================
   HISTORIQUE DE TRAITEMENT ADMINISTRATIF

   Visible uniquement pour les demandes
   du candidat connecté.

   internal_note n'est jamais sélectionné.
   ========================================================= */

async function loadStatusHistory(
  client: PoolClient,
  userId: string
): Promise<DashboardStatusEvent[]> {
  const result = await client.query<HistoryRow>(
    `
    SELECT
      h.id,
      h.application_id,
      h.previous_status,
      h.new_status,
      h.public_note,
      h.created_at
    FROM application_status_history h
    INNER JOIN license_applications a
      ON a.id = h.application_id
    WHERE a.applicant_id = $1
    ORDER BY h.created_at DESC, h.id DESC
    LIMIT 50
    `,
    [userId]
  );

  return result.rows.map((row) => ({
    id: row.id,
    applicationId: row.application_id,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    publicNote: row.public_note,
    createdAt: requiredIso(row.created_at),
  }));
}

/* =========================================================
   COMPTEURS NON LIMITÉS PAR LA PAGINATION

   Les listes Dashboard ont des limites
   d'affichage (30, 50 ou 100 éléments).

   Les compteurs doivent lire les totaux
   réels de PostgreSQL.
   ========================================================= */

async function loadCounters(
  client: PoolClient,
  userId: string
) {
  const result = await client.query<{
    total_applications: string;
    active_applications: string;
    total_documents: string;
    approved_documents: string;
    pending_documents: string;
    rejected_documents: string;
    total_driving_lessons: string;
    completed_driving_lessons: string;
    unread_notifications: string;
    unread_messages: string;
    pending_payments: string;
    upcoming_events: string;
  }>(
    `
    SELECT
      (
        SELECT COUNT(*)::text
        FROM license_applications
        WHERE applicant_id = $1
      ) AS total_applications,

      (
        SELECT COUNT(*)::text
        FROM license_applications
        WHERE applicant_id = $1
          AND status NOT IN (
            'COMPLETED',
            'CANCELLED',
            'REJECTED'
          )
      ) AS active_applications,

      (
        SELECT COUNT(*)::text
        FROM candidate_documents d
        LEFT JOIN license_applications a
          ON a.id = d.application_id
        WHERE d.uploaded_by_id = $1
           OR a.applicant_id = $1
      ) AS total_documents,

      (
        SELECT COUNT(*)::text
        FROM candidate_documents d
        LEFT JOIN license_applications a
          ON a.id = d.application_id
        WHERE (
          d.uploaded_by_id = $1
          OR a.applicant_id = $1
        )
        AND d.status = 'APPROVED'
      ) AS approved_documents,

      (
        SELECT COUNT(*)::text
        FROM candidate_documents d
        LEFT JOIN license_applications a
          ON a.id = d.application_id
        WHERE (
          d.uploaded_by_id = $1
          OR a.applicant_id = $1
        )
        AND d.status = 'PENDING'
      ) AS pending_documents,

      (
        SELECT COUNT(*)::text
        FROM candidate_documents d
        LEFT JOIN license_applications a
          ON a.id = d.application_id
        WHERE (
          d.uploaded_by_id = $1
          OR a.applicant_id = $1
        )
        AND d.status = 'REJECTED'
      ) AS rejected_documents,

      (
        SELECT COUNT(*)::text
        FROM driving_lessons
        WHERE student_id = $1
      ) AS total_driving_lessons,

      (
        SELECT COUNT(*)::text
        FROM driving_lessons
        WHERE student_id = $1
          AND status = 'COMPLETED'
      ) AS completed_driving_lessons,

      (
        SELECT COUNT(*)::text
        FROM notifications
        WHERE user_id = $1
          AND read_at IS NULL
      ) AS unread_notifications,

      (
        SELECT COUNT(*)::text
        FROM messages
        WHERE recipient_id = $1
          AND read_at IS NULL
      ) AS unread_messages,

      (
        SELECT COUNT(*)::text
        FROM payments
        WHERE user_id = $1
          AND status = 'PENDING'
      ) AS pending_payments,

      (
        (
          SELECT COUNT(*)
          FROM appointments
          WHERE candidate_id = $1
            AND starts_at >= NOW()
            AND status IN ('SCHEDULED', 'CONFIRMED')
        )
        +
        (
          SELECT COUNT(*)
          FROM driving_lessons
          WHERE student_id = $1
            AND starts_at >= NOW()
            AND status IN ('SCHEDULED', 'CONFIRMED')
        )
      )::text AS upcoming_events
    `,
    [userId]
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error(
      "Unable to load dashboard counters."
    );
  }

  return {
    totalApplications:
      safeCount(row.total_applications),

    activeApplications:
      safeCount(row.active_applications),

    totalDocuments:
      safeCount(row.total_documents),

    approvedDocuments:
      safeCount(row.approved_documents),

    pendingDocuments:
      safeCount(row.pending_documents),

    rejectedDocuments:
      safeCount(row.rejected_documents),

    totalDrivingLessons:
      safeCount(row.total_driving_lessons),

    completedDrivingLessons:
      safeCount(row.completed_driving_lessons),

    unreadNotifications:
      safeCount(row.unread_notifications),

    unreadMessages:
      safeCount(row.unread_messages),

    pendingPayments:
      safeCount(row.pending_payments),

    upcomingEvents:
      safeCount(row.upcoming_events),
  };
}

/* =========================================================
   FONCTION PRINCIPALE DU DASHBOARD

   L'identifiant doit provenir exclusivement
   de la session authentifiée côté serveur.

   NE JAMAIS utiliser un userId envoyé
   librement par le navigateur.

   Lecture cohérente :
   transaction PostgreSQL en lecture seule,
   isolation REPEATABLE READ.

   Aucune écriture dans la base.
   ========================================================= */

export async function getCandidateDashboard(
  authenticatedUserId: string
): Promise<CandidateDashboard> {
  if (!isUuid(authenticatedUserId)) {
    throw new DashboardAccessError("INVALID_USER");
  }

  const client = await getDatabase().connect();

  let transactionOpen = false;

  try {
    await client.query(
      "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"
    );

    transactionOpen = true;

    const user = await loadUser(
      client,
      authenticatedUserId
    );

    const applications = await loadApplications(
      client,
      authenticatedUserId
    );

    const documents = await loadDocuments(
      client,
      authenticatedUserId
    );

    const courses = await loadCourses(
      client,
      authenticatedUserId
    );

    const drivingLessons = await loadDrivingLessons(
      client,
      authenticatedUserId
    );

    const appointments = await loadAppointments(
      client,
      authenticatedUserId
    );

    const upcomingEvents = await loadUpcomingEvents(
      client,
      authenticatedUserId
    );

    const payments = await loadPayments(
      client,
      authenticatedUserId
    );

    const notifications = await loadNotifications(
      client,
      authenticatedUserId
    );

    const messages = await loadMessages(
      client,
      authenticatedUserId
    );

    const statusHistory = await loadStatusHistory(
      client,
      authenticatedUserId
    );

    const counters = await loadCounters(
      client,
      authenticatedUserId
    );

    await client.query("COMMIT");
    transactionOpen = false;

    /* Progression théorique réelle */

    const totalTheoryLessons = courses.reduce(
      (sum, course) => sum + course.totalLessons,
      0
    );

    const completedTheoryLessons = courses.reduce(
      (sum, course) => sum + course.completedLessons,
      0
    );

    const currentApplication =
      applications.find(
        (application) =>
          ![
            "COMPLETED",
            "CANCELLED",
            "REJECTED",
          ].includes(application.status)
      ) ??
      applications[0] ??
      null;

    return {
      user,

      summary: {
        ...counters,

        totalCourses: courses.length,

        totalTheoryLessons,

        completedTheoryLessons,

        theoryProgressPercent: percent(
          completedTheoryLessons,
          totalTheoryLessons
        ),
      },

      currentApplication,
      applications,

      documents,
      courses,
      drivingLessons,
      appointments,

      nextEvent: upcomingEvents[0] ?? null,
      upcomingEvents,

      payments,
      notifications,
      messages,
      statusHistory,

      lastUpdatedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query("ROLLBACK");
      } catch {
        console.error(
          "[TAYM][DASHBOARD] Rollback failed."
        );
      }
    }

    throw error;
  } finally {
    client.release();
  }
}
