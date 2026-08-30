(() => {
	let currentSession = null;
	let resolveReady;
	let activeConfirm = null;

	const ready = new Promise((resolve) => {
		resolveReady = resolve;
	});

	function setUserMenuOpen(open) {
		const toggle = document.getElementById('admin-user-toggle');
		const menu = document.getElementById('admin-user-menu');
		if (!toggle || !menu) return;

		menu.hidden = !open;
		toggle.setAttribute('aria-expanded', String(open));
	}

	function bindUserMenu() {
		const toggle = document.getElementById('admin-user-toggle');
		const menu = document.getElementById('admin-user-menu');
		if (!toggle || !menu) return;

		toggle.addEventListener('click', () => {
			setUserMenuOpen(menu.hidden);
		});

		document.addEventListener('click', (event) => {
			if (!event.target.closest('.admin-user-menu-wrap')) {
				setUserMenuOpen(false);
			}
		});

		document.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && !menu.hidden) {
				setUserMenuOpen(false);
				toggle.focus();
			}
		});
	}

	function bindLogout() {
		const logoutButton = document.getElementById('admin-logout');
		if (!logoutButton) return;

		logoutButton.addEventListener('click', async () => {
			logoutButton.disabled = true;
			logoutButton.textContent = window.AdminI18n?.t('logoutLoading') ?? 'ログアウト中…';

			try {
				await fetch('/api/admin/auth/logout', {
					method: 'POST',
					credentials: 'same-origin',
					headers: { 'Content-Type': 'application/json' },
				});
			} finally {
				window.location.replace('/admin/login/');
			}
		});
	}

	function renderAdminIdentity(admin) {
		const displayName = admin.displayName ?? admin.username;
		const user = document.getElementById('admin-user');
		const menuName = document.getElementById('admin-user-menu-name');
		const menuEmail = document.getElementById('admin-user-menu-email');

		if (user) user.textContent = displayName;
		if (menuName) menuName.textContent = displayName;
		if (menuEmail) menuEmail.textContent = admin.email ?? '';
	}

	async function fetchAdminSession() {
		const response = await fetch('/api/admin/auth/session', {
			method: 'GET',
			credentials: 'same-origin',
			cache: 'no-store',
		});

		if (!response.ok) return null;

		const data = await response.json();
		return data.authenticated ? data : null;
	}

	function ensureModalStyles() {
		if (document.getElementById('admin-modal-stylesheet')) return;

		const link = document.createElement('link');
		link.id = 'admin-modal-stylesheet';
		link.rel = 'stylesheet';
		link.href = '/assets/css/admin/modal.css';
		document.head.appendChild(link);
	}

	function ensureNavigationStyles() {
		if (document.getElementById('admin-navigation-stylesheet')) return;
		const link = document.createElement('link');
		link.id = 'admin-navigation-stylesheet';
		link.rel = 'stylesheet';
		link.href = '/assets/css/admin/navigation.css';
		document.head.appendChild(link);
	}

	function adminBackConfig() {
		const segments = window.location.pathname.split('/').filter(Boolean);
		if (segments[0] !== 'admin' || segments.length < 3 || segments[1] === 'login') return null;
		return {
			fallback: `/${segments.slice(0, -1).join('/')}/`,
			postContext: segments[1] === 'posts' && ['new', 'edit'].includes(segments[2]),
		};
	}

	function backLabel() {
		return window.AdminI18n?.getLanguage?.() === 'ko' ? '뒤로가기' : '戻る';
	}

	function goBackOrFallback(fallback) {
		try {
			const referrer = document.referrer ? new URL(document.referrer) : null;
			if (
				referrer
				&& referrer.origin === window.location.origin
				&& referrer.pathname !== window.location.pathname
				&& !referrer.pathname.startsWith('/admin/login')
			) {
				window.history.back();
				return;
			}
		} catch (error) {
			console.warn('Failed to resolve admin referrer', error);
		}
		window.location.assign(fallback);
	}

	function refreshBackLabel() {
		const label = document.querySelector('.admin-page-back-label');
		if (label) label.textContent = backLabel();
	}

	function loadPostContextScript() {
		if (document.getElementById('admin-post-context-script')) return;
		const script = document.createElement('script');
		script.id = 'admin-post-context-script';
		script.src = '/assets/js/admin/post-context.js';
		document.body.appendChild(script);
	}

	function mountPageContext() {
		const config = adminBackConfig();
		const content = document.querySelector('.admin-content');
		if (!config || !content || document.getElementById('admin-page-context-row')) return;

		ensureNavigationStyles();

		const row = document.createElement('div');
		row.id = 'admin-page-context-row';
		row.className = 'admin-page-context-row';

		const back = document.createElement('button');
		back.type = 'button';
		back.className = 'admin-page-back-button';
		back.setAttribute('aria-label', backLabel());

		const arrow = document.createElement('span');
		arrow.className = 'admin-page-back-arrow';
		arrow.setAttribute('aria-hidden', 'true');
		arrow.textContent = '←';

		const label = document.createElement('span');
		label.className = 'admin-page-back-label';
		label.textContent = backLabel();
		back.append(arrow, label);
		back.addEventListener('click', () => goBackOrFallback(config.fallback));
		row.appendChild(back);

		if (config.postContext) {
			const taxonomy = document.createElement('span');
			taxonomy.id = 'admin-page-taxonomy';
			taxonomy.className = 'admin-page-taxonomy';
			taxonomy.hidden = true;
			row.appendChild(taxonomy);
			loadPostContextScript();
		}

		content.prepend(row);
		document.querySelectorAll('.admin-editor-back-link, .admin-quiz-play-exit, .admin-quiz-result-back').forEach((element) => element.remove());
	}

	function translateModalElement(element, key, fallback) {
		element.dataset.i18nKey = key;
		element.dataset.i18nFallback = fallback;
		element.textContent = window.AdminI18n?.t(key) ?? fallback;
	}

	function refreshActiveConfirmLanguage() {
		if (!activeConfirm) return;

		activeConfirm.root.querySelectorAll('[data-i18n-key]').forEach((element) => {
			const key = element.dataset.i18nKey;
			const fallback = element.dataset.i18nFallback ?? '';
			if (key) element.textContent = window.AdminI18n?.t(key) ?? fallback;
		});
	}

	function createModal({
		titleKey,
		messageKey,
		titleFallback = 'Confirm',
		messageFallback = '',
		confirmKey = 'confirmYes',
		confirmFallback = 'Yes',
		cancelKey = 'confirmNo',
		cancelFallback = 'No',
		showCancel = true,
	} = {}) {
		ensureModalStyles();

		if (activeConfirm) {
			activeConfirm.finish(false);
		}

		return new Promise((resolve) => {
			const previouslyFocused = document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;

			const root = document.createElement('div');
			root.className = 'admin-confirm-modal-backdrop';

			const dialog = document.createElement('section');
			dialog.className = 'admin-confirm-modal';
			dialog.setAttribute('role', showCancel ? 'dialog' : 'alertdialog');
			dialog.setAttribute('aria-modal', 'true');

			const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
			const titleId = `admin-confirm-title-${uniqueId}`;
			const messageId = `admin-confirm-message-${uniqueId}`;
			dialog.setAttribute('aria-labelledby', titleId);
			dialog.setAttribute('aria-describedby', messageId);

			const title = document.createElement('h2');
			title.id = titleId;
			translateModalElement(title, titleKey, titleFallback);

			const message = document.createElement('p');
			message.id = messageId;
			translateModalElement(message, messageKey, messageFallback);

			const actions = document.createElement('div');
			actions.className = 'admin-confirm-modal-actions';

			let cancelButton = null;
			if (showCancel) {
				cancelButton = document.createElement('button');
				cancelButton.type = 'button';
				cancelButton.className = 'admin-confirm-modal-button';
				translateModalElement(cancelButton, cancelKey, cancelFallback);
				actions.appendChild(cancelButton);
			}

			const confirmButton = document.createElement('button');
			confirmButton.type = 'button';
			confirmButton.className = 'admin-confirm-modal-button admin-confirm-modal-button-primary';
			translateModalElement(confirmButton, confirmKey, confirmFallback);
			actions.appendChild(confirmButton);

			dialog.append(title, message, actions);
			root.appendChild(dialog);
			document.body.appendChild(root);
			document.body.classList.add('admin-modal-open');

			function finish(result) {
				if (!root.isConnected) return;
				root.remove();
				document.body.classList.remove('admin-modal-open');
				document.removeEventListener('keydown', handleKeydown);
				if (activeConfirm?.root === root) activeConfirm = null;
				previouslyFocused?.focus({ preventScroll: true });
				resolve(result);
			}

			function handleKeydown(event) {
				if (event.key === 'Escape') {
					event.preventDefault();
					finish(false);
				}
			}

			cancelButton?.addEventListener('click', () => finish(false));
			confirmButton.addEventListener('click', () => finish(true));
			root.addEventListener('click', (event) => {
				if (event.target === root) finish(false);
			});
			document.addEventListener('keydown', handleKeydown);

			activeConfirm = { root, finish };
			requestAnimationFrame(() => confirmButton.focus());
		});
	}

	function confirmDialog(options = {}) {
		return createModal({ ...options, showCancel: true });
	}

	async function alertDialog(options = {}) {
		await createModal({
			confirmKey: 'modalClose',
			confirmFallback: 'Close',
			...options,
			showCancel: false,
		});
	}

	async function initializeAdmin() {
		const loading = document.getElementById('admin-loading');
		const shell = document.getElementById('admin-shell');

		bindUserMenu();
		bindLogout();
		mountPageContext();

		try {
			const data = await fetchAdminSession();
			if (!data) {
				resolveReady(null);
				window.location.replace('/admin/login/');
				return;
			}

			await Promise.allSettled([
				window.AdminI18n?.ready,
				window.AdminMenu?.ready,
			]);

			currentSession = data;
			renderAdminIdentity(data.admin);
			refreshBackLabel();
			if (loading) loading.hidden = true;
			if (shell) shell.hidden = false;

			document.dispatchEvent(new CustomEvent('adminready', {
				detail: data,
			}));
			resolveReady(data);
		} catch (error) {
			console.error('Failed to initialize admin page', error);
			resolveReady(null);
			window.location.replace('/admin/login/');
		}
	}

	function initialize() {
		initializeAdmin();
	}

	document.addEventListener('adminlanguagechange', () => {
		refreshActiveConfirmLanguage();
		refreshBackLabel();
	});

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize, { once: true });
	} else {
		initialize();
	}

	window.AdminCommon = {
		ready,
		getSession: () => currentSession,
		setUserMenuOpen,
		confirm: confirmDialog,
		alert: alertDialog,
		mountPageContext,
	};
})();
