(() => {
	const STORAGE_KEY = 'song_japanese_word_memory_mode_v2';
	let enabled = false;
	let observer = null;

	function language() {
		return document.body.dataset.blogLanguage === 'ja' ? 'ja' : 'ko';
	}

	function t(ko, ja) {
		return language() === 'ja' ? ja : ko;
	}

	function mountStyle() {
		if (document.querySelector('link[data-word-memory-mode]')) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '/assets/css/japanese/word-memory-mode.css?v=20260831-2';
		link.dataset.wordMemoryMode = 'true';
		document.head.appendChild(link);
	}

	function readState() {
		try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
	}

	function saveState() {
		try { localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0'); } catch { /* optional */ }
	}

	function resetReveals() {
		document.querySelectorAll('.jp-word-row.is-memory-revealed').forEach((row) => {
			row.classList.remove('is-memory-revealed');
			const reveal = row.querySelector('.jp-memory-reveal');
			if (reveal instanceof HTMLButtonElement) reveal.textContent = t('정답 보기', '答えを見る');
		});
	}

	function syncButton() {
		const button = document.getElementById('jp-memory-mode-toggle');
		if (!(button instanceof HTMLButtonElement)) return;
		button.classList.toggle('is-active', enabled);
		button.textContent = enabled ? t('암기 모드 종료', '暗記モード終了') : t('암기 모드', '暗記モード');
		button.setAttribute('aria-pressed', String(enabled));
		button.title = enabled
			? t('읽기와 뜻을 다시 표시합니다.', '読みと意味を再表示します。')
			: t('일본어 단어만 보고 외웁니다.', '日本語の単語だけを見て暗記します。');
	}

	function setEnabled(next) {
		enabled = Boolean(next);
		document.body.classList.toggle('jp-word-memory-mode', enabled);
		if (!enabled) resetReveals();
		saveState();
		syncButton();
	}

	function bindButton(button) {
		if (!(button instanceof HTMLButtonElement) || button.dataset.memoryBound === 'true') return;
		button.dataset.memoryBound = 'true';
		button.addEventListener('click', () => setEnabled(!enabled));
	}

	function mountButton() {
		const actions = document.querySelector('.jp-heading-actions');
		if (!(actions instanceof HTMLElement)) return null;
		let button = document.getElementById('jp-memory-mode-toggle');
		if (!(button instanceof HTMLButtonElement)) {
			button = document.createElement('button');
			button.id = 'jp-memory-mode-toggle';
			button.type = 'button';
			button.className = 'jp-secondary-button jp-memory-mode-toggle';
			actions.insertBefore(button, actions.firstChild);
		}
		bindButton(button);
		syncButton();
		return button;
	}

	function enhanceRow(row) {
		if (!(row instanceof HTMLElement) || row.dataset.memoryEnhanced === 'true') return;
		row.dataset.memoryEnhanced = 'true';
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'jp-memory-reveal';
		button.textContent = t('정답 보기', '答えを見る');
		button.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			const revealed = row.classList.toggle('is-memory-revealed');
			button.textContent = revealed ? t('다시 숨기기', 'もう一度隠す') : t('정답 보기', '答えを見る');
		});
		row.appendChild(button);
	}

	function enhanceRows() {
		document.querySelectorAll('.jp-word-list .jp-word-row').forEach(enhanceRow);
	}

	function observeRows() {
		const list = document.querySelector('.jp-word-list');
		if (!list || observer) return;
		observer = new MutationObserver(() => enhanceRows());
		observer.observe(list, { childList: true });
	}

	function initialize() {
		mountStyle();
		enabled = readState();
		mountButton();
		setEnabled(enabled);
		enhanceRows();
		observeRows();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
