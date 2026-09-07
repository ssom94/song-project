(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('subject') !== 'B') return;
  const focus = String(params.get('focus') || '').split(',').map(Number).filter((n,i,a)=>n>=2&&n<=11&&a.indexOf(n)===i).slice(0,4);
  const rawSource = String(params.get('source') || 'manual');
  const source = ['weakness','progress','goal'].includes(rawSource) ? rawSource : 'manual';
  const lang = document.body?.dataset?.blogLanguage === 'ko' ? 'ko' : 'ja';
  const t = (ko, ja) => lang === 'ko' ? ko : ja;
  const PERFORMANCE_KEY = 'song:ap:b-reinforcement-performance:v1';
  let applied = false;

  function noticeText() {
    if (source === 'progress') return t(`점수 추이·개선 판정에 따라 Q${focus.join(', Q')}가 자동 선택되었습니다. 원하면 다른 분야로 바꿀 수 있습니다.`, `得点推移・改善判定によりQ${focus.join('、Q')}を自動選択しました。必要なら別の分野へ変更できます。`);
    if (source === 'goal') return t(`목표점수 계획에 따라 Q${focus.join(', Q')}가 자동 선택되었습니다. 원하면 다른 분야로 바꿀 수 있습니다.`, `目標得点プランによりQ${focus.join('、Q')}を自動選択しました。必要なら別の分野へ変更できます。`);
    if (source === 'weakness') return t(`약점 대시보드 추천에 따라 Q${focus.join(', Q')}가 자동 선택되었습니다. 원하면 다른 분야로 바꿀 수 있습니다.`, `弱点ダッシュボードの推薦によりQ${focus.join('、Q')}を自動選択しました。必要なら別の分野へ変更できます。`);
    return t(`선택한 Q${focus.join(', Q')}가 자동 선택되었습니다. 원하면 다른 분야로 바꿀 수 있습니다.`, `指定したQ${focus.join('、Q')}を自動選択しました。必要なら別の分野へ変更できます。`);
  }
  function apply() {
    if (!focus.length) return true;
    if (applied) return true;
    const root = document.getElementById('ap-reinforcement-root');
    if (!root) return false;
    const buttons = focus.map((no)=>root.querySelector(`[data-select-b="${no}"]`));
    if (buttons.some((button)=>!button)) return false;
    for (const button of buttons) {
      const card = button.closest('.ap-reinforcement-b-question');
      if (!card?.classList.contains('is-selected')) button.click();
    }
    const guide = document.createElement('p');
    guide.className = 'ap-past-guide';
    guide.dataset.bFocusNotice = '1';
    guide.textContent = noticeText();
    const firstCard = root.querySelector('.ap-mock-card');
    if (firstCard && !root.querySelector('[data-b-focus-notice]')) firstCard.appendChild(guide);
    applied = true;
    return true;
  }
  function attachMetadataToLatestAttempt() {
    try {
      const data = JSON.parse(localStorage.getItem(PERFORMANCE_KEY) || '{}');
      if (!Array.isArray(data?.attempts) || !data.attempts.length) return;
      const latest = data.attempts[data.attempts.length - 1];
      const at = Date.parse(latest?.at || '');
      if (!Number.isFinite(at) || Date.now() - at > 10000) return;
      latest.source = source;
      latest.focus = focus.slice();
      localStorage.setItem(PERFORMANCE_KEY, JSON.stringify({ version: 1, attempts: data.attempts.slice(-20) }));
    } catch {
      // Ignore malformed local data; the base reinforcement flow remains usable.
    }
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-b-save-score]')) return;
    setTimeout(attachMetadataToLatestAttempt, 0);
  });

  if (!apply()) {
    const observer = new MutationObserver(()=>{ if (apply()) observer.disconnect(); });
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }
})();
