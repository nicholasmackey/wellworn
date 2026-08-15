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
	integrations: [sitemap()],

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
