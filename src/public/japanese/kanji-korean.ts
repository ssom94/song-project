type KanjiReadingRow = {
	kanji: string;
	meaning_ko: string;
	sound_ko: string;
};

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isCjk(character: string): boolean {
	const value = character.codePointAt(0) ?? 0;
	return (value >= 0x3400 && value <= 0x4dbf)
		|| (value >= 0x4e00 && value <= 0x9fff)
		|| (value >= 0xf900 && value <= 0xfaff);
}

export async function handleGetPublicJapaneseKanjiKorean(request: Request, env: Env): Promise<Response> {
	try {
		const url = new URL(request.url);
		const words = url.searchParams.getAll('word')
			.map((value) => value.normalize('NFKC').trim())
			.filter(Boolean)
			.slice(0, 60);
		if (!words.length) return json({ ok: true, words: [] });

		const characters = [...new Set(words.flatMap((word) => Array.from(word).filter(isCjk)))].slice(0, 200);
		if (!characters.length) return json({ ok: true, words: words.map((word) => ({ word, kanji: [] })) });

		const placeholders = characters.map((_, index) => `?${index + 1}`).join(', ');
		const result = await env.song_project_db.prepare(`
			SELECT kanji, meaning_ko, sound_ko
			FROM japanese_kanji_korean_readings
			WHERE kanji IN (${placeholders})
		`).bind(...characters).all<KanjiReadingRow>();
		const dictionary = new Map(result.results.map((row) => [row.kanji, row]));

		return json({
			ok: true,
			words: words.map((word) => ({
				word,
				kanji: Array.from(word)
					.filter(isCjk)
					.map((character) => dictionary.get(character))
					.filter((entry): entry is KanjiReadingRow => Boolean(entry))
					.map((entry) => ({ character: entry.kanji, meaningKo: entry.meaning_ko, soundKo: entry.sound_ko })),
			})),
		});
	} catch (error) {
		console.error('Failed to load Korean kanji readings', error);
		return json({ ok: false, error: 'KANJI_KOREAN_READINGS_FAILED' }, 500);
	}
}
