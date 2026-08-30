(() => {
	let previewButton = null;
	let editorReady = false;

	function t(key, fallback) {
		const value = window.AdminI18n?.t(key);
		return value && value !== key ? value : fallback;
	}

	function countMatches(text, regex) {
		return (text.match(regex) ?? []).length;
	}

	function detectSourceLanguage(text) {
		const hangulCount = countMatches(text, /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/g);
		const kanaCount = countMatches(text, /[\u3040-\u30ff\u31f0-\u31ff]/g);
		const kanjiCount = countMatches(text, /[\u3400-\u4dbf\u4e00-\u9fff]/g);

		if (hangulCount === 0 && kanaCount === 0 && kanjiCount === 0) return null;
		if (hangulCount > 0 && kanaCount === 0 && kanjiCount === 0) return 'ko';
		if (kanaCount > 0 && hangulCount === 0) return 'ja';
		if (hangulCount === 0 && (kanaCount > 0 || kanjiCount > 0)) return 'ja';

		const koreanScore = hangulCount * 3;
		const japaneseScore = (kanaCount * 3) + (kanjiCount * 0.35);
		if (Math.abs(koreanScore - japaneseScore) > Math.max(koreanScore, japaneseScore) * 0.15) {
			return koreanScore > japaneseScore ? 'ko' : 'ja';
		}

		for (const character of text) {
			if (/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/.test(character)) return 'ko';
			if (/[\u3040-\u30ff\u31f0-\u31ff]/.test(character)) return 'ja';
		}

		return koreanScore >= japaneseScore ? 'ko' : 'ja';
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

	function buildCategoryTrail(categories, category, language) {
		if (!category) return '';
		const byId = new Map(categories.map((item) => [Number(item.id), item]));
		const trail = [];
		const visited = new Set();
		let current = category;
		while (current && !visited.has(Number(current.id)) && trail.length < 8) {
			visited.add(Number(current.id));
			const label = localizedName(current, language);
			if (label) trail.unshift(label);
			current = current.parentId ? byId.get(Number(current.parentId)) ?? null : null;
		}
		return trail.join(' - ');
	}

	function buildPreviewSnapshot() {
		const payload = window.AdminPostEditor?.buildPayload?.(false);
		if (!payload) return null;

		const sourceLanguage = payload.sourceLanguage === 'ja' || payload.sourceLanguage === 'ko'
			? payload.sourceLanguage
			: detectSourceLanguage(`${payload.title ?? ''}\n${payload.content ?? ''}`);
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
				category: buildCategoryTrail(categories, category, sourceLanguage),
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
				category: buildCategoryTrail(categories, category, targetLanguage),
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

	async function openPreview() {
		const snapshot = buildPreviewSnapshot();
		const source = snapshot?.translations?.[snapshot.sourceLanguage];
		if (!snapshot || !source?.title?.trim() || !source?.content?.trim()) {
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
		previewButton.disabled = !editorReady;
		previewButton.addEventListener('click', openPreview);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize, { once: true });
	} else {
		initialize();
	}
})();
