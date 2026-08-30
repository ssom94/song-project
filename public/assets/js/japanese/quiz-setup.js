(() => {
	const SETUP_KEY = 'song_public_japanese_quiz_setup';
	const HISTORY_KEY = 'song_public_japanese_quiz_history_v1';
	const RETRY_KEY = 'song_public_japanese_quiz_retry_questions';

	function byId(id) { return document.getElementById(id); }
	function language() { return document.body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja'; }
	function copy(ko, ja) { return language() === 'ko' ? ko : ja; }
	function studyMode() { return new URLSearchParams(location.search).get('study') === 'korean' ? 'korean' : 'japanese'; }

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

	function selectedMode() {
		return document.querySelector('[data-quiz-mode]:checked')?.dataset.quizMode || 'mixed';
	}

	function modeLabel(mode) {
		if (mode === 'input') return copy('주관식', '記述式');
		if (mode === 'choice') return copy('4지선다', '4択');
		if (mode === 'sentence') return copy('예문 빈칸', '例文穴埋め');
		return copy('전체 혼합', 'すべて混合');
	}

	function selectedText(select) {
		return select?.selectedOptions?.[0]?.textContent?.trim() || copy('전체', 'すべて');
	}

	function configureStudyMode() {
		if (studyMode() !== 'korean') return;
		const sentence = document.querySelector('[data-quiz-mode="sentence"]');
		if (sentence instanceof HTMLInputElement) {
			sentence.disabled = true;
			sentence.closest('label')?.classList.add('is-disabled');
		}
		if (selectedMode() === 'sentence') {
			const mixed = document.querySelector('[data-quiz-mode="mixed"]');
			if (mixed instanceof HTMLInputElement) mixed.checked = true;
		}
		const heading = document.querySelector('.jp-page-heading h1');
		const lead = document.querySelector('.jp-page-heading p:not(.jp-eyebrow)');
		if (heading) heading.textContent = copy('한국어 퀴즈 설정', '韓国語クイズ設定');
		if (lead) lead.textContent = copy('같은 단어 데이터를 사용해 일본어 단어를 보고 한국어 뜻을 학습합니다.', '同じ単語データを使い、日本語の単語を見て韓国語の意味を学習します。');
	}

	function typesForMode(mode) {
		if (studyMode() === 'korean') return ['meaning'];
		if (mode === 'choice') return ['meaning'];
		if (mode === 'sentence') return ['sentence'];
		if (mode === 'input') return ['reading', 'meaning'];
		return ['reading', 'meaning', 'sentence'];
	}

	function renderPreview() {
		const mode = selectedMode();
		const typeLabel = byId('quiz-preview-types');
		const scopeLabel = byId('quiz-preview-scope');
		const countLabel = byId('quiz-preview-count');
		if (typeLabel) typeLabel.textContent = modeLabel(mode);
		if (scopeLabel) {
			const values = [selectedText(byId('quiz-jlpt')), selectedText(byId('quiz-category')), selectedText(byId('quiz-part'))].filter(Boolean);
			const all = copy('전체', 'すべて');
			scopeLabel.textContent = values.every((value) => value === all) ? all : values.join(' · ');
		}
		if (countLabel) countLabel.textContent = copy(`${byId('quiz-count')?.value || 10}문제`, `${byId('quiz-count')?.value || 10}問`);
	}

	function buildSetup() {
		const category = byId('quiz-category');
		const part = byId('quiz-part');
		const quizMode = selectedMode();
		return {
			studyMode: studyMode(),
			quizMode,
			types: typesForMode(quizMode),
			jlpt: byId('quiz-jlpt')?.value || '',
			categoryId: Number(category?.value) || null,
			categoryName: selectedText(category),
			partId: Number(part?.value) || null,
			partName: selectedText(part),
			count: Math.max(1, Math.min(50, Number(byId('quiz-count')?.value) || 10)),
			priority: byId('quiz-priority')?.value || 'random',
		};
	}

	function startQuiz(event) {
		event.preventDefault();
		const setup = buildSetup();
		sessionStorage.removeItem(RETRY_KEY);
		sessionStorage.setItem(SETUP_KEY, JSON.stringify(setup));
		window.location.href = `/${language()}/japanese/quiz/play/?study=${setup.studyMode}`;
	}

	function startWrongOnly(event) {
		event.preventDefault();
		const wrongQuestions = [];
		const seen = new Set();
		for (const session of readHistory()) {
			for (const attempt of Array.isArray(session.attempts) ? session.attempts : []) {
				if (attempt.isCorrect || !attempt.questionSnapshot?.key || seen.has(attempt.questionSnapshot.key)) continue;
				if (studyMode() === 'korean' && attempt.questionSnapshot.type !== 'meaning') continue;
				seen.add(attempt.questionSnapshot.key);
				wrongQuestions.push(attempt.questionSnapshot);
			}
		}
		if (!wrongQuestions.length) {
			const message = byId('quiz-setup-message');
			if (message) {
				message.textContent = copy('저장된 오답이 없습니다. 먼저 퀴즈를 풀어 주세요.', '保存された誤答がありません。先にクイズを解いてください。');
				message.hidden = false;
			}
			return;
		}
		const setup = buildSetup();
		setup.count = Math.min(setup.count, wrongQuestions.length);
		setup.priority = 'wrong';
		sessionStorage.setItem(SETUP_KEY, JSON.stringify(setup));
		sessionStorage.setItem(RETRY_KEY, JSON.stringify(wrongQuestions.slice(0, setup.count)));
		window.location.href = `/${language()}/japanese/quiz/play/?study=${setup.studyMode}`;
	}

	function bind() {
		document.querySelectorAll('[data-quiz-mode], #quiz-jlpt, #quiz-category, #quiz-part, #quiz-count, #quiz-priority')
			.forEach((node) => node.addEventListener('change', renderPreview));
		byId('quiz-start')?.addEventListener('click', startQuiz);
		byId('quiz-start-wrong')?.addEventListener('click', startWrongOnly);
	}

	async function initialize() {
		configureStudyMode();
		await loadTaxonomy();
		bind();
		renderPreview();
		if (new URLSearchParams(location.search).get('wrong') === '1') {
			const priority = byId('quiz-priority');
			if (priority) priority.value = 'wrong';
		}
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
