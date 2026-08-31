(() => {
	const STORAGE_KEY = 'song_admin_sidebar_collapsed';
	const MOBILE_MEDIA = window.matchMedia('(max-width: 720px)');

	let shell;
	let toggle;
	let sidebar;
	let backdrop;
	let desktopCollapsed = false;

	function loadActionNotice() {
		if (window.SongActionNotice || document.querySelector('script[data-song-action-notice]')) return;
		const script = document.createElement('script');
		script.src = '/assets/js/action-notice.js';
		script.async = false;
		script.dataset.songActionNotice = 'true';
		document.head.appendChild(script);
	}

	function readDesktopCollapsed() {
		try {
			return localStorage.getItem(STORAGE_KEY) === 'true';
		} catch {
			return false;
		}
	}

	function storeDesktopCollapsed(value) {
		try {
			localStorage.setItem(STORAGE_KEY, String(value));
		} catch {
			// Keep the current state even when browser storage is unavailable.
		}
	}

	function isMobile() {
		return MOBILE_MEDIA.matches;
	}

	function isSidebarOpen() {
		if (isMobile()) {
			return shell.classList.contains('is-mobile-sidebar-open');
		}
		return !shell.classList.contains('is-sidebar-collapsed');
	}

	function updateToggleAccessibility() {
		const open = isSidebarOpen();
		toggle.setAttribute('aria-expanded', String(open));
		toggle.dataset.i18nAriaLabel = open ? 'menuCloseLabel' : 'menuOpenLabel';

		if (window.AdminI18n) {
			toggle.setAttribute('aria-label', window.AdminI18n.t(toggle.dataset.i18nAriaLabel));
		}
	}

	function closeMobileSidebar() {
		shell.classList.remove('is-mobile-sidebar-open');
		backdrop.hidden = true;
		updateToggleAccessibility();
	}

	function applyResponsiveState() {
		if (isMobile()) {
			shell.classList.remove('is-sidebar-collapsed');
			closeMobileSidebar();
			return;
		}

		shell.classList.remove('is-mobile-sidebar-open');
		backdrop.hidden = true;
		shell.classList.toggle('is-sidebar-collapsed', desktopCollapsed);
		updateToggleAccessibility();
	}

	function toggleSidebar() {
		if (isMobile()) {
			const nextOpen = !shell.classList.contains('is-mobile-sidebar-open');
			shell.classList.toggle('is-mobile-sidebar-open', nextOpen);
			backdrop.hidden = !nextOpen;
			updateToggleAccessibility();
			return;
		}

		desktopCollapsed = !shell.classList.contains('is-sidebar-collapsed');
		shell.classList.toggle('is-sidebar-collapsed', desktopCollapsed);
		storeDesktopCollapsed(desktopCollapsed);
		updateToggleAccessibility();
	}

	function initialize() {
		shell = document.getElementById('admin-shell');
		toggle = document.getElementById('admin-sidebar-toggle');
		sidebar = document.getElementById('admin-sidebar');
		backdrop = document.getElementById('admin-sidebar-backdrop');

		if (!shell || !toggle || !sidebar || !backdrop) return;

		desktopCollapsed = readDesktopCollapsed();
		applyResponsiveState();

		toggle.addEventListener('click', toggleSidebar);
		backdrop.addEventListener('click', closeMobileSidebar);

		sidebar.addEventListener('click', (event) => {
			if (isMobile() && event.target.closest('a')) {
				closeMobileSidebar();
			}
		});

		document.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && isMobile() && shell.classList.contains('is-mobile-sidebar-open')) {
				closeMobileSidebar();
				toggle.focus();
			}
		});

		document.addEventListener('adminlanguagechange', updateToggleAccessibility);
		MOBILE_MEDIA.addEventListener('change', applyResponsiveState);
	}

	loadActionNotice();

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize, { once: true });
	} else {
		initialize();
	}
})();
