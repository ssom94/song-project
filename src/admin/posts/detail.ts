import { getAuthenticatedAdminSession } from '../../auth/session';

interface AdminPostRow {
	id: number;
	original_language: 'ja' | 'ko';
	status: 'draft' | 'published' | 'private';
	category_id: number | null;
	published_at: string | null;
	created_at: string;
	updated_at: string;
}

interface AdminPostTranslationRow {
	language_code: 'ja' | 'ko';
	title: string;
	slug: string;
	content: string;
	excerpt: string | null;
	translation_status: 'original' | 'pending' | 'translated' | 'reviewed';
	created_at: string;
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

export async function handleGetAdminPost(request: Request, env: Env): Promise<Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) {
		return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	}

	const url = new URL(request.url);
	const postId = Number(url.searchParams.get('id'));
	if (!Number.isSafeInteger(postId) || postId <= 0) {
		return json({ ok: false, error: 'INVALID_POST_ID' }, 400);
	}

	try {
		const post = await env.song_project_db
			.prepare(`
				SELECT
					id,
					original_language,
					status,
					category_id,
					published_at,
					created_at,
					updated_at
				FROM posts
				WHERE id = ?1
					AND deleted_at IS NULL
				LIMIT 1
			`)
			.bind(postId)
			.first<AdminPostRow>();

		if (!post) {
			return json({ ok: false, error: 'POST_NOT_FOUND' }, 404);
		}

		const translations = await env.song_project_db
			.prepare(`
				SELECT
					language_code,
					title,
					slug,
					content,
					excerpt,
					translation_status,
					created_at,
					updated_at
				FROM post_translations
				WHERE post_id = ?1
				ORDER BY CASE WHEN language_code = ?2 THEN 0 ELSE 1 END, language_code
			`)
			.bind(postId, post.original_language)
			.all<AdminPostTranslationRow>();

		return json({
			ok: true,
			post: {
				id: post.id,
				originalLanguage: post.original_language,
				status: post.status,
				categoryId: post.category_id,
				publishedAt: post.published_at,
				createdAt: post.created_at,
				updatedAt: post.updated_at,
				translations: translations.results.map((translation) => ({
					languageCode: translation.language_code,
					title: translation.title,
					slug: translation.slug,
					content: translation.content,
					excerpt: translation.excerpt,
					translationStatus: translation.translation_status,
					createdAt: translation.created_at,
					updatedAt: translation.updated_at,
				})),
			},
		});
	} catch (error) {
		console.error('Failed to load admin post', error);
		return json({ ok: false, error: 'POST_LOAD_FAILED' }, 500);
	}
}
