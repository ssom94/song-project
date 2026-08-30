(() => {
	const SETUP_KEY = 'song_public_japanese_quiz_setup';
	const HISTORY_KEY = 'song_public_japanese_quiz_history_v1';
	const RETRY_KEY = 'song_public_japanese_quiz_retry_questions';
	const query = new URLSearchParams(location.search);
	const focusWordId = Number(query.get('wordId')) || null;
	const focusWord = String(query.get('word') || '').trim();
	const quickMode = query.get('quick') === '1' && Number.isSafeInteger(focusWordId) && focusWordId > 0;
	let availabilityTimer = 0;
	let availableQuestionCount = null;

	function byId(id) { return document.getElementById(id); }
	function language() { return document.body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja'; }
	function copy(ko, ja) { return language() === 'ko' ? ko : ja; }
	function studyMode() { return query.get('study') === 'korean' ? 'korean' : 'japanese'; }

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

	function renderJlptOptions(taxonomy) {
		const wrap = byId('quiz-jlpt-options');
		if (!wrap) return;
		wrap.replaceChildren();
		const levels = (Array.isArray(taxonomy.levels) ? taxonomy.levels : [])
			.filter((level) => Number(level.wordCount ?? 0) > 0);
		const unsetCount = Number(taxonomy.unsetLevel?.wordCount ?? 0);
		const items = levels.map((level) => ({ value: level.code, label: level.code, count: Number(level.wordCount || 0) }));
		if (unsetCount > 0) items.push({ value: 'UNSET', label: copy('미지정', '未設定'), count: unsetCount });

		if (!items.length) {
			const empty = document.createElement('span');
			empty.className = 'jp-jlpt-loading';
			empty.textContent = copy('등록된 단어가 없습니다.', '登録単語がありません。');
			wrap.appendChild(empty);
			return;
		}

		for (const item of items) {
			const label = document.createElement('label');
			label.className = 'jp-jlpt-check';
			const input = document.createElement('input');
			input.type = 'checkbox';
			input.value = item.value;
			input.dataset.jlptFilter = 'true';
			const text = document.createElement('strong');
			text.textContent = item.label;
			const count = document.createElement('small');
			count.textContent = copy(`${item.count}개`, `${item.count}語`);
			label.append(input, text, count);
			wrap.appendChild(label);
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
			renderJlptOptions(result);
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

	function selectedJlpts() {
		return [...document.querySelectorAll('[data-jlpt-filter]:checked')]
			.map((input) => input.value)
			.filter((value) => ['N1', 'N2', 'N3', 'N4', 'N5', 'UNSET'].includes(value));
	}

	function selectedJlptLabel() {
		const values = selectedJlpts();
		if (!values.length) return copy('전체', 'すべて');
		return values.map((value) => value === 'UNSET' ? copy('미지정', '未設定') : value).join(' + ');
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

	function configureQuickMode() {
		if (!quickMode) return;
		const count = byId('quiz-count');
		if (count) {
			if (![...count.options].some((item) => item.value === '1')) option(count, '1', copy('1문제', '1問'));
			count.value = '1';
			count.disabled = true;
		}
		const message = byId('quiz-setup-message');
		if (message) {
			message.hidden = false;
			message.classList.add('is-info');
			message.textContent = copy(`「${focusWord}」 전용 퀵 퀴즈입니다. 선택한 방식으로 1문제를 출제합니다.`, `「${focusWord}」専用のクイッククイズです。選択した方式で1問出題します。`);
		}
	}

	function typesForMode(mode) {
		if (studyMode() === 'korean') return ['meaning'];
		if (mode === 'choice') return ['meaning'];
		if (mode === 'sentence') return ['sentence'];
		if (mode === 'input') return ['reading', 'meaning'];
		return ['reading', 'meaning', 'sentence'];
	}

	function requestedCount() {
		return quickMode ? 1 : Math.max(1, Math.min(50, Number(byId('quiz-count')?.value) || 10));
	}

	function availableFromStats(stats, mode) {
		if (!stats) return 0;
		if (studyMode() === 'korean') {
			if (mode === 'choice') return Number(stats.meaningChoice || 0);
			if (mode === 'input') return Number(stats.meaningInput || 0);
			if (mode === 'sentence') return 0;
			return Number(stats.meaningInput || 0) + Number(stats.meaningChoice || 0);
		}
		if (mode === 'input') return Number(stats.readingInput || 0) + Number(stats.meaningInput || 0);
		if (mode === 'choice') return Number(stats.meaningChoice || 0);
		if (mode === 'sentence') return Number(stats.sentenceChoice || 0);
		return Number(stats.readingInput || 0)
			+ Number(stats.meaningInput || 0)
			+ Number(stats.meaningChoice || 0)
			+ Number(stats.sentenceChoice || 0);
	}

	function poolParams({ preview = false } = {}) {
		const params = new URLSearchParams();
		params.set('types', typesForMode(selectedMode()).join(','));
		params.set('count', String(preview ? 200 : requestedCount()));
		if (preview) params.set('preview', '1');
		for (const level of selectedJlpts()) params.append('jlpt', level);
		const category = byId('quiz-category');
		const part = byId('quiz-part');
		if (category?.value) params.set('category', category.value);
		if (part?.value) params.set('part', part.value);
		if (focusWordId) params.set('focusWordId', String(focusWordId));
		return params;
	}

	function focusWordAvailable(result, mode) {
		const word = Array.isArray(result.words) ? result.words.find((item) => Number(item.id) === focusWordId) : null;
		if (!word) return false;
		const stats = result.availability || {};
		const hasInput = studyMode() === 'korean'
			? Boolean(word.meaningKo)
			: Boolean(word.reading || word.meaningKo);
		const hasChoice = Boolean(word.meaningKo) && Number(stats.meaningChoice || 0) > 0;
		const hasSentence = studyMode() !== 'korean'
			&& Boolean(word.example?.sentence && String(word.example.sentence).includes(String(word.word || '')))
			&& Number(stats.sentenceChoice || 0) > 0;
		if (mode === 'input') return hasInput;
		if (mode === 'choice') return hasChoice;
		if (mode === 'sentence') return hasSentence;
		return hasInput || hasChoice || hasSentence;
	}

	async function refreshAvailability() {
		const availableNode = byId('quiz-preview-available');
		const summary = byId('quiz-preview-summary');
		if (availableNode) availableNode.textContent = copy('계산 중…', '計算中…');
		try {
			const response = await fetch(`/api/public/japanese/quiz-pool?${poolParams({ preview: true }).toString()}`, { cache: 'no-store', credentials: 'same-origin' });
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error || `HTTP_${response.status}`);
			availableQuestionCount = quickMode
				? (focusWordAvailable(result, selectedMode()) ? 1 : 0)
				: availableFromStats(result.availability, selectedMode());
			const requested = requestedCount();
			const actual = Math.min(requested, availableQuestionCount);
			if (availableNode) availableNode.textContent = copy(`${availableQuestionCount}문제`, `${availableQuestionCount}問`);
			if (summary) {
				if (quickMode) {
					summary.textContent = availableQuestionCount > 0
						? copy(`「${focusWord}」에서 선택한 방식으로 1문제를 출제합니다.`, `「${focusWord}」から選択した方式で1問出題します。`)
						: copy(`「${focusWord}」에는 현재 선택한 방식으로 만들 수 있는 문제가 없습니다.`, `「${focusWord}」には現在選択した方式で作成できる問題がありません。`);
				} else {
					summary.textContent = copy(
						`현재 조건의 ${availableQuestionCount}문제 중 ${actual}문제를 랜덤으로 출제합니다.`,
						`現在の条件の${availableQuestionCount}問から${actual}問をランダムに出題します。`,
					);
				}
			}
			const start = byId('quiz-start');
			if (start) start.disabled = availableQuestionCount <= 0;
			renderPreview();
		} catch (error) {
			console.warn('Failed to calculate quiz availability', error);
			availableQuestionCount = null;
			if (availableNode) availableNode.textContent = '—';
			if (summary) summary.textContent = copy('출제 가능 문제 수를 계산하지 못했습니다.', '出題可能問題数を計算できませんでした。');
		}
	}

	function scheduleAvailability() {
		window.clearTimeout(availabilityTimer);
		availabilityTimer = window.setTimeout(refreshAvailability, 180);
	}

	function renderPreview() {
		const mode = selectedMode();
		const typeLabel = byId('quiz-preview-types');
		const scopeLabel = byId('quiz-preview-scope');
		const countLabel = byId('quiz-preview-count');
		if (typeLabel) typeLabel.textContent = modeLabel(mode);
		if (scopeLabel) {
			const values = [selectedJlptLabel(), selectedText(byId('quiz-category')), selectedText(byId('quiz-part'))].filter(Boolean);
			const all = copy('전체', 'すべて');
			scopeLabel.textContent = values.every((value) => value === all) ? all : values.join(' · ');
		}
		if (countLabel) {
			const requested = requestedCount();
			const actual = Number.isFinite(availableQuestionCount) ? Math.min(requested, availableQuestionCount) : requested;
			countLabel.textContent = copy(`${actual}문제`, `${actual}問`);
		}
	}

	function buildSetup() {
		const category = byId('quiz-category');
		const part = byId('quiz-part');
		const quizMode = selectedMode();
		const jlpts = selectedJlpts();
		return {
			studyMode: studyMode(),
			quizMode,
			types: typesForMode(quizMode),
			jlpts,
			jlpt: jlpts.length === 1 && jlpts[0] !== 'UNSET' ? jlpts[0] : '',
			categoryId: Number(category?.value) || null,
			categoryName: selectedText(category),
			partId: Number(part?.value) || null,
			partName: selectedText(part),
			count: Number.isFinite(availableQuestionCount) ? Math.max(1, Math.min(requestedCount(), availableQuestionCount)) : requestedCount(),
			priority: byId('quiz-priority')?.value || 'random',
			focusWordId: focusWordId || null,
			focusWord: focusWord || null,
			quick: quickMode,
		};
	}

	function startQuiz(event) {
		event.preventDefault();
		if (availableQuestionCount === 0) return;
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
		setup.focusWordId = null;
		setup.focusWord = null;
		setup.quick = false;
		setup.count = Math.min(setup.count, wrongQuestions.length);
		setup.priority = 'wrong';
		sessionStorage.setItem(SETUP_KEY, JSON.stringify(setup));
		sessionStorage.setItem(RETRY_KEY, JSON.stringify(wrongQuestions.slice(0, setup.count)));
		window.location.href = `/${language()}/japanese/quiz/play/?study=${setup.studyMode}`;
	}

	function bind() {
		document.querySelectorAll('[data-quiz-mode], #quiz-category, #quiz-part, #quiz-count, #quiz-priority')
			.forEach((node) => node.addEventListener('change', () => {
				renderPreview();
				scheduleAvailability();
			}));
		byId('quiz-jlpt-options')?.addEventListener('change', (event) => {
			if (!(event.target instanceof HTMLInputElement) || !event.target.matches('[data-jlpt-filter]')) return;
			renderPreview();
			scheduleAvailability();
		});
		byId('quiz-start')?.addEventListener('click', startQuiz);
		byId('quiz-start-wrong')?.addEventListener('click', startWrongOnly);
	}

	async function initialize() {
		configureStudyMode();
		await loadTaxonomy();
		configureQuickMode();
		bind();
		renderPreview();
		await refreshAvailability();
		if (query.get('wrong') === '1') {
			const priority = byId('quiz-priority');
			if (priority) priority.value = 'wrong';
		}
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
