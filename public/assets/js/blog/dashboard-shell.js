(() => {
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

	async function mountAdminAccess() {
		const footer = document.querySelector('.blog-sidebar-footer');
		if (!footer || byId('blog-sidebar-admin-link')) return;

		const link = document.createElement('a');
		link.id = 'blog-sidebar-admin-link';
		link.className = 'blog-sidebar-admin-link';
		link.dataset.authenticated = 'false';
		footer.appendChild(link);
		updateAdminAccessLabel();

		try {
			const response = await fetch('/api/admin/auth/session', {
				method: 'GET',
				credentials: 'same-origin',
				cache: 'no-store',
			});
			const result = await response.json().catch(() => null);
			link.dataset.authenticated = response.ok && result?.authenticated === true ? 'true' : 'false';
			updateAdminAccessLabel();
		} catch (error) {
			console.warn('Failed to check admin session for public shortcut', error);
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
		byId('blog-dashboard-menu-toggle')?.addEventListener('click', toggleSidebar);
		byId('blog-dashboard-backdrop')?.addEventListener('click', closeSidebar);
		document.querySelector('.blog-dashboard-sidebar')?.addEventListener('click', (event) => {
			if (event.target instanceof HTMLAnchorElement && window.matchMedia('(max-width: 840px)').matches) closeSidebar();
		});
		document.querySelectorAll('[data-home-language]').forEach((button) => {
			button.addEventListener('click', () => window.setTimeout(syncHomeModuleLinks, 0));
		});
		document.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') closeSidebar();
		});
		syncHomeModuleLinks();
		mountAdminAccess();
	}

	window.BlogDashboard = {
		closeSidebar,
		renderCategories,
		syncHomeModuleLinks,
	};

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
