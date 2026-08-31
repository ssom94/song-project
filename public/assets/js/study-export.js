(() => {
	const language = document.body.dataset.blogLanguage === 'ja' ? 'ja' : 'ko';
	const message = language === 'ja'
		? { login: 'Excel出力は管理者ログイン後に利用できます。', failed: 'Excelファイルを作成できませんでした。', empty: '0件でも見出し付きのExcelを出力しました。' }
		: { login: 'Excel 추출은 관리자 로그인 후 사용할 수 있습니다.', failed: 'Excel 파일을 만들지 못했습니다.', empty: '0건이어도 헤더가 포함된 Excel을 추출했습니다.' };

	function filenameFromDisposition(value) {
		if (!value) return 'song-study.xlsx';
		const match = value.match(/filename="?([^";]+)"?/i);
		return match?.[1] || 'song-study.xlsx';
	}

	function applyQueryDefaults() {
		const params = new URLSearchParams(window.location.search);
		const source = params.get('source');
		const filter = params.get('filter');
		const sourceSelect = document.getElementById('study-export-source');
		const filterSelect = document.getElementById('study-export-filter');
		if (sourceSelect && ['all', 'jlpt', 'ap'].includes(source || '')) sourceSelect.value = source;
		if (filterSelect && ['all', 'wrong', 'uncertain', 'unlearned', 'mastered', 'due'].includes(filter || '')) filterSelect.value = filter;
	}

	async function download(event) {
		const button = event.currentTarget;
		const sourceTarget = button.dataset.exportSourceTarget;
		const sourceElement = sourceTarget ? document.getElementById(sourceTarget) : null;
		const source = sourceElement?.value || button.dataset.exportSource || 'all';
		const filterTarget = button.dataset.exportFilterTarget;
		const filterElement = filterTarget ? document.getElementById(filterTarget) : null;
		const filter = filterElement?.value || button.dataset.exportFilter || 'all';
		button.disabled = true;
		try {
			const params = new URLSearchParams({ source, filter });
			const response = await fetch(`/api/admin/study/export.xlsx?${params.toString()}`, {
				credentials: 'same-origin',
				cache: 'no-store',
			});
			if (response.status === 401) {
				window.alert(message.login);
				return;
			}
			if (!response.ok) throw new Error(`HTTP_${response.status}`);
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = filenameFromDisposition(response.headers.get('Content-Disposition'));
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(url);
			if (response.headers.get('X-Export-Rows') === '0') console.info(message.empty);
		} catch (error) {
			console.error('Failed to export study XLSX', error);
			window.alert(message.failed);
		} finally {
			button.disabled = false;
		}
	}

	applyQueryDefaults();
	document.querySelectorAll('[data-study-export]').forEach((button) => button.addEventListener('click', download));
})();
