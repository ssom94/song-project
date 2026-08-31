(() => {
	function language() {
		return window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja';
	}

	function message() {
		return language() === 'ko'
			? '기존 카테고리는 정상 표시됩니다. 아이콘·색상 저장은 Remote D1에 0040 migration을 적용한 뒤 사용할 수 있습니다.'
			: '既存カテゴリーはそのまま表示されます。アイコン・色の保存は Remote D1 に 0040 migration を適用すると利用できます。';
	}

	function showNotice() {
		let notice = document.getElementById('category-appearance-schema-notice');
		if (!notice) {
			notice = document.createElement('div');
			notice.id = 'category-appearance-schema-notice';
			notice.className = 'admin-category-schema-notice';
			const heading = document.querySelector('.admin-page-heading');
			heading?.insertAdjacentElement('afterend', notice);
		}
		if (notice) notice.textContent = message();
	}

	async function check() {
		try {
			const response = await fetch('/api/admin/categories', { credentials: 'same-origin', cache: 'no-store' });
			if (response.status === 401) return;
			const result = await response.json().catch(() => null);
			if (response.ok && result?.ok && result.appearanceSupported === false) showNotice();
		} catch {
			// The main category screen owns generic load errors.
		}
	}

	async function initialize() {
		await window.AdminCommon?.ready;
		await window.AdminI18n?.ready;
		document.addEventListener('adminlanguagechange', () => {
			const notice = document.getElementById('category-appearance-schema-notice');
			if (notice) notice.textContent = message();
		});
		await check();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
