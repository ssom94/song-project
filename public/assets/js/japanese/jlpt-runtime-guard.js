(() => {
	const nativeFetch = window.fetch.bind(window);
	const inflight = new Map();
	const cache = new Map();
	const TTL_BY_PATH = new Map([
		['/api/public/japanese/jlpt/dashboard', 1500],
		['/api/public/ap/dashboard', 1500],
		['/api/admin/auth/session', 1000],
	]);

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

	window.fetch = async (input, init) => {
		const url = requestUrl(input);
		const ttl = url?.origin === window.location.origin ? TTL_BY_PATH.get(url.pathname) : 0;
		if (!ttl || requestMethod(input, init) !== 'GET') return nativeFetch(input, init);

		const key = `${url.pathname}${url.search}`;
		const now = Date.now();
		const cached = cache.get(key);
		if (cached && cached.expiresAt > now) return cached.response.clone();
		if (cached) cache.delete(key);

		let pending = inflight.get(key);
		if (!pending) {
			pending = nativeFetch(input, init)
				.then((response) => {
					const template = response.clone();
					if (response.ok) cache.set(key, { expiresAt: Date.now() + ttl, response: template.clone() });
					return template;
				})
				.finally(() => inflight.delete(key));
			inflight.set(key, pending);
		}
		return (await pending).clone();
	};

	window.addEventListener('pagehide', () => {
		cache.clear();
		inflight.clear();
		window.fetch = nativeFetch;
	}, { once: true });
})();
