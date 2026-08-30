-- 0009_japanese_parts_seed.sql
-- 일본어 학습 모듈에서 반복 입력할 필요가 없는 기본 품사 데이터를 등록한다.

PRAGMA foreign_keys = ON;

-- 대분류
INSERT INTO parts_of_speech (name_ja, name_ko, parent_id, display_order)
SELECT '名詞', '명사', NULL, 10
WHERE NOT EXISTS (SELECT 1 FROM parts_of_speech WHERE parent_id IS NULL AND name_ja = '名詞' AND deleted_at IS NULL);

INSERT INTO parts_of_speech (name_ja, name_ko, parent_id, display_order)
SELECT '動詞', '동사', NULL, 20
WHERE NOT EXISTS (SELECT 1 FROM parts_of_speech WHERE parent_id IS NULL AND name_ja = '動詞' AND deleted_at IS NULL);

INSERT INTO parts_of_speech (name_ja, name_ko, parent_id, display_order)
SELECT '形容詞', '형용사', NULL, 30
WHERE NOT EXISTS (SELECT 1 FROM parts_of_speech WHERE parent_id IS NULL AND name_ja = '形容詞' AND deleted_at IS NULL);

INSERT INTO parts_of_speech (name_ja, name_ko, parent_id, display_order)
SELECT '副詞', '부사', NULL, 40
WHERE NOT EXISTS (SELECT 1 FROM parts_of_speech WHERE parent_id IS NULL AND name_ja = '副詞' AND deleted_at IS NULL);

INSERT INTO parts_of_speech (name_ja, name_ko, parent_id, display_order)
SELECT '連体詞', '연체사', NULL, 50
WHERE NOT EXISTS (SELECT 1 FROM parts_of_speech WHERE parent_id IS NULL AND name_ja = '連体詞' AND deleted_at IS NULL);

INSERT INTO parts_of_speech (name_ja, name_ko, parent_id, display_order)
SELECT '接続詞', '접속사', NULL, 60
WHERE NOT EXISTS (SELECT 1 FROM parts_of_speech WHERE parent_id IS NULL AND name_ja = '接続詞' AND deleted_at IS NULL);

INSERT INTO parts_of_speech (name_ja, name_ko, parent_id, display_order)
SELECT '感動詞', '감동사', NULL, 70
WHERE NOT EXISTS (SELECT 1 FROM parts_of_speech WHERE parent_id IS NULL AND name_ja = '感動詞' AND deleted_at IS NULL);

INSERT INTO parts_of_speech (name_ja, name_ko, parent_id, display_order)
SELECT '助詞', '조사', NULL, 80
WHERE NOT EXISTS (SELECT 1 FROM parts_of_speech WHERE parent_id IS NULL AND name_ja = '助詞' AND deleted_at IS NULL);

INSERT INTO parts_of_speech (name_ja, name_ko, parent_id, display_order)
SELECT '助動詞', '조동사', NULL, 90
WHERE NOT EXISTS (SELECT 1 FROM parts_of_speech WHERE parent_id IS NULL AND name_ja = '助動詞' AND deleted_at IS NULL);

INSERT INTO parts_of_speech (name_ja, name_ko, parent_id, display_order)
SELECT 'その他', '기타', NULL, 100
WHERE NOT EXISTS (SELECT 1 FROM parts_of_speech WHERE parent_id IS NULL AND name_ja = 'その他' AND deleted_at IS NULL);

-- 명사 소분류
INSERT INTO parts_of_speech (name_ja, name_ko, parent_id, display_order)
SELECT '普通名詞', '일반명사', p.id, 11
FROM parts_of_speech AS p
WHERE p.parent_id IS NULL AND p.name_ja = '名詞' AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM parts_of_speech AS c WHERE c.parent_id = p.id AND c.name_ja = '普通名詞' AND c.deleted_at IS NULL)
LIMIT 1;

INSERT INTO parts_of_speech (name_ja, name_ko, parent_id, display_order)
SELECT '固有名詞', '고유명사', p.id, 12
FROM parts_of_speech AS p
WHERE p.parent_id IS NULL AND p.name_ja = '名詞' AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM parts_of_speech AS c WHERE c.parent_id = p.id AND c.name_ja = '固有名詞' AND c.deleted_at IS NULL)
LIMIT 1;

INSERT INTO parts_of_speech (name_ja, name_ko, parent_id, display_order)
SELECT 'サ変名詞', '사변명사', p.id, 13
FROM parts_of_speech AS p
WHERE p.parent_id IS NULL AND p.name_ja = '名詞' AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM parts_of_speech AS c WHERE c.parent_id = p.id AND c.name_ja = 'サ変名詞' AND c.deleted_at IS NULL)
LIMIT 1;

-- 동사 소분류
INSERT INTO parts_of_speech (name_ja, name_ko, parent_id, display_order)
SELECT '五段動詞', '5단동사', p.id, 21
FROM parts_of_speech AS p
WHERE p.parent_id IS NULL AND p.name_ja = '動詞' AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM parts_of_speech AS c WHERE c.parent_id = p.id AND c.name_ja = '五段動詞' AND c.deleted_at IS NULL)
LIMIT 1;

INSERT INTO parts_of_speech (name_ja, name_ko, parent_id, display_order)
SELECT '一段動詞', '1단동사', p.id, 22
FROM parts_of_speech AS p
WHERE p.parent_id IS NULL AND p.name_ja = '動詞' AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM parts_of_speech AS c WHERE c.parent_id = p.id AND c.name_ja = '一段動詞' AND c.deleted_at IS NULL)
LIMIT 1;

INSERT INTO parts_of_speech (name_ja, name_ko, parent_id, display_order)
SELECT 'サ変動詞', '사변동사', p.id, 23
FROM parts_of_speech AS p
WHERE p.parent_id IS NULL AND p.name_ja = '動詞' AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM parts_of_speech AS c WHERE c.parent_id = p.id AND c.name_ja = 'サ変動詞' AND c.deleted_at IS NULL)
LIMIT 1;

INSERT INTO parts_of_speech (name_ja, name_ko, parent_id, display_order)
SELECT 'カ変動詞', '카변동사', p.id, 24
FROM parts_of_speech AS p
WHERE p.parent_id IS NULL AND p.name_ja = '動詞' AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM parts_of_speech AS c WHERE c.parent_id = p.id AND c.name_ja = 'カ変動詞' AND c.deleted_at IS NULL)
LIMIT 1;

-- 형용사 소분류
INSERT INTO parts_of_speech (name_ja, name_ko, parent_id, display_order)
SELECT 'い形容詞', 'い형용사', p.id, 31
FROM parts_of_speech AS p
WHERE p.parent_id IS NULL AND p.name_ja = '形容詞' AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM parts_of_speech AS c WHERE c.parent_id = p.id AND c.name_ja = 'い形容詞' AND c.deleted_at IS NULL)
LIMIT 1;

INSERT INTO parts_of_speech (name_ja, name_ko, parent_id, display_order)
SELECT 'な形容詞', 'な형용사', p.id, 32
FROM parts_of_speech AS p
WHERE p.parent_id IS NULL AND p.name_ja = '形容詞' AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM parts_of_speech AS c WHERE c.parent_id = p.id AND c.name_ja = 'な形容詞' AND c.deleted_at IS NULL)
LIMIT 1;
