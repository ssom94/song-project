(() => {
	const editorMode = document.body.dataset.editorMode === 'edit' ? 'edit' : 'create';
	let sourceLanguage;
	let titleInput;
	let contentInput;
	let targetLanguageBadge;
	let detectedLanguageRow;
	let detectedLanguageBadge;
	let manualPanel;
	let translatedTitleInput;
	let translatedContentInput;
	let categorySelect;
	let statusSelect;
	let draftButton;
	let saveButton;
	let saveStatus;
	let saveCompleted = false;
	let resolveReady;

	const ready = new Promise((resolve) => {
		resolveReady = resolve;
	});

	function countMatches(text, regex) {
		return (text.match(regex) ?? []).length;
	}

	function detectSourceLanguage(text) {
		const hangulCount = countMatches(text, /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/g);
		const kanaCount = countMatches(text, /[\u3040-\u30ff\u31f0-\u31ff]/g);
		const kanjiCount = countMatches(text, /[\u3400-\u4dbf\u4e00-\u9fff]/g);

		if (hangulCount === 0 && kanaCount === 0 && kanjiCount === 0) return null;
		if (hangulCount > 0 && kanaCount === 0 && kanjiCount === 0) return 'ko';
		if (kanaCount > 0 && hangulCount === 0) return 'ja';
		if (hangulCount === 0 && (kanaCount > 0 || kanjiCount > 0)) return 'ja';

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

	function oppositeLanguage(language) {
		return language === 'ja' ? 'ko' : language === 'ko' ? 'ja' : null;
	}

	function languageLabel(language) {
		if (language === 'ja') return window.AdminI18n?.t('languageJapanese') ?? '日本語';
		if (language === 'ko') return window.AdminI18n?.t('languageKorean') ?? '한국어';
		return window.AdminI18n?.t('detectionWaiting') ?? '判定待ち';
	}

	function ensureLanguageDetectionUi() {
		if (!sourceLanguage) return;

		if (!sourceLanguage.querySelector('option[value="auto"]')) {
			const option = document.createElement('option');
			option.value = 'auto';
			option.dataset.i18n = 'languageAuto';
			option.textContent = window.AdminI18n?.t('languageAuto') ?? '自動判定';
			sourceLanguage.prepend(option);
		}
		if (editorMode === 'create') sourceLanguage.value = 'auto';

		if (!document.getElementById('source-language-auto-description')) {
			const description = document.createElement('p');
			description.id = 'source-language-auto-description';
			description.className = 'admin-editor-language-help';
			description.dataset.i18n = 'sourceLanguageAutoDescription';
			description.textContent = window.AdminI18n?.t('sourceLanguageAutoDescription') ?? 'タイトルと本文から言語を自動判定します。';
			sourceLanguage.insertAdjacentElement('afterend', description);
		}

		if (!document.getElementById('detected-language-row')) {
			const row = document.createElement('div');
			row.id = 'detected-language-row';
			row.className = 'admin-editor-detected-language';

			const label = document.createElement('span');
			label.dataset.i18n = 'detectedLanguageLabel';
			label.textContent = window.AdminI18n?.t('detectedLanguageLabel') ?? '判定結果';

			const badge = document.createElement('strong');
			badge.id = 'detected-source-language';
			badge.className = 'admin-editor-detected-badge is-waiting';
			badge.textContent = languageLabel(null);
			row.append(label, badge);
			sourceLanguage.closest('.admin-editor-field')?.appendChild(row);
		}

		detectedLanguageRow = document.getElementById('detected-language-row');
		detectedLanguageBadge = document.getElementById('detected-source-language');

		const translationBody = targetLanguageBadge?.closest('.admin-editor-card-body');
		if (translationBody && !document.getElementById('mixed-language-rule')) {
			const rule = document.createElement('p');
			rule.id = 'mixed-language-rule';
			rule.className = 'admin-editor-mixed-language-note';
			rule.dataset.i18n = 'mixedLanguageRule';
			rule.textContent = window.AdminI18n?.t('mixedLanguageRule') ?? '混在する対象言語の部分はそのまま残し、必要な部分だけ翻訳します。';
			const apiNote = translationBody.querySelector('.admin-editor-api-note');
			if (apiNote) translationBody.insertBefore(rule, apiNote);
			else translationBody.appendChild(rule);
		}
	}

	function ensureStatusOptions() {
		if (!statusSelect) return;
		for (const value of ['draft', 'private', 'published']) {
			if (statusSelect.querySelector(`option[value="${value}"]`)) continue;
			const option = document.createElement('option');
			option.value = value;
			option.textContent = value;
			statusSelect.appendChild(option);
		}
		statusSelect.querySelector('option[value="scheduled"]')?.remove();
		if (editorMode === 'create') statusSelect.value = 'private';
	}

	function updateRegistrationState() {
		const state = document.getElementById('post-registration-state');
		if (!state || !statusSelect) return;
		const draft = statusSelect.value === 'draft';
		state.classList.toggle('is-draft', draft);
		state.classList.toggle('is-registered', !draft);
		state.dataset.i18n = draft ? 'registrationDraft' : 'registrationCompleted';
		state.textContent = draft
			? (window.AdminI18n?.t('registrationDraft') ?? '一時保存')
			: (window.AdminI18n?.t('registrationCompleted') ?? '登録完了');
	}

	function ensureSaveStatusUi() {
		const actions = document.querySelector('.admin-editor-actions');
		if (!actions || document.getElementById('post-save-status')) return;
		const status = document.createElement('p');
		status.id = 'post-save-status';
		status.className = 'admin-editor-save-status';
		status.hidden = true;
		actions.parentElement?.insertBefore(status, actions);
		saveStatus = status;
	}

	function refreshDynamicLabels() {
		const autoOption = sourceLanguage?.querySelector('option[value="auto"]');
		if (autoOption) autoOption.textContent = window.AdminI18n?.t('languageAuto') ?? '自動判定';
		const description = document.getElementById('source-language-auto-description');
		if (description) description.textContent = window.AdminI18n?.t('sourceLanguageAutoDescription') ?? 'タイトルと本文から言語を自動判定します。';
		const detectedLabel = detectedLanguageRow?.querySelector('span');
		if (detectedLabel) detectedLabel.textContent = window.AdminI18n?.t('detectedLanguageLabel') ?? '判定結果';
		const mixedRule = document.getElementById('mixed-language-rule');
		if (mixedRule) mixedRule.textContent = window.AdminI18n?.t('mixedLanguageRule') ?? '混在する対象言語の部分はそのまま残し、必要な部分だけ翻訳します。';
		if (saveStatus?.dataset.messageKey) {
			saveStatus.textContent = window.AdminI18n?.t(saveStatus.dataset.messageKey) ?? saveStatus.textContent;
		}
		updateRegistrationState();
	}

	function getDetectedLanguage() {
		return detectSourceLanguage(`${titleInput?.value ?? ''}\n${contentInput?.value ?? ''}`.trim());
	}

	function getEffectiveSourceLanguage() {
		if (!sourceLanguage) return null;
		return sourceLanguage.value === 'auto' ? getDetectedLanguage() : sourceLanguage.value;
	}

	function updateLanguageState() {
		if (!sourceLanguage || !targetLanguageBadge) return;
		const automatic = sourceLanguage.value === 'auto';
		const source = getEffectiveSourceLanguage();
		const target = oppositeLanguage(source);
		const description = document.getElementById('source-language-auto-description');

		if (description) description.hidden = !automatic;
		if (detectedLanguageRow && detectedLanguageBadge) {
			detectedLanguageRow.hidden = !automatic;
			detectedLanguageBadge.textContent = languageLabel(source);
			detectedLanguageBadge.classList.toggle('is-waiting', !source);
		}
		targetLanguageBadge.textContent = languageLabel(target);
		targetLanguageBadge.classList.toggle('is-waiting', !target);
	}

	function updateTranslationMethod() {
		const selected = document.querySelector('input[name="translation-method"]:checked');
		if (manualPanel && selected) manualPanel.hidden = selected.value !== 'manual';
	}

	function selectTranslationMethod(method) {
		const radio = document.querySelector(`input[name="translation-method"][value="${method}"]`);
		if (radio) radio.checked = true;
		updateTranslationMethod();
	}

	function setSaveMessage(key, type = 'info') {
		if (!saveStatus) return;
		saveStatus.dataset.messageKey = key;
		saveStatus.dataset.type = type;
		saveStatus.textContent = window.AdminI18n?.t(key) ?? key;
		saveStatus.hidden = false;
	}

	function clearSaveError() {
		if (!saveStatus || saveStatus.dataset.type !== 'error') return;
		saveStatus.hidden = true;
		delete saveStatus.dataset.messageKey;
		delete saveStatus.dataset.type;
		saveStatus.textContent = '';
	}

	function setSaving(saving) {
		if (draftButton) draftButton.disabled = saving || (editorMode === 'create' && saveCompleted);
		if (saveButton) saveButton.disabled = saving || (editorMode === 'create' && saveCompleted);
		if (saving) setSaveMessage('savingPost', 'info');
	}

	function setEditControlsEnabled(enabled) {
		if (editorMode !== 'edit') return;
		if (draftButton) draftButton.disabled = !enabled;
		if (saveButton) saveButton.disabled = !enabled;
		if (sourceLanguage) sourceLanguage.disabled = true;
	}

	function selectedTranslationMethod() {
		return document.querySelector('input[name="translation-method"]:checked')?.value ?? 'later';
	}

	function buildPayload(forceDraft = false) {
		const status = editorMode === 'create'
			? (forceDraft ? 'draft' : 'private')
			: (statusSelect?.value ?? 'draft');
		return {
			title: titleInput?.value.trim() ?? '',
			content: contentInput?.value.trim() ?? '',
			sourceLanguage: sourceLanguage?.value ?? '',
			status,
			translationMethod: selectedTranslationMethod(),
			translatedTitle: translatedTitleInput?.value.trim() ?? '',
			translatedContent: translatedContentInput?.value.trim() ?? '',
			categoryId: categorySelect?.value || null,
			tagIds: window.AdminPostCategories?.getSelectedTagIds?.() ?? [],
		};
	}

	async function showValidationWarning(messageKey, target) {
		clearSaveError();
		if (window.AdminCommon?.alert) {
			await window.AdminCommon.alert({
				titleKey: 'validationWarningTitle',
				messageKey,
				titleFallback: '入力内容を確認してください',
				messageFallback: window.AdminI18n?.t(messageKey) ?? messageKey,
			});
		} else {
			window.alert(window.AdminI18n?.t(messageKey) ?? messageKey);
		}
		requestAnimationFrame(() => target?.focus({ preventScroll: false }));
	}

	async function validateBeforeSave() {
		const titleMissing = !titleInput?.value.trim();
		const contentMissing = !contentInput?.value.trim();
		if (titleMissing && contentMissing) {
			await showValidationWarning('postRequiredFields', titleInput);
			return false;
		}
		if (titleMissing) {
			await showValidationWarning('postTitleRequired', titleInput);
			return false;
		}
		if (contentMissing) {
			await showValidationWarning('postContentRequired', contentInput);
			return false;
		}
		if (!getEffectiveSourceLanguage()) {
			await showValidationWarning('postLanguageRequired', sourceLanguage);
			return false;
		}

		if (selectedTranslationMethod() === 'manual') {
			const translatedTitleMissing = !translatedTitleInput?.value.trim();
			const translatedContentMissing = !translatedContentInput?.value.trim();
			if (translatedTitleMissing || translatedContentMissing) {
				await showValidationWarning(
					'manualTranslationRequired',
					translatedTitleMissing ? translatedTitleInput : translatedContentInput,
				);
				return false;
			}
		}
		return true;
	}

	async function showDraftSavedConfirm() {
		if (!window.AdminCommon?.confirm) return false;
		return window.AdminCommon.confirm({
			titleKey: 'draftReturnConfirmTitle',
			messageKey: 'draftReturnConfirmMessage',
			confirmKey: 'confirmYes',
			cancelKey: 'confirmNo',
			titleFallback: '一時保存完了',
			messageFallback: '一時保存しました。投稿一覧に戻りますか？',
			confirmFallback: 'はい',
			cancelFallback: 'いいえ',
		});
	}

	async function savePost(forceDraft = false) {
		if (editorMode !== 'create' || saveCompleted) return;
		if (!(await validateBeforeSave())) return;

		setSaving(true);
		try {
			const response = await fetch('/api/admin/posts', {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildPayload(forceDraft)),
			});
			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) {
				console.error('Post save failed', result);
				setSaveMessage('postSaveFailed', 'error');
				return;
			}

			saveCompleted = true;
			if (statusSelect) statusSelect.value = forceDraft ? 'draft' : 'private';
			updateRegistrationState();
			if (forceDraft) {
				setSaveMessage('draftSaved', 'success');
				if (await showDraftSavedConfirm()) {
					window.location.assign('/admin/posts/');
					return;
				}
			} else {
				setSaveMessage('postSaved', 'success');
			}
		} catch (error) {
			console.error('Post save failed', error);
			setSaveMessage('postSaveFailed', 'error');
		} finally {
			setSaving(false);
		}
	}

	function loadPostData(post) {
		if (!post || !Array.isArray(post.translations)) return false;
		const originalLanguage = post.originalLanguage;
		const source = post.translations.find((translation) => translation.languageCode === originalLanguage);
		if (!source) return false;
		const targetLanguage = oppositeLanguage(originalLanguage);
		const translated = post.translations.find((translation) => translation.languageCode === targetLanguage);

		sourceLanguage.value = originalLanguage;
		titleInput.value = source.title ?? '';
		contentInput.value = source.content ?? '';

		if (statusSelect?.querySelector(`option[value="${post.status}"]`)) statusSelect.value = post.status;
		if (post.categoryId && categorySelect && !categorySelect.querySelector(`option[value="${post.categoryId}"]`)) {
			const option = document.createElement('option');
			option.value = String(post.categoryId);
			option.textContent = `#${post.categoryId}`;
			categorySelect.appendChild(option);
		}
		if (categorySelect) categorySelect.value = post.categoryId ? String(post.categoryId) : '';
		window.AdminPostCategories?.setSelectedTagIds?.(post.tagIds ?? []);

		if (translated) {
			translatedTitleInput.value = translated.title ?? '';
			translatedContentInput.value = translated.content ?? '';
			selectTranslationMethod('manual');
		} else {
			translatedTitleInput.value = '';
			translatedContentInput.value = '';
			selectTranslationMethod('later');
		}

		updateLanguageState();
		updateRegistrationState();
		clearSaveError();
		setEditControlsEnabled(true);
		return true;
	}

	function completeRegistration() {
		if (!statusSelect || statusSelect.value !== 'draft') return false;
		statusSelect.value = 'private';
		updateRegistrationState();
		return true;
	}

	function initialize() {
		sourceLanguage = document.getElementById('source-language');
		titleInput = document.getElementById('post-title');
		contentInput = document.getElementById('post-content');
		targetLanguageBadge = document.getElementById('translation-target-language');
		manualPanel = document.getElementById('manual-translation-panel');
		translatedTitleInput = document.getElementById('translated-title');
		translatedContentInput = document.getElementById('translated-content');
		categorySelect = document.getElementById('post-category');
		statusSelect = document.getElementById('publication-status');
		draftButton = document.querySelector('button[data-i18n="draftSave"]');
		saveButton = document.querySelector('button[data-i18n="savePost"]');

		if (!sourceLanguage || !titleInput || !contentInput || !targetLanguageBadge || !manualPanel) {
			resolveReady(false);
			return;
		}

		ensureLanguageDetectionUi();
		ensureStatusOptions();
		ensureSaveStatusUi();
		refreshDynamicLabels();

		if (editorMode === 'create') {
			if (draftButton) draftButton.disabled = false;
			if (saveButton) saveButton.disabled = false;
		} else {
			if (draftButton) draftButton.disabled = true;
			if (saveButton) saveButton.disabled = true;
		}

		sourceLanguage.addEventListener('change', () => {
			clearSaveError();
			updateLanguageState();
		});
		titleInput.addEventListener('input', () => {
			clearSaveError();
			updateLanguageState();
		});
		contentInput.addEventListener('input', () => {
			clearSaveError();
			updateLanguageState();
		});
		translatedTitleInput?.addEventListener('input', clearSaveError);
		translatedContentInput?.addEventListener('input', clearSaveError);

		document.querySelectorAll('input[name="translation-method"]').forEach((radio) => {
			radio.addEventListener('change', () => {
				clearSaveError();
				updateTranslationMethod();
			});
		});

		if (editorMode === 'create') draftButton?.addEventListener('click', () => savePost(true));

		document.addEventListener('adminlanguagechange', () => {
			refreshDynamicLabels();
			updateLanguageState();
		});

		document.getElementById('post-editor-form')?.addEventListener('submit', (event) => {
			event.preventDefault();
			if (editorMode === 'create') savePost(false);
		});

		updateLanguageState();
		updateTranslationMethod();
		updateRegistrationState();
		resolveReady(true);
	}

	window.AdminPostEditor = {
		mode: editorMode,
		ready,
		buildPayload,
		clearError: clearSaveError,
		completeRegistration,
		getStatus: () => statusSelect?.value ?? 'draft',
		loadPostData,
		setBusy: setSaving,
		setEditControlsEnabled,
		setMessage: setSaveMessage,
		validate: validateBeforeSave,
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize, { once: true });
	} else {
		initialize();
	}
})();
