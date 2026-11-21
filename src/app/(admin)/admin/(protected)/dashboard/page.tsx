
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileClock,
  FileText,
  Filter,
  Loader2,
  MailCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  UserPlus,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";

/* ============================================================
   FAHRSCHULE TAYM
   ADMIN DASHBOARD

   File:
   src/app/(admin)/admin/(protected)/dashboard/page.tsx

   URL:
   /admin/dashboard

   Backend:
   GET /api/admin/dashboard

   - Real PostgreSQL-backed data only
   - No fake statistics
   - No sensitive document content
   - Filters and pagination
   - Refresh every 30 seconds
   - Four languages / Arabic RTL
   - Responsive mobile and desktop

   IMPORTANT:
   The API /api/admin/dashboard must be created
   with the response contract shown below.

   The protected layout is responsible for
   server-side admin session verification.
   The API must independently verify
   administrator authorization.
   ============================================================ */

const API_URL = "/api/admin/dashboard";
const REFRESH_INTERVAL = 30_000;
const PAGE_SIZE = 15;

type Locale = "de" | "ar" | "tr" | "es";

type Country = "DE" | "AT" | "BE" | "IT" | "ES";

type CountryFilter = Country | "ALL";

type ActivityType =
  | "APPLICATION_CREATED"
  | "APPLICATION_UPDATED"
  | "APPLICATION_APPROVED"
  | "APPLICATION_REJECTED"
  | "USER_REGISTERED"
  | "EMAIL_VERIFIED"
  | "PHONE_VERIFIED"
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_VERIFIED"
  | "RESERVATION_CREATED"
  | "OTHER";

type ActivityFilter =
  | "ALL"
  | ActivityType;

type Statistics = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};

type DashboardActivity = {
  id: string;
  type: ActivityType;
  createdAt: string;

  countryCode: Country | null;

  applicationId: string | null;

  applicationReference: string | null;

  actorName: string | null;

  description: string | null;
};

type ActivitiesResult = {
  items: DashboardActivity[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type DashboardResult = {
  stats: Statistics;
  activities: ActivitiesResult;
  generatedAt: string | null;
};

type LoadState =
  | "loading"
  | "ready"
  | "error"
  | "unauthorized";

type UiDictionary =
  (typeof TEXT)["de"];

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

const FLAGS: Record<Country, string> = {
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
   FOUR-LANGUAGE INTERFACE
   ============================================================ */

const TEXT = {
  de: {
    eyebrow: "ADMINISTRATIONSÜBERSICHT",
    title: "Dashboard",
    subtitle:
      "Führerscheinanträge und wichtige Aktivitäten der Plattform zentral überwachen.",
    total: "Alle Anträge",
    pending: "In Bearbeitung / Offen",
    approved: "Genehmigt",
    rejected: "Abgelehnt",
    activities: "Aktivitätsprotokoll",
    activitiesDescription:
      "Zentrale Übersicht wichtiger Vorgänge aus allen fünf Ländern.",
    update: "Aktualisieren",
    updating: "Wird aktualisiert",
    refreshInfo: "Automatische Aktualisierung alle 30 Sekunden",
    updatedAt: "Stand",
    country: "Land",
    allCountries: "Alle Länder",
    type: "Aktivität",
    allTypes: "Alle Aktivitäten",
    search: "Suche",
    searchPlaceholder:
      "Name, Referenz oder Ereignis suchen",
    clear: "Filter zurücksetzen",
    date: "Datum und Uhrzeit",
    event: "Ereignis",
    person: "Person / Referenz",
    action: "Aktion",
    view: "Ansehen",
    noLink: "—",
    unknown: "Nicht angegeben",
    noResults: "Keine Aktivitäten gefunden",
    noResultsDescription:
      "Für die gewählten Filter sind keine Aktivitäten vorhanden.",
    loading: "Dashboard wird geladen...",
    loadingError:
      "Die Dashboard-Daten konnten nicht geladen werden.",
    reload: "Erneut versuchen",
    sessionExpired:
      "Deine Administratorsitzung ist abgelaufen oder nicht gültig.",
    login: "Zur Anmeldung",
    previous: "Zurück",
    next: "Weiter",
    page: "Seite",
    of: "von",
    results: "Einträge",
    openApplications: "Alle Anträge ansehen",
    secure: "Geschützter Administrationsbereich",
    noSensitive:
      "Ausweisdateien, Passwörter und Bestätigungscodes werden in diesem Protokoll nicht angezeigt.",
    statsInfo:
      "Gesamtzahlen für alle Länder. Die Filter darunter betreffen das Aktivitätsprotokoll.",
    applicationCreated: "Neuer Führerscheinantrag",
    applicationUpdated: "Antrag aktualisiert",
    applicationApproved: "Antrag genehmigt",
    applicationRejected: "Antrag abgelehnt",
    userRegistered: "Neues Benutzerkonto",
    emailVerified: "E-Mail bestätigt",
    phoneVerified: "Telefonnummer bestätigt",
    documentUploaded: "Dokument eingereicht",
    documentVerified: "Dokument geprüft",
    reservationCreated: "Neue Reservierung",
    other: "Weitere Aktivität",
    allEvents: "Alle",
    loadFailure:
      "Es liegen derzeit keine verlässlich abrufbaren Daten vor.",
  },
  ar: {
    eyebrow: "نظرة عامة على الإدارة",
    title: "لوحة التحكم",
    subtitle:
      "متابعة طلبات رخص القيادة وأهم أنشطة المنصة من مكان واحد.",
    total: "جميع الطلبات",
    pending: "قيد الانتظار أو المعالجة",
    approved: "الطلبات المقبولة",
    rejected: "الطلبات المرفوضة",
    activities: "سجل الأنشطة",
    activitiesDescription:
      "عرض مركزي للعمليات المهمة من الدول الخمس.",
    update: "تحديث",
    updating: "جارٍ التحديث",
    refreshInfo: "تحديث تلقائي كل 30 ثانية",
    updatedAt: "آخر تحديث",
    country: "الدولة",
    allCountries: "جميع الدول",
    type: "نوع النشاط",
    allTypes: "جميع الأنشطة",
    search: "بحث",
    searchPlaceholder:
      "البحث بالاسم أو رقم الطلب أو الحدث",
    clear: "إعادة ضبط الفلاتر",
    date: "التاريخ والوقت",
    event: "الحدث",
    person: "الشخص / المرجع",
    action: "الإجراء",
    view: "عرض",
    noLink: "—",
    unknown: "غير محدد",
    noResults: "لا توجد أنشطة",
    noResultsDescription:
      "لا توجد أنشطة مطابقة للفلاتر المحددة.",
    loading: "جارٍ تحميل لوحة التحكم...",
    loadingError: "تعذر تحميل بيانات لوحة التحكم.",
    reload: "إعادة المحاولة",
    sessionExpired:
      "انتهت جلسة المسؤول أو لم تعد صالحة.",
    login: "تسجيل الدخول",
    previous: "السابق",
    next: "التالي",
    page: "صفحة",
    of: "من",
    results: "سجل",
    openApplications: "عرض جميع الطلبات",
    secure: "مساحة إدارة محمية",
    noSensitive:
      "لا يعرض هذا السجل وثائق الهوية أو كلمات المرور أو رموز التحقق.",
    statsInfo:
      "الإحصاءات تشمل جميع الدول، بينما الفلاتر تخص سجل الأنشطة فقط.",
    applicationCreated: "طلب رخصة جديد",
    applicationUpdated: "تحديث طلب",
    applicationApproved: "تم قبول الطلب",
    applicationRejected: "تم رفض الطلب",
    userRegistered: "إنشاء حساب جديد",
    emailVerified: "تأكيد البريد الإلكتروني",
    phoneVerified: "تأكيد رقم الهاتف",
    documentUploaded: "رفع مستند",
    documentVerified: "التحقق من مستند",
    reservationCreated: "حجز جديد",
    other: "نشاط آخر",
    allEvents: "الكل",
    loadFailure:
      "البيانات الموثوقة غير متاحة حالياً.",
  },
  tr: {
    eyebrow: "YÖNETİM GENEL BAKIŞ",
    title: "Kontrol paneli",
    subtitle:
      "Ehliyet başvurularını ve önemli platform etkinliklerini tek yerden izleyin.",
    total: "Tüm başvurular",
    pending: "Bekleyen / İşlemde",
    approved: "Onaylanan",
    rejected: "Reddedilen",
    activities: "Etkinlik günlüğü",
    activitiesDescription:
      "Beş ülkedeki önemli işlemlerin merkezi kaydı.",
    update: "Yenile",
    updating: "Güncelleniyor",
    refreshInfo: "Her 30 saniyede otomatik güncelleme",
    updatedAt: "Güncellendi",
    country: "Ülke",
    allCountries: "Tüm ülkeler",
    type: "Etkinlik türü",
    allTypes: "Tüm etkinlikler",
    search: "Ara",
    searchPlaceholder:
      "İsim, başvuru numarası veya olay ara",
    clear: "Filtreleri sıfırla",
    date: "Tarih ve saat",
    event: "Olay",
    person: "Kişi / Referans",
    action: "İşlem",
    view: "Görüntüle",
    noLink: "—",
    unknown: "Belirtilmedi",
    noResults: "Etkinlik bulunamadı",
    noResultsDescription:
      "Seçilen filtrelere uygun etkinlik yok.",
    loading: "Kontrol paneli yükleniyor...",
    loadingError:
      "Kontrol paneli verileri yüklenemedi.",
    reload: "Tekrar dene",
    sessionExpired:
      "Yönetici oturumunuz sona erdi veya geçersiz.",
    login: "Giriş yap",
    previous: "Önceki",
    next: "Sonraki",
    page: "Sayfa",
    of: "/",
    results: "Kayıt",
    openApplications: "Tüm başvuruları görüntüle",
    secure: "Korumalı yönetim alanı",
    noSensitive:
      "Kimlik belgeleri, şifreler ve doğrulama kodları günlükte gösterilmez.",
    statsInfo:
      "İstatistikler tüm ülkeleri kapsar. Aşağıdaki filtreler yalnızca etkinlik günlüğünü etkiler.",
    applicationCreated: "Yeni ehliyet başvurusu",
    applicationUpdated: "Başvuru güncellendi",
    applicationApproved: "Başvuru onaylandı",
    applicationRejected: "Başvuru reddedildi",
    userRegistered: "Yeni hesap kaydı",
    emailVerified: "E-posta doğrulandı",
    phoneVerified: "Telefon doğrulandı",
    documentUploaded: "Belge yüklendi",
    documentVerified: "Belge incelendi",
    reservationCreated: "Yeni rezervasyon",
    other: "Diğer etkinlik",
    allEvents: "Tümü",
    loadFailure:
      "Doğrulanmış veriler şu anda alınamıyor.",
  },
  es: {
    eyebrow: "RESUMEN ADMINISTRATIVO",
    title: "Panel de control",
    subtitle:
      "Supervise solicitudes de permisos y las actividades importantes de la plataforma.",
    total: "Todas las solicitudes",
    pending: "Pendientes / En revisión",
    approved: "Aprobadas",
    rejected: "Rechazadas",
    activities: "Registro de actividad",
    activitiesDescription:
      "Seguimiento centralizado de operaciones importantes en los cinco países.",
    update: "Actualizar",
    updating: "Actualizando",
    refreshInfo: "Actualización automática cada 30 segundos",
    updatedAt: "Actualizado",
    country: "País",
    allCountries: "Todos los países",
    type: "Tipo de actividad",
    allTypes: "Todas las actividades",
    search: "Buscar",
    searchPlaceholder:
      "Buscar nombre, referencia o evento",
    clear: "Restablecer filtros",
    date: "Fecha y hora",
    event: "Evento",
    person: "Persona / Referencia",
    action: "Acción",
    view: "Ver",
    noLink: "—",
    unknown: "No indicado",
    noResults: "No se encontraron actividades",
    noResultsDescription:
      "No hay actividades que coincidan con los filtros.",
    loading: "Cargando panel de control...",
    loadingError:
      "No se pudieron cargar los datos del panel.",
    reload: "Reintentar",
    sessionExpired:
      "La sesión de administrador ha caducado o no es válida.",
    login: "Iniciar sesión",
    previous: "Anterior",
    next: "Siguiente",
    page: "Página",
    of: "de",
    results: "Registros",
    openApplications: "Ver todas las solicitudes",
    secure: "Área administrativa protegida",
    noSensitive:
      "Este registro no muestra documentos de identidad, contraseñas ni códigos de verificación.",
    statsInfo:
      "Las cifras incluyen todos los países. Los filtros siguientes afectan únicamente al registro de actividad.",
    applicationCreated: "Nueva solicitud",
    applicationUpdated: "Solicitud actualizada",
    applicationApproved: "Solicitud aprobada",
    applicationRejected: "Solicitud rechazada",
    userRegistered: "Nueva cuenta",
    emailVerified: "Email verificado",
    phoneVerified: "Teléfono verificado",
    documentUploaded: "Documento recibido",
    documentVerified: "Documento revisado",
    reservationCreated: "Nueva reserva",
    other: "Otra actividad",
    allEvents: "Todos",
    loadFailure:
      "No hay datos fiables disponibles actualmente.",
  },
} as const;

/* ============================================================
   LANGUAGE
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

function getCookie(
  name: string
): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${name}=`;

  const found = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));

  if (!found) return null;

  try {
    return decodeURIComponent(
      found.slice(prefix.length)
    );
  } catch {
    return null;
  }
}

function currentLocale(): Locale {
  if (typeof window === "undefined") {
    return "de";
  }

  const fromHtml = normalizeLocale(
    document.documentElement.lang
  );

  if (fromHtml) return fromHtml;

  const fromCookie =
    normalizeLocale(getCookie("taym-locale")) ??
    normalizeLocale(getCookie("NEXT_LOCALE"));

  if (fromCookie) return fromCookie;

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
   RESPONSE VALIDATION

   No fake fallback numbers.
   Reject malformed API responses.
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

function isNonNegativeInteger(
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
    isNonNegativeInteger(value) &&
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

const ACTIVITY_TYPES = [
  "APPLICATION_CREATED",
  "APPLICATION_UPDATED",
  "APPLICATION_APPROVED",
  "APPLICATION_REJECTED",
  "USER_REGISTERED",
  "EMAIL_VERIFIED",
  "PHONE_VERIFIED",
  "DOCUMENT_UPLOADED",
  "DOCUMENT_VERIFIED",
  "RESERVATION_CREATED",
  "OTHER",
] as const;

function normalizeActivityType(
  value: unknown
): ActivityType {
  return ACTIVITY_TYPES.find(
    (item) => item === value
  ) ?? "OTHER";
}

function validDate(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}

function optionalString(
  value: unknown,
  maxLength = 500
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value !== "string" ||
    value.length > maxLength
  ) {
    throw new Error("INVALID_API_FIELD");
  }

  return value;
}

function readActivity(
  value: unknown
): DashboardActivity {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !value.id ||
    value.id.length > 150 ||
    !validDate(value.createdAt)
  ) {
    throw new Error("INVALID_ACTIVITY");
  }

  const country =
    value.countryCode === null ||
    value.countryCode === undefined
      ? null
      : isCountry(value.countryCode)
        ? value.countryCode
        : null;

  return {
    id: value.id,
    type: normalizeActivityType(value.type),
    createdAt: value.createdAt,
    countryCode: country,
    applicationId:
      optionalString(value.applicationId, 150),
    applicationReference:
      optionalString(
        value.applicationReference,
        120
      ),
    actorName:
      optionalString(value.actorName, 150),
    description:
      optionalString(value.description, 500),
  };
}

function readDashboard(
  value: unknown
): DashboardResult {
  if (
    !isRecord(value) ||
    value.success !== true ||
    !isRecord(value.stats) ||
    !isRecord(value.activities)
  ) {
    throw new Error("INVALID_DASHBOARD");
  }

  const stats = value.stats;
  const activities = value.activities;

  if (
    !isNonNegativeInteger(stats.total) ||
    !isNonNegativeInteger(stats.pending) ||
    !isNonNegativeInteger(stats.approved) ||
    !isNonNegativeInteger(stats.rejected)
  ) {
    throw new Error("INVALID_STATISTICS");
  }

  if (
    !Array.isArray(activities.items) ||
    !isPositiveInteger(activities.page) ||
    !isPositiveInteger(activities.pageSize) ||
    !isNonNegativeInteger(activities.total) ||
    !isPositiveInteger(activities.totalPages)
  ) {
    throw new Error("INVALID_ACTIVITY_PAGE");
  }

  if (activities.items.length > activities.pageSize) {
    throw new Error("INVALID_PAGE_SIZE");
  }

  if (activities.page > activities.totalPages) {
    throw new Error("INVALID_PAGE_NUMBER");
  }

  return {
    stats: {
      total: stats.total,
      pending: stats.pending,
      approved: stats.approved,
      rejected: stats.rejected,
    },

    activities: {
      items: activities.items.map(readActivity),
      page: activities.page,
      pageSize: activities.pageSize,
      total: activities.total,
      totalPages: activities.totalPages,
    },

    generatedAt:
      validDate(value.generatedAt)
        ? value.generatedAt
        : null,
  };
}

/* ============================================================
   ACTIVITY PRESENTATION
   ============================================================ */

const ACTIVITY_META: Record<
  ActivityType,
  {
    icon: LucideIcon;
    color: string;
    background: string;
    labelKey: keyof UiDictionary;
  }
> = {
  APPLICATION_CREATED: {
    icon: ClipboardList,
    color: "text-blue-700",
    background: "bg-blue-50",
    labelKey: "applicationCreated",
  },
  APPLICATION_UPDATED: {
    icon: FileText,
    color: "text-slate-700",
    background: "bg-slate-100",
    labelKey: "applicationUpdated",
  },
  APPLICATION_APPROVED: {
    icon: CheckCircle2,
    color: "text-green-800",
    background: "bg-lime-100",
    labelKey: "applicationApproved",
  },
  APPLICATION_REJECTED: {
    icon: XCircle,
    color: "text-red-700",
    background: "bg-red-50",
    labelKey: "applicationRejected",
  },
  USER_REGISTERED: {
    icon: UserPlus,
    color: "text-violet-700",
    background: "bg-violet-50",
    labelKey: "userRegistered",
  },
  EMAIL_VERIFIED: {
    icon: MailCheck,
    color: "text-green-700",
    background: "bg-green-50",
    labelKey: "emailVerified",
  },
  PHONE_VERIFIED: {
    icon: Smartphone,
    color: "text-teal-700",
    background: "bg-teal-50",
    labelKey: "phoneVerified",
  },
  DOCUMENT_UPLOADED: {
    icon: FileText,
    color: "text-blue-700",
    background: "bg-blue-50",
    labelKey: "documentUploaded",
  },
  DOCUMENT_VERIFIED: {
    icon: FileCheck2,
    color: "text-green-700",
    background: "bg-green-50",
    labelKey: "documentVerified",
  },
  RESERVATION_CREATED: {
    icon: Clock3,
    color: "text-amber-700",
    background: "bg-amber-50",
    labelKey: "reservationCreated",
  },
  OTHER: {
    icon: Activity,
    color: "text-slate-700",
    background: "bg-slate-100",
    labelKey: "other",
  },
};

/* ============================================================
   FORMATTING
   ============================================================ */

function formatNumber(
  value: number,
  locale: Locale
): string {
  const formatLocale: Record<Locale, string> = {
    de: "de-DE",
    ar: "ar",
    tr: "tr-TR",
    es: "es-ES",
  };

  return new Intl.NumberFormat(
    formatLocale[locale]
  ).format(value);
}

function formatDate(
  value: string,
  locale: Locale
): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const formatLocale: Record<Locale, string> = {
    de: "de-DE",
    ar: "ar",
    tr: "tr-TR",
    es: "es-ES",
  };

  return new Intl.DateTimeFormat(
    formatLocale[locale],
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

/* ============================================================
   STATISTIC CARD
   ============================================================ */

function StatCard({
  title,
  value,
  icon: Icon,
  accent,
  locale,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
  accent: "blue" | "amber" | "green" | "red";
  locale: Locale;
}) {
  const accents = {
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
            {formatNumber(value, locale)}
          </p>
        </div>

        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${accents[accent]}`}
        >
          <Icon size={22} aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

/* ============================================================
   ACTIVITY ITEM

   Same component used in mobile and
   desktop to prevent inconsistent data.
   ============================================================ */

function ActivityItem({
  activity,
  locale,
}: {
  activity: DashboardActivity;
  locale: Locale;
}) {
  const t = TEXT[locale];
  const rtl = locale === "ar";

  const meta = ACTIVITY_META[activity.type];
  const Icon = meta.icon;

  const detailUrl = activity.applicationId
    ? `/admin/applications/${encodeURIComponent(
        activity.applicationId
      )}`
    : null;

  return (
    <article className="grid min-w-0 gap-3 border-b border-slate-100 px-4 py-4 last:border-b-0 hover:bg-slate-50/60 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)_auto] lg:items-center">
      {/* Event */}

      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${meta.background} ${meta.color}`}
        >
          <Icon size={20} aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <p className="wrap-break-word text-sm font-bold text-slate-950">
            {t[meta.labelKey]}
          </p>

          {activity.description && (
            <p className="mt-1 wrap-break-word text-xs leading-relaxed text-slate-500">
              {activity.description}
            </p>
          )}

          <p className="mt-2 text-xs text-slate-500 lg:hidden">
            {formatDate(activity.createdAt, locale)}
          </p>
        </div>
      </div>

      {/* Candidate and reference */}

      <div className="min-w-0 ps-13 lg:ps-0">
        <p className="wrap-break-word text-sm font-semibold text-slate-800">
          {activity.actorName || t.unknown}
        </p>

        {activity.applicationReference && (
          <p
            dir="auto"
            className="mt-1 break-all text-xs text-slate-500"
          >
            {activity.applicationReference}
          </p>
        )}

        {activity.countryCode && (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            {FLAGS[activity.countryCode]}
            {
              COUNTRY_NAMES[
                activity.countryCode
              ][locale]
            }
          </span>
        )}
      </div>

      {/* Date, desktop */}

      <div className="hidden text-xs font-medium text-slate-500 lg:block">
        {formatDate(activity.createdAt, locale)}
      </div>

      {/* View dossier */}

      <div className="flex justify-end lg:justify-start">
        {detailUrl ? (
          <Link
            href={detailUrl}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-lime-200 bg-lime-50 px-3 py-2 text-xs font-bold text-green-800 transition-colors hover:bg-lime-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500"
          >
            {t.view}

            {rtl ? (
              <ArrowRight
                size={15}
                className="rotate-180"
              />
            ) : (
              <ArrowRight size={15} />
            )}
          </Link>
        ) : (
          <span className="text-sm text-slate-400">
            {t.noLink}
          </span>
        )}
      </div>
    </article>
  );
}

/* ============================================================
   MAIN PAGE
   ============================================================ */

export default function AdminDashboardPage() {
  const [locale, setLocale] =
    useState<Locale>("de");

  const [country, setCountry] =
    useState<CountryFilter>("ALL");

  const [activityType, setActivityType] =
    useState<ActivityFilter>("ALL");

  const [searchText, setSearchText] =
    useState("");

  const [debouncedSearch, setDebouncedSearch] =
    useState("");

  const [page, setPage] = useState(1);

  const [refreshKey, setRefreshKey] =
    useState(0);

  const [data, setData] =
    useState<DashboardResult | null>(null);

  const [state, setState] =
    useState<LoadState>("loading");

  const [refreshing, setRefreshing] =
    useState(false);

  const t = TEXT[locale];
  const rtl = locale === "ar";

  /* ========================================================
     LANGUAGE
     ======================================================== */

  useEffect(() => {
    const sync = (event?: Event) => {
      if (event instanceof CustomEvent) {
        const detail: unknown = event.detail;

        const next =
          normalizeLocale(
            typeof detail === "string"
              ? detail
              : isRecord(detail)
                ? detail.locale
                : null
          );

        if (next) {
          setLocale(next);
          return;
        }
      }

      setLocale(currentLocale());
    };

    sync();

    const observer = new MutationObserver(() => sync());

    observer.observe(
      document.documentElement,
      {
        attributes: true,
        attributeFilter: ["lang"],
      }
    );

    window.addEventListener(
      "taym:language-change",
      sync
    );

    window.addEventListener(
      "storage",
      sync
    );

    return () => {
      observer.disconnect();

      window.removeEventListener(
        "taym:language-change",
        sync
      );

      window.removeEventListener(
        "storage",
        sync
      );
    };
  }, []);

  /* ========================================================
     DEBOUNCE SEARCH

     Prevent unnecessary requests
     on every keystroke.
     ======================================================== */

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(1);
      setDebouncedSearch(
        searchText.trim().slice(0, 120)
      );
    }, 350);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [searchText]);

  /* ========================================================
     FILTER UPDATES

     Start from first page after
     changing filters.
     ======================================================== */

  const setCountryFilter = (
    value: CountryFilter
  ) => {
    setCountry(value);
    setPage(1);
  };

  const setTypeFilter = (
    value: ActivityFilter
  ) => {
    setActivityType(value);
    setPage(1);
  };

  const resetFilters = () => {
    setCountry("ALL");
    setActivityType("ALL");
    setSearchText("");
    setDebouncedSearch("");
    setPage(1);
  };

  /* ========================================================
     API REQUEST URL

     All filters must also be
     validated on the server.
     ======================================================== */

  const requestUrl = useMemo(() => {
    const query = new URLSearchParams();

    query.set("page", String(page));
    query.set("pageSize", String(PAGE_SIZE));

    if (country !== "ALL") {
      query.set("country", country);
    }

    if (activityType !== "ALL") {
      query.set("type", activityType);
    }

    if (debouncedSearch) {
      query.set("search", debouncedSearch);
    }

    return `${API_URL}?${query.toString()}`;
  }, [
    page,
    country,
    activityType,
    debouncedSearch,
  ]);

  /* ========================================================
     FETCH

     Credentials:
       Browser cookies are included
       only for the same origin.

     - No client supplied admin ID
     - No fake statistics
     - No silent API errors
     - Abort stale requests
     ======================================================== */

  const fetchDashboard = useCallback(
    async (
      signal: AbortSignal,
      background: boolean
    ) => {
      if (!background) {
        setState("loading");
      } else {
        setRefreshing(true);
      }

      try {
        const response = await fetch(
          requestUrl,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
            signal,
          }
        );

        if (response.status === 401 ||
            response.status === 403) {
          setData(null);
          setState("unauthorized");
          return;
        }

        if (!response.ok) {
          throw new Error(
            "DASHBOARD_REQUEST_FAILED"
          );
        }

        const json: unknown =
          await response.json();

        const parsed =
          readDashboard(json);

        if (signal.aborted) {
          return;
        }

        setData(parsed);
        setState("ready");
      } catch (error) {
        if (
          signal.aborted ||
          (error instanceof Error &&
            error.name === "AbortError")
        ) {
          return;
        }

        // Do not display old statistics as
        // if they were still current.
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
     AUTO REFRESH

     Poll the database-backed API
     every 30 seconds.

     This is polling, not WebSocket
     or instantaneous push updates.

     Stop fetching when the page
     is not visible.
     ======================================================== */

  useEffect(() => {
    const controller =
      new AbortController();

    const timer = window.setTimeout(() => {
      void fetchDashboard(controller.signal, false);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [fetchDashboard, refreshKey]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!document.hidden) {
        setRefreshKey((value) => value + 1);
      }
    }, REFRESH_INTERVAL);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  /* ========================================================
     MANUAL REFRESH
     ======================================================== */

  const refresh = () => {
    if (refreshing) return;

    setRefreshKey(
      (value) => value + 1
    );
  };

  /* ========================================================
     RENDER
     ======================================================== */

  const selectClass =
    "min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-lime-500 focus:ring-2 focus:ring-lime-500/20";

  const isInitialLoading =
    state === "loading";

  const hasFilters =
    country !== "ALL" ||
    activityType !== "ALL" ||
    searchText.trim().length > 0;

  return (
    <div
      lang={locale}
      dir={rtl ? "rtl" : "ltr"}
      className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
    >
      <div className="mx-auto max-w-none space-y-5">

        {/* ============================================
           PAGE HEADER
           ============================================ */}

        <section className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-lime-50 px-3 py-1.5 text-xs font-bold text-green-800">
              <ShieldCheck size={15} />
              {t.eyebrow}
            </span>

            <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              {t.title}
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              {t.subtitle}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <button
              type="button"
              onClick={refresh}
              disabled={
                state === "loading" ||
                refreshing
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green-800 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={17}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
                aria-hidden="true"
              />
              {refreshing
                ? t.updating
                : t.update}
            </button>

            <span className="text-xs text-slate-500">
              {t.refreshInfo}
            </span>
          </div>
        </section>

        {/* ============================================
           UNAUTHORIZED
           ============================================ */}

        {state === "unauthorized" && (
          <section className="rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
            <AlertCircle
              size={38}
              className="mx-auto text-amber-700"
              aria-hidden="true"
            />

            <p className="mt-4 text-sm font-semibold text-slate-800">
              {t.sessionExpired}
            </p>

            <Link
              href="/admin/login"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-green-800 px-5 py-2.5 text-sm font-bold text-white"
            >
              {t.login}
            </Link>
          </section>
        )}

        {/* ============================================
           ERROR
           ============================================ */}

        {state === "error" && (
          <section
            role="alert"
            className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm"
          >
            <AlertCircle
              size={38}
              className="mx-auto text-red-700"
              aria-hidden="true"
            />

            <h2 className="mt-4 text-lg font-extrabold text-slate-900">
              {t.loadingError}
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              {t.loadFailure}
            </p>

            <button
              type="button"
              onClick={refresh}
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-green-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-900"
            >
              <RefreshCw size={17} />
              {t.reload}
            </button>
          </section>
        )}

        {/* ============================================
           LOADING
           ============================================ */}

        {isInitialLoading && (
          <section
            role="status"
            aria-live="polite"
            className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
          >
            <Loader2
              size={34}
              className="animate-spin text-green-800"
              aria-hidden="true"
            />

            <p className="mt-4 text-sm font-semibold text-slate-600">
              {t.loading}
            </p>
          </section>
        )}

        {/* ============================================
           REAL DASHBOARD DATA
           ============================================ */}

        {state === "ready" && data && (
          <>
            {/* STATISTICS */}

            <section className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  title={t.total}
                  value={data.stats.total}
                  icon={ClipboardList}
                  accent="blue"
                  locale={locale}
                />

                <StatCard
                  title={t.pending}
                  value={data.stats.pending}
                  icon={FileClock}
                  accent="amber"
                  locale={locale}
                />

                <StatCard
                  title={t.approved}
                  value={data.stats.approved}
                  icon={FileCheck2}
                  accent="green"
                  locale={locale}
                />

                <StatCard
                  title={t.rejected}
                  value={data.stats.rejected}
                  icon={XCircle}
                  accent="red"
                  locale={locale}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs leading-relaxed text-slate-500">
                  {t.statsInfo}
                </p>

                {data.generatedAt && (
                  <p className="text-xs font-medium text-slate-500">
                    {t.updatedAt}:{" "}
                    {formatDate(
                      data.generatedAt,
                      locale
                    )}
                  </p>
                )}
              </div>
            </section>

            {/* ACTIVITY LOG */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {/* Header */}

              <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-green-800">
                    <Activity size={22} />
                  </span>

                  <div className="min-w-0">
                    <h2 className="text-lg font-black text-slate-950 sm:text-xl">
                      {t.activities}
                    </h2>

                    <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">
                      {t.activitiesDescription}
                    </p>
                  </div>
                </div>

                <Link
                  href="/admin/applications"
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-lime-200 bg-lime-50 px-4 py-2.5 text-xs font-bold text-green-800 hover:bg-lime-100"
                >
                  {t.openApplications}
                  <ArrowRight
                    size={16}
                    className={
                      rtl ? "rotate-180" : ""
                    }
                  />
                </Link>
              </div>

              {/* Filters */}

              <div className="border-b border-slate-100 bg-slate-50/70 p-4 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_190px_220px]">

                  {/* Search */}

                  <div className="min-w-0">
                    <label
                      htmlFor="admin-log-search"
                      className="mb-2 block text-xs font-bold text-slate-600"
                    >
                      {t.search}
                    </label>

                    <div className="relative">
                      <Search
                        size={17}
                        className="pointer-events-none absolute inset-s-3 top-1/2 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />

                      <input
                        id="admin-log-search"
                        type="search"
                        maxLength={120}
                        value={searchText}
                        onChange={(event) => {
                          setSearchText(
                            event.target.value
                          );
                        }}
                        placeholder={t.searchPlaceholder}
                        className={`${selectClass} ps-10`}
                      />
                    </div>
                  </div>

                  {/* Country */}

                  <div>
                    <label
                      htmlFor="admin-log-country"
                      className="mb-2 block text-xs font-bold text-slate-600"
                    >
                      {t.country}
                    </label>

                    <select
                      id="admin-log-country"
                      value={country}
                      onChange={(event) =>
                        setCountryFilter(
                          event.target.value as CountryFilter
                        )
                      }
                      className={selectClass}
                    >
                      <option value="ALL">
                        {t.allCountries}
                      </option>

                      {COUNTRIES.map((code) => (
                        <option
                          key={code}
                          value={code}
                        >
                          {FLAGS[code]}{" "}
                          {COUNTRY_NAMES[code][locale]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Activity type */}

                  <div>
                    <label
                      htmlFor="admin-log-type"
                      className="mb-2 block text-xs font-bold text-slate-600"
                    >
                      {t.type}
                    </label>

                    <select
                      id="admin-log-type"
                      value={activityType}
                      onChange={(event) =>
                        setTypeFilter(
                          event.target.value as ActivityFilter
                        )
                      }
                      className={selectClass}
                    >
                      <option value="ALL">
                        {t.allTypes}
                      </option>

                      {ACTIVITY_TYPES.map((type) => (
                        <option
                          key={type}
                          value={type}
                        >
                          {
                            t[
                              ACTIVITY_META[type].labelKey
                            ]
                          }
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Filter summary */}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <Filter
                      size={15}
                      aria-hidden="true"
                    />

                    {formatNumber(
                      data.activities.total,
                      locale
                    )}{" "}
                    {t.results}
                  </span>

                  {hasFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-green-800 transition-colors hover:bg-lime-100"
                    >
                      <X
                        size={15}
                        aria-hidden="true"
                      />
                      {t.clear}
                    </button>
                  )}
                </div>
              </div>

              {/* Desktop column labels */}

              <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)_auto] gap-3 border-b border-slate-100 bg-white px-6 py-3 text-[11px] font-extrabold uppercase tracking-wide text-slate-500 lg:grid">
                <span>{t.event}</span>
                <span>{t.person}</span>
                <span>{t.date}</span>
                <span>{t.action}</span>
              </div>

              {/* Activities */}

              {data.activities.items.length > 0 ? (
                <div>
                  {data.activities.items.map(
                    (activity) => (
                      <ActivityItem
                        key={activity.id}
                        activity={activity}
                        locale={locale}
                      />
                    )
                  )}
                </div>
              ) : (
                <div className="flex min-h-56 flex-col items-center justify-center p-8 text-center">
                  <span className="flex size-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <Activity
                      size={28}
                      aria-hidden="true"
                    />
                  </span>

                  <h3 className="mt-4 text-base font-extrabold text-slate-900">
                    {t.noResults}
                  </h3>

                  <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                    {t.noResultsDescription}
                  </p>
                </div>
              )}

              {/* Pagination */}

              <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <span className="text-center text-xs font-semibold text-slate-500 sm:text-start">
                  {t.page}{" "}
                  {formatNumber(
                    data.activities.page,
                    locale
                  )}{" "}
                  {t.of}{" "}
                  {formatNumber(
                    data.activities.totalPages,
                    locale
                  )}
                </span>

                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    disabled={
                      page <= 1
                    }
                    onClick={() => {
                      setPage((value) =>
                        Math.max(1, value - 1)
                      );
                    }}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft
                      size={16}
                      className={
                        rtl ? "rotate-180" : ""
                      }
                    />
                    {t.previous}
                  </button>

                  <button
                    type="button"
                    disabled={
                      page >=
                      data.activities.totalPages
                    }
                    onClick={() => {
                      setPage((value) =>
                        value + 1
                      );
                    }}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t.next}
                    <ChevronRight
                      size={16}
                      className={
                        rtl ? "rotate-180" : ""
                      }
                    />
                  </button>
                </div>
              </div>
            </section>

            {/* Security note */}

            <section className="flex items-start gap-3 rounded-2xl border border-lime-200 bg-lime-50 p-4 sm:p-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-green-800">
                <ShieldCheck
                  size={21}
                  aria-hidden="true"
                />
              </span>

              <div className="min-w-0">
                <h3 className="text-sm font-extrabold text-green-950">
                  {t.secure}
                </h3>

                <p className="mt-1 text-xs leading-relaxed text-green-950/80 sm:text-sm">
                  {t.noSensitive}
                </p>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
