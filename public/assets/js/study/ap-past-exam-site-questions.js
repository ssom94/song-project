(() => {
  const lang = document.body?.dataset?.blogLanguage === 'ko' ? 'ko' : 'ja';
  const t = (ko, ja) => lang === 'ko' ? ko : ja;
  const params = new URLSearchParams(location.search);
  const sessionKey = (params.get('session') || '').trim();
  const subject = params.get('subject') === 'B' ? 'B' : 'A';
  const choiceOrder = ['ア', 'イ', 'ウ', 'エ'];
  const storageKey = `song:ap-past:${sessionKey}:${subject}:v1`;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paragraph = (value) => esc(value).replace(/\n/g, '<br>');

  function loadState() {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; }
    catch { return {}; }
  }
  function sectionLabel(code) {
    if (code === 'T') return t('테크놀로지', 'テクノロジ');
    if (code === 'M') return t('매니지먼트', 'マネジメント');
    return t('스트래티지', 'ストラテジ');
  }
  function promptFor(q) {
    return lang === 'ko'
      ? (q.promptKo || q.interpretationKo || q.topicKo || `Q${q.questionNo}`)
      : (q.promptJa || q.interpretationJa || q.topicJa || q.topicKo || `Q${q.questionNo}`);
  }
  function optionFor(q, index) {
    const primary = lang === 'ko' ? q.choicesKo : q.choicesJa;
    const fallback = lang === 'ko' ? q.choicesJa : q.choicesKo;
    const choices = Array.isArray(primary) && primary.length ? primary : (Array.isArray(fallback) ? fallback : []);
    return choices[index] || choiceOrder[index];
  }
  function questionHtml(q, state) {
    const selected = state.answers?.[q.questionNo] || '';
    const hasChoiceText = Boolean(q.choicesKo?.length || q.choicesJa?.length);
    const options = choiceOrder.map((choice, index) => `<label class="ap-mock-option ap-mock-choice"><input type="radio" name="past-site-q-${q.questionNo}" value="${choice}" data-past-site-choice="${choice}" data-question-no="${q.questionNo}"${selected === choice ? ' checked' : ''}> <span>${esc(choice)}. ${esc(optionFor(q, index))}</span></label>`).join('');
    return `<article class="ap-mock-question" id="past-site-question-${q.questionNo}">
      <p class="ap-section-eyebrow">${esc(`${q.sectionCode || '-'} · ${sectionLabel(q.sectionCode)}${q.difficulty ? ` · ${t('난이도', '難易度')} ${q.difficulty}/5` : ''}`)}</p>
      <h3>${q.questionNo}. ${esc(q.topicKo || q.topicJa || '')}</h3>
      <div class="ap-mock-passage">${paragraph(promptFor(q))}</div>
      ${hasChoiceText ? '' : `<p class="ap-mock-note">${esc(t('선택지 전문은 위 IPA 공식 PDF에서 확인하세요. 답안 선택은 이 카드와 기존 답안지에 함께 반영됩니다.', '選択肢全文は上のIPA公式PDFで確認してください。解答選択はこのカードと既存の解答用紙に連動します。'))}</p>`}
      <div class="ap-mock-options">${options}</div>
      <button type="button" class="ap-mock-button" data-past-explanation="${q.questionNo}">${esc(t('정답·상세해설 보기', '正解・詳細解説を見る'))}</button>
      <div class="ap-mock-result" data-past-result="${q.questionNo}" hidden><b>${esc(t('정답', '正解'))}:</b> ${esc(q.correctChoice || '-')}<br><b>${esc(t('상세해설', '詳細解説'))}:</b> ${paragraph(q.explanationKo || q.explanationJa || '-')}<br><b>${esc(t('시험 포인트', '試験ポイント'))}:</b> ${paragraph(q.examPointKo || q.examPointJa || '-')}</div>
    </article>`;
  }
  function syncAnswer(no, choice) {
    const sourceButton = document.querySelector(`.ap-past-a-item[data-question-no="${no}"] [data-answer-choice="${choice}"]`);
    if (sourceButton) return sourceButton.click();
    const state = loadState();
    state.answers = state.answers && typeof state.answers === 'object' ? state.answers : {};
    state.answers[no] = choice;
    state.graded = false;
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {}
  }
  async function boot() {
    if (!sessionKey || subject !== 'A') return;
    try {
      const response = await fetch(`/assets/data/ap-past-study/${encodeURIComponent(sessionKey)}-${subject}.json`, {cache:'no-cache'});
      if (!response.ok) return;
      const data = await response.json();
      if (data?.sessionKey !== sessionKey || data?.subject !== subject || !data.questions?.length) return;
      const root = document.getElementById('ap-past-viewer-root');
      if (!root) return;
      const state = loadState();
      const section = document.createElement('section');
      section.id = 'ap-past-site-questions';
      section.className = 'ap-past-study-card';
      section.innerHTML = `<div class="ap-past-study-head"><div><p class="ap-section-eyebrow">SITE QUESTION MODE</p><h2>${esc(t('사이트에서 문제 풀기', 'サイト上で問題を解く'))}</h2><p>${esc(t('모의고사와 같은 문제 카드 UI로 실제 기출을 풀고, 위의 IPA 공식 PDF 원문과 함께 확인할 수 있습니다.', '模擬試験と同じ問題カードUIで実際の過去問を解き、上のIPA公式PDF原文と併せて確認できます。'))}</p></div><span class="ap-past-study-badge">${esc(t('한국어 학습 지원', '韓国語学習対応'))}</span></div><div class="ap-past-study-notice">${esc(t('한국어 문제 문장은 SONG의 비공식 학습용 해석입니다. 정확한 일본어 표현·도표·선택지는 IPA 공식 PDF를 기준으로 합니다.', '韓国語問題文はSONGの非公式学習補助訳です。正確な日本語表現・図表・選択肢はIPA公式PDFを基準にします。'))}</div><div class="ap-past-study-nav">${data.questions.map((q) => `<a class="ap-past-study-nav-button" href="#past-site-question-${q.questionNo}">Q${q.questionNo}</a>`).join('')}</div><div>${data.questions.map((q) => questionHtml(q, state)).join('')}</div>`;
      root.appendChild(section);
      section.querySelectorAll('[data-past-site-choice]').forEach((input) => input.addEventListener('change', () => syncAnswer(Number(input.dataset.questionNo), input.dataset.pastSiteChoice)));
      section.querySelectorAll('[data-past-explanation]').forEach((button) => button.addEventListener('click', () => {
        const result = section.querySelector(`[data-past-result="${button.dataset.pastExplanation}"]`);
        if (!result) return;
        result.hidden = !result.hidden;
        button.textContent = result.hidden ? t('정답·상세해설 보기', '正解・詳細解説を見る') : t('정답·상세해설 숨기기', '正解・詳細解説を隠す');
      }));
    } catch (error) { console.error('AP_PAST_SITE_QUESTIONS_FAILED', error); }
  }
  boot();
})();