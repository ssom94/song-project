import { ensureJapaneseAdminLearningStatsSchema, resolveLearningAdmin } from '../../japanese-learning';

interface CountRow {
	code: string | null;
	count: number;
}

interface LearningAggregateRow {
	mastered_count: number;
	uncertain_count: number;
	answered_today: number;
	correct_count: number;
	wrong_count: number;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function handleGetPublicJapaneseStats(request: Request, env: Env): Promise<Response> {
	try {
		await ensureJapaneseAdminLearningStatsSchema(env.song_project_db);
		const learningAdmin = await resolveLearningAdmin(request, env.song_project_db);

		const totalRow = await env.song_project_db
			.prepare(`SELECT COUNT(*) AS count FROM japanese_words WHERE deleted_at IS NULL`)
			.first<{ count: number }>();

		const levelRows = await env.song_project_db
			.prepare(`
				SELECT jl.code, COUNT(jw.id) AS count
				FROM jlpt_levels AS jl
				LEFT JOIN japanese_words AS jw
					ON jw.jlpt_level_id = jl.id AND jw.deleted_at IS NULL
				GROUP BY jl.id, jl.code, jl.display_order
				ORDER BY jl.display_order ASC
			`)
			.all<CountRow>();

		let learning: LearningAggregateRow = {
			mastered_count: 0,
			uncertain_count: 0,
			answered_today: 0,
			correct_count: 0,
			wrong_count: 0,
		};

		if (learningAdmin.adminId) {
			learning = await env.song_project_db.prepare(`
				SELECT
					COALESCE(SUM(CASE WHEN s.learning_state = 'mastered' THEN 1 ELSE 0 END), 0) AS mastered_count,
					COALESCE(SUM(CASE WHEN s.learning_state = 'uncertain' THEN 1 ELSE 0 END), 0) AS uncertain_count,
					COALESCE(SUM(CASE WHEN date(s.last_answered_at) = date('now') THEN 1 ELSE 0 END), 0) AS answered_today,
					COALESCE(SUM(s.correct_count), 0) AS correct_count,
					COALESCE(SUM(s.wrong_count), 0) AS wrong_count
				FROM japanese_admin_word_learning_stats AS s
				INNER JOIN japanese_words AS w ON w.id = s.word_id AND w.deleted_at IS NULL
				WHERE s.admin_id = ?1
			`).bind(learningAdmin.adminId).first<LearningAggregateRow>() ?? learning;
		}

		const registeredWords = Number(totalRow?.count ?? 0);
		const masteredWords = Math.min(registeredWords, Number(learning.mastered_count ?? 0));
		const uncertainWords = Math.min(
			Math.max(0, registeredWords - masteredWords),
			Number(learning.uncertain_count ?? 0),
		);
		const unlearnedWords = Math.max(0, registeredWords - masteredWords - uncertainWords);
		const correctAttempts = Number(learning.correct_count ?? 0);
		const wrongAttempts = Number(learning.wrong_count ?? 0);
		const totalAttempts = correctAttempts + wrongAttempts;

		return json({
			ok: true,
			learningAdmin: {
				id: learningAdmin.adminId,
				username: learningAdmin.username,
				displayName: learningAdmin.displayName,
				fromSession: learningAdmin.fromSession,
			},
			stats: {
				registeredWords,
				masteredWords,
				uncertainWords,
				unlearnedWords,
				wrongWords: Math.max(0, registeredWords - masteredWords),
				todayAttempts: Number(learning.answered_today ?? 0),
				accuracy: totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : null,
				levels: Object.fromEntries(levelRows.results.map((row) => [row.code ?? 'unknown', Number(row.count ?? 0)])),
			},
		});
	} catch (error) {
		console.error('Failed to load public Japanese stats', error);
		return json({ ok: false, error: 'PUBLIC_JAPANESE_STATS_FAILED' }, 500);
	}
}
