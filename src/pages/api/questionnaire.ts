/** POST /api/questionnaire — the site's only on-demand Worker route. */
import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'
import { getSecret } from 'astro:env/server'
import {
	handleQuestionnairePost,
	methodNotAllowed,
} from '../../lib/questionnaire/server'
import type { Questionnaire } from '../../lib/questionnaire/schema'

export const prerender = false

export const POST: APIRoute = (context) =>
	handleQuestionnairePost(context, {
		getSecret,
		loadQuestionnaire: async (token, id) => {
			const entries = await getCollection('questionnaires')
			const entry = entries.find(
				(candidate) => candidate.data.token === token && candidate.data.id === id,
			)
			return entry ? (entry.data as Questionnaire) : null
		},
	})

export const ALL: APIRoute = ({ request }) =>
	request.method === 'POST'
		? new Response(JSON.stringify({ ok: false, error: 'Unreachable.' }), {
				status: 500,
				headers: {
					'content-type': 'application/json; charset=utf-8',
					'cache-control': 'no-store',
				},
			})
		: methodNotAllowed()
