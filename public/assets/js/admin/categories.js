(() => {
	let categories = [];
	let editingId = null;
	let saving = false;

	function t(key, fallback) {
		const value = window.AdminI18n?.t(key);
		return value && value !== key ? value : fallback;
	}

	function currentLanguage() {
		return window.AdminI18n?.getLanguage?.() ?? 'ja';
	}

	function categoryName(category, language = currentLanguage()) {
		return category?.names?.[language]
			|| category?.names?.ja
			|| category?.names?.ko
			|| `#${category?.id ?? ''}`;
	}

	function findCategory(id) {
		return categories.find((category) => category.id === Number(id)) ?? null;
	}

	function getChildren(parentId) {
		return categories
			.filter((category) => category.parentId === parentId)
			.sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);
	}

	function flattenCategories() {
		const result = [];
		const visited = new Set();

		function walk(parentId, depth) {
			for (const category of getChildren(parentId)) {
				if (visited.has(category.id)) continue;
				visited.add(category.id);
				result.push({ category, depth });
				walk(category.id, depth + 1);
			}
		}

		walk(null, 0);
		for (const category of categories) {
			if (!visited.has(category.id)) result.push({ category, depth: 0 });
		}
		return result;
	}

	function descendantsOf(categoryId) {
		const ids = new Set();
		function walk(parentId) {
			for (const child of getChildren(parentId)) {
				if (ids.has(child.id)) continue;
				ids.add(child.id);
				walk(child.id);
			}
		}
		walk(categoryId);
		return ids;
	}

	function setStatus(key, type = 'success') {
		const element = document.getElementById('category-form-status');
		if (!element) return;
		element.dataset.messageKey = key;
		element.dataset.type = type;
		element.textContent = t(key, key);
		element.hidden = false;
	}

	function clearStatus() {
		const element = document.getElementById('category-form-status');
		if (!element) return;
		element.hidden = true;
		delete element.dataset.messageKey;
		delete element.dataset.type;
		element.textContent = '';
	}

	function setSaving(value) {
		saving = value;
		const saveButton = document.getElementById('category-save-button');
		const newButton = document.getElementById('category-new-button');
		const cancelButton = document.getElementById('category-cancel-button');
		if (saveButton) saveButton.disabled = value;
		if (newButton) newButton.disabled = value;
		if (cancelButton) cancelButton.disabled = value;
	}

	async function showAlert(messageKey, fallback) {
		if (window.AdminCommon?.alert) {
			await window.AdminCommon.alert({
				titleKey: 'validationWarningTitle',
				messageKey,
				titleFallback: t('validationWarningTitle', '入力内容を確認してください'),
				messageFallback: t(messageKey, fallback),
			});
		} else {
			window.alert(t(messageKey, fallback));
		}
	}

	async function showDeleteConfirm(category) {
		if (!window.AdminCommon?.confirm) {
			return window.confirm(t('categoryDeleteConfirmMessage', 'このカテゴリーを削除しますか？'));
		}

		return window.AdminCommon.confirm({
			titleKey: 'categoryDeleteConfirmTitle',
			messageKey: 'categoryDeleteConfirmMessage',
			confirmKey: 'categoryDelete',
			cancelKey: 'confirmNo',
			titleFallback: 'カテゴリーを削除',
			messageFallback: `${categoryName(category)} を削除しますか？`,
			confirmFallback: '削除',
			cancelFallback: 'いいえ',
		});
	}

	function populateParentSelect() {
		const select = document.getElementById('category-parent');
		if (!select) return;

		const previousValue = select.value;
		const rootOption = document.createElement('option');
		rootOption.value = '';
		rootOption.dataset.i18n = 'categoryTopLevel';
		rootOption.textContent = t('categoryTopLevel', '最上位');

		const fragment = document.createDocumentFragment();
		fragment.appendChild(rootOption);

		const excluded = editingId ? descendantsOf(editingId) : new Set();
		if (editingId) excluded.add(editingId);

		for (const { category, depth } of flattenCategories()) {
			if (excluded.has(category.id)) continue;
			const option = document.createElement('option');
			option.value = String(category.id);
			option.textContent = `${'— '.repeat(Math.min(depth, 4))}${categoryName(category)}`;
			fragment.appendChild(option);
		}

		select.replaceChildren(fragment);
		if ([...select.options].some((option) => option.value === previousValue)) {
			select.value = previousValue;
		}
	}

	function renderCategories() {
		const loading = document.getElementById('category-list-loading');
		const empty = document.getElementById('category-list-empty');
		const tableWrap = document.getElementById('category-table-wrap');
		const tbody = document.getElementById('category-table-body');
		const count = document.getElementById('category-count');
		if (!loading || !empty || !tableWrap || !tbody || !count) return;

		loading.hidden = true;
		count.textContent = String(categories.length);
		tbody.replaceChildren();

		if (categories.length === 0) {
			empty.hidden = false;
			tableWrap.hidden = true;
			populateParentSelect();
			return;
		}

		empty.hidden = true;
		tableWrap.hidden = false;

		for (const { category, depth } of flattenCategories()) {
			const row = document.createElement('tr');

			const nameCell = document.createElement('td');
			const treeName = document.createElement('div');
			treeName.className = 'admin-category-tree-name';
			treeName.dataset.depth = String(Math.min(depth, 3));
			if (depth > 0) {
				const mark = document.createElement('span');
				mark.className = 'admin-category-tree-mark';
				mark.textContent = '↳';
				treeName.appendChild(mark);
			}
			const label = document.createElement('span');
			label.textContent = categoryName(category);
			treeName.appendChild(label);
			nameCell.appendChild(treeName);

			const jaCell = document.createElement('td');
			jaCell.textContent = category.names?.ja ?? '—';

			const koCell = document.createElement('td');
			koCell.textContent = category.names?.ko ?? '—';

			const orderCell = document.createElement('td');
			orderCell.className = 'admin-category-order';
			orderCell.textContent = String(category.displayOrder ?? 0);

			const actionsCell = document.createElement('td');
			const actions = document.createElement('div');
			actions.className = 'admin-category-actions';

			const editButton = document.createElement('button');
			editButton.className = 'admin-category-action';
			editButton.type = 'button';
			editButton.textContent = t('editPost', '編集');
			editButton.addEventListener('click', () => startEditing(category.id));

			const deleteButton = document.createElement('button');
			deleteButton.className = 'admin-category-action admin-category-action-danger';
			deleteButton.type = 'button';
			deleteButton.textContent = t('categoryDelete', '削除');
			deleteButton.addEventListener('click', () => deleteCategory(category.id));

			actions.append(editButton, deleteButton);
			actionsCell.appendChild(actions);
			row.append(nameCell, jaCell, koCell, orderCell, actionsCell);
			tbody.appendChild(row);
		}

		populateParentSelect();
	}

	function resetForm() {
		editingId = null;
		const form = document.getElementById('category-form');
		form?.reset();
		const order = document.getElementById('category-order');
		if (order) order.value = '0';
		const title = document.getElementById('category-form-title');
		if (title) {
			title.dataset.i18n = 'categoryCreateTitle';
			title.textContent = t('categoryCreateTitle', 'カテゴリーを追加');
		}
		const saveButton = document.getElementById('category-save-button');
		if (saveButton) {
			saveButton.dataset.i18n = 'categoryAdd';
			saveButton.textContent = t('categoryAdd', '追加');
		}
		const cancelButton = document.getElementById('category-cancel-button');
		if (cancelButton) cancelButton.hidden = true;
		clearStatus();
		populateParentSelect();
	}

	function startEditing(categoryId) {
		const category = findCategory(categoryId);
		if (!category) return;
		editingId = category.id;
		clearStatus();

		const nameJa = document.getElementById('category-name-ja');
		const nameKo = document.getElementById('category-name-ko');
		const parent = document.getElementById('category-parent');
		const order = document.getElementById('category-order');
		if (nameJa) nameJa.value = category.names?.ja ?? '';
		if (nameKo) nameKo.value = category.names?.ko ?? '';
		populateParentSelect();
		if (parent) parent.value = category.parentId ? String(category.parentId) : '';
		if (order) order.value = String(category.displayOrder ?? 0);

		const title = document.getElementById('category-form-title');
		if (title) {
			title.dataset.i18n = 'categoryEditTitle';
			title.textContent = t('categoryEditTitle', 'カテゴリーを編集');
		}
		const saveButton = document.getElementById('category-save-button');
		if (saveButton) {
			saveButton.dataset.i18n = 'saveChanges';
			saveButton.textContent = t('saveChanges', '変更を保存');
		}
		const cancelButton = document.getElementById('category-cancel-button');
		if (cancelButton) cancelButton.hidden = false;

		document.getElementById('category-name-ja')?.focus({ preventScroll: false });
	}

	function buildPayload() {
		const nameJa = document.getElementById('category-name-ja')?.value.trim() ?? '';
		const nameKo = document.getElementById('category-name-ko')?.value.trim() ?? '';
		const parentId = document.getElementById('category-parent')?.value ?? '';
		const displayOrder = document.getElementById('category-order')?.value ?? '0';
		return { nameJa, nameKo, parentId: parentId || null, displayOrder: Number(displayOrder) };
	}

	async function saveCategory() {
		if (saving) return;
		const payload = buildPayload();
		if (!payload.nameJa || !payload.nameKo) {
			await showAlert('categoryNamesRequired', '日本語名と韓国語名を入力してください。');
			const targetId = !payload.nameJa ? 'category-name-ja' : 'category-name-ko';
			document.getElementById(targetId)?.focus({ preventScroll: false });
			return;
		}

		setSaving(true);
		clearStatus();
		try {
			const response = await fetch(
				editingId ? `/api/admin/categories/detail?id=${encodeURIComponent(String(editingId))}` : '/api/admin/categories',
				{
					method: editingId ? 'PATCH' : 'POST',
					credentials: 'same-origin',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				},
			);

			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}

			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) {
				console.error('Category save failed', result);
				if (result?.error === 'CATEGORY_CYCLE' || result?.error === 'CATEGORY_PARENT_SELF') {
					await showAlert('categoryCycleError', '自分自身または下位カテゴリーは上位カテゴリーに指定できません。');
					return;
				}
				setStatus('categorySaveFailed', 'error');
				return;
			}

			const successKey = editingId ? 'categoryUpdated' : 'categoryCreated';
			await loadCategories();
			resetForm();
			setStatus(successKey, 'success');
		} catch (error) {
			console.error('Category save failed', error);
			setStatus('categorySaveFailed', 'error');
		} finally {
			setSaving(false);
		}
	}

	async function deleteCategory(categoryId) {
		if (saving) return;
		const category = findCategory(categoryId);
		if (!category || !(await showDeleteConfirm(category))) return;

		setSaving(true);
		clearStatus();
		try {
			const response = await fetch(`/api/admin/categories/detail?id=${encodeURIComponent(String(categoryId))}`, {
				method: 'DELETE',
				credentials: 'same-origin',
			});

			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}

			const result = await response.json().catch(() => null);
			if (response.status === 409 && result?.error === 'CATEGORY_HAS_CHILDREN') {
				await showAlert('categoryDeleteChildBlocked', '下位カテゴリーがあるため削除できません。先に下位カテゴリーを整理してください。');
				return;
			}
			if (!response.ok || !result?.ok) {
				console.error('Category delete failed', result);
				setStatus('categoryDeleteFailed', 'error');
				return;
			}

			if (editingId === categoryId) resetForm();
			await loadCategories();
			setStatus('categoryDeleted', 'success');
		} catch (error) {
			console.error('Category delete failed', error);
			setStatus('categoryDeleteFailed', 'error');
		} finally {
			setSaving(false);
		}
	}

	async function loadCategories() {
		const loading = document.getElementById('category-list-loading');
		const empty = document.getElementById('category-list-empty');
		const tableWrap = document.getElementById('category-table-wrap');
		if (loading) loading.hidden = false;
		if (empty) empty.hidden = true;
		if (tableWrap) tableWrap.hidden = true;

		const response = await fetch('/api/admin/categories', {
			method: 'GET',
			credentials: 'same-origin',
			cache: 'no-store',
		});
		if (response.status === 401) {
			window.location.replace('/admin/login/');
			return;
		}
		const result = await response.json().catch(() => null);
		if (!response.ok || !result?.ok || !Array.isArray(result.categories)) {
			throw new Error('Invalid category list response');
		}
		categories = result.categories;
		renderCategories();
	}

	function refreshLanguage() {
		renderCategories();
		const status = document.getElementById('category-form-status');
		if (status?.dataset.messageKey) status.textContent = t(status.dataset.messageKey, status.textContent);

		const title = document.getElementById('category-form-title');
		if (title) {
			const key = editingId ? 'categoryEditTitle' : 'categoryCreateTitle';
			title.dataset.i18n = key;
			title.textContent = t(key, title.textContent);
		}
		const saveButton = document.getElementById('category-save-button');
		if (saveButton) {
			const key = editingId ? 'saveChanges' : 'categoryAdd';
			saveButton.dataset.i18n = key;
			saveButton.textContent = t(key, saveButton.textContent);
		}
	}

	async function initialize() {
		const session = await window.AdminCommon?.ready;
		if (!session) return;
		await window.AdminI18n?.ready;

		document.getElementById('category-form')?.addEventListener('submit', (event) => {
			event.preventDefault();
			saveCategory();
		});
		document.getElementById('category-new-button')?.addEventListener('click', resetForm);
		document.getElementById('category-cancel-button')?.addEventListener('click', resetForm);
		document.querySelectorAll('#category-form input, #category-form select').forEach((control) => {
			control.addEventListener('input', clearStatus);
			control.addEventListener('change', clearStatus);
		});

		try {
			await loadCategories();
			resetForm();
		} catch (error) {
			console.error('Failed to load categories', error);
			const loading = document.getElementById('category-list-loading');
			if (loading) loading.textContent = t('categoriesLoadFailed', 'カテゴリーを読み込めませんでした。');
		}
	}

	document.addEventListener('adminlanguagechange', refreshLanguage);
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize, { once: true });
	} else {
		initialize();
	}
})();
