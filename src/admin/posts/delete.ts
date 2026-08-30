import { getAuthenticatedAdminSession } from '../../auth/session';

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

export async function handleDeleteAdminPost(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);

	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	const postId = Number(new URL(request.url).searchParams.get('id'));
	if (!Number.isSafeInteger(postId) || postId <= 0) {
		return json({ ok: false, error: 'INVALID_POST_ID' }, 400);
	}

	const existing = await env.song_project_db
		.prepare(`SELECT id, status FROM posts WHERE id = ?1 AND deleted_at IS NULL LIMIT 1`)
		.bind(postId)
		.first<{ id: number; status: string }>();
	if (!existing) return json({ ok: false, error: 'POST_NOT_FOUND' }, 404);

	const now = new Date().toISOString();
	try {
		await env.song_project_db.batch([
			env.song_project_db
				.prepare(`UPDATE posts SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL`)
				.bind(now, postId),
			env.song_project_db
				.prepare(`
					INSERT INTO audit_logs
						(admin_id, entity_type, entity_id, action, before_data, after_data, country_code, user_agent)
					VALUES (?1, 'post', ?2, 'delete', ?3, ?4, ?5, ?6)
				`)
				.bind(
					session.adminId,
					postId,
					JSON.stringify({ status: existing.status, deletedAt: null }),
					JSON.stringify({ deletedAt: now }),
					request.headers.get('CF-IPCountry'),
					request.headers.get('User-Agent'),
				),
		]);
		return json({ ok: true, id: postId });
	} catch (error) {
		console.error('Failed to delete post', error);
		return json({ ok: false, error: 'POST_DELETE_FAILED' }, 500);
	}
}
