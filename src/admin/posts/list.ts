import { getAuthenticatedAdminSession } from '../../auth/session';

interface AdminPostListRow {
	id: number;
	post_number: number;
	original_language: 'ja' | 'ko';
	status: 'draft' | 'published' | 'private';
	category_id: number | null;
	category_name_ja: string | null;
	category_name_ko: string | null;
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
					ROW_NUMBER() OVER (ORDER BY datetime(p.created_at) ASC, p.id ASC) AS post_number,
					p.original_language,
					p.status,
					p.category_id,
					p.updated_at,
					p.published_at,
					pt.title,
					pt.slug,
					ct_ja.name AS category_name_ja,
					ct_ko.name AS category_name_ko
				FROM posts AS p
				INNER JOIN post_translations AS pt
					ON pt.post_id = p.id
					AND pt.language_code = p.original_language
				LEFT JOIN category_translations AS ct_ja
					ON ct_ja.category_id = p.category_id
					AND ct_ja.language_code = 'ja'
				LEFT JOIN category_translations AS ct_ko
					ON ct_ko.category_id = p.category_id
					AND ct_ko.language_code = 'ko'
				WHERE p.deleted_at IS NULL
				ORDER BY datetime(p.updated_at) DESC, p.id DESC
				LIMIT 100
			`)
			.all<AdminPostListRow>();

		return json({
			ok: true,
			posts: result.results.map((row) => ({
				id: row.id,
				postNumber: row.post_number,
				title: row.title,
				slug: row.slug,
				originalLanguage: row.original_language,
				status: row.status,
				categoryId: row.category_id,
				categoryNames: {
					ja: row.category_name_ja,
					ko: row.category_name_ko,
				},
				updatedAt: row.updated_at,
				publishedAt: row.published_at,
			})),
		});
	} catch (error) {
		console.error('Failed to list posts', error);
		return json({ ok: false, error: 'LIST_FAILED' }, 500);
	}
}
