(() => {
	const SETUP_KEY = 'song_public_japanese_quiz_setup';
	const HISTORY_KEY = 'song_public_japanese_quiz_history_v1';
	const RETRY_KEY = 'song_public_japanese_quiz_retry_questions';

	function byId(id) { return document.getElementById(id); }
	function language() { return document.body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja'; }
	function copy(ko, ja) { return language() === 'ko' ? ko : ja; }

	function readHistory() {
		try {
			const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
			return Array.isArray(value) ? value : [];
		} catch {
			return [];
		}
	}

	function option(select, value, text) {
		const node = document.createElement('option');
		node.value = String(value);
		node.textContent = text;
		select.appendChild(node);
	}

	function localizedName(item) {
		return language() === 'ko' ? (item.nameKo || item.nameJa || '') : (item.nameJa || item.nameKo || '');
	}

	function renderHierarchicalOptions(select, items) {
		const roots = items.filter((item) => item.parentId == null);
		const children = new Map();
		for (const item of items) {
			if (item.parentId == null) continue;
			if (!children.has(item.parentId)) children.set(item.parentId, []);
			children.get(item.parentId).push(item);
		}
		for (const root of roots) {
			option(select, root.id, localizedName(root));
			for (const child of children.get(root.id) || []) option(select, child.id, `└ ${localizedName(child)}`);
		}
	}

	async function loadTaxonomy() {
		const category = byId('quiz-category');
		const part = byId('quiz-part');
		if (!category || !part) return;
		try {
			const response = await fetch('/api/public/japanese/taxonomy', { cache: 'no-store' });
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) return;
			category.length = 1;
			part.length = 1;
			renderHierarchicalOptions(category, Array.isArray(result.categories) ? result.categories : []);
			renderHierarchicalOptions(part, Array.isArray(result.parts) ? result.parts : []);
		} catch (error) {
			console.warn('Failed to load quiz taxonomy', error);
		}
	}

	function selectedTypes() {
		return [...document.querySelectorAll('[data-quiz-type]:checked')].map((node) => node.dataset.quizType).filter(Boolean);
	}

	function selectedText(select) {
		return select?.selectedOptions?.[0]?.textContent?.trim() || copy('전체', 'すべて');
	}

	function renderPreview() {
		const types = selectedTypes();
		const typeLabel = byId('quiz-preview-types');
		const scopeLabel = byId('quiz-preview-scope');
		const countLabel = byId('quiz-preview-count');
		if (typeLabel) typeLabel.textContent = copy(`${types.length}종`, `${types.length}種`);
		if (scopeLabel) {
			const values = [selectedText(byId('quiz-jlpt')), selectedText(byId('quiz-category')), selectedText(byId('quiz-part'))]
				.filter((value, index, array) => value && (value !== copy('전체', 'すべて') || array.every((entry) => entry === value)));
			scopeLabel.textContent = values.every((value) => value === copy('전체', 'すべて')) ? copy('전체', 'すべて') : values.join(' · ');
		}
		if (countLabel) countLabel.textContent = copy(`${byId('quiz-count')?.value || 10}문제`, `${byId('quiz-count')?.value || 10}問`);
	}

	function buildSetup() {
		const category = byId('quiz-category');
		const part = byId('quiz-part');
		return {
			types: selectedTypes(),
			jlpt: byId('quiz-jlpt')?.value || '',
			categoryId: Number(category?.value) || null,
			categoryName: selectedText(category),
			partId: Number(part?.value) || null,
			partName: selectedText(part),
			count: Math.max(1, Math.min(50, Number(byId('quiz-count')?.value) || 10)),
			answerMode: byId('quiz-answer-mode')?.value || 'input',
			priority: byId('quiz-priority')?.value || 'random',
		};
	}

	function startQuiz(event) {
		event.preventDefault();
		const setup = buildSetup();
		if (!setup.types.length) {
			byId('quiz-setup-message').textContent = copy('문제 유형을 하나 이상 선택해 주세요.', '問題形式を1つ以上選択してください。');
			byId('quiz-setup-message').hidden = false;
			return;
		}
		sessionStorage.removeItem(RETRY_KEY);
		sessionStorage.setItem(SETUP_KEY, JSON.stringify(setup));
		window.location.href = `/${language()}/japanese/quiz/play/`;
	}

	function startWrongOnly(event) {
		event.preventDefault();
		const wrongQuestions = [];
		const seen = new Set();
		for (const session of readHistory()) {
			for (const attempt of Array.isArray(session.attempts) ? session.attempts : []) {
				if (attempt.isCorrect || !attempt.questionSnapshot?.key || seen.has(attempt.questionSnapshot.key)) continue;
				seen.add(attempt.questionSnapshot.key);
				wrongQuestions.push(attempt.questionSnapshot);
			}
		}
		if (!wrongQuestions.length) {
			const message = byId('quiz-setup-message');
			message.textContent = copy('저장된 오답이 없습니다. 먼저 퀴즈를 풀어 주세요.', '保存された誤答がありません。先にクイズを解いてください。');
			message.hidden = false;
			return;
		}
		const setup = buildSetup();
		setup.count = Math.min(setup.count, wrongQuestions.length);
		setup.priority = 'wrong';
		sessionStorage.setItem(SETUP_KEY, JSON.stringify(setup));
		sessionStorage.setItem(RETRY_KEY, JSON.stringify(wrongQuestions.slice(0, setup.count)));
		window.location.href = `/${language()}/japanese/quiz/play/`;
	}

	function bind() {
		document.querySelectorAll('[data-quiz-type], #quiz-jlpt, #quiz-category, #quiz-part, #quiz-count, #quiz-answer-mode, #quiz-priority')
			.forEach((node) => node.addEventListener('change', renderPreview));
		byId('quiz-start')?.addEventListener('click', startQuiz);
		byId('quiz-start-wrong')?.addEventListener('click', startWrongOnly);
	}

	async function initialize() {
		await loadTaxonomy();
		bind();
		renderPreview();
		if (new URLSearchParams(location.search).get('wrong') === '1') byId('quiz-priority').value = 'wrong';
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
