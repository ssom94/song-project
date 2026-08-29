(() => {
	function language() {
		return document.body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
	}

	async function loadSidebarBoards() {
		try {
			const lang = language();
			const response = await fetch(`/api/public/posts?lang=${lang}`, { method: 'GET', cache: 'no-store' });
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok || !Array.isArray(result.posts)) return;
			window.BlogDashboard?.renderCategories?.(result.posts, lang);
		} catch (error) {
			console.warn('Failed to load Japanese module sidebar boards', error);
		}
	}

	function initialize() {
		loadSidebarBoards();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
