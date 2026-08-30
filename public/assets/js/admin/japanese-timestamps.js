(() => {
	const API_URL = '/api/admin/japanese/words';
	let wordMap = new Map();
	let refreshTimer = 0;
	let loading = false;

	function currentLanguage() {
		return window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja';
	}

	function labels() {
		return currentLanguage() === 'ko'
			? { updated: '수정일', created: '등록일', neverUpdated: '미수정' }
			: { updated: '更新日', created: '登録日', neverUpdated: '未更新' };
	}

	function mountStyle() {
		if (document.querySelector('link[data-japanese-timestamps-style]')) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '/assets/css/admin/japanese-timestamps.css';
		link.dataset.japaneseTimestampsStyle = 'true';
		document.head.appendChild(link);
	}

	function dateParts(value) {
		if (!value) return null;
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return null;
		const formatter = new Intl.DateTimeFormat('en-CA', {
			timeZone: 'Asia/Tokyo',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
		});
		const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
		return {
			date: `${parts.year}.${parts.month}.${parts.day}`,
			time: `${parts.hour}:${parts.minute}`,
			iso: date.toISOString(),
		};
	}

	function sameMoment(left, right) {
		const a = new Date(left ?? '').getTime();
		const b = new Date(right ?? '').getTime();
		return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1000;
	}

	function wordIdFromRow(row) {
		const value = row.querySelector('.admin-japanese-word-main span')?.textContent ?? '';
		const match = value.match(/#(\d+)/);
		return match ? Number(match[1]) : 0;
	}

	function makeDateCell(value, className, emptyText = '—') {
		const cell = document.createElement('td');
		cell.className = `admin-japanese-table-date ${className}`;
		const parts = dateParts(value);
		if (!parts) {
			cell.textContent = emptyText;
			return cell;
		}
		const day = document.createElement('strong');
		day.textContent = parts.date;
		const time = document.createElement('small');
		time.textContent = parts.time;
		cell.title = parts.iso;
		cell.append(day, time);
		return cell;
	}

	function ensureHeaders() {
		const row = document.querySelector('.admin-japanese-table thead tr');
		if (!(row instanceof HTMLTableRowElement)) return;
		const copy = labels();
		let updated = row.querySelector('.admin-japanese-table-updated-head');
		let created = row.querySelector('.admin-japanese-table-created-head');
		const action = row.lastElementChild;
		if (!(updated instanceof HTMLTableCellElement)) {
			updated = document.createElement('th');
			updated.className = 'admin-japanese-table-updated-head';
			if (action) row.insertBefore(updated, action);
			else row.appendChild(updated);
		}
		if (!(created instanceof HTMLTableCellElement)) {
			created = document.createElement('th');
			created.className = 'admin-japanese-table-created-head';
			row.appendChild(created);
		}
		updated.textContent = copy.updated;
		created.textContent = copy.created;
	}

	function renderRows() {
		ensureHeaders();
		const copy = labels();
		document.querySelectorAll('#japanese-word-table-body > tr').forEach((row) => {
			if (!(row instanceof HTMLTableRowElement)) return;
			row.querySelector('.admin-japanese-table-updated-cell')?.remove();
			row.querySelector('.admin-japanese-table-created-cell')?.remove();
			const id = wordIdFromRow(row);
			const word = wordMap.get(id);
			const actionCell = row.lastElementChild;
			const updatedCell = sameMoment(word?.created_at, word?.updated_at)
				? makeDateCell(null, 'admin-japanese-table-updated-cell', copy.neverUpdated)
				: makeDateCell(word?.updated_at, 'admin-japanese-table-updated-cell');
			const createdCell = makeDateCell(word?.created_at, 'admin-japanese-table-created-cell');
			if (actionCell) row.insertBefore(updatedCell, actionCell);
			else row.appendChild(updatedCell);
			row.appendChild(createdCell);
		});
	}

	async function refresh() {
		if (loading) return;
		loading = true;
		try {
			const response = await fetch(API_URL, { credentials: 'same-origin', cache: 'no-store' });
			if (response.status === 401) return;
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok || !Array.isArray(result.words)) throw new Error('INVALID_WORD_RESPONSE');
			wordMap = new Map(result.words.map((word) => [Number(word.id), word]));
			renderRows();
		} catch (error) {
			console.warn('Failed to load Japanese word timestamps', error);
		} finally {
			loading = false;
		}
	}

	function scheduleRefresh() {
		window.clearTimeout(refreshTimer);
		refreshTimer = window.setTimeout(refresh, 80);
	}

	function observeTable() {
		const body = document.getElementById('japanese-word-table-body');
		if (!body) return;
		const observer = new MutationObserver((mutations) => {
			if (mutations.some((mutation) => mutation.type === 'childList')) scheduleRefresh();
		});
		observer.observe(body, { childList: true, subtree: false });
	}

	async function initialize() {
		await Promise.all([window.AdminCommon?.ready, window.AdminI18n?.ready]);
		mountStyle();
		ensureHeaders();
		observeTable();
		await refresh();
		document.addEventListener('adminlanguagechange', () => {
			ensureHeaders();
			renderRows();
		});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
