
import type { ReactNode } from "react";

export const instant = false;

import Link from "next/link";

import {
  redirect,
} from "next/navigation";

import {
  cookies,
} from "next/headers";

import {
  ClipboardList,
  ExternalLink,
  Globe2,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  ShieldCheck,
} from "lucide-react";

/*
 * IMPORTANT:
 *
 * This module must validate a REAL admin session
 * against the server-side session store.
 *
 * It must never trust only the existence
 * of a cookie.
 *
 * Contract:
 *
 * getAdminSession():
 * Promise<{ adminId: string } | null>
 *
 * We will implement this function in:
 * src/lib/admin/session.ts
 */

import {
  getAdminSession,
} from "@/lib/admin/session";

/* ============================================================
   FAHRSCHULE TAYM
   PROTECTED ADMINISTRATOR LAYOUT

   File:
   src/app/(admin)/admin/(protected)/layout.tsx

   Protected URLs:
   /admin/dashboard
   /admin/applications
   /admin/applications/[id]

   Login:
   /admin/login

   Main navigation:
   - Dashboard
   - Führerscheinanträge

   Security:
   - Server-side session verification
   - Redirect before rendering
   - No client-side password checks
   - No admin secrets in browser
   - No exposed session tokens

   Responsive:
   - Desktop sidebar
   - Mobile horizontal navigation

   Languages:
   de | ar | tr | es
   ============================================================ */

/* ============================================================
   1. TRANSLATION TYPES
   ============================================================ */

type Locale = "de" | "ar" | "tr" | "es";

/* ============================================================
   2. TRANSLATIONS
   ============================================================ */

const TRANSLATIONS = {
  de: {
    administration: "Administration",

    adminSpace:
      "Administratorbereich",

    navigation:
      "Navigation",

    dashboard:
      "Dashboard",

    applications:
      "Führerscheinanträge",

    secureArea:
      "Geschützter Bereich",

    secureDescription:
      "Dieser Bereich ist ausschließlich für autorisierte Administratoren zugänglich.",

    website:
      "Website ansehen",

    logout:
      "Abmelden",

    loggedIn:
      "Administrator",

    allCountries:
      "5 Länder",

    footer:
      "Fahrschule TAYM · Administration",

    activity:
      "Verwaltung der Führerscheinanträge",

    brand:
      "Fahrschule TAYM",
  },

  ar: {
    administration:
      "الإدارة",

    adminSpace:
      "مساحة المسؤول",

    navigation:
      "التنقل",

    dashboard:
      "لوحة التحكم",

    applications:
      "طلبات رخص القيادة",

    secureArea:
      "مساحة محمية",

    secureDescription:
      "هذه المساحة مخصصة للمسؤولين المصرح لهم فقط.",

    website:
      "زيارة الموقع",

    logout:
      "تسجيل الخروج",

    loggedIn:
      "المسؤول",

    allCountries:
      "5 دول",

    footer:
      "Fahrschule TAYM · الإدارة",

    activity:
      "إدارة طلبات رخص القيادة",

    brand:
      "Fahrschule TAYM",
  },

  tr: {
    administration:
      "Yönetim",

    adminSpace:
      "Yönetici alanı",

    navigation:
      "Gezinme",

    dashboard:
      "Kontrol paneli",

    applications:
      "Ehliyet başvuruları",

    secureArea:
      "Korumalı alan",

    secureDescription:
      "Bu alan yalnızca yetkili yöneticiler içindir.",

    website:
      "Web sitesini görüntüle",

    logout:
      "Çıkış yap",

    loggedIn:
      "Yönetici",

    allCountries:
      "5 ülke",

    footer:
      "Fahrschule TAYM · Yönetim",

    activity:
      "Ehliyet başvurularının yönetimi",

    brand:
      "Fahrschule TAYM",
  },

  es: {
    administration:
      "Administración",

    adminSpace:
      "Área administrativa",

    navigation:
      "Navegación",

    dashboard:
      "Panel de control",

    applications:
      "Solicitudes de permisos",

    secureArea:
      "Área protegida",

    secureDescription:
      "Esta área está reservada a administradores autorizados.",

    website:
      "Ver sitio web",

    logout:
      "Cerrar sesión",

    loggedIn:
      "Administrador",

    allCountries:
      "5 países",

    footer:
      "Fahrschule TAYM · Administración",

    activity:
      "Gestión de solicitudes de permisos",

    brand:
      "Fahrschule TAYM",
  },
} as const;

/* ============================================================
   3. NAVIGATION CONFIGURATION

   Exactly two main pages.
   ============================================================ */

const ADMIN_NAVIGATION = [
  {
    id: "dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
  },

  {
    id: "applications",
    href: "/admin/applications",
    icon: ClipboardList,
  },
] as const;

/* ============================================================
   4. LOCALE HELPERS

   Locale selection is only for
   presentation. It does not grant
   any administrative permission.
   ============================================================ */

function normalizeLocale(
  value: string | undefined
): Locale | null {
  if (!value) {
    return null;
  }

  const code = value
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];

  if (
    code === "de" ||
    code === "ar" ||
    code === "tr" ||
    code === "es"
  ) {
    return code;
  }

  return null;
}

async function getAdminLocale():
  Promise<Locale> {
  const cookieStore =
    await cookies();

  return (
    normalizeLocale(
      cookieStore.get(
        "taym-locale"
      )?.value
    ) ??
    normalizeLocale(
      cookieStore.get(
        "NEXT_LOCALE"
      )?.value
    ) ??
    "de"
  );
}

/* ============================================================
   5. LOGO / BRAND

   Reusable within the admin layout.

   If the project already has an
   official logo component, it can
   replace this icon-based branding.
   ============================================================ */

function AdminBrand({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <Link
      href="/admin/dashboard"
      aria-label="Fahrschule TAYM Dashboard"
      className="inline-flex min-w-0 items-center gap-3"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-lime-300 to-lime-500 text-green-950 shadow-sm">
        <GraduationCap
          size={24}
          aria-hidden="true"
        />
      </span>

      <span className="min-w-0">
        <span className="block text-[11px] font-black leading-tight tracking-widest text-slate-600">
          FAHRSCHULE
        </span>

        <span className="block text-xl font-black leading-tight tracking-tight text-green-900">
          TAYM
        </span>

        {!compact && (
          <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Administration
          </span>
        )}
      </span>
    </Link>
  );
}

/* ============================================================
   6. NAVIGATION LINKS

   Server-rendered links.

   Actual active page highlighting
   can be added later through a small
   client navigation component,
   without moving authentication
   to the client.
   ============================================================ */

function AdminNavigation({
  locale,
  mobile = false,
}: {
  locale: Locale;
  mobile?: boolean;
}) {
  const t = TRANSLATIONS[locale];

  const labels = {
    dashboard: t.dashboard,
    applications: t.applications,
  };

  return (
    <nav
      aria-label={t.navigation}
      className={
        mobile
          ? "flex min-w-max items-center gap-2"
          : "flex flex-col gap-2"
      }
    >
      {ADMIN_NAVIGATION.map((item) => {
        const Icon = item.icon;

        return (
          <Link
            key={item.id}
            href={item.href}
            className={
              mobile
                ? [
                    "inline-flex min-h-11",
                    "shrink-0 items-center",
                    "justify-center gap-2",
                    "rounded-xl",
                    "border border-slate-200",
                    "bg-white px-4 py-2.5",
                    "text-xs font-bold",
                    "text-slate-700",
                    "transition-colors",
                    "hover:border-lime-400",
                    "hover:bg-lime-50",
                    "hover:text-green-900",
                    "focus-visible:outline-none",
                    "focus-visible:ring-2",
                    "focus-visible:ring-lime-500",
                  ].join(" ")
                : [
                    "group flex min-h-12",
                    "items-center gap-3",
                    "rounded-xl",
                    "px-4 py-3",
                    "text-sm font-bold",
                    "text-slate-700",
                    "transition-colors",
                    "hover:bg-lime-100",
                    "hover:text-green-900",
                    "focus-visible:outline-none",
                    "focus-visible:ring-2",
                    "focus-visible:ring-lime-500",
                  ].join(" ")
            }
          >
            <Icon
              size={19}
              className="shrink-0 text-green-800"
              aria-hidden="true"
            />

            <span>
              {labels[item.id]}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/* ============================================================
   7. LOGOUT BUTTON

   POST request to:
   /api/admin/auth/logout

   The API must:
   - Validate the current session
   - Revoke it on the server
   - Clear the session cookie
   - Redirect to /admin/login

   The button does not simply remove
   local browser state.

   Note:
   This HTML form expects the POST API
   to support form submissions and
   return a redirect.
   ============================================================ */

function LogoutButton({
  text,
  compact = false,
}: {
  text: string;
  compact?: boolean;
}) {
  return (
    <form
      action="/api/admin/auth/logout"
      method="POST"
      className={
        compact
          ? "shrink-0"
          : "w-full"
      }
    >
      <button
        type="submit"
        className={
          compact
            ? [
                "inline-flex min-h-10",
                "items-center justify-center",
                "gap-2 rounded-xl",
                "border border-red-200",
                "bg-red-50 px-3",
                "text-xs font-bold",
                "text-red-700",
                "transition-colors",
                "hover:bg-red-100",
                "focus-visible:outline-none",
                "focus-visible:ring-2",
                "focus-visible:ring-red-300",
              ].join(" ")
            : [
                "flex min-h-12 w-full",
                "items-center gap-3",
                "rounded-xl",
                "border border-red-200",
                "bg-red-50 px-4 py-3",
                "text-sm font-bold",
                "text-red-700",
                "transition-colors",
                "hover:bg-red-100",
                "focus-visible:outline-none",
                "focus-visible:ring-2",
                "focus-visible:ring-red-300",
              ].join(" ")
        }
      >
        <LogOut
          size={18}
          aria-hidden="true"
        />

        <span>{text}</span>
      </button>
    </form>
  );
}

/* ============================================================
   8. DESKTOP SIDEBAR
   ============================================================ */

function AdminSidebar({
  locale,
}: {
  locale: Locale;
}) {
  const t = TRANSLATIONS[locale];

  return (
    <aside
      className={[
        "sticky top-0 hidden",
        "h-screen w-66.25",
        "shrink-0",
        "flex-col",
        "border-e border-slate-200",
        "bg-white",
        "lg:flex",
      ].join(" ")}
    >
      {/* Brand */}

      <div className="border-b border-slate-100 px-6 py-7">
        <AdminBrand />
      </div>

      {/* Navigation */}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <p className="mb-4 px-4 text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
          {t.navigation}
        </p>

        <AdminNavigation
          locale={locale}
        />

        {/* Security card */}

        <div className="mt-10 rounded-2xl border border-lime-200 bg-[#f2f8ed] p-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-white text-green-800">
            <ShieldCheck
              size={21}
              aria-hidden="true"
            />
          </span>

          <h3 className="mt-4 text-sm font-extrabold text-green-950">
            {t.secureArea}
          </h3>

          <p className="mt-2 text-xs leading-6 text-green-950/75">
            {t.secureDescription}
          </p>
        </div>
      </div>

      {/* Bottom actions */}

      <div className="space-y-4 border-t border-slate-100 p-4">
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center gap-3 rounded-xl px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-green-900"
        >
          <ExternalLink
            size={18}
            aria-hidden="true"
          />

          <span>
            {t.website}
          </span>
        </Link>

        <LogoutButton
          text={t.logout}
        />
      </div>
    </aside>
  );
}

/* ============================================================
   9. MOBILE HEADER

   Shown on phones/tablets.

   Navigation is horizontally
   scrollable, but remains limited
   to the two requested pages.
   ============================================================ */

function AdminMobileHeader({
  locale,
}: {
  locale: Locale;
}) {
  const t = TRANSLATIONS[locale];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
      <div className="flex min-h-18 items-center justify-between gap-3 px-4 sm:px-6">
        <AdminBrand compact />

        <LogoutButton
          text={t.logout}
          compact
        />
      </div>

      <div className="border-t border-slate-100 px-4 py-2 sm:px-6">
        <div className="overflow-x-auto pb-1">
          <AdminNavigation
            locale={locale}
            mobile
          />
        </div>
      </div>
    </header>
  );
}

/* ============================================================
   10. DESKTOP TOP BAR
   ============================================================ */

function AdminTopBar({
  locale,
}: {
  locale: Locale;
}) {
  const t = TRANSLATIONS[locale];

  return (
    <header className="hidden min-h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 lg:flex xl:px-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-green-800">
          {t.administration}
        </p>

        <p className="mt-1 text-sm font-semibold text-slate-600">
          {t.activity}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-lime-50 px-3 py-2 text-xs font-bold text-green-800">
          <Globe2
            size={15}
            aria-hidden="true"
          />

          {t.allCountries}
        </span>

        <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-lime-100 text-green-800">
            <LockKeyhole
              size={18}
              aria-hidden="true"
            />
          </span>

          <span className="text-xs font-bold text-slate-700">
            {t.loggedIn}
          </span>
        </div>
      </div>
    </header>
  );
}

/* ============================================================
   11. PROTECTED ADMINISTRATOR LAYOUT

   Security boundary:

   getAdminSession() MUST:
   1. Read an HttpOnly session cookie
   2. Validate the session server-side
   3. Verify it is not expired
   4. Verify it has not been revoked
   5. Verify its administrator identity
   6. Return null otherwise

   This is not a cookie-existence check.

   Protected API routes must perform
   their own authorization checks.

   Never rely only on this layout
   for API or document protection.
   ============================================================ */

export default async function AdminProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  /* --------------------------------------------------------
     A. Server authentication
     -------------------------------------------------------- */

  const adminSession =
    await getAdminSession();

  if (!adminSession) {
    redirect("/admin/login");
  }

  /* --------------------------------------------------------
     B. Language and direction
     -------------------------------------------------------- */

  const locale =
    await getAdminLocale();

  const rtl = locale === "ar";

  const t =
    TRANSLATIONS[locale];

  /* --------------------------------------------------------
     C. Render protected UI
     -------------------------------------------------------- */

  return (
    <div
      lang={locale}
      dir={rtl ? "rtl" : "ltr"}
      className="min-h-screen bg-[#f5f8f2] text-slate-950"
    >
      <div className="flex min-h-screen min-w-0">

        {/* ================================================
           SIDEBAR — DESKTOP
           ================================================ */}

        <AdminSidebar
          locale={locale}
        />

        {/* ================================================
           MAIN AREA
           ================================================ */}

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">

          {/* Mobile header + navigation */}

          <AdminMobileHeader
            locale={locale}
          />

          {/* Desktop top bar */}

          <AdminTopBar
            locale={locale}
          />

          {/* ============================================
             PAGE CONTENT

             Dashboard and applications pages
             render inside this container.
             ============================================ */}

          <main
            id="admin-main-content"
            className="min-w-0 flex-1"
          >
            {children}
          </main>

          {/* ============================================
             FOOTER
             ============================================ */}

          <footer className="border-t border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-500">
                © {new Date().getFullYear()}{" "}
                {t.footer}
              </p>

              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-800">
                <ShieldCheck
                  size={15}
                  aria-hidden="true"
                />

                {t.secureArea}
              </span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   END — FAHRSCHULE TAYM
   ============================================================ */
