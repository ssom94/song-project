(() => {
	const body = document.body;
	const lang = body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
	const page = body.dataset.apMockPage || 'list';
	const t = (ko, ja) => lang === 'ko' ? ko : ja;
	const saveTimers = new Map();
	let countdownTimer = null;
	let timeoutSubmitting = false;

	function qs(id) { return document.getElementById(id); }
	function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
	function paragraph(value) { return esc(value).replace(/\n/g, '<br>'); }
	async function fetchJson(url, options) {
		const response = await fetch(url, { credentials: 'same-origin', ...options });
		const data = await response.json().catch(() => ({}));
		if (!response.ok || !data.ok) {
			const error = new Error(data.error || `HTTP_${response.status}`);
			error.data = data;
			throw error;
		}
		return data;
	}
	function subjectFromUrl() {
		return new URLSearchParams(location.search).get('subject') === 'B' ? 'B' : 'A';
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
		if (exam.state !== 'completed' || !exam.attempt || exam.attempt.score == null) return exam.attempt?.status === 'submitted' ? t('채점 중', '採点中') : '-';
		return `${exam.attempt.score} / ${exam.attempt.maxScore ?? exam.totalScore}`;
	}
	function formatTime(seconds) {
		const safe = Math.max(0, Number(seconds) || 0);
		const h = Math.floor(safe / 3600);
		const m = Math.floor((safe % 3600) / 60);
		const s = safe % 60;
		return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
	}
	function conceptLink(code) {
		return code ? `/${lang}/study/ap/concepts/detail/?code=${encodeURIComponent(code)}` : '';
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
		document.querySelectorAll('[data-ap-mock-subject]').forEach((el) => el.classList.toggle('is-active', el.dataset.apMockSubject === subject));
	}

	function structuredContentHtml(q) {
		const c = q.content;
		if (!c || typeof c !== 'object') return '';
		const passage = lang === 'ko' ? (c.passageKo || c.passage_ko) : (c.passageJa || c.passage_ja);
		const logs = Array.isArray(c.logs) ? c.logs : [];
		const tables = Array.isArray(c.tables) ? c.tables : [];
		let html = passage ? `<div class="ap-mock-passage">${paragraph(passage)}</div>` : '';
		for (const log of logs) html += `<pre class="ap-mock-log">${esc(typeof log === 'string' ? log : JSON.stringify(log, null, 2))}</pre>`;
		for (const table of tables) {
			const headers = Array.isArray(table?.headers) ? table.headers : [];
			const rows = Array.isArray(table?.rows) ? table.rows : [];
			html += `<div class="ap-mock-table-wrap"><table class="ap-mock-table ap-mock-data-table"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${(Array.isArray(r) ? r : []).map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
		}
		return html;
	}

	function answerSummary(q) {
		if (q.selectedChoice != null) return String(q.selectedChoice + 1);
		if (q.answerJson && typeof q.answerJson === 'object') return Object.values(q.answerJson).map((v) => cleanText(v)).filter(Boolean).join(' / ') || '-';
		return q.answerText || '-';
	}
	function cleanText(value) { return String(value ?? '').trim(); }

	function resultHtml(q, subject, examNo) {
		const model = q.correctChoice == null ? (t(q.modelAnswerKo, q.modelAnswerJa) || '-') : String(q.correctChoice + 1);
		const concept = q.sourceConceptCode ? `<br><a class="ap-mock-concept-link" href="${conceptLink(q.sourceConceptCode)}">${esc(t('관련 개념', '関連概念'))}: ${esc(q.sourceConceptCode)}</a>` : '';
		const grade = subject === 'B' && (q.answerText || q.answerJson)
			? `<div class="ap-mock-self-grade"><label>${esc(t('이 문제 취득점수', 'この問題の得点'))} <input class="ap-mock-grade-input" type="number" min="0" max="${esc(q.maxScore)}" step="0.01" value="${q.awardedScore == null ? '' : esc(q.awardedScore)}" data-question-id="${q.id}"> / ${esc(q.maxScore)}</label><button class="ap-mock-button ap-mock-grade-button" type="button" data-question-id="${q.id}">${esc(t('점수 저장', '得点を保存'))}</button></div>`
			: '';
		return `<div class="ap-mock-result"><b>${esc(t('내 답안', '自分の解答'))}:</b> ${esc(answerSummary(q))}<br><b>${esc(t('정답/모범답안', '正答・模範解答'))}:</b> ${esc(model)}<br><b>${esc(t('해설', '解説'))}:</b> ${paragraph(t(q.explanationKo, q.explanationJa) || '-')}${concept}${grade}</div>`;
	}

	function renderChoiceQuestion(q, subject, completed) {
		const options = (lang === 'ko' ? q.choicesKo : q.choicesJa) || [];
		const optionsHtml = options.map((opt, i) => completed
			? `<div class="ap-mock-option${q.correctChoice === i ? ' is-correct' : ''}${q.selectedChoice === i && q.correctChoice !== i ? ' is-wrong' : ''}">${i + 1}. ${esc(opt)}</div>`
			: `<label class="ap-mock-option ap-mock-choice"><input type="radio" name="mock-q-${q.id}" value="${i}" data-question-id="${q.id}"${q.selectedChoice === i ? ' checked' : ''}> <span>${i + 1}. ${esc(opt)}</span></label>`).join('');
		return `<article class="ap-mock-question" id="mock-question-${q.questionNo}"><h3>${q.questionNo}. ${esc(t(q.promptKo, q.promptJa))}</h3>${structuredContentHtml(q)}<div class="ap-mock-options">${optionsHtml}</div><p class="ap-mock-save-state" id="ap-mock-save-${q.id}"></p>${completed ? resultHtml(q, subject) : ''}</article>`;
	}

	function renderWrittenQuestion(q, subject, completed) {
		const c = q.content && typeof q.content === 'object' ? q.content : {};
		const subquestions = Array.isArray(c.subquestions) ? c.subquestions : [];
		let answerHtml = '';
		if (!completed && subquestions.length) {
			answerHtml = subquestions.map((sub, i) => {
				const key = String(sub.key || `q${i + 1}`);
				const prompt = lang === 'ko' ? (sub.promptKo || sub.prompt_ko || '') : (sub.promptJa || sub.prompt_ja || '');
				const value = q.answerJson?.[key] ?? '';
				return `<label class="ap-mock-written-sub"><b>${esc(prompt || `${i + 1}`)}</b><textarea data-question-id="${q.id}" data-answer-key="${esc(key)}" rows="3">${esc(value)}</textarea></label>`;
			}).join('');
		} else if (!completed) {
			answerHtml = `<textarea class="ap-mock-written-answer" data-question-id="${q.id}" rows="6" placeholder="${esc(t('답안을 입력하세요.', '答案を入力してください。'))}">${esc(q.answerText || '')}</textarea>`;
		}
		return `<article class="ap-mock-question" id="mock-question-${q.questionNo}"><h3>${q.questionNo}. ${q.mandatory ? `<span class="ap-mock-required">${esc(t('필수', '必須'))}</span> ` : ''}${esc(t(q.promptKo, q.promptJa))}</h3>${structuredContentHtml(q)}${answerHtml}<p class="ap-mock-save-state" id="ap-mock-save-${q.id}"></p>${completed ? resultHtml(q, subject) : ''}</article>`;
	}

	function setSaveState(questionId, text, failed = false) {
		const el = qs(`ap-mock-save-${questionId}`);
		if (!el) return;
		el.textContent = text;
		el.classList.toggle('is-error', failed);
	}

	async function saveAnswer(subject, examNo, payload) {
		setSaveState(payload.questionId, t('저장 중...', '保存中...'));
		try {
			const data = await fetchJson('/api/admin/ap/mock-exams/answer', {
				method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject, examNo, ...payload }),
			});
			setSaveState(payload.questionId, t('저장됨', '保存済み'));
			const count = qs('ap-mock-answered-count');
			if (count) count.textContent = String(data.answeredCount ?? 0);
			return data;
		} catch (e) {
			const messages = {
				SUBJECT_B_SELECTION_LIMIT: t('科目B는 최대 5문제만 선택할 수 있습니다.', '科目Bは最大5問まで選択できます。'),
				EXAM_TIME_EXPIRED: t('제한시간이 종료되었습니다.', '制限時間が終了しました。'),
			};
			setSaveState(payload.questionId, messages[e.message] || `${t('저장 실패', '保存失敗')}: ${e.message}`, true);
			throw e;
		}
	}

	function scheduleWrittenSave(subject, examNo, question, textarea) {
		const old = saveTimers.get(question.id);
		if (old) clearTimeout(old);
		const timer = setTimeout(() => {
			const c = question.content && typeof question.content === 'object' ? question.content : {};
			const subs = Array.isArray(c.subquestions) ? c.subquestions : [];
			if (subs.length) {
				const answerJson = {};
				document.querySelectorAll(`textarea[data-question-id="${question.id}"][data-answer-key]`).forEach((el) => { answerJson[el.dataset.answerKey] = el.value; });
				saveAnswer(subject, examNo, { questionId: question.id, answerJson }).catch(() => {});
			} else {
				saveAnswer(subject, examNo, { questionId: question.id, answerText: textarea.value }).catch(() => {});
			}
		}, 500);
		saveTimers.set(question.id, timer);
	}

	function bindAnswerEvents(data) {
		const subject = data.exam.subject;
		const examNo = data.exam.examNo;
		for (const q of data.questions || []) {
			if (q.type === 'choice4') {
				document.querySelectorAll(`input[name="mock-q-${q.id}"]`).forEach((input) => input.addEventListener('change', () => {
					saveAnswer(subject, examNo, { questionId: q.id, selectedChoice: Number(input.value) }).catch(() => {});
				}));
			} else {
				document.querySelectorAll(`textarea[data-question-id="${q.id}"]`).forEach((textarea) => textarea.addEventListener('input', () => scheduleWrittenSave(subject, examNo, q, textarea)));
			}
		}
		qs('ap-mock-submit')?.addEventListener('click', () => submitExam(subject, examNo, false));
	}

	function startCountdown(data) {
		if (countdownTimer) clearInterval(countdownTimer);
		let remaining = Number(data.exam.remainingSeconds ?? 0);
		const target = qs('ap-mock-countdown');
		const update = () => {
			if (target) target.textContent = formatTime(remaining);
			if (remaining <= 0) {
				if (countdownTimer) clearInterval(countdownTimer);
				if (!timeoutSubmitting) {
					timeoutSubmitting = true;
					submitExam(data.exam.subject, data.exam.examNo, true);
				}
				return;
			}
			remaining -= 1;
		};
		update();
		countdownTimer = setInterval(update, 1000);
	}

	async function submitExam(subject, examNo, force) {
		const button = qs('ap-mock-submit');
		if (!force && !confirm(t('답안을 최종 제출할까요? 제출 후 수정할 수 없습니다.', '答案を最終提出しますか？提出後は変更できません。'))) return;
		if (button) button.disabled = true;
		try {
			await Promise.all([...saveTimers.values()].map(() => Promise.resolve()));
			await fetchJson('/api/admin/ap/mock-exams/submit', {
				method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject, examNo, force }),
			});
			location.reload();
		} catch (e) {
			const messages = {
				ANSWER_ALL_REQUIRED: t('科目A는 80문제 전부 답한 뒤 제출할 수 있습니다.', '科目Aは80問全て解答してから提出してください。'),
				SUBJECT_B_EXACTLY_FIVE_REQUIRED: t('科目B는 정확히 5문제를 선택해 답해야 합니다.', '科目Bは5問を選択して解答してください。'),
				SUBJECT_B_MANDATORY_REQUIRED: t('科目B의 필수 정보보안 문제를 반드시 답해야 합니다.', '科目Bの必須情報セキュリティ問題を必ず解答してください。'),
			};
			alert(messages[e.message] || `${t('제출 실패', '提出失敗')}: ${e.message}`);
			if (button) button.disabled = false;
			timeoutSubmitting = false;
		}
	}

	async function saveWrittenGrade(subject, examNo, questionId) {
		const input = document.querySelector(`.ap-mock-grade-input[data-question-id="${questionId}"]`);
		if (!(input instanceof HTMLInputElement)) return;
		const button = document.querySelector(`.ap-mock-grade-button[data-question-id="${questionId}"]`);
		if (button instanceof HTMLButtonElement) button.disabled = true;
		try {
			await fetchJson('/api/admin/ap/mock-exams/grade-written', {
				method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject, examNo, questionId, awardedScore: Number(input.value) }),
			});
			location.reload();
		} catch (e) {
			alert(`${t('점수 저장 실패', '得点保存失敗')}: ${e.message}`);
			if (button instanceof HTMLButtonElement) button.disabled = false;
		}
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
			if (meta) meta.innerHTML = `<div><span>${esc(t('제한시간','制限時間'))}</span><strong>${exam.durationMinutes} min</strong></div><div><span>${esc(t('출제 문제','出題数'))}</span><strong>${exam.questionCountTarget}</strong></div><div><span>${esc(t('답변 문제','解答数'))}</span><strong>${exam.answerCountTarget}</strong></div><div><span>${esc(t('합격 기준','合格基準'))}</span><strong>${exam.passingScore} / ${exam.totalScore}</strong></div>`;

			if (!exam.ready) {
				root.innerHTML = `<div class="ap-mock-detail-card"><h2>${esc(t('문제 준비 중', '問題準備中'))}</h2><p>${esc(t(`현재 ${exam.loadedQuestionCount}/${exam.questionCountTarget}문제가 등록되어 있습니다. 실제 시험형 문제를 중복 검증한 뒤 회차를 활성화합니다.`, `現在 ${exam.loadedQuestionCount}/${exam.questionCountTarget} 問が登録されています。実試験形式の問題を重複検証した後に回次を有効化します。`))}</p></div>`;
				return;
			}
			if (!data.viewer?.authenticated) {
				root.innerHTML = `<div class="ap-mock-detail-card"><h2>${esc(t('로그인이 필요합니다.', 'ログインが必要です。'))}</h2><p>${esc(t('모의고사 응시와 결과 저장은 관리자 로그인 후 사용할 수 있습니다.', '模擬試験の受験と結果保存は管理者ログイン後に利用できます。'))}</p></div>`;
				return;
			}
			if (!exam.attempt) {
				root.innerHTML = `<div class="ap-mock-detail-card"><h2>${esc(t('시험 안내', '試験案内'))}</h2><p>${esc(t('실제 시험과 동일한 제한시간과 문제수 기준으로 진행합니다. 시작 시점은 서버에 저장되며 재접속해도 남은 시간이 이어집니다.', '実試験と同じ制限時間・問題数で実施します。開始時刻はサーバに保存され，再接続しても残り時間を引き継ぎます。'))}</p><button id="ap-mock-start" class="ap-mock-button" type="button">${esc(t('시험 시작', '試験開始'))}</button></div>`;
				qs('ap-mock-start')?.addEventListener('click', () => startExam(subject, no));
				return;
			}

			const completed = exam.state === 'completed';
			let header;
			if (completed) {
				const score = exam.attempt.score == null ? t('科目B 답안을 확인하고 문제별 점수를 입력하세요.', '科目Bの答案を確認し，問題ごとの得点を入力してください。') : scoreText(exam);
				const verdict = exam.attempt.status === 'graded' && exam.attempt.score != null ? (exam.attempt.score >= exam.passingScore ? t('합격 기준 이상', '合格基準以上') : t('합격 기준 미달', '合格基準未満')) : t('부분점수 채점 중', '部分点採点中');
				header = `<div class="ap-mock-detail-card"><h2>${esc(t('채점 결과', '採点結果'))}</h2><p class="ap-mock-score">${esc(score)}</p><p>${esc(verdict)}</p></div>`;
			} else {
				header = `<div class="ap-mock-exam-toolbar"><div><span>${esc(t('남은 시간', '残り時間'))}</span><strong id="ap-mock-countdown">${formatTime(exam.remainingSeconds)}</strong></div><div><span>${esc(t('답변 완료', '解答済み'))}</span><strong><span id="ap-mock-answered-count">${exam.attempt.answeredCount || 0}</span> / ${exam.answerCountTarget}</strong></div><button id="ap-mock-submit" class="ap-mock-button" type="button">${esc(t('최종 제출', '最終提出'))}</button></div>`;
			}
			const questions = (data.questions || []).map((q) => q.type === 'choice4' ? renderChoiceQuestion(q, subject, completed) : renderWrittenQuestion(q, subject, completed)).join('');
			root.innerHTML = `${header}<div class="ap-mock-detail-card">${questions || `<p>${esc(t('문제 데이터를 불러올 수 없습니다.', '問題データを読み込めません。'))}</p>`}</div>`;
			if (!completed) {
				bindAnswerEvents(data);
				startCountdown(data);
			} else if (subject === 'B') {
				document.querySelectorAll('.ap-mock-grade-button').forEach((button) => button.addEventListener('click', () => saveWrittenGrade(subject, no, Number(button.dataset.questionId))));
			}
		} catch (e) {
			if (error) { error.hidden = false; error.textContent = `${t('모의고사를 불러오지 못했습니다.', '模擬試験を読み込めませんでした。')} (${e.message})`; }
		}
	}

	async function startExam(subject, examNo) {
		const button = qs('ap-mock-start');
		if (button) button.disabled = true;
		try {
			await fetchJson('/api/admin/ap/mock-exams/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject, examNo }) });
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
	} else renderDetail();
})();
