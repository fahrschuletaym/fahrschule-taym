
export const locales = ["de", "ar", "tr", "es"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "de";

export const localeConfig = {
  de: {
    name: "Deutsch",
    direction: "ltr",
    flag: "🇩🇪",
  },
  ar: {
    name: "العربية",
    direction: "rtl",
    flag: "🌐",
  },
  tr: {
    name: "Türkçe",
    direction: "ltr",
    flag: "🇹🇷",
  },
  es: {
    name: "Español",
    direction: "ltr",
    flag: "🇪🇸",
  },
} as const;

export function isLocale(value: string): value is Locale {
  return locales.some((locale) => locale === value);
}

export function getLocaleDirection(locale: Locale) {
  return localeConfig[locale].direction;
}
