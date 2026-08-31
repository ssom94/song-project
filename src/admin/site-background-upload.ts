import { getAuthenticatedAdminSession } from '../auth/session';

const MAX_BACKGROUND_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
	['image/png', 'png'],
	['image/jpeg', 'jpg'],
	['image/webp', 'webp'],
]);

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

export async function handleUploadAdminSiteBackground(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return json({ ok: false, error: 'INVALID_FORM_DATA' }, 400);
	}
	const file = form.get('file');
	if (!(file instanceof File)) return json({ ok: false, error: 'BACKGROUND_FILE_REQUIRED' }, 400);
	const extension = ALLOWED_TYPES.get(file.type);
	if (!extension) return json({ ok: false, error: 'UNSUPPORTED_BACKGROUND_TYPE' }, 415);
	if (file.size <= 0 || file.size > MAX_BACKGROUND_BYTES) {
		return json({ ok: false, error: 'BACKGROUND_FILE_TOO_LARGE' }, 413);
	}

	const key = `site-backgrounds/${crypto.randomUUID()}.${extension}`;
	try {
		await env.song_project_assets.put(key, file.stream(), {
			httpMetadata: {
				contentType: file.type,
				cacheControl: 'public, max-age=31536000, immutable',
			},
			customMetadata: {
				uploadedBy: String(session.adminId),
				purpose: 'public-site-background',
			},
		});
		return json({
			ok: true,
			key,
			url: `/api/public/site-background?key=${encodeURIComponent(key)}`,
			size: file.size,
		});
	} catch (error) {
		console.error('Failed to upload site background', error);
		return json({ ok: false, error: 'BACKGROUND_UPLOAD_FAILED' }, 500);
	}
}
