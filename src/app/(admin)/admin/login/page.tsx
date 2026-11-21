
"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";

/* ============================================================
   FAHRSCHULE TAYM
   ADMINISTRATOR LOGIN

   File:
   src/app/(admin)/admin/login/page.tsx

   Public URL:
   /admin/login

   API:
   POST /api/admin/auth/login

   Successful redirect:
   /admin/dashboard

   Supported languages:
   de | ar | tr | es

   Security principles:
   - No password in source code
   - No email/password verification in browser
   - No authentication data in localStorage
   - No fake session
   - No success before server confirmation
   - Secure session managed by server
   - Generic login failure messages
   ============================================================ */

type Locale = "de" | "ar" | "tr" | "es";

type LoginResponse = {
  success?: boolean;
  code?: string;
  message?: string;
};

type LoginError =
  | "INVALID_CREDENTIALS"
  | "RATE_LIMITED"
  | "INVALID_INPUT"
  | "SERVICE_UNAVAILABLE"
  | "NETWORK_ERROR";

const LOGIN_API = "/api/admin/auth/login";

const DASHBOARD_URL = "/admin/dashboard";

/* ============================================================
   1. TRANSLATIONS
   ============================================================ */

const TRANSLATIONS = {
  de: {
    languageName: "Deutsch",

    panelLabel: "GESCHÜTZTER BEREICH",

    title: "Administration",

    subtitle:
      "Melde dich mit deinen Administrator-Zugangsdaten an.",

    welcome: "Willkommen zurück",

    welcomeDescription:
      "Verwalte Führerscheinanträge und behalte die Aktivitäten deiner Plattform im Blick.",

    featureOne: "Zentrale Übersicht",

    featureOneDesc:
      "Wichtige Aktivitäten und Antragsstatus auf einen Blick.",

    featureTwo: "Führerscheinanträge",

    featureTwoDesc:
      "Anträge prüfen, Dokumente einsehen und Entscheidungen verwalten.",

    featureThree: "Geschützter Zugriff",

    featureThreeDesc:
      "Der Verwaltungsbereich ist ausschließlich für autorisierte Personen vorgesehen.",

    loginTitle: "Administrator-Anmeldung",

    loginDescription:
      "Bitte gib deine E-Mail-Adresse und dein Passwort ein.",

    emailLabel: "E-Mail-Adresse",

    emailPlaceholder:
      "administrator@beispiel.de",

    passwordLabel: "Passwort",

    passwordPlaceholder:
      "Passwort eingeben",

    showPassword: "Passwort anzeigen",

    hidePassword: "Passwort verbergen",

    signIn: "Sicher anmelden",

    signingIn:
      "Anmeldung wird überprüft...",

    success:
      "Anmeldung erfolgreich. Weiterleitung zum Dashboard...",

    invalidCredentials:
      "E-Mail-Adresse oder Passwort ist nicht korrekt.",

    rateLimited:
      "Zu viele Anmeldeversuche. Bitte versuche es später erneut.",

    invalidInput:
      "Bitte überprüfe deine Eingaben.",

    serviceUnavailable:
      "Die Anmeldung ist momentan nicht verfügbar. Bitte versuche es später erneut.",

    networkError:
      "Die Verbindung konnte nicht hergestellt werden. Bitte überprüfe deine Internetverbindung.",

    emailRequired:
      "Bitte gib deine E-Mail-Adresse ein.",

    emailInvalid:
      "Bitte gib eine gültige E-Mail-Adresse ein.",

    passwordRequired:
      "Bitte gib dein Passwort ein.",

    capsLock:
      "Die Feststelltaste ist aktiviert.",

    securityNotice:
      "Diese Anmeldung ist ausschließlich für die autorisierte Administration von Fahrschule TAYM vorgesehen.",

    backToWebsite:
      "Zurück zur Website",

    protectedAccess:
      "Nur für autorisierte Administratoren",

    copyright:
      "Fahrschule TAYM. Alle Rechte vorbehalten.",

    brandLine:
      "Fahrschule TAYM",
  },

  ar: {
    languageName: "العربية",

    panelLabel: "منطقة محمية",

    title: "الإدارة",

    subtitle:
      "سجّل الدخول باستخدام بيانات حساب المسؤول.",

    welcome: "مرحباً بعودتك",

    welcomeDescription:
      "قم بإدارة طلبات رخص القيادة ومتابعة أنشطة المنصة.",

    featureOne: "لوحة تحكم مركزية",

    featureOneDesc:
      "متابعة الأنشطة المهمة وحالات الطلبات.",

    featureTwo: "طلبات رخص القيادة",

    featureTwoDesc:
      "مراجعة الطلبات والاطلاع على المستندات وإدارة القرارات.",

    featureThree: "دخول محمي",

    featureThreeDesc:
      "هذه المساحة مخصصة للمسؤولين المصرح لهم فقط.",

    loginTitle: "تسجيل دخول المسؤول",

    loginDescription:
      "يرجى إدخال البريد الإلكتروني وكلمة المرور.",

    emailLabel: "البريد الإلكتروني",

    emailPlaceholder:
      "administrator@example.com",

    passwordLabel: "كلمة المرور",

    passwordPlaceholder:
      "أدخل كلمة المرور",

    showPassword: "إظهار كلمة المرور",

    hidePassword: "إخفاء كلمة المرور",

    signIn: "تسجيل الدخول بأمان",

    signingIn:
      "جارٍ التحقق من بيانات الدخول...",

    success:
      "تم تسجيل الدخول بنجاح. جارٍ الانتقال إلى لوحة التحكم...",

    invalidCredentials:
      "البريد الإلكتروني أو كلمة المرور غير صحيحة.",

    rateLimited:
      "محاولات دخول كثيرة جداً. حاول مرة أخرى لاحقاً.",

    invalidInput:
      "يرجى التحقق من البيانات المدخلة.",

    serviceUnavailable:
      "خدمة تسجيل الدخول غير متاحة حالياً. حاول لاحقاً.",

    networkError:
      "تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.",

    emailRequired:
      "يرجى إدخال البريد الإلكتروني.",

    emailInvalid:
      "يرجى إدخال بريد إلكتروني صحيح.",

    passwordRequired:
      "يرجى إدخال كلمة المرور.",

    capsLock:
      "زر الأحرف الكبيرة مفعل.",

    securityNotice:
      "هذه الصفحة مخصصة حصرياً للإدارة المصرح لها في مدرسة TAYM.",

    backToWebsite:
      "العودة إلى الموقع",

    protectedAccess:
      "للمسؤولين المصرح لهم فقط",

    copyright:
      "مدرسة TAYM لتعليم القيادة. جميع الحقوق محفوظة.",

    brandLine:
      "Fahrschule TAYM",
  },

  tr: {
    languageName: "Türkçe",

    panelLabel: "KORUMALI ALAN",

    title: "Yönetim",

    subtitle:
      "Yönetici giriş bilgilerinizle oturum açın.",

    welcome: "Tekrar hoş geldiniz",

    welcomeDescription:
      "Ehliyet başvurularını yönetin ve platform etkinliklerini takip edin.",

    featureOne: "Merkezi kontrol paneli",

    featureOneDesc:
      "Önemli işlemleri ve başvuru durumlarını takip edin.",

    featureTwo: "Ehliyet başvuruları",

    featureTwoDesc:
      "Başvuruları inceleyin, belgeleri görüntüleyin ve kararları yönetin.",

    featureThree: "Korumalı erişim",

    featureThreeDesc:
      "Yönetim alanı yalnızca yetkili kişiler içindir.",

    loginTitle: "Yönetici girişi",

    loginDescription:
      "Lütfen e-posta adresinizi ve şifrenizi girin.",

    emailLabel: "E-posta adresi",

    emailPlaceholder:
      "administrator@ornek.com",

    passwordLabel: "Şifre",

    passwordPlaceholder:
      "Şifrenizi girin",

    showPassword: "Şifreyi göster",

    hidePassword: "Şifreyi gizle",

    signIn: "Güvenli giriş",

    signingIn:
      "Giriş bilgileri kontrol ediliyor...",

    success:
      "Giriş başarılı. Kontrol paneline yönlendiriliyorsunuz...",

    invalidCredentials:
      "E-posta adresi veya şifre hatalı.",

    rateLimited:
      "Çok fazla giriş denemesi yapıldı. Lütfen daha sonra tekrar deneyin.",

    invalidInput:
      "Lütfen girdiğiniz bilgileri kontrol edin.",

    serviceUnavailable:
      "Giriş hizmeti şu anda kullanılamıyor. Daha sonra tekrar deneyin.",

    networkError:
      "Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.",

    emailRequired:
      "Lütfen e-posta adresinizi girin.",

    emailInvalid:
      "Geçerli bir e-posta adresi girin.",

    passwordRequired:
      "Lütfen şifrenizi girin.",

    capsLock:
      "Caps Lock açık.",

    securityNotice:
      "Bu giriş yalnızca Fahrschule TAYM'ın yetkili yöneticileri içindir.",

    backToWebsite:
      "Web sitesine dön",

    protectedAccess:
      "Yalnızca yetkili yöneticiler",

    copyright:
      "Fahrschule TAYM. Tüm hakları saklıdır.",

    brandLine:
      "Fahrschule TAYM",
  },

  es: {
    languageName: "Español",

    panelLabel: "ÁREA PROTEGIDA",

    title: "Administración",

    subtitle:
      "Inicie sesión con sus credenciales de administrador.",

    welcome: "Bienvenido de nuevo",

    welcomeDescription:
      "Gestione solicitudes de permisos y consulte las actividades de la plataforma.",

    featureOne: "Panel centralizado",

    featureOneDesc:
      "Consulte actividades importantes y estados de solicitudes.",

    featureTwo: "Solicitudes de permisos",

    featureTwoDesc:
      "Revise solicitudes, consulte documentos y gestione decisiones.",

    featureThree: "Acceso protegido",

    featureThreeDesc:
      "El área administrativa está reservada a personas autorizadas.",

    loginTitle: "Acceso de administrador",

    loginDescription:
      "Introduzca su correo electrónico y contraseña.",

    emailLabel: "Correo electrónico",

    emailPlaceholder:
      "administrator@ejemplo.com",

    passwordLabel: "Contraseña",

    passwordPlaceholder:
      "Introduzca su contraseña",

    showPassword: "Mostrar contraseña",

    hidePassword: "Ocultar contraseña",

    signIn: "Iniciar sesión de forma segura",

    signingIn:
      "Verificando credenciales...",

    success:
      "Sesión iniciada. Redirigiendo al panel...",

    invalidCredentials:
      "El correo electrónico o la contraseña son incorrectos.",

    rateLimited:
      "Demasiados intentos de acceso. Inténtelo de nuevo más tarde.",

    invalidInput:
      "Revise los datos introducidos.",

    serviceUnavailable:
      "El inicio de sesión no está disponible en este momento.",

    networkError:
      "No se pudo conectar al servidor. Compruebe su conexión.",

    emailRequired:
      "Introduzca su correo electrónico.",

    emailInvalid:
      "Introduzca una dirección válida.",

    passwordRequired:
      "Introduzca su contraseña.",

    capsLock:
      "Bloq Mayús está activado.",

    securityNotice:
      "Esta página está reservada exclusivamente a administradores autorizados de Fahrschule TAYM.",

    backToWebsite:
      "Volver al sitio web",

    protectedAccess:
      "Solo administradores autorizados",

    copyright:
      "Fahrschule TAYM. Todos los derechos reservados.",

    brandLine:
      "Fahrschule TAYM",
  },
} as const;

/* ============================================================
   2. LANGUAGE DETECTION

   Compatible with existing public
   language management.
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

  switch (code) {
    case "de":
    case "ar":
    case "tr":
    case "es":
      return code;

    default:
      return null;
  }
}

function readCookie(
  name: string
): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${name}=`;

  const match = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) =>
      value.startsWith(prefix)
    );

  if (!match) {
    return null;
  }

  try {
    return decodeURIComponent(
      match.slice(prefix.length)
    );
  } catch {
    return null;
  }
}

function readActiveLocale(): Locale {
  if (typeof window === "undefined") {
    return "de";
  }

  const documentLocale =
    normalizeLocale(
      document.documentElement.lang
    );

  if (documentLocale) {
    return documentLocale;
  }

  const cookieLocale =
    normalizeLocale(
      readCookie("taym-locale")
    ) ??
    normalizeLocale(
      readCookie("NEXT_LOCALE")
    );

  if (cookieLocale) {
    return cookieLocale;
  }

  try {
    return (
      normalizeLocale(
        localStorage.getItem(
          "taym-locale"
        )
      ) ?? "de"
    );
  } catch {
    return "de";
  }
}

/* ============================================================
   3. VALIDATE API RESPONSE

   We must never assume login worked
   based only on HTTP status.

   The API must explicitly confirm
   success after creating a session.
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

function isLoginSuccess(
  value: unknown
): value is { success: true } {
  return (
    isRecord(value) &&
    value.success === true
  );
}

/* ============================================================
   4. FIELD VALIDATION

   This validation only improves UX.
   Real authentication and security
   happen on the server.
   ============================================================ */

function validateEmail(
  email: string
): boolean {
  const normalized = email.trim();

  if (
    !normalized ||
    normalized.length > 254
  ) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    normalized
  );
}

/* ============================================================
   5. MAIN PAGE
   ============================================================ */

export default function AdminLoginPage() {
  const router = useRouter();

  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();

  const [locale, setLocale] =
    useState<Locale>("de");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [
    passwordVisible,
    setPasswordVisible,
  ] = useState(false);

  const [capsLock, setCapsLock] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [success, setSuccess] =
    useState(false);

  const [error, setError] =
    useState<LoginError | null>(null);

  const [fieldError, setFieldError] =
    useState<
      "email" | "password" | null
    >(null);

  const submittingRef =
    useRef(false);

  const requestRef =
    useRef<AbortController | null>(null);

  const t = TRANSLATIONS[locale];

  const rtl = locale === "ar";

  const Arrow = rtl
    ? ArrowLeft
    : ArrowRight;

  /* ========================================================
     6. SYNC SITE LANGUAGE
     ======================================================== */

  useEffect(() => {
    const syncLanguage = (
      event?: Event
    ) => {
      if (
        event instanceof CustomEvent
      ) {
        const detail: unknown =
          event.detail;

        const value =
          typeof detail === "string"
            ? detail
            : isRecord(detail)
              ? detail.locale
              : null;

        const next =
          normalizeLocale(value);

        if (next) {
          setLocale(next);
          return;
        }
      }

      setLocale(readActiveLocale());
    };

    syncLanguage();

    const observer =
      new MutationObserver(() => {
        syncLanguage();
      });

    observer.observe(
      document.documentElement,
      {
        attributes: true,
        attributeFilter: ["lang"],
      }
    );

    window.addEventListener(
      "taym:language-change",
      syncLanguage
    );

    window.addEventListener(
      "storage",
      syncLanguage
    );

    return () => {
      observer.disconnect();

      window.removeEventListener(
        "taym:language-change",
        syncLanguage
      );

      window.removeEventListener(
        "storage",
        syncLanguage
      );
    };
  }, []);

  /* ========================================================
     7. CANCEL REQUEST ON UNMOUNT
     ======================================================== */

  useEffect(() => {
    return () => {
      requestRef.current?.abort();
    };
  }, []);

  /* ========================================================
     8. UPDATE CAPS LOCK
     ======================================================== */

  const detectCapsLock = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      setCapsLock(
        event.getModifierState(
          "CapsLock"
        )
      );
    },
    []
  );

  /* ========================================================
     9. ERROR DISPLAY
     ======================================================== */

  function getErrorMessage():
    string | null {
    if (!error) {
      return null;
    }

    switch (error) {
      case "INVALID_CREDENTIALS":
        return t.invalidCredentials;

      case "RATE_LIMITED":
        return t.rateLimited;

      case "INVALID_INPUT":
        return t.invalidInput;

      case "SERVICE_UNAVAILABLE":
        return t.serviceUnavailable;

      case "NETWORK_ERROR":
        return t.networkError;

      default:
        return t.serviceUnavailable;
    }
  }

  /* ========================================================
     10. LOGIN SUBMISSION

     Server contract:

     POST /api/admin/auth/login

     Request:
     {
       email: string,
       password: string
     }

     Success:
     HTTP 200
     {
       success: true
     }

     Server must create an HttpOnly
     secure authentication session.

     Failure:
     HTTP 400 / 401 / 403 /
          429 / 500 / 503
     {
       success: false,
       code: "..."
     }

     The page never verifies passwords
     in browser code.
     ======================================================== */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      submittingRef.current ||
      loading ||
      success
    ) {
      return;
    }

    setError(null);
    setFieldError(null);

    const normalizedEmail =
      email.trim().toLowerCase();

    if (!normalizedEmail) {
      setFieldError("email");
      setError("INVALID_INPUT");
      return;
    }

    if (
      !validateEmail(
        normalizedEmail
      )
    ) {
      setFieldError("email");
      setError("INVALID_INPUT");
      return;
    }

    if (
      password.length === 0 ||
      password.length > 256
    ) {
      setFieldError("password");
      setError("INVALID_INPUT");
      return;
    }

    submittingRef.current = true;
    setLoading(true);

    const controller =
      new AbortController();

    requestRef.current = controller;

    try {
      const response = await fetch(
        LOGIN_API,
        {
          method: "POST",

          credentials: "same-origin",

          cache: "no-store",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body: JSON.stringify({
            email: normalizedEmail,
            password,
          }),

          signal: controller.signal,
        }
      );

      let responseBody:
        LoginResponse | null = null;

      try {
        responseBody =
          (await response.json()) as
            LoginResponse;
      } catch {
        responseBody = null;
      }

      /* ----------------------------------------------
         Handle unsuccessful login.
         ---------------------------------------------- */

      if (!response.ok) {
        setPassword("");

        if (
          response.status === 429
        ) {
          setError("RATE_LIMITED");
        } else if (
          response.status === 400
        ) {
          setError("INVALID_INPUT");
        } else if (
          response.status === 401 ||
          response.status === 403
        ) {
          setError(
            "INVALID_CREDENTIALS"
          );
        } else {
          setError(
            "SERVICE_UNAVAILABLE"
          );
        }

        return;
      }

      /* ----------------------------------------------
         Require explicit server confirmation.

         No redirect for malformed response.
         ---------------------------------------------- */

      if (
        !isLoginSuccess(
          responseBody
        )
      ) {
        setPassword("");
        setError(
          "SERVICE_UNAVAILABLE"
        );

        return;
      }

      /* ----------------------------------------------
         Server confirmed authentication.

         Clear local password state.
         ---------------------------------------------- */

      setPassword("");
      setError(null);
      setSuccess(true);

      /* ----------------------------------------------
         Redirect to protected dashboard.

         Protected layout must independently
         verify the server session.
         ---------------------------------------------- */

      router.replace(
        DASHBOARD_URL
      );

      router.refresh();
    } catch (caught) {
      if (
        caught instanceof Error &&
        caught.name === "AbortError"
      ) {
        return;
      }

      setPassword("");

      setError(
        "NETWORK_ERROR"
      );
    } finally {
      submittingRef.current = false;
      requestRef.current = null;
      setLoading(false);
    }
  }

  /* ========================================================
     11. BUTTON STATE
     ======================================================== */

  const disabled =
    loading || success;

  const inputClass =
    [
      "h-12 w-full rounded-xl",
      "border border-slate-200",
      "bg-white px-4",
      "text-sm text-slate-950",
      "placeholder:text-slate-400",
      "outline-none",
      "transition-all",
      "focus:border-lime-500",
      "focus:ring-4",
      "focus:ring-lime-500/15",
      "disabled:cursor-not-allowed",
      "disabled:bg-slate-50",
      "disabled:opacity-70",
    ].join(" ");

  const displayError =
    getErrorMessage();

  /* ========================================================
     12. PAGE
     ======================================================== */

  return (
    <main
      lang={locale}
      dir={rtl ? "rtl" : "ltr"}
      className="min-h-screen bg-[#f6f8f3] text-slate-950"
    >
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">

        {/* ============================================
            LEFT — BRAND PANEL

            Visible on desktop.
            Compact branding on mobile.
            ============================================ */}

        <aside className="relative hidden min-h-screen overflow-hidden bg-[#142318] text-white lg:flex lg:flex-col lg:justify-between">
          <Image src="/images/imagea.jpg" alt="" fill sizes="50vw" className="object-cover opacity-20" />
          {/* Decorative background */}

          <div className="pointer-events-none absolute -inset-e-28 -top-28 size-96 rounded-full bg-lime-400/10 blur-3xl" />

          <div className="pointer-events-none absolute -inset-s-24 bottom-0 size-96 rounded-full bg-green-500/10 blur-3xl" />

          <div className="relative z-10 p-10 xl:p-14">
            {/* Brand */}

            <Link
              href="/"
              className="inline-flex items-center gap-3"
            >
              <Image src="/logo/logo.jpg" alt="Fahrschule TAYM" width={220} height={72} className="h-auto w-52 rounded-lg bg-white p-2" />
            </Link>

            {/* Welcome */}

            <div className="mt-20 max-w-lg">
              <span className="inline-flex items-center gap-2 rounded-full border border-lime-400/30 bg-lime-400/10 px-4 py-2 text-xs font-bold tracking-wider text-lime-200">
                <ShieldCheck
                  size={16}
                  aria-hidden="true"
                />

                {t.panelLabel}
              </span>

              <h2 className="mt-7 text-4xl font-black leading-tight tracking-tight xl:text-5xl">
                {t.welcome}
              </h2>

              <p className="mt-5 max-w-md text-base leading-8 text-slate-200">
                {t.welcomeDescription}
              </p>
            </div>

            {/* Admin features */}

            <div className="mt-12 max-w-md space-y-5">
              <div className="flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-lime-300">
                  <CheckCircle2
                    size={23}
                    aria-hidden="true"
                  />
                </span>

                <div>
                  <h3 className="text-base font-extrabold">
                    {t.featureOne}
                  </h3>

                  <p className="mt-1 text-sm leading-relaxed text-slate-300">
                    {t.featureOneDesc}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-lime-300">
                  <UserRoundCheck
                    size={23}
                    aria-hidden="true"
                  />
                </span>

                <div>
                  <h3 className="text-base font-extrabold">
                    {t.featureTwo}
                  </h3>

                  <p className="mt-1 text-sm leading-relaxed text-slate-300">
                    {t.featureTwoDesc}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-lime-300">
                  <LockKeyhole
                    size={23}
                    aria-hidden="true"
                  />
                </span>

                <div>
                  <h3 className="text-base font-extrabold">
                    {t.featureThree}
                  </h3>

                  <p className="mt-1 text-sm leading-relaxed text-slate-300">
                    {t.featureThreeDesc}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Desktop footer */}

          <div className="relative z-10 border-t border-white/10 px-10 py-6 xl:px-14">
            <p className="text-xs text-slate-400">
              © 
              {t.copyright}
            </p>
          </div>
        </aside>

        {/* ============================================
            RIGHT — LOGIN FORM
            ============================================ */}

        <section className="flex min-h-screen min-w-0 flex-col">
          {/* Mobile logo and desktop top link */}

          <header className="flex items-center justify-between gap-3 px-4 py-5 sm:px-8 lg:px-10 lg:py-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 lg:hidden"
            >
              <Image src="/logo/logo.jpg" alt="Fahrschule TAYM" width={180} height={60} className="h-auto w-40" />
            </Link>

            <Link
              href="/"
              className="ms-auto inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold text-slate-600 transition-colors hover:bg-white hover:text-green-800 sm:text-sm"
            >
              <Arrow
                size={16}
                aria-hidden="true"
              />

              {t.backToWebsite}
            </Link>
          </header>

          {/* Form content */}

          <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8 lg:px-10">
            <div className="w-full max-w-md">

              {/* Intro */}

              <div className="mb-8 text-center sm:text-start">
                <span className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-lime-200 bg-lime-100 text-green-900 shadow-sm sm:mx-0">
                  <LockKeyhole
                    size={31}
                    aria-hidden="true"
                  />
                </span>

                <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-lime-200 bg-lime-50 px-3 py-1.5 text-[11px] font-bold tracking-wide text-green-800">
                  <ShieldCheck
                    size={14}
                    aria-hidden="true"
                  />

                  {t.protectedAccess}
                </span>

                <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                  {t.loginTitle}
                </h1>

                <p className="mt-3 text-sm leading-7 text-slate-600">
                  {t.loginDescription}
                </p>
              </div>

              {/* Login card */}

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(15,35,15,0.05)] sm:p-8">
                <form
                  onSubmit={handleSubmit}
                  noValidate
                  className="space-y-5"
                >
                  {/* Email */}

                  <div className="space-y-2">
                    <label
                      htmlFor={emailId}
                      className="block text-sm font-bold text-slate-800"
                    >
                      {t.emailLabel}
                    </label>

                    <div className="relative">
                      <Mail
                        size={19}
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-s-4 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        id={emailId}
                        name="email"
                        type="email"
                        dir="ltr"
                        autoComplete="username"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        required
                        maxLength={254}
                        disabled={disabled}
                        value={email}
                        onChange={(event) => {
                          setEmail(
                            event.target.value
                          );

                          setError(null);
                          setFieldError(null);
                        }}
                        placeholder={
                          t.emailPlaceholder
                        }
                        aria-invalid={
                          fieldError === "email"
                        }
                        aria-describedby={
                          error ? errorId : undefined
                        }
                        className={`${inputClass} ps-12`}
                      />
                    </div>
                  </div>

                  {/* Password */}

                  <div className="space-y-2">
                    <label
                      htmlFor={passwordId}
                      className="block text-sm font-bold text-slate-800"
                    >
                      {t.passwordLabel}
                    </label>

                    <div className="relative">
                      <KeyRound
                        size={19}
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-s-4 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        id={passwordId}
                        name="password"
                        type={
                          passwordVisible
                            ? "text"
                            : "password"
                        }
                        dir="ltr"
                        autoComplete="current-password"
                        required
                        maxLength={256}
                        disabled={disabled}
                        value={password}
                        onChange={(event) => {
                          setPassword(
                            event.target.value
                          );

                          setError(null);
                          setFieldError(null);
                        }}
                        onKeyDown={
                          detectCapsLock
                        }
                        onKeyUp={
                          detectCapsLock
                        }
                        onBlur={() =>
                          setCapsLock(false)
                        }
                        placeholder={
                          t.passwordPlaceholder
                        }
                        aria-invalid={
                          fieldError ===
                          "password"
                        }
                        aria-describedby={
                          error ? errorId : undefined
                        }
                        className={`${inputClass} pe-14 ps-12`}
                      />

                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          setPasswordVisible(
                            (current) => !current
                          )
                        }
                        aria-label={
                          passwordVisible
                            ? t.hidePassword
                            : t.showPassword
                        }
                        aria-pressed={
                          passwordVisible
                        }
                        className="absolute inset-e-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 disabled:opacity-50"
                      >
                        {passwordVisible ? (
                          <EyeOff
                            size={19}
                            aria-hidden="true"
                          />
                        ) : (
                          <Eye
                            size={19}
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    </div>

                    {capsLock && (
                      <p className="flex items-center gap-2 text-xs text-amber-700">
                        <AlertCircle
                          size={15}
                          aria-hidden="true"
                        />
                        {t.capsLock}
                      </p>
                    )}
                  </div>

                  {/* Authentication error */}

                  {displayError && (
                    <div
                      id={errorId}
                      role="alert"
                      aria-live="assertive"
                      className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
                    >
                      <AlertCircle
                        size={19}
                        aria-hidden="true"
                        className="mt-0.5 shrink-0"
                      />

                      <span>
                        {displayError}
                      </span>
                    </div>
                  )}

                  {/* Login success */}

                  {success && (
                    <div
                      role="status"
                      aria-live="polite"
                      className="flex items-start gap-3 rounded-xl border border-lime-200 bg-lime-50 p-4 text-sm leading-6 text-green-900"
                    >
                      <CheckCircle2
                        size={19}
                        aria-hidden="true"
                        className="mt-0.5 shrink-0"
                      />

                      <span>
                        {t.success}
                      </span>
                    </div>
                  )}

                  {/* Submit */}

                  <button
                    type="submit"
                    disabled={disabled}
                    className="flex min-h-13 w-full items-center justify-center gap-3 rounded-xl bg-linear-to-r from-[#22652b] to-[#83ba35] px-5 py-3.5 text-sm font-extrabold text-white shadow-sm transition-all hover:from-[#194b22] hover:to-[#6da32b] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-lime-400/30 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? (
                      <Loader2
                        size={20}
                        aria-hidden="true"
                        className="animate-spin"
                      />
                    ) : success ? (
                      <CheckCircle2
                        size={20}
                        aria-hidden="true"
                      />
                    ) : (
                      <LockKeyhole
                        size={19}
                        aria-hidden="true"
                      />
                    )}

                    <span>
                      {loading
                        ? t.signingIn
                        : success
                          ? t.success
                          : t.signIn}
                    </span>

                    {!loading &&
                      !success && (
                      <Arrow
                        size={17}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </form>
              </div>

              {/* Security message */}

              <div className="mt-6 flex items-start gap-3 rounded-xl border border-lime-200 bg-lime-50/70 p-4">
                <ShieldCheck
                  size={21}
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-green-800"
                />

                <p className="text-xs leading-6 text-green-950/85">
                  {t.securityNotice}
                </p>
              </div>

              {/* Mobile copyright */}

              <p className="mt-9 text-center text-xs leading-6 text-slate-500 lg:hidden">
                © 
                {t.copyright}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
