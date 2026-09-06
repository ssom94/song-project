(() => {
	const MAX_BYTES = 8 * 1024 * 1024;
	const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
	const enhanced = new WeakSet();

	function language() {
		return window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja';
	}

	function copy() {
		return language() === 'ko'
			? {
				button: '이미지 첨부',
				uploading: '이미지 업로드 중…',
				uploaded: '이미지 첨부 완료',
				drop: '이미지를 여기에 놓으세요',
				screenshot: '스크린샷',
				unsupported: 'PNG/JPG/WebP 이미지만 첨부할 수 있습니다.',
				tooLarge: '이미지는 8MB 이하만 첨부할 수 있습니다.',
				failed: '이미지 업로드에 실패했습니다.',
			}
			: {
				button: '画像を添付',
				uploading: '画像をアップロード中…',
				uploaded: '画像を添付しました',
				drop: '画像をここにドロップ',
				screenshot: 'スクリーンショット',
				unsupported: 'PNG/JPG/WebP画像のみ添付できます。',
				tooLarge: '画像は8MB以下にしてください。',
				failed: '画像のアップロードに失敗しました。',
			};
	}

	function mountStyle() {
		if (document.querySelector('link[data-post-image-upload-style]')) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '/assets/css/admin/post-image-upload.css?v=20260906-1';
		link.dataset.postImageUploadStyle = 'true';
		document.head.appendChild(link);
	}

	function sanitizeAlt(value) {
		return String(value || '')
			.replace(/\.[a-z0-9]{2,5}$/i, '')
			.replace(/[\[\]\r\n]+/g, ' ')
			.trim()
			.slice(0, 120);
	}

	function imageAlt(file, fromClipboard) {
		const raw = sanitizeAlt(file?.name || '');
		if (fromClipboard && (!raw || /^(image|blob|clipboard)$/i.test(raw))) return copy().screenshot;
		return raw || copy().screenshot;
	}

	function validateFile(file) {
		if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type)) return copy().unsupported;
		if (file.size <= 0 || file.size > MAX_BYTES) return copy().tooLarge;
		return null;
	}

	function showError(message) {
		if (window.AdminCommon?.alert) {
			window.AdminCommon.alert({
				titleFallback: language() === 'ko' ? '이미지 첨부' : '画像添付',
				messageFallback: message,
				confirmFallback: language() === 'ko' ? '확인' : '確認',
			});
			return;
		}
		window.alert(message);
	}

	function setStatus(editor, message = '', type = 'info') {
		if (!editor.status) return;
		editor.status.textContent = message;
		editor.status.dataset.type = type;
		editor.status.hidden = !message;
	}

	function setBusy(editor, busy) {
		editor.busy = busy;
		editor.button.disabled = busy || editor.textarea.disabled || editor.textarea.readOnly;
		if (!busy) return;
		setStatus(editor, copy().uploading, 'info');
	}

	function selectionAnchor(textarea) {
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		return {
			start,
			end,
			before: textarea.value.slice(0, start),
			selected: textarea.value.slice(start, end),
			after: textarea.value.slice(end),
		};
	}

	function insertMarkdown(textarea, anchor, markdown) {
		let start = textarea.selectionStart;
		let end = textarea.selectionEnd;
		const unchanged = textarea.value === `${anchor.before}${anchor.selected}${anchor.after}`;
		if (unchanged) {
			start = anchor.start;
			end = anchor.end;
		}

		const before = textarea.value.slice(0, start);
		const after = textarea.value.slice(end);
		const needsLeadingBreak = before && !before.endsWith('\n');
		const needsTrailingBreak = after && !after.startsWith('\n');
		const value = `${needsLeadingBreak ? '\n\n' : ''}${markdown}${needsTrailingBreak ? '\n\n' : '\n'}`;
		textarea.value = `${before}${value}${after}`;
		const cursor = before.length + value.length;
		textarea.focus();
		textarea.setSelectionRange(cursor, cursor);
		textarea.dispatchEvent(new Event('input', { bubbles: true }));
		return selectionAnchor(textarea);
	}

	async function uploadFile(file) {
		const form = new FormData();
		form.set('file', file);
		const response = await fetch('/api/admin/posts/image', {
			method: 'POST',
			credentials: 'same-origin',
			body: form,
		});
		if (response.status === 401) {
			window.location.replace('/admin/login/');
			throw new Error('UNAUTHORIZED');
		}
		const result = await response.json().catch(() => null);
		if (!response.ok || !result?.ok || !result?.url) {
			const error = new Error(result?.error || `HTTP_${response.status}`);
			error.code = result?.error || '';
			throw error;
		}
		return result;
	}

	async function attachFiles(editor, files, options = {}) {
		if (editor.busy) return;
		const images = Array.from(files || []).filter(Boolean);
		if (!images.length) return;
		for (const file of images) {
			const error = validateFile(file);
			if (error) {
				showError(error);
				return;
			}
		}

		let anchor = selectionAnchor(editor.textarea);
		setBusy(editor, true);
		try {
			for (const file of images) {
				const result = await uploadFile(file);
				const alt = imageAlt(file, options.fromClipboard === true);
				anchor = insertMarkdown(editor.textarea, anchor, `![${alt}](${result.url})`);
			}
			setStatus(editor, copy().uploaded, 'info');
			window.setTimeout(() => {
				if (!editor.busy) setStatus(editor, '', 'info');
			}, 1800);
		} catch (error) {
			console.error('Post image upload failed', error);
			setStatus(editor, copy().failed, 'error');
			showError(copy().failed);
		} finally {
			setBusy(editor, false);
		}
	}

	function clipboardImages(event) {
		const files = [];
		for (const item of Array.from(event.clipboardData?.items || [])) {
			if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
			const file = item.getAsFile();
			if (file) files.push(file);
		}
		return files;
	}

	function transferredImages(dataTransfer) {
		return Array.from(dataTransfer?.files || []).filter((file) => file.type.startsWith('image/'));
	}

	function enhance(textarea) {
		if (!(textarea instanceof HTMLTextAreaElement) || enhanced.has(textarea)) return;
		const workspace = textarea.closest('.admin-markdown-workspace');
		const toolbar = workspace?.previousElementSibling;
		if (!(workspace instanceof HTMLElement) || !(toolbar instanceof HTMLElement) || !toolbar.classList.contains('admin-markdown-toolbar')) return;
		enhanced.add(textarea);

		const tools = toolbar.querySelector('.admin-markdown-tools');
		if (!(tools instanceof HTMLElement)) return;

		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'admin-markdown-tool admin-markdown-image-tool';
		button.textContent = '▧';
		button.title = copy().button;
		button.setAttribute('aria-label', copy().button);

		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'image/png,image/jpeg,image/webp';
		input.multiple = true;
		input.className = 'admin-post-image-input';

		const status = document.createElement('span');
		status.className = 'admin-post-image-status';
		status.hidden = true;

		const previewToggle = tools.querySelector('.admin-markdown-preview-toggle');
		tools.insertBefore(button, previewToggle || null);
		tools.insertBefore(input, previewToggle || null);
		tools.insertBefore(status, previewToggle || null);

		workspace.querySelector('.admin-markdown-editor-pane')?.setAttribute('data-image-drop-label', copy().drop);
		const editor = { textarea, workspace, toolbar, button, input, status, busy: false };

		button.addEventListener('click', () => {
			if (!editor.busy) input.click();
		});
		input.addEventListener('change', async () => {
			await attachFiles(editor, input.files);
			input.value = '';
		});
		textarea.addEventListener('paste', (event) => {
			const files = clipboardImages(event);
			if (!files.length) return;
			event.preventDefault();
			attachFiles(editor, files, { fromClipboard: true });
		});
		workspace.addEventListener('dragover', (event) => {
			if (!transferredImages(event.dataTransfer).length) return;
			event.preventDefault();
			if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
			workspace.classList.add('is-image-dragover');
		});
		workspace.addEventListener('dragleave', (event) => {
			if (event.relatedTarget instanceof Node && workspace.contains(event.relatedTarget)) return;
			workspace.classList.remove('is-image-dragover');
		});
		workspace.addEventListener('drop', (event) => {
			const files = transferredImages(event.dataTransfer);
			workspace.classList.remove('is-image-dragover');
			if (!files.length) return;
			event.preventDefault();
			textarea.focus();
			attachFiles(editor, files);
		});

		const observer = new MutationObserver(() => {
			button.disabled = editor.busy || textarea.disabled || textarea.readOnly;
		});
		observer.observe(textarea, { attributes: true, attributeFilter: ['disabled', 'readonly'] });

		document.addEventListener('adminlanguagechange', () => {
			button.title = copy().button;
			button.setAttribute('aria-label', copy().button);
			workspace.querySelector('.admin-markdown-editor-pane')?.setAttribute('data-image-drop-label', copy().drop);
		});
	}

	async function waitForMarkdownEditors() {
		await window.AdminPostEditor?.ready;
		for (let attempt = 0; attempt < 100; attempt += 1) {
			const textareas = [...document.querySelectorAll('#post-content, #translated-content')];
			if (textareas.length && textareas.every((textarea) => textarea.dataset.markdownEnhanced === 'true')) {
				textareas.forEach(enhance);
				return;
			}
			await new Promise((resolve) => window.setTimeout(resolve, 40));
		}
		document.querySelectorAll('#post-content, #translated-content').forEach(enhance);
	}

	function initialize() {
		mountStyle();
		waitForMarkdownEditors().catch((error) => console.warn('Failed to initialize post image uploader', error));
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
