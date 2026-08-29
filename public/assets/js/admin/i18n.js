(() => {
	const STORAGE_KEY = 'song_admin_language';
	const DEFAULT_LANGUAGE = 'ja';
	const SUPPORTED_LANGUAGES = new Set(['ja', 'ko']);
	const translationCache = new Map();

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
			// The current page can still switch languages if storage is unavailable.
		}
	}

	async function loadTranslations(language) {
		const normalizedLanguage = normalizeLanguage(language);
		if (translationCache.has(normalizedLanguage)) {
			return translationCache.get(normalizedLanguage);
		}

		const response = await fetch(`/assets/i18n/admin/${normalizedLanguage}.json`, {
			cache: 'no-cache',
		});

		if (!response.ok) {
			throw new Error(`Failed to load admin translations: ${normalizedLanguage}`);
		}

		const translations = await response.json();
		translationCache.set(normalizedLanguage, translations);
		return translations;
	}

	let currentLanguage = readStoredLanguage();
	let currentTranslations = {};

	function t(key) {
		return currentTranslations[key] ?? key;
	}

	function translateDocument() {
		document.querySelectorAll('[data-i18n]').forEach((element) => {
			const key = element.dataset.i18n;
			if (key) element.textContent = t(key);
		});

		document.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
			const key = element.dataset.i18nAriaLabel;
			if (key) element.setAttribute('aria-label', t(key));
		});

		document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
			const key = element.dataset.i18nPlaceholder;
			if (key) element.setAttribute('placeholder', t(key));
		});

		document.querySelectorAll('[data-admin-lang]').forEach((button) => {
			const active = button.dataset.adminLang === currentLanguage;
			button.classList.toggle('is-active', active);
			button.setAttribute('aria-pressed', String(active));
		});
	}

	async function applyLanguage(language, { persist = true } = {}) {
		let normalizedLanguage = normalizeLanguage(language);
		let translations;

		try {
			translations = await loadTranslations(normalizedLanguage);
		} catch (error) {
			console.error(error);
			if (normalizedLanguage !== DEFAULT_LANGUAGE) {
				normalizedLanguage = DEFAULT_LANGUAGE;
				translations = await loadTranslations(DEFAULT_LANGUAGE);
			} else {
				translations = {};
			}
		}

		currentLanguage = normalizedLanguage;
		currentTranslations = translations;

		if (persist) {
			storeLanguage(currentLanguage);
		}

		document.documentElement.lang = currentLanguage;
		translateDocument();

		document.dispatchEvent(new CustomEvent('adminlanguagechange', {
			detail: { language: currentLanguage },
		}));

		return currentLanguage;
	}

	function bindLanguageSwitch() {
		document.querySelectorAll('[data-admin-lang]').forEach((button) => {
			button.addEventListener('click', () => {
				applyLanguage(button.dataset.adminLang);
			});
		});
	}

	async function initialize() {
		bindLanguageSwitch();
		await applyLanguage(currentLanguage, { persist: false });
	}

	const ready = document.readyState === 'loading'
		? new Promise((resolve) => {
			document.addEventListener('DOMContentLoaded', () => {
				initialize().finally(resolve);
			}, { once: true });
		})
		: initialize();

	window.AdminI18n = {
		applyLanguage,
		getLanguage: () => currentLanguage,
		ready,
		t,
	};
})();
