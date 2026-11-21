
import type { MetadataRoute } from "next";

/**
 * ============================================================
 * FAHRSCHULE TAYM
 * Progressive Web App (PWA)
 *
 * File: src/app/manifest.ts
 *
 * Supported devices:
 * - Android smartphones and tablets
 * - iPhone and iPad
 * - Windows computers
 * - macOS computers
 *
 * Default language: German
 * Additional languages: Arabic, Turkish, Spanish
 *
 * Icon directory: /public/icon/
 *
 * ============================================================
 */

export default function manifest(): MetadataRoute.Manifest {
  return {
    /**
     * Stable application identifier.
     *
     * Allows browsers to recognize the
     * same installed application even
     * when the start URL changes.
     */
    id: "/",

    /**
     * Application name displayed
     * during installation.
     */
    name: "Fahrschule TAYM",

    /**
     * Short name displayed under
     * the application icon.
     */
    short_name: "TAYM",

    /**
     * German description.
     *
     * Do not claim that the platform
     * directly issues official
     * driving licences.
     */
    description:
      "Fahrschule TAYM – Ihre Plattform für " +
      "Führerscheinanträge, Theorievorbereitung, " +
      "Fahrausbildung und die Verwaltung " +
      "Ihres persönlichen Kontos.",

    /**
     * Launch the public homepage.
     *
     * The applicant can then log
     * in using the existing website.
     *
     * No automatic redirect to
     * a protected account page.
     */
    start_url: "/",

    /**
     * All public and account routes
     * remain within the installed app.
     */
    scope: "/",

    /**
     * Standalone display.
     *
     * The browser may open the website
     * without its traditional address bar.
     */
    display: "standalone",

    /**
     * Fallback display mode for
     * compatible browsers.
     */
    display_override: [
      "standalone",
      "minimal-ui",
    ],

    /**
     * Screen orientation.
     *
     * Portrait and landscape both
     * remain supported.
     */
    orientation: "any",

    /**
     * TAYM brand colors.
     */
    theme_color: "#172B1B",

    background_color: "#FFFFFF",

    /**
     * Default application language.
     */
    lang: "de",

    /**
     * Default writing direction.
     *
     * Arabic pages manage their own
     * RTL direction separately.
     */
    dir: "ltr",

    /**
     * Application categories.
     */
    categories: [
      "education",
      "productivity",
    ],

    /**
     * Application icons.
     *
     * All files are served from:
     *
     * public/icon/
     *
     * Original logo:
     * public/icon/icon.png
     */
    icons: [
      {
        src: "/icon/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },

      {
        src: "/icon/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },

      {
        src: "/icon/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },

      {
        src: "/icon/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],

    /**
     * This is a web application.
     *
     * No Android APK or iOS App Store
     * application is required.
     */
    prefer_related_applications: false,
  };
}
