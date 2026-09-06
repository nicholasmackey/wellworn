/**
 * The names the rendered form and the client script agree on.
 *
 * Both sides need to build the same id for the same question, and both need to
 * read the same data attributes. Writing them here rather than as string
 * literals in two files is what stops a rename in the component from silently
 * detaching the script — the sort of break that leaves the page looking
 * perfectly fine and quietly doing nothing.
 */
import type { Question, ShowIf } from './schema'

/** The control itself, and what a <label for> points at. */
export const controlId = (questionId: string): string => `q-${questionId}`

/** The hint under the label. Referenced by aria-describedby, never nested in the label. */
export const helpId = (questionId: string): string => `q-${questionId}-help`

/** The error message. Empty and hidden until validation fills it. */
export const errorId = (questionId: string): string => `q-${questionId}-error`

/** The wrapper the error summary links to and the page scrolls to. */
export const questionId = (id: string): string => `question-${id}`

/**
 * The describedby list for a control: hint first, then error.
 *
 * Both are always referenced. A hidden element is outside the accessibility
 * tree and contributes nothing, so listing the error id up front costs nothing
 * while it is empty and saves the script from rewriting the attribute — one
 * less thing to get wrong at exactly the moment a screen reader is listening.
 */
export function describedBy(question: Question): string | undefined {
	const ids: string[] = []
	if (question.type !== 'info' && question.help) ids.push(helpId(question.id))
	ids.push(errorId(question.id))
	return ids.length > 0 ? ids.join(' ') : undefined
}

/* ---------------------------------------------------------------------------
   Data attributes. The renderer writes them, the client script reads them, and
   nothing else in the page depends on them.
   --------------------------------------------------------------------------- */

export const DATA = {
	/** On <form>. Carries the questionnaire's identity for the draft key. */
	form: 'data-questionnaire',
	id: 'data-questionnaire-id',
	version: 'data-questionnaire-version',
	token: 'data-questionnaire-token',
	/** The engine format the page was rendered by. A bump discards drafts. */
	schemaVersion: 'data-schema-version',
	/** On a question wrapper. */
	question: 'data-question',
	type: 'data-question-type',
	required: 'data-question-required',
	/** On a question wrapper that has a condition. JSON, exactly as authored. */
	showIf: 'data-showif',
	/* Checkbox group bounds. HTML has no way to say "tick at least two", so the
	   rule has to travel to the script as data. */
	min: 'data-min',
	max: 'data-max',
} as const

/** Serialize a condition for the wrapper. Parsed back by the client script. */
export const showIfAttr = (showIf: ShowIf | undefined): string | undefined =>
	showIf ? JSON.stringify(showIf) : undefined
