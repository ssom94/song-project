(() => {
	let previewButton = null;
	let editorReady = false;
	let postDataReady = document.body.dataset.editorMode !== 'edit';

	function t(key, fallback) {
		const value = window.AdminI18n?.t(key);
		return value && value !== key ? value : fallback;
	}

	function oppositeLanguage(language) {
		return language === 'ja' ? 'ko' : language === 'ko' ? 'ja' : null;
	}

	function localizedName(item, language) {
		return item?.names?.[language]
			?? item?.names?.ja
			?? item?.names?.ko
			?? '';
	}

	function buildPreviewSnapshot() {
		const payload = window.AdminPostEditor?.buildPayload?.(false);
		if (!payload) return null;

		const sourceLanguage = window.AdminPostEditor?.getEffectiveSourceLanguage?.()
			?? (payload.sourceLanguage === 'ja' || payload.sourceLanguage === 'ko' ? payload.sourceLanguage : null);
		if (!sourceLanguage) return null;

		const targetLanguage = oppositeLanguage(sourceLanguage);
		const categoryId = payload.categoryId ? Number(payload.categoryId) : null;
		const categories = window.AdminPostCategories?.getAll?.() ?? [];
		const tags = window.AdminPostCategories?.getAllTags?.() ?? [];
		const selectedTagIds = new Set(window.AdminPostCategories?.getSelectedTagIds?.() ?? []);
		const category = categoryId ? categories.find((item) => item.id === categoryId) : null;
		const selectedTags = tags.filter((item) => selectedTagIds.has(item.id));

		const translations = {
			[sourceLanguage]: {
				title: payload.title ?? '',
				content: payload.content ?? '',
				category: category ? localizedName(category, sourceLanguage) : '',
				tags: selectedTags.map((tag) => localizedName(tag, sourceLanguage)).filter(Boolean),
			},
		};

		if (
			targetLanguage
			&& payload.translationMethod === 'manual'
			&& payload.translatedTitle
			&& payload.translatedContent
		) {
			translations[targetLanguage] = {
				title: payload.translatedTitle,
				content: payload.translatedContent,
				category: category ? localizedName(category, targetLanguage) : '',
				tags: selectedTags.map((tag) => localizedName(tag, targetLanguage)).filter(Boolean),
			};
		}

		return {
			sourceLanguage,
			status: payload.status ?? 'draft',
			translations,
			generatedAt: new Date().toISOString(),
		};
	}

	async function showPreviewValidation() {
		if (window.AdminCommon?.alert) {
			await window.AdminCommon.alert({
				titleKey: 'validationWarningTitle',
				messageKey: 'postRequiredFields',
				titleFallback: t('validationWarningTitle', '入力内容を確認してください'),
				messageFallback: t('postRequiredFields', 'タイトルと本文を入力してください。'),
			});
			return;
		}
		window.alert(t('postRequiredFields', 'タイトルと本文を入力してください。'));
	}

	function refreshButtonState() {
		if (!previewButton) return;
		previewButton.disabled = !(editorReady && postDataReady);
	}

	async function openPreview() {
		const snapshot = buildPreviewSnapshot();
		if (!snapshot || !snapshot.translations?.[snapshot.sourceLanguage]?.title || !snapshot.translations?.[snapshot.sourceLanguage]?.content) {
			await showPreviewValidation();
			return;
		}

		const previewWindow = window.open('about:blank', '_blank');
		if (!previewWindow) return;

		const handleReady = (event) => {
			if (event.origin !== window.location.origin) return;
			if (event.source !== previewWindow) return;
			if (event.data?.type !== 'song-post-preview-ready') return;

			previewWindow.postMessage({
				type: 'song-post-preview-data',
				payload: snapshot,
			}, window.location.origin);
			window.removeEventListener('message', handleReady);
		};

		window.addEventListener('message', handleReady);
		previewWindow.location.href = '/admin/posts/preview/';
	}

	async function initialize() {
		previewButton = document.querySelector('button[data-i18n="preview"]');
		if (!previewButton) return;

		const [editorResult] = await Promise.all([
			window.AdminPostEditor?.ready,
			window.AdminPostCategories?.ready,
		]);
		editorReady = Boolean(editorResult);
		refreshButtonState();

		previewButton.addEventListener('click', openPreview);
	}

	document.addEventListener('posteditordataloaded', () => {
		postDataReady = true;
		refreshButtonState();
	});

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize, { once: true });
	} else {
		initialize();
	}
})();
