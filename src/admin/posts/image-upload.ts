import { getAuthenticatedAdminSession } from '../../auth/session';

const MAX_POST_IMAGE_BYTES = 8 * 1024 * 1024;
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

function hasAscii(bytes: Uint8Array, offset: number, text: string): boolean {
	if (bytes.length < offset + text.length) return false;
	for (let index = 0; index < text.length; index += 1) {
		if (bytes[offset + index] !== text.charCodeAt(index)) return false;
	}
	return true;
}

async function hasValidImageSignature(file: File): Promise<boolean> {
	const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
	if (file.type === 'image/png') {
		const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
		return signature.every((value, index) => bytes[index] === value);
	}
	if (file.type === 'image/jpeg') {
		return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
	}
	if (file.type === 'image/webp') {
		return hasAscii(bytes, 0, 'RIFF') && hasAscii(bytes, 8, 'WEBP');
	}
	return false;
}

export async function handleUploadAdminPostImage(request: Request, env: Env): Promise<Response> {
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
	if (!(file instanceof File)) return json({ ok: false, error: 'IMAGE_FILE_REQUIRED' }, 400);
	const extension = ALLOWED_TYPES.get(file.type);
	if (!extension) return json({ ok: false, error: 'UNSUPPORTED_IMAGE_TYPE' }, 415);
	if (file.size <= 0 || file.size > MAX_POST_IMAGE_BYTES) {
		return json({ ok: false, error: 'IMAGE_FILE_TOO_LARGE', maxBytes: MAX_POST_IMAGE_BYTES }, 413);
	}
	if (!(await hasValidImageSignature(file))) return json({ ok: false, error: 'INVALID_IMAGE_FILE' }, 415);

	const key = `post-images/${crypto.randomUUID()}.${extension}`;
	try {
		await env.song_project_assets.put(key, file.stream(), {
			httpMetadata: {
				contentType: file.type,
				cacheControl: 'public, max-age=31536000, immutable',
			},
			customMetadata: {
				uploadedBy: String(session.adminId),
				purpose: 'blog-post-image',
				originalName: file.name.slice(0, 160),
			},
		});
		return json({
			ok: true,
			key,
			url: `/api/public/post-image?key=${encodeURIComponent(key)}`,
			size: file.size,
			contentType: file.type,
		});
	} catch (error) {
		console.error('Failed to upload post image', error);
		return json({ ok: false, error: 'POST_IMAGE_UPLOAD_FAILED' }, 500);
	}
}
