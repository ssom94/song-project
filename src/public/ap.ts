import { apPlanCountdown, buildApDailyBudget, ensureDefaultApStudyPlan, type ApItemKind } from '../ap-study';
import { resolveLearningAdmin } from '../japanese-learning';
import { addDays, japanDateString } from '../jlpt-study';

interface SessionRow {
	id: number;
	study_date: string;
	target_minutes: number;
	actual_minutes: number;
	status: string;
	recommendation_reason_ko: string | null;
	recommendation_reason_ja: string | null;
	started_at: string | null;
	completed_at: string | null;
}

interface ItemRow {
	id: number;
	topic_id: number | null;
	item_kind: ApItemKind;
	sequence_no: number;
	title_ko: string;
	title_ja: string;
	description_ko: string;
	description_ja: string;
	target_minutes: number;
	status: string;
	result: string | null;
	score: number | null;
	confidence: number | null;
	topic_code: string | null;
	mastery_score: number | null;
}

interface TopicProgressRow {
	id: number;
	topic_code: string;
	title_ko: string;
	title_ja: string;
	domain_code: string;
	exam_part: string;
	is_focus_b: number;
	learning_state: string;
	mastery_score: number;
	correct_count: number;
	partial_count: number;
	wrong_count: number;
	next_review_on: string | null;
}

interface HistoryRow {
	study_date: string;
	target_minutes: number;
	actual_minutes: number;
	status: string;
	completed_items: number;
	total_items: number;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function percentage(value: number, total: number): number {
	if (total <= 0) return 0;
	return Math.max(0, Math.min(100, Math.round((value / total) * 1000) / 10));
}

function streak(rows: HistoryRow[], today: string) {
	const dates = rows.filter((row) => row.actual_minutes > 0 || row.status === 'completed').map((row) => row.study_date).sort();
	if (!dates.length) return { current: 0, longest: 0 };
	let longest = 1;
	let run = 1;
	for (let index = 1; index < dates.length; index += 1) {
		if (dates[index] === addDays(dates[index - 1], 1)) run += 1;
		else run = 1;
		longest = Math.max(longest, run);
	}
	const latest = dates[dates.length - 1];
	if (latest !== today && latest !== addDays(today, -1)) return { current: 0, longest };
	let current = 1;
	for (let index = dates.length - 1; index > 0; index -= 1) {
		if (dates[index - 1] !== addDays(dates[index], -1)) break;
		current += 1;
	}
	return { current, longest };
}

export async function handleGetPublicApDashboard(request: Request, env: Env): Promise<Response> {
	try {
		const admin = await resolveLearningAdmin(request, env.song_project_db);
		if (!admin.adminId) return json({ ok: false, error: 'LEARNING_ADMIN_NOT_FOUND' }, 404);
		const plan = await ensureDefaultApStudyPlan(env.song_project_db, admin.adminId);
		const today = japanDateString();
		const countdown = apPlanCountdown(plan, today);
		const [topicsResult, dueRow, session, historyResult, attemptSummary, completedDaysRow] = await Promise.all([
			env.song_project_db.prepare(`
				SELECT t.id, t.topic_code, t.title_ko, t.title_ja, t.domain_code, t.exam_part, t.is_focus_b,
					p.learning_state, p.mastery_score, p.correct_count, p.partial_count, p.wrong_count, p.next_review_on
				FROM ap_study_topics AS t
				JOIN ap_topic_progress AS p ON p.plan_id = t.plan_id AND p.topic_id = t.id
				WHERE t.plan_id = ?1
				ORDER BY t.sort_order ASC
			`).bind(plan.id).all<TopicProgressRow>(),
			env.song_project_db.prepare(`
				SELECT COUNT(*) AS value FROM ap_topic_progress
				WHERE plan_id = ?1 AND next_review_on IS NOT NULL AND next_review_on <= ?2
			`).bind(plan.id, today).first<{ value: number }>(),
			env.song_project_db.prepare(`
				SELECT id, study_date, target_minutes, actual_minutes, status, recommendation_reason_ko,
					recommendation_reason_ja, started_at, completed_at
				FROM ap_daily_sessions WHERE plan_id = ?1 AND study_date = ?2 LIMIT 1
			`).bind(plan.id, today).first<SessionRow>(),
			env.song_project_db.prepare(`
				SELECT s.study_date, s.target_minutes, s.actual_minutes, s.status,
					SUM(CASE WHEN i.status = 'completed' THEN 1 ELSE 0 END) AS completed_items,
					COUNT(i.id) AS total_items
				FROM ap_daily_sessions AS s
				LEFT JOIN ap_daily_items AS i ON i.session_id = s.id
				WHERE s.plan_id = ?1
				GROUP BY s.id
				ORDER BY s.study_date DESC
				LIMIT 365
			`).bind(plan.id).all<HistoryRow>(),
			env.song_project_db.prepare(`
				SELECT COUNT(*) AS attempts,
					SUM(CASE WHEN result = 'correct' THEN 1 ELSE 0 END) AS correct,
					SUM(CASE WHEN result = 'partial' THEN 1 ELSE 0 END) AS partial,
					SUM(CASE WHEN result = 'wrong' THEN 1 ELSE 0 END) AS wrong,
					AVG(score) AS average_score
				FROM ap_study_attempts WHERE plan_id = ?1
			`).bind(plan.id).first<{ attempts: number; correct: number | null; partial: number | null; wrong: number | null; average_score: number | null }>(),
			env.song_project_db.prepare(`SELECT COUNT(*) AS value FROM ap_daily_sessions WHERE plan_id = ?1 AND status = 'completed'`)
				.bind(plan.id).first<{ value: number }>(),
		]);

		const topics = topicsResult.results;
		const mastered = topics.filter((topic) => topic.learning_state === 'mastered').length;
		const learning = topics.filter((topic) => topic.learning_state === 'learning').length;
		const uncertain = topics.filter((topic) => topic.learning_state === 'uncertain').length;
		const unlearned = topics.filter((topic) => topic.learning_state === 'unlearned').length;
		const averageMastery = topics.length ? Math.round(topics.reduce((sum, topic) => sum + topic.mastery_score, 0) / topics.length) : 0;
		const focusB = topics.filter((topic) => topic.is_focus_b === 1);
		const history = historyResult.results;
		const streakInfo = streak(history, today);
		const completedStudyDays = Number(completedDaysRow?.value ?? 0);
		const previewBudget = buildApDailyBudget({
			dueReviewCount: Number(dueRow?.value ?? 0),
			daysUntilSubjectA: countdown.daysUntilSubjectA,
			completedStudyDays,
			dailyMinutes: plan.daily_minutes,
		});
		const itemResult = session ? await env.song_project_db.prepare(`
			SELECT i.id, i.topic_id, i.item_kind, i.sequence_no, i.title_ko, i.title_ja,
				i.description_ko, i.description_ja, i.target_minutes, i.status, i.result, i.score, i.confidence,
				t.topic_code, p.mastery_score
			FROM ap_daily_items AS i
			LEFT JOIN ap_study_topics AS t ON t.id = i.topic_id
			LEFT JOIN ap_topic_progress AS p ON p.plan_id = ?2 AND p.topic_id = i.topic_id
			WHERE i.session_id = ?1 ORDER BY i.sequence_no ASC
		`).bind(session.id, plan.id).all<ItemRow>() : { results: [] as ItemRow[] };

		const domainMap = new Map<string, { total: number; score: number; mastered: number }>();
		for (const topic of topics) {
			const current = domainMap.get(topic.domain_code) ?? { total: 0, score: 0, mastered: 0 };
			current.total += 1;
			current.score += topic.mastery_score;
			if (topic.learning_state === 'mastered') current.mastered += 1;
			domainMap.set(topic.domain_code, current);
		}
		const domainProgress = Object.fromEntries([...domainMap.entries()].map(([domain, value]) => [domain, {
			total: value.total,
			mastered: value.mastered,
			masteryPercent: value.total ? Math.round(value.score / value.total) : 0,
		}]));
		const totalMinutes = history.reduce((sum, row) => sum + Number(row.actual_minutes ?? 0), 0);
		const recordedDays = history.filter((row) => row.actual_minutes > 0 || row.status === 'completed').length;

		return json({
			ok: true,
			admin: { displayName: admin.displayName, fromSession: admin.fromSession },
			plan: {
				code: plan.plan_code,
				studyStartDate: plan.study_start_date,
				registrationStartDate: plan.registration_start_date,
				registrationEndDate: plan.registration_end_date,
				subjectATargetDate: plan.subject_a_target_date,
				subjectBTargetDate: plan.subject_b_target_date,
				dailyMinutes: plan.daily_minutes,
				today,
				...countdown,
			},
			progress: {
				totalTopics: topics.length,
				masteredTopics: mastered,
				learningTopics: learning,
				uncertainTopics: uncertain,
				unlearnedTopics: unlearned,
				averageMastery,
				dueReviewTopics: Number(dueRow?.value ?? 0),
				masteredPercent: percentage(mastered, topics.length),
				domainProgress,
			},
			focusB: focusB.map((topic) => ({
				code: topic.topic_code,
				titleKo: topic.title_ko,
				titleJa: topic.title_ja,
				state: topic.learning_state,
				masteryScore: topic.mastery_score,
				correct: topic.correct_count,
				partial: topic.partial_count,
				wrong: topic.wrong_count,
			})),
			topics: topics.map((topic) => ({
				code: topic.topic_code,
				titleKo: topic.title_ko,
				titleJa: topic.title_ja,
				domain: topic.domain_code,
				examPart: topic.exam_part,
				focusB: topic.is_focus_b === 1,
				state: topic.learning_state,
				masteryScore: topic.mastery_score,
				nextReviewOn: topic.next_review_on,
			})),
			today: {
				status: session?.status ?? 'not_started',
				sessionId: session?.id ?? null,
				targetMinutes: session?.target_minutes ?? plan.daily_minutes,
				actualMinutes: session?.actual_minutes ?? 0,
				reasonKo: session?.recommendation_reason_ko ?? previewBudget.reasonKo,
				reasonJa: session?.recommendation_reason_ja ?? previewBudget.reasonJa,
				mode: previewBudget.mode,
				items: itemResult.results,
			},
			historySummary: {
				recordedDays,
				completedDays: completedStudyDays,
				totalMinutes,
				currentStreak: streakInfo.current,
				longestStreak: streakInfo.longest,
				attempts: Number(attemptSummary?.attempts ?? 0),
				correct: Number(attemptSummary?.correct ?? 0),
				partial: Number(attemptSummary?.partial ?? 0),
				wrong: Number(attemptSummary?.wrong ?? 0),
				averageScore: attemptSummary?.average_score === null || attemptSummary?.average_score === undefined
					? null : Math.round(Number(attemptSummary.average_score) * 10) / 10,
			},
			history: history.slice(0, 35).map((row) => ({
				date: row.study_date,
				status: row.status,
				targetMinutes: row.target_minutes,
				actualMinutes: row.actual_minutes,
				completedItems: Number(row.completed_items ?? 0),
				totalItems: Number(row.total_items ?? 0),
				progressPercent: percentage(Number(row.completed_items ?? 0), Number(row.total_items ?? 0)),
			})),
		});
	} catch (error) {
		console.error('Failed to load public AP dashboard', error);
		return json({ ok: false, error: 'AP_DASHBOARD_FAILED' }, 500);
	}
}
