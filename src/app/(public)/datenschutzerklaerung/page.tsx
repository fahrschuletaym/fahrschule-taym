
import type { Metadata } from "next";
import PrivacyPolicyContent from "@/components/legal/PrivacyPolicyContent";

/*
 * Fahrschule TAYM
 * Public privacy policy
 *
 * Route: /datenschutzerklaerung
 * Languages: de, ar, tr, es
 * Layout: existing (public)/layout.tsx
 */

export const metadata: Metadata = {
  title: "Datenschutzerklärung | Fahrschule TAYM",
  description:
    "Datenschutzerklärung der Fahrschule TAYM. Informationen zur Verarbeitung personenbezogener Daten, zu Führerscheinanträgen, Dokumenten, Cookies und Datenschutzrechten.",
  alternates: {
    canonical:
      "https://fahrschule-taym.de/datenschutzerklaerung",
  },
  openGraph: {
    images: [{ url: "/images/imageb.jpg", alt: "Fahrschule TAYM" }],
    type: "website",
    siteName: "Fahrschule TAYM",
    locale: "de_DE",
    title: "Datenschutzerklärung | Fahrschule TAYM",
    description:
      "Informationen zum Datenschutz und zur Verarbeitung personenbezogener Daten bei Fahrschule TAYM.",
    url: "https://fahrschule-taym.de/datenschutzerklaerung",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function DatenschutzPage() {
  return <PrivacyPolicyContent />;
}
