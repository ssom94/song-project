(() => {
	let categories = [];
	let editingId = null;
	let saving = false;
	let reordering = false;
	let draggedCategoryId = null;

	function t(key, fallback) {
		const value = window.AdminI18n?.t(key);
		return value && value !== key ? value : fallback;
	}

	function byId(id) {
		return document.getElementById(id);
	}

	function currentLanguage() {
		return window.AdminI18n?.getLanguage?.() ?? 'ja';
	}

	function categoryLabel(category) {
		if (!category) return '';
		return currentLanguage() === 'ko'
			? (category.name_ko ?? category.name_ja ?? '')
			: (category.name_ja ?? category.name_ko ?? '');
	}

	function setStatus(key, type = 'info') {
		const status = byId('learning-category-status');
		if (!status) return;
		status.hidden = false;
		status.dataset.key = key;
		status.dataset.type = type;
		status.textContent = t(key, key);
	}

	function clearStatus() {
		const status = byId('learning-category-status');
		if (!status) return;
		status.hidden = true;
		status.textContent = '';
		delete status.dataset.key;
		delete status.dataset.type;
	}

	function resetForm() {
		editingId = null;
		byId('learning-category-form')?.reset();
		if (byId('learning-category-order')) byId('learning-category-order').value = '0';
		if (byId('learning-category-form-title')) byId('learning-category-form-title').textContent = t('categoryCreateTitle', '学習分類を追加');
		if (byId('learning-category-save')) byId('learning-category-save').textContent = t('categoryAdd', '追加');
		if (byId('learning-category-cancel')) byId('learning-category-cancel').hidden = true;
		clearStatus();
		renderParentOptions();
	}

	function sameParent(left, right) {
		return (left ?? null) === (right ?? null);
	}

	function siblingCategories(parentId) {
		return categories
			.filter((category) => sameParent(category.parent_id, parentId))
			.sort((a, b) => Number(a.display_order) - Number(b.display_order) || Number(a.id) - Number(b.id));
	}

	function flattenCategories() {
		const children = new Map();
		for (const category of categories) {
			const key = category.parent_id ?? null;
			if (!children.has(key)) children.set(key, []);
			children.get(key).push(category);
		}
		for (const group of children.values()) group.sort((a, b) => Number(a.display_order) - Number(b.display_order) || Number(a.id) - Number(b.id));

		const result = [];
		const visit = (parentId, depth) => {
			for (const category of children.get(parentId) ?? []) {
				result.push({ ...category, depth });
				visit(category.id, depth + 1);
			}
		};
		visit(null, 0);
		return result;
	}

	function descendantIds(rootId) {
		const descendants = new Set();
		let changed = true;
		while (changed) {
			changed = false;
			for (const category of categories) {
				if (category.parent_id === rootId || descendants.has(category.parent_id)) {
					if (!descendants.has(category.id)) {
						descendants.add(category.id);
						changed = true;
					}
			}
		}
		return descendants;
	}

	function renderParentOptions() {
		const select = byId('learning-category-parent');
		if (!select) return;
		const current = select.value;
		select.replaceChildren();
		const top = document.createElement('option');
		top.value = '';
		top.textContent = t('categoryTopLevel', '最上位');
		select.appendChild(top);

		const blocked = editingId ? descendantIds(editingId) : new Set();
		if (editingId) blocked.add(editingId);
		for (const category of flattenCategories()) {
			if (blocked.has(category.id)) continue;
			const option = document.createElement('option');
			option.value = String(category.id);
			option.textContent = `${'— '.repeat(category.depth)}${categoryLabel(category)}`;
			select.appendChild(option);
		}
		if ([...select.options].some((option) => option.value === current)) select.value = current;
	}

	function clearDragMarkers() {
		document.querySelectorAll('.admin-learning-category-table tr').forEach((row) => {
			row.classList.remove('is-dragging', 'is-drop-before', 'is-drop-after');
		});
	}

	async function persistReorder(sourceId, targetId, placeAfter) {
		if (reordering) return;
		const source = categories.find((category) => Number(category.id) === Number(sourceId));
		const target = categories.find((category) => Number(category.id) === Number(targetId));
		if (!source || !target || source.id === target.id || !sameParent(source.parent_id, target.parent_id)) return;

		const siblings = siblingCategories(source.parent_id);
		const beforeIds = siblings.map((category) => Number(category.id));
		const orderedIds = beforeIds.filter((id) => id !== Number(source.id));
		let targetIndex = orderedIds.indexOf(Number(target.id));
		if (targetIndex < 0) return;
		if (placeAfter) targetIndex += 1;
		orderedIds.splice(targetIndex, 0, Number(source.id));
		if (orderedIds.every((id, index) => id === beforeIds[index])) return;

		reordering = true;
		clearDragMarkers();
		for (const [index, id] of orderedIds.entries()) {
			const category = categories.find((item) => Number(item.id) === id);
			if (category) category.display_order = index;
		}
		renderTable();

		try {
			const response = await fetch('/api/admin/japanese/categories/reorder', {
				method: 'PATCH',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ parentId: source.parent_id ?? null, orderedIds }),
			});
			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error ?? 'REORDER_FAILED');
			await loadCategories();
			setStatus('categoryReordered', 'success');
		} catch (error) {
			console.error('Failed to reorder Japanese categories', error);
			await loadCategories();
			setStatus('categoryReorderFailed', 'error');
		} finally {
			reordering = false;
			draggedCategoryId = null;
			clearDragMarkers();
		}
	}

	function bindRowDrag(row, handle, category) {
		handle.draggable = true;
		handle.addEventListener('dragstart', (event) => {
			if (reordering) {
				event.preventDefault();
				return;
			}
			draggedCategoryId = Number(category.id);
			row.classList.add('is-dragging');
			if (event.dataTransfer) {
				event.dataTransfer.effectAllowed = 'move';
				event.dataTransfer.setData('text/plain', String(category.id));
			}
		});
		handle.addEventListener('dragend', () => {
			draggedCategoryId = null;
			clearDragMarkers();
		});

		row.addEventListener('dragover', (event) => {
			if (!draggedCategoryId || draggedCategoryId === Number(category.id)) return;
			const source = categories.find((item) => Number(item.id) === draggedCategoryId);
			if (!source || !sameParent(source.parent_id, category.parent_id)) return;
			event.preventDefault();
			if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
			const rect = row.getBoundingClientRect();
			const after = event.clientY > rect.top + (rect.height / 2);
			row.classList.toggle('is-drop-before', !after);
			row.classList.toggle('is-drop-after', after);
		});
		row.addEventListener('dragleave', () => {
			row.classList.remove('is-drop-before', 'is-drop-after');
		});
		row.addEventListener('drop', (event) => {
			if (!draggedCategoryId || draggedCategoryId === Number(category.id)) return;
			const source = categories.find((item) => Number(item.id) === draggedCategoryId);
			if (!source || !sameParent(source.parent_id, category.parent_id)) return;
			event.preventDefault();
			const rect = row.getBoundingClientRect();
			const after = event.clientY > rect.top + (rect.height / 2);
			persistReorder(draggedCategoryId, category.id, after);
		});
	}

	function renderTable() {
		const body = byId('learning-category-table-body');
		const wrap = byId('learning-category-table-wrap');
		const empty = byId('learning-categories-empty');
		const loading = byId('learning-categories-loading');
		const count = byId('learning-category-count');
		if (!body || !wrap || !empty || !loading || !count) return;

		loading.hidden = true;
		count.textContent = String(categories.length);
		body.replaceChildren();
		if (categories.length === 0) {
			wrap.hidden = true;
			empty.hidden = false;
			return;
		}
		empty.hidden = true;
		wrap.hidden = false;

		for (const category of flattenCategories()) {
			const row = document.createElement('tr');
			row.dataset.categoryId = String(category.id);
			row.dataset.parentId = category.parent_id == null ? '' : String(category.parent_id);

			const nameCell = document.createElement('td');
			const name = document.createElement('div');
			name.className = 'admin-learning-category-name';
			name.textContent = `${'　'.repeat(category.depth)}${categoryLabel(category)}`;
			const sub = document.createElement('div');
			sub.className = 'admin-learning-category-subname';
			sub.textContent = currentLanguage() === 'ko' ? category.name_ja : category.name_ko;
			nameCell.append(name, sub);

			const description = document.createElement('td');
			description.className = 'admin-learning-category-description';
			description.textContent = category.description || '—';

			const words = document.createElement('td');
			words.textContent = String(category.word_count ?? 0);

			const order = document.createElement('td');
			const orderWrap = document.createElement('div');
			orderWrap.className = 'admin-learning-category-order-cell';
			const dragHandle = document.createElement('button');
			dragHandle.type = 'button';
			dragHandle.className = 'admin-learning-category-drag-handle';
			dragHandle.textContent = '⋮⋮';
			dragHandle.title = t('categoryDragHandle', currentLanguage() === 'ko' ? '드래그해서 순서 변경' : 'ドラッグして並び替え');
			dragHandle.setAttribute('aria-label', dragHandle.title);
			const orderNumber = document.createElement('span');
			orderNumber.textContent = String(category.display_order ?? 0);
			orderWrap.append(dragHandle, orderNumber);
			order.appendChild(orderWrap);
			bindRowDrag(row, dragHandle, category);

			const actions = document.createElement('td');
			const actionWrap = document.createElement('div');
			actionWrap.className = 'admin-learning-category-row-actions';
			const edit = document.createElement('button');
			edit.type = 'button';
			edit.textContent = t('categoryEdit', '編集');
			edit.addEventListener('click', () => startEdit(category));
			const remove = document.createElement('button');
			remove.type = 'button';
			remove.textContent = t('categoryDelete', '削除');
			remove.addEventListener('click', () => deleteCategory(category));
			actionWrap.append(edit, remove);
			actions.appendChild(actionWrap);
			row.append(nameCell, description, words, order, actions);
			body.appendChild(row);
		}
	}

	function startEdit(category) {
		editingId = category.id;
		byId('learning-category-name-ja').value = category.name_ja ?? '';
		byId('learning-category-name-ko').value = category.name_ko ?? '';
		byId('learning-category-description').value = category.description ?? '';
		byId('learning-category-order').value = String(category.display_order ?? 0);
		renderParentOptions();
		byId('learning-category-parent').value = category.parent_id ? String(category.parent_id) : '';
		byId('learning-category-form-title').textContent = t('categoryEditTitle', '学習分類を編集');
		byId('learning-category-save').textContent = t('categoryUpdate', '変更を保存');
		byId('learning-category-cancel').hidden = false;
		clearStatus();
		byId('learning-category-name-ja')?.focus();
	}

	async function loadCategories() {
		try {
			const response = await fetch('/api/admin/japanese/categories', { credentials: 'same-origin', cache: 'no-store' });
			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok || !Array.isArray(result.categories)) throw new Error('Invalid category response');
			categories = result.categories;
			renderParentOptions();
			renderTable();
		} catch (error) {
			console.error('Failed to load Japanese categories', error);
			byId('learning-categories-loading').textContent = t('categoriesLoadFailed', '読み込みに失敗しました。');
		}
	}

	async function saveCategory(event) {
		event.preventDefault();
		if (saving) return;
		const nameJa = byId('learning-category-name-ja')?.value.trim() ?? '';
		const nameKo = byId('learning-category-name-ko')?.value.trim() ?? '';
		if (!nameJa || !nameKo) {
			setStatus('categoryRequired', 'error');
			return;
		}

		saving = true;
		const save = byId('learning-category-save');
		if (save) save.disabled = true;
		try {
			const url = editingId ? `/api/admin/japanese/categories/detail?id=${encodeURIComponent(editingId)}` : '/api/admin/japanese/categories';
			const response = await fetch(url, {
				method: editingId ? 'PATCH' : 'POST',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					nameJa,
					nameKo,
					description: byId('learning-category-description')?.value ?? '',
					parentId: byId('learning-category-parent')?.value || null,
					displayOrder: Number(byId('learning-category-order')?.value || 0),
				}),
			});
			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error ?? 'SAVE_FAILED');
			const message = editingId ? 'categoryUpdated' : 'categorySaved';
			resetForm();
			setStatus(message, 'success');
			await loadCategories();
		} catch (error) {
			console.error('Failed to save Japanese category', error);
			setStatus('categorySaveFailed', 'error');
		} finally {
			saving = false;
			if (save) save.disabled = false;
		}
	}

	async function deleteCategory(category) {
		const confirmed = await window.AdminCommon?.confirm?.({
			titleKey: 'categoryDeleteTitle',
			messageKey: 'categoryDeleteMessage',
			confirmKey: 'categoryDeleteConfirm',
			cancelKey: 'confirmNo',
			titleFallback: t('categoryDeleteTitle', '学習分類を削除'),
			messageFallback: t('categoryDeleteMessage', 'この学習分類を削除しますか？'),
			confirmFallback: t('categoryDeleteConfirm', '削除'),
			cancelFallback: t('confirmNo', 'いいえ'),
		});
		if (!confirmed) return;

		try {
			const response = await fetch(`/api/admin/japanese/categories/detail?id=${encodeURIComponent(category.id)}`, {
				method: 'DELETE',
				credentials: 'same-origin',
			});
			const result = await response.json().catch(() => null);
			if (response.status === 409 && result?.error === 'JAPANESE_CATEGORY_HAS_CHILDREN') {
				setStatus('categoryHasChildren', 'error');
				return;
			}
			if (response.status === 409 && result?.error === 'JAPANESE_CATEGORY_IN_USE') {
				setStatus('categoryInUse', 'error');
				return;
			}
			if (!response.ok || !result?.ok) throw new Error(result?.error ?? 'DELETE_FAILED');
			if (editingId === category.id) resetForm();
			setStatus('categoryDeleted', 'success');
			await loadCategories();
		} catch (error) {
			console.error('Failed to delete Japanese category', error);
			setStatus('categoryDeleteFailed', 'error');
		}
	}

	async function initialize() {
		await window.AdminCommon?.ready;
		byId('learning-category-form')?.addEventListener('submit', saveCategory);
		byId('learning-category-new')?.addEventListener('click', resetForm);
		byId('learning-category-cancel')?.addEventListener('click', resetForm);
		document.addEventListener('adminlanguagechange', () => {
			renderParentOptions();
			renderTable();
			if (editingId) {
				byId('learning-category-form-title').textContent = t('categoryEditTitle', '学習分類を編集');
				byId('learning-category-save').textContent = t('categoryUpdate', '変更を保存');
			}
			const status = byId('learning-category-status');
			if (status?.dataset.key) status.textContent = t(status.dataset.key, status.dataset.key);
		});
		await loadCategories();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
