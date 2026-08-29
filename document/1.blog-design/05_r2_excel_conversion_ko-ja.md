# BLOG DESIGN NOTE 05
## R2 파일 구조 및 Excel 프리뷰 변환 / R2ファイル構成・Excelプレビュー変換

작성 기준일 / 作成基準日: 2026-08-29
설계 상태 / 設計状態: 기본안 확정

## 1. 목표 / 目的

관리자가 스킬표 또는 직무경력서 Excel(.xlsx)을 업로드하면 원본 파일을 Cloudflare R2에 버전별로 보존하고, 자동 변환 작업을 통해 웹 열람용 프리뷰 이미지를 생성한다. 유효한 접근 코드를 가진 방문자는 현재 버전의 프리뷰 이미지를 열람하고 원본 Excel을 다운로드할 수 있으며, 관리자는 모든 과거 버전의 Excel과 프리뷰를 확인/다운로드할 수 있다.

管理者がスキルシートまたは職務経歴書のExcel(.xlsx)をアップロードすると、原本をCloudflare R2へバージョン単位で保存し、自動変換処理でWeb閲覧用プレビュー画像を生成する。有効なアクセスコードを持つ閲覧者は現行版のプレビュー閲覧と原本Excelダウンロードができ、管理者は全履歴版のExcel・プレビューを確認/ダウンロードできる。

## 2. R2 버전 구조 / R2バージョン構成

기존 파일을 덮어쓰지 않고 버전마다 독립 경로를 사용한다.

```text
protected-documents/
├─ skill-sheet/
│  ├─ v0001/
│  │  ├─ original/
│  │  │  └─ skill-sheet.xlsx
│  │  └─ preview/
│  │     ├─ page-001.png
│  │     ├─ page-002.png
│  │     └─ page-003.png
│  ├─ v0002/
│  │  └─ ...
│  └─ v0003/
│     └─ ...
└─ career-history/
   ├─ v0001/
   │  ├─ original/
   │  │  └─ career-history.xlsx
   │  └─ preview/
   │     ├─ page-001.png
   │     └─ page-002.png
   └─ v0002/
      └─ ...
```

원본 Excel과 프리뷰 이미지는 public bucket URL로 직접 공개하지 않고 Worker를 통해 권한 검증 후 전송한다.

原本Excelとプレビュー画像はPublic Bucket URLへ直接公開せず、Workerで権限検証した後に配信する。

## 3. 업로드 처리 흐름 / アップロード処理フロー

```text
관리자 .xlsx 업로드
        ↓
Worker가 파일 형식/크기 검증
        ↓
새 document version 생성
        ↓
원본 Excel R2 저장
        ↓
conversion_status = queued
        ↓
비동기 변환 작업 시작
        ↓
Excel → PDF 또는 페이지 렌더링
        ↓
페이지별 PNG 생성
        ↓
PNG R2 저장
        ↓
preview page DB 등록
        ↓
conversion_status = ready
        ↓
현재 버전 전환
```

변환 실패 시 원본 파일과 버전 기록은 유지하고 `conversion_status = failed`로 표시하여 관리자가 재변환할 수 있게 한다.

変換失敗時も原本ファイルとバージョン履歴は保持し、`conversion_status = failed` として再変換できるようにする。

## 4. Excel 변환 방식 / Excel変換方式

엑셀 서식, 셀 병합, 인쇄 영역, 행/열 폭 등을 가능한 한 원본과 비슷하게 유지하기 위해 단순 JavaScript 테이블 재구성보다 Office 호환 렌더러를 사용한다.

1차 권장 구현은 Linux 컨테이너에서 LibreOffice headless를 실행하는 방식이다.

```text
.xlsx
  ↓ LibreOffice headless
.pdf
  ↓ PDF page renderer
page-001.png
page-002.png
...
```

Cloudflare Worker는 인증/API/R2/D1 처리를 담당하고, 실제 Excel 렌더링은 컨테이너 작업으로 분리한다.

```text
Browser/Admin
      ↓
Cloudflare Worker
 ├─ D1
 ├─ R2
 └─ Conversion Job
        ↓
   LibreOffice Container
        ↓
   PDF / PNG
        ↓
       R2
```

Cloudflare Containers를 사용할 경우 Worker와 같은 Cloudflare 플랫폼에서 Linux 컨테이너를 실행할 수 있다. 단, Containers는 Workers Paid 플랜이 필요하므로 실제 구현 단계에서 비용을 확인한 뒤 활성화한다.

Workers Free를 유지해야 한다면 초기 버전에서는 별도의 변환 서비스 또는 관리자 수동 프리뷰 업로드를 fallback으로 둘 수 있다. Excel을 HTML로 재구성한 뒤 Browser Run으로 screenshot하는 방법도 가능하지만 복잡한 Excel 서식의 완전 동일 렌더링을 보장하지 않으므로 기본안으로 사용하지 않는다.

## 5. 변환 상태 컬럼 / 変換状態

`protected_document_versions`에 다음 정보를 추가한다.

```text
conversion_status       queued / processing / ready / failed
conversion_error        실패 메시지(관리자용)
conversion_started_at
conversion_finished_at
preview_page_count
```

새 버전은 프리뷰 변환이 성공한 뒤에만 공개 `current_version_id`로 자동 전환하는 것을 기본 정책으로 한다.

새 Excel 업로드 중 변환 실패가 발생해도 방문자는 직전 정상 버전을 계속 볼 수 있다.

新バージョンはプレビュー変換成功後のみ公開 `current_version_id` へ切り替える。変換に失敗しても閲覧者は直前の正常版を継続閲覧できる。

## 6. 파일 무결성 / ファイル整合性

원본 Excel 업로드 시 SHA-256을 계산해 `original_file_sha256`에 저장한다.

용도:

- 동일 파일 중복 업로드 확인
- R2 원본 무결성 확인
- 버전별 파일 변경 여부 추적

관리자가 같은 파일을 다시 올린 경우 경고를 표시할 수 있으나, 강제로 새 버전을 만드는 기능은 허용 가능하게 한다.

## 7. 공개 열람 / 公開閲覧

유효한 보호문서 접근 세션이 있는 사용자만 프리뷰와 다운로드 API를 호출할 수 있다.

```text
/{lang}/skill-sheet
/{lang}/career-history
```

프리뷰 화면 예:

```text
職務経歴書
更新日: 2026.08.29

[ page 1 image ]
[ page 2 image ]
[ page 3 image ]

[ Excel 다운로드 / Excelをダウンロード ]
```

프리뷰는 모바일에서 화면 폭에 맞춰 축소하고 클릭/탭 시 확대할 수 있게 한다.

## 8. 다운로드 정책 / ダウンロード方針

방문자:

- 접근 코드 scope에 허용된 문서만 접근
- 현재 공개 버전 Excel만 다운로드
- 과거 버전 URL/API 접근 금지

관리자:

- 현재/과거 모든 버전 조회
- 각 버전 원본 Excel 다운로드
- 각 버전 프리뷰 조회
- 과거 정상 버전을 현재 버전으로 복원 가능

다운로드는 R2 직접 URL이 아니라 다음과 같은 Worker API를 통해 처리한다.

```text
GET /api/protected-documents/:documentId/download
GET /api/admin/documents/:documentId/versions/:versionId/download
```

Worker가 세션/권한을 검사한 뒤 R2 객체를 스트리밍한다.

## 9. 관리자 버전 이력 UI / 管理者バージョン履歴UI

```text
직무경력서 / 職務経歴書

현재: v5

v5  2026.08.29  READY
변경 내용: 프로젝트 경력 추가
[프리뷰] [Excel 다운로드]

v4  2026.07.10  READY
변경 내용: 기술 스택 갱신
[프리뷰] [Excel 다운로드] [현재 버전으로 복원]

v3  2026.05.01  READY
[프리뷰] [Excel 다운로드] [현재 버전으로 복원]
```

관리자가 이전 버전을 현재로 복원할 때 파일을 복사하거나 덮어쓰지 않고 `current_version_id`만 해당 버전으로 변경한다. 이 작업은 `audit_logs`에 기록한다.

## 10. 접근/다운로드 로그 / アクセス・ダウンロードログ

보호 문서 관련 로그 action:

```text
authenticate
view_preview
download_excel
```

관리자는 접근 코드별로 마지막 사용 시간, 국가, 마스킹 IP, 열람/다운로드 기록을 확인할 수 있다. 원본 IP는 암호화 저장하고 관리자 상세 화면에서만 복호화해 표시한다.

## 11. 변환 실패 및 복구 / 変換失敗・復旧

관리자 화면에서 실패 버전에는 다음 기능을 제공한다.

```text
변환 실패
원본 Excel: 정상 보관됨
오류: LibreOffice conversion failed

[재변환]
[원본 Excel 다운로드]
```

재변환해도 version_no는 증가시키지 않고 동일 버전의 preview를 다시 생성한다. 원본 Excel 자체가 바뀌는 경우에만 새 버전을 만든다.

## 12. 비용 우선 정책 / コスト優先方針

- R2에는 원본과 프리뷰만 장기 보존한다.
- 변환 작업은 Excel 갱신 시에만 실행한다.
- 페이지 조회 때마다 Excel을 다시 변환하지 않는다.
- 변환된 PNG를 재사용한다.
- 정확한 Excel 렌더링이 필요할 때 Cloudflare Containers + LibreOffice를 우선 후보로 한다.
- Workers Free 유지가 최우선이면 수동 프리뷰 업로드 또는 별도 저비용 변환 방식을 fallback으로 둔다.

## 13. 확정안 / 決定案

```text
Excel 원본: R2 버전별 영구 보존
프리뷰: 버전별 PNG
파일 갱신: 덮어쓰기 금지, 새 version 생성
공개 전환: 변환 성공한 버전만 current로 전환
방문자: 코드 인증 후 현재 이미지 + 현재 Excel 다운로드
관리자: 전체 버전 이미지 + Excel 다운로드 + 과거 버전 복원
Excel 렌더링: LibreOffice 기반 변환을 정확도 우선 기본안으로 채택
비용 제약 시 fallback 방식 허용
```
