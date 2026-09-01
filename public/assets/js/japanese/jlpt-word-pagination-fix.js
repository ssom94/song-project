(() => {
	const LIST_IDS = ['jlpt-review-words', 'jlpt-new-words'];
	const savedPages = new Map();
	let initialized = false;

	function injectStyle() {
		if (document.getElementById('jlpt-word-pagination-fix-style')) return;
		const style = document.createElement('style');
		style.id = 'jlpt-word-pagination-fix-style';
		style.textContent = `
			#jlpt-study-detail .jlpt-section-body.is-scrollable,
			#jlpt-study-detail .jlpt-word-section,
			#jlpt-study-detail .jlpt-word-list {
				max-height: none !important;
				height: auto !important;
				overflow: visible !important;
				overflow-y: visible !important;
				overflow-x: visible !important;
				scrollbar-gutter: auto !important;
			}
			#jlpt-study-detail .jlpt-section-body.is-scrollable { padding-right: 0 !important; }
		`;
		document.head.appendChild(style);
	}

	function pageOf(id) {
		const list = document.getElementById(id);
		const value = Number(list?.dataset.page || savedPages.get(id) || 1);
		return Number.isFinite(value) && value > 0 ? value : 1;
	}

	function rememberAllPages() {
		for (const id of LIST_IDS) savedPages.set(id, pageOf(id));
	}

	function restorePage(id) {
		const list = document.getElementById(id);
		if (!(list instanceof HTMLElement)) return;
		const wanted = Math.max(1, Number(savedPages.get(id) || list.dataset.page || 1));
		list.dataset.page = String(wanted);
		queueMicrotask(() => {
			const current = document.getElementById(id);
			if (!(current instanceof HTMLElement)) return;
			current.dataset.page = String(wanted);
			const pager = current.nextElementSibling;
			if (!(pager instanceof HTMLElement) || !pager.classList.contains('jlpt-pager')) return;
			const buttons = [...pager.querySelectorAll('button')];
			const target = buttons.find((button) => button.textContent?.trim() === String(wanted));
			if (target instanceof HTMLButtonElement && !target.classList.contains('is-active')) target.click();
		});
	}

	function watchList(id) {
		const list = document.getElementById(id);
		if (!(list instanceof HTMLElement) || list.dataset.pageFixObserved === 'true') return;
		list.dataset.pageFixObserved = 'true';
		savedPages.set(id, pageOf(id));
		new MutationObserver((mutations) => {
			if (!mutations.some((mutation) => mutation.type === 'childList')) return;
			const wanted = savedPages.get(id) || 1;
			queueMicrotask(() => {
				const current = document.getElementById(id);
				if (!(current instanceof HTMLElement)) return;
				current.dataset.page = String(wanted);
				window.setTimeout(() => restorePage(id), 0);
			});
		}).observe(list, { childList: true });
	}

	function capturePageIntent(event) {
		const target = event.target instanceof Element ? event.target : null;
		if (!target) return;

		if (target.closest('.jlpt-state-button')) {
			rememberAllPages();
			return;
		}

		const pagerButton = target.closest('.jlpt-pager button');
		if (!(pagerButton instanceof HTMLButtonElement)) return;
		const pager = pagerButton.closest('.jlpt-pager');
		const list = pager?.previousElementSibling;
		if (!(list instanceof HTMLElement) || !LIST_IDS.includes(list.id)) return;
		const label = pagerButton.textContent?.trim() || '';
		const current = pageOf(list.id);
		let next = current;
		if (/^\d+$/.test(label)) next = Number(label);
		else if (label === '‹') next = Math.max(1, current - 1);
		else if (label === '›') next = current + 1;
		savedPages.set(list.id, next);
	}

	function init() {
		if (initialized) return;
		initialized = true;
		injectStyle();
		document.addEventListener('click', capturePageIntent, true);
		LIST_IDS.forEach(watchList);

		const detail = document.getElementById('jlpt-study-detail');
		if (detail instanceof HTMLElement) {
			new MutationObserver(() => LIST_IDS.forEach(watchList)).observe(detail, { childList: true, subtree: true });
		}
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
	else init();
})();
