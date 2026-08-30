import { getAuthenticatedAdminSession } from '../../auth/session';

type PublicLanguage = 'ja' | 'ko';
type PublicPostStatus = 'published' | 'private';

interface PublicPostListRow {
	id: number;
	status: PublicPostStatus;
	original_language: PublicLanguage;
	display_language: PublicLanguage;
	title: string;
	slug: string;
	excerpt: string | null;
	category_name: string | null;
	tag_names: string | null;
	published_at: string | null;
	updated_at: string;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, {
		status,
		headers: {
			'Cache-Control': 'no-store',
		},
	});
}

function parseLanguage(request: Request): PublicLanguage | null {
	const language = new URL(request.url).searchParams.get('lang');
	return language === 'ja' || language === 'ko' ? language : null;
}

export async function handleListPublicPosts(request: Request, env: Env): Promise<Response> {
	const language = parseLanguage(request);
	if (!language) return json({ ok: false, error: 'INVALID_LANGUAGE' }, 400);

	try {
		const session = await getAuthenticatedAdminSession(request, env.song_project_db);
		const adminView = Boolean(session);
		const result = await env.song_project_db
			.prepare(`
				SELECT
					p.id,
					p.status,
					p.original_language,
					pt.language_code AS display_language,
					pt.title,
					pt.slug,
					pt.excerpt,
					ct.name AS category_name,
					(
						SELECT GROUP_CONCAT(tt.name, CHAR(31))
						FROM post_tags AS ptag
						INNER JOIN tags AS t
							ON t.id = ptag.tag_id AND t.deleted_at IS NULL
						INNER JOIN tag_translations AS tt
							ON tt.tag_id = t.id AND tt.language_code = pt.language_code
						WHERE ptag.post_id = p.id
					) AS tag_names,
					p.published_at,
					p.updated_at
				FROM posts AS p
				INNER JOIN post_translations AS pt
					ON pt.post_id = p.id
					AND pt.language_code = CASE
						WHEN EXISTS (
							SELECT 1
							FROM post_translations AS preferred
							WHERE preferred.post_id = p.id
								AND preferred.language_code = ?1
								AND preferred.translation_status IN ('original', 'translated', 'reviewed')
						) THEN ?1
						ELSE p.original_language
					END
					AND pt.translation_status IN ('original', 'translated', 'reviewed')
				LEFT JOIN category_translations AS ct
					ON ct.category_id = p.category_id AND ct.language_code = pt.language_code
				WHERE (p.status = 'published' OR (?2 = 1 AND p.status = 'private'))
					AND p.deleted_at IS NULL
				ORDER BY datetime(COALESCE(p.published_at, p.updated_at)) DESC, p.id DESC
				LIMIT 100
			`)
			.bind(language, adminView ? 1 : 0)
			.all<PublicPostListRow>();

		return json({
			ok: true,
			language,
			adminView,
			posts: result.results.map((row) => ({
				id: row.id,
				status: row.status,
				visible: row.status === 'published',
				originalLanguage: row.original_language,
				displayLanguage: row.display_language,
				isLanguageFallback: row.display_language !== language,
				title: row.title,
				slug: row.slug,
				excerpt: row.excerpt,
				category: row.category_name,
				tags: row.tag_names ? row.tag_names.split(String.fromCharCode(31)).filter(Boolean) : [],
				publishedAt: row.published_at,
				updatedAt: row.updated_at,
			})),
		});
	} catch (error) {
		console.error('Failed to list public posts', error);
		return json({ ok: false, error: 'PUBLIC_POST_LIST_FAILED' }, 500);
	}
}
