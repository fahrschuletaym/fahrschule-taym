
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import Link from "next/link";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Globe2,
  Home,
  Info,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  Pencil,
  Phone,
  RefreshCw,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

/* ============================================================
   FAHRSCHULE TAYM

   File:
   src/app/(dashboard)/dashboard/account/page.tsx

   Route:
   /dashboard/account

   Backend:
   GET   /api/dashboard/account
   PATCH /api/dashboard/account

   Languages:
   de | ar | tr | es

   Countries:
   DE | AT | BE | IT | ES

   UI:
   Mobile | Tablet | Desktop

   Uses existing dashboard layout.

   No duplicated header or sidebar.
   No fake user data.
   No localStorage profile storage.
   No client-supplied userId.
   ============================================================ */

/* ============================================================
   1. TYPES
   ============================================================ */

type Locale = "de" | "ar" | "tr" | "es";

type Country = "DE" | "AT" | "BE" | "IT" | "ES";

type Profile = {
  id: string;

  firstName: string;
  lastName: string;
  dateOfBirth: string;

  email: string;
  emailVerified: boolean;

  phoneE164: string;
  phoneVerified: boolean;

  countryCode: Country;

  streetAddress: string;
  postalCode: string;
  city: string;
};

type EditableProfile = Pick<
  Profile,
  | "firstName"
  | "lastName"
  | "dateOfBirth"
  | "phoneE164"
  | "streetAddress"
  | "postalCode"
  | "city"
>;

type EditableField =
  keyof EditableProfile;

type SaveableField = Exclude<
  EditableField,
  "phoneE164"
>;

type AlertType =
  | "success"
  | "warning"
  | "error";

type AlertState = {
  type: AlertType;
  message: string;
};

type ApiError = {
  code?: string;
  issues?: Array<{
    field: string;
    code: string;
  }>;
};

/* ============================================================
   2. CONFIGURATION
   ============================================================ */

const ACCOUNT_API =
  "/api/dashboard/account";

const EMPTY_FORM: EditableProfile = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  phoneE164: "",
  streetAddress: "",
  postalCode: "",
  city: "",
};

const COUNTRY_FLAGS: Record<
  Country,
  string
> = {
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
   3. TRANSLATIONS
   ============================================================ */

const TEXT = {
  de: {
    title: "Mein Konto",
    subtitle:
      "Verwalte deine persönlichen Daten und deine Kontaktdaten.",
    profile: "Persönliche Informationen",
    profileDesc:
      "Hier siehst du die Daten, die in deinem Benutzerkonto gespeichert sind.",

    firstName: "Vorname",
    lastName: "Nachname",
    country: "Land",
    email: "E-Mail-Adresse",
    phone: "Telefonnummer",
    streetAddress: "Straße und Hausnummer",
    postalCode: "Postleitzahl",
    city: "Stadt",

    edit: "Profil bearbeiten",
    save: "Änderungen speichern",
    cancel: "Abbrechen",

    loading: "Kontodaten werden geladen...",
    saving: "Änderungen werden gespeichert...",
    reload: "Erneut versuchen",

    verified: "Bestätigt",
    unverified: "Nicht bestätigt",

    protectedTitle: "Geschützte Kontodaten",
    protectedText:
      "Deine E-Mail-Adresse und dein Land können hier nicht direkt geändert werden.",

    countryHint:
      "Das Land ist mit deinem Kandidatenkonto und den verfügbaren Führerscheinangeboten verknüpft.",

    emailHint:
      "Eine Änderung der E-Mail-Adresse erfordert ein separates Verifizierungsverfahren.",

    phoneHint:
      "Gib die Telefonnummer im internationalen Format ein, zum Beispiel +491701234567.",

    phoneWarning:
      "Eine neue Telefonnummer kann erst nach SMS-Bestätigung aktiviert werden.",

    phoneNotSaved:
      "Die neue Telefonnummer wurde nicht gespeichert. Dafür ist zuerst eine SMS-Verifizierung erforderlich.",

    otherSavedPhonePending:
      "Die übrigen Änderungen wurden gespeichert. Die neue Telefonnummer wurde nicht übernommen, da ihre SMS-Bestätigung noch erforderlich ist.",

    saved: "Deine Änderungen wurden erfolgreich gespeichert.",
    noChanges: "Es gibt keine Änderungen zu speichern.",

    validationRequired:
      "Bitte fülle alle Pflichtfelder aus.",

    invalidPhone:
      "Bitte verwende das internationale Telefonnummernformat, zum Beispiel +491701234567.",

    invalidPostal:
      "Die Postleitzahl entspricht nicht dem Format des ausgewählten Landes.",

    invalidField:
      "Bitte überprüfe die eingegebenen Angaben.",

    required: "Dieses Feld ist erforderlich.",
    tooShort: "Die Eingabe ist zu kurz.",
    tooLong: "Die Eingabe ist zu lang.",
    invalidCharacters:
      "Die Eingabe enthält nicht erlaubte Zeichen.",

    loginRequired:
      "Bitte melde dich an, um dein Konto aufzurufen.",

    login: "Anmelden",
    accountMissing:
      "Dein Benutzerkonto wurde nicht gefunden.",

    loadingError:
      "Deine Kontodaten konnten nicht geladen werden.",

    savingError:
      "Deine Änderungen konnten nicht gespeichert werden.",

    conflict:
      "Dein Profil wurde zwischenzeitlich geändert. Bitte lade die Daten neu.",

    securityError:
      "Diese Anfrage konnte aus Sicherheitsgründen nicht ausgeführt werden.",

    serviceError:
      "Der Dienst ist momentan nicht verfügbar. Bitte versuche es später erneut.",

    back: "Zum Dashboard",
    application: "Mein Führerscheinantrag",
    categories: "Führerscheinklassen",

    securityTitle: "Sicherheit deines Kontos",
    securityDescription:
      "Änderungen werden serverseitig geprüft. Vertrauliche Daten und Verifizierungsstatus können nicht direkt über dieses Formular geändert werden.",

    notProvided: "Nicht angegeben",

    phonePending:
      "SMS-Bestätigung erforderlich",

    accountInformation:
      "Kontoinformationen",

    addressInformation:
      "Wohnadresse",

    actions: "Aktionen",
    refresh: "Daten aktualisieren",

    fieldExampleFirst: "Vorname",
    fieldExampleLast: "Nachname",
    fieldExampleStreet:
      "Straße und Hausnummer",
    fieldExampleCity: "Stadt",
    fieldExamplePostal: "Postleitzahl",

    changedElsewhere:
      "Bitte aktualisiere die Seite, bevor du erneut speicherst.",
  },

  ar: {
    title: "حسابي",
    subtitle:
      "إدارة معلوماتك الشخصية وبيانات الاتصال الخاصة بك.",
    profile: "المعلومات الشخصية",
    profileDesc:
      "هنا يمكنك الاطلاع على المعلومات المسجلة في حسابك.",

    firstName: "الاسم الأول",
    lastName: "اسم العائلة",
    country: "الدولة",
    email: "البريد الإلكتروني",
    phone: "رقم الهاتف",
    streetAddress: "عنوان الإقامة ورقم المنزل",
    postalCode: "الرمز البريدي",
    city: "المدينة",

    edit: "تعديل الملف الشخصي",
    save: "حفظ التعديلات",
    cancel: "إلغاء",

    loading: "جارٍ تحميل بيانات الحساب...",
    saving: "جارٍ حفظ التغييرات...",
    reload: "إعادة المحاولة",

    verified: "تم التحقق",
    unverified: "لم يتم التحقق",

    protectedTitle: "بيانات الحساب المحمية",
    protectedText:
      "لا يمكن تغيير البريد الإلكتروني أو الدولة مباشرة من هذه الصفحة.",

    countryHint:
      "ترتبط الدولة بحساب المرشح وفئات رخص القيادة المتاحة له.",

    emailHint:
      "تغيير البريد الإلكتروني يتطلب عملية تحقق مستقلة.",

    phoneHint:
      "أدخل رقم الهاتف بالصيغة الدولية، مثل +491701234567.",

    phoneWarning:
      "لا يمكن تفعيل رقم هاتف جديد قبل تأكيده عبر SMS.",

    phoneNotSaved:
      "لم يتم حفظ رقم الهاتف الجديد. يجب إكمال التحقق عبر SMS أولاً.",

    otherSavedPhonePending:
      "تم حفظ التعديلات الأخرى، لكن رقم الهاتف الجديد لم يتم حفظه لأنه يحتاج إلى تأكيد SMS.",

    saved: "تم حفظ التعديلات بنجاح.",
    noChanges: "لا توجد تعديلات للحفظ.",

    validationRequired:
      "يرجى ملء جميع الحقول المطلوبة.",

    invalidPhone:
      "يرجى إدخال رقم دولي صحيح مثل +491701234567.",

    invalidPostal:
      "الرمز البريدي غير مطابق لصيغة الدولة.",

    invalidField:
      "يرجى مراجعة البيانات المدخلة.",

    required: "هذا الحقل مطلوب.",
    tooShort: "القيمة قصيرة جداً.",
    tooLong: "القيمة طويلة جداً.",
    invalidCharacters:
      "توجد رموز غير مسموح بها.",

    loginRequired:
      "يرجى تسجيل الدخول لعرض حسابك.",

    login: "تسجيل الدخول",
    accountMissing:
      "لم يتم العثور على حسابك.",

    loadingError:
      "تعذر تحميل معلومات حسابك.",

    savingError:
      "تعذر حفظ التعديلات.",

    conflict:
      "تم تعديل ملفك من جهة أخرى. يرجى تحديث البيانات.",

    securityError:
      "تعذر تنفيذ الطلب لأسباب أمنية.",

    serviceError:
      "الخدمة غير متاحة حالياً. حاول لاحقاً.",

    back: "العودة للوحة التحكم",
    application: "طلب رخصة القيادة",
    categories: "فئات رخص القيادة",

    securityTitle: "أمان حسابك",
    securityDescription:
      "يتم التحقق من التعديلات على الخادم، ولا يمكن تغيير البيانات المحمية وحالات التحقق مباشرة من هذا النموذج.",

    notProvided: "غير مسجل",

    phonePending:
      "التحقق عبر SMS مطلوب",

    accountInformation: "معلومات الحساب",
    addressInformation: "عنوان الإقامة",

    actions: "الإجراءات",
    refresh: "تحديث البيانات",

    fieldExampleFirst: "الاسم الأول",
    fieldExampleLast: "اسم العائلة",
    fieldExampleStreet: "عنوان الإقامة",
    fieldExampleCity: "المدينة",
    fieldExamplePostal: "الرمز البريدي",

    changedElsewhere:
      "يرجى تحديث الصفحة قبل الحفظ مجدداً.",
  },

  tr: {
    title: "Hesabım",
    subtitle:
      "Kişisel ve iletişim bilgilerinizi yönetin.",
    profile: "Kişisel bilgiler",
    profileDesc:
      "Hesabınızda kayıtlı bilgileri burada görebilirsiniz.",

    firstName: "Ad",
    lastName: "Soyad",
    country: "Ülke",
    email: "E-posta adresi",
    phone: "Telefon numarası",
    streetAddress: "Cadde ve kapı numarası",
    postalCode: "Posta kodu",
    city: "Şehir",

    edit: "Profili düzenle",
    save: "Değişiklikleri kaydet",
    cancel: "İptal",

    loading: "Hesap bilgileri yükleniyor...",
    saving: "Değişiklikler kaydediliyor...",
    reload: "Tekrar dene",

    verified: "Doğrulandı",
    unverified: "Doğrulanmadı",

    protectedTitle: "Korunan hesap bilgileri",
    protectedText:
      "E-posta adresiniz ve ülkeniz bu sayfadan doğrudan değiştirilemez.",

    countryHint:
      "Ülkeniz aday hesabınıza ve mevcut ehliyet seçeneklerine bağlıdır.",

    emailHint:
      "E-posta değiştirmek ayrı bir doğrulama işlemi gerektirir.",

    phoneHint:
      "Telefonu uluslararası biçimde yazın: +491701234567.",

    phoneWarning:
      "Yeni telefon numarası SMS doğrulaması tamamlanmadan etkinleştirilemez.",

    phoneNotSaved:
      "Yeni telefon numarası kaydedilmedi. Önce SMS doğrulaması gerekir.",

    otherSavedPhonePending:
      "Diğer değişiklikler kaydedildi. Yeni telefon numarası SMS doğrulaması gerektiği için kaydedilmedi.",

    saved:
      "Değişiklikler başarıyla kaydedildi.",
    noChanges:
      "Kaydedilecek değişiklik yok.",

    validationRequired:
      "Lütfen gerekli alanları doldurun.",

    invalidPhone:
      "Geçerli bir uluslararası telefon numarası girin: +491701234567.",

    invalidPostal:
      "Posta kodu seçilen ülkenin biçimine uymuyor.",

    invalidField:
      "Girilen bilgileri kontrol edin.",

    required: "Bu alan zorunludur.",
    tooShort: "Girdi çok kısa.",
    tooLong: "Girdi çok uzun.",
    invalidCharacters:
      "Geçersiz karakterler bulunuyor.",

    loginRequired:
      "Hesabınızı görmek için giriş yapın.",

    login: "Giriş yap",
    accountMissing: "Hesabınız bulunamadı.",

    loadingError:
      "Hesap bilgileri yüklenemedi.",

    savingError:
      "Değişiklikler kaydedilemedi.",

    conflict:
      "Profiliniz başka bir işlemle değiştirildi. Lütfen yeniden yükleyin.",

    securityError:
      "Güvenlik nedeniyle işlem yapılamadı.",

    serviceError:
      "Hizmet şu anda kullanılamıyor.",

    back: "Panele dön",
    application: "Ehliyet başvurum",
    categories: "Ehliyet sınıfları",

    securityTitle: "Hesap güvenliği",
    securityDescription:
      "Değişiklikler sunucuda doğrulanır. Korunan alanlar ve doğrulama durumları bu formdan değiştirilemez.",

    notProvided: "Belirtilmedi",

    phonePending:
      "SMS doğrulaması gerekli",

    accountInformation: "Hesap bilgileri",
    addressInformation: "İkamet adresi",

    actions: "İşlemler",
    refresh: "Bilgileri yenile",

    fieldExampleFirst: "Ad",
    fieldExampleLast: "Soyad",
    fieldExampleStreet: "Cadde ve kapı numarası",
    fieldExampleCity: "Şehir",
    fieldExamplePostal: "Posta kodu",

    changedElsewhere:
      "Kaydetmeden önce verileri yenileyin.",
  },

  es: {
    title: "Mi cuenta",
    subtitle:
      "Gestione su información personal y sus datos de contacto.",
    profile: "Información personal",
    profileDesc:
      "Aquí puede consultar los datos guardados en su cuenta.",

    firstName: "Nombre",
    lastName: "Apellidos",
    country: "País",
    email: "Correo electrónico",
    phone: "Número de teléfono",
    streetAddress: "Calle y número",
    postalCode: "Código postal",
    city: "Ciudad",

    edit: "Editar perfil",
    save: "Guardar cambios",
    cancel: "Cancelar",

    loading: "Cargando datos de la cuenta...",
    saving: "Guardando cambios...",
    reload: "Reintentar",

    verified: "Verificado",
    unverified: "Sin verificar",

    protectedTitle: "Datos protegidos",
    protectedText:
      "El correo electrónico y el país no pueden modificarse directamente desde esta página.",

    countryHint:
      "Su país está asociado a la cuenta y a las opciones de permiso disponibles.",

    emailHint:
      "Cambiar el correo requiere una verificación independiente.",

    phoneHint:
      "Introduzca el teléfono en formato internacional, por ejemplo +491701234567.",

    phoneWarning:
      "Un número nuevo solo puede activarse después de verificarlo por SMS.",

    phoneNotSaved:
      "No se ha guardado el nuevo teléfono. Primero debe verificarse mediante SMS.",

    otherSavedPhonePending:
      "Se guardaron los demás cambios. El nuevo teléfono no se guardó porque requiere verificación por SMS.",

    saved: "Cambios guardados correctamente.",
    noChanges: "No hay cambios que guardar.",

    validationRequired:
      "Complete todos los campos obligatorios.",

    invalidPhone:
      "Introduzca un número internacional válido, por ejemplo +491701234567.",

    invalidPostal:
      "El código postal no corresponde al formato del país.",

    invalidField:
      "Revise los datos introducidos.",

    required: "Este campo es obligatorio.",
    tooShort: "El valor es demasiado corto.",
    tooLong: "El valor es demasiado largo.",
    invalidCharacters:
      "El valor contiene caracteres no permitidos.",

    loginRequired:
      "Inicie sesión para acceder a su cuenta.",

    login: "Iniciar sesión",
    accountMissing:
      "No se encontró su cuenta.",

    loadingError:
      "No se pudieron cargar sus datos.",

    savingError:
      "No se pudieron guardar los cambios.",

    conflict:
      "Su perfil ha cambiado desde otra sesión. Actualice los datos.",

    securityError:
      "No se pudo procesar la solicitud por motivos de seguridad.",

    serviceError:
      "El servicio no está disponible en este momento.",

    back: "Volver al panel",
    application: "Mi solicitud de permiso",
    categories: "Categorías de permisos",

    securityTitle: "Seguridad de la cuenta",
    securityDescription:
      "Los cambios se validan en el servidor. Los datos protegidos y estados de verificación no pueden modificarse desde este formulario.",

    notProvided: "No indicado",

    phonePending:
      "Verificación por SMS necesaria",

    accountInformation: "Datos de la cuenta",
    addressInformation: "Dirección de residencia",

    actions: "Acciones",
    refresh: "Actualizar datos",

    fieldExampleFirst: "Nombre",
    fieldExampleLast: "Apellidos",
    fieldExampleStreet: "Calle y número",
    fieldExampleCity: "Ciudad",
    fieldExamplePostal: "Código postal",

    changedElsewhere:
      "Actualice los datos antes de volver a guardar.",
  },
} as const;

/* ============================================================
   4. LANGUAGE SYNCHRONIZATION
   ============================================================ */

function validLocale(
  value: unknown
): Locale | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];

  if (
    normalized === "de" ||
    normalized === "ar" ||
    normalized === "tr" ||
    normalized === "es"
  ) {
    return normalized;
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

  const found = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) =>
      part.startsWith(prefix)
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

function readActiveLocale(): Locale {
  if (typeof window === "undefined") {
    return "de";
  }

  const htmlLocale = validLocale(
    document.documentElement.lang
  );

  if (htmlLocale) {
    return htmlLocale;
  }

  const cookieLocale =
    validLocale(
      readCookie("taym-locale")
    ) ??
    validLocale(
      readCookie("NEXT_LOCALE")
    );

  if (cookieLocale) {
    return cookieLocale;
  }

  try {
    return (
      validLocale(
        localStorage.getItem("taym-locale")
      ) ?? "de"
    );
  } catch {
    return "de";
  }
}

/* ============================================================
   5. SAFE API RESPONSE PARSING

   Never render unverified API fields
   directly as a trusted profile.
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

function readProfile(
  value: unknown
): Profile | null {
  if (!isRecord(value)) {
    return null;
  }

  const requiredStrings = [
    "id",
    "firstName",
    "lastName",
    "dateOfBirth",
    "email",
    "phoneE164",
    "streetAddress",
    "postalCode",
    "city",
  ] as const;

  for (const field of requiredStrings) {
    if (
      typeof value[field] !== "string"
    ) {
      return null;
    }
  }

  if (
    typeof value.emailVerified !==
      "boolean" ||
    typeof value.phoneVerified !==
      "boolean" ||
    !isCountry(value.countryCode)
  ) {
    return null;
  }

  return {
    id: value.id as string,
    firstName: value.firstName as string,
    lastName: value.lastName as string,
    dateOfBirth: value.dateOfBirth as string,
    email: value.email as string,
    emailVerified: value.emailVerified,
    phoneE164: value.phoneE164 as string,
    phoneVerified: value.phoneVerified,
    countryCode: value.countryCode,
    streetAddress:
      value.streetAddress as string,
    postalCode:
      value.postalCode as string,
    city: value.city as string,
  };
}

function readApiError(
  value: unknown
): ApiError {
  if (!isRecord(value)) {
    return {};
  }

  const issues =
    Array.isArray(value.issues)
      ? value.issues
          .filter(isRecord)
          .filter(
            (item) =>
              typeof item.field ===
                "string" &&
              typeof item.code ===
                "string"
          )
          .map((item) => ({
            field: item.field as string,
            code: item.code as string,
          }))
      : [];

  return {
    code:
      typeof value.code === "string"
        ? value.code
        : undefined,
    issues,
  };
}

/* ============================================================
   6. FORM HELPERS
   ============================================================ */

function toEditable(
  profile: Profile
): EditableProfile {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    dateOfBirth: profile.dateOfBirth,
    phoneE164: profile.phoneE164,
    streetAddress:
      profile.streetAddress,
    postalCode: profile.postalCode,
    city: profile.city,
  };
}

function normalizedText(
  value: string
): string {
  return value
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ");
}

function normalizedPhone(
  value: string
): string {
  return value
    .trim()
    .replace(/[\s().-]/g, "");
}

function postalFormat(
  country: Country
): RegExp {
  switch (country) {
    case "DE":
    case "IT":
    case "ES":
      return /^\d{5}$/;

    case "AT":
    case "BE":
      return /^\d{4}$/;
  }
}

const FIELD_LIMITS = {
  firstName: 80,
  lastName: 80,
  streetAddress: 180,
  postalCode: 10,
  city: 100,
} as const;

function validateForm(
  form: EditableProfile,
  country: Country
): Partial<Record<EditableField, string>> {
  const errors: Partial<
    Record<EditableField, string>
  > = {};

  const requiredFields = [
    "firstName",
    "lastName",
    "streetAddress",
    "postalCode",
    "city",
  ] as const;

  for (const field of requiredFields) {
    const value =
      normalizedText(form[field]);

    if (!value) {
      errors[field] = "REQUIRED";
      continue;
    }

    if (
      Array.from(value).length >
      FIELD_LIMITS[field]
    ) {
      errors[field] = "TOO_LONG";
    }
  }

  if (
    form.streetAddress.trim() &&
    Array.from(
      normalizedText(
        form.streetAddress
      )
    ).length < 4
  ) {
    errors.streetAddress =
      "TOO_SHORT";
  }

  if (
    form.city.trim() &&
    Array.from(
      normalizedText(form.city)
    ).length < 2
  ) {
    errors.city = "TOO_SHORT";
  }

  if (
    form.postalCode.trim() &&
    !postalFormat(country).test(
      normalizedText(
        form.postalCode
      )
    )
  ) {
    errors.postalCode =
      "INVALID_POSTAL_CODE";
  }

  if (
    form.phoneE164.trim() &&
    !/^\+[1-9]\d{7,14}$/.test(
      normalizedPhone(form.phoneE164)
    )
  ) {
    errors.phoneE164 =
      "INVALID_PHONE";
  }

  return errors;
}

/* ============================================================
   7. PRESENTATION HELPERS
   ============================================================ */

function StatusBadge({
  verified,
  locale,
}: {
  verified: boolean;
  locale: Locale;
}) {
  const t = TEXT[locale];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
        verified
          ? "border-lime-200 bg-lime-50 text-green-800"
          : "border-amber-200 bg-amber-50 text-amber-800"
      }`}
    >
      {verified ? (
        <CheckCircle2
          size={13}
          aria-hidden="true"
        />
      ) : (
        <Info
          size={13}
          aria-hidden="true"
        />
      )}

      {verified
        ? t.verified
        : t.unverified}
    </span>
  );
}

function FormField({
  label,
  htmlFor,
  children,
  error,
  hint,
  required = false,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  error?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-bold text-slate-800"
      >
        {label}

        {required && (
          <span className="ms-1 text-red-600">
            *
          </span>
        )}
      </label>

      {children}

      {hint && (
        <p className="text-xs leading-relaxed text-slate-500">
          {hint}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="flex items-start gap-1.5 text-xs text-red-700"
        >
          <AlertCircle
            size={14}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />

          {error}
        </p>
      )}
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  icon: Icon,
  verified,
  locale,
  hint,
}: {
  label: string;
  value: string;
  icon: typeof UserRound;
  verified?: boolean;
  locale: Locale;
  hint?: string;
}) {
  const t = TEXT[locale];

  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <Icon
          size={15}
          aria-hidden="true"
        />

        {label}
      </div>

      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
        <span className="min-w-0 wrap-break-word text-sm font-bold leading-relaxed text-slate-900 sm:text-base">
          {value || t.notProvided}
        </span>

        {typeof verified ===
          "boolean" && (
          <StatusBadge
            verified={verified}
            locale={locale}
          />
        )}
      </div>

      {hint && (
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

function Notice({
  type,
  children,
}: {
  type: AlertType;
  children: ReactNode;
}) {
  const classes = {
    success:
      "border-lime-200 bg-lime-50 text-green-900",
    warning:
      "border-amber-200 bg-amber-50 text-amber-900",
    error:
      "border-red-200 bg-red-50 text-red-800",
  };

  return (
    <div
      role={type === "error"
        ? "alert"
        : "status"}
      aria-live="polite"
      className={`flex items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed ${classes[type]}`}
    >
      {type === "success" ? (
        <CheckCircle2
          size={19}
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        />
      ) : (
        <AlertCircle
          size={19}
          className="mt-0.5 shrink-0"
          aria-hidden="true"
        />
      )}

      <div className="min-w-0 flex-1">
        {children}
      </div>
    </div>
  );
}

/* ============================================================
   8. MAIN PAGE
   ============================================================ */

export default function AccountPage() {
  const [locale, setLocale] =
    useState<Locale>("de");

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [form, setForm] =
    useState<EditableProfile>({
      ...EMPTY_FORM,
    });

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [editing, setEditing] =
    useState(false);

  const [loadError, setLoadError] =
    useState<string | null>(null);

  const [alert, setAlert] =
    useState<AlertState | null>(null);

  const [fieldErrors, setFieldErrors] =
    useState<
      Partial<
        Record<EditableField, string>
      >
    >({});

  const [loginRequired, setLoginRequired] =
    useState(false);

  const requestCounter =
    useRef(0);

  const mounted =
    useRef(false);

  const t = TEXT[locale];

  const rtl = locale === "ar";
  const Arrow = rtl
    ? ArrowLeft
    : ArrowRight;

  /* ========================================================
     9. LANGUAGE SYNCHRONIZATION
     ======================================================== */

  useEffect(() => {
    const sync = (
      event?: Event
    ) => {
      if (
        event instanceof CustomEvent
      ) {
        const detail: unknown =
          event.detail;

        const candidate =
          typeof detail === "string"
            ? detail
            : isRecord(detail)
              ? detail.locale
              : null;

        const next =
          validLocale(candidate);

        if (next) {
          setLocale(next);
          return;
        }
      }

      setLocale(readActiveLocale());
    };

    sync();

    const observer =
      new MutationObserver(() => sync());

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

    window.addEventListener(
      "focus",
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

      window.removeEventListener(
        "focus",
        sync
      );
    };
  }, []);

  /* ========================================================
     10. FETCH REAL PROFILE

     No fake data.
     No browser-side identity parameter.
     No localStorage account data.
     ======================================================== */

  const loadProfile = useCallback(
    async (signal?: AbortSignal) => {
      const requestId =
        ++requestCounter.current;

      setLoading(true);
      setLoadError(null);
      setLoginRequired(false);
      setAlert(null);

      try {
        const response =
          await fetch(ACCOUNT_API, {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
            signal,
          });

        if (signal?.aborted) {
          return;
        }

        if (response.status === 401) {
          setLoginRequired(true);
          setProfile(null);
          return;
        }

        if (
          !response.ok
        ) {
          setLoadError(
            response.status === 404
              ? "ACCOUNT_NOT_FOUND"
              : "LOAD_FAILED"
          );

          setProfile(null);
          return;
        }

        const body: unknown =
          await response.json();

        if (
          !isRecord(body) ||
          body.success !== true
        ) {
          throw new Error(
            "INVALID_API_RESPONSE"
          );
        }

        const nextProfile =
          readProfile(body.profile);

        if (!nextProfile) {
          throw new Error(
            "INVALID_PROFILE_DATA"
          );
        }

        if (
          requestId !==
          requestCounter.current
        ) {
          return;
        }

        setProfile(nextProfile);

        setForm(
          toEditable(nextProfile)
        );

        setEditing(false);
        setFieldErrors({});
      } catch (error) {
        if (
          signal?.aborted ||
          (error instanceof Error &&
            error.name === "AbortError")
        ) {
          return;
        }

        setLoadError(
          "LOAD_FAILED"
        );
      } finally {
        if (
          requestId ===
            requestCounter.current &&
          !signal?.aborted
        ) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    mounted.current = true;

    const controller =
      new AbortController();

    const timer = window.setTimeout(() => {
      void loadProfile(controller.signal);
    }, 0);

    return () => {
      mounted.current = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadProfile]);

  /* ========================================================
     11. FORM STATE
     ======================================================== */

  function updateField(
    field: EditableField,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setAlert(null);

    setFieldErrors((previous) => {
      if (!previous[field]) {
        return previous;
      }

      const next = {
        ...previous,
      };

      delete next[field];

      return next;
    });
  }

  function beginEditing() {
    if (!profile) return;

    setForm(
      toEditable(profile)
    );

    setFieldErrors({});
    setAlert(null);
    setEditing(true);
  }

  function cancelEditing() {
    if (!profile || saving) {
      return;
    }

    setForm(
      toEditable(profile)
    );

    setEditing(false);
    setFieldErrors({});
    setAlert(null);
  }

  /* ========================================================
     12. FIELD ERROR TRANSLATIONS
     ======================================================== */

  function fieldErrorMessage(
    code?: string
  ): string | undefined {
    if (!code) {
      return undefined;
    }

    switch (code) {
      case "REQUIRED":
        return t.required;

      case "TOO_SHORT":
        return t.tooShort;

      case "TOO_LONG":
        return t.tooLong;

      case "INVALID_CHARACTERS":
        return t.invalidCharacters;

      case "INVALID_PHONE":
        return t.invalidPhone;

      case "INVALID_POSTAL_CODE":
        return t.invalidPostal;

      default:
        return t.invalidField;
    }
  }

  /* ========================================================
     13. SAVE CHANGES

     Send only changed allowed fields.

     Phone number:
     - Not silently activated.
     - No fake SMS confirmation.
     - Other fields can still be saved.
     ======================================================== */

  async function saveProfile(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !profile ||
      saving ||
      !editing
    ) {
      return;
    }

    const errors =
      validateForm(
        form,
        profile.countryCode
      );

    if (
      Object.keys(errors).length > 0
    ) {
      setFieldErrors(errors);

      setAlert({
        type: "error",
        message:
          t.invalidField,
      });

      return;
    }

    const oldForm =
      toEditable(profile);

    const patch:
      Partial<
        Pick<
          EditableProfile,
          SaveableField
        >
      > = {};

    const fields: readonly SaveableField[] =
      [
        "firstName",
        "lastName",
        "dateOfBirth",
        "streetAddress",
        "postalCode",
        "city",
      ];

    for (const field of fields) {
      const next =
        normalizedText(
          form[field]
        );

      const old =
        normalizedText(
          oldForm[field]
        );

      if (next !== old) {
        patch[field] = next;
      }
    }

    const phoneChanged =
      normalizedPhone(
        form.phoneE164
      ) !==
      normalizedPhone(
        oldForm.phoneE164
      );

    const hasOtherChanges =
      Object.keys(patch).length > 0;

    if (!hasOtherChanges) {
      if (phoneChanged) {
        setAlert({
          type: "warning",
          message:
            t.phoneNotSaved,
        });

        return;
      }

      setAlert({
        type: "warning",
        message:
          t.noChanges,
      });

      return;
    }

    setSaving(true);
    setAlert(null);
    setFieldErrors({});

    try {
      const response =
        await fetch(ACCOUNT_API, {
          method: "PATCH",
          credentials: "same-origin",
          cache: "no-store",

          headers: {
            "Content-Type":
              "application/json",
            Accept: "application/json",
          },

          body: JSON.stringify(patch),
        });

      let body: unknown = null;

      try {
        body = await response.json();
      } catch {
        // Invalid server response will
        // be handled below.
      }

      if (!response.ok) {
        const apiError =
          readApiError(body);

        if (
          response.status === 401
        ) {
          setLoginRequired(true);
          setProfile(null);

          setAlert({
            type: "error",
            message:
              t.loginRequired,
          });

          return;
        }

        if (
          apiError.code ===
          "VALIDATION_FAILED"
        ) {
          const nextErrors:
            Partial<
              Record<
                EditableField,
                string
              >
            > = {};

          for (
            const issue
            of apiError.issues ?? []
          ) {
            if (
              issue.field in form
            ) {
              nextErrors[
                issue.field as EditableField
              ] = issue.code;
            }
          }

          setFieldErrors(nextErrors);

          setAlert({
            type: "error",
            message:
              t.invalidField,
          });

          return;
        }

        const message =
          response.status === 409
            ? t.conflict
            : response.status === 403
              ? t.securityError
              : response.status >= 500
                ? t.serviceError
                : t.savingError;

        setAlert({
          type: "error",
          message,
        });

        return;
      }

      if (
        !isRecord(body) ||
        body.success !== true
      ) {
        throw new Error(
          "INVALID_SAVE_RESPONSE"
        );
      }

      const updatedProfile =
        readProfile(body.profile);

      if (!updatedProfile) {
        throw new Error(
          "INVALID_UPDATED_PROFILE"
        );
      }

      if (!mounted.current) {
        return;
      }

      setProfile(updatedProfile);

      setForm(
        toEditable(
          updatedProfile
        )
      );

      setEditing(false);
      setFieldErrors({});

      setAlert({
        type: phoneChanged
          ? "warning"
          : "success",

        message: phoneChanged
          ? t.otherSavedPhonePending
          : t.saved,
      });
    } catch {
      if (mounted.current) {
        setAlert({
          type: "error",
          message:
            t.savingError,
        });
      }
    } finally {
      if (mounted.current) {
        setSaving(false);
      }
    }
  }

  /* ========================================================
     14. DISPLAY HELPERS
     ======================================================== */

  const fullName = useMemo(() => {
    if (!profile) {
      return "";
    }

    return [
      profile.firstName,
      profile.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
  }, [profile]);

  const initials = useMemo(() => {
    if (!profile) {
      return "T";
    }

    return (
      (
        profile.firstName[0] ??
        ""
      ) +
      (
        profile.lastName[0] ??
        ""
      )
    )
      .toUpperCase() ||
      "T";
  }, [profile]);

  const inputClass =
    "min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-lime-500 focus:ring-2 focus:ring-lime-500/20 disabled:cursor-not-allowed disabled:bg-slate-50";

  const hasChanges =
    profile !== null &&
    (
      Object.keys(form) as EditableField[]
    ).some((field) => {
      const original =
        toEditable(profile)[field];

      return field === "phoneE164"
        ? normalizedPhone(
            form[field]
          ) !==
            normalizedPhone(original)
        : normalizedText(
            form[field]
          ) !==
            normalizedText(original);
    });

  /* ========================================================
     15. RESPONSIVE PAGE
     ======================================================== */

  return (
    <main
      lang={locale}
      dir={rtl ? "rtl" : "ltr"}
      className="min-w-0 bg-[#f5f8f2] px-4 py-6 text-slate-950 sm:px-6 sm:py-8 lg:px-8"
    >
      <div className="mx-auto w-full max-w-none">

        {/* ================================================
           TOP NAVIGATION
           ================================================ */}

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-green-800"
          >
            {rtl ? (
              <ArrowRight
                size={17}
                aria-hidden="true"
              />
            ) : (
              <ArrowLeft
                size={17}
                aria-hidden="true"
              />
            )}

            {t.back}
          </Link>

          <button
            type="button"
            onClick={() =>
              void loadProfile()
            }
            disabled={
              loading ||
              saving ||
              editing
            }
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:border-lime-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              aria-hidden="true"
            />

            {t.refresh}
          </button>
        </div>

        {/* ================================================
           PAGE TITLE
           ================================================ */}

        <div className="mb-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-lime-50 px-3 py-1.5 text-xs font-bold text-green-800">
            <UserRound
              size={15}
              aria-hidden="true"
            />

            {t.profile}
          </div>

          <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
            {t.title}
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            {t.subtitle}
          </p>
        </div>

        {/* ================================================
           LOADING STATE
           ================================================ */}

        {loading && (
          <div
            role="status"
            aria-live="polite"
            className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"
          >
            <Loader2
              size={35}
              className="animate-spin text-green-700"
              aria-hidden="true"
            />

            <p className="mt-4 text-sm font-semibold text-slate-600">
              {t.loading}
            </p>
          </div>
        )}

        {/* ================================================
           UNAUTHENTICATED
           ================================================ */}

        {!loading && loginRequired && (
          <div className="rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
            <LockKeyhole
              size={39}
              className="mx-auto text-amber-700"
            />

            <h2 className="mt-4 text-lg font-extrabold">
              {t.loginRequired}
            </h2>

            <Link
              href="/login"
              className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-green-800 px-6 py-3 text-sm font-bold text-white hover:bg-green-900"
            >
              {t.login}

              <Arrow
                size={17}
                aria-hidden="true"
              />
            </Link>
          </div>
        )}

        {/* ================================================
           LOADING ERROR
           ================================================ */}

        {!loading &&
          !loginRequired &&
          loadError && (
          <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <AlertCircle
              size={38}
              className="mx-auto text-red-700"
            />

            <p className="mt-4 text-sm font-semibold text-slate-700">
              {loadError ===
                "ACCOUNT_NOT_FOUND"
                ? t.accountMissing
                : t.loadingError}
            </p>

            <button
              type="button"
              onClick={() =>
                void loadProfile()
              }
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-900"
            >
              <RefreshCw size={17} />
              {t.reload}
            </button>
          </div>
        )}

        {/* ================================================
           REAL PROFILE
           ================================================ */}

        {!loading &&
          !loginRequired &&
          !loadError &&
          profile && (
          <>
            {/* PROFILE HEADER */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="h-20 bg-linear-to-r from-[#153d1c] via-[#397a24] to-[#9fcf3e] sm:h-28" />

              <div className="px-4 pb-5 sm:px-6 sm:pb-6">
                <div className="-mt-9 flex flex-wrap items-end justify-between gap-4 sm:-mt-11">
                  <div className="flex min-w-0 items-end gap-4">
                    <div className="flex size-19 shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-lime-100 text-2xl font-black text-green-900 shadow-sm sm:size-24 sm:text-3xl">
                      {initials}
                    </div>

                    <div className="min-w-0 pb-1">
                      <h2 className="wrap-break-word text-lg font-black text-slate-950 sm:text-2xl">
                        {fullName ||
                          t.profile}
                      </h2>

                      <p className="mt-1 break-all text-xs text-slate-500 sm:text-sm">
                        {profile.email}
                      </p>
                    </div>
                  </div>

                  {!editing && (
                    <button
                      type="button"
                      onClick={beginEditing}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-green-800 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-green-900 sm:w-auto"
                    >
                      <Pencil
                        size={17}
                        aria-hidden="true"
                      />

                      {t.edit}
                    </button>
                  )}
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700">
                    <span aria-hidden="true">
                      {
                        COUNTRY_FLAGS[
                          profile.countryCode
                        ]
                      }
                    </span>

                    {
                      COUNTRY_NAMES[
                        profile.countryCode
                      ][locale]
                    }
                  </span>

                  <StatusBadge
                    verified={
                      profile.emailVerified
                    }
                    locale={locale}
                  />
                </div>
              </div>
            </section>

            {/* ============================================
               ALERTS
               ============================================ */}

            {alert && (
              <div className="mt-5">
                <Notice type={alert.type}>
                  {alert.message}
                </Notice>
              </div>
            )}

            {/* ============================================
               ACCOUNT FORM
               ============================================ */}

            <form
              onSubmit={saveProfile}
              noValidate
              className="mt-6 space-y-6"
            >
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-green-800">
                    <UserRound
                      size={22}
                      aria-hidden="true"
                    />
                  </span>

                  <div>
                    <h2 className="text-lg font-black sm:text-xl">
                      {t.accountInformation}
                    </h2>

                    <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">
                      {t.profileDesc}
                    </p>
                  </div>
                </div>

                {/* Editable and protected fields */}

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  {(
                    [
                      {
                        key: "firstName",
                        label: t.firstName,
                        placeholder:
                          t.fieldExampleFirst,
                        autocomplete:
                          "given-name",
                      },
                      {
                        key: "lastName",
                        label: t.lastName,
                        placeholder:
                          t.fieldExampleLast,
                        autocomplete:
                          "family-name",
                      },
                    ] as const
                  ).map((field) => (
                    <div key={field.key}>
                      {editing ? (
                        <FormField
                          label={field.label}
                          htmlFor={
                            `account-${field.key}`
                          }
                          required
                          error={fieldErrorMessage(
                            fieldErrors[
                              field.key
                            ]
                          )}
                        >
                          <input
                            id={
                              `account-${field.key}`
                            }
                            name={field.key}
                            type="text"
                            autoComplete={
                              field.autocomplete
                            }
                            maxLength={80}
                            required
                            value={
                              form[field.key]
                            }
                            placeholder={
                              field.placeholder
                            }
                            onChange={(
                              event
                            ) =>
                              updateField(
                                field.key,
                                event.target.value
                              )
                            }
                            className={
                              inputClass
                            }
                          />
                        </FormField>
                      ) : (
                        <ReadOnlyField
                          label={
                            field.label
                          }
                          value={
                            profile[
                              field.key
                            ]
                          }
                          icon={UserRound}
                          locale={locale}
                        />
                      )}
                    </div>
                  ))}

                  {editing ? (
                    <FormField label={{ de: "Geburtsdatum", ar: "تاريخ الميلاد", tr: "Doğum tarihi", es: "Fecha de nacimiento" }[locale]} htmlFor="account-date-of-birth" error={fieldErrorMessage(fieldErrors.dateOfBirth)}>
                      <input id="account-date-of-birth" name="dateOfBirth" type="date" autoComplete="bday" value={form.dateOfBirth} onChange={(event) => updateField("dateOfBirth", event.target.value)} className={inputClass} />
                    </FormField>
                  ) : (
                    <ReadOnlyField label={{ de: "Geburtsdatum", ar: "تاريخ الميلاد", tr: "Doğum tarihi", es: "Fecha de nacimiento" }[locale]} value={profile.dateOfBirth} icon={UserRound} locale={locale} />
                  )}

                  <ReadOnlyField
                    label={t.country}
                    value={
                      `${COUNTRY_FLAGS[
                        profile.countryCode
                      ]} ${
                        COUNTRY_NAMES[
                          profile.countryCode
                        ][locale]
                      }`
                    }
                    icon={Globe2}
                    locale={locale}
                    hint={
                      editing
                        ? t.countryHint
                        : undefined
                    }
                  />

                  <ReadOnlyField
                    label={t.email}
                    value={profile.email}
                    icon={Mail}
                    locale={locale}
                    verified={
                      profile.emailVerified
                    }
                    hint={
                      editing
                        ? t.emailHint
                        : undefined
                    }
                  />

                  <div className="sm:col-span-2">
                    {editing ? (
                      <FormField
                        label={t.phone}
                        htmlFor="account-phone"
                        hint={t.phoneHint}
                        error={fieldErrorMessage(
                          fieldErrors.phoneE164
                        )}
                      >
                        <input
                          id="account-phone"
                          type="tel"
                          name="phoneE164"
                          dir="ltr"
                          autoComplete="tel"
                          inputMode="tel"
                          maxLength={32}
                          value={
                            form.phoneE164
                          }
                          placeholder="+491701234567"
                          onChange={(
                            event
                          ) =>
                            updateField(
                              "phoneE164",
                              event.target.value
                            )
                          }
                          className={
                            inputClass
                          }
                        />

                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                          <Info
                            size={16}
                            className="mt-0.5 shrink-0"
                          />

                          <span>
                            {t.phoneWarning}
                          </span>
                        </div>
                      </FormField>
                    ) : (
                      <ReadOnlyField
                        label={t.phone}
                        value={
                          profile.phoneE164
                        }
                        icon={Phone}
                        locale={locale}
                        verified={
                          profile.phoneVerified
                        }
                      />
                    )}
                  </div>
                </div>
              </section>

              {/* ==========================================
                 RESIDENTIAL ADDRESS
                 ========================================== */}

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-green-800">
                    <MapPin
                      size={22}
                      aria-hidden="true"
                    />
                  </span>

                  <div>
                    <h2 className="text-lg font-black sm:text-xl">
                      {t.addressInformation}
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                      {t.streetAddress},{" "}
                      {t.postalCode},{" "}
                      {t.city}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    {editing ? (
                      <FormField
                        label={t.streetAddress}
                        htmlFor="account-street"
                        required
                        error={fieldErrorMessage(
                          fieldErrors.streetAddress
                        )}
                      >
                        <input
                          id="account-street"
                          name="streetAddress"
                          type="text"
                          autoComplete="street-address"
                          maxLength={180}
                          required
                          value={
                            form.streetAddress
                          }
                          placeholder={
                            t.fieldExampleStreet
                          }
                          onChange={(
                            event
                          ) =>
                            updateField(
                              "streetAddress",
                              event.target.value
                            )
                          }
                          className={
                            inputClass
                          }
                        />
                      </FormField>
                    ) : (
                      <ReadOnlyField
                        label={t.streetAddress}
                        value={
                          profile.streetAddress
                        }
                        icon={Home}
                        locale={locale}
                      />
                    )}
                  </div>

                  <div>
                    {editing ? (
                      <FormField
                        label={t.postalCode}
                        htmlFor="account-postal"
                        required
                        error={fieldErrorMessage(
                          fieldErrors.postalCode
                        )}
                      >
                        <input
                          id="account-postal"
                          name="postalCode"
                          type="text"
                          inputMode="numeric"
                          autoComplete="postal-code"
                          maxLength={10}
                          required
                          value={
                            form.postalCode
                          }
                          placeholder={
                            t.fieldExamplePostal
                          }
                          onChange={(
                            event
                          ) =>
                            updateField(
                              "postalCode",
                              event.target.value
                            )
                          }
                          className={
                            inputClass
                          }
                        />
                      </FormField>
                    ) : (
                      <ReadOnlyField
                        label={t.postalCode}
                        value={
                          profile.postalCode
                        }
                        icon={MapPin}
                        locale={locale}
                      />
                    )}
                  </div>

                  <div>
                    {editing ? (
                      <FormField
                        label={t.city}
                        htmlFor="account-city"
                        required
                        error={fieldErrorMessage(
                          fieldErrors.city
                        )}
                      >
                        <input
                          id="account-city"
                          name="city"
                          type="text"
                          autoComplete="address-level2"
                          maxLength={100}
                          required
                          value={form.city}
                          placeholder={
                            t.fieldExampleCity
                          }
                          onChange={(
                            event
                          ) =>
                            updateField(
                              "city",
                              event.target.value
                            )
                          }
                          className={
                            inputClass
                          }
                        />
                      </FormField>
                    ) : (
                      <ReadOnlyField
                        label={t.city}
                        value={
                          profile.city
                        }
                        icon={MapPin}
                        locale={locale}
                      />
                    )}
                  </div>
                </div>
              </section>

              {/* ==========================================
                 EDIT BUTTONS
                 ========================================== */}

              {editing && (
                <section className="rounded-2xl border border-lime-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={cancelEditing}
                      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
                    >
                      <X size={18} />
                      {t.cancel}
                    </button>

                    <button
                      type="submit"
                      disabled={
                        saving ||
                        !hasChanges
                      }
                      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-green-800 to-lime-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:from-green-900 hover:to-lime-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                      {saving ? (
                        <Loader2
                          size={18}
                          className="animate-spin"
                        />
                      ) : (
                        <Save size={18} />
                      )}

                      {saving
                        ? t.saving
                        : t.save}
                    </button>
                  </div>
                </section>
              )}
            </form>

            {/* ============================================
               SECURITY NOTICE
               ============================================ */}

            <section className="mt-6 rounded-2xl border border-lime-200 bg-[#edf6e7] p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-green-800">
                  <ShieldCheck
                    size={23}
                    aria-hidden="true"
                  />
                </span>

                <div>
                  <h2 className="text-base font-extrabold text-green-950 sm:text-lg">
                    {t.securityTitle}
                  </h2>

                  <p className="mt-2 text-sm leading-relaxed text-green-900/80">
                    {t.securityDescription}
                  </p>
                </div>
              </div>
            </section>

            {/* ============================================
               EXISTING DASHBOARD LINKS
               ============================================ */}

            <section className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link
                href="/dashboard/application"
                className="flex min-h-16 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:border-lime-400 hover:bg-lime-50"
              >
                <ClipboardList
                  size={22}
                  className="shrink-0 text-green-800"
                />

                <span className="flex-1">
                  {t.application}
                </span>

                <ChevronRight
                  size={18}
                  className={
                    rtl
                      ? "rotate-180 text-slate-400"
                      : "text-slate-400"
                  }
                />
              </Link>

              <Link
                href="/fuehrerscheinklassen"
                className="flex min-h-16 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-900 shadow-sm transition-colors hover:border-lime-400 hover:bg-lime-50"
              >
                <Globe2
                  size={22}
                  className="shrink-0 text-green-800"
                />

                <span className="flex-1">
                  {t.categories}
                </span>

                <ChevronRight
                  size={18}
                  className={
                    rtl
                      ? "rotate-180 text-slate-400"
                      : "text-slate-400"
                  }
                />
              </Link>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
