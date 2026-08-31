(() => {
	if (window.SongActionNotice) return;

	let active = null;
	let hideTimer = null;
	let removeTimer = null;

	function language() {
		const adminLanguage = window.AdminI18n?.getLanguage?.();
		if (adminLanguage === 'ko' || adminLanguage === 'ja') return adminLanguage;
		if (document.body?.dataset?.blogLanguage === 'ko') return 'ko';
		return document.documentElement.lang === 'ko' ? 'ko' : 'ja';
	}

	function messages() {
		return language() === 'ko'
			? {
				saved: '저장되었습니다.',
				updated: '수정되었습니다.',
				deleted: '삭제되었습니다.',
				changed: '변경되었습니다.',
			}
			: {
				saved: '保存しました。',
				updated: '更新しました。',
				deleted: '削除しました。',
				changed: '変更しました。',
			};
	}

	function ensureStyles() {
		if (document.querySelector('link[data-song-action-notice-style]')) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '/assets/css/action-notice.css';
		link.dataset.songActionNoticeStyle = 'true';
		document.head.appendChild(link);
	}

	function clearTimers() {
		if (hideTimer) window.clearTimeout(hideTimer);
		if (removeTimer) window.clearTimeout(removeTimer);
		hideTimer = null;
		removeTimer = null;
	}

	function removeActive() {
		clearTimers();
		active?.remove();
		active = null;
	}

	function show(message, options = {}) {
		const text = String(message ?? '').trim();
		if (!text) return;
		ensureStyles();
		removeActive();

		const duration = Number.isFinite(Number(options.duration))
			? Math.max(800, Math.min(10000, Number(options.duration)))
			: 3000;

		const layer = document.createElement('div');
		layer.className = 'song-action-notice-layer';
		layer.setAttribute('aria-live', 'polite');
		layer.setAttribute('aria-atomic', 'true');

		const notice = document.createElement('div');
		notice.className = 'song-action-notice';
		notice.setAttribute('role', 'status');

		const icon = document.createElement('span');
		icon.className = 'song-action-notice-icon';
		icon.setAttribute('aria-hidden', 'true');
		icon.textContent = '✓';

		const label = document.createElement('span');
		label.className = 'song-action-notice-text';
		label.textContent = text;

		notice.append(icon, label);
		layer.appendChild(notice);
		document.body.appendChild(layer);
		active = layer;

		requestAnimationFrame(() => notice.classList.add('is-visible'));

		hideTimer = window.setTimeout(() => {
			notice.classList.remove('is-visible');
			removeTimer = window.setTimeout(() => {
				if (active === layer) active = null;
				layer.remove();
			}, 220);
		}, duration);
	}

	function saved() { show(messages().saved); }
	function updated() { show(messages().updated); }
	function deleted() { show(messages().deleted); }
	function changed() { show(messages().changed); }

	function requestInfo(input, init) {
		let urlValue = '';
		let method = init?.method;
		if (input instanceof Request) {
			urlValue = input.url;
			method ||= input.method;
		} else {
			urlValue = String(input ?? '');
		}
		try {
			return {
				url: new URL(urlValue, window.location.href),
				method: String(method || 'GET').toUpperCase(),
			};
		} catch {
			return null;
		}
	}

	function shouldWatch(url, method) {
		if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) return false;
		if (url.origin !== window.location.origin) return false;
		if (!url.pathname.startsWith('/api/admin/')) return false;
		if (url.pathname.startsWith('/api/admin/auth/')) return false;
		if (url.pathname.startsWith('/api/admin/japanese/quiz/')) return false;
		return true;
	}

	function noticeFor(url, method) {
		if (method === 'DELETE' || url.pathname.includes('bulk-delete')) {
			deleted();
			return;
		}
		if (method === 'PATCH' || method === 'PUT') {
			updated();
			return;
		}
		if (url.pathname.endsWith('/revoke')) {
			changed();
			return;
		}
		saved();
	}

	async function responseSucceeded(response) {
		if (!response.ok) return false;
		const contentType = response.headers.get('content-type') || '';
		if (!contentType.includes('application/json')) return true;
		try {
			const data = await response.clone().json();
			return data?.ok !== false;
		} catch {
			return true;
		}
	}

	function installFetchObserver() {
		if (window.__songActionNoticeFetchWrapped) return;
		window.__songActionNoticeFetchWrapped = true;
		const nativeFetch = window.fetch.bind(window);

		window.fetch = async function songActionNoticeFetch(input, init) {
			const info = requestInfo(input, init);
			const response = await nativeFetch(input, init);
			if (info && shouldWatch(info.url, info.method)) {
				void responseSucceeded(response).then((success) => {
					if (success) noticeFor(info.url, info.method);
				});
			}
			return response;
		};
	}

	ensureStyles();
	installFetchObserver();

	window.SongActionNotice = {
		show,
		saved,
		updated,
		deleted,
		changed,
	};
})();
