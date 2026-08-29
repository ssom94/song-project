(() => {
	let sourceLanguage;
	let targetLanguageBadge;
	let manualPanel;

	function getTargetLanguage() {
		return sourceLanguage?.value === 'ja' ? 'ko' : 'ja';
	}

	function updateTargetLanguage() {
		if (!sourceLanguage || !targetLanguageBadge) return;

		const targetLanguage = getTargetLanguage();
		const key = targetLanguage === 'ja' ? 'languageJapanese' : 'languageKorean';
		targetLanguageBadge.dataset.targetLanguage = targetLanguage;
		targetLanguageBadge.textContent = window.AdminI18n?.t(key) ?? (targetLanguage === 'ja' ? '日本語' : '한국어');
	}

	function updateTranslationMethod() {
		const selected = document.querySelector('input[name="translation-method"]:checked');
		if (!manualPanel || !selected) return;
		manualPanel.hidden = selected.value !== 'manual';
	}

	function initialize() {
		sourceLanguage = document.getElementById('source-language');
		targetLanguageBadge = document.getElementById('translation-target-language');
		manualPanel = document.getElementById('manual-translation-panel');

		if (!sourceLanguage || !targetLanguageBadge || !manualPanel) return;

		sourceLanguage.addEventListener('change', updateTargetLanguage);
		document.querySelectorAll('input[name="translation-method"]').forEach((radio) => {
			radio.addEventListener('change', updateTranslationMethod);
		});

		document.addEventListener('adminlanguagechange', updateTargetLanguage);

		const form = document.getElementById('post-editor-form');
		form?.addEventListener('submit', (event) => event.preventDefault());

		updateTargetLanguage();
		updateTranslationMethod();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize, { once: true });
	} else {
		initialize();
	}
})();
