(() => {
	'use strict';
	const ko = document.documentElement.lang === 'ko';
	const ui = {
		list: document.getElementById('basic-kanji-list'), search: document.getElementById('kanji-search'),
		group: document.getElementById('kanji-group'), state: document.getElementById('kanji-state'),
		total: document.getElementById('kanji-total-count'), mastered: document.getElementById('kanji-mastered-count'),
		save: document.getElementById('kanji-save-state'),
	};
	let rows = [], authenticated = false, saveTimer = 0, renderTimer = 0;
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
	window.addEventListener('pagehide', () => {
		if (!pending.size || !authenticated) return;
		const updates=[...pending.entries()].map(([kanji,state])=>({kanji,state}));
		navigator.sendBeacon('/api/japanese/basic-kanji', new Blob([JSON.stringify({updates})],{type:'application/json'}));
	});
	load();
})();
