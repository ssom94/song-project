(() => {
	const isJa = document.body?.dataset?.blogLanguage === 'ja';
	const t = (ko, ja) => isJa ? ja : ko;
	let enabled = false;
	let timer = 0;
	let filter = 'all';
	const pages = new Map();
	const PAGE_SIZE = 10;

	function normalizeBase(value) {
		return String(value || '').normalize('NFKC').trim().replace(/[\s　]+/g, '').toLowerCase();
	}

	function normalizeReading(value) {
		return normalizeBase(value).replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
	}

	function answers(value, type) {
		const normalize = type === 'reading' ? normalizeReading : normalizeBase;
		return String(value || '').split(/[|｜\/\n]/).map(normalize).filter(Boolean);
	}

	function visibleInputs() {
		return [...document.querySelectorAll('.jlpt-memory-answer-input')]
			.filter((node) => node instanceof HTMLInputElement && node.offsetParent !== null);
	}

	function field(host, type, answer) {
		const wrap = document.createElement('div');
		wrap.className = 'jlpt-memory-answer-field';
		const label = document.createElement('label');
		label.textContent = type === 'reading' ? t('히라가나', 'ひらがな') : t('한국어 뜻', '韓国語の意味');
		const input = document.createElement('input');
		input.type = 'text';
		input.className = 'jlpt-memory-answer-input';
		input.dataset.answerType = type;
		input.placeholder = type === 'reading' ? t('히라가나를 입력하세요', 'ひらがなを入力してください') : t('한국어 뜻을 입력하세요', '韓国語の意味を入力してください');
		input.autocomplete = 'off';
		input.spellcheck = false;
		input.setAttribute('aria-label', label.textContent);
		const result = document.createElement('div');
		result.className = 'jlpt-memory-practice-check';
		const expected = answers(answer, type);

		input.addEventListener('input', () => {
			const normalize = type === 'reading' ? normalizeReading : normalizeBase;
			const typed = normalize(input.value);
			const correct = Boolean(typed) && expected.includes(typed);
			const wrong = Boolean(typed) && !correct;
			input.classList.toggle('is-correct', correct);
			input.classList.toggle('is-wrong', wrong);
			result.classList.toggle('is-correct', correct);
			result.classList.toggle('is-wrong', wrong);
			result.textContent = correct ? t('✓ 정답입니다.', '✓ 正解です。') : (wrong ? t('다시 입력해 보세요.', 'もう一度入力してください。') : '');
			const fields = [...host.querySelectorAll('.jlpt-memory-answer-input')];
			host.classList.toggle('is-memory-input-complete', fields.length > 0 && fields.every((node) => node.classList.contains('is-correct')));
		});
		input.addEventListener('keydown', (event) => {
			if (event.key !== 'Tab' && event.key !== 'Enter') return;
			const inputs = visibleInputs();
			const index = inputs.indexOf(input);
			if (index < 0 || inputs.length < 2) return;
			event.preventDefault();
			const delta = event.shiftKey ? -1 : 1;
			const next = (index + delta + inputs.length) % inputs.length;
			inputs[next].focus();
			inputs[next].select();
		});
		label.appendChild(input);
		wrap.append(label, result);
		return wrap;
	}

	function decorateWord(host) {
		if (!(host instanceof HTMLElement) || host.dataset.memoryInputs === 'true') return;
		host.dataset.memoryInputs = 'true';
		const fields = document.createElement('div');
		fields.className = 'jlpt-memory-answer-fields';
		fields.append(
			field(host, 'reading', host.dataset.memoryReading || ''),
			field(host, 'meaning', host.dataset.memoryMeaningKo || ''),
		);
		host.appendChild(fields);
	}


	function wordState(host) {
		if (host.dataset.memoryState) return host.dataset.memoryState;
		const copy = host.querySelector('.jlpt-archive-status')?.textContent
			|| host.querySelector('.jlpt-word-head > span')?.textContent
			|| '';
		if (/애매|曖昧|あいまい/.test(copy)) return 'uncertain';
		if (/외움|暗記済|覚えた/.test(copy)) return 'mastered';
		return 'unlearned';
	}

	function matches(host) {
		const state = wordState(host);
		if (filter === 'review') return state !== 'mastered';
		if (filter === 'uncertain') return state === 'uncertain';
		if (filter === 'mastered') return state === 'mastered';
		return true;
	}

	function pagerButton(label, page, active, disabled, onClick) {
		const button = document.createElement('button');
		button.type = 'button';
		button.textContent = label;
		button.disabled = disabled;
		button.classList.toggle('is-active', active);
		button.addEventListener('click', onClick);
		return button;
	}

	function applyTodayFilter(list) {
		const cards = [...list.children].filter((node) => node.matches?.('.jlpt-word-card[data-memory-word="true"]'));
		if (!cards.length) return;
		const matched = cards.filter(matches);
		const totalPages = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
		const page = Math.min(pages.get(list) || 1, totalPages);
		pages.set(list, page);
		cards.forEach((card) => {
			const index = matched.indexOf(card);
			const shown = index >= (page - 1) * PAGE_SIZE && index < page * PAGE_SIZE;
			card.classList.toggle('jlpt-memory-filter-hidden', !shown);
			card.classList.toggle('jlpt-history-hidden', !shown);
		});
		const oldPager = list.nextElementSibling;
		if (oldPager?.classList.contains('jlpt-pager')) oldPager.remove();
		let empty = list.parentElement?.querySelector(':scope > .jlpt-memory-filter-empty');
		if (!matched.length) {
			if (!empty) {
				empty = document.createElement('p');
				empty.className = 'jlpt-empty jlpt-memory-filter-empty';
				list.after(empty);
			}
			empty.textContent = t('이 조건에 해당하는 단어가 없습니다.', 'この条件に該当する単語はありません。');
			return;
		}
		empty?.remove();
		if (totalPages <= 1) return;
		const pager = document.createElement('div');
		pager.className = 'jlpt-pager jlpt-memory-filter-pager';
		const go = (next) => { pages.set(list, next); applyTodayFilter(list); };
		pager.append(
			pagerButton('‹', Math.max(1, page - 1), false, page === 1, () => go(Math.max(1, page - 1))),
			...[...Array(totalPages)].map((_, index) => pagerButton(String(index + 1), index + 1, index + 1 === page, false, () => go(index + 1))),
			pagerButton('›', Math.min(totalPages, page + 1), false, page === totalPages, () => go(Math.min(totalPages, page + 1))),
		);
		list.after(pager);
	}

	function applyFilter() {
		window.__SONG_JLPT_MEMORY_FILTER__ = filter;
		document.querySelectorAll('#jlpt-review-words, #jlpt-new-words').forEach(applyTodayFilter);
		document.querySelectorAll('.jlpt-memory-filter-button').forEach((button) => {
			const active = button.dataset.filter === filter;
			button.classList.toggle('is-active', active);
			button.setAttribute('aria-pressed', String(active));
		});
	}

	function setFilter(next) {
		filter = next;
		pages.clear();
		applyFilter();
		window.dispatchEvent(new CustomEvent('song:jlpt-memory-filter', { detail: { filter } }));
	}

	function mountFilters(bar) {
		let group = bar.querySelector('.jlpt-memory-filter-group');
		if (group) return;
		group = document.createElement('div');
		group.className = 'jlpt-memory-filter-group';
		[
			['all', t('전체', 'すべて')],
			['review', t('복습 필요', '復習が必要')],
			['uncertain', t('애매함', 'あいまい')],
			['mastered', t('학습완료', '学習完了')],
		].forEach(([value, label]) => {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'jlpt-memory-filter-button';
			button.dataset.filter = value;
			button.textContent = label;
			button.addEventListener('click', () => setFilter(value));
			group.appendChild(button);
		});
		bar.appendChild(group);
	}

	function toolbar(container) {
		let bar = [...container.children].find((node) => node.classList?.contains('jlpt-memory-practice-toolbar'));
		if (!(bar instanceof HTMLElement)) {
			bar = document.createElement('div');
			bar.className = 'jlpt-memory-practice-toolbar';
			const button = document.createElement('button');
			button.type = 'button';
			button.addEventListener('click', () => {
				enabled = !enabled;
				decorate();
				if (enabled) container.querySelector('.jlpt-memory-answer-input')?.focus();
			});
			bar.appendChild(button);
			container.prepend(bar);
		}
		mountFilters(bar);
		const button = bar.querySelector(':scope > button');
		if (button) {
			const copy = enabled ? t('암기 모드 종료', '暗記モード終了') : t('암기 모드', '暗記モード');
			if (button.textContent !== copy) button.textContent = copy;
			button.classList.toggle('is-active', enabled);
			button.setAttribute('aria-pressed', String(enabled));
		}
	}

	function decorate() {
		document.body.classList.toggle('jlpt-memory-practice-active', enabled);
		document.querySelectorAll('[data-memory-word="true"]').forEach(decorateWord);

		const preview = document.getElementById('jlpt-preview-content');
		if (preview?.querySelector('[data-memory-word="true"]')) toolbar(preview);

		const archive = document.getElementById('jlpt-selected-date-card');
		if (archive instanceof HTMLElement && !archive.classList.contains('jlpt-history-hidden') && archive.querySelector('[data-memory-word="true"]')) {
			toolbar(archive);
		}
		applyFilter();
	}

	function scan() {
		window.clearTimeout(timer);
		timer = window.setTimeout(decorate, 80);
	}

	function init() {
		decorate();
		const root = document.querySelector('.jlpt-content') || document.body;
		new MutationObserver((mutations) => {
			if (mutations.some((mutation) => mutation.type === 'childList')) scan();
		}).observe(root, { childList: true, subtree: true });
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
	else init();
})();