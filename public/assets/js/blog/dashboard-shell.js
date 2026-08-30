(() => {
	const SIDEBAR_COLLAPSE_KEY = 'song_public_sidebar_collapsed';
	let adminSessionSnapshot = null;

	function byId(id) {
		return document.getElementById(id);
	}

	function closeSidebar() {
		document.body.classList.remove('blog-sidebar-open');
		const backdrop = byId('blog-dashboard-backdrop');
		const toggle = byId('blog-dashboard-menu-toggle');
		if (backdrop) backdrop.hidden = true;
		if (toggle) toggle.setAttribute('aria-expanded', 'false');
	}

	function openSidebar() {
		document.body.classList.add('blog-sidebar-open');
		const backdrop = byId('blog-dashboard-backdrop');
		const toggle = byId('blog-dashboard-menu-toggle');
		if (backdrop) backdrop.hidden = false;
		if (toggle) toggle.setAttribute('aria-expanded', 'true');
	}

	function toggleSidebar() {
		if (document.body.classList.contains('blog-sidebar-open')) closeSidebar();
		else openSidebar();
	}

	function activeCategory() {
		return new URLSearchParams(window.location.search).get('category')?.trim() ?? '';
	}

	function currentLanguage() {
		return document.body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
	}

	function readSidebarCollapsed() {
		try {
			return localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === 'true';
		} catch {
			return false;
		}
	}

	function syncSidebarCollapseToggle() {
		const button = byId('blog-sidebar-collapse-toggle');
		if (!(button instanceof HTMLButtonElement)) return;
		const collapsed = document.body.classList.contains('blog-sidebar-collapsed');
		const korean = currentLanguage() === 'ko';
		button.textContent = collapsed ? '>' : '<';
		button.setAttribute('aria-expanded', String(!collapsed));
		button.setAttribute('aria-label', collapsed
			? (korean ? '메뉴 펼치기' : 'メニューを開く')
			: (korean ? '메뉴 접기' : 'メニューを閉じる'));
		button.title = button.getAttribute('aria-label') ?? '';
	}

	function setSidebarCollapsed(collapsed, persist = true) {
		document.body.classList.toggle('blog-sidebar-collapsed', collapsed);
		if (persist) {
			try {
				localStorage.setItem(SIDEBAR_COLLAPSE_KEY, String(collapsed));
			} catch {
				// Ignore storage errors; the current page state still works.
			}
		}
		syncSidebarCollapseToggle();
	}

	function mountSidebarCollapseToggle() {
		if (!document.querySelector('.blog-dashboard-sidebar')) return;
		let button = byId('blog-sidebar-collapse-toggle');
		if (!(button instanceof HTMLButtonElement)) {
			button = document.createElement('button');
			button.id = 'blog-sidebar-collapse-toggle';
			button.className = 'blog-sidebar-collapse-toggle';
			button.type = 'button';
			button.setAttribute('aria-controls', 'blog-dashboard-sidebar');
			document.body.appendChild(button);
			button.addEventListener('click', () => {
				setSidebarCollapsed(!document.body.classList.contains('blog-sidebar-collapsed'));
			});
		}
		setSidebarCollapsed(readSidebarCollapsed(), false);
	}

	function readStoredStudyMode() {
		try {
			const setup = JSON.parse(sessionStorage.getItem('song_public_japanese_quiz_setup') || 'null');
			if (setup?.studyMode === 'korean') return 'korean';
			const result = JSON.parse(sessionStorage.getItem('song_public_japanese_quiz_result') || 'null');
			if (result?.setup?.studyMode === 'korean') return 'korean';
		} catch {
			// Ignore invalid session data.
		}
		return 'japanese';
	}

	function koreanStudyActive() {
		if (window.location.pathname.includes('/korean/')) return true;
		if (new URLSearchParams(window.location.search).get('study') === 'korean') return true;
		if (window.location.pathname.includes('/japanese/quiz/')) return readStoredStudyMode() === 'korean';
		return false;
	}

	function syncLearningMenu() {
		const language = currentLanguage();
		const menuNav = document.querySelector('.blog-sidebar-section .blog-sidebar-nav');
		if (!menuNav) return;
		let koreanLink = menuNav.querySelector('[data-learning-korean]');
		const japaneseLink = [...menuNav.querySelectorAll('a')].find((link) => link.getAttribute('href')?.includes('/japanese/'));

		if (!(koreanLink instanceof HTMLAnchorElement)) {
			koreanLink = document.createElement('a');
			koreanLink.className = 'blog-sidebar-link';
			koreanLink.dataset.learningKorean = 'true';
			if (japaneseLink) japaneseLink.insertAdjacentElement('afterend', koreanLink);
			else menuNav.appendChild(koreanLink);
		}
		koreanLink.href = `/${language}/korean/`;
		koreanLink.textContent = language === 'ko' ? '한국어 학습' : '韓国語学習';

		const koreanActive = koreanStudyActive();
		koreanLink.classList.toggle('is-active', koreanActive);
		if (japaneseLink instanceof HTMLAnchorElement && koreanActive) japaneseLink.classList.remove('is-active');
	}

	function updateAdminAccessLabel() {
		const link = byId('blog-sidebar-admin-link');
		if (!(link instanceof HTMLAnchorElement)) return;
		const korean = currentLanguage() === 'ko';
		const authenticated = link.dataset.authenticated === 'true';
		link.textContent = authenticated
			? (korean ? '관리자 대시보드' : '管理画面')
			: (korean ? '관리자 로그인' : '管理者ログイン');
		link.href = authenticated ? '/admin/' : '/admin/login/';
		link.setAttribute('aria-label', link.textContent);
	}

	function installPublicAdminUserStyle() {
		if (document.querySelector('link[data-public-admin-user-style]')) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '/assets/css/blog/public-admin-user.css';
		link.dataset.publicAdminUserStyle = 'true';
		document.head.appendChild(link);
	}

	function publicAdminLabels() {
		return currentLanguage() === 'ko'
			? { adminPage: '관리자 페이지', logout: '로그아웃', account: '관리자 계정' }
			: { adminPage: '管理画面', logout: 'ログアウト', account: '管理者アカウント' };
	}

	function closePublicAdminUserMenu() {
		const wrap = byId('blog-public-admin-user');
		const toggle = byId('blog-public-admin-user-toggle');
		const menu = byId('blog-public-admin-user-menu');
		if (menu instanceof HTMLElement) menu.hidden = true;
		if (toggle instanceof HTMLButtonElement) toggle.setAttribute('aria-expanded', 'false');
		wrap?.classList.remove('is-open');
	}

	function syncPublicAdminUserCopy() {
		const labels = publicAdminLabels();
		const toggle = byId('blog-public-admin-user-toggle');
		const adminPage = byId('blog-public-admin-page-link');
		const logout = byId('blog-public-admin-logout');
		if (toggle instanceof HTMLButtonElement) toggle.setAttribute('aria-label', labels.account);
		if (adminPage instanceof HTMLAnchorElement) adminPage.textContent = labels.adminPage;
		if (logout instanceof HTMLButtonElement) logout.textContent = labels.logout;
	}

	async function logoutFromPublicHeader(button) {
		if (button instanceof HTMLButtonElement) button.disabled = true;
		try {
			const response = await fetch('/api/admin/auth/logout', {
				method: 'POST',
				credentials: 'same-origin',
				cache: 'no-store',
			});
			if (!response.ok) throw new Error(`HTTP_${response.status}`);
			window.location.reload();
		} catch (error) {
			console.error('Failed to logout from public header', error);
			if (button instanceof HTMLButtonElement) button.disabled = false;
		}
	}

	function mountPublicAdminUser(sessionResult) {
		const existing = byId('blog-public-admin-user');
		if (!sessionResult?.authenticated || !sessionResult?.admin) {
			existing?.remove();
			adminSessionSnapshot = null;
			return;
		}

		adminSessionSnapshot = sessionResult;
		installPublicAdminUserStyle();
		if (existing) {
			syncPublicAdminUserCopy();
			return;
		}

		const actions = document.querySelector('.blog-dashboard-top-actions');
		if (!(actions instanceof HTMLElement)) return;

		const admin = sessionResult.admin;
		const displayName = String(admin.displayName || admin.username || 'Admin');
		const secondary = String(admin.email || admin.username || '');

		const wrap = document.createElement('div');
		wrap.id = 'blog-public-admin-user';
		wrap.className = 'blog-public-admin-user';

		const toggle = document.createElement('button');
		toggle.id = 'blog-public-admin-user-toggle';
		toggle.className = 'blog-public-admin-user-toggle';
		toggle.type = 'button';
		toggle.setAttribute('aria-haspopup', 'true');
		toggle.setAttribute('aria-expanded', 'false');
		toggle.setAttribute('aria-controls', 'blog-public-admin-user-menu');

		const icon = document.createElement('img');
		icon.className = 'blog-public-admin-user-icon';
		icon.src = '/assets/icons/user.svg';
		icon.alt = '';
		icon.setAttribute('aria-hidden', 'true');

		const name = document.createElement('span');
		name.className = 'blog-public-admin-user-name';
		name.textContent = displayName;

		const chevron = document.createElement('span');
		chevron.className = 'blog-public-admin-user-chevron';
		chevron.setAttribute('aria-hidden', 'true');
		toggle.append(icon, name, chevron);

		const menu = document.createElement('div');
		menu.id = 'blog-public-admin-user-menu';
		menu.className = 'blog-public-admin-user-menu';
		menu.hidden = true;

		const info = document.createElement('div');
		info.className = 'blog-public-admin-user-info';
		const infoName = document.createElement('strong');
		infoName.textContent = displayName;
		const infoSecondary = document.createElement('span');
		infoSecondary.textContent = secondary;
		info.append(infoName, infoSecondary);

		const adminPage = document.createElement('a');
		adminPage.id = 'blog-public-admin-page-link';
		adminPage.className = 'blog-public-admin-user-action';
		adminPage.href = '/admin/';

		const logout = document.createElement('button');
		logout.id = 'blog-public-admin-logout';
		logout.className = 'blog-public-admin-user-action is-logout';
		logout.type = 'button';
		logout.addEventListener('click', () => logoutFromPublicHeader(logout));

		menu.append(info, adminPage, logout);
		wrap.append(toggle, menu);
		actions.appendChild(wrap);

		toggle.addEventListener('click', (event) => {
			event.stopPropagation();
			const open = menu.hidden;
			menu.hidden = !open;
			toggle.setAttribute('aria-expanded', String(open));
			wrap.classList.toggle('is-open', open);
		});
		menu.addEventListener('click', (event) => event.stopPropagation());
		document.addEventListener('click', closePublicAdminUserMenu);
		syncPublicAdminUserCopy();
	}

	async function mountAdminAccess() {
		const footer = document.querySelector('.blog-sidebar-footer');
		let link = byId('blog-sidebar-admin-link');
		if (footer && !(link instanceof HTMLAnchorElement)) {
			link = document.createElement('a');
			link.id = 'blog-sidebar-admin-link';
			link.className = 'blog-sidebar-admin-link';
			link.dataset.authenticated = 'false';
			footer.appendChild(link);
			updateAdminAccessLabel();
		}

		try {
			const response = await fetch('/api/admin/auth/session', {
				method: 'GET',
				credentials: 'same-origin',
				cache: 'no-store',
			});
			const result = await response.json().catch(() => null);
			const authenticated = response.ok && result?.authenticated === true;
			if (link instanceof HTMLAnchorElement) {
				link.dataset.authenticated = authenticated ? 'true' : 'false';
				updateAdminAccessLabel();
			}
			mountPublicAdminUser(authenticated ? result : null);
		} catch (error) {
			console.warn('Failed to check admin session for public shortcut', error);
			mountPublicAdminUser(null);
		}
	}

	function syncHomeModuleLinks() {
		const language = currentLanguage();
		const targets = {
			navJapanese: `/${language}/japanese/`,
			navSkillSheet: `/${language}/skill-sheet/`,
			navCareer: `/${language}/career/`,
		};
		for (const [key, href] of Object.entries(targets)) {
			const link = document.querySelector(`[data-home-text="${key}"]`);
			if (link instanceof HTMLAnchorElement) link.href = href;
		}
		syncLearningMenu();
		updateAdminAccessLabel();
		syncSidebarCollapseToggle();
		if (adminSessionSnapshot) syncPublicAdminUserCopy();
	}

	function renderCategories(posts, language, selectedCategory = '') {
		const container = byId('blog-sidebar-categories');
		const empty = byId('blog-sidebar-categories-empty');
		if (!container) return;
		const counts = new Map();
		for (const post of Array.isArray(posts) ? posts : []) {
			const category = typeof post?.category === 'string' ? post.category.trim() : '';
			if (!category) continue;
			counts.set(category, (counts.get(category) ?? 0) + 1);
		}
		container.replaceChildren();
		const entries = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], language === 'ko' ? 'ko' : 'ja'));
		if (empty) empty.hidden = entries.length > 0;
		const selected = selectedCategory || activeCategory();
		for (const [category, count] of entries) {
			const link = document.createElement('a');
			link.className = 'blog-sidebar-category-link';
			if (selected === category) {
				link.classList.add('is-active');
				link.setAttribute('aria-current', 'page');
			}
			link.href = `/${language}/posts/?category=${encodeURIComponent(category)}`;
			const label = document.createElement('span');
			label.textContent = category;
			const badge = document.createElement('span');
			badge.className = 'blog-sidebar-count';
			badge.textContent = String(count);
			link.append(label, badge);
			container.appendChild(link);
		}
	}

	function initialize() {
		mountSidebarCollapseToggle();
		byId('blog-dashboard-menu-toggle')?.addEventListener('click', toggleSidebar);
		byId('blog-dashboard-backdrop')?.addEventListener('click', closeSidebar);
		document.querySelector('.blog-dashboard-sidebar')?.addEventListener('click', (event) => {
			if (event.target instanceof HTMLAnchorElement && window.matchMedia('(max-width: 840px)').matches) closeSidebar();
		});
		document.querySelectorAll('[data-home-language]').forEach((button) => {
			button.addEventListener('click', () => window.setTimeout(syncHomeModuleLinks, 0));
		});
		document.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') {
				closeSidebar();
				closePublicAdminUserMenu();
			}
		});
		syncHomeModuleLinks();
		mountAdminAccess();
	}

	window.BlogDashboard = {
		closeSidebar,
		renderCategories,
		syncHomeModuleLinks,
		setSidebarCollapsed,
	};

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
