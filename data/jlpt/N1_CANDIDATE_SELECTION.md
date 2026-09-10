# N1 candidate selection protocol

## Purpose

Build a transparent N1 study corpus of **at least 3,000 word-reading pairs** before choosing the first 14-day study batch. The label `출제 우선순위` is a study-priority rank; it is not an assertion that the official JLPT publishes a per-word exam-frequency rate.

## Source roles

| Source | Allowed role | Not used for |
| --- | --- | --- |
| Official JLPT sample-question item types | Confirm which vocabulary skills must be covered | Per-word frequency claims |
| N1 vocabulary workbook descriptions and chapter/category structure | Coverage and advanced-vocabulary selection rubric | Copying proprietary word lists, questions, explanations, or examples |
| Open Waller N1 classification + JMdict identity data | Broad candidate membership, spelling, reading, part of speech | Final N1 suitability or priority by itself |
| Open corpus frequency evidence | Tie-breaker after N1 suitability | Primary ranking |
| Project editorial review | Korean meaning, examples, distractors, final acceptance | Unverified dictionary identity |

## Acceptance rule

A final candidate must have all of the following:

1. A unique surface-form and reading pair, with canonical JMdict identity.
2. A verified reading, Korean meaning, and part of speech.
3. Advanced N1 value: abstract/formal/written/compound/nuanced usage, or clear fit for reading, orthography, contextual expression, paraphrase, or usage questions.
4. No elementary-only, counter/affix-only, obsolete, artificial, duplicate, or unverified entry.
5. A recorded review state: `accepted`, `excluded`, or `needs_review`, plus a reason.

## Priority bands

| Band | Meaning | Scheduling |
| --- | --- | --- |
| A | High N1 study value and strong question-type fit | First batches |
| B | Strong N1 value, broad coverage needed | Early/middle batches |
| C | Valid advanced support vocabulary | Later batches |
| Excluded | Does not meet the acceptance rule | Never scheduled |

## Batch gate

The 2026-10-01 to 2026-10-14 batch is not selected until the complete candidate corpus is ranked and has at least 3,000 accepted rows. Its 280 words are then taken in priority order, subject to duplicate and coverage checks.
