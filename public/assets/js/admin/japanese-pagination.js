(() => {
	const PAGE_SIZE = 20;
	let currentPage = 1;
	let renderTimer = 0;

	function currentLanguage() {
		return window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja';
	}

	function copy() {
		return currentLanguage() === 'ko'
			? { previous: '이전', next: '다음', summary: (start, end, total) => `${start}-${end} / ${total}개` }
			: { previous: '前へ', next: '次へ', summary: (start, end, total) => `${start}-${end} / ${total}件` };
	}

	function allRows() {
		return [...document.querySelectorAll('#japanese-word-table-body > tr')];
	}

	function rows() {
		return allRows().filter((row) => row.dataset.learningExcluded !== 'true');
	}

	function createPager(id, position) {
		const tableWrap = document.getElementById('japanese-word-table-wrap');
		if (!tableWrap) return null;
		const pager = document.createElement('nav');
		pager.id = id;
		pager.className = `admin-japanese-pagination is-${position}`;
		pager.setAttribute('aria-label', currentLanguage() === 'ko' ? '단어 목록 페이지' : '単語一覧ページ');
		if (position === 'top') tableWrap.insertAdjacentElement('beforebegin', pager);
		else tableWrap.insertAdjacentElement('afterend', pager);
		return pager;
	}

	function ensurePagers() {
		return [
			document.getElementById('japanese-word-pagination-top') || createPager('japanese-word-pagination-top', 'top'),
			document.getElementById('japanese-word-pagination-bottom') || createPager('japanese-word-pagination-bottom', 'bottom'),
		].filter(Boolean);
	}

	function pageNumbers(totalPages) {
		if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
		const result = [1];
		const start = Math.max(2, currentPage - 1);
		const end = Math.min(totalPages - 1, currentPage + 1);
		if (start > 2) result.push('ellipsis-left');
		for (let page = start; page <= end; page += 1) result.push(page);
		if (end < totalPages - 1) result.push('ellipsis-right');
		result.push(totalPages);
		return result;
	}

	function goToPage(page) {
		if (page === currentPage) return;
		currentPage = page;
		renderPagination();
		document.getElementById('japanese-word-table-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function makeButton(label, page, disabled = false, active = false) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = `admin-japanese-page-button${active ? ' is-active' : ''}`;
		button.textContent = label;
		button.disabled = disabled;
		if (active) button.setAttribute('aria-current', 'page');
		button.addEventListener('click', () => {
			if (!disabled) goToPage(page);
		});
		return button;
	}

	function fillPager(pager, total, totalPages, startIndex, endIndex) {
		pager.replaceChildren();
		if (total <= PAGE_SIZE) {
			pager.hidden = true;
			return;
		}
		pager.hidden = false;
		pager.setAttribute('aria-label', currentLanguage() === 'ko' ? '단어 목록 페이지' : '単語一覧ページ');
		const labels = copy();

		const summary = document.createElement('span');
		summary.className = 'admin-japanese-pagination-summary';
		summary.textContent = labels.summary(startIndex + 1, endIndex, total);

		const controls = document.createElement('div');
		controls.className = 'admin-japanese-pagination-controls';
		controls.appendChild(makeButton(labels.previous, currentPage - 1, currentPage === 1));
		for (const item of pageNumbers(totalPages)) {
			if (typeof item === 'string') {
				const ellipsis = document.createElement('span');
				ellipsis.className = 'admin-japanese-pagination-ellipsis';
				ellipsis.textContent = '…';
				controls.appendChild(ellipsis);
				continue;
			}
			controls.appendChild(makeButton(String(item), item, false, item === currentPage));
		}
		controls.appendChild(makeButton(labels.next, currentPage + 1, currentPage === totalPages));
		pager.append(summary, controls);
	}

	function renderPagination() {
		const everyRow = allRows();
		const values = rows();
		const pagers = ensurePagers();
		if (!pagers.length) return;

		everyRow.forEach((row) => {
			if (row.dataset.learningExcluded === 'true') row.hidden = true;
		});

		const total = values.length;
		const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
		currentPage = Math.min(Math.max(1, currentPage), totalPages);
		const startIndex = (currentPage - 1) * PAGE_SIZE;
		const endIndex = Math.min(startIndex + PAGE_SIZE, total);

		values.forEach((row, index) => {
			row.hidden = index < startIndex || index >= endIndex;
		});
		pagers.forEach((pager) => fillPager(pager, total, totalPages, startIndex, endIndex));
	}

	function scheduleRender(resetPage = false) {
		if (resetPage) currentPage = 1;
		window.clearTimeout(renderTimer);
		renderTimer = window.setTimeout(renderPagination, 35);
	}

	function observeRows() {
		const body = document.getElementById('japanese-word-table-body');
		if (!body) return;
		new MutationObserver((mutations) => {
			if (mutations.some((mutation) => mutation.type === 'childList')) scheduleRender();
		}).observe(body, { childList: true });
	}

	async function initialize() {
		await Promise.all([window.AdminCommon?.ready, window.AdminI18n?.ready]);
		observeRows();
		document.getElementById('japanese-word-search')?.addEventListener('input', () => scheduleRender(true));
		document.getElementById('japanese-jlpt-filter')?.addEventListener('change', () => scheduleRender(true));
		document.addEventListener('japaneselearningfilterchange', () => scheduleRender(true));
		document.addEventListener('adminlanguagechange', () => scheduleRender());
		renderPagination();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
