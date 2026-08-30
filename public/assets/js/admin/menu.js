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
	}

	async function refreshMenuLabels() {
		const items = await loadMenuItems();
		const byKey = new Map(items.map((item) => [item.key, item]));
		document.querySelectorAll('#admin-nav [data-i18n]').forEach((link) => {
			const key = link.dataset.i18n;
			const item = key ? byKey.get(key) : null;
			if (item) link.textContent = itemLabel(item);
		});
	}

	document.addEventListener('adminlanguagechange', refreshMenuLabels);

	const ready = (async () => {
		if (window.AdminI18n?.ready) {
			await window.AdminI18n.ready;
		}
		await renderMenu();
	})();

	window.AdminMenu = {
		ready,
		renderMenu,
	};
})();
