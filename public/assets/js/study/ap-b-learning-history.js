(() => {
  const body = document.body;
  const lang = body?.dataset?.blogLanguage === 'ko' ? 'ko' : 'ja';
  const t = (ko, ja) => lang === 'ko' ? ko : ja;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const PERFORMANCE_KEY = 'song:ap:b-reinforcement-performance:v1';
  const CHANGE_EVENT = 'song:ap:b-performance-changed';
  const fieldNames = {
    1: ['정보보안', '情報セキュリティ'], 2: ['경영전략', '経営戦略'], 3: ['프로그래밍', 'プログラミング'], 4: ['시스템 아키텍처', 'システムアーキテクチャ'], 5: ['네트워크', 'ネットワーク'], 6: ['데이터베이스', 'データベース'], 7: ['임베디드 시스템', '組込みシステム'], 8: ['시스템 개발', 'システム開発'], 9: ['프로젝트 관리', 'プロジェクトマネジメント'], 10: ['서비스 관리', 'サービスマネジメント'], 11: ['시스템 감사', 'システム監査'],
  };
  function subjectFromUrl() { return new URLSearchParams(location.search).get('subject') === 'B' ? 'B' : 'A'; }
  function readStore() {
    try { const data = JSON.parse(localStorage.getItem(PERFORMANCE_KEY) || '{}'); return { version: 1, attempts: Array.isArray(data?.attempts) ? data.attempts.slice(-20) : [] }; }
    catch { return { version: 1, attempts: [] }; }
  }
  function writeStore(attempts) {
    const safe = Array.isArray(attempts) ? attempts.slice(-20) : [];
    localStorage.setItem(PERFORMANCE_KEY, JSON.stringify({ version: 1, attempts: safe }));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { count: safe.length } }));
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
  function clampScore(value) { const n = Number(value); return Number.isFinite(n) ? Math.max(0, Math.min(20, n)) : null; }
  function normalizeAttempt(attempt, storageIndex) {
    const scores = {};
    const rawScores = attempt?.scores && typeof attempt.scores === 'object' ? attempt.scores : {};
    for (const [key, value] of Object.entries(rawScores)) {
      const no = Number(key), score = clampScore(value);
      if (no < 1 || no > 11 || score == null) continue;
      scores[no] = score;
    }
    const selectedRaw = Array.isArray(attempt?.selected) ? attempt.selected.map(Number) : Object.keys(scores).map(Number);
    const selected = selectedRaw.filter((no,index,all)=>no>=1&&no<=11&&all.indexOf(no)===index).sort((a,b)=>a-b);
    const totalRaw = Number(attempt?.total);
    const total = Number.isFinite(totalRaw) ? Math.max(0,Math.min(100,totalRaw)) : Object.values(scores).reduce((sum,value)=>sum+value,0);
    const focusRaw = Array.isArray(attempt?.focus) ? attempt.focus.map(Number) : [];
    const focus = focusRaw.filter((no,index,all)=>no>=2&&no<=11&&all.indexOf(no)===index).slice(0,4).sort((a,b)=>a-b);
    const source = ['weakness','progress','goal','simulation','manual'].includes(attempt?.source) ? attempt.source : 'legacy';
    const selectedOptional = selected.filter((no)=>no!==1);
    const focusMatched = focus.length===4 && selectedOptional.length===4 && focus.every((no)=>selectedOptional.includes(no));
    const durationRaw = Number(attempt?.durationSecondsUsed);
    const durationSecondsUsed = Number.isFinite(durationRaw) ? Math.max(0,Math.min(150*60,Math.round(durationRaw))) : null;
    const questionSeconds = {};
    const rawQuestionSeconds = attempt?.questionSeconds && typeof attempt.questionSeconds === 'object' ? attempt.questionSeconds : {};
    for (const [key,value] of Object.entries(rawQuestionSeconds)) {
      const no=Number(key), seconds=Number(value);
      if (no<1||no>11||!Number.isFinite(seconds)) continue;
      questionSeconds[no]=Math.max(0,Math.min(150*60,Math.round(seconds)));
    }
    return { storageIndex, at:attempt?.at, selected, scores, total, focus, source, focusMatched, durationSecondsUsed, questionSeconds, timedOut:Boolean(attempt?.timedOut), mode:attempt?.mode || null };
  }
  function formatDate(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return t('시간 미기록','日時未記録');
    try { return new Intl.DateTimeFormat(lang==='ko'?'ko-KR':'ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(date); }
    catch { return date.toLocaleString(); }
  }
  function formatDuration(seconds) {
    if (!Number.isFinite(seconds)) return '-';
    const h=Math.floor(seconds/3600), m=Math.floor((seconds%3600)/60), s=seconds%60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  function sourceLabel(attempt) {
    if (attempt.source==='weakness') return t('약점 자동 보강','弱点自動補強');
    if (attempt.source==='progress') return t('추이 기반 보강','推移ベース補強');
    if (attempt.source==='goal') return t('목표점수 보강','目標得点補強');
    if (attempt.source==='simulation') return attempt.timedOut ? t('150분 실전·시간만료','150分実戦・時間切れ') : t('150분 실전 시뮬레이션','150分実戦シミュレーション');
    if (attempt.source==='manual') return t('직접 선택','手動選択');
    return t('기존 기록','既存記録');
  }
  function recommendationLabel(attempt) {
    if (attempt.source==='simulation') return t('시간제한 실전','時間制限実戦');
    if (!attempt.focus.length) return attempt.source==='manual' ? t('직접 선택','手動選択') : t('판정 불가','判定不可');
    return attempt.focusMatched ? t('추천 4개 그대로 실시','推薦4分野をそのまま実施') : t('추천 후 분야 변경','推薦後に分野変更');
  }
  function fieldLabel(no) { const pair=fieldNames[no]||[`Q${no}`,`Q${no}`]; return t(pair[0],pair[1]); }
  function scoreDetail(attempt) {
    return attempt.selected.map((no)=>{
      const score=attempt.scores[no]==null?'-':`${attempt.scores[no]}/20`;
      const time=Number(attempt.questionSeconds?.[no]);
      return `Q${no} ${fieldLabel(no)} ${score}${Number.isFinite(time)&&time>0?` (${formatDuration(time)})`:''}`;
    }).join(' · ');
  }
  function locate() {
    let el=document.getElementById('ap-b-learning-history'); if (el) return el;
    const progress=document.getElementById('ap-b-progress-trends'), weakness=document.getElementById('ap-b-weakness-dashboard'), anchor=progress||weakness;
    if (!anchor?.parentElement) return null;
    el=document.createElement('section'); el.id='ap-b-learning-history'; el.className='ap-mock-section'; anchor.parentElement.insertBefore(el,anchor.nextSibling); return el;
  }
  function render() {
    const existing=document.getElementById('ap-b-learning-history');
    if (subjectFromUrl()!=='B') { if (existing) existing.hidden=true; return; }
    const el=locate(); if (!el) return; el.hidden=false;
    const data=readStore();
    const normalized=data.attempts.map((attempt,index)=>normalizeAttempt(attempt,index));
    const newest=normalized.slice().reverse();
    const totals=normalized.map((attempt)=>attempt.total).filter(Number.isFinite);
    const average=totals.length?totals.reduce((sum,value)=>sum+value,0)/totals.length:null;
    const best=totals.length?Math.max(...totals):null;
    const latest=normalized.length?normalized[normalized.length-1].total:null;
    if (!newest.length) {
      el.innerHTML=`<div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">SUBJECT B HISTORY</p><h2>${esc(t('科目B 학습 이력','科目B 学習履歴'))}</h2></div><p>0</p></div><section class="ap-mock-card"><p class="ap-past-guide">${esc(t('아직 저장된 자기채점 이력이 없습니다. 보정 실전 또는 150분 시뮬레이션을 완료하면 이곳에 회차별 기록이 쌓입니다.','保存済みの自己採点履歴はまだありません。補正実戦または150分シミュレーションを完了すると、ここに回ごとの履歴が蓄積されます。'))}</p><div class="ap-past-actions"><a class="ap-mock-button" href="/${lang}/study/ap/reinforcement/?subject=B">${esc(t('科目B 보정 실전','科目B補正実戦'))}</a><a class="ap-mock-button" href="/${lang}/study/ap/reinforcement/simulation/">${esc(t('150분 실전 시뮬레이션','150分実戦シミュレーション'))}</a></div></section>`;
      return;
    }
    const rows=newest.map((attempt)=>`<tr><td><strong>#${attempt.storageIndex+1}</strong></td><td>${esc(formatDate(attempt.at))}</td><td>${esc(sourceLabel(attempt))}</td><td>${esc(scoreDetail(attempt))}</td><td><strong>${attempt.total}/100</strong></td><td>${esc(formatDuration(attempt.durationSecondsUsed))}</td><td>${esc(recommendationLabel(attempt))}</td><td><button class="ap-mock-button" type="button" data-b-history-delete="${attempt.storageIndex}">${esc(t('삭제','削除'))}</button></td></tr>`).join('');
    el.innerHTML=`<div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">SUBJECT B HISTORY</p><h2>${esc(t('科目B 학습 이력','科目B 学習履歴'))}</h2></div><p>${esc(t(`최근 ${newest.length}회`,`直近${newest.length}回`))}</p></div><section class="ap-mock-card"><p class="ap-past-guide"><strong>${esc(t('최근 점수','直近スコア'))}:</strong> ${latest}/100 · <strong>${esc(t('평균','平均'))}:</strong> ${average.toFixed(1)}/100 · <strong>${esc(t('최고','最高'))}:</strong> ${best}/100</p><p class="ap-mock-note">${esc(t('최대 20회까지 브라우저에 보관합니다. 150분 실전은 전체 소요시간과 문항별 활성시간, 시간만료 여부도 함께 기록합니다. 개별 삭제나 전체 초기화 후 선택전략·약점·점수추이·목표점수·시간배분 판정도 다시 계산됩니다.','最大20回までブラウザに保存します。150分実戦は全体所要時間・問題別アクティブ時間・時間切れかどうかも記録します。個別削除や全消去後は選択戦略・弱点・得点推移・目標得点・時間配分判定も再計算されます。'))}</p><div class="ap-past-actions"><a class="ap-mock-button" href="/${lang}/study/ap/reinforcement/?subject=B">${esc(t('새 보정 실전','新しい補正実戦'))}</a><a class="ap-mock-button" href="/${lang}/study/ap/reinforcement/simulation/">${esc(t('150분 실전 시뮬레이션','150分実戦シミュレーション'))}</a><button class="ap-mock-button" type="button" data-b-history-clear>${esc(t('전체 이력 초기화','履歴をすべて消去'))}</button></div><div class="ap-mock-table-wrap"><table class="ap-mock-table"><thead><tr><th>${esc(t('회차','回'))}</th><th>${esc(t('실시일시','実施日時'))}</th><th>${esc(t('실시 방식','実施方式'))}</th><th>${esc(t('선택 분야·점수·문항시간','選択分野・得点・問題時間'))}</th><th>${esc(t('총점','合計'))}</th><th>${esc(t('전체 소요시간','全体所要時間'))}</th><th>${esc(t('추천·실전 구분','推薦・実戦区分'))}</th><th>${esc(t('관리','管理'))}</th></tr></thead><tbody>${rows}</tbody></table></div><p class="ap-mock-note">${esc(t('답안 원문은 이 이력에 저장하지 않습니다. “기존 기록”은 추천 출처 메타데이터 저장 전의 이력입니다.','解答本文はこの履歴に保存しません。「既存記録」は推薦元メタデータ保存開始前の履歴です。'))}</p></section>`;
  }
  document.addEventListener('click',(event)=>{
    const recommendationLink=event.target.closest?.('a[href*="focus="]');
    if (recommendationLink) {
      const source=recommendationLink.closest('#ap-b-weakness-dashboard')?'weakness':recommendationLink.closest('#ap-b-progress-trends')?'progress':recommendationLink.closest('#ap-b-score-goal')?'goal':null;
      if (source) { const url=new URL(recommendationLink.href,location.href); url.searchParams.set('source',source); recommendationLink.href=`${url.pathname}${url.search}${url.hash}`; }
    }
    const deleteButton=event.target.closest?.('[data-b-history-delete]');
    if (deleteButton) {
      const index=Number(deleteButton.dataset.bHistoryDelete), data=readStore();
      if (!Number.isInteger(index)||index<0||index>=data.attempts.length) return;
      if (!confirm(t('이 자기채점 기록 1건을 삭제할까요? 삭제하면 약점·추이·목표점수·시간배분 판정도 다시 계산됩니다.','この自己採点履歴1件を削除しますか？削除すると弱点・推移・目標得点・時間配分判定も再計算されます。'))) return;
      data.attempts.splice(index,1); writeStore(data.attempts); return;
    }
    const clearButton=event.target.closest?.('[data-b-history-clear]');
    if (clearButton) {
      if (!confirm(t('科目B 자기채점 이력을 전부 삭제할까요? 이 작업은 되돌릴 수 없습니다.','科目Bの自己採点履歴をすべて削除しますか？この操作は元に戻せません。'))) return;
      writeStore([]); return;
    }
    if (event.target.closest?.('[data-ap-mock-subject]')) setTimeout(render,0);
  });
  window.addEventListener('popstate',render);
  window.addEventListener('storage',(event)=>{ if (event.key===PERFORMANCE_KEY) render(); });
  window.addEventListener(CHANGE_EVENT,render);
  const observer=new MutationObserver(()=>{ if (!document.getElementById('ap-b-weakness-dashboard')) return; observer.disconnect(); render(); });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  render();
})();
