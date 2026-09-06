# AP 실제 기출문제 데이터

이 디렉터리는 IPA가 공개한 응용정보기술자시험(AP) 과거문제를 song-project의 모의고사 엔진에 가져오기 위한 준비 영역이다.

## 현재 범위

최신 공개 5회분을 최신순으로 관리한다.

1. 令和7年度 秋期 — 2025-10-12
2. 令和7年度 春期 — 2025-04-20
3. 令和6年度 秋期 — 2024-10-13
4. 令和6年度 春期 — 2024-04-21
5. 令和5年度 秋期 — 2023-10-08

당시 명칭은 `午前`/`午後`였으므로 현재 화면에서는 각각 `科目A相当（午前）`, `科目B相当（午後）`로 표시한다.

## 출처 원칙

- 문제·정답의 기준 자료는 IPA 공식 PDF로 한정한다.
- 사이트 화면에는 IPA 출처와 공식 과거문제 페이지를 표시한다.
- 문제 본문은 공식 PDF가 작업 입력으로 제공된 뒤 구조화한다.
- AP-Siken 등 제3자 사이트의 해설 문장을 복사하지 않는다. 상세 해설은 별도로 작성한다.

## import 파일

실제 문제가 준비되면 `sessions/<session-key>-A.json`, `sessions/<session-key>-B.json`을 만든다.

예: `sessions/2025-autumn-A.json`

```json
{
  "kind": "official-past-exam",
  "sessionKey": "2025-autumn",
  "subject": "A",
  "historicalSubject": "午前",
  "administeredAt": "2025-10-12",
  "source": {
    "publisher": "独立行政法人情報処理推進機構（IPA）",
    "officialPageUrl": "https://www.ipa.go.jp/shiken/mondai-kaiotu/2025r07.html"
  },
  "questions": []
}
```

A는 80문제, B는 11문제를 모두 채운 뒤 manifest의 해당 subject를 `ready`로 바꾸고 `file`을 지정한다. `awaiting-source` 상태는 DB에 넣지 않는다.

### A 문제 구조

기존 자체 모의고사의 choice4 구조와 동일하게 유지한다.

- `questionNo`
- `sectionCode`
- `type: "choice4"`
- `promptJa`
- `optionsJa` 4개
- `correctChoice` (0~3)
- `explanationJa` (IPA 답과 별도로 작성한 해설)
- `source` (`page`, `officialQuestionNo` 등)

한국어 번역은 `promptKo`, `optionsKo`, `explanationKo`에 별도로 기록할 수 있다.

### B 문제 구조

기존 자체 모의고사의 written 구조를 재사용한다. 원문 지문·표·로그·설문은 `content` 아래에 구조화하고, 공식 해답과 채점강평을 바탕으로 `modelAnswerJa`, `gradingSchema`를 작성한다. 한국어 번역/해설은 별도 필드로 둔다.

## 검증

```bash
npm run ap:past:validate
npm run ap:past:compare
```

- `ap:past:validate`: 5개 세션 메타데이터, 날짜 순서, IPA URL, A80/B11 목표, ready 파일의 실제 문항 수를 검증한다.
- `ap:past:compare`: 실제 파일이 아직 없으면 `pending-source`로 정상 종료한다. 파일이 준비되면 자체 모의고사 1~7회와 문제 길이·계산/코드/표·로그 등의 형태 특징을 비교한다.

실제 문항이 준비되기 전에는 D1 migration을 만들지 않는다.
