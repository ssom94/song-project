(() => {
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

		const quizLink = byId('jp-word-detail-quiz');
		if (quizLink instanceof HTMLAnchorElement) {
			quizLink.href = `/${language()}/japanese/quiz/?word=${encodeURIComponent(word.word ?? '')}`;
		}

		document.title = language() === 'ko'
			? `${word.word ?? ''} | 일본어 학습 | SONG`
			: `${word.word ?? ''} | 日本語学習 | SONG`;
	}

	async function loadWord() {
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
