import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const batches = [
	['2026-10-01--2026-10-14', '0108_jlpt_n1_batch1_parts_of_speech.sql'],
	['2026-10-15--2026-10-28', '0109_jlpt_n1_batch2_parts_of_speech.sql'],
	['2026-10-29--2026-11-11', '0110_jlpt_n1_batch3_parts_of_speech.sql'],
	['2026-11-12--2026-11-25', '0111_jlpt_n1_batch4_parts_of_speech.sql'],
	['2026-11-26--2026-12-09', '0112_jlpt_n1_batch5_parts_of_speech.sql'],
];

const mapPart = {
	'サ変名詞': ['サ変名詞', 'サ変動詞'],
	'サ変動詞': ['サ変動詞'],
	'五段動詞': ['五段動詞'],
	'一段動詞': ['一段動詞'],
	'普通名詞': ['普通名詞'],
	'副詞': ['副詞'],
	'い形容詞': ['い形容詞'],
	'な形容詞': ['な形容詞'],
	'その他': ['その他'],
	'名詞・な形容詞': ['普通名詞', 'な形容詞'],
	'普通名詞・副詞': ['普通名詞', '副詞'],
	'普通名詞・な形容詞': ['普通名詞', 'な形容詞'],
	'な形容詞・普通名詞': ['な形容詞', '普通名詞'],
	'な形容詞・副詞': ['な形容詞', '副詞'],
	'副詞・な形容詞': ['副詞', 'な形容詞'],
	'副詞・普通名詞': ['副詞', '普通名詞'],
	'名詞・副詞': ['普通名詞', '副詞'],
	'副詞・サ変名詞': ['副詞', 'サ変名詞', 'サ変動詞'],
	'接続詞': ['接続詞'],
	'接続表現': ['接続詞'],
	'接続詞・副詞': ['接続詞', '副詞'],
	'副詞・接続詞': ['副詞', '接続詞'],
	'感動詞・書簡語': ['感動詞'],
	'連体詞': ['連体詞'],
};

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

for (const [batchIndex, [range, migrationName]] of batches.entries()) {
	const source = path.join(root, `data/jlpt/production/batches/${range}.content-draft.json`);
	const output = path.join(root, `migrations/${migrationName}`);
	const data = JSON.parse(fs.readFileSync(source, 'utf8'));
	if (data.words?.length !== 280) throw new Error(`${range}: expected 280 words, got ${data.words?.length ?? 0}`);
	const identities = new Set();
	const rows = [];
	const targetWords = [];
	for (const word of data.words) {
		const identity = `${word.word}\u001f${word.reading}`;
		if (identities.has(identity)) throw new Error(`${range}: duplicate word+reading ${identity}`);
		identities.add(identity);
		const parts = mapPart[word.part_of_speech];
		if (!parts) throw new Error(`${range}: unmapped part of speech ${word.part_of_speech} (${word.word})`);
		targetWords.push(`(${quote(word.word)},${quote(word.reading)})`);
		parts.forEach((part, index) => rows.push(`(${quote(word.word)},${quote(word.reading)},${quote(part)},${index === 0 ? 1 : 0})`));
	}

	const sql = `-- Generated from the reviewed ${batchIndex === 0 ? 'first ' : ''}N1 batch. Scope: ${range.replace('--', '..')} only.
PRAGMA foreign_keys = ON;

WITH target_words(word,reading) AS (VALUES
${targetWords.join(',\n')}
)
DELETE FROM japanese_word_parts_of_speech
WHERE word_id IN (
  SELECT DISTINCT w.id FROM target_words s
  JOIN japanese_words w ON w.word=s.word AND w.reading=s.reading AND w.deleted_at IS NULL
);

WITH source(word,reading,part_name_ja,is_primary) AS (VALUES
${rows.join(',\n')}
)
INSERT INTO japanese_word_parts_of_speech(word_id,part_of_speech_id,is_primary,created_at)
SELECT w.id,p.id,s.is_primary,strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM source AS s
JOIN japanese_words AS w ON w.word=s.word AND w.reading=s.reading AND w.deleted_at IS NULL
JOIN parts_of_speech AS p ON p.name_ja=s.part_name_ja AND p.deleted_at IS NULL;
`;

	fs.writeFileSync(output, sql);
	console.log(`Wrote ${migrationName} with ${data.words.length} words and ${rows.length} POS links.`);
}
