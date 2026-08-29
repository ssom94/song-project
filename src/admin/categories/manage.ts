import { getAuthenticatedAdminSession } from '../../auth/session';

interface CategoryPayload {
	nameJa?: unknown;
	nameKo?: unknown;
	parentId?: unknown;
	displayOrder?: unknown;
}

interface ExistingCategoryRow {
	id: number;
	parent_id: number | null;
	display_order: number;
	name_ja: string | null;
	name_ko: string | null;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, {
		status,
		headers: { 'Cache-Control': 'no-store' },
	});
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

function makeCategoryId(): number {
	const random = new Uint32Array(1);
	crypto.getRandomValues(random);
	return (Date.now() * 1000) + (random[0] % 1000);
}

function makeSlug(name: string, categoryId: number): string {
	const normalized = name
		.normalize('NFKC')
		.toLocaleLowerCase()
		.trim()
		.replace(/[^\p{Letter}\p{Number}]+/gu, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 70)
		.replace(/-+$/g, '');

	return `${normalized || 'category'}-${categoryId.toString(36)}`;
}

function parseParentId(value: unknown): number | null | undefined {
	if (value === null || value === undefined || value === '') return null;
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseDisplayOrder(value: unknown): number | undefined {
	if (value === null || value === undefined || value === '') return 0;
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 9999 ? parsed : undefined;
}

async function getExistingCategory(db: D1Database, categoryId: number): Promise<ExistingCategoryRow | null> {
	return db
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
			WHERE c.id = ?1 AND c.deleted_at IS NULL
			LIMIT 1
		`)
		.bind(categoryId)
		.first<ExistingCategoryRow>();
}

async function validateParent(db: D1Database, categoryId: number | null, parentId: number | null): Promise<string | null> {
	if (parentId === null) return null;
	if (categoryId !== null && parentId === categoryId) return 'CATEGORY_PARENT_SELF';

	const parent = await db
		.prepare('SELECT id FROM categories WHERE id = ?1 AND deleted_at IS NULL LIMIT 1')
		.bind(parentId)
		.first<{ id: number }>();
	if (!parent) return 'PARENT_CATEGORY_NOT_FOUND';

	if (categoryId !== null) {
		const cycle = await db
			.prepare(`
				WITH RECURSIVE descendants(id) AS (
					SELECT id FROM categories WHERE parent_id = ?1 AND deleted_at IS NULL
					UNION ALL
					SELECT c.id
					FROM categories AS c
					INNER JOIN descendants AS d ON c.parent_id = d.id
					WHERE c.deleted_at IS NULL
				)
				SELECT id FROM descendants WHERE id = ?2 LIMIT 1
			`)
			.bind(categoryId, parentId)
			.first<{ id: number }>();
		if (cycle) return 'CATEGORY_CYCLE';
	}

	return null;
}

async function readPayload(request: Request): Promise<{
	nameJa: string;
	nameKo: string;
	parentId: number | null;
	displayOrder: number;
} | Response> {
	let payload: CategoryPayload;
	try {
		payload = (await request.json()) as CategoryPayload;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}

	const nameJa = typeof payload.nameJa === 'string' ? payload.nameJa.trim() : '';
	const nameKo = typeof payload.nameKo === 'string' ? payload.nameKo.trim() : '';
	const parentId = parseParentId(payload.parentId);
	const displayOrder = parseDisplayOrder(payload.displayOrder);

	if (!nameJa || !nameKo) return json({ ok: false, error: 'CATEGORY_NAMES_REQUIRED' }, 400);
	if (nameJa.length > 100 || nameKo.length > 100) return json({ ok: false, error: 'CATEGORY_NAME_TOO_LONG' }, 400);
	if (parentId === undefined) return json({ ok: false, error: 'INVALID_PARENT_CATEGORY' }, 400);
	if (displayOrder === undefined) return json({ ok: false, error: 'INVALID_DISPLAY_ORDER' }, 400);

	return { nameJa, nameKo, parentId, displayOrder };
}

export async function handleCreateAdminCategory(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	const parsed = await readPayload(request);
	if (parsed instanceof Response) return parsed;
	const { nameJa, nameKo, parentId, displayOrder } = parsed;

	const parentError = await validateParent(env.song_project_db, null, parentId);
	if (parentError) return json({ ok: false, error: parentError }, 400);

	const categoryId = makeCategoryId();
	const now = new Date().toISOString();
	const slugJa = makeSlug(nameJa, categoryId);
	const slugKo = makeSlug(nameKo, categoryId);

	try {
		await env.song_project_db.batch([
			env.song_project_db
				.prepare(`INSERT INTO categories (id, parent_id, display_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)`)
				.bind(categoryId, parentId, displayOrder, now),
			env.song_project_db
				.prepare(`
					INSERT INTO category_translations
						(category_id, language_code, name, slug, created_at, updated_at)
					VALUES (?1, 'ja', ?2, ?3, ?4, ?4)
				`)
				.bind(categoryId, nameJa, slugJa, now),
			env.song_project_db
				.prepare(`
					INSERT INTO category_translations
						(category_id, language_code, name, slug, created_at, updated_at)
					VALUES (?1, 'ko', ?2, ?3, ?4, ?4)
				`)
				.bind(categoryId, nameKo, slugKo, now),
			env.song_project_db
				.prepare(`
					INSERT INTO audit_logs (admin_id, entity_type, entity_id, action, after_data, country_code, user_agent)
					VALUES (?1, 'category', ?2, 'create', ?3, ?4, ?5)
				`)
				.bind(
					session.adminId,
					categoryId,
					JSON.stringify({ parentId, displayOrder, nameJa, nameKo }),
					request.headers.get('CF-IPCountry'),
					request.headers.get('User-Agent'),
				),
		]);
	} catch (error) {
		console.error('Failed to create category', error);
		return json({ ok: false, error: 'CATEGORY_CREATE_FAILED' }, 500);
	}

	return json({ ok: true, category: { id: categoryId } }, 201);
}

export async function handleUpdateAdminCategory(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	const categoryId = Number(new URL(request.url).searchParams.get('id'));
	if (!Number.isSafeInteger(categoryId) || categoryId <= 0) return json({ ok: false, error: 'INVALID_CATEGORY_ID' }, 400);

	const existing = await getExistingCategory(env.song_project_db, categoryId);
	if (!existing) return json({ ok: false, error: 'CATEGORY_NOT_FOUND' }, 404);

	const parsed = await readPayload(request);
	if (parsed instanceof Response) return parsed;
	const { nameJa, nameKo, parentId, displayOrder } = parsed;

	const parentError = await validateParent(env.song_project_db, categoryId, parentId);
	if (parentError) return json({ ok: false, error: parentError }, 400);

	const now = new Date().toISOString();
	try {
		await env.song_project_db.batch([
			env.song_project_db
				.prepare('UPDATE categories SET parent_id = ?1, display_order = ?2, updated_at = ?3 WHERE id = ?4 AND deleted_at IS NULL')
				.bind(parentId, displayOrder, now, categoryId),
			env.song_project_db
				.prepare(`UPDATE category_translations SET name = ?1, updated_at = ?2 WHERE category_id = ?3 AND language_code = 'ja'`)
				.bind(nameJa, now, categoryId),
			env.song_project_db
				.prepare(`UPDATE category_translations SET name = ?1, updated_at = ?2 WHERE category_id = ?3 AND language_code = 'ko'`)
				.bind(nameKo, now, categoryId),
			env.song_project_db
				.prepare(`
					INSERT INTO audit_logs (admin_id, entity_type, entity_id, action, before_data, after_data, country_code, user_agent)
					VALUES (?1, 'category', ?2, 'update', ?3, ?4, ?5, ?6)
				`)
				.bind(
					session.adminId,
					categoryId,
					JSON.stringify({ parentId: existing.parent_id, displayOrder: existing.display_order, nameJa: existing.name_ja, nameKo: existing.name_ko }),
					JSON.stringify({ parentId, displayOrder, nameJa, nameKo }),
					request.headers.get('CF-IPCountry'),
					request.headers.get('User-Agent'),
				),
		]);
	} catch (error) {
		console.error('Failed to update category', error);
		return json({ ok: false, error: 'CATEGORY_UPDATE_FAILED' }, 500);
	}

	return json({ ok: true });
}

export async function handleDeleteAdminCategory(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	const categoryId = Number(new URL(request.url).searchParams.get('id'));
	if (!Number.isSafeInteger(categoryId) || categoryId <= 0) return json({ ok: false, error: 'INVALID_CATEGORY_ID' }, 400);

	const existing = await getExistingCategory(env.song_project_db, categoryId);
	if (!existing) return json({ ok: false, error: 'CATEGORY_NOT_FOUND' }, 404);

	const child = await env.song_project_db
		.prepare('SELECT id FROM categories WHERE parent_id = ?1 AND deleted_at IS NULL LIMIT 1')
		.bind(categoryId)
		.first<{ id: number }>();
	if (child) return json({ ok: false, error: 'CATEGORY_HAS_CHILDREN' }, 409);

	const now = new Date().toISOString();
	try {
		await env.song_project_db.batch([
			env.song_project_db
				.prepare('UPDATE posts SET category_id = NULL, updated_at = ?1 WHERE category_id = ?2 AND deleted_at IS NULL')
				.bind(now, categoryId),
			env.song_project_db
				.prepare('UPDATE categories SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL')
				.bind(now, categoryId),
			env.song_project_db
				.prepare(`
					INSERT INTO audit_logs (admin_id, entity_type, entity_id, action, before_data, country_code, user_agent)
					VALUES (?1, 'category', ?2, 'delete', ?3, ?4, ?5)
				`)
				.bind(
					session.adminId,
					categoryId,
					JSON.stringify({ parentId: existing.parent_id, displayOrder: existing.display_order, nameJa: existing.name_ja, nameKo: existing.name_ko }),
					request.headers.get('CF-IPCountry'),
					request.headers.get('User-Agent'),
				),
		]);
	} catch (error) {
		console.error('Failed to delete category', error);
		return json({ ok: false, error: 'CATEGORY_DELETE_FAILED' }, 500);
	}

	return json({ ok: true });
}
