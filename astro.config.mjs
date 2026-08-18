// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
	// Required for the sitemap, canonical URLs, and absolute og:image hrefs.
	site: 'https://wellworncreative.com',

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
		sitemap({
			filter: (page) => !page.includes('/projects/'),
		}),
	],

	// Prefetch links on hover/viewport. Zero dependencies, static-friendly.
	prefetch: true,

	vite: {
		plugins: [tailwindcss()],
	},

	// Fonts are NOT configured here. They come from the Fontsource packages
	// imported in src/layouts/BaseLayout.astro, which ship the woff2 files in
	// node_modules — nothing is fetched from a remote host at dev startup or
	// build time. See src/styles/global.css for the family tokens.
});
