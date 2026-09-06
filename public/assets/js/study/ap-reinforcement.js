(() => {
  const body = document.body;
  const lang = body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
  const t = (ko, ja) => lang === 'ko' ? ko : ja;
  const root = document.getElementById('ap-reinforcement-root');
  const title = document.getElementById('ap-reinforcement-title');
  const subtitle = document.getElementById('ap-reinforcement-subtitle');
  const DATA_URL = '/assets/data/ap-reinforcement/2025-autumn-A-calibration.json';
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
        <span>${esc(t(`난이도 ${q.difficulty}/5`, `難易度 ${q.difficulty}/5`))}</span>
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

  async function init() {
    if (!root) return;
    try {
      const data = await fetchJson(DATA_URL);
      const questions = Array.isArray(data.questions) ? data.questions : [];
      if (title) title.textContent = lang === 'ko' ? data.titleKo : data.titleJa;
      if (subtitle) subtitle.textContent = lang === 'ko' ? data.targetProfile?.notesKo : data.targetProfile?.notesJa;
      root.innerHTML = `<section class="ap-mock-card">
        <div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">CALIBRATION SET</p><h2>${esc(t('2025 가을 출제감각 보정', '2025年秋期 出題感覚キャリブレーション'))}</h2></div><p id="ap-reinforcement-status">0/${questions.length}${esc(t('문제 선택', '問選択'))}</p></div>
        <p class="ap-past-guide">${esc(t('실제 기출과 동일한 T/M/S 비율(10/2/4), 평균 난이도 약 1.56을 목표로 만든 독자 문제입니다. 긴 시나리오형 비중을 낮추고 짧은 판단형·계산형 중심으로 구성했습니다.', '過去問と同じT/M/S比率（10/2/4）、平均難易度約1.56を目標にしたオリジナル問題です。長文シナリオ偏重を避け、短い判断・計算問題を中心にしています。'))}</p>
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
