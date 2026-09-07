(() => {
  const body = document.body;
  const lang = body?.dataset?.blogLanguage === 'ko' ? 'ko' : 'ja';
  const t = (ko, ja) => lang === 'ko' ? ko : ja;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const root = document.getElementById('ap-b-simulation-root');
  if (!root) return;

  const DATA_URL = '/assets/data/ap-reinforcement/5-session-B-calibration.json';
  const SESSION_KEY = 'song:ap:b-exam-simulation:v1';
  const PERFORMANCE_KEY = 'song:ap:b-reinforcement-performance:v1';
  const CHANGE_EVENT = 'song:ap:b-performance-changed';
  const DURATION_SECONDS = 150 * 60;
  const PERFORMANCE_LIMIT = 20;
  let timer = null;
  let currentData = null;
  let inMemoryAnswers = {};
  let reviewState = null;

  function formatTime(seconds) {
    const safe = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const s = safe % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  function fieldName(q) { return lang === 'ko' ? q.fieldKo : q.fieldJa; }
  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch { return fallback; }
  }
  function readSession() {
    const state = readJson(SESSION_KEY, null);
    if (!state || state.version !== 1 || !['active','finished'].includes(state.status)) return null;
    return state;
  }
  function writeSession(state) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(state));
  }
  function clearSession() { localStorage.removeItem(SESSION_KEY); }
  function requestedFocus() {
    return String(new URLSearchParams(location.search).get('focus') || '').split(',').map(Number).filter((n,i,a)=>n>=2&&n<=11&&a.indexOf(n)===i).slice(0,4);
  }
  function suggestedOptionals(questions) {
    const requested = requestedFocus();
    if (requested.length === 4) return requested;
    const attempts = readJson(PERFORMANCE_KEY, { attempts: [] })?.attempts || [];
    const scores = {};
    for (let no=2; no<=11; no+=1) scores[no] = [];
    for (const attempt of Array.isArray(attempts) ? attempts.slice(-20) : []) {
      for (const [key, raw] of Object.entries(attempt?.scores || {})) {
        const no = Number(key), value = Number(raw);
        if (scores[no] && Number.isFinite(value)) scores[no].push(Math.max(0,Math.min(20,value)));
      }
    }
    const ranked = Object.entries(scores).map(([key, values]) => ({ no:Number(key), avg:values.length ? values.reduce((a,b)=>a+b,0)/values.length : null, count:values.length }))
      .sort((a,b) => (b.avg ?? -1) - (a.avg ?? -1) || b.count-a.count || a.no-b.no)
      .map((x)=>x.no);
    const result = [];
    for (const no of ranked) if (!result.includes(no)) result.push(no);
    for (const q of questions) if (Number(q.questionNo) >= 2 && !result.includes(Number(q.questionNo))) result.push(Number(q.questionNo));
    return result.slice(0,4);
  }
  async function fetchData() {
    const response = await fetch(DATA_URL, { credentials:'same-origin' });
    const data = await response.json().catch(()=>({}));
    if (!response.ok || !Array.isArray(data.questions) || data.questions.length !== 11) throw new Error(`HTTP_${response.status}`);
    return data;
  }
  function patchLanguageLink() {
    const link = document.querySelector('.blog-dashboard-language a');
    if (!link) return;
    const url = new URL(link.href, location.origin);
    url.search = location.search;
    link.href = `${url.pathname}${url.search}`;
  }
  function questionByNo(no) { return currentData?.questions?.find((q)=>Number(q.questionNo)===Number(no)); }
  function optionalSelectorHtml(selected) {
    return currentData.questions.filter((q)=>!q.mandatory).map((q)=>{
      const no = Number(q.questionNo);
      const active = selected.includes(no);
      return `<button type="button" class="ap-mock-button${active ? ' is-active' : ''}" data-sim-pick="${no}" aria-pressed="${active ? 'true':'false'}">Q${no} ${esc(fieldName(q))}</button>`;
    }).join('');
  }
  function renderIntro() {
    clearInterval(timer);
    const selected = suggestedOptionals(currentData.questions);
    root.innerHTML = `<section class="ap-mock-card"><div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">150 MIN SUBJECT B SIMULATION</p><h2>${esc(t('科目B 실전 시험 시뮬레이션','科目B 実戦試験シミュレーション'))}</h2></div><p>150 min · 5/11</p></div><p class="ap-past-guide">${esc(t('Q1 정보보안은 필수이고 Q2~Q11에서 4개 분야를 선택합니다. 시험 시작 후 150분 타이머가 진행되며 종료 또는 시간 만료 즉시 답안이 잠깁니다. 답안 원문은 브라우저 저장소에 저장하지 않습니다.','Q1情報セキュリティは必須で、Q2〜Q11から4分野を選択します。開始後は150分タイマーが進み、終了または時間切れと同時に答案をロックします。解答本文はブラウザ保存領域に保存しません。'))}</p><p class="ap-mock-note">${esc(t('시작 전에 선택 4개를 확정합니다. 저장된 자기채점이 있으면 강한 분야를 우선 제안하고, URL의 추천 focus가 있으면 그 4개를 우선 선택합니다.','開始前に選択4分野を確定します。自己採点履歴があれば得意分野を優先提案し、URLに推薦focusがあればその4分野を優先選択します。'))}</p><div class="ap-past-actions" data-sim-selector>${optionalSelectorHtml(selected)}</div><p class="ap-mock-note" data-sim-count>${esc(t(`선택 ${selected.length}/4`,`選択 ${selected.length}/4`))}</p><div class="ap-past-actions"><button type="button" class="ap-mock-button" data-sim-start>${esc(t('150분 실전 시작','150分実戦を開始'))}</button><a class="ap-mock-button" href="/${lang}/study/ap/mock-exams/?subject=B">${esc(t('科目B 대시보드로 돌아가기','科目Bダッシュボードへ戻る'))}</a></div></section>`;
    const selection = new Set(selected);
    const refresh = () => {
      root.querySelectorAll('[data-sim-pick]').forEach((button)=>{
        const active = selection.has(Number(button.dataset.simPick));
        button.classList.toggle('is-active',active); button.setAttribute('aria-pressed',active?'true':'false');
      });
      const count = root.querySelector('[data-sim-count]'); if (count) count.textContent = t(`선택 ${selection.size}/4`,`選択 ${selection.size}/4`);
      const start = root.querySelector('[data-sim-start]'); if (start) start.disabled = selection.size !== 4;
    };
    root.querySelectorAll('[data-sim-pick]').forEach((button)=>button.addEventListener('click',()=>{
      const no = Number(button.dataset.simPick);
      if (selection.has(no)) selection.delete(no);
      else if (selection.size < 4) selection.add(no);
      else { alert(t('선택 분야는 4개까지만 고를 수 있습니다. 먼저 하나를 해제하세요.','選択分野は4つまでです。先に1つ解除してください。')); return; }
      refresh();
    }));
    root.querySelector('[data-sim-start]')?.addEventListener('click',()=>startExam(Array.from(selection).sort((a,b)=>a-b)));
    refresh();
  }
  function examQuestionHtml(q) {
    const content = q.content || {};
    const passage = lang === 'ko' ? content.passageKo : content.passageJa;
    const selected = q.mandatory || reviewState?.selected?.includes(Number(q.questionNo));
    return `<article class="ap-mock-question ap-reinforcement-b-question${selected?' is-selected':''}" data-sim-question="${q.questionNo}"><div class="ap-mock-question-head"><div><span class="ap-mock-question-number">Q${q.questionNo}</span> <span class="ap-mock-status">${esc(fieldName(q))}</span> ${q.mandatory?`<span class="ap-mock-status is-completed">${esc(t('필수','必須'))}</span>`:selected?`<span class="ap-mock-status is-progress">${esc(t('선택','選択'))}</span>`:''}</div><span>${esc(t(`난이도 ${q.difficulty}/4`,`難易度 ${q.difficulty}/4`))}</span></div><div class="ap-mock-question-body"><p class="ap-mock-question-prompt">${esc(passage)}</p>${(content.subquestions||[]).map((sq)=>`<label class="ap-reinforcement-b-sub"><p><strong>${esc(String(sq.key||'').toUpperCase())}.</strong> ${esc(lang==='ko'?sq.promptKo:sq.promptJa)} <span class="ap-mock-note">(${sq.score}${esc(t('점','点'))})</span></p><textarea class="ap-mock-answer-input" rows="3" data-sim-answer="${q.questionNo}:${esc(sq.key)}" placeholder="${esc(t('답안을 직접 작성하세요.','解答を入力してください。'))}"></textarea></label>`).join('')}</div></article>`;
  }
  function updateToolbar(state) {
    const countdown = root.querySelector('[data-sim-countdown]');
    if (!countdown) return;
    const remaining = Math.max(0,Math.ceil((Number(state.deadlineAt)-Date.now())/1000));
    countdown.textContent = formatTime(remaining);
    const warning = root.querySelector('[data-sim-warning]');
    if (warning) warning.textContent = remaining <= 600 ? t('10분 이하 남음','残り10分以下') : remaining <= 1800 ? t('30분 이하 남음','残り30分以下') : '';
    if (remaining <= 0) finishExam(true);
  }
  function renderExam(state, resumed=false) {
    reviewState = state;
    inMemoryAnswers = {};
    root.innerHTML = `<section class="ap-mock-card"><div class="ap-mock-exam-toolbar"><div><span>${esc(t('남은 시간','残り時間'))}</span><strong data-sim-countdown>${formatTime(DURATION_SECONDS)}</strong><small data-sim-warning></small></div><div><span>${esc(t('선택 문제','選択問題'))}</span><strong>Q1 + ${state.selected.filter((n)=>n!==1).map((n)=>`Q${n}`).join(', ')}</strong></div><button type="button" class="ap-mock-button" data-sim-finish>${esc(t('시험 종료·답안 잠금','試験終了・答案ロック'))}</button></div>${resumed?`<p class="ap-mock-error">${esc(t('진행 중인 시험을 다시 열었습니다. 타이머는 계속 진행되지만 새로고침 전에 작성했던 답안 원문은 저장하지 않으므로 복구되지 않습니다.','進行中の試験を再度開きました。タイマーは継続しますが、再読み込み前に入力した解答本文は保存しないため復元されません。'))}</p>`:''}<p class="ap-mock-note">${esc(t('페이지를 새로고침하거나 닫으면 작성 중인 답안 원문은 사라지지만 시험 종료시각은 유지됩니다.','ページを再読み込み・閉じると入力中の解答本文は失われますが、試験終了時刻は維持されます。'))}</p></section><div class="ap-mock-question-list">${currentData.questions.map(examQuestionHtml).join('')}</div>`;
    root.querySelectorAll('[data-sim-answer]').forEach((textarea)=>textarea.addEventListener('input',()=>{ inMemoryAnswers[textarea.dataset.simAnswer]=textarea.value; }));
    root.querySelector('[data-sim-finish]')?.addEventListener('click',()=>finishExam(false));
    updateToolbar(state);
    clearInterval(timer); timer = setInterval(()=>updateToolbar(state),1000);
  }
  function startExam(optionals) {
    if (optionals.length !== 4) return;
    const now = Date.now();
    const state = { version:1, status:'active', startedAt:now, deadlineAt:now+DURATION_SECONDS*1000, selected:[1,...optionals].sort((a,b)=>a-b) };
    writeSession(state);
    renderExam(state,false);
    window.scrollTo({ top:0, behavior:'smooth' });
  }
  function snapshotAnswers() {
    const answers = {};
    root.querySelectorAll('[data-sim-answer]').forEach((textarea)=>{ answers[textarea.dataset.simAnswer]=textarea.value; });
    return answers;
  }
  function reviewQuestionHtml(q, selected, answers) {
    const content = q.content || {};
    const passage = lang === 'ko' ? content.passageKo : content.passageJa;
    const chosen = selected.includes(Number(q.questionNo));
    if (!chosen) return '';
    return `<article class="ap-mock-question ap-reinforcement-b-question is-selected" data-review-question="${q.questionNo}"><div class="ap-mock-question-head"><div><span class="ap-mock-question-number">Q${q.questionNo}</span> <span class="ap-mock-status">${esc(fieldName(q))}</span></div><span>20${esc(t('점','点'))}</span></div><div class="ap-mock-question-body"><p class="ap-mock-question-prompt">${esc(passage)}</p>${(content.subquestions||[]).map((sq)=>{ const key=`${q.questionNo}:${sq.key}`; const mine=answers[key]||''; return `<div class="ap-reinforcement-b-sub"><p><strong>${esc(String(sq.key||'').toUpperCase())}.</strong> ${esc(lang==='ko'?sq.promptKo:sq.promptJa)} <span class="ap-mock-note">(${sq.score}${esc(t('점','点'))})</span></p><div class="ap-mock-explanation"><p><strong>${esc(t('내 답안','自分の解答'))}:</strong> ${mine?esc(mine):esc(t('(미작성)','（未記入）'))}</p><p><strong>${esc(t('모범답안','模範解答'))}:</strong> ${esc(lang==='ko'?sq.modelKo:sq.modelJa)}</p><label class="ap-mock-note"><input type="checkbox" data-sim-self-score data-question-no="${q.questionNo}" data-points="${sq.score}"/> ${esc(t(`이 소문항 배점 획득 (+${sq.score}점)`,`この小問の得点を獲得（+${sq.score}点）`))}</label></div></div>`; }).join('')}<div class="ap-mock-explanation"><p>${esc(lang==='ko'?q.explanationKo:q.explanationJa)}</p><p class="ap-mock-note"><strong>${esc(t('시험 포인트','試験ポイント'))}:</strong> ${esc(lang==='ko'?q.examPointKo:q.examPointJa)}</p></div></div></article>`;
  }
  function collectScores(selected) {
    const scores = {};
    for (const no of selected) {
      scores[String(no)] = Array.from(root.querySelectorAll(`[data-sim-self-score][data-question-no="${no}"]`)).reduce((sum,input)=>sum+(input.checked?Number(input.dataset.points||0):0),0);
    }
    return { scores, total:Object.values(scores).reduce((sum,v)=>sum+Number(v||0),0) };
  }
  function renderScoreSummary(state) {
    const box = root.querySelector('[data-sim-score-summary]'); if (!box) return;
    const result = collectScores(state.selected);
    box.innerHTML = `<p class="ap-past-guide"><strong>${esc(t('자기채점 합계','自己採点合計'))}: ${result.total}/100</strong> · ${result.total>=60?esc(t('합격선 이상','合格ライン以上')):esc(t('합격선 미달','合格ライン未満'))}</p>`;
  }
  function finishExam(timedOut) {
    const state = readSession();
    if (!state || state.status !== 'active') return;
    if (!timedOut && !confirm(t('시험을 종료할까요? 종료 후에는 답안을 수정할 수 없습니다.','試験を終了しますか？終了後は答案を変更できません。'))) return;
    const answers = snapshotAnswers();
    clearInterval(timer);
    const endedAt = timedOut ? Number(state.deadlineAt) : Date.now();
    const finished = { ...state, status:'finished', endedAt, timedOut:Boolean(timedOut) };
    writeSession(finished);
    reviewState = finished;
    const elapsed = Math.min(DURATION_SECONDS,Math.max(0,Math.round((endedAt-Number(state.startedAt))/1000)));
    root.innerHTML = `<section class="ap-mock-card"><div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">SUBJECT B REVIEW</p><h2>${esc(t(timedOut?'시간 종료 · 답안 잠금':'시험 종료 · 답안 잠금',timedOut?'時間終了・答案ロック':'試験終了・答案ロック'))}</h2></div><p>${formatTime(elapsed)}</p></div><p class="ap-past-guide">${esc(t('답안이 잠겼습니다. 선택한 5문제만 모범답안과 비교해 소문항별 자기채점을 하세요. 체크 결과만 점수 이력에 저장되며 답안 원문은 저장하지 않습니다.','答案をロックしました。選択した5問だけ模範解答と比較し、小問ごとに自己採点してください。チェック結果だけを得点履歴へ保存し、解答本文は保存しません。'))}</p><div data-sim-score-summary></div></section><div class="ap-mock-question-list">${currentData.questions.map((q)=>reviewQuestionHtml(q,finished.selected,answers)).join('')}</div><section class="ap-mock-card"><div class="ap-past-actions"><button type="button" class="ap-mock-button" data-sim-save>${esc(t('실전 결과 저장','実戦結果を保存'))}</button><a class="ap-mock-button" href="/${lang}/study/ap/mock-exams/?subject=B">${esc(t('科目B 대시보드','科目Bダッシュボード'))}</a></div><p class="ap-mock-note" data-sim-save-status></p></section>`;
    root.querySelectorAll('[data-sim-self-score]').forEach((input)=>input.addEventListener('change',()=>renderScoreSummary(finished)));
    root.querySelector('[data-sim-save]')?.addEventListener('click',()=>saveResult(finished));
    renderScoreSummary(finished);
    clearSession();
    window.scrollTo({ top:0, behavior:'smooth' });
  }
  function saveResult(state) {
    const result = collectScores(state.selected);
    const endedAt = Number(state.endedAt) || Date.now();
    const elapsed = Math.min(DURATION_SECONDS,Math.max(0,Math.round((endedAt-Number(state.startedAt))/1000)));
    const data = readJson(PERFORMANCE_KEY,{ version:1, attempts:[] });
    const attempts = Array.isArray(data?.attempts) ? data.attempts : [];
    attempts.push({ at:new Date(endedAt).toISOString(), selected:state.selected.slice(), scores:result.scores, total:result.total, source:'simulation', mode:'timed-150', startedAt:new Date(Number(state.startedAt)).toISOString(), durationSecondsUsed:elapsed, timedOut:Boolean(state.timedOut) });
    const safe = attempts.slice(-PERFORMANCE_LIMIT);
    localStorage.setItem(PERFORMANCE_KEY,JSON.stringify({version:1,attempts:safe}));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT,{detail:{count:safe.length}}));
    const status = root.querySelector('[data-sim-save-status]');
    if (status) status.textContent = t(`저장 완료 · ${result.total}/100 · 소요 ${formatTime(elapsed)} · 최근 ${safe.length}회 이력에 반영`,`保存完了・${result.total}/100・所要 ${formatTime(elapsed)}・直近${safe.length}回の履歴へ反映`);
    const button = root.querySelector('[data-sim-save]'); if (button) button.disabled=true;
  }
  function resumeOrIntro() {
    const state = readSession();
    if (!state) { renderIntro(); return; }
    if (state.status === 'finished') { clearSession(); renderIntro(); return; }
    const remaining = Number(state.deadlineAt)-Date.now();
    if (remaining <= 0) {
      reviewState=state; renderExam(state,true); setTimeout(()=>finishExam(true),0); return;
    }
    reviewState=state; renderExam(state,true);
  }
  window.addEventListener('beforeunload',(event)=>{
    const state=readSession();
    if (!state || state.status!=='active') return;
    event.preventDefault(); event.returnValue='';
  });

  patchLanguageLink();
  fetchData().then((data)=>{ currentData=data; resumeOrIntro(); }).catch((error)=>{
    root.innerHTML=`<p class="ap-mock-error">${esc(t('실전 시뮬레이션 데이터를 불러오지 못했습니다.','実戦シミュレーションデータを読み込めませんでした。'))} (${esc(error.message)})</p>`;
  });
})();
