(() => {
	const fallbackAttempts = [
		{ type: 'reading', question: '扱う', answer: 'あずかう', correct: 'あつかう', isCorrect: false },
		{ type: 'meaning', question: '対応', answer: '확인', correct: '대응, 대처', isCorrect: false },
		{ type: 'sentence', question: 'この道具は丁寧に ＿＿＿＿ ください。', answer: '集めて', correct: '扱って', isCorrect: false },
	];

	function byId(id) { return document.getElementById(id); }
	function t(key, fallback) {
		const value = window.AdminI18n?.t(key);
		return value && value !== key ? value : fallback;
	}
	function language() { return window.AdminI18n?.getLanguage?.() ?? 'ja'; }

	function typeLabel(type) {
		if (type === 'meaning') return language() === 'ko' ? '단어 → 한국어 뜻' : '単語 → 韓国語の意味';
		if (type === 'sentence') return language() === 'ko' ? '예문 빈칸 → 단어' : '例文の空欄 → 単語';
		return language() === 'ko' ? '단어 → 히라가나' : '単語 → ひらがな';
	}

	function readResult() {
		try {
			const raw = sessionStorage.getItem('song_japanese_quiz_result');
			if (!raw) return null;
			const parsed = JSON.parse(raw);
			return parsed && typeof parsed === 'object' ? parsed : null;
		} catch (error) {
			console.warn('Failed to restore quiz result', error);
			return null;
		}
	}

	function normalizedResult() {
		const stored = readResult();
		if (stored) {
			const total = Math.max(1, Number(stored.total) || 1);
			const correct = Math.max(0, Math.min(total, Number(stored.correct) || 0));
			const attempts = Array.isArray(stored.attempts) ? stored.attempts : [];
			return { ...stored, total, correct, wrong: total - correct, attempts };
		}
		return { total: 20, correct: 15, wrong: 5, attempts: fallbackAttempts, setup: { types: ['reading', 'meaning', 'sentence'], count: 20 } };
	}

	function renderSummary(result) {
		const rate = Math.round((result.correct / result.total) * 100);
		const rateText = `${rate}%`;
		byId('quiz-result-rate').textContent = rateText;
		byId('quiz-result-correct').textContent = String(result.correct);
		byId('quiz-result-total').textContent = String(result.total);
		byId('quiz-result-stat-correct').textContent = String(result.correct);
		byId('quiz-result-stat-wrong').textContent = String(result.wrong);
		byId('quiz-result-stat-rate').textContent = rateText;
		byId('quiz-result-stat-total').textContent = String(result.total);
		byId('quiz-result-rate').closest('.admin-quiz-result-rate-ring').style.background = `conic-gradient(#1f56d8 0 ${rate}%, #e9eef5 ${rate}% 100%)`;
		const message = byId('quiz-result-message');
		if (rate === 100) message.textContent = t('resultMessagePerfect', '全問正解です。');
		else if (rate >= 80) message.textContent = t('resultMessageGreat', 'よくできました。');
		else if (rate >= 60) message.textContent = t('resultMessageGood', 'あと少しです。');
		else message.textContent = t('resultMessageReview', '間違えた問題を復習しましょう。');
	}

	function renderBreakdown(result) {
		const container = byId('quiz-result-breakdown');
		container.replaceChildren();
		const types = ['reading', 'meaning', 'sentence'];
		for (const type of types) {
			const attempts = result.attempts.filter((item) => item.type === type);
			const total = attempts.length;
			const correct = attempts.filter((item) => item.isCorrect).length;
			const rate = total ? Math.round((correct / total) * 100) : 0;
			const card = document.createElement('article');
			card.className = 'admin-quiz-result-type-card';
			const header = document.createElement('header');
			const strong = document.createElement('strong');
			strong.textContent = typeLabel(type);
			const stat = document.createElement('span');
			stat.textContent = total ? `${correct} / ${total} · ${rate}%` : t('resultNoQuestions', '出題なし');
			header.append(strong, stat);
			const bar = document.createElement('div');
			bar.className = 'bar';
			const fill = document.createElement('i');
			fill.style.width = `${rate}%`;
			bar.appendChild(fill);
			card.append(header, bar);
			container.appendChild(card);
		}
	}

	function renderWrong(result) {
		const wrong = result.attempts.filter((item) => !item.isCorrect);
		const list = byId('quiz-result-wrong-list');
		const empty = byId('quiz-result-wrong-empty');
		const count = byId('quiz-result-wrong-count');
		count.textContent = String(wrong.length || result.wrong);
		list.replaceChildren();
		if (!wrong.length) {
			empty.hidden = false;
			list.hidden = true;
			return;
		}
		empty.hidden = true;
		list.hidden = false;
		wrong.forEach((item, index) => {
			const article = document.createElement('article');
			article.className = 'admin-quiz-result-wrong-item';
			const number = document.createElement('div');
			number.className = 'admin-quiz-result-wrong-index';
			number.textContent = String(index + 1).padStart(2, '0');
			const copy = document.createElement('div');
			copy.className = 'admin-quiz-result-wrong-copy';
			const small = document.createElement('small');
			small.textContent = typeLabel(item.type);
			const question = document.createElement('strong');
			question.textContent = item.question ?? '';
			copy.append(small, question);
			const answers = document.createElement('div');
			answers.className = 'admin-quiz-result-answer-box';
			const mine = document.createElement('div');
			const mineLabel = document.createElement('span');
			mineLabel.textContent = t('resultYourAnswer', 'あなたの答え');
			const mineText = document.createElement('b');
			mineText.textContent = item.answer || t('resultSkipped', 'スキップ');
			mine.append(mineLabel, mineText);
			const correct = document.createElement('div');
			correct.className = 'correct';
			const correctLabel = document.createElement('span');
			correctLabel.textContent = t('resultCorrectAnswer', '正解');
			const correctText = document.createElement('b');
			correctText.textContent = item.correct ?? '';
			correct.append(correctLabel, correctText);
			answers.append(mine, correct);
			article.append(number, copy, answers);
			list.appendChild(article);
		});
	}

	function retryWrong(result) {
		const wrong = result.attempts.filter((item) => !item.isCorrect);
		if (!wrong.length) return;
		const setup = { ...(result.setup ?? {}), count: wrong.length, retryWrong: true };
		sessionStorage.setItem('song_japanese_quiz_setup', JSON.stringify(setup));
		sessionStorage.setItem('song_japanese_quiz_retry_items', JSON.stringify(wrong));
		window.location.href = '/admin/japanese/quiz/play/';
	}

	async function initialize() {
		await window.AdminCommon?.ready;
		const result = normalizedResult();
		renderSummary(result);
		renderBreakdown(result);
		renderWrong(result);
		byId('quiz-result-retry-wrong')?.addEventListener('click', () => retryWrong(result));
		document.addEventListener('adminlanguagechange', () => {
			renderSummary(result);
			renderBreakdown(result);
			renderWrong(result);
		});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
