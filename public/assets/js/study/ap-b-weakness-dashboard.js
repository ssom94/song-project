(() => {
  const body = document.body;
  const lang = body?.dataset?.blogLanguage === 'ko' ? 'ko' : 'ja';
  const t = (ko, ja) => lang === 'ko' ? ko : ja;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const STRATEGY_KEY = 'song:ap:b-selection-strategy:v1';
  const PERFORMANCE_KEY = 'song:ap:b-reinforcement-performance:v1';
  const sessions = ['2025-autumn','2025-spring','2024-autumn','2024-spring','2023-autumn'];
  const fields = [
    [2,'경영전략','経営戦略'],[3,'프로그래밍','プログラミング'],[4,'시스템 아키텍처','システムアーキテクチャ'],[5,'네트워크','ネットワーク'],[6,'데이터베이스','データベース'],[7,'임베디드 시스템','組込みシステム'],[8,'시스템 개발','システム開発'],[9,'프로젝트 관리','プロジェクトマネジメント'],[10,'서비스 관리','サービスマネジメント'],[11,'시스템 감사','システム監査']
  ];
  let difficultyPromise = null;

  function subjectFromUrl() { return new URLSearchParams(location.search).get('subject') === 'B' ? 'B' : 'A'; }
  function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch { return fallback; } }
  async function json(url) { const r = await fetch(url, { credentials: 'same-origin' }); if (!r.ok) throw new Error(`HTTP_${r.status}`); return r.json(); }
  function avg(values) { return values.length ? values.reduce((s,v)=>s+v,0)/values.length : 0; }
  async function loadDifficulty() {
    if (difficultyPromise) return difficultyPromise;
    difficultyPromise = Promise.all(sessions.map((s)=>json(`/assets/data/ap-past-study/${s}-B.json`))).then((sets) => {
      const out = {};
      for (const [no] of fields) {
        const values = sets.map((set)=>Number((set.questions||[]).find((q)=>Number(q.questionNo)===no)?.difficulty)).filter(Number.isFinite);
        out[no] = avg(values) || 3;
      }
      return out;
    });
    return difficultyPromise;
  }
  function aggregatePerformance() {
    const data = readJson(PERFORMANCE_KEY, { attempts: [] });
    const attempts = Array.isArray(data?.attempts) ? data.attempts : [];
    const result = {};
    for (const [no] of fields) result[no] = { scores: [], last: null };
    for (const attempt of attempts) {
      const scores = attempt?.scores && typeof attempt.scores === 'object' ? attempt.scores : {};
      for (const [key, value] of Object.entries(scores)) {
        const no = Number(key); const n = Number(value);
        if (!result[no] || !Number.isFinite(n)) continue;
        const clamped = Math.max(0, Math.min(20, n));
        result[no].scores.push(clamped);
        result[no].last = clamped;
      }
    }
    return { attempts, byField: result };
  }
  function weaknessScore(confidence, difficulty, perf) {
    const confidenceWeak = (5 - confidence) / 4 * 100;
    const difficultyRisk = (difficulty - 1) / 3 * 100;
    if (perf.count > 0) {
      const performanceWeak = 100 - perf.percent;
      const sampleRisk = Math.max(0, 100 - Math.min(4, perf.count) * 25);
      return Math.round(performanceWeak * 0.55 + confidenceWeak * 0.20 + difficultyRisk * 0.15 + sampleRisk * 0.10);
    }
    return Math.round(confidenceWeak * 0.45 + difficultyRisk * 0.25 + 30);
  }
  function label(score, count) {
    if (!count) return t('미측정','未測定');
    if (score >= 65) return t('최우선 보강','最優先補強');
    if (score >= 45) return t('보강 권장','補強推奨');
    if (score >= 25) return t('유지 연습','維持練習');
    return t('안정','安定');
  }
  function locate() {
    let el = document.getElementById('ap-b-weakness-dashboard');
    if (el) return el;
    const strategy = document.getElementById('ap-b-selection-strategy');
    const analysis = document.getElementById('ap-mock-past-analysis-b');
    const anchor = strategy || analysis;
    if (!anchor?.parentElement) return null;
    el = document.createElement('section');
    el.id = 'ap-b-weakness-dashboard';
    el.className = 'ap-mock-section';
    anchor.parentElement.insertBefore(el, anchor.nextSibling);
    return el;
  }
  async function render() {
    const existing = document.getElementById('ap-b-weakness-dashboard');
    if (subjectFromUrl() !== 'B') { if (existing) existing.hidden = true; return; }
    const el = locate(); if (!el) return;
    el.hidden = false;
    el.innerHTML = `<div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">SUBJECT B WEAKNESS</p><h2>${esc(t('科目B 약점 대시보드','科目B 弱点ダッシュボード'))}</h2></div><p>${esc(t('성적 기반 자동 보강','成績ベース自動補強'))}</p></div><section class="ap-mock-card"><p class="ap-mock-note">${esc(t('자기채점 기록과 선택전략 데이터를 분석하는 중...', '自己採点履歴と選択戦略データを分析中...'))}</p></section>`;
    const [difficulty, perfData] = await Promise.all([loadDifficulty(), Promise.resolve(aggregatePerformance())]);
    if (subjectFromUrl() !== 'B' || !el.isConnected) return;
    const confidenceState = readJson(STRATEGY_KEY, {});
    const rows = fields.map(([no,ko,ja]) => {
      const scores = perfData.byField[no]?.scores || [];
      const performance = { count: scores.length, percent: scores.length ? avg(scores) / 20 * 100 : 0, last: perfData.byField[no]?.last };
      const confidence = Math.max(1, Math.min(5, Number(confidenceState?.[no] || 3)));
      const d = Number(difficulty[no] || 3);
      return { no, ko, ja, confidence, difficulty: d, performance, weakness: weaknessScore(confidence,d,performance) };
    }).sort((a,b)=>b.weakness-a.weakness || a.performance.count-b.performance.count || b.difficulty-a.difficulty || a.no-b.no);
    const focus = rows.slice(0,4);
    const focusParam = focus.map((x)=>x.no).join(',');
    const latest = perfData.attempts.length ? perfData.attempts[perfData.attempts.length - 1] : null;
    const latestTotal = Number(latest?.total);
    const latestText = Number.isFinite(latestTotal) ? `${latestTotal}/100` : t('기록 없음','記録なし');
    const focusText = focus.map((x)=>`Q${x.no} ${t(x.ko,x.ja)}`).join(' · ');
    const tableRows = rows.map((x,i)=>`<tr><td>${i+1}</td><td><strong>Q${x.no} ${esc(t(x.ko,x.ja))}</strong></td><td>${x.performance.count ? `${x.performance.percent.toFixed(0)}% (${x.performance.count}${esc(t('회','回'))})` : esc(t('미측정','未測定'))}</td><td>${x.performance.last == null ? '-' : `${x.performance.last}/20`}</td><td>${x.confidence}/5</td><td>${x.difficulty.toFixed(2)}</td><td><strong>${x.weakness}</strong></td><td>${esc(label(x.weakness,x.performance.count))}</td></tr>`).join('');
    el.innerHTML = `<div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">SUBJECT B WEAKNESS</p><h2>${esc(t('科目B 약점 대시보드','科目B 弱点ダッシュボード'))}</h2></div><p>${esc(t(`자기채점 ${perfData.attempts.length}회 기록`,`自己採点 ${perfData.attempts.length}回記録`))}</p></div><section class="ap-mock-card"><p class="ap-past-guide"><strong>${esc(t('자동 보강 추천 4개','自動補強おすすめ4分野'))}:</strong> ${esc(focusText)}<br><strong>${esc(t('최근 B 자기채점','直近B自己採点'))}:</strong> ${esc(latestText)}</p><p class="ap-mock-note">${esc(t('약점지수는 자기채점 성적을 가장 크게 보고, 자신감·실제 기출 평균 난이도·응시 표본 수를 함께 반영합니다. 아직 풀지 않은 분야도 미측정 리스크를 주어 보강 후보에서 완전히 빠지지 않게 합니다.','弱点指数は自己採点成績を最も重く見て、自信度・実際の過去問平均難易度・受験サンプル数を合わせて反映します。未受験分野にも未測定リスクを与え、補強候補から完全に外れないようにします。'))}</p><div class="ap-past-actions"><a class="ap-mock-button" href="/${lang}/study/ap/reinforcement/?subject=B&focus=${encodeURIComponent(focusParam)}">${esc(t('약점 4개 자동 선택해서 풀기','弱点4分野を自動選択して解く'))}</a></div><div class="ap-mock-table-wrap"><table class="ap-mock-table"><thead><tr><th>#</th><th>${esc(t('분야','分野'))}</th><th>${esc(t('평균 자기채점','平均自己採点'))}</th><th>${esc(t('최근','直近'))}</th><th>${esc(t('자신감','自信度'))}</th><th>${esc(t('기출 난이도','過去問難易度'))}</th><th>${esc(t('약점지수','弱点指数'))}</th><th>${esc(t('판정','判定'))}</th></tr></thead><tbody>${tableRows}</tbody></table></div><p class="ap-mock-note">${esc(t('이 대시보드는 브라우저 localStorage만 사용하며 D1 조회·저장은 발생하지 않습니다.','このダッシュボードはブラウザのlocalStorageだけを使用し、D1の読取・保存は行いません。'))}</p></section>`;
  }
  function schedule() { setTimeout(()=>render().catch((e)=>console.error('AP_B_WEAKNESS_DASHBOARD_FAILED',e)),0); }
  document.addEventListener('click',(event)=>{ if (event.target.closest?.('[data-ap-mock-subject]')) schedule(); });
  window.addEventListener('popstate', schedule);
  window.addEventListener('storage',(event)=>{ if ([STRATEGY_KEY,PERFORMANCE_KEY].includes(event.key)) schedule(); });
  const observer = new MutationObserver(()=>{
    if (!document.getElementById('ap-mock-past-analysis-b')) return;
    observer.disconnect(); schedule();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  schedule();
})();
