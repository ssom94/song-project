-- seeds/test_data.sql
-- SONG Project reusable test data for local/remote D1 verification.
-- Reserved test ID range: 900000001+
-- Safe to execute repeatedly because fixed IDs are inserted with INSERT OR IGNORE.

PRAGMA foreign_keys = ON;

-- ============================================================
-- Blog categories
-- ============================================================
INSERT OR IGNORE INTO categories (id, parent_id, display_order, created_at, updated_at, deleted_at) VALUES
  (900000001, NULL, 10, '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL),
  (900000002, NULL, 20, '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL),
  (900000003, 900000001, 11, '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL);

INSERT OR IGNORE INTO category_translations (id, category_id, language_code, name, slug, description) VALUES
  (900000001, 900000001, 'ja', '開発', 'test-development', 'テスト用の開発カテゴリー'),
  (900000002, 900000001, 'ko', '개발', 'test-development-ko', '테스트용 개발 카테고리'),
  (900000003, 900000002, 'ja', '学習', 'test-learning', 'テスト用の学習カテゴリー'),
  (900000004, 900000002, 'ko', '학습', 'test-learning-ko', '테스트용 학습 카테고리'),
  (900000005, 900000003, 'ja', 'Cloud / AWS', 'test-cloud-aws', '開発配下の子カテゴリー'),
  (900000006, 900000003, 'ko', 'Cloud / AWS', 'test-cloud-aws-ko', '개발 하위 테스트 카테고리');

-- ============================================================
-- Blog tags
-- ============================================================
INSERT OR IGNORE INTO tags (id, created_at, updated_at, deleted_at) VALUES
  (900000001, '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL),
  (900000002, '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL),
  (900000003, '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL);

INSERT OR IGNORE INTO tag_translations (id, tag_id, language_code, name, slug, description) VALUES
  (900000001, 900000001, 'ja', 'Angular', 'test-angular', 'Angular test tag'),
  (900000002, 900000001, 'ko', 'Angular', 'test-angular-ko', 'Angular 테스트 태그'),
  (900000003, 900000002, 'ja', 'JLPT', 'test-jlpt', 'JLPT test tag'),
  (900000004, 900000002, 'ko', 'JLPT', 'test-jlpt-ko', 'JLPT 테스트 태그'),
  (900000005, 900000003, 'ja', 'AWS', 'test-aws', 'AWS test tag'),
  (900000006, 900000003, 'ko', 'AWS', 'test-aws-ko', 'AWS 테스트 태그');

-- ============================================================
-- Posts
-- 001: bilingual published + Markdown
-- 002: Korean published + Japanese pending => missing translation test
-- 003: draft => must not appear publicly
-- 004: private => must not appear publicly
-- ============================================================
INSERT OR IGNORE INTO posts (id, original_language, status, category_id, view_count, published_at, created_at, updated_at, deleted_at) VALUES
  (900000001, 'ja', 'published', 900000001, 12, '2026-08-28T01:00:00.000Z', '2026-08-28T00:00:00.000Z', '2026-08-28T01:00:00.000Z', NULL),
  (900000002, 'ko', 'published', 900000002, 3, '2026-08-29T01:00:00.000Z', '2026-08-29T00:00:00.000Z', '2026-08-29T01:00:00.000Z', NULL),
  (900000003, 'ja', 'draft', 900000001, 0, NULL, '2026-08-29T02:00:00.000Z', '2026-08-29T02:00:00.000Z', NULL),
  (900000004, 'ko', 'private', 900000003, 0, NULL, '2026-08-29T03:00:00.000Z', '2026-08-29T03:00:00.000Z', NULL);

INSERT OR IGNORE INTO post_translations (id, post_id, language_code, title, slug, content, excerpt, translation_status, created_at, updated_at) VALUES
  (900000001, 900000001, 'ja', 'Markdown 表示テスト', 'test-markdown-ja', '# Markdown テスト\n\n**太字**、*斜体*、`inline code` を確認します。\n\n- Angular\n- TypeScript\n- Java\n\n> 引用表示の確認\n\n```js\nconsole.log("SONG test");\n```\n\n| 項目 | 状態 |\n| --- | --- |\n| Markdown | OK |\n| Responsive | Check |', 'Markdown、コード、表、リストを確認する公開テスト記事です。', 'original', '2026-08-28T00:00:00.000Z', '2026-08-28T01:00:00.000Z'),
  (900000002, 900000001, 'ko', 'Markdown 표시 테스트', 'test-markdown-ko', '# Markdown 테스트\n\n**굵게**, *기울임*, `inline code` 표시를 확인합니다.\n\n- Angular\n- TypeScript\n- Java\n\n> 인용문 표시 확인\n\n```js\nconsole.log("SONG test");\n```\n\n| 항목 | 상태 |\n| --- | --- |\n| Markdown | OK |\n| Responsive | Check |', 'Markdown, 코드, 표, 목록을 확인하는 공개 테스트 게시글입니다.', 'translated', '2026-08-28T00:00:00.000Z', '2026-08-28T01:00:00.000Z'),
  (900000003, 900000002, 'ko', '한국어만 공개된 테스트 글', 'test-korean-only', '## 번역 미등록 테스트\n\n이 글은 한국어 번역만 공개되어 있습니다. 일본어 경로에서는 번역 없음 안내가 보여야 합니다.', '일본어 번역 없음 상태를 확인하기 위한 글입니다.', 'original', '2026-08-29T00:00:00.000Z', '2026-08-29T01:00:00.000Z'),
  (900000004, 900000002, 'ja', '日本語翻訳待ちテスト', 'test-korean-only-ja-pending', 'この内容は公開されてはいけません。', 'pending translation', 'pending', '2026-08-29T00:00:00.000Z', '2026-08-29T01:00:00.000Z'),
  (900000005, 900000003, 'ja', '下書きテスト', 'test-draft-ja', 'この投稿は公開一覧に出てはいけません。', 'draft test', 'original', '2026-08-29T02:00:00.000Z', '2026-08-29T02:00:00.000Z'),
  (900000006, 900000004, 'ko', '비공개 테스트', 'test-private-ko', '이 게시글은 공개 목록에 나오면 안 됩니다.', 'private test', 'original', '2026-08-29T03:00:00.000Z', '2026-08-29T03:00:00.000Z');

INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES
  (900000001, 900000001),
  (900000001, 900000003),
  (900000002, 900000002),
  (900000004, 900000003);

INSERT OR IGNORE INTO post_revisions (id, post_id, language_code, revision_no, title, slug, content, excerpt, status_snapshot, category_id_snapshot, change_type, change_summary, created_at) VALUES
  (900000001, 900000001, 'ja', 1, 'Markdown 表示テスト', 'test-markdown-ja', '# Markdown テスト', '初回テストデータ', 'published', 900000001, 'create', 'Seed data initial revision', '2026-08-28T00:00:00.000Z'),
  (900000002, 900000001, 'ko', 1, 'Markdown 표시 테스트', 'test-markdown-ko', '# Markdown 테스트', '초기 테스트 데이터', 'published', 900000001, 'translation_edit', 'Seed translated revision', '2026-08-28T01:00:00.000Z');

-- ============================================================
-- Comment moderation cases
-- ============================================================
INSERT OR IGNORE INTO comments (id, post_id, parent_id, admin_id, nickname, password_hash, content, ip_masked, language_code, status, created_at, updated_at, deleted_at) VALUES
  (900000001, 900000001, NULL, NULL, 'test-user-ja', 'seed-not-a-real-password-hash-1', '公開コメント表示テストです。', '203.0.113.xxx', 'ja', 'visible', '2026-08-28T02:00:00.000Z', '2026-08-28T02:00:00.000Z', NULL),
  (900000002, 900000001, 900000001, NULL, 'test-reply', 'seed-not-a-real-password-hash-2', '返信表示テストです。', '203.0.113.xxx', 'ja', 'visible', '2026-08-28T02:10:00.000Z', '2026-08-28T02:10:00.000Z', NULL),
  (900000003, 900000001, NULL, NULL, 'hidden-user', 'seed-not-a-real-password-hash-3', '管理画面では見えるが公開では非表示のテスト。', '198.51.100.xxx', 'ja', 'hidden', '2026-08-28T03:00:00.000Z', '2026-08-28T03:00:00.000Z', NULL),
  (900000004, 900000002, NULL, NULL, 'spam-user', 'seed-not-a-real-password-hash-4', '스팸 상태 테스트 댓글입니다.', '192.0.2.xxx', 'ko', 'spam', '2026-08-29T03:00:00.000Z', '2026-08-29T03:00:00.000Z', NULL);

-- ============================================================
-- Japanese parts of speech
-- ============================================================
INSERT OR IGNORE INTO parts_of_speech (id, name_ja, name_ko, parent_id, display_order, created_at, updated_at, deleted_at) VALUES
  (900000001, '名詞', '명사', NULL, 10, '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL),
  (900000002, '動詞', '동사', NULL, 20, '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL),
  (900000003, '形容詞', '형용사', NULL, 30, '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL),
  (900000004, 'サ変動詞', '사변동사', 900000002, 21, '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL);

-- ============================================================
-- Japanese study categories
-- ============================================================
INSERT OR IGNORE INTO japanese_categories (id, parent_id, name_ja, name_ko, description, display_order, created_at, updated_at, deleted_at) VALUES
  (900000001, NULL, 'JLPT', 'JLPT', 'JLPT 학습용', 10, '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL),
  (900000002, NULL, '仕事・面接', '업무·면접', '업무와 면접에 자주 쓰는 표현', 20, '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL),
  (900000003, NULL, '開発用語', '개발용어', 'IT/개발 용어', 30, '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL),
  (900000004, 900000001, 'N1重点', 'N1 중점', 'N1 우선 복습', 11, '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL);

-- ============================================================
-- Japanese words + examples
-- ============================================================
INSERT OR IGNORE INTO japanese_words (id, word, reading, meaning_ko, meaning_ja, jlpt_level_id, ai_status, note, created_at, updated_at, deleted_at) VALUES
  (900000001, '遂行', 'すいこう', '수행', '物事を最後までやりとげること', (SELECT id FROM jlpt_levels WHERE code='N1'), 'reviewed', '퀴즈 reading/meaning 테스트', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL),
  (900000002, '促進', 'そくしん', '촉진', '物事が早く進むようにすること', (SELECT id FROM jlpt_levels WHERE code='N1'), 'analyzed', '문장 빈칸 테스트', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL),
  (900000003, '妥当', 'だとう', '타당함', '適切で筋が通っていること', (SELECT id FROM jlpt_levels WHERE code='N1'), 'reviewed', NULL, '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL),
  (900000004, '実装', 'じっそう', '구현', '機能を実際に動く形にすること', (SELECT id FROM jlpt_levels WHERE code='N2'), 'reviewed', '개발용어 카테고리', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL),
  (900000005, '改善', 'かいぜん', '개선', 'より良い状態に改めること', (SELECT id FROM jlpt_levels WHERE code='N2'), 'reviewed', NULL, '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL),
  (900000006, '経験', 'けいけん', '경험', '実際に見たり行ったりすること', (SELECT id FROM jlpt_levels WHERE code='N3'), 'reviewed', NULL, '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL),
  (900000007, '曖昧', 'あいまい', '애매함', 'はっきりしないこと', (SELECT id FROM jlpt_levels WHERE code='N1'), 'not_analyzed', '오답 우선 테스트 후보', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL),
  (900000008, '取り組む', 'とりくむ', '몰두하다, 착수하다', '課題などに本格的に向き合う', (SELECT id FROM jlpt_levels WHERE code='N2'), 'reviewed', '동사 테스트', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL);

INSERT OR IGNORE INTO japanese_word_parts_of_speech (word_id, part_of_speech_id, is_primary) VALUES
  (900000001, 900000001, 1),
  (900000002, 900000004, 1),
  (900000003, 900000003, 1),
  (900000004, 900000001, 1),
  (900000005, 900000004, 1),
  (900000006, 900000001, 1),
  (900000007, 900000003, 1),
  (900000008, 900000002, 1);

INSERT OR IGNORE INTO japanese_word_categories (word_id, category_id) VALUES
  (900000001, 900000001), (900000001, 900000004), (900000001, 900000002),
  (900000002, 900000001), (900000002, 900000004),
  (900000003, 900000001), (900000003, 900000004),
  (900000004, 900000003),
  (900000005, 900000002),
  (900000006, 900000002),
  (900000007, 900000001), (900000007, 900000004),
  (900000008, 900000002);

INSERT OR IGNORE INTO japanese_word_examples (id, word_id, sentence_ja, reading, translation_ko, note, source_type, created_at, updated_at, deleted_at) VALUES
  (900000001, 900000001, '計画を最後まで遂行することが重要です。', 'けいかくをさいごまですいこうすることがじゅうようです。', '계획을 끝까지 수행하는 것이 중요합니다.', '빈칸 퀴즈 가능', 'manual', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL),
  (900000002, 900000002, '業務の効率化を促進します。', 'ぎょうむのこうりつかをそくしんします。', '업무 효율화를 촉진합니다.', '빈칸 퀴즈 가능', 'manual', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL),
  (900000003, 900000003, 'この判断は妥当だと思います。', 'このはんだんはだとうだとおもいます。', '이 판단은 타당하다고 생각합니다.', NULL, 'manual', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL),
  (900000004, 900000004, '画面の機能を実装しました。', 'がめんのきのうをじっそうしました。', '화면 기능을 구현했습니다.', NULL, 'manual', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL),
  (900000005, 900000005, '問題点を確認して改善します。', 'もんだいてんをかくにんしてかいぜんします。', '문제점을 확인하고 개선합니다.', NULL, 'manual', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL),
  (900000006, 900000008, '新しい技術の学習に取り組んでいます。', 'あたらしいぎじゅつのがくしゅうにとりくんでいます。', '새로운 기술 학습에 몰두하고 있습니다.', NULL, 'manual', '2026-08-30T00:00:00.000Z', '2026-08-30T00:00:00.000Z', NULL);

-- End of seed.
