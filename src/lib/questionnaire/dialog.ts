/**
 * Open a <dialog> as a modal and wait for the answer.
 *
 * The whole of the replacement for window.confirm(): the call site keeps the
 * shape it had — ask, and act on a boolean — while the browser supplies the
 * top layer, the inert page, the focus trap and Escape, and ConfirmDialog.astro
 * supplies the card.
 *
 * Every way out arrives at `close`. A submit button in the dialog's
 * `method="dialog"` form closes it with its own value; Escape and a click on
 * the backdrop close it with an empty one. So 'confirm' is the only answer that
 * means yes, and every accident means no.
 */

/**
 * @param trigger The control that opened the dialog. Focus goes back to it on
 *   close, rather than to whatever `document.activeElement` happened to be —
 *   Safari does not focus a button when it is clicked, so on a Mac the page
 *   would otherwise drop the caret at the top of the document on the way out.
 */
export function askConfirm(
	dialog: HTMLDialogElement,
	trigger: HTMLElement | null = null,
): Promise<boolean> {
	return new Promise((resolve) => {
		const listeners = new AbortController()
		const { signal } = listeners

		/* Clicking the backdrop is a click on the dialog element itself — the
		   panel is its only child and the element carries no padding, so an
		   event whose target is the dialog came from outside the card.

		   The press has to have started there too. Without that, selecting the
		   copy and releasing the mouse past the edge of the panel would count as
		   a click on the backdrop and shut the dialog mid-sentence. */
		let pressedOutside = false

		dialog.addEventListener(
			'mousedown',
			(event) => {
				pressedOutside = event.target === dialog
			},
			{ signal },
		)

		dialog.addEventListener(
			'click',
			(event) => {
				if (pressedOutside && event.target === dialog) dialog.close()
			},
			{ signal },
		)

		dialog.addEventListener(
			'close',
			() => {
				listeners.abort()
				trigger?.focus()
				resolve(dialog.returnValue === 'confirm')
			},
			{ signal },
		)

		/* returnValue survives from the last time the dialog was opened. Cleared
		   here so a second visit that is dismissed cannot answer 'confirm' with
		   the previous visit's word. */
		dialog.returnValue = ''
		dialog.showModal()
	})
}
