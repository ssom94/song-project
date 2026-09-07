(() => {
  const body = document.body;
  const lang = body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
  const t = (ko, ja) => lang === 'ko' ? ko : ja;
  const root = document.getElementById('ap-reinforcement-root');
  const title = document.getElementById('ap-reinforcement-title');
  const subtitle = document.getElementById('ap-reinforcement-subtitle');
  const params = new URLSearchParams(location.search);
  const subject = params.get('subject') === 'B' ? 'B' : 'A';
  const requestedSet = subject === 'B' ? 'five-session-b' : (params.get('set') === '2025-autumn' ? '2025-autumn' : 'five-session');
  const SETS = {
    'five-session': { url: '/assets/data/ap-reinforcement/5-session-A-calibration.json', labelKo: '실제 기출 5회 통합', labelJa: '過去問5回統合' },
    '2025-autumn': { url: '/assets/data/ap-reinforcement/2025-autumn-A-calibration.json', labelKo: '2025 가을 단일 기준', labelJa: '2025年秋期単独基準' },
    'five-session-b': { url: '/assets/data/ap-reinforcement/5-session-B-calibration.json', labelKo: '科目B 5회 통합', labelJa: '科目B 5回統合' },
  };
  const letters = ['ア', 'イ', 'ウ', 'エ'];
  const state = new Map();
  const selectedB = new Set([1]);

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  async function fetchJson(url) {
    const response = await fetch(url, { credentials: 'same-origin' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return data;
  }
  function configurePage(data) {
    const back = document.querySelector('.ap-past-viewer-back');
    if (back) back.href = `/${lang}/study/ap/mock-exams/?subject=${subject}`;
    const eyebrow = document.querySelector('.ap-section-eyebrow');
    if (eyebrow) eyebrow.textContent = subject === 'B' ? 'AP SUBJECT B CALIBRATION' : 'AP SUBJECT A CALIBRATION';
    if (title) title.textContent = lang === 'ko' ? data.titleKo : data.titleJa;
    if (subtitle) subtitle.textContent = lang === 'ko' ? data.targetProfile?.notesKo : data.targetProfile?.notesJa;
  }

  function questionHtmlA(q) {
    const prompt = lang === 'ko' ? q.promptKo : q.promptJa;
    const options = lang === 'ko' ? q.optionsKo : q.optionsJa;
    return `<article class="ap-mock-question" data-question-no="${q.questionNo}"><div class="ap-mock-question-head"><div><span class="ap-mock-question-number">Q${q.questionNo}</span> <span class="ap-mock-status">${esc(q.sectionCode)}</span></div><span>${esc(t(`난이도 ${q.difficulty}/3`, `難易度 ${q.difficulty}/3`))}</span></div><div class="ap-mock-question-body"><p class="ap-mock-question-prompt">${esc(prompt)}</p><div class="ap-mock-options">${options.map((option, index) => `<button type="button" class="ap-mock-option" data-choice="${index}"><strong>${letters[index]}</strong><span>${esc(option)}</span></button>`).join('')}</div><div class="ap-mock-explanation" hidden><p><strong>${esc(t('정답', '正解'))}:</strong> ${letters[q.correctChoice]}</p><p>${esc(lang === 'ko' ? q.explanationKo : q.explanationJa)}</p><p class="ap-mock-note"><strong>${esc(t('시험 포인트', '試験ポイント'))}:</strong> ${esc(lang === 'ko' ? q.examPointKo : q.examPointJa)}</p></div></div></article>`;
  }
  function updateScoreA(questions) {
    let answered = 0, correct = 0;
    for (const q of questions) {
      const selected = state.get(q.questionNo);
      if (Number.isInteger(selected)) { answered += 1; if (selected === q.correctChoice) correct += 1; }
    }
    const status = document.getElementById('ap-reinforcement-status');
    if (status) status.textContent = t(`${answered}/${questions.length}문제 선택`, `${answered}/${questions.length}問選択`);
    return { answered, correct };
  }
  function bindA(questions) {
    root.querySelectorAll('.ap-mock-question').forEach((card) => {
      const no = Number(card.dataset.questionNo);
      card.querySelectorAll('[data-choice]').forEach((button) => button.addEventListener('click', () => {
        state.set(no, Number(button.dataset.choice));
        card.querySelectorAll('[data-choice]').forEach((item) => item.classList.toggle('is-selected', item === button));
        updateScoreA(questions);
      }));
    });
    document.getElementById('ap-reinforcement-grade')?.addEventListener('click', () => {
      const result = updateScoreA(questions);
      root.querySelectorAll('.ap-mock-question').forEach((card) => {
        const no = Number(card.dataset.questionNo);
        const q = questions.find((item) => item.questionNo === no);
        const selected = state.get(no);
        card.querySelectorAll('[data-choice]').forEach((button) => {
          const choice = Number(button.dataset.choice);
          button.classList.toggle('is-correct', choice === q.correctChoice);
          button.classList.toggle('is-wrong', Number.isInteger(selected) && choice === selected && selected !== q.correctChoice);
        });
        const explanation = card.querySelector('.ap-mock-explanation'); if (explanation) explanation.hidden = false;
      });
      const resultBox = document.getElementById('ap-reinforcement-result');
      if (resultBox) { resultBox.hidden = false; resultBox.textContent = t(`채점 결과: ${result.correct}/${questions.length} 정답 (${Math.round(result.correct / questions.length * 100)}%)`, `採点結果: ${result.correct}/${questions.length}問正解（${Math.round(result.correct / questions.length * 100)}%）`); }
    });
  }
  function selectorHtmlA() {
    return `<section class="ap-mock-card"><div class="ap-past-actions">${['five-session','2025-autumn'].map((key) => { const set = SETS[key]; const href = key === 'five-session' ? location.pathname : `${location.pathname}?set=2025-autumn`; return `<a class="ap-mock-button${key === requestedSet ? ' is-active' : ''}" href="${esc(href)}">${esc(lang === 'ko' ? set.labelKo : set.labelJa)}</a>`; }).join('')}<a class="ap-mock-button" href="${esc(`${location.pathname}?subject=B`)}">${esc(t('科目B 보정 세트','科目B補正セット'))}</a></div></section>`;
  }
  function renderA(data, questions) {
    const dist = data.targetProfile?.sectionDistribution || {};
    const profileText = requestedSet === 'five-session' ? t(`T/M/S ${dist.T}/${dist.M}/${dist.S}, 평균 난이도 ${data.targetProfile?.difficultyMean ?? '-'}, 장문 시나리오 최대 ${data.targetProfile?.scenarioTargetMax ?? '-'}문항을 목표로 한 독자 문제입니다.`, `T/M/S ${dist.T}/${dist.M}/${dist.S}、平均難易度${data.targetProfile?.difficultyMean ?? '-'}、長文シナリオ最大${data.targetProfile?.scenarioTargetMax ?? '-'}問を目標にしたオリジナル問題です。`) : t(`실제 기출과 동일한 T/M/S 비율(${dist.T}/${dist.M}/${dist.S}), 평균 난이도 약 ${data.targetProfile?.difficultyMean ?? '-'}을 목표로 만든 독자 문제입니다.`, `過去問と同じT/M/S比率（${dist.T}/${dist.M}/${dist.S}）、平均難易度約${data.targetProfile?.difficultyMean ?? '-'}を目標にしたオリジナル問題です。`);
    root.innerHTML = `${selectorHtmlA()}<section class="ap-mock-card"><div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">CALIBRATION SET</p><h2>${esc(t('科目A 출제감각 보정','科目A 出題感覚キャリブレーション'))}</h2></div><p id="ap-reinforcement-status">0/${questions.length}${esc(t('문제 선택','問選択'))}</p></div><p class="ap-past-guide">${esc(profileText)}</p></section><div class="ap-mock-question-list">${questions.map(questionHtmlA).join('')}</div><section class="ap-mock-card"><div class="ap-mock-actions"><button id="ap-reinforcement-grade" class="ap-mock-button" type="button">${esc(t('채점하고 해설 보기','採点して解説を見る'))}</button></div><p id="ap-reinforcement-result" class="ap-past-guide" hidden></p></section>`;
    bindA(questions);
  }

  function questionHtmlB(q) {
    const content = q.content || {};
    const passage = lang === 'ko' ? content.passageKo : content.passageJa;
    const mandatory = Boolean(q.mandatory);
    const subquestions = Array.isArray(content.subquestions) ? content.subquestions : [];
    return `<article class="ap-mock-question ap-reinforcement-b-question${mandatory ? ' is-selected' : ''}" data-question-no="${q.questionNo}"><div class="ap-mock-question-head"><div><span class="ap-mock-question-number">Q${q.questionNo}</span> <span class="ap-mock-status">${esc(lang === 'ko' ? q.fieldKo : q.fieldJa)}</span> ${mandatory ? `<span class="ap-mock-status is-completed">${esc(t('필수','必須'))}</span>` : ''}</div><span>${esc(t(`난이도 ${q.difficulty}/4`,`難易度 ${q.difficulty}/4`))}</span></div><div class="ap-mock-question-body">${mandatory ? '' : `<button type="button" class="ap-mock-button ap-b-select" data-select-b="${q.questionNo}">${esc(t('선택하기','選択する'))}</button>`}<p class="ap-mock-question-prompt">${esc(passage)}</p>${subquestions.map((sq) => `<div class="ap-reinforcement-b-sub"><p><strong>${esc(sq.key.toUpperCase())}.</strong> ${esc(lang === 'ko' ? sq.promptKo : sq.promptJa)} <span class="ap-mock-note">(${sq.score}${esc(t('점','点'))})</span></p><textarea class="ap-mock-answer-input" rows="3" data-b-answer="${q.questionNo}:${esc(sq.key)}" placeholder="${esc(t('답안을 직접 작성하세요.','解答を入力してください。'))}"></textarea><div class="ap-mock-explanation" data-b-model hidden><p><strong>${esc(t('모범답안','模範解答'))}:</strong> ${esc(lang === 'ko' ? sq.modelKo : sq.modelJa)}</p></div></div>`).join('')}<div class="ap-mock-explanation" data-b-overall hidden><p>${esc(lang === 'ko' ? q.explanationKo : q.explanationJa)}</p><p class="ap-mock-note"><strong>${esc(t('시험 포인트','試験ポイント'))}:</strong> ${esc(lang === 'ko' ? q.examPointKo : q.examPointJa)}</p></div></div></article>`;
  }
  function updateBStatus() {
    const status = document.getElementById('ap-reinforcement-status');
    if (status) status.textContent = t(`필수 Q1 + 선택 ${Math.max(0, selectedB.size - 1)}/4`, `必須Q1 + 選択${Math.max(0, selectedB.size - 1)}/4`);
  }
  function refreshBSelection() {
    root.querySelectorAll('.ap-reinforcement-b-question').forEach((card) => {
      const no = Number(card.dataset.questionNo);
      const selected = selectedB.has(no);
      card.classList.toggle('is-selected', selected);
      const button = card.querySelector('[data-select-b]');
      if (button) button.textContent = selected ? t('선택 해제','選択解除') : t('선택하기','選択する');
    });
    updateBStatus();
  }
  function bindB() {
    root.querySelectorAll('[data-select-b]').forEach((button) => button.addEventListener('click', () => {
      const no = Number(button.dataset.selectB);
      if (selectedB.has(no)) selectedB.delete(no);
      else if (selectedB.size < 5) selectedB.add(no);
      else { alert(t('선택문제는 4개까지만 고를 수 있습니다.','選択問題は4問までです。')); return; }
      refreshBSelection();
    }));
    document.getElementById('ap-reinforcement-grade')?.addEventListener('click', () => {
      if (selectedB.size !== 5) { alert(t('Q1 필수 + 선택 4문제를 먼저 골라주세요.','Q1必須 + 選択4問を選んでください。')); return; }
      root.querySelectorAll('.ap-reinforcement-b-question').forEach((card) => {
        const no = Number(card.dataset.questionNo);
        const show = selectedB.has(no);
        card.querySelectorAll('[data-b-model], [data-b-overall]').forEach((el) => { el.hidden = !show; });
      });
      const result = document.getElementById('ap-reinforcement-result');
      if (result) { result.hidden = false; result.textContent = t('선택한 5문제의 모범답안과 배점기준을 열었습니다. 본문 근거가 포함됐는지 직접 비교해 자기채점하세요.', '選択した5問の模範解答と配点基準を表示しました。本文の根拠を含めているか比較し、自己採点してください。'); }
    });
  }
  function renderB(data, questions) {
    selectedB.clear(); selectedB.add(1);
    root.innerHTML = `<section class="ap-mock-card"><div class="ap-past-actions"><a class="ap-mock-button" href="${esc(location.pathname)}">${esc(t('科目A 보정 세트','科目A補正セット'))}</a><a class="ap-mock-button is-active" href="${esc(`${location.pathname}?subject=B`)}">${esc(t('科目B 5회 통합','科目B 5回統合'))}</a></div><p class="ap-mock-note">${esc(t('실전과 동일하게 Q1은 필수이며 Q2~Q11 중 4개를 선택합니다. 서술형은 자동 정오판정 대신 모범답안·배점기준으로 자기채점합니다.','実戦と同じくQ1は必須、Q2〜Q11から4問を選択します。記述式は自動正誤判定ではなく、模範解答・配点基準で自己採点します。'))}</p></section><section class="ap-mock-card"><div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">SUBJECT B CALIBRATION</p><h2>${esc(t('5회 실제기출 기준 서술형 보정','5回過去問基準 記述式キャリブレーション'))}</h2></div><p id="ap-reinforcement-status"></p></div><p class="ap-past-guide">${esc(lang === 'ko' ? data.targetProfile?.notesKo : data.targetProfile?.notesJa)}</p></section><div class="ap-mock-question-list">${questions.map(questionHtmlB).join('')}</div><section class="ap-mock-card"><div class="ap-mock-actions"><button id="ap-reinforcement-grade" class="ap-mock-button" type="button">${esc(t('선택한 5문제 모범답안 보기','選択した5問の模範解答を見る'))}</button></div><p id="ap-reinforcement-result" class="ap-past-guide" hidden></p></section>`;
    refreshBSelection(); bindB();
  }

  async function init() {
    if (!root) return;
    try {
      const data = await fetchJson(SETS[requestedSet].url);
      const questions = Array.isArray(data.questions) ? data.questions : [];
      configurePage(data);
      state.clear();
      if (subject === 'B') renderB(data, questions); else renderA(data, questions);
    } catch (error) {
      root.innerHTML = `<p class="ap-mock-error">${esc(t('보정 세트를 불러오지 못했습니다.','キャリブレーションセットを読み込めませんでした。'))} (${esc(error.message)})</p>`;
    }
  }
  init();
})();
