(() => {
	const query = new URLSearchParams(window.location.search);
	const path = window.location.pathname;
	const koreanMode = path.includes('/korean/') || query.get('study') === 'korean';
	if (!koreanMode) return;

	function language() {
		return document.body?.dataset?.blogLanguage === 'ko' ? 'ko' : 'ja';
	}

	function t(ko, ja) {
		return language() === 'ko' ? ko : ja;
	}

	function withKoreanMode(href) {
		try {
			const url = new URL(href, window.location.origin);
			url.searchParams.set('study', 'korean');
			return `${url.pathname}${url.search}${url.hash}`;
		} catch {
			return href;
		}
	}

	function configureWordListHeading() {
		if (!path.includes('/japanese/words/')) return;
		const heading = document.querySelector('.jp-page-heading h1');
		const eyebrow = document.querySelector('.jp-page-heading .jp-eyebrow');
		const lead = document.querySelector('.jp-page-heading p:not(.jp-eyebrow)');
		if (eyebrow) eyebrow.textContent = 'KOREAN VOCABULARY';
		if (heading) heading.textContent = t('한국어 단어 학습', '韓国語単語学習');
		if (lead) lead.textContent = t(
			'일본어 단어를 보고 한국어 뜻을 외우고, 암기 모드와 퀴즈로 바로 확인합니다.',
			'日本語の単語を見て韓国語の意味を覚え、暗記モードとクイズですぐ確認します。',
		);
		document.querySelectorAll('.jp-heading-actions a[href*="/japanese/quiz/"]').forEach((link) => {
			if (link instanceof HTMLAnchorElement) {
				link.href = withKoreanMode(link.href);
				link.textContent = t('한국어 랜덤 퀴즈', '韓国語ランダムクイズ');
			}
		});
	}

	function configureWordRows() {
		if (!path.includes('/japanese/words/')) return;
		document.querySelectorAll('.jp-word-row a.jp-secondary-button[href*="/japanese/quiz/"]').forEach((link) => {
			if (!(link instanceof HTMLAnchorElement)) return;
			link.href = withKoreanMode(link.href);
			link.textContent = t('한국어 Quiz', '韓国語Quiz');
		});
	}

	function observeWordRows() {
		const list = document.querySelector('.jp-word-list');
		if (!list) return;
		new MutationObserver(configureWordRows).observe(list, { childList: true });
	}

	function initialize() {
		configureWordListHeading();
		configureWordRows();
		observeWordRows();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
