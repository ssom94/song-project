-- 0075 AP Japanese exam-style terminology normalization
-- Normalizes unnecessary lowercase English prose in Japanese-facing AP content.
-- Standard technical acronyms such as CPU, TCP, UDP, SQL, DNS, TLS, RAID, UML, EVM remain unchanged.
-- AP tables are small; these bounded updates do not perform broad application-data scans.
PRAGMA foreign_keys = ON;

-- Concepts: normalize Japanese-facing prose only.
UPDATE ap_concepts
SET
  definition_ja = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(definition_ja,
    'server','サーバ'),'browser','ブラウザ'),'data','データ'),'code','コード'),'node','ノード'),'sort','ソート'),'memory','メモリ'),'process','プロセス'),'thread','スレッド'),'cache','キャッシュ'),'disk','ディスク'),'backup','バックアップ'),'service','サービス'),'system','システム'),'project','プロジェクト'),'user','ユーザ'),'application','アプリケーション'),'network','ネットワーク'),'address','アドレス'),'protocol','プロトコル'),
  principle_ja = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(principle_ja,
    'server','サーバ'),'browser','ブラウザ'),'data','データ'),'code','コード'),'node','ノード'),'sort','ソート'),'memory','メモリ'),'process','プロセス'),'thread','スレッド'),'cache','キャッシュ'),'disk','ディスク'),'backup','バックアップ'),'service','サービス'),'system','システム'),'project','プロジェクト'),'user','ユーザ'),'application','アプリケーション'),'network','ネットワーク'),'address','アドレス'),'protocol','プロトコル'),
  key_points_ja = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(key_points_ja,
    'server','サーバ'),'browser','ブラウザ'),'data','データ'),'code','コード'),'node','ノード'),'sort','ソート'),'memory','メモリ'),'process','プロセス'),'thread','スレッド'),'cache','キャッシュ'),'disk','ディスク'),'backup','バックアップ'),'service','サービス'),'system','システム'),'project','プロジェクト'),'user','ユーザ'),'application','アプリケーション'),'network','ネットワーク'),'address','アドレス'),'protocol','プロトコル'),
  method_ja = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(method_ja,
    'server','サーバ'),'browser','ブラウザ'),'data','データ'),'code','コード'),'node','ノード'),'sort','ソート'),'memory','メモリ'),'process','プロセス'),'thread','スレッド'),'cache','キャッシュ'),'disk','ディスク'),'backup','バックアップ'),'service','サービス'),'system','システム'),'project','プロジェクト'),'user','ユーザ'),'application','アプリケーション'),'network','ネットワーク'),'address','アドレス'),'protocol','プロトコル'),
  traps_ja = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(traps_ja,
    'server','サーバ'),'browser','ブラウザ'),'data','データ'),'code','コード'),'node','ノード'),'sort','ソート'),'memory','メモリ'),'process','プロセス'),'thread','スレッド'),'cache','キャッシュ'),'disk','ディスク'),'backup','バックアップ'),'service','サービス'),'system','システム'),'project','プロジェクト'),'user','ユーザ'),'application','アプリケーション'),'network','ネットワーク'),'address','アドレス'),'protocol','プロトコル'),
  memory_ja = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(memory_ja,
    'server','サーバ'),'browser','ブラウザ'),'data','データ'),'code','コード'),'node','ノード'),'sort','ソート'),'memory','メモリ'),'process','プロセス'),'thread','スレッド'),'cache','キャッシュ'),'disk','ディスク'),'backup','バックアップ'),'service','サービス'),'system','システム'),'project','プロジェクト'),'user','ユーザ'),'application','アプリケーション'),'network','ネットワーク'),'address','アドレス'),'protocol','プロトコル'),
  example_ja = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(example_ja,
    'server','サーバ'),'browser','ブラウザ'),'data','データ'),'code','コード'),'node','ノード'),'sort','ソート'),'memory','メモリ'),'process','プロセス'),'thread','スレッド'),'cache','キャッシュ'),'disk','ディスク'),'backup','バックアップ'),'service','サービス'),'system','システム'),'project','プロジェクト'),'user','ユーザ'),'application','アプリケーション'),'network','ネットワーク'),'address','アドレス'),'protocol','プロトコル')
WHERE exam_part IN ('A','B');

-- Second terminology pass for common infrastructure/management words.
UPDATE ap_concepts
SET
  definition_ja = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(definition_ja,
    'host','ホスト'),'route','経路'),'flow','フロー'),'request','リクエスト'),'query','クエリ'),'login','ログイン'),'account','アカウント'),'session','セッション'),'password','パスワード'),'hash','ハッシュ'),'salt','ソルト'),'risk','リスク'),'cost','コスト'),'schedule','スケジュール'),'monitoring','監視'),'review','レビュー'),'release','リリース'),'feedback','フィードバック'),'module','モジュール'),'source','ソース'),
  principle_ja = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(principle_ja,
    'host','ホスト'),'route','経路'),'flow','フロー'),'request','リクエスト'),'query','クエリ'),'login','ログイン'),'account','アカウント'),'session','セッション'),'password','パスワード'),'hash','ハッシュ'),'salt','ソルト'),'risk','リスク'),'cost','コスト'),'schedule','スケジュール'),'monitoring','監視'),'review','レビュー'),'release','リリース'),'feedback','フィードバック'),'module','モジュール'),'source','ソース'),
  key_points_ja = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(key_points_ja,
    'host','ホスト'),'route','経路'),'flow','フロー'),'request','リクエスト'),'query','クエリ'),'login','ログイン'),'account','アカウント'),'session','セッション'),'password','パスワード'),'hash','ハッシュ'),'salt','ソルト'),'risk','リスク'),'cost','コスト'),'schedule','スケジュール'),'monitoring','監視'),'review','レビュー'),'release','リリース'),'feedback','フィードバック'),'module','モジュール'),'source','ソース'),
  method_ja = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(method_ja,
    'host','ホスト'),'route','経路'),'flow','フロー'),'request','リクエスト'),'query','クエリ'),'login','ログイン'),'account','アカウント'),'session','セッション'),'password','パスワード'),'hash','ハッシュ'),'salt','ソルト'),'risk','リスク'),'cost','コスト'),'schedule','スケジュール'),'monitoring','監視'),'review','レビュー'),'release','リリース'),'feedback','フィードバック'),'module','モジュール'),'source','ソース'),
  traps_ja = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(traps_ja,
    'host','ホスト'),'route','経路'),'flow','フロー'),'request','リクエスト'),'query','クエリ'),'login','ログイン'),'account','アカウント'),'session','セッション'),'password','パスワード'),'hash','ハッシュ'),'salt','ソルト'),'risk','リスク'),'cost','コスト'),'schedule','スケジュール'),'monitoring','監視'),'review','レビュー'),'release','リリース'),'feedback','フィードバック'),'module','モジュール'),'source','ソース'),
  memory_ja = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(memory_ja,
    'host','ホスト'),'route','経路'),'flow','フロー'),'request','リクエスト'),'query','クエリ'),'login','ログイン'),'account','アカウント'),'session','セッション'),'password','パスワード'),'hash','ハッシュ'),'salt','ソルト'),'risk','リスク'),'cost','コスト'),'schedule','スケジュール'),'monitoring','監視'),'review','レビュー'),'release','リリース'),'feedback','フィードバック'),'module','モジュール'),'source','ソース'),
  example_ja = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(example_ja,
    'host','ホスト'),'route','経路'),'flow','フロー'),'request','リクエスト'),'query','クエリ'),'login','ログイン'),'account','アカウント'),'session','セッション'),'password','パスワード'),'hash','ハッシュ'),'salt','ソルト'),'risk','リスク'),'cost','コスト'),'schedule','スケジュール'),'monitoring','監視'),'review','レビュー'),'release','リリース'),'feedback','フィードバック'),'module','モジュール'),'source','ソース')
WHERE exam_part IN ('A','B');

-- Question-facing Japanese fields use the same terminology policy.
UPDATE ap_concept_questions
SET
  question_ja = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(question_ja,
    'server','サーバ'),'browser','ブラウザ'),'data','データ'),'code','コード'),'node','ノード'),'sort','ソート'),'memory','メモリ'),'process','プロセス'),'thread','スレッド'),'cache','キャッシュ'),'disk','ディスク'),'backup','バックアップ'),'service','サービス'),'system','システム'),'project','プロジェクト'),'user','ユーザ'),'application','アプリケーション'),'network','ネットワーク'),'address','アドレス'),'protocol','プロトコル'),
  choices_ja_json = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(choices_ja_json,
    'server','サーバ'),'browser','ブラウザ'),'data','データ'),'code','コード'),'node','ノード'),'sort','ソート'),'memory','メモリ'),'process','プロセス'),'thread','スレッド'),'cache','キャッシュ'),'disk','ディスク'),'backup','バックアップ'),'service','サービス'),'system','システム'),'project','プロジェクト'),'user','ユーザ'),'application','アプリケーション'),'network','ネットワーク'),'address','アドレス'),'protocol','プロトコル'),
  answer_ja = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(answer_ja,
    'server','サーバ'),'browser','ブラウザ'),'data','データ'),'code','コード'),'node','ノード'),'sort','ソート'),'memory','メモリ'),'process','プロセス'),'thread','スレッド'),'cache','キャッシュ'),'disk','ディスク'),'backup','バックアップ'),'service','サービス'),'system','システム'),'project','プロジェクト'),'user','ユーザ'),'application','アプリケーション'),'network','ネットワーク'),'address','アドレス'),'protocol','プロトコル'),
  explanation_ja = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(explanation_ja,
    'server','サーバ'),'browser','ブラウザ'),'data','データ'),'code','コード'),'node','ノード'),'sort','ソート'),'memory','メモリ'),'process','プロセス'),'thread','スレッド'),'cache','キャッシュ'),'disk','ディスク'),'backup','バックアップ'),'service','サービス'),'system','システム'),'project','プロジェクト'),'user','ユーザ'),'application','アプリケーション'),'network','ネットワーク'),'address','アドレス'),'protocol','プロトコル')
WHERE problem_type_id IN (
  SELECT pt.id FROM ap_concept_problem_types pt
  JOIN ap_concepts c ON c.id = pt.concept_id
  WHERE c.exam_part IN ('A','B')
);

UPDATE ap_concept_questions
SET
  question_ja = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(question_ja,
    'host','ホスト'),'route','経路'),'flow','フロー'),'request','リクエスト'),'query','クエリ'),'login','ログイン'),'account','アカウント'),'session','セッション'),'password','パスワード'),'hash','ハッシュ'),'salt','ソルト'),'risk','リスク'),'cost','コスト'),'schedule','スケジュール'),'monitoring','監視'),'review','レビュー'),'release','リリース'),'feedback','フィードバック'),'module','モジュール'),'source','ソース'),
  choices_ja_json = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(choices_ja_json,
    'host','ホスト'),'route','経路'),'flow','フロー'),'request','リクエスト'),'query','クエリ'),'login','ログイン'),'account','アカウント'),'session','セッション'),'password','パスワード'),'hash','ハッシュ'),'salt','ソルト'),'risk','リスク'),'cost','コスト'),'schedule','スケジュール'),'monitoring','監視'),'review','レビュー'),'release','リリース'),'feedback','フィードバック'),'module','モジュール'),'source','ソース'),
  answer_ja = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(answer_ja,
    'host','ホスト'),'route','経路'),'flow','フロー'),'request','リクエスト'),'query','クエリ'),'login','ログイン'),'account','アカウント'),'session','セッション'),'password','パスワード'),'hash','ハッシュ'),'salt','ソルト'),'risk','リスク'),'cost','コスト'),'schedule','スケジュール'),'monitoring','監視'),'review','レビュー'),'release','リリース'),'feedback','フィードバック'),'module','モジュール'),'source','ソース'),
  explanation_ja = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(explanation_ja,
    'host','ホスト'),'route','経路'),'flow','フロー'),'request','リクエスト'),'query','クエリ'),'login','ログイン'),'account','アカウント'),'session','セッション'),'password','パスワード'),'hash','ハッシュ'),'salt','ソルト'),'risk','リスク'),'cost','コスト'),'schedule','スケジュール'),'monitoring','監視'),'review','レビュー'),'release','リリース'),'feedback','フィードバック'),'module','モジュール'),'source','ソース')
WHERE problem_type_id IN (
  SELECT pt.id FROM ap_concept_problem_types pt
  JOIN ap_concepts c ON c.id = pt.concept_id
  WHERE c.exam_part IN ('A','B')
);
