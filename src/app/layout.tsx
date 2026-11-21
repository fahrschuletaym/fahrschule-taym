
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import Script from "next/script";

import "./globals.css";

import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import Footer from "@/components/layout/Footer";

/* =========================================================
   FAHRSCHULE TAYM
   ROOT LAYOUT

   Structure principale de la plateforme

   COMPATIBILITÉ :
   - Next.js App Router
   - Android PWA
   - iPhone / iPad Web App
   - Windows / macOS PWA
   - Desktop et mobile

   SÉCURITÉ :
   - Ne modifie pas les sessions
   - Ne modifie pas l'authentification
   - Ne modifie pas les API
   - Ne modifie pas PostgreSQL
   - Ne met pas les données privées en cache
   ========================================================= */

/* =========================================================
   1. INFORMATIONS OFFICIELLES
   ========================================================= */

const SITE_NAME = "Fahrschule TAYM";

const SITE_URL = "https://fahrschule-taym.de";

const SITE_DESCRIPTION =
  "Fahrschule TAYM – Ihre Plattform für Führerscheinausbildung, Theorie, Praxis und die Begleitung rund um den Führerschein in Deutschland, Spanien, Italien, Österreich und Belgien.";

/* =========================================================
   2. CONFIGURATION PWA

   Fichiers existants :

   src/app/manifest.ts
   public/sw.js

   Icônes :

   public/icon/icon.png
   public/icon/icon-192.png
   public/icon/icon-512.png
   public/icon/icon-maskable.png
   public/icon/apple-touch-icon.png
   public/icon/favicon-32.png
   ========================================================= */

const PWA_MANIFEST = "/manifest.webmanifest";

const PWA_APPLE_ICON =
  "/icon/apple-touch-icon.png";

/* =========================================================
   3. MÉTADONNÉES SEO + PWA

   Allemand : langue principale

   Langues secondaires :
   - Arabe
   - Turc
   - Espagnol

   Les traductions restent gérées
   par le système existant.
   ========================================================= */

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },

  description: SITE_DESCRIPTION,

  applicationName: SITE_NAME,

  keywords: [
    "Fahrschule TAYM",
    "Fahrschule",
    "Führerschein",
    "Führerschein online",
    "Führerscheinausbildung",
    "Theorieprüfung",
    "Praktische Ausbildung",
    "Führerscheinklassen",
    "Führerscheinumschreibung",
    "Online Fahrschule",
    "Deutschland",
    "Spanien",
    "Italien",
    "Österreich",
    "Belgien",
  ],

  authors: [
    {
      name: SITE_NAME,
    },
  ],

  creator: SITE_NAME,

  publisher: SITE_NAME,

  /* =====================================================
     INDEXATION
     ===================================================== */

  robots: {
    index: true,
    follow: true,
  },

  /* =====================================================
     MANIFEST PWA

     Le navigateur découvre le
     manifeste de l'application.
     ===================================================== */

  manifest: PWA_MANIFEST,

  /* =====================================================
     ICÔNES ANDROID / IPHONE / PC

     Utilisation des icônes officielles
     placées dans public/icon/
     ===================================================== */

  icons: {
    icon: [
      {
        url: "/icon/icon.png",
        type: "image/png",
      },
      {
        url: "/icon/favicon-32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/icon/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icon/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],

    shortcut: [
      {
        url: "/icon/favicon-32.png",
        type: "image/png",
      },
    ],

    apple: [
      {
        url: PWA_APPLE_ICON,
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },

  /* =====================================================
     IPHONE / IPAD

     Permet à l'application ajoutée
     à l'écran d'accueil de s'ouvrir
     en mode autonome lorsque pris
     en charge par iOS.
     ===================================================== */

  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "default",
  },

  /* =====================================================
     OPEN GRAPH

     Configuration conservée.
     ===================================================== */

  openGraph: {
    type: "website",

    siteName: SITE_NAME,

    title: SITE_NAME,

    description: SITE_DESCRIPTION,

    locale: "de_DE",

    images: [
      {
        url: "/images/imageb.jpg",
        alt: SITE_NAME,
      },
    ],
  },

  /* =====================================================
     TWITTER / X

     Configuration conservée.
     ===================================================== */

  twitter: {
    card: "summary_large_image",

    title: SITE_NAME,

    description: SITE_DESCRIPTION,

    images: ["/images/imageb.jpg"],
  },

  category: "education",
};

/* =========================================================
   4. VIEWPORT

   Conservation de la configuration
   existante pour éviter les
   changements visuels inattendus.
   ========================================================= */

export const viewport: Viewport = {
  width: "device-width",

  initialScale: 1,

  themeColor: [
    {
      media: "(max-width: 768px)",
      color: "#111820",
    },
    {
      media: "(min-width: 769px)",
      color: "#89c900",
    },
  ],
};

/* =========================================================
   5. SERVICE WORKER

   Enregistrement de :

   /public/sw.js

   URL publique :

   /sw.js

   Script exécuté uniquement dans
   le navigateur après hydratation.

   Aucun composant client
   supplémentaire n'est nécessaire.

   Le Service Worker conserve
   la stratégie réseau définie
   dans public/sw.js.

   IMPORTANT :
   Le navigateur décide si
   l'installation PWA peut être
   proposée automatiquement.
   ========================================================= */

const REGISTER_PWA_SCRIPT = `
(function () {
  "use strict";

  if (!("serviceWorker" in navigator)) {
    return;
  }

  if (!window.isSecureContext) {
    return;
  }

  var registerServiceWorker = function () {
    navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
        updateViaCache: "none"
      })
      .then(function (registration) {
        if (!registration) {
          return;
        }

        if (document.visibilityState === "visible") {
          registration.update().catch(function () {
            // Keep the website usable.
          });
        }
      })
      .catch(function () {
        // A PWA registration failure must not
        // block normal website navigation.
      });
  };

  if (document.readyState === "complete") {
    registerServiceWorker();
  } else {
    window.addEventListener(
      "load",
      registerServiceWorker,
      { once: true }
    );
  }
})();
`;

/* =========================================================
   6. PROPRIÉTÉS DU ROOT LAYOUT
   ========================================================= */

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

/* =========================================================
   7. ROOT LAYOUT PRINCIPAL

   Tous les composants existants
   sont conservés.

   Aucun changement dans :
   - Header
   - Footer
   - MobileNav
   - Main content
   - CSS global
   ========================================================= */

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html
      lang="de"
      dir="ltr"
      suppressHydrationWarning
    >
      <body
        className="
          min-h-screen
          flex
          flex-col
          antialiased
        "
      >
        {/* =====================================
            EN-TÊTE PRINCIPAL

            Desktop et mobile
            ===================================== */}

        <Header />

        {/* =====================================
            CONTENU PRINCIPAL

            Toutes les pages existantes
            restent fonctionnelles.
            ===================================== */}

        <main
          id="main-content"
          className="
            relative
            flex-1
            min-w-0
            w-full
          "
        >
          {children}
        </main>

        {/* =====================================
            PIED DE PAGE

            Desktop et mobile
            ===================================== */}

        <Footer />

        {/* =====================================
            NAVIGATION INFÉRIEURE MOBILE
            ===================================== */}

        <MobileNav />

        {/* =====================================
            ENREGISTREMENT PWA

            Android / iPhone / ordinateur

            Le script ne s'exécute
            que dans le navigateur.

            Aucun accès à PostgreSQL.
            Aucun accès aux cookies.
            ===================================== */}

        <Script
          id="taym-pwa-service-worker"
          strategy="afterInteractive"
        >
          {REGISTER_PWA_SCRIPT}
        </Script>
      </body>
    </html>
  );
}
