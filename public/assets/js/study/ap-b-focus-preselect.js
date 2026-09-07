(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('subject') !== 'B') return;
  const focus = String(params.get('focus') || '').split(',').map(Number).filter((n,i,a)=>n>=2&&n<=11&&a.indexOf(n)===i).slice(0,4);
  if (!focus.length) return;
  const lang = document.body?.dataset?.blogLanguage === 'ko' ? 'ko' : 'ja';
  const t = (ko, ja) => lang === 'ko' ? ko : ja;
  let applied = false;
  function apply() {
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
    guide.textContent = t(`약점 대시보드 추천에 따라 Q${focus.join(', Q')}가 자동 선택되었습니다. 원하면 다른 분야로 바꿀 수 있습니다.`, `弱点ダッシュボードの推薦によりQ${focus.join('、Q')}を自動選択しました。必要なら別の分野へ変更できます。`);
    const firstCard = root.querySelector('.ap-mock-card');
    if (firstCard && !root.querySelector('[data-b-focus-notice]')) firstCard.appendChild(guide);
    applied = true;
    return true;
  }
  if (apply()) return;
  const observer = new MutationObserver(()=>{ if (apply()) observer.disconnect(); });
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
