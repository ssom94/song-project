# BLOG DESIGN NOTE 02
## D1 데이터베이스 설계 - 확정사항 정리 / D1データベース設計 - 決定事項

작성 기준일 / 作成基準日: 2026-08-29
설계 상태 / 設計状態: 진행 중 - Migration 작성 전

## 1. 설계 원칙 / 設計原則

- Cloudflare D1(SQLite 계열)을 사용한다.
- DB 내부 시간은 UTC ISO-8601 문자열을 기본으로 저장하고 화면에서 JST로 변환한다.
- 사이트 기본 언어는 일본어(`ja`), 추가 지원 언어는 한국어(`ko`)이다.
- 언어 독립 데이터와 번역 가능한 데이터를 분리한다.
- 게시글/카테고리/태그는 Soft Delete를 기본으로 한다.
- 주요 관리자 작업은 `audit_logs`, 게시글 내용 변경은 `post_revisions`로 추적한다.
- 실제 SQL migration은 모든 테이블 설계 확정 후 작성한다.

## 2. 전체 테이블 후보 / 全体テーブル候補

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

향후 조회수 중복 방지용 임시 저장 구조는 D1/KV/Cache 중 구현 단계에서 선택한다.
閲覧数の重複防止用一時データはD1/KV/Cacheから実装段階で選択する。

## 3. posts - 게시글 공통 정보 / 記事共通情報

번역 가능한 제목/본문/slug/요약은 `post_translations`로 이동하고 `posts`에는 언어와 무관한 공통 값만 저장한다.

| 컬럼 / 列 | 타입 / 型 | 규칙 / 役割 |
|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT |
| `original_language` | TEXT | 원문 언어. `ja` 또는 `ko` |
| `status` | TEXT | `draft` / `published` / `private`, 기본 `draft` |
| `category_id` | INTEGER | `categories.id`, 미분류 허용 |
| `thumbnail_key` | TEXT | R2 대표 이미지 key, 선택값 |
| `view_count` | INTEGER | 기본 0 |
| `published_at` | TEXT | 최초 공개 시각, 미공개는 NULL |
| `created_at` | TEXT | 최초 생성 시각 |
| `updated_at` | TEXT | 마지막 수정 시각 |
| `deleted_at` | TEXT | Soft Delete 시각, 정상은 NULL |

### 상태 정책 / ステータスポリシー

- `draft`: 작성 중, 관리자만 확인
- `published`: 공개
- `private`: 작성 완료지만 비공개
- `published_at`은 최초 공개 시각을 유지한다. 재공개 시에도 최초 공개일을 덮어쓰지 않고 변경 이력은 audit에 남긴다.

### 대표 이미지 / アイキャッチ画像

DB에는 전체 URL이 아닌 R2 key만 저장한다.

```text
thumbnail_key = posts/2026/08/cloudflare-blog-cover.webp
```

도메인/R2 공개 방식이 바뀌어도 DB 값은 유지하고 애플리케이션에서 URL을 조합한다.

## 4. post_translations - 게시글 언어별 내용 / 記事翻訳

| 컬럼 / 列 | 타입 / 型 | 규칙 / 役割 |
|---|---|---|
| `id` | INTEGER | PK |
| `post_id` | INTEGER | `posts.id` FK |
| `language_code` | TEXT | `ja` / `ko` |
| `title` | TEXT | NOT NULL |
| `slug` | TEXT | 언어별 URL용 slug |
| `content` | TEXT | Markdown 본문, NOT NULL |
| `excerpt` | TEXT | 목록용 요약, 선택값 |
| `translation_status` | TEXT | `original` / `pending` / `translated` / `reviewed` |
| `created_at` | TEXT | 번역 레코드 생성 시각 |
| `updated_at` | TEXT | 마지막 수정 시각 |

권장 제약:

```text
UNIQUE(post_id, language_code)
UNIQUE(language_code, slug)
```

### 작성/번역 흐름 / 執筆・翻訳フロー

```text
한국어 원문 작성(ko)
        ↓
ko = original 저장
        ↓
일본어 자동 번역 생성
        ↓
ja = translated
        ↓
관리자 확인/수정
        ↓
ja = reviewed
```

일본어 원문 작성 시에는 반대로 처리한다. 번역은 페이지 열람 시 실시간 생성하지 않고 작성/수정 시 생성해 DB에 저장한다.

### Markdown 표현 요구사항 / Markdown表示要件

- 코드 블록 및 언어별 Syntax Highlight
- 코드 내부 주석 가독성
- 코드 복사 버튼
- NOTE / TIP / WARNING 메모 블록
- 제목/문단/목록/표/링크/이미지

## 5. categories - 계층형 카테고리 공통 정보 / 階層カテゴリ共通情報

다국어 표시명/slug/설명은 `category_translations`로 분리한다.

| 컬럼 / 列 | 타입 / 型 | 규칙 / 役割 |
|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT |
| `parent_id` | INTEGER | 상위 `categories.id`, 최상위는 NULL |
| `display_order` | INTEGER | 기본 0 |
| `created_at` | TEXT | 생성 시각 |
| `updated_at` | TEXT | 수정 시각 |
| `deleted_at` | TEXT | Soft Delete |

`child_id` 컬럼은 두지 않는다. `parent_id = 대상 id`인 행을 검색하면 자식 목록을 알 수 있다. 계층 level도 저장하지 않고 필요할 때 부모 관계를 따라 계산한다.

### 계층 규칙 / 階層ルール

- DB는 여러 단계의 계층을 허용하되 실제 운영은 2~3단계 정도를 권장한다.
- 자기 자신을 부모로 지정할 수 없다.
- 자신의 하위 카테고리를 부모로 지정해 순환 구조를 만들 수 없다.
- 하위 카테고리가 있는 상위 카테고리는 즉시 삭제할 수 없고 먼저 하위 항목을 이동/삭제한다.
- 카테고리 이동은 `parent_id` 변경으로 처리하고 audit에 기록한다.
- 삭제는 Soft Delete이며 기존 게시글의 `category_id`를 유지해 과거 카테고리를 추적/복구할 수 있게 한다.

## 6. category_translations - 카테고리 번역 / カテゴリ翻訳

| 컬럼 / 列 | 타입 / 型 | 규칙 / 役割 |
|---|---|---|
| `id` | INTEGER | PK |
| `category_id` | INTEGER | `categories.id` FK |
| `language_code` | TEXT | `ja` / `ko` |
| `name` | TEXT | 화면 표시명 |
| `slug` | TEXT | URL용 |
| `description` | TEXT | 선택값 |
| `created_at` | TEXT | 생성 시각 |
| `updated_at` | TEXT | 수정 시각 |

권장 제약: `UNIQUE(category_id, language_code)`, `UNIQUE(language_code, slug)`.

예:

```text
category_id 1 / ja: Web開発 / web-development
category_id 1 / ko: 웹 개발 / web-development
```

## 7. tags - 태그 공통 정보 / タグ共通情報

태그는 계층을 사용하지 않는다.

| 컬럼 / 列 | 타입 / 型 | 규칙 / 役割 |
|---|---|---|
| `id` | INTEGER | PK, AUTOINCREMENT |
| `created_at` | TEXT | 생성 시각 |
| `updated_at` | TEXT | 수정 시각 |
| `deleted_at` | TEXT | Soft Delete |

태그 사용 글 수는 별도 `post_count` 컬럼으로 저장하지 않고 `post_tags`를 기준으로 계산한다.

## 8. tag_translations - 태그 번역 / タグ翻訳

| 컬럼 / 列 | 타입 / 型 | 규칙 / 役割 |
|---|---|---|
| `id` | INTEGER | PK |
| `tag_id` | INTEGER | `tags.id` FK |
| `language_code` | TEXT | `ja` / `ko` |
| `name` | TEXT | 표시명 |
| `slug` | TEXT | URL용 |
| `description` | TEXT | 선택값 |
| `created_at` | TEXT | 생성 시각 |
| `updated_at` | TEXT | 수정 시각 |

영어의 대소문자만 다른 `Cloudflare/cloudflare/CLOUDFLARE` 같은 중복은 애플리케이션에서 정규화하여 방지한다. 한국어/일본어/영어 표기는 서로 다른 번역 데이터로 관리할 수 있다.

## 9. post_tags - 게시글과 태그 연결 / 記事とタグの関連

| 컬럼 / 列 | 타입 / 型 | 규칙 / 役割 |
|---|---|---|
| `post_id` | INTEGER | `posts.id` FK |
| `tag_id` | INTEGER | `tags.id` FK |
| `created_at` | TEXT | 연결 생성 시각 |

`PRIMARY KEY(post_id, tag_id)` 또는 동일한 UNIQUE 제약으로 중복 태그 연결을 막는다. 현재 연결만 저장하고 태그 추가/제거 이력은 `audit_logs`로 추적한다.

## 10. post_revisions - 게시글 버전 이력 / 記事バージョン履歴

목표는 Git의 commit history처럼 과거 게시글 상태를 확인하고 필요하면 복구할 수 있게 하는 것이다.

예상 저장 항목:

```text
id
post_id
language_code
revision_no
title
slug
content
excerpt
status_snapshot
category_id_snapshot
thumbnail_key_snapshot
created_at
```

관리자 화면에서 다음 기능을 목표로 한다.

- 버전 목록
- 이전 버전 보기
- 현재 버전과 비교
- 선택 버전으로 복구

세부 제약과 revision 생성 시점은 이후 확정한다.

## 11. audit_logs - 관리자 감사 이력 / 管理者監査ログ

주요 작업을 공통 형식으로 저장한다.

예상 컬럼:

```text
id
entity_type
entity_id
action
before_data
after_data
admin_id
ip_address
created_at
```

`action` 후보: `create`, `update`, `delete`, `restore`, `publish`, `unpublish`.

예:

```text
entity_type = category
entity_id   = 15
action      = update
before_data = {"parent_id":1}
after_data  = {"parent_id":6}
```

## 12. 조회수 정책 / 閲覧数ポリシー

`posts.view_count`는 누적 숫자만 가진다.

```text
view_count INTEGER NOT NULL DEFAULT 0
```

동일 방문자 + 동일 게시글은 1시간 내 1회만 카운트한다.

```text
첫 조회      +1
10분 후      +0
59분 후      +0
1시간 이후   +1
```

중복 판정을 위해 원본 IP를 영구적인 조회 로그로 쌓는 것은 피하고, IP + User-Agent + post_id + 서버측 secret 등을 해시해 단기 판정하는 방식을 우선 검토한다.

## 13. 날짜 정책 / 日時ポリシー

DB에는 UTC ISO-8601 문자열을 저장한다.

```text
2026-08-29T14:35:22Z
```

화면에서는 JST로 변환해 `2026.08.29 23:35` 등으로 표시한다.

- `created_at`: 최초 생성
- `updated_at`: 마지막 수정
- `published_at`: 최초 공개
- `deleted_at`: Soft Delete

## 14. 다음 설계 대상 / 次の設計対象

다음 단계는 `comments` 테이블이다. 비회원 댓글의 닉네임, 비밀번호 해시, 댓글 본문, 원본 IP, 삭제/차단 상태, 작성일, 답글 구조 여부 등을 하나씩 결정한다. 댓글은 우선 작성된 언어 그대로 저장하고 자동 번역 대상에는 포함하지 않는 것을 기본안으로 한다.
