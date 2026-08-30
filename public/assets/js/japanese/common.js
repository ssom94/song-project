(() => {
	const WORD_PAGE_SIZE = 20;
	let searchTimer = 0;
	let taxonomyCache = null;
	let wordPage = 1;
	let wordRequestId = 0;

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
			if (wordBar) {
				const selects = [...wordBar.querySelectorAll('select')];
				if (selects.length >= 3) {
					const levelSelect = selects[0];
					resetSelect(levelSelect, language() === 'ko' ? 'JLPT: 전체' : 'JLPT: すべて');
					for (const level of taxonomy.levels ?? []) {
						if (Number(level.wordCount ?? 0) > 0) appendOption(levelSelect, level.code, level.code);
					}
					if (Number(taxonomy.unsetLevel?.wordCount ?? 0) > 0) {
						appendOption(levelSelect, 'UNSET', language() === 'ko' ? '미지정' : '未設定');
					}

					const categorySelect = selects[1];
					resetSelect(categorySelect, language() === 'ko' ? '분류: 전체' : '分類: すべて');
					for (const category of taxonomy.categories ?? []) appendOption(categorySelect, category.id, localizedName(category));

					const partSelect = selects[2];
					resetSelect(partSelect, language() === 'ko' ? '품사: 전체' : '品詞: すべて');
					for (const part of taxonomy.parts ?? []) appendOption(partSelect, part.id, localizedName(part));
				}
			}
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

		const titleLine = document.createElement('span');
		titleLine.className = 'jp-word-title-line';
		const title = document.createElement('strong');
		title.textContent = word.word ?? '';
		titleLine.appendChild(title);

		const parts = Array.isArray(word.parts) && word.parts.length ? word.parts : (word.part ? [word.part] : []);
		if (parts.length) {
			const wrap = document.createElement('span');
			wrap.className = 'jp-word-pos-wrap';
			wrap.append('（');
			parts.forEach((part, index) => {
				if (index > 0) wrap.append('・');
				const badge = document.createElement('span');
				badge.className = `jp-word-pos jp-word-pos-${Math.abs(Number(part.id) || 0) % 6}`;
				badge.textContent = localizedName(part);
				wrap.appendChild(badge);
			});
			wrap.append('）');
			titleLine.appendChild(wrap);
		}

		const meta = document.createElement('small');
		meta.className = 'jp-word-meta';
		meta.textContent = word.jlpt || (language() === 'ko' ? 'JLPT 미지정' : 'JLPT 未設定');
		detail.append(titleLine, meta);
		primary.appendChild(detail);

		const reading = document.createElement('span');
		reading.textContent = word.reading ?? '—';
		const meaning = document.createElement('span');
		meaning.textContent = word.meaningKo ?? word.meaningJa ?? '—';
		const quiz = document.createElement('a');
		quiz.className = 'jp-secondary-button';
		const quizParams = new URLSearchParams();
		if (word.id) quizParams.set('wordId', String(word.id));
		if (word.word) quizParams.set('word', String(word.word));
		quizParams.set('quick', '1');
		quiz.href = `/${language()}/japanese/quiz/?${quizParams.toString()}`;
		quiz.textContent = 'Quiz';
		row.append(primary, reading, meaning, quiz);
		return row;
	}

	function wordPaginationLabels() {
		return language() === 'ko'
			? { previous: '이전', next: '다음', summary: (start, end, total) => `${start}-${end} / ${total}개` }
			: { previous: '前へ', next: '次へ', summary: (start, end, total) => `${start}-${end} / ${total}件` };
	}

	function ensureWordPagers() {
		const list = document.querySelector('.jp-word-list');
		if (!list) return [];
		let top = document.getElementById('jp-word-pagination-top');
		let bottom = document.getElementById('jp-word-pagination-bottom');
		if (!top) {
			top = document.createElement('nav');
			top.id = 'jp-word-pagination-top';
			top.className = 'jp-word-pagination is-top';
			list.insertAdjacentElement('beforebegin', top);
		}
		if (!bottom) {
			bottom = document.createElement('nav');
			bottom.id = 'jp-word-pagination-bottom';
			bottom.className = 'jp-word-pagination is-bottom';
			list.insertAdjacentElement('afterend', bottom);
		}
		return [top, bottom];
	}

	function pageNumbers(page, totalPages) {
		if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
		const values = [1];
		const start = Math.max(2, page - 1);
		const end = Math.min(totalPages - 1, page + 1);
		if (start > 2) values.push('left');
		for (let value = start; value <= end; value += 1) values.push(value);
		if (end < totalPages - 1) values.push('right');
		values.push(totalPages);
		return values;
	}

	function wordPageButton(label, page, disabled = false, active = false) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = `jp-word-page-button${active ? ' is-active' : ''}`;
		button.textContent = label;
		button.disabled = disabled;
		if (active) button.setAttribute('aria-current', 'page');
		button.addEventListener('click', () => {
			if (disabled || page === wordPage) return;
			wordPage = page;
			loadWords();
			document.querySelector('.jp-card-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		});
		return button;
	}

	function renderWordPagination(pagination) {
		const pagers = ensureWordPagers();
		const total = Math.max(0, Number(pagination?.total ?? 0));
		const totalPages = Math.max(1, Number(pagination?.totalPages ?? 1));
		const page = Math.min(totalPages, Math.max(1, Number(pagination?.page ?? wordPage)));
		wordPage = page;
		const start = total ? ((page - 1) * WORD_PAGE_SIZE) + 1 : 0;
		const end = Math.min(page * WORD_PAGE_SIZE, total);
		const labels = wordPaginationLabels();

		for (const pager of pagers) {
			pager.replaceChildren();
			if (total <= WORD_PAGE_SIZE) {
				pager.hidden = true;
				continue;
			}
			pager.hidden = false;
			pager.setAttribute('aria-label', language() === 'ko' ? '단어 목록 페이지' : '単語一覧ページ');
			const summary = document.createElement('span');
			summary.className = 'jp-word-pagination-summary';
			summary.textContent = labels.summary(start, end, total);
			const controls = document.createElement('div');
			controls.className = 'jp-word-pagination-controls';
			controls.appendChild(wordPageButton(labels.previous, page - 1, page <= 1));
			for (const item of pageNumbers(page, totalPages)) {
				if (typeof item === 'string') {
					const ellipsis = document.createElement('span');
					ellipsis.className = 'jp-word-pagination-ellipsis';
					ellipsis.textContent = '…';
					controls.appendChild(ellipsis);
				} else {
					controls.appendChild(wordPageButton(String(item), item, false, item === page));
				}
			}
			controls.appendChild(wordPageButton(labels.next, page + 1, page >= totalPages));
			pager.append(summary, controls);
		}
	}

	async function loadWords() {
		const search = document.getElementById('jp-word-search');
		const list = document.querySelector('.jp-word-list');
		const filterBar = document.querySelector('.jp-filter-bar');
		if (!(search instanceof HTMLInputElement) || !list || !filterBar) return;
		const requestId = ++wordRequestId;
		const selects = [...filterBar.querySelectorAll('select')];
		const params = new URLSearchParams();
		if (search.value.trim()) params.set('q', search.value.trim());
		if (selects[0]?.value) params.set('jlpt', selects[0].value);
		if (selects[1]?.value) params.set('category', selects[1].value);
		if (selects[2]?.value) params.set('part', selects[2].value);
		params.set('page', String(wordPage));
		params.set('limit', String(WORD_PAGE_SIZE));
		try {
			const result = await fetchJson(`/api/public/japanese/words?${params.toString()}`);
			if (requestId !== wordRequestId) return;
			list.replaceChildren();
			renderWordPagination(result.pagination);
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
			if (requestId !== wordRequestId) return;
			console.warn('Failed to load Japanese words', error);
			list.replaceChildren();
			renderWordPagination({ total: 0, page: 1, totalPages: 1 });
			const failed = document.createElement('div');
			failed.className = 'jp-empty-state';
			failed.textContent = language() === 'ko' ? '단어를 불러오지 못했습니다.' : '単語を読み込めませんでした。';
			list.appendChild(failed);
		}
	}

	function resetWordPageAndLoad() {
		wordPage = 1;
		loadWords();
	}

	function bindWordFilters() {
		const search = document.getElementById('jp-word-search');
		const filterBar = document.querySelector('.jp-filter-bar');
		if (!(search instanceof HTMLInputElement) || !filterBar) return;
		search.addEventListener('input', () => {
			window.clearTimeout(searchTimer);
			searchTimer = window.setTimeout(resetWordPageAndLoad, 220);
		});
		filterBar.querySelectorAll('select').forEach((select) => select.addEventListener('change', resetWordPageAndLoad));
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

if (!document.querySelector('script[data-context-subnav]')) {
	const script = document.createElement('script');
	script.src = '/assets/js/blog/context-subnav.js';
	script.dataset.contextSubnav = 'true';
	document.body.appendChild(script);
}
