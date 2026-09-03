(() => {
	const PRACTICE_API = '/api/public/japanese/jlpt/practice';
	const DASHBOARD_API = '/api/public/japanese/jlpt/dashboard';
	const FIX_SCRIPT = '/assets/js/japanese/jlpt-word-pagination-fix.js?v=20260902-1';
	const PREPARED_RANGES = [
		{ from: '2026-09-07', to: '2027-02-28', questions: 21 },
	];
	const isJa = document.body.dataset.blogLanguage === 'ja';
	const t = (ko, ja) => isJa ? ja : ko;
	const cache = new Map();
	const progressByDate = new Map();
	let dashboardPromise = null;
	let scanTimer = 0;

	function jstToday() {
		return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
	}

	function calendarCellDate(cell) {
		if (cell?.dataset?.fullDate && /^\d{4}-\d{2}-\d{2}$/.test(cell.dataset.fullDate)) return cell.dataset.fullDate;
		const text = cell.querySelector('strong')?.textContent?.trim();
		if (!/^\d{2}\/\d{2}$/.test(text || '')) return null;
		const [month, day] = text.split('/').map(Number);
		const today = jstToday();
		let year = Number(today.slice(0, 4));
		const todayMonth = Number(today.slice(5, 7));
		if (todayMonth === 1 && month === 12) year -= 1;
		if (todayMonth === 12 && month === 1) year += 1;
		return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
			.jlpt-calendar-day{position:relative;transition:background-color .18s ease,border-color .18s ease,box-shadow .18s ease}
			.jlpt-calendar-day .jlpt-calendar-state{display:block;margin-top:5px;font-size:11px;font-weight:800;line-height:1.25}
			.jlpt-calendar-study-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 6px;margin-top:6px;border-radius:999px;background:#26364e;color:#fff;font-size:10px;font-weight:900;line-height:1;white-space:nowrap}
			.jlpt-calendar-day[data-study-available="false"] .jlpt-calendar-study-badge{display:none}
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
		if (!nav) return false;
		const todayCard = document.getElementById('jlpt-start-button')?.closest('.jlpt-card');
		if (!todayCard?.parentElement) return false;
		if (nav.parentElement === todayCard) todayCard.before(nav);
		nav.classList.add('jlpt-persistent-date-nav');
		return true;
	}

	function questionCount(data) {
		let count = Array.isArray(data?.questions) ? data.questions.length : 0;
		for (const reading of data?.readings || []) count += Array.isArray(reading?.questions) ? reading.questions.length : 0;
		return count;
	}

	function preparedQuestionCount(date) {
		const found = PREPARED_RANGES.find((range) => date >= range.from && date <= range.to);
		return found?.questions || 0;
	}

	async function loadDashboardProgress() {
		if (dashboardPromise) return dashboardPromise;
		dashboardPromise = fetch(DASHBOARD_API, { credentials: 'same-origin', cache: 'no-store' })
			.then((response) => response.ok ? response.json() : null)
			.then((data) => {
				if (!data?.ok) return;
				for (const row of [...(data.history || []), ...(data.calendar || [])]) {
					if (!row?.date) continue;
					const current = progressByDate.get(row.date) || {};
					progressByDate.set(row.date, {
						status: row.status || current.status || 'not_started',
						progressPercent: Number.isFinite(Number(row.progressPercent)) ? Number(row.progressPercent) : Number(current.progressPercent || 0),
					});
				}
			})
			.catch(() => undefined);
		return dashboardPromise;
	}

	async function inspectDate(date) {
		if (cache.has(date)) return cache.get(date);
		const prepared = preparedQuestionCount(date);
		if (prepared > 0) {
			const result = Promise.resolve({ available: true, count: prepared });
			cache.set(date, result);
			return result;
		}
		const promise = fetch(`${PRACTICE_API}?date=${encodeURIComponent(date)}`, { credentials: 'same-origin', cache: 'no-store' })
			.then(async (response) => {
				const data = await response.json().catch(() => null);
				if (!response.ok || !data?.ok) return { available: false, count: 0 };
				const count = questionCount(data);
				return { available: count > 0, count };
			})
			.catch(() => ({ available: false, count: 0 }));
		cache.set(date, promise);
		return promise;
	}

	function ensureStateNode(cell) {
		let node = cell.querySelector('.jlpt-calendar-state');
		if (node instanceof HTMLElement) return node;
		const existing = [...cell.querySelectorAll(':scope > span')].find((item) => !item.classList.contains('jlpt-calendar-study-badge'));
		if (existing instanceof HTMLElement) {
			existing.classList.add('jlpt-calendar-state');
			return existing;
		}
		node = document.createElement('span');
		node.className = 'jlpt-calendar-state';
		cell.querySelector('strong')?.after(node);
		return node;
	}

	function resolveState(cell, date) {
		const today = jstToday();
		const progress = progressByDate.get(date) || {};
		const rawStatus = progress.status || cell.dataset.status || 'not_started';
		const percent = Math.max(0, Math.min(100, Number(progress.progressPercent || 0)));
		if (rawStatus === 'completed') return { state: 'completed', text: t('학습완료', '学習完了') };
		if (rawStatus === 'in_progress' || percent > 0) return { state: 'in_progress', text: t(`학습중 ${percent}%`, `学習中 ${percent}%`) };
		if (date < today) return { state: 'missed', text: t('미학습', '未学習') };
		return { state: 'upcoming', text: t('학습일 전', '学習日前') };
	}

	async function decorateCell(cell) {
		const date = calendarCellDate(cell);
		if (!date) return;
		cell.dataset.studyChecked = date;
		await loadDashboardProgress();
		const result = await inspectDate(date);
		if (cell.dataset.studyChecked !== date || !cell.isConnected) return;
		cell.dataset.studyAvailable = String(result.available);
		const stateNode = ensureStateNode(cell);

		let badge = cell.querySelector('.jlpt-calendar-study-badge');
		if (!result.available) {
			delete cell.dataset.studyState;
			if (stateNode.textContent !== '—') stateNode.textContent = '—';
			badge?.remove();
			return;
		}

		const state = resolveState(cell, date);
		cell.dataset.studyState = state.state;
		if (stateNode.textContent !== state.text) stateNode.textContent = state.text;

		if (!(badge instanceof HTMLElement)) {
			badge = document.createElement('span');
			badge.className = 'jlpt-calendar-study-badge';
			cell.appendChild(badge);
		}
		const label = t(`문제 ${result.count}`, `問題 ${result.count}`);
		if (badge.textContent !== label) badge.textContent = label;
		badge.title = t(`${date} 학습 문제 있음`, `${date} 学習問題あり`);
	}

	function scanCalendar() {
		clearTimeout(scanTimer);
		scanTimer = window.setTimeout(() => {
			keepDateNavVisible();
			document.querySelectorAll('#jlpt-calendar .jlpt-calendar-day').forEach((cell) => decorateCell(cell));
		}, 80);
	}

	function init() {
		injectStyle();
		loadFixScript();
		keepDateNavVisible();
		loadDashboardProgress().finally(scanCalendar);
		const root = document.querySelector('.jlpt-content') || document.body;
		new MutationObserver(scanCalendar).observe(root, { childList: true, subtree: true });
		scanCalendar();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
	else init();
})();
