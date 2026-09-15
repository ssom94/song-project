(function () {
	'use strict';
	const root = document.querySelector('[data-jlpt-catalog]');
	if (!root) return;
	const ko = document.documentElement.lang === 'ko';
	const list = document.getElementById('jlpt-catalog-list');
	const summary = document.getElementById('jlpt-catalog-summary');
	const pageLabel = document.getElementById('jlpt-catalog-page');
	const previous = document.getElementById('jlpt-catalog-prev');
	const next = document.getElementById('jlpt-catalog-next');
	const sizeSelect = document.getElementById('jlpt-catalog-size');
	const memoryButton = document.getElementById('jlpt-catalog-memory');
	const toolbar = root.querySelector('.jlpt-catalog-toolbar');
	const writer = document.getElementById('jlpt-word-writer');
	const canvas = document.getElementById('jlpt-word-writer-canvas');
	const target = document.getElementById('jlpt-word-writer-target');
	let page = 1;
	let pageSize = Number(localStorage.getItem('jlptCatalogPageSize')) || 50;
	let total = null;
	let canEdit = false;
	let words = [];
	let group = new URLSearchParams(location.search).get('group') || '';
	let drawing = false;
	let context = null;

	function escapeHtml(value) {
		return String(value == null ? '' : value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
	}
	function totalPages() { return Math.max(1, Math.ceil((total || 0) / pageSize)); }
	function header() {
		return `<div class="jlpt-catalog-row jlpt-catalog-head"><div class="jlpt-catalog-cell">${ko ? '번호' : '番号'}</div><div class="jlpt-catalog-cell">${ko ? '일본어' : '日本語'}</div><div class="jlpt-catalog-cell jlpt-catalog-fact">${ko ? '히라가나' : '読み'}</div><div class="jlpt-catalog-cell jlpt-catalog-fact">${ko ? '한글 뜻' : '韓国語の意味'}</div><div class="jlpt-catalog-cell jlpt-catalog-fact">${ko ? '등록 날짜' : '登録日'}</div><div class="jlpt-catalog-cell jlpt-catalog-memory-fields">${ko ? '읽기 입력' : '読み入力'}</div><div class="jlpt-catalog-cell jlpt-catalog-memory-fields">${ko ? '뜻 입력' : '意味入力'}</div><div class="jlpt-catalog-cell jlpt-catalog-memory-fields">${ko ? '암기완료' : '暗記完了'}</div><div class="jlpt-catalog-cell jlpt-catalog-memory-fields">${ko ? '쓰기' : '書く'}</div></div>`;
	}
	function render() {
		if (!words.length) {
			list.innerHTML = header() + `<div class="jlpt-catalog-empty">${ko ? '등록된 JLPT 단어가 없습니다.' : '登録されたJLPT単語がありません。'}</div>`;
		} else {
			list.innerHTML = header() + words.map((word) => `<div class="jlpt-catalog-row" data-word-id="${word.id}"><div class="jlpt-catalog-cell jlpt-catalog-number">${word.number}</div><div class="jlpt-catalog-cell jlpt-catalog-word" title="${escapeHtml(word.word)}"><a href="/${ko ? 'ko' : 'ja'}/japanese/words/detail/?id=${word.id}&word=${encodeURIComponent(word.word)}">${escapeHtml(word.word)}</a></div><div class="jlpt-catalog-cell jlpt-catalog-fact" title="${escapeHtml(word.reading)}">${escapeHtml(word.reading)}</div><div class="jlpt-catalog-cell jlpt-catalog-fact" title="${escapeHtml(word.meaningKo)}">${escapeHtml(word.meaningKo)}</div><div class="jlpt-catalog-cell jlpt-catalog-date jlpt-catalog-fact">${escapeHtml(word.introducedOn || '—')}</div><div class="jlpt-catalog-cell jlpt-catalog-memory-fields"><input class="jlpt-catalog-answer" data-answer="reading" autocomplete="off" aria-label="${ko ? '히라가나 입력' : '読み入力'}" /></div><div class="jlpt-catalog-cell jlpt-catalog-memory-fields"><input class="jlpt-catalog-answer" data-answer="meaning" autocomplete="off" aria-label="${ko ? '한글 뜻 입력' : '韓国語の意味入力'}" /></div><div class="jlpt-catalog-cell jlpt-catalog-check jlpt-catalog-memory-fields"><input type="checkbox" data-mastered ${word.learningState === 'mastered' ? 'checked' : ''} ${canEdit ? '' : 'disabled'} aria-label="${ko ? '암기완료' : '暗記完了'}" /></div><div class="jlpt-catalog-cell jlpt-catalog-memory-fields"><button class="jlpt-catalog-pen" type="button" data-write="${escapeHtml(word.word)}" aria-label="${ko ? '쓰기 연습' : '書き取り練習'}">✎</button></div></div>`).join('');
		}
		pageLabel.textContent = `${page} / ${totalPages()}`;
		previous.disabled = page <= 1;
		next.disabled = page >= totalPages();
		summary.textContent = total == null ? '' : (ko ? `DB에 등록된 JLPT 커리큘럼 단어 ${total.toLocaleString()}개` : `DB登録済みJLPTカリキュラム単語 ${total.toLocaleString()}語`);
	}
	async function load(includeTotal) {
		list.innerHTML = `<div class="jlpt-catalog-empty">${ko ? '단어를 불러오는 중입니다.' : '単語を読み込んでいます。'}</div>`;
		const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), includeTotal: includeTotal ? '1' : '0', group });
		try {
			const response = await fetch(`/api/public/japanese/jlpt/words?${params}`, { credentials: 'same-origin' });
			const data = await response.json();
			if (!response.ok || !data.ok) throw new Error(data.error || 'LOAD_FAILED');
			if (data.total != null) total = data.total;
			words = data.words || [];
			canEdit = Boolean(data.canEdit);
			render();
		} catch (error) {
			list.innerHTML = `<div class="jlpt-catalog-empty">${ko ? 'JLPT 단어를 불러오지 못했습니다.' : 'JLPT単語を読み込めませんでした。'}</div>`;
		}
	}
	function normalize(value) { return String(value || '').trim().replace(/[・,、]/g, ' ').replace(/\s+/g, ' '); }
	function evaluate(input) {
		const row = input.closest('[data-word-id]');
		const word = words.find((item) => item.id === Number(row.dataset.wordId));
		if (!word || !input.value.trim()) { input.classList.remove('is-correct', 'is-wrong'); return; }
		const expected = input.dataset.answer === 'reading' ? word.reading : word.meaningKo;
		const choices = normalize(expected).split(/[\/;]| 또는 | 혹은 /).map(normalize).filter(Boolean);
		const correct = choices.some((choice) => normalize(input.value) === choice) || normalize(input.value) === normalize(expected);
		input.classList.toggle('is-correct', correct); input.classList.toggle('is-wrong', !correct);
	}
	async function saveMastered(input) {
		const wordId = Number(input.closest('[data-word-id]').dataset.wordId);
		const state = input.checked ? 'mastered' : 'unlearned';
		input.disabled = true;
		try {
			const response = await fetch('/api/admin/japanese/jlpt/word-state', { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wordId, state }) });
			if (!response.ok) throw new Error('SAVE_FAILED');
			const word = words.find((item) => item.id === wordId); if (word) word.learningState = state;
		} catch (error) { input.checked = !input.checked; alert(ko ? '암기 상태를 저장하지 못했습니다.' : '暗記状態を保存できませんでした。'); }
		finally { input.disabled = !canEdit; }
	}
	function prepareCanvas() {
		const rect = canvas.getBoundingClientRect(); const ratio = window.devicePixelRatio || 1;
		canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio);
		context = canvas.getContext('2d'); context.scale(ratio, ratio); context.lineWidth = 5; context.lineCap = 'round'; context.lineJoin = 'round'; context.strokeStyle = '#17253b';
	}
	function point(event) { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
	function openWriter(word) { target.textContent = word; writer.hidden = false; document.body.style.overflow = 'hidden'; requestAnimationFrame(prepareCanvas); }
	function closeWriter() { writer.hidden = true; document.body.style.overflow = ''; }
	list.addEventListener('input', (event) => { if (event.target.matches('[data-answer]')) evaluate(event.target); });
	list.addEventListener('change', (event) => { if (event.target.matches('[data-mastered]')) saveMastered(event.target); });
	list.addEventListener('click', (event) => { const button = event.target.closest('[data-write]'); if (button) openWriter(button.dataset.write); });
	memoryButton.addEventListener('click', () => { const active = root.classList.toggle('is-memory-mode'); memoryButton.classList.toggle('is-active', active); memoryButton.setAttribute('aria-pressed', String(active)); });
	const groupSelect = document.createElement('select');
	groupSelect.id = 'jlpt-catalog-group';
	groupSelect.setAttribute('aria-label', ko ? '품사 모음 선택' : '品詞コレクション選択');
	groupSelect.innerHTML = `<option value="">${ko ? '전체 품사' : '全品詞'}</option><option value="noun">${ko ? '명사 모음' : '名詞集'}</option><option value="verb">${ko ? '동사 모음' : '動詞集'}</option><option value="adjective-adverb">${ko ? '형용사·부사' : '形容詞・副詞集'}</option><option value="unclassified">${ko ? '미분류' : '未分類'}</option>`;
	if (![...groupSelect.options].some((option) => option.value === group)) group = '';
	groupSelect.value = group;
	toolbar.insertBefore(groupSelect, toolbar.querySelector('.jlpt-catalog-pager'));
	groupSelect.addEventListener('change', () => {
		group = groupSelect.value; page = 1; total = null;
		const url = new URL(location.href); if (group) url.searchParams.set('group', group); else url.searchParams.delete('group'); history.replaceState(null, '', url);
		load(true);
	});
	previous.addEventListener('click', () => { if (page > 1) { page -= 1; load(false); } });
	next.addEventListener('click', () => { if (page < totalPages()) { page += 1; load(false); } });
	sizeSelect.value = String(pageSize);
	sizeSelect.addEventListener('change', () => { pageSize = Number(sizeSelect.value); page = 1; total = null; localStorage.setItem('jlptCatalogPageSize', String(pageSize)); load(true); });
	writer.addEventListener('click', (event) => { if (event.target === writer || event.target.closest('[data-writer-close]')) closeWriter(); if (event.target.closest('[data-writer-clear]')) prepareCanvas(); });
	canvas.addEventListener('pointerdown', (event) => { drawing = true; canvas.setPointerCapture(event.pointerId); const p = point(event); context.beginPath(); context.moveTo(p.x, p.y); });
	canvas.addEventListener('pointermove', (event) => { if (!drawing) return; const p = point(event); context.lineTo(p.x, p.y); context.stroke(); });
	['pointerup', 'pointercancel'].forEach((name) => canvas.addEventListener(name, () => { drawing = false; }));
	document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !writer.hidden) closeWriter(); });
	load(true);
})();
