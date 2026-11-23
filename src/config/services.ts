
/* ============================================================
   FAHRSCHULE TAYM
   src/config/services.ts

   SERVICES PAGE — CENTRAL CONFIGURATION

   Countries:
   Germany, Austria, Belgium, Italy, Spain

   Languages:
   German, Arabic, Turkish, Spanish

   Features:
   - Localized services
   - Country availability
   - Service images
   - Partner approval controls
   - Contact details
   - Existing navigation links
   - Application steps
   - Commercial and legal notices

   No API.
   No database access.
   No UI component.
   No new layout or navigation.
   ============================================================ */

/* ============================================================
   1. TYPES AND CONSTANTS
   ============================================================ */

export const SERVICES_COUNTRIES = [
  "DE",
  "AT",
  "BE",
  "IT",
  "ES",
] as const;

export const SERVICES_LOCALES = [
  "de",
  "ar",
  "tr",
  "es",
] as const;

export type ServiceCountry =
  (typeof SERVICES_COUNTRIES)[number];

export type ServiceLocale =
  (typeof SERVICES_LOCALES)[number];

export type LocalizedServiceText =
  Record<ServiceLocale, string>;

export const DEFAULT_SERVICES_LOCALE:
  ServiceLocale = "de";

export const DEFAULT_SERVICES_COUNTRY:
  ServiceCountry = "DE";

export type ServiceAvailability =
  | "available"
  | "confirmation_required"
  | "unavailable";

export type ServiceCategory =
  | "training"
  | "administration"
  | "professional"
  | "assistance";

export type ServiceId =
  | "theory_training"
  | "practical_training"
  | "license_applications"
  | "document_assistance"
  | "exam_preparation"
  | "professional_drivers"
  | "transport_careers"
  | "candidate_support";

export type ServiceImageId =
  | "hero"
  | "theory"
  | "practical"
  | "administration"
  | "exams"
  | "professional"
  | "partnerships"
  | "support";

export type ServicesLinkKey =
  | "home"
  | "services"
  | "categories"
  | "application"
  | "login"
  | "register"
  | "contactEmail"
  | "contactPhone";

export type PartnerStatus =
  | "pending_verification"
  | "verified"
  | "inactive";

export type PartnerType =
  | "examination"
  | "institution"
  | "training"
  | "transport"
  | "employment";

/* ============================================================
   2. NORMALIZATION
   ============================================================ */

export function normalizeServicesLocale(
  value: unknown
): ServiceLocale {
  if (typeof value !== "string") {
    return DEFAULT_SERVICES_LOCALE;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];

  return (
    SERVICES_LOCALES as readonly string[]
  ).includes(normalized)
    ? (normalized as ServiceLocale)
    : DEFAULT_SERVICES_LOCALE;
}

export function normalizeServicesCountry(
  value: unknown
): ServiceCountry | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .toUpperCase();

  return (
    SERVICES_COUNTRIES as readonly string[]
  ).includes(normalized)
    ? (normalized as ServiceCountry)
    : null;
}

export function getServicesDirection(
  locale: unknown
): "ltr" | "rtl" {
  return normalizeServicesLocale(locale) === "ar"
    ? "rtl"
    : "ltr";
}

export function localizeServiceText(
  text: LocalizedServiceText,
  locale: unknown
): string {
  return text[normalizeServicesLocale(locale)];
}

/* ============================================================
   3. BRAND AND CONTACT DETAILS

   Values reused from the existing Header.

   Do not add invented opening hours,
   other branches or contact numbers.
   ============================================================ */

export const SERVICES_BRAND = {
  name: "Fahrschule TAYM",

  domain: "fahrschule-taym.de",

  website: "https://fahrschule-taym.de",

  primaryColor: "#78B900",

  darkGreen: "#245800",

  limeColor: "#A3D900",

  goldColor: "#D4AF37",

  darkColor: "#101820",

  whiteColor: "#FFFFFF",
} as const;

export const SERVICES_CONTACT = {
  organization: "Fahrschule TAYM",

  street: "Ernststr. 57",

  postalCode: "13509",

  city: "Berlin",

  countryCode: "DE" as ServiceCountry,

  country: "Deutschland",

  formattedAddress:
    "Ernststr. 57, D-13509 Berlin, Deutschland",

  phoneDisplay: "+49 176 39064254",
  austriaPhoneDisplay: "+43 678 58250295",
  austriaPhoneHref: "tel:+4367858250295",

  phoneE164: "+4917639064254",

  email: "info@fahrschule-taym.de",

  emailHref:
    "mailto:info@fahrschule-taym.de",

  phoneHref:
    "tel:+4917639064254",

  /*
   * Hours must be verified before publication.
   */

  openingHours: null as string | null,
} as const;

/* ============================================================
   4. EXISTING ROUTES

   Reuse the existing project routes.

   The dashboard application route is
   protected by the existing authentication.

   No duplicate login or application pages.
   ============================================================ */

export const SERVICES_LINKS: Record<
  ServicesLinkKey,
  string
> = {
  home: "/",

  services: "/services",

  categories: "/fuehrerscheinklassen",

  application: "/dashboard/application",

  login: "/login",

  register: "/register",

  contactEmail:
    SERVICES_CONTACT.emailHref,

  contactPhone:
    SERVICES_CONTACT.phoneHref,
};

/*
 * Only known local paths and the configured
 * contact mail/phone links are permitted.
 */

export function getServicesLink(
  key: ServicesLinkKey
): string {
  return SERVICES_LINKS[key];
}

/* ============================================================
   5. COUNTRY NAMES
   ============================================================ */

export const SERVICES_COUNTRY_NAMES: Record<
  ServiceCountry,
  LocalizedServiceText
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

export const SERVICES_COUNTRY_FLAGS: Record<
  ServiceCountry,
  string
> = {
  DE: "🇩🇪",
  AT: "🇦🇹",
  BE: "🇧🇪",
  IT: "🇮🇹",
  ES: "🇪🇸",
};

/* ============================================================
   6. IMAGE PATHS

   Existing local photographs used to illustrate
   the services. Paths are relative to /public.
   ============================================================ */

export const SERVICES_IMAGES: Record<
  ServiceImageId,
  string | null
> = {
  hero: "/images/couverture.jpg",

  theory: "/images/imageb.jpg",

  practical: "/images/imagea.jpg",

  administration: "/images/imageb.jpg",

  exams: "/images/imageb.jpg",

  professional: "/images/classe-t.jpg",

  partnerships: "/images/imageb.jpg",

  support: "/images/imageb.jpg",
};

/*
 * Allow only safe local image paths.
 */

export function getServiceImage(
  imageId: ServiceImageId
): string | null {
  const value = SERVICES_IMAGES[imageId];

  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("..") ||
    value.includes("\\") ||
    value.includes("%") ||
    !/^\/[A-Za-z0-9/_\-.]+$/.test(value) ||
    !/\.(jpg|jpeg|png|webp|avif)$/i.test(
      value
    )
  ) {
    return null;
  }

  return value;
}

/* ============================================================
   7. PAGE TRANSLATIONS

   All public service-page interface
   labels are translated into four
   supported project languages.
   ============================================================ */

export const SERVICES_TEXT = {
  de: {
    pageTitle: "Unsere Services",

    heroEyebrow: "FAHRSCHULE TAYM",

    heroTitle: "Mehr als eine Fahrschule",

    heroDescription:
      "Wir begleiten Sie auf Ihrem Weg zum Führerschein – mit theoretischer und praktischer Ausbildung, Unterstützung bei den Unterlagen und persönlicher Betreuung.",

    heroSecondary:
      "Entdecken Sie unsere Leistungen und informieren Sie sich über die Möglichkeiten in Ihrem Land.",

    applyNow: "Führerschein beantragen",

    discoverCategories:
      "Führerscheinklassen entdecken",

    discoverServices:
      "Unsere Leistungen entdecken",

    learnMore: "Mehr erfahren",

    contactUs: "Kontakt aufnehmen",

    countrySelector: "Land auswählen",

    selectCountryHint:
      "Wählen Sie das Land aus, über dessen Leistungen Sie sich informieren möchten.",

    accountCountryNotice:
      "Bei einem Antrag gelten das im Kandidatenkonto gespeicherte Land und die dort verfügbaren Angebote.",

    servicesTitle: "Unsere Leistungen",

    servicesSubtitle:
      "Individuelle Begleitung von der Anmeldung bis zur Vorbereitung auf die erforderlichen Prüfungen.",

    theoryTitle:
      "Theoretische Führerscheinausbildung",

    practicalTitle:
      "Praktische Fahrausbildung",

    administrationTitle:
      "Unterstützung bei Anträgen und Unterlagen",

    professionalTitle:
      "Ausbildung für berufliche Fahrer",

    partnersTitle:
      "Unser Kooperationsnetzwerk",

    partnersDescription:
      "Wir arbeiten mit nachweislich bestätigten Kooperationspartnern zusammen. Die konkrete Zusammenarbeit richtet sich nach Land und Leistungsbereich.",

    partnersEmpty:
      "Informationen zu bestätigten Kooperationen werden hier veröffentlicht, sobald die Veröffentlichung freigegeben ist.",

    processTitle:
      "So begleiten wir Sie",

    processSubtitle:
      "Vier einfache Schritte zu Ihrem persönlichen Ausbildungs- und Antragsprozess.",

    contactTitle:
      "Sie haben Fragen?",

    contactDescription:
      "Unser Team informiert Sie über verfügbare Leistungen, Führerscheinklassen und die nächsten Schritte.",

    address: "Adresse",

    phone: "Telefon",

    email: "E-Mail",

    callNow: "Jetzt anrufen",

    sendEmail: "E-Mail schreiben",

    register: "Registrieren",

    login: "Anmelden",

    categories: "Führerscheinklassen",

    fromAccount: "Zum persönlichen Antrag",

    available: "Verfügbar",

    confirmationRequired:
      "Verfügbarkeit auf Anfrage",

    unavailable: "Derzeit nicht verfügbar",

    availabilityNotice:
      "Die Verfügbarkeit bestimmter Leistungen kann je nach Land und Standort abweichen.",

    pricingNotice:
      "Ausbildungspreise und Anmeldegebühren finden Sie in der Übersicht der Führerscheinklassen.",

    noGuarantee:
      "Eine Anmeldung bei TAYM garantiert weder das Bestehen einer Prüfung noch die Erteilung einer behördlichen Fahrerlaubnis oder eine Arbeitsstelle.",

    partnerNotice:
      "Die Anerkennung von Prüfungen und die Erteilung amtlicher Fahrerlaubnisse erfolgen ausschließlich durch die jeweils zuständigen Stellen.",

    step1Title: "Konto erstellen",

    step1Description:
      "Registrieren Sie sich und bestätigen Sie Ihre Kontaktdaten.",

    step2Title:
      "Führerscheinklasse auswählen",

    step2Description:
      "Informieren Sie sich über die für Ihr Land angebotenen Klassen und Preise.",

    step3Title:
      "Antrag und Unterlagen vorbereiten",

    step3Description:
      "Prüfen Sie Ihre persönlichen Angaben und reichen Sie die erforderlichen Dokumente ein.",

    step4Title:
      "Ausbildung und weitere Schritte",

    step4Description:
      "Unser Team begleitet Sie bei der Vorbereitung und informiert Sie über die notwendigen Verfahren.",

    training: "Ausbildung",

    administrativeSupport:
      "Verwaltungsunterstützung",

    professionalServices:
      "Berufliche Perspektiven",

    candidateSupport:
      "Betreuung und Beratung",

    imageUnavailable:
      "Bild wird ergänzt",

    secureProcess:
      "Sicherer Online-Antragsprozess",
  },

  ar: {
    pageTitle: "خدماتنا",

    heroEyebrow: "FAHRSCHULE TAYM",

    heroTitle: "أكثر من مجرد مدرسة لتعليم القيادة",

    heroDescription:
      "نرافقك في رحلتك للحصول على رخصة القيادة من خلال التدريب النظري والعملي والمساعدة في إعداد الوثائق والمتابعة الشخصية.",

    heroSecondary:
      "اكتشف خدماتنا وتعرف على الإمكانيات المتاحة في بلدك.",

    applyNow: "تقديم طلب رخصة القيادة",

    discoverCategories:
      "استكشاف فئات رخص القيادة",

    discoverServices: "اكتشف خدماتنا",

    learnMore: "معرفة المزيد",

    contactUs: "اتصل بنا",

    countrySelector: "اختر الدولة",

    selectCountryHint:
      "اختر الدولة التي ترغب في التعرف على الخدمات المتاحة فيها.",

    accountCountryNotice:
      "عند تقديم الطلب، يتم اعتماد الدولة المسجلة في حساب المرشح والعروض المتاحة فيها.",

    servicesTitle: "خدماتنا",

    servicesSubtitle:
      "مرافقة شخصية من التسجيل حتى التحضير للاختبارات المطلوبة.",

    theoryTitle: "التدريب النظري على القيادة",

    practicalTitle: "التدريب العملي على القيادة",

    administrationTitle:
      "المساعدة في الطلبات والمستندات",

    professionalTitle:
      "تدريب السائقين المهنيين",

    partnersTitle: "شبكة التعاون لدينا",

    partnersDescription:
      "نتعاون مع شركاء تم التحقق من علاقات التعاون معهم. وتختلف طبيعة التعاون حسب البلد ونوع الخدمة.",

    partnersEmpty:
      "سيتم نشر معلومات التعاون المؤكد هنا بعد الموافقة على نشرها.",

    processTitle: "كيف نرافقك",

    processSubtitle:
      "أربع خطوات بسيطة لبدء مسار التدريب وتقديم الطلب.",

    contactTitle: "هل لديك أسئلة؟",

    contactDescription:
      "فريقنا يقدم لك المعلومات حول الخدمات المتاحة وفئات الرخص والخطوات التالية.",

    address: "العنوان",

    phone: "الهاتف",

    email: "البريد الإلكتروني",

    callNow: "اتصل الآن",

    sendEmail: "إرسال بريد إلكتروني",

    register: "إنشاء حساب",

    login: "تسجيل الدخول",

    categories: "فئات رخص القيادة",

    fromAccount: "الانتقال إلى الطلب الشخصي",

    available: "متاح",

    confirmationRequired:
      "التوفر حسب الاستفسار",

    unavailable: "غير متاح حالياً",

    availabilityNotice:
      "قد تختلف الخدمات المتاحة حسب البلد والموقع.",

    pricingNotice:
      "يمكنك الاطلاع على أسعار التدريب ورسوم التسجيل في صفحة فئات رخص القيادة.",

    noGuarantee:
      "التسجيل لدى TAYM لا يضمن اجتياز الاختبارات أو إصدار رخصة رسمية أو الحصول على وظيفة.",

    partnerNotice:
      "الاعتراف بالاختبارات وإصدار رخص القيادة الرسمية من اختصاص الجهات المخولة قانوناً فقط.",

    step1Title: "إنشاء حساب",

    step1Description:
      "سجل حسابك وأكد بيانات الاتصال الخاصة بك.",

    step2Title: "اختيار فئة الرخصة",

    step2Description:
      "تعرف على الفئات والأسعار المتاحة في بلدك.",

    step3Title:
      "إعداد الطلب والمستندات",

    step3Description:
      "راجع بياناتك الشخصية وقدم المستندات المطلوبة.",

    step4Title:
      "التدريب والخطوات التالية",

    step4Description:
      "يساعدك فريقنا في التحضير ويوضح لك الإجراءات اللازمة.",

    training: "التدريب",

    administrativeSupport:
      "المساعدة الإدارية",

    professionalServices:
      "الفرص المهنية",

    candidateSupport:
      "المتابعة والاستشارة",

    imageUnavailable:
      "ستتم إضافة الصورة",

    secureProcess:
      "عملية تقديم طلب آمنة عبر الإنترنت",
  },

  tr: {
    pageTitle: "Hizmetlerimiz",

    heroEyebrow: "FAHRSCHULE TAYM",

    heroTitle: "Bir sürücü kursundan daha fazlası",

    heroDescription:
      "Teorik ve pratik eğitim, belge hazırlama desteği ve kişisel danışmanlık ile ehliyet yolculuğunuzda yanınızdayız.",

    heroSecondary:
      "Hizmetlerimizi keşfedin ve ülkenizdeki seçenekler hakkında bilgi edinin.",

    applyNow: "Ehliyet başvurusu yap",

    discoverCategories:
      "Ehliyet sınıflarını keşfet",

    discoverServices:
      "Hizmetlerimizi keşfet",

    learnMore: "Daha fazla bilgi",

    contactUs: "İletişime geçin",

    countrySelector: "Ülke seçin",

    selectCountryHint:
      "Hakkında bilgi almak istediğiniz ülkeyi seçin.",

    accountCountryNotice:
      "Başvuruda aday hesabınıza kayıtlı ülke ve bu ülkeye ait seçenekler esas alınır.",

    servicesTitle: "Hizmetlerimiz",

    servicesSubtitle:
      "Kayıttan gerekli sınavlara hazırlığa kadar kişisel destek.",

    theoryTitle:
      "Teorik sürücü eğitimi",

    practicalTitle:
      "Pratik sürüş eğitimi",

    administrationTitle:
      "Başvuru ve belge desteği",

    professionalTitle:
      "Profesyonel sürücüler için eğitim",

    partnersTitle:
      "İş birliği ağımız",

    partnersDescription:
      "İş birliği ilişkisi doğrulanmış kuruluşlarla çalışıyoruz. İş birliğinin kapsamı ülkeye ve hizmete göre değişebilir.",

    partnersEmpty:
      "Doğrulanmış iş birliklerine ilişkin bilgiler, yayımlama izni alındığında burada paylaşılacaktır.",

    processTitle:
      "Size nasıl yardımcı oluyoruz?",

    processSubtitle:
      "Eğitim ve başvuru süreciniz için dört basit adım.",

    contactTitle:
      "Sorularınız mı var?",

    contactDescription:
      "Ekibimiz hizmetler, ehliyet sınıfları ve sonraki adımlar hakkında bilgi verir.",

    address: "Adres",

    phone: "Telefon",

    email: "E-posta",

    callNow: "Şimdi ara",

    sendEmail: "E-posta gönder",

    register: "Kayıt ol",

    login: "Giriş yap",

    categories: "Ehliyet sınıfları",

    fromAccount:
      "Kişisel başvuruya git",

    available: "Mevcut",

    confirmationRequired:
      "Müsaitlik için iletişime geçin",

    unavailable:
      "Şu anda mevcut değil",

    availabilityNotice:
      "Bazı hizmetlerin sunulması ülke ve konuma göre değişebilir.",

    pricingNotice:
      "Eğitim fiyatları ve kayıt ücretleri ehliyet sınıfları sayfasında gösterilir.",

    noGuarantee:
      "TAYM kaydı sınav başarısını, resmi ehliyet verilmesini veya işe yerleştirmeyi garanti etmez.",

    partnerNotice:
      "Sınavların tanınması ve resmi sürücü belgelerinin verilmesi yalnızca yetkili kurumların sorumluluğundadır.",

    step1Title: "Hesap oluşturun",

    step1Description:
      "Kaydolun ve iletişim bilgilerinizi doğrulayın.",

    step2Title:
      "Ehliyet sınıfınızı seçin",

    step2Description:
      "Ülkenizde sunulan sınıfları ve fiyatları inceleyin.",

    step3Title:
      "Başvuru ve belgeleri hazırlayın",

    step3Description:
      "Kişisel bilgilerinizi kontrol edin ve belgeleri yükleyin.",

    step4Title:
      "Eğitim ve sonraki adımlar",

    step4Description:
      "Ekibimiz hazırlık sürecinizde size yardımcı olur ve gerekli işlemleri açıklar.",

    training: "Eğitim",

    administrativeSupport:
      "İdari destek",

    professionalServices:
      "Mesleki fırsatlar",

    candidateSupport:
      "Danışmanlık ve destek",

    imageUnavailable:
      "Görsel eklenecek",

    secureProcess:
      "Güvenli çevrimiçi başvuru süreci",
  },

  es: {
    pageTitle: "Nuestros servicios",

    heroEyebrow: "FAHRSCHULE TAYM",

    heroTitle:
      "Mucho más que una autoescuela",

    heroDescription:
      "Le acompañamos en el camino hacia su permiso de conducir mediante formación teórica y práctica, apoyo documental y atención personalizada.",

    heroSecondary:
      "Descubra nuestros servicios y conozca las opciones disponibles en su país.",

    applyNow:
      "Solicitar el permiso de conducir",

    discoverCategories:
      "Descubrir las categorías",

    discoverServices:
      "Descubrir nuestros servicios",

    learnMore: "Más información",

    contactUs: "Contactar",

    countrySelector:
      "Seleccionar país",

    selectCountryHint:
      "Seleccione el país sobre cuyos servicios desea informarse.",

    accountCountryNotice:
      "Para presentar una solicitud se utilizarán el país registrado en su cuenta y las opciones disponibles para ese país.",

    servicesTitle:
      "Nuestros servicios",

    servicesSubtitle:
      "Acompañamiento individual desde la inscripción hasta la preparación de los exámenes requeridos.",

    theoryTitle:
      "Formación teórica de conducción",

    practicalTitle:
      "Formación práctica de conducción",

    administrationTitle:
      "Asistencia con solicitudes y documentos",

    professionalTitle:
      "Formación para conductores profesionales",

    partnersTitle:
      "Nuestra red de colaboración",

    partnersDescription:
      "Colaboramos con entidades cuya relación de cooperación ha sido verificada. El alcance depende del país y del servicio.",

    partnersEmpty:
      "La información sobre colaboraciones confirmadas se publicará aquí cuando se autorice su difusión.",

    processTitle:
      "Cómo le acompañamos",

    processSubtitle:
      "Cuatro pasos sencillos para comenzar su formación y solicitud.",

    contactTitle:
      "¿Tiene alguna pregunta?",

    contactDescription:
      "Nuestro equipo puede informarle sobre servicios, categorías de permisos y próximos pasos.",

    address: "Dirección",

    phone: "Teléfono",

    email: "Correo electrónico",

    callNow: "Llamar ahora",

    sendEmail:
      "Enviar un correo electrónico",

    register: "Registrarse",

    login: "Iniciar sesión",

    categories:
      "Categorías de permiso",

    fromAccount:
      "Ir a mi solicitud",

    available: "Disponible",

    confirmationRequired:
      "Disponibilidad previa consulta",

    unavailable:
      "No disponible actualmente",

    availabilityNotice:
      "La disponibilidad de determinados servicios puede variar según el país y la ubicación.",

    pricingNotice:
      "Consulte los precios de formación y las tasas de inscripción en la página de categorías.",

    noGuarantee:
      "La inscripción en TAYM no garantiza aprobar los exámenes, obtener un permiso oficial ni conseguir un empleo.",

    partnerNotice:
      "El reconocimiento de exámenes y la expedición de permisos oficiales corresponden exclusivamente a las autoridades competentes.",

    step1Title: "Crear una cuenta",

    step1Description:
      "Regístrese y verifique sus datos de contacto.",

    step2Title:
      "Elegir la categoría",

    step2Description:
      "Consulte las categorías y precios ofrecidos en su país.",

    step3Title:
      "Preparar la solicitud",

    step3Description:
      "Revise sus datos personales y presente los documentos necesarios.",

    step4Title:
      "Formación y próximos pasos",

    step4Description:
      "Nuestro equipo le orientará durante la preparación y le informará sobre los trámites necesarios.",

    training: "Formación",

    administrativeSupport:
      "Asistencia administrativa",

    professionalServices:
      "Oportunidades profesionales",

    candidateSupport:
      "Atención y asesoramiento",

    imageUnavailable:
      "Imagen pendiente",

    secureProcess:
      "Proceso de solicitud seguro en línea",
  },
} as const satisfies Record<
  ServiceLocale,
  Record<string, string>
>;

/* ============================================================
   8. COUNTRY SERVICE AVAILABILITY

   This configuration is deliberately
   conservative.

   "confirmation_required" means the
   visitor must contact TAYM to verify
   whether the service is actually offered
   in that country.

   Never silently turn unverified
   country operations into confirmed ones.
   ============================================================ */

const CONTACT_FIRST_AVAILABILITY: Record<
  ServiceCountry,
  ServiceAvailability
> = {
  DE: "confirmation_required",
  AT: "confirmation_required",
  BE: "confirmation_required",
  IT: "confirmation_required",
  ES: "confirmation_required",
};

/*
 * Public information and online
 * application navigation are available
 * for all configured countries.

 * This does not assert that practical
 * training is locally available everywhere.
 */

const DIGITAL_APPLICATION_AVAILABILITY: Record<
  ServiceCountry,
  ServiceAvailability
> = {
  DE: "available",
  AT: "available",
  BE: "available",
  IT: "available",
  ES: "available",
};

/* ============================================================
   9. SERVICE RECORD
   ============================================================ */

export type ServiceDefinition = {
  id: ServiceId;

  category: ServiceCategory;

  title: LocalizedServiceText;

  description: LocalizedServiceText;

  features: readonly LocalizedServiceText[];

  imageId: ServiceImageId;

  icon:
    | "book-open"
    | "car-front"
    | "clipboard-list"
    | "file-check"
    | "graduation-cap"
    | "truck"
    | "briefcase-business"
    | "headset";

  availability: Record<
    ServiceCountry,
    ServiceAvailability
  >;

  primaryLink: ServicesLinkKey;

  secondaryLink?: ServicesLinkKey;

  order: number;

  visible: boolean;
};

/* ============================================================
   10. SERVICES

   All names and descriptions are editable
   in one place.

   No new pricing is introduced.
   Training prices remain in:
   src/config/driving-licenses.ts
   ============================================================ */

export const SERVICES_CATALOG:
  readonly ServiceDefinition[] = [

  /* --------------------------------------------------------
     THEORY TRAINING
     -------------------------------------------------------- */

  {
    id: "theory_training",

    category: "training",

    order: 1,

    visible: true,

    icon: "book-open",

    imageId: "theory",

    title: {
      de: "Theoretische Führerscheinausbildung",
      ar: "التدريب النظري على القيادة",
      tr: "Teorik ehliyet eğitimi",
      es: "Formación teórica de conducción",
    },

    description: {
      de: "Wir unterstützen Fahrschüler beim Lernen der Verkehrsregeln, Verkehrszeichen und wichtigen Grundlagen für die theoretische Prüfung.",
      ar: "نساعد المتدربين على تعلم قواعد المرور والإشارات المرورية والأساسيات المهمة للتحضير للاختبار النظري.",
      tr: "Trafik kuralları, trafik işaretleri ve teorik sınavın temel konularını öğrenmenize yardımcı oluyoruz.",
      es: "Ayudamos a los alumnos a estudiar las normas de circulación, las señales y los fundamentos necesarios para preparar el examen teórico.",
    },

    features: [
      {
        de: "Verkehrsregeln und Verkehrszeichen",
        ar: "قواعد المرور والإشارات",
        tr: "Trafik kuralları ve işaretleri",
        es: "Normas y señales de tráfico",
      },
      {
        de: "Theoretische Prüfungsvorbereitung",
        ar: "التحضير للاختبار النظري",
        tr: "Teorik sınava hazırlık",
        es: "Preparación para el examen teórico",
      },
      {
        de: "Begleitung beim Lernfortschritt",
        ar: "متابعة تقدم المتدرب",
        tr: "Öğrenme sürecinin takibi",
        es: "Seguimiento del aprendizaje",
      },
    ],

    availability: {
      ...CONTACT_FIRST_AVAILABILITY,
    },

    primaryLink: "categories",

    secondaryLink: "contactEmail",
  },

  /* --------------------------------------------------------
     PRACTICAL DRIVING
     -------------------------------------------------------- */

  {
    id: "practical_training",

    category: "training",

    order: 2,

    visible: true,

    icon: "car-front",

    imageId: "practical",

    title: {
      de: "Praktische Fahrausbildung",
      ar: "التدريب العملي على القيادة",
      tr: "Pratik sürüş eğitimi",
      es: "Formación práctica de conducción",
    },

    description: {
      de: "Praktische Fahrstunden helfen dabei, Fahrkompetenz, Verkehrssicherheit und Sicherheit im Umgang mit dem Fahrzeug zu entwickeln.",
      ar: "تساعد دروس القيادة العملية على تطوير مهارات القيادة والسلامة المرورية والتحكم في المركبة.",
      tr: "Pratik sürüş dersleri araç kontrolünü, sürüş becerilerini ve trafik güvenliğini geliştirmeyi amaçlar.",
      es: "Las clases prácticas ayudan a desarrollar habilidades de conducción, seguridad vial y dominio del vehículo.",
    },

    features: [
      {
        de: "Fahrtraining je nach Führerscheinklasse",
        ar: "تدريب القيادة حسب فئة الرخصة",
        tr: "Ehliyet sınıfına göre sürüş eğitimi",
        es: "Prácticas según la categoría",
      },
      {
        de: "Sicheres Fahren im Straßenverkehr",
        ar: "القيادة الآمنة على الطرق",
        tr: "Trafikte güvenli sürüş",
        es: "Conducción segura en carretera",
      },
      {
        de: "Vorbereitung auf die praktische Prüfung",
        ar: "التحضير للاختبار العملي",
        tr: "Direksiyon sınavına hazırlık",
        es: "Preparación para el examen práctico",
      },
    ],

    availability: {
      ...CONTACT_FIRST_AVAILABILITY,
    },

    primaryLink: "application",

    secondaryLink: "contactEmail",
  },

  /* --------------------------------------------------------
     ONLINE APPLICATION
     -------------------------------------------------------- */

  {
    id: "license_applications",

    category: "administration",

    order: 3,

    visible: true,

    icon: "clipboard-list",

    imageId: "administration",

    title: {
      de: "Online-Führerscheinantrag",
      ar: "طلب رخصة القيادة عبر الإنترنت",
      tr: "Çevrimiçi ehliyet başvurusu",
      es: "Solicitud de permiso en línea",
    },

    description: {
      de: "Über Ihren persönlichen Bereich können Sie Ihre Führerscheinklasse auswählen, Angaben ergänzen und einen Antrag zur Bearbeitung durch TAYM einreichen.",
      ar: "من خلال حسابك الشخصي يمكنك اختيار فئة الرخصة واستكمال بياناتك وإرسال طلب لمراجعته بواسطة TAYM.",
      tr: "Kişisel hesabınızdan ehliyet sınıfınızı seçebilir, bilgilerinizi tamamlayabilir ve TAYM'ın değerlendirmesi için başvuru yapabilirsiniz.",
      es: "Desde su cuenta personal puede elegir la categoría, completar sus datos y enviar una solicitud para su tramitación por TAYM.",
    },

    features: [
      {
        de: "Geschützter persönlicher Bereich",
        ar: "حساب شخصي محمي",
        tr: "Korumalı kişisel hesap",
        es: "Área personal protegida",
      },
      {
        de: "Kategorie und Ausbildungspreis auswählen",
        ar: "اختيار الفئة وعرض سعر التدريب",
        tr: "Sınıf ve eğitim ücretini seçme",
        es: "Elección de categoría y precio",
      },
      {
        de: "Dokumente online einreichen",
        ar: "رفع المستندات عبر الإنترنت",
        tr: "Belgeleri çevrimiçi gönderme",
        es: "Presentación de documentos en línea",
      },
    ],

    availability: {
      ...DIGITAL_APPLICATION_AVAILABILITY,
    },

    primaryLink: "application",

    secondaryLink: "categories",
  },

  /* --------------------------------------------------------
     DOCUMENT ASSISTANCE
     -------------------------------------------------------- */

  {
    id: "document_assistance",

    category: "administration",

    order: 4,

    visible: true,

    icon: "file-check",

    imageId: "administration",

    title: {
      de: "Hilfe bei Dokumenten und Formalitäten",
      ar: "المساعدة في المستندات والإجراءات",
      tr: "Belge ve başvuru işlemlerinde destek",
      es: "Asistencia documental y administrativa",
    },

    description: {
      de: "Wir unterstützen bei der Zusammenstellung der Unterlagen und informieren über die für den jeweiligen Antrag relevanten Formalitäten.",
      ar: "نساعد على تجهيز المستندات المطلوبة ونوضح الإجراءات المتعلقة بكل طلب.",
      tr: "Gerekli belgelerin hazırlanmasına yardımcı olur ve başvuru işlemleri hakkında bilgi veririz.",
      es: "Ayudamos a preparar la documentación y explicamos los trámites correspondientes a cada solicitud.",
    },

    features: [
      {
        de: "Prüfung der eingereichten Angaben",
        ar: "مراجعة البيانات المقدمة",
        tr: "Gönderilen bilgilerin kontrolü",
        es: "Revisión de datos presentados",
      },
      {
        de: "Unterstützung bei Wohnsitznachweisen",
        ar: "المساعدة في إثبات الإقامة",
        tr: "İkamet belgelerinde destek",
        es: "Ayuda con justificantes de domicilio",
      },
      {
        de: "Informationen zu ergänzenden Nachweisen",
        ar: "التوجيه بشأن المستندات الإضافية",
        tr: "Ek belgeler hakkında bilgilendirme",
        es: "Orientación sobre otros documentos",
      },
    ],

    availability: {
      ...CONTACT_FIRST_AVAILABILITY,
    },

    primaryLink: "application",

    secondaryLink: "contactEmail",
  },

  /* --------------------------------------------------------
     EXAM PREPARATION
     -------------------------------------------------------- */

  {
    id: "exam_preparation",

    category: "training",

    order: 5,

    visible: true,

    icon: "graduation-cap",

    imageId: "exams",

    title: {
      de: "Vorbereitung auf Führerscheinprüfungen",
      ar: "التحضير لاختبارات رخصة القيادة",
      tr: "Ehliyet sınavlarına hazırlık",
      es: "Preparación para exámenes de conducir",
    },

    description: {
      de: "Gezielte Vorbereitung auf die theoretischen und praktischen Anforderungen der jeweiligen Führerscheinklasse.",
      ar: "التحضير المنظم للمتطلبات النظرية والعملية الخاصة بفئة رخصة القيادة.",
      tr: "İlgili ehliyet sınıfının teorik ve pratik sınav şartlarına yönelik hazırlık.",
      es: "Preparación adaptada a los requisitos teóricos y prácticos de cada categoría.",
    },

    features: [
      {
        de: "Lern- und Prüfungsvorbereitung",
        ar: "الاستعداد للدراسة والاختبارات",
        tr: "Öğrenim ve sınav hazırlığı",
        es: "Preparación académica y de exámenes",
      },
      {
        de: "Informationen zum Prüfungsablauf",
        ar: "شرح مراحل الاختبار",
        tr: "Sınav süreci hakkında bilgi",
        es: "Información sobre el proceso de examen",
      },
      {
        de: "Individuelle Unterstützung",
        ar: "دعم حسب احتياجات المتدرب",
        tr: "Bireysel destek",
        es: "Apoyo individual",
      },
    ],

    availability: {
      ...CONTACT_FIRST_AVAILABILITY,
    },

    primaryLink: "categories",

    secondaryLink: "contactEmail",
  },

  /* --------------------------------------------------------
     PROFESSIONAL DRIVER TRAINING
     -------------------------------------------------------- */

  {
    id: "professional_drivers",

    category: "professional",

    order: 6,

    visible: true,

    icon: "truck",

    imageId: "professional",

    title: {
      de: "Qualifizierung für Berufskraftfahrer",
      ar: "التأهيل للقيادة المهنية",
      tr: "Profesyonel sürücü eğitimi",
      es: "Formación para conductores profesionales",
    },

    description: {
      de: "Informationen zu Ausbildungswegen für Lkw-, Bus- und weitere berufliche Fahrerlaubnisklassen, einschließlich möglicher zusätzlicher Qualifikationen.",
      ar: "معلومات عن مسارات تدريب سائقي الشاحنات والحافلات وفئات القيادة المهنية، بما في ذلك المؤهلات الإضافية المحتملة.",
      tr: "Kamyon, otobüs ve diğer mesleki ehliyet sınıfları ile gerekebilecek ek yeterlilikler hakkında bilgi.",
      es: "Información sobre itinerarios formativos para camiones, autobuses y otras categorías profesionales, incluidas posibles cualificaciones adicionales.",
    },

    features: [
      {
        de: "Informationen zu C-, CE- und D-Klassen",
        ar: "معلومات عن الفئات C وCE وD",
        tr: "C, CE ve D sınıfları hakkında bilgi",
        es: "Información sobre C, CE y D",
      },
      {
        de: "Prüfung individueller Voraussetzungen",
        ar: "التحقق من شروط القبول الفردية",
        tr: "Bireysel şartların değerlendirilmesi",
        es: "Evaluación de requisitos individuales",
      },
      {
        de: "Hinweise zu beruflichen Zusatzqualifikationen",
        ar: "التوجيه بشأن المؤهلات المهنية الإضافية",
        tr: "Ek mesleki yeterlilikler hakkında bilgi",
        es: "Orientación sobre cualificaciones profesionales",
      },
    ],

    availability: {
      ...CONTACT_FIRST_AVAILABILITY,
    },

    primaryLink: "categories",

    secondaryLink: "contactEmail",
  },

  /* --------------------------------------------------------
     PROFESSIONAL OPPORTUNITIES
     -------------------------------------------------------- */

  {
    id: "transport_careers",

    category: "professional",

    order: 7,

    visible: true,

    icon: "briefcase-business",

    imageId: "partnerships",

    title: {
      de: "Orientierung für Berufe im Transportwesen",
      ar: "التوجيه المهني في قطاع النقل",
      tr: "Ulaşım sektöründe kariyer rehberliği",
      es: "Orientación profesional en transporte",
    },

    description: {
      de: "Wir informieren Interessenten über mögliche Berufswege im Personenverkehr, Gütertransport und in der Logistik. Konkrete Vermittlungen werden nur angeboten, wenn entsprechende Kooperationen bestehen.",
      ar: "نقدم معلومات عن المسارات المهنية المحتملة في نقل الركاب والبضائع والخدمات اللوجستية. ولا يتم عرض التوظيف المباشر إلا عند وجود تعاون مؤكد.",
      tr: "Yolcu taşımacılığı, yük taşımacılığı ve lojistikteki meslek yolları hakkında bilgi sunuyoruz. Somut işe yönlendirmeler yalnızca doğrulanmış iş birlikleri kapsamında sunulur.",
      es: "Ofrecemos información sobre salidas profesionales en transporte de viajeros, mercancías y logística. La intermediación concreta solo se ofrece cuando existe una colaboración confirmada.",
    },

    features: [
      {
        de: "Berufsbilder im Personenverkehr",
        ar: "المهن في نقل الركاب",
        tr: "Yolcu taşımacılığı meslekleri",
        es: "Profesiones de transporte de viajeros",
      },
      {
        de: "Berufsbilder in Transport und Logistik",
        ar: "المهن في النقل والخدمات اللوجستية",
        tr: "Taşımacılık ve lojistik meslekleri",
        es: "Profesiones de transporte y logística",
      },
      {
        de: "Informationen zu erforderlichen Qualifikationen",
        ar: "معلومات عن المؤهلات المطلوبة",
        tr: "Gerekli yeterlilikler hakkında bilgi",
        es: "Información sobre cualificaciones necesarias",
      },
    ],

    availability: {
      ...CONTACT_FIRST_AVAILABILITY,
    },

    primaryLink: "contactEmail",

    secondaryLink: "categories",
  },

  /* --------------------------------------------------------
     PERSONAL CANDIDATE SUPPORT
     -------------------------------------------------------- */

  {
    id: "candidate_support",

    category: "assistance",

    order: 8,

    visible: true,

    icon: "headset",

    imageId: "support",

    title: {
      de: "Persönliche Beratung und Betreuung",
      ar: "الاستشارة والمتابعة الشخصية",
      tr: "Kişisel danışmanlık ve destek",
      es: "Asesoramiento y atención personalizada",
    },

    description: {
      de: "Unser Team beantwortet Fragen zu den verfügbaren Leistungen, zum Antragsverfahren und zu den weiteren Schritten.",
      ar: "يجيب فريقنا عن الأسئلة المتعلقة بالخدمات المتاحة وإجراءات الطلب والخطوات التالية.",
      tr: "Ekibimiz mevcut hizmetler, başvuru süreci ve sonraki adımlar hakkındaki sorularınızı yanıtlar.",
      es: "Nuestro equipo responde a las preguntas sobre servicios disponibles, solicitudes y próximos pasos.",
    },

    features: [
      {
        de: "Informationen zum Antragsprozess",
        ar: "معلومات عن خطوات تقديم الطلب",
        tr: "Başvuru süreci hakkında bilgi",
        es: "Información sobre el proceso de solicitud",
      },
      {
        de: "Beratung zu Führerscheinklassen",
        ar: "استشارة حول فئات الرخص",
        tr: "Ehliyet sınıfları hakkında danışmanlık",
        es: "Asesoramiento sobre categorías",
      },
      {
        de: "Kontakt per Telefon und E-Mail",
        ar: "التواصل عبر الهاتف والبريد الإلكتروني",
        tr: "Telefon ve e-posta ile iletişim",
        es: "Contacto telefónico y por correo",
      },
    ],

    availability: {
      ...DIGITAL_APPLICATION_AVAILABILITY,
    },

    primaryLink: "contactEmail",

    secondaryLink: "contactPhone",
  },
];

/* ============================================================
   11. PARTNER CONFIGURATION

   Important:
   A named organization is not automatically
   a publicly verified TAYM partner.

   Only partners with:
   - status = "verified"
   - publicationApproved = true
   - logoUsageApproved = true (for logos)
   may be publicly displayed.

   The organizations below remain pending
   until their relationships and publication
   rights are confirmed.
   ============================================================ */

export type ServicePartner = {
  id: string;

  name: string;

  type: PartnerType;

  countries: readonly ServiceCountry[];

  status: PartnerStatus;

  publicationApproved: boolean;

  logoUsageApproved: boolean;

  logoPath: string | null;

  officialWebsite: string | null;

  description: LocalizedServiceText;

  order: number;
};

export const SERVICES_PARTNERS:
  readonly ServicePartner[] = [
  {
    id: "dekra",

    name: "DEKRA",

    type: "examination",

    countries: ["DE"],

    status: "pending_verification",

    publicationApproved: false,

    logoUsageApproved: false,

    logoPath: null,

    officialWebsite:
      "https://www.dekra.de/",

    order: 1,

    description: {
      de: "Prüf- und Sachverständigenorganisation. Eine konkrete Kooperation mit TAYM wird vor Veröffentlichung geprüft.",
      ar: "مؤسسة للفحص والخبرة. يجب التحقق من التعاون المحدد مع TAYM قبل نشره.",
      tr: "Test ve uzmanlık kuruluşu. TAYM ile belirli iş birliği yayımlanmadan önce doğrulanmalıdır.",
      es: "Entidad de inspección y peritaje. La colaboración concreta con TAYM debe verificarse antes de publicarse.",
    },
  },

  {
    id: "tuv-sued",

    name: "TÜV SÜD",

    type: "examination",

    countries: ["DE"],

    status: "pending_verification",

    publicationApproved: false,

    logoUsageApproved: false,

    logoPath: null,

    officialWebsite:
      "https://www.tuvsud.com/",

    order: 2,

    description: {
      de: "Organisation für Prüfung und technische Dienstleistungen. Eine konkrete Kooperation mit TAYM wird vor Veröffentlichung geprüft.",
      ar: "مؤسسة تقدم خدمات الفحص والخدمات التقنية. يجب التحقق من التعاون المحدد مع TAYM قبل نشره.",
      tr: "Test ve teknik hizmetler kuruluşu. TAYM ile iş birliği yayımlanmadan önce doğrulanmalıdır.",
      es: "Entidad de inspección y servicios técnicos. La colaboración concreta con TAYM debe verificarse antes de publicarse.",
    },
  },

  /*
   * KBA is a German federal authority.
   * Do not display it as a commercial
   * partner without specific documented
   * authority to make that claim.
   */

  {
    id: "kba",

    name: "Kraftfahrt-Bundesamt (KBA)",

    type: "institution",

    countries: ["DE"],

    status: "pending_verification",

    publicationApproved: false,

    logoUsageApproved: false,

    logoPath: null,

    officialWebsite:
      "https://www.kba.de/",

    order: 3,

    description: {
      de: "Deutsche Bundesbehörde. Eine institutionelle Partnerschaft darf nur mit entsprechender Bestätigung öffentlich behauptet werden.",
      ar: "هيئة اتحادية ألمانية. لا يجوز الإعلان عن شراكة مؤسسية معها دون تأكيد مناسب.",
      tr: "Alman federal kurumu. Kurumsal ortaklık iddiası ancak uygun doğrulamayla yayımlanabilir.",
      es: "Autoridad federal alemana. Una asociación institucional solo puede anunciarse con confirmación adecuada.",
    },
  },
];

/* ============================================================
   12. SAFE PARTNER LOGOS

   A logo must be an existing local file.

   Approval must be recorded before
   enabling a public partner card.
   ============================================================ */

export function getApprovedPartnerLogo(
  partner: ServicePartner
): string | null {
  if (
    partner.status !== "verified" ||
    !partner.publicationApproved ||
    !partner.logoUsageApproved
  ) {
    return null;
  }

  const path = partner.logoPath;

  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("..") ||
    path.includes("\\") ||
    path.includes("%") ||
    !/^\/[A-Za-z0-9/_\-.]+$/.test(path) ||
    !/\.(png|jpg|jpeg|webp|avif|svg)$/i
      .test(path)
  ) {
    return null;
  }

  return path;
}

/* ============================================================
   13. GET PUBLIC PARTNERS

   Does not expose pending partner
   records in the public UI.
   ============================================================ */

export function getPublicServicePartners(
  country?: ServiceCountry
): ServicePartner[] {
  return SERVICES_PARTNERS
    .filter((partner) => {
      if (
        partner.status !== "verified" ||
        !partner.publicationApproved
      ) {
        return false;
      }

      if (
        country &&
        !partner.countries.includes(country)
      ) {
        return false;
      }

      return true;
    })
    .sort(
      (a, b) => a.order - b.order
    );
}

/* ============================================================
   14. SERVICE VISIBILITY AND AVAILABILITY
   ============================================================ */

export type LocalizedService = {
  id: ServiceId;

  category: ServiceCategory;

  title: string;

  description: string;

  features: string[];

  imagePath: string | null;

  imageId: ServiceImageId;

  icon: ServiceDefinition["icon"];

  availability: ServiceAvailability;

  primaryHref: string;

  secondaryHref: string | null;

  order: number;
};

export function getServicesForCountry(
  country: ServiceCountry,
  locale: ServiceLocale = "de"
): LocalizedService[] {
  const normalizedCountry =
    normalizeServicesCountry(country);

  const normalizedLocale =
    normalizeServicesLocale(locale);

  if (!normalizedCountry) {
    return [];
  }

  return SERVICES_CATALOG
    .filter((service) => service.visible)
    .filter(
      (service) =>
        service.availability[
          normalizedCountry
        ] !== "unavailable"
    )
    .sort(
      (a, b) => a.order - b.order
    )
    .map((service) => ({
      id: service.id,

      category: service.category,

      title:
        service.title[normalizedLocale],

      description:
        service.description[normalizedLocale],

      features:
        service.features.map(
          (feature) =>
            feature[normalizedLocale]
        ),

      imagePath:
        getServiceImage(service.imageId),

      imageId:
        service.imageId,

      icon:
        service.icon,

      availability:
        service.availability[
          normalizedCountry
        ],

      primaryHref:
        getServicesLink(
          service.primaryLink
        ),

      secondaryHref:
        service.secondaryLink
          ? getServicesLink(
              service.secondaryLink
            )
          : null,

      order:
        service.order,
    }));
}

/* ============================================================
   15. SERVICE GROUPS
   ============================================================ */

export const SERVICES_CATEGORY_ORDER:
  readonly ServiceCategory[] = [
    "training",
    "administration",
    "professional",
    "assistance",
  ];

export function getServiceCategoryLabel(
  category: ServiceCategory,
  locale: ServiceLocale = "de"
): string {
  const text =
    SERVICES_TEXT[
      normalizeServicesLocale(locale)
    ];

  switch (category) {
    case "training":
      return text.training;

    case "administration":
      return text.administrativeSupport;

    case "professional":
      return text.professionalServices;

    case "assistance":
      return text.candidateSupport;
  }
}

/* ============================================================
   16. APPLICATION PROCESS STEPS
   ============================================================ */

export type ServiceProcessStep = {
  number: number;

  title: string;

  description: string;

  href: string;
};

export function getServicesProcessSteps(
  locale: ServiceLocale = "de"
): ServiceProcessStep[] {
  const text =
    SERVICES_TEXT[
      normalizeServicesLocale(locale)
    ];

  return [
    {
      number: 1,

      title: text.step1Title,

      description: text.step1Description,

      href: SERVICES_LINKS.register,
    },

    {
      number: 2,

      title: text.step2Title,

      description: text.step2Description,

      href: SERVICES_LINKS.categories,
    },

    {
      number: 3,

      title: text.step3Title,

      description: text.step3Description,

      href: SERVICES_LINKS.application,
    },

    {
      number: 4,

      title: text.step4Title,

      description: text.step4Description,

      href: SERVICES_LINKS.contactEmail,
    },
  ];
}

/* ============================================================
   17. HERO CONFIGURATION
   ============================================================ */

export type ServicesHeroConfiguration = {
  eyebrow: string;

  title: string;

  description: string;

  secondaryDescription: string;

  imagePath: string | null;

  primaryLabel: string;

  primaryHref: string;

  secondaryLabel: string;

  secondaryHref: string;
};

export function getServicesHero(
  locale: ServiceLocale = "de"
): ServicesHeroConfiguration {
  const text =
    SERVICES_TEXT[
      normalizeServicesLocale(locale)
    ];

  return {
    eyebrow: text.heroEyebrow,

    title: text.heroTitle,

    description: text.heroDescription,

    secondaryDescription:
      text.heroSecondary,

    imagePath:
      getServiceImage("hero"),

    primaryLabel:
      text.applyNow,

    primaryHref:
      SERVICES_LINKS.application,

    secondaryLabel:
      text.discoverCategories,

    secondaryHref:
      SERVICES_LINKS.categories,
  };
}

/* ============================================================
   18. PUBLIC PARTNER DISPLAY RECORD
   ============================================================ */

export type PublicServicePartner = {
  id: string;

  name: string;

  type: PartnerType;

  description: string;

  logoPath: string | null;

  officialWebsite: string | null;
};

export function getLocalizedPublicPartners(
  country: ServiceCountry,
  locale: ServiceLocale = "de"
): PublicServicePartner[] {
  const normalizedLocale =
    normalizeServicesLocale(locale);

  return getPublicServicePartners(
    country
  ).map((partner) => ({
    id: partner.id,

    name: partner.name,

    type: partner.type,

    description:
      partner.description[normalizedLocale],

    logoPath:
      getApprovedPartnerLogo(partner),

    officialWebsite:
      partner.officialWebsite,
  }));
}

/* ============================================================
   19. CONTACT CONFIGURATION
   ============================================================ */

export function getServicesContact(
  locale: ServiceLocale = "de"
) {
  const text =
    SERVICES_TEXT[
      normalizeServicesLocale(locale)
    ];

  return {
    organization:
      SERVICES_CONTACT.organization,

    address:
      SERVICES_CONTACT.formattedAddress,

    addressLabel:
      text.address,

    phone:
      SERVICES_CONTACT.phoneDisplay,

    phoneHref:
      SERVICES_CONTACT.phoneHref,

    austriaPhone: SERVICES_CONTACT.austriaPhoneDisplay,
    austriaPhoneHref: SERVICES_CONTACT.austriaPhoneHref,

    phoneLabel:
      text.phone,

    email:
      SERVICES_CONTACT.email,

    emailHref:
      SERVICES_CONTACT.emailHref,

    emailLabel:
      text.email,

    callLabel:
      text.callNow,

    emailActionLabel:
      text.sendEmail,

    openingHours:
      SERVICES_CONTACT.openingHours,
  };
}

/* ============================================================
   20. COMPLETE PUBLIC PAGE CONFIGURATION

   Main function for:
   src/components/services/ServicesContent.tsx

   The component only needs to provide
   the selected locale and country.
   ============================================================ */

export function getServicesPageConfig(
  locale: ServiceLocale = "de",
  country: ServiceCountry = "DE"
) {
  const safeLocale =
    normalizeServicesLocale(locale);

  const safeCountry =
    normalizeServicesCountry(country) ??
    DEFAULT_SERVICES_COUNTRY;

  const text =
    SERVICES_TEXT[safeLocale];

  return {
    brand:
      SERVICES_BRAND,

    locale:
      safeLocale,

    direction:
      getServicesDirection(safeLocale),

    countryCode:
      safeCountry,

    countryFlag:
      SERVICES_COUNTRY_FLAGS[safeCountry],

    countryName:
      SERVICES_COUNTRY_NAMES[
        safeCountry
      ][safeLocale],

    supportedCountries:
      SERVICES_COUNTRIES.map(
        (code) => ({
          code,

          flag:
            SERVICES_COUNTRY_FLAGS[code],

          name:
            SERVICES_COUNTRY_NAMES[
              code
            ][safeLocale],
        })
      ),

    text,

    hero:
      getServicesHero(safeLocale),

    services:
      getServicesForCountry(
        safeCountry,
        safeLocale
      ),

    partners:
      getLocalizedPublicPartners(
        safeCountry,
        safeLocale
      ),

    processSteps:
      getServicesProcessSteps(
        safeLocale
      ),

    contact:
      getServicesContact(safeLocale),

    links:
      SERVICES_LINKS,

    images: {
      hero:
        getServiceImage("hero"),

      theory:
        getServiceImage("theory"),

      practical:
        getServiceImage("practical"),

      administration:
        getServiceImage(
          "administration"
        ),

      exams:
        getServiceImage("exams"),

      professional:
        getServiceImage(
          "professional"
        ),

      partnerships:
        getServiceImage(
          "partnerships"
        ),

      support:
        getServiceImage("support"),
    },

    legalNotice:
      text.noGuarantee,

    partnerNotice:
      text.partnerNotice,

    pricingNotice:
      text.pricingNotice,
  };
}

/* ============================================================
   21. CONFIGURATION SELF-CHECK

   Useful during development and tests.

   Ensures:
   - Country coverage
   - Localized content
   - Unique service IDs
   - Valid availability records
   - Safe local links
   - Safe contact links
   ============================================================ */

export function validateServicesConfiguration():
  true {
  const validAvailability =
    new Set<ServiceAvailability>([
      "available",
      "confirmation_required",
      "unavailable",
    ]);

  const ids =
    new Set<string>();

  for (
    const country
    of SERVICES_COUNTRIES
  ) {
    if (
      !SERVICES_COUNTRY_NAMES[country] ||
      !SERVICES_COUNTRY_FLAGS[country]
    ) {
      throw new Error(
        "Invalid services country configuration."
      );
    }

    for (
      const locale
      of SERVICES_LOCALES
    ) {
      if (
        !SERVICES_COUNTRY_NAMES[
          country
        ][locale]?.trim()
      ) {
        throw new Error(
          "Missing translated country name."
        );
      }
    }
  }

  for (
    const service
    of SERVICES_CATALOG
  ) {
    if (ids.has(service.id)) {
      throw new Error(
        "Duplicate service identifier."
      );
    }

    ids.add(service.id);

    for (
      const country
      of SERVICES_COUNTRIES
    ) {
      if (
        !validAvailability.has(
          service.availability[country]
        )
      ) {
        throw new Error(
          "Invalid country availability."
        );
      }
    }

    for (
      const locale
      of SERVICES_LOCALES
    ) {
      if (
        !service.title[locale]?.trim() ||
        !service.description[
          locale
        ]?.trim() ||
        service.features.some(
          (feature) =>
            !feature[locale]?.trim()
        )
      ) {
        throw new Error(
          "Missing service translation."
        );
      }
    }
  }

  for (
    const path
    of Object.values(SERVICES_LINKS)
  ) {
    const valid =
      (
        path.startsWith("/") &&
        !path.startsWith("//")
      ) ||
      path === SERVICES_CONTACT.emailHref ||
      path === SERVICES_CONTACT.phoneHref;

    if (!valid) {
      throw new Error(
        "Invalid service navigation link."
      );
    }
  }

  for (
    const partner
    of SERVICES_PARTNERS
  ) {
    if (
      partner.status === "verified" &&
      partner.publicationApproved &&
      partner.countries.length === 0
    ) {
      throw new Error(
        "Public partner requires a country."
      );
    }
  }

  return true;
}

/* ============================================================
   END — FAHRSCHULE TAYM SERVICES CONFIGURATION
   ============================================================ */
