# Daily Study Data Workflow

이 폴더는 매일 생성하는 `오늘의 학습` 데이터를 DB에 적용하기 위한 날짜별 SQL 보관소다.

## 원본 데이터 위치

- JLPT 신규 단어 20개: `data/jlpt/daily_words/YYYY-MM-DD.json`
- JLPT 오늘의 학습 문제: `data/jlpt/daily/YYYY-MM-DD.json`
- AP 오늘의 개념/문제: `data/ap/daily/YYYY-MM-DD.json`

## 매일 생성 규칙

### JLPT N1
- 신규 단어 20개를 선정한다.
- 선정 전에 `data/jlpt/daily_words/`의 과거 날짜 파일 전체를 기준으로 이미 사용한 단어를 제외한다.
- 각 단어에는 읽기, 한국어 뜻, 품사, 일본어 예문, 한국어 예문을 준비한다.
- 어휘 문제 15문제 + 문법 2개(각 확인문제 포함) + 독해 1지문을 기본 구성으로 한다.
- 복습은 학습 DB의 SRS 일정(1-3-7-14-30-60-90-180)을 우선한다.

### AP
- 하루 기본 학습시간은 현재 사이트 기준 60분으로 구성한다.
- `개념 15분 + 科目A 30분 + 科目B 15분`을 기본으로 하되, 오답/복습/시험 임박도에 따라 비중을 조정한다.
- 기본 Day 구성은 개념 설명 + 확인문제, 科目A 4지선다 문제 묶음, 科目B 실전형 시나리오/문항으로 만든다.
- 주간/월간 누적 테스트는 기존 AP 학습계획의 규칙을 따른다.

## SQL 보관 규칙

앞으로 신규 일일 SQL은 일반 스키마 migration 폴더(`migrations/`)가 아니라 이 폴더 아래에 저장한다.

권장 파일명:

`YYYY-MM-DD.sql`

예:

`daily-study-migrations/2026-09-02.sql`

일일 SQL은 같은 날짜에 다시 실행해도 중복 데이터가 생기지 않도록 가능한 한 `INSERT OR IGNORE`, `NOT EXISTS`, 고유키를 사용해 idempotent하게 작성한다.

## 운영 순서

1. 과거 `daily_words`를 확인해 JLPT 신규 단어 중복을 제거한다.
2. JLPT 신규 단어 20개와 문제를 생성해 `data/jlpt/...`에 저장한다.
3. AP 개념/문제를 생성해 `data/ap/daily/...`에 저장한다.
4. 같은 내용을 DB에 넣을 날짜별 SQL을 `daily-study-migrations/YYYY-MM-DD.sql`로 저장한다.
5. 사용자가 Git pull 후 해당 SQL만 Remote D1에 적용한다.

일반 스키마 변경이 필요한 경우에만 기존 `migrations/`에 번호 migration을 추가한다.
