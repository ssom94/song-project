(() => {
	const SETUP_KEY = 'song_public_japanese_quiz_setup';
	const RESULT_KEY = 'song_public_japanese_quiz_result';
	const HISTORY_KEY = 'song_public_japanese_quiz_history_v1';
	const RETRY_KEY = 'song_public_japanese_quiz_retry_questions';

	let setup = null;
	let questions = [];
	let currentIndex = 0;
	let correctCount = 0;
	let wrongCount = 0;
	let answered = false;
	let attempts = [];
	let startedAt = Date.now();
	let hintLevel = 0;

	function byId(id) { return document.getElementById(id); }
	function language() { return document.body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja'; }
	function copy(ko, ja) { return language() === 'ko' ? ko : ja; }
	function normalize(value) {
		return String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase().replace(/[。．.!！?？\s]+$/g, '');
	}
	function shuffle(items) {
		const result = [...items];
		for (let index = result.length - 1; index > 0; index -= 1) {
			const random = new Uint32Array(1);
			crypto.getRandomValues(random);
			const swap = random[0] % (index + 1);
			[result[index], result[swap]] = [result[swap], result[index]];
		}
		return result;
	}
	function uniqueText(values) {
		const seen = new Set();
		const result = [];
		for (const value of values) {
			const text = String(value ?? '').trim();
			const key = normalize(text);
			if (!text || !key || seen.has(key)) continue;
			seen.add(key);
			result.push(text);
		}
		return result;
	}
	function splitAnswers(value) {
		const source = String(value ?? '').trim();
		if (!source) return [];
		return uniqueText(source.split(/[\r\n,、;；/／·|]+/g));
	}
	function readJson(storage, key, fallback = null) {
		try {
			const raw = storage.getItem(key);
			return raw ? JSON.parse(raw) : fallback;
		} catch {
			return fallback;
		}
	}
	function typeLabel(type) {
		if (type === 'meaning') return copy('단어 → 한국어 뜻', '単語 → 韓国語の意味');
		if (type === 'sentence') return copy('예문 빈칸 → 단어', '例文の空欄 → 単語');
		return copy('단어 → 히라가나', '単語 → ひらがな');
	}
	function instruction(type) {
		if (type === 'meaning') return copy('등록된 한국어 뜻 중 하나를 입력해 주세요.', '登録された韓国語の意味のうち1つを入力してください。');
		if (type === 'sentence') return copy('문장의 빈칸에 들어갈 단어를 입력해 주세요.', '文の空欄に入る単語を入力してください。');
		return copy('이 단어의 읽기를 히라가나로 입력해 주세요.', 'この単語の読み方をひらがなで入力してください。');
	}
	function firstCharacter(value) {
		return Array.from(String(value ?? '').trim())[0] || '—';
	}
	function answerLength(value) {
		return Array.from(String(value ?? '').trim()).length;
	}
	function acceptedAnswers(question) {
		const answers = Array.isArray(question?.answers) ? uniqueText(question.answers.flatMap((value) => splitAnswers(value))) : [];
		if (answers.length) return answers;
		return splitAnswers(question?.correct);
	}
	function correctDisplay(question) {
		const answers = acceptedAnswers(question);
		return answers.length ? answers.join(' / ') : String(question?.correct ?? '');
	}
	function ensureEnhancementStyles() {
		if (document.querySelector('link[data-quiz-hints-style]')) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '/assets/css/japanese/quiz-hints.css';
		link.dataset.quizHintsStyle = 'true';
		document.head.appendChild(link);
	}

	function makeCandidates(words) {
		const candidates = [];
		for (const word of words) {
			const common = {
				wordId: word.id,
				word: word.word,
				level: word.jlpt || '—',
				category: setup.categoryName || '',
				part: setup.partName || '',
				hints: {
					sentence: word.example?.sentence || '',
					sentenceReading: word.example?.reading || '',
					translationKo: word.example?.translationKo || '',
					reading: word.reading || '',
					meaningKo: word.meaningKo || '',
				},
			};
			if (setup.types.includes('reading') && word.reading) {
				const answers = splitAnswers(word.reading);
				if (answers.length) candidates.push({
					...common,
					key: `${word.id}:reading`, type: 'reading', prompt: word.word,
					answers, correct: answers.join(' / '), choiceCorrect: answers[0],
					note: word.meaningKo ? copy(`뜻: ${word.meaningKo}`, `韓国語の意味: ${word.meaningKo}`) : '',
				});
			}
			if (setup.types.includes('meaning') && word.meaningKo) {
				const answers = splitAnswers(word.meaningKo);
				if (answers.length) candidates.push({
					...common,
					key: `${word.id}:meaning`, type: 'meaning', prompt: word.word,
					answers, correct: answers.join(' / '), choiceCorrect: answers[0],
					note: word.reading ? copy(`읽기: ${word.reading}`, `読み: ${word.reading}`) : '',
				});
			}
			if (setup.types.includes('sentence') && word.example?.sentence && word.example.sentence.includes(word.word)) {
				candidates.push({
					...common,
					key: `${word.id}:sentence`, type: 'sentence',
					prompt: word.example.sentence.replace(word.word, '＿＿＿＿'),
					answers: [word.word], correct: word.word, choiceCorrect: word.word,
					note: word.example.translationKo || word.meaningKo || '',
				});
			}
		}
		return candidates;
	}

	function attachChoices(selected, allCandidates) {
		const pools = new Map();
		for (const candidate of allCandidates) {
			if (!pools.has(candidate.type)) pools.set(candidate.type, []);
			pools.get(candidate.type).push(candidate.choiceCorrect || acceptedAnswers(candidate)[0] || candidate.correct);
		}
		return selected.map((question) => {
			const choiceCorrect = question.choiceCorrect || acceptedAnswers(question)[0] || question.correct;
			const distractors = shuffle(uniqueText(pools.get(question.type) || []).filter((value) => normalize(value) !== normalize(choiceCorrect))).slice(0, 3);
			const choices = shuffle(uniqueText([choiceCorrect, ...distractors]));
			let answerMode = setup.answerMode;
			if (answerMode === 'random') answerMode = crypto.getRandomValues(new Uint8Array(1))[0] % 2 === 0 ? 'input' : 'choice';
			if (answerMode === 'choice' && choices.length < 4) answerMode = 'input';
			return { ...question, choices, answerMode, choiceCorrect };
		});
	}

	function canonicalizeRetryQuestion(question) {
		const answers = acceptedAnswers(question);
		const next = { ...question, answers, correct: answers.length ? answers.join(' / ') : question.correct };
		if (setup.answerMode !== 'random') next.answerMode = setup.answerMode;
		else next.answerMode = question.answerMode || 'input';
		if (next.answerMode === 'choice' && (!Array.isArray(next.choices) || next.choices.length < 2)) next.answerMode = 'input';
		return next;
	}

	async function buildQuestions() {
		const retry = readJson(sessionStorage, RETRY_KEY, null);
		if (Array.isArray(retry) && retry.length) {
			sessionStorage.removeItem(RETRY_KEY);
			questions = retry.map(canonicalizeRetryQuestion);
			setup.count = questions.length;
			return;
		}

		const params = new URLSearchParams({ types: setup.types.join(','), count: String(setup.count) });
		if (setup.jlpt) params.set('jlpt', setup.jlpt);
		if (setup.categoryId) params.set('category', String(setup.categoryId));
		if (setup.partId) params.set('part', String(setup.partId));
		const response = await fetch(`/api/public/japanese/quiz-pool?${params.toString()}`, { cache: 'no-store' });
		const result = await response.json().catch(() => null);
		if (!response.ok || !result?.ok || !Array.isArray(result.words)) throw new Error('QUIZ_WORD_LOAD_FAILED');
		const candidates = makeCandidates(result.words);
		const selected = shuffle(candidates).slice(0, setup.count);
		questions = attachChoices(selected, candidates);
		if (questions.length < setup.count) {
			const notice = byId('quiz-play-notice');
			if (notice) {
				notice.hidden = false;
				notice.textContent = copy(`현재 조건에서 출제 가능한 문제가 ${questions.length}개라 문제 수를 조정했습니다.`, `現在の条件で出題できる問題が${questions.length}問のため、問題数を調整しました。`);
			}
			setup.count = questions.length;
		}
	}

	function renderScope() {
		byId('quiz-session-jlpt').textContent = setup.jlpt || 'ALL';
		byId('quiz-session-category').textContent = setup.categoryName || copy('전체', 'すべて');
		byId('quiz-session-part').textContent = setup.partName || copy('전체', 'すべて');
		const mode = setup.answerMode === 'choice' ? copy('4지선다', '4択') : setup.answerMode === 'random' ? copy('랜덤', 'ランダム') : copy('직접입력', '直接入力');
		byId('quiz-session-mode').textContent = mode;
	}

	function renderChoices(question) {
		const wrap = byId('quiz-play-choices');
		wrap.replaceChildren();
		for (const choice of question.choices || []) {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'jp-quiz-choice';
			button.textContent = choice;
			button.addEventListener('click', () => grade(choice, button));
			wrap.appendChild(button);
		}
	}

	function sentenceHint(question) {
		const hints = question?.hints ?? {};
		if (question?.type === 'sentence') {
			if (hints.translationKo) return copy(`문장 뜻: ${hints.translationKo}`, `文の韓国語訳: ${hints.translationKo}`);
			if (hints.sentenceReading) return copy(`문장 읽기: ${hints.sentenceReading}`, `文の読み: ${hints.sentenceReading}`);
			return copy('문장 자체가 문제에 표시되어 있습니다.', '文そのものが問題に表示されています。');
		}
		if (hints.sentence) return copy(`예문: ${hints.sentence}`, `例文: ${hints.sentence}`);
		return copy('등록된 예문이 없습니다.', '登録された例文がありません。');
	}

	function firstCharacterHint(question) {
		const answers = acceptedAnswers(question);
		const chars = answers.map(firstCharacter);
		return `${copy(answers.length > 1 ? '정답 첫 글자 후보' : '정답의 첫 글자', answers.length > 1 ? '答えの最初の文字候補' : '答えの最初の文字')}: ${chars.join(' · ') || '—'}`;
	}

	function answerLengthText(question) {
		const answers = acceptedAnswers(question);
		if (!answers.length) return '';
		const lengths = answers.map((answer) => copy(`${answerLength(answer)}글자`, `${answerLength(answer)}文字`));
		const suffix = question.type === 'meaning' && answers.length > 1
			? copy(' · 등록된 뜻 중 하나만 맞혀도 정답', ' · 登録された意味のうち1つで正解')
			: '';
		return `${copy('정답 글자 수', '答えの文字数')}: ${lengths.join(' · ')}${suffix}`;
	}

	function ensureHintUi() {
		if (byId('quiz-play-hint')) return;
		const feedback = byId('quiz-play-feedback');
		if (!feedback) return;

		const length = document.createElement('div');
		length.id = 'quiz-play-answer-length';
		length.className = 'jp-quiz-answer-length';

		const controls = document.createElement('div');
		controls.className = 'jp-quiz-hint-controls';

		const hintButton = document.createElement('button');
		hintButton.id = 'quiz-play-hint';
		hintButton.className = 'jp-quiz-hint-button';
		hintButton.type = 'button';
		hintButton.addEventListener('click', requestHint);

		const skipButton = document.createElement('button');
		skipButton.id = 'quiz-play-skip';
		skipButton.className = 'jp-quiz-skip-button';
		skipButton.type = 'button';
		skipButton.addEventListener('click', skipQuestion);

		const guide = document.createElement('span');
		guide.id = 'quiz-play-hint-guide';
		controls.append(hintButton, skipButton, guide);

		const box = document.createElement('div');
		box.id = 'quiz-play-hint-box';
		box.className = 'jp-quiz-hint-box';
		box.hidden = true;
		const title = document.createElement('strong');
		title.id = 'quiz-play-hint-title';
		const text = document.createElement('p');
		text.id = 'quiz-play-hint-text';
		box.append(title, text);

		feedback.insertAdjacentElement('beforebegin', box);
		box.insertAdjacentElement('beforebegin', controls);
		controls.insertAdjacentElement('beforebegin', length);
	}

	function renderHint() {
		ensureHintUi();
		const question = questions[currentIndex];
		const hintButton = byId('quiz-play-hint');
		const skipButton = byId('quiz-play-skip');
		const guide = byId('quiz-play-hint-guide');
		const box = byId('quiz-play-hint-box');
		const title = byId('quiz-play-hint-title');
		const text = byId('quiz-play-hint-text');
		const length = byId('quiz-play-answer-length');
		if (!question || !hintButton || !skipButton || !guide || !box || !title || !text || !length) return;

		length.textContent = answerLengthText(question);
		guide.textContent = copy('힌트 1: 문장 · 힌트 2: 첫 글자', 'ヒント1: 文 · ヒント2: 最初の文字');
		skipButton.textContent = copy('잘 모르겠음', 'わからない');
		skipButton.disabled = answered;
		box.hidden = hintLevel === 0;

		if (hintLevel === 0) {
			hintButton.textContent = copy('힌트 1 · 문장 보기', 'ヒント1 · 文を見る');
			hintButton.disabled = answered;
			return;
		}

		const context = sentenceHint(question);
		if (hintLevel === 1) {
			title.textContent = copy('문장 힌트', '文のヒント');
			text.textContent = context;
			hintButton.textContent = copy('힌트 2 · 첫 글자 보기', 'ヒント2 · 最初の文字を見る');
			hintButton.disabled = answered;
			return;
		}

		title.textContent = copy('문장 + 첫 글자 힌트', '文 + 最初の文字ヒント');
		text.textContent = `${context}\n${firstCharacterHint(question)}`;
		hintButton.textContent = copy('힌트 사용 완료', 'ヒント使用済み');
		hintButton.disabled = true;
	}

	function requestHint() {
		if (answered) return;
		if (hintLevel < 2) hintLevel += 1;
		renderHint();
	}

	function renderQuestion() {
		answered = false;
		hintLevel = 0;
		const question = questions[currentIndex];
		const current = currentIndex + 1;
		byId('quiz-play-current').textContent = String(current);
		byId('quiz-play-total').textContent = String(questions.length);
		byId('quiz-play-score').textContent = copy(`정답 ${correctCount} · 오답 ${wrongCount}`, `正解 ${correctCount} · 誤答 ${wrongCount}`);
		byId('quiz-play-progress').style.width = `${Math.round((current / questions.length) * 100)}%`;
		byId('quiz-play-type').textContent = `${typeLabel(question.type)} · ${question.level}`;
		byId('quiz-play-question').textContent = question.prompt;
		byId('quiz-play-instruction').textContent = instruction(question.type);
		byId('quiz-play-feedback').hidden = true;
		byId('quiz-play-next').hidden = true;
		byId('quiz-play-submit').hidden = question.answerMode === 'choice';
		const input = byId('quiz-play-answer');
		const form = byId('quiz-play-form');
		const choices = byId('quiz-play-choices');
		form.hidden = question.answerMode === 'choice';
		choices.hidden = question.answerMode !== 'choice';
		input.value = '';
		input.disabled = false;
		byId('quiz-play-submit').disabled = false;
		renderChoices(question);
		renderHint();
		if (question.answerMode === 'input') input.focus();
	}

	function showFeedback(question, isCorrect, selectedButton, skipped = false) {
		const feedback = byId('quiz-play-feedback');
		feedback.hidden = false;
		feedback.classList.toggle('is-correct', isCorrect);
		feedback.classList.toggle('is-wrong', !isCorrect);
		byId('quiz-feedback-title').textContent = skipped
			? copy('잘 모르겠음 · 오답 처리', 'わからない · 誤答として記録')
			: (isCorrect ? copy('정답입니다', '正解です') : copy('오답입니다', '不正解です'));
		byId('quiz-feedback-answer').textContent = correctDisplay(question);
		byId('quiz-feedback-note').textContent = question.note || '';
		byId('quiz-play-answer').disabled = true;
		byId('quiz-play-submit').disabled = true;
		byId('quiz-play-choices').querySelectorAll('button').forEach((button) => {
			button.disabled = true;
			const accepted = acceptedAnswers(question).some((answer) => normalize(button.textContent) === normalize(answer));
			if (accepted) button.classList.add('is-correct');
		});
		if (selectedButton && !isCorrect) selectedButton.classList.add('is-wrong');
		byId('quiz-play-next').hidden = false;
		byId('quiz-play-next').textContent = currentIndex + 1 >= questions.length ? copy('결과 보기', '結果を見る') : copy('다음 문제', '次の問題');
		renderHint();
	}

	function recordAttempt(answer, isCorrect, skipped = false) {
		if (isCorrect) correctCount += 1;
		else wrongCount += 1;
		attempts.push({
			index: currentIndex + 1,
			answer: String(answer ?? ''),
			isCorrect,
			skipped,
			hintLevel,
			questionSnapshot: questions[currentIndex],
		});
		byId('quiz-play-score').textContent = copy(`정답 ${correctCount} · 오답 ${wrongCount}`, `正解 ${correctCount} · 誤答 ${wrongCount}`);
	}

	function grade(answer, selectedButton = null) {
		if (answered) return;
		const question = questions[currentIndex];
		const normalized = normalize(answer);
		if (!normalized) return;
		answered = true;
		const isCorrect = acceptedAnswers(question).some((value) => normalize(value) === normalized);
		recordAttempt(answer, isCorrect, false);
		showFeedback(question, isCorrect, selectedButton, false);
	}

	function skipQuestion() {
		if (answered) return;
		const question = questions[currentIndex];
		if (!question) return;
		answered = true;
		recordAttempt('', false, true);
		showFeedback(question, false, null, true);
	}

	function submitAnswer(event) {
		event.preventDefault();
		const input = byId('quiz-play-answer');
		if (!input.value.trim()) { input.focus(); return; }
		grade(input.value);
	}

	async function persistOwnerHistory(result) {
		try {
			const payloadAttempts = result.attempts.map((item) => ({
				wordId: item.questionSnapshot?.wordId,
				type: item.questionSnapshot?.type,
				answerMode: item.questionSnapshot?.answerMode === 'choice' ? 'choice' : 'input',
				answer: item.answer,
			}));
			const response = await fetch('/api/admin/japanese/quiz/complete', {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ setup: result.setup, startedAt: result.startedAt, attempts: payloadAttempts }),
			});
			if (response.status === 401) return null;
			const data = await response.json().catch(() => null);
			return response.ok && data?.ok ? data.session?.id ?? null : null;
		} catch (error) {
			console.warn('Failed to persist owner quiz history', error);
			return null;
		}
	}

	async function saveResult() {
		const finishedAt = Date.now();
		const result = {
			id: crypto.randomUUID(),
			startedAt: new Date(startedAt).toISOString(),
			finishedAt: new Date(finishedAt).toISOString(),
			durationSeconds: Math.max(1, Math.round((finishedAt - startedAt) / 1000)),
			total: questions.length,
			correct: correctCount,
			wrong: wrongCount,
			setup,
			attempts,
		};
		result.serverSessionId = await persistOwnerHistory(result);
		sessionStorage.setItem(RESULT_KEY, JSON.stringify(result));
		const history = readJson(localStorage, HISTORY_KEY, []);
		const nextHistory = [result, ...(Array.isArray(history) ? history.filter((item) => item?.id !== result.id) : [])].slice(0, 100);
		localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
	}

	async function nextQuestion() {
		if (!answered) return;
		if (currentIndex + 1 >= questions.length) {
			byId('quiz-play-next').disabled = true;
			await saveResult();
			window.location.href = `/${language()}/japanese/quiz/result/`;
			return;
		}
		currentIndex += 1;
		renderQuestion();
	}

	function showFatal(message) {
		byId('quiz-play-loading').hidden = true;
		const fatal = byId('quiz-play-fatal');
		fatal.hidden = false;
		fatal.textContent = message;
		byId('quiz-play-stage').hidden = true;
	}

	async function initialize() {
		ensureEnhancementStyles();
		setup = readJson(sessionStorage, SETUP_KEY, null) || {
			studyMode: new URLSearchParams(location.search).get('study') === 'korean' ? 'korean' : 'japanese',
			types: ['reading', 'meaning', 'sentence'], jlpt: '', categoryId: null, categoryName: copy('전체', 'すべて'),
			partId: null, partName: copy('전체', 'すべて'), count: 10, answerMode: 'input', priority: 'random',
		};
		if (!Array.isArray(setup.types) || !setup.types.length) setup.types = setup.studyMode === 'korean' ? ['meaning'] : ['reading', 'meaning', 'sentence'];
		ensureHintUi();
		try {
			await buildQuestions();
			if (!questions.length) {
				showFatal(copy('현재 조건으로 출제할 수 있는 문제가 없습니다. 단어의 읽기·뜻·예문을 등록하거나 조건을 바꿔 주세요.', '現在の条件で出題できる問題がありません。単語の読み・意味・例文を登録するか、条件を変更してください。'));
				return;
			}
			byId('quiz-play-loading').hidden = true;
			byId('quiz-play-stage').hidden = false;
			renderScope();
			byId('quiz-play-form').addEventListener('submit', submitAnswer);
			byId('quiz-play-next').addEventListener('click', nextQuestion);
			renderQuestion();
		} catch (error) {
			console.error('Failed to start public Japanese quiz', error);
			showFatal(copy('퀴즈 데이터를 불러오지 못했습니다.', 'クイズデータを読み込めませんでした。'));
		}
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
