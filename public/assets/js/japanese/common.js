(() => {
	let searchTimer = 0;
	let taxonomyCache = null;

	function language() {
		return document.body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
	}

	function mountLearningBackground() {
		if (document.querySelector('link[data-learning-background]')) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '/assets/css/japanese/learning-background.css';
		link.dataset.learningBackground = 'true';
		document.head.appendChild(link);
	}

	function localizedName(item) {
		return language() === 'ko' ? item?.nameKo ?? item?.nameJa ?? '' : item?.nameJa ?? item?.nameKo ?? '';
	}

	async function fetchJson(url) {
		const response = await fetch(url, { method: 'GET', cache: 'no-store' });
		const result = await response.json().catch(() => null);
		if (!response.ok || !result?.ok) throw new Error(`Request failed: ${url}`);
		return result;
	}

	async function loadSidebarBoards() {
		try {
			const lang = language();
			const result = await fetchJson(`/api/public/posts?lang=${lang}`);
			if (Array.isArray(result.posts)) window.BlogDashboard?.renderCategories?.(result.posts, lang);
		} catch (error) {
			console.warn('Failed to load Japanese module sidebar boards', error);
		}
	}

	async function loadStats() {
		if (!document.querySelector('[data-jp-stat]')) return;
		try {
			const result = await fetchJson('/api/public/japanese/stats');
			const stats = result.stats ?? {};
			const values = {
				registered: stats.registeredWords ?? 0,
				wrong: stats.wrongWords ?? 0,
				accuracy: stats.accuracy == null ? '—' : stats.accuracy,
				today: stats.todayAttempts ?? 0,
			};
			for (const [key, value] of Object.entries(values)) {
				const node = document.querySelector(`[data-jp-stat="${key}"]`);
				if (node) node.textContent = String(value);
			}
			const levels = stats.levels ?? {};
			document.querySelectorAll('.jp-level-row').forEach((row) => {
				const code = row.querySelector('strong')?.textContent?.trim();
				if (!code || !(code in levels)) return;
				const label = row.querySelector('span');
				if (label) label.textContent = language() === 'ko' ? `${levels[code]}개 등록` : `${levels[code]}語 登録`;
			});
		} catch (error) {
			console.warn('Failed to load Japanese stats', error);
		}
	}

	async function loadTaxonomy() {
		if (taxonomyCache) return taxonomyCache;
		taxonomyCache = await fetchJson('/api/public/japanese/taxonomy');
		return taxonomyCache;
	}

	function resetSelect(select, firstText) {
		select.replaceChildren();
		const option = document.createElement('option');
		option.value = '';
		option.textContent = firstText;
		select.appendChild(option);
	}

	function appendOption(select, value, label) {
		const option = document.createElement('option');
		option.value = String(value);
		option.textContent = label;
		select.appendChild(option);
	}

	async function populateTaxonomyFilters() {
		const wordBar = document.querySelector('.jp-filter-bar');
		const quizGrid = document.querySelector('.jp-form-grid');
		if (!wordBar && !quizGrid) return;
		try {
			const taxonomy = await loadTaxonomy();
			const target = wordBar ?? quizGrid;
			const selects = [...target.querySelectorAll('select')];
			if (selects.length < 3) return;

			const levelSelect = selects[0];
			resetSelect(levelSelect, language() === 'ko' ? 'JLPT: 전체' : 'JLPT: すべて');
			for (const level of taxonomy.levels ?? []) appendOption(levelSelect, level.code, level.code);

			const categorySelect = selects[1];
			resetSelect(categorySelect, language() === 'ko' ? '분류: 전체' : '分類: すべて');
			for (const category of taxonomy.categories ?? []) appendOption(categorySelect, category.id, localizedName(category));

			const partSelect = selects[2];
			resetSelect(partSelect, language() === 'ko' ? '품사: 전체' : '品詞: すべて');
			for (const part of taxonomy.parts ?? []) appendOption(partSelect, part.id, localizedName(part));
		} catch (error) {
			console.warn('Failed to load Japanese taxonomy', error);
		}
	}

	function createWordRow(word) {
		const row = document.createElement('article');
		row.className = 'jp-word-row';

		const primary = document.createElement('div');
		const detail = document.createElement('a');
		detail.className = 'jp-word-link';
		const detailParams = new URLSearchParams();
		if (word.id) detailParams.set('id', String(word.id));
		if (word.word) detailParams.set('word', String(word.word));
		detail.href = `/${language()}/japanese/words/detail/?${detailParams.toString()}`;
		const title = document.createElement('strong');
		title.textContent = word.word ?? '';
		const meta = document.createElement('small');
		const partName = localizedName(word.part);
		meta.textContent = [word.jlpt, partName].filter(Boolean).join(' · ');
		detail.append(title, meta);
		primary.appendChild(detail);

		const reading = document.createElement('span');
		reading.textContent = word.reading ?? '—';
		const meaning = document.createElement('span');
		meaning.textContent = word.meaningKo ?? word.meaningJa ?? '—';
		const quiz = document.createElement('a');
		quiz.className = 'jp-secondary-button';
		quiz.href = `/${language()}/japanese/quiz/?word=${encodeURIComponent(word.word ?? '')}`;
		quiz.textContent = 'Quiz';
		row.append(primary, reading, meaning, quiz);
		return row;
	}

	async function loadWords() {
		const search = document.getElementById('jp-word-search');
		const list = document.querySelector('.jp-word-list');
		const filterBar = document.querySelector('.jp-filter-bar');
		if (!(search instanceof HTMLInputElement) || !list || !filterBar) return;
		const selects = [...filterBar.querySelectorAll('select')];
		const params = new URLSearchParams();
		if (search.value.trim()) params.set('q', search.value.trim());
		if (selects[0]?.value) params.set('jlpt', selects[0].value);
		if (selects[1]?.value) params.set('category', selects[1].value);
		if (selects[2]?.value) params.set('part', selects[2].value);
		params.set('limit', '200');
		try {
			const result = await fetchJson(`/api/public/japanese/words?${params.toString()}`);
			list.replaceChildren();
			if (!Array.isArray(result.words) || result.words.length === 0) {
				const empty = document.createElement('div');
				empty.className = 'jp-empty-state';
				empty.textContent = language() === 'ko' ? '조건에 맞는 단어가 없습니다.' : '条件に一致する単語がありません。';
				list.appendChild(empty);
				return;
			}
			const fragment = document.createDocumentFragment();
			for (const word of result.words) fragment.appendChild(createWordRow(word));
			list.appendChild(fragment);
		} catch (error) {
			console.warn('Failed to load Japanese words', error);
			list.replaceChildren();
			const failed = document.createElement('div');
			failed.className = 'jp-empty-state';
			failed.textContent = language() === 'ko' ? '단어를 불러오지 못했습니다.' : '単語を読み込めませんでした。';
			list.appendChild(failed);
		}
	}

	function bindWordFilters() {
		const search = document.getElementById('jp-word-search');
		const filterBar = document.querySelector('.jp-filter-bar');
		if (!(search instanceof HTMLInputElement) || !filterBar) return;
		search.addEventListener('input', () => {
			window.clearTimeout(searchTimer);
			searchTimer = window.setTimeout(loadWords, 220);
		});
		filterBar.querySelectorAll('select').forEach((select) => select.addEventListener('change', loadWords));
	}

	async function initialize() {
		mountLearningBackground();
		await Promise.allSettled([loadSidebarBoards(), loadStats(), populateTaxonomyFilters()]);
		bindWordFilters();
		await loadWords();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
