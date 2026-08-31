import { getAuthenticatedAdminSession } from '../auth/session';
import { ensureDefaultApStudyPlan, nextApReview, type ApStudyPlanRow } from '../ap-study';
import { japanDateString } from '../jlpt-study';

type QuizType = 'meaning' | 'reading' | 'context';
type SourceType = 'concept' | 'question' | 'manual';

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

async function authenticatedPlan(request: Request, env: Env): Promise<{ adminId: number; plan: ApStudyPlanRow } | Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	const plan = await ensureDefaultApStudyPlan(env.song_project_db, session.adminId);
	return { adminId: session.adminId, plan };
}

function text(value: unknown, max = 1000): string | null {
	if (typeof value !== 'string') return null;
	const normalized = value.trim();
	return normalized ? normalized.slice(0, max) : null;
}

function sourceType(value: unknown): SourceType {
	return value === 'concept' || value === 'question' ? value : 'manual';
}

function quizType(value: string | null): QuizType {
	return value === 'reading' || value === 'context' ? value : 'meaning';
}

export async function handleListAdminApVocabulary(request: Request, env: Env): Promise<Response> {
	try {
		const context = await authenticatedPlan(request, env);
		if (context instanceof Response) return context;
		const url = new URL(request.url);
		const query = (url.searchParams.get('q') ?? '').trim();
		const topic = (url.searchParams.get('topic') ?? '').trim();
		const state = (url.searchParams.get('state') ?? '').trim();
		const like = `%${query}%`;
		const result = await env.song_project_db.prepare(`
			SELECT v.id, v.term, v.reading, v.meaning_ko, v.meaning_ja, v.source_type, v.source_text, v.note,
				v.learning_state, v.review_stage, v.correct_count, v.wrong_count, v.first_seen_at,
				v.last_tested_at, v.next_review_on,
				t.topic_code, t.title_ko AS topic_title_ko, t.title_ja AS topic_title_ja
			FROM ap_vocabulary AS v
			LEFT JOIN ap_study_topics AS t ON t.id = v.topic_id
			WHERE v.plan_id = ?1
				AND (?2 = '' OR v.term LIKE ?5 OR COALESCE(v.reading, '') LIKE ?5 OR v.meaning_ko LIKE ?5 OR COALESCE(v.source_text, '') LIKE ?5)
				AND (?3 = '' OR t.topic_code = ?3)
				AND (?4 = '' OR v.learning_state = ?4)
			ORDER BY CASE v.learning_state WHEN 'uncertain' THEN 0 WHEN 'unlearned' THEN 1 WHEN 'learning' THEN 2 ELSE 3 END,
				v.wrong_count DESC, v.updated_at DESC
		`).bind(context.plan.id, query, topic, state, like).all();
		const due = await env.song_project_db.prepare(`
			SELECT COUNT(*) AS value FROM ap_vocabulary
			WHERE plan_id = ?1 AND next_review_on IS NOT NULL AND next_review_on <= ?2
		`).bind(context.plan.id, japanDateString()).first<{ value: number }>();
		return json({ ok: true, words: result.results, dueCount: Number(due?.value ?? 0) });
	} catch (error) {
		console.error('Failed to list AP vocabulary', error);
		return json({ ok: false, error: 'AP_VOCABULARY_LIST_FAILED' }, 500);
	}
}

export async function handleCreateAdminApVocabulary(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	try {
		const context = await authenticatedPlan(request, env);
		if (context instanceof Response) return context;
		const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
		const term = text(payload?.term, 200);
		const meaningKo = text(payload?.meaningKo, 1000);
		if (!term || !meaningKo) return json({ ok: false, error: 'TERM_AND_MEANING_REQUIRED' }, 400);
		const reading = text(payload?.reading, 300);
		const meaningJa = text(payload?.meaningJa, 1000);
		const sourceText = text(payload?.sourceText, 2000);
		const note = text(payload?.note, 2000);
		const topicCode = text(payload?.topicCode, 100);
		const topic = topicCode
			? await env.song_project_db.prepare(`SELECT id FROM ap_study_topics WHERE plan_id = ?1 AND topic_code = ?2 LIMIT 1`)
				.bind(context.plan.id, topicCode).first<{ id: number }>()
			: null;
		const now = new Date().toISOString();
		const existing = await env.song_project_db.prepare(`SELECT id FROM ap_vocabulary WHERE plan_id = ?1 AND term = ?2 LIMIT 1`)
			.bind(context.plan.id, term).first<{ id: number }>();
		if (existing) {
			await env.song_project_db.prepare(`
				UPDATE ap_vocabulary
				SET reading = COALESCE(?3, reading), meaning_ko = ?4, meaning_ja = COALESCE(?5, meaning_ja),
					topic_id = COALESCE(?6, topic_id), source_type = ?7,
					source_text = COALESCE(?8, source_text), note = COALESCE(?9, note), updated_at = ?10
				WHERE id = ?1 AND plan_id = ?2
			`).bind(existing.id, context.plan.id, reading, meaningKo, meaningJa, topic?.id ?? null, sourceType(payload?.sourceType), sourceText, note, now).run();
			return json({ ok: true, id: existing.id, duplicate: true });
		}
		const inserted = await env.song_project_db.prepare(`
			INSERT INTO ap_vocabulary
				(plan_id, topic_id, term, reading, meaning_ko, meaning_ja, source_type, source_text, note,
				 learning_state, review_stage, next_review_on, first_seen_at, created_at, updated_at)
			VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'unlearned', 0, ?10, ?11, ?11, ?11)
		`).bind(context.plan.id, topic?.id ?? null, term, reading, meaningKo, meaningJa, sourceType(payload?.sourceType), sourceText, note, japanDateString(), now).run();
		return json({ ok: true, id: Number(inserted.meta.last_row_id), duplicate: false }, 201);
	} catch (error) {
		console.error('Failed to create AP vocabulary', error);
		return json({ ok: false, error: 'AP_VOCABULARY_CREATE_FAILED' }, 500);
	}
}

export async function handleDeleteAdminApVocabulary(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	try {
		const context = await authenticatedPlan(request, env);
		if (context instanceof Response) return context;
		const id = Number(new URL(request.url).searchParams.get('id'));
		if (!Number.isSafeInteger(id) || id <= 0) return json({ ok: false, error: 'INVALID_ID' }, 400);
		await env.song_project_db.prepare(`DELETE FROM ap_vocabulary WHERE id = ?1 AND plan_id = ?2`).bind(id, context.plan.id).run();
		return json({ ok: true });
	} catch (error) {
		console.error('Failed to delete AP vocabulary', error);
		return json({ ok: false, error: 'AP_VOCABULARY_DELETE_FAILED' }, 500);
	}
}

export async function handleGetAdminApVocabularyQuiz(request: Request, env: Env): Promise<Response> {
	try {
		const context = await authenticatedPlan(request, env);
		if (context instanceof Response) return context;
		const url = new URL(request.url);
		const type = quizType(url.searchParams.get('type'));
		const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') ?? 10) || 10));
		const today = japanDateString();
		const condition = type === 'reading'
			? `AND v.reading IS NOT NULL AND TRIM(v.reading) <> ''`
			: type === 'context'
				? `AND v.source_text IS NOT NULL AND TRIM(v.source_text) <> ''`
				: '';
		const result = await env.song_project_db.prepare(`
			SELECT v.id, v.term, v.reading, v.meaning_ko, v.meaning_ja, v.source_text,
				v.learning_state, v.correct_count, v.wrong_count, v.next_review_on,
				t.topic_code, t.title_ko AS topic_title_ko, t.title_ja AS topic_title_ja
			FROM ap_vocabulary AS v
			LEFT JOIN ap_study_topics AS t ON t.id = v.topic_id
			WHERE v.plan_id = ?1 ${condition}
			ORDER BY
				CASE WHEN v.next_review_on IS NOT NULL AND v.next_review_on <= ?2 THEN 0 ELSE 1 END,
				CASE v.learning_state WHEN 'uncertain' THEN 0 WHEN 'unlearned' THEN 1 WHEN 'learning' THEN 2 ELSE 3 END,
				v.wrong_count DESC, COALESCE(v.last_tested_at, v.first_seen_at) ASC, RANDOM()
			LIMIT ?3
		`).bind(context.plan.id, today, limit).all();
		return json({ ok: true, type, words: result.results });
	} catch (error) {
		console.error('Failed to load AP vocabulary quiz', error);
		return json({ ok: false, error: 'AP_VOCABULARY_QUIZ_LOAD_FAILED' }, 500);
	}
}

export async function handleGradeAdminApVocabularyQuiz(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	try {
		const context = await authenticatedPlan(request, env);
		if (context instanceof Response) return context;
		const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
		const vocabularyId = Number(payload?.vocabularyId);
		const type = quizType(typeof payload?.quizType === 'string' ? payload.quizType : null);
		const result = payload?.result === 'correct' ? 'correct' : payload?.result === 'wrong' ? 'wrong' : null;
		if (!Number.isSafeInteger(vocabularyId) || vocabularyId <= 0 || !result) return json({ ok: false, error: 'INVALID_INPUT' }, 400);
		const word = await env.song_project_db.prepare(`
			SELECT id, review_stage FROM ap_vocabulary WHERE id = ?1 AND plan_id = ?2 LIMIT 1
		`).bind(vocabularyId, context.plan.id).first<{ id: number; review_stage: number }>();
		if (!word) return json({ ok: false, error: 'VOCABULARY_NOT_FOUND' }, 404);
		const today = japanDateString();
		const review = nextApReview(word.review_stage, result, today);
		const now = new Date().toISOString();
		await env.song_project_db.batch([
			env.song_project_db.prepare(`
				UPDATE ap_vocabulary
				SET learning_state = ?3, review_stage = ?4,
					correct_count = correct_count + CASE WHEN ?5 = 'correct' THEN 1 ELSE 0 END,
					wrong_count = wrong_count + CASE WHEN ?5 = 'wrong' THEN 1 ELSE 0 END,
					last_tested_at = ?6, next_review_on = ?7, updated_at = ?6
				WHERE id = ?1 AND plan_id = ?2
			`).bind(vocabularyId, context.plan.id, review.state, review.reviewStage, result, now, review.nextReviewOn),
			env.song_project_db.prepare(`
				INSERT INTO ap_vocabulary_quiz_attempts
					(plan_id, vocabulary_id, quiz_type, answer_text, result, created_at)
				VALUES (?1, ?2, ?3, ?4, ?5, ?6)
			`).bind(context.plan.id, vocabularyId, type, text(payload?.answerText, 1000), result, now),
		]);
		return json({ ok: true, nextReviewOn: review.nextReviewOn, state: review.state });
	} catch (error) {
		console.error('Failed to grade AP vocabulary quiz', error);
		return json({ ok: false, error: 'AP_VOCABULARY_QUIZ_GRADE_FAILED' }, 500);
	}
}
