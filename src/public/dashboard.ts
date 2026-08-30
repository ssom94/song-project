import { ensureDashboardGoalsSchema } from '../dashboard/goals-schema';

interface GoalRow {
	id: number;
	goal_key: string;
	title: string;
	goal_type: 'percent' | 'count' | 'jlpt_auto';
	target_date: string | null;
	progress_percent: number;
	target_count: number | null;
	completed_count: number;
	status: 'planned' | 'progress' | 'done';
	display_order: number;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function handleGetPublicDashboard(_request: Request, env: Env): Promise<Response> {
	try {
		await ensureDashboardGoalsSchema(env.song_project_db);
		const [settings, goals, registered, review] = await Promise.all([
			env.song_project_db.prepare(`SELECT jlpt_goal_mode, jlpt_manual_target, show_jlpt FROM dashboard_settings WHERE id = 1 LIMIT 1`).first<{ jlpt_goal_mode: 'auto' | 'manual'; jlpt_manual_target: number | null; show_jlpt: number }>(),
			env.song_project_db.prepare(`
				SELECT id, goal_key, title, goal_type, target_date, progress_percent,
					target_count, completed_count, status, display_order
				FROM dashboard_goals
				WHERE is_visible = 1
				ORDER BY display_order ASC, id ASC
			`).all<GoalRow>(),
			env.song_project_db.prepare(`SELECT COUNT(*) AS count FROM japanese_words WHERE deleted_at IS NULL`).first<{ count: number }>(),
			env.song_project_db.prepare(`SELECT COUNT(*) AS count FROM japanese_word_learning_stats WHERE needs_review = 1`).first<{ count: number }>(),
		]);

		const registeredWords = Number(registered?.count ?? 0);
		const wrongWords = Number(review?.count ?? 0);
		const goalMode = settings?.jlpt_goal_mode ?? 'auto';
		const manualTarget = settings?.jlpt_manual_target ?? null;
		const targetWords = goalMode === 'manual' && manualTarget ? manualTarget : registeredWords;
		const achievedWords = Math.min(targetWords, Math.max(0, registeredWords - wrongWords));
		const jlptPercent = targetWords > 0 ? Math.min(100, Math.round((achievedWords / targetWords) * 100)) : 0;

		return json({
			ok: true,
			settings: {
				jlptGoalMode: goalMode,
				jlptManualTarget: manualTarget,
				showJlpt: (settings?.show_jlpt ?? 1) === 1,
			},
			learning: { registeredWords, wrongWords, targetWords, achievedWords, percent: jlptPercent },
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
