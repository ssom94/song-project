(() => {
  const META_API = '/api/public/ap/concepts';
  const PROGRESS_API = '/api/public/ap/concept-progress';
  const UPDATE_API = '/api/admin/ap/concept-progress';
  const lang = document.body?.dataset?.blogLanguage === 'ja' ? 'ja' : 'ko';
  const t = (ko, ja) => lang === 'ja' ? ja : ko;
  const params = new URLSearchParams(location.search);
  const code = (params.get('code') || params.get('no') || '').trim().toUpperCase();
  let concepts = [];
  let completed = new Set();
  let refreshTimer = 0;

  function key(conceptCode, typeNo) { return `${conceptCode}:${Number(typeNo)}`; }
  function isComplete(conceptCode, typeNo) { return completed.has(key(conceptCode, typeNo)); }
  function completedCount(conceptCode, total) {
    let count = 0;
    for (let n = 1; n <= Number(total || 0); n += 1) if (isComplete(conceptCode, n)) count += 1;
    return count;
  }
  async function requestJson(url, options = {}) {
    const response = await fetch(url, { credentials:'same-origin', cache:'no-store', ...options });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw Object.assign(new Error(data?.error || `HTTP_${response.status}`), { status:response.status });
    return data;
  }

  function injectStyle() {
    if (document.getElementById('ap-concept-progress-style')) return;
    const style = document.createElement('style');
    style.id = 'ap-concept-progress-style';
    style.textContent = `
      .ap-concept-progress-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0 18px}
      .ap-concept-progress-summary>div{padding:12px 14px;border:1px solid #d9e1ea;border-radius:12px;background:#f8fafc}
      .ap-concept-progress-summary span{display:block;font-size:12px;color:#66758a;font-weight:700}.ap-concept-progress-summary strong{display:block;margin-top:5px;font-size:20px;color:#26364e}
      .ap-concept-row-progress{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:11px;font-weight:800;color:#66758a;margin-bottom:7px}.ap-concept-row-progress b{color:#26364e}
      .ap-type-study-check{display:flex;align-items:center;gap:8px;margin-left:auto;padding:6px 10px;border-radius:999px;background:#f7f3f4;border:1px solid #dcc9ce;color:#7e3948;font-size:12px;font-weight:800;cursor:pointer}.ap-type-study-check input{width:17px;height:17px;accent-color:#7e3948}
      .ap-type-study-check.is-saving{opacity:.55;pointer-events:none}.ap-type-study-error{color:#b44c4c;font-size:11px;margin-left:8px}
      .ap-problem-type-section.is-type-complete{border-color:#a9cfb5;background:#f5fbf7}.ap-problem-type-section.is-type-complete .ap-problem-type-label{color:#2f7550}
      .ap-today-concept-progress{margin:14px 0 0;padding:12px;border:1px solid #dde4ec;border-radius:12px;background:#fafbfc}.ap-today-concept-progress h3{margin:0 0 9px;font-size:15px}
      .ap-today-concept-progress-list{display:grid;gap:7px}.ap-today-concept-progress-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:9px;background:#fff;border:1px solid #e2e7ed;font-size:12px}.ap-today-concept-progress-row strong{font-size:12px}
      @media(max-width:640px){.ap-concept-progress-summary{grid-template-columns:1fr}.ap-type-study-check{margin-left:0}.ap-concept-progress-summary strong{font-size:18px}}
    `;
    document.head.appendChild(style);
  }

  async function loadState() {
    const [meta, progress] = await Promise.all([requestJson(META_API), requestJson(PROGRESS_API)]);
    concepts = meta.concepts || [];
    completed = new Set((progress.completed || []).map((row) => key(row.conceptCode, row.typeNo)));
  }

  function addSummary() {
    const card = document.querySelector('.ap-concept-card');
    if (!card || !concepts.length) return;
    let box = document.getElementById('ap-concept-progress-summary');
    if (!box) {
      box = document.createElement('div'); box.id = 'ap-concept-progress-summary'; box.className = 'ap-concept-progress-summary';
      const wrap = card.querySelector('.ap-concept-table-wrap'); card.insertBefore(box, wrap || card.firstChild);
    }
    const visiblePart = new URLSearchParams(location.search).get('part') === 'B' ? 'B' : 'A';
    const visible = concepts.filter((c) => c.examPart === visiblePart);
    const totalTypes = visible.reduce((sum,c)=>sum+Number(c.problemTypeCount||0),0);
    const doneTypes = visible.reduce((sum,c)=>sum+completedCount(c.code,c.problemTypeCount),0);
    const totalConcepts = visible.filter((c)=>Number(c.problemTypeCount||0)>0).length;
    const doneConcepts = visible.filter((c)=>Number(c.problemTypeCount||0)>0 && completedCount(c.code,c.problemTypeCount)>=Number(c.problemTypeCount)).length;
    box.innerHTML = `<div><span>${t('전체 유형 / 학습 유형','全タイプ / 学習済みタイプ')}</span><strong>${totalTypes} / ${doneTypes}</strong></div><div><span>${t('전체 개념 / 학습완료 개념','全概念 / 学習完了')}</span><strong>${totalConcepts} / ${doneConcepts}</strong></div>`;
  }

  function decorateList() {
    const rows = [...document.querySelectorAll('#ap-concept-body tr')];
    if (!rows.length || !concepts.length) return;
    const map = new Map(concepts.map((c)=>[c.code,c]));
    rows.forEach((tr)=>{
      const cells = tr.children; const conceptCode = cells[1]?.textContent.trim().toUpperCase(); const concept = map.get(conceptCode);
      if (!concept || !cells[4]) return;
      const total = Number(concept.problemTypeCount||0), done = completedCount(conceptCode,total);
      let p = cells[4].querySelector('.ap-concept-row-progress');
      if (!p) { p=document.createElement('div'); p.className='ap-concept-row-progress'; const actions=cells[4].querySelector('.ap-concept-actions'); cells[4].insertBefore(p,actions||cells[4].firstChild); }
      p.innerHTML = `<span>${t('전체유형','全タイプ')}: <b>${total}</b></span><span>${t('학습갯수','学習済み')}: <b>${done}</b></span>`;
    });
    addSummary();
  }

  async function saveType(section, label, input, caption, typeNo) {
    const previous = !input.checked;
    label.classList.add('is-saving');
    label.querySelector('.ap-type-study-error')?.remove();
    try {
      await requestJson(UPDATE_API, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ conceptCode:code, typeNo, completed:input.checked }) });
      if (input.checked) completed.add(key(code,typeNo)); else completed.delete(key(code,typeNo));
      caption.textContent = input.checked ? t('학습완료','学習完了') : t('유형 학습완료 체크','タイプ学習完了');
      section.classList.toggle('is-type-complete', input.checked);
      decorateList(); addSummary(); decorateToday();
    } catch (error) {
      input.checked = previous;
      section.classList.toggle('is-type-complete', previous);
      caption.textContent = previous ? t('학습완료','学習完了') : t('유형 학습완료 체크','タイプ学習完了');
      const span=document.createElement('span'); span.className='ap-type-study-error'; span.textContent=error.status===401?t('관리자 로그인 필요','管理者ログインが必要'):t('저장 실패','保存失敗'); label.appendChild(span);
    } finally { label.classList.remove('is-saving'); }
  }

  function decorateProblemTypes() {
    if (!code) return;
    const sections = [...document.querySelectorAll('.ap-problem-type-section')];
    sections.forEach((section,index)=>{
      const typeLabel=section.querySelector('.ap-problem-type-label'); const match=typeLabel?.textContent.match(/(?:番号|번호)\s*(\d+)/); const typeNo=Number(match?.[1]||index+1);
      let check=section.querySelector('.ap-type-study-check');
      if (!check) {
        check=document.createElement('label'); check.className='ap-type-study-check';
        const input=document.createElement('input'); input.type='checkbox'; const caption=document.createElement('span'); check.append(input,caption); typeLabel?.appendChild(check);
        input.addEventListener('change',()=>saveType(section,check,input,caption,typeNo));
      }
      const input=check.querySelector('input'), caption=check.querySelector('span'); if (!input || !caption) return;
      input.checked=isComplete(code,typeNo); caption.textContent=input.checked?t('학습완료','学習完了'):t('유형 학습완료 체크','タイプ学習完了'); section.classList.toggle('is-type-complete',input.checked);
    });
  }

  const topicUnits={fundamentals_math:['기초이론'],computer_architecture:['컴퓨터구성'],operating_system:['OS'],programming_algorithms:['알고리즘','프로그래밍'],database:['데이터베이스'],network:['네트워크'],security:['보안','정보보안'],system_development:['개발','시스템개발'],system_performance:['시스템','시스템구성'],project_management:['PM'],service_management:['서비스관리'],system_audit:['감사'],system_strategy:['전략'],business_strategy:['전략','전략·경영'],accounting_legal:['회계','법무']};
  function decorateToday() {
    const todayItems=document.getElementById('ap-today-items'); if(!todayItems||!concepts.length)return;
    const cards=[...todayItems.querySelectorAll('.ap-today-item')]; if(!cards.length)return;
    const rows=[];
    for(const card of cards){
      const textContent=card.textContent||''; const topic=Object.keys(topicUnits).find((topicCode)=>{
        const related=concepts.filter((c)=>topicUnits[topicCode].includes(c.unitKo)); return related.some((c)=>textContent.includes(c.titleKo)||textContent.includes(c.titleJa));
      });
      if(!topic)continue; const related=concepts.filter((c)=>topicUnits[topic].includes(c.unitKo)); const total=related.reduce((s,c)=>s+Number(c.problemTypeCount||0),0); const done=related.reduce((s,c)=>s+completedCount(c.code,c.problemTypeCount),0);
      if(total>0)rows.push(`<div class="ap-today-concept-progress-row"><span>${card.querySelector('strong')?.textContent||topic}</span><strong>${t('문제유형','問題タイプ')} ${total} / ${t('학습완료','学習完了')} ${done}</strong></div>`);
    }
    let box=document.getElementById('ap-today-concept-progress'); if(!rows.length){box?.remove();return;} if(!box){box=document.createElement('section');box.id='ap-today-concept-progress';box.className='ap-today-concept-progress';todayItems.before(box);} box.innerHTML=`<h3>${t('오늘의 개념별 진척상황','今日の概念別進捗')}</h3><div class="ap-today-concept-progress-list">${rows.join('')}</div>`;
  }

  async function refresh() {
    injectStyle();
    try { await loadState(); decorateList(); decorateProblemTypes(); decorateToday(); }
    catch (error) { console.error('Failed to load AP concept progress', error); }
  }
  function init() {
    refresh();
    const root=document.querySelector('.ap-study-content')||document.body;
    new MutationObserver(()=>{clearTimeout(refreshTimer);refreshTimer=window.setTimeout(()=>{decorateList();decorateProblemTypes();decorateToday();},80);}).observe(root,{childList:true,subtree:true});
    window.addEventListener('focus',refresh);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
