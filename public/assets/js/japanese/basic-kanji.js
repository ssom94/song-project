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
	let viewMode = 'kanji';
	const viewKanji=document.getElementById('kanji-view-kanji'), viewRadicals=document.getElementById('kanji-view-radicals');
	const RADICAL_STATE_KEY = 'song.basic-kanji.radical-states.v1';
	const KANGXI_RADICALS=Array.from({length:214},(_,index)=>String.fromCodePoint(0x2f00+index));
	let radicalMemoryRows=[], radicalMemoryIndex=0, radicalMemoryRevealed=false, radicalMemoryOverlay=null;
	let radicalStates={};
	const pendingRadicals=new Map(); let radicalSaveTimer=0;
	try { radicalStates=JSON.parse(localStorage.getItem(RADICAL_STATE_KEY)||'{}')||{}; } catch { radicalStates={}; }
	const RADICALS = [["人","亻","사람 인","にんべん","왼쪽","사람·행동","休|体|信|任","休暇|信任|責任"],["水","氵","물 수·삼수변","さんずい","왼쪽","물·액체·흐름","海|河|洗|深|流","海外|河川|洗濯|深刻|交流"],["火","灬","불 화·연화발","ひへん・れっか","왼쪽·아래","불·열·빛","焼|燃|照|熱","燃焼|照明|熱意"],["手","扌","손 수·재방변","てへん","왼쪽","손동작·조작","持|打|投|援","維持|打開|投入|支援"],["心","忄|⺗","마음 심·심방변","りっしんべん・したごころ","왼쪽·아래","감정·의지·정신","情|性|念|慮","感情|性質|概念|配慮"],["言","訁","말씀 언·말씀언변","ごんべん","왼쪽","말·의견·기록","語|説|議|認","語彙|説明|議論|認識"],["糸","糹","실 사·실사변","いとへん","왼쪽","실·연결·계통","組|結|統|緩","組織|結論|統制|緩和"],["金","釒","쇠 금·쇠금변","かねへん","왼쪽","금속·돈·도구","銀|鉄|録|針","銀行|製鉄|記録|方針"],["食","飠","먹을 식·밥식변","しょくへん","왼쪽","먹기·음식","飲|飯|館|養","飲食|炊飯|会館|栄養"],["示","礻","보일 시·보일시변","しめすへん","왼쪽","제사·신·의식","神|社|祈|福","神秘|社会|祈願|福祉"],["衣","衤","옷 의·옷의변","ころもへん","왼쪽","옷·덮기","被|補|裕|裁","被害|補足|余裕|裁判"],["犬","犭","개 견·개사슴록변","けものへん","왼쪽","동물·짐승","犯|状|独|獲","犯罪|状態|独立|獲得"],["艸","艹","풀 초·초두머리","くさかんむり","위","풀·식물·약품","花|草|薬|著","花壇|薬品|著書"],["刀","刂","칼 도·선칼도방","りっとう","오른쪽","자르기·분리","別|制|判|創","区別|制度|判断|創造"],["攴","攵","칠 복·등글월문","ぼくづくり・のぶん","오른쪽","치기·행동·변화","教|改|政|救","教育|改善|政策|救済"],["辵","辶","쉬엄쉬엄갈 착·책받침","しんにょう","왼쪽 아래","이동·진행·길","進|過|達|遺","進展|過程|達成|遺憾"],["阜","阝","언덕 부·좌부변","こざとへん","왼쪽","언덕·장소·단계","階|陸|限|際","階層|大陸|限界|国際"],["邑","阝","고을 읍·우부방","おおざと","오른쪽","마을·지역","部|都|郊|邦","部分|都市|近郊|連邦"],["肉","月","고기 육·육달월","にくづき","왼쪽·아래","몸·기관","胸|脳|肺|臓","胸中|頭脳|肺炎|内臓"],["玉","王","구슬 옥·구슬옥변","たまへん","왼쪽","보석·귀중함","理|現|環|珍","理論|現象|環境|珍重"],["网","罒","그물 망·그물망머리","あみがしら","위","그물·둘러싸기","罪|置|署|羅","犯罪|設置|署名|網羅"],["竹","⺮","대 죽·대죽머리","たけかんむり","위","대나무·도구·문서","筆|答|策|範","執筆|回答|政策|範囲"],["宀","宀","집 면·갓머리","うかんむり","위","집·지붕·안쪽","家|安|定|察","家計|安定|想定|観察"],["广","广","집 엄·엄호","まだれ","왼쪽 위","건물·공간","店|度|庁|廃","店舗|制度|官庁|廃止"],["囗","囗","에워쌀 위·큰입구몸","くにがまえ","둘러싸기","경계·영역","国|囲|団|圏","国家|範囲|団体|圏内"],["木","木","나무 목·나무목변","きへん","왼쪽","나무·재료·구조","林|材|構|権","森林|材料|構成|権利"],["日","日","날 일·날일변","ひへん","왼쪽","해·날·밝음","時|明|映|暦","時期|明白|反映|西暦"],["目","目","눈 목·눈목변","めへん","왼쪽","보기·눈·항목","眼|相|督|瞬","眼科|相違|監督|瞬間"],["足","⻊","발 족·발족변","あしへん","왼쪽","발·이동·충족","路|距|踏|躍","経路|距離|踏襲|活躍"],["車","車","수레 거·수레거변","くるまへん","왼쪽","차·운반·회전","転|輪|軌|輸","転換|車輪|軌道|輸送"]];

	const stateRank = { unlearned: 0, unsure: 1, mastered: 2 };
	const stateLabel = (state) => state === 'mastered' ? text('완료','完了') : state === 'unsure' ? text('애매함','曖昧') : text('미학습','未学習');
	function searchable(row) { return [row.kanji,row.meaningKo,row.soundKo,row.meaningJa,row.onyomi,row.kunyomi,row.group,row.compositionNoteKo,row.memoryTip,...row.componentForms,...row.components,...row.relatedWords.flatMap((item)=>[item.word,item.reading])].join(' ').toLocaleLowerCase(); }
	function visibleRows() {
		const query = ui.search.value.trim().toLocaleLowerCase(), group = ui.group.value, state = ui.state.value;
		return rows.filter((row) => (!query || searchable(row).includes(query)) && (!group || row.group === group) && (!state || row.state === state))
			.sort((a,b) => (stateRank[a.state]-stateRank[b.state]) || a.order-b.order);
	}
	function renderKanji() {
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
	function renderRadicals() {
		const query=ui.search.value.trim().toLocaleLowerCase(), selectedState=ui.state.value;
		const filtered=RADICALS.filter((row)=>{
			const state=radicalStates[row[0]]||'unlearned';
			return (!query||row.join(' ').toLocaleLowerCase().includes(query))&&(!selectedState||state===selectedState);
		}).sort((a,b)=>stateRank[radicalStates[a[0]]||'unlearned']-stateRank[radicalStates[b[0]]||'unlearned']);
		ui.total.textContent=String(filtered.length); ui.mastered.textContent=RADICALS.filter((row)=>(radicalStates[row[0]]||'unlearned')==='mastered').length+' / '+RADICALS.length;
		const detailed=filtered.map((row)=>{
			const [base,forms,nameKo,nameJa,position,meaning,kanji,words]=row;
			const state=radicalStates[base]||'unlearned';
			const variants=forms.split('|').map((form)=>'<span class="kanji-form">'+esc(form)+'</span>').join('');
			const usedKanji=kanji.split('|').map((item)=>'<span class="kanji-form">'+esc(item)+'</span>').join('');
			const related=words.split('|').map((item)=>'<a class="kanji-example" href="/'+(ko?'ko':'ja')+'/japanese/words/?q='+encodeURIComponent(item)+'">'+esc(item)+'</a>').join('');
			const actions=['unlearned','unsure','mastered'].map((value)=>'<button class="kanji-state-button is-'+value+(state===value?' is-active':'')+'" data-radical-state="'+value+'" type="button">'+stateLabel(value)+'</button>').join('');
			return '<article class="radical-card is-'+state+'" data-radical="'+esc(base)+'"><div class="radical-symbol"><strong>'+esc(base)+'</strong><span>→ '+variants+'</span></div><div><div class="basic-kanji-top"><h2>'+esc(ko?nameKo:nameJa)+'</h2><span class="kanji-group-tag">'+esc(position)+'</span></div><p class="radical-meaning"><b>'+text('기본 의미','基本意味')+'</b> '+esc(meaning)+'</p><div class="radical-flow"><span>'+esc(base)+'</span><b>→</b><span>'+variants+'</span><b>→</b><span>'+text('한자 속 위치에 맞게 좁아지거나 모양이 변합니다.','漢字内の位置に合わせて形が変わります。')+'</span></div><div class="kanji-examples"><b>'+text('활용 한자','使用漢字')+'</b>'+usedKanji+'</div><div class="kanji-examples"><b>'+text('관련 단어','関連語')+'</b>'+related+'</div></div><div class="kanji-state-actions">'+actions+'</div></article>';
		}).join('') || '<div class="jp-card basic-kanji-empty">'+text('조건에 맞는 핵심 부수가 없습니다.','条件に合う主要部首がありません。')+'</div>';
		const reference=!query&&!selectedState?'<section class="jp-card radical-reference"><div><h2>'+text('전체 214부수 참고 목록','全214部首一覧')+'</h2><p>'+text('먼저 아래 핵심 부수 30개를 학습하고, 전체 모양은 필요할 때 찾아보세요.','まず下の主要30部首を学び、全体の形は必要な時に参照してください。')+'</p></div><div class="radical-reference-grid">'+KANGXI_RADICALS.map((glyph,index)=>'<span title="'+text((index+1)+'번 부수','部首 '+(index+1))+'">'+esc(glyph)+'</span>').join('')+'</div></section>':'';
		ui.list.innerHTML=reference+detailed;
	}
	function render() {
		const radical=viewMode==='radicals'; viewKanji?.classList.toggle('is-active',!radical); viewRadicals?.classList.toggle('is-active',radical);
		ui.group.hidden=radical; ui.state.hidden=false; ui.memoryStart.hidden=false;
		ui.memoryStart.textContent=radical?text('부수 암기 모드','部首暗記モード'):text('암기 모드','暗記モード');
		radical ? renderRadicals() : renderKanji();
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
	async function flushRadicalStates() {
		window.clearTimeout(radicalSaveTimer);
		if(!pendingRadicals.size||!authenticated)return;
		const radicalUpdates=[...pendingRadicals.entries()].map(([radical,state])=>({radical,state})); pendingRadicals.clear();
		setSave(text('부수 상태 저장 중…','部首状態を保存中…'),'kanji-saving');
		try {
			const response=await fetch('/api/japanese/basic-kanji',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({radicalUpdates}),credentials:'same-origin',keepalive:true});
			if(!response.ok)throw new Error(String(response.status)); setSave(text('부수 상태 자동 저장됨','部首状態を自動保存しました'),'kanji-saved');
		} catch(error) { radicalUpdates.forEach((row)=>pendingRadicals.set(row.radical,row.state)); setSave(text('부수 상태 저장 실패 · 다시 시도합니다','部首状態の保存失敗・再試行します'),'basic-kanji-error'); radicalSaveTimer=window.setTimeout(flushRadicalStates,2500); }
	}
	function saveRadicalState(base,state) { radicalStates[base]=state; localStorage.setItem(RADICAL_STATE_KEY,JSON.stringify(radicalStates)); if(authenticated){pendingRadicals.set(base,state);window.clearTimeout(radicalSaveTimer);radicalSaveTimer=window.setTimeout(flushRadicalStates,700);} }
	function ensureRadicalMemoryOverlay() {
		if (radicalMemoryOverlay) return radicalMemoryOverlay;
		radicalMemoryOverlay=document.createElement('div'); radicalMemoryOverlay.className='kanji-memory-overlay'; radicalMemoryOverlay.hidden=true;
		radicalMemoryOverlay.innerHTML='<section class="kanji-memory-panel" role="dialog" aria-modal="true"><div class="kanji-memory-head"><b data-radical-memory-count></b><button class="kanji-memory-close" type="button">×</button></div><div class="kanji-memory-body"></div></section>';
		document.body.appendChild(radicalMemoryOverlay);
		radicalMemoryOverlay.addEventListener('click',(event)=>{
			if(event.target===radicalMemoryOverlay||event.target.closest('.kanji-memory-close')) return closeRadicalMemory();
			if(event.target.closest('.kanji-memory-reveal,.radical-memory-symbol')) { radicalMemoryRevealed=true; renderRadicalMemory(); return; }
			const nav=event.target.closest('[data-radical-memory-nav]'); if(nav) { moveRadicalMemory(Number(nav.dataset.radicalMemoryNav)); return; }
			const stateButton=event.target.closest('[data-radical-memory-state]'); if(!stateButton) return;
			const row=radicalMemoryRows[radicalMemoryIndex]; if(!row) return; saveRadicalState(row[0],stateButton.dataset.radicalMemoryState); render(); moveRadicalMemory(1);
		});
		return radicalMemoryOverlay;
	}
	function renderRadicalMemory() {
		const overlay=ensureRadicalMemoryOverlay(),body=overlay.querySelector('.kanji-memory-body'),count=overlay.querySelector('[data-radical-memory-count]');
		if(!radicalMemoryRows.length){count.textContent='0 / 0';body.innerHTML='<div class="kanji-memory-empty">'+text('현재 조건에 맞는 부수가 없습니다.','現在の条件に合う部首がありません。')+'</div>';return;}
		const [base,forms,nameKo,nameJa,position,meaning,kanji,words]=radicalMemoryRows[radicalMemoryIndex]; count.textContent=(radicalMemoryIndex+1)+' / '+radicalMemoryRows.length;
		body.innerHTML='<div class="radical-memory-symbol" role="button" tabindex="0">'+esc(base)+'</div><button class="kanji-memory-reveal" type="button" '+(radicalMemoryRevealed?'hidden':'')+'>'+text('이름·변형 보기','名前・変形を見る')+'</button><div class="kanji-memory-answer" '+(radicalMemoryRevealed?'':'hidden')+'><h2>'+esc(ko?nameKo:nameJa)+'</h2><p class="kanji-memory-clue">'+esc(base)+' → '+esc(forms)+' · '+esc(position)+' · '+esc(meaning)+'</p><div class="kanji-examples">'+kanji.split('|').map((item)=>'<span class="kanji-form">'+esc(item)+'</span>').join('')+'</div><div class="kanji-examples">'+words.split('|').map((item)=>'<span class="kanji-example">'+esc(item)+'</span>').join('')+'</div><div class="kanji-memory-actions"><button class="kanji-memory-unlearned" data-radical-memory-state="unlearned" type="button">'+stateLabel('unlearned')+'</button><button class="kanji-memory-unsure" data-radical-memory-state="unsure" type="button">'+stateLabel('unsure')+'</button><button class="kanji-memory-mastered" data-radical-memory-state="mastered" type="button">'+stateLabel('mastered')+'</button></div></div><div class="kanji-memory-nav"><button data-radical-memory-nav="-1" type="button">← '+text('이전','前へ')+'</button><button data-radical-memory-nav="1" type="button">'+text('다음','次へ')+' →</button></div>';
	}
	function moveRadicalMemory(delta){if(!radicalMemoryRows.length)return;radicalMemoryIndex=(radicalMemoryIndex+delta+radicalMemoryRows.length)%radicalMemoryRows.length;radicalMemoryRevealed=false;renderRadicalMemory();}
	function openRadicalMemory(){radicalMemoryRows=RADICALS.filter((row)=>!ui.state.value||(radicalStates[row[0]]||'unlearned')===ui.state.value).sort((a,b)=>stateRank[radicalStates[a[0]]||'unlearned']-stateRank[radicalStates[b[0]]||'unlearned']);radicalMemoryIndex=0;radicalMemoryRevealed=false;ensureRadicalMemoryOverlay().hidden=false;document.body.style.overflow='hidden';renderRadicalMemory();}
	function closeRadicalMemory(){if(!radicalMemoryOverlay)return;radicalMemoryOverlay.hidden=true;document.body.style.overflow='';}
	async function load() {
		try {
			const requestedKanji=new URLSearchParams(window.location.search).get('kanji')?.trim()||'';
			const response = await fetch(`/api/japanese/basic-kanji${requestedKanji?`?kanji=${encodeURIComponent(requestedKanji)}`:''}`, { credentials:'same-origin' });
			const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || response.status);
			rows = data.kanji; authenticated = data.authenticated;
			radicalStates={...radicalStates,...(data.radicalStates||{})}; localStorage.setItem(RADICAL_STATE_KEY,JSON.stringify(radicalStates));
			if (requestedKanji) { ui.search.value=requestedKanji; document.title=`${requestedKanji} | ${text('기초 한자 학습','基礎漢字学習')} | SONG`; }
			[...new Set(rows.map((row) => row.group).filter(Boolean))].forEach((group) => { const option=document.createElement('option');option.value=group;option.textContent=group;ui.group.appendChild(option); });
			setSave(authenticated ? text('상태 자동 저장','状態を自動保存') : text('로그인하면 상태가 저장됩니다','ログインすると状態を保存できます'), authenticated ? '' : 'basic-kanji-login-warning');
			render();
		} catch (error) { ui.list.innerHTML=`<div class="jp-card basic-kanji-empty basic-kanji-error">${text('기초 한자를 불러오지 못했습니다. SQL 적용 여부를 확인해 주세요.','基礎漢字を読み込めませんでした。SQLの適用を確認してください。')}</div>`; setSave(text('불러오기 실패','読み込み失敗'),'basic-kanji-error'); }
	}
	ui.list.addEventListener('click', (event) => {
		const radicalButton=event.target.closest('[data-radical-state]');
		if(radicalButton){const card=radicalButton.closest('[data-radical]');if(card){saveRadicalState(card.dataset.radical,radicalButton.dataset.radicalState);render();}return;}
		const button = event.target.closest('.kanji-state-button'); if (!button) return;
		const card = button.closest('[data-kanji]'), row = rows.find((item) => item.kanji === card?.dataset.kanji); if (!row) return;
		if (!authenticated) { setSave(text('관리자 로그인 후 저장할 수 있습니다.','管理者ログイン後に保存できます。'),'basic-kanji-login-warning'); return; }
		row.state = button.dataset.state; queue(row);
		window.clearTimeout(renderTimer); renderTimer = window.setTimeout(render, 180);
	});
	[ui.search,ui.group,ui.state].forEach((element) => element.addEventListener(element === ui.search ? 'input' : 'change', render));
	viewKanji?.addEventListener('click',()=>{viewMode='kanji';render();});
	viewRadicals?.addEventListener('click',()=>{viewMode='radicals';render();});
	ui.memoryStart?.addEventListener('click', ()=>viewMode==='radicals'?openRadicalMemory():openMemory());
	window.addEventListener('keydown', (event) => {
		if (radicalMemoryOverlay && !radicalMemoryOverlay.hidden) {
			if (event.key==='Escape') closeRadicalMemory(); else if (event.key==='ArrowLeft') moveRadicalMemory(-1); else if (event.key==='ArrowRight') moveRadicalMemory(1); else if ((event.key===' '||event.key==='Enter')&&!radicalMemoryRevealed) { event.preventDefault(); radicalMemoryRevealed=true; renderRadicalMemory(); }
			return;
		}
		if (!memoryOverlay || memoryOverlay.hidden) return;
		if (event.key==='Escape') closeMemory(); else if (event.key==='ArrowLeft') moveMemory(-1); else if (event.key==='ArrowRight') moveMemory(1); else if ((event.key===' '||event.key==='Enter')&&!memoryRevealed) { event.preventDefault(); memoryRevealed=true; renderMemory(); }
	});
	window.addEventListener('pagehide', () => {
		if(pendingRadicals.size&&authenticated){const radicalUpdates=[...pendingRadicals.entries()].map(([radical,state])=>({radical,state}));navigator.sendBeacon('/api/japanese/basic-kanji',new Blob([JSON.stringify({radicalUpdates})],{type:'application/json'}));}
		if (!pending.size || !authenticated) return;
		const updates=[...pending.entries()].map(([kanji,state])=>({kanji,state}));
		navigator.sendBeacon('/api/japanese/basic-kanji', new Blob([JSON.stringify({updates})],{type:'application/json'}));
	});
	load();
})();
