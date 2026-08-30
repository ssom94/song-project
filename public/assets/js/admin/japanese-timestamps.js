(() => {
	const API_URL = '/api/admin/japanese/words';
	let wordMap = new Map();
	let refreshTimer = 0;
	let loading = false;

	function currentLanguage() {
		return window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja';
	}

	function copy() {
		return currentLanguage() === 'ko'
			? {
				state: '학습상태', all: '전체', mastered: '암기 완료', uncertain: '애매함', unlearned: '미학습', created: '등록일',
			}
			: {
				state: '学習状態', all: 'すべて', mastered: '習得済み', uncertain: 'あいまい', unlearned: '未習得', created: '登録日',
			};
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
			timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
		});
		const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
		return { label: `${parts.year}.${parts.month}.${parts.day}`, iso: date.toISOString() };
	}

	function wordIdFromRow(row) {
		const value = row.querySelector('.admin-japanese-word-main span')?.textContent ?? '';
		const match = value.match(/#(\d+)/);
		return match ? Number(match[1]) : 0;
	}

	function stateValue(word) {
		return word?.learning_state === 'mastered' || word?.learning_state === 'uncertain' ? word.learning_state : 'unlearned';
	}

	function stateLabel(state) {
		const labels = copy();
		return state === 'mastered' ? labels.mastered : state === 'uncertain' ? labels.uncertain : labels.unlearned;
	}

	function ensureFilter() {
		const filters = document.querySelector('.admin-japanese-filters');
		if (!filters) return null;
		let select = document.getElementById('japanese-learning-state-filter');
		if (select instanceof HTMLSelectElement) return select;

		const field = document.createElement('div');
		field.className = 'admin-japanese-field admin-japanese-learning-filter';
		const label = document.createElement('label');
		label.htmlFor = 'japanese-learning-state-filter';
		select = document.createElement('select');
		select.id = 'japanese-learning-state-filter';
		field.append(label, select);
		filters.appendChild(field);
		select.addEventListener('change', applyLearningFilter);
		fillFilter(select, '');
		return select;
	}

	function fillFilter(select, selectedValue = select.value) {
		const labels = copy();
		const options = [
			['', labels.all],
			['mastered', labels.mastered],
			['uncertain', labels.uncertain],
			['unlearned', labels.unlearned],
		];
		select.replaceChildren(...options.map(([value, label]) => {
			const option = document.createElement('option');
			option.value = value;
			option.textContent = label;
			return option;
		}));
		select.value = options.some(([value]) => value === selectedValue) ? selectedValue : '';
		const label = select.previousElementSibling;
		if (label) label.textContent = labels.state;
	}

	function ensureHeaders() {
		const row = document.querySelector('.admin-japanese-table thead tr');
		if (!(row instanceof HTMLTableRowElement)) return;
		const labels = copy();
		const action = row.querySelector('th[data-i18n="tableActions"]');

		let state = row.querySelector('.admin-japanese-table-state-head');
		if (!(state instanceof HTMLTableCellElement)) {
			state = document.createElement('th');
			state.className = 'admin-japanese-table-state-head';
			if (action) row.insertBefore(state, action);
			else row.appendChild(state);
		}
		state.textContent = labels.state;

		let created = row.querySelector('.admin-japanese-table-created-head');
		if (!(created instanceof HTMLTableCellElement)) {
			created = document.createElement('th');
			created.className = 'admin-japanese-table-created-head';
			row.appendChild(created);
		}
		created.textContent = labels.created;
	}

	function renderRows() {
		ensureHeaders();
		document.querySelectorAll('#japanese-word-table-body > tr').forEach((row) => {
			if (!(row instanceof HTMLTableRowElement)) return;
			row.querySelector('.admin-japanese-table-state-cell')?.remove();
			row.querySelector('.admin-japanese-table-created-cell')?.remove();
			const id = wordIdFromRow(row);
			const word = wordMap.get(id);
			const learningState = stateValue(word);
			row.dataset.learningState = learningState;

			const stateCell = document.createElement('td');
			stateCell.className = 'admin-japanese-table-state-cell';
			const badge = document.createElement('span');
			badge.className = `admin-japanese-learning-state is-${learningState}`;
			badge.textContent = stateLabel(learningState);
			stateCell.appendChild(badge);
			const actionCell = row.querySelector('.admin-japanese-actions')?.closest('td');
			if (actionCell) row.insertBefore(stateCell, actionCell);
			else row.appendChild(stateCell);

			const createdCell = document.createElement('td');
			createdCell.className = 'admin-japanese-table-created-cell';
			const parts = dateParts(word?.created_at);
			createdCell.textContent = parts?.label ?? '—';
			if (parts) createdCell.title = parts.iso;
			row.appendChild(createdCell);
		});
		applyLearningFilter();
	}

	function applyLearningFilter() {
		const selected = ensureFilter()?.value ?? '';
		document.querySelectorAll('#japanese-word-table-body > tr').forEach((row) => {
			if (!(row instanceof HTMLTableRowElement)) return;
			const excluded = Boolean(selected) && (row.dataset.learningState || 'unlearned') !== selected;
			row.dataset.learningExcluded = excluded ? 'true' : 'false';
			if (excluded) row.hidden = true;
		});
		document.dispatchEvent(new CustomEvent('japaneselearningfilterchange'));
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
			console.warn('Failed to load Japanese word metadata', error);
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
		ensureFilter();
		ensureHeaders();
		observeTable();
		await refresh();
		document.addEventListener('adminlanguagechange', () => {
			const filter = ensureFilter();
			if (filter) fillFilter(filter, filter.value);
			ensureHeaders();
			renderRows();
		});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
