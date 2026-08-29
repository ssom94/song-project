(() => {
	function t(key, fallback) {
		const value = window.AdminI18n?.t(key);
		return value && value !== key ? value : fallback;
	}

	function currentLanguage() {
		return window.AdminI18n?.getLanguage?.() ?? 'ja';
	}

	function categoryLabel(category) {
		return currentLanguage() === 'ko'
			? (category.name_ko ?? category.name_ja ?? '')
			: (category.name_ja ?? category.name_ko ?? '');
	}

	async function loadSetupData() {
		const count = document.getElementById('quiz-available-count');
		const categorySelect = document.getElementById('quiz-category');
		try {
			const [wordsResponse, categoriesResponse] = await Promise.all([
				fetch('/api/admin/japanese/words', { credentials: 'same-origin', cache: 'no-store' }),
				fetch('/api/admin/japanese/categories', { credentials: 'same-origin', cache: 'no-store' }),
			]);
			if (wordsResponse.status === 401 || categoriesResponse.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			const wordsResult = await wordsResponse.json().catch(() => null);
			const categoriesResult = await categoriesResponse.json().catch(() => null);
			if (count && wordsResponse.ok && wordsResult?.ok && Array.isArray(wordsResult.words)) {
				count.textContent = `${wordsResult.words.length}`;
				count.title = t('quizAvailableWords', '利用可能な単語数');
			}
			if (categorySelect && categoriesResponse.ok && categoriesResult?.ok && Array.isArray(categoriesResult.categories)) {
				const current = categorySelect.value;
				const first = categorySelect.querySelector('option[value=""]');
				categorySelect.replaceChildren(first ?? new Option(t('quizAllCategories', 'すべて'), ''));
				for (const category of categoriesResult.categories) {
					const option = document.createElement('option');
					option.value = String(category.id);
					option.textContent = categoryLabel(category);
					categorySelect.appendChild(option);
				}
				categorySelect.value = current;
			}
		} catch (error) {
			console.error('Failed to load quiz setup data', error);
			if (count) count.textContent = '—';
		}
	}

	async function showComingSoon() {
		if (window.AdminCommon?.alert) {
			await window.AdminCommon.alert({
				titleKey: 'quizComingSoonTitle',
				messageKey: 'quizComingSoonMessage',
				titleFallback: t('quizComingSoonTitle', 'クイズ画面を準備中'),
				messageFallback: t('quizComingSoonMessage', '画面構成の確定後にランダム出題と成績保存を接続します。'),
			});
		}
	}

	async function initialize() {
		await window.AdminCommon?.ready;
		document.getElementById('quiz-start')?.addEventListener('click', showComingSoon);
		document.addEventListener('adminlanguagechange', loadSetupData);
		await loadSetupData();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
