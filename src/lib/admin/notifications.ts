
import "server-only";

import { randomUUID } from "node:crypto";

import type { Pool, PoolClient } from "pg";

import {
  getAdminSessionDatabase,
} from "@/lib/admin/session";

import {
  isSupportedAdminCountry,
  requireApplicationId,
  type AdminCountry,
} from "@/lib/admin/permissions";

/* ============================================================
   FAHRSCHULE TAYM
   ADMIN DECISION NOTIFICATIONS

   FILE:
   src/lib/admin/notifications.ts

   PURPOSE:
   - Queue application decision emails
   - Prepare translated email content
   - Process PostgreSQL outbox jobs
   - Send emails using Resend
   - Prevent concurrent job claiming
   - Use provider idempotency keys
   - Track processing attempts
   - Retry transient failures
   - Recover abandoned processing jobs
   - Record terminal failures
   - Read notification status

   DATABASE:
   taym_notification_outbox

   PROVIDER:
   Resend Email API

   ENV:
   DATABASE_URL
   RESEND_API_KEY
   TAYM_MAIL_FROM

   SECURITY:
   - Server-only
   - Parameterized SQL
   - No credentials in client bundles
   - No raw provider errors in public JSON
   - No document attachments
   - No verification codes in emails
   - No sending inside decision transaction

   IMPORTANT:
   A provider-accepted email is NOT
   proof of mailbox delivery.

   ============================================================ */

/* ============================================================
   1. CONFIGURATION
   ============================================================ */

export const NOTIFICATION_MAX_ATTEMPTS = 5;

export const NOTIFICATION_DEFAULT_BATCH_SIZE = 10;

export const NOTIFICATION_MAX_BATCH_SIZE = 25;

export const NOTIFICATION_LEASE_SECONDS = 120;

export const NOTIFICATION_REQUEST_TIMEOUT_MS = 15_000;

const RESEND_ENDPOINT =
  "https://api.resend.com/emails";

const EMAIL_PATTERN =
  /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/* ============================================================
   2. TYPES
   ============================================================ */

export type NotificationDatabase =
  Pool | PoolClient;

export type DecisionNotificationType =
  | "APPLICATION_APPROVED"
  | "APPLICATION_REJECTED";

export type NotificationLocale =
  | "de"
  | "ar"
  | "tr"
  | "es";

export type NotificationStatus =
  | "PENDING"
  | "PROCESSING"
  | "SENT"
  | "FAILED";

export type QueueDecisionEmailInput = {
  applicationId: string;
  applicationReference: string;

  recipientEmail: string;

  firstName: string;
  lastName: string;

  countryCode: AdminCountry;

  decision: "APPROVED" | "REJECTED";

  reason: string | null;

  locale?: NotificationLocale;
};

export type QueueDecisionEmailResult = {
  id: string;
  eventKey: string;
  queued: boolean;
};

export type NotificationRecord = {
  id: string;
  applicationId: string;
  eventType: DecisionNotificationType;
  status: NotificationStatus;
  attempts: number;
  createdAt: string;
  nextAttemptAt: string | null;
  sentAt: string | null;
  lastErrorCode: string | null;
};

export type NotificationBatchResult = {
  claimed: number;
  accepted: number;
  retried: number;
  permanentlyFailed: number;
  persistenceFailures: number;
};

type DecisionEmailPayload = {
  applicationId: string;
  applicationReference: string;
  decision: "APPROVED" | "REJECTED";
  reason: string | null;
  countryCode: AdminCountry;
  firstName: string;
  lastName: string;
};

type OutboxRow = {
  id: string;
  event_key: string;
  application_id: string;
  recipient_email: string;
  event_type: string;
  locale: string;
  payload: unknown;
  status: string;
  attempts: number;
  created_at: Date | string;
  next_attempt_at: Date | string;
  sent_at: Date | string | null;
  last_error_code: string | null;
};

type QueueRow = {
  id: string;
  event_key: string;
  application_id: string;
  event_type: string;
};

type ProviderResult =
  | { ok: true }
  | {
      ok: false;
      retryable: boolean;
      code: string;
    };

type EmailContent = {
  subject: string;
  text: string;
  html: string;
};

type EmailTranslation = {
  approvedSubject: string;
  rejectedSubject: string;
  greeting: (name: string) => string;
  approvedText: (reference: string) => string;
  rejectedText: (
    reference: string,
    reason: string
  ) => string;
  closing: string;
};

/* ============================================================
   3. SAFE DATABASE ACCESS
   ============================================================ */

export function getNotificationDatabase(): Pool {
  return getAdminSessionDatabase();
}

/* ============================================================
   4. ERROR CLASS
   ============================================================ */

export class AdminNotificationError extends Error {
  constructor(
    public readonly code: string
  ) {
    super(code);
    this.name = "AdminNotificationError";
  }
}

/* ============================================================
   5. DATA VALIDATION
   ============================================================ */

function requiredText(
  value: unknown,
  max: number
): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > max ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new AdminNotificationError(
      "INVALID_NOTIFICATION_DATA"
    );
  }

  return value;
}

function normalizeEmail(
  value: unknown
): string {
  const email =
    requiredText(value, 254)
      .trim()
      .toLowerCase();

  if (!EMAIL_PATTERN.test(email)) {
    throw new AdminNotificationError(
      "INVALID_RECIPIENT_EMAIL"
    );
  }

  return email;
}

function normalizeReference(
  value: unknown
): string {
  const reference =
    requiredText(value, 120).trim();

  if (
    !/^[\p{L}\p{N}._/-]+$/u.test(reference)
  ) {
    throw new AdminNotificationError(
      "INVALID_APPLICATION_REFERENCE"
    );
  }

  return reference;
}

function normalizeName(
  value: unknown
): string {
  return requiredText(value, 150)
    .normalize("NFC")
    .trim();
}

function isLocale(
  value: unknown
): value is NotificationLocale {
  return (
    value === "de" ||
    value === "ar" ||
    value === "tr" ||
    value === "es"
  );
}

function isDecisionType(
  value: unknown
): value is DecisionNotificationType {
  return (
    value === "APPLICATION_APPROVED" ||
    value === "APPLICATION_REJECTED"
  );
}

function isStatus(
  value: unknown
): value is NotificationStatus {
  return (
    value === "PENDING" ||
    value === "PROCESSING" ||
    value === "SENT" ||
    value === "FAILED"
  );
}

function normalizeReason(
  decision: "APPROVED" | "REJECTED",
  reason: unknown
): string | null {
  if (decision === "APPROVED") {
    if (reason !== null) {
      throw new AdminNotificationError(
        "INVALID_APPROVAL_REASON"
      );
    }

    return null;
  }

  if (typeof reason !== "string") {
    throw new AdminNotificationError(
      "REJECTION_REASON_REQUIRED"
    );
  }

  const normalized = reason
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ");

  if (
    normalized.length < 10 ||
    normalized.length > 1000
  ) {
    throw new AdminNotificationError(
      "INVALID_REJECTION_REASON"
    );
  }

  return normalized;
}

function toIso(
  input: Date | string
): string {
  const date =
    input instanceof Date
      ? input
      : new Date(input);

  if (!Number.isFinite(date.getTime())) {
    throw new AdminNotificationError(
      "INVALID_NOTIFICATION_DATE"
    );
  }

  return date.toISOString();
}

function safeCount(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new AdminNotificationError(
      "INVALID_NOTIFICATION_COUNT"
    );
  }

  return value;
}

/* ============================================================
   6. PREPARE THE OUTBOX PAYLOAD

   Only whitelisted information.

   Never include:
   - Identity documents
   - Passwords
   - OTP codes
   - Session identifiers
   - Storage keys
   - Payment credentials
   ============================================================ */

function validateDecisionInput(
  input: QueueDecisionEmailInput
): {
  applicationId: string;
  applicationReference: string;
  recipientEmail: string;
  locale: NotificationLocale;
  eventType: DecisionNotificationType;
  payload: DecisionEmailPayload;
} {
  const applicationId =
    requireApplicationId(
      input.applicationId
    );

  const applicationReference =
    normalizeReference(
      input.applicationReference
    );

  const recipientEmail =
    normalizeEmail(
      input.recipientEmail
    );

  if (
    !isSupportedAdminCountry(
      input.countryCode
    )
  ) {
    throw new AdminNotificationError(
      "INVALID_NOTIFICATION_COUNTRY"
    );
  }

  if (
    input.decision !== "APPROVED" &&
    input.decision !== "REJECTED"
  ) {
    throw new AdminNotificationError(
      "INVALID_NOTIFICATION_DECISION"
    );
  }

  const locale =
    input.locale ?? "de";

  if (!isLocale(locale)) {
    throw new AdminNotificationError(
      "INVALID_NOTIFICATION_LOCALE"
    );
  }

  const payload: DecisionEmailPayload = {
    applicationId,
    applicationReference,
    decision: input.decision,
    reason: normalizeReason(
      input.decision,
      input.reason
    ),
    countryCode: input.countryCode,
    firstName: normalizeName(input.firstName),
    lastName: normalizeName(input.lastName),
  };

  return {
    applicationId,
    applicationReference,
    recipientEmail,
    locale,
    eventType:
      input.decision === "APPROVED"
        ? "APPLICATION_APPROVED"
        : "APPLICATION_REJECTED",
    payload,
  };
}

/* ============================================================
   7. QUEUE A DECISION EMAIL

   MUST be called with the same
   PoolClient used by the decision
   transaction.

   The caller is responsible for:
   BEGIN
   UPDATE application
   INSERT decision
   INSERT audit
   INSERT notification
   COMMIT

   Unique event_key prevents the
   same decision event being queued
   multiple times.

   It does NOT send an email.
   ============================================================ */

export async function enqueueDecisionNotification(
  client: PoolClient,
  input: QueueDecisionEmailInput
): Promise<QueueDecisionEmailResult> {
  const data =
    validateDecisionInput(input);

  /*
   * Existing decision API uses:
   * APPLICATION_DECISION:<UUID>
   *
   * Keep that convention.
   */

  const eventKey =
    `APPLICATION_DECISION:${data.applicationId}`;

  const newId = randomUUID();

  const result =
    await client.query<QueueRow>(
      `
      INSERT INTO taym_notification_outbox (
        id,
        event_key,
        application_id,
        recipient_email,
        event_type,
        locale,
        payload,
        status,
        attempts,
        created_at,
        next_attempt_at
      )
      VALUES (
        $1::uuid,
        $2,
        $3::uuid,
        $4,
        $5,
        $6,
        $7::jsonb,
        'PENDING',
        0,
        NOW(),
        NOW()
      )
      ON CONFLICT (event_key)
      DO NOTHING
      RETURNING
        id::text AS id,
        event_key,
        application_id::text AS application_id,
        event_type
      `,
      [
        newId,
        eventKey,
        data.applicationId,
        data.recipientEmail,
        data.eventType,
        data.locale,
        JSON.stringify(data.payload),
      ]
    );

  const inserted = result.rows[0];

  if (inserted) {
    return {
      id: inserted.id,
      eventKey,
      queued: true,
    };
  }

  /*
   * If the event exists, verify
   * that it belongs to the same
   * application and decision.

   * Do not silently overwrite
   * an existing email job.
   */

  const existing =
    await client.query<QueueRow>(
      `
      SELECT
        id::text AS id,
        event_key,
        application_id::text AS application_id,
        event_type
      FROM taym_notification_outbox
      WHERE event_key = $1
      LIMIT 1
      `,
      [eventKey]
    );

  const row = existing.rows[0];

  if (
    !row ||
    row.application_id !==
      data.applicationId ||
    row.event_type !== data.eventType
  ) {
    throw new AdminNotificationError(
      "NOTIFICATION_EVENT_CONFLICT"
    );
  }

  return {
    id: row.id,
    eventKey,
    queued: false,
  };
}

/* ============================================================
   8. TRANSLATIONS

   German is the default language.

   These messages communicate the
   platform's administrative decision.

   They do NOT claim:
   - A driving licence was issued
   - TÜV / DEKRA approval
   - Government authorization
   - A successful driving test
   ============================================================ */

const TRANSLATIONS:
  Record<NotificationLocale, EmailTranslation> = {
    de: {
      approvedSubject:
        "Fahrschule TAYM – Ihr Antrag wurde geprüft",

      rejectedSubject:
        "Fahrschule TAYM – Entscheidung zu Ihrem Antrag",

      greeting: (name) =>
        `Guten Tag ${name},`,

      approvedText: (reference) =>
        `Ihr Antrag mit der Referenz ${reference} ` +
        "wurde auf der Fahrschule-TAYM-Plattform " +
        "geprüft und freigegeben.\n\n" +
        "Bitte melden Sie sich in Ihrem Konto an, " +
        "um den aktuellen Bearbeitungsstand und " +
        "die nächsten verfügbaren Schritte einzusehen.\n\n" +
        "Diese Mitteilung ist keine behördliche " +
        "Führerscheinerteilung.",

      rejectedText: (reference, reason) =>
        `Ihr Antrag mit der Referenz ${reference} ` +
        "wurde auf der Fahrschule-TAYM-Plattform " +
        "nicht freigegeben.\n\n" +
        `Begründung:\n${reason}\n\n` +
        "Weitere Informationen finden Sie " +
        "in Ihrem Benutzerkonto.",

      closing:
        "Mit freundlichen Grüßen\n" +
        "Fahrschule TAYM",
    },

    ar: {
      approvedSubject:
        "مدرسة TAYM للقيادة – تحديث طلبك",

      rejectedSubject:
        "مدرسة TAYM للقيادة – قرار بشأن طلبك",

      greeting: (name) =>
        `مرحبًا ${name}،`,

      approvedText: (reference) =>
        `تمت مراجعة طلبك رقم ${reference} ` +
        "والموافقة عليه داخل منصة Fahrschule TAYM.\n\n" +
        "يرجى تسجيل الدخول إلى حسابك للاطلاع " +
        "على حالة الطلب والخطوات التالية المتاحة.\n\n" +
        "هذه الرسالة لا تعني إصدار رخصة قيادة رسمية.",

      rejectedText: (reference, reason) =>
        `تمت مراجعة طلبك رقم ${reference} ` +
        "ولم تتم الموافقة عليه داخل منصة Fahrschule TAYM.\n\n" +
        `السبب:\n${reason}\n\n` +
        "يرجى الدخول إلى حسابك للاطلاع على التفاصيل.",

      closing:
        "مع خالص التحية\nFahrschule TAYM",
    },

    tr: {
      approvedSubject:
        "Fahrschule TAYM – Başvurunuz hakkında",

      rejectedSubject:
        "Fahrschule TAYM – Başvuru kararı",

      greeting: (name) =>
        `Merhaba ${name},`,

      approvedText: (reference) =>
        `${reference} referans numaralı başvurunuz ` +
        "Fahrschule TAYM platformunda incelenmiş " +
        "ve onaylanmıştır.\n\n" +
        "Güncel durumu ve sonraki adımları görmek " +
        "için hesabınıza giriş yapınız.\n\n" +
        "Bu bildirim resmî sürücü belgesi " +
        "verildiği anlamına gelmez.",

      rejectedText: (reference, reason) =>
        `${reference} referans numaralı başvurunuz ` +
        "Fahrschule TAYM platformunda incelenmiş " +
        "ancak onaylanmamıştır.\n\n" +
        `Gerekçe:\n${reason}\n\n` +
        "Ayrıntılar için hesabınıza giriş yapınız.",

      closing:
        "Saygılarımızla\nFahrschule TAYM",
    },

    es: {
      approvedSubject:
        "Fahrschule TAYM – Estado de su solicitud",

      rejectedSubject:
        "Fahrschule TAYM – Decisión sobre su solicitud",

      greeting: (name) =>
        `Hola, ${name}:`,

      approvedText: (reference) =>
        `Su solicitud con referencia ${reference} ` +
        "ha sido revisada y aprobada dentro de " +
        "la plataforma Fahrschule TAYM.\n\n" +
        "Acceda a su cuenta para consultar el estado " +
        "actual y los siguientes pasos disponibles.\n\n" +
        "Este mensaje no constituye la expedición " +
        "oficial de un permiso de conducir.",

      rejectedText: (reference, reason) =>
        `Su solicitud con referencia ${reference} ` +
        "ha sido revisada, pero no ha sido aprobada " +
        "en la plataforma Fahrschule TAYM.\n\n" +
        `Motivo:\n${reason}\n\n` +
        "Consulte su cuenta para más información.",

      closing:
        "Atentamente\nFahrschule TAYM",
    },
  };

/* ============================================================
   9. ESCAPE HTML

   All candidate-supplied values
   are escaped before HTML output.

   Do not render untrusted HTML
   from rejection reasons.
   ============================================================ */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlParagraphs(text: string): string {
  return text
    .split(/\n{2,}/u)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;` +
        `line-height:1.75">` +
        escapeHtml(paragraph).replace(
          /\n/g,
          "<br>"
        ) +
        "</p>"
    )
    .join("");
}

/* ============================================================
   10. BUILD EMAIL

   Text + HTML.

   No tracking pixels.
   No external images.
   No document attachments.
   No fabricated payment links.

   RTL layout for Arabic.
   ============================================================ */

export function prepareDecisionEmail(
  payload: DecisionEmailPayload,
  locale: NotificationLocale
): EmailContent {
  if (!isLocale(locale)) {
    throw new AdminNotificationError(
      "INVALID_NOTIFICATION_LOCALE"
    );
  }

  const name = [
    normalizeName(payload.firstName),
    normalizeName(payload.lastName),
  ].join(" ");

  const reference =
    normalizeReference(
      payload.applicationReference
    );

  const decision = payload.decision;

  const reason = normalizeReason(
    decision,
    payload.reason
  );

  const t = TRANSLATIONS[locale];

  const subject =
    decision === "APPROVED"
      ? t.approvedSubject
      : t.rejectedSubject;

  const body =
    decision === "APPROVED"
      ? t.approvedText(reference)
      : t.rejectedText(
          reference,
          reason ?? ""
        );

  const text = [
    t.greeting(name),
    "",
    body,
    "",
    t.closing,
  ].join("\n");

  const direction =
    locale === "ar" ? "rtl" : "ltr";

  const html = `<!doctype html>
<html lang="${locale}" dir="${direction}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:24px;background:#f5f7f3;
font-family:Arial,Helvetica,sans-serif;color:#162316;">
<table role="presentation" cellpadding="0" cellspacing="0"
style="width:100%;max-width:600px;margin:auto;
background:#ffffff;border:1px solid #e1e7da;
border-radius:14px;">
<tr><td style="padding:28px;">
<div style="font-size:22px;font-weight:800;color:#173b21;
margin-bottom:20px;">
Fahrschule <span style="color:#83b918;">TAYM</span>
</div>
${htmlParagraphs(t.greeting(name))}
${htmlParagraphs(body)}
<div style="border-top:1px solid #e8ede4;
margin-top:24px;padding-top:20px;font-size:14px;
color:#526152;white-space:pre-line;">
${escapeHtml(t.closing)}
</div>
</td></tr>
</table>
</body>
</html>`;

  return {
    subject,
    text,
    html,
  };
}

/* ============================================================
   11. VALIDATE STORED PAYLOAD

   Outbox data is not automatically
   trusted merely because it comes
   from PostgreSQL.
   ============================================================ */

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function readStoredPayload(
  raw: unknown
): DecisionEmailPayload {
  const parsed =
    typeof raw === "string"
      ? JSON.parse(raw) as unknown
      : raw;

  if (!isRecord(parsed)) {
    throw new AdminNotificationError(
      "INVALID_NOTIFICATION_PAYLOAD"
    );
  }

  if (
    parsed.decision !== "APPROVED" &&
    parsed.decision !== "REJECTED"
  ) {
    throw new AdminNotificationError(
      "INVALID_NOTIFICATION_PAYLOAD"
    );
  }

  if (
    !isSupportedAdminCountry(
      parsed.countryCode
    )
  ) {
    throw new AdminNotificationError(
      "INVALID_NOTIFICATION_PAYLOAD"
    );
  }

  return {
    applicationId:
      requireApplicationId(parsed.applicationId),

    applicationReference:
      normalizeReference(
        parsed.applicationReference
      ),

    decision: parsed.decision,

    reason: normalizeReason(
      parsed.decision,
      parsed.reason
    ),

    countryCode: parsed.countryCode,

    firstName: normalizeName(
      parsed.firstName
    ),

    lastName: normalizeName(
      parsed.lastName
    ),
  };
}

/* ============================================================
   12. PROVIDER CONFIGURATION

   Configure an authenticated
   Resend account and verified
   sender domain.

   Never put the API key in a
   NEXT_PUBLIC_ variable.
   ============================================================ */

function getProviderConfig(): {
  apiKey: string;
  from: string;
} {
  const apiKey =
    process.env.RESEND_API_KEY?.trim();

  const from =
    process.env.TAYM_MAIL_FROM?.trim();

  if (!apiKey || !from) {
    throw new AdminNotificationError(
      "EMAIL_PROVIDER_NOT_CONFIGURED"
    );
  }

  if (
    apiKey.length > 512 ||
    from.length > 320 ||
    /[\r\n]/.test(from)
  ) {
    throw new AdminNotificationError(
      "INVALID_EMAIL_PROVIDER_CONFIG"
    );
  }

  return { apiKey, from };
}

/* ============================================================
   13. PROVIDER ERROR CLASSIFICATION

   Retry:
   - Network failures
   - Timeouts
   - HTTP 408 / 409 / 425 / 429
   - HTTP 5xx

   Usually permanent:
   - Invalid recipient
   - Unauthorized API key
   - Invalid sender/domain
   - Other HTTP 4xx

   We store safe error codes,
   never provider error bodies.
   ============================================================ */

function classifyHttpFailure(
  status: number
): ProviderResult {
  const retryable =
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 429 ||
    status >= 500;

  return {
    ok: false,
    retryable,
    code: `RESEND_HTTP_${status}`,
  };
}

/* ============================================================
   14. SEND WITH RESEND

   Resend's Idempotency-Key header
   helps deduplicate repeated API
   calls for the same outbox job.

   A successful response means
   accepted by provider, not
   delivered to recipient.

   The stable job UUID is used
   as the idempotency key.
   ============================================================ */

async function sendViaResend(
  job: OutboxRow,
  payload: DecisionEmailPayload,
  locale: NotificationLocale,
  config: {
    apiKey: string;
    from: string;
  }
): Promise<ProviderResult> {
  const content =
    prepareDecisionEmail(
      payload,
      locale
    );

  const controller =
    new AbortController();

  const timeout =
    setTimeout(
      () => controller.abort(),
      NOTIFICATION_REQUEST_TIMEOUT_MS
    );

  try {
    const response = await fetch(
      RESEND_ENDPOINT,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${config.apiKey}`,

          "Content-Type":
            "application/json",

          "Idempotency-Key": job.id,
        },

        body: JSON.stringify({
          from: config.from,

          to: [
            normalizeEmail(
              job.recipient_email
            ),
          ],

          subject: content.subject,

          text: content.text,

          html: content.html,
        }),

        cache: "no-store",

        signal: controller.signal,
      }
    );

    if (!response.ok) {
      return classifyHttpFailure(
        response.status
      );
    }

    /*
     * Require the provider to
     * return a message identifier.
     */

    let result: unknown;

    try {
      result = await response.json();
    } catch {
      return {
        ok: false,
        retryable: true,
        code: "RESEND_INVALID_RESPONSE",
      };
    }

    if (
      !isRecord(result) ||
      typeof result.id !== "string" ||
      result.id.length === 0
    ) {
      return {
        ok: false,
        retryable: true,
        code: "RESEND_INVALID_RESPONSE",
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      retryable: true,
      code: "RESEND_NETWORK_ERROR",
    };
  } finally {
    clearTimeout(timeout);
  }
}

/* ============================================================
   15. CLAIM OUTBOX JOBS

   PostgreSQL FOR UPDATE SKIP LOCKED.

   Multiple workers can safely
   claim different jobs.

   Each claimed job:
   - Becomes PROCESSING
   - Increments attempts
   - Receives a 120-second lease

   Abandoned PROCESSING jobs whose
   lease expired become eligible
   for another attempt.

   The lease is deliberately longer
   than the provider HTTP timeout.
   ============================================================ */

async function claimJobs(
  database: Pool,
  limit: number
): Promise<OutboxRow[]> {
  const result =
    await database.query<OutboxRow>(
      `
      WITH selected AS (
        SELECT id

        FROM taym_notification_outbox

        WHERE
          attempts < $2

          AND (
            (
              status IN ('PENDING', 'FAILED')
              AND next_attempt_at <= NOW()
            )

            OR (
              status = 'PROCESSING'
              AND next_attempt_at <= NOW()
            )
          )

        ORDER BY
          next_attempt_at ASC,
          created_at ASC,
          id ASC

        LIMIT $1

        FOR UPDATE SKIP LOCKED
      )

      UPDATE taym_notification_outbox AS n

      SET
        status = 'PROCESSING',

        attempts = n.attempts + 1,

        next_attempt_at =
          NOW() +
          ($3::integer * INTERVAL '1 second'),

        last_error_code = NULL

      FROM selected

      WHERE n.id = selected.id

      RETURNING
        n.id::text AS id,
        n.event_key,
        n.application_id::text AS application_id,
        n.recipient_email,
        n.event_type,
        n.locale,
        n.payload,
        n.status,
        n.attempts,
        n.created_at,
        n.next_attempt_at,
        n.sent_at,
        n.last_error_code
      `,
      [
        limit,
        NOTIFICATION_MAX_ATTEMPTS,
        NOTIFICATION_LEASE_SECONDS,
      ]
    );

  return result.rows;
}

/* ============================================================
   16. RETRY SCHEDULE

   Exponential delays:
   Attempt 1:  1 minute
   Attempt 2:  2 minutes
   Attempt 3:  4 minutes
   Attempt 4:  8 minutes

   Attempt 5:
   Permanent failure.

   A small random jitter avoids
   synchronized retry storms.
   ============================================================ */

function retryDelaySeconds(
  attempts: number
): number {
  const base =
    Math.min(
      3600,
      60 * (2 ** Math.max(0, attempts - 1))
    );

  const jitter =
    Math.floor(Math.random() * 16);

  return base + jitter;
}

/* ============================================================
   17. MARK PROVIDER ACCEPTANCE

   Only the worker holding the
   current attempt may update it.

   Status SENT means accepted by
   email provider, NOT delivered.

   No recipient email is stored
   in the error log.
   ============================================================ */

async function markAccepted(
  database: Pool,
  job: OutboxRow
): Promise<void> {
  const result = await database.query(
    `
    UPDATE taym_notification_outbox

    SET
      status = 'SENT',
      sent_at = NOW(),
      last_error_code = NULL

    WHERE
      id = $1::uuid
      AND status = 'PROCESSING'
      AND attempts = $2
      AND next_attempt_at > NOW()
    `,
    [job.id, job.attempts]
  );

  /*
   * A lost lease or database failure
   * must not be silently interpreted
   * as successful persistence.
   */

  if (result.rowCount !== 1) {
    throw new AdminNotificationError(
      "NOTIFICATION_LEASE_LOST"
    );
  }
}

/* ============================================================
   18. SAVE FAILURE

   Permanent failures:
   status FAILED
   next_attempt_at = infinity

   Retryable failures:
   status FAILED
   next_attempt_at = scheduled retry

   Retry attempts are limited.
   ============================================================ */

async function markFailure(
  database: Pool,
  job: OutboxRow,
  failure: {
    retryable: boolean;
    code: string;
  }
): Promise<"RETRY" | "PERMANENT"> {
  const shouldRetry =
    failure.retryable &&
    job.attempts < NOTIFICATION_MAX_ATTEMPTS;

  const code =
    /^[A-Z0-9_]{1,100}$/.test(failure.code)
      ? failure.code
      : "UNKNOWN_PROVIDER_ERROR";

  const result = await database.query(
    `
    UPDATE taym_notification_outbox

    SET
      status = 'FAILED',

      last_error_code = $3,

      next_attempt_at =
        CASE
          WHEN $4::boolean
          THEN NOW() +
            ($5::integer * INTERVAL '1 second')
          ELSE 'infinity'::timestamptz
        END

    WHERE
      id = $1::uuid
      AND status = 'PROCESSING'
      AND attempts = $2
      AND next_attempt_at > NOW()
    `,
    [
      job.id,
      job.attempts,
      code,
      shouldRetry,
      shouldRetry
        ? retryDelaySeconds(job.attempts)
        : 0,
    ]
  );

  if (result.rowCount !== 1) {
    throw new AdminNotificationError(
      "NOTIFICATION_LEASE_LOST"
    );
  }

  return shouldRetry
    ? "RETRY"
    : "PERMANENT";
}

/* ============================================================
   19. VALIDATE CLAIMED JOB

   Check that stored event,
   application ID and decision
   still correspond.

   This avoids sending malformed
   or inconsistent outbox records.
   ============================================================ */

function validateClaimedJob(
  job: OutboxRow
): {
  payload: DecisionEmailPayload;
  locale: NotificationLocale;
} {
  if (
    !UUID_PATTERN.test(job.id) ||
    !isDecisionType(job.event_type) ||
    !isLocale(job.locale) ||
    !isStatus(job.status) ||
    job.status !== "PROCESSING"
  ) {
    throw new AdminNotificationError(
      "INVALID_NOTIFICATION_JOB"
    );
  }

  const payload =
    readStoredPayload(job.payload);

  const expectedEvent =
    payload.decision === "APPROVED"
      ? "APPLICATION_APPROVED"
      : "APPLICATION_REJECTED";

  if (
    job.event_type !== expectedEvent ||
    job.application_id !==
      payload.applicationId ||
    job.event_key !==
      `APPLICATION_DECISION:${payload.applicationId}`
  ) {
    throw new AdminNotificationError(
      "NOTIFICATION_PAYLOAD_MISMATCH"
    );
  }

  normalizeEmail(job.recipient_email);

  return {
    payload,
    locale: job.locale,
  };
}

/* ============================================================
   20. PROCESS ONE CLAIMED JOB

   Never accept raw jobs from an
   untrusted HTTP request.

   Jobs must come from claimJobs().

   On malformed payload:
   mark permanent failure.

   On network/provider errors:
   retry according to policy.
   ============================================================ */

async function processClaimedJob(
  database: Pool,
  job: OutboxRow,
  config: {
    apiKey: string;
    from: string;
  }
): Promise<
  "ACCEPTED" | "RETRY" | "PERMANENT"
> {
  let payload: DecisionEmailPayload;
  let locale: NotificationLocale;

  try {
    const validated =
      validateClaimedJob(job);

    payload = validated.payload;
    locale = validated.locale;
  } catch {
    await markFailure(database, job, {
      retryable: false,
      code: "INVALID_NOTIFICATION_PAYLOAD",
    });

    return "PERMANENT";
  }

  const result = await sendViaResend(
    job,
    payload,
    locale,
    config
  );

  if (result.ok) {
    await markAccepted(
      database,
      job
    );

    return "ACCEPTED";
  }

  const failure = result;

  return markFailure(
    database,
    job,
    failure
  );
}

/* ============================================================
   21. PROCESS PENDING NOTIFICATIONS

   This function must only be run
   by a trusted server-side worker
   or protected scheduled task.

   DO NOT expose as an unauthenticated
   public API endpoint.

   Processing order:
   1. Check provider configuration
   2. Claim a batch in PostgreSQL
   3. Send each email
   4. Persist accepted/failed result
   5. Schedule retry if appropriate

   No fake "SENT" responses.
   ============================================================ */

export async function processPendingNotifications(
  options?: {
    batchSize?: number;
    database?: Pool;
  }
): Promise<NotificationBatchResult> {
  const batchSize =
    options?.batchSize ??
    NOTIFICATION_DEFAULT_BATCH_SIZE;

  if (
    !Number.isSafeInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > NOTIFICATION_MAX_BATCH_SIZE
  ) {
    throw new AdminNotificationError(
      "INVALID_NOTIFICATION_BATCH_SIZE"
    );
  }

  /*
   * Validate configuration BEFORE
   * claiming any notification.
   *
   * An unavailable provider config
   * must not consume retry attempts.
   */

  const config =
    getProviderConfig();

  const database =
    options?.database ??
    getNotificationDatabase();

  const jobs = await claimJobs(
    database,
    batchSize
  );

  const summary: NotificationBatchResult = {
    claimed: jobs.length,
    accepted: 0,
    retried: 0,
    permanentlyFailed: 0,
    persistenceFailures: 0,
  };

  /*
   * Sequential processing avoids
   * uncontrolled provider bursts
   * and fits the 120-second lease
   * for the default small batch.
   *
   * If the batch is increased,
   * a concurrent/lease-renewing
   * worker is recommended.
   */

  for (const job of jobs) {
    try {
      const status =
        await processClaimedJob(
          database,
          job,
          config
        );

      switch (status) {
        case "ACCEPTED":
          summary.accepted += 1;
          break;

        case "RETRY":
          summary.retried += 1;
          break;

        case "PERMANENT":
          summary.permanentlyFailed += 1;
          break;
      }
    } catch {
      /*
       * Do not log secrets, payload,
       * addresses or rejection reasons.
       *
       * The lease will eventually
       * expire and a later worker
       * can reclaim the job.
       */

      summary.persistenceFailures += 1;

      console.error(
        "[TAYM_NOTIFICATION_WORKER]",
        "NOTIFICATION_PROCESSING_FAILURE"
      );
    }
  }

  return summary;
}

/* ============================================================
   22. READ STATUS FOR ONE APPLICATION

   Server-only, low-level read.

   Caller must be trusted and
   authorized before invoking it
   for an HTTP response.

   No recipient email or payload
   is exposed.
   ============================================================ */

export async function readDecisionNotificationStatus(
  applicationId: string,
  database: NotificationDatabase =
    getNotificationDatabase()
): Promise<NotificationRecord | null> {
  const id =
    requireApplicationId(
      applicationId
    );

  const result =
    await database.query<OutboxRow>(
      `
      SELECT
        id::text AS id,
        event_key,
        application_id::text AS application_id,
        recipient_email,
        event_type,
        locale,
        payload,
        status,
        attempts,
        created_at,
        next_attempt_at,
        sent_at,
        last_error_code

      FROM taym_notification_outbox

      WHERE
        application_id = $1::uuid

        AND event_type IN (
          'APPLICATION_APPROVED',
          'APPLICATION_REJECTED'
        )

      ORDER BY created_at DESC, id DESC

      LIMIT 1
      `,
      [id]
    );

  const row = result.rows[0];

  if (!row) return null;

  if (
    !isDecisionType(row.event_type) ||
    !isStatus(row.status)
  ) {
    throw new AdminNotificationError(
      "INVALID_NOTIFICATION_RECORD"
    );
  }

  return {
    id: row.id,
    applicationId: row.application_id,
    eventType: row.event_type,
    status: row.status,
    attempts: safeCount(row.attempts),
    createdAt: toIso(row.created_at),
    nextAttemptAt:
      row.next_attempt_at === "infinity" ||
      (
        row.next_attempt_at instanceof Date &&
        !Number.isFinite(
          row.next_attempt_at.getTime()
        )
      )
        ? null
        : toIso(row.next_attempt_at),
    sentAt:
      row.sent_at === null
        ? null
        : toIso(row.sent_at),
    lastErrorCode: row.last_error_code,
  };
}

/* ============================================================
   23. NOTIFICATION STATISTICS

   Operational counters only.

   These values are not equivalent
   to actual mailbox deliveries.
   ============================================================ */

export type NotificationStatistics = {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
};

export async function readNotificationStatistics(
  database: NotificationDatabase =
    getNotificationDatabase()
): Promise<NotificationStatistics> {
  const result =
    await database.query<{
      pending: string | number;
      processing: string | number;
      sent: string | number;
      failed: string | number;
    }>(
      `
      SELECT
        COUNT(*) FILTER (
          WHERE status = 'PENDING'
        ) AS pending,

        COUNT(*) FILTER (
          WHERE status = 'PROCESSING'
        ) AS processing,

        COUNT(*) FILTER (
          WHERE status = 'SENT'
        ) AS sent,

        COUNT(*) FILTER (
          WHERE status = 'FAILED'
        ) AS failed

      FROM taym_notification_outbox
      `
    );

  const row = result.rows[0];

  if (!row) {
    throw new AdminNotificationError(
      "NOTIFICATION_STATISTICS_UNAVAILABLE"
    );
  }

  return {
    pending: Number(row.pending),
    processing: Number(row.processing),
    sent: Number(row.sent),
    failed: Number(row.failed),
  };
}

/* ============================================================
   END — FAHRSCHULE TAYM
   ============================================================ */
