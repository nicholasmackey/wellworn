import { withBase } from '../paths'

/** The same-origin worker endpoint that validates and delivers a questionnaire. */
export const SUBMIT_ENDPOINT =
	import.meta.env?.SITE === 'https://nicholasmackey.github.io'
		? ''
		: withBase('/api/questionnaire')

export const submissionsEnabled = SUBMIT_ENDPOINT.length > 0

/** The honeypot's field name, matching the one the contact form already uses. */
export const HONEYPOT_FIELD = '_gotcha'
