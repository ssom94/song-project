(() => {
	let posts = [];
	let state = 'loading';
	let searchInput;
	let statusSelect;
	let visibilitySelect;
	let languageSelect;
	const visibilityBusy = new Set();

	function t(key, fallback) {
		const value = window.AdminI18n?.t(key);
		return value && value !== key ? value : fallback;
	}

	function currentLanguage() {
		return window.AdminI18n?.getLanguage?.() ?? 'ja';
	}

	function languageLabel(language) {
		return language === 'ko' ? t('languageKorean', '한국어') : t('languageJapanese', '日本語');
	}

	function registrationStatus(post) {
		return post?.status === 'draft' ? 'draft' : 'registered';
	}

	function registrationLabel(post) {
		return registrationStatus(post) === 'draft'
			? t('registrationDraft', currentLanguage() === 'ko' ? '임시' : '一時保存')
			: t('registrationCompleted', currentLanguage() === 'ko' ? '등록완료' : '登録完了');
	}

	function categoryLabel(post) {
		if (!post?.categoryId) return t('categoryNone', '未分類');
		const language = currentLanguage();
		return post.categoryNames?.[language]
			?? post.categoryNames?.ja
			?? post.categoryNames?.ko
			?? `#${post.categoryId}`;
	}

	function formatDate(value) {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value ?? '';
		const language = currentLanguage();
		return new Intl.DateTimeFormat(language === 'ko' ? 'ko-KR' : 'ja-JP', {
			year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
			hour12: false, timeZone: 'Asia/Tokyo',
		}).format(date);
	}

	function normalizeSearchText(value) {
		return String(value ?? '').normalize('NFKC').toLocaleLowerCase().trim();
	}

	function getFilteredPosts() {
		const search = normalizeSearchText(searchInput?.value);
		const registration = statusSelect?.value ?? '';
		const visibility = visibilitySelect?.value ?? '';
		const language = languageSelect?.value ?? '';
		return posts.filter((post) => {
			const matchesSearch = !search || normalizeSearchText(post.title).includes(search);
			const matchesRegistration = !registration || registrationStatus(post) === registration;
			const matchesVisibility = !visibility
				|| (visibility === 'visible' && post.status === 'published')
				|| (visibility === 'hidden' && post.status === 'private');
			const matchesLanguage = !language || post.originalLanguage === language;
			return matchesSearch && matchesRegistration && matchesVisibility && matchesLanguage;
		});
	}

	function configureTableHeader() {
		const row = document.querySelector('.admin-posts-table thead tr');
		if (!row) return;

		const visibilityHeader = row.querySelector('[data-i18n="tableVisibility"]');
		if (visibilityHeader) {
			visibilityHeader.classList.add('admin-post-visibility-status-column');
			row.appendChild(visibilityHeader);
		}

		let toggleHeader = row.querySelector('.admin-post-visibility-toggle-column');
		if (!toggleHeader) {
			toggleHeader = document.createElement('th');
			toggleHeader.className = 'admin-post-visibility-toggle-column';
			toggleHeader.setAttribute('aria-label', currentLanguage() === 'ko' ? '표시 상태 변경' : '表示状態の変更');
			row.appendChild(toggleHeader);
		}
	}

	function renderState(mode = 'empty') {
		const empty = document.querySelector('.admin-posts-empty');
		const title = empty?.querySelector('h2');
		const description = empty?.querySelector('p');
		const icon = empty?.querySelector('.admin-posts-empty-icon');
		if (!empty || !title || !description || !icon) return;

		if (mode === 'loading') {
			icon.textContent = '…';
			title.textContent = t('postsLoading', '投稿を読み込んでいます…');
			description.textContent = t('postsLoadingDescription', 'D1から投稿一覧を取得しています。');
			return;
		}
		if (mode === 'error') {
			icon.textContent = '!';
			title.textContent = t('postsLoadFailed', '投稿の読み込みに失敗しました');
			description.textContent = t('postsLoadFailedDescription', 'しばらくしてからページを再読み込みしてください。');
			return;
		}
		if (mode === 'filtered-empty') {
			icon.textContent = '⌕';
			title.textContent = t('postsFilterEmptyTitle', '検索条件に一致する投稿がありません');
			description.textContent = t('postsFilterEmptyDescription', '検索語またはフィルターを変更してください。');
			return;
		}

		icon.textContent = '✎';
		title.textContent = t('emptyPostsTitle', '投稿はまだありません');
		description.textContent = t('emptyPostsDescription', '最初の投稿を作成すると、ここに一覧が表示されます。');
	}

	function createRegistrationBadge(post) {
		const status = registrationStatus(post);
		const badge = document.createElement('span');
		badge.className = `admin-post-status admin-post-status-${status}`;
		badge.textContent = registrationLabel(post);
		return badge;
	}

	function createViewLink(post, className) {
		const link = document.createElement('a');
		link.className = className;
		link.href = `/admin/posts/edit/?id=${encodeURIComponent(String(post.id))}`;
		link.textContent = className === 'admin-post-title-link' ? post.title : t('viewPost', '表示');
		return link;
	}

	async function updateVisibility(post, visible) {
		if (!post || post.status === 'draft' || visibilityBusy.has(post.id)) return;
		visibilityBusy.add(post.id);
		renderPosts();
		try {
			const response = await fetch(`/api/admin/posts/visibility?id=${encodeURIComponent(String(post.id))}`, {
				method: 'PATCH',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ visible }),
			});
			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error ?? 'VISIBILITY_UPDATE_FAILED');
			post.status = result.status;
			post.updatedAt = new Date().toISOString();
		} catch (error) {
			console.error('Failed to update post visibility', error);
			if (window.AdminCommon?.alert) {
				await window.AdminCommon.alert({
					titleKey: 'visibilityUpdateFailedTitle',
					messageKey: 'visibilityUpdateFailedMessage',
					titleFallback: currentLanguage() === 'ko' ? '표시 상태 변경 실패' : '表示状態の変更に失敗しました',
					messageFallback: currentLanguage() === 'ko' ? '잠시 후 다시 시도해 주세요.' : 'しばらくしてからもう一度お試しください。',
				});
			}
		} finally {
			visibilityBusy.delete(post.id);
			renderPosts();
		}
	}

	function createVisibilityStatus(post) {
		const label = document.createElement('span');
		if (post.status === 'draft') {
			label.className = 'admin-post-visibility-status is-unregistered';
			label.textContent = '—';
			return label;
		}

		const visible = post.status === 'published';
		label.className = `admin-post-visibility-status${visible ? ' is-visible' : ''}`;
		label.textContent = visible
			? t('visibilityVisible', currentLanguage() === 'ko' ? '표시' : '表示')
			: t('visibilityHidden', currentLanguage() === 'ko' ? '비표시' : '非表示');
		return label;
	}

	function createVisibilityToggle(post) {
		const wrapper = document.createElement('div');
		wrapper.className = 'admin-post-visibility-toggle-wrap';

		if (post.status === 'draft') {
			const unavailable = document.createElement('span');
			unavailable.className = 'admin-post-visibility-unregistered';
			unavailable.textContent = t('visibilityUnregistered', currentLanguage() === 'ko' ? '미등록 상태' : '未登録状態');
			wrapper.appendChild(unavailable);
			return wrapper;
		}

		const visible = post.status === 'published';
		const button = document.createElement('button');
		button.type = 'button';
		button.className = `admin-post-visibility-toggle${visible ? ' is-visible' : ''}`;
		button.setAttribute('role', 'switch');
		button.setAttribute('aria-checked', String(visible));
		button.setAttribute('aria-label', visible
			? t('hidePostAction', currentLanguage() === 'ko' ? '게시글 비표시로 변경' : '投稿を非表示にする')
			: t('showPostAction', currentLanguage() === 'ko' ? '게시글 표시로 변경' : '投稿を表示する'));
		button.disabled = visibilityBusy.has(post.id);
		const knob = document.createElement('span');
		knob.className = 'admin-post-visibility-knob';
		button.appendChild(knob);
		button.addEventListener('click', () => updateVisibility(post, !visible));
		wrapper.appendChild(button);
		return wrapper;
	}

	function renderPosts() {
		const tableWrap = document.querySelector('.admin-posts-table-wrap');
		const table = document.querySelector('.admin-posts-table');
		const tbody = table?.querySelector('tbody');
		const empty = document.querySelector('.admin-posts-empty');
		if (!tableWrap || !table || !tbody || !empty) return;

		configureTableHeader();
		tbody.replaceChildren();
		if (state === 'loading' || state === 'error' || posts.length === 0) {
			tableWrap.hidden = true;
			tableWrap.setAttribute('aria-hidden', 'true');
			empty.hidden = false;
			renderState(state === 'loading' ? 'loading' : state === 'error' ? 'error' : 'empty');
			return;
		}

		const filteredPosts = getFilteredPosts();
		if (filteredPosts.length === 0) {
			tableWrap.hidden = true;
			tableWrap.setAttribute('aria-hidden', 'true');
			empty.hidden = false;
			renderState('filtered-empty');
			return;
		}

		for (const post of filteredPosts) {
			const row = document.createElement('tr');

			const numberCell = document.createElement('td');
			numberCell.className = 'admin-post-number';
			numberCell.textContent = String(post.postNumber ?? '');

			const titleCell = document.createElement('td');
			titleCell.appendChild(createViewLink(post, 'admin-post-title-link'));

			const categoryCell = document.createElement('td');
			categoryCell.className = 'admin-post-category';
			categoryCell.textContent = categoryLabel(post);

			const languageCell = document.createElement('td');
			languageCell.textContent = languageLabel(post.originalLanguage);

			const registrationCell = document.createElement('td');
			registrationCell.appendChild(createRegistrationBadge(post));

			const updatedCell = document.createElement('td');
			updatedCell.className = 'admin-post-updated-at';
			updatedCell.textContent = formatDate(post.updatedAt);

			const actionCell = document.createElement('td');
			actionCell.appendChild(createViewLink(post, 'admin-post-edit-link'));

			const visibilityStatusCell = document.createElement('td');
			visibilityStatusCell.className = 'admin-post-visibility-status-cell';
			visibilityStatusCell.appendChild(createVisibilityStatus(post));

			const visibilityToggleCell = document.createElement('td');
			visibilityToggleCell.className = 'admin-post-visibility-toggle-cell';
			visibilityToggleCell.appendChild(createVisibilityToggle(post));

			row.append(
				numberCell,
				titleCell,
				categoryCell,
				languageCell,
				registrationCell,
				updatedCell,
				actionCell,
				visibilityStatusCell,
				visibilityToggleCell,
			);
			tbody.appendChild(row);
		}

		empty.hidden = true;
		tableWrap.hidden = false;
		tableWrap.setAttribute('aria-hidden', 'false');
	}

	function bindFilters() {
		searchInput = document.getElementById('post-search');
		statusSelect = document.getElementById('post-status');
		visibilitySelect = document.getElementById('post-visibility');
		languageSelect = document.getElementById('post-language');
		searchInput?.addEventListener('input', renderPosts);
		statusSelect?.addEventListener('change', renderPosts);
		visibilitySelect?.addEventListener('change', renderPosts);
		languageSelect?.addEventListener('change', renderPosts);
	}

	async function loadPosts() {
		state = 'loading';
		renderPosts();
		try {
			const response = await fetch('/api/admin/posts', { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok || !Array.isArray(result.posts)) throw new Error('Invalid post list response');
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
		bindFilters();
		const session = await window.AdminCommon?.ready;
		if (!session) return;
		await window.AdminI18n?.ready;
		configureTableHeader();
		await loadPosts();
	}

	document.addEventListener('adminlanguagechange', () => {
		configureTableHeader();
		renderPosts();
	});
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
