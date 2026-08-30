(() => {
	function normalize(value) {
		return String(value ?? '')
			.normalize('NFKC')
			.trim()
			.toLocaleLowerCase()
			.replace(/[。．.!！?？\s]+$/g, '');
	}

	function meaningAnswers(value) {
		const original = String(value ?? '').trim();
		if (!original) return [];
		const values = original
			.split(/[\r\n,/／、;；·|]+/)
			.map((item) => item.trim())
			.filter(Boolean);
		return [...new Set(values)];
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
			if (!text || seen.has(key)) continue;
			seen.add(key);
			result.push(text);
		}
		return result;
	}

	function choicesFor(type, word, allWords, correct) {
		let distractors = [];
		if (type === 'reading') distractors = allWords.map((item) => item.reading);
		else if (type === 'meaning') distractors = allWords.map((item) => meaningAnswers(item.meaningKo)[0]);
		else distractors = allWords.map((item) => item.word);
		const candidates = unique([correct, ...shuffled(distractors)]).filter((value) => normalize(value) !== normalize(correct));
		return shuffled(unique([correct, ...candidates.slice(0, 3)]));
	}

	function sentencePrompt(word) {
		const sentence = String(word?.example?.sentence ?? '');
		const target = String(word?.word ?? '');
		if (!sentence || !target || !sentence.includes(target)) return null;
		return sentence.replace(target, '＿＿＿＿');
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

	function buildQuestion(word, type, allWords) {
		if (!word?.id || !word?.word) return null;
		const hints = hintData(word);
		if (type === 'reading') {
			if (!word.reading) return null;
			return {
				wordId: Number(word.id), type: 'reading', prompt: word.word,
				answers: [word.reading], correct: word.reading,
				choices: choicesFor('reading', word, allWords, word.reading),
				level: word.jlpt ?? '', word: word.word, hints,
			};
		}
		if (type === 'meaning') {
			const answers = meaningAnswers(word.meaningKo);
			if (!answers.length) return null;
			return {
				wordId: Number(word.id), type: 'meaning', prompt: word.word,
				answers, correct: answers.join(' / '),
				choices: choicesFor('meaning', word, allWords, answers[0]),
				level: word.jlpt ?? '', word: word.word, hints,
			};
		}
		if (type === 'sentence') {
			const prompt = sentencePrompt(word);
			if (!prompt) return null;
			return {
				wordId: Number(word.id), type: 'sentence', prompt,
				answers: [word.word], correct: word.word,
				choices: choicesFor('sentence', word, allWords, word.word),
				level: word.jlpt ?? '', word: word.word, hints,
			};
		}
		return null;
	}

	function buildQuestions(words, setup = {}) {
		const activeWords = Array.isArray(words) ? words.filter((word) => word?.id && word?.word) : [];
		const types = Array.isArray(setup.types) && setup.types.length
			? setup.types.filter((type) => ['reading', 'meaning', 'sentence'].includes(type))
			: ['reading', 'meaning', 'sentence'];
		const retryItems = Array.isArray(setup.retryItems) ? setup.retryItems : null;
		let pool = [];
		if (retryItems?.length) {
			for (const item of retryItems) {
				const word = activeWords.find((candidate) => Number(candidate.id) === Number(item.wordId));
				const question = buildQuestion(word, item.type, activeWords);
				if (question) pool.push(question);
			}
		} else {
			for (const word of activeWords) {
				for (const type of types) {
					const question = buildQuestion(word, type, activeWords);
					if (question) pool.push(question);
				}
			}
		}
		pool = shuffled(pool);
		const requested = Math.max(1, Math.min(200, Number(setup.count) || 10));
		return pool.slice(0, Math.min(requested, pool.length));
	}

	function isCorrect(question, answer) {
		const value = normalize(answer);
		return Boolean(value) && Array.isArray(question?.answers)
			&& question.answers.some((expected) => normalize(expected) === value);
	}

	window.JapaneseQuizEngine = { normalize, meaningAnswers, shuffled, buildQuestions, isCorrect };
})();
