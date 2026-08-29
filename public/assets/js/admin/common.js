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

	function translateConfirmElement(element, key, fallback) {
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

	function confirmDialog({
		titleKey,
		messageKey,
		confirmKey = 'confirmYes',
		cancelKey = 'confirmNo',
		titleFallback = 'Confirm',
		messageFallback = '',
		confirmFallback = 'Yes',
		cancelFallback = 'No',
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
			dialog.setAttribute('role', 'dialog');
			dialog.setAttribute('aria-modal', 'true');

			const titleId = `admin-confirm-title-${Date.now()}`;
			const messageId = `admin-confirm-message-${Date.now()}`;
			dialog.setAttribute('aria-labelledby', titleId);
			dialog.setAttribute('aria-describedby', messageId);

			const title = document.createElement('h2');
			title.id = titleId;
			translateConfirmElement(title, titleKey, titleFallback);

			const message = document.createElement('p');
			message.id = messageId;
			translateConfirmElement(message, messageKey, messageFallback);

			const actions = document.createElement('div');
			actions.className = 'admin-confirm-modal-actions';

			const cancelButton = document.createElement('button');
			cancelButton.type = 'button';
			cancelButton.className = 'admin-confirm-modal-button';
			translateConfirmElement(cancelButton, cancelKey, cancelFallback);

			const confirmButton = document.createElement('button');
			confirmButton.type = 'button';
			confirmButton.className = 'admin-confirm-modal-button admin-confirm-modal-button-primary';
			translateConfirmElement(confirmButton, confirmKey, confirmFallback);

			actions.append(cancelButton, confirmButton);
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

			cancelButton.addEventListener('click', () => finish(false));
			confirmButton.addEventListener('click', () => finish(true));
			root.addEventListener('click', (event) => {
				if (event.target === root) finish(false);
			});
			document.addEventListener('keydown', handleKeydown);

			activeConfirm = { root, finish };
			requestAnimationFrame(() => confirmButton.focus());
		});
	}

	async function initializeAdmin() {
		const loading = document.getElementById('admin-loading');
		const shell = document.getElementById('admin-shell');

		bindUserMenu();
		bindLogout();

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

	document.addEventListener('adminlanguagechange', refreshActiveConfirmLanguage);

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
	};
})();
