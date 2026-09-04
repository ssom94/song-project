(() => {
  const STORAGE_KEY = 'song.apConceptTypeProgress.v1';
  const lang = document.body?.dataset?.blogLanguage === 'ja' ? 'ja' : 'ko';
  const t = (ko, ja) => lang === 'ja' ? ja : ko;
  const params = new URLSearchParams(location.search);
  const code = (params.get('code') || params.get('no') || '').trim().toUpperCase();
  let cachedConcepts = [];
  let conceptsPromise = null;

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
      .ap-today-concept-progress-row strong{font-size:12px;text-align:right}
      @media(max-width:640px){.ap-concept-progress-summary{grid-template-columns:1fr}.ap-type-study-check{margin-left:0}.ap-concept-progress-summary strong{font-size:18px}.ap-today-concept-progress-row{align-items:flex-start;flex-direction:column}.ap-today-concept-progress-row strong{text-align:left}}
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
    if (cachedConcepts.length) return cachedConcepts;
    if (!conceptsPromise) {
      conceptsPromise = fetch('/api/public/ap/concepts', { cache: 'no-store', headers: { Accept: 'application/json' } })
        .then(async (response) => {
          const data = await response.json().catch(() => null);
          if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP_${response.status}`);
          cachedConcepts = data.concepts || [];
          return cachedConcepts;
        });
    }
    return conceptsPromise;
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
    const totalConcepts = concepts.length;
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

  const titleGroups = [
    { keys:['기초이론','基礎理論'], units:['기초이론'] },
    { keys:['컴퓨터 구조','コンピュータ構成','ハードウェア'], units:['컴퓨터구성'] },
    { keys:['OS','プロセス・メモリ'], units:['OS'] },
    { keys:['프로그래밍','알고리즘','プログラミング','アルゴリズム'], units:['알고리즘','프로그래밍'] },
    { keys:['데이터베이스','データベース'], units:['데이터베이스'] },
    { keys:['네트워크','ネットワーク'], units:['네트워크'] },
    { keys:['정보보안','보안','セキュリティ'], units:['보안','정보보안'] },
    { keys:['정보시스템 개발','시스템 개발','システム開発'], units:['개발','시스템개발'] },
    { keys:['시스템 성능','신뢰성','システム性能','信頼性'], units:['시스템','시스템구성'] },
    { keys:['프로젝트','プロジェクト'], units:['PM'] },
    { keys:['서비스','サービス'], units:['서비스관리'] },
    { keys:['감사','監査'], units:['감사'] },
    { keys:['경영전략','마케팅','経営戦略','マーケティング'], units:['전략','전략·경영'] },
    { keys:['시스템 전략','기획','システム戦略','企画'], units:['전략'] },
    { keys:['회계','법무','표준','会計','法務','標準'], units:['회계','법무'] }
  ];

  function todayGroupsFromDom() {
    const cards = [...document.querySelectorAll('#ap-today-items .ap-today-item')];
    const groups = [];
    cards.forEach((card) => {
      const title = card.querySelector('.ap-item-main strong')?.textContent || '';
      const match = titleGroups.find((group) => group.keys.some((key) => title.includes(key)));
      if (!match) return;
      const signature = match.units.join('|');
      if (!groups.some((g) => g.signature === signature)) groups.push({ signature, title, units: match.units });
    });
    return groups;
  }

  function decorateToday(concepts) {
    const todayItems = document.getElementById('ap-today-items');
    if (!todayItems) return;
    const groups = todayGroupsFromDom();
    let box = document.getElementById('ap-today-concept-progress');
    if (!groups.length) {
      box?.remove();
      return;
    }
    if (!box) {
      box = document.createElement('section');
      box.id = 'ap-today-concept-progress';
      box.className = 'ap-today-concept-progress';
      todayItems.before(box);
    }
    const rows = groups.map((group) => {
      const related = concepts.filter((c) => group.units.includes(c.unitKo));
      const total = related.reduce((sum, c) => sum + Number(c.problemTypeCount || 0), 0);
      const done = related.reduce((sum, c) => sum + completedCount(c.code, Number(c.problemTypeCount || 0)), 0);
      return total > 0 ? `<div class="ap-today-concept-progress-row"><span>${group.title}</span><strong>${t('문제유형','問題タイプ')} ${total} / ${t('학습완료','学習完了')} ${done}</strong></div>` : '';
    }).filter(Boolean);
    if (!rows.length) { box.remove(); return; }
    box.innerHTML = `<h3>${t('오늘의 개념별 진척상황','今日の概念別進捗')}</h3><div class="ap-today-concept-progress-list">${rows.join('')}</div>`;
  }

  function renderLocalProgress() {
    if (!cachedConcepts.length) return;
    decorateList(cachedConcepts);
    decorateToday(cachedConcepts);
    decorateProblemTypes();
  }

  async function refresh() {
    injectStyle();
    try { await loadConcepts(); } catch (error) { console.error('Failed to load AP concept progress metadata', error); }
    renderLocalProgress();
  }

  function init() {
    refresh();
    const root = document.querySelector('.ap-study-content') || document.body;
    let timer = 0;
    new MutationObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(renderLocalProgress, 80);
    }).observe(root, { childList: true, subtree: true });
    window.addEventListener('ap-concept-progress-change', renderLocalProgress);
    window.addEventListener('storage', (event) => { if (event.key === STORAGE_KEY) renderLocalProgress(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
