-- 0067_jlpt_calendar_words_repair.sql
-- Repair prepared JLPT calendar/session vocabulary after 0065.
--
-- Goals:
--   * September prepared days have real daily sessions/daily_words so calendar state exists.
--   * 2026-12-01..2027-02-28 uses the full registered vocabulary pool, preferring words
--     not yet enrolled in the N1 plan, instead of rotating only the small N1 subset.
--   * First-time scheduled words are enrolled in japanese_jlpt_curriculum_words with the
--     actual scheduled date so future-date memorization/archive reads can see them.
--   * Vocabulary questions are rebuilt from the repaired 20-word schedule.
--
-- D1 read budget: all validation is bounded to temporary schedule tables / one date range.
-- No per-day correlated COUNT/EXISTS validation loops are used.
PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- 1) Backfill September daily sessions from the curated curriculum dates.
-- -----------------------------------------------------------------------------
INSERT OR IGNORE INTO japanese_jlpt_daily_sessions(
  plan_id,study_date,review_target,new_word_target,
  vocab_question_target,grammar_target,reading_target,status
)
SELECT c.plan_id,c.introduced_on,0,COUNT(*),15,2,1,'not_started'
FROM japanese_jlpt_curriculum_words c
JOIN japanese_jlpt_study_plans p ON p.id=c.plan_id
WHERE p.plan_code='N1_2027_JUL' AND p.is_active=1
  AND c.introduced_on BETWEEN '2026-09-07' AND '2026-09-30'
GROUP BY c.plan_id,c.introduced_on;

INSERT OR IGNORE INTO japanese_jlpt_daily_words(session_id,word_id,item_kind,status,state_before,state_after)
SELECT s.id,c.word_id,'new','pending',NULL,NULL
FROM japanese_jlpt_curriculum_words c
JOIN japanese_jlpt_daily_sessions s
  ON s.plan_id=c.plan_id AND s.study_date=c.introduced_on
JOIN japanese_jlpt_study_plans p ON p.id=c.plan_id
WHERE p.plan_code='N1_2027_JUL' AND p.is_active=1
  AND c.introduced_on BETWEEN '2026-09-07' AND '2026-09-30';

-- -----------------------------------------------------------------------------
-- 2) Build a deterministic Dec-Feb schedule from the full vocabulary DB.
--    Unused words come first; after the pool is exhausted, rows become planned review.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS _jlpt_0067_pool;
CREATE TABLE _jlpt_0067_pool(
  plan_id INTEGER NOT NULL,
  word_id INTEGER NOT NULL,
  already_in_plan INTEGER NOT NULL,
  rn INTEGER NOT NULL,
  pool_count INTEGER NOT NULL,
  word TEXT NOT NULL,
  reading TEXT,
  meaning_ko TEXT NOT NULL,
  PRIMARY KEY(plan_id,rn),
  UNIQUE(plan_id,word_id)
);

INSERT INTO _jlpt_0067_pool(plan_id,word_id,already_in_plan,rn,pool_count,word,reading,meaning_ko)
SELECT
  p.id,
  w.id,
  CASE WHEN c.word_id IS NULL THEN 0 ELSE 1 END,
  ROW_NUMBER() OVER(
    PARTITION BY p.id
    ORDER BY
      CASE WHEN c.word_id IS NULL THEN 0 ELSE 1 END,
      CASE COALESCE(l.code,'')
        WHEN 'N1' THEN 0 WHEN 'N2' THEN 1 WHEN '' THEN 2
        WHEN 'N3' THEN 3 WHEN 'N4' THEN 4 WHEN 'N5' THEN 5 ELSE 6 END,
      CASE WHEN NULLIF(TRIM(COALESCE(w.reading,'')),'') IS NOT NULL THEN 0 ELSE 1 END,
      CASE WHEN NULLIF(TRIM(COALESCE(w.meaning_ko,'')),'') IS NOT NULL THEN 0 ELSE 1 END,
      w.id
  ),
  COUNT(*) OVER(PARTITION BY p.id),
  w.word,
  w.reading,
  COALESCE(NULLIF(TRIM(w.meaning_ko),''),NULLIF(TRIM(w.meaning_ja),''),'뜻 확인')
FROM japanese_jlpt_study_plans p
JOIN japanese_words w
  ON w.deleted_at IS NULL AND NULLIF(TRIM(w.word),'') IS NOT NULL
LEFT JOIN jlpt_levels l ON l.id=w.jlpt_level_id
LEFT JOIN japanese_jlpt_curriculum_words c ON c.plan_id=p.id AND c.word_id=w.id
WHERE p.plan_code='N1_2027_JUL' AND p.is_active=1;

CREATE TABLE _assert_jlpt_0067_pool(
  ok INTEGER NOT NULL,
  CONSTRAINT jlpt_0067_pool_at_least_20 CHECK(ok=1)
);
INSERT INTO _assert_jlpt_0067_pool(ok)
SELECT CASE WHEN COUNT(*)>=20 THEN 1 ELSE 0 END FROM _jlpt_0067_pool;
DROP TABLE _assert_jlpt_0067_pool;

DROP TABLE IF EXISTS _jlpt_0067_schedule;
CREATE TABLE _jlpt_0067_schedule(
  plan_id INTEGER NOT NULL,
  study_date TEXT NOT NULL,
  day_no INTEGER NOT NULL,
  slot_no INTEGER NOT NULL,
  word_id INTEGER NOT NULL,
  item_kind TEXT NOT NULL CHECK(item_kind IN ('new','review')),
  word TEXT NOT NULL,
  reading TEXT,
  meaning_ko TEXT NOT NULL,
  PRIMARY KEY(plan_id,study_date,slot_no),
  UNIQUE(plan_id,study_date,word_id)
);

WITH RECURSIVE
  days(d,n) AS (
    SELECT date('2026-12-01'),0
    UNION ALL SELECT date(d,'+1 day'),n+1 FROM days WHERE d<'2027-02-28'
  ),
  slots(n) AS (
    SELECT 1 UNION ALL SELECT n+1 FROM slots WHERE n<20
  ),
  meta AS (
    SELECT plan_id,MAX(pool_count) AS pool_count
    FROM _jlpt_0067_pool
    GROUP BY plan_id
  )
INSERT INTO _jlpt_0067_schedule(
  plan_id,study_date,day_no,slot_no,word_id,item_kind,word,reading,meaning_ko
)
SELECT
  m.plan_id,d.d,d.n,s.n,x.word_id,
  CASE
    WHEN x.already_in_plan=0 AND (d.n*20+s.n)<=m.pool_count THEN 'new'
    ELSE 'review'
  END,
  x.word,x.reading,x.meaning_ko
FROM meta m
CROSS JOIN days d
CROSS JOIN slots s
JOIN _jlpt_0067_pool x
  ON x.plan_id=m.plan_id
 AND x.rn=((d.n*20+s.n-1)%m.pool_count)+1;

DROP TABLE IF EXISTS _jlpt_0067_counts;
CREATE TABLE _jlpt_0067_counts AS
SELECT
  plan_id,study_date,
  COUNT(*) AS total,
  SUM(CASE WHEN item_kind='new' THEN 1 ELSE 0 END) AS new_count,
  SUM(CASE WHEN item_kind='review' THEN 1 ELSE 0 END) AS review_count
FROM _jlpt_0067_schedule
GROUP BY plan_id,study_date;
CREATE UNIQUE INDEX idx_jlpt_0067_counts ON _jlpt_0067_counts(plan_id,study_date);

CREATE TABLE _assert_jlpt_0067_schedule(
  ok INTEGER NOT NULL,
  CONSTRAINT jlpt_0067_twenty_per_day CHECK(ok=1)
);
INSERT INTO _assert_jlpt_0067_schedule(ok)
SELECT CASE WHEN COUNT(*)=90 AND MIN(total)=20 AND MAX(total)=20 THEN 1 ELSE 0 END
FROM _jlpt_0067_counts;
DROP TABLE _assert_jlpt_0067_schedule;

-- Remove the incorrect 0065 daily-word assignment before rebuilding it.
DELETE FROM japanese_jlpt_daily_words
WHERE session_id IN (
  SELECT s.id
  FROM japanese_jlpt_daily_sessions s
  JOIN japanese_jlpt_study_plans p ON p.id=s.plan_id
  WHERE p.plan_code='N1_2027_JUL' AND p.is_active=1
    AND s.study_date BETWEEN '2026-12-01' AND '2027-02-28'
);

-- Enroll only first-time scheduled words. One pass over the temporary schedule determines
-- both their curriculum order and their true first study date.
WITH base AS (
  SELECT p.id AS plan_id,COALESCE(MAX(c.sort_order),0) AS base_order
  FROM japanese_jlpt_study_plans p
  LEFT JOIN japanese_jlpt_curriculum_words c ON c.plan_id=p.id
  WHERE p.plan_code='N1_2027_JUL' AND p.is_active=1
  GROUP BY p.id
), first_new AS (
  SELECT
    s.plan_id,s.word_id,
    MIN(s.study_date) AS introduced_on,
    MIN(s.day_no*20+s.slot_no) AS first_pos
  FROM _jlpt_0067_schedule s
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
FROM ranked r
JOIN base b ON b.plan_id=r.plan_id;

-- Keep one prepared session per day and set targets from the schedule in one grouped pass.
INSERT INTO japanese_jlpt_daily_sessions(
  plan_id,study_date,review_target,new_word_target,
  vocab_question_target,grammar_target,reading_target,status
)
SELECT plan_id,study_date,review_count,new_count,15,2,1,'not_started'
FROM _jlpt_0067_counts
WHERE 1=1
ON CONFLICT(plan_id,study_date) DO UPDATE SET
  review_target=excluded.review_target,
  new_word_target=excluded.new_word_target,
  vocab_question_target=15,
  grammar_target=2,
  reading_target=1;

INSERT OR IGNORE INTO japanese_jlpt_daily_words(
  session_id,word_id,item_kind,status,state_before,state_after
)
SELECT ds.id,s.word_id,s.item_kind,'pending',NULL,NULL
FROM _jlpt_0067_schedule s
JOIN japanese_jlpt_daily_sessions ds
  ON ds.plan_id=s.plan_id AND ds.study_date=s.study_date;

-- -----------------------------------------------------------------------------
-- 3) Rebuild 15 vocabulary questions/day from the repaired schedule.
--    Grammar/reading prepared by 0065 stay intact.
-- -----------------------------------------------------------------------------
DELETE FROM japanese_jlpt_daily_contents
WHERE plan_id IN (
  SELECT id FROM japanese_jlpt_study_plans
  WHERE plan_code='N1_2027_JUL' AND is_active=1
)
  AND study_date BETWEEN '2026-12-01' AND '2027-02-28'
  AND content_type='vocab_question';

INSERT INTO japanese_jlpt_daily_contents(
  plan_id,study_date,content_type,sequence_no,title,payload_json
)
SELECT x.plan_id,x.study_date,'vocab_question',x.slot_no,
  '文字・語彙：'||CASE ((x.slot_no-1)%5)
    WHEN 0 THEN '漢字読み'
    WHEN 1 THEN '表記'
    WHEN 2 THEN '文脈規定'
    WHEN 3 THEN '言い換え類義'
    ELSE '用法確認' END,
  CASE ((x.slot_no-1)%5)
    WHEN 0 THEN json_object(
      'prompt','「'||x.word||'」の読み方として最も適切なものを選びなさい。',
      'options',json_array(COALESCE(x.reading,x.word),COALESCE(y1.reading,y1.word),COALESCE(y2.reading,y2.word),COALESCE(y3.reading,y3.word)),
      'answer',COALESCE(x.reading,x.word),
      'explanation','「'||x.word||'」の読みは「'||COALESCE(x.reading,'—')||'」。意味は「'||x.meaning_ko||'」。')
    WHEN 1 THEN json_object(
      'prompt','「'||COALESCE(x.reading,x.word)||'」と読む語として最も適切なものを選びなさい。',
      'options',json_array(x.word,y1.word,y2.word,y3.word),
      'answer',x.word,
      'explanation','正しい表記は「'||x.word||'」。')
    WHEN 2 THEN json_object(
      'prompt','次の意味に最も近い語を選びなさい：「'||x.meaning_ko||'」',
      'options',json_array(x.word,y4.word,y7.word,y10.word),
      'answer',x.word,
      'explanation','文脈上の意味に対応する語は「'||x.word||'」。')
    WHEN 3 THEN json_object(
      'prompt','「'||x.word||'」の意味として最も近いものを選びなさい。',
      'options',json_array(x.meaning_ko,y3.meaning_ko,y6.meaning_ko,y9.meaning_ko),
      'answer',x.meaning_ko,
      'explanation','「'||x.word||'」の意味は「'||x.meaning_ko||'」。')
    ELSE json_object(
      'prompt','「'||x.word||'」について、読みと意味の組合せとして最も適切なものを選びなさい。',
      'options',json_array(
        COALESCE(x.reading,'—')||' / '||x.meaning_ko,
        COALESCE(x.reading,'—')||' / '||y1.meaning_ko,
        COALESCE(y2.reading,'—')||' / '||x.meaning_ko,
        COALESCE(y3.reading,'—')||' / '||y3.meaning_ko
      ),
      'answer',COALESCE(x.reading,'—')||' / '||x.meaning_ko,
      'explanation','読みと意味を同時に確認する。')
  END
FROM _jlpt_0067_schedule x
JOIN _jlpt_0067_schedule y1 ON y1.plan_id=x.plan_id AND y1.study_date=x.study_date AND y1.slot_no=((x.slot_no)%20)+1
JOIN _jlpt_0067_schedule y2 ON y2.plan_id=x.plan_id AND y2.study_date=x.study_date AND y2.slot_no=((x.slot_no+1)%20)+1
JOIN _jlpt_0067_schedule y3 ON y3.plan_id=x.plan_id AND y3.study_date=x.study_date AND y3.slot_no=((x.slot_no+2)%20)+1
JOIN _jlpt_0067_schedule y4 ON y4.plan_id=x.plan_id AND y4.study_date=x.study_date AND y4.slot_no=((x.slot_no+3)%20)+1
JOIN _jlpt_0067_schedule y6 ON y6.plan_id=x.plan_id AND y6.study_date=x.study_date AND y6.slot_no=((x.slot_no+5)%20)+1
JOIN _jlpt_0067_schedule y7 ON y7.plan_id=x.plan_id AND y7.study_date=x.study_date AND y7.slot_no=((x.slot_no+6)%20)+1
JOIN _jlpt_0067_schedule y9 ON y9.plan_id=x.plan_id AND y9.study_date=x.study_date AND y9.slot_no=((x.slot_no+8)%20)+1
JOIN _jlpt_0067_schedule y10 ON y10.plan_id=x.plan_id AND y10.study_date=x.study_date AND y10.slot_no=((x.slot_no+9)%20)+1
WHERE x.slot_no<=15;

DROP TABLE _jlpt_0067_counts;
DROP TABLE _jlpt_0067_schedule;
DROP TABLE _jlpt_0067_pool;
