
import type { Metadata } from "next";

import ImpressumContent from "@/components/legal/ImpressumContent";

export const metadata: Metadata = {
  title: "Impressum | Fahrschule TAYM",

  description:
    "Impressum und Anbieterkennzeichnung der Fahrschule TAYM in Berlin-Reinickendorf. Angaben zum Anbieter, Kontakt, Aufsichtsbehörde, Haftung und Urheberrecht.",

  applicationName: "Fahrschule TAYM",

  alternates: {
    canonical:
      "https://fahrschule-taym.de/impressum",
  },

  openGraph: {
    images: [{ url: "/images/imageb.jpg", alt: "Fahrschule TAYM" }],
    title: "Impressum | Fahrschule TAYM",
    description:
      "Rechtliche Informationen und Kontaktdaten der Fahrschule TAYM.",
    type: "website",
    locale: "de_DE",
    siteName: "Fahrschule TAYM",
    url:
      "https://fahrschule-taym.de/impressum",
  },

  robots: {
    index: true,
    follow: true,
  },
};

export default function ImpressumPage() {
  return <ImpressumContent />;
}
