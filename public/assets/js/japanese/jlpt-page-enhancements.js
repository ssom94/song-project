(() => {
	const KANJI_API = '/api/public/japanese/kanji-korean';
	const SETUP_KEY = 'song_public_japanese_quiz_setup';
	const MEMORY_KEY = 'song_jlpt_today_memory_mode_v1';
	let decorateTimer = 0;
	let memoryEnabled = false;
	let observer = null;

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
			if (focused) scheduleEnhance();
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
			.jlpt-kanji-korean { margin-top:10px; padding-top:8px; border-top:1px dashed #e0e5ea; font-size:10px; font-weight:750; line-height:1.6; text-align:right; color:#7b8797; }
			.jlpt-kanji-korean b { color:#445267; font-weight:900; }
			.jlpt-study-tools { display:flex; align-items:center; justify-content:flex-end; gap:8px; flex-wrap:wrap; }
			.jlpt-memory-mode-toggle.is-active { background:#26364e; color:#fff; }
			.jlpt-memory-reveal { display:none; width:100%; margin-top:10px; padding:9px 12px; border:1px solid #d6dee8; border-radius:10px; background:#fff; color:#42526a; font:inherit; font-size:12px; font-weight:800; cursor:pointer; }
			#jlpt-study-detail.is-memory-mode .jlpt-word-title span,
			#jlpt-study-detail.is-memory-mode .jlpt-word-card > p,
			#jlpt-study-detail.is-memory-mode .jlpt-kanji-korean,
			#jlpt-study-detail.is-memory-mode .jlpt-state-actions { display:none; }
			#jlpt-study-detail.is-memory-mode .jlpt-word-title strong { font-size:22px; }
			#jlpt-study-detail.is-memory-mode .jlpt-memory-reveal { display:block; }
			#jlpt-study-detail.is-memory-mode .jlpt-word-card.is-memory-revealed > p,
			#jlpt-study-detail.is-memory-mode .jlpt-word-card.is-memory-revealed .jlpt-kanji-korean { display:block; }
			#jlpt-study-detail.is-memory-mode .jlpt-word-card.is-memory-revealed .jlpt-word-title span { display:block; }
			#jlpt-study-detail.is-memory-mode .jlpt-word-card.is-memory-revealed .jlpt-state-actions { display:flex; }
			#jlpt-study-detail.is-memory-mode .jlpt-word-card.is-memory-revealed .jlpt-memory-reveal { background:#eef3fa; }
			@keyframes jlptFocusPulse { 0%,100% { box-shadow:0 10px 30px rgba(17,24,39,.04); } 35% { box-shadow:0 0 0 4px rgba(31,79,70,.18), 0 14px 36px rgba(17,24,39,.10); } }
			@media (max-width:640px) { .jlpt-card-heading { flex-direction:column; } .jlpt-study-tools { width:100%; justify-content:stretch; } .jlpt-study-tools button { flex:1 1 auto; } }
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

	function readMemoryState() {
		try { return localStorage.getItem(MEMORY_KEY) === '1'; } catch { return false; }
	}

	function saveMemoryState() {
		try { localStorage.setItem(MEMORY_KEY, memoryEnabled ? '1' : '0'); } catch { /* optional */ }
	}

	function syncMemoryButton() {
		const button = document.getElementById('jlpt-memory-mode-toggle');
		if (!(button instanceof HTMLButtonElement)) return;
		button.classList.toggle('is-active', memoryEnabled);
		button.setAttribute('aria-pressed', String(memoryEnabled));
		button.textContent = memoryEnabled ? t('암기 모드 종료', '暗記モード終了') : t('암기 모드', '暗記モード');
	}

	function setMemoryMode(next) {
		memoryEnabled = Boolean(next);
		const detail = document.getElementById('jlpt-study-detail');
		detail?.classList.toggle('is-memory-mode', memoryEnabled);
		if (!memoryEnabled) {
			detail?.querySelectorAll('.jlpt-word-card.is-memory-revealed').forEach((card) => card.classList.remove('is-memory-revealed'));
			detail?.querySelectorAll('.jlpt-memory-reveal').forEach((button) => { button.textContent = t('정답 보기', '答えを見る'); });
		}
		saveMemoryState();
		syncMemoryButton();
	}

	function enhanceWordCard(card) {
		if (!(card instanceof HTMLElement) || card.dataset.memoryEnhanced === 'true') return;
		card.dataset.memoryEnhanced = 'true';
		const reveal = document.createElement('button');
		reveal.type = 'button';
		reveal.className = 'jlpt-memory-reveal';
		reveal.textContent = t('정답 보기', '答えを見る');
		reveal.addEventListener('click', () => {
			const opened = card.classList.toggle('is-memory-revealed');
			reveal.textContent = opened ? t('다시 숨기기', 'もう一度隠す') : t('정답 보기', '答えを見る');
		});
		card.appendChild(reveal);
	}

	function todayWords() {
		const detail = document.getElementById('jlpt-study-detail');
		if (!detail) return [];
		return [...new Set([...detail.querySelectorAll('.jlpt-word-title strong')]
			.map((node) => node.textContent?.trim() || '')
			.filter(Boolean))];
	}

	function syncQuizButton() {
		const button = document.getElementById('jlpt-today-choice-quiz');
		if (!(button instanceof HTMLButtonElement)) return;
		const count = todayWords().length;
		button.disabled = count < 4;
		button.textContent = count >= 4 ? t(`오늘 단어 4지선다 (${count})`, `今日の単語4択 (${count})`) : t('오늘 단어 4지선다', '今日の単語4択');
		button.title = count < 4 ? t('4지선다 출제를 위해 단어가 4개 이상 필요합니다.', '4択には4語以上必要です。') : t('현재 단어 학습·복습 목록만으로 4지선다 퀴즈를 시작합니다.', '現在の単語学習・復習一覧だけで4択クイズを開始します。');
	}

	function startTodayChoiceQuiz() {
		const words = todayWords();
		if (words.length < 4) return;
		const setup = {
			studyMode: 'japanese', quizMode: 'choice', types: ['meaning'], jlpts: ['N1'], jlpt: 'N1',
			categoryId: null, categoryName: t('오늘의 학습', '今日の学習'), partId: null, partName: t('전체', 'すべて'),
			count: Math.min(20, words.length), priority: 'random', focusWordId: null, focusWord: null, quick: false, scopeWords: words,
		};
		try {
			sessionStorage.setItem(SETUP_KEY, JSON.stringify(setup));
			sessionStorage.removeItem('song_public_japanese_quiz_retry_questions');
		} catch { return; }
		window.location.href = `/${language()}/japanese/quiz/play/?study=japanese`;
	}

	function mountStudyTools() {
		const detail = document.getElementById('jlpt-study-detail');
		const heading = detail?.querySelector('.jlpt-card-heading');
		if (!(heading instanceof HTMLElement)) return;
		let tools = heading.querySelector('.jlpt-study-tools');
		if (!(tools instanceof HTMLElement)) {
			tools = document.createElement('div');
			tools.className = 'jlpt-study-tools';
			const memory = document.createElement('button');
			memory.id = 'jlpt-memory-mode-toggle';
			memory.className = 'jlpt-secondary-button jlpt-memory-mode-toggle';
			memory.type = 'button';
			memory.setAttribute('aria-pressed', 'false');
			memory.addEventListener('click', () => setMemoryMode(!memoryEnabled));
			const quiz = document.createElement('button');
			quiz.id = 'jlpt-today-choice-quiz';
			quiz.className = 'jlpt-primary-button';
			quiz.type = 'button';
			quiz.addEventListener('click', startTodayChoiceQuiz);
			tools.append(memory, quiz);
			heading.appendChild(tools);
		}
		syncMemoryButton();
		syncQuizButton();
	}

	function scheduleKanjiDecoration() {
		window.clearTimeout(decorateTimer);
		decorateTimer = window.setTimeout(decorateKanji, 60);
	}

	function enhanceStudyArea() {
		mountStudyTools();
		document.querySelectorAll('#jlpt-study-detail .jlpt-word-card').forEach(enhanceWordCard);
		document.getElementById('jlpt-study-detail')?.classList.toggle('is-memory-mode', memoryEnabled);
		syncMemoryButton();
		syncQuizButton();
		scheduleKanjiDecoration();
	}

	function scheduleEnhance() {
		window.setTimeout(enhanceStudyArea, 40);
	}

	function observeStudyCards() {
		const detail = document.getElementById('jlpt-study-detail');
		if (!(detail instanceof HTMLElement) || observer) return;
		observer = new MutationObserver((mutations) => {
			if (mutations.some((mutation) => mutation.type === 'childList')) scheduleEnhance();
		});
		observer.observe(detail, { childList: true, subtree: true });
	}

	function initialize() {
		injectStyle();
		memoryEnabled = readMemoryState();
		const button = document.getElementById('jlpt-start-button');
		if (button instanceof HTMLButtonElement) {
			button.title = t('클릭하면 아래 단어 학습 영역으로 이동합니다.', 'クリックすると下の単語学習エリアへ移動します。');
			button.addEventListener('click', waitAndFocus);
		}
		observeStudyCards();
		enhanceStudyArea();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
