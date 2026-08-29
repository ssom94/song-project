(() => {
	const STORAGE_KEY = 'song_admin_language';
	const DEFAULT_LANGUAGE = 'ja';
	const SUPPORTED_LANGUAGES = new Set(['ja', 'ko']);

	const translations = {
		ja: {
			loading: 'セッションを確認しています…',
			brandHomeLabel: 'Song Project ホームへ',
			languageLabel: '表示言語',
			management: '管理',
			navLabel: '管理メニュー',
			dashboard: 'ダッシュボード',
			posts: '投稿管理',
			comments: 'コメント管理',
			categoriesTags: 'カテゴリー・タグ',
			japaneseLearning: '日本語学習',
			protectedDocuments: 'スキル・職務経歴書',
			accessCodes: 'アクセスコード',
			viewSite: 'サイトを表示',
			dashboardDescription: 'ブログと各モジュールをここから管理します。',
			postsDescription: '記事の作成・編集・翻訳・公開状態を管理します。',
			commentsDescription: '公開コメント、返信、非表示・スパム状態を管理します。',
			japaneseDescription: '単語、例文、JLPT分類、AIレビューを管理します。',
			protectedDocumentsDescription: 'Excelのバージョンと公開中のドキュメントを管理します。',
			accessCodesDescription: '保護ページ用コードの発行・期限・失効を管理します。',
			auditHistory: '監査・履歴',
			auditHistoryDescription: '今後、変更履歴や管理操作を確認できるようにします。',
			logout: 'ログアウト',
			logoutLoading: 'ログアウト中…',
		},
		ko: {
			loading: '세션을 확인하고 있습니다…',
			brandHomeLabel: 'Song Project 홈으로',
			languageLabel: '표시 언어',
			management: '관리',
			navLabel: '관리 메뉴',
			dashboard: '대시보드',
			posts: '게시글 관리',
			comments: '댓글 관리',
			categoriesTags: '카테고리·태그',
			japaneseLearning: '일본어 학습',
			protectedDocuments: '스킬시트·직무경력서',
			accessCodes: '접근 코드',
			viewSite: '사이트 보기',
			dashboardDescription: '블로그와 각 모듈을 여기에서 관리합니다.',
			postsDescription: '게시글 작성·편집·번역·공개 상태를 관리합니다.',
			commentsDescription: '공개 댓글, 답글, 숨김·스팸 상태를 관리합니다.',
			japaneseDescription: '단어, 예문, JLPT 분류, AI 리뷰를 관리합니다.',
			protectedDocumentsDescription: 'Excel 버전과 현재 공개 중인 문서를 관리합니다.',
			accessCodesDescription: '보호 페이지용 코드의 발급·기한·폐기를 관리합니다.',
			auditHistory: '감사·이력',
			auditHistoryDescription: '변경 이력과 관리자 작업 기록을 확인할 수 있도록 준비합니다.',
			logout: '로그아웃',
			logoutLoading: '로그아웃 중…',
		},
	};

	function normalizeLanguage(language) {
		return SUPPORTED_LANGUAGES.has(language) ? language : DEFAULT_LANGUAGE;
	}

	function readStoredLanguage() {
		try {
			return normalizeLanguage(localStorage.getItem(STORAGE_KEY));
		} catch {
			return DEFAULT_LANGUAGE;
		}
	}

	function storeLanguage(language) {
		try {
			localStorage.setItem(STORAGE_KEY, language);
		} catch {
			// The language switch still works for the current page if storage is unavailable.
		}
	}

	let currentLanguage = readStoredLanguage();

	function t(key) {
		return translations[currentLanguage]?.[key] ?? translations[DEFAULT_LANGUAGE]?.[key] ?? key;
	}

	function applyLanguage(language, { persist = true } = {}) {
		currentLanguage = normalizeLanguage(language);

		if (persist) {
			storeLanguage(currentLanguage);
		}

		document.documentElement.lang = currentLanguage;

		document.querySelectorAll('[data-i18n]').forEach((element) => {
			const key = element.dataset.i18n;
			if (key) element.textContent = t(key);
		});

		document.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
			const key = element.dataset.i18nAriaLabel;
			if (key) element.setAttribute('aria-label', t(key));
		});

		document.querySelectorAll('[data-admin-lang]').forEach((button) => {
			const active = button.dataset.adminLang === currentLanguage;
			button.classList.toggle('is-active', active);
			button.setAttribute('aria-pressed', String(active));
		});

		document.dispatchEvent(new CustomEvent('adminlanguagechange', {
			detail: { language: currentLanguage },
		}));
	}

	function initializeLanguageSwitch() {
		document.querySelectorAll('[data-admin-lang]').forEach((button) => {
			button.addEventListener('click', () => {
				applyLanguage(button.dataset.adminLang);
			});
		});

		applyLanguage(currentLanguage, { persist: false });
	}

	window.AdminI18n = {
		applyLanguage,
		getLanguage: () => currentLanguage,
		t,
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initializeLanguageSwitch, { once: true });
	} else {
		initializeLanguageSwitch();
	}
})();
