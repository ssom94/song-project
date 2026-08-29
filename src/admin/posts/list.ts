import { getAuthenticatedAdminSession } from '../../auth/session';

interface AdminPostListRow {
	id: number;
	original_language: 'ja' | 'ko';
	status: 'draft' | 'published' | 'private';
	title: string;
	slug: string;
	updated_at: string;
	published_at: string | null;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, {
		status,
		headers: {
			'Cache-Control': 'no-store',
		},
	});
}

export async function handleListAdminPosts(request: Request, env: Env): Promise<Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) {
		return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	}

	try {
		const result = await env.song_project_db
			.prepare(`
				SELECT
					p.id,
					p.original_language,
					p.status,
					p.updated_at,
					p.published_at,
					pt.title,
					pt.slug
				FROM posts AS p
				INNER JOIN post_translations AS pt
					ON pt.post_id = p.id
					AND pt.language_code = p.original_language
				WHERE p.deleted_at IS NULL
				ORDER BY datetime(p.updated_at) DESC, p.id DESC
				LIMIT 100
			`)
			.all<AdminPostListRow>();

		return json({
			ok: true,
			posts: result.results.map((row) => ({
				id: row.id,
				title: row.title,
				slug: row.slug,
				originalLanguage: row.original_language,
				status: row.status,
				updatedAt: row.updated_at,
				publishedAt: row.published_at,
			})),
		});
	} catch (error) {
		console.error('Failed to list posts', error);
		return json({ ok: false, error: 'LIST_FAILED' }, 500);
	}
}
