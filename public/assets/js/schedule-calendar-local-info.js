(() => {
	const STYLE_ID = 'schedule-calendar-local-info-style';
	const VERSION = '20260831-r8-9-v2';
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

	const GOMI_META = {
		burnable: { ja: '燃えるごみ', ko: '가연 쓰레기', shortJa: '可燃', shortKo: '가연' },
		nonburnable: { ja: '燃えないごみ', ko: '불연 쓰레기', shortJa: '不燃', shortKo: '불연' },
		pet: { ja: 'ペットボトル', ko: '페트병', shortJa: 'PET', shortKo: 'PET' },
		bincan: { ja: 'ビン・カン', ko: '병·캔', shortJa: 'ビン缶', shortKo: '병·캔' },
		paper: { ja: '紙・布', ko: '종이·천', shortJa: '紙布', shortKo: '종이·천' },
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
		return 1 + ((weekday - first.getUTCDay() + 7) % 7) + ((nth - 1) * 7);
	}

	function springEquinox(year) {
		if (year < 1980 || year > 2099) return null;
		return Math.floor(20.8431 + (0.242194 * (year - 1980)) - Math.floor((year - 1980) / 4));
	}

	function autumnEquinox(year) {
		if (year < 1980 || year > 2099) return null;
		return Math.floor(23.2488 + (0.242194 * (year - 1980)) - Math.floor((year - 1980) / 4));
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
			if (!map.has(key) && map.has(keyOf(addDays(date, -1))) && map.has(keyOf(addDays(date, 1)))) {
				map.set(key, { ja: '国民の休日', ko: '국민의 휴일' });
			}
		}

		const originals = [...map.entries()];
		for (const [key] of originals) {
			const date = parseKey(key);
			if (!date || date.getUTCDay() !== 0) continue;
			let next = addDays(date, 1);
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
		const types = [];
		if (weekday === 3 || weekday === 6) types.push('burnable');
		if (weekday === 2) {
			if ([1, 2, 4, 5].includes(week)) types.push('bincan');
			if ([2, 4].includes(week)) types.push('paper');
			if (week === 3) types.push('nonburnable');
		}
		if (weekday === 6 && [2, 4].includes(week)) types.push('pet');
		return types;
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

			.schedule-calendar-local-info{display:none!important}
			.schedule-calendar-holiday-info{
				position:absolute;z-index:3;top:7px;right:7px;left:31px;
				display:flex;flex-direction:column;align-items:flex-end;gap:1px;
				min-width:0;pointer-events:none;text-align:right;
			}
			.schedule-calendar-holiday-text{
				display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
				font-size:7px;font-weight:850;line-height:1.25;letter-spacing:-.02em;
			}
			.schedule-calendar-holiday-text.is-jp{color:#d64555}
			.schedule-calendar-holiday-text.is-kr{color:#2f67c8}
			.schedule-calendar-day.is-outside .schedule-calendar-holiday-text{opacity:.42}

			.schedule-calendar-gomi-info{
				position:absolute;z-index:3;right:5px;bottom:5px;
				display:flex;flex-direction:column;align-items:flex-end;gap:2px;
				max-width:calc(100% - 10px);pointer-events:none;
			}
			.schedule-calendar-gomi-chip{
				display:inline-flex;align-items:center;justify-content:flex-start;gap:3px;
				width:max-content;max-width:100%;min-height:13px;padding:1px 5px 1px 4px;
				border:1px solid #dfe5ec;border-radius:999px;background:rgba(255,255,255,.93);
				box-shadow:0 1px 4px rgba(38,52,73,.06);color:#566577;
				font-size:6.7px;font-weight:850;line-height:1.2;white-space:nowrap;
			}
			.schedule-calendar-gomi-icon{display:inline-flex;flex:0 0 auto;width:9px;height:9px}
			.schedule-calendar-gomi-icon svg{display:block;width:9px;height:9px;stroke:currentColor;fill:none;stroke-width:1.55;stroke-linecap:round;stroke-linejoin:round}
			.schedule-calendar-gomi-label-short{display:none}
			.schedule-calendar-gomi-chip.is-burnable{color:#c24965;border-color:#efd9de;background:rgba(255,248,250,.95)}
			.schedule-calendar-gomi-chip.is-nonburnable{color:#9a651e;border-color:#eadfcf;background:rgba(255,251,244,.96)}
			.schedule-calendar-gomi-chip.is-pet{color:#2d6ba7;border-color:#d5e3ef;background:rgba(247,251,255,.96)}
			.schedule-calendar-gomi-chip.is-bincan{color:#327362;border-color:#d4e6df;background:rgba(247,253,251,.96)}
			.schedule-calendar-gomi-chip.is-paper{color:#6c5c91;border-color:#e0daeb;background:rgba(251,249,255,.96)}
			.schedule-calendar-day.is-outside .schedule-calendar-gomi-info{opacity:.42}

			@media(max-width:700px){
				.schedule-calendar-holiday-info{top:5px;right:4px;left:27px}
				.schedule-calendar-holiday-text{font-size:6px}
				.schedule-calendar-gomi-info{right:3px;bottom:3px;gap:1px}
				.schedule-calendar-gomi-chip{min-height:11px;padding:1px 4px 1px 3px;font-size:5.8px;gap:2px}
				.schedule-calendar-gomi-icon,.schedule-calendar-gomi-icon svg{width:8px;height:8px}
				.schedule-calendar-gomi-label-full{display:none}
				.schedule-calendar-gomi-label-short{display:inline}
			}
		`;
		document.head.appendChild(style);
	}

	function svgIcon(type) {
		const wrap = document.createElement('span');
		wrap.className = 'schedule-calendar-gomi-icon';
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', '0 0 16 16');
		svg.setAttribute('aria-hidden', 'true');
		const paths = {
			burnable: ['M8.1 1.8c.5 2.2-1.8 2.9-1.2 4.8.4 1.1 1.5 1.4 2.1.6.8-1 .4-2 .7-2.8 1.8 1.5 3 3.4 3 5.5 0 2.6-2 4.5-4.6 4.5S3.2 12.8 3.2 10.4c0-2.1 1.3-3.7 2.7-5.1.3 1 .2 1.8.7 2.4'],
			nonburnable: ['M4.1 5h7.8l-.6 8H4.7l-.6-8Z','M3 3.2h10','M6 3.2V2h4v1.2','M6.6 7v3.8','M9.4 7v3.8'],
			pet: ['M6.2 2.2h3.6','M6.8 2.2v2L5.4 6v6.4c0 .8.6 1.4 1.4 1.4h2.4c.8 0 1.4-.6 1.4-1.4V6L9.2 4.2v-2','M5.5 8h5'],
			bincan: ['M2.8 6.1 4.5 3l1.1 1.9','M4.5 3h3','M13.2 6.1 11.5 3l-1.1 1.9','M11.5 3H8.7','M4 10h-2l1.8 3h3.3','M12 10h2l-1.8 3H8.9'],
			paper: ['M4 2.2h5l3 3v8.6H4z','M9 2.2v3h3','M6 8h4','M6 10.5h4'],
		};
		for (const d of paths[type] || paths.paper) {
			const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			path.setAttribute('d', d);
			svg.appendChild(path);
		}
		wrap.appendChild(svg);
		return wrap;
	}

	function holidayText(kind, holiday, language) {
		const node = document.createElement('span');
		node.className = `schedule-calendar-holiday-text is-${kind}`;
		node.textContent = holiday[language] || holiday.ja || holiday.ko || '';
		return node;
	}

	function gomiChip(type, language) {
		const meta = GOMI_META[type];
		const chip = document.createElement('span');
		chip.className = `schedule-calendar-gomi-chip is-${type}`;
		chip.appendChild(svgIcon(type));
		const full = document.createElement('span');
		full.className = 'schedule-calendar-gomi-label-full';
		full.textContent = language === 'ko' ? meta.ko : meta.ja;
		const short = document.createElement('span');
		short.className = 'schedule-calendar-gomi-label-short';
		short.textContent = language === 'ko' ? meta.shortKo : meta.shortJa;
		chip.append(full, short);
		return chip;
	}

	function cleanup(day) {
		day.querySelectorAll('.schedule-calendar-local-info,.schedule-calendar-holiday-info,.schedule-calendar-gomi-info').forEach((node) => node.remove());
		day.classList.remove('is-calendar-sunday','is-calendar-saturday','has-jp-holiday','has-kr-holiday','has-calendar-gomi');
	}

	function decorateDay(day) {
		if (!(day instanceof HTMLElement)) return;
		const key = day.dataset.date;
		const date = parseKey(key);
		if (!date) return;
		const language = languageOf(day);
		const year = date.getUTCFullYear();
		const jpHoliday = buildJapaneseHolidays(year).get(key) || null;
		const krHoliday = koreanHoliday(key, year);
		const gomi = yashioCollection(date, key);
		const signature = [VERSION, key, language, jpHoliday?.ja || '', krHoliday?.ko || '', gomi.join(',')].join('|');
		if (day.dataset.localInfoSignature === signature) return;

		cleanup(day);
		if (date.getUTCDay() === 0) day.classList.add('is-calendar-sunday');
		if (date.getUTCDay() === 6) day.classList.add('is-calendar-saturday');
		if (jpHoliday) day.classList.add('has-jp-holiday');
		if (krHoliday) day.classList.add('has-kr-holiday');
		if (gomi.length) day.classList.add('has-calendar-gomi');

		if (jpHoliday || krHoliday) {
			const holidays = document.createElement('div');
			holidays.className = 'schedule-calendar-holiday-info';
			if (jpHoliday) holidays.appendChild(holidayText('jp', jpHoliday, language));
			if (krHoliday) holidays.appendChild(holidayText('kr', krHoliday, language));
			day.appendChild(holidays);
		}

		if (gomi.length) {
			const container = document.createElement('div');
			container.className = 'schedule-calendar-gomi-info';
			for (const type of gomi) container.appendChild(gomiChip(type, language));
			day.appendChild(container);
		}
		day.dataset.localInfoSignature = signature;
	}

	function decorateAll() {
		document.querySelectorAll('.schedule-calendar-day[data-date]').forEach(decorateDay);
	}

	let queued = false;
	function queueDecorate() {
		if (queued) return;
		queued = true;
		queueMicrotask(() => {
			queued = false;
			decorateAll();
		});
	}

	const observer = new MutationObserver((records) => {
		if (records.every((record) => record.target instanceof HTMLElement && (record.target.closest?.('.schedule-calendar-holiday-info') || record.target.closest?.('.schedule-calendar-gomi-info')))) return;
		queueDecorate();
	});

	function resetAndDecorate() {
		document.querySelectorAll('.schedule-calendar-day[data-date]').forEach((day) => {
			if (day instanceof HTMLElement) delete day.dataset.localInfoSignature;
		});
		queueDecorate();
	}

	function initialize() {
		installStyle();
		decorateAll();
		observer.observe(document.body, { childList: true, subtree: true });
		document.addEventListener('adminlanguagechange', resetAndDecorate);
		document.querySelectorAll('[data-home-language]').forEach((button) => button.addEventListener('click', () => window.setTimeout(resetAndDecorate, 0)));
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
