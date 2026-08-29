(() => {
	function currentLanguage() {
		return document.body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
	}

	function otherLanguage(language) {
		return language === 'ja' ? 'ko' : 'ja';
	}

	function text() {
		return currentLanguage() === 'ko'
			? {
				notFoundTitle: '게시글을 찾을 수 없습니다',
				notFoundMessage: '삭제되었거나 공개되지 않은 게시글입니다.',
				loadFailedTitle: '게시글을 불러오지 못했습니다',
				loadFailedMessage: '잠시 후 다시 시도해 주세요.',
				missingTitle: '한국어 번역이 아직 없습니다',
				missingMessage: '이 게시글의 한국어 번역은 아직 등록되지 않았습니다. 다른 언어로 내용을 확인해 주세요.',
				alternateJapanese: '日本語で見る',
				alternateKorean: '한국어로 보기',
			}
			: {
				notFoundTitle: '投稿が見つかりません',
				notFoundMessage: '削除されたか、公開されていない投稿です。',
				loadFailedTitle: '投稿を読み込めませんでした',
				loadFailedMessage: 'しばらくしてからもう一度お試しください。',
				missingTitle: '日本語翻訳はまだありません',
				missingMessage: 'この記事の日本語翻訳はまだ登録されていません。他の言語で内容をご確認ください。',
				alternateJapanese: '日本語で見る',
				alternateKorean: '한국어로 보기',
			};
	}

	function currentSlug() {
		const parts = window.location.pathname.split('/').filter(Boolean);
		if (parts.length < 3) return '';
		try {
			return decodeURIComponent(parts.slice(2).join('/'));
		} catch {
			return parts.slice(2).join('/');
		}
	}

	function formatDate(value) {
		if (!value) return '';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return new Intl.DateTimeFormat(currentLanguage() === 'ko' ? 'ko-KR' : 'ja-JP', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			timeZone: 'Asia/Tokyo',
		}).format(date);
	}

	function createChip(value, category = false) {
		const chip = document.createElement('span');
		chip.className = `blog-chip${category ? ' blog-chip-category' : ''}`;
		chip.textContent = value;
		return chip;
	}

	function setError(kind = 'load') {
		const copy = text();
		const loading = document.getElementById('post-detail-loading');
		const detail = document.getElementById('post-detail');
		const missing = document.getElementById('post-translation-missing');
		const error = document.getElementById('post-detail-error');
		if (loading) loading.hidden = true;
		if (detail) detail.hidden = true;
		if (missing) missing.hidden = true;
		if (!error) return;
		error.hidden = false;
		const title = document.getElementById('post-detail-error-title');
		const message = document.getElementById('post-detail-error-message');
		if (title) title.textContent = kind === 'notFound' ? copy.notFoundTitle : copy.loadFailedTitle;
		if (message) message.textContent = kind === 'notFound' ? copy.notFoundMessage : copy.loadFailedMessage;
	}

	function updateAlternateLink(translations, requestedLanguage, fallbackSlug) {
		const alternateLanguage = otherLanguage(requestedLanguage);
		const alternate = translations?.[alternateLanguage];
		const headerLink = document.getElementById('post-language-alternate');
		if (!headerLink) return;
		const slug = alternate?.slug ?? fallbackSlug;
		headerLink.href = slug
			? `/${alternateLanguage}/posts/${encodeURIComponent(slug)}`
			: `/${alternateLanguage}/posts/`;
	}

	function renderMissingTranslation(translations, slug) {
		const copy = text();
		const language = currentLanguage();
		const alternateLanguage = otherLanguage(language);
		const alternate = translations?.[alternateLanguage];
		const loading = document.getElementById('post-detail-loading');
		const detail = document.getElementById('post-detail');
		const missing = document.getElementById('post-translation-missing');
		if (loading) loading.hidden = true;
		if (detail) detail.hidden = true;
		if (!missing) return;
		missing.hidden = false;

		const title = document.getElementById('post-translation-missing-title');
		const message = document.getElementById('post-translation-missing-message');
		const link = document.getElementById('post-translation-alternate-link');
		if (title) title.textContent = copy.missingTitle;
		if (message) message.textContent = copy.missingMessage;
		if (link && alternate?.slug) {
			link.hidden = false;
			link.href = `/${alternateLanguage}/posts/${encodeURIComponent(alternate.slug)}`;
			link.textContent = alternateLanguage === 'ja' ? copy.alternateJapanese : copy.alternateKorean;
		} else if (link) {
			link.hidden = true;
		}
		updateAlternateLink(translations, language, slug);
	}

	function renderPost(post, translation, slug) {
		const language = currentLanguage();
		const loading = document.getElementById('post-detail-loading');
		const detail = document.getElementById('post-detail');
		const title = document.getElementById('post-detail-title');
		const content = document.getElementById('post-detail-content');
		const meta = document.getElementById('post-detail-meta');
		const taxonomy = document.getElementById('post-detail-taxonomy');
		if (loading) loading.hidden = true;
		if (!detail || !title || !content || !meta || !taxonomy) return;

		detail.hidden = false;
		title.textContent = translation.title ?? '';
		content.textContent = translation.content ?? '';
		meta.replaceChildren();
		taxonomy.replaceChildren();

		const publishedAt = formatDate(post.publishedAt ?? post.updatedAt);
		if (publishedAt) {
			const time = document.createElement('time');
			time.dateTime = post.publishedAt ?? post.updatedAt ?? '';
			time.textContent = publishedAt;
			meta.appendChild(time);
		}
		if (translation.category) taxonomy.appendChild(createChip(translation.category, true));
		for (const tag of Array.isArray(translation.tags) ? translation.tags : []) {
			taxonomy.appendChild(createChip(tag));
		}

		document.title = `${translation.title} | SONG`;
		if (translation.slug && translation.slug !== slug) {
			history.replaceState(null, '', `/${language}/posts/${encodeURIComponent(translation.slug)}`);
		}
		updateAlternateLink(post.translations, language, translation.slug ?? slug);
	}

	async function initialize() {
		const language = currentLanguage();
		const slug = currentSlug();
		if (!slug) {
			setError('notFound');
			return;
		}

		try {
			const response = await fetch(`/api/public/posts/detail?lang=${language}&slug=${encodeURIComponent(slug)}`, {
				method: 'GET',
				cache: 'no-store',
			});
			const result = await response.json().catch(() => null);
			if (response.status === 404 || result?.error === 'POST_NOT_FOUND') {
				setError('notFound');
				return;
			}
			if (!response.ok || !result?.ok || !result.post?.translations) {
				throw new Error('Invalid public post detail response');
			}

			const post = result.post;
			const translation = post.translations[language];
			if (!translation) {
				renderMissingTranslation(post.translations, slug);
				return;
			}
			renderPost(post, translation, slug);
		} catch (loadError) {
			console.error('Failed to load public post', loadError);
			setError('load');
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize, { once: true });
	} else {
		initialize();
	}
})();
