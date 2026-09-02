(() => {
	const PRACTICE_API = '/api/public/japanese/jlpt/practice';
	const GRADE_API = '/api/public/japanese/jlpt/practice/grade';
	const WRONG_API = '/api/admin/japanese/jlpt/wrong-notes';
	const PAGE_SIZE = 10;
	const isJa = document.body.dataset.blogLanguage === 'ja';
	const t = (ko, ja) => isJa ? ja : ko;
	let selectedDate = jstToday();
	let wrongResolved = false;
	let wrongPage = 1;
	let wrongItems = [];

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

	function injectStyle() {
		if (document.getElementById('jlpt-history-controls-style')) return;
		const style = document.createElement('style');
		style.id = 'jlpt-history-controls-style';
		style.textContent = `
			.jlpt-date-nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 18px;padding:12px;border:1px solid #dde4ec;border-radius:12px;background:#f8fafc}.jlpt-date-nav button,.jlpt-date-nav input{min-height:42px;border:1px solid #ccd5df;border-radius:9px;background:#fff;padding:8px 12px;font:inherit}.jlpt-date-nav button{cursor:pointer;font-weight:800}.jlpt-date-nav strong{margin-left:auto}.jlpt-calendar-day{cursor:pointer}.jlpt-calendar-day.is-selected{outline:3px solid rgba(31,79,70,.24);outline-offset:1px}.jlpt-word-number{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:28px;margin-right:8px;border-radius:999px;background:#eef2f6;font-size:12px;font-weight:900;color:#42526a}.jlpt-pager{display:flex;justify-content:center;align-items:center;gap:6px;flex-wrap:wrap;margin:14px 0 4px}.jlpt-pager button{min-width:38px;min-height:36px;border:1px solid #d4dce5;border-radius:8px;background:#fff;cursor:pointer;font-weight:800}.jlpt-pager button.is-active{background:#26364e;color:#fff}.jlpt-archive-list{display:grid;gap:10px}.jlpt-archive-word,.jlpt-archive-item,.jlpt-wrong-item{padding:14px;border:1px solid #dde4ec;border-radius:12px;background:#fff}.jlpt-archive-word strong{font-size:18px}.jlpt-archive-word small{display:block;margin-top:4px;color:#66758a}.jlpt-archive-options{display:grid;gap:7px;margin-top:10px}.jlpt-archive-options button{padding:9px 11px;text-align:left;border:1px solid #d6dee8;border-radius:9px;background:#fff;cursor:pointer}.jlpt-archive-result{margin-top:9px;font-weight:800}.jlpt-wrong-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.jlpt-wrong-toolbar button{padding:8px 12px;border:1px solid #d6dee8;border-radius:9px;background:#fff;cursor:pointer;font-weight:800}.jlpt-wrong-toolbar button.is-active{background:#26364e;color:#fff}.jlpt-history-hidden{display:none!important}@media(max-width:640px){.jlpt-date-nav strong{width:100%;margin-left:0}.jlpt-date-nav input{flex:1 1 150px;min-width:0}}
		`;
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
		nav.innerHTML=`<button type="button" data-shift="-1">←</button><input id="jlpt-study-date" type="date" value="${selectedDate}" aria-label="${t('학습 날짜','学習日')}"/><button type="button" data-today="1">${t('오늘','今日')}</button><button type="button" data-shift="1">→</button><strong id="jlpt-selected-date-label"></strong>`;
		card.prepend(nav);
		nav.querySelector('[data-shift="-1"]').addEventListener('click',()=>selectDate(addDays(selectedDate,-1)));
		nav.querySelector('[data-shift="1"]').addEventListener('click',()=>selectDate(addDays(selectedDate,1)));
		nav.querySelector('[data-today]').addEventListener('click',()=>selectDate(jstToday()));
		nav.querySelector('input').addEventListener('change',(event)=>selectDate(event.target.value));
		updateDateLabel();
	}

	function currentStudyCards() {
		const ids=['jlpt-study-detail','jlpt-vocab-contents','jlpt-grammar-contents','jlpt-reading-contents'];
		const cards=[];
		const todayCard=document.getElementById('jlpt-start-button')?.closest('.jlpt-card'); if(todayCard) cards.push(todayCard);
		ids.forEach((id)=>{const n=document.getElementById(id); const c=n?.closest('.jlpt-card')||n; if(c&&!cards.includes(c))cards.push(c);});
		return cards;
	}
	function setTodayCardsVisible(show){ currentStudyCards().forEach((card)=>card.classList.toggle('jlpt-history-hidden',!show)); }
	function updateDateLabel(){ const input=document.getElementById('jlpt-study-date'); if(input) input.value=selectedDate; const label=document.getElementById('jlpt-selected-date-label'); if(label) label.textContent=selectedDate===jstToday()?t('오늘의 학습','今日の学習'):t(`${selectedDate} 학습`,`学習日 ${selectedDate}`); document.querySelectorAll('#jlpt-calendar .jlpt-calendar-day').forEach((cell)=>cell.classList.toggle('is-selected',calendarCellDate(cell)===selectedDate)); }

	function archiveCard() {
		let card=document.getElementById('jlpt-selected-date-card'); if(card) return card;
		card=document.createElement('section'); card.id='jlpt-selected-date-card'; card.className='jlpt-card jlpt-history-hidden';
		const calendar=document.getElementById('jlpt-calendar')?.closest('.jlpt-card'); (calendar?.parentElement||document.querySelector('.jlpt-content'))?.insertBefore(card,calendar||null); return card;
	}
	function renderArchivePager(container, values, render, page=1){ container.replaceChildren(); const start=(page-1)*PAGE_SIZE; values.slice(start,start+PAGE_SIZE).forEach((value,index)=>container.appendChild(render(value,start+index))); const pager=makePager(values.length,page,(p)=>renderArchivePager(container,values,render,p)); if(pager) container.appendChild(pager); }
	function questionNode(item,index){ const box=document.createElement('article'); box.className='jlpt-archive-item'; box.innerHTML=`<strong>${index+1}. ${escapeHtml(item.title||t('문제','問題'))}</strong><p>${escapeHtml(item.prompt)}</p>`; const options=document.createElement('div'); options.className='jlpt-archive-options'; const result=document.createElement('div'); result.className='jlpt-archive-result'; (item.options||[]).forEach((option)=>{const b=document.createElement('button');b.type='button';b.textContent=option;b.addEventListener('click',async()=>{options.querySelectorAll('button').forEach(x=>x.disabled=true);try{const data=await requestJson(GRADE_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({questionKey:item.key,selectedAnswer:option})});result.textContent=data.correct?t(`정답 ✓ ${data.explanation||''}`,`正解 ✓ ${data.explanation||''}`):t(`오답 · 정답: ${data.correctAnswer}${data.explanation?` · ${data.explanation}`:''}`,`不正解 · 正解: ${data.correctAnswer}${data.explanation?` · ${data.explanation}`:''}`);}catch{result.textContent=t('채점할 수 없습니다.','採点できません。');}finally{options.querySelectorAll('button').forEach(x=>x.disabled=false);}});options.appendChild(b);}); box.append(options,result); return box; }
	function renderArchive(data){ const card=archiveCard(); card.classList.remove('jlpt-history-hidden'); card.innerHTML=`<div class="jlpt-card-heading"><div><h2>${escapeHtml(data.studyDate)} ${t('오늘의 학습 기록','学習記録')}</h2><p>${t('달력 또는 상단 날짜 선택에서 불러온 학습 내용입니다.','カレンダーまたは日付選択から読み込んだ学習内容です。')}</p></div></div>`;
		const words=document.createElement('section'); words.innerHTML=`<h3>${t('단어','単語')} (${data.words.length})</h3>`; const wordList=document.createElement('div');wordList.className='jlpt-archive-list';words.appendChild(wordList);renderArchivePager(wordList,data.words,(word,index)=>{const a=document.createElement('article');a.className='jlpt-archive-word';a.dataset.memoryWord='true';a.dataset.memoryReading=word.reading||'';a.dataset.memoryMeaningKo=word.meaningKo||'';a.innerHTML=`<strong><span class="jlpt-word-number">${index+1}</span>${escapeHtml(word.word)}</strong><small>${escapeHtml(word.reading||'—')} · ${escapeHtml(word.meaningKo||word.meaningJa||'—')}</small>`;return a;});card.appendChild(words);
		const questions=(data.questions||[]); const qSection=document.createElement('section');qSection.innerHTML=`<h3>${t('어휘·문법 문제','語彙・文法問題')} (${questions.length})</h3>`;const qList=document.createElement('div');qList.className='jlpt-archive-list';qSection.appendChild(qList);renderArchivePager(qList,questions,questionNode);card.appendChild(qSection);
		const grammar=document.createElement('section');grammar.innerHTML=`<h3>${t('문법 개념','文法')} (${(data.grammar||[]).length})</h3>`;const gList=document.createElement('div');gList.className='jlpt-archive-list';grammar.appendChild(gList);renderArchivePager(gList,data.grammar||[],(g,index)=>{const a=document.createElement('article');a.className='jlpt-archive-item';const p=g.payload||{};a.innerHTML=`<strong>${index+1}. ${escapeHtml(p.pattern||g.title||'—')}</strong><p>${escapeHtml(p.meaningKo||p.meaningJa||p.meaning||'')}</p><p>${escapeHtml(p.explanation||'')}</p>`;return a;});card.appendChild(grammar);
		(data.readings||[]).forEach((r,index)=>{const s=document.createElement('section');s.innerHTML=`<h3>${t('독해','読解')} ${index+1}</h3><article class="jlpt-archive-item"><strong>${escapeHtml(r.title||'')}</strong><p>${escapeHtml(r.passage||'')}</p></article>`;const list=document.createElement('div');list.className='jlpt-archive-list';(r.questions||[]).forEach((q,qi)=>list.appendChild(questionNode(q,qi)));s.appendChild(list);card.appendChild(s);});
		if(!data.words.length&&!questions.length&&!(data.grammar||[]).length&&!(data.readings||[]).length){card.insertAdjacentHTML('beforeend',`<p class="jlpt-empty">${t('해당 날짜에 등록된 학습 데이터가 없습니다.','この日に登録された学習データはありません。')}</p>`);}
	}
	async function selectDate(date){ if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return; selectedDate=date;updateDateLabel(); if(date===jstToday()){setTodayCardsVisible(true);archiveCard().classList.add('jlpt-history-hidden');return;} setTodayCardsVisible(false);const card=archiveCard();card.classList.remove('jlpt-history-hidden');card.innerHTML=`<p class="jlpt-empty">${t('학습 데이터를 불러오는 중입니다.','学習データを読み込んでいます。')}</p>`;try{renderArchive(await requestJson(`${PRACTICE_API}?date=${encodeURIComponent(date)}`));}catch(error){card.innerHTML=`<p class="jlpt-empty">${error.status===400?t('조회할 수 없는 날짜입니다.','参照できない日付です。'):t('해당 날짜 학습 데이터를 불러오지 못했습니다.','学習データを読み込めませんでした。')}</p>`;} updateDateLabel(); }
	function calendarCellDate(cell){ const text=cell.querySelector('strong')?.textContent?.trim(); if(!/^\d{2}\/\d{2}$/.test(text||''))return null; const [m,d]=text.split('/').map(Number); const today=jstToday(); let y=Number(today.slice(0,4)); const tm=Number(today.slice(5,7)); if(tm===1&&m===12)y-=1; if(tm===12&&m===1)y+=1; return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
	function setupCalendar(){ const cal=document.getElementById('jlpt-calendar');if(!cal)return;cal.addEventListener('click',(event)=>{const cell=event.target.closest('.jlpt-calendar-day');if(!cell)return;const date=calendarCellDate(cell);if(date)selectDate(date);});new MutationObserver(()=>updateDateLabel()).observe(cal,{childList:true}); }

	function mountWrongNotes(){ if(document.getElementById('jlpt-wrong-card'))return; const card=document.createElement('section');card.id='jlpt-wrong-card';card.className='jlpt-card';card.innerHTML=`<div class="jlpt-card-heading"><div><h2>${t('오답노트','誤答ノート')}</h2><p>${t('틀린 문제와 해결 여부를 누적해서 봅니다.','間違えた問題と解決状況を確認します。')}</p></div></div><div class="jlpt-wrong-toolbar"><button type="button" data-wrong="open" class="is-active">${t('미해결','未解決')}</button><button type="button" data-wrong="all">${t('전체','すべて')}</button></div><div id="jlpt-wrong-list" class="jlpt-archive-list"><p class="jlpt-empty">${t('불러오는 중입니다.','読み込んでいます。')}</p></div>`; const calendar=document.getElementById('jlpt-calendar')?.closest('.jlpt-card');(calendar?.parentElement||document.querySelector('.jlpt-content'))?.insertBefore(card,calendar||null);card.querySelectorAll('[data-wrong]').forEach((b)=>b.addEventListener('click',()=>{wrongResolved=b.dataset.wrong==='all';wrongPage=1;card.querySelectorAll('[data-wrong]').forEach(x=>x.classList.toggle('is-active',x===b));loadWrongNotes();})); loadWrongNotes(); }
	async function loadWrongNotes(){ const list=document.getElementById('jlpt-wrong-list');if(!list)return;try{const data=await requestJson(`${WRONG_API}?resolved=${wrongResolved?'all':'open'}&limit=100`);wrongItems=data.items||[];renderWrongNotes();}catch(error){list.innerHTML=`<p class="jlpt-empty">${error.status===401?t('관리자 로그인 후 오답노트를 볼 수 있습니다.','管理者ログイン後に表示できます。'):t('오답노트를 불러오지 못했습니다.','誤答ノートを読み込めませんでした。')}</p>`;} }
	function renderWrongNotes(){ const list=document.getElementById('jlpt-wrong-list');if(!list)return;list.replaceChildren();if(!wrongItems.length){list.innerHTML=`<p class="jlpt-empty">${t('해당 오답이 없습니다.','該当する誤答はありません。')}</p>`;return;}const start=(wrongPage-1)*PAGE_SIZE;wrongItems.slice(start,start+PAGE_SIZE).forEach((item,index)=>{const a=document.createElement('article');a.className='jlpt-wrong-item';a.innerHTML=`<strong>${start+index+1}. ${escapeHtml(item.prompt)}</strong><p>${t('날짜','日付')}: ${escapeHtml(item.studyDate)} · ${t('오답 횟수','誤答回数')}: ${item.wrongCount}</p><p>${t('내 답','自分の答え')}: ${escapeHtml(item.selectedAnswer||'—')}</p><p>${t('정답','正解')}: <b>${escapeHtml(item.correctAnswer)}</b></p>${item.explanation?`<p>${escapeHtml(item.explanation)}</p>`:''}`;list.appendChild(a);});const pager=makePager(wrongItems.length,wrongPage,(p)=>{wrongPage=p;renderWrongNotes();});if(pager)list.appendChild(pager); }

	function init(){injectStyle();mountDateNav();setupWordPagination();setupCalendar();mountWrongNotes();updateDateLabel();}
	if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
