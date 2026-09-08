/**
 * Prefix a root-relative URL with Astro's configured deployment base.
 *
 * Production is served from `/`, while the GitHub Pages preview is served
 * from `/wellworn/`. Imported assets are rewritten by Astro automatically;
 * URLs for files in public/ and hand-authored internal links are not, so they
 * pass through this helper instead.
 */
const deploymentBase = (import.meta.env?.BASE_URL ?? '/').replace(/\/$/, '')

export function withBase(path: string): string {
	if (!path.startsWith('/') || path.startsWith('//') || deploymentBase.length === 0) {
		return path
	}

	if (path === deploymentBase || path.startsWith(`${deploymentBase}/`)) {
		return path
	}

	return path === '/' ? `${deploymentBase}/` : `${deploymentBase}${path}`
}

/** The complete public URL for the current deployment, without a trailing slash. */
export const DEPLOYMENT_URL = new URL(
	withBase('/'),
	import.meta.env?.SITE ?? 'https://wellworncreative.com',
).href.replace(/\/$/, '')
