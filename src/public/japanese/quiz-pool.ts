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

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function intParam(url: URL, key: string): number {
	const value = Number(url.searchParams.get(key));
	return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

export async function handleGetPublicJapaneseQuizPool(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const types = (url.searchParams.get('types') ?? 'reading,meaning,sentence')
		.split(',')
		.filter((value) => ['reading', 'meaning', 'sentence'].includes(value));
	if (!types.length) return json({ ok: false, error: 'QUESTION_TYPE_REQUIRED' }, 400);

	const countRaw = Number(url.searchParams.get('count') ?? '10');
	const count = Number.isSafeInteger(countRaw) ? Math.min(200, Math.max(1, countRaw)) : 10;
	const candidateLimit = Math.min(500, Math.max(30, count * 8));
	const jlpt = (url.searchParams.get('jlpt') ?? '').trim().toUpperCase();
	if (jlpt && !['N1', 'N2', 'N3', 'N4', 'N5'].includes(jlpt)) return json({ ok: false, error: 'INVALID_JLPT' }, 400);
	const categoryId = intParam(url, 'category');
	const categoryParentId = intParam(url, 'categoryParent');
	const partId = intParam(url, 'part');
	const partParentId = intParam(url, 'partParent');
	const wantsReading = types.includes('reading') ? 1 : 0;
	const wantsMeaning = types.includes('meaning') ? 1 : 0;
	const wantsSentence = types.includes('sentence') ? 1 : 0;

	try {
		await ensureJapaneseAdminLearningStatsSchema(env.song_project_db);
		const learningAdmin = await resolveLearningAdmin(request, env.song_project_db);
		const adminId = learningAdmin.adminId ?? 0;
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
				ON ls.word_id = jw.id AND ls.admin_id = ?9
			WHERE jw.deleted_at IS NULL
				AND (?1 = '' OR jl.code = ?1)
				AND (?2 = 0 OR EXISTS (
					SELECT 1 FROM japanese_word_categories AS wc WHERE wc.word_id = jw.id AND wc.category_id = ?2
				))
				AND (?3 = 0 OR EXISTS (
					SELECT 1 FROM japanese_word_categories AS wc
					INNER JOIN japanese_categories AS c ON c.id = wc.category_id AND c.deleted_at IS NULL
					WHERE wc.word_id = jw.id AND (c.id = ?3 OR c.parent_id = ?3)
				))
				AND (?4 = 0 OR EXISTS (
					SELECT 1 FROM japanese_word_parts_of_speech AS wp WHERE wp.word_id = jw.id AND wp.part_of_speech_id = ?4
				))
				AND (?5 = 0 OR EXISTS (
					SELECT 1 FROM japanese_word_parts_of_speech AS wp
					INNER JOIN parts_of_speech AS p ON p.id = wp.part_of_speech_id AND p.deleted_at IS NULL
					WHERE wp.word_id = jw.id AND (p.id = ?5 OR p.parent_id = ?5)
				))
				AND (
					(?6 = 1 AND COALESCE(jw.reading, '') <> '')
					OR (?7 = 1 AND COALESCE(jw.meaning_ko, '') <> '')
					OR (?8 = 1 AND EXISTS (
						SELECT 1 FROM japanese_word_examples AS e
						WHERE e.word_id = jw.id AND e.deleted_at IS NULL AND e.sentence_ja LIKE '%' || jw.word || '%'
					))
				)
			ORDER BY RANDOM()
			LIMIT ?10
		`).bind(
			jlpt, categoryId, categoryParentId, partId, partParentId,
			wantsReading, wantsMeaning, wantsSentence, adminId, candidateLimit,
		).all<QuizPoolRow>();

		return json({
			ok: true,
			count,
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
