
"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
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
  Contact,
  LogIn,
  UserPlus,
  UserRound,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import LanguageSwitcher from "./LanguageSwitcher";

import {
  defaultLocale,
  isLocale,
  type Locale,
} from "@/i18n/config";

/* =========================================================
   FAHRSCHULE TAYM
   HEADER PRINCIPAL - DESKTOP & MOBILE
   ========================================================= */

type TextKey =
  | "home"
  | "classes"
  | "theory"
  | "services"
  | "about"
  | "contact"
  | "login"
  | "register"
  | "account"
  | "menu"
  | "close"
  | "practical"
  | "application"
  | "conversion"
  | "appointments"
  | "allClasses"
  | "onlineTheory"
  | "training"
  | "support"
  | "welcome";

type Dictionary = Record<TextKey, string>;

/* =========================================================
   TRADUCTIONS DES MENUS
   ========================================================= */

const translations: Record<Locale, Dictionary> = {
  de: {
    home: "Startseite",
    classes: "Führerscheinklassen",
    theory: "Theorie & Praxis",
    services: "Unsere Services",
    about: "Über uns",
    contact: "Kontakt",
    login: "Anmelden",
    register: "Registrieren",
    account: "Mein Konto",
    menu: "Menü öffnen",
    close: "Menü schließen",
    practical: "Praktische Ausbildung",
    application: "Führerschein beantragen",
    conversion: "Führerscheinumschreibung",
    appointments: "Termine",
    allClasses: "Alle Führerscheinklassen",
    onlineTheory: "Online-Theorie",
    training: "Ausbildung",
    support: "Persönliche Betreuung",
    welcome: "Willkommen bei Fahrschule TAYM",
  },

  ar: {
    home: "الرئيسية",
    classes: "فئات رخص القيادة",
    theory: "النظري والعملي",
    services: "خدماتنا",
    about: "من نحن",
    contact: "اتصل بنا",
    login: "تسجيل الدخول",
    register: "إنشاء حساب",
    account: "حسابي",
    menu: "فتح القائمة",
    close: "إغلاق القائمة",
    practical: "التدريب العملي",
    application: "التقدم بطلب رخصة قيادة",
    conversion: "تحويل رخصة القيادة",
    appointments: "المواعيد",
    allClasses: "جميع فئات رخص القيادة",
    onlineTheory: "التعليم النظري عبر الإنترنت",
    training: "التدريب",
    support: "المساعدة الشخصية",
    welcome: "مرحباً بكم في Fahrschule TAYM",
  },

  tr: {
    home: "Ana Sayfa",
    classes: "Ehliyet Sınıfları",
    theory: "Teori ve Pratik",
    services: "Hizmetlerimiz",
    about: "Hakkımızda",
    contact: "İletişim",
    login: "Giriş Yap",
    register: "Kayıt Ol",
    account: "Hesabım",
    menu: "Menüyü aç",
    close: "Menüyü kapat",
    practical: "Pratik Sürüş Eğitimi",
    application: "Ehliyet Başvurusu",
    conversion: "Ehliyet Dönüştürme",
    appointments: "Randevular",
    allClasses: "Tüm Ehliyet Sınıfları",
    onlineTheory: "Çevrimiçi Teori",
    training: "Eğitim",
    support: "Kişisel Destek",
    welcome: "Fahrschule TAYM'e Hoş Geldiniz",
  },

  es: {
    home: "Inicio",
    classes: "Clases de Permiso",
    theory: "Teoría y Práctica",
    services: "Nuestros Servicios",
    about: "Sobre Nosotros",
    contact: "Contacto",
    login: "Iniciar Sesión",
    register: "Registrarse",
    account: "Mi Cuenta",
    menu: "Abrir menú",
    close: "Cerrar menú",
    practical: "Formación Práctica",
    application: "Solicitar Permiso",
    conversion: "Canje de Permiso",
    appointments: "Citas",
    allClasses: "Todas las Clases",
    onlineTheory: "Teoría Online",
    training: "Formación",
    support: "Atención Personalizada",
    welcome: "Bienvenido a Fahrschule TAYM",
  },
};

/* =========================================================
   CONFIGURATION DES LIENS
   ========================================================= */

type NavItem = {
  key: TextKey;
  href: string;
  icon: typeof House;
  children?: {
    key: TextKey;
    href: string;
    icon: typeof House;
  }[];
};

const navigation: NavItem[] = [
  {
    key: "home",
    href: "/",
    icon: House,
  },
  {
    key: "classes",
    href: "/fuehrerscheinklassen",
    icon: CarFront,
    children: [
      {
        key: "allClasses",
        href: "/fuehrerscheinklassen",
        icon: CarFront,
      },
      {
        key: "application",
        href: "/dashboard/application",
        icon: ClipboardList,
      },
    ],
  },
  {
    key: "theory",
    href: "/dashboard/application",
    icon: BookOpen,
    children: [
      {
        key: "onlineTheory",
        href: "/dashboard/application",
        icon: BookOpen,
      },
      {
        key: "practical",
        href: "/dashboard/application",
        icon: GraduationCap,
      },
    ],
  },
  {
    key: "services",
    href: "/services",
    icon: ClipboardList,
    children: [
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
        icon: Contact,
      },
    ],
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
];

/* =========================================================
   GESTION DES LANGUES ET ROUTES
   ========================================================= */

function getPathLocale(pathname: string): Locale | null {
  const segment = pathname.split("/")[1];

  if (segment && isLocale(segment)) {
    return segment;
  }

  return null;
}

function removeLocalePrefix(pathname: string): string {
  const pathLocale = getPathLocale(pathname);

  if (!pathLocale) return pathname || "/";

  return pathname.slice(pathLocale.length + 1) || "/";
}

function isActivePath(
  currentPath: string,
  targetPath: string
): boolean {
  const current =
    currentPath.replace(/\/+$/, "") || "/";

  const target =
    targetPath.replace(/\/+$/, "") || "/";

  if (target === "/") return current === "/";

  return (
    current === target ||
    current.startsWith(`${target}/`)
  );
}

function readPreferredLocale(pathname: string): Locale {
  const pathLocale = getPathLocale(pathname);

  if (pathLocale) return pathLocale;

  if (typeof document !== "undefined") {
    const cookie = document.cookie
      .split("; ")
      .find((item) => item.startsWith("taym-locale="));

    if (cookie) {
      const value = cookie.substring("taym-locale=".length);

      if (isLocale(value)) return value;
    }

    const docLang =
      document.documentElement.lang
        .toLowerCase()
        .split("-")[0];

    if (isLocale(docLang)) return docLang;
  }

  return defaultLocale;
}

/* =========================================================
   HEADER
   ========================================================= */

export default function Header() {
  const pathname = usePathname() || "/";

  const [locale, setLocale] =
    useState<Locale>(defaultLocale);

  const [mobileOpen, setMobileOpen] = useState(false);

  const [expandedMenu, setExpandedMenu] =
    useState<string | null>(null);

  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);

  const pathLocale = getPathLocale(pathname);
  const activeLocale = pathLocale ?? locale;

  const t = translations[activeLocale];
  const cleanPath = removeLocalePrefix(pathname);

  const isRTL = activeLocale === "ar";

  /* Synchronisation initiale */

  useEffect(() => {
    const timer = window.setTimeout(() => setLocale(readPreferredLocale(pathname)), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  /* Synchronisation avec LanguageSwitcher */

  useEffect(() => {
    function handleLanguageChange(event: Event) {
      const customEvent = event as CustomEvent<Locale>;

      if (isLocale(customEvent.detail)) {
        setLocale(customEvent.detail);
        setMobileOpen(false);
        setExpandedMenu(null);
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

  /* Fermeture après changement de page */

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMobileOpen(false);
      setExpandedMenu(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  /* Fermeture avec Échap ou clic extérieur */

  useEffect(() => {
    if (!mobileOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        mobileTriggerRef.current?.focus();
      }
    }

    function handleOutside(event: PointerEvent) {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node) &&
        mobileTriggerRef.current &&
        !mobileTriggerRef.current.contains(event.target as Node)
      ) {
        setMobileOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("pointerdown", handleOutside);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("pointerdown", handleOutside);
    };
  }, [mobileOpen]);

  /* Liens compatibles avec les routes localisées */

  function localizedHref(href: string): string {
    if (!pathLocale) return href;

    if (href === "/") return `/${pathLocale}`;

    return `/${pathLocale}${href}`;
  }

  /* Menu déroulant mobile */

  function toggleSubmenu(key: string) {
    setExpandedMenu((current) =>
      current === key ? null : key
    );
  }

  return (
    <header
      className="taym-site-header"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* =========================================
          BARRE CONTACT - DESKTOP
          ========================================= */}

      <div className="taym-header-topbar">
        <div className="taym-container taym-header-topbar-inner">
          <div className="taym-header-contact">
            <span className="taym-header-contact-item">
              <MapPin size={14} aria-hidden="true" />
              <span>Ernststr. 57, D-13509 Berlin</span>
            </span>

            <a
              href="tel:+493040745312"
              className="taym-header-contact-item"
              dir="ltr"
            >
              <Phone size={14} aria-hidden="true" />
              <span>030 / 40 74 53 12</span>
            </a>

            <a
              href="mailto:info@fahrschule-taym.de"
              className="taym-header-contact-item"
              dir="ltr"
            >
              <Mail size={14} aria-hidden="true" />
              <span>info@fahrschule-taym.de</span>
            </a>
          </div>

          <LanguageSwitcher />
        </div>
      </div>

      {/* =========================================
          NAVIGATION PRINCIPALE
          ========================================= */}

      <div className="taym-header-main">
        <div className="taym-container taym-header-main-inner">
          {/* LOGO ORIGINAL */}

          <Link
            href={localizedHref("/")}
            className="taym-header-brand"
            aria-label="Fahrschule TAYM"
            onClick={() => setMobileOpen(false)}
          >
            <Image
              src="/logo/logo.jpg"
              alt="Fahrschule TAYM"
              width={260}
              height={80}
              priority
              className="taym-header-brand-image"
            />
          </Link>

          {/* NAVIGATION DESKTOP */}

          <nav
            className="taym-header-desktop-nav"
            aria-label={t.menu}
          >
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(
                cleanPath,
                item.href
              );

              return (
                <div
                  key={item.key}
                  className={`taym-header-nav-group${
                    active ? " is-active" : ""
                  }`}
                >
                  <Link
                    href={localizedHref(item.href)}
                    className="taym-header-nav-link"
                    aria-current={
                      active ? "page" : undefined
                    }
                  >
                    {item.key === "home" && (
                      <Icon
                        size={15}
                        aria-hidden="true"
                      />
                    )}

                    <span>{t[item.key]}</span>
                  </Link>

                  {item.children && (
                    <div className="taym-header-nav-dropdown">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon;

                        return (
                          <Link
                            key={child.key}
                            href={localizedHref(child.href)}
                            className="taym-header-dropdown-link"
                          >
                            <ChildIcon
                              size={17}
                              aria-hidden="true"
                            />
                            <span>{t[child.key]}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* ACTIONS DESKTOP */}

          <div className="taym-header-desktop-actions">
            <Link
              href={localizedHref("/login")}
              className="taym-header-login"
            >
              <LogIn size={16} aria-hidden="true" />
              <span>{t.login}</span>
            </Link>

            <Link
              href={localizedHref("/register")}
              className="taym-header-register"
            >
              <UserPlus size={16} aria-hidden="true" />
              <span>{t.register}</span>
            </Link>
          </div>

          {/* ACTIONS MOBILE */}

          <div className="taym-header-mobile-actions">
            <LanguageSwitcher />

            <Link
              href={localizedHref("/dashboard/account")}
              className="taym-header-mobile-icon"
              aria-label={t.account}
              title={t.account}
            >
              <UserRound
                size={21}
                strokeWidth={1.9}
                aria-hidden="true"
              />
            </Link>

            <button
              ref={mobileTriggerRef}
              type="button"
              className={`taym-header-mobile-icon taym-header-menu-trigger${
                mobileOpen ? " is-open" : ""
              }`}
              onClick={() =>
                setMobileOpen((current) => !current)
              }
              aria-expanded={mobileOpen}
              aria-controls="taym-header-mobile-menu"
              aria-label={
                mobileOpen ? t.close : t.menu
              }
            >
              {mobileOpen ? (
                <X size={23} aria-hidden="true" />
              ) : (
                <Menu size={23} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* =========================================
          MENU MOBILE DÉROULANT
          ========================================= */}

      {mobileOpen && (
        <div
          ref={mobileMenuRef}
          id="taym-header-mobile-menu"
          className="taym-header-mobile-panel"
        >
          <div className="taym-header-mobile-panel-inner">
            <div className="taym-header-mobile-welcome">
              <span className="taym-header-mobile-welcome-icon">
                <CarFront
                  size={19}
                  aria-hidden="true"
                />
              </span>
              <span>{t.welcome}</span>
            </div>

            <nav
              className="taym-header-mobile-nav"
              aria-label={t.menu}
            >
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActivePath(
                  cleanPath,
                  item.href
                );

                const expanded =
                  expandedMenu === item.key;

                return (
                  <div
                    key={item.key}
                    className="taym-header-mobile-nav-group"
                  >
                    <div
                      className={`taym-header-mobile-nav-row${
                        active ? " is-active" : ""
                      }`}
                    >
                      <Link
                        href={localizedHref(item.href)}
                        className="taym-header-mobile-nav-link"
                        onClick={() =>
                          setMobileOpen(false)
                        }
                        aria-current={
                          active ? "page" : undefined
                        }
                      >
                        <Icon
                          size={20}
                          strokeWidth={1.9}
                          aria-hidden="true"
                        />

                        <span>{t[item.key]}</span>
                      </Link>

                      {item.children && (
                        <button
                          type="button"
                          className="taym-header-mobile-submenu-trigger"
                          onClick={() =>
                            toggleSubmenu(item.key)
                          }
                          aria-expanded={expanded}
                          aria-label={t[item.key]}
                        >
                          <ChevronDown
                            size={18}
                            className={
                              expanded ? "is-open" : ""
                            }
                            aria-hidden="true"
                          />
                        </button>
                      )}
                    </div>

                    {item.children && expanded && (
                      <div className="taym-header-mobile-submenu">
                        {item.children.map((child) => {
                          const ChildIcon = child.icon;

                          return (
                            <Link
                              key={child.key}
                              href={localizedHref(child.href)}
                              className="taym-header-mobile-submenu-link"
                              onClick={() =>
                                setMobileOpen(false)
                              }
                            >
                              <ChildIcon
                                size={17}
                                aria-hidden="true"
                              />

                              <span>{t[child.key]}</span>

                              <ChevronRight
                                size={15}
                                className="taym-header-mobile-submenu-arrow"
                                aria-hidden="true"
                              />
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            {/* CONNEXION ET INSCRIPTION */}

            <div className="taym-header-mobile-auth">
              <Link
                href={localizedHref("/login")}
                className="taym-header-login"
                onClick={() => setMobileOpen(false)}
              >
                <LogIn size={17} aria-hidden="true" />
                <span>{t.login}</span>
              </Link>

              <Link
                href={localizedHref("/register")}
                className="taym-header-register"
                onClick={() => setMobileOpen(false)}
              >
                <UserPlus size={17} aria-hidden="true" />
                <span>{t.register}</span>
              </Link>
            </div>

            {/* CONTACT MOBILE */}

            <div className="taym-header-mobile-contact">
              <a href="tel:+493040745312">
                <Phone size={15} aria-hidden="true" />
                <span dir="ltr">030 / 40 74 53 12</span>
              </a>

              <a href="mailto:info@fahrschule-taym.de">
                <Mail size={15} aria-hidden="true" />
                <span dir="ltr">
                  info@fahrschule-taym.de
                </span>
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
