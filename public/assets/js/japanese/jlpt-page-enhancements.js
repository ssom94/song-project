(() => {
	const KANJI_API = '/api/public/japanese/kanji-korean';
	let decorateTimer = 0;

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
			const focused = focusStudyDetail();
			if (focused) scheduleKanjiDecoration();
			if (focused || attempts >= 30) window.clearInterval(timer);
		}, 100);
	}

	function injectStyle() {
		if (document.getElementById('jlpt-page-enhancement-style')) return;
		const style = document.createElement('style');
		style.id = 'jlpt-page-enhancement-style';
		style.textContent = `
			#jlpt-study-detail { scroll-margin-top: 86px; }
			#jlpt-study-detail.is-jlpt-focus-pulse { animation: jlptFocusPulse 1.35s ease; }
			.jlpt-kanji-korean {
				margin-top: 10px;
				padding-top: 8px;
				border-top: 1px dashed #e0e5ea;
				font-size: 10px;
				font-weight: 750;
				line-height: 1.6;
				text-align: right;
				color: #7b8797;
			}
			.jlpt-kanji-korean b { color: #445267; font-weight: 900; }
			@keyframes jlptFocusPulse {
				0%, 100% { box-shadow: 0 10px 30px rgba(17,24,39,.04); }
				35% { box-shadow: 0 0 0 4px rgba(31,79,70,.18), 0 14px 36px rgba(17,24,39,.10); }
			}
		`;
		document.head.appendChild(style);
	}

	function cardWord(card) {
		return card.querySelector('.jlpt-word-title strong')?.textContent?.trim() || '';
	}

	function formatKanji(entries) {
		return entries.map((entry) => `${entry.character} ${entry.meaningKo} ${entry.soundKo}`).join(' · ');
	}

	async function decorateKanji() {
		const cards = [...document.querySelectorAll('#jlpt-study-detail .jlpt-word-card')]
			.filter((card) => card instanceof HTMLElement && !card.dataset.kanjiDecorated);
		if (!cards.length) return;

		const words = [...new Set(cards.map(cardWord).filter(Boolean))];
		if (!words.length) return;
		const params = new URLSearchParams();
		for (const word of words) params.append('word', word);

		try {
			const response = await fetch(`${KANJI_API}?${params.toString()}`, { cache: 'no-store' });
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok || !Array.isArray(result.words)) throw new Error('KANJI_LOAD_FAILED');
			const byWord = new Map(result.words.map((item) => [item.word, Array.isArray(item.kanji) ? item.kanji : []]));

			for (const card of cards) {
				const word = cardWord(card);
				const entries = byWord.get(word) || [];
				card.dataset.kanjiDecorated = 'true';
				if (!entries.length) continue;
				const line = document.createElement('div');
				line.className = 'jlpt-kanji-korean';
				const label = document.createElement('b');
				label.textContent = t('한자 ', '韓国式漢字 ');
				line.append(label, formatKanji(entries));
				card.appendChild(line);
			}
		} catch (error) {
			console.warn('Failed to decorate JLPT cards with Korean kanji readings', error);
		}
	}

	function scheduleKanjiDecoration() {
		window.clearTimeout(decorateTimer);
		decorateTimer = window.setTimeout(decorateKanji, 60);
	}

	function observeStudyCards() {
		const detail = document.getElementById('jlpt-study-detail');
		if (!(detail instanceof HTMLElement)) return;
		new MutationObserver((mutations) => {
			if (mutations.some((mutation) => mutation.type === 'childList')) scheduleKanjiDecoration();
		}).observe(detail, { childList: true, subtree: true });
	}

	function initialize() {
		injectStyle();
		const button = document.getElementById('jlpt-start-button');
		if (button instanceof HTMLButtonElement) {
			button.title = t('클릭하면 아래 단어 학습 영역으로 이동합니다.', 'クリックすると下の単語学習エリアへ移動します。');
			button.addEventListener('click', waitAndFocus);
		}
		observeStudyCards();
		scheduleKanjiDecoration();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
