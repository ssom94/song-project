(() => {
	if (window.JlptTodayFloating || document.getElementById('jlpt-today-floating')) return;
	if (document.querySelector('script[data-jlpt-today-floating]')) return;

	const script = document.createElement('script');
	script.src = '/assets/js/japanese/today-floating.js';
	script.defer = true;
	script.dataset.jlptTodayFloating = 'true';
	document.body.appendChild(script);
})();
