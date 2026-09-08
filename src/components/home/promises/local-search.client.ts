/**
 * THE GET FOUND SEQUENCE.
 *
 * Five beats, fired from one timeline, once per page load, the first time the
 * frame is meaningfully in view:
 *
 *   zoom      the handset is pushed from half size to full size
 *   type      the query is written into the field
 *   list      the four results arrive, staggered
 *   sort      the featured business rises from third to first
 *   rate      its rating counts 3.5 to 5.0 and the stars turn yellow
 *
 * It is over in about three and a half seconds and then it stops. No loop, no
 * replay on hover, no replay on scrolling back — the state that holds is the
 * point being made.
 *
 * Two things cannot be done in the stylesheet and are the two exceptions here:
 * the reorder, because `order` is not a transitionable property, so the rows
 * are measured, reordered, measured again and carried from where they were to
 * where they now are; and the count from 3.5 to 5.0.
 */

import { afterTextReveal } from '../../reveal.client';

/** How much of the frame has to be in view before the sequence starts. */
const VISIBLE_RATIO = 0.4;

/**
 * Milliseconds from the trigger.
 *
 * The gap between `list` and `sort` is the important one and it is longer than
 * it looks like it needs to be. The results land staggered and the last of them
 * is still settling around 1500ms; the sequence then holds still for the better
 * part of a second so the viewer can actually read the list and find the
 * bakery sitting third before anything moves. Without that beat the rise starts
 * while the eye is still arriving and reads as a shuffle rather than as a
 * business climbing the page.
 */
const AT = {
	zoom: 100,
	type: 260,
	list: 1000,
	sort: 2200,
	rate: 3250,
} as const;

const TYPE_MS = 720;
const COUNT_MS = 340;

/**
 * How long the featured business takes to climb. Deliberately the slowest
 * thing in the sequence — the rise IS the argument, and at anything quicker it
 * reads as a jump cut rather than as a result moving up the page.
 */
const RISE_MS = 900;

const FINAL_SCORE = 5;

/**
 * Coarse locality from the browser's own time zone, which is already there —
 * no permission is asked for and none would be granted anyway. Only zones that
 * name one metropolitan area are listed; anything else falls through to "me",
 * which is what the markup already says.
 */
const LOCALITY: Readonly<Record<string, string>> = {
	'America/New_York': 'New York, NY',
	'America/Detroit': 'Detroit, MI',
	'America/Indiana/Indianapolis': 'Indianapolis, IN',
	'America/Kentucky/Louisville': 'Louisville, KY',
	'America/Chicago': 'Dallas, TX',
	'America/Denver': 'Denver, CO',
	'America/Boise': 'Boise, ID',
	'America/Phoenix': 'Phoenix, AZ',
	'America/Los_Angeles': 'Los Angeles, CA',
	'America/Anchorage': 'Anchorage, AK',
	'Pacific/Honolulu': 'Honolulu, HI',
	'America/Toronto': 'Toronto, ON',
	'America/Vancouver': 'Vancouver, BC',
	'America/Edmonton': 'Edmonton, AB',
	'America/Winnipeg': 'Winnipeg, MB',
	'America/Halifax': 'Halifax, NS',
	'Europe/London': 'London',
	'Europe/Dublin': 'Dublin',
	'Australia/Sydney': 'Sydney',
	'Australia/Melbourne': 'Melbourne',
	'Australia/Brisbane': 'Brisbane',
	'Australia/Perth': 'Perth',
	'Pacific/Auckland': 'Auckland',
};

/**
 * The query as it will be typed. `America/Chicago` covers a great deal of
 * ground, so the answer is a plausible nearby city rather than a claim — the
 * point of the line is that it reads like the viewer's own search, not that it
 * geolocates them.
 */
function query(fallback: string): string {
	try {
		const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		const place = LOCALITY[zone];
		return place ? `best bakery near ${place}` : fallback;
	} catch {
		return fallback;
	}
}

/** Write `text` into `el` a character at a time, over TYPE_MS. */
function typeInto(el: HTMLElement, text: string, done: () => void): void {
	const start = performance.now();

	const frame = (now: number): void => {
		const t = Math.min(1, (now - start) / TYPE_MS);
		el.textContent = text.slice(0, Math.ceil(t * text.length));
		if (t < 1) requestAnimationFrame(frame);
		else done();
	};

	requestAnimationFrame(frame);
}

/** Count one score up to its finished value. */
function countTo(el: HTMLElement, to: number): void {
	const from = Number(el.textContent ?? '0');
	const start = performance.now();

	const frame = (now: number): void => {
		const t = Math.min(1, (now - start) / COUNT_MS);
		/* The same shape as --ease-out: quick, then settling. */
		const eased = 1 - Math.pow(1 - t, 3);
		el.textContent = (from + (to - from) * eased).toFixed(1);
		if (t < 1) requestAnimationFrame(frame);
	};

	requestAnimationFrame(frame);
}

/**
 * The rise. Measure, reorder, measure again, put every row back where it
 * started, then release it to transition into its new place.
 */
function sort(root: HTMLElement): void {
	const list = root.querySelector<HTMLElement>('[data-results]');
	if (!list) return;

	const rows = Array.from(list.querySelectorAll<HTMLElement>('[data-result]'));
	const before = rows.map((row) => row.getBoundingClientRect().top);

	root.classList.add('is-sorted');

	const after = rows.map((row) => row.getBoundingClientRect().top);

	rows.forEach((row, i) => {
		const dy = before[i] - after[i];
		if (dy === 0) return;
		row.style.transition = 'none';
		row.style.transform = `translateY(${dy}px)`;
	});

	/* Force the moved-back positions to paint before releasing them, or the
	   browser coalesces both styles and nothing moves. */
	void list.offsetHeight;

	rows.forEach((row) => {
		/* Written out rather than handed back to the stylesheet, whose rule for
		   these rows carries the arrival stagger's transition-delay. */
		row.style.transition = `transform ${RISE_MS}ms cubic-bezier(0.33, 1, 0.68, 1)`;
		row.style.transform = '';
	});
}

function run(root: HTMLElement, text: string): void {
	const typed = root.querySelector<HTMLElement>('[data-typed]');
	const score = root.querySelector<HTMLElement>('[data-score]');

	window.setTimeout(() => root.classList.add('is-zoomed'), AT.zoom);

	window.setTimeout(() => {
		if (!typed) return;
		root.classList.add('is-typing');
		typeInto(typed, text, () => root.classList.remove('is-typing'));
	}, AT.type);

	window.setTimeout(() => root.classList.add('is-listed'), AT.list);
	window.setTimeout(() => sort(root), AT.sort);

	window.setTimeout(() => {
		root.classList.add('is-rated');
		if (score) countTo(score, FINAL_SCORE);
	}, AT.rate);
}

/** No sequence: the success state, on the spot. */
function settle(root: HTMLElement, text: string): void {
	const typed = root.querySelector<HTMLElement>('[data-typed]');
	const score = root.querySelector<HTMLElement>('[data-score]');

	if (typed) typed.textContent = text;
	if (score) score.textContent = FINAL_SCORE.toFixed(1);
	root.classList.add('is-zoomed', 'is-listed', 'is-sorted', 'is-rated');
}

/**
 * Play the sequence on one frame, once, whatever decided it was time.
 *
 * The service rail needs this: its copy of the frame is inside a card that is
 * closed on arrival, so scrolling past it is exactly the wrong trigger — the
 * sequence would be over before the card was ever opened. The rail marks its
 * frame `data-deferred` so the observer below leaves it alone, and calls this
 * the first time the card becomes the open one.
 */
export function startLocalSearch(root: HTMLElement): void {
	if (root.dataset.searchPlayed === '') return;
	root.dataset.searchPlayed = '';

	const text = query(root.dataset.query ?? '');
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) settle(root, text);
	else run(root, text);
}

export function initLocalSearch(scope: ParentNode = document): void {
	const roots = Array.from(scope.querySelectorAll<HTMLElement>('[data-local-search]'));
	if (roots.length === 0) return;

	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const observer = reduced
		? null
		: new IntersectionObserver(
				(entries) => {
					entries.forEach((entry) => {
						if (!entry.isIntersecting) return;
						/* Once. Released the moment it has fired, so scrolling back
						   past it does nothing. */
						observer?.unobserve(entry.target);
						const root = entry.target as HTMLElement;
						/* Behind the band's copy, and a beat behind that. */
						afterTextReveal(root, () => startLocalSearch(root));
					});
				},
				{ threshold: VISIBLE_RATIO },
			);

	roots.forEach((root) => {
		if (root.dataset.searchReady === '') return;
		root.dataset.searchReady = '';

		if (reduced) {
			startLocalSearch(root);
			return;
		}

		/* Empty the field the moment the script takes over, or the fallback
		   query the markup ships sits there in full until the typing starts and
		   then snaps back to one letter. Without JavaScript it stays written.
		   A deferred frame still wants this — it is only its trigger that is
		   somebody else's business. */
		const typed = root.querySelector<HTMLElement>('[data-typed]');
		if (typed) typed.textContent = '';

		if (root.dataset.deferred === '') return;

		observer?.observe(root);
	});
}
