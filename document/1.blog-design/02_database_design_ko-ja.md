# BLOG DESIGN NOTE 02
## D1 데이터베이스 설계 - 확정사항 정리 / D1データベース設計 - 決定事項

작성 기준일 / 作成基準日: 2026-08-29  
설계 상태 / 設計状態: 진행 중 - Migration 작성 전  
문서 버전 / 文書版: v2 - 다국어 블로그 + 일본어 학습 모듈 반영

## 1. 공통 설계 원칙 / 共通設計原則

- Cloudflare D1(SQLite 계열)을 사용한다.
- DB 시간은 UTC ISO-8601 문자열로 저장하고 화면에서 JST로 변환한다.
- 사이트 기본 언어는 `ja`, 지원 언어는 `ja`, `ko`이다.
- 언어 독립 데이터와 번역 가능한 데이터를 분리한다.
- 주요 콘텐츠는 Soft Delete를 기본으로 한다.
- 주요 관리자 작업은 `audit_logs`, 게시글 내용 변경은 `post_revisions`로 추적한다.
- 실제 SQL migration은 테이블 설계가 확정된 후 작성한다.

## 2. 전체 테이블 후보 / 全テーブル候補

### 블로그 / ブログ
```text
admins
posts
post_translations
post_revisions
categories
category_translations
tags
tag_translations
post_tags
comments
audit_logs
```

### 일본어 학습 / 日本語学習
```text
japanese_words
japanese_word_examples
jlpt_levels
parts_of_speech
japanese_word_parts_of_speech
japanese_categories
japanese_word_categories
japanese_word_ai_drafts
japanese_handwriting_attempts
```

선택 확장: `japanese_word_progress`.

## 3. posts - 게시글 공통 정보 / 記事共通情報

| 컬럼 | 타입 | 역할 |
|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT |
| `original_language` | TEXT | `ja` 또는 `ko` |
| `status` | TEXT | `draft`/`published`/`private`, 기본 `draft` |
| `category_id` | INTEGER | `categories.id`, NULL 허용 |
| `thumbnail_key` | TEXT | R2 대표 이미지 key |
| `view_count` | INTEGER | 기본 0 |
| `published_at` | TEXT | 최초 공개 시각 |
| `created_at` | TEXT | 최초 생성 |
| `updated_at` | TEXT | 마지막 수정 |
| `deleted_at` | TEXT | Soft Delete |

`published_at`은 최초 공개일을 유지하고 재공개 이력은 audit에 기록한다.

## 4. post_translations - 게시글 언어별 내용 / 記事翻訳

| 컬럼 | 타입 | 역할 |
|---|---|---|
| `id` | INTEGER | PK |
| `post_id` | INTEGER | posts FK |
| `language_code` | TEXT | `ja` / `ko` |
| `title` | TEXT | NOT NULL |
| `slug` | TEXT | 언어별 URL |
| `content` | TEXT | Markdown, NOT NULL |
| `excerpt` | TEXT | 선택 요약 |
| `translation_status` | TEXT | `original`/`pending`/`translated`/`reviewed` |
| `created_at` | TEXT | 생성 |
| `updated_at` | TEXT | 수정 |

권장 제약: `UNIQUE(post_id, language_code)`, `UNIQUE(language_code, slug)`.

Markdown 렌더링 요구: Syntax Highlight, 코드 주석, 복사 버튼, NOTE/TIP/WARNING, 표/링크/이미지.

## 5. categories + category_translations / カテゴリ

### categories
`id`, `parent_id`, `display_order`, `created_at`, `updated_at`, `deleted_at`.

- `parent_id` 자기참조로 계층 구성.
- `child_id`, `level`은 저장하지 않고 조회 시 계산.
- 자기 자신/자손을 부모로 지정하는 순환 구조 금지.
- 자식이 있는 상위 카테고리는 바로 삭제하지 못하게 한다.
- 삭제는 Soft Delete로 기존 게시글의 과거 카테고리 추적/복구 가능.

### category_translations
`id`, `category_id`, `language_code`, `name`, `slug`, `description`, `created_at`, `updated_at`.

권장 제약: `UNIQUE(category_id, language_code)`, `UNIQUE(language_code, slug)`.

## 6. tags + tag_translations + post_tags / タグ

### tags
`id`, `created_at`, `updated_at`, `deleted_at`. 비계층형.

### tag_translations
`id`, `tag_id`, `language_code`, `name`, `slug`, `description`, `created_at`, `updated_at`.

### post_tags
`post_id`, `tag_id`, `created_at`, `PRIMARY KEY(post_id, tag_id)`.

태그 추가/제거 이력은 `audit_logs`로 추적한다.

## 7. post_revisions / 記事バージョン履歴

목표: Git log처럼 이전 게시글 상태를 보고 비교/복구.

예상 항목: `id`, `post_id`, `language_code`, `revision_no`, `title`, `slug`, `content`, `excerpt`, `status_snapshot`, `category_id_snapshot`, `thumbnail_key_snapshot`, `created_at`.

## 8. audit_logs / 管理者監査ログ

예상 항목: `id`, `entity_type`, `entity_id`, `action`, `before_data`, `after_data`, `admin_id`, `ip_address`, `created_at`.

`action`: `create`, `update`, `delete`, `restore`, `publish`, `unpublish` 등.

## 9. 조회수 / 閲覧数

`posts.view_count INTEGER NOT NULL DEFAULT 0`.

동일 방문자 + 동일 게시글은 1시간 내 1회만 카운트한다. 원본 IP를 조회 로그로 장기 누적하기보다 `IP + User-Agent + post_id + server secret` 등의 해시를 단기 중복 판정에 사용하는 방식을 우선 검토한다.

## 10. japanese_words - 일본어 단어 / 日本語単語

| 컬럼 | 타입 | 역할 |
|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT |
| `word` | TEXT | 표기(한자/가나) NOT NULL |
| `reading` | TEXT | 히라가나 읽기 |
| `meaning_ko` | TEXT | 한국어 뜻 |
| `meaning_ja` | TEXT | 일본어 설명 |
| `jlpt_level_id` | INTEGER | JLPT 급수 FK, 선택값 |
| `ai_status` | TEXT | `not_analyzed`/`analyzed`/`reviewed` |
| `note` | TEXT | 관리자 메모 |
| `created_at` | TEXT | 생성 |
| `updated_at` | TEXT | 수정 |
| `deleted_at` | TEXT | Soft Delete |

하나의 단어가 여러 품사/분류에 해당할 수 있어 품사와 학습 분류는 중간 테이블로 연결한다.

## 11. jlpt_levels / JLPTレベル

`id`, `code`, `display_order`, `created_at`.

예: N1, N2, N3, N4, N5. `code`는 UNIQUE.

AI가 JLPT 급수를 추천할 수 있으나 최종값은 관리자가 검토한다.

## 12. parts_of_speech + japanese_word_parts_of_speech / 品詞

### parts_of_speech
`id`, `name_ja`, `name_ko`, `parent_id`, `display_order`, `created_at`, `updated_at`, `deleted_at`.

예: 名詞/명사, 動詞/동사, サ変名詞, 五段動詞, 一段動詞, い形容詞, な形容詞, 副詞 등. 필요하면 `parent_id`로 대분류-세부분류 가능.

### japanese_word_parts_of_speech
`word_id`, `part_of_speech_id`, `is_primary`, `created_at`, UNIQUE(`word_id`,`part_of_speech_id`).

## 13. japanese_categories + japanese_word_categories / 学習分類

### japanese_categories
`id`, `parent_id`, `name_ja`, `name_ko`, `description`, `display_order`, `created_at`, `updated_at`, `deleted_at`.

예: ビジネス/비즈니스, 開発/개발, 日常/일상, 面接/면접, 感情/감정 등. 학습 분류도 필요하면 계층형으로 확장 가능.

### japanese_word_categories
`word_id`, `category_id`, `created_at`, UNIQUE(`word_id`,`category_id`).

## 14. japanese_word_examples - 예문 / 例文

| 컬럼 | 타입 | 역할 |
|---|---|---|
| `id` | INTEGER | PK |
| `word_id` | INTEGER | japanese_words FK |
| `sentence_ja` | TEXT | 일본어 예문 NOT NULL |
| `reading` | TEXT | 예문 히라가나, 선택 |
| `translation_ko` | TEXT | 한국어 번역 |
| `note` | TEXT | 문법/사용 메모 |
| `source_type` | TEXT | `manual`/`ai` 등 |
| `created_at` | TEXT | 생성 |
| `updated_at` | TEXT | 수정 |
| `deleted_at` | TEXT | Soft Delete |

한 단어에 여러 예문을 연결한다.

## 15. japanese_word_ai_drafts - AI 제안 검토 / AI提案レビュー

AI 결과를 단어 본 테이블에 즉시 확정하지 않고 검토용 초안으로 저장한다.

예상 컬럼: `id`, `word_id`, `input_word`, `suggestion_json`, `status`, `provider`, `model`, `created_at`, `reviewed_at`, `applied_at`.

`status`: `pending`, `reviewed`, `applied`, `rejected`.

`suggestion_json` 후보: reading, meaning_ko, meaning_ja, jlpt_level, parts_of_speech, categories, examples.

흐름: 단어 입력 -> AI 분석 -> 후보 표시 -> 관리자 수정/선택 -> 적용.

## 16. japanese_handwriting_attempts - 필기 연습 / 手書き練習

Canvas에서 마우스/터치/펜으로 그린 필기를 저장한다.

| 컬럼 | 타입 | 역할 |
|---|---|---|
| `id` | INTEGER | PK |
| `word_id` | INTEGER | japanese_words FK |
| `stroke_data` | TEXT | JSON 좌표/획 데이터 |
| `image_key` | TEXT | R2 PNG key |
| `canvas_width` | INTEGER | 저장 당시 폭 |
| `canvas_height` | INTEGER | 저장 당시 높이 |
| `created_at` | TEXT | 연습 시각 |
| `deleted_at` | TEXT | 선택적 Soft Delete |

R2 예: `japanese/handwriting/word-152/20260829-001.png`.

이미지만 저장하지 않고 stroke JSON도 저장하여 향후 획 재생, 과거 시도 비교, 정확도/획순 분석으로 확장한다.

## 17. 선택 확장 - japanese_word_progress / 復習進捗

현재는 필수 아님. 향후 즐겨찾기, 암기 상태, 정답/오답 횟수, 마지막/다음 복습일을 관리할 때 추가한다.

## 18. 날짜/삭제/AI 공통 정책 / 共通ポリシー

- 날짜는 UTC ISO-8601 저장, 화면은 JST.
- AI 제안은 관리자 검토 후 적용.
- 단어/예문/분류의 중요한 삭제는 Soft Delete를 우선.
- AI 적용, 단어 수정, 분류 변경도 필요 시 `audit_logs` 대상에 포함한다.

## 19. 다음 설계 대상 / 次の設計対象

블로그 설계의 다음 단계는 `comments` 테이블이다. 비회원 닉네임, 비밀번호 해시, 댓글 본문, 실제 IP, 삭제/차단, 작성 시각, 답글 구조를 하나씩 확정한다.
