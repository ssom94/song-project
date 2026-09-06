(() => {
  const body = document.body;
  const lang = body?.dataset?.blogLanguage === 'ko' ? 'ko' : 'ja';
  const t = (ko, ja) => lang === 'ko' ? ko : ja;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sessions = ['2025-autumn','2025-spring','2024-autumn','2024-spring','2023-autumn'];
  const MOCK_DATA_BASE = 'https://raw.githubusercontent.com/ssom94/song-project/main/data/ap/mock-exams/';
  const avg = (rows) => rows.length ? rows.reduce((a,b) => a + b, 0) / rows.length : 0;
  const pct = (value) => `${(value * 100).toFixed(1)}%`;
  async function fetchJson(url) {
    const res = await fetch(url, String(url).startsWith('http') ? {} : {credentials:'same-origin'});
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    return res.json();
  }
  function countBy(rows, getter) {
    const out = {};
    for (const row of rows) {
      const key = getter(row);
      if (key == null || key === '') continue;
      out[key] = (out[key] || 0) + 1;
    }
    return out;
  }
  function patternRatio(rows, names) {
    const wanted = new Set(names);
    return rows.length ? rows.filter((q) => (q.patterns || []).some((p) => wanted.has(String(p)))).length / rows.length : 0;
  }
  function mockText(q) {
    return JSON.stringify({promptJa:q.promptJa,promptKo:q.promptKo,optionsJa:q.optionsJa,optionsKo:q.optionsKo,content:q.content}).toLowerCase();
  }
  function mockProfile(rows) {
    const sections = countBy(rows, (q) => q.sectionCode);
    const texts = rows.map(mockText);
    const difficulties = rows.map((q) => Number(q.difficulty)).filter(Number.isFinite);
    return {
      count: rows.length,
      sections,
      difficulty: avg(difficulties),
      calculation: rows.length ? texts.filter((x) => /\d/.test(x) && /[%％=＋+－\-*×÷/]|確率|計算|平均|時間|率|容量|秒|ns|mhz|ghz/.test(x)).length / rows.length : 0,
      diagram: rows.length ? texts.filter((x) => /図|表|グラフ|タイミングチャート|diagram|figure|matrix|datatable/.test(x)).length / rows.length : 0,
      code: rows.length ? texts.filter((x) => /select|insert|update|delete|for|while|if|else|class|function|sql|pseudocode|program/.test(x)).length / rows.length : 0,
      security: rows.length ? texts.filter((x) => /セキュリ|暗号|攻撃|認証|脆弱|証明書|forensic|access control|dkim|psirt|cspm/.test(x)).length / rows.length : 0,
      scenario: rows.length ? texts.filter((x) => x.length >= 180 || /ある会社|プロジェクト|システム|サービス|契約|監査/.test(x)).length / rows.length : 0,
    };
  }
  function actualProfile(rows) {
    const sections = countBy(rows, (q) => q.sectionCode);
    const difficulties = rows.map((q) => Number(q.difficulty)).filter(Number.isFinite);
    return {
      count: rows.length,
      sections,
      difficulty: avg(difficulties),
      calculation: patternRatio(rows, ['calculation']),
      diagram: patternRatio(rows, ['diagram']),
      code: patternRatio(rows, ['programming','sql','algorithm']),
      security: patternRatio(rows, ['security','pki','attack','forensics','email']),
      scenario: patternRatio(rows, ['scenario','simulation']),
    };
  }
  function recommendation(actual, mock) {
    const rows = [];
    const metrics = [
      ['calculation', t('계산형', '計算型')],
      ['diagram', t('도표형', '図表型')],
      ['code', t('코드·SQL·알고리즘형', 'コード・SQL・アルゴリズム型')],
      ['security', t('보안형', 'セキュリティ型')],
      ['scenario', t('장문 시나리오형', '長文シナリオ型')],
    ];
    for (const [key,label] of metrics) {
      const gap = actual[key] - mock[key];
      if (gap >= 0.05) rows.push(t(`${label}이 실제 기출보다 ${(gap*100).toFixed(1)}%p 부족`, `${label}が実際の過去問より${(gap*100).toFixed(1)}pt不足`));
      if (gap <= -0.12) rows.push(t(`${label}이 실제 기출보다 ${(-gap*100).toFixed(1)}%p 과다`, `${label}が実際の過去問より${(-gap*100).toFixed(1)}pt過多`));
    }
    const diffGap = actual.difficulty - mock.difficulty;
    if (diffGap >= 0.25) rows.push(t(`전체 난이도를 약 ${diffGap.toFixed(2)} 올릴 필요`, `全体難易度を約${diffGap.toFixed(2)}上げる必要`));
    if (!rows.length) rows.push(t('핵심 비율은 실제 기출 범위에 대체로 근접', '主要比率は実際の過去問に概ね近い'));
    return rows;
  }
  async function boot() {
    if (new URLSearchParams(location.search).get('subject') === 'B') return;
    try {
      const manifest = await fetchJson(`${MOCK_DATA_BASE}manifest.json`);
      const rounds = (manifest.rounds || []).filter((r) => r.subject === 'A' && r.examNo >= 1 && r.examNo <= 7);
      const mockFiles = rounds.flatMap((r) => (r.files || []).map((file) => `${MOCK_DATA_BASE}${file}`));
      const [...all] = await Promise.all([
        ...sessions.map((s) => fetchJson(`/assets/data/ap-past-study/${s}-A.json`)),
        ...mockFiles.map(fetchJson),
      ]);
      const actualParts = all.slice(0, sessions.length);
      const mockParts = all.slice(sessions.length);
      const actualQuestions = actualParts.flatMap((d) => Array.isArray(d.questions) ? d.questions : []);
      const mockQuestions = mockParts.flatMap((d) => Array.isArray(d.questions) ? d.questions : []);
      if (actualQuestions.length !== 400 || mockQuestions.length !== 560) throw new Error(`QUESTION_COUNT_${actualQuestions.length}_${mockQuestions.length}`);
      const actual = actualProfile(actualQuestions);
      const mock = mockProfile(mockQuestions);
      let section = document.getElementById('ap-mock-past-analysis');
      if (!section) {
        const past = document.querySelector('.ap-past-section');
        if (!past?.parentElement) return;
        section = document.createElement('section');
        section.id = 'ap-mock-past-analysis';
        section.className = 'ap-mock-section';
        past.parentElement.insertBefore(section, past);
      }
      const sectionRows = ['T','M','S'].map((code) => {
        const a = actual.sections[code] || 0;
        const m = (mock.sections[code] || 0) / 7;
        return `<tr><td><strong>${code}</strong></td><td>${a} / 400 (${pct(a/400)})</td><td>${m.toFixed(1)} / 80 (${pct((mock.sections[code]||0)/560)})</td><td>${((mock.sections[code]||0)/560*100 - a/400*100).toFixed(1)}%p</td></tr>`;
      }).join('');
      const metrics = [
        ['calculation', t('계산형','計算型')],['diagram',t('도표형','図表型')],['code',t('코드·SQL·알고리즘형','コード・SQL・アルゴリズム型')],['security',t('보안형','セキュリティ型')],['scenario',t('장문 시나리오형','長文シナリオ型')]
      ];
      const metricRows = metrics.map(([key,label]) => `<tr><td>${esc(label)}</td><td>${pct(actual[key])}</td><td>${pct(mock[key])}</td><td>${((mock[key]-actual[key])*100).toFixed(1)}%p</td></tr>`).join('');
      const recs = recommendation(actual, mock).map((x) => `<li>${esc(x)}</li>`).join('');
      section.hidden = false;
      section.innerHTML = `<div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">MOCK vs 5 OFFICIAL SESSIONS</p><h2>${esc(t('실제 기출 5회 · 400문항 통합 비교','実際の過去問5回・400問統合比較'))}</h2></div><p>${esc(t('모의고사 1~7회 · 560문항','模擬試験1〜7回・560問'))}</p></div><section class="ap-mock-card"><p class="ap-past-guide">${esc(t('2023 가을부터 2025 가을까지 科目A 5회 전체를 하나의 기준으로 합쳐 모의고사 1~7회의 영역·난이도·유형 비율을 비교합니다.','2023年秋期から2025年秋期までの科目A 5回分を統合し、模擬試験1〜7回の分野・難易度・出題タイプ比率を比較します。'))}</p><h3>${esc(t('영역 분포','分野分布'))}</h3><div class="ap-mock-table-wrap"><table class="ap-mock-table"><thead><tr><th>${esc(t('영역','分野'))}</th><th>${esc(t('실제 5회 합계','実際5回合計'))}</th><th>${esc(t('모의고사 회당 평균','模擬試験1回平均'))}</th><th>${esc(t('모의-실제 비율차','模擬-実際の差'))}</th></tr></thead><tbody>${sectionRows}</tbody></table></div><h3>${esc(t('난이도·유형','難易度・出題タイプ'))}</h3><p class="ap-mock-note">${esc(t(`평균 난이도: 실제 ${actual.difficulty.toFixed(2)} / 모의 ${mock.difficulty.toFixed(2)}`, `平均難易度: 実際 ${actual.difficulty.toFixed(2)} / 模擬 ${mock.difficulty.toFixed(2)}`))}</p><div class="ap-mock-table-wrap"><table class="ap-mock-table"><thead><tr><th>${esc(t('유형','タイプ'))}</th><th>${esc(t('실제 5회','実際5回'))}</th><th>${esc(t('모의 1~7회','模擬1〜7回'))}</th><th>${esc(t('차이','差'))}</th></tr></thead><tbody>${metricRows}</tbody></table></div><h3>${esc(t('자동 보정 포인트','自動補正ポイント'))}</h3><ul class="ap-past-guide">${recs}</ul><p class="ap-mock-note">${esc(t('실제 기출의 유형 비율은 companion의 태그를 사용한 학습용 분석이며, 일본어 원문 길이 비교와는 별개입니다.','実際の過去問のタイプ比率はcompanionタグを利用した学習用分析で、日本語原文の文章長比較とは別です。'))}</p></section>`;
    } catch (error) {
      console.error('AP_FIVE_SESSION_ANALYSIS_FAILED', error);
    }
  }
  setTimeout(boot, 0);
})();
