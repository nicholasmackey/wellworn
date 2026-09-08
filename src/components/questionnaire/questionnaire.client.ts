/**
 * The questionnaire's client behaviour: autosave, conditional visibility, and
 * the validation experience.
 *
 * Everything here enhances a form that is already complete and already correct
 * in the HTML. Nothing invents a control, and nothing hides content behind a
 * script that may not arrive.
 *
 * Deliberately importing no schema and no zod. `matches` and the draft helpers
 * are pure functions with type-only imports, so the browser gets the shared
 * rules without the validator that enforces them on the server — which is where
 * the authoritative check belongs anyway. Native constraint validation does the
 * live work here, for free and in the reader's own language.
 *
 * The submit button is rendered disabled and enabled from here, once the
 * handlers are attached. The pattern is progressive enhancement: if this file never
 * runs, the client is not offered a button that would post their answers into
 * nothing.
 */
import type { ShowIf } from '../../lib/questionnaire/schema'
import { matches } from '../../lib/questionnaire/visibility'
import { askConfirm } from '../../lib/questionnaire/dialog'
import {
	clearDrafts,
	formatSavedAt,
	formatSubmittedAt,
	readDraft,
	readReceipt,
	writeDraft,
	writeReceipt,
} from '../../lib/questionnaire/draft'
import { DATA } from '../../lib/questionnaire/dom'
import { HONEYPOT_FIELD } from '../../lib/questionnaire/config'

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement

interface QuestionEl {
	readonly id: string
	readonly type: string
	readonly wrapper: HTMLElement
	readonly controls: Control[]
	readonly showIf: ShowIf | null
	readonly required: boolean
	readonly min: number | null
	readonly max: number | null
	readonly label: string
	readonly errorEl: HTMLElement | null
}

interface Issue {
	readonly id: string
	readonly label: string
	readonly message: string
}

interface ApiIssue {
	readonly questionId?: unknown
	readonly message?: unknown
}

interface ApiResponse {
	readonly ok?: unknown
	readonly error?: unknown
	readonly issues?: unknown
}

/** How long to wait after the last keystroke before writing a draft. */
const SAVE_DEBOUNCE_MS = 400

/** How long to wait before re-checking a form that is already showing errors. */
const REVALIDATE_DEBOUNCE_MS = 120

function init(): void {
	const formElement = document.querySelector<HTMLFormElement>(`[${DATA.form}]`)
	if (!formElement) return
	const form = formElement

	const id = form.getAttribute(DATA.id)
	const token = form.getAttribute(DATA.token)
	const version = Number(form.getAttribute(DATA.version))
	const schemaVersion = Number(form.getAttribute(DATA.schemaVersion))
	if (!id || !token || !Number.isFinite(version) || !Number.isFinite(schemaVersion)) return

	/* ------------------------------------------------------------------
	   The page, read once into a model the rest of this file works from.
	   ------------------------------------------------------------------ */

	const questions: QuestionEl[] = [
		...form.querySelectorAll<HTMLElement>(`[${DATA.question}]`),
	].map((wrapper) => {
		const rawShowIf = wrapper.getAttribute(DATA.showIf)
		const min = wrapper.getAttribute(DATA.min)
		const max = wrapper.getAttribute(DATA.max)

		/* The question as a person reads it, with the "Required" marker taken
		   off — the summary says "Business name", not "Business nameRequired". */
		const naming =
			wrapper.querySelector<HTMLElement>('.q-label') ??
			wrapper.querySelector<HTMLElement>('.q-confirm')
		let label = ''
		if (naming) {
			const clone = naming.cloneNode(true) as HTMLElement
			clone.querySelector('.q-required')?.remove()
			label = (clone.textContent ?? '').trim()
		}

		return {
			id: wrapper.getAttribute(DATA.question) ?? '',
			type: wrapper.getAttribute(DATA.type) ?? '',
			wrapper,
			controls: [...wrapper.querySelectorAll<Control>('input, select, textarea')],
			showIf: rawShowIf ? (JSON.parse(rawShowIf) as ShowIf) : null,
			required: wrapper.getAttribute(DATA.required) === 'true',
			min: min === null ? null : Number(min),
			max: max === null ? null : Number(max),
			label,
			errorEl: wrapper.querySelector<HTMLElement>('.q-error'),
		}
	})

	const byId = new Map(questions.map((q) => [q.id, q]))
	const answerable = questions.filter((q) => q.type !== 'info')

	const summary = document.getElementById('questionnaire-errors')
	const summaryHeading = summary?.querySelector<HTMLElement>('[data-error-heading]') ?? null
	const summaryList = summary?.querySelector<HTMLElement>('[data-error-list]') ?? null
	const restored = document.getElementById('questionnaire-restored')
	const restoredMessage = restored?.querySelector<HTMLElement>('[data-restore-message]') ?? null
	const startFresh = restored?.querySelector<HTMLButtonElement>('[data-start-fresh]') ?? null
	const startFreshDialog = document.querySelector<HTMLDialogElement>('#questionnaire-start-fresh')
	const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]')
	const submitStatus = document.getElementById('questionnaire-submit-status')
	const success = document.getElementById('questionnaire-success')
	const submittedNote = success?.querySelector<HTMLElement>('[data-submitted-note]') ?? null

	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

	/* ------------------------------------------------------------------
	   Reading and writing answers.

	   One pair of functions per shape of control, and the rule they encode is
	   the same one the server uses: blank means unanswered, but `false` on a
	   yes/no is an answer and must survive the round trip.
	   ------------------------------------------------------------------ */

	function readValue(question: QuestionEl): unknown {
		const first = question.controls[0]

		switch (question.type) {
			case 'text':
			case 'textarea':
			case 'email':
			case 'phone':
			case 'date': {
				const value = (first as HTMLInputElement | HTMLTextAreaElement | undefined)?.value ?? ''
				return value === '' ? undefined : value
			}

			case 'number': {
				const value = (first as HTMLInputElement | undefined)?.value ?? ''
				if (value === '') return undefined
				const parsed = Number(value)
				return Number.isFinite(parsed) ? parsed : undefined
			}

			case 'select': {
				const value = (first as HTMLSelectElement | undefined)?.value ?? ''
				return value === '' ? undefined : value
			}

			case 'boolean': {
				const checked = question.controls.find((c) => (c as HTMLInputElement).checked)
				if (!checked) return undefined
				return (checked as HTMLInputElement).value === 'true'
			}

			case 'radio': {
				const checked = question.controls.find((c) => (c as HTMLInputElement).checked)
				return checked ? (checked as HTMLInputElement).value : undefined
			}

			case 'checkbox': {
				const values = question.controls
					.filter((c) => (c as HTMLInputElement).checked)
					.map((c) => (c as HTMLInputElement).value)
				return values.length > 0 ? values : undefined
			}

			case 'confirm':
				return (first as HTMLInputElement | undefined)?.checked ? true : undefined

			default:
				return undefined
		}
	}

	function applyValue(question: QuestionEl, value: unknown): void {
		const first = question.controls[0]

		switch (question.type) {
			case 'text':
			case 'textarea':
			case 'email':
			case 'phone':
			case 'date':
			case 'number': {
				if (first) (first as HTMLInputElement).value = value === undefined ? '' : String(value)
				break
			}

			case 'select': {
				if (first) (first as HTMLSelectElement).value = value === undefined ? '' : String(value)
				break
			}

			case 'boolean': {
				const wanted = value === true ? 'true' : value === false ? 'false' : null
				for (const control of question.controls) {
					;(control as HTMLInputElement).checked =
						wanted !== null && (control as HTMLInputElement).value === wanted
				}
				break
			}

			case 'radio': {
				for (const control of question.controls) {
					;(control as HTMLInputElement).checked = (control as HTMLInputElement).value === value
				}
				break
			}

			case 'checkbox': {
				const wanted = new Set(Array.isArray(value) ? (value as unknown[]).map(String) : [])
				for (const control of question.controls) {
					;(control as HTMLInputElement).checked = wanted.has((control as HTMLInputElement).value)
				}
				break
			}

			case 'confirm': {
				if (first) (first as HTMLInputElement).checked = value === true
				break
			}
		}
	}

	/** Every answer on the page, hidden ones included — see saveDraft. */
	function collectAll(): Record<string, unknown> {
		const answers: Record<string, unknown> = {}
		for (const question of answerable) {
			const value = readValue(question)
			if (value !== undefined) answers[question.id] = value
		}
		return answers
	}

	/** Only what is on screen. This is what a submission is built from. */
	function collectVisible(): Record<string, unknown> {
		const answers: Record<string, unknown> = {}
		for (const question of answerable) {
			if (question.wrapper.hidden) continue
			const value = readValue(question)
			if (value !== undefined) answers[question.id] = value
		}
		return answers
	}

	/* ------------------------------------------------------------------
	   Conditional visibility.

	   One forward pass, exactly as the server does it, and for the same reason
	   it is safe to do in one: a condition may only name a question defined
	   above it, so by the time one is evaluated its target has been decided.

	   Hidden means `hidden` on the wrapper and `disabled` on every control in
	   it. That pairing is doing three jobs — not submitted, not validated by
	   the browser, out of the tab order — so nothing here has to track which
	   questions "count".
	   ------------------------------------------------------------------ */

	function updateVisibility(): void {
		const answers: Record<string, unknown> = {}
		const visible = new Set<string>()

		for (const question of questions) {
			let show = true

			if (question.showIf) {
				/* The cascade. A condition can only be satisfied by a question that
				   is itself on screen, or answering something and then hiding it
				   would strand everything below it. */
				show =
					visible.has(question.showIf.question) &&
					matches(question.showIf, answers[question.showIf.question])
			}

			if (show) visible.add(question.id)

			question.wrapper.hidden = !show
			for (const control of question.controls) control.disabled = !show

			answers[question.id] = show ? readValue(question) : undefined
		}
	}

	/* ------------------------------------------------------------------
	   Drafts.
	   ------------------------------------------------------------------ */

	const currentTypes: Record<string, string> = Object.fromEntries(
		answerable.map((question) => [question.id, question.type]),
	)

	let saveTimer: number | undefined

	function saveDraft(): void {
		window.clearTimeout(saveTimer)
		saveTimer = undefined

		/* Hidden answers are kept. If someone answers a question, then changes an
		   earlier one so it disappears, then changes it back, their answer should
		   still be there — and a draft is the right place for that memory. Only
		   what is visible is ever submitted. */
		const written = writeDraft(window.localStorage, {
			id: id!,
			version,
			schemaVersion,
			answers: collectAll(),
			types: currentTypes,
		})

		/* Saved is safe. Anything typed since the last keystroke is now on this
		   device, so the page may be closed without losing it — and if the write
		   failed (private mode, a full quota) the guard deliberately stays on,
		   because that is the one case where leaving really does lose answers. */
		if (written) releaseGuard()
	}

	function scheduleSave(): void {
		window.clearTimeout(saveTimer)
		saveTimer = window.setTimeout(saveDraft, SAVE_DEBOUNCE_MS)
		armGuard()
	}

	function flushSave(): void {
		if (saveTimer !== undefined) saveDraft()
	}

	function restoreDraft(): void {
		const load = readDraft(window.localStorage, { id: id!, version, schemaVersion, currentTypes })
		if (load.status === 'none') return

		for (const [questionId, value] of Object.entries(load.answers)) {
			const question = byId.get(questionId)
			if (question) applyValue(question, value)
		}

		updateVisibility()

		if (!restored || !restoredMessage) return

		if (load.status === 'restored') {
			restored.dataset.tone = 'info'
			restoredMessage.textContent = `We filled these in from your answers ${formatSavedAt(load.savedAt)}. Everything is still editable.`
		} else {
			/* A migration dropped answers to questions that changed, so the band
			   changes tone with the news. The attribute is the whole of it: the
			   colour lives in the stylesheet, keyed off the semantic variables, so
			   nothing here knows what a warning looks like. */
			restored.dataset.tone = 'warning'
			const kept = load.kept === 1 ? '1 answer' : `${load.kept} answers`
			const dropped =
				load.dropped === 0
					? ''
					: load.dropped === 1
						? ' One question changed, so that answer was cleared.'
						: ` ${load.dropped} questions changed, so those answers were cleared.`
			restoredMessage.textContent = `Some of this questionnaire has changed since you last opened it. We kept ${kept}.${dropped}`

			/* Re-anchor a migrated draft at the current version straight away, so
			   closing the page without touching anything does not lose the answers
			   we just carried over. */
			saveDraft()
		}

		restored.hidden = false
	}

	/* ------------------------------------------------------------------
	   The unload guard.

	   Armed only while a write is actually pending — the debounce window
	   between a keystroke and the save it triggers, plus the case where the
	   save itself failed. Once the answers are in localStorage there is
	   nothing to lose by closing the tab, and interrupting someone to tell
	   them so would be a warning about nothing.
	   ------------------------------------------------------------------ */

	let guarded = false
	let finished = false

	function onBeforeUnload(event: BeforeUnloadEvent): void {
		/* preventDefault alone is the modern spelling, and every browser this
		   site supports honours it. The old `returnValue = ''` companion is
		   deprecated and no longer needed. */
		event.preventDefault()
	}

	function armGuard(): void {
		if (guarded || finished) return
		guarded = true
		window.addEventListener('beforeunload', onBeforeUnload)
	}

	function releaseGuard(): void {
		if (!guarded) return
		guarded = false
		window.removeEventListener('beforeunload', onBeforeUnload)
	}

	/* ------------------------------------------------------------------
	   Validation.

	   Native constraint validation does the work wherever HTML can express the
	   rule. The functions below add only what it cannot: group counts, a
	   confirmation that has to be ticked, and a phone number loose enough to
	   accept the way people actually write them.
	   ------------------------------------------------------------------ */

	function nativeMessage(question: QuestionEl, control: Control): string {
		const validity = control.validity

		if (validity.valueMissing) return 'This question needs an answer.'
		if (validity.typeMismatch && question.type === 'email') {
			return 'Enter an email address, like name@example.com.'
		}
		if (validity.rangeUnderflow || validity.rangeOverflow || validity.badInput) {
			if (question.type === 'date') {
				const input = control as HTMLInputElement
				if (validity.rangeUnderflow) return `Choose a date on or after ${input.min}.`
				if (validity.rangeOverflow) return `Choose a date on or before ${input.max}.`
				return 'Enter a date.'
			}
			const input = control as HTMLInputElement
			if (input.min !== '' && input.max !== '') {
				return `Enter a number between ${input.min} and ${input.max}.`
			}
			if (validity.rangeUnderflow) return `Enter ${input.min} or more.`
			if (validity.rangeOverflow) return `Enter ${input.max} or less.`
			return 'Enter a number.'
		}
		if (validity.tooLong) {
			return `Shorten this to ${(control as HTMLInputElement).maxLength} characters or fewer.`
		}

		/* Anything left is something the browser understands better than we do. */
		return control.validationMessage || 'Check this answer.'
	}

	function validateQuestion(question: QuestionEl): string | null {
		if (question.type === 'info' || question.wrapper.hidden) return null

		const value = readValue(question)

		if (question.type === 'checkbox') {
			const selected = Array.isArray(value) ? value.length : 0
			/* A required group with no explicit floor means "at least one". */
			const min = question.min ?? (question.required ? 1 : 0)
			if (selected < min) {
				return min <= 1 ? 'Choose at least one.' : `Choose at least ${min}.`
			}
			if (question.max !== null && selected > question.max) {
				return `Choose no more than ${question.max}.`
			}
			return null
		}

		if (question.type === 'confirm') {
			return value === true ? null : 'Tick this box to continue.'
		}

		if (question.type === 'boolean' || question.type === 'radio') {
			return question.required && value === undefined ? 'Choose one.' : null
		}

		const control = question.controls[0]
		if (!control) return null

		if (!control.checkValidity()) return nativeMessage(question, control)

		/* Loose on purpose. Numbers arrive with brackets, dashes, dots, spaces
		   and extensions, and a stricter rule rejects real ones — which costs us
		   the contact detail we asked for. The server applies the same floor. */
		if (question.type === 'phone' && typeof value === 'string') {
			const digits = (value.match(/\d/g) ?? []).length
			if (digits < 7) return 'Enter a phone number with at least 7 digits.'
		}

		return null
	}

	function collectIssues(): Issue[] {
		const issues: Issue[] = []
		for (const question of answerable) {
			const message = validateQuestion(question)
			if (message) issues.push({ id: question.id, label: question.label, message })
		}
		return issues
	}

	function setFieldError(question: QuestionEl, message: string | null): void {
		if (question.errorEl) {
			question.errorEl.textContent = message ?? ''
			question.errorEl.hidden = message === null
		}
		for (const control of question.controls) {
			if (message) control.setAttribute('aria-invalid', 'true')
			else control.removeAttribute('aria-invalid')
		}
	}

	function scrollToElement(element: HTMLElement): void {
		/* global.css already forces scroll-behavior: auto under reduced motion,
		   but that governs CSS-driven scrolling; a behavior passed to
		   scrollIntoView is honoured regardless, so the check has to happen
		   here too or the stylesheet's promise is quietly broken. */
		element.scrollIntoView({
			behavior: reduceMotion.matches ? 'auto' : 'smooth',
			block: 'start',
		})
	}

	function focusQuestion(question: QuestionEl): void {
		scrollToElement(question.wrapper)
		/* The first control rather than the wrapper: a keyboard user following a
		   link from the summary wants to be in the box, not beside it.
		   preventScroll so the jump above is not immediately overridden. */
		const target = question.controls[0] ?? question.wrapper
		target.focus({ preventScroll: true })
	}

	function renderSummary(issues: Issue[]): void {
		if (!summary || !summaryHeading || !summaryList) return

		if (issues.length === 0) {
			summary.hidden = true
			summaryList.replaceChildren()
			summaryHeading.textContent = ''
			return
		}

		summaryHeading.textContent =
			issues.length === 1
				? 'One question needs your attention'
				: `${issues.length} questions need your attention`

		const items = issues.map((issue) => {
			const item = document.createElement('li')
			const link = document.createElement('a')
			link.href = `#question-${issue.id}`
			link.className = 'q-error-link'
			link.textContent = `${issue.label}: ${issue.message}`
			link.addEventListener('click', (event) => {
				event.preventDefault()
				const question = byId.get(issue.id)
				if (question) focusQuestion(question)
			})
			item.append(link)
			return item
		})

		summaryList.replaceChildren(...items)
		summary.hidden = false
	}

	function applyIssues(issues: Issue[]): void {
		const byQuestion = new Map(issues.map((issue) => [issue.id, issue]))
		for (const question of answerable) {
			setFieldError(question, byQuestion.get(question.id)?.message ?? null)
		}
		renderSummary(issues)
	}

	function focusIssueSummary(): void {
		if (!summary) return
		scrollToElement(summary)
		summary.focus({ preventScroll: true })
	}

	function showSubmissionError(message: string): void {
		if (!submitStatus) return
		submitStatus.textContent = message
		submitStatus.hidden = false
		scrollToElement(submitStatus)
		submitStatus.focus({ preventScroll: true })
	}

	function clearSubmissionError(): void {
		if (!submitStatus) return
		submitStatus.textContent = ''
		submitStatus.hidden = true
	}

	function readApiIssue(value: unknown): ApiIssue | null {
		if (!value || typeof value !== 'object') return null
		return value as ApiIssue
	}

	function issuesFromApi(body: ApiResponse): Issue[] {
		if (!Array.isArray(body.issues)) return []

		const issues: Issue[] = []
		for (const raw of body.issues) {
			const issue = readApiIssue(raw)
			if (!issue || typeof issue.questionId !== 'string' || typeof issue.message !== 'string') {
				continue
			}
			const question = byId.get(issue.questionId)
			if (!question) continue
			issues.push({ id: question.id, label: question.label, message: issue.message })
		}
		return issues
	}

	let revalidateTimer: number | undefined

	/** Refresh what is already on screen. Never scrolls, never steals focus. */
	function refreshIssues(): void {
		if (!summary || summary.hidden) return
		window.clearTimeout(revalidateTimer)
		revalidateTimer = window.setTimeout(() => applyIssues(collectIssues()), REVALIDATE_DEBOUNCE_MS)
	}

	/* ------------------------------------------------------------------
	   Wiring.
	   ------------------------------------------------------------------ */

	/* scheduleSave() arms the unload guard as part of queueing the write, so
	   there is nothing to mark dirty here. */
	form.addEventListener('input', () => {
		updateVisibility()
		scheduleSave()
		refreshIssues()
	})

	form.addEventListener('change', () => {
		updateVisibility()
		scheduleSave()
		refreshIssues()
	})

	/* The reliable "the page is going away" signal on mobile. beforeunload and
	   unload are not fired at all when a tab is discarded or the app is
	   swapped away, which is exactly when a half-finished form is at risk. */
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') flushSave()
	})
	window.addEventListener('pagehide', flushSave)

	/* Both halves or neither. The button is only ever shown by restoreDraft(),
	   which runs after this, so a page whose dialog failed to render offers no
	   control that would clear twenty answers without asking. */
	if (startFresh && startFreshDialog) {
		startFresh.addEventListener('click', async () => {
			if (!(await askConfirm(startFreshDialog, startFresh))) return

			clearDrafts(window.localStorage, id!)
			window.clearTimeout(saveTimer)
			saveTimer = undefined

			/* The guard goes down before the reload, or the browser asks a second
			   question — its own, about leaving — on the way out of the one that
			   was just answered. */
			releaseGuard()
			finished = true
			window.location.reload()
		})
	}

	/*
	 * The form is never allowed to navigate. `novalidate` moves the messaging
	 * from the browser's bubbles — which show one at a time, vanish on scroll
	 * and cannot be read by a screen reader as a list — to the summary at the
	 * top of the page.
	 */
	form.noValidate = true

	let submitting = false
	const submitLabel = submitButton?.textContent ?? 'Send to Wellworn'

	function setSubmitting(active: boolean): void {
		submitting = active
		form.setAttribute('aria-busy', String(active))
		if (submitButton) {
			submitButton.disabled = active
			submitButton.textContent = active ? 'Sending…' : submitLabel
		}
	}

	form.addEventListener('submit', async (event) => {
		event.preventDefault()
		if (submitting) return

		flushSave()
		clearSubmissionError()
		const issues = collectIssues()
		applyIssues(issues)

		if (issues.length > 0) {
			/* Focus the summary, not the first bad field. Someone using a screen
			   reader hears how many questions need attention, and what they are,
			   before being dropped into one of them — and someone using a keyboard
			   gets a jump list instead of a hunt down the page. */
			focusIssueSummary()
			return
		}

		const honeypot = form.elements.namedItem(HONEYPOT_FIELD)
		const honeypotValue = honeypot instanceof HTMLInputElement ? honeypot.value : ''

		setSubmitting(true)
		try {
			const response = await fetch(form.action, {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					questionnaireId: id,
					version,
					schemaVersion,
					token,
					answers: collectVisible(),
					[HONEYPOT_FIELD]: honeypotValue,
				}),
			})

			let body: ApiResponse = {}
			try {
				body = (await response.json()) as ApiResponse
			} catch {
				/* A proxy-generated response may not be JSON. Use the fallback below. */
			}

			if (!response.ok || body.ok !== true) {
				const serverIssues = issuesFromApi(body)
				if (serverIssues.length > 0) {
					applyIssues(serverIssues)
					focusIssueSummary()
				} else {
					showSubmissionError(
						typeof body.error === 'string'
							? body.error
							: 'We could not deliver your questionnaire. Your answers are still saved; please try again.',
					)
				}
				return
			}

			/* This is the only draft-clearing path: a 2xx response whose body says
			   delivery succeeded. A network error, an invalid response, or a Resend
			   failure leaves both the controls and localStorage untouched. */
			/* Receipt first, then the answers. Written before the draft is swept
			   so a storage failure cannot leave this device with neither. */
			writeReceipt(window.localStorage, { id, version })
			clearDrafts(window.localStorage, id)
			window.clearTimeout(saveTimer)
			saveTimer = undefined
			finished = true
			releaseGuard()

			form.hidden = true
			if (success) {
				success.hidden = false
				scrollToElement(success)
				success.focus({ preventScroll: true })
			}
		} catch {
			showSubmissionError(
				'We could not reach Wellworn. Your answers are still saved; check your connection and try again.',
			)
		} finally {
			if (!finished) setSubmitting(false)
		}
	})

	/* ------------------------------------------------------------------
	   Go.
	   ------------------------------------------------------------------ */

	/* A return visit after a confirmed delivery. The form is not offered again:
	   the answers are gone from this device, and a blank questionnaire under a
	   heading that says "received" is the most alarming thing we could show
	   someone who already spent an afternoon on it. */
	const receipt = readReceipt(window.localStorage, { id, version })
	if (receipt && success) {
		form.hidden = true
		success.hidden = false
		if (submittedNote) {
			const when = formatSubmittedAt(receipt.submittedAt)
			submittedNote.textContent = when
				? `You sent this questionnaire ${when}. If you need to change an answer, reply to us and we will reopen it.`
				: 'You have already sent this questionnaire. If you need to change an answer, reply to us and we will reopen it.'
			submittedNote.hidden = false
		}
		return
	}

	restoreDraft()
	updateVisibility()

	/* Last, and only now: the button is live because the handlers above exist.
	   If this file failed to load, the client is never offered a control that
	   would post their answers into nothing. */
	if (submitButton) submitButton.disabled = false
}

init()
