(() => {
	let previewData = null;
	let activeLanguage = null;
	let waitingTimer = null;

	function adminLanguage() {
		return window.AdminI18n?.getLanguage?.() ?? 'ja';
	}

	function languageLabel(language) {
		return language === 'ko' ? '한국어' : '日本語';
	}

	function statusLabel(status, language) {
		const labels = language === 'ko'
			? { draft: '임시저장', published: '공개', private: '비공개' }
			: { draft: '下書き', published: '公開', private: '非公開' };
		return labels[status] ?? labels.draft;
	}

	function unclassifiedLabel(language) {
		return language === 'ko' ? '미분류' : '未分類';
	}

	function isValidTranslation(value) {
		return value
			&& typeof value === 'object'
			&& typeof value.title === 'string'
			&& typeof value.content === 'string'
			&& Array.isArray(value.tags);
	}

	function normalizePayload(payload) {
		if (!payload || typeof payload !== 'object') return null;
		if (payload.sourceLanguage !== 'ja' && payload.sourceLanguage !== 'ko') return null;
		if (!payload.translations || typeof payload.translations !== 'object') return null;
		if (!isValidTranslation(payload.translations[payload.sourceLanguage])) return null;

		const translations = {};
		for (const language of ['ja', 'ko']) {
			const translation = payload.translations[language];
			if (!isValidTranslation(translation)) continue;
			translations[language] = {
				title: translation.title,
				content: translation.content,
				category: typeof translation.category === 'string' ? translation.category : '',
				tags: translation.tags.filter((tag) => typeof tag === 'string').slice(0, 30),
			};
		}

		return {
			sourceLanguage: payload.sourceLanguage,
			status: ['draft', 'published', 'private'].includes(payload.status) ? payload.status : 'draft',
			translations,
		};
	}

	function renderAdminBar() {
		const korean = adminLanguage() === 'ko';
		const label = document.getElementById('preview-admin-label');
		const note = document.getElementById('preview-admin-note');
		const close = document.getElementById('preview-close');
		if (label) label.textContent = korean ? '관리자 미리보기' : '管理者プレビュー';
		if (note) note.textContent = korean ? '저장 전 내용이 포함될 수 있습니다.' : '保存前の内容を含む場合があります。';
		if (close) close.textContent = korean ? '닫기' : '閉じる';
	}

	function renderLanguageSwitch() {
		const container = document.getElementById('preview-language-switch');
		if (!container || !previewData) return;

		const languages = ['ja', 'ko'].filter((language) => previewData.translations[language]);
		container.replaceChildren();
		container.hidden = languages.length <= 1;

		for (const language of languages) {
			const button = document.createElement('button');
			button.type = 'button';
			button.textContent = languageLabel(language);
			button.classList.toggle('is-active', language === activeLanguage);
			button.setAttribute('aria-pressed', String(language === activeLanguage));
			button.addEventListener('click', () => {
				activeLanguage = language;
				renderArticle();
			});
			container.appendChild(button);
		}
	}

	function renderTags(tags) {
		const container = document.getElementById('preview-tags');
		if (!container) return;
		container.replaceChildren();
		for (const tag of tags) {
			const chip = document.createElement('span');
			chip.textContent = `#${tag}`;
			container.appendChild(chip);
		}
	}

	function renderContent(markdown, content) {
		if (!window.SongMarkdown?.render?.(markdown ?? '', content)) {
			content.textContent = markdown ?? '';
		}
	}

	function renderArticle() {
		if (!previewData || !activeLanguage) return;
		const translation = previewData.translations[activeLanguage];
		if (!translation) return;

		const waiting = document.getElementById('preview-waiting');
		const article = document.getElementById('preview-article');
		const status = document.getElementById('preview-status');
		const category = document.getElementById('preview-category');
		const title = document.getElementById('preview-title');
		const content = document.getElementById('preview-content');

		if (waiting) waiting.hidden = true;
		if (article) article.hidden = false;
		if (status) {
			status.dataset.status = previewData.status;
			status.textContent = statusLabel(previewData.status, activeLanguage);
		}
		if (category) category.textContent = translation.category || unclassifiedLabel(activeLanguage);
		if (title) title.textContent = translation.title;
		if (content) renderContent(translation.content, content);

		document.documentElement.lang = activeLanguage;
		document.title = `${translation.title || (activeLanguage === 'ko' ? '게시글 미리보기' : '投稿プレビュー')} | SONG`;
		renderTags(translation.tags);
		renderLanguageSwitch();
	}

	function showNoDataMessage() {
		const waiting = document.getElementById('preview-waiting');
		if (!waiting || previewData) return;
		waiting.textContent = adminLanguage() === 'ko'
			? '미리보기 데이터를 받지 못했습니다. 게시글 작성/보기 화면에서 미리보기를 다시 열어 주세요.'
			: 'プレビューデータを受信できませんでした。投稿作成・表示画面からもう一度プレビューを開いてください。';
	}

	function handleMessage(event) {
		if (event.origin !== window.location.origin) return;
		if (window.opener && event.source !== window.opener) return;
		if (event.data?.type !== 'song-post-preview-data') return;

		const normalized = normalizePayload(event.data.payload);
		if (!normalized) {
			showNoDataMessage();
			return;
		}

		previewData = normalized;
		activeLanguage = normalized.sourceLanguage;
		if (waitingTimer) window.clearTimeout(waitingTimer);
		renderArticle();
	}

	async function initialize() {
		window.addEventListener('message', handleMessage);
		document.getElementById('preview-close')?.addEventListener('click', () => window.close());

		const session = await window.AdminCommon?.ready;
		if (!session) return;
		renderAdminBar();

		if (!window.opener) {
			showNoDataMessage();
			return;
		}

		window.opener.postMessage({ type: 'song-post-preview-ready' }, window.location.origin);
		waitingTimer = window.setTimeout(showNoDataMessage, 3000);
	}

	document.addEventListener('adminlanguagechange', renderAdminBar);

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize, { once: true });
	} else {
		initialize();
	}
})();
