/**
 * Generates schema/questionnaire.schema.json from the zod definition schema.
 *
 * This is the contract an AI agent is handed when asked to write a
 * questionnaire for a new client. Generating it — rather than maintaining a
 * JSON Schema by hand beside the zod one — is the point: the agent's contract
 * cannot drift from what the build actually enforces, because there is only
 * one description and this is a projection of it.
 *
 * It projects `questionnaireDocument`, the plain object schema, not
 * `questionnaireSchema`, which adds cross-field checks (unique ids, backward
 * showIf references, defaults that exist among their options). Those are not
 * expressible in JSON Schema. So the generated file describes the SHAPE and
 * the build enforces the rest — an agent gets structural feedback in its
 * editor and the remaining feedback from `pnpm build`.
 *
 * Run with `pnpm schema` after any change to src/lib/questionnaire/schema.ts.
 * The output is committed, so a stale file shows up in review as a diff nobody
 * meant to make.
 *
 * Node strips the TypeScript types on import (>= 22.18 does it without a
 * flag), which is why this can import the .ts source directly rather than
 * needing a build step of its own.
 */
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { z } from 'astro/zod'
import { questionnaireDocument, SCHEMA_VERSION } from '../src/lib/questionnaire/schema.ts'

const OUT = fileURLToPath(new URL('../schema/questionnaire.schema.json', import.meta.url))

/*
 * `io: 'input'` describes what an author WRITES, not what the parser returns.
 * The difference is every field carrying a `.default()`: on the output side
 * they are required and always present, on the input side they are optional.
 * An agent writing a file needs the input view, or it would believe it has to
 * spell out `maxLength` on every text question.
 *
 * `unrepresentable: 'any'` lets the few checks JSON Schema cannot express fall
 * through as unconstrained rather than throwing. Nothing structural is lost;
 * the build still enforces them.
 */
const jsonSchema = z.toJSONSchema(questionnaireDocument, {
	io: 'input',
	unrepresentable: 'any',
	target: 'draft-2020-12',
})

const document = {
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	$id: 'https://wellworncreative.com/schema/questionnaire.schema.json',
	title: 'Wellworn questionnaire definition',
	description:
		`Definition format version ${SCHEMA_VERSION}. One file per client, in ` +
		'src/content/questionnaires. Generated from src/lib/questionnaire/schema.ts ' +
		'by scripts/gen-questionnaire-schema.mjs — do not edit by hand.',
	...jsonSchema,
}

await writeFile(OUT, `${JSON.stringify(document, null, '\t')}\n`, 'utf8')

const types = document.properties?.sections?.items?.properties?.questions?.items?.oneOf?.length
console.log(`[wellworn] wrote schema/questionnaire.schema.json (${types ?? '?'} field types)`)
