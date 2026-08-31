(() => {
	const mounted = new WeakSet();
	const MAX_HISTORY = 120;
	const GROUP_MS = 450;

	function language() {
		return window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja';
	}

	function labels() {
		return language() === 'ko'
			? { undo: '실행 취소', redo: '다시 실행' }
			: { undo: '元に戻す', redo: 'やり直す' };
	}

	function snapshot(textarea) {
		return {
			value: textarea.value,
			start: textarea.selectionStart,
			end: textarea.selectionEnd,
			scrollTop: textarea.scrollTop,
		};
	}

	function same(a, b) {
		return Boolean(a && b && a.value === b.value && a.start === b.start && a.end === b.end);
	}

	function restore(textarea, value) {
		textarea.value = value.value;
		textarea.focus();
		textarea.setSelectionRange(
			Math.min(value.start, textarea.value.length),
			Math.min(value.end, textarea.value.length),
		);
		textarea.scrollTop = value.scrollTop || 0;
		textarea.dispatchEvent(new Event('input', { bubbles: true }));
	}

	function mount(toolbar) {
		if (!(toolbar instanceof HTMLElement) || mounted.has(toolbar)) return;
		const workspace = toolbar.nextElementSibling;
		const textarea = workspace?.querySelector?.('textarea');
		const tools = toolbar.querySelector('.admin-markdown-tools');
		if (!(textarea instanceof HTMLTextAreaElement) || !(tools instanceof HTMLElement)) return;
		mounted.add(toolbar);

		const state = {
			undo: [snapshot(textarea)],
			redo: [],
			restoring: false,
			lastInputAt: 0,
		};

		const undoButton = document.createElement('button');
		undoButton.type = 'button';
		undoButton.className = 'admin-markdown-tool admin-markdown-history-tool';
		undoButton.dataset.editorHistory = 'undo';
		undoButton.textContent = '↶';

		const redoButton = document.createElement('button');
		redoButton.type = 'button';
		redoButton.className = 'admin-markdown-tool admin-markdown-history-tool';
		redoButton.dataset.editorHistory = 'redo';
		redoButton.textContent = '↷';

		const separator = document.createElement('span');
		separator.className = 'admin-markdown-history-separator';
		separator.setAttribute('aria-hidden', 'true');
		tools.prepend(separator);
		tools.prepend(redoButton);
		tools.prepend(undoButton);

		function syncButtons() {
			undoButton.disabled = textarea.disabled || textarea.readOnly || state.undo.length <= 1;
			redoButton.disabled = textarea.disabled || textarea.readOnly || state.redo.length === 0;
			const text = labels();
			undoButton.title = `${text.undo} (Ctrl/Cmd+Z)`;
			undoButton.setAttribute('aria-label', undoButton.title);
			redoButton.title = `${text.redo} (Ctrl/Cmd+Shift+Z / Ctrl+Y)`;
			redoButton.setAttribute('aria-label', redoButton.title);
		}

		function pushCurrent(force = false) {
			if (state.restoring) return;
			const next = snapshot(textarea);
			const current = state.undo[state.undo.length - 1];
			if (same(current, next)) return;
			const now = Date.now();
			const grouped = !force && current && now - state.lastInputAt < GROUP_MS;
			if (grouped) state.undo[state.undo.length - 1] = next;
			else state.undo.push(next);
			if (state.undo.length > MAX_HISTORY) state.undo.splice(0, state.undo.length - MAX_HISTORY);
			state.redo = [];
			state.lastInputAt = now;
			syncButtons();
		}

		function undo() {
			if (state.undo.length <= 1 || textarea.disabled || textarea.readOnly) return;
			state.restoring = true;
			const current = state.undo.pop();
			if (current) state.redo.push(current);
			const previous = state.undo[state.undo.length - 1];
			if (previous) restore(textarea, previous);
			state.restoring = false;
			state.lastInputAt = 0;
			syncButtons();
		}

		function redo() {
			if (!state.redo.length || textarea.disabled || textarea.readOnly) return;
			state.restoring = true;
			const next = state.redo.pop();
			if (next) {
				state.undo.push(next);
				restore(textarea, next);
			}
			state.restoring = false;
			state.lastInputAt = 0;
			syncButtons();
		}

		textarea.addEventListener('input', (event) => {
			if (state.restoring) return;
			const force = !event.isTrusted;
			pushCurrent(force);
		});

		textarea.addEventListener('keydown', (event) => {
			if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
			const key = event.key.toLowerCase();
			if (key === 'z' && !event.shiftKey) {
				event.preventDefault();
				event.stopImmediatePropagation();
				undo();
			} else if ((key === 'z' && event.shiftKey) || (key === 'y' && !event.metaKey)) {
				event.preventDefault();
				event.stopImmediatePropagation();
				redo();
			}
		}, true);

		undoButton.addEventListener('click', undo);
		redoButton.addEventListener('click', redo);
		new MutationObserver(syncButtons).observe(textarea, { attributes: true, attributeFilter: ['disabled', 'readonly'] });
		document.addEventListener('adminlanguagechange', syncButtons);
		syncButtons();
	}

	function scan() {
		document.querySelectorAll('.admin-markdown-toolbar').forEach(mount);
	}

	function initialize() {
		scan();
		new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
