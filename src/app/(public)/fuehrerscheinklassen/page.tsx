
import type { Metadata } from "next";

import LicenseCategories from "@/components/driving-licenses/LicenseCategories";

/* ============================================================
   FAHRSCHULE TAYM

   File:
   src/app/(public)/fuehrerscheinklassen/page.tsx

   Public route:
   /fuehrerscheinklassen

   Countries:
   DE | AT | BE | IT | ES

   Languages:
   de | ar | tr | es

   Responsive:
   Desktop | Tablet | Mobile

   Existing public layout provides:
   - Header
   - MobileNav
   - Footer

   No duplicate layout or navigation.
   ============================================================ */

/* ============================================================
   1. SEO METADATA

   German is the default language.

   The content itself changes dynamically
   through the existing language switcher.
   ============================================================ */

export const metadata: Metadata = {
  title:
    "Führerscheinklassen & Preise | Fahrschule TAYM",

  description:
    "Entdecken Sie die Führerscheinklassen AM, A1, A2, A, B, BE, C1, C1E, C, CE, D1, D1E, D und DE. Vergleichen Sie Ausbildungspreise und Anmeldegebühren für Deutschland, Österreich, Belgien, Italien und Spanien und starten Sie Ihren Führerscheinantrag online.",

  applicationName:
    "Fahrschule TAYM",

  keywords: [
    "Fahrschule TAYM",
    "Führerscheinklassen",
    "Führerschein Preise",
    "Führerscheinantrag",
    "Führerschein Deutschland",
    "Führerschein Österreich",
    "Führerschein Belgien",
    "Führerschein Italien",
    "Führerschein Spanien",
    "Klasse B",
    "Klasse A",
    "Klasse BE",
    "Klasse C",
    "Klasse D",
    "Driving license categories",
  ],

  robots: {
    index: true,
    follow: true,
  },

  openGraph: {
    images: [{ url: "/images/imageb.jpg", alt: "Fahrschule TAYM" }],
    type: "website",

    locale: "de_DE",

    siteName: "Fahrschule TAYM",

    title:
      "Führerscheinklassen & Preise | Fahrschule TAYM",

    description:
      "Alle verfügbaren Führerscheinklassen entdecken, Ausbildungspreise vergleichen und den Antrag online starten.",

    url:
      "https://fahrschule-taym.de/fuehrerscheinklassen",
  },

  alternates: {
    canonical:
      "https://fahrschule-taym.de/fuehrerscheinklassen",
  },

  category: "education",
};

/* ============================================================
   2. PUBLIC PAGE

   Reuses the complete component:
   LicenseCategories.tsx

   The component manages:
   - Country selection
   - Language synchronization
   - Localized category names
   - Localized descriptions
   - Category images
   - Training prices
   - Registration fees
   - Total calculations
   - Application links
   - Mobile and desktop responsiveness
   ============================================================ */

export default function FuehrerscheinklassenPage() {
  return <LicenseCategories />;
}
