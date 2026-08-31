(() => {
	if (window.__songJapaneseImportProvenanceInstalled) return;
	window.__songJapaneseImportProvenanceInstalled = true;
	const nativeFetch = window.fetch.bind(window);
	const FILE_KEY = 'song_japanese_excel_import_filename';

	function currentLanguage() {
		return window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja';
	}

	function selectedFileName() {
		const fileInput = document.getElementById('japanese-excel-file');
		return fileInput instanceof HTMLInputElement ? fileInput.files?.[0]?.name?.trim() || '' : '';
	}

	function rememberFileName(name) {
		if (!name) return;
		try { sessionStorage.setItem(FILE_KEY, name); } catch { /* optional */ }
	}

	function decorateResult() {
		const wrap = document.getElementById('japanese-excel-import-result');
		if (!(wrap instanceof HTMLElement) || wrap.hidden || wrap.querySelector('[data-import-source-file]')) return;
		let name = '';
		try { name = sessionStorage.getItem(FILE_KEY) || ''; } catch { /* optional */ }
		if (!name) return;
		const line = document.createElement('div');
		line.dataset.importSourceFile = 'true';
		line.className = 'admin-japanese-import-source-file';
		line.textContent = currentLanguage() === 'ko' ? `등록 파일: ${name}` : `登録ファイル: ${name}`;
		wrap.prepend(line);
	}

	window.fetch = (input, init = {}) => {
		try {
			const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input || '');
			const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
			if (method === 'POST' && url.includes('/api/admin/japanese/words/import') && typeof init?.body === 'string') {
				const fileName = selectedFileName();
				if (fileName) {
					rememberFileName(fileName);
					const payload = JSON.parse(init.body);
					if (payload && typeof payload === 'object' && !Array.isArray(payload) && !payload.fileName) {
						init = { ...init, body: JSON.stringify({ ...payload, fileName }) };
					}
				}
			}
		} catch (error) {
			console.warn('Failed to attach Japanese import filename', error);
		}
		return nativeFetch(input, init);
	};

	const observer = new MutationObserver(decorateResult);
	observer.observe(document.documentElement, { childList: true, subtree: true });
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', decorateResult, { once: true });
	else decorateResult();
	document.addEventListener('adminlanguagechange', () => {
		const line = document.querySelector('[data-import-source-file]');
		if (line) line.remove();
		decorateResult();
	});
})();
