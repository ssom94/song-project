import { publicCategoryAppearance } from '../../category-appearance';
import { handleGetPublicPost } from './detail';

interface CategoryAppearanceRow {
	id: number;
	name: string;
	icon_kind: string | null;
	icon_value: string | null;
	icon_color: string | null;
}

export async function handleGetPublicPostWithAppearance(request: Request, env: Env): Promise<Response> {
	const response = await handleGetPublicPost(request, env);
	if (!response.ok) return response;
	try {
		const body = await response.clone().json() as {
			post?: { translations?: Record<string, Record<string, unknown>> };
		};
		const translations = body.post?.translations;
		if (!translations || typeof translations !== 'object') return response;
		for (const [language, translation] of Object.entries(translations)) {
			if (language !== 'ja' && language !== 'ko') continue;
			const name = typeof translation.category === 'string' ? translation.category : '';
			if (!name) continue;
			const row = await env.song_project_db.prepare(`
				SELECT c.id, ct.name, c.icon_kind, c.icon_value, c.icon_color
				FROM categories c
				JOIN category_translations ct ON ct.category_id = c.id
				WHERE c.deleted_at IS NULL AND ct.language_code = ?1 AND ct.name = ?2
				ORDER BY c.display_order ASC, c.id ASC
				LIMIT 1
			`).bind(language, name).first<CategoryAppearanceRow>();
			if (row) translation.categoryMeta = { id: row.id, name: row.name, appearance: publicCategoryAppearance(row) };
		}
		return Response.json(body, { status: response.status, headers: { 'Cache-Control': 'public, max-age=60' } });
	} catch (error) {
		console.error('Failed to enrich public post detail category', error);
		return response;
	}
}
