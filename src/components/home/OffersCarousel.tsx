
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

import {
  ArrowLeft,
  ArrowRight,
} from "lucide-react";

import {
  defaultLocale,
  isLocale,
  type Locale,
} from "@/i18n/config";

/* =========================================================
   FAHRSCHULE TAYM
   OFFERS CAROUSEL

   6 services
   4 cartes PC
   2 cartes tablette
   2 cartes mobile

   Défilement automatique
   Navigation manuelle
   Défilement tactile
   Traductions DE / AR / TR / ES

   Aucun fichier CSS supplémentaire
   ========================================================= */

type OfferKey =
  | "theory"
  | "classes"
  | "automatic"
  | "bf17"
  | "adac"
  | "app";

type Offer = {
  key: OfferKey;
  href: string;
  image: string;
};

type Translation = {
  heading: string;
  readMore: string;
  previous: string;
  next: string;
  carousel: string;
  offers: Record<OfferKey, string>;
};

/* =========================================================
   TRADUCTIONS
   ========================================================= */

const translations: Record<Locale, Translation> = {
  de: {
    heading: "Wir Bieten Für Euch",
    readMore: "MEHR LESEN",
    previous: "Vorherige Angebote",
    next: "Nächste Angebote",
    carousel: "Unsere Angebote",
    offers: {
      theory:
        "Theorieunterricht auf Deutsch und Arabisch",
      classes: "Klasse B / BE / B96",
      automatic: "Automatik B197",
      bf17: "Führerschein BF17",
      adac: "1 Jahr ADAC Mitgliedschaft kostenlos",
      app: "Theorie Lern-App",
    },
  },

  ar: {
    heading: "ما نقدمه لكم",
    readMore: "اقرأ المزيد",
    previous: "العروض السابقة",
    next: "العروض التالية",
    carousel: "خدماتنا",
    offers: {
      theory:
        "دروس نظرية باللغة الألمانية والعربية",
      classes: "فئات رخص القيادة B / BE / B96",
      automatic: "رخصة القيادة الأوتوماتيكية B197",
      bf17: "رخصة القيادة BF17",
      adac: "عضوية ADAC مجانية لمدة سنة",
      app: "تطبيق تعلم القيادة النظري",
    },
  },

  tr: {
    heading: "Sizlere Sunduğumuz Hizmetler",
    readMore: "DAHA FAZLA",
    previous: "Önceki hizmetler",
    next: "Sonraki hizmetler",
    carousel: "Hizmetlerimiz",
    offers: {
      theory:
        "Almanca ve Arapça Teori Dersleri",
      classes: "B / BE / B96 Ehliyet Sınıfları",
      automatic: "Otomatik Vites B197",
      bf17: "BF17 Ehliyet",
      adac: "1 Yıl Ücretsiz ADAC Üyeliği",
      app: "Teori Öğrenme Uygulaması",
    },
  },

  es: {
    heading: "Lo Que Ofrecemos",
    readMore: "LEER MÁS",
    previous: "Ofertas anteriores",
    next: "Ofertas siguientes",
    carousel: "Nuestros servicios",
    offers: {
      theory:
        "Clases Teóricas en Alemán y Árabe",
      classes: "Permisos B / BE / B96",
      automatic: "Permiso Automático B197",
      bf17: "Permiso de Conducir BF17",
      adac: "1 Año de Membresía ADAC Gratis",
      app: "Aplicación de Teoría",
    },
  },
};

/* =========================================================
   LES SIX OFFRES DE LA MAQUETTE
   ========================================================= */

const offers: Offer[] = [
  {
    key: "theory",
    href: "/dashboard/application",
    image: "/images/imageb.jpg",
  },
  {
    key: "classes",
    href: "/fuehrerscheinklassen",
    image: "/images/classe-b.jpg",
  },
  {
    key: "automatic",
    href: "/fuehrerscheinklassen",
    image: "/images/imagea.jpg",
  },
  {
    key: "bf17",
    href: "/fuehrerscheinklassen",
    image: "/images/classe-b.jpg",
  },
  {
    key: "adac",
    href: "/services",
    image: "/images/imagea.jpg",
  },
  {
    key: "app",
    href: "/dashboard/application",
    image: "/images/imageb.jpg",
  },
];

/* =========================================================
   CONFIGURATION
   ========================================================= */

const AUTO_PLAY_DELAY = 4500;

/* =========================================================
   LANGUES
   ========================================================= */

function getPathLocale(pathname: string): Locale | null {
  const first = pathname.split("/")[1];

  if (first && isLocale(first)) {
    return first;
  }

  return null;
}

function readLocale(pathname: string): Locale {
  const fromPath = getPathLocale(pathname);

  if (fromPath) {
    return fromPath;
  }

  if (typeof document === "undefined") {
    return defaultLocale;
  }

  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith("taym-locale="));

  if (cookie) {
    const value = cookie.slice("taym-locale=".length);

    if (isLocale(value)) {
      return value;
    }
  }

  const documentLocale = document.documentElement.lang
    .toLowerCase()
    .split("-")[0];

  if (isLocale(documentLocale)) {
    return documentLocale;
  }

  return defaultLocale;
}

/* =========================================================
   CARROUSEL PRINCIPAL
   ========================================================= */

export default function OffersCarousel() {
  const pathname = usePathname() || "/";

  const trackRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<
    typeof setInterval
  > | null>(null);

  const [locale, setLocale] =
    useState<Locale>(defaultLocale);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [visibleCount, setVisibleCount] = useState(4);
  const [reducedMotion, setReducedMotion] =
    useState(false);

  const pathLocale = getPathLocale(pathname);
  const activeLocale = pathLocale ?? locale;
  const t = translations[activeLocale];

  const isRTL = activeLocale === "ar";

  const maxIndex = Math.max(
    0,
    offers.length - visibleCount
  );

  /* =======================================================
     INITIALISATION DE LA LANGUE
     ======================================================= */

  useEffect(() => {
    const timer = window.setTimeout(() => setLocale(readLocale(pathname)), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  /* Synchronisation avec LanguageSwitcher */

  useEffect(() => {
    const handleLanguage = (event: Event) => {
      const customEvent = event as CustomEvent<Locale>;

      if (isLocale(customEvent.detail)) {
        setLocale(customEvent.detail);
      }
    };

    window.addEventListener(
      "taym:language-change",
      handleLanguage
    );

    return () => {
      window.removeEventListener(
        "taym:language-change",
        handleLanguage
      );
    };
  }, []);

  /* =======================================================
     RESPONSIVE
     ======================================================= */

  useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth;

      if (width < 1024) {
        setVisibleCount(2);
      } else {
        setVisibleCount(4);
      }
    };

    updateViewport();

    window.addEventListener("resize", updateViewport);

    return () => {
      window.removeEventListener(
        "resize",
        updateViewport
      );
    };
  }, []);

  /* =======================================================
     ACCESSIBILITÉ : RÉDUCTION DES ANIMATIONS
     ======================================================= */

  useEffect(() => {
    const media = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    const updateMotion = () => {
      setReducedMotion(media.matches);
    };

    updateMotion();

    media.addEventListener("change", updateMotion);

    return () => {
      media.removeEventListener(
        "change",
        updateMotion
      );
    };
  }, []);

  /* =======================================================
     CALCUL DE LA DISTANCE ENTRE DEUX CARTES
     ======================================================= */

  const getStep = useCallback((): number => {
    const track = trackRef.current;

    if (!track) return 0;

    const first = track.children[0] as
      | HTMLElement
      | undefined;

    const second = track.children[1] as
      | HTMLElement
      | undefined;

    if (!first) return 0;

    if (!second) return first.offsetWidth;

    return second.offsetLeft - first.offsetLeft;
  }, []);

  /* =======================================================
     DÉFILEMENT VERS UNE CARTE
     ======================================================= */

  const goTo = useCallback(
    (requestedIndex: number) => {
      const track = trackRef.current;

      if (!track) return;

      const step = getStep();

      if (step <= 0) return;

      const availableCount =
        window.innerWidth < 1024 ? 2 : 4;

      const lastIndex = Math.max(
        0,
        offers.length - availableCount
      );

      const nextIndex = Math.max(
        0,
        Math.min(requestedIndex, lastIndex)
      );

      track.scrollTo({
        left: nextIndex * step,
        behavior: reducedMotion ? "instant" : "smooth",
      });

      setActiveIndex(nextIndex);
    },
    [getStep, reducedMotion]
  );

  /* =======================================================
     PRÉCÉDENT / SUIVANT
     ======================================================= */

  const previous = useCallback(() => {
    const next =
      activeIndex <= 0 ? maxIndex : activeIndex - 1;

    goTo(next);
  }, [activeIndex, maxIndex, goTo]);

  const next = useCallback(() => {
    const following =
      activeIndex >= maxIndex ? 0 : activeIndex + 1;

    goTo(following);
  }, [activeIndex, maxIndex, goTo]);

  /* =======================================================
     ARRÊT / REPRISE AUTOMATIQUE
     ======================================================= */

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (isPaused || reducedMotion || maxIndex === 0) {
      return;
    }

    timerRef.current = setInterval(() => {
      const track = trackRef.current;

      if (!track) return;

      const step = getStep();

      if (step <= 0) return;

      const current = Math.round(
        track.scrollLeft / step
      );

      const following =
        current >= maxIndex ? 0 : current + 1;

      goTo(following);
    }, AUTO_PLAY_DELAY);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    isPaused,
    reducedMotion,
    maxIndex,
    getStep,
    goTo,
  ]);

  /* =======================================================
     DÉFILEMENT TACTILE / MANUEL
     ======================================================= */

  const handleScroll = useCallback(() => {
    const track = trackRef.current;

    if (!track) return;

    const step = getStep();

    if (step <= 0) return;

    const index = Math.round(track.scrollLeft / step);

    setActiveIndex(
      Math.max(0, Math.min(index, maxIndex))
    );
  }, [getStep, maxIndex]);

  /* =======================================================
     CORRECTION AU REDIMENSIONNEMENT
     ======================================================= */

  useEffect(() => {
    const track = trackRef.current;

    if (!track) return;

    const step = getStep();
    const index = step > 0 ? Math.min(Math.round(track.scrollLeft / step), maxIndex) : 0;

    track.scrollTo({
      left: index * step,
      behavior: "instant",
    });
  }, [visibleCount, maxIndex, getStep]);

  /* =======================================================
     URL LOCALISÉE
     ======================================================= */

  function localizedHref(path: string): string {
    if (!pathLocale) {
      return path;
    }

    return `/${pathLocale}${path}`;
  }

  /* =======================================================
     RENDU
     ======================================================= */

  return (
    <section
      id="taym-offers"
      lang={activeLocale}
      dir={isRTL ? "rtl" : "ltr"}
      aria-labelledby="taym-offers-heading"
      className="w-full overflow-hidden bg-[#f7f8f6] py-3 sm:py-4"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (
          !event.currentTarget.contains(
            event.relatedTarget as Node | null
          )
        ) {
          setIsPaused(false);
        }
      }}
    >
      <div className="taym-container">
        {/* =============================================
            EN-TÊTE DE LA SECTION
            ============================================= */}

        <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
          <div>
            <h2
              id="taym-offers-heading"
              className="text-xl leading-tight font-black tracking-[-0.035em] text-[#111820] sm:text-2xl"
            >
              {t.heading}
            </h2>

            <span
              aria-hidden="true"
              className="mt-2 block h-1 w-15 rounded-full bg-[#89c900]"
            />
          </div>

          {/* FLÈCHES DU CARROUSEL */}

          <div
            className="flex shrink-0 items-center gap-2"
            dir="ltr"
          >
            <button
              type="button"
              onClick={previous}
              aria-label={t.previous}
              title={t.previous}
              className="flex h-9.75 w-9.75 items-center justify-center rounded-[9px] border border-[#dce3d6] bg-white text-[#111820] shadow-sm transition hover:border-[#89c900] hover:bg-[#eef7e2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#89c900] sm:h-11.25 sm:w-11.25"
            >
              <ArrowLeft
                size={20}
                strokeWidth={1.9}
                aria-hidden="true"
              />
            </button>

            <button
              type="button"
              onClick={next}
              aria-label={t.next}
              title={t.next}
              className="flex h-9.75 w-9.75 items-center justify-center rounded-[9px] border border-[#dce3d6] bg-white text-[#111820] shadow-sm transition hover:border-[#89c900] hover:bg-[#eef7e2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#89c900] sm:h-11.25 sm:w-11.25"
            >
              <ArrowRight
                size={20}
                strokeWidth={1.9}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        {/* =============================================
            CARROUSEL HORIZONTAL
            ============================================= */}

        <div
          ref={trackRef}
          onScroll={handleScroll}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
          onPointerDown={(event) => {
            if (event.pointerType === "mouse") {
              setIsPaused(true);
            }
          }}
          onPointerUp={(event) => {
            if (event.pointerType === "mouse") {
              setIsPaused(false);
            }
          }}
          role="region"
          aria-roledescription="carousel"
          aria-label={t.carousel}
          dir="ltr"
          tabIndex={0}
          className="flex w-full snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden"
        >
          {offers.map((offer) => {
            const title = t.offers[offer.key];

            return (
              <article
                key={offer.key}
                lang={activeLocale}
                dir={isRTL ? "rtl" : "ltr"}
                className="group flex min-h-44 shrink-0 basis-[calc((100%-16px)/2)] snap-start flex-col items-center rounded-[13px] border border-[#e0e5dc] bg-white px-3 py-4 text-center shadow-[0_2px_8px_rgba(0,0,0,0.035)] transition-[border-color,box-shadow] duration-200 hover:border-[#b1d786] hover:shadow-[0_5px_18px_rgba(0,0,0,0.08)] lg:basis-[calc((100%-48px)/4)]"
              >
                <div className="relative mb-3 h-24 w-full overflow-hidden rounded-lg bg-slate-50 sm:h-32">
                  <Image src={offer.image} alt="" fill sizes="(max-width: 1024px) 50vw, 25vw" className="object-contain" />
                </div>

                {/* TITRE */}

                <h3 className="flex min-h-10 w-full items-center justify-center text-sm leading-snug font-extrabold text-[#111820] sm:text-base">
                  {title}
                </h3>

                {/* BOUTON MEHR LESEN */}

                <Link
                  href={localizedHref(offer.href)}
                  className="mt-3 inline-flex min-h-8.5 items-center justify-center gap-1 border-b-2 border-[#111820] text-[12px] font-extrabold text-[#111820] transition hover:border-[#4e9006] hover:text-[#4e9006] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#89c900] sm:text-[13px]"
                  aria-label={`${t.readMore}: ${title}`}
                >
                  <span>{t.readMore}</span>

                  <ArrowRight
                    size={16}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </Link>
              </article>
            );
          })}
        </div>

        {/* =============================================
            INDICATEURS MOBILES
            ============================================= */}

        <div
          className="mt-2 flex items-center justify-center gap-2 lg:hidden"
          aria-label={t.carousel}
          dir="ltr"
        >
          {Array.from(
            { length: maxIndex + 1 },
            (_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => goTo(index)}
                aria-label={`${t.carousel} ${index + 1}`}
                aria-current={
                  activeIndex === index ? "true" : undefined
                }
                className={`h-1.75 rounded-full transition-all duration-200 ${
                  activeIndex === index
                    ? "w-5.75 bg-[#72b112]"
                    : "w-1.75 bg-[#d3dbca]"
                }`}
              />
            )
          )}
        </div>
      </div>
    </section>
  );
}
