interface CountRow {
	code: string | null;
	count: number;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'public, max-age=60' } });
}

export async function handleGetPublicJapaneseStats(_request: Request, env: Env): Promise<Response> {
	try {
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

		return json({
			ok: true,
			stats: {
				registeredWords: Number(totalRow?.count ?? 0),
				wrongWords: 0,
				todayAttempts: 0,
				accuracy: null,
				levels: Object.fromEntries(levelRows.results.map((row) => [row.code ?? 'unknown', Number(row.count ?? 0)])),
			},
		});
	} catch (error) {
		console.error('Failed to load public Japanese stats', error);
		return json({ ok: false, error: 'PUBLIC_JAPANESE_STATS_FAILED' }, 500);
	}
}
