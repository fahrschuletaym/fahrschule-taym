
/* ============================================================
   FAHRSCHULE TAYM

   File:
   src/lib/applications/validation.ts

   CENTRAL APPLICATION VALIDATION SERVICE

   Countries:
   DE | AT | BE | IT | ES

   Languages:
   DE | AR | TR | ES

   Currency:
   EUR

   Features:
   - Candidate validation
   - Country validation
   - License category validation
   - Residential address validation
   - Country-specific postal codes
   - Secure server-side pricing
   - Draft validation
   - Final submission validation
   - File extension validation
   - Binary file signature validation
   - Document ownership validation
   - Mandatory document validation
   - Admission review requirements
   - Four-language error messages

   No database connection.
   No external API request.
   No duplicated commercial price catalog.
   ============================================================ */

/* ============================================================
   1. SUPPORTED COUNTRIES
   ============================================================ */

export const SUPPORTED_APPLICATION_COUNTRIES = [
  "DE",
  "AT",
  "BE",
  "IT",
  "ES",
] as const;

export type ApplicationCountry =
  (typeof SUPPORTED_APPLICATION_COUNTRIES)[number];

/* ============================================================
   2. SUPPORTED LANGUAGES
   ============================================================ */

export const SUPPORTED_APPLICATION_LOCALES = [
  "de",
  "ar",
  "tr",
  "es",
] as const;

export type ApplicationLocale =
  (typeof SUPPORTED_APPLICATION_LOCALES)[number];

export const DEFAULT_APPLICATION_LOCALE:
  ApplicationLocale = "de";

/* ============================================================
   3. SUPPORTED LICENSE CATEGORIES
   ============================================================ */

export const LICENSE_CATEGORIES = [
  "AM",
  "A1",
  "A2",
  "A",
  "B",
  "BE",
  "C1",
  "C1E",
  "C",
  "CE",
  "D1",
  "D1E",
  "D",
  "DE",
] as const;

export type LicenseCategory =
  (typeof LICENSE_CATEGORIES)[number];

/* ============================================================
   4. APPLICATION DOCUMENT TYPES
   ============================================================ */

export const APPLICATION_DOCUMENT_TYPES = [
  "IDENTITY_FRONT",
  "IDENTITY_BACK",
  "ADDRESS_PROOF",
  "SIGNATURE",
  "PASSPORT_PHOTO",
  "EXISTING_DRIVING_LICENSE",
  "MEDICAL_CERTIFICATE",
  "VISION_TEST",
  "FIRST_AID_CERTIFICATE",
  "RESIDENCE_PERMIT",
  "OTHER",
] as const;

export type ApplicationDocumentType =
  (typeof APPLICATION_DOCUMENT_TYPES)[number];

/* ============================================================
   5. FIVE MANDATORY DOCUMENTS
   ============================================================ */

export const REQUIRED_DOCUMENT_TYPES = [
  "IDENTITY_FRONT",
  "IDENTITY_BACK",
  "ADDRESS_PROOF",
  "SIGNATURE",
  "PASSPORT_PHOTO",
] as const satisfies readonly ApplicationDocumentType[];

export type RequiredApplicationDocumentType =
  (typeof REQUIRED_DOCUMENT_TYPES)[number];

/* ============================================================
   6. VALIDATION LIMITS
   ============================================================ */

export const MAX_DOCUMENT_SIZE_BYTES =
  10 * 1024 * 1024;

export const MAX_APPLICATION_DOCUMENTS = 20;

export const MAX_DOCUMENT_FILE_NAME_LENGTH = 180;

export const MAX_RESIDENTIAL_ADDRESS_LENGTH = 250;

export const MAX_CITY_LENGTH = 120;

export const MIN_RESIDENTIAL_ADDRESS_LENGTH = 3;

export const MIN_CITY_LENGTH = 2;

export const GERMANY_REGISTRATION_FEE_CENTS =
  20_900;

export const APPLICATION_CURRENCY =
  "EUR" as const;

/*
 * PostgreSQL INTEGER maximum.
 * Prevents invalid money values from
 * being written to our database.
 */

const MAX_DATABASE_INTEGER = 2_147_483_647;

/* ============================================================
   7. COUNTRY POSTAL CODE RULES
   ============================================================ */

export const POSTAL_CODE_RULES: Record<
  ApplicationCountry,
  {
    length: number;
    example: string;
    pattern: RegExp;
  }
> = {
  DE: {
    length: 5,
    example: "13509",
    pattern: /^\d{5}$/,
  },

  AT: {
    length: 4,
    example: "1010",
    pattern: /^[1-9]\d{3}$/,
  },

  BE: {
    length: 4,
    example: "1000",
    pattern: /^[1-9]\d{3}$/,
  },

  IT: {
    length: 5,
    example: "00118",
    pattern: /^\d{5}$/,
  },

  ES: {
    length: 5,
    example: "28001",

    /*
     * Spanish provincial prefixes:
     * 01 through 52.
     */

    pattern: /^(?:0[1-9]|[1-4]\d|5[0-2])\d{3}$/,
  },
};

/* ============================================================
   8. LOCALIZED COUNTRY NAMES
   ============================================================ */

export const COUNTRY_NAMES: Record<
  ApplicationCountry,
  Record<ApplicationLocale, string>
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
   9. SUPPORTED FILE FORMATS
   ============================================================ */

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;

export type AllowedDocumentMimeType =
  (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number];

const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
] as const;

const STANDARD_DOCUMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
] as const;

const DOCUMENT_MIME_TYPES: Record<
  ApplicationDocumentType,
  readonly AllowedDocumentMimeType[]
> = {
  IDENTITY_FRONT:
    STANDARD_DOCUMENT_MIME_TYPES,

  IDENTITY_BACK:
    STANDARD_DOCUMENT_MIME_TYPES,

  ADDRESS_PROOF:
    STANDARD_DOCUMENT_MIME_TYPES,

  SIGNATURE:
    IMAGE_MIME_TYPES,

  PASSPORT_PHOTO:
    IMAGE_MIME_TYPES,

  EXISTING_DRIVING_LICENSE:
    STANDARD_DOCUMENT_MIME_TYPES,

  MEDICAL_CERTIFICATE:
    STANDARD_DOCUMENT_MIME_TYPES,

  VISION_TEST:
    STANDARD_DOCUMENT_MIME_TYPES,

  FIRST_AID_CERTIFICATE:
    STANDARD_DOCUMENT_MIME_TYPES,

  RESIDENCE_PERMIT:
    STANDARD_DOCUMENT_MIME_TYPES,

  OTHER:
    STANDARD_DOCUMENT_MIME_TYPES,
};

const MIME_EXTENSIONS: Record<
  AllowedDocumentMimeType,
  readonly string[]
> = {
  "image/jpeg": ["jpg", "jpeg"],

  "image/png": ["png"],

  "application/pdf": ["pdf"],
};

/* ============================================================
   10. DOCUMENT LABELS — FOUR LANGUAGES
   ============================================================ */

const DOCUMENT_LABELS: Record<
  ApplicationDocumentType,
  Record<ApplicationLocale, string>
> = {
  IDENTITY_FRONT: {
    de: "Ausweisdokument – Vorderseite",
    ar: "الوجه الأمامي لوثيقة الهوية",
    tr: "Kimlik belgesi – Ön yüz",
    es: "Documento de identidad – Anverso",
  },

  IDENTITY_BACK: {
    de: "Ausweisdokument – Rückseite",
    ar: "الوجه الخلفي لوثيقة الهوية",
    tr: "Kimlik belgesi – Arka yüz",
    es: "Documento de identidad – Reverso",
  },

  ADDRESS_PROOF: {
    de: "Wohnsitznachweis",
    ar: "إثبات عنوان الإقامة",
    tr: "İkamet belgesi",
    es: "Justificante de domicilio",
  },

  SIGNATURE: {
    de: "Handschriftliche Unterschrift",
    ar: "التوقيع بخط اليد",
    tr: "El yazısı imza",
    es: "Firma manuscrita",
  },

  PASSPORT_PHOTO: {
    de: "Biometrisches Passfoto",
    ar: "صورة شخصية بيومترية",
    tr: "Biyometrik fotoğraf",
    es: "Fotografía biométrica",
  },

  EXISTING_DRIVING_LICENSE: {
    de: "Vorhandener Führerschein",
    ar: "رخصة القيادة الحالية",
    tr: "Mevcut ehliyet",
    es: "Permiso de conducir existente",
  },

  MEDICAL_CERTIFICATE: {
    de: "Ärztliche Bescheinigung",
    ar: "شهادة طبية",
    tr: "Sağlık raporu",
    es: "Certificado médico",
  },

  VISION_TEST: {
    de: "Sehtestbescheinigung",
    ar: "شهادة فحص النظر",
    tr: "Görme testi belgesi",
    es: "Certificado de examen visual",
  },

  FIRST_AID_CERTIFICATE: {
    de: "Erste-Hilfe-Nachweis",
    ar: "شهادة الإسعافات الأولية",
    tr: "İlk yardım belgesi",
    es: "Certificado de primeros auxilios",
  },

  RESIDENCE_PERMIT: {
    de: "Aufenthaltstitel",
    ar: "تصريح الإقامة",
    tr: "Oturma izni",
    es: "Permiso de residencia",
  },

  OTHER: {
    de: "Weiteres Dokument",
    ar: "مستند إضافي",
    tr: "Ek belge",
    es: "Documento adicional",
  },
};

/* ============================================================
   11. APPLICATION ERROR CODES
   ============================================================ */

export type ApplicationErrorCode =
  | "INVALID_INPUT"
  | "UNAUTHORIZED"
  | "INVALID_SESSION"
  | "ACCOUNT_UNAVAILABLE"
  | "ACCOUNT_NOT_VERIFIED"
  | "UNSUPPORTED_COUNTRY"
  | "COUNTRY_MISMATCH"
  | "INVALID_CATEGORY"
  | "CATEGORY_REQUIRED"
  | "CATEGORY_UNAVAILABLE"
  | "ADDRESS_REQUIRED"
  | "INVALID_ADDRESS"
  | "POSTAL_CODE_REQUIRED"
  | "INVALID_POSTAL_CODE"
  | "CITY_REQUIRED"
  | "INVALID_CITY"
  | "INVALID_CONFIRMATION"
  | "INFORMATION_CONFIRMATION_REQUIRED"
  | "DOCUMENT_PROCESSING_REQUIRED"
  | "PRICING_UNAVAILABLE"
  | "INVALID_PRICING"
  | "PRICE_CHANGED"
  | "INVALID_APPLICATION_STATE"
  | "APPLICATION_NOT_FOUND"
  | "APPLICATION_CONFLICT"
  | "INVALID_DOCUMENT_TYPE"
  | "INVALID_DOCUMENT"
  | "INVALID_FILE"
  | "INVALID_FILE_NAME"
  | "INVALID_FILE_TYPE"
  | "UNSUPPORTED_FILE_TYPE"
  | "INVALID_FILE_SIZE"
  | "FILE_TOO_LARGE"
  | "EMPTY_FILE"
  | "FILE_CONTENT_MISMATCH"
  | "MISSING_DOCUMENT"
  | "DOCUMENT_REQUIRED"
  | "DOCUMENT_NOT_FOUND"
  | "DOCUMENT_NOT_READY"
  | "DOCUMENT_REJECTED"
  | "DOCUMENT_UNAVAILABLE"
  | "DOCUMENT_ACCESS_DENIED"
  | "DUPLICATE_DOCUMENT"
  | "TOO_MANY_DOCUMENTS"
  | "UPLOAD_FAILED"
  | "DELETE_FAILED"
  | "STORAGE_UNAVAILABLE"
  | "STORAGE_UPLOAD_FAILED"
  | "STORAGE_DOWNLOAD_FAILED"
  | "STORAGE_DELETE_FAILED"
  | "INVALID_JSON"
  | "FORBIDDEN_ORIGIN"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "REQUEST_TIMEOUT"
  | "TOO_MANY_REQUESTS"
  | "DATABASE_UNAVAILABLE"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

/* ============================================================
   12. VALIDATION ISSUE
   ============================================================ */

export type ValidationIssue = {
  code: ApplicationErrorCode;

  field: string;

  message: string;

  documentType?: ApplicationDocumentType;
};

/* ============================================================
   13. MULTILINGUAL ERROR MESSAGES
   ============================================================ */

const ERROR_MESSAGES: Record<
  ApplicationLocale,
  Record<ApplicationErrorCode, string>
> = {
  /* ========================================================
     GERMAN
     ======================================================== */

  de: {
    INVALID_INPUT:
      "Die eingegebenen Daten sind ungültig.",

    UNAUTHORIZED:
      "Bitte melden Sie sich an.",

    INVALID_SESSION:
      "Ihre Sitzung ist ungültig oder abgelaufen.",

    ACCOUNT_UNAVAILABLE:
      "Ihr Konto ist derzeit nicht verfügbar.",

    ACCOUNT_NOT_VERIFIED:
      "Bitte bestätigen Sie Ihre E-Mail-Adresse und Telefonnummer.",

    UNSUPPORTED_COUNTRY:
      "Dieses Land wird derzeit nicht unterstützt.",

    COUNTRY_MISMATCH:
      "Das Land stimmt nicht mit Ihrem Konto überein.",

    INVALID_CATEGORY:
      "Die Führerscheinklasse ist ungültig.",

    CATEGORY_REQUIRED:
      "Bitte wählen Sie eine Führerscheinklasse.",

    CATEGORY_UNAVAILABLE:
      "Diese Führerscheinklasse ist derzeit nicht verfügbar.",

    ADDRESS_REQUIRED:
      "Bitte geben Sie Ihre Wohnadresse ein.",

    INVALID_ADDRESS:
      "Bitte geben Sie eine gültige Wohnadresse ein.",

    POSTAL_CODE_REQUIRED:
      "Bitte geben Sie Ihre Postleitzahl ein.",

    INVALID_POSTAL_CODE:
      "Die Postleitzahl ist für dieses Land ungültig.",

    CITY_REQUIRED:
      "Bitte geben Sie Ihre Stadt ein.",

    INVALID_CITY:
      "Bitte geben Sie einen gültigen Städtenamen ein.",

    INVALID_CONFIRMATION:
      "Die Bestätigung ist ungültig.",

    INFORMATION_CONFIRMATION_REQUIRED:
      "Bitte bestätigen Sie die Richtigkeit Ihrer Angaben.",

    DOCUMENT_PROCESSING_REQUIRED:
      "Bitte bestätigen Sie die Verarbeitung Ihrer Unterlagen.",

    PRICING_UNAVAILABLE:
      "Der Preis ist noch nicht bestätigt oder nicht verfügbar.",

    INVALID_PRICING:
      "Die Preiskonfiguration ist ungültig.",

    PRICE_CHANGED:
      "Der Preis wurde geändert. Bitte prüfen Sie den aktuellen Betrag.",

    INVALID_APPLICATION_STATE:
      "Dieser Antrag kann nicht mehr geändert werden.",

    APPLICATION_NOT_FOUND:
      "Der Antrag wurde nicht gefunden.",

    APPLICATION_CONFLICT:
      "Der Antrag wurde geändert. Bitte aktualisieren Sie die Daten.",

    INVALID_DOCUMENT_TYPE:
      "Der Dokumenttyp ist ungültig.",

    INVALID_DOCUMENT:
      "Das Dokument ist ungültig.",

    INVALID_FILE:
      "Die ausgewählte Datei ist ungültig.",

    INVALID_FILE_NAME:
      "Der Dateiname ist ungültig.",

    INVALID_FILE_TYPE:
      "Das Dateiformat ist ungültig.",

    UNSUPPORTED_FILE_TYPE:
      "Dieses Dateiformat wird nicht unterstützt.",

    INVALID_FILE_SIZE:
      "Die Dateigröße ist ungültig.",

    FILE_TOO_LARGE:
      "Die Datei darf maximal 10 MB groß sein.",

    EMPTY_FILE:
      "Die ausgewählte Datei ist leer.",

    FILE_CONTENT_MISMATCH:
      "Der Dateiinhalt entspricht nicht dem angegebenen Dateiformat.",

    MISSING_DOCUMENT:
      "Ein erforderliches Dokument fehlt.",

    DOCUMENT_REQUIRED:
      "Bitte laden Sie das erforderliche Dokument hoch.",

    DOCUMENT_NOT_FOUND:
      "Das Dokument wurde nicht gefunden.",

    DOCUMENT_NOT_READY:
      "Die Sicherheitsprüfung des Dokuments ist noch nicht abgeschlossen.",

    DOCUMENT_REJECTED:
      "Das Dokument wurde abgelehnt. Bitte laden Sie eine geeignete Datei hoch.",

    DOCUMENT_UNAVAILABLE:
      "Das Dokument ist derzeit nicht verfügbar.",

    DOCUMENT_ACCESS_DENIED:
      "Der Zugriff auf dieses Dokument ist nicht erlaubt.",

    DUPLICATE_DOCUMENT:
      "Dieser Dokumenttyp wurde mehrfach hinzugefügt.",

    TOO_MANY_DOCUMENTS:
      "Die maximale Anzahl an Dokumenten wurde erreicht.",

    UPLOAD_FAILED:
      "Die Datei konnte nicht hochgeladen werden.",

    DELETE_FAILED:
      "Das Dokument konnte nicht entfernt werden.",

    STORAGE_UNAVAILABLE:
      "Der Dokumentenspeicher ist vorübergehend nicht verfügbar.",

    STORAGE_UPLOAD_FAILED:
      "Die Datei konnte nicht gespeichert werden.",

    STORAGE_DOWNLOAD_FAILED:
      "Die Datei konnte nicht geladen werden.",

    STORAGE_DELETE_FAILED:
      "Die Datei konnte nicht gelöscht werden.",

    INVALID_JSON:
      "Die Anfrage enthält ungültige Daten.",

    FORBIDDEN_ORIGIN:
      "Diese Anfrage ist nicht erlaubt.",

    UNSUPPORTED_MEDIA_TYPE:
      "Das Anfrageformat wird nicht unterstützt.",

    PAYLOAD_TOO_LARGE:
      "Die Anfrage ist zu groß.",

    REQUEST_TIMEOUT:
      "Die Anfrage hat zu lange gedauert.",

    TOO_MANY_REQUESTS:
      "Zu viele Anfragen. Bitte versuchen Sie es später erneut.",

    DATABASE_UNAVAILABLE:
      "Die Daten sind vorübergehend nicht verfügbar.",

    SERVICE_UNAVAILABLE:
      "Der Dienst ist vorübergehend nicht verfügbar.",

    INTERNAL_ERROR:
      "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
  },

  /* ========================================================
     ARABIC
     ======================================================== */

  ar: {
    INVALID_INPUT:
      "البيانات المدخلة غير صالحة.",

    UNAUTHORIZED:
      "يرجى تسجيل الدخول.",

    INVALID_SESSION:
      "جلسة تسجيل الدخول غير صالحة أو منتهية.",

    ACCOUNT_UNAVAILABLE:
      "حسابك غير متاح حالياً.",

    ACCOUNT_NOT_VERIFIED:
      "يرجى تأكيد بريدك الإلكتروني ورقم هاتفك.",

    UNSUPPORTED_COUNTRY:
      "هذه الدولة غير مدعومة حالياً.",

    COUNTRY_MISMATCH:
      "الدولة لا تتطابق مع الدولة المسجلة في حسابك.",

    INVALID_CATEGORY:
      "فئة رخصة القيادة غير صالحة.",

    CATEGORY_REQUIRED:
      "يرجى اختيار فئة رخصة القيادة.",

    CATEGORY_UNAVAILABLE:
      "فئة رخصة القيادة هذه غير متاحة حالياً.",

    ADDRESS_REQUIRED:
      "يرجى إدخال عنوان إقامتك.",

    INVALID_ADDRESS:
      "يرجى إدخال عنوان إقامة صالح.",

    POSTAL_CODE_REQUIRED:
      "يرجى إدخال الرمز البريدي.",

    INVALID_POSTAL_CODE:
      "الرمز البريدي غير صالح لهذه الدولة.",

    CITY_REQUIRED:
      "يرجى إدخال اسم المدينة.",

    INVALID_CITY:
      "يرجى إدخال اسم مدينة صالح.",

    INVALID_CONFIRMATION:
      "التأكيد غير صالح.",

    INFORMATION_CONFIRMATION_REQUIRED:
      "يرجى تأكيد صحة المعلومات المدخلة.",

    DOCUMENT_PROCESSING_REQUIRED:
      "يرجى تأكيد معالجة مستنداتك.",

    PRICING_UNAVAILABLE:
      "السعر غير مؤكد أو غير متاح حالياً.",

    INVALID_PRICING:
      "إعدادات السعر غير صالحة.",

    PRICE_CHANGED:
      "تم تغيير السعر. يرجى مراجعة المبلغ الحالي.",

    INVALID_APPLICATION_STATE:
      "لا يمكن تعديل هذا الطلب بعد الآن.",

    APPLICATION_NOT_FOUND:
      "لم يتم العثور على الطلب.",

    APPLICATION_CONFLICT:
      "تم تعديل الطلب. يرجى تحديث البيانات.",

    INVALID_DOCUMENT_TYPE:
      "نوع المستند غير صالح.",

    INVALID_DOCUMENT:
      "المستند غير صالح.",

    INVALID_FILE:
      "الملف المحدد غير صالح.",

    INVALID_FILE_NAME:
      "اسم الملف غير صالح.",

    INVALID_FILE_TYPE:
      "صيغة الملف غير صالحة.",

    UNSUPPORTED_FILE_TYPE:
      "صيغة الملف غير مدعومة.",

    INVALID_FILE_SIZE:
      "حجم الملف غير صالح.",

    FILE_TOO_LARGE:
      "يجب ألا يتجاوز حجم الملف 10 ميغابايت.",

    EMPTY_FILE:
      "الملف المحدد فارغ.",

    FILE_CONTENT_MISMATCH:
      "محتوى الملف لا يتطابق مع الصيغة المحددة.",

    MISSING_DOCUMENT:
      "أحد المستندات المطلوبة مفقود.",

    DOCUMENT_REQUIRED:
      "يرجى رفع المستند المطلوب.",

    DOCUMENT_NOT_FOUND:
      "لم يتم العثور على المستند.",

    DOCUMENT_NOT_READY:
      "لم يكتمل فحص أمان المستند بعد.",

    DOCUMENT_REJECTED:
      "تم رفض المستند. يرجى رفع ملف مناسب.",

    DOCUMENT_UNAVAILABLE:
      "المستند غير متاح حالياً.",

    DOCUMENT_ACCESS_DENIED:
      "لا يسمح بالوصول إلى هذا المستند.",

    DUPLICATE_DOCUMENT:
      "تمت إضافة هذا النوع من المستندات أكثر من مرة.",

    TOO_MANY_DOCUMENTS:
      "تم الوصول إلى الحد الأقصى لعدد المستندات.",

    UPLOAD_FAILED:
      "تعذر رفع الملف.",

    DELETE_FAILED:
      "تعذر إزالة المستند.",

    STORAGE_UNAVAILABLE:
      "خدمة تخزين المستندات غير متاحة مؤقتاً.",

    STORAGE_UPLOAD_FAILED:
      "تعذر حفظ الملف.",

    STORAGE_DOWNLOAD_FAILED:
      "تعذر تحميل الملف.",

    STORAGE_DELETE_FAILED:
      "تعذر حذف الملف.",

    INVALID_JSON:
      "يحتوي الطلب على بيانات غير صالحة.",

    FORBIDDEN_ORIGIN:
      "هذا الطلب غير مسموح به.",

    UNSUPPORTED_MEDIA_TYPE:
      "تنسيق الطلب غير مدعوم.",

    PAYLOAD_TOO_LARGE:
      "حجم الطلب كبير جداً.",

    REQUEST_TIMEOUT:
      "استغرق الطلب وقتاً طويلاً.",

    TOO_MANY_REQUESTS:
      "طلبات كثيرة جداً. يرجى المحاولة لاحقاً.",

    DATABASE_UNAVAILABLE:
      "البيانات غير متاحة مؤقتاً.",

    SERVICE_UNAVAILABLE:
      "الخدمة غير متاحة مؤقتاً.",

    INTERNAL_ERROR:
      "حدث خطأ. يرجى المحاولة مرة أخرى.",
  },

  /* ========================================================
     TURKISH
     ======================================================== */

  tr: {
    INVALID_INPUT:
      "Girilen bilgiler geçersiz.",

    UNAUTHORIZED:
      "Lütfen giriş yapın.",

    INVALID_SESSION:
      "Oturumunuz geçersiz veya süresi dolmuş.",

    ACCOUNT_UNAVAILABLE:
      "Hesabınız şu anda kullanılamıyor.",

    ACCOUNT_NOT_VERIFIED:
      "E-posta adresinizi ve telefon numaranızı doğrulayın.",

    UNSUPPORTED_COUNTRY:
      "Bu ülke şu anda desteklenmiyor.",

    COUNTRY_MISMATCH:
      "Ülke, hesabınızda kayıtlı ülkeyle eşleşmiyor.",

    INVALID_CATEGORY:
      "Ehliyet sınıfı geçersiz.",

    CATEGORY_REQUIRED:
      "Lütfen bir ehliyet sınıfı seçin.",

    CATEGORY_UNAVAILABLE:
      "Bu ehliyet sınıfı şu anda kullanılamıyor.",

    ADDRESS_REQUIRED:
      "Lütfen ikamet adresinizi girin.",

    INVALID_ADDRESS:
      "Geçerli bir ikamet adresi girin.",

    POSTAL_CODE_REQUIRED:
      "Lütfen posta kodunuzu girin.",

    INVALID_POSTAL_CODE:
      "Posta kodu bu ülke için geçersiz.",

    CITY_REQUIRED:
      "Lütfen şehir adını girin.",

    INVALID_CITY:
      "Geçerli bir şehir adı girin.",

    INVALID_CONFIRMATION:
      "Onay geçersiz.",

    INFORMATION_CONFIRMATION_REQUIRED:
      "Bilgilerinizin doğruluğunu onaylayın.",

    DOCUMENT_PROCESSING_REQUIRED:
      "Belgelerinizin işlenmesini onaylayın.",

    PRICING_UNAVAILABLE:
      "Fiyat henüz onaylanmadı veya kullanılamıyor.",

    INVALID_PRICING:
      "Fiyat yapılandırması geçersiz.",

    PRICE_CHANGED:
      "Fiyat değişti. Güncel tutarı kontrol edin.",

    INVALID_APPLICATION_STATE:
      "Bu başvuru artık değiştirilemez.",

    APPLICATION_NOT_FOUND:
      "Başvuru bulunamadı.",

    APPLICATION_CONFLICT:
      "Başvuru değiştirildi. Güncel verileri yükleyin.",

    INVALID_DOCUMENT_TYPE:
      "Belge türü geçersiz.",

    INVALID_DOCUMENT:
      "Belge geçersiz.",

    INVALID_FILE:
      "Seçilen dosya geçersiz.",

    INVALID_FILE_NAME:
      "Dosya adı geçersiz.",

    INVALID_FILE_TYPE:
      "Dosya biçimi geçersiz.",

    UNSUPPORTED_FILE_TYPE:
      "Bu dosya biçimi desteklenmiyor.",

    INVALID_FILE_SIZE:
      "Dosya boyutu geçersiz.",

    FILE_TOO_LARGE:
      "Dosya boyutu en fazla 10 MB olabilir.",

    EMPTY_FILE:
      "Seçilen dosya boş.",

    FILE_CONTENT_MISMATCH:
      "Dosya içeriği belirtilen biçimle eşleşmiyor.",

    MISSING_DOCUMENT:
      "Gerekli bir belge eksik.",

    DOCUMENT_REQUIRED:
      "Lütfen gerekli belgeyi yükleyin.",

    DOCUMENT_NOT_FOUND:
      "Belge bulunamadı.",

    DOCUMENT_NOT_READY:
      "Belgenin güvenlik kontrolü henüz tamamlanmadı.",

    DOCUMENT_REJECTED:
      "Belge reddedildi. Uygun bir dosya yükleyin.",

    DOCUMENT_UNAVAILABLE:
      "Belge şu anda kullanılamıyor.",

    DOCUMENT_ACCESS_DENIED:
      "Bu belgeye erişim izniniz yok.",

    DUPLICATE_DOCUMENT:
      "Bu belge türü birden fazla kez eklendi.",

    TOO_MANY_DOCUMENTS:
      "Azami belge sayısına ulaşıldı.",

    UPLOAD_FAILED:
      "Dosya yüklenemedi.",

    DELETE_FAILED:
      "Belge kaldırılamadı.",

    STORAGE_UNAVAILABLE:
      "Belge depolama hizmeti geçici olarak kullanılamıyor.",

    STORAGE_UPLOAD_FAILED:
      "Dosya kaydedilemedi.",

    STORAGE_DOWNLOAD_FAILED:
      "Dosya indirilemedi.",

    STORAGE_DELETE_FAILED:
      "Dosya silinemedi.",

    INVALID_JSON:
      "İstek geçersiz veriler içeriyor.",

    FORBIDDEN_ORIGIN:
      "Bu isteğe izin verilmiyor.",

    UNSUPPORTED_MEDIA_TYPE:
      "İstek biçimi desteklenmiyor.",

    PAYLOAD_TOO_LARGE:
      "İstek çok büyük.",

    REQUEST_TIMEOUT:
      "İstek zaman aşımına uğradı.",

    TOO_MANY_REQUESTS:
      "Çok fazla istek gönderildi. Daha sonra tekrar deneyin.",

    DATABASE_UNAVAILABLE:
      "Veriler geçici olarak kullanılamıyor.",

    SERVICE_UNAVAILABLE:
      "Hizmet geçici olarak kullanılamıyor.",

    INTERNAL_ERROR:
      "Bir hata oluştu. Lütfen tekrar deneyin.",
  },

  /* ========================================================
     SPANISH
     ======================================================== */

  es: {
    INVALID_INPUT:
      "Los datos introducidos no son válidos.",

    UNAUTHORIZED:
      "Inicie sesión.",

    INVALID_SESSION:
      "Su sesión no es válida o ha caducado.",

    ACCOUNT_UNAVAILABLE:
      "Su cuenta no está disponible actualmente.",

    ACCOUNT_NOT_VERIFIED:
      "Verifique su correo electrónico y número de teléfono.",

    UNSUPPORTED_COUNTRY:
      "Este país no es compatible actualmente.",

    COUNTRY_MISMATCH:
      "El país no coincide con el registrado en su cuenta.",

    INVALID_CATEGORY:
      "La categoría del permiso no es válida.",

    CATEGORY_REQUIRED:
      "Seleccione una categoría del permiso.",

    CATEGORY_UNAVAILABLE:
      "Esta categoría no está disponible actualmente.",

    ADDRESS_REQUIRED:
      "Introduzca su domicilio.",

    INVALID_ADDRESS:
      "Introduzca un domicilio válido.",

    POSTAL_CODE_REQUIRED:
      "Introduzca su código postal.",

    INVALID_POSTAL_CODE:
      "El código postal no es válido para este país.",

    CITY_REQUIRED:
      "Introduzca el nombre de su ciudad.",

    INVALID_CITY:
      "Introduzca un nombre de ciudad válido.",

    INVALID_CONFIRMATION:
      "La confirmación no es válida.",

    INFORMATION_CONFIRMATION_REQUIRED:
      "Confirme la exactitud de sus datos.",

    DOCUMENT_PROCESSING_REQUIRED:
      "Confirme el tratamiento de sus documentos.",

    PRICING_UNAVAILABLE:
      "El precio aún no está confirmado o no está disponible.",

    INVALID_PRICING:
      "La configuración del precio no es válida.",

    PRICE_CHANGED:
      "El precio ha cambiado. Revise el importe actual.",

    INVALID_APPLICATION_STATE:
      "Esta solicitud ya no puede modificarse.",

    APPLICATION_NOT_FOUND:
      "No se ha encontrado la solicitud.",

    APPLICATION_CONFLICT:
      "La solicitud ha cambiado. Actualice los datos.",

    INVALID_DOCUMENT_TYPE:
      "El tipo de documento no es válido.",

    INVALID_DOCUMENT:
      "El documento no es válido.",

    INVALID_FILE:
      "El archivo seleccionado no es válido.",

    INVALID_FILE_NAME:
      "El nombre del archivo no es válido.",

    INVALID_FILE_TYPE:
      "El formato del archivo no es válido.",

    UNSUPPORTED_FILE_TYPE:
      "Este formato de archivo no es compatible.",

    INVALID_FILE_SIZE:
      "El tamaño del archivo no es válido.",

    FILE_TOO_LARGE:
      "El archivo no puede superar los 10 MB.",

    EMPTY_FILE:
      "El archivo seleccionado está vacío.",

    FILE_CONTENT_MISMATCH:
      "El contenido del archivo no coincide con el formato indicado.",

    MISSING_DOCUMENT:
      "Falta un documento obligatorio.",

    DOCUMENT_REQUIRED:
      "Suba el documento requerido.",

    DOCUMENT_NOT_FOUND:
      "No se ha encontrado el documento.",

    DOCUMENT_NOT_READY:
      "La comprobación de seguridad del documento aún no ha finalizado.",

    DOCUMENT_REJECTED:
      "El documento ha sido rechazado. Suba un archivo adecuado.",

    DOCUMENT_UNAVAILABLE:
      "El documento no está disponible actualmente.",

    DOCUMENT_ACCESS_DENIED:
      "No tiene permiso para acceder a este documento.",

    DUPLICATE_DOCUMENT:
      "Este tipo de documento se ha añadido más de una vez.",

    TOO_MANY_DOCUMENTS:
      "Se ha alcanzado el número máximo de documentos.",

    UPLOAD_FAILED:
      "No se pudo subir el archivo.",

    DELETE_FAILED:
      "No se pudo eliminar el documento.",

    STORAGE_UNAVAILABLE:
      "El almacenamiento de documentos no está disponible temporalmente.",

    STORAGE_UPLOAD_FAILED:
      "No se pudo guardar el archivo.",

    STORAGE_DOWNLOAD_FAILED:
      "No se pudo descargar el archivo.",

    STORAGE_DELETE_FAILED:
      "No se pudo borrar el archivo.",

    INVALID_JSON:
      "La solicitud contiene datos no válidos.",

    FORBIDDEN_ORIGIN:
      "Esta solicitud no está permitida.",

    UNSUPPORTED_MEDIA_TYPE:
      "El formato de la solicitud no es compatible.",

    PAYLOAD_TOO_LARGE:
      "La solicitud es demasiado grande.",

    REQUEST_TIMEOUT:
      "La solicitud ha tardado demasiado.",

    TOO_MANY_REQUESTS:
      "Demasiadas solicitudes. Inténtelo más tarde.",

    DATABASE_UNAVAILABLE:
      "Los datos no están disponibles temporalmente.",

    SERVICE_UNAVAILABLE:
      "El servicio no está disponible temporalmente.",

    INTERNAL_ERROR:
      "Ha ocurrido un error. Inténtelo de nuevo.",
  },
};

/* ============================================================
   14. VALIDATION ERROR CLASS

   Compatible with:
   application.ts
   documents.ts
   application/route.ts
   documents/route.ts
   documents/[id]/route.ts
   submit/route.ts
   ============================================================ */

export class ApplicationValidationError
  extends Error {
  readonly code: ApplicationErrorCode;

  readonly status: number;

  readonly issues: ValidationIssue[];

  constructor(
    issues: ValidationIssue[],

    status = 400
  ) {
    const firstIssue = issues[0];

    super(
      firstIssue?.message ??
        ERROR_MESSAGES.de.INVALID_INPUT
    );

    this.name =
      "ApplicationValidationError";

    this.code =
      firstIssue?.code ??
      "INVALID_INPUT";

    this.status = status;

    this.issues = issues;
  }
}

/* ============================================================
   15. AUTHENTICATED CANDIDATE CONTRACT
   ============================================================ */

export type AuthenticatedApplicationCandidate = {
  userId: string;

  firstName: string;

  lastName: string;

  fullName: string;

  email: string;

  phoneE164: string;

  countryCode: ApplicationCountry;

  role: string;

  status: string;

  emailVerified: boolean;

  phoneVerified: boolean;
};

/* ============================================================
   16. FORM INPUT

   All input fields are unknown until
   validated by this module.
   ============================================================ */

export type ApplicationFormInput = {
  category?: unknown;

  residentialAddress?: unknown;

  postalCode?: unknown;

  city?: unknown;

  confirmedInformation?: unknown;

  acceptedDocumentProcessing?: unknown;
};

/* ============================================================
   17. PRICING CONTRACT
   ============================================================ */

export type ApplicationPricing = {
  currency: "EUR";

  trainingPriceCents: number;

  registrationFeeCents: number;

  totalPriceCents: number;

  pricingVersion: string;
};

/* ============================================================
   18. ADMISSION REQUIREMENTS CONTRACT

   Configured by driving-licenses.ts.

   Missing information is reviewed
   administratively rather than
   automatically considered valid.
   ============================================================ */

export type AdmissionRequirements = {
  minimumAge: number;

  requiredExistingCategories:
    readonly LicenseCategory[];

  additionalRequiredDocuments:
    readonly ApplicationDocumentType[];

  habitualResidenceReviewRequired:
    boolean;

  medicalReviewRequired:
    boolean;

  visionReviewRequired:
    boolean;

  firstAidReviewRequired:
    boolean;

  professionalQualificationReviewRequired:
    boolean;

  manualReviewRequired:
    boolean;
};

/* ============================================================
   19. TRUSTED LICENSE OFFERING

   Must originate from the server-side
   country configuration.

   Never construct from browser prices.
   ============================================================ */

export type TrustedLicenseOffering = {
  countryCode: ApplicationCountry;

  category: LicenseCategory;

  enabled: boolean;

  pricingApproved: boolean;

  currency: "EUR";

  trainingPriceCents: number;

  registrationFeeCents: number | null;

  pricingVersion: string;

  requirements: AdmissionRequirements;
};

/* ============================================================
   20. DOCUMENT STATUS TYPES
   ============================================================ */

export type DocumentUploadStatus =
  | "UPLOADING"
  | "UPLOADED"
  | "FAILED"
  | "DELETED";

export type DocumentSecurityStatus =
  | "PENDING"
  | "CLEAN"
  | "REJECTED";

export type DocumentReviewStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

/* ============================================================
   21. TRUSTED DATABASE DOCUMENT

   Must come from PostgreSQL.

   Never trust a client-supplied CLEAN
   status or storage key.
   ============================================================ */

export type TrustedApplicationDocument = {
  id: string;

  applicationId: string;

  userId: string;

  type: ApplicationDocumentType;

  storageKey: string;

  fileName: string;

  mimeType: string;

  sizeBytes: number;

  uploadStatus: DocumentUploadStatus;

  securityStatus: DocumentSecurityStatus;

  reviewStatus: DocumentReviewStatus;
};

/* ============================================================
   22. DOCUMENT UPLOAD CONTRACT
   ============================================================ */

export type DocumentUploadInput = {
  type?: unknown;

  documentType?: unknown;

  fileName?: unknown;

  mimeType?: unknown;

  sizeBytes?: unknown;

  content?: unknown;
};

export type ValidatedDocumentUpload = {
  type: ApplicationDocumentType;

  fileName: string;

  mimeType: AllowedDocumentMimeType;

  sizeBytes: number;

  content: Uint8Array;
};

/* ============================================================
   23. ADMISSION REVIEW CODES
   ============================================================ */

export type AdmissionReviewCode =
  | "AGE_REVIEW_REQUIRED"
  | "MINIMUM_AGE_REVIEW_REQUIRED"
  | "EXISTING_LICENSE_REVIEW_REQUIRED"
  | "HABITUAL_RESIDENCE_REVIEW_REQUIRED"
  | "MEDICAL_REVIEW_REQUIRED"
  | "VISION_REVIEW_REQUIRED"
  | "FIRST_AID_REVIEW_REQUIRED"
  | "PROFESSIONAL_QUALIFICATION_REVIEW_REQUIRED"
  | "ADDITIONAL_DOCUMENT_REVIEW_REQUIRED"
  | "MANUAL_ADMISSION_REVIEW_REQUIRED";

export type AdmissionReviewIssue = {
  code: AdmissionReviewCode;

  documentType?: ApplicationDocumentType;
};

/* ============================================================
   24. VALIDATION CONTEXT
   ============================================================ */

export type ApplicationValidationContext = {
  candidate: AuthenticatedApplicationCandidate;

  offerings: readonly TrustedLicenseOffering[];

  applicationId?: string | null;

  documents?: readonly TrustedApplicationDocument[];

  locale?: ApplicationLocale;
};

/* ============================================================
   25. VALIDATED APPLICATION RESULT
   ============================================================ */

export type ValidatedApplicationData = {
  candidate: AuthenticatedApplicationCandidate;

  category: LicenseCategory | null;

  residentialAddress: string | null;

  postalCode: string | null;

  city: string | null;

  confirmedInformation: boolean;

  acceptedDocumentProcessing: boolean;

  pricing: ApplicationPricing | null;

  admissionReviewRequired: boolean;

  admissionReviewIssues: AdmissionReviewIssue[];

  documentIds: string[];
};

/* ============================================================
   26. BASIC TYPE VALIDATION
   ============================================================ */

export function isValidUuid(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&

    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
      .test(value)
  );
}

export function isSupportedCountry(
  value: unknown
): value is ApplicationCountry {
  return (
    typeof value === "string" &&

    (
      SUPPORTED_APPLICATION_COUNTRIES as
        readonly string[]
    ).includes(value)
  );
}

export function isSupportedApplicationLocale(
  value: unknown
): value is ApplicationLocale {
  return (
    typeof value === "string" &&

    (
      SUPPORTED_APPLICATION_LOCALES as
        readonly string[]
    ).includes(value)
  );
}

export function isLicenseCategory(
  value: unknown
): value is LicenseCategory {
  return (
    typeof value === "string" &&

    (
      LICENSE_CATEGORIES as
        readonly string[]
    ).includes(value)
  );
}

export function isApplicationDocumentType(
  value: unknown
): value is ApplicationDocumentType {
  return (
    typeof value === "string" &&

    (
      APPLICATION_DOCUMENT_TYPES as
        readonly string[]
    ).includes(value)
  );
}

export function isRequiredDocumentType(
  value: unknown
): value is RequiredApplicationDocumentType {
  return (
    typeof value === "string" &&

    (
      REQUIRED_DOCUMENT_TYPES as
        readonly string[]
    ).includes(value)
  );
}

export function isAllowedMimeType(
  value: unknown
): value is AllowedDocumentMimeType {
  return (
    typeof value === "string" &&

    (
      ALLOWED_DOCUMENT_MIME_TYPES as
        readonly string[]
    ).includes(value)
  );
}

/* ============================================================
   27. NORMALIZATION
   ============================================================ */

export function normalizeApplicationLocale(
  value: unknown
): ApplicationLocale {
  if (typeof value !== "string") {
    return DEFAULT_APPLICATION_LOCALE;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];

  return isSupportedApplicationLocale(normalized)
    ? normalized
    : DEFAULT_APPLICATION_LOCALE;
}

export function normalizeApplicationCountry(
  value: unknown
): ApplicationCountry | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .toUpperCase();

  return isSupportedCountry(normalized)
    ? normalized
    : null;
}

export function normalizeLicenseCategory(
  value: unknown
): LicenseCategory | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .toUpperCase();

  return isLicenseCategory(normalized)
    ? normalized
    : null;
}

export function normalizeDocumentType(
  value: unknown
): ApplicationDocumentType | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .toUpperCase();

  return isApplicationDocumentType(normalized)
    ? normalized
    : null;
}

export function normalizeApplicationDocumentType(
  value: unknown
): ApplicationDocumentType | null {
  return normalizeDocumentType(value);
}

export function normalizeDigits(
  value: string
): string {
  return value

    .replace(
      /[٠-٩]/g,
      (digit) =>
        String(
          digit.charCodeAt(0) - 1632
        )
    )

    .replace(
      /[۰-۹]/g,
      (digit) =>
        String(
          digit.charCodeAt(0) - 1776
        )
    )

    .replace(
      /[０-９]/g,
      (digit) =>
        String(
          digit.charCodeAt(0) - 65296
        )
    );
}

/* ============================================================
   28. SAFE TEXT NORMALIZATION
   ============================================================ */

function hasUnsafeCharacters(
  value: string
): boolean {
  return /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u
    .test(value);
}

function normalizeText(
  value: string
): string {
  return value
    .normalize("NFC")
    .trim()
    .replace(/[ \t]+/g, " ");
}

function textLength(
  value: string
): number {
  return Array.from(value).length;
}

function isMissing(
  value: unknown
): boolean {
  return (
    value === null ||

    value === undefined ||

    (
      typeof value === "string" &&
      value.trim() === ""
    )
  );
}

/* ============================================================
   29. LOCALIZED ERROR HELPERS
   ============================================================ */

export function getApplicationErrorMessage(
  code: ApplicationErrorCode,

  locale: ApplicationLocale = "de"
): string {
  const language =
    normalizeApplicationLocale(locale);

  return ERROR_MESSAGES[language][code] ??
    ERROR_MESSAGES[language].INTERNAL_ERROR;
}

export function createValidationIssue(
  code: ApplicationErrorCode,

  field: string,

  locale: ApplicationLocale = "de",

  documentType?: ApplicationDocumentType
): ValidationIssue {
  const message =
    getApplicationErrorMessage(
      code,
      locale
    );

  return {
    code,

    field,

    message: documentType
      ? `${getDocumentLabel(documentType, locale)}: ${message}`
      : message,

    ...(
      documentType
        ? { documentType }
        : {}
    ),
  };
}

function fail(
  code: ApplicationErrorCode,

  field: string,

  locale: ApplicationLocale,

  status = 400
): never {
  throw new ApplicationValidationError(
    [
      createValidationIssue(
        code,
        field,
        locale
      ),
    ],

    status
  );
}

/* ============================================================
   30. DOCUMENT LABEL HELPERS
   ============================================================ */

export function getDocumentLabel(
  type: ApplicationDocumentType,

  locale: ApplicationLocale = "de"
): string {
  const language =
    normalizeApplicationLocale(locale);

  return DOCUMENT_LABELS[type]?.[language] ??
    DOCUMENT_LABELS.OTHER[language];
}

export function getRequiredApplicationDocuments():
  ApplicationDocumentType[] {
  return [...REQUIRED_DOCUMENT_TYPES];
}

export function getAllowedDocumentMimeTypes(
  type: ApplicationDocumentType
): AllowedDocumentMimeType[] {
  if (!isApplicationDocumentType(type)) {
    return [];
  }

  return [...DOCUMENT_MIME_TYPES[type]];
}

export function isAllowedDocumentMimeType(
  type: unknown,

  mimeType: unknown
): mimeType is AllowedDocumentMimeType {
  return (
    isApplicationDocumentType(type) &&

    isAllowedMimeType(mimeType) &&

    DOCUMENT_MIME_TYPES[type]
      .includes(mimeType)
  );
}

/* ============================================================
   31. FILE SIZE VALIDATION
   ============================================================ */

export function isValidDocumentSize(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&

    Number.isSafeInteger(value) &&

    value > 0 &&

    value <= MAX_DOCUMENT_SIZE_BYTES
  );
}

/* ============================================================
   32. FILE NAME VALIDATION

   Original file names are metadata only.
   Storage paths are generated separately.
   ============================================================ */

export function sanitizeDocumentFileName(
  value: unknown
): string | null {
  if (
    typeof value !== "string" ||

    value.length === 0 ||

    value.length > 1000 ||

    hasUnsafeCharacters(value)
  ) {
    return null;
  }

  const normalized = value
    .normalize("NFC")
    .trim();

  if (
    !normalized ||

    normalized.startsWith(".") ||

    normalized.includes("/") ||

    normalized.includes("\\") ||

    /[<>:"|?*]/u.test(normalized) ||

    textLength(normalized) >
      MAX_DOCUMENT_FILE_NAME_LENGTH
  ) {
    return null;
  }

  return normalized;
}

export function sanitizeFileName(
  value: unknown
): string | null {
  return sanitizeDocumentFileName(value);
}

/* ============================================================
   33. FILE EXTENSION CHECK
   ============================================================ */

function getFileExtension(
  fileName: string
): string | null {
  const index =
    fileName.lastIndexOf(".");

  if (
    index <= 0 ||

    index === fileName.length - 1
  ) {
    return null;
  }

  return fileName
    .slice(index + 1)
    .toLowerCase();
}

export function isAllowedDocumentExtension(
  fileName: string,

  mimeType: AllowedDocumentMimeType
): boolean {
  const extension =
    getFileExtension(fileName);

  return Boolean(
    extension &&

    MIME_EXTENSIONS[mimeType]
      ?.includes(extension)
  );
}

/* ============================================================
   34. BINARY SIGNATURE VALIDATION

   Detects JPEG, PNG and PDF headers.

   This is not a full image/PDF parser
   and does not replace malware scanning.
   ============================================================ */

function startsWithBytes(
  content: Uint8Array,

  signature: readonly number[]
): boolean {
  if (
    content.byteLength <
      signature.length
  ) {
    return false;
  }

  return signature.every(
    (byte, index) =>
      content[index] === byte
  );
}

export function detectDocumentMimeType(
  content: Uint8Array
): AllowedDocumentMimeType | null {
  if (
    !(content instanceof Uint8Array) ||

    content.byteLength < 4
  ) {
    return null;
  }

  /* JPEG */

  if (
    startsWithBytes(
      content,
      [0xff, 0xd8, 0xff]
    )
  ) {
    return "image/jpeg";
  }

  /* PNG */

  if (
    startsWithBytes(
      content,

      [
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a,
      ]
    )
  ) {
    return "image/png";
  }

  /* PDF */

  if (
    startsWithBytes(
      content,

      [
        0x25,
        0x50,
        0x44,
        0x46,
        0x2d,
      ]
    )
  ) {
    return "application/pdf";
  }

  return null;
}

/* ============================================================
   35. COMPLETE DOCUMENT UPLOAD VALIDATION

   Compatible with documents.ts.

   Checks actual bytes, not only the
   file type declared by the browser.
   ============================================================ */

export function validateDocumentUpload(
  input: DocumentUploadInput,

  requestedLocale: ApplicationLocale = "de"
): ValidatedDocumentUpload {
  const locale =
    normalizeApplicationLocale(
      requestedLocale
    );

  if (
    !input ||

    typeof input !== "object" ||

    Array.isArray(input)
  ) {
    fail(
      "INVALID_FILE",
      "file",
      locale
    );
  }

  const type =
    normalizeDocumentType(
      input.type ??
      input.documentType
    );

  if (!type) {
    fail(
      "INVALID_DOCUMENT_TYPE",
      "type",
      locale
    );
  }

  if (
    input.type !== undefined &&

    input.documentType !== undefined &&

    normalizeDocumentType(input.type) !==
      normalizeDocumentType(input.documentType)
  ) {
    fail(
      "INVALID_DOCUMENT_TYPE",
      "type",
      locale
    );
  }

  const fileName =
    sanitizeDocumentFileName(
      input.fileName
    );

  if (!fileName) {
    fail(
      "INVALID_FILE_NAME",
      "fileName",
      locale
    );
  }

  let content: Uint8Array;

  if (
    input.content instanceof Uint8Array
  ) {
    content =
      new Uint8Array(input.content);

  } else if (
    input.content instanceof ArrayBuffer
  ) {
    content =
      new Uint8Array(
        input.content.slice(0)
      );

  } else {
    fail(
      "INVALID_FILE",
      "file",
      locale
    );
  }

  if (content.byteLength === 0) {
    fail(
      "EMPTY_FILE",
      "file",
      locale
    );
  }

  if (
    content.byteLength >
      MAX_DOCUMENT_SIZE_BYTES
  ) {
    fail(
      "FILE_TOO_LARGE",
      "file",
      locale,
      413
    );
  }

  if (
    input.sizeBytes !== undefined &&

    (
      !isValidDocumentSize(
        input.sizeBytes
      ) ||

      input.sizeBytes !==
        content.byteLength
    )
  ) {
    fail(
      "INVALID_FILE_SIZE",
      "sizeBytes",
      locale
    );
  }

  const detectedMimeType =
    detectDocumentMimeType(content);

  if (!detectedMimeType) {
    fail(
      "UNSUPPORTED_FILE_TYPE",
      "file",
      locale,
      415
    );
  }

  const declaredMimeType =
    typeof input.mimeType === "string"

      ? input.mimeType
          .trim()
          .toLowerCase()

      : "";

  /*
   * Some mobile browsers do not provide
   * a reliable MIME type.
   *
   * Empty/octet-stream types may be
   * resolved using the actual bytes.
   */

  if (
    declaredMimeType &&

    declaredMimeType !==
      "application/octet-stream" &&

    declaredMimeType !==
      detectedMimeType
  ) {
    fail(
      "FILE_CONTENT_MISMATCH",
      "file",
      locale,
      415
    );
  }

  if (
    !isAllowedDocumentMimeType(
      type,
      detectedMimeType
    )
  ) {
    fail(
      "UNSUPPORTED_FILE_TYPE",
      "file",
      locale,
      415
    );
  }

  if (
    !isAllowedDocumentExtension(
      fileName,
      detectedMimeType
    )
  ) {
    fail(
      "FILE_CONTENT_MISMATCH",
      "fileName",
      locale,
      415
    );
  }

  return {
    type,

    fileName,

    mimeType: detectedMimeType,

    sizeBytes: content.byteLength,

    content,
  };
}

/* ============================================================
   36. APPLICATION STATE VALIDATION
   ============================================================ */

export function isApplicationEditable(
  status: unknown
): boolean {
  return status === "DRAFT";
}

export function assertApplicationEditable(
  status: unknown,

  locale: ApplicationLocale = "de"
): void {
  if (!isApplicationEditable(status)) {
    fail(
      "INVALID_APPLICATION_STATE",
      "status",
      normalizeApplicationLocale(locale),
      409
    );
  }
}

/* ============================================================
   37. AUTHENTICATED CANDIDATE VALIDATION
   ============================================================ */

export function validateAuthenticatedCandidate(
  candidate: AuthenticatedApplicationCandidate,

  requestedLocale: ApplicationLocale = "de"
): AuthenticatedApplicationCandidate {
  const locale =
    normalizeApplicationLocale(
      requestedLocale
    );

  if (
    !candidate ||

    !isValidUuid(candidate.userId)
  ) {
    fail(
      "UNAUTHORIZED",
      "candidate",
      locale,
      401
    );
  }

  if (
    candidate.role !== "CANDIDATE" ||

    candidate.status !== "ACTIVE"
  ) {
    fail(
      "ACCOUNT_UNAVAILABLE",
      "candidate",
      locale,
      403
    );
  }

  if (
    candidate.emailVerified !== true
  ) {
    fail(
      "ACCOUNT_NOT_VERIFIED",
      "candidate",
      locale,
      403
    );
  }

  const countryCode =
    normalizeApplicationCountry(
      candidate.countryCode
    );

  if (!countryCode) {
    fail(
      "UNSUPPORTED_COUNTRY",
      "countryCode",
      locale,
      403
    );
  }

  const firstName =
    candidate.firstName;

  const lastName =
    candidate.lastName;

  if (
    typeof firstName !== "string" ||

    typeof lastName !== "string" ||

    !firstName.trim() ||

    !lastName.trim() ||

    textLength(firstName) > 150 ||

    textLength(lastName) > 150 ||

    hasUnsafeCharacters(firstName) ||

    hasUnsafeCharacters(lastName)
  ) {
    fail(
      "ACCOUNT_UNAVAILABLE",
      "candidate",
      locale,
      403
    );
  }

  if (
    typeof candidate.email !== "string" ||

    candidate.email.length > 254 ||

    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(candidate.email)
  ) {
    fail(
      "ACCOUNT_UNAVAILABLE",
      "email",
      locale,
      403
    );
  }

  if (
    typeof candidate.phoneE164 !== "string" ||

    !/^\+[1-9]\d{7,14}$/
      .test(candidate.phoneE164)
  ) {
    fail(
      "ACCOUNT_UNAVAILABLE",
      "phoneE164",
      locale,
      403
    );
  }

  const normalizedFirstName =
    normalizeText(firstName);

  const normalizedLastName =
    normalizeText(lastName);

  return {
    ...candidate,

    firstName:
      normalizedFirstName,

    lastName:
      normalizedLastName,

    fullName:
      `${normalizedFirstName} ${normalizedLastName}`,

    email:
      candidate.email
        .trim()
        .toLowerCase(),

    countryCode,

    emailVerified: true,

    phoneVerified: candidate.phoneVerified,
  };
}

/* ============================================================
   38. RESIDENTIAL ADDRESS VALIDATION

   Unicode letters and legitimate
   European address punctuation allowed.

   Arabic and Turkish names are supported.
   ============================================================ */

export function isValidResidentialAddress(
  value: unknown
): value is string {
  if (
    typeof value !== "string" ||

    hasUnsafeCharacters(value)
  ) {
    return false;
  }

  const normalized =
    normalizeText(value);

  const length =
    textLength(normalized);

  return (
    length >=
      MIN_RESIDENTIAL_ADDRESS_LENGTH &&

    length <=
      MAX_RESIDENTIAL_ADDRESS_LENGTH &&

    /[\p{L}\p{N}]/u.test(normalized) &&

    /^[\p{L}\p{M}\p{N}\p{Zs}.,'’ʼ\-–—/°ºª#()]+$/u
      .test(normalized)
  );
}

/* ============================================================
   39. CITY VALIDATION
   ============================================================ */

export function isValidApplicationCity(
  value: unknown
): value is string {
  if (
    typeof value !== "string" ||

    hasUnsafeCharacters(value)
  ) {
    return false;
  }

  const normalized =
    normalizeText(value);

  const length =
    textLength(normalized);

  return (
    length >= MIN_CITY_LENGTH &&

    length <= MAX_CITY_LENGTH &&

    /\p{L}/u.test(normalized) &&

    /^[\p{L}\p{M}\p{N}\p{Zs}.'’ʼ\-–—()/]+$/u
      .test(normalized)
  );
}

/* ============================================================
   40. COUNTRY-SPECIFIC POSTAL CODE

   Keeps leading zeros.

   Never converts a postal code into
   a JavaScript number.
   ============================================================ */

export function normalizePostalCode(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  if (
    hasUnsafeCharacters(value)
  ) {
    return null;
  }

  const normalized =
    normalizeDigits(
      value.trim()
    );

  if (
    !/^\d{1,10}$/.test(normalized)
  ) {
    return null;
  }

  return normalized;
}

export function isValidPostalCode(
  value: unknown,

  country: ApplicationCountry
): boolean {
  if (!isSupportedCountry(country)) {
    return false;
  }

  const normalized =
    normalizePostalCode(value);

  if (!normalized) {
    return false;
  }

  return POSTAL_CODE_RULES[country]
    .pattern
    .test(normalized);
}

/* ============================================================
   41. FIND TRUSTED COUNTRY OFFERING
   ============================================================ */

export function findAvailableLicenseOffering(
  countryCode: ApplicationCountry,

  category: LicenseCategory,

  offerings: readonly TrustedLicenseOffering[]
): TrustedLicenseOffering | null {
  if (
    !isSupportedCountry(countryCode) ||

    !isLicenseCategory(category) ||

    !Array.isArray(offerings)
  ) {
    return null;
  }

  const matching =
    offerings.filter(
      (offering) =>

        offering.countryCode ===
          countryCode &&

        offering.category ===
          category
    );

  if (
    matching.length !== 1 ||

    matching[0].enabled !== true
  ) {
    return null;
  }

  return matching[0];
}

/* ============================================================
   42. MONEY VALIDATION
   ============================================================ */

function isValidMoneyAmount(
  value: unknown,

  allowZero = true
): value is number {
  return (
    typeof value === "number" &&

    Number.isSafeInteger(value) &&

    value <= MAX_DATABASE_INTEGER &&

    (
      allowZero
        ? value >= 0
        : value > 0
    )
  );
}

/* ============================================================
   43. SERVER-SIDE PRICE CALCULATION

   No prices received from browser.

   Germany:
   209 EUR registration fee.

   Other countries:
   Fee from driving-licenses.ts.

   Final submission requires approved
   pricing.
   ============================================================ */

export function calculateApplicationPricing(
  offering: TrustedLicenseOffering,

  locale: ApplicationLocale = "de",

  requireApproved = true
): ApplicationPricing {
  const language =
    normalizeApplicationLocale(locale);

  if (
    !offering ||

    !isSupportedCountry(
      offering.countryCode
    ) ||

    !isLicenseCategory(
      offering.category
    ) ||

    offering.enabled !== true
  ) {
    fail(
      "CATEGORY_UNAVAILABLE",
      "category",
      language,
      409
    );
  }

  if (
    requireApproved &&

    offering.pricingApproved !== true
  ) {
    fail(
      "PRICING_UNAVAILABLE",
      "pricing",
      language,
      409
    );
  }

  if (
    offering.registrationFeeCents === null
  ) {
    fail(
      "PRICING_UNAVAILABLE",
      "pricing",
      language,
      409
    );
  }

  if (
    offering.currency !== "EUR" ||

    !isValidMoneyAmount(
      offering.trainingPriceCents,
      false
    ) ||

    !isValidMoneyAmount(
      offering.registrationFeeCents
    ) ||

    typeof offering.pricingVersion !== "string" ||

    !/^[A-Za-z0-9._:-]{1,100}$/
      .test(offering.pricingVersion)
  ) {
    fail(
      "INVALID_PRICING",
      "pricing",
      language,
      503
    );
  }

  if (
    offering.countryCode === "DE" &&

    offering.registrationFeeCents !==
      GERMANY_REGISTRATION_FEE_CENTS
  ) {
    fail(
      "INVALID_PRICING",
      "registrationFee",
      language,
      503
    );
  }

  const totalPriceCents =
    offering.trainingPriceCents +

    offering.registrationFeeCents;

  if (
    !isValidMoneyAmount(
      totalPriceCents,
      false
    )
  ) {
    fail(
      "INVALID_PRICING",
      "pricing",
      language,
      503
    );
  }

  return {
    currency: "EUR",

    trainingPriceCents:
      offering.trainingPriceCents,

    registrationFeeCents:
      offering.registrationFeeCents,

    totalPriceCents,

    pricingVersion:
      offering.pricingVersion,
  };
}

/* ============================================================
   44. FORMAT PRICE IN FOUR LANGUAGES
   ============================================================ */

const FORMAT_LOCALES: Record<
  ApplicationLocale,
  string
> = {
  de: "de-DE",

  ar: "ar",

  tr: "tr-TR",

  es: "es-ES",
};

export function formatApplicationPrice(
  amountCents: number,

  locale: ApplicationLocale = "de"
): string {
  if (
    !isValidMoneyAmount(amountCents)
  ) {
    return "—";
  }

  const language =
    normalizeApplicationLocale(locale);

  return new Intl.NumberFormat(
    FORMAT_LOCALES[language],

    {
      style: "currency",

      currency: "EUR",

      minimumFractionDigits: 2,

      maximumFractionDigits: 2,
    }
  ).format(amountCents / 100);
}

/* ============================================================
   45. TRUSTED DOCUMENT READINESS

   Administrative PENDING is accepted
   for initial submission.

   Security PENDING is not accepted.

   Antivirus checks do not prove
   document authenticity.
   ============================================================ */

export function isDocumentReadyForSubmission(
  document: TrustedApplicationDocument | null
): boolean {
  return Boolean(
    document &&

    isValidUuid(document.id) &&

    isValidUuid(document.applicationId) &&

    isValidUuid(document.userId) &&

    isApplicationDocumentType(document.type) &&

    isValidDocumentSize(document.sizeBytes) &&

    isAllowedDocumentMimeType(
      document.type,

      document.mimeType
    ) &&

    typeof document.storageKey === "string" &&

    document.storageKey.length > 0 &&

    document.uploadStatus === "UPLOADED" &&

    document.securityStatus !== "REJECTED" &&

    (
      document.reviewStatus === "PENDING" ||

      document.reviewStatus === "APPROVED"
    )
  );
}

/* ============================================================
   46. DOCUMENT OWNERSHIP AND INTEGRITY
   ============================================================ */

function validateTrustedDocuments({
  documents,

  userId,

  applicationId,

  locale,

  finalSubmission,
}: {
  documents: readonly TrustedApplicationDocument[];

  userId: string;

  applicationId?: string | null;

  locale: ApplicationLocale;

  finalSubmission: boolean;
}): {
  documentIds: string[];

  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];

  const documentIds: string[] = [];

  const seenIds = new Set<string>();

  const seenStorageKeys = new Set<string>();

  const validDocuments =
    new Map<
      ApplicationDocumentType,
      TrustedApplicationDocument[]
    >();

  if (!Array.isArray(documents)) {
    fail(
      "INVALID_DOCUMENT",
      "documents",
      locale
    );
  }

  const activeDocuments =
    documents.filter(
      (document) =>
        document?.uploadStatus !== "DELETED"
    );

  if (
    activeDocuments.length >
      MAX_APPLICATION_DOCUMENTS
  ) {
    issues.push(
      createValidationIssue(
        "TOO_MANY_DOCUMENTS",
        "documents",
        locale
      )
    );
  }

  for (
    const document
    of activeDocuments
  ) {
    if (
      !document ||

      !isValidUuid(document.id) ||

      !isApplicationDocumentType(
        document.type
      )
    ) {
      issues.push(
        createValidationIssue(
          "INVALID_DOCUMENT",
          "documents",
          locale
        )
      );

      continue;
    }

    if (
      document.userId !== userId ||

      !applicationId ||

      document.applicationId !==
        applicationId
    ) {
      /*
       * Ownership failure stops validation.
       * Another candidate's document can
       * never satisfy submission.
       */

      fail(
        "DOCUMENT_ACCESS_DENIED",
        "documents",
        locale,
        403
      );
    }

    if (
      typeof document.storageKey !== "string" ||

      !document.storageKey ||

      document.storageKey.length > 500 ||

      document.storageKey.includes("..") ||

      document.storageKey.startsWith("/") ||

      document.storageKey.includes("\\") ||

      !isValidDocumentSize(document.sizeBytes) ||

      !isAllowedDocumentMimeType(
        document.type,

        document.mimeType
      )
    ) {
      issues.push(
        createValidationIssue(
          "INVALID_DOCUMENT",

          "documents",

          locale,

          document.type
        )
      );

      continue;
    }

    if (
      seenIds.has(document.id) ||

      seenStorageKeys.has(
        document.storageKey
      )
    ) {
      issues.push(
        createValidationIssue(
          "DUPLICATE_DOCUMENT",

          "documents",

          locale,

          document.type
        )
      );

      continue;
    }

    seenIds.add(document.id);

    seenStorageKeys.add(
      document.storageKey
    );

    const existing =
      validDocuments.get(document.type) ??
      [];

    existing.push(document);

    validDocuments.set(
      document.type,
      existing
    );

    if (finalSubmission) {
      if (
        document.securityStatus ===
          "REJECTED" ||

        document.reviewStatus ===
          "REJECTED"
      ) {
        issues.push(
          createValidationIssue(
            "DOCUMENT_REJECTED",

            "documents",

            locale,

            document.type
          )
        );

        continue;
      }

      if (
        !isDocumentReadyForSubmission(
          document
        )
      ) {
        issues.push(
          createValidationIssue(
            "DOCUMENT_NOT_READY",

            "documents",

            locale,

            document.type
          )
        );

        continue;
      }
    }

    documentIds.push(document.id);
  }

  for (
    const type
    of REQUIRED_DOCUMENT_TYPES
  ) {
    const matching =
      validDocuments.get(type) ?? [];

    if (
      matching.length > 1
    ) {
      issues.push(
        createValidationIssue(
          "DUPLICATE_DOCUMENT",

          "documents",

          locale,

          type
        )
      );
    }

    if (
      finalSubmission &&

      matching.length === 0
    ) {
      issues.push(
        createValidationIssue(
          "DOCUMENT_REQUIRED",

          "documents",

          locale,

          type
        )
      );
    }
  }

  return {
    documentIds,

    issues,
  };
}

/* ============================================================
   47. MULTILINGUAL ADMISSION REVIEW

   These are review flags, not claims that
   the candidate has satisfied the law.
   ============================================================ */

const ADMISSION_REVIEW_MESSAGES: Record<
  ApplicationLocale,
  Record<AdmissionReviewCode, string>
> = {
  de: {
    AGE_REVIEW_REQUIRED:
      "Das Alter des Bewerbers muss geprüft werden.",

    MINIMUM_AGE_REVIEW_REQUIRED:
      "Das erforderliche Mindestalter muss geprüft werden.",

    EXISTING_LICENSE_REVIEW_REQUIRED:
      "Der erforderliche vorhandene Führerschein muss geprüft werden.",

    HABITUAL_RESIDENCE_REVIEW_REQUIRED:
      "Der ordentliche Wohnsitz muss geprüft werden.",

    MEDICAL_REVIEW_REQUIRED:
      "Die medizinische Eignung muss geprüft werden.",

    VISION_REVIEW_REQUIRED:
      "Die Anforderungen an das Sehvermögen müssen geprüft werden.",

    FIRST_AID_REVIEW_REQUIRED:
      "Der erforderliche Erste-Hilfe-Nachweis muss geprüft werden.",

    PROFESSIONAL_QUALIFICATION_REVIEW_REQUIRED:
      "Berufliche Qualifikationen und mögliche Ausnahmen müssen geprüft werden.",

    ADDITIONAL_DOCUMENT_REVIEW_REQUIRED:
      "Weitere Unterlagen können erforderlich sein.",

    MANUAL_ADMISSION_REVIEW_REQUIRED:
      "Die Zulassungsvoraussetzungen werden individuell geprüft.",
  },

  ar: {
    AGE_REVIEW_REQUIRED:
      "يجب التحقق من عمر المتقدم.",

    MINIMUM_AGE_REVIEW_REQUIRED:
      "يجب التحقق من الحد الأدنى المطلوب للعمر.",

    EXISTING_LICENSE_REVIEW_REQUIRED:
      "يجب التحقق من رخصة القيادة السابقة المطلوبة.",

    HABITUAL_RESIDENCE_REVIEW_REQUIRED:
      "يجب التحقق من الإقامة المعتادة.",

    MEDICAL_REVIEW_REQUIRED:
      "يجب التحقق من الأهلية الطبية.",

    VISION_REVIEW_REQUIRED:
      "يجب التحقق من متطلبات النظر.",

    FIRST_AID_REVIEW_REQUIRED:
      "يجب التحقق من شهادة الإسعافات الأولية المطلوبة.",

    PROFESSIONAL_QUALIFICATION_REVIEW_REQUIRED:
      "يجب التحقق من المؤهلات المهنية والاستثناءات المحتملة.",

    ADDITIONAL_DOCUMENT_REVIEW_REQUIRED:
      "قد تكون هناك حاجة إلى مستندات إضافية.",

    MANUAL_ADMISSION_REVIEW_REQUIRED:
      "سيتم التحقق من شروط القبول بشكل فردي.",
  },

  tr: {
    AGE_REVIEW_REQUIRED:
      "Başvuru sahibinin yaşı kontrol edilmelidir.",

    MINIMUM_AGE_REVIEW_REQUIRED:
      "Gerekli asgari yaş kontrol edilmelidir.",

    EXISTING_LICENSE_REVIEW_REQUIRED:
      "Gerekli mevcut ehliyet kontrol edilmelidir.",

    HABITUAL_RESIDENCE_REVIEW_REQUIRED:
      "Olağan ikamet yeri kontrol edilmelidir.",

    MEDICAL_REVIEW_REQUIRED:
      "Sağlık uygunluğu kontrol edilmelidir.",

    VISION_REVIEW_REQUIRED:
      "Görme şartları kontrol edilmelidir.",

    FIRST_AID_REVIEW_REQUIRED:
      "Gerekli ilk yardım belgesi kontrol edilmelidir.",

    PROFESSIONAL_QUALIFICATION_REVIEW_REQUIRED:
      "Mesleki yeterlilikler ve olası istisnalar kontrol edilmelidir.",

    ADDITIONAL_DOCUMENT_REVIEW_REQUIRED:
      "Ek belgeler gerekebilir.",

    MANUAL_ADMISSION_REVIEW_REQUIRED:
      "Kabul şartları bireysel olarak incelenecektir.",
  },

  es: {
    AGE_REVIEW_REQUIRED:
      "Debe comprobarse la edad del solicitante.",

    MINIMUM_AGE_REVIEW_REQUIRED:
      "Debe comprobarse la edad mínima requerida.",

    EXISTING_LICENSE_REVIEW_REQUIRED:
      "Debe comprobarse el permiso de conducir previo requerido.",

    HABITUAL_RESIDENCE_REVIEW_REQUIRED:
      "Debe comprobarse la residencia habitual.",

    MEDICAL_REVIEW_REQUIRED:
      "Debe comprobarse la aptitud médica.",

    VISION_REVIEW_REQUIRED:
      "Deben comprobarse los requisitos de visión.",

    FIRST_AID_REVIEW_REQUIRED:
      "Debe comprobarse el certificado de primeros auxilios requerido.",

    PROFESSIONAL_QUALIFICATION_REVIEW_REQUIRED:
      "Deben comprobarse las cualificaciones profesionales y posibles excepciones.",

    ADDITIONAL_DOCUMENT_REVIEW_REQUIRED:
      "Pueden ser necesarios documentos adicionales.",

    MANUAL_ADMISSION_REVIEW_REQUIRED:
      "Los requisitos de admisión se comprobarán individualmente.",
  },
};

export function getAdmissionReviewMessage(
  code: AdmissionReviewCode,

  locale: ApplicationLocale = "de"
): string {
  const language =
    normalizeApplicationLocale(locale);

  return (
    ADMISSION_REVIEW_MESSAGES[language][code] ??

    ADMISSION_REVIEW_MESSAGES[language]
      .MANUAL_ADMISSION_REVIEW_REQUIRED
  );
}

/* ============================================================
   48. ADMISSION CONFIGURATION VALIDATION
   ============================================================ */

function assertValidAdmissionRequirements(
  requirements: AdmissionRequirements,

  locale: ApplicationLocale
): void {
  if (
    !requirements ||

    !Number.isInteger(
      requirements.minimumAge
    ) ||

    requirements.minimumAge < 14 ||

    requirements.minimumAge > 30 ||

    !Array.isArray(
      requirements.requiredExistingCategories
    ) ||

    !Array.isArray(
      requirements.additionalRequiredDocuments
    ) ||

    requirements.requiredExistingCategories.some(
      (category) =>
        !isLicenseCategory(category)
    ) ||

    requirements.additionalRequiredDocuments.some(
      (type) =>
        !isApplicationDocumentType(type)
    )
  ) {
    fail(
      "SERVICE_UNAVAILABLE",
      "requirements",
      locale,
      503
    );
  }

  const flags = [
    requirements.habitualResidenceReviewRequired,

    requirements.medicalReviewRequired,

    requirements.visionReviewRequired,

    requirements.firstAidReviewRequired,

    requirements.professionalQualificationReviewRequired,

    requirements.manualReviewRequired,
  ];

  if (
    flags.some(
      (value) =>
        typeof value !== "boolean"
    )
  ) {
    fail(
      "SERVICE_UNAVAILABLE",
      "requirements",
      locale,
      503
    );
  }
}

/* ============================================================
   49. ADMISSION REVIEW EVALUATION

   Current candidate accounts do not
   provide verified date of birth,
   actual medical fitness, or complete
   driving-license history.

   Therefore these conditions must be
   checked by qualified staff.

   Additional documents do not prevent
   formation of the initial application.
   ============================================================ */

export function evaluateAdmissionRequirements(
  offering: TrustedLicenseOffering,

  documents: readonly TrustedApplicationDocument[],

  locale: ApplicationLocale = "de"
): AdmissionReviewIssue[] {
  const requirements =
    offering.requirements;

  assertValidAdmissionRequirements(
    requirements,
    locale
  );

  const issues:
    AdmissionReviewIssue[] = [];

  issues.push({
    code:
      "MINIMUM_AGE_REVIEW_REQUIRED",
  });

  /*
   * A postal address alone does not
   * establish habitual residence.
   */

  if (
    requirements.habitualResidenceReviewRequired
  ) {
    issues.push({
      code:
        "HABITUAL_RESIDENCE_REVIEW_REQUIRED",
    });
  }

  if (
    requirements.requiredExistingCategories.length > 0
  ) {
    issues.push({
      code:
        "EXISTING_LICENSE_REVIEW_REQUIRED",

      documentType:
        "EXISTING_DRIVING_LICENSE",
    });
  }

  if (
    requirements.medicalReviewRequired
  ) {
    issues.push({
      code:
        "MEDICAL_REVIEW_REQUIRED",

      documentType:
        "MEDICAL_CERTIFICATE",
    });
  }

  if (
    requirements.visionReviewRequired
  ) {
    issues.push({
      code:
        "VISION_REVIEW_REQUIRED",
    });
  }

  if (
    requirements.firstAidReviewRequired
  ) {
    issues.push({
      code:
        "FIRST_AID_REVIEW_REQUIRED",

      documentType:
        "FIRST_AID_CERTIFICATE",
    });
  }

  if (
    requirements.professionalQualificationReviewRequired
  ) {
    issues.push({
      code:
        "PROFESSIONAL_QUALIFICATION_REVIEW_REQUIRED",
    });
  }

  const additionalDocuments =
    new Set(
      requirements.additionalRequiredDocuments
    );

  for (
    const documentType
    of additionalDocuments
  ) {
    const available =
      documents.some(
        (document) =>

          document.type ===
            documentType &&

          isDocumentReadyForSubmission(
            document
          )
      );

    if (!available) {
      issues.push({
        code:
          "ADDITIONAL_DOCUMENT_REVIEW_REQUIRED",

        documentType,
      });
    }
  }

  /*
   * The platform registers an initial
   * application.
   *
   * Official eligibility requires
   * independent administrative review.
   */

  issues.push({
    code:
      "MANUAL_ADMISSION_REVIEW_REQUIRED",
  });

  return issues;
}

/* ============================================================
   50. EDITABLE FIELDS

   Prevents candidate-controlled prices,
   identity, country and application status.
   ============================================================ */

const ALLOWED_FORM_FIELDS = new Set([
  "category",

  "residentialAddress",

  "postalCode",

  "city",

  "confirmedInformation",

  "acceptedDocumentProcessing",
]);

function assertValidFormInput(
  input: unknown,

  locale: ApplicationLocale
): asserts input is ApplicationFormInput {
  if (
    !input ||

    typeof input !== "object" ||

    Array.isArray(input)
  ) {
    fail(
      "INVALID_INPUT",
      "application",
      locale
    );
  }

  if (
    Object.keys(input).some(
      (key) =>
        !ALLOWED_FORM_FIELDS.has(key)
    )
  ) {
    fail(
      "INVALID_INPUT",
      "application",
      locale
    );
  }
}

/* ============================================================
   51. SHARED APPLICATION VALIDATION

   Draft:
   Missing form fields are allowed.

   Final submission:
   All mandatory fields must be valid.

   Both:
   Candidate identity and country come
   exclusively from authenticated context.
   ============================================================ */

function validateApplication(
  input: ApplicationFormInput,

  context: ApplicationValidationContext,

  finalSubmission: boolean
): ValidatedApplicationData {
  const locale =
    normalizeApplicationLocale(
      context?.locale
    );

  if (!context) {
    fail(
      "INVALID_INPUT",
      "application",
      locale
    );
  }

  assertValidFormInput(
    input,
    locale
  );

  const candidate =
    validateAuthenticatedCandidate(
      context.candidate,
      locale
    );

  if (
    !Array.isArray(context.offerings)
  ) {
    fail(
      "SERVICE_UNAVAILABLE",
      "offerings",
      locale,
      503
    );
  }

  if (
    context.applicationId !== undefined &&

    context.applicationId !== null &&

    !isValidUuid(context.applicationId)
  ) {
    fail(
      "INVALID_INPUT",
      "applicationId",
      locale
    );
  }

  if (
    finalSubmission &&

    !isValidUuid(context.applicationId)
  ) {
    fail(
      "APPLICATION_NOT_FOUND",
      "applicationId",
      locale,
      404
    );
  }

  const issues: ValidationIssue[] = [];

  const documents =
    context.documents ?? [];

  let category:
    LicenseCategory | null = null;

  let residentialAddress:
    string | null = null;

  let postalCode:
    string | null = null;

  let city:
    string | null = null;

  let pricing:
    ApplicationPricing | null = null;

  let selectedOffering:
    TrustedLicenseOffering | null = null;

  let confirmedInformation = false;

  let acceptedDocumentProcessing = false;

  let admissionReviewIssues:
    AdmissionReviewIssue[] = [];

  /* ========================================================
     CATEGORY
     ======================================================== */

  if (isMissing(input.category)) {
    if (finalSubmission) {
      issues.push(
        createValidationIssue(
          "CATEGORY_REQUIRED",
          "category",
          locale
        )
      );
    }

  } else {
    category =
      normalizeLicenseCategory(
        input.category
      );

    if (!category) {
      issues.push(
        createValidationIssue(
          "INVALID_CATEGORY",
          "category",
          locale
        )
      );

    } else {
      selectedOffering =
        findAvailableLicenseOffering(
          candidate.countryCode,

          category,

          context.offerings
        );

      if (!selectedOffering) {
        issues.push(
          createValidationIssue(
            "CATEGORY_UNAVAILABLE",
            "category",
            locale
          )
        );
      }
    }
  }

  /* ========================================================
     RESIDENTIAL ADDRESS
     ======================================================== */

  if (
    isMissing(input.residentialAddress)
  ) {
    if (finalSubmission) {
      issues.push(
        createValidationIssue(
          "ADDRESS_REQUIRED",
          "residentialAddress",
          locale
        )
      );
    }

  } else if (
    !isValidResidentialAddress(
      input.residentialAddress
    )
  ) {
    issues.push(
      createValidationIssue(
        "INVALID_ADDRESS",
        "residentialAddress",
        locale
      )
    );

  } else {
    residentialAddress =
      normalizeText(
        input.residentialAddress
      );
  }

  /* ========================================================
     POSTAL CODE
     ======================================================== */

  if (isMissing(input.postalCode)) {
    if (finalSubmission) {
      issues.push(
        createValidationIssue(
          "POSTAL_CODE_REQUIRED",
          "postalCode",
          locale
        )
      );
    }

  } else {
    postalCode =
      normalizePostalCode(
        input.postalCode
      );

    if (
      !postalCode ||

      !isValidPostalCode(
        postalCode,
        candidate.countryCode
      )
    ) {
      issues.push(
        createValidationIssue(
          "INVALID_POSTAL_CODE",
          "postalCode",
          locale
        )
      );
    }
  }

  /* ========================================================
     CITY
     ======================================================== */

  if (isMissing(input.city)) {
    if (finalSubmission) {
      issues.push(
        createValidationIssue(
          "CITY_REQUIRED",
          "city",
          locale
        )
      );
    }

  } else if (
    !isValidApplicationCity(
      input.city
    )
  ) {
    issues.push(
      createValidationIssue(
        "INVALID_CITY",
        "city",
        locale
      )
    );

  } else {
    city =
      normalizeText(input.city);
  }

  /* ========================================================
     CONFIRMATION 1
     ======================================================== */

  if (
    input.confirmedInformation !== undefined &&

    typeof input.confirmedInformation !==
      "boolean"
  ) {
    issues.push(
      createValidationIssue(
        "INVALID_CONFIRMATION",
        "confirmedInformation",
        locale
      )
    );

  } else {
    confirmedInformation =
      input.confirmedInformation === true;
  }

  if (
    finalSubmission &&

    !confirmedInformation
  ) {
    issues.push(
      createValidationIssue(
        "INFORMATION_CONFIRMATION_REQUIRED",
        "confirmedInformation",
        locale
      )
    );
  }

  /* ========================================================
     CONFIRMATION 2
     ======================================================== */

  if (
    input.acceptedDocumentProcessing !== undefined &&

    typeof input.acceptedDocumentProcessing !==
      "boolean"
  ) {
    issues.push(
      createValidationIssue(
        "INVALID_CONFIRMATION",
        "acceptedDocumentProcessing",
        locale
      )
    );

  } else {
    acceptedDocumentProcessing =
      input.acceptedDocumentProcessing === true;
  }

  if (
    finalSubmission &&

    !acceptedDocumentProcessing
  ) {
    issues.push(
      createValidationIssue(
        "DOCUMENT_PROCESSING_REQUIRED",
        "acceptedDocumentProcessing",
        locale
      )
    );
  }

  /* ========================================================
     DOCUMENTS

     Ownership checked in draft and
     final submission.

     Five documents required only for
     final submission.
     ======================================================== */

  const validatedDocuments =
    validateTrustedDocuments({
      documents,

      userId:
        candidate.userId,

      applicationId:
        context.applicationId,

      locale,

      finalSubmission,
    });

  issues.push(
    ...validatedDocuments.issues
  );

  /* ========================================================
     TRUSTED PRICING
     ======================================================== */

  if (selectedOffering) {
    if (
      finalSubmission &&

      selectedOffering.pricingApproved !== true
    ) {
      issues.push(
        createValidationIssue(
          "PRICING_UNAVAILABLE",
          "pricing",
          locale
        )
      );

    } else if (
      selectedOffering.registrationFeeCents === null
    ) {
      if (finalSubmission) {
        issues.push(
          createValidationIssue(
            "PRICING_UNAVAILABLE",
            "pricing",
            locale
          )
        );
      }

    } else {
      /*
       * Draft prices may be estimates.
       * Final prices must be approved.
       */

      pricing =
        calculateApplicationPricing(
          selectedOffering,

          locale,

          finalSubmission
        );
    }

    /* ======================================================
       ADMISSION REQUIREMENTS
       ====================================================== */

    admissionReviewIssues =
      evaluateAdmissionRequirements(
        selectedOffering,

        documents,

        locale
      );
  }

  /* ========================================================
     FINAL VALIDATION RESULT
     ======================================================== */

  if (issues.length > 0) {
    const conflictCodes =
      new Set<ApplicationErrorCode>([
        "PRICING_UNAVAILABLE",

        "CATEGORY_UNAVAILABLE",

        "DOCUMENT_NOT_READY",

        "DUPLICATE_DOCUMENT",
      ]);

    const status =
      issues.every(
        (issue) =>
          conflictCodes.has(issue.code)
      )

        ? 409

        : 422;

    throw new ApplicationValidationError(
      issues,

      status
    );
  }

  return {
    candidate,

    category,

    residentialAddress,

    postalCode,

    city,

    confirmedInformation,

    acceptedDocumentProcessing,

    pricing,

    admissionReviewRequired:
      admissionReviewIssues.length > 0,

    admissionReviewIssues,

    documentIds:
      validatedDocuments.documentIds,
  };
}

/* ============================================================
   52. VALIDATE APPLICATION DRAFT

   Required by application.ts.

   A candidate can save a draft even
   before selecting their license class
   or uploading the five documents.
   ============================================================ */

export function validateApplicationDraft(
  input: ApplicationFormInput,

  context: ApplicationValidationContext
): ValidatedApplicationData {
  return validateApplication(
    input,

    context,

    false
  );
}

/* ============================================================
   53. VALIDATE FINAL APPLICATION

   Required by application.ts.

   Checks:
   - Authenticated candidate
   - Registered country
   - Available license category
   - Residential address
   - Postal code
   - City
   - Approved pricing
   - All five mandatory documents
   - Document security status
   - Document ownership
   - Both explicit confirmations

   Does not issue an official license.
   ============================================================ */

export function validateApplicationSubmission(
  input: ApplicationFormInput,

  context: ApplicationValidationContext
): ValidatedApplicationData {
  return validateApplication(
    input,

    context,

    true
  );
}

/* ============================================================
   54. COUNTRY AND CATEGORY CHECK
   ============================================================ */

export function isCategoryAvailableForCountry(
  country: ApplicationCountry,

  category: LicenseCategory,

  offerings: readonly TrustedLicenseOffering[]
): boolean {
  return (
    findAvailableLicenseOffering(
      country,

      category,

      offerings
    ) !== null
  );
}

/* ============================================================
   55. DOCUMENT SUMMARY
   ============================================================ */

export function getApplicationDocumentProgress(
  documents: readonly TrustedApplicationDocument[]
): {
  requiredCount: number;

  uploadedCount: number;

  readyCount: number;

  missingTypes: ApplicationDocumentType[];

  pendingTypes: ApplicationDocumentType[];

  complete: boolean;

  percentage: number;
} {
  let uploadedCount = 0;

  let readyCount = 0;

  const missingTypes:
    ApplicationDocumentType[] = [];

  const pendingTypes:
    ApplicationDocumentType[] = [];

  for (
    const type
    of REQUIRED_DOCUMENT_TYPES
  ) {
    const matching =
      documents.filter(
        (document) =>

          document.type === type &&

          document.uploadStatus !==
            "DELETED"
      );

    if (matching.length !== 1) {
      missingTypes.push(type);

      continue;
    }

    const document =
      matching[0];

    if (
      document.uploadStatus === "UPLOADED"
    ) {
      uploadedCount += 1;
    }

    if (
      isDocumentReadyForSubmission(
        document
      )
    ) {
      readyCount += 1;

    } else {
      pendingTypes.push(type);
    }
  }

  const requiredCount =
    REQUIRED_DOCUMENT_TYPES.length;

  return {
    requiredCount,

    uploadedCount,

    readyCount,

    missingTypes,

    pendingTypes,

    complete:
      readyCount === requiredCount,

    percentage:
      Math.round(
        readyCount /
          requiredCount *
          100
      ),
  };
}

/* ============================================================
   56. SUPPORTED COUNTRY POSTAL CONFIGURATION

   Public metadata without exposing
   unnecessary internal objects.
   ============================================================ */

export function getCountryPostalCodeConfiguration(
  country: ApplicationCountry
): {
  length: number;

  example: string;
} {
  if (!isSupportedCountry(country)) {
    fail(
      "UNSUPPORTED_COUNTRY",
      "country",
      "de"
    );
  }

  return {
    length:
      POSTAL_CODE_RULES[country].length,

    example:
      POSTAL_CODE_RULES[country].example,
  };
}

/* ============================================================
   57. LANGUAGE DIRECTION

   Arabic interface:
   Right-to-left.

   Other supported languages:
   Left-to-right.
   ============================================================ */

export function getApplicationLocaleDirection(
  locale: unknown
): "ltr" | "rtl" {
  return normalizeApplicationLocale(locale) === "ar"

    ? "rtl"

    : "ltr";
}

/* ============================================================
   END OF FAHRSCHULE TAYM
   APPLICATION VALIDATION SERVICE
   ============================================================ */
