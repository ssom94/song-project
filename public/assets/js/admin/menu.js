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

	async function renderMenu() {
		const nav = document.getElementById('admin-nav');
		if (!nav) return;

		const items = await loadMenuItems();
		const fragment = document.createDocumentFragment();

		items.forEach((item) => {
			const link = document.createElement('a');
			link.href = item.href;
			link.dataset.i18n = item.key;
			link.textContent = window.AdminI18n?.t(item.key) ?? item.key;

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

	function refreshMenuLabels() {
		document.querySelectorAll('#admin-nav [data-i18n]').forEach((link) => {
			const key = link.dataset.i18n;
			if (key) link.textContent = window.AdminI18n?.t(key) ?? key;
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
