-- 0064_jlpt_unique_practice_202609_202611.sql
-- Improve 2026-09-07..2026-11-30 JLPT practice quality without touching word progress.
-- D1-safe version: no correlated OFFSET expressions.

DELETE FROM japanese_jlpt_daily_contents
WHERE plan_id IN (SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL')
  AND study_date BETWEEN '2026-09-07' AND '2026-11-30'
  AND content_type IN ('grammar_question','reading');

-- Three grammar questions per day.
-- Distractors come from grammar lessons on nearby dates, so every choice is an actual N1 pattern.
WITH RECURSIVE days(d,n) AS (
  SELECT date('2026-09-07'),0
  UNION ALL SELECT date(d,'+1 day'),n+1 FROM days WHERE d<'2026-11-30'
), plans AS (
  SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL' AND is_active=1
), grammar_pool AS (
  SELECT x.plan_id,x.study_date,x.sequence_no,
         COALESCE(json_extract(x.payload_json,'$.pattern'),replace(COALESCE(x.title,''),'文法：','')) AS pattern,
         COALESCE(json_extract(x.payload_json,'$.meaning_ko'),'N1 문법 표현') AS meaning_ko
  FROM japanese_jlpt_daily_contents x
  JOIN plans p ON p.id=x.plan_id
  WHERE x.content_type='grammar'
    AND x.study_date BETWEEN '2026-09-07' AND '2026-11-30'
), base AS (
  SELECT d.d,d.n,p.id AS plan_id,
    COALESCE((SELECT g.pattern FROM grammar_pool g WHERE g.plan_id=p.id AND g.study_date=d.d ORDER BY g.sequence_no LIMIT 1),'〜に即して') AS p1,
    COALESCE((SELECT g.meaning_ko FROM grammar_pool g WHERE g.plan_id=p.id AND g.study_date=d.d ORDER BY g.sequence_no LIMIT 1),'〜에 입각하여') AS m1,
    COALESCE((SELECT g.pattern FROM grammar_pool g WHERE g.plan_id=p.id AND g.study_date=d.d ORDER BY g.sequence_no LIMIT 1 OFFSET 1),'〜を皮切りに') AS p2,
    COALESCE((SELECT g.meaning_ko FROM grammar_pool g WHERE g.plan_id=p.id AND g.study_date=d.d ORDER BY g.sequence_no LIMIT 1 OFFSET 1),'〜을 시작으로') AS m2,
    COALESCE((SELECT g.pattern FROM grammar_pool g WHERE g.plan_id=p.id AND g.study_date=date(d.d,'+1 day') ORDER BY g.sequence_no LIMIT 1),'〜にひきかえ') AS d1,
    COALESCE((SELECT g.pattern FROM grammar_pool g WHERE g.plan_id=p.id AND g.study_date=date(d.d,'+2 day') ORDER BY g.sequence_no DESC LIMIT 1),'〜ともなると') AS d2,
    COALESCE((SELECT g.pattern FROM grammar_pool g WHERE g.plan_id=p.id AND g.study_date=date(d.d,'+3 day') ORDER BY g.sequence_no LIMIT 1),'〜をものともせず') AS d3
  FROM days d CROSS JOIN plans p
), contexts AS (
  SELECT *,
    CASE (n%12)
      WHEN 0 THEN '制度を実際の状況に合わせて運用する場面'
      WHEN 1 THEN '予想外の結果を受けても冷静に判断する場面'
      WHEN 2 THEN '長年の支援があって初めて成果が成立する場面'
      WHEN 3 THEN '厳しい条件でも行動を続ける場面'
      WHEN 4 THEN '責任ある立場として説明が求められる場面'
      WHEN 5 THEN '一度起きたことを完全には元に戻せない場面'
      WHEN 6 THEN '想像することさえ難しい状況を述べる場面'
      WHEN 7 THEN '結果だけでなく過程も重視する場面'
      WHEN 8 THEN '専門家であっても基本を守る必要がある場面'
      WHEN 9 THEN '強い感情を抑えられない場面'
      WHEN 10 THEN '費用以外の要素も同時に考える場面'
      ELSE '小さな例外も見逃さない姿勢を述べる場面' END AS situation,
    CASE (n%10)
      WHEN 0 THEN '組織の意思決定'
      WHEN 1 THEN '新技術の導入'
      WHEN 2 THEN '制度評価'
      WHEN 3 THEN '専門知識の説明'
      WHEN 4 THEN '利用者要望への対応'
      WHEN 5 THEN '失敗と挑戦'
      WHEN 6 THEN '業務効率化'
      WHEN 7 THEN '情報選択'
      WHEN 8 THEN '長期計画'
      ELSE '公平なルール運用' END AS topic
  FROM base
)
INSERT INTO japanese_jlpt_daily_contents(plan_id,study_date,content_type,sequence_no,title,payload_json)
SELECT plan_id,d,'grammar_question',1,'文法形式・'||d,
 json_object(
   'prompt','次の場面に最も合うN1文法表現を、その日の学習項目から選びなさい：'||situation,
   'options',json_array(p1,d1,d2,d3),
   'answer',p1,
   'explanation','正解は「'||p1||'」。この日の学習上の意味は「'||m1||'」。意味と使用場面を結び付けて覚える。'
 )
FROM contexts
UNION ALL
SELECT plan_id,d,'grammar_question',2,'意味・用法・'||d,
 json_object(
   'prompt','韓国語の意味「'||m2||'」に対応するN1文法表現として最も適切なものを選びなさい。',
   'options',json_array(p2,d2,d3,d1),
   'answer',p2,
   'explanation','「'||p2||'」はこの日の学習では「'||m2||'」の意味で用いる。接続と文脈も合わせて確認する。'
 )
FROM contexts
UNION ALL
SELECT plan_id,d,'grammar_question',3,'文章の文法・'||d,
 json_object(
   'prompt','「'||topic||'」について文章を展開するとき、この日に学んだ表現として確認すべきものを選びなさい。',
   'options',json_array(CASE WHEN (n%2)=0 THEN p1 ELSE p2 END,d3,d1,d2),
   'answer',CASE WHEN (n%2)=0 THEN p1 ELSE p2 END,
   'explanation','正解は「'||CASE WHEN (n%2)=0 THEN p1 ELSE p2 END||'」。単独暗記ではなく文章の流れの中で用法を確認する。'
 )
FROM contexts;

-- One reading set per day.
-- n%10 and integer(n/10)%9 give unique theme/logic combinations for all 85 dates.
WITH RECURSIVE days(d,n) AS (
  SELECT date('2026-09-07'),0
  UNION ALL SELECT date(d,'+1 day'),n+1 FROM days WHERE d<'2026-11-30'
), plans AS (
  SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL' AND is_active=1
), vocab AS (
  SELECT d.d,p.id AS plan_id,
    COALESCE(
      (SELECT group_concat(z.word,'・') FROM (
        SELECT w.word AS word
        FROM japanese_jlpt_daily_sessions s
        JOIN japanese_jlpt_daily_words dw ON dw.session_id=s.id
        JOIN japanese_words w ON w.id=dw.word_id
        WHERE s.plan_id=p.id AND s.study_date=d.d AND w.deleted_at IS NULL
        ORDER BY dw.id LIMIT 3
      ) z),
      (SELECT group_concat(z.word,'・') FROM (
        SELECT w.word AS word
        FROM japanese_jlpt_curriculum_words c
        JOIN japanese_words w ON w.id=c.word_id
        WHERE c.plan_id=p.id AND c.introduced_on=d.d AND w.deleted_at IS NULL
        ORDER BY c.sort_order LIMIT 3
      ) z),
      '判断・影響・改善'
    ) AS key_words
  FROM days d CROSS JOIN plans p
), base AS (
  SELECT d.d,d.n,p.id AS plan_id,v.key_words,
    CASE (d.n%10)
      WHEN 0 THEN '働き方と評価'
      WHEN 1 THEN '地域交通と利便性'
      WHEN 2 THEN '学校教育とデジタル化'
      WHEN 3 THEN '企業の情報共有'
      WHEN 4 THEN '環境対策と生活コスト'
      WHEN 5 THEN '医療・福祉サービスの運用'
      WHEN 6 THEN '観光と地域社会'
      WHEN 7 THEN 'AIと人間の判断'
      WHEN 8 THEN '災害対策と日常の備え'
      ELSE '公共施設と利用者ニーズ' END AS theme,
    CASE (CAST(d.n/10 AS INTEGER)%9)
      WHEN 0 THEN '一見すると効率の問題に見えるが、実際には誰が負担を引き受けるのかという分配の問題でもある。'
      WHEN 1 THEN '短期的な数字が改善しても、その方法が長く続けられるかどうかは別に検討しなければならない。'
      WHEN 2 THEN '利用者の満足度だけでなく、利用しなかった人の理由を調べることで初めて見える課題もある。'
      WHEN 3 THEN '制度を一律に適用すれば公平に見えるが、条件の違いを無視すると別の不公平が生じることがある。'
      WHEN 4 THEN '新しい仕組みを導入する際、導入前の状態を記録していなければ効果を正確に比較できない。'
      WHEN 5 THEN '選択肢を増やすことは自由を広げる一方、比較や判断に必要な負担まで増やす可能性がある。'
      WHEN 6 THEN '専門家の判断は重要だが、利用者が理由を理解できなければ信頼につながりにくい。'
      WHEN 7 THEN '問題が起きた後の対応だけでなく、問題が起きにくい条件を設計することも同じくらい重要である。'
      ELSE '個別の成功例を一般化する前に、どの条件が結果に影響したのかを切り分ける必要がある。' END AS logic
  FROM days d CROSS JOIN plans p JOIN vocab v ON v.d=d.d AND v.plan_id=p.id
), reading AS (
  SELECT *,
    '「'||theme||'」を考えるとき、目に見える成果だけを基準に判断すると重要な点を見落としやすい。'||logic||
    ' たとえば、ある施策によって一部の作業が簡単になったとしても、その準備や確認に別の人が多くの時間を使っているなら、全体として効率化したとは言い切れない。'||
    ' また、開始直後の反応と、利用者が仕組みに慣れた後の反応が同じとも限らない。そこで必要なのは、単一の数字を結論として扱うのではなく、異なる時点・立場・条件を比較しながら変化の理由を確かめることである。'||
    ' 本日の語彙「'||key_words||'」も、こうした分析の文脈で意味を捉えると理解しやすい。結局、良い判断とは情報を多く集めることそのものではなく、目的に照らして何を比較し、何を根拠として残すかを明確にすることだ。' AS passage
  FROM base
)
INSERT INTO japanese_jlpt_daily_contents(plan_id,study_date,content_type,sequence_no,title,payload_json)
SELECT plan_id,d,'reading',1,'読解：'||theme||'（'||d||'）',
 json_object(
   'passage',passage,
   'questions',json_array(
     json_object(
       'prompt','筆者が最も言いたいことは何か。',
       'options',json_array('単一の成果だけでなく条件や立場を比較して判断する必要がある','情報は多ければ多いほど正確な判断につながる','制度はすべての利用者に同じ方法で適用すべきだ','開始直後の反応だけで施策の成功を判断できる'),
       'answer','単一の成果だけでなく条件や立場を比較して判断する必要がある',
       'explanation','本文では一つの数字を結論にせず、時点・立場・条件を比較し変化の理由を確認する必要を述べている。'
     ),
     json_object(
       'prompt','本文で「全体として効率化したとは言い切れない」とあるのはなぜか。',
       'options',json_array('見えにくい準備や確認の負担が別の人に移っている可能性があるから','新しい仕組みは必ず作業時間を増やすから','利用者は新しい仕組みに慣れることができないから','効率は数字では一切測れないから'),
       'answer','見えにくい準備や確認の負担が別の人に移っている可能性があるから',
       'explanation','一部の作業が簡単になっても別の場所に負担が移れば全体の効率化とは限らない、という例が示されている。'
     ),
     json_object(
       'prompt','本文の内容と合うものはどれか。',
       'options',json_array('施策の評価では異なる時点の反応も比較する必要がある','利用者が慣れた後の反応は評価する必要がない','成功例は条件を確認せず他の場面にも適用できる','判断では根拠を残すことより結論を急ぐことが重要だ'),
       'answer','施策の評価では異なる時点の反応も比較する必要がある',
       'explanation','本文は開始直後と慣れた後の反応が同じとは限らないため、異なる時点を比較する必要があるとしている。'
     )
   )
 )
FROM reading;

CREATE TABLE _assert_jlpt_unique_0064 (
  ok INTEGER NOT NULL,
  CONSTRAINT jlpt_sep_nov_unique_practice_complete CHECK(ok=1)
);
WITH RECURSIVE days(d) AS (
  SELECT date('2026-09-07')
  UNION ALL SELECT date(d,'+1 day') FROM days WHERE d<'2026-11-30'
), plans AS (
  SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL' AND is_active=1
)
INSERT INTO _assert_jlpt_unique_0064(ok)
SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM days CROSS JOIN plans p
  WHERE (SELECT COUNT(*) FROM japanese_jlpt_daily_contents x WHERE x.plan_id=p.id AND x.study_date=days.d AND x.content_type='vocab_question')<>15
     OR (SELECT COUNT(*) FROM japanese_jlpt_daily_contents x WHERE x.plan_id=p.id AND x.study_date=days.d AND x.content_type='grammar')<>2
     OR (SELECT COUNT(*) FROM japanese_jlpt_daily_contents x WHERE x.plan_id=p.id AND x.study_date=days.d AND x.content_type='grammar_question')<>3
     OR (SELECT COUNT(*) FROM japanese_jlpt_daily_contents x WHERE x.plan_id=p.id AND x.study_date=days.d AND x.content_type='reading')<>1
     OR json_array_length((SELECT json_extract(x.payload_json,'$.questions') FROM japanese_jlpt_daily_contents x WHERE x.plan_id=p.id AND x.study_date=days.d AND x.content_type='reading' LIMIT 1))<>3
) THEN 1 ELSE 0 END;
DROP TABLE _assert_jlpt_unique_0064;