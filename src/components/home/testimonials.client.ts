/**
 * THE TESTIMONIAL PLAYER.
 *
 * One playback model for the whole set: at most one clip is ever playing.
 * Everything below follows from that, and from a short list of rules about how
 * playback is allowed to start and stop.
 *
 *   pointer enters a card      start it, and pause whatever else was playing
 *   pointer LEAVES a card      nothing at all
 *   click a playing card       pause it
 *   click a paused card        play it
 *   the play/pause button      the same, from the keyboard
 *   the sound button           unmute this clip, muting is per element
 *
 * The second rule is the unusual one and it is deliberate. Hover starts a clip
 * because that is a cheap way to let someone sample three of them; leaving does
 * not stop it, because once a visitor is actually watching something, taking it
 * away the moment their pointer drifts is hostile. They stop it, or starting
 * another one stops it.
 *
 * BROWSER AUTOPLAY. Every clip starts muted, because programmatic playback with
 * sound is blocked by every current browser outside a user gesture and a hover
 * is not one. `play()` returns a promise that REJECTS when a browser refuses,
 * and that rejection is caught rather than left to become an unhandled
 * rejection in the console — a refusal is a normal outcome here, not a fault.
 *
 * REDUCED MOTION. Hover does not start anything. A visitor who has asked for
 * less motion gets three still frames and has to press something.
 */

interface Card {
	readonly root: HTMLElement;
	readonly video: HTMLVideoElement;
	readonly toggle: HTMLButtonElement;
	readonly sound: HTMLButtonElement | null;
	/** Used in the accessible name of both controls, e.g. "Play <label>". */
	readonly label: string;
}

export function initTestimonials(scope: ParentNode = document): void {
	const roots = Array.from(scope.querySelectorAll<HTMLElement>('[data-testimonial]'));
	if (roots.length === 0) return;

	/*
	 * Two separate questions, and conflating them is a classic bug. "Can this
	 * pointer hover?" is about the input device: a touchscreen fires
	 * pointerenter on the tap that precedes a click, so without this check the
	 * first tap on a phone both starts the clip via hover and toggles it via
	 * click, and the net effect is that tapping a card does nothing.
	 * "Has this person asked for less motion?" is about preference.
	 */
	const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const hoverStartsPlayback = canHover && !reduced;

	const cards: Card[] = [];

	/** The one clip allowed to be playing. */
	let active: Card | null = null;

	const pause = (card: Card): void => {
		card.video.pause();
	};

	const play = (card: Card): void => {
		if (active && active !== card) pause(active);
		active = card;
		// A refusal is an expected outcome — Low Power Mode on iOS, a data saver,
		// a tab that has never been interacted with — and it leaves the poster up,
		// which is the correct fallback. Swallow it rather than letting it surface
		// as an unhandled rejection.
		void card.video.play().catch(() => {});
	};

	const toggle = (card: Card): void => {
		if (card.video.paused) play(card);
		else pause(card);
	};

	/**
	 * Both controls describe the clip they belong to, because three buttons all
	 * called "Play" are three identical rows in a screen reader's control list.
	 * Driven from the video's own events rather than from the click handler, so
	 * the label is right even when playback stops for a reason nothing here
	 * caused — the clip ending, or a browser refusing to start it.
	 */
	const sync = (card: Card): void => {
		const playing = !card.video.paused;
		card.root.toggleAttribute('data-playing', playing);
		card.toggle.setAttribute(
			'aria-label',
			`${playing ? 'Pause' : 'Play'} ${card.label}`,
		);

		if (card.sound) {
			const muted = card.video.muted;
			card.root.toggleAttribute('data-muted', muted);
			card.sound.setAttribute(
				'aria-label',
				`${muted ? 'Unmute' : 'Mute'} ${card.label}`,
			);
		}
	};

	for (const root of roots) {
		const video = root.querySelector<HTMLVideoElement>('video');
		const toggleBtn = root.querySelector<HTMLButtonElement>('[data-play-toggle]');
		if (!video || !toggleBtn) continue;

		const card: Card = {
			root,
			video,
			toggle: toggleBtn,
			sound: root.querySelector<HTMLButtonElement>('[data-sound-toggle]'),
			label: root.dataset.label ?? 'this testimonial',
		};
		cards.push(card);

		// Muted is set in the markup too. Setting it again from script covers the
		// case where a browser has restored the element's state across a
		// back/forward navigation, which does not re-read the attribute.
		video.muted = true;

		if (hoverStartsPlayback) {
			root.addEventListener('pointerenter', () => play(card));
		}

		root.addEventListener('click', (event) => {
			// The two controls are buttons inside this element and handle
			// themselves. Without this guard, pressing Pause would pause the clip
			// and then the bubbled click would immediately play it again.
			if ((event.target as Element).closest('button')) return;
			toggle(card);
		});

		toggleBtn.addEventListener('click', () => toggle(card));

		/*
		 * Sound is opt-in, per clip, and only ever from a real press. A browser
		 * will honour an unmute inside a click even when it refused an unmuted
		 * autoplay, which is why this is a button and not something hover does.
		 */
		card.sound?.addEventListener('click', () => {
			video.muted = !video.muted;
			// Pressing the sound control on a stopped clip is a request to hear it,
			// so start it. Doing nothing would leave someone pressing "Unmute" on
			// silence.
			if (video.muted) sync(card);
			else play(card);
		});

		// The element is the source of truth for its own state; these four events
		// are every way it can change.
		for (const type of ['play', 'pause', 'ended', 'volumechange'] as const) {
			video.addEventListener(type, () => sync(card));
		}

		// A clip that reaches its end stops being the active one, so the next
		// hover on it starts it from the top rather than from a finished frame.
		video.addEventListener('ended', () => {
			if (active === card) active = null;
			video.currentTime = 0;
		});

		sync(card);
	}

	/*
	 * A clip left playing in a tab nobody is looking at is audio and bandwidth
	 * spent on nothing. Pause on hide; do NOT resume on show — the visitor came
	 * back to a page, not to a video, and starting one unprompted is exactly the
	 * behaviour this player is built to avoid everywhere else.
	 */
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden' && active) pause(active);
	});
}
