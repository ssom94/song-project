(() => {
	const TODAY_PATH = '/api/admin/japanese/jlpt/today';
	const nativeFetch = window.fetch.bind(window);
	let locked = true;

	function requestUrl(input) {
		try {
			const value = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
			return new URL(value || '', window.location.href);
		} catch {
			return null;
		}
	}

	function requestMethod(input, init) {
		return String(init?.method || input?.method || 'GET').toUpperCase();
	}

	function unlock() {
		if (!locked) return;
		locked = false;
		window.fetch = nativeFetch;
	}

	window.fetch = (input, init) => {
		const url = requestUrl(input);
		if (locked && url?.origin === window.location.origin && url.pathname === TODAY_PATH && requestMethod(input, init) === 'GET') {
			return Promise.resolve(new Response(JSON.stringify({ ok: false, error: 'JLPT_TODAY_LAZY_LOAD' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
			}));
		}
		return nativeFetch(input, init);
	};

	// Unlock before the core dashboard's click handler runs. From this point onward all
	// normal today/detail requests are allowed, including state/progress refreshes.
	document.addEventListener('click', (event) => {
		const target = event.target instanceof Element ? event.target.closest('#jlpt-start-button') : null;
		if (target) unlock();
	}, true);

	window.addEventListener('pagehide', unlock, { once: true });
})();