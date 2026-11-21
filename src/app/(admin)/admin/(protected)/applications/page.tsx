
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Eye,
  FileClock,
  FileSearch,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";

/* ============================================================
   FAHRSCHULE TAYM

   ADMIN — FÜHRERSCHEINANTRÄGE

   File:
   src/app/(admin)/admin/(protected)/applications/page.tsx

   Route:
   /admin/applications

   Backend:
   GET /api/admin/applications

   Detail:
   /admin/applications/[id]

   Languages:
   DE / AR / TR / ES

   Supported countries:
   DE / AT / BE / IT / ES

   Features:
   - Real database results only
   - Server-side search and filters
   - Pagination
   - Status summary
   - Responsive desktop table
   - Responsive mobile cards
   - Automatic refresh
   - Protected session handling
   - No sensitive document URLs in list
   ============================================================ */

const API_URL = "/api/admin/applications";
const PAGE_SIZE = 15;
const REFRESH_MS = 30_000;

type Locale = "de" | "ar" | "tr" | "es";

type Country =
  | "DE"
  | "AT"
  | "BE"
  | "IT"
  | "ES";

type CountryFilter = Country | "ALL";

type ApplicationStatus =
  | "PENDING"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED";

type StatusFilter = ApplicationStatus | "ALL";

type ApplicationRecord = {
  id: string;
  reference: string;
  firstName: string;
  lastName: string;
  email: string;
  countryCode: Country;
  licenseClass: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
};

type Statistics = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};

type PaginatedApplications = {
  items: ApplicationRecord[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type ApplicationsResponse = {
  stats: Statistics;
  applications: PaginatedApplications;
  generatedAt: string | null;
};

type PageState =
  | "loading"
  | "ready"
  | "error"
  | "unauthorized";


/* ============================================================
   COUNTRIES
   ============================================================ */

const COUNTRIES = [
  "DE",
  "AT",
  "BE",
  "IT",
  "ES",
] as const;

const COUNTRY_FLAGS: Record<Country, string> = {
  DE: "🇩🇪",
  AT: "🇦🇹",
  BE: "🇧🇪",
  IT: "🇮🇹",
  ES: "🇪🇸",
};

const COUNTRY_NAMES: Record<
  Country,
  Record<Locale, string>
> = {
  DE: {
    de: "Deutschland",
    ar: "ألمانيا",
    tr: "Almanya",
    es: "Alemania",
  },

  AT: {
    de: "Österreich",
    ar: "النمسا",
    tr: "Avusturya",
    es: "Austria",
  },

  BE: {
    de: "Belgien",
    ar: "بلجيكا",
    tr: "Belçika",
    es: "Bélgica",
  },

  IT: {
    de: "Italien",
    ar: "إيطاليا",
    tr: "İtalya",
    es: "Italia",
  },

  ES: {
    de: "Spanien",
    ar: "إسبانيا",
    tr: "İspanya",
    es: "España",
  },
};

/* ============================================================
   TRANSLATIONS
   ============================================================ */

const TEXT = {
  de: {
    eyebrow: "ANTRAGSVERWALTUNG",
    title: "Führerscheinanträge",
    description:
      "Alle eingereichten Führerscheinanträge zentral prüfen und verwalten.",

    total: "Alle Anträge",
    pending: "Offen / In Prüfung",
    approved: "Genehmigt",
    rejected: "Abgelehnt",

    search: "Antrag suchen",
    searchPlaceholder:
      "Name, E-Mail oder Antragsnummer",

    country: "Land",
    allCountries: "Alle Länder",

    status: "Status",
    allStatuses: "Alle Status",
    statusPending: "Eingegangen",
    statusReview: "In Prüfung",
    statusApproved: "Genehmigt",
    statusRejected: "Abgelehnt",

    filters: "Filter",
    clearFilters: "Filter zurücksetzen",

    listTitle: "Antragsübersicht",
    listDescription:
      "Alle verfügbaren Anträge entsprechend deiner Auswahl.",

    candidate: "Antragsteller",
    reference: "Antragsnummer",
    licenseClass: "Führerscheinklasse",
    submitted: "Eingereicht am",
    actions: "Aktionen",
    view: "Ansehen",

    loading: "Anträge werden geladen...",
    loadError:
      "Die Führerscheinanträge konnten nicht geladen werden.",
    unavailable:
      "Der Dienst ist derzeit nicht verfügbar. Bitte versuche es erneut.",

    unauthorized:
      "Deine Administratorsitzung ist abgelaufen oder ungültig.",
    login: "Zur Anmeldung",

    retry: "Erneut versuchen",
    refresh: "Aktualisieren",
    updating: "Wird aktualisiert",

    autoRefresh:
      "Automatische Aktualisierung alle 30 Sekunden",
    lastUpdate: "Letzte Aktualisierung",

    noResults: "Keine Anträge gefunden",
    noResultsDescription:
      "Es liegen keine Anträge vor, die den ausgewählten Filtern entsprechen.",

    page: "Seite",
    of: "von",
    previous: "Zurück",
    next: "Weiter",
    entries: "Anträge",

    unknown: "Nicht angegeben",

    dashboard: "Dashboard",

    safetyTitle: "Geschützte Antragsdaten",
    safetyText:
      "Ausweisdokumente, Unterschriften und weitere vertrauliche Nachweise können nur in den dafür autorisierten Detailansichten geprüft werden.",

    statsNote:
      "Die Kennzahlen beziehen sich auf alle Länder. Die Filter gelten für die Antragsliste.",
  },

  ar: {
    eyebrow: "إدارة الطلبات",
    title: "طلبات رخص القيادة",
    description:
      "مراجعة وإدارة جميع طلبات رخص القيادة المقدمة عبر المنصة.",

    total: "جميع الطلبات",
    pending: "قيد الانتظار أو المراجعة",
    approved: "الطلبات المقبولة",
    rejected: "الطلبات المرفوضة",

    search: "البحث عن طلب",
    searchPlaceholder:
      "الاسم أو البريد الإلكتروني أو رقم الطلب",

    country: "الدولة",
    allCountries: "جميع الدول",

    status: "الحالة",
    allStatuses: "جميع الحالات",
    statusPending: "تم الاستلام",
    statusReview: "قيد المراجعة",
    statusApproved: "تمت الموافقة",
    statusRejected: "مرفوض",

    filters: "التصفية",
    clearFilters: "إعادة ضبط الفلاتر",

    listTitle: "قائمة الطلبات",
    listDescription:
      "جميع الطلبات المتاحة بحسب معايير البحث.",

    candidate: "مقدم الطلب",
    reference: "رقم الطلب",
    licenseClass: "فئة رخصة القيادة",
    submitted: "تاريخ التقديم",
    actions: "الإجراءات",
    view: "عرض",

    loading: "جارٍ تحميل الطلبات...",
    loadError: "تعذر تحميل طلبات رخص القيادة.",
    unavailable:
      "الخدمة غير متاحة حالياً. حاول مرة أخرى.",

    unauthorized:
      "انتهت جلسة المسؤول أو لم تعد صالحة.",
    login: "تسجيل الدخول",

    retry: "إعادة المحاولة",
    refresh: "تحديث",
    updating: "جارٍ التحديث",

    autoRefresh:
      "تحديث تلقائي كل 30 ثانية",
    lastUpdate: "آخر تحديث",

    noResults: "لم يتم العثور على طلبات",
    noResultsDescription:
      "لا توجد طلبات مطابقة لمعايير البحث المحددة.",

    page: "صفحة",
    of: "من",
    previous: "السابق",
    next: "التالي",
    entries: "طلب",

    unknown: "غير محدد",

    dashboard: "لوحة التحكم",

    safetyTitle: "حماية بيانات الطلبات",
    safetyText:
      "يمكن مراجعة وثائق الهوية والتوقيعات والمستندات السرية فقط في صفحات التفاصيل المحمية والمصرح بها.",

    statsNote:
      "تشمل الإحصاءات جميع الدول، أما الفلاتر فتخص قائمة الطلبات.",
  },

  tr: {
    eyebrow: "BAŞVURU YÖNETİMİ",
    title: "Ehliyet başvuruları",
    description:
      "Platforma gönderilen tüm ehliyet başvurularını tek yerden inceleyin ve yönetin.",

    total: "Tüm başvurular",
    pending: "Bekleyen / İncelenen",
    approved: "Onaylanan",
    rejected: "Reddedilen",

    search: "Başvuru ara",
    searchPlaceholder:
      "Ad, e-posta veya başvuru numarası",

    country: "Ülke",
    allCountries: "Tüm ülkeler",

    status: "Durum",
    allStatuses: "Tüm durumlar",
    statusPending: "Alındı",
    statusReview: "İnceleniyor",
    statusApproved: "Onaylandı",
    statusRejected: "Reddedildi",

    filters: "Filtreler",
    clearFilters: "Filtreleri sıfırla",

    listTitle: "Başvuru listesi",
    listDescription:
      "Seçilen kriterlere göre mevcut başvurular.",

    candidate: "Başvuru sahibi",
    reference: "Başvuru numarası",
    licenseClass: "Ehliyet sınıfı",
    submitted: "Başvuru tarihi",
    actions: "İşlemler",
    view: "Görüntüle",

    loading: "Başvurular yükleniyor...",
    loadError: "Başvurular yüklenemedi.",
    unavailable:
      "Hizmet şu anda kullanılamıyor. Tekrar deneyin.",

    unauthorized:
      "Yönetici oturumunuz sona erdi veya geçersiz.",
    login: "Giriş yap",

    retry: "Tekrar dene",
    refresh: "Yenile",
    updating: "Güncelleniyor",

    autoRefresh:
      "Her 30 saniyede otomatik güncelleme",
    lastUpdate: "Son güncelleme",

    noResults: "Başvuru bulunamadı",
    noResultsDescription:
      "Seçilen filtrelerle eşleşen başvuru yok.",

    page: "Sayfa",
    of: "/",
    previous: "Önceki",
    next: "Sonraki",
    entries: "Başvuru",

    unknown: "Belirtilmedi",

    dashboard: "Kontrol paneli",

    safetyTitle: "Korunan başvuru verileri",
    safetyText:
      "Kimlik belgeleri, imzalar ve gizli dosyalar yalnızca yetkili kişilerin erişebildiği ayrıntı sayfalarından incelenebilir.",

    statsNote:
      "İstatistikler tüm ülkeleri kapsar. Filtreler başvuru listesine uygulanır.",
  },

  es: {
    eyebrow: "GESTIÓN DE SOLICITUDES",
    title: "Solicitudes de permisos",
    description:
      "Revise y gestione todas las solicitudes de permiso de conducir desde un solo lugar.",

    total: "Todas las solicitudes",
    pending: "Pendientes / En revisión",
    approved: "Aprobadas",
    rejected: "Rechazadas",

    search: "Buscar solicitud",
    searchPlaceholder:
      "Nombre, correo o referencia",

    country: "País",
    allCountries: "Todos los países",

    status: "Estado",
    allStatuses: "Todos los estados",
    statusPending: "Recibida",
    statusReview: "En revisión",
    statusApproved: "Aprobada",
    statusRejected: "Rechazada",

    filters: "Filtros",
    clearFilters: "Restablecer filtros",

    listTitle: "Lista de solicitudes",
    listDescription:
      "Todas las solicitudes disponibles según los filtros seleccionados.",

    candidate: "Solicitante",
    reference: "Número de solicitud",
    licenseClass: "Categoría de permiso",
    submitted: "Fecha de solicitud",
    actions: "Acciones",
    view: "Ver",

    loading: "Cargando solicitudes...",
    loadError:
      "No se pudieron cargar las solicitudes.",
    unavailable:
      "El servicio no está disponible. Inténtelo de nuevo.",

    unauthorized:
      "La sesión de administrador ha caducado o no es válida.",
    login: "Iniciar sesión",

    retry: "Reintentar",
    refresh: "Actualizar",
    updating: "Actualizando",

    autoRefresh:
      "Actualización automática cada 30 segundos",
    lastUpdate: "Última actualización",

    noResults: "No se encontraron solicitudes",
    noResultsDescription:
      "No hay solicitudes que coincidan con los filtros seleccionados.",

    page: "Página",
    of: "de",
    previous: "Anterior",
    next: "Siguiente",
    entries: "Solicitudes",

    unknown: "No indicado",

    dashboard: "Panel de control",

    safetyTitle: "Datos protegidos",
    safetyText:
      "Los documentos de identidad, firmas y archivos confidenciales solo pueden consultarse en las vistas detalladas autorizadas.",

    statsNote:
      "Las estadísticas incluyen todos los países. Los filtros se aplican a la lista de solicitudes.",
  },
} as const;

/* ============================================================
   STATUS METADATA
   ============================================================ */

const STATUS_META: Record<
  ApplicationStatus,
  {
    icon: LucideIcon;
    className: string;
    key:
      | "statusPending"
      | "statusReview"
      | "statusApproved"
      | "statusRejected";
  }
> = {
  PENDING: {
    icon: Clock3,
    className:
      "border-amber-200 bg-amber-50 text-amber-800",
    key: "statusPending",
  },

  IN_REVIEW: {
    icon: FileClock,
    className:
      "border-blue-200 bg-blue-50 text-blue-800",
    key: "statusReview",
  },

  APPROVED: {
    icon: CheckCircle2,
    className:
      "border-green-200 bg-green-50 text-green-800",
    key: "statusApproved",
  },

  REJECTED: {
    icon: XCircle,
    className:
      "border-red-200 bg-red-50 text-red-800",
    key: "statusRejected",
  },
};

/* ============================================================
   LANGUAGE HELPERS
   ============================================================ */

function normalizeLocale(
  value: unknown
): Locale | null {
  if (typeof value !== "string") {
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

function readCookie(
  name: string
): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${name}=`;

  const item = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!item) {
    return null;
  }

  try {
    return decodeURIComponent(
      item.slice(prefix.length)
    );
  } catch {
    return null;
  }
}

function readLocale(): Locale {
  if (typeof window === "undefined") {
    return "de";
  }

  const htmlLocale = normalizeLocale(
    document.documentElement.lang
  );

  if (htmlLocale) {
    return htmlLocale;
  }

  const cookieLocale =
    normalizeLocale(readCookie("taym-locale")) ??
    normalizeLocale(readCookie("NEXT_LOCALE"));

  if (cookieLocale) {
    return cookieLocale;
  }

  try {
    return (
      normalizeLocale(
        localStorage.getItem("taym-locale")
      ) ?? "de"
    );
  } catch {
    return "de";
  }
}

/* ============================================================
   SAFE API RESPONSE VALIDATION
   ============================================================ */

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isCount(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function isPositiveInteger(
  value: unknown
): value is number {
  return (
    isCount(value) &&
    value > 0
  );
}

function isCountry(
  value: unknown
): value is Country {
  return (
    value === "DE" ||
    value === "AT" ||
    value === "BE" ||
    value === "IT" ||
    value === "ES"
  );
}

function isStatus(
  value: unknown
): value is ApplicationStatus {
  return (
    value === "PENDING" ||
    value === "IN_REVIEW" ||
    value === "APPROVED" ||
    value === "REJECTED"
  );
}

function validIsoDate(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !Number.isNaN(
      Date.parse(value)
    )
  );
}

function requiredText(
  value: unknown,
  maxLength: number
): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength
  ) {
    throw new Error(
      "INVALID_APPLICATION_RESPONSE"
    );
  }

  return value;
}

function readApplication(
  value: unknown
): ApplicationRecord {
  if (
    !isRecord(value) ||
    !isCountry(value.countryCode) ||
    !isStatus(value.status) ||
    !validIsoDate(value.createdAt) ||
    !validIsoDate(value.updatedAt)
  ) {
    throw new Error(
      "INVALID_APPLICATION"
    );
  }

  return {
    id: requiredText(value.id, 150),

    reference: requiredText(
      value.reference,
      120
    ),

    firstName: requiredText(
      value.firstName,
      150
    ),

    lastName: requiredText(
      value.lastName,
      150
    ),

    email: requiredText(
      value.email,
      254
    ),

    countryCode: value.countryCode,

    licenseClass: requiredText(
      value.licenseClass,
      80
    ),

    status: value.status,

    createdAt: value.createdAt,

    updatedAt: value.updatedAt,
  };
}

function readApplicationsResponse(
  value: unknown
): ApplicationsResponse {
  if (
    !isRecord(value) ||
    value.success !== true ||
    !isRecord(value.stats) ||
    !isRecord(value.applications)
  ) {
    throw new Error(
      "INVALID_API_RESPONSE"
    );
  }

  const stats = value.stats;
  const list = value.applications;

  if (
    !isCount(stats.total) ||
    !isCount(stats.pending) ||
    !isCount(stats.approved) ||
    !isCount(stats.rejected)
  ) {
    throw new Error(
      "INVALID_STATISTICS"
    );
  }

  if (
    !Array.isArray(list.items) ||
    !isPositiveInteger(list.page) ||
    !isPositiveInteger(list.pageSize) ||
    !isCount(list.total) ||
    !isPositiveInteger(list.totalPages)
  ) {
    throw new Error(
      "INVALID_PAGINATION"
    );
  }

  if (
    list.items.length > list.pageSize ||
    list.page > list.totalPages
  ) {
    throw new Error(
      "INVALID_PAGE_DATA"
    );
  }

  return {
    stats: {
      total: stats.total,
      pending: stats.pending,
      approved: stats.approved,
      rejected: stats.rejected,
    },

    applications: {
      items: list.items.map(
        readApplication
      ),
      page: list.page,
      pageSize: list.pageSize,
      total: list.total,
      totalPages: list.totalPages,
    },

    generatedAt:
      validIsoDate(value.generatedAt)
        ? value.generatedAt
        : null,
  };
}

/* ============================================================
   FORMATTING
   ============================================================ */

const INTL_LOCALE: Record<
  Locale,
  string
> = {
  de: "de-DE",
  ar: "ar",
  tr: "tr-TR",
  es: "es-ES",
};

function formatNumber(
  number: number,
  locale: Locale
): string {
  return new Intl.NumberFormat(
    INTL_LOCALE[locale]
  ).format(number);
}

function formatDate(
  value: string,
  locale: Locale
): string {
  return new Intl.DateTimeFormat(
    INTL_LOCALE[locale],
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(new Date(value));
}

/* ============================================================
   SHARED STATUS BADGE
   ============================================================ */

function StatusBadge({
  status,
  locale,
}: {
  status: ApplicationStatus;
  locale: Locale;
}) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  const t = TEXT[locale];

  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${meta.className}`}
    >
      <Icon
        size={14}
        aria-hidden="true"
      />

      {t[meta.key]}
    </span>
  );
}

/* ============================================================
   STATISTIC CARD
   ============================================================ */

function StatisticCard({
  title,
  value,
  icon: Icon,
  tone,
  locale,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  tone: "blue" | "amber" | "green" | "red";
  locale: Locale;
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-lime-100 text-green-800",
    red: "bg-red-50 text-red-700",
  };

  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-relaxed text-slate-500 sm:text-sm">
            {title}
          </p>

          <p className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {formatNumber(
              value,
              locale
            )}
          </p>
        </div>

        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          <Icon
            size={22}
            aria-hidden="true"
          />
        </span>
      </div>
    </article>
  );
}

/* ============================================================
   DESKTOP TABLE
   ============================================================ */

function ApplicationsTable({
  items,
  locale,
}: {
  items: ApplicationRecord[];
  locale: Locale;
}) {
  const t = TEXT[locale];
  const rtl = locale === "ar";

  return (
    <div className="hidden w-full overflow-x-auto lg:block">
      <table className="w-full min-w-225 border-collapse text-start">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200 text-start text-xs font-bold text-slate-500">
            <th
              scope="col"
              className="px-5 py-4 text-start"
            >
              {t.candidate}
            </th>

            <th
              scope="col"
              className="px-4 py-4 text-start"
            >
              {t.reference}
            </th>

            <th
              scope="col"
              className="px-4 py-4 text-start"
            >
              {t.country}
            </th>

            <th
              scope="col"
              className="px-4 py-4 text-start"
            >
              {t.licenseClass}
            </th>

            <th
              scope="col"
              className="px-4 py-4 text-start"
            >
              {t.submitted}
            </th>

            <th
              scope="col"
              className="px-4 py-4 text-start"
            >
              {t.status}
            </th>

            <th
              scope="col"
              className="px-5 py-4 text-end"
            >
              {t.actions}
            </th>
          </tr>
        </thead>

        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="border-b border-slate-100 transition-colors last:border-b-0 hover:bg-lime-50/30"
            >
              <td className="px-5 py-4">
                <div className="min-w-0">
                  <p className="font-bold text-slate-950">
                    {item.firstName}{" "}
                    {item.lastName}
                  </p>

                  <p className="mt-1 break-all text-xs text-slate-500">
                    {item.email}
                  </p>
                </div>
              </td>

              <td
                dir="auto"
                className="px-4 py-4 text-xs font-semibold text-slate-700"
              >
                {item.reference}
              </td>

              <td className="px-4 py-4">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <span aria-hidden="true">
                    {
                      COUNTRY_FLAGS[
                        item.countryCode
                      ]
                    }
                  </span>

                  {
                    COUNTRY_NAMES[
                      item.countryCode
                    ][locale]
                  }
                </span>
              </td>

              <td className="px-4 py-4">
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-800">
                  {item.licenseClass}
                </span>
              </td>

              <td className="px-4 py-4 text-xs text-slate-600">
                <time
                  dateTime={
                    item.createdAt
                  }
                >
                  {formatDate(
                    item.createdAt,
                    locale
                  )}
                </time>
              </td>

              <td className="px-4 py-4">
                <StatusBadge
                  status={item.status}
                  locale={locale}
                />
              </td>

              <td className="px-5 py-4 text-end">
                <Link
                  href={`/admin/applications/${encodeURIComponent(
                    item.id
                  )}`}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-lime-200 bg-lime-50 px-3 py-2 text-xs font-bold text-green-800 transition-colors hover:bg-lime-100"
                >
                  <Eye
                    size={16}
                    aria-hidden="true"
                  />

                  {t.view}

                  {rtl ? (
                    <ArrowLeft
                      size={15}
                    />
                  ) : (
                    <ArrowRight
                      size={15}
                    />
                  )}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
   MOBILE / TABLET APPLICATION CARD
   ============================================================ */

function MobileApplicationCard({
  item,
  locale,
}: {
  item: ApplicationRecord;
  locale: Locale;
}) {
  const t = TEXT[locale];
  const rtl = locale === "ar";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="wrap-break-word text-sm font-extrabold text-slate-950 sm:text-base">
            {item.firstName}{" "}
            {item.lastName}
          </p>

          <p
            dir="auto"
            className="mt-1 break-all text-xs text-slate-500"
          >
            {item.email}
          </p>

          <p
            dir="auto"
            className="mt-2 break-all text-xs font-bold text-green-800"
          >
            {item.reference}
          </p>
        </div>

        <StatusBadge
          status={item.status}
          locale={locale}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
        <div>
          <p className="text-xs text-slate-500">
            {t.country}
          </p>

          <p className="mt-1 text-sm font-bold text-slate-800">
            {
              COUNTRY_FLAGS[
                item.countryCode
              ]
            }{" "}
            {
              COUNTRY_NAMES[
                item.countryCode
              ][locale]
            }
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500">
            {t.licenseClass}
          </p>

          <p className="mt-1 text-sm font-bold text-slate-800">
            {item.licenseClass}
          </p>
        </div>

        <div className="col-span-2">
          <p className="text-xs text-slate-500">
            {t.submitted}
          </p>

          <p className="mt-1 text-sm font-semibold text-slate-800">
            {formatDate(
              item.createdAt,
              locale
            )}
          </p>
        </div>
      </div>

      <Link
        href={`/admin/applications/${encodeURIComponent(
          item.id
        )}`}
        className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-green-800 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-green-900"
      >
        <Eye
          size={18}
          aria-hidden="true"
        />

        {t.view}

        {rtl ? (
          <ArrowLeft size={16} />
        ) : (
          <ArrowRight size={16} />
        )}
      </Link>
    </article>
  );
}

/* ============================================================
   MAIN PAGE
   ============================================================ */

export default function AdminApplicationsPage() {
  const [locale, setLocale] =
    useState<Locale>("de");

  const [search, setSearch] =
    useState("");

  const [debouncedSearch, setDebouncedSearch] =
    useState("");

  const [country, setCountry] =
    useState<CountryFilter>("ALL");

  const [status, setStatus] =
    useState<StatusFilter>("ALL");

  const [page, setPage] =
    useState(1);

  const [refreshKey, setRefreshKey] =
    useState(0);

  const [data, setData] =
    useState<ApplicationsResponse | null>(
      null
    );

  const [state, setState] =
    useState<PageState>("loading");

  const [refreshing, setRefreshing] =
    useState(false);

  const t = TEXT[locale];
  const rtl = locale === "ar";

  /* ========================================================
     LANGUAGE SYNCHRONIZATION
     ======================================================== */

  useEffect(() => {
    const synchronize = (
      event?: Event
    ) => {
      if (
        event instanceof CustomEvent
      ) {
        const detail: unknown =
          event.detail;

        const incoming =
          typeof detail === "string"
            ? detail
            : isRecord(detail)
              ? detail.locale
              : null;

        const next =
          normalizeLocale(incoming);

        if (next) {
          setLocale(next);
          return;
        }
      }

      setLocale(readLocale());
    };

    synchronize();

    const observer =
      new MutationObserver(
        () => synchronize()
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
      synchronize
    );

    window.addEventListener(
      "storage",
      synchronize
    );

    return () => {
      observer.disconnect();

      window.removeEventListener(
        "taym:language-change",
        synchronize
      );

      window.removeEventListener(
        "storage",
        synchronize
      );
    };
  }, []);

  /* ========================================================
     SEARCH DEBOUNCE
     ======================================================== */

  useEffect(() => {
    const timeout =
      window.setTimeout(() => {
        setPage(1);
        setDebouncedSearch(
          search.trim().slice(0, 120)
        );
      }, 350);

    return () => {
      window.clearTimeout(
        timeout
      );
    };
  }, [search]);

  /* ========================================================
     RESET PAGINATION AFTER FILTERS CHANGE
     ======================================================== */

  function changeCountry(
    next: CountryFilter
  ) {
    setCountry(next);
    setPage(1);
  }

  function changeStatus(
    next: StatusFilter
  ) {
    setStatus(next);
    setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setCountry("ALL");
    setStatus("ALL");
    setPage(1);
  }

  /* ========================================================
     API URL

     Server must validate:
     - page
     - pageSize
     - country
     - status
     - search

     Authorization must be checked
     independently by the API.
     ======================================================== */

  const requestUrl = useMemo(() => {
    const query =
      new URLSearchParams();

    query.set(
      "page",
      String(page)
    );

    query.set(
      "pageSize",
      String(PAGE_SIZE)
    );

    if (country !== "ALL") {
      query.set(
        "country",
        country
      );
    }

    if (status !== "ALL") {
      query.set(
        "status",
        status
      );
    }

    if (debouncedSearch) {
      query.set(
        "search",
        debouncedSearch
      );
    }

    return `${API_URL}?${query.toString()}`;
  }, [
    page,
    country,
    status,
    debouncedSearch,
  ]);

  /* ========================================================
     LOAD APPLICATIONS

     - No userId from browser
     - No fake records
     - No cached sensitive responses
     - Abort outdated requests
     ======================================================== */

  const loadApplications = useCallback(
    async (
      signal: AbortSignal,
      background: boolean
    ) => {
      if (background) {
        setRefreshing(true);
      } else {
        setState("loading");
        setData(null);
      }

      try {
        const response =
          await fetch(requestUrl, {
            method: "GET",

            credentials:
              "same-origin",

            cache: "no-store",

            headers: {
              Accept:
                "application/json",
            },

            signal,
          });

        if (
          response.status === 401 ||
          response.status === 403
        ) {
          if (signal.aborted) return;

          setData(null);
          setState("unauthorized");
          return;
        }

        if (!response.ok) {
          throw new Error(
            "APPLICATIONS_LOAD_FAILED"
          );
        }

        const raw: unknown =
          await response.json();

        const result =
          readApplicationsResponse(
            raw
          );

        if (signal.aborted) {
          return;
        }

        setData(result);
        setState("ready");
      } catch (error) {
        if (
          signal.aborted ||
          (error instanceof Error &&
            error.name === "AbortError")
        ) {
          return;
        }

        setData(null);
        setState("error");
      } finally {
        if (!signal.aborted) {
          setRefreshing(false);
        }
      }
    },
    [requestUrl]
  );

  /* ========================================================
     REQUEST ON FILTER / PAGE CHANGE
     ======================================================== */

  useEffect(() => {
    const controller =
      new AbortController();

    const timer = window.setTimeout(() => {
      void loadApplications(controller.signal, false);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    loadApplications,
    refreshKey,
  ]);

  /* ========================================================
     AUTOMATIC REFRESH

     Poll every 30 seconds while visible.

     It is polling, not instant
     WebSocket push.
     ======================================================== */

  useEffect(() => {
    const interval =
      window.setInterval(() => {
        if (!document.hidden) {
          setRefreshKey(
            (current) =>
              current + 1
          );
        }
      }, REFRESH_MS);

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, []);

  function refresh() {
    setRefreshKey(
      (current) =>
        current + 1
    );
  }

  /* ========================================================
     FILTERS
     ======================================================== */

  const hasFilters =
    search.trim() !== "" ||
    country !== "ALL" ||
    status !== "ALL";

  const inputClass =
    "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-lime-500 focus:ring-2 focus:ring-lime-500/20";

  /* ========================================================
     PAGE RENDER
     ======================================================== */

  return (
    <div
      lang={locale}
      dir={rtl ? "rtl" : "ltr"}
      className="min-w-0 px-4 py-6 text-slate-950 sm:px-6 sm:py-8 lg:px-8"
    >
      <div className="mx-auto max-w-none space-y-5">

        {/* ==========================================
           PAGE HEADER
           ========================================== */}

        <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-lime-50 px-3 py-1.5 text-xs font-extrabold text-green-800">
              <ClipboardList
                size={15}
                aria-hidden="true"
              />

              {t.eyebrow}
            </span>

            <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              {t.title}
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              {t.description}
            </p>
          </div>

          <div className="flex flex-col items-start gap-2 sm:items-end">
            <button
              type="button"
              onClick={refresh}
              disabled={
                state === "loading" ||
                refreshing
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green-800 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing ? (
                <Loader2
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <RefreshCw
                  size={17}
                />
              )}

              {refreshing
                ? t.updating
                : t.refresh}
            </button>

            <p className="text-xs text-slate-500">
              {t.autoRefresh}
            </p>
          </div>
        </header>

        {/* ==========================================
           AUTHENTICATION FAILURE
           ========================================== */}

        {state === "unauthorized" && (
          <section className="rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
            <ShieldCheck
              size={40}
              className="mx-auto text-amber-700"
              aria-hidden="true"
            />

            <h2 className="mt-4 text-lg font-extrabold">
              {t.unauthorized}
            </h2>

            <Link
              href="/admin/login"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-green-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-900"
            >
              {t.login}
            </Link>
          </section>
        )}

        {/* ==========================================
           API ERROR
           ========================================== */}

        {state === "error" && (
          <section
            role="alert"
            className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm"
          >
            <AlertCircle
              size={40}
              className="mx-auto text-red-700"
              aria-hidden="true"
            />

            <h2 className="mt-4 text-lg font-extrabold">
              {t.loadError}
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              {t.unavailable}
            </p>

            <button
              type="button"
              onClick={refresh}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-green-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-900"
            >
              <RefreshCw
                size={17}
              />

              {t.retry}
            </button>
          </section>
        )}

        {/* ==========================================
           LOADING
           ========================================== */}

        {state === "loading" && (
          <section
            role="status"
            aria-live="polite"
            className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
          >
            <Loader2
              size={36}
              className="animate-spin text-green-800"
              aria-hidden="true"
            />

            <p className="mt-4 text-sm font-semibold text-slate-600">
              {t.loading}
            </p>
          </section>
        )}

        {/* ==========================================
           REAL DATA
           ========================================== */}

        {state === "ready" && data && (
          <>
            {/* SUMMARY */}

            <section className="space-y-4">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <StatisticCard
                  title={t.total}
                  value={
                    data.stats.total
                  }
                  icon={ClipboardList}
                  tone="blue"
                  locale={locale}
                />

                <StatisticCard
                  title={t.pending}
                  value={
                    data.stats.pending
                  }
                  icon={FileClock}
                  tone="amber"
                  locale={locale}
                />

                <StatisticCard
                  title={t.approved}
                  value={
                    data.stats.approved
                  }
                  icon={CheckCircle2}
                  tone="green"
                  locale={locale}
                />

                <StatisticCard
                  title={t.rejected}
                  value={
                    data.stats.rejected
                  }
                  icon={XCircle}
                  tone="red"
                  locale={locale}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs leading-relaxed text-slate-500">
                  {t.statsNote}
                </p>

                {data.generatedAt && (
                  <p className="text-xs font-medium text-slate-500">
                    {t.lastUpdate}:{" "}
                    {formatDate(
                      data.generatedAt,
                      locale
                    )}
                  </p>
                )}
              </div>
            </section>

            {/* ======================================
               LIST AND FILTERS
               ====================================== */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

              {/* List header */}

              <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-green-800">
                    <FileSearch
                      size={23}
                      aria-hidden="true"
                    />
                  </span>

                  <div>
                    <h2 className="text-lg font-black text-slate-950 sm:text-xl">
                      {t.listTitle}
                    </h2>

                    <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">
                      {t.listDescription}
                    </p>
                  </div>
                </div>

                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">
                  <ClipboardList
                    size={15}
                    aria-hidden="true"
                  />

                  {formatNumber(
                    data.applications.total,
                    locale
                  )}{" "}
                  {t.entries}
                </span>
              </div>

              {/* Filters */}

              <div className="border-b border-slate-100 bg-slate-50/60 p-4 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_190px_210px]">

                  {/* Search */}

                  <div className="min-w-0">
                    <label
                      htmlFor="applications-search"
                      className="mb-2 block text-xs font-bold text-slate-600"
                    >
                      {t.search}
                    </label>

                    <div className="relative">
                      <Search
                        size={18}
                        className="pointer-events-none absolute inset-s-3 top-1/2 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />

                      <input
                        id="applications-search"
                        type="search"
                        maxLength={120}
                        autoComplete="off"
                        value={search}
                        onChange={(event) =>
                          setSearch(
                            event.target.value
                          )
                        }
                        placeholder={
                          t.searchPlaceholder
                        }
                        className={`${inputClass} ps-10`}
                      />
                    </div>
                  </div>

                  {/* Country */}

                  <div>
                    <label
                      htmlFor="applications-country"
                      className="mb-2 block text-xs font-bold text-slate-600"
                    >
                      {t.country}
                    </label>

                    <select
                      id="applications-country"
                      value={country}
                      onChange={(event) =>
                        changeCountry(
                          event.target.value as CountryFilter
                        )
                      }
                      className={
                        inputClass
                      }
                    >
                      <option value="ALL">
                        {t.allCountries}
                      </option>

                      {COUNTRIES.map(
                        (code) => (
                          <option
                            key={code}
                            value={code}
                          >
                            {
                              COUNTRY_FLAGS[
                                code
                              ]
                            }{" "}
                            {
                              COUNTRY_NAMES[
                                code
                              ][locale]
                            }
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  {/* Status */}

                  <div>
                    <label
                      htmlFor="applications-status"
                      className="mb-2 block text-xs font-bold text-slate-600"
                    >
                      {t.status}
                    </label>

                    <select
                      id="applications-status"
                      value={status}
                      onChange={(event) =>
                        changeStatus(
                          event.target.value as StatusFilter
                        )
                      }
                      className={
                        inputClass
                      }
                    >
                      <option value="ALL">
                        {t.allStatuses}
                      </option>

                      {(
                        [
                          "PENDING",
                          "IN_REVIEW",
                          "APPROVED",
                          "REJECTED",
                        ] as const
                      ).map((value) => (
                        <option
                          key={value}
                          value={value}
                        >
                          {
                            t[
                              STATUS_META[
                                value
                              ].key
                            ]
                          }
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <Filter
                      size={15}
                      aria-hidden="true"
                    />

                    {formatNumber(
                      data.applications.total,
                      locale
                    )}{" "}
                    {t.entries}
                  </span>

                  {hasFilters && (
                    <button
                      type="button"
                      onClick={
                        clearFilters
                      }
                      className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-green-800 hover:bg-lime-100"
                    >
                      <X size={15} />
                      {t.clearFilters}
                    </button>
                  )}
                </div>
              </div>

              {/* Results */}

              {data.applications.items.length > 0 ? (
                <>
                  {/* Desktop */}

                  <ApplicationsTable
                    items={
                      data.applications.items
                    }
                    locale={locale}
                  />

                  {/* Mobile and tablet */}

                  <div className="grid gap-3 bg-slate-50/50 p-3 sm:grid-cols-2 sm:p-4 lg:hidden">
                    {data.applications.items.map(
                      (item) => (
                        <MobileApplicationCard
                          key={item.id}
                          item={item}
                          locale={locale}
                        />
                      )
                    )}
                  </div>
                </>
              ) : (
                <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
                  <span className="flex size-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <FileSearch
                      size={32}
                      aria-hidden="true"
                    />
                  </span>

                  <h3 className="mt-5 text-base font-extrabold text-slate-900">
                    {t.noResults}
                  </h3>

                  <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                    {t.noResultsDescription}
                  </p>

                  {hasFilters && (
                    <button
                      type="button"
                      onClick={
                        clearFilters
                      }
                      className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-lime-200 bg-lime-50 px-4 py-2 text-xs font-bold text-green-800 hover:bg-lime-100"
                    >
                      <X
                        size={15}
                        aria-hidden="true"
                      />

                      {t.clearFilters}
                    </button>
                  )}
                </div>
              )}

              {/* Pagination */}

              <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p className="text-center text-xs font-semibold text-slate-500 sm:text-start">
                  {t.page}{" "}
                  {formatNumber(
                    data.applications.page,
                    locale
                  )}{" "}
                  {t.of}{" "}
                  {formatNumber(
                    data.applications.totalPages,
                    locale
                  )}
                </p>

                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    disabled={
                      page <= 1
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.max(
                            1,
                            current - 1
                          )
                      )
                    }
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft
                      size={16}
                      className={
                        rtl
                          ? "rotate-180"
                          : ""
                      }
                    />

                    {t.previous}
                  </button>

                  <button
                    type="button"
                    disabled={
                      page >=
                      data.applications.totalPages
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          current + 1
                      )
                    }
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t.next}

                    <ChevronRight
                      size={16}
                      className={
                        rtl
                          ? "rotate-180"
                          : ""
                      }
                    />
                  </button>
                </div>
              </div>
            </section>

            {/* ======================================
               SECURITY MESSAGE
               ====================================== */}

            <section className="flex items-start gap-3 rounded-2xl border border-lime-200 bg-lime-50 p-4 sm:p-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-green-800">
                <ShieldCheck
                  size={22}
                  aria-hidden="true"
                />
              </span>

              <div>
                <h3 className="text-sm font-extrabold text-green-950">
                  {t.safetyTitle}
                </h3>

                <p className="mt-2 text-xs leading-relaxed text-green-950/80 sm:text-sm">
                  {t.safetyText}
                </p>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   END — FAHRSCHULE TAYM
   ============================================================ */
