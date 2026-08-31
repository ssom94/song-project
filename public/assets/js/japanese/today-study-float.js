(() => {
	if (!document.getElementById('jp-today-study-float') && !document.querySelector('script[data-today-study-float-v4]')) {
		const script = document.createElement('script');
		script.src = '/assets/js/japanese/today-study-float-v3.js?v=20260831-4';
		script.async = true;
		script.dataset.todayStudyFloatV4 = 'true';
		document.body.appendChild(script);
	}

	if (window.location.pathname.includes('/japanese/jlpt/')) {
		if (!document.querySelector('script[data-jlpt-experience]')) {
			const experience = document.createElement('script');
			experience.src = '/assets/js/japanese/jlpt-experience.js?v=20260831-1';
			experience.async = true;
			experience.dataset.jlptExperience = 'true';
			document.body.appendChild(experience);
		}
		if (!document.querySelector('script[data-jlpt-visitor-mode]')) {
			const visitor = document.createElement('script');
			visitor.src = '/assets/js/japanese/jlpt-visitor-mode.js?v=20260831-1';
			visitor.async = true;
			visitor.dataset.jlptVisitorMode = 'true';
			document.body.appendChild(visitor);
		}
	}
})();
