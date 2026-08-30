import { getAuthenticatedAdminSession } from '../../auth/session';
import { handleImportAdminJapaneseWords } from './import';
import {
	ensureJapaneseWordHistorySchema,
	japaneseWordHistoryStatement,
} from './history';

type ImportRequestPayload = {
	fileName?: unknown;
	rows?: unknown;
};

type ImportResultItem = {
	rowNumber?: unknown;
	status?: unknown;
	word?: unknown;
};

function cleanFileName(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const normalized = value.normalize('NFKC').trim();
	if (!normalized) return null;
	return normalized.length <= 255 ? normalized : normalized.slice(0, 255);
}

async function readPayload(request: Request): Promise<ImportRequestPayload> {
	try {
		const value = await request.clone().json();
		return value && typeof value === 'object' && !Array.isArray(value)
			? value as ImportRequestPayload
			: {};
	} catch {
		return {};
	}
}

async function recordImportHistory(
	env: Env,
	adminId: number | null,
	fileName: string | null,
	results: ImportResultItem[],
): Promise<void> {
	const statements: D1PreparedStatement[] = [];
	for (const item of results) {
		const status = item?.status === 'created' || item?.status === 'merged' ? item.status : null;
		const word = typeof item?.word === 'string' ? item.word.normalize('NFKC').trim() : '';
		const rowNumber = Number(item?.rowNumber);
		if (!status || !word) continue;

		const existing = await env.song_project_db.prepare(`
			SELECT id
			FROM japanese_words
			WHERE word = ?1 COLLATE NOCASE AND deleted_at IS NULL
			ORDER BY id ASC
			LIMIT 1
		`).bind(word).first<{ id: number }>();
		if (!existing) continue;

		statements.push(japaneseWordHistoryStatement(env.song_project_db, {
			wordId: existing.id,
			adminId,
			action: status === 'created' ? 'create' : 'merge',
			sourceType: 'file',
			sourceName: fileName,
			sourceRow: Number.isSafeInteger(rowNumber) && rowNumber > 0 ? rowNumber : null,
			details: { importStatus: status },
		}));
	}

	for (let start = 0; start < statements.length; start += 100) {
		await env.song_project_db.batch(statements.slice(start, start + 100));
	}
}

export async function handleImportAdminJapaneseWordsWithHistory(request: Request, env: Env): Promise<Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return Response.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
	await ensureJapaneseWordHistorySchema(env.song_project_db);
	const payload = await readPayload(request);
	const fileName = cleanFileName(payload.fileName);
	const response = await handleImportAdminJapaneseWords(request, env);
	if (!response.ok) return response;

	try {
		const result = await response.clone().json() as { results?: unknown };
		const rows = Array.isArray(result?.results) ? result.results as ImportResultItem[] : [];
		await recordImportHistory(env, session.adminId, fileName, rows);
	} catch (error) {
		console.warn('Japanese import succeeded but provenance history could not be recorded', error);
	}
	return response;
}
