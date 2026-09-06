# song-project 진행상황

최종 갱신: 2026-09-06

이 파일은 여러 ChatGPT 대화/쓰레드에서 song-project 작업을 이어갈 때 사용하는 기준 진행상황이다. 새 작업을 시작할 때 이 파일과 최신 Git 상태를 먼저 확인한다.

## 운영 원칙
- Cloudflare Workers + D1 + R2 기반.
- D1 무료 row-read 한도를 고려해 전체 스캔, 날짜/문제별 반복 SELECT·COUNT·NOT EXISTS를 피한다.
- 배치 INSERT/UPSERT, 인덱스 기반 JOIN, 범위 제한 검증을 우선한다.
- 원격 D1은 ChatGPT가 직접 변경하지 않는다. 사용자의 Cloudflare 인증 환경에서 migration/deploy한다.
- 기존 migration은 가능하면 수정하지 않고 후속 migration을 추가한다.

## 관리자 인증
- 신규/재설정 관리자 비밀번호는 scrypt(`N=16384,r=8,p=1`) 사용.
- `scripts/admin/reset-password.mjs`, `admin:diagnose-login`, `admin:unlock` 도구가 있다.
- 사용자가 운영 관리자 로그인 성공을 확인했다.

## 게시글
### 카테고리
- 공개 좌측 메뉴는 부모/자식 트리를 사용한다.
- 부모 클릭 시 모든 하위 카테고리 글까지 조회한다.
- 하위 카테고리는 연결선/들여쓰기/우측 정렬로 구분한다.
- 관리자 preset/emoji/image 아이콘과 색상을 공개 메뉴에도 표시한다.
- 작성/수정은 leaf 카테고리만 허용한다.
- `0084_post_category_leaf_invariant.sql`: 기존 부모 직속 글을 첫 leaf로 이동하고 부모 직접 할당을 DB trigger로 차단한다.

### 게시글 이미지
- 파일 선택, drag&drop, 클립보드 이미지 `Ctrl+V` 붙여넣기 지원.
- PNG/JPEG/WebP, 파일당 최대 8MB.
- R2 `post-images/...`에 저장하며 D1에는 Markdown URL만 저장한다.

## JLPT
- JLPT N1 오늘의 학습 데이터는 기간별 생성 완료.
- 신규 일일 데이터 자동 생성은 중지하고 당일 데이터 품질 검증 중심으로 운영한다.

## AP 개념정리
- AP 개념 A-01~A-68 검증 완료.
- 개념 예상문제 API는 문제별 정답(`answerKo/Ja`)과 상세해설(`explanationKo/Ja`)을 함께 반환한다.

### AP 개인 메모
- `0097_ap_concept_notes.sql`: 로그인 관리자별 개념/예상문제 메모.
- 개념당 1개, 예상문제당 1개, 최대 4,000자.
- 개념 목록/상세/예상문제 우측에 말풍선 메모 버튼을 표시한다.
- 저장된 메모는 말풍선 색상/점으로 강조하며 눌러 보기·수정·삭제 가능.
- 모바일은 bottom-sheet 형태.
- 목록은 科目 단위 1회 조회로 D1 N+1을 피한다.
- API: `GET /api/public/ap/concept-notes`, `PATCH/DELETE /api/admin/ap/concept-notes`.

## AP 자체 모의고사
### 엔진
- `0076_ap_mock_exam_foundation.sql`, `0077_ap_mock_exam_structured_written_answers.sql`.
- 科目A: 80문제, 150분, 총100점, 합격 60점.
- 科目B: 11문제 중 5문제 선택, Q1 정보보안 필수, 각 20점.
- 답안 자동저장, 재개, 타이머, A 자동채점, B 부분점수/구조화답안 지원.
- 실시일은 Asia/Tokyo 기준.

### ready 회차
- 科目A A1~A7 모두 80문제, T50/M10/S20.
- 科目B B1~B7 모두 11개 공식 분야 1문제씩, Q1 SECURITY 필수.
- A migrations: `0078`, `0080`, `0082`, `0086`, `0089`, `0092`, `0095`.
- B migrations: `0079`, `0081`, `0083`, `0087`, `0090`, `0093`, `0096`.
- round shells: `0085`, `0088`, `0091`, `0094`.
- `scripts/ap/validate-mock-exams.mjs`는 ready 문항에 정답과 JA/KO 상세해설을 강제한다.
- 科目B는 `modelAnswerJa/Ko`, `explanationJa/Ko`, 구조화 소문항, grading schema가 필수다.

## 실제 AP 기출 — 최신 공개 5회
최신 공개 5회분을 최신순으로 등록했다.
1. 令和7年度 秋期 — 2025-10-12
2. 令和7年度 春期 — 2025-04-20
3. 令和6年度 秋期 — 2024-10-13
4. 令和6年度 春期 — 2024-04-21
5. 令和5年度 秋期 — 2023-10-08

### 제공 방식
- 실제 문제 원문을 repo/DB에 복사하지 않고 **IPA 공식 PDF를 사이트 안에서 직접 표시**한다.
- `data/ap/past-exams/manifest.json` 및 `public/assets/data/ap-past-exams.json` version 2.
- 5회 × A/B 총 10개 시험지가 모두 `viewer-ready`.
- 화면에서는 당시 `午前`/`午後`를 각각 `科目A相当（午前）` / `科目B相当（午後）`로 표시한다.
- 목록에서 `실제 문제 풀기 / 過去問を解く` 버튼으로 전용 뷰어에 진입한다.
- 전용 뷰어:
  - `/ko/study/ap/past-exams/exam/`
  - `/ja/study/ap/past-exams/exam/`
- 공식 PDF iframe이 지원되지 않는 모바일 브라우저를 위해 새 탭 원문 링크도 제공한다.

### 科目A 실제 기출
- 각 회차 IPA 공식 午前 문제 PDF와 공식 정답 PDF를 연결했다.
- 공식 정답키 80문항을 카탈로그에 등록했다.
- 사이트에 80문항 ア/イ/ウ/エ 답안지를 제공한다.
- 답안은 `localStorage`에 회차/과목별 자동 저장한다.
- `채점하기` 클릭 시 공식 정답키로 자동채점하고 문제별 정답 및 100점 환산 점수를 표시한다.
- 60점 이상은 합격권으로 표시한다.
- **현재 실제 科目A에는 사이트 내부의 문항별 상세해설은 아직 작성하지 않았다.** 공식 정답 PDF를 제공한다.

### 科目B 실제 기출
- 각 회차 IPA 공식 午後 문제 PDF, 공식 해답/출제취지 PDF, 공식 채점강평 PDF를 연결했다.
- Q1은 필수로 고정하고 Q2~Q11에서 4문제를 추가 선택해 총 5문제를 고른다.
- 선택한 문제마다 답안 메모 textarea를 제공하고 `localStorage`에 자동 저장한다.
- **현재 실제 科目B에는 사이트 내부의 문항별 JA/KO 상세해설을 구조화하지 않았다.** IPA 공식 해답·채점강평으로 확인한다.

### 검증/비교
- `scripts/ap/validate-past-exams.mjs`는 `viewer-ready`를 검증한다.
  - question/answer URL은 IPA 공식 PDF여야 한다.
  - 科目A answerKey는 80개의 ア/イ/ウ/エ여야 한다.
  - 科目B는 공식 commentary PDF가 필수다.
  - public catalog와 canonical manifest가 일치해야 한다.
- `ready`는 별도 구조화 원문 JSON을 실제로 갖는 경우에만 사용하며 기존 문제/정답/JA·KO 해설 완전성 검증을 유지한다.
- `scripts/ap/compare-past-exams.mjs`의 정밀 mock-vs-past 유형 비교는 구조화된 실제 문제 JSON이 아직 없으므로 현재 `pending-source`가 정상이다. 공식 PDF viewer만으로는 비교기에 문제 텍스트가 공급되지 않는다.

## 최신 검증
- `Verify AP Mock Exams` #96: PASS.
  - 공식 기출 viewer metadata/IPA PDF/科目A 80답안키/科目B 채점강평 검증 PASS.
  - 자체 A1~A7/B1~B7 14회차 검증 및 migration build PASS.
- `Verify UI Enhancements` #791: PASS.
  - 실제 기출 목록/뷰어 JS 문법 검증 PASS.
- 전체 `Verify` #1090: PASS.
  - TypeScript, Browser JS, Unit tests, local D1 migrations, seeded schema 검증 PASS.

## 적용 명령
### 실제 기출 뷰어 작업 자체
새 D1 migration은 없다.
```bash
cd ~/song-project
git pull
npm run deploy
```

### 아직 `0097_ap_concept_notes.sql`을 운영 D1에 적용하지 않았다면
```bash
cd ~/song-project
git pull
npm run db:migrate:remote
npm run deploy
```

## 다음 작업 후보
1. 운영에서 실제 기출 2025 가을 科目A를 열어 IPA PDF 표시, 답안 자동저장, 자동채점을 스모크 테스트한다.
2. 모바일에서 PDF iframe이 안 보이는 경우 `새 탭에서 원문 열기` fallback을 확인한다.
3. 실제 기출 5회에 **문항별 상세해설**이 필요하면 IPA 원문을 기준으로 자체 해설 데이터를 회차별로 작성한다.
4. 자체 모의고사와 실제 기출의 문제방식/난이도 정밀 비교가 필요하면 실제 PDF를 구조화한 분석용 데이터셋을 별도로 준비해 `ap:past:compare`에 연결한다.
