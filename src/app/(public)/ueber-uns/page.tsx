
"use client";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import Image from "next/image";
import Link from "next/link";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CarFront,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FileText,
  GraduationCap,
  HeartHandshake,
  Info,
  Languages,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Gauge,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  SERVICES_CONTACT,
  SERVICES_LINKS,
} from "@/config/services";

/* ============================================================
   FAHRSCHULE TAYM
   ABOUT US — ÜBER UNS

   Route:
   /ueber-uns

   Languages:
   de | ar | tr | es

   Responsive:
   Mobile | Tablet | Desktop

   Existing public layout:
   Header | Navigation | Footer

   No new layout.
   No new navigation.
   No duplicate pricing.
   ============================================================ */

/* ============================================================
   1. TYPES
   ============================================================ */

type Locale = "de" | "ar" | "tr" | "es";

type Localized = Record<Locale, string>;

type LocalizedList = Record<
  Locale,
  string[]
>;

type ImageKey =
  | "hero"
  | "founder"
  | "classroom"
  | "vehicle"
  | "theory"
  | "office";

type DetailId =
  | "bf17"
  | "b197"
  | "classB"
  | "b96"
  | "classBE"
  | "conversion"
  | "registration"
  | "adac"
  | "app"
  | "theory";

type Detail = {
  id: DetailId;
  title: Localized;
  intro: Localized;
  points: LocalizedList;
  note?: Localized;
  reference?: string;
};

type Benefit = {
  icon: LucideIcon;
  title: Localized;
  description: Localized;
};

/* ============================================================
   2. CONTACTS & ROUTES

   Reuse central project configuration.
   ============================================================ */

const ROUTES = {
  home: SERVICES_LINKS.home,
  services: SERVICES_LINKS.services,
  categories: SERVICES_LINKS.categories,
  application: SERVICES_LINKS.application,
  register: SERVICES_LINKS.register,
  login: SERVICES_LINKS.login,
};

const CONTACT = SERVICES_CONTACT;

/* ============================================================
   3. LOCAL IMAGES

   Existing local photographs illustrate the school.
   The founder section uses a general school image,
   not an attributed portrait.
   ============================================================ */

const ABOUT_IMAGES: Record<
  ImageKey,
  string | null
> = {
  hero: "/images/imagea.jpg",
  founder: "/images/imageb.jpg",
  classroom: "/images/imageb.jpg",
  vehicle: "/images/imagea.jpg",
  theory: "/images/imageb.jpg",
  office: "/images/imageb.jpg",
};

function safeImage(
  value: string | null
): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("..") ||
    value.includes("\\") ||
    value.includes("%") ||
    !/^\/[a-zA-Z0-9/_\-.]+$/.test(value) ||
    !/\.(jpg|jpeg|png|webp|avif)$/i.test(
      value
    )
  ) {
    return null;
  }

  return value;
}

/* ============================================================
   4. INTERFACE TRANSLATIONS
   ============================================================ */

const UI = {
  de: {
    eyebrow: "ÜBER UNS",
    title: "Fahrschule TAYM",
    headline:
      "Dein Weg zum Führerschein. Sicher, persönlich und modern.",
    intro:
      "Seit 2022 steht Fahrschule TAYM in Berlin-Reinickendorf für eine moderne Fahrausbildung mit Geduld, Erfahrung und persönlicher Betreuung.",
    founderTitle:
      "Lerne Ahmad Mostafa kennen",
    founderRole:
      "Fahrlehrer seit 2017 · Inhaber seit 2022",
    founderQuote:
      "Mit Erfahrung, Geduld und Motivation begleiten wir dich auf deinem Weg zum Führerschein.",
    founderP1:
      "Mein Name ist Ahmad Mostafa. Ich bin seit 2017 Fahrlehrer und seit 2022 Inhaber der Fahrschule TAYM.",
    founderP2:
      "Wir sind eine moderne, junge Fahrschule in Berlin-Reinickendorf. Unser Ziel ist eine hochwertige theoretische und praktische Ausbildung mit modernen Methoden.",
    founderP3:
      "Uns ist wichtig, dass du sicher, verantwortungsvoll und aufmerksam Auto fährst. Deshalb nehmen wir uns Zeit für deine Fragen und deine persönliche Entwicklung.",
    founderP4:
      "Unsere Unterrichtsräume sind auf abwechslungsreiches Lernen ausgerichtet. Die praktischen Fahrstunden finden in modern ausgestatteten Fahrzeugen statt.",
    benefitsTitle:
      "Was uns besonders macht",
    benefitsSubtitle:
      "Persönliche Ausbildung und moderne Lernmethoden stehen bei uns im Mittelpunkt.",
    offersTitle:
      "Unsere Dienstleistungen",
    offersSubtitle:
      "Entdecke unsere Leistungen für Fahrschüler in Berlin.",
    detailsTitle:
      "Alle wichtigen Informationen",
    detailsSubtitle:
      "Hier findest du Einzelheiten zu unseren Ausbildungswegen, Angeboten und Antragsverfahren in Deutschland.",
    learningTitle:
      "Moderne Ausbildung. Persönlich begleitet.",
    learningIntro:
      "Theorie und Praxis ergänzen sich bei uns. Wir unterstützen dich mit verständlichem Unterricht und einer strukturierten Vorbereitung.",
    classroom:
      "Moderne Unterrichtsräume",
    classroomText:
      "Abwechslungsreicher Theorieunterricht mit aktuellen Lernmedien und verständlichen Erklärungen.",
    vehicle:
      "Praxisnahes Fahrtraining",
    vehicleText:
      "Fahrstunden in modern ausgestatteten Fahrzeugen, abgestimmt auf den individuellen Lernfortschritt.",
    processTitle:
      "So startest du bei uns",
    contactTitle:
      "Wir freuen uns auf dich!",
    contactIntro:
      "Du möchtest deinen Führerschein beginnen oder hast Fragen? Wir helfen dir bei den nächsten Schritten.",
    apply: "Führerschein beantragen",
    categories: "Führerscheinklassen",
    contact: "Kontakt aufnehmen",
    call: "Jetzt anrufen",
    email: "E-Mail schreiben",
    readMore: "Details ansehen",
    close: "Weniger anzeigen",
    requirements: "Voraussetzungen und Informationen",
    reference: "Amtliche Informationen",
    germanyOnly:
      "Die folgenden Regelungen und Angebote beziehen sich auf Deutschland. Für andere Länder gelten die jeweiligen nationalen Vorschriften.",
    legal:
      "Die Erteilung einer Fahrerlaubnis erfolgt ausschließlich durch die zuständige Behörde nach Erfüllung der gesetzlichen Voraussetzungen. Ausbildung und Anmeldung ersetzen keine vorgeschriebenen Prüfungen.",
    specialOffer:
      "Angebot und Teilnahmebedingungen bitte vor der Anmeldung erfragen.",
    ageDisclaimer:
      "Altersgrenzen, Nachweise und Ausnahmen sind vom Einzelfall abhängig.",
    year2017: "Seit 2017 Fahrlehrer",
    year2022: "Seit 2022 Inhaber",
    berlin: "Berlin-Reinickendorf",
    steps: [
      "Kontakt aufnehmen oder registrieren",
      "Führerscheinklasse auswählen",
      "Unterlagen vorbereiten",
      "Ausbildung und Prüfungsvorbereitung",
    ],
  },

  ar: {
    eyebrow: "من نحن",
    title: "مدرسة TAYM لتعليم القيادة",
    headline:
      "طريقك إلى رخصة القيادة. بأمان واهتمام وتدريب حديث.",
    intro:
      "منذ عام 2022 تقدم مدرسة TAYM في برلين راينيكندورف تدريباً حديثاً على القيادة يتميز بالخبرة والصبر والمتابعة الشخصية.",
    founderTitle:
      "تعرف على أحمد مصطفى",
    founderRole:
      "مدرب قيادة منذ 2017 · مدير المدرسة منذ 2022",
    founderQuote:
      "نرافقك بالخبرة والصبر والتحفيز في رحلتك للحصول على رخصة القيادة.",
    founderP1:
      "اسمي أحمد مصطفى. أعمل مدرباً للقيادة منذ عام 2017، وأدير مدرسة TAYM منذ عام 2022.",
    founderP2:
      "نحن مدرسة حديثة لتعليم القيادة في برلين راينيكندورف، وهدفنا تقديم تدريب نظري وعملي عالي الجودة باستخدام أساليب حديثة.",
    founderP3:
      "نهتم بأن تصبح سائقاً آمناً ومسؤولاً ومنتبهاً على الطريق، ولذلك نخصص الوقت للإجابة عن أسئلتك ومتابعة تقدمك.",
    founderP4:
      "قاعاتنا مجهزة لتعليم متنوع، وتتم الدروس العملية باستخدام سيارات حديثة التجهيز.",
    benefitsTitle:
      "ما الذي يميزنا؟",
    benefitsSubtitle:
      "نعتمد على التدريب الشخصي وأساليب التعلم الحديثة.",
    offersTitle:
      "خدماتنا",
    offersSubtitle:
      "اكتشف خدماتنا للمتدربين في برلين.",
    detailsTitle:
      "معلومات تفصيلية مهمة",
    detailsSubtitle:
      "تعرف على برامج التدريب والعروض وإجراءات الطلب المعمول بها في ألمانيا.",
    learningTitle:
      "تعليم حديث ومتابعة شخصية",
    learningIntro:
      "نجمع بين التدريب النظري والعملي ونساعدك على الاستعداد من خلال شرح واضح وخطة منظمة.",
    classroom:
      "قاعات تعليم حديثة",
    classroomText:
      "دروس نظرية باستخدام وسائل تعليم حديثة وشرح مبسط.",
    vehicle:
      "تدريب عملي على القيادة",
    vehicleText:
      "دروس قيادة بسيارات حديثة مجهزة حسب تقدم كل متدرب.",
    processTitle:
      "كيف تبدأ معنا؟",
    contactTitle:
      "يسعدنا التواصل معك!",
    contactIntro:
      "هل تريد بدء تعلم القيادة أو لديك أسئلة؟ فريقنا يساعدك في الخطوات التالية.",
    apply:
      "تقديم طلب رخصة القيادة",
    categories:
      "فئات رخص القيادة",
    contact:
      "تواصل معنا",
    call:
      "اتصل الآن",
    email:
      "إرسال بريد إلكتروني",
    readMore:
      "عرض التفاصيل",
    close:
      "إخفاء التفاصيل",
    requirements:
      "الشروط والمعلومات",
    reference:
      "المعلومات الرسمية",
    germanyOnly:
      "الشروط والعروض التالية تخص ألمانيا. وتطبق في الدول الأخرى اللوائح الوطنية الخاصة بها.",
    legal:
      "تصدر رخصة القيادة حصرياً من الجهات المختصة بعد استيفاء الشروط القانونية. التدريب والتسجيل لا يحلان محل الاختبارات الإلزامية.",
    specialOffer:
      "يرجى الاستفسار عن توفر العرض وشروط الاشتراك قبل التسجيل.",
    ageDisclaimer:
      "تختلف شروط العمر والوثائق والاستثناءات حسب حالة المتقدم.",
    year2017:
      "مدرب قيادة منذ 2017",
    year2022:
      "مدير المدرسة منذ 2022",
    berlin:
      "برلين - راينيكندورف",
    steps: [
      "التواصل أو إنشاء حساب",
      "اختيار فئة رخصة القيادة",
      "تجهيز المستندات",
      "التدريب والاستعداد للاختبارات",
    ],
  },

  tr: {
    eyebrow: "HAKKIMIZDA",
    title: "Fahrschule TAYM",
    headline:
      "Ehliyete giden yolunuz. Güvenli, kişisel ve modern.",
    intro:
      "Fahrschule TAYM, 2022 yılından beri Berlin-Reinickendorf'ta deneyimli, sabırlı ve kişisel destek sunan modern sürücü eğitimi vermektedir.",
    founderTitle:
      "Ahmad Mostafa ile tanışın",
    founderRole:
      "2017'den beri sürüş eğitmeni · 2022'den beri işletme sahibi",
    founderQuote:
      "Deneyim, sabır ve motivasyonla ehliyet yolculuğunuzda yanınızdayız.",
    founderP1:
      "Ben Ahmad Mostafa. 2017 yılından beri sürüş eğitmeniyim ve 2022 yılından beri Fahrschule TAYM'ın sahibiyim.",
    founderP2:
      "Berlin-Reinickendorf'ta modern ve genç bir sürücü kursuyuz. Amacımız güncel yöntemlerle kaliteli teorik ve pratik eğitim sunmaktır.",
    founderP3:
      "Güvenli, sorumlu ve dikkatli araç kullanmanız bizim için önemlidir. Sorularınız ve kişisel gelişiminiz için zaman ayırıyoruz.",
    founderP4:
      "Dersliklerimiz çeşitli öğrenme yöntemleri için donatılmıştır. Sürüş dersleri modern araçlarla yapılır.",
    benefitsTitle:
      "Bizi farklı kılan nedir?",
    benefitsSubtitle:
      "Kişisel eğitim ve modern öğrenme yöntemleri önceliğimizdir.",
    offersTitle:
      "Hizmetlerimiz",
    offersSubtitle:
      "Berlin'deki kursiyerlerimiz için sunduğumuz hizmetler.",
    detailsTitle:
      "Önemli ayrıntılar",
    detailsSubtitle:
      "Almanya'daki eğitim seçenekleri, teklifler ve başvuru işlemleri hakkında bilgi alın.",
    learningTitle:
      "Modern eğitim, kişisel destek",
    learningIntro:
      "Teorik ve pratik eğitimi birleştiriyor; anlaşılır dersler ve planlı hazırlıkla sizi destekliyoruz.",
    classroom:
      "Modern derslikler",
    classroomText:
      "Güncel öğrenme araçları ve anlaşılır açıklamalarla teorik eğitim.",
    vehicle:
      "Uygulamalı sürüş eğitimi",
    vehicleText:
      "Öğrencinin gelişimine uyarlanmış modern araçlarla sürüş dersleri.",
    processTitle:
      "Nasıl başlayabilirsiniz?",
    contactTitle:
      "Sizinle tanışmayı bekliyoruz!",
    contactIntro:
      "Ehliyet almak mı istiyorsunuz? Sorularınız ve sonraki adımlarınız için bize ulaşın.",
    apply:
      "Ehliyet başvurusu yap",
    categories:
      "Ehliyet sınıfları",
    contact:
      "İletişime geçin",
    call:
      "Şimdi arayın",
    email:
      "E-posta gönderin",
    readMore:
      "Ayrıntıları göster",
    close:
      "Ayrıntıları gizle",
    requirements:
      "Şartlar ve bilgiler",
    reference:
      "Resmî bilgiler",
    germanyOnly:
      "Aşağıdaki düzenlemeler ve teklifler Almanya içindir. Diğer ülkelerde ilgili ulusal kurallar geçerlidir.",
    legal:
      "Ehliyet yalnızca yasal şartlar karşılandıktan sonra yetkili makam tarafından verilir. Eğitim ve kayıt, zorunlu sınavların yerine geçmez.",
    specialOffer:
      "Kayıttan önce teklifin geçerliliğini ve katılım koşullarını öğrenin.",
    ageDisclaimer:
      "Yaş, belge ve istisna şartları kişisel duruma göre değişebilir.",
    year2017:
      "2017'den beri eğitmen",
    year2022:
      "2022'den beri işletme sahibi",
    berlin:
      "Berlin-Reinickendorf",
    steps: [
      "İletişime geçin veya kayıt olun",
      "Ehliyet sınıfını seçin",
      "Belgeleri hazırlayın",
      "Eğitim ve sınav hazırlığı",
    ],
  },

  es: {
    eyebrow: "SOBRE NOSOTROS",
    title: "Fahrschule TAYM",
    headline:
      "Su camino hacia el permiso. Seguro, personalizado y moderno.",
    intro:
      "Desde 2022, Fahrschule TAYM ofrece en Berlín-Reinickendorf formación moderna con experiencia, paciencia y atención personalizada.",
    founderTitle:
      "Conozca a Ahmad Mostafa",
    founderRole:
      "Profesor desde 2017 · Propietario desde 2022",
    founderQuote:
      "Le acompañamos con experiencia, paciencia y motivación en el camino hacia su permiso.",
    founderP1:
      "Me llamo Ahmad Mostafa. Soy profesor de conducción desde 2017 y propietario de Fahrschule TAYM desde 2022.",
    founderP2:
      "Somos una autoescuela joven y moderna de Berlín-Reinickendorf. Nuestro objetivo es ofrecer una enseñanza teórica y práctica de calidad con métodos actuales.",
    founderP3:
      "Nos importa que conduzca de forma segura, responsable y atenta. Por ello dedicamos tiempo a sus preguntas y a su progreso personal.",
    founderP4:
      "Nuestras aulas están preparadas para un aprendizaje variado, y las clases prácticas se realizan en vehículos modernos.",
    benefitsTitle:
      "¿Qué nos distingue?",
    benefitsSubtitle:
      "Priorizamos la formación personalizada y los métodos modernos.",
    offersTitle:
      "Nuestros servicios",
    offersSubtitle:
      "Descubra nuestros servicios para alumnos en Berlín.",
    detailsTitle:
      "Información importante",
    detailsSubtitle:
      "Consulte los programas de formación, las ofertas y los procedimientos de solicitud aplicables en Alemania.",
    learningTitle:
      "Formación moderna y atención personal",
    learningIntro:
      "Combinamos teoría y práctica con explicaciones claras y una preparación estructurada.",
    classroom:
      "Aulas modernas",
    classroomText:
      "Clases teóricas con medios actuales y explicaciones fáciles de entender.",
    vehicle:
      "Prácticas de conducción",
    vehicleText:
      "Clases en vehículos modernos adaptadas al progreso individual.",
    processTitle:
      "Cómo empezar",
    contactTitle:
      "¡Esperamos conocerle!",
    contactIntro:
      "¿Quiere comenzar a conducir o tiene preguntas? Le ayudamos con los siguientes pasos.",
    apply:
      "Solicitar permiso de conducir",
    categories:
      "Categorías de permisos",
    contact:
      "Contactar",
    call:
      "Llamar ahora",
    email:
      "Enviar correo",
    readMore:
      "Ver detalles",
    close:
      "Ocultar detalles",
    requirements:
      "Requisitos e información",
    reference:
      "Información oficial",
    germanyOnly:
      "Las siguientes normas y ofertas corresponden a Alemania. En otros países se aplican sus propias normas nacionales.",
    legal:
      "Solo la autoridad competente puede expedir el permiso una vez cumplidos los requisitos legales. La formación y la inscripción no sustituyen los exámenes obligatorios.",
    specialOffer:
      "Consulte la disponibilidad y las condiciones de la oferta antes de inscribirse.",
    ageDisclaimer:
      "Las condiciones de edad, documentación y excepciones dependen de cada caso.",
    year2017:
      "Profesor desde 2017",
    year2022:
      "Propietario desde 2022",
    berlin:
      "Berlín-Reinickendorf",
    steps: [
      "Contactar o registrarse",
      "Elegir la categoría",
      "Preparar documentos",
      "Formación y preparación de exámenes",
    ],
  },
} as const;

/* ============================================================
   5. HIGHLIGHTED SERVICES

   Based on provided school description.
   Offer availability is not guaranteed.
   ============================================================ */

const BENEFITS: Benefit[] = [
  {
    icon: CarFront,
    title: {
      de: "Klasse B / BE / B96",
      ar: "الفئات B وBE وB96",
      tr: "B / BE / B96 sınıfları",
      es: "Categorías B / BE / B96",
    },
    description: {
      de: "Pkw-Ausbildung und Anhängerschulung.",
      ar: "تدريب السيارات والمقطورات.",
      tr: "Otomobil ve römork eğitimi.",
      es: "Formación para coches y remolques.",
    },
  },
  {
    icon: Gauge,
    title: {
      de: "Automatik & Schaltwagen",
      ar: "سيارات أوتوماتيكية ويدوية",
      tr: "Otomatik ve manuel vites",
      es: "Automático y manual",
    },
    description: {
      de: "Ausbildung mit Automatik- und Schaltfahrzeugen.",
      ar: "التدريب على ناقل الحركة الأوتوماتيكي واليدوي.",
      tr: "Otomatik ve manuel araçlarla eğitim.",
      es: "Formación con ambos tipos de transmisión.",
    },
  },
  {
    icon: Users,
    title: {
      de: "Begleitetes Fahren BF17",
      ar: "القيادة برفقة مرافق BF17",
      tr: "BF17 refakatli sürüş",
      es: "Conducción acompañada BF17",
    },
    description: {
      de: "Der Weg zur Fahrerlaubnis ab 17.",
      ar: "برنامج رخصة القيادة من سن 17.",
      tr: "17 yaşında ehliyete giden yol.",
      es: "Camino al permiso desde los 17 años.",
    },
  },
  {
    icon: Smartphone,
    title: {
      de: "Theorie-Lern-App",
      ar: "تطبيق تعلم النظري",
      tr: "Teori öğrenme uygulaması",
      es: "Aplicación de teoría",
    },
    description: {
      de: "Digital lernen und Prüfungen simulieren.",
      ar: "تعلم رقمي ومحاكاة الاختبارات.",
      tr: "Dijital öğrenim ve sınav simülasyonları.",
      es: "Aprendizaje digital y simulacros.",
    },
  },
  {
    icon: ClipboardCheck,
    title: {
      de: "Bürgeramt-Anmeldung",
      ar: "المساعدة في التسجيل لدى Bürgeramt",
      tr: "Bürgeramt başvuru desteği",
      es: "Asistencia con Bürgeramt",
    },
    description: {
      de: "Unterstützung beim Fahrerlaubnisantrag.",
      ar: "مساعدة في تجهيز وتقديم طلب الرخصة.",
      tr: "Ehliyet başvurusunda destek.",
      es: "Ayuda en la solicitud del permiso.",
    },
  },
  {
    icon: FileCheck2,
    title: {
      de: "Umschreibung ausländischer Führerscheine",
      ar: "تحويل رخص القيادة الأجنبية",
      tr: "Yabancı ehliyet dönüştürme",
      es: "Canje de permisos extranjeros",
    },
    description: {
      de: "Informationen und Hilfe bei der Umschreibung.",
      ar: "المعلومات والمساعدة في إجراءات التحويل.",
      tr: "Dönüştürme işlemleri hakkında danışmanlık.",
      es: "Orientación y apoyo con el canje.",
    },
  },
  {
    icon: Languages,
    title: {
      de: "Unterricht auf Deutsch & Arabisch",
      ar: "دروس بالألمانية والعربية",
      tr: "Almanca ve Arapça dersler",
      es: "Clases en alemán y árabe",
    },
    description: {
      de: "Theorieunterricht mit sprachlicher Unterstützung.",
      ar: "تعليم نظري مع الدعم اللغوي.",
      tr: "Dil desteğiyle teori dersleri.",
      es: "Teoría con apoyo lingüístico.",
    },
  },
  {
    icon: Sparkles,
    title: {
      de: "ADAC-Angebot",
      ar: "عرض عضوية ADAC",
      tr: "ADAC üyelik teklifi",
      es: "Oferta de ADAC",
    },
    description: {
      de: "Informationen zu einer möglichen beitragsfreien Mitgliedschaft.",
      ar: "معلومات عن إمكانية الحصول على عضوية مجانية وفق الشروط.",
      tr: "Koşullara bağlı ücretsiz üyelik hakkında bilgi.",
      es: "Información sobre posible afiliación gratuita sujeta a condiciones.",
    },
  },
];

/* ============================================================
   6. IN-DEPTH CONTENT

   German law-specific information.
   Other locale versions are fully
   translated in the same structure.
   ============================================================ */

const DETAILS: Detail[] = [
  {
    id: "bf17",

    title: {
      de: "Begleitetes Fahren ab 17 (BF17)",
      ar: "القيادة برفقة مرافق من سن 17 (BF17)",
      tr: "17 yaşında refakatli sürüş (BF17)",
      es: "Conducción acompañada desde los 17 años (BF17)",
    },

    intro: {
      de: "Mit BF17 kannst du in Deutschland die Ausbildung bereits mit 16½ Jahren beginnen und nach Erteilung der Fahrerlaubnis ab 17 mit eingetragenen Begleitpersonen fahren.",
      ar: "يسمح برنامج BF17 في ألمانيا ببدء الإجراءات والتدريب من عمر 16 سنة ونصف، والقيادة من سن 17 بعد الحصول على الترخيص وبمرافقة أشخاص مسجلين.",
      tr: "Almanya'da BF17 ile 16,5 yaşında eğitime başlanabilir. Ehliyet verildikten sonra 17 yaşından itibaren kayıtlı refakatçiyle araç kullanılabilir.",
      es: "En Alemania, BF17 permite comenzar la formación desde los 16 años y medio y, tras obtener la autorización, conducir desde los 17 con acompañantes registrados.",
    },

    points: {
      de: [
        "Begleitperson: mindestens 30 Jahre alt.",
        "Mindestens 5 Jahre Besitz einer gültigen Fahrerlaubnis der Klasse B oder einer anerkannten entsprechenden Fahrerlaubnis.",
        "Höchstens 1 Punkt im Fahreignungsregister zum maßgeblichen Antragszeitpunkt.",
        "Erforderlich sind unter anderem Identitätsnachweis, biometrisches Foto, Sehtest, Erste-Hilfe-Nachweis und die vorgesehenen Zustimmungen.",
        "Die Theorieprüfung ist grundsätzlich frühestens 3 Monate, die Praxisprüfung 1 Monat vor Erreichen des Mindestalters möglich.",
      ],
      ar: [
        "يجب أن يبلغ المرافق 30 عاماً على الأقل.",
        "يجب أن يحمل رخصة فئة B صالحة أو رخصة معادلة معترفاً بها منذ خمس سنوات على الأقل.",
        "ألا يزيد رصيده على نقطة واحدة في سجل المخالفات وقت الطلب المعني.",
        "تشمل الوثائق الهوية والصورة البيومترية وفحص النظر والإسعافات الأولية والموافقات المطلوبة.",
        "يمكن عادة إجراء الاختبار النظري قبل بلوغ الحد الأدنى للعمر بثلاثة أشهر والعملي بشهر واحد.",
      ],
      tr: [
        "Refakatçi en az 30 yaşında olmalıdır.",
        "En az 5 yıldır geçerli B sınıfı veya kabul edilen eşdeğer ehliyete sahip olmalıdır.",
        "Başvuru için geçerli tarihte ceza puanı en fazla 1 olmalıdır.",
        "Kimlik, biyometrik fotoğraf, göz testi, ilk yardım belgesi ve gerekli izinler istenir.",
        "Teori sınavı genellikle asgari yaştan 3 ay, pratik sınav 1 ay önce yapılabilir.",
      ],
      es: [
        "El acompañante debe tener al menos 30 años.",
        "Debe poseer un permiso B válido o equivalente reconocido desde hace al menos 5 años.",
        "Como máximo 1 punto en el registro alemán de infracciones en la fecha pertinente.",
        "Se exigen documentos de identidad, fotografía biométrica, examen visual, primeros auxilios y autorizaciones.",
        "Por regla general, el examen teórico puede realizarse 3 meses y el práctico 1 mes antes de la edad mínima.",
      ],
    },

    reference:
      "https://service.berlin.de/dienstleistung/121589/",
  },

  {
    id: "b197",

    title: {
      de: "Automatik-Führerschein mit Schlüsselzahl B197",
      ar: "رخصة القيادة الأوتوماتيكية B197",
      tr: "B197 otomatik vites ehliyeti",
      es: "Permiso automático con código B197",
    },

    intro: {
      de: "B197 verbindet die Ausbildung auf Automatik- und Schaltfahrzeugen. Die praktische Prüfung kann auf einem Automatikfahrzeug abgelegt werden, ohne dass die übliche Automatikbeschränkung gilt, wenn die gesetzlichen Voraussetzungen erfüllt sind.",
      ar: "يجمع B197 بين التدريب على السيارات الأوتوماتيكية واليدوية. يمكن أداء الاختبار العملي بالأوتوماتيك دون القيد المعتاد إذا استوفيت الشروط القانونية.",
      tr: "B197 otomatik ve manuel araç eğitimini birleştirir. Yasal koşullar sağlandığında pratik sınav otomatik araçla yapılabilir ve standart otomatik vites kısıtlaması uygulanmaz.",
      es: "B197 combina formación en vehículos automáticos y manuales. Se puede realizar la prueba práctica con automático sin la restricción habitual cuando se cumplen los requisitos legales.",
    },

    points: {
      de: [
        "Mindestens 10 Fahrstunden zu je 45 Minuten auf einem Schaltfahrzeug.",
        "Mindestens 15 Minuten Testfahrt auf einem Schaltfahrzeug mit dem Fahrlehrer.",
        "Bescheinigung über Ausbildung und Testfahrt nach Anlage 7 FahrschAusbO.",
        "Die weiteren Voraussetzungen der Klasse B bleiben bestehen.",
      ],
      ar: [
        "عشر حصص قيادة على الأقل، مدة كل منها 45 دقيقة، بسيارة يدوية.",
        "اختبار قيادة لمدة 15 دقيقة على الأقل بسيارة يدوية مع المدرب.",
        "شهادة رسمية تثبت التدريب والاختبار وفق الملحق 7.",
        "تبقى بقية شروط الفئة B سارية.",
      ],
      tr: [
        "Manuel araçla her biri 45 dakika olan en az 10 ders.",
        "Eğitmenle manuel araçta en az 15 dakikalık değerlendirme sürüşü.",
        "Eğitim ve değerlendirme için Anlage 7 belgesi.",
        "B sınıfının diğer koşulları geçerlidir.",
      ],
      es: [
        "Al menos 10 clases de 45 minutos en un vehículo manual.",
        "Una prueba de conducción de al menos 15 minutos con el profesor.",
        "Certificado conforme al anexo 7 de la normativa de formación.",
        "Se mantienen los demás requisitos de la categoría B.",
      ],
    },

    reference:
      "https://www.gesetze-im-internet.de/fahrschausbo_2012/__5a.html",
  },

  {
    id: "classB",

    title: {
      de: "Führerschein Klasse B",
      ar: "رخصة القيادة فئة B",
      tr: "B sınıfı ehliyet",
      es: "Permiso de conducir B",
    },

    intro: {
      de: "Die Klasse B berechtigt grundsätzlich zum Führen von Kraftfahrzeugen bis 3.500 kg zulässiger Gesamtmasse mit den gesetzlich erlaubten Anhängern.",
      ar: "تتيح الفئة B قيادة المركبات التي لا تتجاوز كتلتها الإجمالية المسموح بها 3500 كغ مع المقطورات المسموحة قانونياً.",
      tr: "B sınıfı, genel olarak azami izin verilen kütlesi 3.500 kg olan araçları ve yasal sınırlar içindeki römorkları kapsar.",
      es: "La categoría B permite conducir, con carácter general, vehículos de hasta 3.500 kg de masa máxima autorizada y los remolques permitidos.",
    },

    points: {
      de: [
        "Reguläres Mindestalter: 18 Jahre; BF17 ist unter seinen besonderen Bedingungen möglich.",
        "Theorie bei Ersterwerb: 12 Doppelstunden Grundstoff und 2 Doppelstunden klassenspezifischer Stoff, jeweils 90 Minuten.",
        "Besondere Ausbildungsfahrten: 5 Überlandfahrten, 4 Autobahnfahrten und 3 Fahrten bei Dämmerung oder Dunkelheit, jeweils 45 Minuten.",
        "Zusätzliche Übungsstunden richten sich nach dem individuellen Lernfortschritt.",
        "Theoretische und praktische Prüfung sind erforderlich.",
      ],
      ar: [
        "العمر المعتاد 18 سنة، مع إمكانية BF17 بشروطه الخاصة.",
        "الدروس النظرية عند أول رخصة: 12 حصة مزدوجة عامة وحصتان متخصصتان، مدة كل حصة 90 دقيقة.",
        "12 حصة قيادة خاصة، منها 5 خارج المدينة و4 على الطرق السريعة و3 في ظروف الإضاءة المنخفضة، مدة كل منها 45 دقيقة.",
        "تعتمد حصص التدريب الإضافية على تقدم المتدرب.",
        "يلزم اجتياز الاختبارين النظري والعملي.",
      ],
      tr: [
        "Standart asgari yaş 18; özel BF17 koşullarıyla 17 yaş mümkündür.",
        "İlk ehliyette 12 çift ders genel teori ve 2 çift ders B sınıfına özel teori, her biri 90 dakika.",
        "Her biri 45 dakika olmak üzere 5 şehir dışı, 4 otoyol ve 3 gece/alacakaranlık özel sürüş dersi.",
        "Ek pratik dersler öğrencinin gelişimine göre belirlenir.",
        "Teorik ve pratik sınav gerekir.",
      ],
      es: [
        "Edad ordinaria: 18 años; BF17 puede aplicarse bajo sus condiciones especiales.",
        "Para el primer permiso: 12 sesiones dobles de teoría general y 2 específicas, de 90 minutos.",
        "Clases especiales de 45 minutos: 5 interurbanas, 4 de autopista y 3 de conducción nocturna o crepuscular.",
        "Las clases adicionales dependen del progreso del alumno.",
        "Se requieren exámenes teórico y práctico.",
      ],
    },

    reference:
      "https://www.gesetze-im-internet.de/fahrschausbo_2012/",
  },

  {
    id: "b96",

    title: {
      de: "Schlüsselzahl B96 – Anhänger",
      ar: "إضافة المقطورة B96",
      tr: "B96 römork yetkisi",
      es: "Código B96 para remolques",
    },

    intro: {
      de: "B96 ist eine Erweiterung der Klasse B für bestimmte Kombinationen mit Anhänger, deren zulässige Gesamtmasse über 3.500 kg und höchstens 4.250 kg liegt.",
      ar: "B96 إضافة للفئة B تسمح بمجموعات معينة من السيارات والمقطورات بكتلة إجمالية تتجاوز 3500 كغ ولا تزيد على 4250 كغ.",
      tr: "B96, toplam izin verilen kütlesi 3.500 kg üzeri ve en fazla 4.250 kg olan belirli römorklu kombinasyonlar için B sınıfı genişletmesidir.",
      es: "B96 amplía la categoría B para determinadas combinaciones de vehículo y remolque superiores a 3.500 kg y de hasta 4.250 kg.",
    },

    points: {
      de: [
        "Klasse B als Grundlage.",
        "Mindestens 2,5 Stunden Theorie mit Schwerpunkt Anhänger.",
        "Mindestens 3,5 Stunden praktische Übungen.",
        "Mindestens 1 Stunde Fahren im öffentlichen Straßenverkehr.",
        "Nach erfolgreicher vorgeschriebener Schulung wird die Schlüsselzahl 96 eingetragen; es ist keine gesonderte klassische Fahrerlaubnisprüfung wie bei BE erforderlich.",
      ],
      ar: [
        "يجب توفر الفئة B كأساس.",
        "ساعتان ونصف على الأقل من التعليم النظري المتعلق بالمقطورة.",
        "ثلاث ساعات ونصف على الأقل من التدريب العملي.",
        "ساعة قيادة واحدة على الأقل في الطريق العام.",
        "بعد إكمال التدريب المطلوب تُسجل الإضافة 96، ولا يلزم اختبار قيادة مستقل مثل BE.",
      ],
      tr: [
        "B sınıfı temel ehliyet gereklidir.",
        "En az 2,5 saat römork teorisi.",
        "En az 3,5 saat pratik alıştırma.",
        "Trafikte en az 1 saat sürüş.",
        "Gerekli eğitimin tamamlanmasıyla kod 96 kaydedilir; BE'deki gibi ayrı klasik sürüş sınavı gerekmez.",
      ],
      es: [
        "Se requiere la categoría B como base.",
        "Al menos 2,5 horas de teoría sobre remolques.",
        "Al menos 3,5 horas de ejercicios prácticos.",
        "Al menos 1 hora de conducción en circulación.",
        "Tras completar la formación se registra el código 96 sin examen independiente como el de BE.",
      ],
    },

    reference:
      "https://www.gesetze-im-internet.de/fev_2010/__6a.html",
  },

  {
    id: "classBE",

    title: {
      de: "Führerschein Klasse BE",
      ar: "رخصة القيادة فئة BE",
      tr: "BE sınıfı ehliyet",
      es: "Permiso BE",
    },

    intro: {
      de: "Die Klasse BE ermöglicht mit einem Fahrzeug der Klasse B das Ziehen bestimmter Anhänger bis 3.500 kg zulässiger Anhängermasse.",
      ar: "تسمح الفئة BE بقيادة سيارة من الفئة B مع مقطورات معينة يصل وزنها الإجمالي المسموح به إلى 3500 كغ.",
      tr: "BE sınıfı, B sınıfı araçla azami izin verilen kütlesi 3.500 kg'a kadar olan belirli römorkların çekilmesini sağlar.",
      es: "La categoría BE permite arrastrar determinados remolques de hasta 3.500 kg de masa máxima autorizada con un vehículo B.",
    },

    points: {
      de: [
        "Klasse B ist Voraussetzung.",
        "Reguläres Mindestalter 18 Jahre; BF17-Ausnahmen sind möglich.",
        "Besondere Fahrten: 3 Überlandfahrten, 1 Autobahnfahrt und 1 Fahrt bei Dunkelheit, jeweils 45 Minuten.",
        "Weitere praktische Übungsstunden nach Bedarf.",
        "Für die Erweiterung von B auf BE ist grundsätzlich eine praktische Prüfung erforderlich.",
      ],
      ar: [
        "يجب امتلاك الفئة B.",
        "العمر المعتاد 18 سنة مع استثناءات BF17 الممكنة.",
        "الحصص الخاصة: 3 خارج المدينة وواحدة على الطريق السريع وواحدة ليلاً، مدة كل منها 45 دقيقة.",
        "حصص تدريب إضافية حسب الحاجة.",
        "يتطلب الانتقال من B إلى BE عادة اختباراً عملياً.",
      ],
      tr: [
        "B sınıfı gereklidir.",
        "Standart yaş 18; BF17 istisnaları mümkündür.",
        "Özel dersler: 3 şehir dışı, 1 otoyol ve 1 gece sürüşü, her biri 45 dakika.",
        "İhtiyaca göre ek pratik eğitim.",
        "B'den BE'ye geçişte genel olarak pratik sınav gerekir.",
      ],
      es: [
        "Es necesaria la categoría B.",
        "Edad ordinaria 18 años, con posibles excepciones BF17.",
        "Prácticas especiales: 3 interurbanas, 1 en autopista y 1 nocturna, de 45 minutos cada una.",
        "Clases prácticas adicionales según necesidad.",
        "La ampliación de B a BE requiere generalmente examen práctico.",
      ],
    },

    reference:
      "https://www.gesetze-im-internet.de/fev_2010/__15.html",
  },

  {
    id: "conversion",

    title: {
      de: "Umschreibung ausländischer Führerscheine",
      ar: "تحويل رخص القيادة الأجنبية",
      tr: "Yabancı ehliyetlerin dönüştürülmesi",
      es: "Canje de permisos extranjeros",
    },

    intro: {
      de: "Wer einen Führerschein aus einem Nicht-EU-/EWR-Staat besitzt und seinen ordentlichen Wohnsitz nach Deutschland verlegt, darf damit grundsätzlich noch sechs Monate fahren, sofern die Fahrerlaubnis hier anerkannt wird. Anschließend ist regelmäßig eine deutsche Fahrerlaubnis nötig.",
      ar: "من يحمل رخصة قيادة من خارج الاتحاد الأوروبي والمنطقة الاقتصادية الأوروبية وينتقل للإقامة المعتادة إلى ألمانيا، يمكنه عادة القيادة بها ستة أشهر إذا كانت معترفاً بها. وبعد ذلك يلزم غالباً الحصول على رخصة ألمانية.",
      tr: "AB/AEA dışından alınan ehliyetle Almanya'ya yerleşen kişiler, ehliyet burada tanınıyorsa genel olarak altı ay araç kullanabilir. Sonrasında çoğunlukla Alman ehliyeti gerekir.",
      es: "Quien traslada su residencia habitual a Alemania con un permiso de un país no UE/EEE puede, por regla general, conducir durante seis meses si el permiso es reconocido. Después suele necesitar un permiso alemán.",
    },

    points: {
      de: [
        "Gültiger ausländischer Führerschein im Original.",
        "Identitätsdokument, biometrisches Foto und Nachweis des Wohnsitzes.",
        "Übersetzung, sofern sie nach den geltenden Regeln erforderlich ist.",
        "Sehtest und gegebenenfalls Erste-Hilfe-Nachweis oder weitere Unterlagen.",
        "Ob Theorie- und Praxisprüfungen nötig sind, richtet sich nach dem Ausstellungsstaat und den anwendbaren Vorschriften.",
        "Der Antrag sollte rechtzeitig vor Ablauf der Anerkennungsfrist gestellt werden.",
      ],
      ar: [
        "رخصة القيادة الأجنبية الأصلية السارية.",
        "وثيقة هوية وصورة بيومترية وإثبات عنوان الإقامة.",
        "ترجمة الرخصة إذا كانت مطلوبة قانونياً.",
        "فحص النظر والإسعافات الأولية أو مستندات إضافية عند الحاجة.",
        "تحدد دولة إصدار الرخصة والقوانين المعمول بها ضرورة الاختبار النظري أو العملي.",
        "ينصح بتقديم طلب التحويل قبل انتهاء مدة الاعتراف بالرخصة.",
      ],
      tr: [
        "Geçerli yabancı ehliyetin aslı.",
        "Kimlik, biyometrik fotoğraf ve ikamet kanıtı.",
        "Mevzuat gerektiriyorsa ehliyet tercümesi.",
        "Göz testi, gerektiğinde ilk yardım belgesi ve ek belgeler.",
        "Teori ve pratik sınav gerekliliği ehliyetin verildiği ülkeye göre değişir.",
        "Başvuru tanınma süresi dolmadan yapılmalıdır.",
      ],
      es: [
        "Permiso extranjero válido en original.",
        "Identificación, foto biométrica y justificante de residencia.",
        "Traducción cuando la normativa la exija.",
        "Prueba visual y, cuando corresponda, primeros auxilios y otros documentos.",
        "Los exámenes necesarios dependen del país emisor y de las normas aplicables.",
        "Conviene solicitar el canje antes de que expire el plazo de reconocimiento.",
      ],
    },

    reference:
      "https://service.berlin.de/dienstleistung/327537/",
  },

  {
    id: "registration",

    title: {
      de: "Fahrerlaubnisantrag und Bürgeramt-Service",
      ar: "طلب رخصة القيادة وخدمة Bürgeramt",
      tr: "Ehliyet başvurusu ve Bürgeramt desteği",
      es: "Solicitud de permiso y ayuda con Bürgeramt",
    },

    intro: {
      de: "Wir unterstützen dich bei der Vorbereitung der Antragsunterlagen und informieren dich über die erforderlichen Schritte bei den zuständigen Berliner Behörden. Ob wir die Einreichung direkt übernehmen können, klären wir für deinen konkreten Antrag.",
      ar: "نساعدك في تجهيز ملف الطلب وتوضيح خطوات التسجيل لدى الجهات المختصة في برلين. ويتم التأكد من إمكانية تقديم الطلب نيابة عنك حسب حالتك.",
      tr: "Berlin'deki ilgili makamlar için başvuru belgelerinizi hazırlamanıza yardımcı oluyoruz. Başvurunun sizin adınıza sunulup sunulamayacağı duruma göre değerlendirilir.",
      es: "Le ayudamos a preparar los documentos y a conocer los trámites ante las autoridades de Berlín. La posibilidad de presentar el expediente en su nombre se comprobará en cada caso.",
    },

    points: {
      de: [
        "Gültiger Personalausweis oder Reisepass; gegebenenfalls Meldebescheinigung.",
        "Aktuelles biometrisches Passfoto.",
        "Gültige Sehtestbescheinigung.",
        "Nachweis über einen Erste-Hilfe-Kurs, soweit erforderlich.",
        "Weitere Nachweise je nach Führerscheinklasse und Antrag.",
      ],
      ar: [
        "بطاقة هوية أو جواز سفر ساري، وإثبات التسجيل السكني عند الحاجة.",
        "صورة بيومترية حديثة.",
        "شهادة فحص نظر صالحة.",
        "إثبات حضور دورة الإسعافات الأولية عند الحاجة.",
        "مستندات إضافية بحسب فئة الرخصة ونوع الطلب.",
      ],
      tr: [
        "Geçerli kimlik veya pasaport; gerektiğinde ikamet kayıt belgesi.",
        "Güncel biyometrik fotoğraf.",
        "Geçerli göz testi belgesi.",
        "Gerektiğinde ilk yardım kursu belgesi.",
        "Sınıfa ve başvuruya göre diğer belgeler.",
      ],
      es: [
        "Documento de identidad o pasaporte válido; certificado de empadronamiento cuando proceda.",
        "Fotografía biométrica reciente.",
        "Certificado de examen visual válido.",
        "Certificado de primeros auxilios cuando sea necesario.",
        "Otros documentos según categoría y solicitud.",
      ],
    },
  },

  {
    id: "adac",

    title: {
      de: "ADAC – mögliches beitragsfreies erstes Jahr",
      ar: "ADAC – إمكانية الحصول على السنة الأولى مجاناً",
      tr: "ADAC – koşullara bağlı ücretsiz ilk yıl",
      es: "ADAC – posible primer año gratuito",
    },

    intro: {
      de: "Fahrschule TAYM hat auf ihrer bisherigen Website eine beitragsfreie ADAC-Mitgliedschaft für ein Jahr als Angebot beschrieben. Die aktuelle Verfügbarkeit und die Teilnahmebedingungen müssen vor der Zusage bestätigt werden.",
      ar: "عرضت مدرسة TAYM سابقاً عضوية ADAC مجانية لمدة سنة. يجب التأكد من توفر العرض حالياً وشروط الاستفادة منه قبل تأكيده.",
      tr: "TAYM'ın önceki internet sitesinde bir yıllık aidatsız ADAC üyeliği tanıtılmıştır. Güncel kampanya ve koşullar başvuru öncesinde doğrulanmalıdır.",
      es: "La web anterior de TAYM anunciaba un año de afiliación ADAC sin cuota. Deben confirmarse la disponibilidad actual y las condiciones antes de ofrecerla.",
    },

    points: {
      de: [
        "Informationen zu Hilfeleistungen bei Pannen und Unfällen.",
        "Leistungen und Leistungsgrenzen richten sich nach dem gewählten Mitgliedschaftstarif.",
        "Eine beitragsfreie Mitgliedschaft kann von Alter, Aktion und weiteren Bedingungen abhängen.",
        "Bitte frage bei TAYM nach dem aktuell gültigen Angebot.",
      ],
      ar: [
        "معلومات عن خدمات المساعدة عند الأعطال والحوادث.",
        "تختلف الخدمات وحدود التغطية حسب نوع العضوية.",
        "قد تعتمد مجانية العضوية على العمر والعروض وشروط أخرى.",
        "يرجى الاستفسار لدى TAYM عن العرض المتاح حالياً.",
      ],
      tr: [
        "Arıza ve kaza yardımı hizmetleri hakkında bilgi.",
        "Hizmet kapsamı üyelik tarifesine göre değişir.",
        "Ücretsiz üyelik yaşa, kampanyaya ve diğer şartlara bağlı olabilir.",
        "Güncel teklif için TAYM ile iletişime geçin.",
      ],
      es: [
        "Información sobre asistencia en averías y accidentes.",
        "Las coberturas dependen del tipo de afiliación.",
        "La gratuidad puede depender de la edad, campaña y otras condiciones.",
        "Consulte la oferta vigente con TAYM.",
      ],
    },

    reference:
      "https://www.adac.de/mitgliedschaft/mitglied-werden/",
  },

  {
    id: "app",

    title: {
      de: "Digitale Theorie-Lern-App",
      ar: "تطبيق تعلم النظري",
      tr: "Dijital teori uygulaması",
      es: "Aplicación digital de teoría",
    },

    intro: {
      de: "Für die Vorbereitung auf die Theorieprüfung setzen wir auf digitale Lernmöglichkeiten. Die bisherige Website nennt ClickClickDrive als Lernangebot mit Prüfungssimulationen. Die aktuell bereitgestellte App wird bei der Anmeldung bestätigt.",
      ar: "نستخدم وسائل رقمية للتحضير للاختبار النظري. وقد ذكر موقع المدرسة السابق ClickClickDrive لتدريب الأسئلة ومحاكاة الاختبارات. يتم تأكيد التطبيق المتاح حالياً عند التسجيل.",
      tr: "Teorik sınava hazırlıkta dijital öğrenme araçlarını kullanıyoruz. Önceki sitede ClickClickDrive ve sınav simülasyonları yer alıyordu. Güncel uygulama kayıt sırasında teyit edilir.",
      es: "Utilizamos herramientas digitales de preparación teórica. La web anterior mencionaba ClickClickDrive y simulacros de examen. La aplicación disponible se confirmará al inscribirse.",
    },

    points: {
      de: [
        "Lernen von Verkehrsregeln und Prüfungsfragen.",
        "Simulation theoretischer Prüfungen.",
        "Selbstständige Wiederholung der Lerninhalte.",
        "Persönliche Betreuung ergänzt das digitale Lernen.",
      ],
      ar: [
        "تعلم قواعد المرور وأسئلة الاختبارات.",
        "محاكاة الاختبار النظري.",
        "مراجعة الدروس بشكل مستقل.",
        "المتابعة الشخصية تكمل التعلم الرقمي.",
      ],
      tr: [
        "Trafik kuralları ve sınav sorularını çalışma.",
        "Teorik sınav simülasyonları.",
        "Dersleri bireysel olarak tekrar etme.",
        "Dijital öğrenmeyi kişisel destekle tamamlama.",
      ],
      es: [
        "Estudio de normas de tráfico y preguntas de examen.",
        "Simulaciones del examen teórico.",
        "Repaso autónomo de contenidos.",
        "El apoyo personal complementa el aprendizaje digital.",
      ],
    },
  },

  {
    id: "theory",

    title: {
      de: "Theorieunterricht auf Deutsch und Arabisch",
      ar: "التعليم النظري بالألمانية والعربية",
      tr: "Almanca ve Arapça teori dersleri",
      es: "Clases teóricas en alemán y árabe",
    },

    intro: {
      de: "Wir bieten nach unserer bisherigen Schulbeschreibung Theorieunterricht auf Deutsch und Arabisch an. Die Unterrichtssprache und aktuellen Termine sind vor der Anmeldung zu bestätigen.",
      ar: "وفقاً لوصف المدرسة، نقدم دروساً نظرية بالألمانية والعربية. يرجى التأكد من لغة الدروس والمواعيد الحالية قبل التسجيل.",
      tr: "Okulun mevcut tanıtımına göre Almanca ve Arapça teori dersleri sunulmaktadır. Güncel ders dili ve saatleri kayıttan önce teyit edilmelidir.",
      es: "Según la presentación de la escuela, se ofrecen clases de teoría en alemán y árabe. Deben confirmarse los idiomas y horarios actuales.",
    },

    points: {
      de: [
        "Klasse B beim Ersterwerb: 12 Doppelstunden Grundstoff und 2 Doppelstunden Zusatzstoff.",
        "Eine Doppelstunde dauert 90 Minuten.",
        "Verständliche Erklärungen und Raum für Fragen.",
        "Die amtliche Theorieprüfung richtet sich nach den Vorgaben der zuständigen Prüforganisation; der Unterricht auf Arabisch bedeutet nicht automatisch eine arabischsprachige Prüfung.",
      ],
      ar: [
        "الفئة B عند الحصول على أول رخصة: 12 حصة مزدوجة عامة وحصتان إضافيتان متخصصتان.",
        "مدة الحصة المزدوجة 90 دقيقة.",
        "شرح مبسط وإتاحة الوقت للأسئلة.",
        "لغة الاختبار الرسمي تحددها الجهة المختصة؛ الدراسة بالعربية لا تعني تلقائياً إمكانية إجراء الاختبار بالعربية.",
      ],
      tr: [
        "İlk B sınıfı ehliyette 12 çift ders genel teori ve 2 çift ders özel konu.",
        "Bir çift ders 90 dakikadır.",
        "Anlaşılır açıklamalar ve soru sorma fırsatı.",
        "Resmî teorik sınav dili yetkili sınav kuruluşunun kurallarına bağlıdır; Arapça ders otomatik olarak Arapça sınav anlamına gelmez.",
      ],
      es: [
        "Para el primer permiso B: 12 sesiones dobles generales y 2 específicas.",
        "Cada sesión doble dura 90 minutos.",
        "Explicaciones claras y espacio para preguntas.",
        "El idioma del examen oficial depende de la entidad examinadora; recibir clases en árabe no implica automáticamente realizar el examen en árabe.",
      ],
    },

    reference:
      "https://www.gesetze-im-internet.de/fahrschausbo_2012/",
  },
];

/* ============================================================
   7. LANGUAGE DETECTION

   Follow the existing header:
   HTML lang / cookie / localStorage.

   No second language selector.
   ============================================================ */

function validLocale(
  value: unknown
): Locale | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];

  if (
    normalized === "de" ||
    normalized === "ar" ||
    normalized === "tr" ||
    normalized === "es"
  ) {
    return normalized;
  }

  return null;
}

function getCookieLocale(): Locale | null {
  if (typeof document === "undefined") {
    return null;
  }

  const names = [
    "taym-locale",
    "locale",
    "NEXT_LOCALE",
  ];

  for (const name of names) {
    const cookie = document.cookie
      .split(";")
      .map((value) => value.trim())
      .find((value) =>
        value.startsWith(`${name}=`)
      );

    if (!cookie) continue;

    const raw = cookie.slice(
      name.length + 1
    );

    try {
      const locale = validLocale(
        decodeURIComponent(raw)
      );

      if (locale) return locale;
    } catch {
      // Try next value.
    }
  }

  return null;
}

function getActiveLocale(): Locale {
  if (typeof window === "undefined") {
    return "de";
  }

  const htmlLocale = validLocale(
    document.documentElement.lang
  );

  if (htmlLocale) return htmlLocale;

  const cookieLocale = getCookieLocale();

  if (cookieLocale) return cookieLocale;

  try {
    return (
      validLocale(
        window.localStorage.getItem(
          "taym-locale"
        )
      ) ?? "de"
    );
  } catch {
    return "de";
  }
}

/* ============================================================
   8. REUSABLE BUTTON
   ============================================================ */

function CTA({
  href,
  children,
  outline = false,
  dark = false,
}: {
  href: string;
  children: ReactNode;
  outline?: boolean;
  dark?: boolean;
}) {
  const styles = [
    "inline-flex min-h-12 items-center",
    "justify-center gap-2 rounded-xl",
    "px-5 py-3 text-sm font-bold",
    "transition-colors",
    "focus-visible:outline-none",
    "focus-visible:ring-2",
    "focus-visible:ring-lime-500",
    outline
      ? dark
        ? "border border-white/50 bg-transparent text-white hover:bg-white/10"
        : "border-2 border-green-700 bg-white text-green-800 hover:bg-lime-50"
      : "bg-linear-to-r from-green-800 to-lime-600 text-white hover:from-green-900 hover:to-lime-700",
  ].join(" ");

  if (
    href.startsWith("tel:") ||
    href.startsWith("mailto:")
  ) {
    return (
      <a href={href} className={styles}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={styles}>
      {children}
    </Link>
  );
}

/* ============================================================
   9. PHOTO OR VISUAL FALLBACK
   ============================================================ */

function Photo({
  imageKey,
  alt,
  icon: Icon,
  className = "",
  priority = false,
}: {
  imageKey: ImageKey;
  alt: string;
  icon: LucideIcon;
  className?: string;
  priority?: boolean;
}) {
  const path = safeImage(
    ABOUT_IMAGES[imageKey]
  );

  const [failedPath, setFailedPath] = useState<string | null>(null);

  return (
    <div
      className={`relative overflow-hidden bg-linear-to-br from-lime-100 via-[#eef6e4] to-[#d8edc7] ${className}`}
    >
      {path && path !== failedPath ? (
        <Image
          src={path}
          alt={alt}
          fill
          priority={priority}
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
          onError={() => setFailedPath(path)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex size-28 items-center justify-center rounded-3xl border border-white bg-white/70 text-green-800 shadow-sm">
            <Icon
              size={65}
              strokeWidth={1.3}
              aria-hidden="true"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   10. DETAILS ACCORDION

   Responsive and keyboard accessible.
   ============================================================ */

function DetailCard({
  item,
  locale,
  open,
  onToggle,
}: {
  item: Detail;
  locale: Locale;
  open: boolean;
  onToggle: () => void;
}) {
  const t = UI[locale];

  const contentId = `about-${item.id}`;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={onToggle}
        className="flex min-h-20 w-full items-center gap-4 p-4 text-start transition-colors hover:bg-lime-50 sm:p-5"
      >
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-green-800">
          <FileText
            size={23}
            aria-hidden="true"
          />
        </div>

        <h3 className="min-w-0 flex-1 text-sm font-extrabold leading-relaxed text-slate-950 sm:text-base">
          {item.title[locale]}
        </h3>

        <ChevronDown
          size={19}
          className={`shrink-0 text-green-800 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        id={contentId}
        hidden={!open}
        className="border-t border-slate-100 px-4 pb-5 pt-4 sm:px-5"
      >
        <p className="text-sm leading-7 text-slate-700">
          {item.intro[locale]}
        </p>

        <ul className="mt-4 space-y-3">
          {item.points[locale].map(
            (point, index) => (
              <li
                key={index}
                className="flex items-start gap-3 text-sm leading-relaxed text-slate-700"
              >
                <CheckCircle2
                  size={17}
                  className="mt-0.5 shrink-0 text-lime-700"
                  aria-hidden="true"
                />

                <span>{point}</span>
              </li>
            )
          )}
        </ul>

        {item.note && (
          <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            {item.note[locale]}
          </div>
        )}

        {item.reference && (
          <a
            href={item.reference}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-green-800 underline underline-offset-4"
          >
            <Info size={15} />
            {t.reference}
          </a>
        )}
      </div>
    </article>
  );
}

/* ============================================================
   11. MAIN PAGE
   ============================================================ */

export default function UeberUnsPage() {
  const [locale, setLocale] =
    useState<Locale>("de");

  const [openDetail, setOpenDetail] =
    useState<DetailId | null>("bf17");

  useEffect(() => {
    const sync = (event?: Event) => {
      if (
        event instanceof CustomEvent
      ) {
        const detail: unknown =
          event.detail;

        const eventLocale =
          validLocale(
            typeof detail === "string"
              ? detail
              : detail &&
                  typeof detail === "object" &&
                  "locale" in detail
                ? detail.locale
                : null
          );

        if (eventLocale) {
          setLocale(eventLocale);
          return;
        }
      }

      setLocale(getActiveLocale());
    };

    sync();

    const observer = new MutationObserver(
      () => sync()
    );

    observer.observe(
      document.documentElement,
      {
        attributes: true,
        attributeFilter: ["lang"],
      }
    );

    window.addEventListener(
      "taym:language-change",
      sync
    );

    window.addEventListener(
      "storage",
      sync
    );

    window.addEventListener(
      "focus",
      sync
    );

    return () => {
      observer.disconnect();

      window.removeEventListener(
        "taym:language-change",
        sync
      );

      window.removeEventListener(
        "storage",
        sync
      );

      window.removeEventListener(
        "focus",
        sync
      );
    };
  }, []);

  const t = UI[locale];

  const rtl = locale === "ar";

  const Arrow = rtl
    ? ArrowLeft
    : ArrowRight;

  return (
    <main
      lang={locale}
      dir={rtl ? "rtl" : "ltr"}
      className="min-w-0 overflow-hidden bg-[#f7f9f5] text-slate-950"
    >
      {/* ==================================================
          HERO
          ================================================== */}

      <section className="relative overflow-hidden bg-[#142117]">
        <div className="absolute -inset-e-24 -top-24 size-80 rounded-full bg-lime-500/15 blur-3xl" />

        <div className="mx-auto grid max-w-none items-center gap-9 px-4 py-7 sm:px-6 sm:py-9 lg:grid-cols-2 lg:gap-12 lg:px-8 lg:py-10">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-lime-400/30 bg-lime-400/10 px-4 py-2 text-xs font-bold tracking-wider text-lime-300">
              <Sparkles size={16} />
              {t.eyebrow}
            </div>

            <h1 className="mt-6 text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
              {t.headline}
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-8 text-slate-200 sm:text-base">
              {t.intro}
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <CTA href={ROUTES.application}>
                <ClipboardList size={18} />

                {t.apply}

                <Arrow size={17} />
              </CTA>

              <CTA
                href={ROUTES.categories}
                outline
                dark
              >
                <CarFront size={18} />

                {t.categories}
              </CTA>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {[
                t.year2017,
                t.year2022,
                t.berlin,
              ].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <Photo
            imageKey="hero"
            alt={t.title}
            icon={CarFront}
            priority
            className="min-h-72 rounded-3xl border-4 border-white/10 shadow-xl sm:min-h-96 lg:min-h-112.5"
          />
        </div>
      </section>

      {/* ==================================================
          ABOUT THE FOUNDER
          ================================================== */}

      <section className="bg-white">
        <div className="mx-auto grid max-w-none items-center gap-9 px-4 py-7 sm:px-6 sm:py-9 lg:grid-cols-2 lg:gap-14 lg:px-8">
          <div className="lg:order-1">
            <Photo
              imageKey="founder"
              alt="Fahrschule TAYM"
              icon={GraduationCap}
              className="min-h-72 rounded-3xl sm:min-h-107.5"
            />
          </div>

          <div className="lg:order-2">
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-green-800">
              <span className="h-1 w-8 rounded-full bg-lime-500" />
              {t.title}
            </span>

            <h2 className="mt-4 text-2xl font-black leading-tight sm:text-3xl lg:text-4xl">
              {t.founderTitle}
            </h2>

            <p className="mt-2 text-sm font-semibold text-green-800">
              {t.founderRole}
            </p>

            <blockquote className="mt-6 border-s-4 border-lime-500 ps-4 text-lg font-bold leading-relaxed text-green-900">
              “{t.founderQuote}”
            </blockquote>

            <div className="mt-6 space-y-4 text-sm leading-8 text-slate-600">
              <p>{t.founderP1}</p>
              <p>{t.founderP2}</p>
              <p>{t.founderP3}</p>
              <p>{t.founderP4}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================
          HIGHLIGHTED BENEFITS
          ================================================== */}

      <section className="bg-[#edf5e7]">
        <div className="mx-auto max-w-none px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-black sm:text-3xl lg:text-4xl">
              {t.benefitsTitle}
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              {t.benefitsSubtitle}
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((benefit, index) => {
              const Icon = benefit.icon;

              return (
                <div
                  key={index}
                  className="rounded-2xl border border-lime-100 bg-white p-5 shadow-sm"
                >
                  <div className="flex size-12 items-center justify-center rounded-xl bg-lime-100 text-green-800">
                    <Icon size={24} />
                  </div>

                  <h3 className="mt-4 text-base font-extrabold leading-snug">
                    {benefit.title[locale]}
                  </h3>

                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {benefit.description[locale]}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================================================
          GERMAN TRAINING DETAIL
          ================================================== */}

      <section
        id="about-training"
        className="scroll-mt-24 bg-white"
      >
        <div className="mx-auto max-w-none px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-black sm:text-3xl lg:text-4xl">
              {t.detailsTitle}
            </h2>

            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              {t.detailsSubtitle}
            </p>
          </div>

          <div className="mx-auto mt-7 flex max-w-4xl items-start gap-3 rounded-xl border border-lime-200 bg-lime-50 p-4">
            <Info
              size={19}
              className="mt-0.5 shrink-0 text-green-800"
            />

            <p className="text-xs leading-relaxed text-green-950 sm:text-sm">
              {t.germanyOnly}
            </p>
          </div>

          <div className="mx-auto mt-7 grid max-w-5xl gap-3 md:grid-cols-2">
            {DETAILS.map((item) => (
              <DetailCard
                key={item.id}
                item={item}
                locale={locale}
                open={
                  openDetail === item.id
                }
                onToggle={() =>
                  setOpenDetail(
                    openDetail === item.id
                      ? null
                      : item.id
                  )
                }
              />
            ))}
          </div>

          <div className="mx-auto mt-7 flex max-w-5xl flex-col gap-3 sm:flex-row sm:justify-center">
            <CTA href={ROUTES.categories}>
              <CarFront size={18} />
              {t.categories}
            </CTA>

            <CTA
              href={ROUTES.application}
              outline
            >
              <ClipboardList size={18} />
              {t.apply}
            </CTA>
          </div>
        </div>
      </section>

      {/* ==================================================
          CLASSROOMS AND VEHICLES
          ================================================== */}

      <section className="bg-[#f1f6ec]">
        <div className="mx-auto max-w-none px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
          <div className="mb-8 max-w-3xl">
            <h2 className="text-2xl font-black sm:text-3xl lg:text-4xl">
              {t.learningTitle}
            </h2>

            <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
              {t.learningIntro}
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <article className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <Photo
                imageKey="classroom"
                alt={t.classroom}
                icon={BookOpen}
                className="aspect-16/10"
              />

              <div className="p-5">
                <h3 className="text-lg font-extrabold">
                  {t.classroom}
                </h3>

                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {t.classroomText}
                </p>
              </div>
            </article>

            <article className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <Photo
                imageKey="vehicle"
                alt={t.vehicle}
                icon={Gauge}
                className="aspect-16/10"
              />

              <div className="p-5">
                <h3 className="text-lg font-extrabold">
                  {t.vehicle}
                </h3>

                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {t.vehicleText}
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ==================================================
          FOUR STEPS
          ================================================== */}

      <section className="bg-white">
        <div className="mx-auto max-w-none px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
          <h2 className="text-center text-2xl font-black sm:text-3xl">
            {t.processTitle}
          </h2>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.steps.map((step, index) => {
              const icons = [
                Users,
                CarFront,
                ClipboardCheck,
                GraduationCap,
              ];

              const Icon = icons[index];

              return (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-200 p-5 text-center"
                >
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-linear-to-br from-lime-500 to-green-800 text-white">
                    <Icon size={25} />
                  </div>

                  <div className="mt-4 text-xs font-bold text-green-800">
                    {String(index + 1).padStart(
                      2,
                      "0"
                    )}
                  </div>

                  <h3 className="mt-2 text-sm font-extrabold leading-relaxed">
                    {step}
                  </h3>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================================================
          CONTACT & APPLICATION
          ================================================== */}

      <section className="bg-[#142117] text-white">
        <div className="mx-auto grid max-w-none gap-9 px-4 py-7 sm:px-6 sm:py-9 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-2 text-xs font-bold text-lime-300">
              <HeartHandshake size={17} />

              {t.contact}
            </div>

            <h2 className="mt-5 text-2xl font-black sm:text-3xl lg:text-4xl">
              {t.contactTitle}
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-200 sm:text-base">
              {t.contactIntro}
            </p>

            <div className="mt-7 space-y-4">
              <div className="flex items-start gap-3">
                <MapPin
                  size={20}
                  className="shrink-0 text-lime-300"
                />

                <span className="text-sm leading-relaxed">
                  {CONTACT.formattedAddress}
                </span>
              </div>

              <a
                href={CONTACT.phoneHref}
                className="flex items-center gap-3 text-sm hover:text-lime-300"
              >
                <Phone
                  size={20}
                  className="shrink-0 text-lime-300"
                />

                <span dir="ltr">
                  {CONTACT.phoneDisplay}
                </span>
              </a>

              <a
                href={CONTACT.emailHref}
                className="flex items-center gap-3 break-all text-sm hover:text-lime-300"
              >
                <Mail
                  size={20}
                  className="shrink-0 text-lime-300"
                />

                <span dir="ltr">
                  {CONTACT.email}
                </span>
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/10 p-5 sm:p-8">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-lime-400/20 text-lime-300">
              <ShieldCheck size={35} />
            </div>

            <h3 className="mt-5 text-xl font-black">
              {t.headline}
            </h3>

            <p className="mt-4 text-sm leading-relaxed text-slate-200">
              {t.intro}
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <CTA href={ROUTES.application}>
                <ClipboardList size={19} />

                {t.apply}

                <Arrow size={17} />
              </CTA>

              <CTA
                href={CONTACT.emailHref}
                outline
                dark
              >
                <Mail size={18} />
                {t.email}
              </CTA>

              <CTA
                href={CONTACT.phoneHref}
                outline
                dark
              >
                <Phone size={18} />
                {t.call}
              </CTA>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================
          LEGAL INFORMATION
          ================================================== */}

      <section className="bg-[#f7f9f5]">
        <div className="mx-auto max-w-none px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <Info
              size={19}
              className="mt-0.5 shrink-0 text-green-800"
            />

            <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
              {t.legal}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
