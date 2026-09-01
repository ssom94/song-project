-- 0055 Ensure every published AP concept problem type has question data.
-- This migration is intentionally data-driven so no type heading can render empty.
PRAGMA foreign_keys = ON;

-- A: guarantee question #1 for any legacy type that somehow has no question.
INSERT OR IGNORE INTO ap_concept_questions
(problem_type_id,question_no,question_ko,question_ja,choices_ko_json,choices_ja_json,correct_choice,answer_ko,answer_ja,explanation_ko,explanation_ja,difficulty,sort_order)
SELECT t.id,1,
 c.title_ko || '의 「' || t.type_name_ko || '」 유형에서 가장 먼저 적용해야 할 핵심 정의·공식·판단기준을 쓰고, 그것을 이용해 문제를 푸는 순서를 설명하시오.',
 c.title_ja || 'の「' || t.type_name_ja || '」タイプについて、最初に適用すべき定義・式・判断基準を示し、それを使う解答手順を説明せよ。',
 NULL,NULL,NULL,
 c.memory_ko || ' 핵심 기준을 먼저 확정한 뒤 문제의 수치·조건에 적용한다.',
 c.memory_ja || ' 基本基準を先に確定し、問題の数値・条件へ適用する。',
 '정의나 공식을 암기해서 끝내지 말고, 문제의 조건을 분리한 뒤 적용 대상과 단위를 확인하고 계산·판단 결과를 검산한다.',
 '定義や式の暗記だけで終わらず、条件を分離し、適用対象と単位を確認して計算・判断結果を検算する。',
 2,1
FROM ap_concept_problem_types t
JOIN ap_concepts c ON c.id=t.concept_id
WHERE c.exam_part='A' AND c.is_published=1
AND NOT EXISTS (SELECT 1 FROM ap_concept_questions q WHERE q.problem_type_id=t.id);

-- A: guarantee at least two questions per type. Existing concept-specific #1/#2 remain untouched.
INSERT OR IGNORE INTO ap_concept_questions
(problem_type_id,question_no,question_ko,question_ja,choices_ko_json,choices_ja_json,correct_choice,answer_ko,answer_ja,explanation_ko,explanation_ja,difficulty,sort_order)
SELECT t.id,2,
 '[응용] ' || c.title_ko || ' 문제에서 「' || t.type_name_ko || '」을 적용할 때 수험자가 가장 자주 틀리는 지점을 하나 들고, 올바른 판단 절차를 설명하시오.',
 '【応用】' || c.title_ja || 'の「' || t.type_name_ja || '」を解くとき、受験者が誤りやすい点を一つ挙げ、正しい判断手順を説明せよ。',
 NULL,NULL,NULL,
 c.traps_ko || ' 따라서 ' || c.method_ko,
 c.traps_ja || ' したがって、' || c.method_ja,
 '시험에서는 함정 문구를 먼저 찾고 핵심 정의·공식과 충돌하는지 확인한다. 그 다음 주어진 조건만 사용하여 단계별로 계산하거나 분류한다.',
 '試験ではまずひっかけとなる条件を確認し、基本定義・式と矛盾しないかを見る。その後、与えられた条件だけを使って段階的に計算・分類する。',
 2,2
FROM ap_concept_problem_types t
JOIN ap_concepts c ON c.id=t.concept_id
WHERE c.exam_part='A' AND c.is_published=1
AND NOT EXISTS (SELECT 1 FROM ap_concept_questions q WHERE q.problem_type_id=t.id AND q.question_no=2);

-- B: every selected Subject B type must contain a scenario question. Existing realistic questions from 0054 win via OR IGNORE.
INSERT OR IGNORE INTO ap_concept_questions
(problem_type_id,question_no,question_ko,question_ja,choices_ko_json,choices_ja_json,correct_choice,answer_ko,answer_ja,explanation_ko,explanation_ja,difficulty,sort_order)
SELECT t.id,1,
 '[상황] 운영 중인 시스템에서 ' || c.title_ko || '와 관련된 이상 현상이 발생했다. 로그·설정값·처리 흐름이 제시되었다고 가정한다. 「' || t.type_name_ko || '」 관점에서 먼저 확인할 정보 3가지와 판단 순서를 쓰고, 각 확인 결과가 결론에 어떤 영향을 주는지 설명하시오.',
 '【状況】稼働中systemで' || c.title_ja || 'に関する異常が発生し、log・設定値・処理flowが提示されたとする。「' || t.type_name_ja || '」の観点から最初に確認する情報を3つ、判断順序とともに示し、各確認結果が結論へどう影響するか説明せよ。',
 NULL,NULL,NULL,
 '① 사실관계와 입력·상태를 확인한다. ② ' || c.key_points_ko || ' ③ ' || c.method_ko || ' 마지막으로 결론과 근거를 함께 적는다.',
 '①事実関係と入力・状態を確認する。②' || c.key_points_ja || ' ③' || c.method_ja || ' 最後に結論と根拠をセットで記述する。',
 '과목 B는 키워드만 쓰는 문제가 아니라 지문 속 근거를 찾아 판단기준과 연결하는 것이 중요하다. 먼저 정상/이상 상태를 구분하고, 원인 후보를 좁힌 뒤, 답안에는 근거가 된 값·로그·조건을 명시한다.',
 '科目Bではkeywordだけでなく本文中の根拠を判断基準へ結び付けることが重要。正常/異常を分け、原因候補を絞り、答案には根拠となる値・log・条件を明記する。',
 3,1
FROM ap_concept_problem_types t
JOIN ap_concepts c ON c.id=t.concept_id
WHERE c.exam_part='B' AND c.is_published=1
AND NOT EXISTS (SELECT 1 FROM ap_concept_questions q WHERE q.problem_type_id=t.id);

-- B: add a second subquestion to every type so no Subject B type is represented by only one item.
INSERT OR IGNORE INTO ap_concept_questions
(problem_type_id,question_no,question_ko,question_ja,choices_ko_json,choices_ja_json,correct_choice,answer_ko,answer_ja,explanation_ko,explanation_ja,difficulty,sort_order)
SELECT t.id,2,
 '[소문항] 위 상황에서 잘못된 판단 또는 구현을 그대로 두었을 때 발생할 수 있는 문제를 하나 쓰고, ' || c.title_ko || '의 원리에 근거한 수정·대응 방법을 구체적으로 서술하시오.',
 '【小問】上記状況で誤った判断または実装を放置した場合に起こり得る問題を一つ挙げ、' || c.title_ja || 'の原理に基づく修正・対応方法を具体的に記述せよ。',
 NULL,NULL,NULL,
 '문제점은 ' || c.traps_ko || ' 대응은 ' || c.method_ko,
 '問題点は「' || c.traps_ja || '」。対応は「' || c.method_ja || '」。',
 '답은 문제점과 대책을 따로 쓰지 말고 인과관계로 연결한다. 어떤 조건 때문에 문제가 발생하는지, 어떤 변경이 그 조건을 제거하거나 완화하는지까지 설명해야 한다.',
 '問題点と対策を別々に並べず因果関係で結ぶ。どの条件で問題が起き、どの変更がその条件を除去・軽減するかまで説明する。',
 3,2
FROM ap_concept_problem_types t
JOIN ap_concepts c ON c.id=t.concept_id
WHERE c.exam_part='B' AND c.is_published=1
AND NOT EXISTS (SELECT 1 FROM ap_concept_questions q WHERE q.problem_type_id=t.id AND q.question_no=2);

-- Safety check: abort migration if a published A/B type is still empty.
CREATE TEMP TABLE _ap_empty_type_guard(v INTEGER CHECK(v=0));
INSERT INTO _ap_empty_type_guard(v)
SELECT COUNT(*) FROM ap_concept_problem_types t
JOIN ap_concepts c ON c.id=t.concept_id
WHERE c.is_published=1 AND c.exam_part IN ('A','B')
AND NOT EXISTS (SELECT 1 FROM ap_concept_questions q WHERE q.problem_type_id=t.id);
DROP TABLE _ap_empty_type_guard;
