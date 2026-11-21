
import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { Pool } from "pg";

/* ============================================================
   FAHRSCHULE TAYM
   AUTHENTIFICATION — SESSIONS CANDIDATS

   Fichier :
   src/lib/auth/session.ts

   Technologies :
   - Next.js App Router
   - TypeScript
   - PostgreSQL
   - pg
   - Node.js Crypto

   Tables :
   - users
   - user_sessions

   Sécurité :
   - Cookie HttpOnly
   - Session aléatoire
   - SHA-256 du jeton en PostgreSQL
   - Vérification expiration / révocation
   - Vérification du compte actif
   - Vérification email et SMS
   - Vérification du rôle candidat

   Compatible PC et mobile.
   Aucun composant UI ni menu.
   ============================================================ */

/* ============================================================
   1. CONFIGURATION
   ============================================================ */

export const SESSION_COOKIE_NAME = "taym_session";

export const SESSION_DURATION_SECONDS =
  60 * 60 * 24 * 7;

const SESSION_TOKEN_BYTES = 32;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/* ============================================================
   2. TYPES
   ============================================================ */

export type CandidateSession = {
  sessionId: string;
  userId: string;

  firstName: string;
  lastName: string;
  fullName: string;

  email: string;
  phoneE164: string;
  countryCode: string;

  role: "CANDIDATE";
  status: "ACTIVE";

  emailVerified: true;
  phoneVerified: boolean;

  createdAt: string;
  expiresAt: string;
};

export type NewSessionToken = {
  token: string;
  tokenHash: string;
  expiresAt: Date;
};

type CandidateSessionRow = {
  session_id: string;
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

  session_created_at: Date | string;
  session_expires_at: Date | string;
};

/* ============================================================
   3. ERREURS D'AUTHENTIFICATION
   ============================================================ */

export type SessionErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_SESSION";

export class SessionAuthError extends Error {
  readonly status: 401 | 403;
  readonly code: SessionErrorCode;

  constructor(
    code: SessionErrorCode = "UNAUTHORIZED"
  ) {
    const status: 401 | 403 =
      code === "FORBIDDEN" ? 403 : 401;

    super(
      code === "FORBIDDEN"
        ? "Access denied."
        : "Authentication required."
    );

    this.name = "SessionAuthError";
    this.code = code;
    this.status = status;

    Object.setPrototypeOf(
      this,
      SessionAuthError.prototype
    );
  }
}

/* ============================================================
   4. CONNEXION POSTGRESQL

   Réutilise la référence globale employée
   dans src/lib/dashboard.ts.

   Une nouvelle connexion n'est pas créée
   systématiquement pour chaque appel.

   DATABASE_URL est lu depuis .env.local
   par la configuration du projet.
   ============================================================ */

const globalForTaym = globalThis as typeof globalThis & {
  taymResendPool?: Pool;
};

function getDatabasePool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "[TAYM][AUTH] DATABASE_URL is not configured."
    );
  }

  if (!globalForTaym.taymResendPool) {
    const pool = new Pool({
      connectionString,
      max: 5,
      min: 0,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: false,
    });

    pool.on("error", (error) => {
      console.error(
        "[TAYM][AUTH] PostgreSQL pool error:",
        error.name
      );
    });

    globalForTaym.taymResendPool = pool;
  }

  return globalForTaym.taymResendPool;
}

/* ============================================================
   5. FONCTIONS DE SÉCURITÉ
   ============================================================ */

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    UUID_PATTERN.test(value)
  );
}

function isValidSessionToken(
  token: unknown
): token is string {
  return (
    typeof token === "string" &&
    TOKEN_PATTERN.test(token)
  );
}

function toValidIso(value: Date | string): string {
  const date =
    value instanceof Date ? value : new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new Error(
      "[TAYM][AUTH] Invalid session date."
    );
  }

  return date.toISOString();
}

/**
 * Crée l'empreinte SHA-256 d'un jeton.
 *
 * Le jeton brut reste dans le cookie.
 * Seule son empreinte est stockée
 * dans user_sessions.token_hash.
 */
export function hashSessionToken(
  token: string
): string {
  if (!isValidSessionToken(token)) {
    throw new SessionAuthError("INVALID_SESSION");
  }

  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

/**
 * Génère un jeton cryptographiquement
 * aléatoire et sa date d'expiration.
 *
 * À utiliser lors de l'activation du
 * compte ou d'une nouvelle connexion.
 */
export function generateSessionToken():
  NewSessionToken {
  const token = randomBytes(
    SESSION_TOKEN_BYTES
  ).toString("base64url");

  const tokenHash = hashSessionToken(token);

  const expiresAt = new Date(
    Date.now() +
      SESSION_DURATION_SECONDS * 1000
  );

  return {
    token,
    tokenHash,
    expiresAt,
  };
}

/* ============================================================
   6. OPTIONS DU COOKIE

   HttpOnly :
   JavaScript côté navigateur ne peut pas
   lire le jeton.

   Secure :
   Transmission HTTPS en production.

   SameSite Lax :
   Protection de base contre le CSRF.

   Path / :
   Cookie disponible sur les pages
   du compte et du Dashboard.
   ============================================================ */

export function getSessionCookieOptions() {
  return {
    httpOnly: true as const,
    secure:
      process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    priority: "high" as const,
    maxAge: SESSION_DURATION_SECONDS,
  };
}

/**
 * Options pour supprimer le cookie
 * lors de la déconnexion.
 */
export function getSessionCookieClearOptions() {
  return {
    ...getSessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  };
}

/* ============================================================
   7. VÉRIFICATION POSTGRESQL

   Vérifie ensemble :
   - le jeton
   - la session existante
   - la date d'expiration
   - l'absence de révocation
   - l'utilisateur actif
   - son rôle CANDIDATE
   - email confirmé
   - téléphone confirmé

   Aucune donnée d'un autre utilisateur
   ne peut être obtenue avec un userId
   fourni par le navigateur.
   ============================================================ */

export async function findCandidateSessionByToken(
  token: string | null | undefined
): Promise<CandidateSession | null> {
  if (!isValidSessionToken(token)) {
    return null;
  }

  const tokenHash = hashSessionToken(token);

  const db = getDatabasePool();

  const result =
    await db.query<CandidateSessionRow>(
      `
      SELECT
        s.id AS session_id,
        s.user_id,

        s.created_at AS session_created_at,
        s.expires_at AS session_expires_at,

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

      FROM user_sessions AS s

      INNER JOIN users AS u
        ON u.id = s.user_id

      WHERE s.token_hash = $1

        AND s.revoked_at IS NULL

        AND s.expires_at > NOW()

        AND u.status = 'ACTIVE'

        AND u.role = 'CANDIDATE'

        AND u.email_verified_at IS NOT NULL


      LIMIT 1
      `,
      [tokenHash]
    );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    sessionId: row.session_id,
    userId: row.user_id,

    firstName: row.first_name,
    lastName: row.last_name,
    fullName: row.full_name,

    email: row.email,
    phoneE164: row.phone_e164,
    countryCode: row.country_code,

    role: "CANDIDATE",
    status: "ACTIVE",

    emailVerified: true,
    phoneVerified: row.phone_verified_at !== null,

    createdAt: toValidIso(
      row.session_created_at
    ),

    expiresAt: toValidIso(
      row.session_expires_at
    ),
  };
}

/* ============================================================
   8. SESSION DEPUIS UNE API NEXT.JS

   Utilisation dans :
   src/app/api/dashboard/route.ts

   Le token provient du cookie HttpOnly.
   Aucun userId n'est accepté depuis
   l'URL ou le corps de la requête.
   ============================================================ */

export async function getCandidateSession(
  request: NextRequest
): Promise<CandidateSession | null> {
  const token =
    request.cookies.get(
      SESSION_COOKIE_NAME
    )?.value ?? null;

  return findCandidateSessionByToken(token);
}

/**
 * Variante obligatoire :
 * lance une erreur 401 lorsqu'aucune
 * session valide n'est disponible.
 */
export async function requireCandidateSession(
  request: NextRequest
): Promise<CandidateSession> {
  const session = await getCandidateSession(
    request
  );

  if (!session) {
    throw new SessionAuthError(
      "UNAUTHORIZED"
    );
  }

  return session;
}

/* ============================================================
   9. SESSION DEPUIS UN SERVER COMPONENT

   Utilisation dans une page serveur
   protégée par Next.js App Router.

   Peut être combinée avec redirect("/login").

   Ne crée aucun nouveau layout.
   ============================================================ */

export async function getCurrentCandidateSession():
  Promise<CandidateSession | null> {
  const cookieStore = await cookies();

  const token =
    cookieStore.get(
      SESSION_COOKIE_NAME
    )?.value ?? null;

  return findCandidateSessionByToken(token);
}

/**
 * Version obligatoire pour un
 * Server Component ou une Server Action.
 */
export async function requireCurrentCandidateSession():
  Promise<CandidateSession> {
  const session =
    await getCurrentCandidateSession();

  if (!session) {
    throw new SessionAuthError(
      "UNAUTHORIZED"
    );
  }

  return session;
}

/* ============================================================
   10. RÉVOCATION DE SESSION

   Utilisable lors de la déconnexion.

   On révoque seulement une session
   appartenant réellement au candidat
   concerné.

   Les jetons révoqués ne permettent
   plus d'accéder au Dashboard.
   ============================================================ */

export async function revokeCandidateSession(
  session: Pick<
    CandidateSession,
    "sessionId" | "userId"
  >
): Promise<boolean> {
  if (
    !isUuid(session.sessionId) ||
    !isUuid(session.userId)
  ) {
    return false;
  }

  const db = getDatabasePool();

  const result = await db.query(
    `
    UPDATE user_sessions

    SET revoked_at = NOW()

    WHERE id = $1

      AND user_id = $2

      AND revoked_at IS NULL
    `,
    [
      session.sessionId,
      session.userId,
    ]
  );

  return (result.rowCount ?? 0) > 0;
}

/* ============================================================
   11. RÉVOCATION DE TOUTES LES SESSIONS

   Pour une fonctionnalité future :
   "Déconnecter tous les appareils".

   Ne doit être déclenchée qu'après
   authentification du propriétaire
   du compte ou autorisation admin.
   ============================================================ */

export async function revokeAllCandidateSessions(
  authenticatedUserId: string
): Promise<number> {
  if (!isUuid(authenticatedUserId)) {
    throw new SessionAuthError(
      "UNAUTHORIZED"
    );
  }

  const db = getDatabasePool();

  const result = await db.query(
    `
    UPDATE user_sessions

    SET revoked_at = NOW()

    WHERE user_id = $1

      AND revoked_at IS NULL
    `,
    [authenticatedUserId]
  );

  return result.rowCount ?? 0;
}
