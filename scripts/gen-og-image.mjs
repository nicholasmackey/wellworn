/**
 * Generates public/og-image.jpg, the default Open Graph share card.
 *
 * SUPERSEDED: public/og-image.jpg is now supplied artwork — a cream wordmark
 * over terracotta — and this script does not reproduce it. Running it will
 * overwrite that file with the earlier cream-background card below. Kept only
 * as a record of how that card was built.
 *
 * The card is the supplied wordmark over cream with a tagline beneath it, so
 * it has to be rebuilt whenever that tagline changes. It is composed as HTML
 * and rendered by headless Chrome rather than by sharp: the tagline is set in
 * Montserrat, and Chrome will load the woff2 from node_modules, while sharp's
 * SVG text rendering depends on whatever fonts the host happens to have.
 *
 * The wordmark SVG is inlined verbatim from the supplied artwork, which stays
 * the source of truth. Nothing here edits it.
 *
 * Run from the repo root:  node scripts/gen-og-image.mjs
 * Override the browser with CHROME=/path/to/chrome if it is not in the
 * default macOS location.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const WORDMARK = 'public/wellworn-wordmark-dark.svg'
const FONT = 'node_modules/@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2'
const OUT = 'public/og-image.jpg'

/** Open Graph large-card standard. Must match SITE.ogImageWidth/Height. */
const WIDTH = 1200
const HEIGHT = 630

const CREAM = '#F3F0E8'
const CHARCOAL = '#1F211F'

/**
 * Tagline under the mark. Keep it in step with SITE.ogImageAlt, which is what
 * screen readers get instead of this image.
 */
const TAGLINE = 'Design · Development'

/* -------------------------------------------------------------------------
   Geometry, measured off the card this replaces so only the words change.
   The SVG canvas is 2476x597 but the drawn frame sits inside it, which is why
   the mark is wider than the frame it renders.
   ------------------------------------------------------------------------- */
const MARK_WIDTH = 915
const MARK_TOP = 177
const TAGLINE_TOP = 432
const TAGLINE_SIZE = 26
/** Matches --tracking-label, the brand's wide setting for small caps. */
const TAGLINE_TRACKING = '0.14em'

const wordmark = readFileSync(WORDMARK, 'utf8').trim()
const font = readFileSync(FONT).toString('base64')

const html = `<!doctype html>
<meta charset="utf-8">
<style>
	@font-face {
		font-family: 'Montserrat Card';
		src: url(data:font/woff2;base64,${font}) format('woff2-variations');
		font-weight: 100 900;
		font-display: block;
	}
	html, body { margin: 0; padding: 0; }
	body {
		width: ${WIDTH}px;
		height: ${HEIGHT}px;
		position: relative;
		background: ${CREAM};
		overflow: hidden;
	}
	.mark {
		position: absolute;
		left: 50%;
		top: ${MARK_TOP}px;
		width: ${MARK_WIDTH}px;
		transform: translateX(-50%);
	}
	.mark svg { display: block; width: 100%; height: auto; }
	.tagline {
		position: absolute;
		left: 0;
		right: 0;
		top: ${TAGLINE_TOP}px;
		font-family: 'Montserrat Card';
		font-size: ${TAGLINE_SIZE}px;
		line-height: ${TAGLINE_SIZE}px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: ${TAGLINE_TRACKING};
		color: ${CHARCOAL};
		text-align: center;
		/* Letter-spacing trails the last glyph, which drags centred text a
		   half-step left. Push it back by the same amount. */
		text-indent: ${TAGLINE_TRACKING};
	}
</style>
<div class="mark">${wordmark}</div>
<div class="tagline">${TAGLINE}</div>
`

/* -------------------------------------------------------------------------
   Render
   ------------------------------------------------------------------------- */

const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const workdir = mkdtempSync(join(tmpdir(), 'wellworn-og-'))
const pagePath = join(workdir, 'card.html')
writeFileSync(pagePath, html)

const PORT = 9333
const browser = spawn(chrome, [
	'--headless=new',
	'--disable-gpu',
	'--hide-scrollbars',
	`--remote-debugging-port=${PORT}`,
	`--user-data-dir=${join(workdir, 'profile')}`,
	'about:blank',
])

const send = (ws, pending, method, params = {}) =>
	new Promise((resolve, reject) => {
		const id = pending.nextId++
		pending.set(id, { resolve, reject })
		ws.send(JSON.stringify({ id, method, params }))
	})

try {
	/* The debugging port is not up the instant the process is. */
	let targets
	for (let attempt = 0; ; attempt++) {
		try {
			targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
			break
		} catch (error) {
			if (attempt === 40) throw error
			await new Promise((r) => setTimeout(r, 250))
		}
	}

	const page = targets.find((t) => t.type === 'page')
	const ws = new WebSocket(page.webSocketDebuggerUrl)
	await new Promise((resolve, reject) => {
		ws.addEventListener('open', resolve)
		ws.addEventListener('error', reject)
	})

	const pending = new Map()
	pending.nextId = 1
	const events = new Map()
	ws.addEventListener('message', (event) => {
		const msg = JSON.parse(event.data)
		if (msg.id && pending.has(msg.id)) {
			const { resolve, reject } = pending.get(msg.id)
			pending.delete(msg.id)
			msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
		} else if (msg.method && events.has(msg.method)) {
			events.get(msg.method)()
			events.delete(msg.method)
		}
	})

	await send(ws, pending, 'Page.enable')
	await send(ws, pending, 'Emulation.setDeviceMetricsOverride', {
		width: WIDTH,
		height: HEIGHT,
		deviceScaleFactor: 1,
		mobile: false,
	})

	const loaded = new Promise((resolve) => events.set('Page.loadEventFired', resolve))
	await send(ws, pending, 'Page.navigate', { url: `file://${pagePath}` })
	await loaded
	/* font-display: block means an unfinished font paints nothing at all, so
	   waiting on document.fonts is what keeps the tagline out of the card. */
	await send(ws, pending, 'Runtime.evaluate', {
		expression: 'document.fonts.ready',
		awaitPromise: true,
	})

	const { data } = await send(ws, pending, 'Page.captureScreenshot', {
		format: 'jpeg',
		quality: 92,
		clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT, scale: 1 },
	})
	writeFileSync(OUT, Buffer.from(data, 'base64'))
	ws.close()
	console.log(`wrote ${OUT} — ${WIDTH}x${HEIGHT}, tagline "${TAGLINE.toUpperCase()}"`)
} finally {
	/* kill() only signals. Removing the profile while Chrome is still writing
	   to it fails with ENOTEMPTY, so wait for the process to actually go. */
	browser.kill()
	await new Promise((resolve) => browser.once('exit', resolve))
	try {
		rmSync(workdir, { recursive: true, force: true })
	} catch {
		/* A leftover temp directory is not worth failing a finished render. */
	}
}
