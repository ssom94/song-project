# song-project 진행상황

최종 갱신: 2026-09-05

이 파일은 여러 ChatGPT 대화/쓰레드에서 song-project 작업을 이어갈 때 사용하는 기준 진행상황이다. 새 작업을 시작할 때 이 파일과 최신 Git 상태를 먼저 확인한다.

## 현재 상태 요약

### JLPT
- JLPT N1 오늘의 학습 데이터는 이미 기간별로 생성 완료.
- 신규 일일 데이터 자동 생성은 중지.
- 현재 자동화 방향: 당일 JLPT/AP 데이터 품질 검증.
- JLPT 당일 신규 20단어는 일본어학습 공통 단어 데이터 구조에 맞춰 함께 등록용 migration/seed를 준비하는 방식.
- 일본어학습 등록 시 `japanese_words`, 품사 관계, 예문 관계 등 실제 스키마에 맞추고 기존 단어+읽기 중복은 재사용.
- D1 원격 DB는 자동 변경하지 않고 Git에 반영용 SQL/seed를 준비.

### AP
- AP 개념 라이브러리 A-01~A-68은 전체적으로 개념 설명 품질이 양호.
- B-07 Incident Response의 증거보전 관련 사실 오류는 `migrations/0070_ap_content_validation_fixes.sql`로 보정 완료.
- 상세 검증 결과는 `docs/ap-content-validation-2026-09-05.md` 참조.

#### 2026-09-05 실전 문제은행 보강 완료
- `migrations/0071_ap_subject_a_network_security_exam_bank.sql`
  - A-33~A-46 네트워크·보안 42문제
  - 각 개념 3유형을 실제 4지선다 科目A형으로 교체
- `migrations/0072_ap_subject_a_dev_management_strategy_exam_bank.sql`
  - A-47~A-68 개발·관리·전략·회계·법무 66문제
  - 각 개념 3유형을 실제 4지선다 科目A형으로 교체
- `migrations/0073_ap_subject_a_replace_generic_fallbacks.sql`
  - A-14~A-32 generic fallback question #2 총 57문제를 실제 계산·판단형 4지선다로 교체
- `migrations/0074_ap_subject_a_balanced_daily_mix_20261001_20261007.sql`
  - 기존 sort order + OFFSET 순차 출제 제거
  - 2026-10-01~10-07 科目A를 날짜별 10문제씩 기술/DB/네트워크/보안/개발/관리/전략 혼합 출제로 재구성
  - VALUES + concept_code/type/question 키 JOIN 방식으로 D1 row-read를 제한

#### 현재 AP 남은 작업
1. 기존 개념/과거 문제의 일본어 표현을 IPA 시험 스타일로 정규화
   - `node`, `sort`, `memory`, `server`, `browser`, `data`, `code` 같은 불필요한 영어 혼용을 일본어 표기로 정리
2. 새 문제은행 전체 offline validation script 작성
   - 4개 선택지 여부
   - 정답 인덱스 범위
   - JSON 형식
   - 중복 문제
   - 빈 해설/정답
   - 날짜별 10문제 구성 검증
3. 위 검증 완료 후 AP 모의고사 페이지 구현으로 이동

## 현재 진행 중 작업

**AP 실전 문제은행 최종 품질 정리**

완료:
1. A-33~A-46 네트워크·보안 4지선다 보강
2. A-47~A-68 개발·관리·전략·회계·법무 4지선다 보강
3. A-14~A-32 generic 문제 교체
4. 10월 첫 주 오늘의 학습 科目A 혼합 출제 구조 보정

다음:
5. 일본어 표현 정규화
6. offline validation script 추가
7. AP 모의고사 페이지/DB/채점 구조 구현

## 다음 대형 기능: AP 모의고사

AP 문제은행 품질 정리 완료 후 구현한다.

### 페이지 구조
- 상단 탭: `科目A` / `科目B`
- 탭별 독립 모의고사 리스트
- 회차: 모의고사 1회, 2회, 3회 ...
- 상태: 미실시 / 진행 중 / 실시완료
- 실시 후 `취득점수 / 전체점수` 표시
- 리스트 우측 `모의고사 보기` 버튼

### 버튼 동작
- 미실시: 시험 안내 → 시험 시작 → 문제 풀이 → 최종 제출
- 실시완료: 점수, 문제별 정오, 사용자 답안, 정답/모범답안, 상세 해설, 관련 AP 개념 링크 표시

### 실제 시험형 기준
- 科目A: 80문제 / 150분 / 4지선다 / 100점 환산
- 科目B: 11문제 제시 / 5문제 응답 / 150분 / 기술식
- 페이지/DB/채점 구조를 먼저 완성한 뒤 모의고사 문제는 1회 → 2회 → 3회 순서로 제작·검증한다.

## 운영 원칙
- 기존 migration을 가능하면 수정하지 않고 후속 보정 migration을 추가한다.
- Cloudflare D1 무료 row-read 한도를 고려해 전체 스캔/반복 SELECT/COUNT 검증을 피한다.
- 배치 INSERT/UPSERT, VALUES/CTE, 인덱스 기반 JOIN, 범위 제한 검증을 우선한다.
- Git의 실제 스키마/코드를 확인하기 전에는 테이블명·컬럼명을 추측하지 않는다.
- 여러 ChatGPT 쓰레드에서 작업할 때는 이 파일을 먼저 읽고 최신 Git과 대조한 뒤 이어서 작업한다.
