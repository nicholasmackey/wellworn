import assert from 'node:assert/strict'
import test from 'node:test'
import { questionnaireSchema, SCHEMA_VERSION, type Questionnaire } from '../src/lib/questionnaire/schema'
import { normalizeSubmission } from '../src/lib/questionnaire/submission'
import {
	escapeHtml,
	renderSubmission,
} from '../src/lib/questionnaire/renderers'
import {
	createResendPayload,
	deliverSubmission,
} from '../src/lib/questionnaire/delivery'
import {
	clearDrafts,
	draftKey,
	readReceipt,
	receiptKey,
	writeDraft,
	writeReceipt,
} from '../src/lib/questionnaire/draft'
import { readFile } from 'node:fs/promises'
import {
	chevron,
	contrast,
	defaultVars,
	resolveTheme,
	THEME_DEFAULTS,
	themeStyle,
} from '../src/lib/questionnaire/theme'
import {
	handleQuestionnairePost,
	MAX_BODY_BYTES,
	methodNotAllowed,
	type QuestionnaireServerDependencies,
} from '../src/lib/questionnaire/server'

const SITE = new URL('https://wellworncreative.com')
const ENDPOINT = new URL('/api/questionnaire', SITE)
const TOKEN = '5a468912-b9f9-45f1-babc-c5774180b72b'
const NOW = new Date('2026-09-06T18:30:00.000Z')

const questionnaire: Questionnaire = questionnaireSchema.parse({
	schemaVersion: SCHEMA_VERSION,
	id: 'avioric-website',
	version: 2,
	token: TOKEN,
	client: 'Avioric',
	title: 'Website Questionnaire',
	intro: [],
	submitLabel: 'Send to Wellworn',
	confirmation: ['Thanks.'],
	sections: [
		{
			id: 'business-basics',
			title: 'Business basics',
			questions: [
				{ id: 'business-name', type: 'text', label: 'Business name', required: true },
				{ id: 'public-email', type: 'email', label: 'Public email', required: true },
				{
					id: 'pricing-current',
					type: 'radio',
					label: 'Pricing current?',
					required: true,
					options: [
						{ value: 'yes', label: 'Yes' },
						{ value: 'no', label: 'No' },
					],
				},
				{
					id: 'services',
					type: 'checkbox',
					label: 'Services',
					max: 2,
					options: [
						{ value: 'engraving', label: 'Engraving' },
						{ value: 'porting', label: 'Porting' },
					],
				},
				{
					id: 'location-visibility',
					type: 'select',
					label: 'Show location?',
					options: [
						{ value: 'show', label: 'Show it' },
						{ value: 'hide', label: 'Hide it' },
					],
				},
				{
					id: 'location-detail',
					type: 'textarea',
					label: 'Location detail',
					showIf: { question: 'location-visibility', equals: 'show' },
				},
				{ id: 'veteran-owned', type: 'boolean', label: 'Veteran owned?' },
				{
					id: 'use-as-basis',
					type: 'confirm',
					label: 'The answers are accurate.',
					required: true,
				},
			],
		},
	],
})

const safeValue = '<script>alert("x")</script>\nTom & Julia\n"quoted"\napostrophe\'s\n🔥'

const validAnswers = {
	'business-name': safeValue,
	'public-email': 'hello@avioric.com',
	'pricing-current': 'yes',
	services: ['porting', 'engraving'],
	'location-visibility': 'show',
	'location-detail': 'Texas',
	'veteran-owned': false,
	'use-as-basis': true,
}

const normalized = normalizeSubmission(questionnaire, validAnswers, {
	visible: new Set([
		'business-name',
		'public-email',
		'pricing-current',
		'services',
		'location-visibility',
		'location-detail',
		'veteran-owned',
		'use-as-basis',
	]),
	submittedAt: NOW,
})

test('HTML escaping covers every dangerous character', () => {
	assert.equal(escapeHtml('&<>"\''), '&amp;&lt;&gt;&quot;&#39;')
})

test('all four representations come only from the canonical submission and stay safe/readable', () => {
	const rendered = renderSubmission(normalized)
	assert.doesNotMatch(rendered.html, /<script>alert/)
	assert.match(rendered.html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/)
	assert.match(rendered.html, /Tom &amp; Julia/)
	assert.match(rendered.html, /apostrophe&#39;s/)
	assert.match(rendered.html, /🔥/)

	assert.match(rendered.text, /<script>alert\("x"\)<\/script>/)
	assert.match(rendered.text, /Tom & Julia/)
	assert.match(rendered.markdown, /&lt;script&gt;alert\\\("x"\\\)&lt;\/script&gt;/)
	assert.match(rendered.markdown, /Tom & Julia/)
	assert.deepEqual(JSON.parse(rendered.json), normalized)
})

test('Resend payload has fixed headers and parseable JSON/Markdown attachments', () => {
	const payload = createResendPayload(normalized, {
		to: 'nicholas@wellworncreative.com',
		from: 'Wellworn <forms@wellworncreative.com>',
	})
	assert.deepEqual(payload.to, ['nicholas@wellworncreative.com'])
	assert.equal(payload.from, 'Wellworn <forms@wellworncreative.com>')
	assert.equal(payload.subject, 'Avioric: Website Questionnaire')
	assert.ok(!payload.subject.includes(safeValue))
	assert.equal(Object.hasOwn(payload, 'reply_to'), false)

	const json = Buffer.from(payload.attachments[0].content, 'base64').toString('utf8')
	const markdown = Buffer.from(payload.attachments[1].content, 'base64').toString('utf8')
	assert.deepEqual(JSON.parse(json), normalized)
	assert.match(markdown, /^# Avioric/m)
	assert.match(markdown, /\*\*Business name\*\*/)
	assert.match(markdown, /🔥/)
})

test('Resend delivery reports request, response, configuration, and success states', async () => {
	const config = {
		apiKey: 're_test',
		to: 'nicholas@wellworncreative.com',
		from: 'Wellworn <forms@wellworncreative.com>',
	}
	assert.deepEqual(await deliverSubmission(normalized, { ...config, apiKey: '' }), {
		ok: false,
		kind: 'configuration',
	})
	assert.deepEqual(
		await deliverSubmission(normalized, config, {
			fetcher: async () => {
				throw new Error('offline')
			},
		}),
		{ ok: false, kind: 'request' },
	)
	assert.deepEqual(
		await deliverSubmission(normalized, config, {
			fetcher: async () => Response.json({ message: 'no' }, { status: 500 }),
		}),
		{ ok: false, kind: 'response', status: 500 },
	)
	assert.deepEqual(
		await deliverSubmission(normalized, config, {
			fetcher: async () => Response.json({ id: 'email-id' }),
			idempotencyKey: 'fixed-test-key',
		}),
		{ ok: true, id: 'email-id' },
	)
})

interface Harness {
	readonly dependencies: QuestionnaireServerDependencies
	readonly calls: { resend: number; loads: number }
	readonly sent: unknown[]
}

function harness(options: {
	resend?: 'pass' | 'fail' | 'throw'
	secrets?: Partial<Record<string, string>>
} = {}): Harness {
	const calls = { resend: 0, loads: 0 }
	const sent: unknown[] = []
	const secrets: Record<string, string> = {
		RESEND_API_KEY: 're_test',
		SUBMISSION_TO: 'nicholas@wellworncreative.com',
		RESEND_FROM: 'Wellworn <forms@wellworncreative.com>',
		...options.secrets,
	}

	return {
		calls,
		sent,
		dependencies: {
			now: () => NOW,
			logger: { log() {}, warn() {}, error() {} },
			getSecret: (name) => secrets[name],
			loadQuestionnaire: async (token, id) => {
				calls.loads++
				return token === TOKEN && id === questionnaire.id ? questionnaire : null
			},
			fetcher: async (input, init) => {
				/* Nothing but Resend should ever be reached from the request path
				   now. A call to anything else is a regression, not a stub. */
				const url = String(input)
				if (!url.startsWith('https://api.resend.com/')) {
					throw new Error(`Unexpected outbound request to ${url}`)
				}

				calls.resend++
				sent.push(JSON.parse(String(init?.body)))
				if (options.resend === 'throw') throw new Error('Resend unavailable')
				return options.resend === 'fail'
					? Response.json({ message: 'rejected' }, { status: 500 })
					: Response.json({ id: 'email-id' })
			},
		},
	}
}

function request(
	body: unknown = {
		questionnaireId: questionnaire.id,
		version: questionnaire.version,
		schemaVersion: questionnaire.schemaVersion,
		token: TOKEN,
		answers: validAnswers,
		_gotcha: '',
	},
	options: { origin?: string | null; contentType?: string; contentLength?: number; raw?: string } = {},
): Request {
	const headers = new Headers()
	if (options.origin !== null) headers.set('origin', options.origin ?? SITE.origin)
	headers.set('content-type', options.contentType ?? 'application/json')
	if (options.contentLength !== undefined) headers.set('content-length', String(options.contentLength))

	return new Request(ENDPOINT, {
		method: 'POST',
		headers,
		body: options.raw ?? JSON.stringify(body),
	})
}

const bodyWith = (changes: Record<string, unknown>) => ({
	questionnaireId: questionnaire.id,
	version: questionnaire.version,
	schemaVersion: questionnaire.schemaVersion,
	token: TOKEN,
	answers: validAnswers,
	_gotcha: '',
	...changes,
})

async function post(req: Request, h = harness()): Promise<{ response: Response; h: Harness; json: any }> {
	const response = await handleQuestionnairePost(
		{ request: req, url: ENDPOINT, site: SITE },
		h.dependencies,
	)
	return { response, h, json: await response.json() }
}

test('method restriction is explicit and non-cacheable', async () => {
	const response = methodNotAllowed()
	assert.equal(response.status, 405)
	assert.equal(response.headers.get('allow'), 'POST')
	assert.equal(response.headers.get('cache-control'), 'no-store')
})

test('request gates reject origin, media type, size, JSON, and envelope errors before loading', async (t) => {
	const cases: readonly [string, Request, number][] = [
		['missing Origin', request(undefined, { origin: null }), 403],
		['foreign Origin', request(undefined, { origin: 'https://example.com' }), 403],
		['null Origin', request(undefined, { origin: 'null' }), 403],
		['wrong content type', request(undefined, { contentType: 'text/plain' }), 415],
		['declared oversized body', request(undefined, { contentLength: MAX_BODY_BYTES + 1 }), 413],
		['actual oversized body', request(undefined, { raw: `{"x":"${'a'.repeat(MAX_BODY_BYTES)}"}` }), 413],
		['malformed JSON', request(undefined, { raw: '{' }), 400],
		['malformed envelope', request({ answers: [] }), 400],
	]

	for (const [name, req, status] of cases) {
		await t.test(name, async () => {
			const result = await post(req)
			assert.equal(result.response.status, status)
			assert.equal(result.h.calls.loads, 0)
			assert.equal(result.h.calls.resend, 0)
		})
	}
})

test('JSON with a charset reaches a successful delivery', async () => {
	const result = await post(request(undefined, { contentType: 'application/json; charset=utf-8' }))
	assert.equal(result.response.status, 200)
	assert.deepEqual(result.json, { ok: true })
})

test('identity and version gates retain the Phase 5 behavior', async (t) => {
	const cases: readonly [string, unknown, number][] = [
		['wrong token', bodyWith({ token: '00000000-0000-4000-8000-000000000000' }), 404],
		['token/id mismatch', bodyWith({ questionnaireId: 'other-questionnaire' }), 404],
		['stale questionnaire version', bodyWith({ version: 1 }), 409],
		['wrong schema version', bodyWith({ schemaVersion: 999 }), 409],
	]

	for (const [name, body, status] of cases) {
		await t.test(name, async () => {
			const result = await post(request(body))
			assert.equal(result.response.status, status)
			assert.equal(result.h.calls.resend, 0)
		})
	}
})

test('answer validation rejects missing, injected, hidden, and malformed answers before security calls', async (t) => {
	const without = (key: string) => {
		const answers = { ...validAnswers } as Record<string, unknown>
		delete answers[key]
		return answers
	}
	const cases: readonly [string, Record<string, unknown>][] = [
		['missing required answer', without('business-name')],
		['unknown answer key', { ...validAnswers, injected: 'nope' }],
		[
			'answer to hidden question',
			{ ...validAnswers, 'location-visibility': 'hide', 'location-detail': 'still supplied' },
		],
		['bad email', { ...validAnswers, 'public-email': 'not-email' }],
		['invalid choice', { ...validAnswers, 'pricing-current': 'maybe' }],
		['unticked required confirmation', without('use-as-basis')],
	]

	for (const [name, answers] of cases) {
		await t.test(name, async () => {
			const result = await post(request(bodyWith({ answers })))
			assert.equal(result.response.status, 422)
			assert.equal(result.h.calls.resend, 0)
		})
	}
})

test('a conditional answer is accepted when its condition is true', async () => {
	const result = await post(request())
	assert.equal(result.response.status, 200)
	assert.equal(result.h.calls.resend, 1)
})

test('a filled honeypot is dropped before Resend and tells the bot nothing', async (t) => {
	await t.test('no email is sent', async () => {
		const result = await post(request(bodyWith({ _gotcha: 'bot' })))
		assert.equal(result.h.calls.resend, 0)
		assert.equal(result.h.sent.length, 0)
	})

	await t.test('the questionnaire is never even loaded', async () => {
		const result = await post(request(bodyWith({ _gotcha: 'bot' })))
		assert.equal(result.h.calls.loads, 0)
	})

	await t.test('the response is indistinguishable from a real delivery', async () => {
		const trapped = await post(request(bodyWith({ _gotcha: 'bot' })))
		const delivered = await post(request())

		assert.equal(trapped.response.status, delivered.response.status)
		assert.deepEqual(trapped.json, delivered.json)
		assert.equal(
			trapped.response.headers.get('content-type'),
			delivered.response.headers.get('content-type'),
		)
		/* The point of the whole exercise: the bot cannot tell it was caught. */
		assert.equal(delivered.h.calls.resend, 1)
	})

	await t.test('whitespace alone is not a filled honeypot', async () => {
		const result = await post(request(bodyWith({ _gotcha: '   ' })))
		assert.equal(result.response.status, 200)
		assert.equal(result.h.calls.resend, 1)
	})

	await t.test('the honeypot value is never logged', async () => {
		const secret = 'buy-cheap-watches-dot-biz'
		const lines: string[] = []
		const h = harness()
		const logger = {
			log: (message: string) => lines.push(message),
			warn: (message: string) => lines.push(message),
			error: (message: string) => lines.push(message),
		}

		const response = await handleQuestionnairePost(
			{ request: request(bodyWith({ _gotcha: secret })), url: ENDPOINT, site: SITE },
			{ ...h.dependencies, logger },
		)

		assert.equal(response.status, 200)
		assert.ok(lines.length > 0, 'the drop should still be recorded')
		for (const line of lines) assert.ok(!line.includes(secret), `logged: ${line}`)
	})
})

test('nothing on the request path depends on Turnstile any more', async (t) => {
	await t.test('a body carrying no token is delivered', async () => {
		const body = bodyWith({})
		assert.ok(!('turnstileToken' in body))
		const result = await post(request(body))
		assert.equal(result.response.status, 200)
		assert.equal(result.h.calls.resend, 1)
	})

	await t.test('a leftover token field is ignored, not required', async () => {
		const result = await post(request(bodyWith({ turnstileToken: 'stale-widget-token' })))
		assert.equal(result.response.status, 200)
		assert.equal(result.h.calls.resend, 1)
	})

	await t.test('no Turnstile secret is read and no Siteverify call is made', async () => {
		const read: string[] = []
		const h = harness()
		const response = await handleQuestionnairePost(
			{ request: request(), url: ENDPOINT, site: SITE },
			{
				...h.dependencies,
				getSecret: (name) => {
					read.push(name)
					return h.dependencies.getSecret(name)
				},
			},
		)

		assert.equal(response.status, 200)
		assert.ok(!read.some((name) => name.toUpperCase().includes('TURNSTILE')))
		/* The harness fetcher throws on any host but Resend, so reaching a 200
		   at all proves Siteverify was never called. */
		assert.equal(h.calls.resend, 1)
	})
})

test('Resend failures are retryable and only a confirmed delivery succeeds', async (t) => {
	await t.test('Resend rejection', async () => {
		const result = await post(request(), harness({ resend: 'fail' }))
		assert.equal(result.response.status, 502)
		assert.equal(result.json.ok, false)
		assert.equal(result.h.calls.resend, 1)
	})

	await t.test('Resend network failure', async () => {
		const result = await post(request(), harness({ resend: 'throw' }))
		assert.equal(result.response.status, 502)
		assert.equal(result.h.calls.resend, 1)
	})

	await t.test('successful delivery', async () => {
		const result = await post(request())
		assert.equal(result.response.status, 200)
		assert.deepEqual(result.json, { ok: true })
		assert.equal(result.h.calls.resend, 1)
		const payload = result.h.sent[0] as Record<string, unknown>
		assert.equal(payload.subject, 'Avioric: Website Questionnaire')
		assert.ok(!String(payload.subject).includes(safeValue))
	})
})

/* ---------------------------------------------------------------------------
   The local receipt, and its one hard requirement: a successful send must not
   leave this device looking like nothing ever happened.
   --------------------------------------------------------------------------- */

/**
 * A minimal in-memory Storage.
 *
 * Entries are own enumerable properties and the methods are not, because that
 * is how the real thing behaves and because clearDrafts() enumerates the store
 * with Object.keys(). A stub that hid its entries behind a Map would pass while
 * the code under test swept nothing.
 */
function memoryStorage(): Storage {
	const store: Record<string, string> = {}
	const methods = {
		getItem: (key: string) => (key in store ? store[key] : null),
		setItem: (key: string, value: string) => {
			store[key] = String(value)
		},
		removeItem: (key: string) => {
			delete store[key]
		},
		clear: () => {
			for (const key of Object.keys(store)) delete store[key]
		},
		key: (index: number) => Object.keys(store)[index] ?? null,
		get length() {
			return Object.keys(store).length
		},
	}

	for (const [name, value] of Object.entries(Object.getOwnPropertyDescriptors(methods))) {
		Object.defineProperty(store, name, { ...value, enumerable: false })
	}

	return store as unknown as Storage
}

const RECEIPT_ID = 'avioric-website'

test('a successful submission produces a receipt that survives clearing the draft', () => {
	const storage = memoryStorage()

	writeDraft(storage, {
		id: RECEIPT_ID,
		version: 3,
		schemaVersion: SCHEMA_VERSION,
		answers: { 'business-name': 'Avioric' },
		types: { 'business-name': 'text' },
	})
	assert.ok(storage.getItem(draftKey(RECEIPT_ID, 3)))
	assert.equal(readReceipt(storage, { id: RECEIPT_ID, version: 3 }), null)

	/* The order the client uses: receipt, then sweep the answers. */
	assert.equal(writeReceipt(storage, { id: RECEIPT_ID, version: 3, submittedAt: NOW }), true)
	clearDrafts(storage, RECEIPT_ID)

	assert.equal(storage.getItem(draftKey(RECEIPT_ID, 3)), null)
	const receipt = readReceipt(storage, { id: RECEIPT_ID, version: 3 })
	assert.equal(receipt?.id, RECEIPT_ID)
	assert.equal(receipt?.version, 3)
	assert.equal(receipt?.submittedAt, NOW.toISOString())
})

test('a receipt is honored only for the version that was sent', async (t) => {
	await t.test('a newer questionnaire discards it and asks again', () => {
		const storage = memoryStorage()
		writeReceipt(storage, { id: RECEIPT_ID, version: 3, submittedAt: NOW })

		assert.equal(readReceipt(storage, { id: RECEIPT_ID, version: 4 }), null)
		/* Discarded outright, so the next visit is not re-tested against it. */
		assert.equal(storage.getItem(receiptKey(RECEIPT_ID)), null)
	})

	await t.test('a malformed receipt is treated as none', () => {
		const storage = memoryStorage()
		storage.setItem(receiptKey(RECEIPT_ID), '{not json')
		assert.equal(readReceipt(storage, { id: RECEIPT_ID, version: 3 }), null)

		storage.setItem(receiptKey(RECEIPT_ID), JSON.stringify({ id: RECEIPT_ID }))
		assert.equal(readReceipt(storage, { id: RECEIPT_ID, version: 3 }), null)
	})

	await t.test('storage that throws degrades to no receipt rather than an error', () => {
		const hostile = {
			getItem() {
				throw new Error('blocked')
			},
			setItem() {
				throw new Error('blocked')
			},
			removeItem() {
				throw new Error('blocked')
			},
		} as unknown as Storage

		assert.equal(writeReceipt(hostile, { id: RECEIPT_ID, version: 3 }), false)
		assert.equal(readReceipt(hostile, { id: RECEIPT_ID, version: 3 }), null)
	})
})

test('the receipt key sits outside the draft namespace clearDrafts sweeps', () => {
	assert.ok(!receiptKey(RECEIPT_ID).startsWith(`wellworn:q:${RECEIPT_ID}:v`))
	assert.equal(receiptKey(RECEIPT_ID), `wellworn:q:${RECEIPT_ID}:submitted`)
})

test('no Turnstile dependency remains anywhere in the source tree', async () => {
	const { readdir, readFile } = await import('node:fs/promises')
	const { join } = await import('node:path')

	const offenders: string[] = []
	const walk = async (dir: string): Promise<void> => {
		for (const entry of await readdir(dir, { withFileTypes: true })) {
			const path = join(dir, entry.name)
			if (entry.isDirectory()) {
				await walk(path)
			} else if (/\.(ts|tsx|js|mjs|astro|css|yaml|json|jsonc)$/.test(entry.name)) {
				const text = await readFile(path, 'utf8')
				if (/turnstile/i.test(text)) offenders.push(path)
			}
		}
	}

	for (const dir of ['src', 'schema', 'scripts']) await walk(dir)
	assert.deepEqual(offenders, [])

	const example = await readFile('.env.example', 'utf8')
	assert.ok(!/TURNSTILE/i.test(example))
	assert.ok(/RESEND_API_KEY/.test(example))
})


/* ==========================================================================
   OPTIONAL CLIENT THEMING

   Two questionnaires are tested against each other throughout: the themed one,
   which is Avioric's, and an unthemed one, which is every other client and is
   the Wellworn questionnaire itself. The claim being pinned is that the second
   is not merely close to what it was before theming existed but identical to
   it, and that the first cannot be made unreadable by anything a definition is
   allowed to say.
   ========================================================================== */

const base = {
	schemaVersion: SCHEMA_VERSION,
	id: 'themed',
	version: 1,
	token: TOKEN,
	client: 'Themed Co',
	title: 'Website Questionnaire',
	sections: [
		{
			id: 'basics',
			title: 'Basics',
			questions: [{ id: 'business-name', type: 'text', label: 'Business name' }],
		},
	],
}

/** Parse a document with the given theme, the way the content collection does. */
const withTheme = (theme: unknown): Questionnaire =>
	questionnaireSchema.parse(theme === undefined ? base : { ...base, theme })

/** Avioric's, as written in src/content/questionnaires/avioric.yaml. */
const AVIORIC_THEME = {
	background: '#050505',
	text: '#FFFFFF',
	accent: '#E6532F',
	semantic: {
		info: '#3B82F6',
		success: '#22C55E',
		warning: '#F59E0B',
		error: '#EF4444',
	},
}

test('an unthemed questionnaire sets no custom properties at all', () => {
	const questionnaire = withTheme(undefined)

	assert.equal(questionnaire.theme, undefined)
	assert.equal(resolveTheme(questionnaire.theme), null)
	assert.equal(themeStyle(resolveTheme(questionnaire.theme)), undefined)
})

test('the resolver defaults and the :root block in global.css describe the same page', async () => {
	/* The drift guard. global.css declares each --q-* default as a palette token
	   and this file declares it as a hex; if the two ever disagree, an unthemed
	   page renders one thing and the resolver believes it renders another —
	   which would show up as properties being emitted on a page that asked for
	   no theme. Resolving the tokens here is what makes that impossible to miss. */
	const css = await readFile('src/styles/global.css', 'utf8')

	const tokens = new Map<string, string>()
	for (const [, name, value] of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8});/g)) {
		tokens.set(`--color-${name}`, value.toLowerCase())
	}

	const declared = new Map<string, string>()
	for (const [, name, reference] of css.matchAll(/(--q-[a-z-]+):\s*var\((--color-[a-z0-9-]+)\);/g)) {
		const hex = tokens.get(reference)
		assert.ok(hex, `${name} points at ${reference}, which global.css does not define`)
		declared.set(name, hex)
	}

	const expected = defaultVars()
	/* Every colour property, but not the chevron: it is a url(), declared
	   literally in the stylesheet rather than as a token reference. */
	for (const [property, hex] of declared) {
		assert.equal(hex, expected[property], `${property} disagrees with THEME_DEFAULTS`)
	}
	assert.equal(declared.size, Object.keys(expected).length - 1)
	assert.ok(css.includes(`--q-chevron: ${chevron(THEME_DEFAULTS.text)};`))
})

test('the Avioric theme resolves to its black and orange, and derives the rest', () => {
	const theme = resolveTheme(withTheme(AVIORIC_THEME).theme)
	assert.ok(theme)

	/* What the definition asked for, carried through unchanged. */
	assert.equal(theme.vars['--q-background'], '#050505')
	assert.equal(theme.vars['--q-text'], '#ffffff')
	assert.equal(theme.vars['--q-accent'], '#e6532f')
	assert.equal(theme.vars['--q-info'], '#3b82f6')
	assert.equal(theme.vars['--q-success'], '#22c55e')
	assert.equal(theme.vars['--q-warning'], '#f59e0b')
	assert.equal(theme.vars['--q-error'], '#ef4444')

	/* All four clear 4.5:1 on this ground already, so the ink values are the
	   supplied colours rather than deepened copies of them. */
	assert.equal(theme.vars['--q-info-ink'], '#3b82f6')
	assert.equal(theme.vars['--q-error-ink'], '#ef4444')

	/* What the definition left out. surface lifts off the ground, border and
	   the chevron take the type colour, and the accent's label is chosen for
	   contrast rather than named — cream (3.27:1) and charcoal (4.36:1) both
	   fail on this orange, so it lands on black at 5.64:1. */
	assert.equal(theme.vars['--q-surface'], '#141414')
	assert.equal(theme.vars['--q-border'], '#ffffff')
	assert.equal(theme.vars['--q-accent-text'], '#000000')
	assert.equal(theme.vars['--q-accent-hover'], '#e96848')
	assert.equal(theme.vars['--q-chevron'], chevron('#ffffff'))

	/* The accent is visible on this ground, so it takes the focus ring and the
	   native controls from the portal's blue. */
	assert.equal(theme.vars['--q-focus'], '#e6532f')
	assert.equal(theme.vars['--q-control'], '#e6532f')

	/* A dark ground, so the browser's own controls are told about it and the
	   Wellworn attribution switches to the wordmark that can be seen on it. */
	assert.equal(theme.scheme, 'dark')
	assert.equal(theme.wordmark, 'light')
	assert.equal(theme.background, '#050505')
	assert.deepEqual(theme.notes, [])

	/* Nothing was invented: no logo is claimed, because none is in the repo. */
	assert.equal(theme.logo, undefined)
})

test('every resolved Avioric colour clears the ratio its role needs', () => {
	const theme = resolveTheme(withTheme(AVIORIC_THEME).theme)
	assert.ok(theme)
	const v = theme.vars
	const atLeast = (ratio: number, a: string, b: string, what: string) =>
		assert.ok(contrast(a, b) >= ratio, `${what}: ${contrast(a, b).toFixed(2)}:1 < ${ratio}:1`)

	/* Text, at 4.5:1. */
	atLeast(4.5, v['--q-text'], v['--q-background'], 'body copy on the page')
	atLeast(4.5, v['--q-text'], v['--q-surface'], 'body copy in a field')
	atLeast(4.5, v['--q-accent-text'], v['--q-accent'], 'the submit label')
	atLeast(4.5, v['--q-accent-text'], v['--q-accent-hover'], 'the submit label on hover')
	atLeast(4.5, v['--q-error-on'], v['--q-error-ink'], 'the destructive button label')
	for (const name of ['info', 'success', 'warning', 'error']) {
		atLeast(4.5, v[`--q-${name}-ink`], v['--q-background'], `${name} as small text`)
	}

	/* Rules, borders, focus rings and control fills, at 3:1. */
	atLeast(3, v['--q-border'], v['--q-background'], 'the section rule')
	atLeast(3, v['--q-focus'], v['--q-background'], 'the focus ring')
	atLeast(3, v['--q-control'], v['--q-surface'], 'a checkbox against its field')
	for (const name of ['info', 'success', 'warning', 'error']) {
		atLeast(3, v[`--q-${name}`], v['--q-background'], `the ${name} band's rule`)
	}
})

test('a theme that supplies only a logo changes no colour', () => {
	const theme = resolveTheme(withTheme({ logo: '/images/brand/acme.svg' }).theme)
	assert.ok(theme)

	assert.equal(theme.logo, '/images/brand/acme.svg')
	assert.deepEqual(theme.vars, {})
	assert.equal(themeStyle(theme), undefined)
	assert.equal(theme.wordmark, 'dark')
	assert.equal(theme.scheme, 'light')
})

test('unreadable colours are corrected rather than rendered', async (t) => {
	await t.test('type that cannot be read on the ground is replaced', () => {
		const theme = resolveTheme(withTheme({ background: '#101010', text: '#1a1a1a' }).theme)
		assert.ok(theme)
		assert.equal(theme.vars['--q-text'], '#ffffff')
		assert.match(theme.notes.join(' '), /text was unreadable/)
	})

	await t.test('an accent always ends up with a label that can be read on it', () => {
		/* Every hex has a legible label: the band where neither white nor black
		   clears 4.5:1 is empty, so the resolver's last resort — surrendering the
		   accent to the default — is a guard rather than a path anything reaches.
		   What matters is that the label is chosen by measurement and never left
		   at whatever the palette happened to offer. */
		for (const accent of ['#767676', '#e6532f', '#ffd400', '#0b1d51']) {
			const theme = resolveTheme(withTheme({ accent }).theme)
			assert.ok(theme)
			const fill = theme.vars['--q-accent'] ?? THEME_DEFAULTS.accent
			const label = theme.vars['--q-accent-text'] ?? THEME_DEFAULTS.accentText
			assert.ok(
				contrast(label, fill) >= 4.5,
				`${label} on ${accent} is only ${contrast(label, fill).toFixed(2)}:1`,
			)
		}
	})

	await t.test('a status colour too pale for its ground is deepened, not dropped', () => {
		const theme = resolveTheme(withTheme({ semantic: { error: '#ffe4e4' } }).theme)
		assert.ok(theme)
		assert.ok(contrast(theme.vars['--q-error'], '#ffffff') >= 3)
		assert.ok(contrast(theme.vars['--q-error-ink'], '#ffffff') >= 4.5)
		/* Still red: deepening spends lightness and keeps the hue. */
		const [r, , b] = [1, 3, 5].map((i) => Number.parseInt(theme.vars['--q-error-ink'].slice(i, i + 2), 16))
		assert.ok(r > b, 'the deepened error colour is still a red')
	})

	await t.test('a border invisible on its ground falls back to the type colour', () => {
		const theme = resolveTheme(withTheme({ border: '#fdfdfd' }).theme)
		assert.ok(theme)
		/* It resolves back to the type colour, which on an otherwise unthemed page
		   IS the default border — so there is nothing left to emit, and the page
		   renders the rule it always had. */
		assert.equal(theme.vars['--q-border'] ?? THEME_DEFAULTS.border, THEME_DEFAULTS.text)
		assert.match(theme.notes.join(' '), /border was invisible/)
	})
})

test('the style attribute carries custom properties and nothing else', () => {
	const style = themeStyle(resolveTheme(withTheme(AVIORIC_THEME).theme))
	assert.ok(style)

	/* Every declaration is a --q-* property, bar the one color-scheme keyword a
	   dark ground needs to reach the browser's own controls. */
	for (const declaration of style.split(';')) {
		assert.match(declaration, /^(--q-[a-z-]+:|color-scheme:dark$)/)
	}
	assert.ok(style.endsWith(';color-scheme:dark'))

	/* A light ground says nothing about the scheme. */
	const light = themeStyle(resolveTheme(withTheme({ accent: '#005a2b' }).theme))
	assert.ok(light && !light.includes('color-scheme'))
})

test('a definition cannot smuggle CSS, markup or a remote asset through a theme', async (t) => {
	const rejects = (theme: unknown) =>
		assert.equal(questionnaireSchema.safeParse({ ...base, theme }).success, false)

	await t.test('colours are hex and nothing else', () => {
		for (const value of [
			'red',
			'var(--color-charcoal)',
			'#fff;background:url(https://evil.test)',
			'rgb(0 0 0)',
			'#12345',
			'url(https://evil.test/x.png)',
		]) {
			rejects({ background: value })
			rejects({ semantic: { error: value } })
		}
	})

	await t.test('a logo is a local image path, never a URL or a way out of /images', () => {
		for (const value of [
			'https://evil.test/logo.svg',
			'//evil.test/logo.svg',
			'/images/../../etc/passwd',
			'/images/../secret.svg',
			'/documents/contract.pdf',
			'/images/logo.js',
			'javascript:alert(1)',
		]) {
			rejects({ logo: value })
		}

		assert.equal(
			questionnaireSchema.safeParse({ ...base, theme: { logo: '/images/brand/acme.svg' } })
				.success,
			true,
		)
	})

	await t.test('there is nowhere to put a class, a font, a size or a layout', () => {
		for (const key of ['class', 'className', 'css', 'font', 'fontFamily', 'spacing', 'layout', 'radius']) {
			rejects({ [key]: 'anything' })
		}
		rejects({ semantic: { danger: '#ff0000' } })
	})
})

test('the Avioric definition on disk is the themed one, and carries no invented logo', async () => {
	const yaml = await readFile('src/content/questionnaires/avioric.yaml', 'utf8')

	assert.match(yaml, /^theme:$/m)
	for (const value of ['#050505', '#FFFFFF', '#E6532F', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444']) {
		assert.ok(yaml.includes(value), `avioric.yaml is missing ${value}`)
	}
	assert.ok(!/^\s+logo:/m.test(yaml), 'avioric.yaml names a logo that is not in the repository')
})
