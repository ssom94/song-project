import { getAuthenticatedAdminSession } from '../../auth/session';

type ImportRowInput = {
	rowNumber?: unknown;
	word?: unknown;
	reading?: unknown;
	meaningKo?: unknown;
	meaningJa?: unknown;
	jlpt?: unknown;
	partOfSpeech?: unknown;
	category?: unknown;
	exampleJa?: unknown;
	exampleReading?: unknown;
	exampleKo?: unknown;
	note?: unknown;
};

type ImportPayload = {
	rows?: unknown;
};

type TaxonomyRow = {
	id: number;
	name_ja: string;
	name_ko: string;
};

type ExistingWord = {
	id: number;
	reading: string | null;
	meaning_ko: string | null;
	meaning_ja: string | null;
	jlpt_level_id: number | null;
	note: string | null;
};

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

function text(value: unknown, max: number): string {
	if (value === undefined || value === null) return '';
	const normalized = String(value).normalize('NFKC').trim();
	return normalized.length <= max ? normalized : normalized.slice(0, max + 1);
}

function key(value: string): string {
	return value.normalize('NFKC').toLocaleLowerCase().trim();
}

function splitValues(value: string): string[] {
	return value
		.split(/[|\n\r]+/)
		.map((item) => item.trim())
		.filter(Boolean);
}

function mergeLines(existing: string | null, incoming: string, splitter = /[|\n\r]+/): string | null {
	const values: string[] = [];
	const seen = new Set<string>();
	for (const source of [existing ?? '', incoming]) {
		for (const item of source.split(splitter).map((entry) => entry.trim()).filter(Boolean)) {
			const normalized = key(item);
			if (seen.has(normalized)) continue;
			seen.add(normalized);
			values.push(item);
		}
	}
	return values.length ? values.join('\n') : null;
}

function makeLookup(rows: TaxonomyRow[]): Map<string, number[]> {
	const lookup = new Map<string, number[]>();
	for (const row of rows) {
		for (const label of [row.name_ja, row.name_ko]) {
			const normalized = key(label || '');
			if (!normalized) continue;
			const ids = lookup.get(normalized) ?? [];
			if (!ids.includes(row.id)) ids.push(row.id);
			lookup.set(normalized, ids);
		}
	}
	return lookup;
}

function resolveSingle(lookup: Map<string, number[]>, value: string): number | null | 'NOT_FOUND' | 'AMBIGUOUS' {
	if (!value) return null;
	const ids = lookup.get(key(value)) ?? [];
	if (ids.length === 0) return 'NOT_FOUND';
	if (ids.length > 1) return 'AMBIGUOUS';
	return ids[0];
}

async function existingWord(db: D1Database, word: string): Promise<ExistingWord | null> {
	return db.prepare(`
		SELECT id, reading, meaning_ko, meaning_ja, jlpt_level_id, note
		FROM japanese_words
		WHERE word = ?1 COLLATE NOCASE AND deleted_at IS NULL
		ORDER BY id ASC
		LIMIT 1
	`).bind(word).first<ExistingWord>();
}

async function hasPrimaryPart(db: D1Database, wordId: number): Promise<boolean> {
	const row = await db.prepare(`
		SELECT 1 AS found
		FROM japanese_word_parts_of_speech
		WHERE word_id = ?1 AND is_primary = 1
		LIMIT 1
	`).bind(wordId).first<{ found: number }>();
	return Boolean(row);
}

async function hasExample(db: D1Database, wordId: number, sentence: string): Promise<boolean> {
	if (!sentence) return false;
	const row = await db.prepare(`
		SELECT 1 AS found
		FROM japanese_word_examples
		WHERE word_id = ?1 AND sentence_ja = ?2 AND deleted_at IS NULL
		LIMIT 1
	`).bind(wordId, sentence).first<{ found: number }>();
	return Boolean(row);
}

export async function handleImportAdminJapaneseWords(request: Request, env: Env): Promise<Response> {
	if (!isSameOrigin(request)) return json({ ok: false, error: 'INVALID_ORIGIN' }, 403);
	const session = await getAuthenticatedAdminSession(request, env.song_project_db);
	if (!session) return json({ ok: false, error: 'UNAUTHORIZED' }, 401);

	let payload: ImportPayload;
	try {
		payload = await request.json() as ImportPayload;
	} catch {
		return json({ ok: false, error: 'INVALID_JSON' }, 400);
	}
	if (!Array.isArray(payload.rows)) return json({ ok: false, error: 'ROWS_REQUIRED' }, 400);
	if (payload.rows.length === 0) return json({ ok: false, error: 'ROWS_EMPTY' }, 400);
	if (payload.rows.length > 500) return json({ ok: false, error: 'TOO_MANY_ROWS', maxRows: 500 }, 400);

	try {
		const [levelsResult, partsResult, categoriesResult] = await Promise.all([
			env.song_project_db.prepare('SELECT id, code FROM jlpt_levels').all<{ id: number; code: string }>(),
			env.song_project_db.prepare(`
				SELECT id, name_ja, name_ko
				FROM parts_of_speech
				WHERE deleted_at IS NULL
			`).all<TaxonomyRow>(),
			env.song_project_db.prepare(`
				SELECT id, name_ja, name_ko
				FROM japanese_categories
				WHERE deleted_at IS NULL
			`).all<TaxonomyRow>(),
		]);

		const levelMap = new Map(levelsResult.results.map((row) => [row.code.toUpperCase(), row.id]));
		const partLookup = makeLookup(partsResult.results);
		const categoryLookup = makeLookup(categoriesResult.results);
		const results: Array<{ rowNumber: number; status: 'created' | 'merged' | 'failed'; word: string; error?: string }> = [];
		let created = 0;
		let merged = 0;
		let failed = 0;

		for (let index = 0; index < payload.rows.length; index += 1) {
			const row = (payload.rows[index] ?? {}) as ImportRowInput;
			const rowNumberRaw = Number(row.rowNumber);
			const rowNumber = Number.isSafeInteger(rowNumberRaw) && rowNumberRaw > 0 ? rowNumberRaw : index + 2;
			const word = text(row.word, 120);
			const reading = text(row.reading, 160);
			const meaningKo = text(row.meaningKo, 4000);
			const meaningJa = text(row.meaningJa, 1000);
			const jlpt = text(row.jlpt, 8).toUpperCase();
			const partOfSpeech = text(row.partOfSpeech, 1000);
			const category = text(row.category, 240);
			const exampleJa = text(row.exampleJa, 1000);
			const exampleReading = text(row.exampleReading, 1200);
			const exampleKo = text(row.exampleKo, 1200);
			const note = text(row.note, 2000);

			const fail = (error: string) => {
				failed += 1;
				results.push({ rowNumber, status: 'failed', word, error });
			};

			if (!word || !reading || !meaningKo) {
				fail('REQUIRED_FIELD_MISSING');
				continue;
			}
			if (word.length > 120 || reading.length > 160 || meaningKo.length > 4000 || meaningJa.length > 1000 || note.length > 2000) {
				fail('FIELD_TOO_LONG');
				continue;
			}

			const jlptLevelId = jlpt ? levelMap.get(jlpt) ?? null : null;
			if (jlpt && !jlptLevelId) {
				fail('JLPT_NOT_FOUND');
				continue;
			}

			const partIds: number[] = [];
			let partError = '';
			for (const label of splitValues(partOfSpeech)) {
				const resolved = resolveSingle(partLookup, label);
				if (resolved === 'NOT_FOUND') { partError = 'PART_OF_SPEECH_NOT_FOUND'; break; }
				if (resolved === 'AMBIGUOUS') { partError = 'PART_OF_SPEECH_AMBIGUOUS'; break; }
				if (typeof resolved === 'number' && !partIds.includes(resolved)) partIds.push(resolved);
			}
			if (partError) {
				fail(partError);
				continue;
			}

			const categoryId = resolveSingle(categoryLookup, category);
			if (categoryId === 'NOT_FOUND') {
				fail('CATEGORY_NOT_FOUND');
				continue;
			}
			if (categoryId === 'AMBIGUOUS') {
				fail('CATEGORY_AMBIGUOUS');
				continue;
			}

			try {
				const existing = await existingWord(env.song_project_db, word);
				const now = new Date().toISOString();
				let wordId: number;
				let status: 'created' | 'merged';
				const statements: D1PreparedStatement[] = [];

				if (existing) {
					wordId = existing.id;
					status = 'merged';
					const mergedMeaningKo = mergeLines(existing.meaning_ko, meaningKo);
					const mergedMeaningJa = mergeLines(existing.meaning_ja, meaningJa);
					const mergedNote = mergeLines(existing.note, note);
					statements.push(env.song_project_db.prepare(`
						UPDATE japanese_words
						SET reading = COALESCE(NULLIF(reading, ''), ?1),
							meaning_ko = ?2,
							meaning_ja = ?3,
							jlpt_level_id = COALESCE(jlpt_level_id, ?4),
							note = ?5,
							updated_at = ?6
						WHERE id = ?7
					`).bind(reading, mergedMeaningKo, mergedMeaningJa, jlptLevelId, mergedNote, now, wordId));
				} else {
					wordId = makeWordId();
					status = 'created';
					statements.push(env.song_project_db.prepare(`
						INSERT INTO japanese_words
							(id, word, reading, meaning_ko, meaning_ja, jlpt_level_id, note, created_at, updated_at)
						VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
					`).bind(wordId, word, reading, mergeLines(null, meaningKo), meaningJa || null, jlptLevelId, note || null, now));
				}

				const primaryExists = existing ? await hasPrimaryPart(env.song_project_db, wordId) : false;
				partIds.forEach((partId, partIndex) => {
					statements.push(env.song_project_db.prepare(`
						INSERT OR IGNORE INTO japanese_word_parts_of_speech
							(word_id, part_of_speech_id, is_primary, created_at)
						VALUES (?1, ?2, ?3, ?4)
					`).bind(wordId, partId, !primaryExists && partIndex === 0 ? 1 : 0, now));
				});

				if (typeof categoryId === 'number') {
					statements.push(env.song_project_db.prepare(`
						INSERT OR IGNORE INTO japanese_word_categories (word_id, category_id, created_at)
						VALUES (?1, ?2, ?3)
					`).bind(wordId, categoryId, now));
				}

				if (exampleJa && !(await hasExample(env.song_project_db, wordId, exampleJa))) {
					statements.push(env.song_project_db.prepare(`
						INSERT INTO japanese_word_examples
							(word_id, sentence_ja, reading, translation_ko, source_type, created_at, updated_at)
						VALUES (?1, ?2, ?3, ?4, 'manual', ?5, ?5)
					`).bind(wordId, exampleJa, exampleReading || null, exampleKo || null, now));
				}

				await env.song_project_db.batch(statements);
				if (status === 'created') created += 1;
				else merged += 1;
				results.push({ rowNumber, status, word });
			} catch (error) {
				console.error(`Japanese word import row ${rowNumber} failed`, error);
				fail('DATABASE_ERROR');
			}
		}

		return json({
			ok: true,
			total: payload.rows.length,
			created,
			merged,
			failed,
			results,
		});
	} catch (error) {
		console.error('Failed to import Japanese words', error);
		return json({ ok: false, error: 'JAPANESE_WORD_IMPORT_FAILED' }, 500);
	}
}
