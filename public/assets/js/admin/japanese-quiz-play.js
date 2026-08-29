(() => {
	let current = 0;
	let correctCount = 0;
	let wrongCount = 0;
	let answered = false;
	let attempts = [];
	let questions = [];
	let startedAt = null;
	let setup = {
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
		answerMode: 'input',
		order: 'random',
	};

	function byId(id) { return document.getElementById(id); }
	function t(key, fallback) {
		const value = window.AdminI18n?.t(key);
		return value && value !== key ? value : fallback;
	}
	function language() { return window.AdminI18n?.getLanguage?.() ?? 'ja'; }

	function readSetup() {
		try {
			const raw = sessionStorage.getItem('song_japanese_quiz_setup');
			if (!raw) return;
			const parsed = JSON.parse(raw);
			if (!parsed || typeof parsed !== 'object') return;
			const types = Array.isArray(parsed.types) ? parsed.types.filter((value) => ['reading', 'meaning', 'sentence'].includes(value)) : [];
			setup = {
				...setup,
				...parsed,
				types: types.length ? types : setup.types,
				count: Number.isInteger(Number(parsed.count)) ? Math.max(1, Math.min(200, Number(parsed.count))) : 20,
				answerMode: parsed.answerMode === 'choice' ? 'choice' : 'input',
			};
		} catch (error) {
			console.warn('Failed to restore quiz setup', error);
		}
	}

	function typeText(type) {
		const korean = language() === 'ko';
		if (type === 'meaning') return korean ? '단어 → 한국어 뜻' : '単語 → 韓国語の意味';
		if (type === 'sentence') return korean ? '예문 빈칸 → 단어' : '例文の空欄 → 単語';
		return korean ? '단어 → 히라가나' : '単語 → ひらがな';
	}
	function instructionText(type) {
		if (type === 'meaning') return t('playMeaningInstruction', '単語の韓国語の意味を入力してください。');
		if (type === 'sentence') return t('playSentenceInstruction', '文脈に合う単語を入力してください。');
		return t('playReadingInstruction', '次の単語の読み方をひらがなで入力してください。');
	}
	function answerModeText() { return setup.answerMode === 'choice' ? t('playChoiceMode', '4択') : t('playInputMode', '直接入力'); }
	function scopeLabel(primary, secondary) { return secondary || primary || t('playAll', 'すべて'); }
	function activeQuestion() { return questions[current] ?? null; }

	function renderSession() {
		byId('quiz-play-total').textContent = String(questions.length || setup.count);
		byId('quiz-play-session-count').textContent = String(questions.length || setup.count);
		byId('quiz-play-session-types').textContent = String(setup.types.length);
		byId('quiz-play-session-jlpt').textContent = setup.jlpt || t('playAll', 'すべて');
		byId('quiz-play-session-category').textContent = scopeLabel(setup.categoryParentName, setup.categoryName);
		byId('quiz-play-session-pos').textContent = scopeLabel(setup.partParentName, setup.partOfSpeechName);
		byId('quiz-play-session-mode').textContent = answerModeText();
	}

	function poolUrl() {
		const params = new URLSearchParams();
		params.set('types', setup.types.join(','));
		params.set('count', String(setup.count));
		if (setup.jlpt) params.set('jlpt', setup.jlpt);
		if (setup.categoryId) params.set('category', String(setup.categoryId));
		else if (setup.categoryParentId) params.set('categoryParent', String(setup.categoryParentId));
		if (setup.partOfSpeechId) params.set('part', String(setup.partOfSpeechId));
		else if (setup.partParentId) params.set('partParent', String(setup.partParentId));
		return `/api/public/japanese/quiz-pool?${params.toString()}`;
	}

	async function loadQuestions() {
		const response = await fetch(poolUrl(), { method: 'GET', cache: 'no-store' });
		const result = await response.json().catch(() => null);
		if (!response.ok || !result?.ok || !Array.isArray(result.words)) throw new Error('QUIZ_POOL_FAILED');
		questions = window.JapaneseQuizEngine?.buildQuestions?.(result.words, setup) ?? [];
		if (!questions.length) throw new Error('NO_QUESTIONS');
		startedAt = new Date().toISOString();
	}

	function renderChoices(question) {
		const container = byId('quiz-play-choices');
		container.replaceChildren();
		for (const value of question.choices ?? []) {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'admin-quiz-choice-button';
			button.textContent = value;
			button.addEventListener('click', () => answerChoice(value, button));
			container.appendChild(button);
		}
	}

	function renderQuestion() {
		answered = false;
		const question = activeQuestion();
		if (!question) return;
		const number = current + 1;
		const progress = Math.min(100, (number / questions.length) * 100);
		byId('quiz-play-current').textContent = String(number);
		byId('quiz-play-total').textContent = String(questions.length);
		byId('quiz-play-progress-bar').style.width = `${progress}%`;
		byId('quiz-play-type-label').textContent = typeText(question.type);
		byId('quiz-play-type-badge').textContent = question.type === 'reading' ? 'READING' : question.type === 'meaning' ? 'MEANING' : 'SENTENCE';
		byId('quiz-play-level').textContent = question.level || '—';
		byId('quiz-play-instruction').textContent = instructionText(question.type);
		byId('quiz-play-question').textContent = question.prompt;

		const form = byId('quiz-play-form');
		const choices = byId('quiz-play-choices');
		const input = byId('quiz-play-answer');
		const useChoice = setup.answerMode === 'choice' && (question.choices?.length ?? 0) >= 2;
		form.hidden = useChoice;
		choices.hidden = !useChoice;
		input.value = '';
		input.disabled = false;
		byId('quiz-play-submit').disabled = false;
		byId('quiz-play-feedback').hidden = true;
		byId('quiz-play-next').hidden = true;
		byId('quiz-play-skip').hidden = false;
		renderChoices(question);
		if (!useChoice) input.focus();
	}

	function lockChoices(selectedButton, isCorrect) {
		byId('quiz-play-choices').querySelectorAll('button').forEach((button) => {
			button.disabled = true;
			if (window.JapaneseQuizEngine?.isCorrect?.(activeQuestion(), button.textContent)) button.classList.add('is-correct');
		});
		if (selectedButton && !isCorrect) selectedButton.classList.add('is-wrong');
	}

	function showFeedback(isCorrect, selectedButton = null) {
		const question = activeQuestion();
		const feedback = byId('quiz-play-feedback');
		feedback.hidden = false;
		feedback.dataset.result = isCorrect ? 'correct' : 'wrong';
		byId('quiz-play-feedback-title').textContent = isCorrect ? t('playCorrectFeedback', '正解です') : t('playWrongFeedback', 'もう一度確認しましょう');
		byId('quiz-play-correct-answer').textContent = question.correct;
		byId('quiz-play-feedback-note').textContent = language() === 'ko'
			? `등록 단어 「${question.word}」를 기준으로 채점했습니다.`
			: `登録単語「${question.word}」を基準に採点しました。`;
		byId('quiz-play-correct').textContent = String(correctCount);
		byId('quiz-play-wrong').textContent = String(wrongCount);
		byId('quiz-play-answer').disabled = true;
		byId('quiz-play-submit').disabled = true;
		if (setup.answerMode === 'choice') lockChoices(selectedButton, isCorrect);
		byId('quiz-play-skip').hidden = true;
		byId('quiz-play-next').hidden = false;
		byId('quiz-play-next').textContent = current + 1 >= questions.length
			? (language() === 'ko' ? '결과 보기' : '結果を見る')
			: t('playNext', '次の問題');
	}

	function recordAttempt(answer, isCorrect) {
		const question = activeQuestion();
		attempts.push({
			wordId: question.wordId,
			type: question.type,
			question: question.prompt,
			answer: answer ?? '',
			correct: question.correct,
			isCorrect,
			answerMode: setup.answerMode === 'choice' ? 'choice' : 'input',
		});
	}

	function grade(answer, selectedButton = null) {
		if (answered) return;
		answered = true;
		const isCorrect = Boolean(window.JapaneseQuizEngine?.isCorrect?.(activeQuestion(), answer));
		if (isCorrect) correctCount += 1;
		else wrongCount += 1;
		recordAttempt(answer, isCorrect);
		showFeedback(isCorrect, selectedButton);
	}

	function answerCurrent(event) {
		event.preventDefault();
		const answer = byId('quiz-play-answer').value;
		if (!window.JapaneseQuizEngine?.normalize?.(answer)) { byId('quiz-play-answer').focus(); return; }
		grade(answer);
	}
	function answerChoice(value, button) { grade(value, button); }
	function skipCurrent() {
		if (answered) return;
		answered = true;
		wrongCount += 1;
		recordAttempt('', false);
		showFeedback(false);
	}

	async function saveResult() {
		const localResult = {
			correct: correctCount,
			wrong: wrongCount,
			total: questions.length,
			setup,
			attempts,
			startedAt,
			completedAt: new Date().toISOString(),
		};
		sessionStorage.setItem('song_japanese_quiz_result', JSON.stringify(localResult));
		try {
			const response = await fetch('/api/admin/japanese/quiz/complete', {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ setup, startedAt, attempts }),
			});
			const result = await response.json().catch(() => null);
			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			if (!response.ok || !result?.ok || !result.session?.id) throw new Error(result?.error || 'QUIZ_SAVE_FAILED');
			window.location.href = `/admin/japanese/quiz/result/?session=${encodeURIComponent(result.session.id)}`;
		} catch (error) {
			console.error('Failed to persist quiz result', error);
			window.location.href = '/admin/japanese/quiz/result/?local=1';
		}
	}

	async function nextQuestion() {
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
		const question = activeQuestion();
		if (!question) return;
		byId('quiz-play-type-label').textContent = typeText(question.type);
		byId('quiz-play-instruction').textContent = instructionText(question.type);
		if (!byId('quiz-play-feedback').hidden) {
			byId('quiz-play-feedback-note').textContent = language() === 'ko'
				? `등록 단어 「${question.word}」를 기준으로 채점했습니다.`
				: `登録単語「${question.word}」を基準に採点しました。`;
		}
	}

	async function initialize() {
		await window.AdminCommon?.ready;
		readSetup();
		try {
			await loadQuestions();
		} catch (error) {
			console.error('Failed to load registered-word quiz', error);
			await window.AdminCommon?.alert?.({
				titleFallback: language() === 'ko' ? '출제할 문제가 없습니다' : '出題できる問題がありません',
				messageFallback: language() === 'ko'
					? '선택한 조건에 맞는 등록 단어와 정답 데이터가 있는지 확인해 주세요.'
					: '選択条件に一致する登録単語と解答データを確認してください。',
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
