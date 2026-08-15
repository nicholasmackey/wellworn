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
  title: 'WELLWORN | Web Design, Brand Identity & Photography',

  /** Default meta description. Keep under ~160 characters. */
  description:
    'WELLWORN is a professional services company offering web design and development, brand identity, real estate photography, and general photography.',

  /**
   * TODO: confirm the real inbox before launch.
   * Derived from the domain, not verified.
   */
  email: 'work@wellworncreative.com',

  /**
   * Default social share image, relative to /public.
   * Leave empty until the asset exists — BaseLayout omits the og:image
   * tags entirely rather than publishing a broken reference.
   * Recommended: 1200×630, place at public/images/brand/og-default.jpg
   */
  ogImage: '',
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

export interface NavItem {
  readonly label: string
  readonly href: string
}

/**
 * Primary navigation. Currently points at homepage sections; swap the
 * hrefs for real routes (/work, /services…) when those pages are added.
 */
export const NAV: readonly NavItem[] = [
  { label: 'Work', href: '/#work' },
  { label: 'Services', href: '/#services' },
  { label: 'About', href: '/#about' },
] as const

export interface Service {
  readonly index: string
  readonly title: string
  readonly description: string
  readonly items: readonly string[]
}

export const SERVICES: readonly Service[] = [
  {
    index: '01',
    title: 'Web Design & Development',
    description:
      'Websites designed and built end to end, from structure and interface through to production front-end code.',
    items: ['Design', 'Front-end development', 'Content structure', 'Performance & accessibility'],
  },
  {
    index: '02',
    title: 'Brand Identity',
    description:
      'Visual identity systems: the marks, typography, colour, and standards that keep a business consistent everywhere it appears.',
    items: ['Logo & wordmark', 'Typography & colour', 'Identity systems', 'Brand guidelines'],
  },
  {
    index: '03',
    title: 'Real Estate Photography',
    description:
      'Property photography for listings, developments, and portfolios — interiors, exteriors, and architectural detail.',
    items: ['Interiors', 'Exteriors', 'Architectural detail', 'Listing-ready delivery'],
  },
  {
    index: '04',
    title: 'Photography',
    description:
      'General commercial photography for businesses that need considered imagery of their people, spaces, and work.',
    items: ['Commercial', 'Portraits', 'Spaces', 'Product & detail'],
  },
] as const
