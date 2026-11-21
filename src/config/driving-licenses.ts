
import type {
  ApplicationCountry,
  ApplicationLocale,
  LicenseCategory,
  TrustedLicenseOffering,
  AdmissionRequirements,
  ApplicationDocumentType,
} from "@/lib/applications/validation";

/* ============================================================
   FAHRSCHULE TAYM

   File:
   src/config/driving-licenses.ts

   CENTRAL DRIVING LICENSE CONFIGURATION

   Website:
   fahrschule-taym.de

   Supported countries:
   DE | AT | BE | IT | ES

   Supported languages:
   DE | AR | TR | ES

   Currency:
   EUR

   Responsibilities:
   - Country configuration
   - Driving license categories
   - Localized names
   - Localized descriptions
   - Existing local vehicle images
   - Training prices
   - Registration and processing fees
   - Pricing versions
   - Admission requirements
   - Existing license requirements
   - Country-specific eligibility review

   All monetary amounts are stored in cents.

   Training prices are proposed commercial
   prices, not official government tariffs.

   No UI.
   No new navigation.
   No database writes.
   ============================================================ */

/* ============================================================
   1. GENERAL CONFIGURATION
   ============================================================ */

export const DRIVING_LICENSE_CURRENCY =
  "EUR" as const;

export const DRIVING_LICENSE_DEFAULT_LOCALE =
  "de" as const;

export const DRIVING_LICENSE_PRICING_VERSION =
  "2026-11-v1";

export const DRIVING_LICENSE_COUNTRIES = [
  "DE",
  "AT",
  "BE",
  "IT",
  "ES",
] as const;

export const DRIVING_LICENSE_LOCALES = [
  "de",
  "ar",
  "tr",
  "es",
] as const;

/* ============================================================
   2. CATEGORY DISPLAY ORDER

   Most common categories first.

   This order is used by the application
   page on desktop and mobile.
   ============================================================ */

export const DRIVING_LICENSE_CATEGORY_ORDER = [
  "B",
  "A",
  "BE",
  "C",
  "D",
  "AM",
  "A1",
  "A2",
  "C1",
  "C1E",
  "CE",
  "D1",
  "D1E",
  "DE",
] as const satisfies readonly LicenseCategory[];

/* ============================================================
   3. TYPES
   ============================================================ */

export type LocalizedLicenseText = Record<
  ApplicationLocale,
  string
>;

export type CountryPriceConfiguration = {
  enabled: boolean;

  pricingApproved: boolean;

  registrationFeeCents: number | null;

  pricingVersion: string;

  trainingPricesCents: Record<
    LicenseCategory,
    number
  >;

  disabledCategories?:
    readonly LicenseCategory[];
};

export type LicenseCategoryDefinition = {
  category: LicenseCategory;

  name: LocalizedLicenseText;

  description: LocalizedLicenseText;

  imagePath: string | null;

  standardMinimumAge: number;
};

export type PublicLicenseCategoryConfiguration = {
  category: LicenseCategory;

  enabled: boolean;

  pricingApproved: boolean;

  name: LocalizedLicenseText;

  description: LocalizedLicenseText;

  imagePath: string | null;

  minimumAge: number | null;

  currency: "EUR";

  trainingPriceCents: number;

  registrationFeeCents: number | null;

  pricingVersion: string;
};

export type CountryLicenseConfiguration = {
  countryCode: ApplicationCountry;

  currency: "EUR";

  registrationFeeCents: number | null;

  categories:
    PublicLicenseCategoryConfiguration[];
};

/* ============================================================
   4. EXISTING VEHICLE IMAGES

   Configure the exact image paths already
   present in the public directory.

   Do not create duplicate vehicle images.
   Do not use external image providers.

   Reuse the closest existing vehicle image for each category.
   The truck and tractor filenames are intentionally mapped
   according to their actual contents.
   ============================================================ */

export const LICENSE_CATEGORY_IMAGES: Record<
  LicenseCategory,
  string | null
> = {
  AM: "/images/classe-moto.jpg",

  A1: "/images/classe-moto.jpg",

  A2: "/images/classe-moto.jpg",

  A: "/images/classe-moto.jpg",

  B: "/images/classe-b.jpg",

  BE: "/images/classe-be.jpg",

  C1: "/images/classe-t.jpg",

  C1E: "/images/classe-t.jpg",

  C: "/images/classe-t.jpg",

  CE: "/images/classe-t.jpg",

  D1: "/images/classe-d.jpg",

  D1E: "/images/classe-d.jpg",

  D: "/images/classe-d.jpg",

  DE: "/images/classe-d.jpg",
};

/* ============================================================
   5. LOCALIZED COUNTRY NAMES
   ============================================================ */

export const LICENSE_COUNTRY_NAMES: Record<
  ApplicationCountry,
  LocalizedLicenseText
> = {
  DE: {
    de: "Deutschland",
    ar: "ألمانيا",
    tr: "Almanya",
    es: "Alemania",
  },

  AT: {
    de: "Österreich",
    ar: "النمسا",
    tr: "Avusturya",
    es: "Austria",
  },

  BE: {
    de: "Belgien",
    ar: "بلجيكا",
    tr: "Belçika",
    es: "Bélgica",
  },

  IT: {
    de: "Italien",
    ar: "إيطاليا",
    tr: "İtalya",
    es: "Italia",
  },

  ES: {
    de: "Spanien",
    ar: "إسبانيا",
    tr: "İspanya",
    es: "España",
  },
};

/* ============================================================
   6. COUNTRY FLAGS
   ============================================================ */

export const LICENSE_COUNTRY_FLAGS: Record<
  ApplicationCountry,
  string
> = {
  DE: "🇩🇪",

  AT: "🇦🇹",

  BE: "🇧🇪",

  IT: "🇮🇹",

  ES: "🇪🇸",
};

/* ============================================================
   7. CATEGORY DEFINITIONS

   Common European license categories.

   Descriptions are intentionally concise
   for responsive category selection cards.

   Detailed vehicle restrictions and
   national exceptions require review.
   ============================================================ */

const CATEGORY_DEFINITIONS: Record<
  LicenseCategory,
  LicenseCategoryDefinition
> = {
  /* --------------------------------------------------------
     AM — MOPEDS
     -------------------------------------------------------- */

  AM: {
    category: "AM",

    name: {
      de: "Klasse AM",
      ar: "الفئة AM",
      tr: "AM Sınıfı",
      es: "Permiso AM",
    },

    description: {
      de: "Kleinkrafträder und Mopeds bis 45 km/h",

      ar: "الدراجات الآلية الخفيفة حتى 45 كم/ساعة",

      tr: "45 km/saate kadar mopedler",

      es: "Ciclomotores de hasta 45 km/h",
    },

    imagePath:
      LICENSE_CATEGORY_IMAGES.AM,

    standardMinimumAge: 16,
  },

  /* --------------------------------------------------------
     A1 — LIGHT MOTORCYCLES
     -------------------------------------------------------- */

  A1: {
    category: "A1",

    name: {
      de: "Klasse A1",
      ar: "الفئة A1",
      tr: "A1 Sınıfı",
      es: "Permiso A1",
    },

    description: {
      de: "Leichtkrafträder bis 125 cm³ und 11 kW",

      ar: "دراجات نارية حتى 125 سم³ و11 كيلوواط",

      tr: "125 cm³ ve 11 kW'a kadar motosikletler",

      es: "Motocicletas de hasta 125 cm³ y 11 kW",
    },

    imagePath:
      LICENSE_CATEGORY_IMAGES.A1,

    standardMinimumAge: 16,
  },

  /* --------------------------------------------------------
     A2 — MOTORCYCLES UP TO 35 KW
     -------------------------------------------------------- */

  A2: {
    category: "A2",

    name: {
      de: "Klasse A2",
      ar: "الفئة A2",
      tr: "A2 Sınıfı",
      es: "Permiso A2",
    },

    description: {
      de: "Motorräder bis 35 kW",

      ar: "دراجات نارية حتى 35 كيلوواط",

      tr: "35 kW'a kadar motosikletler",

      es: "Motocicletas de hasta 35 kW",
    },

    imagePath:
      LICENSE_CATEGORY_IMAGES.A2,

    standardMinimumAge: 18,
  },

  /* --------------------------------------------------------
     A — UNRESTRICTED MOTORCYCLES
     -------------------------------------------------------- */

  A: {
    category: "A",

    name: {
      de: "Klasse A",
      ar: "الفئة A",
      tr: "A Sınıfı",
      es: "Permiso A",
    },

    description: {
      de: "Motorräder ohne Leistungsbeschränkung",

      ar: "دراجات نارية دون قيود على القدرة",

      tr: "Güç sınırlaması olmayan motosikletler",

      es: "Motocicletas sin limitación de potencia",
    },

    imagePath:
      LICENSE_CATEGORY_IMAGES.A,

    standardMinimumAge: 24,
  },

  /* --------------------------------------------------------
     B — PASSENGER CARS
     -------------------------------------------------------- */

  B: {
    category: "B",

    name: {
      de: "Klasse B",
      ar: "الفئة B",
      tr: "B Sınıfı",
      es: "Permiso B",
    },

    description: {
      de: "Pkw und Kraftfahrzeuge bis 3,5 t",

      ar: "السيارات والمركبات حتى 3.5 طن",

      tr: "3,5 tona kadar otomobil ve araçlar",

      es: "Automóviles y vehículos de hasta 3,5 toneladas",
    },

    imagePath:
      LICENSE_CATEGORY_IMAGES.B,

    standardMinimumAge: 18,
  },

  /* --------------------------------------------------------
     BE — PASSENGER CAR WITH TRAILER
     -------------------------------------------------------- */

  BE: {
    category: "BE",

    name: {
      de: "Klasse BE",
      ar: "الفئة BE",
      tr: "BE Sınıfı",
      es: "Permiso BE",
    },

    description: {
      de: "Pkw mit Anhänger bis 3,5 t Anhängermasse",

      ar: "سيارة مع مقطورة تصل كتلتها إلى 3.5 طن",

      tr: "3,5 tona kadar römorklu otomobil",

      es: "Automóvil con remolque de hasta 3,5 toneladas",
    },

    imagePath:
      LICENSE_CATEGORY_IMAGES.BE,

    standardMinimumAge: 18,
  },

  /* --------------------------------------------------------
     C1 — MEDIUM-SIZED TRUCKS
     -------------------------------------------------------- */

  C1: {
    category: "C1",

    name: {
      de: "Klasse C1",
      ar: "الفئة C1",
      tr: "C1 Sınıfı",
      es: "Permiso C1",
    },

    description: {
      de: "Lkw über 3,5 t bis 7,5 t",

      ar: "شاحنات تزيد عن 3.5 طن وحتى 7.5 طن",

      tr: "3,5 tondan 7,5 tona kadar kamyonlar",

      es: "Camiones de más de 3,5 hasta 7,5 toneladas",
    },

    imagePath:
      LICENSE_CATEGORY_IMAGES.C1,

    standardMinimumAge: 18,
  },

  /* --------------------------------------------------------
     C1E — MEDIUM-SIZED TRUCK WITH TRAILER
     -------------------------------------------------------- */

  C1E: {
    category: "C1E",

    name: {
      de: "Klasse C1E",
      ar: "الفئة C1E",
      tr: "C1E Sınıfı",
      es: "Permiso C1E",
    },

    description: {
      de: "Fahrzeugkombinationen bis 12 t",

      ar: "مجموعات مركبات تصل إلى 12 طناً",

      tr: "12 tona kadar araç kombinasyonları",

      es: "Conjuntos de vehículos de hasta 12 toneladas",
    },

    imagePath:
      LICENSE_CATEGORY_IMAGES.C1E,

    standardMinimumAge: 18,
  },

  /* --------------------------------------------------------
     C — HEAVY TRUCKS
     -------------------------------------------------------- */

  C: {
    category: "C",

    name: {
      de: "Klasse C",
      ar: "الفئة C",
      tr: "C Sınıfı",
      es: "Permiso C",
    },

    description: {
      de: "Schwere Lkw über 3,5 t",

      ar: "الشاحنات الثقيلة التي تزيد عن 3.5 طن",

      tr: "3,5 ton üzerindeki ağır kamyonlar",

      es: "Camiones pesados de más de 3,5 toneladas",
    },

    imagePath:
      LICENSE_CATEGORY_IMAGES.C,

    standardMinimumAge: 21,
  },

  /* --------------------------------------------------------
     CE — HEAVY TRUCK WITH TRAILER
     -------------------------------------------------------- */

  CE: {
    category: "CE",

    name: {
      de: "Klasse CE",
      ar: "الفئة CE",
      tr: "CE Sınıfı",
      es: "Permiso CE",
    },

    description: {
      de: "Schwere Lkw mit Anhänger über 750 kg",

      ar: "شاحنات ثقيلة مع مقطورة تزيد عن 750 كغ",

      tr: "750 kg üzeri römorklu ağır kamyonlar",

      es: "Camiones con remolque de más de 750 kg",
    },

    imagePath:
      LICENSE_CATEGORY_IMAGES.CE,

    standardMinimumAge: 21,
  },

  /* --------------------------------------------------------
     D1 — MINIBUSES
     -------------------------------------------------------- */

  D1: {
    category: "D1",

    name: {
      de: "Klasse D1",
      ar: "الفئة D1",
      tr: "D1 Sınıfı",
      es: "Permiso D1",
    },

    description: {
      de: "Kleinbusse bis 16 Fahrgäste und 8 m Länge",

      ar: "حافلات صغيرة حتى 16 راكباً وطول 8 أمتار",

      tr: "16 yolcuya ve 8 metreye kadar minibüsler",

      es: "Minibuses de hasta 16 pasajeros y 8 metros",
    },

    imagePath:
      LICENSE_CATEGORY_IMAGES.D1,

    standardMinimumAge: 21,
  },

  /* --------------------------------------------------------
     D1E — MINIBUS WITH TRAILER
     -------------------------------------------------------- */

  D1E: {
    category: "D1E",

    name: {
      de: "Klasse D1E",
      ar: "الفئة D1E",
      tr: "D1E Sınıfı",
      es: "Permiso D1E",
    },

    description: {
      de: "Kleinbusse mit Anhänger über 750 kg",

      ar: "حافلات صغيرة مع مقطورة تزيد عن 750 كغ",

      tr: "750 kg üzeri römorklu minibüsler",

      es: "Minibuses con remolque de más de 750 kg",
    },

    imagePath:
      LICENSE_CATEGORY_IMAGES.D1E,

    standardMinimumAge: 21,
  },

  /* --------------------------------------------------------
     D — BUSES
     -------------------------------------------------------- */

  D: {
    category: "D",

    name: {
      de: "Klasse D",
      ar: "الفئة D",
      tr: "D Sınıfı",
      es: "Permiso D",
    },

    description: {
      de: "Busse mit mehr als 8 Fahrgastplätzen",

      ar: "حافلات تتسع لأكثر من 8 ركاب",

      tr: "8'den fazla yolcu koltuğu olan otobüsler",

      es: "Autobuses de más de 8 plazas de pasajeros",
    },

    imagePath:
      LICENSE_CATEGORY_IMAGES.D,

    standardMinimumAge: 24,
  },

  /* --------------------------------------------------------
     DE — BUS WITH TRAILER
     -------------------------------------------------------- */

  DE: {
    category: "DE",

    name: {
      de: "Klasse DE",
      ar: "الفئة DE",
      tr: "DE Sınıfı",
      es: "Permiso DE",
    },

    description: {
      de: "Busse mit Anhänger über 750 kg",

      ar: "حافلات مع مقطورة تزيد عن 750 كغ",

      tr: "750 kg üzeri römorklu otobüsler",

      es: "Autobuses con remolque de más de 750 kg",
    },

    imagePath:
      LICENSE_CATEGORY_IMAGES.DE,

    standardMinimumAge: 24,
  },
};

/* ============================================================
   8. CENTRAL COMMERCIAL PRICING

   IMPORTANT:

   All amounts are in cents.

   Example:
   320_000 = 3,200.00 EUR
   20_900  =   209.00 EUR

   Prices below are proposed TAYM tariffs.

   pricingApproved remains false until
   the operator confirms the commercial
   prices and the actual training scope.

   registrationFeeCents:
   - Germany: confirmed 209 EUR.
   - Other countries: approved fees.

   Change pricingVersion whenever a price
   or included service changes.
   ============================================================ */

export const COUNTRY_LICENSE_PRICES: Record<
  ApplicationCountry,
  CountryPriceConfiguration
> = {
  /* ========================================================
     GERMANY
     ======================================================== */

  DE: {
    enabled: true,

    pricingApproved: true,

    registrationFeeCents: 20_900,

    pricingVersion:
      "DE-2026-11-v1",

    trainingPricesCents: {
      AM: 85_000,

      A1: 180_000,

      A2: 220_000,

      A: 250_000,

      B: 320_000,

      BE: 105_000,

      C1: 280_000,

      C1E: 180_000,

      C: 350_000,

      CE: 280_000,

      D1: 320_000,

      D1E: 220_000,

      D: 450_000,

      DE: 300_000,
    },

    disabledCategories: [],
  },

  /* ========================================================
     AUSTRIA
     ======================================================== */

  AT: {
    enabled: true,

    pricingApproved: true,

    registrationFeeCents: 18_900,

    pricingVersion:
      "AT-2026-11-v1",

    trainingPricesCents: {
      AM: 45_000,

      A1: 130_000,

      A2: 150_000,

      A: 180_000,

      B: 210_000,

      BE: 85_000,

      C1: 190_000,

      C1E: 140_000,

      C: 260_000,

      CE: 190_000,

      D1: 250_000,

      D1E: 170_000,

      D: 340_000,

      DE: 230_000,
    },

    disabledCategories: [],
  },

  /* ========================================================
     BELGIUM
     ======================================================== */

  BE: {
    enabled: true,

    pricingApproved: true,

    registrationFeeCents: 17_900,

    pricingVersion:
      "BE-2026-11-v1",

    trainingPricesCents: {
      AM: 50_000,

      A1: 115_000,

      A2: 135_000,

      A: 155_000,

      B: 180_000,

      BE: 95_000,

      C1: 180_000,

      C1E: 125_000,

      C: 250_000,

      CE: 200_000,

      D1: 240_000,

      D1E: 160_000,

      D: 320_000,

      DE: 230_000,
    },

    disabledCategories: [],
  },

  /* ========================================================
     ITALY
     ======================================================== */

  IT: {
    enabled: true,

    pricingApproved: true,

    registrationFeeCents: 14_900,

    pricingVersion:
      "IT-2026-11-v1",

    trainingPricesCents: {
      AM: 40_000,

      A1: 75_000,

      A2: 85_000,

      A: 95_000,

      B: 120_000,

      BE: 70_000,

      C1: 130_000,

      C1E: 95_000,

      C: 180_000,

      CE: 140_000,

      D1: 170_000,

      D1E: 120_000,

      D: 250_000,

      DE: 170_000,
    },

    disabledCategories: [],
  },

  /* ========================================================
     SPAIN
     ======================================================== */

  ES: {
    enabled: true,

    pricingApproved: true,

    registrationFeeCents: 14_900,

    pricingVersion:
      "ES-2026-11-v1",

    trainingPricesCents: {
      AM: 35_000,

      A1: 70_000,

      A2: 80_000,

      A: 85_000,

      B: 110_000,

      BE: 65_000,

      C1: 120_000,

      C1E: 90_000,

      C: 170_000,

      CE: 130_000,

      D1: 160_000,

      D1E: 110_000,

      D: 230_000,

      DE: 160_000,
    },

    disabledCategories: [],
  },
};

/* ============================================================
   9. COUNTRY-SPECIFIC AGE REFERENCES

   Standard issuance age references.

   These values are not automatic
   legal eligibility decisions.

   Accompanied driving, professional
   qualifications, progressive access
   and other exceptions are reviewed
   separately by qualified staff.
   ============================================================ */

export const COUNTRY_MINIMUM_AGES: Record<
  ApplicationCountry,

  Record<LicenseCategory, number>
> = {
  DE: {
    AM: 15,
    A1: 16,
    A2: 18,
    A: 24,
    B: 18,
    BE: 18,
    C1: 18,
    C1E: 18,
    C: 21,
    CE: 21,
    D1: 21,
    D1E: 21,
    D: 24,
    DE: 24,
  },

  AT: {
    AM: 15,
    A1: 16,
    A2: 18,
    A: 24,
    B: 18,
    BE: 18,
    C1: 18,
    C1E: 18,
    C: 21,
    CE: 21,
    D1: 21,
    D1E: 21,
    D: 24,
    DE: 24,
  },

  BE: {
    AM: 16,
    A1: 18,
    A2: 20,
    A: 24,
    B: 18,
    BE: 18,
    C1: 18,
    C1E: 18,
    C: 21,
    CE: 21,
    D1: 21,
    D1E: 21,
    D: 24,
    DE: 24,
  },

  IT: {
    AM: 14,
    A1: 16,
    A2: 18,
    A: 24,
    B: 18,
    BE: 18,
    C1: 18,
    C1E: 18,
    C: 21,
    CE: 21,
    D1: 21,
    D1E: 21,
    D: 24,
    DE: 24,
  },

  ES: {
    AM: 15,
    A1: 16,
    A2: 18,

    /*
     * Spanish category A uses
     * progressive access from A2.
     */

    A: 20,

    B: 18,
    BE: 18,
    C1: 18,
    C1E: 18,
    C: 21,
    CE: 21,
    D1: 21,
    D1E: 21,
    D: 24,
    DE: 24,
  },
};

/* ============================================================
   10. EXISTING LICENSE REQUIREMENTS

   Requirements must be reviewed before
   official enrollment or examination.

   Simultaneous training and permitted
   national exceptions can be assessed
   during administrative review.
   ============================================================ */

const EXISTING_LICENSE_REQUIREMENTS: Record<
  LicenseCategory,
  readonly LicenseCategory[]
> = {
  AM: [],

  A1: [],

  A2: [],

  A: [],

  B: [],

  BE: ["B"],

  C1: ["B"],

  C1E: ["C1"],

  C: ["B"],

  CE: ["C"],

  D1: ["B"],

  D1E: ["D1"],

  D: ["B"],

  DE: ["D"],
};

/* ============================================================
   11. HEAVY VEHICLE CATEGORIES
   ============================================================ */

const HEAVY_VEHICLE_CATEGORIES =
  new Set<LicenseCategory>([
    "C1",

    "C1E",

    "C",

    "CE",

    "D1",

    "D1E",

    "D",

    "DE",
  ]);

/* ============================================================
   12. COUNTRY-SPECIFIC RULES

   Review flags are used deliberately.

   The application collects a preliminary
   dossier, not an automatic entitlement
   to an official driving license.

   Belgium:
   Regional rules must be checked.

   Spain:
   Category A requires progressive access
   and verification of A2 experience.

   Germany and Austria:
   Medical, vision, first aid and age
   exceptions depend on category.

   Italy:
   Medical fitness and any age-related
   exceptions require local verification.
   ============================================================ */

export type CountryAdmissionPolicy = {
  habitualResidenceReviewRequired: boolean;

  medicalReviewForAllCategories: boolean;

  visionReviewRequired: boolean;

  firstAidReviewRequired: boolean;

  regionalReviewRequired: boolean;

  manualReviewRequired: boolean;

  legalSourceUrl: string;
};

export const COUNTRY_ADMISSION_POLICIES: Record<
  ApplicationCountry,

  CountryAdmissionPolicy
> = {
  DE: {
    habitualResidenceReviewRequired: true,

    medicalReviewForAllCategories: false,

    visionReviewRequired: true,

    firstAidReviewRequired: true,

    regionalReviewRequired: false,

    manualReviewRequired: true,

    legalSourceUrl:
      "https://www.gesetze-im-internet.de/fev_2010/",
  },

  AT: {
    habitualResidenceReviewRequired: true,

    medicalReviewForAllCategories: true,

    visionReviewRequired: true,

    firstAidReviewRequired: true,

    regionalReviewRequired: false,

    manualReviewRequired: true,

    legalSourceUrl:
      "https://www.oesterreich.gv.at/",
  },

  BE: {
    habitualResidenceReviewRequired: true,

    medicalReviewForAllCategories: false,

    visionReviewRequired: true,

    firstAidReviewRequired: false,

    regionalReviewRequired: true,

    manualReviewRequired: true,

    legalSourceUrl:
      "https://mobilit.belgium.be/",
  },

  IT: {
    habitualResidenceReviewRequired: true,

    medicalReviewForAllCategories: true,

    visionReviewRequired: true,

    firstAidReviewRequired: false,

    regionalReviewRequired: false,

    manualReviewRequired: true,

    legalSourceUrl:
      "https://www.mit.gov.it/",
  },

  ES: {
    habitualResidenceReviewRequired: true,

    medicalReviewForAllCategories: true,

    visionReviewRequired: true,

    firstAidReviewRequired: false,

    regionalReviewRequired: false,

    manualReviewRequired: true,

    legalSourceUrl:
      "https://www.dgt.es/",
  },
};

/* ============================================================
   13. LOCALIZED ADMISSION NOTICES

   These notices describe the actual
   scope of a TAYM application.

   They do not promise license issuance.
   ============================================================ */

export const LICENSE_ADMISSION_NOTICES: Record<
  ApplicationCountry,

  LocalizedLicenseText
> = {
  DE: {
    de: "Die Voraussetzungen richten sich nach der Führerscheinklasse. Begleitetes Fahren und berufliche Sonderregelungen werden gesondert geprüft.",

    ar: "تعتمد الشروط على فئة رخصة القيادة. يتم التحقق بشكل منفصل من القيادة برفقة مرافق والاستثناءات المهنية.",

    tr: "Şartlar ehliyet sınıfına göre değişir. Refakatli sürüş ve mesleki istisnalar ayrıca değerlendirilir.",

    es: "Los requisitos dependen de la categoría. La conducción acompañada y las excepciones profesionales se comprueban por separado.",
  },

  AT: {
    de: "Die Zulassungsvoraussetzungen einschließlich L17 und beruflicher Ausnahmen werden individuell geprüft.",

    ar: "يتم التحقق بشكل فردي من شروط القبول بما في ذلك نظام L17 والاستثناءات المهنية.",

    tr: "L17 ve mesleki istisnalar dahil kabul şartları bireysel olarak değerlendirilir.",

    es: "Los requisitos de admisión, incluidos L17 y las excepciones profesionales, se revisan individualmente.",
  },

  BE: {
    de: "Die regionalen Vorschriften in Brüssel, Flandern und Wallonien müssen berücksichtigt werden.",

    ar: "يجب مراعاة القواعد الإقليمية في بروكسل وفلاندرز ووالونيا.",

    tr: "Brüksel, Flaman Bölgesi ve Valonya'nın bölgesel kuralları dikkate alınmalıdır.",

    es: "Deben tenerse en cuenta las normas regionales de Bruselas, Flandes y Valonia.",
  },

  IT: {
    de: "Die medizinische Eignung und die Voraussetzungen der gewünschten Führerscheinklasse werden individuell geprüft.",

    ar: "يتم التحقق بشكل فردي من الأهلية الطبية وشروط فئة رخصة القيادة المطلوبة.",

    tr: "Sağlık uygunluğu ve seçilen ehliyet sınıfının şartları bireysel olarak değerlendirilir.",

    es: "La aptitud médica y los requisitos de la categoría solicitada se comprueban individualmente.",
  },

  ES: {
    de: "Die Voraussetzungen der DGT werden geprüft. Für die Klasse A ist insbesondere der vorherige Besitz der Klasse A2 zu berücksichtigen.",

    ar: "يتم التحقق من متطلبات الإدارة العامة للمرور، وخاصة حيازة الفئة A2 مسبقاً للحصول على الفئة A.",

    tr: "DGT şartları kontrol edilir. A sınıfı için özellikle önceki A2 ehliyeti dikkate alınır.",

    es: "Se comprueban los requisitos de la DGT, especialmente la experiencia previa con el permiso A2 para acceder al permiso A.",
  },
};

/* ============================================================
   14. GENERAL PRICE AND LEGAL NOTICES
   ============================================================ */

export const LICENSE_CONFIGURATION_TEXT = {
  de: {
    trainingPrice:
      "Ausbildungspreis",

    registrationFee:
      "Anmelde- und Bearbeitungsgebühr",

    total:
      "Gesamtbetrag",

    estimatedPrice:
      "Vorläufiger Ausbildungspreis",

    pricingUnavailable:
      "Preis noch nicht bestätigt",

    feeNotice:
      "Die Anmelde- und Bearbeitungsgebühr ist eine separate Servicegebühr von TAYM.",

    externalFeesNotice:
      "Zusätzliche Fahrstunden, externe Prüfungen und behördliche Gebühren können weitere Kosten verursachen, soweit sie nicht ausdrücklich enthalten sind.",

    ageNotice:
      "Das angegebene Alter ist ein Richtwert für den regulären Zugang. Ausnahmen werden individuell geprüft.",

    legalNotice:
      "Die Antragstellung bei TAYM ersetzt keine vorgeschriebenen Prüfungen und garantiert keine behördliche Fahrerlaubnis.",
  },

  ar: {
    trainingPrice:
      "سعر التدريب",

    registrationFee:
      "رسوم التسجيل ومعالجة الملف",

    total:
      "المبلغ الإجمالي",

    estimatedPrice:
      "سعر التدريب التقديري",

    pricingUnavailable:
      "لم يتم تأكيد السعر بعد",

    feeNotice:
      "رسوم التسجيل ومعالجة الملف هي رسوم خدمة منفصلة لدى TAYM.",

    externalFeesNotice:
      "قد تترتب تكاليف إضافية للدروس والاختبارات الخارجية والرسوم الحكومية ما لم تكن مشمولة بشكل صريح.",

    ageNotice:
      "العمر المذكور مرجع للقبول العادي، ويتم التحقق من الاستثناءات بشكل فردي.",

    legalNotice:
      "تقديم الطلب لدى TAYM لا يحل محل الاختبارات الإلزامية ولا يضمن إصدار رخصة قيادة رسمية.",
  },

  tr: {
    trainingPrice:
      "Eğitim ücreti",

    registrationFee:
      "Kayıt ve dosya işlem ücreti",

    total:
      "Toplam tutar",

    estimatedPrice:
      "Tahmini eğitim ücreti",

    pricingUnavailable:
      "Fiyat henüz onaylanmadı",

    feeNotice:
      "Kayıt ve dosya işlem ücreti TAYM'ın ayrı hizmet ücretidir.",

    externalFeesNotice:
      "Açıkça dahil edilmemiş ek sürüş dersleri, harici sınavlar ve resmi ücretler ilave maliyet oluşturabilir.",

    ageNotice:
      "Belirtilen yaş standart erişim için referanstır. İstisnalar bireysel olarak incelenir.",

    legalNotice:
      "TAYM başvurusu zorunlu sınavların yerine geçmez ve resmi ehliyet verilmesini garanti etmez.",
  },

  es: {
    trainingPrice:
      "Precio de formación",

    registrationFee:
      "Tasa de inscripción y tramitación",

    total:
      "Importe total",

    estimatedPrice:
      "Precio estimado de formación",

    pricingUnavailable:
      "Precio pendiente de confirmación",

    feeNotice:
      "La tasa de inscripción y tramitación es un cargo separado por los servicios de TAYM.",

    externalFeesNotice:
      "Las clases adicionales, las pruebas externas y las tasas oficiales pueden generar costes adicionales si no están expresamente incluidos.",

    ageNotice:
      "La edad indicada es una referencia para el acceso ordinario. Las excepciones se revisan individualmente.",

    legalNotice:
      "La solicitud en TAYM no sustituye las pruebas obligatorias ni garantiza la expedición de un permiso oficial.",
  },
} as const;

/* ============================================================
   15. COUNTRY VALIDATION

   Local helper keeps this configuration
   free of runtime server-only imports.

   Only TypeScript types are imported
   from validation.ts.
   ============================================================ */

function isConfiguredCountry(
  value: unknown
): value is ApplicationCountry {
  return (
    typeof value === "string" &&

    (
      DRIVING_LICENSE_COUNTRIES as
        readonly string[]
    ).includes(value)
  );
}

/* ============================================================
   16. CATEGORY VALIDATION
   ============================================================ */

function isConfiguredCategory(
  value: unknown
): value is LicenseCategory {
  return (
    typeof value === "string" &&

    Object.prototype.hasOwnProperty.call(
      CATEGORY_DEFINITIONS,

      value
    )
  );
}

/* ============================================================
   17. LOCALE NORMALIZATION
   ============================================================ */

export function normalizeLicenseLocale(
  value: unknown
): ApplicationLocale {
  if (typeof value !== "string") {
    return "de";
  }

  const locale =
    value
      .trim()
      .toLowerCase()
      .split("-")[0];

  return (
    DRIVING_LICENSE_LOCALES as
      readonly string[]
  ).includes(locale)

    ? locale as ApplicationLocale

    : "de";
}

/* ============================================================
   18. COUNTRY CODE NORMALIZATION
   ============================================================ */

export function normalizeLicenseCountry(
  value: unknown
): ApplicationCountry | null {
  if (typeof value !== "string") {
    return null;
  }

  const code =
    value.trim().toUpperCase();

  return isConfiguredCountry(code)

    ? code

    : null;
}

/* ============================================================
   19. CATEGORY CODE NORMALIZATION
   ============================================================ */

export function normalizeLicenseCategoryCode(
  value: unknown
): LicenseCategory | null {
  if (typeof value !== "string") {
    return null;
  }

  const category =
    value.trim().toUpperCase();

  return isConfiguredCategory(category)

    ? category

    : null;
}

/* ============================================================
   20. CONFIGURATION VALIDATION

   Fail closed when a price or country
   configuration is invalid.
   ============================================================ */

class DrivingLicenseConfigurationError
  extends Error {
  readonly code =
    "SERVICE_UNAVAILABLE";

  readonly status = 503;

  constructor() {
    super(
      "Invalid driving license configuration."
    );

    this.name =
      "DrivingLicenseConfigurationError";
  }
}

function assertCountryConfiguration(
  country: ApplicationCountry
): CountryPriceConfiguration {
  if (!isConfiguredCountry(country)) {
    throw new DrivingLicenseConfigurationError();
  }

  const configuration =
    COUNTRY_LICENSE_PRICES[country];

  if (
    typeof configuration.enabled !==
      "boolean" ||

    typeof configuration.pricingApproved !==
      "boolean" ||

    !/^[A-Za-z0-9._:-]{1,100}$/.test(
      configuration.pricingVersion
    )
  ) {
    throw new DrivingLicenseConfigurationError();
  }

  const fee =
    configuration.registrationFeeCents;

  if (
    fee !== null &&

    (
      !Number.isSafeInteger(fee) ||

      fee < 0
    )
  ) {
    throw new DrivingLicenseConfigurationError();
  }

  /*
   * Confirmed German service fee.
   *
   * Matches validation.ts.
   */

  if (
    country === "DE" &&

    fee !== 20_900
  ) {
    throw new DrivingLicenseConfigurationError();
  }

  if (
    configuration.pricingApproved &&

    fee === null
  ) {
    throw new DrivingLicenseConfigurationError();
  }

  for (
    const category
    of DRIVING_LICENSE_CATEGORY_ORDER
  ) {
    const amount =
      configuration
        .trainingPricesCents[category];

    if (
      !Number.isSafeInteger(amount) ||

      amount <= 0 ||

      (
        fee !== null &&

        !Number.isSafeInteger(
          amount + fee
        )
      )
    ) {
      throw new DrivingLicenseConfigurationError();
    }

    const age =
      COUNTRY_MINIMUM_AGES[
        country
      ][category];

    if (
      !Number.isInteger(age) ||

      age < 14 ||

      age > 30
    ) {
      throw new DrivingLicenseConfigurationError();
    }
  }

  const configuredDisabledCategories =
    configuration.disabledCategories ?? [];

  if (
    configuredDisabledCategories.some(
      (category) =>
        !isConfiguredCategory(category)
    )
  ) {
    throw new DrivingLicenseConfigurationError();
  }

  return configuration;
}

/* ============================================================
   21. GET EXISTING CATEGORY IMAGE
   ============================================================ */

export function getLicenseCategoryImage(
  category: LicenseCategory
): string | null {
  const path =
    LICENSE_CATEGORY_IMAGES[category];

  if (
    typeof path !== "string" ||

    !path.startsWith("/") ||

    path.startsWith("//") ||

    path.includes("..") ||

    path.includes("\\") ||

    path.includes("%") ||

    !/^\/[A-Za-z0-9/_\-.]+$/.test(path) ||

    !/\.(jpg|jpeg|png|webp|avif)$/i
      .test(path)
  ) {
    return null;
  }

  return path;
}

/* ============================================================
   22. GET CATEGORY MINIMUM AGE
   ============================================================ */

export function getLicenseMinimumAge(
  country: ApplicationCountry,

  category: LicenseCategory
): number {
  if (
    !isConfiguredCountry(country) ||

    !isConfiguredCategory(category)
  ) {
    throw new DrivingLicenseConfigurationError();
  }

  return COUNTRY_MINIMUM_AGES[
    country
  ][category];
}

/* ============================================================
   23. GET ADMISSION REQUIREMENTS

   Compatible with validation.ts.

   Missing additional eligibility
   information is flagged for review,
   not invented or automatically approved.

   The five core application documents
   are already mandatory in validation.ts.
   ============================================================ */

export function getLicenseAdmissionRequirements(
  country: ApplicationCountry,

  category: LicenseCategory
): AdmissionRequirements {
  if (
    !isConfiguredCountry(country) ||

    !isConfiguredCategory(category)
  ) {
    throw new DrivingLicenseConfigurationError();
  }

  const policy =
    COUNTRY_ADMISSION_POLICIES[country];

  const heavyVehicle =
    HEAVY_VEHICLE_CATEGORIES.has(
      category
    );

  const existingCategories =
    new Set<LicenseCategory>(
      EXISTING_LICENSE_REQUIREMENTS[
        category
      ]
    );

  /*
   * Spain:
   * Category A requires prior A2.
   * Duration and approved training
   * must be verified administratively.
   */

  if (
    country === "ES" &&

    category === "A"
  ) {
    existingCategories.add("A2");
  }

  const additionalDocuments =
    new Set<ApplicationDocumentType>();

  if (existingCategories.size > 0) {
    additionalDocuments.add(
      "EXISTING_DRIVING_LICENSE"
    );
  }

  const medicalReviewRequired =
    heavyVehicle ||

    policy.medicalReviewForAllCategories;

  if (medicalReviewRequired) {
    additionalDocuments.add(
      "MEDICAL_CERTIFICATE"
    );
  }

  /*
   * Evidence format varies by country.
   * Do not automatically require a
   * standalone vision certificate everywhere.
   */

  if (country === "DE") {
    additionalDocuments.add(
      "VISION_TEST"
    );
  }

  /*
   * Prior certification and national
   * exceptions can satisfy first-aid rules.
   */

  const firstAidReviewRequired =
    policy.firstAidReviewRequired &&

    category !== "AM";

  if (firstAidReviewRequired) {
    additionalDocuments.add(
      "FIRST_AID_CERTIFICATE"
    );
  }

  return {
    minimumAge:
      getLicenseMinimumAge(
        country,
        category
      ),

    requiredExistingCategories:
      [...existingCategories],

    additionalRequiredDocuments:
      [...additionalDocuments],

    habitualResidenceReviewRequired:
      policy.habitualResidenceReviewRequired,

    medicalReviewRequired,

    visionReviewRequired:
      policy.visionReviewRequired,

    firstAidReviewRequired,

    professionalQualificationReviewRequired:
      heavyVehicle,

    /*
     * Final eligibility review remains
     * necessary for every application.
     */

    manualReviewRequired: true,
  };
}

/* ============================================================
   24. CHECK COUNTRY AVAILABILITY
   ============================================================ */

export function isLicenseCountryEnabled(
  country: ApplicationCountry
): boolean {
  if (!isConfiguredCountry(country)) {
    return false;
  }

  return assertCountryConfiguration(
    country
  ).enabled;
}

/* ============================================================
   25. CHECK CATEGORY AVAILABILITY
   ============================================================ */

export function isLicenseCategoryEnabled(
  country: ApplicationCountry,

  category: LicenseCategory
): boolean {
  if (
    !isConfiguredCountry(country) ||

    !isConfiguredCategory(category)
  ) {
    return false;
  }

  const configuration =
    assertCountryConfiguration(country);

  return (
    configuration.enabled &&

    !(
      configuration.disabledCategories ?? []
    ).includes(category)
  );
}

/* ============================================================
   26. GET COUNTRY REGISTRATION FEE
   ============================================================ */

export function getCountryRegistrationFeeCents(
  country: ApplicationCountry
): number | null {
  return assertCountryConfiguration(
    country
  ).registrationFeeCents;
}

/* ============================================================
   27. GET TRAINING PRICE
   ============================================================ */

export function getLicenseTrainingPriceCents(
  country: ApplicationCountry,

  category: LicenseCategory
): number {
  if (!isConfiguredCategory(category)) {
    throw new DrivingLicenseConfigurationError();
  }

  const configuration =
    assertCountryConfiguration(country);

  return configuration
    .trainingPricesCents[category];
}

/* ============================================================
   28. GET PUBLIC CATEGORY CONFIGURATION

   Returns the exact category structure
   used by application.ts and the GET API.
   ============================================================ */

export function getLicenseCategoryConfiguration(
  country: ApplicationCountry,

  category: LicenseCategory
): PublicLicenseCategoryConfiguration {
  if (!isConfiguredCategory(category)) {
    throw new DrivingLicenseConfigurationError();
  }

  const configuration =
    assertCountryConfiguration(country);

  const definition =
    CATEGORY_DEFINITIONS[category];

  const enabled =
    configuration.enabled &&

    !(
      configuration.disabledCategories ?? []
    ).includes(category);

  return {
    category,

    enabled,

    pricingApproved:
      configuration.pricingApproved,

    name: {
      ...definition.name,
    },

    description: {
      ...definition.description,
    },

    imagePath:
      getLicenseCategoryImage(
        category
      ),

    minimumAge:
      COUNTRY_MINIMUM_AGES[
        country
      ][category],

    currency:
      DRIVING_LICENSE_CURRENCY,

    trainingPriceCents:
      configuration
        .trainingPricesCents[category],

    registrationFeeCents:
      configuration
        .registrationFeeCents,

    pricingVersion:
      configuration
        .pricingVersion,
  };
}

/* ============================================================
   29. GET COUNTRY LICENSE CONFIGURATION

   REQUIRED EXPORT.

   Used by:
   src/lib/applications/application.ts

   Compatible with:
   GET /api/dashboard/application

   Returns:
   - Country
   - Currency
   - Registration fees
   - Categories
   - Four-language names
   - Four-language descriptions
   - Existing image paths
   - Training prices
   - Pricing approval status
   - Minimum age references
   ============================================================ */

export function getCountryLicenseConfiguration(
  countryCode: ApplicationCountry
): CountryLicenseConfiguration {
  const configuration =
    assertCountryConfiguration(
      countryCode
    );

  const categories:
    PublicLicenseCategoryConfiguration[] =
      DRIVING_LICENSE_CATEGORY_ORDER.map(
        (category) =>

          getLicenseCategoryConfiguration(
            countryCode,

            category
          )
      );

  return {
    countryCode,

    currency:
      DRIVING_LICENSE_CURRENCY,

    registrationFeeCents:
      configuration
        .registrationFeeCents,

    categories,
  };
}

/* ============================================================
   30. GET TRUSTED LICENSE OFFERING

   Used exclusively as trusted
   commercial configuration.

   Never accept these prices from
   untrusted browser requests.
   ============================================================ */

export function getLicenseOffering(
  countryCode: ApplicationCountry,

  category: LicenseCategory
): TrustedLicenseOffering {
  const configuration =
    getLicenseCategoryConfiguration(
      countryCode,

      category
    );

  return {
    countryCode,

    category,

    enabled:
      configuration.enabled,

    pricingApproved:
      configuration.pricingApproved,

    currency:
      configuration.currency,

    trainingPriceCents:
      configuration.trainingPriceCents,

    registrationFeeCents:
      configuration.registrationFeeCents,

    pricingVersion:
      configuration.pricingVersion,

    requirements:
      getLicenseAdmissionRequirements(
        countryCode,

        category
      ),
  };
}

/* ============================================================
   31. GET COUNTRY LICENSE OFFERINGS

   REQUIRED EXPORT.

   Used by:
   src/lib/applications/application.ts

   Compatible with:
   validateApplicationDraft()
   validateApplicationSubmission()
   calculateApplicationPricing()

   Uses the same central catalog as
   getCountryLicenseConfiguration().

   No duplicated independent tariffs.
   ============================================================ */

export function getCountryLicenseOfferings(
  countryCode: ApplicationCountry
): TrustedLicenseOffering[] {
  assertCountryConfiguration(
    countryCode
  );

  return DRIVING_LICENSE_CATEGORY_ORDER.map(
    (category) =>

      getLicenseOffering(
        countryCode,

        category
      )
  );
}

/* ============================================================
   32. GET AVAILABLE COUNTRY CATEGORIES
   ============================================================ */

export function getEnabledCountryLicenseCategories(
  countryCode: ApplicationCountry
): PublicLicenseCategoryConfiguration[] {
  return getCountryLicenseConfiguration(
    countryCode
  ).categories.filter(
    (category) =>
      category.enabled
  );
}

/* ============================================================
   33. GET AVAILABLE COUNTRIES
   ============================================================ */

export function getEnabledLicenseCountries():
  ApplicationCountry[] {
  return DRIVING_LICENSE_COUNTRIES.filter(
    (country) =>
      isLicenseCountryEnabled(country)
  );
}

/* ============================================================
   34. GET LOCALIZED COUNTRY NAME
   ============================================================ */

export function getLicenseCountryName(
  country: ApplicationCountry,

  locale: ApplicationLocale = "de"
): string {
  if (!isConfiguredCountry(country)) {
    throw new DrivingLicenseConfigurationError();
  }

  return LICENSE_COUNTRY_NAMES[
    country
  ][
    normalizeLicenseLocale(locale)
  ];
}

/* ============================================================
   35. GET LOCALIZED CATEGORY NAME
   ============================================================ */

export function getLicenseCategoryName(
  category: LicenseCategory,

  locale: ApplicationLocale = "de"
): string {
  if (!isConfiguredCategory(category)) {
    throw new DrivingLicenseConfigurationError();
  }

  return CATEGORY_DEFINITIONS[
    category
  ].name[
    normalizeLicenseLocale(locale)
  ];
}

/* ============================================================
   36. GET LOCALIZED CATEGORY DESCRIPTION
   ============================================================ */

export function getLicenseCategoryDescription(
  category: LicenseCategory,

  locale: ApplicationLocale = "de"
): string {
  if (!isConfiguredCategory(category)) {
    throw new DrivingLicenseConfigurationError();
  }

  return CATEGORY_DEFINITIONS[
    category
  ].description[
    normalizeLicenseLocale(locale)
  ];
}

/* ============================================================
   37. GET LOCALIZED ADMISSION NOTICE
   ============================================================ */

export function getLicenseAdmissionNotice(
  country: ApplicationCountry,

  locale: ApplicationLocale = "de"
): string {
  if (!isConfiguredCountry(country)) {
    throw new DrivingLicenseConfigurationError();
  }

  return LICENSE_ADMISSION_NOTICES[
    country
  ][
    normalizeLicenseLocale(locale)
  ];
}

/* ============================================================
   38. GET LOCALIZED PRICE LABELS
   ============================================================ */

export function getLicenseConfigurationText(
  locale: ApplicationLocale = "de"
) {
  return LICENSE_CONFIGURATION_TEXT[
    normalizeLicenseLocale(locale)
  ];
}

/* ============================================================
   39. FORMAT EURO PRICE
   ============================================================ */

export function formatLicensePrice(
  amountCents: number,

  locale: ApplicationLocale = "de"
): string {
  if (
    !Number.isSafeInteger(amountCents) ||

    amountCents < 0
  ) {
    throw new DrivingLicenseConfigurationError();
  }

  const formatLocales: Record<
    ApplicationLocale,
    string
  > = {
    de: "de-DE",

    ar: "ar",

    tr: "tr-TR",

    es: "es-ES",
  };

  return new Intl.NumberFormat(
    formatLocales[
      normalizeLicenseLocale(locale)
    ],

    {
      style: "currency",

      currency: "EUR",

      minimumFractionDigits: 2,

      maximumFractionDigits: 2,
    }
  ).format(
    amountCents / 100
  );
}

/* ============================================================
   40. GET CATEGORY PRICE BREAKDOWN

   Useful for displaying the selected
   category price immediately.

   The final authoritative calculation
   is still performed by validation.ts
   on the authenticated server.
   ============================================================ */

export function getLicensePriceBreakdown(
  country: ApplicationCountry,

  category: LicenseCategory,

  locale: ApplicationLocale = "de"
) {
  const offering =
    getLicenseOffering(
      country,

      category
    );

  const fee =
    offering.registrationFeeCents;

  const total =
    fee === null

      ? null

      : offering.trainingPriceCents +
        fee;

  if (
    total !== null &&

    !Number.isSafeInteger(total)
  ) {
    throw new DrivingLicenseConfigurationError();
  }

  return {
    countryCode: country,

    category,

    currency:
      offering.currency,

    enabled:
      offering.enabled,

    pricingApproved:
      offering.pricingApproved,

    canSubmit:
      offering.enabled &&

      offering.pricingApproved &&

      total !== null,

    trainingPriceCents:
      offering.trainingPriceCents,

    registrationFeeCents:
      fee,

    totalPriceCents:
      total,

    pricingVersion:
      offering.pricingVersion,

    formatted: {
      trainingPrice:
        formatLicensePrice(
          offering.trainingPriceCents,

          locale
        ),

      registrationFee:
        fee === null

          ? null

          : formatLicensePrice(
              fee,

              locale
            ),

      totalPrice:
        total === null

          ? null

          : formatLicensePrice(
              total,

              locale
            ),
    },
  };
}

/* ============================================================
   41. VALIDATE ENTIRE LICENSE CATALOG

   Can be used in integration tests
   and deployment checks.
   ============================================================ */

export function validateDrivingLicenseCatalog():
  true {
  for (
    const country
    of DRIVING_LICENSE_COUNTRIES
  ) {
    assertCountryConfiguration(
      country
    );

    const configuration =
      getCountryLicenseConfiguration(
        country
      );

    const offerings =
      getCountryLicenseOfferings(
        country
      );

    if (
      configuration.categories.length !==
        DRIVING_LICENSE_CATEGORY_ORDER.length ||

      offerings.length !==
        configuration.categories.length
    ) {
      throw new DrivingLicenseConfigurationError();
    }

    for (
      const category
      of configuration.categories
    ) {
      const matching =
        offerings.filter(
          (offering) =>

            offering.category ===
              category.category
        );

      if (
        matching.length !== 1
      ) {
        throw new DrivingLicenseConfigurationError();
      }

      const offering =
        matching[0];

      if (
        category.trainingPriceCents !==
          offering.trainingPriceCents ||

        category.registrationFeeCents !==
          offering.registrationFeeCents ||

        category.pricingApproved !==
          offering.pricingApproved ||

        category.pricingVersion !==
          offering.pricingVersion ||

        category.enabled !==
          offering.enabled
      ) {
        throw new DrivingLicenseConfigurationError();
      }

      for (
        const locale
        of DRIVING_LICENSE_LOCALES
      ) {
        if (
          !category.name[locale]?.trim() ||

          !category.description[locale]?.trim()
        ) {
          throw new DrivingLicenseConfigurationError();
        }
      }
    }
  }

  return true;
}
