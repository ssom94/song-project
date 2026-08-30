(() => {
	function sync() {
		const korean = window.AdminI18n?.getLanguage?.() === 'ko';
		const title = document.getElementById('admin-schedule-page-title');
		const description = document.getElementById('admin-schedule-page-description');
		if (title) title.textContent = korean ? '일정관리' : '予定管理';
		if (description) description.textContent = korean
			? '공개 홈과 공통으로 사용하는 일정·D-Day를 리스트와 월간 달력에서 관리합니다.'
			: '公開ホームと共通で使用する予定・D-Dayを一覧と月間カレンダーで管理します。';
	}

	async function initialize() {
		await window.AdminI18n?.ready;
		sync();
		document.addEventListener('adminlanguagechange', sync);
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
