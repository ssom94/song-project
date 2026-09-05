-- 0070_ap_content_validation_fixes.sql
-- AP content validation hotfixes confirmed on 2026-09-05.
-- Keep this migration bounded and index-driven. Do not scan the full question bank.
PRAGMA foreign_keys = ON;

-- B-07 Incident Response
-- Previous trap text incorrectly implied that immediately reinitializing an infected
-- server preserves evidence. In practice, immediate reinitialization can destroy
-- volatile data, logs, and other evidence needed for incident analysis.
UPDATE ap_concepts
SET traps_ko = '감염 서버를 즉시 초기화하면 휘발성 정보·로그 등 분석에 필요한 증거를 잃을 수 있다. 우선 확산을 차단하고 증거보전 절차에 따라 분석한 뒤 원인을 제거하고 복구한다.',
    traps_ja = '感染サーバを直ちに初期化すると、揮発性情報やログなど分析に必要な証拠を失うおそれがある。まず拡大を抑止し、証拠保全の手順に従って分析した後、原因を除去して復旧する。',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE concept_code = 'B-07';

-- If a generic B-07 fallback question was generated earlier from the old trap text,
-- repair only those rows. The concept/type indexes keep this update tightly bounded.
UPDATE ap_concept_questions
SET answer_ko = REPLACE(
      answer_ko,
      '문제점은 감염 서버를 즉시 초기화해 증거를 잃지 않도록 한다.',
      '문제점은 감염 서버를 즉시 초기화하면 휘발성 정보·로그 등 분석에 필요한 증거를 잃을 수 있다는 점이다.'
    ),
    answer_ja = REPLACE(
      answer_ja,
      '問題点は「感染serverを即初期化して証拠を失わない。」。',
      '問題点は「感染サーバを直ちに初期化すると、揮発性情報やログなど分析に必要な証拠を失うおそれがある。」。'
    )
WHERE problem_type_id IN (
  SELECT pt.id
  FROM ap_concept_problem_types pt
  JOIN ap_concepts c ON c.id = pt.concept_id
  WHERE c.concept_code = 'B-07'
)
AND (
  answer_ko LIKE '%감염 서버를 즉시 초기화%'
  OR answer_ja LIKE '%感染serverを即初期化%'
);
