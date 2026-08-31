(() => {
	const COLLAPSE_KEY = 'song_jlpt_section_collapsed_v1';
	let attempts = 0;

	function clearSavedCalendarState() {
		try {
			const state = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}');
			if (!state || typeof state !== 'object' || !Object.prototype.hasOwnProperty.call(state, 'calendar')) return;
			delete state.calendar;
			localStorage.setItem(COLLAPSE_KEY, JSON.stringify(state));
		} catch {
			// Local storage is optional. The calendar still stays usable without it.
		}
	}

	function stabilizeCalendar() {
		const calendar = document.getElementById('jlpt-calendar');
		const card = calendar?.closest('.jlpt-card');
		if (!(calendar instanceof HTMLElement) || !(card instanceof HTMLElement)) return false;
		if (card.dataset.jlptCalendarStable === 'true') return true;

		const sectionBody = card.querySelector(':scope > .jlpt-section-body');
		const wasConverted = card.dataset.jlptSectionKey === 'calendar' || sectionBody instanceof HTMLElement;
		if (!wasConverted) return false;

		const heading = card.querySelector(':scope > .jlpt-card-heading');
		heading?.querySelector('.jlpt-section-toggle')?.remove();

		if (sectionBody instanceof HTMLElement) {
			sectionBody.hidden = false;
			while (sectionBody.firstChild) card.appendChild(sectionBody.firstChild);
			sectionBody.remove();
		}

		calendar.hidden = false;
		card.classList.remove('is-collapsed', 'jlpt-collapsible');
		delete card.dataset.jlptCollapsible;
		delete card.dataset.jlptSectionKey;
		card.dataset.jlptCalendarStable = 'true';
		clearSavedCalendarState();
		return true;
	}

	function initialize() {
		if (stabilizeCalendar()) return;
		const timer = window.setInterval(() => {
			attempts += 1;
			if (stabilizeCalendar() || attempts >= 60) window.clearInterval(timer);
		}, 100);
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
