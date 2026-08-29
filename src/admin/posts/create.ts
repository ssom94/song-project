import { getAuthenticatedAdminSession } from '../../auth/session';

type SupportedLanguage = 'ja' | 'ko';

interface CreatePostPayload {
	title?: unknown;
	content?: unknown;
	sourceLanguage?: unknown;
	status?: unknown;
	translationMethod?: unknown;
	translatedTitle?: unknown;
	translatedContent?: unknown;
	categoryId?: unknown;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, {
		status,
		headers: {
			'Cache-Control': 'no-store',
		},
	});
}

function countMatches(text: string, regex: RegExp): number {
	return (text.match(regex) ?? []).length;
}

function detectSourceLanguage(text: string): SupportedLanguage | null {
	const hangulCount = countMatches(text, /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/g);
	const kanaCount = countMatches(text, /[\u3040-\u30ff\u31f0-\u31ff]/g);
	const kanjiCount = countMatches(text, /[\u3400-\u4dbf\u4e00-\u9fff]/g);

	if (hangulCount === 0 && kanaCount === 0 && kanjiCount === 0) return null;
	if (hangulCount > 0 && kanaCount === 0 && kanjiCount === 0) return 'ko';
	if (kanaCount > 0 && hangulCount === 0) return 'ja';
	if (hangulCount === 0 && (kanaCount > 0 || kanjiCount > 0)) return 'ja';

	const koreanScore = hangulCount * 3;
	const japaneseScore = (kanaCount * 3) + (kanjiCount * 0.35);

	if (Math.abs(koreanScore - japaneseScore) > Math.max(koreanScore, japaneseScore) * 0.15) {
		return koreanScore > japaneseScore ? 'ko' : 'ja';
	}

	for (const character of text) {
		if (/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/.test(character)) return 'ko';
		if (/[\u3040-\u30ff\u31f0-\u31ff]/.test(character)) return 'ja';
	}

	return koreanScore >= japaneseScore ? 'ko' : 'ja';
}

function makePostId(): number {
	const random = new Uint32Array(1);
	crypto.getRandomValues(random);
	return (Date.now() * 1000) + (random[0] % 1000);
}

function makeSlug(title: string, postId: number): string {
	const normalized = title
		.normalize('NFKC')
		.toLocaleLowerCase()
		.trim()
		.replace(/[^\p{Letter}\p{Number}]+/gu, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80)
		.replace(/-+$/g, '');

	return `${normalized || 'post'}-${postId.toString(36)}`;
}

function makeExcerpt(content: string): string | null {
	const compact = content.replace(/\s+/g, ' ').trim();
	return compact ? compact.slice(0, 180) : null;
}

function oppositeLanguage(language: SupportedLanguage): SupportedLanguage {
	return language === 'ja' ? 'ko' : 'ja';
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

export async function handleCreateAdminPost(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) {
		return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	}

	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) {
		return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	}

	let payload: CreatePostPayload;
	try {
		payload = (await request.json()) as CreatePostPayload;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}

	const title = typeof payload.title === 'string' ? payload.title.trim() : '';
	const content = typeof payload.content === 'string' ? payload.content.trim() : '';
	const sourceLanguageMode = payload.sourceLanguage;
	const status = payload.status;
	const translationMethod = payload.translationMethod;
	const translatedTitle = typeof payload.translatedTitle === 'string' ? payload.translatedTitle.trim() : '';
	const translatedContent = typeof payload.translatedContent === 'string' ? payload.translatedContent.trim() : '';

	if (!title || !content) {
		return json({ ok: false, error: 'TITLE_AND_CONTENT_REQUIRED' }, 400);
	}
	if (title.length > 200 || content.length > 100_000) {
		return json({ ok: false, error: 'CONTENT_TOO_LONG' }, 400);
	}
	if (sourceLanguageMode !== 'auto' && sourceLanguageMode !== 'ja' && sourceLanguageMode !== 'ko') {
		return json({ ok: false, error: 'INVALID_SOURCE_LANGUAGE' }, 400);
	}
	if (status !== 'draft' && status !== 'published') {
		return json({ ok: false, error: 'INVALID_STATUS' }, 400);
	}
	if (translationMethod !== 'ai' && translationMethod !== 'manual' && translationMethod !== 'later') {
		return json({ ok: false, error: 'INVALID_TRANSLATION_METHOD' }, 400);
	}

	const resolvedSourceLanguage: SupportedLanguage | null = sourceLanguageMode === 'auto'
		? detectSourceLanguage(`${title}\n${content}`)
		: sourceLanguageMode;

	if (!resolvedSourceLanguage) {
		return json({ ok: false, error: 'LANGUAGE_NOT_DETECTED' }, 400);
	}

	const targetLanguage = oppositeLanguage(resolvedSourceLanguage);
	if (translationMethod === 'manual') {
		if (!translatedTitle || !translatedContent) {
			return json({ ok: false, error: 'MANUAL_TRANSLATION_REQUIRED' }, 400);
		}
		if (translatedTitle.length > 200 || translatedContent.length > 100_000) {
			return json({ ok: false, error: 'CONTENT_TOO_LONG' }, 400);
		}
	}

	let categoryId: number | null = null;
	if (payload.categoryId !== null && payload.categoryId !== undefined && payload.categoryId !== '') {
		const parsedCategoryId = Number(payload.categoryId);
		if (!Number.isSafeInteger(parsedCategoryId) || parsedCategoryId <= 0) {
			return json({ ok: false, error: 'INVALID_CATEGORY' }, 400);
		}
		const category = await env.song_project_db
			.prepare('SELECT id FROM categories WHERE id = ?1 AND deleted_at IS NULL LIMIT 1')
			.bind(parsedCategoryId)
			.first<{ id: number }>();
		if (!category) {
			return json({ ok: false, error: 'INVALID_CATEGORY' }, 400);
		}
		categoryId = parsedCategoryId;
	}

	const postId = makePostId();
	const sourceSlug = makeSlug(title, postId);
	const sourceExcerpt = makeExcerpt(content);
	const publishedAt = status === 'published' ? new Date().toISOString() : null;

	const statements = [
		env.song_project_db
			.prepare(`
				INSERT INTO posts (id, original_language, status, category_id, published_at)
				VALUES (?1, ?2, ?3, ?4, ?5)
			`)
			.bind(postId, resolvedSourceLanguage, status, categoryId, publishedAt),
		env.song_project_db
			.prepare(`
				INSERT INTO post_translations
					(post_id, language_code, title, slug, content, excerpt, translation_status)
				VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'original')
			`)
			.bind(postId, resolvedSourceLanguage, title, sourceSlug, content, sourceExcerpt),
		env.song_project_db
			.prepare(`
				INSERT INTO post_revisions
					(post_id, language_code, revision_no, title, slug, content, excerpt,
					 status_snapshot, category_id_snapshot, change_type, change_summary, created_by)
				VALUES (?1, ?2, 1, ?3, ?4, ?5, ?6, ?7, ?8, 'create', ?9, ?10)
			`)
			.bind(
				postId,
				resolvedSourceLanguage,
				title,
				sourceSlug,
				content,
				sourceExcerpt,
				status,
				categoryId,
				'Initial post creation',
				session.adminId,
			),
	];

	if (translationMethod === 'manual') {
		const translatedSlug = makeSlug(translatedTitle, postId);
		const translatedExcerpt = makeExcerpt(translatedContent);

		statements.push(
			env.song_project_db
				.prepare(`
					INSERT INTO post_translations
						(post_id, language_code, title, slug, content, excerpt, translation_status)
					VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'reviewed')
				`)
				.bind(postId, targetLanguage, translatedTitle, translatedSlug, translatedContent, translatedExcerpt),
			env.song_project_db
				.prepare(`
					INSERT INTO post_revisions
						(post_id, language_code, revision_no, title, slug, content, excerpt,
						 status_snapshot, category_id_snapshot, change_type, change_summary, created_by)
					VALUES (?1, ?2, 1, ?3, ?4, ?5, ?6, ?7, ?8, 'translation_edit', ?9, ?10)
				`)
				.bind(
					postId,
					targetLanguage,
					translatedTitle,
					translatedSlug,
					translatedContent,
					translatedExcerpt,
					status,
					categoryId,
					'Manual translation created with post',
					session.adminId,
				),
		);
	}

	statements.push(
		env.song_project_db
			.prepare(`
				INSERT INTO audit_logs (admin_id, entity_type, entity_id, action, after_data, country_code, user_agent)
				VALUES (?1, 'post', ?2, 'create', ?3, ?4, ?5)
			`)
			.bind(
				session.adminId,
				postId,
				JSON.stringify({
					originalLanguage: resolvedSourceLanguage,
					status,
					translationMethod,
					hasManualTranslation: translationMethod === 'manual',
				}),
				request.headers.get('CF-IPCountry'),
				request.headers.get('User-Agent'),
			),
	);

	try {
		await env.song_project_db.batch(statements);
	} catch (error) {
		console.error('Failed to create post', error);
		return json({ ok: false, error: 'CREATE_FAILED' }, 500);
	}

	return json({
		ok: true,
		post: {
			id: postId,
			originalLanguage: resolvedSourceLanguage,
			targetLanguage,
			status,
			slug: sourceSlug,
		},
		translation: {
			method: translationMethod,
			created: translationMethod === 'manual',
			pendingAi: translationMethod === 'ai',
		},
	}, 201);
}
