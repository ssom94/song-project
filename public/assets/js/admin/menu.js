(() => {
	let menuItems = null;

	async function loadMenuItems() {
		if (menuItems) return menuItems;

		const response = await fetch('/assets/config/admin-menu.json', {
			cache: 'no-cache',
		});

		if (!response.ok) {
			throw new Error('Failed to load admin menu configuration.');
		}

		menuItems = await response.json();
		return menuItems;
	}

	function normalizePath(path) {
		if (!path || path === '/') return '/';
		return path.endsWith('/') ? path : `${path}/`;
	}

	function isActiveMenuItem(item) {
		if (!item.href || item.href === '#') return false;

		const currentPath = normalizePath(window.location.pathname);
		const itemPath = normalizePath(item.href);

		if (itemPath === '/admin/') {
			return currentPath === itemPath;
		}

		return currentPath === itemPath || currentPath.startsWith(itemPath);
	}

	function itemLabel(item) {
		const translated = window.AdminI18n?.t(item.key) ?? item.key;
		if (translated !== item.key) return translated;
		return window.AdminI18n?.getLanguage?.() === 'ko'
			? (item.labelKo || item.labelJa || item.key)
			: (item.labelJa || item.labelKo || item.key);
	}

	function japaneseTabItems() {
		const korean = window.AdminI18n?.getLanguage?.() === 'ko';
		return [
			{ key: 'words', href: '/admin/japanese/', label: korean ? '단어' : '単語' },
			{ key: 'parts', href: '/admin/japanese/parts/', label: korean ? '품사' : '品詞' },
			{ key: 'categories', href: '/admin/japanese/categories/', label: korean ? '학습 분류' : '学習分類' },
			{ key: 'quiz', href: '/admin/japanese/quiz/', label: korean ? '퀴즈' : 'クイズ' },
		];
	}

	function currentJapaneseTab() {
		const path = normalizePath(window.location.pathname);
		if (path.startsWith('/admin/japanese/parts/')) return 'parts';
		if (path.startsWith('/admin/japanese/categories/')) return 'categories';
		if (path.startsWith('/admin/japanese/quiz/')) return 'quiz';
		return path === '/admin/japanese/' ? 'words' : '';
	}

	function normalizeJapaneseManagementTabs() {
		const tabs = document.querySelector('.admin-content > .admin-japanese-tabs, .admin-japanese-page-topline > .admin-japanese-tabs');
		const heading = document.querySelector('.admin-content > .admin-page-heading, .admin-japanese-page-topline > .admin-page-heading');
		if (!(tabs instanceof HTMLElement) || !(heading instanceof HTMLElement)) return;

		const active = currentJapaneseTab();
		if (!active) return;

		const fragment = document.createDocumentFragment();
		for (const item of japaneseTabItems()) {
			const link = document.createElement('a');
			link.className = `admin-japanese-tab${item.key === active ? ' is-active' : ''}`;
			link.href = item.href;
			link.textContent = item.label;
			if (item.key === active) link.setAttribute('aria-current', 'page');
			fragment.appendChild(link);
		}
		tabs.replaceChildren(fragment);
		tabs.setAttribute('aria-label', window.AdminI18n?.getLanguage?.() === 'ko' ? '일본어 학습 관리' : '日本語学習管理');

		let row = heading.parentElement;
		if (!row?.classList.contains('admin-japanese-page-topline')) {
			row = document.createElement('div');
			row.className = 'admin-japanese-page-topline';
			heading.parentNode?.insertBefore(row, heading);
			row.append(heading, tabs);
		} else if (tabs.parentElement !== row) {
			row.appendChild(tabs);
		}
	}

	async function renderMenu() {
		const nav = document.getElementById('admin-nav');
		if (!nav) return;

		const items = await loadMenuItems();
		const fragment = document.createDocumentFragment();

		items.forEach((item) => {
			const link = document.createElement('a');
			link.href = item.href;
			link.dataset.i18n = item.key;
			link.textContent = itemLabel(item);

			if (isActiveMenuItem(item)) {
				link.classList.add('is-active');
				link.setAttribute('aria-current', 'page');
			}

			if (item.href === '#') {
				link.setAttribute('aria-disabled', 'true');
				link.addEventListener('click', (event) => event.preventDefault());
			}

			fragment.appendChild(link);
		});

		nav.replaceChildren(fragment);
		normalizeJapaneseManagementTabs();
	}

	async function refreshMenuLabels() {
		const items = await loadMenuItems();
		const byKey = new Map(items.map((item) => [item.key, item]));
		document.querySelectorAll('#admin-nav [data-i18n]').forEach((link) => {
			const key = link.dataset.i18n;
			const item = key ? byKey.get(key) : null;
			if (item) link.textContent = itemLabel(item);
		});
		normalizeJapaneseManagementTabs();
	}

	document.addEventListener('adminlanguagechange', refreshMenuLabels);

	const ready = (async () => {
		if (window.AdminI18n?.ready) {
			await window.AdminI18n.ready;
		}
		await renderMenu();
		normalizeJapaneseManagementTabs();
	})();

	window.AdminMenu = {
		ready,
		renderMenu,
		normalizeJapaneseManagementTabs,
	};
})();
