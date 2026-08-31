import { getAuthenticatedAdminSession } from '../../auth/session';
import { publicCategoryAppearance } from '../../category-appearance';

interface AdminCategoryRow {
	id: number;
	parent_id: number | null;
	display_order: number;
	name_ja: string | null;
	name_ko: string | null;
	icon_kind?: string | null;
	icon_value?: string | null;
	icon_color?: string | null;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, {
		status,
		headers: { 'Cache-Control': 'no-store' },
	});
}

function shape(rows: AdminCategoryRow[], appearanceSupported: boolean) {
	return {
		ok: true,
		appearanceSupported,
		warning: appearanceSupported ? null : 'CATEGORY_APPEARANCE_MIGRATION_REQUIRED',
		categories: rows.map((row) => ({
			id: row.id,
			parentId: row.parent_id,
			displayOrder: row.display_order,
			names: {
				ja: row.name_ja,
				ko: row.name_ko,
			},
			appearance: publicCategoryAppearance(row),
		})),
	};
}

async function listWithAppearance(db: D1Database): Promise<AdminCategoryRow[]> {
	const result = await db
		.prepare(`
			SELECT
				c.id,
				c.parent_id,
				c.display_order,
				c.icon_kind,
				c.icon_value,
				c.icon_color,
				ja.name AS name_ja,
				ko.name AS name_ko
			FROM categories AS c
			LEFT JOIN category_translations AS ja
				ON ja.category_id = c.id AND ja.language_code = 'ja'
			LEFT JOIN category_translations AS ko
				ON ko.category_id = c.id AND ko.language_code = 'ko'
			WHERE c.deleted_at IS NULL
			ORDER BY c.display_order ASC, c.id ASC
		`)
		.all<AdminCategoryRow>();
	return result.results;
}

async function listLegacy(db: D1Database): Promise<AdminCategoryRow[]> {
	const result = await db
		.prepare(`
			SELECT
				c.id,
				c.parent_id,
				c.display_order,
				ja.name AS name_ja,
				ko.name AS name_ko
			FROM categories AS c
			LEFT JOIN category_translations AS ja
				ON ja.category_id = c.id AND ja.language_code = 'ja'
			LEFT JOIN category_translations AS ko
				ON ko.category_id = c.id AND ko.language_code = 'ko'
			WHERE c.deleted_at IS NULL
			ORDER BY c.display_order ASC, c.id ASC
		`)
		.all<AdminCategoryRow>();
	return result.results;
}

export async function handleListAdminCategories(request: Request, env: Env): Promise<Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) {
		return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	}

	try {
		try {
			return json(shape(await listWithAppearance(env.song_project_db), true));
		} catch (appearanceError) {
			console.warn('Category appearance schema is not ready; falling back to legacy category list', appearanceError);
			return json(shape(await listLegacy(env.song_project_db), false));
		}
	} catch (error) {
		console.error('Failed to list admin categories', error);
		return json({ ok: false, error: 'CATEGORY_LIST_FAILED' }, 500);
	}
}
