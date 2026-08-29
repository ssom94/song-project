(() => {
	const selectedFiles = new Map();
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

	function conversionLabel(status) {
		const map = {
			queued: t('conversionQueued', '変換待ち', '변환 대기'),
			processing: t('conversionProcessing', '変換中', '변환 중'),
			ready: 'Ready',
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

	function renderSelectedFile(type) {
		const file = selectedFiles.get(type) ?? null;
		const info = byId(`document-${type}-selected`);
		const upload = byId(`document-${type}-upload`);
		if (!info || !upload) return;
		if (!file) {
			info.textContent = t('noFileSelected', 'ファイル未選択', '선택된 파일 없음');
			upload.disabled = true;
			return;
		}
		info.textContent = `${file.name} · ${formatBytes(file.size)}`;
		upload.disabled = false;
	}

	function currentLanguageStatus(document) {
		const ja = document?.current_version_ja_id ? 'Ready' : '—';
		const ko = document?.current_version_ko_id ? 'Ready' : '—';
		return `JA ${ja} · KO ${ko}`;
	}

	function renderDocumentStatus() {
		for (const type of ['skill_sheet', 'career_history']) {
			const document = documents.find((item) => item.document_type === type);
			const badge = byId(`document-${type}-status`);
			if (badge) badge.textContent = currentLanguageStatus(document);
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
				`v${version.version_no}`,
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
				} else {
					cell.textContent = value;
				}
				row.appendChild(cell);
			});
			const action = document.createElement('td');
			if (version.conversion_status === 'ready') {
				const button = document.createElement('button');
				button.type = 'button';
				button.className = 'admin-record-secondary';
				button.textContent = t('preview', 'Preview', '미리보기');
				button.disabled = true;
				button.title = t('previewLater', 'プレビュー公開API接続後に有効になります。', '미리보기 공개 API 연결 후 활성화됩니다.');
				action.appendChild(button);
			} else {
				action.textContent = '—';
			}
			row.appendChild(action);
			body.appendChild(row);
		}
	}

	async function loadDocuments() {
		try {
			const response = await fetch('/api/admin/documents', { credentials: 'same-origin', cache: 'no-store' });
			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error || 'DOCUMENT_LIST_FAILED');
			documents = Array.isArray(result.documents) ? result.documents : [];
			versions = Array.isArray(result.versions) ? result.versions : [];
			renderDocumentStatus();
			renderVersions();
		} catch (error) {
			console.error('Failed to load protected documents', error);
			byId('document-version-empty').hidden = false;
			byId('document-version-empty').textContent = t('loadFailed', 'ドキュメント情報を読み込めませんでした。', '문서 정보를 불러오지 못했습니다.');
		}
	}

	async function uploadDocument(type) {
		const file = selectedFiles.get(type);
		const languageSelect = byId(`document-${type}-language`);
		const upload = byId(`document-${type}-upload`);
		if (!file || !(languageSelect instanceof HTMLSelectElement) || !(upload instanceof HTMLButtonElement)) return;

		setMessage(type, '');
		upload.disabled = true;
		upload.textContent = t('uploading', 'アップロード中…', '업로드 중…');
		const form = new FormData();
		form.set('documentType', type);
		form.set('language', languageSelect.value);
		form.set('file', file);

		try {
			const response = await fetch('/api/admin/documents', {
				method: 'POST',
				credentials: 'same-origin',
				body: form,
			});
			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error || 'UPLOAD_FAILED');
			selectedFiles.delete(type);
			const input = byId(`document-${type}-file`);
			if (input instanceof HTMLInputElement) input.value = '';
			renderSelectedFile(type);
			setMessage(type, t('uploadSuccess', '登録しました。変換待ちです。', '등록했습니다. 현재 변환 대기 상태입니다.'));
			await loadDocuments();
		} catch (error) {
			console.error('Failed to upload protected document', error);
			const code = String(error?.message || '');
			const message = code === 'XLSX_REQUIRED'
				? t('xlsxOnly', '.xlsxファイルを選択してください。', '.xlsx 파일만 선택해 주세요.')
				: code === 'FILE_TOO_LARGE'
					? t('fileTooLarge', 'ファイルは20MB以下にしてください。', '파일은 20MB 이하로 등록해 주세요.')
					: t('uploadFailed', 'ファイル登録に失敗しました。', '파일 등록에 실패했습니다.');
			setMessage(type, message, true);
		} finally {
			upload.textContent = t('registerFile', '登録する', '파일 등록');
			upload.disabled = !selectedFiles.has(type);
		}
	}

	function bindDocumentCard(type) {
		const choose = byId(`document-${type}-choose`);
		const input = byId(`document-${type}-file`);
		const upload = byId(`document-${type}-upload`);
		choose?.addEventListener('click', () => input?.click());
		input?.addEventListener('change', () => {
			if (!(input instanceof HTMLInputElement)) return;
			const file = input.files?.[0] ?? null;
			if (file) selectedFiles.set(type, file);
			else selectedFiles.delete(type);
			setMessage(type, '');
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
			renderSelectedFile('skill_sheet');
			renderSelectedFile('career_history');
			renderDocumentStatus();
			renderVersions();
		});
		await loadDocuments();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
