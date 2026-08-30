(() => {
	let payload = null;
	let currentType = new URLSearchParams(window.location.search).get('type') || 'skill_sheet';
	let currentSheet = 0;
	let zoom = 1;

	function language() {
		return new URLSearchParams(window.location.search).get('lang') === 'ko' ? 'ko' : 'ja';
	}

	function copy() {
		return language() === 'ko'
			? {
				sheets: '시트', skill: '스킬시트', career: '직무경력서', unregistered: '미등록 상태',
				unregisteredHint: '아직 Excel 파일이 등록되지 않았습니다.', download: 'Excel 원본',
				loadFailed: '문서를 불러오지 못했습니다.', session: '접근 코드가 필요합니다.',
				previewLimit: '웹 미리보기는 최대 500행 × 100열까지 표시합니다.',
			}
			: {
				sheets: 'Sheets', skill: 'スキルシート', career: '職務経歴書', unregistered: '未登録',
				unregisteredHint: 'Excelファイルはまだ登録されていません。', download: 'Excel原本',
				loadFailed: 'ドキュメントを読み込めませんでした。', session: 'アクセスコードが必要です。',
				previewLimit: 'Webプレビューは最大500行 × 100列まで表示します。',
			};
	}

	function byId(id) { return document.getElementById(id); }

	function formatBytes(value) {
		const bytes = Number(value) || 0;
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function updateUrl() {
		const url = new URL(window.location.href);
		url.searchParams.set('lang', language());
		url.searchParams.set('type', currentType);
		window.history.replaceState(null, '', url);
	}

	function renderDocumentTabs(access) {
		const tabs = byId('protected-viewer-doc-tabs');
		if (!tabs) return;
		tabs.replaceChildren();
		const labels = copy();
		const options = [];
		if (access?.allowSkillSheet) options.push(['skill_sheet', labels.skill]);
		if (access?.allowCareerHistory) options.push(['career_history', labels.career]);
		for (const [type, label] of options) {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = `protected-viewer-doc-tab${type === currentType ? ' is-active' : ''}`;
			button.textContent = label;
			button.addEventListener('click', () => {
				if (type === currentType) return;
				currentType = type;
				currentSheet = 0;
				zoom = 1;
				updateUrl();
				load();
			});
			tabs.appendChild(button);
		}
	}

	function renderSidebar() {
		const sidebar = byId('protected-viewer-sheet-list');
		if (!sidebar) return;
		sidebar.replaceChildren();
		const sheets = payload?.document?.sheets ?? [];
		for (const [index, sheet] of sheets.entries()) {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = `protected-viewer-thumb${index === currentSheet ? ' is-active' : ''}`;
			const preview = document.createElement('span');
			preview.className = 'protected-viewer-thumb-preview';
			preview.textContent = `#${index + 1}`;
			const label = document.createElement('span');
			label.textContent = sheet.name || `Sheet ${index + 1}`;
			button.append(preview, label);
			button.addEventListener('click', () => { currentSheet = index; render(); });
			sidebar.appendChild(button);
		}
	}

	function renderTable(sheet) {
		const page = byId('protected-viewer-page');
		if (!page) return;
		page.replaceChildren();
		page.style.setProperty('--viewer-zoom', String(zoom));
		const rows = Array.isArray(sheet?.rows) ? sheet.rows : [];
		if (!rows.length) {
			const empty = document.createElement('p');
			empty.className = 'protected-viewer-empty';
			empty.textContent = language() === 'ko' ? '표시할 셀이 없습니다.' : '表示できるセルがありません。';
			page.appendChild(empty);
			return;
		}
		const table = document.createElement('table');
		table.className = 'protected-viewer-table';
		for (const row of rows) {
			const tr = document.createElement('tr');
			for (const cell of Array.isArray(row) ? row : []) {
				const td = document.createElement('td');
				td.textContent = cell == null ? '' : String(cell);
				tr.appendChild(td);
			}
			table.appendChild(tr);
		}
		page.appendChild(table);
	}

	function renderUnregistered() {
		const labels = copy();
		const title = byId('protected-viewer-title');
		const meta = byId('protected-viewer-meta');
		const page = byId('protected-viewer-page');
		const download = byId('protected-viewer-download');
		if (title) title.textContent = `${payload?.document?.title ?? ''} · ${labels.unregistered}`;
		if (meta) meta.textContent = labels.unregisteredHint;
		if (download) download.hidden = true;
		byId('protected-viewer-sheet-list')?.replaceChildren();
		if (page) {
			page.replaceChildren();
			const box = document.createElement('div');
			box.className = 'protected-viewer-unregistered';
			const strong = document.createElement('strong'); strong.textContent = labels.unregistered;
			const p = document.createElement('p'); p.textContent = labels.unregisteredHint;
			box.append(strong, p); page.appendChild(box);
		}
	}

	function render() {
		if (!payload?.document) return;
		renderDocumentTabs(payload.access);
		if (!payload.document.registered) { renderUnregistered(); return; }
		const sheets = payload.document.sheets ?? [];
		currentSheet = Math.min(Math.max(0, currentSheet), Math.max(0, sheets.length - 1));
		const sheet = sheets[currentSheet];
		const title = byId('protected-viewer-title');
		const meta = byId('protected-viewer-meta');
		const zoomLabel = byId('protected-viewer-zoom-label');
		const download = byId('protected-viewer-download');
		if (title) title.textContent = `${payload.document.title} · v${payload.document.versionNo} · ${currentSheet + 1} / ${sheets.length}`;
		if (meta) {
			const rows = Number(sheet?.rowCount) || 0;
			const cols = Number(sheet?.columnCount) || 0;
			meta.textContent = `${payload.document.fileName} · ${formatBytes(payload.document.fileSize)} · ${sheet?.name ?? ''} · ${rows}×${cols}`;
		}
		if (zoomLabel) zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
		if (download instanceof HTMLAnchorElement) {
			download.hidden = false;
			download.textContent = copy().download;
			download.href = `/api/protected/document/download?type=${encodeURIComponent(currentType)}`;
		}
		renderSidebar();
		renderTable(sheet);
	}

	async function load() {
		const page = byId('protected-viewer-page');
		if (page) page.textContent = language() === 'ko' ? '문서를 불러오는 중…' : 'ドキュメントを読み込んでいます…';
		try {
			let response = await fetch(`/api/protected/document?type=${encodeURIComponent(currentType)}&lang=${language()}`, { credentials: 'same-origin', cache: 'no-store' });
			if (response.status === 401) {
				window.location.replace(`/protected/?lang=${language()}`);
				return;
			}
			if (response.status === 403 && currentType === 'skill_sheet') {
				currentType = 'career_history';
				updateUrl();
				response = await fetch(`/api/protected/document?type=career_history&lang=${language()}`, { credentials: 'same-origin', cache: 'no-store' });
			}
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error || 'LOAD_FAILED');
			payload = result;
			render();
		} catch (error) {
			console.error('Failed to load protected viewer', error);
			if (page) page.innerHTML = `<div class="protected-viewer-unregistered"><strong>${copy().loadFailed}</strong><p>${copy().session}</p></div>`;
		}
	}

	function bindZoom() {
		byId('protected-viewer-zoom-out')?.addEventListener('click', () => { zoom = Math.max(.6, Math.round((zoom - .1) * 10) / 10); render(); });
		byId('protected-viewer-zoom-in')?.addEventListener('click', () => { zoom = Math.min(1.8, Math.round((zoom + .1) * 10) / 10); render(); });
		byId('protected-viewer-zoom-label')?.addEventListener('click', () => { zoom = 1; render(); });
	}

	function initialize() {
		byId('protected-viewer-sheet-heading').textContent = copy().sheets;
		bindZoom();
		load();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
