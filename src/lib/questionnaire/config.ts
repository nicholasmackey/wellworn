/** The same-origin worker endpoint that validates and delivers a questionnaire. */
export const SUBMIT_ENDPOINT = '/api/questionnaire'

export const submissionsEnabled = SUBMIT_ENDPOINT.length > 0

/** The honeypot's field name, matching the one the contact form already uses. */
export const HONEYPOT_FIELD = '_gotcha'

/** Name of the token created by Cloudflare's widget. */
export const TURNSTILE_RESPONSE_FIELD = 'cf-turnstile-response'

/** Bound to the widget and checked again in Siteverify's response. */
export const TURNSTILE_ACTION = 'questionnaire'
