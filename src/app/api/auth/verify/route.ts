
import "server-only";

import { NextRequest, NextResponse } from "next/server";

import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import { Pool, type PoolClient } from "pg";

import {
  verifyVerificationCode,
  isSmsVerificationEnabled,
  isRegistrationFullyVerified,
  type VerificationRecord,
  type VerificationChannel,
} from "@/lib/auth/verification";

/* =========================================================
   FAHRSCHULE TAYM
   API : VALIDATION DE L'INSCRIPTION

   POST /api/auth/verify

   - Vérification EMAIL + SMS
   - Codes de 6 chiffres
   - Inscription protégée par jeton
   - Transactions PostgreSQL
   - Activation unique du compte
   - Création de session sécurisée
   - Redirection vers le dashboard

   Aucun composant client.
   ========================================================= */


/* =========================================================
   CONFIGURATION
   ========================================================= */

const CONFIG = {
  MAX_BODY_BYTES: 4096,
  SESSION_DAYS: 30,
  SESSION_COOKIE: "taym_session",
  DASHBOARD_PATH: "/dashboard",
} as const;

type ErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_ORIGIN"
  | "UNAUTHORIZED"
  | "REGISTRATION_EXPIRED"
  | "CODE_INVALID"
  | "CODE_EXPIRED"
  | "MAX_ATTEMPTS"
  | "CODE_NOT_READY"
  | "EMAIL_OR_PHONE_EXISTS"
  | "CONFIGURATION_ERROR"
  | "INTERNAL_ERROR";

type VerificationResponse = {
  success: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  redirectTo?: string;
  error?: ErrorCode;
  channel?: VerificationChannel;
  attemptsRemaining?: number;
};

type RegistrationRow = {
  id: string;
  status: string;
  first_name: string;
  last_name: string;
  full_name: string;
  country_code: string;
  phone_country_code: string;
  dial_code: string;
  phone_e164: string;
  email: string;
  password_hash: string;
  accepted_terms_at: Date;
  accepted_privacy_at: Date;
  resend_token_hash: string;
  email_verified_at: Date | null;
  phone_verified_at: Date | null;
  expires_at: Date | null;
};

type VerificationRow = {
  id: string;
  registration_id: string;
  channel: string;
  destination: string;
  code_hash: string;
  created_at: Date;
  expires_at: Date;
  attempts: number;
  verified_at: Date | null;
  delivery_status: string;
};

type Input = {
  registrationId: string;
  resendToken: string;
  emailCode: string;
  smsCode: string;
};

type ChannelCheck = {
  success: boolean;
  error?: ErrorCode;
  attemptsRemaining?: number;
};

/* =========================================================
   GESTION DES ERREURS
   ========================================================= */

class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode
  ) {
    super(code);
    this.name = "ApiError";
  }
}

function json(
  data: VerificationResponse,
  status = 200
) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function failure(
  code: ErrorCode,
  status: number,
  extra?: Partial<VerificationResponse>
) {
  return json(
    {
      success: false,
      emailVerified: false,
      phoneVerified: false,
      error: code,
      ...extra,
    },
    status
  );
}

/* =========================================================
   POSTGRESQL
   Même pool global que resend-code/route.ts.
   ========================================================= */

const globalDatabase = globalThis as typeof globalThis & {
  taymResendPool?: Pool;
};

function database(): Pool {
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
          "[TAYM][POSTGRES] Pool:",
          error.name
        );
      }
    );
  }

  return globalDatabase.taymResendPool;
}

/* =========================================================
   OUTILS DE VALIDATION
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

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function isOtp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9]{6}$/.test(value)
  );
}

/* =========================================================
   VÉRIFICATION DE L'ORIGINE

   Protège contre les requêtes provenant
   d'un autre site, en complément du jeton.
   ========================================================= */

function checkOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");

  if (!origin) return;

  if (process.env.NODE_ENV === "production" && origin === "https://fahrschule-taym.de") return;

  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL;

  if (!configuredUrl) {
    throw new ApiError(
      500,
      "CONFIGURATION_ERROR"
    );
  }

  let allowedOrigin: string;

  try {
    allowedOrigin = new URL(configuredUrl).origin;
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

/* =========================================================
   LECTURE ET VALIDATION DU JSON
   ========================================================= */

async function readInput(
  request: NextRequest
): Promise<Input> {
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

  const declaredSize = Number(
    request.headers.get("content-length") || 0
  );

  if (
    !Number.isFinite(declaredSize) ||
    declaredSize > CONFIG.MAX_BODY_BYTES
  ) {
    throw new ApiError(
      400,
      "INVALID_REQUEST"
    );
  }

  let body: unknown;

  try {
    const raw = await request.text();

    if (
      Buffer.byteLength(raw, "utf8") >
      CONFIG.MAX_BODY_BYTES
    ) {
      throw new Error("BODY_TOO_LARGE");
    }

    body = JSON.parse(raw);
  } catch {
    throw new ApiError(
      400,
      "INVALID_REQUEST"
    );
  }

  if (!isObject(body)) {
    throw new ApiError(
      400,
      "INVALID_REQUEST"
    );
  }

  const {
    registrationId,
    resendToken,
    emailCode,
    smsCode,
  } = body;

  if (
    !isUuid(registrationId) ||
    typeof resendToken !== "string" ||
    resendToken.length < 32 ||
    resendToken.length > 256 ||
    !isOtp(emailCode) ||
    (isSmsVerificationEnabled() && !isOtp(smsCode))
  ) {
    throw new ApiError(
      400,
      "INVALID_REQUEST"
    );
  }

  return {
    registrationId,
    resendToken,
    emailCode,
    smsCode: typeof smsCode === "string" ? smsCode : "",
  };
}

/* =========================================================
   VÉRIFICATION DU JETON D'INSCRIPTION

   Le jeton brut provient de register/route.ts.
   Seule son empreinte SHA-256 est stockée.
   ========================================================= */

function isValidRegistrationToken(
  token: string,
  storedHash: string
): boolean {
  if (
    !/^[a-f0-9]{64}$/i.test(storedHash)
  ) {
    return false;
  }

  const incomingHash = createHash("sha256")
    .update(token, "utf8")
    .digest();

  const stored = Buffer.from(
    storedHash,
    "hex"
  );

  return timingSafeEqual(
    incomingHash,
    stored
  );
}

/* =========================================================
   LECTURE DE L'INSCRIPTION
   Verrouillage : FOR UPDATE
   ========================================================= */

async function getRegistration(
  client: PoolClient,
  registrationId: string
): Promise<RegistrationRow> {
  const result =
    await client.query<RegistrationRow>(
      `
      SELECT
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
   LECTURE DES CHALLENGES
   ========================================================= */

async function getChallenges(
  client: PoolClient,
  registrationId: string
): Promise<{
  email: VerificationRow;
  sms: VerificationRow;
}> {
  const result =
    await client.query<VerificationRow>(
      `
      SELECT
        id,
        registration_id,
        channel,
        destination,
        code_hash,
        created_at,
        expires_at,
        attempts,
        verified_at,
        delivery_status
      FROM registration_verifications
      WHERE registration_id = $1
        AND channel IN ('EMAIL', 'SMS')
      ORDER BY channel
      FOR UPDATE
      `,
      [registrationId]
    );

  const email = result.rows.find(
    (row) => row.channel === "EMAIL"
  );

  const sms = result.rows.find(
    (row) => row.channel === "SMS"
  );

  if (!email || !sms) {
    throw new ApiError(
      401,
      "UNAUTHORIZED"
    );
  }

  return { email, sms };
}

/* =========================================================
   CONVERSION VERS verification.ts
   ========================================================= */

function toVerificationRecord(
  row: VerificationRow
): VerificationRecord {
  if (
    row.channel !== "EMAIL" &&
    row.channel !== "SMS"
  ) {
    throw new ApiError(
      500,
      "INTERNAL_ERROR"
    );
  }

  return {
    id: row.id,
    registrationId: row.registration_id,
    channel: row.channel,
    destination: row.destination,
    codeHash: row.code_hash,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    attempts: row.attempts,
    verifiedAt: row.verified_at,
  };
}

/* =========================================================
   VÉRIFICATION INDIVIDUELLE D'UN CANAL

   Les tentatives sont persistées dans
   PostgreSQL, même si le code est faux.

   Si le canal est déjà vérifié, il est
   conservé comme valide.
   ========================================================= */

async function verifyChannel(
  client: PoolClient,
  row: VerificationRow,
  code: string,
  now: Date
): Promise<ChannelCheck> {
  if (row.verified_at !== null) {
    return { success: true };
  }

  if (row.delivery_status !== "SENT") {
    return {
      success: false,
      error: "CODE_NOT_READY",
    };
  }

  const record = toVerificationRecord(row);

  const result = verifyVerificationCode({
    code,
    record,
    now,
  });

  if (result.status === "EXPIRED") {
    return {
      success: false,
      error: "CODE_EXPIRED",
    };
  }

  if (result.status === "MAX_ATTEMPTS") {
    return {
      success: false,
      error: "MAX_ATTEMPTS",
      attemptsRemaining: 0,
    };
  }

  if (!result.success) {
    await client.query(
      `
      UPDATE registration_verifications
      SET attempts = $1
      WHERE id = $2
        AND verified_at IS NULL
      `,
      [result.attempts, row.id]
    );

    return {
      success: false,
      error:
        result.attemptsRemaining === 0
          ? "MAX_ATTEMPTS"
          : "CODE_INVALID",
      attemptsRemaining:
        result.attemptsRemaining,
    };
  }

  const updated = await client.query(
    `
    UPDATE registration_verifications
    SET
      verified_at = $1
    WHERE id = $2
      AND verified_at IS NULL
      AND delivery_status = 'SENT'
    `,
    [now, row.id]
  );

  if (updated.rowCount !== 1) {
    throw new ApiError(
      409,
      "CODE_NOT_READY"
    );
  }

  row.verified_at = now;

  return { success: true };
}

/* =========================================================
   CRÉATION DE SESSION

   Cookie : jeton aléatoire
   Base : empreinte SHA-256

   Le jeton original n'est pas stocké
   dans PostgreSQL.
   ========================================================= */

function createSessionData(now: Date) {
  const token = randomBytes(32).toString("hex");

  const tokenHash = createHash("sha256")
    .update(token, "utf8")
    .digest("hex");

  const expiresAt = new Date(
    now.getTime() +
      CONFIG.SESSION_DAYS * 24 * 60 * 60 * 1000
  );

  return {
    token,
    tokenHash,
    expiresAt,
  };
}

/* =========================================================
   INSCRIPTION, ACTIVATION ET SESSION

   Toutes ces opérations sont exécutées
   dans la même transaction PostgreSQL.
   ========================================================= */

async function activateAccount(
  client: PoolClient,
  registration: RegistrationRow,
  now: Date
): Promise<{
  sessionToken: string;
  sessionExpiresAt: Date;
}> {
  const userId = randomUUID();

  await client.query(
    `
    INSERT INTO users (
      id,
      first_name,
      last_name,
      full_name,
      email,
      phone_e164,
      country_code,
      phone_country_code,
      dial_code,
      password_hash,
      email_verified_at,
      phone_verified_at,
      accepted_terms_at,
      accepted_privacy_at,
      status,
      created_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14,
      'ACTIVE', $15, $15
    )
    `,
    [
      userId,
      registration.first_name,
      registration.last_name,
      registration.full_name,
      registration.email,
      registration.phone_e164,
      registration.country_code,
      registration.phone_country_code,
      registration.dial_code,
      registration.password_hash,
      registration.email_verified_at,
      registration.phone_verified_at,
      registration.accepted_terms_at,
      registration.accepted_privacy_at,
      now,
    ]
  );

  const updated =
    await client.query(
      `
      UPDATE pending_registrations
      SET status = 'COMPLETED'
      WHERE id = $1
        AND status = 'PENDING_VERIFICATION'
      `,
      [registration.id]
    );

  if (updated.rowCount !== 1) {
    throw new ApiError(
      409,
      "UNAUTHORIZED"
    );
  }

  const session = createSessionData(now);

  await client.query(
    `
    INSERT INTO user_sessions (
      id,
      user_id,
      token_hash,
      created_at,
      expires_at,
      revoked_at
    )
    VALUES ($1, $2, $3, $4, $5, NULL)
    `,
    [
      randomUUID(),
      userId,
      session.tokenHash,
      now,
      session.expiresAt,
    ]
  );

  return {
    sessionToken: session.token,
    sessionExpiresAt: session.expiresAt,
  };
}

/* =========================================================
   TRAITEMENT TRANSACTIONNEL
   ========================================================= */

async function processVerification(
  input: Input
): Promise<{
  success: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  error?: ErrorCode;
  channel?: VerificationChannel;
  attemptsRemaining?: number;
  sessionToken?: string;
  sessionExpiresAt?: Date;
}> {
  const client = await database().connect();

  let committed = false;

  try {
    await client.query("BEGIN");

    const registration =
      await getRegistration(
        client,
        input.registrationId
      );

    if (
      !isValidRegistrationToken(
        input.resendToken,
        registration.resend_token_hash
      )
    ) {
      throw new ApiError(
        401,
        "UNAUTHORIZED"
      );
    }

    if (
      registration.status !==
      "PENDING_VERIFICATION"
    ) {
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

    const rows = await getChallenges(
      client,
      registration.id
    );

    /* Vérification des destinations */

    if (
      rows.email.destination.toLowerCase() !==
        registration.email.toLowerCase() ||
      rows.sms.destination !==
        registration.phone_e164
    ) {
      throw new ApiError(
        401,
        "UNAUTHORIZED"
      );
    }

    /* Vérification EMAIL */

    const emailCheck = await verifyChannel(
      client,
      rows.email,
      input.emailCode,
      now
    );

    /* Vérification SMS */

    const smsCheck: ChannelCheck = isSmsVerificationEnabled()
      ? await verifyChannel(client, rows.sms, input.smsCode, now)
      : { success: true };

    const emailVerified =
      rows.email.verified_at !== null;

    const phoneVerified =
      rows.sms.verified_at !== null;

    /* Sauvegarde des états de vérification */

    await client.query(
      `
      UPDATE pending_registrations
      SET
        email_verified_at = $1,
        phone_verified_at = $2
      WHERE id = $3
      `,
      [
        rows.email.verified_at,
        rows.sms.verified_at,
        registration.id,
      ]
    );

    /**
     * Si un code est incorrect ou expiré,
     * enregistrer quand même les tentatives
     * avant de retourner l'erreur.
     */

    if (!emailCheck.success || !smsCheck.success) {
      await client.query("COMMIT");
      committed = true;

      const failedChannel =
        !emailCheck.success ? "EMAIL" : "SMS";

      const failedCheck =
        !emailCheck.success
          ? emailCheck
          : smsCheck;

      return {
        success: false,
        emailVerified,
        phoneVerified,
        error:
          failedCheck.error || "CODE_INVALID",
        channel: failedChannel,
        attemptsRemaining:
          failedCheck.attemptsRemaining,
      };
    }

    const emailRecord =
      toVerificationRecord(rows.email);

    const smsRecord =
      toVerificationRecord(rows.sms);

    /* Contrôle définitif des deux canaux */

    if (
      isSmsVerificationEnabled()
        ? !isRegistrationFullyVerified(emailRecord, smsRecord)
        : !emailRecord.verifiedAt
    ) {
      throw new ApiError(
        409,
        "CODE_INVALID"
      );
    }

    registration.email_verified_at =
      rows.email.verified_at;

    registration.phone_verified_at =
      rows.sms.verified_at;

    /* Création du compte et de la session */

    const activated = await activateAccount(
      client,
      registration,
      now
    );

    await client.query("COMMIT");
    committed = true;

    return {
      success: true,
      emailVerified: true,
      phoneVerified,
      sessionToken: activated.sessionToken,
      sessionExpiresAt:
        activated.sessionExpiresAt,
    };
  } catch (error) {
    if (!committed) {
      try {
        await client.query("ROLLBACK");
      } catch {
        console.error(
          "[TAYM][AUTH] Échec rollback."
        );
      }
    }

    throw error;
  } finally {
    client.release();
  }
}

/* =========================================================
   ROUTE POST
   ========================================================= */

export async function POST(
  request: NextRequest
) {
  try {
    checkOrigin(request);

    const input = await readInput(request);

    const result =
      await processVerification(input);

    if (!result.success) {
      const status =
        result.error === "MAX_ATTEMPTS"
          ? 429
          : result.error === "CODE_EXPIRED"
            ? 410
            : result.error === "CODE_NOT_READY"
              ? 409
              : 400;

      return json(
        {
          success: false,
          emailVerified:
            result.emailVerified,
          phoneVerified:
            result.phoneVerified,
          error: result.error,
          channel: result.channel,
          attemptsRemaining:
            result.attemptsRemaining,
        },
        status
      );
    }

    if (
      !result.sessionToken ||
      !result.sessionExpiresAt
    ) {
      throw new ApiError(
        500,
        "INTERNAL_ERROR"
      );
    }

    const response = json({
      success: true,
      emailVerified: true,
      phoneVerified: result.phoneVerified,
      redirectTo:
        CONFIG.DASHBOARD_PATH,
    });

    /* Cookie d'authentification */

    response.cookies.set(
      CONFIG.SESSION_COOKIE,
      result.sessionToken,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/",
        expires: result.sessionExpiresAt,
        priority: "high",
      }
    );

    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      return failure(
        error.code,
        error.statusCode
      );
    }

    /**
     * Les contraintes UNIQUE email/téléphone
     * en PostgreSQL renvoient le code 23505.
     */
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return failure(
        "EMAIL_OR_PHONE_EXISTS",
        409
      );
    }

    console.error(
      "[TAYM][AUTH] Erreur verify:",
      error instanceof Error
        ? error.name
        : "UNKNOWN"
    );

    return failure(
      "INTERNAL_ERROR",
      500
    );
  }
}

/* =========================================================
   AUTRES MÉTHODES
   ========================================================= */

export async function GET() {
  return failure(
    "INVALID_REQUEST",
    405
  );
}
