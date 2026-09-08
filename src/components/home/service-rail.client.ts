/**
 * THE SERVICE RAIL — which card is open.
 *
 * The appearance of an open card is entirely in ServiceCards.astro's
 * stylesheet, keyed off one attribute. This file sets that attribute and
 * nothing else about how the rail looks: it decides which card is the open
 * one, keeps aria-expanded and `inert` in step with it, and starts a card's
 * demonstration the first time it is opened.
 *
 * HOW IT IS DRIVEN.
 *
 *   wide, with a pointer   hovering a card opens it, and so does tabbing to
 *                          it. Leaving the rail does nothing: the card the
 *                          visitor last looked at stays open, because
 *                          snapping back to the first one the moment the
 *                          pointer leaves throws away what they just chose.
 *   stacked                a tap opens a card, and a tap on the open one
 *                          shuts it. There is no hover to borrow, and a tap
 *                          that cannot be taken back is a trap.
 *
 * Either way exactly one card is open at most, which is what makes the widths
 * add up: the stylesheet's --wwr-share assumes four shut cards and one open.
 *
 * WHY THE DEMONSTRATIONS ARE STARTED FROM HERE. Two cards carry the promise
 * bands' own frames — the local search and the reputation profile. Both
 * normally play when they scroll into view, which is exactly wrong inside a
 * card that is shut: the sequence would be over before anyone opened it. They
 * are rendered with `defer`, which takes them off their own observers, and
 * started here on the first open — after the card has finished widening, so
 * the frame they play in is not still moving.
 */

import { initLocalSearch, startLocalSearch } from './promises/local-search.client';
import { initPromiseDemos, startPromiseDemo } from './promises/promise-demos.client';

/** Where the rail turns from a column into a line. Matches the stylesheet. */
const WIDE = '(min-width: 1024px)';

/** A motion token, in milliseconds, read off the rail so there is one value. */
function duration(rail: HTMLElement): number {
	const token = getComputedStyle(rail).getPropertyValue('--wwr-dur').trim();
	const value = Number.parseFloat(token);
	if (!Number.isFinite(value)) return 0;

	/* Computed custom properties are serialized as seconds in Chromium even
	   when their source token was written in milliseconds. setTimeout always
	   takes milliseconds, so preserve the CSS unit instead of dropping it. */
	return token.endsWith('ms') ? value : token.endsWith('s') ? value * 1000 : value;
}

function setUp(rail: HTMLElement): void {
	const items = Array.from(rail.querySelectorAll<HTMLElement>('[data-rail-item]'));
	if (items.length === 0) return;

	/*
	 * Register the deferred frames before anything can be opened, so the first
	 * open finds a demonstration ready to start rather than silently nothing.
	 * Both are idempotent and both skip their observers for a deferred frame,
	 * so calling them here does not race the copies in the promise bands.
	 */
	initLocalSearch(rail);
	initPromiseDemos(rail);

	const wide = window.matchMedia(WIDE);
	const hoverable = window.matchMedia('(hover: hover)');
	const open = duration(rail);
	let playTimer: number | undefined;

	/** Play whatever this card has to show. Each start is once, in itself. */
	function play(item: HTMLElement): void {
		const search = item.querySelector<HTMLElement>('[data-local-search]');
		if (search) startLocalSearch(search);

		const demo = item.querySelector<HTMLElement>('[data-demo]');
		if (demo) startPromiseDemo(demo);

		/* The brand wipe is pure CSS off one attribute. */
		const brand = item.querySelector<HTMLElement>('[data-brand-refresh]');
		if (brand) brand.dataset.played = '';
	}

	/* The two sequences above are once and stay on their last frame. The brand
	   wipe is short enough to be worth seeing again, so shutting the card puts
	   it back to the old mark, ready for the next open. Nothing else resets. */
	function rewind(item: HTMLElement): void {
		const brand = item.querySelector<HTMLElement>('[data-brand-refresh]');
		if (brand) delete brand.dataset.played;
	}

	function setActive(next: HTMLElement | null): void {
		if (next && next.hasAttribute('data-active')) return;
		window.clearTimeout(playTimer);

		for (const item of items) {
			const on = item === next;
			item.toggleAttribute('data-active', on);

			const trigger = item.querySelector<HTMLElement>('[data-rail-trigger]');
			trigger?.setAttribute('aria-expanded', String(on));

			const proof = item.querySelector<HTMLElement>('.wwr-reveal');
			if (proof) proof.inert = !on;

			if (!on) rewind(item);
		}

		/* Start once the card has stopped widening. Cancelling the timer above
		   prevents a card that has already closed from starting late. */
		if (next) playTimer = window.setTimeout(() => play(next), open);
	}

	items.forEach((item) => {
		const trigger = item.querySelector<HTMLElement>('[data-rail-trigger]');
		if (!trigger) return;

		/* Hover, on a wide screen with a real pointer. A touch that reports
		   itself as a pointerenter is left to the click below, or a tap would
		   open a card and then immediately toggle it shut again. */
		item.addEventListener('pointerenter', (event) => {
			if (event.pointerType === 'touch') return;
			if (!wide.matches || !hoverable.matches) return;
			setActive(item);
		});

		/* Keyboard. Tabbing to a card is the same intent as pointing at it. */
		trigger.addEventListener('focus', () => {
			if (!wide.matches) return;
			setActive(item);
		});

		trigger.addEventListener('click', () => {
			/* Wide: activating selects, and never shuts. Focus has already
			   opened this card by the time the click lands, so a toggle here
			   would read as the card closing itself under the pointer.
			   Stacked: a tap toggles, because there is nothing else to undo it
			   with. */
			if (wide.matches) setActive(item);
			else setActive(item.hasAttribute('data-active') ? null : item);
		});
	});
}

export function initServiceRail(): void {
	document.querySelectorAll<HTMLElement>('[data-service-rail]').forEach((rail) => {
		if (rail.dataset.railReady === '') return;
		rail.dataset.railReady = '';
		setUp(rail);
	});
}
