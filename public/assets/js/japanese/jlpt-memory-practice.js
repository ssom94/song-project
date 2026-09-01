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
			.jlpt-memory-practice-toolbar button{border:1px solid #ccd6e3;border-radius:9px;background:#fff;padding:8px 12px;font:inherit;font-weight:850;cursor:pointer}
			.jlpt-memory-practice-toolbar button.is-active{background:#26364e;color:#fff;border-color:#26364e}
			.jlpt-memory-answer-input{display:none;width:100%;box-sizing:border-box;margin-top:8px;padding:9px 10px;border:1px solid #cdd7e4;border-radius:9px;background:#fff;font:inherit;font-size:13px}
			.jlpt-memory-practice-active .jlpt-memory-answer-input{display:block}
			.jlpt-memory-practice-active .jlpt-preview-word-grid > * > span,
			.jlpt-memory-practice-active .jlpt-preview-word-grid > * > p{visibility:hidden}
			.jlpt-memory-practice-active #jlpt-study-detail .jlpt-word-title span,
			.jlpt-memory-practice-active #jlpt-study-detail .jlpt-word-card > p,
			.jlpt-memory-practice-active #jlpt-study-detail .jlpt-kanji-korean{visibility:hidden}
			.jlpt-memory-practice-active .is-memory-input-revealed .jlpt-word-title span,
			.jlpt-memory-practice-active .is-memory-input-revealed > p,
			.jlpt-memory-practice-active .is-memory-input-revealed .jlpt-kanji-korean{visibility:visible}
			.jlpt-memory-practice-check{display:none;margin-top:6px;font-size:11px;font-weight:800;color:#59677b}
			.jlpt-memory-practice-active .jlpt-memory-practice-check{display:block}
		`;
		document.head.appendChild(style);
	}

	function answerForPreview(row) {
		const spans = [...row.querySelectorAll(':scope > span')];
		return (spans.at(-1)?.textContent || '').trim();
	}
	function answerForCard(card) {
		const p = card.querySelector(':scope > p');
		return (p?.textContent || '').trim();
	}
	function normalize(v) { return String(v || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase(); }

	function addInput(host, answer) {
		if (!(host instanceof HTMLElement) || host.querySelector(':scope > .jlpt-memory-answer-input')) return;
		const input = document.createElement('input');
		input.type = 'text';
		input.className = 'jlpt-memory-answer-input';
		input.placeholder = t('뜻을 입력하세요', '意味を入力してください');
		input.autocomplete = 'off';
		input.spellcheck = false;
		const result = document.createElement('div');
		result.className = 'jlpt-memory-practice-check';
		input.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter') return;
			event.preventDefault();
			const typed = normalize(input.value);
			const expected = normalize(answer);
			const ok = typed && expected && (typed === expected || expected.includes(typed) || typed.includes(expected));
			result.textContent = ok ? t('✓ 정답에 가깝습니다.', '✓ 正解に近いです。') : t(`정답: ${answer || '—'}`, `正解: ${answer || '—'}`);
			host.classList.add('is-memory-input-revealed');
		});
		host.append(input, result);
	}

	function decorate() {
		injectStyle();
		document.body.classList.toggle('jlpt-memory-practice-active', enabled);
		const preview = document.getElementById('jlpt-preview-content');
		if (preview) {
			let toolbar = preview.querySelector('.jlpt-memory-practice-toolbar');
			if (!(toolbar instanceof HTMLElement)) {
				toolbar = document.createElement('div');
				toolbar.className = 'jlpt-memory-practice-toolbar';
				const button = document.createElement('button');
				button.type = 'button';
				button.addEventListener('click', () => { enabled = !enabled; decorate(); if (enabled) preview.querySelector('.jlpt-memory-answer-input')?.focus(); });
				toolbar.appendChild(button);
				preview.prepend(toolbar);
			}
			const button = toolbar.querySelector('button');
			if (button) { button.textContent = enabled ? t('암기 연습 종료', '暗記練習を終了') : t('암기 연습', '暗記練習'); button.classList.toggle('is-active', enabled); }
			preview.querySelectorAll('.jlpt-preview-word-grid > *').forEach((row) => addInput(row, answerForPreview(row)));
		}
		document.querySelectorAll('#jlpt-study-detail .jlpt-word-card').forEach((card) => addInput(card, answerForCard(card)));
	}

	function scan() { clearTimeout(timer); timer = window.setTimeout(decorate, 80); }
	function init() {
		injectStyle(); decorate();
		new MutationObserver(scan).observe(document.querySelector('.jlpt-content') || document.body, { childList:true, subtree:true });
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init();
})();
