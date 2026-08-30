import { getAuthenticatedAdminSession } from '../../auth/session';

export type JapaneseWordHistoryAction = 'create' | 'merge' | 'update' | 'delete';
export type JapaneseWordHistorySource = 'manual' | 'file' | 'legacy';

interface HistoryRow {
	id: number;
	word_id: number;
	action: JapaneseWordHistoryAction;
	source_type: JapaneseWordHistorySource;
	source_name: string | null;
	source_row: number | null;
	details_json: string | null;
	created_at: string;
	admin_id: number | null;
	admin_username: string | null;
	admin_display_name: string | null;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function parseWordId(request: Request): number | null {
	const value = Number(new URL(request.url).searchParams.get('id'));
	return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export async function ensureJapaneseWordHistorySchema(db: D1Database): Promise<void> {
	await db.prepare(`
		CREATE TABLE IF NOT EXISTS japanese_word_history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			word_id INTEGER NOT NULL,
			admin_id INTEGER,
			action TEXT NOT NULL CHECK (action IN ('create', 'merge', 'update', 'delete')),
			source_type TEXT NOT NULL CHECK (source_type IN ('manual', 'file', 'legacy')),
			source_name TEXT,
			source_row INTEGER,
			details_json TEXT,
			created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
			FOREIGN KEY (word_id) REFERENCES japanese_words(id) ON DELETE CASCADE,
			FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
		)
	`).run();
	await db.prepare(`
		CREATE INDEX IF NOT EXISTS idx_japanese_word_history_word
		ON japanese_word_history(word_id, created_at DESC, id DESC)
	`).run();
	await db.prepare(`
		CREATE INDEX IF NOT EXISTS idx_japanese_word_history_source
		ON japanese_word_history(source_type, source_name)
	`).run();
	await db.prepare(`
		INSERT INTO japanese_word_history (
			word_id, admin_id, action, source_type, source_name, source_row, details_json, created_at
		)
		SELECT
			w.id,
			(
				SELECT al.admin_id
				FROM audit_logs AS al
				WHERE al.entity_type = 'japanese_word'
					AND al.entity_id = w.id
					AND al.action = 'create'
				ORDER BY datetime(al.created_at) ASC, al.id ASC
				LIMIT 1
			),
			'create',
			CASE
				WHEN EXISTS (
					SELECT 1 FROM audit_logs AS al
					WHERE al.entity_type = 'japanese_word'
						AND al.entity_id = w.id
						AND al.action = 'create'
				) THEN 'manual'
				ELSE 'legacy'
			END,
			NULL,
			NULL,
			'{"backfilled":true}',
			w.created_at
		FROM japanese_words AS w
		WHERE NOT EXISTS (
			SELECT 1 FROM japanese_word_history AS h WHERE h.word_id = w.id
		)
	`).run();
}

export function japaneseWordHistoryStatement(
	db: D1Database,
	input: {
		wordId: number;
		adminId: number | null;
		action: JapaneseWordHistoryAction;
		sourceType: JapaneseWordHistorySource;
		sourceName?: string | null;
		sourceRow?: number | null;
		details?: unknown;
		createdAt?: string;
	},
): D1PreparedStatement {
	return db.prepare(`
		INSERT INTO japanese_word_history (
			word_id, admin_id, action, source_type, source_name, source_row, details_json, created_at
		)
		VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
	`).bind(
		input.wordId,
		input.adminId,
		input.action,
		input.sourceType,
		input.sourceName ?? null,
		input.sourceRow ?? null,
		input.details === undefined ? null : JSON.stringify(input.details),
		input.createdAt ?? new Date().toISOString(),
	);
}

export async function handleGetAdminJapaneseWordHistory(request: Request, env: Env): Promise<Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	const wordId = parseWordId(request);
	if (!wordId) return json({ ok: false, error: 'INVALID_WORD_ID' }, 400);

	try {
		await ensureJapaneseWordHistorySchema(env.song_project_db);
		const word = await env.song_project_db.prepare(`
			SELECT id, word, reading, created_at, updated_at, deleted_at
			FROM japanese_words
			WHERE id = ?1
			LIMIT 1
		`).bind(wordId).first<{
			id: number;
			word: string;
			reading: string | null;
			created_at: string;
			updated_at: string;
			deleted_at: string | null;
		}>();
		if (!word) return json({ ok: false, error: 'WORD_NOT_FOUND' }, 404);

		const history = await env.song_project_db.prepare(`
			SELECT
				h.id,
				h.word_id,
				h.action,
				h.source_type,
				h.source_name,
				h.source_row,
				h.details_json,
				h.created_at,
				h.admin_id,
				a.username AS admin_username,
				a.display_name AS admin_display_name
			FROM japanese_word_history AS h
			LEFT JOIN admins AS a ON a.id = h.admin_id
			WHERE h.word_id = ?1
			ORDER BY datetime(h.created_at) DESC, h.id DESC
			LIMIT 200
		`).bind(wordId).all<HistoryRow>();

		return json({
			ok: true,
			word: {
				id: word.id,
				word: word.word,
				reading: word.reading,
				createdAt: word.created_at,
				updatedAt: word.updated_at,
				deletedAt: word.deleted_at,
			},
			history: history.results.map((row) => ({
				id: row.id,
				action: row.action,
				sourceType: row.source_type,
				sourceName: row.source_name,
				sourceRow: row.source_row,
				details: (() => {
					try { return row.details_json ? JSON.parse(row.details_json) : null; }
					catch { return null; }
				})(),
				createdAt: row.created_at,
				admin: row.admin_id ? {
					id: row.admin_id,
					username: row.admin_username,
					displayName: row.admin_display_name,
				} : null,
			})),
		});
	} catch (error) {
		console.error('Failed to load Japanese word history', error);
		return json({ ok: false, error: 'JAPANESE_WORD_HISTORY_FAILED' }, 500);
	}
}
