import { getAuthenticatedAdminSession } from '../../auth/session';
import { parseTagIds, prepareInsertPostTagStatements, validateTagIds } from './tag-selection';

type SupportedLanguage = 'ja' | 'ko';
type PostStatus = 'draft' | 'published' | 'private';
type TranslationMethod = 'ai' | 'manual' | 'later';

interface UpdatePostPayload {
	title?: unknown;
	content?: unknown;
	sourceLanguage?: unknown;
	status?: unknown;
	translationMethod?: unknown;
	translatedTitle?: unknown;
	translatedContent?: unknown;
	categoryId?: unknown;
	tagIds?: unknown;
}

interface ExistingPostRow {
	id: number;
	original_language: SupportedLanguage;
	status: PostStatus;
	category_id: number | null;
	published_at: string | null;
	thumbnail_key: string | null;
}

interface ExistingTranslationRow {
	language_code: SupportedLanguage;
	title: string;
	slug: string;
	content: string;
	excerpt: string | null;
	translation_status: 'original' | 'pending' | 'translated' | 'reviewed';
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

async function nextRevisionNumber(db: D1Database, postId: number, language: SupportedLanguage): Promise<number> {
	const row = await db
		.prepare(`
			SELECT COALESCE(MAX(revision_no), 0) + 1 AS next_revision
			FROM post_revisions
			WHERE post_id = ?1 AND language_code = ?2
		`)
		.bind(postId, language)
		.first<{ next_revision: number }>();

	return row?.next_revision ?? 1;
}

export async function handleUpdateAdminPost(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) {
		return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	}

	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) {
		return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	}

	const url = new URL(request.url);
	const postId = Number(url.searchParams.get('id'));
	if (!Number.isSafeInteger(postId) || postId <= 0) {
		return json({ ok: false, error: 'INVALID_POST_ID' }, 400);
	}

	let payload: UpdatePostPayload;
	try {
		payload = (await request.json()) as UpdatePostPayload;
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
	const tagIds = parseTagIds(payload.tagIds);

	if (!title || !content) {
		return json({ ok: false, error: 'TITLE_AND_CONTENT_REQUIRED' }, 400);
	}
	if (title.length > 200 || content.length > 100_000) {
		return json({ ok: false, error: 'CONTENT_TOO_LONG' }, 400);
	}
	if (sourceLanguageMode !== 'auto' && sourceLanguageMode !== 'ja' && sourceLanguageMode !== 'ko') {
		return json({ ok: false, error: 'INVALID_SOURCE_LANGUAGE' }, 400);
	}
	if (status !== 'draft' && status !== 'published' && status !== 'private') {
		return json({ ok: false, error: 'INVALID_STATUS' }, 400);
	}
	if (translationMethod !== 'ai' && translationMethod !== 'manual' && translationMethod !== 'later') {
		return json({ ok: false, error: 'INVALID_TRANSLATION_METHOD' }, 400);
	}
	if (!tagIds) {
		return json({ ok: false, error: 'INVALID_TAGS' }, 400);
	}
	if (translationMethod === 'manual') {
		if (!translatedTitle || !translatedContent) {
			return json({ ok: false, error: 'MANUAL_TRANSLATION_REQUIRED' }, 400);
		}
		if (translatedTitle.length > 200 || translatedContent.length > 100_000) {
			return json({ ok: false, error: 'CONTENT_TOO_LONG' }, 400);
		}
	}

	const existingPost = await env.song_project_db
		.prepare(`
			SELECT id, original_language, status, category_id, published_at, thumbnail_key
			FROM posts
			WHERE id = ?1 AND deleted_at IS NULL
			LIMIT 1
		`)
		.bind(postId)
		.first<ExistingPostRow>();

	if (!existingPost) {
		return json({ ok: false, error: 'POST_NOT_FOUND' }, 404);
	}

	const resolvedSourceLanguage: SupportedLanguage | null = sourceLanguageMode === 'auto'
		? detectSourceLanguage(`${title}\n${content}`)
		: sourceLanguageMode;
	if (!resolvedSourceLanguage) {
		return json({ ok: false, error: 'LANGUAGE_NOT_DETECTED' }, 400);
	}
	if (resolvedSourceLanguage !== existingPost.original_language) {
		return json({ ok: false, error: 'ORIGINAL_LANGUAGE_IMMUTABLE' }, 409);
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

	if (!(await validateTagIds(env.song_project_db, tagIds))) {
		return json({ ok: false, error: 'INVALID_TAGS' }, 400);
	}

	const [translationsResult, existingTagRows] = await Promise.all([
		env.song_project_db
			.prepare(`
				SELECT language_code, title, slug, content, excerpt, translation_status
				FROM post_translations
				WHERE post_id = ?1
			`)
			.bind(postId)
			.all<ExistingTranslationRow>(),
		env.song_project_db
			.prepare('SELECT tag_id FROM post_tags WHERE post_id = ?1 ORDER BY tag_id ASC')
			.bind(postId)
			.all<{ tag_id: number }>(),
	]);

	const existingTagIds = existingTagRows.results.map((row) => row.tag_id);
	const sourceTranslation = translationsResult.results.find(
		(translation) => translation.language_code === existingPost.original_language,
	);
	if (!sourceTranslation) {
		return json({ ok: false, error: 'SOURCE_TRANSLATION_NOT_FOUND' }, 409);
	}

	const targetLanguage = oppositeLanguage(existingPost.original_language);
	const targetTranslation = translationsResult.results.find(
		(translation) => translation.language_code === targetLanguage,
	);
	const sourceContentChanged = title !== sourceTranslation.title || content !== sourceTranslation.content;
	const now = new Date().toISOString();
	const publishedAt = status === 'published'
		? (existingPost.published_at ?? now)
		: existingPost.published_at;
	const sourceExcerpt = makeExcerpt(content);
	const sourceRevision = await nextRevisionNumber(env.song_project_db, postId, existingPost.original_language);

	const sourceChangeType = existingPost.status !== 'published' && status === 'published'
		? 'publish'
		: existingPost.status === 'published' && status !== 'published'
			? 'unpublish'
			: 'manual_edit';

	const statements: D1PreparedStatement[] = [
		env.song_project_db
			.prepare(`
				UPDATE posts
				SET status = ?1,
					category_id = ?2,
					published_at = ?3,
					updated_at = ?4
				WHERE id = ?5 AND deleted_at IS NULL
			`)
			.bind(status, categoryId, publishedAt, now, postId),
		env.song_project_db
			.prepare(`
				UPDATE post_translations
				SET title = ?1,
					content = ?2,
					excerpt = ?3,
					translation_status = 'original',
					updated_at = ?4
				WHERE post_id = ?5 AND language_code = ?6
			`)
			.bind(title, content, sourceExcerpt, now, postId, existingPost.original_language),
		env.song_project_db
			.prepare(`
				INSERT INTO post_revisions
					(post_id, language_code, revision_no, title, slug, content, excerpt,
					 status_snapshot, category_id_snapshot, thumbnail_key_snapshot,
					 change_type, change_summary, created_by)
				VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
			`)
			.bind(
				postId,
				existingPost.original_language,
				sourceRevision,
				title,
				sourceTranslation.slug,
				content,
				sourceExcerpt,
				status,
				categoryId,
				existingPost.thumbnail_key,
				sourceChangeType,
				'Post edited in admin',
				session.adminId,
			),
	];

	let targetTranslationStatus = targetTranslation?.translation_status ?? null;
	if (translationMethod === 'manual') {
		const translatedExcerpt = makeExcerpt(translatedContent);
		const translatedSlug = targetTranslation?.slug ?? makeSlug(translatedTitle, postId);
		const targetRevision = await nextRevisionNumber(env.song_project_db, postId, targetLanguage);

		if (targetTranslation) {
			statements.push(
				env.song_project_db
					.prepare(`
						UPDATE post_translations
						SET title = ?1,
							content = ?2,
							excerpt = ?3,
							translation_status = 'reviewed',
							updated_at = ?4
						WHERE post_id = ?5 AND language_code = ?6
					`)
					.bind(translatedTitle, translatedContent, translatedExcerpt, now, postId, targetLanguage),
			);
		} else {
			statements.push(
				env.song_project_db
					.prepare(`
						INSERT INTO post_translations
							(post_id, language_code, title, slug, content, excerpt, translation_status, created_at, updated_at)
						VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'reviewed', ?7, ?7)
					`)
					.bind(postId, targetLanguage, translatedTitle, translatedSlug, translatedContent, translatedExcerpt, now),
			);
		}

		statements.push(
			env.song_project_db
				.prepare(`
					INSERT INTO post_revisions
						(post_id, language_code, revision_no, title, slug, content, excerpt,
						 status_snapshot, category_id_snapshot, thumbnail_key_snapshot,
						 change_type, change_summary, created_by)
					VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'translation_edit', ?11, ?12)
				`)
				.bind(
					postId,
					targetLanguage,
					targetRevision,
					translatedTitle,
					translatedSlug,
					translatedContent,
					translatedExcerpt,
					status,
					categoryId,
					existingPost.thumbnail_key,
					'Manual translation edited in admin',
					session.adminId,
				),
		);
		targetTranslationStatus = 'reviewed';
	} else if (sourceContentChanged && targetTranslation) {
		statements.push(
			env.song_project_db
				.prepare(`
					UPDATE post_translations
					SET translation_status = 'pending', updated_at = ?1
					WHERE post_id = ?2 AND language_code = ?3
				`)
				.bind(now, postId, targetLanguage),
		);
		targetTranslationStatus = 'pending';
	}

	statements.push(
		env.song_project_db
			.prepare('DELETE FROM post_tags WHERE post_id = ?1')
			.bind(postId),
		...prepareInsertPostTagStatements(env.song_project_db, postId, tagIds),
	);

	statements.push(
		env.song_project_db
			.prepare(`
				INSERT INTO audit_logs
					(admin_id, entity_type, entity_id, action, before_data, after_data, country_code, user_agent)
				VALUES (?1, 'post', ?2, 'update', ?3, ?4, ?5, ?6)
			`)
			.bind(
				session.adminId,
				postId,
				JSON.stringify({
					status: existingPost.status,
					categoryId: existingPost.category_id,
					tagIds: existingTagIds,
					title: sourceTranslation.title,
					targetTranslationStatus: targetTranslation?.translation_status ?? null,
				}),
				JSON.stringify({
					status,
					categoryId,
					tagIds,
					title,
					translationMethod,
					targetTranslationStatus,
				}),
				request.headers.get('CF-IPCountry'),
				request.headers.get('User-Agent'),
			),
	);

	try {
		await env.song_project_db.batch(statements);
	} catch (error) {
		console.error('Failed to update post', error);
		return json({ ok: false, error: 'UPDATE_FAILED' }, 500);
	}

	return json({
		ok: true,
		post: {
			id: postId,
			originalLanguage: existingPost.original_language,
			status,
			categoryId,
			tagIds,
			updatedAt: now,
			sourceRevision,
		},
		translation: {
			method: translationMethod,
			targetLanguage,
			status: targetTranslationStatus,
			pendingAi: translationMethod === 'ai',
		},
	});
}
