(() => {
	let currentSession = null;
	let resolveReady;

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

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize, { once: true });
	} else {
		initialize();
	}

	window.AdminCommon = {
		ready,
		getSession: () => currentSession,
		setUserMenuOpen,
	};
})();
