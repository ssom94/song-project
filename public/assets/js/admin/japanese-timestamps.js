(() => {
	const API_URL = '/api/admin/japanese/words';
	let wordMap = new Map();
	let refreshTimer = 0;
	let loading = false;

	function currentLanguage() {
		return window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja';
	}

	function mountAssets() {
		for (const [href, attr] of [
			['/assets/css/admin/japanese-pagination.css', 'data-japanese-pagination-style'],
			['/assets/css/admin/japanese-workspace.css', 'data-japanese-workspace-style'],
		]) {
			if (document.querySelector(`link[${attr}]`)) continue;
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = href;
			link.setAttribute(attr, 'true');
			document.head.appendChild(link);
		}

		for (const [src, attr] of [
			['/assets/js/admin/japanese-workspace.js', 'data-japanese-workspace'],
			['/assets/js/admin/japanese-pagination.js', 'data-japanese-pagination'],
		]) {
			if (document.querySelector(`script[${attr}]`)) continue;
			const script = document.createElement('script');
			script.src = src;
			script.setAttribute(attr, 'true');
			document.body.appendChild(script);
		}
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
		});
		const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
		return {
			label: `${parts.year}.${parts.month}.${parts.day}`,
			iso: date.toISOString(),
		};
	}

	function wordIdFromRow(row) {
		const value = row.querySelector('.admin-japanese-word-main span')?.textContent ?? '';
		const match = value.match(/#(\d+)/);
		return match ? Number(match[1]) : 0;
	}

	function ensureHeader() {
		const row = document.querySelector('.admin-japanese-table thead tr');
		if (!(row instanceof HTMLTableRowElement)) return;
		let created = row.querySelector('.admin-japanese-table-created-head');
		if (!(created instanceof HTMLTableCellElement)) {
			created = document.createElement('th');
			created.className = 'admin-japanese-table-created-head';
			row.appendChild(created);
		}
		created.textContent = currentLanguage() === 'ko' ? '등록일' : '登録日';
	}

	function renderRows() {
		ensureHeader();
		document.querySelectorAll('#japanese-word-table-body > tr').forEach((row) => {
			if (!(row instanceof HTMLTableRowElement)) return;
			row.querySelector('.admin-japanese-table-created-cell')?.remove();
			const id = wordIdFromRow(row);
			const word = wordMap.get(id);
			const cell = document.createElement('td');
			cell.className = 'admin-japanese-table-created-cell';
			const parts = dateParts(word?.created_at);
			cell.textContent = parts?.label ?? '—';
			if (parts) cell.title = parts.iso;
			row.appendChild(cell);
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
			console.warn('Failed to load Japanese word registration dates', error);
		} finally {
			loading = false;
		}
	}

	function scheduleRefresh() {
		window.clearTimeout(refreshTimer);
		refreshTimer = window.setTimeout(refresh, 50);
	}

	function observeTable() {
		const body = document.getElementById('japanese-word-table-body');
		if (!body) return;
		new MutationObserver((mutations) => {
			if (mutations.some((mutation) => mutation.type === 'childList')) scheduleRefresh();
		}).observe(body, { childList: true, subtree: false });
	}

	async function initialize() {
		mountAssets();
		await Promise.all([window.AdminCommon?.ready, window.AdminI18n?.ready]);
		ensureHeader();
		observeTable();
		await refresh();
		document.addEventListener('adminlanguagechange', () => {
			ensureHeader();
			renderRows();
		});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
