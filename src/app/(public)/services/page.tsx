
import type { Metadata } from "next";

import ServicesContent from "@/components/services/ServicesContent";

/* ============================================================
   FAHRSCHULE TAYM

   File:
   src/app/(public)/services/page.tsx

   Public URL:
   https://fahrschule-taym.de/services

   Countries:
   DE | AT | BE | IT | ES

   Languages:
   de | ar | tr | es

   Responsive:
   Mobile | Tablet | Desktop

   Existing public layout provides:
   - Header
   - Navigation
   - Mobile menu
   - Footer

   This file does not duplicate any of them.
   ============================================================ */

/* ============================================================
   1. SEO METADATA

   German is the default language.

   The existing language switcher controls
   the displayed interface through
   ServicesContent.tsx.

   Do not declare hreflang alternates until
   separate, indexable language URLs exist.

   The service page has a single canonical URL.
   ============================================================ */

const SITE_URL = "https://fahrschule-taym.de";

const SERVICES_PATH = "/services";

export const metadata: Metadata = {
  title: "Unsere Services | Fahrschule TAYM",

  description:
    "Entdecken Sie die Services von Fahrschule TAYM: theoretische und praktische Fahrausbildung, Führerscheinanträge, Unterstützung bei Unterlagen, Prüfungsvorbereitung und Informationen zur Berufskraftfahrerqualifizierung in Deutschland, Österreich, Belgien, Italien und Spanien.",

  applicationName: "Fahrschule TAYM",

  keywords: [
    "Fahrschule TAYM",
    "Unsere Services",
    "Fahrschule",
    "Führerschein",
    "Führerscheinantrag",
    "Führerscheinklassen",
    "Theorieunterricht",
    "Praktische Fahrausbildung",
    "Führerscheinprüfung",
    "Berufskraftfahrer",
    "Lkw Führerschein",
    "Bus Führerschein",
    "Fahrschule Deutschland",
    "Fahrschule Österreich",
    "Führerschein Belgien",
    "Führerschein Italien",
    "Führerschein Spanien",
  ],

  alternates: {
    canonical: `${SITE_URL}${SERVICES_PATH}`,
  },

  openGraph: {
    type: "website",
    images: [{ url: "/images/imageb.jpg", alt: "Fahrschule TAYM" }],

    url: `${SITE_URL}${SERVICES_PATH}`,

    siteName: "Fahrschule TAYM",

    locale: "de_DE",

    title:
      "Unsere Services | Fahrschule TAYM",

    description:
      "Mehr als eine Fahrschule: Ausbildung, Führerscheinanträge, Dokumentenhilfe, Prüfungsvorbereitung und persönliche Betreuung.",

  },

  twitter: {
    card: "summary_large_image",
    images: ["/images/imageb.jpg"],

    title:
      "Unsere Services | Fahrschule TAYM",

    description:
      "Entdecken Sie unsere Leistungen rund um Fahrausbildung, Führerscheinanträge und persönliche Betreuung.",
  },

  robots: {
    index: true,
    follow: true,

    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },

  category: "education",
};

/* ============================================================
   2. PUBLIC SERVICES PAGE

   All dynamic service information comes
   from the central configuration.

   ServicesContent manages:
   - Country selection
   - Existing language synchronization
   - Arabic RTL layout
   - Service cards and images
   - Country-specific availability
   - Approved partner display
   - Application steps
   - Contact details
   - Links to existing routes

   No data is duplicated in this page.
   ============================================================ */

export default function ServicesPage() {
  return <ServicesContent />;
}

/* ============================================================
   END — FAHRSCHULE TAYM SERVICES PAGE
   ============================================================ */
