
import "server-only";

import { isSmsVerificationEnabled } from "@/lib/auth/verification";

import { NextResponse } from "next/server";
import {
  createHash,
  timingSafeEqual,
} from "node:crypto";

import { Pool, type PoolClient } from "pg";
import { Resend } from "resend";
import twilio from "twilio";

import {
  createVerificationChallenge,
  VERIFICATION_CONFIG,
  type VerificationChannel,
} from "@/lib/auth/verification";

/* =========================================================
   FAHRSCHULE TAYM
   API : RENVOYER UN CODE DE VÉRIFICATION

   Route :
   POST /api/auth/resend-code

   EMAIL -> Resend
   SMS   -> Twilio

   Sécurité :
   - Jeton privé de l'inscription
   - PostgreSQL
   - Verrouillage transactionnel
   - Un seul challenge actif par canal
   - Cooldown 60 secondes
   - Limite de renvois
   - Ancien code invalidé
   - Aucun secret envoyé au navigateur

   Runtime Node.js uniquement.
   ========================================================= */


/* =========================================================
   CONFIGURATION
   ========================================================= */

const MAX_BODY_BYTES = 4096;
const MAX_RESENDS_PER_CHANNEL = 5;

const ALLOWED_LOCALES = [
  "de",
  "ar",
  "tr",
  "es",
] as const;

type Locale = (typeof ALLOWED_LOCALES)[number];

type RequestBody = {
  registrationId?: unknown;
  resendToken?: unknown;
  channel?: unknown;
  locale?: unknown;
};

type RegistrationRow = {
  id: string;
  status: string;
  email: string;
  phone_e164: string;
  resend_token_hash: string;
  email_verified_at: Date | null;
  phone_verified_at: Date | null;
  expires_at: Date | null;
};

type ChallengeRow = {
  id: string;
  channel: string;
  verified_at: Date | null;
  resend_count: number;
  last_sent_at: Date | null;
};

type ApiErrorCode =
  | "INVALID_REQUEST"
  | "UNAUTHORIZED"
  | "REGISTRATION_EXPIRED"
  | "ALREADY_VERIFIED"
  | "TOO_MANY_REQUESTS"
  | "COOLDOWN"
  | "DELIVERY_FAILED"
  | "CONFIGURATION_ERROR"
  | "INTERNAL_ERROR";

class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    public readonly retryAfterSeconds = 0
  ) {
    super(code);
    this.name = "ApiError";
  }
}

/* =========================================================
   POOL POSTGRESQL

   Réutilisation du Pool en développement
   pour éviter trop de connexions pendant
   les rechargements Next.js.
   ========================================================= */

const globalForDatabase = globalThis as typeof globalThis & {
  taymResendPool?: Pool;
};

function getDatabase(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new ApiError(
      500,
      "CONFIGURATION_ERROR"
    );
  }

  if (!globalForDatabase.taymResendPool) {
    globalForDatabase.taymResendPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    globalForDatabase.taymResendPool.on(
      "error",
      (error) => {
        console.error(
          "[TAYM][DB] Erreur connexion inactive:",
          error.name
        );
      }
    );
  }

  return globalForDatabase.taymResendPool;
}

/* =========================================================
   RÉPONSES JSON
   ========================================================= */

function jsonResponse(
  data: Record<string, unknown>,
  status = 200,
  retryAfterSeconds = 0
) {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  };

  if (retryAfterSeconds > 0) {
    headers["Retry-After"] = String(
      retryAfterSeconds
    );
  }

  return NextResponse.json(data, {
    status,
    headers,
  });
}

function errorResponse(error: ApiError) {
  return jsonResponse(
    {
      success: false,
      error: error.code,
      retryAfterSeconds:
        error.retryAfterSeconds,
    },
    error.status,
    error.retryAfterSeconds
  );
}

/* =========================================================
   VALIDATION
   ========================================================= */

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function isChannel(
  value: unknown
): value is VerificationChannel {
  return value === "EMAIL" || value === "SMS";
}

function getLocale(value: unknown): Locale {
  if (
    typeof value === "string" &&
    ALLOWED_LOCALES.includes(value as Locale)
  ) {
    return value as Locale;
  }

  return "de";
}

function hashResendToken(token: string): string {
  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

function verifyResendToken(
  token: string,
  storedHash: string
): boolean {
  if (
    typeof token !== "string" ||
    token.length < 32 ||
    token.length > 256 ||
    !/^[a-f0-9]{64}$/i.test(storedHash)
  ) {
    return false;
  }

  const actual = Buffer.from(
    hashResendToken(token),
    "hex"
  );

  const expected = Buffer.from(
    storedHash,
    "hex"
  );

  return timingSafeEqual(actual, expected);
}

async function parseRequest(
  request: Request
): Promise<{
  registrationId: string;
  resendToken: string;
  channel: VerificationChannel;
  locale: Locale;
}> {
  const contentType =
    request.headers.get("content-type") || "";

  if (
    !contentType.toLowerCase().includes(
      "application/json"
    )
  ) {
    throw new ApiError(
      400,
      "INVALID_REQUEST"
    );
  }

  const contentLength = Number(
    request.headers.get("content-length") || 0
  );

  if (contentLength > MAX_BODY_BYTES) {
    throw new ApiError(
      400,
      "INVALID_REQUEST"
    );
  }

  let body: RequestBody;

  try {
    const text = await request.text();

    if (
      Buffer.byteLength(text, "utf8") >
      MAX_BODY_BYTES
    ) {
      throw new Error("BODY_TOO_LARGE");
    }

    const parsed: unknown = JSON.parse(text);

    if (!isRecord(parsed)) {
      throw new Error("INVALID_JSON");
    }

    body = parsed;
  } catch {
    throw new ApiError(
      400,
      "INVALID_REQUEST"
    );
  }

  if (
    !isUuid(body.registrationId) ||
    typeof body.resendToken !== "string" ||
    !isChannel(body.channel)
  ) {
    throw new ApiError(
      400,
      "INVALID_REQUEST"
    );
  }

  if (
    body.resendToken.length < 32 ||
    body.resendToken.length > 256
  ) {
    throw new ApiError(
      400,
      "INVALID_REQUEST"
    );
  }

  return {
    registrationId: body.registrationId,
    resendToken: body.resendToken,
    channel: body.channel,
    locale: getLocale(body.locale),
  };
}

/* =========================================================
   MESSAGES EMAIL / SMS

   Langues :
   - Allemand
   - Arabe
   - Turc
   - Espagnol
   ========================================================= */

const messages: Record<
  Locale,
  {
    subject: string;
    greeting: string;
    emailIntro: string;
    expiry: string;
    ignore: string;
    sms: (code: string) => string;
  }
> = {
  de: {
    subject: "Ihr Bestätigungscode – Fahrschule TAYM",
    greeting: "Hallo,",
    emailIntro:
      "Ihr neuer Bestätigungscode lautet:",
    expiry: "Dieser Code ist 10 Minuten gültig.",
    ignore:
      "Falls Sie diesen Code nicht angefordert haben, können Sie diese Nachricht ignorieren.",
    sms: (code) =>
      `Fahrschule TAYM: Ihr Bestätigungscode lautet ${code}. Gültig für 10 Minuten. Bitte nicht weitergeben.`,
  },

  ar: {
    subject: "رمز التحقق – Fahrschule TAYM",
    greeting: "مرحبًا،",
    emailIntro: "رمز التحقق الجديد الخاص بك:",
    expiry: "هذا الرمز صالح لمدة 10 دقائق.",
    ignore:
      "إذا لم تطلب هذا الرمز، يمكنك تجاهل هذه الرسالة.",
    sms: (code) =>
      `Fahrschule TAYM: رمز التحقق الخاص بك هو ${code}. صالح لمدة 10 دقائق. لا تشاركه مع أحد.`,
  },

  tr: {
    subject: "Doğrulama Kodunuz – Fahrschule TAYM",
    greeting: "Merhaba,",
    emailIntro: "Yeni doğrulama kodunuz:",
    expiry: "Bu kod 10 dakika geçerlidir.",
    ignore:
      "Bu kodu siz istemediyseniz mesajı yok sayabilirsiniz.",
    sms: (code) =>
      `Fahrschule TAYM: Doğrulama kodunuz ${code}. 10 dakika geçerlidir. Kimseyle paylaşmayın.`,
  },

  es: {
    subject:
      "Tu código de verificación – Fahrschule TAYM",
    greeting: "Hola,",
    emailIntro:
      "Tu nuevo código de verificación es:",
    expiry:
      "Este código es válido durante 10 minutos.",
    ignore:
      "Si no solicitaste este código, puedes ignorar este mensaje.",
    sms: (code) =>
      `Fahrschule TAYM: Tu código de verificación es ${code}. Válido durante 10 minutos. No lo compartas.`,
  },
};

/* =========================================================
   MODÈLE EMAIL
   ========================================================= */

function makeEmailHtml(
  code: string,
  locale: Locale
): string {
  const t = messages[locale];
  const direction =
    locale === "ar" ? "rtl" : "ltr";

  return `
<!doctype html>
<html lang="${locale}" dir="${direction}">
<head>
  <meta charset="utf-8">
  <meta name="viewport"
        content="width=device-width, initial-scale=1">
  <title>Fahrschule TAYM</title>
</head>
<body style="
  margin:0;
  padding:24px 12px;
  background:#f5f7f2;
  font-family:Arial,Helvetica,sans-serif;
  color:#152018;
">
  <div style="
    max-width:480px;
    margin:0 auto;
    overflow:hidden;
    border:1px solid #e2e8dc;
    border-radius:14px;
    background:#ffffff;
  ">
    <div style="
      background:#172117;
      padding:18px 24px;
      text-align:center;
    ">
      <div style="
        color:#b5e45f;
        font-size:22px;
        font-weight:800;
        letter-spacing:1px;
      ">
        FAHRSCHULE TAYM
      </div>
    </div>

    <div style="
      padding:30px 24px;
      text-align:center;
    ">
      <p style="
        margin:0 0 16px;
        font-size:16px;
      ">
        ${t.greeting}
      </p>

      <p style="
        margin:0 0 20px;
        font-size:15px;
        line-height:1.6;
      ">
        ${t.emailIntro}
      </p>

      <div style="
        display:inline-block;
        padding:15px 24px;
        border-radius:10px;
        background:#eff8df;
        border:1px solid #b9d995;
        font-size:32px;
        font-weight:800;
        letter-spacing:8px;
        direction:ltr;
        color:#285b08;
      ">
        ${code}
      </div>

      <p style="
        margin:20px 0 10px;
        font-size:13px;
        line-height:1.6;
      ">
        ${t.expiry}
      </p>

      <p style="
        margin:0;
        color:#677266;
        font-size:12px;
        line-height:1.6;
      ">
        ${t.ignore}
      </p>
    </div>

    <div style="
      border-top:1px solid #e9eee4;
      padding:13px 20px;
      text-align:center;
      font-size:11px;
      color:#74806e;
    ">
      Fahrschule TAYM
    </div>
  </div>
</body>
</html>
  `.trim();
}

/* =========================================================
   ENVOI AVEC RESEND
   ========================================================= */

async function sendEmail(
  to: string,
  code: string,
  locale: Locale
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    throw new ApiError(
      500,
      "CONFIGURATION_ERROR"
    );
  }

  const resend = new Resend(apiKey);
  const t = messages[locale];

  const result = await resend.emails.send({
    from,
    to: [to],
    subject: t.subject,
    html: makeEmailHtml(code, locale),
    text: [
      "FAHRSCHULE TAYM",
      "",
      t.greeting,
      t.emailIntro,
      "",
      code,
      "",
      t.expiry,
      t.ignore,
    ].join("\n"),
  });

  if (result.error) {
    throw new Error(
      "RESEND_DELIVERY_ERROR"
    );
  }
}

/* =========================================================
   ENVOI AVEC TWILIO
   ========================================================= */

async function sendSms(
  to: string,
  code: string,
  locale: Locale
): Promise<void> {
  const accountSid =
    process.env.TWILIO_ACCOUNT_SID;

  const authToken =
    process.env.TWILIO_AUTH_TOKEN;

  const from =
    process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    throw new ApiError(
      500,
      "CONFIGURATION_ERROR"
    );
  }

  const client = twilio(
    accountSid,
    authToken
  );

  const message =
    await client.messages.create({
      from,
      to,
      body: messages[locale].sms(code),
    });

  if (
    message.status === "failed" ||
    message.status === "undelivered"
  ) {
    throw new Error(
      "TWILIO_DELIVERY_ERROR"
    );
  }
}

/* =========================================================
   LECTURE ET VERROUILLAGE DE L'INSCRIPTION
   ========================================================= */

async function getLockedRegistration(
  client: PoolClient,
  registrationId: string
): Promise<RegistrationRow> {
  const result = await client.query<RegistrationRow>(
    `
    SELECT
      id,
      status,
      email,
      phone_e164,
      resend_token_hash,
      email_verified_at,
      phone_verified_at,
      expires_at
    FROM pending_registrations
    WHERE id = $1
    FOR UPDATE
    `,
    [registrationId]
  );

  const registration = result.rows[0];

  if (!registration) {
    throw new ApiError(
      401,
      "UNAUTHORIZED"
    );
  }

  return registration;
}

/* =========================================================
   CHALLENGE DU CANAL DEMANDÉ
   ========================================================= */

async function getLockedChallenge(
  client: PoolClient,
  registrationId: string,
  channel: VerificationChannel
): Promise<ChallengeRow> {
  const result = await client.query<ChallengeRow>(
    `
    SELECT
      id,
      channel,
      verified_at,
      resend_count,
      last_sent_at
    FROM registration_verifications
    WHERE registration_id = $1
      AND channel = $2
    FOR UPDATE
    `,
    [registrationId, channel]
  );

  const challenge = result.rows[0];

  if (!challenge) {
    throw new ApiError(
      401,
      "UNAUTHORIZED"
    );
  }

  return challenge;
}

/* =========================================================
   RÉSERVATION ATOMIQUE DU NOUVEAU CODE

   La transaction :
   1. Verrouille l'inscription.
   2. Contrôle le jeton.
   3. Vérifie le statut.
   4. Applique le délai et les limites.
   5. Remplace l'ancien challenge.
   6. Réserve l'envoi.

   L'appel réseau Resend/Twilio est effectué
   APRÈS la transaction, pour ne pas garder
   un verrou PostgreSQL pendant l'envoi.
   ========================================================= */

async function reserveChallenge(params: {
  registrationId: string;
  resendToken: string;
  channel: VerificationChannel;
}): Promise<{
  challengeId: string;
  code: string;
  destination: string;
}> {
  const database = getDatabase();
  const client = await database.connect();

  let committed = false;

  try {
    await client.query("BEGIN");

    const registration =
      await getLockedRegistration(
        client,
        params.registrationId
      );

    if (
      !verifyResendToken(
        params.resendToken,
        registration.resend_token_hash
      )
    ) {
      throw new ApiError(
        401,
        "UNAUTHORIZED"
      );
    }

    if (registration.status !== "PENDING_VERIFICATION") {
      throw new ApiError(
        401,
        "UNAUTHORIZED"
      );
    }

    const now = new Date();

    if (
      registration.expires_at &&
      registration.expires_at.getTime() <=
        now.getTime()
    ) {
      throw new ApiError(
        410,
        "REGISTRATION_EXPIRED"
      );
    }

    const alreadyVerified =
      params.channel === "EMAIL"
        ? registration.email_verified_at !== null
        : registration.phone_verified_at !== null;

    if (alreadyVerified) {
      throw new ApiError(
        409,
        "ALREADY_VERIFIED"
      );
    }

    const current =
      await getLockedChallenge(
        client,
        params.registrationId,
        params.channel
      );

    if (current.verified_at !== null) {
      throw new ApiError(
        409,
        "ALREADY_VERIFIED"
      );
    }

    if (
      current.resend_count >=
      MAX_RESENDS_PER_CHANNEL
    ) {
      throw new ApiError(
        429,
        "TOO_MANY_REQUESTS"
      );
    }

    if (current.last_sent_at) {
      const elapsed =
        now.getTime() -
        current.last_sent_at.getTime();

      const cooldownMs =
        VERIFICATION_CONFIG
          .RESEND_COOLDOWN_SECONDS * 1000;

      if (elapsed < cooldownMs) {
        const retryAfterSeconds =
          Math.ceil(
            (cooldownMs - elapsed) / 1000
          );

        throw new ApiError(
          429,
          "COOLDOWN",
          retryAfterSeconds
        );
      }
    }

    const destination =
      params.channel === "EMAIL"
        ? registration.email
        : registration.phone_e164;

    const challenge =
      createVerificationChallenge({
        registrationId: registration.id,
        channel: params.channel,
        destination,
        now,
      });

    /**
     * Un même canal conserve une seule ligne.
     * Le nouvel identifiant et la nouvelle
     * empreinte rendent l'ancien code inutilisable.
     *
     * La contrainte UNIQUE(registration_id, channel)
     * est indispensable en base.
     */
    const updated = await client.query(
      `
      UPDATE registration_verifications
      SET
        id = $1,
        destination = $2,
        code_hash = $3,
        created_at = $4,
        expires_at = $5,
        attempts = 0,
        verified_at = NULL,
        resend_count = resend_count + 1,
        last_sent_at = $4,
        delivery_status = 'SENDING'
      WHERE registration_id = $6
        AND channel = $7
        AND verified_at IS NULL
      `,
      [
        challenge.record.id,
        challenge.record.destination,
        challenge.record.codeHash,
        challenge.record.createdAt,
        challenge.record.expiresAt,
        params.registrationId,
        params.channel,
      ]
    );

    if (updated.rowCount !== 1) {
      throw new ApiError(
        409,
        "ALREADY_VERIFIED"
      );
    }

    await client.query("COMMIT");
    committed = true;

    return {
      challengeId: challenge.record.id,
      code: challenge.code,
      destination,
    };
  } catch (error) {
    if (!committed) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // La connexion sera libérée.
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

/* =========================================================
   MISE À JOUR DE L'ÉTAT DE LIVRAISON
   ========================================================= */

async function updateDeliveryStatus(
  challengeId: string,
  status: "SENT" | "FAILED"
): Promise<void> {
  const database = getDatabase();

  if (status === "SENT") {
    await database.query(
      `
      UPDATE registration_verifications
      SET delivery_status = 'SENT'
      WHERE id = $1
        AND delivery_status = 'SENDING'
      `,
      [challengeId]
    );

    return;
  }

  /**
   * Un envoi rejeté n'est pas utilisable.
   * Le quota de renvoi reste consommé
   * pour prévenir les abus.
   */
  await database.query(
    `
    UPDATE registration_verifications
    SET
      delivery_status = 'FAILED',
      expires_at = NOW()
    WHERE id = $1
      AND delivery_status = 'SENDING'
    `,
    [challengeId]
  );
}

/* =========================================================
   ROUTE POST
   ========================================================= */

export async function POST(
  request: Request
) {
  try {
    const input = await parseRequest(request);

    if (input.channel === "SMS" && !isSmsVerificationEnabled()) {
      throw new ApiError(400, "INVALID_REQUEST");
    }

    /**
     * Avant de réserver un challenge,
     * vérifier la configuration du
     * fournisseur concerné.
     */
    if (
      input.channel === "EMAIL" &&
      (
        !process.env.RESEND_API_KEY ||
        !process.env.RESEND_FROM_EMAIL
      )
    ) {
      throw new ApiError(
        500,
        "CONFIGURATION_ERROR"
      );
    }

    if (
      input.channel === "SMS" &&
      (
        !process.env.TWILIO_ACCOUNT_SID ||
        !process.env.TWILIO_AUTH_TOKEN ||
        !process.env.TWILIO_PHONE_NUMBER
      )
    ) {
      throw new ApiError(
        500,
        "CONFIGURATION_ERROR"
      );
    }

    const reservation =
      await reserveChallenge({
        registrationId:
          input.registrationId,

        resendToken:
          input.resendToken,

        channel:
          input.channel,
      });

    try {
      if (input.channel === "EMAIL") {
        await sendEmail(
          reservation.destination,
          reservation.code,
          input.locale
        );
      } else {
        await sendSms(
          reservation.destination,
          reservation.code,
          input.locale
        );
      }

      await updateDeliveryStatus(
        reservation.challengeId,
        "SENT"
      );
    } catch (deliveryError) {
      console.error(
        "[TAYM][AUTH] Échec d'envoi du code:",
        deliveryError instanceof Error
          ? deliveryError.name
          : "UNKNOWN"
      );

      try {
        await updateDeliveryStatus(
          reservation.challengeId,
          "FAILED"
        );
      } catch {
        console.error(
          "[TAYM][AUTH] Impossible de marquer l'envoi comme échoué."
        );
      }

      throw new ApiError(
        502,
        "DELIVERY_FAILED"
      );
    }

    return jsonResponse({
      success: true,
      channel: input.channel,
      status: "SENT",
      expiresInSeconds:
        VERIFICATION_CONFIG
          .CODE_EXPIRY_MINUTES * 60,
      resendCooldownSeconds:
        VERIFICATION_CONFIG
          .RESEND_COOLDOWN_SECONDS,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return errorResponse(error);
    }

    console.error(
      "[TAYM][AUTH] Erreur interne resend-code:",
      error instanceof Error
        ? error.name
        : "UNKNOWN"
    );

    return errorResponse(
      new ApiError(
        500,
        "INTERNAL_ERROR"
      )
    );
  }
}

/* =========================================================
   MÉTHODES NON AUTORISÉES
   ========================================================= */

export async function GET() {
  return jsonResponse(
    {
      success: false,
      error: "METHOD_NOT_ALLOWED",
    },
    405
  );
}
