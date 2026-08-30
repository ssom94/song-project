(() => {
	let categories = [];
	let partsOfSpeech = [];

	function t(key, fallback) {
		const value = window.AdminI18n?.t(key);
		return value && value !== key ? value : fallback;
	}
	function currentLanguage() { return window.AdminI18n?.getLanguage?.() ?? 'ja'; }
	function copy(ko, ja) { return currentLanguage() === 'ko' ? ko : ja; }
	function label(row) {
		if (!row) return '';
		return currentLanguage() === 'ko' ? (row.name_ko ?? row.name_ja ?? '') : (row.name_ja ?? row.name_ko ?? '');
	}
	function roots(items) { return items.filter((item) => item.parent_id === null || item.parent_id === undefined); }
	function children(items, parentId) {
		if (!parentId) return [];
		return items.filter((item) => String(item.parent_id ?? '') === String(parentId));
	}

	function rebuildParent(selectId, items, allKey, fallback) {
		const select = document.getElementById(selectId);
		if (!select) return;
		const current = select.value;
		select.replaceChildren();
		const all = document.createElement('option');
		all.value = '';
		all.textContent = t(allKey, fallback);
		select.appendChild(all);
		for (const item of roots(items)) {
			const option = document.createElement('option');
			option.value = String(item.id);
			option.textContent = label(item);
			select.appendChild(option);
		}
		if ([...select.options].some((option) => option.value === current)) select.value = current;
	}

	function rebuildChild(parentId, childId, items, allKey, fallback) {
		const parent = document.getElementById(parentId);
		const child = document.getElementById(childId);
		if (!parent || !child) return;
		const current = child.value;
		child.replaceChildren();
		const all = document.createElement('option');
		all.value = '';
		all.textContent = t(allKey, fallback);
		child.appendChild(all);
		for (const item of children(items, parent.value)) {
			const option = document.createElement('option');
			option.value = String(item.id);
			option.textContent = label(item);
			child.appendChild(option);
		}
		child.disabled = !parent.value || child.options.length <= 1;
		if ([...child.options].some((option) => option.value === current)) child.value = current;
	}

	function renderHierarchies() {
		rebuildParent('quiz-category-parent', categories, 'quizAllCategories', copy('전체', 'すべて'));
		rebuildChild('quiz-category-parent', 'quiz-category', categories, 'quizAllSubcategories', copy('전체', 'すべて'));
		rebuildParent('quiz-pos-parent', partsOfSpeech, 'quizAllParts', copy('전체', 'すべて'));
		rebuildChild('quiz-pos-parent', 'quiz-pos', partsOfSpeech, 'quizAllSubcategories', copy('전체', 'すべて'));
	}

	async function loadSetupData() {
		const count = document.getElementById('quiz-available-count');
		try {
			const [wordsResponse, categoriesResponse, partsResponse] = await Promise.all([
				fetch('/api/admin/japanese/words', { credentials: 'same-origin', cache: 'no-store' }),
				fetch('/api/admin/japanese/categories', { credentials: 'same-origin', cache: 'no-store' }),
				fetch('/api/admin/japanese/parts', { credentials: 'same-origin', cache: 'no-store' }),
			]);
			if ([wordsResponse, categoriesResponse, partsResponse].some((response) => response.status === 401)) {
				window.location.replace('/admin/login/');
				return;
			}
			const wordsResult = await wordsResponse.json().catch(() => null);
			const categoriesResult = await categoriesResponse.json().catch(() => null);
			const partsResult = await partsResponse.json().catch(() => null);
			if (count && wordsResponse.ok && wordsResult?.ok && Array.isArray(wordsResult.words)) count.textContent = String(wordsResult.words.length);
			categories = categoriesResponse.ok && categoriesResult?.ok && Array.isArray(categoriesResult.categories) ? categoriesResult.categories : [];
			partsOfSpeech = partsResponse.ok && partsResult?.ok && Array.isArray(partsResult.parts) ? partsResult.parts : [];
			renderHierarchies();
		} catch (error) {
			console.error('Failed to load quiz setup data', error);
			if (count) count.textContent = '—';
		}
	}

	function setQuestionCount(value) {
		const input = document.getElementById('quiz-count-custom');
		const normalized = Math.max(1, Math.min(200, Number(value) || 20));
		if (input) input.value = String(normalized);
		document.querySelectorAll('[data-quiz-count]').forEach((button) => {
			button.classList.toggle('is-active', Number(button.dataset.quizCount) === normalized);
		});
	}

	function selectedOptionLabel(id) {
		const select = document.getElementById(id);
		if (!select?.value) return null;
		return select.selectedOptions?.[0]?.textContent?.trim() || null;
	}

	function savedMode() {
		try {
			const stored = JSON.parse(sessionStorage.getItem('song_japanese_quiz_setup') || 'null');
			if (['input', 'choice', 'sentence', 'mixed'].includes(stored?.quizMode)) return stored.quizMode;
			if (stored?.answerMode === 'choice') return 'choice';
			if (Array.isArray(stored?.types) && stored.types.length === 1 && stored.types[0] === 'sentence') return 'sentence';
		} catch {
			// Ignore old or invalid setup.
		}
		return 'mixed';
	}

	function modeDefinitions() {
		return [
			{ value: 'input', title: copy('주관식', '記述式'), description: copy('단어의 읽기 또는 한국어 뜻을 직접 입력합니다.', '単語の読み方または韓国語の意味を直接入力します。') },
			{ value: 'choice', title: copy('4지선다', '4択'), description: copy('정답 1개와 다른 등록 단어의 뜻 3개 중에서 선택합니다.', '正解1つと、他の登録単語の意味3つから選択します。') },
			{ value: 'sentence', title: copy('예문 빈칸', '例文穴埋め'), description: copy('등록된 예문에서 단어를 빈칸으로 가리고 다른 등록 단어와 섞인 4개의 보기 중에서 선택합니다.', '登録例文の対象単語を空欄にし、他の登録単語を含む4つの選択肢から選びます。') },
			{ value: 'mixed', title: copy('전체 혼합', 'すべて混合'), description: copy('주관식·4지선다·예문 빈칸을 문제마다 랜덤으로 섞습니다.', '記述式・4択・例文穴埋めを問題ごとにランダムで混ぜます。') },
		];
	}

	function mountModeSelector() {
		const existingModeSection = document.querySelector('[data-quiz-mode-section]');
		const typeInput = document.querySelector('input[name="quiz-type"]');
		const typeSection = existingModeSection || typeInput?.closest('.admin-quiz-section');
		if (!typeSection) return;
		typeSection.dataset.quizModeSection = 'true';
		let selected = document.querySelector('input[name="quiz-mode"]:checked')?.value || savedMode();
		if (!['input', 'choice', 'sentence', 'mixed'].includes(selected)) selected = 'mixed';

		typeSection.replaceChildren();
		const heading = document.createElement('div');
		heading.className = 'admin-quiz-section-heading';
		const strong = document.createElement('strong');
		strong.textContent = copy('출제 방식', '出題方式');
		const hint = document.createElement('span');
		hint.textContent = copy('한 가지 방식 또는 전체 혼합을 선택합니다.', '1つの方式、またはすべて混合を選択します。');
		heading.append(strong, hint);

		const list = document.createElement('div');
		list.className = 'admin-quiz-answer-modes';
		for (const mode of modeDefinitions()) {
			const labelNode = document.createElement('label');
			labelNode.className = 'admin-quiz-answer-mode';
			const input = document.createElement('input');
			input.type = 'radio';
			input.name = 'quiz-mode';
			input.value = mode.value;
			input.checked = mode.value === selected;
			const copyWrap = document.createElement('span');
			const title = document.createElement('strong');
			title.textContent = mode.title;
			const description = document.createElement('small');
			description.textContent = mode.description;
			copyWrap.append(title, description);
			labelNode.append(input, copyWrap);
			list.appendChild(labelNode);
		}
		typeSection.append(heading, list);

		const legacyAnswerInput = document.querySelector('input[name="quiz-answer-mode"]');
		const legacySection = legacyAnswerInput?.closest('.admin-quiz-section');
		if (legacySection) legacySection.hidden = true;
	}

	function selectedMode() {
		return document.querySelector('input[name="quiz-mode"]:checked')?.value || 'mixed';
	}

	function typesForMode(mode) {
		if (mode === 'choice') return ['meaning'];
		if (mode === 'sentence') return ['sentence'];
		if (mode === 'input') return ['reading', 'meaning'];
		return ['reading', 'meaning', 'sentence'];
	}

	function collectSetup() {
		const quizMode = selectedMode();
		return {
			quizMode,
			types: typesForMode(quizMode),
			categoryParentId: document.getElementById('quiz-category-parent')?.value || null,
			categoryParentName: selectedOptionLabel('quiz-category-parent'),
			categoryId: document.getElementById('quiz-category')?.value || null,
			categoryName: selectedOptionLabel('quiz-category'),
			partParentId: document.getElementById('quiz-pos-parent')?.value || null,
			partParentName: selectedOptionLabel('quiz-pos-parent'),
			partOfSpeechId: document.getElementById('quiz-pos')?.value || null,
			partOfSpeechName: selectedOptionLabel('quiz-pos'),
			jlpt: document.getElementById('quiz-jlpt')?.value || null,
			order: document.getElementById('quiz-order')?.value || 'random',
			priority: document.getElementById('quiz-order')?.value === 'weak' ? 'wrong' : 'random',
			count: Math.max(1, Math.min(200, Number(document.getElementById('quiz-count-custom')?.value) || 20)),
			answerMode: quizMode === 'choice' || quizMode === 'sentence' ? 'choice' : quizMode === 'mixed' ? 'random' : 'input',
		};
	}

	function updatePageCopy() {
		const description = document.querySelector('.admin-page-heading p');
		if (description) description.textContent = copy(
			'주관식·4지선다·예문 빈칸·전체 혼합 중에서 선택하고 출제 범위를 설정합니다.',
			'記述式・4択・例文穴埋め・すべて混合から選び、出題範囲を設定します。',
		);
		mountModeSelector();
	}

	async function startQuizPreview() {
		const setup = collectSetup();
		sessionStorage.setItem('song_japanese_quiz_setup', JSON.stringify(setup));
		window.location.href = '/admin/japanese/quiz/play/';
	}

	async function initialize() {
		await window.AdminCommon?.ready;
		mountModeSelector();
		document.getElementById('quiz-category-parent')?.addEventListener('change', () => {
			rebuildChild('quiz-category-parent', 'quiz-category', categories, 'quizAllSubcategories', copy('전체', 'すべて'));
		});
		document.getElementById('quiz-pos-parent')?.addEventListener('change', () => {
			rebuildChild('quiz-pos-parent', 'quiz-pos', partsOfSpeech, 'quizAllSubcategories', copy('전체', 'すべて'));
		});
		document.querySelectorAll('[data-quiz-count]').forEach((button) => {
			button.addEventListener('click', () => setQuestionCount(button.dataset.quizCount));
		});
		document.getElementById('quiz-count-custom')?.addEventListener('input', (event) => setQuestionCount(event.target.value));
		document.getElementById('quiz-start')?.addEventListener('click', startQuizPreview);
		document.addEventListener('adminlanguagechange', () => {
			renderHierarchies();
			updatePageCopy();
		});
		await loadSetupData();
		setQuestionCount(20);
		updatePageCopy();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
