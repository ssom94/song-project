(() => {
	const MAX_BOOT_RETRIES = 80;
	const BOOT_RETRY_MS = 100;

	let bootRetries = 0;
	let mounted = false;
	let calendarMonth = '';
	const statusByDate = new Map();

	function lang() {
		return document.body?.dataset?.blogLanguage === 'ja' ? 'ja' : 'ko';
	}

	function t(ko, ja) {
		return lang() === 'ja' ? ja : ko;
	}

	function jstToday() {
		return new Intl.DateTimeFormat('en-CA', {
			timeZone: 'Asia/Tokyo',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}).format(new Date());
	}

	function shiftMonth(monthText, delta) {
		const [year, month] = monthText.split('-').map(Number);
		const value = new Date(Date.UTC(year, month - 1 + delta, 1));
		return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
	}

	function inferFullDate(mmdd, todayText) {
		if (!/^\d{2}\/\d{2}$/.test(mmdd)) return '';
		const [month, day] = mmdd.split('/').map(Number);
		const today = new Date(`${todayText}T00:00:00+09:00`).getTime();
		const currentYear = Number(todayText.slice(0, 4));
		const candidates = [currentYear - 1, currentYear, currentYear + 1]
			.map((year) => {
				const text = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
				const time = new Date(`${text}T00:00:00+09:00`).getTime();
				return { text, distance: Math.abs(time - today) };
			})
			.sort((a, b) => a.distance - b.distance);
		return candidates[0]?.text || '';
	}

	function captureBaseStatuses(wrap, today) {
		statusByDate.clear();
		for (const item of (Array.isArray(window.__SONG_JLPT_CALENDAR_ENTRIES__) ? window.__SONG_JLPT_CALENDAR_ENTRIES__ : [])) {
			if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(item?.date || '')) continue;
			statusByDate.set(item.date, {
				status: item.status || 'not_started',
				text: item.status === 'completed'
					? `✅ ${Number(item.progressPercent || 0)}%`
					: item.status === 'in_progress'
						? `🟡 ${Number(item.progressPercent || 0)}%`
						: '',
			});
		}
		for (const cell of wrap.querySelectorAll('.jlpt-calendar-day')) {
			const mmdd = cell.querySelector('strong')?.textContent?.trim() || '';
			const date = inferFullDate(mmdd, today);
			if (!date) continue;
			statusByDate.set(date, {
				status: cell.dataset.status || 'not_started',
				text: cell.querySelector('span')?.textContent?.trim() || '',
			});
		}
	}

	function injectStyle() {
		if (document.getElementById('jlpt-safe-calendar-style')) return;
		const style = document.createElement('style');
		style.id = 'jlpt-safe-calendar-style';
		style.textContent = `
			.jlpt-calendar-safe-nav{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;margin:0 0 14px}
			.jlpt-calendar-safe-nav button{min-width:40px;height:38px;padding:0 12px;border:1px solid #d4dce5;border-radius:9px;background:#fff;color:#26364e;font:inherit;font-weight:900;cursor:pointer}
			.jlpt-calendar-safe-nav button[data-calendar-today]{min-width:auto;font-size:12px}
			.jlpt-calendar-safe-nav strong{min-width:128px;text-align:center;font-size:15px;color:#26364e}
			.jlpt-calendar-day{position:relative}
			.jlpt-calendar-day .jlpt-calendar-state{display:block;margin-top:5px;font-size:11px;font-weight:800;line-height:1.25}
			.jlpt-calendar-study-badge{display:inline-flex!important;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 6px;margin-top:6px!important;border-radius:999px;background:#26364e;color:#fff!important;font-size:10px!important;font-weight:900;line-height:1;white-space:nowrap}
			.jlpt-calendar-day[data-study-state="upcoming"]{background:#eef4ff;border-color:#b8caef}
			.jlpt-calendar-day[data-study-state="upcoming"] .jlpt-calendar-state{color:#486aa8}
			.jlpt-calendar-day[data-study-state="missed"]{background:#fff2ed;border-color:#edc2b3}
			.jlpt-calendar-day[data-study-state="missed"] .jlpt-calendar-state{color:#b45b3d}
			.jlpt-calendar-day[data-study-state="in_progress"]{background:#fff9df;border-color:#e6cf72}
			.jlpt-calendar-day[data-study-state="completed"]{background:#edf8ef;border-color:#add2b5}
			@media(max-width:640px){.jlpt-calendar-safe-nav{justify-content:space-between;gap:6px}.jlpt-calendar-safe-nav strong{min-width:100px;font-size:14px}.jlpt-calendar-safe-nav button{height:36px;padding:0 10px}}
		`;
		document.head.appendChild(style);
	}

	function ensureNav(wrap) {
		let nav = document.getElementById('jlpt-calendar-safe-nav');
		if (nav) return nav;
		nav = document.createElement('div');
		nav.id = 'jlpt-calendar-safe-nav';
		nav.className = 'jlpt-calendar-safe-nav';
		nav.innerHTML = `
			<button type="button" data-calendar-shift="-1" aria-label="${t('이전 달', '前月')}">‹</button>
			<strong id="jlpt-calendar-safe-label"></strong>
			<button type="button" data-calendar-today="1">${t('이번 달', '今月')}</button>
			<button type="button" data-calendar-shift="1" aria-label="${t('다음 달', '翌月')}">›</button>
		`;
		nav.addEventListener('click', (event) => {
			const target = event.target instanceof Element ? event.target.closest('button') : null;
			if (!(target instanceof HTMLButtonElement)) return;
			if (target.dataset.calendarToday === '1') calendarMonth = jstToday().slice(0, 7);
			else if (target.dataset.calendarShift) calendarMonth = shiftMonth(calendarMonth, Number(target.dataset.calendarShift));
			else return;
			renderCalendar(wrap);
		});
		wrap.before(nav);
		return nav;
	}

	function stateFor(saved, date, today) {
		if (saved?.status === 'completed') {
			return { state: 'completed', text: saved.text || t('학습완료', '学習完了') };
		}
		if (saved?.status === 'in_progress') {
			return { state: 'in_progress', text: saved.text || t('학습중', '学習中') };
		}
		if (saved) {
			return date > today
				? { state: 'upcoming', text: t('학습일 전', '学習日前') }
				: { state: 'missed', text: t('미학습', '未学習') };
		}
		return { state: 'none', text: '—' };
	}

	function renderCalendar(wrap) {
		if (!calendarMonth) return;
		const [year, month] = calendarMonth.split('-').map(Number);
		const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
		const fragment = document.createDocumentFragment();
		const today = jstToday();

		for (let day = 1; day <= days; day += 1) {
			const date = `${calendarMonth}-${String(day).padStart(2, '0')}`;
			const saved = statusByDate.get(date);
			const resolved = stateFor(saved, date, today);
			const cell = document.createElement('div');
			cell.className = 'jlpt-calendar-day';
			cell.dataset.status = saved?.status || 'not_started';
			cell.dataset.fullDate = date;
			cell.dataset.studyAvailable = saved ? 'true' : 'false';
			cell.dataset.studyState = resolved.state;

			const strong = document.createElement('strong');
			strong.textContent = `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
			const state = document.createElement('span');
			state.className = 'jlpt-calendar-state';
			state.textContent = resolved.text;
			cell.append(strong, state);

			fragment.appendChild(cell);
		}

		wrap.replaceChildren(fragment);
		const label = document.getElementById('jlpt-calendar-safe-label');
		if (label) label.textContent = lang() === 'ja' ? `${year}年 ${month}月` : `${year}년 ${month}월`;
	}

	function tryMount() {
		if (mounted) return;
		const wrap = document.getElementById('jlpt-calendar');
		if (!(wrap instanceof HTMLElement)) return;
		const cells = wrap.querySelectorAll('.jlpt-calendar-day');
		if (!cells.length) {
			bootRetries += 1;
			if (bootRetries <= MAX_BOOT_RETRIES) window.setTimeout(tryMount, BOOT_RETRY_MS);
			return;
		}

		const today = jstToday();
		captureBaseStatuses(wrap, today);
		const selectedDate = window.__SONG_JLPT_SELECTED_DATE__;
		calendarMonth = /^\d{4}-\d{2}-\d{2}$/.test(selectedDate || '') ? selectedDate.slice(0, 7) : today.slice(0, 7);
		injectStyle();
		ensureNav(wrap);
		renderCalendar(wrap);
		mounted = true;
		window.__SONG_JLPT_SAFE_RUNTIME__ = true;
	}

	function init() {
		window.setTimeout(tryMount, 0);
	}

	window.addEventListener('song:jlpt-calendar-data', () => {
		const wrap = document.getElementById('jlpt-calendar');
		if (!(wrap instanceof HTMLElement)) return;
		captureBaseStatuses(wrap, jstToday());
		if (mounted) renderCalendar(wrap);
	});

	window.addEventListener('song:jlpt-date-selected', (event) => {
		const date = event.detail?.date;
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return;
		calendarMonth = date.slice(0, 7);
		const wrap = document.getElementById('jlpt-calendar');
		if (mounted && wrap instanceof HTMLElement) renderCalendar(wrap);
	});

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
	else init();
})();
