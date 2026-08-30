import { getAuthenticatedAdminSession } from '../../auth/session';

type PostStatus = 'draft' | 'published' | 'private';

interface ExistingPostRow {
	id: number;
	status: PostStatus;
	published_at: string | null;
}

interface VisibilityPayload {
	visible?: unknown;
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

export async function handleUpdateAdminPostVisibility(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);

	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	const url = new URL(request.url);
	const postId = Number(url.searchParams.get('id'));
	if (!Number.isSafeInteger(postId) || postId <= 0) {
		return json({ ok: false, error: 'INVALID_POST_ID' }, 400);
	}

	let payload: VisibilityPayload;
	try {
		payload = await request.json() as VisibilityPayload;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}
	if (typeof payload.visible !== 'boolean') {
		return json({ ok: false, error: 'VISIBLE_REQUIRED' }, 400);
	}

	const existing = await env.song_project_db
		.prepare(`
			SELECT id, status, published_at
			FROM posts
			WHERE id = ?1 AND deleted_at IS NULL
			LIMIT 1
		`)
		.bind(postId)
		.first<ExistingPostRow>();

	if (!existing) return json({ ok: false, error: 'POST_NOT_FOUND' }, 404);
	if (existing.status === 'draft') {
		return json({ ok: false, error: 'POST_NOT_REGISTERED' }, 409);
	}

	const nextStatus: PostStatus = payload.visible ? 'published' : 'private';
	if (nextStatus === existing.status) {
		return json({ ok: true, status: nextStatus, visible: payload.visible });
	}

	const now = new Date().toISOString();
	const publishedAt = payload.visible ? (existing.published_at ?? now) : existing.published_at;

	try {
		await env.song_project_db.batch([
			env.song_project_db
				.prepare(`
					UPDATE posts
					SET status = ?1, published_at = ?2, updated_at = ?3
					WHERE id = ?4 AND deleted_at IS NULL
				`)
				.bind(nextStatus, publishedAt, now, postId),
			env.song_project_db
				.prepare(`
					INSERT INTO audit_logs
						(admin_id, entity_type, entity_id, action, before_data, after_data, country_code, user_agent)
					VALUES (?1, 'post', ?2, ?3, ?4, ?5, ?6, ?7)
				`)
				.bind(
					session.adminId,
					postId,
					payload.visible ? 'publish' : 'unpublish',
					JSON.stringify({ status: existing.status }),
					JSON.stringify({ status: nextStatus }),
					request.headers.get('CF-IPCountry'),
					request.headers.get('User-Agent'),
				),
		]);

		return json({ ok: true, status: nextStatus, visible: payload.visible });
	} catch (error) {
		console.error('Failed to update post visibility', error);
		return json({ ok: false, error: 'VISIBILITY_UPDATE_FAILED' }, 500);
	}
}
