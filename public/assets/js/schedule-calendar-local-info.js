(() => {
	const STYLE_ID = 'schedule-calendar-local-info-style';
	const VERSION = '20260831-r8-9-v1';
	const YASHIO_START = '2026-04-01';
	const YASHIO_END = '2027-03-31';
	const DAY_MS = 86400000;
	const jpCache = new Map();

	const KOREAN_HOLIDAYS = {
		2026: {
			'2026-01-01': ['신정', '元日'],
			'2026-02-16': ['설날 연휴', '旧正月連休'],
			'2026-02-17': ['설날', '旧正月'],
			'2026-02-18': ['설날 연휴', '旧正月連休'],
			'2026-03-01': ['삼일절', '三・一節'],
			'2026-03-02': ['삼일절 대체공휴일', '三・一節 振替休日'],
			'2026-05-05': ['어린이날', 'こどもの日'],
			'2026-05-24': ['부처님오신날', '釈迦誕生日'],
			'2026-05-25': ['부처님오신날 대체공휴일', '釈迦誕生日 振替休日'],
			'2026-06-03': ['전국동시지방선거', '全国同時地方選挙'],
			'2026-06-06': ['현충일', '顕忠日'],
			'2026-08-15': ['광복절', '光復節'],
			'2026-08-17': ['광복절 대체공휴일', '光復節 振替休日'],
			'2026-09-24': ['추석 연휴', '秋夕連休'],
			'2026-09-25': ['추석', '秋夕'],
			'2026-09-26': ['추석 연휴', '秋夕連休'],
			'2026-10-03': ['개천절', '開天節'],
			'2026-10-05': ['개천절 대체공휴일', '開天節 振替休日'],
			'2026-10-09': ['한글날', 'ハングルの日'],
			'2026-12-25': ['성탄절', 'クリスマス'],
		},
		2027: {
			'2027-01-01': ['신정', '元日'],
			'2027-02-06': ['설날 연휴', '旧正月連休'],
			'2027-02-07': ['설날', '旧正月'],
			'2027-02-08': ['설날 연휴', '旧正月連休'],
			'2027-02-09': ['설날 대체공휴일', '旧正月 振替休日'],
			'2027-03-01': ['삼일절', '三・一節'],
			'2027-05-05': ['어린이날', 'こどもの日'],
			'2027-05-13': ['부처님오신날', '釈迦誕生日'],
			'2027-06-06': ['현충일', '顕忠日'],
			'2027-08-15': ['광복절', '光復節'],
			'2027-08-16': ['광복절 대체공휴일', '光復節 振替休日'],
			'2027-09-14': ['추석 연휴', '秋夕連休'],
			'2027-09-15': ['추석', '秋夕'],
			'2027-09-16': ['추석 연휴', '秋夕連休'],
			'2027-10-03': ['개천절', '開天節'],
			'2027-10-04': ['개천절 대체공휴일', '開天節 振替休日'],
			'2027-10-09': ['한글날', 'ハングルの日'],
			'2027-10-11': ['한글날 대체공휴일', 'ハングルの日 振替休日'],
			'2027-12-25': ['성탄절', 'クリスマス'],
			'2027-12-27': ['성탄절 대체공휴일', 'クリスマス 振替休日'],
		},
	};

	function pad(value) {
		return String(value).padStart(2, '0');
	}

	function keyOf(date) {
		return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
	}

	function parseKey(value) {
		if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
		const date = new Date(`${value}T00:00:00Z`);
		return Number.isNaN(date.getTime()) ? null : date;
	}

	function addDays(date, amount) {
		return new Date(date.getTime() + amount * DAY_MS);
	}

	function nthWeekday(year, month, weekday, nth) {
		const first = new Date(Date.UTC(year, month, 1));
		const offset = (weekday - first.getUTCDay() + 7) % 7;
		return 1 + offset + (nth - 1) * 7;
	}

	function springEquinox(year) {
		if (year < 1980 || year > 2099) return null;
		return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
	}

	function autumnEquinox(year) {
		if (year < 1980 || year > 2099) return null;
		return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
	}

	function addHoliday(map, year, month, day, ja, ko) {
		if (!day) return;
		map.set(`${year}-${pad(month + 1)}-${pad(day)}`, { ja, ko });
	}

	function buildJapaneseHolidays(year) {
		if (jpCache.has(year)) return jpCache.get(year);
		const map = new Map();
		if (year < 2022 || year > 2099) {
			jpCache.set(year, map);
			return map;
		}

		addHoliday(map, year, 0, 1, '元日', '신정');
		addHoliday(map, year, 0, nthWeekday(year, 0, 1, 2), '成人の日', '성인의 날');
		addHoliday(map, year, 1, 11, '建国記念の日', '건국기념일');
		addHoliday(map, year, 1, 23, '天皇誕生日', '천황탄생일');
		addHoliday(map, year, 2, springEquinox(year), '春分の日', '춘분의 날');
		addHoliday(map, year, 3, 29, '昭和の日', '쇼와의 날');
		addHoliday(map, year, 4, 3, '憲法記念日', '헌법기념일');
		addHoliday(map, year, 4, 4, 'みどりの日', '녹색의 날');
		addHoliday(map, year, 4, 5, 'こどもの日', '어린이날');
		addHoliday(map, year, 6, nthWeekday(year, 6, 1, 3), '海の日', '바다의 날');
		addHoliday(map, year, 7, 11, '山の日', '산의 날');
		addHoliday(map, year, 8, nthWeekday(year, 8, 1, 3), '敬老の日', '경로의 날');
		addHoliday(map, year, 8, autumnEquinox(year), '秋分の日', '추분의 날');
		addHoliday(map, year, 9, nthWeekday(year, 9, 1, 2), 'スポーツの日', '스포츠의 날');
		addHoliday(map, year, 10, 3, '文化の日', '문화의 날');
		addHoliday(map, year, 10, 23, '勤労感謝の日', '근로감사의 날');

		for (let time = Date.UTC(year, 0, 2); time <= Date.UTC(year, 11, 30); time += DAY_MS) {
			const date = new Date(time);
			const key = keyOf(date);
			if (map.has(key)) continue;
			if (map.has(keyOf(addDays(date, -1))) && map.has(keyOf(addDays(date, 1)))) {
				map.set(key, { ja: '国民の休日', ko: '국민의 휴일' });
			}
		}

		const sundayHolidays = [...map.entries()].filter(([key]) => parseKey(key)?.getUTCDay() === 0);
		for (const [, holiday] of sundayHolidays) {
			const origin = [...map.entries()].find(([key, value]) => value === holiday && parseKey(key)?.getUTCDay() === 0)?.[0];
			if (!origin) continue;
			let next = addDays(parseKey(origin), 1);
			while (map.has(keyOf(next))) next = addDays(next, 1);
			map.set(keyOf(next), { ja: '振替休日', ko: '대체휴일' });
		}

		jpCache.set(year, map);
		return map;
	}

	function koreanHoliday(key, year) {
		const value = KOREAN_HOLIDAYS[year]?.[key];
		return value ? { ko: value[0], ja: value[1] } : null;
	}

	function calendarWeek(date) {
		const firstDow = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).getUTCDay();
		return Math.floor((firstDow + date.getUTCDate() - 1) / 7) + 1;
	}

	function yashioCollection(date, key) {
		if (key < YASHIO_START || key > YASHIO_END || key === '2027-01-02') return [];
		const weekday = date.getUTCDay();
		const week = calendarWeek(date);
		const result = [];
		if (weekday === 3 || weekday === 6) result.push({ type: 'burnable', ja: '燃えるごみ', ko: '가연 쓰레기' });
		if (weekday === 2) {
			if ([1, 2, 4, 5].includes(week)) result.push({ type: 'bincan', ja: 'ビン・カン', ko: '병·캔' });
			if ([2, 4].includes(week)) result.push({ type: 'paper', ja: '紙・布', ko: '종이·천' });
			if (week === 3) result.push({ type: 'nonburnable', ja: '燃えないごみ', ko: '불연 쓰레기' });
		}
		if (weekday === 6 && [2, 4].includes(week)) result.push({ type: 'pet', ja: 'ペットボトル', ko: '페트병' });
		return result;
	}

	function languageOf(day) {
		const root = day.closest('[data-schedule-manager]');
		if (root?.dataset.context === 'admin') return window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja';
		if (root?.dataset.context === 'home') return document.body?.dataset?.blogLanguage === 'ko' ? 'ko' : 'ja';
		return root?.dataset.language === 'ko' ? 'ko' : 'ja';
	}

	function installStyle() {
		if (document.getElementById(STYLE_ID)) return;
		const style = document.createElement('style');
		style.id = STYLE_ID;
		style.textContent = `
			.schedule-calendar-day.is-calendar-sunday:not(.is-outside) .schedule-calendar-date{color:#d64555}
			.schedule-calendar-day.is-calendar-saturday:not(.is-outside) .schedule-calendar-date{color:#2f67c8}
			.schedule-calendar-day.has-jp-holiday:not(.is-outside):not(.is-calendar-sunday):not(.is-calendar-saturday) .schedule-calendar-date{color:#d64555}
			.schedule-calendar-day.has-kr-holiday:not(.is-outside):not(.is-calendar-sunday):not(.is-calendar-saturday):not(.has-jp-holiday) .schedule-calendar-date{color:#2f67c8}
			.schedule-calendar-day.is-outside.is-calendar-sunday .schedule-calendar-date{color:#e8b7bc}
			.schedule-calendar-day.is-outside.is-calendar-saturday .schedule-calendar-date{color:#b9c8e5}
			.schedule-calendar-day.is-today .schedule-calendar-date{color:#fff!important}
			.schedule-calendar-local-info{display:flex;flex-wrap:wrap;gap:2px;margin-top:2px;min-width:0;position:relative;z-index:2}
			.schedule-calendar-local-badge{display:block;max-width:100%;min-width:0;padding:2px 4px;border-radius:4px;font-size:6.7px;font-weight:850;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:auto}
			.schedule-calendar-local-badge.is-jp{flex-basis:100%;background:#fff0f1;color:#c83c4c;border:1px solid #f5d2d6}
			.schedule-calendar-local-badge.is-kr{flex-basis:100%;background:#eef4ff;color:#2b60bb;border:1px solid #d7e3fb}
			.schedule-calendar-local-badge.is-gomi{flex:1 1 calc(50% - 2px);border:1px solid transparent}
			.schedule-calendar-local-badge.is-burnable{background:#fff0f5;color:#bf2d68;border-color:#f4cddd}
			.schedule-calendar-local-badge.is-nonburnable{background:#fff5e8;color:#b86708;border-color:#f6ddba}
			.schedule-calendar-local-badge.is-pet{background:#f1f9e8;color:#598b26;border-color:#dcecc9}
			.schedule-calendar-local-badge.is-bincan{background:#eafafa;color:#087f87;border-color:#c8ecee}
			.schedule-calendar-local-badge.is-paper{background:#f6eff9;color:#7d4a8c;border-color:#e7d9ed}
			.schedule-calendar-grid-preview .schedule-calendar-local-info{opacity:.78}
			@media(max-width:700px){.schedule-calendar-local-badge{font-size:6px;padding:1px 3px}.schedule-calendar-local-badge.is-gomi{flex-basis:100%}}
		`;
		document.head.appendChild(style);
	}

	function badge(className, text, title) {
		const node = document.createElement('span');
		node.className = `schedule-calendar-local-badge ${className}`;
		node.textContent = text;
		node.title = title || text;
		return node;
	}

	function decorateDay(day) {
		if (!(day instanceof HTMLElement)) return;
		const key = day.dataset.date || '';
		const date = parseKey(key);
		if (!date) return;
		const lang = languageOf(day);
		const signature = `${VERSION}:${lang}:${key}:${day.classList.contains('is-outside') ? 'out' : 'in'}`;
		if (day.dataset.calendarLocalInfo === signature) return;
		day.dataset.calendarLocalInfo = signature;
		day.classList.remove('is-calendar-sunday', 'is-calendar-saturday', 'has-jp-holiday', 'has-kr-holiday');
		day.querySelector(':scope > .schedule-calendar-local-info')?.remove();

		const weekday = date.getUTCDay();
		day.classList.toggle('is-calendar-sunday', weekday === 0);
		day.classList.toggle('is-calendar-saturday', weekday === 6);
		if (day.classList.contains('is-outside')) return;

		const jp = buildJapaneseHolidays(date.getUTCFullYear()).get(key) || null;
		const kr = koreanHoliday(key, date.getUTCFullYear());
		const garbage = yashioCollection(date, key);
		if (!jp && !kr && garbage.length === 0) return;

		const info = document.createElement('div');
		info.className = 'schedule-calendar-local-info';
		info.addEventListener('click', (event) => event.stopPropagation());
		if (jp) {
			day.classList.add('has-jp-holiday');
			const text = lang === 'ko' ? jp.ko : jp.ja;
			info.appendChild(badge('is-jp', `JP ${text}`, `日本の祝日 · ${jp.ja}`));
		}
		if (kr) {
			day.classList.add('has-kr-holiday');
			const text = lang === 'ko' ? kr.ko : kr.ja;
			info.appendChild(badge('is-kr', `KR ${text}`, `대한민국 공휴일 · ${kr.ko}`));
		}
		for (const item of garbage) {
			const text = lang === 'ko' ? item.ko : item.ja;
			info.appendChild(badge(`is-gomi is-${item.type}`, text, `八潮市 ごみ収集カレンダー9 · ${item.ja}`));
		}
		const events = day.querySelector(':scope > .schedule-calendar-events');
		if (events) day.insertBefore(info, events);
		else day.appendChild(info);
	}

	function decorateAll() {
		installStyle();
		document.querySelectorAll('.schedule-calendar-day[data-date]').forEach(decorateDay);
	}

	let queued = false;
	const observer = new MutationObserver(() => {
		if (queued) return;
		queued = true;
		queueMicrotask(() => {
			queued = false;
			decorateAll();
		});
	});

	function initialize() {
		decorateAll();
		observer.observe(document.body, { childList: true, subtree: true });
		document.addEventListener('adminlanguagechange', () => window.setTimeout(decorateAll, 0));
		document.querySelectorAll('[data-home-language]').forEach((button) => button.addEventListener('click', () => window.setTimeout(decorateAll, 60)));
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
