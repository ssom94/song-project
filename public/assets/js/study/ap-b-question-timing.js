(() => {
  const root = document.getElementById('ap-b-simulation-root');
  if (!root) return;
  const lang = document.body?.dataset?.blogLanguage === 'ko' ? 'ko' : 'ja';
  const t = (ko, ja) => lang === 'ko' ? ko : ja;
  const SESSION_KEY = 'song:ap:b-exam-simulation:v1';
  const PERFORMANCE_KEY = 'song:ap:b-reinforcement-performance:v1';
  const CHANGE_EVENT = 'song:ap:b-performance-changed';
  const MAX_SECONDS = 150 * 60;
  let questionSeconds = {};
  let activeQuestionNo = null;
  let ratios = new Map();
  let tickTimer = null;
  let intersectionObserver = null;
  let persistTicks = 0;

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || '') || fallback; }
    catch { return fallback; }
  }
  function readSession() {
    const state = readJson(SESSION_KEY, null);
    return state?.version === 1 ? state : null;
  }
  function formatDuration(seconds) {
    const safe = Math.max(0, Math.floor(Number(seconds) || 0));
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  function selectedSet(state) {
    return new Set((Array.isArray(state?.selected) ? state.selected : []).map(Number).filter((no)=>no>=1&&no<=11));
  }
  function normalizeTimes(raw, selected) {
    const out = {};
    for (const no of selected) {
      const value = Number(raw?.[no] ?? raw?.[String(no)] ?? 0);
      out[String(no)] = Number.isFinite(value) ? Math.max(0, Math.min(MAX_SECONDS, Math.round(value))) : 0;
    }
    return out;
  }
  function flushSession() {
    const state = readSession();
    if (!state || state.status !== 'active') return;
    const selected = selectedSet(state);
    state.questionSeconds = normalizeTimes(questionSeconds, selected);
    localStorage.setItem(SESSION_KEY, JSON.stringify(state));
    persistTicks = 0;
  }
  function updateBadges() {
    root.querySelectorAll('[data-sim-question]').forEach((article)=>{
      const no = Number(article.dataset.simQuestion);
      const badge = article.querySelector('[data-sim-question-time]');
      if (badge) badge.textContent = `${t('문항시간','問題時間')} ${formatDuration(questionSeconds[String(no)] || 0)}`;
    });
  }
  function focusedQuestion() {
    const active = document.activeElement?.closest?.('[data-sim-question]');
    const no = Number(active?.dataset?.simQuestion);
    return Number.isInteger(no) ? no : null;
  }
  function chooseVisibleQuestion(selected) {
    const focused = focusedQuestion();
    if (focused && selected.has(focused)) return focused;
    let bestNo = null;
    let bestRatio = 0;
    for (const [no, ratio] of ratios.entries()) {
      if (!selected.has(no) || ratio <= bestRatio) continue;
      bestNo = no;
      bestRatio = ratio;
    }
    return bestNo;
  }
  function tick() {
    const state = readSession();
    if (!state || state.status !== 'active') {
      stopTracking(false);
      return;
    }
    if (document.visibilityState !== 'visible') return;
    const selected = selectedSet(state);
    const visible = chooseVisibleQuestion(selected);
    if (visible) activeQuestionNo = visible;
    if (!activeQuestionNo || !selected.has(activeQuestionNo)) return;
    const key = String(activeQuestionNo);
    questionSeconds[key] = Math.min(MAX_SECONDS, Number(questionSeconds[key] || 0) + 1);
    persistTicks += 1;
    updateBadges();
    if (persistTicks >= 5) flushSession();
  }
  function stopTracking(flush = true) {
    if (flush) flushSession();
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = null;
    if (intersectionObserver) intersectionObserver.disconnect();
    intersectionObserver = null;
    ratios = new Map();
  }
  function addTimeBadge(article, no) {
    const head = article.querySelector('.ap-mock-question-head');
    if (!head || head.querySelector('[data-sim-question-time]')) return;
    const badge = document.createElement('span');
    badge.className = 'ap-mock-status';
    badge.dataset.simQuestionTime = String(no);
    badge.textContent = `${t('문항시간','問題時間')} ${formatDuration(questionSeconds[String(no)] || 0)}`;
    head.appendChild(badge);
  }
  function startTracking() {
    const state = readSession();
    if (!state || state.status !== 'active') return false;
    const articles = Array.from(root.querySelectorAll('[data-sim-question]'));
    if (!articles.length) return false;
    stopTracking(false);
    const selected = selectedSet(state);
    questionSeconds = normalizeTimes(state.questionSeconds || questionSeconds, selected);
    ratios = new Map();
    for (const article of articles) {
      const no = Number(article.dataset.simQuestion);
      const chosen = selected.has(no);
      article.hidden = !chosen;
      article.setAttribute('aria-hidden', chosen ? 'false' : 'true');
      if (!chosen) continue;
      addTimeBadge(article, no);
      article.addEventListener('pointerdown', ()=>{ activeQuestionNo = no; }, { passive:true });
    }
    intersectionObserver = new IntersectionObserver((entries)=>{
      for (const entry of entries) {
        const no = Number(entry.target.dataset.simQuestion);
        ratios.set(no, entry.isIntersecting ? entry.intersectionRatio : 0);
      }
    }, { threshold:[0,0.1,0.25,0.5,0.75,1] });
    for (const article of articles) if (!article.hidden) intersectionObserver.observe(article);
    activeQuestionNo = selected.has(activeQuestionNo) ? activeQuestionNo : Array.from(selected)[0] || null;
    updateBadges();
    tickTimer = setInterval(tick, 1000);
    return true;
  }
  function injectReviewTiming() {
    const reviewArticles = Array.from(root.querySelectorAll('[data-review-question]'));
    if (!reviewArticles.length) return false;
    stopTracking(false);
    for (const article of reviewArticles) {
      const no = Number(article.dataset.reviewQuestion);
      const head = article.querySelector('.ap-mock-question-head');
      if (!head || head.querySelector('[data-review-question-time]')) continue;
      const badge = document.createElement('span');
      badge.className = 'ap-mock-status';
      badge.dataset.reviewQuestionTime = String(no);
      badge.textContent = `${t('소요','所要')} ${formatDuration(questionSeconds[String(no)] || 0)}`;
      head.appendChild(badge);
    }
    const scoreSummary = root.querySelector('[data-sim-score-summary]');
    if (scoreSummary && !root.querySelector('[data-sim-time-summary]')) {
      const summary = document.createElement('p');
      summary.className = 'ap-mock-note';
      summary.dataset.simTimeSummary = '1';
      const parts = reviewArticles.map((article)=>{
        const no = Number(article.dataset.reviewQuestion);
        return `Q${no} ${formatDuration(questionSeconds[String(no)] || 0)}`;
      });
      summary.textContent = `${t('문항별 측정시간','問題別計測時間')}: ${parts.join(' · ')} · ${t('화면이 보이고 해당 문항이 활성화된 시간만 측정합니다.','画面が表示され、その問題がアクティブな時間だけを計測します。')}`;
      scoreSummary.insertAdjacentElement('afterend', summary);
    }
    return true;
  }
  function patchLatestAttempt() {
    const data = readJson(PERFORMANCE_KEY, { version:1, attempts:[] });
    if (!Array.isArray(data?.attempts) || !data.attempts.length) return;
    const latest = data.attempts[data.attempts.length - 1];
    if (latest?.source !== 'simulation' || latest?.mode !== 'timed-150') return;
    const selected = new Set((latest.selected || []).map(Number));
    latest.questionSeconds = normalizeTimes(questionSeconds, selected);
    localStorage.setItem(PERFORMANCE_KEY, JSON.stringify({ version:1, attempts:data.attempts.slice(-20) }));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail:{ count:data.attempts.length, timing:true } }));
  }
  function refresh() {
    if (injectReviewTiming()) return;
    const state = readSession();
    if (state?.status === 'active' && root.querySelector('[data-sim-question]')) {
      if (!tickTimer) startTracking();
      return;
    }
    if (!state || state.status !== 'active') stopTracking(false);
  }

  document.addEventListener('focusin', (event)=>{
    const article = event.target.closest?.('[data-sim-question]');
    const no = Number(article?.dataset?.simQuestion);
    if (Number.isInteger(no)) activeQuestionNo = no;
  });
  document.addEventListener('click', (event)=>{
    if (event.target.closest?.('[data-sim-finish]')) flushSession();
    if (event.target.closest?.('[data-sim-save]')) setTimeout(patchLatestAttempt, 0);
  }, true);
  document.addEventListener('visibilitychange', ()=>{ if (document.visibilityState === 'hidden') flushSession(); });
  window.addEventListener('beforeunload', flushSession);
  const mutationObserver = new MutationObserver(()=>setTimeout(refresh,0));
  mutationObserver.observe(root, { childList:true, subtree:true });
  refresh();
})();
