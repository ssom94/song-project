import { ensureDashboardGoalsSchema } from '../dashboard/goals-schema';
import { ensureJapaneseAdminLearningStatsSchema, resolveLearningAdmin } from '../japanese-learning';

interface GoalRow {
	id: number;
	goal_key: string;
	title: string;
	goal_type: 'percent' | 'count' | 'jlpt_auto';
	target_date: string | null;
	target_month: string | null;
	progress_percent: number;
	target_count: number | null;
	completed_count: number;
	status: 'planned' | 'progress' | 'done';
	display_order: number;
}

interface LearningCountRow {
	mastered_count: number;
	uncertain_count: number;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function safeRegisteredWordCount(db: D1Database): Promise<number> {
	try {
		const row = await db.prepare(`
			SELECT COUNT(*) AS count
			FROM japanese_words
			WHERE deleted_at IS NULL
		`).first<{ count: number }>();
		return Number(row?.count ?? 0);
	} catch (error) {
		console.warn('Dashboard Japanese word count unavailable', error);
		return 0;
	}
}

export async function handleGetPublicDashboard(request: Request, env: Env): Promise<Response> {
	try {
		await Promise.all([
			ensureDashboardGoalsSchema(env.song_project_db),
			ensureJapaneseAdminLearningStatsSchema(env.song_project_db),
		]);
		const learningAdmin = await resolveLearningAdmin(request, env.song_project_db);

		const [settings, goals, registeredWords] = await Promise.all([
			env.song_project_db.prepare(`
				SELECT jlpt_goal_mode, jlpt_manual_target, show_jlpt
				FROM dashboard_settings
				WHERE id = 1
				LIMIT 1
			`).first<{ jlpt_goal_mode: 'auto' | 'manual'; jlpt_manual_target: number | null; show_jlpt: number }>(),
			env.song_project_db.prepare(`
				SELECT id, goal_key, title, goal_type, target_date, target_month, progress_percent,
					target_count, completed_count, status, display_order
				FROM dashboard_goals
				WHERE is_visible = 1
				ORDER BY display_order ASC, id ASC
			`).all<GoalRow>(),
			safeRegisteredWordCount(env.song_project_db),
		]);

		let learningCounts: LearningCountRow = { mastered_count: 0, uncertain_count: 0 };
		if (learningAdmin.adminId) {
			learningCounts = await env.song_project_db.prepare(`
				SELECT
					COALESCE(SUM(CASE WHEN s.learning_state = 'mastered' THEN 1 ELSE 0 END), 0) AS mastered_count,
					COALESCE(SUM(CASE WHEN s.learning_state = 'uncertain' THEN 1 ELSE 0 END), 0) AS uncertain_count
				FROM japanese_admin_word_learning_stats AS s
				INNER JOIN japanese_words AS w ON w.id = s.word_id AND w.deleted_at IS NULL
				WHERE s.admin_id = ?1
			`).bind(learningAdmin.adminId).first<LearningCountRow>() ?? learningCounts;
		}

		const masteredWords = Math.min(registeredWords, Number(learningCounts.mastered_count ?? 0));
		const uncertainWords = Math.min(
			Math.max(0, registeredWords - masteredWords),
			Number(learningCounts.uncertain_count ?? 0),
		);
		const unlearnedWords = Math.max(0, registeredWords - masteredWords - uncertainWords);
		const goalMode = settings?.jlpt_goal_mode ?? 'auto';
		const manualTarget = settings?.jlpt_manual_target ?? null;
		const targetWords = goalMode === 'manual' && manualTarget ? manualTarget : registeredWords;
		const achievedWords = Math.min(targetWords, masteredWords);
		const jlptPercent = targetWords > 0 ? Math.min(100, Math.round((achievedWords / targetWords) * 100)) : 0;

		return json({
			ok: true,
			learningAdmin: {
				id: learningAdmin.adminId,
				username: learningAdmin.username,
				displayName: learningAdmin.displayName,
				fromSession: learningAdmin.fromSession,
			},
			settings: {
				jlptGoalMode: goalMode,
				jlptManualTarget: manualTarget,
				showJlpt: (settings?.show_jlpt ?? 1) === 1,
			},
			learning: {
				registeredWords,
				masteredWords,
				uncertainWords,
				unlearnedWords,
				wrongWords: Math.max(0, registeredWords - masteredWords),
				targetWords,
				achievedWords,
				percent: jlptPercent,
			},
			goals: goals.results.map((row) => {
				const progressPercent = row.goal_type === 'jlpt_auto'
					? jlptPercent
					: row.goal_type === 'count' && row.target_count
						? Math.min(100, Math.round((row.completed_count / row.target_count) * 100))
						: row.progress_percent;
				return {
					id: row.id,
					goalKey: row.goal_key,
					title: row.title,
					goalType: row.goal_type,
					targetDate: row.target_date,
					targetMonth: row.target_month,
					progressPercent,
					targetCount: row.target_count,
					completedCount: row.completed_count,
					status: row.status,
					displayOrder: row.display_order,
				};
			}),
		});
	} catch (error) {
		console.error('Failed to load public dashboard', error);
		return json({ ok: false, error: 'PUBLIC_DASHBOARD_FAILED' }, 500);
	}
}
