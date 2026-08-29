import { getAuthenticatedAdminSession } from '../../auth/session';

type CategoryPayload = {
	nameJa?: unknown;
	nameKo?: unknown;
	description?: unknown;
	parentId?: unknown;
	displayOrder?: unknown;
};

interface ExistingCategoryRow {
	id: number;
	parent_id: number | null;
	name_ja: string;
	name_ko: string;
	description: string | null;
	display_order: number;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
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

async function readPayload(request: Request): Promise<{
	nameJa: string;
	nameKo: string;
	description: string;
	parentId: number | null;
	displayOrder: number;
} | Response> {
	let payload: CategoryPayload;
	try {
		payload = await request.json() as CategoryPayload;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}

	const nameJa = typeof payload.nameJa === 'string' ? payload.nameJa.trim() : '';
	const nameKo = typeof payload.nameKo === 'string' ? payload.nameKo.trim() : '';
	const description = typeof payload.description === 'string' ? payload.description.trim() : '';
	const parentId = parseParentId(payload.parentId);
	const displayOrder = parseDisplayOrder(payload.displayOrder);

	if (!nameJa || !nameKo) return json({ ok: false, error: 'JAPANESE_CATEGORY_NAMES_REQUIRED' }, 400);
	if (nameJa.length > 100 || nameKo.length > 100) return json({ ok: false, error: 'JAPANESE_CATEGORY_NAME_TOO_LONG' }, 400);
	if (description.length > 500) return json({ ok: false, error: 'JAPANESE_CATEGORY_DESCRIPTION_TOO_LONG' }, 400);
	if (parentId === undefined) return json({ ok: false, error: 'INVALID_PARENT_JAPANESE_CATEGORY' }, 400);
	if (displayOrder === undefined) return json({ ok: false, error: 'INVALID_DISPLAY_ORDER' }, 400);
	return { nameJa, nameKo, description, parentId, displayOrder };
}

async function getExistingCategory(db: D1Database, id: number): Promise<ExistingCategoryRow | null> {
	return db.prepare(`
		SELECT id, parent_id, name_ja, name_ko, description, display_order
		FROM japanese_categories
		WHERE id = ?1 AND deleted_at IS NULL
		LIMIT 1
	`).bind(id).first<ExistingCategoryRow>();
}

async function validateParent(db: D1Database, categoryId: number | null, parentId: number | null): Promise<string | null> {
	if (parentId === null) return null;
	if (categoryId !== null && parentId === categoryId) return 'JAPANESE_CATEGORY_PARENT_SELF';

	const parent = await db
		.prepare('SELECT id FROM japanese_categories WHERE id = ?1 AND deleted_at IS NULL LIMIT 1')
		.bind(parentId)
		.first();
	if (!parent) return 'PARENT_JAPANESE_CATEGORY_NOT_FOUND';

	if (categoryId !== null) {
		const cycle = await db.prepare(`
			WITH RECURSIVE descendants(id) AS (
				SELECT id FROM japanese_categories WHERE parent_id = ?1 AND deleted_at IS NULL
				UNION ALL
				SELECT c.id
				FROM japanese_categories AS c
				INNER JOIN descendants AS d ON c.parent_id = d.id
				WHERE c.deleted_at IS NULL
			)
			SELECT id FROM descendants WHERE id = ?2 LIMIT 1
		`).bind(categoryId, parentId).first();
		if (cycle) return 'JAPANESE_CATEGORY_CYCLE';
	}
	return null;
}

export async function handleListAdminJapaneseCategories(request: Request, env: Env): Promise<Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	try {
		const result = await env.song_project_db.prepare(`
			SELECT
				c.id,
				c.parent_id,
				c.name_ja,
				c.name_ko,
				c.description,
				c.display_order,
				COUNT(w.id) AS word_count
			FROM japanese_categories AS c
			LEFT JOIN japanese_word_categories AS wc ON wc.category_id = c.id
			LEFT JOIN japanese_words AS w ON w.id = wc.word_id AND w.deleted_at IS NULL
			WHERE c.deleted_at IS NULL
			GROUP BY c.id
			ORDER BY c.display_order ASC, c.id ASC
		`).all();
		return json({ ok: true, categories: result.results });
	} catch (error) {
		console.error('Failed to list Japanese categories', error);
		return json({ ok: false, error: 'JAPANESE_CATEGORY_LIST_FAILED' }, 500);
	}
}

export async function handleCreateAdminJapaneseCategory(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	const parsed = await readPayload(request);
	if (parsed instanceof Response) return parsed;

	const parentError = await validateParent(env.song_project_db, null, parsed.parentId);
	if (parentError) return json({ ok: false, error: parentError }, 400);

	const id = makeCategoryId();
	const now = new Date().toISOString();
	try {
		await env.song_project_db.batch([
			env.song_project_db.prepare(`
				INSERT INTO japanese_categories
					(id, parent_id, name_ja, name_ko, description, display_order, created_at, updated_at)
				VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
			`).bind(id, parsed.parentId, parsed.nameJa, parsed.nameKo, parsed.description || null, parsed.displayOrder, now),
			env.song_project_db.prepare(`
				INSERT INTO audit_logs (admin_id, entity_type, entity_id, action, after_data, country_code, user_agent)
				VALUES (?1, 'japanese_category', ?2, 'create', ?3, ?4, ?5)
			`).bind(session.adminId, id, JSON.stringify(parsed), request.headers.get('CF-IPCountry'), request.headers.get('User-Agent')),
		]);
		return json({ ok: true, category: { id } }, 201);
	} catch (error) {
		console.error('Failed to create Japanese category', error);
		return json({ ok: false, error: 'JAPANESE_CATEGORY_CREATE_FAILED' }, 500);
	}
}

export async function handleUpdateAdminJapaneseCategory(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	const id = Number(new URL(request.url).searchParams.get('id'));
	if (!Number.isSafeInteger(id) || id <= 0) return json({ ok: false, error: 'INVALID_JAPANESE_CATEGORY_ID' }, 400);
	const existing = await getExistingCategory(env.song_project_db, id);
	if (!existing) return json({ ok: false, error: 'JAPANESE_CATEGORY_NOT_FOUND' }, 404);

	const parsed = await readPayload(request);
	if (parsed instanceof Response) return parsed;
	const parentError = await validateParent(env.song_project_db, id, parsed.parentId);
	if (parentError) return json({ ok: false, error: parentError }, 400);

	const now = new Date().toISOString();
	try {
		await env.song_project_db.batch([
			env.song_project_db.prepare(`
				UPDATE japanese_categories
				SET parent_id = ?1, name_ja = ?2, name_ko = ?3, description = ?4, display_order = ?5, updated_at = ?6
				WHERE id = ?7 AND deleted_at IS NULL
			`).bind(parsed.parentId, parsed.nameJa, parsed.nameKo, parsed.description || null, parsed.displayOrder, now, id),
			env.song_project_db.prepare(`
				INSERT INTO audit_logs (admin_id, entity_type, entity_id, action, before_data, after_data, country_code, user_agent)
				VALUES (?1, 'japanese_category', ?2, 'update', ?3, ?4, ?5, ?6)
			`).bind(session.adminId, id, JSON.stringify(existing), JSON.stringify(parsed), request.headers.get('CF-IPCountry'), request.headers.get('User-Agent')),
		]);
		return json({ ok: true });
	} catch (error) {
		console.error('Failed to update Japanese category', error);
		return json({ ok: false, error: 'JAPANESE_CATEGORY_UPDATE_FAILED' }, 500);
	}
}

export async function handleDeleteAdminJapaneseCategory(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	const id = Number(new URL(request.url).searchParams.get('id'));
	if (!Number.isSafeInteger(id) || id <= 0) return json({ ok: false, error: 'INVALID_JAPANESE_CATEGORY_ID' }, 400);
	const existing = await getExistingCategory(env.song_project_db, id);
	if (!existing) return json({ ok: false, error: 'JAPANESE_CATEGORY_NOT_FOUND' }, 404);

	const child = await env.song_project_db
		.prepare('SELECT id FROM japanese_categories WHERE parent_id = ?1 AND deleted_at IS NULL LIMIT 1')
		.bind(id)
		.first();
	if (child) return json({ ok: false, error: 'JAPANESE_CATEGORY_HAS_CHILDREN' }, 409);

	const used = await env.song_project_db.prepare(`
		SELECT wc.word_id
		FROM japanese_word_categories AS wc
		INNER JOIN japanese_words AS w ON w.id = wc.word_id AND w.deleted_at IS NULL
		WHERE wc.category_id = ?1
		LIMIT 1
	`).bind(id).first();
	if (used) return json({ ok: false, error: 'JAPANESE_CATEGORY_IN_USE' }, 409);

	const now = new Date().toISOString();
	try {
		await env.song_project_db.batch([
			env.song_project_db.prepare(`
				UPDATE japanese_categories
				SET deleted_at = ?1, updated_at = ?1
				WHERE id = ?2 AND deleted_at IS NULL
			`).bind(now, id),
			env.song_project_db.prepare(`
				INSERT INTO audit_logs (admin_id, entity_type, entity_id, action, before_data, country_code, user_agent)
				VALUES (?1, 'japanese_category', ?2, 'delete', ?3, ?4, ?5)
			`).bind(session.adminId, id, JSON.stringify(existing), request.headers.get('CF-IPCountry'), request.headers.get('User-Agent')),
		]);
		return json({ ok: true });
	} catch (error) {
		console.error('Failed to delete Japanese category', error);
		return json({ ok: false, error: 'JAPANESE_CATEGORY_DELETE_FAILED' }, 500);
	}
}
