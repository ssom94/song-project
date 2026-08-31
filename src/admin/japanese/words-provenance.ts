import { ensureJapaneseWordHistorySchema } from './history';
import { handleListAdminJapaneseWords } from './words';

type HistoryRow = {
	word_id: number;
	action: 'create' | 'merge' | 'update' | 'delete';
	source_type: 'manual' | 'file' | 'legacy';
	source_name: string | null;
	source_row: number | null;
	created_at: string;
	id: number;
};

type SourceInfo = {
	type: HistoryRow['source_type'];
	name: string | null;
	row: number | null;
	createdAt: string;
	action: HistoryRow['action'];
};

function sourceInfo(row: HistoryRow): SourceInfo {
	return {
		type: row.source_type,
		name: row.source_name,
		row: row.source_row,
		createdAt: row.created_at,
		action: row.action,
	};
}

async function loadHistoryForWordIds(db: D1Database, ids: number[]): Promise<HistoryRow[]> {
	const rows: HistoryRow[] = [];
	for (let start = 0; start < ids.length; start += 80) {
		const batch = ids.slice(start, start + 80);
		if (!batch.length) continue;
		const placeholders = batch.map((_, index) => `?${index + 1}`).join(', ');
		const result = await db.prepare(`
			SELECT id, word_id, action, source_type, source_name, source_row, created_at
			FROM japanese_word_history
			WHERE word_id IN (${placeholders})
			ORDER BY datetime(created_at) ASC, id ASC
		`).bind(...batch).all<HistoryRow>();
		rows.push(...result.results);
	}
	return rows;
}

export async function handleListAdminJapaneseWordsWithProvenance(request: Request, env: Env): Promise<Response> {
	const response = await handleListAdminJapaneseWords(request, env);
	if (!response.ok) return response;

	try {
		const payload = await response.clone().json() as { words?: Array<Record<string, unknown>> };
		if (!Array.isArray(payload.words) || payload.words.length === 0) return response;

		await ensureJapaneseWordHistorySchema(env.song_project_db);
		const ids = payload.words
			.map((word) => Number(word.id))
			.filter((id) => Number.isSafeInteger(id) && id > 0);
		const history = await loadHistoryForWordIds(env.song_project_db, ids);
		const byWord = new Map<number, HistoryRow[]>();
		for (const row of history) {
			const list = byWord.get(row.word_id) ?? [];
			list.push(row);
			byWord.set(row.word_id, list);
		}

		payload.words = payload.words.map((word) => {
			const wordId = Number(word.id);
			const rows = byWord.get(wordId) ?? [];
			const create = rows.find((row) => row.action === 'create') ?? rows[0] ?? null;
			const lastFile = [...rows].reverse().find((row) => row.source_type === 'file') ?? null;
			return {
				...word,
				registrationSource: create ? sourceInfo(create) : null,
				lastFileSource: lastFile ? sourceInfo(lastFile) : null,
			};
		});

		return Response.json(payload, {
			status: response.status,
			headers: { 'Cache-Control': 'no-store' },
		});
	} catch (error) {
		console.warn('Japanese word list loaded without provenance metadata', error);
		return response;
	}
}
