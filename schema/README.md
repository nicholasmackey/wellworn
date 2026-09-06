# Writing a Wellworn questionnaire

One YAML file per client, in `src/content/questionnaires/`. The generic UI
renders it. There is no client-specific form code and there must never be any.

## The contract

`questionnaire.schema.json` in this directory is generated from
`src/lib/questionnaire/schema.ts` and is the structural contract. Point an
editor or an agent at it. Regenerate it with `pnpm schema` after any change to
the zod schema; the output is committed, so a stale file shows up in review.

Put this at the top of a definition for live editor validation:

```yaml
# yaml-language-server: $schema=../../../schema/questionnaire.schema.json
```

## Guardrails

An invalid definition cannot deploy. `pnpm build` runs `astro check` and the
content collection validates every file, so all of the following fail the build
with the file, line and column:

- an unknown field `type` (the error names every legal type)
- an unrecognised key — `choices:` for `options:`, `requred:` for `required:`
- a duplicate question id anywhere in the document
- a `showIf` naming a question that is not defined **above** it
- a `showIf` pointing at an `info` block or a `checkbox` group
- a `default` that is not one of the question's own options
- `min` greater than `max`, or a `default` longer than `maxLength`

## Field types

`text` · `textarea` · `email` · `phone` · `number` · `boolean` · `radio` ·
`select` · `checkbox` · `date` · `confirm` · `info`

`info` renders prose and holds no answer. `confirm` is a single acknowledgement
box and is always required. `boolean` is a yes/no pair, not a lone checkbox, so
"no" and "not answered" stay distinguishable.

## Versioning

- `schemaVersion` — the definition format. Currently `1`. You do not change it.
- `version` — this questionnaire. **Bump it when you add, remove, retype, or
  change the option values of a question. Do not bump it for wording.**

Drafts are namespaced by `version`. Bumping it triggers a field-by-field
migration of any saved draft: answers whose question id still exists and whose
type is unchanged are carried over, the rest are dropped and the client is told.
Fixing a typo in help text must never cost someone a half-finished answer.

## How to write the questions

**Ask for facts and business context. Never ask the client to write website
copy.** Wellworn writes the copy. "What does a customer need to know before
they contact you?" is a good question; "Write your about page" is not.

**Prefill what we already know.** If a fact is on file, put it in `default` and
ask them to correct it, or ask it as a `boolean`/`radio` confirmation. Retyping
what we already have is the fastest way to lose someone halfway down a form.

**Keep conditions shallow.** One condition per question, referencing something
above it. If a question needs two conditions, the questionnaire probably needs
restructuring instead.

**Use `help`, not longer labels.** The label is the question. The help line is
the permission to skip it, the example format, or the reassurance.

## Theming (optional)

Omit `theme` entirely and the questionnaire is Wellworn's own. That is the
normal case and the one every existing file takes.

A client with a brand can supply some of it. Every key is optional, and one key
is a complete theme:

```yaml
theme:
  logo: /images/brand/acme.svg   # a file already in /public/images. Never a URL.
  background: '#050505'
  text: '#FFFFFF'
  accent: '#E6532F'              # the submit button, the focus ring, the controls
  accentText: '#000000'          # derived from `accent` if omitted
  surface: '#141414'             # derived from `background` if omitted
  border: '#FFFFFF'              # derived from `text` if omitted
  semantic:
    info: '#3B82F6'
    success: '#22C55E'
    warning: '#F59E0B'
    error: '#EF4444'
```

What a theme cannot say is the point of it. There is no class name, no font, no
spacing, no layout and no component override, and colours are hex or nothing —
so a definition can change what the page is painted in and can never change how
it behaves. The renderer, the field types, the validation, the autosave and the
accessibility are identical on every questionnaire.

Values are requests rather than instructions. `src/lib/questionnaire/theme.ts`
measures each one against the ground it will be drawn on and holds it to the
ratio its role needs: 4.5:1 for anything read as text, 3:1 for a rule, a field
border or a focus ring. A colour that falls short is deepened until it passes,
and one that cannot pass is replaced by a safe default. Whatever it had to
override is printed on the build console.

Prefer supplying two or three values and letting the rest derive. `surface` and
`border` exist for the case a brand genuinely specifies them; naming them
otherwise is inventing a palette where a shade will do.

**Adding or changing a theme is not a reason to bump `version`.** It changes no
question, so it must not cost anyone a half-finished draft.
