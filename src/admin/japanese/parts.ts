import { getAuthenticatedAdminSession } from '../../auth/session';

type PartPayload = {
	nameJa?: unknown;
	nameKo?: unknown;
	parentId?: unknown;
	displayOrder?: unknown;
};

interface ExistingPartRow {
	id: number;
	parent_id: number | null;
	display_order: number;
	name_ja: string;
	name_ko: string;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

function makePartId(): number {
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
	parentId: number | null;
	displayOrder: number;
} | Response> {
	let payload: PartPayload;
	try {
		payload = await request.json() as PartPayload;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}

	const nameJa = typeof payload.nameJa === 'string' ? payload.nameJa.trim() : '';
	const nameKo = typeof payload.nameKo === 'string' ? payload.nameKo.trim() : '';
	const parentId = parseParentId(payload.parentId);
	const displayOrder = parseDisplayOrder(payload.displayOrder);
	if (!nameJa || !nameKo) return json({ ok: false, error: 'PART_NAMES_REQUIRED' }, 400);
	if (nameJa.length > 100 || nameKo.length > 100) return json({ ok: false, error: 'PART_NAME_TOO_LONG' }, 400);
	if (parentId === undefined) return json({ ok: false, error: 'INVALID_PARENT_PART' }, 400);
	if (displayOrder === undefined) return json({ ok: false, error: 'INVALID_DISPLAY_ORDER' }, 400);
	return { nameJa, nameKo, parentId, displayOrder };
}

async function getExistingPart(db: D1Database, id: number): Promise<ExistingPartRow | null> {
	return db.prepare(`
		SELECT id, parent_id, display_order, name_ja, name_ko
		FROM parts_of_speech
		WHERE id = ?1 AND deleted_at IS NULL
		LIMIT 1
	`).bind(id).first<ExistingPartRow>();
}

async function validateParent(db: D1Database, partId: number | null, parentId: number | null): Promise<string | null> {
	if (parentId === null) return null;
	if (partId !== null && parentId === partId) return 'PART_PARENT_SELF';
	const parent = await db.prepare('SELECT id FROM parts_of_speech WHERE id = ?1 AND deleted_at IS NULL LIMIT 1').bind(parentId).first();
	if (!parent) return 'PARENT_PART_NOT_FOUND';
	if (partId !== null) {
		const cycle = await db.prepare(`
			WITH RECURSIVE descendants(id) AS (
				SELECT id FROM parts_of_speech WHERE parent_id = ?1 AND deleted_at IS NULL
				UNION ALL
				SELECT p.id FROM parts_of_speech AS p
				INNER JOIN descendants AS d ON p.parent_id = d.id
				WHERE p.deleted_at IS NULL
			)
			SELECT id FROM descendants WHERE id = ?2 LIMIT 1
		`).bind(partId, parentId).first();
		if (cycle) return 'PART_CYCLE';
	}
	return null;
}

export async function handleListAdminJapaneseParts(request: Request, env: Env): Promise<Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	try {
		const result = await env.song_project_db.prepare(`
			SELECT p.id, p.parent_id, p.name_ja, p.name_ko, p.display_order,
				COUNT(w.id) AS word_count
			FROM parts_of_speech AS p
			LEFT JOIN japanese_word_parts_of_speech AS wp ON wp.part_of_speech_id = p.id
			LEFT JOIN japanese_words AS w ON w.id = wp.word_id AND w.deleted_at IS NULL
			WHERE p.deleted_at IS NULL
			GROUP BY p.id
			ORDER BY p.display_order ASC, p.id ASC
		`).all();
		return json({ ok: true, parts: result.results });
	} catch (error) {
		console.error('Failed to list parts of speech', error);
		return json({ ok: false, error: 'PART_LIST_FAILED' }, 500);
	}
}

export async function handleCreateAdminJapanesePart(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	const parsed = await readPayload(request);
	if (parsed instanceof Response) return parsed;
	const parentError = await validateParent(env.song_project_db, null, parsed.parentId);
	if (parentError) return json({ ok: false, error: parentError }, 400);

	const id = makePartId();
	const now = new Date().toISOString();
	try {
		await env.song_project_db.batch([
			env.song_project_db.prepare(`
				INSERT INTO parts_of_speech (id, name_ja, name_ko, parent_id, display_order, created_at, updated_at)
				VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
			`).bind(id, parsed.nameJa, parsed.nameKo, parsed.parentId, parsed.displayOrder, now),
			env.song_project_db.prepare(`
				INSERT INTO audit_logs (admin_id, entity_type, entity_id, action, after_data, country_code, user_agent)
				VALUES (?1, 'japanese_part_of_speech', ?2, 'create', ?3, ?4, ?5)
			`).bind(session.adminId, id, JSON.stringify(parsed), request.headers.get('CF-IPCountry'), request.headers.get('User-Agent')),
		]);
		return json({ ok: true, part: { id } }, 201);
	} catch (error) {
		console.error('Failed to create part of speech', error);
		return json({ ok: false, error: 'PART_CREATE_FAILED' }, 500);
	}
}

export async function handleUpdateAdminJapanesePart(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	const id = Number(new URL(request.url).searchParams.get('id'));
	if (!Number.isSafeInteger(id) || id <= 0) return json({ ok: false, error: 'INVALID_PART_ID' }, 400);
	const existing = await getExistingPart(env.song_project_db, id);
	if (!existing) return json({ ok: false, error: 'PART_NOT_FOUND' }, 404);
	const parsed = await readPayload(request);
	if (parsed instanceof Response) return parsed;
	const parentError = await validateParent(env.song_project_db, id, parsed.parentId);
	if (parentError) return json({ ok: false, error: parentError }, 400);

	const now = new Date().toISOString();
	try {
		await env.song_project_db.batch([
			env.song_project_db.prepare(`
				UPDATE parts_of_speech
				SET name_ja = ?1, name_ko = ?2, parent_id = ?3, display_order = ?4, updated_at = ?5
				WHERE id = ?6 AND deleted_at IS NULL
			`).bind(parsed.nameJa, parsed.nameKo, parsed.parentId, parsed.displayOrder, now, id),
			env.song_project_db.prepare(`
				INSERT INTO audit_logs (admin_id, entity_type, entity_id, action, before_data, after_data, country_code, user_agent)
				VALUES (?1, 'japanese_part_of_speech', ?2, 'update', ?3, ?4, ?5, ?6)
			`).bind(session.adminId, id, JSON.stringify(existing), JSON.stringify(parsed), request.headers.get('CF-IPCountry'), request.headers.get('User-Agent')),
		]);
		return json({ ok: true });
	} catch (error) {
		console.error('Failed to update part of speech', error);
		return json({ ok: false, error: 'PART_UPDATE_FAILED' }, 500);
	}
}

export async function handleDeleteAdminJapanesePart(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	const id = Number(new URL(request.url).searchParams.get('id'));
	if (!Number.isSafeInteger(id) || id <= 0) return json({ ok: false, error: 'INVALID_PART_ID' }, 400);
	const existing = await getExistingPart(env.song_project_db, id);
	if (!existing) return json({ ok: false, error: 'PART_NOT_FOUND' }, 404);
	const child = await env.song_project_db.prepare('SELECT id FROM parts_of_speech WHERE parent_id = ?1 AND deleted_at IS NULL LIMIT 1').bind(id).first();
	if (child) return json({ ok: false, error: 'PART_HAS_CHILDREN' }, 409);
	const used = await env.song_project_db.prepare(`
		SELECT wp.word_id
		FROM japanese_word_parts_of_speech AS wp
		INNER JOIN japanese_words AS w ON w.id = wp.word_id AND w.deleted_at IS NULL
		WHERE wp.part_of_speech_id = ?1
		LIMIT 1
	`).bind(id).first();
	if (used) return json({ ok: false, error: 'PART_IN_USE' }, 409);
	const now = new Date().toISOString();
	try {
		await env.song_project_db.batch([
			env.song_project_db.prepare('UPDATE parts_of_speech SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL').bind(now, id),
			env.song_project_db.prepare(`
				INSERT INTO audit_logs (admin_id, entity_type, entity_id, action, before_data, country_code, user_agent)
				VALUES (?1, 'japanese_part_of_speech', ?2, 'delete', ?3, ?4, ?5)
			`).bind(session.adminId, id, JSON.stringify(existing), request.headers.get('CF-IPCountry'), request.headers.get('User-Agent')),
		]);
		return json({ ok: true });
	} catch (error) {
		console.error('Failed to delete part of speech', error);
		return json({ ok: false, error: 'PART_DELETE_FAILED' }, 500);
	}
}
