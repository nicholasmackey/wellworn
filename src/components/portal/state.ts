/**
 * The portal's whole visual vocabulary for state, in one table.
 *
 * Every chip, marker and coloured word on a /projects/* page is looked up here
 * from a value in the project data, so changing a status in
 * the project JSON is the entire content edit — no component names a colour,
 * and no colour appears in two places to fall out of step with itself.
 *
 * The class strings are written out in full rather than composed, because
 * Tailwind reads the source as text: a class assembled at runtime is a class
 * that never gets generated.
 */
import type {
	AgreementStatus,
	DepositStatus,
	DetailTone,
	PhaseStatus,
} from '../../config/project'

export interface DetailState {
	readonly label: string
	readonly tone: DetailTone
}

export const AGREEMENT_STATUS: Record<AgreementStatus, DetailState> = {
	'awaiting-signature': { label: 'Awaiting signature', tone: 'inactive' },
	signed: { label: 'Signed', tone: 'settled' },
}

export const DEPOSIT_STATUS: Record<DepositStatus, DetailState> = {
	'not-paid': { label: 'Not paid', tone: 'inactive' },
	paid: { label: 'Paid', tone: 'settled' },
	failed: { label: 'Payment failed', tone: 'blocked' },
}

/**
 * The six chips the portal can draw. `blocked` is the one nothing uses yet, and
 * `neutral` is the one that carries no state at all — ink on white, for the
 * phase that is merely next in line.
 */
export type ChipVariant = 'current' | 'complete' | 'action' | 'blocked' | 'neutral' | 'upcoming'

/**
 * Phase and exceptional-state chips use solid or neutral treatments. Client
 * action labels are the exception: amber text without a container, so they
 * can sit naturally in the task line without becoming the loudest object.
 *
 * The page is black, white and grey everywhere else, which is what buys these
 * the right to be loud. A filled block is read once and understood, which is
 * the whole job of a status.
 *
 * Three fills, three weights of quiet beneath them, and the recession is the
 * design. A live state — happening, done, owed — takes its colour solid.
 * `neutral` is the phase that starts next: ink inside an ink hairline on the
 * page's own ground, crisp but silent, because "next" is a position rather than
 * news. `upcoming` is the three behind it: grey type on the site's lightest
 * ground, no border at all, so a column of them recedes into the page instead
 * of arguing with the one chip in it that matters.
 *
 * These are names rather than declarations. What each one looks like is in
 * StateChip.astro, beside the element it lands on, so a status maps to a chip
 * in one table here and to a colour in one stylesheet there.
 */
export const CHIP: Record<ChipVariant, string> = {
	current: 'chip-current',
	complete: 'chip-complete',
	action: 'ww-chip-quiet chip-action',
	blocked: 'chip-blocked',
	neutral: 'chip-neutral',
	upcoming: 'chip-upcoming',
}

/**
 * What a phase's status is called, and which chip says it.
 *
 * Next and upcoming are both grey, and deliberately two different greys: the
 * phase that starts when this one ends is ink in an outline, the three behind
 * it are the softer fill. Neither is a colour, because neither is news.
 */
export const PHASE_CHIP: Record<
	PhaseStatus,
	{ readonly label: string; readonly variant: ChipVariant }
> = {
	complete: { label: 'Complete', variant: 'complete' },
	current: { label: 'Current', variant: 'current' },
	next: { label: 'Next', variant: 'neutral' },
	upcoming: { label: 'Upcoming', variant: 'upcoming' },
}

/**
 * The marker on the timeline rail. Filled where something is settled — done, or
 * happening now — and hollow where it has not started, which is a difference a
 * reader takes in before reading anything. The halo on `current` is the one
 * piece of ambient colour on the page: too faint to read as a second status,
 * strong enough to find "you are here" from across the room.
 *
 * Drawn in TimelinePhase.astro, for the same reason the chips are drawn in
 * StateChip.astro.
 */
export const PHASE_MARK: Record<PhaseStatus, string> = {
	complete: 'mark-complete',
	current: 'ww-marker-halo mark-current',
	next: 'mark-next',
	upcoming: 'mark-upcoming',
}

/**
 * The administrative values in the status band — the one place on the page
 * where a status is set as type rather than drawn as a fill.
 *
 * So it is the one place the -deep values are used. "Awaiting signature" is
 * small type, and small type needs 4.5:1: the orange the chips are filled with
 * manages 2.47:1 on white and would be a pale smear at this size, where the
 * deep of the same hue reads as unmistakably orange and is comfortably legible.
 * The colour is the whole treatment — no dot, no chip, no border. The band
 * underneath is already saying ACTION NEEDED once per item, and a second set of
 * badges up here would flatten the difference between a summary and a call to
 * act.
 *
 * Neutral takes no colour at all — "August 18, 2026" is a fact rather than a
 * state, and marking it as one would spend the reader's attention on nothing.
 */
export const DETAIL_TONE: Record<DetailTone, string> = {
	neutral: 'tone-neutral',
	inactive: 'tone-inactive',
	attention: 'tone-attention',
	settled: 'tone-settled',
	blocked: 'tone-blocked',
}
