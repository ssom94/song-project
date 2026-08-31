(() => {
	const KANJI_API = '/api/public/japanese/kanji-korean';

	function byId(id) {
		return document.getElementById(id);
	}

	function language() {
		return document.body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
	}

	function copy(ja, ko) {
		return language() === 'ko' ? ko : ja;
	}

	function showState(message) {
		const state = byId('jp-word-detail-state');
		const content = byId('jp-word-detail-content');
		if (state) {
			state.textContent = message;
			state.hidden = false;
		}
		if (content) content.hidden = true;
	}

	function showContent() {
		const state = byId('jp-word-detail-state');
		const content = byId('jp-word-detail-content');
		if (state) state.hidden = true;
		if (content) content.hidden = false;
	}

	function categoriesFor(word) {
		const primary = language() === 'ko' ? word.categoriesKo : word.categoriesJa;
		const fallback = language() === 'ko' ? word.categoriesJa : word.categoriesKo;
		return Array.isArray(primary) && primary.length ? primary : Array.isArray(fallback) ? fallback : [];
	}

	function partName(word) {
		if (!word?.part) return '';
		return language() === 'ko'
			? (word.part.nameKo ?? word.part.nameJa ?? '')
			: (word.part.nameJa ?? word.part.nameKo ?? '');
	}

	function valueOrDash(value) {
		const text = String(value ?? '').trim();
		return text || '—';
	}

	function mountKanjiStyle() {
		if (document.getElementById('jp-word-detail-kanji-style')) return;
		const style = document.createElement('style');
		style.id = 'jp-word-detail-kanji-style';
		style.textContent = `
			.jp-word-detail-kanji-grid {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
				gap: 9px;
			}
			.jp-word-detail-kanji-item {
				display: grid;
				grid-template-columns: 44px minmax(0, 1fr);
				align-items: center;
				gap: 11px;
				padding: 12px;
				border: 1px solid #e1e7ef;
				border-radius: 11px;
				background: #fbfcfe;
			}
			.jp-word-detail-kanji-character {
				display: grid;
				place-items: center;
				width: 44px;
				height: 44px;
				border-radius: 10px;
				background: #eef3ff;
				color: #274f91;
				font-size: 25px;
				font-weight: 900;
			}
			.jp-word-detail-kanji-info b,
			.jp-word-detail-kanji-info span { display: block; }
			.jp-word-detail-kanji-info b {
				font-size: 13px;
				color: #344156;
			}
			.jp-word-detail-kanji-info span {
				margin-top: 3px;
				font-size: 10px;
				font-weight: 750;
				color: #7d899a;
			}
		`;
		document.head.appendChild(style);
	}

	function renderTaxonomy(word) {
		const container = byId('jp-word-detail-taxonomy');
		if (!container) return;
		container.replaceChildren();

		const part = partName(word);
		if (part) {
			const chip = document.createElement('span');
			chip.className = 'jp-word-detail-chip is-part';
			chip.textContent = part;
			container.appendChild(chip);
		}

		for (const name of categoriesFor(word)) {
			const chip = document.createElement('span');
			chip.className = 'jp-word-detail-chip';
			chip.textContent = name;
			container.appendChild(chip);
		}

		if (!container.childElementCount) {
			const chip = document.createElement('span');
			chip.className = 'jp-word-detail-chip';
			chip.textContent = copy('分類未指定', '분류 미지정');
			container.appendChild(chip);
		}
	}

	function renderExample(word) {
		const wrapper = byId('jp-word-detail-example');
		const empty = byId('jp-word-detail-example-empty');
		if (!wrapper || !empty) return;
		const example = word?.example;
		if (!example?.sentence) {
			wrapper.hidden = true;
			empty.hidden = false;
			return;
		}
		wrapper.hidden = false;
		empty.hidden = true;
		byId('jp-word-detail-example-ja').textContent = example.sentence;
		byId('jp-word-detail-example-reading').textContent = valueOrDash(example.reading);
		byId('jp-word-detail-example-ko').textContent = valueOrDash(example.translationKo);
	}

	async function renderKanjiKorean(word) {
		const main = document.querySelector('.jp-word-detail-main');
		const hero = main?.querySelector('.jp-word-detail-hero');
		if (!(main instanceof HTMLElement) || !(hero instanceof HTMLElement)) return;
		main.querySelector('#jp-word-detail-kanji-korean')?.remove();
		const wordText = String(word?.word ?? '').trim();
		if (!wordText) return;

		try {
			const params = new URLSearchParams();
			params.append('word', wordText);
			const response = await fetch(`${KANJI_API}?${params.toString()}`, { cache: 'no-store' });
			const result = await response.json().catch(() => null);
			const entries = response.ok && result?.ok && Array.isArray(result.words)
				? result.words.find((item) => item.word === wordText)?.kanji
				: null;
			if (!Array.isArray(entries) || !entries.length) return;

			const section = document.createElement('section');
			section.id = 'jp-word-detail-kanji-korean';
			section.className = 'jp-word-detail-section';
			const heading = document.createElement('div');
			heading.className = 'jp-word-detail-section-heading';
			const h2 = document.createElement('h2');
			h2.textContent = copy('漢字の韓国式の訓・音', '한자 한국식 뜻·음');
			const label = document.createElement('span');
			label.textContent = 'KOREAN HANJA';
			heading.append(h2, label);

			const grid = document.createElement('div');
			grid.className = 'jp-word-detail-kanji-grid';
			for (const entry of entries) {
				const item = document.createElement('div');
				item.className = 'jp-word-detail-kanji-item';
				const character = document.createElement('strong');
				character.className = 'jp-word-detail-kanji-character';
				character.textContent = entry.character || '';
				const info = document.createElement('div');
				info.className = 'jp-word-detail-kanji-info';
				const hunEum = document.createElement('b');
				hunEum.textContent = `${entry.meaningKo || '—'} ${entry.soundKo || '—'}`;
				const note = document.createElement('span');
				note.textContent = copy('韓国漢字の意味・音', '한국 한자의 뜻·음');
				info.append(hunEum, note);
				item.append(character, info);
				grid.appendChild(item);
			}
			section.append(heading, grid);
			hero.insertAdjacentElement('afterend', section);
		} catch (error) {
			console.warn('Failed to load Korean kanji readings for word detail', error);
		}
	}

	function syncLinks(word) {
		const encodedWord = encodeURIComponent(word.word ?? '');
		const quizHref = `/${language()}/japanese/quiz/?word=${encodedWord}`;
		for (const id of ['jp-word-detail-quiz', 'jp-word-detail-quiz-side']) {
			const link = byId(id);
			if (link instanceof HTMLAnchorElement) link.href = quizHref;
		}

		const languageLink = byId('jp-word-detail-language-link');
		if (languageLink instanceof HTMLAnchorElement) {
			const otherLanguage = language() === 'ko' ? 'ja' : 'ko';
			const params = new URLSearchParams();
			if (word.id) params.set('id', String(word.id));
			if (word.word) params.set('word', String(word.word));
			languageLink.href = `/${otherLanguage}/japanese/words/detail/?${params.toString()}`;
		}
	}

	function renderWord(word) {
		showContent();
		byId('jp-word-detail-word').textContent = valueOrDash(word.word);
		byId('jp-word-detail-reading').textContent = valueOrDash(word.reading);
		byId('jp-word-detail-level').textContent = valueOrDash(word.jlpt);
		byId('jp-word-detail-meaning-ko').textContent = valueOrDash(word.meaningKo);
		byId('jp-word-detail-meaning-ja').textContent = valueOrDash(word.meaningJa);
		byId('jp-word-detail-part').textContent = partName(word) || '—';
		byId('jp-word-detail-category-count').textContent = String(categoriesFor(word).length);
		renderTaxonomy(word);
		renderExample(word);
		renderKanjiKorean(word);
		syncLinks(word);

		document.title = language() === 'ko'
			? `${word.word ?? ''} | 일본어 학습 | SONG`
			: `${word.word ?? ''} | 日本語学習 | SONG`;
	}

	async function loadWord() {
		mountKanjiStyle();
		const params = new URLSearchParams(window.location.search);
		const wordParam = params.get('word')?.trim() ?? '';
		const idParam = Number(params.get('id'));
		if (!wordParam) {
			showState(copy('単語一覧から単語を選択してください。', '단어 목록에서 단어를 선택해 주세요.'));
			return;
		}

		showState(copy('単語を読み込んでいます…', '단어를 불러오는 중…'));
		try {
			const query = new URLSearchParams({ q: wordParam, limit: '100' });
			const response = await fetch(`/api/public/japanese/words?${query.toString()}`, { method: 'GET', cache: 'no-store' });
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok || !Array.isArray(result.words)) throw new Error('Invalid word detail response');

			let selected = null;
			if (Number.isSafeInteger(idParam) && idParam > 0) {
				selected = result.words.find((item) => Number(item.id) === idParam) ?? null;
			}
			if (!selected) selected = result.words.find((item) => item.word === wordParam) ?? null;
			if (!selected) selected = result.words[0] ?? null;
			if (!selected) {
				showState(copy('該当する単語が見つかりませんでした。', '해당 단어를 찾지 못했습니다.'));
				return;
			}
			renderWord(selected);
		} catch (error) {
			console.warn('Failed to load Japanese word detail', error);
			showState(copy('単語を読み込めませんでした。', '단어를 불러오지 못했습니다.'));
		}
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadWord, { once: true });
	else loadWord();
})();
