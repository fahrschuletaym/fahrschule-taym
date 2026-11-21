
import { connection, NextRequest, NextResponse } from "next/server";

import {
  requireCandidateSession,
  SessionAuthError,
} from "@/lib/auth/session";

import {
  getCandidateDashboard,
  DashboardAccessError,
} from "@/lib/dashboard";

/* ============================================================
   FAHRSCHULE TAYM
   API — DASHBOARD CANDIDAT

   Fichier :
   src/app/api/dashboard/route.ts

   Endpoint :
   GET /api/dashboard

   Fonctionnalités :
   - Vérification de la session utilisateur
   - Accès réservé aux candidats authentifiés
   - Vérification du compte actif
   - Lecture des données réelles PostgreSQL
   - Demandes de permis de conduire
   - Documents PDF et images
   - Formations théoriques
   - Progression réelle
   - Séances de conduite
   - Rendez-vous
   - Paiements
   - Notifications
   - Messages
   - Historique public du dossier

   Sécurité :
   - Cookie HttpOnly
   - Session PostgreSQL vérifiée
   - Aucun userId accepté depuis l'URL
   - Aucun accès aux autres candidats
   - Aucun détail SQL exposé
   - Aucun cache de données personnelles

   Compatible :
   - Ordinateur
   - Tablette
   - Smartphone

   Aucun menu, layout ou composant UI.
   ============================================================ */

/* ============================================================
   1. CONFIGURATION NEXT.JS
   ============================================================ */

// Les dépendances PostgreSQL utilisent Node.js.


// La route doit être exécutée pour chaque requête.


// Ne jamais conserver les données utilisateur en cache.


/* ============================================================
   2. TYPES DE RÉPONSE
   ============================================================ */

type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "ACCOUNT_INACTIVE"
  | "DATABASE_UNAVAILABLE"
  | "INTERNAL_ERROR";

type ApiErrorResponse = {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
  };
  timestamp: string;
};

/* ============================================================
   3. EN-TÊTES DE SÉCURITÉ
   ============================================================ */

const RESPONSE_HEADERS: Record<string, string> = {
  "Cache-Control":
    "private, no-store, no-cache, max-age=0, must-revalidate",

  Pragma: "no-cache",

  Expires: "0",

  Vary: "Cookie",

  "X-Content-Type-Options": "nosniff",
};

/* ============================================================
   4. CRÉATION DES RÉPONSES D'ERREUR

   Les messages sont volontairement
   génériques et ne révèlent aucune
   donnée sensible.
   ============================================================ */

function errorResponse(
  status: number,
  code: ApiErrorCode,
  message: string
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
      },
      timestamp: new Date().toISOString(),
    },
    {
      status,
      headers: RESPONSE_HEADERS,
    }
  );
}

/* ============================================================
   5. GESTION DES ERREURS

   - Session absente : 401
   - Session invalide : 401
   - Accès interdit : 403
   - Compte désactivé : 403
   - Base indisponible : 503
   - Erreur interne : 500

   Les erreurs techniques ne sont jamais
   envoyées directement au navigateur.
   ============================================================ */

function handleDashboardError(
  error: unknown
): NextResponse<ApiErrorResponse> {
  /* --------------------------------------------------------
     Erreurs de session
     -------------------------------------------------------- */

  if (error instanceof SessionAuthError) {
    if (error.status === 403) {
      return errorResponse(
        403,
        "FORBIDDEN",
        "Access to this resource is forbidden."
      );
    }

    return errorResponse(
      401,
      "UNAUTHORIZED",
      "Authentication is required."
    );
  }

  /* --------------------------------------------------------
     Erreurs du service Dashboard
     -------------------------------------------------------- */

  if (error instanceof DashboardAccessError) {
    switch (error.code) {
      case "INVALID_USER":
      case "UNAUTHORIZED":
        return errorResponse(
          401,
          "UNAUTHORIZED",
          "Authentication is required."
        );

      case "ACCOUNT_INACTIVE":
        return errorResponse(
          403,
          "ACCOUNT_INACTIVE",
          "This account is not active."
        );

      case "DATABASE_NOT_CONFIGURED":
        console.error(
          "[TAYM][API][DASHBOARD] Database configuration missing."
        );

        return errorResponse(
          503,
          "DATABASE_UNAVAILABLE",
          "The service is temporarily unavailable."
        );
    }
  }

  /* --------------------------------------------------------
     Erreurs de connexion PostgreSQL
     -------------------------------------------------------- */

  if (
    error !== null &&
    typeof error === "object" &&
    "code" in error
  ) {
    const databaseError = error as {
      code?: unknown;
    };

    const connectionErrorCodes = new Set([
      "ECONNREFUSED",
      "ECONNRESET",
      "ETIMEDOUT",
      "ENOTFOUND",
      "EAI_AGAIN",
      "08000",
      "08001",
      "08003",
      "08004",
      "08006",
      "08007",
      "57P01",
      "57P02",
      "57P03",
      "53300",
    ]);

    if (
      typeof databaseError.code === "string" &&
      connectionErrorCodes.has(databaseError.code)
    ) {
      console.error(
        "[TAYM][API][DASHBOARD] PostgreSQL connection unavailable."
      );

      return errorResponse(
        503,
        "DATABASE_UNAVAILABLE",
        "The service is temporarily unavailable."
      );
    }
  }

  /* --------------------------------------------------------
     Erreur inattendue
     -------------------------------------------------------- */

  console.error(
    "[TAYM][API][DASHBOARD] Unexpected server error:",
    error instanceof Error
      ? error.name
      : "Unknown error"
  );

  return errorResponse(
    500,
    "INTERNAL_ERROR",
    "An unexpected error occurred."
  );
}

/* ============================================================
   6. GET /api/dashboard

   L'API n'accepte aucun identifiant
   de candidat fourni par le navigateur.

   L'identifiant de l'utilisateur provient
   uniquement de la session authentifiée.

   Les requêtes PostgreSQL du Dashboard
   sont exécutées par src/lib/dashboard.ts.
   ============================================================ */

export async function GET(
  request: NextRequest
): Promise<NextResponse> {
  await connection();
  try {
    /* ------------------------------------------------------
       ÉTAPE 1 — AUTHENTIFICATION

       Vérifie :
       - Cookie taym_session
       - Jeton de session
       - Session présente dans PostgreSQL
       - Session non expirée
       - Session non révoquée
       - Compte actif
       - Rôle CANDIDATE
       - Email vérifié
       - Téléphone vérifié
       ------------------------------------------------------ */

    const session =
      await requireCandidateSession(request);

    /* ------------------------------------------------------
       ÉTAPE 2 — RÉCUPÉRATION DES DONNÉES

       L'identifiant vient de la session
       validée, jamais des paramètres URL.

       Les données appartiennent donc
       au candidat connecté.
       ------------------------------------------------------ */

    const dashboard =
      await getCandidateDashboard(session.userId);

    /* ------------------------------------------------------
       ÉTAPE 3 — RÉPONSE JSON

       Données réelles :
       - Profil candidat
       - Résumé
       - Demandes
       - Documents
       - Cours
       - Progression
       - Séances
       - Rendez-vous
       - Paiements
       - Notifications
       - Messages
       - Historique du dossier

       Pas de valeurs inventées.
       Pas de mise en cache.
       ------------------------------------------------------ */

    return NextResponse.json(
      {
        success: true,
        data: dashboard,
      },
      {
        status: 200,
        headers: RESPONSE_HEADERS,
      }
    );
  } catch (error: unknown) {
    return handleDashboardError(error);
  }
}
