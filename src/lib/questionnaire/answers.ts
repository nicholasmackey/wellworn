/**
 * buildAnswerSchema — the load-bearing idea of the whole engine.
 *
 * The definition is the source of truth. This turns one into a zod schema for
 * its ANSWERS, so nothing describes the same questionnaire twice and the two
 * descriptions can never drift: there is only one.
 *
 * The result is a `strictObject`, which is where several of the brief's
 * security requirements are met at once rather than as separate checks:
 *
 *   - an unknown question id is REJECTED, not ignored, so field injection is
 *     a 400 rather than a silently discarded key;
 *   - a hidden question has no key in the shape at all, so answering something
 *     the conditions say was never shown is the same rejection;
 *   - every accepted key carries the format, length and range rules the
 *     definition declared.
 *
 * Requiredness lives in the refinement rather than in each field's schema
 * because it depends on visibility, which depends on the answers — see
 * validateAnswers() below for how that circle is closed.
 */
import { z } from 'astro/zod'
import { FIELD } from './registry'
import { isAnswerable, type Questionnaire } from './schema'
import { computeVisibility, type AnswerBag } from './visibility'

/** Message shown when a required question was left blank. */
const REQUIRED_MESSAGE = 'This question needs an answer.'

/**
 * Message for an answer to a question that was never asked — either an id the
 * definition does not contain, or one the conditions say was not on screen.
 * Both are the same refusal and neither should ever reach a real client.
 */
const UNRECOGNIZED_MESSAGE = 'That submission contained answers we did not ask for.'

export interface AnswerSchemaOptions {
	/**
	 * Which question ids are on screen. Anything not in here is absent from the
	 * shape, so an answer to it is an unrecognized key.
	 */
	readonly visible: ReadonlySet<string>
}

/**
 * A zod schema for the answers to `questionnaire`, given what is visible.
 *
 * Every field is optional at the shape level and requiredness is applied in
 * the refinement, so a missing required answer reports as "This question needs
 * an answer" against the question's own id rather than as zod's default
 * "expected string, received undefined" against a path the client cannot use.
 */
export function buildAnswerSchema(
	questionnaire: Questionnaire,
	{ visible }: AnswerSchemaOptions,
) {
	const shape: Record<string, z.ZodTypeAny> = {}

	for (const section of questionnaire.sections) {
		for (const question of section.questions) {
			if (!isAnswerable(question)) continue
			if (!visible.has(question.id)) continue

			const spec = FIELD[question.type]
			/* Blank in, undefined out. Doing this before the field's own schema
			   is what lets an optional email accept "" without the format rule
			   firing on an empty box, and it is the single definition of "not
			   answered" that the canonical JSON later reports. */
			shape[question.id] = z.preprocess(
				(raw) => (spec.isBlank(raw) ? undefined : raw),
				(spec.schema as (q: typeof question) => z.ZodTypeAny)(question).optional(),
			)
		}
	}

	return z.strictObject(shape).superRefine((answers, ctx) => {
		for (const section of questionnaire.sections) {
			for (const question of section.questions) {
				if (!isAnswerable(question)) continue
				if (!visible.has(question.id)) continue

				const value = (answers as Record<string, unknown>)[question.id]

				if (question.required && value === undefined) {
					ctx.addIssue({ code: 'custom', path: [question.id], message: REQUIRED_MESSAGE })
					continue
				}

				/* Group rules HTML cannot express. Checked only when the group was
				   answered at all — an untouched optional group is not "too few". */
				if (question.type === 'checkbox' && Array.isArray(value)) {
					if (question.min !== undefined && value.length < question.min) {
						ctx.addIssue({
							code: 'custom',
							path: [question.id],
							message:
								question.min === 1
									? 'Choose at least one.'
									: `Choose at least ${question.min}.`,
						})
					}
					if (question.max !== undefined && value.length > question.max) {
						ctx.addIssue({
							code: 'custom',
							path: [question.id],
							message: `Choose no more than ${question.max}.`,
						})
					}
				}
			}
		}
	})
}

/** What a validation attempt produced. */
export type ValidationResult =
	| { readonly ok: true; readonly answers: Record<string, unknown>; readonly visible: ReadonlySet<string> }
	| { readonly ok: false; readonly errors: readonly AnswerIssue[] }

export interface AnswerIssue {
	/** The question id, or null for an error about the payload as a whole. */
	readonly questionId: string | null
	readonly message: string
}

/**
 * Validate a raw answer bag against a questionnaire.
 *
 * Two passes, because requiredness depends on visibility and visibility
 * depends on answers:
 *
 *   1. Work out what is on screen from the raw values. Conditions compare
 *      strictly (see visibility.ts), so a malformed value simply fails to
 *      satisfy its condition and the dependants come out hidden.
 *   2. Build the schema for exactly those questions and parse.
 *
 * A payload that lies about types therefore cannot widen the shape: the worst
 * it achieves is hiding questions, and any answer it then supplies for one of
 * them is an unrecognized key.
 */
export function validateAnswers(
	questionnaire: Questionnaire,
	raw: AnswerBag,
): ValidationResult {
	const visible = computeVisibility(questionnaire, raw)
	const parsed = buildAnswerSchema(questionnaire, { visible }).safeParse(
		stripHiddenBlanks(questionnaire, raw, visible),
	)

	if (parsed.success) {
		return { ok: true, answers: parsed.data as Record<string, unknown>, visible }
	}

	return {
		ok: false,
		errors: parsed.error.issues.map((issue) => {
			/* A strictObject reports an unknown key as `unrecognized_keys` with an
			   EMPTY path and zod's generic "Invalid input", which tells a client
			   nothing at all. This is the field-injection rejection and the
			   answer-to-a-hidden-question rejection, so it is worth naming.

			   The offending key is deliberately not echoed back. A legitimate
			   client cannot produce one, and reflecting attacker-supplied text
			   into a response is a habit worth not having. */
			if (issue.code === 'unrecognized_keys') {
				return { questionId: null, message: UNRECOGNIZED_MESSAGE }
			}

			return {
				questionId: typeof issue.path[0] === 'string' ? issue.path[0] : null,
				message: issue.message,
			}
		}),
	}
}

/**
 * Drop keys that are blank answers to questions which are not on screen.
 *
 * The distinction is deliberate and it is the difference between a defence and
 * a papercut. A hidden question carrying a REAL answer is rejected — that is
 * the field-injection check, and buildAnswerSchema does it by leaving the key
 * out of the shape. A hidden question carrying a BLANK is not an answer at
 * all, so rejecting it would only punish an honest client: a draft restored
 * from an earlier session can easily hold an empty string for a question that
 * a later answer has since hidden, and there is nothing in it to reject.
 *
 * Keys with no value at all go the same way. A key explicitly set to undefined
 * is indistinguishable from an absent one in JavaScript, and JSON cannot carry
 * it over the wire, so treating the two alike keeps server behaviour matched to
 * what a browser can actually send.
 *
 * Unknown keys are untouched. They still have to reach the schema to be
 * rejected.
 */
function stripHiddenBlanks(
	questionnaire: Questionnaire,
	raw: AnswerBag,
	visible: ReadonlySet<string>,
): AnswerBag {
	const answerable = new Map<string, (typeof questionnaire.sections)[number]['questions'][number]>()
	for (const section of questionnaire.sections) {
		for (const question of section.questions) {
			if (isAnswerable(question)) answerable.set(question.id, question)
		}
	}

	const cleaned: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(raw)) {
		if (value === undefined) continue

		const question = answerable.get(key)
		if (question && isAnswerable(question) && !visible.has(key)) {
			const spec = FIELD[question.type]
			if (spec.isBlank(value)) continue
		}

		cleaned[key] = value
	}

	return cleaned
}
