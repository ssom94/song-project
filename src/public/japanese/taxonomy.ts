function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'public, max-age=300' } });
}

export async function handleGetPublicJapaneseTaxonomy(_request: Request, env: Env): Promise<Response> {
	try {
		const [levels, parts, categories] = await Promise.all([
			env.song_project_db.prepare(`SELECT id, code, display_order FROM jlpt_levels ORDER BY display_order ASC`).all<{ id: number; code: string; display_order: number }>(),
			env.song_project_db.prepare(`SELECT id, parent_id, name_ja, name_ko, display_order FROM parts_of_speech WHERE deleted_at IS NULL ORDER BY display_order ASC, id ASC`).all<{ id: number; parent_id: number | null; name_ja: string; name_ko: string; display_order: number }>(),
			env.song_project_db.prepare(`SELECT id, parent_id, name_ja, name_ko, description, display_order FROM japanese_categories WHERE deleted_at IS NULL ORDER BY display_order ASC, id ASC`).all<{ id: number; parent_id: number | null; name_ja: string; name_ko: string; description: string | null; display_order: number }>(),
		]);

		return json({
			ok: true,
			levels: levels.results.map((row) => ({ id: row.id, code: row.code, displayOrder: row.display_order })),
			parts: parts.results.map((row) => ({ id: row.id, parentId: row.parent_id, nameJa: row.name_ja, nameKo: row.name_ko, displayOrder: row.display_order })),
			categories: categories.results.map((row) => ({ id: row.id, parentId: row.parent_id, nameJa: row.name_ja, nameKo: row.name_ko, description: row.description, displayOrder: row.display_order })),
		});
	} catch (error) {
		console.error('Failed to load public Japanese taxonomy', error);
		return json({ ok: false, error: 'PUBLIC_JAPANESE_TAXONOMY_FAILED' }, 500);
	}
}
