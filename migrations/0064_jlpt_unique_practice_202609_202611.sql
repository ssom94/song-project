-- 0064_jlpt_unique_practice_202609_202611.sql
-- Improve 2026-09-07..2026-11-30 JLPT practice quality without touching word progress.
-- Rebuild grammar questions and reading sets with date-specific contexts,
-- real N1 grammar patterns as choices, and varied reading themes / logic.

DELETE FROM japanese_jlpt_daily_contents
WHERE plan_id IN (SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL')
  AND study_date BETWEEN '2026-09-07' AND '2026-11-30'
  AND content_type IN ('grammar_question','reading');

-- Three grammar questions per day. Choices are drawn from actual grammar lessons
-- already registered in the plan instead of generic placeholder strings.
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
         COALESCE((SELECT pattern FROM grammar_pool g WHERE g.plan_id=p.id AND g.study_date=d.d ORDER BY sequence_no LIMIT 1),'〜に即して') AS p1,
         COALESCE((SELECT meaning_ko FROM grammar_pool g WHERE g.plan_id=p.id AND g.study_date=d.d ORDER BY sequence_no LIMIT 1),'〜에 입각하여') AS m1,
         COALESCE((SELECT pattern FROM grammar_pool g WHERE g.plan_id=p.id AND g.study_date=d.d ORDER BY sequence_no LIMIT 1 OFFSET 1),'〜を皮切りに') AS p2,
         COALESCE((SELECT meaning_ko FROM grammar_pool g WHERE g.plan_id=p.id AND g.study_date=d.d ORDER BY sequence_no LIMIT 1 OFFSET 1),'〜을 시작으로') AS m2
  FROM days d CROSS JOIN plans p
), contexts AS (
  SELECT *,
    CASE (n%16)
      WHEN 0 THEN '新制度の導入は現場の実情（　）進めなければ、かえって混乱を招く。'
      WHEN 1 THEN '研究結果が予想と異なったからといって、データを無視してよい（　）。'
      WHEN 2 THEN '長年支えてくれた利用者（　）、このサービスの成長はあり得なかった。'
      WHEN 3 THEN '厳しい条件（　）、担当者たちは計画を最後までやり遂げた。'
      WHEN 4 THEN '責任ある立場の者（　）、説明を曖昧にしたままでは済まされない。'
      WHEN 5 THEN '一度公開した情報は、完全に回収しようとしても容易にできる（　）。'
      WHEN 6 THEN '状況がここまで悪化するとは、当時は想像する（　）なかった。'
      WHEN 7 THEN '結果だけを見る（　）、判断に至った過程も確認する必要がある。'
      WHEN 8 THEN '専門家（　）、基本的な安全確認を怠ってよいわけではない。'
      WHEN 9 THEN 'その知らせを聞いた瞬間、驚きを（　）。'
      WHEN 10 THEN '費用の問題（　）、利用者への影響も無視できない。'
      WHEN 11 THEN '小さな誤差（　）見逃さない姿勢が品質を支えている。'
      WHEN 12 THEN '経験を積む（　）、判断の速さだけでなく根拠の説明も重要になる。'
      WHEN 13 THEN '計画を実現する（　）、関係部署との調整を重ねた。'
      WHEN 14 THEN '周囲の反対（　）、彼は必要だと考えた改善を続けた。'
      ELSE '数字の変化だけ（　）、背景にある利用行動まで確認すべきだ。' END AS sentence1,
    CASE (n%12)
      WHEN 0 THEN '組織が大きくなるほど、意思決定では速度と慎重さの両立が求められる。'
      WHEN 1 THEN '新しい技術は便利さをもたらす一方、運用方法によって新たな負担も生む。'
      WHEN 2 THEN '制度の評価では、導入直後の数字だけで結論を出すべきではない。'
      WHEN 3 THEN '専門知識があっても、相手に伝わらなければ実務上の価値は十分に発揮されない。'
      WHEN 4 THEN '利用者の声は重要だが、個別の要望をすべてそのまま反映できるとは限らない。'
      WHEN 5 THEN '失敗を避けることだけを重視すると、必要な挑戦まで控える結果になりかねない。'
      WHEN 6 THEN '効率化は作業時間を短くするだけでなく、判断に使える時間を増やす点にも意味がある。'
      WHEN 7 THEN '情報が多いほど判断しやすいとは限らず、目的に合う情報を選ぶ力が必要になる。'
      WHEN 8 THEN '長期計画では、現在の最適解が将来も最適であるとは限らない。'
      WHEN 9 THEN 'ルールは公平性を支えるが、例外を一切認めない運用が常に公平とは限らない。'
      WHEN 10 THEN '改善を続けるには、成果だけでなく改善前の状態を正確に残しておく必要がある。'
      ELSE '異なる立場の人と協働するとき、結論より先に前提条件を共有することが重要である。' END AS discourse
  FROM base
), options AS (
  SELECT c.*,
    COALESCE((SELECT pattern FROM grammar_pool g WHERE g.plan_id=c.plan_id AND g.pattern<>c.p1 ORDER BY g.study_date,g.sequence_no LIMIT 1 OFFSET ((c.n*3+5)%30)),'〜にひきかえ') AS d1,
    COALESCE((SELECT pattern FROM grammar_pool g WHERE g.plan_id=c.plan_id AND g.pattern NOT IN (c.p1,c.p2) ORDER BY g.study_date,g.sequence_no LIMIT 1 OFFSET ((c.n*5+7)%30)),'〜ともなると') AS d2,
    COALESCE((SELECT pattern FROM grammar_pool g WHERE g.plan_id=c.plan_id AND g.pattern NOT IN (c.p1,c.p2) ORDER BY g.study_date DESC,g.sequence_no LIMIT 1 OFFSET ((c.n*7+3)%30)),'〜をものともせず') AS d3
  FROM contexts c
)
INSERT INTO japanese_jlpt_daily_contents(plan_id,study_date,content_type,sequence_no,title,payload_json)
SELECT plan_id,d,'grammar_question',1,'文法形式・'||d,
 json_object(
  'prompt',sentence1||' 空欄に入る表現として、その日の学習文法から最も適切なものを選びなさい。',
  'options',json_array(p1,d1,d2,d3),
  'answer',p1,
  'explanation','正解は「'||p1||'」。この日の学習上の意味は「'||m1||'」。前後の意味関係と接続を合わせて判断する。'
 )
FROM options
UNION ALL
SELECT plan_id,d,'grammar_question',2,'文の組み立て・'||d,
 json_object(
  'prompt','次の内容を自然な一文にするとき、中心となるN1文法として最も適切なものを選びなさい：'||discourse,
  'options',json_array(p2,d2,d3,d1),
  'answer',p2,
  'explanation','この問題では「'||p2||'」を使った構成が最も自然。意味は「'||m2||'」。文全体の主従関係を確認する。'
 )
FROM options
UNION ALL
SELECT plan_id,d,'grammar_question',3,'文章の文法・'||d,
 json_object(
  'prompt',discourse||' この主張を補足・展開する際に、その日の学習文法として最も適切な表現を選びなさい。',
  'options',json_array(CASE WHEN (n%2)=0 THEN p1 ELSE p2 END,d3,d1,d2),
  'answer',CASE WHEN (n%2)=0 THEN p1 ELSE p2 END,
  'explanation','段落全体の論理関係から「'||CASE WHEN (n%2)=0 THEN p1 ELSE p2 END||'」が最も適切。単文だけでなく主張の流れを確認する。'
 )
FROM options;

-- One reading set per day. Two independent rotating dimensions (theme + logic)
-- create a different passage structure for every study date in this range.
WITH RECURSIVE days(d,n) AS (
  SELECT date('2026-09-07'),0
  UNION ALL SELECT date(d,'+1 day'),n+1 FROM days WHERE d<'2026-11-30'
), plans AS (
  SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL' AND is_active=1
), vocab AS (
  SELECT d.d,p.id AS plan_id,
    COALESCE(
      (SELECT group_concat(word,'・') FROM (
        SELECT w.word AS word
        FROM japanese_jlpt_daily_sessions s
        JOIN japanese_jlpt_daily_words dw ON dw.session_id=s.id
        JOIN japanese_words w ON w.id=dw.word_id
        WHERE s.plan_id=p.id AND s.study_date=d.d AND w.deleted_at IS NULL
        ORDER BY dw.id LIMIT 3
      )),
      (SELECT group_concat(word,'・') FROM (
        SELECT w.word AS word
        FROM japanese_jlpt_curriculum_words c
        JOIN japanese_words w ON w.id=c.word_id
        WHERE c.plan_id=p.id AND c.introduced_on=d.d AND w.deleted_at IS NULL
        ORDER BY c.sort_order LIMIT 3
      )),
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
    CASE ((d.n/10)%9)
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
      'options',json_array(
        '単一の成果だけでなく条件や立場を比較して判断する必要がある',
        '情報は多ければ多いほど正確な判断につながる',
        '制度はすべての利用者に同じ方法で適用すべきだ',
        '開始直後の反応だけで施策の成功を判断できる'
      ),
      'answer','単一の成果だけでなく条件や立場を比較して判断する必要がある',
      'explanation','本文では一つの数字を結論にせず、時点・立場・条件を比較し変化の理由を確認する必要を述べている。'
    ),
    json_object(
      'prompt','本文で「全体として効率化したとは言い切れない」とあるのはなぜか。',
      'options',json_array(
        '見えにくい準備や確認の負担が別の人に移っている可能性があるから',
        '新しい仕組みは必ず作業時間を増やすから',
        '利用者は新しい仕組みに慣れることができないから',
        '効率は数字では一切測れないから'
      ),
      'answer','見えにくい準備や確認の負担が別の人に移っている可能性があるから',
      'explanation','一部の作業が簡単になっても別の場所に負担が移れば全体の効率化とは限らない、という例が示されている。'
    ),
    json_object(
      'prompt','本文の内容と合うものはどれか。',
      'options',json_array(
        '施策の評価では異なる時点の反応も比較する必要がある',
        '利用者が慣れた後の反応は評価する必要がない',
        '成功例は条件を確認せず他の場面にも適用できる',
        '判断では根拠を残すことより結論を急ぐことが重要だ'
      ),
      'answer','施策の評価では異なる時点の反応も比較する必要がある',
      'explanation','本文は開始直後と慣れた後の反応が同じとは限らないため、異なる時点を比較する必要があるとしている。'
    )
  )
 )
FROM reading;

-- Integrity: every date must still expose 15 vocab questions, 2 grammar lessons,
-- 3 grammar questions and one reading set containing three questions.
CREATE TABLE _assert_jlpt_unique_0064 (
  ok INTEGER NOT NULL,
  CONSTRAINT jlpt_sep_nov_unique_practice_complete CHECK(ok=1)
);
WITH RECURSIVE days(d) AS (
  SELECT date('2026-09-07') UNION ALL SELECT date(d,'+1 day') FROM days WHERE d<'2026-11-30'
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
