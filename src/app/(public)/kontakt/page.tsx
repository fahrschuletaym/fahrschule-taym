
"use client";

import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import Link from "next/link";
import Image from "next/image";

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CarFront,
  CheckCircle2,
  Clock3,
  ClipboardList,
  ExternalLink,
  FileText,
  GraduationCap,
  Headphones,
  Info,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Send,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import {
  SERVICES_CONTACT,
  SERVICES_LINKS,
} from "@/config/services";

/* ============================================================
   FAHRSCHULE TAYM
   Contact Page Content

   src/components/contact/ContactContent.tsx

   Countries:
   DE, AT, BE, IT, ES

   Languages:
   de, ar, tr, es

   No new header or footer.
   No fake API.
   No duplicate contact configuration.
   ============================================================ */

type Locale = "de" | "ar" | "tr" | "es";

type FormValues = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

const CONTACT = SERVICES_CONTACT;
const LINKS = SERVICES_LINKS;

const EMPTY_FORM: FormValues = {
  name: "",
  email: "",
  subject: "",
  message: "",
};

const TEXT = {
  de: {
    eyebrow: "KONTAKT & BERATUNG",
    title: "Wir sind für dich da.",
    subtitle:
      "Du hast Fragen zum Führerschein, zu unseren Kursen oder deiner Anmeldung? Wir helfen dir gerne weiter.",
    berlin: "Berlin-Reinickendorf",
    contactDetails: "Unsere Kontaktdaten",
    contactDetailsDesc:
      "So erreichst du unsere Fahrschule.",
    address: "Unsere Adresse",
    phone: "Telefon",
    email: "E-Mail-Adresse",
    call: "Jetzt anrufen",
    writeEmail: "E-Mail schreiben",
    route: "Route planen",
    mapTitle: "So findest du uns",
    mapDescription:
      "Besuche uns an unserem Standort in Berlin-Reinickendorf.",
    viewMap: "Standort in Google Maps öffnen",
    office: "Fahrschule TAYM",
    formTitle: "Schreib uns eine Nachricht",
    formSubtitle:
      "Beschreibe kurz dein Anliegen. Dein E-Mail-Programm öffnet sich mit einer vorbereiteten Nachricht.",
    fullName: "Vor- und Nachname",
    fullNamePlaceholder: "Dein vollständiger Name",
    emailPlaceholder: "name@beispiel.de",
    subject: "Dein Anliegen",
    subjectPlaceholder: "Bitte auswählen",
    message: "Deine Nachricht",
    messagePlaceholder:
      "Wie können wir dir helfen?",
    send: "E-Mail vorbereiten",
    subjectGeneral: "Allgemeine Anfrage",
    subjectRegistration: "Führerscheinanmeldung",
    subjectTheory: "Theorieunterricht",
    subjectPractical: "Praktische Fahrausbildung",
    subjectConversion: "Führerscheinumschreibung",
    subjectProfessional: "Berufskraftfahrer",
    subjectOther: "Sonstiges Anliegen",
    formNotice:
      "Beim Klicken auf die Schaltfläche wird dein E-Mail-Programm geöffnet. Bitte sende die vorbereitete E-Mail dort selbst ab.",
    privacy:
      "Bitte sende keine Ausweiskopien, Passwörter oder sensiblen Unterlagen über dieses Kontaktformular.",
    whyTitle: "Wobei können wir helfen?",
    adviceTitle: "Führerscheinberatung",
    adviceText:
      "Informationen zu Führerscheinklassen, Preisen und Anmeldung.",
    coursesTitle: "Theorie & Praxis",
    coursesText:
      "Fragen zu Ausbildung und Vorbereitung auf die Prüfungen.",
    documentsTitle: "Anträge & Unterlagen",
    documentsText:
      "Unterstützung bei Dokumenten und formellen Schritten.",
    serviceTitle: "Persönlicher Kontakt",
    serviceText:
      "Wir beraten dich zu den nächsten Schritten.",
    quickTitle: "Bereit für deinen Führerschein?",
    quickText:
      "Entdecke unsere Führerscheinklassen und starte deine Anfrage online.",
    categories: "Führerscheinklassen ansehen",
    apply: "Führerschein beantragen",
    languages:
      "Informationen auf Deutsch, Arabisch, Türkisch und Spanisch",
    countryNotice:
      "Unsere Adresse befindet sich in Berlin. Leistungen für weitere Länder hängen von der jeweiligen Verfügbarkeit und den geltenden Vorschriften ab.",
    hoursTitle: "Öffnungszeiten",
    hoursUnknown:
      "Öffnungszeiten bitte telefonisch erfragen.",
    invalidName:
      "Bitte gib deinen Namen ein.",
    invalidEmail:
      "Bitte gib eine gültige E-Mail-Adresse ein.",
    invalidSubject:
      "Bitte wähle dein Anliegen.",
    invalidMessage:
      "Bitte schreibe eine Nachricht mit mindestens 10 Zeichen.",
    emailSubjectPrefix: "Kontaktanfrage",
    signatureName: "Name",
    signatureEmail: "E-Mail",
  },

  ar: {
    eyebrow: "الاتصال والاستشارة",
    title: "نحن هنا لمساعدتك.",
    subtitle:
      "هل لديك أسئلة حول رخص القيادة أو دوراتنا أو التسجيل؟ يسعدنا مساعدتك.",
    berlin: "برلين - راينيكندورف",
    contactDetails: "معلومات الاتصال",
    contactDetailsDesc:
      "يمكنك التواصل مع مدرسة القيادة من خلال هذه الوسائل.",
    address: "عنواننا",
    phone: "الهاتف",
    email: "البريد الإلكتروني",
    call: "اتصل الآن",
    writeEmail: "راسلنا عبر البريد",
    route: "الحصول على الاتجاهات",
    mapTitle: "كيف تصل إلينا",
    mapDescription:
      "يمكنك زيارتنا في موقعنا في برلين راينيكندورف.",
    viewMap: "فتح الموقع في خرائط Google",
    office: "مدرسة TAYM لتعليم القيادة",
    formTitle: "أرسل لنا رسالة",
    formSubtitle:
      "اشرح استفسارك باختصار. سيتم فتح برنامج البريد الإلكتروني مع رسالة جاهزة.",
    fullName: "الاسم الكامل",
    fullNamePlaceholder: "الاسم واللقب",
    emailPlaceholder: "name@example.com",
    subject: "موضوع الاستفسار",
    subjectPlaceholder: "اختر الموضوع",
    message: "رسالتك",
    messagePlaceholder:
      "كيف يمكننا مساعدتك؟",
    send: "إعداد البريد الإلكتروني",
    subjectGeneral: "استفسار عام",
    subjectRegistration: "التسجيل لرخصة القيادة",
    subjectTheory: "الدروس النظرية",
    subjectPractical: "دروس القيادة العملية",
    subjectConversion: "تحويل رخصة أجنبية",
    subjectProfessional: "القيادة المهنية",
    subjectOther: "موضوع آخر",
    formNotice:
      "عند الضغط على الزر، سيتم فتح برنامج البريد الإلكتروني. يرجى إرسال الرسالة منه بنفسك.",
    privacy:
      "يرجى عدم إرسال صور وثائق الهوية أو كلمات المرور أو المستندات الحساسة عبر هذا النموذج.",
    whyTitle: "كيف يمكننا مساعدتك؟",
    adviceTitle: "استشارات رخص القيادة",
    adviceText:
      "معلومات عن فئات الرخص والأسعار والتسجيل.",
    coursesTitle: "التدريب النظري والعملي",
    coursesText:
      "استفسارات حول التدريب والتحضير للاختبارات.",
    documentsTitle: "الطلبات والمستندات",
    documentsText:
      "المساعدة في الوثائق والإجراءات الإدارية.",
    serviceTitle: "التواصل المباشر",
    serviceText:
      "نساعدك على معرفة الخطوات التالية.",
    quickTitle:
      "هل أنت مستعد لبدء رحلتك؟",
    quickText:
      "اكتشف فئات رخص القيادة وابدأ طلبك عبر الإنترنت.",
    categories: "عرض فئات رخص القيادة",
    apply: "تقديم طلب رخصة القيادة",
    languages:
      "المعلومات متاحة بالألمانية والعربية والتركية والإسبانية",
    countryNotice:
      "يقع مقر المدرسة في برلين. تعتمد الخدمات في الدول الأخرى على توفرها والأنظمة المحلية.",
    hoursTitle: "ساعات العمل",
    hoursUnknown:
      "يرجى الاتصال لمعرفة ساعات العمل.",
    invalidName:
      "يرجى إدخال اسمك.",
    invalidEmail:
      "يرجى إدخال بريد إلكتروني صحيح.",
    invalidSubject:
      "يرجى اختيار موضوع الاستفسار.",
    invalidMessage:
      "يرجى كتابة رسالة من 10 أحرف على الأقل.",
    emailSubjectPrefix: "استفسار",
    signatureName: "الاسم",
    signatureEmail: "البريد الإلكتروني",
  },

  tr: {
    eyebrow: "İLETİŞİM & DANIŞMANLIK",
    title: "Size yardımcı olmak için buradayız.",
    subtitle:
      "Ehliyet, kurslarımız veya kayıt hakkında sorularınız mı var? Size yardımcı olmaktan mutluluk duyarız.",
    berlin: "Berlin-Reinickendorf",
    contactDetails: "İletişim bilgilerimiz",
    contactDetailsDesc:
      "Sürücü kursumuza şu kanallardan ulaşabilirsiniz.",
    address: "Adresimiz",
    phone: "Telefon",
    email: "E-posta adresi",
    call: "Şimdi ara",
    writeEmail: "E-posta gönder",
    route: "Yol tarifi al",
    mapTitle: "Bizi nasıl bulabilirsiniz?",
    mapDescription:
      "Berlin-Reinickendorf'taki adresimizi ziyaret edin.",
    viewMap: "Google Haritalar'da aç",
    office: "Fahrschule TAYM",
    formTitle: "Bize mesaj yazın",
    formSubtitle:
      "Sorunuzu kısaca açıklayın. E-posta uygulamanız hazırlanmış mesajla açılacaktır.",
    fullName: "Ad ve soyad",
    fullNamePlaceholder: "Adınız ve soyadınız",
    emailPlaceholder: "ad@ornek.com",
    subject: "Başvuru konusu",
    subjectPlaceholder: "Lütfen seçin",
    message: "Mesajınız",
    messagePlaceholder:
      "Size nasıl yardımcı olabiliriz?",
    send: "E-postayı hazırla",
    subjectGeneral: "Genel soru",
    subjectRegistration: "Ehliyet kaydı",
    subjectTheory: "Teori dersleri",
    subjectPractical: "Pratik sürüş dersleri",
    subjectConversion: "Yabancı ehliyet dönüşümü",
    subjectProfessional: "Profesyonel sürücülük",
    subjectOther: "Diğer",
    formNotice:
      "Düğmeye tıklayınca e-posta uygulamanız açılır. Hazırlanan e-postayı kendiniz göndermelisiniz.",
    privacy:
      "Bu form yoluyla kimlik kopyası, şifre veya hassas belge göndermeyin.",
    whyTitle: "Nasıl yardımcı olabiliriz?",
    adviceTitle: "Ehliyet danışmanlığı",
    adviceText:
      "Ehliyet sınıfları, fiyatlar ve kayıt hakkında bilgi.",
    coursesTitle: "Teori ve pratik",
    coursesText:
      "Eğitim ve sınav hazırlığı hakkında sorular.",
    documentsTitle: "Başvurular ve belgeler",
    documentsText:
      "Belgeler ve resmî işlemlerle ilgili destek.",
    serviceTitle: "Kişisel iletişim",
    serviceText:
      "Sonraki adımlarda size yol gösteriyoruz.",
    quickTitle: "Ehliyete hazır mısınız?",
    quickText:
      "Ehliyet sınıflarını keşfedin ve başvurunuzu çevrimiçi başlatın.",
    categories: "Ehliyet sınıflarını incele",
    apply: "Ehliyet başvurusu yap",
    languages:
      "Bilgiler Almanca, Arapça, Türkçe ve İspanyolca",
    countryNotice:
      "Kursumuz Berlin'dedir. Diğer ülkelerdeki hizmetler müsaitliğe ve yerel kurallara bağlıdır.",
    hoursTitle: "Çalışma saatleri",
    hoursUnknown:
      "Çalışma saatlerini öğrenmek için arayın.",
    invalidName: "Lütfen adınızı girin.",
    invalidEmail:
      "Geçerli bir e-posta adresi girin.",
    invalidSubject:
      "Lütfen bir konu seçin.",
    invalidMessage:
      "En az 10 karakterlik mesaj yazın.",
    emailSubjectPrefix: "İletişim talebi",
    signatureName: "Ad Soyad",
    signatureEmail: "E-posta",
  },

  es: {
    eyebrow: "CONTACTO Y ASESORAMIENTO",
    title: "Estamos aquí para ayudarle.",
    subtitle:
      "¿Tiene dudas sobre el permiso de conducir, nuestros cursos o la inscripción? Estaremos encantados de atenderle.",
    berlin: "Berlín-Reinickendorf",
    contactDetails: "Nuestros datos de contacto",
    contactDetailsDesc:
      "Puede ponerse en contacto con nuestra autoescuela por estos medios.",
    address: "Nuestra dirección",
    phone: "Teléfono",
    email: "Correo electrónico",
    call: "Llamar ahora",
    writeEmail: "Enviar correo",
    route: "Cómo llegar",
    mapTitle: "Dónde encontrarnos",
    mapDescription:
      "Visítenos en nuestra sede de Berlín-Reinickendorf.",
    viewMap: "Abrir ubicación en Google Maps",
    office: "Fahrschule TAYM",
    formTitle: "Envíenos un mensaje",
    formSubtitle:
      "Explique su consulta brevemente. Se abrirá su aplicación de correo con un mensaje preparado.",
    fullName: "Nombre y apellidos",
    fullNamePlaceholder: "Su nombre completo",
    emailPlaceholder: "nombre@ejemplo.com",
    subject: "Motivo de consulta",
    subjectPlaceholder: "Seleccione una opción",
    message: "Su mensaje",
    messagePlaceholder:
      "¿Cómo podemos ayudarle?",
    send: "Preparar correo",
    subjectGeneral: "Consulta general",
    subjectRegistration:
      "Inscripción al permiso",
    subjectTheory: "Clases teóricas",
    subjectPractical: "Clases prácticas",
    subjectConversion:
      "Canje de permiso extranjero",
    subjectProfessional:
      "Conductores profesionales",
    subjectOther: "Otro asunto",
    formNotice:
      "Al pulsar el botón se abrirá su aplicación de correo. Debe enviar el mensaje desde allí.",
    privacy:
      "No envíe copias de documentos de identidad, contraseñas ni información sensible mediante este formulario.",
    whyTitle: "¿En qué podemos ayudarle?",
    adviceTitle: "Asesoramiento",
    adviceText:
      "Información sobre categorías, precios e inscripción.",
    coursesTitle: "Teoría y práctica",
    coursesText:
      "Consultas sobre formación y preparación de exámenes.",
    documentsTitle: "Solicitudes y documentos",
    documentsText:
      "Apoyo con documentación y trámites.",
    serviceTitle: "Atención personal",
    serviceText:
      "Le orientamos sobre los próximos pasos.",
    quickTitle:
      "¿Preparado para su permiso?",
    quickText:
      "Descubra las categorías disponibles y comience su solicitud en línea.",
    categories: "Ver categorías de permisos",
    apply: "Solicitar permiso de conducir",
    languages:
      "Información en alemán, árabe, turco y español",
    countryNotice:
      "Nuestra sede está en Berlín. Los servicios en otros países dependen de su disponibilidad y de la normativa local.",
    hoursTitle: "Horario de atención",
    hoursUnknown:
      "Consulte por teléfono el horario actual.",
    invalidName:
      "Introduzca su nombre.",
    invalidEmail:
      "Introduzca un correo válido.",
    invalidSubject:
      "Seleccione el motivo de consulta.",
    invalidMessage:
      "Escriba al menos 10 caracteres.",
    emailSubjectPrefix: "Consulta de contacto",
    signatureName: "Nombre",
    signatureEmail: "Correo",
  },
} as const;

type Dictionary = typeof TEXT["de"];

/* ============================================================
   LANGUAGE SYNCHRONIZATION

   Reuses existing project language.
   No new language switcher.
   ============================================================ */

function normalizeLocale(
  value: unknown
): Locale | null {
  if (typeof value !== "string") {
    return null;
  }

  const code = value
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];

  return ["de", "ar", "tr", "es"].includes(code)
    ? (code as Locale)
    : null;
}

function readCookie(
  name: string
): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) =>
      item.startsWith(`${name}=`)
    );

  if (!match) {
    return null;
  }

  try {
    return decodeURIComponent(
      match.slice(name.length + 1)
    );
  } catch {
    return null;
  }
}

function currentLocale(): Locale {
  if (typeof window === "undefined") {
    return "de";
  }

  let stored: string | null = null;

  try {
    stored = localStorage.getItem(
      "taym-locale"
    );
  } catch {
    // Some browsers block storage.
  }

  return (
    normalizeLocale(
      document.documentElement.lang
    ) ??
    normalizeLocale(
      readCookie("taym-locale")
    ) ??
    normalizeLocale(stored) ??
    "de"
  );
}

/* ============================================================
   REUSABLE CONTACT LINK
   ============================================================ */

function ContactCard({
  icon: Icon,
  label,
  value,
  href,
  action,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  href: string;
  action: string;
}) {
  return (
    <a
      href={href}
      target={
        href.startsWith("https://")
          ? "_blank"
          : undefined
      }
      rel={
        href.startsWith("https://")
          ? "noopener noreferrer"
          : undefined
      }
      className="group flex min-w-0 items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-lime-400 hover:bg-lime-50/30 sm:p-5"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-green-800">
        <Icon size={23} aria-hidden="true" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-slate-500">
          {label}
        </span>

        <span
          dir="auto"
          className="mt-1 block wrap-break-word text-sm font-bold leading-relaxed text-slate-950 sm:text-base"
        >
          {value}
        </span>

        <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-green-800">
          {action}
          <ExternalLink
            size={13}
            aria-hidden="true"
          />
        </span>
      </span>
    </a>
  );
}

/* ============================================================
   CONTACT TOPIC CARD
   ============================================================ */

function HelpCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <span className="flex size-11 items-center justify-center rounded-xl bg-lime-100 text-green-800">
        <Icon size={22} aria-hidden="true" />
      </span>

      <h3 className="mt-4 text-sm font-extrabold text-slate-950 sm:text-base">
        {title}
      </h3>

      <p className="mt-2 text-xs leading-relaxed text-slate-600 sm:text-sm">
        {description}
      </p>
    </article>
  );
}

/* ============================================================
   FORM FIELD
   ============================================================ */

function FormField({
  htmlFor,
  label,
  children,
}: {
  htmlFor: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-bold text-slate-900"
      >
        {label}
        <span className="ms-1 text-red-600">
          *
        </span>
      </label>

      {children}
    </div>
  );
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function ContactContent() {
  const [locale, setLocale] =
    useState<Locale>("de");

  const [form, setForm] =
    useState<FormValues>({
      ...EMPTY_FORM,
    });

  const [error, setError] =
    useState("");

  const t = TEXT[locale] as Dictionary;
  const rtl = locale === "ar";

  const Arrow = rtl
    ? ArrowLeft
    : ArrowRight;

  const mapUrl =
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(
      CONTACT.formattedAddress
    );

  /* ========================================================
     FOLLOW EXISTING LANGUAGE SWITCHER
     ======================================================== */

  useEffect(() => {
    const sync = (event?: Event) => {
      if (event instanceof CustomEvent) {
        const detail: unknown = event.detail;

        const value =
          typeof detail === "string"
            ? detail
            : detail &&
                typeof detail === "object" &&
                "locale" in detail
              ? detail.locale
              : null;

        const fromEvent =
          normalizeLocale(value);

        if (fromEvent) {
          setLocale(fromEvent);
          return;
        }
      }

      setLocale(currentLocale());
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

  /* ========================================================
     UPDATE FORM
     ======================================================== */

  function updateForm(
    field: keyof FormValues,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    if (error) {
      setError("");
    }
  }

  /* ========================================================
     CONTACT FORM

     Uses mailto only.

     The user must click Send
     in their email application.

     No fake backend submission.
     No sensitive identity uploads.
     ======================================================== */

  function submitContact(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const name = form.name.trim();
    const email = form.email.trim();
    const subject = form.subject.trim();
    const message = form.message.trim();

    if (name.length < 2) {
      setError(t.invalidName);
      return;
    }

    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      setError(t.invalidEmail);
      return;
    }

    if (
      !subject ||
      ![
        "general",
        "registration",
        "theory",
        "practical",
        "conversion",
        "professional",
        "other",
      ].includes(subject)
    ) {
      setError(t.invalidSubject);
      return;
    }

    if (
      message.length < 10 ||
      message.length > 4000
    ) {
      setError(t.invalidMessage);
      return;
    }

    const subjectLabels: Record<
      string,
      string
    > = {
      general: t.subjectGeneral,
      registration: t.subjectRegistration,
      theory: t.subjectTheory,
      practical: t.subjectPractical,
      conversion: t.subjectConversion,
      professional: t.subjectProfessional,
      other: t.subjectOther,
    };

    const emailSubject =
      `${t.emailSubjectPrefix} - ` +
      subjectLabels[subject];

    const emailBody = [
      message,
      "",
      "----------------------------",
      `${t.signatureName}: ${name}`,
      `${t.signatureEmail}: ${email}`,
      "Fahrschule TAYM",
    ].join("\n");

    const href =
      `mailto:${CONTACT.email}` +
      `?subject=${encodeURIComponent(emailSubject)}` +
      `&body=${encodeURIComponent(emailBody)}`;

    window.location.href = href;
  }

  const inputClass =
    "min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-lime-500 focus:ring-2 focus:ring-lime-500/20";

  return (
    <main
      lang={locale}
      dir={rtl ? "rtl" : "ltr"}
      className="min-w-0 overflow-hidden bg-[#f5f8f2] text-slate-950"
    >
      {/* ====================================================
         HERO
         ==================================================== */}

      <section className="relative overflow-hidden bg-[#142318]">
        <div className="pointer-events-none absolute -inset-e-24 -top-24 size-80 rounded-full bg-lime-400/10 blur-3xl" />

        <div className="mx-auto grid max-w-none items-center gap-8 px-4 py-7 sm:px-6 sm:py-9 lg:grid-cols-2 lg:gap-12 lg:px-8 lg:py-10">
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-lime-400/25 bg-lime-400/10 px-4 py-2 text-xs font-bold tracking-wider text-lime-300">
              <Headphones size={16} />
              {t.eyebrow}
            </span>

            <h1 className="mt-6 text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
              {t.title}
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-8 text-slate-200 sm:text-base lg:text-lg">
              {t.subtitle}
            </p>

            <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-lime-300 sm:text-sm">
              <MapPin size={17} />
              {t.berlin}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={CONTACT.phoneHref}
                className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl bg-linear-to-r from-green-700 to-lime-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:from-green-800 hover:to-lime-700"
              >
                <Phone size={18} />
                {t.call}
              </a>

              <a
                href={CONTACT.emailHref}
                className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl border border-white/40 bg-white/10 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/20"
              >
                <Mail size={18} />
                {t.writeEmail}
              </a>
            </div>
          </div>

          <div className="relative min-h-64 w-full overflow-hidden rounded-3xl border border-white/15 sm:min-h-80">
            <Image src="/images/imagea.jpg" alt="Fahrschule TAYM" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
          </div>
        </div>
      </section>

      {/* ====================================================
         CONTACT DETAILS
         ==================================================== */}

      <section className="mx-auto max-w-none px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="mb-7">
          <h2 className="text-2xl font-black sm:text-3xl">
            {t.contactDetails}
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {t.contactDetailsDesc}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <ContactCard
            icon={MapPin}
            label={t.address}
            value={CONTACT.formattedAddress}
            href={mapUrl}
            action={t.route}
          />

          <ContactCard
            icon={Phone}
            label={t.phone}
            value={CONTACT.phoneDisplay}
            href={CONTACT.phoneHref}
            action={t.call}
          />

          <ContactCard
            icon={Mail}
            label={t.email}
            value={CONTACT.email}
            href={CONTACT.emailHref}
            action={t.writeEmail}
          />
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600">
          <Clock3
            size={17}
            className="mt-0.5 shrink-0 text-green-700"
          />

          <span>
            <strong>{t.hoursTitle}: </strong>
            {CONTACT.openingHours ??
              t.hoursUnknown}
          </span>
        </div>
      </section>

      {/* ====================================================
         WHAT WE HELP WITH
         ==================================================== */}

      <section className="bg-[#eaf3e4]">
        <div className="mx-auto max-w-none px-4 py-11 sm:px-6 sm:py-14 lg:px-8">
          <h2 className="text-2xl font-black sm:text-3xl">
            {t.whyTitle}
          </h2>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <HelpCard
              icon={CarFront}
              title={t.adviceTitle}
              description={t.adviceText}
            />

            <HelpCard
              icon={GraduationCap}
              title={t.coursesTitle}
              description={t.coursesText}
            />

            <HelpCard
              icon={FileText}
              title={t.documentsTitle}
              description={t.documentsText}
            />

            <HelpCard
              icon={Headphones}
              title={t.serviceTitle}
              description={t.serviceText}
            />
          </div>
        </div>
      </section>

      {/* ====================================================
         FORM + LOCATION
         ==================================================== */}

      <section className="mx-auto grid max-w-none gap-6 px-4 py-7 sm:px-6 sm:py-9 lg:grid-cols-2 lg:gap-8 lg:px-8">
        {/* CONTACT FORM */}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-green-800">
              <Mail size={23} />
            </span>

            <div>
              <h2 className="text-xl font-black sm:text-2xl">
                {t.formTitle}
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {t.formSubtitle}
              </p>
            </div>
          </div>

          <form
            noValidate
            onSubmit={submitContact}
            className="space-y-5"
          >
            <FormField
              htmlFor="contact-name"
              label={t.fullName}
            >
              <div className="relative">
                <UserRound
                  size={18}
                  className="pointer-events-none absolute inset-s-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={120}
                  value={form.name}
                  placeholder={t.fullNamePlaceholder}
                  onChange={(event) =>
                    updateForm(
                      "name",
                      event.target.value
                    )
                  }
                  className={`${inputClass} ps-11`}
                />
              </div>
            </FormField>

            <FormField
              htmlFor="contact-email"
              label={t.email}
            >
              <div className="relative">
                <Mail
                  size={18}
                  className="pointer-events-none absolute inset-s-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={form.email}
                  placeholder={t.emailPlaceholder}
                  onChange={(event) =>
                    updateForm(
                      "email",
                      event.target.value
                    )
                  }
                  className={`${inputClass} ps-11`}
                />
              </div>
            </FormField>

            <FormField
              htmlFor="contact-subject"
              label={t.subject}
            >
              <select
                id="contact-subject"
                name="subject"
                required
                value={form.subject}
                onChange={(event) =>
                  updateForm(
                    "subject",
                    event.target.value
                  )
                }
                className={inputClass}
              >
                <option value="">
                  {t.subjectPlaceholder}
                </option>

                <option value="general">
                  {t.subjectGeneral}
                </option>

                <option value="registration">
                  {t.subjectRegistration}
                </option>

                <option value="theory">
                  {t.subjectTheory}
                </option>

                <option value="practical">
                  {t.subjectPractical}
                </option>

                <option value="conversion">
                  {t.subjectConversion}
                </option>

                <option value="professional">
                  {t.subjectProfessional}
                </option>

                <option value="other">
                  {t.subjectOther}
                </option>
              </select>
            </FormField>

            <FormField
              htmlFor="contact-message"
              label={t.message}
            >
              <textarea
                id="contact-message"
                name="message"
                required
                minLength={10}
                maxLength={4000}
                rows={6}
                value={form.message}
                placeholder={t.messagePlaceholder}
                onChange={(event) =>
                  updateForm(
                    "message",
                    event.target.value
                  )
                }
                className={`${inputClass} min-h-36 resize-y`}
              />
            </FormField>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                {error}
              </div>
            )}

            <div className="flex items-start gap-2 rounded-lg bg-lime-50 p-3 text-xs leading-relaxed text-slate-700">
              <Info
                size={17}
                className="mt-0.5 shrink-0 text-green-800"
              />

              {t.formNotice}
            </div>

            <button
              type="submit"
              className="flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-linear-to-r from-green-800 to-lime-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:from-green-900 hover:to-lime-700"
            >
              <Send size={18} />
              {t.send}
              <Arrow size={17} />
            </button>

            <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
              <ShieldCheck
                size={16}
                className="mt-0.5 shrink-0 text-green-700"
              />

              {t.privacy}
            </p>
          </form>
        </div>

        {/* LOCATION */}

        <div className="flex min-w-0 flex-col gap-5">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="p-5 sm:p-7">
              <h2 className="text-xl font-black sm:text-2xl">
                {t.mapTitle}
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {t.mapDescription}
              </p>
            </div>

            <div className="relative flex min-h-65 items-center justify-center overflow-hidden bg-lime-100 sm:min-h-80">
              <Image src="/images/imagea.jpg" alt="" fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />

              <div className="relative z-10 flex max-w-65 flex-col items-center rounded-2xl border border-white bg-white/95 p-5 text-center shadow-md">
                <MapPin
                  size={34}
                  className="text-green-700"
                />

                <strong className="mt-3 text-sm">
                  Fahrschule TAYM
                </strong>

                <span className="mt-2 text-xs leading-relaxed text-slate-600">
                  {CONTACT.formattedAddress}
                </span>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl border-2 border-green-700 px-4 py-3 text-sm font-bold text-green-800 transition-colors hover:bg-lime-50"
              >
                <Navigation size={18} />

                {t.viewMap}

                <ExternalLink size={15} />
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-lime-200 bg-lime-50 p-5">
            <div className="flex items-start gap-3">
              <Building2
                size={23}
                className="shrink-0 text-green-800"
              />

              <div>
                <h3 className="font-bold text-green-950">
                  {t.office}
                </h3>

                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  {t.countryNotice}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================
         APPLICATION CTA
         ==================================================== */}

      <section className="bg-[#142318] text-white">
        <div className="mx-auto flex max-w-none flex-col items-center gap-6 px-4 py-12 text-center sm:px-6 sm:py-16 lg:px-8">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-lime-400/15 text-lime-300">
            <CarFront size={34} />
          </div>

          <h2 className="max-w-3xl text-2xl font-black sm:text-3xl">
            {t.quickTitle}
          </h2>

          <p className="max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
            {t.quickText}
          </p>

          <div className="flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <Link
              href={LINKS.categories}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/35 px-6 py-3 text-sm font-bold text-white hover:bg-white/10"
            >
              <CarFront size={18} />
              {t.categories}
            </Link>

            <Link
              href={LINKS.application}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-lime-500 to-green-700 px-6 py-3 text-sm font-bold text-white hover:from-lime-600 hover:to-green-800"
            >
              <ClipboardList size={18} />
              {t.apply}
              <Arrow size={17} />
            </Link>
          </div>

          <p className="flex items-center gap-2 text-xs text-lime-200">
            <CheckCircle2 size={16} />
            {t.languages}
          </p>
        </div>
      </section>
    </main>
  );
}
