
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  ClipboardList,
  BookOpen,
  CalendarDays,
  UserRound,
} from "lucide-react";

import {
  defaultLocale,
  isLocale,
  type Locale,
} from "@/i18n/config";

/* =========================================================
   FAHRSCHULE TAYM
   NAVIGATION MOBILE
   ========================================================= */

type NavKey =
  | "home"
  | "classes"
  | "theory"
  | "appointments"
  | "account";

type NavLabels = Record<NavKey, string>;

/* Traductions de la navigation */

const translations: Record<Locale, NavLabels> = {
  de: {
    home: "Dashboard",
    classes: "Antrag",
    theory: "Theorie",
    appointments: "Termine",
    account: "Konto",
  },

  ar: {
    home: "لوحة التحكم",
    classes: "الطلب",
    theory: "النظري",
    appointments: "المواعيد",
    account: "حسابي",
  },

  tr: {
    home: "Panel",
    classes: "Başvuru",
    theory: "Teori",
    appointments: "Randevular",
    account: "Hesabım",
  },

  es: {
    home: "Panel",
    classes: "Solicitud",
    theory: "Teoría",
    appointments: "Citas",
    account: "Cuenta",
  },
};

/* Configuration des rubriques */

const navigation = [
  {
    key: "home",
    href: "/dashboard",
    icon: House,
  },
  {
    key: "classes",
    href: "/dashboard/application",
    icon: ClipboardList,
  },
  {
    key: "theory",
    href: "/dashboard/application",
    icon: BookOpen,
  },
  {
    key: "appointments",
    href: "/services",
    icon: CalendarDays,
  },
  {
    key: "account",
    href: "/konto",
    icon: UserRound,
  },
] as const;

/* Nettoyage des chemins */

function normalizePath(path: string): string {
  if (!path || path === "/") return "/";

  return path.replace(/\/+$/, "") || "/";
}

/* Détection de la langue dans l'URL */

function getPathLocale(pathname: string): Locale | null {
  const segment = pathname.split("/")[1];

  if (segment && isLocale(segment)) {
    return segment;
  }

  return null;
}

/* Détection de la page active */

function isActivePath(
  currentPath: string,
  targetPath: string
): boolean {
  const current = normalizePath(currentPath);
  const target = normalizePath(targetPath);

  if (target === "/" || target === "/dashboard") {
    return current === "/";
  }

  return (
    current === target ||
    current.startsWith(`${target}/`)
  );
}

/* =========================================================
   COMPOSANT PRINCIPAL
   ========================================================= */

export default function MobileNav() {
  const pathname = usePathname() || "/";

  const [locale, setLocale] =
    useState<Locale>(defaultLocale);

  /* Détection de la langue active */

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const urlLocale = getPathLocale(pathname);
      const documentLocale = document.documentElement.lang.toLowerCase().split("-")[0];
      setLocale(urlLocale ?? (isLocale(documentLocale) ? documentLocale : defaultLocale));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  const urlLocale = getPathLocale(pathname);

  const activeLocale = urlLocale ?? locale;

  /* Suppression éventuelle du préfixe de langue */

  const cleanPath = urlLocale
    ? pathname.replace(
        new RegExp(`^/${urlLocale}(?=/|$)`),
        ""
      ) || "/"
    : pathname;

  const labels = translations[activeLocale];

  /* Génération des liens */

  function getHref(href: string): string {
    if (!urlLocale) return href;

    if (href === "/") {
      return `/${urlLocale}`;
    }

    return `/${urlLocale}${href}`;
  }

  return (
    <nav
      className="taym-mobile-bottom-nav"
      aria-label="Mobile navigation"
      dir={activeLocale === "ar" ? "rtl" : "ltr"}
    >
      <div className="taym-mobile-nav-inner">
        {navigation.map((item) => {
          const Icon = item.icon;

          const active = isActivePath(
            cleanPath,
            item.href
          );

          const label = labels[item.key];

          return (
            <Link
              key={item.key}
              href={getHref(item.href)}
              className={`taym-mobile-nav-item${
                active ? " is-active" : ""
              }`}
              aria-current={
                active ? "page" : undefined
              }
              aria-label={label}
              title={label}
            >
              <span
                className="taym-mobile-nav-icon"
                aria-hidden="true"
              >
                <Icon
                  size={22}
                  strokeWidth={active ? 2.4 : 1.9}
                />
              </span>

              <span className="taym-mobile-nav-label">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
