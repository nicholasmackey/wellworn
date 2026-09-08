// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

const isGitHubPages = process.env.GITHUB_PAGES === 'true';

/*
 * GitHub Pages can only serve prerendered files. The production site keeps
 * /api/questionnaire as an on-demand Cloudflare Worker route, while the Pages
 * build prerenders that route into a harmless static response so every route
 * can be emitted into a flat dist/ directory.
 */
/** @type {import('astro').AstroIntegration} */
const githubPagesStaticRoutes = {
	name: 'wellworn-github-pages-static-routes',
	hooks: {
		'astro:route:setup': ({ route }) => {
			if (route.component.replaceAll('\\', '/').endsWith('src/pages/api/questionnaire.ts')) {
				route.prerender = true;
			}
		},
	},
};

// https://astro.build/config
export default defineConfig({
	// Required for the sitemap, canonical URLs, and absolute og:image hrefs.
	// The preview values combine to https://nicholasmackey.github.io/wellworn/.
	site: isGitHubPages ? 'https://nicholasmackey.github.io' : 'https://wellworncreative.com',
	base: isGitHubPages ? '/wellworn' : '/',

	// Emits /sitemap-index.xml plus the /sitemap-0.xml it points at. Status-code
	// pages (404, 500) are excluded by the integration. public/robots.txt
	// advertises the index to crawlers.
	//
	// Everything under /projects/ is a private client portal reached by a link
	// we send, not a public page: unlisted, absent from the nav and from the
	// work section, and carrying `noindex` in its own head. Listing one in the
	// sitemap would hand crawlers the URL and undo all of that. `page` is the
	// full absolute URL, not a path.
	integrations: [
		...(isGitHubPages ? [githubPagesStaticRoutes] : []),
		sitemap({
			filter: (page) => !page.includes('/projects/'),
		}),
	],

	// Prefetch links on hover/viewport. Zero dependencies, static-friendly.
	prefetch: true,

	/*
	 * `output` stays at its default of 'static'. With an adapter present that
	 * does NOT make the site server-rendered: every page is still prerendered
	 * to a file at build time, and a route becomes a worker route only by
	 * saying so itself with `export const prerender = false`.
	 *
	 * Exactly one route does — src/pages/api/questionnaire.ts. Everything else
	 * on this site, the client portals and the questionnaire page included, is
	 * a static file on the CDN exactly as it was before the adapter arrived.
	 * The adapter emits dist/client + dist/server. Cloudflare's ASSETS binding
	 * serves matching static files before falling back to the Worker, as pinned
	 * by `assets.run_worker_first: false` in wrangler.jsonc. There is no
	 * `_routes.json` in this Workers + Static Assets architecture.
	 */
	/*
	 * No sessions. The adapter turns them on by default and expects a KV
	 * binding called SESSION to exist to hold them — storage this project was
	 * asked not to add, for a feature nothing here uses. Saying so explicitly
	 * both silences the build note and means a future `Astro.session` call
	 * fails loudly at build rather than quietly at the edge against a binding
	 * nobody created.
	 */
	session: false,

	adapter: isGitHubPages ? undefined : cloudflare({
		/*
		 * Images are transformed by sharp at BUILD time and passed through
		 * untouched at runtime — which is what already happened before the
		 * adapter, since every page carrying an image is prerendered.
		 *
		 * Set explicitly because the adapter's default is 'cloudflare-binding',
		 * which would hand image delivery to Cloudflare Images and change both
		 * the URLs and the billing for something that currently costs nothing.
		 * There is no image on the one route that runs on the server.
		 */
		imageService: 'compile',
	}),

	vite: {
		plugins: [tailwindcss()],
	},

	// Fonts are NOT configured here. They come from the Fontsource packages
	// imported in src/layouts/BaseLayout.astro, which ship the woff2 files in
	// node_modules — nothing is fetched from a remote host at dev startup or
	// build time. See src/styles/global.css for the family tokens.
});
