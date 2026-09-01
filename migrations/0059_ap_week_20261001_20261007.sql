-- 0059_ap_week_20261001_20261007.sql
-- AP daily content for 2026-10-01 through 2026-10-07.
-- D1-safe version: avoids compound SELECT chains.
PRAGMA foreign_keys = ON;

DELETE FROM ap_daily_contents
WHERE plan_id IN (SELECT id FROM ap_study_plans WHERE plan_code='AP_2026_H2')
  AND study_date BETWEEN '2026-10-01' AND '2026-10-07';

-- Daily concept focus.
WITH focus(study_date,seq,topic_code) AS (VALUES
 ('2026-10-01',1,'programming_algorithms'),
 ('2026-10-02',2,'security'),
 ('2026-10-03',3,'database'),
 ('2026-10-04',4,'network'),
 ('2026-10-05',5,'system_development'),
 ('2026-10-06',6,'operating_system'),
 ('2026-10-07',7,'fundamentals_math')
)
INSERT INTO ap_daily_contents(plan_id,study_date,topic_id,content_type,sequence_no,title_ko,title_ja,payload_json)
SELECT p.id,f.study_date,t.id,'concept',1,t.title_ko,t.title_ja,
 json_object(
   'summary_ko',t.study_points_ko,
   'summary_ja',t.study_points_ja,
   'keywords',json_array(t.title_ja),
   'check',json_object(
      'question','今日のテーマ「'||t.title_ja||'」を学ぶとき、最も重要な姿勢はどれか。',
      'options',json_array('用語だけでなく判断根拠と計算・手順まで説明できるようにする。','答えだけ暗記する。','韓国語訳だけ覚える。','苦手な問題を飛ばして記録しない。'),
      'answer',0,
      'explanation','日本語：APでは定義だけでなく、計算・判断根拠・手順を説明できることが重要。\n한국어: 정의뿐 아니라 계산 과정과 판단 근거까지 설명할 수 있어야 한다。'
   )
 )
FROM focus f
JOIN ap_study_plans p ON p.plan_code='AP_2026_H2'
JOIN ap_study_topics t ON t.plan_id=p.id AND t.topic_code=f.topic_code;

-- 科目A: 10 questions every day, rotated through the complete A-question library.
WITH days(study_date,day_no) AS (VALUES
 ('2026-10-01',1),('2026-10-02',2),('2026-10-03',3),('2026-10-04',4),
 ('2026-10-05',5),('2026-10-06',6),('2026-10-07',7)
), nums(n) AS (VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10)),
ranked AS (
 SELECT q.id,q.question_ja,q.question_ko,q.choices_ja_json,q.choices_ko_json,q.correct_choice,
        q.explanation_ja,q.explanation_ko,c.title_ja,c.title_ko,c.concept_code,
        ROW_NUMBER() OVER(ORDER BY c.sort_order,pt.type_no,q.question_no,q.id) AS rn
 FROM ap_concept_questions q
 JOIN ap_concept_problem_types pt ON pt.id=q.problem_type_id
 JOIN ap_concepts c ON c.id=pt.concept_id
 WHERE c.exam_part='A' AND q.choices_ja_json IS NOT NULL AND q.correct_choice IS NOT NULL
), totals AS (SELECT COUNT(*) AS total_count FROM ranked), selected AS (
 SELECT d.study_date,n.n AS sequence_no,r.*
 FROM days d
 CROSS JOIN nums n
 CROSS JOIN totals total
 JOIN ranked r ON r.rn = (((d.day_no-1)*10 + n.n - 1) % total.total_count) + 1
 WHERE total.total_count > 0
)
INSERT INTO ap_daily_contents(plan_id,study_date,topic_id,content_type,sequence_no,title_ko,title_ja,payload_json)
SELECT p.id,s.study_date,NULL,'subject_a_question',s.sequence_no,
       s.concept_code||' '||s.title_ko,s.concept_code||' '||s.title_ja,
       json_object(
         'question',s.question_ja,
         'question_ko',s.question_ko,
         'options',json(s.choices_ja_json),
         'options_ko',CASE WHEN s.choices_ko_json IS NULL THEN NULL ELSE json(s.choices_ko_json) END,
         'answer',s.correct_choice,
         'explanation',COALESCE(s.explanation_ja,'')||'\n한국어: '||COALESCE(s.explanation_ko,'')
       )
FROM selected s
JOIN ap_study_plans p ON p.plan_code='AP_2026_H2';

-- 科目B: one scenario set per day, three written questions. Selected 5 areas only.
WITH focus(study_date,area,title_ja,title_ko,from_code,to_code,scenario) AS (VALUES
 ('2026-10-01','programming','プログラミング','프로그래밍','B-08','B-14','疑似コード、データ構造、処理結果を順に追い、空欄・計算量・改善理由を答えなさい。'),
 ('2026-10-02','security','情報セキュリティ','정보보안','B-01','B-07','Webシステムで異常なアクセスが検出された。ログ、認証設定、通信経路を確認し、原因と対策を説明しなさい。'),
 ('2026-10-03','database','データベース','데이터베이스','B-23','B-28','業務システムの表設計、SQL、トランザクション競合を確認し、結果と改善方法を説明しなさい。'),
 ('2026-10-04','network','ネットワーク','네트워크','B-17','B-22','複数セグメントで通信障害が発生した。アドレス、経路、名前解決、TCP/IPの観点から切り分けなさい。'),
 ('2026-10-05','development','情報システム開発','정보시스템개발','B-29','B-32','要件変更が発生した。影響範囲、設計、テスト、レビューの順で必要な対応を説明しなさい。'),
 ('2026-10-06','security','情報セキュリティ','정보보안','B-01','B-07','認証情報の漏えいが疑われる。事実確認、封じ込め、原因分析、再発防止を順序立てて答えなさい。'),
 ('2026-10-07','programming','プログラミング','프로그래밍','B-08','B-14','配列とグラフを扱う処理について、実行結果を追跡し、計算量と改善案を説明しなさい。')
), plans AS (SELECT id FROM ap_study_plans WHERE plan_code='AP_2026_H2')
INSERT INTO ap_daily_contents(plan_id,study_date,topic_id,content_type,sequence_no,title_ko,title_ja,payload_json)
SELECT p.id,f.study_date,t.id,'subject_b_scenario',1,f.title_ko,f.title_ja,
 json_object(
   'scenario',f.scenario,
   'estimated_minutes',15,
   'questions',json((
      SELECT json_group_array(json_object(
        'question',z.question_ja,
        'question_ko',z.question_ko,
        'answer',COALESCE(z.answer_ja,z.answer_ko,''),
        'answer_ko',z.answer_ko,
        'explanation',COALESCE(z.explanation_ja,'')||'\n한국어: '||COALESCE(z.explanation_ko,'')
      ))
      FROM (
        SELECT q.question_ja,q.question_ko,q.answer_ja,q.answer_ko,q.explanation_ja,q.explanation_ko
        FROM ap_concept_questions q
        JOIN ap_concept_problem_types pt ON pt.id=q.problem_type_id
        JOIN ap_concepts c ON c.id=pt.concept_id
        WHERE c.exam_part='B' AND c.concept_code BETWEEN f.from_code AND f.to_code
        ORDER BY c.sort_order,pt.type_no,q.question_no,q.id
        LIMIT 3
      ) z
   )),
   'answering_tip_ja','設問が求める対象を先に特定し、事実→判断基準→結論の順に短く記述する。',
   'answering_tip_ko','문제가 요구하는 대상을 먼저 특정하고 사실→판단기준→결론 순서로 짧고 명확하게 쓴다.'
 )
FROM focus f CROSS JOIN plans p
LEFT JOIN ap_study_topics t ON t.plan_id=p.id AND t.topic_code = CASE f.area
 WHEN 'programming' THEN 'programming_algorithms'
 WHEN 'security' THEN 'security'
 WHEN 'database' THEN 'database'
 WHEN 'network' THEN 'network'
 ELSE 'system_development' END;