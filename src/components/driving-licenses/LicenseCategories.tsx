
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Image from "next/image";
import Link from "next/link";

import {
  ArrowLeft,
  ArrowRight,
  Bike,
  BusFront,
  CarFront,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Euro,
  FileCheck2,
  Globe2,
  Info,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import {
  DRIVING_LICENSE_COUNTRIES,
  LICENSE_COUNTRY_FLAGS,
  LICENSE_COUNTRY_NAMES,
  getCountryLicenseConfiguration,
  getLicenseAdmissionNotice,
  normalizeLicenseCountry,
  type CountryLicenseConfiguration,
  type PublicLicenseCategoryConfiguration,
} from "@/config/driving-licenses";

import type {
  ApplicationCountry,
  ApplicationLocale,
  LicenseCategory,
} from "@/lib/applications/validation";

/* ============================================================
   FAHRSCHULE TAYM

   File:
   src/components/driving-licenses/LicenseCategories.tsx

   Public driving license category catalog.

   Countries:
   DE, AT, BE, IT, ES

   Languages:
   de, ar, tr, es

   Features:
   - Country selection
   - Dynamic country-specific categories
   - Four-language display
   - Arabic RTL support
   - Existing local vehicle images
   - Responsive desktop/mobile cards
   - Training prices
   - Registration fees
   - Total prices
   - Pricing approval information
   - Category-based application links

   No new layout, header, footer or menu.
   No database connection.
   No duplicated price catalog.
   ============================================================ */

/* ============================================================
   1. ROUTES AND LANGUAGE CONFIGURATION
   ============================================================ */

const APPLICATION_PATH = "/dashboard/application";

const LANGUAGE_COOKIE = "taym-locale";
const LANGUAGE_STORAGE = "taym-locale";
const LANGUAGE_EVENT = "taym:language-change";

const SUPPORTED_LOCALES = [
  "de",
  "ar",
  "tr",
  "es",
] as const;

const FORMAT_LOCALES: Record<
  ApplicationLocale,
  string
> = {
  de: "de-DE",
  ar: "ar",
  tr: "tr-TR",
  es: "es-ES",
};

/* ============================================================
   2. TRANSLATIONS
   ============================================================ */

const TRANSLATIONS = {
  de: {
    eyebrow: "FAHRSCHULE TAYM",

    title: "Führerscheinklassen",

    subtitle:
      "Entdecken Sie unsere Führerscheinklassen, vergleichen Sie die Ausbildungspreise und starten Sie Ihren Antrag online.",

    chooseCountry: "Land auswählen",

    chooseCountryDescription:
      "Wählen Sie das Land aus, für das Sie sich interessieren.",

    countryNotice:
      "Bei der Antragstellung gilt das im persönlichen Konto registrierte Land.",

    availableCategories: "Führerscheinklassen",

    categoriesCount: "Klassen",

    allCategories: "Alle Klassen",

    passenger: "Pkw & Anhänger",

    motorcycle: "Motorräder",

    truck: "Lkw",

    bus: "Busse",

    trainingPrice: "Ausbildungspreis",

    registrationFee:
      "Anmelde- und Bearbeitungsgebühr",

    total: "Gesamtbetrag",

    estimated: "Vorläufiger Preis",

    pricePending: "Preis noch nicht bestätigt",

    priceUnavailable:
      "Der endgültige Preis wird vor der verbindlichen Antragstellung bestätigt.",

    apply: "Jetzt beantragen",

    viewDetails: "Details anzeigen",

    closeDetails: "Details schließen",

    minimumAge: "Reguläres Mindestalter",

    years: "Jahre",

    ageWarning:
      "Mindestalter und mögliche Ausnahmen werden individuell geprüft.",

    feeExplanation:
      "Die Anmelde- und Bearbeitungsgebühr wird separat zum Ausbildungspreis ausgewiesen.",

    additionalCosts:
      "Nicht ausdrücklich enthaltene Fahrstunden, Prüfungs- und Behördengebühren können zusätzliche Kosten verursachen.",

    countryRequirements:
      "Hinweise zu den Voraussetzungen",

    secureProcess: "Sichere Online-Antragstellung",

    noCategories:
      "Für dieses Land sind aktuell keine Führerscheinklassen verfügbar.",

    configurationError:
      "Die Führerscheinklassen konnten nicht geladen werden.",

    retry: "Erneut versuchen",

    summaryTitle: "Ihr Weg zum Führerschein",

    summaryDescription:
      "Wählen Sie die gewünschte Klasse und stellen Sie Ihren Antrag in Ihrem persönlichen Bereich.",

    stepOne: "Führerscheinklasse auswählen",

    stepTwo: "Persönliche Angaben bestätigen",

    stepThree: "Unterlagen hochladen",

    stepFour: "Antrag absenden",

    applicationDisclaimer:
      "Ein Antrag bei TAYM ersetzt keine gesetzlich vorgeschriebenen Prüfungen und garantiert keine behördliche Fahrerlaubnis.",

    registrationNotIncluded:
      "Die Gebühr ist nicht im angezeigten Ausbildungspreis enthalten.",

    priceIncludes:
      "Preisübersicht",

    selectAnotherCountry:
      "Sie können die Preise anderer Länder vergleichen.",

    selectedCountry: "Ausgewähltes Land",

    freeInformation:
      "Kategorien und Preise unverbindlich ansehen",

    pricingNote:
      "Die angezeigten Preise sind keine amtlichen Gebühren. Verbindlich ist ausschließlich ein von TAYM bestätigtes Angebot.",
  },

  ar: {
    eyebrow: "FAHRSCHULE TAYM",

    title: "فئات رخص القيادة",

    subtitle:
      "اكتشف فئات رخص القيادة المتاحة، وقارن أسعار التدريب، وابدأ طلبك عبر الإنترنت.",

    chooseCountry: "اختر الدولة",

    chooseCountryDescription:
      "اختر الدولة التي ترغب في الاطلاع على فئات رخص القيادة فيها.",

    countryNotice:
      "عند تقديم الطلب، تُعتمد الدولة المسجلة في حسابك الشخصي.",

    availableCategories: "فئات رخص القيادة",

    categoriesCount: "فئة",

    allCategories: "جميع الفئات",

    passenger: "السيارات والمقطورات",

    motorcycle: "الدراجات النارية",

    truck: "الشاحنات",

    bus: "الحافلات",

    trainingPrice: "سعر التدريب",

    registrationFee: "رسوم التسجيل ومعالجة الملف",

    total: "المبلغ الإجمالي",

    estimated: "سعر مبدئي",

    pricePending: "لم يتم تأكيد السعر بعد",

    priceUnavailable:
      "سيتم تأكيد السعر النهائي قبل تقديم الطلب بشكل ملزم.",

    apply: "تقديم طلب الآن",

    viewDetails: "عرض التفاصيل",

    closeDetails: "إخفاء التفاصيل",

    minimumAge: "الحد الأدنى المعتاد للعمر",

    years: "سنة",

    ageWarning:
      "يتم التحقق من الحد الأدنى للعمر والاستثناءات الممكنة بشكل فردي.",

    feeExplanation:
      "يتم عرض رسوم التسجيل ومعالجة الملف بشكل منفصل عن سعر التدريب.",

    additionalCosts:
      "قد توجد تكاليف إضافية للدروس والاختبارات والرسوم الحكومية غير المشمولة صراحة.",

    countryRequirements: "ملاحظات حول شروط القبول",

    secureProcess: "تقديم الطلب بشكل آمن عبر الإنترنت",

    noCategories:
      "لا توجد حالياً فئات رخص قيادة متاحة لهذه الدولة.",

    configurationError:
      "تعذر تحميل فئات رخص القيادة.",

    retry: "إعادة المحاولة",

    summaryTitle: "خطوات الحصول على رخصة القيادة",

    summaryDescription:
      "اختر الفئة المطلوبة وقدم طلبك من خلال حسابك الشخصي.",

    stepOne: "اختيار فئة الرخصة",

    stepTwo: "تأكيد البيانات الشخصية",

    stepThree: "رفع المستندات",

    stepFour: "إرسال الطلب",

    applicationDisclaimer:
      "تقديم الطلب لدى TAYM لا يحل محل الاختبارات القانونية المطلوبة ولا يضمن إصدار رخصة قيادة رسمية.",

    registrationNotIncluded:
      "هذه الرسوم غير مشمولة في سعر التدريب المعروض.",

    priceIncludes: "تفاصيل السعر",

    selectAnotherCountry:
      "يمكنك مقارنة الأسعار في الدول الأخرى.",

    selectedCountry: "الدولة المختارة",

    freeInformation:
      "الاطلاع على الفئات والأسعار دون التزام",

    pricingNote:
      "الأسعار المعروضة ليست رسوماً حكومية. العرض الذي تؤكده TAYM هو وحده المعتمد.",
  },

  tr: {
    eyebrow: "FAHRSCHULE TAYM",

    title: "Ehliyet Sınıfları",

    subtitle:
      "Ehliyet sınıflarımızı keşfedin, eğitim ücretlerini karşılaştırın ve başvurunuzu çevrimiçi başlatın.",

    chooseCountry: "Ülke seçin",

    chooseCountryDescription:
      "Ehliyet sınıflarını incelemek istediğiniz ülkeyi seçin.",

    countryNotice:
      "Başvuruda kişisel hesabınızda kayıtlı ülke esas alınır.",

    availableCategories: "Ehliyet sınıfları",

    categoriesCount: "sınıf",

    allCategories: "Tüm sınıflar",

    passenger: "Otomobil ve römork",

    motorcycle: "Motosikletler",

    truck: "Kamyonlar",

    bus: "Otobüsler",

    trainingPrice: "Eğitim ücreti",

    registrationFee:
      "Kayıt ve dosya işlem ücreti",

    total: "Toplam tutar",

    estimated: "Ön fiyat",

    pricePending: "Fiyat henüz onaylanmadı",

    priceUnavailable:
      "Kesin fiyat, bağlayıcı başvuru öncesinde onaylanacaktır.",

    apply: "Şimdi başvur",

    viewDetails: "Ayrıntıları göster",

    closeDetails: "Ayrıntıları gizle",

    minimumAge: "Standart asgari yaş",

    years: "yaş",

    ageWarning:
      "Asgari yaş ve olası istisnalar ayrı ayrı değerlendirilir.",

    feeExplanation:
      "Kayıt ve dosya işlem ücreti eğitim ücretinden ayrı gösterilir.",

    additionalCosts:
      "Açıkça dahil edilmeyen dersler, sınavlar ve resmi harçlar ek maliyet oluşturabilir.",

    countryRequirements:
      "Başvuru şartları hakkında bilgiler",

    secureProcess: "Güvenli çevrimiçi başvuru",

    noCategories:
      "Bu ülkede şu anda kullanılabilir ehliyet sınıfı bulunmuyor.",

    configurationError:
      "Ehliyet sınıfları yüklenemedi.",

    retry: "Tekrar dene",

    summaryTitle: "Ehliyete giden yol",

    summaryDescription:
      "İstediğiniz sınıfı seçin ve kişisel hesabınızdan başvurunuzu gönderin.",

    stepOne: "Ehliyet sınıfını seçin",

    stepTwo: "Kişisel bilgileri doğrulayın",

    stepThree: "Belgeleri yükleyin",

    stepFour: "Başvuruyu gönderin",

    applicationDisclaimer:
      "TAYM başvurusu yasal olarak zorunlu sınavların yerine geçmez ve resmi ehliyet verilmesini garanti etmez.",

    registrationNotIncluded:
      "Bu ücret gösterilen eğitim fiyatına dahil değildir.",

    priceIncludes: "Fiyat ayrıntıları",

    selectAnotherCountry:
      "Diğer ülkelerin fiyatlarını karşılaştırabilirsiniz.",

    selectedCountry: "Seçilen ülke",

    freeInformation:
      "Sınıfları ve fiyatları yükümlülük olmadan inceleyin",

    pricingNote:
      "Gösterilen fiyatlar resmi devlet harçları değildir. Yalnızca TAYM tarafından onaylanan teklif geçerlidir.",
  },

  es: {
    eyebrow: "FAHRSCHULE TAYM",

    title: "Categorías de permiso de conducir",

    subtitle:
      "Descubra nuestras categorías, compare los precios de formación y comience su solicitud en línea.",

    chooseCountry: "Seleccionar país",

    chooseCountryDescription:
      "Seleccione el país cuyas categorías de permiso desea consultar.",

    countryNotice:
      "Para presentar la solicitud se utilizará el país registrado en su cuenta personal.",

    availableCategories:
      "Categorías de permiso de conducir",

    categoriesCount: "categorías",

    allCategories: "Todas las categorías",

    passenger: "Coches y remolques",

    motorcycle: "Motocicletas",

    truck: "Camiones",

    bus: "Autobuses",

    trainingPrice: "Precio de formación",

    registrationFee:
      "Tasa de inscripción y tramitación",

    total: "Importe total",

    estimated: "Precio provisional",

    pricePending:
      "Precio pendiente de confirmación",

    priceUnavailable:
      "El precio definitivo se confirmará antes de formalizar la solicitud.",

    apply: "Solicitar ahora",

    viewDetails: "Ver detalles",

    closeDetails: "Ocultar detalles",

    minimumAge: "Edad mínima ordinaria",

    years: "años",

    ageWarning:
      "La edad mínima y las posibles excepciones se revisan individualmente.",

    feeExplanation:
      "La tasa de inscripción y tramitación se muestra por separado del precio de formación.",

    additionalCosts:
      "Las clases, los exámenes y las tasas oficiales no incluidos expresamente pueden generar costes adicionales.",

    countryRequirements:
      "Información sobre los requisitos",

    secureProcess: "Solicitud segura en línea",

    noCategories:
      "Actualmente no hay categorías disponibles para este país.",

    configurationError:
      "No se pudieron cargar las categorías.",

    retry: "Volver a intentar",

    summaryTitle:
      "Su camino hacia el permiso de conducir",

    summaryDescription:
      "Seleccione la categoría y presente la solicitud desde su cuenta personal.",

    stepOne: "Elegir categoría",

    stepTwo: "Confirmar datos personales",

    stepThree: "Subir documentos",

    stepFour: "Enviar solicitud",

    applicationDisclaimer:
      "Una solicitud a TAYM no sustituye las pruebas exigidas por ley ni garantiza la expedición de un permiso oficial.",

    registrationNotIncluded:
      "Esta tasa no está incluida en el precio de formación indicado.",

    priceIncludes: "Desglose del precio",

    selectAnotherCountry:
      "Puede comparar los precios de otros países.",

    selectedCountry: "País seleccionado",

    freeInformation:
      "Consulte categorías y precios sin compromiso",

    pricingNote:
      "Los precios mostrados no son tasas oficiales. Solo será vinculante una oferta confirmada por TAYM.",
  },
} as const;

type Dictionary =
  (typeof TRANSLATIONS)[keyof typeof TRANSLATIONS];

/* ============================================================
   3. LANGUAGE HELPERS
   ============================================================ */

function normalizeLocale(
  value: unknown
): ApplicationLocale | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];

  return (
    SUPPORTED_LOCALES as readonly string[]
  ).includes(normalized)
    ? (normalized as ApplicationLocale)
    : null;
}

function readCookie(
  name: string
): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const found = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) =>
      item.startsWith(`${name}=`)
    );

  if (!found) {
    return null;
  }

  try {
    return decodeURIComponent(
      found.slice(name.length + 1)
    );
  } catch {
    return null;
  }
}

function getCurrentLocale(): ApplicationLocale {
  if (typeof window === "undefined") {
    return "de";
  }

  let saved: string | null = null;

  try {
    saved = window.localStorage.getItem(
      LANGUAGE_STORAGE
    );
  } catch {
    // Private browsing may restrict storage.
  }

  return (
    normalizeLocale(
      readCookie(LANGUAGE_COOKIE)
    ) ??
    normalizeLocale(saved) ??
    normalizeLocale(
      document.documentElement.lang
    ) ??
    "de"
  );
}

/* ============================================================
   4. COUNTRY HELPERS
   ============================================================ */

function readInitialCountry():
  ApplicationCountry {
  if (typeof window === "undefined") {
    return "DE";
  }

  const params = new URLSearchParams(
    window.location.search
  );

  return (
    normalizeLicenseCountry(
      params.get("country")
    ) ?? "DE"
  );
}

/* ============================================================
   5. PRICE HELPERS
   ============================================================ */

function formatPrice(
  cents: number | null,
  locale: ApplicationLocale
): string {
  if (
    cents === null ||
    !Number.isSafeInteger(cents) ||
    cents < 0
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    FORMAT_LOCALES[locale],
    {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(cents / 100);
}

function calculateTotal(
  category: PublicLicenseCategoryConfiguration
): number | null {
  if (
    category.registrationFeeCents === null
  ) {
    return null;
  }

  const total =
    category.trainingPriceCents +
    category.registrationFeeCents;

  return Number.isSafeInteger(total)
    ? total
    : null;
}

/* ============================================================
   6. IMAGE HELPERS
   ============================================================ */

function safeImagePath(
  value: string | null
): string | null {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("..") ||
    value.includes("\\") ||
    value.includes("%") ||
    !/^\/[a-zA-Z0-9/_\-.]+$/.test(value) ||
    !/\.(png|jpg|jpeg|webp|avif)$/i.test(
      value
    )
  ) {
    return null;
  }

  return value;
}

const CATEGORY_ICONS: Record<LicenseCategory, LucideIcon> = {
  AM: Bike, A1: Bike, A2: Bike, A: Bike, B: CarFront, BE: CarFront,
  C1: Truck, C1E: Truck, C: Truck, CE: Truck,
  D1: BusFront, D1E: BusFront, D: BusFront, DE: BusFront,
};

/* ============================================================
   7. CATEGORY FILTERS
   ============================================================ */

type CategoryFilter =
  | "ALL"
  | "MOTORCYCLE"
  | "PASSENGER"
  | "TRUCK"
  | "BUS";

const FILTERS: CategoryFilter[] = [
  "ALL",
  "PASSENGER",
  "MOTORCYCLE",
  "TRUCK",
  "BUS",
];

function matchesFilter(
  category: LicenseCategory,
  filter: CategoryFilter
): boolean {
  switch (filter) {
    case "ALL":
      return true;

    case "MOTORCYCLE":
      return [
        "AM",
        "A1",
        "A2",
        "A",
      ].includes(category);

    case "PASSENGER":
      return ["B", "BE"].includes(category);

    case "TRUCK":
      return [
        "C1",
        "C1E",
        "C",
        "CE",
      ].includes(category);

    case "BUS":
      return [
        "D1",
        "D1E",
        "D",
        "DE",
      ].includes(category);
  }
}

function getFilterLabel(
  filter: CategoryFilter,
  t: Dictionary
): string {
  switch (filter) {
    case "ALL":
      return t.allCategories;

    case "MOTORCYCLE":
      return t.motorcycle;

    case "PASSENGER":
      return t.passenger;

    case "TRUCK":
      return t.truck;

    case "BUS":
      return t.bus;
  }
}

/* ============================================================
   8. APPLICATION LINK

   Only the selected category is passed.

   The server must determine the country
   from the authenticated user account.

   The category query is only a UI hint
   and must be validated on the server.
   ============================================================ */

function getApplicationHref(
  category: LicenseCategory
): string {
  const params = new URLSearchParams({
    category,
  });

  return `${APPLICATION_PATH}?${params.toString()}`;
}

/* ============================================================
   9. VEHICLE IMAGE
   ============================================================ */

function VehicleImage({
  category,
}: {
  category: PublicLicenseCategoryConfiguration;
}) {
  const imagePath = safeImagePath(
    category.imagePath
  );

  const [failed, setFailed] = useState(false);

  const Icon = CATEGORY_ICONS[category.category];

  const useImage =
    imagePath !== null && !failed;

  return (
    <div className="relative flex h-36 w-full items-center justify-center overflow-hidden rounded-xl bg-linear-to-br from-lime-50 via-white to-slate-100 sm:h-40 lg:h-44">
      {useImage ? (
        <Image
          key={imagePath}
          src={imagePath}
          alt={category.name.de}
          fill
          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 28vw"
          className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
          onError={() => setFailed(true)}
        />
      ) : (
        <Icon
          aria-hidden="true"
          size={70}
          strokeWidth={1.25}
          className="text-green-800/70 transition-transform duration-300 group-hover:scale-105"
        />
      )}

      <div className="absolute inset-s-3 top-3 rounded-lg border border-white/80 bg-white/90 px-2.5 py-1.5 text-xs font-black text-green-950 shadow-sm">
        {category.category}
      </div>
    </div>
  );
}

/* ============================================================
   10. COUNTRY SELECTOR
   ============================================================ */

function CountrySelector({
  value,
  onChange,
  locale,
  t,
}: {
  value: ApplicationCountry;

  onChange:
    (country: ApplicationCountry) => void;

  locale: ApplicationLocale;

  t: Dictionary;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-green-800">
          <Globe2 size={21} />
        </div>

        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-slate-950 sm:text-lg">
            {t.chooseCountry}
          </h2>

          <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">
            {t.chooseCountryDescription}
          </p>
        </div>
      </div>

      <div
        role="group"
        aria-label={t.chooseCountry}
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5"
      >
        {DRIVING_LICENSE_COUNTRIES.map(
          (country) => {
            const active = country === value;

            return (
              <button
                key={country}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(country)}
                className={`relative flex min-h-16 min-w-0 items-center gap-3 rounded-xl border-2 px-3 py-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 ${
                  active
                    ? "border-lime-500 bg-lime-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-lime-300 hover:bg-slate-50"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="shrink-0 text-2xl"
                >
                  {LICENSE_COUNTRY_FLAGS[country]}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block wrap-break-word text-xs font-bold leading-snug text-slate-900 sm:text-sm">
                    {LICENSE_COUNTRY_NAMES[country][locale]}
                  </span>

                  <span
                    dir="ltr"
                    className="mt-0.5 block text-[10px] font-semibold text-slate-500"
                  >
                    {country}
                  </span>
                </span>

                {active && (
                  <span className="absolute inset-e-2 top-2 flex size-4 items-center justify-center rounded-full bg-lime-600 text-white">
                    <Check size={11} />
                  </span>
                )}
              </button>
            );
          }
        )}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
        <Info
          size={16}
          className="mt-0.5 shrink-0 text-green-700"
        />

        <span>{t.countryNotice}</span>
      </div>
    </section>
  );
}

/* ============================================================
   11. PRICE BREAKDOWN
   ============================================================ */

function PriceBreakdown({
  category,
  locale,
  t,
}: {
  category: PublicLicenseCategoryConfiguration;

  locale: ApplicationLocale;

  t: Dictionary;
}) {
  const total = calculateTotal(category);

  return (
    <div className="space-y-2.5 rounded-xl border border-lime-200 bg-lime-50/70 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-600">
          {t.trainingPrice}
        </span>

        <strong
          dir="ltr"
          className="shrink-0 text-sm font-extrabold tabular-nums text-slate-950"
        >
          {formatPrice(
            category.trainingPriceCents,
            locale
          )}
        </strong>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs leading-snug text-slate-600">
          {t.registrationFee}
        </span>

        <strong
          dir="ltr"
          className="shrink-0 text-sm font-extrabold tabular-nums text-slate-950"
        >
          {formatPrice(
            category.registrationFeeCents,
            locale
          )}
        </strong>
      </div>

      <div className="border-t border-lime-200 pt-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold text-green-950">
            {t.total}
          </span>

          <strong
            dir="ltr"
            className="shrink-0 text-xl font-black tabular-nums text-green-800"
          >
            {formatPrice(total, locale)}
          </strong>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   12. CATEGORY CARD
   ============================================================ */

function CategoryCard({
  category,
  locale,
  t,
}: {
  category: PublicLicenseCategoryConfiguration;

  locale: ApplicationLocale;

  t: Dictionary;
}) {
  const [expanded, setExpanded] =
    useState(false);

  const total = calculateTotal(category);

  const provisional =
    !category.pricingApproved;

  const Arrow =
    locale === "ar"
      ? ArrowLeft
      : ArrowRight;

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-lime-300 hover:shadow-md sm:p-4">
      <VehicleImage
        category={category}
      />

      <div className="flex flex-1 flex-col pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-black tracking-tight text-slate-950 sm:text-xl">
            {category.name[locale]}
          </h3>

          {provisional && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">
              {t.estimated}
            </span>
          )}
        </div>

        <p className="mt-2 min-h-10 text-xs leading-relaxed text-slate-600 sm:text-sm">
          {category.description[locale]}
        </p>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">
              {t.trainingPrice}
            </p>

            <p
              dir="ltr"
              className="mt-1 text-xl font-black tabular-nums text-green-800 sm:text-2xl"
            >
              {formatPrice(
                category.trainingPriceCents,
                locale
              )}
            </p>
          </div>

          <span className="rounded-lg bg-lime-50 p-2 text-green-800">
            <Euro size={21} />
          </span>
        </div>

        <p className="mt-1 text-[11px] leading-snug text-slate-500">
          +{" "}
          {formatPrice(
            category.registrationFeeCents,
            locale
          )}{" "}
          {t.registrationFee}
        </p>

        <div className="mt-4">
          <button
            type="button"
            onClick={() =>
              setExpanded((value) => !value)
            }
            aria-expanded={expanded}
            className="flex min-h-10 w-full items-center justify-between gap-2 border-t border-slate-100 py-2 text-start text-xs font-bold text-slate-700 hover:text-green-800"
          >
            <span>
              {expanded
                ? t.closeDetails
                : t.viewDetails}
            </span>

            <ChevronDown
              size={17}
              className={`transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
            />
          </button>

          {expanded && (
            <div className="space-y-3 pb-3">
              <PriceBreakdown
                category={category}
                locale={locale}
                t={t}
              />

              {category.minimumAge !== null && (
                <div className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
                  <Info
                    size={15}
                    className="mt-0.5 shrink-0 text-green-700"
                  />

                  <span>
                    {t.minimumAge}:{" "}
                    <strong>
                      {category.minimumAge}{" "}
                      {t.years}
                    </strong>
                  </span>
                </div>
              )}

              <p className="text-[11px] leading-relaxed text-slate-500">
                {t.ageWarning}
              </p>
            </div>
          )}
        </div>

        <div className="mt-auto space-y-2">
          {provisional && (
            <p className="text-[11px] leading-relaxed text-amber-800">
              {t.priceUnavailable}
            </p>
          )}

          {total === null && (
            <p className="text-[11px] font-medium text-amber-800">
              {t.pricePending}
            </p>
          )}

          <Link
            href={getApplicationHref(
              category.category
            )}
            className="flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-linear-to-r from-green-800 to-lime-600 px-4 py-3 text-center text-sm font-extrabold text-white shadow-sm transition-all hover:from-green-900 hover:to-lime-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2"
          >
            <ClipboardList size={18} />

            <span>{t.apply}</span>

            <Arrow
              size={17}
              className="shrink-0"
            />
          </Link>
        </div>
      </div>
    </article>
  );
}

/* ============================================================
   13. APPLICATION STEPS
   ============================================================ */

function ApplicationSteps({
  t,
}: {
  t: Dictionary;
}) {
  const steps = [
    t.stepOne,
    t.stepTwo,
    t.stepThree,
    t.stepFour,
  ];

  return (
    <section className="rounded-2xl border border-lime-200 bg-linear-to-br from-lime-50 via-white to-white p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-lime-500 to-green-800 text-white">
          <FileCheck2 size={23} />
        </div>

        <div>
          <h2 className="text-lg font-extrabold text-slate-950 sm:text-xl">
            {t.summaryTitle}
          </h2>

          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {t.summaryDescription}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-xl border border-lime-100 bg-white p-3.5"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-lime-100 text-sm font-extrabold text-green-800">
              {index + 1}
            </span>

            <span className="text-xs font-semibold leading-relaxed text-slate-800 sm:text-sm">
              {step}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   14. MAIN COMPONENT
   ============================================================ */

export default function LicenseCategories() {
  const [locale, setLocale] =
    useState<ApplicationLocale>("de");

  const [country, setCountry] =
    useState<ApplicationCountry>("DE");

  const [filter, setFilter] =
    useState<CategoryFilter>("ALL");

  const [configError, setConfigError] =
    useState(false);

  /* ========================================================
     15. INITIAL COUNTRY AND LANGUAGE
     ======================================================== */

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLocale(getCurrentLocale());
      setCountry(readInitialCountry());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  /* ========================================================
     16. FOLLOW EXISTING LANGUAGE SWITCHER
     ======================================================== */

  useEffect(() => {
    function updateLocale(event?: Event) {
      let selected: ApplicationLocale | null =
        null;

      if (
        event instanceof CustomEvent
      ) {
        const detail: unknown = event.detail;

        if (typeof detail === "string") {
          selected = normalizeLocale(detail);

        } else if (
          detail !== null &&
          typeof detail === "object" &&
          "locale" in detail
        ) {
          selected = normalizeLocale(
            detail.locale
          );
        }
      }

      setLocale(
        selected ?? getCurrentLocale()
      );
    }

    function readHtmlLocale() {
      const next = normalizeLocale(
        document.documentElement.lang
      );

      if (next) {
        setLocale(next);
      }
    }

    const observer =
      new MutationObserver(
        readHtmlLocale
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
      updateLocale
    );

    window.addEventListener(
      "storage",
      updateLocale
    );

    window.addEventListener(
      "focus",
      updateLocale
    );

    return () => {
      observer.disconnect();

      window.removeEventListener(
        LANGUAGE_EVENT,
        updateLocale
      );

      window.removeEventListener(
        "storage",
        updateLocale
      );

      window.removeEventListener(
        "focus",
        updateLocale
      );
    };
  }, []);

  /* ========================================================
     17. LOAD CATALOG FROM CENTRAL CONFIG
     ======================================================== */

  const configuration =
    useMemo<CountryLicenseConfiguration | null>(
      () => {
        try {
          return getCountryLicenseConfiguration(
            country
          );
        } catch {
          return null;
        }
      },
      [country]
    );

  const t = TRANSLATIONS[locale];

  const rtl = locale === "ar";

  const allCategories =
    useMemo(() => {
      if (!configuration) {
        return [];
      }

      return configuration.categories.filter(
        (category) => category.enabled
      );
    }, [configuration]);

  const visibleCategories =
    useMemo(() => {
      return allCategories.filter(
        (category) =>
          matchesFilter(
            category.category,
            filter
          )
      );
    }, [
      allCategories,
      filter,
    ]);

  const admissionNotice =
    useMemo(() => {
      try {
        return getLicenseAdmissionNotice(
          country,
          locale
        );
      } catch {
        return "";
      }
    }, [
      country,
      locale,
    ]);

  /* ========================================================
     18. COUNTRY SELECTION

     This affects the public catalog.

     It does not alter the account country.
     ======================================================== */

  const handleCountryChange =
    useCallback(
      (nextCountry: ApplicationCountry) => {
        setCountry(nextCountry);
        setFilter("ALL");
        setConfigError(false);
      },
      []
    );

  /* ========================================================
     19. ERROR DISPLAY
     ======================================================== */

  if (!configuration || configError) {
    return (
      <section
        lang={locale}
        dir={rtl ? "rtl" : "ltr"}
        className="mx-auto w-full max-w-none px-4 py-12 sm:px-6"
      >
        <div className="rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
          <Info
            size={32}
            className="mx-auto text-red-600"
          />

          <p className="mt-4 text-sm font-medium text-slate-700">
            {t.configurationError}
          </p>

          <button
            type="button"
            onClick={() => {
              setConfigError(false);
              setCountry("DE");
            }}
            className="mx-auto mt-5 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green-800 px-5 py-2.5 text-sm font-bold text-white"
          >
            <RefreshCw size={17} />
            {t.retry}
          </button>
        </div>
      </section>
    );
  }

  /* ========================================================
     20. PUBLIC PAGE CONTENT

     Existing layout remains responsible
     for all shared navigation.
     ======================================================== */

  return (
    <div
      lang={locale}
      dir={rtl ? "rtl" : "ltr"}
      className="w-full min-w-0 bg-[#f6f8f4] text-slate-950"
    >
      {/* ==================================================
         HERO
         ================================================== */}

      <section className="relative overflow-hidden border-b border-lime-200 bg-linear-to-br from-[#d8f0ad] via-[#edf8dc] to-white">
        <div className="pointer-events-none absolute -inset-e-20 -top-24 size-80 rounded-full bg-lime-400/15 blur-3xl" />

        <div className="relative mx-auto flex w-full max-w-none flex-col gap-5 px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-10">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-lime-300 bg-white/80 px-3 py-1.5 text-[11px] font-extrabold tracking-wide text-green-900">
            <CarFront size={15} />
            {t.eyebrow}
          </div>

          <div className="flex max-w-4xl items-start gap-4">
            <span className="hidden size-16 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-lime-500 to-green-800 text-white shadow-md sm:flex">
              <CarFront size={33} />
            </span>

            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
                {t.title}
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-700 sm:text-base lg:text-lg">
                {t.subtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-green-900 sm:text-sm">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 size={17} />
              {t.freeInformation}
            </span>

            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={17} />
              {t.secureProcess}
            </span>
          </div>
        </div>
      </section>

      {/* ==================================================
         MAIN CONTENT
         ================================================== */}

      <div className="mx-auto w-full max-w-none space-y-6 px-4 py-7 sm:px-6 sm:py-9 lg:space-y-8 lg:px-8 lg:py-12">

        {/* =================================================
           COUNTRY SELECTION
           ================================================= */}

        <CountrySelector
          value={country}
          onChange={handleCountryChange}
          locale={locale}
          t={t}
        />

        {/* =================================================
           AVAILABLE CATEGORIES AND FILTERS
           ================================================= */}

        <section
          aria-labelledby="license-categories-heading"
          className="space-y-5"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-green-800">
                {LICENSE_COUNTRY_FLAGS[country]}{" "}
                {LICENSE_COUNTRY_NAMES[country][locale]}
              </p>

              <h2
                id="license-categories-heading"
                className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl lg:text-3xl"
              >
                {t.availableCategories}
              </h2>
            </div>

            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
              {allCategories.length}{" "}
              {t.categoriesCount}
            </span>
          </div>

          <div
            role="group"
            aria-label={t.availableCategories}
            className="flex flex-wrap gap-2"
          >
            {FILTERS.map((item) => {
              const active =
                filter === item;

              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setFilter(item)
                  }
                  className={`min-h-10 rounded-full border px-4 py-2 text-xs font-bold transition-colors sm:text-sm ${
                    active
                      ? "border-green-800 bg-green-800 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-lime-500 hover:text-green-800"
                  }`}
                >
                  {getFilterLabel(
                    item,
                    t
                  )}
                </button>
              );
            })}
          </div>

          {visibleCategories.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <CarFront
                size={38}
                className="mx-auto text-slate-400"
              />

              <p className="mt-4 text-sm text-slate-600">
                {t.noCategories}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:gap-5">
              {visibleCategories.map(
                (category) => (
                  <CategoryCard
                    key={`${country}-${category.category}`}
                    category={category}
                    locale={locale}
                    t={t}
                  />
                )
              )}
            </div>
          )}
        </section>

        {/* =================================================
           COUNTRY REQUIREMENTS
           ================================================= */}

        {admissionNotice && (
          <section className="rounded-2xl border border-lime-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-green-800">
                <Info size={21} />
              </span>

              <div className="min-w-0">
                <h2 className="text-base font-extrabold text-slate-950">
                  {t.countryRequirements}
                </h2>

                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {admissionNotice}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* =================================================
           APPLICATION STEPS
           ================================================= */}

        <ApplicationSteps t={t} />

        {/* =================================================
           COMMERCIAL AND LEGAL NOTICES
           ================================================= */}

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-xs leading-relaxed text-slate-600 sm:p-6 sm:text-sm">
          <div className="flex items-start gap-3">
            <Wallet
              size={19}
              className="mt-0.5 shrink-0 text-green-800"
            />

            <div className="space-y-2">
              <p>{t.feeExplanation}</p>

              <p>{t.registrationNotIncluded}</p>

              <p>{t.additionalCosts}</p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-start gap-3">
              <LockKeyhole
                size={19}
                className="mt-0.5 shrink-0 text-green-800"
              />

              <div className="space-y-2">
                <p>{t.pricingNote}</p>

                <p>{t.applicationDisclaimer}</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
