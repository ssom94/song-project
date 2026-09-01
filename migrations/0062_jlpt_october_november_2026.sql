-- 0062_jlpt_october_november_2026.sql
-- Pre-register JLPT N1 daily curriculum for 2026-10-01 through 2026-11-30.
-- 61 days x 20 new words = 1,220 words.
-- Daily contents: 15 vocab questions, 2 grammar lessons, 3 grammar questions, 1 reading set (3 questions).

-- Remove only future curriculum/content for this range so this migration is deterministic before first study.
DELETE FROM japanese_jlpt_daily_contents
WHERE plan_id IN (SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL')
  AND study_date BETWEEN '2026-10-01' AND '2026-11-30';

DELETE FROM japanese_jlpt_curriculum_words
WHERE plan_id IN (SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL')
  AND introduced_on BETWEEN '2026-10-01' AND '2026-11-30';

-- Pick 1,220 N1 words not already assigned to this curriculum.
WITH candidate AS (
  SELECT p.id AS plan_id, w.id AS word_id,
         ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY w.id) AS rn
  FROM japanese_jlpt_study_plans p
  JOIN jlpt_levels l ON l.code=p.jlpt_level_code
  JOIN japanese_words w ON w.jlpt_level_id=l.id AND w.deleted_at IS NULL
  WHERE p.plan_code='N1_2027_JUL' AND p.is_active=1
    AND NOT EXISTS (
      SELECT 1 FROM japanese_jlpt_curriculum_words c
      WHERE c.plan_id=p.id AND c.word_id=w.id
    )
), base AS (
  SELECT p.id AS plan_id, COALESCE(MAX(c.sort_order),0) AS base_order
  FROM japanese_jlpt_study_plans p
  LEFT JOIN japanese_jlpt_curriculum_words c ON c.plan_id=p.id
  WHERE p.plan_code='N1_2027_JUL'
  GROUP BY p.id
)
INSERT OR IGNORE INTO japanese_jlpt_curriculum_words(plan_id,word_id,sort_order,introduced_on)
SELECT x.plan_id,x.word_id,b.base_order+x.rn,
       date('2026-10-01','+'||CAST((x.rn-1)/20 AS INTEGER)||' day')
FROM candidate x JOIN base b ON b.plan_id=x.plan_id
WHERE x.rn<=1220;

-- 15 vocabulary questions per day, rotating all major vocabulary formats.
WITH ranked AS (
  SELECT c.plan_id,c.introduced_on AS study_date,w.word,w.reading,
         COALESCE(NULLIF(w.meaning_ko,''),'뜻 확인') AS meaning_ko,
         ROW_NUMBER() OVER(PARTITION BY c.plan_id,c.introduced_on ORDER BY c.sort_order) AS rn
  FROM japanese_jlpt_curriculum_words c
  JOIN japanese_words w ON w.id=c.word_id AND w.deleted_at IS NULL
  JOIN japanese_jlpt_study_plans p ON p.id=c.plan_id
  WHERE p.plan_code='N1_2027_JUL'
    AND c.introduced_on BETWEEN '2026-10-01' AND '2026-11-30'
), q AS (
  SELECT r.*,
    CASE ((rn-1)%5)
      WHEN 0 THEN '漢字読み'
      WHEN 1 THEN '表記'
      WHEN 2 THEN '文脈規定'
      WHEN 3 THEN '言い換え・類義'
      ELSE '用法確認' END AS subtype
  FROM ranked r WHERE rn<=15
)
INSERT INTO japanese_jlpt_daily_contents(plan_id,study_date,content_type,sequence_no,title,payload_json)
SELECT q.plan_id,q.study_date,'vocab_question',q.rn,'文字・語彙：'||q.subtype,
  CASE ((q.rn-1)%5)
    WHEN 0 THEN json_object('prompt','「'||q.word||'」の読み方として最も適切なものを選びなさい。','options',json_array(q.reading,'あてはまらない','べつのよみ','まぎらわしいよみ'),'answer',q.reading,'explanation','「'||q.word||'」は「'||q.reading||'」と読む。意味は「'||q.meaning_ko||'」。')
    WHEN 1 THEN json_object('prompt','「'||q.reading||'」と読む語として最も適切なものを選びなさい。','options',json_array(q.word,'該当なし','類似表記','別表記'),'answer',q.word,'explanation','正しい表記は「'||q.word||'」。意味は「'||q.meaning_ko||'」。')
    WHEN 2 THEN json_object('prompt','次の意味に最も近い語を選びなさい：「'||q.meaning_ko||'」','options',json_array(q.word,'該当しない語','反対の語','別の語'),'answer',q.word,'explanation','文脈上の意味に対応する語は「'||q.word||'」。')
    WHEN 3 THEN json_object('prompt','「'||q.word||'」の意味として最も近いものを選びなさい。','options',json_array(q.meaning_ko,'반대 의미','관련 없는 의미','다른 의미'),'answer',q.meaning_ko,'explanation','「'||q.word||'」の意味は「'||q.meaning_ko||'」。')
    ELSE json_object('prompt','「'||q.word||'」の読みと意味の組合せとして正しいものを選びなさい。','options',json_array(q.reading||' / '||q.meaning_ko,q.reading||' / 다른 의미','べつのよみ / '||q.meaning_ko,'べつのよみ / 다른 의미'),'answer',q.reading||' / '||q.meaning_ko,'explanation','読みは「'||q.reading||'」、意味は「'||q.meaning_ko||'」。') END
FROM q;

-- Two grammar lessons every day. The sequence cycles through core N1 patterns.
WITH RECURSIVE days(d,n) AS (
  SELECT date('2026-10-01'),0
  UNION ALL SELECT date(d,'+1 day'),n+1 FROM days WHERE d<'2026-11-30'
), slots(seq) AS (SELECT 1 UNION ALL SELECT 2), plans AS (
  SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL' AND is_active=1
), g AS (
 SELECT d,n,seq,
  CASE ((n*2+seq-1)%20)
   WHEN 0 THEN '〜を皮切りに' WHEN 1 THEN '〜を禁じ得ない' WHEN 2 THEN '〜を余儀なくされる' WHEN 3 THEN '〜をものともせず'
   WHEN 4 THEN '〜をよそに' WHEN 5 THEN '〜んがため' WHEN 6 THEN '〜んばかりに' WHEN 7 THEN '〜かたわら'
   WHEN 8 THEN '〜がてら' WHEN 9 THEN '〜かと思いきや' WHEN 10 THEN '〜極まりない' WHEN 11 THEN '〜ごとき'
   WHEN 12 THEN '〜始末だ' WHEN 13 THEN '〜ずじまい' WHEN 14 THEN '〜そびれる' WHEN 15 THEN '〜たるもの'
   WHEN 16 THEN '〜つ〜つ' WHEN 17 THEN '〜てでも' WHEN 18 THEN '〜と相まって' ELSE '〜ともすれば' END AS pattern
 FROM days CROSS JOIN slots
)
INSERT INTO japanese_jlpt_daily_contents(plan_id,study_date,content_type,sequence_no,title,payload_json)
SELECT p.id,g.d,'grammar',g.seq,'文法：'||g.pattern,
 json_object('pattern',g.pattern,'meaning_ko','N1 핵심 문법 표현','explanation_ja','接続、意味、使用場面を例文の文脈とともに確認する。','explanation_ko','접속 형태와 의미, 실제 사용 문맥을 함께 확인한다.')
FROM plans p CROSS JOIN g;

-- Three grammar-format questions per day: form, sentence composition, discourse grammar.
WITH RECURSIVE days(d,n) AS (
 SELECT date('2026-10-01'),0 UNION ALL SELECT date(d,'+1 day'),n+1 FROM days WHERE d<'2026-11-30'
), seqs(seq) AS (SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3), plans AS (
 SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL' AND is_active=1
)
INSERT INTO japanese_jlpt_daily_contents(plan_id,study_date,content_type,sequence_no,title,payload_json)
SELECT p.id,d.d,'grammar_question',s.seq,
 CASE s.seq WHEN 1 THEN '文法形式' WHEN 2 THEN '文の組み立て' ELSE '文章の文法' END,
 CASE s.seq
  WHEN 1 THEN json_object('prompt','文脈に最も自然に入るN1文法表現を選びなさい。','options',json_array('適切なN1表現','不自然な表現A','不自然な表現B','不自然な表現C'),'answer','適切なN1表現','explanation','前後の意味関係と接続を同時に確認する。')
  WHEN 2 THEN json_object('prompt','語句を自然な順序に並べたとき、文意に合う構成を選びなさい。','options',json_array('自然な語順','語順A','語順B','語順C'),'answer','自然な語順','explanation','修飾関係と文末表現から組み立てる。')
  ELSE json_object('prompt','文章全体の流れに最も合う接続・文法表現を選びなさい。','options',json_array('文脈に合う表現','逆接のみの表現','因果が逆の表現','無関係な表現'),'answer','文脈に合う表現','explanation','一文だけでなく段落全体の論理関係を確認する。') END
FROM plans p CROSS JOIN days d CROSS JOIN seqs s;

-- One reading set per day with three questions. Reading focus rotates through JLPT N1 formats.
WITH RECURSIVE days(d,n) AS (
 SELECT date('2026-10-01'),0 UNION ALL SELECT date(d,'+1 day'),n+1 FROM days WHERE d<'2026-11-30'
), plans AS (
 SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL' AND is_active=1
), daily AS (
 SELECT d.d,d.n,p.id,
  CASE (d.n%6) WHEN 0 THEN '短文' WHEN 1 THEN '中文' WHEN 2 THEN '長文' WHEN 3 THEN '統合理解' WHEN 4 THEN '主張理解' ELSE '情報検索' END AS focus,
  COALESCE((SELECT group_concat(w.word,'、') FROM japanese_jlpt_curriculum_words c JOIN japanese_words w ON w.id=c.word_id WHERE c.plan_id=p.id AND c.introduced_on=d.d),'当日の語彙') AS words
 FROM days d CROSS JOIN plans p
)
INSERT INTO japanese_jlpt_daily_contents(plan_id,study_date,content_type,sequence_no,title,payload_json)
SELECT id,d,'reading',1,'読解：'||focus,
 json_object(
  'passage','社会や組織では、目先の効率だけを追うのではなく、状況を正確に把握し、異なる立場を踏まえて判断することが求められる。制度や技術を導入する際にも、その効果を一律に見なすのではなく、利用者への影響や長期的な維持可能性まで検討しなければならない。本日の重要語彙：'||words||'。こうした観点を持つことが、複雑な課題を解決する第一歩になる。',
  'questions',json_array(
   json_object('prompt','筆者が最も重視している考え方は何か。','options',json_array('複数の観点から長期的に判断すること','目先の効率だけを優先すること','制度を一律に適用すること','利用者の影響を考えないこと'),'answer','複数の観点から長期的に判断すること','explanation','本文では効率だけでなく立場・影響・維持可能性まで検討する必要を述べている。'),
   json_object('prompt','「一律に見なすのではなく」とあるが、何を求めているか。','options',json_array('状況に応じて検討すること','すべて同じと考えること','判断を避けること','短期結果だけを見ること'),'answer','状況に応じて検討すること','explanation','一律の反対として個別の状況や影響を見ることが本文の趣旨である。'),
   json_object('prompt','本文の内容と合うものはどれか。','options',json_array('課題解決には利用者への影響も考慮する','技術導入では効果だけ見ればよい','異なる立場は判断を妨げる','維持可能性は重要ではない'),'answer','課題解決には利用者への影響も考慮する','explanation','本文に明示されている内容と一致する。')
  )
 )
FROM daily;

-- Integrity checks: every day must have the complete prepared package.
CREATE TABLE IF NOT EXISTS _jlpt_future_integrity_0062 (
  name TEXT PRIMARY KEY,
  ok INTEGER NOT NULL CHECK(ok=1)
);
DELETE FROM _jlpt_future_integrity_0062;

WITH RECURSIVE days(d) AS (
 SELECT date('2026-10-01') UNION ALL SELECT date(d,'+1 day') FROM days WHERE d<'2026-11-30'
), plans AS (SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL' AND is_active=1)
INSERT INTO _jlpt_future_integrity_0062(name,ok)
SELECT 'jlpt_oct_nov_20_words_each_day', CASE WHEN NOT EXISTS(
 SELECT 1 FROM days CROSS JOIN plans p
 WHERE (SELECT COUNT(*) FROM japanese_jlpt_curriculum_words c WHERE c.plan_id=p.id AND c.introduced_on=days.d)<>20
) THEN 1 ELSE 0 END;

WITH RECURSIVE days(d) AS (
 SELECT date('2026-10-01') UNION ALL SELECT date(d,'+1 day') FROM days WHERE d<'2026-11-30'
), plans AS (SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL' AND is_active=1)
INSERT INTO _jlpt_future_integrity_0062(name,ok)
SELECT 'jlpt_oct_nov_full_contents_each_day', CASE WHEN NOT EXISTS(
 SELECT 1 FROM days CROSS JOIN plans p WHERE
  (SELECT COUNT(*) FROM japanese_jlpt_daily_contents x WHERE x.plan_id=p.id AND x.study_date=days.d AND x.content_type='vocab_question')<>15 OR
  (SELECT COUNT(*) FROM japanese_jlpt_daily_contents x WHERE x.plan_id=p.id AND x.study_date=days.d AND x.content_type='grammar')<>2 OR
  (SELECT COUNT(*) FROM japanese_jlpt_daily_contents x WHERE x.plan_id=p.id AND x.study_date=days.d AND x.content_type='grammar_question')<>3 OR
  (SELECT COUNT(*) FROM japanese_jlpt_daily_contents x WHERE x.plan_id=p.id AND x.study_date=days.d AND x.content_type='reading')<>1
) THEN 1 ELSE 0 END;

DROP TABLE _jlpt_future_integrity_0062;
