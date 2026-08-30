type PublicLanguage = 'ja' | 'ko';

interface CommentPayload {
	postId?: unknown;
	language?: unknown;
	nickname?: unknown;
	password?: unknown;
	content?: unknown;
}

interface PublicCommentRow {
	id: number;
	parent_id: number | null;
	nickname: string;
	content: string;
	admin_id: number | null;
	created_at: string;
	updated_at: string;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, {
		status,
		headers: { 'Cache-Control': 'no-store' },
	});
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

function parseLanguage(value: unknown): PublicLanguage | null {
	return value === 'ja' || value === 'ko' ? value : null;
}

function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hashPassword(password: string): Promise<string> {
	const iterations = 100_000;
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits'],
	);
	const derived = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
		keyMaterial,
		256,
	);
	return `pbkdf2-sha256$${iterations}$${bytesToBase64Url(salt)}$${bytesToBase64Url(new Uint8Array(derived))}`;
}

function getClientIp(request: Request): string | null {
	const cloudflareIp = request.headers.get('CF-Connecting-IP')?.trim();
	if (cloudflareIp) return cloudflareIp;
	const forwarded = request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim();
	return forwarded || null;
}

function maskIp(ip: string | null): string | null {
	if (!ip) return null;
	if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) {
		const parts = ip.split('.');
		return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
	}
	if (ip.includes(':')) {
		const parts = ip.split(':');
		return `${parts.slice(0, 4).join(':')}::`;
	}
	return null;
}

function commentSecret(env: Env): string | null {
	const value = (env as Env & { COMMENT_IP_SECRET?: string }).COMMENT_IP_SECRET;
	return typeof value === 'string' && value.length >= 16 ? value : null;
}

async function hashIp(ip: string | null, secret: string | null): Promise<string | null> {
	if (!ip) return null;
	const encoder = new TextEncoder();
	if (secret) {
		const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
		const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(ip));
		return bytesToBase64Url(new Uint8Array(signature));
	}
	const digest = await crypto.subtle.digest('SHA-256', encoder.encode(ip));
	return bytesToBase64Url(new Uint8Array(digest));
}

async function encryptIp(ip: string | null, secret: string | null): Promise<string | null> {
	if (!ip || !secret) return null;
	const encoder = new TextEncoder();
	const keyBytes = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
	const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(ip));
	return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(encrypted))}`;
}

async function publishedPostExists(db: D1Database, postId: number): Promise<boolean> {
	const row = await db
		.prepare(`
			SELECT id
			FROM posts
			WHERE id = ?1
				AND status = 'published'
				AND deleted_at IS NULL
			LIMIT 1
		`)
		.bind(postId)
		.first<{ id: number }>();
	return Boolean(row);
}

export async function handleListPublicComments(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const postId = Number(url.searchParams.get('postId'));
	const language = parseLanguage(url.searchParams.get('lang'));
	if (!Number.isSafeInteger(postId) || postId <= 0 || !language) {
		return json({ ok: false, error: 'INVALID_REQUEST' }, 400);
	}

	try {
		if (!(await publishedPostExists(env.song_project_db, postId))) {
			return json({ ok: false, error: 'POST_NOT_FOUND' }, 404);
		}

		const result = await env.song_project_db
			.prepare(`
				SELECT id, parent_id, nickname, content, admin_id, created_at, updated_at
				FROM comments
				WHERE post_id = ?1
					AND language_code = ?2
					AND status = 'visible'
					AND deleted_at IS NULL
				ORDER BY datetime(created_at) ASC, id ASC
			`)
			.bind(postId, language)
			.all<PublicCommentRow>();

		return json({
			ok: true,
			comments: result.results.map((row) => ({
				id: row.id,
				parentId: row.parent_id,
				nickname: row.nickname,
				content: row.content,
				isAdmin: row.admin_id !== null,
				createdAt: row.created_at,
				updatedAt: row.updated_at,
			})),
		});
	} catch (error) {
		console.error('Failed to list public comments', error);
		return json({ ok: false, error: 'COMMENT_LIST_FAILED' }, 500);
	}
}

export async function handleCreatePublicComment(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);

	let payload: CommentPayload;
	try {
		payload = await request.json() as CommentPayload;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}

	const postId = Number(payload.postId);
	const language = parseLanguage(payload.language);
	const nickname = typeof payload.nickname === 'string' ? payload.nickname.trim() : '';
	const password = typeof payload.password === 'string' ? payload.password : '';
	const content = typeof payload.content === 'string' ? payload.content.trim() : '';

	if (!Number.isSafeInteger(postId) || postId <= 0 || !language) {
		return json({ ok: false, error: 'INVALID_REQUEST' }, 400);
	}
	if (!nickname || nickname.length > 40) {
		return json({ ok: false, error: 'INVALID_NICKNAME' }, 400);
	}
	if (password.length < 4 || password.length > 100) {
		return json({ ok: false, error: 'INVALID_PASSWORD' }, 400);
	}
	if (!content || content.length > 2000) {
		return json({ ok: false, error: 'INVALID_CONTENT' }, 400);
	}

	try {
		if (!(await publishedPostExists(env.song_project_db, postId))) {
			return json({ ok: false, error: 'POST_NOT_FOUND' }, 404);
		}

		const ip = getClientIp(request);
		const secret = commentSecret(env);
		const [passwordHash, ipHash, ipEncrypted] = await Promise.all([
			hashPassword(password),
			hashIp(ip, secret),
			encryptIp(ip, secret),
		]);
		const ipMasked = maskIp(ip);
		const countryCode = request.headers.get('CF-IPCountry')?.trim() || null;

		const inserted = await env.song_project_db
			.prepare(`
				INSERT INTO comments
					(post_id, parent_id, admin_id, nickname, password_hash, content,
					 ip_encrypted, ip_hash, ip_masked, country_code, language_code, status)
				VALUES (?1, NULL, NULL, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'visible')
				RETURNING id, created_at, updated_at
			`)
			.bind(postId, nickname, passwordHash, content, ipEncrypted, ipHash, ipMasked, countryCode, language)
			.first<{ id: number; created_at: string; updated_at: string }>();

		if (!inserted) throw new Error('COMMENT_INSERT_RETURNING_FAILED');

		return json({
			ok: true,
			comment: {
				id: inserted.id,
				parentId: null,
				nickname,
				content,
				isAdmin: false,
				createdAt: inserted.created_at,
				updatedAt: inserted.updated_at,
			},
		}, 201);
	} catch (error) {
		console.error('Failed to create public comment', error);
		return json({ ok: false, error: 'COMMENT_CREATE_FAILED' }, 500);
	}
}
