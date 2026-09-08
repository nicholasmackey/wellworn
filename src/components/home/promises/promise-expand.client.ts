/**
 * THE FIELD EXPANSION — a promise band's photograph widening as the band
 * arrives.
 *
 * The three bands are three separate compositions stacked down the page, and
 * each one now opens rather than simply appearing: the photographic field
 * starts short of its resting width, anchored to the edge of the page it will
 * finish against, and grows inward toward the copy as the band scrolls up.
 * The field is a real width, not a scale — `cover` re-crops as it goes, so the
 * picture opens out instead of being stretched into place.
 *
 * WHAT THIS FILE DECIDES. One number per band, 0 to 1, published as
 * `--promise-expand` on the band's visual column. Everything the number means
 * is in PromiseSection's own stylesheet: the width of the field, and the
 * offset that keeps the demonstration centred over it. Nothing here knows a
 * pixel.
 *
 * IT IS A POSITION, NOT AN EVENT. The number is read off the field's place in
 * the viewport every frame it is on screen, so scrolling back up runs the
 * whole thing backwards with no state to unwind. That is also why there is no
 * transition on the width: the scroll is the timeline, and a transition on top
 * of it would only lag behind the finger.
 *
 * WHAT IT COSTS. One observer and one rAF-throttled scroll listener for the
 * page. Only the fields actually near the viewport are measured, which is one
 * or two of the three, and a field whose number has not changed is not written
 * to at all.
 *
 * REDUCED MOTION. Nothing runs. `--promise-expand` falls back to 1 in the
 * stylesheet, which is the resting layout, so the fields are simply already
 * open.
 */

/**
 * The travel, as the position of the field's top edge in viewport heights:
 * the expansion starts as the field crosses the bottom of the screen and is
 * finished by the time its top is a fifth of the way up, which is where the
 * band is settled into reading position. Most of it therefore happens with
 * the photograph already partly on screen — a field that finished any earlier
 * would have done all its opening below the fold.
 */
const START = 1;
const END = 0.2;

const SELECTOR = '[data-promise-field]';

/** What each field was last told, so an unchanged frame writes nothing. */
const written = new WeakMap<HTMLElement, string>();

/** The fields near enough to the viewport to be worth measuring. */
const active = new Set<HTMLElement>();

/**
 * Fields that were already on screen when the script started, and so have no
 * arrival to play: a reload part way down the page, or a link straight to a
 * band's own fragment. They are held open until they leave the viewport, at
 * which point they go back to being ordinary and open again on the way in.
 * Without this, taking over from the stylesheet's resting fallback would
 * narrow a photograph the reader is already looking at.
 */
const pinned = new Set<HTMLElement>();

let frame = 0;
let started = false;

/**
 * How far into its arrival a field is. Clamped at both ends — above the
 * viewport is finished, below it has not begun — and eased so it neither
 * starts nor stops abruptly.
 */
function progress(field: HTMLElement): number {
	const viewport = window.innerHeight || document.documentElement.clientHeight;
	const top = field.getBoundingClientRect().top;
	const raw = (START * viewport - top) / ((START - END) * viewport);
	const p = raw <= 0 ? 0 : raw >= 1 ? 1 : raw;

	/* Smoothstep. The ends are where the eye is most likely to be on the
	   photograph, and a linear ramp shows its two corners there. */
	return p * p * (3 - 2 * p);
}

function write(field: HTMLElement): void {
	const value = pinned.has(field) ? '1' : progress(field).toFixed(3);
	if (written.get(field) === value) return;

	written.set(field, value);
	field.style.setProperty('--promise-expand', value);
}

function update(): void {
	frame = 0;
	for (const field of active) write(field);
}

function schedule(): void {
	if (frame) return;
	frame = requestAnimationFrame(update);
}

export function initPromiseExpand(): void {
	if (started) return;
	started = true;

	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

	const fields = document.querySelectorAll<HTMLElement>(SELECTOR);
	if (fields.length === 0) return;

	/* No observer, no measuring: the resting layout is the fallback and it is
	   the state everything is designed around anyway. */
	if (!('IntersectionObserver' in window)) return;

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				const field = entry.target as HTMLElement;

				if (entry.isIntersecting) {
					active.add(field);
				} else {
					active.delete(field);
					pinned.delete(field);
				}

				/* Written on the way out as well as the way in, so a field
				   that leaves the screen is left at the clamped end of its
				   travel rather than wherever the last frame caught it. */
				write(field);
			}
		},
		/* A margin either side, so a field is already being measured by the
		   time it has anything to show. */
		{ rootMargin: '25% 0px 25% 0px' },
	);

	const viewport = window.innerHeight || document.documentElement.clientHeight;
	for (const field of fields) {
		if (field.getBoundingClientRect().top < viewport) pinned.add(field);
		write(field);
		observer.observe(field);
	}

	window.addEventListener('scroll', schedule, { passive: true });
	window.addEventListener('resize', schedule, { passive: true });
}
