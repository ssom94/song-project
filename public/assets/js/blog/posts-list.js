(() => {
	function currentLanguage() {
		return document.body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
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

	function renderPost(post, displayNumber) {
		const language = currentLanguage();
		const card = document.createElement('a');
		card.className = 'blog-post-card';
		card.href = `/${language}/posts/${encodeURIComponent(post.slug)}`;

		const meta = document.createElement('div');
		meta.className = 'blog-post-card-meta';
		const number = document.createElement('span');
		number.className = 'blog-post-card-number';
		number.textContent = `No. ${displayNumber}`;
		meta.appendChild(number);

		const publishedAt = formatDate(post.publishedAt ?? post.updatedAt);
		if (publishedAt) {
			const date = document.createElement('time');
			date.textContent = publishedAt;
			date.dateTime = post.publishedAt ?? post.updatedAt ?? '';
			meta.appendChild(date);
		}

		const title = document.createElement('h2');
		title.className = 'blog-post-card-title';
		title.textContent = post.title ?? '';
		card.append(meta, title);

		if (post.excerpt) {
			const excerpt = document.createElement('p');
			excerpt.className = 'blog-post-card-excerpt';
			excerpt.textContent = post.excerpt;
			card.appendChild(excerpt);
		}

		const taxonomy = document.createElement('div');
		taxonomy.className = 'blog-post-card-taxonomy';
		if (post.category) taxonomy.appendChild(createChip(post.category, true));
		for (const tag of Array.isArray(post.tags) ? post.tags : []) taxonomy.appendChild(createChip(tag));
		if (taxonomy.childElementCount > 0) card.appendChild(taxonomy);
		return card;
	}

	function renderFilter(category) {
		const wrap = document.getElementById('public-posts-filter');
		const label = document.getElementById('public-posts-filter-label');
		if (!wrap || !label || !category) return;
		wrap.hidden = false;
		label.textContent = currentLanguage() === 'ko'
			? `게시판: ${category}`
			: `カテゴリー: ${category}`;
	}

	async function initialize() {
		const loading = document.getElementById('public-posts-loading');
		const list = document.getElementById('public-posts-list');
		const empty = document.getElementById('public-posts-empty');
		const error = document.getElementById('public-posts-error');
		if (!loading || !list || !empty || !error) return;

		try {
			const language = currentLanguage();
			const response = await fetch(`/api/public/posts?lang=${language}`, {
				method: 'GET',
				cache: 'no-store',
			});
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok || !Array.isArray(result.posts)) throw new Error('Invalid public post list response');

			window.BlogDashboard?.renderCategories?.(result.posts, language);
			const category = selectedCategory();
			const posts = category
				? result.posts.filter((post) => String(post?.category ?? '').trim() === category)
				: result.posts;
			renderFilter(category);

			loading.hidden = true;
			list.replaceChildren();
			if (posts.length === 0) {
				empty.hidden = false;
				const heading = empty.querySelector('h2');
				const message = empty.querySelector('p');
				if (category && heading && message) {
					heading.textContent = currentLanguage() === 'ko' ? '이 게시판에는 공개 글이 없습니다' : 'このカテゴリーに公開中の投稿はありません';
					message.textContent = currentLanguage() === 'ko' ? '다른 게시판을 선택하거나 전체 게시글을 확인해 주세요.' : '別のカテゴリーを選ぶか、すべての投稿をご確認ください。';
				}
				return;
			}

			const fragment = document.createDocumentFragment();
			posts.forEach((post, index) => fragment.appendChild(renderPost(post, posts.length - index)));
			list.appendChild(fragment);
		} catch (loadError) {
			console.error('Failed to load public posts', loadError);
			loading.hidden = true;
			error.hidden = false;
		}
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();