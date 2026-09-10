import { getAuthenticatedAdminSession } from '../../auth/session';

interface PlanRow {
	id: number;
}

interface WrongNoteRow {
	question_key: string;
	question_type: string;
	study_date: string;
	prompt: string;
	selected_answer: string | null;
	correct_answer: string;
	explanation: string | null;
	wrong_count: number;
	last_wrong_at: string;
	resolved_at: string | null;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function handleGetAdminJapaneseJlptWrongNotes(request: Request, env: Env): Promise<Response> {
	try {
		const auth = await getAuthenticatedAdminSession(request, env.song_project_db);
		if (!auth) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

		const url = new URL(request.url);
		const resolved = url.searchParams.get('resolved') === 'all' ? 'all' : 'open';
		const requestedLimit = Number(url.searchParams.get('limit') ?? 50);
		const limit = Number.isSafeInteger(requestedLimit) ? Math.max(1, Math.min(100, requestedLimit)) : 50;

		const plan = await env.song_project_db.prepare(`
			SELECT id
			FROM japanese_jlpt_study_plans
			WHERE admin_id = ?1 AND is_active = 1
			ORDER BY id ASC LIMIT 1
		`).bind(auth.adminId).first<PlanRow>();
		if (!plan) return json({ ok: true, items: [] });

		const statement = resolved === 'all'
			? env.song_project_db.prepare(`
				SELECT question_key, question_type, study_date, prompt, selected_answer,
					correct_answer, explanation, wrong_count, last_wrong_at, resolved_at
				FROM japanese_jlpt_wrong_notes
				WHERE admin_id = ?1 AND plan_id = ?2
				ORDER BY last_wrong_at DESC
				LIMIT ?3
			`).bind(auth.adminId, plan.id, limit)
			: env.song_project_db.prepare(`
				SELECT question_key, question_type, study_date, prompt, selected_answer,
					correct_answer, explanation, wrong_count, last_wrong_at, resolved_at
				FROM japanese_jlpt_wrong_notes
				WHERE admin_id = ?1 AND plan_id = ?2 AND resolved_at IS NULL
				ORDER BY last_wrong_at DESC
				LIMIT ?3
			`).bind(auth.adminId, plan.id, limit);

		const result = await statement.all<WrongNoteRow>();
		return json({
			ok: true,
			items: result.results.map((row) => ({
				questionKey: row.question_key,
				questionType: row.question_type,
				studyDate: row.study_date,
				prompt: row.prompt,
				selectedAnswer: row.selected_answer,
				correctAnswer: row.correct_answer,
				explanation: row.explanation,
				wrongCount: row.wrong_count,
				lastWrongAt: row.last_wrong_at,
				resolvedAt: row.resolved_at,
			})),
		});
	} catch (error) {
		console.error('Failed to load JLPT wrong notes', error);
		return json({ ok: false, error: 'JLPT_WRONG_NOTES_FAILED' }, 500);
	}
}
