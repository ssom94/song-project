(() => {
	const body = document.body;
	const lang = body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
	const page = body.dataset.apMockPage || 'list';
	const t = (ko, ja) => lang === 'ko' ? ko : ja;

	function qs(id) { return document.getElementById(id); }
	function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
	async function fetchJson(url, options) {
		const response = await fetch(url, { credentials: 'same-origin', ...options });
		const data = await response.json().catch(() => ({}));
		if (!response.ok || !data.ok) throw new Error(data.error || `HTTP_${response.status}`);
		return data;
	}
	function subjectFromUrl() {
		const value = new URLSearchParams(location.search).get('subject');
		return value === 'B' ? 'B' : 'A';
	}
	function examNoFromUrl() {
		const n = Number(new URLSearchParams(location.search).get('no'));
		return Number.isInteger(n) && n > 0 ? n : 1;
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
	function scoreText(exam) {
		if (exam.state !== 'completed' || !exam.attempt || exam.attempt.score == null) return '-';
		return `${exam.attempt.score} / ${exam.attempt.maxScore ?? exam.totalScore}`;
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
					<td class="ap-mock-score">${esc(scoreText(exam))}</td>
					<td>${esc(exam.attempt?.submittedAt ? exam.attempt.submittedAt.slice(0,10) : '-')}</td>
					<td>${esc(`${exam.loadedQuestionCount} / ${exam.questionCountTarget}`)}</td>
					<td>${disabled ? `<span class="ap-mock-button" aria-disabled="true">${esc(actionLabel(exam))}</span>` : `<a class="ap-mock-button" href="${detailUrl}">${esc(actionLabel(exam))}</a>`}</td>
				</tr>`;
			}).join('');
			const note = qs('ap-mock-login-note');
			if (note) {
				note.hidden = Boolean(data.viewer?.authenticated);
				note.textContent = t('응시 기록과 점수는 관리자 로그인 후 표시됩니다.', '受験履歴と点数は管理者ログイン後に表示されます。');
			}
		} catch (e) {
			tbody.innerHTML = '';
			if (error) { error.hidden = false; error.textContent = `${t('모의고사 목록을 불러오지 못했습니다.', '模擬試験一覧を読み込めませんでした。')} (${e.message})`; }
		}
	}

	function activateTab(subject) {
		document.querySelectorAll('[data-ap-mock-subject]').forEach((el) => {
			el.classList.toggle('is-active', el.dataset.apMockSubject === subject);
		});
	}

	async function renderDetail() {
		const subject = subjectFromUrl();
		const no = examNoFromUrl();
		const root = qs('ap-mock-detail');
		const title = qs('ap-mock-detail-title');
		const error = qs('ap-mock-error');
		if (!root) return;
		try {
			const data = await fetchJson(`/api/public/ap/mock-exams/detail?subject=${subject}&no=${no}`);
			const exam = data.exam;
			if (title) title.textContent = t(exam.titleKo, exam.titleJa);
			const meta = qs('ap-mock-detail-meta');
			if (meta) meta.innerHTML = `
				<div><span>${esc(t('제한시간','制限時間'))}</span><strong>${exam.durationMinutes} min</strong></div>
				<div><span>${esc(t('출제 문제','出題数'))}</span><strong>${exam.questionCountTarget}</strong></div>
				<div><span>${esc(t('답변 문제','解答数'))}</span><strong>${exam.answerCountTarget}</strong></div>
				<div><span>${esc(t('합격 기준','合格基準'))}</span><strong>${exam.passingScore} / ${exam.totalScore}</strong></div>`;

			if (!exam.ready) {
				root.innerHTML = `<div class="ap-mock-detail-card"><h2>${esc(t('문제 준비 중', '問題準備中'))}</h2><p>${esc(t(`현재 ${exam.loadedQuestionCount}/${exam.questionCountTarget}문제가 등록되어 있습니다. 페이지와 응시 구조를 먼저 완성한 뒤 실제 시험형 문제를 검증하여 순차 등록합니다.`, `現在 ${exam.loadedQuestionCount}/${exam.questionCountTarget} 問が登録されています。画面と受験構造を先に完成させた後，実試験形式の問題を検証して順次登録します。`))}</p></div>`;
				return;
			}
			if (!data.viewer?.authenticated) {
				root.innerHTML = `<div class="ap-mock-detail-card"><h2>${esc(t('로그인이 필요합니다.', 'ログインが必要です。'))}</h2><p>${esc(t('모의고사 응시와 결과 저장은 관리자 로그인 후 사용할 수 있습니다.', '模擬試験の受験と結果保存は管理者ログイン後に利用できます。'))}</p></div>`;
				return;
			}
			if (!exam.attempt) {
				root.innerHTML = `<div class="ap-mock-detail-card"><h2>${esc(t('시험 안내', '試験案内'))}</h2><p>${esc(t('실제 시험과 동일한 제한시간과 문제수 기준으로 진행합니다. 시작 후 진행상태가 저장됩니다.', '実試験と同じ制限時間・問題数を基準に実施します。開始後は進捗が保存されます。'))}</p><button id="ap-mock-start" class="ap-mock-button" type="button">${esc(t('시험 시작', '試験開始'))}</button></div>`;
				qs('ap-mock-start')?.addEventListener('click', () => startExam(subject, no));
				return;
			}
			const completed = exam.state === 'completed';
			const header = completed
				? `<div class="ap-mock-detail-card"><h2>${esc(t('채점 결과', '採点結果'))}</h2><p class="ap-mock-score">${esc(scoreText(exam))}</p><p>${esc(exam.attempt.score >= exam.passingScore ? t('합격 기준 이상', '合格基準以上') : t('합격 기준 미달', '合格基準未満'))}</p></div>`
				: `<div class="ap-mock-detail-card"><h2>${esc(t('진행 중', '実施中'))}</h2><p>${esc(t('문제를 풀고 최종 제출하면 이 페이지에서 점수·정답·해설을 확인할 수 있습니다.', '解答後に最終提出すると，このページで点数・正答・解説を確認できます。'))}</p></div>`;
			const questions = (data.questions || []).map((q) => {
				const options = (lang === 'ko' ? q.choicesKo : q.choicesJa) || [];
				const optionHtml = options.map((opt, i) => `<div class="ap-mock-option">${i + 1}. ${esc(opt)}</div>`).join('');
				const result = completed ? `<div class="ap-mock-result"><b>${esc(t('내 답안', '自分の解答'))}:</b> ${esc(q.selectedChoice == null ? q.answerText || '-' : String(q.selectedChoice + 1))}<br><b>${esc(t('정답/모범답안', '正答・模範解答'))}:</b> ${esc(q.correctChoice == null ? (t(q.modelAnswerKo, q.modelAnswerJa) || '-') : String(q.correctChoice + 1))}<br><b>${esc(t('해설', '解説'))}:</b> ${esc(t(q.explanationKo, q.explanationJa) || '-')}</div>` : '';
				return `<article class="ap-mock-question"><h3>${q.questionNo}. ${esc(t(q.promptKo, q.promptJa))}</h3><div class="ap-mock-options">${optionHtml}</div>${result}</article>`;
			}).join('');
			root.innerHTML = `${header}<div class="ap-mock-detail-card">${questions || `<p>${esc(t('문제 데이터를 불러올 수 없습니다.', '問題データを読み込めません。'))}</p>`}</div>`;
		} catch (e) {
			if (error) { error.hidden = false; error.textContent = `${t('모의고사를 불러오지 못했습니다.', '模擬試験を読み込めませんでした。')} (${e.message})`; }
		}
	}

	async function startExam(subject, examNo) {
		const button = qs('ap-mock-start');
		if (button) button.disabled = true;
		try {
			await fetchJson('/api/admin/ap/mock-exams/start', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ subject, examNo }),
			});
			location.reload();
		} catch (e) {
			alert(`${t('시험을 시작하지 못했습니다.', '試験を開始できませんでした。')} (${e.message})`);
			if (button) button.disabled = false;
		}
	}

	if (page === 'list') {
		let subject = subjectFromUrl();
		activateTab(subject);
		document.querySelectorAll('[data-ap-mock-subject]').forEach((tab) => tab.addEventListener('click', () => {
			subject = tab.dataset.apMockSubject === 'B' ? 'B' : 'A';
			const url = new URL(location.href); url.searchParams.set('subject', subject); history.replaceState({}, '', url);
			activateTab(subject); renderList(subject);
		}));
		renderList(subject);
	} else {
		renderDetail();
	}
})();
