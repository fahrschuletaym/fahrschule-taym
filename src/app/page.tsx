
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import OffersCarousel from "@/components/home/OffersCarousel";

import {
  ArrowRight,
  CalendarDays,
  CarFront,
  Check,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  Grid2X2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  defaultLocale,
  isLocale,
  type Locale,
} from "@/i18n/config";

/* =========================================================
   FAHRSCHULE TAYM
   PAGE D'ACCUEIL OFFICIELLE
   PC / TABLETTE / MOBILE

   Header, MobileNav et Footer :
   déjà intégrés dans app/layout.tsx

   Styles : Tailwind CSS existant
   Aucun fichier CSS supplémentaire
   ========================================================= */

type Country = {
  name: string;
  description: string;
};

type Licence = {
  title: string;
  description: string;
};

type HomeCopy = {
  eyebrow: string;
  heroTitle: string;
  heroDescription: string;
  fastLicence: string;
  apply: string;
  discoverClasses: string;

  quickServices: string[];

  countriesTitle: string;
  countriesDescription: string;
  countries: Country[];

  classesTitle: string;
  classesDescription: string;
  classes: Licence[];
  allClasses: string;

  theoryTitle: string;
  theoryFeatures: string[];
  practiceTitle: string;
  practiceFeatures: string[];
  learnMore: string;

  partnersTitle: string;
  partnersDescription: string;

  stepsTitle: string;
  stepsSubtitle: string;
  steps: {
    title: string;
    description: string;
  }[];
};

const centreCopy: Record<Locale, { title: string; description: string; alt: string }> = {
  de: {
    title: "Gemeinsam auf dem Weg zum Führerschein",
    description: "Mit Fahrschule TAYM an deiner Seite.",
    alt: "Zwei Personen neben einem Fahrzeug der Fahrschule TAYM in Berlin",
  },
  ar: {
    title: "معًا في طريقك إلى رخصة القيادة",
    description: "مدرسة TAYM لتعليم القيادة إلى جانبك.",
    alt: "شخصان بجانب سيارة مدرسة TAYM لتعليم القيادة في برلين",
  },
  tr: {
    title: "Ehliyet yolunda birlikte",
    description: "Fahrschule TAYM yanınızda.",
    alt: "Berlin'de Fahrschule TAYM aracının yanında iki kişi",
  },
  es: {
    title: "Juntos en el camino hacia tu permiso de conducir",
    description: "Fahrschule TAYM a tu lado.",
    alt: "Dos personas junto a un vehículo de Fahrschule TAYM en Berlín",
  },
};

/* =========================================================
   TRADUCTIONS DE LA PAGE D'ACCUEIL
   ========================================================= */

const translations: Record<Locale, HomeCopy> = {
  de: {
    fastLicence: "Dein Führerschein in weniger als 21 Tagen",
    eyebrow:
      "Ihre Fahrschule in Deutschland, Österreich, Belgien, Italien und Spanien",

    heroTitle:
      "Dein Weg zum Führerschein beginnt hier.",

    heroDescription:
      "Theorie, Praxis, Antrag und behördliche Begleitung – alles aus einer Hand mit Fahrschule TAYM.",

    apply: "Führerschein beantragen",
    discoverClasses: "Führerscheinklassen entdecken",

    quickServices: [
      "Theorie & Online-Lernen",
      "Praktische Ausbildung",
      "Führerschein-Antrag & Abwicklung",
      "Umschreibung ausländischer Führerscheine",
      "Flexible Termine",
      "Persönliche Betreuung",
    ],

    countriesTitle: "Unsere Länder",
    countriesDescription:
      "Führerscheinausbildung und Service in mehreren Ländern.",

    countries: [
      {
        name: "Deutschland",
        description:
          "Alle Führerscheinklassen und Services",
      },
      {
        name: "Österreich",
        description:
          "Führerschein & Umschreibung",
      },
      {
        name: "Belgien",
        description:
          "Ausbildung, Prüfung und Begleitung",
      },
      {
        name: "Italien",
        description:
          "Führerschein, Theorie und Praxis",
      },
      {
        name: "Spanien",
        description:
          "Führerschein, Umschreibung und Anerkennung",
      },
    ],

    classesTitle: "Unsere Führerscheinklassen",
    classesDescription:
      "Alle wichtigen Führerscheinklassen – moderne Ausbildung, erfahrene Fahrlehrer und beste Vorbereitung.",

    classes: [
      {
        title: "Klasse B",
        description: "Pkw bis 3,5 t",
      },
      {
        title: "Klassen AM, A1, A2, A",
        description: "Motorrad & Roller",
      },
      {
        title: "Klasse BE / B96",
        description: "Anhänger & Erweiterungen",
      },
      {
        title: "Klassen C / CE",
        description: "Lkw & schwere Fahrzeuge",
      },
      {
        title: "Klassen D / DE",
        description: "Bus & Personenbeförderung",
      },
      {
        title: "Klassen T / L",
        description:
          "Traktor & landwirtschaftliche Fahrzeuge",
      },
    ],

    allClasses: "Alle Führerscheinklassen anzeigen",

    theoryTitle:
      "Theorieausbildung – Flexibel & Digital",

    theoryFeatures: [
      "Online-Theoriekurse (DE, AR, TR, ES)",
      "Offizielle Prüfungsfragen",
      "Übungstests & Lernfortschritt",
      "Vorbereitung auf die Theorieprüfung",
    ],

    practiceTitle:
      "Praxisausbildung – Sicher zum Erfolg",

    practiceFeatures: [
      "Fahrstunden mit erfahrenen Fahrlehrern",
      "Moderne und sichere Fahrzeuge",
      "Individuelle Betreuung",
      "Prüfungsvorbereitung in der Praxis",
    ],

    learnMore: "Mehr erfahren",

    partnersTitle:
      "Unsere Partner & zuständige Stellen",

    partnersDescription:
      "Zusammenarbeit mit anerkannten Prüf- und Zulassungsstellen.",

    stepsTitle: "So einfach funktioniert es",
    stepsSubtitle:
      "In wenigen Schritten zu deinem Führerschein.",

    steps: [
      {
        title: "Land & Klasse wählen",
        description: "Passende Ausbildung finden",
      },
      {
        title: "Konto erstellen",
        description: "Registrieren und Antrag starten",
      },
      {
        title: "Theorie & Praxis",
        description: "Ausbildung absolvieren",
      },
      {
        title: "Prüfung & Führerschein",
        description:
          "Prüfung ablegen und Führerschein erhalten",
      },
    ],
  },

  ar: {
    fastLicence: "احصل على رخصة قيادتك في أقل من 21 يومًا",
    eyebrow:
      "مدرسة القيادة الخاصة بك في ألمانيا والنمسا وبلجيكا وإيطاليا وإسبانيا",

    heroTitle:
      "رحلتك للحصول على رخصة القيادة تبدأ هنا.",

    heroDescription:
      "التعليم النظري والتدريب العملي والطلبات والمساعدة في الإجراءات الرسمية، كل ذلك مع Fahrschule TAYM.",

    apply: "التقدم بطلب رخصة قيادة",
    discoverClasses: "اكتشف فئات رخص القيادة",

    quickServices: [
      "التعليم النظري عبر الإنترنت",
      "التدريب العملي",
      "طلب رخصة القيادة والإجراءات",
      "تحويل رخص القيادة الأجنبية",
      "مواعيد مرنة",
      "المرافقة الشخصية",
    ],

    countriesTitle: "بلداننا",
    countriesDescription:
      "التدريب على القيادة والخدمات في عدة دول.",

    countries: [
      {
        name: "ألمانيا",
        description: "جميع فئات الرخص والخدمات",
      },
      {
        name: "النمسا",
        description: "رخص القيادة وتحويلها",
      },
      {
        name: "بلجيكا",
        description: "التدريب والاختبارات والمساعدة",
      },
      {
        name: "إيطاليا",
        description: "رخص القيادة والنظري والعملي",
      },
      {
        name: "إسبانيا",
        description: "رخص القيادة والتحويل والاعتراف",
      },
    ],

    classesTitle: "فئات رخص القيادة",
    classesDescription:
      "أهم فئات رخص القيادة مع تدريب حديث وتحضير مناسب للاختبارات.",

    classes: [
      {
        title: "الفئة B",
        description: "سيارات حتى 3.5 طن",
      },
      {
        title: "الفئات AM, A1, A2, A",
        description: "الدراجات النارية",
      },
      {
        title: "الفئة BE / B96",
        description: "المقطورات",
      },
      {
        title: "الفئات C / CE",
        description: "الشاحنات والمركبات الثقيلة",
      },
      {
        title: "الفئات D / DE",
        description: "الحافلات ونقل الركاب",
      },
      {
        title: "الفئات T / L",
        description: "الجرارات والمركبات الزراعية",
      },
    ],

    allClasses: "عرض جميع فئات الرخص",

    theoryTitle: "التعليم النظري – مرن ورقمي",

    theoryFeatures: [
      "دروس نظرية عبر الإنترنت",
      "أسئلة الاختبارات الرسمية",
      "اختبارات تدريبية ومتابعة التقدم",
      "التحضير للاختبار النظري",
    ],

    practiceTitle:
      "التدريب العملي – نحو النجاح بأمان",

    practiceFeatures: [
      "دروس قيادة مع مدربين ذوي خبرة",
      "مركبات حديثة وآمنة",
      "متابعة فردية",
      "التحضير للاختبار العملي",
    ],

    learnMore: "اعرف المزيد",

    partnersTitle:
      "شركاؤنا والجهات المختصة",

    partnersDescription:
      "هيئات الفحص والترخيص المختصة بإجراءات القيادة.",

    stepsTitle: "كيف يعمل النظام",
    stepsSubtitle:
      "خطوات بسيطة نحو رخصة القيادة.",

    steps: [
      {
        title: "اختيار البلد والفئة",
        description: "العثور على التدريب المناسب",
      },
      {
        title: "إنشاء حساب",
        description: "التسجيل وبدء الطلب",
      },
      {
        title: "التعليم النظري والعملي",
        description: "إكمال التدريب",
      },
      {
        title: "الاختبار ورخصة القيادة",
        description: "اجتياز الاختبار واستلام الرخصة",
      },
    ],
  },

  tr: {
    fastLicence: "Ehliyetinizi 21 günden kısa sürede alın",
    eyebrow:
      "Almanya, Avusturya, Belçika, İtalya ve İspanya'da sürücü kursunuz",

    heroTitle:
      "Ehliyete giden yolculuğunuz burada başlıyor.",

    heroDescription:
      "Teori, pratik, başvuru ve resmi işlemlerde rehberlik – Fahrschule TAYM ile tek platformda.",

    apply: "Ehliyet Başvurusu",
    discoverClasses: "Ehliyet Sınıflarını Keşfet",

    quickServices: [
      "Teori ve Online Eğitim",
      "Pratik Sürüş Eğitimi",
      "Ehliyet Başvurusu ve İşlemler",
      "Yabancı Ehliyet Dönüştürme",
      "Esnek Randevular",
      "Kişisel Destek",
    ],

    countriesTitle: "Ülkelerimiz",
    countriesDescription:
      "Birden fazla ülkede sürücü eğitimi ve hizmetler.",

    countries: [
      {
        name: "Almanya",
        description: "Tüm ehliyet sınıfları ve hizmetler",
      },
      {
        name: "Avusturya",
        description: "Ehliyet ve dönüştürme",
      },
      {
        name: "Belçika",
        description: "Eğitim, sınav ve rehberlik",
      },
      {
        name: "İtalya",
        description: "Ehliyet, teori ve pratik",
      },
      {
        name: "İspanya",
        description: "Ehliyet, dönüştürme ve tanıma",
      },
    ],

    classesTitle: "Ehliyet Sınıflarımız",
    classesDescription:
      "Önemli ehliyet sınıfları, modern eğitim ve sınav hazırlığı.",

    classes: [
      {
        title: "B Sınıfı",
        description: "3,5 tona kadar otomobil",
      },
      {
        title: "AM, A1, A2, A Sınıfları",
        description: "Motosiklet ve scooter",
      },
      {
        title: "BE / B96 Sınıfı",
        description: "Römork ve ek kategoriler",
      },
      {
        title: "C / CE Sınıfları",
        description: "Kamyon ve ağır araçlar",
      },
      {
        title: "D / DE Sınıfları",
        description: "Otobüs ve yolcu taşımacılığı",
      },
      {
        title: "T / L Sınıfları",
        description: "Traktör ve tarım araçları",
      },
    ],

    allClasses: "Tüm Ehliyet Sınıflarını Gör",

    theoryTitle: "Teorik Eğitim – Esnek ve Dijital",

    theoryFeatures: [
      "Online teori dersleri",
      "Resmi sınav soruları",
      "Deneme testleri ve ilerleme takibi",
      "Teori sınavına hazırlık",
    ],

    practiceTitle: "Pratik Eğitim – Güvenli Başarı",

    practiceFeatures: [
      "Deneyimli eğitmenlerle sürüş dersleri",
      "Modern ve güvenli araçlar",
      "Bireysel destek",
      "Pratik sınav hazırlığı",
    ],

    learnMore: "Daha Fazla Bilgi",

    partnersTitle:
      "Ortaklarımız ve Yetkili Kurumlar",

    partnersDescription:
      "Sınav ve ruhsatlandırma işlemleriyle ilgili kurumlar.",

    stepsTitle: "Nasıl Çalışır",
    stepsSubtitle:
      "Ehliyetinize birkaç adımda ulaşın.",

    steps: [
      {
        title: "Ülke ve Sınıf Seçin",
        description: "Uygun eğitimi bulun",
      },
      {
        title: "Hesap Oluşturun",
        description: "Kaydolun ve başvurun",
      },
      {
        title: "Teori ve Pratik",
        description: "Eğitiminizi tamamlayın",
      },
      {
        title: "Sınav ve Ehliyet",
        description: "Sınava girin ve ehliyetinizi alın",
      },
    ],
  },

  es: {
    fastLicence: "Obtén tu permiso de conducir en menos de 21 días",
    eyebrow:
      "Tu autoescuela en Alemania, Austria, Bélgica, Italia y España",

    heroTitle:
      "Tu camino hacia el permiso de conducir empieza aquí.",

    heroDescription:
      "Teoría, práctica, solicitudes y acompañamiento en trámites oficiales, todo con Fahrschule TAYM.",

    apply: "Solicitar Permiso",
    discoverClasses: "Descubrir Clases de Permiso",

    quickServices: [
      "Teoría y Formación Online",
      "Formación Práctica",
      "Solicitud y Tramitación",
      "Canje de Permisos Extranjeros",
      "Citas Flexibles",
      "Atención Personalizada",
    ],

    countriesTitle: "Nuestros Países",
    countriesDescription:
      "Formación vial y servicios en varios países.",

    countries: [
      {
        name: "Alemania",
        description: "Todas las clases y servicios",
      },
      {
        name: "Austria",
        description: "Permisos y canjes",
      },
      {
        name: "Bélgica",
        description: "Formación, exámenes y asistencia",
      },
      {
        name: "Italia",
        description: "Permisos, teoría y práctica",
      },
      {
        name: "España",
        description: "Permisos, canje y reconocimiento",
      },
    ],

    classesTitle: "Nuestras Clases de Permiso",
    classesDescription:
      "Las principales categorías con formación moderna y preparación para los exámenes.",

    classes: [
      {
        title: "Clase B",
        description: "Automóviles hasta 3,5 t",
      },
      {
        title: "Clases AM, A1, A2, A",
        description: "Motocicletas y scooters",
      },
      {
        title: "Clase BE / B96",
        description: "Remolques y ampliaciones",
      },
      {
        title: "Clases C / CE",
        description: "Camiones y vehículos pesados",
      },
      {
        title: "Clases D / DE",
        description: "Autobuses y pasajeros",
      },
      {
        title: "Clases T / L",
        description: "Tractores y vehículos agrícolas",
      },
    ],

    allClasses: "Ver Todas las Clases",

    theoryTitle: "Formación Teórica – Flexible y Digital",

    theoryFeatures: [
      "Cursos teóricos online",
      "Preguntas oficiales de examen",
      "Pruebas y seguimiento del progreso",
      "Preparación para el examen teórico",
    ],

    practiceTitle:
      "Formación Práctica – Seguridad y Éxito",

    practiceFeatures: [
      "Clases con instructores experimentados",
      "Vehículos modernos y seguros",
      "Atención individual",
      "Preparación para el examen práctico",
    ],

    learnMore: "Más Información",

    partnersTitle:
      "Nuestros Socios y Organismos Competentes",

    partnersDescription:
      "Organismos de examen y expedición de permisos.",

    stepsTitle: "Así de Fácil Funciona",
    stepsSubtitle:
      "Tu permiso en unos pocos pasos.",

    steps: [
      {
        title: "Elegir País y Clase",
        description: "Encontrar la formación adecuada",
      },
      {
        title: "Crear una Cuenta",
        description: "Registrarse e iniciar la solicitud",
      },
      {
        title: "Teoría y Práctica",
        description: "Completar la formación",
      },
      {
        title: "Examen y Permiso",
        description: "Realizar el examen y obtener el permiso",
      },
    ],
  },
};

/* =========================================================
   DONNÉES VISUELLES
   ========================================================= */

const countryInfo = [
  {
    code: "DE",
    flag: "🇩🇪",
  },
  {
    code: "AT",
    flag: "🇦🇹",
  },
  {
    code: "BE",
    flag: "🇧🇪",
  },
  {
    code: "IT",
    flag: "🇮🇹",
  },
  {
    code: "ES",
    flag: "🇪🇸",
  },
] as const;

const quickServiceInfo = [
  {
    icon: GraduationCap,
    href: "/dashboard/application",
  },
  {
    icon: CarFront,
    href: "/dashboard/application",
  },
  {
    icon: ClipboardCheck,
    href: "/dashboard/application",
  },
  {
    icon: RefreshCw,
    href: "/services",
  },
  {
    icon: CalendarDays,
    href: "/services",
  },
  {
    icon: ShieldCheck,
    href: "/kontakt",
  },
] as const;

const licenceInfo = [
  {
    image: "/images/classe-b.jpg",
    href: "/fuehrerscheinklassen",
  },
  {
    image: "/images/classe-moto.jpg",
    href: "/fuehrerscheinklassen",
  },
  {
    image: "/images/classe-be.jpg",
    href: "/fuehrerscheinklassen",
  },
  {
    image: "/images/classe-t.jpg",
    href: "/fuehrerscheinklassen",
  },
  {
    image: "/images/classe-d.jpg",
    href: "/fuehrerscheinklassen",
  },
  {
    image: "/images/classe-c.jpg",
    href: "/fuehrerscheinklassen",
  },
] as const;

/*
 * Logos présents dans public/partners.
 * Leurs noms correspondent aux fichiers
 * préparés précédemment.
 *
 * "Führerscheinstellen" est une désignation
 * générique des services compétents.
 */

const organizations = [
  {
    name: "DEKRA",
    image: "/partners/dekra.png",
    description: "Prüfung & Sicherheit",
  },
  {
    name: "TÜV SÜD",
    image: "/partners/tuv-sud.png",
    description: "Prüfung & Zertifizierung",
  },
  {
    name: "KBA",
    image: "/partners/kba.png",
    description: "Kraftfahrt-Bundesamt",
  },
  {
    name: "DGT",
    image: "/partners/dgt.png",
    description: "Dirección General de Tráfico",
  },
  {
    name: "Führerscheinstellen",
    image: "/partners/fuehrerscheinstellen.png",
    description: "Behördliche Abwicklung",
  },
] as const;

/* =========================================================
   FONCTIONS MULTILINGUES
   ========================================================= */

function getPathLocale(pathname: string): Locale | null {
  const firstSegment = pathname.split("/")[1];

  if (firstSegment && isLocale(firstSegment)) {
    return firstSegment;
  }

  return null;
}

function readLocale(pathname: string): Locale {
  const fromPath = getPathLocale(pathname);

  if (fromPath) return fromPath;

  if (typeof document === "undefined") {
    return defaultLocale;
  }

  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith("taym-locale="));

  if (cookie) {
    const value = cookie.slice("taym-locale=".length);

    if (isLocale(value)) {
      return value;
    }
  }

  const htmlLocale = document.documentElement.lang
    .toLowerCase()
    .split("-")[0];

  if (isLocale(htmlLocale)) {
    return htmlLocale;
  }

  return defaultLocale;
}

/* =========================================================
   COMPOSANT PRINCIPAL
   ========================================================= */

export default function HomePage() {
  const pathname = usePathname() || "/";

  const [locale, setLocale] =
    useState<Locale>(defaultLocale);

  const pathLocale = getPathLocale(pathname);

  const activeLocale = pathLocale ?? locale;
  const t = translations[activeLocale];

  const isRTL = activeLocale === "ar";

  useEffect(() => {
    const timer = window.setTimeout(() => setLocale(readLocale(pathname)), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    const handleLanguage = (event: Event) => {
      const customEvent = event as CustomEvent<Locale>;

      if (isLocale(customEvent.detail)) {
        setLocale(customEvent.detail);
      }
    };

    window.addEventListener(
      "taym:language-change",
      handleLanguage
    );

    return () => {
      window.removeEventListener(
        "taym:language-change",
        handleLanguage
      );
    };
  }, []);

  function href(path: string): string {
    if (!pathLocale) return path;

    if (path === "/") {
      return `/${pathLocale}`;
    }

    return `/${pathLocale}${path}`;
  }

  return (
    <div
      lang={activeLocale}
      dir={isRTL ? "rtl" : "ltr"}
      className="w-full min-w-0 overflow-x-clip bg-[#f8f9f7] text-[#111820]"
    >
      {/* ==================================================
          1. COUVERTURE PRINCIPALE
          ================================================== */}

      <section
        className="relative isolate w-full overflow-hidden bg-[#c7e97b]"
        aria-labelledby="taym-home-title"
      >
        {/* Image PC */}

        <div className="absolute inset-0 hidden md:block">
          <Image
            src="/images/couverture.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />

          <div
            className={`absolute inset-0 ${
              isRTL
                ? "bg-linear-to-l"
                : "bg-linear-to-r"
            } from-[#b6e455]/80 via-[#c9ea80]/35 to-transparent`}
          />
        </div>

        {/* Image mobile */}

        <div className="absolute inset-0 md:hidden">
          <Image
            src="/images/couverturea.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />

          <div
            className={`absolute inset-0 ${
              isRTL
                ? "bg-linear-to-l"
                : "bg-linear-to-r"
            } from-[#b8e55d]/65 via-[#d4ed9e]/25 to-transparent`}
          />
        </div>

        <div className="taym-container relative z-10">
          <div className="flex min-h-77.5 w-full flex-col justify-center py-7 md:min-h-88.75 md:py-9 lg:min-h-91.25">
            <div className="max-w-125 md:w-[51%]">
              {/* Texte supérieur */}

              <span className="inline-block max-w-full rounded-full border border-white/60 bg-white/75 px-3 py-1.5 text-xs leading-[1.35] font-semibold text-[#1c2718] shadow-sm backdrop-blur-sm sm:text-xs">
                {t.eyebrow}
              </span>

              {/* Titre */}

              <h1
                id="taym-home-title"
                className="mt-3 max-w-102.5 text-[30px] leading-[1.04] font-black tracking-[-0.045em] text-[#111820] sm:text-[36px] md:text-[39px] lg:text-[45px]"
              >
                {t.heroTitle}
              </h1>

              {/* Description */}

              <p className="mt-3 max-w-92.5 text-[12px] leading-[1.45] font-medium text-[#172019] sm:text-[13px] md:text-[14px]">
                {t.heroDescription}
              </p>

              {/* Boutons PC */}

              <div className="mt-5 hidden flex-wrap items-center gap-3 md:flex">
                <Link
                  href={href("/dashboard/application")}
                  className="inline-flex min-h-10.75 items-center justify-center gap-2 rounded-xl bg-linear-to-b from-[#83c817] to-[#397900] px-5 py-2.5 text-[12px] font-bold text-white shadow-[0_4px_12px_rgba(50,100,0,0.24)] transition hover:brightness-110"
                >
                  <CarFront size={18} />
                  <span>{t.apply}</span>
                  <ChevronRight size={17} />
                </Link>

                <Link
                  href={href("/fuehrerscheinklassen")}
                  className="inline-flex min-h-10.75 items-center justify-center gap-2 rounded-xl border border-[#dce4d3] bg-white/95 px-5 py-2.5 text-[12px] font-bold text-[#172019] shadow-sm transition hover:bg-[#f1f7e7]"
                >
                  <Grid2X2
                    size={17}
                    className="text-[#397900]"
                  />
                  <span>{t.discoverClasses}</span>
                </Link>
              </div>
            </div>

            {/* Boutons mobile */}

            <div className="mt-5 grid w-full gap-2 md:hidden">
              <Link
                href={href("/dashboard/application")}
                className="flex min-h-10.5 items-center justify-center gap-2 rounded-[11px] border border-[#d3f283] bg-linear-to-b from-[#83c817] to-[#397900] px-3 py-2 text-center text-[12px] font-bold text-white shadow-[0_3px_8px_rgba(34,80,0,0.25)]"
              >
                <CarFront size={17} />
                <span>{t.apply}</span>
                <ChevronRight size={16} />
              </Link>

              <Link
                href={href("/fuehrerscheinklassen")}
                className="flex min-h-10.5 items-center justify-center gap-2 rounded-[11px] border border-[#d7dfcb] bg-white/95 px-3 py-2 text-center text-[12px] font-bold text-[#172019] shadow-sm"
              >
                <Grid2X2
                  size={17}
                  className="text-[#397900]"
                />
                <span>{t.discoverClasses}</span>
                <ChevronRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section aria-label={t.fastLicence} className="border-b border-[#dce9cc] bg-[#f1f8e7] py-4 md:py-5">
        <div className="taym-container">
          <div className="flex items-center justify-center gap-3 text-center text-[#244b06]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d9edb3]" aria-hidden="true">
              <CalendarDays size={21} />
            </span>
            <h2 className="text-base font-extrabold leading-snug sm:text-lg md:text-xl">{t.fastLicence}</h2>
          </div>
        </div>
      </section>

      {/* ==================================================
          2. SERVICES RAPIDES
          PC : 6 / MOBILE : 4
          ================================================== */}

      <section className="border-b border-[#e6e9e3] bg-white">
        <div className="taym-container">
          <div className="grid grid-cols-4 items-stretch gap-0 py-1 md:grid-cols-6 md:gap-2 md:py-2">
            {quickServiceInfo.map((item, index) => {
              const Icon = item.icon;

              return (
                <Link
                  key={`${item.href}-${index}`}
                  href={href(item.href)}
                  className={`group flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-center transition hover:text-[#397900] ${
                    index >= 4 ? "hidden md:flex" : "flex"
                  }`}
                >
                  <Icon
                    className="h-5.75 w-5.75 text-[#111820] transition group-hover:text-[#397900] md:h-7 md:w-7"
                    strokeWidth={1.8}
                  />

                  <span className="max-w-40 text-xs leading-tight font-semibold text-[#202521] sm:text-xs md:text-xs">
                    {t.quickServices[index]}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================================================
          3. NOS CINQ PAYS
          ================================================== */}

      <section className="border-b border-[#e6e9e3] bg-[#f6f7f6] py-2 md:py-3">
        <div className="taym-container">
          <div className="grid gap-3 md:grid-cols-[175px_minmax(0,1fr)] md:items-center lg:grid-cols-[205px_minmax(0,1fr)]">
            {/* Introduction */}

            <div>
              <h2 className="text-[19px] leading-tight font-extrabold tracking-tight md:text-[21px]">
                {t.countriesTitle}
              </h2>

              <span className="mt-1 block h-0.75 w-12 rounded-full bg-[#79b912]" />

              <p className="mt-2 hidden max-w-47.5 text-[12px] leading-[1.4] text-[#344034] md:block">
                {t.countriesDescription}
              </p>
            </div>

            {/* Cartes pays */}

            <div className="grid grid-cols-5 gap-1.5 md:gap-2.5">
              {countryInfo.map((item, index) => (
                <Link
                  key={item.code}
                  href={href("/fuehrerscheinklassen")}
                  className="group relative flex min-w-0 flex-col items-center justify-between rounded-[10px] border border-[#e2e6e0] bg-white px-1.5 py-2.5 text-center shadow-[0_2px_6px_rgba(0,0,0,0.08)] transition hover:-translate-y-0.5 hover:border-[#9bcc60] hover:shadow-md md:min-h-22.5 md:flex-row md:items-center md:gap-2 md:px-3 md:text-start"
                >
                  <span
                    className="block shrink-0 text-[25px] leading-none sm:text-[29px] md:text-[34px]"
                    aria-hidden="true"
                  >
                    {item.flag}
                  </span>

                  <div className="min-w-0 flex-1">
                    <h3 className="mt-2 wrap-break-word text-xs leading-[1.15] font-extrabold sm:text-xs md:mt-0 md:text-[12px]">
                      {t.countries[index].name}
                    </h3>

                    <p className="mt-1 hidden text-xs leading-tight text-[#404a41] md:block">
                      {t.countries[index].description}
                    </p>
                  </div>

                  <span className="mt-2 flex h-4.25 w-4.25 shrink-0 items-center justify-center rounded-full bg-linear-to-b from-[#a5dc29] to-[#4c9603] text-white md:mt-0 md:self-end">
                    <ArrowRight size={11} strokeWidth={2.5} />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================
          4. CATÉGORIES DE PERMIS
          ================================================== */}

      <section className="bg-white py-3 md:py-5">
        <div className="taym-container">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-[#e2e8dd] bg-[#f1f8e7] md:grid md:grid-cols-2 md:items-center">
            <Image
              src="/images/centre.png"
              alt={centreCopy[activeLocale].alt}
              width={1448}
              height={1086}
              sizes="(max-width: 767px) 100vw, 512px"
              className="block h-auto w-full"
            />
            <div className="hidden px-8 py-6 md:block lg:px-12">
              <h2 className="text-2xl font-extrabold leading-tight text-[#172019] lg:text-3xl">
                {centreCopy[activeLocale].title}
              </h2>
              <span className="mt-3 block h-1 w-12 rounded-full bg-[#79b912]" />
              <p className="mt-4 text-sm leading-relaxed text-[#485147]">
                {centreCopy[activeLocale].description}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-2 md:py-3">
        <div className="taym-container">
          {/* Titre */}

          <div className="mb-2 text-center">
            <h2 className="text-[20px] leading-tight font-black tracking-tight md:text-[25px]">
              {t.classesTitle}
            </h2>

            <span className="mx-auto mt-1.5 block h-0.75 w-14 rounded-full bg-[#7fbf16]" />

            <p className="mx-auto mt-2 hidden max-w-190 text-xs leading-normal text-[#485147] md:block">
              {t.classesDescription}
            </p>
          </div>

          {/* Cartes catégories */}

          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 md:grid md:grid-cols-6 md:overflow-visible md:pb-0">
            {licenceInfo.map((item, index) => (
              <Link
                key={item.image}
                href={href(item.href)}
                className="group relative flex w-[min(46%,190px)] shrink-0 snap-start flex-col overflow-hidden rounded-[11px] border border-[#e3e7e1] bg-white p-2 shadow-[0_2px_7px_rgba(0,0,0,0.08)] transition hover:border-[#a9ce79] hover:shadow-md md:w-auto md:min-w-0 md:p-2.5"
              >
                <div className="relative h-18.75 w-full sm:h-25 md:h-26.25 lg:h-30">
                  <Image
                    src={item.image}
                    alt={t.classes[index].title}
                    fill
                    sizes="(max-width: 768px) 33vw, 16vw"
                    className="object-contain object-center transition duration-200 group-hover:scale-[1.03]"
                  />
                </div>

                <div className="mt-1 min-w-0 flex-1 pb-5">
                  <h3 className="text-xs leading-[1.2] font-extrabold sm:text-xs md:text-[12px]">
                    {t.classes[index].title}
                  </h3>

                  <p className="mt-1 text-xs leading-[1.3] text-[#434d42] md:text-xs">
                    {t.classes[index].description}
                  </p>
                </div>

                <span
                  className={`absolute bottom-2 flex h-4.75 w-4.75 items-center justify-center rounded-full bg-linear-to-b from-[#a5dc29] to-[#509600] text-white ${
                    isRTL ? "left-2" : "right-2"
                  }`}
                >
                  <ArrowRight size={12} strokeWidth={2.5} />
                </span>
              </Link>
            ))}
          </div>

          {/* Bouton catégories */}

          <div className="mt-2 flex justify-center">
            <Link
              href={href("/fuehrerscheinklassen")}
              className="inline-flex min-h-9.5 w-full max-w-77.5 items-center justify-center gap-2 rounded-[11px] border border-[#80b847] bg-white px-5 py-2 text-xs font-bold text-[#182219] shadow-[0_1px_5px_rgba(0,0,0,0.08)] transition hover:bg-[#f1f8e8] md:w-auto md:min-w-72.5"
            >
              <Grid2X2
                size={15}
                className="text-[#4c9603]"
              />

              <span>{t.allClasses}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ==================================================
          5. FORMATION THÉORIQUE ET PRATIQUE
          ================================================== */}

      <OffersCarousel />

      <section className="hidden bg-[#f9faf8] py-2 md:block md:py-3">
        <div className="taym-container">
          <div className="grid gap-3 lg:grid-cols-2">
            {/* Formation théorique */}

            <article className="grid min-h-48.75 overflow-hidden rounded-xl border border-[#e2e7df] bg-white shadow-[0_2px_7px_rgba(0,0,0,0.07)] sm:grid-cols-[45%_55%]">
              <div className="relative min-h-40 sm:min-h-full">
                <Image
                  src="/images/imageb.jpg"
                  alt={t.theoryTitle}
                  fill
                  sizes="(max-width: 640px) 100vw, 45vw"
                  className="object-cover object-center"
                />
              </div>

              <div className="flex flex-col justify-center p-4">
                <h2 className="text-[14px] leading-tight font-extrabold md:text-[16px]">
                  {t.theoryTitle}
                </h2>

                <ul className="mt-3 space-y-1.5">
                  {t.theoryFeatures.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-xs leading-[1.35] text-[#263127]"
                    >
                      <span className="mt-px flex h-3.25 w-3.25 shrink-0 items-center justify-center rounded-full bg-[#80c116] text-white">
                        <Check size={10} strokeWidth={3} />
                      </span>

                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={href("/dashboard/application")}
                  className="mt-4 inline-flex min-h-7.75 w-fit items-center justify-center gap-2 rounded-full bg-linear-to-b from-[#8ac91e] to-[#478900] px-5 py-1.5 text-xs font-bold text-white transition hover:brightness-110"
                >
                  {t.learnMore}
                  <ChevronRight size={13} />
                </Link>
              </div>
            </article>

            {/* Formation pratique */}

            <article className="grid min-h-48.75 overflow-hidden rounded-xl border border-[#e2e7df] bg-white shadow-[0_2px_7px_rgba(0,0,0,0.07)] sm:grid-cols-[45%_55%]">
              <div className="relative min-h-40 sm:min-h-full">
                <Image
                  src="/images/imagea.jpg"
                  alt={t.practiceTitle}
                  fill
                  sizes="(max-width: 640px) 100vw, 45vw"
                  className="object-cover object-center"
                />
              </div>

              <div className="flex flex-col justify-center p-4">
                <h2 className="text-[14px] leading-tight font-extrabold md:text-[16px]">
                  {t.practiceTitle}
                </h2>

                <ul className="mt-3 space-y-1.5">
                  {t.practiceFeatures.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-xs leading-[1.35] text-[#263127]"
                    >
                      <span className="mt-px flex h-3.25 w-3.25 shrink-0 items-center justify-center rounded-full bg-[#80c116] text-white">
                        <Check size={10} strokeWidth={3} />
                      </span>

                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={href("/dashboard/application")}
                  className="mt-4 inline-flex min-h-7.75 w-fit items-center justify-center gap-2 rounded-full bg-linear-to-b from-[#8ac91e] to-[#478900] px-5 py-1.5 text-xs font-bold text-white transition hover:brightness-110"
                >
                  {t.learnMore}
                  <ChevronRight size={13} />
                </Link>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ==================================================
          6. PARTENAIRES ET ORGANISMES COMPÉTENTS
          ================================================== */}

      <section className="bg-white py-2 md:py-3">
        <div className="taym-container">
          <div className="grid gap-3 md:grid-cols-[175px_minmax(0,1fr)] md:items-center lg:grid-cols-[205px_minmax(0,1fr)]">
            {/* Introduction */}

            <div>
              <h2 className="text-[16px] leading-[1.2] font-extrabold tracking-[-0.02em] md:text-[18px]">
                {t.partnersTitle}
              </h2>

              <p className="mt-1.5 hidden text-xs leading-[1.4] text-[#505950] md:block">
                {t.partnersDescription}
              </p>
            </div>

            {/* Logos */}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 md:gap-2.5">
              {organizations.map((organization) => (
                <div
                  key={organization.name}
                  className="flex min-w-0 flex-col items-center justify-center rounded-[10px] border border-[#e5e9e2] bg-white px-1.5 py-2 shadow-[0_1px_5px_rgba(0,0,0,0.07)] md:min-h-18.5 md:px-3"
                >
                  <div className="relative h-14 w-full md:h-12">
                    <Image
                      src={organization.image}
                      alt={organization.name}
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 16vw"
                      className="object-contain object-center"
                    />
                  </div>

                  <span className="mt-2 text-center text-xs leading-snug text-[#525c53]">
                    {organization.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================
          7. COMMENT ÇA FONCTIONNE
          ================================================== */}

      <section className="border-t border-[#8ac521] bg-linear-to-r from-[#437d05] via-[#70ae0a] to-[#94cc22] py-3 md:py-4">
        <div className="taym-container">
          <div className="grid items-center gap-3 md:grid-cols-[205px_minmax(0,1fr)]">
            {/* Titre */}

            <div className="text-white">
              <h2 className="text-[17px] leading-[1.15] font-extrabold md:text-[19px]">
                {t.stepsTitle}
              </h2>

              <p className="mt-1 text-xs leading-[1.3] text-white/90">
                {t.stepsSubtitle}
              </p>
            </div>

            {/* Étapes */}

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {t.steps.map((step, index) => (
                <div
                  key={index}
                  className="flex min-w-0 items-center gap-2 rounded-[10px] bg-white px-2.5 py-2.5 shadow-[0_2px_7px_rgba(0,0,0,0.09)]"
                >
                  <span className="flex h-6.75 w-6.75 shrink-0 items-center justify-center rounded-full bg-linear-to-b from-[#9bd62b] to-[#4a8906] text-[12px] font-black text-white">
                    {index + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs leading-[1.2] font-extrabold text-[#172019] md:text-xs">
                      {step.title}
                    </h3>

                    <p className="mt-1 text-xs leading-[1.3] text-[#515a51]">
                      {step.description}
                    </p>
                  </div>

                  {index < 3 && (
                    <ArrowRight
                      size={13}
                      className="hidden shrink-0 text-[#6ea813] lg:block"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
