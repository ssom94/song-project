(() => {
	const WIDGET_ID = 'jp-today-study-float';
	const WIDGET_SCRIPT_ATTR = 'data-today-study-float-v5';
	const WIDGET_SRC = '/assets/js/japanese/today-study-float-v3.js';
	const isJlptPage = window.location.pathname.includes('/japanese/jlpt/');

	function loadScript(src, marker) {
		if (document.querySelector(`script[${marker}]`)) return;
		const script = document.createElement('script');
		script.src = src;
		script.async = true;
		script.setAttribute(marker, 'true');
		document.body.appendChild(script);
	}

	function ensureWidget(force = false) {
		if (document.getElementById(WIDGET_ID)) return;
		const existing = document.querySelector(`script[${WIDGET_SCRIPT_ATTR}]`);
		if (existing && !force) return;
		if (existing) existing.remove();

		const script = document.createElement('script');
		const version = force ? `20260908-1-${Date.now()}` : '20260908-1';
		script.src = `${WIDGET_SRC}?v=${version}`;
		script.async = true;
		script.setAttribute(WIDGET_SCRIPT_ATTR, 'true');
		script.addEventListener('error', () => script.remove(), { once: true });
		document.body.appendChild(script);
	}

	// The JLPT page runs in a deliberately small runtime. The floating widget used to
	// bootstrap jlpt-experience, calendar-stability and visitor-mode behind the safe-mode
	// scripts, and the widget itself polled both JLPT/AP dashboards every 30 seconds.
	// Keep all of that off this page; the core dashboard + safe calendar are sufficient.
	if (!isJlptPage) {
		ensureWidget();
		window.setTimeout(() => {
			if (!document.getElementById(WIDGET_ID)) ensureWidget(true);
		}, 900);
		window.setTimeout(() => {
			if (!document.getElementById(WIDGET_ID)) ensureWidget(true);
		}, 2600);
	} else {
		window.__SONG_JLPT_SAFE_RUNTIME__ = true;
	}

	loadScript('/assets/js/shared/category-icons.js?v=20260831-1', 'data-song-category-icon-catalog');
	loadScript('/assets/js/blog/category-appearance-public.js?v=20260831-1', 'data-song-category-appearance-public');
	loadScript('/assets/js/blog/site-cursor.js?v=20260831-1', 'data-song-site-cursor');
})();