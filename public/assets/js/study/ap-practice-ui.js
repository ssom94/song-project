(() => {
  const esc = (v) => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  const ko = document.body.dataset.blogLanguage !== 'ja';
  const label = ko ? {
    title:'오늘의 문제 풀이', concept:'개념 학습', a:'科目A · 4지선다', b:'科目B · 실전', submit:'정답 확인', answer:'답 입력',
    empty:'오늘 등록된 AP 문제가 없습니다.', correct:'정답', wrong:'오답', model:'모범답안', self:'자기채점', good:'정답/이해', partial:'애매함', bad:'오답',
    loadFail:'오늘의 AP 문제를 불러오지 못했습니다.'
  } : {
    title:'今日の問題演習', concept:'概念学習', a:'科目A · 四肢択一', b:'科目B · 実践', submit:'答え合わせ', answer:'解答を入力',
    empty:'今日登録されたAP問題はありません。', correct:'正解', wrong:'誤答', model:'模範解答', self:'自己採点', good:'正解/理解', partial:'曖昧', bad:'誤答',
    loadFail:'今日のAP問題を読み込めませんでした。'
  };

  async function json(url, opts={}) {
    const r = await fetch(url,{credentials:'same-origin',cache:'no-store',...opts});
    const d = await r.json().catch(() => null);
    if(!r.ok || !d?.ok) throw new Error(d?.error || `HTTP_${r.status}`);
    return d;
  }

  function question(q, idx, prefix) {
    const options=(q.options||[]).map((o,i)=>`<label class="ap-practice-option"><input type="radio" name="${esc(q.key)}" value="${esc(o)}"><span>${i+1}. ${esc(o)}</span></label>`).join('');
    return `<article class="ap-practice-question" data-q="${esc(q.key)}"><b>${prefix} ${idx+1}</b><p>${esc(q.prompt)}</p>${options}<div class="ap-practice-actions"><button type="button" data-grade="${esc(q.key)}">${label.submit}</button></div><div class="ap-practice-result" hidden></div></article>`;
  }

  function prepareHost() {
    const host=document.querySelector('.ap-today-card');
    if(!host) return null;
    const legacy=host.querySelector('#ap-today-items');
    if(legacy) legacy.hidden=true;
    const start=host.querySelector('#ap-start-today');
    if(start) start.hidden=true;
    const login=host.querySelector('#ap-login-note');
    if(login) login.hidden=true;
    let sec=host.querySelector('#ap-real-practice');
    if(!sec){ sec=document.createElement('div'); sec.id='ap-real-practice'; sec.className='ap-real-practice'; host.appendChild(sec); }
    return sec;
  }

  function render(data) {
    const sec=prepareHost(); if(!sec) return;
    let html=`<div class="ap-section-head ap-practice-head"><div><p class="ap-section-eyebrow">DAILY PRACTICE</p><h2>${label.title}</h2><p>${esc(data.studyDate)}</p></div></div>`;
    const concepts=(data.concepts||[]).filter(x=>x.summaryKo||x.summaryJa||x.check||x.prompt);
    if(concepts.length){
      html+=`<section><h3>${label.concept}</h3>`;
      concepts.forEach((c)=>{ const summary=ko?c.summaryKo:c.summaryJa; html+=`<article class="ap-concept-box"><h4>${esc(ko?c.titleKo:c.titleJa)}</h4><p>${esc(summary)}</p>${c.key&&c.prompt?question(c,0,'CHECK'):c.check?question(c.check,0,'CHECK'):''}</article>`; });
      html+='</section>';
    }
    if((data.subjectA||[]).length){ html+=`<section><h3>${label.a}</h3>${data.subjectA.map((q,i)=>question(q,i,'A')).join('')}</section>`; }
    if((data.subjectB||[]).length){
      html+=`<section><h3>${label.b}</h3>`;
      data.subjectB.forEach((b)=>{
        html+=`<article class="ap-subject-b"><h4>${esc(ko?b.titleKo:b.titleJa)}</h4><p class="ap-b-scenario">${esc(b.scenario)}</p>`;
        (b.questions||[]).forEach((q,i)=>{ html+=`<div class="ap-practice-question" data-q="${esc(q.key)}"><b>B${i+1}</b><p>${esc(q.prompt)}</p><textarea rows="3" data-b-answer="${esc(q.key)}" placeholder="${label.answer}"></textarea><div class="ap-practice-actions"><button type="button" data-grade-b="${esc(q.key)}">${label.submit}</button></div><div class="ap-practice-result" hidden></div></div>`; });
        html+='</article>';
      });
      html+='</section>';
    }
    if(!concepts.length && !(data.subjectA||[]).length && !(data.subjectB||[]).length) html+=`<p class="ap-practice-message">${label.empty}</p>`;
    sec.innerHTML=html;
    sec.querySelectorAll('[data-grade]').forEach(b=>b.addEventListener('click',gradeChoice));
    sec.querySelectorAll('[data-grade-b]').forEach(b=>b.addEventListener('click',gradeB));
  }

  async function gradeChoice(e){
    const key=e.currentTarget.dataset.grade; const box=e.currentTarget.closest('[data-q]'); const checked=box.querySelector('input:checked'); if(!checked)return;
    const d=await json('/api/public/ap/practice/grade',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({questionKey:key,selectedAnswer:checked.value})}); show(box,d);
  }
  async function gradeB(e){
    const key=e.currentTarget.dataset.gradeB; const box=e.currentTarget.closest('[data-q]'); const val=box.querySelector('[data-b-answer]').value.trim(); if(!val)return;
    const d=await json('/api/public/ap/practice/grade',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({questionKey:key,selectedAnswer:val})});
    const r=box.querySelector('.ap-practice-result'); r.hidden=false;
    r.innerHTML=`<b>${label.model}</b><p>${esc(d.correctAnswer)}</p>${d.explanation?`<p>${esc(d.explanation)}</p>`:''}<div class="ap-self-grade"><span>${label.self}</span><button data-self="correct">${label.good}</button><button data-self="partial">${label.partial}</button><button data-self="wrong">${label.bad}</button></div>`;
    r.querySelectorAll('[data-self]').forEach(btn=>btn.addEventListener('click',async()=>{ const fin=await json('/api/public/ap/practice/grade',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({questionKey:key,selectedAnswer:val,selfResult:btn.dataset.self})}); show(box,fin); }));
  }
  function show(box,d){ const r=box.querySelector('.ap-practice-result'); r.hidden=false; const ok=d.result==='correct'||d.correct; r.innerHTML=`<strong>${ok?'✓ '+label.correct:'✗ '+label.wrong}</strong>${d.correctAnswer?`<p>${label.correct}: ${esc(d.correctAnswer)}</p>`:''}${d.explanation?`<p>${esc(d.explanation)}</p>`:''}`; }

  function style(){
    if(document.getElementById('ap-practice-style')) return;
    const s=document.createElement('style'); s.id='ap-practice-style';
    s.textContent=`#ap-today-items[hidden],#ap-start-today[hidden],#ap-login-note[hidden]{display:none!important}.ap-real-practice{margin-top:18px}.ap-practice-head{margin-bottom:10px}.ap-real-practice section+section{margin-top:26px}.ap-concept-box,.ap-practice-question,.ap-subject-b{border:1px solid #dfe5ee;border-radius:18px;padding:18px;margin:12px 0;background:#fff}.ap-practice-option{display:flex;gap:10px;padding:11px;margin:7px 0;border:1px solid #e5e8ee;border-radius:12px;cursor:pointer}.ap-practice-actions{margin-top:12px}.ap-practice-actions button,.ap-self-grade button{padding:10px 14px;border:1px solid #ccd5e2;border-radius:10px;background:#fff}.ap-practice-result{margin-top:12px;padding:12px;border-radius:12px;background:#f3f7fc}.ap-b-scenario{white-space:pre-wrap;line-height:1.8}.ap-practice-question textarea{width:100%;box-sizing:border-box;border:1px solid #ccd5e2;border-radius:10px;padding:10px}.ap-self-grade{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}.ap-practice-message{padding:16px;border-radius:14px;background:#f6f8fb}`;
    document.head.appendChild(s);
  }

  async function load(){
    style(); const sec=prepareHost(); if(sec) sec.innerHTML=`<p class="ap-practice-message">${ko?'오늘의 AP 문제를 불러오는 중입니다.':'今日のAP問題を読み込んでいます。'}</p>`;
    try{ render(await json('/api/public/ap/practice')); }
    catch(e){ console.error('AP practice load failed',e); const target=prepareHost(); if(target) target.innerHTML=`<p class="ap-practice-message">${label.loadFail}<br><small>${esc(e.message)}</small></p>`; }
  }
  load();
})();
