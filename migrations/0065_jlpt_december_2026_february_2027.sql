-- 0065_jlpt_december_2026_february_2027.sql
-- Prepare JLPT N1 daily study for 2026-12-01 through 2027-02-28.
-- 20 scheduled words + 15 vocab questions + 2 grammar lessons + 3 grammar questions + 1 reading set/day.
-- Cost note: option lookup uses indexed self-joins and validation aggregates each target table once.

DROP TABLE IF EXISTS _jlpt_dec_feb_0065;
CREATE TABLE _jlpt_dec_feb_0065 (
  plan_id INTEGER NOT NULL,
  study_date TEXT NOT NULL,
  day_no INTEGER NOT NULL,
  slot_no INTEGER NOT NULL,
  word_id INTEGER NOT NULL,
  word TEXT NOT NULL,
  reading TEXT,
  meaning_ko TEXT,
  PRIMARY KEY(plan_id,study_date,slot_no)
);

WITH RECURSIVE
  days(d,n) AS (
    SELECT date('2026-12-01'),0
    UNION ALL SELECT date(d,'+1 day'),n+1 FROM days WHERE d<'2027-02-28'
  ),
  slots(n) AS (
    SELECT 1 UNION ALL SELECT n+1 FROM slots WHERE n<20
  ),
  plans AS (
    SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL' AND is_active=1
  ),
  pool0 AS (
    SELECT p.id AS plan_id,w.id AS word_id,w.word,w.reading,
           COALESCE(NULLIF(w.meaning_ko,''),NULLIF(w.meaning_ja,''),'뜻 확인') AS meaning_ko,
           ROW_NUMBER() OVER(PARTITION BY p.id ORDER BY
             CASE WHEN c.word_id IS NOT NULL THEN 0 ELSE 1 END,
             COALESCE(c.sort_order,999999),w.id) AS rn,
           COUNT(*) OVER(PARTITION BY p.id) AS pool_count
    FROM plans p
    JOIN japanese_jlpt_study_plans sp ON sp.id=p.id
    JOIN jlpt_levels l ON l.code=sp.jlpt_level_code
    JOIN japanese_words w ON w.jlpt_level_id=l.id AND w.deleted_at IS NULL
    LEFT JOIN japanese_jlpt_curriculum_words c ON c.plan_id=p.id AND c.word_id=w.id
  )
INSERT INTO _jlpt_dec_feb_0065(plan_id,study_date,day_no,slot_no,word_id,word,reading,meaning_ko)
SELECT p.id,d.d,d.n,s.n,x.word_id,x.word,x.reading,x.meaning_ko
FROM plans p CROSS JOIN days d CROSS JOIN slots s
JOIN pool0 x ON x.plan_id=p.id
 AND x.rn=((d.n*20+s.n-1)%x.pool_count)+1;

CREATE TABLE _assert_jlpt_pool_0065(ok INTEGER NOT NULL,CONSTRAINT jlpt_dec_feb_pool_at_least_20 CHECK(ok=1));
INSERT INTO _assert_jlpt_pool_0065(ok)
SELECT CASE WHEN (SELECT COUNT(DISTINCT word_id) FROM _jlpt_dec_feb_0065)>=20 THEN 1 ELSE 0 END;
DROP TABLE _assert_jlpt_pool_0065;

INSERT OR IGNORE INTO japanese_jlpt_daily_sessions(
  plan_id,study_date,review_target,new_word_target,vocab_question_target,grammar_target,reading_target,
  review_completed,new_word_completed,vocab_question_completed,grammar_completed,reading_completed,status
)
SELECT DISTINCT plan_id,study_date,0,20,15,2,1,0,0,0,0,0,'not_started'
FROM _jlpt_dec_feb_0065;

INSERT OR IGNORE INTO japanese_jlpt_daily_words(session_id,word_id,item_kind,status,state_before,state_after)
SELECT s.id,x.word_id,'new','pending',NULL,NULL
FROM _jlpt_dec_feb_0065 x
JOIN japanese_jlpt_daily_sessions s ON s.plan_id=x.plan_id AND s.study_date=x.study_date;

DELETE FROM japanese_jlpt_daily_contents
WHERE plan_id IN (SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL')
  AND study_date BETWEEN '2026-12-01' AND '2027-02-28';

-- Vocabulary: 15/day, rotating through official-style task families.
INSERT INTO japanese_jlpt_daily_contents(plan_id,study_date,content_type,sequence_no,title,payload_json)
SELECT x.plan_id,x.study_date,'vocab_question',x.slot_no,
  '文字・語彙：'||CASE ((x.slot_no-1)%5)
    WHEN 0 THEN '漢字読み' WHEN 1 THEN '表記' WHEN 2 THEN '文脈規定' WHEN 3 THEN '言い換え類義' ELSE '用法確認' END,
  CASE ((x.slot_no-1)%5)
    WHEN 0 THEN json_object(
      'prompt','「'||x.word||'」の読み方として最も適切なものを選びなさい。',
      'options',json_array(COALESCE(x.reading,x.word),
        COALESCE(y1.reading,x.word),COALESCE(y2.reading,x.word),COALESCE(y3.reading,x.word)),
      'answer',COALESCE(x.reading,x.word),
      'explanation','「'||x.word||'」の読みは「'||COALESCE(x.reading,'—')||'」。意味は「'||x.meaning_ko||'」。')
    WHEN 1 THEN json_object(
      'prompt','「'||COALESCE(x.reading,x.word)||'」と読む語として最も適切なものを選びなさい。',
      'options',json_array(x.word,
        y1.word,y2.word,y3.word),
      'answer',x.word,'explanation','正しい表記は「'||x.word||'」。')
    WHEN 2 THEN json_object(
      'prompt','次の意味に最も近い語を選びなさい：「'||x.meaning_ko||'」',
      'options',json_array(x.word,
        y4.word,y7.word,y10.word),
      'answer',x.word,'explanation','文脈上の意味に対応する語は「'||x.word||'」。')
    WHEN 3 THEN json_object(
      'prompt','「'||x.word||'」の意味として最も近いものを選びなさい。',
      'options',json_array(x.meaning_ko,
        y3.meaning_ko,y6.meaning_ko,y9.meaning_ko),
      'answer',x.meaning_ko,'explanation','「'||x.word||'」の意味は「'||x.meaning_ko||'」。')
    ELSE json_object(
      'prompt','「'||x.word||'」について、読みと意味の組合せとして最も適切なものを選びなさい。',
      'options',json_array(COALESCE(x.reading,'—')||' / '||x.meaning_ko,
        COALESCE(x.reading,'—')||' / 다른 의미',
        COALESCE(y2.reading,'—')||' / '||x.meaning_ko,
        COALESCE(y3.reading,'—')||' / 다른 의미'),
      'answer',COALESCE(x.reading,'—')||' / '||x.meaning_ko,
      'explanation','読みと意味を同時に確認する。') END
FROM _jlpt_dec_feb_0065 x
JOIN _jlpt_dec_feb_0065 y1 ON y1.plan_id=x.plan_id AND y1.study_date=x.study_date AND y1.slot_no=((x.slot_no)%20)+1
JOIN _jlpt_dec_feb_0065 y2 ON y2.plan_id=x.plan_id AND y2.study_date=x.study_date AND y2.slot_no=((x.slot_no+1)%20)+1
JOIN _jlpt_dec_feb_0065 y3 ON y3.plan_id=x.plan_id AND y3.study_date=x.study_date AND y3.slot_no=((x.slot_no+2)%20)+1
JOIN _jlpt_dec_feb_0065 y4 ON y4.plan_id=x.plan_id AND y4.study_date=x.study_date AND y4.slot_no=((x.slot_no+3)%20)+1
JOIN _jlpt_dec_feb_0065 y6 ON y6.plan_id=x.plan_id AND y6.study_date=x.study_date AND y6.slot_no=((x.slot_no+5)%20)+1
JOIN _jlpt_dec_feb_0065 y7 ON y7.plan_id=x.plan_id AND y7.study_date=x.study_date AND y7.slot_no=((x.slot_no+6)%20)+1
JOIN _jlpt_dec_feb_0065 y9 ON y9.plan_id=x.plan_id AND y9.study_date=x.study_date AND y9.slot_no=((x.slot_no+8)%20)+1
JOIN _jlpt_dec_feb_0065 y10 ON y10.plan_id=x.plan_id AND y10.study_date=x.study_date AND y10.slot_no=((x.slot_no+9)%20)+1
WHERE x.slot_no<=15;

-- Two grammar lessons/day. 60 N1 patterns rotate through the period.
WITH RECURSIVE days(d,n) AS (
  SELECT date('2026-12-01'),0 UNION ALL SELECT date(d,'+1 day'),n+1 FROM days WHERE d<'2027-02-28'
), patterns(seq,pattern,meaning_ko) AS (VALUES
 (0,'〜あっての','〜이 있어야 비로소'),(1,'〜いかんでは','〜여하에 따라서는'),(2,'〜いかんにかかわらず','〜여하에 관계없이'),(3,'〜ずくめ','온통 〜뿐'),
 (4,'〜ずにはおかない','반드시 〜하게 만들다'),(5,'〜ずにはすまない','〜하지 않고는 끝나지 않다'),(6,'〜そばから','〜하자마자 곧'),(7,'〜たが最後','〜했다 하면 끝장이다'),
 (8,'〜たところで','〜해 보아도'),(9,'〜だに','〜하기만 해도'),(10,'〜たりとも','단 하나라도'),(11,'〜であれ','〜라 할지라도'),
 (12,'〜てからというもの','〜하고 나서부터 줄곧'),(13,'〜てやまない','진심으로 계속 〜하다'),(14,'〜とあって','〜라는 특별한 상황이라'),(15,'〜とあれば','〜라면'),
 (16,'〜といい〜といい','〜도 그렇고 〜도 그렇고'),(17,'〜といえども','〜라 할지라도'),(18,'〜ときたら','〜라고 하면'),(19,'〜ところを','〜한 상황인데도'),
 (20,'〜ともなく','딱히 〜하려 한 것도 아닌데'),(21,'〜ともなると','〜정도가 되면'),(22,'〜ないまでも','〜까지는 아니더라도'),(23,'〜ないものでもない','〜하지 못할 것도 없다'),
 (24,'〜ながらに','〜인 채로'),(25,'〜なくして','〜없이는'),(26,'〜ならでは','〜이기에 가능한'),(27,'〜なり','〜하자마자'),
 (28,'〜にあって','〜한 상황에서'),(29,'〜に至って','〜에 이르러서'),(30,'〜に至るまで','〜에 이르기까지'),(31,'〜にかたくない','쉽게 〜할 수 있다'),
 (32,'〜にかまけて','〜에 정신이 팔려'),(33,'〜にして','〜에 이르러서야'),(34,'〜に即して','〜에 입각하여'),(35,'〜にたえる','〜할 가치가 있다'),
 (36,'〜に足る','〜할 만하다'),(37,'〜にひきかえ','〜와는 대조적으로'),(38,'〜にもまして','〜보다도 더욱'),(39,'〜の極み','〜의 극치'),
 (40,'〜の至り','더없이 〜함'),(41,'〜ばこそ','바로 〜이기 때문에'),(42,'〜べからず','〜해서는 안 된다'),(43,'〜べく','〜하기 위해'),
 (44,'〜べくもない','도저히 〜할 수 없다'),(45,'〜まじき','〜해서는 안 될'),(46,'〜までだ','그저 〜할 뿐이다'),(47,'〜までもない','〜할 필요도 없다'),
 (48,'〜まみれ','온통 〜투성이'),(49,'〜めく','〜다운 분위기가 나다'),(50,'〜もさることながら','〜도 물론이지만'),(51,'〜ものを','〜했더라면 좋았을 텐데'),
 (52,'〜や否や','〜하자마자'),(53,'〜ゆえに','〜이기 때문에'),(54,'〜ようが〜まいが','〜하든 말든'),(55,'〜をおいて','〜을 제외하고는'),
 (56,'〜を皮切りに','〜을 시작으로'),(57,'〜を禁じ得ない','〜을 금할 수 없다'),(58,'〜をものともせず','〜을 아랑곳하지 않고'),(59,'〜んがため','〜하기 위하여')
), plans AS (SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL' AND is_active=1), seqs(s) AS (VALUES(1),(2))
INSERT INTO japanese_jlpt_daily_contents(plan_id,study_date,content_type,sequence_no,title,payload_json)
SELECT p.id,d.d,'grammar',s.s,'文法：'||g.pattern,
 json_object('pattern',g.pattern,'meaning_ko',g.meaning_ko,
   'explanation_ja','接続・意味・使用場面を例文と一緒に確認する。似たN1表現との違いにも注意する。',
   'explanation_ko',g.meaning_ko||'의 의미, 접속, 사용 장면을 함께 익힌다.')
FROM days d CROSS JOIN plans p CROSS JOIN seqs s
JOIN patterns g ON g.seq=((d.n*2+s.s-1)%60);

-- Three grammar questions/day using that day's two lessons plus nearby real N1 patterns.
WITH g AS (
 SELECT plan_id,study_date,
  MAX(CASE WHEN sequence_no=1 THEN json_extract(payload_json,'$.pattern') END) p1,
  MAX(CASE WHEN sequence_no=2 THEN json_extract(payload_json,'$.pattern') END) p2,
  MAX(CASE WHEN sequence_no=1 THEN json_extract(payload_json,'$.meaning_ko') END) m1,
  MAX(CASE WHEN sequence_no=2 THEN json_extract(payload_json,'$.meaning_ko') END) m2
 FROM japanese_jlpt_daily_contents
 WHERE content_type='grammar' AND study_date BETWEEN '2026-12-01' AND '2027-02-28'
 GROUP BY plan_id,study_date
)
INSERT INTO japanese_jlpt_daily_contents(plan_id,study_date,content_type,sequence_no,title,payload_json)
SELECT plan_id,study_date,'grammar_question',1,'文法形式',json_object(
 'prompt','この日のN1文法のうち、意味「'||m1||'」に対応するものを選びなさい。',
 'options',json_array(p1,p2,'〜にひきかえ','〜をものともせず'),'answer',p1,
 'explanation','正解は「'||p1||'」。意味は「'||m1||'」。') FROM g
UNION ALL SELECT plan_id,study_date,'grammar_question',2,'意味・用法',json_object(
 'prompt','意味「'||m2||'」に最も合うN1文法を選びなさい。',
 'options',json_array(p2,p1,'〜ともなると','〜までもない'),'answer',p2,
 'explanation','正解は「'||p2||'」。意味は「'||m2||'」。') FROM g
UNION ALL SELECT plan_id,study_date,'grammar_question',3,'文章の文法',json_object(
 'prompt','文章の流れの中で、この日に学んだ文法として確認すべき表現を選びなさい。',
 'options',json_array(p1,'〜べくもない',p2,'〜ないまでも'),'answer',p1,
 'explanation','この日の第1文法「'||p1||'」の意味と接続を文章内で確認する。') FROM g;

-- One reading set/day with date-varying theme and 3 questions.
WITH RECURSIVE days(d,n) AS (
 SELECT date('2026-12-01'),0 UNION ALL SELECT date(d,'+1 day'),n+1 FROM days WHERE d<'2027-02-28'
), plans AS (SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL' AND is_active=1), base AS (
 SELECT p.id plan_id,d.d,d.n,
  CASE (d.n%12) WHEN 0 THEN '働き方' WHEN 1 THEN '地域交通' WHEN 2 THEN '教育' WHEN 3 THEN '情報共有' WHEN 4 THEN '環境対策' WHEN 5 THEN '医療福祉' WHEN 6 THEN '観光' WHEN 7 THEN 'AI' WHEN 8 THEN '防災' WHEN 9 THEN '公共施設' WHEN 10 THEN '消費行動' ELSE '組織運営' END theme,
  CASE (d.n%9) WHEN 0 THEN '効率だけでなく負担の移動にも目を向ける必要がある。' WHEN 1 THEN '短期的な成果と長期的な持続性は分けて考えるべきだ。' WHEN 2 THEN '利用した人だけでなく利用しなかった人の理由も重要である。' WHEN 3 THEN '一律の運用が常に公平だとは限らない。' WHEN 4 THEN '導入前の状態を残さなければ効果を正確に比べにくい。' WHEN 5 THEN '選択肢の増加は自由と同時に判断負担も増やす。' WHEN 6 THEN '専門家の説明可能性が信頼につながる。' WHEN 7 THEN '事後対応だけでなく問題が起きにくい設計も重要だ。' ELSE '成功例を一般化する前に条件を切り分ける必要がある。' END logic
 FROM days d CROSS JOIN plans p
), r AS (
 SELECT *, '「'||theme||'」について考えるとき、目に見える成果だけで結論を出すのは危険である。'||logic||' ある変更で一部の作業時間が減っても、準備や確認の負担が別の人に移れば、全体として改善したとは言い切れない。また、導入直後と利用者が慣れた後では評価が変わることもある。したがって、異なる時点・立場・条件を比較し、なぜ変化したのかを確認することが重要である。情報を多く集めること自体が目的なのではなく、何を比較し、どの根拠を残すかを明確にすることが良い判断につながる。' passage FROM base
)
INSERT INTO japanese_jlpt_daily_contents(plan_id,study_date,content_type,sequence_no,title,payload_json)
SELECT plan_id,d,'reading',1,'読解：'||theme||'（'||d||'）',json_object(
 'passage',passage,
 'questions',json_array(
   json_object('prompt','筆者の主張として最も適切なものはどれか。','options',json_array('異なる時点・立場・条件を比較して判断する必要がある','情報は多いほど必ず正確になる','導入直後の評価だけで十分である','すべての制度は一律に運用すべきだ'),'answer','異なる時点・立場・条件を比較して判断する必要がある','explanation','本文の中心は複数条件を比較し変化の理由を確認することにある。'),
   json_object('prompt','一部の作業時間が減っても改善したと言い切れない理由は何か。','options',json_array('別の人に準備や確認の負担が移る可能性があるから','作業時間は評価に使えないから','利用者は変化に慣れないから','改善は数字で確認できないから'),'answer','別の人に準備や確認の負担が移る可能性があるから','explanation','本文は見えにくい負担の移動を確認する必要を述べている。'),
   json_object('prompt','本文の内容と合うものはどれか。','options',json_array('導入直後と慣れた後の評価が変わることもある','導入直後の反応だけが最も重要だ','成功例は条件を確認せず一般化できる','根拠を残す必要はない'),'answer','導入直後と慣れた後の評価が変わることもある','explanation','本文に異なる時点の比較が必要だと明記されている。')
 )) FROM r;

DROP TABLE IF EXISTS _jlpt_dec_feb_counts_0065;
CREATE TABLE _jlpt_dec_feb_counts_0065 (
  plan_id INTEGER NOT NULL,
  study_date TEXT NOT NULL,
  new_words INTEGER NOT NULL,
  vocab_questions INTEGER NOT NULL,
  grammar_lessons INTEGER NOT NULL,
  grammar_questions INTEGER NOT NULL,
  readings INTEGER NOT NULL,
  reading_questions INTEGER NOT NULL,
  PRIMARY KEY(plan_id,study_date)
);

INSERT INTO _jlpt_dec_feb_counts_0065
SELECT e.plan_id,e.study_date,
       COALESCE(w.new_words,0),
       COALESCE(c.vocab_questions,0),
       COALESCE(c.grammar_lessons,0),
       COALESCE(c.grammar_questions,0),
       COALESCE(c.readings,0),
       COALESCE(c.reading_questions,0)
FROM (SELECT DISTINCT plan_id,study_date FROM _jlpt_dec_feb_0065) e
LEFT JOIN (
  SELECT s.plan_id,s.study_date,COUNT(*) AS new_words
  FROM japanese_jlpt_daily_sessions s
  JOIN japanese_jlpt_daily_words w ON w.session_id=s.id AND w.item_kind='new'
  WHERE s.study_date BETWEEN '2026-12-01' AND '2027-02-28'
  GROUP BY s.plan_id,s.study_date
) w ON w.plan_id=e.plan_id AND w.study_date=e.study_date
LEFT JOIN (
  SELECT plan_id,study_date,
         SUM(content_type='vocab_question') AS vocab_questions,
         SUM(content_type='grammar') AS grammar_lessons,
         SUM(content_type='grammar_question') AS grammar_questions,
         SUM(content_type='reading') AS readings,
         SUM(CASE WHEN content_type='reading' THEN COALESCE(json_array_length(json_extract(payload_json,'$.questions')),0) ELSE 0 END) AS reading_questions
  FROM japanese_jlpt_daily_contents
  WHERE study_date BETWEEN '2026-12-01' AND '2027-02-28'
  GROUP BY plan_id,study_date
) c ON c.plan_id=e.plan_id AND c.study_date=e.study_date;

CREATE TABLE _assert_jlpt_dec_feb_0065(ok INTEGER NOT NULL,CONSTRAINT jlpt_dec_feb_daily_complete CHECK(ok=1));
INSERT INTO _assert_jlpt_dec_feb_0065(ok)
SELECT CASE WHEN COUNT(*)=0 THEN 1 ELSE 0 END
FROM _jlpt_dec_feb_counts_0065
WHERE new_words<>20 OR vocab_questions<>15 OR grammar_lessons<>2
   OR grammar_questions<>3 OR readings<>1 OR reading_questions<>3;
DROP TABLE _assert_jlpt_dec_feb_0065;
DROP TABLE _jlpt_dec_feb_counts_0065;
DROP TABLE _jlpt_dec_feb_0065;
