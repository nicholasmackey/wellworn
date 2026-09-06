/**
 * Conditional visibility, evaluated the same way in three places: the browser
 * as the client types, the renderer when it decides what to show on first
 * paint, and the endpoint when it decides whether an answer should have been
 * possible at all.
 *
 * A single forward pass is enough, and that is a property the schema buys
 * rather than something this file assumes: `showIf` may only name a question
 * defined ABOVE it (enforced in schema.ts), so by the time a condition is
 * evaluated its target has already been decided. No cycles, no fixpoint, no
 * ordering question.
 *
 * Visibility cascades. A question whose condition is met but whose target is
 * itself hidden is hidden too — otherwise answering a question, then hiding it
 * by changing an earlier answer, would leave its dependants stranded on screen
 * asking about something the client can no longer see.
 */
import type { Questionnaire, ShowIf } from './schema'

/** The answers a condition is evaluated against. Values are whatever the form holds. */
export type AnswerBag = Readonly<Record<string, unknown>>

/**
 * Does `value` satisfy `condition`?
 *
 * Strict comparison, no coercion. A client sending the string "true" where a
 * boolean belongs does not flip a condition — the value fails its own field's
 * validation a moment later, and the dependent question is simply treated as
 * hidden, which the endpoint then rejects if an answer was supplied for it.
 * Coercing here would let a malformed payload steer which questions count.
 */
export function matches(condition: ShowIf, value: unknown): boolean {
	if (condition.equals !== undefined) return value === condition.equals
	if (condition.in !== undefined) {
		return (
			(typeof value === 'string' || typeof value === 'number') && condition.in.includes(value)
		)
	}
	return false
}

/**
 * The ids of every question currently visible, in one forward pass.
 *
 * Sections are not filtered here. A section whose questions are all hidden is
 * still a section; the renderer decides whether to draw its heading.
 */
export function computeVisibility(
	questionnaire: Questionnaire,
	answers: AnswerBag,
): Set<string> {
	const visible = new Set<string>()

	for (const section of questionnaire.sections) {
		for (const question of section.questions) {
			if (!question.showIf) {
				visible.add(question.id)
				continue
			}
			/* The cascade: a condition can only be satisfied by a question that
			   is itself on screen. */
			if (!visible.has(question.showIf.question)) continue
			if (matches(question.showIf, answers[question.showIf.question])) {
				visible.add(question.id)
			}
		}
	}

	return visible
}

/** Convenience for the renderer's first paint, where the answers are the defaults. */
export function isVisible(
	questionnaire: Questionnaire,
	answers: AnswerBag,
	questionId: string,
): boolean {
	return computeVisibility(questionnaire, answers).has(questionId)
}
