import { describe, expect, it } from 'vitest';
import {
	addDays,
	daysBetween,
	nextReview,
	validDateText,
	type LearningProgressRow,
} from '../src/jlpt-study';

describe('JLPT study helpers', () => {
	it('calculates Japan-date review intervals without crossing date incorrectly', () => {
		expect(addDays('2026-09-01', 1)).toBe('2026-09-02');
		expect(addDays('2026-09-30', 3)).toBe('2026-10-03');
		expect(daysBetween('2026-09-01', '2027-07-04')).toBe(306);
	});

	it('schedules a first mastered word for the next day', () => {
		expect(nextReview(null, 'mastered', '2026-09-01')).toEqual({
			reviewStage: 1,
			nextReviewOn: '2026-09-02',
		});
	});

	it('advances mastered review stages and caps at 60 days', () => {
		const current: LearningProgressRow = {
			learning_state: 'mastered',
			first_learned_at: '2026-09-01T00:00:00.000Z',
			last_studied_at: '2026-09-30T00:00:00.000Z',
			review_stage: 5,
			next_review_on: '2026-10-30',
		};
		expect(nextReview(current, 'mastered', '2026-10-30')).toEqual({
			reviewStage: 6,
			nextReviewOn: '2026-12-29',
		});
		expect(nextReview({ ...current, review_stage: 6 }, 'mastered', '2026-12-29')).toEqual({
			reviewStage: 6,
			nextReviewOn: '2027-02-27',
		});
	});

	it('resets uncertain and unlearned words to next-day review', () => {
		const current: LearningProgressRow = {
			learning_state: 'mastered',
			first_learned_at: '2026-09-01T00:00:00.000Z',
			last_studied_at: '2026-09-08T00:00:00.000Z',
			review_stage: 3,
			next_review_on: '2026-09-15',
		};
		expect(nextReview(current, 'uncertain', '2026-09-15')).toEqual({ reviewStage: 0, nextReviewOn: '2026-09-16' });
		expect(nextReview(current, 'unlearned', '2026-09-15')).toEqual({ reviewStage: 0, nextReviewOn: '2026-09-16' });
	});

	it('accepts only valid YYYY-MM-DD inputs', () => {
		expect(validDateText('2026-09-01')).toBe('2026-09-01');
		expect(validDateText('2026/09/01')).toBeNull();
		expect(validDateText('not-a-date')).toBeNull();
	});
});
