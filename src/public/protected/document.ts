type DocumentType = 'skill_sheet' | 'career_history';
type Language = 'ja' | 'ko';

type AccessContext = {
	sessionId: number;
	accessCodeId: number;
	language: Language;
	allowSkillSheet: boolean;
	allowCareerHistory: boolean;
};

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function sha256Hex(value: string): Promise<string> {
	const bytes = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function cookieValue(request: Request, name: string): string {
	const cookie = request.headers.get('Cookie') ?? '';
	for (const part of cookie.split(';')) {
		const [rawName, ...rest] = part.trim().split('=');
		if (rawName === name) return decodeURIComponent(rest.join('='));
	}
	return '';
}

function documentType(value: string | null): DocumentType | null {
	return value === 'skill_sheet' || value === 'career_history' ? value : null;
}

function language(value: string | null): Language | null {
	return value === 'ja' || value === 'ko' ? value : null;
}

async function accessContext(request: Request, env: Env): Promise<AccessContext | null> {
	const rawToken = cookieValue(request, 'protected_session');
	if (!rawToken) return null;
	const tokenHash = await sha256Hex(rawToken);
	const row = await env.song_project_db.prepare(`
		SELECT
			s.id AS session_id,
			ac.id AS access_code_id,
			ac.language,
			ac.allow_skill_sheet,
			ac.allow_career_history
		FROM protected_access_sessions AS s
		INNER JOIN access_codes AS ac ON ac.id = s.access_code_id
		WHERE s.token_hash = ?1
			AND s.revoked_at IS NULL
			AND datetime(s.expires_at) > datetime('now')
			AND ac.revoked_at IS NULL
			AND datetime(ac.expires_at) > datetime('now')
		LIMIT 1
	`).bind(tokenHash).first<Record<string, unknown>>();
	if (!row) return null;
	return {
		sessionId: Number(row.session_id),
		accessCodeId: Number(row.access_code_id),
		language: row.language === 'ko' ? 'ko' : 'ja',
		allowSkillSheet: Number(row.allow_skill_sheet) === 1,
		allowCareerHistory: Number(row.allow_career_history) === 1,
	};
}

function allowed(access: AccessContext, type: DocumentType): boolean {
	return type === 'skill_sheet' ? access.allowSkillSheet : access.allowCareerHistory;
}

async function currentDocument(env: Env, type: DocumentType, lang: Language) {
	const document = await env.song_project_db.prepare(`
		SELECT id, title_ja, title_ko, current_version_ja_id, current_version_ko_id
		FROM protected_documents
		WHERE document_type = ?1 AND is_active = 1
		LIMIT 1
	`).bind(type).first<Record<string, unknown>>();
	if (!document) return null;
	const versionId = lang === 'ko'
		? Number(document.current_version_ko_id ?? 0)
		: Number(document.current_version_ja_id ?? 0);
	return { document, versionId };
}

async function recordAccess(request: Request, env: Env, access: AccessContext, documentId: number, versionId: number, action: 'view_preview' | 'download_excel') {
	const ip = request.headers.get('CF-Connecting-IP') ?? request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ?? 'local';
	const ipHash = await sha256Hex(ip);
	const masked = ip.includes(':') ? `${ip.split(':').slice(0, 3).join(':')}:*` : `${ip.split('.').slice(0, 3).join('.')}.*`;
	const now = new Date().toISOString();
	try {
		await env.song_project_db.batch([
			env.song_project_db.prepare(`
				UPDATE protected_access_sessions SET last_seen_at = ?1 WHERE id = ?2
			`).bind(now, access.sessionId),
			env.song_project_db.prepare(`
				INSERT INTO protected_access_logs (
					access_code_id, session_id, document_id, version_id, action,
					ip_hash, ip_masked, country_code, user_agent, created_at
				) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
			`).bind(
				access.accessCodeId,
				access.sessionId,
				documentId,
				versionId,
				action,
				ipHash,
				masked,
				request.headers.get('CF-IPCountry'),
				request.headers.get('User-Agent'),
				now,
			),
		]);
	} catch (error) {
		console.warn('Failed to record protected document access', error);
	}
}

export async function handleGetProtectedDocument(request: Request, env: Env): Promise<Response> {
	const access = await accessContext(request, env);
	if (!access) return json({ ok: false, error: 'PROTECTED_SESSION_REQUIRED' }, 401);
	const url = new URL(request.url);
	const type = documentType(url.searchParams.get('type'));
	const requestedLanguage = language(url.searchParams.get('lang'));
	if (!type) return json({ ok: false, error: 'INVALID_DOCUMENT_TYPE' }, 400);
	if (requestedLanguage && requestedLanguage !== access.language) return json({ ok: false, error: 'LANGUAGE_NOT_ALLOWED' }, 403);
	if (!allowed(access, type)) return json({ ok: false, error: 'DOCUMENT_NOT_ALLOWED' }, 403);

	try {
		const current = await currentDocument(env, type, access.language);
		if (!current) return json({ ok: false, error: 'DOCUMENT_NOT_FOUND' }, 404);
		const title = access.language === 'ko' ? current.document.title_ko : current.document.title_ja;
		if (!current.versionId) {
			return json({
				ok: true,
				access: { language: access.language, allowSkillSheet: access.allowSkillSheet, allowCareerHistory: access.allowCareerHistory },
				document: { documentType: type, title, registered: false },
			});
		}

		const version = await env.song_project_db.prepare(`
			SELECT id, version_no, original_file_name, original_file_size, preview_page_count, created_at
			FROM protected_document_versions
			WHERE id = ?1 AND conversion_status = 'ready'
			LIMIT 1
		`).bind(current.versionId).first<Record<string, unknown>>();
		if (!version) return json({ ok: true, document: { documentType: type, title, registered: false } });

		const previews = await env.song_project_db.prepare(`
			SELECT sheet_index, sheet_name, row_count, column_count, rows_json
			FROM protected_document_sheet_previews
			WHERE version_id = ?1
			ORDER BY sheet_index ASC
		`).bind(current.versionId).all<Record<string, unknown>>();
		await recordAccess(request, env, access, Number(current.document.id), current.versionId, 'view_preview');

		return json({
			ok: true,
			access: { language: access.language, allowSkillSheet: access.allowSkillSheet, allowCareerHistory: access.allowCareerHistory },
			document: {
				documentType: type,
				title,
				registered: true,
				versionId: Number(version.id),
				versionNo: Number(version.version_no),
				fileName: String(version.original_file_name ?? ''),
				fileSize: Number(version.original_file_size) || 0,
				registeredAt: version.created_at,
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
			},
		});
	} catch (error) {
		console.error('Failed to load protected document', error);
		return json({ ok: false, error: 'PROTECTED_DOCUMENT_LOAD_FAILED' }, 500);
	}
}

export async function handleDownloadProtectedDocument(request: Request, env: Env): Promise<Response> {
	const access = await accessContext(request, env);
	if (!access) return json({ ok: false, error: 'PROTECTED_SESSION_REQUIRED' }, 401);
	const url = new URL(request.url);
	const type = documentType(url.searchParams.get('type'));
	if (!type) return json({ ok: false, error: 'INVALID_DOCUMENT_TYPE' }, 400);
	if (!allowed(access, type)) return json({ ok: false, error: 'DOCUMENT_NOT_ALLOWED' }, 403);

	try {
		const current = await currentDocument(env, type, access.language);
		if (!current?.versionId) return json({ ok: false, error: 'DOCUMENT_NOT_REGISTERED' }, 404);
		const version = await env.song_project_db.prepare(`
			SELECT id, original_file_key, original_file_name
			FROM protected_document_versions
			WHERE id = ?1 AND conversion_status = 'ready'
			LIMIT 1
		`).bind(current.versionId).first<Record<string, unknown>>();
		if (!version) return json({ ok: false, error: 'DOCUMENT_NOT_REGISTERED' }, 404);
		const object = await env.song_project_assets.get(String(version.original_file_key));
		if (!object) return json({ ok: false, error: 'ORIGINAL_FILE_NOT_FOUND' }, 404);
		await recordAccess(request, env, access, Number(current.document.id), current.versionId, 'download_excel');
		const fileName = String(version.original_file_name ?? 'document.xlsx').replace(/[\r\n"]/g, '_');
		const headers = new Headers();
		object.writeHttpMetadata(headers);
		headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
		headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
		headers.set('Cache-Control', 'private, no-store');
		return new Response(object.body, { headers });
	} catch (error) {
		console.error('Failed to download protected document', error);
		return json({ ok: false, error: 'PROTECTED_DOCUMENT_DOWNLOAD_FAILED' }, 500);
	}
}
