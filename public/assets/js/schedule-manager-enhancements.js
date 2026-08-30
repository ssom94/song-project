(() => {
	document.addEventListener('click', (event) => {
		for (const wrap of document.querySelectorAll('.schedule-calendar-month-wrap')) {
			if (!(wrap instanceof HTMLElement) || wrap.contains(event.target)) continue;
			const picker = wrap.querySelector('.schedule-calendar-month-picker');
			const button = wrap.querySelector('.schedule-calendar-month-button');
			if (picker instanceof HTMLElement && !picker.hidden) picker.hidden = true;
			if (button instanceof HTMLButtonElement) button.setAttribute('aria-expanded', 'false');
		}
	});
})();
