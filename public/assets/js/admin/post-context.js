(() => {
	let refreshTimer = null;
	let refreshAttempts = 0;

	function language() {
		return window.AdminI18n?.getLanguage?.() ?? 'ja';
	}

	function categoryLabel(category) {
		const lang = language();
		return category?.names?.[lang]
			?? category?.names?.ja
			?? category?.names?.ko
			?? '';
	}

	function categoryTrail(categoryId) {
		const categories = window.AdminPostCategories?.getAll?.() ?? [];
		const byId = new Map(categories.map((category) => [Number(category.id), category]));
		const trail = [];
		const visited = new Set();
		let current = byId.get(Number(categoryId)) ?? null;

		while (current && !visited.has(Number(current.id)) && trail.length < 8) {
			visited.add(Number(current.id));
			const label = categoryLabel(current);
			if (label) trail.unshift(label);
			current = current.parentId ? byId.get(Number(current.parentId)) ?? null : null;
		}
		return trail;
	}

	function refresh() {
		const node = document.getElementById('admin-page-taxonomy');
		const select = document.getElementById('post-category');
		if (!node || !(select instanceof HTMLSelectElement)) return;

		const categoryId = Number(select.value);
		const trail = Number.isSafeInteger(categoryId) && categoryId > 0 ? categoryTrail(categoryId) : [];
		node.textContent = trail.join(' - ');
		node.hidden = trail.length === 0;
	}

	function startRefreshWindow() {
		window.clearInterval(refreshTimer);
		refreshAttempts = 0;
		refreshTimer = window.setInterval(() => {
			refreshAttempts += 1;
			refresh();
			if (refreshAttempts >= 30) window.clearInterval(refreshTimer);
		}, 100);
	}

	async function initialize() {
		await window.AdminPostCategories?.ready;
		const select = document.getElementById('post-category');
		select?.addEventListener('change', refresh);
		document.addEventListener('adminlanguagechange', refresh);
		refresh();
		startRefreshWindow();
	}

	window.AdminPostContext = { refresh };

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
