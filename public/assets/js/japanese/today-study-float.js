(() => {
	if (document.getElementById('jp-today-study-float')) return;
	if (document.querySelector('script[data-today-study-float-v4]')) return;
	const script = document.createElement('script');
	script.src = '/assets/js/japanese/today-study-float-v3.js?v=20260831-4';
	script.async = true;
	script.dataset.todayStudyFloatV4 = 'true';
	document.body.appendChild(script);
})();
