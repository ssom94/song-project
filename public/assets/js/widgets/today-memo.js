(() => {
	if (window.location.pathname.startsWith('/admin/') || document.getElementById('song-today-memo')) return;
	const API = '/api/admin/daily-memo';
	const POSITION_KEY = 'song_today_memo_position_v1';
	const SIZE_KEY = 'song_today_memo_size_v1';
	const COLLAPSED_KEY = 'song_today_memo_collapsed_v1';
	const ENABLED_KEY = 'song_widget_today_memo_enabled';
	const EDGE = 10;
	let card;
	let textarea;
	let status;
	let saveTimer = 0;
	let dirty = false;
	let saving = false;
	let collapsed = readText(COLLAPSED_KEY) === '1';
	let position = readJson(POSITION_KEY, { x: 0, y: 0 });
	let size = readJson(SIZE_KEY, { width: 300, height: 260 });

	const isKo = () => document.body?.dataset?.blogLanguage === 'ko' || document.documentElement.lang === 'ko';
	const t = (ko, ja) => isKo() ? ko : ja;
	function readText(key) { try { return localStorage.getItem(key); } catch { return null; } }
	function readJson(key, fallback) { try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) || 'null') }; } catch { return fallback; } }
	function saveLayout() {
		try {
			localStorage.setItem(POSITION_KEY, JSON.stringify(position));
			localStorage.setItem(SIZE_KEY, JSON.stringify(size));
			localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
		} catch { /* optional */ }
	}
	function mountStyle() {
		if (document.querySelector('link[data-today-memo-style]')) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '/assets/css/widgets/today-memo.css?v=20260910-1';
		link.dataset.todayMemoStyle = 'true';
		document.head.appendChild(link);
	}
	function clampLayout() {
		size.width = Math.min(Math.max(240, Number(size.width) || 300), Math.max(240, window.innerWidth - EDGE * 2));
		size.height = Math.min(Math.max(180, Number(size.height) || 260), Math.max(180, window.innerHeight - EDGE * 2));
		const rect = card.getBoundingClientRect();
		position.x = Math.min(Math.max(position.x, EDGE - rect.left + position.x), window.innerWidth - EDGE - rect.right + position.x);
		position.y = Math.min(Math.max(position.y, EDGE - rect.top + position.y), window.innerHeight - EDGE - rect.bottom + position.y);
	}
	function applyLayout() {
		card.style.setProperty('--memo-x', `${Math.round(position.x)}px`);
		card.style.setProperty('--memo-y', `${Math.round(position.y)}px`);
		card.style.setProperty('--memo-width', `${Math.round(size.width)}px`);
		card.style.setProperty('--memo-height', `${Math.round(size.height)}px`);
	}
	function setStatus(copy, state = '') {
		if (!status) return;
		status.textContent = copy;
		status.dataset.state = state;
	}
	function render() {
		card.classList.toggle('is-collapsed', collapsed);
		card.setAttribute('aria-label', t('오늘의 메모', '今日のメモ'));
		card.querySelector('[data-memo-title]').textContent = collapsed ? 'MEMO' : t('오늘의 메모', '今日のメモ');
		card.querySelector('[data-memo-subtitle]').textContent = t('드래그해서 이동 · 모서리로 크기 조절', 'ドラッグ移動 · 角でサイズ調整');
		card.querySelector('[data-memo-collapse]').textContent = collapsed ? '↗' : '−';
		card.querySelector('[data-memo-collapse]').setAttribute('aria-label', collapsed ? t('메모 펼치기', 'メモを開く') : t('메모 접기', 'メモを閉じる'));
		if (textarea) textarea.placeholder = t('오늘 기억할 내용이나 할 일을 적어보세요.', '今日覚えておきたいことや、やることを書いてください。');
		requestAnimationFrame(() => { clampLayout(); applyLayout(); });
	}
	async function saveMemo({ silent = false } = {}) {
		if (!dirty || saving || !textarea) return;
		saving = true;
		const content = textarea.value;
		if (!silent) setStatus(t('저장 중…', '保存中…'));
		try {
			const response = await fetch(API, {
				method: 'PUT', credentials: 'same-origin', cache: 'no-store',
				headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }),
			});
			if (!response.ok) throw new Error(`HTTP_${response.status}`);
			dirty = textarea.value !== content;
			if (dirty) {
				setStatus(t('입력 중…', '入力中…'));
				window.clearTimeout(saveTimer);
				saveTimer = window.setTimeout(() => void saveMemo(), 300);
			} else setStatus(t('저장됨', '保存済み'), 'saved');
		} catch {
			setStatus(t('저장 실패', '保存失敗'), 'error');
		} finally { saving = false; }
	}
	function queueSave() {
		dirty = true;
		setStatus(t('입력 중…', '入力中…'));
		window.clearTimeout(saveTimer);
		saveTimer = window.setTimeout(() => void saveMemo(), 900);
	}
	function saveOnExit() {
		if (!dirty || !textarea) return;
		navigator.sendBeacon(API, new Blob([JSON.stringify({ content: textarea.value })], { type: 'application/json' }));
	}
	function bindMoveAndResize() {
		let action = '';
		let pointerId = null;
		let start = null;
		card.addEventListener('pointerdown', (event) => {
			const target = event.target instanceof Element ? event.target : null;
			if (event.button !== 0 || (!target?.closest('[data-memo-drag]') && !target?.closest('[data-memo-resize]'))) return;
			action = target.closest('[data-memo-resize]') ? 'resize' : 'move';
			pointerId = event.pointerId;
			start = { x: event.clientX, y: event.clientY, position: { ...position }, size: { ...size } };
			card.classList.add(action === 'move' ? 'is-dragging' : 'is-resizing');
			card.setPointerCapture?.(pointerId);
		});
		card.addEventListener('pointermove', (event) => {
			if (!action || event.pointerId !== pointerId) return;
			const dx = event.clientX - start.x;
			const dy = event.clientY - start.y;
			if (action === 'move') position = { x: start.position.x + dx, y: start.position.y + dy };
			else size = { width: start.size.width + dx, height: start.size.height + dy };
			clampLayout(); applyLayout();
		});
		const finish = (event) => {
			if (!action || event.pointerId !== pointerId) return;
			card.classList.remove('is-dragging', 'is-resizing');
			try { card.releasePointerCapture?.(pointerId); } catch { /* optional */ }
			action = ''; pointerId = null; saveLayout();
		};
		card.addEventListener('pointerup', finish);
		card.addEventListener('pointercancel', finish);
	}
	async function init() {
		mountStyle();
		const response = await fetch(API, { credentials: 'same-origin', cache: 'no-store' }).catch(() => null);
		if (!response?.ok) return;
		const data = await response.json().catch(() => null);
		if (!data?.ok) return;
		card = document.createElement('aside');
		card.id = 'song-today-memo';
		card.className = 'song-today-memo';
		card.innerHTML = `<header data-memo-drag><div><strong data-memo-title></strong><small data-memo-subtitle></small></div><button type="button" data-memo-collapse></button></header><div class="song-today-memo-body"><textarea maxlength="10000"></textarea><footer><span data-memo-status></span><button type="button" data-memo-save></button></footer></div><span class="song-today-memo-resize" data-memo-resize aria-hidden="true"></span>`;
		document.body.appendChild(card);
		card.hidden = readText(ENABLED_KEY) === '0';
		textarea = card.querySelector('textarea');
		status = card.querySelector('[data-memo-status]');
		textarea.value = data.content || '';
		textarea.addEventListener('input', queueSave);
		card.querySelector('[data-memo-save]').textContent = t('저장', '保存');
		card.querySelector('[data-memo-save]').addEventListener('click', () => void saveMemo());
		card.querySelector('[data-memo-collapse]').addEventListener('click', () => { collapsed = !collapsed; saveLayout(); render(); });
		setStatus(t('저장됨', '保存済み'), 'saved');
		bindMoveAndResize(); render();
		window.addEventListener('resize', () => { clampLayout(); applyLayout(); saveLayout(); });
		window.addEventListener('pagehide', saveOnExit);
		document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveOnExit(); });
		window.addEventListener('song:widget-visibility', (event) => {
			if (event.detail?.key === 'todayMemo' && card) card.hidden = !event.detail.enabled;
		});
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
	else void init();
})();
