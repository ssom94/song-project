(() => {
	function loadStyle() {
		if (document.querySelector('link[data-japanese-pagination-style]')) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '/assets/css/admin/japanese-pagination.css';
		link.dataset.japanesePaginationStyle = 'true';
		document.head.appendChild(link);
	}

	function loadScript() {
		if (document.querySelector('script[data-japanese-pagination]')) return;
		const script = document.createElement('script');
		script.src = '/assets/js/admin/japanese-pagination.js';
		script.dataset.japanesePagination = 'true';
		document.body.appendChild(script);
	}

	loadStyle();
	loadScript();
})();
