type PublicLanguage = 'ja' | 'ko';

type TranslationStatus = 'original' | 'pending' | 'translated' | 'reviewed';

interface ResolvedPostRow {
	id: number;
	original_language: PublicLanguage;
	published_at: string | null;
	updated_at: string;
}

interface PublicTranslationRow {
	language_code: PublicLanguage;
	title: string;
	slug: string;
	content: string;
	excerpt: string | null;
	translation_status: TranslationStatus;
	category_name: string | null;
}

interface PublicTagRow {
	language_code: PublicLanguage;
	name: string;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, {
		status,
		headers: {
			'Cache-Control': 'public, max-age=60',
		},
	});
}

function parseLanguage(value: string | null): PublicLanguage | null {
	return value === 'ja' || value === 'ko' ? value : null;
}

export async function handleGetPublicPost(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const language = parseLanguage(url.searchParams.get('lang'));
	const slug = url.searchParams.get('slug')?.trim() ?? '';
	if (!language || !slug || slug.length > 200) {
		return json({ ok: false, error: 'INVALID_REQUEST' }, 400);
	}

	try {
		const post = await env.song_project_db
			.prepare(`
				SELECT
					p.id,
					p.original_language,
					p.published_at,
					p.updated_at
				FROM posts AS p
				INNER JOIN post_translations AS resolver
					ON resolver.post_id = p.id
				WHERE resolver.slug = ?1
					AND p.status = 'published'
					AND p.deleted_at IS NULL
				LIMIT 1
			`)
			.bind(slug)
			.first<ResolvedPostRow>();

		if (!post) return json({ ok: false, error: 'POST_NOT_FOUND' }, 404);

		const [translationsResult, tagsResult] = await Promise.all([
			env.song_project_db
				.prepare(`
					SELECT
						pt.language_code,
						pt.title,
						pt.slug,
						pt.content,
						pt.excerpt,
						pt.translation_status,
						ct.name AS category_name
					FROM post_translations AS pt
					LEFT JOIN posts AS p ON p.id = pt.post_id
					LEFT JOIN category_translations AS ct
						ON ct.category_id = p.category_id
						AND ct.language_code = pt.language_code
					WHERE pt.post_id = ?1
						AND pt.translation_status IN ('original', 'translated', 'reviewed')
					ORDER BY CASE WHEN pt.language_code = ?2 THEN 0 ELSE 1 END, pt.language_code
				`)
				.bind(post.id, language)
				.all<PublicTranslationRow>(),
			env.song_project_db
				.prepare(`
					SELECT tt.language_code, tt.name
					FROM post_tags AS ptag
					INNER JOIN tags AS t
						ON t.id = ptag.tag_id AND t.deleted_at IS NULL
					INNER JOIN tag_translations AS tt ON tt.tag_id = t.id
					WHERE ptag.post_id = ?1
					ORDER BY tt.language_code, tt.name COLLATE NOCASE
				`)
				.bind(post.id)
				.all<PublicTagRow>(),
		]);

		const tagsByLanguage: Record<PublicLanguage, string[]> = { ja: [], ko: [] };
		for (const row of tagsResult.results) tagsByLanguage[row.language_code].push(row.name);

		const translations = Object.fromEntries(
			translationsResult.results.map((translation) => [
				translation.language_code,
				{
					languageCode: translation.language_code,
					title: translation.title,
					slug: translation.slug,
					content: translation.content,
					excerpt: translation.excerpt,
					category: translation.category_name,
					tags: tagsByLanguage[translation.language_code],
					translationStatus: translation.translation_status,
				},
			]),
		) as Partial<Record<PublicLanguage, unknown>>;

		return json({
			ok: true,
			requestedLanguage: language,
			post: {
				id: post.id,
				originalLanguage: post.original_language,
				publishedAt: post.published_at,
				updatedAt: post.updated_at,
				translations,
			},
		});
	} catch (error) {
		console.error('Failed to load public post', error);
		return json({ ok: false, error: 'PUBLIC_POST_LOAD_FAILED' }, 500);
	}
}
