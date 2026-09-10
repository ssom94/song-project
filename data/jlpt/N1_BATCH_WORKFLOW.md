# JLPT N1 batch workflow

The `N1_2027_JUL` curriculum is rebuilt in independently releasable 14-day batches.

## Batch boundary

- Each batch contains 14 dates and 20 planned new words per date (280 words maximum).
- A batch may be shorter only at the final end date of the curriculum.
- Do not change a committed batch's word order or questions without an explicit correction migration and an audit entry.

## Selection order

1. N1 workbook coverage and category relevance.
2. Fit to official JLPT vocabulary item types: reading, orthography, word formation, contextual expression, paraphrase, and usage.
3. N1-specific abstract, formal, written, compound, synonym, and nuanced usage value.
4. Licensed dictionary verification of surface form, reading, meaning, and part of speech.
5. Natural project-authored examples and four-option questions.

Do not use generic corpus frequency as the primary ordering rule. It can be used only as a tie-breaker after N1 relevance.

## Required batch checks

- Unique word + reading pairs inside the batch and against prior committed batches.
- Required reading, Korean meaning, part of speech, Japanese example, and Korean example.
- Four distinct Japanese options, one correct answer, and Korean support only after answering.
- No exact MCQ reuse within 90 days.
- Review first and last day manually for N1 appropriateness and question naturalness.
- Run `npm run jlpt:validate` before generating the migration.

## Commit checkpoint

Each completed batch must commit its source data, generated migration, validation report, and `n1-batch-progress.json` update together. The progress entry records the date range, word count, commit SHA, and any replacement/exclusion reasons.

If the Work session is close to its limit, finish validation and commit the current batch before stopping. A later session resumes from `nextBatch` after checking the referenced commit.

## D1 safety

- Each migration must target only its batch date range and plan ID.
- Prefer set-based `INSERT ... SELECT`, `INSERT OR IGNORE`, and indexed `DELETE` by plan/date range.
- Do not add calendar-wide correlated subqueries, per-day verification queries, or full learning-stat scans.
