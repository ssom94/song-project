(() => {
  const body = document.body;
  const lang = body?.dataset?.blogLanguage === 'ko' ? 'ko' : 'ja';
  const t = (ko, ja) => lang === 'ko' ? ko : ja;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const KEY = 'song:ap:b-selection-strategy:v1';
  const fields = [
    [2,'경영전략','経営戦略'],[3,'프로그래밍','プログラミング'],[4,'시스템 아키텍처','システムアーキテクチャ'],[5,'네트워크','ネットワーク'],[6,'데이터베이스','データベース'],[7,'임베디드 시스템','組込みシステム'],[8,'시스템 개발','システム開発'],[9,'프로젝트 관리','プロジェクトマネジメント'],[10,'서비스 관리','サービスマネジメント'],[11,'시스템 감사','システム監査']
  ];
  const sessions = ['2025-autumn','2025-spring','2024-autumn','2024-spring','2023-autumn'];
  const weights = { confidence: 0.55, difficulty: 0.30, reserve: 0.15 };
  let difficultiesPromise = null;

  function loadState() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
  function saveState(value) { localStorage.setItem(KEY, JSON.stringify(value)); }
  function subjectFromUrl() { return new URLSearchParams(location.search).get('subject') === 'B' ? 'B' : 'A'; }
  async function json(url) { const r = await fetch(url, { credentials:'same-origin' }); if (!r.ok) throw new Error(`HTTP_${r.status}`); return r.json(); }
  function avg(a) { return a.length ? a.reduce((s,v)=>s+v,0)/a.length : 0; }
  function score(confidence, difficulty) {
    const confidenceScore = (confidence - 1) / 4 * 100;
    const difficultyScore = (4 - difficulty) / 3 * 100;
    const reserveScore = confidence >= 3 ? 100 : confidence === 2 ? 45 : 0;
    return Math.round(confidenceScore * weights.confidence + difficultyScore * weights.difficulty + reserveScore * weights.reserve);
  }
  async function loadDifficulties() {
    if (difficultiesPromise) return difficultiesPromise;
    difficultiesPromise = Promise.all(sessions.map((s)=>json(`/assets/data/ap-past-study/${s}-B.json`))).then((sets) => {
      const out = {};
      for (const [no] of fields) out[no] = avg(sets.map((set)=>Number((set.questions||[]).find((q)=>Number(q.questionNo)===no)?.difficulty)).filter(Number.isFinite));
      return out;
    });
    return difficultiesPromise;
  }
  function locate() {
    let el = document.getElementById('ap-b-selection-strategy');
    if (el) return el;
    const analysis = document.getElementById('ap-mock-past-analysis-b');
    if (!analysis?.parentElement) return null;
    el = document.createElement('section');
    el.id = 'ap-b-selection-strategy';
    el.className = 'ap-mock-section';
    analysis.parentElement.insertBefore(el, analysis.nextSibling);
    return el;
  }
  function renderResult(el, difficulties, state) {
    const ranked = fields.map(([no,ko,ja]) => {
      const confidence = Number(state[no] || 3);
      const difficulty = difficulties[no] || 3;
      return { no, ko, ja, confidence, difficulty, score: score(confidence,difficulty) };
    }).sort((a,b)=>b.score-a.score || a.difficulty-b.difficulty || a.no-b.no);
    const primary = ranked.slice(0,4);
    const reserve = ranked.slice(4,6);
    const rows = ranked.map((x,i)=>`<tr><td>${i+1}</td><td><strong>Q${x.no} ${esc(t(x.ko,x.ja))}</strong></td><td>${x.confidence}/5</td><td>${x.difficulty.toFixed(2)}</td><td><strong>${x.score}</strong></td><td>${i<4?esc(t('주력','主力')):i<6?esc(t('예비','予備')):esc(t('후순위','後順位'))}</td></tr>`).join('');
    const names = (xs)=>xs.map((x)=>`Q${x.no} ${t(x.ko,x.ja)}`).join(' · ');
    const result = el.querySelector('[data-strategy-result]');
    result.innerHTML = `<h3>${esc(t('추천 선택전략','推奨選択戦略'))}</h3><p class="ap-past-guide"><strong>${esc(t('주력 4개','主力4分野'))}:</strong> ${esc(names(primary))}<br><strong>${esc(t('예비 2개','予備2分野'))}:</strong> ${esc(names(reserve))}</p><p class="ap-mock-note">${esc(t('실전에서는 Q1 정보보안을 반드시 풀고, 주력 4개를 먼저 훑은 뒤 문제가 불리하면 예비 분야로 교체합니다. 난이도만으로 고르지 않고 본인 자신감을 더 크게 반영합니다.','本番ではQ1情報セキュリティを必ず解き、主力4分野を先に確認し、問題との相性が悪ければ予備分野へ切り替えます。難易度だけでなく自己評価をより強く反映します。'))}</p><div class="ap-mock-table-wrap"><table class="ap-mock-table"><thead><tr><th>#</th><th>${esc(t('분야','分野'))}</th><th>${esc(t('자신감','自信度'))}</th><th>${esc(t('기출 난이도','過去問難易度'))}</th><th>${esc(t('추천점수','推奨点'))}</th><th>${esc(t('역할','役割'))}</th></tr></thead><tbody>${rows}</tbody></table></div><div class="ap-past-actions"><a class="ap-mock-button" href="/${lang}/study/ap/reinforcement/?subject=B">${esc(t('科目B 보정 실전에서 시험하기','科目B補正実戦で試す'))}</a></div>`;
    result.hidden = false;
  }
  async function render() {
    const subject = subjectFromUrl();
    const existing = document.getElementById('ap-b-selection-strategy');
    if (subject !== 'B') {
      if (existing) existing.hidden = true;
      return;
    }
    const el = locate();
    if (!el) return;
    el.hidden = false;
    el.innerHTML = `<div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">MY SUBJECT B STRATEGY</p><h2>${esc(t('내 科目B 선택분야 전략','自分の科目B選択分野戦略'))}</h2></div><p>${esc(t('주력 4개 + 예비 2개','主力4分野 + 予備2分野'))}</p></div><section class="ap-mock-card"><p class="ap-past-guide">${esc(t('Q2~Q11 각 분야의 현재 자신감을 1~5로 지정하세요. 실제 기출 5회의 평균 난이도와 합산해 주력 4개와 예비 2개를 추천합니다. 값은 이 브라우저에만 저장되며 D1을 사용하지 않습니다.','Q2〜Q11各分野の現在の自信度を1〜5で指定してください。過去問5回の平均難易度と組み合わせ、主力4分野と予備2分野を推薦します。値はこのブラウザだけに保存し、D1は使用しません。'))}</p><div class="ap-mock-table-wrap"><table class="ap-mock-table"><thead><tr><th>${esc(t('분야','分野'))}</th><th>${esc(t('자신감 1~5','自信度1〜5'))}</th></tr></thead><tbody data-strategy-inputs></tbody></table></div><div class="ap-past-actions"><button class="ap-mock-button" type="button" data-strategy-calc>${esc(t('추천 계산·저장','推薦を計算・保存'))}</button><button class="ap-mock-button" type="button" data-strategy-reset>${esc(t('초기화','リセット'))}</button></div><div data-strategy-result hidden></div></section>`;
    const state = loadState();
    const tbody = el.querySelector('[data-strategy-inputs]');
    tbody.innerHTML = fields.map(([no,ko,ja])=>`<tr><td><strong>Q${no}</strong> · ${esc(t(ko,ja))}</td><td><select data-confidence="${no}">${[1,2,3,4,5].map((v)=>`<option value="${v}"${Number(state[no]||3)===v?' selected':''}>${v} · ${esc(v===1?t('매우 약함','かなり苦手'):v===2?t('약함','苦手'):v===3?t('보통','普通'):v===4?t('강함','得意'):t('매우 강함','かなり得意'))}</option>`).join('')}</select></td></tr>`).join('');
    const difficulties = await loadDifficulties();
    if (subjectFromUrl() !== 'B' || !el.isConnected) return;
    if (Object.keys(state).length) renderResult(el,difficulties,state);
    el.querySelector('[data-strategy-calc]')?.addEventListener('click',()=>{
      const next={};
      el.querySelectorAll('[data-confidence]').forEach((s)=>next[s.dataset.confidence]=Number(s.value));
      saveState(next);
      renderResult(el,difficulties,next);
    });
    el.querySelector('[data-strategy-reset]')?.addEventListener('click',()=>{
      localStorage.removeItem(KEY);
      el.querySelectorAll('[data-confidence]').forEach((s)=>s.value='3');
      const result = el.querySelector('[data-strategy-result]');
      if (result) result.hidden=true;
    });
  }
  document.addEventListener('click', (event) => {
    const tab = event.target.closest?.('[data-ap-mock-subject]');
    if (!tab) return;
    setTimeout(() => render().catch((e)=>console.error('AP_B_SELECTION_STRATEGY_FAILED',e)), 0);
  });
  window.addEventListener('popstate', () => render().catch((e)=>console.error('AP_B_SELECTION_STRATEGY_FAILED',e)));
  const observer = new MutationObserver(()=>{
    if (!document.getElementById('ap-mock-past-analysis-b')) return;
    observer.disconnect();
    render().catch((e)=>console.error('AP_B_SELECTION_STRATEGY_FAILED',e));
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  render().catch((e)=>console.error('AP_B_SELECTION_STRATEGY_FAILED',e));
})();
