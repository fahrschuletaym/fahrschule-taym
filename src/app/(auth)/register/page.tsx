
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Globe2,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MailCheck,
  Phone,
  RefreshCw,
  Smartphone,
  UserRound,
  UserRoundPlus,
} from "lucide-react";

import {
  defaultLocale,
  isLocale,
  type Locale,
} from "@/i18n/config";

/* =========================================================
   FAHRSCHULE TAYM
   INSCRIPTION CANDIDAT

   /register

   - Mobile / PC
   - Quatre langues : DE, AR, TR, ES
   - Cinq pays
   - Détection IP facultative
   - Indicatif téléphonique modifiable
   - Inscription via API
   - Vérification email + SMS
   - Renvoi des codes
   - Redirection dashboard

   Header et MobileNav :
   gérés par (auth)/layout.tsx

   Aucun Footer.
   Aucun CSS supplémentaire.
   ========================================================= */

type CountryCode = "DE" | "AT" | "BE" | "IT" | "ES";
type Channel = "EMAIL" | "SMS";
type Step = "REGISTER" | "VERIFY";

type FormData = {
  firstName: string;
  lastName: string;
  countryCode: CountryCode;
  phoneCountryCode: CountryCode;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
};

type FieldKey = keyof FormData;

type ApiResult = {
  success?: boolean;
  error?: string;
  fields?: Record<string, string>;
  registrationId?: string;
  resendToken?: string;
  redirectTo?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  channel?: Channel;
  attemptsRemaining?: number;
  retryAfterSeconds?: number;
  verification?: { smsRequired: boolean };
  delivery?: {
    email?: "SENT" | "FAILED";
    sms?: "SENT" | "FAILED" | "DISABLED";
  };
};

type Copy = {
  title: string;
  subtitle: string;
  stepRegister: string;
  stepVerify: string;
  firstName: string;
  lastName: string;
  country: string;
  phoneCountry: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  terms: string;
  privacy: string;
  submit: string;
  loginText: string;
  login: string;
  verifyTitle: string;
  smsCode: string;
  emailCode: string;
  verifyButton: string;
  resend: string;
  sending: string;
  processing: string;
  invalidForm: string;
  invalidCodes: string;
  requiredCode: string;
  success: string;
  genericError: string;
  pendingError: string;
  existingAccount: string;
  expired: string;
  attempts: string;
  cooldown: string;
  sent: string;
  resendFailed: string;
  phoneInvalid: string;
  passwordRule: string;
  passwordMismatch: string;
  consentRequired: string;
  selectCountry: string;
  countryDetected: string;
  back: string;
};

const countries: {
  code: CountryCode;
  flag: string;
  dial: string;
  names: Record<Locale, string>;
}[] = [
  {
    code: "DE",
    flag: "🇩🇪",
    dial: "+49",
    names: {
      de: "Deutschland",
      ar: "ألمانيا",
      tr: "Almanya",
      es: "Alemania",
    },
  },
  {
    code: "AT",
    flag: "🇦🇹",
    dial: "+43",
    names: {
      de: "Österreich",
      ar: "النمسا",
      tr: "Avusturya",
      es: "Austria",
    },
  },
  {
    code: "BE",
    flag: "🇧🇪",
    dial: "+32",
    names: {
      de: "Belgien",
      ar: "بلجيكا",
      tr: "Belçika",
      es: "Bélgica",
    },
  },
  {
    code: "IT",
    flag: "🇮🇹",
    dial: "+39",
    names: {
      de: "Italien",
      ar: "إيطاليا",
      tr: "İtalya",
      es: "Italia",
    },
  },
  {
    code: "ES",
    flag: "🇪🇸",
    dial: "+34",
    names: {
      de: "Spanien",
      ar: "إسبانيا",
      tr: "İspanya",
      es: "España",
    },
  },
];

const copy: Record<Locale, Copy> = {
  de: {
    title: "Registrieren",
    subtitle:
      "Erstellen Sie Ihr Konto, um Ihren Führerscheinantrag zu starten.",
    stepRegister: "Registrierung",
    stepVerify: "Verifizierung",
    firstName: "Vorname",
    lastName: "Nachname",
    country: "Land auswählen",
    phoneCountry: "Vorwahl",
    phone: "Telefonnummer",
    email: "E-Mail-Adresse",
    password: "Passwort",
    confirmPassword: "Passwort bestätigen",
    terms: "Ich akzeptiere die Nutzungsbedingungen.",
    privacy: "Ich akzeptiere die Datenschutzrichtlinie.",
    submit: "Jetzt registrieren",
    loginText: "Sie haben bereits ein Konto?",
    login: "Anmelden",
    verifyTitle: "Bestätigung Ihrer Registrierung",
    smsCode: "SMS-Code",
    emailCode: "E-Mail-Code",
    verifyButton: "Registrierung bestätigen",
    resend: "Code erneut senden",
    sending: "Wird gesendet...",
    processing: "Bitte warten...",
    invalidForm: "Bitte überprüfen Sie Ihre Angaben.",
    invalidCodes: "Der Code ist nicht korrekt.",
    requiredCode: "Bitte beide 6-stelligen Codes eingeben.",
    success: "Code wurde angefordert.",
    genericError: "Ein Fehler ist aufgetreten. Bitte erneut versuchen.",
    pendingError: "Für diese Daten liegt bereits eine Anmeldung vor.",
    existingAccount: "Mit diesen Daten existiert bereits ein Konto.",
    expired: "Der Code ist abgelaufen. Bitte neuen Code anfordern.",
    attempts: "Zu viele Versuche. Bitte neuen Code anfordern.",
    cooldown: "Bitte warten",
    sent: "Neuer Code angefordert.",
    resendFailed: "Der Code konnte nicht gesendet werden.",
    phoneInvalid: "Bitte geben Sie eine gültige Telefonnummer ein.",
    passwordRule: "Das Passwort muss mindestens 12 Zeichen enthalten.",
    passwordMismatch: "Die Passwörter stimmen nicht überein.",
    consentRequired: "Bitte akzeptieren Sie beide Bedingungen.",
    selectCountry: "Land",
    countryDetected: "Land automatisch erkannt",
    back: "Zurück",
  },

  ar: {
    title: "إنشاء حساب",
    subtitle: "أنشئ حسابك لبدء طلب رخصة القيادة.",
    stepRegister: "التسجيل",
    stepVerify: "التحقق",
    firstName: "الاسم الأول",
    lastName: "اسم العائلة",
    country: "اختيار البلد",
    phoneCountry: "مفتاح الدولة",
    phone: "رقم الهاتف",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    confirmPassword: "تأكيد كلمة المرور",
    terms: "أوافق على شروط الاستخدام.",
    privacy: "أوافق على سياسة الخصوصية.",
    submit: "إنشاء الحساب",
    loginText: "لديك حساب بالفعل؟",
    login: "تسجيل الدخول",
    verifyTitle: "تأكيد التسجيل",
    smsCode: "رمز الرسالة النصية",
    emailCode: "رمز البريد الإلكتروني",
    verifyButton: "تأكيد التسجيل",
    resend: "إعادة إرسال الرمز",
    sending: "جارٍ الإرسال...",
    processing: "يرجى الانتظار...",
    invalidForm: "يرجى مراجعة المعلومات.",
    invalidCodes: "رمز التحقق غير صحيح.",
    requiredCode: "يرجى إدخال الرمزين المكونين من 6 أرقام.",
    success: "تم طلب إرسال الرمز.",
    genericError: "حدث خطأ. حاول مرة أخرى.",
    pendingError: "يوجد تسجيل قيد التحقق لهذه البيانات.",
    existingAccount: "يوجد حساب بهذه المعلومات.",
    expired: "انتهت صلاحية الرمز. اطلب رمزًا جديدًا.",
    attempts: "محاولات كثيرة. اطلب رمزًا جديدًا.",
    cooldown: "يرجى الانتظار",
    sent: "تم طلب إرسال رمز جديد.",
    resendFailed: "تعذر إرسال الرمز.",
    phoneInvalid: "يرجى إدخال رقم هاتف صحيح.",
    passwordRule: "يجب أن تتكون كلمة المرور من 12 حرفًا على الأقل.",
    passwordMismatch: "كلمتا المرور غير متطابقتين.",
    consentRequired: "يرجى الموافقة على الشرطين.",
    selectCountry: "البلد",
    countryDetected: "تم تحديد البلد تلقائيًا",
    back: "رجوع",
  },

  tr: {
    title: "Kayıt Ol",
    subtitle: "Ehliyet başvurunuzu başlatmak için hesap oluşturun.",
    stepRegister: "Kayıt",
    stepVerify: "Doğrulama",
    firstName: "Ad",
    lastName: "Soyad",
    country: "Ülke seçin",
    phoneCountry: "Alan kodu",
    phone: "Telefon numarası",
    email: "E-posta adresi",
    password: "Şifre",
    confirmPassword: "Şifreyi doğrulayın",
    terms: "Kullanım koşullarını kabul ediyorum.",
    privacy: "Gizlilik politikasını kabul ediyorum.",
    submit: "Şimdi kayıt ol",
    loginText: "Zaten hesabınız var mı?",
    login: "Giriş yap",
    verifyTitle: "Kaydınızı Doğrulayın",
    smsCode: "SMS Kodu",
    emailCode: "E-posta Kodu",
    verifyButton: "Kaydı doğrula",
    resend: "Kodu tekrar gönder",
    sending: "Gönderiliyor...",
    processing: "Lütfen bekleyin...",
    invalidForm: "Bilgilerinizi kontrol edin.",
    invalidCodes: "Kod doğru değil.",
    requiredCode: "Her iki 6 haneli kodu girin.",
    success: "Kod gönderimi istendi.",
    genericError: "Bir hata oluştu. Tekrar deneyin.",
    pendingError: "Bu bilgiler için bekleyen bir kayıt var.",
    existingAccount: "Bu bilgilerle bir hesap zaten mevcut.",
    expired: "Kodun süresi doldu. Yeni kod isteyin.",
    attempts: "Çok fazla deneme. Yeni kod isteyin.",
    cooldown: "Lütfen bekleyin",
    sent: "Yeni kod istendi.",
    resendFailed: "Kod gönderilemedi.",
    phoneInvalid: "Geçerli bir telefon numarası girin.",
    passwordRule: "Şifre en az 12 karakter olmalıdır.",
    passwordMismatch: "Şifreler eşleşmiyor.",
    consentRequired: "Her iki koşulu da kabul edin.",
    selectCountry: "Ülke",
    countryDetected: "Ülke otomatik belirlendi",
    back: "Geri",
  },

  es: {
    title: "Registrarse",
    subtitle: "Crea tu cuenta para iniciar tu solicitud de permiso.",
    stepRegister: "Registro",
    stepVerify: "Verificación",
    firstName: "Nombre",
    lastName: "Apellidos",
    country: "Seleccionar país",
    phoneCountry: "Prefijo",
    phone: "Teléfono",
    email: "Correo electrónico",
    password: "Contraseña",
    confirmPassword: "Confirmar contraseña",
    terms: "Acepto los términos de uso.",
    privacy: "Acepto la política de privacidad.",
    submit: "Registrarse ahora",
    loginText: "¿Ya tienes una cuenta?",
    login: "Iniciar sesión",
    verifyTitle: "Confirmar Registro",
    smsCode: "Código SMS",
    emailCode: "Código de correo",
    verifyButton: "Confirmar registro",
    resend: "Reenviar código",
    sending: "Enviando...",
    processing: "Espera...",
    invalidForm: "Revisa tus datos.",
    invalidCodes: "El código es incorrecto.",
    requiredCode: "Introduce ambos códigos de 6 dígitos.",
    success: "Envío solicitado.",
    genericError: "Se produjo un error. Inténtalo de nuevo.",
    pendingError: "Ya existe un registro pendiente con estos datos.",
    existingAccount: "Ya existe una cuenta con estos datos.",
    expired: "El código ha caducado. Solicita otro.",
    attempts: "Demasiados intentos. Solicita otro código.",
    cooldown: "Espera",
    sent: "Nuevo código solicitado.",
    resendFailed: "No se pudo enviar el código.",
    phoneInvalid: "Introduce un número de teléfono válido.",
    passwordRule: "La contraseña debe tener al menos 12 caracteres.",
    passwordMismatch: "Las contraseñas no coinciden.",
    consentRequired: "Acepta ambas condiciones.",
    selectCountry: "País",
    countryDetected: "País detectado automáticamente",
    back: "Volver",
  },
};

const emailOnlyCopy: Record<Locale, { instruction: string; required: string }> = {
  de: { instruction: "Geben Sie den Code ein, den Sie per E-Mail erhalten haben.", required: "Bitte geben Sie den 6-stelligen E-Mail-Code ein." },
  ar: { instruction: "أدخل الرمز الذي تلقيته عبر البريد الإلكتروني.", required: "يرجى إدخال رمز البريد الإلكتروني المكون من 6 أرقام." },
  tr: { instruction: "E-posta ile aldığınız kodu girin.", required: "Lütfen 6 haneli e-posta kodunu girin." },
  es: { instruction: "Introduce el código que has recibido por correo electrónico.", required: "Introduce el código de correo de 6 dígitos." },
};

const initialForm: FormData = {
  firstName: "",
  lastName: "",
  countryCode: "DE",
  phoneCountryCode: "DE",
  phone: "",
  email: "",
  password: "",
  confirmPassword: "",
  acceptedTerms: false,
  acceptedPrivacy: false,
};

function validCountry(value: unknown): value is CountryCode {
  return countries.some((country) => country.code === value);
}

function pathLocale(pathname: string): Locale | null {
  const segment = pathname.split("/")[1];
  return segment && isLocale(segment) ? segment : null;
}

function currentLocale(pathname: string): Locale {
  const fromPath = pathLocale(pathname);

  if (fromPath) return fromPath;
  if (typeof document === "undefined") return defaultLocale;

  const saved = document.cookie
    .split("; ")
    .find((value) => value.startsWith("taym-locale="))
    ?.split("=")[1];

  if (saved && isLocale(saved)) return saved;

  const htmlLang = document.documentElement.lang
    .toLowerCase()
    .split("-")[0];

  return isLocale(htmlLang) ? htmlLang : defaultLocale;
}

function translatedLink(path: string, pathname: string) {
  const locale = pathLocale(pathname);
  return locale ? `/${locale}${path}` : path;
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function apiMessage(code: string | undefined, t: Copy) {
  switch (code) {
    case "ACCOUNT_ALREADY_EXISTS":
    case "EMAIL_OR_PHONE_EXISTS":
      return t.existingAccount;
    case "REGISTRATION_ALREADY_PENDING":
      return t.pendingError;
    case "INVALID_CODE":
    case "CODE_INVALID":
      return t.invalidCodes;
    case "EXPIRED":
    case "CODE_EXPIRED":
    case "REGISTRATION_EXPIRED":
      return t.expired;
    case "MAX_ATTEMPTS":
      return t.attempts;
    case "DELIVERY_FAILED":
      return t.resendFailed;
    case "COOLDOWN":
    case "TOO_MANY_REQUESTS":
      return t.cooldown;
    default:
      return t.genericError;
  }
}

/* =========================================================
   CHAMP OTP DE SIX CASES
   ========================================================= */

function OtpBoxes({
  value,
  onChange,
  label,
  disabled,
  autoComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
  autoComplete?: string;
}) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const chars = Array.from(
    { length: 6 },
    (_, index) => value[index] ?? ""
  );

  function setAt(index: number, input: string) {
    const digits = onlyDigits(input);

    if (!digits) {
      const next = [...chars];
      next[index] = "";
      onChange(next.join(""));
      return;
    }

    const next = [...chars];

    for (let offset = 0; offset < digits.length; offset++) {
      if (index + offset >= 6) break;
      next[index + offset] = digits[offset];
    }

    onChange(next.join(""));

    const nextIndex = Math.min(index + digits.length, 5);

    inputRefs.current[nextIndex]?.focus();
  }

  function onKey(
    event: KeyboardEvent<HTMLInputElement>,
    index: number
  ) {
    if (event.key === "Backspace") {
      event.preventDefault();

      const next = [...chars];

      if (next[index]) {
        next[index] = "";
        onChange(next.join(""));
      } else if (index > 0) {
        next[index - 1] = "";
        onChange(next.join(""));
        inputRefs.current[index - 1]?.focus();
      }
    }

    if (event.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function onPaste(
    event: ClipboardEvent<HTMLInputElement>,
    index: number
  ) {
    event.preventDefault();
    setAt(index, event.clipboardData.getData("text"));
  }

  return (
    <div role="group" aria-label={label}>
      <div className="grid grid-cols-6 gap-1.5 sm:gap-2" dir="ltr">
        {chars.map((char, index) => (
          <input
            key={index}
            ref={(element) => {
              inputRefs.current[index] = element;
            }}
            aria-label={`${label} ${index + 1}/6`}
            inputMode="numeric"
            pattern="[0-9]*"
            type="text"
            maxLength={6}
            disabled={disabled}
            autoComplete={
              index === 0 ? autoComplete : "off"
            }
            value={char}
            onChange={(event) =>
              setAt(index, event.target.value)
            }
            onKeyDown={(event) => onKey(event, index)}
            onPaste={(event) => onPaste(event, index)}
            onFocus={(event) => event.currentTarget.select()}
            className="h-12 w-full min-w-0 rounded-lg border border-[#d4ddce] bg-white text-center text-lg font-bold text-[#142014] shadow-sm outline-none transition focus:border-[#6cac0a] focus:ring-2 focus:ring-[#88c62e]/25 disabled:cursor-not-allowed disabled:bg-[#f3f5f1] disabled:text-[#9aa496] sm:h-13"
          />
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   INDICATEUR D'ÉTAPES
   ========================================================= */

function StepIndicator({
  step,
  labels,
}: {
  step: Step;
  labels: Pick<Copy, "stepRegister" | "stepVerify">;
}) {
  const isVerify = step === "VERIFY";

  return (
    <div className="flex items-center justify-center gap-2 text-[11px] font-semibold sm:text-xs">
      <div className="flex items-center gap-1.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-linear-to-b from-[#9ad620] to-[#4d9100] font-bold text-white">
          {isVerify ? <Check size={15} /> : "1"}
        </span>
        <span className="text-[#1a2519]">
          {labels.stepRegister}
        </span>
      </div>

      <span className="h-0.5 w-7 bg-[#a7c980] sm:w-12" />

      <div className="flex items-center gap-1.5">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full font-bold text-white ${
            isVerify
              ? "bg-linear-to-b from-[#9ad620] to-[#4d9100]"
              : "bg-[#cbd0c8]"
          }`}
        >
          2
        </span>
        <span
          className={
            isVerify ? "text-[#1a2519]" : "text-[#818a7f]"
          }
        >
          {labels.stepVerify}
        </span>
      </div>
    </div>
  );
}

/* =========================================================
   PAGE PRINCIPALE
   ========================================================= */

export default function RegisterPage() {
  const pathname = usePathname() || "/";

  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [step, setStep] = useState<Step>("REGISTER");

  const [form, setForm] = useState<FormData>(initialForm);
  const [fieldErrors, setFieldErrors] =
    useState<Record<string, string>>({});

  const [geoDetected, setGeoDetected] = useState(false);
  const [countryTouched, setCountryTouched] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const [registrationId, setRegistrationId] = useState("");
  const [resendToken, setResendToken] = useState("");

  const [emailCode, setEmailCode] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [smsRequired, setSmsRequired] = useState(false);

  const [emailVerified, setEmailVerified] = useState(false);
  const [smsVerified, setSmsVerified] = useState(false);

  const [resending, setResending] = useState<Channel | null>(null);

  const [cooldown, setCooldown] = useState<{
    EMAIL: number;
    SMS: number;
  }>({ EMAIL: 0, SMS: 0 });

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const userSelectedCountry = useRef(false);

  const activeLocale = pathLocale(pathname) ?? locale;
  const t = copy[activeLocale];
  const rtl = activeLocale === "ar";

  /* =======================================================
     LANGUE
     ======================================================= */

  useEffect(() => {
    const timer = window.setTimeout(() => setLocale(currentLocale(pathname)), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<Locale>).detail;
      if (isLocale(detail)) setLocale(detail);
    };

    window.addEventListener("taym:language-change", update);

    return () => {
      window.removeEventListener(
        "taym:language-change",
        update
      );
    };
  }, []);

  /* =======================================================
     DÉTECTION DU PAYS PAR IP

     Détection facultative via ipwho.is.
     Si le service échoue, DE est proposé.
     Le candidat garde toujours le choix.
     ======================================================= */

  useEffect(() => {
    const controller = new AbortController();

    async function detectCountry() {
      try {
        const response = await fetch(
          "https://ipwho.is/",
          {
            signal: controller.signal,
            cache: "no-store",
          }
        );

        if (!response.ok) return;

        const result: unknown = await response.json();

        if (
          typeof result !== "object" ||
          result === null ||
          !("country_code" in result)
        ) {
          return;
        }

        const code = result.country_code;

        if (!validCountry(code)) return;
        if (userSelectedCountry.current) return;

        setForm((previous) => ({
          ...previous,
          countryCode: code,
          phoneCountryCode: code,
        }));

        setGeoDetected(true);
      } catch {
        // La détection IP n'est pas obligatoire.
      }
    }

    void detectCountry();

    return () => controller.abort();
  }, []);

  /* =======================================================
     COMPTE À REBOURS DES RENVOIS
     ======================================================= */

  useEffect(() => {
    if (
      cooldown.EMAIL === 0 &&
      cooldown.SMS === 0
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      setCooldown((previous) => ({
        EMAIL: Math.max(0, previous.EMAIL - 1),
        SMS: Math.max(0, previous.SMS - 1),
      }));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [cooldown.EMAIL, cooldown.SMS]);

  /* =======================================================
     MODIFICATION DES CHAMPS
     ======================================================= */

  function changeField<K extends FieldKey>(
    field: K,
    value: FormData[K]
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setFieldErrors((previous) => ({
      ...previous,
      [field]: "",
    }));

    setError("");
  }

  function chooseCountry(code: CountryCode) {
    userSelectedCountry.current = true;
    setCountryTouched(true);
    setGeoDetected(false);

    setForm((previous) => ({
      ...previous,
      countryCode: code,
      phoneCountryCode: code,
    }));
  }

  /* =======================================================
     VALIDATION AVANT APPEL API
     ======================================================= */

  function validateForm() {
    const errors: Record<string, string> = {};

    if (form.firstName.trim().length < 2) {
      errors.firstName = t.invalidForm;
    }

    if (form.lastName.trim().length < 2) {
      errors.lastName = t.invalidForm;
    }

    if (!form.phone.trim()) {
      errors.phone = t.phoneInvalid;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.email.trim()
      )
    ) {
      errors.email = t.invalidForm;
    }

    if (Array.from(form.password).length < 12) {
      errors.password = t.passwordRule;
    }

    if (form.password !== form.confirmPassword) {
      errors.confirmPassword = t.passwordMismatch;
    }

    if (!form.acceptedTerms) {
      errors.acceptedTerms = t.consentRequired;
    }

    if (!form.acceptedPrivacy) {
      errors.acceptedPrivacy = t.consentRequired;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  /* =======================================================
     INSCRIPTION
     ======================================================= */

  async function submitRegistration(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (submitting || !validateForm()) return;

    setSubmitting(true);
    setError("");
    setNotice("");

    const dial =
      countries.find(
        (country) => country.code === form.phoneCountryCode
      )?.dial ?? "+49";

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          dialCode: dial,
          locale: activeLocale,
        }),
      });

      const result: ApiResult = await response.json();

      if (!response.ok || !result.success) {
        if (result.fields) {
          setFieldErrors(result.fields);
        }

        setError(
          result.error === "VALIDATION_ERROR"
            ? t.invalidForm
            : apiMessage(result.error, t)
        );
        return;
      }

      if (!result.registrationId || !result.resendToken) {
        setError(t.genericError);
        return;
      }

      setSmsRequired(result.verification?.smsRequired === true);
      setRegistrationId(result.registrationId);
      setResendToken(result.resendToken);

      setStep("VERIFY");
      setEmailCode("");
      setSmsCode("");
      setEmailVerified(false);
      setSmsVerified(false);

      setCooldown({
        EMAIL: 60,
        SMS: 60,
      });

      // Ne plus conserver le mot de passe en mémoire du formulaire.
      setForm((previous) => ({
        ...previous,
        password: "",
        confirmPassword: "",
      }));

      if (
        result.delivery?.email === "FAILED" ||
        result.delivery?.sms === "FAILED"
      ) {
        setNotice(t.resendFailed);
      }

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch {
      setError(t.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  /* =======================================================
     VÉRIFICATION EMAIL + SMS
     ======================================================= */

  async function submitVerification(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (verifying) return;

    if (
      (emailCode.length !== 6 && !emailVerified) ||
      (smsRequired && smsCode.length !== 6 && !smsVerified)
    ) {
      setError(smsRequired ? t.requiredCode : emailOnlyCopy[activeLocale].required);
      return;
    }

    setVerifying(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registrationId,
          resendToken,
          emailCode: emailCode.padEnd(6, "0"),
          ...(smsRequired ? { smsCode: smsCode.padEnd(6, "0") } : {}),
        }),
      });

      const result: ApiResult = await response.json();

      if (result.emailVerified) {
        setEmailVerified(true);
      }

      if (result.phoneVerified) {
        setSmsVerified(true);
      }

      if (response.ok && result.success) {
        const destination =
          result.redirectTo?.startsWith("/") &&
          !result.redirectTo.startsWith("//")
            ? result.redirectTo
            : "/";

        window.location.assign(destination);
        return;
      }

      setError(apiMessage(result.error, t));

      if (result.channel === "EMAIL") {
        setEmailCode("");
      }

      if (result.channel === "SMS") {
        setSmsCode("");
      }
    } catch {
      setError(t.genericError);
    } finally {
      setVerifying(false);
    }
  }

  /* =======================================================
     RENVOYER UN CODE
     ======================================================= */

  const resendCode = useCallback(
    async (channel: Channel) => {
      if (!registrationId || !resendToken) return;
      if (resending) return;
      if (cooldown[channel] > 0) return;

      setResending(channel);
      setError("");
      setNotice("");

      try {
        const response = await fetch(
          "/api/auth/resend-code",
          {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              registrationId,
              resendToken,
              channel,
              locale: activeLocale,
            }),
          }
        );

        const result: ApiResult = await response.json();

        if (!response.ok || !result.success) {
          setError(apiMessage(result.error, t));

          if (result.retryAfterSeconds) {
            setCooldown((previous) => ({
              ...previous,
              [channel]: result.retryAfterSeconds ?? 0,
            }));
          }

          return;
        }

        if (channel === "EMAIL") {
          setEmailCode("");
        } else {
          setSmsCode("");
        }

        setCooldown((previous) => ({
          ...previous,
          [channel]: 60,
        }));

        setNotice(t.sent);
      } catch {
        setError(t.resendFailed);
      } finally {
        setResending(null);
      }
    },
    [
      registrationId,
      resendToken,
      resending,
      cooldown,
      activeLocale,
      t,
    ]
  );

  /* =======================================================
     STYLES RÉUTILISABLES
     ======================================================= */

  const cardClass =
    "rounded-[18px] border border-[#e2e9db] bg-white px-4 py-5 shadow-[0_5px_22px_rgba(19,42,9,0.07)] sm:px-6 sm:py-6";

  const labelClass =
    "mb-1.5 block text-[12px] font-bold text-[#1d291c]";

  const inputClass =
    "h-10.75 w-full rounded-[9px] border border-[#d5ded0] bg-white pl-10 pr-3 text-[13px] text-[#162016] outline-none transition placeholder:text-[#97a092] focus:border-[#6ea80c] focus:ring-2 focus:ring-[#a3d75f]/25";

  const buttonClass =
    "flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-linear-to-b from-[#94d918] via-[#6eaf03] to-[#397900] px-4 py-2.5 text-[13px] font-extrabold text-white shadow-[0_3px_10px_rgba(66,115,0,0.22)] transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6baf00] disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div
      lang={activeLocale}
      dir={rtl ? "rtl" : "ltr"}
      className="min-h-full w-full overflow-x-clip bg-[linear-gradient(180deg,#f4f9ec_0%,#ffffff_45%,#f7faf3_100%)] text-[#142014]"
    >
      {/* ===================================================
          EN-TÊTE VISUEL
          =================================================== */}

      <section className="relative overflow-hidden border-b border-[#e5eddd] bg-linear-to-r from-[#e0f5bc] via-[#f2f9e8] to-[#ffffff]">
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(224,245,188,0.97)_0%,rgba(224,245,188,0.88)_48%,rgba(224,245,188,0.4)_100%),url(/images/couverture.jpg)] bg-cover bg-center" />
        <div className="relative mx-auto w-full max-w-none px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-10">
          <h1 className="text-[30px] leading-none font-black tracking-[-0.04em] sm:text-[36px] lg:text-[43px]">
            {t.title}
          </h1>

          <div className="mt-2 h-1 w-12.75 rounded-full bg-[#65a309]" />

          <p className="mt-3 max-w-111.25 text-[13px] leading-normal text-[#2c392b] sm:text-[15px]">
            {t.subtitle}
          </p>
        </div>
      </section>

      {/* ===================================================
          CORPS DE LA PAGE
          =================================================== */}

      <div className="mx-auto w-full max-w-none px-3 py-5 sm:px-6 sm:py-7 lg:px-8">
        <div className="grid items-start gap-5 lg:grid-cols-2 lg:gap-6">
          {/* =================================================
              CARTE 1 : INSCRIPTION

              Mobile : uniquement étape inscription
              PC : visible dans la colonne gauche
              ================================================= */}

          <section
            className={`${cardClass} ${
              step === "VERIFY" ? "hidden lg:block" : ""
            }`}
            aria-label={t.stepRegister}
          >
            <StepIndicator
              step="REGISTER"
              labels={t}
            />

            <form
              onSubmit={submitRegistration}
              className="mt-5 space-y-3.5"
              noValidate
            >
              {/* NOM ET PRÉNOM */}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="taym-first-name"
                    className={labelClass}
                  >
                    {t.firstName}
                  </label>

                  <div className="relative">
                    <UserRound
                      size={17}
                      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#657264]"
                    />

                    <input
                      id="taym-first-name"
                      type="text"
                      autoComplete="given-name"
                      maxLength={80}
                      value={form.firstName}
                      disabled={step === "VERIFY"}
                      onChange={(event) =>
                        changeField("firstName", event.target.value)
                      }
                      placeholder={t.firstName}
                      aria-invalid={!!fieldErrors.firstName}
                      className={inputClass}
                    />
                  </div>

                  {fieldErrors.firstName && (
                    <p className="mt-1 text-[11px] text-red-600">
                      {t.invalidForm}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="taym-last-name"
                    className={labelClass}
                  >
                    {t.lastName}
                  </label>

                  <div className="relative">
                    <UserRound
                      size={17}
                      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#657264]"
                    />

                    <input
                      id="taym-last-name"
                      type="text"
                      autoComplete="family-name"
                      maxLength={80}
                      value={form.lastName}
                      disabled={step === "VERIFY"}
                      onChange={(event) =>
                        changeField("lastName", event.target.value)
                      }
                      placeholder={t.lastName}
                      aria-invalid={!!fieldErrors.lastName}
                      className={inputClass}
                    />
                  </div>

                  {fieldErrors.lastName && (
                    <p className="mt-1 text-[11px] text-red-600">
                      {t.invalidForm}
                    </p>
                  )}
                </div>
              </div>

              {/* PAYS */}

              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <span id="taym-country-label" className="text-[12px] font-bold">
                    {t.country}
                  </span>

                  {geoDetected && !countryTouched && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#558b13]">
                      <Globe2 size={12} />
                      {t.countryDetected}
                    </span>
                  )}
                </div>

                <div role="group" aria-labelledby="taym-country-label" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {countries.map((country) => (
                    <button key={country.code} type="button" disabled={step === "VERIFY"}
                      onClick={() => chooseCountry(country.code)}
                      aria-pressed={form.countryCode === country.code}
                      className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 text-center text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6ea80c] ${form.countryCode === country.code ? "border-[#75b315] bg-[#f1f9e7] text-[#315c0a]" : "border-[#d5ded0] bg-white text-[#172317]"}`}>
                      <span aria-hidden="true" className="text-xl leading-none">{country.flag}</span>
                      <span>{country.names[activeLocale]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* TÉLÉPHONE */}

              <div>
                <label
                  htmlFor="taym-phone"
                  className={labelClass}
                >
                  {t.phone}
                </label>

                <div className="flex gap-2" dir="ltr">
                  <div className="relative w-28.25 shrink-0">
                    <select
                      aria-label={t.phoneCountry}
                      value={form.phoneCountryCode}
                      disabled={step === "VERIFY"}
                      onChange={(event) =>
                        changeField(
                          "phoneCountryCode",
                          event.target.value as CountryCode
                        )
                      }
                      className="h-10.75 w-full appearance-none rounded-[9px] border border-[#d5ded0] bg-white pl-2.5 pr-7 text-[12px] font-bold outline-none focus:border-[#6ea80c]"
                    >
                      {countries.map((country) => (
                        <option
                          key={country.code}
                          value={country.code}
                        >
                          {country.flag} {country.dial}
                        </option>
                      ))}
                    </select>

                    <ChevronDown
                      size={14}
                      className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[#62725d]"
                    />
                  </div>

                  <div className="relative min-w-0 flex-1">
                    <Phone
                      size={16}
                      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#657264]"
                    />

                    <input
                      id="taym-phone"
                      type="tel"
                      autoComplete="tel-national"
                      inputMode="tel"
                      maxLength={40}
                      value={form.phone}
                      disabled={step === "VERIFY"}
                      onChange={(event) =>
                        changeField("phone", event.target.value)
                      }
                      placeholder="15123456789"
                      aria-invalid={!!fieldErrors.phone}
                      className={inputClass}
                    />
                  </div>
                </div>

                {fieldErrors.phone && (
                  <p className="mt-1 text-[11px] text-red-600">
                    {t.phoneInvalid}
                  </p>
                )}
              </div>

              {/* EMAIL */}

              <div>
                <label
                  htmlFor="taym-email"
                  className={labelClass}
                >
                  {t.email}
                </label>

                <div className="relative">
                  <Mail
                    size={17}
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#657264]"
                  />

                  <input
                    id="taym-email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    value={form.email}
                    disabled={step === "VERIFY"}
                    onChange={(event) =>
                      changeField("email", event.target.value)
                    }
                    placeholder="name@example.com"
                    aria-invalid={!!fieldErrors.email}
                    className={inputClass}
                    dir="ltr"
                  />
                </div>

                {fieldErrors.email && (
                  <p className="mt-1 text-[11px] text-red-600">
                    {t.invalidForm}
                  </p>
                )}
              </div>

              {/* MOT DE PASSE */}

              <div>
                <label
                  htmlFor="taym-password"
                  className={labelClass}
                >
                  {t.password}
                </label>

                <div className="relative">
                  <LockKeyhole
                    size={17}
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#657264]"
                  />

                  <input
                    id="taym-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    value={form.password}
                    disabled={step === "VERIFY"}
                    onChange={(event) =>
                      changeField("password", event.target.value)
                    }
                    placeholder={t.password}
                    aria-invalid={!!fieldErrors.password}
                    className={`${inputClass} pr-11`}
                  />

                  <button
                    type="button"
                    disabled={step === "VERIFY"}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onClick={() =>
                      setShowPassword((previous) => !previous)
                    }
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-[#677662] hover:text-[#397900]"
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>

                {fieldErrors.password && (
                  <p className="mt-1 text-[11px] text-red-600">
                    {t.passwordRule}
                  </p>
                )}
              </div>

              {/* CONFIRMATION */}

              <div>
                <label
                  htmlFor="taym-confirm-password"
                  className={labelClass}
                >
                  {t.confirmPassword}
                </label>

                <div className="relative">
                  <LockKeyhole
                    size={17}
                    className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#657264]"
                  />

                  <input
                    id="taym-confirm-password"
                    type={
                      showConfirmPassword ? "text" : "password"
                    }
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={128}
                    value={form.confirmPassword}
                    disabled={step === "VERIFY"}
                    onChange={(event) =>
                      changeField(
                        "confirmPassword",
                        event.target.value
                      )
                    }
                    placeholder={t.confirmPassword}
                    aria-invalid={
                      !!fieldErrors.confirmPassword
                    }
                    className={`${inputClass} pr-11`}
                  />

                  <button
                    type="button"
                    disabled={step === "VERIFY"}
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirmation"
                        : "Show confirmation"
                    }
                    onClick={() =>
                      setShowConfirmPassword(
                        (previous) => !previous
                      )
                    }
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-[#677662] hover:text-[#397900]"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>

                {fieldErrors.confirmPassword && (
                  <p className="mt-1 text-[11px] text-red-600">
                    {t.passwordMismatch}
                  </p>
                )}
              </div>

              {/* CONDITIONS */}

              <div className="space-y-2 pt-1">
                <label className="flex cursor-pointer items-start gap-2 text-xs leading-[1.4]">
                  <input
                    type="checkbox"
                    checked={form.acceptedTerms}
                    disabled={step === "VERIFY"}
                    onChange={(event) =>
                      changeField(
                        "acceptedTerms",
                        event.target.checked
                      )
                    }
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#579600]"
                  />

                  <span>
                    {t.terms}{" "}
                    <Link
                      href={translatedLink(
                        "/nutzungsbedingungen",
                        pathname
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-[#3c8100] underline"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {activeLocale === "de"
                        ? "Nutzungsbedingungen"
                        : activeLocale === "ar"
                          ? "الشروط"
                          : activeLocale === "tr"
                            ? "Koşullar"
                            : "Términos"}
                    </Link>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-2 text-[11px] leading-[1.4]">
                  <input
                    type="checkbox"
                    checked={form.acceptedPrivacy}
                    disabled={step === "VERIFY"}
                    onChange={(event) =>
                      changeField(
                        "acceptedPrivacy",
                        event.target.checked
                      )
                    }
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#579600]"
                  />

                  <span>
                    {t.privacy}{" "}
                    <Link
                      href={translatedLink(
                        "/datenschutz",
                        pathname
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-[#3c8100] underline"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {activeLocale === "de"
                        ? "Datenschutzrichtlinie"
                        : activeLocale === "ar"
                          ? "الخصوصية"
                          : activeLocale === "tr"
                            ? "Gizlilik politikası"
                            : "Privacidad"}
                    </Link>
                  </span>
                </label>
              </div>

              {/* ACTION INSCRIPTION */}

              {step === "REGISTER" && (
                <button
                  type="submit"
                  disabled={submitting}
                  className={buttonClass}
                >
                  {submitting ? (
                    <LoaderCircle
                      size={18}
                      className="animate-spin"
                    />
                  ) : (
                    <UserRoundPlus size={19} />
                  )}

                  <span>
                    {submitting ? t.processing : t.submit}
                  </span>

                  {!submitting && <ArrowRight size={18} />}
                </button>
              )}

              <div className="flex items-center justify-center gap-2 pt-1 text-center text-[11px]">
                <span className="text-[#52614c]">
                  {t.loginText}
                </span>

                <Link
                  href={translatedLink("/login", pathname)}
                  className="font-bold text-[#397900] underline underline-offset-2"
                >
                  {t.login}
                </Link>
              </div>
            </form>
          </section>

          {/* =================================================
              CARTE 2 : VÉRIFICATION

              Mobile : écran séparé
              PC : deuxième colonne
              ================================================= */}

          <section
            className={`${cardClass} ${
              step === "REGISTER" ? "hidden lg:block" : ""
            }`}
            aria-label={t.stepVerify}
          >
            <StepIndicator
              step={step === "VERIFY" ? "VERIFY" : "REGISTER"}
              labels={t}
            />

            <div className="mb-5 mt-6 flex flex-col items-center text-center">
              {/* Illustration simple, sans image externe */}

              <div className="relative flex h-25.5 w-37.5 items-center justify-center">
                <div className="absolute inset-[12px_5px] rounded-full bg-[#ecf9d8]" />

                <MailCheck
                  size={66}
                  strokeWidth={1.5}
                  className="relative z-10 text-[#346c03]"
                />

                <span className="absolute top-3 right-5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#8cca2a] text-white shadow-sm">
                  <Smartphone size={19} />
                </span>
              </div>

              <h2 className="mt-3 text-[19px] leading-tight font-black tracking-tight sm:text-[22px]">
                {t.verifyTitle}
              </h2>

              <span className="mt-2 h-0.75 w-12 rounded-full bg-[#76b90a]" />
              {!smsRequired && <p className="mt-3 text-sm text-[#52614c]">{emailOnlyCopy[activeLocale].instruction}</p>}
            </div>

            <form
              onSubmit={submitVerification}
              className="space-y-5"
            >
              {/* CODE SMS */}

              {smsRequired && <div>
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ecf8dc] text-[#4f8b09]">
                    <Smartphone size={18} />
                  </span>

                  <label className="text-[12px] font-extrabold">
                    {t.smsCode}
                  </label>

                  {smsVerified && (
                    <CheckCircle2
                      size={17}
                      className="ml-auto text-[#4f9200]"
                    />
                  )}
                </div>

                <OtpBoxes
                  label={t.smsCode}
                  value={smsCode}
                  onChange={setSmsCode}
                  disabled={
                    step !== "VERIFY" ||
                    verifying ||
                    smsVerified
                  }
                  autoComplete="one-time-code"
                />
              </div>}

              {/* CODE EMAIL */}

              <div>
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ecf8dc] text-[#4f8b09]">
                    <Mail size={18} />
                  </span>

                  <label className="text-[12px] font-extrabold">
                    {t.emailCode}
                  </label>

                  {emailVerified && (
                    <CheckCircle2
                      size={17}
                      className="ml-auto text-[#4f9200]"
                    />
                  )}
                </div>

                <OtpBoxes
                  label={t.emailCode}
                  value={emailCode}
                  onChange={setEmailCode}
                  disabled={
                    step !== "VERIFY" ||
                    verifying ||
                    emailVerified
                  }
                  autoComplete="one-time-code"
                />
              </div>

              {/* CONFIRMER */}

              <button
                type="submit"
                disabled={step !== "VERIFY" || verifying}
                className={buttonClass}
              >
                {verifying ? (
                  <LoaderCircle
                    size={19}
                    className="animate-spin"
                  />
                ) : (
                  <Check size={20} />
                )}

                <span>
                  {verifying
                    ? t.processing
                    : t.verifyButton}
                </span>

                {!verifying && <ArrowRight size={18} />}
              </button>

              {/* RENVOYER LES CODES */}

              {step === "VERIFY" && (
                <div className="space-y-3 border-t border-[#e4eadc] pt-4">
                  {smsRequired && !smsVerified && (
                    <button
                      type="button"
                      disabled={
                        !!resending || cooldown.SMS > 0
                      }
                      onClick={() => void resendCode("SMS")}
                      className="flex min-h-9 w-full items-center justify-center gap-2 text-[12px] font-bold text-[#3a7903] underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {resending === "SMS" ? (
                        <LoaderCircle
                          size={15}
                          className="animate-spin"
                        />
                      ) : (
                        <RefreshCw size={15} />
                      )}

                      {t.smsCode} — {t.resend}
                      {cooldown.SMS > 0 &&
                        ` (${cooldown.SMS}s)`}
                    </button>
                  )}

                  {!emailVerified && (
                    <button
                      type="button"
                      disabled={
                        !!resending || cooldown.EMAIL > 0
                      }
                      onClick={() => void resendCode("EMAIL")}
                      className="flex min-h-9 w-full items-center justify-center gap-2 text-[12px] font-bold text-[#3a7903] underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {resending === "EMAIL" ? (
                        <LoaderCircle
                          size={15}
                          className="animate-spin"
                        />
                      ) : (
                        <RefreshCw size={15} />
                      )}

                      {t.emailCode} — {t.resend}
                      {cooldown.EMAIL > 0 &&
                        ` (${cooldown.EMAIL}s)`}
                    </button>
                  )}
                </div>
              )}
            </form>
          </section>
        </div>

        {/* ===================================================
            MESSAGES DE RETOUR
            =================================================== */}

        {(error || notice) && (
          <div
            role={error ? "alert" : "status"}
            aria-live={error ? "assertive" : "polite"}
            className={`mx-auto mt-4 flex max-w-187.5 items-start gap-2 rounded-xl border px-4 py-3 text-[12px] font-medium ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-[#cce5ac] bg-[#f0f9e6] text-[#397900]"
            }`}
          >
            {error ? (
              <AlertCircle size={17} className="shrink-0" />
            ) : (
              <CheckCircle2 size={17} className="shrink-0" />
            )}

            <span>{error || notice}</span>
          </div>
        )}
      </div>
    </div>
  );
}
