(() => {
	const SIDEBAR_COLLAPSE_KEY = 'song_public_sidebar_collapsed';
	const SIDEBAR_OPEN_GROUP_KEY = 'song_public_sidebar_open_group_v2';
	let adminSessionSnapshot = null;

	function byId(id) {
		return document.getElementById(id);
	}

	function currentLanguage() {
		return document.body?.dataset?.blogLanguage === 'ko' ? 'ko' : 'ja';
	}

	function t(ko, ja) {
		return currentLanguage() === 'ko' ? ko : ja;
	}

	function readStorage(key) {
		try { return localStorage.getItem(key); } catch { return null; }
	}

	function writeStorage(key, value) {
		try { localStorage.setItem(key, value); } catch { /* optional */ }
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

	function readSidebarCollapsed() {
		return readStorage(SIDEBAR_COLLAPSE_KEY) === 'true';
	}

	function syncSidebarCollapseToggle() {
		const button = byId('blog-sidebar-collapse-toggle');
		if (!(button instanceof HTMLButtonElement)) return;
		const collapsed = document.body.classList.contains('blog-sidebar-collapsed');
		button.textContent = collapsed ? '>' : '<';
		button.setAttribute('aria-expanded', String(!collapsed));
		button.setAttribute('aria-label', collapsed ? t('메뉴 펼치기', 'メニューを開く') : t('메뉴 접기', 'メニューを閉じる'));
		button.title = button.getAttribute('aria-label') ?? '';
	}

	function setSidebarCollapsed(collapsed, persist = true) {
		document.body.classList.toggle('blog-sidebar-collapsed', collapsed);
		if (persist) writeStorage(SIDEBAR_COLLAPSE_KEY, String(collapsed));
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
			button.addEventListener('click', () => setSidebarCollapsed(!document.body.classList.contains('blog-sidebar-collapsed')));
		}
		setSidebarCollapsed(readSidebarCollapsed(), false);
	}

	function readStoredStudyMode() {
		try {
			const setup = JSON.parse(sessionStorage.getItem('song_public_japanese_quiz_setup') || 'null');
			if (setup?.studyMode === 'korean') return 'korean';
			const result = JSON.parse(sessionStorage.getItem('song_public_japanese_quiz_result') || 'null');
			if (result?.setup?.studyMode === 'korean') return 'korean';
		} catch { /* ignore invalid session data */ }
		return 'japanese';
	}

	function koreanStudyActive() {
		const path = window.location.pathname;
		if (path.includes('/korean/')) return true;
		if (new URLSearchParams(window.location.search).get('study') === 'korean') return true;
		if (path.includes('/japanese/quiz/')) return readStoredStudyMode() === 'korean';
		return false;
	}

	function groupIsActive(key) {
		const path = window.location.pathname;
		const lang = currentLanguage();
		if (key === 'home') return path === '/' || path === `/${lang}/`;
		if (key === 'posts') return path.includes('/posts/');
		if (key === 'japanese') return path.includes('/japanese/') && !koreanStudyActive();
		if (key === 'korean') return koreanStudyActive();
		if (key === 'ap') return path.includes('/study/ap/');
		if (key === 'certifications') return path.includes('/certifications/');
		if (key === 'skills') return path.includes('/skill-sheet/');
		if (key === 'career') return path.includes('/career/') || path.startsWith('/protected');
		return false;
	}

	function menuDefinitions() {
		const lang = currentLanguage();
		const ko = lang === 'ko';
		const prefix = `/${lang}`;
		const korean = koreanStudyActive();
		const path = window.location.pathname;
		const hash = window.location.hash;
		return [
			{ key: 'home', label: ko ? '홈' : 'ホーム', href: '/' },
			{
				key: 'posts', label: ko ? '게시판' : '掲示板', href: `${prefix}/posts/`,
				children: [
					{ label: ko ? '전체 게시글' : '全投稿', href: `${prefix}/posts/`, active: () => path.includes('/posts/') && !activeCategory() },
				],
				dynamicCategories: true,
			},
			{
				key: 'japanese', label: ko ? '일본어 학습' : '日本語学習', href: `${prefix}/japanese/`,
				children: [
					{ label: ko ? '학습 홈' : '学習ホーム', href: `${prefix}/japanese/`, active: () => path === `${prefix}/japanese/` },
					{ label: 'JLPT N1', href: `${prefix}/japanese/jlpt/`, active: () => path.includes('/japanese/jlpt/') },
					{ label: ko ? '예문 독해' : '例文読解', href: `${prefix}/japanese/examples/`, active: () => path.includes('/japanese/examples/') },
					{ label: ko ? '단어 목록' : '単語一覧', href: `${prefix}/japanese/words/`, active: () => path.includes('/japanese/words/') && !korean },
					{ label: ko ? '랜덤 퀴즈' : 'ランダムクイズ', href: `${prefix}/japanese/quiz/`, active: () => path.includes('/japanese/quiz/') && !path.includes('/result/') && !korean },
					{ label: ko ? '학습 결과' : '学習結果', href: `${prefix}/japanese/quiz/result/`, active: () => path.includes('/japanese/quiz/result/') && !korean },
				],
			},
			{
				key: 'korean', label: ko ? '한국어 학습' : '韓国語学習', href: `${prefix}/korean/`,
				children: [
					{ label: ko ? '학습 홈' : '学習ホーム', href: `${prefix}/korean/`, active: () => path.includes('/korean/') },
					{ label: ko ? '단어 학습' : '単語学習', href: `${prefix}/japanese/words/?study=korean`, active: () => path.includes('/japanese/words/') && korean },
					{ label: ko ? '랜덤 퀴즈' : 'ランダムクイズ', href: `${prefix}/japanese/quiz/?study=korean`, active: () => path.includes('/japanese/quiz/') && !path.includes('/result/') && korean },
					{ label: ko ? '학습 결과' : '学習結果', href: `${prefix}/japanese/quiz/result/?study=korean`, active: () => path.includes('/japanese/quiz/result/') && korean },
				],
			},
			{
				key: 'ap', label: ko ? 'AP 학습' : 'AP 学習', href: `${prefix}/study/ap/`,
				children: [
					{ label: ko ? 'AP 학습 홈' : 'AP 学習ホーム', href: `${prefix}/study/ap/`, active: () => path === `${prefix}/study/ap/` && !hash },
					{ label: ko ? '오늘의 학습' : '今日の学習', href: `${prefix}/study/ap/#ap-today`, active: () => path === `${prefix}/study/ap/` && hash === '#ap-today' },
					{ label: ko ? 'AP 개념정리' : 'AP 概念整理', href: `${prefix}/study/ap/concepts/`, active: () => path.includes('/study/ap/concepts/') },
					{ label: ko ? '기술 일본어 단어' : '技術日本語単語', href: `${prefix}/study/ap/vocabulary/`, active: () => path.includes('/study/ap/vocabulary/') && !path.includes('/wrong/') },
					{ label: ko ? '오답 노트' : '誤答ノート', href: `${prefix}/study/ap/vocabulary/wrong/`, active: () => path.includes('/study/ap/vocabulary/wrong/') },
					{ label: ko ? '학습 이력' : '学習履歴', href: `${prefix}/study/ap/#ap-history`, active: () => path === `${prefix}/study/ap/` && hash === '#ap-history' },
				],
			},
			{
				key: 'certifications', label: ko ? '자격증·시험' : '資格・試験', href: `${prefix}/certifications/`,
				children: [
					{ label: ko ? '전체 자격증' : '資格一覧', href: `${prefix}/certifications/`, active: () => path.includes('/certifications/') },
				],
			},
			{
				key: 'skills', label: ko ? '스킬표' : 'スキルシート', href: `${prefix}/skill-sheet/`,
				children: [
					{ label: ko ? '스킬표 보기' : 'スキルシートを見る', href: `${prefix}/skill-sheet/`, active: () => path.includes('/skill-sheet/') },
				],
			},
			{
				key: 'career', label: ko ? '경력·직무경력서' : '経歴・職務経歴書', href: `${prefix}/career/`,
				children: [
					{ label: ko ? '경력 요약' : '経歴概要', href: `${prefix}/career/`, active: () => path.includes('/career/') },
					{ label: ko ? '상세 직무경력서' : '詳細職務経歴書', href: `/protected/?lang=${lang}`, active: () => path.startsWith('/protected') },
				],
			},
		];
	}

	function mountUnifiedSidebarStyle() {
		if (document.querySelector('link[data-unified-sidebar-style]')) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '/assets/css/blog/unified-sidebar.css?v=20260831-1';
		link.dataset.unifiedSidebarStyle = 'true';
		document.head.appendChild(link);
	}

	function setGroupOpen(group, open) {
		const submenu = group.querySelector('.blog-sidebar-submenu');
		const toggle = group.querySelector('.blog-sidebar-submenu-toggle');
		if (!(submenu instanceof HTMLElement) || !(toggle instanceof HTMLButtonElement)) return;
		submenu.hidden = !open;
		group.classList.toggle('is-open', open);
		toggle.setAttribute('aria-expanded', String(open));
		if (open) writeStorage(SIDEBAR_OPEN_GROUP_KEY, group.dataset.menuGroup || '');
	}

	function createMenuGroup(definition) {
		const active = groupIsActive(definition.key);
		const group = document.createElement('div');
		group.className = `blog-sidebar-menu-group${active ? ' is-active' : ''}`;
		group.dataset.menuGroup = definition.key;

		const row = document.createElement('div');
		row.className = 'blog-sidebar-main-row';
		const main = document.createElement('a');
		main.className = `blog-sidebar-link blog-sidebar-main-link${active ? ' is-active' : ''}`;
		main.href = definition.href;
		main.textContent = definition.label;
		if (active) main.setAttribute('aria-current', 'page');
		row.appendChild(main);

		const hasChildren = Array.isArray(definition.children) && definition.children.length > 0 || definition.dynamicCategories;
		if (hasChildren) {
			const toggle = document.createElement('button');
			toggle.type = 'button';
			toggle.className = 'blog-sidebar-submenu-toggle';
			toggle.setAttribute('aria-label', t(`${definition.label} 하위 메뉴`, `${definition.label} サブメニュー`));
			toggle.innerHTML = '<span aria-hidden="true">⌄</span>';
			row.appendChild(toggle);
		}
		group.appendChild(row);

		if (hasChildren) {
			const submenu = document.createElement('div');
			submenu.className = 'blog-sidebar-submenu';
			for (const child of definition.children || []) {
				const link = document.createElement('a');
				const childActive = typeof child.active === 'function' ? child.active() : false;
				link.className = `blog-sidebar-link blog-sidebar-sub-link${childActive ? ' is-active' : ''}`;
				link.href = child.href;
				link.textContent = child.label;
				if (childActive) link.setAttribute('aria-current', 'page');
				submenu.appendChild(link);
			}
			if (definition.dynamicCategories) {
				const label = document.createElement('p');
				label.className = 'blog-sidebar-subsection-label';
				label.textContent = t('카테고리', 'カテゴリー');
				const categories = document.createElement('nav');
				categories.id = 'blog-sidebar-categories';
				categories.className = 'blog-sidebar-nav blog-sidebar-dynamic-categories';
				const empty = document.createElement('p');
				empty.id = 'blog-sidebar-categories-empty';
				empty.className = 'blog-sidebar-category-empty';
				empty.textContent = t('아직 공개된 카테고리가 없습니다.', '公開されたカテゴリーはまだありません。');
				submenu.append(label, categories, empty);
			}
			group.appendChild(submenu);
			const storedOpen = readStorage(SIDEBAR_OPEN_GROUP_KEY);
			setGroupOpen(group, active || storedOpen === definition.key);
			row.querySelector('.blog-sidebar-submenu-toggle')?.addEventListener('click', (event) => {
				event.preventDefault();
				event.stopPropagation();
				setGroupOpen(group, submenu.hidden);
			});
		}
		return group;
	}

	function prepareSectionAnchors() {
		const apToday = document.querySelector('.ap-today-card');
		if (apToday instanceof HTMLElement && !apToday.id) apToday.id = 'ap-today';
		const history = byId('ap-history-list')?.closest('.ap-card');
		if (history instanceof HTMLElement && !history.id) history.id = 'ap-history';
	}

	function renderUnifiedSidebar() {
		const sidebar = byId('blog-dashboard-sidebar') || document.querySelector('.blog-dashboard-sidebar');
		if (!(sidebar instanceof HTMLElement)) return;
		mountUnifiedSidebarStyle();
		prepareSectionAnchors();
		sidebar.replaceChildren();

		const section = document.createElement('section');
		section.className = 'blog-sidebar-section blog-sidebar-unified-section';
		const label = document.createElement('p');
		label.className = 'blog-sidebar-label';
		label.textContent = t('메뉴', 'メニュー');
		const nav = document.createElement('nav');
		nav.className = 'blog-sidebar-unified-nav';
		for (const definition of menuDefinitions()) nav.appendChild(createMenuGroup(definition));
		section.append(label, nav);

		const footer = document.createElement('div');
		footer.className = 'blog-sidebar-footer';
		footer.append(document.createTextNode('SONG'), document.createElement('br'), document.createTextNode('Portfolio · Blog · Learning'));
		sidebar.append(section, footer);
	}

	function renderCategories(posts, language = currentLanguage(), selectedCategory = '') {
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
			link.className = `blog-sidebar-category-link${selected === category ? ' is-active' : ''}`;
			if (selected === category) link.setAttribute('aria-current', 'page');
			link.href = `/${language}/posts/?category=${encodeURIComponent(category)}`;
			const name = document.createElement('span');
			name.textContent = category;
			const badge = document.createElement('span');
			badge.className = 'blog-sidebar-count';
			badge.textContent = String(count);
			link.append(name, badge);
			container.appendChild(link);
		}
	}

	async function loadSidebarCategories() {
		try {
			const language = currentLanguage();
			const response = await fetch(`/api/public/posts?lang=${language}`, { cache: 'no-store', credentials: 'same-origin' });
			const result = await response.json().catch(() => null);
			if (response.ok && Array.isArray(result?.posts)) renderCategories(result.posts, language);
		} catch (error) {
			console.warn('Failed to load sidebar categories', error);
		}
	}

	function updateAdminAccessLabel() {
		const link = byId('blog-sidebar-admin-link');
		if (!(link instanceof HTMLAnchorElement)) return;
		const authenticated = link.dataset.authenticated === 'true';
		link.textContent = authenticated ? t('관리자 대시보드', '管理画面') : t('관리자 로그인', '管理者ログイン');
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

	function closePublicAdminUserMenu() {
		const wrap = byId('blog-public-admin-user');
		const toggle = byId('blog-public-admin-user-toggle');
		const menu = byId('blog-public-admin-user-menu');
		if (menu instanceof HTMLElement) menu.hidden = true;
		if (toggle instanceof HTMLButtonElement) toggle.setAttribute('aria-expanded', 'false');
		wrap?.classList.remove('is-open');
	}

	function syncPublicAdminUserCopy() {
		const toggle = byId('blog-public-admin-user-toggle');
		const adminPage = byId('blog-public-admin-page-link');
		const logout = byId('blog-public-admin-logout');
		if (toggle instanceof HTMLButtonElement) toggle.setAttribute('aria-label', t('관리자 계정', '管理者アカウント'));
		if (adminPage instanceof HTMLAnchorElement) adminPage.textContent = t('관리자 페이지', '管理画面');
		if (logout instanceof HTMLButtonElement) logout.textContent = t('로그아웃', 'ログアウト');
	}

	async function logoutFromPublicHeader(button) {
		if (button instanceof HTMLButtonElement) button.disabled = true;
		try {
			const response = await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
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
		const icon = document.createElement('img');
		icon.className = 'blog-public-admin-user-icon';
		icon.src = '/assets/icons/user.svg';
		icon.alt = '';
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
			link.dataset.authenticated = adminSessionSnapshot?.authenticated ? 'true' : 'false';
			footer.appendChild(link);
			updateAdminAccessLabel();
		}
		if (adminSessionSnapshot?.authenticated) return;
		try {
			const response = await fetch('/api/admin/auth/session', { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
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
		renderUnifiedSidebar();
		mountAdminAccess();
		loadSidebarCategories();
		syncSidebarCollapseToggle();
		if (adminSessionSnapshot) syncPublicAdminUserCopy();
	}

	function mountTodayStudyFloating() {
		if (document.getElementById('jp-today-study-float')) return;
		if (document.querySelector('script[data-today-study-floating-loader]')) return;
		const script = document.createElement('script');
		script.src = '/assets/js/japanese/today-study-float.js?v=20260831-4';
		script.async = true;
		script.dataset.todayStudyFloatingLoader = 'true';
		document.body.appendChild(script);
	}

	function initialize() {
		renderUnifiedSidebar();
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
		mountAdminAccess();
		loadSidebarCategories();
		mountTodayStudyFloating();
	}

	window.BlogDashboard = {
		closeSidebar,
		renderCategories,
		renderUnifiedSidebar,
		syncHomeModuleLinks,
		setSidebarCollapsed,
	};

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();