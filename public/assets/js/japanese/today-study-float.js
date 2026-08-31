(() => {
	const root = document.documentElement;
	if (root.dataset.jlptTodayStudyLoaded === 'true') return;
	root.dataset.jlptTodayStudyLoaded = 'true';

	const API = '/api/public/japanese/jlpt/dashboard';
	const STORAGE_KEY = 'song_jlpt_today_float_position_v1';
	const REFRESH_MS = 30000;
	const EDGE = 12;

	let card = null;
	let position = readPosition();
	let dragging = false;
	let pointerId = null;
	let pointerStart = { x: 0, y: 0 };
	let positionStart = { x: 0, y: 0 };
	let baseRect = null;
	let timer = 0;

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
			// Position persistence is optional.
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

	function buildCard() {
		if (card) return card;
		mountStyle();
		card = document.createElement('aside');
		card.id = 'jp-today-study-float';
		card.className = 'jp-today-study-float';
		card.setAttribute('aria-label', t('오늘의 JLPT 학습', '今日のJLPT学習'));
		document.body.appendChild(card);
		applyPosition();
		bindDrag();
		return card;
	}

	function hasTask(target) {
		return Number(target ?? 0) > 0;
	}

	function isTaskDone(completed, target, studyStarted) {
		return studyStarted && hasTask(target) && Number(completed ?? 0) >= Number(target ?? 0);
	}

	function taskRows(data) {
		const targets = data?.today?.targets || {};
		const completed = data?.today?.completed || {};
		const started = Boolean(data?.plan?.studyStarted);
		return [
			{ label: t('복습 단어', '復習単語'), detail: t('복습 예정 어휘', '復習予定語彙'), completed: completed.review, target: targets.review, required: hasTask(targets.review), done: isTaskDone(completed.review, targets.review, started) },
			{ label: t('신규 N1 단어', '新規N1単語'), detail: t('오늘 신규 어휘', '今日の新規語彙'), completed: completed.newWords, target: targets.newWords, required: hasTask(targets.newWords), done: isTaskDone(completed.newWords, targets.newWords, started) },
			{ label: t('JLPT 어휘 문제', 'JLPT語彙問題'), detail: t('읽기·문맥·유의어·용법', '読み・文脈・言い換え・用法'), completed: completed.vocabQuestions, target: targets.vocabQuestions, required: hasTask(targets.vocabQuestions), done: isTaskDone(completed.vocabQuestions, targets.vocabQuestions, started) },
			{ label: t('N1 문법', 'N1文法'), detail: t('문법 학습 및 문제', '文法学習・問題'), completed: completed.grammar, target: targets.grammar, required: hasTask(targets.grammar), done: isTaskDone(completed.grammar, targets.grammar, started) },
			{ label: t('N1 독해', 'N1読解'), detail: t('오늘의 독해 지문', '今日の読解'), completed: completed.reading, target: targets.reading, required: hasTask(targets.reading), done: isTaskDone(completed.reading, targets.reading, started) },
		];
	}

	function render(data) {
		const shell = buildCard();
		shell.replaceChildren();
		const tasks = taskRows(data);
		const required = tasks.filter((task) => task.required);
		const doneCount = required.filter((task) => task.done).length;
		const totalCount = required.length;
		const studyStarted = Boolean(data?.plan?.studyStarted);

		const header = document.createElement('div');
		header.className = 'jp-today-study-float-header';
		header.dataset.dragHandle = 'true';
		const heading = document.createElement('div');
		const title = document.createElement('strong');
		title.textContent = t('오늘의 JLPT N1', '今日のJLPT N1');
		const subtitle = document.createElement('small');
		subtitle.textContent = studyStarted
			? t('드래그해서 이동 · 실제 학습 진도 자동 반영', 'ドラッグ移動 · 実際の学習進捗を自動反映')
			: t(`${data?.plan?.studyStartDate || '2026-09-01'}부터 시작`, `${data?.plan?.studyStartDate || '2026-09-01'}から開始`);
		heading.append(title, subtitle);
		const progress = document.createElement('span');
		progress.className = 'jp-today-study-float-progress';
		progress.textContent = `${doneCount} / ${totalCount}`;
		header.append(heading, progress);

		const body = document.createElement('div');
		body.className = 'jp-today-study-float-body';
		const list = document.createElement('ul');
		list.className = 'jp-today-study-float-list';
		for (const task of tasks) {
			const row = document.createElement('li');
			row.className = `jp-today-study-float-item${task.done ? ' is-completed' : ''}${task.required ? '' : ' is-not-required'}`;
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
			detail.textContent = task.required ? task.detail : `${task.detail} · ${t('오늘 없음', '今日はなし')}`;
			main.append(label, detail);
			const count = document.createElement('span');
			count.className = 'jp-today-study-float-count';
			count.textContent = task.required ? `${Number(task.completed ?? 0)} / ${Number(task.target ?? 0)}` : '—';
			row.append(checkbox, main, count);
			list.appendChild(row);
		}
		body.appendChild(list);

		const footer = document.createElement('div');
		footer.className = 'jp-today-study-float-footer';
		const status = document.createElement('span');
		status.textContent = studyStarted
			? t(`오늘 일정 ${doneCount}/${totalCount} 완료`, `今日の予定 ${doneCount}/${totalCount} 完了`)
			: t('학습 시작 전', '学習開始前');
		const link = document.createElement('a');
		link.href = `/${language()}/japanese/jlpt/`;
		link.textContent = t('학습 화면 →', '学習画面 →');
		footer.append(status, link);
		shell.append(header, body, footer);

		baseRect = null;
		requestAnimationFrame(() => {
			measureBaseRect();
			position = clampPosition(position);
			applyPosition();
		});
	}

	function renderError() {
		const shell = buildCard();
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
			if (event.button !== 0) return;
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
			position = clampPosition({
				x: positionStart.x + event.clientX - pointerStart.x,
				y: positionStart.y + event.clientY - pointerStart.y,
			});
			applyPosition();
		});
		const finish = (event) => {
			if (!dragging || event.pointerId !== pointerId) return;
			dragging = false;
			card.classList.remove('is-dragging');
			card.releasePointerCapture?.(pointerId);
			pointerId = null;
			savePosition();
		};
		card.addEventListener('pointerup', finish);
		card.addEventListener('pointercancel', finish);
		card.addEventListener('dblclick', (event) => {
			const handle = event.target instanceof Element ? event.target.closest('[data-drag-handle]') : null;
			if (!handle) return;
			position = { x: 0, y: 0 };
			baseRect = null;
			applyPosition();
			savePosition();
		});
	}

	function initialize() {
		mountStyle();
		refresh();
		timer = window.setInterval(refresh, REFRESH_MS);
		document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
		window.addEventListener('focus', refresh);
		window.addEventListener('jlptstudyprogresschange', refresh);
		document.querySelectorAll('[data-home-language]').forEach((button) => {
			button.addEventListener('click', () => window.setTimeout(refresh, 0));
		});
		window.addEventListener('resize', () => {
			if (!card) return;
			baseRect = null;
			requestAnimationFrame(() => {
				measureBaseRect();
				position = clampPosition(position);
				applyPosition();
				savePosition();
			});
		});
		window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
	}

	window.JlptTodayStudyFloat = { refresh };
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();