/**
 * Content collections.
 *
 * Questionnaire definitions live in src/content/questionnaires rather than
 * anywhere under src/pages, so a stray or half-written file can never become a
 * route. They are registered as a collection rather than imported directly for
 * three things a plain import does not give:
 *
 *   - every definition is validated on every build, against the schema in
 *     lib/questionnaire/schema.ts;
 *   - a malformed file fails `pnpm build` with the file, line and column;
 *   - the types come out generated rather than hand-written.
 *
 * That last-but-one point is the whole guardrail for agent-generated
 * questionnaires: an invalid definition cannot deploy. No new CI, no new
 * tooling — the existing "astro check && astro build" script is the gate.
 *
 * YAML rather than JSON because these files carry prose. Astro bundles js-yaml
 * and registers .yaml as a data entry type itself, so this costs no dependency.
 */
import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { questionnaireSchema } from './lib/questionnaire/schema'

const questionnaires = defineCollection({
	loader: glob({ pattern: '**/*.yaml', base: './src/content/questionnaires' }),
	schema: questionnaireSchema,
})

export const collections = { questionnaires }
