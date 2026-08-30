(() => {
	let current = 0;
	let correctCount = 0;
	let wrongCount = 0;
	let answered = false;
	let attempts = [];
	let questions = [];
	let startedAt = null;
	let hintLevel = 0;
	let setup = {
		quizMode: 'mixed',
		types: ['reading', 'meaning', 'sentence'],
		jlpt: null,
		categoryParentId: null,
		categoryParentName: null,
		categoryId: null,
		categoryName: null,
		partParentId: null,
		partParentName: null,
		partOfSpeechId: null,
		partOfSpeechName: null,
		count: 20,
		priority: 'random',
		order: 'random',
	};

	function byId(id) { return document.getElementById(id); }
	function t(key, fallback) {
		const value = window.AdminI18n?.t(key);
		return value && value !== key ? value : fallback;
	}
	function language() { return window.AdminI18n?.getLanguage?.() ?? 'ja'; }
	function copy(ko, ja) { return language() === 'ko' ? ko : ja; }
	function activeQuestion() { return questions[current] ?? null; }
	function scopeLabel(primary, secondary) { return secondary || primary || copy('전체', 'すべて'); }
	function choiceValue(choice) { return typeof choice === 'object' && choice !== null ? String(choice.value ?? '') : String(choice ?? ''); }
	function choiceLabel(choice) { return typeof choice === 'object' && choice !== null ? String(choice.label ?? choice.value ?? '') : String(choice ?? ''); }

	function installEnhancementStyle() {
		if (document.querySelector('link[data-admin-quiz-learning-style]')) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '/assets/css/admin/japanese-quiz-learning-state.css';
		link.dataset.adminQuizLearningStyle = 'true';
		document.head.appendChild(link);
	}

	function typesForMode(mode) {
		if (mode === 'choice') return ['meaning'];
		if (mode === 'sentence') return ['sentence'];
		if (mode === 'input') return ['reading', 'meaning'];
		return ['reading', 'meaning', 'sentence'];
	}

	function readSetup() {
		try {
			const raw = sessionStorage.getItem('song_japanese_quiz_setup');
			if (!raw) return;
			const parsed = JSON.parse(raw);
			if (!parsed || typeof parsed !== 'object') return;
			const mode = window.JapaneseQuizEngine?.normalizeMode?.(parsed)
				|| (['input', 'choice', 'sentence', 'mixed'].includes(parsed.quizMode) ? parsed.quizMode : 'mixed');
			const requestedTypes = Array.isArray(parsed.types)
				? parsed.types.filter((value) => ['reading', 'meaning', 'sentence'].includes(value))
				: [];
			setup = {
				...setup,
				...parsed,
				quizMode: mode,
				types: requestedTypes.length ? requestedTypes : typesForMode(mode),
				count: Number.isInteger(Number(parsed.count)) ? Math.max(1, Math.min(200, Number(parsed.count))) : 20,
				priority: parsed.priority || (parsed.order === 'weak' ? 'wrong' : 'random'),
			};
		} catch (error) {
			console.warn('Failed to restore quiz setup', error);
		}
	}

	function modeText(mode = setup.quizMode) {
		if (mode === 'input') return copy('주관식', '記述式');
		if (mode === 'choice') return copy('4지선다', '4択');
		if (mode === 'sentence') return copy('예문 빈칸 · 4지선다', '例文穴埋め · 4択');
		return copy('전체 혼합', 'すべて混合');
	}

	function typeText(question) {
		if (question?.type === 'sentence') return copy('예문 빈칸 · 4지선다', '例文穴埋め · 4択');
		if (question?.answerMode === 'choice') return copy('4지선다 · 단어 → 한국어 뜻', '4択 · 単語 → 韓国語の意味');
		if (question?.type === 'meaning') return copy('주관식 · 단어 → 한국어 뜻', '記述式 · 単語 → 韓国語の意味');
		return copy('주관식 · 단어 → 히라가나', '記述式 · 単語 → ひらがな');
	}

	function instructionText(question) {
		if (question?.type === 'sentence') return copy('문장의 빈칸에 들어갈 일본어 단어를 4개의 보기 중에서 선택해 주세요.', '文の空欄に入る日本語の単語を4つの選択肢から選んでください。');
		if (question?.answerMode === 'choice') return copy('이 단어의 한국어 뜻을 4개의 보기 중에서 선택해 주세요.', 'この単語の韓国語の意味を4つの選択肢から選んでください。');
		if (question?.type === 'meaning') return copy('등록된 한국어 뜻 중 하나를 입력해 주세요.', '登録された韓国語の意味のうち1つを入力してください。');
		return copy('이 단어의 읽기를 히라가나로 입력해 주세요.', 'この単語の読み方をひらがなで入力してください。');
	}

	function acceptedAnswers(question) {
		return Array.isArray(question?.answers) ? question.answers.filter((value) => String(value ?? '').trim()) : [];
	}
	function firstCharacter(value) { return Array.from(String(value ?? '').trim())[0] || '—'; }
	function answerLength(value) { return Array.from(String(value ?? '').trim()).length; }

	function contextHint(question) {
		const hints = question?.hints ?? {};
		if (question?.type === 'sentence') {
			if (hints.translationKo) return copy(`문장 뜻: ${hints.translationKo}`, `文の韓国語訳: ${hints.translationKo}`);
			if (hints.sentenceReading) return copy(`문장 읽기: ${hints.sentenceReading}`, `文の読み: ${hints.sentenceReading}`);
			return copy('문장 자체가 문제에 표시되어 있습니다.', '文そのものが問題に表示されています。');
		}
		if (hints.sentence) return copy(`예문: ${hints.sentence}`, `例文: ${hints.sentence}`);
		return copy('등록된 예문이 없습니다.', '登録された例文がありません。');
	}

	function sentenceShapeText(question) {
		const surface = String(question?.word ?? '').trim();
		const reading = String(question?.hints?.reading ?? '').trim();
		if (!surface) return '';
		const chars = Array.from(surface);
		const kanji = chars.filter((char) => /\p{Script=Han}/u.test(char)).length;
		const kana = chars.filter((char) => /[\p{Script=Hiragana}\p{Script=Katakana}ー]/u.test(char)).length;
		const readingLength = Array.from(reading).length;
		let shape;
		if (kanji > 0 && kana > 0) shape = copy(`표기 ${chars.length}글자 (한자 ${kanji} · 가나 ${kana})`, `表記 ${chars.length}文字（漢字 ${kanji}・かな ${kana}）`);
		else if (kanji > 0) shape = copy(`한자 ${kanji}글자`, `漢字 ${kanji}文字`);
		else shape = copy(`표기 ${chars.length}글자`, `表記 ${chars.length}文字`);
		if (readingLength > 0) shape += copy(` · 히라가나 읽기 ${readingLength}글자`, ` · ひらがな読み ${readingLength}文字`);
		return `${shape}${copy(' · 한자/히라가나 모두 정답', ' · 漢字・ひらがなのどちらでも正解')}`;
	}

	function answerLengthText(question) {
		if (question?.type === 'sentence') return sentenceShapeText(question);
		if (question?.answerMode === 'choice') return copy('보기 4개 중 하나를 선택합니다.', '4つの選択肢から1つ選びます。');
		const answers = acceptedAnswers(question);
		if (!answers.length) return '';
		const lengths = answers.map((answer) => copy(`${answerLength(answer)}글자`, `${answerLength(answer)}文字`));
		const suffix = question.type === 'meaning' && answers.length > 1
			? copy(' · 등록된 뜻 중 하나만 맞혀도 정답', ' · 登録された意味のうち1つで正解')
			: '';
		return `${copy('정답 글자 수', '答えの文字数')}: ${lengths.join(' · ')}${suffix}`;
	}

	function ensureEnhancementUi() {
		installEnhancementStyle();
		const feedback = byId('quiz-play-feedback');
		if (!feedback) return;

		if (!byId('quiz-play-answer-length')) {
			const length = document.createElement('div');
			length.id = 'quiz-play-answer-length';
			length.className = 'admin-quiz-answer-length';
			feedback.insertAdjacentElement('beforebegin', length);
		}

		if (!byId('quiz-play-hint')) {
			const controls = document.createElement('div');
			controls.className = 'admin-quiz-hint-controls';
			const button = document.createElement('button');
			button.id = 'quiz-play-hint';
			button.className = 'admin-quiz-hint-button';
			button.type = 'button';
			button.addEventListener('click', requestHint);
			const guide = document.createElement('span');
			guide.id = 'quiz-play-hint-guide';
			controls.append(button, guide);

			const box = document.createElement('div');
			box.id = 'quiz-play-hint-box';
			box.className = 'admin-quiz-hint-box';
			box.hidden = true;
			const title = document.createElement('strong');
			title.id = 'quiz-play-hint-title';
			const text = document.createElement('p');
			text.id = 'quiz-play-hint-text';
			box.append(title, text);
			feedback.insertAdjacentElement('beforebegin', box);
			box.insertAdjacentElement('beforebegin', controls);
		}

		if (!byId('quiz-learning-state')) {
			const panel = document.createElement('div');
			panel.id = 'quiz-learning-state';
			panel.className = 'admin-quiz-learning-state';
			panel.hidden = true;
			const title = document.createElement('strong');
			title.dataset.learningStateTitle = 'true';
			const note = document.createElement('small');
			note.dataset.learningStateNote = 'true';
			const buttons = document.createElement('div');
			buttons.className = 'admin-quiz-learning-state-buttons';
			for (const state of ['mastered', 'uncertain', 'unlearned']) {
				const button = document.createElement('button');
				button.type = 'button';
				button.dataset.learningState = state;
				button.addEventListener('click', () => setCurrentLearningState(state));
				buttons.appendChild(button);
			}
			panel.append(title, note, buttons);
			feedback.insertAdjacentElement('afterend', panel);
		}
		applyEnhancementCopy();
	}

	function applyEnhancementCopy() {
		const panel = byId('quiz-learning-state');
		if (!panel) return;
		const title = panel.querySelector('[data-learning-state-title]');
		const note = panel.querySelector('[data-learning-state-note]');
		if (title) title.textContent = copy('이 단어의 학습 상태', 'この単語の学習状態');
		if (note) note.textContent = copy('선택한 상태는 현재 관리자 계정에 저장됩니다.', '選択した状態は現在の管理者アカウントに保存されます。');
		const labels = { mastered: copy('암기 완료', '習得済み'), uncertain: copy('애매함', 'あいまい'), unlearned: copy('미학습', '未習得') };
		panel.querySelectorAll('[data-learning-state]').forEach((button) => { button.textContent = labels[button.dataset.learningState] || button.dataset.learningState; });
	}

	function currentAttempt() { return attempts[attempts.length - 1] || null; }
	function setCurrentLearningState(state) {
		const attempt = currentAttempt();
		if (!attempt || attempt.questionIndex !== current) return;
		attempt.learningState = state;
		renderLearningState();
	}
	function renderLearningState() {
		const panel = byId('quiz-learning-state');
		if (!panel) return;
		const attempt = currentAttempt();
		panel.hidden = !answered || !attempt || attempt.questionIndex !== current;
		if (panel.hidden) return;
		panel.querySelectorAll('[data-learning-state]').forEach((button) => button.classList.toggle('is-selected', button.dataset.learningState === attempt.learningState));
	}

	function renderHint() {
		ensureEnhancementUi();
		const question = activeQuestion();
		const button = byId('quiz-play-hint');
		const guide = byId('quiz-play-hint-guide');
		const box = byId('quiz-play-hint-box');
		const title = byId('quiz-play-hint-title');
		const text = byId('quiz-play-hint-text');
		const length = byId('quiz-play-answer-length');
		if (!question || !button || !guide || !box || !title || !text || !length) return;
		length.textContent = answerLengthText(question);
		guide.textContent = copy('힌트 1: 문장 · 힌트 2: 첫 글자', 'ヒント1: 文 · ヒント2: 最初の文字');
		box.hidden = hintLevel === 0;
		if (hintLevel === 0) {
			button.textContent = copy('힌트 1 · 문장 보기', 'ヒント1 · 文を見る');
			button.disabled = answered;
			return;
		}
		if (hintLevel === 1) {
			title.textContent = copy('문장 힌트', '文のヒント');
			text.textContent = contextHint(question);
			button.textContent = copy('힌트 2 · 첫 글자 보기', 'ヒント2 · 最初の文字を見る');
			button.disabled = answered;
			return;
		}
		title.textContent = copy('문장 + 첫 글자 힌트', '文 + 最初の文字ヒント');
		const chars = acceptedAnswers(question).map(firstCharacter).filter(Boolean);
		text.textContent = `${contextHint(question)}\n${copy('첫 글자', '最初の文字')}: ${chars.join(' · ') || '—'}`;
		button.textContent = copy('힌트 사용 완료', 'ヒント使用済み');
		button.disabled = true;
	}

	function requestHint() {
		if (answered) return;
		if (hintLevel < 2) hintLevel += 1;
		renderHint();
	}

	function renderSession() {
		byId('quiz-play-total').textContent = String(questions.length || setup.count);
		byId('quiz-play-session-count').textContent = String(questions.length || setup.count);
		byId('quiz-play-session-types').textContent = String(setup.types.length);
		byId('quiz-play-session-jlpt').textContent = setup.jlpt || copy('전체', 'すべて');
		byId('quiz-play-session-category').textContent = scopeLabel(setup.categoryParentName, setup.categoryName);
		byId('quiz-play-session-pos').textContent = scopeLabel(setup.partParentName, setup.partOfSpeechName);
		byId('quiz-play-session-mode').textContent = modeText();
	}

	function poolUrl() {
		const params = new URLSearchParams();
		params.set('types', setup.types.join(','));
		params.set('count', String(Math.max(setup.count, 10)));
		if (setup.jlpt) params.set('jlpt', setup.jlpt);
		if (setup.categoryId) params.set('category', String(setup.categoryId));
		else if (setup.categoryParentId) params.set('categoryParent', String(setup.categoryParentId));
		if (setup.partOfSpeechId) params.set('part', String(setup.partOfSpeechId));
		else if (setup.partParentId) params.set('partParent', String(setup.partParentId));
		return `/api/public/japanese/quiz-pool?${params.toString()}`;
	}

	async function loadQuestions() {
		const response = await fetch(poolUrl(), { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
		const result = await response.json().catch(() => null);
		if (!response.ok || !result?.ok || !Array.isArray(result.words)) throw new Error('QUIZ_POOL_FAILED');
		questions = window.JapaneseQuizEngine?.buildQuestions?.(result.words, setup) ?? [];
		if (!questions.length) throw new Error('NO_QUESTIONS');
		startedAt = new Date().toISOString();
	}

	function renderChoices(question) {
		const container = byId('quiz-play-choices');
		container.replaceChildren();
		for (const choice of question.choices ?? []) {
			const value = choiceValue(choice);
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'admin-quiz-choice-button';
			button.textContent = choiceLabel(choice);
			button.dataset.answer = value;
			button.addEventListener('click', () => answerChoice(value, button));
			container.appendChild(button);
		}
	}

	function renderQuestion() {
		answered = false;
		hintLevel = 0;
		const question = activeQuestion();
		if (!question) return;
		const number = current + 1;
		const progress = Math.min(100, (number / questions.length) * 100);
		byId('quiz-play-current').textContent = String(number);
		byId('quiz-play-total').textContent = String(questions.length);
		byId('quiz-play-progress-bar').style.width = `${progress}%`;
		byId('quiz-play-type-label').textContent = typeText(question);
		byId('quiz-play-type-badge').textContent = question.type === 'sentence' ? 'SENTENCE' : question.answerMode === 'choice' ? 'CHOICE' : question.type === 'reading' ? 'READING' : 'MEANING';
		byId('quiz-play-level').textContent = question.level || '—';
		byId('quiz-play-instruction').textContent = instructionText(question);
		const questionMain = byId('quiz-play-question');
		questionMain.textContent = question.prompt;
		questionMain.classList.toggle('is-sentence', question.type === 'sentence');
		const form = byId('quiz-play-form');
		const choices = byId('quiz-play-choices');
		const input = byId('quiz-play-answer');
		const useChoice = question.answerMode === 'choice';
		form.hidden = useChoice;
		choices.hidden = !useChoice;
		input.value = '';
		input.disabled = false;
		byId('quiz-play-submit').disabled = false;
		byId('quiz-play-feedback').hidden = true;
		byId('quiz-play-next').hidden = true;
		byId('quiz-play-skip').hidden = false;
		const statePanel = byId('quiz-learning-state');
		if (statePanel) statePanel.hidden = true;
		renderChoices(question);
		renderHint();
		if (!useChoice) input.focus();
	}

	function lockChoices(selectedButton, isCorrect) {
		const question = activeQuestion();
		byId('quiz-play-choices').querySelectorAll('button').forEach((button) => {
			button.disabled = true;
			if (window.JapaneseQuizEngine?.isCorrect?.(question, button.dataset.answer || button.textContent)) button.classList.add('is-correct');
		});
		if (selectedButton && !isCorrect) selectedButton.classList.add('is-wrong');
	}

	function suggestedLearningState(question, isCorrect, skipped) {
		if (skipped || !isCorrect) return 'unlearned';
		if (hintLevel > 0 || question.answerMode === 'choice') return 'uncertain';
		return 'mastered';
	}

	function recordAttempt(answer, isCorrect, skipped = false) {
		const question = activeQuestion();
		const attempt = {
			questionIndex: current,
			wordId: question.wordId,
			type: question.type,
			question: question.prompt,
			prompt: question.prompt,
			answer: answer ?? '',
			correct: question.correct,
			isCorrect,
			answerMode: question.answerMode === 'choice' ? 'choice' : 'input',
			hintLevel,
			skipped,
			learningState: suggestedLearningState(question, isCorrect, skipped),
		};
		attempts.push(attempt);
		return attempt;
	}

	function showFeedback(isCorrect, selectedButton = null, skipped = false) {
		const question = activeQuestion();
		const feedback = byId('quiz-play-feedback');
		feedback.hidden = false;
		feedback.dataset.result = isCorrect ? 'correct' : 'wrong';
		byId('quiz-play-feedback-title').textContent = skipped
			? copy('잘 모르겠음 · 오답 처리', 'わからない · 不正解として記録')
			: isCorrect ? copy('정답입니다', '正解です') : copy('오답입니다', '不正解です');
		byId('quiz-play-correct-answer').textContent = question.correct;
		byId('quiz-play-feedback-note').textContent = copy(`등록 단어 「${question.word}」를 기준으로 채점했습니다.`, `登録単語「${question.word}」を基準に採点しました。`);
		byId('quiz-play-correct').textContent = String(correctCount);
		byId('quiz-play-wrong').textContent = String(wrongCount);
		byId('quiz-play-answer').disabled = true;
		byId('quiz-play-submit').disabled = true;
		if (question.answerMode === 'choice') lockChoices(selectedButton, isCorrect);
		byId('quiz-play-skip').hidden = true;
		byId('quiz-play-next').hidden = false;
		byId('quiz-play-next').textContent = current + 1 >= questions.length ? copy('결과 보기', '結果を見る') : copy('다음 문제', '次の問題');
		renderHint();
		renderLearningState();
	}

	function grade(answer, selectedButton = null) {
		if (answered) return;
		const normalized = window.JapaneseQuizEngine?.normalize?.(answer);
		if (!normalized) return;
		answered = true;
		const isCorrect = Boolean(window.JapaneseQuizEngine?.isCorrect?.(activeQuestion(), answer));
		if (isCorrect) correctCount += 1;
		else wrongCount += 1;
		recordAttempt(answer, isCorrect, false);
		showFeedback(isCorrect, selectedButton, false);
	}

	function answerCurrent(event) {
		event.preventDefault();
		const input = byId('quiz-play-answer');
		const answer = input.value;
		if (!window.JapaneseQuizEngine?.normalize?.(answer)) { input.focus(); return; }
		grade(answer);
	}
	function answerChoice(value, button) { grade(value, button); }
	function skipCurrent() {
		if (answered) return;
		answered = true;
		wrongCount += 1;
		recordAttempt('', false, true);
		showFeedback(false, null, true);
	}

	async function saveResult() {
		const completedAt = new Date().toISOString();
		const localResult = { correct: correctCount, wrong: wrongCount, total: questions.length, setup, attempts, startedAt, completedAt };
		sessionStorage.setItem('song_japanese_quiz_result', JSON.stringify(localResult));
		try {
			const payloadAttempts = attempts.map((attempt) => ({ wordId: attempt.wordId, type: attempt.type, answerMode: attempt.answerMode, answer: attempt.answer, learningState: attempt.learningState }));
			const response = await fetch('/api/admin/japanese/quiz/complete', {
				method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ setup, startedAt, attempts: payloadAttempts }),
			});
			const result = await response.json().catch(() => null);
			if (response.status === 401) { window.location.replace('/admin/login/'); return; }
			if (!response.ok || !result?.ok || !result.session?.id) throw new Error(result?.error || 'QUIZ_SAVE_FAILED');
			window.location.href = `/admin/japanese/quiz/result/?session=${encodeURIComponent(result.session.id)}`;
		} catch (error) {
			console.error('Failed to persist quiz result', error);
			window.location.href = '/admin/japanese/quiz/result/?local=1';
		}
	}

	async function nextQuestion() {
		if (!answered) return;
		if (current + 1 >= questions.length) {
			byId('quiz-play-next').disabled = true;
			await saveResult();
			return;
		}
		current += 1;
		renderQuestion();
	}

	function rerenderLanguage() {
		renderSession();
		applyEnhancementCopy();
		const question = activeQuestion();
		if (!question) return;
		byId('quiz-play-type-label').textContent = typeText(question);
		byId('quiz-play-instruction').textContent = instructionText(question);
		if (!byId('quiz-play-feedback').hidden) byId('quiz-play-feedback-note').textContent = copy(`등록 단어 「${question.word}」를 기준으로 채점했습니다.`, `登録単語「${question.word}」を基準に採点しました。`);
		renderHint();
		renderLearningState();
	}

	async function initialize() {
		await window.AdminCommon?.ready;
		readSetup();
		ensureEnhancementUi();
		try {
			await loadQuestions();
		} catch (error) {
			console.error('Failed to load registered-word quiz', error);
			await window.AdminCommon?.alert?.({
				titleFallback: copy('출제할 문제가 없습니다', '出題できる問題がありません'),
				messageFallback: copy('선택 조건의 단어 데이터를 확인해 주세요. 4지선다와 예문 빈칸은 서로 다른 보기 4개가 필요하며, 예문 빈칸은 해당 단어가 포함된 등록 예문도 필요합니다.', '選択条件の単語データを確認してください。4択と例文穴埋めには異なる選択肢が4つ必要で、例文穴埋めには対象単語を含む登録例文も必要です。'),
			});
			window.location.replace('/admin/japanese/quiz/');
			return;
		}
		renderSession();
		byId('quiz-play-form')?.addEventListener('submit', answerCurrent);
		byId('quiz-play-skip')?.addEventListener('click', skipCurrent);
		byId('quiz-play-next')?.addEventListener('click', nextQuestion);
		document.addEventListener('adminlanguagechange', rerenderLanguage);
		renderQuestion();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
