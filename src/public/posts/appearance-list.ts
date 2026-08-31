import { publicCategoryAppearance } from '../../category-appearance';
import { handleListPublicPosts } from './list';

interface CategoryAppearanceRow {
	id: number;
	name: string;
	icon_kind: string | null;
	icon_value: string | null;
	icon_color: string | null;
}

export async function handleListPublicPostsWithAppearance(request: Request, env: Env): Promise<Response> {
	const response = await handleListPublicPosts(request, env);
	if (!response.ok) return response;
	try {
		const body = await response.clone().json() as {
			language?: 'ja' | 'ko';
			categories?: Array<Record<string, unknown>>;
			posts?: Array<Record<string, unknown>>;
		};
		const language = body.language;
		if (language !== 'ja' && language !== 'ko') return response;
		const rows = await env.song_project_db.prepare(`
			SELECT c.id, ct.name, c.icon_kind, c.icon_value, c.icon_color
			FROM categories c
			JOIN category_translations ct ON ct.category_id = c.id AND ct.language_code = ?1
			WHERE c.deleted_at IS NULL
			ORDER BY c.display_order ASC, c.id ASC
		`).bind(language).all<CategoryAppearanceRow>();
		const byName = new Map(rows.results.map((row) => [row.name, {
			id: row.id,
			name: row.name,
			appearance: publicCategoryAppearance(row),
		}]));

		body.categories = (Array.isArray(body.categories) ? body.categories : []).map((item) => {
			const name = typeof item.name === 'string' ? item.name : '';
			const meta = byName.get(name);
			return meta ? { ...item, id: meta.id, appearance: meta.appearance } : item;
		});
		body.posts = (Array.isArray(body.posts) ? body.posts : []).map((post) => {
			const category = typeof post.category === 'string' ? post.category : '';
			const meta = byName.get(category);
			return meta ? { ...post, categoryMeta: meta } : post;
		});
		return Response.json(body, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
	} catch (error) {
		console.error('Failed to enrich public post categories', error);
		return response;
	}
}
