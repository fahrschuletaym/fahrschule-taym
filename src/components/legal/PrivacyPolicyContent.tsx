
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Cookie,
  Database,
  ExternalLink,
  FileLock2,
  FileText,
  Globe2,
  Info,
  LockKeyhole,
  Mail,
  Scale,
  Server,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  SERVICES_CONTACT,
  SERVICES_LINKS,
} from "@/config/services";

/* ==========================================================
   FAHRSCHULE TAYM
   Datenschutz / Privacy Policy

   - Germany as controller's stated location
   - Four project languages
   - Arabic RTL
   - Responsive desktop and mobile
   - No trackers or cookie consent created here
   - No unnecessary API or database requests

   IMPORTANT:
   This is a privacy-policy template adapted to the
   planned platform. Verify actual processing,
   providers, retention and legal requirements
   before publishing as a final legal declaration.
   ========================================================== */

type Locale = "de" | "ar" | "tr" | "es";

type Localized = Record<Locale, string>;

type SectionId =
  | "scope"
  | "controller"
  | "logs"
  | "accounts"
  | "applications"
  | "documents"
  | "contact"
  | "emails"
  | "newsletter"
  | "cookies"
  | "analytics"
  | "thirdparty"
  | "processors"
  | "transfers"
  | "security"
  | "retention"
  | "rights"
  | "complaints"
  | "changes";

type PolicySection = {
  id: SectionId;
  icon: React.ElementType<{ size?: number; className?: string }>;
  title: Localized;
  paragraphs: readonly Localized[];
};

/* ==========================================================
   1. OPERATOR

   Legacy email supplied in the original policy:
   info@fahrschuletaym.de

   Current project contact config:
   info@fahrschule-taym.de

   Use the central contact configuration below
   so links match the rest of the new site.
   Confirm the actual privacy contact before launch.
   ========================================================== */

const CONTACT = SERVICES_CONTACT;
const LINKS = SERVICES_LINKS;

const LEGAL = {
  authorityUrl:
    "https://www.datenschutz-berlin.de/",
  gdprUrl:
    "https://eur-lex.europa.eu/eli/reg/2016/679/oj",
  cookieLawUrl:
    "https://www.gesetze-im-internet.de/ttdsg/__25.html",
} as const;

/* ==========================================================
   2. INTERFACE TEXTS
   ========================================================== */

const UI = {
  de: {
    eyebrow: "DATENSCHUTZ & TRANSPARENZ",
    title: "Datenschutzerklärung",
    introduction:
      "Hier informieren wir darüber, wie personenbezogene Daten im Zusammenhang mit unserer Website, unseren Kontaktmöglichkeiten und den angebotenen digitalen Dienstleistungen verarbeitet werden.",
    updated: "Stand: 21. November 2026",
    information: "Informationen zum Datenschutz",
    navigation: "Inhalt dieser Erklärung",
    controller: "Verantwortlicher",
    telephone: "Telefon",
    email: "E-Mail",
    location: "Anschrift",
    principles: "Unsere Datenschutzgrundsätze",
    principleOne: "Zweckgebundene Verarbeitung",
    principleTwo: "Zugriff nur nach Berechtigung",
    principleThree: "Schutz vertraulicher Unterlagen",
    noticeTitle: "Wichtiger Hinweis",
    notice:
      "Diese Erklärung muss vor Veröffentlichung mit den tatsächlich eingesetzten Dienstleistern, Speicherfristen und Funktionen der Plattform abgeglichen werden. Nicht aktivierte Dienste dürfen nicht als bereits eingesetzt dargestellt werden.",
    contactTitle: "Fragen zum Datenschutz?",
    contactDescription:
      "Für Auskunft, Berichtigung, Löschung oder andere datenschutzbezogene Anliegen können Sie uns kontaktieren.",
    writeEmail: "E-Mail schreiben",
    contactPage: "Kontaktseite",
    legalPage: "Impressum",
    application: "Führerschein beantragen",
    officialSources: "Gesetzliche Grundlagen",
    gdpr: "Datenschutz-Grundverordnung",
    cookiesLaw: "§ 25 TDDDG",
    authority: "Berliner Datenschutzaufsicht",
    countryNote:
      "Die Datenschutzerklärung betrifft den angegebenen Verantwortlichen in Deutschland. Bei Dienstleistungen in weiteren Ländern können ergänzende nationale Anforderungen gelten.",
  },
  ar: {
    eyebrow: "الخصوصية والشفافية",
    title: "سياسة حماية البيانات",
    introduction:
      "نوضح هنا كيفية معالجة البيانات الشخصية عند استخدام موقعنا ووسائل الاتصال والخدمات الرقمية التي نقدمها.",
    updated: "آخر تحديث: 21 نوفمبر 2026",
    information: "معلومات حماية البيانات",
    navigation: "محتويات هذه السياسة",
    controller: "الجهة المسؤولة",
    telephone: "الهاتف",
    email: "البريد الإلكتروني",
    location: "العنوان",
    principles: "مبادئ حماية البيانات",
    principleOne: "استخدام البيانات لأغراض محددة",
    principleTwo: "تقييد الوصول وفق الصلاحيات",
    principleThree: "حماية المستندات السرية",
    noticeTitle: "تنبيه مهم",
    notice:
      "يجب مطابقة هذه السياسة مع مزودي الخدمات الفعليين وفترات الاحتفاظ والوظائف النشطة قبل نشرها. لا ينبغي عرض الخدمات غير المفعلة كما لو كانت مستخدمة فعلياً.",
    contactTitle: "هل لديك سؤال عن الخصوصية؟",
    contactDescription:
      "يمكنك التواصل معنا لطلب الوصول إلى بياناتك أو تصحيحها أو حذفها أو ممارسة حقوقك الأخرى.",
    writeEmail: "إرسال بريد إلكتروني",
    contactPage: "صفحة الاتصال",
    legalPage: "البيانات القانونية",
    application: "طلب رخصة القيادة",
    officialSources: "الأسس القانونية",
    gdpr: "اللائحة العامة لحماية البيانات",
    cookiesLaw: "المادة 25 من TDDDG",
    authority: "هيئة حماية البيانات في برلين",
    countryNote:
      "تخص هذه السياسة الجهة المسؤولة في ألمانيا. وقد تنطبق متطلبات وطنية إضافية على الخدمات في الدول الأخرى.",
  },
  tr: {
    eyebrow: "VERİ KORUMA VE ŞEFFAFLIK",
    title: "Gizlilik Politikası",
    introduction:
      "Web sitemiz, iletişim kanallarımız ve dijital hizmetlerimiz kapsamında kişisel verilerin nasıl işlendiğini açıklıyoruz.",
    updated: "Güncelleme: 21 Kasım 2026",
    information: "Veri koruma bilgileri",
    navigation: "Politika içeriği",
    controller: "Veri sorumlusu",
    telephone: "Telefon",
    email: "E-posta",
    location: "Adres",
    principles: "Veri koruma ilkelerimiz",
    principleOne: "Belirli amaçlarla işleme",
    principleTwo: "Yetkiye dayalı erişim",
    principleThree: "Gizli belgelerin korunması",
    noticeTitle: "Önemli bilgi",
    notice:
      "Yayımlanmadan önce bu politika, gerçekten kullanılan hizmet sağlayıcıları, saklama süreleri ve etkin işlevlerle karşılaştırılmalıdır. Etkin olmayan hizmetler kullanılıyormuş gibi gösterilmemelidir.",
    contactTitle: "Gizlilik hakkında sorunuz mu var?",
    contactDescription:
      "Verilere erişim, düzeltme, silme ve diğer haklarınız için bizimle iletişime geçebilirsiniz.",
    writeEmail: "E-posta gönder",
    contactPage: "İletişim sayfası",
    legalPage: "Yasal bildirim",
    application: "Ehliyet başvurusu",
    officialSources: "Hukuki kaynaklar",
    gdpr: "Genel Veri Koruma Tüzüğü",
    cookiesLaw: "TDDDG § 25",
    authority: "Berlin veri koruma makamı",
    countryNote:
      "Bu politika Almanya'daki belirtilen veri sorumlusunu kapsar. Diğer ülkelerdeki hizmetlere ek ulusal yükümlülükler uygulanabilir.",
  },
  es: {
    eyebrow: "PRIVACIDAD Y TRANSPARENCIA",
    title: "Política de privacidad",
    introduction:
      "Explicamos cómo se tratan los datos personales al utilizar nuestro sitio web, nuestros canales de contacto y los servicios digitales ofrecidos.",
    updated: "Actualización: 21 de noviembre de 2026",
    information: "Información sobre privacidad",
    navigation: "Contenido de esta política",
    controller: "Responsable del tratamiento",
    telephone: "Teléfono",
    email: "Correo electrónico",
    location: "Dirección",
    principles: "Nuestros principios",
    principleOne: "Tratamiento para fines determinados",
    principleTwo: "Acceso según autorizaciones",
    principleThree: "Protección de documentos confidenciales",
    noticeTitle: "Aviso importante",
    notice:
      "Antes de publicarse, esta política debe contrastarse con los proveedores, plazos de conservación y funciones realmente activos. No deben presentarse servicios inactivos como si estuvieran en uso.",
    contactTitle: "¿Tiene preguntas sobre privacidad?",
    contactDescription:
      "Puede contactar para solicitar acceso, rectificación, supresión u otros derechos de protección de datos.",
    writeEmail: "Enviar correo",
    contactPage: "Página de contacto",
    legalPage: "Aviso legal",
    application: "Solicitar permiso",
    officialSources: "Bases legales",
    gdpr: "Reglamento General de Protección de Datos",
    cookiesLaw: "Artículo 25 TDDDG",
    authority: "Autoridad de protección de datos de Berlín",
    countryNote:
      "Esta política se refiere al responsable indicado en Alemania. Para servicios en otros países pueden existir requisitos nacionales adicionales.",
  },
} as const;

/* ==========================================================
   3. COMPLETE POLICY CONTENT
   ========================================================== */

const SECTIONS: readonly PolicySection[] = [
  {
    id: "scope",
    icon: Globe2,
    title: {
      de: "1. Geltungsbereich und Rechtsgrundlagen",
      ar: "1. نطاق التطبيق والأسس القانونية",
      tr: "1. Kapsam ve hukuki dayanaklar",
      es: "1. Ámbito de aplicación y bases jurídicas",
    },
    paragraphs: [
      {
        de: "Diese Erklärung beschreibt die Verarbeitung personenbezogener Daten bei der Nutzung der Website Fahrschule TAYM und, soweit tatsächlich bereitgestellt, der digitalen Registrierung, Führerscheinanträge und Kandidatenverwaltung. Maßgeblich sind insbesondere die DSGVO, das BDSG und für den Zugriff auf Endgeräte § 25 TDDDG.",
        ar: "توضح هذه السياسة معالجة البيانات الشخصية عند استخدام موقع Fahrschule TAYM، وعند تفعيل التسجيل الرقمي وطلبات رخص القيادة وإدارة حسابات المرشحين. وتطبق خصوصاً اللائحة الأوروبية لحماية البيانات والقانون الألماني BDSG والمادة 25 من TDDDG.",
        tr: "Bu politika, Fahrschule TAYM web sitesi ile kullanıma sunulmuşsa dijital kayıt, ehliyet başvuruları ve aday yönetimi kapsamındaki kişisel veri işlemeyi açıklar. Özellikle GDPR, Alman BDSG ve cihaz erişimi için TDDDG § 25 uygulanır.",
        es: "Esta política describe el tratamiento de datos en Fahrschule TAYM y, cuando estén habilitados, el registro digital, las solicitudes de permiso y la gestión de candidatos. Son aplicables especialmente el RGPD, la ley alemana BDSG y el artículo 25 TDDDG.",
      },
      {
        de: "Abhängig vom konkreten Vorgang kommen Art. 6 Abs. 1 lit. b DSGVO (Vertrag oder vorvertragliche Maßnahmen), lit. c (rechtliche Pflicht), lit. f (berechtigte Interessen) oder lit. a (Einwilligung) als Rechtsgrundlage in Betracht. Besondere Kategorien personenbezogener Daten erfordern zusätzlich eine passende Grundlage nach Art. 9 DSGVO.",
        ar: "بحسب نوع المعالجة، قد يكون الأساس القانوني تنفيذ عقد أو إجراءات سابقة للعقد، أو التزاماً قانونياً، أو مصلحة مشروعة، أو موافقة الشخص وفق المادة 6 من اللائحة. وتحتاج البيانات الحساسة إلى أساس إضافي مناسب وفق المادة 9.",
        tr: "İşleme faaliyetine göre GDPR 6(1)(b) sözleşme, (c) yasal yükümlülük, (f) meşru menfaat veya (a) rıza dayanak olabilir. Özel nitelikli veriler için ayrıca GDPR 9. maddeye uygun bir koşul gerekir.",
        es: "Según el tratamiento, podrán aplicarse las bases del artículo 6.1 RGPD: contrato, obligación legal, interés legítimo o consentimiento. Los datos de categorías especiales requieren además una condición adecuada del artículo 9.",
      },
    ],
  },
  {
    id: "controller",
    icon: UserRound,
    title: {
      de: "2. Verantwortlicher und Kontakt",
      ar: "2. الجهة المسؤولة ووسائل الاتصال",
      tr: "2. Veri sorumlusu ve iletişim",
      es: "2. Responsable y contacto",
    },
    paragraphs: [
      {
        de: "Verantwortlicher für die hier beschriebenen Verarbeitungsvorgänge ist der im Impressum bezeichnete Betreiber der Fahrschule TAYM, Ernststr. 57, 13509 Berlin. Kontaktangaben finden Sie oben auf dieser Seite und im Impressum. Die rechtliche Unternehmensform und eine gegebenenfalls benannte Datenschutzbeauftragte oder ein Datenschutzbeauftragter sind vor Veröffentlichung zu prüfen.",
        ar: "الجهة المسؤولة هي مشغل Fahrschule TAYM المذكور في البيانات القانونية، Ernststr. 57, 13509 Berlin. تتوفر وسائل الاتصال في هذه الصفحة. يجب التحقق قبل النشر من الشكل القانوني ومن وجود مسؤول معين لحماية البيانات إن كان مطلوباً.",
        tr: "Veri sorumlusu, yasal bildirimde gösterilen Fahrschule TAYM işletmecisidir: Ernststr. 57, 13509 Berlin. İletişim bilgileri bu sayfada bulunur. Hukuki şirket türü ve gerekiyorsa atanmış veri koruma görevlisi yayımdan önce doğrulanmalıdır.",
        es: "El responsable es el operador de Fahrschule TAYM identificado en el aviso legal, Ernststr. 57, 13509 Berlín. Los datos de contacto figuran en esta página. Antes de publicar debe verificarse la forma jurídica y, si procede, la designación de un delegado de protección de datos.",
      },
    ],
  },
  {
    id: "logs",
    icon: Server,
    title: {
      de: "3. Zugriffsdaten und Server-Logfiles",
      ar: "3. بيانات الوصول وسجلات الخادم",
      tr: "3. Erişim verileri ve sunucu günlükleri",
      es: "3. Datos de acceso y registros del servidor",
    },
    paragraphs: [
      {
        de: "Beim Aufruf der Website können aus technischen Gründen Informationen verarbeitet werden: IP-Adresse, Datum und Uhrzeit, angefragte URL, HTTP-Status, Browser, Betriebssystem und gegebenenfalls Referrer. Die konkrete Protokollierung hängt vom eingesetzten Hosting- und Sicherheitsdienst ab.",
        ar: "عند زيارة الموقع قد تتم معالجة عنوان IP وتاريخ ووقت الزيارة وعنوان الصفحة وحالة الطلب ونوع المتصفح ونظام التشغيل والموقع المُحيل، وذلك حسب نظام الاستضافة والحماية المستخدم.",
        tr: "Siteye erişimde teknik olarak IP adresi, zaman, istenen URL, HTTP durumu, tarayıcı, işletim sistemi ve yönlendiren sayfa işlenebilir. Gerçek kayıt kapsamı barındırma ve güvenlik sağlayıcısına bağlıdır.",
        es: "Al acceder al sitio pueden tratarse la IP, fecha y hora, URL solicitada, estado HTTP, navegador, sistema operativo y página de referencia. El registro concreto depende del alojamiento y servicio de seguridad utilizados.",
      },
      {
        de: "Zwecke sind die technische Bereitstellung, Fehleranalyse und Abwehr von Angriffen. Soweit einschlägig, stützen wir uns auf Art. 6 Abs. 1 lit. f DSGVO. Die tatsächlichen Speicherfristen des Hosting-Anbieters müssen ergänzend angegeben werden.",
        ar: "تُستخدم هذه البيانات لتشغيل الموقع ومعالجة الأخطاء والحماية من الهجمات. وقد تستند المعالجة إلى المصلحة المشروعة وفق المادة 6(1)(f). يجب تحديد مدة الاحتفاظ الفعلية لدى مزود الاستضافة.",
        tr: "Amaçlar teknik işletim, hata analizi ve saldırılara karşı korunmadır. Uygun olduğu ölçüde GDPR 6(1)(f) uygulanır. Hosting sağlayıcısının gerçek saklama süresi ayrıca belirtilmelidir.",
        es: "Las finalidades son el funcionamiento técnico, la detección de errores y la seguridad. Cuando corresponda, se aplica el artículo 6.1.f RGPD. Deben indicarse los plazos reales de conservación del proveedor.",
      },
    ],
  },
  {
    id: "accounts",
    icon: LockKeyhole,
    title: {
      de: "4. Registrierung, Benutzerkonten und Verifizierung",
      ar: "4. التسجيل والحسابات والتحقق",
      tr: "4. Kayıt, kullanıcı hesapları ve doğrulama",
      es: "4. Registro, cuentas y verificación",
    },
    paragraphs: [
      {
        de: "Wenn die Kontofunktion aktiv ist, verarbeiten wir die zur Registrierung und Verwaltung erforderlichen Angaben, insbesondere Namen, E-Mail-Adresse, Telefonnummer, Land, Kontostatus und Zeitpunkte der Verifizierung. Zur Bestätigung können zeitlich begrenzte Codes per E-Mail oder SMS versandt werden. Passwörter sind ausschließlich in geeigneter kryptografisch gesicherter Form zu speichern.",
        ar: "عند تفعيل الحسابات نعالج بيانات التسجيل والإدارة مثل الاسم والبريد الإلكتروني ورقم الهاتف والدولة وحالة الحساب ومواعيد التحقق. وقد تُرسل رموز مؤقتة عبر البريد أو SMS. يجب تخزين كلمات المرور بشكل آمن باستخدام التشفير المناسب لتجزئتها.",
        tr: "Hesap özelliği etkinse ad, e-posta, telefon, ülke, hesap durumu ve doğrulama zamanı gibi bilgileri işleriz. Geçici doğrulama kodları e-posta veya SMS ile gönderilebilir. Şifreler uygun kriptografik yöntemlerle güvenli biçimde saklanmalıdır.",
        es: "Si se habilitan las cuentas, tratamos nombre, correo, teléfono, país, estado de cuenta y fechas de verificación. Pueden enviarse códigos temporales por email o SMS. Las contraseñas deben almacenarse mediante métodos criptográficos adecuados.",
      },
      {
        de: "Die Verarbeitung dient der Einrichtung und Absicherung des Benutzerkontos sowie der Durchführung angefragter Leistungen (Art. 6 Abs. 1 lit. b DSGVO); notwendige Sicherheitsmaßnahmen können zusätzlich auf berechtigte Interessen gestützt werden.",
        ar: "تهدف المعالجة إلى إنشاء الحساب وتأمينه وتقديم الخدمات المطلوبة وفق المادة 6(1)(b)، وقد تستند إجراءات الأمان الضرورية أيضاً إلى المصلحة المشروعة.",
        tr: "İşleme, hesabın oluşturulması ve güvenliği ile istenen hizmetlerin sunulmasına dayanır (GDPR 6(1)(b)); gerekli güvenlik tedbirleri meşru menfaate de dayanabilir.",
        es: "El tratamiento permite crear y proteger la cuenta y prestar los servicios solicitados (artículo 6.1.b RGPD); ciertas medidas de seguridad pueden basarse además en el interés legítimo.",
      },
    ],
  },
  {
    id: "applications",
    icon: ClipboardListIcon,
    title: {
      de: "5. Führerscheinanträge und Ausbildungsdaten",
      ar: "5. طلبات الرخص وبيانات التدريب",
      tr: "5. Ehliyet başvuruları ve eğitim verileri",
      es: "5. Solicitudes y datos de formación",
    },
    paragraphs: [
      {
        de: "Im Rahmen eines Führerscheinantrags können wir Name, Geburtsdatum, Anschrift, Aufenthaltsland, gewünschte Führerscheinklasse, Bearbeitungsstatus, Ausbildungsinformationen und Angaben zu eingereichten Unterlagen verarbeiten. Erforderlichkeit und Umfang richten sich nach der konkreten Leistung und dem jeweiligen Land.",
        ar: "في طلبات رخص القيادة قد نعالج الاسم وتاريخ الميلاد والعنوان ودولة الإقامة والفئة المطلوبة وحالة الطلب ومعلومات التدريب والمستندات المقدمة. ويعتمد النطاق على الخدمة والدولة.",
        tr: "Ehliyet başvurularında ad, doğum tarihi, adres, ikamet ülkesi, istenen ehliyet sınıfı, başvuru durumu, eğitim bilgileri ve belgeler işlenebilir. Kapsam, hizmete ve ülkeye göre değişir.",
        es: "En solicitudes de permiso podemos tratar nombre, fecha de nacimiento, dirección, país de residencia, categoría solicitada, estado del expediente, datos formativos y documentos. El alcance depende del servicio y del país.",
      },
      {
        de: "Diese Daten dienen der Prüfung und Bearbeitung des Antrags, der Kommunikation und gegebenenfalls der Vorbereitung behördlicher Verfahren. Eine Weitergabe an Fahrschulen, Prüfstellen, Behörden oder weitere Stellen erfolgt nur, soweit dafür eine rechtliche Grundlage besteht und sie für den jeweiligen Vorgang erforderlich ist.",
        ar: "تستخدم البيانات لمراجعة الطلب ومعالجته والتواصل والتحضير للإجراءات الرسمية عند الحاجة. ولا تتم مشاركتها مع مدارس أخرى أو جهات امتحان أو سلطات إلا بوجود أساس قانوني وحاجة فعلية.",
        tr: "Veriler başvuruyu değerlendirmek, yürütmek, iletişim kurmak ve gerektiğinde resmî işlemlere hazırlanmak için kullanılır. Sürücü kursları, sınav kuruluşları veya makamlarla paylaşım ancak uygun hukuki dayanak ve gereklilik varsa yapılır.",
        es: "Los datos sirven para revisar y tramitar solicitudes, comunicarse y, cuando proceda, preparar procedimientos administrativos. Solo se compartirán con autoescuelas, entidades examinadoras o autoridades si existe base jurídica y necesidad.",
      },
    ],
  },
  {
    id: "documents",
    icon: FileLock2,
    title: {
      de: "6. Ausweisdokumente und vertrauliche Nachweise",
      ar: "6. وثائق الهوية والمستندات السرية",
      tr: "6. Kimlik belgeleri ve gizli evraklar",
      es: "6. Identidad y documentos confidenciales",
    },
    paragraphs: [
      {
        de: "Soweit eine Upload-Funktion bereitgestellt wird, können unter anderem Ausweisdokumente, Adressnachweise, Passbilder, Führerscheine, Sehtest- und Erste-Hilfe-Nachweise sowie gegebenenfalls medizinische Bescheinigungen verarbeitet werden. Wir sollen nur die tatsächlich erforderlichen Unterlagen anfordern und den Zugriff auf autorisierte Personen beschränken.",
        ar: "عند تفعيل رفع الملفات قد تشمل الوثائق بطاقات الهوية وإثبات العنوان والصور الشخصية والرخص السابقة وشهادات النظر والإسعافات الأولية وربما مستندات طبية. يجب طلب الوثائق الضرورية فقط وقصر الوصول على المخولين.",
        tr: "Belge yükleme özelliği etkinse kimlikler, adres kanıtları, biyometrik fotoğraflar, mevcut ehliyetler, göz testi, ilk yardım ve gerekirse sağlık belgeleri işlenebilir. Yalnızca gerekli belgeler istenmeli ve erişim yetkililerle sınırlandırılmalıdır.",
        es: "Si se activa la carga de archivos, pueden tratarse documentos de identidad, domicilio, fotografías, permisos anteriores, certificados visuales, primeros auxilios y, en su caso, informes médicos. Solo deben solicitarse los necesarios y limitarse el acceso al personal autorizado.",
      },
      {
        de: "Gesundheitsangaben können besondere Kategorien personenbezogener Daten nach Art. 9 DSGVO betreffen. Vor deren Erhebung sind eine konkrete Rechtsgrundlage, die Erforderlichkeit und geeignete Schutzmaßnahmen festzulegen. Dokumente dürfen nicht öffentlich zugänglich gespeichert werden.",
        ar: "قد تُعد البيانات الصحية من الفئات الخاصة وفق المادة 9 من اللائحة. قبل جمعها يجب تحديد الأساس القانوني والحاجة الفعلية والتدابير الأمنية. لا يجوز تخزين المستندات في مساحة عامة.",
        tr: "Sağlık bilgileri GDPR 9. madde kapsamında özel nitelikli veri olabilir. Toplanmadan önce açık hukuki koşul, gereklilik ve uygun koruma belirlenmelidir. Belgeler herkese açık depolamada tutulmamalıdır.",
        es: "Los datos sanitarios pueden ser categorías especiales del artículo 9 RGPD. Antes de recogerlos debe determinarse la condición jurídica, necesidad y protección adecuadas. Los documentos no deben almacenarse públicamente.",
      },
    ],
  },
  {
    id: "contact",
    icon: Mail,
    title: {
      de: "7. Kontaktaufnahme und Anfragen",
      ar: "7. التواصل والاستفسارات",
      tr: "7. İletişim ve talepler",
      es: "7. Contacto y consultas",
    },
    paragraphs: [
      {
        de: "Bei einer Kontaktaufnahme per E-Mail oder Telefon verarbeiten wir die mitgeteilten Kontaktdaten und Nachrichten, um das Anliegen zu beantworten. Das derzeit für die Kontaktseite vorgesehene Formular öffnet lediglich das E-Mail-Programm der nutzenden Person; es speichert die Nachricht nicht automatisch in einer eigenen Kontaktdatenbank.",
        ar: "عند التواصل عبر البريد أو الهاتف نعالج بيانات الاتصال والرسائل للرد. نموذج الاتصال المخطط يفتح تطبيق البريد لدى المستخدم ولا يخزن الرسالة تلقائياً في قاعدة بيانات خاصة بالموقع.",
        tr: "E-posta veya telefonla iletişimde verilen bilgileri talebi yanıtlamak için işleriz. Mevcut iletişim formu kullanıcının e-posta uygulamasını açar; mesajı otomatik olarak ayrı bir iletişim veritabanına kaydetmez.",
        es: "Al contactar por correo o teléfono tratamos los datos y mensajes para responder. El formulario previsto abre la aplicación de correo de la persona; no guarda automáticamente el mensaje en una base de datos propia.",
      },
    ],
  },
  {
    id: "emails",
    icon: SendIcon,
    title: {
      de: "8. Transaktions-E-Mails und SMS",
      ar: "8. رسائل البريد وSMS المتعلقة بالحساب",
      tr: "8. İşlem e-postaları ve SMS",
      es: "8. Correos transaccionales y SMS",
    },
    paragraphs: [
      {
        de: "Sofern die Funktionen aktiviert sind, können wir E-Mails oder SMS zur Kontoverifizierung, Antragsbestätigung, Statusinformation und Sicherheit versenden. Hierfür können E-Mail- oder SMS-Dienstleister die erforderlichen Kontaktdaten und Nachrichteninhalte im Auftrag verarbeiten. Die tatsächlich eingesetzten Anbieter und gegebenenfalls internationale Datenübermittlungen müssen vor dem Produktivbetrieb benannt werden.",
        ar: "عند تفعيل هذه الوظائف قد نرسل رسائل البريد وSMS للتحقق من الحساب وتأكيد الطلبات وتحديث الحالة والأمان. وقد يعالج مزودو الإرسال بيانات الاتصال ومحتوى الرسالة نيابة عنا. يجب تحديد المزودين الفعليين والتحويلات الدولية قبل التشغيل.",
        tr: "İşlevler etkinse hesap doğrulama, başvuru onayı, durum bildirimi ve güvenlik için e-posta veya SMS gönderilebilir. Hizmet sağlayıcıları gerekli iletişim ve mesaj bilgilerini bizim adımıza işleyebilir. Gerçek sağlayıcılar ve uluslararası aktarımlar canlı kullanımdan önce açıklanmalıdır.",
        es: "Si se habilitan estas funciones, pueden enviarse emails o SMS para verificación, confirmaciones, estados y seguridad. Los proveedores podrían tratar datos de contacto y mensajes por encargo. Antes de operar deben identificarse proveedores reales y transferencias internacionales.",
      },
    ],
  },
  {
    id: "newsletter",
    icon: BookOpen,
    title: {
      de: "9. Newsletter und werbliche Kommunikation",
      ar: "9. النشرة البريدية والرسائل التسويقية",
      tr: "9. Bülten ve pazarlama iletişimi",
      es: "9. Boletines y comunicaciones comerciales",
    },
    paragraphs: [
      {
        de: "Die frühere Website beschrieb einen Newsletter. Für die neue Plattform ist dessen tatsächlicher Betrieb noch nicht bestätigt. Falls ein Newsletter eingeführt wird, informieren wir vor der Anmeldung über Zweck, Versanddienstleister und Datenverarbeitung und holen, soweit erforderlich, eine nachweisbare Einwilligung ein. Ein Widerruf muss jederzeit möglich sein.",
        ar: "ذكر الموقع القديم نشرة بريدية، لكن لم يتم تأكيد تفعيلها في المنصة الجديدة. عند إطلاقها يجب توضيح الغرض ومزود الإرسال والحصول على الموافقة المطلوبة وتوفير إمكانية سحبها في أي وقت.",
        tr: "Eski sitede bülten yer alıyordu; yeni platformda etkin olup olmadığı doğrulanmamıştır. Başlatılırsa amaç, sağlayıcı ve veri işleme önceden açıklanmalı, gerektiğinde kayıtlı rıza alınmalı ve her zaman geri çekilebilmelidir.",
        es: "El sitio anterior mencionaba un boletín, pero no se ha confirmado su activación en la nueva plataforma. Si se incorpora, se informará sobre finalidad y proveedor, se obtendrá el consentimiento exigible y podrá retirarse en cualquier momento.",
      },
    ],
  },
  {
    id: "cookies",
    icon: Cookie,
    title: {
      de: "10. Cookies und lokale Speicherung",
      ar: "10. ملفات تعريف الارتباط والتخزين المحلي",
      tr: "10. Çerezler ve yerel depolama",
      es: "10. Cookies y almacenamiento local",
    },
    paragraphs: [
      {
        de: "Die Website kann technisch notwendige Cookies oder lokale Speicherfunktionen für Anmeldesitzungen, Sicherheitszwecke und die Sprachauswahl nutzen. Im Projekt ist die Speicherung der gewählten Sprache vorgesehen. Die endgültige Liste tatsächlich verwendeter Technologien ist vor Veröffentlichung zu prüfen.",
        ar: "قد يستخدم الموقع ملفات تعريف الارتباط الضرورية والتخزين المحلي للجلسات والأمان واختيار اللغة. يتضمن المشروع حفظ اللغة المختارة. يجب مراجعة القائمة النهائية للتقنيات المستخدمة قبل النشر.",
        tr: "Site, oturumlar, güvenlik ve dil seçimi için teknik olarak gerekli çerezler veya yerel depolama kullanabilir. Projede seçilen dilin saklanması öngörülür. Kullanılan teknolojilerin son listesi yayımdan önce doğrulanmalıdır.",
        es: "El sitio puede usar cookies necesarias o almacenamiento local para sesiones, seguridad e idioma. El proyecto contempla guardar el idioma seleccionado. La lista definitiva de tecnologías debe comprobarse antes de publicar.",
      },
      {
        de: "Für das Speichern oder Auslesen von Informationen auf Endgeräten gilt § 25 TDDDG. Nicht unbedingt erforderliche Technologien dürfen grundsätzlich erst nach wirksamer Einwilligung eingesetzt werden. Eine Datenschutzerklärung allein ersetzt keine gegebenenfalls erforderliche Einwilligungsverwaltung.",
        ar: "يخضع تخزين المعلومات أو قراءتها على جهاز المستخدم للمادة 25 من TDDDG. والتقنيات غير الضرورية تتطلب عادة موافقة صالحة مسبقة. ولا تُغني سياسة الخصوصية وحدها عن نظام إدارة الموافقة عند الحاجة.",
        tr: "Cihazlara bilgi yazılması veya okunması TDDDG § 25 kapsamındadır. Zorunlu olmayan teknolojiler genel olarak geçerli rıza sonrasında kullanılabilir. Gizlilik politikası gerekli onay yönetiminin yerini tutmaz.",
        es: "El almacenamiento o acceso a información del dispositivo se rige por el artículo 25 TDDDG. Las tecnologías no estrictamente necesarias requieren normalmente consentimiento previo válido. Esta política no sustituye un sistema de consentimiento cuando resulte obligatorio.",
      },
    ],
  },
  {
    id: "analytics",
    icon: Database,
    title: {
      de: "11. Webanalyse und Google Analytics",
      ar: "11. تحليل الزيارات وGoogle Analytics",
      tr: "11. Web analizi ve Google Analytics",
      es: "11. Analítica web y Google Analytics",
    },
    paragraphs: [
      {
        de: "Die alte Datenschutzerklärung enthält Angaben zu Google Analytics. Daraus lässt sich nicht ableiten, dass Google Analytics auf der neuen Website aktiv ist. Vor einer Aktivierung sind die konkreten Funktionen, Empfänger, Rechtsgrundlagen, Laufzeiten und gegebenenfalls internationale Übermittlungen zu prüfen und transparent zu dokumentieren. Erforderliche Einwilligungen sind vor dem Laden einzuholen.",
        ar: "تتضمن السياسة القديمة معلومات عن Google Analytics، لكن ذلك لا يثبت استخدامه في الموقع الجديد. قبل التفعيل يجب تحديد الوظائف والجهات المستلمة والأسس القانونية وفترات الحفظ والتحويلات الدولية، والحصول على الموافقة المطلوبة قبل التحميل.",
        tr: "Eski politikada Google Analytics yer alması yeni sitede etkin olduğunu göstermez. Etkinleştirmeden önce işlevler, alıcılar, hukuki dayanak, saklama süresi ve uluslararası aktarımlar doğrulanmalı, gerekli rızalar önceden alınmalıdır.",
        es: "Que la política antigua mencionara Google Analytics no significa que esté activo en el nuevo sitio. Antes de activarlo deben comprobarse funciones, destinatarios, bases legales, plazos y transferencias; el consentimiento exigible debe obtenerse antes de cargarlo.",
      },
    ],
  },
  {
    id: "thirdparty",
    icon: Globe2,
    title: {
      de: "12. Google Maps, Videos und soziale Netzwerke",
      ar: "12. خرائط Google والفيديو والشبكات الاجتماعية",
      tr: "12. Google Maps, video ve sosyal ağlar",
      es: "12. Google Maps, vídeos y redes sociales",
    },
    paragraphs: [
      {
        de: "Auf der Kontaktseite ist derzeit ein Link zu Google Maps vorgesehen. Ein normaler externer Link ist nicht dasselbe wie eine automatisch eingebundene Karte. Die frühere Erklärung nannte YouTube, Twitter und Facebook-Plugins; ihre Verwendung auf der neuen Plattform ist nicht bestätigt. Werden externe Inhalte oder Social-Plugins eingebettet, sind die Datenflüsse und gegebenenfalls erforderlichen Einwilligungen vor der Einbindung zu prüfen.",
        ar: "تحتوي صفحة الاتصال المخطط لها على رابط خارجي إلى خرائط Google، وهو مختلف عن تضمين خريطة تُحمّل تلقائياً. ذكرت السياسة القديمة YouTube وTwitter وFacebook، لكن لم يتم تأكيد استخدامها في المنصة الجديدة. يجب مراجعة نقل البيانات والموافقات قبل تضمينها.",
        tr: "İletişim sayfasında Google Maps'e dış bağlantı planlanmıştır; bu, otomatik yüklenen haritadan farklıdır. Eski politikada YouTube, Twitter ve Facebook eklentileri vardı ancak yeni platformda kullanımları doğrulanmamıştır. Gömmeden önce veri akışları ve gerekli rızalar kontrol edilmelidir.",
        es: "La página de contacto prevé un enlace externo a Google Maps, distinto de un mapa integrado que carga automáticamente. La política antigua citaba YouTube, Twitter y Facebook, pero su uso actual no está confirmado. Antes de integrar contenidos deben revisarse transferencias y consentimientos.",
      },
    ],
  },
  {
    id: "processors",
    icon: Server,
    title: {
      de: "13. Hosting und Auftragsverarbeiter",
      ar: "13. الاستضافة ومعالجو البيانات",
      tr: "13. Barındırma ve veri işleyenler",
      es: "13. Alojamiento y encargados del tratamiento",
    },
    paragraphs: [
      {
        de: "Für Betrieb und Entwicklung der Plattform sind technische Dienste für Hosting, Datenbank, geschützte Dateispeicherung, E-Mail-Versand und gegebenenfalls SMS vorgesehen. Eine geplante Nutzung von PostgreSQL, Supabase oder Resend allein bestätigt noch nicht den tatsächlichen produktiven Anbieter, dessen Standort oder die konkrete Verarbeitung. Vor Inbetriebnahme müssen die eingesetzten Dienstleister, Verträge zur Auftragsverarbeitung und technischen Schutzmaßnahmen dokumentiert werden.",
        ar: "تشمل البنية المخطط لها خدمات الاستضافة وقاعدة البيانات وتخزين الملفات المحمي والبريد وربما SMS. ذكر PostgreSQL أو Supabase أو Resend في التصميم لا يثبت استخدامها فعلياً أو مواقع معالجتها. يجب تحديد المزودين والعقود وتدابير الأمان قبل التشغيل.",
        tr: "Platform için hosting, veritabanı, korumalı dosya depolama, e-posta ve gerektiğinde SMS hizmetleri planlanmaktadır. PostgreSQL, Supabase veya Resend'in tasarımda bulunması gerçek üretim sağlayıcısını ya da veri konumunu kanıtlamaz. Sağlayıcılar, işleme sözleşmeleri ve güvenlik önlemleri canlı kullanımdan önce belgelenmelidir.",
        es: "Se prevén servicios de alojamiento, base de datos, almacenamiento protegido, correo y, en su caso, SMS. La mención de PostgreSQL, Supabase o Resend en el diseño no confirma el proveedor operativo ni la ubicación de los datos. Antes del lanzamiento deben documentarse proveedores, contratos y medidas de seguridad.",
      },
    ],
  },
  {
    id: "transfers",
    icon: Globe2,
    title: {
      de: "14. Empfänger und Drittlandübermittlungen",
      ar: "14. الجهات المستلمة ونقل البيانات خارج المنطقة الأوروبية",
      tr: "14. Alıcılar ve üçüncü ülkelere aktarım",
      es: "14. Destinatarios y transferencias internacionales",
    },
    paragraphs: [
      {
        de: "Personenbezogene Daten werden nur soweit erforderlich an berechtigte Beschäftigte, vertraglich gebundene Dienstleister oder zuständige Stellen weitergegeben. Übermittlungen außerhalb des Europäischen Wirtschaftsraums dürfen nur unter den Voraussetzungen von Kapitel V DSGVO erfolgen, etwa bei einem Angemessenheitsbeschluss oder geeigneten Garantien. Ob und wohin tatsächlich übermittelt wird, muss anhand der eingesetzten Anbieter geklärt werden.",
        ar: "تُشارك البيانات عند الضرورة فقط مع الموظفين المخولين أو مزودي الخدمات المتعاقدين أو الجهات المختصة. ويخضع النقل خارج المنطقة الاقتصادية الأوروبية للفصل الخامس من اللائحة، مثل قرارات الملاءمة أو الضمانات المناسبة. يجب تحديد التحويلات الفعلية وفق المزودين المستخدمين.",
        tr: "Kişisel veriler yalnızca gerektiğinde yetkili çalışanlar, sözleşmeli sağlayıcılar veya ilgili makamlarla paylaşılır. AEA dışına aktarım GDPR Bölüm V şartlarına, örneğin yeterlilik kararına veya uygun güvencelere tabidir. Gerçek aktarımlar sağlayıcılara göre belirlenmelidir.",
        es: "Los datos solo se comunican cuando sea necesario a personal autorizado, proveedores contratados o autoridades competentes. Las transferencias fuera del EEE deben cumplir el capítulo V RGPD, mediante decisión de adecuación o garantías apropiadas. Deben identificarse las transferencias reales.",
      },
    ],
  },
  {
    id: "security",
    icon: ShieldCheck,
    title: {
      de: "15. Datensicherheit",
      ar: "15. أمن البيانات",
      tr: "15. Veri güvenliği",
      es: "15. Seguridad de los datos",
    },
    paragraphs: [
      {
        de: "Die Plattform ist so auszulegen, dass persönliche Konten geschützt, Dateizugriffe geprüft, vertrauliche Dokumente nicht öffentlich bereitgestellt und unberechtigte Zugriffe verhindert werden. Hierzu gehören unter anderem verschlüsselte Übertragung, rollenbasierte Zugriffsrechte und angemessene Sicherheitskontrollen. Welche Maßnahmen in Produktion umgesetzt sind, ist technisch zu verifizieren.",
        ar: "يجب تصميم المنصة لحماية الحسابات وفحص صلاحيات الوصول إلى الملفات ومنع إتاحة الوثائق السرية للعامة. تشمل التدابير النقل المشفر والصلاحيات بحسب الدور وضوابط الأمان المناسبة. يجب التأكد تقنياً مما نُفذ فعلاً قبل التشغيل.",
        tr: "Platform; hesapları koruyacak, dosya erişimlerini denetleyecek, gizli belgeleri açık tutmayacak ve yetkisiz erişimi önleyecek biçimde tasarlanmalıdır. Şifreli iletişim, role dayalı izinler ve uygun kontroller gerekir. Üretimdeki gerçek önlemler teknik olarak doğrulanmalıdır.",
        es: "La plataforma debe proteger cuentas, controlar accesos a archivos, impedir la exposición pública de documentos y evitar accesos no autorizados. Se prevén conexiones cifradas, permisos por función y controles adecuados. Las medidas realmente implantadas deben verificarse.",
      },
    ],
  },
  {
    id: "retention",
    icon: Database,
    title: {
      de: "16. Speicherdauer und Löschung",
      ar: "16. مدة الاحتفاظ والحذف",
      tr: "16. Saklama süresi ve silme",
      es: "16. Conservación y eliminación",
    },
    paragraphs: [
      {
        de: "Wir dürfen Daten nur so lange speichern, wie dies für den jeweiligen Zweck oder aufgrund gesetzlicher Aufbewahrungspflichten erforderlich ist. Unterschiedliche Fristen können für Serverprotokolle, Kontaktanfragen, Benutzerkonten, Ausbildungsunterlagen, Nachweise und Geschäftsunterlagen gelten. Konkrete Fristen oder nachvollziehbare Kriterien sind vor Veröffentlichung anhand der tatsächlichen Prozesse festzulegen.",
        ar: "يجب الاحتفاظ بالبيانات فقط للفترة اللازمة لغرض المعالجة أو للالتزامات القانونية. وقد تختلف المدد بين سجلات الخادم والرسائل والحسابات وملفات التدريب والوثائق والسجلات التجارية. ينبغي تحديد المدد أو معاييرها قبل النشر.",
        tr: "Veriler yalnızca amaç veya yasal saklama yükümlülüğü gerektirdiği sürece tutulmalıdır. Sunucu kayıtları, mesajlar, hesaplar, eğitim belgeleri ve ticari kayıtlar için süreler farklı olabilir. Somut süreler veya kriterler gerçek süreçlere göre yayımdan önce belirlenmelidir.",
        es: "Los datos deben conservarse solo durante el tiempo necesario para su finalidad o por obligación legal. Los plazos pueden variar entre registros, mensajes, cuentas, documentos formativos y comerciales. Deben fijarse plazos concretos o criterios verificables antes de publicar.",
      },
    ],
  },
  {
    id: "rights",
    icon: Scale,
    title: {
      de: "17. Rechte betroffener Personen",
      ar: "17. حقوق أصحاب البيانات",
      tr: "17. İlgili kişilerin hakları",
      es: "17. Derechos de las personas",
    },
    paragraphs: [
      {
        de: "Nach Maßgabe der DSGVO können Sie Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21) verlangen. Eine erteilte Einwilligung kann nach Art. 7 Abs. 3 DSGVO jederzeit mit Wirkung für die Zukunft widerrufen werden.",
        ar: "وفقاً للائحة يمكنك طلب الوصول إلى بياناتك (15) وتصحيحها (16) وحذفها (17) وتقييد المعالجة (18) ونقلها (20) والاعتراض (21). ويمكن سحب الموافقة في أي وقت للمستقبل وفق المادة 7(3).",
        tr: "GDPR uyarınca erişim (15), düzeltme (16), silme (17), işlemeyi kısıtlama (18), veri taşınabilirliği (20) ve itiraz (21) haklarınız vardır. Rızanızı GDPR 7(3) kapsamında geleceğe etkili olarak geri çekebilirsiniz.",
        es: "Conforme al RGPD puede solicitar acceso (15), rectificación (16), supresión (17), limitación (18), portabilidad (20) y oposición (21). El consentimiento puede retirarse con efectos futuros según el artículo 7.3.",
      },
      {
        de: "Diese Rechte gelten unter den jeweiligen gesetzlichen Voraussetzungen und können durch gesetzliche Aufbewahrungspflichten begrenzt sein. Anfragen richten Sie an die oben angegebene Kontaktadresse. Zur Verhinderung unberechtigter Offenlegung kann eine angemessene Identitätsprüfung nötig sein.",
        ar: "تخضع الحقوق للشروط القانونية وقد تقيدها التزامات الاحتفاظ. يمكن إرسال الطلبات إلى عنوان الاتصال أعلاه. وقد يلزم التحقق من الهوية لمنع الكشف غير المصرح به.",
        tr: "Haklar ilgili yasal koşullara ve saklama yükümlülüklerine tabidir. Talepler yukarıdaki iletişim adresine gönderilebilir. Yetkisiz ifşayı önlemek için makul kimlik doğrulaması istenebilir.",
        es: "Los derechos están sujetos a las condiciones legales y posibles obligaciones de conservación. Puede enviar solicitudes al contacto indicado. Podrá requerirse una verificación proporcionada de identidad.",
      },
    ],
  },
  {
    id: "complaints",
    icon: FileText,
    title: {
      de: "18. Beschwerderecht",
      ar: "18. حق تقديم شكوى",
      tr: "18. Şikâyet hakkı",
      es: "18. Derecho a reclamar",
    },
    paragraphs: [
      {
        de: "Sie haben gemäß Art. 77 DSGVO das Recht, Beschwerde bei einer zuständigen Datenschutzaufsichtsbehörde einzulegen. Für den angegebenen Standort in Berlin kommt insbesondere die Berliner Beauftragte für Datenschutz und Informationsfreiheit in Betracht. Sie können sich auch an eine andere gesetzlich zuständige Behörde wenden.",
        ar: "يحق لك تقديم شكوى إلى سلطة حماية بيانات مختصة وفق المادة 77 من اللائحة. ومن الجهات ذات الصلة بموقع برلين هيئة حماية البيانات وحرية المعلومات في برلين، كما يمكن التواصل مع جهة مختصة أخرى.",
        tr: "GDPR 77 uyarınca yetkili veri koruma denetim makamına şikâyette bulunabilirsiniz. Berlin'deki faaliyet için Berlin Veri Koruma ve Bilgi Özgürlüğü Yetkilisi ilgili kurumlardan biridir; diğer yetkili makamlara da başvurabilirsiniz.",
        es: "Según el artículo 77 RGPD puede reclamar ante una autoridad de protección de datos competente. Para la sede de Berlín, una de las autoridades pertinentes es la de protección de datos y libertad de información de Berlín.",
      },
    ],
  },
  {
    id: "changes",
    icon: Info,
    title: {
      de: "19. Änderungen dieser Datenschutzerklärung",
      ar: "19. تحديثات سياسة الخصوصية",
      tr: "19. Politika değişiklikleri",
      es: "19. Modificaciones de esta política",
    },
    paragraphs: [
      {
        de: "Diese Datenschutzerklärung muss angepasst werden, wenn sich Funktionen, Datenverarbeitungen, Dienstleister oder gesetzliche Anforderungen ändern. Das oben angegebene Datum bezeichnet den Stand dieses Entwurfs und keine unabhängig bestätigte rechtliche Freigabe.",
        ar: "يجب تحديث هذه السياسة عند تغير الوظائف أو معالجة البيانات أو مزودي الخدمات أو المتطلبات القانونية. يشير التاريخ أعلاه إلى إصدار المسودة، ولا يعني اعتمادها القانوني النهائي.",
        tr: "İşlevler, veri işleme, sağlayıcılar veya hukuk değiştiğinde bu politika güncellenmelidir. Üstteki tarih bu taslağın sürümünü gösterir; bağımsız hukuki onay anlamına gelmez.",
        es: "Esta política deberá actualizarse cuando cambien funciones, tratamientos, proveedores o requisitos legales. La fecha indicada corresponde a esta versión del borrador y no constituye aprobación jurídica independiente.",
      },
    ],
  },
];

/* ==========================================================
   4. ICON ALIASES
   ========================================================== */

function ClipboardListIcon(props: {
  size?: number;
  className?: string;
}) {
  return <FileText {...props} />;
}

function SendIcon(props: {
  size?: number;
  className?: string;
}) {
  return <Mail {...props} />;
}

/* ==========================================================
   5. LANGUAGE SYNC

   Compatible with project's existing
   document lang, cookie, localStorage
   and language-change event.

   No new language selector.
   ========================================================== */

function validLocale(value: unknown): Locale | null {
  if (typeof value !== "string") return null;

  const code = value
    .trim()
    .toLowerCase()
    .split(/[-_]/)[0];

  return code === "de" ||
    code === "ar" ||
    code === "tr" ||
    code === "es"
    ? code
    : null;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const prefix = `${name}=`;
  const match = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix));

  if (!match) return null;

  try {
    return decodeURIComponent(match.slice(prefix.length));
  } catch {
    return null;
  }
}

function activeLocale(): Locale {
  if (typeof window === "undefined") return "de";

  const html = validLocale(document.documentElement.lang);
  if (html) return html;

  const cookie =
    validLocale(getCookie("taym-locale")) ??
    validLocale(getCookie("NEXT_LOCALE"));

  if (cookie) return cookie;

  try {
    return (
      validLocale(localStorage.getItem("taym-locale")) ??
      "de"
    );
  } catch {
    return "de";
  }
}

/* ==========================================================
   6. DISPLAY COMPONENTS
   ========================================================== */

function PolicyCard({
  section,
  locale,
}: {
  section: PolicySection;
  locale: Locale;
}) {
  const Icon = section.icon;

  return (
    <section
      id={section.id}
      aria-labelledby={`${section.id}-title`}
      className="scroll-mt-28 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-green-800">
          <Icon size={22} aria-hidden="true" />
        </span>

        <h2
          id={`${section.id}-title`}
          className="pt-1 text-lg font-extrabold leading-snug text-slate-950 sm:text-xl"
        >
          {section.title[locale]}
        </h2>
      </div>

      <div className="mt-5 space-y-4 text-sm leading-8 text-slate-600">
        {section.paragraphs.map((paragraph, index) => (
          <p key={index}>
            {paragraph[locale]}
          </p>
        ))}
      </div>
    </section>
  );
}

/* ==========================================================
   7. MAIN COMPONENT
   ========================================================== */

export default function PrivacyPolicyContent() {
  const [locale, setLocale] = useState<Locale>("de");
  const t = UI[locale];
  const rtl = locale === "ar";

  const Arrow = rtl ? ArrowLeft : ArrowRight;

  useEffect(() => {
    const synchronize = (event?: Event) => {
      if (event instanceof CustomEvent) {
        const detail: unknown = event.detail;

        const next =
          validLocale(
            typeof detail === "string"
              ? detail
              : detail &&
                  typeof detail === "object" &&
                  "locale" in detail
              ? detail.locale
              : null
          );

        if (next) {
          setLocale(next);
          return;
        }
      }

      setLocale(activeLocale());
    };

    synchronize();

    const observer = new MutationObserver(() => {
      synchronize();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });

    window.addEventListener(
      "taym:language-change",
      synchronize
    );
    window.addEventListener("storage", synchronize);
    window.addEventListener("focus", synchronize);

    return () => {
      observer.disconnect();
      window.removeEventListener(
        "taym:language-change",
        synchronize
      );
      window.removeEventListener("storage", synchronize);
      window.removeEventListener("focus", synchronize);
    };
  }, []);

  const navigation = useMemo(
    () =>
      SECTIONS.map((section) => ({
        id: section.id,
        label: section.title[locale],
      })),
    [locale]
  );

  return (
    <main
      lang={locale}
      dir={rtl ? "rtl" : "ltr"}
      className="min-w-0 overflow-hidden bg-[#f5f8f2] text-slate-950"
    >
      {/* ===============================================
          HERO
          =============================================== */}

      <header className="relative overflow-hidden bg-[#142318]">
        <div className="pointer-events-none absolute -inset-e-24 -top-24 size-80 rounded-full bg-lime-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-none px-4 py-7 sm:px-6 sm:py-9 lg:px-8 lg:py-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-lime-400/30 bg-lime-400/10 px-4 py-2 text-xs font-bold tracking-wider text-lime-300">
            <ShieldCheck size={16} aria-hidden="true" />
            {t.eyebrow}
          </span>

          <h1 className="mt-6 max-w-4xl wrap-break-word text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
            {t.title}
          </h1>

          <p className="mt-5 max-w-3xl text-sm leading-8 text-slate-200 sm:text-base">
            {t.introduction}
          </p>

          <span className="mt-6 inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-lime-200">
            <Info size={16} aria-hidden="true" />
            {t.updated}
          </span>
        </div>
      </header>

      {/* ===============================================
          PRIVACY PRINCIPLES
          =============================================== */}

      <section className="mx-auto max-w-none px-4 pt-8 sm:px-6 sm:pt-10 lg:px-8">
        <h2 className="text-xl font-black sm:text-2xl">
          {t.principles}
        </h2>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            {
              title: t.principleOne,
              icon: CheckCircle2,
            },
            {
              title: t.principleTwo,
              icon: LockKeyhole,
            },
            {
              title: t.principleThree,
              icon: FileLock2,
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-green-800">
                  <Icon size={20} aria-hidden="true" />
                </span>

                <span className="text-sm font-bold leading-relaxed">
                  {item.title}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===============================================
          POLICY LAYOUT
          =============================================== */}

      <div className="mx-auto grid max-w-none gap-7 px-4 py-9 sm:px-6 sm:py-12 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-8 lg:px-8">
        {/* CONTENT MENU */}

        <aside className="min-w-0">
          <nav
            aria-label={t.navigation}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24"
          >
            <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
              <BookOpen
                size={19}
                className="text-green-800"
                aria-hidden="true"
              />

              <h2 className="text-sm font-extrabold">
                {t.navigation}
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-1">
              {navigation.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="rounded-lg px-3 py-2 text-start text-xs font-medium leading-relaxed text-slate-600 transition-colors hover:bg-lime-50 hover:text-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </nav>
        </aside>

        {/* POLICY DETAILS */}

        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-green-800">
                <UserRound size={24} aria-hidden="true" />
              </span>

              <h2 className="text-lg font-black sm:text-xl">
                {t.controller}
              </h2>
            </div>

            <div className="mt-5 space-y-3 text-sm leading-7 text-slate-700">
              <p className="font-extrabold text-slate-950">
                Fahrschule TAYM
              </p>

              <p>
                {t.location}:{" "}
                <span dir="ltr">
                  {CONTACT.formattedAddress}
                </span>
              </p>

              <p>
                {t.telephone}:{" "}
                <a
                  href={CONTACT.phoneHref}
                  dir="ltr"
                  className="font-semibold text-green-800 hover:underline"
                >
                  {CONTACT.phoneDisplay}
                </a>
              </p>

              <p>
                {t.email}:{" "}
                <a
                  href={CONTACT.emailHref}
                  dir="ltr"
                  className="break-all font-semibold text-green-800 hover:underline"
                >
                  {CONTACT.email}
                </a>
              </p>
            </div>
          </section>

          {SECTIONS.map((section) => (
            <PolicyCard
              key={section.id}
              section={section}
              locale={locale}
            />
          ))}

          {/* OFFICIAL SOURCES */}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="flex items-center gap-3 text-lg font-black">
              <Scale
                size={23}
                className="text-green-800"
                aria-hidden="true"
              />
              {t.officialSources}
            </h2>

            <div className="mt-5 flex flex-col gap-3">
              {[
                {
                  label: t.gdpr,
                  href: LEGAL.gdprUrl,
                },
                {
                  label: t.cookiesLaw,
                  href: LEGAL.cookieLawUrl,
                },
                {
                  label: t.authority,
                  href: LEGAL.authorityUrl,
                },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-green-800 hover:border-lime-400 hover:bg-lime-50"
                >
                  {item.label}
                  <ExternalLink
                    size={16}
                    className="shrink-0"
                    aria-hidden="true"
                  />
                </a>
              ))}
            </div>
          </section>

          {/* CONTACT CTA */}

          <section className="rounded-2xl bg-[#142318] p-6 text-white sm:p-8">
            <div className="flex size-12 items-center justify-center rounded-xl bg-lime-400/15 text-lime-300">
              <Mail size={24} aria-hidden="true" />
            </div>

            <h2 className="mt-5 text-xl font-black sm:text-2xl">
              {t.contactTitle}
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">
              {t.contactDescription}
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href={CONTACT.emailHref}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-green-700 to-lime-500 px-5 py-3 text-sm font-bold text-white hover:from-green-800 hover:to-lime-600"
              >
                <Mail size={18} />
                {t.writeEmail}
              </a>

              <Link
                href="/kontakt"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/40 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
              >
                {t.contactPage}
                <Arrow size={17} />
              </Link>
            </div>
          </section>

          <div className="flex items-start gap-3 rounded-xl border border-lime-200 bg-lime-50 p-4">
            <Info
              size={19}
              className="mt-0.5 shrink-0 text-green-800"
              aria-hidden="true"
            />

            <p className="text-xs leading-relaxed text-green-950 sm:text-sm">
              {t.countryNote}
            </p>
          </div>

          <div className="flex flex-wrap gap-4 pb-3 text-sm font-semibold text-green-800">
            <Link
              href="/impressum"
              className="hover:underline"
            >
              {t.legalPage}
            </Link>

            <Link
              href="/kontakt"
              className="hover:underline"
            >
              {t.contactPage}
            </Link>

            <Link
              href={LINKS.application}
              className="hover:underline"
            >
              {t.application}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
