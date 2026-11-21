
"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ClipboardEvent,
} from "react";

import Image from "next/image";
import Link from "next/link";

import {
  Mail,
  ShieldCheck,
  LockKeyhole,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  LoaderCircle,
  CircleAlert,
  CheckCircle2,
  RefreshCw,
  Clock3,
  Check,
} from "lucide-react";

import {
  defaultLocale,
  isLocale,
  getLocaleDirection,
  type Locale,
} from "@/i18n/config";

/* ============================================================
   FAHRSCHULE TAYM

   PASSWORD RECOVERY PAGE

   File:
   src/app/(auth)/forgot-password/page.tsx

   Steps:
   1. Enter email address
   2. Verify six-digit email code
   3. Create a new password
   4. Automatic authenticated dashboard access

   APIs:
   POST /api/auth/forgot-password
   POST /api/auth/verify-reset-code
   POST /api/auth/reset-password

   Languages:
   DE | AR | TR | ES

   Existing navigation:
   Header.tsx
   MobileNav.tsx
   LanguageSwitcher.tsx
   (auth)/layout.tsx

   No additional layout.
   No additional navigation.
   No decorative images.
   No additional CSS file.
   ============================================================ */

/* ============================================================
   1. CONFIGURATION
   ============================================================ */

const API = {
  request: "/api/auth/forgot-password",
  verify: "/api/auth/verify-reset-code",
  reset: "/api/auth/reset-password",
} as const;

const LOGIN_PATH = "/login";

const DASHBOARD_PATH = "/dashboard";

const LANGUAGE_STORAGE_KEY = "taym-locale";

const LANGUAGE_EVENT = "taym:language-change";

const CODE_LENGTH = 6;

const PASSWORD_MIN_LENGTH = 12;

const PASSWORD_MAX_BYTES = 1024;

const REQUEST_TIMEOUT_MS = 30_000;

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/* ============================================================
   2. TYPES
   ============================================================ */

type Step =
  | "EMAIL"
  | "VERIFY"
  | "PASSWORD"
  | "SUCCESS";

type RequestAction =
  | "SEND"
  | "RESEND"
  | "VERIFY"
  | "RESET";

type ErrorCode =
  | "INVALID_INPUT"
  | "INVALID_EMAIL"
  | "INVALID_JSON"
  | "INVALID_CODE"
  | "CODE_EXPIRED"
  | "TOO_MANY_ATTEMPTS"
  | "INVALID_RESET_TOKEN"
  | "RESET_TOKEN_EXPIRED"
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_TOO_LONG"
  | "PASSWORD_MISMATCH"
  | "RESET_NOT_AVAILABLE"
  | "FORBIDDEN_ORIGIN"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR"
  | "NETWORK_ERROR"
  | "TIMEOUT";

type ApiFailure = {
  success: false;
  error?: {
    code?: string;
    message?: string;
    retryAfter?: number;
  };
};

type ApiSuccess<T> = {
  success: true;
  data: T;
};

type ApiResponse<T> =
  | ApiSuccess<T>
  | ApiFailure;

type RequestCodeData = {
  challengeId: string;
  expiresAt: string;
  resendAfter: number;
  codeLength: 6;
  nextStep: "VERIFY_CODE";
  message: string;
};

type VerifyCodeData = {
  challengeId: string;
  verified: true;
  canResetPassword: true;
  expiresAt: string;
  nextStep: "NEW_PASSWORD";
};

type ResetPasswordData = {
  passwordUpdated: true;

  session: {
    authenticated: true;
    expiresAt: string;
  };

  redirectTo: "/dashboard";
};

type Translation = {
  emailStep: string;
  codeStep: string;
  passwordStep: string;

  emailTitle: string;
  emailDescription: string;
  emailLabel: string;
  emailPlaceholder: string;

  sendCode: string;
  sendingCode: string;

  codeTitle: string;
  codeDescription: string;
  codeLabel: string;
  verifyCode: string;
  verifyingCode: string;

  resendCode: string;
  resendingCode: string;
  resendIn: string;
  resendNotice: string;

  changeEmail: string;

  codeExpiresIn: string;
  codeExpired: string;

  passwordTitle: string;
  passwordDescription: string;
  passwordLabel: string;
  passwordPlaceholder: string;

  confirmLabel: string;
  confirmPlaceholder: string;

  showPassword: string;
  hidePassword: string;

  passwordLength: string;
  passwordMatch: string;

  resetPassword: string;
  resettingPassword: string;

  authorizationExpiresIn: string;

  successTitle: string;
  successDescription: string;
  dashboard: string;

  backToLogin: string;
  restart: string;

  secure: string;

  errors: Record<ErrorCode, string>;
};

/* ============================================================
   3. TRANSLATIONS

   German is the default language.
   Arabic supports RTL.
   No additional language selector.
   ============================================================ */

const TRANSLATIONS: Record<
  Locale,
  Translation
> = {
  /* ========================================================
     GERMAN
     ======================================================== */

  de: {
    emailStep: "E-Mail",
    codeStep: "Bestätigung",
    passwordStep: "Passwort",

    emailTitle: "Passwort vergessen?",

    emailDescription:
      "Geben Sie Ihre E-Mail-Adresse ein, um Ihr Passwort zurückzusetzen.",

    emailLabel: "E-Mail-Adresse",

    emailPlaceholder:
      "E-Mail-Adresse eingeben",

    sendCode: "Code senden",

    sendingCode:
      "Code wird gesendet...",

    codeTitle: "Code bestätigen",

    codeDescription:
      "Wenn ein Konto mit dieser E-Mail-Adresse vorhanden ist, erhalten Sie einen 6-stelligen Bestätigungscode.",

    codeLabel:
      "6-stelliger Bestätigungscode",

    verifyCode: "Bestätigen",

    verifyingCode:
      "Code wird überprüft...",

    resendCode:
      "Code erneut senden",

    resendingCode:
      "Code wird erneut gesendet...",

    resendIn:
      "Erneut senden in",

    resendNotice:
      "Die Code-Anfrage wurde verarbeitet. Bitte überprüfen Sie Ihren Posteingang und Spam-Ordner.",

    changeEmail:
      "E-Mail-Adresse ändern",

    codeExpiresIn:
      "Code gültig für",

    codeExpired:
      "Der Code ist abgelaufen. Fordern Sie einen neuen Code an.",

    passwordTitle:
      "Neues Passwort",

    passwordDescription:
      "Erstellen Sie ein neues Passwort für Ihr Konto.",

    passwordLabel:
      "Neues Passwort",

    passwordPlaceholder:
      "Neues Passwort eingeben",

    confirmLabel:
      "Passwort bestätigen",

    confirmPlaceholder:
      "Passwort erneut eingeben",

    showPassword:
      "Passwort anzeigen",

    hidePassword:
      "Passwort verbergen",

    passwordLength:
      "Mindestens 12 Zeichen",

    passwordMatch:
      "Passwörter stimmen überein",

    resetPassword:
      "Passwort speichern",

    resettingPassword:
      "Passwort wird gespeichert...",

    authorizationExpiresIn:
      "Bestätigung gültig für",

    successTitle:
      "Passwort erfolgreich geändert!",

    successDescription:
      "Sie sind jetzt angemeldet und werden zu Ihrem Dashboard weitergeleitet.",

    dashboard:
      "Zum Dashboard",

    backToLogin:
      "Zurück zur Anmeldung",

    restart:
      "Erneut beginnen",

    secure:
      "Sichere Passwort-Wiederherstellung",

    errors: {
      INVALID_INPUT:
        "Bitte überprüfen Sie Ihre Angaben.",

      INVALID_EMAIL:
        "Bitte geben Sie eine gültige E-Mail-Adresse ein.",

      INVALID_JSON:
        "Die Anfrage konnte nicht verarbeitet werden.",

      INVALID_CODE:
        "Der Bestätigungscode ist ungültig.",

      CODE_EXPIRED:
        "Der Code ist abgelaufen. Bitte fordern Sie einen neuen Code an.",

      TOO_MANY_ATTEMPTS:
        "Zu viele Versuche. Bitte versuchen Sie es später erneut oder fordern Sie einen neuen Code an.",

      INVALID_RESET_TOKEN:
        "Ihre Bestätigung ist nicht mehr gültig. Bitte beginnen Sie erneut.",

      RESET_TOKEN_EXPIRED:
        "Ihre Bestätigung ist abgelaufen. Bitte beginnen Sie erneut.",

      PASSWORD_TOO_SHORT:
        "Das Passwort muss mindestens 12 Zeichen enthalten.",

      PASSWORD_TOO_LONG:
        "Das Passwort ist zu lang.",

      PASSWORD_MISMATCH:
        "Die Passwörter stimmen nicht überein.",

      RESET_NOT_AVAILABLE:
        "Das Passwort kann derzeit nicht zurückgesetzt werden.",

      FORBIDDEN_ORIGIN:
        "Diese Anfrage ist nicht erlaubt.",

      UNSUPPORTED_MEDIA_TYPE:
        "Die Anfrage konnte nicht verarbeitet werden.",

      PAYLOAD_TOO_LARGE:
        "Die eingegebenen Daten sind zu lang.",

      SERVICE_UNAVAILABLE:
        "Der Dienst ist vorübergehend nicht verfügbar.",

      INTERNAL_ERROR:
        "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",

      NETWORK_ERROR:
        "Keine Verbindung zum Server. Bitte überprüfen Sie Ihre Internetverbindung.",

      TIMEOUT:
        "Die Anfrage hat zu lange gedauert. Bitte versuchen Sie es erneut.",
    },
  },

  /* ========================================================
     ARABIC
     ======================================================== */

  ar: {
    emailStep: "البريد الإلكتروني",
    codeStep: "التحقق",
    passwordStep: "كلمة المرور",

    emailTitle: "نسيت كلمة المرور؟",

    emailDescription:
      "أدخل بريدك الإلكتروني لإعادة تعيين كلمة المرور.",

    emailLabel:
      "البريد الإلكتروني",

    emailPlaceholder:
      "أدخل بريدك الإلكتروني",

    sendCode:
      "إرسال الرمز",

    sendingCode:
      "جارٍ إرسال الرمز...",

    codeTitle:
      "تأكيد رمز التحقق",

    codeDescription:
      "إذا كان هناك حساب مرتبط بهذا البريد الإلكتروني، فستتلقى رمز تحقق مكوناً من 6 أرقام.",

    codeLabel:
      "رمز التحقق المكون من 6 أرقام",

    verifyCode:
      "تأكيد الرمز",

    verifyingCode:
      "جارٍ التحقق من الرمز...",

    resendCode:
      "إعادة إرسال الرمز",

    resendingCode:
      "جارٍ إعادة إرسال الرمز...",

    resendIn:
      "إعادة الإرسال بعد",

    resendNotice:
      "تمت معالجة طلب الرمز. يرجى التحقق من صندوق الوارد والبريد غير المرغوب فيه.",

    changeEmail:
      "تغيير البريد الإلكتروني",

    codeExpiresIn:
      "الرمز صالح لمدة",

    codeExpired:
      "انتهت صلاحية الرمز. اطلب رمزاً جديداً.",

    passwordTitle:
      "كلمة مرور جديدة",

    passwordDescription:
      "أنشئ كلمة مرور جديدة لحسابك.",

    passwordLabel:
      "كلمة المرور الجديدة",

    passwordPlaceholder:
      "أدخل كلمة المرور الجديدة",

    confirmLabel:
      "تأكيد كلمة المرور",

    confirmPlaceholder:
      "أعد إدخال كلمة المرور",

    showPassword:
      "إظهار كلمة المرور",

    hidePassword:
      "إخفاء كلمة المرور",

    passwordLength:
      "12 حرفاً على الأقل",

    passwordMatch:
      "كلمتا المرور متطابقتان",

    resetPassword:
      "حفظ كلمة المرور",

    resettingPassword:
      "جارٍ حفظ كلمة المرور...",

    authorizationExpiresIn:
      "التحقق صالح لمدة",

    successTitle:
      "تم تغيير كلمة المرور بنجاح!",

    successDescription:
      "تم تسجيل دخولك وسيتم توجيهك إلى لوحة التحكم.",

    dashboard:
      "الانتقال إلى لوحة التحكم",

    backToLogin:
      "العودة إلى تسجيل الدخول",

    restart:
      "البدء من جديد",

    secure:
      "استعادة آمنة لكلمة المرور",

    errors: {
      INVALID_INPUT:
        "يرجى التحقق من المعلومات المدخلة.",

      INVALID_EMAIL:
        "يرجى إدخال بريد إلكتروني صالح.",

      INVALID_JSON:
        "تعذر معالجة الطلب.",

      INVALID_CODE:
        "رمز التحقق غير صحيح.",

      CODE_EXPIRED:
        "انتهت صلاحية الرمز. اطلب رمزاً جديداً.",

      TOO_MANY_ATTEMPTS:
        "عدد المحاولات كبير جداً. حاول لاحقاً أو اطلب رمزاً جديداً.",

      INVALID_RESET_TOKEN:
        "لم يعد التحقق صالحاً. يرجى البدء من جديد.",

      RESET_TOKEN_EXPIRED:
        "انتهت صلاحية التحقق. يرجى البدء من جديد.",

      PASSWORD_TOO_SHORT:
        "يجب أن تحتوي كلمة المرور على 12 حرفاً على الأقل.",

      PASSWORD_TOO_LONG:
        "كلمة المرور طويلة جداً.",

      PASSWORD_MISMATCH:
        "كلمتا المرور غير متطابقتين.",

      RESET_NOT_AVAILABLE:
        "لا يمكن إعادة تعيين كلمة المرور حالياً.",

      FORBIDDEN_ORIGIN:
        "هذا الطلب غير مسموح به.",

      UNSUPPORTED_MEDIA_TYPE:
        "تعذر معالجة الطلب.",

      PAYLOAD_TOO_LARGE:
        "البيانات المدخلة طويلة جداً.",

      SERVICE_UNAVAILABLE:
        "الخدمة غير متاحة مؤقتاً.",

      INTERNAL_ERROR:
        "حدث خطأ. يرجى المحاولة مرة أخرى.",

      NETWORK_ERROR:
        "تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت.",

      TIMEOUT:
        "استغرق الطلب وقتاً طويلاً. حاول مرة أخرى.",
    },
  },

  /* ========================================================
     TURKISH
     ======================================================== */

  tr: {
    emailStep: "E-posta",
    codeStep: "Doğrulama",
    passwordStep: "Şifre",

    emailTitle:
      "Şifrenizi mi unuttunuz?",

    emailDescription:
      "Şifrenizi sıfırlamak için e-posta adresinizi girin.",

    emailLabel:
      "E-posta adresi",

    emailPlaceholder:
      "E-posta adresinizi girin",

    sendCode:
      "Kod gönder",

    sendingCode:
      "Kod gönderiliyor...",

    codeTitle:
      "Kodu doğrulayın",

    codeDescription:
      "Bu e-posta adresine bağlı bir hesap varsa 6 haneli bir doğrulama kodu alacaksınız.",

    codeLabel:
      "6 haneli doğrulama kodu",

    verifyCode:
      "Doğrula",

    verifyingCode:
      "Kod doğrulanıyor...",

    resendCode:
      "Kodu tekrar gönder",

    resendingCode:
      "Kod tekrar gönderiliyor...",

    resendIn:
      "Tekrar gönderme süresi",

    resendNotice:
      "Kod isteği işlendi. Gelen kutunuzu ve spam klasörünüzü kontrol edin.",

    changeEmail:
      "E-posta adresini değiştir",

    codeExpiresIn:
      "Kodun geçerlilik süresi",

    codeExpired:
      "Kodun süresi doldu. Yeni bir kod isteyin.",

    passwordTitle:
      "Yeni şifre",

    passwordDescription:
      "Hesabınız için yeni bir şifre oluşturun.",

    passwordLabel:
      "Yeni şifre",

    passwordPlaceholder:
      "Yeni şifrenizi girin",

    confirmLabel:
      "Şifreyi doğrulayın",

    confirmPlaceholder:
      "Şifrenizi tekrar girin",

    showPassword:
      "Şifreyi göster",

    hidePassword:
      "Şifreyi gizle",

    passwordLength:
      "En az 12 karakter",

    passwordMatch:
      "Şifreler eşleşiyor",

    resetPassword:
      "Şifreyi kaydet",

    resettingPassword:
      "Şifre kaydediliyor...",

    authorizationExpiresIn:
      "Doğrulama geçerlilik süresi",

    successTitle:
      "Şifreniz başarıyla değiştirildi!",

    successDescription:
      "Giriş yaptınız ve kontrol panelinize yönlendiriliyorsunuz.",

    dashboard:
      "Kontrol paneline git",

    backToLogin:
      "Giriş sayfasına dön",

    restart:
      "Yeniden başlat",

    secure:
      "Güvenli şifre kurtarma",

    errors: {
      INVALID_INPUT:
        "Lütfen bilgilerinizi kontrol edin.",

      INVALID_EMAIL:
        "Geçerli bir e-posta adresi girin.",

      INVALID_JSON:
        "İstek işlenemedi.",

      INVALID_CODE:
        "Doğrulama kodu geçersiz.",

      CODE_EXPIRED:
        "Kodun süresi doldu. Yeni bir kod isteyin.",

      TOO_MANY_ATTEMPTS:
        "Çok fazla deneme. Daha sonra tekrar deneyin veya yeni kod isteyin.",

      INVALID_RESET_TOKEN:
        "Doğrulama artık geçerli değil. Lütfen yeniden başlayın.",

      RESET_TOKEN_EXPIRED:
        "Doğrulamanın süresi doldu. Lütfen yeniden başlayın.",

      PASSWORD_TOO_SHORT:
        "Şifre en az 12 karakter içermelidir.",

      PASSWORD_TOO_LONG:
        "Şifre çok uzun.",

      PASSWORD_MISMATCH:
        "Şifreler eşleşmiyor.",

      RESET_NOT_AVAILABLE:
        "Şifre şu anda sıfırlanamıyor.",

      FORBIDDEN_ORIGIN:
        "Bu isteğe izin verilmiyor.",

      UNSUPPORTED_MEDIA_TYPE:
        "İstek işlenemedi.",

      PAYLOAD_TOO_LARGE:
        "Girilen bilgiler çok uzun.",

      SERVICE_UNAVAILABLE:
        "Hizmet geçici olarak kullanılamıyor.",

      INTERNAL_ERROR:
        "Bir hata oluştu. Lütfen tekrar deneyin.",

      NETWORK_ERROR:
        "Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.",

      TIMEOUT:
        "İstek zaman aşımına uğradı. Tekrar deneyin.",
    },
  },

  /* ========================================================
     SPANISH
     ======================================================== */

  es: {
    emailStep: "Correo",
    codeStep: "Verificación",
    passwordStep: "Contraseña",

    emailTitle:
      "¿Olvidó su contraseña?",

    emailDescription:
      "Introduzca su correo electrónico para restablecer su contraseña.",

    emailLabel:
      "Correo electrónico",

    emailPlaceholder:
      "Introduzca su correo electrónico",

    sendCode:
      "Enviar código",

    sendingCode:
      "Enviando código...",

    codeTitle:
      "Verificar código",

    codeDescription:
      "Si existe una cuenta asociada a este correo electrónico, recibirá un código de verificación de 6 dígitos.",

    codeLabel:
      "Código de verificación de 6 dígitos",

    verifyCode:
      "Verificar",

    verifyingCode:
      "Verificando código...",

    resendCode:
      "Reenviar código",

    resendingCode:
      "Reenviando código...",

    resendIn:
      "Reenviar en",

    resendNotice:
      "La solicitud se ha procesado. Revise su bandeja de entrada y la carpeta de correo no deseado.",

    changeEmail:
      "Cambiar correo electrónico",

    codeExpiresIn:
      "Código válido durante",

    codeExpired:
      "El código ha caducado. Solicite uno nuevo.",

    passwordTitle:
      "Nueva contraseña",

    passwordDescription:
      "Cree una nueva contraseña para su cuenta.",

    passwordLabel:
      "Nueva contraseña",

    passwordPlaceholder:
      "Introduzca la nueva contraseña",

    confirmLabel:
      "Confirmar contraseña",

    confirmPlaceholder:
      "Repita la contraseña",

    showPassword:
      "Mostrar contraseña",

    hidePassword:
      "Ocultar contraseña",

    passwordLength:
      "Al menos 12 caracteres",

    passwordMatch:
      "Las contraseñas coinciden",

    resetPassword:
      "Guardar contraseña",

    resettingPassword:
      "Guardando contraseña...",

    authorizationExpiresIn:
      "Verificación válida durante",

    successTitle:
      "¡Contraseña cambiada correctamente!",

    successDescription:
      "Ha iniciado sesión y será redirigido a su panel de control.",

    dashboard:
      "Ir al panel de control",

    backToLogin:
      "Volver al inicio de sesión",

    restart:
      "Empezar de nuevo",

    secure:
      "Recuperación segura de contraseña",

    errors: {
      INVALID_INPUT:
        "Compruebe sus datos.",

      INVALID_EMAIL:
        "Introduzca un correo electrónico válido.",

      INVALID_JSON:
        "No se pudo procesar la solicitud.",

      INVALID_CODE:
        "El código de verificación no es válido.",

      CODE_EXPIRED:
        "El código ha caducado. Solicite uno nuevo.",

      TOO_MANY_ATTEMPTS:
        "Demasiados intentos. Inténtelo más tarde o solicite otro código.",

      INVALID_RESET_TOKEN:
        "La verificación ya no es válida. Empiece de nuevo.",

      RESET_TOKEN_EXPIRED:
        "La verificación ha caducado. Empiece de nuevo.",

      PASSWORD_TOO_SHORT:
        "La contraseña debe contener al menos 12 caracteres.",

      PASSWORD_TOO_LONG:
        "La contraseña es demasiado larga.",

      PASSWORD_MISMATCH:
        "Las contraseñas no coinciden.",

      RESET_NOT_AVAILABLE:
        "No se puede restablecer la contraseña en este momento.",

      FORBIDDEN_ORIGIN:
        "Esta solicitud no está permitida.",

      UNSUPPORTED_MEDIA_TYPE:
        "No se pudo procesar la solicitud.",

      PAYLOAD_TOO_LARGE:
        "Los datos introducidos son demasiado largos.",

      SERVICE_UNAVAILABLE:
        "El servicio no está disponible temporalmente.",

      INTERNAL_ERROR:
        "Ha ocurrido un error. Inténtelo de nuevo.",

      NETWORK_ERROR:
        "No se pudo conectar al servidor. Compruebe su conexión a Internet.",

      TIMEOUT:
        "La solicitud ha tardado demasiado.",
    },
  },
};

/* ============================================================
   4. LANGUAGE SYNCHRONIZATION
   ============================================================ */

function readCookie(
  name: string
): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${name}=`;

  const entry = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));

  if (!entry) {
    return null;
  }

  try {
    return decodeURIComponent(
      entry.slice(prefix.length)
    );
  } catch {
    return null;
  }
}

function getCurrentLocale(): Locale {
  if (typeof window === "undefined") {
    return defaultLocale;
  }

  const cookieLocale = readCookie(
    LANGUAGE_STORAGE_KEY
  );

  if (
    cookieLocale &&
    isLocale(cookieLocale)
  ) {
    return cookieLocale;
  }

  try {
    const storedLocale =
      window.localStorage.getItem(
        LANGUAGE_STORAGE_KEY
      );

    if (
      storedLocale &&
      isLocale(storedLocale)
    ) {
      return storedLocale;
    }
  } catch {
    // Storage may be unavailable.
  }

  const htmlLocale =
    document.documentElement.lang
      .split("-")[0]
      .toLowerCase();

  return isLocale(htmlLocale)
    ? htmlLocale
    : defaultLocale;
}

/* ============================================================
   5. HELPERS
   ============================================================ */

function normalizeEmail(
  value: string
): string {
  return value.trim().toLowerCase();
}

function normalizeDigits(
  value: string
): string {
  return value
    .replace(
      /[٠-٩]/g,
      (digit) =>
        String(
          digit.charCodeAt(0) - 0x0660
        )
    )
    .replace(
      /[۰-۹]/g,
      (digit) =>
        String(
          digit.charCodeAt(0) - 0x06f0
        )
    )
    .replace(/\D/g, "")
    .slice(0, CODE_LENGTH);
}

function parseExpiration(
  value: unknown
): number {
  if (typeof value !== "string") {
    return 0;
  }

  const timestamp =
    Date.parse(value);

  return Number.isFinite(timestamp)
    ? timestamp
    : 0;
}

function remainingSeconds(
  timestamp: number,
  now: number
): number {
  return Math.max(
    0,
    Math.ceil(
      (timestamp - now) / 1000
    )
  );
}

function formatCountdown(
  totalSeconds: number
): string {
  const seconds =
    Math.max(0, totalSeconds);

  const minutes =
    Math.floor(seconds / 60);

  const remainder =
    seconds % 60;

  return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(remainder).padStart(2, "0")
  );
}

function getKnownErrorCode(
  value: unknown
): ErrorCode {
  const errors: ErrorCode[] = [
    "INVALID_INPUT",
    "INVALID_EMAIL",
    "INVALID_JSON",
    "INVALID_CODE",
    "CODE_EXPIRED",
    "TOO_MANY_ATTEMPTS",
    "INVALID_RESET_TOKEN",
    "RESET_TOKEN_EXPIRED",
    "PASSWORD_TOO_SHORT",
    "PASSWORD_TOO_LONG",
    "PASSWORD_MISMATCH",
    "RESET_NOT_AVAILABLE",
    "FORBIDDEN_ORIGIN",
    "UNSUPPORTED_MEDIA_TYPE",
    "PAYLOAD_TOO_LARGE",
    "SERVICE_UNAVAILABLE",
    "INTERNAL_ERROR",
    "NETWORK_ERROR",
    "TIMEOUT",
  ];

  return (
    typeof value === "string" &&
    errors.includes(value as ErrorCode)
  )
    ? (value as ErrorCode)
    : "INTERNAL_ERROR";
}

/* ============================================================
   6. API ERROR
   ============================================================ */

class PasswordRecoveryApiError extends Error {
  readonly code: ErrorCode;

  readonly retryAfter: number;

  constructor(
    code: ErrorCode,
    retryAfter = 0
  ) {
    super(code);

    this.name =
      "PasswordRecoveryApiError";

    this.code = code;

    this.retryAfter = retryAfter;
  }
}

/* ============================================================
   7. API REQUEST HELPER

   All requests:
   - same-origin credentials
   - no cache
   - JSON request body
   - request timeout
   - AbortController

   Reset authorization is handled
   exclusively by HttpOnly cookies.
   ============================================================ */

async function postJson<T>(
  url: string,
  body: Record<string, unknown>,
  controller: AbortController
): Promise<T> {
  let timedOut = false;

  const timeout =
    window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

  try {
    const response =
      await fetch(url, {
        method: "POST",

        credentials: "same-origin",

        cache: "no-store",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",
        },

        body:
          JSON.stringify(body),

        signal:
          controller.signal,
      });

    let payload:
      | ApiResponse<T>
      | null = null;

    try {
      payload =
        (await response.json()) as
          ApiResponse<T>;
    } catch {
      if (timedOut) {
        throw new PasswordRecoveryApiError(
          "TIMEOUT"
        );
      }

      if (controller.signal.aborted) {
        throw new DOMException(
          "Aborted",
          "AbortError"
        );
      }
    }

    if (
      !response.ok ||
      !payload ||
      payload.success !== true
    ) {
      const errorPayload =
        payload?.success === false
          ? payload.error
          : undefined;

      let code: ErrorCode;

      if (response.status === 429) {
        code = "TOO_MANY_ATTEMPTS";
      } else if (errorPayload?.code) {
        code = getKnownErrorCode(
          errorPayload.code
        );
      } else if (response.status === 503) {
        code = "SERVICE_UNAVAILABLE";
      } else {
        code = "INTERNAL_ERROR";
      }

      const retryHeader = Number(
        response.headers.get("Retry-After")
      );

      const retryBody =
        errorPayload?.retryAfter;

      const rawRetry =
        typeof retryBody === "number"
          ? retryBody
          : retryHeader;

      const retryAfter =
        Number.isFinite(rawRetry) &&
        rawRetry > 0
          ? Math.min(
              86_400,
              Math.ceil(rawRetry)
            )
          : 0;

      throw new PasswordRecoveryApiError(
        code,
        retryAfter
      );
    }

    return payload.data;

  } catch (error) {
    if (
      error instanceof
      PasswordRecoveryApiError
    ) {
      throw error;
    }

    if (timedOut) {
      throw new PasswordRecoveryApiError(
        "TIMEOUT"
      );
    }

    if (controller.signal.aborted) {
      throw error;
    }

    throw new PasswordRecoveryApiError(
      "NETWORK_ERROR"
    );

  } finally {
    window.clearTimeout(timeout);
  }
}

/* ============================================================
   8. STEP INDICATOR

   Responsive.
   Reuses the page's existing direction.
   Not a navigation menu.
   ============================================================ */

function StepIndicator({
  step,
  t,
}: {
  step: Step;
  t: Translation;
}) {
  const activeIndex =
    step === "EMAIL"
      ? 0
      : step === "VERIFY"
        ? 1
        : step === "PASSWORD"
          ? 2
          : 3;

  const steps = [
    t.emailStep,
    t.codeStep,
    t.passwordStep,
  ];

  return (
    <div className="mb-8 w-full">
      <div className="flex items-start">
        {steps.map((label, index) => {
          const completed =
            index < activeIndex;

          const active =
            index === activeIndex;

          return (
            <div
              key={index}
              className="relative min-w-0 flex-1"
            >
              {index < steps.length - 1 && (
                <div
                  aria-hidden="true"
                  className={`
                    absolute
                    top-4.25
                    inset-s-1/2
                    h-0.75
                    w-full
                    rounded-full
                    ${
                      completed
                        ? "bg-[#68ad21]"
                        : "bg-[#e2e8df]"
                    }
                  `}
                />
              )}

              <div className="relative z-10 flex flex-col items-center gap-2 px-1">
                <div
                  aria-current={
                    active
                      ? "step"
                      : undefined
                  }
                  className={`
                    grid
                    h-9
                    w-9
                    place-items-center
                    rounded-full
                    border-2
                    text-sm
                    font-extrabold
                    ${
                      completed || active
                        ? "border-[#418900] bg-[#418900] text-white"
                        : "border-[#dce4d8] bg-white text-[#879187]"
                    }
                    ${
                      active
                        ? "ring-4 ring-lime-100"
                        : ""
                    }
                  `}
                >
                  {completed ? (
                    <Check
                      size={19}
                      strokeWidth={3}
                      aria-hidden="true"
                    />
                  ) : (
                    index + 1
                  )}
                </div>

                <span
                  className={`
                    wrap-break-word
                    text-center
                    text-[10px]
                    font-semibold
                    leading-4
                    sm:text-xs
                    ${
                      completed || active
                        ? "text-[#347b00]"
                        : "text-[#778177]"
                    }
                  `}
                >
                  {label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   9. PASSWORD FIELD
   ============================================================ */

function PasswordField({
  id,
  label,
  placeholder,
  value,
  disabled,
  showLabel,
  hideLabel,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  disabled: boolean;
  showLabel: string;
  hideLabel: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] =
    useState(false);

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-semibold text-[#303b34]"
      >
        {label}
      </label>

      <div className="relative">
        <LockKeyhole
          size={21}
          aria-hidden="true"
          className="pointer-events-none absolute inset-s-4 top-1/2 -translate-y-1/2 text-[#69736c]"
        />

        <input
          id={id}
          name={id}
          type={
            visible && !disabled
              ? "text"
              : "password"
          }
          autoComplete="new-password"
          autoCapitalize="none"
          spellCheck={false}
          dir="auto"
          value={value}
          disabled={disabled}
          maxLength={1024}
          required
          placeholder={placeholder}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="
            h-14
            w-full
            rounded-[13px]
            border
            border-[#d6ddd6]
            bg-white
            px-12
            text-[16px]
            text-[#172019]
            outline-none
            transition
            placeholder:text-[#899189]
            focus:border-[#65b900]
            focus:ring-4
            focus:ring-lime-100
            disabled:opacity-60
          "
        />

        <button
          type="button"
          disabled={disabled}
          aria-label={
            visible
              ? hideLabel
              : showLabel
          }
          aria-pressed={visible}
          onClick={() =>
            setVisible((current) => !current)
          }
          className="
            absolute
            inset-e-2
            top-1/2
            grid
            h-10
            w-10
            -translate-y-1/2
            place-items-center
            rounded-lg
            text-[#69736c]
            hover:bg-lime-50
            hover:text-green-800
            focus-visible:outline-2
            focus-visible:outline-[#65b900]
            disabled:opacity-50
          "
        >
          {visible ? (
            <EyeOff
              size={21}
              aria-hidden="true"
            />
          ) : (
            <Eye
              size={21}
              aria-hidden="true"
            />
          )}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   10. PRIMARY BUTTON
   ============================================================ */

function PrimaryButton({
  children,
  loading,
  disabled,
  isRtl,
}: {
  children: React.ReactNode;
  loading: boolean;
  disabled: boolean;
  isRtl: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className="
        flex
        min-h-14
        w-full
        items-center
        justify-center
        gap-3
        rounded-[14px]
        bg-linear-to-r
        from-[#56a900]
        to-[#247500]
        px-4
        py-3.5
        text-[15px]
        font-extrabold
        text-white
        shadow-[0_5px_15px_rgba(55,130,0,0.16)]
        transition
        hover:from-[#489500]
        hover:to-[#1c6300]
        active:scale-[0.99]
        focus-visible:outline-2
        focus-visible:outline-offset-4
        focus-visible:outline-[#65b900]
        disabled:cursor-not-allowed
        disabled:opacity-55
        disabled:shadow-none
        sm:text-base
      "
    >
      {loading ? (
        <LoaderCircle
          size={22}
          className="shrink-0 animate-spin"
          aria-hidden="true"
        />
      ) : (
        <ArrowRight
          size={21}
          className={
            isRtl
              ? "shrink-0 rotate-180"
              : "shrink-0"
          }
          aria-hidden="true"
        />
      )}

      <span>{children}</span>
    </button>
  );
}

/* ============================================================
   11. OTP INPUT

   One real input with six visual cells.

   Advantages:
   - supports full code paste
   - supports mobile numeric keyboard
   - supports email OTP autofill
   - preserves leading zeros
   - avoids six-input focus bugs
   - supports Arabic digits
   ============================================================ */

function OtpInput({
  value,
  label,
  disabled,
  invalid,
  onChange,
}: {
  value: string;
  label: string;
  disabled: boolean;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const inputRef =
    useRef<HTMLInputElement>(null);

  const [focused, setFocused] =
    useState(false);

  function handlePaste(
    event: ClipboardEvent<HTMLInputElement>
  ) {
    event.preventDefault();

    const pasted =
      event.clipboardData.getData("text");

    onChange(
      normalizeDigits(pasted)
    );
  }

  return (
    <div>
      <label
        htmlFor="reset-code"
        className="mb-3 block text-center text-sm font-semibold text-[#303b34]"
      >
        {label}
      </label>

      <div
        dir="ltr"
        className="relative mx-auto w-full max-w-97.5"
      >
        <input
          ref={inputRef}
          id="reset-code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={
            invalid
              ? "reset-error"
              : undefined
          }
          onChange={(event) => {
            onChange(
              normalizeDigits(
                event.target.value
              )
            );
          }}
          onPaste={handlePaste}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="
            absolute
            inset-0
            z-10
            h-full
            w-full
            cursor-text
            appearance-none
            border-0
            bg-transparent
            text-[16px]
            text-transparent
            caret-transparent
            outline-none
            selection:bg-transparent
            disabled:cursor-not-allowed
          "
        />

        <div
          aria-hidden="true"
          className="
            pointer-events-none
            grid
            grid-cols-6
            gap-1.5
            sm:gap-2.5
          "
        >
          {Array.from({
            length: CODE_LENGTH,
          }).map((_, index) => {
            const digit =
              value[index] ?? "";

            const active =
              focused &&
              !disabled &&
              (
                index === value.length ||
                (
                  value.length === CODE_LENGTH &&
                  index === CODE_LENGTH - 1
                )
              );

            return (
              <div
                key={index}
                className={`
                  grid
                  h-12
                  min-w-0
                  place-items-center
                  rounded-[11px]
                  border-2
                  bg-white
                  text-[24px]
                  font-extrabold
                  tabular-nums
                  text-[#172019]
                  transition
                  sm:h-14.5
                  sm:text-[29px]
                  ${
                    invalid
                      ? "border-red-300"
                      : active
                        ? "border-[#63b400] ring-4 ring-lime-100"
                        : digit
                          ? "border-[#a4ce78] bg-[#f8fcf3]"
                          : "border-[#d6ddd6]"
                  }
                  ${
                    disabled
                      ? "opacity-60"
                      : ""
                  }
                `}
              >
                {digit || (
                  <span className="text-[#d0d8ce]">
                    –
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   12. MAIN PAGE
   ============================================================ */

export default function ForgotPasswordPage() {
  const [locale, setLocale] =
    useState<Locale>(defaultLocale);

  const t =
    TRANSLATIONS[locale];

  const direction =
    getLocaleDirection(locale);

  const isRtl =
    direction === "rtl";

  /* --------------------------------------------------------
     Main workflow state
     -------------------------------------------------------- */

  const [step, setStep] =
    useState<Step>("EMAIL");

  const [email, setEmail] =
    useState("");

  const [challengeId, setChallengeId] =
    useState("");

  const [code, setCode] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [action, setAction] =
    useState<RequestAction | null>(null);

  const [error, setError] =
    useState<ErrorCode | null>(null);

  const [notice, setNotice] =
    useState(false);

  /* --------------------------------------------------------
     Actual server expiration times
     -------------------------------------------------------- */

  const [codeExpiresAt, setCodeExpiresAt] =
    useState(0);

  const [authorizationExpiresAt, setAuthorizationExpiresAt] =
    useState(0);

  const [resendUntil, setResendUntil] =
    useState(0);

  const [requestBlockedUntil, setRequestBlockedUntil] =
    useState(0);

  const [verifyBlockedUntil, setVerifyBlockedUntil] =
    useState(0);

  const [verificationLocked, setVerificationLocked] =
    useState(false);

  const [now, setNow] =
    useState(0);

  /* --------------------------------------------------------
     Request references
     -------------------------------------------------------- */

  const requestRef =
    useRef<AbortController | null>(null);

  const busyRef =
    useRef(false);

  const mountedRef =
    useRef(false);

  const redirectTimerRef =
    useRef<number | null>(null);

  const emailInputRef =
    useRef<HTMLInputElement>(null);

  const busy =
    action !== null;

  const resendRemaining =
    remainingSeconds(
      resendUntil,
      now
    );

  const requestBlockRemaining =
    remainingSeconds(
      requestBlockedUntil,
      now
    );

  const verifyBlockRemaining =
    remainingSeconds(
      verifyBlockedUntil,
      now
    );

  const codeRemaining =
    remainingSeconds(
      codeExpiresAt,
      now
    );

  const authorizationRemaining =
    remainingSeconds(
      authorizationExpiresAt,
      now
    );

  const codeExpired =
    step === "VERIFY" &&
    codeRemaining === 0;

  const authorizationExpired =
    step === "PASSWORD" &&
    authorizationRemaining === 0;

  const validPasswordLength =
    Array.from(password).length >=
    PASSWORD_MIN_LENGTH;

  const passwordsMatch =
    confirmPassword.length > 0 &&
    password === confirmPassword;

  /* ========================================================
     13. LANGUAGE EFFECT
     ======================================================== */

  useEffect(() => {
    const localeTimer = window.setTimeout(() => setLocale(getCurrentLocale()), 0);

    function onLanguageChange(
      event: Event
    ) {
      const detail =
        (event as CustomEvent<unknown>).detail;

      if (
        typeof detail === "string" &&
        isLocale(detail)
      ) {
        setLocale(detail);
      } else {
        setLocale(
          getCurrentLocale()
        );
      }
    }

    function onStorage(
      event: StorageEvent
    ) {
      if (
        event.key === LANGUAGE_STORAGE_KEY ||
        event.key === null
      ) {
        setLocale(
          getCurrentLocale()
        );
      }
    }

    const observer =
      new MutationObserver(() => {
        const htmlLocale =
          document.documentElement.lang
            .split("-")[0]
            .toLowerCase();

        if (isLocale(htmlLocale)) {
          setLocale(htmlLocale);
        }
      });

    observer.observe(
      document.documentElement,
      {
        attributes: true,
        attributeFilter: ["lang"],
      }
    );

    window.addEventListener(
      LANGUAGE_EVENT,
      onLanguageChange
    );

    window.addEventListener(
      "storage",
      onStorage
    );

    return () => {
      window.clearTimeout(localeTimer);
      observer.disconnect();

      window.removeEventListener(
        LANGUAGE_EVENT,
        onLanguageChange
      );

      window.removeEventListener(
        "storage",
        onStorage
      );
    };
  }, []);

  /* ========================================================
     14. COMPONENT LIFECYCLE
     ======================================================== */

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      requestRef.current?.abort();

      if (
        redirectTimerRef.current !== null
      ) {
        window.clearTimeout(
          redirectTimerRef.current
        );
      }
    };
  }, []);

  /* ========================================================
     15. REAL COUNTDOWN

     Date.now() is used instead of
     decrementing a local counter.

     Remains accurate when mobile
     browsers pause background tabs.
     ======================================================== */

  useEffect(() => {
    function updateTime() {
      setNow(Date.now());
    }

    updateTime();

    const interval =
      window.setInterval(
        updateTime,
        1000
      );

    document.addEventListener(
      "visibilitychange",
      updateTime
    );

    window.addEventListener(
      "focus",
      updateTime
    );

    return () => {
      window.clearInterval(interval);

      document.removeEventListener(
        "visibilitychange",
        updateTime
      );

      window.removeEventListener(
        "focus",
        updateTime
      );
    };
  }, []);

  /* ========================================================
     16. RESTART WORKFLOW
     ======================================================== */

  function restart(
    keepEmail = true
  ) {
    if (busyRef.current) {
      return;
    }

    requestRef.current?.abort();

    setStep("EMAIL");

    setChallengeId("");

    setCode("");

    setPassword("");

    setConfirmPassword("");

    setCodeExpiresAt(0);

    setAuthorizationExpiresAt(0);

    setVerifyBlockedUntil(0);

    setVerificationLocked(false);

    setError(null);

    setNotice(false);

    /*
     * Server request limits are not
     * bypassed when changing steps.
     */

    if (!keepEmail) {
      setEmail("");
      setResendUntil(0);
    }
  }

  /* ========================================================
     17. SHARED REQUEST EXECUTION

     Prevents simultaneous form requests.
     Does not store secrets in localStorage.
     ======================================================== */

  async function executeRequest(
    currentAction: RequestAction,
    callback: (
      controller: AbortController
    ) => Promise<void>
  ) {
    if (busyRef.current) {
      return;
    }

    busyRef.current = true;

    setAction(currentAction);

    setError(null);

    setNotice(false);

    requestRef.current?.abort();

    const controller =
      new AbortController();

    requestRef.current =
      controller;

    try {
      await callback(controller);

    } catch (caughtError) {
      if (!mountedRef.current) {
        return;
      }

      if (
        controller.signal.aborted &&
        !(
          caughtError instanceof
          PasswordRecoveryApiError
        )
      ) {
        return;
      }

      const apiError =
        caughtError instanceof
        PasswordRecoveryApiError
          ? caughtError
          : new PasswordRecoveryApiError(
              "INTERNAL_ERROR"
            );

      const errorCode =
        apiError.code;

      setError(errorCode);

      if (
        errorCode === "TOO_MANY_ATTEMPTS"
      ) {
        if (
          currentAction === "SEND" ||
          currentAction === "RESEND"
        ) {
          setRequestBlockedUntil(
            Date.now() +
              (
                apiError.retryAfter || 60
              ) * 1000
          );
        }

        if (currentAction === "VERIFY") {
          if (apiError.retryAfter > 0) {
            setVerifyBlockedUntil(
              Date.now() +
                apiError.retryAfter * 1000
            );
          } else {
            /*
             * The current code has exhausted
             * its allowed verification attempts.
             */
            setVerificationLocked(true);
          }
        }
      }

      if (
        errorCode === "CODE_EXPIRED"
      ) {
        setCodeExpiresAt(0);
      }

      if (
        errorCode === "INVALID_RESET_TOKEN" ||
        errorCode === "RESET_TOKEN_EXPIRED" ||
        errorCode === "RESET_NOT_AVAILABLE"
      ) {
        setAuthorizationExpiresAt(0);

        setPassword("");

        setConfirmPassword("");
      }

    } finally {
      if (
        requestRef.current === controller
      ) {
        requestRef.current = null;
      }

      busyRef.current = false;

      if (mountedRef.current) {
        setAction(null);
      }
    }
  }

  /* ========================================================
     18. STEP 1 — REQUEST EMAIL CODE

     POST /api/auth/forgot-password

     Payload:
     {
       email,
       locale
     }
     ======================================================== */

  async function requestCode(
    resend = false
  ) {
    if (
      busyRef.current ||
      Date.now() < requestBlockedUntil
    ) {
      return;
    }

    if (
      resend &&
      Date.now() < resendUntil
    ) {
      return;
    }

    const normalizedEmail =
      normalizeEmail(email);

    if (
      normalizedEmail.length === 0 ||
      normalizedEmail.length > 254 ||
      !EMAIL_PATTERN.test(normalizedEmail)
    ) {
      setError("INVALID_EMAIL");

      emailInputRef.current?.focus();

      return;
    }

    await executeRequest(
      resend
        ? "RESEND"
        : "SEND",

      async (controller) => {
        const data =
          await postJson<RequestCodeData>(
            API.request,
            {
              email: normalizedEmail,
              locale,
            },
            controller
          );

        if (
          !mountedRef.current ||
          controller.signal.aborted
        ) {
          return;
        }

        const expiration =
          parseExpiration(
            data?.expiresAt
          );

        if (
          !data ||
          typeof data.challengeId !== "string" ||
          !UUID_PATTERN.test(data.challengeId) ||
          data.nextStep !== "VERIFY_CODE" ||
          data.codeLength !== CODE_LENGTH ||
          expiration === 0
        ) {
          throw new PasswordRecoveryApiError(
            "INTERNAL_ERROR"
          );
        }

        const delay =
          typeof data.resendAfter === "number" &&
          Number.isFinite(data.resendAfter)
            ? Math.max(
                0,
                Math.min(
                  86_400,
                  data.resendAfter
                )
              )
            : 60;

        const isNewChallenge =
          data.challengeId !== challengeId;

        const timestamp =
          Date.now();

        setNow(timestamp);

        setEmail(normalizedEmail);

        setChallengeId(
          data.challengeId
        );

        setCodeExpiresAt(expiration);

        setResendUntil(
          timestamp + delay * 1000
        );

        setRequestBlockedUntil(0);

        if (isNewChallenge) {
          setVerificationLocked(false);

          setVerifyBlockedUntil(0);
        }

        setAuthorizationExpiresAt(0);

        setCode("");

        setPassword("");

        setConfirmPassword("");

        setStep("VERIFY");

        setNotice(resend);
      }
    );
  }

  function handleEmailSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    void requestCode(false);
  }

  /* ========================================================
     19. STEP 2 — VERIFY SIX-DIGIT CODE

     POST /api/auth/verify-reset-code

     Payload:
     {
       email,
       challengeId,
       code
     }

     The API sets the temporary
     taym_password_reset HttpOnly cookie.
     ======================================================== */

  async function handleVerifySubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      busyRef.current ||
      verificationLocked ||
      Date.now() < verifyBlockedUntil
    ) {
      return;
    }

    if (
      !UUID_PATTERN.test(challengeId)
    ) {
      setError("INVALID_INPUT");

      return;
    }

    if (
      Date.now() >= codeExpiresAt
    ) {
      setError("CODE_EXPIRED");

      return;
    }

    const normalizedCode =
      normalizeDigits(code);

    if (
      !/^\d{6}$/.test(normalizedCode)
    ) {
      setError("INVALID_CODE");

      return;
    }

    await executeRequest(
      "VERIFY",

      async (controller) => {
        const data =
          await postJson<VerifyCodeData>(
            API.verify,
            {
              email,
              challengeId,
              code: normalizedCode,
            },
            controller
          );

        if (
          !mountedRef.current ||
          controller.signal.aborted
        ) {
          return;
        }

        const expiration =
          parseExpiration(
            data?.expiresAt
          );

        if (
          !data ||
          data.verified !== true ||
          data.canResetPassword !== true ||
          data.challengeId !== challengeId ||
          data.nextStep !== "NEW_PASSWORD" ||
          expiration <= Date.now()
        ) {
          throw new PasswordRecoveryApiError(
            "INVALID_RESET_TOKEN"
          );
        }

        setNow(Date.now());

        setAuthorizationExpiresAt(
          expiration
        );

        setCode("");

        setPassword("");

        setConfirmPassword("");

        setStep("PASSWORD");
      }
    );
  }

  /* ========================================================
     20. STEP 3 — SAVE NEW PASSWORD

     POST /api/auth/reset-password

     Payload:
     {
       challengeId,
       password,
       confirmPassword
     }

     Reset token comes from the secure
     HttpOnly cookie automatically.

     On success:
     - PostgreSQL password updated
     - old sessions revoked
     - new session cookie installed
     - redirect to /dashboard
     ======================================================== */

  async function handlePasswordSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (busyRef.current) {
      return;
    }

    if (
      Date.now() >=
      authorizationExpiresAt
    ) {
      setError(
        "RESET_TOKEN_EXPIRED"
      );

      return;
    }

    if (
      Array.from(password).length <
      PASSWORD_MIN_LENGTH
    ) {
      setError(
        "PASSWORD_TOO_SHORT"
      );

      return;
    }

    const encoder =
      new TextEncoder();

    if (
      encoder.encode(password).byteLength >
        PASSWORD_MAX_BYTES ||

      encoder.encode(confirmPassword).byteLength >
        PASSWORD_MAX_BYTES
    ) {
      setError(
        "PASSWORD_TOO_LONG"
      );

      return;
    }

    if (
      password !== confirmPassword
    ) {
      setError(
        "PASSWORD_MISMATCH"
      );

      return;
    }

    await executeRequest(
      "RESET",

      async (controller) => {
        const data =
          await postJson<ResetPasswordData>(
            API.reset,
            {
              challengeId,
              password,
              confirmPassword,
            },
            controller
          );

        if (
          !mountedRef.current ||
          controller.signal.aborted
        ) {
          return;
        }

        if (
          !data ||
          data.passwordUpdated !== true ||
          data.session?.authenticated !== true
        ) {
          throw new PasswordRecoveryApiError(
            "INTERNAL_ERROR"
          );
        }

        setPassword("");

        setConfirmPassword("");

        setChallengeId("");

        setCode("");

        setAuthorizationExpiresAt(0);

        setStep("SUCCESS");

        /*
         * Fixed destination.
         * No arbitrary external redirects.
         */

        redirectTimerRef.current =
          window.setTimeout(() => {
            window.location.replace(
              DASHBOARD_PATH
            );
          }, 1000);
      }
    );
  }

  /* ========================================================
     21. USER INTERFACE HELPERS
     ======================================================== */

  function clearError() {
    setError(null);
    setNotice(false);
  }

  const pageTitle =
    step === "EMAIL"
      ? t.emailTitle
      : step === "VERIFY"
        ? t.codeTitle
        : step === "PASSWORD"
          ? t.passwordTitle
          : t.successTitle;

  const pageDescription =
    step === "EMAIL"
      ? t.emailDescription
      : step === "VERIFY"
        ? t.codeDescription
        : step === "PASSWORD"
          ? t.passwordDescription
          : t.successDescription;

  const StepIcon =
    step === "EMAIL"
      ? Mail
      : step === "VERIFY"
        ? ShieldCheck
        : step === "PASSWORD"
          ? LockKeyhole
          : CheckCircle2;

  const resendDisabled =
    busy ||
    resendRemaining > 0 ||
    requestBlockRemaining > 0;

  const resendCountdown =
    Math.max(
      resendRemaining,
      requestBlockRemaining
    );

  /* ========================================================
     22. RESPONSIVE PAGE

     Existing auth layout renders:
     - Header
     - MobileNav
     - LanguageSwitcher

     This page only renders recovery content.
     ======================================================== */

  return (
    <main
      lang={locale}
      dir={direction}
      className="
        min-h-0
        w-full
        bg-[#f5f7f4]
        px-4
        pb-24
        pt-7
        text-[#172019]
        sm:px-6
        sm:pb-16
        sm:pt-12
        lg:px-8
      "
    >
      <div className="mx-auto w-full max-w-none">

        {/* ================================================
            MAIN WHITE CARD
            ================================================ */}

        <section
          aria-labelledby="recovery-title"
          className="
            w-full
            overflow-hidden
            rounded-[22px]
            border
            border-[#e1e6df]
            bg-white
            px-5
            py-4
            shadow-[0_8px_35px_rgba(15,30,20,0.06)]
            sm:rounded-[26px]
            sm:px-9
            sm:py-6
          "
        >

          {/* ORIGINAL LOGO */}

          <div className="mb-6 flex justify-center">
            <Image
              src="/logo/logo.jpg"
              alt="Fahrschule TAYM"
              width={230}
              height={100}
              priority
              className="
                h-auto
                w-45
                max-w-full
                object-contain
                sm:w-53.75
              "
            />
          </div>

          {/* THREE-STEP PROGRESS */}

          {step !== "SUCCESS" && (
            <StepIndicator
              step={step}
              t={t}
            />
          )}

          {/* CURRENT STEP ICON AND TITLE */}

          <div className="mb-7 text-center">
            <div
              className={`
                mx-auto
                mb-4
                grid
                h-16.5
                w-16.5
                place-items-center
                rounded-[20px]
                ${
                  step === "SUCCESS"
                    ? "bg-green-100 text-green-700"
                    : "bg-[#eff8e6] text-[#438900]"
                }
              `}
            >
              <StepIcon
                size={32}
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </div>

            <h1
              id="recovery-title"
              className="
                text-[27px]
                font-black
                leading-tight
                tracking-tight
                text-[#101710]
                sm:text-[32px]
              "
            >
              {pageTitle}
            </h1>

            <p
              className="
                mx-auto
                mt-3
                max-w-95
                text-[14px]
                leading-6
                text-[#626d64]
                sm:text-[15px]
              "
            >
              {pageDescription}
            </p>
          </div>

          {/* ==============================================
              SERVER ERROR
              ============================================== */}

          {error && (
            <div
              id="reset-error"
              role="alert"
              className="
                mb-5
                flex
                items-start
                gap-3
                rounded-xl
                border
                border-red-200
                bg-red-50
                p-3.5
                text-sm
                leading-6
                text-red-700
              "
            >
              <CircleAlert
                size={21}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />

              <div className="min-w-0">
                <p>
                  {t.errors[error]}
                </p>

                {error === "TOO_MANY_ATTEMPTS" &&
                  Math.max(
                    requestBlockRemaining,
                    verifyBlockRemaining
                  ) > 0 && (
                    <p
                      dir="ltr"
                      className="mt-2 font-bold tabular-nums"
                    >
                      {formatCountdown(
                        Math.max(
                          requestBlockRemaining,
                          verifyBlockRemaining
                        )
                      )}
                    </p>
                  )}
              </div>
            </div>
          )}

          {/* ==============================================
              RESEND INFORMATION

              Does not falsely guarantee
              actual email inbox delivery.
              ============================================== */}

          {notice && (
            <div
              role="status"
              className="
                mb-5
                flex
                items-start
                gap-2.5
                rounded-xl
                border
                border-green-200
                bg-green-50
                p-3.5
                text-sm
                leading-6
                text-green-800
              "
            >
              <CheckCircle2
                size={20}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />

              <p>
                {t.resendNotice}
              </p>
            </div>
          )}

          {/* ==============================================
              STEP 1 — EMAIL ADDRESS
              ============================================== */}

          {step === "EMAIL" && (
            <form
              onSubmit={
                handleEmailSubmit
              }
              noValidate
              aria-busy={busy}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-[#303b34]"
                >
                  {t.emailLabel}
                </label>

                <div className="relative">
                  <Mail
                    size={22}
                    strokeWidth={1.8}
                    aria-hidden="true"
                    className="
                      pointer-events-none
                      absolute
                      inset-s-4
                      top-1/2
                      -translate-y-1/2
                      text-[#69736c]
                    "
                  />

                  <input
                    ref={emailInputRef}
                    id="email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={254}
                    dir="ltr"
                    required
                    value={email}
                    disabled={busy}
                    aria-invalid={
                      error === "INVALID_EMAIL"
                    }
                    aria-describedby={
                      error
                        ? "reset-error"
                        : undefined
                    }
                    placeholder={
                      t.emailPlaceholder
                    }
                    onChange={(event) => {
                      setEmail(
                        event.target.value
                      );

                      clearError();
                    }}
                    className={`
                      h-14
                      w-full
                      rounded-[13px]
                      border
                      bg-white
                      px-12
                      text-[16px]
                      text-[#172019]
                      outline-none
                      transition
                      placeholder:text-[#899189]
                      focus:border-[#65b900]
                      focus:ring-4
                      focus:ring-lime-100
                      disabled:opacity-60
                      ${
                        error === "INVALID_EMAIL"
                          ? "border-red-400"
                          : "border-[#d6ddd6]"
                      }
                    `}
                  />
                </div>
              </div>

              <PrimaryButton
                loading={
                  action === "SEND"
                }
                disabled={
                  busy ||
                  requestBlockRemaining > 0
                }
                isRtl={isRtl}
              >
                {action === "SEND"
                  ? t.sendingCode
                  : requestBlockRemaining > 0
                    ? `${t.resendIn} ${formatCountdown(requestBlockRemaining)}`
                    : t.sendCode}
              </PrimaryButton>
            </form>
          )}

          {/* ==============================================
              STEP 2 — EMAIL VERIFICATION
              ============================================== */}

          {step === "VERIFY" && (
            <form
              onSubmit={
                handleVerifySubmit
              }
              noValidate
              aria-busy={busy}
              className="space-y-4"
            >
              {/* Email being verified */}

              <div className="flex flex-col items-center gap-2 rounded-xl border border-[#e3eadf] bg-[#f7faf5] px-3 py-3">
                <div
                  dir="ltr"
                  className="flex max-w-full items-center gap-2 text-sm font-bold text-[#344638]"
                >
                  <Mail
                    size={17}
                    className="shrink-0 text-green-700"
                    aria-hidden="true"
                  />

                  <span className="break-all">
                    {email}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    restart(false)
                  }
                  className="
                    min-h-8
                    text-xs
                    font-bold
                    text-[#347b00]
                    hover:underline
                    disabled:opacity-50
                  "
                >
                  {t.changeEmail}
                </button>
              </div>

              {/* OTP six digits */}

              <OtpInput
                value={code}
                label={t.codeLabel}
                disabled={
                  busy ||
                  codeExpired ||
                  verificationLocked ||
                  verifyBlockRemaining > 0
                }
                invalid={
                  error === "INVALID_CODE"
                }
                onChange={(value) => {
                  setCode(value);
                  clearError();
                }}
              />

              {/* Server expiration countdown */}

              <div
                className={`
                  flex
                  items-center
                  justify-center
                  gap-2
                  text-center
                  text-xs
                  font-semibold
                  sm:text-sm
                  ${
                    codeExpired
                      ? "text-red-700"
                      : "text-[#68746b]"
                  }
                `}
              >
                <Clock3
                  size={16}
                  className="shrink-0"
                  aria-hidden="true"
                />

                {codeExpired ? (
                  <span>
                    {t.codeExpired}
                  </span>
                ) : (
                  <>
                    <span>
                      {t.codeExpiresIn}
                    </span>

                    <span
                      dir="ltr"
                      className="font-bold tabular-nums text-[#347b00]"
                    >
                      {formatCountdown(
                        codeRemaining
                      )}
                    </span>
                  </>
                )}
              </div>

              {/* Verify code */}

              <PrimaryButton
                loading={
                  action === "VERIFY"
                }
                disabled={
                  busy ||
                  code.length !== CODE_LENGTH ||
                  codeExpired ||
                  verificationLocked ||
                  verifyBlockRemaining > 0
                }
                isRtl={isRtl}
              >
                {action === "VERIFY"
                  ? t.verifyingCode
                  : t.verifyCode}
              </PrimaryButton>

              {/* Resend code */}

              <div className="text-center">
                <button
                  type="button"
                  disabled={resendDisabled}
                  onClick={() => {
                    void requestCode(true);
                  }}
                  className="
                    inline-flex
                    min-h-11
                    items-center
                    justify-center
                    gap-2
                    rounded-lg
                    px-3
                    py-2
                    text-sm
                    font-bold
                    text-[#347b00]
                    transition
                    hover:bg-lime-50
                    disabled:cursor-not-allowed
                    disabled:text-[#909b90]
                  "
                >
                  {action === "RESEND" ? (
                    <LoaderCircle
                      size={17}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <RefreshCw
                      size={17}
                      aria-hidden="true"
                    />
                  )}

                  {action === "RESEND" ? (
                    t.resendingCode
                  ) : resendCountdown > 0 ? (
                    <>
                      <span>
                        {t.resendIn}
                      </span>

                      <span
                        dir="ltr"
                        className="tabular-nums"
                      >
                        {formatCountdown(
                          resendCountdown
                        )}
                      </span>
                    </>
                  ) : (
                    t.resendCode
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ==============================================
              STEP 3 — NEW PASSWORD
              ============================================== */}

          {step === "PASSWORD" && (
            <form
              onSubmit={
                handlePasswordSubmit
              }
              noValidate
              aria-busy={busy}
              className="space-y-4"
            >
              <div
                className={`
                  flex
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  border
                  px-3
                  py-3
                  text-center
                  text-xs
                  font-semibold
                  ${
                    authorizationExpired
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-green-200 bg-green-50 text-green-800"
                  }
                `}
              >
                <ShieldCheck
                  size={18}
                  className="shrink-0"
                  aria-hidden="true"
                />

                {authorizationExpired ? (
                  <span>
                    {
                      t.errors.RESET_TOKEN_EXPIRED
                    }
                  </span>
                ) : (
                  <>
                    <span>
                      {
                        t.authorizationExpiresIn
                      }
                    </span>

                    <span
                      dir="ltr"
                      className="font-bold tabular-nums"
                    >
                      {formatCountdown(
                        authorizationRemaining
                      )}
                    </span>
                  </>
                )}
              </div>

              <PasswordField
                id="new-password"
                label={t.passwordLabel}
                placeholder={
                  t.passwordPlaceholder
                }
                value={password}
                disabled={
                  busy ||
                  authorizationExpired
                }
                showLabel={t.showPassword}
                hideLabel={t.hidePassword}
                onChange={(value) => {
                  setPassword(value);
                  clearError();
                }}
              />

              <PasswordField
                id="confirm-password"
                label={t.confirmLabel}
                placeholder={
                  t.confirmPlaceholder
                }
                value={confirmPassword}
                disabled={
                  busy ||
                  authorizationExpired
                }
                showLabel={t.showPassword}
                hideLabel={t.hidePassword}
                onChange={(value) => {
                  setConfirmPassword(value);
                  clearError();
                }}
              />

              {/* Real password requirements */}

              <div className="space-y-2 rounded-xl bg-[#f7faf5] px-3 py-3">
                <div className="flex items-center gap-2">
                  {validPasswordLength ? (
                    <CheckCircle2
                      size={17}
                      className="shrink-0 text-green-700"
                      aria-hidden="true"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="h-4.25 w-4.25 shrink-0 rounded-full border border-[#b5bfb3]"
                    />
                  )}

                  <span
                    className={`
                      text-xs
                      leading-5
                      ${
                        validPasswordLength
                          ? "font-semibold text-green-700"
                          : "text-[#69746a]"
                      }
                    `}
                  >
                    {t.passwordLength}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {passwordsMatch ? (
                    <CheckCircle2
                      size={17}
                      className="shrink-0 text-green-700"
                      aria-hidden="true"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="h-4.25 w-4.25 shrink-0 rounded-full border border-[#b5bfb3]"
                    />
                  )}

                  <span
                    className={`
                      text-xs
                      leading-5
                      ${
                        passwordsMatch
                          ? "font-semibold text-green-700"
                          : "text-[#69746a]"
                      }
                    `}
                  >
                    {t.passwordMatch}
                  </span>
                </div>
              </div>

              {!authorizationExpired ? (
                <PrimaryButton
                  loading={
                    action === "RESET"
                  }
                  disabled={
                    busy ||
                    !validPasswordLength ||
                    !passwordsMatch
                  }
                  isRtl={isRtl}
                >
                  {action === "RESET"
                    ? t.resettingPassword
                    : t.resetPassword}
                </PrimaryButton>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    restart(true)
                  }
                  className="
                    flex
                    min-h-14
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-[14px]
                    bg-[#347b00]
                    px-4
                    py-3
                    text-sm
                    font-bold
                    text-white
                    hover:bg-[#286400]
                    disabled:opacity-50
                  "
                >
                  <RefreshCw
                    size={19}
                    aria-hidden="true"
                  />

                  {t.restart}
                </button>
              )}
            </form>
          )}

          {/* ==============================================
              SUCCESS — AUTOMATIC AUTHENTICATION
              ============================================== */}

          {step === "SUCCESS" && (
            <div className="space-y-4">
              <div
                role="status"
                className="
                  flex
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-green-200
                  bg-green-50
                  p-5
                  text-green-700
                "
              >
                <LoaderCircle
                  size={28}
                  className="animate-spin"
                  aria-hidden="true"
                />
              </div>

              <Link
                href={DASHBOARD_PATH}
                className="
                  flex
                  min-h-14
                  w-full
                  items-center
                  justify-center
                  gap-3
                  rounded-[14px]
                  bg-linear-to-r
                  from-[#56a900]
                  to-[#247500]
                  px-4
                  py-3.5
                  text-sm
                  font-extrabold
                  text-white
                  hover:from-[#489500]
                  hover:to-[#1c6300]
                "
              >
                {t.dashboard}

                <ArrowRight
                  size={20}
                  className={
                    isRtl
                      ? "rotate-180"
                      : ""
                  }
                  aria-hidden="true"
                />
              </Link>
            </div>
          )}

          {/* ==============================================
              RETURN TO EXISTING LOGIN PAGE
              ============================================== */}

          {step !== "SUCCESS" && (
            <div className="mt-7 border-t border-[#e7ebe5] pt-5">
              <Link
                href={LOGIN_PATH}
                className="
                  flex
                  min-h-10
                  items-center
                  justify-center
                  gap-2
                  text-sm
                  font-bold
                  text-[#347b00]
                  transition
                  hover:text-[#205700]
                  hover:underline
                "
              >
                <ArrowLeft
                  size={18}
                  className={
                    isRtl
                      ? "rotate-180"
                      : ""
                  }
                  aria-hidden="true"
                />

                {t.backToLogin}
              </Link>
            </div>
          )}
        </section>

        {/* SECURITY INFORMATION */}

        <div className="mt-5 flex items-center justify-center gap-2 px-2 text-center">
          <ShieldCheck
            size={18}
            strokeWidth={1.9}
            className="shrink-0 text-[#488a15]"
            aria-hidden="true"
          />

          <p className="text-xs font-medium leading-5 text-[#68746b]">
            {t.secure}
          </p>
        </div>
      </div>
    </main>
  );
}
