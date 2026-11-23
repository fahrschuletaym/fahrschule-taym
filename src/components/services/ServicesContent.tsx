
"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import Image from "next/image";
import Link from "next/link";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  BusFront,
  CarFront,
  Check,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  Globe2,
  GraduationCap,
  Headphones,
  Info,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Truck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import {
  DEFAULT_SERVICES_COUNTRY,
  DEFAULT_SERVICES_LOCALE,
  SERVICES_COUNTRIES,
  SERVICES_COUNTRY_FLAGS,
  SERVICES_COUNTRY_NAMES,
  getServicesPageConfig,
  getServicesDirection,
  normalizeServicesCountry,
  type LocalizedService,
  type PublicServicePartner,
  type ServiceAvailability,
  type ServiceCategory,
  type ServiceCountry,
  type ServiceLocale,
} from "@/config/services";

/* ============================================================
   FAHRSCHULE TAYM

   File:
   src/components/services/ServicesContent.tsx

   Public page:
   /services

   Countries:
   DE | AT | BE | IT | ES

   Languages:
   de | ar | tr | es

   Responsive:
   Mobile | Tablet | Desktop

   Existing layout provides:
   - Header
   - MobileNav
   - Footer

   This component does NOT create
   any duplicate navigation or layout.

   Data source:
   src/config/services.ts
   ============================================================ */

/* ============================================================
   1. LANGUAGE CONFIGURATION
   ============================================================ */

const LANGUAGE_COOKIE =
  "taym-locale";

const LANGUAGE_STORAGE =
  "taym-locale";

const LANGUAGE_EVENT =
  "taym:language-change";

const SUPPORTED_LOCALES:
  readonly ServiceLocale[] = [
    "de",
    "ar",
    "tr",
    "es",
  ];

/* ============================================================
   2. LOCALIZED COUNTRY SELECTION
   ============================================================ */

function isServiceCountry(
  value: unknown
): value is ServiceCountry {
  return (
    typeof value === "string" &&
    (
      SERVICES_COUNTRIES as
        readonly string[]
    ).includes(value)
  );
}

function readInitialCountry():
  ServiceCountry {
  if (typeof window === "undefined") {
    return DEFAULT_SERVICES_COUNTRY;
  }

  const parameters =
    new URLSearchParams(
      window.location.search
    );

  return (
    normalizeServicesCountry(
      parameters.get("country")
    ) ??
    DEFAULT_SERVICES_COUNTRY
  );
}

/* ============================================================
   3. LANGUAGE HELPERS

   Reuses the project's language cookie,
   localStorage and custom event.

   No duplicate language selector.
   ============================================================ */

function readCookie(
  name: string
): string | null {
  if (
    typeof document === "undefined"
  ) {
    return null;
  }

  const prefix = `${name}=`;

  const found = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) =>
      item.startsWith(prefix)
    );

  if (!found) {
    return null;
  }

  try {
    return decodeURIComponent(
      found.slice(prefix.length)
    );

  } catch {
    return null;
  }
}

function supportedLocale(
  value: unknown
): ServiceLocale | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];

  return SUPPORTED_LOCALES.includes(
    normalized as ServiceLocale
  )
    ? (
        normalized as ServiceLocale
      )
    : null;
}

function getCurrentLocale():
  ServiceLocale {
  if (typeof window === "undefined") {
    return DEFAULT_SERVICES_LOCALE;
  }

  let storedLocale: string | null =
    null;

  try {
    storedLocale =
      window.localStorage.getItem(
        LANGUAGE_STORAGE
      );

  } catch {
    // Browser storage can be disabled.
  }

  return (
    supportedLocale(
      readCookie(LANGUAGE_COOKIE)
    ) ??
    supportedLocale(storedLocale) ??
    supportedLocale(
      document.documentElement.lang
    ) ??
    DEFAULT_SERVICES_LOCALE
  );
}

/* ============================================================
   4. ICON CONFIGURATION
   ============================================================ */

const SERVICE_ICONS: Record<
  LocalizedService["icon"],
  LucideIcon
> = {
  "book-open": BookOpen,

  "car-front": CarFront,

  "clipboard-list": ClipboardList,

  "file-check": FileCheck2,

  "graduation-cap": GraduationCap,

  truck: Truck,

  "briefcase-business":
    BriefcaseBusiness,

  headset: Headphones,
};

/* ============================================================
   5. SAFE IMAGE PATHS

   Only local images configured
   in src/config/services.ts.

   No remote image sources.
   ============================================================ */

function getSafeLocalImage(
  path: string | null
): string | null {
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("..") ||
    path.includes("\\") ||
    path.includes("%") ||
    !/^\/[A-Za-z0-9/_\-.]+$/.test(
      path
    ) ||
    !/\.(png|jpg|jpeg|webp|avif)$/i
      .test(path)
  ) {
    return null;
  }

  return path;
}

/* ============================================================
   6. SERVICE IMAGE COMPONENT

   Actual photo when configured.

   Icon placeholder if the local photo
   is missing or fails to load.

   Never invents or fetches
   partner photographs.
   ============================================================ */

function ServicePhoto({
  src,
  alt,
  icon: Icon,
  priority = false,
  hero = false,
}: {
  src: string | null;
  alt: string;
  icon: LucideIcon;
  priority?: boolean;
  hero?: boolean;
}) {
  const [failed, setFailed] =
    useState(false);

  const safeSrc =
    getSafeLocalImage(src);

  const displayPhoto =
    safeSrc !== null && !failed;

  return (
    <div
      className={`relative w-full overflow-hidden bg-linear-to-br from-[#ddefc9] via-[#f2f8e9] to-[#f8faf6] ${
        hero
          ? "min-h-67.5 sm:min-h-92.5 lg:min-h-112.5"
          : "aspect-16/10"
      }`}
    >
      {displayPhoto ? (
        <Image
          src={safeSrc}
          alt={alt}
          fill
          priority={priority}
          sizes={
            hero
              ? "(max-width: 1024px) 100vw, 48vw"
              : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          }
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          onError={() =>
            setFailed(true)
          }
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={`flex items-center justify-center rounded-4xl border border-white/80 bg-white/65 text-green-800 shadow-sm ${
              hero
                ? "size-28 sm:size-36"
                : "size-24"
            }`}
          >
            <Icon
              size={hero ? 72 : 54}
              strokeWidth={1.25}
              aria-hidden="true"
            />
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-[#102713]/15 to-transparent" />
    </div>
  );
}

/* ============================================================
   7. ACTION BUTTON

   Internal destinations use Next Link.

   Email/telephone use native links.
   ============================================================ */

function ActionLink({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;

  variant?:
    | "primary"
    | "secondary"
    | "outline";

  className?: string;
}) {
  const base =
    "inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl px-5 py-3 text-center text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2";

  const variants = {
    primary:
      "bg-linear-to-r from-green-800 to-lime-600 text-white shadow-sm hover:from-green-900 hover:to-lime-700",

    secondary:
      "border border-white/65 bg-white text-green-950 hover:bg-lime-50",

    outline:
      "border-2 border-green-700 bg-white text-green-800 hover:bg-lime-50",
  };

  const combinedClass =
    `${base} ${variants[variant]} ${className}`;

  if (
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return (
      <a
        href={href}
        className={combinedClass}
      >
        {children}
      </a>
    );
  }

  if (
    !href.startsWith("/") ||
    href.startsWith("//")
  ) {
    return null;
  }

  return (
    <Link
      href={href}
      className={combinedClass}
    >
      {children}
    </Link>
  );
}

/* ============================================================
   8. COUNTRY SELECTOR

   Public browsing selector only.

   Changing this does not update
   the candidate's registered country.
   ============================================================ */

function CountrySelector({
  country,
  locale,
  onChange,
  title,
  description,
  notice,
}: {
  country: ServiceCountry;
  locale: ServiceLocale;

  onChange: (
    country: ServiceCountry
  ) => void;

  title: string;
  description: string;
  notice: string;
}) {
  return (
    <section
      aria-labelledby="services-country-title"
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
    >
      <div className="mb-5 flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-green-800">
          <Globe2
            size={23}
            aria-hidden="true"
          />
        </span>

        <div className="min-w-0">
          <h2
            id="services-country-title"
            className="text-lg font-extrabold text-slate-950 sm:text-xl"
          >
            {title}
          </h2>

          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {description}
          </p>
        </div>
      </div>

      <div
        role="group"
        aria-label={title}
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5"
      >
        {SERVICES_COUNTRIES.map(
          (code) => {
            const selected =
              country === code;

            return (
              <button
                key={code}
                type="button"
                aria-pressed={selected}
                onClick={() =>
                  onChange(code)
                }
                className={`relative flex min-h-18 min-w-0 items-center gap-2.5 rounded-xl border-2 px-3 py-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 ${
                  selected
                    ? "border-lime-500 bg-lime-50"
                    : "border-slate-200 bg-white hover:border-lime-400 hover:bg-slate-50"
                }`}
              >
                <span
                  className="shrink-0 text-2xl"
                  aria-hidden="true"
                >
                  {
                    SERVICES_COUNTRY_FLAGS[
                      code
                    ]
                  }
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block wrap-break-word text-xs font-bold leading-snug text-slate-900 sm:text-sm">
                    {
                      SERVICES_COUNTRY_NAMES[
                        code
                      ][locale]
                    }
                  </span>

                  <span
                    dir="ltr"
                    className="mt-1 block text-[10px] font-medium text-slate-500"
                  >
                    {code}
                  </span>
                </span>

                {selected && (
                  <span className="absolute inset-e-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-lime-600 text-white">
                    <Check
                      size={11}
                      aria-hidden="true"
                    />
                  </span>
                )}
              </button>
            );
          }
        )}
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
        <Info
          size={17}
          className="mt-0.5 shrink-0 text-green-700"
          aria-hidden="true"
        />

        <p>{notice}</p>
      </div>
    </section>
  );
}

/* ============================================================
   9. SERVICE AVAILABILITY LABEL
   ============================================================ */

function AvailabilityLabel({
  availability,
  available,
  confirmationRequired,
  unavailable,
}: {
  availability: ServiceAvailability;
  available: string;
  confirmationRequired: string;
  unavailable: string;
}) {
  switch (availability) {
    case "available":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-200 bg-lime-50 px-2.5 py-1 text-[11px] font-semibold text-green-800">
          <CheckCircle2
            size={13}
            aria-hidden="true"
          />
          {available}
        </span>
      );

    case "confirmation_required":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
          <Info
            size={13}
            aria-hidden="true"
          />
          {confirmationRequired}
        </span>
      );

    case "unavailable":
      return (
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
          {unavailable}
        </span>
      );
  }
}

/* ============================================================
   10. SERVICE CARD
   ============================================================ */

function ServiceCard({
  service,
  locale,
  text,
}: {
  service: LocalizedService;
  locale: ServiceLocale;

  text: ReturnType<
    typeof getServicesPageConfig
  >["text"];
}) {
  const Icon =
    SERVICE_ICONS[service.icon];

  const Arrow =
    locale === "ar"
      ? ArrowLeft
      : ArrowRight;

  const primaryIsContact =
    service.primaryHref.startsWith(
      "mailto:"
    ) ||
    service.primaryHref.startsWith(
      "tel:"
    );

  const primaryLabel =
    primaryIsContact
      ? text.contactUs
      : service.primaryHref.includes(
          "/fuehrerscheinklassen"
        )
        ? text.discoverCategories
        : text.applyNow;

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-lime-300 hover:shadow-md">
      <ServicePhoto
        key={service.imagePath ?? service.id}
        src={service.imagePath}
        alt={service.title}
        icon={Icon}
      />

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="flex size-10 items-center justify-center rounded-xl bg-lime-100 text-green-800">
            <Icon
              size={21}
              aria-hidden="true"
            />
          </span>

          <AvailabilityLabel
            availability={
              service.availability
            }
            available={
              text.available
            }
            confirmationRequired={
              text.confirmationRequired
            }
            unavailable={
              text.unavailable
            }
          />
        </div>

        <h3 className="text-lg font-extrabold leading-snug text-slate-950">
          {service.title}
        </h3>

        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {service.description}
        </p>

        <ul className="my-5 space-y-2.5">
          {service.features.map(
            (feature, index) => (
              <li
                key={`${service.id}-${index}`}
                className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-700 sm:text-[13px]"
              >
                <CheckCircle2
                  size={16}
                  className="mt-0.5 shrink-0 text-lime-700"
                  aria-hidden="true"
                />

                <span>{feature}</span>
              </li>
            )
          )}
        </ul>

        <div className="mt-auto space-y-2.5 border-t border-slate-100 pt-4">
          <ActionLink
            href={
              service.availability ===
                "confirmation_required"
                ? (
                    service.secondaryHref?.startsWith(
                      "mailto:"
                    ) ||
                    service.secondaryHref?.startsWith(
                      "tel:"
                    )
                      ? service.secondaryHref
                      : service.primaryHref
                  )
                : service.primaryHref
            }
            variant="primary"
            className="w-full"
          >
            {service.availability ===
              "confirmation_required" &&
            (
              service.secondaryHref?.startsWith(
                "mailto:"
              ) ||
              service.secondaryHref?.startsWith(
                "tel:"
              )
            )
              ? text.contactUs
              : primaryLabel}

            <Arrow
              size={17}
              aria-hidden="true"
            />
          </ActionLink>

          {service.secondaryHref &&
            service.availability !==
              "confirmation_required" && (
              <ActionLink
                href={
                  service.secondaryHref
                }
                variant="outline"
                className="w-full"
              >
                {text.learnMore}
              </ActionLink>
            )}
        </div>
      </div>
    </article>
  );
}

/* ============================================================
   11. PARTNER CARD

   Only approved partners are provided
   by getServicesPageConfig().

   Logos require explicit logo approval.
   ============================================================ */

function PartnerCard({
  partner,
  locale,
}: {
  partner: PublicServicePartner;
  locale: ServiceLocale;
}) {
  const [imageFailed, setImageFailed] =
    useState(false);

  const imagePath =
    getSafeLocalImage(
      partner.logoPath
    );

  const showLogo =
    imagePath !== null &&
    !imageFailed;

  const content = (
    <>
      <div className="relative flex h-28 items-center justify-center rounded-xl bg-slate-50 p-4">
        {showLogo ? (
          <Image
            src={imagePath}
            alt={partner.name}
            fill
            sizes="(max-width: 640px) 100vw, 250px"
            className="object-contain p-5"
            onError={() =>
              setImageFailed(true)
            }
          />
        ) : (
          <div className="flex items-center gap-2 text-center">
            <ShieldCheck
              size={23}
              className="shrink-0 text-green-700"
              aria-hidden="true"
            />

            <span className="text-base font-extrabold text-slate-800">
              {partner.name}
            </span>
          </div>
        )}
      </div>

      <div className="mt-4">
        <h3 className="text-base font-bold text-slate-950">
          {partner.name}
        </h3>

        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          {partner.description}
        </p>
      </div>
    </>
  );

  let website: string | null =
    null;

  if (partner.officialWebsite) {
    try {
      const parsed =
        new URL(
          partner.officialWebsite
        );

      if (
        parsed.protocol === "https:"
      ) {
        website = parsed.href;
      }
    } catch {
      website = null;
    }
  }

  if (website) {
    return (
      <a
        href={website}
        target="_blank"
        rel="noopener noreferrer"
        lang={locale}
        className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-lime-400"
      >
        {content}
      </a>
    );
  }

  return (
    <article
      lang={locale}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      {content}
    </article>
  );
}

/* ============================================================
   12. CONTACT ITEM
   ============================================================ */

function ContactItem({
  label,
  value,
  href,
  icon: Icon,
  ltr = false,
}: {
  label: string;
  value: string;
  href?: string;
  icon: LucideIcon;
  ltr?: boolean;
}) {
  const details = (
    <span
      dir={ltr ? "ltr" : "auto"}
      className="block wrap-break-word text-sm font-semibold leading-relaxed text-slate-900 sm:text-base"
    >
      {value}
    </span>
  );

  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-green-800">
        <Icon
          size={22}
          aria-hidden="true"
        />
      </span>

      <div className="min-w-0 flex-1">
        <p className="mb-1.5 text-xs font-semibold text-slate-500">
          {label}
        </p>

        {href ? (
          <a
            href={href}
            className="hover:text-green-800"
          >
            {details}
          </a>
        ) : (
          details
        )}
      </div>
    </div>
  );
}

/* ============================================================
   13. MAIN COMPONENT
   ============================================================ */

export default function ServicesContent() {
  const [locale, setLocale] =
    useState<ServiceLocale>(
      DEFAULT_SERVICES_LOCALE
    );

  const [country, setCountry] =
    useState<ServiceCountry>(
      DEFAULT_SERVICES_COUNTRY
    );

  const [activeCategory, setActiveCategory] =
    useState<ServiceCategory | "all">(
      "all"
    );

  /* ========================================================
     14. INITIAL LANGUAGE AND COUNTRY
     ======================================================== */

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLocale(getCurrentLocale());
      setCountry(readInitialCountry());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  /* ========================================================
     15. SYNCHRONIZE EXISTING LANGUAGE SWITCHER
     ======================================================== */

  useEffect(() => {
    function synchronize(
      event?: Event
    ) {
      let eventLocale:
        ServiceLocale | null = null;

      if (
        event instanceof CustomEvent
      ) {
        const detail: unknown =
          event.detail;

        if (
          typeof detail === "string"
        ) {
          eventLocale =
            supportedLocale(detail);

        } else if (
          detail !== null &&
          typeof detail === "object" &&
          "locale" in detail
        ) {
          eventLocale =
            supportedLocale(
              detail.locale
            );
        }
      }

      setLocale(
        eventLocale ??
          getCurrentLocale()
      );
    }

    function htmlLanguageChanged() {
      const next =
        supportedLocale(
          document.documentElement.lang
        );

      if (next) {
        setLocale(next);
      }
    }

    const observer =
      new MutationObserver(
        htmlLanguageChanged
      );

    observer.observe(
      document.documentElement,
      {
        attributes: true,
        attributeFilter: ["lang"],
      }
    );

    window.addEventListener(
      LANGUAGE_EVENT,
      synchronize
    );

    window.addEventListener(
      "storage",
      synchronize
    );

    window.addEventListener(
      "focus",
      synchronize
    );

    return () => {
      observer.disconnect();

      window.removeEventListener(
        LANGUAGE_EVENT,
        synchronize
      );

      window.removeEventListener(
        "storage",
        synchronize
      );

      window.removeEventListener(
        "focus",
        synchronize
      );
    };
  }, []);

  /* ========================================================
     16. CENTRAL SERVICES CONFIGURATION
     ======================================================== */

  const config = useMemo(
    () =>
      getServicesPageConfig(
        locale,
        country
      ),
    [
      locale,
      country,
    ]
  );

  const {
    text,
    hero,
    services,
    partners,
    processSteps,
    contact,
    links,
  } = config;

  const rtl =
    getServicesDirection(locale) ===
    "rtl";

  const Arrow =
    rtl ? ArrowLeft : ArrowRight;

  /* ========================================================
     17. SERVICE CATEGORY FILTER
     ======================================================== */

  const visibleServices =
    useMemo(
      () =>
        activeCategory === "all"
          ? services
          : services.filter(
              (service) =>
                service.category ===
                activeCategory
            ),
      [
        activeCategory,
        services,
      ]
    );

  const categories = [
    {
      value: "all" as const,
      label: text.servicesTitle,
      icon: Globe2,
    },
    {
      value: "training" as const,
      label: text.training,
      icon: GraduationCap,
    },
    {
      value: "administration" as const,
      label: text.administrativeSupport,
      icon: ClipboardList,
    },
    {
      value: "professional" as const,
      label: text.professionalServices,
      icon: BriefcaseBusiness,
    },
    {
      value: "assistance" as const,
      label: text.candidateSupport,
      icon: Headphones,
    },
  ];

  /* ========================================================
     18. CHANGE COUNTRY
     ======================================================== */

  function handleCountryChange(
    next: ServiceCountry
  ) {
    if (!isServiceCountry(next)) {
      return;
    }

    setCountry(next);

    setActiveCategory("all");
  }

  /* ========================================================
     19. MAIN RESPONSIVE INTERFACE

     The existing public layout supplies
     the project's menus and footer.
     ======================================================== */

  return (
    <main
      lang={locale}
      dir={rtl ? "rtl" : "ltr"}
      className="min-w-0 overflow-hidden bg-[#f6f8f4] text-slate-950"
    >
      {/* ====================================================
         HERO — INTRODUCTION
         ==================================================== */}

      <section className="relative overflow-hidden bg-linear-to-br from-[#ecf6db] via-[#f6faee] to-white">
        <div className="pointer-events-none absolute -inset-e-24 -top-28 size-80 rounded-full bg-lime-300/30 blur-3xl" />

        <div className="relative mx-auto grid w-full max-w-none items-center gap-8 px-4 py-9 sm:px-6 sm:py-12 lg:grid-cols-2 lg:gap-12 lg:px-8 lg:py-10">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-white/85 px-3 py-2 text-xs font-extrabold tracking-wide text-green-900">
              <CarFront
                size={16}
                aria-hidden="true"
              />

              {text.heroEyebrow}
            </span>

            <h1 className="mt-6 text-3xl font-black leading-[1.15] tracking-tight text-[#14210f] sm:text-4xl lg:text-5xl xl:text-[56px]">
              {hero.title}
            </h1>

            <p className="mt-5 max-w-xl text-base leading-8 text-slate-700 sm:text-lg">
              {hero.description}
            </p>

            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
              {hero.secondaryDescription}
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ActionLink
                href={hero.primaryHref}
                variant="primary"
                className="w-full sm:w-auto"
              >
                <ClipboardList
                  size={19}
                  aria-hidden="true"
                />

                {hero.primaryLabel}

                <Arrow
                  size={18}
                  aria-hidden="true"
                />
              </ActionLink>

              <ActionLink
                href={hero.secondaryHref}
                variant="outline"
                className="w-full sm:w-auto"
              >
                <CarFront
                  size={19}
                  aria-hidden="true"
                />

                {hero.secondaryLabel}
              </ActionLink>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-green-900 sm:text-sm">
                <ShieldCheck
                  size={18}
                  aria-hidden="true"
                />

                {text.secureProcess}
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-green-900 sm:text-sm">
                <CheckCircle2
                  size={18}
                  aria-hidden="true"
                />

                {text.candidateSupport}
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="overflow-hidden rounded-[1.75rem] border-4 border-white bg-white shadow-xl">
              <ServicePhoto
                key={
                  hero.imagePath ??
                  "services-hero"
                }
                src={hero.imagePath}
                alt={hero.title}
                icon={CarFront}
                priority
                hero
              />
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================
         COUNTRY SELECTOR
         ==================================================== */}

      <section
        id="services-countries"
        className="scroll-mt-24"
      >
        <div className="mx-auto max-w-none px-4 pt-7 sm:px-6 sm:pt-9 lg:px-8">
          <CountrySelector
            country={country}
            locale={locale}
            onChange={
              handleCountryChange
            }
            title={
              text.countrySelector
            }
            description={
              text.selectCountryHint
            }
            notice={
              text.accountCountryNotice
            }
          />
        </div>
      </section>

      {/* ====================================================
         SERVICES OVERVIEW
         ==================================================== */}

      <section
        id="services-list"
        aria-labelledby="services-heading"
        className="scroll-mt-24"
      >
        <div className="mx-auto max-w-none px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-green-800">
                <span
                  aria-hidden="true"
                  className="h-1 w-8 rounded-full bg-lime-500"
                />

                {
                  SERVICES_COUNTRY_FLAGS[
                    country
                  ]
                }

                {
                  SERVICES_COUNTRY_NAMES[
                    country
                  ][locale]
                }
              </div>

              <h2
                id="services-heading"
                className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl lg:text-4xl"
              >
                {text.servicesTitle}
              </h2>

              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                {text.servicesSubtitle}
              </p>
            </div>

            <ActionLink
              href={links.categories}
              variant="outline"
              className="w-full sm:w-auto"
            >
              {text.categories}

              <Arrow
                size={18}
                aria-hidden="true"
              />
            </ActionLink>
          </div>

          {/* ================================================
             SERVICE FILTERS
             ================================================ */}

          <div
            role="group"
            aria-label={
              text.servicesTitle
            }
            className="mt-7 flex flex-wrap gap-2"
          >
            {categories.map((item) => {
              const selected =
                activeCategory ===
                item.value;

              const Icon =
                item.icon;

              return (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    setActiveCategory(
                      item.value
                    )
                  }
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 sm:text-sm ${
                    selected
                      ? "border-green-800 bg-green-800 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-lime-400 hover:text-green-800"
                  }`}
                >
                  <Icon
                    size={16}
                    aria-hidden="true"
                  />

                  {item.label}
                </button>
              );
            })}
          </div>

          {/* ================================================
             RESPONSIVE SERVICE CARDS
             ================================================ */}

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {visibleServices.map(
              (service) => (
                <ServiceCard
                  key={`${country}-${service.id}`}
                  service={service}
                  locale={locale}
                  text={text}
                />
              )
            )}
          </div>

          {/* ================================================
             AVAILABILITY NOTICE
             ================================================ */}

          <div className="mt-5 flex items-start gap-3 rounded-xl border border-lime-200 bg-white p-4">
            <Info
              size={19}
              className="mt-0.5 shrink-0 text-green-700"
              aria-hidden="true"
            />

            <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
              {text.availabilityNotice}
            </p>
          </div>
        </div>
      </section>

      {/* ====================================================
         PROFESSIONAL DRIVER SECTION
         ==================================================== */}

      <section className="bg-[#142418]">
        <div className="mx-auto grid max-w-none items-center gap-8 px-4 py-9 sm:px-6 sm:py-12 lg:grid-cols-2 lg:gap-12 lg:px-8 lg:py-10">
          <div className="min-w-0">
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <ServicePhoto
                key={
                  config.images.professional ??
                  "professional"
                }
                src={
                  config.images.professional
                }
                alt={
                  text.professionalTitle
                }
                icon={Truck}
              />
            </div>
          </div>

          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-lime-400/40 bg-lime-400/10 px-3 py-1.5 text-xs font-bold text-lime-300">
              <BriefcaseBusiness
                size={15}
                aria-hidden="true"
              />

              {
                text.professionalServices
              }
            </span>

            <h2 className="mt-5 text-2xl font-black leading-tight text-white sm:text-3xl lg:text-4xl">
              {
                text.professionalTitle
              }
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-200 sm:text-base">
              {
                services.find(
                  (service) =>
                    service.id ===
                    "professional_drivers"
                )?.description ??
                text.availabilityNotice
              }
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                {
                  icon: Truck,
                  label: "C / CE",
                },
                {
                  icon: BusFront,
                  label: "D / DE",
                },
              ].map((item) => {
                const Icon =
                  item.icon;

                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/5 p-4"
                  >
                    <Icon
                      size={26}
                      className="text-lime-300"
                      aria-hidden="true"
                    />

                    <span
                      dir="ltr"
                      className="font-bold text-white"
                    >
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ActionLink
                href={links.categories}
                variant="secondary"
                className="w-full sm:w-auto"
              >
                {text.discoverCategories}

                <Arrow
                  size={17}
                  aria-hidden="true"
                />
              </ActionLink>

              <ActionLink
                href={links.contactEmail}
                variant="primary"
                className="w-full sm:w-auto"
              >
                <Mail
                  size={17}
                  aria-hidden="true"
                />

                {text.contactUs}
              </ActionLink>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================
         PARTNER NETWORK
         ==================================================== */}

      <section
        id="services-partners"
        aria-labelledby="partners-heading"
        className="scroll-mt-24 bg-white"
      >
        <div className="mx-auto max-w-none px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-lime-100 text-green-800">
              <UsersRound
                size={28}
                aria-hidden="true"
              />
            </div>

            <h2
              id="partners-heading"
              className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl lg:text-4xl"
            >
              {text.partnersTitle}
            </h2>

            <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
              {text.partnersDescription}
            </p>
          </div>

          {partners.length > 0 ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {partners.map(
                (partner) => (
                  <PartnerCard
                    key={partner.id}
                    partner={partner}
                    locale={locale}
                  />
                )
              )}
            </div>
          ) : (
            <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center sm:p-8">
              <ShieldCheck
                size={32}
                className="mx-auto text-green-700"
                aria-hidden="true"
              />

              <p className="mt-4 text-sm leading-relaxed text-slate-600">
                {text.partnersEmpty}
              </p>
            </div>
          )}

          <div className="mt-6 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <Info
              size={18}
              className="mt-0.5 shrink-0 text-green-700"
              aria-hidden="true"
            />

            <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
              {text.partnerNotice}
            </p>
          </div>
        </div>
      </section>

      {/* ====================================================
         APPLICATION PROCESS
         ==================================================== */}

      <section
        id="services-process"
        aria-labelledby="process-heading"
        className="scroll-mt-24 bg-[#eef4e8]"
      >
        <div className="mx-auto max-w-none px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-white px-3 py-1.5 text-xs font-bold text-green-800">
              <ClipboardList
                size={15}
                aria-hidden="true"
              />

              {
                text.secureProcess
              }
            </span>

            <h2
              id="process-heading"
              className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl lg:text-4xl"
            >
              {text.processTitle}
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              {text.processSubtitle}
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {processSteps.map(
              (step) => (
                <div
                  key={step.number}
                  className="flex h-full flex-col rounded-2xl border border-lime-100 bg-white p-5 shadow-sm"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <span className="flex size-12 items-center justify-center rounded-xl bg-linear-to-br from-lime-500 to-green-800 text-xl font-black text-white">
                      {step.number}
                    </span>

                    <CheckCircle2
                      size={20}
                      className="text-lime-600"
                      aria-hidden="true"
                    />
                  </div>

                  <h3 className="text-base font-extrabold text-slate-950">
                    {step.title}
                  </h3>

                  <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">
                    {step.description}
                  </p>

                  <ActionLink
                    href={step.href}
                    variant="outline"
                    className="mt-5 w-full"
                  >
                    {text.learnMore}

                    <Arrow
                      size={16}
                      aria-hidden="true"
                    />
                  </ActionLink>
                </div>
              )
            )}
          </div>

          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <ActionLink
              href={links.register}
              variant="primary"
              className="w-full sm:w-auto"
            >
              {text.register}

              <Arrow
                size={17}
                aria-hidden="true"
              />
            </ActionLink>

            <ActionLink
              href={links.application}
              variant="outline"
              className="w-full sm:w-auto"
            >
              {
                text.fromAccount
              }
            </ActionLink>
          </div>
        </div>
      </section>

      {/* ====================================================
         CONTACT
         ==================================================== */}

      <section
        id="services-contact"
        aria-labelledby="services-contact-title"
        className="scroll-mt-24 bg-white"
      >
        <div className="mx-auto grid max-w-none gap-8 px-4 py-10 sm:px-6 sm:py-12 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-8 lg:py-10">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-lime-50 px-3 py-1.5 text-xs font-bold text-green-800">
              <Headphones
                size={16}
                aria-hidden="true"
              />

              {text.contactUs}
            </span>

            <h2
              id="services-contact-title"
              className="mt-5 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl lg:text-4xl"
            >
              {text.contactTitle}
            </h2>

            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
              {text.contactDescription}
            </p>

            <div className="mt-7 grid gap-3">
              <ContactItem
                label={contact.addressLabel}
                value={contact.address}
                icon={MapPin}
              />

              <ContactItem
                label={contact.phoneLabel}
                value={contact.phone}
                href={contact.phoneHref}
                icon={Phone}
                ltr
              />

              <ContactItem
                label={`${contact.phoneLabel} (AT)`}
                value={contact.austriaPhone}
                href={contact.austriaPhoneHref}
                icon={Phone}
                ltr
              />

              <ContactItem
                label={contact.emailLabel}
                value={contact.email}
                href={contact.emailHref}
                icon={Mail}
                ltr
              />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <ActionLink
                href={contact.emailHref}
                variant="primary"
                className="w-full sm:w-auto"
              >
                <Mail
                  size={18}
                  aria-hidden="true"
                />

                {text.sendEmail}
              </ActionLink>

              <ActionLink
                href={contact.phoneHref}
                variant="outline"
                className="w-full sm:w-auto"
              >
                <Phone
                  size={18}
                  aria-hidden="true"
                />

                {text.callNow}
              </ActionLink>
            </div>
          </div>

          <div className="min-w-0">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
              <ServicePhoto
                key={
                  config.images.support ??
                  "support"
                }
                src={
                  config.images.support
                }
                alt={
                  text.contactTitle
                }
                icon={Headphones}
              />

              <div className="space-y-4 p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <ShieldCheck
                    size={22}
                    className="mt-0.5 shrink-0 text-green-700"
                    aria-hidden="true"
                  />

                  <p className="text-sm leading-relaxed text-slate-700">
                    {
                      text.secureProcess
                    }
                  </p>
                </div>

                <ActionLink
                  href={links.application}
                  variant="primary"
                  className="w-full"
                >
                  <ClipboardList
                    size={18}
                    aria-hidden="true"
                  />

                  {text.applyNow}

                  <Arrow
                    size={18}
                    aria-hidden="true"
                  />
                </ActionLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================
         LEGAL AND PRICING NOTICES
         ==================================================== */}

      <section className="bg-[#f4f7f0]">
        <div className="mx-auto max-w-none px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 lg:grid-cols-2">
            <div className="flex items-start gap-3">
              <Info
                size={20}
                className="mt-0.5 shrink-0 text-green-700"
                aria-hidden="true"
              />

              <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
                {text.pricingNotice}
              </p>
            </div>

            <div className="flex items-start gap-3">
              <ShieldCheck
                size={20}
                className="mt-0.5 shrink-0 text-green-700"
                aria-hidden="true"
              />

              <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
                {text.noGuarantee}
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
