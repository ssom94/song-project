import { getAuthenticatedAdminSession } from '../../auth/session';

type PublicLanguage = 'ja' | 'ko';
type PublicPostStatus = 'published' | 'private';

const PAGE_SIZE = 10;

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
	global_row_number: number;
	global_total: number;
}

interface CountRow {
	total: number;
}

interface CategoryCountRow {
	category_name: string;
	post_count: number;
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

function parsePage(request: Request): number {
	const raw = Number(new URL(request.url).searchParams.get('page') ?? '1');
	return Number.isSafeInteger(raw) && raw > 0 ? raw : 1;
}

function parseCategory(request: Request): string {
	return (new URL(request.url).searchParams.get('category') ?? '').trim().slice(0, 120);
}

function requestedManageView(request: Request): boolean {
	return new URL(request.url).searchParams.get('manage') === '1';
}

function basePostCte(): string {
	return `
		WITH visible_posts AS (
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
				p.updated_at,
				ROW_NUMBER() OVER (
					ORDER BY datetime(COALESCE(p.published_at, p.updated_at)) DESC, p.id DESC
				) AS global_row_number
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
		)
	`;
}

export async function handleListPublicPosts(request: Request, env: Env): Promise<Response> {
	const language = parseLanguage(request);
	if (!language) return json({ ok: false, error: 'INVALID_LANGUAGE' }, 400);

	const requestedPage = parsePage(request);
	const category = parseCategory(request);

	try {
		const session = await getAuthenticatedAdminSession(request, env.song_project_db);
		const adminView = Boolean(session) && requestedManageView(request);
		const adminFlag = adminView ? 1 : 0;

		const countResult = await env.song_project_db
			.prepare(`${basePostCte()}
				SELECT COUNT(*) AS total
				FROM visible_posts
				WHERE (?3 = '' OR category_name = ?3)
			`)
			.bind(language, adminFlag, category)
			.first<CountRow>();

		const totalItems = Number(countResult?.total ?? 0);
		const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
		const page = Math.min(requestedPage, totalPages);
		const offset = (page - 1) * PAGE_SIZE;

		const result = await env.song_project_db
			.prepare(`${basePostCte()}
				SELECT
					visible_posts.*,
					(SELECT COUNT(*) FROM visible_posts) AS global_total
				FROM visible_posts
				WHERE (?3 = '' OR category_name = ?3)
				ORDER BY global_row_number ASC
				LIMIT ?4 OFFSET ?5
			`)
			.bind(language, adminFlag, category, PAGE_SIZE, offset)
			.all<PublicPostListRow>();

		const categoryResult = await env.song_project_db
			.prepare(`${basePostCte()}
				SELECT category_name, COUNT(*) AS post_count
				FROM visible_posts
				WHERE category_name IS NOT NULL AND TRIM(category_name) <> ''
				GROUP BY category_name
				ORDER BY category_name COLLATE NOCASE ASC
			`)
			.bind(language, adminFlag)
			.all<CategoryCountRow>();

		return json({
			ok: true,
			language,
			adminView,
			category: category || null,
			pagination: {
				page,
				pageSize: PAGE_SIZE,
				totalItems,
				totalPages: totalItems === 0 ? 0 : totalPages,
			},
			categories: categoryResult.results.map((row) => ({
				name: row.category_name,
				count: Number(row.post_count ?? 0),
			})),
			posts: result.results.map((row) => ({
				id: row.id,
				postNumber: Number(row.global_total ?? 0) - Number(row.global_row_number ?? 0) + 1,
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
