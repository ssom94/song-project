(() => {
	function language() {
		return document.body.dataset.blogLanguage === 'ja' ? 'ja' : 'ko';
	}

	function t(ko, ja) {
		return language() === 'ja' ? ja : ko;
	}

	function focusStudyDetail() {
		const detail = document.getElementById('jlpt-study-detail');
		if (!(detail instanceof HTMLElement) || detail.classList.contains('jlpt-hidden')) return false;
		detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
		detail.classList.remove('is-jlpt-focus-pulse');
		void detail.offsetWidth;
		detail.classList.add('is-jlpt-focus-pulse');
		window.setTimeout(() => detail.classList.remove('is-jlpt-focus-pulse'), 1500);
		return true;
	}

	function waitAndFocus() {
		let attempts = 0;
		const timer = window.setInterval(() => {
			attempts += 1;
			if (focusStudyDetail() || attempts >= 30) window.clearInterval(timer);
		}, 100);
	}

	function injectStyle() {
		if (document.getElementById('jlpt-page-enhancement-style')) return;
		const style = document.createElement('style');
		style.id = 'jlpt-page-enhancement-style';
		style.textContent = `
			#jlpt-study-detail { scroll-margin-top: 86px; }
			#jlpt-study-detail.is-jlpt-focus-pulse {
				animation: jlptFocusPulse 1.35s ease;
			}
			@keyframes jlptFocusPulse {
				0%, 100% { box-shadow: 0 10px 30px rgba(17,24,39,.04); }
				35% { box-shadow: 0 0 0 4px rgba(31,79,70,.18), 0 14px 36px rgba(17,24,39,.10); }
			}
		`;
		document.head.appendChild(style);
	}

	function initialize() {
		injectStyle();
		const button = document.getElementById('jlpt-start-button');
		if (!(button instanceof HTMLButtonElement)) return;
		button.title = t('클릭하면 아래 단어 학습 영역으로 이동합니다.', 'クリックすると下の単語学習エリアへ移動します。');
		button.addEventListener('click', waitAndFocus);
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
