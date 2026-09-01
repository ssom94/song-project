-- 2026-09-02 daily study registration
-- Source of truth:
--   data/jlpt/daily_words/2026-09-02.json
--   data/jlpt/daily/2026-09-02.json
--   data/ap/daily/2026-09-02.json
--
-- JLPT N1 is intentionally not inserted today because the configured restart date is 2026-09-07.
-- AP is in the September concept-first prestudy phase, so only a concept item is registered.

PRAGMA foreign_keys = ON;

-- AP prestudy session (idempotent)
INSERT OR IGNORE INTO ap_daily_sessions (
    plan_id,
    study_date,
    target_minutes,
    recommendation_reason_ko,
    recommendation_reason_ja
)
SELECT
    p.id,
    '2026-09-02',
    30,
    '9월은 AP 개념 페이지를 먼저 한 바퀴 도는 사전학습 기간이므로 오늘은 기초이론 개념 이해와 회상에 집중한다.',
    '9月はAP概念ページを一巡する事前学習期間のため、今日は基礎理論の理解と想起に集中する。'
FROM ap_study_plans p
WHERE p.plan_code = 'AP_2026_H2'
  AND p.is_active = 1;

-- AP daily concept item
INSERT OR IGNORE INTO ap_daily_items (
    session_id,
    topic_id,
    item_kind,
    sequence_no,
    title_ko,
    title_ja,
    description_ko,
    description_ja,
    target_minutes
)
SELECT
    s.id,
    t.id,
    'concept',
    1,
    '기초이론: 진법 변환·정보량·논리 연산',
    '基礎理論：基数変換・情報量・論理演算',
    '2진수·16진수 변환, bit/byte 단위, AND·OR·XOR·NOT, 드모르간 법칙을 개념 중심으로 복습한다.',
    '2進数・16進数の変換、bit/byte、AND・OR・XOR・NOT、ド・モルガンの法則を概念中心に確認する。',
    30
FROM ap_daily_sessions s
JOIN ap_study_plans p ON p.id = s.plan_id
LEFT JOIN ap_study_topics t
  ON t.plan_id = p.id
 AND t.topic_code = 'fundamentals_math'
WHERE p.plan_code = 'AP_2026_H2'
  AND s.study_date = '2026-09-02';

-- Archive the source payload for date-based retrieval.
INSERT OR IGNORE INTO ap_daily_contents (
    plan_id,
    study_date,
    topic_id,
    content_type,
    sequence_no,
    title_ko,
    title_ja,
    payload_json
)
SELECT
    p.id,
    '2026-09-02',
    t.id,
    'concept',
    1,
    '기초이론: 진법 변환·정보량·논리 연산',
    '基礎理論：基数変換・情報量・論理演算',
    '{"mode":"prestudy_concept_first_pass","topic_code":"fundamentals_math","source":"data/ap/daily/2026-09-02.json","daily_questions_enabled":false}'
FROM ap_study_plans p
LEFT JOIN ap_study_topics t
  ON t.plan_id = p.id
 AND t.topic_code = 'fundamentals_math'
WHERE p.plan_code = 'AP_2026_H2'
  AND p.is_active = 1;
