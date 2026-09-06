(() => {
  const params = new URLSearchParams(location.search);
  const sessionKey = (params.get('session') || '').trim();
  const subject = params.get('subject') === 'B' ? 'B' : 'A';
  if (subject !== 'B' || !sessionKey) return;

  const lang = document.body?.dataset?.blogLanguage === 'ko' ? 'ko' : 'ja';
  const t = (ko, ja) => lang === 'ko' ? ko : ja;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dataUrl = `/assets/data/ap-past-study/${sessionKey}-B.json`;

  function detailHtml(q) {
    const field = lang === 'ko' ? q.fieldKo : q.fieldJa;
    const theme = lang === 'ko' ? q.themeKo : q.themeJa;
    const overview = lang === 'ko' ? q.overviewKo : q.overviewJa;
    const approach = lang === 'ko' ? q.approachKo : q.approachJa;
    const scoring = lang === 'ko' ? q.scoringFocusKo : q.scoringFocusJa;
    return `<article class="ap-past-study-question">
      <div class="ap-past-study-question-head">
        <div><span class="ap-past-study-section">${esc(field)}${q.required ? ` · ${esc(t('필수', '必須'))}` : ''}</span><h3>Q${q.questionNo} · ${esc(theme)}</h3></div>
        <span class="ap-past-study-badge">${esc(t(`난이도 ${q.difficulty}/5`, `難易度 ${q.difficulty}/5`))}</span>
      </div>
      <div class="ap-past-study-block"><strong>${esc(t('문제 핵심', '問題の核心'))}</strong><p>${esc(overview)}</p></div>
      <div class="ap-past-study-block"><strong>${esc(t('풀이 접근법', '解法アプローチ'))}</strong><p>${esc(approach)}</p></div>
      <div class="ap-past-study-point"><strong>${esc(t('서술형 채점 포인트', '記述式の採点ポイント'))}</strong><span>${esc(scoring)}</span></div>
      <div class="ap-past-study-block"><strong>${esc(t('핵심 키워드', '重要キーワード'))}</strong><p>${(q.keywords || []).map((k) => `<span class="ap-past-study-section">${esc(k)}</span>`).join(' ')}</p></div>
    </article>`;
  }

  function render(data) {
    const root = document.getElementById('ap-past-viewer-root');
    if (!root || document.getElementById('ap-past-b-study-card')) return false;
    const questions = Array.isArray(data.questions) ? data.questions : [];
    if (!questions.length) return false;
    const notice = lang === 'ko' ? data.source?.noticeKo : data.source?.noticeJa;
    const section = document.createElement('section');
    section.id = 'ap-past-b-study-card';
    section.className = 'ap-past-study-card';
    section.innerHTML = `<div class="ap-past-study-head">
      <div><p class="ap-section-eyebrow">SUBJECT B STUDY COMPANION</p><h2>${esc(t('科目B 문제별 한국어 학습지원', '科目B 問題別学習サポート'))}</h2>
      <p>${esc(t('11개 문제의 분야·테마·풀이 접근법과 서술형 채점 포인트를 문제별로 확인합니다.', '11問の分野・テーマ・解法アプローチと記述式の採点ポイントを問題別に確認します。'))}</p></div>
      <span class="ap-past-study-badge">${esc(t('비공식 학습 보조', '非公式学習補助'))}</span></div>
      <div class="ap-past-study-notice">${esc(notice || '')}</div>
      <div class="ap-past-study-nav" aria-label="${esc(t('문제 선택', '問題選択'))}">${questions.map((q, i) => `<button type="button" class="ap-past-study-nav-button${i === 0 ? ' is-active' : ''}" data-b-study-question="${q.questionNo}">Q${q.questionNo}</button>`).join('')}</div>
      <div id="ap-past-b-study-detail" class="ap-past-study-detail">${detailHtml(questions[0])}</div>`;
    root.appendChild(section);

    const detail = section.querySelector('#ap-past-b-study-detail');
    section.querySelectorAll('[data-b-study-question]').forEach((button) => {
      button.addEventListener('click', () => {
        const no = Number(button.dataset.bStudyQuestion);
        const q = questions.find((item) => Number(item.questionNo) === no);
        if (!q) return;
        section.querySelectorAll('[data-b-study-question]').forEach((item) => item.classList.toggle('is-active', item === button));
        detail.innerHTML = detailHtml(q);
        document.querySelector(`.ap-past-b-item[data-question-no="${no}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    });
    return true;
  }

  async function init() {
    let data;
    try {
      const response = await fetch(dataUrl, { credentials: 'same-origin' });
      if (!response.ok) return;
      data = await response.json();
    } catch { return; }

    if (render(data)) return;
    const observer = new MutationObserver(() => {
      if (render(data)) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 10000);
  }

  init();
})();
