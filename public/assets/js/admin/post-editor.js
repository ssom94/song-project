(() => {
	let sourceLanguage;
	let titleInput;
	let contentInput;
	let targetLanguageBadge;
	let detectedLanguageRow;
	let detectedLanguageBadge;
	let manualPanel;

	function countMatches(text, regex) {
		return (text.match(regex) ?? []).length;
	}

	function detectSourceLanguage(text) {
		const hangulCount = countMatches(text, /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/g);
		const kanaCount = countMatches(text, /[\u3040-\u30ff\u31f0-\u31ff]/g);
		const kanjiCount = countMatches(text, /[\u3400-\u4dbf\u4e00-\u9fff]/g);

		if (hangulCount === 0 && kanaCount === 0 && kanjiCount === 0) {
			return null;
		}

		if (hangulCount > 0 && kanaCount === 0 && kanjiCount === 0) {
			return 'ko';
		}

		if (kanaCount > 0 && hangulCount === 0) {
			return 'ja';
		}

		if (hangulCount === 0 && (kanaCount > 0 || kanjiCount > 0)) {
			return 'ja';
		}

		const koreanScore = hangulCount * 3;
		const japaneseScore = (kanaCount * 3) + (kanjiCount * 0.35);

		if (Math.abs(koreanScore - japaneseScore) > Math.max(koreanScore, japaneseScore) * 0.15) {
			return koreanScore > japaneseScore ? 'ko' : 'ja';
		}

		for (const character of text) {
			if (/[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/.test(character)) return 'ko';
			if (/[\u3040-\u30ff\u31f0-\u31ff]/.test(character)) return 'ja';
		}

		return koreanScore >= japaneseScore ? 'ko' : 'ja';
	}

	function getDetectedLanguage() {
		const text = `${titleInput?.value ?? ''}\n${contentInput?.value ?? ''}`.trim();
		return detectSourceLanguage(text);
	}

	function getEffectiveSourceLanguage() {
		if (!sourceLanguage) return null;
		return sourceLanguage.value === 'auto' ? getDetectedLanguage() : sourceLanguage.value;
	}

	function languageLabel(language) {
		if (language === 'ja') return window.AdminI18n?.t('languageJapanese') ?? '日本語';
		if (language === 'ko') return window.AdminI18n?.t('languageKorean') ?? '한국어';
		return window.AdminI18n?.t('detectionWaiting') ?? '判定待ち';
	}

	function updateLanguageState() {
		if (!sourceLanguage || !targetLanguageBadge) return;

		const automatic = sourceLanguage.value === 'auto';
		const effectiveSourceLanguage = getEffectiveSourceLanguage();
		const targetLanguage = effectiveSourceLanguage === 'ja'
			? 'ko'
			: effectiveSourceLanguage === 'ko'
				? 'ja'
				: null;

		if (detectedLanguageRow && detectedLanguageBadge) {
			detectedLanguageRow.hidden = !automatic;
			detectedLanguageBadge.textContent = languageLabel(effectiveSourceLanguage);
			detectedLanguageBadge.classList.toggle('is-waiting', !effectiveSourceLanguage);
			detectedLanguageBadge.dataset.detectedLanguage = effectiveSourceLanguage ?? '';
		}

		targetLanguageBadge.textContent = languageLabel(targetLanguage);
		targetLanguageBadge.classList.toggle('is-waiting', !targetLanguage);
		targetLanguageBadge.dataset.targetLanguage = targetLanguage ?? '';
	}

	function updateTranslationMethod() {
		const selected = document.querySelector('input[name="translation-method"]:checked');
		if (!manualPanel || !selected) return;
		manualPanel.hidden = selected.value !== 'manual';
	}

	function initialize() {
		sourceLanguage = document.getElementById('source-language');
		titleInput = document.getElementById('post-title');
		contentInput = document.getElementById('post-content');
		targetLanguageBadge = document.getElementById('translation-target-language');
		detectedLanguageRow = document.getElementById('detected-language-row');
		detectedLanguageBadge = document.getElementById('detected-source-language');
		manualPanel = document.getElementById('manual-translation-panel');

		if (!sourceLanguage || !targetLanguageBadge || !manualPanel) return;

		sourceLanguage.addEventListener('change', updateLanguageState);
		titleInput?.addEventListener('input', updateLanguageState);
		contentInput?.addEventListener('input', updateLanguageState);

		document.querySelectorAll('input[name="translation-method"]').forEach((radio) => {
			radio.addEventListener('change', updateTranslationMethod);
		});

		document.addEventListener('adminlanguagechange', updateLanguageState);

		const form = document.getElementById('post-editor-form');
		form?.addEventListener('submit', (event) => event.preventDefault());

		updateLanguageState();
		updateTranslationMethod();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize, { once: true });
	} else {
		initialize();
	}
})();
