interface WordRow {
	id: number;
	word: string;
	reading: string | null;
	meaning_ko: string | null;
	meaning_ja: string | null;
	jlpt_code: string | null;
	part_id: number | null;
	part_name_ja: string | null;
	part_name_ko: string | null;
	parts_blob: string | null;
	category_names_ja: string | null;
	category_names_ko: string | null;
	example_sentence: string | null;
	example_reading: string | null;
	example_translation_ko: string | null;
}

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function integerParam(url: URL, key: string): number {
	const raw = url.searchParams.get(key);
	if (!raw) return 0;
	const value = Number(raw);
	return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

export async function handleListPublicJapaneseWords(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
	const jlpt = (url.searchParams.get('jlpt') ?? '').trim().toUpperCase();
	const categoryId = integerParam(url, 'category');
	const categoryParentId = integerParam(url, 'categoryParent');
	const partId = integerParam(url, 'part');
	const partParentId = integerParam(url, 'partParent');
	const requestedLimit = Number(url.searchParams.get('limit') ?? '100');
	const limit = Number.isSafeInteger(requestedLimit) ? Math.min(500, Math.max(1, requestedLimit)) : 100;

	if (jlpt && !['N1', 'N2', 'N3', 'N4', 'N5'].includes(jlpt)) {
		return json({ ok: false, error: 'INVALID_JLPT' }, 400);
	}

	try {
		const result = await env.song_project_db
			.prepare(`
				SELECT
					jw.id,
					jw.word,
					jw.reading,
					jw.meaning_ko,
					jw.meaning_ja,
					jl.code AS jlpt_code,
					pos.id AS part_id,
					pos.name_ja AS part_name_ja,
					pos.name_ko AS part_name_ko,
					(
						SELECT GROUP_CONCAT(part_value, CHAR(31))
						FROM (
							SELECT
								p.id || CHAR(30) || p.name_ja || CHAR(30) || COALESCE(p.name_ko, '') AS part_value
							FROM japanese_word_parts_of_speech AS wp
							INNER JOIN parts_of_speech AS p
								ON p.id = wp.part_of_speech_id AND p.deleted_at IS NULL
							WHERE wp.word_id = jw.id
							ORDER BY wp.is_primary DESC, p.display_order ASC, p.id ASC
						)
					) AS parts_blob,
					(
						SELECT GROUP_CONCAT(jc.name_ja, CHAR(31))
						FROM japanese_word_categories AS jwc
						INNER JOIN japanese_categories AS jc ON jc.id = jwc.category_id AND jc.deleted_at IS NULL
						WHERE jwc.word_id = jw.id
					) AS category_names_ja,
					(
						SELECT GROUP_CONCAT(jc.name_ko, CHAR(31))
						FROM japanese_word_categories AS jwc
						INNER JOIN japanese_categories AS jc ON jc.id = jwc.category_id AND jc.deleted_at IS NULL
						WHERE jwc.word_id = jw.id
					) AS category_names_ko,
					(
						SELECT e.sentence_ja FROM japanese_word_examples AS e
						WHERE e.word_id = jw.id AND e.deleted_at IS NULL ORDER BY e.id ASC LIMIT 1
					) AS example_sentence,
					(
						SELECT e.reading FROM japanese_word_examples AS e
						WHERE e.word_id = jw.id AND e.deleted_at IS NULL ORDER BY e.id ASC LIMIT 1
					) AS example_reading,
					(
						SELECT e.translation_ko FROM japanese_word_examples AS e
						WHERE e.word_id = jw.id AND e.deleted_at IS NULL ORDER BY e.id ASC LIMIT 1
					) AS example_translation_ko
				FROM japanese_words AS jw
				LEFT JOIN jlpt_levels AS jl ON jl.id = jw.jlpt_level_id
				LEFT JOIN japanese_word_parts_of_speech AS jwpos ON jwpos.word_id = jw.id AND jwpos.is_primary = 1
				LEFT JOIN parts_of_speech AS pos ON pos.id = jwpos.part_of_speech_id AND pos.deleted_at IS NULL
				WHERE jw.deleted_at IS NULL
					AND (?1 = '' OR jw.word LIKE '%' || ?1 || '%' OR COALESCE(jw.reading, '') LIKE '%' || ?1 || '%' OR COALESCE(jw.meaning_ko, '') LIKE '%' || ?1 || '%' OR COALESCE(jw.meaning_ja, '') LIKE '%' || ?1 || '%')
					AND (?2 = '' OR jl.code = ?2)
					AND (?3 = 0 OR EXISTS (
						SELECT 1 FROM japanese_word_categories AS fwc
						WHERE fwc.word_id = jw.id AND fwc.category_id = ?3
					))
					AND (?4 = 0 OR EXISTS (
						SELECT 1
						FROM japanese_word_categories AS fwc
						INNER JOIN japanese_categories AS fc ON fc.id = fwc.category_id AND fc.deleted_at IS NULL
						WHERE fwc.word_id = jw.id AND (fc.id = ?4 OR fc.parent_id = ?4)
					))
					AND (?5 = 0 OR EXISTS (
						SELECT 1 FROM japanese_word_parts_of_speech AS fwp
						WHERE fwp.word_id = jw.id AND fwp.part_of_speech_id = ?5
					))
					AND (?6 = 0 OR EXISTS (
						SELECT 1
						FROM japanese_word_parts_of_speech AS fwp
						INNER JOIN parts_of_speech AS fp ON fp.id = fwp.part_of_speech_id AND fp.deleted_at IS NULL
						WHERE fwp.word_id = jw.id AND (fp.id = ?6 OR fp.parent_id = ?6)
					))
				ORDER BY COALESCE(jl.display_order, 99) ASC, jw.id DESC
				LIMIT ?7
			`)
			.bind(q, jlpt, categoryId, categoryParentId, partId, partParentId, limit)
			.all<WordRow>();

		const separator = String.fromCharCode(31);
		const partSeparator = String.fromCharCode(30);
		return json({
			ok: true,
			filters: {
				q,
				jlpt: jlpt || null,
				categoryId: categoryId || null,
				categoryParentId: categoryParentId || null,
				partId: partId || null,
				partParentId: partParentId || null,
				limit,
			},
			words: result.results.map((row) => ({
				id: row.id,
				word: row.word,
				reading: row.reading,
				meaningKo: row.meaning_ko,
				meaningJa: row.meaning_ja,
				jlpt: row.jlpt_code,
				part: row.part_id ? { id: row.part_id, nameJa: row.part_name_ja, nameKo: row.part_name_ko } : null,
				parts: row.parts_blob
					? row.parts_blob.split(separator).map((item) => {
						const [id, nameJa, nameKo] = item.split(partSeparator);
						return { id: Number(id), nameJa: nameJa || '', nameKo: nameKo || '' };
					}).filter((item) => Number.isSafeInteger(item.id) && item.id > 0)
					: [],
				categoriesJa: row.category_names_ja ? row.category_names_ja.split(separator).filter(Boolean) : [],
				categoriesKo: row.category_names_ko ? row.category_names_ko.split(separator).filter(Boolean) : [],
				example: row.example_sentence ? { sentence: row.example_sentence, reading: row.example_reading, translationKo: row.example_translation_ko } : null,
			})),
		});
	} catch (error) {
		console.error('Failed to list public Japanese words', error);
		return json({ ok: false, error: 'PUBLIC_JAPANESE_WORDS_FAILED' }, 500);
	}
}
