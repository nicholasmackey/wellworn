/**
 * THE TEXT ENTRANCE — the trigger.
 *
 * Everything about how the entrance looks is in styles/reveal.css. This file
 * decides only when it starts, and it starts once: the observer hands an
 * element `is-revealed` the first time enough of it is on screen and then
 * lets it go. Scrolling away and back replays nothing, because there is
 * nothing left to replay — the finished state is the resting state, and the
 * element is no longer being watched.
 *
 * No scroll listener, no frame loop, one observer for the page.
 */

/**
 * The pause between the copy settling and a demonstration in the same band
 * starting to play. Long enough to read as two events rather than one.
 */
const BEAT = 260;

/**
 * How long a demonstration will wait for copy that has not arrived before
 * giving up and playing anyway. Only reachable if a band's heading somehow
 * never crosses the threshold — the frame is not held hostage to it.
 */
const PATIENCE = 2500;

/** How much of an element counts as arrived. */
const VISIBLE_RATIO = 0.25;

/**
 * ...except for anything tall enough that a quarter of it will never be on
 * screen at once. A heading that fills half the viewport has arrived when
 * half the viewport is full of it.
 */
const TALL_ELEMENT_SHARE = 0.4;

const SELECTOR = '[data-word-reveal], [data-reveal-block]';

/** When each target started arriving, so a group can work out when it stops. */
const startedAt = new WeakMap<Element, number>();

/** What is waiting on each group's copy — see afterTextReveal below. */
const waiting = new Map<Element, Array<() => void>>();

/** A motion token, in milliseconds. */
function ms(name: string): number {
	const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
	return Number.parseFloat(raw) || 0;
}

/**
 * How long after it starts a target is still moving: the last word's stagger
 * plus a word's own travel, or the block's delay plus its own.
 */
function duration(element: Element): number {
	if (element.hasAttribute('data-word-reveal')) {
		const words = element.querySelectorAll('.ww-word').length;
		return Math.max(0, words - 1) * ms('--wr-stagger') + ms('--wr-dur');
	}

	const index = Number.parseFloat((element as HTMLElement).style.getPropertyValue('--wr-i')) || 0;
	return ms('--wr-block-delay') + index * ms('--wr-block-stagger') + ms('--wr-block-dur');
}

/**
 * When every piece of copy in a group has finished — or null while any of it
 * has yet to start.
 */
function settlesAt(group: Element): number | null {
	let latest = 0;

	for (const target of group.querySelectorAll(SELECTOR)) {
		const started = startedAt.get(target);
		if (started === undefined) return null;
		latest = Math.max(latest, started + duration(target));
	}

	return latest;
}

/** Release anything waiting on this group, once the group is done moving. */
function release(group: Element): void {
	const callbacks = waiting.get(group);
	if (!callbacks || callbacks.length === 0) return;

	const settled = settlesAt(group);
	if (settled === null) return;

	waiting.delete(group);
	const wait = Math.max(0, settled - performance.now()) + BEAT;
	window.setTimeout(() => callbacks.forEach((run) => run()), wait);
}

function reveal(element: Element): void {
	element.classList.add('is-revealed');
	startedAt.set(element, performance.now());

	const group = element.closest('[data-reveal-group]');
	if (group) release(group);
}

/**
 * Hold something back until the display copy around it has arrived.
 *
 * The three promise bands each pair a heading with a demonstration, and the
 * two arriving together reads as one busy event rather than as a statement
 * followed by its proof. So the demonstration asks here instead of starting
 * the moment it is seen: the words rise, the supporting line follows, there is
 * a beat, and then the frame begins.
 *
 * Runs immediately where there is no entrance to wait for — reduced motion, no
 * initialisation, or an element outside any group — so a caller never has to
 * know which of those is the case.
 */
export function afterTextReveal(element: Element, start: () => void): void {
	const group = document.documentElement.hasAttribute('data-text-reveal')
		? element.closest('[data-reveal-group]')
		: null;

	if (!group) {
		start();
		return;
	}

	let done = false;
	const once = (): void => {
		if (done) return;
		done = true;
		start();
	};

	const callbacks = waiting.get(group) ?? [];
	callbacks.push(once);
	waiting.set(group, callbacks);

	window.setTimeout(once, PATIENCE);
	release(group);
}

export function initReveal(): void {
	const root = document.documentElement;

	/*
	 * The attribute is the handshake with the inline script in BaseLayout's
	 * head, and it is what makes the hidden starting state safe. Absent means
	 * either reduced motion or no initialisation, and in both cases the CSS
	 * has hidden nothing and there is nothing here to reveal.
	 */
	if (!root.hasAttribute('data-text-reveal')) return;

	/* Claims the attribute, so the head script's failsafe leaves it alone. */
	if (root.hasAttribute('data-text-reveal-ready')) return;
	root.setAttribute('data-text-reveal-ready', '');

	const targets = document.querySelectorAll(SELECTOR);
	if (targets.length === 0) return;

	if (!('IntersectionObserver' in window)) {
		targets.forEach(reveal);
		return;
	}

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;

				const arrived =
					entry.intersectionRatio >= VISIBLE_RATIO ||
					entry.intersectionRect.height >= window.innerHeight * TALL_ELEMENT_SHARE;
				if (!arrived) continue;

				observer.unobserve(entry.target);
				reveal(entry.target);
			}
		},
		/* The zero is there so a tall element still reports its rect on the way
		   in rather than waiting for a ratio it can never reach. */
		{ threshold: [0, VISIBLE_RATIO] },
	);

	for (const target of targets) observer.observe(target);
}
