(() => {
	function currentLanguage() {
		return document.body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
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

	function renderPost(post) {
		const language = currentLanguage();
		const card = document.createElement('a');
		card.className = 'blog-post-card';
		card.href = `/${language}/posts/${encodeURIComponent(post.slug)}`;

		const meta = document.createElement('div');
		meta.className = 'blog-post-card-meta';
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
		for (const tag of Array.isArray(post.tags) ? post.tags : []) {
			taxonomy.appendChild(createChip(tag));
		}
		if (taxonomy.childElementCount > 0) card.appendChild(taxonomy);

		return card;
	}

	async function initialize() {
		const loading = document.getElementById('public-posts-loading');
		const list = document.getElementById('public-posts-list');
		const empty = document.getElementById('public-posts-empty');
		const error = document.getElementById('public-posts-error');
		if (!loading || !list || !empty || !error) return;

		try {
			const response = await fetch(`/api/public/posts?lang=${currentLanguage()}`, {
				method: 'GET',
				cache: 'no-store',
			});
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok || !Array.isArray(result.posts)) {
				throw new Error('Invalid public post list response');
			}

			loading.hidden = true;
			list.replaceChildren();
			if (result.posts.length === 0) {
				empty.hidden = false;
				return;
			}

			const fragment = document.createDocumentFragment();
			for (const post of result.posts) fragment.appendChild(renderPost(post));
			list.appendChild(fragment);
		} catch (loadError) {
			console.error('Failed to load public posts', loadError);
			loading.hidden = true;
			error.hidden = false;
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize, { once: true });
	} else {
		initialize();
	}
})();
