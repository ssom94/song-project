(() => {
	const selectedFiles = new Map();
	const selectedPreviews = new Map();
	let versions = [];
	let documents = [];

	function byId(id) { return document.getElementById(id); }
	function language() { return window.AdminI18n?.getLanguage?.() ?? 'ja'; }
	function t(key, ja, ko) {
		const translated = window.AdminI18n?.t?.(key);
		if (translated && translated !== key) return translated;
		return language() === 'ko' ? ko : ja;
	}

	function formatBytes(value) {
		const bytes = Math.max(0, Number(value) || 0);
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function formatDate(value) {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '—';
		return new Intl.DateTimeFormat(language() === 'ko' ? 'ko-KR' : 'ja-JP', {
			year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
		}).format(date);
	}

	function documentName(type) {
		if (type === 'career_history') return t('careerHistory', '職務経歴書', '직무경력서');
		return t('skillSheet', 'スキルシート', '스킬시트');
	}

	function unregisteredLabel() {
		return t('documentUnregistered', '未登録', '미등록 상태');
	}

	function conversionLabel(status) {
		const map = {
			queued: t('conversionQueued', '変換待ち', '변환 대기'),
			processing: t('conversionProcessing', '変換中', '변환 중'),
			ready: t('conversionReady', '登録済み', '등록 완료'),
			failed: t('conversionFailed', '失敗', '실패'),
		};
		return map[status] ?? status ?? '—';
	}

	function setMessage(type, message, isError = false) {
		const node = byId(`document-${type}-message`);
		if (!node) return;
		node.textContent = message;
		node.hidden = !message;
		node.classList.toggle('is-error', isError);
	}

	function trimMatrix(rows) {
		const normalized = rows.map((row) => {
			const values = Array.isArray(row) ? row.map((cell) => cell == null ? '' : String(cell)) : [];
			while (values.length && values[values.length - 1] === '') values.pop();
			return values;
		});
		while (normalized.length && normalized[normalized.length - 1].length === 0) normalized.pop();
		return normalized;
	}

	async function parseWorkbook(file) {
		if (!window.XLSX?.read || !window.XLSX?.utils?.sheet_to_json) throw new Error('XLSX_LIBRARY_UNAVAILABLE');
		const bytes = await file.arrayBuffer();
		const workbook = window.XLSX.read(bytes, { type: 'array', cellDates: true });
		const sheets = [];
		for (const sheetName of workbook.SheetNames.slice(0, 20)) {
			const sheet = workbook.Sheets[sheetName];
			const reference = sheet?.['!ref'];
			if (!reference) {
				sheets.push({ name: sheetName, rows: [], rowCount: 0, columnCount: 0 });
				continue;
			}
			const decoded = window.XLSX.utils.decode_range(reference);
			const rowCount = Math.max(0, decoded.e.r - decoded.s.r + 1);
			const columnCount = Math.max(0, decoded.e.c - decoded.s.c + 1);
			const range = {
				s: { r: decoded.s.r, c: decoded.s.c },
				e: { r: Math.min(decoded.e.r, decoded.s.r + 499), c: Math.min(decoded.e.c, decoded.s.c + 99) },
			};
			const rows = window.XLSX.utils.sheet_to_json(sheet, {
				header: 1,
				raw: false,
				defval: '',
				blankrows: true,
				range,
			});
			sheets.push({ name: sheetName, rows: trimMatrix(rows), rowCount, columnCount });
		}
		if (!sheets.length) throw new Error('WORKBOOK_EMPTY');
		return { sheets };
	}

	function renderSelectedFile(type) {
		const file = selectedFiles.get(type) ?? null;
		const preview = selectedPreviews.get(type) ?? null;
		const info = byId(`document-${type}-selected`);
		const upload = byId(`document-${type}-upload`);
		const previewButton = byId(`document-${type}-preview`);
		if (!info || !upload) return;
		if (!file) {
			info.textContent = t('noFileSelected', 'ファイル未選択', '선택된 파일 없음');
			upload.disabled = true;
			if (previewButton) previewButton.disabled = true;
			return;
		}
		const previewText = preview
			? ` · ${preview.sheets.length}${t('sheetCount', 'シート', '개 시트')} · ${t('previewReady', 'Webプレビュー準備済み', '웹 미리보기 준비됨')}`
			: ` · ${t('previewParsing', 'プレビュー解析中…', '미리보기 분석 중…')}`;
		info.textContent = `${file.name} · ${formatBytes(file.size)}${previewText}`;
		upload.disabled = !preview;
		if (previewButton) previewButton.disabled = !preview;
	}

	function currentLanguageStatus(document) {
		const ja = document?.current_version_ja_id ? t('registered', '登録済み', '등록 완료') : unregisteredLabel();
		const ko = document?.current_version_ko_id ? t('registered', '登録済み', '등록 완료') : unregisteredLabel();
		return `JA ${ja} · KO ${ko}`;
	}

	function renderDocumentStatus() {
		for (const type of ['skill_sheet', 'career_history']) {
			const document = documents.find((item) => item.document_type === type);
			const badge = byId(`document-${type}-status`);
			if (badge) {
				badge.textContent = currentLanguageStatus(document);
				badge.classList.toggle('is-ready', Boolean(document?.current_version_ja_id || document?.current_version_ko_id));
			}
		}
	}

	function previewMeta(sheet) {
		const shownRows = Array.isArray(sheet.rows) ? sheet.rows.length : 0;
		const shownColumns = Array.isArray(sheet.rows)
			? sheet.rows.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0)
			: 0;
		const truncated = Number(sheet.rowCount) > shownRows || Number(sheet.columnCount) > shownColumns;
		return `${Number(sheet.rowCount) || shownRows} rows × ${Number(sheet.columnCount) || shownColumns} cols${truncated ? ` · ${t('previewTruncated', 'Web表示は最大500行×100列', '웹 표시는 최대 500행×100열')}` : ''}`;
	}

	function renderPreviewTable(container, sheet) {
		container.replaceChildren();
		const table = document.createElement('table');
		table.className = 'admin-document-preview-table';
		const rows = Array.isArray(sheet?.rows) ? sheet.rows : [];
		if (!rows.length) {
			const empty = document.createElement('p');
			empty.className = 'admin-record-empty';
			empty.textContent = t('previewEmptySheet', 'このシートには表示できるセルがありません。', '이 시트에는 표시할 셀이 없습니다.');
			container.appendChild(empty);
			return;
		}
		for (const row of rows) {
			const tr = document.createElement('tr');
			for (const cell of Array.isArray(row) ? row : []) {
				const td = document.createElement('td');
				td.textContent = cell == null ? '' : String(cell);
				tr.appendChild(td);
			}
			table.appendChild(tr);
		}
		container.appendChild(table);
	}

	function openPreviewDialog(payload, titleText) {
		const sheets = Array.isArray(payload?.sheets) ? payload.sheets : [];
		if (!sheets.length) return;
		const backdrop = document.createElement('div');
		backdrop.className = 'admin-document-preview-backdrop';
		const dialog = document.createElement('section');
		dialog.className = 'admin-document-preview-dialog';
		dialog.setAttribute('role', 'dialog');
		dialog.setAttribute('aria-modal', 'true');
		const header = document.createElement('div');
		header.className = 'admin-document-preview-header';
		const title = document.createElement('div');
		const strong = document.createElement('strong'); strong.textContent = titleText;
		const small = document.createElement('small');
		const close = document.createElement('button');
		close.type = 'button'; close.className = 'admin-document-preview-close'; close.textContent = '×';
		close.setAttribute('aria-label', t('closePreview', 'プレビューを閉じる', '미리보기 닫기'));
		title.append(strong, small); header.append(title, close);
		const tabs = document.createElement('div'); tabs.className = 'admin-document-preview-tabs';
		const scroll = document.createElement('div'); scroll.className = 'admin-document-preview-scroll';
		let active = 0;

		function renderActive() {
			const sheet = sheets[active];
			small.textContent = `${sheet.name} · ${previewMeta(sheet)}`;
			tabs.querySelectorAll('button').forEach((button, index) => button.classList.toggle('is-active', index === active));
			renderPreviewTable(scroll, sheet);
		}
		sheets.forEach((sheet, index) => {
			const tab = document.createElement('button');
			tab.type = 'button'; tab.className = 'admin-document-preview-tab'; tab.textContent = sheet.name || `Sheet ${index + 1}`;
			tab.addEventListener('click', () => { active = index; renderActive(); });
			tabs.appendChild(tab);
		});
		dialog.append(header, tabs, scroll); backdrop.appendChild(dialog); document.body.appendChild(backdrop);
		document.body.classList.add('admin-modal-open');
		function finish() { backdrop.remove(); document.body.classList.remove('admin-modal-open'); document.removeEventListener('keydown', keydown); }
		function keydown(event) { if (event.key === 'Escape') finish(); }
		close.addEventListener('click', finish);
		backdrop.addEventListener('click', (event) => { if (event.target === backdrop) finish(); });
		document.addEventListener('keydown', keydown);
		renderActive();
	}

	async function openSavedPreview(version) {
		try {
			const response = await fetch(`/api/admin/documents/preview?versionId=${encodeURIComponent(version.id)}`, { credentials: 'same-origin', cache: 'no-store' });
			if (response.status === 401) { window.location.replace('/admin/login/'); return; }
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok || !Array.isArray(result.sheets) || !result.sheets.length) throw new Error(result?.error || 'PREVIEW_NOT_FOUND');
			openPreviewDialog(result, `${documentName(version.document_type)} · v${version.version_no} · ${String(version.language ?? '').toUpperCase()}`);
		} catch (error) {
			console.error('Failed to open saved document preview', error);
			await window.AdminCommon?.alert?.({
				titleFallback: t('previewFailedTitle', 'プレビューエラー', '미리보기 오류'),
				messageFallback: t('previewFailed', 'Webプレビューを読み込めませんでした。', '웹 미리보기를 불러오지 못했습니다.'),
			});
		}
	}

	function renderVersions() {
		const body = byId('document-version-body');
		const empty = byId('document-version-empty');
		if (!body || !empty) return;
		body.replaceChildren();
		if (!versions.length) {
			empty.hidden = false;
			return;
		}
		empty.hidden = true;
		for (const version of versions) {
			const row = document.createElement('tr');
			const values = [
				documentName(version.document_type),
				String(version.language ?? 'ja').toUpperCase(),
				`v${version.version_no}${Number(version.is_current) === 1 ? ' · CURRENT' : ''}`,
				`${version.original_file_name ?? '—'}\n${formatBytes(version.original_file_size)}`,
				conversionLabel(version.conversion_status),
				String(version.preview_page_count ?? 0),
				formatDate(version.created_at),
			];
			values.forEach((value, index) => {
				const cell = document.createElement('td');
				if (index === 3) {
					const [name, size] = value.split('\n');
					const strong = document.createElement('strong'); strong.textContent = name;
					const small = document.createElement('small'); small.textContent = size;
					cell.append(strong, small);
				} else if (index === 4) {
					const status = document.createElement('span');
					status.className = `admin-record-status is-${version.conversion_status ?? 'queued'}`;
					status.textContent = value;
					cell.appendChild(status);
				} else cell.textContent = value;
				row.appendChild(cell);
			});
			const action = document.createElement('td');
			if (Number(version.preview_page_count) > 0) {
				const button = document.createElement('button');
				button.type = 'button'; button.className = 'admin-record-secondary';
				button.textContent = t('preview', 'Preview', '미리보기');
				button.addEventListener('click', () => openSavedPreview(version));
				action.appendChild(button);
			} else action.textContent = '—';
			row.appendChild(action);
			body.appendChild(row);
		}
	}

	async function loadDocuments() {
		try {
			const response = await fetch('/api/admin/documents', { credentials: 'same-origin', cache: 'no-store' });
			if (response.status === 401) { window.location.replace('/admin/login/'); return; }
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error || 'DOCUMENT_LIST_FAILED');
			documents = Array.isArray(result.documents) ? result.documents : [];
			versions = Array.isArray(result.versions) ? result.versions : [];
			renderDocumentStatus();
			renderVersions();
		} catch (error) {
			console.error('Failed to load protected documents', error);
			const empty = byId('document-version-empty');
			if (empty) {
				empty.hidden = false;
				empty.textContent = t('loadFailed', 'ドキュメント情報を読み込めませんでした。', '문서 정보를 불러오지 못했습니다.');
			}
		}
	}

	async function uploadDocument(type) {
		const file = selectedFiles.get(type);
		const preview = selectedPreviews.get(type);
		const languageSelect = byId(`document-${type}-language`);
		const upload = byId(`document-${type}-upload`);
		if (!file || !preview || !(languageSelect instanceof HTMLSelectElement) || !(upload instanceof HTMLButtonElement)) return;

		setMessage(type, '');
		upload.disabled = true;
		upload.textContent = t('uploading', 'アップロード中…', '업로드 중…');
		const form = new FormData();
		form.set('documentType', type);
		form.set('language', languageSelect.value);
		form.set('file', file);
		form.set('previewJson', JSON.stringify(preview));

		try {
			const response = await fetch('/api/admin/documents', { method: 'POST', credentials: 'same-origin', body: form });
			if (response.status === 401) { window.location.replace('/admin/login/'); return; }
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error || 'UPLOAD_FAILED');
			selectedFiles.delete(type);
			selectedPreviews.delete(type);
			const input = byId(`document-${type}-file`);
			if (input instanceof HTMLInputElement) input.value = '';
			renderSelectedFile(type);
			setMessage(type, t('uploadSuccess', '登録しました。Webプレビューも利用できます。', '등록했습니다. 웹 미리보기도 바로 사용할 수 있습니다.'));
			await loadDocuments();
		} catch (error) {
			console.error('Failed to upload protected document', error);
			const code = String(error?.message || '');
			const message = code === 'XLSX_REQUIRED'
				? t('xlsxOnly', '.xlsxファイルを選択してください。', '.xlsx 파일만 선택해 주세요.')
				: code === 'FILE_TOO_LARGE'
					? t('fileTooLarge', 'ファイルは20MB以下にしてください。', '파일은 20MB 이하로 등록해 주세요.')
					: code === 'INVALID_PREVIEW_DATA'
						? t('previewTooLarge', 'Webプレビューデータが大きすぎます。不要なシートや範囲を減らしてください。', '웹 미리보기 데이터가 너무 큽니다. 불필요한 시트나 범위를 줄여 주세요.')
						: t('uploadFailed', 'ファイル登録に失敗しました。', '파일 등록에 실패했습니다.');
			setMessage(type, message, true);
		} finally {
			upload.textContent = t('registerFile', '登録する', '파일 등록');
			renderSelectedFile(type);
		}
	}

	function ensureLocalPreviewButton(type) {
		let preview = byId(`document-${type}-preview`);
		if (preview) return preview;
		const upload = byId(`document-${type}-upload`);
		if (!upload?.parentElement) return null;
		preview = document.createElement('button');
		preview.id = `document-${type}-preview`;
		preview.className = 'admin-record-secondary';
		preview.type = 'button';
		preview.textContent = t('preview', 'Preview', '미리보기');
		preview.disabled = true;
		preview.addEventListener('click', () => {
			const data = selectedPreviews.get(type);
			const file = selectedFiles.get(type);
			if (data) openPreviewDialog(data, file?.name ?? documentName(type));
		});
		upload.parentElement.insertBefore(preview, upload);
		return preview;
	}

	function bindDocumentCard(type) {
		const choose = byId(`document-${type}-choose`);
		const input = byId(`document-${type}-file`);
		const upload = byId(`document-${type}-upload`);
		ensureLocalPreviewButton(type);
		choose?.addEventListener('click', () => input?.click());
		input?.addEventListener('change', async () => {
			if (!(input instanceof HTMLInputElement)) return;
			const file = input.files?.[0] ?? null;
			selectedPreviews.delete(type);
			if (file) selectedFiles.set(type, file); else selectedFiles.delete(type);
			setMessage(type, '');
			renderSelectedFile(type);
			if (!file) return;
			try {
				const preview = await parseWorkbook(file);
				if (selectedFiles.get(type) !== file) return;
				selectedPreviews.set(type, preview);
				setMessage(type, t('previewParsed', 'Excel内容を解析しました。登録前にPreviewで確認できます。', 'Excel 내용을 분석했습니다. 등록 전에 미리보기로 확인할 수 있습니다.'));
			} catch (error) {
				console.error('Failed to parse Excel preview', error);
				if (selectedFiles.get(type) !== file) return;
				selectedPreviews.delete(type);
				setMessage(type, t('previewParseFailed', 'Excelの読み取りに失敗しました。通常の.xlsxファイルか確認してください。', 'Excel 읽기에 실패했습니다. 일반 .xlsx 파일인지 확인해 주세요.'), true);
			}
			renderSelectedFile(type);
		});
		upload?.addEventListener('click', () => uploadDocument(type));
		renderSelectedFile(type);
	}

	async function initialize() {
		await window.AdminCommon?.ready;
		bindDocumentCard('skill_sheet');
		bindDocumentCard('career_history');
		document.addEventListener('adminlanguagechange', () => {
			for (const type of ['skill_sheet', 'career_history']) {
				const preview = byId(`document-${type}-preview`);
				if (preview) preview.textContent = t('preview', 'Preview', '미리보기');
				renderSelectedFile(type);
			}
			renderDocumentStatus();
			renderVersions();
		});
		await loadDocuments();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
