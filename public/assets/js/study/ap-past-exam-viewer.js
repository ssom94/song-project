(() => {
  const lang = document.body?.dataset?.blogLanguage === 'ko' ? 'ko' : 'ja';
  const t = (ko, ja) => lang === 'ko' ? ko : ja;
  const params = new URLSearchParams(location.search);
  const sessionKey = (params.get('session') || '').trim();
  const subject = params.get('subject') === 'B' ? 'B' : 'A';
  const root = document.getElementById('ap-past-viewer-root');
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const storageKey = `song:ap-past:${sessionKey}:${subject}:v1`;
  const choiceOrder = ['ア', 'イ', 'ウ', 'エ'];
  const bSections = [
    ['情報セキュリティ', '정보보안'],
    ['経営戦略', '경영전략'],
    ['プログラミング', '프로그래밍'],
    ['システムアーキテクチャ', '시스템 아키텍처'],
    ['ネットワーク', '네트워크'],
    ['データベース', '데이터베이스'],
    ['組込みシステム開発', '임베디드 시스템 개발'],
    ['情報システム開発', '정보시스템 개발'],
    ['プロジェクトマネジメント', '프로젝트 관리'],
    ['サービスマネジメント', '서비스 관리'],
    ['システム監査', '시스템 감사'],
  ];

  function loadState() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }
  function saveState(state) {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {}
  }
  function externalLink(url, label, className = 'ap-past-viewer-link') {
    if (!url) return '';
    return `<a class="${className}" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
  }
  function renderPdf(meta) {
    return `<section class="ap-past-pdf-card">
      <div class="ap-past-pdf-head"><div><p class="ap-section-eyebrow">IPA OFFICIAL PDF</p><h2>${esc(t('실제 문제 원문', '実際の問題原文'))}</h2></div>
      ${externalLink(meta.questionPdfUrl, t('새 탭에서 원문 열기', '別タブで原文を開く'), 'ap-past-viewer-link is-primary')}</div>
      <iframe class="ap-past-pdf-frame" src="${esc(meta.questionPdfUrl)}#view=FitH" title="${esc(t('IPA 실제 기출 문제', 'IPA過去問題'))}"></iframe>
      <p class="ap-past-pdf-fallback">${esc(t('모바일 브라우저에서 PDF가 표시되지 않으면 위의 ‘새 탭에서 원문 열기’를 눌러 주세요.', 'モバイルブラウザでPDFが表示されない場合は「別タブで原文を開く」を利用してください。'))}</p>
    </section>`;
  }
  function scoreText(correct, total) {
    const score = Math.round((correct / total) * 10000) / 100;
    return { score, text: `${correct} / ${total} · ${score}${t('점', '点')}` };
  }
  function renderSubjectA(meta, session) {
    const state = loadState();
    state.answers = state.answers && typeof state.answers === 'object' ? state.answers : {};
    state.graded = Boolean(state.graded);
    const key = Array.from(meta.answerKey || '');
    const answered = Object.values(state.answers).filter((v) => choiceOrder.includes(v)).length;
    let correct = 0;
    if (state.graded) {
      for (let no = 1; no <= 80; no += 1) if (state.answers[no] === key[no - 1]) correct += 1;
    }
    const result = scoreText(correct, 80);
    const rows = Array.from({ length: 80 }, (_, index) => {
      const no = index + 1;
      const selected = state.answers[no] || '';
      const answer = key[index] || '';
      const gradedClass = state.graded ? (selected === answer ? ' is-correct' : ' is-wrong') : '';
      return `<div class="ap-past-a-item${gradedClass}" data-question-no="${no}">
        <div class="ap-past-a-no">Q${no}</div>
        <div class="ap-past-a-choices">${choiceOrder.map((choice) => `<button type="button" class="ap-past-choice${selected === choice ? ' is-selected' : ''}" data-answer-choice="${choice}" aria-pressed="${selected === choice}">${choice}</button>`).join('')}</div>
        ${state.graded ? `<div class="ap-past-a-correct">${esc(t('정답', '正解'))} ${esc(answer)}</div>` : ''}
      </div>`;
    }).join('');
    return `<section class="ap-past-answer-card">
      <div class="ap-past-answer-head"><div><p class="ap-section-eyebrow">ANSWER SHEET</p><h2>${esc(t('科目A 답안지', '科目A 解答用紙'))}</h2><p>${esc(t('선택한 답은 이 기기의 브라우저에 자동 저장됩니다.', '選択した解答はこの端末のブラウザに自動保存されます。'))}</p></div>
        <div class="ap-past-progress"><strong id="ap-past-progress-count">${answered} / 80</strong><span>${esc(t('답변', '解答済み'))}</span></div></div>
      <div class="ap-past-a-grid">${rows}</div>
      <div class="ap-past-grade-bar">
        <div id="ap-past-grade-result" class="ap-past-grade-result${state.graded ? (result.score >= 60 ? ' is-pass' : ' is-fail') : ''}">${state.graded ? esc(`${result.text} · ${result.score >= 60 ? t('합격권', '合格圏') : t('60점 미만', '60点未満')}`) : esc(t('채점 전입니다.', '採点前です。'))}</div>
        <div class="ap-past-grade-actions"><button id="ap-past-grade" type="button" class="ap-past-grade-button">${esc(t('채점하기', '採点する'))}</button><button id="ap-past-reset" type="button" class="ap-past-reset-button">${esc(t('답안 초기화', '解答をリセット'))}</button></div>
      </div>
      <div class="ap-past-official-links">${externalLink(meta.answerPdfUrl, t('IPA 공식 정답 PDF', 'IPA公式解答PDF'))}${externalLink(session.sourceUrl, t('IPA 공식 출처 페이지', 'IPA公式出典ページ'))}</div>
    </section>`;
  }
  function renderSubjectB(meta, session) {
    const state = loadState();
    state.selected = Array.isArray(state.selected) ? state.selected.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 11) : [1];
    if (!state.selected.includes(1)) state.selected.unshift(1);
    state.selected = [...new Set(state.selected)].slice(0, 5);
    state.notes = state.notes && typeof state.notes === 'object' ? state.notes : {};
    saveState(state);
    const cards = Array.from({ length: 11 }, (_, index) => {
      const no = index + 1;
      const selected = state.selected.includes(no);
      const section = bSections[index];
      return `<article class="ap-past-b-item${selected ? ' is-selected' : ''}" data-question-no="${no}">
        <div class="ap-past-b-title"><div><strong>Q${no}</strong><span>${esc(lang === 'ko' ? section[1] : section[0])}${no === 1 ? ` · ${esc(t('필수', '必須'))}` : ''}</span></div>
          <label class="ap-past-b-select"><input type="checkbox" data-b-select="${no}" ${selected ? 'checked' : ''} ${no === 1 ? 'disabled' : ''}/><span>${esc(t('선택', '選択'))}</span></label></div>
        <textarea class="ap-past-b-note" data-b-note="${no}" rows="5" ${selected ? '' : 'hidden'} placeholder="${esc(t('이 문제의 답안을 메모하세요. 실제 채점은 IPA 공식 해답과 채점강평을 확인하세요.', 'この問題の解答メモを記入してください。採点はIPA公式解答・採点講評を確認してください。'))}">${esc(state.notes[no] || '')}</textarea>
      </article>`;
    }).join('');
    return `<section class="ap-past-answer-card">
      <div class="ap-past-answer-head"><div><p class="ap-section-eyebrow">WRITTEN ANSWER WORKSPACE</p><h2>${esc(t('科目B 답안 메모', '科目B 解答メモ'))}</h2><p>${esc(t('Q1은 필수이며 Q2~Q11에서 4문제를 선택합니다. 메모는 이 기기의 브라우저에 자동 저장됩니다.', 'Q1は必須、Q2〜Q11から4問を選択します。メモはこの端末のブラウザに自動保存されます。'))}</p></div>
        <div class="ap-past-progress"><strong id="ap-past-b-selected-count">${state.selected.length} / 5</strong><span>${esc(t('선택', '選択済み'))}</span></div></div>
      <div id="ap-past-b-warning" class="ap-past-b-warning" hidden></div>
      <div class="ap-past-b-list">${cards}</div>
      <div class="ap-past-official-links">${externalLink(meta.answerPdfUrl, t('IPA 공식 해답·출제취지', 'IPA公式解答・出題趣旨'))}${externalLink(meta.commentaryPdfUrl, t('IPA 공식 채점강평', 'IPA公式採点講評'))}${externalLink(session.sourceUrl, t('IPA 공식 출처 페이지', 'IPA公式出典ページ'))}</div>
    </section>`;
  }
  function renderStudyCompanion(companion) {
    if (!companion?.questions?.length) return '';
    const first = companion.questions[0];
    const notice = lang === 'ko' ? companion.source?.noticeKo : companion.source?.noticeJa;
    const nav = companion.questions.map((question) => `<button type="button" class="ap-past-study-nav-button${question.questionNo === first.questionNo ? ' is-active' : ''}" data-study-question="${question.questionNo}">Q${question.questionNo}</button>`).join('');
    return `<section id="ap-past-study-card" class="ap-past-study-card">
      <div class="ap-past-study-head">
        <div><p class="ap-section-eyebrow">KOREAN STUDY COMPANION</p><h2>${esc(t('한국어 학습 해석 · 상세해설', '韓国語学習補助訳・詳細解説'))}</h2>
        <p>${esc(t('공식 PDF를 그대로 유지하면서 문제별 핵심 해석과 자체 해설을 함께 봅니다.', 'IPA公式PDFをそのまま表示し、問題ごとの韓国語学習補助訳と独自解説を確認できます。'))}</p></div>
        <span class="ap-past-study-badge">${esc(t('비공식 학습 보조', '非公式学習補助'))}</span>
      </div>
      <div class="ap-past-study-notice">${esc(notice || '')}</div>
      <div class="ap-past-study-nav" aria-label="${esc(t('해설 문제 선택', '解説問題選択'))}">${nav}</div>
      <div id="ap-past-study-detail" class="ap-past-study-detail"></div>
    </section>`;
  }
  function studyDetailHtml(question, revealed) {
    if (!question) return '';
    const sectionLabel = question.sectionCode === 'T' ? t('테크놀로지', 'テクノロジ') : question.sectionCode === 'M' ? t('매니지먼트', 'マネジメント') : t('스트래티지', 'ストラテジ');
    return `<article class="ap-past-study-question">
      <div class="ap-past-study-question-head">
        <div><span class="ap-past-study-section">${esc(question.sectionCode)} · ${esc(sectionLabel)}</span><h3>Q${question.questionNo} · ${esc(question.topicKo)}</h3></div>
        <button type="button" class="ap-past-study-reveal" data-study-reveal>${esc(revealed ? t('정답·해설 숨기기', '正解・解説を隠す') : t('정답·해설 보기', '正解・解説を見る'))}</button>
      </div>
      <div class="ap-past-study-block"><strong>${esc(t('한국어 학습 해석', '韓国語学習補助訳'))}</strong><p>${esc(question.interpretationKo)}</p></div>
      <div class="ap-past-study-answer" ${revealed ? '' : 'hidden'}>
        <div class="ap-past-study-correct"><span>${esc(t('정답', '正解'))}</span><strong>${esc(question.correctChoice)}</strong></div>
        <div class="ap-past-study-block"><strong>${esc(t('상세해설', '詳細解説'))}</strong><p>${esc(question.explanationKo)}</p></div>
        <div class="ap-past-study-point"><strong>${esc(t('시험 포인트', '試験ポイント'))}</strong><span>${esc(question.examPointKo)}</span></div>
      </div>
    </article>`;
  }
  function bindStudyCompanion(companion) {
    if (!companion?.questions?.length) return;
    const detail = document.getElementById('ap-past-study-detail');
    const card = document.getElementById('ap-past-study-card');
    let currentNo = Number(loadState().studyQuestionNo) || companion.questions[0].questionNo;
    let revealed = false;

    function renderCurrent(question) {
      if (!detail) return;
      detail.innerHTML = studyDetailHtml(question, revealed);
      detail.querySelector('[data-study-reveal]')?.addEventListener('click', () => {
        revealed = !revealed;
        renderCurrent(question);
      });
    }
    function showQuestion(no, options = {}) {
      const question = companion.questions.find((item) => item.questionNo === Number(no)) || companion.questions[0];
      currentNo = question.questionNo;
      revealed = false;
      const state = loadState();
      state.studyQuestionNo = currentNo;
      saveState(state);
      document.querySelectorAll('[data-study-question]').forEach((button) => {
        button.classList.toggle('is-active', Number(button.dataset.studyQuestion) === currentNo);
      });
      renderCurrent(question);
      if (options.scroll) card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    document.querySelectorAll('[data-study-question]').forEach((button) => {
      button.addEventListener('click', () => showQuestion(Number(button.dataset.studyQuestion), { scroll: false }));
    });
    document.querySelectorAll('.ap-past-a-item[data-question-no]').forEach((item) => {
      item.addEventListener('click', () => showQuestion(Number(item.dataset.questionNo), { scroll: false }));
    });
    showQuestion(currentNo);
  }
  async function loadStudyCompanion() {
    try {
      const response = await fetch(`/assets/data/ap-past-study/${encodeURIComponent(sessionKey)}-${encodeURIComponent(subject)}.json`, { cache: 'no-cache' });
      if (!response.ok) return null;
      const data = await response.json();
      if (data?.sessionKey !== sessionKey || data?.subject !== subject || !Array.isArray(data.questions)) return null;
      return data;
    } catch {
      return null;
    }
  }
  function bindA(meta) {
    const state = loadState();
    state.answers = state.answers && typeof state.answers === 'object' ? state.answers : {};
    document.querySelectorAll('[data-answer-choice]').forEach((button) => {
      button.addEventListener('click', () => {
        const item = button.closest('[data-question-no]');
        const no = Number(item?.dataset.questionNo);
        if (!Number.isInteger(no)) return;
        state.answers[no] = button.dataset.answerChoice;
        state.graded = false;
        const latestState = loadState();
        state.studyQuestionNo = latestState.studyQuestionNo;
        saveState(state);
        item.querySelectorAll('[data-answer-choice]').forEach((el) => {
          const selected = el === button;
          el.classList.toggle('is-selected', selected);
          el.setAttribute('aria-pressed', String(selected));
        });
        item.classList.remove('is-correct', 'is-wrong');
        item.querySelector('.ap-past-a-correct')?.remove();
        const count = Object.values(state.answers).filter((v) => choiceOrder.includes(v)).length;
        const progress = document.getElementById('ap-past-progress-count');
        if (progress) progress.textContent = `${count} / 80`;
        const result = document.getElementById('ap-past-grade-result');
        if (result) { result.className = 'ap-past-grade-result'; result.textContent = t('채점 전입니다.', '採点前です。'); }
      });
    });
    document.getElementById('ap-past-grade')?.addEventListener('click', () => {
      const key = Array.from(meta.answerKey || '');
      let correct = 0;
      for (let no = 1; no <= 80; no += 1) {
        const item = document.querySelector(`.ap-past-a-item[data-question-no="${no}"]`);
        const answer = key[no - 1] || '';
        const selected = state.answers[no] || '';
        if (selected === answer) correct += 1;
        item?.classList.toggle('is-correct', selected === answer);
        item?.classList.toggle('is-wrong', selected !== answer);
        let label = item?.querySelector('.ap-past-a-correct');
        if (!label && item) {
          label = document.createElement('div');
          label.className = 'ap-past-a-correct';
          item.appendChild(label);
        }
        if (label) label.textContent = `${t('정답', '正解')} ${answer}`;
      }
      state.graded = true;
      const latestState = loadState();
      state.studyQuestionNo = latestState.studyQuestionNo;
      saveState(state);
      const scored = scoreText(correct, 80);
      const result = document.getElementById('ap-past-grade-result');
      if (result) {
        result.className = `ap-past-grade-result ${scored.score >= 60 ? 'is-pass' : 'is-fail'}`;
        result.textContent = `${scored.text} · ${scored.score >= 60 ? t('합격권', '合格圏') : t('60점 미만', '60点未満')}`;
      }
      document.querySelector('.ap-past-answer-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.getElementById('ap-past-reset')?.addEventListener('click', () => {
      if (!confirm(t('이 회차의 저장된 답안을 모두 지울까요?', 'この回の保存済み解答をすべて削除しますか？'))) return;
      localStorage.removeItem(storageKey);
      location.reload();
    });
  }
  function bindB() {
    const state = loadState();
    state.selected = Array.isArray(state.selected) ? state.selected.map(Number) : [1];
    if (!state.selected.includes(1)) state.selected.unshift(1);
    state.selected = [...new Set(state.selected)].filter((n) => n >= 1 && n <= 11).slice(0, 5);
    state.notes = state.notes && typeof state.notes === 'object' ? state.notes : {};
    const warning = document.getElementById('ap-past-b-warning');
    function syncCount() {
      const count = document.getElementById('ap-past-b-selected-count');
      if (count) count.textContent = `${state.selected.length} / 5`;
    }
    document.querySelectorAll('[data-b-select]').forEach((input) => {
      input.addEventListener('change', () => {
        const no = Number(input.dataset.bSelect);
        if (input.checked) {
          if (state.selected.length >= 5) {
            input.checked = false;
            if (warning) { warning.hidden = false; warning.textContent = t('Q1 포함 최대 5문제까지만 선택할 수 있습니다.', 'Q1を含め最大5問まで選択できます。'); }
            return;
          }
          state.selected.push(no);
        } else {
          state.selected = state.selected.filter((value) => value !== no);
        }
        state.selected = [...new Set(state.selected)];
        const item = input.closest('[data-question-no]');
        item?.classList.toggle('is-selected', input.checked);
        const note = item?.querySelector('[data-b-note]');
        if (note) note.hidden = !input.checked;
        if (warning) warning.hidden = true;
        saveState(state);
        syncCount();
      });
    });
    document.querySelectorAll('[data-b-note]').forEach((textarea) => {
      textarea.addEventListener('input', () => {
        const no = Number(textarea.dataset.bNote);
        state.notes[no] = textarea.value;
        saveState(state);
      });
    });
  }

  async function load() {
    if (!root || !sessionKey) return;
    try {
      const [response, companion] = await Promise.all([
        fetch('/assets/data/ap-past-exams.json', { cache: 'no-cache' }),
        loadStudyCompanion(),
      ]);
      const data = await response.json();
      const session = data.sessions?.find((item) => item.key === sessionKey);
      const meta = session?.subjects?.[subject];
      if (!session || !meta || !['viewer-ready', 'ready'].includes(meta.status) || !meta.questionPdfUrl) throw new Error('PAST_EXAM_NOT_READY');
      document.title = `${t(session.titleKo, session.titleJa)} · ${t(meta.displayLabelKo, meta.displayLabelJa)} | SONG`;
      const heading = document.getElementById('ap-past-viewer-title');
      const subheading = document.getElementById('ap-past-viewer-subtitle');
      if (heading) heading.textContent = t(session.titleKo, session.titleJa);
      if (subheading) subheading.textContent = `${t(meta.displayLabelKo, meta.displayLabelJa)} · ${session.administeredAt}`;
      root.innerHTML = `<div class="ap-past-viewer-layout">${renderPdf(meta)}${subject === 'A' ? renderSubjectA(meta, session) : renderSubjectB(meta, session)}</div>${renderStudyCompanion(companion)}`;
      if (subject === 'A') bindA(meta); else bindB();
      bindStudyCompanion(companion);
    } catch (error) {
      console.error(error);
      root.innerHTML = `<p class="ap-mock-error">${esc(t('이 기출문제를 불러오지 못했습니다.', 'この過去問を読み込めませんでした。'))}</p>`;
    }
  }
  load();
})();