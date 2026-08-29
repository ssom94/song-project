# BLOG DESIGN NOTE 06
## D1 ER 다이어그램 / D1 ERダイアグラム

작성 기준일 / 作成基準日: 2026-08-29  
기준 Migration: `0001_admin_auth.sql` ~ `0005_protected_documents.sql`  
현재 D1 테이블 수: **28 tables**

---

## 1. 목적 / 目的

### 한국어
현재 실제 Migration으로 생성된 D1 테이블의 관계를 정리한다. 전체 스키마를 한 장에 모두 표시하면 관계선이 과도하게 복잡해지므로, 먼저 전체 모듈 관계를 보여주고 이후 관리자 인증, 블로그, 일본어 학습, 보호 문서 영역으로 나누어 상세 ERD를 제공한다.

### 日本語
現在のMigrationで実際に作成されるD1テーブルの関係を整理する。全テーブルを1枚に表示すると関係線が複雑になるため、まず全体モジュール構成を示し、その後、管理者認証、ブログ、日本語学習、保護ドキュメントの各領域に分けて詳細ERDを記載する。

---

## 2. 전체 모듈 관계 / 全体モジュール関係

```mermaid
flowchart LR
    ADMIN[관리자 인증\nAdmin Auth]
    BLOG[블로그 CMS\nBlog CMS]
    JP[일본어 학습\nJapanese Learning]
    DOC[보호 문서\nProtected Documents]
    AUDIT[감사 로그\nAudit Logs]
    R2[(Cloudflare R2)]

    ADMIN --> BLOG
    ADMIN --> JP
    ADMIN --> DOC
    ADMIN --> AUDIT
    BLOG --> AUDIT
    JP --> AUDIT
    DOC --> AUDIT

    BLOG -. thumbnail / body assets .-> R2
    JP -. handwriting PNG .-> R2
    DOC -. Excel / preview PNG .-> R2
```

> `audit_logs.entity_id`는 여러 종류의 엔티티를 가리키는 논리적 참조이며 DB Foreign Key로 강제하지 않는다.

---

## 3. 전체 테이블 목록 / 全テーブル一覧

### 관리자 인증 / 管理者認証
1. `admins`
2. `admin_sessions`
3. `admin_recovery_codes`

### 블로그 / ブログ
4. `categories`
5. `category_translations`
6. `tags`
7. `tag_translations`
8. `posts`
9. `post_translations`
10. `post_tags`
11. `comments`
12. `post_revisions`
13. `audit_logs`

### 일본어 학습 / 日本語学習
14. `jlpt_levels`
15. `parts_of_speech`
16. `japanese_categories`
17. `japanese_words`
18. `japanese_word_parts_of_speech`
19. `japanese_word_categories`
20. `japanese_word_examples`
21. `japanese_word_ai_drafts`
22. `japanese_handwriting_attempts`

### 보호 문서 / 保護ドキュメント
23. `protected_documents`
24. `protected_document_versions`
25. `protected_document_preview_pages`
26. `access_codes`
27. `protected_access_sessions`
28. `protected_access_logs`

---

# 4. 관리자 인증 ERD / 管理者認証ERD

```mermaid
erDiagram
    admins ||--o{ admin_sessions : owns
    admins ||--o{ admin_recovery_codes : owns
    admins ||--o{ comments : writes
    admins ||--o{ post_revisions : creates
    admins ||--o{ audit_logs : generates
    admins ||--o{ protected_document_versions : uploads
    admins ||--o{ access_codes : issues

    admins {
        INTEGER id PK
        TEXT username UK
        TEXT password_hash
        TEXT display_name
        TEXT email
        TEXT status
        INTEGER two_factor_enabled
        TEXT totp_secret_encrypted
        TEXT last_login_at
        INTEGER failed_login_count
        TEXT locked_until
        TEXT created_at
        TEXT updated_at
    }

    admin_sessions {
        INTEGER id PK
        INTEGER admin_id FK
        TEXT token_hash UK
        INTEGER remember_me
        TEXT ip_encrypted
        TEXT ip_hash
        TEXT country_code
        TEXT created_at
        TEXT last_seen_at
        TEXT expires_at
        TEXT revoked_at
    }

    admin_recovery_codes {
        INTEGER id PK
        INTEGER admin_id FK
        TEXT code_hash
        TEXT used_at
        TEXT created_at
    }

    audit_logs {
        INTEGER id PK
        INTEGER admin_id FK
        TEXT entity_type
        INTEGER entity_id
        TEXT action
        TEXT before_data
        TEXT after_data
        TEXT ip_encrypted
        TEXT ip_hash
        TEXT country_code
        TEXT created_at
    }
```

### 핵심 관계 / 主な関係

- `admins 1 : N admin_sessions`
- `admins 1 : N admin_recovery_codes`
- 한 관리자가 여러 댓글 답글, 게시글 리비전, 문서 버전, 접근 코드를 생성할 수 있다.
- 실제 세션 토큰과 복구 코드는 평문으로 DB에 저장하지 않는다.

---

# 5. 블로그 CMS ERD / ブログCMS ERD

```mermaid
erDiagram
    categories ||--o{ categories : parent_of
    categories ||--o{ category_translations : translated_as
    categories ||--o{ posts : contains
    categories ||--o{ post_revisions : snapshot_for

    tags ||--o{ tag_translations : translated_as
    tags ||--o{ post_tags : assigned

    posts ||--o{ post_translations : translated_as
    posts ||--o{ post_tags : tagged
    posts ||--o{ comments : has
    posts ||--o{ post_revisions : versioned_as

    comments ||--o{ comments : replies
    admins ||--o{ comments : admin_reply
    admins ||--o{ post_revisions : created_by

    categories {
        INTEGER id PK
        INTEGER parent_id FK
        INTEGER display_order
        TEXT created_at
        TEXT updated_at
        TEXT deleted_at
    }

    category_translations {
        INTEGER id PK
        INTEGER category_id FK
        TEXT language_code
        TEXT name
        TEXT slug
        TEXT description
        TEXT created_at
        TEXT updated_at
    }

    tags {
        INTEGER id PK
        TEXT created_at
        TEXT updated_at
        TEXT deleted_at
    }

    tag_translations {
        INTEGER id PK
        INTEGER tag_id FK
        TEXT language_code
        TEXT name
        TEXT slug
        TEXT description
        TEXT created_at
        TEXT updated_at
    }

    posts {
        INTEGER id PK
        TEXT original_language
        TEXT status
        INTEGER category_id FK
        TEXT thumbnail_key
        INTEGER view_count
        TEXT published_at
        TEXT created_at
        TEXT updated_at
        TEXT deleted_at
    }

    post_translations {
        INTEGER id PK
        INTEGER post_id FK
        TEXT language_code
        TEXT title
        TEXT slug
        TEXT content
        TEXT excerpt
        TEXT translation_status
        TEXT created_at
        TEXT updated_at
    }

    post_tags {
        INTEGER post_id PK,FK
        INTEGER tag_id PK,FK
        TEXT created_at
    }

    comments {
        INTEGER id PK
        INTEGER post_id FK
        INTEGER parent_id FK
        INTEGER admin_id FK
        TEXT nickname
        TEXT password_hash
        TEXT content
        TEXT ip_encrypted
        TEXT ip_hash
        TEXT ip_masked
        TEXT country_code
        TEXT language_code
        TEXT status
        TEXT created_at
        TEXT updated_at
        TEXT deleted_at
    }

    post_revisions {
        INTEGER id PK
        INTEGER post_id FK
        TEXT language_code
        INTEGER revision_no
        TEXT title
        TEXT slug
        TEXT content
        TEXT status_snapshot
        INTEGER category_id_snapshot FK
        TEXT change_type
        TEXT change_summary
        INTEGER created_by FK
        TEXT created_at
    }
```

### 관계 설명 / 関係説明

- `categories`는 `parent_id` 자기참조로 무제한 계층 구조를 표현한다.
- 카테고리와 태그의 표시명은 번역 테이블에서 `ja / ko`별로 관리한다.
- `posts`는 언어 독립 정보, `post_translations`는 제목/본문/slug 등 언어별 데이터를 담당한다.
- `posts N : M tags` 관계는 `post_tags` 중간 테이블로 구현한다.
- `comments.parent_id`는 댓글 답글 구조를 표현한다. UI는 1단계 답글까지만 표시한다.
- `post_revisions`는 게시글의 언어별 스냅샷이며 복원 시 과거 행을 수정하지 않고 새 revision을 추가한다.

---

# 6. 일본어 학습 ERD / 日本語学習ERD

```mermaid
erDiagram
    jlpt_levels ||--o{ japanese_words : classifies

    parts_of_speech ||--o{ parts_of_speech : parent_of
    parts_of_speech ||--o{ japanese_word_parts_of_speech : assigned

    japanese_categories ||--o{ japanese_categories : parent_of
    japanese_categories ||--o{ japanese_word_categories : assigned

    japanese_words ||--o{ japanese_word_parts_of_speech : has
    japanese_words ||--o{ japanese_word_categories : categorized
    japanese_words ||--o{ japanese_word_examples : has
    japanese_words ||--o{ japanese_word_ai_drafts : analyzed_by
    japanese_words ||--o{ japanese_handwriting_attempts : practiced_by

    jlpt_levels {
        INTEGER id PK
        TEXT code UK
        INTEGER display_order
        TEXT created_at
    }

    parts_of_speech {
        INTEGER id PK
        TEXT name_ja
        TEXT name_ko
        INTEGER parent_id FK
        INTEGER display_order
        TEXT created_at
        TEXT updated_at
        TEXT deleted_at
    }

    japanese_categories {
        INTEGER id PK
        INTEGER parent_id FK
        TEXT name_ja
        TEXT name_ko
        TEXT description
        INTEGER display_order
        TEXT created_at
        TEXT updated_at
        TEXT deleted_at
    }

    japanese_words {
        INTEGER id PK
        TEXT word
        TEXT reading
        TEXT meaning_ko
        TEXT meaning_ja
        INTEGER jlpt_level_id FK
        TEXT ai_status
        TEXT note
        TEXT created_at
        TEXT updated_at
        TEXT deleted_at
    }

    japanese_word_parts_of_speech {
        INTEGER word_id PK,FK
        INTEGER part_of_speech_id PK,FK
        INTEGER is_primary
        TEXT created_at
    }

    japanese_word_categories {
        INTEGER word_id PK,FK
        INTEGER category_id PK,FK
        TEXT created_at
    }

    japanese_word_examples {
        INTEGER id PK
        INTEGER word_id FK
        TEXT sentence_ja
        TEXT reading
        TEXT translation_ko
        TEXT note
        TEXT source_type
        TEXT created_at
        TEXT updated_at
        TEXT deleted_at
    }

    japanese_word_ai_drafts {
        INTEGER id PK
        INTEGER word_id FK
        TEXT input_word
        TEXT suggestion_json
        TEXT status
        TEXT provider
        TEXT model
        TEXT created_at
        TEXT reviewed_at
        TEXT applied_at
    }

    japanese_handwriting_attempts {
        INTEGER id PK
        INTEGER word_id FK
        TEXT stroke_data
        TEXT image_key
        INTEGER canvas_width
        INTEGER canvas_height
        TEXT created_at
        TEXT deleted_at
    }
```

### 관계 설명 / 関係説明

- 하나의 단어는 JLPT 급수 하나를 가질 수 있다.
- 단어와 품사는 N:M 관계이며 대표 품사는 한 단어당 최대 하나만 허용한다.
- 단어와 학습 분류도 N:M 관계이다.
- 한 단어에 여러 예문, AI 검토 초안, 필기 연습 기록을 연결할 수 있다.
- 필기 PNG는 R2에 저장하고 D1은 `image_key`와 `stroke_data`를 저장한다.

---

# 7. 보호 문서 ERD / 保護ドキュメントERD

```mermaid
erDiagram
    admins ||--o{ protected_document_versions : uploads
    admins ||--o{ access_codes : issues

    protected_documents ||--o{ protected_document_versions : versions
    protected_document_versions ||--o{ protected_document_preview_pages : previews
    protected_documents o|--o| protected_document_versions : current_version

    access_codes ||--o{ protected_access_sessions : authorizes
    access_codes ||--o{ protected_access_logs : logged
    protected_access_sessions ||--o{ protected_access_logs : produces
    protected_documents ||--o{ protected_access_logs : accessed
    protected_document_versions ||--o{ protected_access_logs : accessed_version

    protected_documents {
        INTEGER id PK
        TEXT slug UK
        TEXT document_type UK
        TEXT title_ja
        TEXT title_ko
        INTEGER current_version_id FK
        INTEGER is_active
        TEXT created_at
        TEXT updated_at
    }

    protected_document_versions {
        INTEGER id PK
        INTEGER document_id FK
        INTEGER version_no
        TEXT original_file_key UK
        TEXT original_file_name
        INTEGER original_file_size
        TEXT original_file_sha256
        TEXT change_summary
        TEXT conversion_status
        TEXT conversion_error
        INTEGER preview_page_count
        INTEGER uploaded_by FK
        TEXT created_at
    }

    protected_document_preview_pages {
        INTEGER id PK
        INTEGER version_id FK
        INTEGER page_no
        TEXT sheet_name
        TEXT image_key UK
        INTEGER width
        INTEGER height
        TEXT created_at
    }

    access_codes {
        INTEGER id PK
        TEXT code_hash UK
        TEXT code_hint
        TEXT label
        INTEGER allow_skill_sheet
        INTEGER allow_career_history
        INTEGER issued_by FK
        TEXT issued_at
        TEXT expires_at
        TEXT last_used_at
        INTEGER use_count
        TEXT revoked_at
    }

    protected_access_sessions {
        INTEGER id PK
        INTEGER access_code_id FK
        TEXT token_hash UK
        TEXT ip_encrypted
        TEXT ip_hash
        TEXT country_code
        TEXT created_at
        TEXT last_seen_at
        TEXT expires_at
        TEXT revoked_at
    }

    protected_access_logs {
        INTEGER id PK
        INTEGER access_code_id FK
        INTEGER session_id FK
        INTEGER document_id FK
        INTEGER version_id FK
        TEXT action
        TEXT ip_encrypted
        TEXT ip_hash
        TEXT ip_masked
        TEXT country_code
        TEXT created_at
    }
```

### 중요 포인트 / 重要ポイント

- `protected_documents`는 스킬표/직무경력서라는 논리적 문서 자체이다.
- Excel을 갱신할 때 기존 행을 덮어쓰지 않고 `protected_document_versions`에 새 버전을 추가한다.
- `current_version_id`는 현재 외부에 보여줄 정상 버전을 가리킨다.
- `protected_document_preview_pages`는 Excel에서 변환된 각 PNG 페이지를 관리한다.
- 접근 코드 원문은 저장하지 않고 `code_hash`만 저장한다.
- 코드 인증 후 방문자 세션을 별도로 생성하고 실제 token은 브라우저 Cookie에만 보관한다.
- 열람/Excel 다운로드 이력은 `protected_access_logs`에서 추적한다.

---

# 8. R2와 D1의 책임 분리 / R2とD1の責務分離

```mermaid
flowchart TB
    D1[(D1 Database)]
    R2[(R2 Object Storage)]

    D1 --> A[게시글/카테고리/태그/댓글]
    D1 --> B[사용자 및 접근 권한 메타데이터]
    D1 --> C[일본어 단어/예문/Stroke JSON]
    D1 --> D[문서 버전/R2 Object Key]

    R2 --> E[블로그 이미지]
    R2 --> F[필기 PNG]
    R2 --> G[스킬표·직무경력서 Excel 원본]
    R2 --> H[Excel Preview PNG]
```

### 원칙

- 구조화/검색/관계 데이터 → **D1**
- 이미지/Excel 등 Binary 파일 → **R2**
- D1에는 R2 파일 자체가 아니라 `key`만 저장한다.
- 보호 파일의 R2 URL을 직접 public으로 공개하지 않는다.

---

# 9. 삭제 정책과 FK 요약 / 削除ポリシー・FKまとめ

### Soft Delete 중심

다음 주요 콘텐츠는 기본적으로 `deleted_at`을 이용한다.

- `categories`
- `tags`
- `posts`
- `comments`
- `parts_of_speech`
- `japanese_categories`
- `japanese_words`
- `japanese_word_examples`
- `japanese_handwriting_attempts`

### Cascade가 사용되는 대표 관계

- `admins -> admin_sessions`
- `admins -> admin_recovery_codes`
- `posts -> post_translations`
- `posts -> post_tags`
- `posts -> comments`
- `posts -> post_revisions`
- `japanese_words -> examples / relation tables / handwriting`
- `protected_document_versions -> preview_pages`
- `access_codes -> protected_access_sessions`

### RESTRICT를 사용하는 대표 관계

- 카테고리 부모 관계
- 품사 부모 관계
- 일본어 학습 분류 부모 관계
- 보호 문서 -> 문서 버전

삭제 전에 자식/이력 존재 여부를 확인하기 위함이다.

---

# 10. ERD 유지보수 규칙 / ERDメンテナンスルール

새 Migration에서 다음 작업을 할 경우 이 문서도 갱신한다.

1. 새 테이블 추가
2. FK 추가/삭제
3. PK 또는 UNIQUE 구조 변경
4. 테이블 역할 변경
5. R2와 연결되는 새로운 Object Key 추가

Migration SQL을 **실제 스키마의 Source of Truth**로 하고, 이 ERD 문서는 사람이 이해하기 위한 설계 뷰로 유지한다.
