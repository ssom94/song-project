import { ADMIN_SESSION_COOKIE } from './session';

function getCookie(request: Request, name: string): string | null {
	const cookieHeader = request.headers.get('Cookie');
	if (!cookieHeader) {
		return null;
	}

	for (const part of cookieHeader.split(';')) {
		const [rawName, ...rawValueParts] = part.trim().split('=');
		if (rawName === name) {
			return decodeURIComponent(rawValueParts.join('='));
		}
	}

	return null;
}

async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function clearSessionCookie(request: Request): string {
	const url = new URL(request.url);
	const secure = url.protocol === 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1';
	return [
		`${ADMIN_SESSION_COOKIE}=`,
		'Path=/',
		'HttpOnly',
		'SameSite=Strict',
		'Max-Age=0',
		'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
		secure ? 'Secure' : null,
	]
		.filter(Boolean)
		.join('; ');
}

export async function handleAdminLogout(request: Request, env: Env): Promise<Response> {
	const rawToken = getCookie(request, ADMIN_SESSION_COOKIE);

	if (rawToken) {
		const tokenHash = await sha256Hex(rawToken);
		await env.song_project_db
			.prepare(`
				UPDATE admin_sessions
				SET revoked_at = COALESCE(revoked_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
				WHERE token_hash = ?1
			`)
			.bind(tokenHash)
			.run();
	}

	return Response.json(
		{ authenticated: false },
		{
			headers: {
				'Cache-Control': 'no-store',
				'Set-Cookie': clearSessionCookie(request),
			},
		},
	);
}
