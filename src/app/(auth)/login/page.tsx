
"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import Image from "next/image";
import Link from "next/link";

import {
  UserRound,
  LockKeyhole,
  Eye,
  EyeOff,
  LogIn,
  LoaderCircle,
  CircleAlert,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

import {
  defaultLocale,
  isLocale,
  getLocaleDirection,
  type Locale,
} from "@/i18n/config";

/* ============================================================
   FAHRSCHULE TAYM

   PAGE DE CONNEXION
   src/app/(auth)/login/page.tsx

   - Next.js App Router
   - TypeScript
   - Tailwind CSS
   - PostgreSQL Authentication
   - Responsive PC / Mobile
   - German / Arabic / Turkish / Spanish

   API:
   POST /api/auth/login

   Navigation:
   Existing Header and MobileNav

   No new layout.
   No decorative image.
   No additional CSS file.
   ============================================================ */

/* ============================================================
   1. CONFIGURATION
   ============================================================ */

const LOGIN_API = "/api/auth/login";

const DASHBOARD_PATH = "/dashboard";

const REGISTER_PATH = "/register";

const FORGOT_PASSWORD_PATH = "/forgot-password";

const LANGUAGE_STORAGE_KEY = "taym-locale";

const LANGUAGE_EVENT = "taym:language-change";

const REQUEST_TIMEOUT_MS = 30_000;

/* ============================================================
   2. API TYPES
   ============================================================ */

type LoginErrorCode =
  | "INVALID_INPUT"
  | "INVALID_JSON"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_UNAVAILABLE"
  | "FORBIDDEN_ORIGIN"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "TOO_MANY_ATTEMPTS"
  | "DATABASE_UNAVAILABLE"
  | "INTERNAL_ERROR"
  | "NETWORK_ERROR"
  | "TIMEOUT";

type LoginSuccessResponse = {
  success: true;

  data: {
    user: {
      id: string;
      firstName: string;
      lastName: string;
      fullName: string;
      email: string;
      phoneE164: string;
      countryCode: string;
      role: string;
      status: string;
      emailVerified: boolean;
      phoneVerified: boolean;
    };

    session: {
      authenticated: boolean;
      expiresAt: string;
      rememberMe: boolean;
    };

    redirectTo: string;
  };
};

type LoginErrorResponse = {
  success: false;

  error: {
    code: string;
    message?: string;
    retryAfter?: number;
  };
};

type LoginApiResponse =
  | LoginSuccessResponse
  | LoginErrorResponse;

/* ============================================================
   3. TRANSLATION TYPES
   ============================================================ */

type LoginTranslations = {
  title: string;
  subtitle: string;

  identifier: string;
  identifierPlaceholder: string;
  identifierHelp: string;

  password: string;
  passwordPlaceholder: string;

  showPassword: string;
  hidePassword: string;

  rememberMe: string;
  forgotPassword: string;

  login: string;
  loggingIn: string;

  noAccount: string;
  register: string;

  secureConnection: string;
  loginSuccess: string;
  redirecting: string;

  identifierRequired: string;
  identifierInvalid: string;
  passwordRequired: string;
  passwordTooLong: string;

  retryIn: string;
  minutes: string;
  seconds: string;

  errors: Record<LoginErrorCode, string>;
};

/* ============================================================
   4. MULTILINGUAL CONTENT

   DE — German (default)
   AR — Arabic (RTL)
   TR — Turkish
   ES — Spanish

   Uses the existing website language.
   No additional language switcher.
   ============================================================ */

const TRANSLATIONS: Record<
  Locale,
  LoginTranslations
> = {
  /* ========================================================
     GERMAN
     ======================================================== */

  de: {
    title: "Anmeldung",

    subtitle:
      "Melden Sie sich in Ihrem Konto an.",

    identifier:
      "E-Mail oder Telefonnummer",

    identifierPlaceholder:
      "E-Mail oder Telefonnummer",

    identifierHelp:
      "Telefonnummer mit internationaler Vorwahl eingeben.",

    password: "Passwort",

    passwordPlaceholder:
      "Passwort eingeben",

    showPassword:
      "Passwort anzeigen",

    hidePassword:
      "Passwort verbergen",

    rememberMe:
      "Angemeldet bleiben",

    forgotPassword:
      "Passwort vergessen?",

    login: "Anmelden",

    loggingIn:
      "Anmeldung läuft...",

    noAccount:
      "Noch kein Konto?",

    register:
      "Jetzt registrieren",

    secureConnection:
      "Sichere Anmeldung und geschützte Daten",

    loginSuccess:
      "Anmeldung erfolgreich.",

    redirecting:
      "Sie werden zu Ihrem Dashboard weitergeleitet.",

    identifierRequired:
      "Bitte geben Sie Ihre E-Mail-Adresse oder Telefonnummer ein.",

    identifierInvalid:
      "Bitte geben Sie eine gültige E-Mail-Adresse oder internationale Telefonnummer ein.",

    passwordRequired:
      "Bitte geben Sie Ihr Passwort ein.",

    passwordTooLong:
      "Das eingegebene Passwort ist zu lang.",

    retryIn:
      "Erneut versuchen in",

    minutes: "Min.",

    seconds: "Sek.",

    errors: {
      INVALID_INPUT:
        "Bitte überprüfen Sie Ihre Anmeldedaten.",

      INVALID_JSON:
        "Die Anfrage konnte nicht verarbeitet werden.",

      INVALID_CREDENTIALS:
        "E-Mail-Adresse, Telefonnummer oder Passwort ist falsch.",

      ACCOUNT_UNAVAILABLE:
        "Ihr Konto ist derzeit nicht verfügbar. Bitte wenden Sie sich an den Support.",

      FORBIDDEN_ORIGIN:
        "Diese Anfrage ist nicht erlaubt.",

      UNSUPPORTED_MEDIA_TYPE:
        "Die Anfrage konnte nicht verarbeitet werden.",

      PAYLOAD_TOO_LARGE:
        "Die eingegebenen Daten sind zu lang.",

      TOO_MANY_ATTEMPTS:
        "Zu viele Anmeldeversuche. Bitte versuchen Sie es später erneut.",

      DATABASE_UNAVAILABLE:
        "Der Anmeldedienst ist vorübergehend nicht verfügbar.",

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
    title: "تسجيل الدخول",

    subtitle:
      "سجل الدخول إلى حسابك.",

    identifier:
      "البريد الإلكتروني أو رقم الهاتف",

    identifierPlaceholder:
      "البريد الإلكتروني أو رقم الهاتف",

    identifierHelp:
      "أدخل رقم الهاتف مع رمز الدولة الدولي.",

    password:
      "كلمة المرور",

    passwordPlaceholder:
      "أدخل كلمة المرور",

    showPassword:
      "إظهار كلمة المرور",

    hidePassword:
      "إخفاء كلمة المرور",

    rememberMe:
      "البقاء متصلاً",

    forgotPassword:
      "نسيت كلمة المرور؟",

    login:
      "تسجيل الدخول",

    loggingIn:
      "جارٍ تسجيل الدخول...",

    noAccount:
      "ليس لديك حساب؟",

    register:
      "سجل الآن",

    secureConnection:
      "تسجيل دخول آمن وبيانات محمية",

    loginSuccess:
      "تم تسجيل الدخول بنجاح.",

    redirecting:
      "سيتم توجيهك إلى لوحة التحكم الخاصة بك.",

    identifierRequired:
      "يرجى إدخال البريد الإلكتروني أو رقم الهاتف.",

    identifierInvalid:
      "يرجى إدخال بريد إلكتروني أو رقم هاتف دولي صالح.",

    passwordRequired:
      "يرجى إدخال كلمة المرور.",

    passwordTooLong:
      "كلمة المرور المدخلة طويلة جداً.",

    retryIn:
      "حاول مرة أخرى بعد",

    minutes: "دقيقة",

    seconds: "ثانية",

    errors: {
      INVALID_INPUT:
        "يرجى التحقق من بيانات تسجيل الدخول.",

      INVALID_JSON:
        "تعذر معالجة الطلب.",

      INVALID_CREDENTIALS:
        "البريد الإلكتروني أو رقم الهاتف أو كلمة المرور غير صحيحة.",

      ACCOUNT_UNAVAILABLE:
        "حسابك غير متاح حالياً. يرجى التواصل مع الدعم.",

      FORBIDDEN_ORIGIN:
        "هذا الطلب غير مسموح به.",

      UNSUPPORTED_MEDIA_TYPE:
        "تعذر معالجة الطلب.",

      PAYLOAD_TOO_LARGE:
        "البيانات المدخلة طويلة جداً.",

      TOO_MANY_ATTEMPTS:
        "عدد محاولات تسجيل الدخول كبير جداً. حاول لاحقاً.",

      DATABASE_UNAVAILABLE:
        "خدمة تسجيل الدخول غير متاحة مؤقتاً.",

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
    title:
      "Giriş Yap",

    subtitle:
      "Hesabınıza giriş yapın.",

    identifier:
      "E-posta veya telefon numarası",

    identifierPlaceholder:
      "E-posta veya telefon numarası",

    identifierHelp:
      "Telefon numaranızı uluslararası ülke koduyla girin.",

    password:
      "Şifre",

    passwordPlaceholder:
      "Şifrenizi girin",

    showPassword:
      "Şifreyi göster",

    hidePassword:
      "Şifreyi gizle",

    rememberMe:
      "Beni hatırla",

    forgotPassword:
      "Şifremi unuttum?",

    login:
      "Giriş yap",

    loggingIn:
      "Giriş yapılıyor...",

    noAccount:
      "Hesabınız yok mu?",

    register:
      "Şimdi kayıt olun",

    secureConnection:
      "Güvenli giriş ve korunan veriler",

    loginSuccess:
      "Giriş başarılı.",

    redirecting:
      "Kontrol panelinize yönlendiriliyorsunuz.",

    identifierRequired:
      "Lütfen e-posta adresinizi veya telefon numaranızı girin.",

    identifierInvalid:
      "Geçerli bir e-posta veya uluslararası telefon numarası girin.",

    passwordRequired:
      "Lütfen şifrenizi girin.",

    passwordTooLong:
      "Girilen şifre çok uzun.",

    retryIn:
      "Tekrar deneyin:",

    minutes: "dk.",

    seconds: "sn.",

    errors: {
      INVALID_INPUT:
        "Lütfen giriş bilgilerinizi kontrol edin.",

      INVALID_JSON:
        "İstek işlenemedi.",

      INVALID_CREDENTIALS:
        "E-posta, telefon numarası veya şifre yanlış.",

      ACCOUNT_UNAVAILABLE:
        "Hesabınız şu anda kullanılamıyor. Lütfen destek ile iletişime geçin.",

      FORBIDDEN_ORIGIN:
        "Bu isteğe izin verilmiyor.",

      UNSUPPORTED_MEDIA_TYPE:
        "İstek işlenemedi.",

      PAYLOAD_TOO_LARGE:
        "Girilen bilgiler çok uzun.",

      TOO_MANY_ATTEMPTS:
        "Çok fazla giriş denemesi. Lütfen daha sonra tekrar deneyin.",

      DATABASE_UNAVAILABLE:
        "Giriş hizmeti geçici olarak kullanılamıyor.",

      INTERNAL_ERROR:
        "Bir hata oluştu. Lütfen tekrar deneyin.",

      NETWORK_ERROR:
        "Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.",

      TIMEOUT:
        "İstek zaman aşımına uğradı. Lütfen tekrar deneyin.",
    },
  },

  /* ========================================================
     SPANISH
     ======================================================== */

  es: {
    title:
      "Iniciar sesión",

    subtitle:
      "Acceda a su cuenta.",

    identifier:
      "Correo electrónico o teléfono",

    identifierPlaceholder:
      "Correo electrónico o teléfono",

    identifierHelp:
      "Introduzca el teléfono con el prefijo internacional.",

    password:
      "Contraseña",

    passwordPlaceholder:
      "Introduzca su contraseña",

    showPassword:
      "Mostrar contraseña",

    hidePassword:
      "Ocultar contraseña",

    rememberMe:
      "Mantener sesión iniciada",

    forgotPassword:
      "¿Olvidó su contraseña?",

    login:
      "Iniciar sesión",

    loggingIn:
      "Iniciando sesión...",

    noAccount:
      "¿Todavía no tiene una cuenta?",

    register:
      "Regístrese ahora",

    secureConnection:
      "Acceso seguro y datos protegidos",

    loginSuccess:
      "Inicio de sesión correcto.",

    redirecting:
      "Será redirigido a su panel de control.",

    identifierRequired:
      "Introduzca su correo electrónico o teléfono.",

    identifierInvalid:
      "Introduzca un correo electrónico o teléfono internacional válido.",

    passwordRequired:
      "Introduzca su contraseña.",

    passwordTooLong:
      "La contraseña introducida es demasiado larga.",

    retryIn:
      "Volver a intentar en",

    minutes: "min.",

    seconds: "seg.",

    errors: {
      INVALID_INPUT:
        "Compruebe sus datos de acceso.",

      INVALID_JSON:
        "No se pudo procesar la solicitud.",

      INVALID_CREDENTIALS:
        "El correo electrónico, teléfono o contraseña son incorrectos.",

      ACCOUNT_UNAVAILABLE:
        "Su cuenta no está disponible. Póngase en contacto con el soporte.",

      FORBIDDEN_ORIGIN:
        "Esta solicitud no está permitida.",

      UNSUPPORTED_MEDIA_TYPE:
        "No se pudo procesar la solicitud.",

      PAYLOAD_TOO_LARGE:
        "Los datos introducidos son demasiado largos.",

      TOO_MANY_ATTEMPTS:
        "Demasiados intentos. Inténtelo más tarde.",

      DATABASE_UNAVAILABLE:
        "El servicio de acceso no está disponible temporalmente.",

      INTERNAL_ERROR:
        "Ha ocurrido un error. Inténtelo de nuevo.",

      NETWORK_ERROR:
        "No se pudo conectar al servidor. Compruebe su conexión a Internet.",

      TIMEOUT:
        "La solicitud ha tardado demasiado. Inténtelo de nuevo.",
    },
  },
};

/* ============================================================
   5. EXISTING WEBSITE LANGUAGE

   Detects:
   - HTML language
   - Existing language cookie
   - Existing localStorage value
   - Existing language-change event
   ============================================================ */

function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${name}=`;

  const cookie = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));

  if (!cookie) {
    return null;
  }

  try {
    return decodeURIComponent(
      cookie.slice(prefix.length)
    );
  } catch {
    return null;
  }
}

function getCurrentLocale(): Locale {
  if (typeof window === "undefined") {
    return defaultLocale;
  }

  const cookieLocale =
    readCookie(LANGUAGE_STORAGE_KEY);

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

  if (isLocale(htmlLocale)) {
    return htmlLocale;
  }

  return defaultLocale;
}

/* ============================================================
   6. INPUT VALIDATION
   ============================================================ */

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PHONE_PATTERN =
  /^\+[1-9]\d{7,14}$/;

function normalizeIdentifier(
  value: string
): string {
  let identifier =
    value.trim();

  if (identifier.includes("@")) {
    return identifier.toLowerCase();
  }

  identifier =
    identifier.replace(
      /[\s().-]/g,
      ""
    );

  if (identifier.startsWith("00")) {
    identifier =
      `+${identifier.slice(2)}`;
  }

  return identifier;
}

function isValidIdentifier(
  identifier: string
): boolean {
  if (
    identifier.length === 0 ||
    identifier.length > 254
  ) {
    return false;
  }

  return identifier.includes("@")
    ? EMAIL_PATTERN.test(identifier)
    : PHONE_PATTERN.test(identifier);
}

function getKnownErrorCode(
  value: unknown
): LoginErrorCode {
  const validCodes: LoginErrorCode[] = [
    "INVALID_INPUT",
    "INVALID_JSON",
    "INVALID_CREDENTIALS",
    "ACCOUNT_UNAVAILABLE",
    "FORBIDDEN_ORIGIN",
    "UNSUPPORTED_MEDIA_TYPE",
    "PAYLOAD_TOO_LARGE",
    "TOO_MANY_ATTEMPTS",
    "DATABASE_UNAVAILABLE",
    "INTERNAL_ERROR",
    "NETWORK_ERROR",
    "TIMEOUT",
  ];

  if (
    typeof value === "string" &&
    validCodes.includes(
      value as LoginErrorCode
    )
  ) {
    return value as LoginErrorCode;
  }

  return "INTERNAL_ERROR";
}

function getHttpErrorCode(
  status: number
): LoginErrorCode {
  switch (status) {
    case 400:
      return "INVALID_INPUT";

    case 401:
      return "INVALID_CREDENTIALS";

    case 403:
      return "FORBIDDEN_ORIGIN";

    case 413:
      return "PAYLOAD_TOO_LARGE";

    case 415:
      return "UNSUPPORTED_MEDIA_TYPE";

    case 429:
      return "TOO_MANY_ATTEMPTS";

    case 503:
      return "DATABASE_UNAVAILABLE";

    default:
      return "INTERNAL_ERROR";
  }
}

function readRetryAfter(
  response: Response,
  payload?: LoginErrorResponse
): number {
  const serverValue =
    payload?.error?.retryAfter;

  const headerValue =
    Number(
      response.headers.get(
        "Retry-After"
      )
    );

  const seconds =
    typeof serverValue === "number" &&
    Number.isFinite(serverValue) &&
    serverValue > 0
      ? serverValue
      : headerValue;

  if (
    !Number.isFinite(seconds) ||
    seconds <= 0
  ) {
    return 60;
  }

  return Math.min(
    86_400,
    Math.ceil(seconds)
  );
}

/* ============================================================
   7. FORM ERROR TYPES
   ============================================================ */

type FormError =
  | {
      type: "API";
      code: LoginErrorCode;
    }
  | {
      type: "FIELD";
      code:
        | "identifierRequired"
        | "identifierInvalid"
        | "passwordRequired"
        | "passwordTooLong";
    };

type FormStatus =
  | "IDLE"
  | "LOADING"
  | "SUCCESS";

/* ============================================================
   8. MAIN LOGIN PAGE
   ============================================================ */

export default function LoginPage() {

  /* --------------------------------------------------------
     LANGUAGE
     -------------------------------------------------------- */

  const [locale, setLocale] =
    useState<Locale>(
      defaultLocale
    );

  const t =
    TRANSLATIONS[locale];

  const direction =
    getLocaleDirection(locale);

  const isRtl =
    direction === "rtl";

  /* --------------------------------------------------------
     FORM STATE
     -------------------------------------------------------- */

  const [
    identifier,
    setIdentifier,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    rememberMe,
    setRememberMe,
  ] = useState(false);

  const [
    status,
    setStatus,
  ] = useState<FormStatus>(
    "IDLE"
  );

  const [
    formError,
    setFormError,
  ] = useState<FormError | null>(
    null
  );

  /* --------------------------------------------------------
     RATE LIMIT
     -------------------------------------------------------- */

  const [
    retryUntil,
    setRetryUntil,
  ] = useState<number | null>(
    null
  );

  const [
    retryRemaining,
    setRetryRemaining,
  ] = useState(0);

  /* --------------------------------------------------------
     REFERENCES
     -------------------------------------------------------- */

  const identifierRef =
    useRef<HTMLInputElement>(null);

  const passwordRef =
    useRef<HTMLInputElement>(null);

  const requestRef =
    useRef<AbortController | null>(
      null
    );

  const submittingRef =
    useRef(false);

  const mountedRef =
    useRef(false);

  const redirectTimerRef =
    useRef<number | null>(
      null
    );

  const isSubmitting =
    status === "LOADING";

  const isSuccess =
    status === "SUCCESS";

  const isRateLimited =
    retryRemaining > 0;

  const formDisabled =
    isSubmitting || isSuccess;

  /* ========================================================
     9. LANGUAGE SYNCHRONIZATION
     ======================================================== */

  useEffect(() => {
    const localeTimer = window.setTimeout(() => setLocale(getCurrentLocale()), 0);

    function handleLanguageChange(
      event: Event
    ) {
      const customEvent =
        event as CustomEvent<unknown>;

      const value =
        customEvent.detail;

      if (
        typeof value === "string" &&
        isLocale(value)
      ) {
        setLocale(value);
        return;
      }

      setLocale(
        getCurrentLocale()
      );
    }

    function handleStorageChange(
      event: StorageEvent
    ) {
      if (
        event.key ===
          LANGUAGE_STORAGE_KEY ||
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
      handleLanguageChange
    );

    window.addEventListener(
      "storage",
      handleStorageChange
    );

    return () => {
      window.clearTimeout(localeTimer);
      observer.disconnect();

      window.removeEventListener(
        LANGUAGE_EVENT,
        handleLanguageChange
      );

      window.removeEventListener(
        "storage",
        handleStorageChange
      );
    };
  }, []);

  /* ========================================================
     10. COMPONENT LIFECYCLE
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
     11. RATE LIMIT COUNTDOWN

     Uses the actual server retry delay.

     Does not bypass the server limit.
     ======================================================== */

  useEffect(() => {
    if (!retryUntil) {
      return;
    }

    function updateCountdown() {
      const remaining =
        Math.max(
          0,
          Math.ceil(
            (retryUntil! - Date.now()) /
              1000
          )
        );

      setRetryRemaining(
        remaining
      );

      if (remaining === 0) {
        setRetryUntil(null);

        setFormError((current) => {
          if (
            current?.type === "API" &&
            current.code ===
              "TOO_MANY_ATTEMPTS"
          ) {
            return null;
          }

          return current;
        });
      }
    }

    const initialTimer = window.setTimeout(updateCountdown, 0);

    const interval =
      window.setInterval(
        updateCountdown,
        1000
      );

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(
        interval
      );
    };
  }, [retryUntil]);

  /* ========================================================
     12. FORM ERROR HELPERS
     ======================================================== */

  function getErrorMessage(): string | null {
    if (!formError) {
      return null;
    }

    if (
      formError.type === "FIELD"
    ) {
      return t[formError.code];
    }

    return t.errors[
      formError.code
    ];
  }

  function clearEditableError() {
    if (!isRateLimited) {
      setFormError(null);
    }
  }

  function getCountdownText(): string {
    const minutes =
      Math.floor(
        retryRemaining / 60
      );

    const seconds =
      retryRemaining % 60;

    if (minutes > 0) {
      return (
        `${minutes} ${t.minutes} ` +
        `${seconds} ${t.seconds}`
      );
    }

    return `${seconds} ${t.seconds}`;
  }

  /* ========================================================
     13. LOGIN FORM SUBMISSION

     POST /api/auth/login

     - No password in URL
     - No token in localStorage
     - No fake authentication
     - No direct PostgreSQL access
     - HttpOnly cookie set by API
     ======================================================== */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      submittingRef.current ||
      isSuccess ||
      (
        retryUntil !== null &&
        retryUntil > Date.now()
      )
    ) {
      return;
    }

    setFormError(null);

    /* Validate identifier */

    if (!identifier.trim()) {
      setFormError({
        type: "FIELD",
        code: "identifierRequired",
      });

      identifierRef.current?.focus();

      return;
    }

    const normalizedIdentifier =
      normalizeIdentifier(
        identifier
      );

    if (
      !isValidIdentifier(
        normalizedIdentifier
      )
    ) {
      setFormError({
        type: "FIELD",
        code: "identifierInvalid",
      });

      identifierRef.current?.focus();

      return;
    }

    /* Validate password */

    if (password.length === 0) {
      setFormError({
        type: "FIELD",
        code: "passwordRequired",
      });

      passwordRef.current?.focus();

      return;
    }

    const passwordBytes =
      new TextEncoder()
        .encode(password)
        .byteLength;

    if (passwordBytes > 1024) {
      setFormError({
        type: "FIELD",
        code: "passwordTooLong",
      });

      passwordRef.current?.focus();

      return;
    }

    /* Prevent duplicate requests */

    submittingRef.current = true;

    setStatus("LOADING");

    setShowPassword(false);

    requestRef.current?.abort();

    const controller =
      new AbortController();

    requestRef.current =
      controller;

    let timedOut = false;

    let loginCompleted = false;

    const timeout =
      window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, REQUEST_TIMEOUT_MS);

    try {
      /* Send real credentials */

      const response =
        await fetch(LOGIN_API, {
          method: "POST",

          credentials:
            "same-origin",

          cache:
            "no-store",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body: JSON.stringify({
            identifier:
              normalizedIdentifier,

            password,

            rememberMe,
          }),

          signal:
            controller.signal,
        });

      let payload:
        | LoginApiResponse
        | null = null;

      try {
        payload =
          (await response.json()) as
            LoginApiResponse;
      } catch {
        payload = null;
      }

      if (!mountedRef.current) {
        return;
      }

      /* Handle API errors */

      if (
        !response.ok ||
        !payload ||
        payload.success !== true
      ) {
        const errorPayload =
          payload?.success === false
            ? payload
            : undefined;

        const errorCode =
          response.status === 429
            ? "TOO_MANY_ATTEMPTS"
            : errorPayload?.error?.code
              ? getKnownErrorCode(
                  errorPayload.error.code
                )
              : getHttpErrorCode(
                  response.status
                );

        setFormError({
          type: "API",
          code: errorCode,
        });

        if (
          response.status === 429
        ) {
          const seconds =
            readRetryAfter(
              response,
              errorPayload
            );

          setRetryRemaining(
            seconds
          );

          setRetryUntil(
            Date.now() +
              seconds * 1000
          );
        }

        if (
          errorCode ===
            "INVALID_CREDENTIALS"
        ) {
          setPassword("");
        }

        return;
      }

      /* Ensure authentication succeeded */

      if (
        payload.data?.session
          ?.authenticated !== true
      ) {
        setFormError({
          type: "API",
          code: "INTERNAL_ERROR",
        });

        return;
      }

      /* Successful login */

      loginCompleted = true;

      setStatus("SUCCESS");

      setFormError(null);

      setPassword("");

      setShowPassword(false);

      /*
       * Use a fixed internal path.
       * Never redirect to an arbitrary
       * URL supplied by the response.
       */

      redirectTimerRef.current =
        window.setTimeout(() => {
          window.location.replace(
            DASHBOARD_PATH
          );
        }, 250);

    } catch {
      if (!mountedRef.current) {
        return;
      }

      if (timedOut) {
        setFormError({
          type: "API",
          code: "TIMEOUT",
        });
      } else if (
        !controller.signal.aborted
      ) {
        setFormError({
          type: "API",
          code: "NETWORK_ERROR",
        });
      }
    } finally {
      window.clearTimeout(timeout);

      if (
        requestRef.current ===
        controller
      ) {
        requestRef.current = null;
      }

      if (mountedRef.current) {
        if (!loginCompleted) {
          submittingRef.current =
            false;

          setStatus("IDLE");
        }
      }
    }
  }

  /* ========================================================
     14. DERIVED UI STATES
     ======================================================== */

  const errorMessage =
    getErrorMessage();

  const identifierHasError =
    formError?.type === "FIELD" &&
    (
      formError.code ===
        "identifierRequired" ||
      formError.code ===
        "identifierInvalid"
    );

  const passwordHasError =
    formError?.type === "FIELD" &&
    (
      formError.code ===
        "passwordRequired" ||
      formError.code ===
        "passwordTooLong"
    );

  const inputBaseClass =
    "block h-14 w-full rounded-[13px] " +
    "border bg-white outline-none " +
    "text-[16px] font-medium text-[#111827] " +
    "placeholder:font-normal placeholder:text-[#6b7280] " +
    "transition-colors duration-200 " +
    "focus:border-[#65b900] focus:ring-4 " +
    "focus:ring-[#91d52c]/10 " +
    "disabled:cursor-not-allowed " +
    "disabled:bg-[#f5f7f3] disabled:opacity-70";

  /* ========================================================
     15. RESPONSIVE INTERFACE

     The existing auth layout renders:
     - Header
     - MobileNav
     - Existing language switcher

     This page renders the form only.
     ======================================================== */

  return (
    <main
      lang={locale}
      dir={direction}
      className="
        w-full
        min-h-0
        bg-[#f5f7f4]
        px-4
        pb-24
        pt-8
        text-[#111827]
        sm:px-6
        sm:pb-14
        sm:pt-12
        lg:px-8
        lg:pb-20
      "
    >
      <div
        className="
          mx-auto
          flex
          w-full
          max-w-none
          flex-col
          items-center
        "
      >
        {/* ================================================
            WHITE LOGIN CARD
            ================================================ */}

        <section
          aria-labelledby="login-title"
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
          {/* ==============================================
              ORIGINAL LOGO
              No decorative images.
              ============================================== */}

          <div
            className="
              mb-6
              flex
              justify-center
              sm:mb-7
            "
          >
            <Image
              src="/logo/logo.jpg"
              alt="Fahrschule TAYM"
              width={230}
              height={100}
              priority
              className="
                h-auto
                w-47.5
                max-w-full
                object-contain
                sm:w-56.25
              "
            />
          </div>

          {/* ==============================================
              TITLE
              ============================================== */}

          <div
            className="
              mb-8
              text-center
            "
          >
            <h1
              id="login-title"
              className="
                text-[29px]
                font-black
                leading-tight
                tracking-tight
                text-[#101710]
                sm:text-[35px]
              "
            >
              {t.title}
            </h1>

            <p
              className="
                mt-2
                text-[14px]
                leading-6
                text-[#525b56]
                sm:text-[15px]
              "
            >
              {t.subtitle}
            </p>
          </div>

          {/* ==============================================
              SUCCESS MESSAGE
              ============================================== */}

          {isSuccess ? (
            <div
              role="status"
              className="
                mb-5
                flex
                items-start
                gap-3
                rounded-xl
                border
                border-green-200
                bg-green-50
                p-4
                text-green-800
              "
            >
              <CheckCircle2
                size={23}
                className="
                  mt-0.5
                  shrink-0
                "
                aria-hidden="true"
              />

              <div>
                <p
                  className="
                    text-sm
                    font-bold
                  "
                >
                  {t.loginSuccess}
                </p>

                <p
                  className="
                    mt-1
                    text-sm
                    leading-6
                  "
                >
                  {t.redirecting}
                </p>
              </div>
            </div>
          ) : null}

          {/* ==============================================
              ERROR MESSAGE
              ============================================== */}

          {errorMessage ? (
            <div
              id="login-error"
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
                px-4
                py-3.5
                text-red-700
              "
            >
              <CircleAlert
                size={21}
                className="
                  mt-0.5
                  shrink-0
                "
                aria-hidden="true"
              />

              <div
                className="
                  min-w-0
                  text-sm
                  leading-6
                "
              >
                <p>
                  {errorMessage}
                </p>

                {isRateLimited ? (
                  <p
                    className="
                      mt-2
                      font-bold
                      tabular-nums
                    "
                  >
                    {t.retryIn}{" "}
                    {getCountdownText()}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* ==============================================
              LOGIN FORM
              ============================================== */}

          <form
            onSubmit={handleSubmit}
            noValidate
            aria-busy={isSubmitting}
            className="space-y-4"
          >
            {/* EMAIL OR TELEPHONE */}

            <div>
              <label
                htmlFor="identifier"
                className="
                  mb-2
                  block
                  text-sm
                  font-semibold
                  text-[#303b34]
                "
              >
                {t.identifier}
              </label>

              <div className="relative">
                <UserRound
                  size={22}
                  strokeWidth={1.9}
                  aria-hidden="true"
                  className={`
                    pointer-events-none
                    absolute
                    top-1/2
                    z-10
                    -translate-y-1/2
                    text-[#69736c]
                    ${isRtl
                      ? "right-4"
                      : "left-4"}
                  `}
                />

                <input
                  ref={identifierRef}
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={254}
                  dir="auto"
                  required
                  value={identifier}
                  disabled={formDisabled}
                  aria-invalid={
                    identifierHasError
                  }
                  aria-describedby={
                    identifierHasError
                      ? "login-error identifier-help"
                      : "identifier-help"
                  }
                  placeholder={
                    t.identifierPlaceholder
                  }
                  onChange={(event) => {
                    setIdentifier(
                      event.target.value
                    );

                    clearEditableError();
                  }}
                  className={`
                    ${inputBaseClass}
                    ${isRtl
                      ? "pr-12 pl-4"
                      : "pl-12 pr-4"}
                    ${identifierHasError
                      ? "border-red-400"
                      : "border-[#d6ddd6]"}
                  `}
                />
              </div>

              <p
                id="identifier-help"
                className="
                  mt-2
                  text-[11px]
                  leading-5
                  text-[#7a827c]
                  sm:text-xs
                "
              >
                {t.identifierHelp}
              </p>
            </div>

            {/* PASSWORD */}

            <div>
              <label
                htmlFor="password"
                className="
                  mb-2
                  block
                  text-sm
                  font-semibold
                  text-[#303b34]
                "
              >
                {t.password}
              </label>

              <div className="relative">
                <LockKeyhole
                  size={22}
                  strokeWidth={1.9}
                  aria-hidden="true"
                  className={`
                    pointer-events-none
                    absolute
                    top-1/2
                    z-10
                    -translate-y-1/2
                    text-[#69736c]
                    ${isRtl
                      ? "right-4"
                      : "left-4"}
                  `}
                />

                <input
                  ref={passwordRef}
                  id="password"
                  name="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  autoComplete="current-password"
                  autoCapitalize="none"
                  spellCheck={false}
                  dir="auto"
                  maxLength={1024}
                  required
                  value={password}
                  disabled={formDisabled}
                  aria-invalid={
                    passwordHasError
                  }
                  aria-describedby={
                    passwordHasError
                      ? "login-error"
                      : undefined
                  }
                  placeholder={
                    t.passwordPlaceholder
                  }
                  onChange={(event) => {
                    setPassword(
                      event.target.value
                    );

                    clearEditableError();
                  }}
                  className={`
                    ${inputBaseClass}
                    px-12
                    ${passwordHasError
                      ? "border-red-400"
                      : "border-[#d6ddd6]"}
                  `}
                />

                {/* Show / hide password */}

                <button
                  type="button"
                  disabled={formDisabled}
                  aria-label={
                    showPassword
                      ? t.hidePassword
                      : t.showPassword
                  }
                  aria-pressed={
                    showPassword
                  }
                  title={
                    showPassword
                      ? t.hidePassword
                      : t.showPassword
                  }
                  onClick={() => {
                    setShowPassword(
                      (current) => !current
                    );
                  }}
                  className={`
                    absolute
                    top-1/2
                    z-10
                    grid
                    h-10
                    w-10
                    -translate-y-1/2
                    place-items-center
                    rounded-lg
                    text-[#69736c]
                    transition
                    hover:bg-[#f0f5e9]
                    hover:text-[#498d00]
                    focus-visible:outline-2
                    focus-visible:outline-[#65b900]
                    disabled:opacity-50
                    ${isRtl
                      ? "left-2"
                      : "right-2"}
                  `}
                >
                  {showPassword ? (
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

            {/* ============================================
                REMEMBER ME + FORGOT PASSWORD
                ============================================ */}

            <div
              className="
                flex
                flex-wrap
                items-center
                justify-between
                gap-x-3
                gap-y-3
                py-0.5
              "
            >
              <label
                htmlFor="remember-me"
                className="
                  inline-flex
                  min-h-9
                  cursor-pointer
                  select-none
                  items-center
                  gap-2
                "
              >
                <input
                  id="remember-me"
                  name="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  disabled={formDisabled}
                  onChange={(event) => {
                    setRememberMe(
                      event.target.checked
                    );
                  }}
                  className="
                    h-4.75
                    w-4.75
                    shrink-0
                    cursor-pointer
                    rounded
                    accent-[#348900]
                    disabled:cursor-not-allowed
                  "
                />

                <span
                  className="
                    text-[12px]
                    font-medium
                    text-[#303b34]
                    sm:text-[13px]
                  "
                >
                  {t.rememberMe}
                </span>
              </label>

              <Link
                href={
                  FORGOT_PASSWORD_PATH
                }
                prefetch={false}
                className="
                  text-[12px]
                  font-bold
                  text-[#347b00]
                  transition-colors
                  hover:text-[#205700]
                  hover:underline
                  sm:text-[13px]
                "
              >
                {t.forgotPassword}
              </Link>
            </div>

            {/* ============================================
                LOGIN BUTTON
                ============================================ */}

            <button
              type="submit"
              disabled={
                formDisabled ||
                isRateLimited
              }
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
                px-5
                py-3.5
                text-base
                font-extrabold
                text-white
                shadow-[0_5px_15px_rgba(55,130,0,0.17)]
                transition-all
                duration-200
                hover:from-[#489500]
                hover:to-[#1c6300]
                active:scale-[0.99]
                focus-visible:outline-2
                focus-visible:outline-offset-4
                focus-visible:outline-[#65b900]
                disabled:cursor-not-allowed
                disabled:opacity-60
                disabled:shadow-none
              "
            >
              {isSubmitting ? (
                <LoaderCircle
                  size={23}
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : isSuccess ? (
                <CheckCircle2
                  size={23}
                  aria-hidden="true"
                />
              ) : (
                <LogIn
                  size={23}
                  strokeWidth={2}
                  aria-hidden="true"
                  className={
                    isRtl
                      ? "rotate-180"
                      : ""
                  }
                />
              )}

              <span>
                {isSubmitting
                  ? t.loggingIn
                  : isSuccess
                    ? t.loginSuccess
                    : isRateLimited
                      ? `${t.retryIn} ${getCountdownText()}`
                      : t.login}
              </span>
            </button>
          </form>

          {/* ==============================================
              REGISTER LINK

              Existing registration page.
              No fake social authentication.
              ============================================== */}

          <div
            className="
              mt-7
              border-t
              border-[#e7ebe5]
              pt-6
              text-center
              sm:mt-8
            "
          >
            <p
              className="
                text-[14px]
                leading-7
                text-[#424d45]
              "
            >
              {t.noAccount}{" "}

              <Link
                href={REGISTER_PATH}
                className="
                  inline-block
                  font-extrabold
                  text-[#347b00]
                  transition-colors
                  hover:text-[#205700]
                  hover:underline
                "
              >
                {t.register}
              </Link>
            </p>
          </div>
        </section>

        {/* ================================================
            SECURITY INDICATION
            ================================================ */}

        <div
          className="
            mt-5
            flex
            items-center
            justify-center
            gap-2
            px-2
            text-center
            sm:mt-6
          "
        >
          <ShieldCheck
            size={18}
            strokeWidth={1.9}
            aria-hidden="true"
            className="
              shrink-0
              text-[#488a15]
            "
          />

          <p
            className="
              text-[11px]
              font-medium
              leading-5
              text-[#68746b]
              sm:text-xs
            "
          >
            {t.secureConnection}
          </p>
        </div>
      </div>
    </main>
  );
}
