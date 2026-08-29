(() => {
	const sampleQuestions = [
		{
			type: 'reading',
			badge: 'READING',
			level: 'N2',
			question: '扱う',
			answers: ['あつかう'],
			correct: 'あつかう',
			choices: ['あつかう', 'あずかる', 'あつまる', 'あたえる'],
			noteJa: '「扱う」は、物・情報・問題などを取り扱う意味で使います。',
			noteKo: '「扱う」는 물건·정보·문제 등을 다루다는 뜻으로 사용합니다.',
		},
		{
			type: 'meaning',
			badge: 'MEANING',
			level: 'N2',
			question: '対応',
			answers: ['대응', '대응하다', '대처', '대처하다'],
			correct: '대응, 대처',
			choices: ['대응', '확인', '회의', '변경'],
			noteJa: '状況や相手に合わせて処置・行動することを表します。',
			noteKo: '상황이나 상대에 맞춰 조치하거나 행동한다는 뜻입니다.',
		},
		{
			type: 'sentence',
			badge: 'SENTENCE',
			level: 'N2',
			question: 'この道具は丁寧に ＿＿＿＿ ください。',
			answers: ['扱って', 'あつかって'],
			correct: '扱って',
			choices: ['扱って', '集めて', '応じて', '選んで'],
			noteJa: '例文では「扱う」のて形「扱って」が入ります。',
			noteKo: '예문에서는 「扱う」의 て형인 「扱って」가 들어갑니다.',
		},
	];

	let current = 0;
	let correctCount = 0;
	let wrongCount = 0;
	let answered = false;
	let setup = {
		types: ['reading', 'meaning', 'sentence'],
		jlpt: null,
		categoryParentName: null,
		categoryName: null,
		partParentName: null,
		partOfSpeechName: null,
		count: 20,
		answerMode: 'input',
	};

	function byId(id) {
		return document.getElementById(id);
	}

	function t(key, fallback) {
		const value = window.AdminI18n?.t(key);
		return value && value !== key ? value : fallback;
	}

	function language() {
		return window.AdminI18n?.getLanguage?.() ?? 'ja';
	}

	function normalizeAnswer(value) {
		return String(value ?? '')
			.normalize('NFKC')
			.trim()
			.toLocaleLowerCase()
			.replace(/[。．.!！?？\s]+$/g, '');
	}

	function readSetup() {
		try {
			const raw = sessionStorage.getItem('song_japanese_quiz_setup');
			if (!raw) return;
			const parsed = JSON.parse(raw);
			if (!parsed || typeof parsed !== 'object') return;
			const types = Array.isArray(parsed.types)
				? parsed.types.filter((value) => ['reading', 'meaning', 'sentence'].includes(value))
				: [];
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

	function filteredSamples() {
		const filtered = sampleQuestions.filter((question) => setup.types.includes(question.type));
		return filtered.length ? filtered : sampleQuestions;
	}

	function activeQuestion() {
		const samples = filteredSamples();
		return samples[current % samples.length];
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

	function answerModeText() {
		return setup.answerMode === 'choice'
			? t('playChoiceMode', '4択')
			: t('playInputMode', '直接入力');
	}

	function scopeLabel(primary, secondary) {
		return secondary || primary || t('playAll', 'すべて');
	}

	function renderSession() {
		byId('quiz-play-total').textContent = String(setup.count);
		byId('quiz-play-session-count').textContent = String(setup.count);
		byId('quiz-play-session-types').textContent = String(setup.types.length);
		byId('quiz-play-session-jlpt').textContent = setup.jlpt || t('playAll', 'すべて');
		byId('quiz-play-session-category').textContent = scopeLabel(setup.categoryParentName, setup.categoryName);
		byId('quiz-play-session-pos').textContent = scopeLabel(setup.partParentName, setup.partOfSpeechName);
		byId('quiz-play-session-mode').textContent = answerModeText();
	}

	function renderChoices(question) {
		const container = byId('quiz-play-choices');
		container.replaceChildren();
		for (const value of question.choices) {
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
		const number = current + 1;
		const progress = Math.min(100, (number / setup.count) * 100);
		byId('quiz-play-current').textContent = String(number);
		byId('quiz-play-progress-bar').style.width = `${progress}%`;
		byId('quiz-play-type-label').textContent = typeText(question.type);
		byId('quiz-play-type-badge').textContent = question.badge;
		byId('quiz-play-level').textContent = setup.jlpt || question.level;
		byId('quiz-play-instruction').textContent = instructionText(question.type);

		const questionNode = byId('quiz-play-question');
		questionNode.classList.toggle('is-sentence', question.type === 'sentence');
		questionNode.replaceChildren();
		if (question.type === 'sentence') {
			const [before, after = ''] = question.question.split('＿＿＿＿');
			questionNode.append(document.createTextNode(before));
			const blank = document.createElement('mark');
			blank.textContent = '＿＿＿＿';
			questionNode.append(blank, document.createTextNode(after));
		} else {
			questionNode.textContent = question.question;
		}

		const form = byId('quiz-play-form');
		const choices = byId('quiz-play-choices');
		const input = byId('quiz-play-answer');
		form.hidden = setup.answerMode === 'choice';
		choices.hidden = setup.answerMode !== 'choice';
		input.value = '';
		input.disabled = false;
		byId('quiz-play-submit').disabled = false;
		byId('quiz-play-feedback').hidden = true;
		byId('quiz-play-next').hidden = true;
		byId('quiz-play-skip').hidden = false;
		renderChoices(question);
		if (setup.answerMode === 'input') input.focus();
	}

	function lockChoices(selectedButton, isCorrect) {
		byId('quiz-play-choices').querySelectorAll('button').forEach((button) => {
			button.disabled = true;
			const isAnswer = activeQuestion().answers.some((answer) => normalizeAnswer(answer) === normalizeAnswer(button.textContent));
			if (isAnswer) button.classList.add('is-correct');
		});
		if (selectedButton && !isCorrect) selectedButton.classList.add('is-wrong');
	}

	function showFeedback(isCorrect, selectedButton = null) {
		const question = activeQuestion();
		const feedback = byId('quiz-play-feedback');
		feedback.hidden = false;
		feedback.dataset.result = isCorrect ? 'correct' : 'wrong';
		byId('quiz-play-feedback-title').textContent = isCorrect
			? t('playCorrectFeedback', '正解です')
			: t('playWrongFeedback', 'もう一度確認しましょう');
		byId('quiz-play-correct-answer').textContent = question.correct;
		byId('quiz-play-feedback-note').textContent = language() === 'ko' ? question.noteKo : question.noteJa;
		byId('quiz-play-correct').textContent = String(correctCount);
		byId('quiz-play-wrong').textContent = String(wrongCount);
		byId('quiz-play-answer').disabled = true;
		byId('quiz-play-submit').disabled = true;
		if (setup.answerMode === 'choice') lockChoices(selectedButton, isCorrect);
		byId('quiz-play-skip').hidden = true;
		byId('quiz-play-next').hidden = false;
	}

	function grade(answer, selectedButton = null) {
		if (answered) return;
		answered = true;
		const question = activeQuestion();
		const normalized = normalizeAnswer(answer);
		const isCorrect = question.answers.some((value) => normalizeAnswer(value) === normalized);
		if (isCorrect) correctCount += 1;
		else wrongCount += 1;
		showFeedback(isCorrect, selectedButton);
	}

	function answerCurrent(event) {
		event.preventDefault();
		const answer = normalizeAnswer(byId('quiz-play-answer').value);
		if (!answer) {
			byId('quiz-play-answer').focus();
			return;
		}
		grade(answer);
	}

	function answerChoice(value, button) {
		grade(value, button);
	}

	function skipCurrent() {
		if (answered) return;
		answered = true;
		wrongCount += 1;
		showFeedback(false);
	}

	function nextQuestion() {
		if (current + 1 >= setup.count) {
			sessionStorage.setItem('song_japanese_quiz_result', JSON.stringify({
				correct: correctCount,
				wrong: wrongCount,
				total: setup.count,
				setup,
			}));
			window.location.href = '/admin/japanese/quiz/';
			return;
		}
		current += 1;
		renderQuestion();
	}

	function rerenderLanguage() {
		renderSession();
		const question = activeQuestion();
		byId('quiz-play-type-label').textContent = typeText(question.type);
		byId('quiz-play-instruction').textContent = instructionText(question.type);
		if (!byId('quiz-play-feedback').hidden) {
			byId('quiz-play-feedback-note').textContent = language() === 'ko' ? question.noteKo : question.noteJa;
		}
	}

	async function initialize() {
		await window.AdminCommon?.ready;
		readSetup();
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