
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, Globe2 } from "lucide-react";

import {
  defaultLocale,
  isLocale,
  locales,
  type Locale,
} from "@/i18n/config";

/* =========================================================
   FAHRSCHULE TAYM
   LANGUAGE SWITCHER
   Allemand - Arabe - Turc - Espagnol
   ========================================================= */

const COOKIE_NAME = "taym-locale";
const STORAGE_KEY = "taym-locale";
const LANGUAGE_EVENT = "taym:language-change";

type LanguageInfo = {
  name: string;
  short: string;
  flag: string;
  direction: "ltr" | "rtl";
};

const languages: Record<Locale, LanguageInfo> = {
  de: {
    name: "Deutsch",
    short: "DE",
    flag: "🇩🇪",
    direction: "ltr",
  },
  ar: {
    name: "العربية",
    short: "AR",
    flag: "🌐",
    direction: "rtl",
  },
  tr: {
    name: "Türkçe",
    short: "TR",
    flag: "🇹🇷",
    direction: "ltr",
  },
  es: {
    name: "Español",
    short: "ES",
    flag: "🇪🇸",
    direction: "ltr",
  },
};

/* Libellés accessibles */

const accessibilityLabels: Record<Locale, string> = {
  de: "Sprache auswählen",
  ar: "اختر اللغة",
  tr: "Dil seçin",
  es: "Seleccionar idioma",
};

/* =========================================================
   FONCTIONS UTILITAIRES
   ========================================================= */

function getLocaleFromPath(pathname: string): Locale | null {
  const segment = pathname.split("/")[1];

  if (segment && isLocale(segment)) {
    return segment;
  }

  return null;
}

function getStoredLocale(): Locale | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (stored && isLocale(stored)) {
      return stored;
    }
  } catch {
    // Le stockage peut être indisponible.
  }

  return null;
}

function getCookieLocale(): Locale | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${COOKIE_NAME}=`));

  if (!cookie) return null;

  const value = cookie.slice(COOKIE_NAME.length + 1);

  return isLocale(value) ? value : null;
}

function getDocumentLocale(): Locale | null {
  if (typeof document === "undefined") {
    return null;
  }

  const lang = document.documentElement.lang
    .toLowerCase()
    .split("-")[0];

  return lang && isLocale(lang) ? lang : null;
}

function saveLocale(locale: Locale): void {
  if (typeof window === "undefined") {
    return;
  }

  const secure =
    window.location.protocol === "https:" ? "; Secure" : "";

  document.cookie =
    `${COOKIE_NAME}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;

  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // La langue reste disponible dans le cookie.
  }
}

function updateDocumentLocale(locale: Locale): void {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.lang = locale;
  document.documentElement.dir =
    languages[locale].direction;
}

/* =========================================================
   COMPOSANT
   ========================================================= */

export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname() || "/";

  const dropdownRef = useRef<HTMLDivElement>(null);
  const menuId = "taym-language-dropdown";

  const [locale, setLocale] =
    useState<Locale>(defaultLocale);

  const [isOpen, setIsOpen] = useState(false);

  const pathLocale = getLocaleFromPath(pathname);
  const activeLocale = pathLocale ?? locale;

  const currentLanguage = languages[activeLocale];

  /* Initialisation de la préférence */

  useEffect(() => {
    const detected =
      getLocaleFromPath(pathname) ??
      getCookieLocale() ??
      getStoredLocale() ??
      getDocumentLocale() ??
      defaultLocale;

    updateDocumentLocale(detected);
    const timer = window.setTimeout(() => setLocale(detected), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  /* Synchronisation avec les autres sélecteurs */

  useEffect(() => {
    const handleLanguageChange = (event: Event) => {
      const customEvent = event as CustomEvent<Locale>;
      const nextLocale = customEvent.detail;

      if (isLocale(nextLocale)) {
        setLocale(nextLocale);
      }
    };

    window.addEventListener(
      LANGUAGE_EVENT,
      handleLanguageChange
    );

    return () => {
      window.removeEventListener(
        LANGUAGE_EVENT,
        handleLanguageChange
      );
    };
  }, []);

  /* Fermeture au clic extérieur et avec Échap */

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: PointerEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);

        const trigger = dropdownRef.current?.querySelector(
          ".taym-language-trigger"
        );

        if (trigger instanceof HTMLElement) {
          trigger.focus();
        }
      }
    };

    document.addEventListener(
      "pointerdown",
      handleOutsideClick
    );

    document.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handleOutsideClick
      );

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [isOpen]);

  /* Changement effectif de la langue */

  const changeLanguage = useCallback(
    (nextLocale: Locale) => {
      if (nextLocale === activeLocale) {
        setIsOpen(false);
        return;
      }

      setLocale(nextLocale);
      setIsOpen(false);

      saveLocale(nextLocale);
      updateDocumentLocale(nextLocale);

      window.dispatchEvent(
        new CustomEvent<Locale>(LANGUAGE_EVENT, {
          detail: nextLocale,
        })
      );

      /*
       * Si les routes localisées existent déjà,
       * conserver la page actuelle en changeant
       * seulement son préfixe linguistique.
       */

      const currentPathLocale = getLocaleFromPath(pathname);

      if (currentPathLocale) {
        const remainingPath =
          pathname.replace(
            new RegExp(`^/${currentPathLocale}(?=/|$)`),
            ""
          ) || "";

        const nextPath =
          `/${nextLocale}${remainingPath}`;

        const query = window.location.search;
        const hash = window.location.hash;

        router.replace(
          `${nextPath}${query}${hash}`,
          { scroll: false }
        );

        return;
      }

      /*
       * Architecture actuelle sans préfixe :
       * rafraîchir les composants serveur.
       *
       * Les dictionnaires seront connectés
       * au layout lors de son développement.
       */

      router.refresh();
    },
    [activeLocale, pathname, router]
  );

  return (
    <div
      className="taym-language-switcher"
      aria-label={accessibilityLabels[activeLocale]}
    >
      {/* ==========================================
          VERSION PC : 4 LANGUES VISIBLES
          ========================================== */}

      <div
        className="taym-language-desktop"
        role="group"
        aria-label={accessibilityLabels[activeLocale]}
        dir="ltr"
      >
        {locales.map((languageCode) => {
          const item = languages[languageCode];
          const selected = activeLocale === languageCode;

          return (
            <button
              key={languageCode}
              type="button"
              className={`taym-language-pill${
                selected ? " is-active" : ""
              }`}
              onClick={() => changeLanguage(languageCode)}
              aria-pressed={selected}
              lang={languageCode}
              dir={item.direction}
              title={item.name}
            >
              <span
                className="taym-language-flag"
                aria-hidden="true"
              >
                {item.flag}
              </span>

              <span className="taym-language-name">
                {item.name}
              </span>

              {selected && (
                <Check
                  size={12}
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ==========================================
          VERSION MOBILE : MENU COMPACT
          ========================================== */}

      <div
        className="taym-language-mobile"
        ref={dropdownRef}
      >
        <button
          type="button"
          className={`taym-language-trigger${
            isOpen ? " is-open" : ""
          }`}
          onClick={() => setIsOpen((previous) => !previous)}
          aria-expanded={isOpen}
          aria-controls={menuId}
          aria-label={accessibilityLabels[activeLocale]}
          aria-haspopup="true"
          title={currentLanguage.name}
          dir="ltr"
        >
          <span
            className="taym-language-trigger-flag"
            aria-hidden="true"
          >
            {currentLanguage.flag}
          </span>

          <span className="taym-language-code">
            {currentLanguage.short}
          </span>

          <ChevronDown
            size={13}
            strokeWidth={2}
            className={`taym-language-chevron${
              isOpen ? " is-open" : ""
            }`}
            aria-hidden="true"
          />
        </button>

        {isOpen && (
          <div
            id={menuId}
            className="taym-language-dropdown"
            role="group"
            aria-label={accessibilityLabels[activeLocale]}
            dir="ltr"
          >
            <div className="taym-language-dropdown-heading">
              <Globe2 size={15} aria-hidden="true" />
              <span>
                {accessibilityLabels[activeLocale]}
              </span>
            </div>

            {locales.map((languageCode) => {
              const item = languages[languageCode];
              const selected =
                activeLocale === languageCode;

              return (
                <button
                  key={languageCode}
                  type="button"
                  className={`taym-language-option${
                    selected ? " is-active" : ""
                  }`}
                  onClick={() =>
                    changeLanguage(languageCode)
                  }
                  aria-pressed={selected}
                  lang={languageCode}
                  dir={item.direction}
                >
                  <span
                    className="taym-language-option-flag"
                    aria-hidden="true"
                  >
                    {item.flag}
                  </span>

                  <span className="taym-language-option-name">
                    {item.name}
                  </span>

                  {selected && (
                    <Check
                      size={16}
                      strokeWidth={2.5}
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
