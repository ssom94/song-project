(() => {
	if (!window.location.pathname.includes('/japanese/jlpt/')) return;

	const FEATURES = [
		['/assets/js/japanese/jlpt-visitor-mode.js?v=20260908-5', 'data-jlpt-visitor-mode'],
		['/assets/js/japanese/jlpt-history-controls.js?v=20260911-1', 'data-jlpt-history-controls'],
		['/assets/js/japanese/jlpt-pagination-stability.js?v=20260908-1', 'data-jlpt-pagination-stability'],
		['/assets/js/japanese/jlpt-experience.js?v=20260908-4', 'data-jlpt-experience'],
		['/assets/js/japanese/jlpt-page-enhancements.js?v=20260908-4', 'data-jlpt-page-enhancements'],
		['/assets/js/japanese/jlpt-memory-practice.js?v=20260910-2', 'data-jlpt-memory-practice'],
		['/assets/js/japanese/jlpt-date-fixes.js?v=20260911-1', 'data-jlpt-date-fixes'],
		['/assets/js/japanese/jlpt-calendar-stability.js?v=20260908-4', 'data-jlpt-calendar-stability'],
	];
	let started = false;

	function coreSettled() {
		const dday = document.getElementById('jlpt-dday');
		const error = document.getElementById('jlpt-error');
		return Boolean(dday && dday.textContent?.trim() && dday.textContent.trim() !== '—')
			|| Boolean(error && !error.hidden && error.textContent?.trim());
	}

	function waitForCore(timeoutMs = 3500) {
		return new Promise((resolve) => {
			if (coreSettled()) {
				resolve();
				return;
			}
			const startedAt = Date.now();
			const check = () => {
				if (coreSettled() || Date.now() - startedAt >= timeoutMs) {
					resolve();
					return;
				}
				window.setTimeout(check, 100);
			};
			window.setTimeout(check, 100);
		});
	}

	function nextFrame() {
		return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
	}

	function loadFeature(src, marker) {
		return new Promise((resolve) => {
			const existing = document.querySelector(`script[${marker}]`);
			if (existing) {
				resolve();
				return;
			}
			const script = document.createElement('script');
			script.src = src;
			script.async = false;
			script.setAttribute(marker, 'true');
			script.addEventListener('load', resolve, { once: true });
			script.addEventListener('error', () => {
				console.warn(`Failed to load JLPT feature: ${src}`);
				resolve();
			}, { once: true });
			document.body.appendChild(script);
		});
	}

	async function boot() {
		if (started) return;
		started = true;
		await waitForCore();
		for (const [src, marker] of FEATURES) {
			await loadFeature(src, marker);
			await nextFrame();
		}
		window.__SONG_JLPT_FEATURES_READY__ = true;
		window.dispatchEvent(new CustomEvent('song:jlpt:features-ready'));
	}

	function schedule() {
		if ('requestIdleCallback' in window) {
			window.requestIdleCallback(() => void boot(), { timeout: 700 });
		} else {
			window.setTimeout(() => void boot(), 250);
		}
	}

	if (document.readyState === 'complete') schedule();
	else window.addEventListener('load', schedule, { once: true });
})();
