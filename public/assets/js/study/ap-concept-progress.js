(() => {
  const STORAGE_KEY = 'song.apConceptTypeProgress.v1';
  const lang = document.body?.dataset?.blogLanguage === 'ja' ? 'ja' : 'ko';
  const t = (ko, ja) => lang === 'ja' ? ja : ko;
  const params = new URLSearchParams(location.search);
  const code = (params.get('code') || params.get('no') || '').trim().toUpperCase();

  function injectStyle() {
    if (document.getElementById('ap-concept-progress-style')) return;
    const style = document.createElement('style');
    style.id = 'ap-concept-progress-style';
    style.textContent = `
      .ap-concept-progress-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0 18px}
      .ap-concept-progress-summary>div{padding:12px 14px;border:1px solid #d9e1ea;border-radius:12px;background:#f8fafc}
      .ap-concept-progress-summary span{display:block;font-size:12px;color:#66758a;font-weight:700}
      .ap-concept-progress-summary strong{display:block;margin-top:5px;font-size:20px;color:#26364e}
      .ap-concept-row-progress{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:11px;font-weight:800;color:#66758a;margin-bottom:7px}
      .ap-concept-row-progress b{color:#26364e}
      .ap-type-study-check{display:flex;align-items:center;gap:8px;margin-left:auto;padding:6px 10px;border-radius:999px;background:#f7f3f4;border:1px solid #dcc9ce;color:#7e3948;font-size:12px;font-weight:800;cursor:pointer}
      .ap-type-study-check input{width:17px;height:17px;accent-color:#7e3948}
      .ap-problem-type-section.is-type-complete{border-color:#a9cfb5;background:#f5fbf7}
      .ap-problem-type-section.is-type-complete .ap-problem-type-label{color:#2f7550}
      .ap-today-concept-progress{margin:14px 0 0;padding:12px;border:1px solid #dde4ec;border-radius:12px;background:#fafbfc}
      .ap-today-concept-progress h3{margin:0 0 9px;font-size:15px}
      .ap-today-concept-progress-list{display:grid;gap:7px}
      .ap-today-concept-progress-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:9px;background:#fff;border:1px solid #e2e7ed;font-size:12px}
      .ap-today-concept-progress-row strong{font-size:12px}
      @media(max-width:640px){.ap-concept-progress-summary{grid-template-columns:1fr}.ap-type-study-check{margin-left:0}.ap-concept-progress-summary strong{font-size:18px}}
    `;
    document.head.appendChild(style);
  }

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch { return {}; }
  }

  function writeState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('ap-concept-progress-change'));
  }

  function isComplete(conceptCode, typeNo) {
    return Boolean(readState()[conceptCode]?.[String(typeNo)]);
  }

  function setComplete(conceptCode, typeNo, completed) {
    const state = readState();
    state[conceptCode] ||= {};
    if (completed) state[conceptCode][String(typeNo)] = true;
    else delete state[conceptCode][String(typeNo)];
    writeState(state);
  }

  function completedCount(conceptCode, total) {
    const values = readState()[conceptCode] || {};
    return Math.min(total, Object.values(values).filter(Boolean).length);
  }

  async function loadConcepts() {
    const response = await fetch('/api/public/ap/concepts', { cache: 'no-store', headers: { Accept: 'application/json' } });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP_${response.status}`);
    return data.concepts || [];
  }

  function addSummary(concepts) {
    const card = document.querySelector('.ap-concept-card');
    if (!card) return;
    let box = document.getElementById('ap-concept-progress-summary');
    if (!box) {
      box = document.createElement('div');
      box.id = 'ap-concept-progress-summary';
      box.className = 'ap-concept-progress-summary';
      const wrap = card.querySelector('.ap-concept-table-wrap');
      card.insertBefore(box, wrap || card.firstChild);
    }
    const totalTypes = concepts.reduce((sum, c) => sum + Number(c.problemTypeCount || 0), 0);
    const doneTypes = concepts.reduce((sum, c) => sum + completedCount(c.code, Number(c.problemTypeCount || 0)), 0);
    const totalConcepts = concepts.filter((c) => Number(c.problemTypeCount || 0) > 0).length;
    const doneConcepts = concepts.filter((c) => {
      const total = Number(c.problemTypeCount || 0);
      return total > 0 && completedCount(c.code, total) >= total;
    }).length;
    box.innerHTML = `<div><span>${t('전체 유형 / 학습 유형','全タイプ / 学習済みタイプ')}</span><strong>${totalTypes} / ${doneTypes}</strong></div><div><span>${t('전체 개념 / 학습완료 개념','全概念 / 学習完了')}</span><strong>${totalConcepts} / ${doneConcepts}</strong></div>`;
  }

  function decorateList(concepts) {
    const rows = [...document.querySelectorAll('#ap-concept-body tr')];
    if (!rows.length) return false;
    const map = new Map(concepts.map((c) => [c.code, c]));
    rows.forEach((tr) => {
      const cells = tr.children;
      const conceptCode = cells[1]?.textContent.trim().toUpperCase();
      const concept = map.get(conceptCode);
      if (!concept || !cells[4]) return;
      const total = Number(concept.problemTypeCount || 0);
      const done = completedCount(conceptCode, total);
      let progress = cells[4].querySelector('.ap-concept-row-progress');
      if (!progress) {
        progress = document.createElement('div');
        progress.className = 'ap-concept-row-progress';
        const actions = cells[4].querySelector('.ap-concept-actions');
        cells[4].insertBefore(progress, actions || cells[4].firstChild);
      }
      progress.innerHTML = `<span>${t('전체유형','全タイプ')}: <b>${total}</b></span><span>${t('학습갯수','学習済み')}: <b>${done}</b></span>`;
    });
    addSummary(concepts);
    return true;
  }

  function decorateProblemTypes() {
    if (!code) return false;
    const sections = [...document.querySelectorAll('.ap-problem-type-section')];
    if (!sections.length) return false;
    sections.forEach((section, index) => {
      if (section.dataset.progressReady === '1') return;
      section.dataset.progressReady = '1';
      const label = section.querySelector('.ap-problem-type-label');
      const match = label?.textContent.match(/(?:番号|번호)\s*(\d+)/);
      const typeNo = Number(match?.[1] || index + 1);
      const check = document.createElement('label');
      check.className = 'ap-type-study-check';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = isComplete(code, typeNo);
      const caption = document.createElement('span');
      caption.textContent = input.checked ? t('학습완료','学習完了') : t('유형 학습완료 체크','タイプ学習完了');
      section.classList.toggle('is-type-complete', input.checked);
      input.addEventListener('change', () => {
        setComplete(code, typeNo, input.checked);
        caption.textContent = input.checked ? t('학습완료','学習完了') : t('유형 학습완료 체크','タイプ学習完了');
        section.classList.toggle('is-type-complete', input.checked);
      });
      check.append(input, caption);
      label?.appendChild(check);
    });
    return true;
  }

  const topicUnits = {
    fundamentals_math: ['기초이론'], computer_architecture: ['컴퓨터구성'], operating_system: ['OS'],
    programming_algorithms: ['알고리즘','프로그래밍'], database: ['데이터베이스'], network: ['네트워크'], security: ['보안','정보보안'],
    system_development: ['개발','시스템개발'], system_performance: ['시스템','시스템구성'], project_management: ['PM'],
    service_management: ['서비스관리'], system_audit: ['감사'], system_strategy: ['전략'], business_strategy: ['전략','전략·경영'], accounting_legal: ['회계','법무']
  };

  async function decorateToday(concepts) {
    const todayItems = document.getElementById('ap-today-items');
    if (!todayItems) return;
    let dashboard;
    try {
      const response = await fetch('/api/public/ap/dashboard', { cache: 'no-store', credentials: 'same-origin' });
      dashboard = await response.json();
    } catch { return; }
    if (!dashboard?.ok || !Array.isArray(dashboard.today?.items) || !dashboard.today.items.length) return;
    const codes = [...new Set(dashboard.today.items.map((item) => item.topic_code).filter(Boolean))];
    if (!codes.length) return;
    let box = document.getElementById('ap-today-concept-progress');
    if (!box) {
      box = document.createElement('section');
      box.id = 'ap-today-concept-progress';
      box.className = 'ap-today-concept-progress';
      todayItems.before(box);
    }
    const rows = [];
    for (const topicCode of codes) {
      const units = topicUnits[topicCode] || [];
      const related = concepts.filter((c) => units.includes(c.unitKo));
      const total = related.reduce((sum, c) => sum + Number(c.problemTypeCount || 0), 0);
      const done = related.reduce((sum, c) => sum + completedCount(c.code, Number(c.problemTypeCount || 0)), 0);
      const item = dashboard.today.items.find((x) => x.topic_code === topicCode);
      const title = lang === 'ja' ? item?.topic_title_ja : item?.topic_title_ko;
      if (total > 0) rows.push(`<div class="ap-today-concept-progress-row"><span>${String(title || topicCode)}</span><strong>${t('문제유형','問題タイプ')} ${total} / ${t('학습완료','学習完了')} ${done}</strong></div>`);
    }
    if (!rows.length) { box.remove(); return; }
    box.innerHTML = `<h3>${t('오늘의 개념별 진척상황','今日の概念別進捗')}</h3><div class="ap-today-concept-progress-list">${rows.join('')}</div>`;
  }

  async function refresh() {
    injectStyle();
    let concepts = [];
    try { concepts = await loadConcepts(); } catch (error) { console.error('Failed to load AP concept progress metadata', error); }
    if (concepts.length) {
      decorateList(concepts);
      decorateToday(concepts);
    }
    decorateProblemTypes();
  }

  function init() {
    refresh();
    const root = document.querySelector('.ap-study-content') || document.body;
    let timer = 0;
    new MutationObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (code) decorateProblemTypes();
      }, 60);
    }).observe(root, { childList: true, subtree: true });
    window.addEventListener('ap-concept-progress-change', refresh);
    window.addEventListener('storage', (event) => { if (event.key === STORAGE_KEY) refresh(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
