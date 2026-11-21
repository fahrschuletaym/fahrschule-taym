
import "server-only";

import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

/* =========================================================
   FAHRSCHULE TAYM
   VERIFICATION SERVICE

   Email : Resend
   SMS   : Twilio

   Ce module :
   - Génère les codes
   - Protège les codes
   - Vérifie leur validité
   - Gère expiration et tentatives
   - Prépare les renvois
   - Contrôle la double vérification

   Exécution serveur uniquement.
   Aucune dépendance à Prisma ou aux APIs HTTP.
   ========================================================= */

/* =========================================================
   CONFIGURATION
   ========================================================= */

export const VERIFICATION_CONFIG = {
  CODE_LENGTH: 6,
  CODE_EXPIRY_MINUTES: 10,
  MAX_ATTEMPTS: 5,
  RESEND_COOLDOWN_SECONDS: 60,
} as const;

export type VerificationChannel = "EMAIL" | "SMS";

export type VerificationStatus =
  | "VERIFIED"
  | "INVALID_CODE"
  | "INVALID_FORMAT"
  | "EXPIRED"
  | "MAX_ATTEMPTS"
  | "ALREADY_VERIFIED";

export interface VerificationRecord {
  id: string;
  registrationId: string;
  channel: VerificationChannel;
  destination: string;

  codeHash: string;

  createdAt: Date;
  expiresAt: Date;

  attempts: number;
  verifiedAt: Date | null;
}

export interface GeneratedChallenge {
  code: string;
  record: VerificationRecord;
}

export interface VerificationResult {
  success: boolean;
  status: VerificationStatus;
  attemptsRemaining: number;
  verifiedAt: Date | null;
  attempts: number;
}

export interface ResendDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

/* =========================================================
   SECRET CRYPTOGRAPHIQUE
   ========================================================= */

function getVerificationSecret(): string {
  const secret = process.env.VERIFICATION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "VERIFICATION_SECRET doit contenir au moins 32 caractères."
    );
  }

  return secret;
}

/* =========================================================
   VALIDATION DES DONNÉES
   ========================================================= */

export function isValidVerificationCode(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    /^[0-9]{6}$/.test(value)
  );
}

function assertNonEmpty(
  value: string,
  field: string
): void {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new Error(`${field} est obligatoire.`);
  }
}

function validateChannel(
  channel: VerificationChannel
): void {
  if (channel !== "EMAIL" && channel !== "SMS") {
    throw new Error(
      "Canal de vérification non autorisé."
    );
  }
}

function normalizeDestination(
  channel: VerificationChannel,
  destination: string
): string {
  assertNonEmpty(destination, "destination");

  const normalized = destination.trim();

  if (channel === "EMAIL") {
    return normalized.toLowerCase();
  }

  // Le numéro doit déjà avoir été validé
  // au format E.164 par registration.ts.
  if (!/^\+[1-9]\d{1,14}$/.test(normalized)) {
    throw new Error(
      "Le numéro doit être au format international E.164."
    );
  }

  return normalized;
}

/* =========================================================
   GÉNÉRATION SÉCURISÉE DU CODE
   ========================================================= */

export function generateVerificationCode(): string {
  const value = randomInt(0, 1_000_000);

  return value.toString().padStart(
    VERIFICATION_CONFIG.CODE_LENGTH,
    "0"
  );
}

/* =========================================================
   EMPREINTE CRYPTOGRAPHIQUE HMAC-SHA256

   Un code à six chiffres possède un espace
   de recherche limité.

   Nous utilisons donc une clé secrète serveur
   au lieu d'un simple SHA256 non protégé.

   L'empreinte est liée :
   - à l'inscription
   - au canal EMAIL ou SMS
   - à la destination
   - à l'identifiant du challenge
   ========================================================= */

export function hashVerificationCode(
  code: string,
  context: Pick<
    VerificationRecord,
    "id" | "registrationId" | "channel" | "destination"
  >
): string {
  if (!isValidVerificationCode(code)) {
    throw new Error(
      "Le code doit contenir exactement six chiffres."
    );
  }

  validateChannel(context.channel);

  assertNonEmpty(
    context.registrationId,
    "registrationId"
  );

  assertNonEmpty(context.id, "id");

  const destination = normalizeDestination(
    context.channel,
    context.destination
  );

  const message = JSON.stringify([
    "FAHRSCHULE_TAYM",
    "REGISTRATION_VERIFICATION",
    "v1",
    context.registrationId,
    context.id,
    context.channel,
    destination,
    code,
  ]);

  return createHmac(
    "sha256",
    getVerificationSecret()
  )
    .update(message, "utf8")
    .digest("hex");
}

/* =========================================================
   COMPARAISON SÉCURISÉE
   ========================================================= */

function safeHashEquals(
  storedHash: string,
  providedHash: string
): boolean {
  if (
    !/^[a-f0-9]{64}$/i.test(storedHash) ||
    !/^[a-f0-9]{64}$/i.test(providedHash)
  ) {
    return false;
  }

  const stored = Buffer.from(storedHash, "hex");
  const provided = Buffer.from(providedHash, "hex");

  return timingSafeEqual(stored, provided);
}

/* =========================================================
   CRÉATION D'UN CHALLENGE
   ========================================================= */

export function createVerificationChallenge(
  params: {
    registrationId: string;
    channel: VerificationChannel;
    destination: string;
    now?: Date;
  }
): GeneratedChallenge {
  const {
    registrationId,
    channel,
    destination,
    now = new Date(),
  } = params;

  assertNonEmpty(registrationId, "registrationId");
  validateChannel(channel);

  if (
    !(now instanceof Date) ||
    !Number.isFinite(now.getTime())
  ) {
    throw new Error("Date de création invalide.");
  }

  const normalizedDestination =
    normalizeDestination(channel, destination);

  const code = generateVerificationCode();

  const id = randomUUID();

  const expiresAt = new Date(
    now.getTime() +
      VERIFICATION_CONFIG.CODE_EXPIRY_MINUTES *
        60_000
  );

  const context = {
    id,
    registrationId,
    channel,
    destination: normalizedDestination,
  };

  const record: VerificationRecord = {
    ...context,

    codeHash: hashVerificationCode(
      code,
      context
    ),

    createdAt: new Date(now.getTime()),
    expiresAt,

    attempts: 0,
    verifiedAt: null,
  };

  return {
    code,
    record,
  };
}

/* =========================================================
   CRÉATION DES DEUX CODES

   Les codes EMAIL et SMS doivent être
   différents et indépendants.
   ========================================================= */

export function createRegistrationChallenges(
  params: {
    registrationId: string;
    email: string;
    phoneE164: string;
    now?: Date;
  }
): {
  email: GeneratedChallenge;
  sms: GeneratedChallenge;
} {
  const {
    registrationId,
    email,
    phoneE164,
    now = new Date(),
  } = params;

  const emailChallenge =
    createVerificationChallenge({
      registrationId,
      channel: "EMAIL",
      destination: email,
      now,
    });

  let smsChallenge =
    createVerificationChallenge({
      registrationId,
      channel: "SMS",
      destination: phoneE164,
      now,
    });

  // Garantir deux codes distincts.
  while (
    smsChallenge.code === emailChallenge.code
  ) {
    smsChallenge = createVerificationChallenge({
      registrationId,
      channel: "SMS",
      destination: phoneE164,
      now,
    });
  }

  return {
    email: emailChallenge,
    sms: smsChallenge,
  };
}

/* =========================================================
   EXPIRATION ET BLOCAGE
   ========================================================= */

export function isVerificationExpired(
  record: VerificationRecord,
  now: Date = new Date()
): boolean {
  return now.getTime() >= record.expiresAt.getTime();
}

export function isVerificationLocked(
  record: VerificationRecord
): boolean {
  return (
    record.attempts >=
    VERIFICATION_CONFIG.MAX_ATTEMPTS
  );
}

export function getRemainingAttempts(
  record: VerificationRecord
): number {
  return Math.max(
    0,
    VERIFICATION_CONFIG.MAX_ATTEMPTS -
      record.attempts
  );
}

/* =========================================================
   VALIDATION D'UN CODE

   Cette fonction ne modifie pas directement
   PostgreSQL.

   Elle retourne les valeurs à persister
   par l'API dans une transaction atomique.
   ========================================================= */

export function verifyVerificationCode(
  params: {
    code: unknown;
    record: VerificationRecord;
    now?: Date;
  }
): VerificationResult {
  const {
    code,
    record,
    now = new Date(),
  } = params;

  // Un code déjà utilisé ne peut pas servir
  // une deuxième fois.

  if (record.verifiedAt !== null) {
    return {
      success: false,
      status: "ALREADY_VERIFIED",
      attemptsRemaining:
        getRemainingAttempts(record),
      verifiedAt: record.verifiedAt,
      attempts: record.attempts,
    };
  }

  // Expiration

  if (isVerificationExpired(record, now)) {
    return {
      success: false,
      status: "EXPIRED",
      attemptsRemaining: 0,
      verifiedAt: null,
      attempts: record.attempts,
    };
  }

  // Blocage après trop de tentatives

  if (isVerificationLocked(record)) {
    return {
      success: false,
      status: "MAX_ATTEMPTS",
      attemptsRemaining: 0,
      verifiedAt: null,
      attempts: record.attempts,
    };
  }

  // Format non valide : tentative consommée.

  if (!isValidVerificationCode(code)) {
    const attempts = record.attempts + 1;

    return {
      success: false,
      status: "INVALID_FORMAT",
      attemptsRemaining: Math.max(
        0,
        VERIFICATION_CONFIG.MAX_ATTEMPTS -
          attempts
      ),
      verifiedAt: null,
      attempts,
    };
  }

  // Recalcul de l'empreinte HMAC.

  const providedHash = hashVerificationCode(
    code,
    {
      id: record.id,
      registrationId: record.registrationId,
      channel: record.channel,
      destination: record.destination,
    }
  );

  const isMatch = safeHashEquals(
    record.codeHash,
    providedHash
  );

  if (!isMatch) {
    const attempts = record.attempts + 1;

    return {
      success: false,
      status: "INVALID_CODE",
      attemptsRemaining: Math.max(
        0,
        VERIFICATION_CONFIG.MAX_ATTEMPTS -
          attempts
      ),
      verifiedAt: null,
      attempts,
    };
  }

  // Vérification réussie.

  return {
    success: true,
    status: "VERIFIED",
    attemptsRemaining:
      getRemainingAttempts(record),
    verifiedAt: new Date(now.getTime()),
    attempts: record.attempts,
  };
}

/* =========================================================
   VÉRIFICATION DU DÉLAI AVANT RENVOI
   ========================================================= */

export function canResendVerificationCode(
  createdAt: Date,
  now: Date = new Date()
): ResendDecision {
  const cooldown =
    VERIFICATION_CONFIG.RESEND_COOLDOWN_SECONDS;

  const elapsedSeconds = Math.floor(
    (now.getTime() - createdAt.getTime()) /
      1000
  );

  const retryAfterSeconds = Math.max(
    0,
    cooldown - elapsedSeconds
  );

  return {
    allowed: retryAfterSeconds === 0,
    retryAfterSeconds,
  };
}

/* =========================================================
   RENOUVELLEMENT D'UN CHALLENGE

   Appeler cette fonction seulement après
   vérification du délai et des limites
   d'envoi côté serveur.

   Le nouveau challenge doit remplacer
   l'ancien dans PostgreSQL.
   ========================================================= */

export function renewVerificationChallenge(
  record: VerificationRecord,
  now: Date = new Date()
): GeneratedChallenge {
  if (record.verifiedAt !== null) {
    throw new Error(
      "Cette vérification est déjà terminée."
    );
  }

  const decision = canResendVerificationCode(
    record.createdAt,
    now
  );

  if (!decision.allowed) {
    throw new Error(
      `Veuillez attendre ${decision.retryAfterSeconds} secondes avant un nouvel envoi.`
    );
  }

  let challenge = createVerificationChallenge({
    registrationId: record.registrationId,
    channel: record.channel,
    destination: record.destination,
    now,
  });

  // Éviter de réutiliser exactement
  // le même code que le challenge précédent.

  while (
    safeHashEquals(
      record.codeHash,
      hashVerificationCode(challenge.code, {
        id: record.id,
        registrationId: record.registrationId,
        channel: record.channel,
        destination: record.destination,
      })
    )
  ) {
    challenge = createVerificationChallenge({
      registrationId: record.registrationId,
      channel: record.channel,
      destination: record.destination,
      now,
    });
  }

  return challenge;
}

/* =========================================================
   DOUBLE VÉRIFICATION OBLIGATOIRE
   ========================================================= */

export function isRegistrationFullyVerified(
  emailRecord: VerificationRecord,
  smsRecord: VerificationRecord
): boolean {
  if (
    emailRecord.registrationId !==
    smsRecord.registrationId
  ) {
    return false;
  }

  if (
    emailRecord.channel !== "EMAIL" ||
    smsRecord.channel !== "SMS"
  ) {
    return false;
  }

  return (
    emailRecord.verifiedAt !== null &&
    smsRecord.verifiedAt !== null
  );
}

/* =========================================================
   INFORMATIONS PUBLIQUES SANS CODE SECRET
   ========================================================= */

export function getVerificationPublicStatus(
  record: VerificationRecord,
  now: Date = new Date()
) {
  return {
    channel: record.channel,
    verified: record.verifiedAt !== null,
    expired: isVerificationExpired(
      record,
      now
    ),
    locked: isVerificationLocked(record),
    attemptsRemaining:
      getRemainingAttempts(record),
    expiresAt: record.expiresAt.toISOString(),
  };
}

/** SMS verification is opt-in until the provider is configured. */
export function isSmsVerificationEnabled(): boolean {
  return process.env.SMS_VERIFICATION_ENABLED === "true";
}
