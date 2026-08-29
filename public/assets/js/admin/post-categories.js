(() => {
	let categories = [];
	let tags = [];
	let selectedTagIds = new Set();
	let resolveReady;

	const ready = new Promise((resolve) => {
		resolveReady = resolve;
	});

	function t(key, fallback) {
		const value = window.AdminI18n?.t(key);
		return value && value !== key ? value : fallback;
	}

	function currentLanguage() {
		return window.AdminI18n?.getLanguage?.() ?? 'ja';
	}

	function categoryLabel(category) {
		const language = currentLanguage();
		return category?.names?.[language]
			?? category?.names?.ja
			?? category?.names?.ko
			?? `#${category?.id ?? ''}`;
	}

	function tagLabel(tag) {
		const language = currentLanguage();
		return tag?.names?.[language]
			?? tag?.names?.ja
			?? tag?.names?.ko
			?? `#${tag?.id ?? ''}`;
	}

	function renderCategories() {
		const select = document.getElementById('post-category');
		if (!select) return;

		const selectedValue = select.value;
		select.replaceChildren();

		const unclassified = document.createElement('option');
		unclassified.value = '';
		unclassified.dataset.i18n = 'categoryNone';
		unclassified.textContent = t('categoryNone', currentLanguage() === 'ko' ? '미분류' : '未分類');
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

	function normalize(value) {
		return String(value ?? '').normalize('NFKC').toLocaleLowerCase().trim();
	}

	function ensureTagUi() {
		const input = document.getElementById('post-tags');
		if (!(input instanceof HTMLInputElement)) return null;

		input.removeAttribute('name');
		input.autocomplete = 'off';
		input.placeholder = currentLanguage() === 'ko' ? '태그 검색' : 'タグを検索';
		input.setAttribute('aria-controls', 'post-tag-options');

		let options = document.getElementById('post-tag-options');
		if (!options) {
			options = document.createElement('div');
			options.id = 'post-tag-options';
			options.className = 'admin-editor-tag-options';
			options.setAttribute('role', 'group');

			const label = input.closest('.admin-editor-field')?.querySelector('label');
			if (label) {
				label.id ||= 'post-tags-label';
				options.setAttribute('aria-labelledby', label.id);
			}

			input.insertAdjacentElement('afterend', options);
			input.addEventListener('input', renderTags);
		}

		return options;
	}

	function renderTags() {
		const input = document.getElementById('post-tags');
		const options = ensureTagUi();
		if (!(input instanceof HTMLInputElement) || !options) return;

		input.placeholder = currentLanguage() === 'ko' ? '태그 검색' : 'タグを検索';
		const query = normalize(input.value);
		const visibleTags = tags.filter((tag) => {
			if (!query) return true;
			return normalize(tag.names?.ja).includes(query)
				|| normalize(tag.names?.ko).includes(query)
				|| normalize(tagLabel(tag)).includes(query);
		});

		options.replaceChildren();
		if (tags.length === 0) {
			const empty = document.createElement('span');
			empty.className = 'admin-editor-tag-empty';
			empty.textContent = '—';
			options.appendChild(empty);
			return;
		}

		if (visibleTags.length === 0) {
			const empty = document.createElement('span');
			empty.className = 'admin-editor-tag-empty';
			empty.textContent = currentLanguage() === 'ko' ? '검색 결과 없음' : '該当するタグなし';
			options.appendChild(empty);
			return;
		}

		const viewMode = document.body.classList.contains('admin-post-view-mode');
		for (const tag of visibleTags) {
			const label = document.createElement('label');
			label.className = 'admin-editor-tag-choice';

			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.value = String(tag.id);
			checkbox.checked = selectedTagIds.has(tag.id);
			checkbox.disabled = viewMode;
			checkbox.setAttribute('aria-label', tagLabel(tag));
			checkbox.addEventListener('change', () => {
				if (checkbox.checked) selectedTagIds.add(tag.id);
				else selectedTagIds.delete(tag.id);
				label.classList.toggle('is-selected', checkbox.checked);
			});

			const text = document.createElement('span');
			text.textContent = tagLabel(tag);
			label.classList.toggle('is-selected', checkbox.checked);
			label.append(checkbox, text);
			options.appendChild(label);
		}
	}

	async function fetchCollection(url, key) {
		const response = await fetch(url, {
			method: 'GET',
			credentials: 'same-origin',
			cache: 'no-store',
		});

		if (response.status === 401) {
			window.location.replace('/admin/login/');
			throw new Error('UNAUTHORIZED');
		}

		const result = await response.json().catch(() => null);
		if (!response.ok || !result?.ok || !Array.isArray(result[key])) {
			throw new Error(`Invalid ${key} response`);
		}
		return result[key];
	}

	async function load() {
		try {
			const [loadedCategories, loadedTags] = await Promise.all([
				fetchCollection('/api/admin/categories', 'categories'),
				fetchCollection('/api/admin/tags', 'tags'),
			]);
			categories = loadedCategories;
			tags = loadedTags;
		} catch (error) {
			if (error?.message !== 'UNAUTHORIZED') {
				console.error('Failed to load post taxonomy', error);
			}
			categories = [];
			tags = [];
		}

		renderCategories();
		renderTags();
		resolveReady(true);
	}

	function getSelectedTagIds() {
		const activeIds = new Set(tags.map((tag) => tag.id));
		return [...selectedTagIds]
			.filter((id) => activeIds.has(id))
			.sort((a, b) => a - b);
	}

	function setSelectedTagIds(ids) {
		selectedTagIds = new Set(
			(Array.isArray(ids) ? ids : [])
				.map(Number)
				.filter((id) => Number.isSafeInteger(id) && id > 0),
		);
		renderTags();
	}

	document.addEventListener('adminlanguagechange', () => {
		renderCategories();
		renderTags();
	});

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', load, { once: true });
	} else {
		load();
	}

	window.AdminPostCategories = {
		ready,
		getAll: () => [...categories],
		getAllTags: () => [...tags],
		getSelectedTagIds,
		setSelectedTagIds,
	};
})();
