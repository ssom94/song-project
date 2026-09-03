# JLPT production source

This directory is the release source for the `N1_2027_JUL` study plan.

## Layout

```text
production/
  manifest.json
  words/
    0001-0500.json
    0501-1000.json
    1001-1500.json
    1501-2000.json
    2001-2500.json
    2501-3000.json
  daily/
    2026-09.json
    2026-10.json
    2026-11.json
    2026-12.json
    2027-01.json
    2027-02.json
```

`words/*.json` contains the vocabulary corpus exactly once. Daily files reference words by stable `key`; they do not duplicate word objects.

## Word schema

```json
{
  "key": "n1-0001",
  "word": "懸念",
  "reading": "けねん",
  "meaning_ko": "염려, 우려",
  "meaning_ja": "気にかかって不安に思うこと",
  "part_of_speech": "名詞・サ変",
  "example_ja": "専門家は制度変更による混乱を懸念している。",
  "example_ko": "전문가들은 제도 변경으로 인한 혼란을 우려하고 있다.",
  "source": "curated"
}
```

## Daily schema

```json
{
  "month": "2026-09",
  "days": [
    {
      "date": "2026-09-07",
      "newWordKeys": ["n1-0001"],
      "vocabQuestions": [],
      "grammarLessons": [],
      "grammarQuestions": [],
      "readingSets": []
    }
  ]
}
```

The real file must satisfy the counts in `manifest.json`. The abbreviated example above is only a schema illustration.

### Vocabulary question

```json
{
  "sequence": 1,
  "type": "kanji_reading",
  "prompt": "「懸念」の読み方として最も適切なものを選びなさい。",
  "options": ["けねん", "けんねん", "かねん", "けんれん"],
  "answer": "けねん",
  "explanation_ko": "「懸念」は『けねん』이라고 읽는다."
}
```

Allowed `type` values are `kanji_reading`, `context_fill`, and `meaning_usage_synonym`.

### Grammar lesson

A grammar lesson is explanatory material, not an MCQ. It must include a Japanese pattern plus Korean learner support and at least one natural Japanese example.

### Reading set

Each reading set contains one original Japanese passage and exactly three four-choice questions. Question-facing text is Japanese-only; Korean explanation is returned only after grading.

## Scheduling model

- A normal introduction day has **20 new words**.
- 3,000 words therefore require exactly **150 introduction days**.
- After the corpus has been introduced, `newWordKeys` is empty.
- Reviews are not statically copied into every future daily file/session. D1 computes due reviews from the learner's state and `next_review_on` when the real session starts.
- Future-date memorization can still display planned new words through `japanese_jlpt_curriculum_words.introduced_on`, so precreating hundreds of daily review rows is unnecessary.

## Release

Run `npm run jlpt:validate` before generating a migration. The production migration must delete/replace legacy future JLPT content only inside the bounded release date range and must not precreate future progress sessions.
