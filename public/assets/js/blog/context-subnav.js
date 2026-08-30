(() => {
	const STYLE_HREF = '/assets/css/blog/context-subnav.css';
	let closeTimer = 0;
	let flyout = null;
	let parentLink = null;

	function language() {
		return document.body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
	}

	function labels() {
		return language() === 'ko'
			? {
				title: '일본어 학습',
				subtitle: '하위 메뉴',
				items: [
					{ key: 'home', label: '학습 홈', path: '/japanese/' },
					{ key: 'words', label: '단어 목록', path: '/japanese/words/' },
					{ key: 'quiz', label: '랜덤 퀴즈', path: '/japanese/quiz/' },
					{ key: 'result', label: '학습 결과', path: '/japanese/quiz/result/' },
				],
			}
			: {
				title: '日本語学習',
				subtitle: 'サブメニュー',
				items: [
					{ key: 'home', label: '学習ホーム', path: '/japanese/' },
					{ key: 'words', label: '単語一覧', path: '/japanese/words/' },
					{ key: 'quiz', label: 'ランダムクイズ', path: '/japanese/quiz/' },
					{ key: 'result', label: '学習結果', path: '/japanese/quiz/result/' },
				],
			};
	}

	function localizedPath(item) {
		return `/${language()}${item.path}`;
	}

	function normalizePath(value) {
		const path = String(value || '/').split('?')[0].split('#')[0];
		return path.endsWith('/') ? path : `${path}/`;
	}

	function currentJapaneseModule() {
		return /^\/(ja|ko)\/japanese(?:\/|$)/.test(window.location.pathname);
	}

	function activeKey() {
		const path = normalizePath(window.location.pathname);
		const root = `/${language()}/japanese/`;
		if (path.startsWith(`${root}quiz/result/`)) return 'result';
		if (path.startsWith(`${root}quiz/`)) return 'quiz';
		if (path.startsWith(`${root}words/`)) return 'words';
		if (path === root) return 'home';
		return '';
	}

	function mountStyle() {
		if (document.querySelector(`link[href="${STYLE_HREF}"]`)) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = STYLE_HREF;
		link.dataset.contextSubnavStyle = 'true';
		document.head.appendChild(link);
	}

	function findMainJapaneseLink() {
		const firstSection = document.querySelector('.blog-dashboard-sidebar .blog-sidebar-section');
		if (!firstSection) return null;
		const links = [...firstSection.querySelectorAll('.blog-sidebar-link')];
		return links.find((link) => {
			if (!(link instanceof HTMLAnchorElement)) return false;
			try {
				const path = new URL(link.href, window.location.origin).pathname;
				return /^\/(ja|ko)\/japanese\/?$/.test(path);
			} catch {
				return false;
			}
		}) || null;
	}

	function hideLegacyJapaneseSection() {
		if (!currentJapaneseModule()) return;
		const sidebar = document.querySelector('.blog-dashboard-sidebar');
		if (!sidebar) return;
		const sections = [...sidebar.querySelectorAll(':scope > .blog-sidebar-section')];
		for (let index = 1; index < sections.length; index += 1) {
			const section = sections[index];
			const japaneseLinks = [...section.querySelectorAll('a')].filter((link) => {
				if (!(link instanceof HTMLAnchorElement)) return false;
				try {
					return new URL(link.href, window.location.origin).pathname.includes(`/${language()}/japanese/`);
				} catch {
					return false;
				}
			});
			if (japaneseLinks.length >= 2) {
				section.classList.add('blog-sidebar-context-legacy');
				section.setAttribute('aria-hidden', 'true');
			}
		}
	}

	function createSubmenuLinks(container, className) {
		const copy = labels();
		const current = activeKey();
		for (const item of copy.items) {
			const link = document.createElement('a');
			link.className = className;
			link.href = localizedPath(item);
			link.textContent = item.label;
			if (item.key === current) {
				link.classList.add('is-active');
				link.setAttribute('aria-current', 'page');
			}
			container.appendChild(link);
		}
	}

	function mountTopSubnav() {
		if (!currentJapaneseModule() || document.getElementById('blog-context-subnav')) return;
		const heading = document.querySelector('.jp-page-heading');
		if (!(heading instanceof HTMLElement)) return;

		const nav = document.createElement('nav');
		nav.id = 'blog-context-subnav';
		nav.className = 'blog-context-subnav';
		nav.setAttribute('aria-label', language() === 'ko' ? '일본어 학습 하위 메뉴' : '日本語学習サブメニュー');

		const parent = document.createElement('span');
		parent.className = 'blog-context-subnav-parent';
		parent.textContent = labels().title;
		const list = document.createElement('div');
		list.className = 'blog-context-subnav-list';
		createSubmenuLinks(list, 'blog-context-subnav-link');
		nav.append(parent, list);
		heading.insertAdjacentElement('beforebegin', nav);
	}

	function clearCloseTimer() {
		window.clearTimeout(closeTimer);
		closeTimer = 0;
	}

	function hideFlyout(delay = 110) {
		clearCloseTimer();
		closeTimer = window.setTimeout(() => {
			if (flyout) flyout.hidden = true;
			parentLink?.setAttribute('aria-expanded', 'false');
		}, delay);
	}

	function positionFlyout() {
		if (!flyout || !parentLink || flyout.hidden) return;
		const rect = parentLink.getBoundingClientRect();
		const width = flyout.offsetWidth || 220;
		const height = flyout.offsetHeight || 190;
		const left = Math.min(window.innerWidth - width - 10, rect.right + 10);
		const top = Math.min(window.innerHeight - height - 10, Math.max(72, rect.top - 8));
		flyout.style.left = `${Math.max(8, left)}px`;
		flyout.style.top = `${Math.max(72, top)}px`;
	}

	function showFlyout() {
		if (!flyout || !parentLink || window.innerWidth <= 840) return;
		clearCloseTimer();
		flyout.hidden = false;
		parentLink.setAttribute('aria-expanded', 'true');
		positionFlyout();
	}

	function removeFlyout() {
		clearCloseTimer();
		flyout?.remove();
		flyout = null;
		if (parentLink) {
			parentLink.classList.remove('has-context-submenu');
			parentLink.removeAttribute('aria-haspopup');
			parentLink.removeAttribute('aria-expanded');
			parentLink.querySelector('.blog-sidebar-submenu-caret')?.remove();
		}
		parentLink = null;
	}

	function mountHoverFlyout() {
		removeFlyout();
		parentLink = findMainJapaneseLink();
		if (!(parentLink instanceof HTMLAnchorElement)) return;

		parentLink.classList.add('has-context-submenu');
		parentLink.setAttribute('aria-haspopup', 'menu');
		parentLink.setAttribute('aria-expanded', 'false');
		const caret = document.createElement('span');
		caret.className = 'blog-sidebar-submenu-caret';
		caret.setAttribute('aria-hidden', 'true');
		parentLink.appendChild(caret);

		flyout = document.createElement('div');
		flyout.className = 'blog-sidebar-flyout';
		flyout.hidden = true;
		flyout.setAttribute('role', 'menu');

		const title = document.createElement('div');
		title.className = 'blog-sidebar-flyout-title';
		const icon = document.createElement('span');
		icon.className = 'blog-sidebar-flyout-parent-icon';
		icon.setAttribute('aria-hidden', 'true');
		icon.textContent = 'J';
		const titleCopy = document.createElement('div');
		const titleText = document.createElement('strong');
		titleText.textContent = labels().title;
		const titleMeta = document.createElement('small');
		titleMeta.textContent = labels().subtitle;
		titleCopy.append(titleText, titleMeta);
		title.append(icon, titleCopy);

		const links = document.createElement('nav');
		links.className = 'blog-sidebar-flyout-menu';
		links.setAttribute('aria-label', labels().subtitle);
		createSubmenuLinks(links, 'blog-sidebar-flyout-link');
		flyout.append(title, links);
		document.body.appendChild(flyout);

		parentLink.addEventListener('mouseenter', showFlyout);
		parentLink.addEventListener('mouseleave', () => hideFlyout());
		parentLink.addEventListener('focus', showFlyout);
		parentLink.addEventListener('blur', () => hideFlyout(160));
		flyout.addEventListener('mouseenter', () => {
			clearCloseTimer();
			flyout.hidden = false;
		});
		flyout.addEventListener('mouseleave', () => hideFlyout());
		flyout.addEventListener('focusin', clearCloseTimer);
		flyout.addEventListener('focusout', () => hideFlyout(160));
	}

	function refreshForLanguageChange() {
		window.setTimeout(() => {
			document.getElementById('blog-context-subnav')?.remove();
			hideLegacyJapaneseSection();
			mountTopSubnav();
			mountHoverFlyout();
		}, 40);
	}

	function initialize() {
		mountStyle();
		hideLegacyJapaneseSection();
		mountTopSubnav();
		mountHoverFlyout();
		window.addEventListener('resize', positionFlyout);
		window.addEventListener('scroll', positionFlyout, { passive: true });
		document.querySelectorAll('[data-home-language]').forEach((button) => {
			button.addEventListener('click', refreshForLanguageChange);
		});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
