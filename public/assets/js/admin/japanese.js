(() => {
	let words = [];
	let levels = [];
	let partsOfSpeech = [];
	let learningCategories = [];
	let editingId = null;
	let saving = false;
	let selectedPartIds = [];
	let meaningRowSequence = 0;

	function t(key, fallback) {
		const value = window.AdminI18n?.t(key);
		return value && value !== key ? value : fallback;
	}

	function byId(id) {
		return document.getElementById(id);
	}

	function normalize(value) {
		return String(value ?? '').normalize('NFKC').toLocaleLowerCase().trim();
	}

	function currentLanguage() {
		return window.AdminI18n?.getLanguage?.() ?? 'ja';
	}

	function localizedLabel(row) {
		if (!row) return '';
		return currentLanguage() === 'ko'
			? (row.name_ko ?? row.name_ja ?? '')
			: (row.name_ja ?? row.name_ko ?? '');
	}

	function setStatus(key, type = 'info') {
		const status = byId('japanese-word-form-status');
		if (!status) return;
		status.hidden = false;
		status.dataset.key = key;
		status.dataset.type = type;
		status.textContent = t(key, key);
	}

	function clearStatus() {
		const status = byId('japanese-word-form-status');
		if (!status) return;
		status.hidden = true;
		delete status.dataset.key;
		delete status.dataset.type;
		status.textContent = '';
	}

	function findItem(items, id) {
		if (!id) return null;
		return items.find((item) => String(item.id) === String(id)) ?? null;
	}

	function rootItems(items) {
		return items.filter((item) => item.parent_id === null || item.parent_id === undefined);
	}

	function childItems(items, parentId) {
		if (!parentId) return [];
		return items.filter((item) => String(item.parent_id ?? '') === String(parentId));
	}

	function currentHierarchyValue(parentSelectId, childSelectId) {
		return byId(childSelectId)?.value || byId(parentSelectId)?.value || '';
	}

	function populateHierarchyParent(parentSelectId, childSelectId, items, selectedId, noneKey, noneJa, noneKo, childNoneKey) {
		const parent = byId(parentSelectId);
		const child = byId(childSelectId);
		if (!parent || !child) return;

		const selected = findItem(items, selectedId);
		const parentValue = selected ? String(selected.parent_id ?? selected.id) : '';

		parent.replaceChildren();
		const none = document.createElement('option');
		none.value = '';
		none.textContent = t(noneKey, currentLanguage() === 'ko' ? noneKo : noneJa);
		parent.appendChild(none);

		for (const item of rootItems(items)) {
			const option = document.createElement('option');
			option.value = String(item.id);
			option.textContent = localizedLabel(item);
			parent.appendChild(option);
		}
		parent.value = [...parent.options].some((option) => option.value === parentValue) ? parentValue : '';
		populateHierarchyChild(parentSelectId, childSelectId, items, selectedId, childNoneKey);
	}

	function populateHierarchyChild(parentSelectId, childSelectId, items, selectedId = '', childNoneKey = 'japaneseSubcategoryNone') {
		const parent = byId(parentSelectId);
		const child = byId(childSelectId);
		if (!parent || !child) return;
		const parentId = parent.value;
		const selected = findItem(items, selectedId);
		const selectedChildId = selected?.parent_id ? String(selected.id) : '';

		child.replaceChildren();
		const none = document.createElement('option');
		none.value = '';
		none.textContent = t(childNoneKey, currentLanguage() === 'ko' ? '소분류 없음' : '下位分類なし');
		child.appendChild(none);

		for (const item of childItems(items, parentId)) {
			const option = document.createElement('option');
			option.value = String(item.id);
			option.textContent = localizedLabel(item);
			child.appendChild(option);
		}
		child.disabled = !parentId || child.options.length <= 1;
		child.value = [...child.options].some((option) => option.value === selectedChildId) ? selectedChildId : '';
	}

	function fillSelectOptions() {
		const jlpt = byId('japanese-jlpt');
		const jlptFilter = byId('japanese-jlpt-filter');
		if (!jlpt || !jlptFilter) return;

		const jlptValue = jlpt.value;
		const filterValue = jlptFilter.value;
		const posValue = currentHierarchyValue('japanese-pos-parent', 'japanese-pos');
		const categoryValue = currentHierarchyValue('japanese-category-parent', 'japanese-category');

		jlpt.replaceChildren();
		jlptFilter.replaceChildren();

		const jlptNone = document.createElement('option');
		jlptNone.value = '';
		jlptNone.textContent = t('japaneseJlptNone', currentLanguage() === 'ko' ? '미지정' : '未指定');
		jlpt.appendChild(jlptNone);

		const all = document.createElement('option');
		all.value = '';
		all.textContent = currentLanguage() === 'ko' ? '전체' : 'すべて';
		jlptFilter.appendChild(all);

		for (const level of levels) {
			for (const select of [jlpt, jlptFilter]) {
				const option = document.createElement('option');
				option.value = String(level.id);
				option.textContent = level.code;
				select.appendChild(option);
			}
		}

		if ([...jlpt.options].some((option) => option.value === jlptValue)) jlpt.value = jlptValue;
		if ([...jlptFilter.options].some((option) => option.value === filterValue)) jlptFilter.value = filterValue;

		populateHierarchyParent(
			'japanese-pos-parent',
			'japanese-pos',
			partsOfSpeech,
			posValue,
			'japanesePartOfSpeechNone',
			'未指定',
			'미지정',
			'japanesePartOfSpeechSubNone',
		);
		populateHierarchyParent(
			'japanese-category-parent',
			'japanese-category',
			learningCategories,
			categoryValue,
			'japaneseCategoryNone',
			'未指定',
			'미지정',
			'japaneseCategorySubNone',
		);
	}

	function selectedHierarchyId(parentId, childId) {
		return byId(childId)?.value || byId(parentId)?.value || null;
	}

	function splitMeanings(value) {
		return String(value ?? '')
			.split(/\r?\n/)
			.map((item) => item.trim())
			.filter(Boolean);
	}

	function collectMeaningValues() {
		return [...document.querySelectorAll('.admin-japanese-meaning-input')]
			.map((input) => input.value.trim())
			.filter(Boolean);
	}

	function createMeaningRow(value = '') {
		meaningRowSequence += 1;
		const row = document.createElement('div');
		row.className = 'admin-japanese-meaning-row';

		const field = document.createElement('div');
		field.className = 'admin-japanese-field';
		const inputId = `japanese-meaning-${meaningRowSequence}`;
		const label = document.createElement('label');
		label.htmlFor = inputId;
		label.textContent = t('japaneseMeaningKo', currentLanguage() === 'ko' ? '한국어 뜻' : '韓国語の意味');
		const input = document.createElement('input');
		input.id = inputId;
		input.type = 'text';
		input.maxLength = 500;
		input.autocomplete = 'off';
		input.className = 'admin-japanese-meaning-input';
		input.placeholder = t('japaneseMeaningKoPlaceholder', '예: 다루다, 취급하다');
		input.value = value;
		field.append(label, input);

		const remove = document.createElement('button');
		remove.type = 'button';
		remove.className = 'admin-japanese-meaning-remove';
		remove.textContent = '×';
		remove.setAttribute('aria-label', t('japaneseMeaningRemove', currentLanguage() === 'ko' ? '뜻 삭제' : '意味を削除'));
		remove.addEventListener('click', () => {
			const container = byId('japanese-meaning-rows');
			if (!container) return;
			if (container.children.length <= 1) {
				input.value = '';
				input.focus();
				return;
			}
			row.remove();
		});

		row.append(field, remove);
		return row;
	}

	function renderMeaningRows(values = ['']) {
		const container = byId('japanese-meaning-rows');
		if (!container) return;
		const normalized = values.length ? values : [''];
		container.replaceChildren(...normalized.map((value) => createMeaningRow(value)));
	}

	function partPathLabel(part) {
		if (!part) return '';
		const parent = findItem(partsOfSpeech, part.parent_id);
		return parent ? `${localizedLabel(parent)} > ${localizedLabel(part)}` : localizedLabel(part);
	}

	function wordParts(word) {
		if (Array.isArray(word?.parts) && word.parts.length) return word.parts;
		if (word?.part_of_speech_id) {
			return [{
				id: word.part_of_speech_id,
				parent_id: word.part_of_speech_parent_id,
				name_ja: word.part_of_speech_ja,
				name_ko: word.part_of_speech_ko,
				is_primary: 1,
			}];
		}
		return [];
	}

	function renderSelectedParts() {
		const container = byId('japanese-pos-selected');
		if (!container) return;
		container.replaceChildren();
		if (!selectedPartIds.length) {
			const empty = document.createElement('span');
			empty.className = 'admin-japanese-selected-empty';
			empty.textContent = t('japanesePartOfSpeechSelectedEmpty', currentLanguage() === 'ko' ? '선택된 품사 없음' : '選択中の品詞はありません');
			container.appendChild(empty);
			return;
		}

		selectedPartIds.forEach((id, index) => {
			const part = findItem(partsOfSpeech, id);
			if (!part) return;
			const chip = document.createElement('button');
			chip.type = 'button';
			chip.className = `admin-japanese-part-chip${index === 0 ? ' is-primary' : ''}`;
			const prefix = index === 0 ? `${t('japanesePrimaryPart', currentLanguage() === 'ko' ? '대표' : '代表')} · ` : '';
			chip.textContent = `${prefix}${partPathLabel(part)} ×`;
			chip.addEventListener('click', () => {
				selectedPartIds = selectedPartIds.filter((partId) => String(partId) !== String(id));
				renderSelectedParts();
			});
			container.appendChild(chip);
		});
	}

	function addSelectedPart() {
		const selectedId = selectedHierarchyId('japanese-pos-parent', 'japanese-pos');
		if (!selectedId) return;
		const numericId = Number(selectedId);
		if (!selectedPartIds.includes(numericId)) selectedPartIds.push(numericId);
		renderSelectedParts();
	}

	function setHierarchyValue(parentId, childId, items, selectedId, noneKey) {
		populateHierarchyParent(
			parentId,
			childId,
			items,
			selectedId ? String(selectedId) : '',
			parentId.includes('pos') ? 'japanesePartOfSpeechNone' : 'japaneseCategoryNone',
			'未指定',
			'미지정',
			noneKey,
		);
	}

	function getPayload() {
		return {
			word: byId('japanese-word')?.value.trim() ?? '',
			reading: byId('japanese-reading')?.value.trim() ?? '',
			meaningKo: collectMeaningValues().join('\n'),
			meaningJa: byId('japanese-meaning-ja')?.value.trim() ?? '',
			jlptLevelId: byId('japanese-jlpt')?.value || null,
			partOfSpeechIds: [...selectedPartIds],
			partOfSpeechId: selectedPartIds[0] ?? null,
			categoryId: selectedHierarchyId('japanese-category-parent', 'japanese-category'),
			exampleSentence: byId('japanese-example')?.value.trim() ?? '',
			exampleReading: byId('japanese-example-reading')?.value.trim() ?? '',
			exampleTranslationKo: byId('japanese-example-ko')?.value.trim() ?? '',
			note: byId('japanese-note')?.value.trim() ?? '',
		};
	}

	function setFormCollapsed(collapsed, persist = true) {
		const layout = byId('admin-japanese-layout');
		const panel = byId('japanese-word-form-panel');
		const toggle = byId('japanese-word-form-toggle');
		if (!layout || !panel || !toggle) return;
		layout.classList.toggle('is-form-collapsed', collapsed);
		panel.hidden = collapsed;
		toggle.setAttribute('aria-expanded', String(!collapsed));
		toggle.dataset.i18n = collapsed ? 'japaneseWordExpand' : 'japaneseWordCollapse';
		toggle.textContent = t(toggle.dataset.i18n, collapsed
			? (currentLanguage() === 'ko' ? '단어 추가 펼치기' : '入力欄を開く')
			: (currentLanguage() === 'ko' ? '단어 추가 접기' : '入力欄を閉じる'));
		if (persist) localStorage.setItem('song_admin_japanese_form_collapsed', collapsed ? '1' : '0');
	}

	function duplicateMatches() {
		const target = normalize(byId('japanese-word')?.value);
		if (!target) return [];
		return words.filter((word) => normalize(word.word) === target && String(word.id) !== String(editingId ?? ''));
	}

	function formatPartsForWord(word) {
		return wordParts(word).map((part) => partPathLabel(part)).filter(Boolean);
	}

	function wordExamples(word) {
		if (Array.isArray(word?.examples) && word.examples.length) return word.examples;
		if (word?.example_sentence) {
			return [{
				sentence_ja: word.example_sentence,
				reading: word.example_reading,
				translation_ko: word.example_translation_ko,
			}];
		}
		return [];
	}

	function renderDuplicatePanel() {
		const panel = byId('japanese-duplicate-panel');
		const list = byId('japanese-duplicate-list');
		const count = byId('japanese-duplicate-count');
		if (!panel || !list || !count) return;
		const matches = duplicateMatches();
		panel.hidden = matches.length === 0;
		list.replaceChildren();
		count.textContent = matches.length ? `${matches.length}` : '';

		for (const word of matches) {
			const card = document.createElement('article');
			card.className = 'admin-japanese-duplicate-card';

			const heading = document.createElement('div');
			heading.className = 'admin-japanese-duplicate-card-heading';
			const title = document.createElement('strong');
			title.textContent = word.word ?? '';
			const meta = document.createElement('span');
			meta.textContent = [`#${word.id}`, word.reading, word.jlpt_code].filter(Boolean).join(' · ');
			heading.append(title, meta);

			const meanings = document.createElement('div');
			meanings.className = 'admin-japanese-duplicate-values';
			for (const meaning of splitMeanings(word.meaning_ko)) {
				const chip = document.createElement('span');
				chip.textContent = meaning;
				meanings.appendChild(chip);
			}
			if (!meanings.childElementCount && word.meaning_ja) {
				const chip = document.createElement('span');
				chip.textContent = word.meaning_ja;
				meanings.appendChild(chip);
			}

			const details = document.createElement('p');
			const parts = formatPartsForWord(word);
			const example = wordExamples(word)[0]?.sentence_ja;
			details.textContent = [
				parts.length ? `${t('japanesePartOfSpeech', '品詞')}: ${parts.join(', ')}` : '',
				example ? `${t('japaneseExample', '例文')}: ${example}` : '',
			].filter(Boolean).join(' / ');

			const open = document.createElement('button');
			open.type = 'button';
			open.className = 'admin-japanese-button admin-japanese-button-primary';
			open.textContent = t('japaneseDuplicateOpenExisting', currentLanguage() === 'ko' ? '기존 단어에 추가' : '既存の単語に追加');
			open.addEventListener('click', () => {
				setForm(word);
				setFormCollapsed(false);
				byId('japanese-word-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			});

			card.append(heading, meanings, details, open);
			list.appendChild(card);
		}
		updateSaveButtonState();
	}

	function updateSaveButtonState() {
		const save = byId('japanese-word-save');
		if (save) save.disabled = saving || duplicateMatches().length > 0;
	}

	function setForm(word = null) {
		editingId = word?.id ?? null;
		byId('japanese-word').value = word?.word ?? '';
		byId('japanese-reading').value = word?.reading ?? '';
		renderMeaningRows(splitMeanings(word?.meaning_ko));
		byId('japanese-meaning-ja').value = word?.meaning_ja ?? '';
		byId('japanese-jlpt').value = word?.jlpt_level_id ? String(word.jlpt_level_id) : '';

		const parts = wordParts(word);
		selectedPartIds = parts.map((part) => Number(part.id)).filter((id) => Number.isSafeInteger(id) && id > 0);
		renderSelectedParts();
		setHierarchyValue('japanese-pos-parent', 'japanese-pos', partsOfSpeech, selectedPartIds[0] ?? null, 'japanesePartOfSpeechSubNone');
		setHierarchyValue('japanese-category-parent', 'japanese-category', learningCategories, word?.category_id, 'japaneseCategorySubNone');
		byId('japanese-example').value = word?.example_sentence ?? wordExamples(word)[0]?.sentence_ja ?? '';
		byId('japanese-example-reading').value = word?.example_reading ?? wordExamples(word)[0]?.reading ?? '';
		byId('japanese-example-ko').value = word?.example_translation_ko ?? wordExamples(word)[0]?.translation_ko ?? '';
		byId('japanese-note').value = word?.note ?? '';

		const title = byId('japanese-word-form-title');
		const save = byId('japanese-word-save');
		const cancel = byId('japanese-word-cancel');
		if (title) {
			title.dataset.i18n = editingId ? 'japaneseWordEditTitle' : 'japaneseWordCreateTitle';
			title.textContent = t(title.dataset.i18n, editingId ? '単語を編集' : '単語を追加');
		}
		if (save) {
			save.dataset.i18n = editingId ? 'japaneseWordUpdate' : 'japaneseWordAdd';
			save.textContent = t(save.dataset.i18n, editingId ? '変更を保存' : '追加');
		}
		if (cancel) cancel.hidden = !editingId;
		clearStatus();
		renderDuplicatePanel();
		updateSaveButtonState();
	}

	function appendMeaningCell(cell, word) {
		const values = splitMeanings(word.meaning_ko);
		if (!values.length && word.meaning_ja) values.push(word.meaning_ja);
		if (!values.length) {
			cell.textContent = '—';
			return;
		}
		const list = document.createElement('div');
		list.className = 'admin-japanese-value-list';
		values.forEach((value) => {
			const item = document.createElement('span');
			item.textContent = value;
			list.appendChild(item);
		});
		cell.appendChild(list);
	}

	function appendExampleCell(cell, word) {
		const examples = wordExamples(word);
		if (!examples.length) {
			cell.textContent = '—';
			return;
		}
		const list = document.createElement('div');
		list.className = 'admin-japanese-example-list';
		examples.forEach((example) => {
			const item = document.createElement('div');
			item.className = 'admin-japanese-example-item';
			const sentence = document.createElement('strong');
			sentence.textContent = example.sentence_ja ?? '';
			item.appendChild(sentence);
			if (example.reading) {
				const reading = document.createElement('span');
				reading.textContent = example.reading;
				item.appendChild(reading);
			}
			if (example.translation_ko) {
				const translation = document.createElement('small');
				translation.textContent = example.translation_ko;
				item.appendChild(translation);
			}
			list.appendChild(item);
		});
		cell.appendChild(list);
	}

	function appendPartCell(cell, word) {
		const parts = wordParts(word);
		if (!parts.length) {
			cell.textContent = '—';
			return;
		}
		const list = document.createElement('div');
		list.className = 'admin-japanese-table-parts';
		parts.forEach((part, index) => {
			const chip = document.createElement('span');
			chip.className = index === 0 ? 'is-primary' : '';
			chip.textContent = partPathLabel(part);
			list.appendChild(chip);
		});
		cell.appendChild(list);
	}

	function renderRows() {
		const tbody = byId('japanese-word-table-body');
		const table = byId('japanese-word-table-wrap');
		const empty = byId('japanese-words-empty');
		const filteredEmpty = byId('japanese-words-filtered-empty');
		const count = byId('japanese-word-count');
		if (!tbody || !table || !empty || !filteredEmpty || !count) return;

		const query = normalize(byId('japanese-word-search')?.value);
		const jlptFilter = byId('japanese-jlpt-filter')?.value ?? '';
		const filtered = words.filter((word) => {
			if (jlptFilter && String(word.jlpt_level_id ?? '') !== jlptFilter) return false;
			if (!query) return true;
			const examples = wordExamples(word).flatMap((example) => [example.sentence_ja, example.reading, example.translation_ko]);
			const parts = wordParts(word).flatMap((part) => [part.name_ja, part.name_ko]);
			return [word.word, word.reading, word.meaning_ko, word.meaning_ja, ...examples, ...parts]
				.some((value) => normalize(value).includes(query));
		});

		count.textContent = String(filtered.length);
		tbody.replaceChildren();
		empty.hidden = true;
		filteredEmpty.hidden = true;

		if (words.length === 0) {
			table.hidden = true;
			empty.hidden = false;
			return;
		}
		if (filtered.length === 0) {
			table.hidden = true;
			filteredEmpty.hidden = false;
			return;
		}

		for (const word of filtered) {
			const tr = document.createElement('tr');
			const wordCell = document.createElement('td');
			const main = document.createElement('div');
			main.className = 'admin-japanese-word-main';
			const strong = document.createElement('strong');
			strong.textContent = word.word ?? '';
			const id = document.createElement('span');
			id.textContent = `#${word.id}`;
			main.append(strong, id);
			wordCell.appendChild(main);

			const readingCell = document.createElement('td');
			readingCell.textContent = word.reading || '—';
			const meaningCell = document.createElement('td');
			meaningCell.className = 'admin-japanese-table-meaning';
			appendMeaningCell(meaningCell, word);

			const exampleCell = document.createElement('td');
			exampleCell.className = 'admin-japanese-table-example';
			appendExampleCell(exampleCell, word);

			const jlptCell = document.createElement('td');
			if (word.jlpt_code) {
				const badge = document.createElement('span');
				badge.className = 'admin-japanese-level-badge';
				badge.textContent = word.jlpt_code;
				jlptCell.appendChild(badge);
			} else jlptCell.textContent = '—';

			const categoryCell = document.createElement('td');
			categoryCell.textContent = currentLanguage() === 'ko'
				? (word.category_ko || word.category_ja || '—')
				: (word.category_ja || word.category_ko || '—');

			const posCell = document.createElement('td');
			appendPartCell(posCell, word);

			const actionCell = document.createElement('td');
			const actions = document.createElement('div');
			actions.className = 'admin-japanese-actions';
			const edit = document.createElement('button');
			edit.type = 'button';
			edit.className = 'admin-japanese-action';
			edit.textContent = t('japaneseWordEdit', currentLanguage() === 'ko' ? '수정' : '編集');
			edit.addEventListener('click', () => {
				setForm(word);
				setFormCollapsed(false);
				byId('japanese-word')?.focus({ preventScroll: false });
				byId('japanese-word-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			});
			const remove = document.createElement('button');
			remove.type = 'button';
			remove.className = 'admin-japanese-action admin-japanese-action-danger';
			remove.textContent = t('japaneseWordDelete', currentLanguage() === 'ko' ? '삭제' : '削除');
			remove.addEventListener('click', () => deleteWord(word));
			actions.append(edit, remove);
			actionCell.appendChild(actions);

			tr.append(wordCell, readingCell, meaningCell, exampleCell, jlptCell, categoryCell, posCell, actionCell);
			tbody.appendChild(tr);
		}
		table.hidden = false;
	}

	async function loadWords() {
		const loading = byId('japanese-words-loading');
		try {
			const response = await fetch('/api/admin/japanese/words', { credentials: 'same-origin', cache: 'no-store' });
			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok || !Array.isArray(result.words)) throw new Error('Invalid Japanese words response');
			words = result.words;
			levels = Array.isArray(result.levels) ? result.levels : [];
			partsOfSpeech = Array.isArray(result.partsOfSpeech) ? result.partsOfSpeech : [];
			learningCategories = Array.isArray(result.categories) ? result.categories : [];
			fillSelectOptions();
			renderSelectedParts();
			renderRows();
			renderDuplicatePanel();
		} catch (error) {
			console.error('Failed to load Japanese words', error);
			words = [];
			renderRows();
		} finally {
			if (loading) loading.hidden = true;
		}
	}

	async function saveWord(event) {
		event.preventDefault();
		if (saving) return;
		const payload = getPayload();
		if (!payload.word) {
			setStatus('japaneseWordRequired', 'error');
			byId('japanese-word')?.focus();
			return;
		}
		if (duplicateMatches().length) {
			setStatus('japaneseDuplicateBlocked', 'error');
			renderDuplicatePanel();
			return;
		}

		saving = true;
		updateSaveButtonState();
		clearStatus();
		try {
			const url = editingId
				? `/api/admin/japanese/words/detail?id=${encodeURIComponent(editingId)}`
				: '/api/admin/japanese/words';
			const response = await fetch(url, {
				method: editingId ? 'PATCH' : 'POST',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			const result = await response.json().catch(() => null);
			if (response.status === 409 && result?.error === 'WORD_ALREADY_EXISTS') {
				await loadWords();
				setStatus('japaneseDuplicateBlocked', 'error');
				renderDuplicatePanel();
				return;
			}
			if (!response.ok || !result?.ok) throw new Error(result?.error ?? 'SAVE_FAILED');
			const wasEditing = Boolean(editingId);
			setForm();
			await loadWords();
			setStatus(wasEditing ? 'japaneseWordUpdated' : 'japaneseWordSaved', 'success');
		} catch (error) {
			console.error('Failed to save Japanese word', error);
			setStatus('japaneseWordSaveFailed', 'error');
		} finally {
			saving = false;
			updateSaveButtonState();
		}
	}

	async function deleteWord(word) {
		const confirmed = window.AdminCommon?.confirm
			? await window.AdminCommon.confirm({
				titleKey: 'japaneseWordDeleteTitle',
				messageKey: 'japaneseWordDeleteMessage',
				confirmKey: 'japaneseWordDeleteConfirm',
				cancelKey: 'confirmNo',
				titleFallback: currentLanguage() === 'ko' ? '단어 삭제' : '単語を削除',
				messageFallback: currentLanguage() === 'ko' ? '이 단어를 삭제하시겠습니까?' : 'この単語を削除しますか？',
				confirmFallback: currentLanguage() === 'ko' ? '삭제' : '削除',
				cancelFallback: currentLanguage() === 'ko' ? '아니오' : 'いいえ',
			})
			: window.confirm(currentLanguage() === 'ko' ? '이 단어를 삭제하시겠습니까?' : 'この単語を削除しますか？');
		if (!confirmed) return;

		try {
			const response = await fetch(`/api/admin/japanese/words/detail?id=${encodeURIComponent(word.id)}`, {
				method: 'DELETE',
				credentials: 'same-origin',
			});
			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error ?? 'DELETE_FAILED');
			if (String(editingId) === String(word.id)) setForm();
			await loadWords();
			setStatus('japaneseWordDeleted', 'success');
		} catch (error) {
			console.error('Failed to delete Japanese word', error);
			setStatus('japaneseWordDeleteFailed', 'error');
		}
	}

	async function initialize() {
		await Promise.all([window.AdminCommon?.ready, window.AdminI18n?.ready]);
		renderMeaningRows(['']);
		setFormCollapsed(localStorage.getItem('song_admin_japanese_form_collapsed') === '1', false);

		byId('japanese-word-form')?.addEventListener('submit', saveWord);
		byId('japanese-word-new')?.addEventListener('click', () => {
			setForm();
			setFormCollapsed(false);
			byId('japanese-word')?.focus();
		});
		byId('japanese-word-cancel')?.addEventListener('click', () => setForm());
		byId('japanese-word-form-toggle')?.addEventListener('click', () => {
			setFormCollapsed(!byId('japanese-word-form-panel')?.hidden);
		});
		byId('japanese-meaning-add')?.addEventListener('click', () => {
			byId('japanese-meaning-rows')?.appendChild(createMeaningRow(''));
		});
		byId('japanese-pos-add')?.addEventListener('click', addSelectedPart);
		byId('japanese-word')?.addEventListener('input', () => {
			clearStatus();
			renderDuplicatePanel();
		});
		byId('japanese-word-search')?.addEventListener('input', renderRows);
		byId('japanese-jlpt-filter')?.addEventListener('change', renderRows);
		byId('japanese-pos-parent')?.addEventListener('change', () => {
			populateHierarchyChild('japanese-pos-parent', 'japanese-pos', partsOfSpeech, '', 'japanesePartOfSpeechSubNone');
		});
		byId('japanese-category-parent')?.addEventListener('change', () => {
			populateHierarchyChild('japanese-category-parent', 'japanese-category', learningCategories, '', 'japaneseCategorySubNone');
		});
		document.addEventListener('adminlanguagechange', () => {
			const meaningValues = collectMeaningValues();
			fillSelectOptions();
			renderMeaningRows(meaningValues);
			renderSelectedParts();
			renderRows();
			renderDuplicatePanel();
			setFormCollapsed(Boolean(byId('japanese-word-form-panel')?.hidden), false);
			const status = byId('japanese-word-form-status');
			if (status?.dataset.key) status.textContent = t(status.dataset.key, status.dataset.key);
		});
		await loadWords();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
