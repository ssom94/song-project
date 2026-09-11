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
	let memoryRows = [], memoryIndex = 0, memoryRevealed = false, memoryMode = 'meaning', memoryOverlay = null;
	const pending = new Map();
	const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
	const text = (kr, ja) => ko ? kr : ja;

	const stateRank = { unlearned: 0, unsure: 1, mastered: 2 };
	const stateLabel = (state) => state === 'mastered' ? text('완료','完了') : state === 'unsure' ? text('애매함','曖昧') : text('미학습','未学習');
	function searchable(row) { return [row.kanji,row.meaningKo,row.soundKo,row.meaningJa,row.onyomi,row.kunyomi,row.group,row.compositionNoteKo,row.memoryTip,...row.componentForms,...row.components,...row.relatedWords.flatMap((item)=>[item.word,item.reading])].join(' ').toLocaleLowerCase(); }
	function visibleRows() {
		const query = ui.search.value.trim().toLocaleLowerCase(), group = ui.group.value, state = ui.state.value;
		return rows.filter((row) => (!query || searchable(row).includes(query)) && (!group || row.group === group) && (!state || row.state === state))
			.sort((a,b) => (stateRank[a.state]-stateRank[b.state]) || a.order-b.order);
	}
	function render() {
		const filtered = visibleRows();
		ui.total.textContent = String(filtered.length);
		ui.mastered.textContent = `${rows.filter((row) => row.state === 'mastered').length} / ${rows.length}`;
		if (!filtered.length) { ui.list.innerHTML = `<div class="jp-card basic-kanji-empty">${text('조건에 맞는 한자가 없습니다.','条件に合う漢字がありません。')}</div>`; return; }
		ui.list.innerHTML = filtered.map((row) => `<article class="basic-kanji-card is-${row.state}" data-kanji="${esc(row.kanji)}">
			<a class="basic-kanji-glyph" href="/${ko?'ko':'ja'}/japanese/kanji-basics/?kanji=${encodeURIComponent(row.kanji)}" aria-label="${esc(row.kanji)} ${text('상세','詳細')}">${esc(row.kanji)}</a><div><div class="basic-kanji-top"><h2>${esc(row.meaningKo)} ${esc(row.soundKo)}</h2><span class="kanji-group-tag">${esc(row.group)}</span></div>
			<div class="basic-kanji-readings"><div><span>${text('일본식 뜻','日本語の意味')}</span><b>${esc(row.meaningJa || '—')}</b></div><div><span>${text('음독','音読み')}</span><b>${esc(row.onyomi || '—')}</b></div><div><span>${text('훈독','訓読み')}</span><b>${esc(row.kunyomi || '—')}</b></div></div>
			<div class="kanji-forms"><span class="kanji-group-tag">${text('구성','構成')}</span>${row.components.map((form) => `<span class="kanji-form">${esc(form)}</span>`).join('')}<span class="kanji-group-tag">${text('변형','変形')}</span>${row.componentForms.map((form) => `<span class="kanji-form">${esc(form)}</span>`).join('')}</div>
			<p class="kanji-formation"><b>${text('조합 원리','組み合わせ')}</b> ${esc(row.compositionNoteKo || '—')}</p><p class="kanji-memory-tip"><b>${text('암기 팁','暗記のコツ')}</b> ${esc(row.memoryTip || '—')}</p><div class="kanji-examples">${row.relatedWords.map((item) => `<a class="kanji-example" href="/${ko?'ko':'ja'}/japanese/words/detail/?word=${encodeURIComponent(item.word)}">${esc(item.word)}${item.reading?` (${esc(item.reading)})`:''}</a>`).join('')}</div></div>
			<div class="kanji-state-actions" aria-label="${text('학습 상태','学習状態')}">${['unlearned','unsure','mastered'].map((state)=>`<button class="kanji-state-button is-${state}${row.state===state?' is-active':''}" data-state="${state}" type="button">${stateLabel(state)}</button>`).join('')}</div></article>`).join('');
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
			<div class="kanji-memory-head"><b data-memory-count></b><button class="kanji-memory-close" type="button" aria-label="${text('닫기','閉じる')}">×</button></div><div class="kanji-memory-types">${[['meaning','뜻'],['reading','읽기'],['components','구성']].map(([mode,label])=>`<button data-memory-mode="${mode}" type="button">${text(label,mode==='meaning'?'意味':mode==='reading'?'読み':'構成')}</button>`).join('')}</div>
			<div class="kanji-memory-body"></div></section>`;
		document.body.appendChild(memoryOverlay);
		memoryOverlay.addEventListener('click', (event) => {
			if (event.target === memoryOverlay || event.target.closest('.kanji-memory-close')) return closeMemory();
			const modeButton=event.target.closest('[data-memory-mode]'); if (modeButton) { memoryMode=modeButton.dataset.memoryMode; memoryRevealed=false; renderMemory(); return; }
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
		overlay.querySelectorAll('[data-memory-mode]').forEach((button)=>button.classList.toggle('is-active',button.dataset.memoryMode===memoryMode));
		const prompt = memoryMode==='components'
			? `<div class="kanji-memory-component-prompt"><small>${text('이 구성으로 만들어진 한자는?','この構成からできる漢字は？')}</small><strong>${row.components.map(esc).join(' + ')}</strong></div>`
			: `<div class="kanji-memory-glyph" role="button" tabindex="0">${esc(row.kanji)}</div>${memoryMode==='reading'?`<p class="kanji-memory-clue">${esc(row.meaningKo)} ${esc(row.soundKo)}</p>`:''}`;
		body.innerHTML=`${prompt}
			<button class="kanji-memory-reveal" type="button" ${memoryRevealed?'hidden':''}>${text('정답 보기','答えを見る')}</button>
			<div class="kanji-memory-answer" ${memoryRevealed?'':'hidden'}><h2>${esc(row.meaningKo)} ${esc(row.soundKo)}</h2>
			<div class="basic-kanji-readings"><div><span>${text('일본식 뜻','日本語の意味')}</span><b>${esc(row.meaningJa||'—')}</b></div><div><span>${text('음독','音読み')}</span><b>${esc(row.onyomi||'—')}</b></div><div><span>${text('훈독','訓読み')}</span><b>${esc(row.kunyomi||'—')}</b></div></div>
			<div class="kanji-forms"><span class="kanji-group-tag">${text('구성','構成')}</span>${row.components.map((form)=>`<span class="kanji-form">${esc(form)}</span>`).join('')}</div><p class="kanji-formation">${esc(row.compositionNoteKo||'')}</p><p class="kanji-memory-tip">${esc(row.memoryTip||'')}</p><div class="kanji-examples">${row.relatedWords.map((item)=>`<span class="kanji-example">${esc(item.word)}${item.reading?` (${esc(item.reading)})`:''}</span>`).join('')}</div>
			<div class="kanji-memory-actions"><button class="kanji-memory-unlearned" data-memory-state="unlearned" type="button">${text('미학습','未学習')}</button><button class="kanji-memory-unsure" data-memory-state="unsure" type="button">${text('애매함','曖昧')}</button><button class="kanji-memory-mastered" data-memory-state="mastered" type="button">${text('완료','完了')}</button></div></div>
			<div class="kanji-memory-nav"><button data-memory-nav="-1" type="button">← ${text('이전','前へ')}</button><button data-memory-nav="1" type="button">${text('다음','次へ')} →</button></div>`;
	}
	function moveMemory(delta) { if (!memoryRows.length) return; memoryIndex=(memoryIndex+delta+memoryRows.length)%memoryRows.length; memoryRevealed=false; renderMemory(); }
	function openMemory() { memoryRows=visibleRows(); memoryIndex=0; memoryRevealed=false; ensureMemoryOverlay().hidden=false; document.body.style.overflow='hidden'; renderMemory(); }
	function closeMemory() { if (!memoryOverlay) return; memoryOverlay.hidden=true; document.body.style.overflow=''; flush(); }
	async function load() {
		try {
			const requestedKanji=new URLSearchParams(window.location.search).get('kanji')?.trim()||'';
			const response = await fetch(`/api/japanese/basic-kanji${requestedKanji?`?kanji=${encodeURIComponent(requestedKanji)}`:''}`, { credentials:'same-origin' });
			const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || response.status);
			rows = data.kanji; authenticated = data.authenticated;
			if (requestedKanji) { ui.search.value=requestedKanji; document.title=`${requestedKanji} | ${text('기초 한자 학습','基礎漢字学習')} | SONG`; }
			[...new Set(rows.map((row) => row.group).filter(Boolean))].forEach((group) => { const option=document.createElement('option');option.value=group;option.textContent=group;ui.group.appendChild(option); });
			setSave(authenticated ? text('상태 자동 저장','状態を自動保存') : text('로그인하면 상태가 저장됩니다','ログインすると状態を保存できます'), authenticated ? '' : 'basic-kanji-login-warning');
			render();
		} catch (error) { ui.list.innerHTML=`<div class="jp-card basic-kanji-empty basic-kanji-error">${text('기초 한자를 불러오지 못했습니다. SQL 적용 여부를 확인해 주세요.','基礎漢字を読み込めませんでした。SQLの適用を確認してください。')}</div>`; setSave(text('불러오기 실패','読み込み失敗'),'basic-kanji-error'); }
	}
	ui.list.addEventListener('click', (event) => {
		const button = event.target.closest('.kanji-state-button'); if (!button) return;
		const card = button.closest('[data-kanji]'), row = rows.find((item) => item.kanji === card?.dataset.kanji); if (!row) return;
		if (!authenticated) { setSave(text('관리자 로그인 후 저장할 수 있습니다.','管理者ログイン後に保存できます。'),'basic-kanji-login-warning'); return; }
		row.state = button.dataset.state; queue(row);
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
