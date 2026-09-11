(() => {
	'use strict';
	const ko = document.documentElement.lang === 'ko';
	const ui = {
		list: document.getElementById('basic-kanji-list'), search: document.getElementById('kanji-search'),
		group: document.getElementById('kanji-group'), state: document.getElementById('kanji-state'),
		total: document.getElementById('kanji-total-count'), mastered: document.getElementById('kanji-mastered-count'),
		save: document.getElementById('kanji-save-state'), memoryStart: document.getElementById('kanji-memory-start'),
	};
	let rows = [], authenticated = false, saveTimer = 0, renderTimer = 0;
	let memoryRows = [], memoryIndex = 0, memoryRevealed = false, memoryOverlay = null;
	const pending = new Map();
	const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
	const text = (kr, ja) => ko ? kr : ja;

	function searchable(row) { return [row.kanji,row.meaningKo,row.soundKo,row.meaningJa,row.onyomi,row.kunyomi,row.group,row.formationNoteKo,...row.componentForms,...row.exampleWords].join(' ').toLocaleLowerCase(); }
	function visibleRows() {
		const query = ui.search.value.trim().toLocaleLowerCase(), group = ui.group.value, state = ui.state.value;
		return rows.filter((row) => (!query || searchable(row).includes(query)) && (!group || row.group === group) && (!state || row.state === state))
			.sort((a,b) => (a.state === b.state ? a.order - b.order : a.state === 'unlearned' ? -1 : 1));
	}
	function render() {
		const filtered = visibleRows();
		ui.total.textContent = String(filtered.length);
		ui.mastered.textContent = `${rows.filter((row) => row.state === 'mastered').length} / ${rows.length}`;
		if (!filtered.length) { ui.list.innerHTML = `<div class="jp-card basic-kanji-empty">${text('조건에 맞는 한자가 없습니다.','条件に合う漢字がありません。')}</div>`; return; }
		ui.list.innerHTML = filtered.map((row) => `<article class="basic-kanji-card is-${row.state}" data-kanji="${esc(row.kanji)}">
			<div class="basic-kanji-glyph">${esc(row.kanji)}</div><div><div class="basic-kanji-top"><h2>${esc(row.meaningKo)} ${esc(row.soundKo)}</h2><span class="kanji-group-tag">${esc(row.group)}</span></div>
			<div class="basic-kanji-readings"><div><span>${text('일본식 뜻','日本語の意味')}</span><b>${esc(row.meaningJa || '—')}</b></div><div><span>${text('음독','音読み')}</span><b>${esc(row.onyomi || '—')}</b></div><div><span>${text('훈독','訓読み')}</span><b>${esc(row.kunyomi || '—')}</b></div></div>
			<div class="kanji-forms"><span class="kanji-group-tag">${text('조합 모양','部品の形')}</span>${row.componentForms.map((form) => `<span class="kanji-form">${esc(form)}</span>`).join('')}</div>
			<p class="kanji-formation">${esc(row.formationNoteKo || '')}</p><div class="kanji-examples">${row.exampleWords.map((word) => `<span class="kanji-example">${esc(word)}</span>`).join('')}</div></div>
			<button class="kanji-state-button" type="button">${row.state === 'mastered' ? text('암기 완료','暗記済み') : text('미암기','未暗記')}</button></article>`).join('');
	}
	function setSave(message, className = '') { ui.save.textContent = message; ui.save.className = className; }
	async function flush() {
		window.clearTimeout(saveTimer);
		if (!pending.size || !authenticated) return;
		const updates = [...pending.entries()].map(([kanji,state]) => ({ kanji,state })); pending.clear();
		setSave(text('저장 중…','保存中…'), 'kanji-saving');
		try {
			const response = await fetch('/api/japanese/basic-kanji', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({updates}), credentials:'same-origin', keepalive:true });
			if (!response.ok) throw new Error(String(response.status));
			setSave(text('자동 저장됨','自動保存済み'), 'kanji-saved');
		} catch (error) {
			updates.forEach((row) => pending.set(row.kanji,row.state));
			setSave(text('저장 실패 · 다시 시도합니다','保存失敗・再試行します'), 'basic-kanji-error');
			saveTimer = window.setTimeout(flush, 2500);
		}
	}
	function queue(row) { pending.set(row.kanji,row.state); window.clearTimeout(saveTimer); saveTimer = window.setTimeout(flush, 700); }
	function ensureMemoryOverlay() {
		if (memoryOverlay) return memoryOverlay;
		memoryOverlay = document.createElement('div'); memoryOverlay.id='kanji-memory-overlay'; memoryOverlay.className='kanji-memory-overlay'; memoryOverlay.hidden=true;
		memoryOverlay.innerHTML = `<section class="kanji-memory-panel" role="dialog" aria-modal="true" aria-label="${text('기초 한자 암기 모드','基礎漢字暗記モード')}">
			<div class="kanji-memory-head"><b data-memory-count></b><button class="kanji-memory-close" type="button" aria-label="${text('닫기','閉じる')}">×</button></div>
			<div class="kanji-memory-body"></div></section>`;
		document.body.appendChild(memoryOverlay);
		memoryOverlay.addEventListener('click', (event) => {
			if (event.target === memoryOverlay || event.target.closest('.kanji-memory-close')) return closeMemory();
			if (event.target.closest('.kanji-memory-reveal,.kanji-memory-glyph')) { memoryRevealed=true; renderMemory(); return; }
			const nav=event.target.closest('[data-memory-nav]'); if (nav) { moveMemory(Number(nav.dataset.memoryNav)); return; }
			const stateButton=event.target.closest('[data-memory-state]'); if (!stateButton) return;
			if (!authenticated) { setSave(text('관리자 로그인 후 저장할 수 있습니다.','管理者ログイン後に保存できます。'),'basic-kanji-login-warning'); return; }
			const row=memoryRows[memoryIndex]; if (!row) return; row.state=stateButton.dataset.memoryState; queue(row); render(); moveMemory(1);
		});
		return memoryOverlay;
	}
	function renderMemory() {
		const overlay=ensureMemoryOverlay(), body=overlay.querySelector('.kanji-memory-body'), count=overlay.querySelector('[data-memory-count]');
		if (!memoryRows.length) { count.textContent='0 / 0'; body.innerHTML=`<div class="kanji-memory-empty">${text('현재 조건에 맞는 한자가 없습니다.','現在の条件に合う漢字がありません。')}</div>`; return; }
		const row=memoryRows[memoryIndex]; count.textContent=`${memoryIndex+1} / ${memoryRows.length}`;
		body.innerHTML=`<div class="kanji-memory-glyph" role="button" tabindex="0">${esc(row.kanji)}</div>
			<button class="kanji-memory-reveal" type="button" ${memoryRevealed?'hidden':''}>${text('뜻과 읽기 보기','意味と読みを見る')}</button>
			<div class="kanji-memory-answer" ${memoryRevealed?'':'hidden'}><h2>${esc(row.meaningKo)} ${esc(row.soundKo)}</h2>
			<div class="basic-kanji-readings"><div><span>${text('일본식 뜻','日本語の意味')}</span><b>${esc(row.meaningJa||'—')}</b></div><div><span>${text('음독','音読み')}</span><b>${esc(row.onyomi||'—')}</b></div><div><span>${text('훈독','訓読み')}</span><b>${esc(row.kunyomi||'—')}</b></div></div>
			<div class="kanji-forms"><span class="kanji-group-tag">${text('조합 모양','部品の形')}</span>${row.componentForms.map((form)=>`<span class="kanji-form">${esc(form)}</span>`).join('')}</div><p class="kanji-formation">${esc(row.formationNoteKo||'')}</p><div class="kanji-examples">${row.exampleWords.map((word)=>`<span class="kanji-example">${esc(word)}</span>`).join('')}</div>
			<div class="kanji-memory-actions"><button class="kanji-memory-unlearned" data-memory-state="unlearned" type="button">${text('미암기','未暗記')}</button><button class="kanji-memory-mastered" data-memory-state="mastered" type="button">${text('암기 완료','暗記済み')}</button></div></div>
			<div class="kanji-memory-nav"><button data-memory-nav="-1" type="button">← ${text('이전','前へ')}</button><button data-memory-nav="1" type="button">${text('다음','次へ')} →</button></div>`;
	}
	function moveMemory(delta) { if (!memoryRows.length) return; memoryIndex=(memoryIndex+delta+memoryRows.length)%memoryRows.length; memoryRevealed=false; renderMemory(); }
	function openMemory() { memoryRows=visibleRows(); memoryIndex=0; memoryRevealed=false; ensureMemoryOverlay().hidden=false; document.body.style.overflow='hidden'; renderMemory(); }
	function closeMemory() { if (!memoryOverlay) return; memoryOverlay.hidden=true; document.body.style.overflow=''; flush(); }
	async function load() {
		try {
			const response = await fetch('/api/japanese/basic-kanji', { credentials:'same-origin' });
			const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || response.status);
			rows = data.kanji; authenticated = data.authenticated;
			[...new Set(rows.map((row) => row.group).filter(Boolean))].forEach((group) => { const option=document.createElement('option');option.value=group;option.textContent=group;ui.group.appendChild(option); });
			setSave(authenticated ? text('상태 자동 저장','状態を自動保存') : text('로그인하면 상태가 저장됩니다','ログインすると状態を保存できます'), authenticated ? '' : 'basic-kanji-login-warning');
			render();
		} catch (error) { ui.list.innerHTML=`<div class="jp-card basic-kanji-empty basic-kanji-error">${text('기초 한자를 불러오지 못했습니다. SQL 적용 여부를 확인해 주세요.','基礎漢字を読み込めませんでした。SQLの適用を確認してください。')}</div>`; setSave(text('불러오기 실패','読み込み失敗'),'basic-kanji-error'); }
	}
	ui.list.addEventListener('click', (event) => {
		const button = event.target.closest('.kanji-state-button'); if (!button) return;
		const card = button.closest('[data-kanji]'), row = rows.find((item) => item.kanji === card?.dataset.kanji); if (!row) return;
		if (!authenticated) { setSave(text('관리자 로그인 후 저장할 수 있습니다.','管理者ログイン後に保存できます。'),'basic-kanji-login-warning'); return; }
		row.state = row.state === 'mastered' ? 'unlearned' : 'mastered'; queue(row);
		window.clearTimeout(renderTimer); renderTimer = window.setTimeout(render, 180);
	});
	[ui.search,ui.group,ui.state].forEach((element) => element.addEventListener(element === ui.search ? 'input' : 'change', render));
	ui.memoryStart?.addEventListener('click', openMemory);
	window.addEventListener('keydown', (event) => {
		if (!memoryOverlay || memoryOverlay.hidden) return;
		if (event.key==='Escape') closeMemory(); else if (event.key==='ArrowLeft') moveMemory(-1); else if (event.key==='ArrowRight') moveMemory(1); else if ((event.key===' '||event.key==='Enter')&&!memoryRevealed) { event.preventDefault(); memoryRevealed=true; renderMemory(); }
	});
	window.addEventListener('pagehide', () => {
		if (!pending.size || !authenticated) return;
		const updates=[...pending.entries()].map(([kanji,state])=>({kanji,state}));
		navigator.sendBeacon('/api/japanese/basic-kanji', new Blob([JSON.stringify({updates})],{type:'application/json'}));
	});
	load();
})();
