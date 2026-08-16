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

/*
 * Screenshots are imported rather than referenced by URL so Astro's <Image>
 * can resize and re-encode them: these are 1792px PNGs, and davis-01 alone is
 * 2.2MB before it goes through the pipeline. Importing them here rather than
 * in the page keeps each file next to the alt text that describes it.
 */
import cadence01 from '../assets/projects/cadence-01.png'
import cadence02 from '../assets/projects/cadence-02.png'
import cadence03 from '../assets/projects/cadence-03.png'
import davis01 from '../assets/projects/davis-01.png'
import davis02 from '../assets/projects/davis-02.png'
import veil01 from '../assets/projects/veil-01.png'
import veil02 from '../assets/projects/veil-02.png'

/** One screenshot and what it shows. */
export interface Shot {
  readonly src: ImageMetadata
  /**
   * Describe what the screenshot shows, not the project name: the title sits
   * right above it and would otherwise be announced twice.
   */
  readonly alt: string
}

export interface Project {
  readonly title: string
  /**
   * What the business is, in a handful of words. Set as metadata rather than
   * as copy — the screenshots are the argument, and a case study would be a
   * different page.
   */
  readonly kicker: string
  /** Live site. */
  readonly href: string
  /** The domain, shown as the visible link text. */
  readonly label: string
  /**
   * Lead shot first, supporting shots after it. The page composes each project
   * by hand rather than mapping over this, so both the order and the count are
   * part of the layout: Cadence takes three, the two under it take two each,
   * and shots[0] is the one given the room in every composition.
   */
  readonly shots: readonly Shot[]
}

/**
 * Selected work, lead first. The section renders nothing at all while this is
 * empty rather than showing placeholder frames.
 *
 * Cadence leads because it is the fullest piece of work here, and the page
 * gives it a composition of its own to say so.
 */
export const PROJECTS: readonly Project[] = [
  {
    title: 'Cadence',
    kicker: 'Homeschool record keeping',
    href: 'https://recordcadence.com',
    label: 'recordcadence.com',
    shots: [
      {
        src: cadence01,
        alt: 'Homepage hero: a headline set over a photograph of a parent and child stretching in a living room, with a lesson card overlaid on it.',
      },
      {
        src: cadence02,
        alt: 'A near-black section pairing a photograph of someone surrounded by paperwork with the line "Feeling overwhelmed? We\'ve got you."',
      },
      {
        src: cadence03,
        alt: 'Two product panels side by side, one charting a week of activity by subject and one tracking milestones across the school year.',
      },
    ],
  },
  {
    title: 'Davis Property Works',
    kicker: 'Landscaping and property care',
    href: 'https://davispropertyworks.com',
    label: 'davispropertyworks.com',
    shots: [
      {
        src: davis01,
        alt: 'Homepage hero: a groundskeeper running a hose beside a branded pickup truck, behind a headline and two calls to action.',
      },
      {
        src: davis02,
        alt: 'The estimate request section: phone, email, and opening hours on one side, a short request form on the other.',
      },
    ],
  },
  {
    title: 'Veil',
    kicker: 'Private cycle tracking',
    href: 'https://stayveiled.com',
    label: 'stayveiled.com',
    shots: [
      {
        src: veil01,
        alt: 'A near-black landing page with a script wordmark above the line "Track privately. Period."',
      },
      {
        src: veil02,
        alt: 'The tracker on a phone: a month calendar with the current day ringed, above a list of recent entries.',
      },
    ],
  },
]

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
