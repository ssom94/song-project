(() => {
  const params = new URLSearchParams(location.search);
  const code = (params.get('code') || params.get('no') || '').trim().toUpperCase();
  const isProblemPage = location.pathname.includes('/problem/');
  const lang = document.body?.dataset?.blogLanguage === 'ja' ? 'ja' : 'ko';
  const prefix = `/${lang}/study/ap/concepts`;
  const root = document.querySelector('.ap-problem-placeholder');
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paragraph = (text) => esc(text).replace(/\n/g, '<br>');
  const sectionLabels = {
    definition:['定義','정의'], principle:['仕組み・原理','원리'], keyPoints:['核心ポイント','핵심 포인트'],
    method:['計算方法・判断方法','계산법 / 판단법'], traps:['試験の落とし穴','시험 함정'],
    memory:['暗記ポイント','암기 포인트'], example:['例','예시']
  };
  function bindToggle(id) {
    const toggle = document.getElementById(id);
    if (!toggle) return;
    toggle.onclick = () => {
      const show = toggle.getAttribute('aria-pressed') !== 'true';
      toggle.setAttribute('aria-pressed', String(show));
      toggle.textContent = show ? '한국어 숨기기' : '한국어 같이 보기';
      document.querySelectorAll('.ap-ko-secondary,.ap-ko-block').forEach((el) => { el.hidden = !show; });
    };
  }
  function choiceList(q, language) {
    const choices = language === 'ja' ? q.choicesJa : q.choicesKo;
    if (!Array.isArray(choices) || !choices.length) return '';
    return `<ol class="ap-question-choices">${choices.map((c,i)=>`<li><span>${String.fromCharCode(65+i)}</span>${esc(c)}</li>`).join('')}</ol>`;
  }
  function questionsHtml(problemTypes, openAnswers) {
    if (!problemTypes?.length) return '<p class="ap-problem-empty">予想問題はまだ登録されていません。</p>';
    return problemTypes.map((type) => `<section class="ap-problem-type-section">
      <div class="ap-problem-type-label">番号 ${type.no} · タイプ ${esc(type.nameJa)}<span class="ap-ko-secondary" hidden>번호 ${type.no} · 유형 ${esc(type.nameKo)}</span></div>
      ${type.questions.map((q)=>`<article class="ap-question-card">
        <div class="ap-question-number">Q${q.no}</div>
        <div class="ap-ja-block"><p class="ap-question-text">${paragraph(q.questionJa)}</p>${choiceList(q,'ja')}</div>
        <div class="ap-ko-block" hidden><span class="ap-lang-label">한국어</span><p class="ap-question-text">${paragraph(q.questionKo)}</p>${choiceList(q,'ko')}</div>
        <details class="ap-answer-details"${openAnswers?' open':''}><summary>正解・詳細解説</summary>
          <div class="ap-answer-grid"><div class="ap-ja-block"><b>正解：${esc(q.answerJa)}</b><p>${paragraph(q.explanationJa)}</p></div>
          <div class="ap-ko-block" hidden><b>정답: ${esc(q.answerKo)}</b><p>${paragraph(q.explanationKo)}</p></div></div>
        </details>
      </article>`).join('')}
    </section>`).join('');
  }
  function renderDetail(payload) {
    const c = payload.concept;
    document.title = `${c.code} ${c.titleJa} | AP`;
    const back = document.getElementById('ap-detail-back'); if (back) back.href = `${prefix}/?part=A`;
    if (!root) return;
    root.innerHTML = `<div class="ap-detail-head"><div><p class="ap-eyebrow">CONCEPT DETAIL</p>
      <h1>${esc(c.code)} · ${esc(c.titleJa)}</h1><div class="ap-problem-meta"><span>科目${esc(c.examPart)}</span><span>${esc(c.code)}</span><span>${esc(c.unitJa)}</span></div>
      <div class="ap-ko-secondary" hidden><strong>${esc(c.titleKo)}</strong> · ${esc(c.unitKo)}</div></div>
      <button id="ap-detail-ko-toggle" class="ap-concept-lang-button" type="button" aria-pressed="false">한국어 같이 보기</button></div>
      <div class="ap-detail-actions"><a class="ap-primary-button" href="${prefix}/problem/?code=${encodeURIComponent(c.code)}">予想問題ページへ →</a><a class="ap-secondary-button" href="#ap-inline-practice">ページ下の予想問題へ ↓</a></div>
      <div class="ap-detail-section-grid">${Object.entries(sectionLabels).map(([key,label])=>`<section class="ap-detail-section">
        <h2>${label[0]}</h2><div class="ap-ja-block"><p>${paragraph(c.sections[key].ja)}</p></div>
        <div class="ap-ko-block" hidden><h3>${label[1]}</h3><p>${paragraph(c.sections[key].ko)}</p></div></section>`).join('')}</div>
      <section id="ap-inline-practice" class="ap-inline-practice"><div class="ap-inline-practice-head"><div><p class="ap-eyebrow">EXPECTED QUESTIONS</p><h2>予想問題・詳細解説</h2></div>
      <a class="ap-concept-problem-button" href="${prefix}/problem/?code=${encodeURIComponent(c.code)}">問題ページで見る</a></div>${questionsHtml(payload.problemTypes,true)}</section>`;
    bindToggle('ap-detail-ko-toggle');
  }
  function renderProblems(payload) {
    const c = payload.concept;
    document.title = `${c.code} ${c.titleJa} 予想問題 | AP`;
    const back = document.getElementById('ap-problem-back'); if (back) back.href = `${prefix}/detail/?code=${encodeURIComponent(c.code)}`;
    if (!root) return;
    root.innerHTML = `<div class="ap-detail-head"><div><p class="ap-eyebrow">EXPECTED QUESTIONS</p><h1>${esc(c.code)} · ${esc(c.titleJa)} · 予想問題</h1>
      <div class="ap-problem-meta"><span>科目${esc(c.examPart)}</span><span>${esc(c.code)}</span><span>${esc(c.unitJa)}</span></div>
      <div class="ap-ko-secondary" hidden><strong>${esc(c.titleKo)}</strong> · ${esc(c.unitKo)}</div></div>
      <button id="ap-problem-ko-toggle" class="ap-concept-lang-button" type="button" aria-pressed="false">한국어 같이 보기</button></div>
      <div class="ap-detail-actions"><a class="ap-secondary-button" href="${prefix}/detail/?code=${encodeURIComponent(c.code)}">← 概念詳細へ</a></div>
      <p class="ap-practice-note">同じ概念でも出題形式が異なる場合はタイプ別に分けています。各セクション上部の「番号 · タイプ」を先に確認してください。</p>
      ${questionsHtml(payload.problemTypes,false)}`;
    bindToggle('ap-problem-ko-toggle');
  }
  async function load() {
    if (!code) { if (root) root.innerHTML = '<p class="ap-load-error">概念番号が指定されていません。</p>'; return; }
    try {
      const response = await fetch(`/api/public/ap/concepts?code=${encodeURIComponent(code)}`, { headers:{Accept:'application/json'} });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      if (isProblemPage) renderProblems(payload); else renderDetail(payload);
    } catch (error) {
      console.error(error);
      if (root) root.innerHTML = `<p class="ap-load-error">この概念のDBデータを読み込めませんでした。 (${esc(code)})</p>`;
    }
  }
  load();
})();