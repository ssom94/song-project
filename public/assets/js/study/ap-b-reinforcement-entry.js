(() => {
  const body = document.body;
  if (!body || body.dataset.apMockPage !== 'list') return;
  const lang = body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
  const t = (ko, ja) => lang === 'ko' ? ko : ja;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  function subject() { return new URLSearchParams(location.search).get('subject') === 'B' ? 'B' : 'A'; }
  function render() {
    let section = document.getElementById('ap-reinforcement-b-entry');
    if (!section) {
      const past = document.querySelector('.ap-past-section');
      if (!past?.parentElement) return;
      section = document.createElement('section');
      section.id = 'ap-reinforcement-b-entry';
      section.className = 'ap-mock-section';
      past.parentElement.insertBefore(section, past);
    }
    section.hidden = subject() !== 'B';
    if (section.hidden) return;
    section.innerHTML = `<div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">SUBJECT B CALIBRATION PRACTICE</p><h2>${esc(t('실제 기출 5회 통합 기준 科目B 보정·실전','過去問5回統合基準 科目B補正・実戦'))}</h2></div><p>${esc(t('11문항 · Q1 필수 + 4문제 선택','11問 · Q1必須 + 4問選択'))}</p></div><section class="ap-mock-card"><p class="ap-past-guide">${esc(t('실제 科目B 55문항 분석을 반영해 서술·코드·SQL·계산·원인분석 깊이를 강화한 독자 실전 세트입니다. 일반 보정 모드에서는 자유롭게 연습하고, 150분 실전 시뮬레이션에서는 시간제한·답안잠금·소요시간 기록까지 실제 시험 흐름으로 연습합니다.','実際の科目B55問分析を反映し、記述・コード・SQL・計算・原因分析の深さを強化したオリジナル実戦セットです。通常の補正モードでは自由に練習し、150分実戦シミュレーションでは時間制限・答案ロック・所要時間記録まで実試験の流れで練習します。'))}</p><div class="ap-past-actions"><a class="ap-mock-button" href="/${lang}/study/ap/reinforcement/?subject=B">${esc(t('科目B 보정 실전 풀기','科目B補正実戦を解く'))}</a><a class="ap-mock-button" href="/${lang}/study/ap/reinforcement/simulation/">${esc(t('150분 실전 시뮬레이션','150分実戦シミュレーション'))}</a></div></section>`;
  }
  render();
  window.addEventListener('popstate', render);
  document.querySelectorAll('[data-ap-mock-subject]').forEach((button) => button.addEventListener('click', () => setTimeout(render, 0)));
})();
