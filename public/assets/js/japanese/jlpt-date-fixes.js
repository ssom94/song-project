(() => {
	const PRACTICE_API = '/api/public/japanese/jlpt/practice';
	const FIX_SCRIPT = '/assets/js/japanese/jlpt-word-pagination-fix.js?v=20260901-2';
	const isJa = document.body.dataset.blogLanguage === 'ja';
	const t = (ko, ja) => isJa ? ja : ko;
	const cache = new Map();
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
			.jlpt-calendar-day{position:relative}
			.jlpt-calendar-study-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;margin-top:5px;border-radius:999px;background:#26364e;color:#fff;font-size:10px;font-weight:900;line-height:1}
			.jlpt-calendar-day[data-study-available="false"]{opacity:.62}
			.jlpt-calendar-day[data-study-available="false"] .jlpt-calendar-study-badge{display:none}
			.jlpt-calendar-day[data-study-available="true"]{opacity:1}
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

	async function inspectDate(date) {
		if (cache.has(date)) return cache.get(date);
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

	async function decorateCell(cell) {
		const date = calendarCellDate(cell);
		if (!date) return;
		cell.dataset.studyChecked = date;
		const result = await inspectDate(date);
		if (cell.dataset.studyChecked !== date || !cell.isConnected) return;
		cell.dataset.studyAvailable = String(result.available);

		let badge = cell.querySelector('.jlpt-calendar-study-badge');
		if (!result.available) {
			badge?.remove();
			return;
		}
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
		const root = document.querySelector('.jlpt-content') || document.body;
		new MutationObserver(scanCalendar).observe(root, { childList: true, subtree: true });
		scanCalendar();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
	else init();
})();
