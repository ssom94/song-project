(() => {
	const editors = [];
	const toggleMarkers = {
		bold: ['**', '**'],
		italic: ['*', '*'],
		underline: ['++', '++'],
		strike: ['~~', '~~'],
		inlineCode: ['`', '`'],
	};

	function currentLanguage() {
		return window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja';
	}

	function copy() {
		return currentLanguage() === 'ko'
			? {
				markdown: 'Markdown',
				help: '선택한 텍스트에 적용합니다. 같은 효과를 다시 누르면 해제됩니다.',
				preview: '미리보기 보기',
				hidePreview: '미리보기 닫기',
				livePreview: '실시간 미리보기',
				empty: '본문을 입력하면 여기에 바로 미리보기가 표시됩니다.',
				buttons: {
					h2: '제목 2', h3: '제목 3', bold: '굵게', italic: '기울임', underline: '밑줄', strike: '취소선',
					bullet: '목록', number: '번호 목록', quote: '인용', inlineCode: '인라인 코드',
					codeBlock: '코드 블록', link: '링크', hr: '구분선',
				},
			}
			: {
				markdown: 'Markdown',
				help: '選択したテキストに適用します。同じ効果をもう一度押すと解除されます。',
				preview: 'プレビューを表示',
				hidePreview: 'プレビューを閉じる',
				livePreview: 'リアルタイムプレビュー',
				empty: '本文を入力すると、ここにすぐプレビューが表示されます。',
				buttons: {
					h2: '見出し2', h3: '見出し3', bold: '太字', italic: '斜体', underline: '下線', strike: '取り消し線',
					bullet: '箇条書き', number: '番号付きリスト', quote: '引用', inlineCode: 'インラインコード',
					codeBlock: 'コードブロック', link: 'リンク', hr: '区切り線',
				},
			};
	}

	function mountStyle() {
		for (const [href, attr] of [
			['/assets/css/markdown.css', 'data-post-markdown-content-style'],
			['/assets/css/admin/post-markdown-editor.css', 'data-post-markdown-editor-style'],
		]) {
			if (document.querySelector(`link[${attr}]`)) continue;
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = href;
			link.setAttribute(attr, 'true');
			document.head.appendChild(link);
		}
	}

	function loadRenderer() {
		if (window.SongMarkdown?.render) return Promise.resolve();
		return new Promise((resolve, reject) => {
			const existing = document.querySelector('script[data-song-markdown-renderer]');
			if (existing) {
				existing.addEventListener('load', resolve, { once: true });
				existing.addEventListener('error', reject, { once: true });
				return;
			}
			const script = document.createElement('script');
			script.src = '/assets/js/markdown.js';
			script.dataset.songMarkdownRenderer = 'true';
			script.addEventListener('load', resolve, { once: true });
			script.addEventListener('error', reject, { once: true });
			document.head.appendChild(script);
		});
	}

	function dispatchInput(textarea) {
		textarea.dispatchEvent(new Event('input', { bubbles: true }));
	}

	function replaceRange(textarea, start, end, value, selectionStart, selectionEnd) {
		const before = textarea.value.slice(0, start);
		const after = textarea.value.slice(end);
		textarea.value = `${before}${value}${after}`;
		textarea.focus();
		textarea.setSelectionRange(before.length + selectionStart, before.length + selectionEnd);
		dispatchInput(textarea);
	}

	function replaceSelection(textarea, value, selectionStart, selectionEnd) {
		replaceRange(textarea, textarea.selectionStart, textarea.selectionEnd, value, selectionStart, selectionEnd);
	}

	function isWrapped(textarea, prefix, suffix) {
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const selected = textarea.value.slice(start, end);
		if (
			selected.length >= prefix.length + suffix.length
			&& selected.startsWith(prefix)
			&& selected.endsWith(suffix)
		) return true;
		return start >= prefix.length
			&& textarea.value.slice(start - prefix.length, start) === prefix
			&& textarea.value.slice(end, end + suffix.length) === suffix;
	}

	function toggleWrap(textarea, prefix, suffix, placeholder) {
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const selected = textarea.value.slice(start, end);

		if (
			selected.length >= prefix.length + suffix.length
			&& selected.startsWith(prefix)
			&& selected.endsWith(suffix)
		) {
			const body = selected.slice(prefix.length, selected.length - suffix.length);
			replaceRange(textarea, start, end, body, 0, body.length);
			return;
		}

		if (
			start >= prefix.length
			&& textarea.value.slice(start - prefix.length, start) === prefix
			&& textarea.value.slice(end, end + suffix.length) === suffix
		) {
			replaceRange(
				textarea,
				start - prefix.length,
				end + suffix.length,
				selected,
				0,
				selected.length,
			);
			return;
		}

		const body = selected || placeholder;
		const value = `${prefix}${body}${suffix}`;
		replaceSelection(textarea, value, prefix.length, prefix.length + body.length);
	}

	function prefixLines(textarea, prefix, ordered = false) {
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const lineStart = textarea.value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
		const nextBreak = textarea.value.indexOf('\n', end);
		const lineEnd = nextBreak === -1 ? textarea.value.length : nextBreak;
		const selected = textarea.value.slice(lineStart, lineEnd) || (currentLanguage() === 'ko' ? '항목' : '項目');
		const sourceLines = selected.split('\n');
		const allApplied = ordered
			? sourceLines.every((line) => /^\d+[.)]\s+/.test(line))
			: sourceLines.every((line) => line.startsWith(prefix));
		const lines = allApplied
			? sourceLines.map((line) => ordered ? line.replace(/^\d+[.)]\s+/, '') : line.slice(prefix.length))
			: sourceLines.map((line, index) => `${ordered ? `${index + 1}. ` : prefix}${line}`);
		const before = textarea.value.slice(0, lineStart);
		const after = textarea.value.slice(lineEnd);
		const value = lines.join('\n');
		textarea.value = `${before}${value}${after}`;
		textarea.focus();
		textarea.setSelectionRange(before.length, before.length + value.length);
		dispatchInput(textarea);
	}

	function applyAction(textarea, action) {
		if (textarea.disabled || textarea.readOnly) return;
		switch (action) {
			case 'h2': prefixLines(textarea, '## '); break;
			case 'h3': prefixLines(textarea, '### '); break;
			case 'bold': toggleWrap(textarea, '**', '**', currentLanguage() === 'ko' ? '굵은 텍스트' : '太字'); break;
			case 'italic': toggleWrap(textarea, '*', '*', currentLanguage() === 'ko' ? '기울임 텍스트' : '斜体'); break;
			case 'underline': toggleWrap(textarea, '++', '++', currentLanguage() === 'ko' ? '밑줄 텍스트' : '下線'); break;
			case 'strike': toggleWrap(textarea, '~~', '~~', currentLanguage() === 'ko' ? '취소선' : '取り消し線'); break;
			case 'bullet': prefixLines(textarea, '- '); break;
			case 'number': prefixLines(textarea, '', true); break;
			case 'quote': prefixLines(textarea, '> '); break;
			case 'inlineCode': toggleWrap(textarea, '`', '`', 'code'); break;
			case 'codeBlock': {
				const selected = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd) || 'code';
				const value = `\n\`\`\`\n${selected}\n\`\`\`\n`;
				replaceSelection(textarea, value, 5, 5 + selected.length);
				break;
			}
			case 'link': {
				const selected = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd) || (currentLanguage() === 'ko' ? '링크 텍스트' : 'リンクテキスト');
				const value = `[${selected}](https://example.com)`;
				const urlStart = selected.length + 3;
				replaceSelection(textarea, value, urlStart, value.length - 1);
				break;
			}
			case 'hr': replaceSelection(textarea, '\n\n---\n\n', 7, 7); break;
			default: break;
		}
	}

	function renderPreview(editor) {
		if (editor.previewPane.hidden) return;
		const source = editor.textarea.value.trim();
		if (!source) {
			editor.preview.classList.add('is-empty');
			editor.preview.textContent = copy().empty;
			return;
		}
		editor.preview.classList.remove('is-empty');
		if (!window.SongMarkdown?.render?.(editor.textarea.value, editor.preview)) editor.preview.textContent = editor.textarea.value;
	}

	function syncToolState(editor) {
		for (const button of editor.toolbar.querySelectorAll('[data-markdown-action]')) {
			const markers = toggleMarkers[button.dataset.markdownAction];
			if (!markers) continue;
			const active = isWrapped(editor.textarea, markers[0], markers[1]);
			button.classList.toggle('is-active', active);
			button.setAttribute('aria-pressed', active ? 'true' : 'false');
		}
	}

	function syncEditor(editor) {
		const labels = copy();
		editor.badge.textContent = labels.markdown;
		editor.help.textContent = labels.help;
		editor.previewTitle.textContent = labels.livePreview;
		editor.previewButton.textContent = editor.previewPane.hidden ? labels.preview : labels.hidePreview;
		for (const button of editor.toolbar.querySelectorAll('[data-markdown-action]')) {
			button.title = labels.buttons[button.dataset.markdownAction] || '';
			button.setAttribute('aria-label', button.title);
			button.disabled = editor.textarea.disabled || editor.textarea.readOnly;
		}
		syncToolState(editor);
		renderPreview(editor);
	}

	function createActionButton(action, label) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'admin-markdown-tool';
		button.dataset.markdownAction = action;
		button.textContent = label;
		if (toggleMarkers[action]) button.setAttribute('aria-pressed', 'false');
		return button;
	}

	function enhance(textarea) {
		if (!(textarea instanceof HTMLTextAreaElement) || textarea.dataset.markdownEnhanced === 'true') return;
		textarea.dataset.markdownEnhanced = 'true';

		const toolbar = document.createElement('div');
		toolbar.className = 'admin-markdown-toolbar';
		const intro = document.createElement('div');
		intro.className = 'admin-markdown-intro';
		const badge = document.createElement('strong');
		badge.className = 'admin-markdown-badge';
		const help = document.createElement('span');
		intro.append(badge, help);

		const tools = document.createElement('div');
		tools.className = 'admin-markdown-tools';
		const definitions = [
			['h2', 'H2'], ['h3', 'H3'], ['bold', 'B'], ['italic', 'I'], ['underline', 'U'], ['strike', 'S'],
			['bullet', '•'], ['number', '1.'], ['quote', '❯'], ['inlineCode', '<>'], ['codeBlock', '{ }'], ['link', '↗'], ['hr', '—'],
		];
		for (const [action, label] of definitions) {
			const button = createActionButton(action, label);
			button.addEventListener('click', () => {
				applyAction(textarea, action);
				requestAnimationFrame(() => syncToolState(editor));
			});
			tools.appendChild(button);
		}
		const previewButton = document.createElement('button');
		previewButton.type = 'button';
		previewButton.className = 'admin-markdown-preview-toggle';
		tools.appendChild(previewButton);
		toolbar.append(intro, tools);

		const workspace = document.createElement('div');
		workspace.className = 'admin-markdown-workspace';
		if (textarea.classList.contains('admin-editor-translation-content')) workspace.classList.add('is-translation');
		const editorPane = document.createElement('div');
		editorPane.className = 'admin-markdown-editor-pane';
		const previewPane = document.createElement('section');
		previewPane.className = 'admin-markdown-preview-pane';
		const previewHeader = document.createElement('div');
		previewHeader.className = 'admin-markdown-preview-header';
		const previewTitle = document.createElement('strong');
		const liveBadge = document.createElement('span');
		liveBadge.className = 'admin-markdown-live-badge';
		liveBadge.textContent = 'LIVE';
		previewHeader.append(previewTitle, liveBadge);
		const preview = document.createElement('div');
		preview.className = 'admin-markdown-preview song-markdown';
		previewPane.append(previewHeader, preview);

		textarea.insertAdjacentElement('beforebegin', toolbar);
		toolbar.insertAdjacentElement('afterend', workspace);
		editorPane.appendChild(textarea);
		workspace.append(editorPane, previewPane);

		const editor = { textarea, toolbar, workspace, previewPane, preview, previewButton, previewTitle, badge, help };
		editors.push(editor);
		previewButton.addEventListener('click', () => {
			previewPane.hidden = !previewPane.hidden;
			syncEditor(editor);
		});
		textarea.addEventListener('input', () => {
			renderPreview(editor);
			syncToolState(editor);
		});
		for (const eventName of ['click', 'keyup', 'select']) {
			textarea.addEventListener(eventName, () => syncToolState(editor));
		}
		textarea.addEventListener('keydown', (event) => {
			if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
			const key = event.key.toLowerCase();
			if (key === 'b') {
				event.preventDefault();
				applyAction(textarea, 'bold');
			} else if (key === 'i') {
				event.preventDefault();
				applyAction(textarea, 'italic');
			} else if (key === 'u') {
				event.preventDefault();
				applyAction(textarea, 'underline');
			}
		});
		const disabledObserver = new MutationObserver(() => syncEditor(editor));
		disabledObserver.observe(textarea, { attributes: true, attributeFilter: ['disabled', 'readonly'] });
		syncEditor(editor);
	}

	async function initialize() {
		await Promise.all([window.AdminCommon?.ready, window.AdminI18n?.ready]);
		mountStyle();
		try { await loadRenderer(); } catch (error) { console.warn('Failed to load Markdown renderer', error); }
		document.querySelectorAll('#post-content, #translated-content').forEach(enhance);
		document.addEventListener('adminlanguagechange', () => editors.forEach(syncEditor));
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
