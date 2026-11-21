
"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Copyright,
  ExternalLink,
  FileText,
  Globe2,
  Info,
  Landmark,
  Link2,
  Mail,
  MapPin,
  Phone,
  Scale,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

/* ============================================================
   FAHRSCHULE TAYM

   File:
   src/components/legal/ImpressumContent.tsx

   Public route:
   /impressum

   Languages:
   de | ar | tr | es

   Country of establishment:
   Germany

   Responsive:
   Mobile | Tablet | Desktop

   No duplicate header, menu or footer.
   ============================================================ */

type Locale = "de" | "ar" | "tr" | "es";

type Localized = Record<Locale, string>;

type LegalSection = {
  id: string;
  icon: LucideIcon;
  title: Localized;
  paragraphs: Localized[];
};

/* ============================================================
   1. OPERATOR INFORMATION

   Based on the old Impressum supplied
   by the project owner.

   Business legal form, register data and
   tax identifiers must be verified before
   the production launch.

   The legacy email is retained exactly
   as it appeared in that source.
   ============================================================ */

const OPERATOR = {
  name: "Fahrschule Taym",

  responsiblePerson: "Ahmad Mostafa",

  addressLine1: "Ernststr. 57",

  addressLine2: "13509 Berlin",

  country: "Deutschland",

  phoneDisplay: "030 / 40 74 53 12",

  phoneE164: "+493040745312",

  email: "info@fahrschuletaym.de",

  website: "https://fahrschule-taym.de",
} as const;

/* ============================================================
   2. SUPERVISORY AUTHORITY

   Based on Berlin's official LABO
   responsibility for driving schools.

   This is not a partnership claim.
   ============================================================ */

const AUTHORITY = {
  name:
    "Landesamt für Bürger- und Ordnungsangelegenheiten (LABO)",

  website:
    "https://www.berlin.de/labo/mobilitaet/fahrerlaubnisse-personen-und-gueterbefoerderung/fahrschule/",
} as const;

/* ============================================================
   3. USER INTERFACE TRANSLATIONS
   ============================================================ */

const UI = {
  de: {
    eyebrow: "RECHTLICHE INFORMATIONEN",
    title: "Impressum",
    subtitle:
      "Anbieterkennzeichnung und rechtliche Hinweise der Fahrschule TAYM.",
    legalBasis: "Angaben gemäß § 5 DDG",
    provider: "Angaben zum Anbieter",
    operator: "Anbieter",
    responsible: "Verantwortliche Person",
    address: "Anschrift",
    phone: "Telefon",
    email: "E-Mail",
    website: "Website",
    authorityTitle: "Zuständige Aufsichtsbehörde",
    authorityDescription:
      "Zuständige Behörde für die Aufsicht über Fahrschulen in Berlin.",
    visitAuthority: "Behördliche Informationen",
    legalNotice: "Rechtliche Hinweise",
    legalNoticeDescription:
      "Informationen zu Inhalten, externen Verlinkungen und Urheberrechten.",
    contactTitle: "Fragen zu rechtlichen Angaben?",
    contactDescription:
      "Bei Rückfragen zu dieser Anbieterkennzeichnung erreichen Sie uns telefonisch oder per E-Mail.",
    call: "Jetzt anrufen",
    sendEmail: "E-Mail schreiben",
    home: "Zur Startseite",
    back: "Zurück zur Startseite",
    lawCountry:
      "Diese Anbieterkennzeichnung betrifft den angegebenen Betreiber in Deutschland.",
    pendingNote:
      "Vor der Veröffentlichung müssen Rechtsform, gegebenenfalls Registerdaten, Umsatzsteuer-Identifikationsnummer und weitere gesetzlich erforderliche Angaben anhand der Unternehmensunterlagen geprüft werden.",
  },

  ar: {
    eyebrow: "المعلومات القانونية",
    title: "البيانات القانونية",
    subtitle:
      "معلومات الجهة المشغلة والبيانات القانونية لمدرسة TAYM لتعليم القيادة.",
    legalBasis:
      "المعلومات وفق المادة 5 من قانون الخدمات الرقمية الألماني DDG",
    provider: "بيانات الجهة المشغلة",
    operator: "الجهة المشغلة",
    responsible: "الشخص المسؤول",
    address: "العنوان",
    phone: "الهاتف",
    email: "البريد الإلكتروني",
    website: "الموقع الإلكتروني",
    authorityTitle: "الجهة الرقابية المختصة",
    authorityDescription:
      "الجهة المختصة بالإشراف على مدارس تعليم القيادة في برلين.",
    visitAuthority: "معلومات الجهة الرسمية",
    legalNotice: "إشعارات قانونية",
    legalNoticeDescription:
      "معلومات حول محتوى الموقع والروابط الخارجية وحقوق النشر.",
    contactTitle:
      "هل لديك أسئلة حول البيانات القانونية؟",
    contactDescription:
      "للاستفسارات المتعلقة بهذه المعلومات يمكن التواصل معنا عبر الهاتف أو البريد الإلكتروني.",
    call: "اتصل الآن",
    sendEmail: "إرسال بريد إلكتروني",
    home: "الصفحة الرئيسية",
    back: "العودة للرئيسية",
    lawCountry:
      "تخص هذه البيانات الجهة المشغلة المذكورة في ألمانيا.",
    pendingNote:
      "قبل النشر يجب التحقق من الشكل القانوني للشركة وبيانات السجل والرقم الضريبي ذي الصلة وأي معلومات أخرى يفرضها القانون.",
  },

  tr: {
    eyebrow: "YASAL BİLGİLER",
    title: "Yasal Bildirim",
    subtitle:
      "Fahrschule TAYM'ın işletmeci ve yasal iletişim bilgileri.",
    legalBasis:
      "Alman DDG Kanunu § 5 uyarınca bilgiler",
    provider: "İşletmeci bilgileri",
    operator: "Hizmet sağlayıcı",
    responsible: "Sorumlu kişi",
    address: "Adres",
    phone: "Telefon",
    email: "E-posta",
    website: "Web sitesi",
    authorityTitle: "Yetkili denetim kurumu",
    authorityDescription:
      "Berlin'deki sürücü kurslarının denetiminden sorumlu kurum.",
    visitAuthority: "Resmî kurum bilgileri",
    legalNotice: "Yasal açıklamalar",
    legalNoticeDescription:
      "Site içeriği, harici bağlantılar ve telif haklarına ilişkin bilgiler.",
    contactTitle:
      "Yasal bilgiler hakkında sorunuz mu var?",
    contactDescription:
      "Bu bilgilerle ilgili sorularınız için bize telefonla veya e-postayla ulaşabilirsiniz.",
    call: "Şimdi ara",
    sendEmail: "E-posta gönder",
    home: "Ana sayfa",
    back: "Ana sayfaya dön",
    lawCountry:
      "Bu yasal bildirim Almanya'daki belirtilen işletmeciye ilişkindir.",
    pendingNote:
      "Yayımlamadan önce şirketin hukuki statüsü, varsa sicil ve KDV kimlik bilgileri ile diğer zorunlu bilgiler resmî kayıtlardan doğrulanmalıdır.",
  },

  es: {
    eyebrow: "INFORMACIÓN LEGAL",
    title: "Aviso legal",
    subtitle:
      "Identificación del operador e información legal de Fahrschule TAYM.",
    legalBasis:
      "Información conforme al artículo 5 de la ley alemana DDG",
    provider: "Datos del operador",
    operator: "Prestador del servicio",
    responsible: "Persona responsable",
    address: "Dirección",
    phone: "Teléfono",
    email: "Correo electrónico",
    website: "Sitio web",
    authorityTitle:
      "Autoridad de supervisión competente",
    authorityDescription:
      "Organismo encargado de la supervisión de autoescuelas en Berlín.",
    visitAuthority: "Información oficial",
    legalNotice: "Avisos legales",
    legalNoticeDescription:
      "Información sobre contenidos, enlaces externos y derechos de autor.",
    contactTitle:
      "¿Tiene preguntas sobre este aviso legal?",
    contactDescription:
      "Para consultas sobre estos datos puede llamarnos o escribirnos.",
    call: "Llamar ahora",
    sendEmail: "Enviar correo",
    home: "Inicio",
    back: "Volver al inicio",
    lawCountry:
      "Este aviso legal corresponde al operador indicado en Alemania.",
    pendingNote:
      "Antes de publicar deben verificarse la forma jurídica, los datos registrales y fiscales aplicables y cualquier otra información legalmente obligatoria.",
  },
} as const;

/* ============================================================
   4. LEGAL SECTIONS

   Modernized from the historic German
   disclaimer without repeating obsolete
   TMG references.

   Translation preserves the substance,
   not an assertion of total immunity.
   ============================================================ */

const SECTIONS: LegalSection[] = [
  {
    id: "content",
    icon: FileText,

    title: {
      de: "Haftung für Inhalte",
      ar: "المسؤولية عن المحتوى",
      tr: "İçerik sorumluluğu",
      es: "Responsabilidad por los contenidos",
    },

    paragraphs: [
      {
        de: "Wir erstellen die Inhalte dieser Website mit größtmöglicher Sorgfalt und bemühen uns um richtige, vollständige und aktuelle Informationen. Dennoch können wir nicht gewährleisten, dass alle Angaben jederzeit vollständig oder fehlerfrei sind.",
        ar: "نُعد محتويات هذا الموقع بعناية كبيرة ونسعى إلى تقديم معلومات صحيحة وكاملة ومحدثة، إلا أننا لا نستطيع ضمان خلو جميع المعلومات من الأخطاء في جميع الأوقات.",
        tr: "Bu web sitesindeki içerikleri büyük özenle hazırlıyor, doğru, eksiksiz ve güncel bilgiler sunmaya çalışıyoruz. Bununla birlikte tüm bilgilerin her zaman hatasız veya eksiksiz olduğunu garanti edemeyiz.",
        es: "Elaboramos los contenidos de este sitio con el máximo cuidado y procuramos ofrecer información correcta, completa y actualizada. Sin embargo, no podemos garantizar que toda la información esté siempre completa o libre de errores.",
      },

      {
        de: "Für eigene Inhalte sind wir nach den allgemeinen gesetzlichen Vorschriften verantwortlich. Soweit gesetzliche Regelungen eine eingeschränkte Verantwortlichkeit für fremde Informationen vorsehen, gelten die entsprechenden Bestimmungen des Digital Services Act (Verordnung (EU) 2022/2065) und des Digitale-Dienste-Gesetzes.",
        ar: "نحن مسؤولون عن المحتوى الذي ننشره وفقاً للقوانين العامة. وفي الحالات التي تحدد فيها القوانين مسؤولية مقدمي الخدمات عن المعلومات الصادرة من الغير، تُطبق أحكام قانون الخدمات الرقمية الأوروبي والقانون الألماني للخدمات الرقمية.",
        tr: "Kendi içeriklerimizden genel yasal hükümler uyarınca sorumluyuz. Üçüncü kişilere ait bilgiler için sınırlı sorumluluk öngören durumlarda AB Dijital Hizmetler Tüzüğü ve Alman Dijital Hizmetler Yasası'nın ilgili hükümleri geçerlidir.",
        es: "Somos responsables de nuestros propios contenidos conforme a la legislación general. Cuando la normativa establece una responsabilidad limitada por información de terceros, se aplican las disposiciones pertinentes del Reglamento de Servicios Digitales de la UE y de la ley alemana DDG.",
      },
    ],
  },

  {
    id: "links",
    icon: Link2,

    title: {
      de: "Haftung für externe Links",
      ar: "المسؤولية عن الروابط الخارجية",
      tr: "Harici bağlantılara ilişkin sorumluluk",
      es: "Responsabilidad por enlaces externos",
    },

    paragraphs: [
      {
        de: "Unsere Website kann Links zu externen Websites Dritter enthalten. Auf die Inhalte dieser Websites haben wir keinen unmittelbaren Einfluss. Für deren Inhalte sind grundsätzlich die jeweiligen Anbieter und Betreiber verantwortlich.",
        ar: "قد يحتوي موقعنا على روابط لمواقع خارجية تابعة لجهات أخرى. ولا نتحكم مباشرة في محتواها، ويتحمل مشغلو تلك المواقع المسؤولية عن محتوياتها وفقاً للقانون.",
        tr: "Web sitemiz üçüncü kişilere ait harici sitelere bağlantılar içerebilir. Bu sitelerin içeriklerini doğrudan kontrol etmiyoruz. İçeriklerinden genel olarak ilgili site sağlayıcıları ve işletmecileri sorumludur.",
        es: "Nuestro sitio puede contener enlaces a páginas externas de terceros sobre cuyo contenido no tenemos control directo. La responsabilidad por esos contenidos corresponde, en principio, a sus respectivos titulares u operadores.",
      },

      {
        de: "Erhalten wir konkrete Hinweise auf rechtswidrige Inhalte verlinkter Seiten, prüfen wir diese Hinweise und entfernen entsprechende Links, soweit dies rechtlich geboten ist.",
        ar: "إذا تلقينا معلومات محددة عن محتوى غير قانوني في موقع مرتبط، فسندرس هذه المعلومات ونزيل الروابط عند الاقتضاء وفقاً للقانون.",
        tr: "Bağlantı verilen sayfalardaki hukuka aykırı içeriklere ilişkin somut bildirimler aldığımızda bunları inceler ve hukuken gerekli olduğu ölçüde ilgili bağlantıları kaldırırız.",
        es: "Si recibimos avisos concretos sobre contenidos ilícitos en páginas enlazadas, los examinaremos y retiraremos los enlaces cuando exista la obligación legal correspondiente.",
      },
    ],
  },

  {
    id: "copyright",
    icon: Copyright,

    title: {
      de: "Urheberrecht",
      ar: "حقوق الطبع والنشر",
      tr: "Telif hakları",
      es: "Derechos de autor",
    },

    paragraphs: [
      {
        de: "Die von uns erstellten Texte, Bilder, Grafiken und sonstigen Werke unterliegen dem geltenden Urheberrecht. Eine Nutzung außerhalb der gesetzlichen Schranken bedarf der Zustimmung der jeweiligen Rechteinhaber.",
        ar: "تخضع النصوص والصور والرسومات والأعمال الأخرى التي ننشئها لقوانين حقوق النشر المعمول بها. ويتطلب استخدامها خارج الحدود التي يسمح بها القانون موافقة أصحاب الحقوق.",
        tr: "Tarafımızdan oluşturulan metinler, görseller, grafikler ve diğer eserler yürürlükteki telif hakkı hukukuna tabidir. Yasal istisnalar dışındaki kullanımlar için ilgili hak sahiplerinin izni gerekir.",
        es: "Los textos, imágenes, gráficos y demás obras creados por nosotros están sujetos a la legislación vigente sobre propiedad intelectual. Cualquier uso fuera de los límites legales requiere autorización de los titulares de los derechos.",
      },

      {
        de: "Soweit Inhalte von Dritten verwendet werden, achten wir auf deren Rechte und kennzeichnen solche Inhalte, soweit erforderlich. Bei Hinweisen auf mögliche Urheberrechtsverletzungen bitten wir um Kontaktaufnahme, damit wir den Sachverhalt prüfen können.",
        ar: "عند استخدام محتوى تابع للغير نحترم حقوق أصحابه ونوضح مصدره عندما يكون ذلك مطلوباً. وإذا لاحظت انتهاكاً محتملاً لحقوق النشر، يرجى التواصل معنا للتحقق من الأمر.",
        tr: "Üçüncü taraf içeriklerinde hak sahiplerinin haklarına saygı gösterir ve gerekli durumlarda kaynakları belirtiriz. Olası telif hakkı ihlallerini bize bildirirseniz durumu inceleyebiliriz.",
        es: "Cuando utilizamos contenidos de terceros, respetamos sus derechos y los identificamos cuando corresponde. Si detecta una posible infracción de derechos de autor, puede ponerse en contacto para que examinemos el caso.",
      },
    ],
  },
];

/* ============================================================
   5. LANGUAGE SYNCHRONIZATION

   Uses existing site mechanisms.
   No second language selector.
   ============================================================ */

function validLocale(
  value: unknown
): Locale | null {
  if (typeof value !== "string") {
    return null;
  }

  const code = value
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];

  return code === "de" ||
    code === "ar" ||
    code === "tr" ||
    code === "es"
    ? code
    : null;
}

function readLocaleCookie(): Locale | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookieNames = [
    "taym-locale",
    "NEXT_LOCALE",
  ];

  for (const name of cookieNames) {
    const prefix = `${name}=`;

    const entry = document.cookie
      .split(";")
      .map((item) => item.trim())
      .find((item) =>
        item.startsWith(prefix)
      );

    if (!entry) continue;

    try {
      const locale = validLocale(
        decodeURIComponent(
          entry.slice(prefix.length)
        )
      );

      if (locale) return locale;
    } catch {
      // Ignore invalid cookie.
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

  const cookieLocale =
    readLocaleCookie();

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
   6. REUSABLE COMPONENTS
   ============================================================ */

function InformationRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 border-b border-slate-100 py-4 last:border-b-0">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-50 text-green-800">
        <Icon size={20} aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-500">
          {label}
        </p>

        <div className="mt-1 wrap-break-word text-sm font-semibold leading-7 text-slate-950 sm:text-base">
          {children}
        </div>
      </div>
    </div>
  );
}

function LegalCard({
  section,
  locale,
}: {
  section: LegalSection;
  locale: Locale;
}) {
  const Icon = section.icon;

  return (
    <article
      id={section.id}
      className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-green-800">
          <Icon size={22} aria-hidden="true" />
        </span>

        <h3 className="text-lg font-extrabold text-slate-950 sm:text-xl">
          {section.title[locale]}
        </h3>
      </div>

      <div className="mt-5 space-y-4 text-sm leading-8 text-slate-600">
        {section.paragraphs.map(
          (paragraph, index) => (
            <p key={index}>
              {paragraph[locale]}
            </p>
          )
        )}
      </div>
    </article>
  );
}

/* ============================================================
   7. MAIN COMPONENT
   ============================================================ */

export default function ImpressumContent() {
  const [locale, setLocale] =
    useState<Locale>("de");

  useEffect(() => {
    function syncLocale(event?: Event) {
      if (event instanceof CustomEvent) {
        const detail: unknown = event.detail;

        const incoming =
          typeof detail === "string"
            ? detail
            : detail &&
                typeof detail === "object" &&
                "locale" in detail
              ? detail.locale
              : null;

        const next = validLocale(incoming);

        if (next) {
          setLocale(next);
          return;
        }
      }

      setLocale(getActiveLocale());
    }

    syncLocale();

    const observer = new MutationObserver(
      () => syncLocale()
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
      syncLocale
    );

    window.addEventListener(
      "storage",
      syncLocale
    );

    window.addEventListener(
      "focus",
      syncLocale
    );

    return () => {
      observer.disconnect();

      window.removeEventListener(
        "taym:language-change",
        syncLocale
      );

      window.removeEventListener(
        "storage",
        syncLocale
      );

      window.removeEventListener(
        "focus",
        syncLocale
      );
    };
  }, []);

  const t = UI[locale];

  const rtl = locale === "ar";

  const Arrow = rtl
    ? ArrowLeft
    : ArrowRight;

  const mapsUrl =
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(
      [
        OPERATOR.name,
        OPERATOR.addressLine1,
        OPERATOR.addressLine2,
        OPERATOR.country,
      ].join(", ")
    );

  return (
    <main
      lang={locale}
      dir={rtl ? "rtl" : "ltr"}
      className="min-w-0 overflow-hidden bg-[#f5f8f2] text-slate-950"
    >
      {/* ================================================
          HERO
          ================================================ */}

      <section className="relative overflow-hidden bg-[#142318]">
        <div className="pointer-events-none absolute -inset-e-20 -top-24 size-72 rounded-full bg-lime-500/15 blur-3xl" />

        <div className="relative mx-auto max-w-none px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-lime-400/30 bg-lime-400/10 px-4 py-2 text-xs font-bold tracking-wider text-lime-300">
            <Scale size={16} aria-hidden="true" />
            {t.eyebrow}
          </span>

          <h1 className="mt-6 text-3xl font-black text-white sm:text-4xl lg:text-5xl">
            {t.title}
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-200 sm:text-base">
            {t.subtitle}
          </p>

          <span className="mt-6 inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-lime-200">
            <ShieldCheck size={17} />
            {t.legalBasis}
          </span>
        </div>
      </section>

      {/* ================================================
          MAIN CONTENT
          ================================================ */}

      <div className="mx-auto grid max-w-none gap-7 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1fr)_310px] lg:gap-8 lg:px-8">
        <div className="min-w-0 space-y-6">

          {/* ============================================
              OPERATOR
              ============================================ */}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-xl bg-lime-100 text-green-800">
                <Building2 size={25} />
              </span>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-green-800">
                  {t.legalBasis}
                </p>

                <h2 className="mt-1 text-xl font-black sm:text-2xl">
                  {t.provider}
                </h2>
              </div>
            </div>

            <div className="mt-5">
              <InformationRow
                icon={Building2}
                label={t.operator}
              >
                {OPERATOR.name}
              </InformationRow>

              <InformationRow
                icon={UserRound}
                label={t.responsible}
              >
                {OPERATOR.responsiblePerson}
              </InformationRow>

              <InformationRow
                icon={MapPin}
                label={t.address}
              >
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-wrap items-center gap-1.5 hover:text-green-800"
                >
                  <span>
                    {OPERATOR.addressLine1},{" "}
                    {OPERATOR.addressLine2},{" "}
                    {OPERATOR.country}
                  </span>
                  <ExternalLink size={14} />
                </a>
              </InformationRow>

              <InformationRow
                icon={Phone}
                label={t.phone}
              >
                <a
                  href={`tel:${OPERATOR.phoneE164}`}
                  dir="ltr"
                  className="hover:text-green-800"
                >
                  {OPERATOR.phoneDisplay}
                </a>
              </InformationRow>

              <InformationRow
                icon={Mail}
                label={t.email}
              >
                <a
                  href={`mailto:${OPERATOR.email}`}
                  dir="ltr"
                  className="break-all hover:text-green-800"
                >
                  {OPERATOR.email}
                </a>
              </InformationRow>

              <InformationRow
                icon={Globe2}
                label={t.website}
              >
                <a
                  href={OPERATOR.website}
                  className="break-all hover:text-green-800"
                >
                  {OPERATOR.website}
                </a>
              </InformationRow>
            </div>
          </section>

          {/* ============================================
              SUPERVISORY AUTHORITY
              ============================================ */}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-lime-100 text-green-800">
                <Landmark size={23} />
              </span>

              <h2 className="text-lg font-extrabold sm:text-xl">
                {t.authorityTitle}
              </h2>
            </div>

            <p className="mt-5 text-sm font-bold leading-7">
              {AUTHORITY.name}
            </p>

            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {t.authorityDescription}
            </p>

            <a
              href={AUTHORITY.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-lime-200 bg-lime-50 px-4 py-2.5 text-sm font-bold text-green-800 transition-colors hover:bg-lime-100"
            >
              {t.visitAuthority}
              <ExternalLink
                size={16}
                aria-hidden="true"
              />
            </a>
          </section>

          {/* ============================================
              LEGAL DISCLAIMERS
              ============================================ */}

          <section className="space-y-4">
            <div className="mb-5">
              <h2 className="text-xl font-black sm:text-2xl">
                {t.legalNotice}
              </h2>

              <p className="mt-2 text-sm text-slate-600">
                {t.legalNoticeDescription}
              </p>
            </div>

            {SECTIONS.map((section) => (
              <LegalCard
                key={section.id}
                section={section}
                locale={locale}
              />
            ))}
          </section>

          <div className="flex items-start gap-3 rounded-xl border border-lime-200 bg-lime-50 p-4">
            <Info
              size={19}
              className="mt-0.5 shrink-0 text-green-800"
            />

            <p className="text-xs leading-relaxed text-green-950 sm:text-sm">
              {t.lawCountry}
            </p>
          </div>
        </div>

        {/* ================================================
            CONTACT SIDEBAR

            A simple sidebar within this page,
            not an application navigation.
            ================================================ */}

        <aside className="min-w-0">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
            <span className="flex size-12 items-center justify-center rounded-xl bg-lime-100 text-green-800">
              <Mail size={24} />
            </span>

            <h2 className="mt-5 text-lg font-black">
              {t.contactTitle}
            </h2>

            <p className="mt-3 text-sm leading-7 text-slate-600">
              {t.contactDescription}
            </p>

            <div className="mt-6 space-y-3">
              <a
                href={`mailto:${OPERATOR.email}`}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-green-800 to-lime-600 px-4 py-3 text-center text-sm font-bold text-white hover:from-green-900 hover:to-lime-700"
              >
                <Mail size={18} />
                {t.sendEmail}
              </a>

              <a
                href={`tel:${OPERATOR.phoneE164}`}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-green-800 px-4 py-3 text-center text-sm font-bold text-green-800 hover:bg-lime-50"
              >
                <Phone size={18} />
                {t.call}
              </a>

              <Link
                href="/"
                className="flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-slate-600 hover:text-green-800"
              >
                {t.back}

                <Arrow size={17} />
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
