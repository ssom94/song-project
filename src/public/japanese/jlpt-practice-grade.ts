import { getAuthenticatedAdminSession } from '../../auth/session';

interface PlanRow {
	id: number;
	study_start_date: string;
}

interface ContentRow {
	id: number;
	study_date: string;
	content_type: 'vocab_question' | 'grammar_question' | 'reading';
	payload_json: string;
}

interface RawQuestion {
	prompt?: unknown;
	options?: unknown;
	answer?: unknown;
	explanation?: unknown;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

function parseQuestionKey(value: unknown): { type: 'vocab' | 'grammar' | 'reading'; contentId: number; index: number | null } | null {
	if (typeof value !== 'string') return null;
	const match = value.match(/^(vocab|grammar|reading):(\d+)(?::(\d+))?$/);
	if (!match) return null;
	const contentId = Number(match[2]);
	const index = match[3] == null ? null : Number(match[3]);
	if (!Number.isSafeInteger(contentId) || contentId <= 0 || (index != null && (!Number.isSafeInteger(index) || index < 0))) return null;
	return { type: match[1] as 'vocab' | 'grammar' | 'reading', contentId, index };
}

function pickQuestion(row: ContentRow, index: number | null): RawQuestion | null {
	let payload: unknown;
	try { payload = JSON.parse(row.payload_json); } catch { return null; }
	if (!payload || typeof payload !== 'object') return null;
	if (row.content_type === 'reading' || index != null) {
		const questions = (payload as { questions?: unknown[] }).questions;
		if (!Array.isArray(questions) || index == null || index >= questions.length) return null;
		const question = questions[index];
		return question && typeof question === 'object' ? question as RawQuestion : null;
	}
	return payload as RawQuestion;
}

export async function handleGradePublicJapaneseJlptPractice(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	try {
		const auth = await getAuthenticatedAdminSession(request, env.song_project_db);
		if (!auth) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

		let payload: { questionKey?: unknown; selectedAnswer?: unknown };
		try {
			payload = await request.json() as { questionKey?: unknown; selectedAnswer?: unknown };
		} catch {
			return json({ ok: false, error: 'INVALID_JSON' }, 400);
		}
		const key = parseQuestionKey(payload.questionKey);
		const selectedAnswer = typeof payload.selectedAnswer === 'string' ? payload.selectedAnswer : null;
		if (!key || selectedAnswer == null) return json({ ok: false, error: 'INVALID_ANSWER' }, 400);

		const plan = await env.song_project_db.prepare(`
			SELECT id, study_start_date
			FROM japanese_jlpt_study_plans
			WHERE admin_id = ?1 AND is_active = 1
			ORDER BY id ASC LIMIT 1
		`).bind(auth.adminId).first<PlanRow>();
		if (!plan) return json({ ok: false, error: 'JLPT_STUDY_PLAN_NOT_FOUND' }, 404);

		const expectedType = key.type === 'vocab' ? 'vocab_question' : key.type === 'grammar' ? 'grammar_question' : 'reading';
		const row = await env.song_project_db.prepare(`
			SELECT id, study_date, content_type, payload_json
			FROM japanese_jlpt_daily_contents
			WHERE id = ?1 AND plan_id = ?2 AND content_type = ?3
			LIMIT 1
		`).bind(key.contentId, plan.id, expectedType).first<ContentRow>();
		if (!row || row.study_date < plan.study_start_date) return json({ ok: false, error: 'QUESTION_NOT_FOUND' }, 404);

		const question = pickQuestion(row, key.index);
		if (!question || typeof question.prompt !== 'string' || typeof question.answer !== 'string') return json({ ok: false, error: 'QUESTION_INVALID' }, 422);
		const options = Array.isArray(question.options) ? question.options.filter((option): option is string => typeof option === 'string') : [];
		if (options.length && !options.includes(selectedAnswer)) return json({ ok: false, error: 'ANSWER_NOT_IN_OPTIONS' }, 400);

		const correctAnswer = question.answer;
		const explanation = typeof question.explanation === 'string' ? question.explanation : '';
		const correct = selectedAnswer === correctAnswer;
		const now = new Date().toISOString();
		const questionKey = String(payload.questionKey);
		const studyDate = row.study_date;

		await env.song_project_db.prepare(`
			INSERT INTO japanese_jlpt_question_attempts
				(admin_id, plan_id, study_date, question_key, question_type, prompt, selected_answer, correct_answer, is_correct, attempted_at)
			VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
		`).bind(auth.adminId, plan.id, studyDate, questionKey, key.type, question.prompt, selectedAnswer, correctAnswer, correct ? 1 : 0, now).run();

		if (correct) {
			await env.song_project_db.prepare(`
				UPDATE japanese_jlpt_wrong_notes
				SET resolved_at = COALESCE(resolved_at, ?4), updated_at = ?4
				WHERE admin_id = ?1 AND plan_id = ?2 AND question_key = ?3 AND resolved_at IS NULL
			`).bind(auth.adminId, plan.id, questionKey, now).run();
		} else {
			await env.song_project_db.prepare(`
				INSERT INTO japanese_jlpt_wrong_notes
					(admin_id, plan_id, question_key, question_type, study_date, prompt, options_json, selected_answer, correct_answer, explanation, wrong_count, last_wrong_at, resolved_at, updated_at)
				VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, ?11, NULL, ?11)
				ON CONFLICT(admin_id, plan_id, question_key) DO UPDATE SET
					question_type = excluded.question_type,
					study_date = excluded.study_date,
					prompt = excluded.prompt,
					options_json = excluded.options_json,
					selected_answer = excluded.selected_answer,
					correct_answer = excluded.correct_answer,
					explanation = excluded.explanation,
					wrong_count = japanese_jlpt_wrong_notes.wrong_count + 1,
					last_wrong_at = excluded.last_wrong_at,
					resolved_at = NULL,
					updated_at = excluded.updated_at
			`).bind(auth.adminId, plan.id, questionKey, key.type, studyDate, question.prompt, JSON.stringify(options), selectedAnswer, correctAnswer, explanation, now).run();
		}

		return json({ ok: true, correct, correctAnswer, explanation });
	} catch (error) {
		console.error('Failed to grade historical JLPT practice', error);
		return json({ ok: false, error: 'JLPT_PRACTICE_GRADE_FAILED' }, 500);
	}
}
