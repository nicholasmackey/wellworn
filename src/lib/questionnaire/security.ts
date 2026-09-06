/** Cloudflare Turnstile server-side validation. */
import { TURNSTILE_ACTION } from './config'

const SITEVERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const TOKEN_MAX_LENGTH = 2048
const REQUEST_TIMEOUT_MS = 10_000

/** Published by Cloudflare for development; never accepted by the production path. */
export const TURNSTILE_DEVELOPMENT_SECRET_KEY = '1x0000000000000000000000000000000AA'

const TURNSTILE_TEST_SECRET_KEYS = new Set([
	TURNSTILE_DEVELOPMENT_SECRET_KEY,
	'2x0000000000000000000000000000000AA',
	'3x0000000000000000000000000000000AA',
])

interface SiteverifyResponse {
	readonly success?: unknown
	readonly hostname?: unknown
	readonly action?: unknown
	readonly metadata?: unknown
}

export type TurnstileResult =
	| { readonly ok: true }
	| { readonly ok: false; readonly kind: 'invalid' | 'unavailable' }

export async function verifyTurnstile(options: {
	readonly token: string
	readonly secret: string
	readonly hostname: string
	readonly remoteIp?: string
	readonly fetcher?: typeof fetch
	readonly allowTestResponse?: boolean
}): Promise<TurnstileResult> {
	const { token, secret, hostname, remoteIp, fetcher = fetch, allowTestResponse = false } = options
	if (!token || token.length > TOKEN_MAX_LENGTH || !secret) {
		return { ok: false, kind: 'invalid' }
	}

	let response: Response
	try {
		response = await fetcher(SITEVERIFY_ENDPOINT, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				secret,
				response: token,
				...(remoteIp ? { remoteip: remoteIp } : {}),
			}),
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		})
	} catch {
		return { ok: false, kind: 'unavailable' }
	}

	if (!response.ok) return { ok: false, kind: 'unavailable' }

	let result: SiteverifyResponse
	try {
		result = (await response.json()) as SiteverifyResponse
	} catch {
		return { ok: false, kind: 'unavailable' }
	}

	if (result.success !== true) {
		return { ok: false, kind: 'invalid' }
	}

	/* Cloudflare's dummy response deliberately does not carry the requesting
	   hostname or action. Accept that documented shape only in development,
	   only with one of Cloudflare's published test secrets, and only when
	   Siteverify marks the response as having come from a testing key. */
	const metadata =
		typeof result.metadata === 'object' && result.metadata !== null
			? (result.metadata as Record<string, unknown>)
			: null
	const isVerifiedTestResponse =
		allowTestResponse &&
		TURNSTILE_TEST_SECRET_KEYS.has(secret) &&
		metadata?.result_with_testing_key === true
	if (isVerifiedTestResponse) return { ok: true }

	if (result.hostname !== hostname || result.action !== TURNSTILE_ACTION) {
		return { ok: false, kind: 'invalid' }
	}

	return { ok: true }
}
