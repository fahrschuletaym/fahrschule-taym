
"use client";

import {
  createElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
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
  CircleAlert,
  ClipboardList,
  Clock3,
  CreditCard,
  Download,
  Eye,
  FileCheck2,
  FileText,
  FolderOpen,
  ImageIcon,
  Info,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Signature,
  Trash2,
  Truck,
  UploadCloud,
  UserRound,
  Wallet,
} from "lucide-react";

/* ============================================================
   FAHRSCHULE TAYM

   File:
   src/app/(dashboard)/dashboard/application/page.tsx

   Countries:
   DE | AT | BE | IT | ES

   Languages:
   DE | AR | TR | ES

   Responsive:
   Desktop | Tablet | Mobile

   Existing dashboard navigation remains unchanged.

   Real API connections:
   GET    /api/dashboard/application
   POST   /api/dashboard/application
   PATCH  /api/dashboard/application
   POST   /api/dashboard/application/documents
   DELETE /api/dashboard/application/documents
   GET    /api/dashboard/application/documents/[id]
   POST   /api/dashboard/application/submit
   ============================================================ */

/* ============================================================
   1. CONFIGURATION
   ============================================================ */

const API = {
  application: "/api/dashboard/application",
  documents: "/api/dashboard/application/documents",
  submit: "/api/dashboard/application/submit",
} as const;

const ROUTES = {
  dashboard: "/dashboard",
  login: "/login",
} as const;

const LANGUAGE_COOKIE = "taym-locale";
const LANGUAGE_STORAGE = "taym-locale";
const LANGUAGE_EVENT = "taym:language-change";

const REQUEST_TIMEOUT_MS = 120_000;

const LOCALES = [
  "de",
  "ar",
  "tr",
  "es",
] as const;

const FLAGS: Record<Country, string> = {
  DE: "🇩🇪",
  AT: "🇦🇹",
  BE: "🇧🇪",
  IT: "🇮🇹",
  ES: "🇪🇸",
};

const FORMAT_LOCALES: Record<Locale, string> = {
  de: "de-DE",
  ar: "ar",
  tr: "tr-TR",
  es: "es-ES",
};

const CORE_DOCUMENT_TYPES = [
  "IDENTITY_FRONT",
  "IDENTITY_BACK",
  "ADDRESS_PROOF",
  "SIGNATURE",
  "PASSPORT_PHOTO",
] as const;

/* ============================================================
   2. TYPES
   ============================================================ */

type Locale = (typeof LOCALES)[number];

type Country = "DE" | "AT" | "BE" | "IT" | "ES";

type SectionNumber = 1 | 2 | 3 | 4;

type CoreDocumentType =
  (typeof CORE_DOCUMENT_TYPES)[number];

type DocumentType =
  | CoreDocumentType
  | "EXISTING_DRIVING_LICENSE"
  | "MEDICAL_CERTIFICATE"
  | "VISION_TEST"
  | "FIRST_AID_CERTIFICATE"
  | "RESIDENCE_PERMIT"
  | "OTHER";

type ApplicationForm = {
  category: string;
  residentialAddress: string;
  postalCode: string;
  city: string;
  confirmedInformation: boolean;
  acceptedDocumentProcessing: boolean;
};

type Pricing = {
  currency: "EUR";
  trainingPriceCents: number | null;
  registrationFeeCents: number | null;
  totalPriceCents: number | null;
  pricingVersion: string;

  formatted?: {
    trainingPrice: string | null;
    registrationFee: string | null;
    totalPrice: string | null;
  };
};

type LicenseCategory = Pricing & {
  category: string;
  name: string;
  description: string;
  imagePath: string | null;
  minimumAge: number | null;
  enabled: boolean;
  pricingApproved: boolean;
  canSubmit: boolean;
};

type Candidate = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phoneE164: string;
  countryCode: Country;
  countryName: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  personalInformationReadOnly: boolean;
};

type ApplicationDocument = {
  id: string;
  applicationId: string;
  type: DocumentType;
  label: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;

  uploadStatus:
    | "UPLOADING"
    | "UPLOADED"
    | "FAILED"
    | "DELETED";

  securityStatus:
    | "PENDING"
    | "CLEAN"
    | "REJECTED";

  reviewStatus:
    | "PENDING"
    | "APPROVED"
    | "REJECTED";

  ready: boolean;
  previewUrl: string | null;
  downloadUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type RequiredDocument = {
  type: DocumentType;
  label: string;
  required: boolean;
  allowedMimeTypes: string[];
  maxSizeBytes: number;
  accept: string;
  uploaded: boolean;
  ready: boolean;
  document: ApplicationDocument | null;
};

type ApplicationRecord = {
  id: string;
  reference: string | null;
  status: string;
  statusLabel: string;
  countryCode: Country;
  category: string | null;
  residentialAddress: string | null;
  postalCode: string | null;
  city: string | null;
  confirmedInformation: boolean;
  acceptedDocumentProcessing: boolean;
  pricing: Pricing | null;
  admissionReviewRequired: boolean;

  admissionReviewIssues: {
    code: string;
    documentType?: DocumentType;
    message: string;
  }[];

  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  revision: number;
};

type ApplicationPageData = {
  locale: Locale;
  direction: "ltr" | "rtl";
  candidate: Candidate;

  country: {
    code: Country;
    name: string;
    currency: "EUR";
    registrationFeeCents: number | null;
    formattedRegistrationFee: string | null;

    postalCode: {
      length: number;
      example: string;
    };

    categories: LicenseCategory[];
  };

  application: ApplicationRecord | null;

  form: ApplicationForm;

  selectedCategory: LicenseCategory | null;

  pricing: Pricing | null;

  documents: ApplicationDocument[];

  requiredDocuments: RequiredDocument[];

  progress: {
    personalInformationComplete: boolean;
    formComplete: boolean;
    documentsComplete: boolean;
    confirmationsComplete: boolean;
    pricingAvailable: boolean;
    requiredDocumentCount: number;
    uploadedDocumentCount: number;
    readyDocumentCount: number;
    completedSections: number;
    totalSections: number;
    percentage: number;
  };

  permissions: {
    canEdit: boolean;
    canSaveDraft: boolean;
    canUploadDocuments: boolean;
    canDeleteDocuments: boolean;
    canAttemptSubmission: boolean;
  };

  lastUpdatedAt: string;

  saved?: boolean;
  created?: boolean;
  message?: string;
};

type SubmissionResult = {
  application: {
    id: string;
    reference: string;
    status: string;
    countryCode: Country;
    category: string;
    submittedAt: string;
    documentCount: number;
    alreadySubmitted: boolean;
    admissionReviewRequired: boolean;
  };

  pricing: Pricing;

  emails: {
    candidate: "ACCEPTED" | "PENDING" | "FAILED";
    administrator: "ACCEPTED" | "PENDING" | "FAILED";
  };

  message: string;
  applicationPath: string;
  redirectTo: string;
};

type UploadResult = {
  document: ApplicationDocument;
  replaced: boolean;
  message: string;
};

type DeleteResult = {
  documentId: string;
  applicationId: string;
  documentType: DocumentType;
  deleted: true;
  message: string;
};

type ValidationIssue = {
  code: string;
  field?: string;
  message: string;
};

type ApiResponse<T> =
  | {
      success: true;
      data: T;
      timestamp: string;
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
        issues?: ValidationIssue[];
        retryAfter?: number;
      };
      timestamp: string;
    };

type BusyAction =
  | "LOAD"
  | "SAVE"
  | "SUBMIT"
  | "REFRESH"
  | `UPLOAD:${string}`
  | `DELETE:${string}`
  | null;

/* ============================================================
   3. INITIAL FORM
   ============================================================ */

const EMPTY_FORM: ApplicationForm = {
  category: "",
  residentialAddress: "",
  postalCode: "",
  city: "",
  confirmedInformation: false,
  acceptedDocumentProcessing: false,
};

/* ============================================================
   4. MULTILINGUAL TRANSLATIONS
   ============================================================ */

const TEXT = {
  /* ========================================================
     GERMAN — DEFAULT LANGUAGE
     ======================================================== */

  de: {
    title: "Führerscheinantrag",
    subtitle:
      "Stellen Sie Ihren Antrag schnell und sicher online.",

    personal: "Persönliche Daten",
    personalDescription:
      "Diese Angaben werden automatisch aus Ihrem Konto übernommen.",
    automatic: "Automatisch aus Ihrem Konto übernommen",

    firstName: "Vorname",
    lastName: "Nachname",
    email: "E-Mail-Adresse",
    phone: "Telefonnummer",
    country: "Land",

    categoryAddress: "Führerscheinklasse & Adresse",
    categoryDescription:
      "Wählen Sie Ihre gewünschte Führerscheinklasse und geben Sie Ihre aktuelle Wohnadresse an.",

    category: "Führerscheinklasse",
    selected: "Ausgewählt",
    moreCategories: "Weitere Klassen",
    fewerCategories: "Weniger Klassen",

    residentialAddress: "Wohnadresse",
    addressPlaceholder: "Straße und Hausnummer",
    postalCode: "Postleitzahl",
    city: "Stadt",
    cityPlaceholder: "Ihre Stadt",

    trainingPrice: "Ausbildungspreis",
    registrationFee: "Anmelde- und Bearbeitungsgebühr",
    total: "Gesamtbetrag",

    estimatedPrice: "Vorläufiger Preis",
    pricePending: "Preis noch nicht bestätigt",

    feeNotice:
      "Die Anmelde- und Bearbeitungsgebühr ist eine separate Servicegebühr von TAYM.",

    externalFees:
      "Nicht ausdrücklich enthaltene Fahrstunden, Prüfungen und behördliche Gebühren können zusätzliche Kosten verursachen.",

    age: "Reguläres Mindestalter",
    years: "Jahre",

    documents: "Dokumente hochladen",
    documentDescription:
      "Laden Sie die erforderlichen Unterlagen vollständig und gut lesbar hoch.",

    identityFront: "Ausweisdokument Vorderseite",
    identityBack: "Ausweisdokument Rückseite",
    addressProof: "Wohnsitznachweis",
    signature: "Unterschrift",
    passportPhoto: "Biometrisches Passfoto",

    identityFrontHint:
      "Vorderseite Ihres gültigen Ausweisdokuments.",
    identityBackHint:
      "Rückseite Ihres gültigen Ausweisdokuments.",
    addressProofHint:
      "Aktuelle Rechnung oder Kontoauszug mit Ihrem Namen und Ihrer Wohnadresse. Nicht benötigte Finanzdaten können geschwärzt werden.",
    signatureHint:
      "Gut lesbares Foto Ihrer handschriftlichen Unterschrift.",
    passportPhotoHint:
      "Aktuelles, klares biometrisches Passfoto.",

    upload: "Datei auswählen",
    replace: "Datei ersetzen",
    preview: "Ansehen",
    download: "Herunterladen",
    remove: "Entfernen",

    removeQuestion:
      "Möchten Sie dieses Dokument wirklich entfernen?",

    missing: "Nicht hochgeladen",
    uploaded: "Hochgeladen",
    ready: "Sicherheitsprüfung abgeschlossen",
    pending: "Prüfung ausstehend",
    rejected: "Dokument abgelehnt",
    failed: "Fehlgeschlagen",

    uploadHints: "Hinweise zum Upload",
    allowedFormats: "Erlaubte Dateiformate",
    maxPerFile: "Maximale Dateigröße pro Datei",
    readable: "Klare, gut lesbare Scans oder Fotos",
    protected: "Geschützte Dokumentenspeicherung",

    confirmation: "Bestätigung",
    confirmationDescription:
      "Überprüfen Sie Ihre Angaben vor dem Absenden.",

    confirmInformation:
      "Ich bestätige, dass meine Angaben korrekt sind.",

    acceptProcessing:
      "Ich bestätige die Verarbeitung meiner Unterlagen zur Bearbeitung dieses Antrags gemäß den Datenschutzhinweisen.",

    legalNotice:
      "Dieser Antrag ersetzt keine vorgeschriebenen Prüfungen und garantiert keine behördliche Fahrerlaubnis.",

    saveDraft: "Entwurf speichern",
    submit: "Antrag absenden",
    submitting: "Antrag wird gesendet",
    saving: "Wird gespeichert",
    uploading: "Wird hochgeladen",
    deleting: "Wird entfernt",

    draftSaved: "Ihr Entwurf wurde gespeichert.",
    unsaved: "Nicht gespeicherte Änderungen",
    saved: "Gespeichert",

    loading: "Ihre Daten werden geladen...",
    retry: "Erneut versuchen",
    refresh: "Aktualisieren",
    back: "Zurück zum Dashboard",

    loginRequired:
      "Bitte melden Sie sich an, um Ihren Antrag zu bearbeiten.",
    login: "Anmelden",

    networkError:
      "Die Verbindung konnte nicht hergestellt werden. Bitte versuchen Sie es erneut.",

    unexpectedError:
      "Ein unerwarteter Fehler ist aufgetreten.",

    invalidFile: "Bitte wählen Sie ein unterstütztes Dateiformat.",
    fileTooLarge: "Die Datei überschreitet die erlaubte Dateigröße.",
    emptyFile: "Die ausgewählte Datei ist leer.",

    categoryRequired: "Bitte wählen Sie eine Führerscheinklasse.",
    addressRequired: "Bitte geben Sie Ihre Wohnadresse ein.",
    postalRequired: "Bitte geben Sie eine gültige Postleitzahl ein.",
    cityRequired: "Bitte geben Sie Ihre Stadt ein.",
    documentsRequired:
      "Bitte laden Sie alle erforderlichen Dokumente hoch und warten Sie auf die Sicherheitsprüfung.",
    confirmationsRequired:
      "Bitte bestätigen Sie beide Angaben.",

    priceUnavailable:
      "Der Tarif muss vor dem Absenden bestätigt werden.",

    conflict:
      "Ihr Antrag wurde geändert. Bitte laden Sie die aktuellen Daten neu.",

    reloadQuestion:
      "Nicht gespeicherte Änderungen verwerfen und aktuelle Daten laden?",

    submittedTitle: "Ihr Antrag wurde erfolgreich eingereicht",

    submittedDescription:
      "Wir haben Ihren Antrag erhalten. Unser Team wird Ihre Angaben und Unterlagen prüfen.",

    reference: "Antragsnummer",
    submittedAt: "Eingereicht am",
    status: "Status",

    emailAccepted:
      "Ihre Bestätigungs-E-Mail wurde zum Versand angenommen.",

    emailPending:
      "Die Bestätigungs-E-Mail wird noch verarbeitet.",

    emailFailed:
      "Die E-Mail-Bestätigung konnte noch nicht versendet werden. Ihr Antrag bleibt gespeichert.",

    reviewRequired:
      "Die Zulassungsvoraussetzungen werden individuell geprüft.",

    readOnly:
      "Dieser Antrag wurde bereits eingereicht und kann nicht mehr direkt geändert werden.",

    verified: "Verifiziert",
    secure: "Sichere Antragstellung",
    complete: "Abgeschlossen",

    stepPersonal: "Persönliche Daten",
    stepCategory: "Klasse & Adresse",
    stepDocuments: "Dokumente",
    stepConfirmation: "Prüfen & Absenden",

    lastSaved: "Zuletzt gespeichert",
    noCategories: "Derzeit sind keine Klassen verfügbar.",
    documentLimit: "Dokumente bereit",
  },

  /* ========================================================
     ARABIC — RTL
     ======================================================== */

  ar: {
    title: "طلب رخصة القيادة",
    subtitle: "قدم طلبك بسرعة وأمان عبر الإنترنت.",

    personal: "البيانات الشخصية",
    personalDescription:
      "يتم استرداد هذه البيانات تلقائياً من حسابك.",
    automatic: "تم الاسترداد تلقائياً من حسابك",

    firstName: "الاسم الأول",
    lastName: "اسم العائلة",
    email: "البريد الإلكتروني",
    phone: "رقم الهاتف",
    country: "الدولة",

    categoryAddress: "فئة الرخصة وعنوان الإقامة",
    categoryDescription:
      "اختر فئة رخصة القيادة المطلوبة وأدخل عنوان إقامتك الحالي.",

    category: "فئة رخصة القيادة",
    selected: "تم الاختيار",
    moreCategories: "فئات أخرى",
    fewerCategories: "عرض أقل",

    residentialAddress: "عنوان الإقامة",
    addressPlaceholder: "اسم الشارع ورقم المنزل",
    postalCode: "الرمز البريدي",
    city: "المدينة",
    cityPlaceholder: "مدينتك",

    trainingPrice: "سعر التدريب",
    registrationFee: "رسوم التسجيل ومعالجة الملف",
    total: "المبلغ الإجمالي",

    estimatedPrice: "سعر تقديري",
    pricePending: "لم يتم تأكيد السعر بعد",

    feeNotice:
      "رسوم التسجيل ومعالجة الملف هي رسوم خدمة منفصلة لدى TAYM.",

    externalFees:
      "قد تترتب تكاليف إضافية للدروس والاختبارات والرسوم الحكومية غير المشمولة صراحة.",

    age: "الحد الأدنى المعتاد للعمر",
    years: "سنة",

    documents: "رفع المستندات",
    documentDescription:
      "يرجى رفع جميع المستندات المطلوبة بشكل واضح وكامل.",

    identityFront: "الوجه الأمامي لوثيقة الهوية",
    identityBack: "الوجه الخلفي لوثيقة الهوية",
    addressProof: "إثبات عنوان الإقامة",
    signature: "التوقيع",
    passportPhoto: "صورة شخصية بيومترية",

    identityFrontHint:
      "الوجه الأمامي لوثيقة هوية سارية.",
    identityBackHint:
      "الوجه الخلفي لوثيقة هوية سارية.",
    addressProofHint:
      "فاتورة حديثة أو كشف حساب يحتوي على اسمك وعنوانك. يمكنك إخفاء البيانات المالية غير المطلوبة.",
    signatureHint:
      "صورة واضحة لتوقيعك بخط اليد.",
    passportPhotoHint:
      "صورة شخصية بيومترية حديثة وواضحة.",

    upload: "اختيار ملف",
    replace: "استبدال الملف",
    preview: "عرض",
    download: "تنزيل",
    remove: "حذف",

    removeQuestion: "هل تريد حقاً حذف هذا المستند؟",

    missing: "لم يتم الرفع",
    uploaded: "تم الرفع",
    ready: "اكتمل فحص الأمان",
    pending: "قيد الفحص",
    rejected: "تم رفض المستند",
    failed: "فشل",

    uploadHints: "تعليمات رفع المستندات",
    allowedFormats: "صيغ الملفات المسموح بها",
    maxPerFile: "الحد الأقصى لحجم كل ملف",
    readable: "صور أو نسخ واضحة وقابلة للقراءة",
    protected: "تخزين محمي للمستندات",

    confirmation: "التأكيد",
    confirmationDescription:
      "راجع بياناتك قبل إرسال الطلب.",

    confirmInformation:
      "أؤكد أن جميع البيانات التي قدمتها صحيحة.",

    acceptProcessing:
      "أؤكد معالجة مستنداتي لغرض دراسة هذا الطلب وفقاً لإشعار الخصوصية.",

    legalNotice:
      "هذا الطلب لا يحل محل الاختبارات الإلزامية ولا يضمن إصدار رخصة قيادة رسمية.",

    saveDraft: "حفظ المسودة",
    submit: "إرسال الطلب",
    submitting: "جارٍ إرسال الطلب",
    saving: "جارٍ الحفظ",
    uploading: "جارٍ الرفع",
    deleting: "جارٍ الحذف",

    draftSaved: "تم حفظ مسودة طلبك.",
    unsaved: "تغييرات غير محفوظة",
    saved: "تم الحفظ",

    loading: "جارٍ تحميل بياناتك...",
    retry: "إعادة المحاولة",
    refresh: "تحديث",
    back: "العودة إلى لوحة التحكم",

    loginRequired:
      "يرجى تسجيل الدخول للوصول إلى طلبك.",
    login: "تسجيل الدخول",

    networkError:
      "تعذر الاتصال. يرجى المحاولة مرة أخرى.",

    unexpectedError: "حدث خطأ غير متوقع.",

    invalidFile: "يرجى اختيار صيغة ملف مدعومة.",
    fileTooLarge: "يتجاوز الملف الحجم المسموح به.",
    emptyFile: "الملف المحدد فارغ.",

    categoryRequired: "يرجى اختيار فئة رخصة القيادة.",
    addressRequired: "يرجى إدخال عنوان إقامتك.",
    postalRequired: "يرجى إدخال رمز بريدي صالح.",
    cityRequired: "يرجى إدخال اسم مدينتك.",

    documentsRequired:
      "يرجى رفع جميع المستندات المطلوبة وانتظار اكتمال فحص الأمان.",

    confirmationsRequired:
      "يرجى تأكيد كلا الخيارين.",

    priceUnavailable:
      "يجب تأكيد السعر قبل إرسال الطلب.",

    conflict:
      "تم تعديل طلبك. يرجى تحميل البيانات الحالية.",

    reloadQuestion:
      "هل تريد تجاهل التغييرات غير المحفوظة وتحميل البيانات الحالية؟",

    submittedTitle: "تم تقديم طلبك بنجاح",

    submittedDescription:
      "لقد استلمنا طلبك. سيقوم فريقنا بمراجعة بياناتك ومستنداتك.",

    reference: "رقم الطلب",
    submittedAt: "تاريخ تقديم الطلب",
    status: "الحالة",

    emailAccepted:
      "تم قبول رسالة التأكيد للإرسال.",

    emailPending:
      "لا تزال رسالة التأكيد قيد المعالجة.",

    emailFailed:
      "تعذر إرسال رسالة التأكيد حتى الآن. لا يزال طلبك محفوظاً.",

    reviewRequired:
      "سيتم التحقق من شروط القبول بشكل فردي.",

    readOnly:
      "تم تقديم هذا الطلب ولا يمكن تعديله مباشرة.",

    verified: "تم التحقق",
    secure: "تقديم طلب آمن",
    complete: "مكتمل",

    stepPersonal: "البيانات الشخصية",
    stepCategory: "الفئة والعنوان",
    stepDocuments: "المستندات",
    stepConfirmation: "المراجعة والإرسال",

    lastSaved: "آخر حفظ",
    noCategories: "لا توجد فئات متاحة حالياً.",
    documentLimit: "مستندات جاهزة",
  },

  /* ========================================================
     TURKISH
     ======================================================== */

  tr: {
    title: "Ehliyet Başvurusu",
    subtitle:
      "Başvurunuzu hızlı ve güvenli bir şekilde yapın.",

    personal: "Kişisel Bilgiler",
    personalDescription:
      "Bu bilgiler hesabınızdan otomatik olarak alınır.",
    automatic: "Hesabınızdan otomatik olarak alındı",

    firstName: "Ad",
    lastName: "Soyad",
    email: "E-posta adresi",
    phone: "Telefon numarası",
    country: "Ülke",

    categoryAddress: "Ehliyet Sınıfı ve Adres",
    categoryDescription:
      "İstediğiniz ehliyet sınıfını seçin ve güncel ikamet adresinizi girin.",

    category: "Ehliyet sınıfı",
    selected: "Seçildi",
    moreCategories: "Diğer sınıflar",
    fewerCategories: "Daha az göster",

    residentialAddress: "İkamet adresi",
    addressPlaceholder: "Sokak ve bina numarası",
    postalCode: "Posta kodu",
    city: "Şehir",
    cityPlaceholder: "Şehriniz",

    trainingPrice: "Eğitim ücreti",
    registrationFee: "Kayıt ve dosya işlem ücreti",
    total: "Toplam tutar",

    estimatedPrice: "Tahmini fiyat",
    pricePending: "Fiyat henüz onaylanmadı",

    feeNotice:
      "Kayıt ve dosya işlem ücreti TAYM'ın ayrı hizmet ücretidir.",

    externalFees:
      "Açıkça dahil edilmeyen dersler, sınavlar ve resmi ücretler ek maliyete neden olabilir.",

    age: "Standart asgari yaş",
    years: "yaş",

    documents: "Belgeleri Yükle",
    documentDescription:
      "Gerekli tüm belgeleri eksiksiz ve okunaklı olarak yükleyin.",

    identityFront: "Kimlik belgesi ön yüzü",
    identityBack: "Kimlik belgesi arka yüzü",
    addressProof: "İkamet belgesi",
    signature: "İmza",
    passportPhoto: "Biyometrik fotoğraf",

    identityFrontHint:
      "Geçerli kimlik belgenizin ön yüzü.",
    identityBackHint:
      "Geçerli kimlik belgenizin arka yüzü.",
    addressProofHint:
      "Adınızı ve adresinizi gösteren güncel fatura veya banka ekstresi. Gereksiz finansal bilgileri gizleyebilirsiniz.",
    signatureHint:
      "El yazısı imzanızın okunaklı fotoğrafı.",
    passportPhotoHint:
      "Güncel ve net biyometrik fotoğraf.",

    upload: "Dosya seç",
    replace: "Dosyayı değiştir",
    preview: "Görüntüle",
    download: "İndir",
    remove: "Kaldır",

    removeQuestion:
      "Bu belgeyi gerçekten kaldırmak istiyor musunuz?",

    missing: "Yüklenmedi",
    uploaded: "Yüklendi",
    ready: "Güvenlik kontrolü tamamlandı",
    pending: "Kontrol bekleniyor",
    rejected: "Belge reddedildi",
    failed: "Başarısız",

    uploadHints: "Yükleme talimatları",
    allowedFormats: "İzin verilen dosya biçimleri",
    maxPerFile: "Dosya başına azami boyut",
    readable: "Net ve okunaklı fotoğraflar veya taramalar",
    protected: "Korumalı belge depolama",

    confirmation: "Onay",
    confirmationDescription:
      "Göndermeden önce bilgilerinizi kontrol edin.",

    confirmInformation:
      "Bilgilerimin doğru olduğunu onaylıyorum.",

    acceptProcessing:
      "Belgelerimin gizlilik bildirimi uyarınca bu başvurunun değerlendirilmesi için işlenmesini onaylıyorum.",

    legalNotice:
      "Bu başvuru zorunlu sınavların yerine geçmez ve resmi ehliyet verilmesini garanti etmez.",

    saveDraft: "Taslağı kaydet",
    submit: "Başvuruyu gönder",
    submitting: "Başvuru gönderiliyor",
    saving: "Kaydediliyor",
    uploading: "Yükleniyor",
    deleting: "Kaldırılıyor",

    draftSaved: "Taslağınız kaydedildi.",
    unsaved: "Kaydedilmemiş değişiklikler",
    saved: "Kaydedildi",

    loading: "Bilgileriniz yükleniyor...",
    retry: "Tekrar dene",
    refresh: "Yenile",
    back: "Kontrol paneline dön",

    loginRequired:
      "Başvurunuza erişmek için giriş yapın.",
    login: "Giriş yap",

    networkError:
      "Bağlantı kurulamadı. Lütfen tekrar deneyin.",

    unexpectedError: "Beklenmeyen bir hata oluştu.",

    invalidFile: "Desteklenen bir dosya biçimi seçin.",
    fileTooLarge: "Dosya izin verilen boyutu aşıyor.",
    emptyFile: "Seçilen dosya boş.",

    categoryRequired: "Bir ehliyet sınıfı seçin.",
    addressRequired: "İkamet adresinizi girin.",
    postalRequired: "Geçerli bir posta kodu girin.",
    cityRequired: "Şehrinizi girin.",

    documentsRequired:
      "Gerekli tüm belgeleri yükleyin ve güvenlik kontrolünün tamamlanmasını bekleyin.",

    confirmationsRequired:
      "Lütfen her iki seçeneği onaylayın.",

    priceUnavailable:
      "Başvuru gönderilmeden önce fiyat onaylanmalıdır.",

    conflict:
      "Başvurunuz değiştirildi. Güncel verileri yeniden yükleyin.",

    reloadQuestion:
      "Kaydedilmemiş değişiklikler silinsin ve güncel bilgiler yüklensin mi?",

    submittedTitle: "Başvurunuz başarıyla gönderildi",

    submittedDescription:
      "Başvurunuzu aldık. Ekibimiz bilgilerinizi ve belgelerinizi inceleyecektir.",

    reference: "Başvuru numarası",
    submittedAt: "Başvuru tarihi",
    status: "Durum",

    emailAccepted:
      "Onay e-postanız gönderim için kabul edildi.",

    emailPending:
      "Onay e-postanız henüz işleniyor.",

    emailFailed:
      "Onay e-postası henüz gönderilemedi. Başvurunuz kayıtlıdır.",

    reviewRequired:
      "Kabul şartları bireysel olarak incelenecektir.",

    readOnly:
      "Bu başvuru gönderildi ve artık doğrudan değiştirilemez.",

    verified: "Doğrulandı",
    secure: "Güvenli başvuru",
    complete: "Tamamlandı",

    stepPersonal: "Kişisel bilgiler",
    stepCategory: "Sınıf ve adres",
    stepDocuments: "Belgeler",
    stepConfirmation: "Kontrol ve gönderim",

    lastSaved: "Son kayıt",
    noCategories: "Şu anda kullanılabilir sınıf yok.",
    documentLimit: "Belge hazır",
  },

  /* ========================================================
     SPANISH
     ======================================================== */

  es: {
    title: "Solicitud de permiso de conducir",
    subtitle:
      "Presente su solicitud en línea de forma rápida y segura.",

    personal: "Datos personales",
    personalDescription:
      "Estos datos se recuperan automáticamente de su cuenta.",
    automatic: "Datos recuperados de su cuenta",

    firstName: "Nombre",
    lastName: "Apellidos",
    email: "Correo electrónico",
    phone: "Número de teléfono",
    country: "País",

    categoryAddress: "Categoría y domicilio",
    categoryDescription:
      "Seleccione la categoría deseada e introduzca su domicilio actual.",

    category: "Categoría del permiso",
    selected: "Seleccionado",
    moreCategories: "Más categorías",
    fewerCategories: "Mostrar menos",

    residentialAddress: "Domicilio",
    addressPlaceholder: "Calle y número",
    postalCode: "Código postal",
    city: "Ciudad",
    cityPlaceholder: "Su ciudad",

    trainingPrice: "Precio de formación",
    registrationFee: "Tasa de inscripción y tramitación",
    total: "Importe total",

    estimatedPrice: "Precio estimado",
    pricePending: "Precio pendiente de confirmación",

    feeNotice:
      "La tasa de inscripción y tramitación es un cargo separado por los servicios de TAYM.",

    externalFees:
      "Las clases, pruebas y tasas oficiales no incluidas expresamente pueden generar costes adicionales.",

    age: "Edad mínima ordinaria",
    years: "años",

    documents: "Subir documentos",
    documentDescription:
      "Suba todos los documentos requeridos de forma completa y legible.",

    identityFront: "Documento de identidad anverso",
    identityBack: "Documento de identidad reverso",
    addressProof: "Justificante de domicilio",
    signature: "Firma",
    passportPhoto: "Fotografía biométrica",

    identityFrontHint:
      "Anverso de su documento de identidad válido.",
    identityBackHint:
      "Reverso de su documento de identidad válido.",
    addressProofHint:
      "Factura reciente o extracto bancario con su nombre y domicilio. Puede ocultar los datos financieros no necesarios.",
    signatureHint:
      "Fotografía legible de su firma manuscrita.",
    passportPhotoHint:
      "Fotografía biométrica reciente y clara.",

    upload: "Seleccionar archivo",
    replace: "Sustituir archivo",
    preview: "Ver",
    download: "Descargar",
    remove: "Eliminar",

    removeQuestion:
      "¿Desea eliminar realmente este documento?",

    missing: "No subido",
    uploaded: "Subido",
    ready: "Comprobación de seguridad completada",
    pending: "Pendiente de comprobación",
    rejected: "Documento rechazado",
    failed: "Error",

    uploadHints: "Instrucciones de carga",
    allowedFormats: "Formatos de archivo permitidos",
    maxPerFile: "Tamaño máximo por archivo",
    readable: "Fotografías o escaneos claros y legibles",
    protected: "Almacenamiento protegido de documentos",

    confirmation: "Confirmación",
    confirmationDescription:
      "Revise sus datos antes de enviar la solicitud.",

    confirmInformation:
      "Confirmo que los datos proporcionados son correctos.",

    acceptProcessing:
      "Confirmo el tratamiento de mis documentos para gestionar esta solicitud conforme al aviso de privacidad.",

    legalNotice:
      "Esta solicitud no sustituye las pruebas obligatorias ni garantiza la expedición de un permiso oficial.",

    saveDraft: "Guardar borrador",
    submit: "Enviar solicitud",
    submitting: "Enviando solicitud",
    saving: "Guardando",
    uploading: "Subiendo archivo",
    deleting: "Eliminando",

    draftSaved: "Su borrador se ha guardado.",
    unsaved: "Cambios sin guardar",
    saved: "Guardado",

    loading: "Cargando sus datos...",
    retry: "Volver a intentar",
    refresh: "Actualizar",
    back: "Volver al panel",

    loginRequired:
      "Inicie sesión para acceder a su solicitud.",
    login: "Iniciar sesión",

    networkError:
      "No se pudo establecer la conexión. Inténtelo de nuevo.",

    unexpectedError: "Ha ocurrido un error inesperado.",

    invalidFile: "Seleccione un formato de archivo compatible.",
    fileTooLarge: "El archivo supera el tamaño permitido.",
    emptyFile: "El archivo seleccionado está vacío.",

    categoryRequired: "Seleccione una categoría del permiso.",
    addressRequired: "Introduzca su domicilio.",
    postalRequired: "Introduzca un código postal válido.",
    cityRequired: "Introduzca su ciudad.",

    documentsRequired:
      "Suba todos los documentos requeridos y espere a que finalice la comprobación de seguridad.",

    confirmationsRequired:
      "Confirme ambas opciones.",

    priceUnavailable:
      "Debe confirmarse el precio antes de enviar la solicitud.",

    conflict:
      "Su solicitud ha cambiado. Vuelva a cargar los datos actuales.",

    reloadQuestion:
      "¿Desea descartar los cambios sin guardar y cargar los datos actuales?",

    submittedTitle: "Su solicitud se ha enviado correctamente",

    submittedDescription:
      "Hemos recibido su solicitud. Nuestro equipo revisará sus datos y documentos.",

    reference: "Número de solicitud",
    submittedAt: "Fecha de presentación",
    status: "Estado",

    emailAccepted:
      "Su correo de confirmación ha sido aceptado para su envío.",

    emailPending:
      "El correo de confirmación sigue en proceso.",

    emailFailed:
      "Todavía no se pudo enviar el correo de confirmación. Su solicitud permanece guardada.",

    reviewRequired:
      "Los requisitos de admisión se comprobarán individualmente.",

    readOnly:
      "Esta solicitud ya se ha enviado y no puede modificarse directamente.",

    verified: "Verificado",
    secure: "Solicitud segura",
    complete: "Completado",

    stepPersonal: "Datos personales",
    stepCategory: "Categoría y domicilio",
    stepDocuments: "Documentos",
    stepConfirmation: "Revisar y enviar",

    lastSaved: "Último guardado",
    noCategories: "No hay categorías disponibles actualmente.",
    documentLimit: "Documentos preparados",
  },
} as const;

type TranslationKey = keyof typeof TEXT.de;

type Translations = Record<TranslationKey, string>;

/* ============================================================
   5. LANGUAGE HELPERS

   Reuse existing language mechanism.
   No independent language switcher.
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
    .split("-")[0];

  return (LOCALES as readonly string[])
    .includes(code)
    ? (code as Locale)
    : null;
}

function readCookie(
  name: string
): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookie = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find(
      (item) => item.startsWith(`${name}=`)
    );

  if (!cookie) {
    return null;
  }

  try {
    return decodeURIComponent(
      cookie.slice(name.length + 1)
    );
  } catch {
    return null;
  }
}

function getCurrentLocale(): Locale {
  if (typeof window === "undefined") {
    return "de";
  }

  let savedLocale: string | null = null;

  try {
    savedLocale = localStorage.getItem(
      LANGUAGE_STORAGE
    );
  } catch {
    // Storage may be unavailable.
  }

  return (
    normalizeLocale(readCookie(LANGUAGE_COOKIE)) ??
    normalizeLocale(savedLocale) ??
    normalizeLocale(document.documentElement.lang) ??
    "de"
  );
}

/* ============================================================
   6. API ERROR
   ============================================================ */

class ApplicationApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly issues: ValidationIssue[];

  constructor(
    message: string,
    code: string,
    status = 0,
    issues: ValidationIssue[] = []
  ) {
    super(message);

    this.name = "ApplicationApiError";
    this.code = code;
    this.status = status;
    this.issues = issues;
  }
}

/* ============================================================
   7. AUTHENTICATED API REQUESTS

   Session handled by existing HttpOnly cookie.
   No session token stored in localStorage.
   ============================================================ */

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const controller = new AbortController();

  const externalSignal = options.signal;

  const abortRequest = () => {
    controller.abort();
  };

  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener(
      "abort",
      abortRequest,
      { once: true }
    );
  }

  const timeout = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const response = await fetch(path, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    });

    let result: ApiResponse<T>;

    try {
      result = await response.json();
    } catch {
      throw new ApplicationApiError(
        "",
        "INVALID_RESPONSE",
        response.status
      );
    }

    if (!response.ok || !result.success) {
      if (!result.success) {
        throw new ApplicationApiError(
          result.error?.message ?? "",
          result.error?.code ?? "INTERNAL_ERROR",
          response.status,
          result.error?.issues ?? []
        );
      }

      throw new ApplicationApiError(
        "",
        "INTERNAL_ERROR",
        response.status
      );
    }

    return result.data;
  } catch (error) {
    if (error instanceof ApplicationApiError) {
      throw error;
    }

    throw new ApplicationApiError(
      "",
      "NETWORK_ERROR"
    );
  } finally {
    window.clearTimeout(timeout);

    externalSignal?.removeEventListener(
      "abort",
      abortRequest
    );
  }
}

function jsonRequest<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  data: Record<string, unknown>
): Promise<T> {
  return apiRequest<T>(path, {
    method,

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(data),
  });
}

/* ============================================================
   8. FORM AND DISPLAY HELPERS
   ============================================================ */

function formatPrice(
  value: number | null | undefined,
  locale: Locale
): string {
  if (
    value === null ||
    value === undefined ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    FORMAT_LOCALES[locale],
    {
      style: "currency",
      currency: "EUR",
    }
  ).format(value / 100);
}

function formatDate(
  value: string | null | undefined,
  locale: Locale
): string {
  if (!value) return "—";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    FORMAT_LOCALES[locale],
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(date);
}

function formatFileSize(
  value: number,
  locale: Locale
): string {
  const size = value / (1024 * 1024);

  return (
    new Intl.NumberFormat(
      FORMAT_LOCALES[locale],
      {
        maximumFractionDigits: 2,
      }
    ).format(size) + " MB"
  );
}

function normalizeDigits(
  value: string
): string {
  return value
    .replace(/[٠-٩]/g, (digit) =>
      String(digit.charCodeAt(0) - 1632)
    )
    .replace(/[۰-۹]/g, (digit) =>
      String(digit.charCodeAt(0) - 1776)
    );
}

function formsEqual(
  first: ApplicationForm,
  second: ApplicationForm
): boolean {
  return (
    first.category === second.category &&
    first.residentialAddress === second.residentialAddress &&
    first.postalCode === second.postalCode &&
    first.city === second.city &&
    first.confirmedInformation === second.confirmedInformation &&
    first.acceptedDocumentProcessing === second.acceptedDocumentProcessing
  );
}

function readForm(
  data: ApplicationPageData
): ApplicationForm {
  return {
    category: data.form?.category ?? "",
    residentialAddress:
      data.form?.residentialAddress ?? "",
    postalCode: data.form?.postalCode ?? "",
    city: data.form?.city ?? "",

    confirmedInformation:
      data.form?.confirmedInformation === true,

    acceptedDocumentProcessing:
      data.form?.acceptedDocumentProcessing === true,
  };
}

function getDocumentText(
  document: RequiredDocument,
  t: Translations
): {
  title: string;
  hint: string;
} {
  switch (document.type) {
    case "IDENTITY_FRONT":
      return {
        title: t.identityFront,
        hint: t.identityFrontHint,
      };

    case "IDENTITY_BACK":
      return {
        title: t.identityBack,
        hint: t.identityBackHint,
      };

    case "ADDRESS_PROOF":
      return {
        title: t.addressProof,
        hint: t.addressProofHint,
      };

    case "SIGNATURE":
      return {
        title: t.signature,
        hint: t.signatureHint,
      };

    case "PASSPORT_PHOTO":
      return {
        title: t.passportPhoto,
        hint: t.passportPhotoHint,
      };

    default:
      return {
        title: document.label,
        hint: document.label,
      };
  }
}

function getDocumentIcon(type: DocumentType) {
  switch (type) {
    case "IDENTITY_FRONT":
      return UserRound;

    case "IDENTITY_BACK":
      return CreditCard;

    case "ADDRESS_PROOF":
      return FileText;

    case "SIGNATURE":
      return Signature;

    case "PASSPORT_PHOTO":
      return ImageIcon;

    default:
      return FileText;
  }
}

function getVehicleIcon(category: string) {
  if (category.startsWith("A")) {
    return Bike;
  }

  if (category.startsWith("C")) {
    return Truck;
  }

  if (category.startsWith("D")) {
    return BusFront;
  }

  return CarFront;
}

function getDocumentStatus(
  document: ApplicationDocument | null,
  t: Translations
) {
  if (!document) {
    return {
      text: t.missing,
      className: "text-slate-500",
    };
  }

  if (
    document.securityStatus === "REJECTED" ||
    document.reviewStatus === "REJECTED"
  ) {
    return {
      text: t.rejected,
      className: "text-red-700",
    };
  }

  if (document.uploadStatus === "FAILED") {
    return {
      text: t.failed,
      className: "text-red-700",
    };
  }

  if (document.ready) {
    return {
      text: t.ready,
      className: "text-green-700",
    };
  }

  return {
    text: t.pending,
    className: "text-amber-700",
  };
}

function getSafeDocumentUrl(
  url: string | null
): string | null {
  if (!url) return null;

  const pattern =
    /^\/api\/dashboard\/application\/documents\/[a-f0-9-]{36}(\?[^#]*)?$/i;

  return pattern.test(url) ? url : null;
}

function getSafeImagePath(
  path: string | null
): string | null {
  if (
    !path ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("..") ||
    path.includes("\\") ||
    path.includes("%") ||
    !/^\/[a-zA-Z0-9/_\-.]+$/.test(path)
  ) {
    return null;
  }

  return path;
}

/* ============================================================
   9. REUSABLE FIELD COMPONENT
   ============================================================ */

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="text-[13px] font-semibold text-slate-900">
        {label}

        {required && (
          <span className="ms-1 text-red-600">
            *
          </span>
        )}
      </div>

      {children}
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  icon,
  ltr = false,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  ltr?: boolean;
}) {
  return (
    <Field label={label}>
      <div className="flex min-h-12 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-3">
        <span className="shrink-0 text-slate-500">
          {icon}
        </span>

        <span
          dir={ltr ? "ltr" : "auto"}
          className="min-w-0 flex-1 break-all text-start text-sm font-medium text-slate-800"
        >
          {value || "—"}
        </span>

        <LockKeyhole
          size={15}
          className="shrink-0 text-slate-400"
          aria-hidden="true"
        />
      </div>
    </Field>
  );
}

/* ============================================================
   10. SECTION CONTAINER

   Desktop:
   All sections visible.

   Mobile:
   Collapsible sections.
   ============================================================ */

function NumberedSection({
  number,
  title,
  description,
  completed,
  mobileOpen,
  onToggle,
  children,
}: {
  number: SectionNumber;
  title: string;
  description?: string;
  completed: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const contentId = `application-section-${number}`;

  return (
    <section
      id={contentId}
      className="scroll-mt-28 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="hidden items-start gap-3 border-b border-slate-100 px-5 py-4 md:flex lg:px-6">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-lime-500 to-green-800 font-bold text-white shadow-sm">
          {completed ? <Check size={19} /> : number}
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold tracking-tight text-slate-950">
            {title}
          </h2>

          {description && (
            <p className="mt-0.5 text-sm leading-relaxed text-slate-500">
              {description}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={mobileOpen}
        aria-controls={`${contentId}-body`}
        className="flex w-full items-center gap-3 px-3.5 py-4 text-start md:hidden"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-lime-500 to-green-800 text-sm font-bold text-white">
          {completed ? <Check size={17} /> : number}
        </span>

        <span className="min-w-0 flex-1 text-[15px] font-bold text-slate-950">
          {title}
        </span>

        <ChevronDown
          size={19}
          className={`shrink-0 text-slate-600 transition-transform ${
            mobileOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        id={`${contentId}-body`}
        className={`${
          mobileOpen ? "block" : "hidden"
        } border-t border-slate-100 p-3.5 md:block md:border-t-0 md:p-5 lg:p-6`}
      >
        {description && (
          <p className="mb-4 text-xs leading-relaxed text-slate-500 md:hidden">
            {description}
          </p>
        )}

        {children}
      </div>
    </section>
  );
}

/* ============================================================
   11. PROGRESS INDICATOR
   ============================================================ */

function ApplicationProgress({
  steps,
  onSelect,
}: {
  steps: {
    number: SectionNumber;
    label: string;
    completed: boolean;
  }[];

  onSelect: (section: SectionNumber) => void;
}) {
  const firstIncomplete = steps.find(
    (step) => !step.completed
  )?.number;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-2 py-4 shadow-sm sm:px-5 sm:py-5">
      <div className="grid grid-cols-4">
        {steps.map((step, index) => {
          const active =
            step.number === firstIncomplete;

          return (
            <button
              key={step.number}
              type="button"
              onClick={() => onSelect(step.number)}
              aria-current={active ? "step" : undefined}
              className="relative flex min-w-0 flex-col items-center gap-2 px-1 text-center"
            >
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute inset-s-1/2 top-4 h-0.5 w-full ${
                    step.completed
                      ? "bg-lime-500"
                      : "bg-slate-200"
                  }`}
                />
              )}

              <span
                className={`relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-sm font-bold sm:size-9 ${
                  step.completed || active
                    ? "border-lime-600 bg-linear-to-br from-lime-500 to-green-800 text-white"
                    : "border-slate-300 bg-white text-slate-500"
                }`}
              >
                {step.completed ? (
                  <Check size={17} />
                ) : (
                  step.number
                )}
              </span>

              <span
                className={`max-w-full wrap-break-word text-[10px] font-semibold leading-tight sm:text-xs lg:text-sm ${
                  step.completed || active
                    ? "text-green-900"
                    : "text-slate-500"
                }`}
              >
                {step.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   12. VEHICLE CATEGORY CARD
   ============================================================ */

function CategoryCard({
  category,
  selected,
  disabled,
  locale,
  t,
  onSelect,
}: {
  category: LicenseCategory;
  selected: boolean;
  disabled: boolean;
  locale: Locale;
  t: Translations;
  onSelect: () => void;
}) {
  const imagePath = getSafeImagePath(
    category.imagePath
  );

  const [imageFailed, setImageFailed] =
    useState(false);

  const VehicleIcon = getVehicleIcon(
    category.category
  );

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onSelect}
      className={`relative flex min-h-40 min-w-0 flex-col items-center justify-between gap-2 rounded-xl border-2 p-2.5 text-center transition-all sm:min-h-44 sm:p-3 ${
        selected
          ? "border-lime-500 bg-lime-50 shadow-sm ring-2 ring-lime-500/10"
          : "border-slate-200 bg-white hover:border-lime-400 hover:bg-lime-50/40"
      } disabled:cursor-default disabled:hover:border-slate-200`}
    >
      <span
        className={`absolute inset-e-2 top-2 flex size-5 items-center justify-center rounded-full border ${
          selected
            ? "border-lime-600 bg-lime-600 text-white"
            : "border-slate-300 bg-white"
        }`}
      >
        {selected && <Check size={12} />}
      </span>

      <div className="relative flex h-20 w-full items-center justify-center sm:h-24">
        {imagePath && !imageFailed ? (
          <Image
            src={imagePath}
            alt={category.name}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 150px"
            className="object-contain px-2 py-1"
            onError={() => setImageFailed(true)}
          />
        ) : (
          createElement(VehicleIcon, { size: 46, strokeWidth: 1.5, className: selected ? "text-green-700" : "text-slate-500" })
        )}
      </div>

      <div className="w-full">
        <div
          dir="auto"
          className="text-sm font-extrabold text-slate-950"
        >
          {category.name}
        </div>

        <p className="mt-1 min-h-7 text-[10px] leading-snug text-slate-500 sm:text-[11px]">
          {category.description}
        </p>
      </div>

      <div className="w-full border-t border-slate-200 pt-2">
        <span
          dir="ltr"
          className="text-xs font-bold tabular-nums text-green-800 sm:text-sm"
        >
          {formatPrice(
            category.trainingPriceCents,
            locale
          )}
        </span>

        {!category.pricingApproved && (
          <span className="mt-1 block text-[10px] text-slate-500">
            {t.estimatedPrice}
          </span>
        )}
      </div>
    </button>
  );
}

/* ============================================================
   13. PRICE SUMMARY
   ============================================================ */

function PriceSummary({
  pricing,
  category,
  locale,
  t,
  historical,
}: {
  pricing: Pricing | null;
  category: LicenseCategory | null;
  locale: Locale;
  t: Translations;
  historical: boolean;
}) {
  if (!pricing) {
    return null;
  }

  const unapproved =
    !historical &&
    category?.pricingApproved !== true;

  return (
    <div className="overflow-hidden rounded-xl border border-lime-200 bg-lime-50/70">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-lime-200 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-bold text-green-900">
          <Wallet size={18} />
          {category?.name ?? t.trainingPrice}
        </div>

        {unapproved && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">
            {t.estimatedPrice}
          </span>
        )}
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-3 sm:gap-4">
        <div className="flex items-center justify-between gap-3 sm:block">
          <span className="text-xs font-medium text-slate-600">
            {t.trainingPrice}
          </span>

          <strong
            dir="ltr"
            className="block text-lg font-extrabold tabular-nums text-slate-950 sm:mt-2"
          >
            {formatPrice(
              pricing.trainingPriceCents,
              locale
            )}
          </strong>
        </div>

        <div className="flex items-center justify-between gap-3 sm:block sm:border-s sm:border-lime-200 sm:ps-4">
          <span className="text-xs font-medium text-slate-600">
            {t.registrationFee}
          </span>

          <strong
            dir="ltr"
            className="block text-lg font-extrabold tabular-nums text-slate-950 sm:mt-2"
          >
            {formatPrice(
              pricing.registrationFeeCents,
              locale
            )}
          </strong>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-lime-200 pt-3 sm:block sm:border-s sm:border-t-0 sm:ps-4 sm:pt-0">
          <span className="text-xs font-semibold text-green-900">
            {t.total}
          </span>

          <strong
            dir="ltr"
            className="block text-xl font-black tabular-nums text-green-800 sm:mt-2 sm:text-2xl"
          >
            {formatPrice(
              pricing.totalPriceCents,
              locale
            )}
          </strong>
        </div>
      </div>

      <div className="space-y-1 border-t border-lime-200 px-4 py-3 text-[11px] leading-relaxed text-slate-600">
        <p>{t.feeNotice}</p>
        <p>{t.externalFees}</p>

        {unapproved && (
          <p className="font-semibold text-amber-800">
            {t.pricePending}
          </p>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   14. DOCUMENT UPLOAD CARD
   ============================================================ */

function DocumentCard({
  requirement,
  locale,
  t,
  editable,
  busy,
  onUpload,
  onDelete,
}: {
  requirement: RequiredDocument;
  locale: Locale;
  t: Translations;
  editable: boolean;
  busy: BusyAction;
  onUpload: (
    requirement: RequiredDocument,
    file: File
  ) => Promise<void>;
  onDelete: (
    document: ApplicationDocument
  ) => Promise<void>;
}) {
  const inputRef =
    useRef<HTMLInputElement>(null);

  const document = requirement.document;

  const { title, hint } =
    getDocumentText(requirement, t);

  const DocumentIcon =
    getDocumentIcon(requirement.type);

  const status = getDocumentStatus(
    document,
    t
  );

  const isUploading =
    busy === `UPLOAD:${requirement.type}`;

  const isDeleting =
    document !== null &&
    busy === `DELETE:${document.id}`;

  const disabled = busy !== null;

  const previewUrl =
    getSafeDocumentUrl(
      document?.previewUrl ?? null
    );

  const downloadUrl =
    getSafeDocumentUrl(
      document?.downloadUrl ?? null
    );

  async function handleFile(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (file) {
      await onUpload(requirement, file);
    }
  }

  return (
    <article
      className={`flex min-w-0 flex-col rounded-xl border p-3 transition-colors ${
        document?.ready
          ? "border-lime-300 bg-lime-50/40"
          : "border-dashed border-slate-300 bg-slate-50/60"
      }`}
    >
      <div className="flex items-start gap-3 lg:flex-col lg:items-center lg:text-center">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-green-800">
          {createElement(DocumentIcon, { size: 23, strokeWidth: 1.8 })}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-bold leading-snug text-slate-900 sm:text-sm">
            {title}

            {requirement.required && (
              <span className="ms-1 text-red-600">
                *
              </span>
            )}
          </h3>

          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            {hint}
          </p>
        </div>
      </div>

      <div className="my-3 flex flex-wrap items-center gap-1.5 lg:justify-center">
        <span className={`text-[11px] font-semibold ${status.className}`}>
          {status.text}
        </span>

        {document?.ready && (
          <CheckCircle2
            size={14}
            className="text-green-700"
          />
        )}
      </div>

      {document && (
        <div className="mb-3 min-w-0 rounded-lg border border-slate-200 bg-white p-2.5">
          <p
            dir="auto"
            title={document.fileName}
            className="truncate text-xs font-medium text-slate-800"
          >
            {document.fileName}
          </p>

          <p className="mt-1 text-[10px] text-slate-500">
            {formatFileSize(
              document.sizeBytes,
              locale
            )}
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t.preview}
                title={t.preview}
                className="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
              >
                <Eye size={16} />
              </a>
            )}

            {downloadUrl && (
              <a
                href={downloadUrl}
                aria-label={t.download}
                title={t.download}
                className="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
              >
                <Download size={16} />
              </a>
            )}

            {editable && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onDelete(document)}
                aria-label={t.remove}
                title={t.remove}
                className="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-red-100 text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {isDeleting ? (
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <Trash2 size={16} />
                )}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-auto">
        {editable && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={requirement.accept}
              onChange={handleFile}
              disabled={disabled}
              aria-label={title}
              className="sr-only"
              tabIndex={-1}
            />

            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-lime-600 bg-white px-2 py-2 text-xs font-bold text-green-800 transition-colors hover:bg-lime-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <LoaderCircle
                    size={16}
                    className="animate-spin"
                  />

                  {t.uploading}
                </>
              ) : (
                <>
                  <UploadCloud
                    size={16}
                    className="shrink-0"
                  />

                  {document
                    ? t.replace
                    : t.upload}
                </>
              )}
            </button>
          </>
        )}

        <p className="mt-2 text-center text-[10px] text-slate-500">
          {requirement.allowedMimeTypes
            .map((type) => {
              if (type === "image/jpeg") {
                return "JPG";
              }

              if (type === "image/png") {
                return "PNG";
              }

              if (type === "application/pdf") {
                return "PDF";
              }

              return type;
            })
            .join(", ")}

          {" · "}

          {formatFileSize(
            requirement.maxSizeBytes,
            locale
          )}
        </p>
      </div>
    </article>
  );
}

/* ============================================================
   15. ALERT COMPONENT
   ============================================================ */

function Alert({
  type,
  message,
  issues = [],
}: {
  type: "error" | "success" | "info";
  message: string;
  issues?: ValidationIssue[];
}) {
  const Icon =
    type === "error"
      ? CircleAlert
      : type === "success"
        ? CheckCircle2
        : Info;

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
        type === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : type === "success"
            ? "border-green-200 bg-green-50 text-green-800"
            : "border-slate-200 bg-slate-50 text-slate-700"
      }`}
    >
      <Icon
        size={19}
        className="mt-0.5 shrink-0"
      />

      <div className="min-w-0 flex-1">
        <p className="wrap-break-word leading-relaxed">
          {message}
        </p>

        {issues.length > 0 && (
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
            {issues.map((issue, index) => (
              <li key={`${issue.code}-${index}`}>
                {issue.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   16. SUCCESS SCREEN
   ============================================================ */

function SubmissionSuccess({
  result,
  locale,
  t,
}: {
  result: SubmissionResult;
  locale: Locale;
  t: Translations;
}) {
  const Arrow =
    locale === "ar" ? ArrowLeft : ArrowRight;

  const emailMessage =
    result.emails.candidate === "ACCEPTED"
      ? t.emailAccepted
      : result.emails.candidate === "PENDING"
        ? t.emailPending
        : t.emailFailed;

  return (
    <div
      dir={locale === "ar" ? "rtl" : "ltr"}
      className="w-full px-3 py-6 sm:px-6 sm:py-6"
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-lime-200 bg-linear-to-br from-lime-50 to-green-50 px-5 py-9 text-center sm:px-8">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full border-4 border-white bg-linear-to-br from-lime-500 to-green-800 text-white shadow-md">
            <Check size={40} strokeWidth={2.5} />
          </div>

          <h1 className="mt-5 text-xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
            {t.submittedTitle}
          </h1>

          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-600">
            {t.submittedDescription}
          </p>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-xs text-slate-500">
                {t.reference}
              </p>

              <p
                dir="ltr"
                className="mt-1 break-all text-base font-bold text-green-800"
              >
                {result.application.reference}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                {t.category}
              </p>

              <strong className="mt-1 block text-slate-950">
                {result.application.category}
              </strong>
            </div>

            <div>
              <p className="text-xs text-slate-500">
                {t.submittedAt}
              </p>

              <strong className="mt-1 block text-sm text-slate-950">
                {formatDate(
                  result.application.submittedAt,
                  locale
                )}
              </strong>
            </div>
          </div>

          <PriceSummary
            pricing={result.pricing}
            category={null}
            locale={locale}
            t={t}
            historical={true}
          />

          <Alert
            type={
              result.emails.candidate === "ACCEPTED"
                ? "success"
                : "info"
            }
            message={emailMessage}
          />

          {result.application.admissionReviewRequired && (
            <Alert
              type="info"
              message={t.reviewRequired}
            />
          )}

          <p className="text-xs leading-relaxed text-slate-500">
            {t.legalNotice}
          </p>

          <Link
            href={ROUTES.dashboard}
            className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-linear-to-r from-green-800 to-lime-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:from-green-900 hover:to-lime-700"
          >
            {t.back}

            <Arrow size={19} />
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   17. MAIN PAGE
   ============================================================ */

export default function DrivingLicenseApplicationPage() {
  const [locale, setLocale] =
    useState<Locale>("de");

  const [birthDate, setBirthDate] = useState("");
  const [birthDateMessage, setBirthDateMessage] = useState("");
  const [birthDateSaving, setBirthDateSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/dashboard/account", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (typeof data?.profile?.dateOfBirth === "string") setBirthDate(data.profile.dateOfBirth); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  async function saveBirthDate() {
    setBirthDateSaving(true);
    setBirthDateMessage("");
    try {
      const response = await fetch("/api/dashboard/account", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateOfBirth: birthDate }),
      });
      if (!response.ok) throw new Error("SAVE_FAILED");
      setBirthDateMessage(({ de: "Geburtsdatum gespeichert.", ar: "تم حفظ تاريخ الميلاد.", tr: "Doğum tarihi kaydedildi.", es: "Fecha de nacimiento guardada." })[locale]);
    } catch {
      setBirthDateMessage(({ de: "Das Geburtsdatum konnte nicht gespeichert werden.", ar: "تعذر حفظ تاريخ الميلاد.", tr: "Doğum tarihi kaydedilemedi.", es: "No se pudo guardar la fecha de nacimiento." })[locale]);
    } finally { setBirthDateSaving(false); }
  }

  const [page, setPage] =
    useState<ApplicationPageData | null>(null);

  const [form, setForm] =
    useState<ApplicationForm>({
      ...EMPTY_FORM,
    });

  const [savedForm, setSavedForm] =
    useState<ApplicationForm>({
      ...EMPTY_FORM,
    });

  const [busy, setBusy] =
    useState<BusyAction>("LOAD");

  const [error, setError] =
    useState("");

  const [issues, setIssues] =
    useState<ValidationIssue[]>([]);

  const [notice, setNotice] =
    useState("");

  const [loginRequired, setLoginRequired] =
    useState(false);

  const [showAllCategories, setShowAllCategories] =
    useState(false);

  const [submission, setSubmission] =
    useState<SubmissionResult | null>(null);

  const [openSections, setOpenSections] =
    useState<Record<SectionNumber, boolean>>({
      1: false,
      2: true,
      3: true,
      4: true,
    });

  const localeRef = useRef<Locale>("de");

  const pageRef =
    useRef<ApplicationPageData | null>(null);

  const formRef =
    useRef<ApplicationForm>({
      ...EMPTY_FORM,
    });

  const savedFormRef =
    useRef<ApplicationForm>({
      ...EMPTY_FORM,
    });

  const mountedRef = useRef(false);

  const actionRef = useRef(false);

  const localeRequestPendingRef =
    useRef(false);

  const submissionRef = useRef(false);

  const conflictRef = useRef(false);

  const [conflict, setConflict] =
    useState(false);

  const t: Translations = TEXT[locale];

  const rtl = locale === "ar";

  const BackIcon = rtl ? ArrowRight : ArrowLeft;

  /* ========================================================
     18. APPLY AUTHORITATIVE SERVER DATA
     ======================================================== */

  const applyServerData = useCallback(
    (
      data: ApplicationPageData,
      preserveForm = false
    ) => {
      if (
        !data?.candidate ||
        !data?.country ||
        !Array.isArray(data.country.categories) ||
        !Array.isArray(data.requiredDocuments) ||
        !data.permissions
      ) {
        throw new ApplicationApiError(
          "",
          "INVALID_RESPONSE"
        );
      }

      const nextForm = readForm(data);

      pageRef.current = data;

      savedFormRef.current = nextForm;

      if (!mountedRef.current) {
        return;
      }

      setPage(data);
      setSavedForm(nextForm);

      if (
        !preserveForm ||
        !data.permissions.canEdit
      ) {
        formRef.current = nextForm;
        setForm(nextForm);
      }
    },
    []
  );

  /* ========================================================
     19. LOAD CURRENT APPLICATION
     ======================================================== */

  const fetchApplication = useCallback(
    async (
      requestedLocale: Locale,
      applicationId?: string | null,
      signal?: AbortSignal
    ): Promise<ApplicationPageData> => {
      const params = new URLSearchParams({
        locale: requestedLocale,
      });

      if (applicationId) {
        params.set(
          "applicationId",
          applicationId
        );
      }

      return apiRequest<ApplicationPageData>(
        `${API.application}?${params.toString()}`,
        {
          method: "GET",
          signal,
        }
      );
    },
    []
  );

  /* ========================================================
     20. ERROR HANDLING
     ======================================================== */

  const handleError = useCallback(
    (caught: unknown) => {
      if (!mountedRef.current) return;

      const dictionary =
        TEXT[localeRef.current];

      setNotice("");
      setIssues([]);

      if (caught instanceof ApplicationApiError) {
        if (caught.status === 401) {
          setLoginRequired(true);
          setError(dictionary.loginRequired);
          return;
        }

        if (
          caught.code === "APPLICATION_CONFLICT" ||
          caught.code === "REVISION_CONFLICT" ||
          caught.code === "PRICE_CHANGED"
        ) {
          conflictRef.current = true;
          setConflict(true);
        }

        setError(
          caught.message ||
          (
            caught.code === "NETWORK_ERROR"
              ? dictionary.networkError
              : caught.code === "APPLICATION_CONFLICT"
                ? dictionary.conflict
                : dictionary.unexpectedError
          )
        );

        setIssues(caught.issues);
        return;
      }

      setError(dictionary.unexpectedError);
    },
    []
  );

  /* ========================================================
     21. EXCLUSIVE MUTATIONS

     Prevent concurrent local upload,
     save, delete and submit operations.
     ======================================================== */

  const runAction = useCallback(
    async (
      action: Exclude<BusyAction, null>,
      task: () => Promise<void>
    ) => {
      if (
        actionRef.current ||
        submissionRef.current ||
        !mountedRef.current
      ) {
        return;
      }

      actionRef.current = true;

      setBusy(action);
      setError("");
      setIssues([]);
      setNotice("");

      try {
        await task();
      } catch (caught) {
        handleError(caught);
      } finally {
        actionRef.current = false;

        if (mountedRef.current) {
          setBusy(null);
        }
      }
    },
    [handleError]
  );

  /* ========================================================
     22. INITIAL LOAD

     Existing application can be opened
     from an authenticated email link.
     ======================================================== */

  useEffect(() => {
    mountedRef.current = true;

    const controller =
      new AbortController();

    const initialLocale =
      getCurrentLocale();

    localeRef.current = initialLocale;

    const localeTimer = window.setTimeout(() => setLocale(initialLocale), 0);

    const requestedId =
      new URLSearchParams(
        window.location.search
      ).get("applicationId");

    actionRef.current = true;

    void fetchApplication(
      initialLocale,
      requestedId,
      controller.signal
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          applyServerData(data);
        }
      })
      .catch((caught) => {
        if (!controller.signal.aborted) {
          handleError(caught);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          actionRef.current = false;

          if (mountedRef.current) {
            setBusy(null);
          }
        }
      });

    return () => {
      mountedRef.current = false;
      window.clearTimeout(localeTimer);

      controller.abort();

      actionRef.current = false;
    };
  }, [
    fetchApplication,
    applyServerData,
    handleError,
  ]);

  // Refresh the dossier periodically without overwriting unsaved edits.
  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;
    const refresh = async () => {
      const current = pageRef.current;
      if (document.visibilityState !== "visible" || !current || inFlight || actionRef.current || submissionRef.current || conflictRef.current || !formsEqual(formRef.current, savedFormRef.current)) return;
      inFlight = true;
      try {
        const next = await fetchApplication(localeRef.current, current.application?.id, controller.signal);
        if (!controller.signal.aborted && !actionRef.current && !submissionRef.current && !conflictRef.current && pageRef.current === current && formsEqual(formRef.current, savedFormRef.current)) {
          applyServerData(next);
        }
      } catch {
        // A later refresh or the explicit refresh button can retry.
      } finally {
        inFlight = false;
      }
    };
    const interval = window.setInterval(() => void refresh(), 30000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { controller.abort(); window.clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, [fetchApplication, applyServerData]);

  /* ========================================================
     23. EXISTING LANGUAGE SWITCHER

     Observe existing language cookie,
     localStorage, custom event and HTML lang.
     ======================================================== */

  useEffect(() => {
    function syncLocale(event?: Event) {
      const detail =
        event instanceof CustomEvent
          ? event.detail
          : null;

      const eventLocale = normalizeLocale(
        typeof detail === "string"
          ? detail
          : detail?.locale
      );

      const nextLocale =
        eventLocale ?? getCurrentLocale();

      if (nextLocale === localeRef.current) {
        return;
      }

      localeRef.current = nextLocale;

      setLocale(nextLocale);

      localeRequestPendingRef.current = true;
    }

    function syncHtmlLocale() {
      const htmlLocale = normalizeLocale(
        document.documentElement.lang
      );

      if (
        htmlLocale &&
        htmlLocale !== localeRef.current
      ) {
        localeRef.current = htmlLocale;
        setLocale(htmlLocale);
        localeRequestPendingRef.current = true;
      }
    }

    const observer =
      new MutationObserver(syncHtmlLocale);

    observer.observe(
      document.documentElement,
      {
        attributes: true,
        attributeFilter: ["lang"],
      }
    );

    window.addEventListener(
      LANGUAGE_EVENT,
      syncLocale
    );

    window.addEventListener(
      "storage",
      syncLocale
    );

    window.addEventListener(
      "focus",
      syncLocale
    );

    return () => {
      observer.disconnect();

      window.removeEventListener(
        LANGUAGE_EVENT,
        syncLocale
      );

      window.removeEventListener(
        "storage",
        syncLocale
      );

      window.removeEventListener(
        "focus",
        syncLocale
      );
    };
  }, []);

  /* ========================================================
     24. REFRESH TRANSLATED SERVER CONTENT

     Preserve unsaved fields when only
     the interface language changes.

     Detect remote revision changes.
     ======================================================== */

  useEffect(() => {
    if (
      busy !== null ||
      !pageRef.current ||
      submissionRef.current
    ) {
      return;
    }

    if (
      !localeRequestPendingRef.current &&
      pageRef.current.locale === locale
    ) {
      return;
    }

    const previousPage = pageRef.current;

    localeRequestPendingRef.current = false;

    void runAction("REFRESH", async () => {
      const next = await fetchApplication(
        locale,
        previousPage.application?.id
      );

      const dirty = !formsEqual(
        formRef.current,
        savedFormRef.current
      );

      const revisionChanged =
        previousPage.application?.revision !==
          next.application?.revision ||
        previousPage.application?.id !==
          next.application?.id;

      if (dirty && revisionChanged) {
        conflictRef.current = true;

        setConflict(true);
        setError(TEXT[locale].conflict);

        return;
      }

      applyServerData(next, dirty);
    });
  }, [
    locale,
    busy,
    runAction,
    fetchApplication,
    applyServerData,
  ]);

  /* ========================================================
     25. PROTECT UNSAVED FORM CHANGES
     ======================================================== */

  const dirty = !formsEqual(form, savedForm);

  useEffect(() => {
    if (!dirty || submission !== null) {
      return;
    }

    function beforeUnload(
      event: BeforeUnloadEvent
    ) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener(
      "beforeunload",
      beforeUnload
    );

    return () => {
      window.removeEventListener(
        "beforeunload",
        beforeUnload
      );
    };
  }, [dirty, submission]);

  /* ========================================================
     26. DERIVED PAGE STATE
     ======================================================== */

  const editable =
    page?.permissions.canEdit === true &&
    !submission &&
    !loginRequired;

  const interactionDisabled =
    busy !== null ||
    !editable ||
    conflict;

  const selectedCategory =
    page?.country.categories.find(
      (category) =>
        category.category === form.category
    ) ?? null;

  const pricing: Pricing | null =
    page?.application &&
    page.application.status !== "DRAFT"
      ? page.application.pricing
      : selectedCategory
        ? {
            currency: selectedCategory.currency,

            trainingPriceCents:
              selectedCategory.trainingPriceCents,

            registrationFeeCents:
              selectedCategory.registrationFeeCents,

            totalPriceCents:
              selectedCategory.totalPriceCents,

            pricingVersion:
              selectedCategory.pricingVersion,

            formatted:
              selectedCategory.formatted,
          }
        : null;

  const requiredDocuments =
    page?.requiredDocuments ?? [];

  const readyDocumentCount =
    requiredDocuments.filter(
      (document) => document.ready
    ).length;

  const documentsComplete =
    CORE_DOCUMENT_TYPES.every(
      (type) =>
        requiredDocuments.some(
          (document) =>
            document.type === type &&
            document.ready
        )
    ) &&
    requiredDocuments
      .filter(
        (document) => document.required
      )
      .every(
        (document) => document.ready
      );

  const personalComplete =
    page?.candidate.emailVerified === true;

  const addressComplete =
    form.residentialAddress.trim().length > 0 &&
    form.city.trim().length > 0 &&
    /^\d+$/.test(form.postalCode) &&
    form.postalCode.length ===
      page?.country.postalCode.length;

  const categoryComplete =
    selectedCategory !== null &&
    selectedCategory.enabled &&
    addressComplete;

  const confirmationsComplete =
    form.confirmedInformation &&
    form.acceptedDocumentProcessing;

  const canAttemptSubmission =
    editable &&
    !conflict &&
    personalComplete &&
    categoryComplete &&
    documentsComplete &&
    confirmationsComplete &&
    selectedCategory?.canSubmit === true &&
    page?.application !== null;

  const steps = [
    {
      number: 1 as const,
      label: t.stepPersonal,
      completed: personalComplete,
    },
    {
      number: 2 as const,
      label: t.stepCategory,
      completed: categoryComplete,
    },
    {
      number: 3 as const,
      label: t.stepDocuments,
      completed: documentsComplete,
    },
    {
      number: 4 as const,
      label: t.stepConfirmation,
      completed: confirmationsComplete,
    },
  ];

  /* ========================================================
     27. SECTION NAVIGATION
     ======================================================== */

  function goToSection(
    section: SectionNumber
  ) {
    setOpenSections((previous) => ({
      ...previous,
      [section]: true,
    }));

    window.requestAnimationFrame(() => {
      document
        .getElementById(
          `application-section-${section}`
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    });
  }

  function toggleSection(
    section: SectionNumber
  ) {
    setOpenSections((previous) => ({
      ...previous,

      [section]: !previous[section],
    }));
  }

  /* ========================================================
     28. UPDATE EDITABLE FORM

     Changes to category or address
     invalidate previous confirmations.
     ======================================================== */

  function updateForm<K extends keyof ApplicationForm>(
    field: K,
    value: ApplicationForm[K]
  ) {
    if (interactionDisabled) {
      return;
    }

    const next: ApplicationForm = {
      ...formRef.current,
      [field]: value,
    };

    if (
      field === "category" ||
      field === "residentialAddress" ||
      field === "postalCode" ||
      field === "city"
    ) {
      next.confirmedInformation = false;
      next.acceptedDocumentProcessing = false;
    }

    formRef.current = next;

    setForm(next);
    setNotice("");
    setError("");
    setIssues([]);
  }

  /* ========================================================
     29. RELOAD AUTHORITATIVE DOSSIER
     ======================================================== */

  async function refreshApplication(
    preserveForm = false
  ): Promise<ApplicationPageData> {
    const data = await fetchApplication(
      localeRef.current,
      pageRef.current?.application?.id
    );

    applyServerData(
      data,
      preserveForm
    );

    return data;
  }

  async function handleRefresh() {
    const hasUnsaved = !formsEqual(
      formRef.current,
      savedFormRef.current
    );

    if (
      hasUnsaved &&
      !window.confirm(t.reloadQuestion)
    ) {
      return;
    }

    await runAction(
      "REFRESH",
      async () => {
        await refreshApplication();

        conflictRef.current = false;
        setConflict(false);
        setLoginRequired(false);
      }
    );
  }

  /* ========================================================
     30. PERSIST DRAFT

     POST:
     Create initial draft.

     PATCH:
     Save existing draft with revision.

     Prices and candidate identity are
     never sent from the client.
     ======================================================== */

  async function persistDraft(
    snapshot: ApplicationForm =
      formRef.current,
    visibleNotice = true
  ): Promise<ApplicationPageData> {
    const current = pageRef.current;

    if (
      !current?.permissions.canSaveDraft ||
      conflictRef.current
    ) {
      throw new ApplicationApiError(
        TEXT[localeRef.current].conflict,
        "APPLICATION_CONFLICT",
        409
      );
    }

    const application =
      current.application;

    const requestBody = {
      applicationId:
        application?.id ?? null,

      expectedRevision:
        application?.revision ?? null,

      locale: localeRef.current,

      category:
        snapshot.category || null,

      residentialAddress:
        snapshot.residentialAddress.trim() ||
        null,

      postalCode:
        snapshot.postalCode.trim() || null,

      city:
        snapshot.city.trim() || null,

      confirmedInformation:
        snapshot.confirmedInformation,

      acceptedDocumentProcessing:
        snapshot.acceptedDocumentProcessing,
    };

    const data =
      await jsonRequest<ApplicationPageData>(
        API.application,
        application ? "PATCH" : "POST",
        requestBody
      );

    applyServerData(data);

    /*
     * A draft created concurrently on
     * another device must not be
     * overwritten without review.
     */

    if (!application && data.created === false) {
      conflictRef.current = true;

      setConflict(true);

      throw new ApplicationApiError(
        TEXT[localeRef.current].conflict,
        "APPLICATION_CONFLICT",
        409
      );
    }

    if (!data.application?.id) {
      throw new ApplicationApiError(
        "",
        "INVALID_RESPONSE"
      );
    }

    if (
      visibleNotice &&
      mountedRef.current
    ) {
      setNotice(
        data.message ??
          TEXT[localeRef.current].draftSaved
      );
    }

    return data;
  }

  async function handleSaveDraft() {
    await runAction(
      "SAVE",
      async () => {
        await persistDraft();
      }
    );
  }

  /* ========================================================
     31. INITIAL DRAFT BEFORE FILE UPLOAD

     Save current changes first.
     Required because each uploaded file
     belongs to a real application UUID.
     ======================================================== */

  async function ensureSavedDraft():
    Promise<ApplicationPageData> {
    const current = pageRef.current;

    if (
      !current ||
      !current.permissions.canEdit ||
      conflictRef.current
    ) {
      throw new ApplicationApiError(
        TEXT[localeRef.current].conflict,
        "APPLICATION_CONFLICT",
        409
      );
    }

    const hasUnsavedChanges =
      !formsEqual(
        formRef.current,
        savedFormRef.current
      );

    if (
      !current.application ||
      hasUnsavedChanges
    ) {
      return persistDraft(
        formRef.current,
        false
      );
    }

    return current;
  }

  /* ========================================================
     32. FILE VALIDATION

     Client checks are for usability.
     The server performs authoritative
     binary validation and malware checks.
     ======================================================== */

  function validateFile(
    requirement: RequiredDocument,
    file: File
  ): string | null {
    if (file.size === 0) {
      return t.emptyFile;
    }

    if (
      file.size >
      requirement.maxSizeBytes
    ) {
      return t.fileTooLarge;
    }

    const mimeType =
      file.type.toLowerCase();

    if (
      mimeType &&
      !requirement.allowedMimeTypes.includes(mimeType)
    ) {
      return t.invalidFile;
    }

    const extension =
      file.name
        .split(".")
        .pop()
        ?.toLowerCase();

    const allowedExtensions =
      requirement.allowedMimeTypes.flatMap(
        (mime) => {
          if (mime === "image/jpeg") {
            return ["jpg", "jpeg"];
          }

          if (mime === "image/png") {
            return ["png"];
          }

          if (mime === "application/pdf") {
            return ["pdf"];
          }

          return [];
        }
      );

    if (
      !extension ||
      !allowedExtensions.includes(extension)
    ) {
      return t.invalidFile;
    }

    return null;
  }

  /* ========================================================
     33. UPLOAD OR REPLACE DOCUMENT

     Real multipart request.
     No Base64 files in localStorage.
     No public Supabase URL.
     ======================================================== */

  async function handleUpload(
    requirement: RequiredDocument,
    file: File
  ) {
    if (
      actionRef.current ||
      !pageRef.current?.permissions.canEdit ||
      conflictRef.current
    ) {
      return;
    }

    const validationMessage =
      validateFile(
        requirement,
        file
      );

    if (validationMessage) {
      setError(validationMessage);
      setIssues([]);
      setNotice("");
      return;
    }

    await runAction(
      `UPLOAD:${requirement.type}`,
      async () => {
        const current =
          await ensureSavedDraft();

        const applicationId =
          current.application?.id;

        if (!applicationId) {
          throw new ApplicationApiError(
            "",
            "INVALID_RESPONSE"
          );
        }

        const multipart =
          new FormData();

        multipart.append(
          "applicationId",
          applicationId
        );

        multipart.append(
          "type",
          requirement.type
        );

        multipart.append(
          "file",
          file
        );

        multipart.append(
          "locale",
          localeRef.current
        );

        const result =
          await apiRequest<UploadResult>(
            API.documents,
            {
              method: "POST",
              body: multipart,
            }
          );

        /*
         * Upload changes the dossier
         * revision and invalidates
         * previous confirmations.
         *
         * Reload from PostgreSQL.
         */

        try {
          await refreshApplication();
        } catch (caught) {
          conflictRef.current = true;
          setConflict(true);

          throw caught;
        }

        setNotice(result.message);
      }
    );
  }

  /* ========================================================
     34. DELETE DOCUMENT

     Ownership and draft status are
     enforced by the server.
     ======================================================== */

  async function handleDelete(
    document: ApplicationDocument
  ) {
    if (
      actionRef.current ||
      !pageRef.current?.permissions.canDeleteDocuments ||
      conflictRef.current
    ) {
      return;
    }

    if (
      !window.confirm(t.removeQuestion)
    ) {
      return;
    }

    await runAction(
      `DELETE:${document.id}`,
      async () => {
        const current =
          await ensureSavedDraft();

        const applicationId =
          current.application?.id;

        if (
          !applicationId ||
          document.applicationId !==
            applicationId
        ) {
          throw new ApplicationApiError(
            "",
            "INVALID_RESPONSE"
          );
        }

        const result =
          await jsonRequest<DeleteResult>(
            API.documents,
            "DELETE",
            {
              applicationId,

              documentId:
                document.id,

              locale:
                localeRef.current,
            }
          );

        try {
          await refreshApplication();
        } catch (caught) {
          conflictRef.current = true;
          setConflict(true);

          throw caught;
        }

        setNotice(result.message);
      }
    );
  }

  /* ========================================================
     35. FINAL CLIENT VALIDATION

     The server repeats every check.
     ======================================================== */

  function validateSubmission(
    data: ApplicationPageData,
    snapshot: ApplicationForm
  ): {
    message: string;
    section: SectionNumber;
  } | null {
    const dictionary =
      TEXT[localeRef.current];

    const category =
      data.country.categories.find(
        (item) =>
          item.category === snapshot.category &&
          item.enabled
      );

    if (!category) {
      return {
        message: dictionary.categoryRequired,
        section: 2,
      };
    }

    if (!category.canSubmit) {
      return {
        message: dictionary.priceUnavailable,
        section: 2,
      };
    }

    if (!snapshot.residentialAddress.trim()) {
      return {
        message: dictionary.addressRequired,
        section: 2,
      };
    }

    if (
      !/^\d+$/.test(snapshot.postalCode) ||
      snapshot.postalCode.length !==
        data.country.postalCode.length
    ) {
      return {
        message: dictionary.postalRequired,
        section: 2,
      };
    }

    if (!snapshot.city.trim()) {
      return {
        message: dictionary.cityRequired,
        section: 2,
      };
    }

    const coreDocumentsReady =
      CORE_DOCUMENT_TYPES.every(
        (type) =>
          data.requiredDocuments.some(
            (item) =>
              item.type === type &&
              item.ready === true
          )
      );

    const allRequiredReady =
      data.requiredDocuments
        .filter((item) => item.required)
        .every((item) => item.ready);

    if (
      !coreDocumentsReady ||
      !allRequiredReady
    ) {
      return {
        message: dictionary.documentsRequired,
        section: 3,
      };
    }

    if (
      !snapshot.confirmedInformation ||
      !snapshot.acceptedDocumentProcessing
    ) {
      return {
        message: dictionary.confirmationsRequired,
        section: 4,
      };
    }

    return null;
  }

  /* ========================================================
     36. FINAL APPLICATION SUBMISSION

     Uses existing submit API.

     No direct email calls from client.
     No client-supplied prices.
     No unofficial license issuance.

     Reload current dossier before sending
     to reduce stale cross-device submissions.
     ======================================================== */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const current = pageRef.current;

    if (
      !current ||
      !current.permissions.canEdit ||
      conflictRef.current ||
      actionRef.current ||
      submissionRef.current
    ) {
      return;
    }

    const snapshot = {
      ...formRef.current,
    };

    const validation =
      validateSubmission(
        current,
        snapshot
      );

    if (validation) {
      setError(validation.message);
      setIssues([]);
      setNotice("");

      goToSection(validation.section);

      return;
    }

    const displayedCategory =
      current.country.categories.find(
        (category) =>
          category.category === snapshot.category
      );

    if (!displayedCategory?.canSubmit) {
      setError(t.priceUnavailable);
      return;
    }

    const expectedPricingVersion =
      displayedCategory.pricingVersion;

    await runAction(
      "SUBMIT",
      async () => {
        let draft = pageRef.current;

        if (!draft?.application) {
          draft = await persistDraft(
            snapshot,
            false
          );
        }

        const applicationId =
          draft.application?.id;

        if (!applicationId) {
          throw new ApplicationApiError(
            "",
            "INVALID_RESPONSE"
          );
        }

        /*
         * Recheck actual revision,
         * current prices and documents
         * before final submission.
         */

        const latest =
          await fetchApplication(
            localeRef.current,
            applicationId
          );

        if (
          latest.application?.revision !==
            draft.application?.revision
        ) {
          conflictRef.current = true;
          setConflict(true);

          throw new ApplicationApiError(
            TEXT[localeRef.current].conflict,
            "APPLICATION_CONFLICT",
            409
          );
        }

        const latestCategory =
          latest.country.categories.find(
            (category) =>
              category.category === snapshot.category
          );

        if (
          !latestCategory?.canSubmit ||
          latestCategory.pricingVersion !==
            expectedPricingVersion ||
          latestCategory.totalPriceCents !==
            displayedCategory.totalPriceCents
        ) {
          conflictRef.current = true;
          setConflict(true);

          throw new ApplicationApiError(
            TEXT[localeRef.current].priceUnavailable,
            "PRICE_CHANGED",
            409
          );
        }

        const serverValidation =
          validateSubmission(
            latest,
            snapshot
          );

        if (serverValidation) {
          applyServerData(
            latest,
            true
          );

          goToSection(
            serverValidation.section
          );

          throw new ApplicationApiError(
            serverValidation.message,
            "INVALID_INPUT",
            400
          );
        }

        const result =
          await jsonRequest<SubmissionResult>(
            API.submit,
            "POST",
            {
              applicationId,

              locale:
                localeRef.current,

              expectedPricingVersion,

              category:
                snapshot.category,

              residentialAddress:
                snapshot.residentialAddress.trim(),

              postalCode:
                snapshot.postalCode.trim(),

              city:
                snapshot.city.trim(),

              confirmedInformation:
                snapshot.confirmedInformation,

              acceptedDocumentProcessing:
                snapshot.acceptedDocumentProcessing,
            }
          );

        if (
          result.application?.id !==
            applicationId ||
          !result.application.reference ||
          !result.application.submittedAt
        ) {
          throw new ApplicationApiError(
            "",
            "INVALID_RESPONSE"
          );
        }

        submissionRef.current = true;

        savedFormRef.current =
          snapshot;

        if (mountedRef.current) {
          setSavedForm(snapshot);
          setSubmission(result);
          setError("");
          setIssues([]);
          setNotice("");

          window.scrollTo({
            top: 0,
            behavior: "smooth",
          });
        }
      }
    );
  }

  /* ========================================================
     37. INITIAL LOADING SCREEN
     ======================================================== */

  if (!page && busy === "LOAD") {
    return (
      <div
        dir={rtl ? "rtl" : "ltr"}
        className="flex min-h-[60vh] items-center justify-center px-4"
      >
        <div
          role="status"
          className="flex flex-col items-center gap-4 text-center"
        >
          <span className="flex size-16 items-center justify-center rounded-2xl border border-lime-200 bg-lime-50">
            <LoaderCircle
              size={32}
              className="animate-spin text-green-700"
            />
          </span>

          <p className="text-sm font-semibold text-slate-600">
            {t.loading}
          </p>
        </div>
      </div>
    );
  }

  /* ========================================================
     38. SESSION EXPIRED
     ======================================================== */

  if (loginRequired) {
    return (
      <div
        dir={rtl ? "rtl" : "ltr"}
        className="w-full px-4 py-7"
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <LockKeyhole
            size={36}
            className="mx-auto mb-5 text-green-700"
          />

          <p className="text-sm leading-relaxed text-slate-700">
            {t.loginRequired}
          </p>

          <Link
            href={ROUTES.login}
            className="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-linear-to-r from-green-800 to-lime-600 px-5 py-3 text-sm font-bold text-white"
          >
            {t.login}
          </Link>
        </div>
      </div>
    );
  }

  /* ========================================================
     39. INITIAL LOAD ERROR
     ======================================================== */

  if (!page) {
    return (
      <div
        dir={rtl ? "rtl" : "ltr"}
        className="w-full space-y-4 px-4 py-7"
      >
        <Alert
          type="error"
          message={
            error || t.unexpectedError
          }
          issues={issues}
        />

        <button
          type="button"
          disabled={busy !== null}
          onClick={handleRefresh}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-800 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy !== null ? (
            <LoaderCircle
              size={18}
              className="animate-spin"
            />
          ) : (
            <RefreshCw size={18} />
          )}

          {t.retry}
        </button>
      </div>
    );
  }

  /* ========================================================
     40. FINAL SUBMISSION SUCCESS
     ======================================================== */

  if (submission) {
    return (
      <SubmissionSuccess
        result={submission}
        locale={locale}
        t={t}
      />
    );
  }

  /* ========================================================
     41. RESPONSIVE DISPLAY CONFIGURATION
     ======================================================== */

  const categories =
    page.country.categories.filter(
      (category) => category.enabled
    );

  const selectedIndex =
    categories.findIndex(
      (category) =>
        category.category === form.category
    );

  const visibleCategories =
    showAllCategories || selectedIndex >= 5
      ? categories
      : categories.slice(0, 5);

  const isSubmitted =
    page.application !== null &&
    page.application.status !== "DRAFT";

  const inputClass =
    "min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-lime-500 focus:ring-2 focus:ring-lime-500/15 disabled:cursor-not-allowed disabled:bg-slate-100";

  /* ========================================================
     42. MAIN RESPONSIVE PAGE

     Only the page content is rendered.

     Existing dashboard layout handles:
     - Header
     - Sidebar
     - Mobile navigation
     ======================================================== */

  return (
    <main
      lang={locale}
      dir={rtl ? "rtl" : "ltr"}
      className="min-h-screen min-w-0 bg-[#f4f6f3] text-slate-950"
    >
      <div className="mx-auto w-full max-w-none space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-5 sm:py-5 lg:px-6 lg:pb-8">

        {/* ==================================================
           PAGE HEADER
           ================================================== */}

        <div className="relative overflow-hidden rounded-2xl border border-lime-200 bg-linear-to-r from-lime-100 via-[#edf7df] to-white px-4 py-5 shadow-sm sm:px-6 sm:py-7">
          <div className="pointer-events-none absolute -inset-e-12 -top-20 size-60 rounded-full bg-lime-400/10" />

          <div className="relative flex items-center gap-3 sm:gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-lime-500 to-green-800 text-white shadow-sm sm:size-16">
              <ClipboardList
                size={29}
                strokeWidth={1.8}
                className="sm:size-9"
              />
            </span>

            <div className="min-w-0 flex-1">
              <h1 className="wrap-break-word text-xl font-black tracking-tight text-slate-950 sm:text-3xl lg:text-[34px]">
                {t.title}
              </h1>

              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-700 sm:text-sm lg:text-base">
                {t.subtitle}
              </p>
            </div>

            <div className="hidden shrink-0 items-center gap-2 rounded-full border border-white bg-white/80 px-3 py-2 text-xs font-bold text-green-900 lg:flex">
              <ShieldCheck size={17} />

              {t.secure}
            </div>
          </div>
        </div>

        {/* ==================================================
           DASHBOARD LINK AND SAVE STATUS
           ================================================== */}

        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <Link
            href={ROUTES.dashboard}
            className="inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-slate-600 hover:text-green-800 sm:text-sm"
          >
            <BackIcon size={16} />

            {t.back}
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {editable && (
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-medium sm:text-xs ${
                  dirty
                    ? "text-amber-700"
                    : "text-green-700"
                }`}
              >
                {dirty ? (
                  <Clock3 size={14} />
                ) : (
                  <CheckCircle2 size={14} />
                )}

                {dirty
                  ? t.unsaved
                  : page.application
                    ? t.saved
                    : ""}
              </span>
            )}

            <button
              type="button"
              disabled={busy !== null}
              onClick={handleRefresh}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={
                  busy === "REFRESH"
                    ? "animate-spin"
                    : ""
                }
              />

              {t.refresh}
            </button>
          </div>
        </div>

        {/* ==================================================
           PROGRESS
           ================================================== */}

        <ApplicationProgress
          steps={steps}
          onSelect={goToSection}
        />

        {/* ==================================================
           GLOBAL MESSAGES
           ================================================== */}

        {error && (
          <Alert
            type="error"
            message={error}
            issues={issues}
          />
        )}

        {notice && (
          <Alert
            type="success"
            message={notice}
          />
        )}

        {conflict && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">
              {t.conflict}
            </p>

            <button
              type="button"
              disabled={busy !== null}
              onClick={handleRefresh}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-900 disabled:opacity-50"
            >
              <RefreshCw size={15} />

              {t.refresh}
            </button>
          </div>
        )}

        {/* ==================================================
           PREVIOUSLY SUBMITTED APPLICATION
           ================================================== */}

        {isSubmitted && (
          <div className="space-y-3 rounded-2xl border border-green-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                <FileCheck2 size={23} />
              </span>

              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-green-900">
                  {page.application?.statusLabel}
                </h2>

                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {t.readOnly}
                </p>
              </div>
            </div>

            <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">
                  {t.reference}
                </p>

                <p
                  dir="ltr"
                  className="mt-1 break-all text-sm font-bold"
                >
                  {page.application?.reference}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  {t.submittedAt}
                </p>

                <p className="mt-1 text-sm font-medium">
                  {formatDate(
                    page.application?.submittedAt,
                    locale
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        <form
          noValidate
          onSubmit={handleSubmit}
          className="space-y-3"
        >

          {/* ================================================
             SECTION 1 — PERSONAL INFORMATION
             ================================================ */}

          <NumberedSection
            number={1}
            title={t.personal}
            description={t.personalDescription}
            completed={personalComplete}
            mobileOpen={openSections[1]}
            onToggle={() => toggleSection(1)}
          >
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-200 bg-lime-50 px-3 py-1.5 text-[11px] font-semibold text-green-800">
                <CheckCircle2
                  size={14}
                  className="shrink-0"
                />

                {t.automatic}
              </span>

              {personalComplete && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700">
                  <ShieldCheck size={14} />

                  {t.verified}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4">
              <Field label={{ de: "Geburtsdatum", ar: "تاريخ الميلاد", tr: "Doğum tarihi", es: "Fecha de nacimiento" }[locale]}>
                <div className="flex flex-wrap gap-2">
                  <input type="date" autoComplete="bday" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} aria-label={{ de: "Geburtsdatum", ar: "تاريخ الميلاد", tr: "Doğum tarihi", es: "Fecha de nacimiento" }[locale]} className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm" />
                  <button type="button" onClick={() => void saveBirthDate()} disabled={birthDateSaving || !birthDate} className="min-h-12 rounded-xl bg-green-800 px-4 text-sm font-bold text-white disabled:opacity-50">{{ de: "Speichern", ar: "حفظ", tr: "Kaydet", es: "Guardar" }[locale]}</button>
                </div>
                {birthDateMessage && <p role="status" className="mt-1 text-sm text-slate-700">{birthDateMessage}</p>}
              </Field>
              <ReadOnlyField
                label={t.firstName}
                value={page.candidate.firstName}
                icon={<UserRound size={17} />}
              />

              <ReadOnlyField
                label={t.lastName}
                value={page.candidate.lastName}
                icon={<UserRound size={17} />}
              />

              <ReadOnlyField
                label={t.email}
                value={page.candidate.email}
                icon={<Mail size={17} />}
                ltr
              />

              <ReadOnlyField
                label={t.phone}
                value={page.candidate.phoneE164}
                icon={<Phone size={17} />}
                ltr
              />

              <div className="sm:col-span-2">
                <Field label={t.country}>
                  <div className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-3">
                    <span
                      aria-hidden="true"
                      className="text-xl"
                    >
                      {FLAGS[page.candidate.countryCode]}
                    </span>

                    <span className="min-w-0 flex-1 text-sm font-semibold text-slate-800">
                      {page.candidate.countryName}
                    </span>

                    <LockKeyhole
                      size={15}
                      className="text-slate-400"
                    />
                  </div>
                </Field>
              </div>
            </div>
          </NumberedSection>

          {/* ================================================
             SECTION 2 — CATEGORY AND ADDRESS
             ================================================ */}

          <NumberedSection
            number={2}
            title={t.categoryAddress}
            description={t.categoryDescription}
            completed={categoryComplete}
            mobileOpen={openSections[2]}
            onToggle={() => toggleSection(2)}
          >
            <div className="space-y-5">
              <Field
                label={t.category}
                required
              >
                {categories.length === 0 ? (
                  <Alert
                    type="info"
                    message={t.noCategories}
                  />
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2.5 min-[480px]:grid-cols-3 lg:grid-cols-5">
                      {visibleCategories.map(
                        (category) => (
                          <CategoryCard
                            key={category.category}
                            category={category}
                            selected={
                              form.category ===
                              category.category
                            }
                            disabled={
                              interactionDisabled
                            }
                            locale={locale}
                            t={t}
                            onSelect={() =>
                              updateForm(
                                "category",
                                category.category
                              )
                            }
                          />
                        )
                      )}
                    </div>

                    {categories.length > 5 &&
                      selectedIndex < 5 && (
                        <button
                          type="button"
                          onClick={() =>
                            setShowAllCategories(
                              (previous) =>
                                !previous
                            )
                          }
                          className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:border-lime-500 hover:text-green-800"
                        >
                          {showAllCategories
                            ? t.fewerCategories
                            : t.moreCategories}

                          <ChevronDown
                            size={16}
                            className={
                              showAllCategories
                                ? "rotate-180"
                                : ""
                            }
                          />
                        </button>
                      )}
                  </>
                )}
              </Field>

              {/* Historical selected category remains
                  visible even if removed from the live catalog. */}

              {isSubmitted &&
                !selectedCategory &&
                page.application?.category && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold">
                    {t.category}:{" "}
                    {page.application.category}
                  </div>
                )}

              {selectedCategory?.minimumAge !== null &&
                selectedCategory?.minimumAge !== undefined &&
                !isSubmitted && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Info
                      size={15}
                      className="shrink-0 text-green-700"
                    />

                    {t.age}:{" "}

                    <strong>
                      {selectedCategory.minimumAge}{" "}
                      {t.years}
                    </strong>
                  </div>
                )}

              <PriceSummary
                pricing={pricing}
                category={selectedCategory}
                locale={locale}
                t={t}
                historical={isSubmitted}
              />

              {!pricing &&
                page.country.registrationFeeCents !== null && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-green-900">
                    <span className="font-medium">
                      {t.registrationFee}
                    </span>

                    <strong dir="ltr">
                      {formatPrice(
                        page.country.registrationFeeCents,
                        locale
                      )}
                    </strong>
                  </div>
                )}

              {/* ============================================
                 RESIDENTIAL ADDRESS
                 ============================================ */}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
                <div className="sm:col-span-2 lg:col-span-6">
                  <label
                    htmlFor="residentialAddress"
                    className="mb-1.5 block text-[13px] font-semibold"
                  >
                    {t.residentialAddress}

                    <span className="ms-1 text-red-600">
                      *
                    </span>
                  </label>

                  <div className="relative">
                    <MapPin
                      size={17}
                      className="pointer-events-none absolute inset-s-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      id="residentialAddress"
                      name="residentialAddress"
                      type="text"
                      autoComplete="street-address"
                      required
                      disabled={interactionDisabled}
                      value={form.residentialAddress}
                      maxLength={250}
                      placeholder={t.addressPlaceholder}
                      onChange={(event) =>
                        updateForm(
                          "residentialAddress",
                          event.target.value
                        )
                      }
                      className={`${inputClass} ps-10`}
                    />
                  </div>
                </div>

                <div className="lg:col-span-4">
                  <label
                    htmlFor="city"
                    className="mb-1.5 block text-[13px] font-semibold"
                  >
                    {t.city}

                    <span className="ms-1 text-red-600">
                      *
                    </span>
                  </label>

                  <input
                    id="city"
                    name="city"
                    type="text"
                    autoComplete="address-level2"
                    required
                    disabled={interactionDisabled}
                    maxLength={120}
                    value={form.city}
                    placeholder={t.cityPlaceholder}
                    onChange={(event) =>
                      updateForm(
                        "city",
                        event.target.value
                      )
                    }
                    className={inputClass}
                  />
                </div>

                <div className="lg:col-span-2">
                  <label
                    htmlFor="postalCode"
                    className="mb-1.5 block text-[13px] font-semibold"
                  >
                    {t.postalCode}

                    <span className="ms-1 text-red-600">
                      *
                    </span>
                  </label>

                  <input
                    id="postalCode"
                    name="postalCode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    dir="ltr"
                    required
                    disabled={interactionDisabled}
                    value={form.postalCode}
                    maxLength={
                      page.country.postalCode.length
                    }
                    placeholder={
                      page.country.postalCode.example
                    }
                    onChange={(event) =>
                      updateForm(
                        "postalCode",
                        normalizeDigits(
                          event.target.value
                        )
                          .replace(/\D/g, "")
                          .slice(
                            0,
                            page.country.postalCode.length
                          )
                      )
                    }
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          </NumberedSection>

          {/* ================================================
             SECTION 3 — DOCUMENTS
             ================================================ */}

          <NumberedSection
            number={3}
            title={t.documents}
            description={t.documentDescription}
            completed={documentsComplete}
            mobileOpen={openSections[3]}
            onToggle={() => toggleSection(3)}
          >
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
              <FolderOpen
                size={20}
                className="shrink-0 text-green-700"
              />

              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold">
                  <span>
                    {t.documentLimit}
                  </span>

                  <span
                    dir="ltr"
                    className="tabular-nums text-green-800"
                  >
                    {readyDocumentCount}/
                    {requiredDocuments.length}
                  </span>
                </div>

                <div
                  role="progressbar"
                  aria-label={t.documentLimit}
                  aria-valuemin={0}
                  aria-valuemax={
                    requiredDocuments.length || 1
                  }
                  aria-valuenow={
                    readyDocumentCount
                  }
                  className="h-2 overflow-hidden rounded-full bg-slate-200"
                >
                  <div
                    className="h-full rounded-full bg-linear-to-r from-green-800 to-lime-500 transition-all"
                    style={{
                      width: `${
                        requiredDocuments.length === 0
                          ? 0
                          : (
                              readyDocumentCount /
                              requiredDocuments.length
                            ) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {requiredDocuments.map(
                (requirement) => (
                  <DocumentCard
                    key={requirement.type}
                    requirement={requirement}
                    locale={locale}
                    t={t}
                    editable={
                      editable &&
                      !conflict
                    }
                    busy={busy}
                    onUpload={handleUpload}
                    onDelete={handleDelete}
                  />
                )
              )}
            </div>

            {/* Existing complementary documents. */}

            {page.documents
              .filter(
                (document) =>
                  !requiredDocuments.some(
                    (required) =>
                      required.document?.id ===
                      document.id
                  )
              )
              .map((document) => (
                <div
                  key={document.id}
                  className="mt-3"
                >
                  <DocumentCard
                    requirement={{
                      type: document.type,
                      label: document.label,
                      required: false,

                      allowedMimeTypes: [
                        document.mimeType,
                      ],

                      maxSizeBytes:
                        10 * 1024 * 1024,

                      accept:
                        document.mimeType,

                      uploaded:
                        document.uploadStatus ===
                        "UPLOADED",

                      ready:
                        document.ready,

                      document,
                    }}
                    locale={locale}
                    t={t}
                    editable={
                      editable &&
                      !conflict
                    }
                    busy={busy}
                    onUpload={handleUpload}
                    onDelete={handleDelete}
                  />
                </div>
              ))}

            <div className="mt-4 rounded-xl border border-lime-200 bg-lime-50 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Info
                  size={18}
                  className="text-green-700"
                />

                <h3 className="text-sm font-bold text-green-950">
                  {t.uploadHints}
                </h3>
              </div>

              <div className="grid gap-2.5 text-xs leading-relaxed text-slate-700 sm:grid-cols-2">
                {[
                  `${t.allowedFormats}: PDF, JPG, PNG`,

                  `${t.maxPerFile}: ${
                    formatFileSize(
                      requiredDocuments[0]?.maxSizeBytes ??
                        10 * 1024 * 1024,
                      locale
                    )
                  }`,

                  t.readable,

                  t.protected,
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-2"
                  >
                    <Check
                      size={15}
                      className="mt-0.5 shrink-0 text-green-700"
                    />

                    {item}
                  </div>
                ))}
              </div>
            </div>
          </NumberedSection>

          {/* ================================================
             SECTION 4 — CONFIRMATION
             ================================================ */}

          <NumberedSection
            number={4}
            title={t.confirmation}
            description={t.confirmationDescription}
            completed={confirmationsComplete}
            mobileOpen={openSections[4]}
            onToggle={() => toggleSection(4)}
          >
            <div className="space-y-3">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 hover:border-lime-400">
                <input
                  type="checkbox"
                  name="confirmedInformation"
                  checked={
                    form.confirmedInformation
                  }
                  onChange={(event) =>
                    updateForm(
                      "confirmedInformation",
                      event.target.checked
                    )
                  }
                  disabled={interactionDisabled}
                  required
                  className="mt-0.5 size-5 shrink-0 cursor-pointer rounded border-slate-300 accent-green-700 disabled:cursor-not-allowed"
                />

                <span className="text-sm leading-relaxed text-slate-800">
                  {t.confirmInformation}

                  <span className="ms-1 text-red-600">
                    *
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 hover:border-lime-400">
                <input
                  type="checkbox"
                  name="acceptedDocumentProcessing"
                  checked={
                    form.acceptedDocumentProcessing
                  }
                  onChange={(event) =>
                    updateForm(
                      "acceptedDocumentProcessing",
                      event.target.checked
                    )
                  }
                  disabled={interactionDisabled}
                  required
                  className="mt-0.5 size-5 shrink-0 cursor-pointer rounded border-slate-300 accent-green-700 disabled:cursor-not-allowed"
                />

                <span className="text-sm leading-relaxed text-slate-800">
                  {t.acceptProcessing}

                  <span className="ms-1 text-red-600">
                    *
                  </span>
                </span>
              </label>

              {page.application?.admissionReviewRequired && (
                <Alert
                  type="info"
                  message={t.reviewRequired}
                />
              )}

              {page.application?.admissionReviewIssues &&
                page.application.admissionReviewIssues.length > 0 && (
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    {page.application.admissionReviewIssues.map(
                      (issue, index) => (
                        <div
                          key={`${issue.code}-${index}`}
                          className="flex items-start gap-2 text-xs leading-relaxed text-slate-600"
                        >
                          <Info
                            size={14}
                            className="mt-0.5 shrink-0 text-green-700"
                          />

                          {issue.message}
                        </div>
                      )
                    )}
                  </div>
                )}

              <div className="flex items-start gap-2 pt-1 text-[11px] leading-relaxed text-slate-500">
                <ShieldCheck
                  size={16}
                  className="mt-0.5 shrink-0 text-green-700"
                />

                {t.legalNotice}
              </div>
            </div>
          </NumberedSection>

          {/* ================================================
             ACTION BUTTONS

             Desktop: horizontal actions.
             Mobile: full-width actions.
             ================================================ */}

          {editable && (
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 text-xs text-slate-500">
                  {page.application?.updatedAt && (
                    <p className="flex items-center gap-2">
                      <Clock3
                        size={15}
                        className="shrink-0"
                      />

                      {t.lastSaved}:{" "}

                      {formatDate(
                        page.application.updatedAt,
                        locale
                      )}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-end">
                  <button
                    type="submit"
                    disabled={
                      busy !== null ||
                      !canAttemptSubmission
                    }
                    className="order-1 flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-linear-to-r from-green-800 to-lime-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:from-green-900 hover:to-lime-700 disabled:cursor-not-allowed disabled:opacity-50 sm:order-2 sm:w-auto"
                  >
                    {busy === "SUBMIT" ? (
                      <>
                        <LoaderCircle
                          size={20}
                          className="animate-spin"
                        />

                        {t.submitting}
                      </>
                    ) : (
                      <>
                        <Send size={19} />

                        {t.submit}
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={
                      busy !== null ||
                      conflict ||
                      !page.permissions.canSaveDraft
                    }
                    onClick={handleSaveDraft}
                    className="order-2 flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl border-2 border-lime-600 bg-white px-6 py-3 text-sm font-bold text-green-900 transition-colors hover:bg-lime-50 disabled:cursor-not-allowed disabled:opacity-50 sm:order-1 sm:w-auto"
                  >
                    {busy === "SAVE" ? (
                      <>
                        <LoaderCircle
                          size={19}
                          className="animate-spin"
                        />

                        {t.saving}
                      </>
                    ) : (
                      <>
                        <Save size={19} />

                        {t.saveDraft}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {!canAttemptSubmission &&
                busy === null &&
                !conflict && (
                  <p className="mt-3 text-end text-xs leading-relaxed text-slate-500">
                    {
                      !selectedCategory
                        ? t.categoryRequired
                        : !selectedCategory.canSubmit
                          ? t.priceUnavailable
                          : !form.residentialAddress.trim()
                            ? t.addressRequired
                            : !form.city.trim()
                              ? t.cityRequired
                              : !addressComplete
                                ? t.postalRequired
                                : !documentsComplete
                                  ? t.documentsRequired
                                  : !confirmationsComplete
                                    ? t.confirmationsRequired
                                    : ""
                    }
                  </p>
                )}
            </div>
          )}

          {/* Messages repeated near the action controls,
              so errors remain readable on mobile. */}

          {error && (
            <Alert
              type="error"
              message={error}
              issues={issues}
            />
          )}

          {notice && (
            <Alert
              type="success"
              message={notice}
            />
          )}

        </form>

        <div className="flex items-center justify-center gap-2 py-2 text-xs font-medium text-slate-500">
          <ShieldCheck
            size={15}
            className="text-green-700"
          />

          {t.secure}
        </div>
      </div>
    </main>
  );
}
