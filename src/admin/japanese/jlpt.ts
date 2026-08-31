import { getAuthenticatedAdminSession } from '../../auth/session';
import { type JapaneseLearningState } from '../../japanese-learning';
import {
	enrollWordsInJlptPlan,
	ensureDefaultJlptStudyPlan,
	japanDateString,
	nextReview,
	validDateText,
	type LearningProgressRow,
	type JlptStudyPlanRow,
} from '../../jlpt-study';

type DailyWordKind = 'review' | 'new';
type DailySection = 'vocabQuestions' | 'grammar' | 'reading';
type ContentType = 'vocab_question' | 'grammar' | 'grammar_question' | 'reading';

interface DailySessionRow {
	id: number;
	plan_id: number;
	study_date: string;
	review_target: number;
	new_word_target: number;
	vocab_question_target: number;
	grammar_target: number;
	reading_target: number;
	review_completed: number;
	new_word_completed: number;
	vocab_question_completed: number;
	grammar_completed: number;
	reading_completed: number;
	status: 'not_started' | 'in_progress' | 'completed';
	started_at: string | null;
	completed_at: string | null;
}

interface DailyWordRow {
	id: number;
	word: string;
	reading: string | null;
	meaning_ko: string | null;
	meaning_ja: string | null;
	item_kind: DailyWordKind;
	item_status: 'pending' | 'completed';
	learning_state: JapaneseLearningState;
	review_stage: number;
	next_review_on: string | null;
}

interface CarryoverRow {
	word_id: number;
	item_kind: DailyWordKind;
	learning_state: JapaneseLearningState | null;
}

interface DueWordRow {
	word_id: number;
	learning_state: JapaneseLearningState;
}

interface NewWordRow {
	word_id: number;
	learning_state: JapaneseLearningState | null;
}

interface ContentRow {
	id: number;
	content_type: ContentType;
	sequence_no: number;
	title: string | null;
	payload_json: string;
	completed_at: string | null;
}

interface CurriculumLookupRow {
	id: number;
	word: string;
	jlpt_code: string | null;
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

function sectionName(value: unknown): DailySection | null {
	return value === 'vocabQuestions' || value === 'grammar' || value === 'reading' ? value : null;
}

function contentType(value: unknown): ContentType | null {
	return value === 'vocab_question' || value === 'grammar' || value === 'grammar_question' || value === 'reading' ? value : null;
}

function safePayload(value: string): unknown {
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}

async function authenticatedPlan(request: Request, env: Env): Promise<{ adminId: number; plan: JlptStudyPlanRow } | Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	const plan = await ensureDefaultJlptStudyPlan(env.song_project_db, session.adminId);
	return { adminId: session.adminId, plan };
}

async function getDailySession(db: D1Database, planId: number, studyDate: string): Promise<DailySessionRow | null> {
	return db.prepare(`
		SELECT id, plan_id, study_date, review_target, new_word_target, vocab_question_target, grammar_target,
			reading_target, review_completed, new_word_completed, vocab_question_completed, grammar_completed,
			reading_completed, status, started_at, completed_at
		FROM japanese_jlpt_daily_sessions
		WHERE plan_id = ?1 AND study_date = ?2
		LIMIT 1
	`).bind(planId, studyDate).first<DailySessionRow>();
}

async function loadDailyWords(db: D1Database, adminId: number, sessionId: number): Promise<DailyWordRow[]> {
	const result = await db.prepare(`
		SELECT w.id, w.word, w.reading, w.meaning_ko, w.meaning_ja,
			dw.item_kind, dw.status AS item_status,
			COALESCE(s.learning_state, 'unlearned') AS learning_state,
			COALESCE(s.review_stage, 0) AS review_stage,
			s.next_review_on
		FROM japanese_jlpt_daily_words AS dw
		JOIN japanese_words AS w ON w.id = dw.word_id AND w.deleted_at IS NULL
		LEFT JOIN japanese_admin_word_learning_stats AS s
			ON s.word_id = w.id AND s.admin_id = ?2
		WHERE dw.session_id = ?1
		ORDER BY CASE dw.item_kind WHEN 'review' THEN 0 ELSE 1 END, w.id ASC
	`).bind(sessionId, adminId).all<DailyWordRow>();
	return result.results;
}

async function loadDailyContents(db: D1Database, planId: number, studyDate: string) {
	const result = await db.prepare(`
		SELECT id, content_type, sequence_no, title, payload_json, completed_at
		FROM japanese_jlpt_daily_contents
		WHERE plan_id = ?1 AND study_date = ?2
		ORDER BY CASE content_type
			WHEN 'vocab_question' THEN 0
			WHEN 'grammar' THEN 1
			WHEN 'grammar_question' THEN 2
			ELSE 3 END,
			sequence_no ASC
	`).bind(planId, studyDate).all<ContentRow>();
	return result.results.map((row) => ({
		id: row.id,
		type: row.content_type,
		sequence: row.sequence_no,
		title: row.title,
		payload: safePayload(row.payload_json),
		completed: Boolean(row.completed_at),
	}));
}

async function refreshWordCountsAndSessionStatus(db: D1Database, session: DailySessionRow): Promise<DailySessionRow> {
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
	const now = new Date().toISOString();
	await db.prepare(`
		UPDATE japanese_jlpt_daily_sessions
		SET review_completed = ?2,
			new_word_completed = ?3,
			status = ?4,
			completed_at = CASE WHEN ?4 = 'completed' THEN COALESCE(completed_at, ?5) ELSE NULL END,
			updated_at = ?5
		WHERE id = ?1
	`).bind(session.id, reviewCompleted, newWordCompleted, finished ? 'completed' : 'in_progress', now).run();
	return (await getDailySession(db, session.plan_id, session.study_date)) ?? session;
}

async function startSession(db: D1Database, adminId: number, plan: JlptStudyPlanRow, studyDate: string): Promise<DailySessionRow> {
	const now = new Date().toISOString();
	await db.prepare(`
		INSERT OR IGNORE INTO japanese_jlpt_daily_sessions
			(plan_id, study_date, review_target, new_word_target, vocab_question_target, grammar_target, reading_target,
			 status, started_at, created_at, updated_at)
		VALUES (?1, ?2, 0, 0, ?3, ?4, ?5, 'in_progress', ?6, ?6, ?6)
	`).bind(plan.id, studyDate, plan.vocab_question_target, plan.grammar_target, plan.reading_target, now).run();
	let session = await getDailySession(db, plan.id, studyDate);
	if (!session) throw new Error('JLPT_SESSION_CREATE_FAILED');

	await db.prepare(`
		UPDATE japanese_jlpt_daily_sessions
		SET status = CASE WHEN status = 'completed' THEN status ELSE 'in_progress' END,
			started_at = COALESCE(started_at, ?2), updated_at = ?2
		WHERE id = ?1
	`).bind(session.id, now).run();

	const carryover = await db.prepare(`
		SELECT dw.word_id, dw.item_kind, s.learning_state
		FROM japanese_jlpt_daily_words AS dw
		JOIN japanese_jlpt_daily_sessions AS old_session ON old_session.id = dw.session_id
		LEFT JOIN japanese_admin_word_learning_stats AS s
			ON s.word_id = dw.word_id AND s.admin_id = ?2
		WHERE old_session.plan_id = ?1
			AND old_session.study_date < ?3
			AND dw.status = 'pending'
		ORDER BY old_session.study_date ASC,
			CASE dw.item_kind WHEN 'review' THEN 0 ELSE 1 END,
			dw.word_id ASC
	`).bind(plan.id, adminId, studyDate).all<CarryoverRow>();

	const reviewIds = new Map<number, JapaneseLearningState>();
	const newIds = new Map<number, JapaneseLearningState>();
	for (const row of carryover.results) {
		const state = row.learning_state ?? 'unlearned';
		if (row.item_kind === 'review') reviewIds.set(row.word_id, state);
		else if (newIds.size < plan.daily_new_word_target) newIds.set(row.word_id, state);
	}

	const due = await db.prepare(`
		SELECT c.word_id, s.learning_state
		FROM japanese_jlpt_curriculum_words AS c
		JOIN japanese_admin_word_learning_stats AS s
			ON s.word_id = c.word_id AND s.admin_id = ?2
		WHERE c.plan_id = ?1
			AND s.first_learned_at IS NOT NULL
			AND s.next_review_on IS NOT NULL
			AND s.next_review_on <= ?3
		ORDER BY s.next_review_on ASC, c.sort_order ASC
	`).bind(plan.id, adminId, studyDate).all<DueWordRow>();
	for (const row of due.results) reviewIds.set(row.word_id, row.learning_state);
	for (const wordId of reviewIds.keys()) newIds.delete(wordId);

	const remainingNew = Math.max(0, plan.daily_new_word_target - newIds.size);
	if (remainingNew > 0) {
		const fresh = await db.prepare(`
			SELECT c.word_id, s.learning_state
			FROM japanese_jlpt_curriculum_words AS c
			LEFT JOIN japanese_admin_word_learning_stats AS s
				ON s.word_id = c.word_id AND s.admin_id = ?2
			WHERE c.plan_id = ?1
				AND (c.introduced_on IS NULL OR c.introduced_on <= ?3)
				AND s.first_learned_at IS NULL
				AND NOT EXISTS (
					SELECT 1 FROM japanese_jlpt_daily_words AS current_words
					WHERE current_words.session_id = ?4 AND current_words.word_id = c.word_id
				)
			ORDER BY CASE WHEN c.introduced_on = ?3 THEN 0 ELSE 1 END, c.sort_order ASC
			LIMIT ?5
		`).bind(plan.id, adminId, studyDate, session.id, remainingNew).all<NewWordRow>();
		for (const row of fresh.results) {
			if (!reviewIds.has(row.word_id)) newIds.set(row.word_id, row.learning_state ?? 'unlearned');
		}
	}

	const statements: D1PreparedStatement[] = [];
	for (const [wordId, state] of reviewIds) {
		statements.push(db.prepare(`
			INSERT OR IGNORE INTO japanese_jlpt_daily_words
				(session_id, word_id, item_kind, state_before, created_at)
			VALUES (?1, ?2, 'review', ?3, ?4)
		`).bind(session.id, wordId, state, now));
	}
	for (const [wordId, state] of newIds) {
		statements.push(db.prepare(`
			INSERT OR IGNORE INTO japanese_jlpt_daily_words
				(session_id, word_id, item_kind, state_before, created_at)
			VALUES (?1, ?2, 'new', ?3, ?4)
		`).bind(session.id, wordId, state, now));
	}
	if (statements.length) await db.batch(statements);

	const assigned = await db.prepare(`
		SELECT
			SUM(CASE WHEN item_kind = 'review' THEN 1 ELSE 0 END) AS review_target,
			SUM(CASE WHEN item_kind = 'new' THEN 1 ELSE 0 END) AS new_target
		FROM japanese_jlpt_daily_words
		WHERE session_id = ?1
	`).bind(session.id).first<{ review_target: number | null; new_target: number | null }>();
	await db.prepare(`
		UPDATE japanese_jlpt_daily_sessions
		SET review_target = ?2,
			new_word_target = ?3,
			vocab_question_target = ?4,
			grammar_target = ?5,
			reading_target = ?6,
			updated_at = ?7
		WHERE id = ?1
	`).bind(
		session.id,
		Number(assigned?.review_target ?? 0),
		Number(assigned?.new_target ?? 0),
		plan.vocab_question_target,
		plan.grammar_target,
		plan.reading_target,
		now,
	).run();
	session = (await getDailySession(db, plan.id, studyDate)) ?? session;
	return session;
}

export async function handleStartAdminJapaneseJlptToday(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	try {
		const context = await authenticatedPlan(request, env);
		if (context instanceof Response) return context;
		const today = japanDateString();
		if (today < context.plan.study_start_date) {
			return json({ ok: false, error: 'STUDY_NOT_STARTED', studyStartDate: context.plan.study_start_date }, 409);
		}
		const session = await startSession(env.song_project_db, context.adminId, context.plan, today);
		const [words, contents] = await Promise.all([
			loadDailyWords(env.song_project_db, context.adminId, session.id),
			loadDailyContents(env.song_project_db, context.plan.id, today),
		]);
		return json({ ok: true, studyDate: today, session, words, contents });
	} catch (error) {
		console.error('Failed to start JLPT daily study', error);
		return json({ ok: false, error: 'JLPT_DAILY_START_FAILED' }, 500);
	}
}

export async function handleGetAdminJapaneseJlptToday(request: Request, env: Env): Promise<Response> {
	try {
		const context = await authenticatedPlan(request, env);
		if (context instanceof Response) return context;
		const today = japanDateString();
		const session = await getDailySession(env.song_project_db, context.plan.id, today);
		if (!session) return json({ ok: true, studyDate: today, session: null, words: [], contents: [] });
		const [words, contents] = await Promise.all([
			loadDailyWords(env.song_project_db, context.adminId, session.id),
			loadDailyContents(env.song_project_db, context.plan.id, today),
		]);
		return json({ ok: true, studyDate: today, session, words, contents });
	} catch (error) {
		console.error('Failed to get JLPT daily study', error);
		return json({ ok: false, error: 'JLPT_DAILY_LOAD_FAILED' }, 500);
	}
}

export async function handleUpdateAdminJapaneseJlptWordState(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	try {
		const context = await authenticatedPlan(request, env);
		if (context instanceof Response) return context;
		let payload: { wordId?: unknown; state?: unknown };
		try {
			payload = await request.json() as { wordId?: unknown; state?: unknown };
		} catch {
			return json({ ok: false, error: 'INVALID_JSON' }, 400);
		}
		const wordId = Number(payload.wordId);
		const state = learningState(payload.state);
		if (!Number.isSafeInteger(wordId) || wordId <= 0 || !state) return json({ ok: false, error: 'INVALID_WORD_STATE' }, 400);

		const enrolled = await env.song_project_db.prepare(`
			SELECT 1 AS found FROM japanese_jlpt_curriculum_words
			WHERE plan_id = ?1 AND word_id = ?2 LIMIT 1
		`).bind(context.plan.id, wordId).first<{ found: number }>();
		if (!enrolled) return json({ ok: false, error: 'WORD_NOT_IN_CURRICULUM' }, 404);

		const current = await env.song_project_db.prepare(`
			SELECT learning_state, first_learned_at, last_studied_at, review_stage, next_review_on
			FROM japanese_admin_word_learning_stats
			WHERE admin_id = ?1 AND word_id = ?2 LIMIT 1
		`).bind(context.adminId, wordId).first<LearningProgressRow>();
		const today = japanDateString();
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
		`).bind(context.adminId, wordId, state, now, review.reviewStage, review.nextReviewOn).run();

		const session = await getDailySession(env.song_project_db, context.plan.id, today);
		let refreshed = session;
		if (session) {
			await env.song_project_db.prepare(`
				UPDATE japanese_jlpt_daily_words
				SET status = 'completed', state_after = ?3, completed_at = ?4
				WHERE session_id = ?1 AND word_id = ?2
			`).bind(session.id, wordId, state, now).run();
			refreshed = await refreshWordCountsAndSessionStatus(env.song_project_db, session);
		}
		return json({
			ok: true,
			wordId,
			state,
			reviewStage: review.reviewStage,
			nextReviewOn: review.nextReviewOn,
			session: refreshed,
		});
	} catch (error) {
		console.error('Failed to update JLPT word state', error);
		return json({ ok: false, error: 'JLPT_WORD_STATE_UPDATE_FAILED' }, 500);
	}
}

export async function handleUpdateAdminJapaneseJlptProgress(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	try {
		const context = await authenticatedPlan(request, env);
		if (context instanceof Response) return context;
		let payload: { section?: unknown; completed?: unknown };
		try {
			payload = await request.json() as { section?: unknown; completed?: unknown };
		} catch {
			return json({ ok: false, error: 'INVALID_JSON' }, 400);
		}
		const section = sectionName(payload.section);
		const completed = Number(payload.completed);
		if (!section || !Number.isSafeInteger(completed) || completed < 0) return json({ ok: false, error: 'INVALID_PROGRESS' }, 400);
		const today = japanDateString();
		const session = await getDailySession(env.song_project_db, context.plan.id, today);
		if (!session) return json({ ok: false, error: 'SESSION_NOT_STARTED' }, 409);
		const map = {
			vocabQuestions: { column: 'vocab_question_completed', target: session.vocab_question_target },
			grammar: { column: 'grammar_completed', target: session.grammar_target },
			reading: { column: 'reading_completed', target: session.reading_target },
		} as const;
		const target = map[section];
		const value = Math.min(target.target, completed);
		const now = new Date().toISOString();
		await env.song_project_db.prepare(`UPDATE japanese_jlpt_daily_sessions SET ${target.column} = ?2, updated_at = ?3 WHERE id = ?1`)
			.bind(session.id, value, now).run();
		const after = (await getDailySession(env.song_project_db, context.plan.id, today)) ?? session;
		const refreshed = await refreshWordCountsAndSessionStatus(env.song_project_db, after);
		return json({ ok: true, session: refreshed });
	} catch (error) {
		console.error('Failed to update JLPT daily progress', error);
		return json({ ok: false, error: 'JLPT_PROGRESS_UPDATE_FAILED' }, 500);
	}
}

export async function handleEnrollAdminJapaneseJlptWords(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	try {
		const context = await authenticatedPlan(request, env);
		if (context instanceof Response) return context;
		let payload: { wordIds?: unknown; words?: unknown; introducedOn?: unknown };
		try {
			payload = await request.json() as { wordIds?: unknown; words?: unknown; introducedOn?: unknown };
		} catch {
			return json({ ok: false, error: 'INVALID_JSON' }, 400);
		}
		const ids = Array.isArray(payload.wordIds)
			? payload.wordIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0)
			: [];
		const words = Array.isArray(payload.words)
			? payload.words.map((value) => String(value ?? '').normalize('NFKC').trim()).filter(Boolean).slice(0, 200)
			: [];
		if (!ids.length && !words.length) return json({ ok: false, error: 'WORDS_REQUIRED' }, 400);
		const introducedOn = validDateText(payload.introducedOn) ?? japanDateString();
		const lookupRows: CurriculumLookupRow[] = [];
		for (const id of [...new Set(ids)].slice(0, 200)) {
			const row = await env.song_project_db.prepare(`
				SELECT w.id, w.word, l.code AS jlpt_code
				FROM japanese_words AS w
				LEFT JOIN jlpt_levels AS l ON l.id = w.jlpt_level_id
				WHERE w.id = ?1 AND w.deleted_at IS NULL LIMIT 1
			`).bind(id).first<CurriculumLookupRow>();
			if (row) lookupRows.push(row);
		}
		const missingWords: string[] = [];
		for (const word of [...new Set(words)]) {
			const row = await env.song_project_db.prepare(`
				SELECT w.id, w.word, l.code AS jlpt_code
				FROM japanese_words AS w
				LEFT JOIN jlpt_levels AS l ON l.id = w.jlpt_level_id
				WHERE w.word = ?1 COLLATE NOCASE AND w.deleted_at IS NULL
				ORDER BY w.id ASC LIMIT 1
			`).bind(word).first<CurriculumLookupRow>();
			if (row) lookupRows.push(row);
			else missingWords.push(word);
		}
		const uniqueRows = [...new Map(lookupRows.map((row) => [row.id, row])).values()];
		const accepted = uniqueRows.filter((row) => row.jlpt_code === context.plan.jlpt_level_code);
		const rejected = uniqueRows.filter((row) => row.jlpt_code !== context.plan.jlpt_level_code);
		const result = await enrollWordsInJlptPlan(env.song_project_db, context.plan.id, accepted.map((row) => row.id), introducedOn);
		return json({
			ok: true,
			introducedOn,
			added: result.added,
			already: result.already,
			enrolled: accepted.map((row) => ({ id: row.id, word: row.word })),
			missingWords,
			rejected: rejected.map((row) => ({ id: row.id, word: row.word, jlpt: row.jlpt_code })),
		});
	} catch (error) {
		console.error('Failed to enroll JLPT curriculum words', error);
		return json({ ok: false, error: 'JLPT_CURRICULUM_ENROLL_FAILED' }, 500);
	}
}

export async function handleImportAdminJapaneseJlptContent(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	try {
		const context = await authenticatedPlan(request, env);
		if (context instanceof Response) return context;
		let payload: { studyDate?: unknown; items?: unknown };
		try {
			payload = await request.json() as { studyDate?: unknown; items?: unknown };
		} catch {
			return json({ ok: false, error: 'INVALID_JSON' }, 400);
		}
		const studyDate = validDateText(payload.studyDate) ?? japanDateString();
		if (!Array.isArray(payload.items) || payload.items.length > 300) return json({ ok: false, error: 'INVALID_CONTENT_ITEMS' }, 400);
		const counters = new Map<ContentType, number>();
		const normalized: Array<{ type: ContentType; sequence: number; title: string | null; payload: unknown }> = [];
		for (const raw of payload.items) {
			const item = raw as { type?: unknown; sequence?: unknown; title?: unknown; payload?: unknown };
			const type = contentType(item.type);
			if (!type || item.payload === undefined) return json({ ok: false, error: 'INVALID_CONTENT_ITEM' }, 400);
			const fallbackSequence = (counters.get(type) ?? 0) + 1;
			const requestedSequence = Number(item.sequence);
			const sequence = Number.isSafeInteger(requestedSequence) && requestedSequence > 0 ? requestedSequence : fallbackSequence;
			counters.set(type, Math.max(fallbackSequence, sequence));
			const title = typeof item.title === 'string' ? item.title.trim().slice(0, 300) || null : null;
			const serialized = JSON.stringify(item.payload);
			if (serialized.length > 50_000) return json({ ok: false, error: 'CONTENT_PAYLOAD_TOO_LARGE' }, 400);
			normalized.push({ type, sequence, title, payload: item.payload });
		}
		const now = new Date().toISOString();
		const statements = normalized.map((item) => env.song_project_db.prepare(`
			INSERT INTO japanese_jlpt_daily_contents
				(plan_id, study_date, content_type, sequence_no, title, payload_json, created_at, updated_at)
			VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
			ON CONFLICT(plan_id, study_date, content_type, sequence_no) DO UPDATE SET
				title = excluded.title,
				payload_json = excluded.payload_json,
				completed_at = NULL,
				updated_at = excluded.updated_at
		`).bind(context.plan.id, studyDate, item.type, item.sequence, item.title, JSON.stringify(item.payload), now));
		if (statements.length) await env.song_project_db.batch(statements);
		return json({ ok: true, studyDate, imported: normalized.length });
	} catch (error) {
		console.error('Failed to import JLPT daily content', error);
		return json({ ok: false, error: 'JLPT_CONTENT_IMPORT_FAILED' }, 500);
	}
}

export async function handleCompleteAdminJapaneseJlptContent(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	try {
		const context = await authenticatedPlan(request, env);
		if (context instanceof Response) return context;
		let payload: { contentId?: unknown; completed?: unknown };
		try {
			payload = await request.json() as { contentId?: unknown; completed?: unknown };
		} catch {
			return json({ ok: false, error: 'INVALID_JSON' }, 400);
		}
		const contentId = Number(payload.contentId);
		if (!Number.isSafeInteger(contentId) || contentId <= 0 || typeof payload.completed !== 'boolean') {
			return json({ ok: false, error: 'INVALID_CONTENT_PROGRESS' }, 400);
		}
		const today = japanDateString();
		const row = await env.song_project_db.prepare(`
			SELECT id, content_type FROM japanese_jlpt_daily_contents
			WHERE id = ?1 AND plan_id = ?2 AND study_date = ?3 LIMIT 1
		`).bind(contentId, context.plan.id, today).first<{ id: number; content_type: ContentType }>();
		if (!row) return json({ ok: false, error: 'CONTENT_NOT_FOUND' }, 404);
		const now = new Date().toISOString();
		await env.song_project_db.prepare(`
			UPDATE japanese_jlpt_daily_contents
			SET completed_at = ?2, updated_at = ?3
			WHERE id = ?1
		`).bind(contentId, payload.completed ? now : null, now).run();
		const session = await getDailySession(env.song_project_db, context.plan.id, today);
		if (session) {
			const counts = await env.song_project_db.prepare(`
				SELECT content_type, COUNT(*) AS completed
				FROM japanese_jlpt_daily_contents
				WHERE plan_id = ?1 AND study_date = ?2 AND completed_at IS NOT NULL
				GROUP BY content_type
			`).bind(context.plan.id, today).all<{ content_type: ContentType; completed: number }>();
			const byType = new Map(counts.results.map((item) => [item.content_type, Number(item.completed)]));
			await env.song_project_db.prepare(`
				UPDATE japanese_jlpt_daily_sessions
				SET vocab_question_completed = MIN(vocab_question_target, ?2),
					grammar_completed = MIN(grammar_target, ?3),
					reading_completed = MIN(reading_target, ?4),
					updated_at = ?5
				WHERE id = ?1
			`).bind(
				session.id,
				byType.get('vocab_question') ?? 0,
				byType.get('grammar') ?? 0,
				byType.get('reading') ?? 0,
				now,
			).run();
			const after = (await getDailySession(env.song_project_db, context.plan.id, today)) ?? session;
			await refreshWordCountsAndSessionStatus(env.song_project_db, after);
		}
		return json({ ok: true, contentId, completed: payload.completed });
	} catch (error) {
		console.error('Failed to complete JLPT content', error);
		return json({ ok: false, error: 'JLPT_CONTENT_PROGRESS_FAILED' }, 500);
	}
}