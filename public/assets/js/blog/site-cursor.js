(() => {
	function ensureStyle() {
		if (document.querySelector('link[data-song-site-cursor-style]')) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '/assets/css/blog/site-cursor.css?v=20260831-1';
		link.dataset.songSiteCursorStyle = 'true';
		document.head.appendChild(link);
	}

	function applyCursor(cursor) {
		const root = document.documentElement;
		const enabled = cursor?.enabled === true && window.matchMedia?.('(pointer: fine)').matches;
		const theme = ['blue', 'navy', 'mint'].includes(cursor?.theme) ? cursor.theme : 'blue';
		root.classList.toggle('song-custom-cursor', enabled);
		root.dataset.songCursorTheme = theme;
	}

	async function initialize() {
		ensureStyle();
		try {
			const response = await fetch('/api/public/site-visuals', { method: 'GET', cache: 'no-store', credentials: 'same-origin' });
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error('SITE_VISUALS_LOAD_FAILED');
			applyCursor(result.cursor);
		} catch (error) {
			console.warn('Failed to load site cursor settings', error);
			applyCursor({ enabled: false, theme: 'blue' });
		}
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();