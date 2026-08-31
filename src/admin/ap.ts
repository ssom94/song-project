import { getAuthenticatedAdminSession } from '../auth/session';
import {
	apPlanCountdown,
	buildApDailyBudget,
	ensureDefaultApStudyPlan,
	nextApReview,
	type ApItemKind,
	type ApLearningState,
	type ApResult,
	type ApStudyPlanRow,
} from '../ap-study';
import { japanDateString } from '../jlpt-study';

interface TopicRow {
	id: number;
	topic_code: string;
	exam_part: 'A' | 'B' | 'AB';
	domain_code: string;
	title_ko: string;
	title_ja: string;
	study_points_ko: string;
	study_points_ja: string;
	priority: number;
	is_focus_b: number;
	learning_state: ApLearningState;
	mastery_score: number;
	correct_count: number;
	partial_count: number;
	wrong_count: number;
	review_stage: number;
	last_studied_at: string | null;
	next_review_on: string | null;
}

interface DailySessionRow {
	id: number;
	plan_id: number;
	study_date: string;
	target_minutes: number;
	actual_minutes: number;
	status: 'not_started' | 'in_progress' | 'completed';
	recommendation_reason_ko: string | null;
	recommendation_reason_ja: string | null;
	started_at: string | null;
	completed_at: string | null;
}

interface DailyItemRow {
	id: number;
	session_id: number;
	topic_id: number | null;
	item_kind: ApItemKind;
	sequence_no: number;
	title_ko: string;
	title_ja: string;
	description_ko: string;
	description_ja: string;
	target_minutes: number;
	status: 'pending' | 'completed';
	result: ApResult | null;
	score: number | null;
	confidence: number | null;
	note: string | null;
	completed_at: string | null;
	topic_code: string | null;
	topic_title_ko: string | null;
	topic_title_ja: string | null;
	mastery_score: number | null;
}

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

function optionalConfidence(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? Math.max(1, Math.min(5, Math.round(parsed))) : null;
}

async function authenticatedPlan(request: Request, env: Env): Promise<{ adminId: number; plan: ApStudyPlanRow } | Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	const plan = await ensureDefaultApStudyPlan(env.song_project_db, session.adminId);
	return { adminId: session.adminId, plan };
}

async function getDailySession(db: D1Database, planId: number, studyDate: string): Promise<DailySessionRow | null> {
	return db.prepare(`
		SELECT id, plan_id, study_date, target_minutes, actual_minutes, status,
			recommendation_reason_ko, recommendation_reason_ja, started_at, completed_at
		FROM ap_daily_sessions
		WHERE plan_id = ?1 AND study_date = ?2
		LIMIT 1
	`).bind(planId, studyDate).first<DailySessionRow>();
}

async function loadDailyItems(db: D1Database, planId: number, sessionId: number): Promise<DailyItemRow[]> {
	const result = await db.prepare(`
		SELECT i.id, i.session_id, i.topic_id, i.item_kind, i.sequence_no,
			i.title_ko, i.title_ja, i.description_ko, i.description_ja,
			i.target_minutes, i.status, i.result, i.score, i.confidence, i.note, i.completed_at,
			t.topic_code, t.title_ko AS topic_title_ko, t.title_ja AS topic_title_ja,
			p.mastery_score
		FROM ap_daily_items AS i
		LEFT JOIN ap_study_topics AS t ON t.id = i.topic_id
		LEFT JOIN ap_topic_progress AS p ON p.plan_id = ?1 AND p.topic_id = i.topic_id
		WHERE i.session_id = ?2
		ORDER BY i.sequence_no ASC
	`).bind(planId, sessionId).all<DailyItemRow>();
	return result.results;
}

async function completedStudyDays(db: D1Database, planId: number, beforeDate: string): Promise<number> {
	const row = await db.prepare(`
		SELECT COUNT(*) AS value
		FROM ap_daily_sessions
		WHERE plan_id = ?1 AND study_date < ?2 AND status = 'completed'
	`).bind(planId, beforeDate).first<{ value: number }>();
	return Number(row?.value ?? 0);
}

async function dueTopics(db: D1Database, planId: number, today: string, limit: number): Promise<TopicRow[]> {
	if (limit <= 0) return [];
	const result = await db.prepare(`
		SELECT t.id, t.topic_code, t.exam_part, t.domain_code, t.title_ko, t.title_ja,
			t.study_points_ko, t.study_points_ja, t.priority, t.is_focus_b,
			p.learning_state, p.mastery_score, p.correct_count, p.partial_count, p.wrong_count,
			p.review_stage, p.last_studied_at, p.next_review_on
		FROM ap_study_topics AS t
		JOIN ap_topic_progress AS p ON p.plan_id = t.plan_id AND p.topic_id = t.id
		WHERE t.plan_id = ?1 AND p.next_review_on IS NOT NULL AND p.next_review_on <= ?2
		ORDER BY p.next_review_on ASC, p.wrong_count DESC, p.mastery_score ASC, t.priority DESC
		LIMIT ?3
	`).bind(planId, today, limit).all<TopicRow>();
	return result.results;
}

async function selectConceptTopic(db: D1Database, planId: number): Promise<TopicRow | null> {
	return db.prepare(`
		SELECT t.id, t.topic_code, t.exam_part, t.domain_code, t.title_ko, t.title_ja,
			t.study_points_ko, t.study_points_ja, t.priority, t.is_focus_b,
			p.learning_state, p.mastery_score, p.correct_count, p.partial_count, p.wrong_count,
			p.review_stage, p.last_studied_at, p.next_review_on
		FROM ap_study_topics AS t
		JOIN ap_topic_progress AS p ON p.plan_id = t.plan_id AND p.topic_id = t.id
		WHERE t.plan_id = ?1
		ORDER BY
			CASE p.learning_state WHEN 'unlearned' THEN 0 WHEN 'uncertain' THEN 1 WHEN 'learning' THEN 2 ELSE 3 END,
			t.priority DESC, p.mastery_score ASC, t.sort_order ASC
		LIMIT 1
	`).bind(planId).first<TopicRow>();
}

async function selectSubjectATopic(db: D1Database, planId: number): Promise<TopicRow | null> {
	return db.prepare(`
		SELECT t.id, t.topic_code, t.exam_part, t.domain_code, t.title_ko, t.title_ja,
			t.study_points_ko, t.study_points_ja, t.priority, t.is_focus_b,
			p.learning_state, p.mastery_score, p.correct_count, p.partial_count, p.wrong_count,
			p.review_stage, p.last_studied_at, p.next_review_on
		FROM ap_study_topics AS t
		JOIN ap_topic_progress AS p ON p.plan_id = t.plan_id AND p.topic_id = t.id
		WHERE t.plan_id = ?1 AND t.exam_part IN ('A', 'AB')
		ORDER BY p.mastery_score ASC, p.wrong_count DESC, t.priority DESC,
			CASE WHEN p.last_studied_at IS NULL THEN 0 ELSE 1 END, p.last_studied_at ASC, t.sort_order ASC
		LIMIT 1
	`).bind(planId).first<TopicRow>();
}

async function selectSubjectBTopic(db: D1Database, planId: number): Promise<TopicRow | null> {
	return db.prepare(`
		SELECT t.id, t.topic_code, t.exam_part, t.domain_code, t.title_ko, t.title_ja,
			t.study_points_ko, t.study_points_ja, t.priority, t.is_focus_b,
			p.learning_state, p.mastery_score, p.correct_count, p.partial_count, p.wrong_count,
			p.review_stage, p.last_studied_at, p.next_review_on
		FROM ap_study_topics AS t
		JOIN ap_topic_progress AS p ON p.plan_id = t.plan_id AND p.topic_id = t.id
		WHERE t.plan_id = ?1 AND t.is_focus_b = 1
		ORDER BY p.mastery_score ASC, p.wrong_count DESC,
			CASE WHEN p.last_studied_at IS NULL THEN 0 ELSE 1 END, p.last_studied_at ASC, t.sort_order ASC
		LIMIT 1
	`).bind(planId).first<TopicRow>();
}

async function latestWrongTopic(db: D1Database, planId: number): Promise<TopicRow | null> {
	return db.prepare(`
		SELECT t.id, t.topic_code, t.exam_part, t.domain_code, t.title_ko, t.title_ja,
			t.study_points_ko, t.study_points_ja, t.priority, t.is_focus_b,
			p.learning_state, p.mastery_score, p.correct_count, p.partial_count, p.wrong_count,
			p.review_stage, p.last_studied_at, p.next_review_on
		FROM ap_study_attempts AS a
		JOIN ap_study_topics AS t ON t.id = a.topic_id
		JOIN ap_topic_progress AS p ON p.plan_id = a.plan_id AND p.topic_id = t.id
		WHERE a.plan_id = ?1 AND a.result = 'wrong' AND a.topic_id IS NOT NULL
		ORDER BY a.created_at DESC
		LIMIT 1
	`).bind(planId).first<TopicRow>();
}

function task(kind: ApItemKind, topic: TopicRow | null, minutes: number, sequence: number) {
	const topicKo = topic?.title_ko ?? '';
	const topicJa = topic?.title_ja ?? '';
	const pointsKo = topic?.study_points_ko ?? '';
	const pointsJa = topic?.study_points_ja ?? '';
	if (kind === 'review') return {
		kind, topicId: topic?.id ?? null, sequence, minutes,
		titleKo: `복습 · ${topicKo}`, titleJa: `復習 · ${topicJa}`,
		descriptionKo: `${pointsKo} 중 지난 학습의 오답·헷갈린 개념을 다시 확인하고 확인문제 3~5개를 풉니다.`,
		descriptionJa: `${pointsJa}のうち、前回の誤答・曖昧な概念を確認し、確認問題を3〜5問解きます。`,
	};
	if (kind === 'wrong_answer') return {
		kind, topicId: topic?.id ?? null, sequence, minutes,
		titleKo: `최근 오답 재도전 · ${topicKo}`, titleJa: `直近の誤答再挑戦 · ${topicJa}`,
		descriptionKo: '정답을 보지 않고 먼저 다시 풀고, 틀린 원인을 한 줄로 기록합니다.',
		descriptionJa: '正解を見ずに先に解き直し、間違えた原因を1行で記録します。',
	};
	if (kind === 'concept') return {
		kind, topicId: topic?.id ?? null, sequence, minutes,
		titleKo: `오늘의 개념 · ${topicKo}`, titleJa: `今日の概念 · ${topicJa}`,
		descriptionKo: `${pointsKo}. 설명 → 핵심키워드 → 짧은 예제 → 확인문제 순으로 학습합니다.`,
		descriptionJa: `${pointsJa}。説明 → 重要キーワード → 短い例 → 確認問題の順で学習します。`,
	};
	if (kind === 'subject_a') return {
		kind, topicId: topic?.id ?? null, sequence, minutes,
		titleKo: `科目A 문제 · ${topicKo}`, titleJa: `科目A問題 · ${topicJa}`,
		descriptionKo: `${pointsKo} 범위에서 4지선다 8~12문제를 풀고 정답률을 기록합니다.`,
		descriptionJa: `${pointsJa}の範囲から四肢択一を8〜12問解き、正答率を記録します。`,
	};
	if (kind === 'subject_b') return {
		kind, topicId: topic?.id ?? null, sequence, minutes,
		titleKo: `科目B 실전 · ${topicKo}`, titleJa: `科目B実戦 · ${topicJa}`,
		descriptionKo: `${pointsKo}. 문제의 질문을 먼저 읽고 근거 위치를 찾은 뒤 짧은 일본어 답안을 작성합니다.`,
		descriptionJa: `${pointsJa}。設問を先に読み、根拠箇所を探してから短い日本語答案を作成します。`,
	};
	if (kind === 'weekly_test') return {
		kind, topicId: null, sequence, minutes,
		titleKo: '주간 누적 테스트', titleJa: '週次累積テスト',
		descriptionKo: '최근 7일 학습범위에서 科目A 20문제 + 科目B 주력분야 1문제를 풀고 약점 순위를 다시 계산합니다.',
		descriptionJa: '直近7日間の範囲から科目A20問 + 科目B重点分野1問を解き、弱点順位を再計算します。',
	};
	return {
		kind, topicId: null, sequence, minutes,
		titleKo: '월간 누적 테스트', titleJa: '月次累積テスト',
		descriptionKo: '최근 30일 학습범위에서 科目A 40문제 + 科目B 2문제를 풀고 다음 달 학습 비중을 조정합니다.',
		descriptionJa: '直近30日間の範囲から科目A40問 + 科目B2問を解き、翌月の学習配分を調整します。',
	};
}

async function createDailyItems(db: D1Database, plan: ApStudyPlanRow, session: DailySessionRow, today: string) {
	const existing = await db.prepare(`SELECT COUNT(*) AS value FROM ap_daily_items WHERE session_id = ?1`)
		.bind(session.id).first<{ value: number }>();
	if (Number(existing?.value ?? 0) > 0) return;

	const dueCountRow = await db.prepare(`
		SELECT COUNT(*) AS value FROM ap_topic_progress
		WHERE plan_id = ?1 AND next_review_on IS NOT NULL AND next_review_on <= ?2
	`).bind(plan.id, today).first<{ value: number }>();
	const studyDays = await completedStudyDays(db, plan.id, today);
	const countdown = apPlanCountdown(plan, today);
	const budget = buildApDailyBudget({
		dueReviewCount: Number(dueCountRow?.value ?? 0),
		daysUntilSubjectA: countdown.daysUntilSubjectA,
		completedStudyDays: studyDays,
		dailyMinutes: plan.daily_minutes,
	});

	const tasks: ReturnType<typeof task>[] = [];
	let sequence = 1;
	if (budget.testMinutes > 0) {
		tasks.push(task(budget.mode === 'monthly_test' ? 'monthly_test' : 'weekly_test', null, budget.testMinutes, sequence++));
	} else {
		const reviews = await dueTopics(db, plan.id, today, Math.max(1, Math.floor(budget.reviewMinutes / 10)));
		for (const topic of reviews) tasks.push(task('review', topic, Math.max(5, Math.floor(budget.reviewMinutes / Math.max(1, reviews.length))), sequence++));
		if (!reviews.length && budget.reviewMinutes > 0) {
			const wrong = await latestWrongTopic(db, plan.id);
			if (wrong) tasks.push(task('wrong_answer', wrong, budget.reviewMinutes, sequence++));
		}
		if (budget.conceptMinutes > 0) tasks.push(task('concept', await selectConceptTopic(db, plan.id), budget.conceptMinutes, sequence++));
		if (budget.subjectAMinutes > 0) tasks.push(task('subject_a', await selectSubjectATopic(db, plan.id), budget.subjectAMinutes, sequence++));
		if (budget.subjectBMinutes > 0) tasks.push(task('subject_b', await selectSubjectBTopic(db, plan.id), budget.subjectBMinutes, sequence++));
	}

	if (!tasks.length) tasks.push(task('concept', await selectConceptTopic(db, plan.id), plan.daily_minutes, sequence++));
	const totalMinutes = tasks.reduce((sum, item) => sum + item.minutes, 0);
	const now = new Date().toISOString();
	const statements = tasks.map((item) => db.prepare(`
		INSERT OR IGNORE INTO ap_daily_items
			(session_id, topic_id, item_kind, sequence_no, title_ko, title_ja, description_ko, description_ja,
			 target_minutes, status, created_at, updated_at)
		VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'pending', ?10, ?10)
	`).bind(session.id, item.topicId, item.kind, item.sequence, item.titleKo, item.titleJa, item.descriptionKo, item.descriptionJa, item.minutes, now));
	await db.batch(statements);
	await db.prepare(`
		UPDATE ap_daily_sessions
		SET target_minutes = ?2, recommendation_reason_ko = ?3, recommendation_reason_ja = ?4, updated_at = ?5
		WHERE id = ?1
	`).bind(session.id, totalMinutes, budget.reasonKo, budget.reasonJa, now).run();
}

async function startToday(request: Request, env: Env) {
	const context = await authenticatedPlan(request, env);
	if (context instanceof Response) return context;
	const today = japanDateString();
	if (today < context.plan.study_start_date) {
		return json({ ok: false, error: 'STUDY_NOT_STARTED', studyStartDate: context.plan.study_start_date }, 409);
	}
	const now = new Date().toISOString();
	await env.song_project_db.prepare(`
		INSERT OR IGNORE INTO ap_daily_sessions
			(plan_id, study_date, target_minutes, status, started_at, created_at, updated_at)
		VALUES (?1, ?2, ?3, 'in_progress', ?4, ?4, ?4)
	`).bind(context.plan.id, today, context.plan.daily_minutes, now).run();
	await env.song_project_db.prepare(`
		UPDATE ap_daily_sessions
		SET status = CASE WHEN status = 'completed' THEN status ELSE 'in_progress' END,
			started_at = COALESCE(started_at, ?3), updated_at = ?3
		WHERE plan_id = ?1 AND study_date = ?2
	`).bind(context.plan.id, today, now).run();
	let session = await getDailySession(env.song_project_db, context.plan.id, today);
	if (!session) throw new Error('AP_DAILY_SESSION_CREATE_FAILED');
	await createDailyItems(env.song_project_db, context.plan, session, today);
	session = (await getDailySession(env.song_project_db, context.plan.id, today)) ?? session;
	const items = await loadDailyItems(env.song_project_db, context.plan.id, session.id);
	return json({ ok: true, studyDate: today, plan: context.plan, session, items });
}

export async function handleStartAdminApToday(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	try {
		return await startToday(request, env);
	} catch (error) {
		console.error('Failed to start AP daily study', error);
		return json({ ok: false, error: 'AP_DAILY_START_FAILED' }, 500);
	}
}

export async function handleGetAdminApToday(request: Request, env: Env): Promise<Response> {
	try {
		const context = await authenticatedPlan(request, env);
		if (context instanceof Response) return context;
		const today = japanDateString();
		const session = await getDailySession(env.song_project_db, context.plan.id, today);
		const items = session ? await loadDailyItems(env.song_project_db, context.plan.id, session.id) : [];
		return json({ ok: true, studyDate: today, plan: context.plan, session, items });
	} catch (error) {
		console.error('Failed to load AP daily study', error);
		return json({ ok: false, error: 'AP_DAILY_LOAD_FAILED' }, 500);
	}
}

export async function handleCompleteAdminApItem(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	try {
		const context = await authenticatedPlan(request, env);
		if (context instanceof Response) return context;
		const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
		const itemId = Number(payload?.itemId);
		const result = validResult(payload?.result);
		if (!Number.isSafeInteger(itemId) || itemId <= 0 || !result) return json({ ok: false, error: 'INVALID_INPUT' }, 400);
		const score = optionalScore(payload?.score);
		const confidence = optionalConfidence(payload?.confidence);
		const note = typeof payload?.note === 'string' ? payload.note.trim().slice(0, 1000) : null;
		const item = await env.song_project_db.prepare(`
			SELECT i.id, i.session_id, i.topic_id, i.item_kind, i.target_minutes, i.status,
				s.plan_id, s.study_date
			FROM ap_daily_items AS i
			JOIN ap_daily_sessions AS s ON s.id = i.session_id
			WHERE i.id = ?1 AND s.plan_id = ?2
			LIMIT 1
		`).bind(itemId, context.plan.id).first<{
			id: number; session_id: number; topic_id: number | null; item_kind: ApItemKind; target_minutes: number; status: string; plan_id: number; study_date: string;
		}>();
		if (!item) return json({ ok: false, error: 'ITEM_NOT_FOUND' }, 404);
		if (item.status === 'completed') return json({ ok: true, alreadyCompleted: true });
		const now = new Date().toISOString();

		const statements: D1PreparedStatement[] = [
			env.song_project_db.prepare(`
				UPDATE ap_daily_items
				SET status = 'completed', result = ?2, score = ?3, confidence = ?4, note = ?5,
					completed_at = ?6, updated_at = ?6
				WHERE id = ?1
			`).bind(item.id, result, score, confidence, note, now),
			env.song_project_db.prepare(`
				INSERT INTO ap_study_attempts (plan_id, session_id, item_id, topic_id, result, score, confidence, note, created_at)
				VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
			`).bind(context.plan.id, item.session_id, item.id, item.topic_id, result, score, confidence, note, now),
		];

		if (item.topic_id) {
			const progress = await env.song_project_db.prepare(`
				SELECT learning_state, mastery_score, correct_count, partial_count, wrong_count, review_stage,
					first_studied_at, last_studied_at, next_review_on
				FROM ap_topic_progress WHERE plan_id = ?1 AND topic_id = ?2 LIMIT 1
			`).bind(context.plan.id, item.topic_id).first<{
				learning_state: ApLearningState; mastery_score: number; correct_count: number; partial_count: number; wrong_count: number;
				review_stage: number; first_studied_at: string | null; last_studied_at: string | null; next_review_on: string | null;
			}>();
			const review = nextApReview(Number(progress?.review_stage ?? 0), result, item.study_date);
			const delta = result === 'correct' ? 15 : result === 'partial' ? 5 : result === 'wrong' ? -20 : 5;
			const mastery = Math.max(0, Math.min(100, Number(progress?.mastery_score ?? 0) + delta));
			const state: ApLearningState = result === 'wrong' || result === 'partial'
				? 'uncertain'
				: mastery >= 80 && review.reviewStage >= 4 ? 'mastered' : review.state;
			statements.push(env.song_project_db.prepare(`
				UPDATE ap_topic_progress
				SET learning_state = ?3, mastery_score = ?4,
					correct_count = correct_count + CASE WHEN ?5 = 'correct' THEN 1 ELSE 0 END,
					partial_count = partial_count + CASE WHEN ?5 = 'partial' THEN 1 ELSE 0 END,
					wrong_count = wrong_count + CASE WHEN ?5 = 'wrong' THEN 1 ELSE 0 END,
					review_stage = ?6,
					first_studied_at = COALESCE(first_studied_at, ?7), last_studied_at = ?7,
					next_review_on = ?8, updated_at = ?7
				WHERE plan_id = ?1 AND topic_id = ?2
			`).bind(context.plan.id, item.topic_id, state, mastery, result, review.reviewStage, now, review.nextReviewOn));
		}
		await env.song_project_db.batch(statements);

		const pending = await env.song_project_db.prepare(`SELECT COUNT(*) AS value FROM ap_daily_items WHERE session_id = ?1 AND status = 'pending'`)
			.bind(item.session_id).first<{ value: number }>();
		const completedMinutes = await env.song_project_db.prepare(`SELECT COALESCE(SUM(target_minutes), 0) AS value FROM ap_daily_items WHERE session_id = ?1 AND status = 'completed'`)
			.bind(item.session_id).first<{ value: number }>();
		const complete = Number(pending?.value ?? 0) === 0;
		await env.song_project_db.prepare(`
			UPDATE ap_daily_sessions
			SET actual_minutes = ?2, status = ?3,
				completed_at = CASE WHEN ?3 = 'completed' THEN COALESCE(completed_at, ?4) ELSE NULL END,
				updated_at = ?4
			WHERE id = ?1
		`).bind(item.session_id, Number(completedMinutes?.value ?? 0), complete ? 'completed' : 'in_progress', now).run();
		const session = await getDailySession(env.song_project_db, context.plan.id, item.study_date);
		const items = session ? await loadDailyItems(env.song_project_db, context.plan.id, session.id) : [];
		return json({ ok: true, session, items });
	} catch (error) {
		console.error('Failed to complete AP study item', error);
		return json({ ok: false, error: 'AP_ITEM_COMPLETE_FAILED' }, 500);
	}
}
