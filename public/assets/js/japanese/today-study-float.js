(() => {
	const WIDGET_ID = 'jp-today-study-float';
	const WIDGET_SCRIPT_ATTR = 'data-today-study-float-v5';
	const WIDGET_SRC = '/assets/js/japanese/today-study-float-v3.js';

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
		const version = force ? `20260910-1-${Date.now()}` : '20260910-1';
		script.src = `${WIDGET_SRC}?v=${version}`;
		script.async = true;
		script.setAttribute(WIDGET_SCRIPT_ATTR, 'true');
		script.addEventListener('error', () => script.remove(), { once: true });
		document.body.appendChild(script);
	}

	// Keep the requested floating study widget on every learning page. JLPT-specific
	// enhancements are booted separately by jlpt-runtime-coordinator so they cannot be
	// inserted twice or all start at the same moment.
	ensureWidget();
	window.setTimeout(() => {
		if (!document.getElementById(WIDGET_ID)) ensureWidget(true);
	}, 900);
	window.setTimeout(() => {
		if (!document.getElementById(WIDGET_ID)) ensureWidget(true);
	}, 2600);

	loadScript('/assets/js/shared/category-icons.js?v=20260831-1', 'data-song-category-icon-catalog');
	loadScript('/assets/js/blog/category-appearance-public.js?v=20260831-1', 'data-song-category-appearance-public');
	loadScript('/assets/js/blog/site-cursor.js?v=20260831-1', 'data-song-site-cursor');
})();
