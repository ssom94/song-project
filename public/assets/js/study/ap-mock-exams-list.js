(() => {
	const body = document.body;
	const lang = body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
	const t = (ko, ja) => lang === 'ko' ? ko : ja;
	const MOCK_DATA_BASE = 'https://raw.githubusercontent.com/ssom94/song-project/main/data/ap/mock-exams/';
	let analysisLoaded = false;

	function qs(id) { return document.getElementById(id); }
	function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
	function jstDateText(value) {
		if (!value) return '-';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '-';
		const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
		const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
		return `${values.year}-${values.month}-${values.day}`;
	}
	async function fetchJson(url) {
		const options = String(url).startsWith('http') ? {} : { credentials: 'same-origin' };
		const response = await fetch(url, options);
		const data = await response.json().catch(() => ({}));
		if (!response.ok || data.ok === false) throw new Error(data.error || `HTTP_${response.status}`);
		return data;
	}
	function subjectFromUrl() { return new URLSearchParams(location.search).get('subject') === 'B' ? 'B' : 'A'; }
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
		if (exam.state === 'in_progress') return t(`${total} / ${answered}문제 풀이 중`, `${total} / ${answered}問解答済み`);
		if (attempt.score == null) return t(`${total} / ${answered}문제 답변 (채점 중)`, `${total} / ${answered}問解答（採点中）`);
		const score = trimNumber(attempt.score);
		if (exam.subject === 'A') {
			const pointPerQuestion = Number(exam.totalScore || 100) / Math.max(1, total);
			const correct = Math.max(0, Math.min(total, Math.round(Number(attempt.score) / pointPerQuestion)));
			return t(`${total} / ${correct}정답 (${score}점)`, `${total} / ${correct}問正解（${score}点）`);
		}
		return t(`${total} / ${answered}문제 채점 (${score}점)`, `${total} / ${answered}問採点（${score}点）`);
	}
	function activateTab(subject) { document.querySelectorAll('[data-ap-mock-subject]').forEach((el) => el.classList.toggle('is-active', el.dataset.apMockSubject === subject)); }
	async function renderList(subject) {
		const tbody = qs('ap-mock-list');
		const error = qs('ap-mock-error');
		if (!tbody) return;
		tbody.innerHTML = `<tr><td colspan="6">${esc(t('불러오는 중...', '読み込み中...'))}</td></tr>`;
		if (error) error.hidden = true;
		try {
			const data = await fetchJson(`/api/public/ap/mock-exams?subject=${subject}`);
			if (!data.exams?.length) { tbody.innerHTML = `<tr><td colspan="6">${esc(t('등록된 모의고사가 없습니다.', '登録された模擬試験はありません。'))}</td></tr>`; return; }
			tbody.innerHTML = data.exams.map((exam) => {
				const statusClass = exam.state === 'completed' ? ' is-completed' : exam.state === 'in_progress' ? ' is-progress' : '';
				const detailUrl = `/${lang}/study/ap/mock-exams/exam/?subject=${exam.subject}&no=${exam.examNo}`;
				const disabled = exam.actionMode === 'preparing';
				const attemptDate = jstDateText(exam.attempt?.startedAt);
				return `<tr><td><strong>${esc(t(exam.titleKo, exam.titleJa))}</strong></td><td><span class="ap-mock-status${statusClass}">${esc(stateLabel(exam))}</span></td><td class="ap-mock-score">${esc(progressResultText(exam))}</td><td>${esc(attemptDate)}</td><td>${esc(`${exam.loadedQuestionCount} / ${exam.questionCountTarget}`)}</td><td>${disabled ? `<span class="ap-mock-button" aria-disabled="true">${esc(actionLabel(exam))}</span>` : `<a class="ap-mock-button" href="${detailUrl}">${esc(actionLabel(exam))}</a>`}</td></tr>`;
			}).join('');
			const note = qs('ap-mock-login-note');
			if (note) { note.hidden = Boolean(data.viewer?.authenticated); note.textContent = t('응시 기록·진행률·점수는 관리자 로그인 후 표시됩니다.', '受験履歴・進捗・点数は管理者ログイン後に表示されます。'); }
		} catch (e) {
			tbody.innerHTML = '';
			if (error) { error.hidden = false; error.textContent = `${t('모의고사 목록을 불러오지 못했습니다.', '模擬試験一覧を読み込めませんでした。')} (${e.message})`; }
		}
	}
	function pastStatusLabel(status) {
		if (status === 'viewer-ready') return t('IPA 원문 풀이 가능', 'IPA原文で解答可能');
		if (status === 'ready') return t('문제 준비 완료', '問題準備完了');
		return t('공식 PDF 반영 대기', '公式PDF取込待ち');
	}
	function pastQuestionText(meta) {
		if (!meta) return '-';
		if (Number(meta.answerCount) !== Number(meta.questionCount)) return t(`${meta.questionCount}문제 / ${meta.answerCount}문제 선택`, `${meta.questionCount}問 / ${meta.answerCount}問選択`);
		return t(`${meta.questionCount}문제`, `${meta.questionCount}問`);
	}
	async function renderPastExams(subject) {
		const tbody = qs('ap-past-exam-list');
		const error = qs('ap-past-error');
		if (!tbody) return;
		tbody.innerHTML = `<tr><td colspan="5">${esc(t('불러오는 중...', '読み込み中...'))}</td></tr>`;
		if (error) error.hidden = true;
		try {
			const data = await fetchJson('/assets/data/ap-past-exams.json');
			const sessions = Array.isArray(data.sessions) ? data.sessions : [];
			if (!sessions.length) { tbody.innerHTML = `<tr><td colspan="5">${esc(t('등록된 실제 기출이 없습니다.', '登録された過去問はありません。'))}</td></tr>`; return; }
			tbody.innerHTML = sessions.map((session) => {
				const meta = session.subjects?.[subject];
				const title = t(session.titleKo, session.titleJa);
				const subjectLabel = meta ? t(meta.displayLabelKo, meta.displayLabelJa) : '-';
				const canOpen = ['viewer-ready', 'ready'].includes(meta?.status) && Boolean(meta?.questionPdfUrl);
				const statusClass = canOpen ? ' is-completed' : ' is-pending-source';
				const viewerUrl = `/${lang}/study/ap/past-exams/exam/?session=${encodeURIComponent(session.key)}&subject=${subject}`;
				return `<tr><td><strong>${esc(title)}</strong><span class="ap-past-date">${esc(session.administeredAt)}</span></td><td>${esc(subjectLabel)}</td><td>${esc(pastQuestionText(meta))}</td><td><span class="ap-mock-status${statusClass}">${esc(pastStatusLabel(meta?.status))}</span></td><td><div class="ap-past-actions">${canOpen ? `<a class="ap-mock-button" href="${viewerUrl}">${esc(t('실제 문제 풀기', '過去問を解く'))}</a>` : ''}<a class="ap-past-source" href="${esc(session.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(t('IPA 출처', 'IPA出典'))}</a></div></td></tr>`;
			}).join('');
		} catch (e) {
			tbody.innerHTML = '';
			if (error) { error.hidden = false; error.textContent = `${t('실제 기출 목록을 불러오지 못했습니다.', '過去問一覧を読み込めませんでした。')} (${e.message})`; }
		}
	}

	function avg(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
	function countBy(items, getter) {
		const result = {};
		for (const item of items) {
			const key = getter(item);
			if (key == null || key === '') continue;
			result[key] = (result[key] || 0) + 1;
		}
		return result;
	}
	function topEntries(map, limit = 8) { return Object.entries(map).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, limit); }
	function analysisSection() {
		let section = qs('ap-mock-past-analysis');
		if (section) return section;
		const past = document.querySelector('.ap-past-section');
		if (!past?.parentElement) return null;
		section = document.createElement('section');
		section.id = 'ap-mock-past-analysis';
		section.className = 'ap-mock-section';
		past.parentElement.insertBefore(section, past);
		return section;
	}
	function analysisLoading() {
		const section = analysisSection();
		if (!section) return;
		section.hidden = false;
		section.innerHTML = `<div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">MOCK vs 2025 AUTUMN</p><h2>${esc(t('2025 가을 실제기출 비교', '2025年秋期 過去問比較'))}</h2></div><p>${esc(t('科目A 모의고사 1~7회 · 총 560문항', '科目A 模擬試験1〜7回・全560問'))}</p></div><section class="ap-mock-card"><p class="ap-mock-note">${esc(t('비교 데이터를 불러오는 중...', '比較データを読み込み中...'))}</p></section>`;
	}
	function comparisonTable(actualSections, mockAverage) {
		const labels = { T: t('테크놀로지', 'テクノロジ'), M: t('매니지먼트', 'マネジメント'), S: t('스트래티지', 'ストラテジ') };
		return `<div class="ap-mock-table-wrap"><table class="ap-mock-table"><thead><tr><th>${esc(t('영역', '分野'))}</th><th>${esc(t('2025 가을', '2025年秋期'))}</th><th>${esc(t('모의고사 평균', '模擬試験平均'))}</th><th>${esc(t('차이', '差'))}</th></tr></thead><tbody>${['T','M','S'].map((code) => { const actual = actualSections[code] || 0; const mock = mockAverage[code] || 0; const delta = Math.round((mock - actual) * 10) / 10; return `<tr><td><strong>${esc(`${code} · ${labels[code]}`)}</strong></td><td>${actual}</td><td>${mock.toFixed(1)}</td><td>${delta > 0 ? '+' : ''}${delta.toFixed(1)}</td></tr>`; }).join('')}</tbody></table></div>`;
	}
	async function renderAnalysis(subject) {
		const section = analysisSection();
		if (!section) return;
		if (subject !== 'A') { section.hidden = true; return; }
		section.hidden = false;
		if (analysisLoaded) return;
		analysisLoading();
		try {
			const manifest = await fetchJson(`${MOCK_DATA_BASE}manifest.json`);
			const rounds = (manifest.rounds || []).filter((round) => round.subject === 'A' && round.examNo >= 1 && round.examNo <= 7);
			const mockFiles = rounds.flatMap((round) => (round.files || []).map((file) => `${MOCK_DATA_BASE}${file}`));
			const [actualData, ...mockParts] = await Promise.all([fetchJson('/assets/data/ap-past-study/2025-autumn-A.json'), ...mockFiles.map((file) => fetchJson(file))]);
			const actual = Array.isArray(actualData.questions) ? actualData.questions : [];
			const mockQuestions = mockParts.flatMap((part) => Array.isArray(part.questions) ? part.questions : []);
			if (actual.length !== 80 || mockQuestions.length !== 560) throw new Error(`QUESTION_COUNT_${actual.length}_${mockQuestions.length}`);
			const actualSections = countBy(actual, (q) => q.sectionCode);
			const mockSections = countBy(mockQuestions, (q) => q.sectionCode);
			const mockAverage = Object.fromEntries(['T','M','S'].map((code) => [code, (mockSections[code] || 0) / 7]));
			const actualDifficulty = avg(actual.map((q) => Number(q.difficulty)).filter(Number.isFinite));
			const mockDifficulty = avg(mockQuestions.map((q) => Number(q.difficulty)).filter(Number.isFinite));
			const actualDifficultyCounts = countBy(actual, (q) => Number(q.difficulty) || '-');
			const mockDifficultyCounts = countBy(mockQuestions, (q) => Number(q.difficulty) || '-');
			const patternCounts = countBy(actual.flatMap((q) => Array.isArray(q.patterns) ? q.patterns : []), (value) => value);
			const conceptCounts = countBy(mockQuestions, (q) => q.sourceConceptCode);
			const roundDifficulties = rounds.map((round) => {
				const questions = mockParts.filter((part) => Number(part.examNo) === Number(round.examNo)).flatMap((part) => part.questions || []);
				return [round.examNo, avg(questions.map((q) => Number(q.difficulty)).filter(Number.isFinite))];
			});
			const labels = { T: t('테크놀로지', 'テクノロジ'), M: t('매니지먼트', 'マネジメント'), S: t('스트래티지', 'ストラテジ') };
			const underCovered = ['T','M','S'].filter((code) => mockAverage[code] + 0.5 < (actualSections[code] || 0));
			const note = underCovered.length ? t(`실제 기출 대비 평균 문항 수가 적은 영역: ${underCovered.map((code) => `${code} ${labels[code]}`).join(', ')}.`, `実際の過去問より平均問題数が少ない分野: ${underCovered.map((code) => `${code} ${labels[code]}`).join(', ')}。`) : t('영역별 문항 수는 2025 가을 실제기출과 큰 차이가 없습니다.', '分野別の問題数は2025年秋期の過去問と大きな差はありません。');
			const patterns = topEntries(patternCounts, 8);
			const concepts = topEntries(conceptCounts, 8);
			section.innerHTML = `<div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">MOCK vs 2025 AUTUMN</p><h2>${esc(t('2025 가을 실제기출 비교', '2025年秋期 過去問比較'))}</h2></div><p>${esc(t('科目A 모의고사 1~7회 · 총 560문항', '科目A 模擬試験1〜7回・全560問'))}</p></div>
			<section class="ap-mock-card"><p class="ap-past-guide">${esc(t('GitHub의 정적 문제 데이터만 사용해 비교합니다. D1 행 조회는 발생하지 않습니다.', 'GitHub上の静的問題データだけで比較するため、D1の行読取は発生しません。'))}</p>${comparisonTable(actualSections, mockAverage)}</section>
			<section class="ap-mock-card"><div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">DIFFICULTY</p><h3>${esc(t('난이도 비교', '難易度比較'))}</h3></div></div><p class="ap-past-guide"><strong>${esc(t('2025 가을 평균', '2025年秋期平均'))}: ${actualDifficulty.toFixed(2)} / 5</strong> · <strong>${esc(t('모의고사 1~7 평균', '模擬試験1〜7平均'))}: ${mockDifficulty.toFixed(2)} / 5</strong></p><div class="ap-mock-table-wrap"><table class="ap-mock-table"><thead><tr><th>${esc(t('회차', '回'))}</th><th>${esc(t('평균 난이도', '平均難易度'))}</th><th>${esc(t('실제기출 대비', '過去問との差'))}</th></tr></thead><tbody>${roundDifficulties.map(([no, value]) => `<tr><td>${no}</td><td>${value.toFixed(2)}</td><td>${value - actualDifficulty >= 0 ? '+' : ''}${(value - actualDifficulty).toFixed(2)}</td></tr>`).join('')}</tbody></table></div><p class="ap-mock-note">${esc(t(`난이도 분포(1~5) · 실제기출: ${[1,2,3,4,5].map((n) => `${n}:${actualDifficultyCounts[n] || 0}`).join(' / ')} · 모의고사 전체: ${[1,2,3,4,5].map((n) => `${n}:${mockDifficultyCounts[n] || 0}`).join(' / ')}`, `難易度分布(1〜5)・過去問: ${[1,2,3,4,5].map((n) => `${n}:${actualDifficultyCounts[n] || 0}`).join(' / ')}・模擬試験全体: ${[1,2,3,4,5].map((n) => `${n}:${mockDifficultyCounts[n] || 0}`).join(' / ')}`)}</p></section>
			<section class="ap-mock-card"><div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">QUESTION PROFILE</p><h3>${esc(t('출제 유형·개념 분포', '出題タイプ・概念分布'))}</h3></div></div><p class="ap-past-guide">${esc(t('실제기출은 보유한 pattern 태그, 모의고사는 sourceConceptCode를 집계합니다. 서로 다른 분류체계이므로 직접 비율 비교가 아니라 보강 판단용입니다.', '過去問はpatternタグ、模擬試験はsourceConceptCodeを集計します。分類体系が異なるため、直接の比率比較ではなく補強判断用です。'))}</p><div class="ap-mock-table-wrap"><table class="ap-mock-table"><thead><tr><th>${esc(t('2025 가을 주요 유형', '2025年秋期 主なタイプ'))}</th><th>${esc(t('태그 수', 'タグ数'))}</th><th>${esc(t('모의고사 주요 개념코드', '模擬試験 主な概念コード'))}</th><th>${esc(t('문항 수', '問題数'))}</th></tr></thead><tbody>${Array.from({length: 8}, (_, index) => { const p = patterns[index] || ['-',0]; const c = concepts[index] || ['-',0]; return `<tr><td>${esc(p[0])}</td><td>${p[1]}</td><td>${esc(c[0])}</td><td>${c[1]}</td></tr>`; }).join('')}</tbody></table></div><p class="ap-mock-note"><strong>${esc(t('판정', '判定'))}:</strong> ${esc(note)}</p></section>`;
			analysisLoaded = true;
		} catch (error) {
			console.error('AP_MOCK_PAST_ANALYSIS_FAILED', error);
			section.innerHTML = `<div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">MOCK vs 2025 AUTUMN</p><h2>${esc(t('2025 가을 실제기출 비교', '2025年秋期 過去問比較'))}</h2></div></div><p class="ap-mock-error">${esc(t('비교 데이터를 불러오지 못했습니다.', '比較データを読み込めませんでした。'))} (${esc(error.message)})</p>`;
		}
	}
	function renderSubject(subject) {
		activateTab(subject);
		renderList(subject);
		renderPastExams(subject);
		renderAnalysis(subject);
	}

	let subject = subjectFromUrl();
	renderSubject(subject);
	document.querySelectorAll('[data-ap-mock-subject]').forEach((tab) => tab.addEventListener('click', () => {
		subject = tab.dataset.apMockSubject === 'B' ? 'B' : 'A';
		const url = new URL(location.href);
		url.searchParams.set('subject', subject);
		history.replaceState({}, '', url);
		renderSubject(subject);
	}));
})();
