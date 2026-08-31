import { describe, expect, it } from 'vitest';
import { buildApDailyBudget, nextApReview } from '../src/ap-study';

describe('AP study helpers', () => {
	it('uses a balanced one-hour plan on a normal study day', () => {
		expect(buildApDailyBudget({
			dueReviewCount: 0,
			daysUntilSubjectA: 120,
			completedStudyDays: 3,
			dailyMinutes: 60,
		})).toMatchObject({
			mode: 'normal',
			reviewMinutes: 10,
			conceptMinutes: 15,
			subjectAMinutes: 25,
			subjectBMinutes: 10,
			testMinutes: 0,
		});
	});

	it('prioritizes review when due topics accumulate', () => {
		expect(buildApDailyBudget({
			dueReviewCount: 6,
			daysUntilSubjectA: 100,
			completedStudyDays: 5,
			dailyMinutes: 60,
		})).toMatchObject({
			mode: 'review_heavy',
			reviewMinutes: 20,
			conceptMinutes: 10,
			subjectAMinutes: 20,
			subjectBMinutes: 10,
		});
	});

	it('switches to cumulative tests every 7 and 30 completed study days', () => {
		expect(buildApDailyBudget({ dueReviewCount: 0, daysUntilSubjectA: 100, completedStudyDays: 7 })).toMatchObject({
			mode: 'weekly_test', testMinutes: 50,
		});
		expect(buildApDailyBudget({ dueReviewCount: 0, daysUntilSubjectA: 100, completedStudyDays: 30 })).toMatchObject({
			mode: 'monthly_test', testMinutes: 50,
		});
	});

	it('increases subject A practice during the final 45 days', () => {
		expect(buildApDailyBudget({ dueReviewCount: 0, daysUntilSubjectA: 30, completedStudyDays: 8 })).toMatchObject({
			mode: 'subject_a_final',
			reviewMinutes: 10,
			conceptMinutes: 10,
			subjectAMinutes: 30,
			subjectBMinutes: 10,
		});
	});

	it('focuses on subject B after subject A', () => {
		expect(buildApDailyBudget({ dueReviewCount: 0, daysUntilSubjectA: -1, completedStudyDays: 10 })).toMatchObject({
			mode: 'subject_b_final',
			reviewMinutes: 10,
			subjectAMinutes: 0,
			subjectBMinutes: 50,
		});
	});

	it('uses spaced review and quickly resets wrong answers', () => {
		expect(nextApReview(0, 'correct', '2026-09-01')).toEqual({
			reviewStage: 1,
			nextReviewOn: '2026-09-02',
			state: 'learning',
		});
		expect(nextApReview(3, 'correct', '2026-09-08')).toEqual({
			reviewStage: 4,
			nextReviewOn: '2026-09-22',
			state: 'mastered',
		});
		expect(nextApReview(4, 'wrong', '2026-09-22')).toEqual({
			reviewStage: 0,
			nextReviewOn: '2026-09-23',
			state: 'uncertain',
		});
	});
});
