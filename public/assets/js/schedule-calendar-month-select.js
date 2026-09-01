(() => {
	const STYLE_ID = 'schedule-calendar-month-select-style';
	const ENHANCED_ATTR = 'monthSelectEnhanced';
	const RANGE_ENHANCED_ATTR = 'scheduleRangeEnhanced';
	const PUBLIC_API = '/api/public/dashboard/schedules?kind=calendar';

	function language() {
		return document.body?.dataset?.blogLanguage === 'ko' ? 'ko' : 'ja';
	}

	function installStyle() {
		if (document.getElementById(STYLE_ID)) return;
		const style = document.createElement('style');
		style.id = STYLE_ID;
		style.textContent = `
			.schedule-calendar-month-picker[data-month-select-enhanced="true"] .schedule-calendar-picker-selects {
				display: grid;
				grid-template-columns: repeat(2, minmax(0, 1fr));
				gap: 7px;
			}
			.schedule-calendar-month-picker[data-month-select-enhanced="true"] .schedule-calendar-year-select,
			.schedule-calendar-month-picker[data-month-select-enhanced="true"] .schedule-calendar-month-select {
				width: 100%;
				height: 34px;
				min-width: 0;
				padding: 0 9px;
				border: 1px solid #d9e1ec;
				border-radius: 8px;
				background: #fff;
				color: #40516a;
				font: inherit;
				font-size: 10px;
				font-weight: 800;
				outline: none;
			}
			.schedule-calendar-month-picker[data-month-select-enhanced="true"] .schedule-calendar-year-select:focus,
			.schedule-calendar-month-picker[data-month-select-enhanced="true"] .schedule-calendar-month-select:focus {
				border-color: #86a8eb;
				box-shadow: 0 0 0 3px rgba(31, 86, 216, .08);
			}
			.schedule-calendar-month-picker[data-month-select-enhanced="true"] .schedule-calendar-month-grid {
				display: none !important;
			}
			.schedule-calendar-day.is-outside {
				background: #eef1f5 !important;
			}
			.schedule-calendar-day.is-outside .schedule-calendar-date {
				color: #aab2bd !important;
			}
			.schedule-calendar-day.is-outside .schedule-calendar-events {
				opacity: .58;
			}
			.schedule-list-panel[data-schedule-range-enhanced="true"] .schedule-list-table-head,
			.schedule-list-panel[data-schedule-range-enhanced="true"] .schedule-list-row {
				grid-template-columns: 68px minmax(0, 1fr) 116px;
			}
			.schedule-list-panel.is-admin[data-schedule-range-enhanced="true"] .schedule-list-table-head,
			.schedule-list-panel.is-admin[data-schedule-range-enhanced="true"] .schedule-list-row {
				grid-template-columns: 68px minmax(0, 1fr) 116px 34px;
			}
			.schedule-list-period {
				color: #607089;
				font-size: 8.6px;
				font-weight: 750;
				line-height: 1.35;
				white-space: normal;
			}
			@media (max-width: 560px) {
				.schedule-calendar-month-picker[data-month-select-enhanced="true"] .schedule-calendar-picker-selects {
					gap: 6px;
				}
				.schedule-list-panel[data-schedule-range-enhanced="true"] .schedule-list-table-head,
				.schedule-list-panel[data-schedule-range-enhanced="true"] .schedule-list-row {
					grid-template-columns: 58px minmax(0, 1fr) 96px;
					gap: 5px;
					padding-left: 10px;
					padding-right: 10px;
				}
				.schedule-list-panel.is-admin[data-schedule-range-enhanced="true"] .schedule-list-table-head,
				.schedule-list-panel.is-admin[data-schedule-range-enhanced="true"] .schedule-list-row {
					grid-template-columns: 58px minmax(0, 1fr) 96px 30px;
				}
				.schedule-list-period { font-size: 8px; }
			}
		`;
		document.head.appendChild(style);
	}

	function validDate(value) {
		return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
	}

	function compactDate(value) {
		if (!validDate(value)) return '—';
		const [year, month, day] = value.split('-');
		return `${year.slice(2)}. ${month}. ${day}.`;
	}

	function periodLabel(item) {
		if (!validDate(item?.startDate)) return '—';
		const start = compactDate(item.startDate);
		if (!validDate(item?.endDate) || item.endDate === item.startDate) return start;
		return `${start} ~ ${compactDate(item.endDate)}`;
	}

	function sortedSchedules(items) {
		return [...items].sort((a, b) => {
			const dateA = validDate(a.startDate) ? a.startDate : '9999-12-31';
			const dateB = validDate(b.startDate) ? b.startDate : '9999-12-31';
			if (dateA !== dateB) return dateA.localeCompare(dateB);
			return Number(a.id || 0) - Number(b.id || 0);
		});
	}

	function createdTime(item) {
		const value = Date.parse(String(item?.createdAt || ''));
		return Number.isFinite(value) ? value : 0;
	}

	async function loadSchedules() {
		try {
			const response = await fetch(PUBLIC_API, { credentials: 'same-origin', cache: 'no-store' });
			const result = response.ok ? await response.json().catch(() => null) : null;
			return result?.ok && Array.isArray(result.schedules) ? sortedSchedules(result.schedules) : [];
		} catch {
			return [];
		}
	}

	async function enhanceScheduleList(panel) {
		if (!(panel instanceof HTMLElement)) return;
		const head = panel.querySelector('.schedule-list-table-head');
		const rows = [...panel.querySelectorAll('.schedule-list-row')];
		if (!(head instanceof HTMLElement) || !rows.length) return;
		if (head.querySelector('.schedule-list-period-head') || head.dataset.rangeEnhancing === 'true') return;
		head.dataset.rangeEnhancing = 'true';

		const schedules = await loadSchedules();
		delete head.dataset.rangeEnhancing;
		if (!head.isConnected || !schedules.length) return;

		panel.dataset[RANGE_ENHANCED_ATTR] = 'true';
		const rangeHead = document.createElement('span');
		rangeHead.className = 'schedule-list-period-head';
		rangeHead.textContent = language() === 'ko' ? '일정기간' : '予定期間';
		const actionHead = panel.classList.contains('is-admin') ? head.lastElementChild : null;
		if (actionHead) head.insertBefore(rangeHead, actionHead);
		else head.appendChild(rangeHead);

		const paired = [];
		rows.forEach((row, index) => {
			const item = schedules[index];
			if (!item || !row.isConnected) return;
			const period = document.createElement('span');
			period.className = 'schedule-list-period';
			period.textContent = periodLabel(item);
			period.title = period.textContent;
			const actions = row.querySelector('.schedule-item-actions');
			if (actions) row.insertBefore(period, actions);
			else row.appendChild(period);
			paired.push({ row, item });
		});

		const body = panel.querySelector('.schedule-list-body');
		if (body) {
			paired
				.sort((a, b) => createdTime(b.item) - createdTime(a.item) || Number(b.item?.id || 0) - Number(a.item?.id || 0))
				.forEach(({ row }) => body.appendChild(row));
		}

		const hint = panel.querySelector('.schedule-list-head span');
		if (hint) hint.textContent = language() === 'ko' ? '작성일 최신순 · 내용 · 일정기간' : '登録日の新しい順・内容・予定期間';
	}

	function enhancePicker(picker) {
		if (!(picker instanceof HTMLElement) || picker.dataset[ENHANCED_ATTR] === 'true') return;
		const yearSelect = picker.querySelector('.schedule-calendar-year-select');
		const monthGrid = picker.querySelector('.schedule-calendar-month-grid');
		if (!(yearSelect instanceof HTMLSelectElement) || !(monthGrid instanceof HTMLElement)) return;

		const monthButtons = [...monthGrid.querySelectorAll('.schedule-calendar-month-option')]
			.filter((button) => button instanceof HTMLButtonElement);
		if (monthButtons.length !== 12) return;

		picker.dataset[ENHANCED_ATTR] = 'true';
		const selects = document.createElement('div');
		selects.className = 'schedule-calendar-picker-selects';

		const monthSelect = document.createElement('select');
		monthSelect.className = 'schedule-calendar-month-select';
		monthSelect.setAttribute('aria-label', language() === 'ko' ? '월 선택' : '月を選択');
		const currentMonth = Math.max(0, monthButtons.findIndex((button) => button.classList.contains('is-current')));

		for (let month = 0; month < 12; month += 1) {
			const option = document.createElement('option');
			option.value = String(month);
			option.textContent = language() === 'ko' ? `${month + 1}월` : `${month + 1}月`;
			option.selected = month === currentMonth;
			monthSelect.appendChild(option);
		}

		function applySelection() {
			const month = Number(monthSelect.value);
			if (!Number.isInteger(month) || month < 0 || month > 11) return;
			monthButtons[month]?.click();
		}

		monthSelect.addEventListener('change', applySelection);
		yearSelect.addEventListener('change', applySelection);
		selects.append(yearSelect, monthSelect);
		picker.insertBefore(selects, monthGrid);
		monthGrid.hidden = true;
	}

	function enhanceAll() {
		installStyle();
		document.querySelectorAll('.schedule-calendar-month-picker').forEach(enhancePicker);
		document.querySelectorAll('.schedule-list-panel').forEach((panel) => { void enhanceScheduleList(panel); });
	}

	let queued = false;
	const observer = new MutationObserver(() => {
		if (queued) return;
		queued = true;
		queueMicrotask(() => {
			queued = false;
			enhanceAll();
		});
	});

	function initialize() {
		enhanceAll();
		observer.observe(document.body, { childList: true, subtree: true });
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
