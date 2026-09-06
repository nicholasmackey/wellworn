/**
 * Saved drafts: the localStorage half of "your answers save as you go".
 *
 * Deliberately free of any DOM reference. Everything here takes a Storage and
 * plain data, so the migration rules — the fiddliest part of the feature and
 * the one with the most ways to quietly lose someone's work — can be exercised
 * directly rather than only through a browser.
 *
 * KEY
 *
 *   wellworn:q:<questionnaire-id>:v<version>
 *
 * Namespaced by the questionnaire's own `version`, not by `schemaVersion`, and
 * the difference is the whole design:
 *
 *   version        the instrument. Bumped when a question is added, removed,
 *                  retyped, or has its option values changed — i.e. when
 *                  answers may no longer mean what they meant. A draft under
 *                  an older version is MIGRATED, field by field.
 *   schemaVersion  the definition format, engine-wide. A bump here means the
 *                  renderer itself changed shape, so a draft written by the old
 *                  engine cannot be trusted at all. It is DISCARDED.
 *
 * The payoff is that fixing a typo in a help string costs nobody their
 * half-finished answers, which is the failure this design exists to avoid.
 */

/** What one saved draft holds. `types` is what makes migration type-aware. */
export interface DraftPayload {
	readonly id: string
	readonly version: number
	readonly schemaVersion: number
	/** ISO 8601, UTC. Shown to the client as "your answers from 3 September". */
	readonly savedAt: string
	readonly answers: Record<string, unknown>
	/** Question id → field type, as it was when the draft was written. */
	readonly types: Record<string, string>
}

export type DraftLoad =
	| { readonly status: 'none' }
	| { readonly status: 'restored'; readonly answers: Record<string, unknown>; readonly savedAt: string }
	| {
			readonly status: 'migrated'
			readonly answers: Record<string, unknown>
			readonly savedAt: string
			readonly fromVersion: number
			readonly kept: number
			readonly dropped: number
	  }

const PREFIX = 'wellworn:q:'

export const draftKey = (id: string, version: number): string => `${PREFIX}${id}:v${version}`

/*
 * Every storage call is wrapped. localStorage throws outright in some contexts
 * — a browser set to block site data, a thumbnailer, a locked-down webview —
 * and it can be full. A questionnaire that cannot save must still be a
 * questionnaire that works, so every failure here degrades to "no draft".
 */
function safeGet(storage: Storage, key: string): string | null {
	try {
		return storage.getItem(key)
	} catch {
		return null
	}
}

function safeSet(storage: Storage, key: string, value: string): boolean {
	try {
		storage.setItem(key, value)
		return true
	} catch {
		return false
	}
}

function safeRemove(storage: Storage, key: string): void {
	try {
		storage.removeItem(key)
	} catch {
		/* Nothing to do. The draft is stale either way. */
	}
}

function safeKeys(storage: Storage): string[] {
	try {
		return Object.keys(storage)
	} catch {
		return []
	}
}

/** Parse a stored payload, rejecting anything that is not shaped like one. */
function parse(raw: string | null): DraftPayload | null {
	if (!raw) return null
	try {
		const value = JSON.parse(raw) as unknown
		if (!value || typeof value !== 'object') return null
		const draft = value as Partial<DraftPayload>
		if (typeof draft.id !== 'string') return null
		if (typeof draft.version !== 'number') return null
		if (typeof draft.schemaVersion !== 'number') return null
		if (typeof draft.savedAt !== 'string') return null
		if (!draft.answers || typeof draft.answers !== 'object') return null
		if (!draft.types || typeof draft.types !== 'object') return null
		return draft as DraftPayload
	} catch {
		return null
	}
}

/** Every stored draft for one questionnaire, newest version first. */
function siblingDrafts(storage: Storage, id: string): { key: string; draft: DraftPayload }[] {
	const prefix = `${PREFIX}${id}:v`
	return safeKeys(storage)
		.filter((key) => key.startsWith(prefix))
		.map((key) => ({ key, draft: parse(safeGet(storage, key)) }))
		.filter((entry): entry is { key: string; draft: DraftPayload } => entry.draft !== null)
		.sort((a, b) => b.draft.version - a.draft.version)
}

export interface ReadDraftOptions {
	readonly id: string
	readonly version: number
	readonly schemaVersion: number
	/**
	 * The questions on the page now, and their types. Migration keeps an answer
	 * only where the id still exists AND the type is unchanged.
	 */
	readonly currentTypes: Record<string, string>
}

/**
 * Load the best available draft, migrating an older one if that is all there is.
 *
 * Stale keys are removed as they are found, so a questionnaire that has been
 * revised a few times does not accumulate drafts nobody will ever read.
 */
export function readDraft(storage: Storage, options: ReadDraftOptions): DraftLoad {
	const { id, version, schemaVersion, currentTypes } = options

	const exact = parse(safeGet(storage, draftKey(id, version)))
	if (exact) {
		/* Written by a different engine. Nothing about it can be trusted, so it
		   goes rather than being half-believed. */
		if (exact.schemaVersion !== schemaVersion) {
			safeRemove(storage, draftKey(id, version))
		} else {
			return { status: 'restored', answers: exact.answers, savedAt: exact.savedAt }
		}
	}

	/* No draft at this version. The most recent older one is the candidate. */
	const candidate = siblingDrafts(storage, id).find(
		(entry) => entry.draft.version !== version && entry.draft.schemaVersion === schemaVersion,
	)

	/* Sweep everything else for this questionnaire, whatever happens next. */
	for (const entry of siblingDrafts(storage, id)) {
		if (entry.key !== candidate?.key) safeRemove(storage, entry.key)
	}

	if (!candidate) return { status: 'none' }

	const answers: Record<string, unknown> = {}
	let kept = 0
	let dropped = 0

	for (const [questionId, value] of Object.entries(candidate.draft.answers)) {
		/* Both halves matter. A question that no longer exists has nowhere to put
		   its answer; a question whose TYPE changed under a reused id would take
		   the old value and quietly mean something else by it — a text answer
		   reinterpreted as a chosen option looks answered and is wrong. Dropping
		   is the only honest move. */
		const wasType = candidate.draft.types[questionId]
		if (wasType !== undefined && currentTypes[questionId] === wasType) {
			answers[questionId] = value
			kept += 1
		} else {
			dropped += 1
		}
	}

	safeRemove(storage, candidate.key)

	if (kept === 0) return { status: 'none' }

	return {
		status: 'migrated',
		answers,
		savedAt: candidate.draft.savedAt,
		fromVersion: candidate.draft.version,
		kept,
		dropped,
	}
}

export interface WriteDraftOptions {
	readonly id: string
	readonly version: number
	readonly schemaVersion: number
	readonly answers: Record<string, unknown>
	readonly types: Record<string, string>
}

/** Returns false if storage refused it — the caller decides whether to care. */
export function writeDraft(storage: Storage, options: WriteDraftOptions): boolean {
	const payload: DraftPayload = {
		id: options.id,
		version: options.version,
		schemaVersion: options.schemaVersion,
		savedAt: new Date().toISOString(),
		answers: options.answers,
		types: options.types,
	}

	return safeSet(storage, draftKey(options.id, options.version), JSON.stringify(payload))
}

/** Remove every draft for one questionnaire — "Start fresh", and after a send. */
export function clearDrafts(storage: Storage, id: string): void {
	const prefix = `${PREFIX}${id}:v`
	for (const key of safeKeys(storage)) {
		if (key.startsWith(prefix)) safeRemove(storage, key)
	}
}

/* ---------------------------------------------------------------------------
   The receipt: proof, on this device, that a submission was actually delivered.

   Written only on a confirmed 2xx, and deliberately NOT under the `:v` prefix
   the draft keys use, so clearDrafts() sweeps the answers on a successful send
   without also erasing the record that the send happened. That separation is
   the whole point: drafts are working state and are meant to be cleared, while
   the receipt is what stops a returning client from seeing an empty form and
   reasonably concluding their afternoon of answers went nowhere.
   --------------------------------------------------------------------------- */

/** What one stored receipt holds. Versioned so a reissued questionnaire asks again. */
export interface SubmissionReceipt {
	readonly id: string
	/** The questionnaire version that was sent. */
	readonly version: number
	/** ISO 8601, UTC. */
	readonly submittedAt: string
}

export const receiptKey = (id: string): string => `${PREFIX}${id}:submitted`

/** Returns false if storage refused it — a lost receipt must never fail a send. */
export function writeReceipt(
	storage: Storage,
	options: { readonly id: string; readonly version: number; readonly submittedAt?: Date },
): boolean {
	const receipt: SubmissionReceipt = {
		id: options.id,
		version: options.version,
		submittedAt: (options.submittedAt ?? new Date()).toISOString(),
	}

	return safeSet(storage, receiptKey(options.id), JSON.stringify(receipt))
}

/**
 * The receipt for this questionnaire AT THIS VERSION, or null.
 *
 * A receipt left by an older version is removed rather than honored. If we
 * reissue the questionnaire we are asking for answers again, and showing the
 * old "received" panel would silently swallow that request.
 */
export function readReceipt(
	storage: Storage,
	options: { readonly id: string; readonly version: number },
): SubmissionReceipt | null {
	const raw = safeGet(storage, receiptKey(options.id))
	if (!raw) return null

	let receipt: SubmissionReceipt
	try {
		const value = JSON.parse(raw) as unknown
		if (!value || typeof value !== 'object') return null
		const candidate = value as Partial<SubmissionReceipt>
		if (typeof candidate.id !== 'string') return null
		if (typeof candidate.version !== 'number') return null
		if (typeof candidate.submittedAt !== 'string') return null
		receipt = candidate as SubmissionReceipt
	} catch {
		return null
	}

	if (receipt.version !== options.version) {
		safeRemove(storage, receiptKey(options.id))
		return null
	}

	return receipt
}

/** "on 6 September" — the one line the completed panel adds on a return visit. */
export function formatSubmittedAt(iso: string): string {
	const submitted = new Date(iso)
	if (Number.isNaN(submitted.getTime())) return ''
	return `on ${submitted.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`
}

/**
 * "3 September" — how a saved-at stamp is shown to the client.
 *
 * Local time and locale-aware here, unlike everywhere else in the engine: this
 * is one line of reassurance read by one person on their own machine, not a
 * canonical value, so it should say the date the way their device says it.
 */
export function formatSavedAt(iso: string, now: Date = new Date()): string {
	const saved = new Date(iso)
	if (Number.isNaN(saved.getTime())) return ''

	const sameDay =
		saved.getFullYear() === now.getFullYear() &&
		saved.getMonth() === now.getMonth() &&
		saved.getDate() === now.getDate()

	if (sameDay) {
		return `earlier today, at ${saved.toLocaleTimeString(undefined, {
			hour: 'numeric',
			minute: '2-digit',
		})}`
	}

	return `from ${saved.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`
}
