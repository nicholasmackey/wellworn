/**
 * THE THREE PROMISE DEMONSTRATIONS — the twenty seconds of behaviour they
 * share.
 *
 * Each demonstration is a short, ordered sequence, and the sequence is the
 * whole of the state: the root element carries `data-step`, the components'
 * own stylesheets say what each step looks like, and this file does nothing
 * but move the number along. That division is deliberate — a step that needs
 * a new visual only needs a selector, and nothing in here has to learn about
 * it.
 *
 * Three things cannot be done in CSS alone, and they are the three exceptions
 * below:
 *
 *   the reorder    `order` is not transitionable, so the search results are
 *                  measured, reordered, and carried from where they were to
 *                  where they now are. A FLIP, in nine lines.
 *   the counting   4.2 to 4.8, and 47 to 48.
 *   the reveals    a block that arrives mid-sequence animates its own height
 *                  (0fr to 1fr) so the stack below drifts rather than jumps.
 *
 * WHEN IT RUNS. Once, when the frame is meaningfully in view — not on load,
 * where it would be over before it was seen, and not on every scroll past.
 * The observer releases the element as soon as it has fired. What is left
 * afterwards is the successful final state, which is the state that matters:
 * found, trusted, contacted.
 *
 * REDUCED MOTION. No sequence at all. The final step is applied on the spot
 * and the counters are written at their finished values. base.css already
 * collapses the transitions themselves.
 */

/** How far into the frame counts as "meaningfully in view". */
const VISIBLE_RATIO = 0.4;

/**
 * The delay before each step, in milliseconds, cumulative from the start.
 * Step n is the (n-1)th entry. Everything sits in the 300-700ms band the rest
 * of the site moves at, with a beat between the stages that are meant to read
 * as separate events.
 */
const TIMELINES: Record<string, readonly number[]> = {
	/* query, results, the move, the found state */
	search: [200, 550, 1150, 1900],
	/* the review lands, the score rises, the owner replies */
	reputation: [400, 1000, 1700],
	/* tap, form, filled, submit, confirmation, lead */
	conversion: [500, 800, 1100, 2000, 2350, 2900],
};

interface Demo {
	readonly root: HTMLElement;
	readonly name: string;
	readonly steps: readonly number[];
}

function tween(el: HTMLElement, from: number, to: number, decimals: number): void {
	const duration = 700;
	const start = performance.now();

	const frame = (now: number): void => {
		const t = Math.min(1, (now - start) / duration);
		/* The same shape as --ease-out: quick, then settling. */
		const eased = 1 - Math.pow(1 - t, 3);
		el.textContent = (from + (to - from) * eased).toFixed(decimals);
		if (t < 1) requestAnimationFrame(frame);
	};

	requestAnimationFrame(frame);
}

/** Read the numbers a `data-count` element was authored with. */
function countParts(el: HTMLElement): { from: number; to: number; decimals: number } {
	return {
		from: Number(el.dataset.from ?? '0'),
		to: Number(el.dataset.to ?? '0'),
		decimals: Number(el.dataset.decimals ?? '0'),
	};
}

/**
 * The reorder. Measure, reorder, measure, then put every row back where it
 * started and let it transition to where it belongs.
 */
function sortResults(root: HTMLElement): void {
	const list = root.querySelector<HTMLElement>('[data-results]');
	if (!list) return;

	const rows = Array.from(list.querySelectorAll<HTMLElement>('[data-result]'));
	const before = rows.map((row) => row.getBoundingClientRect().top);

	list.classList.add('is-sorted');

	const after = rows.map((row) => row.getBoundingClientRect().top);

	rows.forEach((row, i) => {
		const dy = before[i] - after[i];
		if (dy === 0) return;
		row.style.transition = 'none';
		row.style.transform = `translateY(${dy}px)`;
	});

	/* Force the moved-back positions to be painted before releasing them,
	   otherwise the browser coalesces both styles and nothing animates. */
	void list.offsetHeight;

	rows.forEach((row) => {
		/*
		 * Written out rather than handed back to the stylesheet, because the
		 * rule the rows are under carries the populate stagger's
		 * transition-delay and the move must not inherit it.
		 */
		row.style.transition = 'transform 600ms cubic-bezier(0.33, 1, 0.68, 1)';
		row.style.transform = '';
	});
}

/** Everything a step does beyond setting the number. */
function applyStep(demo: Demo, step: number, instant: boolean): void {
	const { root, name } = demo;
	root.dataset.step = String(step);

	if (name === 'search') {
		if (step === 3) {
			if (instant) root.querySelector('[data-results]')?.classList.add('is-sorted');
			else sortResults(root);
		}
		if (step === 4) {
			root.querySelector('[data-reveal]')?.classList.add('is-open');
		}
		return;
	}

	if (name === 'reputation') {
		if (step === 1) {
			root.querySelector('[data-reveal]')?.classList.add('is-open');
		}
		if (step === 2) {
			root.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
				const { from, to, decimals } = countParts(el);
				if (instant) el.textContent = to.toFixed(decimals);
				else tween(el, from, to, decimals);
			});
			const stars = root.querySelector<HTMLElement>('[data-stars]');
			if (stars?.dataset.fill) stars.style.setProperty('--wwd-fill', stars.dataset.fill);
		}
		if (step === 3) {
			root.querySelector('[data-reveal-late]')?.classList.add('is-open');
		}
		return;
	}

	/* conversion — the panels are entirely a matter of data-step. */
}

function run(demo: Demo, instant: boolean): void {
	if (instant) {
		/* Every step at once, in order, so the ones that build on each other
		   still see the state the earlier one left. */
		for (let step = 1; step <= demo.steps.length; step += 1) applyStep(demo, step, true);
		return;
	}

	demo.steps.forEach((delay, i) => {
		const step = i + 1;
		window.setTimeout(() => applyStep(demo, step, false), delay);
	});
}

export function initPromiseDemos(scope: ParentNode = document): void {
	const roots = Array.from(scope.querySelectorAll<HTMLElement>('[data-demo]'));
	if (roots.length === 0) return;

	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const demos = new Map<HTMLElement, Demo>();

	const observer = reduced
		? null
		: new IntersectionObserver(
				(entries) => {
					entries.forEach((entry) => {
						if (!entry.isIntersecting) return;
						/* Once. A demonstration that replays itself every time it
						   scrolls past stops being a demonstration. */
						observer?.unobserve(entry.target);
						const demo = demos.get(entry.target as HTMLElement);
						if (demo) run(demo, false);
					});
				},
				{ threshold: VISIBLE_RATIO },
			);

	roots.forEach((root) => {
		if (root.dataset.demoReady === '') return;
		root.dataset.demoReady = '';

		const name = root.dataset.demo ?? '';
		const steps = TIMELINES[name];
		if (!steps) return;

		const demo: Demo = { root, name, steps };
		demos.set(root, demo);

		if (reduced) run(demo, true);
		else observer?.observe(root);
	});
}
