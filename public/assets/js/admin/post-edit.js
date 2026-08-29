(() => {
	let postId = null;
	let saving = false;
	let actionsBound = false;
	let editing = false;
	let baselinePayload = '';

	function t(key, fallback) {
		const value = window.AdminI18n?.t(key);
		return value && value !== key ? value : fallback;
	}

	function getForm() {
		return document.getElementById('post-editor-form');
	}

	function getSaveButton() {
		return document.querySelector('button[data-editor-action="primary"], button[data-i18n="savePost"], button[data-i18n="editPost"], button[data-i18n="saveChanges"]');
	}

	function serializePayload() {
		const payload = window.AdminPostEditor?.buildPayload?.(false);
		return payload ? JSON.stringify(payload) : '';
	}

	function hasChanges() {
		return editing && baselinePayload !== '' && serializePayload() !== baselinePayload;
	}

	function setHeading(viewMode) {
		const title = document.getElementById('post-page-title');
		const description = document.getElementById('post-page-description');
		if (title) {
			title.dataset.i18n = viewMode ? 'postViewTitle' : 'postEditTitle';
			title.textContent = t(viewMode ? 'postViewTitle' : 'postEditTitle', viewMode ? '投稿を見る' : '投稿を編集');
		}
		if (description) {
			description.dataset.i18n = viewMode ? 'postViewDescription' : 'postEditDescription';
			description.textContent = t(
				viewMode ? 'postViewDescription' : 'postEditDescription',
				viewMode ? '保存済みの投稿内容を確認します。' : '保存済みの原文と翻訳内容を確認・編集します。',
			);
		}
	}

	function setFormEditable(enabled) {
		const form = getForm();
		if (!form) return;

		form.querySelectorAll('input, textarea, select').forEach((control) => {
			if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement)) return;

			if (control.id === 'source-language') {
				control.disabled = true;
				return;
			}

			if (control instanceof HTMLSelectElement || (control instanceof HTMLInputElement && (control.type === 'radio' || control.type === 'checkbox'))) {
				control.disabled = !enabled;
				return;
			}

			control.readOnly = !enabled;
		});

		document.body.classList.toggle('admin-post-view-mode', !enabled);
		document.body.classList.toggle('admin-post-edit-mode-active', enabled);
	}

	function setPrimaryButtonState() {
		const button = getSaveButton();
		if (!button) return;
		button.dataset.editorAction = 'primary';

		if (!editing) {
			button.type = 'button';
			button.disabled = false;
			button.dataset.i18n = 'editPost';
			button.textContent = t('editPost', '編集');
			button.classList.add('admin-editor-button-primary');
			button.classList.remove('admin-editor-button-danger');
			return;
		}

		const dirty = hasChanges();
		button.type = 'submit';
		button.disabled = saving || !dirty;
		button.dataset.i18n = 'saveChanges';
		button.textContent = t('saveChanges', '変更を保存');
		button.classList.remove('admin-editor-button-primary');
		button.classList.toggle('admin-editor-button-danger', dirty && !saving);
	}

	function setEditorNote() {
		const note = document.querySelector('.admin-editor-api-note');
		if (!note) return;
		const key = editing ? 'postEditModeNote' : 'postViewModeNote';
		note.dataset.i18n = key;
		note.textContent = t(
			key,
			editing
				? '内容を変更すると「変更を保存」ボタンが有効になります。'
				: '閲覧モードです。「編集」を押すと内容を変更できます。',
		);
	}

	function setViewMode() {
		editing = false;
		setFormEditable(false);
		setHeading(true);
		setEditorNote();

		const draftButton = document.querySelector('button[data-i18n="draftSave"]');
		if (draftButton) draftButton.hidden = true;
		setPrimaryButtonState();
	}

	function enterEditMode() {
		if (saving) return;
		editing = true;
		setFormEditable(true);
		setHeading(false);
		setEditorNote();
		window.AdminPostEditor?.clearError?.();
		setPrimaryButtonState();

		requestAnimationFrame(() => {
			document.getElementById('post-title')?.focus({ preventScroll: true });
		});
	}

	function refreshDirtyState() {
		if (!editing) return;
		window.AdminPostEditor?.clearError?.();
		setPrimaryButtonState();
	}

	async function showLoadError(titleKey, messageKey, titleFallback, messageFallback) {
		if (window.AdminCommon?.alert) {
			await window.AdminCommon.alert({ titleKey, messageKey, titleFallback, messageFallback });
		} else {
			window.alert(messageFallback);
		}
	}

	async function showReturnConfirm() {
		if (!window.AdminCommon?.confirm) return false;
		return window.AdminCommon.confirm({
			titleKey: 'postUpdateReturnConfirmTitle',
			messageKey: 'postUpdateReturnConfirmMessage',
			confirmKey: 'confirmYes',
			cancelKey: 'confirmNo',
			titleFallback: '更新完了',
			messageFallback: '変更内容を保存しました。投稿一覧に戻りますか？',
			confirmFallback: 'はい',
			cancelFallback: 'いいえ',
		});
	}

	async function updatePost() {
		if (saving || !postId || !editing || !hasChanges()) return;
		if (!(await window.AdminPostEditor?.validate?.())) return;

		const payload = window.AdminPostEditor?.buildPayload?.(false);
		if (!payload) return;

		saving = true;
		setPrimaryButtonState();
		window.AdminPostEditor?.setMessage?.('savingPost', 'info');

		try {
			const response = await fetch(`/api/admin/posts/detail?id=${encodeURIComponent(String(postId))}`, {
				method: 'PATCH',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}

			const result = await response.json().catch(() => null);
			if (response.status === 404 || result?.error === 'POST_NOT_FOUND') {
				await showLoadError(
					'postNotFoundTitle',
					'postNotFoundMessage',
					'投稿が見つかりません',
					'指定された投稿は存在しないか、削除されています。',
				);
				window.location.replace('/admin/posts/');
				return;
			}

			if (!response.ok || !result?.ok) {
				console.error('Post update failed', result);
				window.AdminPostEditor?.setMessage?.('postUpdateFailed', 'error');
				return;
			}

			baselinePayload = serializePayload();
			window.AdminPostEditor?.setMessage?.('postUpdated', 'success');
			if (await showReturnConfirm()) {
				window.location.assign('/admin/posts/');
				return;
			}

			setViewMode();
		} catch (error) {
			console.error('Post update failed', error);
			window.AdminPostEditor?.setMessage?.('postUpdateFailed', 'error');
		} finally {
			saving = false;
			setPrimaryButtonState();
		}
	}

	function bindEditActions() {
		if (actionsBound) return;
		actionsBound = true;

		const form = getForm();
		const saveButton = getSaveButton();

		form?.addEventListener('input', refreshDirtyState);
		form?.addEventListener('change', refreshDirtyState);
		form?.addEventListener('submit', (event) => {
			event.preventDefault();
			updatePost();
		});
		saveButton?.addEventListener('click', (event) => {
			if (!editing) {
				event.preventDefault();
				enterEditMode();
			}
		});
	}

	async function loadPost() {
		const params = new URLSearchParams(window.location.search);
		postId = Number(params.get('id'));
		if (!Number.isSafeInteger(postId) || postId <= 0) {
			await showLoadError(
				'postNotFoundTitle',
				'postNotFoundMessage',
				'投稿が見つかりません',
				'指定された投稿を確認できませんでした。',
			);
			window.location.replace('/admin/posts/');
			return false;
		}

		const form = getForm();
		form?.setAttribute('aria-busy', 'true');
		window.AdminPostEditor?.setMessage?.('postEditLoading', 'info');

		try {
			const response = await fetch(`/api/admin/posts/detail?id=${encodeURIComponent(String(postId))}`, {
				method: 'GET',
				credentials: 'same-origin',
				cache: 'no-store',
			});

			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return false;
			}

			const result = await response.json().catch(() => null);
			if (response.status === 404 || result?.error === 'POST_NOT_FOUND') {
				await showLoadError(
					'postNotFoundTitle',
					'postNotFoundMessage',
					'投稿が見つかりません',
					'指定された投稿は存在しないか、削除されています。',
				);
				window.location.replace('/admin/posts/');
				return false;
			}

			if (!response.ok || !result?.ok || !result.post) {
				throw new Error('Invalid post detail response');
			}

			if (!window.AdminPostEditor?.loadPostData(result.post)) {
				throw new Error('Post does not have an original translation');
			}

			const source = result.post.translations.find(
				(translation) => translation.languageCode === result.post.originalLanguage,
			);
			if (source?.title) document.title = `${source.title} | SONG Admin`;

			baselinePayload = serializePayload();
			bindEditActions();
			setViewMode();
			return true;
		} catch (error) {
			console.error('Failed to load post for viewing', error);
			await showLoadError(
				'postLoadFailedTitle',
				'postLoadFailedMessage',
				'投稿を読み込めませんでした',
				'しばらくしてからもう一度お試しください。',
			);
			window.location.replace('/admin/posts/');
			return false;
		} finally {
			form?.removeAttribute('aria-busy');
		}
	}

	async function initialize() {
		const session = await window.AdminCommon?.ready;
		if (!session) return;
		await window.AdminI18n?.ready;
		await window.AdminPostCategories?.ready;
		const editorReady = await window.AdminPostEditor?.ready;
		if (!editorReady) return;
		await loadPost();
	}

	document.addEventListener('adminlanguagechange', () => {
		setHeading(!editing);
		setEditorNote();
		setPrimaryButtonState();
	});

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize, { once: true });
	} else {
		initialize();
	}
})();
