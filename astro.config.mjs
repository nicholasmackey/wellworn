// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
	site: 'https://wellworncreative.com',

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
