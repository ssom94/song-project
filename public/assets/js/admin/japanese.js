(() => {
	let words = [];
	let levels = [];
	let partsOfSpeech = [];
	let editingId = null;
	let saving = false;

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

	function partLabel(row) {
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

	function fillSelectOptions() {
		const jlpt = byId('japanese-jlpt');
		const jlptFilter = byId('japanese-jlpt-filter');
		const pos = byId('japanese-pos');
		if (!jlpt || !jlptFilter || !pos) return;

		const jlptValue = jlpt.value;
		const filterValue = jlptFilter.value;
		const posValue = pos.value;

		jlpt.replaceChildren();
		jlptFilter.replaceChildren();
		pos.replaceChildren();

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

		const posNone = document.createElement('option');
		posNone.value = '';
		posNone.textContent = t('japanesePartOfSpeechNone', currentLanguage() === 'ko' ? '미지정' : '未指定');
		pos.appendChild(posNone);
		for (const part of partsOfSpeech) {
			const option = document.createElement('option');
			option.value = String(part.id);
			option.textContent = partLabel(part);
			pos.appendChild(option);
		}

		if ([...jlpt.options].some((option) => option.value === jlptValue)) jlpt.value = jlptValue;
		if ([...jlptFilter.options].some((option) => option.value === filterValue)) jlptFilter.value = filterValue;
		if ([...pos.options].some((option) => option.value === posValue)) pos.value = posValue;
	}

	function getPayload() {
		return {
			word: byId('japanese-word')?.value.trim() ?? '',
			reading: byId('japanese-reading')?.value.trim() ?? '',
			meaningKo: byId('japanese-meaning-ko')?.value.trim() ?? '',
			meaningJa: byId('japanese-meaning-ja')?.value.trim() ?? '',
			jlptLevelId: byId('japanese-jlpt')?.value || null,
			partOfSpeechId: byId('japanese-pos')?.value || null,
			exampleSentence: byId('japanese-example')?.value.trim() ?? '',
			exampleReading: byId('japanese-example-reading')?.value.trim() ?? '',
			exampleTranslationKo: byId('japanese-example-ko')?.value.trim() ?? '',
			note: byId('japanese-note')?.value.trim() ?? '',
		};
	}

	function setForm(word = null) {
		editingId = word?.id ?? null;
		byId('japanese-word').value = word?.word ?? '';
		byId('japanese-reading').value = word?.reading ?? '';
		byId('japanese-meaning-ko').value = word?.meaning_ko ?? '';
		byId('japanese-meaning-ja').value = word?.meaning_ja ?? '';
		byId('japanese-jlpt').value = word?.jlpt_level_id ? String(word.jlpt_level_id) : '';
		byId('japanese-pos').value = word?.part_of_speech_id ? String(word.part_of_speech_id) : '';
		byId('japanese-example').value = word?.example_sentence ?? '';
		byId('japanese-example-reading').value = word?.example_reading ?? '';
		byId('japanese-example-ko').value = word?.example_translation_ko ?? '';
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
			return [word.word, word.reading, word.meaning_ko, word.meaning_ja]
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
			meaningCell.textContent = word.meaning_ko || word.meaning_ja || '—';

			const jlptCell = document.createElement('td');
			if (word.jlpt_code) {
				const badge = document.createElement('span');
				badge.className = 'admin-japanese-level-badge';
				badge.textContent = word.jlpt_code;
				jlptCell.appendChild(badge);
			} else jlptCell.textContent = '—';

			const posCell = document.createElement('td');
			posCell.textContent = currentLanguage() === 'ko'
				? (word.part_of_speech_ko || word.part_of_speech_ja || '—')
				: (word.part_of_speech_ja || word.part_of_speech_ko || '—');

			const actionCell = document.createElement('td');
			const actions = document.createElement('div');
			actions.className = 'admin-japanese-actions';
			const edit = document.createElement('button');
			edit.type = 'button';
			edit.className = 'admin-japanese-action';
			edit.textContent = t('japaneseWordEdit', currentLanguage() === 'ko' ? '수정' : '編集');
			edit.addEventListener('click', () => {
				setForm(word);
				byId('japanese-word')?.focus({ preventScroll: false });
				window.scrollTo({ top: 0, behavior: 'smooth' });
			});

			const remove = document.createElement('button');
			remove.type = 'button';
			remove.className = 'admin-japanese-action admin-japanese-action-danger';
			remove.textContent = t('japaneseWordDelete', currentLanguage() === 'ko' ? '삭제' : '削除');
			remove.addEventListener('click', () => deleteWord(word));
			actions.append(edit, remove);
			actionCell.appendChild(actions);

			tr.append(wordCell, readingCell, meaningCell, jlptCell, posCell, actionCell);
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
			fillSelectOptions();
			renderRows();
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

		saving = true;
		const save = byId('japanese-word-save');
		if (save) save.disabled = true;
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
			if (save) save.disabled = false;
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
			if (editingId === word.id) setForm();
			await loadWords();
			setStatus('japaneseWordDeleted', 'success');
		} catch (error) {
			console.error('Failed to delete Japanese word', error);
			setStatus('japaneseWordDeleteFailed', 'error');
		}
	}

	async function initialize() {
		await Promise.all([window.AdminCommon?.ready, window.AdminI18n?.ready]);
		byId('japanese-word-form')?.addEventListener('submit', saveWord);
		byId('japanese-word-new')?.addEventListener('click', () => setForm());
		byId('japanese-word-cancel')?.addEventListener('click', () => setForm());
		byId('japanese-word-search')?.addEventListener('input', renderRows);
		byId('japanese-jlpt-filter')?.addEventListener('change', renderRows);
		document.addEventListener('adminlanguagechange', () => {
			fillSelectOptions();
			renderRows();
			const status = byId('japanese-word-form-status');
			if (status?.dataset.key) status.textContent = t(status.dataset.key, status.dataset.key);
			setForm(editingId ? words.find((word) => word.id === editingId) : null);
		});
		await loadWords();
		setForm();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize, { once: true });
	} else {
		initialize();
	}
})();
