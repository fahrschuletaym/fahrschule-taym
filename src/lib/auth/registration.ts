
import "server-only";

import {
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";



import {
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";


/* =========================================================
   FAHRSCHULE TAYM
   SERVICE D'INSCRIPTION

   Ce module réalise :
   - Validation des données
   - Gestion des cinq pays
   - Suggestion de pays par géolocalisation IP
   - Gestion des indicatifs
   - Validation des numéros
   - Normalisation des emails
   - Contrôle des consentements
   - Protection des mots de passe
   - Préparation des données pour PostgreSQL

   Utilisation :
   src/app/api/auth/register/route.ts

   Serveur uniquement.
   ========================================================= */

const scrypt = (password: string, salt: Buffer, length: number, options: { N: number; r: number; p: number; maxmem: number }) =>
  new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(password, salt, length, options, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });

/* =========================================================
   CONFIGURATION
   ========================================================= */

export const REGISTRATION_CONFIG = {
  DEFAULT_COUNTRY: "DE",
  MIN_PASSWORD_LENGTH: 12,
  MAX_PASSWORD_LENGTH: 128,
  MIN_NAME_LENGTH: 2,
  MAX_NAME_LENGTH: 80,
  MAX_EMAIL_LENGTH: 254,
  MAX_PHONE_INPUT_LENGTH: 40,
  MAX_INPUT_LENGTH: 512,
} as const;

/* =========================================================
   PAYS AUTORISÉS
   ========================================================= */

export const REGISTRATION_COUNTRIES = [
  {
    code: "DE",
    name: "Deutschland",
    flag: "🇩🇪",
    dialCode: "+49",
  },
  {
    code: "AT",
    name: "Österreich",
    flag: "🇦🇹",
    dialCode: "+43",
  },
  {
    code: "BE",
    name: "Belgien",
    flag: "🇧🇪",
    dialCode: "+32",
  },
  {
    code: "IT",
    name: "Italia",
    flag: "🇮🇹",
    dialCode: "+39",
  },
  {
    code: "ES",
    name: "España",
    flag: "🇪🇸",
    dialCode: "+34",
  },
] as const;

export type RegistrationCountry =
  (typeof REGISTRATION_COUNTRIES)[number]["code"];

export type RegistrationField =
  | "firstName"
  | "lastName"
  | "countryCode"
  | "phoneCountryCode"
  | "dialCode"
  | "phone"
  | "email"
  | "password"
  | "confirmPassword"
  | "acceptedTerms"
  | "acceptedPrivacy";

export type RegistrationErrors =
  Partial<Record<RegistrationField, string>>;

/* =========================================================
   TYPES DES DONNÉES
   ========================================================= */

export interface RegistrationInput {
  firstName: string;
  lastName: string;

  countryCode: RegistrationCountry;

  /**
   * Pays de l'indicatif téléphonique.
   * Peut différer du pays de résidence.
   */
  phoneCountryCode: RegistrationCountry;

  /**
   * Exemple : "+49".
   */
  dialCode: string;

  /**
   * Numéro national ou international.
   */
  phone: string;

  email: string;

  password: string;
  confirmPassword: string;

  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
}

export interface ValidatedRegistration {
  firstName: string;
  lastName: string;
  fullName: string;

  countryCode: RegistrationCountry;

  phoneCountryCode: RegistrationCountry;
  dialCode: string;
  phoneE164: string;

  email: string;

  /**
   * Conservé uniquement le temps de
   * calculer le hachage.
   * Ne doit jamais être enregistré en clair.
   */
  password: string;

  acceptedTerms: true;
  acceptedPrivacy: true;
}

export type RegistrationValidationResult =
  | {
      success: true;
      data: ValidatedRegistration;
      errors: RegistrationErrors;
    }
  | {
      success: false;
      data: null;
      errors: RegistrationErrors;
    };

export interface PreparedRegistration {
  firstName: string;
  lastName: string;
  fullName: string;

  countryCode: RegistrationCountry;
  phoneCountryCode: RegistrationCountry;
  dialCode: string;
  phoneE164: string;

  email: string;
  passwordHash: string;

  acceptedTermsAt: Date;
  acceptedPrivacyAt: Date;

  emailVerifiedAt: null;
  phoneVerifiedAt: null;

  status: "PENDING_VERIFICATION";
}

export type PrepareRegistrationResult =
  | {
      success: true;
      data: PreparedRegistration;
      errors: RegistrationErrors;
    }
  | {
      success: false;
      data: null;
      errors: RegistrationErrors;
    };

/* =========================================================
   FONCTIONS GÉNÉRALES
   ========================================================= */

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readString(
  value: unknown
): string {
  return typeof value === "string"
    ? value
    : "";
}

function normalizeName(
  value: string
): string {
  return value
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ");
}

function normalizeCountry(
  value: unknown
): string {
  return readString(value)
    .trim()
    .toUpperCase();
}

/* =========================================================
   PAYS
   ========================================================= */

export function isRegistrationCountry(
  value: unknown
): value is RegistrationCountry {
  if (typeof value !== "string") {
    return false;
  }

  return REGISTRATION_COUNTRIES.some(
    (country) => country.code === value
  );
}

export function getRegistrationCountry(
  countryCode: RegistrationCountry
) {
  return REGISTRATION_COUNTRIES.find(
    (country) => country.code === countryCode
  )!;
}

export function getRegistrationDialCode(
  countryCode: RegistrationCountry
): string {
  const internationalCode =
    getCountryCallingCode(
      countryCode as CountryCode
    );

  return `+${internationalCode}`;
}

/* =========================================================
   DÉTECTION DU PAYS PAR IP

   La détection dépend de l'hébergeur.

   Vercel :
   x-vercel-ip-country

   Cloudflare :
   cf-ipcountry

   Les en-têtes fournis directement
   par un navigateur ne doivent pas être
   considérés comme fiables.

   Configurer GEOIP_TRUSTED_PROVIDER
   uniquement sur un hébergement qui
   contrôle réellement ces en-têtes.
   ========================================================= */

export type TrustedGeoProvider =
  | "vercel"
  | "cloudflare";

export interface CountryDetection {
  countryCode: RegistrationCountry;
  detected: boolean;
  source: "VERCEL" | "CLOUDFLARE" | "DEFAULT";
}

export function detectRegistrationCountry(
  headers: Headers,
  provider?: TrustedGeoProvider | null
): CountryDetection {
  const defaultResult: CountryDetection = {
    countryCode:
      REGISTRATION_CONFIG.DEFAULT_COUNTRY,
    detected: false,
    source: "DEFAULT",
  };

  if (!provider) {
    return defaultResult;
  }

  let candidate: string | null = null;
  let source: CountryDetection["source"] =
    "DEFAULT";

  if (provider === "vercel") {
    candidate = headers.get(
      "x-vercel-ip-country"
    );

    source = "VERCEL";
  } else if (provider === "cloudflare") {
    candidate = headers.get("cf-ipcountry");

    source = "CLOUDFLARE";
  }

  const countryCode = normalizeCountry(
    candidate
  );

  if (!isRegistrationCountry(countryCode)) {
    return defaultResult;
  }

  return {
    countryCode,
    detected: true,
    source,
  };
}

/**
 * Fonction destinée à une route API Next.js.
 *
 * La variable d'environnement doit être
 * définie uniquement après avoir configuré
 * un hébergeur/proxy fiable.
 */
export function detectCountryFromRequest(
  request: Request
): CountryDetection {
  const provider =
    process.env.GEOIP_TRUSTED_PROVIDER;

  if (
    provider !== "vercel" &&
    provider !== "cloudflare"
  ) {
    return detectRegistrationCountry(
      request.headers,
      null
    );
  }

  return detectRegistrationCountry(
    request.headers,
    provider
  );
}

/* =========================================================
   VALIDATION DES NOMS

   Compatible avec :
   - Lettres latines
   - Accents
   - Lettres arabes
   - Lettres turques
   - Espaces
   - Tirets
   - Apostrophes
   ========================================================= */

export function validatePersonName(
  value: unknown
): {
  valid: boolean;
  normalized: string;
} {
  const normalized = normalizeName(
    readString(value)
  );

  const length = Array.from(normalized).length;

  const hasAllowedCharacters =
    /^[\p{L}\p{M}][\p{L}\p{M}\s'’.-]*$/u.test(
      normalized
    );

  return {
    valid:
      length >=
        REGISTRATION_CONFIG.MIN_NAME_LENGTH &&
      length <=
        REGISTRATION_CONFIG.MAX_NAME_LENGTH &&
      hasAllowedCharacters &&
      !/[.'’ -]{2,}/u.test(normalized) &&
      !/[.'’ -]$/u.test(normalized),

    normalized,
  };
}

/* =========================================================
   VALIDATION DES EMAILS
   ========================================================= */

export function normalizeEmail(
  value: unknown
): string {
  return readString(value)
    .trim()
    .normalize("NFC")
    .toLowerCase();
}

export function isValidRegistrationEmail(
  value: unknown
): boolean {
  const email = normalizeEmail(value);

  if (
    email.length === 0 ||
    email.length >
      REGISTRATION_CONFIG.MAX_EMAIL_LENGTH
  ) {
    return false;
  }

  if (/\s/u.test(email)) {
    return false;
  }

  if (!/^[^\s@]+@[^\s@]+$/u.test(email)) {
    return false;
  }

  const parts = email.split("@");

  if (parts.length !== 2) {
    return false;
  }

  const [local, domain] = parts;

  if (
    !local ||
    local.length > 64 ||
    !domain ||
    domain.length > 253
  ) {
    return false;
  }

  if (
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..")
  ) {
    return false;
  }

  if (
    domain.startsWith(".") ||
    domain.endsWith(".") ||
    domain.includes("..")
  ) {
    return false;
  }

  const labels = domain.split(".");

  if (labels.length < 2) {
    return false;
  }

  return labels.every(
    (label) =>
      label.length >= 1 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(
        label
      )
  );
}

/* =========================================================
   VALIDATION DES NUMÉROS DE TÉLÉPHONE

   Format de stockage : E.164

   Exemples :
   +4917...
   +4366...
   +3247...
   +3933...
   +346...
   ========================================================= */

export interface PhoneValidationResult {
  valid: boolean;
  phoneE164: string | null;
  countryCode: RegistrationCountry | null;
  dialCode: string | null;
}

export function validateRegistrationPhone(
  phoneInput: unknown,
  phoneCountryCode: RegistrationCountry,
  dialCode?: string
): PhoneValidationResult {
  const invalidResult: PhoneValidationResult = {
    valid: false,
    phoneE164: null,
    countryCode: null,
    dialCode: null,
  };

  if (!isRegistrationCountry(phoneCountryCode)) {
    return invalidResult;
  }

  const rawPhone = readString(phoneInput).trim();

  if (
    rawPhone.length === 0 ||
    rawPhone.length >
      REGISTRATION_CONFIG.MAX_PHONE_INPUT_LENGTH
  ) {
    return invalidResult;
  }

  /**
   * Accepte les espaces, tirets, parenthèses
   * et un éventuel + initial.
   *
   * Les lettres, extensions et autres
   * caractères sont refusés.
   */
  if (!/^\+?[\d\s().-]+$/u.test(rawPhone)) {
    return invalidResult;
  }

  const expectedDialCode =
    getRegistrationDialCode(phoneCountryCode);

  const selectedDialCode =
    dialCode?.trim() || expectedDialCode;

  /**
   * L'indicatif peut être modifié par
   * l'utilisateur via phoneCountryCode.
   *
   * Le code affiché et le pays choisi
   * doivent néanmoins rester cohérents.
   */
  if (selectedDialCode !== expectedDialCode) {
    return invalidResult;
  }

  try {
    const parsed = parsePhoneNumberFromString(
      rawPhone,
      phoneCountryCode as CountryCode
    );

    if (!parsed || !parsed.isValid()) {
      return invalidResult;
    }

    /**
     * Un numéro complet commençant par +
     * doit correspondre à l'indicatif
     * sélectionné.
     */
    if (
      `+${parsed.countryCallingCode}` !==
      expectedDialCode
    ) {
      return invalidResult;
    }

    /**
     * Évite qu'un numéro d'un autre pays
     * soit accepté avec un pays téléphonique
     * incohérent.
     */
    if (
      parsed.country &&
      parsed.country !== phoneCountryCode
    ) {
      return invalidResult;
    }

    const phoneE164 = String(parsed.number);

    if (
      !/^\+[1-9]\d{1,14}$/u.test(phoneE164)
    ) {
      return invalidResult;
    }

    return {
      valid: true,
      phoneE164,
      countryCode: phoneCountryCode,
      dialCode: expectedDialCode,
    };
  } catch {
    return invalidResult;
  }
}

/* =========================================================
   VALIDATION DES MOTS DE PASSE
   ========================================================= */

export function validateRegistrationPassword(
  password: unknown,
  context?: {
    email?: string;
    firstName?: string;
    lastName?: string;
  }
): {
  valid: boolean;
  reason: string | null;
} {
  if (typeof password !== "string") {
    return {
      valid: false,
      reason: "PASSWORD_REQUIRED",
    };
  }

  /**
   * Ne jamais modifier automatiquement
   * le mot de passe saisi.
   */
  const length = Array.from(password).length;

  if (
    length <
    REGISTRATION_CONFIG.MIN_PASSWORD_LENGTH
  ) {
    return {
      valid: false,
      reason: "PASSWORD_TOO_SHORT",
    };
  }

  if (
    length >
    REGISTRATION_CONFIG.MAX_PASSWORD_LENGTH
  ) {
    return {
      valid: false,
      reason: "PASSWORD_TOO_LONG",
    };
  }

  if (/[\u0000-\u001F\u007F]/u.test(password)) {
    return {
      valid: false,
      reason: "PASSWORD_INVALID_CHARACTERS",
    };
  }

  const simplified = password
    .toLocaleLowerCase()
    .normalize("NFC");

  const email = context?.email
    ? normalizeEmail(context.email)
    : "";

  const emailLocal = email.split("@")[0] || "";

  const firstName = context?.firstName
    ? normalizeName(context.firstName)
        .toLocaleLowerCase()
    : "";

  const lastName = context?.lastName
    ? normalizeName(context.lastName)
        .toLocaleLowerCase()
    : "";

  /**
   * Refuser les mots de passe trop liés
   * à l'identité du candidat.
   */
  const personalParts = [
    emailLocal,
    firstName,
    lastName,
  ].filter((part) => part.length >= 4);

  if (
    personalParts.some((part) =>
      simplified.includes(part)
    )
  ) {
    return {
      valid: false,
      reason: "PASSWORD_CONTAINS_PERSONAL_DATA",
    };
  }

  const weakPasswords = new Set([
    "password1234",
    "password12345",
    "123456789012",
    "123456789123",
    "qwerty123456",
    "admin12345678",
    "fahrschuletaym",
  ]);

  if (weakPasswords.has(simplified)) {
    return {
      valid: false,
      reason: "PASSWORD_TOO_COMMON",
    };
  }

  return {
    valid: true,
    reason: null,
  };
}

/* =========================================================
   HACHAGE DES MOTS DE PASSE

   Algorithme : scrypt
   Sel aléatoire : 16 octets
   Taille de clé : 64 octets

   Format enregistré :
   scrypt$v1$N$r$p$salt$hash
   ========================================================= */

const PASSWORD_SCRYPT = {
  N: 16384,
  r: 8,
  p: 1,
  keyLength: 64,
  saltLength: 16,
  maxmem: 64 * 1024 * 1024,
} as const;

export async function hashRegistrationPassword(
  password: string
): Promise<string> {
  if (
    typeof password !== "string" ||
    password.length === 0
  ) {
    throw new Error(
      "Mot de passe invalide."
    );
  }

  const salt = randomBytes(
    PASSWORD_SCRYPT.saltLength
  );

  const derived = (await scrypt(
    password,
    salt,
    PASSWORD_SCRYPT.keyLength,
    {
      N: PASSWORD_SCRYPT.N,
      r: PASSWORD_SCRYPT.r,
      p: PASSWORD_SCRYPT.p,
      maxmem: PASSWORD_SCRYPT.maxmem,
    }
  )) as Buffer;

  return [
    "scrypt",
    "v1",
    PASSWORD_SCRYPT.N,
    PASSWORD_SCRYPT.r,
    PASSWORD_SCRYPT.p,
    salt.toString("hex"),
    derived.toString("hex"),
  ].join("$");
}

/* =========================================================
   VÉRIFICATION DU MOT DE PASSE

   Utilisable ultérieurement par l'API login.
   ========================================================= */

export async function verifyRegistrationPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  if (
    typeof password !== "string" ||
    typeof storedHash !== "string"
  ) {
    return false;
  }

  const parts = storedHash.split("$");

  if (
    parts.length !== 7 ||
    parts[0] !== "scrypt" ||
    parts[1] !== "v1"
  ) {
    return false;
  }

  const N = Number(parts[2]);
  const r = Number(parts[3]);
  const p = Number(parts[4]);

  /**
   * Pour ce format v1, les paramètres
   * doivent être exactement ceux utilisés
   * à la création.
   *
   * Cela évite d'accepter des paramètres
   * coûteux fournis dans un hash modifié.
   */
  if (
    N !== PASSWORD_SCRYPT.N ||
    r !== PASSWORD_SCRYPT.r ||
    p !== PASSWORD_SCRYPT.p
  ) {
    return false;
  }

  const saltHex = parts[5];
  const hashHex = parts[6];

  if (
    !new RegExp(
      `^[a-f0-9]{${
        PASSWORD_SCRYPT.saltLength * 2
      }}$`,
      "i"
    ).test(saltHex) ||
    !new RegExp(
      `^[a-f0-9]{${
        PASSWORD_SCRYPT.keyLength * 2
      }}$`,
      "i"
    ).test(hashHex)
  ) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(
    hashHex,
    "hex"
  );

  const actual = (await scrypt(
    password,
    salt,
    PASSWORD_SCRYPT.keyLength,
    {
      N,
      r,
      p,
      maxmem: PASSWORD_SCRYPT.maxmem,
    }
  )) as Buffer;

  return timingSafeEqual(actual, expected);
}

/* =========================================================
   VALIDATION COMPLÈTE DU FORMULAIRE
   ========================================================= */

export function validateRegistrationInput(
  input: unknown
): RegistrationValidationResult {
  const errors: RegistrationErrors = {};

  if (!isRecord(input)) {
    return {
      success: false,
      data: null,
      errors: {
        firstName: "FORM_INVALID",
      },
    };
  }

  const firstNameResult = validatePersonName(
    input.firstName
  );

  const lastNameResult = validatePersonName(
    input.lastName
  );

  if (!firstNameResult.valid) {
    errors.firstName = "FIRST_NAME_INVALID";
  }

  if (!lastNameResult.valid) {
    errors.lastName = "LAST_NAME_INVALID";
  }

  /* Pays de résidence */

  const country = normalizeCountry(
    input.countryCode
  );

  if (!isRegistrationCountry(country)) {
    errors.countryCode = "COUNTRY_INVALID";
  }

  /* Pays de l'indicatif */

  const phoneCountryRaw = normalizeCountry(
    input.phoneCountryCode ?? country
  );

  if (
    !isRegistrationCountry(phoneCountryRaw)
  ) {
    errors.phoneCountryCode =
      "PHONE_COUNTRY_INVALID";
  }

  /* Email */

  const email = normalizeEmail(
    input.email
  );

  if (!isValidRegistrationEmail(email)) {
    errors.email = "EMAIL_INVALID";
  }

  /* Téléphone */

  let phoneE164 = "";
  let validDialCode = "";

  const dialCodeInput = readString(
    input.dialCode
  );

  if (
    isRegistrationCountry(phoneCountryRaw)
  ) {
    const expectedDial =
      getRegistrationDialCode(
        phoneCountryRaw
      );

    const actualDial =
      dialCodeInput.trim() || expectedDial;

    if (actualDial !== expectedDial) {
      errors.dialCode = "DIAL_CODE_INVALID";
    }

    const phoneResult =
      validateRegistrationPhone(
        input.phone,
        phoneCountryRaw,
        actualDial
      );

    if (!phoneResult.valid) {
      errors.phone = "PHONE_INVALID";
    } else {
      phoneE164 =
        phoneResult.phoneE164 || "";

      validDialCode =
        phoneResult.dialCode || "";
    }
  }

  /* Mot de passe */

  const password = readString(
    input.password
  );

  const passwordCheck =
    validateRegistrationPassword(
      input.password,
      {
        email,
        firstName:
          firstNameResult.normalized,
        lastName:
          lastNameResult.normalized,
      }
    );

  if (!passwordCheck.valid) {
    errors.password =
      passwordCheck.reason ||
      "PASSWORD_INVALID";
  }

  /* Confirmation du mot de passe */

  if (
    typeof input.confirmPassword !==
      "string" ||
    input.confirmPassword !== password
  ) {
    errors.confirmPassword =
      "PASSWORD_CONFIRMATION_MISMATCH";
  }

  /* Consentements obligatoires */

  if (input.acceptedTerms !== true) {
    errors.acceptedTerms =
      "TERMS_REQUIRED";
  }

  if (input.acceptedPrivacy !== true) {
    errors.acceptedPrivacy =
      "PRIVACY_REQUIRED";
  }

  /* Résultat */

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      data: null,
      errors,
    };
  }

  /**
   * Après la validation des champs,
   * les types sont garantis.
   */
  return {
    success: true,
    errors: {},
    data: {
      firstName:
        firstNameResult.normalized,

      lastName:
        lastNameResult.normalized,

      fullName: [
        firstNameResult.normalized,
        lastNameResult.normalized,
      ].join(" "),

      countryCode:
        country as RegistrationCountry,

      phoneCountryCode:
        phoneCountryRaw as RegistrationCountry,

      dialCode: validDialCode,
      phoneE164,

      email,
      password,

      acceptedTerms: true,
      acceptedPrivacy: true,
    },
  };
}

/* =========================================================
   PRÉPARATION SÉCURISÉE DE L'INSCRIPTION

   Cette fonction :
   1. Valide le formulaire.
   2. Protège le mot de passe.
   3. Prépare les données à stocker.
   4. N'active PAS encore le compte.

   Les codes email et SMS seront générés
   ensuite par verification.ts.
   ========================================================= */

export async function prepareRegistration(
  input: unknown,
  now: Date = new Date()
): Promise<PrepareRegistrationResult> {
  const validated =
    validateRegistrationInput(input);

  if (!validated.success) {
    return {
      success: false,
      data: null,
      errors: validated.errors,
    };
  }

  if (
    !(now instanceof Date) ||
    !Number.isFinite(now.getTime())
  ) {
    throw new Error(
      "Date d'inscription invalide."
    );
  }

  const values = validated.data;

  const passwordHash =
    await hashRegistrationPassword(
      values.password
    );

  /**
   * Le mot de passe original n'est pas
   * inclus dans l'objet retourné.
   */
  return {
    success: true,
    errors: {},
    data: {
      firstName: values.firstName,
      lastName: values.lastName,
      fullName: values.fullName,

      countryCode: values.countryCode,

      phoneCountryCode:
        values.phoneCountryCode,

      dialCode: values.dialCode,
      phoneE164: values.phoneE164,

      email: values.email,

      passwordHash,

      acceptedTermsAt:
        new Date(now.getTime()),

      acceptedPrivacyAt:
        new Date(now.getTime()),

      emailVerifiedAt: null,
      phoneVerifiedAt: null,

      status: "PENDING_VERIFICATION",
    },
  };
}

/* =========================================================
   DONNÉES PUBLIQUES POUR LE FORMULAIRE

   Ne contient aucune donnée sensible.
   ========================================================= */

export function getRegistrationFormConfig(
  detectedCountry?: RegistrationCountry
) {
  const selectedCountry =
    detectedCountry &&
    isRegistrationCountry(detectedCountry)
      ? detectedCountry
      : REGISTRATION_CONFIG.DEFAULT_COUNTRY;

  return {
    defaultCountry: selectedCountry,

    defaultDialCode:
      getRegistrationDialCode(
        selectedCountry
      ),

    countries:
      REGISTRATION_COUNTRIES.map(
        (country) => ({
          ...country,
        })
      ),

    password: {
      minLength:
        REGISTRATION_CONFIG.MIN_PASSWORD_LENGTH,

      maxLength:
        REGISTRATION_CONFIG.MAX_PASSWORD_LENGTH,
    },

    requiredFields: [
      "firstName",
      "lastName",
      "countryCode",
      "phone",
      "email",
      "password",
      "confirmPassword",
      "acceptedTerms",
      "acceptedPrivacy",
    ],
  };
}
