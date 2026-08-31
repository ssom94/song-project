(() => {
	let categoryMap = new Map();
	let requestId = 0;
	let decorateQueued = false;

	function language() {
		return document.body?.dataset?.blogLanguage === 'ko' ? 'ko' : 'ja';
	}

	function ensureStyle() {
		if (document.querySelector('link[data-song-category-icon-style]')) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '/assets/css/category-icons.css?v=20260831-1';
		link.dataset.songCategoryIconStyle = 'true';
		document.head.appendChild(link);
	}

	function ensureCatalog() {
		if (window.SongCategoryIcons || document.querySelector('script[data-song-category-icon-catalog]')) return;
		const script = document.createElement('script');
		script.src = '/assets/js/shared/category-icons.js?v=20260831-1';
		script.async = true;
		script.dataset.songCategoryIconCatalog = 'true';
		document.body.appendChild(script);
	}

	function createPlaceholder(appearance, className = '') {
		if (window.SongCategoryIcons?.createIcon) return window.SongCategoryIcons.createIcon(appearance, { className });
		const node = document.createElement('span');
		node.dataset.categoryIconKind = appearance?.kind || 'preset';
		node.dataset.categoryIconValue = appearance?.value || 'folder';
		node.dataset.categoryIconColor = appearance?.color || '#5b6ee1';
		if (appearance?.imageUrl) node.dataset.categoryIconImageUrl = appearance.imageUrl;
		if (className) node.dataset.categoryIconClass = className;
		return node;
	}

	function appearanceSignature(appearance) {
		if (!appearance || appearance.kind === 'none') return 'none';
		return [appearance.kind || 'preset', appearance.value || 'folder', appearance.color || '#5b6ee1', appearance.imageUrl || ''].join('|');
	}

	function currentIcon(container) {
		return container.querySelector('.song-category-icon,[data-category-icon-kind]');
	}

	function syncIcon(container, appearance, className) {
		const signature = appearanceSignature(appearance);
		const existing = currentIcon(container);
		if (container.dataset.songCategoryIconSignature === signature) {
			if (signature === 'none' || existing) return;
		}
		if (existing) existing.remove();
		container.dataset.songCategoryIconSignature = signature;
		if (signature === 'none') return;
		container.insertBefore(createPlaceholder(appearance, className), container.firstChild);
	}

	function categoryNameFromLink(link) {
		const candidates = [...link.children].filter((node) => !node.classList.contains('blog-sidebar-count') && !node.classList.contains('song-category-icon') && !node.hasAttribute('data-category-icon-kind'));
		const named = candidates.find((node) => node.tagName === 'SPAN');
		if (named?.textContent?.trim()) return named.textContent.trim();
		const clone = link.cloneNode(true);
		clone.querySelectorAll('.blog-sidebar-count,.song-category-icon,[data-category-icon-kind]').forEach((node) => node.remove());
		return clone.textContent?.trim() || '';
	}

	function decorateSidebar() {
		document.querySelectorAll('.blog-sidebar-category-link').forEach((link) => {
			if (!(link instanceof HTMLAnchorElement)) return;
			const name = categoryNameFromLink(link);
			syncIcon(link, categoryMap.get(name), 'blog-sidebar-category-icon');
		});
	}

	function decorateCategoryChips() {
		document.querySelectorAll('.blog-chip-category').forEach((chip) => {
			if (!(chip instanceof HTMLElement)) return;
			let name = chip.dataset.songCategoryName || '';
			if (!name) {
				const clone = chip.cloneNode(true);
				clone.querySelectorAll('.song-category-icon,[data-category-icon-kind]').forEach((node) => node.remove());
				name = clone.textContent?.trim() || '';
				if (name) chip.dataset.songCategoryName = name;
			}
			syncIcon(chip, categoryMap.get(name), 'blog-category-chip-icon');
		});
	}

	function decorate() {
		decorateQueued = false;
		decorateSidebar();
		decorateCategoryChips();
		window.SongCategoryIcons?.hydrate?.();
	}

	function queueDecorate() {
		if (decorateQueued) return;
		decorateQueued = true;
		window.requestAnimationFrame(decorate);
	}

	async function loadAppearances() {
		const ownRequest = ++requestId;
		try {
			const response = await fetch(`/api/public/posts?lang=${language()}&page=1`, { method: 'GET', cache: 'no-store', credentials: 'same-origin' });
			const result = await response.json().catch(() => null);
			if (ownRequest !== requestId || !response.ok || !result?.ok) return;
			const next = new Map();
			for (const item of Array.isArray(result.categories) ? result.categories : []) {
				const name = String(item?.name || '').trim();
				if (name && item?.appearance) next.set(name, item.appearance);
			}
			for (const post of Array.isArray(result.posts) ? result.posts : []) {
				const name = String(post?.category || '').trim();
				if (name && post?.categoryMeta?.appearance && !next.has(name)) next.set(name, post.categoryMeta.appearance);
			}
			categoryMap = next;
			queueDecorate();
		} catch (error) {
			console.warn('Failed to load public category appearance', error);
		}
	}

	function initialize() {
		ensureStyle();
		ensureCatalog();
		loadAppearances();
		new MutationObserver((mutations) => {
			const relevant = mutations.some((mutation) => [...mutation.addedNodes].some((node) => {
				if (!(node instanceof HTMLElement)) return false;
				return node.matches('.blog-sidebar-category-link,.blog-chip-category')
					|| Boolean(node.querySelector('.blog-sidebar-category-link,.blog-chip-category'));
			}));
			if (relevant) queueDecorate();
		}).observe(document.body, { childList: true, subtree: true });
		document.addEventListener('song:category-icons-ready', queueDecorate);
		document.querySelectorAll('[data-home-language]').forEach((button) => {
			button.addEventListener('click', () => window.setTimeout(loadAppearances, 50));
		});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();