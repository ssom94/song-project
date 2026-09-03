# JLPT production data policy

This document defines the release standard for the `N1_2027_JUL` daily-study plan.

## Scope

The production rebuild starts on **2026-09-07**. Material previously generated for 2026-09-07 through 2027-02-28 by early bulk migrations is legacy material and must not be treated as release-quality merely because a date/session exists.

The production source of truth is `data/jlpt/production/` plus the generated D1 migration built from it. Future content must be added to that source and pass `npm run jlpt:validate` before a migration is committed.

## Vocabulary requirements

- Target curriculum: exactly **3,000 unique vocabulary entries** for the active N1 plan.
- A word row must have a real Japanese surface form, reading, Korean meaning, and natural Japanese example.
- Duplicate `word + reading` rows are forbidden.
- Synthetic compounds, obvious generated variants, and filler entries are forbidden.
- Existing manually curated `song-project_일본어단어추가_*` data is preferred when the same word is present.
- Old generated sheets containing artificial/repeated entries are not approved production sources.
- JLPT level labels are metadata, not a reason to rewrite an existing word's level incorrectly.

## Question-language rule

JLPT exam-facing material is Japanese-only:

- title
- passage
- prompt/question
- all four options
- correct answer

Hangul is allowed only in learner-support fields shown after answering or in memorization/reference UI, such as:

- `meaning_ko`
- `example_ko`
- `explanation_ko`

A Korean translation must never reveal the answer before the learner answers a JLPT question.

## Question quality

Production MCQs must:

- have exactly four distinct options;
- contain the correct answer exactly once;
- use real Japanese distractors, never labels such as `다른 의미`, `반대 의미`, `適切なN1表現`, `不自然な表現A`, `該当なし`, or similar placeholders;
- avoid exact question reuse within 90 days;
- use natural Japanese contexts rather than a generic sentence with only a word swapped;
- keep vocabulary question balance aligned with the curriculum specification: kanji reading, context judgment, and meaning/usage/synonym families;
- use grammar questions that test connection, nuance, sentence construction, or discourse context rather than Korean-to-Japanese lookup;
- use original, coherent N1-level reading passages. A passage must not contain study metadata such as `本日の語彙`.

## Daily package

Prepared study days follow the current song-project curriculum:

- vocabulary schedule for the day;
- 15 vocabulary questions;
- 2 grammar learning points;
- 3 grammar questions;
- 1 reading set with 3 questions.

Future review scheduling may use the SRS intervals defined in the curriculum policy. It must not relabel a previously introduced word as a new word.

## Quality gate

Run:

```bash
npm run jlpt:validate
```

The validator is a release gate, not a best-effort warning. It fails on:

- Hangul in question-facing fields;
- placeholder/filler text;
- invalid or duplicate options;
- answer not present exactly once;
- missing required word fields;
- duplicate word/readings;
- exact question reuse inside 90 days;
- production corpus count differing from the manifest target.

D1 validation inside migrations should remain bounded and aggregate-based. Do not reintroduce per-date correlated `COUNT`, `EXISTS`, or calendar-wide practice API checks that can consume the D1 free-tier row-read budget.

## External source policy

External vocabulary lists may be used only as candidate/reference material when their license permits it. Candidate data must be normalized and reviewed against the production rules before inclusion; source rows are never imported blindly.

OpenJLPT (`evanclan/OpenJLPT`) is available under CC BY-SA 4.0 and can be used as an attributed candidate source, but its raw list/examples contain legacy/noisy entries, so raw data is not production-approved without normalization and validation.
