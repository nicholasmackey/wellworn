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
import { SERVICES } from './site'
import { withBase } from '../lib/paths'

/* Real photography. Four pictures of people and places doing actual work. */
import bakeryImage from '../assets/bakery.jpg'
import customerImage from '../assets/customer.jpg'
import figureItOutImage from '../assets/figure-it-out.jpg'
import houseDuskImage from '../assets/hero-house-dusk.jpg'
import heroPoster from '../assets/hero-poster.jpg'

/* The owner, and the only portrait on the site. The pricing section is where
   the page names a price, and a price is easier to trust from a face than from
   a card, so this is the one place a photograph of a person is used. */
import nicholasPortrait from '../assets/nicholas-mackey-owner.jpg'

/* The three promise bands. Each one is a soft, grainy, deliberately abstract
   detail shot of the trade its demonstration is about — the pastries behind
   the bakery search, the roof behind the review, the workshop behind the quote
   request. They are painted as a full-height field with the demonstration
   floating on top, so they are cropped hard and none of the three is ever seen
   whole. Portrait sources, because the field they fill is tall. */
import bakerySearchImage from '../assets/promises/bakery-search.png'
import roofingReviewImage from '../assets/promises/roofing-review.png'
import cedarQuoteImage from '../assets/promises/cedar-request-quote.png'

/* Testimonial poster frames, each one lifted from its own clip so the still and
   the first painted frame of the video are the same picture. */
import davisPoster from '../assets/testimonials/davis.jpg'
import avioricPoster from '../assets/testimonials/avioric.jpg'
import veilPoster from '../assets/testimonials/veil.jpg'

/* The three client marks that sit in the corner of those clips. Every file in
   assets/logos/clients is already drawn in white, which is what the overlay
   wants, so no colour variant and no filter is involved. */
import davisLogo from '../assets/logos/clients/davis.svg'
import avioricLogo from '../assets/logos/clients/avioric.svg'
import veilLogo from '../assets/logos/clients/veil.svg'

/* Screenshots of finished client work. Real sites, captured as they ship, and
   the only things on the service rail that are allowed to stand as proof of
   what a finished Wellworn project looks like. */
import davisSite from '../assets/projects/davis-01.png'
import veilSite from '../assets/projects/veil-01.png'
import veilPhone from '../assets/projects/veil-02.png'

/* Generated placeholders, awaiting real frames. */
import contractorTruck from '../assets/placeholder/contractor-truck.jpg'
import engravingWorkshop from '../assets/placeholder/engraving-workshop.jpg'
import donutPackaging from '../assets/placeholder/donut-packaging.jpg'
import signage from '../assets/placeholder/signage.jpg'

/* ==========================================================================
   1 — HERO
   ========================================================================== */

export const HERO = {
  heading: ['Local businesses', 'deserve good websites.'] as const,
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
  videoSrc: withBase('/videos/wellworn-hero-web-26.mp4'),
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
const LOGO_MODULES = import.meta.glob<{ default: ImageMetadata }>('../assets/logos/clients/*.svg', {
  eager: true,
})

/**
 * The business name, from the filename: cadence.svg reads "Cadence", and a
 * hyphenated file like sweet-gems.svg reads "Sweet Gems". A mark nobody has
 * bothered to name well in the filesystem is a filename problem, not a
 * component problem.
 */
function businessNameFrom(path: string): string {
  const base =
    path
      .split('/')
      .pop()
      ?.replace(/\.svg$/, '') ?? ''
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
  /**
   * The mark's intrinsic size, taken from the file rather than typed in, so the
   * corner reserves the right box before the SVG lands. Same reason ClientLogo
   * carries them.
   */
  readonly logoWidth: number
  readonly logoHeight: number
  readonly logoAlt: string
  /**
   * Where to hold the picture when the card's frame is narrower or shorter than
   * the clip is, which it always is: a CSS object-position, applied to the
   * poster and the video together so the two never disagree. Omitted means
   * dead centre, which is right for a subject sitting in the middle of the
   * frame and wrong for one sitting high in it.
   */
  readonly focal?: string
  /**
   * Names the clip for a screen reader and for the play/pause control, which
   * would otherwise be three buttons all called "Play". No quote and no
   * customer name: neither has been supplied, and neither will be invented.
   */
  readonly label: string
  /**
   * PLACEHOLDER COPY. The three clips are real and the businesses are real;
   * the written quote, the speaker's name and the star rating under each one
   * are not, because none has been supplied. They are here so the layout is
   * built and reviewed against the shape of the real thing, and they are data
   * rather than markup so replacing them is an edit to this file and nothing
   * else.
   */
  readonly quote: string
  readonly name: string
  readonly business: string
  /** Whole stars out of five. */
  readonly rating: number
}

/**
 * Exactly three, which is what the grid is built around.
 *
 * Real clients, real clips, real audio. Each poster is a frame lifted from the
 * clip beside it, so the still the card shows is a frame the video paints
 * anyway and there is no cut when playback starts.
 *
 * The clips are served from public/ because Astro's asset pipeline does not
 * transcode video. They are encoded to the same constraint the hero is under,
 * H.264 High@4.0 with refs capped at 4, or iOS refuses them.
 */
/**
 * The one line over the section. Plain, spoken, and making no claim the clips
 * do not make themselves: it says who is talking and leaves the talking to
 * them.
 */
export const TESTIMONIALS_HEADING = "Here's what folks have to say about working with us."

export const TESTIMONIALS: readonly Testimonial[] = [
  {
    videoSrc: withBase('/videos/testimonial-01.mp4'),
    poster: davisPoster,
    posterAlt: 'Two men outdoors under a tree on a bright day, talking to camera.',
    logoSrc: davisLogo.src,
    logoWidth: davisLogo.width,
    logoHeight: davisLogo.height,
    logoAlt: 'Davis',
    /* Both faces sit high in a tall phone frame, so a centred crop takes the
       top of the nearer man's head off. */
    focal: '50% 15%',
    label: 'the Davis testimonial',
    quote:
      'PLACEHOLDER: one or two lines on what changed for the business after the site went live.',
    name: 'PLACEHOLDER Name',
    business: 'Davis',
    rating: 5,
  },
  {
    videoSrc: withBase('/videos/testimonial-02.mp4'),
    poster: avioricPoster,
    posterAlt: 'A man in a cap and dark hooded sweatshirt talking to camera indoors.',
    logoSrc: avioricLogo.src,
    logoWidth: avioricLogo.width,
    logoHeight: avioricLogo.height,
    logoAlt: 'Avioric',
    label: 'the Avioric testimonial',
    quote:
      'PLACEHOLDER: one or two lines on what changed for the business after the site went live.',
    name: 'PLACEHOLDER Name',
    business: 'Avioric',
    rating: 5,
  },
  {
    videoSrc: withBase('/videos/testimonial-03.mp4'),
    poster: veilPoster,
    posterAlt: 'A woman in an olive sweater talking to camera in front of a blue wall hanging.',
    logoSrc: veilLogo.src,
    logoWidth: veilLogo.width,
    logoHeight: veilLogo.height,
    logoAlt: 'Veil',
    label: 'the Veil testimonial',
    quote:
      'PLACEHOLDER: one or two lines on what changed for the business after the site went live.',
    name: 'PLACEHOLDER Name',
    business: 'Veil',
    rating: 5,
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
   * `object-position` for the photograph, because the field it fills is a
   * different shape on every screen and centring these three throws away the
   * part of each one worth keeping. Written as a percentage pair.
   */
  readonly imageFocus?: string
  /**
   * How far past `cover` the photograph is pushed, as a scale about that same
   * focal point. `cover` alone barely crops a portrait source in a portrait
   * field; these are atmosphere rather than subject, and they want to be in
   * close enough that no one reads them as an illustration.
   */
  readonly imageZoom?: number
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
    image: bakerySearchImage,
    imageAlt:
      'Trays of cinnamon rolls resting on a bakery worktable, shot close and shallow so the room falls away behind them.',
    /* Down and right, onto the tray. The top-left of the frame is an
       out-of-focus wall the picture can afford to lose. */
    imageFocus: '60% 95%',
    imageZoom: 1.55,
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
    image: roofingReviewImage,
    imageAlt: 'A roofer setting battens across a run of dark roof sheets, seen close over their shoulder.',
    /* Right and down, so the run of roof and the timber battens fill the
       field and the roofer stays a shoulder and an arm rather than a
       portrait. */
    imageFocus: '95% 70%',
    imageZoom: 1.4,
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
    image: cedarQuoteImage,
    imageAlt: 'A carpenter guiding a length of timber along a saw rail in a workshop.',
    /* Low and slightly right: the timber, the rail, the hand and the blue
       work shirt, with the head already outside the crop. */
    imageFocus: '55% 100%',
    imageZoom: 1.45,
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
export { SERVICES }

/* --------------------------------------------------------------------------
   THE PROOF ON EACH CARD.

   The rail shows the work rather than describing it, so every card needs a
   picture and, on three of them, something drawn that moves. All five are
   configured here and nothing about them is written into the component: swap
   a `background` for a real photograph, set a `link` when a case study
   finally exists, drop `placeholder` when a real frame lands, and the markup
   does not change.

   WHAT IS ALLOWED IN HERE. Screenshots of sites we actually built, the names
   of clients we actually have, and descriptions of what is visible in the
   frame. No rankings, no ratings, no scores, no traffic, no revenue, and no
   testimonial that was not given. Two of the five carry the existing promise
   demonstrations, which are drawn interfaces with invented businesses on
   them — their copy says what the demonstration shows and claims nothing
   about a client.
   -------------------------------------------------------------------------- */

/** What is drawn on top of a card's background when it opens. */
export type ServicePanel =
  /* The get found sequence, from the promise band, deferred until the card
     is the open one. */
  | 'local-search'
  /* The reputation sequence, likewise. */
  | 'reputation'
  /* A handset with a real screenshot on its screen. */
  | 'device'
  /* A client's old mark wiped through to the redrawn one. */
  | 'brand'

export interface ServiceProof {
  /**
   * The card's ground, collapsed and expanded. On the cards with no panel
   * this IS the proof — the Davis screenshot is the finished website — so it
   * carries real alt text. On the cards that draw a panel over it, it is
   * context and the panel does the talking.
   */
  readonly background: ImageMetadata
  /** Empty where the picture is a marked stand-in or pure ground. */
  readonly backgroundAlt: string
  /** Where to hold the crop, as a CSS object-position. Cards are narrow. */
  readonly focal?: string
  /** What is drawn over the background when the card opens. */
  readonly panel?: ServicePanel
  /** The screen inside a `device` panel. A real capture, or nothing. */
  readonly screen?: ImageMetadata
  readonly screenAlt?: string
  /** The client or project this card is showing. Omitted on the two demos. */
  readonly label?: string
  /** One or two short lines, shown only when the card is open. */
  readonly proof: string
  /**
   * A case study, where one exists. None does yet, so none is set — the card
   * simply renders without the link rather than pointing at a page that is
   * not there.
   */
  readonly link?: { readonly label: string; readonly href: string }
  /**
   * True while the picture is a generated stand-in rather than client work.
   * Nothing in the copy leans on it, so replacing the file is the whole job.
   */
  readonly placeholder?: boolean
}

export interface ServiceCard extends Point {
  /** Fragment-safe id, used to tie the button to the panel it opens. */
  readonly id: string
  readonly proof: ServiceProof
}

/**
 * Keyed by the service title, which is the only stable name SERVICES has.
 * A title with no entry here would render as a card with no proof, which is
 * why the assembly below throws instead.
 */
const PROOF: Readonly<Record<string, ServiceProof>> = {
  'Web Design': {
    background: davisSite,
    backgroundAlt:
      'The Davis Property Works website: a headline reading “Need work done around your home? Call Davis.” over a photograph of the owner at his truck.',
    /* The headline and the logo sit in the top-left quarter of the capture,
       and a card is a tall crop of a wide screenshot, so the frame is held
       there rather than at its centre. */
    focal: '22% 18%',
    label: 'Davis Property Works',
    proof: 'A landscaping and handyman business in Forney, Texas. Designed and built end to end.',
  },

  Development: {
    background: veilSite,
    backgroundAlt: 'The Veil website on a desktop screen, white type on black.',
    focal: '50% 30%',
    panel: 'device',
    screen: veilPhone,
    screenAlt: 'The same Veil site on a phone, showing the month calendar and recent entries.',
    label: 'Veil',
    proof:
      'The same build on a phone and on a desktop. One site, laid out for whatever it lands on.',
  },

  'Local SEO': {
    background: bakeryImage,
    backgroundAlt: '',
    panel: 'local-search',
    proof:
      'What getting found looks like: a search nearby, and the business people are looking for where they can see it.',
  },

  'Reviews & Reputation': {
    background: customerImage,
    backgroundAlt: '',
    panel: 'reputation',
    proof:
      'A review arrives and gets answered, so the next person checking you out sees both halves of it.',
  },

  'Brand Refreshes': {
    /* The proof itself is the panel: Hood's old logo wiped through to the
       brand we drew for them. Keep the marked placeholder out of the card. */
    background: signage,
    backgroundAlt: '',
    placeholder: true,
    panel: 'brand',
    label: 'Hood',
    proof:
      'Logo, type and colour put back together, and carried through to the signs and packaging.',
  },
}

/**
 * SERVICES with its proof attached, in the order SERVICES lists them. The
 * page hands this to the rail and the rail renders what it is given.
 */
export const SERVICE_RAIL: readonly ServiceCard[] = SERVICES.map((service) => {
  const proof = PROOF[service.title]
  if (!proof) throw new Error(`No proof configured for service “${service.title}”.`)

  return {
    ...service,
    id: service.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, ''),
    proof,
  }
})

/* ==========================================================================
   9 — PRICING
   ========================================================================== */

export const PRICING = {
  eyebrow: 'Pricing',

  /**
   * Two lines, and they are set as two lines rather than left to wrap. The
   * break is the argument — a better website, and then the objection it
   * answers — so it is written here instead of being whatever the column
   * width happens to produce.
   */
  heading: ['A better website.', 'Without the big upfront bill.'],

  upfront: '$0 down.',
  monthly: '$175/mo',

  /**
   * The lede, as two paragraphs rather than one. The first answers the money
   * objection — nothing up front, no second bill — and the second names, in
   * one breath, everything the one payment covers. The grid under it then
   * takes those five words and gives each of them a line, which is the whole
   * argument of this section: not $175 for a website, but $175 for all of it.
   */
  body: [
    'Launch a professional website for your business with no upfront cost and no separate hosting bill.',
    'Your website, hosting, updates, maintenance, and support are all included in one simple monthly payment.',
  ],

  /**
   * Six, in two columns of three. Four read as a short list of features; six
   * reads as an inventory, and the length of the inventory beside the one
   * figure above it is the point being made.
   */
  features: [
    {
      title: 'Website Design + Development',
      body: 'Designed and built specifically around your business.',
    },
    {
      title: 'Hosting Included',
      body: 'No separate hosting account, setup fee, or surprise bill.',
    },
    {
      title: 'Unlimited Edits',
      body: 'Need something changed? Send it over. Updates are included.',
    },
    {
      title: 'Direct Support',
      body: 'Work directly with the person who built your website when you need help.',
    },
    {
      title: 'Ongoing Website Maintenance',
      body: 'We keep your website updated, working properly, and taken care of.',
    },
    {
      title: 'Built for Better Results',
      body: 'Fast, mobile-friendly, and structured to help customers find and use your site.',
    },
  ],

  /* The line that has to land. It restates the figure after the inventory,
     so the last thing read is the price attached to all of it. */
  closing: '$0 down. No hidden setup fees. Everything above is included for $175/month.',

  /* Who is behind the price. */
  portrait: nicholasPortrait,
  portraitAlt: 'Nicholas Mackey, the owner of Wellworn.',
  ownerName: 'Nicholas Mackey',
  ownerRole: 'Owner / Software Engineer',
} as const

/* ==========================================================================
   10 — NEED MORE THAN A WEBSITE
   ========================================================================== */

export interface AdditionalService {
  readonly title: string
  /**
   * Where a price would go. Reviews & Reputation names the recurring plan it
   * belongs to rather than repeating its price on the homepage. Local SEO has
   * no price because none has been set, and none is invented here.
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
 * Reviews & Reputation belongs to Website + Growth on the standalone pricing
 * page. This homepage row names that plan instead of repeating its price and
 * uses the available room to explain what the short feature names amount to.
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
  {
    src: bakeryImage,
    note: 'baker at work',
    top: 4,
    left: 2,
    w: 15,
    ar: '4 / 5',
    rotate: -3,
    mobile: true,
  },
  {
    src: signage,
    note: 'shop signage (placeholder)',
    top: 46,
    left: 4,
    w: 13,
    ar: '1 / 1',
    rotate: 2.5,
    mobile: false,
  },
  {
    src: contractorTruck,
    note: 'contractor truck (placeholder)',
    top: 72,
    left: 14,
    w: 16,
    ar: '4 / 3',
    rotate: -2,
    mobile: true,
  },
  // Top and bottom, just clear of the statement's measure.
  {
    src: customerImage,
    note: 'counter service',
    top: 2,
    left: 18,
    w: 11,
    ar: '1 / 1',
    rotate: 3,
    mobile: false,
  },
  {
    src: donutPackaging,
    note: 'donut packaging (placeholder)',
    top: 76,
    left: 34,
    w: 13,
    ar: '4 / 3',
    rotate: 2,
    mobile: false,
  },
  // Right edge, top to bottom.
  {
    src: engravingWorkshop,
    note: 'engraving workshop (placeholder)',
    top: 3,
    left: 66,
    w: 13,
    ar: '4 / 5',
    rotate: -2.5,
    mobile: false,
  },
  {
    src: houseDuskImage,
    note: 'finished property at dusk',
    top: 40,
    left: 82,
    w: 15,
    ar: '4 / 3',
    rotate: -3,
    mobile: true,
  },
  {
    src: figureItOutImage,
    note: 'working it out together',
    top: 70,
    left: 68,
    w: 14,
    ar: '1 / 1',
    rotate: 2.5,
    mobile: true,
  },
]
