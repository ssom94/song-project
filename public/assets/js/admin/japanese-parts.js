(() => {
	let parts = [];
	let editingId = null;
	let saving = false;

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

	function displayName(part) {
		return currentLanguage() === 'ko' ? (part.name_ko || part.name_ja || '') : (part.name_ja || part.name_ko || '');
	}

	function setStatus(key, type = 'info') {
		const status = byId('parts-status');
		if (!status) return;
		status.hidden = false;
		status.dataset.key = key;
		status.dataset.type = type;
		status.textContent = t(key, key);
	}

	function clearStatus() {
		const status = byId('parts-status');
		if (!status) return;
		status.hidden = true;
		delete status.dataset.key;
		delete status.dataset.type;
		status.textContent = '';
	}

	function childMap() {
		const map = new Map();
		for (const part of parts) {
			const key = part.parent_id ?? null;
			if (!map.has(key)) map.set(key, []);
			map.get(key).push(part);
		}
		for (const children of map.values()) {
			children.sort((a, b) => (a.display_order - b.display_order) || (a.id - b.id));
		}
		return map;
	}

	function flattenParts() {
		const map = childMap();
		const result = [];
		const visit = (parentId, depth) => {
			for (const part of map.get(parentId) ?? []) {
				result.push({ part, depth });
				visit(part.id, depth + 1);
			}
		};
		visit(null, 0);
		return result;
	}

	function fillParentOptions() {
		const select = byId('parts-parent');
		if (!select) return;
		const value = select.value;
		select.replaceChildren();
		const root = document.createElement('option');
		root.value = '';
		root.textContent = t('partsTopLevel', currentLanguage() === 'ko' ? '최상위' : '最上位');
		select.appendChild(root);
		for (const { part, depth } of flattenParts()) {
			if (part.id === editingId) continue;
			const option = document.createElement('option');
			option.value = String(part.id);
			option.textContent = `${'— '.repeat(depth)}${displayName(part)}`;
			select.appendChild(option);
		}
		if ([...select.options].some((option) => option.value === value)) select.value = value;
	}

	function setForm(part = null) {
		editingId = part?.id ?? null;
		byId('parts-name-ja').value = part?.name_ja ?? '';
		byId('parts-name-ko').value = part?.name_ko ?? '';
		byId('parts-order').value = String(part?.display_order ?? 0);
		fillParentOptions();
		byId('parts-parent').value = part?.parent_id ? String(part.parent_id) : '';

		const title = byId('parts-form-title');
		const save = byId('parts-save');
		const cancel = byId('parts-cancel');
		if (title) {
			title.dataset.i18n = editingId ? 'partsEditTitle' : 'partsCreateTitle';
			title.textContent = t(title.dataset.i18n, editingId ? '品詞を編集' : '品詞を追加');
		}
		if (save) {
			save.dataset.i18n = editingId ? 'partsUpdate' : 'partsAdd';
			save.textContent = t(save.dataset.i18n, editingId ? '変更を保存' : '追加');
		}
		if (cancel) cancel.hidden = !editingId;
		clearStatus();
	}

	function renderTable() {
		const tbody = byId('parts-table-body');
		const wrap = byId('parts-table-wrap');
		const empty = byId('parts-empty');
		const count = byId('parts-count');
		if (!tbody || !wrap || !empty || !count) return;
		count.textContent = String(parts.length);
		tbody.replaceChildren();
		if (parts.length === 0) {
			wrap.hidden = true;
			empty.hidden = false;
			return;
		}
		empty.hidden = true;

		for (const { part, depth } of flattenParts()) {
			const tr = document.createElement('tr');
			const nameCell = document.createElement('td');
			nameCell.className = 'admin-parts-name';
			nameCell.textContent = `${'— '.repeat(depth)}${displayName(part)}`;

			const ja = document.createElement('td');
			ja.textContent = part.name_ja || '—';
			const ko = document.createElement('td');
			ko.textContent = part.name_ko || '—';
			const words = document.createElement('td');
			words.textContent = String(part.word_count ?? 0);
			const order = document.createElement('td');
			order.textContent = String(part.display_order ?? 0);

			const actionCell = document.createElement('td');
			const actions = document.createElement('div');
			actions.className = 'admin-parts-row-actions';
			const edit = document.createElement('button');
			edit.type = 'button';
			edit.className = 'admin-parts-action';
			edit.textContent = t('partsEdit', currentLanguage() === 'ko' ? '수정' : '編集');
			edit.addEventListener('click', () => {
				setForm(part);
				byId('parts-name-ja')?.focus();
				window.scrollTo({ top: 0, behavior: 'smooth' });
			});
			const remove = document.createElement('button');
			remove.type = 'button';
			remove.className = 'admin-parts-action admin-parts-action-danger';
			remove.textContent = t('partsDelete', currentLanguage() === 'ko' ? '삭제' : '削除');
			remove.addEventListener('click', () => deletePart(part));
			actions.append(edit, remove);
			actionCell.appendChild(actions);
			tr.append(nameCell, ja, ko, words, order, actionCell);
			tbody.appendChild(tr);
		}
		wrap.hidden = false;
	}

	async function loadParts() {
		const loading = byId('parts-loading');
		try {
			const response = await fetch('/api/admin/japanese/parts', { credentials: 'same-origin', cache: 'no-store' });
			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok || !Array.isArray(result.parts)) throw new Error('Invalid parts response');
			parts = result.parts;
			fillParentOptions();
			renderTable();
		} catch (error) {
			console.error('Failed to load parts of speech', error);
			parts = [];
			renderTable();
		} finally {
			if (loading) loading.hidden = true;
		}
	}

	async function savePart(event) {
		event.preventDefault();
		if (saving) return;
		const nameJa = byId('parts-name-ja')?.value.trim() ?? '';
		const nameKo = byId('parts-name-ko')?.value.trim() ?? '';
		if (!nameJa || !nameKo) {
			setStatus('partsRequired', 'error');
			(!nameJa ? byId('parts-name-ja') : byId('parts-name-ko'))?.focus();
			return;
		}

		const payload = {
			nameJa,
			nameKo,
			parentId: byId('parts-parent')?.value || null,
			displayOrder: Number(byId('parts-order')?.value || 0),
		};
		saving = true;
		const save = byId('parts-save');
		if (save) save.disabled = true;
		try {
			const url = editingId ? `/api/admin/japanese/parts/detail?id=${encodeURIComponent(editingId)}` : '/api/admin/japanese/parts';
			const response = await fetch(url, {
				method: editingId ? 'PATCH' : 'POST',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error ?? 'SAVE_FAILED');
			const wasEditing = Boolean(editingId);
			setForm();
			await loadParts();
			setStatus(wasEditing ? 'partsUpdated' : 'partsSaved', 'success');
		} catch (error) {
			console.error('Failed to save part of speech', error);
			setStatus('partsSaveFailed', 'error');
		} finally {
			saving = false;
			if (save) save.disabled = false;
		}
	}

	async function deletePart(part) {
		const confirmed = window.AdminCommon?.confirm
			? await window.AdminCommon.confirm({
				titleKey: 'partsDeleteTitle',
				messageKey: 'partsDeleteMessage',
				confirmKey: 'partsDeleteConfirm',
				cancelKey: 'confirmNo',
				titleFallback: currentLanguage() === 'ko' ? '품사 삭제' : '品詞を削除',
				messageFallback: currentLanguage() === 'ko' ? '이 품사를 삭제하시겠습니까?' : 'この品詞を削除しますか？',
				confirmFallback: currentLanguage() === 'ko' ? '삭제' : '削除',
				cancelFallback: currentLanguage() === 'ko' ? '아니오' : 'いいえ',
			})
			: window.confirm(currentLanguage() === 'ko' ? '이 품사를 삭제하시겠습니까?' : 'この品詞を削除しますか？');
		if (!confirmed) return;

		try {
			const response = await fetch(`/api/admin/japanese/parts/detail?id=${encodeURIComponent(part.id)}`, {
				method: 'DELETE',
				credentials: 'same-origin',
			});
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) {
				if (result?.error === 'PART_HAS_CHILDREN') setStatus('partsHasChildren', 'error');
				else if (result?.error === 'PART_IN_USE') setStatus('partsInUse', 'error');
				else setStatus('partsDeleteFailed', 'error');
				return;
			}
			if (editingId === part.id) setForm();
			await loadParts();
			setStatus('partsDeleted', 'success');
		} catch (error) {
			console.error('Failed to delete part of speech', error);
			setStatus('partsDeleteFailed', 'error');
		}
	}

	async function initialize() {
		await Promise.all([window.AdminCommon?.ready, window.AdminI18n?.ready]);
		byId('parts-form')?.addEventListener('submit', savePart);
		byId('parts-new')?.addEventListener('click', () => setForm());
		byId('parts-cancel')?.addEventListener('click', () => setForm());
		document.addEventListener('adminlanguagechange', () => {
			fillParentOptions();
			renderTable();
			const status = byId('parts-status');
			if (status?.dataset.key) status.textContent = t(status.dataset.key, status.dataset.key);
			const current = editingId ? parts.find((part) => part.id === editingId) : null;
			setForm(current);
		});
		await loadParts();
		setForm();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
