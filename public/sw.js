
/**
 * ============================================================
 * FAHRSCHULE TAYM
 * PROGRESSIVE WEB APP — SERVICE WORKER
 *
 * Fichier : public/sw.js
 *
 * Compatible :
 * - Android
 * - iPhone / iPad
 * - Windows
 * - macOS
 *
 * Objectifs :
 * - Activer le Service Worker
 * - Permettre son intégration à la PWA
 * - Gérer les mises à jour
 * - Détecter l'absence de connexion
 * - Afficher un message hors ligne
 * - Protéger les données personnelles
 *
 * SÉCURITÉ :
 * - Aucun cache de session
 * - Aucun cache des API
 * - Aucun cache des dossiers candidats
 * - Aucun cache des documents privés
 * - Aucun cache administrateur
 * - Aucun stockage de token ou de cookie
 *
 * ============================================================
 */

"use strict";

/* ============================================================
   1. CONFIGURATION
   ============================================================ */

const SW_VERSION = "1.0.0";

const SW_NAME = "fahrschule-taym";

const SW_ID = `${SW_NAME}-${SW_VERSION}`;

/**
 * Chemins protégés.
 *
 * Nous n'interceptons pas ces requêtes.
 * Le navigateur communique directement
 * avec le serveur Next.js.
 */

const PROTECTED_PREFIXES = [
  "/api",
  "/admin",
  "/konto",
  "/account",
  "/dashboard",
];

/* ============================================================
   2. INSTALLATION
   ============================================================ */

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      /**
       * Activer rapidement la nouvelle
       * version du Service Worker.
       *
       * Aucun téléchargement préalable
       * ni mise en cache obligatoire.
       */

      await self.skipWaiting();
    })()
  );
});

/* ============================================================
   3. ACTIVATION
   ============================================================ */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      /**
       * Prendre le contrôle des pages
       * déjà ouvertes après activation.
       */

      await self.clients.claim();
    })()
  );
});

/* ============================================================
   4. VÉRIFICATION DES CHEMINS PROTÉGÉS
   ============================================================ */

function isProtectedPath(pathname) {
  return PROTECTED_PREFIXES.some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(`${prefix}/`)
  );
}

/* ============================================================
   5. PAGE HORS CONNEXION

   Cette page est générée directement
   par le Service Worker.

   Aucun fichier offline.html
   supplémentaire n'est nécessaire.

   La page est volontairement simple.

   Elle ne prétend pas que les dossiers
   ou les formations sont disponibles
   sans Internet.
   ============================================================ */

function createOfflineResponse() {
  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >

  <meta name="theme-color" content="#172B1B">

  <title>Offline — Fahrschule TAYM</title>

  <style>
    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      min-height: 100%;
    }

    body {
      min-height: 100vh;
      min-height: 100dvh;

      display: flex;
      align-items: center;
      justify-content: center;

      padding: 24px;

      background: #f6f8f4;

      color: #172b1b;

      font-family:
        Arial,
        Helvetica,
        sans-serif;
    }

    .container {
      width: 100%;
      max-width: 420px;

      text-align: center;

      padding: 36px 24px;

      border: 1px solid #e4eadf;
      border-radius: 22px;

      background: #ffffff;

      box-shadow:
        0 12px 38px rgba(0, 0, 0, 0.05);
    }

    .logo {
      display: block;

      width: 96px;
      height: 96px;

      margin: 0 auto 22px;

      object-fit: contain;
    }

    h1 {
      margin: 0 0 14px;

      font-size: 25px;
      font-weight: 800;

      letter-spacing: -0.5px;
    }

    p {
      margin: 0 0 26px;

      color: #59685c;

      font-size: 15px;
      line-height: 1.7;
    }

    button {
      width: 100%;

      min-height: 48px;

      padding: 13px 20px;

      border: 0;
      border-radius: 12px;

      background: #a6d91c;

      color: #172b1b;

      font-size: 15px;
      font-weight: 700;

      cursor: pointer;
    }

    button:hover {
      background: #94c719;
    }

    button:focus-visible {
      outline: 3px solid #172b1b;
      outline-offset: 3px;
    }

    .brand {
      margin-top: 24px;

      font-size: 12px;
      font-weight: 700;

      letter-spacing: 0.5px;

      color: #70806d;
    }
  </style>
</head>

<body>
  <main class="container">

    <img
      class="logo"
      src="/icon/icon-192.png"
      alt="Fahrschule TAYM"
    >

    <h1>Keine Internetverbindung</h1>

    <p>
      Bitte überprüfen Sie Ihre
      Internetverbindung und versuchen
      Sie es erneut.
    </p>

    <button
      type="button"
      onclick="window.location.reload()"
    >
      Erneut versuchen
    </button>

    <div class="brand">
      FAHRSCHULE TAYM
    </div>

  </main>
</body>
</html>`;

  return new Response(html, {
    status: 503,

    statusText: "Service Unavailable",

    headers: {
      "Content-Type":
        "text/html; charset=utf-8",

      "Cache-Control":
        "no-store",

      "X-Content-Type-Options":
        "nosniff",

      "Content-Security-Policy":
        "default-src 'none'; " +
        "img-src 'self'; " +
        "style-src 'unsafe-inline'; " +
        "script-src 'unsafe-inline'; " +
        "base-uri 'none'; " +
        "form-action 'none'",
    },
  });
}

/* ============================================================
   6. NETWORK-ONLY STRATEGY

   Les pages publiques sont chargées
   directement depuis le serveur.

   Aucun contenu HTML personnel
   n'est placé en cache.

   En cas d'échec réseau :
   - Afficher la page hors ligne
   - Ne jamais afficher de fausses
     données de dossier
   ============================================================ */

async function handleNavigation(request) {
  try {
    /**
     * Toujours récupérer la version
     * actuelle depuis le réseau.
     */

    return await fetch(request);
  } catch {
    /**
     * Erreur réseau réelle :
     * afficher la page hors ligne.
     */

    return createOfflineResponse();
  }
}

/* ============================================================
   7. INTERCEPTION DES NAVIGATIONS

   Nous interceptons uniquement :
   - GET
   - Navigation HTML
   - Même origine
   - Pages publiques non protégées

   Nous excluons :
   - Toutes les API
   - Les pages administrateur
   - Les espaces personnels
   - Les autres domaines
   - Les requêtes POST / PUT / DELETE

   Les fichiers CSS / JS / images
   sont téléchargés normalement.
   ============================================================ */

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  if (request.mode !== "navigate") {
    return;
  }

  let url;

  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (isProtectedPath(url.pathname)) {
    return;
  }

  event.respondWith(
    handleNavigation(request)
  );
});

/* ============================================================
   END
   FAHRSCHULE TAYM PWA
   ============================================================ */
