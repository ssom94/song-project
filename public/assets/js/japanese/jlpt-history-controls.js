(() => {
	const PRACTICE_API = '/api/public/japanese/jlpt/practice';
	const GRADE_API = '/api/public/japanese/jlpt/practice/grade';
	const WRONG_API = '/api/admin/japanese/jlpt/wrong-notes';
	const HISTORICAL_WORD_API = '/api/admin/japanese/jlpt/history/word-state';
	const PAGE_SIZE = 10;
	const DATE_NAV_MINIMIZED_KEY = 'song_jlpt_date_nav_minimized_v1';
	const isJa = document.body.dataset.blogLanguage === 'ja';
	const t = (ko, ja) => isJa ? ja : ko;
	let selectedDate = jstToday();
	let calendarPreviewDate = '';
	let wrongResolved = false;
	let wrongPage = 1;
	let wrongItems = [];
	let archiveWords = [];
	let archiveWordList = null;
	let archiveWordRender = null;
	let archiveWordFilter = 'all';
	const archivePendingStates = new Map();
	let archiveStatesSaving = false;

	function jstToday() {
		return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
	}
	function addDays(text, amount) {
		const [y, m, d] = text.split('-').map(Number);
		const date = new Date(Date.UTC(y, m - 1, d + amount));
		return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
	}
	function escapeHtml(value) {
		return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
	}
	async function requestJson(url, options = {}) {
		const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
		const data = await response.json().catch(() => null);
		if (!response.ok || !data?.ok) throw Object.assign(new Error(data?.error || `HTTP_${response.status}`), { status: response.status });
		return data;
	}
	function stateLabel(state) {
		if (state === 'mastered') return t('외움', '覚えた');
		if (state === 'uncertain') return t('애매함', 'あいまい');
		return t('미학습', '未学習');
	}

	function injectStyle() {
		if (document.getElementById('jlpt-history-controls-style')) return;
		const style = document.createElement('style');
		style.id = 'jlpt-history-controls-style';
		style.textContent = `
			.jlpt-date-nav{position:fixed;top:66px;left:50%;z-index:70;display:flex;align-items:center;gap:8px;flex-wrap:wrap;width:min(920px,calc(100vw - 32px));margin:0;padding:12px;transform:translateX(-50%);border:1px solid #dde4ec;border-radius:12px;background:#f8fafc;box-shadow:0 6px 18px rgba(28,48,72,.16)}.jlpt-date-nav-spacer{height:78px}.jlpt-date-nav button,.jlpt-date-nav input{min-height:42px;border:1px solid #ccd5df;border-radius:9px;background:#fff;padding:8px 12px;font:inherit}.jlpt-date-nav button{cursor:pointer;font-weight:800}.jlpt-date-nav strong{margin-left:auto}.jlpt-date-nav-minimize{margin-left:auto!important;padding:8px 10px!important}.jlpt-date-nav-reopen{position:fixed;top:72px;right:16px;z-index:71;min-height:34px;border:1px solid #ccd5df;border-radius:999px;background:#fff;padding:7px 10px;box-shadow:0 6px 18px rgba(28,48,72,.16);font:inherit;font-size:12px;font-weight:800;cursor:pointer}.jlpt-calendar-day{cursor:pointer}.jlpt-calendar-day.is-selected{outline:3px solid rgba(31,79,70,.24);outline-offset:1px}.jlpt-word-number{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;margin-right:8px;border-radius:999px;background:#eef2f6;font-size:12px;font-weight:900;color:#42526a}.jlpt-pager{display:flex;justify-content:center;align-items:center;gap:6px;flex-wrap:wrap;margin:14px 0 4px}.jlpt-pager button{min-width:38px;min-height:36px;border:1px solid #d4dce5;border-radius:8px;background:#fff;cursor:pointer;font-weight:800}.jlpt-pager button.is-active{background:#26364e;color:#fff}.jlpt-archive-list{display:grid;gap:10px}.jlpt-archive-word,.jlpt-archive-item,.jlpt-wrong-item{padding:14px;border:1px solid #dde4ec;border-radius:12px;background:#fff}.jlpt-archive-word strong{font-size:18px}.jlpt-archive-word small{display:block;margin-top:4px;color:#66758a}.jlpt-archive-status{margin:9px 0 0;font-size:13px;font-weight:800;color:#526173}.jlpt-archive-state-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.jlpt-archive-state-actions button{flex:0 1 auto;min-height:38px;padding:8px 11px;border:1px solid #d6dee8;border-radius:9px;background:#fff;cursor:pointer;font-weight:800}.jlpt-archive-state-actions button:disabled{opacity:.55;cursor:wait}.jlpt-archive-options{display:grid;gap:7px;margin-top:10px}.jlpt-archive-options button{padding:9px 11px;text-align:left;border:1px solid #d6dee8;border-radius:9px;background:#fff;cursor:pointer}.jlpt-archive-result{margin-top:9px;font-weight:800}.jlpt-wrong-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.jlpt-wrong-toolbar button{padding:8px 12px;border:1px solid #d6dee8;border-radius:9px;background:#fff;cursor:pointer;font-weight:800}.jlpt-wrong-toolbar button.is-active{background:#26364e;color:#fff}.jlpt-history-hidden{display:none!important}.jlpt-calendar-preview-popover{position:fixed;z-index:60;width:min(276px,calc(100vw - 28px));padding:12px;border:1px solid #cad6e3;border-radius:14px;background:#fff;box-shadow:0 14px 34px rgba(28,48,72,.2)}.jlpt-calendar-preview-popover[hidden]{display:none}.jlpt-calendar-preview-popover header{display:flex;align-items:center;justify-content:space-between;gap:8px}.jlpt-calendar-preview-popover header strong{font-size:14px;color:#26364e}.jlpt-calendar-preview-close{width:28px;min-width:28px;height:28px;min-height:28px;padding:0;border:0;border-radius:999px;background:#eef2f6;color:#42526a;font:inherit;font-size:18px;cursor:pointer}.jlpt-calendar-preview-popover p{margin:7px 0 0;color:#66758a;font-size:12px;line-height:1.4}.jlpt-calendar-preview-words{display:grid;gap:6px;margin-top:9px}.jlpt-calendar-preview-word{display:grid;grid-template-columns:1fr auto;gap:2px 8px;padding:8px 9px;border-radius:9px;background:#f5f8fc}.jlpt-calendar-preview-word strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}.jlpt-calendar-preview-word span{color:#66758a;font-size:12px}.jlpt-calendar-preview-word small{grid-column:1/-1;overflow:hidden;color:#526173;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.jlpt-calendar-preview-more{margin-top:8px!important;font-weight:800;color:#42526a!important}@media(max-width:640px){.jlpt-date-nav{top:58px;width:calc(100vw - 20px);padding:9px}.jlpt-date-nav-spacer{height:114px}.jlpt-date-nav strong{width:auto;margin-left:0}.jlpt-date-nav input{flex:1 1 132px;min-width:0}.jlpt-date-nav-reopen{top:64px;right:10px}.jlpt-archive-state-actions button{flex:1 1 90px}}
		`;
		style.textContent += '.jlpt-date-context-active>:not(.jlpt-date-nav-spacer){display:none!important}';
		document.head.appendChild(style);
	}

	function makePager(total, current, onPage) {
		const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
		if (pages <= 1) return null;
		const wrap = document.createElement('div'); wrap.className = 'jlpt-pager';
		const add = (label, page, active = false, disabled = false) => { const b = document.createElement('button'); b.type='button'; b.textContent=label; b.disabled=disabled; b.classList.toggle('is-active', active); b.addEventListener('click', () => onPage(page)); wrap.appendChild(b); };
		add('‹', Math.max(1,current-1), false, current===1);
		for(let p=1;p<=pages;p+=1) add(String(p), p, p===current);
		add('›', Math.min(pages,current+1), false, current===pages);
		return wrap;
	}

	function paginateWordList(id) {
		const list = document.getElementById(id); if (!list) return;
		const cards = [...list.children].filter((node) => node.classList?.contains('jlpt-word-card'));
		if (!cards.length) return;
		let page = Math.max(1, Number(list.dataset.page || 1));
		const pages = Math.max(1, Math.ceil(cards.length / PAGE_SIZE)); page = Math.min(page, pages); list.dataset.page = String(page);
		cards.forEach((card, index) => {
			card.classList.toggle('jlpt-history-hidden', index < (page-1)*PAGE_SIZE || index >= page*PAGE_SIZE);
			const title = card.querySelector('.jlpt-word-title');
			if (title && !title.querySelector('.jlpt-word-number')) { const n=document.createElement('span'); n.className='jlpt-word-number'; n.textContent=String(index+1); title.prepend(n); }
		});
		const old = list.nextElementSibling; if (old?.classList.contains('jlpt-pager')) old.remove();
		const pager = makePager(cards.length, page, (next) => { list.dataset.page=String(next); paginateWordList(id); }); if (pager) list.after(pager);
	}

	function setupWordPagination() {
		['jlpt-review-words','jlpt-new-words'].forEach((id) => {
			const node = document.getElementById(id); if (!node) return;
			new MutationObserver(() => { node.dataset.page='1'; queueMicrotask(() => paginateWordList(id)); }).observe(node,{childList:true});
			paginateWordList(id);
		});
	}

	function mountDateNav() {
		const card = document.getElementById('jlpt-start-button')?.closest('.jlpt-card'); if (!card || document.getElementById('jlpt-date-nav')) return;
		const nav=document.createElement('div'); nav.id='jlpt-date-nav'; nav.className='jlpt-date-nav';
		nav.innerHTML=`<button type="button" data-shift="-1">←</button><input id="jlpt-study-date" type="date" value="${selectedDate}" aria-label="${t('학습 날짜','学習日')}"/><button type="button" data-today="1">${t('오늘','今日')}</button><button type="button" data-shift="1">→</button><strong id="jlpt-selected-date-label"></strong><button type="button" class="jlpt-date-nav-minimize" data-minimize="1" aria-label="${t('날짜 이동 최소화','日付移動を最小化')}">−</button>`;
		const spacer=document.createElement('div');spacer.id='jlpt-date-nav-spacer';spacer.className='jlpt-date-nav-spacer';spacer.setAttribute('aria-hidden','true');card.prepend(spacer);document.body.appendChild(nav);
		nav.querySelector('[data-shift="-1"]').addEventListener('click',()=>selectDate(addDays(selectedDate,-1)));
		nav.querySelector('[data-shift="1"]').addEventListener('click',()=>selectDate(addDays(selectedDate,1)));
		nav.querySelector('[data-today]').addEventListener('click',()=>selectDate(jstToday()));
		nav.querySelector('input').addEventListener('change',(event)=>selectDate(event.target.value));
		nav.querySelector('[data-minimize]').addEventListener('click',()=>setDateNavMinimized(true));
		setDateNavMinimized(localStorage.getItem(DATE_NAV_MINIMIZED_KEY)==='1',false);
		updateDateLabel();
	}
	function setupDateNavMounting(){
		mountDateNav();
		if(document.getElementById('jlpt-date-nav'))return;
		const observer=new MutationObserver(()=>{mountDateNav();if(document.getElementById('jlpt-date-nav'))observer.disconnect();});
		observer.observe(document.body,{childList:true,subtree:true});
	}
	function dateNavReopenButton(){let button=document.getElementById('jlpt-date-nav-reopen');if(button)return button;button=document.createElement('button');button.id='jlpt-date-nav-reopen';button.type='button';button.className='jlpt-date-nav-reopen';button.textContent=t('날짜','日付');button.setAttribute('aria-label',t('날짜 이동 표시','日付移動を表示'));button.addEventListener('click',()=>setDateNavMinimized(false));document.body.appendChild(button);return button;}
	function setDateNavMinimized(minimized,persist=true){const nav=document.getElementById('jlpt-date-nav');const reopen=dateNavReopenButton();if(nav)nav.hidden=minimized;reopen.hidden=!minimized;if(persist)localStorage.setItem(DATE_NAV_MINIMIZED_KEY,minimized?'1':'0');}

	function currentStudyCards() {
		const ids=['jlpt-study-detail','jlpt-vocab-contents','jlpt-grammar-contents','jlpt-reading-contents'];
		const cards=[];
		const todayCard=document.getElementById('jlpt-start-button')?.closest('.jlpt-card'); if(todayCard) cards.push(todayCard);
		ids.forEach((id)=>{const n=document.getElementById(id); const c=n?.closest('.jlpt-card')||n; if(c&&!cards.includes(c))cards.push(c);});
		return cards;
	}
	function setTodayCardsVisible(show){ const todayCard=document.getElementById('jlpt-start-button')?.closest('.jlpt-card');currentStudyCards().forEach((card)=>{if(card===todayCard){card.classList.remove('jlpt-history-hidden');card.classList.toggle('jlpt-date-context-active',!show);if(!show)document.getElementById('jlpt-date-nav-spacer')?.classList.add('jlpt-history-hidden');else document.getElementById('jlpt-date-nav-spacer')?.classList.remove('jlpt-history-hidden');}else card.classList.toggle('jlpt-history-hidden',!show);}); }
	function updateDateLabel(){ const input=document.getElementById('jlpt-study-date'); if(input) input.value=selectedDate; const label=document.getElementById('jlpt-selected-date-label'); if(label) label.textContent=selectedDate===jstToday()?t('오늘의 학습','今日の学習'):t(`${selectedDate} 학습`,`学習日 ${selectedDate}`); const highlighted=calendarPreviewDate||selectedDate; document.querySelectorAll('#jlpt-calendar .jlpt-calendar-day').forEach((cell)=>cell.classList.toggle('is-selected',(cell.dataset.fullDate||calendarCellDate(cell))===highlighted)); }

	function archiveCard() {
		let card=document.getElementById('jlpt-selected-date-card'); if(card) return card;
		card=document.createElement('section'); card.id='jlpt-selected-date-card'; card.className='jlpt-card jlpt-history-hidden';
		const todayCard=document.getElementById('jlpt-start-button')?.closest('.jlpt-card'); const parent=todayCard?.parentElement||document.querySelector('.jlpt-content'); parent?.insertBefore(card,todayCard?.nextSibling||null); return card;
	}
	function calendarPreviewCard() {
		let card=document.getElementById('jlpt-calendar-preview-card'); if(card) return card;
		card=document.createElement('aside'); card.id='jlpt-calendar-preview-card'; card.className='jlpt-calendar-preview-popover'; card.hidden=true;
		card.setAttribute('role','dialog'); card.setAttribute('aria-live','polite'); document.body.appendChild(card);
		return card;
	}
	function placeCalendarPreview(anchor) { const card=calendarPreviewCard(); if(!(anchor instanceof HTMLElement)) return; const rect=anchor.getBoundingClientRect(); const width=Math.min(276,window.innerWidth-28); card.style.left=`${Math.max(14,Math.min(window.innerWidth-width-14,rect.left+rect.width/2-width/2))}px`; const below=rect.bottom+8; card.style.top=`${below+220<window.innerHeight?below:Math.max(12,rect.top-220)}px`; }
	function closeCalendarPreview() { calendarPreviewCard().hidden=true; }
	function renderCalendarPreviewLoading(date) {
		const card=calendarPreviewCard();
		card.hidden=false;
		card.replaceChildren();
		card.append(Object.assign(document.createElement('strong'),{textContent:date}),Object.assign(document.createElement('p'),{textContent:t('단어를 불러오는 중입니다.','単語を読み込んでいます。')}));
	}
	function renderCalendarPreview(data) {
		const card=calendarPreviewCard(); card.hidden=false; card.replaceChildren();
		const heading=document.createElement('header'); const title=document.createElement('strong'); title.textContent=t(`${data.studyDate} · 신규 단어`,`${data.studyDate} · 新規単語`); const close=document.createElement('button'); close.type='button'; close.className='jlpt-calendar-preview-close'; close.textContent='×'; close.setAttribute('aria-label',t('미리보기 닫기','プレビューを閉じる')); close.addEventListener('click',closeCalendarPreview); heading.append(title,close); card.appendChild(heading);
		const words=Array.isArray(data.words)?data.words:[];
		const list=document.createElement('div'); list.className='jlpt-calendar-preview-words';
		if(!words.length) list.appendChild(Object.assign(document.createElement('p'),{textContent:t('등록된 신규 단어가 없습니다.','登録された新規単語はありません。')}));
		else words.slice(0,4).forEach((word,index)=>{const item=document.createElement('article');item.className='jlpt-calendar-preview-word';const strong=document.createElement('strong');strong.textContent=`${index+1}. ${word.word||'—'}`;const reading=document.createElement('span');reading.textContent=word.reading||'—';const meaning=document.createElement('small');meaning.textContent=word.meaningKo||word.meaningJa||'—';item.append(strong,reading,meaning);list.appendChild(item);});
		card.appendChild(list);
		if(words.length>4) card.appendChild(Object.assign(document.createElement('p'),{className:'jlpt-calendar-preview-more',textContent:t(`외 ${words.length-4}개` ,`ほか ${words.length-4}件`)}));
	}
	async function previewCalendarDate(date,anchor) {
		if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
		calendarPreviewDate=date; updateDateLabel(); renderCalendarPreviewLoading(date); placeCalendarPreview(anchor);
		try { const data=await requestJson(`${PRACTICE_API}?date=${encodeURIComponent(date)}`);renderCalendarPreview(data);return data; }
		catch { const card=calendarPreviewCard(); card.replaceChildren(); card.hidden=false; card.appendChild(Object.assign(document.createElement('p'),{textContent:t('미리보기를 불러오지 못했습니다.','プレビューを読み込めませんでした。')}));return null; }
	}
	function renderArchivePager(container, values, render, page=1){ container.replaceChildren(); const start=(page-1)*PAGE_SIZE; values.slice(start,start+PAGE_SIZE).forEach((value,index)=>container.appendChild(render(value,start+index))); const pager=makePager(values.length,page,(p)=>renderArchivePager(container,values,render,p)); if(pager) container.appendChild(pager); }

	function archiveWordMatches(word) {
		const state = word.learningState || 'unlearned';
		if (archiveWordFilter === 'review') return state !== 'mastered';
		if (archiveWordFilter === 'uncertain') return state === 'uncertain';
		if (archiveWordFilter === 'mastered') return state === 'mastered';
		return true;
	}
	function renderFilteredArchiveWords(page=1) {
		if (!archiveWordList || !archiveWordRender) return;
		archiveWordFilter = window.__SONG_JLPT_MEMORY_FILTER__ || archiveWordFilter;
		renderArchivePager(archiveWordList, archiveWords.filter(archiveWordMatches), archiveWordRender, page);
	}
	window.addEventListener('song:jlpt-memory-filter', (event) => {
		archiveWordFilter = event.detail?.filter || 'all';
		renderFilteredArchiveWords(1);
	});
	function questionNode(item,index){ const box=document.createElement('article'); box.className='jlpt-archive-item'; box.innerHTML=`<strong>${index+1}. ${escapeHtml(item.title||t('문제','問題'))}</strong><p>${escapeHtml(item.prompt)}</p>`; const options=document.createElement('div'); options.className='jlpt-archive-options'; const result=document.createElement('div'); result.className='jlpt-archive-result'; (item.options||[]).forEach((option)=>{const b=document.createElement('button');b.type='button';b.textContent=option;b.addEventListener('click',async()=>{options.querySelectorAll('button').forEach(x=>x.disabled=true);try{const data=await requestJson(GRADE_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({questionKey:item.key,selectedAnswer:option})});result.textContent=data.correct?t(`정답 ✓ ${data.explanation||''}`,`正解 ✓ ${data.explanation||''}`):t(`오답 · 정답: ${data.correctAnswer}${data.explanation?` · ${data.explanation}`:''}`,`不正解 · 正解: ${data.correctAnswer}${data.explanation?` · ${data.explanation}`:''}`);}catch{result.textContent=t('채점할 수 없습니다.','採点できません。');}finally{options.querySelectorAll('button').forEach(x=>x.disabled=false);}});options.appendChild(b);}); box.append(options,result); return box; }

	function renderHistoricalSaveBar(card) {
		let bar=card.querySelector('.jlpt-history-save-bar');
		if(!bar){bar=document.createElement('div');bar.className='jlpt-word-state-save-bar jlpt-history-save-bar';bar.innerHTML='<span></span>';card.querySelector('.jlpt-card-heading')?.after(bar);}
		const count=archivePendingStates.size;bar.querySelector('span').textContent=archiveStatesSaving?t('변경사항을 자동 저장하는 중입니다…','変更内容を自動保存しています…'):(count?t(`${count}개 변경사항 · 화면 이동 시 자동 저장됩니다.`,`${count}件の変更 · 画面移動時に自動保存されます。`):t('상태를 선택하면 화면 이동 시 자동 저장됩니다.','状態を選択すると画面移動時に自動保存されます。'));
	}

	function stageHistoricalWord(word,state,article) {
		const original=word.originalLearningState||word.learningState||'unlearned';
		if(state===original)archivePendingStates.delete(word.id);else archivePendingStates.set(word.id,state);
		word.learningState=state;article.dataset.memoryState=state;article.classList.toggle('has-pending-state',state!==original);
		const statusNode=article.querySelector('.jlpt-archive-status');if(statusNode)statusNode.textContent=t(`저장 전 · ${stateLabel(state)}`,`保存前 · ${stateLabel(state)}`);
		article.querySelectorAll('.jlpt-archive-state-actions button').forEach((button)=>button.classList.toggle('is-selected',button.dataset.state===state));
		renderHistoricalSaveBar(archiveCard());window.dispatchEvent(new CustomEvent('song:jlpt-memory-state-changed'));
	}

	async function saveHistoricalStates({ reload=true }={}) {
		if(!archivePendingStates.size||archiveStatesSaving)return true;
		archiveStatesSaving=true;renderHistoricalSaveBar(archiveCard());
		try {
			await requestJson(HISTORICAL_WORD_API, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ studyDate:selectedDate, updates:[...archivePendingStates].map(([wordId,state])=>({wordId,state})) }),
			});
			archivePendingStates.clear();archiveStatesSaving=false;
			if(reload)await selectDate(selectedDate,{skipSave:true});else renderHistoricalSaveBar(archiveCard());
			return true;
		} catch (error) {
			archiveStatesSaving=false;renderHistoricalSaveBar(archiveCard());const message=archiveCard().querySelector('.jlpt-history-save-bar span');if(message)message.textContent=error.status===401?t('관리자 로그인 후 저장할 수 있습니다.','管理者ログイン後に保存できます。'):t('학습 상태 저장에 실패했습니다. 다시 시도해주세요.','学習状態の保存に失敗しました。もう一度お試しください。');return false;
		}
	}
	function saveHistoricalStatesOnExit(){if(!archivePendingStates.size)return;const queued=navigator.sendBeacon(HISTORICAL_WORD_API,new Blob([JSON.stringify({studyDate:selectedDate,updates:[...archivePendingStates].map(([wordId,state])=>({wordId,state}))})],{type:'application/json'}));if(queued)archivePendingStates.clear();}

	function renderArchive(data){ const card=archiveCard(); card.classList.remove('jlpt-history-hidden'); card.innerHTML=`<div class="jlpt-card-heading"><div><h2>${escapeHtml(data.studyDate)} ${t('오늘의 학습 기록','学習記録')}</h2><p>${t('달력 또는 상단 날짜 선택에서 불러온 학습 내용입니다. 미학습 단어는 날짜가 지나도 여기에서 다시 학습할 수 있습니다.','カレンダーまたは日付選択から読み込んだ学習内容です。未学習の単語は日付が過ぎてもここから再学習できます。')}</p></div></div>`;renderHistoricalSaveBar(card);
		const words=document.createElement('section'); words.innerHTML=`<h3>${t('단어','単語')} (${data.words.length})</h3>`; const wordList=document.createElement('div');wordList.className='jlpt-archive-list';words.appendChild(wordList);archiveWords=data.words.map((word)=>({...word,originalLearningState:word.learningState||'unlearned',learningState:archivePendingStates.get(word.id)||word.learningState||'unlearned'}));archiveWordList=wordList;archiveWordRender=(word,index)=>{const selected=archivePendingStates.get(word.id)||word.learningState||'unlearned';const a=document.createElement('article');a.className=`jlpt-archive-word${archivePendingStates.has(word.id)?' has-pending-state':''}`;a.dataset.memoryWord='true';a.dataset.memoryReading=word.reading||'';a.dataset.memoryMeaningKo=word.meaningKo||'';a.dataset.memoryState=selected;a.innerHTML=`<strong><span class="jlpt-word-number">${index+1}</span>${escapeHtml(word.word)}</strong><small>${escapeHtml(word.reading||'—')} · ${escapeHtml(word.meaningKo||word.meaningJa||'—')}</small><p class="jlpt-archive-status">${archivePendingStates.has(word.id)?t(`저장 전 · ${stateLabel(selected)}`,`保存前 · ${stateLabel(selected)}`):(word.status==='completed'?t(`학습완료 · ${stateLabel(word.learningState)}`,`学習完了 · ${stateLabel(word.learningState)}`):t('미학습 · 다시 학습 가능','未学習 · 再学習できます'))}</p>`;if(word.status!=='completed'){const actions=document.createElement('div');actions.className='jlpt-archive-state-actions';[['unlearned',t('미학습','未学習')],['uncertain',t('애매함','あいまい')],['mastered',t('외움','覚えた')]].forEach(([state,label])=>{const b=document.createElement('button');b.type='button';b.dataset.state=state;b.textContent=label;b.classList.toggle('is-selected',state===selected);b.addEventListener('click',()=>stageHistoricalWord(word,state,a));actions.appendChild(b);});a.appendChild(actions);}return a;};renderFilteredArchiveWords();card.appendChild(words);
		const questions=(data.questions||[]); const qSection=document.createElement('section');qSection.innerHTML=`<h3>${t('어휘·문법 문제','語彙・文法問題')} (${questions.length})</h3>`;const qList=document.createElement('div');qList.className='jlpt-archive-list';qSection.appendChild(qList);renderArchivePager(qList,questions,questionNode);card.appendChild(qSection);
		const grammar=document.createElement('section');grammar.innerHTML=`<h3>${t('문법 개념','文法')} (${(data.grammar||[]).length})</h3>`;const gList=document.createElement('div');gList.className='jlpt-archive-list';grammar.appendChild(gList);renderArchivePager(gList,data.grammar||[],(g,index)=>{const a=document.createElement('article');a.className='jlpt-archive-item';const p=g.payload||{};a.innerHTML=`<strong>${index+1}. ${escapeHtml(p.pattern||g.title||'—')}</strong><p>${escapeHtml(p.meaningKo||p.meaningJa||p.meaning||'')}</p><p>${escapeHtml(p.explanation||'')}</p>`;return a;});card.appendChild(grammar);
		(data.readings||[]).forEach((r,index)=>{const s=document.createElement('section');s.innerHTML=`<h3>${t('독해','読解')} ${index+1}</h3><article class="jlpt-archive-item"><strong>${escapeHtml(r.title||'')}</strong><p>${escapeHtml(r.passage||'')}</p></article>`;const list=document.createElement('div');list.className='jlpt-archive-list';(r.questions||[]).forEach((q,qi)=>list.appendChild(questionNode(q,qi)));s.appendChild(list);card.appendChild(s);});
		if(!data.words.length&&!questions.length&&!(data.grammar||[]).length&&!(data.readings||[]).length){card.insertAdjacentHTML('beforeend',`<p class="jlpt-empty">${t('해당 날짜에 등록된 학습 데이터가 없습니다.','この日に登録された学習データはありません。')}</p>`);}
	}
	async function selectDate(date,{skipSave=false,prefetchedData=null}={}){ if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return;if(!skipSave&&selectedDate===jstToday()&&date!==selectedDate&&typeof window.SongJlptSavePendingWordStates==='function')await window.SongJlptSavePendingWordStates();if(!skipSave&&archivePendingStates.size){const saved=await saveHistoricalStates({reload:false});if(!saved)return;}archivePendingStates.clear();selectedDate=date;calendarPreviewDate=date;updateDateLabel(); if(date===jstToday()){setTodayCardsVisible(true);archiveCard().classList.add('jlpt-history-hidden');return;} setTodayCardsVisible(false);const card=archiveCard();card.classList.remove('jlpt-history-hidden');card.innerHTML=`<p class="jlpt-empty">${t('학습 데이터를 불러오는 중입니다.','学習データを読み込んでいます。')}</p>`;try{renderArchive(prefetchedData||await requestJson(`${PRACTICE_API}?date=${encodeURIComponent(date)}`));}catch(error){card.innerHTML=`<p class="jlpt-empty">${error.status===400?t('조회할 수 없는 날짜입니다.','参照できない日付です.'):t('해당 날짜 학습 데이터를 불러오지 못했습니다.','学習データを読み込めませんでした。')}</p>`;} updateDateLabel(); }
	function calendarCellDate(cell){ const text=cell.querySelector('strong')?.textContent?.trim(); if(!/^\d{2}\/\d{2}$/.test(text||''))return null; const [m,d]=text.split('/').map(Number); const today=jstToday(); let y=Number(today.slice(0,4)); const tm=Number(today.slice(5,7)); if(tm===1&&m===12)y-=1; if(tm===12&&m===1)y+=1; return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
	function setupCalendar(){ const cal=document.getElementById('jlpt-calendar');if(!cal)return;cal.addEventListener('click',async(event)=>{const cell=event.target.closest('.jlpt-calendar-day');if(!cell)return;const date=cell.dataset.fullDate||calendarCellDate(cell);if(!date)return;const data=await previewCalendarDate(date,cell);await selectDate(date,{prefetchedData:data});});document.addEventListener('pointerdown',(event)=>{const card=document.getElementById('jlpt-calendar-preview-card');if(card&&!card.hidden&&!card.contains(event.target)&&!event.target.closest('.jlpt-calendar-day'))closeCalendarPreview();});new MutationObserver(()=>updateDateLabel()).observe(cal,{childList:true}); }

	function mountWrongNotes(){ if(document.getElementById('jlpt-wrong-card'))return; const card=document.createElement('section');card.id='jlpt-wrong-card';card.className='jlpt-card';card.innerHTML=`<div class="jlpt-card-heading"><div><h2>${t('오답노트','誤答ノート')}</h2><p>${t('틀린 문제와 해결 여부를 누적해서 봅니다.','間違えた問題と解決状況を確認します。')}</p></div></div><div class="jlpt-wrong-toolbar"><button type="button" data-wrong="open" class="is-active">${t('미해결','未解決')}</button><button type="button" data-wrong="all">${t('전체','すべて')}</button></div><div id="jlpt-wrong-list" class="jlpt-archive-list"><p class="jlpt-empty">${t('불러오는 중입니다.','読み込んでいます。')}</p></div>`; const calendar=document.getElementById('jlpt-calendar')?.closest('.jlpt-card');(calendar?.parentElement||document.querySelector('.jlpt-content'))?.insertBefore(card,calendar||null);card.querySelectorAll('[data-wrong]').forEach((b)=>b.addEventListener('click',()=>{wrongResolved=b.dataset.wrong==='all';wrongPage=1;card.querySelectorAll('[data-wrong]').forEach(x=>x.classList.toggle('is-active',x===b));loadWrongNotes();})); loadWrongNotes(); }
	async function loadWrongNotes(){ const list=document.getElementById('jlpt-wrong-list');if(!list)return;try{const data=await requestJson(`${WRONG_API}?resolved=${wrongResolved?'all':'open'}&limit=100`);wrongItems=data.items||[];renderWrongNotes();}catch(error){list.innerHTML=`<p class="jlpt-empty">${error.status===401?t('관리자 로그인 후 오답노트를 볼 수 있습니다.','管理者ログイン後に表示できます。'):t('오답노트를 불러오지 못했습니다.','誤答ノートを読み込めませんでした。')}</p>`;} }
	function renderWrongNotes(){ const list=document.getElementById('jlpt-wrong-list');if(!list)return;list.replaceChildren();if(!wrongItems.length){list.innerHTML=`<p class="jlpt-empty">${t('해당 오답이 없습니다.','該当する誤答はありません。')}</p>`;return;}const start=(wrongPage-1)*PAGE_SIZE;wrongItems.slice(start,start+PAGE_SIZE).forEach((item,index)=>{const a=document.createElement('article');a.className='jlpt-wrong-item';a.innerHTML=`<strong>${start+index+1}. ${escapeHtml(item.prompt)}</strong><p>${t('날짜','日付')}: ${escapeHtml(item.studyDate)} · ${t('오답 횟수','誤答回数')}: ${item.wrongCount}</p><p>${t('내 답','自分の答え')}: ${escapeHtml(item.selectedAnswer||'—')}</p><p>${t('정답','正解')}: <b>${escapeHtml(item.correctAnswer)}</b></p>${item.explanation?`<p>${escapeHtml(item.explanation)}</p>`:''}`;list.appendChild(a);});const pager=makePager(wrongItems.length,wrongPage,(p)=>{wrongPage=p;renderWrongNotes();});if(pager)list.appendChild(pager); }

	function init(){injectStyle();setupDateNavMounting();setupWordPagination();setupCalendar();mountWrongNotes();updateDateLabel();window.addEventListener('pagehide',saveHistoricalStatesOnExit);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveHistoricalStatesOnExit();});}
	if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
