# Daily Study Data Workflow

이 폴더는 매일 생성하는 `오늘의 학습` 데이터를 DB에 적용하기 위한 날짜별 SQL 보관소다.

## 장기 커리큘럼 기준

매일 문제를 만들기 전에 반드시 아래 파일을 먼저 읽는다.

- 공통 생성/중복/복습 규칙: `data/curriculum/daily-study-policy.json`
- 누적 출제·학습 인덱스: `data/curriculum/daily-index.json`
- JLPT N1 장기 커리큘럼: `data/jlpt/curriculum.json`
- AP 장기 커리큘럼: `data/ap/curriculum.json`

Git은 **무엇을 언제 가르치고 어떤 문제를 냈는지**의 원본 기록이고, Remote D1은 **실제 정답/오답/복습 예정/숙련도**의 원본 기록이다. 매일의 학습은 둘을 함께 보고 결정한다.

## 원본 데이터 위치

- JLPT 누적 사용 단어 인덱스: `data/jlpt/used_words.json`
- JLPT 신규 단어 20개: `data/jlpt/daily_words/YYYY-MM-DD.json`
- JLPT 오늘의 학습 문제: `data/jlpt/daily/YYYY-MM-DD.json`
- AP 오늘의 개념/문제: `data/ap/daily/YYYY-MM-DD.json`
- 누적 날짜별 출제 이력: `data/curriculum/daily-index.json`

## 매일 생성 규칙

### 공통
- 지난 출제 이력과 현재 커리큘럼 phase를 먼저 확인한다.
- 미해결 오답, 복습 예정, 숙련도가 낮은 분야를 신규 내용보다 우선할 수 있다.
- 같은 문제 문장을 단순 재사용하지 않는다. 기본적으로 정확히 같은 문제는 90일 이내 재출제를 피한다.
- 같은 개념을 다시 확인해야 할 때는 `review`로 분류하고 문맥·수치·선택지를 바꿔 다시 묻는다.
- 학습을 하루 쉬었다고 다음 날 분량을 2배로 만들지 않는다. 밀린 복습만 우선순위로 올리고 신규 커리큘럼은 backlog로 유지한다.
- 7학습일마다 주간 누적, 30학습일마다 월간 누적 테스트를 실시한다.

### JLPT N1
- 신규 단어 기본 20개를 선정한다.
- 선정 전에 `data/jlpt/used_words.json`과 `data/jlpt/daily_words/`의 과거 날짜 파일을 기준으로 이미 사용한 단어를 제외한다.
- 선정이 끝나면 `used_words.json`에도 같은 단어를 누적해서 다음 날 중복 체크 기준으로 사용한다.
- 각 단어에는 읽기, 한국어 뜻, 품사, 일본어 예문, 한국어 예문을 준비한다.
- 어휘 문제 15문제 + 문법 2개(각 확인문제 포함) + 독해 1지문(기본 3문제)을 기본 구성으로 한다.
- 복습은 학습 DB의 SRS 일정(1-3-7-14-30-60-90-180)을 우선한다.
- 신규/복습 단어와 오답노트 UI는 한 페이지 10개 기준으로 표시한다.

### AP
- 하루 기본 학습시간은 60분으로 구성한다.
- 기본은 `개념 15분 + 科目A 30분 + 科目B 15분`으로 시작하되, 오답/복습/시험 임박도에 따라 조정한다.
- 기본 Day 구성은 개념 설명 + 확인문제, 科目A 4지선다 약 10문제, 科目B 실전형 시나리오 1개로 만든다.
- 科目A는 전 범위를 추적하고, 科目B는 `security / programming_algorithms / database / system_development / network` 5분야를 우선한다.
- 2027년 2월 科目A 목표에 가까워질수록 科目A 혼합 실전 비중을 높이고, 이후에는 科目B 서술형 비중을 높인다.

## 매일 생성 전 판단 순서

1. `daily-study-policy.json` 확인
2. `daily-index.json`에서 최근 출제 개념/문제 범위 확인
3. JLPT `used_words.json`에서 사용 단어 확인
4. 최근 날짜별 JLPT/AP 원본 JSON 확인
5. 가능한 경우 Remote D1의 오답·복습 예정·숙련도 확인
6. 현재 phase에서 아직 부족한 범위 선택
7. 당일 JSON과 SQL 생성
8. `daily-index.json`에 당일 출제 이력을 누적

## SQL 보관 규칙

신규 일일 SQL은 일반 스키마 migration 폴더(`migrations/`)가 아니라 이 폴더 아래에 저장한다.

권장 파일명:

`YYYY-MM-DD.sql`

예:

`daily-study-migrations/2026-09-02.sql`

일일 SQL은 같은 날짜에 다시 실행해도 중복 데이터가 생기지 않도록 가능한 한 `INSERT OR IGNORE`, `NOT EXISTS`, 고유키를 사용해 idempotent하게 작성한다.

## D1 Free row-read 예산 규칙

Cloudflare D1 무료 플랜의 일일 row read 한도를 학습 데이터 생성/검증만으로 소진하지 않도록 다음 규칙을 지킨다.

- 날짜별·문제별로 대상 테이블을 다시 읽는 correlated `SELECT COUNT(*)`, 반복 `EXISTS` 검증을 만들지 않는다.
- 여러 날짜를 검증할 때는 `GROUP BY study_date`와 조건부 `SUM`으로 **대상 기간을 테이블별 1회 집계**하는 방식을 우선한다.
- 조회 조건은 가능한 한 기존 인덱스 선두 키인 `plan_id`, `study_date`, `session_id`를 함께 사용한다. 날짜 범위만으로 큰 테이블 전체를 훑지 않는다.
- 문제 선택지 생성은 같은 행을 반복 조회하는 scalar subquery보다 임시 스케줄 테이블의 PK/인덱스를 이용한 self join을 우선한다.
- 대량 생성 migration의 검증은 필요한 최소 집계만 수행한다. 동일 내용을 여러 assertion으로 나눠 전체 범위를 반복 스캔하지 않는다.
- 달력처럼 이미 준비 기간을 Git에서 알고 있는 UI는 날짜마다 practice API를 호출해 존재 여부를 재검증하지 않는다. 진행 상태처럼 실제 DB 값이 필요한 데이터만 묶어서 조회한다.
- D1 비용을 줄이기 위해 검증을 완전히 없애기보다는, **작은 임시 테이블 + 1회 집계 검증**을 기본 패턴으로 사용한다.

## 운영 순서

1. 장기 커리큘럼과 누적 인덱스를 확인한다.
2. 실제 학습 DB의 오답/복습/숙련도 상태를 확인한다.
3. JLPT 신규 단어와 문제를 생성하고 `used_words.json`을 갱신한다.
4. AP 개념/科目A/科目B 문제를 생성한다.
5. `data/curriculum/daily-index.json`에 그날의 출제 범위를 기록한다.
6. 같은 내용을 DB에 넣을 날짜별 SQL을 `daily-study-migrations/YYYY-MM-DD.sql`로 저장한다.
7. 사용자가 Git pull 후 해당 SQL만 Remote D1에 적용한다.

일반 스키마 변경이 필요한 경우에만 기존 `migrations/`에 번호 migration을 추가한다.
