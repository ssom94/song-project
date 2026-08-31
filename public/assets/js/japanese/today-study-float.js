(() => {
	const root = document.documentElement;
	if (root.dataset.jlptTodayStudyLoaded === 'true') return;
	root.dataset.jlptTodayStudyLoaded = 'true';

	const DASHBOARD_API = '/api/public/japanese/jlpt/dashboard';
	const SESSION_API = '/api/admin/auth/session';
	const PROGRESS_API = '/api/admin/japanese/jlpt/progress';
	const POSITION_KEY = 'song_jlpt_today_floating_position';
	const COLLAPSED_KEY = 'song_jlpt_today_floating_collapsed';
	const REFRESH_MS = 30000;
	let widget = null;
	let authenticated = false;
	let dragging = null;
	let timer = 0;

	function language() {
		return document.body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
	}

	function copy() {
		return language() === 'ko'
			? {
				kicker: 'JLPT N1 · TODAY', title: '오늘의 학습', drag: '제목을 잡아 이동할 수 있습니다.',
				completed: (done, total) => `${done} / ${total} 스케줄 완료`, review: '복습 어휘', newWords: '신규 어휘',
				vocab: '어휘 문제', grammar: '문법', reading: '독해', wordHint: '단어 상태 지정 시 자동 완료',
				manualHint: '체크하여 완료 처리', publicHint: '관리자 로그인 시 완료 처리 가능', open: 'JLPT 학습 열기 →',
				startTomorrow: '학습 시작일 전입니다. 내일부터 Day 1을 시작합니다.', noPlan: '오늘 학습 정보를 불러오지 못했습니다.',
				reset: '위치 초기화', collapse: '접기', expand: '펼치기',
			}
			: {
				kicker: 'JLPT N1 · TODAY', title: '今日の学習', drag: 'タイトル部分をドラッグして移動できます。',
				completed: (done, total) => `${done} / ${total} 完了`, review: '復習語彙', newWords: '新規語彙',
				vocab: '語彙問題', grammar: '文法', reading: '読解', wordHint: '単語状態の設定で自動完了',
				manualHint: 'チェックで完了処理', publicHint: '管理者ログイン時に完了処理可能', open: 'JLPT学習を開く →',
				startTomorrow: '学習開始日前です。明日から Day 1 を開始します。', noPlan: '今日の学習情報を読み込めませんでした。',
				reset: '位置をリセット', collapse: '折りたたむ', expand: '展開する',
			};
	}

	function installStyle() {
		if (document.querySelector('link[data-jlpt-today-floating-style]')) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '/assets/css/japanese/today-floating.css';
		link.dataset.jlptTodayFloatingStyle = 'true';
		document.head.appendChild(link);
	}

	function readPosition() {
		try {
			const value = JSON.parse(localStorage.getItem(POSITION_KEY) || 'null');
			return Number.isFinite(value?.x) && Number.isFinite(value?.y) ? value : null;
		} catch { return null; }
	}

	function savePosition(x, y) {
		try { localStorage.setItem(POSITION_KEY, JSON.stringify({ x: Math.round(x), y: Math.round(y) })); } catch { /* optional */ }
	}

	function collapsed() {
		try { return localStorage.getItem(COLLAPSED_KEY) === 'true'; } catch { return false; }
	}

	function saveCollapsed(value) {
		try { localStorage.setItem(COLLAPSED_KEY, String(value)); } catch { /* optional */ }
	}

	function clamp(x, y) {
		if (!widget) return { x, y };
		const margin = 8;
		const width = widget.offsetWidth || 310;
		const height = widget.offsetHeight || 120;
		return {
			x: Math.max(margin, Math.min(window.innerWidth - width - margin, x)),
			y: Math.max(margin, Math.min(window.innerHeight - height - margin, y)),
		};
	}

	function applyStoredPosition() {
		const value = readPosition();
		if (!widget || !value) return;
		const next = clamp(value.x, value.y);
		widget.style.left = `${next.x}px`;
		widget.style.top = `${next.y}px`;
		widget.style.right = 'auto';
		widget.style.bottom = 'auto';
	}

	function resetPosition() {
		try { localStorage.removeItem(POSITION_KEY); } catch { /* optional */ }
		if (!widget) return;
		widget.style.left = '';
		widget.style.top = '';
		widget.style.right = '';
		widget.style.bottom = '';
	}

	function syncCollapsed() {
		if (!widget) return;
		const labels = copy();
		const isCollapsed = collapsed();
		widget.classList.toggle('is-collapsed', isCollapsed);
		const button = widget.querySelector('[data-jlpt-floating-collapse]');
		if (button instanceof HTMLButtonElement) {
			button.textContent = isCollapsed ? '+' : '−';
			button.title = isCollapsed ? labels.expand : labels.collapse;
			button.setAttribute('aria-label', button.title);
		}
	}

	function beginDrag(event) {
		if (!widget || event.button !== 0 || window.innerWidth <= 720) return;
		if (event.target instanceof Element && event.target.closest('button, a, input, label')) return;
		const rect = widget.getBoundingClientRect();
		dragging = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
		widget.classList.add('is-dragging');
		widget.style.left = `${rect.left}px`;
		widget.style.top = `${rect.top}px`;
		widget.style.right = 'auto';
		widget.style.bottom = 'auto';
		widget.querySelector('.jlpt-today-floating-head')?.setPointerCapture?.(event.pointerId);
		event.preventDefault();
	}

	function moveDrag(event) {
		if (!widget || !dragging || event.pointerId !== dragging.pointerId) return;
		const next = clamp(event.clientX - dragging.offsetX, event.clientY - dragging.offsetY);
		widget.style.left = `${next.x}px`;
		widget.style.top = `${next.y}px`;
	}

	function endDrag(event) {
		if (!widget || !dragging || event.pointerId !== dragging.pointerId) return;
		const rect = widget.getBoundingClientRect();
		savePosition(rect.left, rect.top);
		widget.classList.remove('is-dragging');
		dragging = null;
	}

	function buildWidget() {
		if (widget) return widget;
		installStyle();
		widget = document.createElement('aside');
		widget.id = 'jlpt-today-floating';
		widget.className = 'jlpt-today-floating';
		widget.innerHTML = `
			<div class="jlpt-today-floating-head">
				<div class="jlpt-today-floating-title"><span data-jlpt-floating-kicker></span><strong data-jlpt-floating-title></strong><small data-jlpt-floating-drag></small></div>
				<div class="jlpt-today-floating-actions"><button class="jlpt-today-floating-icon-button" type="button" data-jlpt-floating-reset>↺</button><button class="jlpt-today-floating-icon-button" type="button" data-jlpt-floating-collapse>−</button></div>
			</div>
			<div class="jlpt-today-floating-body">
				<div class="jlpt-today-floating-summary"><strong data-jlpt-floating-summary>—</strong><span data-jlpt-floating-percent>0%</span></div>
				<div class="jlpt-today-floating-progress"><i data-jlpt-floating-progress></i></div>
				<div data-jlpt-floating-content><div class="jlpt-today-floating-state">Loading…</div></div>
				<div class="jlpt-today-floating-footer"><span data-jlpt-floating-date>—</span><a class="jlpt-today-floating-link" data-jlpt-floating-link></a></div>
			</div>`;
		document.body.appendChild(widget);
		const head = widget.querySelector('.jlpt-today-floating-head');
		head?.addEventListener('pointerdown', beginDrag);
		head?.addEventListener('pointermove', moveDrag);
		head?.addEventListener('pointerup', endDrag);
		head?.addEventListener('pointercancel', endDrag);
		widget.querySelector('[data-jlpt-floating-reset]')?.addEventListener('click', resetPosition);
		widget.querySelector('[data-jlpt-floating-collapse]')?.addEventListener('click', () => { saveCollapsed(!collapsed()); syncCollapsed(); });
		applyStoredPosition();
		syncCollapsed();
		return widget;
	}

	function scheduleItems(data) {
		const labels = copy();
		const targets = data?.today?.targets || {};
		const completed = data?.today?.completed || {};
		return [
			{ key: 'review', label: labels.review, completed: Number(completed.review || 0), target: Number(targets.review || 0), manual: false },
			{ key: 'newWords', label: labels.newWords, completed: Number(completed.newWords || 0), target: Number(targets.newWords || 0), manual: false },
			{ key: 'vocabQuestions', label: labels.vocab, completed: Number(completed.vocabQuestions || 0), target: Number(targets.vocabQuestions || 0), manual: true },
			{ key: 'grammar', label: labels.grammar, completed: Number(completed.grammar || 0), target: Number(targets.grammar || 0), manual: true },
			{ key: 'reading', label: labels.reading, completed: Number(completed.reading || 0), target: Number(targets.reading || 0), manual: true },
		];
	}

	function done(item) { return item.target <= 0 || item.completed >= item.target; }

	function render(data) {
		buildWidget();
		if (!widget) return;
		const labels = copy();
		const items = scheduleItems(data);
		const active = items.filter((item) => item.target > 0);
		const doneCount = active.filter(done).length;
		const total = active.length;
		const percent = total ? Math.round((doneCount / total) * 100) : 0;
		const setText = (selector, value) => { const node = widget?.querySelector(selector); if (node) node.textContent = String(value); };
		setText('[data-jlpt-floating-kicker]', labels.kicker);
		setText('[data-jlpt-floating-title]', labels.title);
		setText('[data-jlpt-floating-drag]', labels.drag);
		setText('[data-jlpt-floating-summary]', labels.completed(doneCount, total));
		setText('[data-jlpt-floating-percent]', `${percent}%`);
		setText('[data-jlpt-floating-date]', data?.plan?.today || '—');
		const progress = widget.querySelector('[data-jlpt-floating-progress]');
		if (progress instanceof HTMLElement) progress.style.width = `${percent}%`;
		const link = widget.querySelector('[data-jlpt-floating-link]');
		if (link instanceof HTMLAnchorElement) { link.textContent = labels.open; link.href = `/${language()}/japanese/jlpt/`; }
		const reset = widget.querySelector('[data-jlpt-floating-reset]');
		if (reset instanceof HTMLButtonElement) { reset.title = labels.reset; reset.setAttribute('aria-label', labels.reset); }
		syncCollapsed();

		const content = widget.querySelector('[data-jlpt-floating-content]');
		if (!content) return;
		content.replaceChildren();
		if (!data?.plan?.studyStarted) {
			const state = document.createElement('div');
			state.className = 'jlpt-today-floating-state';
			state.textContent = labels.startTomorrow;
			content.appendChild(state);
			return;
		}

		const list = document.createElement('div');
		list.className = 'jlpt-today-floating-list';
		for (const item of items) {
			const isDone = done(item);
			const row = document.createElement('label');
			row.className = `jlpt-today-floating-item${isDone ? ' is-completed' : ''}`;
			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.className = 'jlpt-today-floating-check';
			checkbox.checked = isDone;
			const editable = item.manual && authenticated && Boolean(data?.today?.sessionId) && item.target > 0;
			checkbox.disabled = !editable;
			if (editable) checkbox.addEventListener('change', () => updateSection(item.key, checkbox.checked ? item.target : 0, checkbox));
			const textWrap = document.createElement('span');
			textWrap.className = 'jlpt-today-floating-copy';
			const name = document.createElement('span');
			name.className = 'jlpt-today-floating-label';
			name.textContent = item.label;
			const hint = document.createElement('small');
			hint.className = 'jlpt-today-floating-hint';
			hint.textContent = item.manual ? (authenticated ? labels.manualHint : labels.publicHint) : labels.wordHint;
			textWrap.append(name, hint);
			const count = document.createElement('span');
			count.className = 'jlpt-today-floating-count';
			count.textContent = `${item.completed}/${item.target}`;
			row.append(checkbox, textWrap, count);
			list.appendChild(row);
		}
		content.appendChild(list);
	}

	async function updateSection(section, completed, checkbox) {
		checkbox.disabled = true;
		try {
			const response = await fetch(PROGRESS_API, {
				method: 'PATCH', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ section, completed }),
			});
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error || `HTTP_${response.status}`);
			await refresh();
			window.dispatchEvent(new CustomEvent('jlptstudyprogresschange'));
		} catch (error) {
			console.warn('Failed to update floating JLPT checklist', error);
			checkbox.checked = !checkbox.checked;
		} finally { checkbox.disabled = false; }
	}

	async function loadAuthentication() {
		try {
			const response = await fetch(SESSION_API, { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
			const result = await response.json().catch(() => null);
			authenticated = response.ok && result?.authenticated === true;
		} catch { authenticated = false; }
	}

	async function refresh() {
		buildWidget();
		try {
			const [response] = await Promise.all([
				fetch(DASHBOARD_API, { method: 'GET', credentials: 'same-origin', cache: 'no-store' }),
				loadAuthentication(),
			]);
			const data = await response.json().catch(() => null);
			if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP_${response.status}`);
			render(data);
		} catch (error) {
			console.warn('Failed to load floating JLPT checklist', error);
			const content = widget?.querySelector('[data-jlpt-floating-content]');
			if (content) {
				content.replaceChildren();
				const state = document.createElement('div');
				state.className = 'jlpt-today-floating-state';
				state.textContent = copy().noPlan;
				content.appendChild(state);
			}
		}
	}

	function handleResize() {
		if (!widget || window.innerWidth <= 720) return;
		const current = widget.getBoundingClientRect();
		if (!readPosition()) return;
		const next = clamp(current.left, current.top);
		widget.style.left = `${next.x}px`;
		widget.style.top = `${next.y}px`;
		savePosition(next.x, next.y);
	}

	function initialize() {
		buildWidget();
		refresh();
		window.addEventListener('resize', handleResize);
		window.addEventListener('focus', refresh);
		window.addEventListener('jlptstudyprogresschange', refresh);
		document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
		timer = window.setInterval(() => { if (!document.hidden) refresh(); }, REFRESH_MS);
		window.addEventListener('pagehide', () => window.clearInterval(timer), { once: true });
	}

	window.JlptTodayFloating = { refresh, resetPosition };
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
