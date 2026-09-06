/**
 * The field registry — one table, keyed by field type.
 *
 * This is the portal's src/components/portal/state.ts pattern applied to
 * behaviour rather than to colour: everything that differs between a `text`
 * question and a `checkbox` question is written once, here, and nothing
 * downstream branches on a type again. The renderer looks up `control`, the
 * validator looks up `schema`, the normalizer looks up `normalize`, `display`
 * and `chosen`.
 *
 * The map is typed `{ [T in AnswerableType]: FieldSpec<T> }`, so leaving an
 * entry out is a type error and `astro check` — already in the build script —
 * fails. That is what makes "adding a field type later" a bounded change: add
 * the union member in schema.ts, add the entry here, and the compiler names
 * every other place that needs to know.
 *
 * `info` is deliberately absent. It answers nothing, so it has no schema, no
 * normalization and no display; it is rendered by its own component and never
 * appears in a submission.
 */
import { z } from 'astro/zod'
import type { AnswerableQuestion, OfType, Option, Question } from './schema'

/** Every type that collects an answer — the union minus `info`. */
export type AnswerableType = AnswerableQuestion['type']

/**
 * The shape each type's answer takes once validated. Kept as a map rather than
 * inferred from the schemas so the normalizer and the canonical JSON have one
 * agreed vocabulary of value types, and so `display` can be typed per member.
 */
export interface AnswerValueMap {
	text: string
	textarea: string
	email: string
	phone: string
	number: number
	boolean: boolean
	radio: string
	select: string
	checkbox: string[]
	date: string
	confirm: true
}

export type AnswerValue<T extends AnswerableType> = AnswerValueMap[T]

/** Which control the renderer draws. Several types share one. */
export type Control = 'text' | 'textarea' | 'number' | 'radio' | 'select' | 'checkbox' | 'confirm' | 'date'

/**
 * How an input-like control is spelled in HTML. Kept in the table rather than
 * decided in the component, so `email` carrying `type="email"`, an email
 * inputmode and an autocomplete token is one fact in one place.
 */
export interface HtmlHints {
	/* Narrow unions rather than `string`: these values go straight onto an
	   <input>, and the renderer should not have to cast to put them there. */
	readonly type: 'text' | 'email' | 'tel' | 'number' | 'date'
	readonly inputMode?: 'text' | 'email' | 'tel' | 'decimal' | 'numeric'
	readonly autocomplete?: string
}

export interface FieldSpec<T extends AnswerableType> {
	readonly control: Control
	/** Present for the controls that render as a single <input>. */
	readonly html?: HtmlHints
	/**
	 * Validates a PRESENT, non-blank answer. Requiredness is not expressed
	 * here — it depends on conditional visibility, which this function cannot
	 * see. buildAnswerSchema() applies it.
	 */
	readonly schema: (question: OfType<T>) => z.ZodType<AnswerValue<T>>
	/**
	 * Does this raw value mean "not answered"? Runs BEFORE validation, on
	 * whatever arrived over the wire, so it takes `unknown`.
	 *
	 * The distinction it draws is the one the canonical JSON depends on: an
	 * empty string is an unanswered question, but `false` on a yes/no is a real
	 * answer and must survive.
	 */
	readonly isBlank: (raw: unknown) => boolean
	/** Canonical form of a validated answer. Order and whitespace settled here. */
	readonly normalize: (question: OfType<T>, value: AnswerValue<T>) => AnswerValue<T>
	/** The human-readable rendering, for the email and the `display` field. */
	readonly display: (question: OfType<T>, value: AnswerValue<T>) => string
	/** The option objects behind a choice answer, in definition order. */
	readonly chosen?: (question: OfType<T>, value: AnswerValue<T>) => Option[]
}

/**
 * The default "not answered" test: absent, null, empty string, empty array.
 *
 * `false` is deliberately NOT blank. A yes/no question answered "no" has been
 * answered, and collapsing that into "skipped" would lose the answer we most
 * wanted. `confirm` overrides this, because an unticked confirmation really is
 * an absence rather than a "no".
 */
const isBlankValue = (raw: unknown): boolean =>
	raw === undefined ||
	raw === null ||
	(typeof raw === 'string' && raw.trim() === '') ||
	(Array.isArray(raw) && raw.length === 0)

/** A zod enum over an option list. Options are guaranteed non-empty by the schema. */
const optionEnum = (options: readonly Option[]) =>
	z.enum(options.map((o) => o.value) as [string, ...string[]])

const labelFor = (options: readonly Option[], value: string): string =>
	options.find((o) => o.value === value)?.label ?? value

/*
 * Dates are formatted the way the Sweet Gems portal formats its own: parsed at
 * midnight UTC and printed in UTC with the locale named explicitly. Both halves
 * are load-bearing. A bare `new Date('2026-09-06')` is midnight UTC, so
 * formatting it anywhere west of Greenwich prints the day before — and naming
 * en-US keeps the output identical wherever the worker happens to run, which a
 * canonical format requires.
 */
const formatDate = (iso: string): string =>
	new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		timeZone: 'UTC',
	})

/** Trimmed, and with CRLF folded to LF so a textarea answer hashes the same everywhere. */
const cleanText = (value: string): string => value.replace(/\r\n/g, '\n').trim()

export const FIELD: { readonly [T in AnswerableType]: FieldSpec<T> } = {
	text: {
		control: 'text',
		html: { type: 'text' },
		schema: (q) => z.string().max(q.maxLength),
		isBlank: isBlankValue,
		normalize: (_q, v) => cleanText(v),
		display: (_q, v) => v,
	},

	textarea: {
		control: 'textarea',
		schema: (q) => z.string().max(q.maxLength),
		isBlank: isBlankValue,
		normalize: (_q, v) => cleanText(v),
		display: (_q, v) => v,
	},

	email: {
		control: 'text',
		html: { type: 'email', inputMode: 'email', autocomplete: 'email' },
		/* Trimmed before the format check, or a pasted address with a trailing
		   space is reported as malformed to someone who cannot see the space. */
		schema: () => z.string().max(200).transform(cleanText).pipe(z.email()),
		isBlank: isBlankValue,
		normalize: (_q, v) => v,
		display: (_q, v) => v,
	},

	phone: {
		control: 'text',
		html: { type: 'tel', inputMode: 'tel', autocomplete: 'tel' },
		/* No format enforcement beyond "has enough digits to be a phone number".
		   Numbers arrive with parentheses, dashes, dots, spaces, extensions and
		   country codes, and a stricter rule rejects real numbers — which on a
		   questionnaire costs us the contact detail we asked for. */
		schema: () =>
			z
				.string()
				.max(50)
				.transform(cleanText)
				.refine((v) => (v.match(/\d/g) ?? []).length >= 7, {
					message: 'Enter a phone number with at least 7 digits.',
				}),
		isBlank: isBlankValue,
		normalize: (_q, v) => v,
		display: (_q, v) => v,
	},

	number: {
		control: 'number',
		html: { type: 'number', inputMode: 'decimal' },
		schema: (q) => {
			let s = z.number()
			if (q.min !== undefined) s = s.min(q.min)
			if (q.max !== undefined) s = s.max(q.max)
			return s
		},
		isBlank: isBlankValue,
		normalize: (_q, v) => v,
		display: (q, v) => (q.unit ? `${v} ${q.unit}` : String(v)),
	},

	boolean: {
		control: 'radio',
		schema: () => z.boolean(),
		isBlank: isBlankValue,
		normalize: (_q, v) => v,
		display: (q, v) => (v ? q.yesLabel : q.noLabel),
	},

	radio: {
		control: 'radio',
		schema: (q) => optionEnum(q.options),
		isBlank: isBlankValue,
		normalize: (_q, v) => v,
		display: (q, v) => labelFor(q.options, v),
		chosen: (q, v) => q.options.filter((o) => o.value === v),
	},

	select: {
		control: 'select',
		schema: (q) => optionEnum(q.options),
		isBlank: isBlankValue,
		normalize: (_q, v) => v,
		display: (q, v) => labelFor(q.options, v),
		chosen: (q, v) => q.options.filter((o) => o.value === v),
	},

	checkbox: {
		control: 'checkbox',
		schema: (q) =>
			z
				.array(optionEnum(q.options))
				.max(q.options.length)
				.refine((v) => new Set(v).size === v.length, {
					message: 'The same choice was sent more than once.',
				}),
		isBlank: isBlankValue,
		/* Re-ordered to match the option list rather than the order the boxes
		   were ticked. Without this the same set of answers serializes two ways,
		   and the canonical JSON stops being canonical. */
		normalize: (q, v) => q.options.filter((o) => v.includes(o.value)).map((o) => o.value),
		display: (q, v) => q.options.filter((o) => v.includes(o.value)).map((o) => o.label).join(', '),
		chosen: (q, v) => q.options.filter((o) => v.includes(o.value)),
	},

	date: {
		control: 'date',
		html: { type: 'date' },
		schema: (q) => {
			/* ISO dates compare correctly as strings, which is why the schema
			   stores them as strings and never as Date objects. */
			let s: z.ZodType<string> = z.iso.date()
			if (q.min !== undefined) {
				const min = q.min
				s = s.refine((v) => v >= min, { message: `Choose a date on or after ${formatDate(min)}.` })
			}
			if (q.max !== undefined) {
				const max = q.max
				s = s.refine((v) => v <= max, { message: `Choose a date on or before ${formatDate(max)}.` })
			}
			return s
		},
		isBlank: isBlankValue,
		normalize: (_q, v) => v,
		display: (_q, v) => formatDate(v),
	},

	confirm: {
		control: 'confirm',
		schema: () => z.literal(true),
		/* An unticked box is an absence, not a "no" — so unlike `boolean`, this
		   one does count `false` as blank. The question then fails as
		   unanswered, which is the message the client should see. */
		isBlank: (raw) => isBlankValue(raw) || raw === false,
		normalize: () => true,
		display: () => 'Confirmed',
	},
}

/** Look up the spec for an answerable question, correctly narrowed. */
export function specFor<Q extends AnswerableQuestion>(question: Q): FieldSpec<Q['type']> {
	return FIELD[question.type] as FieldSpec<Q['type']>
}

/** Which control a question draws. `info` has none. */
export function controlFor(question: Question): Control | 'info' {
	return question.type === 'info' ? 'info' : FIELD[question.type].control
}
