
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MapPin,
  Phone,
  Mail,
  House,
  CarFront,
  BookOpen,
  GraduationCap,
  ClipboardList,
  RefreshCw,
  CalendarDays,
  Users,
  ShieldCheck,
  ArrowUpRight,
  ArrowUp,
  HeartHandshake,
} from "lucide-react";

import {
  defaultLocale,
  isLocale,
  type Locale,
} from "@/i18n/config";

/* =========================================================
   FAHRSCHULE TAYM
   FOOTER OFFICIEL - DESKTOP & MOBILE
   ========================================================= */

type TextKey =
  | "description"
  | "quickLinks"
  | "servicesTitle"
  | "contactTitle"
  | "home"
  | "classes"
  | "theory"
  | "practical"
  | "application"
  | "conversion"
  | "appointments"
  | "about"
  | "contact"
  | "support"
  | "legal"
  | "imprint"
  | "privacy"
  | "terms"
  | "rights"
  | "backToTop"
  | "location"
  | "onlineService"
  | "countries"
  | "countryList"
  | "tagline";

type FooterDictionary = Record<TextKey, string>;

const translations: Record<Locale, FooterDictionary> = {
  de: {
    description:
      "Ihre Plattform für Führerscheinausbildung, Theorie, Praxis und die Begleitung rund um den Führerschein.",
    quickLinks: "Schnellzugriff",
    servicesTitle: "Unsere Services",
    contactTitle: "Kontakt",
    home: "Startseite",
    classes: "Führerscheinklassen",
    theory: "Theorieausbildung",
    practical: "Praktische Ausbildung",
    application: "Führerschein beantragen",
    conversion: "Führerscheinumschreibung",
    appointments: "Termine",
    about: "Über uns",
    contact: "Kontakt",
    support: "Persönliche Betreuung",
    legal: "Rechtliches",
    imprint: "Impressum",
    privacy: "Datenschutz",
    terms: "Nutzungsbedingungen",
    rights: "Alle Rechte vorbehalten.",
    backToTop: "Nach oben",
    location: "Unser Standort",
    onlineService: "Online-Service",
    countries: "Unsere Länder",
    countryList:
      "Deutschland · Spanien · Italien · Österreich · Belgien",
    tagline: "Dein Weg zum Führerschein beginnt hier.",
  },

  ar: {
    description:
      "منصتكم لتعلم القيادة، والدروس النظرية والعملية، والمساعدة في إجراءات رخصة القيادة.",
    quickLinks: "روابط سريعة",
    servicesTitle: "خدماتنا",
    contactTitle: "اتصل بنا",
    home: "الرئيسية",
    classes: "فئات رخص القيادة",
    theory: "التدريب النظري",
    practical: "التدريب العملي",
    application: "طلب رخصة القيادة",
    conversion: "تحويل رخصة القيادة",
    appointments: "المواعيد",
    about: "من نحن",
    contact: "اتصل بنا",
    support: "المساعدة الشخصية",
    legal: "المعلومات القانونية",
    imprint: "البيانات القانونية",
    privacy: "سياسة الخصوصية",
    terms: "شروط الاستخدام",
    rights: "جميع الحقوق محفوظة.",
    backToTop: "العودة إلى الأعلى",
    location: "موقعنا",
    onlineService: "الخدمات عبر الإنترنت",
    countries: "الدول التي نستهدفها",
    countryList:
      "ألمانيا · إسبانيا · إيطاليا · النمسا · بلجيكا",
    tagline: "رحلتك للحصول على رخصة القيادة تبدأ هنا.",
  },

  tr: {
    description:
      "Ehliyet eğitimi, teori, pratik ve ehliyet işlemlerinde rehberlik için platformunuz.",
    quickLinks: "Hızlı Bağlantılar",
    servicesTitle: "Hizmetlerimiz",
    contactTitle: "İletişim",
    home: "Ana Sayfa",
    classes: "Ehliyet Sınıfları",
    theory: "Teorik Eğitim",
    practical: "Pratik Sürüş Eğitimi",
    application: "Ehliyet Başvurusu",
    conversion: "Ehliyet Dönüştürme",
    appointments: "Randevular",
    about: "Hakkımızda",
    contact: "İletişim",
    support: "Kişisel Destek",
    legal: "Yasal Bilgiler",
    imprint: "Yasal Bildirim",
    privacy: "Gizlilik Politikası",
    terms: "Kullanım Koşulları",
    rights: "Tüm hakları saklıdır.",
    backToTop: "Yukarı Çık",
    location: "Konumumuz",
    onlineService: "Çevrimiçi Hizmet",
    countries: "Hedef Ülkelerimiz",
    countryList:
      "Almanya · İspanya · İtalya · Avusturya · Belçika",
    tagline: "Ehliyet yolculuğunuz burada başlıyor.",
  },

  es: {
    description:
      "Tu plataforma de formación vial, teoría, práctica y acompañamiento en los trámites del permiso de conducir.",
    quickLinks: "Enlaces Rápidos",
    servicesTitle: "Nuestros Servicios",
    contactTitle: "Contacto",
    home: "Inicio",
    classes: "Clases de Permiso",
    theory: "Formación Teórica",
    practical: "Formación Práctica",
    application: "Solicitar Permiso",
    conversion: "Canje de Permiso",
    appointments: "Citas",
    about: "Sobre Nosotros",
    contact: "Contacto",
    support: "Atención Personalizada",
    legal: "Información Legal",
    imprint: "Aviso Legal",
    privacy: "Política de Privacidad",
    terms: "Condiciones de Uso",
    rights: "Todos los derechos reservados.",
    backToTop: "Volver Arriba",
    location: "Nuestra Ubicación",
    onlineService: "Servicio Online",
    countries: "Nuestros Países",
    countryList:
      "Alemania · España · Italia · Austria · Bélgica",
    tagline: "Tu camino hacia el permiso empieza aquí.",
  },
};

/* =========================================================
   COORDONNÉES
   À CONFIRMER AVANT LA MISE EN PRODUCTION
   ========================================================= */

const contactInfo = {
  address: "Ernststr. 57, D-13509 Berlin",
  phoneDisplay: "030 / 40 74 53 12",
  phoneHref: "tel:+493040745312",
  email: "info@fahrschule-taym.de",
  emailHref: "mailto:info@fahrschule-taym.de",
};

/* =========================================================
   CONFIGURATION DES LIENS
   ========================================================= */

const quickLinks = [
  { key: "home", href: "/", icon: House },
  {
    key: "classes",
    href: "/fuehrerscheinklassen",
    icon: CarFront,
  },
  {
    key: "theory",
    href: "/dashboard/application",
    icon: BookOpen,
  },
  {
    key: "practical",
    href: "/dashboard/application",
    icon: GraduationCap,
  },
  {
    key: "about",
    href: "/ueber-uns",
    icon: Users,
  },
  {
    key: "contact",
    href: "/kontakt",
    icon: Mail,
  },
] as const;

const serviceLinks = [
  {
    key: "application",
    href: "/services",
    icon: ClipboardList,
  },
  {
    key: "conversion",
    href: "/services",
    icon: RefreshCw,
  },
  {
    key: "appointments",
    href: "/services",
    icon: CalendarDays,
  },
  {
    key: "support",
    href: "/services",
    icon: HeartHandshake,
  },
] as const;

const legalLinks = [
  {
    key: "imprint",
    href: "/impressum",
  },
  {
    key: "privacy",
    href: "/datenschutzerklaerung",
  },
] as const;

/* =========================================================
   UTILITAIRES MULTILINGUES
   ========================================================= */

function getPathLocale(pathname: string): Locale | null {
  const segment = pathname.split("/")[1];

  if (segment && isLocale(segment)) {
    return segment;
  }

  return null;
}

function getPreferredLocale(pathname: string): Locale {
  const pathLocale = getPathLocale(pathname);

  if (pathLocale) return pathLocale;

  if (typeof document === "undefined") {
    return defaultLocale;
  }

  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith("taym-locale="));

  if (cookie) {
    const value = cookie.slice("taym-locale=".length);

    if (isLocale(value)) {
      return value;
    }
  }

  const documentLanguage = document.documentElement.lang
    .toLowerCase()
    .split("-")[0];

  if (isLocale(documentLanguage)) {
    return documentLanguage;
  }

  return defaultLocale;
}

/* =========================================================
   COMPOSANT FOOTER
   ========================================================= */

export default function Footer() {
  const pathname = usePathname() || "/";

  const [locale, setLocale] = useState<Locale>(
    defaultLocale
  );

  const pathLocale = getPathLocale(pathname);
  const activeLocale = pathLocale ?? locale;
  const t = translations[activeLocale];

  const isRTL = activeLocale === "ar";
  const [currentYear, setCurrentYear] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setCurrentYear(new Date().getFullYear()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  /* Préférence de langue */

  useEffect(() => {
    const timer = window.setTimeout(() => setLocale(getPreferredLocale(pathname)), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  /* Synchronisation avec LanguageSwitcher */

  useEffect(() => {
    function handleLanguageChange(event: Event) {
      const customEvent = event as CustomEvent<Locale>;

      if (isLocale(customEvent.detail)) {
        setLocale(customEvent.detail);
      }
    }

    window.addEventListener(
      "taym:language-change",
      handleLanguageChange
    );

    return () => {
      window.removeEventListener(
        "taym:language-change",
        handleLanguageChange
      );
    };
  }, []);

  /* Conserver le préfixe linguistique si présent */

  function localizedHref(href: string): string {
    if (!pathLocale) return href;

    if (href === "/") return `/${pathLocale}`;

    return `/${pathLocale}${href}`;
  }

  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
        ? "instant"
        : "smooth",
    });
  }

  return (
    <footer
      className={`taym-footer${/^\/(?:de\/|ar\/|tr\/|es\/)?dashboard(?:\/|$)/.test(pathname) ? " taym-footer--dashboard" : ""}`}
      dir={isRTL ? "rtl" : "ltr"}
      lang={activeLocale}
    >
      {/* ACCENT VERT SUPÉRIEUR */}

      <div
        className="taym-footer-accent"
        aria-hidden="true"
      />

      {/* CONTENU PRINCIPAL */}

      <div className="taym-footer-main">
        <div className="taym-container">
          <div className="taym-footer-grid">
            {/* IDENTITÉ ET DESCRIPTION */}

            <div className="taym-footer-brand-column">
              <Link
                href={localizedHref("/")}
                className="taym-footer-logo"
                aria-label="Fahrschule TAYM"
              >
                <Image
                  src="/logo/logo.jpg"
                  alt="Fahrschule TAYM"
                  width={260}
                  height={80}
                  className="taym-footer-logo-image"
                />
              </Link>

              <p className="taym-footer-description">
                {t.description}
              </p>

              <p className="taym-footer-tagline">
                <CarFront
                  size={17}
                  aria-hidden="true"
                />
                <span>{t.tagline}</span>
              </p>

              <div className="taym-footer-country-box">
                <span className="taym-footer-country-title">
                  <MapPin
                    size={15}
                    aria-hidden="true"
                  />
                  {t.countries}
                </span>

                <span className="taym-footer-country-list">
                  {t.countryList}
                </span>
              </div>
            </div>

            {/* LIENS RAPIDES */}

            <div className="taym-footer-column">
              <h2 className="taym-footer-heading">
                {t.quickLinks}
              </h2>

              <nav aria-label={t.quickLinks}>
                <ul className="taym-footer-links">
                  {quickLinks.map((item) => {
                    const Icon = item.icon;

                    return (
                      <li key={item.key}>
                        <Link
                          href={localizedHref(item.href)}
                          className="taym-footer-link"
                        >
                          <Icon
                            size={15}
                            aria-hidden="true"
                          />

                          <span>{t[item.key]}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>

            {/* SERVICES */}

            <div className="taym-footer-column">
              <h2 className="taym-footer-heading">
                {t.servicesTitle}
              </h2>

              <nav aria-label={t.servicesTitle}>
                <ul className="taym-footer-links">
                  {serviceLinks.map((item) => {
                    const Icon = item.icon;

                    return (
                      <li key={item.key}>
                        <Link
                          href={localizedHref(item.href)}
                          className="taym-footer-link"
                        >
                          <Icon
                            size={15}
                            aria-hidden="true"
                          />

                          <span>{t[item.key]}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div className="taym-footer-online-badge">
                <ShieldCheck
                  size={16}
                  aria-hidden="true"
                />
                <span>{t.onlineService}</span>
              </div>
            </div>

            {/* COORDONNÉES */}

            <div className="taym-footer-column">
              <h2 className="taym-footer-heading">
                {t.contactTitle}
              </h2>

              <div className="taym-footer-contacts">
                <div className="taym-footer-contact-item">
                  <span className="taym-footer-contact-icon">
                    <MapPin
                      size={18}
                      aria-hidden="true"
                    />
                  </span>

                  <div>
                    <span className="taym-footer-contact-label">
                      {t.location}
                    </span>

                    <span
                      className="taym-footer-contact-value"
                      dir="ltr"
                    >
                      {contactInfo.address}
                    </span>
                  </div>
                </div>

                <a
                  href={contactInfo.phoneHref}
                  className="taym-footer-contact-item"
                >
                  <span className="taym-footer-contact-icon">
                    <Phone
                      size={18}
                      aria-hidden="true"
                    />
                  </span>

                  <span
                    className="taym-footer-contact-value"
                    dir="ltr"
                  >
                    {contactInfo.phoneDisplay}
                  </span>
                </a>

                <a
                  href={contactInfo.emailHref}
                  className="taym-footer-contact-item"
                >
                  <span className="taym-footer-contact-icon">
                    <Mail
                      size={18}
                      aria-hidden="true"
                    />
                  </span>

                  <span
                    className="taym-footer-contact-value"
                    dir="ltr"
                  >
                    {contactInfo.email}
                  </span>
                </a>

                <Link
                  href={localizedHref("/kontakt")}
                  className="taym-footer-contact-button"
                >
                  <Mail
                    size={16}
                    aria-hidden="true"
                  />
                  <span>{t.contact}</span>
                  <ArrowUpRight
                    size={16}
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BANDE DES MENTIONS LÉGALES */}

      <div className="taym-footer-bottom">
        <div className="taym-container">
          <div className="taym-footer-bottom-inner">
            <p className="taym-footer-copyright">
              © <span>{currentYear}</span> Fahrschule TAYM.
              {" "}
              {t.rights}
            </p>

            <nav
              className="taym-footer-legal"
              aria-label={t.legal}
            >
              {legalLinks.map((item) => (
                <Link
                  key={item.key}
                  href={localizedHref(item.href)}
                >
                  {t[item.key]}
                </Link>
              ))}
            </nav>

            <button
              type="button"
              className="taym-footer-back-to-top"
              onClick={scrollToTop}
              aria-label={t.backToTop}
              title={t.backToTop}
            >
              <ArrowUp
                size={17}
                aria-hidden="true"
              />
              <span>{t.backToTop}</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
