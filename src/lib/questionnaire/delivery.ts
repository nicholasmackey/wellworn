/** Direct, dependency-free delivery through Resend's HTTP API. */
import type { Submission } from './submission'
import { renderSubmission } from './renderers'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const REQUEST_TIMEOUT_MS = 12_000

export interface DeliveryConfig {
	readonly apiKey: string
	readonly to: string
	readonly from: string
}

export interface ResendAttachment {
	readonly filename: string
	readonly content: string
}

export interface ResendPayload {
	readonly from: string
	readonly to: readonly string[]
	readonly subject: string
	readonly html: string
	readonly text: string
	readonly attachments: readonly ResendAttachment[]
}

export type DeliveryResult =
	| { readonly ok: true; readonly id: string }
	| { readonly ok: false; readonly kind: 'configuration' | 'request' | 'response'; readonly status?: number }

/** Headers are configuration/definition only, never answers; still reject CRLF. */
const safeHeader = (value: string): string => value.replace(/[\r\n]+/g, ' ').trim()

/** Base64 encode UTF-8 in APIs shared by Workers and modern browsers/Node. */
export function base64Utf8(value: string): string {
	const bytes = new TextEncoder().encode(value)
	let binary = ''
	const chunkSize = 0x8000

	for (let index = 0; index < bytes.length; index += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
	}

	return btoa(binary)
}

export function createResendPayload(
	submission: Submission,
	config: Pick<DeliveryConfig, 'to' | 'from'>,
): ResendPayload {
	const rendered = renderSubmission(submission)

	return {
		from: safeHeader(config.from),
		to: [safeHeader(config.to)],
		subject: `${safeHeader(submission.meta.client)}: ${safeHeader(submission.meta.title)}`,
		html: rendered.html,
		text: rendered.text,
		attachments: [
			{ filename: 'submission.json', content: base64Utf8(rendered.json) },
			{ filename: 'submission.md', content: base64Utf8(rendered.markdown) },
		],
	}
}

function validConfig(config: DeliveryConfig): boolean {
	return Boolean(config.apiKey.trim() && safeHeader(config.to) && safeHeader(config.from))
}

export async function deliverSubmission(
	submission: Submission,
	config: DeliveryConfig,
	options: {
		readonly fetcher?: typeof fetch
		readonly idempotencyKey?: string
	} = {},
): Promise<DeliveryResult> {
	if (!validConfig(config)) return { ok: false, kind: 'configuration' }

	const fetcher = options.fetcher ?? fetch
	let response: Response

	try {
		response = await fetcher(RESEND_ENDPOINT, {
			method: 'POST',
			headers: {
				authorization: `Bearer ${config.apiKey}`,
				'content-type': 'application/json',
				'idempotency-key': options.idempotencyKey ?? crypto.randomUUID(),
			},
			body: JSON.stringify(createResendPayload(submission, config)),
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		})
	} catch {
		return { ok: false, kind: 'request' }
	}

	let body: unknown
	try {
		body = await response.json()
	} catch {
		return { ok: false, kind: 'response', status: response.status }
	}

	if (!response.ok) return { ok: false, kind: 'response', status: response.status }
	if (!body || typeof body !== 'object' || typeof (body as { id?: unknown }).id !== 'string') {
		return { ok: false, kind: 'response', status: response.status }
	}

	return { ok: true, id: (body as { id: string }).id }
}
