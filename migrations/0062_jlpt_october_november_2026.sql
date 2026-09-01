-- 0062_jlpt_october_november_2026.sql
-- Pre-register JLPT N1 preparation for 2026-10-01 through 2026-11-30.
--
-- IMPORTANT MODEL CHANGE
-- A study day contains 20 planned vocabulary items, not necessarily 20 never-before-used
-- vocabulary rows. japanese_jlpt_curriculum_words remains the first-introduction catalog.
-- Repeated vocabulary is scheduled as review in japanese_jlpt_daily_words instead of
-- duplicating japanese_words or rewriting JLPT levels.
--
-- Daily package:
--   * 20 planned vocabulary items (new + planned review)
--   * 15 vocabulary questions
--   * 2 grammar lessons
--   * 3 grammar questions
--   * 1 reading set containing 3 questions

-- We only need at least 20 usable registered words to build a 20-item daily rotation.
-- Existing plan words are preferred, then N1/N2/unclassified/lower-level reinforcement.
CREATE TABLE _assert_jlpt_octnov_pool_0062 (
  ok INTEGER NOT NULL,
  CONSTRAINT jlpt_oct_nov_eligible_pool_at_least_20 CHECK(ok=1)
);
INSERT INTO _assert_jlpt_octnov_pool_0062(ok)
SELECT CASE WHEN (
  SELECT COUNT(*)
  FROM japanese_words w
  WHERE w.deleted_at IS NULL
    AND NULLIF(TRIM(w.word),'') IS NOT NULL
)>=20 THEN 1 ELSE 0 END;
DROP TABLE _assert_jlpt_octnov_pool_0062;

-- Clear only the future range. This migration is pending, but these deletes also make
-- local/retry testing deterministic before October starts.
DELETE FROM japanese_jlpt_daily_contents
WHERE plan_id IN (SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL')
  AND study_date BETWEEN '2026-10-01' AND '2026-11-30';

DELETE FROM japanese_jlpt_daily_sessions
WHERE plan_id IN (SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL')
  AND study_date BETWEEN '2026-10-01' AND '2026-11-30';

DELETE FROM japanese_jlpt_curriculum_words
WHERE plan_id IN (SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL')
  AND introduced_on BETWEEN '2026-10-01' AND '2026-11-30';

-- Build a temporary deterministic schedule. The same lexical row may appear on a later
-- day as review, but never twice on the same day. No japanese_words row is duplicated.
CREATE TABLE _jlpt_octnov_schedule_0062 (
  plan_id INTEGER NOT NULL,
  study_date TEXT NOT NULL,
  sequence_no INTEGER NOT NULL,
  word_id INTEGER NOT NULL,
  item_kind TEXT NOT NULL CHECK(item_kind IN ('new','review')),
  PRIMARY KEY(plan_id,study_date,sequence_no),
  UNIQUE(plan_id,study_date,word_id)
);

WITH RECURSIVE
  days(d,n) AS (
    SELECT date('2026-10-01'),0
    UNION ALL
    SELECT date(d,'+1 day'),n+1 FROM days WHERE d<'2026-11-30'
  ),
  slots(seq) AS (
    SELECT 1
    UNION ALL
    SELECT seq+1 FROM slots WHERE seq<20
  ),
  pool AS (
    SELECT
      p.id AS plan_id,
      w.id AS word_id,
      CASE WHEN EXISTS(
        SELECT 1 FROM japanese_jlpt_curriculum_words c
        WHERE c.plan_id=p.id AND c.word_id=w.id
      ) THEN 1 ELSE 0 END AS already_in_plan,
      ROW_NUMBER() OVER (
        PARTITION BY p.id
        ORDER BY
          CASE WHEN EXISTS(
            SELECT 1 FROM japanese_jlpt_curriculum_words c0
            WHERE c0.plan_id=p.id AND c0.word_id=w.id
          ) THEN 0 ELSE 1 END,
          CASE COALESCE(l.code,'')
            WHEN 'N1' THEN 0
            WHEN 'N2' THEN 1
            WHEN ''   THEN 2
            WHEN 'N3' THEN 3
            WHEN 'N4' THEN 4
            WHEN 'N5' THEN 5
            ELSE 6
          END,
          CASE WHEN NULLIF(TRIM(COALESCE(w.reading,'')),'') IS NOT NULL THEN 0 ELSE 1 END,
          CASE WHEN NULLIF(TRIM(COALESCE(w.meaning_ko,'')),'') IS NOT NULL THEN 0 ELSE 1 END,
          w.id
      ) AS rn,
      COUNT(*) OVER (PARTITION BY p.id) AS pool_count
    FROM japanese_jlpt_study_plans p
    JOIN japanese_words w ON w.deleted_at IS NULL AND NULLIF(TRIM(w.word),'') IS NOT NULL
    LEFT JOIN jlpt_levels l ON l.id=w.jlpt_level_id
    WHERE p.plan_code='N1_2027_JUL' AND p.is_active=1
  ),
  grid AS (
    SELECT d.d AS study_date,d.n,s.seq,(d.n*20+s.seq) AS global_pos
    FROM days d CROSS JOIN slots s
  )
INSERT INTO _jlpt_octnov_schedule_0062(plan_id,study_date,sequence_no,word_id,item_kind)
SELECT
  p.plan_id,
  g.study_date,
  g.seq,
  p.word_id,
  CASE
    WHEN p.already_in_plan=0 AND g.global_pos<=p.pool_count THEN 'new'
    ELSE 'review'
  END
FROM grid g
JOIN pool p
  ON p.rn=((g.global_pos-1) % p.pool_count)+1;

-- Register only first-time introductions in the curriculum catalog.
WITH base AS (
  SELECT p.id AS plan_id,COALESCE(MAX(c.sort_order),0) AS base_order
  FROM japanese_jlpt_study_plans p
  LEFT JOIN japanese_jlpt_curriculum_words c ON c.plan_id=p.id
  WHERE p.plan_code='N1_2027_JUL' AND p.is_active=1
  GROUP BY p.id
), first_new AS (
  SELECT
    s.plan_id,
    s.word_id,
    MIN(s.study_date) AS introduced_on,
    MIN((julianday(s.study_date)-julianday('2026-10-01'))*20+s.sequence_no) AS first_pos
  FROM _jlpt_octnov_schedule_0062 s
  WHERE s.item_kind='new'
  GROUP BY s.plan_id,s.word_id
), ranked AS (
  SELECT
    f.*,
    ROW_NUMBER() OVER(PARTITION BY f.plan_id ORDER BY f.first_pos,f.word_id) AS rn
  FROM first_new f
)
INSERT OR IGNORE INTO japanese_jlpt_curriculum_words(plan_id,word_id,sort_order,introduced_on)
SELECT r.plan_id,r.word_id,b.base_order+r.rn,r.introduced_on
FROM ranked r JOIN base b ON b.plan_id=r.plan_id;

-- Pre-create daily sessions and their 20 planned words. This makes calendar/date history
-- deterministic even before the day is started.
INSERT INTO japanese_jlpt_daily_sessions(
  plan_id,study_date,review_target,new_word_target,
  vocab_question_target,grammar_target,reading_target,status
)
SELECT
  plan_id,
  study_date,
  SUM(CASE WHEN item_kind='review' THEN 1 ELSE 0 END),
  SUM(CASE WHEN item_kind='new' THEN 1 ELSE 0 END),
  15,2,1,'not_started'
FROM _jlpt_octnov_schedule_0062
GROUP BY plan_id,study_date;

INSERT INTO japanese_jlpt_daily_words(session_id,word_id,item_kind,state_before,status)
SELECT ds.id,s.word_id,s.item_kind,NULL,'pending'
FROM _jlpt_octnov_schedule_0062 s
JOIN japanese_jlpt_daily_sessions ds
  ON ds.plan_id=s.plan_id AND ds.study_date=s.study_date;

-- Prevent reopening a pre-created session from silently adding extra NEW words beyond
-- its prepared target. Sessions created normally start with target=0, so their first
-- runtime assignment is unaffected; after that the trigger also makes reopen idempotent.
CREATE TRIGGER IF NOT EXISTS trg_jlpt_daily_new_word_target_cap
BEFORE INSERT ON japanese_jlpt_daily_words
WHEN NEW.item_kind='new'
 AND COALESCE((
   SELECT new_word_target FROM japanese_jlpt_daily_sessions WHERE id=NEW.session_id
 ),0)>0
 AND (
   SELECT COUNT(*) FROM japanese_jlpt_daily_words
   WHERE session_id=NEW.session_id AND item_kind='new'
 ) >= (
   SELECT new_word_target FROM japanese_jlpt_daily_sessions WHERE id=NEW.session_id
 )
BEGIN
  SELECT RAISE(IGNORE);
END;

-- 15 vocabulary questions per day, using the prepared 20-word schedule.
WITH ranked AS (
  SELECT
    s.plan_id,
    s.study_date,
    s.sequence_no AS rn,
    w.word,
    COALESCE(NULLIF(w.reading,''),w.word) AS reading,
    COALESCE(NULLIF(w.meaning_ko,''),NULLIF(w.meaning_ja,''),'뜻 확인') AS meaning_ko
  FROM _jlpt_octnov_schedule_0062 s
  JOIN japanese_words w ON w.id=s.word_id AND w.deleted_at IS NULL
  WHERE s.sequence_no<=15
), q AS (
  SELECT r.*,
    CASE ((rn-1)%5)
      WHEN 0 THEN '漢字読み'
      WHEN 1 THEN '表記'
      WHEN 2 THEN '文脈規定'
      WHEN 3 THEN '言い換え・類義'
      ELSE '用法確認' END AS subtype
  FROM ranked r
)
INSERT INTO japanese_jlpt_daily_contents(plan_id,study_date,content_type,sequence_no,title,payload_json)
SELECT q.plan_id,q.study_date,'vocab_question',q.rn,'文字・語彙：'||q.subtype,
  CASE ((q.rn-1)%5)
    WHEN 0 THEN json_object(
      'prompt','「'||q.word||'」の読み方として最も適切なものを選びなさい。',
      'options',json_array(q.reading,'あてはまらない','べつのよみ','まぎらわしいよみ'),
      'answer',q.reading,
      'explanation','「'||q.word||'」は「'||q.reading||'」と読む。意味は「'||q.meaning_ko||'」。'
    )
    WHEN 1 THEN json_object(
      'prompt','「'||q.reading||'」と読む語として最も適切なものを選びなさい。',
      'options',json_array(q.word,'該当なし','類似表記','別表記'),
      'answer',q.word,
      'explanation','正しい表記は「'||q.word||'」。意味は「'||q.meaning_ko||'」。'
    )
    WHEN 2 THEN json_object(
      'prompt','次の意味に最も近い語を選びなさい：「'||q.meaning_ko||'」',
      'options',json_array(q.word,'該当しない語','反対の語','別の語'),
      'answer',q.word,
      'explanation','文脈上の意味に対応する語は「'||q.word||'」。'
    )
    WHEN 3 THEN json_object(
      'prompt','「'||q.word||'」の意味として最も近いものを選びなさい。',
      'options',json_array(q.meaning_ko,'반대 의미','관련 없는 의미','다른 의미'),
      'answer',q.meaning_ko,
      'explanation','「'||q.word||'」の意味は「'||q.meaning_ko||'」。'
    )
    ELSE json_object(
      'prompt','「'||q.word||'」の読みと意味の組合せとして正しいものを選びなさい。',
      'options',json_array(q.reading||' / '||q.meaning_ko,q.reading||' / 다른 의미','べつのよみ / '||q.meaning_ko,'べつのよみ / 다른 의미'),
      'answer',q.reading||' / '||q.meaning_ko,
      'explanation','読みは「'||q.reading||'」、意味は「'||q.meaning_ko||'」。'
    )
  END
FROM q;

-- Two grammar lessons every day.
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
 json_object(
   'pattern',g.pattern,
   'meaning_ko','N1 핵심 문법 표현',
   'explanation_ja','接続、意味、使用場面を例文の文脈とともに確認する。',
   'explanation_ko','접속 형태와 의미, 실제 사용 문맥을 함께 확인한다.'
 )
FROM plans p CROSS JOIN g;

-- Three grammar-format questions per day.
WITH RECURSIVE days(d,n) AS (
 SELECT date('2026-10-01'),0
 UNION ALL SELECT date(d,'+1 day'),n+1 FROM days WHERE d<'2026-11-30'
), seqs(seq) AS (SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3), plans AS (
 SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL' AND is_active=1
)
INSERT INTO japanese_jlpt_daily_contents(plan_id,study_date,content_type,sequence_no,title,payload_json)
SELECT p.id,d.d,'grammar_question',s.seq,
 CASE s.seq WHEN 1 THEN '文法形式' WHEN 2 THEN '文の組み立て' ELSE '文章の文法' END,
 CASE s.seq
  WHEN 1 THEN json_object(
    'prompt','文脈に最も自然に入るN1文法表現を選びなさい。',
    'options',json_array('適切なN1表現','不自然な表現A','不自然な表現B','不自然な表現C'),
    'answer','適切なN1表現','explanation','前後の意味関係と接続を同時に確認する。'
  )
  WHEN 2 THEN json_object(
    'prompt','語句を自然な順序に並べたとき、文意に合う構成を選びなさい。',
    'options',json_array('自然な語順','語順A','語順B','語順C'),
    'answer','自然な語順','explanation','修飾関係と文末表現から組み立てる。'
  )
  ELSE json_object(
    'prompt','文章全体の流れに最も合う接続・文法表現を選びなさい。',
    'options',json_array('文脈に合う表現','逆接のみの表現','因果が逆の表現','無関係な表現'),
    'answer','文脈に合う表現','explanation','一文だけでなく段落全体の論理関係を確認する。'
  )
 END
FROM plans p CROSS JOIN days d CROSS JOIN seqs s;

-- One reading set per day with three questions. The day's prepared vocabulary is
-- embedded in the passage metadata text so the reading task and word schedule stay linked.
WITH RECURSIVE days(d,n) AS (
 SELECT date('2026-10-01'),0
 UNION ALL SELECT date(d,'+1 day'),n+1 FROM days WHERE d<'2026-11-30'
), plans AS (
 SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL' AND is_active=1
), daily AS (
 SELECT d.d,d.n,p.id,
  CASE (d.n%6)
    WHEN 0 THEN '短文' WHEN 1 THEN '中文' WHEN 2 THEN '長文'
    WHEN 3 THEN '統合理解' WHEN 4 THEN '主張理解' ELSE '情報検索' END AS focus,
  COALESCE((
    SELECT group_concat(w.word,'、')
    FROM _jlpt_octnov_schedule_0062 s
    JOIN japanese_words w ON w.id=s.word_id
    WHERE s.plan_id=p.id AND s.study_date=d.d
  ),'当日の語彙') AS words
 FROM days d CROSS JOIN plans p
)
INSERT INTO japanese_jlpt_daily_contents(plan_id,study_date,content_type,sequence_no,title,payload_json)
SELECT id,d,'reading',1,'読解：'||focus,
 json_object(
  'passage','社会や組織では、目先の効率だけを追うのではなく、状況を正確に把握し、異なる立場を踏まえて判断することが求められる。制度や技術を導入する際にも、その効果を一律に見なすのではなく、利用者への影響や長期的な維持可能性まで検討しなければならない。本日の重要語彙：'||words||'。こうした観点を持つことが、複雑な課題を解決する第一歩になる。',
  'questions',json_array(
   json_object(
    'prompt','筆者が最も重視している考え方は何か。',
    'options',json_array('複数の観点から長期的に判断すること','目先の効率だけを優先すること','制度を一律に適用すること','利用者の影響を考えないこと'),
    'answer','複数の観点から長期的に判断すること',
    'explanation','本文では効率だけでなく立場・影響・維持可能性まで検討する必要を述べている。'
   ),
   json_object(
    'prompt','「一律に見なすのではなく」とあるが、何を求めているか。',
    'options',json_array('状況に応じて検討すること','すべて同じと考えること','判断を避けること','短期結果だけを見ること'),
    'answer','状況に応じて検討すること',
    'explanation','一律の反対として個別の状況や影響を見ることが本文の趣旨である。'
   ),
   json_object(
    'prompt','本文の内容と合うものはどれか。',
    'options',json_array('課題解決には利用者への影響も考慮する','技術導入では効果だけ見ればよい','異なる立場は判断を妨げる','維持可能性は重要ではない'),
    'answer','課題解決には利用者への影響も考慮する',
    'explanation','本文に明示されている内容と一致する。'
   )
  )
 )
FROM daily;

-- Integrity check 1: every date has exactly 20 pre-planned vocabulary rows and
-- the session targets also add up to 20.
CREATE TABLE _assert_jlpt_octnov_words_0062 (
  ok INTEGER NOT NULL,
  CONSTRAINT jlpt_oct_nov_20_planned_words_each_day CHECK(ok=1)
);
WITH RECURSIVE days(d) AS (
 SELECT date('2026-10-01')
 UNION ALL SELECT date(d,'+1 day') FROM days WHERE d<'2026-11-30'
), plans AS (
 SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL' AND is_active=1
)
INSERT INTO _assert_jlpt_octnov_words_0062(ok)
SELECT CASE WHEN NOT EXISTS(
 SELECT 1 FROM days CROSS JOIN plans p
 WHERE
   (SELECT COUNT(*)
    FROM japanese_jlpt_daily_sessions ds
    JOIN japanese_jlpt_daily_words dw ON dw.session_id=ds.id
    WHERE ds.plan_id=p.id AND ds.study_date=days.d)<>20
   OR
   COALESCE((SELECT ds.review_target+ds.new_word_target
    FROM japanese_jlpt_daily_sessions ds
    WHERE ds.plan_id=p.id AND ds.study_date=days.d),0)<>20
) THEN 1 ELSE 0 END;
DROP TABLE _assert_jlpt_octnov_words_0062;

-- Integrity check 2: full problem package on every date.
CREATE TABLE _assert_jlpt_octnov_contents_0062 (
  ok INTEGER NOT NULL,
  CONSTRAINT jlpt_oct_nov_full_contents_each_day CHECK(ok=1)
);
WITH RECURSIVE days(d) AS (
 SELECT date('2026-10-01')
 UNION ALL SELECT date(d,'+1 day') FROM days WHERE d<'2026-11-30'
), plans AS (
 SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL' AND is_active=1
)
INSERT INTO _assert_jlpt_octnov_contents_0062(ok)
SELECT CASE WHEN NOT EXISTS(
 SELECT 1 FROM days CROSS JOIN plans p WHERE
  (SELECT COUNT(*) FROM japanese_jlpt_daily_contents x WHERE x.plan_id=p.id AND x.study_date=days.d AND x.content_type='vocab_question')<>15 OR
  (SELECT COUNT(*) FROM japanese_jlpt_daily_contents x WHERE x.plan_id=p.id AND x.study_date=days.d AND x.content_type='grammar')<>2 OR
  (SELECT COUNT(*) FROM japanese_jlpt_daily_contents x WHERE x.plan_id=p.id AND x.study_date=days.d AND x.content_type='grammar_question')<>3 OR
  (SELECT COUNT(*) FROM japanese_jlpt_daily_contents x WHERE x.plan_id=p.id AND x.study_date=days.d AND x.content_type='reading')<>1
) THEN 1 ELSE 0 END;
DROP TABLE _assert_jlpt_octnov_contents_0062;

DROP TABLE _jlpt_octnov_schedule_0062;
