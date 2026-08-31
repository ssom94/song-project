(() => {
	const root = document.documentElement;
	if (root.dataset.todayStudyFloatLoaded === 'true') return;
	root.dataset.todayStudyFloatLoaded = 'true';

	const JLPT_API = '/api/public/japanese/jlpt/dashboard';
	const AP_API = '/api/public/ap/dashboard';
	const POSITION_KEY = 'song_today_study_float_position_v2';
	const COLLAPSED_KEY = 'song_today_study_float_collapsed_v2';
	const MODE_KEY = 'song_today_study_float_mode_v2';
	const REFRESH_MS = 30000;
	const EDGE = 12;

	let card = null;
	let position = readPosition();
	let collapsed = localStorage.getItem(COLLAPSED_KEY) === '1';
	let mode = readMode();
	let data = { jlpt: null, ap: null };
	let dragging = false;
	let dragged = false;
	let pointerId = null;
	let pointerStart = { x: 0, y: 0 };
	let positionStart = { x: 0, y: 0 };
	let baseRect = null;
	let timer = 0;
	let ignoreClickUntil = 0;

	function language() {
		return document.body.dataset.blogLanguage === 'ja' ? 'ja' : 'ko';
	}

	function t(ko, ja) {
		return language() === 'ja' ? ja : ko;
	}

	function readMode() {
		const path = window.location.pathname;
		if (path.includes('/study/ap/')) return 'ap';
		if (path.includes('/japanese/jlpt/')) return 'jlpt';
		return localStorage.getItem(MODE_KEY) === 'ap' ? 'ap' : 'jlpt';
	}

	function saveState() {
		try {
			localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
			localStorage.setItem(MODE_KEY, mode);
		} catch { /* optional */ }
	}

	function ensureJapaneseStudyMenu() {
		const sidebar = document.querySelector('.blog-dashboard-sidebar');
		if (!(sidebar instanceof HTMLElement)) return;
		const lang = language();
		const homeHref = `/${lang}/japanese/`;
		const items = [
			{ href: homeHref, ko: '학습 홈', ja: '学習ホーム' },
			{ href: `/${lang}/japanese/jlpt/`, ko: 'JLPT N1 학습', ja: 'JLPT N1 学習' },
			{ href: `/${lang}/japanese/words/`, ko: '단어 목록', ja: '単語一覧' },
			{ href: `/${lang}/japanese/quiz/`, ko: '랜덤 퀴즈', ja: 'ランダムクイズ' },
			{ href: `/${lang}/japanese/quiz/result/`, ko: '학습 결과', ja: '学習結果' },
		];
		let section = [...sidebar.querySelectorAll('.blog-sidebar-section')].find((candidate) => {
			const nav = candidate.querySelector('.blog-sidebar-nav');
			return nav && [...nav.querySelectorAll('a')].some((link) => (link.getAttribute('href') || '').includes('/japanese/'));
		});
		if (!(section instanceof HTMLElement)) return;
		const nav = section.querySelector('.blog-sidebar-nav');
		if (!(nav instanceof HTMLElement)) return;
		const currentPath = window.location.pathname;
		nav.replaceChildren();
		for (const item of items) {
			const link = document.createElement('a');
			link.className = 'blog-sidebar-link';
			link.href = item.href;
			link.textContent = lang === 'ja' ? item.ja : item.ko;
			const active = item.href === homeHref ? currentPath === homeHref : currentPath.startsWith(item.href);
			if (active) {
				link.classList.add('is-active');
				link.setAttribute('aria-current', 'page');
			}
			nav.appendChild(link);
		}
	}

	function readPosition() {
		try {
			const parsed = JSON.parse(localStorage.getItem(POSITION_KEY) || 'null');
			if (!parsed || !Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return { x: 0, y: 0 };
			return { x: Number(parsed.x), y: Number(parsed.y) };
		} catch {
			return { x: 0, y: 0 };
		}
	}

	function savePosition() {
		try { localStorage.setItem(POSITION_KEY, JSON.stringify(position)); } catch { /* optional */ }
	}

	function mountStyle() {
		if (document.querySelector('link[data-today-study-float]')) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '/assets/css/japanese/today-study-float.css';
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
		applyPosition();
		bindDrag();
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

	function dragBounds() {
		const rect = baseRect || measureBaseRect();
		if (!rect) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
		return {
			minX: EDGE - rect.left,
			maxX: window.innerWidth - EDGE - rect.right,
			minY: EDGE - rect.top,
			maxY: window.innerHeight - EDGE - rect.bottom,
		};
	}

	function clampPosition(next) {
		const bounds = dragBounds();
		return {
			x: Math.min(bounds.maxX, Math.max(bounds.minX, next.x)),
			y: Math.min(bounds.maxY, Math.max(bounds.minY, next.y)),
		};
	}

	function hasTask(target) {
		return Number(target ?? 0) > 0;
	}

	function jlptTasks(payload) {
		const targets = payload?.today?.targets || {};
		const completed = payload?.today?.completed || {};
		const started = Boolean(payload?.plan?.studyStarted);
		const make = (labelKo, labelJa, completedValue, targetValue) => ({
			label: t(labelKo, labelJa), completed: Number(completedValue ?? 0), target: Number(targetValue ?? 0),
			required: hasTask(targetValue), done: started && hasTask(targetValue) && Number(completedValue ?? 0) >= Number(targetValue ?? 0),
		});
		return [
			make('복습 단어', '復習単語', completed.review, targets.review),
			make('신규 N1 단어', '新規N1単語', completed.newWords, targets.newWords),
			make('JLPT 어휘 문제', 'JLPT語彙問題', completed.vocabQuestions, targets.vocabQuestions),
			make('N1 문법', 'N1文法', completed.grammar, targets.grammar),
			make('N1 독해', 'N1読解', completed.reading, targets.reading),
		];
	}

	function apTasks(payload) {
		const items = Array.isArray(payload?.today?.items) ? payload.today.items : [];
		const definitions = [
			['review', '복습', '復習'],
			['concept', '개념', '概念'],
			['subject_a', '科目A 문제', '科目A問題'],
			['subject_b', '科目B 문제', '科目B問題'],
			['wrong_answer', '오답 복습', '誤答復習'],
			['weekly_test', '주간 테스트', '週間テスト'],
			['monthly_test', '월간 테스트', '月間テスト'],
		];
		return definitions.map(([kind, ko, ja]) => {
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
		return {
			tasks,
			done: required.filter((task) => task.done).length,
			total: required.length,
		};
	}

	function modeLink(currentMode) {
		return currentMode === 'ap' ? `/${language()}/study/ap/` : `/${language()}/japanese/jlpt/`;
	}

	function setMode(nextMode) {
		mode = nextMode === 'ap' ? 'ap' : 'jlpt';
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
		count.textContent = progress.total ? `${progress.done}/${progress.total}` : '—';
		button.append(mark, count);
		button.addEventListener('click', () => {
			if (Date.now() < ignoreClickUntil) return;
			setCollapsed(false);
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
		subtitle.textContent = t('드래그해서 이동 · 진도 자동 반영', 'ドラッグ移動 · 進捗を自動反映');
		heading.append(title, subtitle);
		const headerActions = document.createElement('div');
		headerActions.className = 'jp-today-study-float-header-actions';
		const progressBadge = document.createElement('span');
		progressBadge.className = 'jp-today-study-float-progress';
		progressBadge.textContent = `${progress.done} / ${progress.total}`;
		const collapseButton = document.createElement('button');
		collapseButton.type = 'button';
		collapseButton.className = 'jp-today-study-collapse';
		collapseButton.textContent = '−';
		collapseButton.setAttribute('aria-label', t('접기', '折りたたむ'));
		collapseButton.addEventListener('pointerdown', (event) => event.stopPropagation());
		collapseButton.addEventListener('click', () => setCollapsed(true));
		headerActions.append(progressBadge, collapseButton);
		header.append(heading, headerActions);

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
		if (!current) {
			const unavailable = document.createElement('div');
			unavailable.className = 'jp-today-study-float-error';
			unavailable.textContent = t('학습 정보를 불러오지 못했습니다.', '学習情報を読み込めませんでした。');
			body.appendChild(unavailable);
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
				const label = document.createElement('span');
				label.className = 'jp-today-study-float-item-main';
				const bold = document.createElement('b');
				bold.textContent = task.label;
				label.appendChild(bold);
				const count = document.createElement('span');
				count.className = 'jp-today-study-float-count';
				count.textContent = task.required ? `${task.completed} / ${task.target}` : '—';
				row.append(checkbox, label, count);
				list.appendChild(row);
			}
			body.appendChild(list);
		}

		const footer = document.createElement('div');
		footer.className = 'jp-today-study-float-footer';
		const status = document.createElement('span');
		status.textContent = mode === 'ap'
			? t(`AP ${progress.done}/${progress.total} 완료`, `AP ${progress.done}/${progress.total} 完了`)
			: t(`JLPT ${progress.done}/${progress.total} 완료`, `JLPT ${progress.done}/${progress.total} 完了`);
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
		try {
			const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
			const payload = await response.json().catch(() => null);
			return response.ok && payload?.ok ? payload : null;
		} catch {
			return null;
		}
	}

	async function refresh() {
		ensureJapaneseStudyMenu();
		const [jlpt, ap] = await Promise.all([fetchDashboard(JLPT_API), fetchDashboard(AP_API)]);
		data = { jlpt, ap };
		render();
	}

	function bindDrag() {
		if (!card) return;
		card.addEventListener('pointerdown', (event) => {
			if (event.button !== 0) return;
			const handle = event.target instanceof Element ? event.target.closest('[data-drag-handle]') : null;
			if (!handle) return;
			if (event.target instanceof Element && event.target.closest('button.jp-today-study-collapse')) return;
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
			savePosition();
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
		savePosition();
	});

	refresh();
	timer = window.setInterval(refresh, REFRESH_MS);
	window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
})();
