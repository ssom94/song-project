(() => {
	const STYLE_ID = 'schedule-calendar-month-select-style';
	const ENHANCED_ATTR = 'monthSelectEnhanced';

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
			@media (max-width: 560px) {
				.schedule-calendar-month-picker[data-month-select-enhanced="true"] .schedule-calendar-picker-selects {
					gap: 6px;
				}
			}
		`;
		document.head.appendChild(style);
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
