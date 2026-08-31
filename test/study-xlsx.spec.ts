import { describe, expect, it } from 'vitest';
import { createStudyXlsx } from '../src/study-xlsx';

describe('study XLSX writer', () => {
	it('creates a valid ZIP-based xlsx payload with the requested five columns', () => {
		const bytes = createStudyXlsx([
			{ word: '排他制御', reading: 'はいたせいぎょ', meaningKo: '배타 제어' },
		]);
		expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
		expect(Array.from(bytes.slice(-22, -18))).toEqual([0x50, 0x4b, 0x05, 0x06]);
		const raw = new TextDecoder().decode(bytes);
		expect(raw).toContain('[Content_Types].xml');
		expect(raw).toContain('xl/worksheets/sheet1.xml');
		expect(raw).toContain('일본어');
		expect(raw).toContain('빈칸(히라가나)');
		expect(raw).toContain('빈칸(한국어)');
		expect(raw).toContain('はいたせいぎょ');
		expect(raw).toContain('배타 제어');
	});
});
