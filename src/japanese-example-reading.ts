import { getAuthenticatedAdminSession } from './auth/session';

type ExampleRow = {
	id: number;
	word_id: number;
	word: string;
	reading: string | null;
	jlpt_code: string | null;
	sentence_ja: string;
	sentence_reading: string | null;
	translation_ko: string | null;
	reading_state: 'mastered' | 'review' | 'unlearned' | null;
	checked: number | null;
};

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function ensureSchema(db: D1Database): Promise<void> {
	await db.prepare(`
		CREATE TABLE IF NOT EXISTS japanese_example_reading_states (
			admin_id INTEGER NOT NULL,
			example_id INTEGER NOT NULL,
			reading_state TEXT NOT NULL DEFAULT 'unlearned'
				CHECK (reading_state IN ('mastered', 'review', 'unlearned')),
			checked INTEGER NOT NULL DEFAULT 0 CHECK (checked IN (0, 1)),
			updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
			PRIMARY KEY (admin_id, example_id),
			FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
			FOREIGN KEY (example_id) REFERENCES japanese_word_examples(id) ON DELETE CASCADE
		)
	`).run();
}

export async function handleListJapaneseExamples(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
	const jlpt = (url.searchParams.get('jlpt') ?? '').trim().toUpperCase();
	const state = (url.searchParams.get('state') ?? '').trim();
	const requestedPage = Number(url.searchParams.get('page') ?? '1');
	const requestedLimit = Number(url.searchParams.get('limit') ?? '50');
	const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
	const limit = Number.isSafeInteger(requestedLimit) ? Math.min(100, Math.max(10, requestedLimit)) : 50;
	const offset = (page - 1) * limit;
	if (jlpt && !['N1', 'N2', 'N3', 'N4', 'N5'].includes(jlpt)) return json({ ok: false, error: 'INVALID_JLPT' }, 400);
	if (state && !['mastered', 'review', 'unlearned'].includes(state)) return json({ ok: false, error: 'INVALID_STATE' }, 400);

	try {
		await ensureSchema(env.song_project_db);
		const session = await getAuthenticatedAdminSession(request, env.song_project_db);
		const adminId = session?.adminId ?? 0;
		const whereSql = `
			WHERE e.deleted_at IS NULL AND w.deleted_at IS NULL
				AND (?1 = '' OR w.word LIKE '%' || ?1 || '%' OR COALESCE(w.reading, '') LIKE '%' || ?1 || '%' OR e.sentence_ja LIKE '%' || ?1 || '%' OR COALESCE(e.translation_ko, '') LIKE '%' || ?1 || '%')
				AND (?2 = '' OR jl.code = ?2)
				AND (?3 = '' OR COALESCE(s.reading_state, 'unlearned') = ?3)
		`;
		const [rows, count] = await Promise.all([
			env.song_project_db.prepare(`
				SELECT e.id, e.word_id, w.word, w.reading, jl.code AS jlpt_code,
					e.sentence_ja, e.reading AS sentence_reading, e.translation_ko,
					s.reading_state, s.checked
				FROM japanese_word_examples AS e
				JOIN japanese_words AS w ON w.id = e.word_id
				LEFT JOIN jlpt_levels AS jl ON jl.id = w.jlpt_level_id
				LEFT JOIN japanese_example_reading_states AS s ON s.example_id = e.id AND s.admin_id = ?4
				${whereSql}
				ORDER BY CASE WHEN jl.code = 'N1' THEN 0 ELSE 1 END, e.id ASC
				LIMIT ?5 OFFSET ?6
			`).bind(q, jlpt, state, adminId, limit, offset).all<ExampleRow>(),
			env.song_project_db.prepare(`
				SELECT COUNT(*) AS total
				FROM japanese_word_examples AS e
				JOIN japanese_words AS w ON w.id = e.word_id
				LEFT JOIN jlpt_levels AS jl ON jl.id = w.jlpt_level_id
				LEFT JOIN japanese_example_reading_states AS s ON s.example_id = e.id AND s.admin_id = ?4
				${whereSql}
			`).bind(q, jlpt, state, adminId).first<{ total: number }>(),
		]);
		const total = Number(count?.total ?? 0);
		return json({
			ok: true,
			authenticated: Boolean(session),
			pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
			examples: rows.results.map((row) => ({
				id: row.id,
				wordId: row.word_id,
				word: row.word,
				reading: row.reading,
				jlpt: row.jlpt_code,
				sentence: row.sentence_ja,
				sentenceReading: row.sentence_reading,
				translationKo: row.translation_ko,
				state: row.reading_state ?? 'unlearned',
				checked: Boolean(row.checked),
			})),
		});
	} catch (error) {
		console.error('Failed to list Japanese examples', error);
		return json({ ok: false, error: 'JAPANESE_EXAMPLES_FAILED' }, 500);
	}
}

export async function handleUpdateJapaneseExampleState(request: Request, env: Env): Promise<Response> {
	const origin = request.headers.get('Origin');
	if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	const body = await request.json().catch(() => null) as { exampleId?: unknown; state?: unknown; checked?: unknown } | null;
	const exampleId = Number(body?.exampleId);
	const state = body?.state;
	const checked = body?.checked;
	if (!Number.isSafeInteger(exampleId) || exampleId <= 0) return json({ ok: false, error: 'INVALID_EXAMPLE_ID' }, 400);
	if (state !== 'mastered' && state !== 'review' && state !== 'unlearned') return json({ ok: false, error: 'INVALID_STATE' }, 400);
	if (typeof checked !== 'boolean') return json({ ok: false, error: 'INVALID_CHECKED' }, 400);
	try {
		await ensureSchema(env.song_project_db);
		await env.song_project_db.prepare(`
			INSERT INTO japanese_example_reading_states (admin_id, example_id, reading_state, checked, updated_at)
			VALUES (?1, ?2, ?3, ?4, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
			ON CONFLICT(admin_id, example_id) DO UPDATE SET
				reading_state = excluded.reading_state,
				checked = excluded.checked,
				updated_at = excluded.updated_at
		`).bind(session.adminId, exampleId, state, checked ? 1 : 0).run();
		return json({ ok: true, exampleId, state, checked });
	} catch (error) {
		console.error('Failed to update Japanese example state', error);
		return json({ ok: false, error: 'JAPANESE_EXAMPLE_STATE_FAILED' }, 500);
	}
}
