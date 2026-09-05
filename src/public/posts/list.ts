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
	category_id: number | null;
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
	category_id: number;
	parent_id: number | null;
	depth: number;
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
	return (new URL(request.url).searchParams.get('category') ?? '').trim().slice(0, 240);
}

function requestedManageView(request: Request): boolean {
	return new URL(request.url).searchParams.get('manage') === '1';
}

function basePostCte(): string {
	return `
		WITH RECURSIVE
		category_labels AS (
			SELECT
				c.id,
				c.parent_id,
				c.display_order,
				COALESCE(requested.name, ja.name, ko.name, '#' || c.id) AS name
			FROM categories AS c
			LEFT JOIN category_translations AS requested
				ON requested.category_id = c.id AND requested.language_code = ?1
			LEFT JOIN category_translations AS ja
				ON ja.category_id = c.id AND ja.language_code = 'ja'
			LEFT JOIN category_translations AS ko
				ON ko.category_id = c.id AND ko.language_code = 'ko'
			WHERE c.deleted_at IS NULL
		),
		category_tree AS (
			SELECT
				id,
				parent_id,
				display_order,
				name,
				name AS path,
				0 AS depth,
				printf('%010d-%010d', display_order, id) AS sort_path
			FROM category_labels
			WHERE parent_id IS NULL

			UNION ALL

			SELECT
				child.id,
				child.parent_id,
				child.display_order,
				child.name,
				parent.path || ' > ' || child.name AS path,
				parent.depth + 1 AS depth,
				parent.sort_path || '/' || printf('%010d-%010d', child.display_order, child.id) AS sort_path
			FROM category_labels AS child
			INNER JOIN category_tree AS parent ON parent.id = child.parent_id
		),
		category_descendants AS (
			SELECT id AS root_id, id AS category_id
			FROM category_tree

			UNION ALL

			SELECT descendants.root_id, child.id AS category_id
			FROM category_descendants AS descendants
			INNER JOIN category_tree AS child ON child.parent_id = descendants.category_id
		),
		visible_posts AS (
			SELECT
				p.id,
				p.status,
				p.original_language,
				pt.language_code AS display_language,
				pt.title,
				pt.slug,
				pt.excerpt,
				p.category_id,
				category_tree.name AS category_name,
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
			LEFT JOIN category_tree ON category_tree.id = p.category_id
			WHERE (p.status = 'published' OR (?2 = 1 AND p.status = 'private'))
				AND p.deleted_at IS NULL
		)
	`;
}

function categoryFilterSql(): string {
	return `(
		?3 = ''
		OR category_id IN (
			SELECT descendants.category_id
			FROM category_descendants AS descendants
			INNER JOIN category_tree AS root ON root.id = descendants.root_id
			WHERE root.path = ?3 OR root.name = ?3
		)
	)`;
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
				WHERE ${categoryFilterSql()}
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
				WHERE ${categoryFilterSql()}
				ORDER BY global_row_number ASC
				LIMIT ?4 OFFSET ?5
			`)
			.bind(language, adminFlag, category, PAGE_SIZE, offset)
			.all<PublicPostListRow>();

		const categoryResult = await env.song_project_db
			.prepare(`${basePostCte()}
				SELECT
					category_tree.id AS category_id,
					category_tree.parent_id,
					category_tree.depth,
					category_tree.path AS category_name,
					COUNT(DISTINCT visible_posts.id) AS post_count,
					category_tree.sort_path
				FROM category_tree
				INNER JOIN category_descendants
					ON category_descendants.root_id = category_tree.id
				LEFT JOIN visible_posts
					ON visible_posts.category_id = category_descendants.category_id
				GROUP BY
					category_tree.id,
					category_tree.parent_id,
					category_tree.depth,
					category_tree.path,
					category_tree.sort_path
				HAVING COUNT(visible_posts.id) > 0
				ORDER BY category_tree.sort_path ASC
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
				id: row.category_id,
				parentId: row.parent_id,
				depth: Number(row.depth ?? 0),
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
