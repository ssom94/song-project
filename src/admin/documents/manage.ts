import { getAuthenticatedAdminSession } from '../../auth/session';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_PREVIEW_JSON_CHARS = 2_500_000;
const MAX_PREVIEW_SHEETS = 20;
const MAX_PREVIEW_ROWS = 500;
const MAX_PREVIEW_COLUMNS = 100;
const MAX_PREVIEW_CELL_CHARS = 4000;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type DocumentType = 'skill_sheet' | 'career_history';
type DocumentLanguage = 'ja' | 'ko';

type PreviewSheet = {
	name: string;
	rows: string[][];
	rowCount: number;
	columnCount: number;
};

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

function isDocumentType(value: unknown): value is DocumentType {
	return value === 'skill_sheet' || value === 'career_history';
}

function isLanguage(value: unknown): value is DocumentLanguage {
	return value === 'ja' || value === 'ko';
}

function safeFileName(name: string): string {
	const cleaned = name
		.normalize('NFKC')
		.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
		.replace(/\s+/g, '_')
		.replace(/_+/g, '_')
		.slice(0, 120);
	return cleaned || 'document.xlsx';
}

function hex(buffer: ArrayBuffer): string {
	return [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function normalizePreviewCell(value: unknown): string | null {
	if (value === null || value === undefined) return '';
	if (!['string', 'number', 'boolean'].includes(typeof value)) return null;
	const text = String(value);
	return text.length <= MAX_PREVIEW_CELL_CHARS ? text : text.slice(0, MAX_PREVIEW_CELL_CHARS);
}

function parsePreviewJson(value: unknown): PreviewSheet[] | null {
	if (typeof value !== 'string' || !value.trim()) return [];
	if (value.length > MAX_PREVIEW_JSON_CHARS) return null;
	let parsed: unknown;
	try { parsed = JSON.parse(value); } catch { return null; }
	const sheets = Array.isArray((parsed as { sheets?: unknown })?.sheets)
		? (parsed as { sheets: unknown[] }).sheets
		: null;
	if (!sheets || sheets.length === 0 || sheets.length > MAX_PREVIEW_SHEETS) return null;

	const result: PreviewSheet[] = [];
	for (const raw of sheets) {
		if (!raw || typeof raw !== 'object') return null;
		const input = raw as { name?: unknown; rows?: unknown; rowCount?: unknown; columnCount?: unknown };
		const name = typeof input.name === 'string' ? input.name.trim().slice(0, 120) : '';
		if (!name || !Array.isArray(input.rows) || input.rows.length > MAX_PREVIEW_ROWS) return null;
		const rows: string[][] = [];
		let widest = 0;
		for (const rawRow of input.rows) {
			if (!Array.isArray(rawRow) || rawRow.length > MAX_PREVIEW_COLUMNS) return null;
			const row: string[] = [];
			for (const rawCell of rawRow) {
				const cell = normalizePreviewCell(rawCell);
				if (cell === null) return null;
				row.push(cell);
			}
			widest = Math.max(widest, row.length);
			rows.push(row);
		}
		const reportedRows = Number(input.rowCount);
		const reportedColumns = Number(input.columnCount);
		const rowCount = Number.isSafeInteger(reportedRows) && reportedRows >= rows.length && reportedRows <= 1_048_576
			? reportedRows
			: rows.length;
		const columnCount = Number.isSafeInteger(reportedColumns) && reportedColumns >= widest && reportedColumns <= 16_384
			? reportedColumns
			: widest;
		result.push({ name, rows, rowCount, columnCount });
	}
	return result;
}

async function requireAdmin(request: Request, env: Env) {
	return getAuthenticatedAdminSession(request, env.song_project_db);
}

export async function handleListAdminProtectedDocuments(request: Request, env: Env): Promise<Response> {
	const session = await requireAdmin(request, env);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	try {
		const [documents, versions] = await Promise.all([
			env.song_project_db.prepare(`
				SELECT
					id, slug, document_type, title_ja, title_ko,
					current_version_ja_id, current_version_ko_id, is_active, updated_at
				FROM protected_documents
				ORDER BY id ASC
			`).all(),
			env.song_project_db.prepare(`
				SELECT
					v.id, v.document_id, d.document_type, v.language, v.version_no,
					v.original_file_name, v.original_file_size, v.original_file_sha256,
					v.change_summary, v.conversion_status, v.conversion_error,
					v.preview_page_count, v.created_at,
					CASE
						WHEN v.language = 'ja' AND d.current_version_ja_id = v.id THEN 1
						WHEN v.language = 'ko' AND d.current_version_ko_id = v.id THEN 1
						ELSE 0
					END AS is_current
				FROM protected_document_versions AS v
				INNER JOIN protected_documents AS d ON d.id = v.document_id
				ORDER BY datetime(v.created_at) DESC, v.id DESC
				LIMIT 200
			`).all(),
		]);

		return json({ ok: true, documents: documents.results, versions: versions.results });
	} catch (error) {
		console.error('Failed to list protected documents', error);
		return json({ ok: false, error: 'PROTECTED_DOCUMENT_LIST_FAILED' }, 500);
	}
}

export async function handleGetAdminProtectedDocumentPreview(request: Request, env: Env): Promise<Response> {
	const session = await requireAdmin(request, env);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	const versionId = Number(new URL(request.url).searchParams.get('versionId'));
	if (!Number.isSafeInteger(versionId) || versionId <= 0) return json({ ok: false, error: 'INVALID_VERSION_ID' }, 400);

	try {
		const version = await env.song_project_db.prepare(`
			SELECT v.id, v.version_no, v.language, v.original_file_name, v.preview_page_count, d.document_type
			FROM protected_document_versions AS v
			INNER JOIN protected_documents AS d ON d.id = v.document_id
			WHERE v.id = ?1
			LIMIT 1
		`).bind(versionId).first<Record<string, unknown>>();
		if (!version) return json({ ok: false, error: 'VERSION_NOT_FOUND' }, 404);

		const previews = await env.song_project_db.prepare(`
			SELECT sheet_index, sheet_name, row_count, column_count, rows_json
			FROM protected_document_sheet_previews
			WHERE version_id = ?1
			ORDER BY sheet_index ASC
		`).bind(versionId).all<Record<string, unknown>>();

		return json({
			ok: true,
			version,
			sheets: previews.results.map((sheet) => {
				let rows: unknown = [];
				try { rows = JSON.parse(String(sheet.rows_json ?? '[]')); } catch { rows = []; }
				return {
					index: Number(sheet.sheet_index),
					name: String(sheet.sheet_name ?? ''),
					rowCount: Number(sheet.row_count) || 0,
					columnCount: Number(sheet.column_count) || 0,
					rows: Array.isArray(rows) ? rows : [],
				};
			}),
		});
	} catch (error) {
		console.error('Failed to load protected document preview', error);
		return json({ ok: false, error: 'DOCUMENT_PREVIEW_LOAD_FAILED' }, 500);
	}
}

export async function handleUploadAdminProtectedDocument(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await requireAdmin(request, env);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	let form: FormData;
	try { form = await request.formData(); } catch { return json({ ok: false, error: 'INVALID_FORM_DATA' }, 400); }

	const documentType = form.get('documentType');
	const language = form.get('language');
	const file = form.get('file');
	const changeSummaryRaw = form.get('changeSummary');
	const changeSummary = typeof changeSummaryRaw === 'string' ? changeSummaryRaw.trim().slice(0, 1000) || null : null;
	const previewSheets = parsePreviewJson(form.get('previewJson'));

	if (!isDocumentType(documentType)) return json({ ok: false, error: 'INVALID_DOCUMENT_TYPE' }, 400);
	if (!isLanguage(language)) return json({ ok: false, error: 'INVALID_LANGUAGE' }, 400);
	if (!(file instanceof File)) return json({ ok: false, error: 'FILE_REQUIRED' }, 400);
	if (!file.name.toLowerCase().endsWith('.xlsx')) return json({ ok: false, error: 'XLSX_REQUIRED' }, 400);
	if (file.size <= 0) return json({ ok: false, error: 'EMPTY_FILE' }, 400);
	if (file.size > MAX_UPLOAD_BYTES) return json({ ok: false, error: 'FILE_TOO_LARGE', maxBytes: MAX_UPLOAD_BYTES }, 413);
	if (previewSheets === null) return json({ ok: false, error: 'INVALID_PREVIEW_DATA' }, 400);

	const document = await env.song_project_db.prepare(`
		SELECT id, slug FROM protected_documents
		WHERE document_type = ?1 AND is_active = 1 LIMIT 1
	`).bind(documentType).first<{ id: number; slug: string }>();
	if (!document) return json({ ok: false, error: 'DOCUMENT_NOT_FOUND' }, 404);

	const next = await env.song_project_db.prepare(`
		SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version
		FROM protected_document_versions WHERE document_id = ?1
	`).bind(document.id).first<{ next_version: number }>();
	const versionNo = Math.max(1, Number(next?.next_version) || 1);

	let bytes: ArrayBuffer;
	try { bytes = await file.arrayBuffer(); } catch { return json({ ok: false, error: 'FILE_READ_FAILED' }, 400); }

	const digest = await crypto.subtle.digest('SHA-256', bytes);
	const sha256 = hex(digest);
	const now = new Date().toISOString();
	const objectKey = `protected/${document.slug}/${language}/v${versionNo}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
	const ready = previewSheets.length > 0;

	try {
		await env.song_project_assets.put(objectKey, bytes, {
			httpMetadata: { contentType: file.type || XLSX_MIME },
			customMetadata: {
				documentType, language, version: String(versionNo), originalFileName: file.name.slice(0, 180),
			},
		});
	} catch (error) {
		console.error('Failed to upload protected document to R2', error);
		return json({ ok: false, error: 'R2_UPLOAD_FAILED' }, 500);
	}

	let insertedId = 0;
	try {
		const inserted = await env.song_project_db.prepare(`
			INSERT INTO protected_document_versions (
				document_id, version_no, original_file_key, original_file_name, original_file_size,
				original_file_sha256, change_summary, conversion_status, conversion_started_at,
				conversion_finished_at, preview_page_count, uploaded_by, created_at, language
			) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
			RETURNING id
		`).bind(
			document.id, versionNo, objectKey, file.name.slice(0, 180), file.size, sha256, changeSummary,
			ready ? 'ready' : 'queued', ready ? now : null, ready ? now : null, previewSheets.length,
			session.adminId, now, language,
		).first<{ id: number }>();
		insertedId = Number(inserted?.id) || 0;
		if (!insertedId) throw new Error('VERSION_ID_MISSING');

		if (ready) {
			const statements = previewSheets.map((sheet, index) => env.song_project_db.prepare(`
				INSERT INTO protected_document_sheet_previews (
					version_id, sheet_index, sheet_name, row_count, column_count, rows_json, created_at
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
			`).bind(insertedId, index, sheet.name, sheet.rowCount, sheet.columnCount, JSON.stringify(sheet.rows), now));

			const currentColumn = language === 'ko' ? 'current_version_ko_id' : 'current_version_ja_id';
			statements.push(env.song_project_db.prepare(`
				UPDATE protected_documents
				SET ${currentColumn} = ?1, current_version_id = ?1, updated_at = ?2
				WHERE id = ?3
			`).bind(insertedId, now, document.id));
			await env.song_project_db.batch(statements);
		}

		return json({
			ok: true,
			version: {
				id: insertedId, documentType, language, versionNo, fileName: file.name, fileSize: file.size, sha256,
				conversionStatus: ready ? 'ready' : 'queued', previewSheetCount: previewSheets.length, createdAt: now,
			},
		}, 201);
	} catch (error) {
		console.error('Failed to register protected document version', error);
		if (insertedId) {
			try { await env.song_project_db.prepare('DELETE FROM protected_document_versions WHERE id = ?1').bind(insertedId).run(); } catch (cleanupError) { console.error('Failed to clean up document version', cleanupError); }
		}
		try { await env.song_project_assets.delete(objectKey); } catch (cleanupError) { console.error('Failed to clean up R2 object', cleanupError); }
		return json({ ok: false, error: 'PROTECTED_DOCUMENT_REGISTER_FAILED' }, 500);
	}
}
