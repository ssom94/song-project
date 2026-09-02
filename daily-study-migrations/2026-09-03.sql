-- 2026-09-03 daily study registration
-- Source of truth:
--   data/jlpt/daily_words/2026-09-03.json
--   data/jlpt/daily/2026-09-03.json
--   data/ap/daily/2026-09-03.json
--
-- JLPT N1 is intentionally not inserted because the configured restart date is 2026-09-07.
-- AP remains in the September concept-first prestudy phase, so only one concept item is registered.
-- Idempotent and low-read: stable date/item keys with INSERT OR IGNORE; no broad scans or validation COUNTs.

PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO ap_daily_sessions (
    plan_id, study_date, target_minutes, recommendation_reason_ko, recommendation_reason_ja
)
SELECT
    p.id,
    '2026-09-03',
    30,
    '9월 사전학습에서 기초이론 다음 순서인 컴퓨터 구성을 진행한다. 최근 다룬 캐시 메모리는 반복하지 않고 CPU·레지스터·명령 실행·성능 계산에 집중한다.',
    '9月の事前学習として基礎理論の次にコンピュータ構成へ進む。直近で扱ったキャッシュメモリは繰り返さず、CPU・レジスタ・命令実行・性能計算に集中する。'
FROM ap_study_plans p
WHERE p.plan_code = 'AP_2026_H2'
  AND p.is_active = 1;

INSERT OR IGNORE INTO ap_daily_items (
    session_id, topic_id, item_kind, sequence_no,
    title_ko, title_ja, description_ko, description_ja, target_minutes
)
SELECT
    s.id,
    t.id,
    'concept',
    1,
    '컴퓨터 구성: CPU·레지스터·명령 실행·성능 지표',
    'コンピュータ構成：CPU・レジスタ・命令実行・性能指標',
    'CPU의 기본 구성, PC·IR 등 주요 레지스터, fetch→decode→execute 흐름, 클록 주파수·CPI·CPU 실행시간 계산을 개념 중심으로 학습한다.',
    'CPUの基本構成、PC・IRなどの主要レジスタ、fetch→decode→executeの流れ、クロック周波数・CPI・CPU実行時間の計算を概念中心に学習する。',
    30
FROM ap_daily_sessions s
JOIN ap_study_plans p ON p.id = s.plan_id
LEFT JOIN ap_study_topics t
  ON t.plan_id = p.id
 AND t.topic_code = 'computer_architecture'
WHERE p.plan_code = 'AP_2026_H2'
  AND s.study_date = '2026-09-03';

INSERT OR IGNORE INTO ap_daily_contents (
    plan_id, study_date, topic_id, content_type, sequence_no,
    title_ko, title_ja, payload_json
)
SELECT
    p.id,
    '2026-09-03',
    t.id,
    'concept',
    1,
    '컴퓨터 구성: CPU·레지스터·명령 실행·성능 지표',
    'コンピュータ構成：CPU・レジスタ・命令実行・性能指標',
    '{"mode":"prestudy_concept_first_pass","topic_code":"computer_architecture","subtopics":["cpu_components","registers","instruction_cycle","clock_cpi_cpu_time"],"source":"data/ap/daily/2026-09-03.json","daily_questions_enabled":false}'
FROM ap_study_plans p
LEFT JOIN ap_study_topics t
  ON t.plan_id = p.id
 AND t.topic_code = 'computer_architecture'
WHERE p.plan_code = 'AP_2026_H2'
  AND p.is_active = 1;
