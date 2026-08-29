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
	}

	window.BlogDashboard = {
		closeSidebar,
		renderCategories,
		syncHomeModuleLinks,
	};

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
