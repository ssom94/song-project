(() => {
	const body = document.body;
	const lang = body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
	const t = (ko, ja) => lang === 'ko' ? ko : ja;

	function qs(id) { return document.getElementById(id); }
	function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
	async function fetchJson(url) {
		const response = await fetch(url, { credentials: 'same-origin' });
		const data = await response.json().catch(() => ({}));
		if (!response.ok || !data.ok) throw new Error(data.error || `HTTP_${response.status}`);
		return data;
	}
	function subjectFromUrl() {
		return new URLSearchParams(location.search).get('subject') === 'B' ? 'B' : 'A';
	}
	function stateLabel(exam) {
		if (exam.state === 'completed') return t('실시완료', '実施済み');
		if (exam.state === 'in_progress') return t('진행 중', '実施中');
		return t('미실시', '未実施');
	}
	function actionLabel(exam) {
		if (exam.actionMode === 'result') return t('결과·해설 보기', '結果・解説を見る');
		if (exam.actionMode === 'resume') return t('계속 풀기', '続きから');
		if (exam.actionMode === 'start') return t('모의고사 보기', '模擬試験を見る');
		return t('문제 준비 중', '問題準備中');
	}
	function trimNumber(value) {
		const n = Number(value);
		if (!Number.isFinite(n)) return '-';
		return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
	}
	function progressResultText(exam) {
		const total = Number(exam.questionCountTarget || 0);
		const attempt = exam.attempt;
		if (!attempt) return `${total} / - (-)`;
		const answered = Number(attempt.answeredCount || 0);
		if (exam.state === 'in_progress') {
			return t(`${total} / ${answered}문제 풀이 중`, `${total} / ${answered}問解答済み`);
		}
		if (attempt.score == null) {
			return t(`${total} / ${answered}문제 답변 (채점 중)`, `${total} / ${answered}問解答（採点中）`);
		}
		const score = trimNumber(attempt.score);
		if (exam.subject === 'A') {
			const pointPerQuestion = Number(exam.totalScore || 100) / Math.max(1, total);
			const correct = Math.max(0, Math.min(total, Math.round(Number(attempt.score) / pointPerQuestion)));
			return t(`${total} / ${correct}정답 (${score}점)`, `${total} / ${correct}問正解（${score}点）`);
		}
		return t(`${total} / ${answered}문제 채점 (${score}점)`, `${total} / ${answered}問採点（${score}点）`);
	}
	function activateTab(subject) {
		document.querySelectorAll('[data-ap-mock-subject]').forEach((el) => el.classList.toggle('is-active', el.dataset.apMockSubject === subject));
	}
	async function renderList(subject) {
		const tbody = qs('ap-mock-list');
		const error = qs('ap-mock-error');
		if (!tbody) return;
		tbody.innerHTML = `<tr><td colspan="6">${esc(t('불러오는 중...', '読み込み中...'))}</td></tr>`;
		if (error) error.hidden = true;
		try {
			const data = await fetchJson(`/api/public/ap/mock-exams?subject=${subject}`);
			if (!data.exams?.length) {
				tbody.innerHTML = `<tr><td colspan="6">${esc(t('등록된 모의고사가 없습니다.', '登録された模擬試験はありません。'))}</td></tr>`;
				return;
			}
			tbody.innerHTML = data.exams.map((exam) => {
				const statusClass = exam.state === 'completed' ? ' is-completed' : exam.state === 'in_progress' ? ' is-progress' : '';
				const detailUrl = `/${lang}/study/ap/mock-exams/exam/?subject=${exam.subject}&no=${exam.examNo}`;
				const disabled = exam.actionMode === 'preparing';
				return `<tr>
					<td><strong>${esc(t(exam.titleKo, exam.titleJa))}</strong></td>
					<td><span class="ap-mock-status${statusClass}">${esc(stateLabel(exam))}</span></td>
					<td class="ap-mock-score">${esc(progressResultText(exam))}</td>
					<td>${esc(exam.attempt?.submittedAt ? exam.attempt.submittedAt.slice(0,10) : exam.attempt?.startedAt ? exam.attempt.startedAt.slice(0,10) : '-')}</td>
					<td>${esc(`${exam.loadedQuestionCount} / ${exam.questionCountTarget}`)}</td>
					<td>${disabled ? `<span class="ap-mock-button" aria-disabled="true">${esc(actionLabel(exam))}</span>` : `<a class="ap-mock-button" href="${detailUrl}">${esc(actionLabel(exam))}</a>`}</td>
				</tr>`;
			}).join('');
			const note = qs('ap-mock-login-note');
			if (note) {
				note.hidden = Boolean(data.viewer?.authenticated);
				note.textContent = t('응시 기록·진행률·점수는 관리자 로그인 후 표시됩니다.', '受験履歴・進捗・点数は管理者ログイン後に表示されます。');
			}
		} catch (e) {
			tbody.innerHTML = '';
			if (error) { error.hidden = false; error.textContent = `${t('모의고사 목록을 불러오지 못했습니다.', '模擬試験一覧を読み込めませんでした。')} (${e.message})`; }
		}
	}

	let subject = subjectFromUrl();
	activateTab(subject);
	document.querySelectorAll('[data-ap-mock-subject]').forEach((tab) => tab.addEventListener('click', () => {
		subject = tab.dataset.apMockSubject === 'B' ? 'B' : 'A';
		const url = new URL(location.href);
		url.searchParams.set('subject', subject);
		history.replaceState({}, '', url);
		activateTab(subject);
		renderList(subject);
	}));
	renderList(subject);
})();
