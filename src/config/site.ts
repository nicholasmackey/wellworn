/**
 * Single source of truth for site-wide metadata, navigation, and services.
 * Everything user-facing that isn't page content lives here.
 */

import { DEPLOYMENT_URL, withBase } from '../lib/paths'

export const SITE = {
  /**
   * Displayed brand name. "Creative" is part of the domain only, never the
   * mark. Set in sentence case, not caps: the wordmark artwork is already
   * uppercase, so shouting the name in running text only makes the two
   * disagree — and a screen reader spells an all-caps word out letter by
   * letter. Where the name is meant to look uppercase, use the artwork.
   */
  name: 'Wellworn',
  url: DEPLOYMENT_URL,
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
  ogImage: withBase('/og-image.jpg'),
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
  mark: withBase('/wellworn-mark.svg'),
  /** Wordmark for light backgrounds (cream). Intrinsic 2476×597. */
  wordmarkDark: withBase('/wellworn-wordmark-dark.svg'),
  /** Wordmark for dark backgrounds (charcoal/forest). Intrinsic 2476×597. */
  wordmarkLight: withBase('/wellworn-wordmark-light.svg'),
  /** Aspect ratio of the wordmarks, for computing width from a target height. */
  wordmarkRatio: 2476 / 597,
} as const

/**
 * Where every "Start a project" call to action points.
 *
 * A mailto rather than a form. The previous homepage carried a contact form
 * whose FORM_ENDPOINT was never configured, so its submit button shipped
 * permanently disabled and no message it collected could go anywhere. The new
 * homepage has no form section, and an address that works is worth more than a
 * form that does not. Change this one value to repoint every CTA on the site
 * at a /contact page later.
 */
export const CONTACT_HREF = `mailto:${SITE.email}`

/** One destination in the header navigation. */
export interface NavItem {
  readonly label: string
  /**
   * Root-relative: the header ships on every page, so homepage sections use a
   * path plus fragment and standalone destinations use their own route.
   */
  readonly href: string
}

/**
 * The header navigation. Three items, in page order.
 *
 * Three, and not one more. The reference this site is built against carries a
 * short bar of plain words and one filled action, and the moment a fourth
 * appears the bar starts asking to become a menu. Contact is not in this list
 * because it is the button beside it.
 */
export const NAV: readonly NavItem[] = [
  { label: 'Work', href: withBase('/#work') },
  { label: 'Services', href: withBase('/#services') },
  { label: 'Pricing', href: withBase('/pricing') },
]

/** The label on the one action in the header, and on every CTA on the page. */
export const CTA_LABEL = 'Start a project'

/** A titled paragraph. The shape most of the page's content takes. */
export interface Point {
  readonly title: string
  readonly body: string
}

/**
 * What we do, as the homepage service cards list it and as the structured data in
 * BaseLayout enumerates it. Kept here rather than in config/home.ts because
 * BaseLayout reads it on every page that asks for schema, and home.ts pulls in
 * a dozen images this file has no business dragging along behind it.
 *
 * `body` is the line printed under the title on the card. Both are approved
 * copy: do not reword either.
 */
export const SERVICES: readonly Point[] = [
  {
    title: 'Web Design',
    body: 'A site that looks like your business belongs there.',
  },
  {
    title: 'Development',
    body: 'Fast, responsive, reliable, and built to last.',
  },
  {
    title: 'Local SEO',
    body: 'Help nearby customers find you when they\u2019re ready to buy.',
  },
  {
    title: 'Reviews & Reputation',
    body: 'Make it easier to ask for reviews and put your best reputation forward.',
  },
  {
    title: 'Brand Refreshes',
    body: 'For businesses that are good at what they do but don\u2019t quite look it yet.',
  },
]
