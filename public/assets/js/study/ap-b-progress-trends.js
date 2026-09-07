(() => {
  const body = document.body;
  const lang = body?.dataset?.blogLanguage === 'ko' ? 'ko' : 'ja';
  const t = (ko, ja) => lang === 'ko' ? ko : ja;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PERFORMANCE_KEY = 'song:ap:b-reinforcement-performance:v1';
  const fields = [
    [2, '경영전략', '経営戦略'], [3, '프로그래밍', 'プログラミング'], [4, '시스템 아키텍처', 'システムアーキテクチャ'], [5, '네트워크', 'ネットワーク'], [6, '데이터베이스', 'データベース'], [7, '임베디드 시스템', '組込みシステム'], [8, '시스템 개발', 'システム開発'], [9, '프로젝트 관리', 'プロジェクトマネジメント'], [10, '서비스 관리', 'サービスマネジメント'], [11, '시스템 감사', 'システム監査']
  ];

  function subjectFromUrl() {
    return new URLSearchParams(location.search).get('subject') === 'B' ? 'B' : 'A';
  }
  function readPerformance() {
    try {
      const data = JSON.parse(localStorage.getItem(PERFORMANCE_KEY) || '{}');
      return Array.isArray(data?.attempts) ? data.attempts : [];
    } catch {
      return [];
    }
  }
  function avg(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }
  function seriesByField(attempts) {
    const out = {};
    for (const [no] of fields) out[no] = [];
    for (const attempt of attempts) {
      const at = typeof attempt?.at === 'string' ? attempt.at : '';
      const scores = attempt?.scores && typeof attempt.scores === 'object' ? attempt.scores : {};
      for (const [key, raw] of Object.entries(scores)) {
        const no = Number(key);
        const score = Number(raw);
        if (!out[no] || !Number.isFinite(score)) continue;
        out[no].push({ at, score: Math.max(0, Math.min(20, score)) });
      }
    }
    return out;
  }
  function trendInfo(points) {
    const scores = points.map((p) => p.score);
    const count = scores.length;
    const overall = count ? avg(scores) : 0;
    const last = count ? scores[count - 1] : null;
    if (count < 2) {
      return { count, overall, last, recent: last ?? 0, previous: null, delta: null, state: 'insufficient', recovery: 'insufficient' };
    }
    const windowSize = Math.min(3, Math.max(1, Math.floor(count / 2)));
    const recentScores = scores.slice(-windowSize);
    const previousScores = scores.slice(-(windowSize * 2), -windowSize);
    const recent = avg(recentScores);
    const previous = previousScores.length ? avg(previousScores) : scores[0];
    const delta = recent - previous;
    let state = 'stable';
    if (delta >= 2) state = 'up';
    else if (delta <= -2) state = 'down';

    let recovery = 'stable';
    if (count < 3) recovery = 'insufficient';
    else if (recent >= 16 && delta >= -1) recovery = 'recovered';
    else if (delta >= 2) recovery = 'improving';
    else if (delta <= -2) recovery = 'declining';
    else if (recent < 14) recovery = 'stalled';
    return { count, overall, last, recent, previous, delta, state, recovery };
  }
  function recoveryLabel(value) {
    return ({
      recovered: t('개선 완료', '改善完了'),
      improving: t('개선 중', '改善中'),
      stalled: t('정체', '停滞'),
      declining: t('하락', '低下'),
      stable: t('유지', '維持'),
      insufficient: t('데이터 부족', 'データ不足'),
    })[value] || value;
  }
  function actionLabel(info) {
    if (info.recovery === 'recovered') return t('유지 연습', '維持練習');
    if (info.recovery === 'declining') return t('즉시 보강', 'すぐ補強');
    if (info.recovery === 'stalled') return t('보강 계속', '補強継続');
    if (info.recovery === 'improving') return t('보강 유지', '補強維持');
    if (info.recovery === 'insufficient') return t('추가 측정', '追加測定');
    return info.recent < 16 ? t('보강 권장', '補強推奨') : t('유지', '維持');
  }
  function priority(info) {
    const deficit = Math.max(0, 16 - Number(info.recent || 0)) * 4;
    const base = ({ declining: 100, stalled: 82, improving: 62, insufficient: 56, stable: 38, recovered: 5 })[info.recovery] ?? 40;
    const sampleBoost = info.count < 3 ? (3 - info.count) * 8 : 0;
    return base + deficit + sampleBoost;
  }
  function sparkline(points) {
    if (!points.length) return `<span class="ap-mock-note">${esc(t('기록 없음', '記録なし'))}</span>`;
    const width = 190;
    const height = 54;
    const padX = 8;
    const padY = 7;
    const usableW = width - padX * 2;
    const usableH = height - padY * 2;
    const coords = points.map((point, index) => {
      const x = points.length === 1 ? width / 2 : padX + usableW * index / (points.length - 1);
      const y = padY + usableH * (1 - point.score / 20);
      return { x, y, score: point.score };
    });
    const polyline = coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const dots = coords.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.6"><title>${p.score}/20</title></circle>`).join('');
    const label = points.map((p) => `${p.score}/20`).join(' → ');
    return `<svg viewBox="0 0 ${width} ${height}" width="190" height="54" role="img" aria-label="${esc(label)}" style="max-width:100%;overflow:visible"><line x1="${padX}" y1="${padY}" x2="${width-padX}" y2="${padY}" stroke="currentColor" opacity="0.12"/><line x1="${padX}" y1="${height-padY}" x2="${width-padX}" y2="${height-padY}" stroke="currentColor" opacity="0.12"/><polyline points="${polyline}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${dots}</svg>`;
  }
  function locate() {
    let el = document.getElementById('ap-b-progress-trends');
    if (el) return el;
    const weakness = document.getElementById('ap-b-weakness-dashboard');
    if (!weakness?.parentElement) return null;
    el = document.createElement('section');
    el.id = 'ap-b-progress-trends';
    el.className = 'ap-mock-section';
    weakness.parentElement.insertBefore(el, weakness.nextSibling);
    return el;
  }
  function summaryText(rows) {
    const counts = { recovered: 0, improving: 0, stalled: 0, declining: 0, insufficient: 0, stable: 0 };
    rows.forEach((row) => { counts[row.info.recovery] = (counts[row.info.recovery] || 0) + 1; });
    return t(
      `개선완료 ${counts.recovered} · 개선중 ${counts.improving} · 정체 ${counts.stalled} · 하락 ${counts.declining} · 데이터부족 ${counts.insufficient}`,
      `改善完了 ${counts.recovered} · 改善中 ${counts.improving} · 停滞 ${counts.stalled} · 低下 ${counts.declining} · データ不足 ${counts.insufficient}`
    );
  }
  async function render() {
    const existing = document.getElementById('ap-b-progress-trends');
    if (subjectFromUrl() !== 'B') {
      if (existing) existing.hidden = true;
      return;
    }
    const el = locate();
    if (!el) return;
    el.hidden = false;
    const attempts = readPerformance();
    const series = seriesByField(attempts);
    const rows = fields.map(([no, ko, ja]) => ({ no, ko, ja, points: series[no], info: trendInfo(series[no]) }));
    const continuation = rows.slice().sort((a, b) => priority(b.info) - priority(a.info) || a.no - b.no).slice(0, 4);
    const focusParam = continuation.map((row) => row.no).join(',');
    const focusText = continuation.map((row) => `Q${row.no} ${t(row.ko, row.ja)}`).join(' · ');
    const tableRows = rows.map((row) => {
      const info = row.info;
      const deltaText = info.delta == null ? '-' : `${info.delta > 0 ? '+' : ''}${info.delta.toFixed(1)}/20`;
      const avgText = info.count ? `${info.overall.toFixed(1)}/20` : '-';
      const recentText = info.count ? `${info.recent.toFixed(1)}/20` : '-';
      return `<tr><td><strong>Q${row.no} ${esc(t(row.ko, row.ja))}</strong></td><td>${sparkline(row.points)}</td><td>${info.count}</td><td>${avgText}</td><td>${recentText}</td><td>${deltaText}</td><td><strong>${esc(recoveryLabel(info.recovery))}</strong></td><td>${esc(actionLabel(info))}</td></tr>`;
    }).join('');
    el.innerHTML = `<div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">SUBJECT B PROGRESS</p><h2>${esc(t('科目B 점수 추이·개선 판정', '科目B 得点推移・改善判定'))}</h2></div><p>${esc(summaryText(rows))}</p></div><section class="ap-mock-card"><p class="ap-past-guide"><strong>${esc(t('지금 계속 보강할 4개', '今継続して補強する4分野'))}:</strong> ${esc(focusText)}</p><p class="ap-mock-note">${esc(t('최근 구간 평균이 이전 구간보다 2점(/20) 이상 오르면 개선, 2점 이상 내려가면 하락으로 봅니다. 3회 이상 기록에서 최근 평균이 16/20 이상이고 하락하지 않으면 개선 완료로 판정합니다. 데이터가 적은 분야는 추가 측정을 우선합니다.', '直近区間の平均が前区間より2点（20点満点）以上上がれば改善、2点以上下がれば低下と判定します。3回以上の記録で直近平均が16/20以上かつ低下していなければ改善完了とします。データが少ない分野は追加測定を優先します。'))}</p><div class="ap-past-actions"><a class="ap-mock-button" href="/${lang}/study/ap/reinforcement/?subject=B&focus=${encodeURIComponent(focusParam)}">${esc(t('계속 보강할 4개로 실전 시작', '継続補強4分野で実戦開始'))}</a></div><div class="ap-mock-table-wrap"><table class="ap-mock-table"><thead><tr><th>${esc(t('분야', '分野'))}</th><th>${esc(t('점수 추이', '得点推移'))}</th><th>${esc(t('횟수', '回数'))}</th><th>${esc(t('전체 평균', '全体平均'))}</th><th>${esc(t('최근 구간', '直近区間'))}</th><th>${esc(t('변화', '変化'))}</th><th>${esc(t('개선 판정', '改善判定'))}</th><th>${esc(t('다음 행동', '次の行動'))}</th></tr></thead><tbody>${tableRows}</tbody></table></div><p class="ap-mock-note">${esc(t('그래프와 판정은 최근 최대 20회의 브라우저 자기채점 기록에서 계산됩니다. D1 조회·저장은 발생하지 않습니다.', 'グラフと判定はブラウザに保存された直近最大20回の自己採点履歴から計算します。D1の読取・保存は行いません。'))}</p></section>`;
  }
  function schedule() {
    setTimeout(() => render().catch((error) => console.error('AP_B_PROGRESS_TRENDS_FAILED', error)), 0);
  }
  document.addEventListener('click', (event) => { if (event.target.closest?.('[data-ap-mock-subject]')) schedule(); });
  window.addEventListener('popstate', schedule);
  window.addEventListener('storage', (event) => { if (event.key === PERFORMANCE_KEY) schedule(); });
  const observer = new MutationObserver(() => {
    if (!document.getElementById('ap-b-weakness-dashboard')) return;
    observer.disconnect();
    schedule();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  schedule();
})();
