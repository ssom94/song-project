import { getAuthenticatedAdminSession } from '../../auth/session';
import { type JapaneseLearningState } from '../../japanese-learning';
import { japanDateString, nextReview, validDateText, type LearningProgressRow } from '../../jlpt-study';

interface PlanRow {
	id: number;
	study_start_date: string;
}

interface SessionRow {
	id: number;
	plan_id: number;
	study_date: string;
	review_target: number;
	new_word_target: number;
	vocab_question_target: number;
	grammar_target: number;
	reading_target: number;
	vocab_question_completed: number;
	grammar_completed: number;
	reading_completed: number;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

function learningState(value: unknown): JapaneseLearningState | null {
	return value === 'mastered' || value === 'uncertain' || value === 'unlearned' ? value : null;
}

async function refreshSession(db: D1Database, session: SessionRow, now: string): Promise<void> {
	const counts = await db.prepare(`
		SELECT
			SUM(CASE WHEN item_kind = 'review' AND status = 'completed' THEN 1 ELSE 0 END) AS review_completed,
			SUM(CASE WHEN item_kind = 'new' AND status = 'completed' THEN 1 ELSE 0 END) AS new_word_completed
		FROM japanese_jlpt_daily_words
		WHERE session_id = ?1
	`).bind(session.id).first<{ review_completed: number | null; new_word_completed: number | null }>();

	const reviewCompleted = Number(counts?.review_completed ?? 0);
	const newWordCompleted = Number(counts?.new_word_completed ?? 0);
	const finished = reviewCompleted >= session.review_target
		&& newWordCompleted >= session.new_word_target
		&& session.vocab_question_completed >= session.vocab_question_target
		&& session.grammar_completed >= session.grammar_target
		&& session.reading_completed >= session.reading_target;

	await db.prepare(`
		UPDATE japanese_jlpt_daily_sessions
		SET review_completed = ?2,
			new_word_completed = ?3,
			status = ?4,
			completed_at = CASE WHEN ?4 = 'completed' THEN COALESCE(completed_at, ?5) ELSE NULL END,
			updated_at = ?5
		WHERE id = ?1
	`).bind(session.id, reviewCompleted, newWordCompleted, finished ? 'completed' : 'in_progress', now).run();
}

async function getActivePlan(db: D1Database, adminId: number): Promise<PlanRow | null> {
	return db.prepare(`
		SELECT id, study_start_date
		FROM japanese_jlpt_study_plans
		WHERE admin_id = ?1 AND is_active = 1
		ORDER BY id ASC
		LIMIT 1
	`).bind(adminId).first<PlanRow>();
}

export async function handleCompleteAdminJapaneseJlptHistoricalWord(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	try {
		const auth = await getAuthenticatedAdminSession(request, env.song_project_db);
		if (!auth) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
		const plan = await getActivePlan(env.song_project_db, auth.adminId);
		if (!plan) return json({ ok: false, error: 'JLPT_STUDY_PLAN_NOT_FOUND' }, 404);

		let payload: { studyDate?: unknown; wordId?: unknown; state?: unknown };
		try {
			payload = await request.json() as { studyDate?: unknown; wordId?: unknown; state?: unknown };
		} catch {
			return json({ ok: false, error: 'INVALID_JSON' }, 400);
		}

		const studyDate = validDateText(payload.studyDate);
		const wordId = Number(payload.wordId);
		const state = learningState(payload.state);
		const today = japanDateString();
		if (!studyDate || studyDate < plan.study_start_date || studyDate > today) return json({ ok: false, error: 'INVALID_STUDY_DATE' }, 400);
		if (!Number.isSafeInteger(wordId) || wordId <= 0 || !state) return json({ ok: false, error: 'INVALID_WORD_STATE' }, 400);

		const historicalSession = await env.song_project_db.prepare(`
			SELECT id, plan_id, study_date, review_target, new_word_target,
				vocab_question_target, grammar_target, reading_target,
				vocab_question_completed, grammar_completed, reading_completed
			FROM japanese_jlpt_daily_sessions
			WHERE plan_id = ?1 AND study_date = ?2 LIMIT 1
		`).bind(plan.id, studyDate).first<SessionRow>();
		if (!historicalSession) return json({ ok: false, error: 'SESSION_NOT_FOUND' }, 404);

		const assigned = await env.song_project_db.prepare(`
			SELECT 1 AS found
			FROM japanese_jlpt_daily_words
			WHERE session_id = ?1 AND word_id = ?2
			LIMIT 1
		`).bind(historicalSession.id, wordId).first<{ found: number }>();
		if (!assigned) return json({ ok: false, error: 'WORD_NOT_IN_SESSION' }, 404);

		const current = await env.song_project_db.prepare(`
			SELECT learning_state, first_learned_at, last_studied_at, review_stage, next_review_on
			FROM japanese_admin_word_learning_stats
			WHERE admin_id = ?1 AND word_id = ?2 LIMIT 1
		`).bind(auth.adminId, wordId).first<LearningProgressRow>();

		const review = nextReview(current, state, today);
		const now = new Date().toISOString();
		await env.song_project_db.prepare(`
			INSERT INTO japanese_admin_word_learning_stats
				(admin_id, word_id, learning_state, first_learned_at, last_studied_at, review_stage, next_review_on, updated_at)
			VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?6, ?4)
			ON CONFLICT(admin_id, word_id) DO UPDATE SET
				learning_state = excluded.learning_state,
				first_learned_at = COALESCE(japanese_admin_word_learning_stats.first_learned_at, excluded.first_learned_at),
				last_studied_at = excluded.last_studied_at,
				review_stage = excluded.review_stage,
				next_review_on = excluded.next_review_on,
				updated_at = excluded.updated_at
		`).bind(auth.adminId, wordId, state, now, review.reviewStage, review.nextReviewOn).run();

		await env.song_project_db.prepare(`
			UPDATE japanese_jlpt_daily_words
			SET status = 'completed', state_after = ?3, completed_at = COALESCE(completed_at, ?4)
			WHERE session_id = ?1 AND word_id = ?2
		`).bind(historicalSession.id, wordId, state, now).run();
		await refreshSession(env.song_project_db, historicalSession, now);

		let todaySessionUpdated = false;
		if (studyDate !== today) {
			const todaySession = await env.song_project_db.prepare(`
				SELECT id, plan_id, study_date, review_target, new_word_target,
					vocab_question_target, grammar_target, reading_target,
					vocab_question_completed, grammar_completed, reading_completed
				FROM japanese_jlpt_daily_sessions
				WHERE plan_id = ?1 AND study_date = ?2 LIMIT 1
			`).bind(plan.id, today).first<SessionRow>();
			if (todaySession) {
				const result = await env.song_project_db.prepare(`
					UPDATE japanese_jlpt_daily_words
					SET status = 'completed', state_after = ?3, completed_at = COALESCE(completed_at, ?4)
					WHERE session_id = ?1 AND word_id = ?2 AND status = 'pending'
				`).bind(todaySession.id, wordId, state, now).run();
				todaySessionUpdated = Number(result.meta.changes ?? 0) > 0;
				if (todaySessionUpdated) await refreshSession(env.song_project_db, todaySession, now);
			}
		}

		return json({
			ok: true,
			studyDate,
			actualStudiedOn: today,
			wordId,
			state,
			reviewStage: review.reviewStage,
			nextReviewOn: review.nextReviewOn,
			todaySessionUpdated,
		});
	} catch (error) {
		console.error('Failed to complete historical JLPT word', error);
		return json({ ok: false, error: 'JLPT_HISTORICAL_WORD_UPDATE_FAILED' }, 500);
	}
}
