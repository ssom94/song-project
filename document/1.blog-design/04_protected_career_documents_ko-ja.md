# BLOG DESIGN NOTE 04
## 스킬표·직무경력서 보호 문서 모듈 / スキルシート・職務経歴書 保護ドキュメントモジュール

작성 기준일 / 作成基準日: 2026-08-29
설계 상태 / 設計状態: 요구사항 확정 중

## 1. 목적 / 目的

블로그 상단 메뉴에 `홈 / 일본어 모듈 / 스킬표 / 직무경력서`를 제공한다. 게시글 카테고리는 좌측 메뉴에 표시한다. 스킬표와 직무경력서는 일반 공개하지 않고 관리자가 발급한 접근 코드를 입력한 사용자만 열람할 수 있게 한다.

ブログ上部メニューに `ホーム / 日本語モジュール / スキルシート / 職務経歴書` を配置し、記事カテゴリは左側メニューへ表示する。スキルシートと職務経歴書は一般公開せず、管理者が発行したアクセスコードを入力した利用者のみ閲覧できるようにする。

## 2. 접근 코드 / アクセスコード

- 관리자가 `/admin/access-codes`에서 코드를 발급한다.
- 기본 유효기간은 발급일로부터 30일이다.
- 관리자는 만료 전에도 즉시 코드를 폐기(revoke)할 수 있다.
- 접근 범위(scope)는 `skill_sheet`, `career_history`, 또는 `both`를 선택할 수 있게 설계한다. 기본값은 `both`를 권장한다.
- 실제 코드는 발급 직후 한 번 보여주고 DB에는 원문 대신 hash를 저장한다.
- 코드 검증 성공 후 짧은 접근 세션 쿠키를 발급해 페이지 이동마다 코드를 다시 입력하지 않게 한다.
- 만료 또는 폐기된 코드는 즉시 접근 불가 처리한다.
- 코드 발급/폐기 및 보호 문서 접근/다운로드는 감사 로그 또는 별도 접근 로그에 기록할 수 있게 한다.

## 3. 공개 화면 / 公開画面

예상 라우트:

```text
/{lang}/skill-sheet
/{lang}/career-history
/{lang}/protected/access
```

보호 문서 메뉴를 선택했는데 유효한 접근 세션이 없으면 코드 입력 화면으로 이동한다.

```text
접근 코드
[ XXXX-XXXX-XXXX ]

[확인]
```

성공 후 스킬표/직무경력서를 이미지 프리뷰로 보여주고, 허용된 사용자는 현재 버전의 원본 Excel 파일도 다운로드할 수 있다.

## 4. Excel 업로드 및 이미지 프리뷰 / Excelアップロードと画像プレビュー

관리자는 `.xlsx` 파일을 업로드한다.

```text
Excel 업로드
   ↓
원본 .xlsx R2 저장
   ↓
프리뷰 변환 작업
   ↓
Sheet/Page별 이미지 생성
   ↓
이미지 R2 저장
   ↓
웹 화면에서 이미지 표시
```

원본 Excel 파일은 다운로드용으로 보존하고, 사이트 열람 화면에서는 변환된 이미지들을 세로 또는 페이지 방식으로 표시한다.

예시 R2 구조:

```text
protected-documents/
├─ skill-sheet/
│  ├─ v0001/
│  │  ├─ original.xlsx
│  │  └─ preview/
│  │     ├─ page-001.png
│  │     └─ page-002.png
│  └─ v0002/...
└─ career-history/
   └─ v0001/...
```

Excel → 이미지 변환 방식은 구현 단계에서 별도 변환 환경/라이브러리를 결정한다. Cloudflare Worker 단독으로 Excel 화면을 완전히 동일하게 렌더링하는 것은 제한이 있을 수 있으므로, 원본 보존과 프리뷰 생성 책임을 분리한다.

## 5. 문서 버전 관리 / ドキュメントバージョン管理

스킬표 또는 직무경력서를 갱신할 때 기존 파일을 덮어쓰지 않는다. 업로드할 때마다 새로운 버전을 만든다.

```text
스킬표
v1  2026-08-01
v2  2026-08-15
v3  2026-08-29  ← 현재 버전
```

관리자 화면 `/admin/documents`에서 다음을 제공한다.

- 현재 버전 확인
- 새 Excel 업로드
- 변경 메모 입력
- 버전 이력 조회
- 각 버전의 원본 Excel 다운로드
- 각 버전의 프리뷰 이미지 확인
- 필요 시 과거 버전을 현재 버전으로 다시 지정

과거 버전의 Excel/R2 객체는 일반 갱신 시 삭제하지 않는다.

## 6. 방문자 다운로드 정책 / 閲覧者ダウンロード方針

유효한 접근 코드를 가진 사용자는 자신의 scope에 포함된 문서에 대해:

- 이미지 프리뷰 열람
- 현재 버전 원본 Excel 다운로드

를 할 수 있다.

과거 버전 파일은 관리자 전용으로 한다. 공개 사용자는 현재 버전만 접근하도록 권장한다.

R2 bucket/object를 직접 public URL로 노출하지 않고 Worker가 접근 코드/세션을 검사한 뒤 파일을 스트리밍하거나 제한된 다운로드 응답을 제공하는 구조를 사용한다.

## 7. 데이터 모델 / データモデル

### protected_documents

문서의 논리적 본체.

```text
id
slug                    skill-sheet / career-history
document_type           skill_sheet / career_history
title_ja
title_ko
current_version_id
is_active
created_at
updated_at
```

### protected_document_versions

업로드할 때마다 생성되는 불변 버전.

```text
id
document_id
version_no
original_file_key       R2 원본 Excel key
original_file_name
original_file_size
original_file_sha256
change_summary
uploaded_by
created_at
```

동일 문서에서 `UNIQUE(document_id, version_no)`를 권장한다.

### protected_document_preview_pages

버전별 프리뷰 이미지.

```text
id
version_id
page_no
image_key
width
height
created_at
```

`UNIQUE(version_id, page_no)` 권장.

### access_codes

```text
id
code_hash
label
scope                   skill_sheet / career_history / both
issued_by
issued_at
expires_at              기본 issued_at + 30일
revoked_at
last_used_at
created_at
```

접근 코드는 원문을 DB에 저장하지 않고 hash로 검증한다.

### protected_access_logs

선택하지만 권장.

```text
id
access_code_id
document_id
version_id
action                  view / download
ip_encrypted
ip_hash
country_code
user_agent
created_at
```

## 8. 관리자 화면 / 管理画面

```text
/admin/documents
├─ 스킬표
│  ├─ 현재 버전
│  ├─ 새 Excel 업로드
│  └─ 버전 이력 + 각 Excel 다운로드
└─ 직무경력서
   ├─ 현재 버전
   ├─ 새 Excel 업로드
   └─ 버전 이력 + 각 Excel 다운로드

/admin/access-codes
├─ 코드 발급
├─ 유효기간/만료일 확인
├─ 접근 범위 확인
├─ 마지막 사용 시간
└─ 즉시 폐기
```

문서 갱신, 과거 버전 복원, 코드 발급/폐기는 `audit_logs`에도 기록한다.

## 9. 보안 원칙 / セキュリティ方針

- 접근 코드 원문은 DB에 저장하지 않는다.
- 만료 기본값은 30일.
- 관리자에서 언제든 revoke 가능.
- Excel 원본 및 프리뷰 이미지의 R2 object는 보호된 경로로 취급한다.
- 다운로드 API도 접근 세션을 반드시 검증한다.
- 관리자만 모든 과거 버전의 원본 Excel을 다운로드할 수 있다.
- 공개 코드 사용자는 현재 버전만 다운로드 가능하게 한다.
- 접근/다운로드 로그의 원본 IP는 기존 댓글/관리자 보안 정책과 동일하게 암호화하고, 검색용 hash와 접속 국가를 별도 관리한다.

## 10. 확정 요구사항 요약 / 決定要件まとめ

```text
상단 메뉴: 홈 / 일본어 모듈 / 스킬표 / 직무경력서
좌측 메뉴: 게시글 계층형 카테고리
스킬표·직무경력서: 접근 코드 필요
코드 기본 유효기간: 30일
관리자에서 코드 발급/폐기
Excel 업로드 → 원본 R2 보존
Excel → 이미지 프리뷰 생성
코드 사용자: 이미지 열람 + 현재 Excel 다운로드
문서 갱신마다 새 버전 생성
관리자: 모든 버전 이력 확인 + 해당 버전 Excel 다운로드
과거 버전은 덮어쓰거나 자동 삭제하지 않음
```
