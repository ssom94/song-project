(() => {
	const language = document.body.dataset.blogLanguage === 'ja' ? 'ja' : 'ko';
	const text = language === 'ja'
		? {
			loadError: 'AP学習データを読み込めませんでした。',
			start: '今日のAP学習を開始',
			login: '学習記録の更新は管理者ログイン後に利用できます。',
			noHistory: 'まだ学習履歴がありません。',
			noItems: '今日の学習を開始すると、現在の弱点・復習予定・試験までの日数から内容を自動作成します。',
			correct: '理解・正解', partial: '曖昧', wrong: '誤答', complete: '完了', score: '点数', mandatory: '必須', choice: '選択',
		}
		: {
			loadError: 'AP 학습 데이터를 불러오지 못했습니다.',
			start: '오늘의 AP 학습 시작',
			login: '학습 기록 갱신은 관리자 로그인 후 사용할 수 있습니다.',
			noHistory: '아직 학습 이력이 없습니다.',
			noItems: '오늘의 학습을 시작하면 현재 약점·복습 예정·시험까지 남은 기간을 보고 내용을 자동 구성합니다.',
			correct: '이해/정답', partial: '애매함', wrong: '오답', complete: '완료', score: '점수', mandatory: '필수', choice: '선택',
		};

	const byId = (id) => document.getElementById(id);
	const escapeHtml = (value) => String(value ?? '')
		.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
	const localTitle = (item) => language === 'ja' ? item.title_ja : item.title_ko;
	const localDescription = (item) => language === 'ja' ? item.description_ja : item.description_ko;

	function setText(id, value) {
		const element = byId(id);
		if (element) element.textContent = String(value ?? '');
	}

	function dDay(value) {
		const days = Number(value ?? 0);
		if (days === 0) return 'D-DAY';
		return days > 0 ? `D-${days}` : `D+${Math.abs(days)}`;
	}

	function stateLabel(state) {
		if (language === 'ja') return ({ mastered: '習得', learning: '学習中', uncertain: '曖昧', unlearned: '未学習' })[state] || state;
		return ({ mastered: '숙달', learning: '학습중', uncertain: '애매함', unlearned: '미학습' })[state] || state;
	}

	function resultLabel(result) {
		return ({ correct: text.correct, partial: text.partial, wrong: text.wrong, completed: text.complete })[result] || result;
	}

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

	function renderProgress(data) {
		setText('ap-dday-a', dDay(data.plan.daysUntilSubjectA));
		setText('ap-dday-b', dDay(data.plan.daysUntilSubjectB));
		setText('ap-dday-registration', dDay(data.plan.daysUntilRegistration));
		setText('ap-progress-mastered', `${data.progress.masteredTopics}/${data.progress.totalTopics}`);
		setText('ap-progress-average', `${data.progress.averageMastery}%`);
		setText('ap-progress-review', data.progress.dueReviewTopics);
		setText('ap-history-days', data.historySummary.recordedDays);
		setText('ap-history-minutes', `${data.historySummary.totalMinutes}m`);
		setText('ap-history-streak', data.historySummary.currentStreak);

		const bar = byId('ap-progress-bar-value');
		if (bar instanceof HTMLProgressElement) {
			bar.value = Math.max(0, Math.min(100, Number(data.progress.averageMastery || 0)));
			bar.textContent = `${bar.value}%`;
		}
		const topics = byId('ap-topic-progress');
		if (topics) {
			topics.innerHTML = data.topics.map((topic) => `
				<article class="ap-progress-topic ${topic.focusB ? 'is-focus' : ''}">
					<div><strong>${escapeHtml(language === 'ja' ? topic.titleJa : topic.titleKo)}</strong><span>${escapeHtml(topic.examPart)} · ${escapeHtml(stateLabel(topic.state))}</span></div>
					<progress max="100" value="${Math.max(0, Math.min(100, Number(topic.masteryScore || 0)))}">${Math.max(0, Math.min(100, Number(topic.masteryScore || 0)))}%</progress>
					<b>${topic.masteryScore}%</b>
				</article>`).join('');
		}
	}

	function renderFocus(data) {
		const container = byId('ap-focus-subjects');
		if (!container) return;
		const ordered = [...data.focusB].sort((a, b) => {
			const order = ['security', 'programming_algorithms', 'database', 'system_development', 'network'];
			return order.indexOf(a.code) - order.indexOf(b.code);
		});
		container.innerHTML = ordered.map((topic) => `
			<article class="ap-focus-item">
				<span>${escapeHtml(topic.code === 'security' ? text.mandatory : text.choice)}</span>
				<strong>${escapeHtml(language === 'ja' ? topic.titleJa : topic.titleKo)}</strong>
				<small>${escapeHtml(stateLabel(topic.state))} · ${topic.masteryScore}%</small>
			</article>`).join('');
	}

	function itemButtons(item) {
		if (item.status === 'completed') {
			const result = item.result ? resultLabel(item.result) : text.complete;
			return `<span class="ap-item-done">✓ ${escapeHtml(result)}${item.score !== null ? ` · ${item.score}` : ''}</span>`;
		}
		const test = item.item_kind === 'weekly_test' || item.item_kind === 'monthly_test';
		return `
			<div class="ap-item-result" data-item-result="${item.id}">
				<label>${escapeHtml(text.score)} <input type="number" min="0" max="100" inputmode="numeric" data-ap-score="${item.id}" /></label>
				${test
					? `<button type="button" data-ap-result="completed" data-ap-item="${item.id}">${escapeHtml(text.complete)}</button>`
					: `<button type="button" data-ap-result="correct" data-ap-item="${item.id}">${escapeHtml(text.correct)}</button>
					<button type="button" data-ap-result="partial" data-ap-item="${item.id}">${escapeHtml(text.partial)}</button>
					<button type="button" data-ap-result="wrong" data-ap-item="${item.id}">${escapeHtml(text.wrong)}</button>`}
			</div>`;
	}

	function renderToday(data) {
		setText('ap-today-reason', language === 'ja' ? data.today.reasonJa : data.today.reasonKo);
		setText('ap-today-time', `${data.today.actualMinutes}/${data.today.targetMinutes} min`);
		const start = byId('ap-start-today');
		if (start) {
			start.textContent = text.start;
			start.hidden = data.today.status !== 'not_started';
			start.disabled = !data.admin.fromSession;
			start.title = data.admin.fromSession ? '' : text.login;
		}
		const loginNote = byId('ap-login-note');
		if (loginNote) {
			loginNote.textContent = data.admin.fromSession ? '' : text.login;
			loginNote.hidden = data.admin.fromSession;
		}
		const container = byId('ap-today-items');
		if (!container) return;
		if (!data.today.items.length) {
			container.innerHTML = `<p class="ap-empty">${escapeHtml(text.noItems)}</p>`;
			return;
		}
		container.innerHTML = data.today.items.map((item) => `
			<article class="ap-today-item ${item.status === 'completed' ? 'is-completed' : ''}">
				<div class="ap-item-main"><span class="ap-item-kind">${escapeHtml(item.item_kind)}</span><strong>${escapeHtml(localTitle(item))}</strong><p>${escapeHtml(localDescription(item))}</p></div>
				<div class="ap-item-meta"><b>${item.target_minutes}m</b>${itemButtons(item)}</div>
			</article>`).join('');
		container.querySelectorAll('[data-ap-result]').forEach((button) => button.addEventListener('click', completeItem));
	}

	function renderHistory(data) {
		const body = byId('ap-history-list');
		if (!body) return;
		if (!data.history.length) {
			body.innerHTML = `<tr><td colspan="4">${escapeHtml(text.noHistory)}</td></tr>`;
			return;
		}
		body.innerHTML = data.history.map((row) => `<tr><td>${escapeHtml(row.date)}</td><td>${row.actualMinutes}/${row.targetMinutes}m</td><td>${row.completedItems}/${row.totalItems}</td><td>${row.progressPercent}%</td></tr>`).join('');
	}

	async function startToday() {
		const button = byId('ap-start-today');
		if (button) button.disabled = true;
		try {
			await requestJson('/api/admin/ap/today/start', { method: 'POST' });
			await load();
		} catch (error) {
			console.error('Failed to start AP study', error);
			if (button) button.disabled = false;
		}
	}

	async function completeItem(event) {
		const button = event.currentTarget;
		const itemId = Number(button.dataset.apItem);
		const result = button.dataset.apResult;
		const scoreInput = document.querySelector(`[data-ap-score="${itemId}"]`);
		const score = scoreInput?.value === '' ? null : Number(scoreInput?.value);
		button.disabled = true;
		try {
			await requestJson('/api/admin/ap/item/complete', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ itemId, result, score }),
			});
			await load();
		} catch (error) {
			console.error('Failed to complete AP item', error);
			button.disabled = false;
		}
	}

	async function load() {
		try {
			const data = await requestJson('/api/public/ap/dashboard');
			renderProgress(data);
			renderFocus(data);
			renderToday(data);
			renderHistory(data);
			const error = byId('ap-load-error');
			if (error) error.hidden = true;
		} catch (error) {
			console.error('Failed to load AP dashboard', error);
			const target = byId('ap-load-error');
			if (target) {
				target.textContent = text.loadError;
				target.hidden = false;
			}
		}
	}

	byId('ap-start-today')?.addEventListener('click', startToday);
	load();
})();
