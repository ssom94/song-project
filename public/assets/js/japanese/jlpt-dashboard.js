(() => {
	const DASHBOARD_API = '/api/public/japanese/jlpt/dashboard';
	const TODAY_API = '/api/admin/japanese/jlpt/today';
	const START_API = '/api/admin/japanese/jlpt/today/start';
	const WORD_STATE_API = '/api/admin/japanese/jlpt/word-state';
	const CONTENT_PROGRESS_API = '/api/admin/japanese/jlpt/content/progress';

	let dashboard = null;
	let todayData = null;

	function lang() {
		return document.body.dataset.blogLanguage === 'ja' ? 'ja' : 'ko';
	}

	function t(ko, ja) {
		return lang() === 'ja' ? ja : ko;
	}

	function byId(id) {
		return document.getElementById(id);
	}

	function text(id, value) {
		const node = byId(id);
		if (node) node.textContent = String(value ?? '—');
	}

	function percent(value) {
		const number = Number(value ?? 0);
		return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0;
	}

	function setBar(id, value) {
		const node = byId(id);
		if (node) node.style.width = `${percent(value)}%`;
	}

	function formatDate(value) {
		if (!value) return '—';
		const parts = String(value).split('-');
		if (parts.length !== 3) return String(value);
		return lang() === 'ja' ? `${parts[0]}.${parts[1]}.${parts[2]}` : `${parts[0]}.${parts[1]}.${parts[2]}`;
	}

	function formatCount(completed, target) {
		return `${Number(completed ?? 0)} / ${Number(target ?? 0)}`;
	}

	function setError(message) {
		const node = byId('jlpt-error');
		if (!node) return;
		node.hidden = !message;
		node.textContent = message || '';
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

	function renderDashboard(data) {
		dashboard = data;
		const plan = data.plan;
		const progress = data.progress;
		const today = data.today;
		text('jlpt-dday', `D-${plan.daysRemaining}`);
		text('jlpt-target-date', formatDate(plan.targetExamDate));
		text('jlpt-curriculum-count', progress.curriculumWords);
		text('jlpt-target-words', plan.targetWordCount);
		text('jlpt-studied-count', progress.studiedWords);
		text('jlpt-mastered-count', progress.masteredWords);
		text('jlpt-uncertain-count', progress.uncertainWords);
		text('jlpt-review-due', progress.reviewDueWords);
		text('jlpt-registered-n1', progress.registeredN1Words);
		text('jlpt-curriculum-percent', `${progress.curriculumPercent}%`);
		text('jlpt-study-percent', `${progress.studyPercent}%`);
		text('jlpt-mastery-percent', `${progress.masteryPercent}%`);
		setBar('jlpt-curriculum-bar', progress.curriculumPercent);
		setBar('jlpt-study-bar', progress.studyPercent);
		setBar('jlpt-mastery-bar', progress.masteryPercent);
		setBar('jlpt-today-bar', today.progressPercent);
		text('jlpt-today-percent', `${today.progressPercent}%`);
		text('jlpt-today-review', formatCount(today.completed.review, today.targets.review));
		text('jlpt-today-new', formatCount(today.completed.newWords, today.targets.newWords));
		text('jlpt-today-vocab', formatCount(today.completed.vocabQuestions, today.targets.vocabQuestions));
		text('jlpt-today-grammar', formatCount(today.completed.grammar, today.targets.grammar));
		text('jlpt-today-reading', formatCount(today.completed.reading, today.targets.reading));

		const tentative = byId('jlpt-date-note');
		if (tentative) tentative.hidden = !plan.targetDateIsTentative;
		const startButton = byId('jlpt-start-button');
		const startCopy = byId('jlpt-start-copy');
		if (startButton) {
			if (!plan.studyStarted) {
				startButton.disabled = true;
				startButton.textContent = t('내일부터 학습 시작', '明日から学習開始');
			} else if (today.sessionId) {
				startButton.disabled = false;
				startButton.textContent = t('오늘 학습 불러오기', '今日の学習を開く');
			} else {
				startButton.disabled = false;
				startButton.textContent = t('오늘의 학습 시작', '今日の学習を開始');
			}
		}
		if (startCopy) {
			startCopy.textContent = plan.studyStarted
				? t('복습 예정 단어를 먼저 불러오고, 이어서 오늘 신규 단어를 배정합니다.', '復習予定の単語を先に読み込み、その後に今日の新規単語を割り当てます。')
				: t(`학습 시작일은 ${formatDate(plan.studyStartDate)}입니다. 오늘은 기능 구축만 진행합니다.`, `学習開始日は ${formatDate(plan.studyStartDate)} です。今日は機能構築のみ行います。`);
		}
		renderCalendar(data.calendar, plan.today);
	}

	function renderCalendar(entries, today) {
		const wrap = byId('jlpt-calendar');
		if (!wrap) return;
		wrap.replaceChildren();
		const statusMap = new Map((Array.isArray(entries) ? entries : []).map((item) => [item.date, item]));
		const end = new Date(`${today}T00:00:00+09:00`);
		for (let offset = 27; offset >= 0; offset -= 1) {
			const date = new Date(end.getTime() - offset * 86400000);
			const dateText = new Intl.DateTimeFormat('en-CA', {
				timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
			}).format(date);
			const item = statusMap.get(dateText);
			const cell = document.createElement('div');
			cell.className = 'jlpt-calendar-day';
			cell.dataset.status = item?.status || 'not_started';
			const strong = document.createElement('strong');
			strong.textContent = dateText.slice(5).replace('-', '/');
			const state = document.createElement('span');
			if (!item) state.textContent = '—';
			else if (item.status === 'completed') state.textContent = `✅ ${item.progressPercent}%`;
			else if (item.status === 'in_progress') state.textContent = `🟡 ${item.progressPercent}%`;
			else state.textContent = `○ ${item.progressPercent}%`;
			cell.append(strong, state);
			wrap.appendChild(cell);
		}
	}

	function stateLabel(state) {
		if (state === 'mastered') return t('외움', '暗記済');
		if (state === 'uncertain') return t('애매함', '曖昧');
		return t('미학습', '未学習');
	}

	function wordCard(word) {
		const card = document.createElement('article');
		card.className = `jlpt-word-card${word.item_status === 'completed' ? ' is-completed' : ''}`;
		card.dataset.memoryWord = 'true';
		card.dataset.memoryReading = word.reading || '';
		card.dataset.memoryMeaningKo = word.meaning_ko || '';
		const head = document.createElement('div');
		head.className = 'jlpt-word-head';
		const title = document.createElement('div');
		title.className = 'jlpt-word-title';
		const strong = document.createElement('strong');
		strong.textContent = word.word;
		const reading = document.createElement('span');
		reading.textContent = word.reading || '—';
		title.append(strong, reading);
		const badge = document.createElement('span');
		badge.textContent = stateLabel(word.learning_state);
		head.append(title, badge);
		const meaning = document.createElement('p');
		meaning.textContent = word.meaning_ko || word.meaning_ja || '—';
		const actions = document.createElement('div');
		actions.className = 'jlpt-state-actions';
		for (const state of ['unlearned', 'uncertain', 'mastered']) {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'jlpt-state-button';
			button.dataset.state = state;
			button.textContent = stateLabel(state);
			button.addEventListener('click', () => updateWordState(word.id, state, button));
			actions.appendChild(button);
		}
		card.append(head, meaning, actions);
		return card;
	}

	function renderWords(words) {
		const review = byId('jlpt-review-words');
		const fresh = byId('jlpt-new-words');
		if (!review || !fresh) return;
		review.replaceChildren();
		fresh.replaceChildren();
		const reviewWords = (words || []).filter((word) => word.item_kind === 'review');
		const newWords = (words || []).filter((word) => word.item_kind === 'new');
		const fill = (target, values, emptyCopy) => {
			if (!values.length) {
				const empty = document.createElement('div');
				empty.className = 'jlpt-empty';
				empty.textContent = emptyCopy;
				target.appendChild(empty);
				return;
			}
			for (const value of values) target.appendChild(wordCard(value));
		};
		fill(review, reviewWords, t('오늘 복습 예정 단어가 없습니다.', '今日の復習予定単語はありません。'));
		fill(fresh, newWords, t('오늘 신규 단어가 아직 등록되지 않았습니다.', '今日の新規単語はまだ登録されていません。'));
	}

	function appendParagraph(parent, value) {
		if (!value) return;
		const paragraph = document.createElement('p');
		paragraph.textContent = String(value);
		parent.appendChild(paragraph);
	}

	function renderQuestionPayload(parent, payload) {
		appendParagraph(parent, payload.prompt || payload.question);
		if (Array.isArray(payload.options) && payload.options.length) {
			const options = document.createElement('div');
			options.className = 'jlpt-question-options';
			const answer = document.createElement('div');
			answer.className = 'jlpt-answer';
			answer.hidden = true;
			for (const option of payload.options) {
				const button = document.createElement('button');
				button.type = 'button';
				button.textContent = String(option);
				button.addEventListener('click', () => {
					const correct = String(payload.answer ?? '');
					answer.textContent = t(
						`정답: ${correct || '—'}${payload.explanation ? ` · ${payload.explanation}` : ''}`,
						`正解: ${correct || '—'}${payload.explanation ? ` · ${payload.explanation}` : ''}`,
					);
					answer.hidden = false;
				});
				options.appendChild(button);
			}
			parent.append(options, answer);
		} else if (payload.answer) {
			const reveal = document.createElement('button');
			reveal.type = 'button';
			reveal.className = 'jlpt-secondary-button';
			reveal.textContent = t('정답 보기', '正解を見る');
			const answer = document.createElement('div');
			answer.className = 'jlpt-answer';
			answer.hidden = true;
			reveal.addEventListener('click', () => {
				answer.textContent = `${t('정답', '正解')}: ${payload.answer}${payload.explanation ? ` · ${payload.explanation}` : ''}`;
				answer.hidden = false;
			});
			parent.append(reveal, answer);
		}
	}

	function renderGrammarPayload(parent, payload) {
		if (payload.pattern) {
			const pattern = document.createElement('h3');
			pattern.textContent = String(payload.pattern);
			parent.appendChild(pattern);
		}
		appendParagraph(parent, payload.meaningKo || payload.meaningJa || payload.meaning);
		appendParagraph(parent, payload.explanation);
		if (Array.isArray(payload.examples)) {
			const list = document.createElement('ul');
			for (const example of payload.examples) {
				const li = document.createElement('li');
				if (typeof example === 'string') li.textContent = example;
				else li.textContent = [example?.ja, example?.ko].filter(Boolean).join(' — ');
				list.appendChild(li);
			}
			parent.appendChild(list);
		}
	}

	function renderReadingPayload(parent, payload) {
		const passage = document.createElement('p');
		passage.textContent = String(payload.passage || payload.text || '');
		parent.appendChild(passage);
		if (Array.isArray(payload.questions)) {
			payload.questions.forEach((question, index) => {
				const box = document.createElement('div');
				const title = document.createElement('h3');
				title.textContent = `${t('문제', '問題')} ${index + 1}`;
				box.appendChild(title);
				renderQuestionPayload(box, question || {});
				parent.appendChild(box);
			});
		}
	}

	function contentCard(item) {
		const card = document.createElement('article');
		card.className = `jlpt-content-card${item.completed ? ' is-completed' : ''}`;
		const title = document.createElement('h3');
		title.textContent = item.title || `${item.type} #${item.sequence}`;
		card.appendChild(title);
		const payload = item.payload && typeof item.payload === 'object' ? item.payload : {};
		if (item.type === 'vocab_question' || item.type === 'grammar_question') renderQuestionPayload(card, payload);
		else if (item.type === 'grammar') renderGrammarPayload(card, payload);
		else if (item.type === 'reading') renderReadingPayload(card, payload);
		else {
			const pre = document.createElement('pre');
			pre.textContent = JSON.stringify(payload, null, 2);
			card.appendChild(pre);
		}
		const done = document.createElement('button');
		done.type = 'button';
		done.className = 'jlpt-content-done';
		done.textContent = item.completed ? t('완료 취소', '完了を取消') : t('학습 완료', '学習完了');
		done.addEventListener('click', () => toggleContent(item.id, !item.completed, done));
		card.appendChild(done);
		return card;
	}

	function renderContents(items) {
		const groups = {
			vocab_question: byId('jlpt-vocab-contents'),
			grammar: byId('jlpt-grammar-contents'),
			grammar_question: byId('jlpt-grammar-questions'),
			reading: byId('jlpt-reading-contents'),
		};
		for (const target of Object.values(groups)) target?.replaceChildren();
		for (const [type, target] of Object.entries(groups)) {
			if (!target) continue;
			const values = (items || []).filter((item) => item.type === type);
			if (!values.length) {
				const empty = document.createElement('div');
				empty.className = 'jlpt-empty';
				empty.textContent = t('오늘 등록된 학습 자료가 없습니다.', '今日登録された学習コンテンツはありません。');
				target.appendChild(empty);
				continue;
			}
			for (const item of values) target.appendChild(contentCard(item));
		}
	}

	async function loadAdminToday() {
		const { response, data } = await requestJson(TODAY_API);
		if (response.status === 401) {
			byId('jlpt-study-detail')?.classList.add('jlpt-hidden');
			return;
		}
		if (!response.ok || !data?.ok) return;
		todayData = data;
		byId('jlpt-study-detail')?.classList.remove('jlpt-hidden');
		renderWords(data.words || []);
		renderContents(data.contents || []);
	}

	async function startToday() {
		const button = byId('jlpt-start-button');
		if (button) button.disabled = true;
		setError('');
		try {
			const { response, data } = await requestJson(START_API, { method: 'POST' });
			if (response.status === 401) {
				window.location.href = '/admin/login/';
				return;
			}
			if (response.status === 409 && data?.error === 'STUDY_NOT_STARTED') {
				setError(t('학습 시작일 전입니다.', '学習開始日前です。'));
				return;
			}
			if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP_${response.status}`);
			todayData = data;
			byId('jlpt-study-detail')?.classList.remove('jlpt-hidden');
			renderWords(data.words || []);
			renderContents(data.contents || []);
			await loadDashboard();
		} catch (error) {
			console.error('Failed to start JLPT study', error);
			setError(t('오늘의 학습을 시작하지 못했습니다.', '今日の学習を開始できませんでした。'));
		} finally {
			if (button && dashboard?.plan?.studyStarted) button.disabled = false;
		}
	}

	async function updateWordState(wordId, state, button) {
		button.disabled = true;
		try {
			const { response, data } = await requestJson(WORD_STATE_API, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ wordId, state }),
			});
			if (response.status === 401) {
				window.location.href = '/admin/login/';
				return;
			}
			if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP_${response.status}`);
			await Promise.all([loadDashboard(), loadAdminToday()]);
		} catch (error) {
			console.error('Failed to update JLPT word state', error);
			setError(t('단어 학습 상태를 저장하지 못했습니다.', '単語の学習状態を保存できませんでした。'));
		} finally {
			button.disabled = false;
		}
	}

	async function toggleContent(contentId, completed, button) {
		button.disabled = true;
		try {
			const { response, data } = await requestJson(CONTENT_PROGRESS_API, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contentId, completed }),
			});
			if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP_${response.status}`);
			await Promise.all([loadDashboard(), loadAdminToday()]);
		} catch (error) {
			console.error('Failed to update JLPT content progress', error);
			setError(t('학습 진행 상태를 저장하지 못했습니다.', '学習進捗を保存できませんでした。'));
		} finally {
			button.disabled = false;
		}
	}

	async function loadDashboard() {
		const { response, data } = await requestJson(DASHBOARD_API);
		if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP_${response.status}`);
		renderDashboard(data);
	}

	async function initialize() {
		byId('jlpt-start-button')?.addEventListener('click', startToday);
		try {
			await loadDashboard();
			await loadAdminToday();
		} catch (error) {
			console.error('Failed to initialize JLPT dashboard', error);
			setError(t('JLPT 학습 정보를 불러오지 못했습니다.', 'JLPT学習情報を読み込めませんでした。'));
		}
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
