(() => {
	let sessions = [];
	let currentDetail = null;

	function byId(id) { return document.getElementById(id); }
	function language() { return window.AdminI18n?.getLanguage?.() ?? 'ja'; }
	function text(ja, ko) { return language() === 'ko' ? ko : ja; }

	function formatDateTime(value) {
		if (!value) return '—';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '—';
		return new Intl.DateTimeFormat(language() === 'ko' ? 'ko-KR' : 'ja-JP', {
			year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
			timeZone: 'Asia/Tokyo', hour12: false,
		}).format(date);
	}

	function accuracy(session) {
		const total = Number(session?.total) || 0;
		const correct = Number(session?.correct) || 0;
		return total > 0 ? Math.round((correct / total) * 100) : 0;
	}

	function categoryLabel(settings = {}) {
		return settings.categoryName || settings.categoryParentName || text('すべて', '전체');
	}

	function scopeSubtext(settings = {}) {
		const values = [];
		if (settings.jlpt) values.push(settings.jlpt);
		if (settings.partOfSpeechName || settings.partParentName) values.push(settings.partOfSpeechName || settings.partParentName);
		const types = Array.isArray(settings.types) ? settings.types.length : 0;
		if (types) values.push(text(`${types}種`, `${types}종`));
		return values.join(' · ') || text('全範囲', '전체 범위');
	}

	function applyLanguageCopy() {
		byId('quiz-history-title').textContent = text('学習履歴', '학습 결과');
		byId('quiz-history-description').textContent = text('過去に解いたクイズ、正解・不正解、出題条件を確認します。', '예전에 풀었던 퀴즈와 정답·오답, 출제 조건을 확인합니다.');
		byId('quiz-history-list-title').textContent = text('クイズ履歴', '퀴즈 이력');
		byId('quiz-history-th-date').textContent = text('日時', '날짜 · 시간');
		byId('quiz-history-th-category').textContent = text('出題カテゴリー', '출제 카테고리');
		byId('quiz-history-th-total').textContent = text('全体', '전체 수');
		byId('quiz-history-th-correct').textContent = text('正解', '정답 수');
		byId('quiz-history-th-wrong').textContent = text('不正解', '오답 수');
		byId('quiz-history-th-rate').textContent = text('正答率', '정답률');
		byId('quiz-history-th-action').textContent = text('操作', '기능');
		byId('quiz-history-loading').textContent = text('履歴を読み込んでいます…', '학습 이력을 불러오는 중…');
		byId('quiz-history-empty').textContent = text('保存されたクイズ履歴はまだありません。', '아직 저장된 퀴즈 이력이 없습니다.');
		byId('quiz-history-error').textContent = text('履歴を読み込めませんでした。', '학습 이력을 불러오지 못했습니다.');
		byId('quiz-history-detail-title').textContent = text('誤答確認', '오답 확인');
		byId('quiz-history-detail-close').textContent = text('閉じる', '닫기');
		byId('quiz-history-wrong-empty').textContent = text('このクイズは全問正解でした。', '이 퀴즈는 전부 정답이었습니다.');
		document.querySelector('.admin-quiz-result-back').textContent = text('新しいクイズ', '새 퀴즈');
		renderHistory();
		if (currentDetail) renderDetail(currentDetail);
	}

	function makeButton(label, className, handler) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = className;
		button.textContent = label;
		button.addEventListener('click', handler);
		return button;
	}

	function retrySession(session) {
		if (!session?.settings) return;
		sessionStorage.setItem('song_japanese_quiz_setup', JSON.stringify(session.settings));
		window.location.href = '/admin/japanese/quiz/play/';
	}

	function renderHistory() {
		const body = byId('quiz-history-body');
		if (!body) return;
		body.replaceChildren();
		byId('quiz-history-count').textContent = String(sessions.length);
		for (const session of sessions) {
			const row = document.createElement('tr');
			const date = document.createElement('td');
			date.textContent = formatDateTime(session.startedAt);

			const category = document.createElement('td');
			const categoryStrong = document.createElement('strong');
			categoryStrong.textContent = categoryLabel(session.settings);
			const categorySmall = document.createElement('small');
			categorySmall.textContent = scopeSubtext(session.settings);
			category.append(categoryStrong, categorySmall);

			const total = document.createElement('td'); total.textContent = String(session.total ?? 0);
			const correct = document.createElement('td'); correct.textContent = String(session.correct ?? 0);
			correct.className = 'is-correct';
			const wrong = document.createElement('td'); wrong.textContent = String(session.wrong ?? 0);
			wrong.className = Number(session.wrong) > 0 ? 'is-wrong' : '';
			const rate = document.createElement('td'); rate.textContent = `${accuracy(session)}%`;

			const action = document.createElement('td');
			const actions = document.createElement('div');
			actions.className = 'admin-quiz-history-actions';
			actions.append(
				makeButton(text('誤答確認', '오답 확인'), 'admin-quiz-history-review', () => showDetail(session.id)),
				makeButton(text('もう一度', '다시 풀기'), 'admin-quiz-history-retry', () => retrySession(session)),
			);
			action.appendChild(actions);
			row.append(date, category, total, correct, wrong, rate, action);
			body.appendChild(row);
		}
	}

	function typeLabel(type) {
		if (type === 'meaning') return text('単語 → 韓国語の意味', '단어 → 한국어 뜻');
		if (type === 'sentence') return text('例文の空欄 → 単語', '예문 빈칸 → 단어');
		return text('単語 → ひらがな', '단어 → 히라가나');
	}

	function renderDetail(detail) {
		const panel = byId('quiz-history-detail');
		const list = byId('quiz-history-wrong-list');
		const empty = byId('quiz-history-wrong-empty');
		const summary = byId('quiz-history-detail-summary');
		if (!panel || !list || !empty || !summary) return;
		panel.hidden = false;
		const session = detail.session ?? detail;
		const wrong = Array.isArray(session.attempts) ? session.attempts.filter((attempt) => !attempt.isCorrect) : [];
		byId('quiz-history-detail-meta').textContent = `${formatDateTime(session.startedAt)} · ${categoryLabel(session.settings)} · ${text('誤答', '오답')} ${wrong.length}`;

		summary.replaceChildren();
		for (const [label, value] of [
			[text('全体', '전체'), session.total ?? 0],
			[text('正解', '정답'), session.correct ?? 0],
			[text('不正解', '오답'), session.wrong ?? 0],
			[text('正答率', '정답률'), `${accuracy(session)}%`],
		]) {
			const item = document.createElement('div');
			const span = document.createElement('span'); span.textContent = label;
			const strong = document.createElement('strong'); strong.textContent = String(value);
			item.append(span, strong); summary.appendChild(item);
		}

		list.replaceChildren();
		empty.hidden = wrong.length > 0;
		list.hidden = wrong.length === 0;
		wrong.forEach((item, index) => {
			const article = document.createElement('article');
			article.className = 'admin-quiz-result-wrong-item';
			const number = document.createElement('div');
			number.className = 'admin-quiz-result-wrong-index';
			number.textContent = String(index + 1).padStart(2, '0');
			const copy = document.createElement('div');
			copy.className = 'admin-quiz-result-wrong-copy';
			const small = document.createElement('small'); small.textContent = typeLabel(item.type);
			const question = document.createElement('strong'); question.textContent = item.prompt ?? '';
			copy.append(small, question);
			const answers = document.createElement('div');
			answers.className = 'admin-quiz-result-answer-box';
			const mine = document.createElement('div');
			const mineLabel = document.createElement('span'); mineLabel.textContent = text('あなたの答え', '내 답');
			const mineText = document.createElement('b'); mineText.textContent = item.answer || text('スキップ', '스킵');
			mine.append(mineLabel, mineText);
			const expected = document.createElement('div'); expected.className = 'correct';
			const expectedLabel = document.createElement('span'); expectedLabel.textContent = text('正解', '정답');
			const expectedText = document.createElement('b'); expectedText.textContent = item.correct ?? '';
			expected.append(expectedLabel, expectedText);
			answers.append(mine, expected);
			article.append(number, copy, answers);
			list.appendChild(article);
		});
	}

	async function showDetail(id) {
		try {
			const response = await fetch(`/api/admin/japanese/quiz/history/detail?id=${encodeURIComponent(id)}`, { credentials: 'same-origin', cache: 'no-store' });
			const result = await response.json().catch(() => null);
			if (response.status === 401) { window.location.replace('/admin/login/'); return; }
			if (!response.ok || !result?.ok || !result.session) throw new Error(result?.error || 'DETAIL_FAILED');
			currentDetail = result;
			renderDetail(result);
			history.replaceState(null, '', `/admin/japanese/quiz/result/?session=${encodeURIComponent(id)}`);
			byId('quiz-history-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		} catch (error) {
			console.error('Failed to load quiz detail', error);
		}
	}

	function renderLocalFallback() {
		try {
			const raw = sessionStorage.getItem('song_japanese_quiz_result');
			if (!raw) return false;
			const stored = JSON.parse(raw);
			currentDetail = { session: { ...stored, startedAt: stored.startedAt, completedAt: stored.completedAt } };
			renderDetail(currentDetail);
			return true;
		} catch {
			return false;
		}
	}

	async function loadHistory() {
		try {
			const response = await fetch('/api/admin/japanese/quiz/history', { credentials: 'same-origin', cache: 'no-store' });
			const result = await response.json().catch(() => null);
			if (response.status === 401) { window.location.replace('/admin/login/'); return; }
			if (!response.ok || !result?.ok || !Array.isArray(result.sessions)) throw new Error(result?.error || 'HISTORY_FAILED');
			sessions = result.sessions;
			byId('quiz-history-loading').hidden = true;
			byId('quiz-history-error').hidden = true;
			byId('quiz-history-empty').hidden = sessions.length > 0;
			byId('quiz-history-table-wrap').hidden = sessions.length === 0;
			renderHistory();
			const requested = Number(new URLSearchParams(location.search).get('session'));
			if (Number.isSafeInteger(requested) && requested > 0) await showDetail(requested);
			else if (new URLSearchParams(location.search).get('local') === '1') renderLocalFallback();
		} catch (error) {
			console.error('Failed to load quiz history', error);
			byId('quiz-history-loading').hidden = true;
			byId('quiz-history-error').hidden = false;
			if (new URLSearchParams(location.search).get('local') === '1') renderLocalFallback();
		}
	}

	async function initialize() {
		await window.AdminCommon?.ready;
		byId('quiz-history-detail-close')?.addEventListener('click', () => {
			byId('quiz-history-detail').hidden = true;
			currentDetail = null;
			history.replaceState(null, '', '/admin/japanese/quiz/result/');
		});
		document.addEventListener('adminlanguagechange', applyLanguageCopy);
		applyLanguageCopy();
		await loadHistory();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
