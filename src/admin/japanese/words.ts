import { getAuthenticatedAdminSession } from '../../auth/session';

type WordPayload = {
	word?: unknown;
	reading?: unknown;
	meaningKo?: unknown;
	meaningJa?: unknown;
	jlptLevelId?: unknown;
	partOfSpeechId?: unknown;
	partOfSpeechIds?: unknown;
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

interface WordListRow extends ExistingWordRow {
	ai_status: string;
	created_at: string;
	updated_at: string;
	jlpt_code: string | null;
	category_id: number | null;
	category_parent_id: number | null;
	category_ja: string | null;
	category_ko: string | null;
}

interface WordPartRow {
	word_id: number;
	id: number;
	parent_id: number | null;
	name_ja: string;
	name_ko: string;
	is_primary: number;
}

interface WordExampleRow {
	id: number;
	word_id: number;
	sentence_ja: string;
	reading: string | null;
	translation_ko: string | null;
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

function optionalIdList(values: unknown, fallback: unknown): number[] | 'INVALID' {
	const source = Array.isArray(values)
		? values
		: fallback === undefined || fallback === null || fallback === ''
			? []
			: [fallback];
	if (source.length > 20) return 'INVALID';

	const ids: number[] = [];
	for (const value of source) {
		const id = optionalId(value);
		if (id === 'INVALID') return 'INVALID';
		if (id && !ids.includes(id)) ids.push(id);
	}
	return ids;
}

async function parsePayload(request: Request) {
	let payload: WordPayload;
	try {
		payload = await request.json() as WordPayload;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}

	const word = typeof payload.word === 'string' ? payload.word.normalize('NFKC').trim() : '';
	if (!word) return json({ ok: false, error: 'WORD_REQUIRED' }, 400);
	if (word.length > 120) return json({ ok: false, error: 'WORD_TOO_LONG' }, 400);

	const reading = optionalText(payload.reading, 160);
	const meaningKo = optionalText(payload.meaningKo, 4000);
	const meaningJa = optionalText(payload.meaningJa, 1000);
	const note = optionalText(payload.note, 2000);
	const exampleSentence = optionalText(payload.exampleSentence, 1000);
	const exampleReading = optionalText(payload.exampleReading, 1200);
	const exampleTranslationKo = optionalText(payload.exampleTranslationKo, 1200);
	const jlptLevelId = optionalId(payload.jlptLevelId);
	const partOfSpeechIds = optionalIdList(payload.partOfSpeechIds, payload.partOfSpeechId);
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
		partOfSpeechIds,
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
		partOfSpeechIds: partOfSpeechIds as number[],
		categoryId: categoryId as number | null,
	};
}

async function validateReferences(
	db: D1Database,
	jlptLevelId: number | null,
	partOfSpeechIds: number[],
	categoryId: number | null,
): Promise<boolean> {
	if (jlptLevelId) {
		const level = await db.prepare('SELECT id FROM jlpt_levels WHERE id = ?1 LIMIT 1').bind(jlptLevelId).first();
		if (!level) return false;
	}
	for (const partOfSpeechId of partOfSpeechIds) {
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

async function findDuplicateWord(db: D1Database, word: string, excludeId: number | null = null): Promise<{ id: number } | null> {
	return db.prepare(`
		SELECT id
		FROM japanese_words
		WHERE word = ?1 COLLATE NOCASE
			AND deleted_at IS NULL
			AND (?2 IS NULL OR id <> ?2)
		ORDER BY id ASC
		LIMIT 1
	`).bind(word, excludeId).first<{ id: number }>();
}

export async function handleListAdminJapaneseWords(request: Request, env: Env): Promise<Response> {
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	try {
		const [words, wordParts, wordExamples, levels, parts, categories] = await Promise.all([
			env.song_project_db.prepare(`
				SELECT
					w.id, w.word, w.reading, w.meaning_ko, w.meaning_ja, w.jlpt_level_id,
					w.note, w.ai_status, w.created_at, w.updated_at,
					jl.code AS jlpt_code,
					cat.id AS category_id,
					cat.parent_id AS category_parent_id,
					cat.name_ja AS category_ja,
					cat.name_ko AS category_ko
				FROM japanese_words AS w
				LEFT JOIN jlpt_levels AS jl ON jl.id = w.jlpt_level_id
				LEFT JOIN japanese_categories AS cat
					ON cat.id = (
						SELECT wc.category_id
						FROM japanese_word_categories AS wc
						WHERE wc.word_id = w.id
						ORDER BY wc.category_id ASC
						LIMIT 1
					) AND cat.deleted_at IS NULL
				WHERE w.deleted_at IS NULL
				ORDER BY datetime(w.updated_at) DESC, w.id DESC
				LIMIT 500
			`).all<WordListRow>(),
			env.song_project_db.prepare(`
				SELECT
					wp.word_id,
					p.id,
					p.parent_id,
					p.name_ja,
					p.name_ko,
					wp.is_primary
				FROM japanese_word_parts_of_speech AS wp
				INNER JOIN japanese_words AS w ON w.id = wp.word_id AND w.deleted_at IS NULL
				INNER JOIN parts_of_speech AS p ON p.id = wp.part_of_speech_id AND p.deleted_at IS NULL
				ORDER BY wp.word_id, wp.is_primary DESC, p.display_order ASC, p.id ASC
			`).all<WordPartRow>(),
			env.song_project_db.prepare(`
				SELECT e.id, e.word_id, e.sentence_ja, e.reading, e.translation_ko
				FROM japanese_word_examples AS e
				INNER JOIN japanese_words AS w ON w.id = e.word_id AND w.deleted_at IS NULL
				WHERE e.deleted_at IS NULL
				ORDER BY e.word_id, e.id ASC
			`).all<WordExampleRow>(),
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

		const partMap = new Map<number, WordPartRow[]>();
		for (const row of wordParts.results) {
			const list = partMap.get(row.word_id) ?? [];
			list.push(row);
			partMap.set(row.word_id, list);
		}

		const exampleMap = new Map<number, WordExampleRow[]>();
		for (const row of wordExamples.results) {
			const list = exampleMap.get(row.word_id) ?? [];
			list.push(row);
			exampleMap.set(row.word_id, list);
		}

		return json({
			ok: true,
			words: words.results.map((word) => {
				const wordPartList = partMap.get(word.id) ?? [];
				const primaryPart = wordPartList.find((part) => part.is_primary === 1) ?? wordPartList[0] ?? null;
				const examples = exampleMap.get(word.id) ?? [];
				const firstExample = examples[0] ?? null;
				return {
					...word,
					parts: wordPartList,
					part_of_speech_id: primaryPart?.id ?? null,
					part_of_speech_parent_id: primaryPart?.parent_id ?? null,
					part_of_speech_ja: primaryPart?.name_ja ?? null,
					part_of_speech_ko: primaryPart?.name_ko ?? null,
					examples,
					example_sentence: firstExample?.sentence_ja ?? null,
					example_reading: firstExample?.reading ?? null,
					example_translation_ko: firstExample?.translation_ko ?? null,
				};
			}),
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

	const duplicate = await findDuplicateWord(env.song_project_db, parsed.word);
	if (duplicate) {
		return json({ ok: false, error: 'WORD_ALREADY_EXISTS', existingWordId: duplicate.id }, 409);
	}

	if (!(await validateReferences(
		env.song_project_db,
		parsed.jlptLevelId,
		parsed.partOfSpeechIds,
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

	parsed.partOfSpeechIds.forEach((partOfSpeechId, index) => {
		statements.push(env.song_project_db.prepare(`
			INSERT INTO japanese_word_parts_of_speech (word_id, part_of_speech_id, is_primary, created_at)
			VALUES (?1, ?2, ?3, ?4)
		`).bind(wordId, partOfSpeechId, index === 0 ? 1 : 0, now));
	});
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
			partOfSpeechIds: parsed.partOfSpeechIds,
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

	const duplicate = await findDuplicateWord(env.song_project_db, parsed.word, wordId);
	if (duplicate) {
		return json({ ok: false, error: 'WORD_ALREADY_EXISTS', existingWordId: duplicate.id }, 409);
	}

	if (!(await validateReferences(
		env.song_project_db,
		parsed.jlptLevelId,
		parsed.partOfSpeechIds,
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
	parsed.partOfSpeechIds.forEach((partOfSpeechId, index) => {
		statements.push(env.song_project_db.prepare(`
			INSERT INTO japanese_word_parts_of_speech (word_id, part_of_speech_id, is_primary, created_at)
			VALUES (?1, ?2, ?3, ?4)
		`).bind(wordId, partOfSpeechId, index === 0 ? 1 : 0, now));
	});
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
			partOfSpeechIds: parsed.partOfSpeechIds,
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
