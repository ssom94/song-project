(() => {
	const MAX_TAGS = 30;
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

	function isViewMode() {
		return document.body.classList.contains('admin-post-view-mode');
	}

	function findTag(tagId) {
		return tags.find((tag) => tag.id === Number(tagId)) ?? null;
	}

	function ensureTagUi() {
		const input = document.getElementById('post-tags');
		if (!(input instanceof HTMLInputElement)) return null;

		input.type = 'search';
		input.removeAttribute('name');
		input.autocomplete = 'off';
		input.placeholder = currentLanguage() === 'ko' ? '태그 검색' : 'タグを検索';
		input.setAttribute('aria-controls', 'post-tag-options');

		let selected = document.getElementById('post-tag-selected');
		if (!selected) {
			selected = document.createElement('div');
			selected.id = 'post-tag-selected';
			selected.className = 'admin-editor-tag-options';
			selected.setAttribute('aria-live', 'polite');
			input.insertAdjacentElement('beforebegin', selected);
		}

		let options = document.getElementById('post-tag-options');
		if (!options) {
			options = document.createElement('div');
			options.id = 'post-tag-options';
			options.className = 'admin-editor-tag-options';
			options.setAttribute('role', 'listbox');
			input.insertAdjacentElement('afterend', options);
		}

		return { input, selected, options };
	}

	function getSelectedTags() {
		return [...selectedTagIds]
			.map(findTag)
			.filter(Boolean)
			.sort((a, b) => tagLabel(a).localeCompare(tagLabel(b), currentLanguage() === 'ko' ? 'ko' : 'ja'));
	}

	function notifySelectionChange() {
		const input = document.getElementById('post-tags');
		input?.dispatchEvent(new Event('change', { bubbles: true }));
	}

	function removeTag(tagId) {
		if (isViewMode()) return;
		selectedTagIds.delete(tagId);
		renderTagControl();
		notifySelectionChange();
	}

	function addTag(tagId) {
		if (isViewMode() || selectedTagIds.size >= MAX_TAGS) return;
		selectedTagIds.add(tagId);
		const input = document.getElementById('post-tags');
		if (input instanceof HTMLInputElement) input.value = '';
		renderTagControl();
		notifySelectionChange();
		requestAnimationFrame(() => input?.focus({ preventScroll: true }));
	}

	function renderSelectedTags(selected) {
		selected.replaceChildren();
		const selectedTags = getSelectedTags();

		if (selectedTags.length === 0) {
			const empty = document.createElement('span');
			empty.className = 'admin-editor-tag-empty';
			empty.textContent = currentLanguage() === 'ko' ? '선택된 태그 없음' : '選択中のタグはありません';
			selected.appendChild(empty);
			return;
		}

		for (const tag of selectedTags) {
			if (isViewMode()) {
				const chip = document.createElement('span');
				chip.className = 'admin-editor-tag-choice is-selected';
				chip.textContent = tagLabel(tag);
				selected.appendChild(chip);
				continue;
			}

			const chip = document.createElement('button');
			chip.className = 'admin-editor-tag-choice is-selected';
			chip.type = 'button';
			chip.setAttribute(
				'aria-label',
				`${currentLanguage() === 'ko' ? '태그 해제' : 'タグを解除'}: ${tagLabel(tag)}`,
			);
			chip.textContent = `${tagLabel(tag)} ×`;
			chip.addEventListener('click', () => removeTag(tag.id));
			selected.appendChild(chip);
		}
	}

	function renderTagOptions(input, options) {
		const viewMode = isViewMode();
		input.hidden = viewMode;
		options.hidden = viewMode;
		if (viewMode) {
			options.replaceChildren();
			return;
		}

		const query = normalize(input.value);
		const available = tags.filter((tag) => !selectedTagIds.has(tag.id));
		const visibleTags = available.filter((tag) => {
			if (!query) return true;
			return normalize(tag.names?.ja).includes(query)
				|| normalize(tag.names?.ko).includes(query)
				|| normalize(tagLabel(tag)).includes(query);
		}).slice(0, 20);

		options.replaceChildren();
		if (tags.length === 0) {
			const empty = document.createElement('span');
			empty.className = 'admin-editor-tag-empty';
			empty.textContent = currentLanguage() === 'ko' ? '등록된 태그가 없습니다.' : '登録済みのタグがありません。';
			options.appendChild(empty);
			return;
		}

		if (available.length === 0) {
			const empty = document.createElement('span');
			empty.className = 'admin-editor-tag-empty';
			empty.textContent = currentLanguage() === 'ko' ? '선택 가능한 태그를 모두 추가했습니다.' : '選択可能なタグはすべて追加済みです。';
			options.appendChild(empty);
			return;
		}

		if (visibleTags.length === 0) {
			const empty = document.createElement('span');
			empty.className = 'admin-editor-tag-empty';
			empty.textContent = currentLanguage() === 'ko' ? '검색 결과가 없습니다.' : '該当するタグがありません。';
			options.appendChild(empty);
			return;
		}

		for (const tag of visibleTags) {
			const button = document.createElement('button');
			button.className = 'admin-editor-tag-choice';
			button.type = 'button';
			button.setAttribute('role', 'option');
			button.setAttribute('aria-selected', 'false');
			button.disabled = selectedTagIds.size >= MAX_TAGS;
			button.textContent = `+ ${tagLabel(tag)}`;
			button.addEventListener('click', () => addTag(tag.id));
			options.appendChild(button);
		}
	}

	function renderTagControl() {
		const ui = ensureTagUi();
		if (!ui) return;
		ui.input.placeholder = currentLanguage() === 'ko' ? '태그 검색' : 'タグを検索';
		renderSelectedTags(ui.selected);
		renderTagOptions(ui.input, ui.options);
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
		const ui = ensureTagUi();
		ui?.input.addEventListener('input', () => renderTagOptions(ui.input, ui.options));

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
		renderTagControl();
		resolveReady(true);
	}

	function getSelectedTagIds() {
		const activeIds = new Set(tags.map((tag) => tag.id));
		return [...selectedTagIds]
			.filter((id) => activeIds.has(id))
			.sort((a, b) => a - b);
	}

	function setSelectedTagIds(ids) {
		const activeIds = new Set(tags.map((tag) => tag.id));
		selectedTagIds = new Set(
			(Array.isArray(ids) ? ids : [])
				.map(Number)
				.filter((id) => Number.isSafeInteger(id) && id > 0 && activeIds.has(id))
				.slice(0, MAX_TAGS),
		);
		renderTagControl();
	}

	document.addEventListener('adminlanguagechange', () => {
		renderCategories();
		renderTagControl();
	});

	const modeObserver = new MutationObserver((mutations) => {
		if (mutations.some((mutation) => mutation.attributeName === 'class')) {
			renderTagControl();
		}
	});
	modeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

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
		refresh: renderTagControl,
		setSelectedTagIds,
	};
})();
