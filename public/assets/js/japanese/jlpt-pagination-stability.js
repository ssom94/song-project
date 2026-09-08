(() => {
	const LIST_IDS = new Set(['jlpt-review-words', 'jlpt-new-words']);
	const restoreTimers = new Map();

	function listForPager(pager) {
		const list = pager?.previousElementSibling;
		return list instanceof HTMLElement && LIST_IDS.has(list.id) ? list : null;
	}

	function currentPage(list) {
		return Math.max(1, Number(list?.dataset?.page || 1));
	}

	function rememberPage(list, page = currentPage(list)) {
		if (!(list instanceof HTMLElement)) return;
		list.dataset.stablePage = String(Math.max(1, Number(page || 1)));
	}

	function pagerTarget(button, list) {
		const text = button.textContent?.trim() || '';
		if (/^\d+$/.test(text)) return Number(text);
		const current = currentPage(list);
		if (text === '‹') return Math.max(1, current - 1);
		if (text === '›') return current + 1;
		return current;
	}

	function restorePage(list) {
		if (!(list instanceof HTMLElement)) return;
		const desired = Math.max(1, Number(list.dataset.stablePage || list.dataset.page || 1));
		const pager = list.nextElementSibling;
		if (!(pager instanceof HTMLElement) || !pager.classList.contains('jlpt-pager')) {
			list.dataset.page = '1';
			list.dataset.stablePage = '1';
			return;
		}
		const numeric = [...pager.querySelectorAll('button')]
			.filter((button) => /^\d+$/.test(button.textContent?.trim() || ''));
		if (!numeric.length) return;
		const maxPage = Math.max(...numeric.map((button) => Number(button.textContent?.trim() || 1)));
		const target = Math.min(desired, maxPage);
		list.dataset.stablePage = String(target);
		if (currentPage(list) === target) return;
		const button = numeric.find((item) => Number(item.textContent?.trim() || 0) === target);
		button?.click();
	}

	function scheduleRestore(list) {
		if (!(list instanceof HTMLElement)) return;
		window.clearTimeout(restoreTimers.get(list));
		const timer = window.setTimeout(() => {
			restoreTimers.delete(list);
			restorePage(list);
		}, 0);
		restoreTimers.set(list, timer);
	}

	function observeList(list) {
		if (!(list instanceof HTMLElement) || list.dataset.paginationStable === 'true') return;
		list.dataset.paginationStable = 'true';
		rememberPage(list);
		new MutationObserver((mutations) => {
			if (mutations.some((mutation) => mutation.type === 'childList')) scheduleRestore(list);
		}).observe(list, { childList: true });
	}

	function bindLists() {
		for (const id of LIST_IDS) observeList(document.getElementById(id));
	}

	document.addEventListener('click', (event) => {
		const target = event.target instanceof Element ? event.target : null;
		const pagerButton = target?.closest('.jlpt-pager button');
		if (pagerButton instanceof HTMLButtonElement) {
			const list = listForPager(pagerButton.closest('.jlpt-pager'));
			if (list) rememberPage(list, pagerTarget(pagerButton, list));
		}

		const stateButton = target?.closest('.jlpt-state-button');
		if (stateButton instanceof HTMLButtonElement) {
			const list = stateButton.closest('.jlpt-word-list');
			if (list instanceof HTMLElement && LIST_IDS.has(list.id)) rememberPage(list);
		}
	}, true);

	document.addEventListener('change', (event) => {
		if (!(event.target instanceof HTMLInputElement) || event.target.id !== 'jlpt-study-date') return;
		for (const id of LIST_IDS) {
			const list = document.getElementById(id);
			if (list instanceof HTMLElement) rememberPage(list, 1);
		}
	}, true);

	bindLists();
	window.addEventListener('song:jlpt:features-ready', bindLists);
})();
