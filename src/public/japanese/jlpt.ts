import { resolveLearningAdmin } from '../../japanese-learning';
import {
	addDays,
	daysBetween,
	japanDateString,
	loadJlptStudyPlan,
} from '../../jlpt-study';

interface CountRow { value: number; }
interface StateCountRow { mastered: number; uncertain: number; unlearned: number; studied: number; }
interface SessionRow {
	id: number; study_date: string; review_target: number; new_word_target: number; vocab_question_target: number;
	grammar_target: number; reading_target: number; review_completed: number; new_word_completed: number;
	vocab_question_completed: number; grammar_completed: number; reading_completed: number; status: string;
	started_at: string | null; completed_at: string | null;
}
interface CalendarRow {
	study_date: string; status: string; review_completed: number; review_target: number; new_word_completed: number;
	new_word_target: number; vocab_question_completed: number; vocab_question_target: number; grammar_completed: number;
	grammar_target: number; reading_completed: number; reading_target: number;
}
interface ContentCountRow { content_type: string; total: number; completed: number; }

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
function percentage(value: number, total: number): number {
	if (total <= 0) return 0;
	return Math.max(0, Math.min(100, Math.round((value / total) * 1000) / 10));
}
function completedTotal(session: SessionRow | CalendarRow | null): number {
	if (!session) return 0;
	return session.review_completed + session.new_word_completed + session.vocab_question_completed + session.grammar_completed + session.reading_completed;
}
function targetTotal(session: SessionRow | CalendarRow | null): number {
	if (!session) return 0;
	return session.review_target + session.new_word_target + session.vocab_question_target + session.grammar_target + session.reading_target;
}
function scheduleCounts(row: SessionRow | CalendarRow | null): { completed: number; target: number } {
	if (!row) return { completed: 0, target: 0 };
	const sections = [[row.review_completed, row.review_target],[row.new_word_completed, row.new_word_target],[row.vocab_question_completed, row.vocab_question_target],[row.grammar_completed, row.grammar_target],[row.reading_completed, row.reading_target]] as const;
	let target = 0; let completed = 0;
	for (const [done, required] of sections) {
		if (Number(required) <= 0) continue;
		target += 1;
		if (Number(done) >= Number(required)) completed += 1;
	}
	return { completed, target };
}
function calendarProgress(row: CalendarRow): number { return percentage(completedTotal(row), targetTotal(row)); }
function activeStudyRows(rows: CalendarRow[]): CalendarRow[] { return rows.filter((row) => row.status === 'completed' || completedTotal(row) > 0); }
function studyStreak(rows: CalendarRow[], today: string): { current: number; longest: number } {
	const dates = [...new Set(activeStudyRows(rows).map((row) => row.study_date))].sort();
	if (!dates.length) return { current: 0, longest: 0 };
	let longest = 1; let run = 1;
	for (let index = 1; index < dates.length; index += 1) {
		if (dates[index] === addDays(dates[index - 1], 1)) run += 1; else run = 1;
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

export async function handleGetPublicJapaneseJlptDashboard(request: Request, env: Env): Promise<Response> {
	try {
		const admin = await resolveLearningAdmin(request, env.song_project_db);
		if (!admin.adminId) return json({ ok: false, error: 'LEARNING_ADMIN_NOT_FOUND' }, 404);

		// GET requests are intentionally read-only. Plan creation/repair belongs to write flows.
		const plan = await loadJlptStudyPlan(env.song_project_db, admin.adminId);
		if (!plan) return json({ ok: false, error: 'JLPT_STUDY_PLAN_NOT_FOUND' }, 404);

		const today = japanDateString();
		const [curriculum, registeredN1, stateCounts, reviewDue, session, calendarResult, contentResult] = await Promise.all([
			env.song_project_db.prepare(`SELECT COUNT(*) AS value FROM japanese_jlpt_curriculum_words WHERE plan_id = ?1`).bind(plan.id).first<CountRow>(),
			env.song_project_db.prepare(`SELECT COUNT(*) AS value FROM japanese_words AS w JOIN jlpt_levels AS l ON l.id = w.jlpt_level_id WHERE w.deleted_at IS NULL AND l.code = ?1`).bind(plan.jlpt_level_code).first<CountRow>(),
			env.song_project_db.prepare(`SELECT COALESCE(SUM(CASE WHEN s.learning_state = 'mastered' THEN 1 ELSE 0 END), 0) AS mastered, COALESCE(SUM(CASE WHEN s.learning_state = 'uncertain' THEN 1 ELSE 0 END), 0) AS uncertain, COALESCE(SUM(CASE WHEN s.first_learned_at IS NULL THEN 1 ELSE 0 END), 0) AS unlearned, COALESCE(SUM(CASE WHEN s.first_learned_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS studied FROM japanese_jlpt_curriculum_words AS c LEFT JOIN japanese_admin_word_learning_stats AS s ON s.word_id = c.word_id AND s.admin_id = ?2 WHERE c.plan_id = ?1`).bind(plan.id, admin.adminId).first<StateCountRow>(),
			env.song_project_db.prepare(`SELECT COUNT(*) AS value FROM japanese_jlpt_curriculum_words AS c JOIN japanese_admin_word_learning_stats AS s ON s.word_id = c.word_id AND s.admin_id = ?2 WHERE c.plan_id = ?1 AND s.first_learned_at IS NOT NULL AND (s.next_review_on <= ?3 OR (s.learning_state = 'uncertain' AND s.next_review_on IS NULL))`).bind(plan.id, admin.adminId, today).first<CountRow>(),
			env.song_project_db.prepare(`SELECT id, study_date, review_target, new_word_target, vocab_question_target, grammar_target, reading_target, review_completed, new_word_completed, vocab_question_completed, grammar_completed, reading_completed, status, started_at, completed_at FROM japanese_jlpt_daily_sessions WHERE plan_id = ?1 AND study_date = ?2 LIMIT 1`).bind(plan.id, today).first<SessionRow>(),
			env.song_project_db.prepare(`SELECT study_date, status, review_completed, review_target, new_word_completed, new_word_target, vocab_question_completed, vocab_question_target, grammar_completed, grammar_target, reading_completed, reading_target FROM japanese_jlpt_daily_sessions WHERE plan_id = ?1 ORDER BY study_date DESC LIMIT 365`).bind(plan.id).all<CalendarRow>(),
			env.song_project_db.prepare(`SELECT content_type, COUNT(*) AS total, SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) AS completed FROM japanese_jlpt_daily_contents WHERE plan_id = ?1 AND study_date = ?2 GROUP BY content_type`).bind(plan.id, today).all<ContentCountRow>(),
		]);

		const curriculumWords = Number(curriculum?.value ?? 0);
		const states = { mastered: Number(stateCounts?.mastered ?? 0), uncertain: Number(stateCounts?.uncertain ?? 0), unlearned: Number(stateCounts?.unlearned ?? curriculumWords), studied: Number(stateCounts?.studied ?? 0) };
		const content = Object.fromEntries(contentResult.results.map((row) => [row.content_type, { total: Number(row.total ?? 0), completed: Number(row.completed ?? 0) }]));
		const studyStarted = today >= plan.study_start_date;
		const todaySession = session ?? null;
		const effectiveTargets = todaySession ? { review: todaySession.review_target, newWords: todaySession.new_word_target, vocabQuestions: todaySession.vocab_question_target, grammar: todaySession.grammar_target, reading: todaySession.reading_target } : { review: Number(reviewDue?.value ?? 0), newWords: plan.daily_new_word_target, vocabQuestions: plan.vocab_question_target, grammar: plan.grammar_target, reading: plan.reading_target };
		const effectiveCompleted = todaySession ? { review: todaySession.review_completed, newWords: todaySession.new_word_completed, vocabQuestions: todaySession.vocab_question_completed, grammar: todaySession.grammar_completed, reading: todaySession.reading_completed } : { review: 0, newWords: 0, vocabQuestions: 0, grammar: 0, reading: 0 };
		const activeRows = activeStudyRows(calendarResult.results);
		const streak = studyStreak(calendarResult.results, today);
		const history = activeRows.map((row) => ({ date: row.study_date, status: row.status, progressPercent: calendarProgress(row), schedule: scheduleCounts(row), review: { completed: row.review_completed, target: row.review_target }, newWords: { completed: row.new_word_completed, target: row.new_word_target }, vocabQuestions: { completed: row.vocab_question_completed, target: row.vocab_question_target }, grammar: { completed: row.grammar_completed, target: row.grammar_target }, reading: { completed: row.reading_completed, target: row.reading_target } }));
		const completedDays = history.filter((row) => row.status === 'completed').length;
		const totalNewWords = history.reduce((sum, row) => sum + Number(row.newWords.completed || 0), 0);
		const totalReviews = history.reduce((sum, row) => sum + Number(row.review.completed || 0), 0);
		const totalVocabQuestions = history.reduce((sum, row) => sum + Number(row.vocabQuestions.completed || 0), 0);
		const totalGrammar = history.reduce((sum, row) => sum + Number(row.grammar.completed || 0), 0);
		const totalReading = history.reduce((sum, row) => sum + Number(row.reading.completed || 0), 0);
		const totalScheduleCompleted = history.reduce((sum, row) => sum + Number(row.schedule.completed || 0), 0);
		const totalScheduleItems = history.reduce((sum, row) => sum + Number(row.schedule.target || 0), 0);

		return json({ ok: true, admin: { displayName: admin.displayName, fromSession: admin.fromSession }, plan: { code: plan.plan_code, level: plan.jlpt_level_code, studyStartDate: plan.study_start_date, targetExamDate: plan.target_exam_date, targetDateIsTentative: Boolean(plan.target_date_is_tentative), targetWordCount: plan.target_word_count, dailyNewWordTarget: plan.daily_new_word_target, vocabQuestionTarget: plan.vocab_question_target, grammarTarget: plan.grammar_target, readingTarget: plan.reading_target, today, daysRemaining: Math.max(0, daysBetween(today, plan.target_exam_date)), daysUntilStart: Math.max(0, daysBetween(today, plan.study_start_date)), studyStarted }, progress: { curriculumWords, registeredN1Words: Number(registeredN1?.value ?? 0), masteredWords: states.mastered, uncertainWords: states.uncertain, unlearnedWords: states.unlearned, studiedWords: states.studied, reviewDueWords: Number(reviewDue?.value ?? 0), curriculumPercent: percentage(curriculumWords, plan.target_word_count), studyPercent: percentage(states.studied, plan.target_word_count), masteryPercent: percentage(states.mastered, plan.target_word_count) }, today: { sessionId: todaySession?.id ?? null, status: todaySession?.status ?? 'not_started', targets: effectiveTargets, completed: effectiveCompleted, schedule: scheduleCounts(todaySession), progressPercent: todaySession ? percentage(completedTotal(todaySession), targetTotal(todaySession)) : 0, startedAt: todaySession?.started_at ?? null, completedAt: todaySession?.completed_at ?? null, availableContent: content }, historySummary: { recordedDays: history.length, completedDays, currentStreak: streak.current, longestStreak: streak.longest, totalStudyDays: history.length, totalNewWords, totalReviews, totalVocabQuestions, totalGrammar, totalReading, totalScheduleCompleted, totalScheduleItems }, calendar: history });
	} catch (error) {
		console.error('Failed to load public JLPT dashboard', error);
		return json({ ok: false, error: 'JLPT_DASHBOARD_FAILED' }, 500);
	}
}
