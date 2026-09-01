(() => {
  const p = new URLSearchParams(location.search);
  const part = p.get('part') === 'B' ? 'B' : 'A';
  const no = p.get('no') || '—';
  const concept = p.get('concept') || '—';
  const unit = p.get('unit') || '—';
  const back = `/ko/study/ap/concepts/?part=${part}`;
  const isProblem = location.pathname.includes('/problem/');
  const ids = isProblem ? 'problem' : 'detail';
  const backEl = document.getElementById(`ap-${ids}-back`);
  if (backEl) backEl.href = back;
  const title = document.getElementById(`ap-${ids}-title`);
  if (title) title.textContent = `${concept} · ${isProblem ? '예상문제' : '개념 상세'}`;
  const partEl = document.getElementById(`ap-${ids}-part`); if (partEl) partEl.textContent = `科目${part}`;
  const noEl = document.getElementById(`ap-${ids}-no`); if (noEl) noEl.textContent = no;
  const unitEl = document.getElementById(`ap-${ids}-unit`); if (unitEl) unitEl.textContent = unit;
  document.querySelectorAll(`#ap-${ids}-ja-title, #ap-${ids}-ko-title`).forEach((el) => { el.textContent = concept; });
  const toggle = document.getElementById(`ap-${ids}-ko-toggle`);
  if (!toggle) return;
  const koreanBlocks = isProblem
    ? [document.getElementById('ap-problem-ko-question'), document.getElementById('ap-problem-ko-explanation')]
    : [document.getElementById('ap-detail-ko-block')];
  toggle.addEventListener('click', () => {
    const show = toggle.getAttribute('aria-pressed') !== 'true';
    toggle.setAttribute('aria-pressed', String(show));
    toggle.textContent = show ? '한국어 숨기기' : '한국어 같이 보기';
    koreanBlocks.filter(Boolean).forEach((el) => { el.hidden = !show; });
  });
})();