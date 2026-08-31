import { ensureDefaultApStudyPlan, type ApStudyPlanRow } from '../ap-study';
import { getAuthenticatedAdminSession } from '../auth/session';

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function authenticatedPlan(request: Request, env: Env): Promise<{ adminId: number; plan: ApStudyPlanRow } | Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	const plan = await ensureDefaultApStudyPlan(env.song_project_db, session.adminId);
	return { adminId: session.adminId, plan };
}

export async function handleListAdminApVocabularyWrongNotes(request: Request, env: Env): Promise<Response> {
	try {
		const context = await authenticatedPlan(request, env);
		if (context instanceof Response) return context;
		const result = await env.song_project_db.prepare(`
			SELECT v.id, v.term, v.reading, v.meaning_ko, v.meaning_ja, v.source_text, v.note,
				v.learning_state, v.correct_count, v.wrong_count, v.next_review_on,
				t.topic_code, t.title_ko AS topic_title_ko, t.title_ja AS topic_title_ja,
				MAX(a.created_at) AS last_wrong_at,
				(
					SELECT a2.answer_text
					FROM ap_vocabulary_quiz_attempts AS a2
					WHERE a2.plan_id = v.plan_id AND a2.vocabulary_id = v.id AND a2.result = 'wrong'
					ORDER BY a2.created_at DESC, a2.id DESC
					LIMIT 1
				) AS last_wrong_answer,
				(
					SELECT a3.quiz_type
					FROM ap_vocabulary_quiz_attempts AS a3
					WHERE a3.plan_id = v.plan_id AND a3.vocabulary_id = v.id AND a3.result = 'wrong'
					ORDER BY a3.created_at DESC, a3.id DESC
					LIMIT 1
				) AS last_wrong_quiz_type
			FROM ap_vocabulary AS v
			JOIN ap_vocabulary_quiz_attempts AS a
				ON a.plan_id = v.plan_id AND a.vocabulary_id = v.id AND a.result = 'wrong'
			LEFT JOIN ap_study_topics AS t ON t.id = v.topic_id
			WHERE v.plan_id = ?1
			GROUP BY v.id, v.term, v.reading, v.meaning_ko, v.meaning_ja, v.source_text, v.note,
				v.learning_state, v.correct_count, v.wrong_count, v.next_review_on,
				t.topic_code, t.title_ko, t.title_ja
			ORDER BY last_wrong_at DESC, v.wrong_count DESC, v.term ASC
		`).bind(context.plan.id).all();
		return json({ ok: true, notes: result.results, count: result.results.length });
	} catch (error) {
		console.error('Failed to list AP vocabulary wrong notes', error);
		return json({ ok: false, error: 'AP_VOCABULARY_WRONG_NOTES_FAILED' }, 500);
	}
}
