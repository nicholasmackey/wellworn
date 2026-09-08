/**
 * THE TESTIMONIAL PLAYER.
 *
 * One playback model for the whole set: at most one clip is ever playing.
 * Everything below follows from that, and from a short list of rules about how
 * playback is allowed to start and stop.
 *
 *   pointer enters a card      start it with sound, and pause whatever else was
 *                              playing
 *   pointer LEAVES a card      pause it, where it stands
 *   click a playing card       pause it
 *   click a paused card        play it, with sound
 *   the play/pause button      the same, from the keyboard
 *   the sound button           mute or unmute this clip, and that choice sticks
 *
 * Hover both starts and stops, which makes the pointer the whole interface: a
 * visitor samples three clips by running the mouse along the row, and nothing
 * keeps talking once they have moved on. Leaving PAUSES rather than resets, so
 * coming back to a card picks the clip up where it was rather than making
 * someone sit through the opening again.
 *
 * None of this applies to a touchscreen or to a keyboard, where there is no
 * pointer to leave with: there a clip runs until it is stopped or another one
 * takes over.
 *
 * SOUND IS THE DEFAULT. A testimonial is somebody talking, so a silent one is
 * half a testimonial: playback is unmuted unless the visitor has pressed the
 * sound control on that card, and that choice is remembered for the rest of the
 * visit.
 *
 * BROWSER AUTOPLAY. A hover is not a user gesture, and a browser that has not
 * yet seen one on this page refuses to start audio. That refusal arrives as a
 * REJECTED promise from `play()`, so every start is a two-step: ask for sound,
 * and on a refusal fall back to a muted start so the picture still moves. Both
 * rejections are caught rather than left to become unhandled rejections in the
 * console, because a refusal is a normal outcome here and not a fault. Once the
 * visitor has clicked anything at all, the sound attempt begins to succeed.
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
	/**
	 * Has this visitor asked for THIS clip to be silent? Not the same question
	 * as `video.muted`, which also goes true when a browser refuses audio, and
	 * which must not be mistaken for a preference. Only the sound control writes
	 * here.
	 */
	silenced: boolean;
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

		// Ask for sound unless this card has been silenced by hand.
		card.video.muted = card.silenced;

		void card.video.play().catch(() => {
			// Refused. Almost always the autoplay policy declining audio before the
			// page has seen a gesture, so drop the sound and ask again: a moving
			// silent clip is a great deal better than a still frame, and the sound
			// control is right there to turn it back on.
			if (card.video.muted) return;
			card.video.muted = true;
			// The second refusal is the real one — Low Power Mode on iOS, a data
			// saver, a tab nobody has touched. It leaves the poster up, which is
			// the correct fallback. Swallow it rather than letting it surface as an
			// unhandled rejection.
			void card.video.play().catch(() => {});
		});
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
			silenced: false,
		};
		cards.push(card);

		// The resting state is muted, which is what lets a clip be started at all
		// before the page has seen a gesture; `play` lifts it. Muted is set in the
		// markup too, and setting it again from script covers the case where a
		// browser has restored the element's state across a back/forward
		// navigation, which does not re-read the attribute.
		video.muted = true;

		if (hoverStartsPlayback) {
			root.addEventListener('pointerenter', () => play(card));
			/*
			 * pointerleave, not pointerout: `out` also fires on the way into a
			 * child, so the two controls sitting inside this element would each
			 * pause the clip the moment the pointer crossed onto them.
			 */
			root.addEventListener('pointerleave', () => pause(card));
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
		 * Sound is on by default, so this control is mostly a way to turn it OFF,
		 * and the choice is per clip. It is also the reliable way back to audio
		 * on a card the autoplay policy silenced: a browser honours an unmute
		 * inside a click even when it refused an unmuted start on hover.
		 */
		card.sound?.addEventListener('click', () => {
			card.silenced = !video.muted;
			video.muted = card.silenced;
			// Pressing the sound control on a stopped clip is a request to hear it,
			// so start it. Doing nothing would leave someone pressing "Unmute" on
			// silence. A press is a real gesture, so this is also the moment the
			// browser stops refusing audio.
			if (card.silenced) sync(card);
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
