(() => {
	const state = {
		postsPromise: null,
		postId: 0,
		applying: false,
		queued: false,
		observing: false,
	};

	function language() {
		return document.body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
	}

	function copy() {
		return language() === 'ko'
			? {
				relatedTitle: '같은 카테고리의 글',
				emptyRelated: '같은 카테고리의 다른 글이 없습니다.',
				noPrevious: '이전 글이 없습니다.',
				noNext: '다음 글이 없습니다.',
			}
			: {
				relatedTitle: '同じカテゴリーの記事',
				emptyRelated: '同じカテゴリーの他の記事はありません。',
				noPrevious: '前の記事はありません。',
				noNext: '次の記事はありません。',
			};
	}

	function formatDate(value) {
		if (!value) return '';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return new Intl.DateTimeFormat(language() === 'ko' ? 'ko-KR' : 'ja-JP', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			timeZone: 'Asia/Tokyo',
		}).format(date);
	}

	function postHref(post) {
		const linkLanguage = post?.displayLanguage === 'ko' || post?.displayLanguage === 'ja'
			? post.displayLanguage
			: language();
		return `/${linkLanguage}/posts/${encodeURIComponent(post?.slug ?? '')}`;
	}

	function loadPosts() {
		if (state.postsPromise) return state.postsPromise;
		state.postsPromise = fetch(`/api/public/posts?lang=${language()}`, { method: 'GET', cache: 'no-store' })
			.then(async (response) => {
				const result = await response.json().catch(() => null);
				return response.ok && result?.ok && Array.isArray(result.posts) ? result.posts : [];
			})
			.catch((error) => {
				console.warn('Failed to load compact neighbor posts', error);
				return [];
			});
		return state.postsPromise;
	}

	function makeNeighborLink(post) {
		const link = document.createElement('a');
		link.className = 'blog-post-neighbor-link';
		link.href = postHref(post);
		const title = document.createElement('strong');
		title.textContent = post?.title ?? '';
		const meta = document.createElement('small');
		meta.textContent = [formatDate(post?.publishedAt ?? post?.updatedAt), post?.category].filter(Boolean).join(' · ');
		link.append(title, meta);
		return link;
	}

	function renderNeighbor(container, post, emptyMessage) {
		if (!(container instanceof HTMLElement)) return;
		container.replaceChildren();
		if (post) {
			container.appendChild(makeNeighborLink(post));
			return;
		}
		const empty = document.createElement('p');
		empty.className = 'blog-post-neighbor-empty';
		empty.textContent = emptyMessage;
		container.appendChild(empty);
	}

	function ensureRelated(section) {
		let related = section.querySelector('.blog-post-related');
		if (related instanceof HTMLElement) return related;
		const labels = copy();
		related = document.createElement('div');
		related.className = 'blog-post-related';
		const heading = document.createElement('div');
		heading.className = 'blog-post-related-heading';
		const title = document.createElement('h3');
		title.textContent = labels.relatedTitle;
		heading.appendChild(title);
		const list = document.createElement('div');
		list.className = 'blog-post-related-list';
		related.append(heading, list);
		section.appendChild(related);
		return related;
	}

	function makeRelatedLink(post) {
		const link = document.createElement('a');
		link.className = 'blog-post-related-link';
		link.href = postHref(post);
		const title = document.createElement('strong');
		title.textContent = post?.title ?? '';
		const date = document.createElement('small');
		date.textContent = formatDate(post?.publishedAt ?? post?.updatedAt);
		link.append(title, date);
		return link;
	}

	function renderRelated(section, posts) {
		const related = ensureRelated(section);
		const list = related.querySelector('.blog-post-related-list');
		if (!(list instanceof HTMLElement)) return;
		list.replaceChildren();
		if (!posts.length) {
			const empty = document.createElement('p');
			empty.className = 'blog-post-related-empty';
			empty.textContent = copy().emptyRelated;
			list.appendChild(empty);
			return;
		}
		for (const post of posts) list.appendChild(makeRelatedLink(post));
	}

	function stopObserver() {
		observer.disconnect();
		state.observing = false;
	}

	function startObserver() {
		if (state.observing || !document.body) return;
		observer.observe(document.body, { childList: true, subtree: true });
		state.observing = true;
	}

	async function apply() {
		if (state.applying) return;
		const section = document.getElementById('post-neighbor-section');
		const currentId = Number(state.postId || document.body.dataset.postId || 0);
		if (!(section instanceof HTMLElement) || !Number.isSafeInteger(currentId) || currentId <= 0) return;

		state.applying = true;
		try {
			const posts = await loadPosts();
			const index = posts.findIndex((post) => Number(post?.id) === currentId);
			if (index < 0) return;

			const labels = copy();
			const previous = posts[index + 1] ?? null;
			const next = posts[index - 1] ?? null;
			const current = posts[index];
			const category = String(current?.category ?? '').trim();
			const excluded = new Set([currentId, Number(previous?.id || 0), Number(next?.id || 0)]);
			const related = category
				? posts
					.map((post, postIndex) => ({ post, distance: Math.abs(postIndex - index), postIndex }))
					.filter(({ post }) => String(post?.category ?? '').trim() === category && !excluded.has(Number(post?.id)))
					.sort((a, b) => a.distance - b.distance || a.postIndex - b.postIndex)
					.slice(0, 6)
					.map(({ post }) => post)
				: [];

			// Disconnect while changing the neighbor DOM so this enhancer never observes its own writes.
			stopObserver();
			renderNeighbor(document.getElementById('post-previous-list'), previous, labels.noPrevious);
			renderNeighbor(document.getElementById('post-next-list'), next, labels.noNext);
			renderRelated(section, related);
			section.classList.add('is-compact-neighbors');
		} finally {
			state.applying = false;
			startObserver();
		}
	}

	function queueApply() {
		if (state.queued) return;
		state.queued = true;
		window.setTimeout(() => {
			state.queued = false;
			apply();
		}, 0);
	}

	function mutationTouchesNeighbor(mutation) {
		const section = document.getElementById('post-neighbor-section');
		if (!(section instanceof HTMLElement)) {
			return [...mutation.addedNodes].some((node) => node instanceof Element && (node.id === 'post-neighbor-section' || Boolean(node.querySelector?.('#post-neighbor-section'))));
		}
		if (section.contains(mutation.target)) return true;
		return [...mutation.addedNodes].some((node) => node === section || (node instanceof Node && section.contains(node)));
	}

	const observer = new MutationObserver((mutations) => {
		if (state.applying) return;
		if (mutations.some(mutationTouchesNeighbor)) queueApply();
	});

	document.addEventListener('song:post-ready', (event) => {
		const id = Number(event?.detail?.postId || 0);
		if (Number.isSafeInteger(id) && id > 0) state.postId = id;
		queueApply();
	});

	function initialize() {
		state.postId = Number(document.body.dataset.postId || 0);
		startObserver();
		queueApply();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
