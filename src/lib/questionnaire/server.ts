/**
 * The questionnaire request pipeline, kept independent of Astro's virtual
 * modules so every refusal and delivery boundary can be exercised directly.
 */
import { validateAnswers } from './answers'
import { HONEYPOT_FIELD } from './config'
import { deliverSubmission } from './delivery'
import { SCHEMA_VERSION, type Questionnaire } from './schema'
import { verifyTurnstile } from './security'
import { normalizeSubmission } from './submission'
import type { AnswerBag } from './visibility'

/** About three times Avioric's maximum honest payload. */
export const MAX_BODY_BYTES = 128 * 1024

const BASE_HEADERS = {
	'content-type': 'application/json; charset=utf-8',
	'cache-control': 'no-store',
} as const

interface Failure {
	readonly error: string
	readonly issues?: readonly { readonly questionId: string | null; readonly message: string }[]
}

const fail = (status: number, body: Failure, extra: Record<string, string> = {}): Response =>
	new Response(JSON.stringify({ ok: false, ...body }), {
		status,
		headers: { ...BASE_HEADERS, ...extra },
	})

const succeed = (): Response =>
	new Response(JSON.stringify({ ok: true }), { status: 200, headers: BASE_HEADERS })

export const methodNotAllowed = (): Response =>
	fail(405, { error: 'Use POST.' }, { allow: 'POST' })

export interface QuestionnaireRequestContext {
	readonly request: Request
	readonly url: URL
	readonly site?: URL
}

export interface QuestionnaireServerDependencies {
	readonly loadQuestionnaire: (token: string, id: string) => Promise<Questionnaire | null>
	readonly getSecret: (name: string) => string | undefined
	/** Enabled only by the local Astro endpoint; production remains strict. */
	readonly allowTurnstileTestResponse?: boolean
	readonly fetcher?: typeof fetch
	readonly now?: () => Date
	readonly logger?: Pick<Console, 'log' | 'warn' | 'error'>
}

function originAllowed({ request, url, site }: QuestionnaireRequestContext): boolean {
	const origin = request.headers.get('origin')
	if (!origin) return false

	const allowed = new Set([url.origin])
	if (site) allowed.add(site.origin)

	return allowed.has(origin)
}

interface Envelope {
	readonly questionnaireId: string
	readonly version: number
	readonly schemaVersion: number
	readonly token: string
	readonly answers: AnswerBag
	readonly honeypot: string
	readonly turnstileToken: string
}

/** Shape-check the envelope before anything touches a questionnaire. */
function readEnvelope(body: unknown): Envelope | null {
	if (typeof body !== 'object' || body === null || Array.isArray(body)) return null

	const value = body as Record<string, unknown>
	if (typeof value.questionnaireId !== 'string') return null
	if (typeof value.token !== 'string') return null
	if (!Number.isSafeInteger(value.version)) return null
	if (!Number.isSafeInteger(value.schemaVersion)) return null
	if (typeof value.answers !== 'object' || value.answers === null || Array.isArray(value.answers)) {
		return null
	}

	const honeypot = value[HONEYPOT_FIELD]
	if (honeypot !== undefined && typeof honeypot !== 'string') return null

	const turnstileToken = value.turnstileToken
	if (turnstileToken !== undefined && typeof turnstileToken !== 'string') return null

	return {
		questionnaireId: value.questionnaireId,
		token: value.token,
		version: value.version as number,
		schemaVersion: value.schemaVersion as number,
		answers: value.answers as AnswerBag,
		honeypot: honeypot ?? '',
		turnstileToken: turnstileToken ?? '',
	}
}

export async function handleQuestionnairePost(
	context: QuestionnaireRequestContext,
	dependencies: QuestionnaireServerDependencies,
): Promise<Response> {
	const { request } = context
	const logger = dependencies.logger ?? console
	const fetcher = dependencies.fetcher ?? fetch

	if (!originAllowed(context)) {
		return fail(403, { error: 'This form can only be submitted from the Wellworn site.' })
	}

	const contentType = request.headers.get('content-type') ?? ''
	if (!contentType.toLowerCase().startsWith('application/json')) {
		return fail(415, { error: 'Send JSON.' })
	}

	const declared = Number(request.headers.get('content-length'))
	if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
		return fail(413, { error: 'That submission is too large.' })
	}

	let text: string
	try {
		text = await request.text()
	} catch {
		return fail(400, { error: 'Could not read that request.' })
	}

	if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
		return fail(413, { error: 'That submission is too large.' })
	}

	let body: unknown
	try {
		body = JSON.parse(text)
	} catch {
		return fail(400, { error: 'That request was not valid JSON.' })
	}

	const envelope = readEnvelope(body)
	if (!envelope) {
		return fail(400, { error: 'That submission was not in the expected format.' })
	}

	/* Do not teach automated fillers which field caught them, and never imply
	   that an email was delivered when it was not. */
	if (envelope.honeypot.trim()) {
		return fail(400, { error: 'We could not submit that form. Refresh the page and try again.' })
	}

	if (envelope.schemaVersion !== SCHEMA_VERSION) {
		return fail(409, {
			error: 'This questionnaire has been rebuilt since you opened it. Reload the page and send again.',
		})
	}

	const questionnaire = await dependencies.loadQuestionnaire(
		envelope.token,
		envelope.questionnaireId,
	)
	if (!questionnaire) {
		return fail(404, { error: 'We could not find that questionnaire.' })
	}

	if (questionnaire.version !== envelope.version) {
		return fail(409, {
			error: 'This questionnaire has been updated since you opened it. Reload the page and send again.',
		})
	}

	const result = validateAnswers(questionnaire, envelope.answers)
	if (!result.ok) {
		return fail(422, {
			error: 'Some answers still need attention.',
			issues: result.errors,
		})
	}

	const submission = normalizeSubmission(questionnaire, result.answers, {
		visible: result.visible,
		submittedAt: dependencies.now?.() ?? new Date(),
	})

	const turnstileSecret = dependencies.getSecret('TURNSTILE_SECRET_KEY') ?? ''
	if (!turnstileSecret) {
		logger.error('[questionnaire] TURNSTILE_SECRET_KEY is not configured.')
		return fail(503, { error: 'This form is temporarily unavailable. Your answers are still saved.' })
	}

	const turnstile = await verifyTurnstile({
		token: envelope.turnstileToken,
		secret: turnstileSecret,
		hostname: context.url.hostname,
		remoteIp: request.headers.get('cf-connecting-ip') ?? undefined,
		fetcher,
		allowTestResponse: dependencies.allowTurnstileTestResponse,
	})
	if (!turnstile.ok) {
		logger.warn(`[questionnaire] Turnstile verification ${turnstile.kind}.`)
		return fail(turnstile.kind === 'unavailable' ? 503 : 422, {
			error:
				turnstile.kind === 'unavailable'
					? 'We could not run the security check. Your answers are still saved; please try again.'
					: 'Complete the security check and try again.',
		})
	}

	const delivery = await deliverSubmission(
		submission,
		{
			apiKey: dependencies.getSecret('RESEND_API_KEY') ?? '',
			to: dependencies.getSecret('SUBMISSION_TO') ?? '',
			from: dependencies.getSecret('RESEND_FROM') ?? '',
		},
		{ fetcher },
	)

	if (!delivery.ok) {
		const status = delivery.status ? `, status ${delivery.status}` : ''
		logger.error(`[questionnaire] Resend delivery failed (${delivery.kind}${status}).`)
		return fail(delivery.kind === 'configuration' ? 503 : 502, {
			error: 'We could not deliver your questionnaire. Your answers are still saved; please try again.',
		})
	}

	logger.log(
		`[questionnaire] ${submission.meta.questionnaireId} v${submission.meta.version} delivered — ` +
			`${submission.counts.answered}/${submission.counts.asked} answered`,
	)

	return succeed()
}
