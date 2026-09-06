/**
 * The four representations of one canonical submission.
 *
 * Nothing in this file accepts a request body or a questionnaire definition.
 * The normalized Submission is the only input, which makes it impossible for
 * one representation to quietly apply different validation or visibility
 * rules from another.
 */
import type { Submission, SubmittedAnswer } from './submission'

export interface SubmissionRenderings {
	readonly html: string
	readonly text: string
	readonly json: string
	readonly markdown: string
}

/** Escape every character with meaning in HTML, including both quote styles. */
export function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (character) => {
		switch (character) {
			case '&':
				return '&amp;'
			case '<':
				return '&lt;'
			case '>':
				return '&gt;'
			case '"':
				return '&quot;'
			default:
				return '&#39;'
		}
	})
}

/** Keep line breaks in long answers without allowing any markup through. */
const htmlValue = (value: string): string => escapeHtml(value).replace(/\n/g, '<br>')

const answerText = (answer: SubmittedAnswer): string =>
	answer.answered ? answer.display : 'Not answered'

function submittedLabel(iso: string): string {
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return iso

	return date.toLocaleString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		timeZone: 'UTC',
		timeZoneName: 'short',
	})
}

export function renderSubmissionHtml(submission: Submission): string {
	const { meta, sections, counts } = submission
	const sectionHtml = sections
		.map(
			(section) => `
				<section style="margin:36px 0 0;border-top:2px solid #1f211f;padding-top:18px">
					<h2 style="margin:0 0 20px;font:700 13px/1.3 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#1f211f">${escapeHtml(section.title)}</h2>
					${section.answers
						.map(
							(answer) => `
								<div style="margin:0 0 22px">
									<p style="margin:0 0 5px;font:700 14px/1.4 Arial,sans-serif;color:#5d625e">${escapeHtml(answer.label)}</p>
									<p style="margin:0;font:400 16px/1.55 Arial,sans-serif;color:#1f211f">${htmlValue(answerText(answer))}</p>
								</div>`,
						)
						.join('')}
				</section>`,
		)
		.join('')

	return `<!doctype html>
<html lang="en">
	<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
	<body style="margin:0;background:#f3f0e8;padding:24px 12px">
		<main style="max-width:680px;margin:0 auto;background:#fff;padding:36px 28px">
			<p style="margin:0;font:700 24px/1.1 Arial,sans-serif;text-transform:uppercase;color:#1f211f">${escapeHtml(meta.client)}</p>
			<h1 style="margin:8px 0 0;font:700 13px/1.3 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#5d625e">${escapeHtml(meta.title)}</h1>
			<p style="margin:20px 0 0;font:400 14px/1.5 Arial,sans-serif;color:#5d625e">Submitted ${escapeHtml(submittedLabel(meta.submittedAt))}<br>${counts.answered} of ${counts.asked} questions answered</p>
			${sectionHtml}
		</main>
	</body>
</html>`
}

export function renderSubmissionText(submission: Submission): string {
	const { meta, sections, counts } = submission
	const lines = [
		meta.client.toUpperCase(),
		meta.title,
		'',
		`Submitted: ${submittedLabel(meta.submittedAt)}`,
		`${counts.answered} of ${counts.asked} questions answered`,
	]

	for (const section of sections) {
		lines.push('', section.title.toUpperCase(), '')
		for (const answer of section.answers) {
			lines.push(answer.label, answerText(answer), '')
		}
	}

	return `${lines.join('\n').trimEnd()}\n`
}

/**
 * Escape Markdown punctuation and raw HTML while preserving ordinary prose and
 * line breaks. This keeps pasted client values from becoming headings, links,
 * or executable HTML in whichever Markdown viewer opens the transcript.
 */
export function escapeMarkdown(value: string): string {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/([`*_{}\[\]()#+.!|])/g, '\\$1')
		.replace(/(^|\n)(\s*)([-+])/g, '$1$2\\$3')
}

export function renderSubmissionMarkdown(submission: Submission): string {
	const { meta, sections, counts } = submission
	const lines = [
		`# ${escapeMarkdown(meta.client)}`,
		'',
		`## ${escapeMarkdown(meta.title)}`,
		'',
		`Submitted: ${escapeMarkdown(submittedLabel(meta.submittedAt))}`,
		'',
		`${counts.answered} of ${counts.asked} questions answered.`,
	]

	for (const section of sections) {
		lines.push('', `## ${escapeMarkdown(section.title)}`)
		for (const answer of section.answers) {
			lines.push(
				'',
				`**${escapeMarkdown(answer.label)}**`,
				'',
				escapeMarkdown(answerText(answer)),
			)
		}
	}

	return `${lines.join('\n').trimEnd()}\n`
}

export function renderSubmissionJson(submission: Submission): string {
	return `${JSON.stringify(submission, null, 2)}\n`
}

export function renderSubmission(submission: Submission): SubmissionRenderings {
	return {
		html: renderSubmissionHtml(submission),
		text: renderSubmissionText(submission),
		json: renderSubmissionJson(submission),
		markdown: renderSubmissionMarkdown(submission),
	}
}
