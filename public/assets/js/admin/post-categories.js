(() => {
	let categories = [];
	let resolveReady;

	const ready = new Promise((resolve) => {
		resolveReady = resolve;
	});

	function t(key, fallback) {
		const value = window.AdminI18n?.t(key);
		return value && value !== key ? value : fallback;
	}

	function categoryLabel(category) {
		const language = window.AdminI18n?.getLanguage?.() ?? 'ja';
		return category?.names?.[language]
			?? category?.names?.ja
			?? category?.names?.ko
			?? `#${category?.id ?? ''}`;
	}

	function render() {
		const select = document.getElementById('post-category');
		if (!select) return;

		const selectedValue = select.value;
		select.replaceChildren();

		const unclassified = document.createElement('option');
		unclassified.value = '';
		unclassified.dataset.i18n = 'categoryNone';
		unclassified.textContent = t('categoryNone', '未分類');
		select.appendChild(unclassified);

		for (const category of categories) {
			const option = document.createElement('option');
			option.value = String(category.id);
			option.textContent = categoryLabel(category);
			select.appendChild(option);
		}

		if ([...select.options].some((option) => option.value === selectedValue)) {
			select.value = selectedValue;
		}
	}

	async function load() {
		const select = document.getElementById('post-category');
		if (!select) {
			resolveReady(true);
			return;
		}

		try {
			const response = await fetch('/api/admin/categories', {
				method: 'GET',
				credentials: 'same-origin',
				cache: 'no-store',
			});

			if (response.status === 401) {
				window.location.replace('/admin/login/');
				resolveReady(false);
				return;
			}

			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok || !Array.isArray(result.categories)) {
				throw new Error('Invalid category list response');
			}

			categories = result.categories;
		} catch (error) {
			console.error('Failed to load admin categories', error);
			categories = [];
		}

		render();
		resolveReady(true);
	}

	document.addEventListener('adminlanguagechange', render);

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', load, { once: true });
	} else {
		load();
	}

	window.AdminPostCategories = {
		ready,
		getAll: () => [...categories],
	};
})();
