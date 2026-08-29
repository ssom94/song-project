import { getAuthenticatedAdminSession } from '../../auth/session';

interface AdminTagRow {
	id: number;
	name_ja: string | null;
	name_ko: string | null;
	created_at: string;
	updated_at: string;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, {
		status,
		headers: { 'Cache-Control': 'no-store' },
	});
}

export async function handleListAdminTags(request: Request, env: Env): Promise<Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	try {
		const result = await env.song_project_db
			.prepare(`
				SELECT
					t.id,
					ja.name AS name_ja,
					ko.name AS name_ko,
					t.created_at,
					t.updated_at
				FROM tags AS t
				LEFT JOIN tag_translations AS ja
					ON ja.tag_id = t.id AND ja.language_code = 'ja'
				LEFT JOIN tag_translations AS ko
					ON ko.tag_id = t.id AND ko.language_code = 'ko'
				WHERE t.deleted_at IS NULL
				ORDER BY COALESCE(ja.name, ko.name, '') COLLATE NOCASE ASC, t.id ASC
			`)
			.all<AdminTagRow>();

		return json({
			ok: true,
			tags: result.results.map((row) => ({
				id: row.id,
				names: {
					ja: row.name_ja,
					ko: row.name_ko,
				},
				createdAt: row.created_at,
				updatedAt: row.updated_at,
			})),
		});
	} catch (error) {
		console.error('Failed to list admin tags', error);
		return json({ ok: false, error: 'TAG_LIST_FAILED' }, 500);
	}
}
