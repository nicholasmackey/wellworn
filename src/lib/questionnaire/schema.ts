/**
 * The questionnaire definition schema — the contract every client's YAML file
 * is held to, and the only place a field type is described.
 *
 * Zod comes from `astro/zod` rather than a dependency of our own. Astro already
 * bundles zod 4 and exports it, so this file adds nothing to the install, and
 * the schema stays importable from three places that cannot share a bundler:
 * the content collection (Vite), the submission endpoint (the Cloudflare
 * worker), and the JSON Schema generator (plain node).
 *
 * Two versions live here and they mean different things:
 *
 *   schemaVersion  the definition FORMAT, engine-wide. Bumps when this file
 *                  changes shape. Every questionnaire moves at once.
 *   version        the INSTRUMENT, per questionnaire. Bumps when questions
 *                  change in a way that invalidates answers already given.
 *
 * The split is what lets a typo in a help string be fixed without throwing
 * away a client's half-finished draft — drafts are namespaced by `version`,
 * so cosmetic edits cost nothing. See lib/questionnaire/draft.ts.
 */
import { z } from 'astro/zod'

/** The current definition format. Every file must declare it. */
export const SCHEMA_VERSION = 1

/*
 * An id is a slug, and it is the join between four things: the key in this
 * file, the `name` of the rendered control, the key in a saved draft, and the
 * key in the canonical submission JSON. Constraining it to a slug means none
 * of those four ever has to quote, escape or encode it.
 */
const id = z
	.string()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be a lowercase slug, e.g. "business-name".')
	.max(64)

/*
 * One condition, never a boolean tree.
 *
 * A single comparison against a single earlier question covers every real case
 * we have, and it is the version an agent cannot get wrong. `and`/`or` nesting
 * would be the natural next step and is deliberately not taken: it multiplies
 * the ways a definition can be valid but incomprehensible, and it makes the
 * client-side evaluator something other than a lookup.
 *
 * The referenced question must appear EARLIER in the document — enforced in
 * the cross-checks at the foot of this file, which is what makes dependency
 * cycles structurally impossible rather than merely discouraged.
 */
const showIf = z
	.strictObject({
		question: id,
		/** Match one value exactly. */
		equals: z.union([z.string(), z.number(), z.boolean()]).optional(),
		/** Match any of several. Use for radio/select, never for booleans. */
		in: z.array(z.union([z.string(), z.number()])).min(1).max(30).optional(),
	})
	.refine((c) => (c.equals !== undefined) !== (c.in !== undefined), {
		message: 'showIf needs exactly one of `equals` or `in`.',
	})

/**
 * What every question that collects an answer has in common.
 *
 * Spread rather than `.extend()`ed, because a discriminated union needs each
 * member to be a plain object type: `.extend()` would still give one, but
 * spreading keeps every member readable as a single literal, which is what
 * makes the union below scannable as the list of field types it is.
 */
const base = {
	id,
	label: z.string().min(1).max(200),
	/** A sentence under the label. Never part of the label — see FieldShell. */
	help: z.string().max(400).optional(),
	required: z.boolean().default(false),
	showIf: showIf.optional(),
}

/** One selectable option. `value` is a slug so it survives into the JSON. */
const option = z.strictObject({
	value: id,
	label: z.string().min(1).max(120),
})

const options = z.array(option)

/**
 * Every field type the engine can render, as a discriminated union.
 *
 * This is the guardrail that matters most for agent-generated files: an
 * invented type fails with "Invalid discriminator value. Expected 'text' |
 * 'textarea' | ...", which names the entire legal set in the error message, so
 * an agent can correct itself from the failure alone. And every member is a
 * `strictObject`, so a plausible-but-wrong key — `choices:` for `options:`,
 * `requred:` for `required:` — is a build failure rather than a silently
 * dropped line that would ship a question with no options.
 *
 * Adding a type later is one member here plus one entry in registry.ts. The
 * renderer never grows a branch, because it dispatches through that table.
 */
export const questionSchema = z.discriminatedUnion('type', [
	z.strictObject({
		...base,
		type: z.literal('text'),
		placeholder: z.string().max(120).optional(),
		default: z.string().max(500).optional(),
		maxLength: z.number().int().min(1).max(500).default(200),
		/** Maps to the HTML autocomplete token, e.g. "organization". */
		autocomplete: z.string().max(40).optional(),
	}),

	z.strictObject({
		...base,
		type: z.literal('textarea'),
		placeholder: z.string().max(120).optional(),
		default: z.string().max(5000).optional(),
		rows: z.number().int().min(2).max(16).default(5),
		maxLength: z.number().int().min(1).max(5000).default(2000),
	}),

	z.strictObject({
		...base,
		type: z.literal('email'),
		placeholder: z.string().max(120).optional(),
		default: z.string().max(200).optional(),
	}),

	z.strictObject({
		...base,
		type: z.literal('phone'),
		placeholder: z.string().max(120).optional(),
		default: z.string().max(50).optional(),
	}),

	z.strictObject({
		...base,
		type: z.literal('number'),
		min: z.number().optional(),
		max: z.number().optional(),
		step: z.number().positive().optional(),
		/** Rendered as a suffix beside the box, e.g. "days" or "miles". */
		unit: z.string().max(24).optional(),
		default: z.number().optional(),
	}),

	/* A yes/no pair of radios rather than a lone checkbox. A single box cannot
	   distinguish "no" from "not answered", and on a questionnaire that
	   difference is information we want. */
	z.strictObject({
		...base,
		type: z.literal('boolean'),
		yesLabel: z.string().max(40).default('Yes'),
		noLabel: z.string().max(40).default('No'),
		default: z.boolean().optional(),
	}),

	z.strictObject({
		...base,
		type: z.literal('radio'),
		options: options.min(2).max(20),
		default: id.optional(),
	}),

	z.strictObject({
		...base,
		type: z.literal('select'),
		options: options.min(2).max(60),
		placeholder: z.string().max(120).default('Choose one'),
		default: id.optional(),
	}),

	z.strictObject({
		...base,
		type: z.literal('checkbox'),
		options: options.min(1).max(30),
		/** How many boxes must be ticked. `min: 1` is the usual "required". */
		min: z.number().int().nonnegative().optional(),
		max: z.number().int().positive().optional(),
		default: z.array(id).optional(),
	}),

	z.strictObject({
		...base,
		type: z.literal('date'),
		min: z.iso.date().optional(),
		max: z.iso.date().optional(),
		default: z.iso.date().optional(),
	}),

	/* A single acknowledgement box. Always required — a confirmation nobody has
	   to tick is furniture, and `required: false` here would produce a control
	   whose unticked state means nothing at all. */
	z.strictObject({
		...base,
		type: z.literal('confirm'),
		required: z.literal(true).default(true),
	}),

	/* The non-input block: a heading and paragraphs, answering nothing.
	   It carries no label, no required flag and no default, so it cannot claim
	   to hold an answer. It keeps `id` and `showIf` so it can be addressed and
	   conditionally shown like everything else. */
	z.strictObject({
		id,
		type: z.literal('info'),
		showIf: showIf.optional(),
		heading: z.string().max(120).optional(),
		body: z.array(z.string().max(1200)).min(1).max(10),
	}),
])

/** One section: a titled group of questions. */
export const sectionSchema = z.strictObject({
	id,
	title: z.string().min(1).max(120),
	description: z.string().max(600).optional(),
	questions: z.array(questionSchema).min(1).max(60),
})

/**
 * The document, before cross-checks.
 *
 * Exported separately because this is the half that can be expressed as JSON
 * Schema. The refinements below cannot be, so the generated schema/*.json
 * describes this and the build enforces the rest. See scripts/gen-questionnaire-schema.mjs.
 */
export const questionnaireDocument = z.strictObject({
	schemaVersion: z.literal(SCHEMA_VERSION),
	id,
	version: z.number().int().positive(),
	/** The unguessable route segment. Unlisted, not secret — as with the portals. */
	token: z.uuid(),
	client: z.string().min(1).max(120),
	title: z.string().min(1).max(120),
	/** Paragraphs above the first section. */
	intro: z.array(z.string().max(1200)).max(6).default([]),
	/** Co-brand lockup, under /public/images. Falls back to the wordmark. */
	masthead: z
		.strictObject({
			src: z.string().startsWith('/images/'),
			width: z.number().int().positive(),
			height: z.number().int().positive(),
			/** The ratio the artwork is cropped to. See ProjectMasthead. */
			ratio: z.string().max(20).optional(),
		})
		.optional(),
	submitLabel: z.string().max(40).default('Send to Wellworn'),
	/** Paragraphs on the thank-you screen. */
	confirmation: z.array(z.string().max(1200)).max(6).default([]),
	sections: z.array(sectionSchema).min(1).max(20),
})

/**
 * The three checks a per-field schema cannot make. Each is a class of mistake
 * — an agent's or ours — that would otherwise render as a broken page rather
 * than fail the build.
 *
 * Issues carry a `path` so Astro's content-collection error can point at the
 * right area of the file; the message names the offending id either way.
 */
export const questionnaireSchema = questionnaireDocument.superRefine((doc, ctx) => {
	const seen = new Map<string, (typeof doc.sections)[number]['questions'][number]>()
	const sectionIds = new Set<string>()

	doc.sections.forEach((section, s) => {
		if (sectionIds.has(section.id)) {
			ctx.addIssue({
				code: 'custom',
				path: ['sections', s, 'id'],
				message: `Duplicate section id "${section.id}".`,
			})
		}
		sectionIds.add(section.id)

		section.questions.forEach((question, q) => {
			const at = ['sections', s, 'questions', q] as const

			/* 1. Question ids are unique across the WHOLE document, not per
			      section. They are form control names and draft keys, both of
			      which are flat. */
			if (seen.has(question.id)) {
				ctx.addIssue({
					code: 'custom',
					path: [...at, 'id'],
					message: `Duplicate question id "${question.id}". Ids must be unique across the whole questionnaire.`,
				})
			}

			/* 2. A condition may only reference a question already defined above
			      it. Forward references and self-reference are impossible by
			      construction, so no cycle can exist and a single forward pass
			      resolves visibility. */
			if (question.showIf) {
				const target = seen.get(question.showIf.question)
				if (!target) {
					ctx.addIssue({
						code: 'custom',
						path: [...at, 'showIf', 'question'],
						message: `"${question.id}" depends on "${question.showIf.question}", which is not defined above it.`,
					})
				} else if (target.type === 'info') {
					ctx.addIssue({
						code: 'custom',
						path: [...at, 'showIf', 'question'],
						message: `"${question.id}" depends on "${target.id}", which is an info block and holds no answer.`,
					})
				} else if (target.type === 'checkbox') {
					ctx.addIssue({
						code: 'custom',
						path: [...at, 'showIf', 'question'],
						message: `"${question.id}" depends on "${target.id}", which is a checkbox group. Conditions compare single values.`,
					})
				}
			}

			/* 3. A default has to be something the reader can actually pick, and
			      a range has to be the right way round. Both render as a control
			      that looks fine and behaves wrongly. */
			if (question.type === 'radio' || question.type === 'select') {
				const values = new Set(question.options.map((o) => o.value))
				if (values.size !== question.options.length) {
					ctx.addIssue({
						code: 'custom',
						path: [...at, 'options'],
						message: `"${question.id}" has duplicate option values.`,
					})
				}
				if (question.default !== undefined && !values.has(question.default)) {
					ctx.addIssue({
						code: 'custom',
						path: [...at, 'default'],
						message: `"${question.id}" defaults to "${question.default}", which is not one of its options.`,
					})
				}
			}

			if (question.type === 'checkbox') {
				const values = new Set(question.options.map((o) => o.value))
				if (values.size !== question.options.length) {
					ctx.addIssue({
						code: 'custom',
						path: [...at, 'options'],
						message: `"${question.id}" has duplicate option values.`,
					})
				}
				for (const value of question.default ?? []) {
					if (!values.has(value)) {
						ctx.addIssue({
							code: 'custom',
							path: [...at, 'default'],
							message: `"${question.id}" defaults to "${value}", which is not one of its options.`,
						})
					}
				}
				if (question.max !== undefined && question.max > question.options.length) {
					ctx.addIssue({
						code: 'custom',
						path: [...at, 'max'],
						message: `"${question.id}" allows up to ${question.max} choices but offers ${question.options.length}.`,
					})
				}
				if (question.min !== undefined && question.max !== undefined && question.min > question.max) {
					ctx.addIssue({
						code: 'custom',
						path: [...at, 'min'],
						message: `"${question.id}" has min greater than max.`,
					})
				}
			}

			if (
				(question.type === 'number' || question.type === 'date') &&
				question.min !== undefined &&
				question.max !== undefined &&
				question.min > question.max
			) {
				ctx.addIssue({
					code: 'custom',
					path: [...at, 'min'],
					message: `"${question.id}" has min greater than max.`,
				})
			}

			/* A prefilled answer longer than the box will accept is a form the
			   client cannot submit without editing a field they never touched. */
			if (
				(question.type === 'text' || question.type === 'textarea') &&
				question.default !== undefined &&
				question.default.length > question.maxLength
			) {
				ctx.addIssue({
					code: 'custom',
					path: [...at, 'default'],
					message: `"${question.id}" has a default longer than its maxLength of ${question.maxLength}.`,
				})
			}

			seen.set(question.id, question)
		})
	})
})

export type Questionnaire = z.infer<typeof questionnaireSchema>
export type Section = z.infer<typeof sectionSchema>
export type Question = z.infer<typeof questionSchema>
export type QuestionType = Question['type']
export type Option = z.infer<typeof option>
export type ShowIf = NonNullable<Question['showIf']>

/** Narrow the union to one member, e.g. `OfType<'radio'>`. */
export type OfType<T extends QuestionType> = Extract<Question, { type: T }>

/** Every question that collects an answer — the union minus `info`. */
export type AnswerableQuestion = Exclude<Question, { type: 'info' }>

/** Walks the document in definition order. The order IS the contract. */
export function* eachQuestion(
	questionnaire: Questionnaire,
): Generator<{ section: Section; question: Question }> {
	for (const section of questionnaire.sections) {
		for (const question of section.questions) {
			yield { section, question }
		}
	}
}

export function isAnswerable(question: Question): question is AnswerableQuestion {
	return question.type !== 'info'
}
