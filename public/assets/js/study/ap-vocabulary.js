(() => {
	const language = document.body.dataset.blogLanguage === 'ja' ? 'ja' : 'ko';
	const text = language === 'ja'
		? {
			login: '管理者ログイン後にAP技術用語帳を利用できます。', loadError: 'AP用語帳を読み込めませんでした。',
			saved: '保存しました。', duplicate: '既存の用語を更新しました。', deleted: '削除しました。',
			empty: 'まだ登録されたAP用語がありません。', due: '復習対象', total: '登録語',
			quizEmpty: 'この形式で出題できる単語がありません。', reveal: '答えを見る', correct: '正解', wrong: '不正解',
			finished: '単語テストが終了しました。', question: '問題', answer: '正解', contextHint: '文脈を読んで対象語の意味を答えてください。',
		}
		: {
			login: '관리자 로그인 후 AP 기술 단어장을 사용할 수 있습니다.', loadError: 'AP 단어장을 불러오지 못했습니다.',
			saved: '저장했습니다.', duplicate: '이미 있는 단어라 기존 내용을 갱신했습니다.', deleted: '삭제했습니다.',
			empty: '아직 등록된 AP 단어가 없습니다.', due: '복습대상', total: '등록단어',
			quizEmpty: '이 유형으로 시험볼 수 있는 단어가 없습니다.', reveal: '정답 보기', correct: '맞음', wrong: '틀림',
			finished: '단어시험이 끝났습니다.', question: '문제', answer: '정답', contextHint: '문맥을 읽고 대상 단어의 뜻을 답하세요.',
		};

	const byId = (id) => document.getElementById(id);
	const escapeHtml = (value) => String(value ?? '')
		.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
	const stateLabel = (state) => language === 'ja'
		? ({ unlearned: '未学習', learning: '学習中', uncertain: '曖昧', mastered: '習得' })[state] || state
		: ({ unlearned: '미학습', learning: '학습중', uncertain: '애매함', mastered: '숙달' })[state] || state;

	let words = [];
	let quizWords = [];
	let quizIndex = 0;
	let quizType = 'meaning';
	let quizScore = { correct: 0, wrong: 0 };

	async function requestJson(url, options = {}) {
		const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
		const data = await response.json().catch(() => null);
		if (!response.ok || !data?.ok) {
			const error = new Error(data?.error || `HTTP_${response.status}`);
			error.status = response.status;
			throw error;
		}
		return data;
	}

	function notify(message) {
		const target = byId('ap-vocab-notice');
		if (!target) return;
		target.textContent = message;
		target.hidden = false;
		window.setTimeout(() => { target.hidden = true; }, 2200);
	}

	function queryString() {
		const q = byId('ap-vocab-search')?.value?.trim() || '';
		const topic = byId('ap-vocab-topic-filter')?.value || '';
		const state = byId('ap-vocab-state-filter')?.value || '';
		const params = new URLSearchParams();
		if (q) params.set('q', q);
		if (topic) params.set('topic', topic);
		if (state) params.set('state', state);
		return params.toString();
	}

	function renderList(data) {
		words = data.words || [];
		byId('ap-vocab-total').textContent = `${text.total} ${words.length}`;
		byId('ap-vocab-due').textContent = `${text.due} ${data.dueCount || 0}`;
		const list = byId('ap-vocab-list');
		if (!list) return;
		if (!words.length) {
			list.innerHTML = `<p class="ap-vocab-empty">${escapeHtml(text.empty)}</p>`;
			return;
		}
		list.innerHTML = words.map((word) => {
			const topic = language === 'ja' ? word.topic_title_ja : word.topic_title_ko;
			return `<article class="ap-vocab-row">
				<div class="ap-vocab-term"><strong>${escapeHtml(word.term)}</strong><small>${escapeHtml(word.reading || '')}</small></div>
				<div class="ap-vocab-meaning">${escapeHtml(word.meaning_ko)}<div class="ap-vocab-meta">${escapeHtml(topic || '-')}&nbsp; · &nbsp;${escapeHtml(stateLabel(word.learning_state))}&nbsp; · &nbsp;✓${word.correct_count} / ✕${word.wrong_count}${word.next_review_on ? ` · ${escapeHtml(word.next_review_on)}` : ''}</div>${word.source_text ? `<div class="ap-vocab-meta">${escapeHtml(word.source_text)}</div>` : ''}</div>
				<button type="button" data-delete-vocab="${word.id}">${language === 'ja' ? '削除' : '삭제'}</button>
			</article>`;
		}).join('');
		list.querySelectorAll('[data-delete-vocab]').forEach((button) => button.addEventListener('click', deleteWord));
	}

	async function loadWords() {
		try {
			const qs = queryString();
			const data = await requestJson(`/api/admin/ap/vocabulary${qs ? `?${qs}` : ''}`);
			renderList(data);
			byId('ap-vocab-error').hidden = true;
		} catch (error) {
			console.error('Failed to load AP vocabulary', error);
			const target = byId('ap-vocab-error');
			target.textContent = error.status === 401 ? text.login : text.loadError;
			target.hidden = false;
		}
	}

	async function saveWord(event) {
		event.preventDefault();
		const form = event.currentTarget;
		const payload = Object.fromEntries(new FormData(form).entries());
		const button = form.querySelector('button[type="submit"]');
		button.disabled = true;
		try {
			const data = await requestJson('/api/admin/ap/vocabulary', {
				method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
			});
			form.reset();
			notify(data.duplicate ? text.duplicate : text.saved);
			await loadWords();
		} catch (error) {
			console.error('Failed to save AP vocabulary', error);
			byId('ap-vocab-error').textContent = error.status === 401 ? text.login : text.loadError;
			byId('ap-vocab-error').hidden = false;
		} finally {
			button.disabled = false;
		}
	}

	async function deleteWord(event) {
		const id = Number(event.currentTarget.dataset.deleteVocab);
		if (!Number.isSafeInteger(id)) return;
		event.currentTarget.disabled = true;
		try {
			await requestJson(`/api/admin/ap/vocabulary?id=${id}`, { method: 'DELETE' });
			notify(text.deleted);
			await loadWords();
		} catch (error) {
			console.error('Failed to delete AP vocabulary', error);
			event.currentTarget.disabled = false;
		}
	}

	function currentQuizWord() {
		return quizWords[quizIndex] || null;
	}

	function answerFor(word) {
		if (quizType === 'reading') return word.reading || '-';
		return word.meaning_ko || '-';
	}

	function renderQuiz() {
		const box = byId('ap-vocab-quiz-box');
		if (!box) return;
		if (!quizWords.length) {
			box.innerHTML = `<p class="ap-vocab-empty">${escapeHtml(text.quizEmpty)}</p>`;
			return;
		}
		if (quizIndex >= quizWords.length) {
			box.innerHTML = `<div class="ap-vocab-quiz-prompt"><strong>${escapeHtml(text.finished)}</strong><span>✓ ${quizScore.correct} / ✕ ${quizScore.wrong}</span></div>`;
			loadWords();
			return;
		}
		const word = currentQuizWord();
		const prompt = quizType === 'context'
			? `<span>${escapeHtml(text.contextHint)}</span><p>${escapeHtml(word.source_text || '')}</p><strong>${escapeHtml(word.term)}</strong>`
			: `<span>${escapeHtml(text.question)} ${quizIndex + 1}/${quizWords.length}</span><strong>${escapeHtml(word.term)}</strong>${quizType === 'meaning' && word.reading ? `<small>${escapeHtml(word.reading)}</small>` : ''}`;
		box.innerHTML = `<div class="ap-vocab-quiz-prompt">${prompt}</div>
			<label>${language === 'ja' ? '自分の答え' : '내 답'}<input id="ap-vocab-user-answer" type="text" autocomplete="off" /></label>
			<button id="ap-vocab-reveal" type="button">${escapeHtml(text.reveal)}</button>
			<div id="ap-vocab-answer" class="ap-vocab-answer ap-vocab-hidden"><b>${escapeHtml(text.answer)}</b><div>${escapeHtml(answerFor(word))}</div></div>
			<div id="ap-vocab-grade" class="ap-vocab-grade ap-vocab-hidden"><button type="button" data-result="correct">${escapeHtml(text.correct)}</button><button type="button" data-result="wrong">${escapeHtml(text.wrong)}</button></div>`;
		byId('ap-vocab-reveal').addEventListener('click', () => {
			byId('ap-vocab-answer').classList.remove('ap-vocab-hidden');
			byId('ap-vocab-grade').classList.remove('ap-vocab-hidden');
			byId('ap-vocab-reveal').classList.add('ap-vocab-hidden');
		});
		box.querySelectorAll('[data-result]').forEach((button) => button.addEventListener('click', gradeQuiz));
		byId('ap-vocab-user-answer')?.focus();
	}

	async function startQuiz() {
		quizType = byId('ap-vocab-quiz-type')?.value || 'meaning';
		const limit = Number(byId('ap-vocab-quiz-count')?.value || 10);
		try {
			const data = await requestJson(`/api/admin/ap/vocabulary/quiz?type=${encodeURIComponent(quizType)}&limit=${Math.max(1, Math.min(50, limit))}`);
			quizWords = data.words || [];
			quizIndex = 0;
			quizScore = { correct: 0, wrong: 0 };
			renderQuiz();
		} catch (error) {
			console.error('Failed to start AP vocabulary quiz', error);
			byId('ap-vocab-error').textContent = error.status === 401 ? text.login : text.loadError;
			byId('ap-vocab-error').hidden = false;
		}
	}

	async function gradeQuiz(event) {
		const word = currentQuizWord();
		if (!word) return;
		const result = event.currentTarget.dataset.result;
		const answerText = byId('ap-vocab-user-answer')?.value || '';
		event.currentTarget.disabled = true;
		try {
			await requestJson('/api/admin/ap/vocabulary/quiz/grade', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ vocabularyId: word.id, quizType, answerText, result }),
			});
			quizScore[result] += 1;
			quizIndex += 1;
			renderQuiz();
		} catch (error) {
			console.error('Failed to grade AP vocabulary quiz', error);
			event.currentTarget.disabled = false;
		}
	}

	byId('ap-vocab-form')?.addEventListener('submit', saveWord);
	byId('ap-vocab-search')?.addEventListener('input', () => window.clearTimeout(window.__apVocabTimer) || (window.__apVocabTimer = window.setTimeout(loadWords, 250)));
	byId('ap-vocab-topic-filter')?.addEventListener('change', loadWords);
	byId('ap-vocab-state-filter')?.addEventListener('change', loadWords);
	byId('ap-vocab-start-quiz')?.addEventListener('click', startQuiz);
	loadWords();
})();
