(() => {
	function language() {
		return window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja';
	}

	function t(ko, ja) {
		return language() === 'ko' ? ko : ja;
	}

	function categoryName() {
		const preferred = language() === 'ko'
			? document.getElementById('category-name-ko')
			: document.getElementById('category-name-ja');
		const fallback = language() === 'ko'
			? document.getElementById('category-name-ja')
			: document.getElementById('category-name-ko');
		return String(preferred?.value || fallback?.value || t('카테고리명', 'カテゴリー名')).trim() || t('카테고리명', 'カテゴリー名');
	}

	function previewIcon(className) {
		const source = document.querySelector('#category-icon-selected-preview .song-category-icon');
		if (source instanceof HTMLElement) {
			const clone = source.cloneNode(true);
			if (clone instanceof HTMLElement) clone.classList.add(className);
			return clone;
		}
		const fallback = document.createElement('span');
		fallback.className = `song-category-icon ${className}`;
		fallback.textContent = '▱';
		return fallback;
	}

	function createSidebarPreview(name) {
		const row = document.createElement('div');
		row.className = 'admin-category-preview-sidebar-row';
		row.append(previewIcon('admin-category-preview-icon'));
		const label = document.createElement('span');
		label.textContent = name;
		const count = document.createElement('small');
		count.textContent = '4';
		row.append(label, count);
		return row;
	}

	function createBadgePreview(name) {
		const wrap = document.createElement('div');
		wrap.className = 'admin-category-preview-badge';
		wrap.append(previewIcon('admin-category-preview-icon'));
		const label = document.createElement('span');
		label.textContent = name;
		wrap.appendChild(label);
		return wrap;
	}

	function createHomePreview(name) {
		const card = document.createElement('div');
		card.className = 'admin-category-preview-home-card';
		const meta = document.createElement('div');
		meta.className = 'admin-category-preview-home-meta';
		meta.append(previewIcon('admin-category-preview-icon'));
		const category = document.createElement('span');
		category.textContent = name;
		meta.appendChild(category);
		const title = document.createElement('strong');
		title.textContent = t('게시글 제목 미리보기', '投稿タイトルのプレビュー');
		const copy = document.createElement('small');
		copy.textContent = t('홈 최근 게시글에서 보이는 형태입니다.', 'ホームの最近の投稿で表示されるイメージです。');
		card.append(meta, title, copy);
		return card;
	}

	function render() {
		const target = document.getElementById('category-live-preview-content');
		if (!target) return;
		const name = categoryName();
		target.replaceChildren();

		const examples = [
			[t('사이드바', 'サイドバー'), createSidebarPreview(name)],
			[t('게시글 카테고리', '投稿カテゴリー'), createBadgePreview(name)],
			[t('홈 최근 게시글', 'ホームの最近の投稿'), createHomePreview(name)],
		];
		for (const [title, content] of examples) {
			const panel = document.createElement('section');
			panel.className = 'admin-category-preview-panel';
			const heading = document.createElement('b');
			heading.textContent = title;
			panel.append(heading, content);
			target.appendChild(panel);
		}
	}

	function mount() {
		const iconField = document.getElementById('category-icon-field');
		if (!(iconField instanceof HTMLElement)) return false;
		if (document.getElementById('category-live-preview')) return true;

		const preview = document.createElement('section');
		preview.id = 'category-live-preview';
		preview.className = 'admin-category-live-preview';
		const heading = document.createElement('div');
		heading.className = 'admin-category-live-preview-heading';
		const title = document.createElement('strong');
		title.textContent = t('실제 표시 미리보기', '実際の表示プレビュー');
		const hint = document.createElement('small');
		hint.textContent = t('아이콘·색상·카테고리명을 바꾸면 바로 반영됩니다.', 'アイコン・色・カテゴリー名の変更をすぐ確認できます。');
		heading.append(title, hint);
		const content = document.createElement('div');
		content.id = 'category-live-preview-content';
		content.className = 'admin-category-live-preview-content';
		preview.append(heading, content);
		iconField.appendChild(preview);

		for (const id of ['category-name-ja', 'category-name-ko']) {
			document.getElementById(id)?.addEventListener('input', render);
		}
		const selected = document.getElementById('category-icon-selected-preview');
		if (selected) new MutationObserver(render).observe(selected, { childList: true, subtree: true, attributes: true });
		document.getElementById('category-icon-color')?.addEventListener('input', () => queueMicrotask(render));
		document.getElementById('category-icon-color-text')?.addEventListener('change', () => queueMicrotask(render));
		document.addEventListener('adminlanguagechange', () => {
			preview.remove();
			queueMicrotask(mount);
		});
		render();
		return true;
	}

	function initialize() {
		let count = 0;
		if (mount()) return;
		const timer = window.setInterval(() => {
			count += 1;
			if (mount() || count >= 50) window.clearInterval(timer);
		}, 100);
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
