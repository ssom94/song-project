(() => {
	let tags = [];
	let editingId = null;
	let saving = false;

	function t(key, fallback) {
		const value = window.AdminI18n?.t(key);
		return value && value !== key ? value : fallback;
	}

	function currentLanguage() {
		return window.AdminI18n?.getLanguage?.() ?? 'ja';
	}

	function tagName(tag, language = currentLanguage()) {
		return tag?.names?.[language]
			|| tag?.names?.ja
			|| tag?.names?.ko
			|| `#${tag?.id ?? ''}`;
	}

	function findTag(id) {
		return tags.find((tag) => tag.id === Number(id)) ?? null;
	}

	function setStatus(key, type = 'success') {
		const element = document.getElementById('tag-form-status');
		if (!element) return;
		element.dataset.messageKey = key;
		element.dataset.type = type;
		element.textContent = t(key, key);
		element.hidden = false;
	}

	function clearStatus() {
		const element = document.getElementById('tag-form-status');
		if (!element) return;
		element.hidden = true;
		delete element.dataset.messageKey;
		delete element.dataset.type;
		element.textContent = '';
	}

	function setSaving(value) {
		saving = value;
		for (const id of ['tag-save-button', 'tag-new-button', 'tag-cancel-button']) {
			const element = document.getElementById(id);
			if (element) element.disabled = value;
		}
		document.querySelectorAll('.admin-tag-action').forEach((button) => {
			button.disabled = value;
		});
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

	async function showDeleteConfirm(tag) {
		const message = t('tagDeleteConfirmMessage', 'このタグを削除しますか？');
		if (!window.AdminCommon?.confirm) return window.confirm(message);

		return window.AdminCommon.confirm({
			titleKey: 'tagDeleteConfirmTitle',
			messageKey: 'tagDeleteConfirmMessage',
			confirmKey: 'tagDelete',
			cancelKey: 'confirmNo',
			titleFallback: 'タグを削除',
			messageFallback: `${tagName(tag)} を削除しますか？`,
			confirmFallback: '削除',
			cancelFallback: 'いいえ',
		});
	}

	function renderTags() {
		const loading = document.getElementById('tag-list-loading');
		const empty = document.getElementById('tag-list-empty');
		const tableWrap = document.getElementById('tag-table-wrap');
		const tbody = document.getElementById('tag-table-body');
		const count = document.getElementById('tag-count');
		if (!loading || !empty || !tableWrap || !tbody || !count) return;

		loading.hidden = true;
		count.textContent = String(tags.length);
		tbody.replaceChildren();

		if (tags.length === 0) {
			empty.hidden = false;
			tableWrap.hidden = true;
			return;
		}

		empty.hidden = true;
		tableWrap.hidden = false;

		const sorted = [...tags].sort((a, b) => tagName(a).localeCompare(tagName(b), currentLanguage() === 'ko' ? 'ko' : 'ja'));
		for (const tag of sorted) {
			const row = document.createElement('tr');

			const nameCell = document.createElement('td');
			const name = document.createElement('span');
			name.className = 'admin-tag-primary-name';
			name.textContent = tagName(tag);
			nameCell.appendChild(name);

			const jaCell = document.createElement('td');
			jaCell.textContent = tag.names?.ja ?? '—';

			const koCell = document.createElement('td');
			koCell.textContent = tag.names?.ko ?? '—';

			const actionCell = document.createElement('td');
			const actions = document.createElement('div');
			actions.className = 'admin-tag-actions';

			const editButton = document.createElement('button');
			editButton.className = 'admin-tag-action';
			editButton.type = 'button';
			editButton.textContent = t('editPost', '編集');
			editButton.addEventListener('click', () => startEditing(tag.id));

			const deleteButton = document.createElement('button');
			deleteButton.className = 'admin-tag-action admin-tag-action-danger';
			deleteButton.type = 'button';
			deleteButton.textContent = t('tagDelete', '削除');
			deleteButton.addEventListener('click', () => deleteTag(tag.id));

			actions.append(editButton, deleteButton);
			actionCell.appendChild(actions);
			row.append(nameCell, jaCell, koCell, actionCell);
			tbody.appendChild(row);
		}
	}

	function resetForm() {
		editingId = null;
		document.getElementById('tag-form')?.reset();
		const title = document.getElementById('tag-form-title');
		if (title) {
			title.dataset.i18n = 'tagCreateTitle';
			title.textContent = t('tagCreateTitle', 'タグを追加');
		}
		const saveButton = document.getElementById('tag-save-button');
		if (saveButton) {
			saveButton.dataset.i18n = 'tagAdd';
			saveButton.textContent = t('tagAdd', '追加');
		}
		const cancelButton = document.getElementById('tag-cancel-button');
		if (cancelButton) cancelButton.hidden = true;
		clearStatus();
	}

	function startEditing(tagId) {
		const tag = findTag(tagId);
		if (!tag) return;
		editingId = tag.id;
		clearStatus();

		const nameJa = document.getElementById('tag-name-ja');
		const nameKo = document.getElementById('tag-name-ko');
		if (nameJa) nameJa.value = tag.names?.ja ?? '';
		if (nameKo) nameKo.value = tag.names?.ko ?? '';

		const title = document.getElementById('tag-form-title');
		if (title) {
			title.dataset.i18n = 'tagEditTitle';
			title.textContent = t('tagEditTitle', 'タグを編集');
		}
		const saveButton = document.getElementById('tag-save-button');
		if (saveButton) {
			saveButton.dataset.i18n = 'saveChanges';
			saveButton.textContent = t('saveChanges', '変更を保存');
		}
		const cancelButton = document.getElementById('tag-cancel-button');
		if (cancelButton) cancelButton.hidden = false;

		document.getElementById('tag-name-ja')?.focus({ preventScroll: false });
	}

	function buildPayload() {
		return {
			nameJa: document.getElementById('tag-name-ja')?.value.trim() ?? '',
			nameKo: document.getElementById('tag-name-ko')?.value.trim() ?? '',
		};
	}

	async function saveTag() {
		if (saving) return;
		const payload = buildPayload();
		if (!payload.nameJa || !payload.nameKo) {
			await showAlert('tagNamesRequired', '日本語名と韓国語名を入力してください。');
			document.getElementById(!payload.nameJa ? 'tag-name-ja' : 'tag-name-ko')?.focus({ preventScroll: false });
			return;
		}

		setSaving(true);
		clearStatus();
		try {
			const response = await fetch(
				editingId ? `/api/admin/tags/detail?id=${encodeURIComponent(String(editingId))}` : '/api/admin/tags',
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
				console.error('Tag save failed', result);
				setStatus('tagSaveFailed', 'error');
				return;
			}

			const successKey = editingId ? 'tagUpdated' : 'tagCreated';
			await loadTags();
			resetForm();
			setStatus(successKey, 'success');
		} catch (error) {
			console.error('Tag save failed', error);
			setStatus('tagSaveFailed', 'error');
		} finally {
			setSaving(false);
		}
	}

	async function deleteTag(tagId) {
		if (saving) return;
		const tag = findTag(tagId);
		if (!tag || !(await showDeleteConfirm(tag))) return;

		setSaving(true);
		clearStatus();
		try {
			const response = await fetch(`/api/admin/tags/detail?id=${encodeURIComponent(String(tagId))}`, {
				method: 'DELETE',
				credentials: 'same-origin',
			});

			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}

			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) {
				console.error('Tag delete failed', result);
				setStatus('tagDeleteFailed', 'error');
				return;
			}

			if (editingId === tagId) resetForm();
			await loadTags();
			setStatus('tagDeleted', 'success');
		} catch (error) {
			console.error('Tag delete failed', error);
			setStatus('tagDeleteFailed', 'error');
		} finally {
			setSaving(false);
		}
	}

	async function loadTags() {
		const loading = document.getElementById('tag-list-loading');
		const empty = document.getElementById('tag-list-empty');
		const tableWrap = document.getElementById('tag-table-wrap');
		if (loading) loading.hidden = false;
		if (empty) empty.hidden = true;
		if (tableWrap) tableWrap.hidden = true;

		try {
			const response = await fetch('/api/admin/tags', {
				method: 'GET',
				credentials: 'same-origin',
				cache: 'no-store',
			});
			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok || !Array.isArray(result.tags)) throw new Error('Invalid tag list response');
			tags = result.tags;
			renderTags();
		} catch (error) {
			console.error('Failed to load tags', error);
			tags = [];
			if (loading) {
				loading.hidden = false;
				loading.textContent = t('tagsLoadFailed', 'タグを読み込めませんでした。');
			}
		}
	}

	function refreshDynamicText() {
		const status = document.getElementById('tag-form-status');
		if (status?.dataset.messageKey) status.textContent = t(status.dataset.messageKey, status.textContent);
		if (editingId) startEditing(editingId);
		else resetForm();
		renderTags();
	}

	async function initialize() {
		const session = await window.AdminCommon?.ready;
		if (!session) return;
		await window.AdminI18n?.ready;

		document.getElementById('tag-form')?.addEventListener('submit', (event) => {
			event.preventDefault();
			saveTag();
		});
		document.getElementById('tag-new-button')?.addEventListener('click', resetForm);
		document.getElementById('tag-cancel-button')?.addEventListener('click', resetForm);
		document.getElementById('tag-name-ja')?.addEventListener('input', clearStatus);
		document.getElementById('tag-name-ko')?.addEventListener('input', clearStatus);
		document.addEventListener('adminlanguagechange', refreshDynamicText);

		await loadTags();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize, { once: true });
	} else {
		initialize();
	}
})();
