import { ensureJapaneseAdminLearningStatsSchema, resolveLearningAdmin } from '../../japanese-learning';

interface QuizPoolRow {
	id: number;
	word: string;
	reading: string | null;
	meaning_ko: string | null;
	meaning_ja: string | null;
	jlpt_code: string | null;
	example_sentence: string | null;
	example_reading: string | null;
	example_translation_ko: string | null;
	learning_state: 'mastered' | 'uncertain' | 'unlearned' | null;
	wrong_count: number | null;
}

interface AvailabilityRow {
	matched_words: number;
	reading_questions: number;
	meaning_questions: number;
	sentence_questions: number;
	distinct_meanings: number;
	distinct_words: number;
}

type BindValue = string | number | null;

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function intParam(url: URL, key: string): number {
	const value = Number(url.searchParams.get(key));
	return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function parseJlptFilters(url: URL): string[] | null {
	const values = url.searchParams
		.getAll('jlpt')
		.flatMap((value) => value.split(','))
		.map((value) => value.trim().toUpperCase())
		.filter(Boolean);
	const unique = [...new Set(values)];
	if (unique.some((value) => !['N1', 'N2', 'N3', 'N4', 'N5', 'UNSET'].includes(value))) return null;
	return unique;
}

function parseWordFilters(url: URL): string[] {
	return [...new Set(url.searchParams
		.getAll('word')
		.map((value) => value.normalize('NFKC').trim())
		.filter(Boolean))]
		.slice(0, 60);
}

function buildBaseFilters(
	jlpts: string[],
	categoryId: number,
	categoryParentId: number,
	partId: number,
	partParentId: number,
	wordFilters: string[],
): { sql: string; params: BindValue[] } {
	const clauses = ['jw.deleted_at IS NULL'];
	const params: BindValue[] = [];

	if (jlpts.length) {
		const codes = jlpts.filter((value) => value !== 'UNSET');
		const includesUnset = jlpts.includes('UNSET');
		const levelClauses: string[] = [];
		if (codes.length) {
			levelClauses.push(`jl.code IN (${codes.map(() => '?').join(', ')})`);
			params.push(...codes);
		}
		if (includesUnset) levelClauses.push('jw.jlpt_level_id IS NULL');
		clauses.push(`(${levelClauses.join(' OR ')})`);
	}

	if (wordFilters.length) {
		clauses.push(`jw.word IN (${wordFilters.map(() => '?').join(', ')})`);
		params.push(...wordFilters);
	}

	if (categoryId) {
		clauses.push(`EXISTS (
			SELECT 1 FROM japanese_word_categories AS wc
			WHERE wc.word_id = jw.id AND wc.category_id = ?
		)`);
		params.push(categoryId);
	}
	if (categoryParentId) {
		clauses.push(`EXISTS (
			SELECT 1 FROM japanese_word_categories AS wc
			INNER JOIN japanese_categories AS c ON c.id = wc.category_id AND c.deleted_at IS NULL
			WHERE wc.word_id = jw.id AND (c.id = ? OR c.parent_id = ?)
		)`);
		params.push(categoryParentId, categoryParentId);
	}
	if (partId) {
		clauses.push(`EXISTS (
			SELECT 1 FROM japanese_word_parts_of_speech AS wp
			WHERE wp.word_id = jw.id AND wp.part_of_speech_id = ?
		)`);
		params.push(partId);
	}
	if (partParentId) {
		clauses.push(`EXISTS (
			SELECT 1 FROM japanese_word_parts_of_speech AS wp
			INNER JOIN parts_of_speech AS p ON p.id = wp.part_of_speech_id AND p.deleted_at IS NULL
			WHERE wp.word_id = jw.id AND (p.id = ? OR p.parent_id = ?)
		)`);
		params.push(partParentId, partParentId);
	}

	return { sql: clauses.join('\n\t\t\tAND '), params };
}

export async function handleGetPublicJapaneseQuizPool(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const types = (url.searchParams.get('types') ?? 'reading,meaning,sentence')
		.split(',')
		.filter((value) => ['reading', 'meaning', 'sentence'].includes(value));
	if (!types.length) return json({ ok: false, error: 'QUESTION_TYPE_REQUIRED' }, 400);

	const countRaw = Number(url.searchParams.get('count') ?? '10');
	const count = Number.isSafeInteger(countRaw) ? Math.min(200, Math.max(1, countRaw)) : 10;
	const preview = url.searchParams.get('preview') === '1';
	const candidateLimit = preview ? 5000 : Math.min(500, Math.max(30, count * 8));
	const jlpts = parseJlptFilters(url);
	if (jlpts === null) return json({ ok: false, error: 'INVALID_JLPT' }, 400);
	const wordFilters = parseWordFilters(url);
	const categoryId = intParam(url, 'category');
	const categoryParentId = intParam(url, 'categoryParent');
	const partId = intParam(url, 'part');
	const partParentId = intParam(url, 'partParent');
	const focusWordId = intParam(url, 'focusWordId');
	const wantsReading = types.includes('reading');
	const wantsMeaning = types.includes('meaning');
	const wantsSentence = types.includes('sentence');
	const base = buildBaseFilters(jlpts, categoryId, categoryParentId, partId, partParentId, wordFilters);

	try {
		await ensureJapaneseAdminLearningStatsSchema(env.song_project_db);
		const learningAdmin = await resolveLearningAdmin(request, env.song_project_db);
		const adminId = learningAdmin.adminId ?? 0;

		const availability = await env.song_project_db.prepare(`
			SELECT
				COUNT(*) AS matched_words,
				SUM(CASE WHEN COALESCE(jw.reading, '') <> '' THEN 1 ELSE 0 END) AS reading_questions,
				SUM(CASE WHEN COALESCE(jw.meaning_ko, '') <> '' THEN 1 ELSE 0 END) AS meaning_questions,
				SUM(CASE WHEN EXISTS (
					SELECT 1 FROM japanese_word_examples AS e
					WHERE e.word_id = jw.id AND e.deleted_at IS NULL AND e.sentence_ja LIKE '%' || jw.word || '%'
				) THEN 1 ELSE 0 END) AS sentence_questions,
				COUNT(DISTINCT CASE WHEN COALESCE(jw.meaning_ko, '') <> '' THEN jw.meaning_ko END) AS distinct_meanings,
				COUNT(DISTINCT jw.word) AS distinct_words
			FROM japanese_words AS jw
			LEFT JOIN jlpt_levels AS jl ON jl.id = jw.jlpt_level_id
			WHERE ${base.sql}
		`).bind(...base.params).first<AvailabilityRow>();

		const typeClauses: string[] = [];
		if (wantsReading) typeClauses.push(`COALESCE(jw.reading, '') <> ''`);
		if (wantsMeaning) typeClauses.push(`COALESCE(jw.meaning_ko, '') <> ''`);
		if (wantsSentence) typeClauses.push(`EXISTS (
			SELECT 1 FROM japanese_word_examples AS e
			WHERE e.word_id = jw.id AND e.deleted_at IS NULL AND e.sentence_ja LIKE '%' || jw.word || '%'
		)`);

		const params: BindValue[] = [adminId, ...base.params];
		let orderSql = 'RANDOM()';
		if (focusWordId) {
			orderSql = 'CASE WHEN jw.id = ? THEN 0 ELSE 1 END, RANDOM()';
			params.push(focusWordId);
		}
		params.push(candidateLimit);

		const result = await env.song_project_db.prepare(`
			SELECT
				jw.id, jw.word, jw.reading, jw.meaning_ko, jw.meaning_ja,
				jl.code AS jlpt_code,
				(
					SELECT e.sentence_ja FROM japanese_word_examples AS e
					WHERE e.word_id = jw.id AND e.deleted_at IS NULL AND e.sentence_ja LIKE '%' || jw.word || '%'
					ORDER BY e.id ASC LIMIT 1
				) AS example_sentence,
				(
					SELECT e.reading FROM japanese_word_examples AS e
					WHERE e.word_id = jw.id AND e.deleted_at IS NULL AND e.sentence_ja LIKE '%' || jw.word || '%'
					ORDER BY e.id ASC LIMIT 1
				) AS example_reading,
				(
					SELECT e.translation_ko FROM japanese_word_examples AS e
					WHERE e.word_id = jw.id AND e.deleted_at IS NULL AND e.sentence_ja LIKE '%' || jw.word || '%'
					ORDER BY e.id ASC LIMIT 1
				) AS example_translation_ko,
				ls.learning_state,
				ls.wrong_count
			FROM japanese_words AS jw
			LEFT JOIN jlpt_levels AS jl ON jl.id = jw.jlpt_level_id
			LEFT JOIN japanese_admin_word_learning_stats AS ls
				ON ls.word_id = jw.id AND ls.admin_id = ?
			WHERE ${base.sql}
				AND (${typeClauses.join(' OR ')})
			ORDER BY ${orderSql}
			LIMIT ?
		`).bind(...params).all<QuizPoolRow>();

		const matchedWords = Number(availability?.matched_words ?? 0);
		const readingQuestions = Number(availability?.reading_questions ?? 0);
		const meaningQuestions = Number(availability?.meaning_questions ?? 0);
		const sentenceQuestions = Number(availability?.sentence_questions ?? 0);
		const meaningChoiceQuestions = Number(availability?.distinct_meanings ?? 0) >= 4 ? meaningQuestions : 0;
		const sentenceChoiceQuestions = Number(availability?.distinct_words ?? 0) >= 4 ? sentenceQuestions : 0;

		return json({
			ok: true,
			count,
			filters: {
				jlpts,
				wordFilters,
				categoryId: categoryId || null,
				categoryParentId: categoryParentId || null,
				partId: partId || null,
				partParentId: partParentId || null,
				focusWordId: focusWordId || null,
			},
			availability: {
				matchedWords,
				readingInput: readingQuestions,
				meaningInput: meaningQuestions,
				meaningChoice: meaningChoiceQuestions,
				sentenceChoice: sentenceChoiceQuestions,
			},
			words: result.results.map((row) => ({
				id: row.id,
				word: row.word,
				reading: row.reading,
				meaningKo: row.meaning_ko,
				meaningJa: row.meaning_ja,
				jlpt: row.jlpt_code,
				learningState: row.learning_state ?? 'unlearned',
				wrongCount: Number(row.wrong_count ?? 0),
				example: row.example_sentence ? {
					sentence: row.example_sentence,
					reading: row.example_reading,
					translationKo: row.example_translation_ko,
				} : null,
			})),
		});
	} catch (error) {
		console.error('Failed to build Japanese quiz pool', error);
		return json({ ok: false, error: 'QUIZ_POOL_FAILED' }, 500);
	}
}
