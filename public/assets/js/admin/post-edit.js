(() => {
	function t(key, fallback) {
		const value = window.AdminI18n?.t(key);
		return value && value !== key ? value : fallback;
	}

	async function showLoadError(titleKey, messageKey, titleFallback, messageFallback) {
		if (window.AdminCommon?.alert) {
			await window.AdminCommon.alert({
				titleKey,
				messageKey,
				titleFallback,
				messageFallback,
			});
		} else {
			window.alert(messageFallback);
		}
	}

	async function loadPost() {
		const params = new URLSearchParams(window.location.search);
		const postId = Number(params.get('id'));
		if (!Number.isSafeInteger(postId) || postId <= 0) {
			await showLoadError(
				'postNotFoundTitle',
				'postNotFoundMessage',
				'投稿が見つかりません',
				'指定された投稿を確認できませんでした。',
			);
			window.location.replace('/admin/posts/');
			return;
		}

		const form = document.getElementById('post-editor-form');
		form?.setAttribute('aria-busy', 'true');
		window.AdminPostEditor?.setMessage('postEditLoading', 'info');

		try {
			const response = await fetch(`/api/admin/posts/detail?id=${encodeURIComponent(String(postId))}`, {
				method: 'GET',
				credentials: 'same-origin',
				cache: 'no-store',
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
			window.AdminPostEditor?.setMessage('postEditSavePending', 'info');
		} catch (error) {
			console.error('Failed to load post for editing', error);
			await showLoadError(
				'postLoadFailedTitle',
				'postLoadFailedMessage',
				'投稿を読み込めませんでした',
				'しばらくしてからもう一度お試しください。',
			);
			window.location.replace('/admin/posts/');
		} finally {
			form?.removeAttribute('aria-busy');
		}
	}

	async function initialize() {
		const session = await window.AdminCommon?.ready;
		if (!session) return;
		await window.AdminI18n?.ready;
		const editorReady = await window.AdminPostEditor?.ready;
		if (!editorReady) return;
		await loadPost();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize, { once: true });
	} else {
		initialize();
	}
})();
