(() => {
	function loadScript(src, marker) {
		if (document.querySelector(`script[${marker}]`)) return;
		const script = document.createElement('script');
		script.src = src;
		script.async = true;
		script.setAttribute(marker, 'true');
		document.body.appendChild(script);
	}

	if (!document.getElementById('jp-today-study-float') && !document.querySelector('script[data-today-study-float-v4]')) {
		const script = document.createElement('script');
		script.src = '/assets/js/japanese/today-study-float-v3.js?v=20260831-4';
		script.async = true;
		script.dataset.todayStudyFloatV4 = 'true';
		document.body.appendChild(script);
	}

	loadScript('/assets/js/shared/category-icons.js?v=20260831-1', 'data-song-category-icon-catalog');
	loadScript('/assets/js/blog/category-appearance-public.js?v=20260831-1', 'data-song-category-appearance-public');
	loadScript('/assets/js/blog/site-cursor.js?v=20260831-1', 'data-song-site-cursor');

	if (window.location.pathname.includes('/japanese/jlpt/')) {
		if (!document.querySelector('script[data-jlpt-experience]')) {
			const experience = document.createElement('script');
			experience.src = '/assets/js/japanese/jlpt-experience.js?v=20260831-1';
			experience.async = true;
			experience.dataset.jlptExperience = 'true';
			document.body.appendChild(experience);
		}
		loadScript('/assets/js/japanese/jlpt-calendar-stability.js?v=20260831-1', 'data-jlpt-calendar-stability');
		if (!document.querySelector('script[data-jlpt-visitor-mode]')) {
			const visitor = document.createElement('script');
			visitor.src = '/assets/js/japanese/jlpt-visitor-mode.js?v=20260831-1';
			visitor.async = true;
			visitor.dataset.jlptVisitorMode = 'true';
			document.body.appendChild(visitor);
		}
	}
})();