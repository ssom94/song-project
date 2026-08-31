(() => {
	const PRACTICE_API = '/api/public/japanese/jlpt/practice';
	const PUBLIC_GRADE_API = '/api/public/japanese/jlpt/practice/grade';
	const ADMIN_GRADE_API = '/api/admin/japanese/jlpt/practice/grade';
	const WRONG_NOTES_API = '/api/admin/japanese/jlpt/wrong-notes';
	const SESSION_API = '/api/admin/auth/session';
	const COLLAPSE_KEY = 'song_jlpt_section_collapsed_v1';
	const DEFAULT_COLLAPSED = new Set(['preview', 'wrong', 'reading', 'calendar']);

	let authenticated = false;
	let todayPractice = null;
	let selectedPreviewDate = '';
	let mapTimer = 0;
	let questionObserver = null;
	let visitorDetailObserver = null;

	function lang() {
		return document.body?.dataset?.blogLanguage === 'ja' ? 'ja' : 'ko';
	}

	function t(ko, ja) {
		return lang() === 'ja' ? ja : ko;
	}

	function byId(id) {
		return document.getElementById(id);
	}

	function clean(value) {
		return String(value ?? '').normalize('NFKC').trim();
	}

	async function requestJson(url, options = {}) {
		const response = await fetch(url, {
			credentials: 'same-origin',
			cache: 'no-store',
			...options,
		});
		const data = await response.json().catch(() => null);
		return { response, data };
	}

	function mountStyle() {
		if (document.querySelector('link[data-jlpt-experience-style]')) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '/assets/css/japanese/jlpt-experience.css?v=20260831-1';
		link.dataset.jlptExperienceStyle = 'true';
		document.head.appendChild(link);
	}

	async function detectAuthentication() {
		try {
			const { response, data } = await requestJson(SESSION_API);
			authenticated = response.ok && data?.authenticated === true;
		} catch {
			authenticated = false;
		}
		return authenticated;
	}

	async function loadPractice(date = '') {
		const params = new URLSearchParams();
		if (date) params.set('date', date);
		const { response, data } = await requestJson(`${PRACTICE_API}${params.size ? `?${params.toString()}` : ''}`);
		if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP_${response.status}`);
		return data;
	}

	function handleOptionCapture(event) {
		const target = event.target instanceof Element ? event.target : null;
		const button = target?.closest('.jlpt-question-options[data-jlpt-enhanced="true"] button');
		if (!(button instanceof HTMLButtonElement)) return;
		const options = button.closest('.jlpt-question-options');
		if (!(options instanceof HTMLElement) || options.dataset.jlptGraded === 'true') return;
		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation();
		options.querySelectorAll('button').forEach((node) => node.classList.remove('is-selected'));
		button.classList.add('is-selected');
		options.dataset.jlptSelected = clean(button.textContent);
		const submit = options.parentElement?.querySelector('.jlpt-question-submit');
		if (submit instanceof HTMLButtonElement) submit.disabled = false;
	}

	function answerBoxFor(options) {
		const parent = options.parentElement;
		let answer = parent?.querySelector(':scope > .jlpt-answer');
		if (!(answer instanceof HTMLElement)) {
			answer = document.createElement('div');
			answer.className = 'jlpt-answer';
			answer.hidden = true;
			parent?.appendChild(answer);
		}
		return answer;
	}

	function applyGrade(options, answer, result) {
		const correctAnswer = clean(result.correctAnswer);
		const selectedAnswer = clean(result.selectedAnswer);
		options.dataset.jlptGraded = 'true';
		options.querySelectorAll('button').forEach((node) => {
			if (!(node instanceof HTMLButtonElement)) return;
			node.disabled = true;
			const value = clean(node.textContent);
			if (value === correctAnswer) node.classList.add('is-correct');
			if (!result.correct && value === selectedAnswer) node.classList.add('is-wrong');
		});
		answer.classList.toggle('is-correct-answer', result.correct === true);
		answer.classList.toggle('is-wrong-answer', result.correct !== true);
		const prefix = result.correct ? t('정답입니다.', '正解です。') : t('오답입니다.', '不正解です。');
		answer.textContent = `${prefix} ${t('정답', '正解')}: ${correctAnswer || '—'}${result.explanation ? ` · ${result.explanation}` : ''}`;
		if (authenticated && result.wrongNoteSaved) {
			const note = document.createElement('span');
			note.className = 'jlpt-practice-save-note';
			note.textContent = t('오답노트에 저장했습니다.', '誤答ノートに保存しました。');
			answer.appendChild(note);
		} else if (authenticated && result.wrongNoteResolved) {
			const note = document.createElement('span');
			note.className = 'jlpt-practice-save-note';
			note.textContent = t('오답 복습을 완료했습니다.', '誤答復習を完了しました。');
			answer.appendChild(note);
		}
		answer.hidden = false;
	}

	async function refreshTodaySummary() {
		try {
			const { response, data } = await requestJson('/api/public/japanese/jlpt/dashboard');
			if (!response.ok || !data?.ok) return;
			const today = data.today || {};
			const values = [
				['jlpt-today-review', today.completed?.review, today.targets?.review],
				['jlpt-today-new', today.completed?.newWords, today.targets?.newWords],
				['jlpt-today-vocab', today.completed?.vocabQuestions, today.targets?.vocabQuestions],
				['jlpt-today-grammar', today.completed?.grammar, today.targets?.grammar],
				['jlpt-today-reading', today.completed?.reading, today.targets?.reading],
			];
			for (const [id, done, target] of values) {
				const node = byId(id);
				if (node) node.textContent = `${Number(done || 0)} / ${Number(target || 0)}`;
			}
			const percent = Number(today.progressPercent || 0);
			const percentNode = byId('jlpt-today-percent');
			const bar = byId('jlpt-today-bar');
			if (percentNode) percentNode.textContent = `${percent}%`;
			if (bar instanceof HTMLElement) bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
		} catch {
			// Non-critical: grading already succeeded.
		}
	}

	async function submitQuestion(options, submit, answer, afterGrade) {
		const questionKey = options.dataset.jlptQuestionKey || '';
		const selectedAnswer = options.dataset.jlptSelected || '';
		if (!questionKey || !selectedAnswer || options.dataset.jlptGraded === 'true') return;
		submit.disabled = true;
		const endpoint = authenticated ? ADMIN_GRADE_API : PUBLIC_GRADE_API;
		try {
			const { response, data } = await requestJson(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ questionKey, selectedAnswer }),
			});
			if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP_${response.status}`);
			applyGrade(options, answer, data);
			submit.hidden = true;
			if (authenticated) {
				await refreshTodaySummary();
				if (data.wrongNoteSaved || data.wrongNoteResolved) window.setTimeout(loadWrongNotes, 120);
			}
			if (typeof afterGrade === 'function') afterGrade(data);
		} catch (error) {
			console.error('Failed to submit JLPT question', error);
			answer.classList.remove('is-correct-answer');
			answer.classList.add('is-wrong-answer');
			answer.textContent = t('답안을 제출하지 못했습니다. 잠시 후 다시 시도해 주세요.', '回答を送信できませんでした。しばらくしてからもう一度お試しください。');
			answer.hidden = false;
			submit.disabled = false;
		}
	}

	function enhanceQuestionOptions(options, question, afterGrade) {
		if (!(options instanceof HTMLElement) || !question?.key) return;
		if (options.dataset.jlptQuestionKey === question.key && options.dataset.jlptEnhanced === 'true') return;
		options.dataset.jlptQuestionKey = question.key;
		options.dataset.jlptEnhanced = 'true';
		options.dataset.jlptSelected = '';
		options.dataset.jlptGraded = 'false';
		options.querySelectorAll('button').forEach((button) => {
			button.classList.remove('is-selected', 'is-correct', 'is-wrong');
			if (button instanceof HTMLButtonElement) button.disabled = false;
		});
		const answer = answerBoxFor(options);
		answer.hidden = true;
		answer.textContent = '';
		answer.classList.remove('is-correct-answer', 'is-wrong-answer');
		let submit = options.parentElement?.querySelector(':scope > .jlpt-question-submit');
		if (!(submit instanceof HTMLButtonElement)) {
			submit = document.createElement('button');
			submit.type = 'button';
			submit.className = 'jlpt-question-submit';
			submit.textContent = t('제출', '回答を提出');
			options.insertAdjacentElement('afterend', submit);
		}
		submit.disabled = true;
		submit.hidden = false;
		submit.onclick = () => submitQuestion(options, submit, answer, afterGrade);
	}

	function mapExistingQuestions() {
		if (!todayPractice || !authenticated) return;
		const topQuestions = Array.isArray(todayPractice.questions) ? todayPractice.questions : [];
		const vocab = topQuestions.filter((item) => item.type === 'vocab');
		const grammar = topQuestions.filter((item) => item.type === 'grammar');
		const vocabCards = [...document.querySelectorAll('#jlpt-vocab-contents .jlpt-content-card')];
		const grammarCards = [...document.querySelectorAll('#jlpt-grammar-questions .jlpt-content-card')];
		vocabCards.forEach((card, index) => {
			const options = card.querySelector('.jlpt-question-options');
			if (options && vocab[index]) enhanceQuestionOptions(options, vocab[index], () => card.classList.add('is-completed'));
		});
		grammarCards.forEach((card, index) => {
			const options = card.querySelector('.jlpt-question-options');
			if (options && grammar[index]) enhanceQuestionOptions(options, grammar[index], () => card.classList.add('is-completed'));
		});

		const readingCards = [...document.querySelectorAll('#jlpt-reading-contents .jlpt-content-card')];
		const readings = Array.isArray(todayPractice.readings) ? todayPractice.readings : [];
		readingCards.forEach((card, readingIndex) => {
			const optionGroups = [...card.querySelectorAll('.jlpt-question-options')];
			const questions = Array.isArray(readings[readingIndex]?.questions) ? readings[readingIndex].questions : [];
			optionGroups.forEach((options, questionIndex) => {
				if (questions[questionIndex]) enhanceQuestionOptions(options, questions[questionIndex]);
			});
		});
	}

	function scheduleQuestionMapping() {
		window.clearTimeout(mapTimer);
		mapTimer = window.setTimeout(mapExistingQuestions, 70);
	}

	function observeQuestionContainers() {
		if (questionObserver) return;
		const targets = ['jlpt-vocab-contents', 'jlpt-grammar-questions', 'jlpt-reading-contents']
			.map(byId).filter((node) => node instanceof HTMLElement);
		if (!targets.length) return;
		questionObserver = new MutationObserver((mutations) => {
			if (mutations.some((mutation) => mutation.type === 'childList')) scheduleQuestionMapping();
		});
		targets.forEach((target) => questionObserver.observe(target, { childList: true, subtree: true }));
	}

	function createQuestionCard(question, extraClass = '') {
		const card = document.createElement('article');
		card.className = `jlpt-content-card ${extraClass}`.trim();
		if (question.title) {
			const title = document.createElement('h3');
			title.textContent = question.title;
			card.appendChild(title);
		}
		const prompt = document.createElement('p');
		prompt.textContent = question.prompt || '—';
		const options = document.createElement('div');
		options.className = 'jlpt-question-options';
		for (const value of Array.isArray(question.options) ? question.options : []) {
			const button = document.createElement('button');
			button.type = 'button';
			button.textContent = String(value);
			options.appendChild(button);
		}
		const answer = document.createElement('div');
		answer.className = 'jlpt-answer';
		answer.hidden = true;
		card.append(prompt, options, answer);
		enhanceQuestionOptions(options, question);
		return card;
	}

	function visitorWordCard(word) {
		const card = document.createElement('article');
		card.className = 'jlpt-word-card';
		const head = document.createElement('div');
		head.className = 'jlpt-word-head';
		const title = document.createElement('div');
		title.className = 'jlpt-word-title';
		const strong = document.createElement('strong');
		strong.textContent = word.word || '—';
		const reading = document.createElement('span');
		reading.textContent = word.reading || '—';
		title.append(strong, reading);
		const badge = document.createElement('span');
		badge.textContent = t('연습', '練習');
		head.append(title, badge);
		const meaning = document.createElement('p');
		meaning.textContent = word.meaningKo || word.meaningJa || '—';
		card.append(head, meaning);
		return card;
	}

	function renderGrammarMaterial(target, item) {
		const card = document.createElement('article');
		card.className = 'jlpt-content-card';
		const payload = item?.payload || {};
		const title = document.createElement('h3');
		title.textContent = payload.pattern || item?.title || t('문법', '文法');
		card.appendChild(title);
		for (const value of [payload.meaningKo || payload.meaningJa || payload.meaning, payload.explanation]) {
			if (!value) continue;
			const p = document.createElement('p');
			p.textContent = String(value);
			card.appendChild(p);
		}
		if (Array.isArray(payload.examples)) {
			const list = document.createElement('ul');
			for (const example of payload.examples) {
				const li = document.createElement('li');
				li.textContent = typeof example === 'string' ? example : [example?.ja, example?.ko].filter(Boolean).join(' — ');
				list.appendChild(li);
			}
			card.appendChild(list);
		}
		target.appendChild(card);
	}

	function renderVisitorPractice(data) {
		const detail = byId('jlpt-study-detail');
		const review = byId('jlpt-review-words');
		const fresh = byId('jlpt-new-words');
		if (detail instanceof HTMLElement) {
			detail.classList.remove('jlpt-hidden');
			if (!detail.querySelector('.jlpt-visitor-mode')) {
				const note = document.createElement('div');
				note.className = 'jlpt-visitor-mode';
				note.textContent = t(
					'로그인하지 않은 연습 모드입니다. 문제 채점은 가능하지만 학습 진도와 오답 기록은 저장되지 않습니다.',
					'未ログインの練習モードです。採点はできますが、学習進捗や誤答履歴は保存されません。',
				);
				detail.querySelector('.jlpt-card-heading')?.insertAdjacentElement('afterend', note);
			}
			if (!visitorDetailObserver) {
				visitorDetailObserver = new MutationObserver(() => detail.classList.remove('jlpt-hidden'));
				visitorDetailObserver.observe(detail, { attributes: true, attributeFilter: ['class'] });
			}
		}
		if (review) {
			review.replaceChildren();
			const empty = document.createElement('div');
			empty.className = 'jlpt-empty';
			empty.textContent = t('방문자 연습 모드에서는 개인 복습 목록을 표시하지 않습니다.', 'ゲスト練習モードでは個人の復習一覧を表示しません。');
			review.appendChild(empty);
		}
		if (fresh) {
			fresh.replaceChildren();
			const words = Array.isArray(data.words) ? data.words : [];
			if (!words.length) {
				const empty = document.createElement('div');
				empty.className = 'jlpt-empty';
				empty.textContent = t('오늘 공개된 단어가 없습니다.', '今日公開された単語はありません。');
				fresh.appendChild(empty);
			} else words.forEach((word) => fresh.appendChild(visitorWordCard(word)));
		}

		const vocabTarget = byId('jlpt-vocab-contents');
		const grammarTarget = byId('jlpt-grammar-contents');
		const grammarQuestionsTarget = byId('jlpt-grammar-questions');
		const readingTarget = byId('jlpt-reading-contents');
		const questions = Array.isArray(data.questions) ? data.questions : [];
		if (vocabTarget) {
			vocabTarget.replaceChildren();
			const values = questions.filter((item) => item.type === 'vocab');
			if (!values.length) vocabTarget.appendChild(emptyBlock(t('오늘 등록된 어휘 문제가 없습니다.', '今日登録された語彙問題はありません。')));
			else values.forEach((question) => vocabTarget.appendChild(createQuestionCard(question)));
		}
		if (grammarTarget) {
			grammarTarget.replaceChildren();
			const values = Array.isArray(data.grammar) ? data.grammar : [];
			if (!values.length) grammarTarget.appendChild(emptyBlock(t('오늘 등록된 문법이 없습니다.', '今日登録された文法はありません。')));
			else values.forEach((item) => renderGrammarMaterial(grammarTarget, item));
		}
		if (grammarQuestionsTarget) {
			grammarQuestionsTarget.replaceChildren();
			questions.filter((item) => item.type === 'grammar').forEach((question) => grammarQuestionsTarget.appendChild(createQuestionCard(question)));
		}
		if (readingTarget) {
			readingTarget.replaceChildren();
			const readings = Array.isArray(data.readings) ? data.readings : [];
			if (!readings.length) readingTarget.appendChild(emptyBlock(t('오늘 등록된 독해가 없습니다.', '今日登録された読解はありません。')));
			for (const reading of readings) {
				const card = document.createElement('article');
				card.className = 'jlpt-content-card';
				const title = document.createElement('h3');
				title.textContent = reading.title || t('독해', '読解');
				const passage = document.createElement('p');
				passage.textContent = reading.passage || '';
				card.append(title, passage);
				for (const question of Array.isArray(reading.questions) ? reading.questions : []) {
					const box = createQuestionCard(question);
					box.classList.add('jlpt-reading-question-card');
					card.appendChild(box);
				}
				readingTarget.appendChild(card);
			}
		}
	}

	function emptyBlock(copy) {
		const node = document.createElement('div');
		node.className = 'jlpt-empty';
		node.textContent = copy;
		return node;
	}

	function insertAfter(reference, node) {
		reference.parentNode?.insertBefore(node, reference.nextSibling);
	}

	function mountPreviewCard() {
		if (byId('jlpt-preview-card')) return byId('jlpt-preview-card');
		const todayCard = byId('jlpt-start-button')?.closest('.jlpt-card');
		if (!(todayCard instanceof HTMLElement)) return null;
		const card = document.createElement('section');
		card.id = 'jlpt-preview-card';
		card.className = 'jlpt-card jlpt-preview-card';
		card.innerHTML = `<div class="jlpt-card-heading"><div><h2>${t('1개월 예습', '1か月予習')}</h2><p>${t('앞으로 30일의 신규 단어·문법 포인트·독해 초점을 미리 확인합니다.', '今後30日分の新規単語・文法ポイント・読解テーマを先に確認します。')}</p></div></div><div id="jlpt-preview-content"></div>`;
		insertAfter(todayCard, card);
		return card;
	}

	function renderPreview(data) {
		const target = byId('jlpt-preview-content');
		if (!target) return;
		selectedPreviewDate = data.studyDate;
		target.replaceChildren();
		const strip = document.createElement('div');
		strip.className = 'jlpt-preview-date-strip';
		for (const date of Array.isArray(data.previewDates) ? data.previewDates : []) {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = `jlpt-preview-date-button${date === data.studyDate ? ' is-active' : ''}`;
			button.dataset.previewDate = date;
			const day = date === data.today ? t('오늘', '今日') : t('예습', '予習');
			button.innerHTML = `${date.slice(5).replace('-', '/')}<small>${day}</small>`;
			button.addEventListener('click', () => selectPreviewDate(date, button));
			strip.appendChild(button);
		}
		const status = document.createElement('div');
		status.className = 'jlpt-preview-status';
		const statusTitle = document.createElement('strong');
		statusTitle.textContent = `${data.studyDate} · ${data.isFuture ? t('예습', '予習') : t('오늘', '今日')}`;
		const statusCopy = document.createElement('span');
		statusCopy.textContent = data.isFuture
			? t('내용은 미리 볼 수 있고, 문제 제출은 해당 날짜부터 가능합니다.', '内容は予習できますが、問題の提出は当日から可能です。')
			: t('오늘 문제는 아래 학습 영역에서 제출할 수 있습니다.', '今日の問題は下の学習エリアから提出できます。');
		status.append(statusTitle, statusCopy);

		const grid = document.createElement('div');
		grid.className = 'jlpt-preview-grid';
		const wordsPanel = document.createElement('section');
		wordsPanel.className = 'jlpt-preview-panel';
		const wordsTitle = document.createElement('h3');
		const words = Array.isArray(data.words) ? data.words : [];
		wordsTitle.textContent = `${t('신규 N1 단어', '新規N1単語')} · ${words.length}`;
		const wordsGrid = document.createElement('div');
		wordsGrid.className = 'jlpt-preview-word-grid';
		if (!words.length) {
			wordsGrid.appendChild(emptyBlock(t('이 날짜에 미리 배정된 단어가 아직 없습니다.', 'この日に事前割り当てされた単語はまだありません。')));
		} else {
			for (const word of words) {
				const row = document.createElement('div');
				row.className = 'jlpt-preview-word';
				const strong = document.createElement('strong');
				strong.textContent = word.word || '—';
				const reading = document.createElement('span');
				reading.textContent = word.reading || '—';
				const meaning = document.createElement('small');
				meaning.textContent = word.meaningKo || word.meaningJa || '—';
				row.append(strong, reading, meaning);
				wordsGrid.appendChild(row);
			}
		}
		wordsPanel.append(wordsTitle, wordsGrid);

		const topicPanel = document.createElement('section');
		topicPanel.className = 'jlpt-preview-panel';
		const topicTitle = document.createElement('h3');
		topicTitle.textContent = t('문법 · 독해 예습 포인트', '文法・読解の予習ポイント');
		topicPanel.appendChild(topicTitle);
		for (const grammar of Array.isArray(data.preview?.grammar) ? data.preview.grammar : []) {
			const topic = document.createElement('div');
			topic.className = 'jlpt-preview-topic';
			const strong = document.createElement('strong');
			strong.textContent = grammar.pattern || '—';
			const span = document.createElement('span');
			span.textContent = grammar.meaningKo || '';
			topic.append(strong, span);
			topicPanel.appendChild(topic);
		}
		if (data.preview?.reading) {
			const topic = document.createElement('div');
			topic.className = 'jlpt-preview-topic';
			const strong = document.createElement('strong');
			strong.textContent = t('독해', '読解');
			const span = document.createElement('span');
			span.textContent = lang() === 'ja' ? data.preview.reading.focusJa : data.preview.reading.focusKo;
			topic.append(strong, span);
			topicPanel.appendChild(topic);
		}
		grid.append(wordsPanel, topicPanel);
		target.append(strip, status, grid);
	}

	async function selectPreviewDate(date, button) {
		if (!date || date === selectedPreviewDate) return;
		document.querySelectorAll('.jlpt-preview-date-button').forEach((node) => {
			if (node instanceof HTMLButtonElement) node.disabled = true;
		});
		button.classList.add('is-active');
		try {
			const data = await loadPractice(date);
			renderPreview(data);
		} catch (error) {
			console.error('Failed to load JLPT preview date', error);
		} finally {
			document.querySelectorAll('.jlpt-preview-date-button').forEach((node) => {
				if (node instanceof HTMLButtonElement) node.disabled = false;
			});
		}
	}

	function mountWrongCard() {
		if (!authenticated) return null;
		if (byId('jlpt-wrong-card')) return byId('jlpt-wrong-card');
		const grammarCard = byId('jlpt-grammar-contents')?.closest('.jlpt-card');
		if (!(grammarCard instanceof HTMLElement)) return null;
		const card = document.createElement('section');
		card.id = 'jlpt-wrong-card';
		card.className = 'jlpt-card jlpt-wrong-card';
		card.innerHTML = `<div class="jlpt-card-heading"><div><h2>${t('오답노트', '誤答ノート')}</h2><p>${t('틀린 어휘·문법·독해 문제를 다시 풀고 정답이면 복습 완료로 처리합니다.', '間違えた語彙・文法・読解問題を解き直し、正解すると復習完了になります。')}</p></div><span id="jlpt-wrong-count">0</span></div><div id="jlpt-wrong-list" class="jlpt-wrong-list"></div>`;
		insertAfter(grammarCard, card);
		return card;
	}

	function renderWrongNotes(items) {
		const list = byId('jlpt-wrong-list');
		const count = byId('jlpt-wrong-count');
		if (!list) return;
		const values = Array.isArray(items) ? items : [];
		if (count) count.textContent = String(values.length);
		list.replaceChildren();
		if (!values.length) {
			list.appendChild(emptyBlock(t('현재 다시 풀 오답이 없습니다.', '現在、解き直す誤答はありません。')));
			return;
		}
		for (const note of values) {
			const item = document.createElement('article');
			item.className = 'jlpt-wrong-item';
			const meta = document.createElement('div');
			meta.className = 'jlpt-wrong-meta';
			meta.innerHTML = `<span>${note.studyDate || '—'} · ${String(note.type || '').toUpperCase()}</span><span>${t('오답', '誤答')} ${Number(note.wrongCount || 1)}${t('회', '回')}</span>`;
			const prompt = document.createElement('p');
			prompt.textContent = note.prompt || '—';
			const options = document.createElement('div');
			options.className = 'jlpt-question-options';
			for (const value of Array.isArray(note.options) ? note.options : []) {
				const button = document.createElement('button');
				button.type = 'button';
				button.textContent = String(value);
				options.appendChild(button);
			}
			const answer = document.createElement('div');
			answer.className = 'jlpt-answer';
			answer.hidden = true;
			item.append(meta, prompt, options, answer);
			list.appendChild(item);
			enhanceQuestionOptions(options, {
				key: note.questionKey,
				type: note.type,
				prompt: note.prompt,
				options: note.options,
			}, (result) => {
				if (result.correct) window.setTimeout(loadWrongNotes, 450);
			});
		}
	}

	async function loadWrongNotes() {
		if (!authenticated || !mountWrongCard()) return;
		try {
			const { response, data } = await requestJson(`${WRONG_NOTES_API}?limit=50`);
			if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP_${response.status}`);
			renderWrongNotes(data.items || []);
		} catch (error) {
			console.warn('Failed to load JLPT wrong notes', error);
		}
	}

	function readCollapseState() {
		try {
			const value = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}');
			return value && typeof value === 'object' ? value : {};
		} catch {
			return {};
		}
	}

	function saveCollapseState(state) {
		try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(state)); } catch { /* optional */ }
	}

	function setCardCollapsed(card, key, collapsed, persist = true) {
		const body = card.querySelector(':scope > .jlpt-section-body');
		const toggle = card.querySelector(':scope > .jlpt-card-heading .jlpt-section-toggle');
		if (!(body instanceof HTMLElement) || !(toggle instanceof HTMLButtonElement)) return;
		card.classList.toggle('is-collapsed', collapsed);
		body.hidden = collapsed;
		toggle.setAttribute('aria-expanded', String(!collapsed));
		toggle.setAttribute('aria-label', collapsed ? t('펼치기', '展開') : t('접기', '折りたたむ'));
		if (persist) {
			const state = readCollapseState();
			state[key] = collapsed;
			saveCollapseState(state);
		}
	}

	function makeCollapsible(card, key, scrollable = false) {
		if (!(card instanceof HTMLElement) || card.dataset.jlptCollapsible === 'true') return;
		const heading = card.querySelector(':scope > .jlpt-card-heading');
		if (!(heading instanceof HTMLElement)) return;
		card.dataset.jlptCollapsible = 'true';
		card.dataset.jlptSectionKey = key;
		card.classList.add('jlpt-collapsible');
		const body = document.createElement('div');
		body.className = `jlpt-section-body${scrollable ? ' is-scrollable' : ''}`;
		const children = [...card.children].filter((node) => node !== heading);
		children.forEach((node) => body.appendChild(node));
		card.appendChild(body);
		const toggle = document.createElement('button');
		toggle.type = 'button';
		toggle.className = 'jlpt-section-toggle';
		toggle.innerHTML = '<span aria-hidden="true">⌄</span>';
		toggle.addEventListener('click', () => setCardCollapsed(card, key, !card.classList.contains('is-collapsed')));
		heading.appendChild(toggle);
		const stored = readCollapseState();
		const collapsed = typeof stored[key] === 'boolean' ? stored[key] : DEFAULT_COLLAPSED.has(key);
		setCardCollapsed(card, key, collapsed, false);
	}

	function mountCollapseToolbar(cards) {
		if (byId('jlpt-experience-toolbar')) return;
		const firstCard = cards.find(({ card }) => card instanceof HTMLElement)?.card;
		if (!(firstCard instanceof HTMLElement)) return;
		const toolbar = document.createElement('div');
		toolbar.id = 'jlpt-experience-toolbar';
		toolbar.className = 'jlpt-experience-toolbar';
		const expand = document.createElement('button');
		expand.type = 'button';
		expand.textContent = t('전체 펼치기', 'すべて展開');
		const collapse = document.createElement('button');
		collapse.type = 'button';
		collapse.textContent = t('전체 접기', 'すべて折りたたむ');
		expand.addEventListener('click', () => cards.forEach(({ card, key }) => setCardCollapsed(card, key, false)));
		collapse.addEventListener('click', () => cards.forEach(({ card, key }) => setCardCollapsed(card, key, true)));
		toolbar.append(expand, collapse);
		firstCard.parentNode?.insertBefore(toolbar, firstCard);
	}

	function setupCollapsibleSections() {
		const definitions = [
			{ key: 'progress', card: document.querySelector('.jlpt-progress-row')?.closest('.jlpt-card'), scroll: false },
			{ key: 'today', card: byId('jlpt-start-button')?.closest('.jlpt-card'), scroll: false },
			{ key: 'preview', card: byId('jlpt-preview-card'), scroll: false },
			{ key: 'words', card: byId('jlpt-study-detail'), scroll: true },
			{ key: 'vocab', card: byId('jlpt-vocab-contents')?.closest('.jlpt-card'), scroll: true },
			{ key: 'grammar', card: byId('jlpt-grammar-contents')?.closest('.jlpt-card'), scroll: true },
			{ key: 'wrong', card: byId('jlpt-wrong-card'), scroll: true },
			{ key: 'reading', card: byId('jlpt-reading-contents')?.closest('.jlpt-card'), scroll: false },
			{ key: 'calendar', card: byId('jlpt-calendar')?.closest('.jlpt-card'), scroll: false },
		].filter((item) => item.card instanceof HTMLElement);
		definitions.forEach(({ card, key, scroll }) => makeCollapsible(card, key, scroll));
		mountCollapseToolbar(definitions);
	}

	async function initialize() {
		mountStyle();
		document.addEventListener('click', handleOptionCapture, true);
		try {
			const [, practice] = await Promise.all([detectAuthentication(), loadPractice()]);
			todayPractice = practice;
			selectedPreviewDate = practice.studyDate;
			mountPreviewCard();
			renderPreview(practice);
			if (authenticated) {
				observeQuestionContainers();
				scheduleQuestionMapping();
				window.setTimeout(scheduleQuestionMapping, 350);
				window.setTimeout(scheduleQuestionMapping, 900);
				mountWrongCard();
				await loadWrongNotes();
			} else {
				renderVisitorPractice(practice);
			}
			setupCollapsibleSections();
		} catch (error) {
			console.error('Failed to initialize JLPT practice experience', error);
		}
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
