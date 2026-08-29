(() => {
	const RESULT_KEY = 'song_public_japanese_quiz_result';
	const HISTORY_KEY = 'song_public_japanese_quiz_history_v1';
	const SETUP_KEY = 'song_public_japanese_quiz_setup';
	const RETRY_KEY = 'song_public_japanese_quiz_retry_questions';
	let selectedResult = null;

	function byId(id) { return document.getElementById(id); }
	function language() { return document.body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja'; }
	function copy(ko, ja) { return language() === 'ko' ? ko : ja; }
	function read(storage, key, fallback) {
		try {
			const raw = storage.getItem(key);
			return raw ? JSON.parse(raw) : fallback;
		} catch {
			return fallback;
		}
	}
	function history() {
		const value = read(localStorage, HISTORY_KEY, []);
		return Array.isArray(value) ? value : [];
	}
	function rate(result) { return result?.total ? Math.round((Number(result.correct || 0) / Number(result.total)) * 100) : 0; }
	function formatDate(value) {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '—';
		return new Intl.DateTimeFormat(language() === 'ko' ? 'ko-KR' : 'ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
	}
	function formatTime(value) {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '—';
		return new Intl.DateTimeFormat(language() === 'ko' ? 'ko-KR' : 'ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(date);
	}
	function duration(value) {
		const seconds = Math.max(0, Number(value) || 0);
		if (seconds < 60) return `${seconds}${copy('초', '秒')}`;
		const minutes = Math.floor(seconds / 60);
		const remain = seconds % 60;
		return `${minutes}${copy('분', '分')} ${remain}${copy('초', '秒')}`;
	}
	function typeLabel(type) {
		if (type === 'meaning') return copy('뜻', '意味');
		if (type === 'sentence') return copy('예문', '例文');
		return copy('읽기', '読み');
	}
	function scopeLabel(result) {
		const setup = result?.setup || {};
		const values = [setup.jlpt || 'ALL'];
		if (setup.categoryName && !['전체', 'すべて'].includes(setup.categoryName)) values.push(setup.categoryName);
		if (setup.partName && !['전체', 'すべて'].includes(setup.partName)) values.push(setup.partName);
		return values.join(' · ');
	}

	function renderSummary(result) {
		const currentRate = rate(result);
		byId('result-rate').textContent = `${currentRate}%`;
		byId('result-total').textContent = String(result?.total || 0);
		byId('result-correct').textContent = String(result?.correct || 0);
		byId('result-wrong').textContent = String(result?.wrong || 0);
		byId('result-ring').style.setProperty('--jp-result-deg', `${currentRate * 3.6}deg`);
		byId('result-session-meta').textContent = result ? `${formatDate(result.finishedAt)} ${formatTime(result.finishedAt)} · ${duration(result.durationSeconds)} · ${scopeLabel(result)}` : '—';
	}

	function renderBreakdown(result) {
		const wrap = byId('result-breakdown');
		wrap.replaceChildren();
		for (const type of ['reading', 'meaning', 'sentence']) {
			const attempts = (result?.attempts || []).filter((item) => item.questionSnapshot?.type === type);
			const correct = attempts.filter((item) => item.isCorrect).length;
			const currentRate = attempts.length ? Math.round((correct / attempts.length) * 100) : 0;
			const row = document.createElement('div');
			row.className = 'jp-level-row';
			const strong = document.createElement('strong');
			strong.textContent = typeLabel(type);
			const progress = document.createElement('progress');
			progress.max = 100;
			progress.value = currentRate;
			const label = document.createElement('span');
			label.textContent = attempts.length ? `${correct}/${attempts.length} · ${currentRate}%` : copy('출제 없음', '出題なし');
			row.append(strong, progress, label);
			wrap.appendChild(row);
		}
	}

	function renderWrong(result) {
		const list = byId('result-wrong-list');
		const empty = byId('result-wrong-empty');
		const wrong = (result?.attempts || []).filter((item) => !item.isCorrect);
		byId('result-wrong-count').textContent = copy(`${wrong.length}개`, `${wrong.length}問`);
		list.replaceChildren();
		if (!wrong.length) {
			empty.hidden = false;
			list.hidden = true;
			return;
		}
		empty.hidden = true;
		list.hidden = false;
		wrong.forEach((item, index) => {
			const question = item.questionSnapshot || {};
			const article = document.createElement('article');
			article.className = 'jp-quiz-wrong-detail';
			const head = document.createElement('div');
			head.className = 'jp-quiz-wrong-head';
			const no = document.createElement('span');
			no.textContent = String(index + 1).padStart(2, '0');
			const copyWrap = document.createElement('div');
			const small = document.createElement('small');
			small.textContent = `${typeLabel(question.type)} · ${question.level || '—'}`;
			const title = document.createElement('strong');
			title.textContent = question.prompt || question.word || '';
			copyWrap.append(small, title);
			head.append(no, copyWrap);
			const answers = document.createElement('div');
			answers.className = 'jp-quiz-answer-compare';
			const mine = document.createElement('div');
			mine.innerHTML = '';
			const mineLabel = document.createElement('span');
			mineLabel.textContent = copy('내 답', 'あなたの答え');
			const mineValue = document.createElement('b');
			mineValue.textContent = item.answer || copy('미응답', '未回答');
			mine.append(mineLabel, mineValue);
			const answer = document.createElement('div');
			answer.className = 'is-answer';
			const answerLabel = document.createElement('span');
			answerLabel.textContent = copy('정답', '正解');
			const answerValue = document.createElement('b');
			answerValue.textContent = question.correct || '';
			answer.append(answerLabel, answerValue);
			answers.append(mine, answer);
			article.append(head, answers);
			list.appendChild(article);
		});
	}

	function selectResult(result, shouldScroll = false) {
		selectedResult = result;
		renderSummary(result);
		renderBreakdown(result);
		renderWrong(result);
		if (shouldScroll) byId('current-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function retry(result, wrongOnly = false) {
		if (!result) return;
		const attempts = (result.attempts || []).filter((item) => !wrongOnly || !item.isCorrect);
		const questions = attempts.map((item) => item.questionSnapshot).filter(Boolean);
		if (!questions.length) return;
		const setup = { ...(result.setup || {}), count: questions.length };
		sessionStorage.setItem(SETUP_KEY, JSON.stringify(setup));
		sessionStorage.setItem(RETRY_KEY, JSON.stringify(questions));
		window.location.href = `/${language()}/japanese/quiz/play/`;
	}

	function actionButton(label, className, handler, disabled = false) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = className;
		button.textContent = label;
		button.disabled = disabled;
		button.addEventListener('click', handler);
		return button;
	}

	function renderHistory() {
		const body = byId('quiz-history-body');
		const empty = byId('quiz-history-empty');
		const sessions = history();
		body.replaceChildren();
		byId('quiz-history-count').textContent = copy(`${sessions.length}회`, `${sessions.length}回`);
		if (!sessions.length) {
			empty.hidden = false;
			return;
		}
		empty.hidden = true;
		for (const session of sessions) {
			const tr = document.createElement('tr');
			const values = [
				`${formatDate(session.finishedAt)}\n${formatTime(session.finishedAt)}`,
				duration(session.durationSeconds),
				scopeLabel(session),
				String(session.total || 0),
				String(session.correct || 0),
				String(session.wrong || 0),
				`${rate(session)}%`,
			];
			values.forEach((value, index) => {
				const td = document.createElement('td');
				if (index === 0) {
					const [date, time] = value.split('\n');
					const strong = document.createElement('strong'); strong.textContent = date;
					const small = document.createElement('small'); small.textContent = time;
					td.append(strong, small);
				} else td.textContent = value;
				tr.appendChild(td);
			});
			const actions = document.createElement('td');
			actions.className = 'jp-quiz-history-actions';
			actions.append(
				actionButton(copy('오답 확인', '誤答確認'), 'jp-mini-button', () => selectResult(session, true), Number(session.wrong || 0) === 0),
				actionButton(copy('다시 풀기', '再挑戦'), 'jp-mini-button is-primary', () => retry(session, false)),
			);
			tr.appendChild(actions);
			body.appendChild(tr);
		}
	}

	function initialize() {
		const current = read(sessionStorage, RESULT_KEY, null);
		const sessions = history();
		const requestedId = new URLSearchParams(location.search).get('history');
		const requested = requestedId ? sessions.find((item) => item?.id === requestedId) : null;
		selectResult(requested || current || sessions[0] || { total: 0, correct: 0, wrong: 0, attempts: [], setup: {} });
		byId('result-retry-all')?.addEventListener('click', () => retry(selectedResult, false));
		byId('result-retry-wrong')?.addEventListener('click', () => retry(selectedResult, true));
		renderHistory();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
