(() => {
  const body = document.body;
  const lang = body?.dataset?.blogLanguage === 'ko' ? 'ko' : 'ja';
  const t = (ko, ja) => lang === 'ko' ? ko : ja;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const sessions = ['2025-autumn','2025-spring','2024-autumn','2024-spring','2023-autumn'];
  const fields = [
    ['SECURITY',1,'정보보안','情報セキュリティ'],
    ['STRATEGY',2,'경영전략','経営戦略'],
    ['PROGRAMMING',3,'프로그래밍','プログラミング'],
    ['ARCHITECTURE',4,'시스템 아키텍처','システムアーキテクチャ'],
    ['NETWORK',5,'네트워크','ネットワーク'],
    ['DATABASE',6,'데이터베이스','データベース'],
    ['EMBEDDED',7,'임베디드 시스템','組込みシステム'],
    ['SYSTEM_DEV',8,'시스템 개발','システム開発'],
    ['PROJECT_MGMT',9,'프로젝트 관리','プロジェクトマネジメント'],
    ['SERVICE_MGMT',10,'서비스 관리','サービスマネジメント'],
    ['AUDIT',11,'시스템 감사','システム監査'],
  ];
  let loaded = null;

  async function fetchJson(url) {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    return res.json();
  }
  function avg(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }
  function countBy(values) {
    const out = {};
    for (const value of values) {
      const key = String(value ?? '').trim();
      if (!key) continue;
      out[key] = (out[key] || 0) + 1;
    }
    return out;
  }
  function topEntries(map, limit) {
    return Object.entries(map).sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
  }
  function subjectFromUrl() {
    return new URLSearchParams(location.search).get('subject') === 'B' ? 'B' : 'A';
  }
  function section() {
    let el = document.getElementById('ap-mock-past-analysis-b');
    if (el) return el;
    const past = document.querySelector('.ap-past-section');
    if (!past?.parentElement) return null;
    el = document.createElement('section');
    el.id = 'ap-mock-past-analysis-b';
    el.className = 'ap-mock-section';
    el.hidden = true;
    past.parentElement.insertBefore(el, past);
    return el;
  }
  function setSubjectVisibility(subject) {
    const b = section();
    if (b) b.hidden = subject !== 'B';
    const a = document.getElementById('ap-mock-past-analysis');
    if (a && subject === 'B') a.hidden = true;
    const reinforcement = document.getElementById('ap-reinforcement-entry');
    if (reinforcement) reinforcement.hidden = subject === 'B';
  }
  async function load() {
    if (loaded) return loaded;
    loaded = Promise.all([
      ...sessions.map((session) => fetchJson(`/assets/data/ap-past-study/${session}-B.json`)),
      fetchJson('https://raw.githubusercontent.com/ssom94/song-project/main/data/ap/mock-exams/manifest.json'),
    ]).then((parts) => {
      const actualParts = parts.slice(0, sessions.length);
      const manifest = parts[parts.length - 1];
      const actual = actualParts.flatMap((data, sessionIndex) => (data.questions || []).map((q) => ({ ...q, sessionKey: sessions[sessionIndex] })));
      const mockRounds = (manifest.rounds || []).filter((round) => round.subject === 'B' && round.examNo >= 1 && round.examNo <= 7);
      if (actual.length !== 55 || mockRounds.length !== 7) throw new Error(`QUESTION_COUNT_${actual.length}_ROUNDS_${mockRounds.length}`);
      return { actual, mockRounds };
    });
    return loaded;
  }
  function fieldRows(actual, mockRounds) {
    const optional = [];
    const html = fields.map(([code,no,ko,ja]) => {
      const rows = actual.filter((q) => Number(q.questionNo) === no);
      const difficulties = rows.map((q) => Number(q.difficulty)).filter(Number.isFinite);
      const difficulty = avg(difficulties);
      if (no !== 1) optional.push({ code, no, ko, ja, difficulty });
      const themes = rows.map((q) => t(q.themeKo, q.themeJa)).filter(Boolean);
      return `<tr><td><strong>Q${no}</strong> · ${esc(t(ko,ja))}${no === 1 ? ` <span class="ap-mock-status is-completed">${esc(t('필수','必須'))}</span>` : ''}</td><td>5 / 5</td><td>${mockRounds.length} / 7</td><td>${difficulty.toFixed(2)}</td><td>${esc(themes.join(' · '))}</td></tr>`;
    }).join('');
    optional.sort((a,b) => a.difficulty - b.difficulty || a.no - b.no);
    return { html, optional };
  }
  function selectionHtml(optional) {
    const first = optional.slice(0,4);
    const middle = optional.slice(4,7);
    const hard = optional.slice(7);
    const format = (rows) => rows.map((x) => `Q${x.no} ${t(x.ko,x.ja)} (${x.difficulty.toFixed(2)})`).join(' · ');
    return `<div class="ap-mock-table-wrap"><table class="ap-mock-table"><thead><tr><th>${esc(t('권장 단계','推奨段階'))}</th><th>${esc(t('5회 평균 난이도 기준','5回平均難易度基準'))}</th></tr></thead><tbody><tr><td><strong>${esc(t('우선 연습 후보 4개','優先練習候補4分野'))}</strong></td><td>${esc(format(first))}</td></tr><tr><td>${esc(t('차순위 후보','次候補'))}</td><td>${esc(format(middle))}</td></tr><tr><td>${esc(t('고난도 대비','高難度対策'))}</td><td>${esc(format(hard))}</td></tr></tbody></table></div>`;
  }
  function recurringHtml(actual) {
    const patterns = topEntries(countBy(actual.flatMap((q) => q.patterns || []).filter((x) => !['written','scenario'].includes(String(x)))), 12);
    const keywords = topEntries(countBy(actual.flatMap((q) => q.keywords || [])), 14);
    const patternText = patterns.map(([name,count]) => `${name} × ${count}`).join(' · ');
    const keywordText = keywords.map(([name,count]) => `${name} × ${count}`).join(' · ');
    return `<p class="ap-past-guide"><strong>${esc(t('반복 패턴','反復パターン'))}</strong><br>${esc(patternText || '-')}</p><p class="ap-past-guide"><strong>${esc(t('고빈도 핵심어','高頻度キーワード'))}</strong><br>${esc(keywordText || '-')}</p>`;
  }
  function calibrationHtml(actual, optional) {
    const hardFields = optional.filter((x) => x.difficulty >= 3).slice().sort((a,b) => b.difficulty - a.difficulty);
    const hardText = hardFields.length ? hardFields.map((x) => `Q${x.no} ${t(x.ko,x.ja)} ${x.difficulty.toFixed(2)}`).join(' · ') : t('뚜렷한 고난도 편중 없음','顕著な高難度偏重なし');
    const patternCounts = topEntries(countBy(actual.flatMap((q) => q.patterns || []).filter((x) => !['written','scenario'].includes(String(x)))), 6);
    const patternText = patternCounts.map(([name,count]) => `${name}(${count})`).join(', ');
    const rows = [
      t('Q1 정보보안은 필수이므로 7회 모의고사 모두에서 사고분석·인증·암호·웹/메일 보안을 순환시켜 유지한다.', 'Q1情報セキュリティは必須なので、7回の模擬試験すべてで事故分析・認証・暗号・Web/メールを循環させて維持する。'),
      t(`평균 난이도 3.00 이상 선택분야는 별도 보정문제 우선 대상: ${hardText}`, `平均難易度3.00以上の選択分野を補正問題の優先対象にする: ${hardText}`),
      t(`5회에서 반복된 패턴을 다음 B 보정세트에 우선 반영: ${patternText}`, `5回で反復したパターンを次の科目B補正セットへ優先反映: ${patternText}`),
      t('모의고사 구조는 이미 매회 11분야 1문제씩이라 분야 수는 실제 시험과 일치한다. 다음 보정은 분야 비율이 아니라 문항 내부의 서술·도표·코드·계산·원인분석 깊이를 맞추는 데 집중한다.', '模擬試験は各回11分野1問ずつで構成比は実試験と一致している。次の補正は分野比率ではなく、記述・図表・コード・計算・原因分析の深さを合わせる。'),
    ];
    return `<ul class="ap-past-guide">${rows.map((row) => `<li>${esc(row)}</li>`).join('')}</ul>`;
  }
  async function render() {
    const el = section();
    if (!el) return;
    const subject = subjectFromUrl();
    setSubjectVisibility(subject);
    if (subject !== 'B') return;
    el.hidden = false;
    el.innerHTML = `<div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">SUBJECT B · 5 OFFICIAL SESSIONS</p><h2>${esc(t('科目B 실제 기출 5회 · 55문항 통합 분석','科目B 過去問5回・55問統合分析'))}</h2></div><p>${esc(t('모의고사 1~7회 · 77문항 구조 비교','模擬試験1〜7回・77問構成比較'))}</p></div><section class="ap-mock-card"><p class="ap-mock-note">${esc(t('분석 데이터를 불러오는 중...', '分析データを読み込み中...'))}</p></section>`;
    try {
      const { actual, mockRounds } = await load();
      const { html: rows, optional } = fieldRows(actual, mockRounds);
      el.innerHTML = `<div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">SUBJECT B · 5 OFFICIAL SESSIONS</p><h2>${esc(t('科目B 실제 기출 5회 · 55문항 통합 분석','科目B 過去問5回・55問統合分析'))}</h2></div><p>${esc(t('실제 55문항 vs 모의 77문항','実際55問 vs 模擬77問'))}</p></div><section class="ap-mock-card"><p class="ap-past-guide">${esc(t('2023 가을~2025 가을 실제 科目B를 11개 분야별로 묶어 난이도와 반복 테마를 확인하고, 모의고사 1~7회의 분야 커버리지와 다음 보정 방향을 함께 보여줍니다. Q1 정보보안은 필수이고 Q2~Q11에서 4문제를 선택한다는 실제 시험 구조를 기준으로 합니다.','2023年秋期〜2025年秋期の科目Bを11分野別に集計し、難易度・反復テーマ、模擬試験1〜7回の分野カバレッジ、次の補正方針をまとめます。Q1情報セキュリティ必須、Q2〜Q11から4問選択という実試験構成を基準にしています。'))}</p><h3>${esc(t('분야별 5회 출제와 난이도','分野別5回出題と難易度'))}</h3><div class="ap-mock-table-wrap"><table class="ap-mock-table"><thead><tr><th>${esc(t('분야','分野'))}</th><th>${esc(t('실제 출제','実際出題'))}</th><th>${esc(t('모의 커버','模擬カバー'))}</th><th>${esc(t('실제 평균 난이도','実際平均難易度'))}</th><th>${esc(t('5회 테마','5回テーマ'))}</th></tr></thead><tbody>${rows}</tbody></table></div><h3>${esc(t('선택분야 연습 우선순위','選択分野の練習優先度'))}</h3><p class="ap-mock-note">${esc(t('아래 순위는 companion 난이도의 5회 평균만 사용한 학습용 기준이다. 실제 시험에서는 본인이 익숙한 분야와 당일 문제를 보고 최종 4개를 선택한다.','以下はcompanion難易度の5回平均だけを使った学習用目安です。本番では得意分野と当日の問題を見て最終4問を選びます。'))}</p>${selectionHtml(optional)}<h3>${esc(t('반복 출제 개념','反復出題概念'))}</h3>${recurringHtml(actual)}<h3>${esc(t('모의고사·보정문제 반영 기준','模擬試験・補正問題への反映基準'))}</h3>${calibrationHtml(actual, optional)}<p class="ap-mock-note">${esc(t('실제 문제 원문은 복제하지 않으며, 분야·테마·난이도·키워드는 사이트의 IPA 기출 companion 학습 데이터에서 집계합니다.','実際の問題本文は複製せず、分野・テーマ・難易度・キーワードはサイト内のIPA過去問companion学習データから集計しています。'))}</p></section>`;
    } catch (error) {
      console.error('AP_B_FIVE_SESSION_ANALYSIS_FAILED', error);
      el.innerHTML = `<div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">SUBJECT B ANALYSIS</p><h2>${esc(t('科目B 통합 분석','科目B統合分析'))}</h2></div></div><section class="ap-mock-card"><p class="ap-mock-error">${esc(t('분석 데이터를 불러오지 못했습니다.','分析データを読み込めませんでした。'))} (${esc(error.message)})</p></section>`;
    }
  }
  document.addEventListener('click', (event) => {
    const tab = event.target.closest?.('[data-ap-mock-subject]');
    if (!tab) return;
    const subject = tab.dataset.apMockSubject === 'B' ? 'B' : 'A';
    setTimeout(() => {
      setSubjectVisibility(subject);
      if (subject === 'B') render();
      if (subject === 'A') {
        const a = document.getElementById('ap-mock-past-analysis');
        if (a) a.hidden = false;
      }
    }, 0);
  });
  setTimeout(render, 0);
})();
