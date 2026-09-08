/**
 * Optional client theming for the generic questionnaire.
 *
 * A questionnaire may carry a small `theme` block — a logo and a handful of
 * colours. Nothing else. There is no client stylesheet, no client component and
 * no place for one: this module turns those few values into a fixed set of
 * semantic CSS custom properties, the page sets them on its root element, and
 * every questionnaire component reads the properties. A component never asks
 * which client it is rendering, because it cannot: the client is not in scope.
 *
 * Two rules shape everything below.
 *
 * 1. NO THEME MEANS NO OUTPUT. `resolveTheme(undefined)` returns null, the page
 *    sets no custom properties at all, and the defaults declared on `:root` in
 *    tokens.css — which are the existing Wellworn values — are what render. An
 *    unthemed questionnaire is therefore byte-identical to one built before
 *    this file existed, not merely similar to it.
 *
 * 2. A SUPPLIED COLOUR IS A REQUEST, NOT AN INSTRUCTION. Every value is checked
 *    against the ground it will actually be drawn on, at the ratio its role
 *    needs — 4.5:1 for anything read as text, 3:1 for a rule, a field border or
 *    a focus ring. A value that fails is deepened until it passes, and if it
 *    cannot pass it is replaced by a safe default. A client can make this page
 *    theirs; a client cannot make it unreadable.
 *
 * The defaults here MUST mirror the `--q-*` block in tokens.css. They are the
 * comparison used to decide what to emit, so a value that drifts out of step
 * shows up as a property emitted on a page that did not ask for one. The unit
 * tests pin both halves.
 */
import type { Theme } from './schema'

/** WCAG 1.4.3 — anything read as text. */
const TEXT_CONTRAST = 4.5
/** WCAG 1.4.11 — rules, field borders, focus rings, control fills. */
const OBJECT_CONTRAST = 3

/**
 * The current Wellworn questionnaire, as hex.
 *
 * Every value is a token from tokens.css, resolved by hand: the site's own
 * white, black and ink-medium, plus the four status colours the portals use.
 * Keeping them literal rather than reading them from CSS is what lets the
 * contrast checks below run at build time, in node, with nothing rendered.
 *
 * They are the design system rather than a palette of the questionnaire's own,
 * which is the point: an unthemed questionnaire is the same black on white,
 * with the same filled action and the same blue focus ring, as every other page
 * on the site.
 */
export const THEME_DEFAULTS = {
	/** --ww-white */
	background: '#ffffff',
	/** --ww-ink */
	text: '#000000',
	/** --ww-white — fields sit on the page's own ground */
	surface: '#ffffff',
	/** --ww-ink — section rules at an alpha, field borders at another */
	border: '#000000',
	/** --ww-ink — the submit button is .ww-btn-dark, the site's default ask */
	accent: '#000000',
	/** white on black, 21:1 */
	accentText: '#ffffff',
	/** --ww-ink-medium — what .ww-btn-dark hovers to */
	accentHover: '#333333',
	/** --ww-blue — the site's focus ring, on every page */
	focus: '#006aff',
	/** --ww-blue — accent-color on the native radios and checkboxes */
	control: '#006aff',

	/* The four status colours. Each has an edge value (fills, 2px rules, field
	   borders: 3:1) and an ink value (small text: 4.5:1), which is the split the
	   status palette already documents as its plain/-deep pairs.

	   info is the site's blue, which clears 4.5:1 on white in both roles, so its
	   edge and its ink are one value. error keeps its plain fill, which clears
	   3:1 on white. success and warning take their -deep values as the edge as
	   well: the plain fills reach 2.43:1 and 2.47:1 on white, below the non-text
	   floor, and neither is drawn anywhere today, so there is nothing to
	   preserve and no reason to introduce an edge that fails. */
	info: '#006aff',
	infoInk: '#006aff',
	success: '#17883c',
	successInk: '#17883c',
	warning: '#b85c00',
	warningInk: '#b85c00',
	error: '#d92b1f',
	errorInk: '#c0281f',
	/** white on state-blocked-deep, 5.89:1 — the destructive button */
	errorOn: '#ffffff',
} as const

/** The four semantic slots, in the order they are resolved and reported. */
const SEMANTIC = ['info', 'success', 'warning', 'error'] as const

/**
 * Type on a coloured fill, tried in this order.
 *
 * Two candidates, because the palette has two: this site sets white on black
 * and black on white and holds nothing in between for type. Whichever of them
 * can carry a label on the client's accent is the one that gets it.
 */
const ON_CANDIDATES = ['#ffffff', '#000000'] as const

type Rgb = readonly [number, number, number]

function parseHex(hex: string): Rgb {
	const value = hex.slice(1)
	const full =
		value.length === 3
			? value
					.split('')
					.map((c) => c + c)
					.join('')
			: value
	return [
		Number.parseInt(full.slice(0, 2), 16),
		Number.parseInt(full.slice(2, 4), 16),
		Number.parseInt(full.slice(4, 6), 16),
	]
}

function toHex(rgb: Rgb): string {
	return `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`
}

/** Lowercase, six digits. Everything compared or emitted goes through here. */
export function normalizeHex(hex: string): string {
	return toHex(parseHex(hex))
}

/** WCAG relative luminance. */
function luminance(rgb: Rgb): number {
	const [r, g, b] = rgb.map((c) => {
		const channel = c / 255
		return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
	}) as unknown as Rgb
	return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio, 1–21. Order does not matter. */
export function contrast(a: string, b: string): number {
	const one = luminance(parseHex(a))
	const two = luminance(parseHex(b))
	const [light, dark] = one > two ? [one, two] : [two, one]
	return (light + 0.05) / (dark + 0.05)
}

/** Straight sRGB blend. `weight` is how much of `toward` ends up in the result. */
function mix(base: string, toward: string, weight: number): string {
	const from = parseHex(base)
	const to = parseHex(toward)
	return toHex([
		from[0] + (to[0] - from[0]) * weight,
		from[1] + (to[1] - from[1]) * weight,
		from[2] + (to[2] - from[2]) * weight,
	])
}

/** The first candidate that is legible on `fill`, or null if none is. */
function pickOn(fill: string, minimum = TEXT_CONTRAST): string | null {
	return ON_CANDIDATES.find((candidate) => contrast(candidate, fill) >= minimum) ?? null
}

/**
 * Walk a colour away from the ground it sits on until it is legible on it.
 *
 * Mixing toward black or white — whichever the ground is not — is the same
 * move the palette's -deep values are: it holds the hue and spends only
 * lightness, so a client's red stays recognisably their red. Twenty-five 4%
 * steps reach the far end, so this either finds a value or proves there is
 * none.
 */
function deepen(color: string, ground: string, minimum: number): string | null {
	if (contrast(color, ground) >= minimum) return normalizeHex(color)

	const toward = luminance(parseHex(ground)) > 0.18 ? '#000000' : '#ffffff'
	for (let step = 1; step <= 25; step += 1) {
		const candidate = mix(color, toward, step * 0.04)
		if (contrast(candidate, ground) >= minimum) return candidate
	}
	return null
}

/** Black or white, whichever the ground can carry as body copy. */
function readableOn(ground: string): string {
	return contrast(THEME_DEFAULTS.text, ground) >= contrast('#ffffff', ground)
		? THEME_DEFAULTS.text
		: '#ffffff'
}

/**
 * The select's chevron, drawn in the resolved type colour.
 *
 * A data URI cannot read `currentColor`, and a `url()` cannot interpolate a
 * custom property, so the whole URI is the custom property instead. The only
 * author-derived part is a hex that the schema has already constrained to six
 * hex digits and that has been through `normalizeHex`, so nothing here can
 * carry a quote, a paren or a second declaration out of a YAML file.
 */
export function chevron(color: string): string {
	const stroke = `%23${normalizeHex(color).slice(1)}`
	return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='${stroke}' stroke-width='1.5' stroke-linecap='square'%3E%3Cpath d='M3 4.5 6 7.5 9 4.5'/%3E%3C/svg%3E")`
}

export interface ResolvedTheme {
	/** The page ground, for the mobile browser-chrome colour. */
	background: string
	/** Custom properties that differ from the defaults. Never empty in practice. */
	vars: Record<string, string>
	/** A trusted local path, straight from the definition. */
	logo?: string
	/** Which Wellworn wordmark the masthead can be seen against. */
	wordmark: 'dark' | 'light'
	/** What the browser should draw its own controls as. */
	scheme: 'light' | 'dark'
	/** Every value this resolver overrode, and why. Logged, never rendered. */
	notes: string[]
}

/**
 * Turn a definition's `theme` into custom properties, or into nothing at all.
 *
 * The order below is the dependency order and cannot be shuffled: type is
 * checked against the ground, the field surface against the type, the accent's
 * label against the accent, and every status colour against the ground. Each
 * step can only use values already settled above it.
 */
export function resolveTheme(theme: Theme | undefined): ResolvedTheme | null {
	if (!theme) return null

	const notes: string[] = []
	const groundThemed = theme.background !== undefined
	const background = normalizeHex(theme.background ?? THEME_DEFAULTS.background)

	/* Type. A ground the author chose is allowed to be anything; the type on it
	   is not. If what they asked for cannot be read, take the one of black and
	   white that can. */
	let text = normalizeHex(theme.text ?? (groundThemed ? readableOn(background) : THEME_DEFAULTS.text))
	if (contrast(text, background) < TEXT_CONTRAST) {
		text = readableOn(background)
		notes.push(`text was unreadable on ${background}; using ${text}`)
	}

	/* The field ground. Left unsaid on a themed page it lifts a little off the
	   page rather than staying white, which is the restrained derivation: 6% of
	   the type colour is a shade, not a second surface colour to maintain. */
	let surface = normalizeHex(theme.surface ?? (groundThemed ? mix(background, text, 0.06) : THEME_DEFAULTS.surface))
	if (contrast(text, surface) < TEXT_CONTRAST) {
		surface = background
		notes.push(`surface could not carry the text colour; using the page ground`)
	}

	/* Rules and field borders. Full strength here; the hairlines are this value
	   at an alpha, so one colour covers both. */
	let border = normalizeHex(theme.border ?? (groundThemed ? text : THEME_DEFAULTS.border))
	if (contrast(border, background) < OBJECT_CONTRAST) {
		border = text
		notes.push(`border was invisible on ${background}; using the text colour`)
	}

	/* The accent, and the label on it. The submit button is the one control on
	   this page that must be read before it is pressed, so its label is held to
	   4.5:1 and the accent itself is surrendered if nothing can carry it. */
	let accent = normalizeHex(theme.accent ?? (groundThemed ? text : THEME_DEFAULTS.accent))
	let accentText = normalizeHex(
		theme.accentText ?? pickOn(accent) ?? THEME_DEFAULTS.accentText,
	)
	if (contrast(accentText, accent) < TEXT_CONTRAST) {
		const rescued = pickOn(accent)
		if (rescued) {
			accentText = rescued
			notes.push(`accentText was unreadable on ${accent}; using ${rescued}`)
		} else {
			notes.push(`no legible label exists on accent ${accent}; falling back to the default accent`)
			accent = THEME_DEFAULTS.accent
			accentText = THEME_DEFAULTS.accentText
		}
	}

	/* Anything derived from the accent is only derived when the accent is
	   actually themed. A definition that supplies a logo and nothing else keeps
	   the questionnaire's own hover, focus ring and control colour. */
	const accentThemed = accent !== THEME_DEFAULTS.accent

	/* The hover fill. 12% toward the type colour, which darkens on a light page
	   and lightens on a dark one, and toward the ground instead if that is what
	   keeps the label legible. Never a tint of nothing: if neither direction
	   holds 4.5:1, the button simply does not change on hover. */
	let accentHover: string = THEME_DEFAULTS.accentHover
	if (accentThemed) {
		accentHover = accent
		for (const toward of [text, background]) {
			const candidate = mix(accent, toward, 0.12)
			if (contrast(accentText, candidate) >= TEXT_CONTRAST) {
				accentHover = candidate
				break
			}
		}
	}

	/* Focus. The one ring on the page, and the last thing to give up brand for
	   visibility: the accent if it can be seen on the ground, the portal's blue
	   if it can, the type colour if neither. */
	let focus: string = THEME_DEFAULTS.focus
	if (accentThemed) {
		focus =
			contrast(accent, background) >= OBJECT_CONTRAST
				? accent
				: contrast(THEME_DEFAULTS.focus, background) >= OBJECT_CONTRAST
					? THEME_DEFAULTS.focus
					: text
		if (focus !== accent) notes.push(`accent could not carry the focus ring; using ${focus}`)
	} else if (contrast(focus, background) < OBJECT_CONTRAST) {
		focus = text
		notes.push(`the default focus ring was invisible on ${background}; using the text colour`)
	}

	/* accent-color on the native radios and checkboxes. Measured against the
	   field surface, which is what they are drawn on. */
	let control: string = THEME_DEFAULTS.control
	if (accentThemed) {
		control = contrast(accent, surface) >= OBJECT_CONTRAST ? accent : THEME_DEFAULTS.control
	}
	if (contrast(control, surface) < OBJECT_CONTRAST) {
		control = text
		notes.push(`no accent could be seen on the field surface; controls use the text colour`)
	}

	/* The four status colours. Each resolves to an edge and an ink, and neither
	   is allowed to be the thing the reader cannot see. A supplied colour keeps
	   its hue and loses only lightness; one that cannot be rescued at all falls
	   back to the type colour, which is legible by construction — the page then
	   says what is wrong in words and a rule, which is what it already does,
	   since nothing here has ever been signalled by colour alone. */
	const semantic: Record<string, string> = {}
	for (const name of SEMANTIC) {
		const supplied = theme.semantic?.[name]
		const edgeSource = supplied ?? THEME_DEFAULTS[name]
		const inkSource = supplied ?? THEME_DEFAULTS[`${name}Ink` as const]

		const edge = deepen(edgeSource, background, OBJECT_CONTRAST)
		const ink = deepen(inkSource, background, TEXT_CONTRAST)
		if (!edge || !ink) notes.push(`${name} could not be made legible on ${background}`)

		semantic[name] = edge ?? text
		semantic[`${name}Ink`] = ink ?? text
	}

	/* Type on the error fill — the one filled status control, "Clear answers". */
	const errorOn = pickOn(semantic.error) ?? THEME_DEFAULTS.errorOn

	const resolved: Record<string, string> = {
		'--q-background': background,
		'--q-text': text,
		'--q-surface': surface,
		'--q-border': border,
		'--q-accent': accent,
		'--q-accent-text': accentText,
		'--q-accent-hover': accentHover,
		'--q-focus': focus,
		'--q-control': control,
		'--q-info': semantic.info,
		'--q-info-ink': semantic.infoInk,
		'--q-success': semantic.success,
		'--q-success-ink': semantic.successInk,
		'--q-warning': semantic.warning,
		'--q-warning-ink': semantic.warningInk,
		'--q-error': semantic.error,
		'--q-error-ink': semantic.errorInk,
		'--q-error-on': errorOn,
		'--q-chevron': chevron(text),
	}

	/* Only what actually differs. A theme that changes one colour emits one
	   property, and the rest of the page keeps reading the defaults on :root —
	   which is the same code path an unthemed questionnaire takes. */
	const defaults = defaultVars()
	const vars: Record<string, string> = {}
	for (const [property, value] of Object.entries(resolved)) {
		if (value !== defaults[property]) vars[property] = value
	}

	/* The light wordmark is artwork FOR dark grounds. Pick whichever of the two
	   can actually be seen, rather than trusting the ground to be white — the
	   Wellworn attribution at the top of a themed page has to survive the
	   theme. */
	const onDark = contrast('#ffffff', background) > contrast(THEME_DEFAULTS.text, background)

	return {
		background,
		vars,
		logo: theme.logo,
		wordmark: onDark ? 'light' : 'dark',
		scheme: onDark ? 'dark' : 'light',
		notes,
	}
}

/** The `:root` block in tokens.css, as data. Exported so the tests can pin it. */
export function defaultVars(): Record<string, string> {
	return {
		'--q-background': THEME_DEFAULTS.background,
		'--q-text': THEME_DEFAULTS.text,
		'--q-surface': THEME_DEFAULTS.surface,
		'--q-border': THEME_DEFAULTS.border,
		'--q-accent': THEME_DEFAULTS.accent,
		'--q-accent-text': THEME_DEFAULTS.accentText,
		'--q-accent-hover': THEME_DEFAULTS.accentHover,
		'--q-focus': THEME_DEFAULTS.focus,
		'--q-control': THEME_DEFAULTS.control,
		'--q-info': THEME_DEFAULTS.info,
		'--q-info-ink': THEME_DEFAULTS.infoInk,
		'--q-success': THEME_DEFAULTS.success,
		'--q-success-ink': THEME_DEFAULTS.successInk,
		'--q-warning': THEME_DEFAULTS.warning,
		'--q-warning-ink': THEME_DEFAULTS.warningInk,
		'--q-error': THEME_DEFAULTS.error,
		'--q-error-ink': THEME_DEFAULTS.errorInk,
		'--q-error-on': THEME_DEFAULTS.errorOn,
		'--q-chevron': chevron(THEME_DEFAULTS.text),
	}
}

/**
 * `vars` as a style attribute, or undefined when there is nothing to set.
 *
 * `color-scheme` rides along on a dark ground, and is the one declaration here
 * that is not a custom property. It has to be: a dark questionnaire still hands
 * the date picker, the select's popup and the scrollbars to the browser to
 * draw, and this is the only way to tell it which ground they are landing on.
 * It is a literal chosen from two by the resolver, never anything an author can
 * reach — the rest of the string is `--q-*` names paired with hex values the
 * schema has already constrained to six hex digits, so there is no way to close
 * a declaration and open another one from a YAML file.
 */
export function themeStyle(resolved: ResolvedTheme | null): string | undefined {
	if (!resolved) return undefined

	const declarations = Object.entries(resolved.vars).map(
		([property, value]) => `${property}:${value}`,
	)
	if (resolved.scheme === 'dark') declarations.push('color-scheme:dark')

	return declarations.length > 0 ? declarations.join(';') : undefined
}
