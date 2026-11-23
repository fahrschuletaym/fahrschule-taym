
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

        <div className="taym-whatsapp-buttons">
          {[
            { country: "Deutschland", flag: "de", number: "4917639064254" },
            { country: "\u00d6sterreich", flag: "at", number: "4367858250295" },
          ].map(({ country, flag, number }) => (
            <a key={number} href={`https://wa.me/${number}`} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp ${country}`} title={`WhatsApp ${country}`} className="taym-whatsapp-button">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
            <path d="M20.52 3.48A11.9 11.9 0 0 0 12.03 0C5.42 0 .04 5.38.04 11.99c0 2.11.55 4.17 1.6 5.99L0 24l6.17-1.62a11.98 11.98 0 0 0 5.85 1.49h.01c6.6 0 11.98-5.38 11.99-11.99a11.9 11.9 0 0 0-3.5-8.4ZM12.03 21.85h-.01a9.96 9.96 0 0 1-5.08-1.39l-.36-.21-3.66.96.98-3.57-.24-.37a9.94 9.94 0 0 1-1.53-5.28c0-5.47 4.44-9.91 9.91-9.91a9.84 9.84 0 0 1 7.01 2.91 9.84 9.84 0 0 1 2.9 7c0 5.47-4.45 9.92-9.92 9.92Zm5.44-7.42c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z" />
          </svg>
              <span className={`taym-whatsapp-flag taym-whatsapp-flag-${flag}`} aria-hidden="true" />
            </a>
          ))}
        </div>

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
