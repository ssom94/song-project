(() => {
	let posts = [];
	let state = 'loading';

	function t(key, fallback) {
		const value = window.AdminI18n?.t(key);
		return value && value !== key ? value : fallback;
	}

	function languageLabel(language) {
		return language === 'ko'
			? t('languageKorean', '한국어')
			: t('languageJapanese', '日本語');
	}

	function statusLabel(status) {
		if (status === 'published') return t('statusPublished', '公開');
		if (status === 'private') return t('statusPrivate', '非公開');
		return t('statusDraft', '下書き');
	}

	function formatDate(value) {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value ?? '';

		const language = window.AdminI18n?.getLanguage?.() ?? 'ja';
		return new Intl.DateTimeFormat(language === 'ko' ? 'ko-KR' : 'ja-JP', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
			timeZone: 'Asia/Tokyo',
		}).format(date);
	}

	function renderState() {
		const empty = document.querySelector('.admin-posts-empty');
		const title = empty?.querySelector('h2');
		const description = empty?.querySelector('p');
		const icon = empty?.querySelector('.admin-posts-empty-icon');
		if (!empty || !title || !description || !icon) return;

		if (state === 'loading') {
			icon.textContent = '…';
			title.textContent = t('postsLoading', '投稿を読み込んでいます…');
			description.textContent = t('postsLoadingDescription', 'D1から投稿一覧を取得しています。');
			return;
		}

		if (state === 'error') {
			icon.textContent = '!';
			title.textContent = t('postsLoadFailed', '投稿の読み込みに失敗しました');
			description.textContent = t('postsLoadFailedDescription', 'しばらくしてからページを再読み込みしてください。');
			return;
		}

		icon.textContent = '✎';
		title.textContent = t('emptyPostsTitle', '投稿はまだありません');
		description.textContent = t('emptyPostsDescription', '最初の投稿を作成すると、ここに一覧が表示されます。');
	}

	function createStatusBadge(status) {
		const badge = document.createElement('span');
		badge.className = `admin-post-status admin-post-status-${status}`;
		badge.textContent = statusLabel(status);
		return badge;
	}

	function renderPosts() {
		const tableWrap = document.querySelector('.admin-posts-table-wrap');
		const table = document.querySelector('.admin-posts-table');
		const tbody = table?.querySelector('tbody');
		const empty = document.querySelector('.admin-posts-empty');
		if (!tableWrap || !table || !tbody || !empty) return;

		tbody.replaceChildren();

		if (state !== 'ready' || posts.length === 0) {
			tableWrap.hidden = true;
			tableWrap.setAttribute('aria-hidden', 'true');
			empty.hidden = false;
			renderState();
			return;
		}

		for (const post of posts) {
			const row = document.createElement('tr');

			const titleCell = document.createElement('td');
			const title = document.createElement('strong');
			title.className = 'admin-post-title';
			title.textContent = post.title;
			titleCell.appendChild(title);

			const languageCell = document.createElement('td');
			languageCell.textContent = languageLabel(post.originalLanguage);

			const statusCell = document.createElement('td');
			statusCell.appendChild(createStatusBadge(post.status));

			const updatedCell = document.createElement('td');
			updatedCell.className = 'admin-post-updated-at';
			updatedCell.textContent = formatDate(post.updatedAt);

			const actionCell = document.createElement('td');
			actionCell.className = 'admin-post-actions-pending';
			actionCell.textContent = '—';

			row.append(titleCell, languageCell, statusCell, updatedCell, actionCell);
			tbody.appendChild(row);
		}

		empty.hidden = true;
		tableWrap.hidden = false;
		tableWrap.setAttribute('aria-hidden', 'false');
	}

	async function loadPosts() {
		state = 'loading';
		renderPosts();

		try {
			const response = await fetch('/api/admin/posts', {
				method: 'GET',
				credentials: 'same-origin',
				cache: 'no-store',
			});

			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}

			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok || !Array.isArray(result.posts)) {
				throw new Error('Invalid post list response');
			}

			posts = result.posts;
			state = 'ready';
		} catch (error) {
			console.error('Failed to load admin posts', error);
			posts = [];
			state = 'error';
		}

		renderPosts();
	}

	async function initialize() {
		const session = await window.AdminCommon?.ready;
		if (!session) return;
		await window.AdminI18n?.ready;
		await loadPosts();
	}

	document.addEventListener('adminlanguagechange', () => {
		if (state === 'ready' && posts.length > 0) renderPosts();
		else renderState();
	});

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize, { once: true });
	} else {
		initialize();
	}
})();
