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
const DRAFT_KEY = 'wellworn:q:avioric-website:v2'
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
		turnstileSiteKey: document.querySelector('.cf-turnstile')?.dataset.sitekey,
		turnstileAppearance: document.querySelector('.cf-turnstile')?.dataset.appearance,
		turnstileLabel: document.querySelector('[data-turnstile-widget]')?.getAttribute('aria-label'),
		securitySectionHeading: [...document.querySelectorAll('[data-questionnaire] .eyebrow')]
			.some((element) => element.textContent.trim().toLowerCase() === 'security check')
	}))()`)
	assert.equal(loaded.sections, 8)
	assert.equal(loaded.answerable, 43)
	assert.equal(loaded.business, 'Avioric')
	assert.equal(loaded.email, 'hello@avioric.com')
	assert.ok(loaded.turnstileSiteKey)
	assert.equal(loaded.turnstileAppearance, 'interaction-only')
	assert.equal(loaded.turnstileLabel, 'Security verification by Cloudflare')
	assert.equal(loaded.securitySectionHeading, false)

	let turnstileVerified = false
	if (process.env.VERIFY_TURNSTILE === '1') {
		await waitFor(
			devtools,
			`document.querySelector('[name="cf-turnstile-response"]')?.value?.length > 0`,
			20_000,
		)
		const responseToken = await devtools.evaluate(
			`document.querySelector('[name="cf-turnstile-response"]').value`,
		)
		const verification = await fetch(
			'https://challenges.cloudflare.com/turnstile/v0/siteverify',
			{
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					secret: '1x0000000000000000000000000000000AA',
					response: responseToken,
				}),
			},
		)
		const result = await verification.json()
		assert.equal(result.success, true)
		/* Cloudflare's dummy keys currently return example.com rather than the
		   browser hostname. Production tokens are checked against the request host
		   by security.ts; this assertion only confirms the live test service replied. */
		assert.equal(typeof result.hostname, 'string')
		/* Dummy validation responses omit action metadata. The generated widget
		   markup and the unit-level Siteverify contract cover the action assertion. */
		assert.ok(result.action === undefined || result.action === 'questionnaire')
		turnstileVerified = true
	}

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

	await devtools.command('Page.reload', { ignoreCache: true })
	await waitFor(
		devtools,
		`document.readyState === 'complete' && document.querySelector('#q-years-in-business')?.value === '12'`,
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

	const installToken = `(() => {
		let input = document.querySelector('input[name="cf-turnstile-response"]')
		if (!input) {
			input = document.createElement('input')
			input.type = 'hidden'
			input.name = 'cf-turnstile-response'
			document.querySelector('[data-questionnaire]').append(input)
		}
		input.value = 'browser-test-token'
	})()`

	await devtools.evaluate(`${installToken}; window.fetch = async () => new Response(JSON.stringify({
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
		{ status: 422, error: 'Complete the security check and try again.' },
		{ status: 502, error: 'We could not deliver your questionnaire. Your answers are still saved; please try again.' },
	]) {
		await devtools.evaluate(`${installToken}; window.fetch = async () => new Response(JSON.stringify({
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

	await devtools.evaluate(`${installToken}; (() => {
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

	await devtools.evaluate(`${installToken}; window.fetch = async () => new Response(JSON.stringify({ ok: true }), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	})`)
	await devtools.evaluate(
		`document.querySelector('[data-questionnaire]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))`,
	)
	await waitFor(devtools, `!document.querySelector('#questionnaire-success').hidden`)
	const success = await devtools.evaluate(`(() => ({
		formHidden: document.querySelector('[data-questionnaire]').hidden,
		successVisible: !document.querySelector('#questionnaire-success').hidden,
		heading: document.querySelector('#questionnaire-success h2').textContent.trim(),
		focused: document.activeElement.id,
		draft: localStorage.getItem('${DRAFT_KEY}')
	}))()`)
	assert.equal(success.formHidden, true)
	assert.equal(success.successVisible, true)
	assert.equal(success.heading, 'Questionnaire received.')
	assert.equal(success.focused, 'questionnaire-success')
	assert.equal(success.draft, null)

	const screenshot = await devtools.command('Page.captureScreenshot', {
		format: 'png',
		captureBeyondViewport: false,
	})
	writeFileSync(SCREENSHOT, Buffer.from(screenshot.data, 'base64'))

	console.log(
		JSON.stringify(
			{
				ok: true,
				assertions: 39,
				screenshot: SCREENSHOT,
				turnstileVerified,
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
