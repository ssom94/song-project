-- 0058_jlpt_full_september_2026.sql
-- Complete JLPT N1 study material for 2026-09-07 through 2026-09-30.
PRAGMA foreign_keys = ON;

UPDATE japanese_jlpt_study_plans
SET study_start_date='2026-09-07', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE plan_code='N1_2027_JUL';

WITH candidate AS (
  SELECT p.id AS plan_id, w.id AS word_id,
         ROW_NUMBER() OVER (PARTITION BY p.id ORDER BY w.id) AS rn
  FROM japanese_jlpt_study_plans p
  JOIN jlpt_levels l ON l.code=p.jlpt_level_code
  JOIN japanese_words w ON w.jlpt_level_id=l.id AND w.deleted_at IS NULL
  WHERE p.plan_code='N1_2027_JUL' AND p.is_active=1
    AND NOT EXISTS (SELECT 1 FROM japanese_jlpt_curriculum_words c WHERE c.plan_id=p.id AND c.word_id=w.id)
), picked AS (
  SELECT * FROM candidate WHERE rn<=320
), base AS (
  SELECT p.id AS plan_id, COALESCE(MAX(c.sort_order),0) AS base_order
  FROM japanese_jlpt_study_plans p
  LEFT JOIN japanese_jlpt_curriculum_words c ON c.plan_id=p.id
  WHERE p.plan_code='N1_2027_JUL' GROUP BY p.id
)
INSERT OR IGNORE INTO japanese_jlpt_curriculum_words(plan_id,word_id,sort_order,introduced_on)
SELECT x.plan_id,x.word_id,b.base_order+x.rn,
       date('2026-09-15','+'||CAST((x.rn-1)/20 AS INTEGER)||' day')
FROM picked x JOIN base b ON b.plan_id=x.plan_id;

DELETE FROM japanese_jlpt_daily_contents
WHERE plan_id IN (SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL')
  AND study_date BETWEEN '2026-09-07' AND '2026-09-30';

WITH ranked AS (
  SELECT c.plan_id,c.introduced_on AS study_date,w.word,w.reading,
         COALESCE(NULLIF(w.meaning_ko,''),'뜻 확인') AS meaning_ko,
         ROW_NUMBER() OVER(PARTITION BY c.plan_id,c.introduced_on ORDER BY c.sort_order) AS rn
  FROM japanese_jlpt_curriculum_words c
  JOIN japanese_words w ON w.id=c.word_id AND w.deleted_at IS NULL
  JOIN japanese_jlpt_study_plans p ON p.id=c.plan_id
  WHERE p.plan_code='N1_2027_JUL'
    AND c.introduced_on BETWEEN '2026-09-07' AND '2026-09-30'
), q AS (
  SELECT r.*,
    CASE ((rn-1)%5)
      WHEN 0 THEN '漢字読み'
      WHEN 1 THEN '表記'
      WHEN 2 THEN '文脈規定'
      WHEN 3 THEN '言い換え類義'
      ELSE '用法確認' END AS subtype
  FROM ranked r WHERE rn<=15
)
INSERT INTO japanese_jlpt_daily_contents(plan_id,study_date,content_type,sequence_no,title,payload_json)
SELECT q.plan_id,q.study_date,'vocab_question',q.rn,'文字・語彙：'||q.subtype,
  CASE q.subtype
    WHEN '漢字読み' THEN json_object(
      'prompt','「'||q.word||'」の読み方として最も適切なものを選びなさい。',
      'options',json_array(q.reading,
        COALESCE((SELECT reading FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn)%20)+1),q.word),
        COALESCE((SELECT reading FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn+1)%20)+1),q.word),
        COALESCE((SELECT reading FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn+2)%20)+1),q.word)),
      'answer',q.reading,
      'explanation','「'||q.word||'」は「'||q.reading||'」と読む。韓国語の意味は「'||q.meaning_ko||'」。')
    WHEN '表記' THEN json_object(
      'prompt','「'||q.reading||'」と読む語として最も適切なものを選びなさい。',
      'options',json_array(q.word,
        COALESCE((SELECT word FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn)%20)+1),q.reading),
        COALESCE((SELECT word FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn+1)%20)+1),q.reading),
        COALESCE((SELECT word FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn+2)%20)+1),q.reading)),
      'answer',q.word,
      'explanation','正しい表記は「'||q.word||'」。読みは「'||q.reading||'」。')
    WHEN '文脈規定' THEN json_object(
      'prompt','次の意味に最も近い語を選びなさい：「'||q.meaning_ko||'」',
      'options',json_array(q.word,
        COALESCE((SELECT word FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn)%20)+1),q.word),
        COALESCE((SELECT word FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn+1)%20)+1),q.word),
        COALESCE((SELECT word FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn+2)%20)+1),q.word)),
      'answer',q.word,'explanation','意味と語の対応を確認する問題。正解は「'||q.word||'」。')
    WHEN '言い換え類義' THEN json_object(
      'prompt','「'||q.word||'」の意味として最も近いものを選びなさい。',
      'options',json_array(q.meaning_ko,
        COALESCE((SELECT meaning_ko FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn)%20)+1),'반대 의미'),
        COALESCE((SELECT meaning_ko FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn+1)%20)+1),'다른 의미'),
        COALESCE((SELECT meaning_ko FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn+2)%20)+1),'관련 없음')),
      'answer',q.meaning_ko,'explanation','「'||q.word||'」の意味は「'||q.meaning_ko||'」。')
    ELSE json_object(
      'prompt','「'||q.word||'」について、読みと意味の組合せとして最も適切なものを選びなさい。',
      'options',json_array(q.reading||' / '||q.meaning_ko,
        q.reading||' / 다른 의미',
        COALESCE((SELECT reading FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn)%20)+1),q.reading)||' / '||q.meaning_ko,
        COALESCE((SELECT reading FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn+1)%20)+1),q.reading)||' / 다른 의미'),
      'answer',q.reading||' / '||q.meaning_ko,
      'explanation','読みは「'||q.reading||'」、意味は「'||q.meaning_ko||'」。') END
FROM q;

WITH grammar(study_date,seq,pattern,meaning_ko) AS (VALUES
('2026-09-07',1,'〜あっての','〜이 있어야 비로소'),('2026-09-07',2,'〜いかんでは','〜여하에 따라서는'),
('2026-09-08',1,'〜いかんにかかわらず','〜여하에 관계없이'),('2026-09-08',2,'〜ずくめ','온통 〜뿐'),
('2026-09-09',1,'〜ずにはおかない','반드시 〜하게 만들다'),('2026-09-09',2,'〜ずにはすまない','〜하지 않고는 끝나지 않다'),
('2026-09-10',1,'〜そばから','〜하자마자 곧'),('2026-09-10',2,'〜たが最後','〜했다 하면 끝장이다'),
('2026-09-11',1,'〜たところで','〜해 보아도'),('2026-09-11',2,'〜だに','〜하기만 해도'),
('2026-09-12',1,'〜たりとも','단 하나라도'),('2026-09-12',2,'〜であれ','〜라 할지라도'),
('2026-09-13',1,'〜てからというもの','〜하고 나서부터 줄곧'),('2026-09-13',2,'〜てやまない','진심으로 계속 〜하다'),
('2026-09-14',1,'〜とあって','〜라는 특별한 상황이라'),('2026-09-14',2,'〜とあれば','〜라면'),
('2026-09-15',1,'〜といい〜といい','〜도 그렇고 〜도 그렇고'),('2026-09-15',2,'〜といえども','〜라 할지라도'),
('2026-09-16',1,'〜ときたら','〜라고 하면'),('2026-09-16',2,'〜ところを','〜한 상황인데도'),
('2026-09-17',1,'〜ともなく','딱히 〜하려 한 것도 아닌데'),('2026-09-17',2,'〜ともなると','〜정도가 되면'),
('2026-09-18',1,'〜ないまでも','〜까지는 아니더라도'),('2026-09-18',2,'〜ないものでもない','〜하지 못할 것도 없다'),
('2026-09-19',1,'〜ながらに','〜인 채로'),('2026-09-19',2,'〜なくして','〜없이는'),
('2026-09-20',1,'〜ならでは','〜이기에 가능한'),('2026-09-20',2,'〜なり','〜하자마자'),
('2026-09-21',1,'〜にあって','〜한 상황에서'),('2026-09-21',2,'〜に至って','〜에 이르러서'),
('2026-09-22',1,'〜に至るまで','〜에 이르기까지'),('2026-09-22',2,'〜にかたくない','쉽게 〜할 수 있다'),
('2026-09-23',1,'〜にかまけて','〜에 정신이 팔려'),('2026-09-23',2,'〜にして','〜에 이르러서야'),
('2026-09-24',1,'〜に即して','〜에 입각하여'),('2026-09-24',2,'〜にたえる','〜할 가치가 있다'),
('2026-09-25',1,'〜に足る','〜할 만하다'),('2026-09-25',2,'〜にひきかえ','〜와는 대조적으로'),
('2026-09-26',1,'〜にもまして','〜보다도 더욱'),('2026-09-26',2,'〜の極み','〜의 극치'),
('2026-09-27',1,'〜の至り','더없이 〜함'),('2026-09-27',2,'〜ばこそ','바로 〜이기 때문에'),
('2026-09-28',1,'〜べからず','〜해서는 안 된다'),('2026-09-28',2,'〜べく','〜하기 위해'),
('2026-09-29',1,'〜べくもない','도저히 〜할 수 없다'),('2026-09-29',2,'〜まじき','〜해서는 안 될'),
('2026-09-30',1,'〜までだ','그저 〜할 뿐이다'),('2026-09-30',2,'〜までもない','〜할 필요도 없다')
), plans AS (SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL')
INSERT INTO japanese_jlpt_daily_contents(plan_id,study_date,content_type,sequence_no,title,payload_json)
SELECT p.id,g.study_date,'grammar',g.seq,'文法：'||g.pattern,
 json_object('pattern',g.pattern,'meaning_ko',g.meaning_ko,
             'explanation_ja','接続形と文脈上の意味を確認し、似た表現との違いまで覚える。',
             'explanation_ko',g.meaning_ko||'의 의미와 접속 형태를 함께 익힌다.')
FROM plans p CROSS JOIN grammar g;

WITH grammar(study_date,seq,pattern,meaning_ko) AS (VALUES
('2026-09-07',1,'〜あっての','〜이 있어야 비로소'),('2026-09-07',2,'〜いかんでは','〜여하에 따라서는'),
('2026-09-08',1,'〜いかんにかかわらず','〜여하에 관계없이'),('2026-09-08',2,'〜ずくめ','온통 〜뿐'),
('2026-09-09',1,'〜ずにはおかない','반드시 〜하게 만들다'),('2026-09-09',2,'〜ずにはすまない','〜하지 않고는 끝나지 않다'),
('2026-09-10',1,'〜そばから','〜하자마자 곧'),('2026-09-10',2,'〜たが最後','〜했다 하면 끝장이다'),
('2026-09-11',1,'〜たところで','〜해 보아도'),('2026-09-11',2,'〜だに','〜하기만 해도'),
('2026-09-12',1,'〜たりとも','단 하나라도'),('2026-09-12',2,'〜であれ','〜라 할지라도'),
('2026-09-13',1,'〜てからというもの','〜하고 나서부터 줄곧'),('2026-09-13',2,'〜てやまない','진심으로 계속 〜하다'),
('2026-09-14',1,'〜とあって','〜라는 특별한 상황이라'),('2026-09-14',2,'〜とあれば','〜라면'),
('2026-09-15',1,'〜といい〜といい','〜도 그렇고 〜도 그렇고'),('2026-09-15',2,'〜といえども','〜라 할지라도'),
('2026-09-16',1,'〜ときたら','〜라고 하면'),('2026-09-16',2,'〜ところを','〜한 상황인데도'),
('2026-09-17',1,'〜ともなく','딱히 〜하려 한 것도 아닌데'),('2026-09-17',2,'〜ともなると','〜정도가 되면'),
('2026-09-18',1,'〜ないまでも','〜까지는 아니더라도'),('2026-09-18',2,'〜ないものでもない','〜하지 못할 것도 없다'),
('2026-09-19',1,'〜ながらに','〜인 채로'),('2026-09-19',2,'〜なくして','〜없이는'),
('2026-09-20',1,'〜ならでは','〜이기에 가능한'),('2026-09-20',2,'〜なり','〜하자마자'),
('2026-09-21',1,'〜にあって','〜한 상황에서'),('2026-09-21',2,'〜に至って','〜에 이르러서'),
('2026-09-22',1,'〜に至るまで','〜에 이르기까지'),('2026-09-22',2,'〜にかたくない','쉽게 〜할 수 있다'),
('2026-09-23',1,'〜にかまけて','〜에 정신이 팔려'),('2026-09-23',2,'〜にして','〜에 이르러서야'),
('2026-09-24',1,'〜に即して','〜에 입각하여'),('2026-09-24',2,'〜にたえる','〜할 가치가 있다'),
('2026-09-25',1,'〜に足る','〜할 만하다'),('2026-09-25',2,'〜にひきかえ','〜와는 대조적으로'),
('2026-09-26',1,'〜にもまして','〜보다도 더욱'),('2026-09-26',2,'〜の極み','〜의 극치'),
('2026-09-27',1,'〜の至り','더없이 〜함'),('2026-09-27',2,'〜ばこそ','바로 〜이기 때문에'),
('2026-09-28',1,'〜べからず','〜해서는 안 된다'),('2026-09-28',2,'〜べく','〜하기 위해'),
('2026-09-29',1,'〜べくもない','도저히 〜할 수 없다'),('2026-09-29',2,'〜まじき','〜해서는 안 될'),
('2026-09-30',1,'〜までだ','그저 〜할 뿐이다'),('2026-09-30',2,'〜までもない','〜할 필요도 없다')
), plans AS (SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL'),
days AS (SELECT DISTINCT study_date FROM grammar)
INSERT INTO japanese_jlpt_daily_contents(plan_id,study_date,content_type,sequence_no,title,payload_json)
SELECT p.id,d.study_date,'grammar_question',n.n,
 CASE n.n WHEN 1 THEN '文法形式の判断' WHEN 2 THEN '文の組み立て' ELSE '文章の文法' END,
 CASE n.n
  WHEN 1 THEN json_object('prompt','今日の文法項目の意味として最も適切なものを選びなさい。',
    'options',json_array(g1.meaning_ko,g2.meaning_ko,'단순한 과거 사실만 나타냄','의지와 관계없이 항상 금지를 나타냄'),
    'answer',g1.meaning_ko,'explanation','今日の第1文法「'||g1.pattern||'」の意味を確認する。')
  WHEN 2 THEN json_object('prompt','次の語句を自然な文になるように並べるとき、中心となる文法表現を選びなさい。',
    'options',json_array(g2.pattern,g1.pattern,'〜ながら','〜ために'),
    'answer',g2.pattern,'explanation','第2文法「'||g2.pattern||'」の接続と意味を基準に判断する。')
  ELSE json_object('prompt','文章全体の論理関係を保つために最も適切な文法表現を選びなさい。',
    'options',json_array(g1.pattern,g2.pattern,'〜ので','〜ても'),
    'answer',g1.pattern,'explanation','前後関係と話者の評価を確認し、第1文法を選ぶ。') END
FROM plans p CROSS JOIN days d
JOIN grammar g1 ON g1.study_date=d.study_date AND g1.seq=1
JOIN grammar g2 ON g2.study_date=d.study_date AND g2.seq=2
CROSS JOIN (SELECT 1 n UNION ALL SELECT 2 UNION ALL SELECT 3) n;

WITH reading(study_date,seq,reading_type,passage,main_point) AS (VALUES
('2026-09-07',1,'短文・主張把握','働き方を効率化するために新しい制度を導入しても、それだけで成果が上がるとは限らない。制度を使う人が目的を理解し、必要に応じて運用を見直してこそ、改善は継続する。','制度の導入だけでなく、目的理解と運用改善が必要だ。'),
('2026-09-08',1,'中文・理由理解','情報が多いほど判断が正確になると思われがちだが、必要性の低い情報まで集めると、かえって重要な点が見えにくくなる。大切なのは量ではなく、判断基準に照らして情報を選ぶことである。','情報量より判断基準に沿った選別が重要だ。'),
('2026-09-09',1,'長文・論理展開','技術の進歩は作業時間を短縮する一方で、新しい確認作業を生むこともある。自動化によって人の負担が減ったように見えても、例外処理や監視の責任が増える場合がある。したがって、導入効果は単純な作業時間だけで評価せず、運用全体で考える必要がある。','自動化は運用全体の負担で評価すべきだ。'),
('2026-09-10',1,'統合理解','資料Aは在宅勤務によって通勤時間が減り集中しやすくなったと述べる。一方、資料Bは偶発的な相談が減り、問題発見が遅れる可能性を指摘する。両者は働く場所そのものより、情報共有の仕組みが成果を左右すると示している。','働く場所より情報共有の仕組みが重要だ。'),
('2026-09-11',1,'主張理解','失敗を避けることだけを目標にすると、新しい試みは生まれにくい。しかし、失敗を無条件に許容すればよいわけでもない。小さく試し、結果を記録し、次の判断に生かせる仕組みを作ることが重要である。','小さく試して記録し次の判断に生かす仕組みが重要だ。'),
('2026-09-12',1,'情報検索','市民講座Aは平日19時開始で申込締切は開催3日前、講座Bは土曜10時開始で締切は1週間前である。どちらもオンライン参加が可能だが、資料送付を希望する場合は締切までの申込みが必要である。','条件と締切を照合して必要情報を探す。'),
('2026-09-13',1,'短文・主張把握','働き方を効率化するために新しい制度を導入しても、それだけで成果が上がるとは限らない。制度を使う人が目的を理解し、必要に応じて運用を見直してこそ、改善は継続する。','制度の導入だけでなく、目的理解と運用改善が必要だ。'),
('2026-09-14',1,'中文・理由理解','情報が多いほど判断が正確になると思われがちだが、必要性の低い情報まで集めると、かえって重要な点が見えにくくなる。大切なのは量ではなく、判断基準に照らして情報を選ぶことである。','情報量より判断基準に沿った選別が重要だ。'),
('2026-09-15',1,'長文・論理展開','技術の進歩は作業時間を短縮する一方で、新しい確認作業を生むこともある。自動化によって人の負担が減ったように見えても、例外処理や監視の責任が増える場合がある。したがって、導入効果は単純な作業時間だけで評価せず、運用全体で考える必要がある。','自動化は運用全体の負担で評価すべきだ。'),
('2026-09-16',1,'統合理解','資料Aは在宅勤務によって通勤時間が減り集中しやすくなったと述べる。一方、資料Bは偶発的な相談が減り、問題発見が遅れる可能性を指摘する。両者は働く場所そのものより、情報共有の仕組みが成果を左右すると示している。','働く場所より情報共有の仕組みが重要だ。'),
('2026-09-17',1,'主張理解','失敗を避けることだけを目標にすると、新しい試みは生まれにくい。しかし、失敗を無条件に許容すればよいわけでもない。小さく試し、結果を記録し、次の判断に生かせる仕組みを作ることが重要である。','小さく試して記録し次の判断に生かす仕組みが重要だ。'),
('2026-09-18',1,'情報検索','市民講座Aは平日19時開始で申込締切は開催3日前、講座Bは土曜10時開始で締切は1週間前である。どちらもオンライン参加が可能だが、資料送付を希望する場合は締切までの申込みが必要である。','条件と締切を照合して必要情報を探す。'),
('2026-09-19',1,'短文・主張把握','働き方を効率化するために新しい制度を導入しても、それだけで成果が上がるとは限らない。制度を使う人が目的を理解し、必要に応じて運用を見直してこそ、改善は継続する。','制度の導入だけでなく、目的理解と運用改善が必要だ。'),
('2026-09-20',1,'中文・理由理解','情報が多いほど判断が正確になると思われがちだが、必要性の低い情報まで集めると、かえって重要な点が見えにくくなる。大切なのは量ではなく、判断基準に照らして情報を選ぶことである。','情報量より判断基準に沿った選別が重要だ。'),
('2026-09-21',1,'長文・論理展開','技術の進歩は作業時間を短縮する一方で、新しい確認作業を生むこともある。自動化によって人の負担が減ったように見えても、例外処理や監視の責任が増える場合がある。したがって、導入効果は単純な作業時間だけで評価せず、運用全体で考える必要がある。','自動化は運用全体の負担で評価すべきだ。'),
('2026-09-22',1,'統合理解','資料Aは在宅勤務によって通勤時間が減り集中しやすくなったと述べる。一方、資料Bは偶発的な相談が減り、問題発見が遅れる可能性を指摘する。両者は働く場所そのものより、情報共有の仕組みが成果を左右すると示している。','働く場所より情報共有の仕組みが重要だ。'),
('2026-09-23',1,'主張理解','失敗を避けることだけを目標にすると、新しい試みは生まれにくい。しかし、失敗を無条件に許容すればよいわけでもない。小さく試し、結果を記録し、次の判断に生かせる仕組みを作ることが重要である。','小さく試して記録し次の判断に生かす仕組みが重要だ。'),
('2026-09-24',1,'情報検索','市民講座Aは平日19時開始で申込締切は開催3日前、講座Bは土曜10時開始で締切は1週間前である。どちらもオンライン参加が可能だが、資料送付を希望する場合は締切までの申込みが必要である。','条件と締切を照合して必要情報を探す。'),
('2026-09-25',1,'短文・主張把握','働き方を効率化するために新しい制度を導入しても、それだけで成果が上がるとは限らない。制度を使う人が目的を理解し、必要に応じて運用を見直してこそ、改善は継続する。','制度の導入だけでなく、目的理解と運用改善が必要だ。'),
('2026-09-26',1,'中文・理由理解','情報が多いほど判断が正確になると思われがちだが、必要性の低い情報まで集めると、かえって重要な点が見えにくくなる。大切なのは量ではなく、判断基準に照らして情報を選ぶことである。','情報量より判断基準に沿った選別が重要だ。'),
('2026-09-27',1,'長文・論理展開','技術の進歩は作業時間を短縮する一方で、新しい確認作業を生むこともある。自動化によって人の負担が減ったように見えても、例外処理や監視の責任が増える場合がある。したがって、導入効果は単純な作業時間だけで評価せず、運用全体で考える必要がある。','自動化は運用全体の負担で評価すべきだ。'),
('2026-09-28',1,'統合理解','資料Aは在宅勤務によって通勤時間が減り集中しやすくなったと述べる。一方、資料Bは偶発的な相談が減り、問題発見が遅れる可能性を指摘する。両者は働く場所そのものより、情報共有の仕組みが成果を左右すると示している。','働く場所より情報共有の仕組みが重要だ。'),
('2026-09-29',1,'主張理解','失敗を避けることだけを目標にすると、新しい試みは生まれにくい。しかし、失敗を無条件に許容すればよいわけでもない。小さく試し、結果を記録し、次の判断に生かせる仕組みを作ることが重要である。','小さく試して記録し次の判断に生かす仕組みが重要だ。'),
('2026-09-30',1,'情報検索','市民講座Aは平日19時開始で申込締切は開催3日前、講座Bは土曜10時開始で締切は1週間前である。どちらもオンライン参加が可能だが、資料送付を希望する場合は締切までの申込みが必要である。','条件と締切を照合して必要情報を探す。')
), plans AS (SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL')
INSERT INTO japanese_jlpt_daily_contents(plan_id,study_date,content_type,sequence_no,title,payload_json)
SELECT p.id,r.study_date,'reading',r.seq,'読解：'||r.reading_type,
 json_object(
  'passage',r.passage,
  'questions',json_array(
    json_object('prompt','この文章の中心的な主張として最も適切なものはどれか。',
      'options',json_array(r.main_point,'細部だけを重視すべきだ。','変化を避けることが最も重要だ。','筆者は結論を示していない。'),
      'answer',r.main_point,'explanation','冒頭と結論を結び、筆者が最も強く述べる内容を選ぶ。'),
    json_object('prompt','筆者がこの主張を述べる理由として最も適切なものはどれか。',
      'options',json_array('単純な一面だけでは十分に判断できないから。','例外は一切存在しないから。','情報は少ないほど常に正確だから。','すべての人が同じ意見だから。'),
      'answer','単純な一面だけでは十分に判断できないから。',
      'explanation','対比・逆接・結論の直前にある根拠を追う。'),
    json_object('prompt','この文章を読むときに最も重要な読み方はどれか。',
      'options',json_array('接続表現と対比・因果関係を確認する。','漢字だけを拾って読む。','最初の一文だけで答える。','知らない単語があれば必ず中断する。'),
      'answer','接続表現と対比・因果関係を確認する。',
      'explanation','N1読解では接続語、指示語、対比、因果、結論位置を構造として追う。')
  ),
  'focus_ko','주장·근거·대조·접속 관계를 구조적으로 추적',
  'reading_type',r.reading_type)
FROM plans p CROSS JOIN reading r;
