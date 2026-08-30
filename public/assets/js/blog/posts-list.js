(() => {
	let loadedPosts = [];
	let adminView = false;
	const busyVisibility = new Set();
	const busyDelete = new Set();

	function currentLanguage() {
		return document.body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
	}

	function labels() {
		return currentLanguage() === 'ko'
			? {
				newPost: '+ 새 글', edit: '수정', remove: '삭제', visible: '표시', hidden: '비표시',
				hidePost: '게시글을 비표시로 변경', showPost: '게시글을 표시로 변경',
				deleteTitle: '게시글 삭제', deleteMessage: '이 게시글을 삭제할까요? 삭제한 글은 공개 목록에서 사라집니다.',
				cancel: '취소', confirmDelete: '삭제', deleteFailed: '게시글을 삭제하지 못했습니다.',
				visibilityFailed: '표시 상태를 변경하지 못했습니다.',
			}
			: {
				newPost: '+ 新規投稿', edit: '編集', remove: '削除', visible: '表示', hidden: '非表示',
				hidePost: '投稿を非表示にする', showPost: '投稿を表示する',
				deleteTitle: '投稿を削除', deleteMessage: 'この投稿を削除しますか？削除した投稿は公開一覧から消えます。',
				cancel: 'キャンセル', confirmDelete: '削除', deleteFailed: '投稿を削除できませんでした。',
				visibilityFailed: '表示状態を変更できませんでした。',
			};
	}

	function selectedCategory() {
		return new URLSearchParams(window.location.search).get('category')?.trim() ?? '';
	}

	function formatDate(value) {
		if (!value) return '';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return new Intl.DateTimeFormat(currentLanguage() === 'ko' ? 'ko-KR' : 'ja-JP', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			timeZone: 'Asia/Tokyo',
		}).format(date);
	}

	function createChip(text, category = false) {
		const chip = document.createElement('span');
		chip.className = `blog-chip${category ? ' blog-chip-category' : ''}`;
		chip.textContent = text;
		return chip;
	}

	function createPostLink(post, className = '') {
		const link = document.createElement('a');
		link.href = `/${currentLanguage()}/posts/${encodeURIComponent(post.slug)}`;
		if (className) link.className = className;
		return link;
	}

	function createVisibilityToggle(post, refresh) {
		const text = labels();
		const wrap = document.createElement('label');
		wrap.className = 'blog-post-admin-toggle-wrap';

		const state = document.createElement('span');
		state.className = 'blog-post-admin-toggle-label';
		state.textContent = post.visible ? text.visible : text.hidden;

		const button = document.createElement('button');
		button.type = 'button';
		button.className = `blog-post-admin-toggle${post.visible ? ' is-visible' : ''}`;
		button.setAttribute('role', 'switch');
		button.setAttribute('aria-checked', String(Boolean(post.visible)));
		button.setAttribute('aria-label', post.visible ? text.hidePost : text.showPost);
		button.disabled = busyVisibility.has(post.id);
		const knob = document.createElement('span');
		button.appendChild(knob);
		button.addEventListener('click', async () => {
			if (busyVisibility.has(post.id)) return;
			busyVisibility.add(post.id);
			button.disabled = true;
			try {
				const response = await fetch(`/api/admin/posts/visibility?id=${encodeURIComponent(String(post.id))}`, {
					method: 'PATCH',
					credentials: 'same-origin',
					cache: 'no-store',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ visible: !post.visible }),
				});
				const result = await response.json().catch(() => null);
				if (!response.ok || !result?.ok) throw new Error(result?.error || `HTTP_${response.status}`);
				post.visible = Boolean(result.visible);
				post.status = result.status;
				await refresh(false);
			} catch (error) {
				console.error('Failed to update public-list post visibility', error);
				window.alert(text.visibilityFailed);
			} finally {
				busyVisibility.delete(post.id);
			}
		});
		wrap.append(state, button);
		return wrap;
	}

	function closeDeleteModal(backdrop) {
		backdrop?.remove();
		document.body.style.removeProperty('overflow');
	}

	function openDeleteModal(post, refresh) {
		const text = labels();
		const backdrop = document.createElement('div');
		backdrop.className = 'blog-post-delete-modal-backdrop';
		const modal = document.createElement('section');
		modal.className = 'blog-post-delete-modal';
		modal.setAttribute('role', 'dialog');
		modal.setAttribute('aria-modal', 'true');

		const title = document.createElement('h2');
		title.textContent = text.deleteTitle;
		const postTitle = document.createElement('strong');
		postTitle.textContent = post.title ?? '';
		const message = document.createElement('p');
		message.textContent = text.deleteMessage;

		const actions = document.createElement('div');
		actions.className = 'blog-post-delete-modal-actions';
		const cancel = document.createElement('button');
		cancel.type = 'button';
		cancel.textContent = text.cancel;
		const confirm = document.createElement('button');
		confirm.type = 'button';
		confirm.className = 'is-danger';
		confirm.textContent = text.confirmDelete;
		actions.append(cancel, confirm);
		modal.append(title, postTitle, message, actions);
		backdrop.appendChild(modal);
		document.body.appendChild(backdrop);
		document.body.style.overflow = 'hidden';

		cancel.addEventListener('click', () => closeDeleteModal(backdrop));
		backdrop.addEventListener('mousedown', (event) => {
			if (event.target === backdrop) closeDeleteModal(backdrop);
		});
		confirm.addEventListener('click', async () => {
			if (busyDelete.has(post.id)) return;
			busyDelete.add(post.id);
			confirm.disabled = true;
			cancel.disabled = true;
			try {
				const response = await fetch(`/api/admin/posts/detail?id=${encodeURIComponent(String(post.id))}`, {
					method: 'DELETE',
					credentials: 'same-origin',
					cache: 'no-store',
				});
				const result = await response.json().catch(() => null);
				if (!response.ok || !result?.ok) throw new Error(result?.error || `HTTP_${response.status}`);
				closeDeleteModal(backdrop);
				await refresh(true);
			} catch (error) {
				console.error('Failed to delete post from public list', error);
				window.alert(text.deleteFailed);
				confirm.disabled = false;
				cancel.disabled = false;
			} finally {
				busyDelete.delete(post.id);
			}
		});
	}

	function createAdminActions(post, refresh) {
		const text = labels();
		const actions = document.createElement('div');
		actions.className = 'blog-post-admin-actions';
		actions.appendChild(createVisibilityToggle(post, refresh));

		const edit = document.createElement('a');
		edit.className = 'blog-post-admin-button';
		edit.href = `/admin/posts/edit/?id=${encodeURIComponent(String(post.id))}`;
		edit.textContent = text.edit;

		const remove = document.createElement('button');
		remove.type = 'button';
		remove.className = 'blog-post-admin-button is-delete';
		remove.textContent = text.remove;
		remove.addEventListener('click', () => openDeleteModal(post, refresh));
		actions.append(edit, remove);
		return actions;
	}

	function renderPost(post, displayNumber, refresh) {
		const card = document.createElement('article');
		card.className = `blog-post-card${post.visible === false ? ' is-admin-hidden' : ''}`;

		const numberColumn = document.createElement('div');
		numberColumn.className = 'blog-post-card-number-column';
		const number = document.createElement('span');
		number.className = 'blog-post-card-number';
		number.textContent = `No. ${displayNumber}`;
		numberColumn.appendChild(number);

		const body = document.createElement('div');
		body.className = 'blog-post-card-body';
		const top = document.createElement('div');
		top.className = 'blog-post-card-top';
		const meta = document.createElement('div');
		meta.className = 'blog-post-card-meta';
		const publishedAt = formatDate(post.publishedAt ?? post.updatedAt);
		if (publishedAt) {
			const date = document.createElement('time');
			date.textContent = publishedAt;
			date.dateTime = post.publishedAt ?? post.updatedAt ?? '';
			meta.appendChild(date);
		}
		if (post.category) meta.appendChild(createChip(post.category, true));
		top.appendChild(meta);
		if (adminView) top.appendChild(createAdminActions(post, refresh));

		const title = document.createElement('h2');
		title.className = 'blog-post-card-title';
		const titleLink = createPostLink(post, 'blog-post-card-title-link');
		titleLink.textContent = post.title ?? '';
		title.appendChild(titleLink);
		body.append(top, title);

		if (post.excerpt) {
			const excerpt = document.createElement('p');
			excerpt.className = 'blog-post-card-excerpt';
			excerpt.textContent = post.excerpt;
			body.appendChild(excerpt);
		}

		const tags = document.createElement('div');
		tags.className = 'blog-post-card-taxonomy blog-post-card-tags';
		for (const tag of Array.isArray(post.tags) ? post.tags : []) tags.appendChild(createChip(tag));
		if (tags.childElementCount > 0) body.appendChild(tags);
		card.append(numberColumn, body);
		return card;
	}

	function renderFilter(category) {
		const wrap = document.getElementById('public-posts-filter');
		const label = document.getElementById('public-posts-filter-label');
		if (!wrap || !label) return;
		wrap.hidden = !category;
		if (!category) return;
		label.textContent = currentLanguage() === 'ko'
			? `게시판: ${category}`
			: `カテゴリー: ${category}`;
	}

	function mountAdminCreateButton() {
		const hero = document.querySelector('.blog-posts-hero');
		if (!(hero instanceof HTMLElement)) return;
		let button = document.getElementById('blog-posts-admin-new');
		if (!adminView) {
			button?.remove();
			return;
		}
		if (!(button instanceof HTMLAnchorElement)) {
			button = document.createElement('a');
			button.id = 'blog-posts-admin-new';
			button.className = 'blog-posts-admin-new';
			button.href = '/admin/posts/new/';
			hero.appendChild(button);
		}
		button.textContent = labels().newPost;
	}

	function renderLoadedPosts(refresh) {
		const list = document.getElementById('public-posts-list');
		const empty = document.getElementById('public-posts-empty');
		if (!list || !empty) return;
		const category = selectedCategory();
		renderFilter(category);
		mountAdminCreateButton();
		window.BlogDashboard?.renderCategories?.(loadedPosts.filter((post) => post.visible !== false), currentLanguage());

		const numbered = loadedPosts.map((post, index) => ({ ...post, displayNumber: loadedPosts.length - index }));
		const posts = category
			? numbered.filter((post) => String(post?.category ?? '').trim() === category)
			: numbered;
		list.replaceChildren();
		empty.hidden = posts.length > 0;
		if (posts.length === 0) {
			const heading = empty.querySelector('h2');
			const message = empty.querySelector('p');
			if (category && heading && message) {
				heading.textContent = currentLanguage() === 'ko' ? '이 게시판에는 표시할 글이 없습니다' : 'このカテゴリーに表示できる投稿はありません';
				message.textContent = currentLanguage() === 'ko' ? '다른 게시판을 선택하거나 전체 게시글을 확인해 주세요.' : '別のカテゴリーを選ぶか、すべての投稿をご確認ください。';
			}
			return;
		}
		const fragment = document.createDocumentFragment();
		for (const post of posts) fragment.appendChild(renderPost(post, post.displayNumber, refresh));
		list.appendChild(fragment);
	}

	async function loadPosts(showLoading = true) {
		const loading = document.getElementById('public-posts-loading');
		const error = document.getElementById('public-posts-error');
		if (!loading || !error) return;
		if (showLoading) loading.hidden = false;
		error.hidden = true;
		try {
			const language = currentLanguage();
			const response = await fetch(`/api/public/posts?lang=${language}`, {
				method: 'GET',
				credentials: 'same-origin',
				cache: 'no-store',
			});
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok || !Array.isArray(result.posts)) throw new Error('Invalid public post list response');
			adminView = result.adminView === true;
			loadedPosts = result.posts;
			loading.hidden = true;
			renderLoadedPosts(loadPosts);
		} catch (loadError) {
			console.error('Failed to load public posts', loadError);
			loading.hidden = true;
			error.hidden = false;
		}
	}

	async function initialize() {
		const list = document.getElementById('public-posts-list');
		if (!list) return;
		await loadPosts(true);
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
