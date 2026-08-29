import { getAuthenticatedAdminSession } from '../../auth/session';

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type DocumentType = 'skill_sheet' | 'career_history';
type DocumentLanguage = 'ja' | 'ko';

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

async function requireAdmin(request: Request, env: Env) {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	return session;
}

export async function handleListAdminProtectedDocuments(request: Request, env: Env): Promise<Response> {
	const session = await requireAdmin(request, env);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	try {
		const [documents, versions] = await Promise.all([
			env.song_project_db.prepare(`
				SELECT
					id,
					slug,
					document_type,
					title_ja,
					title_ko,
					current_version_ja_id,
					current_version_ko_id,
					is_active,
					updated_at
				FROM protected_documents
				ORDER BY id ASC
			`).all(),
			env.song_project_db.prepare(`
				SELECT
					v.id,
					v.document_id,
					d.document_type,
					v.language,
					v.version_no,
					v.original_file_name,
					v.original_file_size,
					v.original_file_sha256,
					v.change_summary,
					v.conversion_status,
					v.conversion_error,
					v.preview_page_count,
					v.created_at,
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

export async function handleUploadAdminProtectedDocument(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await requireAdmin(request, env);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return json({ ok: false, error: 'INVALID_FORM_DATA' }, 400);
	}

	const documentType = form.get('documentType');
	const language = form.get('language');
	const file = form.get('file');
	const changeSummaryRaw = form.get('changeSummary');
	const changeSummary = typeof changeSummaryRaw === 'string' ? changeSummaryRaw.trim().slice(0, 1000) || null : null;

	if (!isDocumentType(documentType)) return json({ ok: false, error: 'INVALID_DOCUMENT_TYPE' }, 400);
	if (!isLanguage(language)) return json({ ok: false, error: 'INVALID_LANGUAGE' }, 400);
	if (!(file instanceof File)) return json({ ok: false, error: 'FILE_REQUIRED' }, 400);
	if (!file.name.toLowerCase().endsWith('.xlsx')) return json({ ok: false, error: 'XLSX_REQUIRED' }, 400);
	if (file.size <= 0) return json({ ok: false, error: 'EMPTY_FILE' }, 400);
	if (file.size > MAX_UPLOAD_BYTES) return json({ ok: false, error: 'FILE_TOO_LARGE', maxBytes: MAX_UPLOAD_BYTES }, 413);

	const document = await env.song_project_db.prepare(`
		SELECT id, slug
		FROM protected_documents
		WHERE document_type = ?1 AND is_active = 1
		LIMIT 1
	`).bind(documentType).first<{ id: number; slug: string }>();
	if (!document) return json({ ok: false, error: 'DOCUMENT_NOT_FOUND' }, 404);

	const next = await env.song_project_db.prepare(`
		SELECT COALESCE(MAX(version_no), 0) + 1 AS next_version
		FROM protected_document_versions
		WHERE document_id = ?1
	`).bind(document.id).first<{ next_version: number }>();
	const versionNo = Math.max(1, Number(next?.next_version) || 1);

	let bytes: ArrayBuffer;
	try {
		bytes = await file.arrayBuffer();
	} catch {
		return json({ ok: false, error: 'FILE_READ_FAILED' }, 400);
	}

	const digest = await crypto.subtle.digest('SHA-256', bytes);
	const sha256 = hex(digest);
	const now = new Date().toISOString();
	const objectKey = `protected/${document.slug}/${language}/v${versionNo}/${crypto.randomUUID()}-${safeFileName(file.name)}`;

	try {
		await env.song_project_assets.put(objectKey, bytes, {
			httpMetadata: { contentType: file.type || XLSX_MIME },
			customMetadata: {
				documentType,
				language,
				version: String(versionNo),
				originalFileName: file.name.slice(0, 180),
			},
		});
	} catch (error) {
		console.error('Failed to upload protected document to R2', error);
		return json({ ok: false, error: 'R2_UPLOAD_FAILED' }, 500);
	}

	try {
		const inserted = await env.song_project_db.prepare(`
			INSERT INTO protected_document_versions (
				document_id,
				version_no,
				original_file_key,
				original_file_name,
				original_file_size,
				original_file_sha256,
				change_summary,
				conversion_status,
				uploaded_by,
				created_at,
				language
			) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'queued', ?8, ?9, ?10)
			RETURNING id
		`).bind(
			document.id,
			versionNo,
			objectKey,
			file.name.slice(0, 180),
			file.size,
			sha256,
			changeSummary,
			session.adminId,
			now,
			language,
		).first<{ id: number }>();

		return json({
			ok: true,
			version: {
				id: inserted?.id ?? null,
				documentType,
				language,
				versionNo,
				fileName: file.name,
				fileSize: file.size,
				sha256,
				conversionStatus: 'queued',
				createdAt: now,
			},
		}, 201);
	} catch (error) {
		console.error('Failed to register protected document version', error);
		try { await env.song_project_assets.delete(objectKey); } catch (cleanupError) { console.error('Failed to clean up R2 object', cleanupError); }
		return json({ ok: false, error: 'PROTECTED_DOCUMENT_REGISTER_FAILED' }, 500);
	}
}
