(() => {
	if (document.getElementById('jp-today-study-float')) return;
	if (document.querySelector('script[data-today-study-float-v3]')) return;
	const script = document.createElement('script');
	script.src = '/assets/js/japanese/today-study-float-v3.js?v=20260831-3';
	script.async = true;
	script.dataset.todayStudyFloatV3 = 'true';
	document.body.appendChild(script);
})();
