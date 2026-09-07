/**
 * HOMEPAGE CONTENT
 * ----------------------------------------------------------------------------
 * Every word and every picture the homepage renders, in the order the page
 * renders them. index.astro composes; it does not author.
 *
 * The marketing copy in this file is approved and is used verbatim. Do not
 * reword it, do not "tighten" it, do not add to it, and do not introduce em
 * dashes. If a line reads oddly, that is a conversation to have before the
 * edit, not after it.
 *
 * Photographs are imported rather than referenced by URL so Astro's <Image>
 * can resize and re-encode them — several of the source files are 4000px-plus
 * and figure-it-out.jpg alone is 5809px wide. Importing them here rather than
 * in the page keeps each file beside the alt text that describes it.
 *
 * Anything under assets/placeholder/ is a generated stand-in, not artwork. The
 * frames say so on their face. See the handover notes for the list of real
 * assets still to be supplied.
 */

import type { Point } from './site'

/* Real photography. Four pictures of people and places doing actual work. */
import bakeryImage from '../assets/bakery.jpg'
import customerImage from '../assets/customer.jpg'
import figureItOutImage from '../assets/figure-it-out.jpg'
import houseDuskImage from '../assets/hero-house-dusk.jpg'
import heroPoster from '../assets/hero-poster.jpg'

/* Generated placeholders, awaiting real frames. */
import testimonial01 from '../assets/placeholder/testimonial-01.jpg'
import testimonial02 from '../assets/placeholder/testimonial-02.jpg'
import testimonial03 from '../assets/placeholder/testimonial-03.jpg'
import contractorTruck from '../assets/placeholder/contractor-truck.jpg'
import engravingWorkshop from '../assets/placeholder/engraving-workshop.jpg'
import donutPackaging from '../assets/placeholder/donut-packaging.jpg'
import signage from '../assets/placeholder/signage.jpg'

/* ==========================================================================
   1 — HERO
   ========================================================================== */

export const HERO = {
  heading: 'Good businesses deserve good websites.',
  body: 'We build websites for small businesses that want to get found, earn trust, and make it easy for customers to do business with them.',

  /**
   * The still sits UNDER the video rather than in the video's poster
   * attribute, which buys two things a poster cannot: a responsive srcset, and
   * a real element for the browser to treat as the LCP candidate while the
   * large video file is still arriving. It is also the whole picture for
   * reduced-motion visitors, so it keeps its alt text.
   *
   * This frame is frame one of hero.mp4, which is the point: it is what the
   * video paints anyway, so there is no cut when playback starts.
   */
  poster: heroPoster,
  posterAlt:
    'Two shopkeepers at a work table in a sunlit clothing store, sorting stock beside a laptop and a rail of garments.',

  /**
   * Served out of public/ rather than from R2. That puts ~10MB back in the
   * repo and in every deploy, and it makes the preconnect to
   * assets.wellworncreative.com in BaseLayout dead weight — nothing on the
   * marketing site fetches from that origin any more.
   *
   * !! THE LEVEL IS WRONG ON THE CURRENT FILE. !!
   *
   * H.264 level is load-bearing here. x264 derives it from the DPB, and at
   * 1920x1080 a fifth reference frame needs more DPB than Level 4.2 allows, so
   * it stamps the stream Level 5.0 — which iPhone hardware decoders refuse
   * outright. That is why this hero once played on every desktop and silently
   * stayed a still on iOS. wellworn-hero-web-26.mp4 is High@5.0, the same
   * stamp, so it will reproduce that bug. It wants re-encoding with
   * `-profile:v high -level:v 4.0 -refs 4`, and `ffprobe` should report
   * level=40 before it ships.
   */
  videoSrc: '/videos/wellworn-hero-web-26.mp4',
} as const

/* ==========================================================================
   3 — CLIENT LOGO CAROUSEL
   ========================================================================== */

export interface ClientLogo {
  readonly src: string
  /**
   * The business name, and nothing else. The marquee announces itself as a
   * list of businesses we have worked with, so "logo" in here would have every
   * entry read "… logo, … logo, … logo".
   */
  readonly alt: string
  /** Intrinsic size, so the row reserves its space before the file lands. */
  readonly width: number
  readonly height: number
}

/**
 * The businesses in the marquee.
 *
 * NOT A LIST. Every .svg sitting in src/assets/logos/clients is picked up at
 * build time by the glob below, so adding a client is dropping a file in that
 * folder and nothing else: no filename to register here, no alt text to wire
 * up, no import to add. Nothing outside that folder can appear in the band,
 * which is the other half of the same rule.
 *
 * `eager: true` because this runs while the page is being built, not in the
 * browser: the modules have to be resolved by the time the markup is written,
 * and a lazy glob would hand back promises instead. Each module's default
 * export is Astro's ImageMetadata for the file, so the intrinsic width and
 * height come from the file itself rather than from a number typed in here.
 *
 * SVG rather than raster on purpose. They stay crisp at any size, and the
 * marquee paints them white over the hero footage with a filter, so one file
 * works on either ground.
 */
const LOGO_MODULES = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/logos/clients/*.svg',
  { eager: true },
)

/**
 * The business name, from the filename: cadence.svg reads "Cadence", and a
 * hyphenated file like sweet-gems.svg reads "Sweet Gems". A mark nobody has
 * bothered to name well in the filesystem is a filename problem, not a
 * component problem.
 */
function businessNameFrom(path: string): string {
  const base = path.split('/').pop()?.replace(/\.svg$/, '') ?? ''
  return base
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/*
 * Sorted by path so the band is in the same order on every build and on every
 * machine. Glob order is not guaranteed to be, and a marquee that reshuffles
 * itself between deploys is a diff nobody asked for.
 */
export const CLIENT_LOGOS: readonly ClientLogo[] = Object.entries(LOGO_MODULES)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, module]) => ({
    src: module.default.src,
    alt: businessNameFrom(path),
    width: module.default.width,
    height: module.default.height,
  }))

/* ==========================================================================
   4 — VIDEO TESTIMONIALS
   ========================================================================== */

export interface Testimonial {
  /** Served from public/, not the asset pipeline: Astro does not transcode video. */
  readonly videoSrc: string
  readonly poster: ImageMetadata
  /** What the poster frame shows. */
  readonly posterAlt: string
  /** The client's mark, in white, for the bottom-left overlay. */
  readonly logoSrc: string
  readonly logoAlt: string
  /**
   * Names the clip for a screen reader and for the play/pause control, which
   * would otherwise be three buttons all called "Play". No quote and no
   * customer name: neither has been supplied, and neither will be invented.
   */
  readonly label: string
}

/**
 * Exactly three, which is what the grid is built around.
 *
 * PLACEHOLDER, all of it. The clips are generated six-second stand-ins with no
 * audio track and the posters are generated frames that say so. Swap the file
 * paths and the four strings beside them; the player does not care what it is
 * playing.
 *
 * When the real clips arrive they want the same encode constraint the hero is
 * under — H.264 High@4.0, refs capped at 4 — or iOS will refuse them.
 */
export const TESTIMONIALS: readonly Testimonial[] = [
  {
    videoSrc: '/videos/testimonial-01.mp4',
    poster: testimonial01,
    posterAlt: 'Placeholder frame for the first client testimonial.',
    logoSrc: '/images/logos/client-01-white.svg',
    logoAlt: 'Client logo placeholder 01',
    label: 'Client testimonial 01',
  },
  {
    videoSrc: '/videos/testimonial-02.mp4',
    poster: testimonial02,
    posterAlt: 'Placeholder frame for the second client testimonial.',
    logoSrc: '/images/logos/client-02-white.svg',
    logoAlt: 'Client logo placeholder 02',
    label: 'Client testimonial 02',
  },
  {
    videoSrc: '/videos/testimonial-03.mp4',
    poster: testimonial03,
    posterAlt: 'Placeholder frame for the third client testimonial.',
    logoSrc: '/images/logos/client-03-white.svg',
    logoAlt: 'Client logo placeholder 03',
    label: 'Client testimonial 03',
  },
]

/* ==========================================================================
   5, 6, 7 — THE THREE PROMISES
   --------------------------------------------------------------------------
   Get found. Earn trust. Make it easy to do business.

   These three lines are the core Wellworn promise and they are treated as
   brand language: they open three feature bands here and they close the page
   as the closing statement. They are used verbatim in both places.
   ========================================================================== */

export interface PromiseBand {
  /** Fragment id, where the section is a link target. */
  readonly id?: string
  readonly heading: string
  /** One paragraph per entry. Rendered in order, as separate <p> elements. */
  readonly body: readonly string[]
  readonly image: ImageMetadata
  readonly imageAlt: string
  /**
   * Which side the photograph takes on a desktop split. Alternated down the
   * page so three bands built from the same parts do not read as one component
   * stamped out three times.
   */
  readonly imageSide: 'left' | 'right'
  /** The ground the band sits on, which alternates with it. */
  readonly ground: 'white' | 'cream'
}

export const PROMISES: readonly PromiseBand[] = [
  {
    id: 'get-found',
    heading: 'Get found.',
    body: [
      'When someone searches for what you do, your business should have a fighting chance of showing up.',
      'We build with search, local visibility, and the way real customers look for businesses in mind.',
    ],
    image: houseDuskImage,
    imageAlt:
      'A house at dusk with its windows and porch lit, photographed from the street at the end of a working day.',
    imageSide: 'right',
    ground: 'white',
  },
  {
    id: 'earn-trust',
    heading: 'Earn trust.',
    body: [
      'People are checking you out before they ever call, visit, or buy.',
      'Your website should make them feel like they found the right place.',
    ],
    image: customerImage,
    imageAlt: 'A shopkeeper leaning over the counter to hand something to a customer.',
    imageSide: 'left',
    ground: 'cream',
  },
  {
    id: 'make-it-easy',
    heading: 'Make it easy to do business.',
    body: [
      'Your customers shouldn’t have to hunt for your services, your hours, your phone number, or what to do next.',
      'We make the path from finding you to becoming a customer obvious.',
    ],
    image: bakeryImage,
    imageAlt: 'A baker working at a bench, shaping dough with both hands.',
    imageSide: 'right',
    ground: 'white',
  },
]

/* ==========================================================================
   8 — BUILT AROUND YOUR BUSINESS
   ========================================================================== */

export const SERVICES_INTRO = {
  heading: 'Built around your business.',
  body: [
    'No bloated templates. No pile of features you don’t need.',
    'We figure out what your customers need to see, then build the site around that.',
  ],
} as const

/**
 * The rows themselves live in config/site.ts as SERVICES, because BaseLayout's
 * structured data reads them on every page and this file drags a dozen images
 * along behind it. Re-exported here so the page has one import for its
 * content.
 */
export type { Point }
export { SERVICES } from './site'

/* ==========================================================================
   9 — PRICING
   ========================================================================== */

/** One line in a plan. */
export interface PlanFeature {
  readonly label: string
  /**
   * The capability underneath the label, where the label is a summary of
   * something more specific. Set on two rows only, and it exists to make the
   * plan concrete without changing a word of the visible plan language: what
   * "Search setup" and "Updates + support" actually mean.
   */
  readonly detail?: string
}

export interface Plan {
  readonly name: string
  /** The small label above the name. Only one plan carries one. */
  readonly badge?: string
  readonly body: string
  readonly price: string
  readonly features: readonly PlanFeature[]
  /** A line under the features. Only the first plan carries one. */
  readonly note?: string
}

export const PRICING = {
  eyebrow: 'Pricing',
  heading: 'A website that earns its keep.',
  body: 'Straightforward pricing. No giant upfront bill, no hidden hosting fees, and no getting left on your own after launch.',
} as const

/**
 * Two plans. There is no third, there is no enterprise tier, and there is no
 * "most popular" label — the only badge on this page is the one below, and it
 * says BEST VALUE.
 */
export const PLANS: readonly Plan[] = [
  {
    name: 'Website',
    body: 'Everything a small business needs to get online and stay there.',
    price: '$175/mo.',
    features: [
      { label: 'Design + development' },
      { label: 'Hosting + SSL' },
      { label: 'Mobile optimization' },
      { label: 'Forms + analytics' },
      { label: 'Search setup', detail: 'Google Search Console' },
      { label: 'Updates + support', detail: 'Ongoing maintenance' },
    ],
    note: '30-day money-back guarantee',
  },
  {
    name: 'Website + Growth',
    badge: 'Best value',
    body: 'Your website, plus the tools that help turn more customers into business.',
    price: '$297/mo.',
    features: [
      { label: 'Everything in Website' },
      { label: 'Review requests' },
      { label: 'Review monitoring' },
      { label: 'Missed-call text back' },
      { label: 'Google Business help' },
      { label: 'Local visibility tools' },
    ],
  },
]

/* ==========================================================================
   10 — NEED MORE THAN A WEBSITE
   ========================================================================== */

export interface AdditionalService {
  readonly title: string
  /**
   * Where a price would go. Reviews & Reputation says which plan it is part of
   * rather than repeating $297: the plan directly above already sells that
   * offer at that price, and printing the figure twice would read as two
   * different ways to buy the same thing. Local SEO has no price because none
   * has been set, and none is invented here.
   */
  readonly price?: string
  /** A paragraph, for the entries that take prose rather than a list. */
  readonly body?: string
  /** A list, for the entries that take capabilities rather than prose. */
  readonly items?: readonly string[]
  readonly cta?: { readonly label: string; readonly href: string }
}

export const ADDITIONAL = {
  heading: 'Need more than a website?',
  body: 'We can help with the things that bring people to it and turn them into customers.',
} as const

/**
 * Three entries, and the first one needs explaining.
 *
 * Reviews & Reputation is the same offer Website + Growth sells, at the same
 * price, two screens further down the page. Presenting it here as a separate
 * $297/month product would put two prices on one thing and leave a reader
 * working out which of them they are being asked to pay. So the plan above is
 * the primary presentation and this entry is the additional explanation the
 * plan's six words cannot carry: what "Review requests" and "Google Business
 * help" actually amount to. Its price slot names the plan instead of repeating
 * the figure.
 *
 * The price has not been changed. It appears once, on the plan.
 */
export const ADDITIONAL_SERVICES: readonly AdditionalService[] = [
  {
    title: 'Reviews & Reputation',
    price: 'Included in Website + Growth',
    items: [
      'Automated review requests',
      'Email and text follow-ups',
      'Google review links',
      'Review monitoring',
      'Help responding to reviews',
      'Missed-call text back',
    ],
  },
  {
    title: 'Local SEO',
    items: [
      'Google Business Profile management',
      'Local search optimization',
      'Service and location pages',
      'Search performance monitoring',
      'Ongoing improvements',
    ],
    cta: { label: 'Talk to us about Local SEO', href: '' },
  },
  {
    title: 'Brand Refreshes',
    price: 'Priced by project',
    body: 'Logo cleanup, typography, colors, and the pieces your business needs to look consistent online and off.',
  },
]

/* ==========================================================================
   11 — YOUR WEBSITE SHOULD EARN ITS KEEP
   ========================================================================== */

export const PHILOSOPHY = {
  heading: 'Your website should earn its keep.',
  body: [
    'Looking good matters.',
    'But a good website should also help bring people in, answer their questions, build confidence, and make running your business a little easier.',
    'That’s what we build.',
  ],
  image: figureItOutImage,
  imageAlt:
    'Two people working through something together at a table, one of them talking, a laptop open between them.',
} as const

/* ==========================================================================
   12 — CLOSING COLLAGE
   ========================================================================== */

export interface CollageTile {
  readonly src: ImageMetadata
  /**
   * Decorative. The tiles are a backdrop for a statement that is already in the
   * markup as a heading, and announcing eight photographs before it would bury
   * the one thing this section says. Every tile carries alt="" — the string
   * here is for us, so the file is identifiable in the data.
   */
  readonly note: string
  /**
   * Placement on the desktop scatter, as percentages of the section box: `top`
   * and `left` are the tile's origin, `w` is its width.
   */
  readonly top: number
  readonly left: number
  readonly w: number
  /**
   * The frame's aspect ratio, as a CSS `aspect-ratio` value.
   *
   * The tile crops the photograph to this rather than taking the picture's own
   * proportions, and that is what makes the scatter placeable at all: with
   * intrinsic ratios, a tall source at 15% width resolves to a height nobody
   * wrote down, and tiles silently overlap each other and the statement. Here
   * the height is w × ratio and can be checked against `top` by hand — which is
   * what the numbers below have been.
   */
  readonly ar: string
  /** A few degrees of tilt, so the wall of pictures is not a grid. */
  readonly rotate: number
  /**
   * Whether this tile survives the mobile composition. Four of the eight do:
   * a phone gets a legible band of pictures above and below the statement
   * rather than a shrunken version of the desktop scatter.
   */
  readonly mobile: boolean
}

export const CLOSING = {
  /**
   * The three promise lines again, and this is the second and last time they
   * appear on the page. Same words, verbatim.
   */
  lines: ['Get found.', 'Earn trust.', 'Make it easy to do business.'],
} as const

/**
 * Eight tiles: four real photographs and four generated placeholders that name
 * the subject the finished frame should show.
 *
 * Hand-placed rather than gridded, and the middle of the section is left empty
 * on purpose: the statement has to stay the thing you read first. Every entry
 * has been checked so that `top` plus the height its `w` and `ar` produce stays
 * inside the section, and so that nothing crosses the band the heading and its
 * action occupy — roughly 30% to 70% across, 30% to 70% down. Move one and
 * check the other seven.
 */
export const COLLAGE: readonly CollageTile[] = [
  // Left edge, top to bottom.
  { src: bakeryImage, note: 'baker at work', top: 4, left: 2, w: 15, ar: '4 / 5', rotate: -3, mobile: true },
  { src: signage, note: 'shop signage (placeholder)', top: 46, left: 4, w: 13, ar: '1 / 1', rotate: 2.5, mobile: false },
  { src: contractorTruck, note: 'contractor truck (placeholder)', top: 72, left: 14, w: 16, ar: '4 / 3', rotate: -2, mobile: true },
  // Top and bottom, just clear of the statement's measure.
  { src: customerImage, note: 'counter service', top: 2, left: 18, w: 11, ar: '1 / 1', rotate: 3, mobile: false },
  { src: donutPackaging, note: 'donut packaging (placeholder)', top: 76, left: 34, w: 13, ar: '4 / 3', rotate: 2, mobile: false },
  // Right edge, top to bottom.
  { src: engravingWorkshop, note: 'engraving workshop (placeholder)', top: 3, left: 66, w: 13, ar: '4 / 5', rotate: -2.5, mobile: false },
  { src: houseDuskImage, note: 'finished property at dusk', top: 40, left: 82, w: 15, ar: '4 / 3', rotate: -3, mobile: true },
  { src: figureItOutImage, note: 'working it out together', top: 70, left: 68, w: 14, ar: '1 / 1', rotate: 2.5, mobile: true },
]
