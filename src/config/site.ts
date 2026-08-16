/**
 * Single source of truth for site-wide metadata, navigation, and services.
 * Everything user-facing that isn't page content lives here.
 */

export const SITE = {
  /** Displayed brand name. "Creative" is part of the domain only, never the mark. */
  name: 'WELLWORN',
  url: 'https://wellworncreative.com',
  lang: 'en',
  locale: 'en_US',

  /**
   * Used verbatim as the <title> on the homepage. The homepage sells web
   * design and development only, so it does not mention photography.
   */
  title: 'WELLWORN | Web design and development',

  /** Default meta description. Keep under ~160 characters. */
  description:
    'Wellworn is an independent studio designing and building websites, web applications, online stores, and the brand identity behind them.',

  /**
   * TODO: confirm the real inbox before launch.
   * Derived from the domain, not verified.
   */
  email: 'work@wellworncreative.com',

  /**
   * Default social share image, relative to /public. Resolved against `url`
   * into an absolute href — scrapers reject relative og:image values.
   * Set to '' to omit the image tags entirely rather than publish a broken
   * reference; BaseLayout downgrades the X card to `summary` in that case.
   *
   * 1200×630 is the Open Graph / X large-card standard. The dimensions below
   * are advertised to scrapers so they can reserve layout before the file
   * downloads, so any per-page `image` override must match them.
   */
  ogImage: '/og-image.jpg',
  ogImageWidth: 1200,
  ogImageHeight: 630,
  /*
   * Describes what the card says, so keep it in step with the artwork by hand.
   * The card is now a supplied file, not generated — see scripts/gen-og-image.mjs.
   */
  ogImageAlt: 'WELLWORN. Design and development.',
} as const

/**
 * Brand artwork, served from /public. Do not edit the SVG files —
 * they are the supplied source artwork.
 */
export const BRAND = {
  /** Square monogram. Intrinsic 681×681. */
  mark: '/wellworn-mark.svg',
  /** Wordmark for light backgrounds (cream). Intrinsic 2476×597. */
  wordmarkDark: '/wellworn-wordmark-dark.svg',
  /** Wordmark for dark backgrounds (charcoal/forest). Intrinsic 2476×597. */
  wordmarkLight: '/wellworn-wordmark-light.svg',
  /** Aspect ratio of the wordmarks, for computing width from a target height. */
  wordmarkRatio: 2476 / 597,
} as const

/**
 * Where every "Get in touch" call to action points. Currently the contact
 * block at the foot of the page; change this one value to repoint them all
 * at a dedicated /contact page later.
 */
export const CONTACT_HREF = '/#contact'

/* ==========================================================================
   Homepage
   --------------------------------------------------------------------------
   The homepage is the site. There are no discipline pages and no primary
   nav any more, so every section below is content on this one page. It lives
   here rather than in the page so the copy can be edited without touching
   layout.
   ========================================================================== */

export interface Project {
  readonly title: string
  /** One line. The work is meant to carry the section, not the caption. */
  readonly summary: string
  /** Live site. Omit for work that is no longer up. */
  readonly href?: string
  /** Screenshot under /public, e.g. "/images/projects/<slug>/desktop.webp". */
  readonly image?: string
  /**
   * Describe what the screenshot shows, not the project name: the title sits
   * right beside it and would otherwise be announced twice.
   */
  readonly imageAlt?: string
  /** Intrinsic pixel size of `image`, so the browser can reserve the space. */
  readonly imageWidth?: number
  readonly imageHeight?: number
}

/**
 * Selected work, strongest first. The section renders nothing at all while
 * this is empty rather than showing placeholder frames.
 */
export const PROJECTS: readonly Project[] = []

/** A short titled paragraph. Shared by the two list sections below. */
export interface Point {
  readonly title: string
  readonly body: string
}

export const WHY_WELLWORN: readonly Point[] = [
  {
    title: 'Look like yourself.',
    body: "Your website shouldn't look like it could belong to anyone else.",
  },
  {
    title: 'Make it easy to say yes.',
    body: 'Give people what they need to understand your business, trust it, and take the next step.',
  },
  {
    title: "Don't get stuck.",
    body: "Your website shouldn't have to be rebuilt because you outgrew a platform or decided to leave it.",
  },
  {
    title: 'Talk to the people who built it.',
    body: "When you need something, you shouldn't have to explain your website to a support queue.",
  },
]

/**
 * What we do. Also the source for the homepage Organization structured data,
 * which is why the titles are plain capability names rather than sentences.
 */
export const CAPABILITIES: readonly Point[] = [
  {
    title: 'Websites',
    body: 'From focused landing pages to full sites with all the moving parts.',
  },
  {
    title: 'Web Applications',
    body: 'Tools, dashboards, portals, workflows, and custom functionality.',
  },
  {
    title: 'Ecommerce',
    body: 'Online stores built around the way your business actually sells.',
  },
  {
    title: 'Branding',
    body: 'Identity and visual direction when the business needs more than a new website.',
  },
]

/**
 * How it works. Three steps, in order — the order is the only thing that says
 * they are a sequence, so keep them in it.
 */
export const PROCESS: readonly Point[] = [
  {
    title: 'Figure it out',
    body: "We learn what you're trying to do and what actually matters.",
  },
  {
    title: 'Make it',
    body: 'We design and build the right thing for the job.',
  },
  {
    title: 'Put it to work',
    body: 'We launch it, hand you the keys, and stay around when you need us.',
  },
]

/** Contact form chips. Order is the order they appear. */
export const PROJECT_TYPES: readonly string[] = [
  'New Website',
  'Website Redesign',
  'Web Application',
  'Branding',
  'Online Store',
  'SEO',
  'Ongoing Support',
  'Something Else',
  'Not Sure Yet',
]

/**
 * Where the contact form posts. The site builds to static files with no
 * server of its own, so this has to be an external form handler (Formspree,
 * Basin, Getform, or similar).
 *
 * TODO: paste the endpoint before launch. While it is empty the form still
 * renders but its submit button is disabled, so a visitor can never lose a
 * message to a form that posts nowhere.
 */
export const FORM_ENDPOINT = ''
