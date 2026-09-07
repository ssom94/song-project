(() => {
  const body = document.body;
  const lang = body?.dataset?.blogLanguage === 'ko' ? 'ko' : 'ja';
  const t = (ko, ja) => lang === 'ko' ? ko : ja;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const PERFORMANCE_KEY = 'song:ap:b-reinforcement-performance:v1';
  const GOAL_KEY = 'song:ap:b-score-goal:v1';
  const CHANGE_EVENT = 'song:ap:b-performance-changed';
  const PASS_SCORE = 60;
  const DEFAULT_GOAL = 70;
  const fields = [
    [1,'정보보안','情報セキュリティ'],[2,'경영전략','経営戦略'],[3,'프로그래밍','プログラミング'],[4,'시스템 아키텍처','システムアーキテクチャ'],[5,'네트워크','ネットワーク'],[6,'데이터베이스','データベース'],[7,'임베디드 시스템','組込みシステム'],[8,'시스템 개발','システム開発'],[9,'프로젝트 관리','プロジェクトマネジメント'],[10,'서비스 관리','サービスマネジメント'],[11,'시스템 감사','システム監査']
  ];

  function subjectFromUrl() { return new URLSearchParams(location.search).get('subject') === 'B' ? 'B' : 'A'; }
  function clamp(value,min,max) { return Math.max(min,Math.min(max,value)); }
  function avg(values) { return values.length ? values.reduce((sum,value)=>sum+value,0)/values.length : 0; }
  function fieldName(no) { const row = fields.find((item)=>item[0]===no); return row ? t(row[1],row[2]) : `Q${no}`; }
  function readAttempts() {
    try {
      const data = JSON.parse(localStorage.getItem(PERFORMANCE_KEY) || '{}');
      return Array.isArray(data?.attempts) ? data.attempts.slice(-20) : [];
    } catch { return []; }
  }
  function readGoal() {
    try {
      const data = JSON.parse(localStorage.getItem(GOAL_KEY) || '{}');
      return clamp(Math.round(Number(data?.score) || DEFAULT_GOAL), PASS_SCORE, 100);
    } catch { return DEFAULT_GOAL; }
  }
  function saveGoal(score) {
    const value = clamp(Math.round(Number(score) || DEFAULT_GOAL), PASS_SCORE, 100);
    localStorage.setItem(GOAL_KEY, JSON.stringify({ version:1, score:value }));
    return value;
  }
  function scoreSeries(attempts) {
    const out = {};
    for (const [no] of fields) out[no] = [];
    for (const attempt of attempts) {
      const scores = attempt?.scores && typeof attempt.scores === 'object' ? attempt.scores : {};
      for (const [key,raw] of Object.entries(scores)) {
        const no = Number(key), value = Number(raw);
        if (!out[no] || !Number.isFinite(value)) continue;
        out[no].push(clamp(value,0,20));
      }
    }
    return out;
  }
  function estimate(values) {
    if (!values.length) return null;
    const recent = values.slice(-4);
    let weighted = 0, weightSum = 0;
    recent.forEach((value,index) => { const weight=index+1; weighted += value*weight; weightSum += weight; });
    const expected = weighted / weightSum;
    const mean = avg(recent);
    const variance = recent.length > 1 ? avg(recent.map((value)=>(value-mean)**2)) : 0;
    const spread = Math.sqrt(variance);
    const samplePenalty = recent.length === 1 ? 3 : recent.length === 2 ? 2 : recent.length === 3 ? 1.5 : 1;
    const lower = clamp(expected - Math.max(samplePenalty, spread * 0.75), 0, 20);
    return { count: values.length, expected, lower, latest: values[values.length-1], spread };
  }
  function buildModel(attempts) {
    const series = scoreSeries(attempts);
    const model = {};
    for (const [no] of fields) model[no] = estimate(series[no]);
    const testedOptionals = fields.slice(1).map(([no])=>({ no, estimate:model[no] })).filter((item)=>item.estimate).sort((a,b)=>b.estimate.expected-a.estimate.expected || b.estimate.count-a.estimate.count || a.no-b.no);
    const selected = testedOptionals.slice(0,4);
    const ready = Boolean(model[1]) && selected.length === 4;
    const expected = ready ? model[1].expected + selected.reduce((sum,item)=>sum+item.estimate.expected,0) : null;
    const conservative = ready ? model[1].lower + selected.reduce((sum,item)=>sum+item.estimate.lower,0) : null;
    return { model, selected, ready, expected, conservative, testedOptionalCount: testedOptionals.length };
  }
  function stability(model) {
    if (!model.ready) return { key:'insufficient', label:t('데이터 부족','データ不足') };
    if (model.conservative >= PASS_SCORE) return { key:'stable', label:t('합격 안정권','合格安定圏') };
    if (model.expected >= PASS_SCORE) return { key:'border', label:t('합격 경계권','合格ボーダー') };
    return { key:'below', label:t('합격선 미달','合格ライン未満') };
  }
  function improvementPlan(model, goal) {
    if (!model.ready) return [];
    let remaining = Math.max(0, goal - model.expected);
    const chosen = [{ no:1, estimate:model.model[1] }, ...model.selected].sort((a,b)=>a.estimate.expected-b.estimate.expected || a.no-b.no);
    const plan = chosen.map((item)=>({ no:item.no, current:item.estimate.expected, target:item.estimate.expected, gain:0 }));
    if (remaining <= 0) return plan;
    const baseline = clamp(Math.ceil(goal/5),12,17);
    for (const row of plan) {
      if (remaining <= 0) break;
      const capacity = Math.max(0, Math.min(20, baseline) - row.target);
      const gain = Math.min(capacity, remaining);
      row.target += gain; row.gain += gain; remaining -= gain;
    }
    let guard = 0;
    while (remaining > 0.01 && guard < 200) {
      guard += 1;
      let changed = false;
      for (const row of plan) {
        if (remaining <= 0.01) break;
        if (row.target >= 20) continue;
        const gain = Math.min(1, 20-row.target, remaining);
        row.target += gain; row.gain += gain; remaining -= gain; changed = true;
      }
      if (!changed) break;
    }
    return plan;
  }
  function locate() {
    let el = document.getElementById('ap-b-score-goal');
    if (el) return el;
    const history = document.getElementById('ap-b-learning-history');
    const progress = document.getElementById('ap-b-progress-trends');
    const anchor = history || progress;
    if (!anchor?.parentElement) return null;
    el = document.createElement('section');
    el.id = 'ap-b-score-goal';
    el.className = 'ap-mock-section';
    anchor.parentElement.insertBefore(el, anchor.nextSibling);
    return el;
  }
  function render() {
    const existing = document.getElementById('ap-b-score-goal');
    if (subjectFromUrl() !== 'B') { if (existing) existing.hidden = true; return; }
    const el = locate(); if (!el) return;
    el.hidden = false;
    const attempts = readAttempts();
    const goal = readGoal();
    const model = buildModel(attempts);
    const state = stability(model);
    const selectedNos = model.selected.map((item)=>item.no);
    const selectedText = model.ready ? [`Q1 ${fieldName(1)}`, ...model.selected.map((item)=>`Q${item.no} ${fieldName(item.no)}`)].join(' · ') : '-';
    const missing = [];
    if (!model.model[1]) missing.push(`Q1 ${fieldName(1)}`);
    if (model.testedOptionalCount < 4) missing.push(t(`선택분야 ${4-model.testedOptionalCount}개 추가 측정`,`選択分野をあと${4-model.testedOptionalCount}つ測定`));
    const expectedText = model.ready ? `${model.expected.toFixed(1)}/100` : '-';
    const conservativeText = model.ready ? `${model.conservative.toFixed(1)}/100` : '-';
    const passGap = model.ready ? Math.max(0,PASS_SCORE-model.expected) : null;
    const goalGap = model.ready ? Math.max(0,goal-model.expected) : null;
    const plan = improvementPlan(model,goal).filter((row)=>row.gain > 0.05);
    const planRows = plan.length ? plan.map((row)=>`<tr><td><strong>Q${row.no} ${esc(fieldName(row.no))}</strong></td><td>${row.current.toFixed(1)}/20</td><td><strong>${Math.ceil(row.target)}/20</strong></td><td>+${row.gain.toFixed(1)}</td></tr>`).join('') : `<tr><td colspan="4">${esc(model.ready ? t('현재 예상점수가 목표점수에 도달했습니다. 현재 수준을 유지하세요.','現在の予想得点は目標点に到達しています。現在の水準を維持してください。') : t('점수 계획을 만들려면 Q1과 선택분야 4개의 자기채점 기록이 필요합니다.','得点計画を作るにはQ1と選択4分野の自己採点記録が必要です。'))}</td></tr>`;
    const focusForPractice = model.ready ? selectedNos : fields.slice(1).map(([no])=>no).filter((no)=>!model.model[no]).slice(0,4);
    const focusLink = focusForPractice.length === 4 ? `/${lang}/study/ap/reinforcement/?subject=B&focus=${encodeURIComponent(focusForPractice.join(','))}&source=goal` : `/${lang}/study/ap/reinforcement/?subject=B`;
    const statusNote = !model.ready
      ? t(`현재는 합격 안정권을 판정하기에 데이터가 부족합니다. ${missing.join(' · ')}가 필요합니다.`,`現在は合格安定圏を判定するデータが不足しています。${missing.join(' · ')}が必要です。`)
      : state.key === 'stable'
        ? t(`보수적 예상점수도 ${PASS_SCORE}점 이상이라 현재 기록 기준 합격 안정권입니다.`,`保守的予想得点も${PASS_SCORE}点以上のため、現在の記録基準では合格安定圏です。`)
        : state.key === 'border'
          ? t(`평균 예상은 합격선을 넘지만 보수적 예상은 ${PASS_SCORE}점 미만입니다. 변동성을 줄이기 위한 추가 보강이 필요합니다.`,`平均予想は合格ラインを超えていますが、保守的予想は${PASS_SCORE}点未満です。変動を抑える追加補強が必要です。`)
          : t(`현재 예상점수가 합격선 ${PASS_SCORE}점보다 낮습니다. 아래 목표 배점 계획부터 우선 보강하세요.`,`現在の予想得点は合格ライン${PASS_SCORE}点を下回っています。以下の目標配点計画から優先して補強してください。`);

    el.innerHTML = `<div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">SUBJECT B SCORE GOAL</p><h2>${esc(t('科目B 목표점수·합격 안정권','科目B 目標得点・合格安定圏'))}</h2></div><p><strong>${esc(state.label)}</strong></p></div><section class="ap-mock-card"><div class="ap-past-actions"><label>${esc(t('개인 목표점수','個人目標点'))} <input type="number" min="${PASS_SCORE}" max="100" step="1" value="${goal}" data-b-goal-input style="width:6em"/> /100</label><button class="ap-mock-button" type="button" data-b-goal-save>${esc(t('목표 저장·재계산','目標を保存・再計算'))}</button></div><p class="ap-past-guide"><strong>${esc(t('현재 예상점수','現在予想得点'))}:</strong> ${esc(expectedText)} · <strong>${esc(t('보수적 예상점수','保守的予想得点'))}:</strong> ${esc(conservativeText)} · <strong>${esc(t('합격선','合格ライン'))}:</strong> ${PASS_SCORE}/100 · <strong>${esc(t('개인 목표','個人目標'))}:</strong> ${goal}/100</p><p class="ap-mock-note">${esc(statusNote)}</p><p class="ap-mock-note"><strong>${esc(t('현재 예상 선택조합','現在の予想選択構成'))}:</strong> ${esc(selectedText)}</p>${model.ready ? `<p class="ap-mock-note">${esc(t(`합격선까지 ${passGap.toFixed(1)}점 · 개인 목표까지 ${goalGap.toFixed(1)}점 필요`,`合格ラインまで${passGap.toFixed(1)}点・個人目標まで${goalGap.toFixed(1)}点必要`))}</p>` : ''}<h3>${esc(t('목표점수 도달 배점 계획','目標点到達の配点計画'))}</h3><div class="ap-mock-table-wrap"><table class="ap-mock-table"><thead><tr><th>${esc(t('분야','分野'))}</th><th>${esc(t('현재 예상','現在予想'))}</th><th>${esc(t('목표 배점','目標配点'))}</th><th>${esc(t('필요 상승','必要上昇'))}</th></tr></thead><tbody>${planRows}</tbody></table></div><div class="ap-past-actions"><a class="ap-mock-button" href="${esc(focusLink)}">${esc(model.ready ? t('현재 선택조합으로 목표점수 보강','現在の選択構成で目標点を補強') : t('부족한 분야 측정하러 가기','不足分野を測定する'))}</a></div><p class="ap-mock-note">${esc(t('예상점수는 각 분야 최근 최대 4회에 최근 기록을 더 크게 반영한 가중평균입니다. 보수적 예상은 표본 수와 최근 점수 변동폭만큼 감점해 계산합니다. 실제 시험 점수를 보장하는 값이 아니라 학습용 추정치입니다. D1은 사용하지 않습니다.','予想得点は各分野の直近最大4回について、新しい記録をより重くした加重平均です。保守的予想はサンプル数と直近得点のばらつき分を差し引いて計算します。実試験の得点を保証する値ではなく、学習用の推定値です。D1は使用しません。'))}</p></section>`;
    el.querySelector('[data-b-goal-save]')?.addEventListener('click',()=>{ const input=el.querySelector('[data-b-goal-input]'); saveGoal(input?.value); render(); });
  }
  function schedule() { setTimeout(render,0); }
  document.addEventListener('click',(event)=>{ if (event.target.closest?.('[data-ap-mock-subject]')) schedule(); });
  window.addEventListener('popstate', schedule);
  window.addEventListener('storage',(event)=>{ if ([PERFORMANCE_KEY,GOAL_KEY].includes(event.key)) schedule(); });
  window.addEventListener(CHANGE_EVENT, schedule);
  const observer = new MutationObserver(()=>{ if (!document.getElementById('ap-b-learning-history')) return; observer.disconnect(); schedule(); });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  schedule();
})();
