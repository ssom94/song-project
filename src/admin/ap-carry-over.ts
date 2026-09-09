import { getAuthenticatedAdminSession } from '../auth/session';
import { ensureDefaultApStudyPlan, nextApReview, type ApLearningState, type ApResult } from '../ap-study';
import { japanDateString } from '../jlpt-study';

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

function validResult(value: unknown): ApResult | null {
	return value === 'correct' || value === 'partial' || value === 'wrong' || value === 'completed' ? value : null;
}

function optionalScore(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : null;
}

export async function handleCompleteAdminApCarryOver(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	try {
		const session = await getAuthenticatedAdminSession(request, env.song_project_db);
		if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
		const plan = await ensureDefaultApStudyPlan(env.song_project_db, session.adminId);
		const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
		const itemId = Number(payload?.itemId);
		const result = validResult(payload?.result);
		if (!Number.isSafeInteger(itemId) || itemId <= 0 || !result) return json({ ok: false, error: 'INVALID_INPUT' }, 400);
		const score = optionalScore(payload?.score);
		const today = japanDateString();
		const item = await env.song_project_db.prepare(`
			SELECT i.id, i.session_id, i.topic_id, i.status, s.plan_id, s.study_date
			FROM ap_daily_items i
			JOIN ap_daily_sessions s ON s.id = i.session_id
			WHERE i.id = ?1 AND s.plan_id = ?2 AND s.study_date < ?3
			LIMIT 1
		`).bind(itemId, plan.id, today).first<{
			id: number; session_id: number; topic_id: number | null; status: string; plan_id: number; study_date: string;
		}>();
		if (!item) return json({ ok: false, error: 'ITEM_NOT_FOUND' }, 404);
		if (item.status === 'completed') return json({ ok: true, alreadyCompleted: true });
		const now = new Date().toISOString();
		const statements: D1PreparedStatement[] = [
			env.song_project_db.prepare(`
				UPDATE ap_daily_items
				SET status='completed', result=?2, score=?3, completed_at=?4, updated_at=?4
				WHERE id=?1
			`).bind(item.id, result, score, now),
			env.song_project_db.prepare(`
				INSERT INTO ap_study_attempts (plan_id, session_id, item_id, topic_id, result, score, created_at)
				VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
			`).bind(item.plan_id, item.session_id, item.id, item.topic_id, result, score, now),
		];
		if (item.topic_id) {
			const progress = await env.song_project_db.prepare(`
				SELECT learning_state, mastery_score, correct_count, partial_count, wrong_count, review_stage, first_studied_at
				FROM ap_topic_progress WHERE plan_id=?1 AND topic_id=?2 LIMIT 1
			`).bind(item.plan_id, item.topic_id).first<{
				learning_state: ApLearningState; mastery_score: number; correct_count: number; partial_count: number; wrong_count: number; review_stage: number; first_studied_at: string | null;
			}>();
			const review = nextApReview(Number(progress?.review_stage ?? 0), result, today);
			const delta = result === 'correct' ? 15 : result === 'partial' ? 5 : result === 'wrong' ? -20 : 5;
			const mastery = Math.max(0, Math.min(100, Number(progress?.mastery_score ?? 0) + delta));
			const state: ApLearningState = result === 'wrong' || result === 'partial'
				? 'uncertain'
				: mastery >= 80 && review.reviewStage >= 4 ? 'mastered' : review.state;
			statements.push(env.song_project_db.prepare(`
				UPDATE ap_topic_progress
				SET learning_state=?3, mastery_score=?4,
					correct_count=correct_count+CASE WHEN ?5='correct' THEN 1 ELSE 0 END,
					partial_count=partial_count+CASE WHEN ?5='partial' THEN 1 ELSE 0 END,
					wrong_count=wrong_count+CASE WHEN ?5='wrong' THEN 1 ELSE 0 END,
					review_stage=?6, first_studied_at=COALESCE(first_studied_at,?7), last_studied_at=?7,
					next_review_on=?8, updated_at=?7
				WHERE plan_id=?1 AND topic_id=?2
			`).bind(item.plan_id, item.topic_id, state, mastery, result, review.reviewStage, now, review.nextReviewOn));
		}
		await env.song_project_db.batch(statements);
		return json({ ok: true, studyDate: today, actualStudiedAt: now });
	} catch (error) {
		console.error('Failed to complete carried-over AP item', error);
		return json({ ok: false, error: 'AP_CARRY_OVER_COMPLETE_FAILED' }, 500);
	}
}
