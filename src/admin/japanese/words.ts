import { getAuthenticatedAdminSession } from '../../auth/session';

type WordPayload = {
	word?: unknown;
	reading?: unknown;
	meaningKo?: unknown;
	meaningJa?: unknown;
	jlptLevelId?: unknown;
	partOfSpeechId?: unknown;
	categoryId?: unknown;
	note?: unknown;
	exampleSentence?: unknown;
	exampleReading?: unknown;
	exampleTranslationKo?: unknown;
};

interface ExistingWordRow {
	id: number;
	word: string;
	reading: string | null;
	meaning_ko: string | null;
	meaning_ja: string | null;
	jlpt_level_id: number | null;
	note: string | null;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get('Origin');
	return !origin || origin === new URL(request.url).origin;
}

function makeWordId(): number {
	const random = new Uint32Array(1);
	crypto.getRandomValues(random);
	return (Date.now() * 1000) + (random[0] % 1000);
}

function optionalText(value: unknown, max: number): string | null | 'INVALID' {
	if (value === undefined || value === null) return null;
	if (typeof value !== 'string') return 'INVALID';
	const text = value.trim();
	if (!text) return null;
	return text.length <= max ? text : 'INVALID';
}

function optionalId(value: unknown): number | null | 'INVALID' {
	if (value === undefined || value === null || value === '') return null;
	const id = Number(value);
	return Number.isSafeInteger(id) && id > 0 ? id : 'INVALID';
}

async function parsePayload(request: Request) {
	let payload: WordPayload;
	try {
		payload = await request.json() as WordPayload;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}

	const word = typeof payload.word === 'string' ? payload.word.trim() : '';
	if (!word) return json({ ok: false, error: 'WORD_REQUIRED' }, 400);
	if (word.length > 120) return json({ ok: false, error: 'WORD_TOO_LONG' }, 400);

	const reading = optionalText(payload.reading, 160);
	const meaningKo = optionalText(payload.meaningKo, 500);
	const meaningJa = optionalText(payload.meaningJa, 500);
	const note = optionalText(payload.note, 2000);
	const exampleSentence = optionalText(payload.exampleSentence, 1000);
	const exampleReading = optionalText(payload.exampleReading, 1200);
	const exampleTranslationKo = optionalText(payload.exampleTranslationKo, 1200);
	const jlptLevelId = optionalId(payload.jlptLevelId);
	const partOfSpeechId = optionalId(payload.partOfSpeechId);
	const categoryId = optionalId(payload.categoryId);

	if ([
		reading,
		meaningKo,
		meaningJa,
		note,
		exampleSentence,
		exampleReading,
		exampleTranslationKo,
		jlptLevelId,
		partOfSpeechId,
		categoryId,
	].includes('INVALID')) {
		return json({ ok: false, error: 'INVALID_FIELD' }, 400);
	}

	return {
		word,
		reading: reading as string | null,
		meaningKo: meaningKo as string | null,
		meaningJa: meaningJa as string | null,
		note: note as string | null,
		exampleSentence: exampleSentence as string | null,
		exampleReading: exampleReading as string | null,
		exampleTranslationKo: exampleTranslationKo as string | null,
		jlptLevelId: jlptLevelId as number | null,
		partOfSpeechId: partOfSpeechId as number | null,
		categoryId: categoryId as number | null,
	};
}

async function validateReferences(
	db: D1Database,
	jlptLevelId: number | null,
	partOfSpeechId: number | null,
	categoryId: number | null,
): Promise<boolean> {
	if (jlptLevelId) {
		const level = await db.prepare('SELECT id FROM jlpt_levels WHERE id = ?1 LIMIT 1').bind(jlptLevelId).first();
		if (!level) return false;
	}
	if (partOfSpeechId) {
		const pos = await db
			.prepare('SELECT id FROM parts_of_speech WHERE id = ?1 AND deleted_at IS NULL LIMIT 1')
			.bind(partOfSpeechId)
			.first();
		if (!pos) return false;
	}
	if (categoryId) {
		const category = await db
			.prepare('SELECT id FROM japanese_categories WHERE id = ?1 AND deleted_at IS NULL LIMIT 1')
			.bind(categoryId)
			.first();
		if (!category) return false;
	}
	return true;
}

async function getExisting(db: D1Database, wordId: number): Promise<ExistingWordRow | null> {
	return db.prepare(`
		SELECT id, word, reading, meaning_ko, meaning_ja, jlpt_level_id, note
		FROM japanese_words
		WHERE id = ?1 AND deleted_at IS NULL
		LIMIT 1
	`).bind(wordId).first<ExistingWordRow>();
}

export async function handleListAdminJapaneseWords(request: Request, env: Env): Promise<Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	try {
		const [words, levels, parts, categories] = await Promise.all([
			env.song_project_db.prepare(`
				SELECT
					w.id, w.word, w.reading, w.meaning_ko, w.meaning_ja, w.jlpt_level_id,
					w.note, w.ai_status, w.created_at, w.updated_at,
					jl.code AS jlpt_code,
					pos.id AS part_of_speech_id,
					pos.parent_id AS part_of_speech_parent_id,
					pos.name_ja AS part_of_speech_ja,
					pos.name_ko AS part_of_speech_ko,
					cat.id AS category_id,
					cat.parent_id AS category_parent_id,
					cat.name_ja AS category_ja,
					cat.name_ko AS category_ko,
					ex.sentence_ja AS example_sentence,
					ex.reading AS example_reading,
					ex.translation_ko AS example_translation_ko
				FROM japanese_words AS w
				LEFT JOIN jlpt_levels AS jl ON jl.id = w.jlpt_level_id
				LEFT JOIN japanese_word_parts_of_speech AS wp
					ON wp.word_id = w.id AND wp.is_primary = 1
				LEFT JOIN parts_of_speech AS pos
					ON pos.id = wp.part_of_speech_id AND pos.deleted_at IS NULL
				LEFT JOIN japanese_categories AS cat
					ON cat.id = (
						SELECT wc.category_id
						FROM japanese_word_categories AS wc
						WHERE wc.word_id = w.id
						ORDER BY wc.category_id ASC
						LIMIT 1
					) AND cat.deleted_at IS NULL
				LEFT JOIN japanese_word_examples AS ex
					ON ex.id = (
						SELECT e.id FROM japanese_word_examples AS e
						WHERE e.word_id = w.id AND e.deleted_at IS NULL
						ORDER BY e.id ASC LIMIT 1
					)
				WHERE w.deleted_at IS NULL
				ORDER BY datetime(w.updated_at) DESC, w.id DESC
				LIMIT 500
			`).all(),
			env.song_project_db
				.prepare('SELECT id, code FROM jlpt_levels ORDER BY display_order ASC, id ASC')
				.all(),
			env.song_project_db.prepare(`
				SELECT id, name_ja, name_ko, parent_id, display_order
				FROM parts_of_speech
				WHERE deleted_at IS NULL
				ORDER BY display_order ASC, id ASC
			`).all(),
			env.song_project_db.prepare(`
				SELECT id, name_ja, name_ko, parent_id, display_order
				FROM japanese_categories
				WHERE deleted_at IS NULL
				ORDER BY display_order ASC, id ASC
			`).all(),
		]);

		return json({
			ok: true,
			words: words.results,
			levels: levels.results,
			partsOfSpeech: parts.results,
			categories: categories.results,
		});
	} catch (error) {
		console.error('Failed to list Japanese words', error);
		return json({ ok: false, error: 'JAPANESE_WORD_LIST_FAILED' }, 500);
	}
}

export async function handleCreateAdminJapaneseWord(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	const parsed = await parsePayload(request);
	if (parsed instanceof Response) return parsed;
	if (!(await validateReferences(
		env.song_project_db,
		parsed.jlptLevelId,
		parsed.partOfSpeechId,
		parsed.categoryId,
	))) {
		return json({ ok: false, error: 'INVALID_REFERENCE' }, 400);
	}

	const wordId = makeWordId();
	const now = new Date().toISOString();
	const statements: D1PreparedStatement[] = [
		env.song_project_db.prepare(`
			INSERT INTO japanese_words
				(id, word, reading, meaning_ko, meaning_ja, jlpt_level_id, note, created_at, updated_at)
			VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
		`).bind(wordId, parsed.word, parsed.reading, parsed.meaningKo, parsed.meaningJa, parsed.jlptLevelId, parsed.note, now),
	];

	if (parsed.partOfSpeechId) {
		statements.push(env.song_project_db.prepare(`
			INSERT INTO japanese_word_parts_of_speech (word_id, part_of_speech_id, is_primary, created_at)
			VALUES (?1, ?2, 1, ?3)
		`).bind(wordId, parsed.partOfSpeechId, now));
	}
	if (parsed.categoryId) {
		statements.push(env.song_project_db.prepare(`
			INSERT INTO japanese_word_categories (word_id, category_id, created_at)
			VALUES (?1, ?2, ?3)
		`).bind(wordId, parsed.categoryId, now));
	}
	if (parsed.exampleSentence) {
		statements.push(env.song_project_db.prepare(`
			INSERT INTO japanese_word_examples
				(word_id, sentence_ja, reading, translation_ko, source_type, created_at, updated_at)
			VALUES (?1, ?2, ?3, ?4, 'manual', ?5, ?5)
		`).bind(wordId, parsed.exampleSentence, parsed.exampleReading, parsed.exampleTranslationKo, now));
	}
	statements.push(env.song_project_db.prepare(`
		INSERT INTO audit_logs (admin_id, entity_type, entity_id, action, after_data, country_code, user_agent)
		VALUES (?1, 'japanese_word', ?2, 'create', ?3, ?4, ?5)
	`).bind(
		session.adminId,
		wordId,
		JSON.stringify({
			word: parsed.word,
			jlptLevelId: parsed.jlptLevelId,
			partOfSpeechId: parsed.partOfSpeechId,
			categoryId: parsed.categoryId,
		}),
		request.headers.get('CF-IPCountry'),
		request.headers.get('User-Agent'),
	));

	try {
		await env.song_project_db.batch(statements);
		return json({ ok: true, word: { id: wordId } }, 201);
	} catch (error) {
		console.error('Failed to create Japanese word', error);
		return json({ ok: false, error: 'JAPANESE_WORD_CREATE_FAILED' }, 500);
	}
}

export async function handleUpdateAdminJapaneseWord(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	const wordId = Number(new URL(request.url).searchParams.get('id'));
	if (!Number.isSafeInteger(wordId) || wordId <= 0) return json({ ok: false, error: 'INVALID_WORD_ID' }, 400);
	const existing = await getExisting(env.song_project_db, wordId);
	if (!existing) return json({ ok: false, error: 'WORD_NOT_FOUND' }, 404);

	const parsed = await parsePayload(request);
	if (parsed instanceof Response) return parsed;
	if (!(await validateReferences(
		env.song_project_db,
		parsed.jlptLevelId,
		parsed.partOfSpeechId,
		parsed.categoryId,
	))) {
		return json({ ok: false, error: 'INVALID_REFERENCE' }, 400);
	}

	const now = new Date().toISOString();
	const statements: D1PreparedStatement[] = [
		env.song_project_db.prepare(`
			UPDATE japanese_words
			SET word = ?1, reading = ?2, meaning_ko = ?3, meaning_ja = ?4,
				jlpt_level_id = ?5, note = ?6, updated_at = ?7
			WHERE id = ?8 AND deleted_at IS NULL
		`).bind(parsed.word, parsed.reading, parsed.meaningKo, parsed.meaningJa, parsed.jlptLevelId, parsed.note, now, wordId),
		env.song_project_db
			.prepare('DELETE FROM japanese_word_parts_of_speech WHERE word_id = ?1')
			.bind(wordId),
		env.song_project_db
			.prepare('DELETE FROM japanese_word_categories WHERE word_id = ?1')
			.bind(wordId),
		env.song_project_db
			.prepare('UPDATE japanese_word_examples SET deleted_at = ?1, updated_at = ?1 WHERE word_id = ?2 AND deleted_at IS NULL')
			.bind(now, wordId),
	];
	if (parsed.partOfSpeechId) {
		statements.push(env.song_project_db.prepare(`
			INSERT INTO japanese_word_parts_of_speech (word_id, part_of_speech_id, is_primary, created_at)
			VALUES (?1, ?2, 1, ?3)
		`).bind(wordId, parsed.partOfSpeechId, now));
	}
	if (parsed.categoryId) {
		statements.push(env.song_project_db.prepare(`
			INSERT INTO japanese_word_categories (word_id, category_id, created_at)
			VALUES (?1, ?2, ?3)
		`).bind(wordId, parsed.categoryId, now));
	}
	if (parsed.exampleSentence) {
		statements.push(env.song_project_db.prepare(`
			INSERT INTO japanese_word_examples
				(word_id, sentence_ja, reading, translation_ko, source_type, created_at, updated_at)
			VALUES (?1, ?2, ?3, ?4, 'manual', ?5, ?5)
		`).bind(wordId, parsed.exampleSentence, parsed.exampleReading, parsed.exampleTranslationKo, now));
	}
	statements.push(env.song_project_db.prepare(`
		INSERT INTO audit_logs (admin_id, entity_type, entity_id, action, before_data, after_data, country_code, user_agent)
		VALUES (?1, 'japanese_word', ?2, 'update', ?3, ?4, ?5, ?6)
	`).bind(
		session.adminId,
		wordId,
		JSON.stringify({
			word: existing.word,
			reading: existing.reading,
			meaningKo: existing.meaning_ko,
			meaningJa: existing.meaning_ja,
			jlptLevelId: existing.jlpt_level_id,
		}),
		JSON.stringify({
			word: parsed.word,
			reading: parsed.reading,
			meaningKo: parsed.meaningKo,
			meaningJa: parsed.meaningJa,
			jlptLevelId: parsed.jlptLevelId,
			partOfSpeechId: parsed.partOfSpeechId,
			categoryId: parsed.categoryId,
		}),
		request.headers.get('CF-IPCountry'),
		request.headers.get('User-Agent'),
	));

	try {
		await env.song_project_db.batch(statements);
		return json({ ok: true });
	} catch (error) {
		console.error('Failed to update Japanese word', error);
		return json({ ok: false, error: 'JAPANESE_WORD_UPDATE_FAILED' }, 500);
	}
}

export async function handleDeleteAdminJapaneseWord(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);
	const wordId = Number(new URL(request.url).searchParams.get('id'));
	if (!Number.isSafeInteger(wordId) || wordId <= 0) return json({ ok: false, error: 'INVALID_WORD_ID' }, 400);
	const existing = await getExisting(env.song_project_db, wordId);
	if (!existing) return json({ ok: false, error: 'WORD_NOT_FOUND' }, 404);
	const now = new Date().toISOString();

	try {
		await env.song_project_db.batch([
			env.song_project_db
				.prepare('UPDATE japanese_words SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL')
				.bind(now, wordId),
			env.song_project_db
				.prepare('UPDATE japanese_word_examples SET deleted_at = ?1, updated_at = ?1 WHERE word_id = ?2 AND deleted_at IS NULL')
				.bind(now, wordId),
			env.song_project_db.prepare(`
				INSERT INTO audit_logs (admin_id, entity_type, entity_id, action, before_data, country_code, user_agent)
				VALUES (?1, 'japanese_word', ?2, 'delete', ?3, ?4, ?5)
			`).bind(
				session.adminId,
				wordId,
				JSON.stringify(existing),
				request.headers.get('CF-IPCountry'),
				request.headers.get('User-Agent'),
			),
		]);
		return json({ ok: true });
	} catch (error) {
		console.error('Failed to delete Japanese word', error);
		return json({ ok: false, error: 'JAPANESE_WORD_DELETE_FAILED' }, 500);
	}
}
