-- 0039_jlpt_practice_attempts_preview.sql
-- JLPT 문제 제출 기록 / 관리자별 오답노트 / 30일 예습 단어 배정

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS japanese_jlpt_question_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    study_date TEXT NOT NULL,
    question_key TEXT NOT NULL,
    question_type TEXT NOT NULL
        CHECK (question_type IN ('vocab', 'grammar', 'reading')),
    prompt TEXT NOT NULL,
    selected_answer TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
    attempted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES japanese_jlpt_study_plans(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_japanese_jlpt_attempts_admin_date
    ON japanese_jlpt_question_attempts(admin_id, study_date DESC, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_japanese_jlpt_attempts_admin_result
    ON japanese_jlpt_question_attempts(admin_id, is_correct, attempted_at DESC);

CREATE TABLE IF NOT EXISTS japanese_jlpt_wrong_notes (
    admin_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    question_key TEXT NOT NULL,
    question_type TEXT NOT NULL
        CHECK (question_type IN ('vocab', 'grammar', 'reading')),
    study_date TEXT NOT NULL,
    prompt TEXT NOT NULL,
    options_json TEXT,
    selected_answer TEXT,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    wrong_count INTEGER NOT NULL DEFAULT 1 CHECK (wrong_count > 0),
    last_wrong_at TEXT NOT NULL,
    resolved_at TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (admin_id, plan_id, question_key),
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES japanese_jlpt_study_plans(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_japanese_jlpt_wrong_notes_open
    ON japanese_jlpt_wrong_notes(admin_id, resolved_at, last_wrong_at DESC);

-- Day 1 뒤 30일(2026-09-01 ~ 2026-09-30)에 기존 N1 미배정 단어를 하루 최대 20개씩 미리 배정한다.
-- 로컬/실DB에 남아 있는 N1 단어 수만큼만 배정되며, 이미 커리큘럼에 포함된 단어는 건드리지 않는다.
WITH candidate_words AS (
    SELECT
        p.id AS plan_id,
        w.id AS word_id,
        ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY w.id ASC) AS rn,
        COALESCE((
            SELECT MAX(c2.sort_order)
            FROM japanese_jlpt_curriculum_words c2
            WHERE c2.plan_id = p.id
        ), 0) AS base_order
    FROM japanese_jlpt_study_plans p
    JOIN jlpt_levels l ON l.code = p.jlpt_level_code
    JOIN japanese_words w ON w.jlpt_level_id = l.id AND w.deleted_at IS NULL
    WHERE p.plan_code = 'N1_2027_JUL'
      AND p.is_active = 1
      AND NOT EXISTS (
          SELECT 1
          FROM japanese_jlpt_curriculum_words c
          WHERE c.plan_id = p.id AND c.word_id = w.id
      )
), limited AS (
    SELECT plan_id, word_id, rn, base_order
    FROM candidate_words
    WHERE rn <= 600
)
INSERT OR IGNORE INTO japanese_jlpt_curriculum_words (plan_id, word_id, sort_order, introduced_on)
SELECT
    plan_id,
    word_id,
    base_order + rn,
    date('2026-09-01', '+' || CAST((rn - 1) / 20 AS INTEGER) || ' day')
FROM limited;
