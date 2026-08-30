(() => {
	const FORM_COLLAPSE_KEY = 'song_admin_japanese_form_collapsed';
	const IMPORT_COLLAPSE_KEY = 'song_admin_japanese_import_collapsed';
	let addButton = null;

	function currentLanguage() {
		return window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja';
	}

	function copy() {
		return currentLanguage() === 'ko'
			? {
				add: '+ 단어 추가',
				collapseImport: 'Excel 일괄 등록 접기',
				expandImport: 'Excel 일괄 등록 펼치기',
			}
			: {
				add: '+ 単語追加',
				collapseImport: 'Excel一括登録を閉じる',
				expandImport: 'Excel一括登録を開く',
			};
	}

	function moveTabsToHeading() {
		const heading = document.querySelector('.admin-content > .admin-page-heading');
		const tabs = document.querySelector('.admin-content > .admin-japanese-tabs');
		if (!heading || !tabs || heading.parentElement?.classList.contains('admin-japanese-page-topline')) return;
		const row = document.createElement('div');
		row.className = 'admin-japanese-page-topline';
		heading.parentNode?.insertBefore(row, heading);
		row.append(heading, tabs);
	}

	function rearrangeWorkspace() {
		const layout = document.getElementById('admin-japanese-layout');
		const form = document.getElementById('japanese-word-form-card');
		const list = document.querySelector('.admin-japanese-list-card');
		if (!layout || !form || !list) return;
		layout.classList.add('admin-japanese-workspace');
		// Word input belongs immediately above the word list. Do not use a side/fixed workspace.
		if (layout.firstElementChild !== form) layout.insertBefore(form, layout.firstElementChild);
		if (form.nextElementSibling !== list) layout.insertBefore(list, form.nextSibling);
	}

	function ensureListAddButton() {
		if (addButton) return;
		const header = document.querySelector('.admin-japanese-list-header');
		const count = document.getElementById('japanese-word-count');
		if (!header || !count) return;
		let actions = header.querySelector('.admin-japanese-list-heading-actions');
		if (!actions) {
			actions = document.createElement('div');
			actions.className = 'admin-japanese-list-heading-actions';
			header.appendChild(actions);
		}
		addButton = document.createElement('button');
		addButton.id = 'japanese-word-list-add';
		addButton.className = 'admin-japanese-list-add';
		addButton.type = 'button';
		addButton.addEventListener('click', () => {
			document.getElementById('japanese-word-new')?.click();
			const form = document.getElementById('japanese-word-form-card');
			form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		});
		actions.append(addButton, count);
		addButton.textContent = copy().add;
	}

	function setImportCollapsed(card, body, toggle, collapsed, persist = true) {
		card.classList.toggle('is-collapsed', collapsed);
		body.hidden = collapsed;
		toggle.setAttribute('aria-expanded', String(!collapsed));
		const labels = copy();
		toggle.textContent = collapsed ? '⌄' : '⌃';
		toggle.title = collapsed ? labels.expandImport : labels.collapseImport;
		toggle.setAttribute('aria-label', toggle.title);
		if (persist) localStorage.setItem(IMPORT_COLLAPSE_KEY, collapsed ? '1' : '0');
	}

	function enhanceImportCard() {
		const card = document.getElementById('japanese-excel-import-card');
		if (!card || card.dataset.collapsible === 'true') return Boolean(card);
		const heading = card.querySelector('.admin-japanese-import-heading');
		if (!heading) return false;
		card.dataset.collapsible = 'true';

		const body = document.createElement('div');
		body.className = 'admin-japanese-import-body';
		while (heading.nextSibling) body.appendChild(heading.nextSibling);
		card.appendChild(body);

		const footer = document.createElement('div');
		footer.className = 'admin-japanese-import-collapse-footer';
		const toggle = document.createElement('button');
		toggle.className = 'admin-japanese-import-collapse';
		toggle.type = 'button';
		footer.appendChild(toggle);
		card.appendChild(footer);
		toggle.addEventListener('click', () => setImportCollapsed(card, body, toggle, !body.hidden));
		setImportCollapsed(card, body, toggle, localStorage.getItem(IMPORT_COLLAPSE_KEY) === '1', false);
		return true;
	}

	function applyDefaultCollapsedState() {
		if (localStorage.getItem(FORM_COLLAPSE_KEY) !== null) return;
		const panel = document.getElementById('japanese-word-form-panel');
		const toggle = document.getElementById('japanese-word-form-toggle');
		if (panel && toggle && !panel.hidden) toggle.click();
	}

	function syncLanguage() {
		if (addButton) addButton.textContent = copy().add;
		const card = document.getElementById('japanese-excel-import-card');
		const body = card?.querySelector('.admin-japanese-import-body');
		const toggle = card?.querySelector('.admin-japanese-import-collapse');
		if (card && body instanceof HTMLElement && toggle instanceof HTMLButtonElement) {
			setImportCollapsed(card, body, toggle, body.hidden, false);
		}
	}

	async function initialize() {
		await Promise.all([window.AdminCommon?.ready, window.AdminI18n?.ready]);
		moveTabsToHeading();
		rearrangeWorkspace();
		ensureListAddButton();
		applyDefaultCollapsedState();
		window.setTimeout(applyDefaultCollapsedState, 120);
		enhanceImportCard();
		new MutationObserver(() => enhanceImportCard()).observe(document.body, { childList: true, subtree: true });
		document.addEventListener('adminlanguagechange', syncLanguage);
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
