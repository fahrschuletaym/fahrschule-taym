
import "server-only";

import { NextRequest, NextResponse } from "next/server";
import {
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";

import { Pool, type PoolClient } from "pg";
import { Resend } from "resend";
import twilio from "twilio";

import {
  prepareRegistration,
  type RegistrationErrors,
} from "@/lib/auth/registration";

import {
  createRegistrationChallenges,
  VERIFICATION_CONFIG,
  isSmsVerificationEnabled,
} from "@/lib/auth/verification";

/* =========================================================
   FAHRSCHULE TAYM
   API D'INSCRIPTION

   POST /api/auth/register

   1. Validation des données
   2. Protection du mot de passe
   3. Création d'une inscription en attente
   4. Création des codes EMAIL et SMS
   5. Enregistrement PostgreSQL
   6. Envoi email avec Resend
   7. Envoi SMS avec Twilio
   8. Retour du jeton privé de vérification

   L'activation définitive est effectuée
   uniquement par /api/auth/verify.
   ========================================================= */


/* =========================================================
   CONFIGURATION
   ========================================================= */

const CONFIG = {
  MAX_BODY_BYTES: 8192,
  REGISTRATION_EXPIRY_HOURS: 24,
  MAX_PENDING_PER_HOUR: 3,
  VERIFICATION_PATH: "/register",
} as const;

type Locale = "de" | "ar" | "tr" | "es";

type DeliveryStatus = "SENT" | "FAILED";

type ApiErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_ORIGIN"
  | "ACCOUNT_ALREADY_EXISTS"
  | "REGISTRATION_ALREADY_PENDING"
  | "TOO_MANY_REQUESTS"
  | "CONFIGURATION_ERROR"
  | "DATABASE_ERROR"
  | "INTERNAL_ERROR";

type SavedRegistration = {
  registrationId: string;
  resendToken: string;
  emailChallengeId: string;
  smsChallengeId: string;
  emailCode: string;
  smsCode: string;
  email: string;
  phoneE164: string;
};

class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode
  ) {
    super(code);
    this.name = "ApiError";
  }
}

/* =========================================================
   POSTGRESQL

   Même Pool que les routes :
   - verify/route.ts
   - resend-code/route.ts
   ========================================================= */

const globalDatabase = globalThis as typeof globalThis & {
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

  if (!globalDatabase.taymResendPool) {
    globalDatabase.taymResendPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    globalDatabase.taymResendPool.on(
      "error",
      (error) => {
        console.error(
          "[TAYM][DB] Erreur pool:",
          error.name
        );
      }
    );
  }

  return globalDatabase.taymResendPool;
}

/* =========================================================
   RÉPONSES JSON
   ========================================================= */

function json(
  data: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function errorResponse(
  code: ApiErrorCode,
  status: number
) {
  return json(
    {
      success: false,
      error: code,
    },
    status
  );
}

/* =========================================================
   VALIDATION DE LA REQUÊTE
   ========================================================= */

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function checkOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");

  if (!origin) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    throw new ApiError(
      500,
      "CONFIGURATION_ERROR"
    );
  }

  let allowedOrigin: string;

  try {
    allowedOrigin = new URL(appUrl).origin;
  } catch {
    throw new ApiError(
      500,
      "CONFIGURATION_ERROR"
    );
  }

  if (origin !== allowedOrigin) {
    throw new ApiError(
      403,
      "INVALID_ORIGIN"
    );
  }
}

async function readRequestBody(
  request: NextRequest
): Promise<Record<string, unknown>> {
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

  if (
    !Number.isFinite(contentLength) ||
    contentLength > CONFIG.MAX_BODY_BYTES
  ) {
    throw new ApiError(
      400,
      "INVALID_REQUEST"
    );
  }

  let parsed: unknown;

  try {
    const raw = await request.text();

    if (
      Buffer.byteLength(raw, "utf8") >
      CONFIG.MAX_BODY_BYTES
    ) {
      throw new Error("BODY_TOO_LARGE");
    }

    parsed = JSON.parse(raw);
  } catch {
    throw new ApiError(
      400,
      "INVALID_REQUEST"
    );
  }

  if (!isObject(parsed)) {
    throw new ApiError(
      400,
      "INVALID_REQUEST"
    );
  }

  return parsed;
}

function getLocale(value: unknown): Locale {
  if (
    value === "de" ||
    value === "ar" ||
    value === "tr" ||
    value === "es"
  ) {
    return value;
  }

  return "de";
}

/* =========================================================
   CONFIGURATION DES FOURNISSEURS
   ========================================================= */

function checkProviders(): void {
  const required = [
    "DATABASE_URL",
    "VERIFICATION_SECRET",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    ...(isSmsVerificationEnabled() ? ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"] : []),
  ] as const;

  if (
    required.some(
      (key) => !process.env[key]?.trim()
    )
  ) {
    throw new ApiError(
      500,
      "CONFIGURATION_ERROR"
    );
  }

  if (
    (process.env.VERIFICATION_SECRET?.length ?? 0) <
    32
  ) {
    throw new ApiError(
      500,
      "CONFIGURATION_ERROR"
    );
  }
}

/* =========================================================
   MESSAGES D'INSCRIPTION

   Quatre langues :
   DE / AR / TR / ES
   ========================================================= */

const messages: Record<
  Locale,
  {
    subject: string;
    greeting: string;
    instruction: string;
    validity: string;
    warning: string;
    sms: (code: string) => string;
  }
> = {
  de: {
    subject:
      "Bestätigung Ihrer Registrierung – Fahrschule TAYM",
    greeting: "Hallo,",
    instruction:
      "Bitte bestätigen Sie Ihre E-Mail-Adresse mit diesem Code:",
    validity:
      "Dieser Code ist 10 Minuten gültig.",
    warning:
      "Wenn Sie sich nicht registriert haben, ignorieren Sie diese Nachricht.",
    sms: (code) =>
      `Fahrschule TAYM: Ihr SMS-Bestätigungscode ist ${code}. 10 Minuten gültig. Bitte nicht weitergeben.`,
  },

  ar: {
    subject:
      "تأكيد التسجيل – Fahrschule TAYM",
    greeting: "مرحبًا،",
    instruction:
      "يرجى تأكيد بريدك الإلكتروني باستخدام الرمز التالي:",
    validity:
      "هذا الرمز صالح لمدة 10 دقائق.",
    warning:
      "إذا لم تقم بالتسجيل، يمكنك تجاهل هذه الرسالة.",
    sms: (code) =>
      `Fahrschule TAYM: رمز تأكيد الهاتف هو ${code}. صالح لمدة 10 دقائق. لا تشاركه مع أحد.`,
  },

  tr: {
    subject:
      "Kayıt Doğrulama – Fahrschule TAYM",
    greeting: "Merhaba,",
    instruction:
      "E-posta adresinizi aşağıdaki kodla doğrulayın:",
    validity:
      "Bu kod 10 dakika geçerlidir.",
    warning:
      "Kayıt olmadıysanız bu mesajı yok sayabilirsiniz.",
    sms: (code) =>
      `Fahrschule TAYM: SMS doğrulama kodunuz ${code}. 10 dakika geçerlidir. Kimseyle paylaşmayın.`,
  },

  es: {
    subject:
      "Confirmación de registro – Fahrschule TAYM",
    greeting: "Hola,",
    instruction:
      "Confirma tu correo electrónico con este código:",
    validity:
      "Este código es válido durante 10 minutos.",
    warning:
      "Si no te registraste, puedes ignorar este mensaje.",
    sms: (code) =>
      `Fahrschule TAYM: Tu código SMS es ${code}. Válido durante 10 minutos. No lo compartas.`,
  },
};

/* =========================================================
   MODÈLE EMAIL HTML

   Compatible avec les clients email.
   Aucun élément externe obligatoire.
   ========================================================= */

function buildEmailHtml(
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
  <meta charset="UTF-8">
  <meta
    name="viewport"
    content="width=device-width,initial-scale=1"
  >
  <title>Fahrschule TAYM</title>
</head>
<body style="
  margin:0;
  padding:24px 12px;
  background:#f5f7f2;
  color:#172019;
  font-family:Arial,Helvetica,sans-serif;
">
  <div style="
    max-width:480px;
    margin:0 auto;
    overflow:hidden;
    border:1px solid #e3e9dd;
    border-radius:14px;
    background:#ffffff;
  ">
    <div style="
      padding:21px 15px;
      background:#172117;
      text-align:center;
    ">
      <div style="
        color:#b9e96c;
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
        font-weight:600;
      ">
        ${t.greeting}
      </p>

      <p style="
        margin:0 0 22px;
        font-size:15px;
        line-height:1.6;
      ">
        ${t.instruction}
      </p>

      <div style="
        display:inline-block;
        padding:15px 22px;
        border:1px solid #c1dc9f;
        border-radius:11px;
        background:#eff8e3;
        color:#285d07;
        font-size:34px;
        font-weight:800;
        letter-spacing:8px;
        direction:ltr;
        text-align:center;
      ">
        ${code}
      </div>

      <p style="
        margin:23px 0 12px;
        font-size:14px;
        font-weight:600;
      ">
        ${t.validity}
      </p>

      <p style="
        margin:0;
        color:#75806f;
        font-size:12px;
        line-height:1.6;
      ">
        ${t.warning}
      </p>
    </div>

    <div style="
      padding:14px 20px;
      border-top:1px solid #e8eee3;
      text-align:center;
      color:#7a8573;
      font-size:11px;
    ">
      Fahrschule TAYM
    </div>
  </div>
</body>
</html>
  `.trim();
}

/* =========================================================
   EMAIL : RESEND
   ========================================================= */

async function sendEmail(
  email: string,
  code: string,
  locale: Locale
): Promise<void> {
  const resend = new Resend(
    process.env.RESEND_API_KEY!
  );

  const t = messages[locale];

  const result = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: [email],
    subject: t.subject,
    html: buildEmailHtml(code, locale),
    text: [
      "FAHRSCHULE TAYM",
      "",
      t.greeting,
      t.instruction,
      "",
      code,
      "",
      t.validity,
      t.warning,
    ].join("\n"),
  });

  if (result.error || !result.data?.id) {
    throw new Error("RESEND_REQUEST_FAILED");
  }
}

/* =========================================================
   SMS : TWILIO
   ========================================================= */

async function sendSms(
  phoneE164: string,
  code: string,
  locale: Locale
): Promise<void> {
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );

  const result = await client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER!,
    to: phoneE164,
    body: messages[locale].sms(code),
  });

  if (
    !result.sid ||
    result.status === "failed" ||
    result.status === "undelivered"
  ) {
    throw new Error("TWILIO_REQUEST_FAILED");
  }
}

/* =========================================================
   JETON PRIVÉ D'INSCRIPTION

   Un jeton aléatoire est transmis au client.
   Seule son empreinte SHA-256 est enregistrée.

   Utilisé par :
   - /api/auth/verify
   - /api/auth/resend-code
   ========================================================= */

function createRegistrationToken() {
  const token = randomBytes(32).toString("hex");

  const tokenHash = createHash("sha256")
    .update(token, "utf8")
    .digest("hex");

  return {
    token,
    tokenHash,
  };
}

/* =========================================================
   CONTRÔLE DES INSCRIPTIONS EXISTANTES
   ========================================================= */

async function checkExistingAccounts(
  client: PoolClient,
  email: string,
  phoneE164: string
): Promise<void> {
  const active = await client.query(
    `
    SELECT id
    FROM users
    WHERE email = $1
       OR phone_e164 = $2
    LIMIT 1
    `,
    [email, phoneE164]
  );

  if ((active.rowCount ?? 0) > 0) {
    throw new ApiError(
      409,
      "ACCOUNT_ALREADY_EXISTS"
    );
  }

  /*
   * Nettoyage des inscriptions expirées.
   *
   * Les clés étrangères de
   * registration_verifications
   * doivent avoir ON DELETE CASCADE.
   */
  await client.query(
    `
    DELETE FROM pending_registrations
    WHERE expires_at <= NOW()
      AND status = 'PENDING_VERIFICATION'
      AND (
        email = $1
        OR phone_e164 = $2
      )
    `,
    [email, phoneE164]
  );

  const pending = await client.query(
    `
    SELECT id
    FROM pending_registrations
    WHERE status = 'PENDING_VERIFICATION'
      AND expires_at > NOW()
      AND (
        email = $1
        OR phone_e164 = $2
      )
    LIMIT 1
    `,
    [email, phoneE164]
  );

  if ((pending.rowCount ?? 0) > 0) {
    throw new ApiError(
      409,
      "REGISTRATION_ALREADY_PENDING"
    );
  }
}

/* =========================================================
   LIMITATION DES INSCRIPTIONS

   Contrôle complémentaire par destination.
   La limitation par IP doit également être
   configurée au niveau de l'infrastructure.
   ========================================================= */

async function checkRegistrationLimits(
  client: PoolClient,
  email: string,
  phoneE164: string
): Promise<void> {
  const result = await client.query<{
    total: string;
  }>(
    `
    SELECT COUNT(*)::text AS total
    FROM pending_registrations
    WHERE created_at >= NOW() - INTERVAL '1 hour'
      AND (
        email = $1
        OR phone_e164 = $2
      )
    `,
    [email, phoneE164]
  );

  const count = Number(result.rows[0]?.total ?? 0);

  if (
    count >= CONFIG.MAX_PENDING_PER_HOUR
  ) {
    throw new ApiError(
      429,
      "TOO_MANY_REQUESTS"
    );
  }
}

/* =========================================================
   CRÉATION DE L'INSCRIPTION ET DES CODES

   Les trois enregistrements sont créés
   dans une même transaction PostgreSQL.

   Les fournisseurs sont appelés après
   COMMIT pour ne pas conserver les verrous
   pendant les requêtes réseau.
   ========================================================= */

async function createPendingRegistration(
  rawInput: unknown
): Promise<
  | {
      success: true;
      data: SavedRegistration;
    }
  | {
      success: false;
      errors: RegistrationErrors;
    }
> {
  const prepared = await prepareRegistration(
    rawInput
  );

  if (!prepared.success) {
    return {
      success: false,
      errors: prepared.errors,
    };
  }

  const values = prepared.data;

  const client = await getDatabase().connect();

  let committed = false;

  try {
    await client.query("BEGIN");

    /*
     * Les vérifications sont complétées
     * par les contraintes UNIQUE SQL,
     * indispensables contre les courses.
     */
    await checkExistingAccounts(
      client,
      values.email,
      values.phoneE164
    );

    await checkRegistrationLimits(
      client,
      values.email,
      values.phoneE164
    );

    const now = new Date();
    const registrationId = randomUUID();

    const expiresAt = new Date(
      now.getTime() +
        CONFIG.REGISTRATION_EXPIRY_HOURS *
          60 * 60 * 1000
    );

    const credentials = createRegistrationToken();

    const challenges =
      createRegistrationChallenges({
        registrationId,
        email: values.email,
        phoneE164: values.phoneE164,
        now,
      });

    /*
     * Inscription en attente.
     *
     * Le mot de passe est déjà haché
     * par registration.ts.
     */
    await client.query(
      `
      INSERT INTO pending_registrations (
        id,
        status,
        first_name,
        last_name,
        full_name,
        country_code,
        phone_country_code,
        dial_code,
        phone_e164,
        email,
        password_hash,
        accepted_terms_at,
        accepted_privacy_at,
        resend_token_hash,
        email_verified_at,
        phone_verified_at,
        created_at,
        expires_at
      )
      VALUES (
        $1, 'PENDING_VERIFICATION',
        $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        NULL, NULL, $14, $15
      )
      `,
      [
        registrationId,
        values.firstName,
        values.lastName,
        values.fullName,
        values.countryCode,
        values.phoneCountryCode,
        values.dialCode,
        values.phoneE164,
        values.email,
        values.passwordHash,
        values.acceptedTermsAt,
        values.acceptedPrivacyAt,
        credentials.tokenHash,
        now,
        expiresAt,
      ]
    );

    /*
     * Deux challenges indépendants.
     *
     * Ils sont initialement SENDING.
     *
     * Leurs états seront actualisés
     * après les réponses de Resend
     * et de Twilio.
     */
    for (const challenge of [
      challenges.email,
      challenges.sms,
    ]) {
      await client.query(
        `
        INSERT INTO registration_verifications (
          id,
          registration_id,
          channel,
          destination,
          code_hash,
          created_at,
          expires_at,
          attempts,
          verified_at,
          resend_count,
          last_sent_at,
          delivery_status
        )
        VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          0, NULL, 0, $6, 'SENDING'
        )
        `,
        [
          challenge.record.id,
          registrationId,
          challenge.record.channel,
          challenge.record.destination,
          challenge.record.codeHash,
          challenge.record.createdAt,
          challenge.record.expiresAt,
        ]
      );
    }

    await client.query("COMMIT");
    committed = true;

    return {
      success: true,
      data: {
        registrationId,
        resendToken: credentials.token,

        emailChallengeId:
          challenges.email.record.id,

        smsChallengeId:
          challenges.sms.record.id,

        emailCode:
          challenges.email.code,

        smsCode:
          challenges.sms.code,

        email: values.email,
        phoneE164: values.phoneE164,
      },
    };
  } catch (error) {
    if (!committed) {
      try {
        await client.query("ROLLBACK");
      } catch {
        console.error(
          "[TAYM][REGISTER] Rollback impossible."
        );
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

/* =========================================================
   MISE À JOUR DE LA LIVRAISON

   SENT = fournisseur a accepté l'envoi.
   Cela ne garantit pas que le destinataire
   a réellement reçu le message.

   FAILED = code rendu inutilisable.
   ========================================================= */

async function updateDeliveryStatus(
  challengeId: string,
  status: DeliveryStatus
): Promise<void> {
  if (status === "SENT") {
    await getDatabase().query(
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

  await getDatabase().query(
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
   ENVOI INDÉPENDANT DES DEUX CODES

   Un échec SMS ne supprime pas un email
   déjà accepté par Resend.

   Le candidat reçoit son jeton pour pouvoir
   demander le renvoi du canal échoué.
   ========================================================= */

async function dispatchCodes(
  saved: SavedRegistration,
  locale: Locale
): Promise<{
  email: DeliveryStatus;
  sms: DeliveryStatus | "DISABLED";
}> {
  const emailPromise = (async (): Promise<DeliveryStatus> => {
    try {
      await sendEmail(
        saved.email,
        saved.emailCode,
        locale
      );

      await updateDeliveryStatus(
        saved.emailChallengeId,
        "SENT"
      );

      return "SENT";
    } catch (error) {
      console.error(
        "[TAYM][REGISTER] Email:",
        error instanceof Error
          ? error.name
          : "UNKNOWN"
      );

      try {
        await updateDeliveryStatus(
          saved.emailChallengeId,
          "FAILED"
        );
      } catch {
        console.error(
          "[TAYM][REGISTER] État email non enregistré."
        );
      }

      return "FAILED";
    }
  })();

  const smsPromise = (async (): Promise<DeliveryStatus | "DISABLED"> => {
    if (!isSmsVerificationEnabled()) return "DISABLED";
    try {
      await sendSms(
        saved.phoneE164,
        saved.smsCode,
        locale
      );

      await updateDeliveryStatus(
        saved.smsChallengeId,
        "SENT"
      );

      return "SENT";
    } catch (error) {
      console.error(
        "[TAYM][REGISTER] SMS:",
        error instanceof Error
          ? error.name
          : "UNKNOWN"
      );

      try {
        await updateDeliveryStatus(
          saved.smsChallengeId,
          "FAILED"
        );
      } catch {
        console.error(
          "[TAYM][REGISTER] État SMS non enregistré."
        );
      }

      return "FAILED";
    }
  })();

  const [email, sms] = await Promise.all([
    emailPromise,
    smsPromise,
  ]);

  return { email, sms };
}

/* =========================================================
   ROUTE POST
   ========================================================= */

export async function POST(
  request: NextRequest
) {
  try {
    checkOrigin(request);
    checkProviders();

    const body = await readRequestBody(request);

    /*
     * La langue de communication est
     * indépendante des champs d'inscription.
     */
    const locale = getLocale(body.locale);

    const result =
      await createPendingRegistration(body);

    if (!result.success) {
      return json(
        {
          success: false,
          error: "VALIDATION_ERROR",
          fields: result.errors,
        },
        400
      );
    }

    const saved = result.data;

    /*
     * L'inscription existe désormais
     * en base, même si un fournisseur
     * rencontre une erreur temporaire.
     */
    const delivery = await dispatchCodes(
      saved,
      locale
    );

    const allAccepted =
      delivery.email === "SENT" &&
      (!isSmsVerificationEnabled() || delivery.sms === "SENT");

    return json(
      {
        success: true,
        status: "PENDING_VERIFICATION",

        registrationId:
          saved.registrationId,

        /*
         * Jeton privé requis par verify
         * et resend-code.
         *
         * Ne jamais l'inclure dans une URL.
         */
        resendToken: saved.resendToken,

        delivery: {
          email: delivery.email,
          sms: delivery.sms,
        },

        verification: {
          smsRequired: isSmsVerificationEnabled(),
          emailVerified: false,
          phoneVerified: false,

          codeLength:
            VERIFICATION_CONFIG.CODE_LENGTH,

          codeExpiresInSeconds:
            VERIFICATION_CONFIG
              .CODE_EXPIRY_MINUTES * 60,

          resendCooldownSeconds:
            VERIFICATION_CONFIG
              .RESEND_COOLDOWN_SECONDS,
        },

        nextStep: isSmsVerificationEnabled() ? "VERIFY_EMAIL_AND_SMS" : "VERIFY_EMAIL",
        redirectTo:
          CONFIG.VERIFICATION_PATH,

        /*
         * Si un canal a échoué, la page
         * affichera l'option de renvoi.
         */
        resendRequired: !allAccepted,
      },
      201
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return errorResponse(
        error.code,
        error.status
      );
    }

    /*
     * PostgreSQL : conflit de contrainte
     * UNIQUE sur email, téléphone ou
     * inscription en attente.
     */
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return errorResponse(
        "ACCOUNT_ALREADY_EXISTS",
        409
      );
    }

    const databaseCode =
      typeof error === "object" && error !== null && "code" in error &&
      typeof error.code === "string" && /^[0-9A-Z]{5}$/.test(error.code)
        ? error.code
        : null;

    console.error("[TAYM][REGISTER] Erreur:", databaseCode ?? (error instanceof Error ? error.name : "UNKNOWN"));
    if (databaseCode) {
      return errorResponse("DATABASE_ERROR", 500);
    }

    return errorResponse(
      "INTERNAL_ERROR",
      500
    );
  }
}

/* =========================================================
   MÉTHODES NON AUTORISÉES
   ========================================================= */

export async function GET() {
  return json(
    {
      success: false,
      error: "METHOD_NOT_ALLOWED",
    },
    405
  );
}
