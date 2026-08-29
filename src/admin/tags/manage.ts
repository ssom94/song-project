import { getAuthenticatedAdminSession } from '../../auth/session';

interface TagPayload {
	nameJa?: unknown;
	nameKo?: unknown;
}

interface ExistingTagRow {
	id: number;
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

function makeTagId(): number {
	const random = new Uint32Array(1);
	crypto.getRandomValues(random);
	return (Date.now() * 1000) + (random[0] % 1000);
}

function makeSlug(name: string, tagId: number): string {
	const normalized = name
		.normalize('NFKC')
		.toLocaleLowerCase()
		.trim()
		.replace(/[^\p{Letter}\p{Number}]+/gu, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 70)
		.replace(/-+$/g, '');

	return `${normalized || 'tag'}-${tagId.toString(36)}`;
}

async function readPayload(request: Request): Promise<{ nameJa: string; nameKo: string } | Response> {
	let payload: TagPayload;
	try {
		payload = (await request.json()) as TagPayload;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}

	const nameJa = typeof payload.nameJa === 'string' ? payload.nameJa.trim() : '';
	const nameKo = typeof payload.nameKo === 'string' ? payload.nameKo.trim() : '';
	if (!nameJa || !nameKo) return json({ ok: false, error: 'TAG_NAMES_REQUIRED' }, 400);
	if (nameJa.length > 100 || nameKo.length > 100) return json({ ok: false, error: 'TAG_NAME_TOO_LONG' }, 400);
	return { nameJa, nameKo };
}

async function getExistingTag(db: D1Database, tagId: number): Promise<ExistingTagRow | null> {
	return db
		.prepare(`
			SELECT
				t.id,
				ja.name AS name_ja,
				ko.name AS name_ko
			FROM tags AS t
			LEFT JOIN tag_translations AS ja
				ON ja.tag_id = t.id AND ja.language_code = 'ja'
			LEFT JOIN tag_translations AS ko
				ON ko.tag_id = t.id AND ko.language_code = 'ko'
			WHERE t.id = ?1 AND t.deleted_at IS NULL
			LIMIT 1
		`)
		.bind(tagId)
		.first<ExistingTagRow>();
}

export async function handleCreateAdminTag(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	const parsed = await readPayload(request);
	if (parsed instanceof Response) return parsed;
	const { nameJa, nameKo } = parsed;
	const tagId = makeTagId();
	const now = new Date().toISOString();
	const slugJa = makeSlug(nameJa, tagId);
	const slugKo = makeSlug(nameKo, tagId);

	try {
		await env.song_project_db.batch([
			env.song_project_db
				.prepare('INSERT INTO tags (id, created_at, updated_at) VALUES (?1, ?2, ?2)')
				.bind(tagId, now),
			env.song_project_db
				.prepare(`
					INSERT INTO tag_translations
						(tag_id, language_code, name, slug, created_at, updated_at)
					VALUES (?1, 'ja', ?2, ?3, ?4, ?4)
				`)
				.bind(tagId, nameJa, slugJa, now),
			env.song_project_db
				.prepare(`
					INSERT INTO tag_translations
						(tag_id, language_code, name, slug, created_at, updated_at)
					VALUES (?1, 'ko', ?2, ?3, ?4, ?4)
				`)
				.bind(tagId, nameKo, slugKo, now),
			env.song_project_db
				.prepare(`
					INSERT INTO audit_logs (admin_id, entity_type, entity_id, action, after_data, country_code, user_agent)
					VALUES (?1, 'tag', ?2, 'create', ?3, ?4, ?5)
				`)
				.bind(
					session.adminId,
					tagId,
					JSON.stringify({ nameJa, nameKo }),
					request.headers.get('CF-IPCountry'),
					request.headers.get('User-Agent'),
				),
		]);
	} catch (error) {
		console.error('Failed to create tag', error);
		return json({ ok: false, error: 'TAG_CREATE_FAILED' }, 500);
	}

	return json({ ok: true, tag: { id: tagId } }, 201);
}

export async function handleUpdateAdminTag(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	const tagId = Number(new URL(request.url).searchParams.get('id'));
	if (!Number.isSafeInteger(tagId) || tagId <= 0) return json({ ok: false, error: 'INVALID_TAG_ID' }, 400);
	const existing = await getExistingTag(env.song_project_db, tagId);
	if (!existing) return json({ ok: false, error: 'TAG_NOT_FOUND' }, 404);

	const parsed = await readPayload(request);
	if (parsed instanceof Response) return parsed;
	const { nameJa, nameKo } = parsed;
	const now = new Date().toISOString();

	try {
		await env.song_project_db.batch([
			env.song_project_db
				.prepare('UPDATE tags SET updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL')
				.bind(now, tagId),
			env.song_project_db
				.prepare(`UPDATE tag_translations SET name = ?1, updated_at = ?2 WHERE tag_id = ?3 AND language_code = 'ja'`)
				.bind(nameJa, now, tagId),
			env.song_project_db
				.prepare(`UPDATE tag_translations SET name = ?1, updated_at = ?2 WHERE tag_id = ?3 AND language_code = 'ko'`)
				.bind(nameKo, now, tagId),
			env.song_project_db
				.prepare(`
					INSERT INTO audit_logs (admin_id, entity_type, entity_id, action, before_data, after_data, country_code, user_agent)
					VALUES (?1, 'tag', ?2, 'update', ?3, ?4, ?5, ?6)
				`)
				.bind(
					session.adminId,
					tagId,
					JSON.stringify({ nameJa: existing.name_ja, nameKo: existing.name_ko }),
					JSON.stringify({ nameJa, nameKo }),
					request.headers.get('CF-IPCountry'),
					request.headers.get('User-Agent'),
				),
		]);
	} catch (error) {
		console.error('Failed to update tag', error);
		return json({ ok: false, error: 'TAG_UPDATE_FAILED' }, 500);
	}

	return json({ ok: true });
}

export async function handleDeleteAdminTag(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	const tagId = Number(new URL(request.url).searchParams.get('id'));
	if (!Number.isSafeInteger(tagId) || tagId <= 0) return json({ ok: false, error: 'INVALID_TAG_ID' }, 400);
	const existing = await getExistingTag(env.song_project_db, tagId);
	if (!existing) return json({ ok: false, error: 'TAG_NOT_FOUND' }, 404);
	const now = new Date().toISOString();

	try {
		await env.song_project_db.batch([
			env.song_project_db
				.prepare('DELETE FROM post_tags WHERE tag_id = ?1')
				.bind(tagId),
			env.song_project_db
				.prepare('UPDATE tags SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL')
				.bind(now, tagId),
			env.song_project_db
				.prepare(`
					INSERT INTO audit_logs (admin_id, entity_type, entity_id, action, before_data, country_code, user_agent)
					VALUES (?1, 'tag', ?2, 'delete', ?3, ?4, ?5)
				`)
				.bind(
					session.adminId,
					tagId,
					JSON.stringify({ nameJa: existing.name_ja, nameKo: existing.name_ko }),
					request.headers.get('CF-IPCountry'),
					request.headers.get('User-Agent'),
				),
		]);
	} catch (error) {
		console.error('Failed to delete tag', error);
		return json({ ok: false, error: 'TAG_DELETE_FAILED' }, 500);
	}

	return json({ ok: true });
}
