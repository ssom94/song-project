import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = path.join(root, 'data/jlpt/production/batches/2026-10-01--2026-10-14.content-draft.json');
const output = path.join(root, 'migrations/0108_jlpt_n1_batch1_parts_of_speech.sql');
const data = JSON.parse(fs.readFileSync(source, 'utf8'));

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
};

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const rows = [];
for (const word of data.words) {
	const parts = mapPart[word.part_of_speech];
	if (!parts) throw new Error(`Unmapped part of speech: ${word.part_of_speech} (${word.word})`);
	parts.forEach((part, index) => rows.push(`(${quote(word.word)},${quote(word.reading)},${quote(part)},${index === 0 ? 1 : 0})`));
}

const sql = `-- Generated from the reviewed first N1 batch. Scope: 2026-10-01..2026-10-14 only.
PRAGMA foreign_keys = ON;

CREATE TEMP TABLE _n1_b1_pos_0108 (
  word TEXT NOT NULL,
  reading TEXT NOT NULL,
  part_name_ja TEXT NOT NULL,
  is_primary INTEGER NOT NULL
);

INSERT INTO _n1_b1_pos_0108(word,reading,part_name_ja,is_primary) VALUES
${rows.join(',\n')};

DELETE FROM japanese_word_parts_of_speech
WHERE word_id IN (
  SELECT DISTINCT w.id FROM _n1_b1_pos_0108 s
  JOIN japanese_words w ON w.word=s.word AND w.reading=s.reading AND w.deleted_at IS NULL
);

INSERT INTO japanese_word_parts_of_speech(word_id,part_of_speech_id,is_primary,created_at)
SELECT w.id,p.id,s.is_primary,strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM _n1_b1_pos_0108 AS s
JOIN japanese_words AS w ON w.word=s.word AND w.reading=s.reading AND w.deleted_at IS NULL
JOIN parts_of_speech AS p ON p.name_ja=s.part_name_ja AND p.deleted_at IS NULL;

DROP TABLE _n1_b1_pos_0108;
`;

fs.writeFileSync(output, sql);
console.log(`Wrote ${output} with ${data.words.length} words and ${rows.length} POS links.`);
