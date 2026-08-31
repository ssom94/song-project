(() => {
	const COLLAPSE_KEY = 'song_jlpt_section_collapsed_v1';
	let attempts = 0;

	function readState() {
		try {
			const state = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}');
			return state && typeof state === 'object' ? state : {};
		} catch {
			return {};
		}
	}

	function saveCalendarState(collapsed) {
		try {
			const state = readState();
			state.calendar = collapsed;
			localStorage.setItem(COLLAPSE_KEY, JSON.stringify(state));
		} catch {
			// Local storage is optional.
		}
	}

	function language() {
		return document.body?.dataset?.blogLanguage === 'ja' ? 'ja' : 'ko';
	}

	function setSimpleCollapsed(card, calendar, toggle, collapsed, persist = true) {
		calendar.hidden = collapsed;
		card.classList.toggle('is-collapsed', collapsed);
		toggle.setAttribute('aria-expanded', String(!collapsed));
		toggle.setAttribute('aria-label', collapsed
			? (language() === 'ja' ? '展開' : '펼치기')
			: (language() === 'ja' ? '折りたたむ' : '접기'));
		const mark = toggle.querySelector('span');
		if (mark) mark.style.transform = collapsed ? 'rotate(-90deg)' : '';
		if (persist) saveCalendarState(collapsed);
	}

	function mountSimpleToggle(card, calendar) {
		const heading = card.querySelector(':scope > .jlpt-card-heading');
		if (!(heading instanceof HTMLElement)) return;
		heading.querySelector('.jlpt-section-toggle')?.remove();
		const toggle = document.createElement('button');
		toggle.type = 'button';
		toggle.className = 'jlpt-section-toggle';
		toggle.dataset.jlptCalendarToggle = 'true';
		toggle.innerHTML = '<span aria-hidden="true">⌄</span>';
		toggle.addEventListener('click', () => {
			setSimpleCollapsed(card, calendar, toggle, !calendar.hidden);
		});
		heading.appendChild(toggle);
		const stored = readState();
		const collapsed = typeof stored.calendar === 'boolean' ? stored.calendar : false;
		setSimpleCollapsed(card, calendar, toggle, collapsed, false);
	}

	function stabilizeCalendar() {
		const calendar = document.getElementById('jlpt-calendar');
		const card = calendar?.closest('.jlpt-card');
		if (!(calendar instanceof HTMLElement) || !(card instanceof HTMLElement)) return false;
		if (card.dataset.jlptCalendarStable === 'true') return true;

		const sectionBody = card.querySelector(':scope > .jlpt-section-body');
		const wasConverted = card.dataset.jlptSectionKey === 'calendar' || sectionBody instanceof HTMLElement;
		if (!wasConverted) return false;

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
		mountSimpleToggle(card, calendar);
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
