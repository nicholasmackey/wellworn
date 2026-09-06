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
	TURNSTILE_DEVELOPMENT_SECRET_KEY,
	verifyTurnstile,
} from '../src/lib/questionnaire/security'
import {
	isTurnstileTestSiteKey,
	resolveTurnstileSiteKey,
	TURNSTILE_DEVELOPMENT_SITE_KEY,
} from '../src/lib/questionnaire/turnstile'
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

test('Turnstile validates token, hostname, and action and distinguishes outages', async () => {
	let called = 0
	const validFetch: typeof fetch = async () => {
		called++
		return Response.json({
			success: true,
			hostname: 'wellworncreative.com',
			action: 'questionnaire',
		})
	}

	assert.deepEqual(
		await verifyTurnstile({ token: '', secret: 'secret', hostname: SITE.hostname, fetcher: validFetch }),
		{ ok: false, kind: 'invalid' },
	)
	assert.equal(called, 0)
	assert.deepEqual(
		await verifyTurnstile({ token: 'valid', secret: 'secret', hostname: SITE.hostname, fetcher: validFetch }),
		{ ok: true },
	)
	assert.equal(called, 1)
	assert.deepEqual(
		await verifyTurnstile({
			token: 'valid',
			secret: 'secret',
			hostname: 'www.wellworncreative.com',
			fetcher: validFetch,
		}),
		{ ok: false, kind: 'invalid' },
	)
	assert.deepEqual(
		await verifyTurnstile({
			token: 'valid',
			secret: 'secret',
			hostname: SITE.hostname,
			fetcher: async () => {
				throw new Error('offline')
			},
		}),
		{ ok: false, kind: 'unavailable' },
	)

	const testResponseFetch: typeof fetch = async () =>
		Response.json({
			success: true,
			hostname: 'example.com',
			metadata: { result_with_testing_key: true },
		})
	assert.deepEqual(
		await verifyTurnstile({
			token: 'dummy-token',
			secret: TURNSTILE_DEVELOPMENT_SECRET_KEY,
			hostname: 'localhost',
			fetcher: testResponseFetch,
		}),
		{ ok: false, kind: 'invalid' },
	)
	assert.deepEqual(
		await verifyTurnstile({
			token: 'dummy-token',
			secret: TURNSTILE_DEVELOPMENT_SECRET_KEY,
			hostname: 'localhost',
			fetcher: testResponseFetch,
			allowTestResponse: true,
		}),
		{ ok: true },
	)
	assert.deepEqual(
		await verifyTurnstile({
			token: 'dummy-token',
			secret: 'production-secret',
			hostname: 'localhost',
			fetcher: testResponseFetch,
			allowTestResponse: true,
		}),
		{ ok: false, kind: 'invalid' },
	)
})

test('Turnstile site keys use a test key only outside production', () => {
	assert.equal(
		resolveTurnstileSiteKey({ configuredSiteKey: '', production: false }),
		TURNSTILE_DEVELOPMENT_SITE_KEY,
	)
	assert.equal(isTurnstileTestSiteKey(TURNSTILE_DEVELOPMENT_SITE_KEY), true)
	assert.equal(
		resolveTurnstileSiteKey({ configuredSiteKey: ' local-override ', production: false }),
		'local-override',
	)

	assert.throws(
		() => resolveTurnstileSiteKey({ configuredSiteKey: '', production: true }),
		/PUBLIC_TURNSTILE_SITE_KEY is required for production/,
	)
	assert.throws(
		() =>
			resolveTurnstileSiteKey({
				configuredSiteKey: TURNSTILE_DEVELOPMENT_SITE_KEY,
				production: true,
			}),
		/Cloudflare test key/,
	)
	assert.equal(
		resolveTurnstileSiteKey({
			configuredSiteKey: ' 0x4AAAAAA-production-site-key ',
			production: true,
		}),
		'0x4AAAAAA-production-site-key',
	)
})

interface Harness {
	readonly dependencies: QuestionnaireServerDependencies
	readonly calls: { turnstile: number; resend: number; loads: number }
	readonly sent: unknown[]
}

function harness(options: {
	turnstile?: 'pass' | 'fail' | 'throw'
	resend?: 'pass' | 'fail' | 'throw'
	secrets?: Partial<Record<string, string>>
} = {}): Harness {
	const calls = { turnstile: 0, resend: 0, loads: 0 }
	const sent: unknown[] = []
	const secrets: Record<string, string> = {
		TURNSTILE_SECRET_KEY: 'turnstile-secret',
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
				const url = String(input)
				if (url.includes('/siteverify')) {
					calls.turnstile++
					if (options.turnstile === 'throw') throw new Error('Turnstile unavailable')
					return Response.json(
						options.turnstile === 'fail'
							? { success: false, 'error-codes': ['invalid-input-response'] }
							: { success: true, hostname: SITE.hostname, action: 'questionnaire' },
					)
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
		turnstileToken: 'valid-token',
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
	turnstileToken: 'valid-token',
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
			assert.equal(result.h.calls.turnstile, 0)
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
			assert.equal(result.h.calls.turnstile, 0)
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
			assert.equal(result.h.calls.turnstile, 0)
			assert.equal(result.h.calls.resend, 0)
		})
	}
})

test('a conditional answer is accepted when its condition is true', async () => {
	const result = await post(request())
	assert.equal(result.response.status, 200)
	assert.equal(result.h.calls.turnstile, 1)
	assert.equal(result.h.calls.resend, 1)
})

test('honeypot and Turnstile failures never call Resend', async (t) => {
	await t.test('filled honeypot', async () => {
		const result = await post(request(bodyWith({ _gotcha: 'bot' })))
		assert.equal(result.response.status, 400)
		assert.equal(result.h.calls.turnstile, 0)
		assert.equal(result.h.calls.resend, 0)
	})

	await t.test('missing Turnstile token', async () => {
		const result = await post(request(bodyWith({ turnstileToken: '' })))
		assert.equal(result.response.status, 422)
		assert.equal(result.h.calls.turnstile, 0)
		assert.equal(result.h.calls.resend, 0)
	})

	await t.test('invalid Turnstile token', async () => {
		const result = await post(request(), harness({ turnstile: 'fail' }))
		assert.equal(result.response.status, 422)
		assert.equal(result.h.calls.turnstile, 1)
		assert.equal(result.h.calls.resend, 0)
	})

	await t.test('Turnstile verification outage', async () => {
		const result = await post(request(), harness({ turnstile: 'throw' }))
		assert.equal(result.response.status, 503)
		assert.equal(result.h.calls.turnstile, 1)
		assert.equal(result.h.calls.resend, 0)
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
