(() => {
	const API = '/api/public/japanese/jlpt/dashboard';
	const STORAGE_KEY = 'song_jlpt_today_float_position_v1';
	const REFRESH_MS = 30000;
	const DESKTOP_MIN = 841;
	const EDGE = 12;

	let card = null;
	let position = readPosition();
	let dragging = false;
	let pointerId = null;
	let pointerStart = { x: 0, y: 0 };
	let positionStart = { x: 0, y: 0 };
	let baseRect = null;
	let refreshTimer = 0;

	function language() {
		return document.body.dataset.blogLanguage === 'ja' ? 'ja' : 'ko';
	}

	function t(ko, ja) {
		return language() === 'ja' ? ja : ko;
	}

	function readPosition() {
		try {
			const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
			if (!parsed || !Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return { x: 0, y: 0 };
			return { x: Number(parsed.x), y: Number(parsed.y) };
		} catch {
			return { x: 0, y: 0 };
		}
	}

	function savePosition() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
		} catch {
			// The widget still works for the current page when storage is unavailable.
		}
	}

	function mountStyle() {
		if (document.querySelector('link[data-jp-today-study-float]')) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '/assets/css/japanese/today-study-float.css';
		link.dataset.jpTodayStudyFloat = 'true';
		document.head.appendChild(link);
	}

	function applyPosition() {
		if (!card) return;
		if (window.innerWidth < DESKTOP_MIN) {
			card.style.removeProperty('--jp-study-x');
			card.style.removeProperty('--jp-study-y');
			return;
		}
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

	function bounds() {
		const rect = baseRect || measureBaseRect();
		if (!rect) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
		return {
			minX: EDGE - rect.left,
			maxX: window.innerWidth - EDGE - rect.right,
			minY: EDGE - rect.top,
			maxY: window.innerHeight - EDGE - rect.bottom,
		};
	}

	function clamp(next) {
		const limit = bounds();
		return {
			x: Math.min(limit.maxX, Math.max(limit.minX, next.x)),
			y: Math.min(limit.maxY, Math.max(limit.minY, next.y)),
		};
	}

	function createShell() {
		if (card) return card;
		card = document.createElement('aside');
		card.id = 'jp-today-study-float';
		card.className = 'jp-today-study-float';
		card.setAttribute('aria-label', t('오늘의 JLPT 학습', '今日のJLPT学習'));
		document.body.appendChild(card);
		applyPosition();
		bindDrag();
		return card;
	}

	function taskDone(completed, target, studyStarted) {
		if (!studyStarted) return false;
		const goal = Number(target ?? 0);
		return goal <= 0 || Number(completed ?? 0) >= goal;
	}

	function taskRows(data) {
		const targets = data?.today?.targets || {};
		const completed = data?.today?.completed || {};
		const started = Boolean(data?.plan?.studyStarted);
		return [
			{ key: 'review', label: t('복습 단어', '復習単語'), detail: t('복습 예정 어휘', '復習予定語彙'), completed: completed.review, target: targets.review, done: taskDone(completed.review, targets.review, started) },
			{ key: 'newWords', label: t('신규 N1 단어', '新規N1単語'), detail: t('오늘 신규 어휘', '今日の新規語彙'), completed: completed.newWords, target: targets.newWords, done: taskDone(completed.newWords, targets.newWords, started) },
			{ key: 'vocabQuestions', label: t('JLPT 어휘 문제', 'JLPT語彙問題'), detail: t('읽기·문맥·유의어·용법', '読み・文脈・言い換え・用法'), completed: completed.vocabQuestions, target: targets.vocabQuestions, done: taskDone(completed.vocabQuestions, targets.vocabQuestions, started) },
			{ key: 'grammar', label: t('N1 문법', 'N1文法'), detail: t('문법 학습 및 문제', '文法学習・問題'), completed: completed.grammar, target: targets.grammar, done: taskDone(completed.grammar, targets.grammar, started) },
			{ key: 'reading', label: t('N1 독해', 'N1読解'), detail: t('오늘의 독해 지문', '今日の読解'), completed: completed.reading, target: targets.reading, done: taskDone(completed.reading, targets.reading, started) },
		];
	}

	function render(data) {
		const shell = createShell();
		shell.replaceChildren();
		const tasks = taskRows(data);
		const doneCount = tasks.filter((task) => task.done).length;
		const studyStarted = Boolean(data?.plan?.studyStarted);

		const header = document.createElement('div');
		header.className = 'jp-today-study-float-header';
		header.dataset.dragHandle = 'true';
		const heading = document.createElement('div');
		const title = document.createElement('strong');
		title.textContent = t('오늘의 JLPT N1', '今日のJLPT N1');
		const subtitle = document.createElement('small');
		subtitle.textContent = studyStarted
			? t('드래그해서 위치 이동 · 실제 진도 자동 반영', 'ドラッグ移動 · 実際の進捗を自動反映')
			: t(`${data?.plan?.studyStartDate || '2026-09-01'}부터 시작`, `${data?.plan?.studyStartDate || '2026-09-01'}から開始`);
		heading.append(title, subtitle);
		const progress = document.createElement('span');
		progress.className = 'jp-today-study-float-progress';
		progress.textContent = `${doneCount} / ${tasks.length}`;
		header.append(heading, progress);

		const body = document.createElement('div');
		body.className = 'jp-today-study-float-body';
		const list = document.createElement('ul');
		list.className = 'jp-today-study-float-list';
		for (const task of tasks) {
			const item = document.createElement('li');
			item.className = `jp-today-study-float-item${task.done ? ' is-completed' : ''}`;
			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.checked = task.done;
			checkbox.disabled = true;
			checkbox.setAttribute('aria-label', task.label);
			const main = document.createElement('span');
			main.className = 'jp-today-study-float-item-main';
			const label = document.createElement('b');
			label.textContent = task.label;
			const detail = document.createElement('small');
			detail.textContent = task.detail;
			main.append(label, detail);
			const count = document.createElement('span');
			count.className = 'jp-today-study-float-count';
			count.textContent = `${Number(task.completed ?? 0)} / ${Number(task.target ?? 0)}`;
			item.append(checkbox, main, count);
			list.appendChild(item);
		}
		body.appendChild(list);

		const footer = document.createElement('div');
		footer.className = 'jp-today-study-float-footer';
		const status = document.createElement('span');
		status.textContent = studyStarted
			? t(`오늘 일정 ${doneCount}/${tasks.length} 완료`, `今日の予定 ${doneCount}/${tasks.length} 完了`)
			: t('학습 시작 전', '学習開始前');
		const link = document.createElement('a');
		link.href = `/${language()}/japanese/jlpt/`;
		link.textContent = t('학습 화면 →', '学習画面 →');
		footer.append(status, link);

		shell.append(header, body, footer);
		baseRect = null;
		requestAnimationFrame(() => {
			if (window.innerWidth >= DESKTOP_MIN) {
				measureBaseRect();
				position = clamp(position);
				applyPosition();
			}
		});
	}

	function renderError() {
		const shell = createShell();
		shell.replaceChildren();
		const header = document.createElement('div');
		header.className = 'jp-today-study-float-header';
		header.dataset.dragHandle = 'true';
		const title = document.createElement('strong');
		title.textContent = t('오늘의 JLPT N1', '今日のJLPT N1');
		header.appendChild(title);
		const error = document.createElement('div');
		error.className = 'jp-today-study-float-error';
		error.textContent = t('오늘 학습 정보를 불러오지 못했습니다.', '今日の学習情報を読み込めませんでした。');
		shell.append(header, error);
	}

	async function refresh() {
		try {
			const response = await fetch(API, { cache: 'no-store', credentials: 'same-origin' });
			const data = await response.json().catch(() => null);
			if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP_${response.status}`);
			render(data);
		} catch (error) {
			console.warn('Failed to load floating JLPT checklist', error);
			renderError();
		}
	}

	function bindDrag() {
		if (!card) return;
		card.addEventListener('pointerdown', (event) => {
			if (window.innerWidth < DESKTOP_MIN || event.button !== 0) return;
			const handle = event.target instanceof Element ? event.target.closest('[data-drag-handle]') : null;
			if (!handle) return;
			dragging = true;
			pointerId = event.pointerId;
			pointerStart = { x: event.clientX, y: event.clientY };
			positionStart = { ...position };
			measureBaseRect();
			card.classList.add('is-dragging');
			card.setPointerCapture?.(pointerId);
			event.preventDefault();
		});

		card.addEventListener('pointermove', (event) => {
			if (!dragging || event.pointerId !== pointerId) return;
			position = clamp({
				x: positionStart.x + event.clientX - pointerStart.x,
				y: positionStart.y + event.clientY - pointerStart.y,
			});
			applyPosition();
		});

		function finish(event) {
			if (!dragging || event.pointerId !== pointerId) return;
			dragging = false;
			card.classList.remove('is-dragging');
			card.releasePointerCapture?.(pointerId);
			pointerId = null;
			savePosition();
		}

		card.addEventListener('pointerup', finish);
		card.addEventListener('pointercancel', finish);
		card.addEventListener('dblclick', (event) => {
			const handle = event.target instanceof Element ? event.target.closest('[data-drag-handle]') : null;
			if (!handle || window.innerWidth < DESKTOP_MIN) return;
			position = { x: 0, y: 0 };
			baseRect = null;
			applyPosition();
			savePosition();
		});
	}

	function initialize() {
		mountStyle();
		refresh();
		refreshTimer = window.setInterval(refresh, REFRESH_MS);
		document.addEventListener('visibilitychange', () => {
			if (!document.hidden) refresh();
		});
		window.addEventListener('resize', () => {
			if (!card) return;
			if (window.innerWidth < DESKTOP_MIN) {
				applyPosition();
				return;
			}
			baseRect = null;
			applyPosition();
			requestAnimationFrame(() => {
				measureBaseRect();
				position = clamp(position);
				applyPosition();
			});
		});
		window.addEventListener('pagehide', () => window.clearInterval(refreshTimer), { once: true });
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();