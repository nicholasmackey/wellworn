/** Environment-aware configuration for the public Cloudflare Turnstile key. */

/** Cloudflare's official always-pass visible widget key, for local development only. */
export const TURNSTILE_DEVELOPMENT_SITE_KEY = '1x00000000000000000000AA'

/** Every dummy site key currently published by Cloudflare. */
const TURNSTILE_TEST_SITE_KEYS = new Set([
	TURNSTILE_DEVELOPMENT_SITE_KEY,
	'2x00000000000000000000AB',
	'1x00000000000000000000BB',
	'2x00000000000000000000BB',
	'3x00000000000000000000FF',
])

export function isTurnstileTestSiteKey(siteKey: string): boolean {
	return TURNSTILE_TEST_SITE_KEYS.has(siteKey.trim())
}

/**
 * Development is usable out of the box with Cloudflare's test widget. A
 * production build must provide a non-test key: throwing here stops Astro
 * while it prerenders the questionnaire, before deployable output is made.
 */
export function resolveTurnstileSiteKey(options: {
	readonly configuredSiteKey?: string
	readonly production: boolean
}): string {
	const configuredSiteKey = options.configuredSiteKey?.trim() ?? ''

	if (!options.production) {
		return configuredSiteKey || TURNSTILE_DEVELOPMENT_SITE_KEY
	}

	if (!configuredSiteKey) {
		throw new Error(
			'[wellworn] PUBLIC_TURNSTILE_SITE_KEY is required for production. Configure the real Cloudflare Turnstile site key before building.',
		)
	}

	if (isTurnstileTestSiteKey(configuredSiteKey)) {
		throw new Error(
			'[wellworn] PUBLIC_TURNSTILE_SITE_KEY is a Cloudflare test key. Production requires the real Turnstile site key.',
		)
	}

	return configuredSiteKey
}
