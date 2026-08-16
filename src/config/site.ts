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

  /** Used verbatim as the <title> on the homepage. */
  title: 'WELLWORN | Design, development, and photography',

  /** Default meta description. Keep under ~160 characters. */
  description:
    'Wellworn is an independent studio working across web design and development, brand identity, and real estate and commercial photography.',

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
  ogImageAlt: 'WELLWORN. Design, development, and photography.',
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

/* ==========================================================================
   Services
   --------------------------------------------------------------------------
   Two disciplines. The services deliberately do NOT get their own routes —
   each discipline page covers all of its services, anchored by `slug`. Adding
   a service here adds it to the homepage, its discipline page, and the
   structured data at once.
   ========================================================================== */

export interface ServiceItem {
  /** Short capability name, e.g. "Front-end development". */
  readonly label: string
  /** One-line elaboration. Shown on the discipline pages only. */
  readonly note: string
}

export interface Service {
  /**
   * Plain capability name. Used for the homepage list, the structured data,
   * and anywhere the service has to be recognisable rather than persuasive.
   */
  readonly title: string
  /**
   * Benefit-led heading for the discipline page, where the section is making
   * a case rather than labelling itself. The discipline pages render this as
   * the service heading and `title` as the label beneath it, so every service
   * needs one — the field stays optional only so a new service can be added
   * before its headline is written.
   */
  readonly headline?: string
  /** Anchor id on the discipline page. The structured data links to it. */
  readonly slug: string
  /** Short summary. Homepage card, page intro, and structured data. */
  readonly description: string
  readonly items: readonly ServiceItem[]
}

export interface Discipline {
  readonly title: string
  readonly href: string
  readonly description: string
  readonly services: readonly Service[]
}

export const DESIGN = {
  title: 'Design',
  href: '/design',
  description:
    'Websites and identity systems for small businesses, organizations, and independent brands.',
  services: [
    {
      title: 'Brand identity',
      headline: "Look like the business you're becoming.",
      slug: 'brand-identity',
      description:
        'A good identity makes a small business feel established before it ever has to explain itself.',
      items: [
        {
          label: 'Look professional',
          note: 'A clear identity that makes your business feel established.',
        },
        {
          label: 'Stay consistent',
          note: 'The same look across your site, social, print, and everything else.',
        },
        {
          label: 'Be recognizable',
          note: 'A visual system people can actually remember.',
        },
        {
          label: 'Have what you need',
          note: 'The core brand files and assets ready to use.',
        },
      ],
    },
    {
      title: 'Web design',
      headline: 'Make it easy to choose you.',
      slug: 'web-design',
      description:
        'Your site should make the business clear, make the next step obvious, and give people confidence before they ever call or email.',
      items: [
        {
          label: 'Build trust',
          note: "A site that looks like your business knows what it's doing.",
        },
        {
          label: 'Easy to navigate',
          note: 'Clear structure so people can find what they came for.',
        },
        {
          label: 'Look right everywhere',
          note: 'Designed for phones, tablets, and desktops.',
        },
        {
          label: 'Turn visits into action',
          note: "Make the next step obvious, whether that's calling, booking, buying, or getting in touch.",
        },
      ],
    },
    {
      title: 'Front-end development',
      headline: "Built so you don't have to start over.",
      slug: 'front-end-development',
      description:
        'Fast, easy to manage, and structured to keep working as your business changes.',
      items: [
        {
          label: 'Fast',
          note: 'Quick to load and responsive across devices.',
        },
        {
          label: 'Easy to update',
          note: 'Change the content you need to change without rebuilding the site.',
        },
        {
          label: 'Built for the long term',
          note: 'Structured so the site can keep working as the business changes.',
        },
        {
          label: 'Ready to launch',
          note: 'Tested, polished, and handed over ready to use.',
        },
      ],
    },
  ],
} as const satisfies Discipline

export const PHOTOGRAPHY = {
  title: 'Photography',
  href: '/photography',
  description: 'Real estate and commercial photography for properties, businesses, and brands.',
  services: [
    {
      title: 'Real estate photography',
      headline: "Show people what they're looking for.",
      slug: 'real-estate-photography',
      description:
        'Good property photography should make a space easy to understand and easy to want.',
      items: [
        {
          label: 'Interiors',
          note: 'Rooms that feel open, balanced, and true to the space.',
        },
        {
          label: 'Exteriors',
          note: 'The property, the approach, and the setting at their best.',
        },
        {
          label: 'Architecture',
          note: 'The materials and details that make the building worth noticing.',
        },
        {
          label: 'Ready to use',
          note: 'Edited files prepared for listings, print, and web.',
        },
      ],
    },
    {
      title: 'Commercial photography',
      headline: 'Look like the business people want to work with.',
      slug: 'commercial-photography',
      description:
        'Original photography gives your business something stock images never can: a visual identity that actually belongs to you.',
      items: [
        {
          label: 'People',
          note: 'Portraits and team photography that feel natural and credible.',
        },
        {
          label: 'Spaces',
          note: 'The places where your business happens.',
        },
        {
          label: 'Products',
          note: 'Clean, useful imagery for websites, campaigns, and sales.',
        },
      ],
    },
  ],
} as const satisfies Discipline

/** Ordered for the homepage and the footer. */
export const DISCIPLINES: readonly Discipline[] = [DESIGN, PHOTOGRAPHY] as const

export interface NavItem {
  readonly label: string
  readonly href: string
}

/**
 * Primary navigation, desktop and mobile. One entry per discipline — the
 * individual services live inside those two pages rather than on routes of
 * their own. Work and About are held back until those sections exist, rather
 * than shipped as links to nothing.
 */
export const NAV: readonly NavItem[] = DISCIPLINES.map((discipline) => ({
  label: discipline.title,
  href: discipline.href,
}))

/**
 * Where every "Get in touch" call to action points. Currently the contact
 * block at the foot of the page; change this one value to repoint them all
 * at a dedicated /contact page later.
 */
export const CONTACT_HREF = '/#contact'
