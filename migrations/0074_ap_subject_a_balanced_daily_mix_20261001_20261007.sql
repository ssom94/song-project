-- 0074 AP Subject A balanced daily mix for 2026-10-01..2026-10-07
-- Replaces sequential OFFSET slices with an explicit balanced set.
-- Uses only indexed concept_code/type/question keys; no full-table COUNT/scan validation.
PRAGMA foreign_keys = ON;

DELETE FROM ap_daily_contents
WHERE plan_id IN (SELECT id FROM ap_study_plans WHERE plan_code='AP_2026_H2')
  AND study_date BETWEEN '2026-10-01' AND '2026-10-07'
  AND content_type='subject_a_question';

WITH picks(study_date,sequence_no,concept_code,type_no,question_no) AS (
  VALUES
  ('2026-10-01',1,'A-01',1,2),
  ('2026-10-01',2,'A-08',2,2),
  ('2026-10-01',3,'A-16',1,2),
  ('2026-10-01',4,'A-22',2,2),
  ('2026-10-01',5,'A-28',1,2),
  ('2026-10-01',6,'A-34',1,1),
  ('2026-10-01',7,'A-40',1,1),
  ('2026-10-01',8,'A-50',1,1),
  ('2026-10-01',9,'A-56',1,1),
  ('2026-10-01',10,'A-65',1,1),
  ('2026-10-02',1,'A-03',3,2),
  ('2026-10-02',2,'A-09',1,2),
  ('2026-10-02',3,'A-17',2,2),
  ('2026-10-02',4,'A-24',1,2),
  ('2026-10-02',5,'A-29',2,2),
  ('2026-10-02',6,'A-36',2,1),
  ('2026-10-02',7,'A-41',1,1),
  ('2026-10-02',8,'A-53',1,1),
  ('2026-10-02',9,'A-57',2,1),
  ('2026-10-02',10,'A-61',1,1),
  ('2026-10-03',1,'A-04',1,2),
  ('2026-10-03',2,'A-10',2,2),
  ('2026-10-03',3,'A-18',2,2),
  ('2026-10-03',4,'A-25',2,2),
  ('2026-10-03',5,'A-30',1,2),
  ('2026-10-03',6,'A-37',2,1),
  ('2026-10-03',7,'A-44',2,1),
  ('2026-10-03',8,'A-54',1,1),
  ('2026-10-03',9,'A-59',1,1),
  ('2026-10-03',10,'A-62',2,1),
  ('2026-10-04',1,'A-05',2,2),
  ('2026-10-04',2,'A-11',2,2),
  ('2026-10-04',3,'A-19',3,2),
  ('2026-10-04',4,'A-26',1,2),
  ('2026-10-04',5,'A-31',3,2),
  ('2026-10-04',6,'A-38',1,1),
  ('2026-10-04',7,'A-45',3,1),
  ('2026-10-04',8,'A-47',2,1),
  ('2026-10-04',9,'A-55',2,1),
  ('2026-10-04',10,'A-63',1,1),
  ('2026-10-05',1,'A-06',2,2),
  ('2026-10-05',2,'A-12',3,2),
  ('2026-10-05',3,'A-20',3,2),
  ('2026-10-05',4,'A-27',2,2),
  ('2026-10-05',5,'A-32',3,2),
  ('2026-10-05',6,'A-39',3,1),
  ('2026-10-05',7,'A-46',1,1),
  ('2026-10-05',8,'A-48',1,1),
  ('2026-10-05',9,'A-58',3,1),
  ('2026-10-05',10,'A-64',3,1),
  ('2026-10-06',1,'A-07',1,2),
  ('2026-10-06',2,'A-13',2,2),
  ('2026-10-06',3,'A-21',3,2),
  ('2026-10-06',4,'A-28',3,2),
  ('2026-10-06',5,'A-33',3,1),
  ('2026-10-06',6,'A-42',3,1),
  ('2026-10-06',7,'A-49',1,1),
  ('2026-10-06',8,'A-51',1,1),
  ('2026-10-06',9,'A-60',1,1),
  ('2026-10-06',10,'A-66',1,1),
  ('2026-10-07',1,'A-02',3,2),
  ('2026-10-07',2,'A-08',3,2),
  ('2026-10-07',3,'A-15',2,2),
  ('2026-10-07',4,'A-23',3,2),
  ('2026-10-07',5,'A-35',2,1),
  ('2026-10-07',6,'A-43',3,1),
  ('2026-10-07',7,'A-52',2,1),
  ('2026-10-07',8,'A-54',2,1),
  ('2026-10-07',9,'A-67',3,1),
  ('2026-10-07',10,'A-68',2,1)
),
selected AS (
  SELECT
    k.study_date,
    k.sequence_no,
    c.concept_code,
    c.title_ko,
    c.title_ja,
    pt.type_no,
    q.id AS source_question_id,
    q.question_no,
    q.question_ko,
    q.question_ja,
    q.choices_ko_json,
    q.choices_ja_json,
    q.correct_choice,
    q.explanation_ko,
    q.explanation_ja
  FROM picks k
  JOIN ap_concepts c
    ON c.concept_code=k.concept_code
   AND c.exam_part='A'
  JOIN ap_concept_problem_types pt
    ON pt.concept_id=c.id
   AND pt.type_no=k.type_no
  JOIN ap_concept_questions q
    ON q.problem_type_id=pt.id
   AND q.question_no=k.question_no
  WHERE q.choices_ja_json IS NOT NULL
    AND q.correct_choice IS NOT NULL
)
INSERT INTO ap_daily_contents(
  plan_id,study_date,topic_id,content_type,sequence_no,
  title_ko,title_ja,payload_json
)
SELECT
  p.id,
  s.study_date,
  NULL,
  'subject_a_question',
  s.sequence_no,
  s.concept_code||' '||s.title_ko,
  s.concept_code||' '||s.title_ja,
  json_object(
    'source_question_id',s.source_question_id,
    'concept_code',s.concept_code,
    'problem_type_no',s.type_no,
    'question_no',s.question_no,
    'question',s.question_ja,
    'question_ko',s.question_ko,
    'options',json(s.choices_ja_json),
    'options_ko',CASE WHEN s.choices_ko_json IS NULL THEN NULL ELSE json(s.choices_ko_json) END,
    'answer',s.correct_choice,
    'explanation',COALESCE(s.explanation_ja,'')||char(10)||'한국어: '||COALESCE(s.explanation_ko,'')
  )
FROM ap_study_plans p
CROSS JOIN selected s
WHERE p.plan_code='AP_2026_H2'
ORDER BY s.study_date,s.sequence_no;
