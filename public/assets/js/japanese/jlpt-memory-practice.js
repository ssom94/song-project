(() => {
	const isJa = document.body?.dataset?.blogLanguage === 'ja';
	const t = (ko, ja) => isJa ? ja : ko;
	let enabled = false;
	let timer = 0;

	function injectStyle() {
		if (document.getElementById('jlpt-memory-practice-style')) return;
		const style = document.createElement('style');
		style.id = 'jlpt-memory-practice-style';
		style.textContent = `
			.jlpt-memory-practice-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 12px}
			.jlpt-memory-practice-toolbar button{border:1px solid #ccd6e3;border-radius:9px;background:#fff;padding:8px 12px;font:inherit;font-weight:700;cursor:pointer}
			.jlpt-memory-practice-toolbar button.is-active{background:#26364e;color:#fff;border-color:#26364e}
			.jlpt-memory-answer-fields{display:none;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}
			.jlpt-memory-practice-active .jlpt-memory-answer-fields,
			#jlpt-study-detail.is-memory-mode .jlpt-memory-answer-fields{display:grid}
			.jlpt-memory-answer-field{display:grid;gap:5px;min-width:0}
			.jlpt-memory-answer-field label{display:grid;gap:5px;color:#59677b;font-size:11px;font-weight:700}
			.jlpt-memory-answer-input{width:100%;box-sizing:border-box;padding:10px 11px;border:1px solid #cdd7e4;border-radius:9px;background:#fff;font:inherit;font-size:13px;outline:none;transition:border-color .15s ease,background-color .15s ease,box-shadow .15s ease}
			.jlpt-memory-answer-input:focus{border-color:#708bb7;box-shadow:0 0 0 3px rgba(73,103,151,.12)}
			.jlpt-memory-answer-input.is-correct,.jlpt-memory-answer-input.is-correct:focus{border-color:#79b990;background:#f1faf4;box-shadow:0 0 0 3px rgba(70,145,98,.08)}
			.jlpt-memory-answer-input.is-wrong,.jlpt-memory-answer-input.is-wrong:focus{border-color:#dfa7a7;background:#fff3f3;box-shadow:0 0 0 3px rgba(184,80,80,.06)}
			.jlpt-memory-practice-check{min-height:17px;font-size:11px;font-weight:700;color:#7a8798}
			.jlpt-memory-practice-check.is-correct{color:#287a58}
			.jlpt-memory-practice-check.is-wrong{color:#a75d5d}
			.jlpt-memory-practice-active .jlpt-preview-word-grid > [data-memory-word] > span,
			.jlpt-memory-practice-active .jlpt-preview-word-grid > [data-memory-word] > small,
			.jlpt-memory-practice-active .jlpt-archive-word[data-memory-word] > small{visibility:hidden}
			.jlpt-memory-practice-active [data-memory-word].is-memory-input-complete > span,
			.jlpt-memory-practice-active [data-memory-word].is-memory-input-complete > small{visibility:visible}
			@media(max-width:640px){.jlpt-memory-answer-fields{grid-template-columns:1fr}}
		`;
		document.head.appendChild(style);
	}

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

	function toolbar(container) {
		let bar = container.querySelector(':scope > .jlpt-memory-practice-toolbar');
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
		const button = bar.querySelector('button');
		if (button) {
			const copy = enabled ? t('암기 모드 종료', '暗記モード終了') : t('암기 모드', '暗記モード');
			if (button.textContent !== copy) button.textContent = copy;
			button.classList.toggle('is-active', enabled);
			button.setAttribute('aria-pressed', String(enabled));
		}
	}

	function decorate() {
		injectStyle();
		document.body.classList.toggle('jlpt-memory-practice-active', enabled);
		document.querySelectorAll('[data-memory-word="true"]').forEach(decorateWord);
		const preview = document.getElementById('jlpt-preview-content');
		if (preview?.querySelector('[data-memory-word="true"]')) toolbar(preview);
		const archive = document.getElementById('jlpt-selected-date-card');
		if (archive?.querySelector('[data-memory-word="true"]')) toolbar(archive);
	}

	function scan() {
		window.clearTimeout(timer);
		timer = window.setTimeout(decorate, 80);
	}

	function init() {
		injectStyle();
		decorate();
		new MutationObserver(scan).observe(document.querySelector('.jlpt-content') || document.body, { childList: true, subtree: true });
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
	else init();
})();
