/**
 * Single source of truth for site-wide metadata, navigation, and services.
 * Everything user-facing that isn't page content lives here.
 */

export const SITE = {
  /**
   * Displayed brand name. "Creative" is part of the domain only, never the
   * mark. Set in sentence case, not caps: the wordmark artwork is already
   * uppercase, so shouting the name in running text only makes the two
   * disagree — and a screen reader spells an all-caps word out letter by
   * letter. Where the name is meant to look uppercase, use the artwork.
   */
  name: 'Wellworn',
  url: 'https://wellworncreative.com',
  lang: 'en',
  locale: 'en_US',

  /**
   * Used verbatim as the <title> on the homepage. The homepage sells web
   * design and development only, so it does not mention photography.
   */
  title: 'Wellworn | Web design and development',

  /** Default meta description. Keep under ~160 characters. */
  description:
    'Wellworn is an independent studio designing and building websites, online stores, and the custom pieces a growing business needs around them.',

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

/** One destination in the header menu. */
export interface NavItem {
  readonly label: string
  /**
   * Root-relative, not a bare fragment: the menu ships in the header on every
   * page, so `#work` would do nothing at all from /404. `/#work` scrolls on the
   * homepage and loads it from anywhere else.
   */
  readonly href: string
  /**
   * One line saying what is down there. The menu covers the page, so it can
   * afford to describe a section rather than just name it — and a visitor who
   * opens it is asking what is here, which a list of five nouns does not
   * answer.
   */
  readonly note: string
}

/**
 * The header menu, in page order — which is the order the sections argue in,
 * so the menu doubles as a summary of the page rather than a shortcut list.
 * The sections it points at are the ones carrying an id in index.astro; the
 * two statement sections have none, deliberately, because they are the page
 * making a claim rather than places to be sent.
 *
 * Contact is last and is still the one ask, which is what the header button
 * used to be. It is a row like the others here: the menu is an index, and
 * dressing one line in it as a button would make the index look like a form.
 */
export const NAV: readonly NavItem[] = [
  {
    label: 'Selected work',
    href: '/#work',
    note: 'A few of the websites we’ve put to work.',
  },
  {
    label: 'Why it matters',
    href: '/#why',
    note: 'What a website owes the business paying for it.',
  },
  {
    label: 'What we do',
    href: '/#services',
    note: 'Websites, online selling, and the custom pieces.',
  },
  {
    label: 'How it works',
    href: '/#how-it-works',
    note: 'Figure it out, make it, put it to work.',
  },
  {
    label: 'Get in touch',
    href: CONTACT_HREF,
    note: 'Tell us what you’re working on.',
  },
]

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
   * What the work did for the business, in one sentence. This is the line the
   * preview is built around — it runs at lede scale under the name, in
   * sentence case, and it is the only place on the page where a project gets
   * to make its own argument rather than leaving it to the screenshots.
   */
  readonly headline: string
  /** A sentence of context under the headline: what the job actually was. */
  readonly summary: string
  /**
   * What we did, as discrete pieces. Joined with a middot for display, so the
   * separator stays a presentation decision rather than something baked into
   * the copy.
   */
  readonly services: readonly string[]
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
    headline: 'Making homeschool record keeping feel less like record keeping.',
    summary:
      'Homeschool planning, product design, and development built around a more flexible way to learn.',
    services: ['Product strategy', 'UX', 'Website design', 'Development'],
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
    headline:
      'Helping a local property company look as established online as it does on the job.',
    summary:
      'A straightforward website built to explain the work, establish trust, and turn local traffic into estimate requests.',
    services: ['Website strategy', 'Design', 'Development'],
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
    headline: 'Making private cycle tracking feel private from the first click.',
    summary:
      'A focused landing experience built around clarity, discretion, and a strong point of view.',
    services: ['Brand direction', 'Website design', 'Development'],
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
    title: 'Grow without starting over.',
    body: 'Your website should be able to change with your business instead of holding it back.',
  },
  {
    title: "Know who you're calling.",
    body: 'When you need something, you talk to the people who know your website, not a support queue.',
  },
]

/**
 * What we do. Three, not four: branding sits below as a supporting capability
 * rather than an equal service, because most of the businesses this page is
 * written for arrive wanting a website and discover the identity question
 * second.
 *
 * The titles are the customer-facing labels and are deliberately plain. "Web
 * Applications" used to be one of them, which is a phrase that means something
 * to a developer and nothing to a shop owner — "Custom functionality" is the
 * same offer said in a way the buyer can price.
 */
export const CAPABILITIES: readonly Point[] = [
  {
    title: 'Business websites',
    body: 'From focused landing pages to full websites with all the moving parts.',
  },
  {
    title: 'Online selling',
    body: 'Stores, products, payments, shipping, local pickup, and the systems around them.',
  },
  {
    title: 'Custom functionality',
    body: "Portals, dashboards, workflows, integrations, and things an off-the-shelf website builder can't quite do.",
  },
]

/**
 * Branding, held apart from the three above: it is real work we take on, but
 * offering it as a fourth equal service muddles what this page is selling.
 * `title` is the name it goes by in structured data; `heading` is the question
 * it is introduced with on the page.
 */
export const BRANDING: Point & { readonly heading: string } = {
  title: 'Branding',
  heading: 'Need the identity too?',
  body: 'Brand direction and visual identity can be part of the project when the business needs more than a new website.',
}

/**
 * How it works. Three steps, in order — and numbered on the page, because the
 * promise the section makes is that there is no mystery to it.
 */
export const PROCESS: readonly Point[] = [
  {
    title: 'Figure it out',
    body: "We talk through the business, what's working, what's not, and what the website actually needs to accomplish.",
  },
  {
    title: 'Make it',
    body: 'You see the direction before we disappear into development. Then we design and build the real thing.',
  },
  {
    title: 'Put it to work',
    body: "We launch it, show you how everything works, and we're still here when something changes.",
  },
]

/**
 * Contact form chips. Order is the order they appear, and they are phrased the
 * way someone would say them out loud rather than as service names — the form
 * is asking what you need, not asking you to categorise yourself.
 */
export const PROJECT_TYPES: readonly string[] = [
  'New website',
  'Replace my current website',
  'Sell online',
  'Build something custom',
  'Branding or visual identity',
  'Not sure yet',
]

/**
 * Where the contact form posts. The site builds to static files with no
 * server of its own, so this has to be an external form handler (Formspree,
 * Basin, Getform, or similar).
 *
 * TODO: paste the endpoint before launch. While it is empty the form still
 * renders but its submit button is disabled, so a visitor can never lose a
 * message to a form that posts nowhere. The page says nothing about it on
 * screen — a note about a missing endpoint is a message to us, not to a
 * customer — and warns on the build console instead.
 */
export const FORM_ENDPOINT = ''
