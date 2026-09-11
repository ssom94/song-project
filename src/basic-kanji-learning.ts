import { getAuthenticatedAdminSession } from './auth/session';

type KanjiRow = {
	kanji: string;
	meaning_ko: string;
	sound_ko: string;
	meaning_ja: string | null;
	onyomi: string | null;
	kunyomi: string | null;
	component_forms: string | null;
	formation_note_ko: string | null;
	example_words: string | null;
	foundation_order: number;
	foundation_group: string | null;
	learning_state: 'unlearned' | 'mastered' | null;
};

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function sameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

export async function handleGetBasicKanjiLearning(request: Request, env: Env): Promise<Response> {
	try {
		const auth = await getAuthenticatedAdminSession(request, env.song_project_db);
		const adminId = auth?.adminId ?? 0;
		const result = await env.song_project_db.prepare(`
			SELECT k.kanji,k.meaning_ko,k.sound_ko,k.meaning_ja,k.onyomi,k.kunyomi,
				k.component_forms,k.formation_note_ko,k.example_words,
				k.foundation_order,k.foundation_group,s.learning_state
			FROM japanese_kanji_korean_readings k
			LEFT JOIN japanese_admin_basic_kanji_states s
				ON s.kanji=k.kanji AND s.admin_id=?1
			WHERE k.foundation_order IS NOT NULL
			ORDER BY CASE WHEN COALESCE(s.learning_state,'unlearned')='unlearned' THEN 0 ELSE 1 END,
				k.foundation_order ASC
			LIMIT 300
		`).bind(adminId).all<KanjiRow>();
		const kanji = result.results.map((row) => ({
			kanji: row.kanji,
			meaningKo: row.meaning_ko,
			soundKo: row.sound_ko,
			meaningJa: row.meaning_ja,
			onyomi: row.onyomi,
			kunyomi: row.kunyomi,
			componentForms: (row.component_forms ?? row.kanji).split('|'),
			formationNoteKo: row.formation_note_ko,
			exampleWords: (row.example_words ?? '').split('|').filter(Boolean),
			order: row.foundation_order,
			group: row.foundation_group,
			state: row.learning_state ?? 'unlearned',
		}));
		return json({
			ok: true,
			authenticated: Boolean(auth),
			counts: {
				total: kanji.length,
				mastered: kanji.filter((item) => item.state === 'mastered').length,
				unlearned: kanji.filter((item) => item.state === 'unlearned').length,
			},
			kanji,
		});
	} catch (error) {
		console.error('Failed to load basic kanji learning', error);
		return json({ ok: false, error: 'BASIC_KANJI_LOAD_FAILED' }, 500);
	}
}

export async function handleUpdateBasicKanjiLearning(request: Request, env: Env): Promise<Response> {
	if (!sameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const auth = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!auth) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	const body = await request.json().catch(() => null) as { updates?: unknown } | null;
	if (!Array.isArray(body?.updates) || body.updates.length < 1 || body.updates.length > 100) {
		return json({ ok: false, error: 'INVALID_UPDATES' }, 400);
	}
	const updates = body.updates.map((value) => {
		const row = value && typeof value === 'object' ? value as { kanji?: unknown; state?: unknown } : {};
		return { kanji: String(row.kanji ?? '').normalize('NFKC').trim(), state: row.state };
	});
	if (updates.some((row) => Array.from(row.kanji).length !== 1 || !['unlearned', 'mastered'].includes(String(row.state)))) {
		return json({ ok: false, error: 'INVALID_KANJI_STATE' }, 400);
	}
	const unique = [...new Map(updates.map((row) => [row.kanji, row])).values()];
	try {
		const placeholders = unique.map((_, index) => `?${index + 1}`).join(',');
		const existing = await env.song_project_db.prepare(`
			SELECT kanji FROM japanese_kanji_korean_readings
			WHERE foundation_order IS NOT NULL AND kanji IN (${placeholders})
		`).bind(...unique.map((row) => row.kanji)).all<{ kanji: string }>();
		if (existing.results.length !== unique.length) return json({ ok: false, error: 'KANJI_NOT_FOUND' }, 404);
		const now = new Date().toISOString();
		await env.song_project_db.batch(unique.map((row) => env.song_project_db.prepare(`
			INSERT INTO japanese_admin_basic_kanji_states(admin_id,kanji,learning_state,updated_at)
			VALUES (?1,?2,?3,?4)
			ON CONFLICT(admin_id,kanji) DO UPDATE SET learning_state=excluded.learning_state,updated_at=excluded.updated_at
		`).bind(auth.adminId, row.kanji, row.state, now)));
		return json({ ok: true, updated: unique.length });
	} catch (error) {
		console.error('Failed to update basic kanji learning', error);
		return json({ ok: false, error: 'BASIC_KANJI_UPDATE_FAILED' }, 500);
	}
}
