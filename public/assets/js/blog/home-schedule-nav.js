(() => {
	function sync() {
		const korean = document.body.dataset.blogLanguage === 'ko';
		document.querySelectorAll('[data-schedule-nav]').forEach((link) => {
			link.textContent = korean ? '일정관리' : '予定管理';
			link.setAttribute('aria-label', link.textContent);
		});
	}

	function initialize() {
		sync();
		document.querySelectorAll('[data-home-language]').forEach((button) => {
			button.addEventListener('click', () => window.setTimeout(sync, 0));
		});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
