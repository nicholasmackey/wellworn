import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PAGE =
	'http://localhost:4321/projects/5a468912-b9f9-45f1-babc-c5774180b72b/questionnaire/'
const DEBUG_PORT = 9400 + (process.pid % 400)
const PROFILE = mkdtempSync(join(tmpdir(), 'wellworn-chrome-'))
const SCREENSHOT = join(tmpdir(), 'wellworn-questionnaire-mobile.png')
const DRAFT_KEY = 'wellworn:q:avioric-website:v3'
const RECEIPT_KEY = 'wellworn:q:avioric-website:submitted'
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

class DevTools {
	#socket
	#nextId = 1
	#pending = new Map()

	constructor(url) {
		this.#socket = new WebSocket(url)
		this.#socket.onmessage = ({ data }) => {
			const message = JSON.parse(String(data))
			if (!message.id) return
			const pending = this.#pending.get(message.id)
			if (!pending) return
			this.#pending.delete(message.id)
			if (message.error) pending.reject(new Error(message.error.message))
			else pending.resolve(message.result)
		}
	}

	async ready() {
		if (this.#socket.readyState === WebSocket.OPEN) return
		await new Promise((resolve, reject) => {
			this.#socket.onopen = resolve
			this.#socket.onerror = reject
		})
	}

	command(method, params = {}) {
		const id = this.#nextId++
		return new Promise((resolve, reject) => {
			this.#pending.set(id, { resolve, reject })
			this.#socket.send(JSON.stringify({ id, method, params }))
		})
	}

	async evaluate(expression) {
		const response = await this.command('Runtime.evaluate', {
			expression,
			awaitPromise: true,
			returnByValue: true,
		})
		if (response.exceptionDetails) {
			throw new Error(response.exceptionDetails.exception?.description ?? 'Browser evaluation failed')
		}
		return response.result.value
	}

	close() {
		this.#socket.close()
	}
}

async function waitForBrowser() {
	for (let attempt = 0; attempt < 80; attempt++) {
		try {
			const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)
			if (response.ok) return
		} catch {
			// Chrome is still starting.
		}
		await sleep(100)
	}
	throw new Error('Chrome DevTools did not start')
}

async function waitFor(devtools, expression, timeout = 10_000) {
	const started = Date.now()
	while (Date.now() - started < timeout) {
		try {
			if (await devtools.evaluate(expression)) return
		} catch {
			// A navigation may have replaced the execution context.
		}
		await sleep(100)
	}
	throw new Error(`Timed out waiting for: ${expression}`)
}

const chrome = spawn(
	CHROME,
	[
		'--headless=new',
		'--disable-gpu',
		'--no-first-run',
		'--no-default-browser-check',
		`--remote-debugging-port=${DEBUG_PORT}`,
		`--user-data-dir=${PROFILE}`,
		'about:blank',
	],
	{ stdio: 'ignore' },
)

let devtools
try {
	await waitForBrowser()
	const targetResponse = await fetch(
		`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(PAGE)}`,
		{ method: 'PUT' },
	)
	const target = await targetResponse.json()
	devtools = new DevTools(target.webSocketDebuggerUrl)
	await devtools.ready()
	await devtools.command('Page.enable')
	await devtools.command('Runtime.enable')
	await waitFor(
		devtools,
		`document.readyState === 'complete' && document.querySelector('[data-questionnaire]') && !document.querySelector('button[type="submit"]').disabled`,
	)

	const loaded = await devtools.evaluate(`(() => ({
		sections: document.querySelectorAll('[data-questionnaire] > section').length,
		questions: document.querySelectorAll('[data-question]').length,
		answerable: document.querySelectorAll('[data-question]:not([data-question-type="info"])').length,
		business: document.querySelector('#q-business-name').value,
		email: document.querySelector('#q-public-email').value,
		turnstileWidgets: document.querySelectorAll('.cf-turnstile, [data-turnstile-widget]').length,
		turnstileScripts: [...document.querySelectorAll('script[src]')]
			.filter((element) => element.src.includes('challenges.cloudflare.com')).length,
		turnstileGlobal: typeof window.turnstile,
		tokenFields: document.querySelectorAll('[name="cf-turnstile-response"]').length,
		honeypot: document.querySelector('[name="_gotcha"]')?.value,
		honeypotHidden: !document.querySelector('[name="_gotcha"]')?.getClientRects().length,
		securitySectionHeading: [...document.querySelectorAll('[data-questionnaire] .ww-eyebrow')]
			.some((element) => element.textContent.trim().toLowerCase() === 'security check')
	}))()`)
	assert.equal(loaded.sections, 8)
	assert.equal(loaded.answerable, 43)
	assert.equal(loaded.business, 'Avioric')
	assert.equal(loaded.email, 'hello@avioric.com')
	/* No widget, no loader script, no global, no token field: the page must
	   carry nothing of Turnstile at all. */
	assert.equal(loaded.turnstileWidgets, 0)
	assert.equal(loaded.turnstileScripts, 0)
	assert.equal(loaded.turnstileGlobal, 'undefined')
	assert.equal(loaded.tokenFields, 0)
	assert.equal(loaded.securitySectionHeading, false)
	/* The honeypot is still there, still empty, and still invisible. */
	assert.equal(loaded.honeypot, '')
	assert.equal(loaded.honeypotHidden, true)

	const visibility = await devtools.evaluate(`(() => {
		const detail = document.querySelector('#question-location-detail')
		const control = document.querySelector('#q-location-detail')
		const initial = [detail.hidden, control.disabled]
		const show = document.querySelector('#q-location-visibility-city-and-state')
		show.checked = true
		show.dispatchEvent(new Event('change', { bubbles: true }))
		const shown = [detail.hidden, control.disabled]
		control.value = 'Austin, Texas'
		control.dispatchEvent(new Event('input', { bubbles: true }))
		const hide = document.querySelector('#q-location-visibility-none')
		hide.checked = true
		hide.dispatchEvent(new Event('change', { bubbles: true }))
		return { initial, shown, hidden: [detail.hidden, control.disabled], retained: control.value }
	})()`)
	assert.deepEqual(visibility.initial, [true, true])
	assert.deepEqual(visibility.shown, [false, false])
	assert.deepEqual(visibility.hidden, [true, true])
	assert.equal(visibility.retained, 'Austin, Texas')

	await devtools.evaluate(`(() => {
		const input = document.querySelector('#q-years-in-business')
		input.value = '12'
		input.dispatchEvent(new Event('input', { bubbles: true }))
	})()`)
	await sleep(650)
	assert.equal(
		await devtools.evaluate(
			`JSON.parse(localStorage.getItem('${DRAFT_KEY}')).answers['years-in-business']`,
		),
		12,
	)

	/* Stamp the document that is about to go, and wait for one without the
	   stamp. Waiting on the restored value alone is a race the old page wins:
	   it also has '12' in that field, so the condition is already true while
	   the reload is still in flight, and the assertions below then run against
	   a document that has not been parsed yet. */
	await devtools.evaluate(`window.__beforeReload = true`)
	await devtools.command('Page.reload', { ignoreCache: true })
	await waitFor(
		devtools,
		`!window.__beforeReload && document.readyState === 'complete' && document.querySelector('#q-years-in-business')?.value === '12'`,
	)
	const restored = await devtools.evaluate(`(() => ({
		notice: !document.querySelector('#questionnaire-restored').hidden,
		message: document.querySelector('[data-restore-message]').textContent,
		value: document.querySelector('#q-years-in-business').value
	}))()`)
	assert.equal(restored.notice, true)
	assert.match(restored.message, /Everything is still editable/)
	assert.equal(restored.value, '12')

	await devtools.evaluate(`document.querySelector('[data-start-fresh]').click()`)
	await waitFor(devtools, `document.querySelector('#questionnaire-start-fresh').open`)
	await devtools.evaluate(
		`document.querySelector('#questionnaire-start-fresh button[value="cancel"]').click()`,
	)
	await waitFor(devtools, `!document.querySelector('#questionnaire-start-fresh').open`)
	assert.equal(await devtools.evaluate(`document.querySelector('#q-years-in-business').value`), '12')
	assert.equal(await devtools.evaluate(`localStorage.getItem('${DRAFT_KEY}') !== null`), true)

	await devtools.evaluate(`document.querySelector('[data-start-fresh]').click()`)
	await waitFor(devtools, `document.querySelector('#questionnaire-start-fresh').open`)
	await devtools.evaluate(
		`document.querySelector('#questionnaire-start-fresh button[value="confirm"]').click()`,
	)
	await waitFor(
		devtools,
		`document.readyState === 'complete' && document.querySelector('#q-years-in-business')?.value === '' && localStorage.getItem('${DRAFT_KEY}') === null`,
	)

	await devtools.command('Emulation.setEmulatedMedia', {
		features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
	})
	await devtools.evaluate(`(() => {
		window.__scrollBehavior = null
		Element.prototype.scrollIntoView = function(options) { window.__scrollBehavior = options?.behavior }
		document.querySelector('[data-questionnaire]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	})()`)
	const validation = await devtools.evaluate(`(() => ({
		visible: !document.querySelector('#questionnaire-errors').hidden,
		heading: document.querySelector('[data-error-heading]').textContent,
		focused: document.activeElement.id,
		behavior: window.__scrollBehavior
	}))()`)
	assert.equal(validation.visible, true)
	assert.match(validation.heading, /4 questions need your attention/)
	assert.equal(validation.focused, 'questionnaire-errors')
	assert.equal(validation.behavior, 'auto')
	await devtools.command('Emulation.setEmulatedMedia', { features: [] })

	await devtools.evaluate(`(() => {
		for (const selector of [
			'#q-pricing-current-all-current',
			'#q-story-accurate-accurate',
			'#q-primary-cta-request-quote',
			'#q-use-as-basis'
		]) {
			const control = document.querySelector(selector)
			control.checked = true
			control.dispatchEvent(new Event('change', { bubbles: true }))
		}
		const notes = document.querySelector('#q-final-notes')
		notes.value = 'Browser preservation test'
		notes.dispatchEvent(new Event('input', { bubbles: true }))
	})()`)
	await sleep(650)

	await devtools.evaluate(`window.fetch = async () => new Response(JSON.stringify({
		ok: false,
		error: 'Some answers still need attention.',
		issues: [{ questionId: 'business-name', message: 'Server validation test.' }]
	}), { status: 422, headers: { 'content-type': 'application/json' } })`)
	await devtools.evaluate(
		`document.querySelector('[data-questionnaire]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))`,
	)
	await waitFor(devtools, `document.querySelector('button[type="submit"]').textContent !== 'Sending…'`)
	const serverValidation = await devtools.evaluate(`(() => ({
		draft: localStorage.getItem('${DRAFT_KEY}') !== null,
		value: document.querySelector('#q-final-notes').value,
		message: document.querySelector('#q-business-name-error').textContent,
		focused: document.activeElement.id
	}))()`)
	assert.equal(serverValidation.draft, true)
	assert.equal(serverValidation.value, 'Browser preservation test')
	assert.equal(serverValidation.message, 'Server validation test.')
	assert.equal(serverValidation.focused, 'questionnaire-errors')

	for (const failure of [
		{ status: 502, error: 'We could not deliver your questionnaire. Your answers are still saved; please try again.' },
		{ status: 503, error: 'This form is temporarily unavailable. Your answers are still saved.' },
	]) {
		await devtools.evaluate(`window.fetch = async () => new Response(JSON.stringify({
			ok: false,
			error: ${JSON.stringify(failure.error)}
		}), { status: ${failure.status}, headers: { 'content-type': 'application/json' } })`)
		await devtools.evaluate(
			`document.querySelector('[data-questionnaire]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))`,
		)
		await waitFor(
			devtools,
			`!document.querySelector('#questionnaire-submit-status').hidden && document.querySelector('button[type="submit"]').textContent !== 'Sending…'`,
		)
		assert.equal(
			await devtools.evaluate(`document.querySelector('#questionnaire-submit-status').textContent`),
			failure.error,
		)
		assert.equal(await devtools.evaluate(`localStorage.getItem('${DRAFT_KEY}') !== null`), true)
	}

	await devtools.evaluate(`(() => {
		window.__fetchCalls = 0
		window.fetch = () => {
			window.__fetchCalls++
			return new Promise((resolve) => {
				window.__resolveSubmission = () => resolve(new Response(JSON.stringify({
					ok: false,
					error: 'Retry test.'
				}), { status: 502, headers: { 'content-type': 'application/json' } }))
			})
		}
		const form = document.querySelector('[data-questionnaire]')
		form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
		form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
	})()`)
	await waitFor(devtools, `window.__fetchCalls === 1`)
	assert.equal(await devtools.evaluate(`document.querySelector('button[type="submit"]').disabled`), true)
	assert.equal(await devtools.evaluate(`document.querySelector('button[type="submit"]').textContent`), 'Sending…')
	await devtools.evaluate(`window.__resolveSubmission()`)
	await waitFor(devtools, `document.querySelector('button[type="submit"]').textContent !== 'Sending…'`)

	await devtools.command('Emulation.setDeviceMetricsOverride', {
		width: 375,
		height: 812,
		deviceScaleFactor: 1,
		mobile: true,
	})
	const mobile = await devtools.evaluate(`(() => ({
		viewport: innerWidth,
		scrollWidth: document.documentElement.scrollWidth,
		buttonWidth: document.querySelector('button[type="submit"]').getBoundingClientRect().width
	}))()`)
	assert.ok(mobile.scrollWidth <= mobile.viewport + 1)
	assert.ok(mobile.buttonWidth >= 150)

	await devtools.evaluate(`(() => {
		window.__posted = null
		window.fetch = async (url, init) => {
			window.__posted = JSON.parse(init.body)
			return new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		}
	})()`)
	await devtools.evaluate(
		`document.querySelector('[data-questionnaire]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))`,
	)
	await waitFor(devtools, `!document.querySelector('#questionnaire-success').hidden`)
	const success = await devtools.evaluate(`(() => ({
		formHidden: document.querySelector('[data-questionnaire]').hidden,
		successVisible: !document.querySelector('#questionnaire-success').hidden,
		heading: document.querySelector('#questionnaire-success h2').textContent.trim(),
		focused: document.activeElement.id,
		draft: localStorage.getItem('${DRAFT_KEY}'),
		receipt: localStorage.getItem('${RECEIPT_KEY}'),
		posted: window.__posted
	}))()`)
	assert.equal(success.formHidden, true)
	assert.equal(success.successVisible, true)
	assert.equal(success.heading, 'Questionnaire received.')
	assert.equal(success.focused, 'questionnaire-success')
	assert.equal(success.draft, null)

	/* The posted envelope carries the honeypot and nothing of Turnstile. */
	assert.equal(success.posted._gotcha, '')
	assert.equal('turnstileToken' in success.posted, false)
	assert.equal(success.posted.questionnaireId, 'avioric-website')
	assert.equal(success.posted.token, '5a468912-b9f9-45f1-babc-c5774180b72b')

	/* The receipt outlives the draft it replaced. */
	assert.ok(success.receipt)
	const receipt = JSON.parse(success.receipt)
	assert.equal(receipt.id, 'avioric-website')
	assert.equal(receipt.version, 3)
	assert.ok(!Number.isNaN(Date.parse(receipt.submittedAt)))

	/* A return visit: the completed state, not a blank form. */
	await devtools.evaluate(`window.__beforeReload = true`)
	await devtools.command('Page.reload', { ignoreCache: true })
	await waitFor(
		devtools,
		`!window.__beforeReload && document.readyState === 'complete' && document.querySelector('[data-questionnaire]')?.hidden === true`,
	)
	const returning = await devtools.evaluate(`(() => ({
		formHidden: document.querySelector('[data-questionnaire]').hidden,
		successVisible: !document.querySelector('#questionnaire-success').hidden,
		heading: document.querySelector('#questionnaire-success h2').textContent.trim(),
		note: document.querySelector('[data-submitted-note]')?.textContent ?? '',
		noteVisible: !document.querySelector('[data-submitted-note]')?.hidden,
		draft: localStorage.getItem('${DRAFT_KEY}')
	}))()`)
	assert.equal(returning.formHidden, true)
	assert.equal(returning.successVisible, true)
	assert.equal(returning.heading, 'Questionnaire received.')
	assert.equal(returning.noteVisible, true)
	assert.match(returning.note, /You sent this questionnaire/)
	assert.equal(returning.draft, null)
	/* House style, and this line is client-facing. */
	assert.equal(returning.note.includes('\u2014'), false)

	const screenshot = await devtools.command('Page.captureScreenshot', {
		format: 'png',
		captureBeyondViewport: false,
	})
	writeFileSync(SCREENSHOT, Buffer.from(screenshot.data, 'base64'))

	console.log(
		JSON.stringify(
			{
				ok: true,
				assertions: 52,
				screenshot: SCREENSHOT,
			},
			null,
			2,
		),
	)
} finally {
	devtools?.close()
	const exited = new Promise((resolve) => chrome.once('exit', resolve))
	chrome.kill('SIGTERM')
	await Promise.race([exited, sleep(3_000)])
	if (chrome.exitCode === null) {
		chrome.kill('SIGKILL')
		await Promise.race([exited, sleep(1_000)])
	}
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			rmSync(PROFILE, { recursive: true, force: true })
			break
		} catch {
			await sleep(200)
		}
	}
}
