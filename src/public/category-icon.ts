function badRequest(): Response {
	return Response.json({ ok: false, error: 'INVALID_ICON_KEY' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
}

export async function handleGetPublicCategoryIcon(request: Request, env: Env): Promise<Response> {
	const key = new URL(request.url).searchParams.get('key')?.trim() ?? '';
	if (!/^category-icons\/[0-9a-f-]{20,80}\.(?:png|jpe?g|webp)$/i.test(key)) return badRequest();
	try {
		const object = await env.song_project_assets.get(key);
		if (!object) return new Response('Not Found', { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } });
		const headers = new Headers();
		object.writeHttpMetadata(headers);
		headers.set('Cache-Control', 'public, max-age=31536000, immutable');
		headers.set('X-Content-Type-Options', 'nosniff');
		headers.set('Content-Disposition', 'inline');
		if (object.httpEtag) headers.set('ETag', object.httpEtag);
		return new Response(object.body, { status: 200, headers });
	} catch (error) {
		console.error('Failed to load public category icon', error);
		return new Response('Internal Server Error', { status: 500 });
	}
}
