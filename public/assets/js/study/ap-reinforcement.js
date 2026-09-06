(() => {
  const body = document.body;
  const lang = body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
  const t = (ko, ja) => lang === 'ko' ? ko : ja;
  const root = document.getElementById('ap-reinforcement-root');
  const title = document.getElementById('ap-reinforcement-title');
  const subtitle = document.getElementById('ap-reinforcement-subtitle');
  const params = new URLSearchParams(location.search);
  const requestedSet = params.get('set') === '2025-autumn' ? '2025-autumn' : 'five-session';
  const SETS = {
    'five-session': {
      url: '/assets/data/ap-reinforcement/5-session-A-calibration.json',
      labelKo: '실제 기출 5회 통합',
      labelJa: '過去問5回統合',
    },
    '2025-autumn': {
      url: '/assets/data/ap-reinforcement/2025-autumn-A-calibration.json',
      labelKo: '2025 가을 단일 기준',
      labelJa: '2025年秋期単独基準',
    },
  };
  const letters = ['ア', 'イ', 'ウ', 'エ'];
  const state = new Map();

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function fetchJson(url) {
    const response = await fetch(url, { credentials: 'same-origin' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return data;
  }

  function questionHtml(q) {
    const prompt = lang === 'ko' ? q.promptKo : q.promptJa;
    const options = lang === 'ko' ? q.optionsKo : q.optionsJa;
    return `<article class="ap-mock-question" data-question-no="${q.questionNo}">
      <div class="ap-mock-question-head">
        <div><span class="ap-mock-question-number">Q${q.questionNo}</span> <span class="ap-mock-status">${esc(q.sectionCode)}</span></div>
        <span>${esc(t(`난이도 ${q.difficulty}/3`, `難易度 ${q.difficulty}/3`))}</span>
      </div>
      <div class="ap-mock-question-body">
        <p class="ap-mock-question-prompt">${esc(prompt)}</p>
        <div class="ap-mock-options">
          ${options.map((option, index) => `<button type="button" class="ap-mock-option" data-choice="${index}"><strong>${letters[index]}</strong><span>${esc(option)}</span></button>`).join('')}
        </div>
        <div class="ap-mock-explanation" hidden>
          <p><strong>${esc(t('정답', '正解'))}:</strong> ${letters[q.correctChoice]}</p>
          <p>${esc(lang === 'ko' ? q.explanationKo : q.explanationJa)}</p>
          <p class="ap-mock-note"><strong>${esc(t('시험 포인트', '試験ポイント'))}:</strong> ${esc(lang === 'ko' ? q.examPointKo : q.examPointJa)}</p>
        </div>
      </div>
    </article>`;
  }

  function updateScore(questions) {
    let answered = 0;
    let correct = 0;
    for (const q of questions) {
      const selected = state.get(q.questionNo);
      if (Number.isInteger(selected)) {
        answered += 1;
        if (selected === q.correctChoice) correct += 1;
      }
    }
    const status = document.getElementById('ap-reinforcement-status');
    if (status) status.textContent = t(`${answered}/${questions.length}문제 선택`, `${answered}/${questions.length}問選択`);
    return { answered, correct };
  }

  function bindQuestions(questions) {
    root.querySelectorAll('.ap-mock-question').forEach((card) => {
      const no = Number(card.dataset.questionNo);
      card.querySelectorAll('[data-choice]').forEach((button) => {
        button.addEventListener('click', () => {
          state.set(no, Number(button.dataset.choice));
          card.querySelectorAll('[data-choice]').forEach((item) => item.classList.toggle('is-selected', item === button));
          updateScore(questions);
        });
      });
    });

    document.getElementById('ap-reinforcement-grade')?.addEventListener('click', () => {
      const result = updateScore(questions);
      root.querySelectorAll('.ap-mock-question').forEach((card) => {
        const no = Number(card.dataset.questionNo);
        const q = questions.find((item) => item.questionNo === no);
        const selected = state.get(no);
        card.querySelectorAll('[data-choice]').forEach((button) => {
          const choice = Number(button.dataset.choice);
          button.classList.toggle('is-correct', choice === q.correctChoice);
          button.classList.toggle('is-wrong', Number.isInteger(selected) && choice === selected && selected !== q.correctChoice);
        });
        const explanation = card.querySelector('.ap-mock-explanation');
        if (explanation) explanation.hidden = false;
      });
      const resultBox = document.getElementById('ap-reinforcement-result');
      if (resultBox) {
        resultBox.hidden = false;
        resultBox.textContent = t(`채점 결과: ${result.correct}/${questions.length} 정답 (${Math.round(result.correct / questions.length * 100)}%)`, `採点結果: ${result.correct}/${questions.length}問正解（${Math.round(result.correct / questions.length * 100)}%）`);
      }
    });
  }

  function selectorHtml() {
    return `<section class="ap-mock-card"><div class="ap-past-actions">
      ${Object.entries(SETS).map(([key, set]) => {
        const href = key === 'five-session' ? location.pathname : `${location.pathname}?set=2025-autumn`;
        const active = key === requestedSet;
        return `<a class="ap-mock-button${active ? ' is-active' : ''}" href="${esc(href)}">${esc(lang === 'ko' ? set.labelKo : set.labelJa)}</a>`;
      }).join('')}
    </div><p class="ap-mock-note">${esc(t('기본 세트는 실제 기출 5회·400문항 통합 비교 기준입니다. 2025 가을 단일 기준 16문항 세트도 그대로 보존되어 있습니다.', '標準セットは過去問5回・400問の統合比較基準です。2025年秋期単独基準の16問セットもそのまま残しています。'))}</p></section>`;
  }

  async function init() {
    if (!root) return;
    try {
      const data = await fetchJson(SETS[requestedSet].url);
      const questions = Array.isArray(data.questions) ? data.questions : [];
      state.clear();
      if (title) title.textContent = lang === 'ko' ? data.titleKo : data.titleJa;
      if (subtitle) subtitle.textContent = lang === 'ko' ? data.targetProfile?.notesKo : data.targetProfile?.notesJa;
      const dist = data.targetProfile?.sectionDistribution || {};
      const profileText = requestedSet === 'five-session'
        ? t(`T/M/S ${dist.T}/${dist.M}/${dist.S}, 평균 난이도 ${data.targetProfile?.difficultyMean ?? '-'}, 장문 시나리오 최대 ${data.targetProfile?.scenarioTargetMax ?? '-'}문항을 목표로 한 독자 문제입니다.`, `T/M/S ${dist.T}/${dist.M}/${dist.S}、平均難易度${data.targetProfile?.difficultyMean ?? '-'}、長文シナリオ最大${data.targetProfile?.scenarioTargetMax ?? '-'}問を目標にしたオリジナル問題です。`)
        : t(`실제 기출과 동일한 T/M/S 비율(${dist.T}/${dist.M}/${dist.S}), 평균 난이도 약 ${data.targetProfile?.difficultyMean ?? '-'}을 목표로 만든 독자 문제입니다.`, `過去問と同じT/M/S比率（${dist.T}/${dist.M}/${dist.S}）、平均難易度約${data.targetProfile?.difficultyMean ?? '-'}を目標にしたオリジナル問題です。`);
      root.innerHTML = `${selectorHtml()}<section class="ap-mock-card">
        <div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">CALIBRATION SET</p><h2>${esc(requestedSet === 'five-session' ? t('5회 통합 출제감각 보정', '5回統合 出題感覚キャリブレーション') : t('2025 가을 출제감각 보정', '2025年秋期 出題感覚キャリブレーション'))}</h2></div><p id="ap-reinforcement-status">0/${questions.length}${esc(t('문제 선택', '問選択'))}</p></div>
        <p class="ap-past-guide">${esc(profileText)}</p>
      </section>
      <div class="ap-mock-question-list">${questions.map(questionHtml).join('')}</div>
      <section class="ap-mock-card">
        <div class="ap-mock-actions"><button id="ap-reinforcement-grade" class="ap-mock-button" type="button">${esc(t('채점하고 해설 보기', '採点して解説を見る'))}</button></div>
        <p id="ap-reinforcement-result" class="ap-past-guide" hidden></p>
      </section>`;
      bindQuestions(questions);
    } catch (error) {
      root.innerHTML = `<p class="ap-mock-error">${esc(t('보정 세트를 불러오지 못했습니다.', 'キャリブレーションセットを読み込めませんでした。'))} (${esc(error.message)})</p>`;
    }
  }

  init();
})();
