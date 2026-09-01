(() => {
	const LIST_IDS = ['jlpt-review-words', 'jlpt-new-words'];
	const savedPages = new Map();
	const calendarStatus = new Map();
	let initialized = false;
	let calendarMonth = '';

	function isJa() { return document.body?.dataset?.blogLanguage === 'ja'; }
	function t(ko, ja) { return isJa() ? ja : ko; }
	function jstToday() {
		return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
	}

	function injectStyle() {
		if (document.getElementById('jlpt-word-pagination-fix-style')) return;
		const style = document.createElement('style');
		style.id = 'jlpt-word-pagination-fix-style';
		style.textContent = `
			#jlpt-study-detail .jlpt-section-body.is-scrollable,
			#jlpt-study-detail .jlpt-word-section,
			#jlpt-study-detail .jlpt-word-list{max-height:none!important;height:auto!important;overflow:visible!important;overflow-y:visible!important;overflow-x:visible!important;scrollbar-gutter:auto!important}
			#jlpt-study-detail .jlpt-section-body.is-scrollable{padding-right:0!important}
			.jlpt-calendar-month-nav{display:flex;align-items:center;justify-content:center;gap:10px;margin:0 0 14px}
			.jlpt-calendar-month-nav button{width:40px;height:38px;border:1px solid #d4dce5;border-radius:9px;background:#fff;font:inherit;font-weight:900;cursor:pointer}
			.jlpt-calendar-month-nav strong{min-width:120px;text-align:center;font-size:15px;color:#26364e}
			.jlpt-calendar-empty{min-height:70px}
			.jlpt-calendar-day[data-full-date]{cursor:pointer}
			@media(max-width:640px){.jlpt-calendar-empty{min-height:58px}}
		`;
		document.head.appendChild(style);
	}

	function pageOf(id) {
		const list = document.getElementById(id);
		const value = Number(list?.dataset.page || savedPages.get(id) || 1);
		return Number.isFinite(value) && value > 0 ? value : 1;
	}
	function rememberAllPages() { for (const id of LIST_IDS) savedPages.set(id, pageOf(id)); }
	function restorePage(id) {
		const list = document.getElementById(id);
		if (!(list instanceof HTMLElement)) return;
		const wanted = Math.max(1, Number(savedPages.get(id) || list.dataset.page || 1));
		list.dataset.page = String(wanted);
		queueMicrotask(() => {
			const current = document.getElementById(id);
			if (!(current instanceof HTMLElement)) return;
			current.dataset.page = String(wanted);
			const pager = current.nextElementSibling;
			if (!(pager instanceof HTMLElement) || !pager.classList.contains('jlpt-pager')) return;
			const target = [...pager.querySelectorAll('button')].find((button) => button.textContent?.trim() === String(wanted));
			if (target instanceof HTMLButtonElement && !target.classList.contains('is-active')) target.click();
		});
	}
	function watchList(id) {
		const list = document.getElementById(id);
		if (!(list instanceof HTMLElement) || list.dataset.pageFixObserved === 'true') return;
		list.dataset.pageFixObserved = 'true';
		savedPages.set(id, pageOf(id));
		new MutationObserver((mutations) => {
			if (!mutations.some((mutation) => mutation.type === 'childList')) return;
			const wanted = savedPages.get(id) || 1;
			queueMicrotask(() => {
				const current = document.getElementById(id);
				if (!(current instanceof HTMLElement)) return;
				current.dataset.page = String(wanted);
				window.setTimeout(() => restorePage(id), 0);
			});
		}).observe(list, { childList: true });
	}
	function capturePageIntent(event) {
		const target = event.target instanceof Element ? event.target : null;
		if (!target) return;
		if (target.closest('.jlpt-state-button')) { rememberAllPages(); return; }
		const pagerButton = target.closest('.jlpt-pager button');
		if (!(pagerButton instanceof HTMLButtonElement)) return;
		const list = pagerButton.closest('.jlpt-pager')?.previousElementSibling;
		if (!(list instanceof HTMLElement) || !LIST_IDS.includes(list.id)) return;
		const label = pagerButton.textContent?.trim() || '';
		const current = pageOf(list.id);
		let next = current;
		if (/^\d+$/.test(label)) next = Number(label);
		else if (label === '‹') next = Math.max(1, current - 1);
		else if (label === '›') next = current + 1;
		savedPages.set(list.id, next);
	}

	function inferFullDate(mmdd) {
		if (!/^\d{2}\/\d{2}$/.test(mmdd || '')) return '';
		const [m, d] = mmdd.split('/').map(Number);
		const today = jstToday();
		let year = Number(today.slice(0, 4));
		const tm = Number(today.slice(5, 7));
		if (tm === 1 && m === 12) year -= 1;
		if (tm === 12 && m === 1) year += 1;
		return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
	}
	function harvestCalendarStatus() {
		const cal = document.getElementById('jlpt-calendar');
		if (!(cal instanceof HTMLElement)) return;
		for (const cell of cal.querySelectorAll('.jlpt-calendar-day')) {
			const full = cell.dataset.fullDate || inferFullDate(cell.querySelector('strong')?.textContent?.trim() || '');
			if (!full) continue;
			calendarStatus.set(full, { status: cell.dataset.status || 'not_started', text: cell.querySelector('span')?.textContent || '—' });
		}
	}
	function shiftMonth(month, delta) {
		const [y, m] = month.split('-').map(Number);
		const date = new Date(Date.UTC(y, m - 1 + delta, 1));
		return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
	}
	function selectedFromInput() { return document.getElementById('jlpt-study-date')?.value || jstToday(); }
	function renderMonth() {
		const cal = document.getElementById('jlpt-calendar');
		if (!(cal instanceof HTMLElement) || !calendarMonth) return;
		const [year, month] = calendarMonth.split('-').map(Number);
		const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
		const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
		const selected = selectedFromInput();
		cal.replaceChildren();
		for (let i = 0; i < firstWeekday; i += 1) {
			const blank = document.createElement('div'); blank.className = 'jlpt-calendar-empty'; blank.setAttribute('aria-hidden', 'true'); cal.appendChild(blank);
		}
		for (let day = 1; day <= days; day += 1) {
			const date = `${calendarMonth}-${String(day).padStart(2, '0')}`;
			const status = calendarStatus.get(date);
			const cell = document.createElement('div');
			cell.className = 'jlpt-calendar-day';
			cell.dataset.fullDate = date;
			cell.dataset.status = status?.status || 'not_started';
			cell.classList.toggle('is-selected', date === selected);
			const strong = document.createElement('strong'); strong.textContent = `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
			const state = document.createElement('span'); state.textContent = status?.text || '—';
			cell.append(strong, state); cal.appendChild(cell);
		}
		const label = document.getElementById('jlpt-calendar-month-label');
		if (label) label.textContent = isJa() ? `${year}年 ${month}月` : `${year}년 ${month}월`;
	}
	function mountMonthNav() {
		const cal = document.getElementById('jlpt-calendar');
		const card = cal?.closest('.jlpt-card');
		if (!(cal instanceof HTMLElement) || !(card instanceof HTMLElement) || document.getElementById('jlpt-calendar-month-nav')) return;
		harvestCalendarStatus();
		calendarMonth = (selectedFromInput() || jstToday()).slice(0, 7);
		const heading = card.querySelector('.jlpt-card-heading');
		const title = heading?.querySelector('h2');
		const copy = heading?.querySelector('p');
		if (title) title.textContent = t('학습 달력', '学習カレンダー');
		if (copy) copy.textContent = t('이전·다음 달을 이동하고 날짜를 누르면 해당 날짜의 학습을 확인합니다.', '前月・翌月へ移動し、日付を押すとその日の学習を確認できます。');
		const nav = document.createElement('div'); nav.id = 'jlpt-calendar-month-nav'; nav.className = 'jlpt-calendar-month-nav';
		nav.innerHTML = `<button type="button" data-cal-shift="-1" aria-label="${t('이전 달','前月')}">‹</button><strong id="jlpt-calendar-month-label"></strong><button type="button" data-cal-shift="1" aria-label="${t('다음 달','翌月')}">›</button>`;
		cal.before(nav);
		nav.addEventListener('click', (event) => {
			const button = event.target.closest('[data-cal-shift]'); if (!button) return;
			calendarMonth = shiftMonth(calendarMonth, Number(button.dataset.calShift || 0)); renderMonth();
		});
		renderMonth();
	}
	function captureCalendarClick(event) {
		const target = event.target instanceof Element ? event.target.closest('.jlpt-calendar-day[data-full-date]') : null;
		if (!(target instanceof HTMLElement)) return;
		const date = target.dataset.fullDate; if (!date) return;
		const input = document.getElementById('jlpt-study-date');
		if (!(input instanceof HTMLInputElement)) return;
		event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
		input.value = date; input.dispatchEvent(new Event('change', { bubbles: true }));
		document.querySelectorAll('#jlpt-calendar .jlpt-calendar-day').forEach((cell) => cell.classList.toggle('is-selected', cell.dataset.fullDate === date));
	}

	function init() {
		if (initialized) return;
		initialized = true;
		injectStyle();
		document.addEventListener('click', capturePageIntent, true);
		document.addEventListener('click', captureCalendarClick, true);
		LIST_IDS.forEach(watchList);
		const detail = document.getElementById('jlpt-study-detail');
		if (detail instanceof HTMLElement) new MutationObserver(() => LIST_IDS.forEach(watchList)).observe(detail, { childList: true, subtree: true });
		window.setTimeout(mountMonthNav, 120);
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
