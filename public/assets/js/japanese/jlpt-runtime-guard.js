(() => {
	const nativeFetch = window.fetch.bind(window);
	const inflight = new Map();
	const cache = new Map();
	const TTL_BY_PATH = new Map([
		['/api/public/japanese/jlpt/dashboard', 1500],
		['/api/public/ap/dashboard', 1500],
		['/api/admin/auth/session', 5000],
	]);
	const ADMIN_JLPT_PREFIX = '/api/admin/japanese/jlpt/';

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

	async function fetchCached(input, init, url, ttl) {
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
	}

	let authPromise = null;
	function isAuthenticated() {
		if (authPromise) return authPromise;
		authPromise = nativeFetch('/api/admin/auth/session', { credentials: 'same-origin', cache: 'no-store' })
			.then(async (response) => {
				const data = await response.json().catch(() => null);
				return response.ok && data?.authenticated === true;
			})
			.catch(() => false);
		return authPromise;
	}
	window.SongJlptAuth = { isAuthenticated };

	window.fetch = async (input, init) => {
		const url = requestUrl(input);
		const method = requestMethod(input, init);
		if (url?.origin === window.location.origin && method === 'GET' && url.pathname.startsWith(ADMIN_JLPT_PREFIX)) {
			if (!(await isAuthenticated())) {
				return new Response(JSON.stringify({ ok: false, error: 'UNAUTHORIZED' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
				});
			}
		}

		const ttl = url?.origin === window.location.origin ? TTL_BY_PATH.get(url.pathname) : 0;
		if (!ttl || method !== 'GET') return nativeFetch(input, init);
		return fetchCached(input, init, url, ttl);
	};

	window.addEventListener('pagehide', () => {
		cache.clear();
		inflight.clear();
		window.fetch = nativeFetch;
	}, { once: true });
})();
