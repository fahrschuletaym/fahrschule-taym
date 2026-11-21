
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { defaultLocale, isLocale, type Locale } from "@/i18n/config";
import Image from "next/image";

const dashboardTranslations: Record<string, [string, string, string]> = {
  "Mein Dashboard": ["لوحة التحكم", "Panelim", "Mi panel"],
  "Kandidatenbereich": ["مساحة المتدرب", "Aday alanı", "Área del alumno"],
  "Dashboard aktualisieren": ["تحديث لوحة التحكم", "Paneli yenile", "Actualizar panel"],
  "Dashboard Übersicht": ["نظرة عامة", "Panele genel bakış", "Resumen del panel"],
  "Mein Antrag": ["طلبي", "Başvurum", "Mi solicitud"],
  "Kein Antrag": ["لا يوجد طلب", "Başvuru yok", "Sin solicitud"],
  "Theorie": ["النظري", "Teori", "Teoría"],
  "Noch nicht begonnen": ["لم يبدأ بعد", "Henüz başlamadı", "Aún no iniciado"],
  "Lernfortschritt": ["تقدم التعلم", "Öğrenme ilerlemesi", "Progreso de aprendizaje"],
  "Fahrstunden": ["دروس القيادة", "Sürüş dersleri", "Clases de conducción"],
  "Abgeschlossen / Gesamt": ["المكتمل / الإجمالي", "Tamamlanan / Toplam", "Completadas / Total"],
  "Nächster Termin": ["الموعد القادم", "Sonraki randevu", "Próxima cita"],
  "Kein Termin": ["لا يوجد موعد", "Randevu yok", "Sin cita"],
  "Schnellzugriff": ["الوصول السريع", "Hızlı erişim", "Acceso rápido"],
  "Führerschein beantragen": ["طلب رخصة القيادة", "Ehliyet başvurusu", "Solicitar permiso"],
  "Antrag öffnen": ["فتح الطلب", "Başvuruyu aç", "Abrir solicitud"],
  "Theorie lernen": ["تعلم النظري", "Teori çalış", "Estudiar teoría"],
  "Online-Kurs öffnen": ["فتح الدورة الإلكترونية", "Çevrimiçi kursu aç", "Abrir curso en línea"],
  "Fahrstunden ansehen": ["عرض دروس القيادة", "Sürüş derslerini gör", "Ver clases de conducción"],
  "Dokumente": ["المستندات", "Belgeler", "Documentos"],
  "Dateien verwalten": ["إدارة الملفات", "Dosyaları yönet", "Gestionar archivos"],
  "Nachrichten": ["الرسائل", "Mesajlar", "Mensajes"],
  "Nachrichten öffnen": ["فتح الرسائل", "Mesajları aç", "Abrir mensajes"],
  "Aktuelle Bearbeitungsschritte": ["مراحل المعالجة الحالية", "Güncel işlem adımları", "Etapas actuales"],
  "Anmeldung erforderlich": ["تسجيل الدخول مطلوب", "Giriş yapmanız gerekiyor", "Debes iniciar sesión"],
  "Dashboard nicht verfügbar": ["لوحة التحكم غير متاحة", "Panel kullanılamıyor", "Panel no disponible"],
  "Bitte melden Sie sich an, um Ihre persönlichen Führerscheindaten einzusehen.": ["يرجى تسجيل الدخول لعرض بيانات رخصتك.", "Ehliyet bilgilerinizi görmek için giriş yapın.", "Inicia sesión para consultar tus datos."],
  "Ihre Daten konnten gerade nicht geladen werden. Bitte versuchen Sie es erneut.": ["تعذر تحميل بياناتك. حاول مجدداً.", "Bilgileriniz yüklenemedi. Tekrar deneyin.", "No se pudieron cargar tus datos. Inténtalo de nuevo."],
  "Zur Anmeldung": ["تسجيل الدخول", "Giriş yap", "Iniciar sesión"],
  "Erneut versuchen": ["إعادة المحاولة", "Tekrar dene", "Volver a intentar"],
  "Abgeschlossen": ["مكتمل", "Tamamlandı", "Completado"],
  "Bestätigt": ["مؤكد", "Onaylandı", "Confirmado"],
  "In Bearbeitung": ["قيد المعالجة", "İşleniyor", "En curso"],
  "Ausstehend": ["قيد الانتظار", "Beklemede", "Pendiente"],
  "Geplant": ["مجدول", "Planlandı", "Programado"],
  "Entwurf": ["مسودة", "Taslak", "Borrador"],
  "Abgelehnt": ["مرفوض", "Reddedildi", "Rechazado"],
  "Abgesagt": ["ملغى", "İptal edildi", "Cancelado"],
  "Gesperrt": ["محظور", "Engellendi", "Bloqueado"],
  "Ihr Lernfortschritt": ["تقدمك في التعلم", "Öğrenme ilerlemeniz", "Tu progreso"],
  "Theorie-Lektionen": ["دروس النظري", "Teori dersleri", "Lecciones de teoría"],
  "Mein Führerscheinantrag": ["طلب رخصة القيادة", "Ehliyet başvurum", "Mi solicitud de permiso"],
  "Noch kein Antrag vorhanden": ["لا يوجد طلب بعد", "Henüz başvuru yok", "Aún no hay solicitud"],
  "Sobald Sie Ihren Führerscheinantrag stellen, können Sie den Bearbeitungsstand hier verfolgen.": ["بعد تقديم طلبك يمكنك متابعة حالته هنا.", "Başvurunuzu yaptıktan sonra durumunu buradan takip edebilirsiniz.", "Cuando presentes tu solicitud podrás seguir su estado aquí."],
  "Antrag verwalten": ["إدارة الطلب", "Başvuruyu yönet", "Gestionar solicitud"],
  "Details ansehen": ["عرض التفاصيل", "Ayrıntıları gör", "Ver detalles"],
  "Nächste Termine": ["المواعيد القادمة", "Yaklaşan randevular", "Próximas citas"],
  "Keine bevorstehenden Termine": ["لا توجد مواعيد قادمة", "Yaklaşan randevu yok", "No hay próximas citas"],
  "Ihre bestätigten und geplanten Termine erscheinen hier.": ["تظهر مواعيدك المؤكدة والمجدولة هنا.", "Onaylanan ve planlanan randevularınız burada görünür.", "Tus citas confirmadas y programadas aparecen aquí."],
  "Termine ansehen": ["عرض المواعيد", "Randevuları gör", "Ver citas"],
  "Alle Termine anzeigen": ["عرض جميع المواعيد", "Tüm randevuları gör", "Ver todas las citas"],
  "Wichtige Informationen": ["معلومات مهمة", "Önemli bilgiler", "Información importante"],
  "Meine Dokumente": ["مستنداتي", "Belgelerim", "Mis documentos"],
  "Gesamt": ["الإجمالي", "Toplam", "Total"],
  "Freigegeben": ["معتمد", "Onaylandı", "Aprobado"],
  "In Prüfung": ["قيد المراجعة", "İnceleniyor", "En revisión"],
  "Dokumente verwalten": ["إدارة المستندات", "Belgeleri yönet", "Gestionar documentos"],
  "Meine Zahlungen": ["مدفوعاتي", "Ödemelerim", "Mis pagos"],
  "Offene Zahlungen": ["المدفوعات المعلقة", "Bekleyen ödemeler", "Pagos pendientes"],
  "Noch keine Zahlungen vorhanden.": ["لا توجد مدفوعات بعد.", "Henüz ödeme yok.", "Aún no hay pagos."],
  "Zahlungen anzeigen": ["عرض المدفوعات", "Ödemeleri gör", "Ver pagos"],
  "Willkommen": ["مرحباً", "Hoş geldiniz", "Bienvenido"],
  "Verwalten Sie Ihren Führerschein, Ihre Kurse, Termine und Dokumente – alles an einem Ort.": ["أدر رخصتك ودروسك ومواعيدك ومستنداتك في مكان واحد.", "Ehliyetinizi, kurslarınızı, randevularınızı ve belgelerinizi tek yerden yönetin.", "Gestiona tu permiso, cursos, citas y documentos en un solo lugar."],
  "Konto bestätigt (E-Mail)": ["تم تأكيد الحساب بالبريد الإلكتروني", "Hesap e-posta ile doğrulandı", "Cuenta verificada por correo"],
  "Noch keine Dokumente hochgeladen": ["لم تُرفع أي مستندات بعد", "Henüz belge yüklenmedi", "Aún no se han subido documentos"],
  "Theorie noch nicht begonnen": ["لم يبدأ التعليم النظري بعد", "Teori henüz başlamadı", "La teoría aún no ha comenzado"],
  "Führerscheinantrag abgeschlossen": ["اكتمل طلب رخصة القيادة", "Ehliyet başvurusu tamamlandı", "Solicitud de permiso completada"],
  "Führerscheinverfahren noch offen": ["طلب رخصة القيادة لم يكتمل بعد", "Ehliyet başvurusu henüz tamamlanmadı", "La solicitud de permiso sigue pendiente"],
  "Land:": ["البلد:", "Ülke:", "País:"],
  "Antragsnummer:": ["رقم الطلب:", "Başvuru numarası:", "Número de solicitud:"],
  "Erstellt:": ["تاريخ الإنشاء:", "Oluşturulma:", "Creada:"],
  "Bearbeitung:": ["المعالجة:", "İşlem:", "Trámite:"],
  "E-Mail bestätigt": ["تم تأكيد البريد الإلكتروني", "E-posta doğrulandı", "Correo verificado"],
  "Kontoverifizierung ausstehend": ["التحقق من الحساب قيد الانتظار", "Hesap doğrulaması bekleniyor", "Verificación de cuenta pendiente"],
  "Noch kein Führerscheinantrag eingereicht": ["لم يُقدم طلب رخصة بعد", "Henüz ehliyet başvurusu yapılmadı", "Aún no se ha presentado ninguna solicitud"],
  "Keine freigegebenen Dokumente": ["لا توجد مستندات معتمدة", "Onaylanmış belge yok", "No hay documentos aprobados"],
  "Klasse": ["الفئة", "Sınıf", "Clase"],
  "Dokument(e) hochgeladen": ["مستندات مرفوعة", "belge yüklendi", "documentos subidos"],
  "abgeschlossen": ["مكتمل", "tamamlandı", "completado"],
  "von": ["من", "/", "de"],
  "Fahrstunden abgeschlossen": ["دروس قيادة مكتملة", "sürüş dersi tamamlandı", "clases de conducción completadas"],
  "Führerscheinantrag/Anträge vorhanden": ["طلبات رخصة قيادة", "ehliyet başvurusu mevcut", "solicitudes de permiso"],
  "Dokument(e) freigegeben": ["مستندات معتمدة", "belge onaylandı", "documentos aprobados"],
  "Dokument(e) in Prüfung": ["مستندات قيد المراجعة", "belge inceleniyor", "documentos en revisión"],
  "bevorstehende Termine": ["مواعيد قادمة", "yaklaşan randevu", "próximas citas"],
  "Aktualisiert": ["آخر تحديث", "Güncellendi", "Actualizado"],
  "Änderungen an Ihren Anträgen, Dokumenten und Terminen werden nach der Aktualisierung automatisch angezeigt.": ["تظهر التغييرات على طلباتك ومستنداتك ومواعيدك تلقائياً بعد التحديث.", "Başvurularınızdaki, belgelerinizdeki ve randevularınızdaki değişiklikler yenilemeden sonra otomatik olarak gösterilir.", "Los cambios en tus solicitudes, documentos y citas aparecen automáticamente al actualizar."],
  "Ihre Angaben werden sicher verarbeitet. Angezeigte Antragsstände, Termine und Dokumentenprüfungen stammen aus Ihrem persönlichen Konto.": ["تتم معالجة بياناتك بأمان. تأتي حالة الطلبات والمواعيد ومراجعات المستندات من حسابك الشخصي.", "Bilgileriniz güvenli şekilde işlenir. Başvuru durumları, randevular ve belge incelemeleri kişisel hesabınızdan alınır.", "Tus datos se procesan de forma segura. Los estados de solicitudes, citas y revisiones proceden de tu cuenta personal."],
};

function subscribeDashboardLocale(callback: () => void) {
  window.addEventListener("taym:language-change", callback);
  window.addEventListener("storage", callback);
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  return () => { observer.disconnect(); window.removeEventListener("taym:language-change", callback); window.removeEventListener("storage", callback); };
}

function dashboardLocale(): Locale {
  const value = document.documentElement.lang.split("-")[0];
  return isLocale(value) ? value : defaultLocale;
}

function useDashboardLocale(): Locale {
  return useSyncExternalStore(subscribeDashboardLocale, dashboardLocale, () => defaultLocale);
}

function translateDashboard(value: string, locale: Locale): string {
  if (locale === "de") return value;
  return dashboardTranslations[value]?.[locale === "ar" ? 0 : locale === "tr" ? 1 : 2] ?? value;
}
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CarFront,
  Check,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock3,
  CreditCard,
  FileCheck2,
  FileText,
  FolderOpen,
  GraduationCap,
  Info,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  UploadCloud,
} from "lucide-react";

import type {
  CandidateDashboard,
  DashboardApplication,
  DashboardUpcomingEvent,
} from "@/lib/dashboard";

/* ==========================================================
   FAHRSCHULE TAYM
   DASHBOARD CANDIDAT

   Fichier :
   src/app/(dashboard)/dashboard/page.tsx

   - Responsive mobile, tablette et PC
   - Aucun Header créé ici
   - Aucun MobileNav créé ici
   - Aucun nouveau layout
   - Aucun menu latéral supplémentaire
   - Données réelles depuis /api/dashboard
   - Session contrôlée côté serveur par l'API
   - Actualisation automatique
   - États vides et erreurs
   - Allemand : langue principale
   ========================================================== */

const API_URL = "/api/dashboard";

const REFRESH_INTERVAL = 30_000;

/*
 * Ces chemins correspondent aux sections fonctionnelles.
 * Ils doivent correspondre aux routes réelles des menus
 * déjà programmés dans Fahrschule TAYM.
 *
 * Le Dashboard ne crée aucune de ces pages.
 */
const PATHS = {
  dashboard: "/dashboard",
  application: "/dashboard/application",
  theory: "/dashboard/theory",
  practice: "/dashboard/practice",
  appointments: "/dashboard/appointments",
  documents: "/dashboard/documents",
  messages: "/dashboard/messages",
  payments: "/dashboard/payments",
} as const;

/* ==========================================================
   TYPES
   ========================================================== */

type DashboardApiResponse =
  | {
      success: true;
      data: CandidateDashboard;
    }
  | {
      success: false;
      error?: {
        code?: string;
        message?: string;
      };
    };

type LoadState =
  | "loading"
  | "success"
  | "unauthorized"
  | "error";

type StatusAppearance = {
  text: string;
  className: string;
};

type DashboardIcon = typeof ClipboardList;

/* ==========================================================
   FORMATTERS
   ========================================================== */

const dateOptions: Intl.DateTimeFormatOptions =
  {
    day: "2-digit",
    month: "short",
    year: "numeric",
  };

const dateTimeOptions: Intl.DateTimeFormatOptions =
  {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };

const timeOptions: Intl.DateTimeFormatOptions =
  {
    hour: "2-digit",
    minute: "2-digit",
  };

function currentFormatLocale(): string {
  const locale = typeof document === "undefined" ? defaultLocale : dashboardLocale();
  return { de: "de-DE", ar: "ar", tr: "tr-TR", es: "es-ES" }[locale];
}

const countryLabels: Record<string, string> = {
  DE: "Deutschland",
  AT: "Österreich",
  BE: "Belgien",
  IT: "Italien",
  ES: "Spanien",
};

const countryFlags: Record<string, string> = {
  DE: "🇩🇪",
  AT: "🇦🇹",
  BE: "🇧🇪",
  IT: "🇮🇹",
  ES: "🇪🇸",
};

function validDate(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function formatDate(
  value: string | null | undefined
): string {
  const date = validDate(value);

  return date
    ? new Intl.DateTimeFormat(currentFormatLocale(), dateOptions).format(date)
    : "–";
}

function formatDateTime(
  value: string | null | undefined
): string {
  const date = validDate(value);

  return date
    ? new Intl.DateTimeFormat(currentFormatLocale(), dateTimeOptions).format(date)
    : "–";
}

function formatTime(
  value: string | null | undefined
): string {
  const date = validDate(value);

  return date
    ? new Intl.DateTimeFormat(currentFormatLocale(), timeOptions).format(date)
    : "–";
}

function formatCountry(code: string): string {
  const region = code.toUpperCase();
  if (!/^(?:[A-Z]{2}|[0-9]{3})$/.test(region)) return code;
  return new Intl.DisplayNames([currentFormatLocale()], { type: "region" }).of(region) ?? countryLabels[region] ?? code;
}

function getCountryFlag(code: string): string {
  return countryFlags[code.toUpperCase()] ?? "🌍";
}

function clampPercent(value: number | null): number {
  if (value === null || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

function formatMoney(
  amount: string,
  currency: string
): string {
  const number = Number(amount);

  if (!Number.isFinite(number)) {
    return `${amount} ${currency}`;
  }

  try {
    return new Intl.NumberFormat(currentFormatLocale(), {
      style: "currency",
      currency,
    }).format(number);
  } catch {
    return `${amount} ${currency}`;
  }
}

/* ==========================================================
   STATUTS MÉTIER

   Les codes inconnus sont affichés proprement,
   sans inventer de validation administrative.
   ========================================================== */

function getStatusAppearance(
  status: string
): StatusAppearance {
  const normalized = status
    .toUpperCase()
    .trim();

  switch (normalized) {
    case "APPROVED":
    case "ACCEPTED":
    case "COMPLETED":
    case "PAID":
    case "SUCCESS":
      return {
        text: "Abgeschlossen",
        className:
          "bg-green-100 text-green-800",
      };

    case "CONFIRMED":
      return {
        text: "Bestätigt",
        className:
          "bg-green-100 text-green-800",
      };

    case "IN_PROGRESS":
    case "PROCESSING":
    case "UNDER_REVIEW":
    case "IN_REVIEW":
      return {
        text: "In Bearbeitung",
        className:
          "bg-amber-100 text-amber-800",
      };

    case "PENDING":
    case "SUBMITTED":
    case "PENDING_REVIEW":
    case "PENDING_PAYMENT":
      return {
        text: "Ausstehend",
        className:
          "bg-amber-100 text-amber-800",
      };

    case "SCHEDULED":
      return {
        text: "Geplant",
        className:
          "bg-sky-100 text-sky-800",
      };

    case "DRAFT":
      return {
        text: "Entwurf",
        className:
          "bg-slate-100 text-slate-700",
      };

    case "REJECTED":
    case "FAILED":
      return {
        text: "Abgelehnt",
        className:
          "bg-red-100 text-red-700",
      };

    case "CANCELLED":
    case "CANCELED":
      return {
        text: "Abgesagt",
        className:
          "bg-slate-100 text-slate-700",
      };

    case "SUSPENDED":
      return {
        text: "Gesperrt",
        className:
          "bg-red-100 text-red-700",
      };

    default:
      return {
        text: status.replaceAll("_", " "),
        className:
          "bg-slate-100 text-slate-700",
      };
  }
}

/* ==========================================================
   UI PRIMITIVES

   Aucun menu ni navigation principale ici.
   Ces composants correspondent uniquement
   au contenu du Dashboard.
   ========================================================== */

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const locale = useDashboardLocale();
  const t = (text: string) => translateDashboard(text, locale);
  const appearance = getStatusAppearance(status);

  return (
    <span
      className={[
        "inline-flex max-w-full items-center",
        "rounded-full px-2.5 py-1",
        "text-[11px] font-semibold",
        "sm:text-xs",
        appearance.className,
      ].join(" ")}
    >
      <span className="truncate">
        {t(appearance.text)}
      </span>
    </span>
  );
}

function DashboardCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "min-w-0 rounded-[20px]",
        "border border-slate-200",
        "bg-white p-4",
        "shadow-[0_5px_22px_rgba(15,23,42,0.05)]",
        "sm:p-5",
        className,
      ].join(" ")}
    >
      {children}
    </section>
  );
}

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon?: DashboardIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      {Icon ? (
        <Icon
          size={21}
          className="shrink-0 text-green-700"
          aria-hidden="true"
        />
      ) : null}

      <h2 className="text-[17px] font-extrabold leading-snug text-slate-950 sm:text-lg">
        {children}
      </h2>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon: DashboardIcon;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
      <div className="mb-3 rounded-2xl bg-white p-3 text-green-700 shadow-sm">
        <Icon size={24} aria-hidden="true" />
      </div>

      <p className="font-bold text-slate-900">
        {title}
      </p>

      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
        {description}
      </p>

      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-green-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-green-800"
        >
          {actionLabel}
          <ArrowRight size={16} />
        </Link>
      ) : null}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  tone,
  caption,
}: {
  title: string;
  value: React.ReactNode;
  icon: DashboardIcon;
  tone: "green" | "blue" | "purple" | "orange";
  caption?: string;
}) {
  const toneClasses = {
    green:
      "bg-linear-to-br from-lime-400 to-green-800 text-white",
    blue:
      "bg-linear-to-br from-sky-400 to-blue-700 text-white",
    purple:
      "bg-linear-to-br from-violet-400 to-purple-800 text-white",
    orange:
      "bg-linear-to-br from-amber-300 to-amber-600 text-white",
  };

  return (
    <div className="flex min-h-26.25 min-w-0 items-center gap-3 rounded-[18px] border border-slate-200 bg-white p-3 shadow-[0_5px_18px_rgba(15,23,42,0.05)] sm:min-h-28 sm:p-4">
      <div
        className={[
          "flex h-12 w-12 shrink-0 items-center",
          "justify-center rounded-[14px]",
          "sm:h-14 sm:w-14",
          toneClasses[tone],
        ].join(" ")}
      >
        <Icon
          size={27}
          strokeWidth={2.1}
          aria-hidden="true"
        />
      </div>

      <div className="min-w-0">
        <p className="text-xs font-bold leading-5 text-slate-700 sm:text-sm">
          {title}
        </p>

        <div className="mt-1 wrap-break-word text-lg font-black leading-tight text-green-800 sm:text-xl">
          {value}
        </div>

        {caption ? (
          <p className="mt-1 text-[11px] text-slate-500">
            {caption}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ProgressCircle({
  value,
}: {
  value: number | null;
}) {
  const locale = useDashboardLocale();
  const t = (text: string) => translateDashboard(text, locale);
  const valid = value !== null;
  const percentage = clampPercent(value);

  return (
    <div
      className="relative mx-auto grid h-36 w-36 shrink-0 place-items-center rounded-full sm:h-40 sm:w-40"
      role="img"
      aria-label={
        valid
          ? `Theoriefortschritt: ${percentage} Prozent`
          : "Noch kein Theoriefortschritt vorhanden"
      }
      style={{
        background: `conic-gradient(
          #16803d 0%,
          #78d900 ${percentage}%,
          #e2e8f0 ${percentage}%,
          #e2e8f0 100%
        )`,
      }}
    >
      <div className="absolute inset-3.5 grid place-items-center rounded-full bg-white shadow-inner">
        <div className="text-center">
          <div className="text-[35px] font-black tracking-tight text-slate-950">
            {valid ? `${percentage}%` : "–"}
          </div>
          <p className="text-[11px] font-semibold text-slate-500">
            {t("Theorie")}
          </p>
        </div>
      </div>
    </div>
  );
}

function ProgressLine({
  complete,
  label,
}: {
  complete: boolean;
  label: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      {complete ? (
        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-green-600 text-white">
          <Check size={13} strokeWidth={3} />
        </span>
      ) : (
        <Circle
          size={20}
          className="mt-0.5 shrink-0 text-slate-300"
        />
      )}

      <span className="text-[13px] leading-5 text-slate-700 sm:text-sm">
        {label}
      </span>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  subtitle,
  count,
}: {
  href: string;
  icon: DashboardIcon;
  title: string;
  subtitle: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className="group relative flex min-h-34.75 min-w-0 flex-col items-center justify-between gap-3 rounded-[18px] border border-slate-200 bg-white p-4 text-center shadow-[0_5px_18px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-lime-400 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
    >
      {count !== undefined && count > 0 ? (
        <span className="absolute right-3 top-3 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-extrabold text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}

      <Icon
        size={31}
        strokeWidth={1.9}
        className="text-green-700 transition group-hover:scale-105"
        aria-hidden="true"
      />

      <span className="text-sm font-extrabold text-slate-950">
        {title}
      </span>

      <span className="inline-flex w-full items-center justify-center gap-1 rounded-full border border-lime-400 bg-lime-50 px-2 py-2 text-[11px] font-bold text-green-800 sm:text-xs">
        {subtitle}
        <ArrowRight size={14} />
      </span>
    </Link>
  );
}

/* ==========================================================
   BANNIÈRE DE BIENVENUE

   Le nom vient de PostgreSQL.
   Aucun nom de démonstration.
   ========================================================== */

function WelcomeBanner({
  name,
}: {
  name: string;
}) {
  const locale = useDashboardLocale();
  const t = (text: string) => translateDashboard(text, locale);
  return (
    <section className="relative isolate overflow-hidden rounded-[22px] border border-lime-200 bg-linear-to-r from-[#e5f3bd] via-[#d8edb0] to-[#a1ce72] px-5 py-7 sm:px-8 sm:py-9 lg:px-10">
      <Image src="/images/imagea.jpg" alt="" fill sizes="100vw" className="-z-10 object-cover object-center" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-r from-[#e5f3bd]/95 via-[#e5f3bd]/90 to-[#e5f3bd]/55" />
      <div
        className="pointer-events-none absolute -right-8 -top-20 h-60 w-60 rounded-full bg-white/25 blur-3xl"
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute -bottom-24 right-24 h-52 w-52 rounded-full bg-green-700/10 blur-2xl"
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-155">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-green-700/15 bg-white/50 px-3 py-1 text-xs font-bold text-green-900">
          <ShieldCheck size={14} />
          Fahrschule TAYM
        </div>

        <h1 className="max-w-2xl wrap-break-word text-[29px] font-black leading-[1.12] tracking-tight text-slate-950 sm:text-4xl lg:text-[43px]">
          {t("Willkommen")},
          <span className="block">
            {name} <span aria-hidden="true">👋</span>
          </span>
        </h1>

        <p className="mt-3 max-w-lg text-sm font-medium leading-6 text-slate-800 sm:text-[15px]">
          {t("Verwalten Sie Ihren Führerschein, Ihre Kurse, Termine und Dokumente – alles an einem Ort.")}
        </p>
      </div>

    </section>
  );
}

/* ==========================================================
   CARTE PROGRESSION

   Le pourcentage affiché provient
   exclusivement du module théorique.

   Ne confond pas ce pourcentage avec
   la progression globale du permis.
   ========================================================== */

function ProgressCard({
  dashboard,
}: {
  dashboard: CandidateDashboard;
}) {
  const locale = useDashboardLocale();
  const t = (text: string) => translateDashboard(text, locale);
  const { summary, user, currentApplication } =
    dashboard;

  const accountVerified = user.emailVerified;

  const hasDocuments =
    summary.totalDocuments > 0;

  const completedTheory =
    summary.totalTheoryLessons > 0 &&
    summary.completedTheoryLessons ===
      summary.totalTheoryLessons;

  const hasPractice =
    summary.completedDrivingLessons > 0;

  const applicationCompleted =
    currentApplication?.status.toUpperCase() ===
    "COMPLETED";

  const classLabel =
    currentApplication?.licenseClass;

  return (
    <DashboardCard>
      <SectionTitle icon={GraduationCap}>
        {classLabel
          ? `${t("Ihr Lernfortschritt")} – ${t("Klasse")} ${classLabel}`
          : t("Ihr Lernfortschritt")}
      </SectionTitle>

      <div className="grid items-center gap-5 sm:grid-cols-[160px_minmax(0,1fr)]">
        <ProgressCircle
          value={summary.theoryProgressPercent}
        />

        <div className="space-y-3">
          <ProgressLine
            complete={accountVerified}
            label={t("Konto bestätigt (E-Mail)")}
          />

          <ProgressLine
            complete={hasDocuments}
            label={
              hasDocuments
                ? `${summary.totalDocuments} ${t("Dokument(e) hochgeladen")}`
                : t("Noch keine Dokumente hochgeladen")
            }
          />

          <ProgressLine
            complete={completedTheory}
            label={
              summary.theoryProgressPercent !== null
                ? `${t("Theorie")}: ${summary.theoryProgressPercent}% ${t("abgeschlossen")}`
                : t("Theorie noch nicht begonnen")
            }
          />

          <ProgressLine
            complete={hasPractice}
            label={
              `${summary.completedDrivingLessons} ${t("von")} ${summary.totalDrivingLessons} ${t("Fahrstunden abgeschlossen")}`
            }
          />

          <ProgressLine
            complete={applicationCompleted}
            label={
              applicationCompleted
                ? t("Führerscheinantrag abgeschlossen")
                : t("Führerscheinverfahren noch offen")
            }
          />
        </div>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between text-xs font-medium text-slate-500">
          <span>{t("Theorie-Lektionen")}</span>

          <span className="font-bold text-green-800">
            {summary.completedTheoryLessons} /{" "}
            {summary.totalTheoryLessons}
          </span>
        </div>

        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-linear-to-r from-green-700 to-lime-400 transition-[width] duration-500"
            style={{
              width: `${
                summary.theoryProgressPercent ?? 0
              }%`,
            }}
          />
        </div>
      </div>
    </DashboardCard>
  );
}

/* ==========================================================
   DEMANDE DE PERMIS
   ========================================================== */

function ApplicationCard({
  application,
}: {
  application: DashboardApplication | null;
}) {
  const locale = useDashboardLocale();
  const t = (text: string) => translateDashboard(text, locale);
  return (
    <DashboardCard>
      <SectionTitle icon={ClipboardList}>
        {application
          ? `${t("Mein Antrag")} – ${t("Klasse")} ${application.licenseClass}`
          : t("Mein Führerscheinantrag")}
      </SectionTitle>

      {!application ? (
        <EmptyState
          icon={FileText}
          title={t("Noch kein Antrag vorhanden")}
          description={t("Sobald Sie Ihren Führerscheinantrag stellen, können Sie den Bearbeitungsstand hier verfolgen.")}
          actionHref={PATHS.application}
          actionLabel={t("Antrag verwalten")}
        />
      ) : (
        <>
          <div className="flex items-start gap-4">
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-sky-100 to-slate-200 text-slate-600">
              <FileCheck2
                size={42}
                strokeWidth={1.4}
                aria-hidden="true"
              />
            </div>

            <dl className="min-w-0 flex-1 space-y-2 text-[13px] text-slate-700 sm:text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <dt className="font-semibold text-slate-900">
                  Status:
                </dt>
                <dd>
                  <StatusBadge
                    status={application.status}
                  />
                </dd>
              </div>

              <div className="flex flex-wrap gap-2">
                <dt className="font-semibold">
                  {t("Land:")}
                </dt>
                <dd>
                  {getCountryFlag(
                    application.countryCode
                  )}{" "}
                  {formatCountry(
                    application.countryCode
                  )}
                </dd>
              </div>

              <div className="flex flex-wrap gap-2">
                <dt className="font-semibold">
                  {t("Antragsnummer:")}
                </dt>
                <dd className="break-all font-bold text-slate-950">
                  {application.applicationNumber}
                </dd>
              </div>

              <div className="flex flex-wrap gap-2">
                <dt className="font-semibold">
                  {t("Erstellt:")}
                </dt>
                <dd>
                  {formatDate(application.createdAt)}
                </dd>
              </div>

              {application.currentStep ? (
                <div className="flex flex-wrap gap-2">
                  <dt className="font-semibold">
                    {t("Bearbeitung:")}
                  </dt>
                  <dd>
                    {application.currentStep.replaceAll(
                      "_",
                      " "
                    )}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>

          <Link
            href={PATHS.application}
            className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-green-800 to-lime-600 px-4 py-2 text-sm font-extrabold text-white transition hover:from-green-900 hover:to-green-700"
          >
            {t("Details ansehen")}
            <ArrowRight size={18} />
          </Link>
        </>
      )}
    </DashboardCard>
  );
}

/* ==========================================================
   RENDEZ-VOUS
   ========================================================== */

function getEventIcon(
  event: DashboardUpcomingEvent
) {
  return event.kind === "DRIVING_LESSON"
    ? CarFront
    : CalendarDays;
}

function getEventTitle(
  event: DashboardUpcomingEvent
): string {
  if (event.kind === "DRIVING_LESSON") {
    return `Fahrstunde – Klasse ${event.title}`;
  }

  return event.title;
}

function UpcomingAppointmentsCard({
  dashboard,
}: {
  dashboard: CandidateDashboard;
}) {
  const locale = useDashboardLocale();
  const t = (text: string) => translateDashboard(text, locale);
  const events = dashboard.upcomingEvents.slice(
    0,
    3
  );

  return (
    <DashboardCard>
      <SectionTitle icon={CalendarDays}>
        {t("Nächste Termine")}
      </SectionTitle>

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={t("Keine bevorstehenden Termine")}
          description={t("Ihre bestätigten und geplanten Termine erscheinen hier.")}
          actionHref={PATHS.appointments}
          actionLabel={t("Termine ansehen")}
        />
      ) : (
        <div className="space-y-2">
          {events.map((event) => {
            const Icon = getEventIcon(event);

            return (
              <div
                key={`${event.kind}-${event.id}`}
                className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-green-700">
                  <Icon
                    size={23}
                    aria-hidden="true"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-bold text-slate-900">
                    {getEventTitle(event)}
                  </p>

                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDateTime(
                      event.startsAt
                    )}
                  </p>

                  {event.location ? (
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {event.location}
                    </p>
                  ) : null}
                </div>

                <div className="shrink-0">
                  <StatusBadge
                    status={event.status}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Link
        href={PATHS.appointments}
        className="mt-4 flex items-center justify-end gap-2 text-sm font-extrabold text-green-800 hover:underline"
      >
        {t("Alle Termine anzeigen")}
        <ArrowRight size={17} />
      </Link>
    </DashboardCard>
  );
}

/* ==========================================================
   INFORMATIONS RÉELLES

   Informations dérivées du compte
   et des données enregistrées.

   Aucun organisme partenaire ni aucune
   approbation officielle n'est inventé.
   ========================================================== */

function ImportantInformationCard({
  dashboard,
}: {
  dashboard: CandidateDashboard;
}) {
  const locale = useDashboardLocale();
  const t = (text: string) => translateDashboard(text, locale);
  const { summary, user } = dashboard;

  const facts = [
    {
      key: "account",
      text:
        user.emailVerified
          ? t("E-Mail bestätigt")
          : t("Kontoverifizierung ausstehend"),
      ok:
        user.emailVerified,
    },
    {
      key: "applications",
      text:
        summary.totalApplications > 0
          ? `${summary.totalApplications} ${t("Führerscheinantrag/Anträge vorhanden")}`
          : t("Noch kein Führerscheinantrag eingereicht"),
      ok: summary.totalApplications > 0,
    },
    {
      key: "documents",
      text:
        summary.approvedDocuments > 0
          ? `${summary.approvedDocuments} ${t("Dokument(e) freigegeben")}`
          : summary.pendingDocuments > 0
            ? `${summary.pendingDocuments} ${t("Dokument(e) in Prüfung")}`
            : t("Keine freigegebenen Dokumente"),
      ok: summary.approvedDocuments > 0,
    },
    {
      key: "appointments",
      text:
        summary.upcomingEvents > 0
          ? `${summary.upcomingEvents} ${t("bevorstehende Termine")}`
          : t("Keine bevorstehenden Termine"),
      ok: summary.upcomingEvents > 0,
    },
  ];

  return (
    <DashboardCard>
      <SectionTitle icon={Info}>
        {t("Wichtige Informationen")}
      </SectionTitle>

      <div className="space-y-3">
        {facts.map((fact) => (
          <div
            key={fact.key}
            className="flex items-start gap-2.5"
          >
            {fact.ok ? (
              <CheckCircle2
                size={19}
                className="mt-0.5 shrink-0 text-green-700"
              />
            ) : (
              <Info
                size={19}
                className="mt-0.5 shrink-0 text-amber-600"
              />
            )}

            <span className="text-sm leading-5 text-slate-700">
              {fact.text}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl bg-lime-50 px-3 py-3 text-xs leading-5 text-green-900">
        {t("Änderungen an Ihren Anträgen, Dokumenten und Terminen werden nach der Aktualisierung automatisch angezeigt.")}
      </div>
    </DashboardCard>
  );
}

/* ==========================================================
   DÉTAILS DOCUMENTS ET PAIEMENTS

   Les données viennent exclusivement
   de PostgreSQL.
   ========================================================== */

function DocumentsAndPayments({
  dashboard,
}: {
  dashboard: CandidateDashboard;
}) {
  const locale = useDashboardLocale();
  const t = (text: string) => translateDashboard(text, locale);
  const { summary } = dashboard;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <DashboardCard>
        <SectionTitle icon={FolderOpen}>
          {t("Meine Dokumente")}
        </SectionTitle>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-slate-50 p-3 text-center">
            <p className="text-2xl font-black text-slate-900">
              {summary.totalDocuments}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {t("Gesamt")}
            </p>
          </div>

          <div className="rounded-xl bg-green-50 p-3 text-center">
            <p className="text-2xl font-black text-green-700">
              {summary.approvedDocuments}
            </p>
            <p className="mt-1 text-[11px] text-green-700">
              {t("Freigegeben")}
            </p>
          </div>

          <div className="rounded-xl bg-amber-50 p-3 text-center">
            <p className="text-2xl font-black text-amber-700">
              {summary.pendingDocuments}
            </p>
            <p className="mt-1 text-[11px] text-amber-700">
              {t("In Prüfung")}
            </p>
          </div>
        </div>

        {summary.rejectedDocuments > 0 ? (
          <p className="mt-3 text-xs font-semibold text-red-700">
            {summary.rejectedDocuments} Dokument(e)
            abgelehnt – bitte überprüfen.
          </p>
        ) : null}

        <Link
          href={PATHS.documents}
          className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-green-800 hover:underline"
        >
          {t("Dokumente verwalten")}
          <ArrowRight size={16} />
        </Link>
      </DashboardCard>

      <DashboardCard>
        <SectionTitle icon={CreditCard}>
          {t("Meine Zahlungen")}
        </SectionTitle>

        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
          <span className="text-sm text-slate-600">
            {t("Offene Zahlungen")}
          </span>

          <span className="text-xl font-black text-slate-900">
            {summary.pendingPayments}
          </span>
        </div>

        {dashboard.payments.length > 0 ? (
          <div className="mt-3 space-y-2">
            {dashboard.payments
              .slice(0, 2)
              .map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {payment.purpose}
                    </p>

                    <p className="text-xs text-slate-500">
                      {formatDate(
                        payment.createdAt
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">
                      {formatMoney(
                        payment.amount,
                        payment.currency
                      )}
                    </p>

                    <StatusBadge
                      status={payment.status}
                    />
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            {t("Noch keine Zahlungen vorhanden.")}
          </p>
        )}

        <Link
          href={PATHS.payments}
          className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-green-800 hover:underline"
        >
          {t("Zahlungen anzeigen")}
          <ArrowRight size={16} />
        </Link>
      </DashboardCard>
    </div>
  );
}

/* ==========================================================
   CHARGEMENT
   ========================================================== */

function DashboardLoading() {
  return (
    <div
      className="mx-auto w-full max-w-none animate-pulse space-y-4 px-3 pb-16 pt-4 sm:px-5 lg:px-7"
      aria-busy="true"
      aria-label="Dashboard wird geladen"
      translate="no"
      suppressHydrationWarning
    >
      <div className="h-44 rounded-[22px] bg-slate-200" />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-[18px] bg-slate-200"
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="h-80 rounded-[20px] bg-slate-200"
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-36 rounded-[18px] bg-slate-200"
          />
        ))}
      </div>
    </div>
  );
}

/* ==========================================================
   ERREUR
   ========================================================== */

function DashboardError({
  unauthorized,
  onRetry,
}: {
  unauthorized: boolean;
  onRetry: () => void;
}) {
  const locale = useDashboardLocale();
  const t = (text: string) => translateDashboard(text, locale);
  return (
    <div className="mx-auto flex min-h-[65vh] max-w-lg flex-col items-center justify-center px-5 py-12 text-center">
      <div className="mb-5 grid h-20 w-20 place-items-center rounded-3xl bg-amber-50 text-amber-700">
        {unauthorized ? (
          <LockKeyhole size={34} />
        ) : (
          <TriangleAlert size={34} />
        )}
      </div>

      <h1 className="text-2xl font-black text-slate-950">
        {unauthorized
          ? t("Anmeldung erforderlich")
          : t("Dashboard nicht verfügbar")}
      </h1>

      <p className="mt-3 text-sm leading-6 text-slate-600">
        {unauthorized
          ? t("Bitte melden Sie sich an, um Ihre persönlichen Führerscheindaten einzusehen.")
          : t("Ihre Daten konnten gerade nicht geladen werden. Bitte versuchen Sie es erneut.")}
      </p>

      {unauthorized ? (
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-green-700 px-5 py-3 text-sm font-bold text-white hover:bg-green-800"
        >
          {t("Zur Anmeldung")}
          <ArrowRight size={17} />
        </Link>
      ) : (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-green-700 px-5 py-3 text-sm font-bold text-white hover:bg-green-800"
        >
          <RefreshCw size={17} />
          {t("Erneut versuchen")}
        </button>
      )}
    </div>
  );
}

/* ==========================================================
   PAGE PRINCIPALE

   - Charge au montage
   - Rafraîchit toutes les 30 secondes
   - Rafraîchit au retour dans l'onglet
   - Évite les requêtes simultanées
   - Annule les requêtes obsolètes
   - Ne masque pas d'anciennes données
     après expiration de la session
   ========================================================== */

export default function CandidateDashboardPage() {
  const locale = useDashboardLocale();
  const t = (text: string) => translateDashboard(text, locale);
  const [dashboard, setDashboard] =
    useState<CandidateDashboard | null>(null);

  const [loadState, setLoadState] =
    useState<LoadState>("loading");

  const [refreshing, setRefreshing] =
    useState(false);

  const [updatedAt, setUpdatedAt] =
    useState<string | null>(null);

  const [refreshKey, setRefreshKey] =
    useState(0);

  const loadDashboard = useCallback(
    async (
      signal: AbortSignal
    ) => {
      try {
        const response = await fetch(API_URL, {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
          signal,
        });

        if (signal.aborted) return;

        if (
          response.status === 401 ||
          response.status === 403
        ) {
          setDashboard(null);
          setLoadState("unauthorized");
          return;
        }

        if (!response.ok) {
          throw new Error(
            `Dashboard HTTP ${response.status}`
          );
        }

        const result =
          (await response.json()) as DashboardApiResponse;

        if (signal.aborted) return;

        if (!result.success || !result.data) {
          throw new Error("Invalid dashboard response.");
        }

        setDashboard(result.data);
        setUpdatedAt(result.data.lastUpdatedAt);
        setLoadState("success");
      } catch (error) {
        if (signal.aborted) return;

        console.error(
          "[TAYM][DASHBOARD] Loading failed:",
          error instanceof Error
            ? error.message
            : "Unknown error"
        );

        // En cas d'erreur, les anciennes données
        // restent indisponibles pour éviter
        // d'afficher des informations périmées.
        setDashboard(null);
        setLoadState("error");
      } finally {
        if (!signal.aborted) {
          setRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();

    const initialLoad = window.setTimeout(() => {
      void loadDashboard(controller.signal);
    }, 0);

    const interval = window.setInterval(() => {
      if (
        document.visibilityState !== "visible"
      ) {
        return;
      }

      if (controller.signal.aborted) return;

      // Les appels périodiques sont relancés
      // via une nouvelle génération de cycle.
      setRefreshing(true);
      setRefreshKey((current) => current + 1);
    }, REFRESH_INTERVAL);

    return () => {
      window.clearTimeout(initialLoad);
      controller.abort();
      window.clearInterval(interval);
    };
  }, [loadDashboard]);

  useEffect(() => {
    if (refreshKey === 0) return;

    const controller = new AbortController();

    const initialLoad = window.setTimeout(() => {
      void loadDashboard(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(initialLoad);
      controller.abort();
    };
  }, [refreshKey, loadDashboard]);

  useEffect(() => {
    const onFocus = () => {
      if (
        document.visibilityState === "visible"
      ) {
        setRefreshing(true);
        setRefreshKey((value) => value + 1);
      }
    };

    document.addEventListener(
      "visibilitychange",
      onFocus
    );

    window.addEventListener(
      "focus",
      onFocus
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        onFocus
      );

      window.removeEventListener(
        "focus",
        onFocus
      );
    };
  }, []);

  const stats = useMemo(() => {
    if (!dashboard) return null;

    const { summary } = dashboard;

    return {
      applicationStatus:
        dashboard.currentApplication?.status ?? null,

      theory:
        summary.theoryProgressPercent,

      driving: `${summary.completedDrivingLessons} / ${summary.totalDrivingLessons}`,

      nextAppointment:
        dashboard.nextEvent?.startsAt ?? null,

      unread:
        summary.unreadMessages +
        summary.unreadNotifications,
    };
  }, [dashboard]);

  if (loadState === "loading" && !dashboard) {
    return <DashboardLoading />;
  }

  if (loadState === "unauthorized") {
    return (
      <DashboardError
        unauthorized
        onRetry={() => {
          setRefreshKey((value) => value + 1);
        }}
      />
    );
  }

  if (loadState === "error" || !dashboard || !stats) {
    return (
      <DashboardError
        unauthorized={false}
        onRetry={() => {
          setRefreshKey((value) => value + 1);
        }}
      />
    );
  }

  const displayName =
    dashboard.user.firstName ||
    dashboard.user.fullName ||
    "Willkommen";

  return (
    <div
      className="min-h-screen bg-[#f6f8f5] text-slate-950"
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      aria-label={t("Mein Dashboard")}
    >
      <div className="mx-auto w-full max-w-none space-y-4 px-3 pb-20 pt-4 sm:space-y-5 sm:px-5 sm:pb-14 lg:px-7 lg:pt-6">
        {/* ===================================================
            PETIT EN-TÊTE DE CONTENU

            Ce n'est PAS le Header du site.
            Aucun menu n'est créé ici.
           =================================================== */}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="text-lg font-black text-slate-950 sm:text-xl">
              {t("Mein Dashboard")}
            </h2>

            <span className="hidden rounded-full border border-lime-200 bg-lime-50 px-2.5 py-1 text-[11px] font-bold text-green-800 sm:inline-flex">
              {t("Kandidatenbereich")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {updatedAt ? (
              <span className="hidden text-xs text-slate-500 sm:inline">
                {t("Aktualisiert")}: {formatTime(updatedAt)}
              </span>
            ) : null}

            <button
              type="button"
              aria-label={t("Dashboard aktualisieren")}
              title={t("Dashboard aktualisieren")}
              disabled={refreshing}
              onClick={() =>
                setRefreshKey((value) => value + 1)
              }
              className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-green-800 transition hover:bg-lime-50 disabled:opacity-60"
            >
              {refreshing ? (
                <LoaderCircle
                  size={19}
                  className="animate-spin"
                />
              ) : (
                <RefreshCw size={19} />
              )}
            </button>
          </div>
        </div>

        {/* BIENVENUE */}

        <WelcomeBanner name={displayName} />

        {/* QUATRE INDICATEURS */}

        <section
          className="grid grid-cols-2 gap-3 xl:grid-cols-4"
          aria-label={t("Dashboard Übersicht")}
        >
          <StatCard
            title={t("Mein Antrag")}
            value={
              stats.applicationStatus ? (
                <span className="text-sm">
                  {t(
                    getStatusAppearance(
                      stats.applicationStatus
                    ).text
                  )}
                </span>
              ) : (
                <span className="text-sm">
                  {t("Kein Antrag")}
                </span>
              )
            }
            icon={ClipboardList}
            tone="green"
          />

          <StatCard
            title={t("Theorie")}
            value={
              stats.theory !== null
                ? `${stats.theory}%`
                : "–"
            }
            icon={GraduationCap}
            tone="green"
            caption={
              stats.theory === null
                ? t("Noch nicht begonnen")
                : t("Lernfortschritt")
            }
          />

          <StatCard
            title={t("Fahrstunden")}
            value={stats.driving}
            icon={CarFront}
            tone="blue"
            caption={t("Abgeschlossen / Gesamt")}
          />

          <StatCard
            title={t("Nächster Termin")}
            value={
              stats.nextAppointment
                ? formatDate(stats.nextAppointment)
                : "–"
            }
            icon={CalendarDays}
            tone="purple"
            caption={
              stats.nextAppointment
                ? formatTime(stats.nextAppointment)
                : t("Kein Termin")
            }
          />
        </section>

        {/* PROGRESSION + DEMANDE */}

        <div className="grid gap-4 lg:grid-cols-2">
          <ProgressCard dashboard={dashboard} />

          <ApplicationCard
            application={
              dashboard.currentApplication
            }
          />
        </div>

        {/* ACCÈS RAPIDES */}

        <section
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
          aria-label={t("Schnellzugriff")}
        >
          <QuickAction
            href={PATHS.application}
            icon={ClipboardList}
            title={t("Führerschein beantragen")}
            subtitle={t("Antrag öffnen")}
          />

          <QuickAction
            href={PATHS.theory}
            icon={BookOpen}
            title={t("Theorie lernen")}
            subtitle={t("Online-Kurs öffnen")}
          />

          <QuickAction
            href={PATHS.practice}
            icon={CarFront}
            title={t("Fahrstunden")}
            subtitle={t("Fahrstunden ansehen")}
          />

          <QuickAction
            href={PATHS.documents}
            icon={UploadCloud}
            title={t("Dokumente")}
            subtitle={t("Dateien verwalten")}
          />

          <QuickAction
            href={PATHS.messages}
            icon={MessageCircle}
            title={t("Nachrichten")}
            subtitle={t("Nachrichten öffnen")}
            count={stats.unread}
          />
        </section>

        {/* RENDEZ-VOUS + INFORMATIONS */}

        <div className="grid gap-4 lg:grid-cols-2">
          <UpcomingAppointmentsCard
            dashboard={dashboard}
          />

          <ImportantInformationCard
            dashboard={dashboard}
          />
        </div>

        {/* DOCUMENTS + PAIEMENTS */}

        <DocumentsAndPayments
          dashboard={dashboard}
        />

        {/* HISTORIQUE VISIBLE */}

        {dashboard.statusHistory.length > 0 ? (
          <DashboardCard>
            <SectionTitle icon={Clock3}>
              {t("Aktuelle Bearbeitungsschritte")}
            </SectionTitle>

            <div className="space-y-3">
              {dashboard.statusHistory
                .slice(0, 4)
                .map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lime-50 text-green-800">
                      <CheckCircle2 size={19} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <StatusBadge
                        status={event.newStatus}
                      />

                      {event.publicNote ? (
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          {event.publicNote}
                        </p>
                      ) : null}

                      <p className="mt-1 text-xs text-slate-500">
                        {formatDateTime(
                          event.createdAt
                        )}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </DashboardCard>
        ) : null}

        {/* NOTE DE TRANSPARENCE */}

        <div className="flex items-start gap-2 px-1 text-xs leading-5 text-slate-500">
          <ShieldCheck
            size={16}
            className="mt-0.5 shrink-0 text-green-700"
          />

          <p>
            {t("Ihre Angaben werden sicher verarbeitet. Angezeigte Antragsstände, Termine und Dokumentenprüfungen stammen aus Ihrem persönlichen Konto.")}
          </p>
        </div>
      </div>
    </div>
  );
}
