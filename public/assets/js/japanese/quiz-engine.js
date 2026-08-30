(() => {
	function normalize(value) {
		return String(value ?? '')
			.normalize('NFKC')
			.trim()
			.toLocaleLowerCase()
			.replace(/[。．.!！?？\s]+$/g, '');
	}

	function meaningAnswers(value) {
		const source = String(value ?? '').trim();
		if (!source) return [];
		return unique(source.split(/[\r\n,/／、;；·|]+/));
	}

	function shuffled(values) {
		const result = [...values];
		for (let index = result.length - 1; index > 0; index -= 1) {
			const random = new Uint32Array(1);
			crypto.getRandomValues(random);
			const target = random[0] % (index + 1);
			[result[index], result[target]] = [result[target], result[index]];
		}
		return result;
	}

	function unique(values) {
		const result = [];
		const seen = new Set();
		for (const value of values) {
			const text = String(value ?? '').trim();
			const key = normalize(text);
			if (!text || !key || seen.has(key)) continue;
			seen.add(key);
			result.push(text);
		}
		return result;
	}

	function sentencePrompt(word) {
		const sentence = String(word?.example?.sentence ?? '');
		const target = String(word?.word ?? '');
		if (!sentence || !target || !sentence.includes(target)) return null;
		return sentence.split(target).join('□□□□');
	}

	function hintData(word) {
		return {
			sentence: String(word?.example?.sentence ?? ''),
			sentenceReading: String(word?.example?.reading ?? ''),
			translationKo: String(word?.example?.translationKo ?? ''),
			reading: String(word?.reading ?? ''),
			meaningKo: String(word?.meaningKo ?? ''),
		};
	}

	function commonQuestion(word) {
		return {
			wordId: Number(word.id),
			word: word.word,
			level: word.jlpt ?? '',
			previousLearningState: word.learningState || 'unlearned',
			wrongCount: Number(word.wrongCount || 0),
			hints: hintData(word),
		};
	}

	function meaningChoices(word, allWords) {
		const answers = meaningAnswers(word?.meaningKo);
		if (!answers.length) return null;
		const answerKeys = new Set(answers.map(normalize));
		const correct = answers[0];
		const distractors = [];
		for (const other of shuffled(allWords)) {
			if (Number(other?.id) === Number(word?.id)) continue;
			const candidate = meaningAnswers(other?.meaningKo)[0];
			const key = normalize(candidate);
			if (!candidate || !key || answerKeys.has(key)) continue;
			if (distractors.some((value) => normalize(value) === key)) continue;
			distractors.push(candidate);
			if (distractors.length === 3) break;
		}
		if (distractors.length !== 3) return null;
		return { correct, choices: shuffled([correct, ...distractors]) };
	}

	function inputReading(word) {
		if (!word?.id || !word?.word || !word.reading) return null;
		const answers = unique([word.reading]);
		if (!answers.length) return null;
		return {
			...commonQuestion(word),
			key: `${word.id}:reading:input`,
			type: 'reading',
			answerMode: 'input',
			prompt: word.word,
			answers,
			correct: answers.join(' / '),
			choices: [],
		};
	}

	function inputMeaning(word) {
		if (!word?.id || !word?.word) return null;
		const answers = meaningAnswers(word.meaningKo);
		if (!answers.length) return null;
		return {
			...commonQuestion(word),
			key: `${word.id}:meaning:input`,
			type: 'meaning',
			answerMode: 'input',
			prompt: word.word,
			answers,
			correct: answers.join(' / '),
			choices: [],
		};
	}

	function choiceMeaning(word, allWords) {
		if (!word?.id || !word?.word) return null;
		const answers = meaningAnswers(word.meaningKo);
		const choiceSet = meaningChoices(word, allWords);
		if (!answers.length || !choiceSet) return null;
		return {
			...commonQuestion(word),
			key: `${word.id}:meaning:choice`,
			type: 'meaning',
			answerMode: 'choice',
			prompt: word.word,
			answers,
			correct: answers.join(' / '),
			choiceCorrect: choiceSet.correct,
			choices: choiceSet.choices,
		};
	}

	function inputSentence(word) {
		if (!word?.id || !word?.word) return null;
		const prompt = sentencePrompt(word);
		if (!prompt) return null;
		return {
			...commonQuestion(word),
			key: `${word.id}:sentence:input`,
			type: 'sentence',
			answerMode: 'input',
			prompt,
			answers: [word.word],
			correct: word.word,
			choices: [],
		};
	}

	function normalizeMode(setup = {}) {
		if (['input', 'choice', 'sentence', 'mixed'].includes(setup.quizMode)) return setup.quizMode;
		if (setup.answerMode === 'choice') return 'choice';
		if (setup.answerMode === 'random') return 'mixed';
		if (Array.isArray(setup.types) && setup.types.length === 1 && setup.types[0] === 'sentence') return 'sentence';
		return 'input';
	}

	function allowedTypes(setup, mode) {
		const requested = Array.isArray(setup.types)
			? setup.types.filter((type) => ['reading', 'meaning', 'sentence'].includes(type))
			: [];
		if (requested.length) return requested;
		if (mode === 'choice') return ['meaning'];
		if (mode === 'sentence') return ['sentence'];
		if (mode === 'input') return ['reading', 'meaning'];
		return ['reading', 'meaning', 'sentence'];
	}

	function buildCandidates(words, setup = {}) {
		const mode = normalizeMode(setup);
		const types = allowedTypes(setup, mode);
		const pool = [];
		for (const word of words) {
			if ((mode === 'input' || mode === 'mixed') && types.includes('reading')) {
				const question = inputReading(word);
				if (question) pool.push(question);
			}
			if ((mode === 'input' || mode === 'mixed') && types.includes('meaning')) {
				const question = inputMeaning(word);
				if (question) pool.push(question);
			}
			if ((mode === 'choice' || mode === 'mixed') && types.includes('meaning')) {
				const question = choiceMeaning(word, words);
				if (question) pool.push(question);
			}
			if ((mode === 'sentence' || mode === 'mixed') && types.includes('sentence')) {
				const question = inputSentence(word);
				if (question) pool.push(question);
			}
		}
		return pool;
	}

	function applyPriority(pool, setup = {}) {
		const randomized = shuffled(pool);
		const priority = setup.priority || (setup.order === 'weak' ? 'wrong' : setup.order);
		if (priority === 'wrong' || priority === 'weak') {
			return randomized.sort((a, b) => Number(b.wrongCount || 0) - Number(a.wrongCount || 0));
		}
		if (priority === 'new') {
			return randomized.sort((a, b) => {
				const aNew = a.previousLearningState === 'unlearned' && Number(a.wrongCount || 0) === 0 ? 1 : 0;
				const bNew = b.previousLearningState === 'unlearned' && Number(b.wrongCount || 0) === 0 ? 1 : 0;
				return bNew - aNew;
			});
		}
		return randomized;
	}

	function buildRetryQuestions(activeWords, retryItems, setup) {
		const result = [];
		for (const item of retryItems) {
			const word = activeWords.find((candidate) => Number(candidate.id) === Number(item.wordId));
			if (!word) continue;
			let question = null;
			if (item.answerMode === 'choice' && item.type === 'meaning') question = choiceMeaning(word, activeWords);
			else if (item.type === 'sentence') question = inputSentence(word);
			else if (item.type === 'meaning') question = inputMeaning(word);
			else if (item.type === 'reading') question = inputReading(word);
			if (question) result.push(question);
		}
		return applyPriority(result, setup);
	}

	function buildQuestions(words, setup = {}) {
		const activeWords = Array.isArray(words) ? words.filter((word) => word?.id && word?.word) : [];
		const retryItems = Array.isArray(setup.retryItems) ? setup.retryItems : null;
		const pool = retryItems?.length
			? buildRetryQuestions(activeWords, retryItems, setup)
			: applyPriority(buildCandidates(activeWords, setup), setup);
		const requested = Math.max(1, Math.min(200, Number(setup.count) || 10));
		return pool.slice(0, Math.min(requested, pool.length));
	}

	function isCorrect(question, answer) {
		const value = normalize(answer);
		return Boolean(value) && Array.isArray(question?.answers)
			&& question.answers.some((expected) => normalize(expected) === value);
	}

	window.JapaneseQuizEngine = {
		normalize,
		meaningAnswers,
		shuffled,
		buildQuestions,
		isCorrect,
		normalizeMode,
	};
})();
