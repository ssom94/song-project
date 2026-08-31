(() => {
	const PRESETS = ['#e5484d', '#e07a28', '#c79a16', '#2f9e64', '#2374d8', '#6f55c8', '#d14d9f', '#4b5563'];
	const mounted = new WeakSet();

	function currentLanguage() {
		return window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja';
	}

	function labels() {
		return currentLanguage() === 'ko'
			? { title: '텍스트 색상', placeholder: '색상 텍스트' }
			: { title: '文字色', placeholder: '色付きテキスト' };
	}

	function ensureStyle() {
		if (document.querySelector('link[data-post-text-color-style]')) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '/assets/css/admin/post-text-color.css?v=20260831-1';
		link.dataset.postTextColorStyle = 'true';
		document.head.appendChild(link);
	}

	function dispatchInput(textarea) {
		textarea.dispatchEvent(new Event('input', { bubbles: true }));
	}

	function selectedRange(textarea, cached) {
		const start = Number.isInteger(cached?.start) ? cached.start : textarea.selectionStart;
		const end = Number.isInteger(cached?.end) ? cached.end : textarea.selectionEnd;
		return { start, end };
	}

	function wrapLine(line, color) {
		if (!line) return '';
		const existing = line.match(/^\{\{color:#[0-9a-fA-F]{6}\|([^{}\n]+)\}\}$/);
		const body = existing ? existing[1] : line;
		return `{{color:${color}|${body}}}`;
	}

	function applyColor(textarea, color, cached) {
		if (!(textarea instanceof HTMLTextAreaElement) || textarea.disabled || textarea.readOnly) return;
		if (!/^#[0-9a-f]{6}$/i.test(color)) return;
		const { start, end } = selectedRange(textarea, cached);
		const selected = textarea.value.slice(start, end);
		const body = selected || labels().placeholder;
		const wrapped = body.split('\n').map((line) => wrapLine(line, color.toLowerCase())).join('\n');
		const before = textarea.value.slice(0, start);
		const after = textarea.value.slice(end);
		textarea.value = `${before}${wrapped}${after}`;
		textarea.focus();
		textarea.setSelectionRange(start, start + wrapped.length);
		dispatchInput(textarea);
	}

	function textareaForToolbar(toolbar) {
		const workspace = toolbar.nextElementSibling;
		return workspace?.querySelector?.('textarea') ?? null;
	}

	function mount(toolbar) {
		if (!(toolbar instanceof HTMLElement) || mounted.has(toolbar)) return;
		const textarea = textareaForToolbar(toolbar);
		const tools = toolbar.querySelector('.admin-markdown-tools');
		if (!(textarea instanceof HTMLTextAreaElement) || !(tools instanceof HTMLElement)) return;
		mounted.add(toolbar);

		const wrap = document.createElement('div');
		wrap.className = 'admin-markdown-color-wrap';
		const picker = document.createElement('label');
		picker.className = 'admin-markdown-color-picker';
		picker.style.setProperty('--post-text-color', PRESETS[0]);
		const marker = document.createElement('span');
		marker.textContent = 'A';
		const input = document.createElement('input');
		input.type = 'color';
		input.value = PRESETS[0];
		picker.append(marker, input);

		let range = { start: textarea.selectionStart, end: textarea.selectionEnd };
		const remember = () => { range = { start: textarea.selectionStart, end: textarea.selectionEnd }; };
		textarea.addEventListener('select', remember);
		textarea.addEventListener('keyup', remember);
		textarea.addEventListener('mouseup', remember);
		picker.addEventListener('pointerdown', remember);
		input.addEventListener('input', () => {
			picker.style.setProperty('--post-text-color', input.value);
		});
		input.addEventListener('change', () => applyColor(textarea, input.value, range));

		const swatches = document.createElement('div');
		swatches.className = 'admin-markdown-color-swatches';
		for (const color of PRESETS) {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'admin-markdown-color-swatch';
			button.style.setProperty('--swatch', color);
			button.dataset.color = color;
			button.addEventListener('pointerdown', remember);
			button.addEventListener('click', () => {
				input.value = color;
				picker.style.setProperty('--post-text-color', color);
				applyColor(textarea, color, range);
			});
			swatches.appendChild(button);
		}
		wrap.append(picker, swatches);
		tools.insertBefore(wrap, tools.querySelector('.admin-markdown-preview-toggle'));

		function syncCopy() {
			const text = labels().title;
			picker.title = text;
			picker.setAttribute('aria-label', text);
			for (const button of swatches.children) {
				button.title = `${text}: ${button.dataset.color}`;
				button.setAttribute('aria-label', button.title);
			}
		}
		syncCopy();
		document.addEventListener('adminlanguagechange', syncCopy);
	}

	function scan() {
		document.querySelectorAll('.admin-markdown-toolbar').forEach(mount);
	}

	function initialize() {
		ensureStyle();
		scan();
		new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
