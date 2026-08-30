(() => {
	if (window.__songJapaneseImportProvenanceInstalled) return;
	window.__songJapaneseImportProvenanceInstalled = true;
	const nativeFetch = window.fetch.bind(window);

	window.fetch = (input, init = {}) => {
		try {
			const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input || '');
			const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
			if (method === 'POST' && url.includes('/api/admin/japanese/words/import') && typeof init?.body === 'string') {
				const fileInput = document.getElementById('japanese-excel-file');
				const fileName = fileInput instanceof HTMLInputElement ? fileInput.files?.[0]?.name?.trim() : '';
				if (fileName) {
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
})();
