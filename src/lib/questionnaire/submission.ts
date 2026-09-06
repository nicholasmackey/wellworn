/**
 * The canonical submission — the single object every downstream rendering is
 * built from.
 *
 * Phase 6 turns one of these into four things: an HTML email, a plain-text
 * email, submission.json and submission.md. All four come from HERE and none
 * of them from the request, which is the property that makes escaping a
 * question of how each renderer writes, rather than of whether the request was
 * clean. Nothing in this file trusts the wire: every value it carries has been
 * through buildAnswerSchema() and then the registry's `normalize`.
 *
 * The shape is grouped by section rather than flat because the thing a person
 * reads is a questionnaire, in order, with its headings. `answers` is the flat
 * map beside it for anything reading by key.
 *
 * Deliberately absent: IP address, user agent, referer, any header at all. The
 * brief asks for the answers and nothing else, and a field that does not exist
 * cannot leak.
 */
import { FIELD, type AnswerableType, type AnswerValue } from './registry'
import { isAnswerable, type Option, type Questionnaire } from './schema'

/** One question and what it was answered with. */
export interface SubmittedAnswer {
	readonly id: string
	readonly label: string
	readonly type: AnswerableType
	/** False when the question was shown and left blank. */
	readonly answered: boolean
	/** The normalized value, or null when unanswered. */
	readonly value: unknown
	/** The human rendering — what the email prints. '' when unanswered. */
	readonly display: string
	/** Present for choice types: the options behind the value, in definition order. */
	readonly chosen?: readonly Option[]
}

export interface SubmittedSection {
	readonly id: string
	readonly title: string
	readonly answers: readonly SubmittedAnswer[]
}

export interface Submission {
	readonly meta: {
		readonly questionnaireId: string
		/** The instrument version the answers were given against. */
		readonly version: number
		/** The engine format. Both travel so a stored submission stays readable. */
		readonly schemaVersion: number
		readonly client: string
		readonly title: string
		/** ISO 8601, UTC. Set by the server, never by the client. */
		readonly submittedAt: string
	}
	readonly sections: readonly SubmittedSection[]
	/** Flat id → normalized value. Answered questions only. */
	readonly answers: Readonly<Record<string, unknown>>
	readonly counts: {
		readonly asked: number
		readonly answered: number
		readonly skipped: number
	}
}

export interface NormalizeOptions {
	/** Which questions were on screen. Hidden ones are left out entirely. */
	readonly visible: ReadonlySet<string>
	/** Injected so the caller owns the clock — and so tests can pin it. */
	readonly submittedAt?: Date
}

/**
 * Build the canonical submission from validated answers.
 *
 * `validated` must be the output of validateAnswers(), not a raw body. This
 * function does no validation of its own: it walks the DEFINITION and looks
 * each answer up, so a key the definition does not know about cannot appear in
 * the result even if one somehow reached this far.
 *
 * A question that was visible but left blank is kept with `answered: false`.
 * Knowing what someone chose to skip is information, and a report that
 * silently omits it reads as though the question was never asked.
 */
export function normalizeSubmission(
	questionnaire: Questionnaire,
	validated: Readonly<Record<string, unknown>>,
	{ visible, submittedAt = new Date() }: NormalizeOptions,
): Submission {
	const sections: SubmittedSection[] = []
	const answers: Record<string, unknown> = {}
	let asked = 0
	let answered = 0

	for (const section of questionnaire.sections) {
		const rows: SubmittedAnswer[] = []

		for (const question of section.questions) {
			if (!isAnswerable(question)) continue
			if (!visible.has(question.id)) continue

			asked++

			const spec = FIELD[question.type]
			const raw = validated[question.id]

			if (raw === undefined) {
				rows.push({
					id: question.id,
					label: question.label,
					type: question.type,
					answered: false,
					value: null,
					display: '',
				})
				continue
			}

			/* The casts are the one place the per-type table has to be addressed
			   generically. They are safe because `raw` came out of the schema
			   this very question generated, so its type is AnswerValue<type> by
			   construction. */
			type V = AnswerValue<AnswerableType>
			const value = (spec.normalize as (q: typeof question, v: V) => V)(question, raw as V)
			const display = (spec.display as (q: typeof question, v: V) => string)(question, value)
			const chosen = spec.chosen
				? (spec.chosen as (q: typeof question, v: V) => Option[])(question, value)
				: undefined

			answered++
			answers[question.id] = value

			rows.push({
				id: question.id,
				label: question.label,
				type: question.type,
				answered: true,
				value,
				display,
				...(chosen ? { chosen } : {}),
			})
		}

		/* A section whose questions are all hidden is not a section of this
		   submission. Printing an empty heading would imply we asked. */
		if (rows.length > 0) {
			sections.push({ id: section.id, title: section.title, answers: rows })
		}
	}

	return {
		meta: {
			questionnaireId: questionnaire.id,
			version: questionnaire.version,
			schemaVersion: questionnaire.schemaVersion,
			client: questionnaire.client,
			title: questionnaire.title,
			submittedAt: submittedAt.toISOString(),
		},
		sections,
		answers,
		counts: { asked, answered, skipped: asked - answered },
	}
}
