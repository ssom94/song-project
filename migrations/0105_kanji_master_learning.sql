-- 0105_kanji_master_learning.sql
-- 기초 한자 학습을 JLPT 단어 테이블과 분리된 마스터 구조로 이전한다.

CREATE TABLE IF NOT EXISTS kanji_master (
    kanji TEXT PRIMARY KEY,
    meaning_ko TEXT NOT NULL,
    sound_ko TEXT NOT NULL,
    meaning_ja TEXT,
    onyomi TEXT,
    kunyomi TEXT,
    variant_forms TEXT,
    components TEXT,
    composition_note_ko TEXT,
    memory_tip TEXT,
    related_words TEXT,
    foundation_order INTEGER NOT NULL,
    foundation_group TEXT,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_kanji_master_learning_order
ON kanji_master(active, foundation_order);

CREATE TABLE IF NOT EXISTS japanese_admin_kanji_states (
    admin_id INTEGER NOT NULL,
    kanji TEXT NOT NULL,
    learning_state TEXT NOT NULL DEFAULT 'unlearned'
        CHECK (learning_state IN ('unlearned', 'unsure', 'mastered')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (admin_id, kanji),
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
    FOREIGN KEY (kanji) REFERENCES kanji_master(kanji) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_kanji_states_order
ON japanese_admin_kanji_states(admin_id, learning_state, updated_at);

INSERT INTO kanji_master
(kanji,meaning_ko,sound_ko,meaning_ja,onyomi,kunyomi,variant_forms,components,
 composition_note_ko,memory_tip,related_words,foundation_order,foundation_group)
SELECT kanji,meaning_ko,sound_ko,meaning_ja,onyomi,kunyomi,COALESCE(component_forms,kanji),kanji,
       COALESCE(formation_note_ko,note),COALESCE(formation_note_ko,note),
       COALESCE(example_words,note),COALESCE(foundation_order,1000+unicode(kanji)),
       COALESCE(foundation_group,'JLPT 연결')
FROM japanese_kanji_korean_readings
WHERE 1=1
ON CONFLICT(kanji) DO UPDATE SET
meaning_ko=excluded.meaning_ko,sound_ko=excluded.sound_ko,meaning_ja=excluded.meaning_ja,
onyomi=excluded.onyomi,kunyomi=excluded.kunyomi,variant_forms=excluded.variant_forms,
components=excluded.components,composition_note_ko=excluded.composition_note_ko,
memory_tip=excluded.memory_tip,related_words=excluded.related_words,
foundation_order=excluded.foundation_order,foundation_group=excluded.foundation_group,
active=1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now');

-- 첫 조합 학습 예시. 아래 순번부터 JLPT 단어에 필요한 한자를 계속 확장한다.
INSERT INTO kanji_master
(kanji,meaning_ko,sound_ko,meaning_ja,onyomi,kunyomi,variant_forms,components,
 composition_note_ko,memory_tip,related_words,foundation_order,foundation_group)
VALUES
('学','배울','학','学ぶ・学問','ガク','まなぶ','学','⺍|冖|子',
 '아이를 나타내는 子 위에 덮개인 冖와 윗부분이 놓여, 지식이 전해지는 배움의 공간을 연상한다.',
 '子(아이)가 冖(지붕) 아래에서 가르침을 받는 장면으로 기억한다. 실제 자원 설명이라기보다 모양을 오래 기억하기 위한 연상법이다.',
 '学校(がっこう)|学生(がくせい)|学習(がくしゅう)',65,'배움·지식')
ON CONFLICT(kanji) DO UPDATE SET
meaning_ko=excluded.meaning_ko,sound_ko=excluded.sound_ko,meaning_ja=excluded.meaning_ja,
onyomi=excluded.onyomi,kunyomi=excluded.kunyomi,variant_forms=excluded.variant_forms,
components=excluded.components,composition_note_ko=excluded.composition_note_ko,
memory_tip=excluded.memory_tip,related_words=excluded.related_words,
foundation_order=excluded.foundation_order,foundation_group=excluded.foundation_group,
active=1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now');

-- 기존 두 상태 기록을 새 3상태 구조로 안전하게 이관한다.
INSERT INTO japanese_admin_kanji_states(admin_id,kanji,learning_state,updated_at)
SELECT old.admin_id,old.kanji,
       CASE WHEN old.learning_state='mastered' THEN 'mastered' ELSE 'unlearned' END,
       old.updated_at
FROM japanese_admin_basic_kanji_states old
JOIN kanji_master master ON master.kanji=old.kanji
ON CONFLICT(admin_id,kanji) DO UPDATE SET
learning_state=excluded.learning_state,updated_at=excluded.updated_at;
