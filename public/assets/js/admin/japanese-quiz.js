(() => {
	let categories = [];
	let partsOfSpeech = [];

	function t(key, fallback) {
		const value = window.AdminI18n?.t(key);
		return value && value !== key ? value : fallback;
	}

	function currentLanguage() {
		return window.AdminI18n?.getLanguage?.() ?? 'ja';
	}

	function label(row) {
		if (!row) return '';
		return currentLanguage() === 'ko'
			? (row.name_ko ?? row.name_ja ?? '')
			: (row.name_ja ?? row.name_ko ?? '');
	}

	function roots(items) {
		return items.filter((item) => item.parent_id === null || item.parent_id === undefined);
	}

	function children(items, parentId) {
		if (!parentId) return [];
		return items.filter((item) => String(item.parent_id ?? '') === String(parentId));
	}

	function rebuildParent(selectId, items, allKey, fallback) {
		const select = document.getElementById(selectId);
		if (!select) return;
		const current = select.value;
		select.replaceChildren();
		const all = document.createElement('option');
		all.value = '';
		all.textContent = t(allKey, fallback);
		select.appendChild(all);
		for (const item of roots(items)) {
			const option = document.createElement('option');
			option.value = String(item.id);
			option.textContent = label(item);
			select.appendChild(option);
		}
		if ([...select.options].some((option) => option.value === current)) select.value = current;
	}

	function rebuildChild(parentId, childId, items, allKey, fallback) {
		const parent = document.getElementById(parentId);
		const child = document.getElementById(childId);
		if (!parent || !child) return;
		const current = child.value;
		child.replaceChildren();
		const all = document.createElement('option');
		all.value = '';
		all.textContent = t(allKey, fallback);
		child.appendChild(all);
		for (const item of children(items, parent.value)) {
			const option = document.createElement('option');
			option.value = String(item.id);
			option.textContent = label(item);
			child.appendChild(option);
		}
		child.disabled = !parent.value || child.options.length <= 1;
		if ([...child.options].some((option) => option.value === current)) child.value = current;
	}

	function renderHierarchies() {
		rebuildParent('quiz-category-parent', categories, 'quizAllCategories', currentLanguage() === 'ko' ? '전체' : 'すべて');
		rebuildChild('quiz-category-parent', 'quiz-category', categories, 'quizAllSubcategories', currentLanguage() === 'ko' ? '전체' : 'すべて');
		rebuildParent('quiz-pos-parent', partsOfSpeech, 'quizAllParts', currentLanguage() === 'ko' ? '전체' : 'すべて');
		rebuildChild('quiz-pos-parent', 'quiz-pos', partsOfSpeech, 'quizAllSubcategories', currentLanguage() === 'ko' ? '전체' : 'すべて');
	}

	async function loadSetupData() {
		const count = document.getElementById('quiz-available-count');
		try {
			const [wordsResponse, categoriesResponse, partsResponse] = await Promise.all([
				fetch('/api/admin/japanese/words', { credentials: 'same-origin', cache: 'no-store' }),
				fetch('/api/admin/japanese/categories', { credentials: 'same-origin', cache: 'no-store' }),
				fetch('/api/admin/japanese/parts', { credentials: 'same-origin', cache: 'no-store' }),
			]);
			if ([wordsResponse, categoriesResponse, partsResponse].some((response) => response.status === 401)) {
				window.location.replace('/admin/login/');
				return;
			}

			const wordsResult = await wordsResponse.json().catch(() => null);
			const categoriesResult = await categoriesResponse.json().catch(() => null);
			const partsResult = await partsResponse.json().catch(() => null);

			if (count && wordsResponse.ok && wordsResult?.ok && Array.isArray(wordsResult.words)) {
				count.textContent = String(wordsResult.words.length);
			}
			categories = categoriesResponse.ok && categoriesResult?.ok && Array.isArray(categoriesResult.categories)
				? categoriesResult.categories
				: [];
			partsOfSpeech = partsResponse.ok && partsResult?.ok && Array.isArray(partsResult.parts)
				? partsResult.parts
				: [];
			renderHierarchies();
		} catch (error) {
			console.error('Failed to load quiz setup data', error);
			if (count) count.textContent = '—';
		}
	}

	function setQuestionCount(value) {
		const input = document.getElementById('quiz-count-custom');
		const normalized = Math.max(1, Math.min(200, Number(value) || 20));
		if (input) input.value = String(normalized);
		document.querySelectorAll('[data-quiz-count]').forEach((button) => {
			button.classList.toggle('is-active', Number(button.dataset.quizCount) === normalized);
		});
	}

	function collectSetup() {
		return {
			types: [...document.querySelectorAll('input[name="quiz-type"]:checked')].map((input) => input.value),
			categoryParentId: document.getElementById('quiz-category-parent')?.value || null,
			categoryId: document.getElementById('quiz-category')?.value || null,
			partParentId: document.getElementById('quiz-pos-parent')?.value || null,
			partOfSpeechId: document.getElementById('quiz-pos')?.value || null,
			jlpt: document.getElementById('quiz-jlpt')?.value || null,
			order: document.getElementById('quiz-order')?.value || 'random',
			count: Math.max(1, Math.min(200, Number(document.getElementById('quiz-count-custom')?.value) || 20)),
			answerMode: document.querySelector('input[name="quiz-answer-mode"]:checked')?.value || 'input',
		};
	}

	async function saveSetupPreview() {
		const setup = collectSetup();
		if (setup.types.length === 0) {
			if (window.AdminCommon?.alert) {
				await window.AdminCommon.alert({
					titleKey: 'quizTypeRequiredTitle',
					messageKey: 'quizTypeRequiredMessage',
					titleFallback: currentLanguage() === 'ko' ? '문제 유형 선택' : '問題タイプを選択',
					messageFallback: currentLanguage() === 'ko' ? '문제 유형을 하나 이상 선택해 주세요.' : '問題タイプを1つ以上選択してください。',
				});
			}
			return;
		}
		sessionStorage.setItem('song_japanese_quiz_setup', JSON.stringify(setup));
		if (window.AdminCommon?.alert) {
			await window.AdminCommon.alert({
				titleKey: 'quizSetupSavedTitle',
				messageKey: 'quizSetupSavedMessage',
				titleFallback: currentLanguage() === 'ko' ? '퀴즈 설정 준비 완료' : 'クイズ設定を保存しました',
				messageFallback: currentLanguage() === 'ko'
					? '이 설정을 다음 퀴즈 플레이 화면에서 사용합니다.'
					: 'この設定を次のクイズプレイ画面で使用します。',
			});
		}
	}

	async function initialize() {
		await window.AdminCommon?.ready;
		document.getElementById('quiz-category-parent')?.addEventListener('change', () => {
			rebuildChild('quiz-category-parent', 'quiz-category', categories, 'quizAllSubcategories', currentLanguage() === 'ko' ? '전체' : 'すべて');
		});
		document.getElementById('quiz-pos-parent')?.addEventListener('change', () => {
			rebuildChild('quiz-pos-parent', 'quiz-pos', partsOfSpeech, 'quizAllSubcategories', currentLanguage() === 'ko' ? '전체' : 'すべて');
		});
		document.querySelectorAll('[data-quiz-count]').forEach((button) => {
			button.addEventListener('click', () => setQuestionCount(button.dataset.quizCount));
		});
		document.getElementById('quiz-count-custom')?.addEventListener('input', (event) => setQuestionCount(event.target.value));
		document.getElementById('quiz-start')?.addEventListener('click', saveSetupPreview);
		document.addEventListener('adminlanguagechange', renderHierarchies);
		await loadSetupData();
		setQuestionCount(20);
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
