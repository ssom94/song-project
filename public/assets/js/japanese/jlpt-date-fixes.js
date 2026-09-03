(() => {
	const DASHBOARD_API = '/api/public/japanese/jlpt/dashboard';
	const FIX_SCRIPT = '/assets/js/japanese/jlpt-word-pagination-fix.js?v=20260903-2';
	const PREPARED_RANGES = [{ from: '2026-09-07', to: '2027-02-28', questions: 21 }];
	const isJa = document.body.dataset.blogLanguage === 'ja';
	const t = (ko, ja) => isJa ? ja : ko;
	const progressByDate = new Map();
	let calendarMonth = '';
	let dashboardPromise = null;
	let repairTimer = 0;
	let rendering = false;

	function jstToday() {
		return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
	}
	function prepared(date) {
		return PREPARED_RANGES.find((range) => date >= range.from && date <= range.to) || null;
	}
	function shiftMonth(month, delta) {
		const [year, monthNo] = month.split('-').map(Number);
		const value = new Date(Date.UTC(year, monthNo - 1 + delta, 1));
		return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
	}
	function selectedDate() {
		return document.getElementById('jlpt-study-date')?.value || jstToday();
	}
	function loadFixScript() {
		if (document.querySelector('script[data-jlpt-word-pagination-fix]')) return;
		const script = document.createElement('script');
		script.src = FIX_SCRIPT;
		script.defer = true;
		script.dataset.jlptWordPaginationFix = 'true';
		document.head.appendChild(script);
	}
	function injectStyle() {
		if (document.getElementById('jlpt-date-fixes-style')) return;
		const style = document.createElement('style');
		style.id = 'jlpt-date-fixes-style';
		style.textContent = `
			.jlpt-persistent-date-nav{position:sticky;top:8px;z-index:15;margin-bottom:14px;box-shadow:0 6px 18px rgba(38,54,78,.08)}
			.jlpt-calendar-month-nav{display:flex;align-items:center;justify-content:center;gap:10px;margin:0 0 14px}
			.jlpt-calendar-month-nav button{width:40px;height:38px;border:1px solid #d4dce5;border-radius:9px;background:#fff;font:inherit;font-weight:900;cursor:pointer}
			.jlpt-calendar-month-nav strong{min-width:120px;text-align:center;font-size:15px;color:#26364e}
			.jlpt-calendar-day{position:relative;cursor:pointer;transition:background-color .18s ease,border-color .18s ease,box-shadow .18s ease}
			.jlpt-calendar-day .jlpt-calendar-state{display:block;margin-top:5px;font-size:11px;font-weight:800;line-height:1.25}
			.jlpt-calendar-study-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 6px;margin-top:6px;border-radius:999px;background:#26364e;color:#fff;font-size:10px;font-weight:900;line-height:1;white-space:nowrap}
			.jlpt-calendar-day[data-study-state="upcoming"]{background:#eef4ff;border-color:#b8caef}
			.jlpt-calendar-day[data-study-state="upcoming"] .jlpt-calendar-state{color:#486aa8}
			.jlpt-calendar-day[data-study-state="missed"]{background:#fff2ed;border-color:#edc2b3}
			.jlpt-calendar-day[data-study-state="missed"] .jlpt-calendar-state{color:#b45b3d}
			.jlpt-calendar-day[data-study-state="in_progress"]{background:#fff9df;border-color:#e6cf72}
			.jlpt-calendar-day[data-study-state="in_progress"] .jlpt-calendar-state{color:#8a7118}
			.jlpt-calendar-day[data-study-state="completed"]{background:#edf8ef;border-color:#add2b5}
			.jlpt-calendar-day[data-study-state="completed"] .jlpt-calendar-state{color:#367747}
		`;
		document.head.appendChild(style);
	}
	function keepDateNavVisible() {
		const nav = document.getElementById('jlpt-date-nav');
		const todayCard = document.getElementById('jlpt-start-button')?.closest('.jlpt-card');
		if (!nav || !todayCard?.parentElement) return;
		if (nav.parentElement === todayCard) todayCard.before(nav);
		nav.classList.add('jlpt-persistent-date-nav');
	}
	async function loadDashboardProgress() {
		if (dashboardPromise) return dashboardPromise;
		dashboardPromise = fetch(DASHBOARD_API, { credentials: 'same-origin', cache: 'no-store' })
			.then((response) => response.ok ? response.json() : null)
			.then((data) => {
				if (!data?.ok) return;
				for (const row of [...(data.history || []), ...(data.calendar || [])]) {
					if (!row?.date) continue;
					progressByDate.set(row.date, {
						status: row.status || 'not_started',
						progressPercent: Math.max(0, Math.min(100, Number(row.progressPercent || 0))),
					});
				}
			})
			.catch(() => undefined);
		return dashboardPromise;
	}
	function resolveState(date) {
		const today = jstToday();
		const progress = progressByDate.get(date) || {};
		const status = progress.status || 'not_started';
		const percent = Number(progress.progressPercent || 0);
		if (status === 'completed') return { state: 'completed', text: t('학습완료', '学習完了') };
		if (status === 'in_progress' || percent > 0) return { state: 'in_progress', text: t(`학습중 ${percent}%`, `学習中 ${percent}%`) };
		if (date < today) return { state: 'missed', text: t('미학습', '未学習') };
		return { state: 'upcoming', text: t('학습일 전', '学習日前') };
	}
	function ensureMonthNav(cal) {
		let nav = document.getElementById('jlpt-calendar-month-nav');
		if (nav) return nav;
		nav = document.createElement('div');
		nav.id = 'jlpt-calendar-month-nav';
		nav.className = 'jlpt-calendar-month-nav';
		nav.innerHTML = `<button type="button" data-cal-shift="-1" aria-label="${t('이전 달', '前月')}">‹</button><strong id="jlpt-calendar-month-label"></strong><button type="button" data-cal-shift="1" aria-label="${t('다음 달', '翌月')}">›</button>`;
		cal.before(nav);
		nav.addEventListener('click', (event) => {
			const button = event.target.closest('[data-cal-shift]');
			if (!button) return;
			calendarMonth = shiftMonth(calendarMonth, Number(button.dataset.calShift || 0));
			renderMonth();
		});
		return nav;
	}
	function renderMonth() {
		const cal = document.getElementById('jlpt-calendar');
		if (!(cal instanceof HTMLElement) || !calendarMonth) return;
		rendering = true;
		const [year, month] = calendarMonth.split('-').map(Number);
		const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
		const selected = selectedDate();
		const fragment = document.createDocumentFragment();
		for (let day = 1; day <= days; day += 1) {
			const date = `${calendarMonth}-${String(day).padStart(2, '0')}`;
			const range = prepared(date);
			const cell = document.createElement('div');
			cell.className = 'jlpt-calendar-day';
			cell.dataset.fullDate = date;
			cell.classList.toggle('is-selected', date === selected);
			const strong = document.createElement('strong');
			strong.textContent = `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
			const state = document.createElement('span');
			state.className = 'jlpt-calendar-state';
			if (range) {
				const resolved = resolveState(date);
				cell.dataset.studyAvailable = 'true';
				cell.dataset.studyState = resolved.state;
				state.textContent = resolved.text;
				const badge = document.createElement('span');
				badge.className = 'jlpt-calendar-study-badge';
				badge.textContent = t(`문제 ${range.questions}`, `問題 ${range.questions}`);
				badge.title = t(`${date} 학습 문제 있음`, `${date} 学習問題あり`);
				cell.append(strong, state, badge);
			} else {
				cell.dataset.studyAvailable = 'false';
				state.textContent = '—';
				cell.append(strong, state);
			}
			fragment.appendChild(cell);
		}
		cal.replaceChildren(fragment);
		const label = document.getElementById('jlpt-calendar-month-label');
		if (label) label.textContent = isJa ? `${year}年 ${month}月` : `${year}년 ${month}월`;
		requestAnimationFrame(() => { rendering = false; });
	}
	function selectCalendarDate(date) {
		const input = document.getElementById('jlpt-study-date');
		if (!(input instanceof HTMLInputElement)) return;
		input.value = date;
		input.dispatchEvent(new Event('change', { bubbles: true }));
		document.querySelectorAll('#jlpt-calendar .jlpt-calendar-day').forEach((cell) => cell.classList.toggle('is-selected', cell.dataset.fullDate === date));
	}
	function captureCalendarClick(event) {
		const cell = event.target instanceof Element ? event.target.closest('.jlpt-calendar-day[data-full-date]') : null;
		if (!(cell instanceof HTMLElement) || !cell.dataset.fullDate) return;
		event.preventDefault();
		event.stopPropagation();
		selectCalendarDate(cell.dataset.fullDate);
	}
	function repairCalendar() {
		clearTimeout(repairTimer);
		repairTimer = window.setTimeout(() => {
			if (rendering) return;
			const cal = document.getElementById('jlpt-calendar');
			if (!(cal instanceof HTMLElement)) return;
			ensureMonthNav(cal);
			const cells = [...cal.querySelectorAll('.jlpt-calendar-day')];
			const [year, month] = calendarMonth.split('-').map(Number);
			const expected = new Date(Date.UTC(year, month, 0)).getUTCDate();
			if (cells.length !== expected || cells.some((cell) => !cell.dataset.fullDate?.startsWith(`${calendarMonth}-`))) renderMonth();
		}, 60);
	}
	async function mountCalendar() {
		const cal = document.getElementById('jlpt-calendar');
		if (!(cal instanceof HTMLElement)) return;
		await loadDashboardProgress();
		calendarMonth = calendarMonth || selectedDate().slice(0, 7);
		ensureMonthNav(cal);
		renderMonth();
		if (cal.dataset.dateFixObserved !== 'true') {
			cal.dataset.dateFixObserved = 'true';
			new MutationObserver(repairCalendar).observe(cal, { childList: true });
		}
	}
	function init() {
		injectStyle();
		loadFixScript();
		keepDateNavVisible();
		document.addEventListener('click', captureCalendarClick, true);
		const root = document.querySelector('.jlpt-content') || document.body;
		new MutationObserver(() => {
			keepDateNavVisible();
			if (!document.getElementById('jlpt-calendar-month-nav')) mountCalendar();
		}).observe(root, { childList: true, subtree: true });
		window.setTimeout(mountCalendar, 80);
		window.setTimeout(mountCalendar, 250);
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
	else init();
})();
