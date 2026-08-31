(() => {
	let schemaReady = true;

	function language() {
		return window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja';
	}

	function migrationMessage() {
		return language() === 'ko'
			? '사이트 디자인 DB가 아직 준비되지 않았습니다. Remote D1에 0040, 0041 migration을 적용한 뒤 저장할 수 있습니다.'
			: 'サイトデザイン用DBがまだ準備されていません。Remote D1 に 0040・0041 migration を適用すると保存できます。';
	}

	function showMessage() {
		const status = document.getElementById('site-design-status');
		if (!status) return;
		status.hidden = false;
		status.dataset.type = 'error';
		status.dataset.siteDesignMigrationNotice = 'true';
		status.textContent = migrationMessage();
	}

	function syncControls() {
		const save = document.getElementById('site-design-save');
		const file = document.getElementById('site-background-file');
		if (save instanceof HTMLButtonElement) save.disabled = !schemaReady;
		if (file instanceof HTMLInputElement) file.disabled = !schemaReady;
		if (!schemaReady) showMessage();
	}

	async function checkSchema() {
		try {
			const response = await fetch('/api/admin/site-visuals', { credentials: 'same-origin', cache: 'no-store' });
			if (response.status === 401) return;
			const result = await response.json().catch(() => null);
			schemaReady = response.ok && result?.ok === true && result?.schemaReady !== false;
		} catch {
			// Keep the existing site-design error handling for genuine network failures.
			return;
		}
		syncControls();
	}

	function blockUnavailableSave(event) {
		if (schemaReady) return;
		const target = event.target instanceof Element ? event.target.closest('#site-design-save, #site-background-file') : null;
		if (!target) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		showMessage();
	}

	async function initialize() {
		await window.AdminCommon?.ready;
		await window.AdminI18n?.ready;
		document.addEventListener('click', blockUnavailableSave, true);
		document.addEventListener('change', blockUnavailableSave, true);
		document.addEventListener('adminlanguagechange', () => {
			if (!schemaReady) showMessage();
		});
		await checkSchema();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
