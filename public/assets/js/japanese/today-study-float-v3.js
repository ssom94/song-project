(() => {
	if (document.getElementById('jp-today-study-float')) return;

	const JLPT_API = '/api/public/japanese/jlpt/dashboard';
	const AP_API = '/api/public/ap/dashboard';
	const POSITION_KEY = 'song_today_study_float_position_v3';
	const COLLAPSED_KEY = 'song_today_study_float_collapsed_v3';
	const MODE_KEY = 'song_today_study_float_mode_v3';
	const REFRESH_MS = 30000;
	const EDGE = 12;

	let card = null;
	let position = readPosition();
	let collapsed = readStorage(COLLAPSED_KEY) === '1';
	let mode = initialMode();
	let data = { jlpt: null, ap: null };
	let loading = true;
	let dragging = false;
	let dragged = false;
	let pointerId = null;
	let pointerStart = { x: 0, y: 0 };
	let positionStart = { x: 0, y: 0 };
	let baseRect = null;
	let ignoreClickUntil = 0;

	function language() {
		return document.body?.dataset?.blogLanguage === 'ja' ? 'ja' : 'ko';
	}

	function t(ko, ja) {
		return language() === 'ja' ? ja : ko;
	}

	function readStorage(key) {
		try { return localStorage.getItem(key); } catch { return null; }
	}

	function writeStorage(key, value) {
		try { localStorage.setItem(key, value); } catch { /* optional */ }
	}

	function initialMode() {
		const path = window.location.pathname;
		if (path.includes('/study/ap/')) return 'ap';
		if (path.includes('/japanese/jlpt/')) return 'jlpt';
		return readStorage(MODE_KEY) === 'ap' ? 'ap' : 'jlpt';
	}

	function readPosition() {
		try {
			const value = JSON.parse(readStorage(POSITION_KEY) || 'null');
			return value && Number.isFinite(value.x) && Number.isFinite(value.y)
				? { x: Number(value.x), y: Number(value.y) }
				: { x: 0, y: 0 };
		} catch {
			return { x: 0, y: 0 };
		}
	}

	function saveState() {
		writeStorage(POSITION_KEY, JSON.stringify(position));
		writeStorage(COLLAPSED_KEY, collapsed ? '1' : '0');
		writeStorage(MODE_KEY, mode);
	}

	function mountStyle() {
		if (document.querySelector('link[data-today-study-float]')) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '/assets/css/japanese/today-study-float.css?v=20260831-3';
		link.dataset.todayStudyFloat = 'true';
		document.head.appendChild(link);
	}

	function buildCard() {
		if (card) return card;
		mountStyle();
		card = document.createElement('aside');
		card.id = 'jp-today-study-float';
		card.className = 'jp-today-study-float';
		card.setAttribute('aria-label', t('오늘의 학습', '今日の学習'));
		document.body.appendChild(card);
		bindDrag();
		applyPosition();
		return card;
	}

	function applyPosition() {
		if (!card) return;
		card.style.setProperty('--jp-study-x', `${Math.round(position.x)}px`);
		card.style.setProperty('--jp-study-y', `${Math.round(position.y)}px`);
	}

	function measureBaseRect() {
		if (!card) return null;
		const rect = card.getBoundingClientRect();
		baseRect = {
			left: rect.left - position.x,
			right: rect.right - position.x,
			top: rect.top - position.y,
			bottom: rect.bottom - position.y,
		};
		return baseRect;
	}

	function clampPosition(next) {
		const rect = baseRect || measureBaseRect();
		if (!rect) return next;
		const minX = EDGE - rect.left;
		const maxX = window.innerWidth - EDGE - rect.right;
		const minY = EDGE - rect.top;
		const maxY = window.innerHeight - EDGE - rect.bottom;
		return {
			x: Math.min(maxX, Math.max(minX, next.x)),
			y: Math.min(maxY, Math.max(minY, next.y)),
		};
	}

	function jlptTasks(payload) {
		const targets = payload?.today?.targets || {};
		const completed = payload?.today?.completed || {};
		return [
			['복습 단어', '復習単語', completed.review, targets.review],
			['신규 N1 단어', '新規N1単語', completed.newWords, targets.newWords],
			['JLPT 어휘 문제', 'JLPT語彙問題', completed.vocabQuestions, targets.vocabQuestions],
			['N1 문법', 'N1文法', completed.grammar, targets.grammar],
			['N1 독해', 'N1読解', completed.reading, targets.reading],
		].map(([ko, ja, done, target]) => {
			const targetNumber = Number(target || 0);
			const completedNumber = Number(done || 0);
			return {
				label: t(ko, ja),
				completed: completedNumber,
				target: targetNumber,
				required: targetNumber > 0,
				done: targetNumber > 0 && completedNumber >= targetNumber,
			};
		});
	}

	function apTasks(payload) {
		const items = Array.isArray(payload?.today?.items) ? payload.today.items : [];
		return [
			['review', '복습', '復習'],
			['concept', '개념', '概念'],
			['subject_a', '科目A 문제', '科目A問題'],
			['subject_b', '科目B 문제', '科目B問題'],
			['wrong_answer', '오답 복습', '誤答復習'],
			['weekly_test', '주간 테스트', '週間テスト'],
			['monthly_test', '월간 테스트', '月間テスト'],
		].map(([kind, ko, ja]) => {
			const matched = items.filter((item) => item?.item_kind === kind);
			return {
				label: t(ko, ja),
				completed: matched.filter((item) => item?.status === 'completed').length,
				target: matched.length,
				required: matched.length > 0,
				done: matched.length > 0 && matched.every((item) => item?.status === 'completed'),
			};
		}).filter((task) => task.required);
	}

	function progressFor(currentMode) {
		const tasks = currentMode === 'ap' ? apTasks(data.ap) : jlptTasks(data.jlpt);
		const required = tasks.filter((task) => task.required);
		return { tasks, done: required.filter((task) => task.done).length, total: required.length };
	}

	function modeLink(currentMode) {
		return currentMode === 'ap' ? `/${language()}/study/ap/` : `/${language()}/japanese/jlpt/`;
	}

	function setMode(next) {
		mode = next === 'ap' ? 'ap' : 'jlpt';
		saveState();
		render();
	}

	function setCollapsed(next) {
		collapsed = Boolean(next);
		saveState();
		render();
	}

	function renderCollapsed(shell) {
		const progress = progressFor(mode);
		const button = document.createElement('button');
		button.type = 'button';
		button.className = `jp-today-study-app-icon is-${mode}`;
		button.dataset.dragHandle = 'true';
		button.setAttribute('aria-label', t('오늘의 학습 펼치기', '今日の学習を開く'));
		const mark = document.createElement('strong');
		mark.textContent = mode === 'ap' ? 'AP' : 'N1';
		const count = document.createElement('small');
		count.textContent = loading ? '…' : (progress.total ? `${progress.done}/${progress.total}` : '—');
		button.append(mark, count);
		button.addEventListener('click', () => {
			if (Date.now() >= ignoreClickUntil) setCollapsed(false);
		});
		shell.appendChild(button);
	}

	function renderExpanded(shell) {
		const current = mode === 'ap' ? data.ap : data.jlpt;
		const progress = progressFor(mode);

		const header = document.createElement('div');
		header.className = 'jp-today-study-float-header';
		header.dataset.dragHandle = 'true';
		const heading = document.createElement('div');
		const title = document.createElement('strong');
		title.textContent = t('오늘의 학습', '今日の学習');
		const subtitle = document.createElement('small');
		subtitle.textContent = loading
			? t('학습 정보를 불러오는 중…', '学習情報を読み込み中…')
			: t('드래그해서 이동 · 진도 자동 반영', 'ドラッグ移動 · 進捗を自動反映');
		heading.append(title, subtitle);

		const actions = document.createElement('div');
		actions.className = 'jp-today-study-float-header-actions';
		const badge = document.createElement('span');
		badge.className = 'jp-today-study-float-progress';
		badge.textContent = loading ? '…' : `${progress.done} / ${progress.total}`;
		const collapseButton = document.createElement('button');
		collapseButton.type = 'button';
		collapseButton.className = 'jp-today-study-collapse';
		collapseButton.textContent = '−';
		collapseButton.setAttribute('aria-label', t('접기', '折りたたむ'));
		collapseButton.addEventListener('pointerdown', (event) => event.stopPropagation());
		collapseButton.addEventListener('click', () => setCollapsed(true));
		actions.append(badge, collapseButton);
		header.append(heading, actions);

		const tabs = document.createElement('div');
		tabs.className = 'jp-today-study-tabs';
		for (const value of ['jlpt', 'ap']) {
			const tab = document.createElement('button');
			tab.type = 'button';
			tab.className = value === mode ? 'is-active' : '';
			tab.textContent = value === 'ap' ? 'AP' : 'JLPT N1';
			tab.addEventListener('click', () => setMode(value));
			tabs.appendChild(tab);
		}

		const body = document.createElement('div');
		body.className = 'jp-today-study-float-body';
		if (loading) {
			const loadingNode = document.createElement('div');
			loadingNode.className = 'jp-today-study-float-empty';
			loadingNode.textContent = t('학습 정보를 불러오는 중입니다.', '学習情報を読み込んでいます。');
			body.appendChild(loadingNode);
		} else if (!current) {
			const error = document.createElement('div');
			error.className = 'jp-today-study-float-error';
			error.textContent = t('학습 정보를 불러오지 못했습니다.', '学習情報を読み込めませんでした。');
			body.appendChild(error);
		} else if (mode === 'ap' && progress.tasks.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'jp-today-study-float-empty';
			empty.textContent = t('오늘 AP 학습 일정이 아직 생성되지 않았습니다.', '今日のAP学習予定はまだ作成されていません。');
			body.appendChild(empty);
		} else {
			const list = document.createElement('ul');
			list.className = 'jp-today-study-float-list';
			for (const task of progress.tasks) {
				const row = document.createElement('li');
				row.className = `jp-today-study-float-item${task.done ? ' is-completed' : ''}${task.required ? '' : ' is-not-required'}`;
				const checkbox = document.createElement('input');
				checkbox.type = 'checkbox';
				checkbox.checked = task.done;
				checkbox.disabled = true;
				const main = document.createElement('span');
				main.className = 'jp-today-study-float-item-main';
				const label = document.createElement('b');
				label.textContent = task.label;
				main.appendChild(label);
				const count = document.createElement('span');
				count.className = 'jp-today-study-float-count';
				count.textContent = task.required ? `${task.completed} / ${task.target}` : '—';
				row.append(checkbox, main, count);
				list.appendChild(row);
			}
			body.appendChild(list);
		}

		const footer = document.createElement('div');
		footer.className = 'jp-today-study-float-footer';
		const status = document.createElement('span');
		status.textContent = loading
			? t('불러오는 중', '読み込み中')
			: `${mode === 'ap' ? 'AP' : 'JLPT'} ${progress.done}/${progress.total}`;
		const link = document.createElement('a');
		link.href = modeLink(mode);
		link.textContent = t('학습 화면 →', '学習画面 →');
		footer.append(status, link);
		shell.append(header, tabs, body, footer);
	}

	function render() {
		const shell = buildCard();
		shell.replaceChildren();
		shell.classList.toggle('is-collapsed', collapsed);
		shell.dataset.mode = mode;
		if (collapsed) renderCollapsed(shell);
		else renderExpanded(shell);
		baseRect = null;
		requestAnimationFrame(() => {
			measureBaseRect();
			position = clampPosition(position);
			applyPosition();
		});
	}

	async function fetchDashboard(url) {
		const controller = new AbortController();
		const timeout = window.setTimeout(() => controller.abort(), 6000);
		try {
			const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
			const payload = await response.json().catch(() => null);
			return response.ok && payload?.ok ? payload : null;
		} catch {
			return null;
		} finally {
			window.clearTimeout(timeout);
		}
	}

	async function refresh() {
		const [jlpt, ap] = await Promise.all([fetchDashboard(JLPT_API), fetchDashboard(AP_API)]);
		data = { jlpt, ap };
		loading = false;
		render();
	}

	function bindDrag() {
		if (!card) return;
		card.addEventListener('pointerdown', (event) => {
			if (event.button !== 0) return;
			const handle = event.target instanceof Element ? event.target.closest('[data-drag-handle]') : null;
			if (!handle || event.target instanceof Element && event.target.closest('.jp-today-study-collapse')) return;
			dragging = true;
			dragged = false;
			pointerId = event.pointerId;
			pointerStart = { x: event.clientX, y: event.clientY };
			positionStart = { ...position };
			measureBaseRect();
			card.classList.add('is-dragging');
			card.setPointerCapture?.(event.pointerId);
		});
		card.addEventListener('pointermove', (event) => {
			if (!dragging || event.pointerId !== pointerId) return;
			const dx = event.clientX - pointerStart.x;
			const dy = event.clientY - pointerStart.y;
			if (Math.abs(dx) + Math.abs(dy) > 5) dragged = true;
			position = clampPosition({ x: positionStart.x + dx, y: positionStart.y + dy });
			applyPosition();
		});
		const finish = (event) => {
			if (!dragging || event.pointerId !== pointerId) return;
			dragging = false;
			card.classList.remove('is-dragging');
			if (dragged) ignoreClickUntil = Date.now() + 250;
			try { card.releasePointerCapture?.(event.pointerId); } catch { /* optional */ }
			pointerId = null;
			saveState();
		};
		card.addEventListener('pointerup', finish);
		card.addEventListener('pointercancel', finish);
	}

	window.addEventListener('resize', () => {
		if (!card) return;
		baseRect = null;
		measureBaseRect();
		position = clampPosition(position);
		applyPosition();
		saveState();
	});

	buildCard();
	render();
	refresh();
	const timer = window.setInterval(refresh, REFRESH_MS);
	window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
})();
