(() => {
	const HISTORY_API = '/api/admin/japanese/words/history';
	const BULK_DELETE_API = '/api/admin/japanese/words/bulk-delete';
	const selectedIds = new Set();
	let enhancing = false;
	let observer = null;

	function currentLanguage() {
		return window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja';
	}

	function copy() {
		return currentLanguage() === 'ko'
			? {
				selectAll: '모두 선택', selected: (count) => `선택 ${count}건`, deleteSelected: '선택 삭제',
				deleteTitle: '단어 일괄 삭제', deleteMessage: (count) => `선택한 ${count}개 단어를 삭제할까요?`, deleteConfirm: '삭제', cancel: '취소',
				deleteFailed: '선택한 단어를 삭제하지 못했습니다.', history: '이력보기', historyTitle: '단어 등록·변경 이력',
				historyLoading: '이력을 불러오는 중입니다…', historyEmpty: '기록된 이력이 없습니다.', historyFailed: '이력을 불러오지 못했습니다.',
				actionCreate: '신규 등록', actionMerge: '기존 단어에 추가', actionUpdate: '수정', actionDelete: '삭제',
				sourceManual: '직접 입력', sourceFile: '파일 등록', sourceLegacy: '기존 데이터', sourceLegacyDetail: '출처 기록 기능 추가 전 데이터',
				fileRow: (row) => row ? `${row}행` : '', admin: '작업자', close: '닫기',
			}
			: {
				selectAll: 'すべて選択', selected: (count) => `${count}件選択`, deleteSelected: '選択削除',
				deleteTitle: '単語を一括削除', deleteMessage: (count) => `選択した${count}件の単語を削除しますか？`, deleteConfirm: '削除', cancel: 'キャンセル',
				deleteFailed: '選択した単語を削除できませんでした。', history: '履歴を見る', historyTitle: '単語の登録・変更履歴',
				historyLoading: '履歴を読み込んでいます…', historyEmpty: '記録された履歴はありません。', historyFailed: '履歴を読み込めませんでした。',
				actionCreate: '新規登録', actionMerge: '既存単語へ追加', actionUpdate: '編集', actionDelete: '削除',
				sourceManual: '直接入力', sourceFile: 'ファイル登録', sourceLegacy: '既存データ', sourceLegacyDetail: '履歴記録機能の追加前データ',
				fileRow: (row) => row ? `${row}行` : '', admin: '担当', close: '閉じる',
			};
	}

	function injectStyle() {
		if (document.querySelector('link[data-japanese-history-bulk-style]')) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '/assets/css/admin/japanese-history-bulk.css';
		link.dataset.japaneseHistoryBulkStyle = 'true';
		document.head.appendChild(link);
	}

	function wordIdFromRow(row) {
		const text = row.querySelector('.admin-japanese-word-main span')?.textContent || '';
		const match = text.match(/#(\d+)/);
		return match ? Number(match[1]) : 0;
	}

	function currentlySelectableRows() {
		return [...document.querySelectorAll('#japanese-word-table-body > tr')]
			.filter((row) => row instanceof HTMLTableRowElement)
			.filter((row) => row.dataset.learningExcluded !== 'true');
	}

	function syncSelectionUi() {
		const labels = copy();
		const rows = currentlySelectableRows();
		const ids = rows.map(wordIdFromRow).filter(Boolean);
		const selectedVisible = ids.filter((id) => selectedIds.has(id));
		const allSelected = ids.length > 0 && selectedVisible.length === ids.length;
		const partial = selectedVisible.length > 0 && !allSelected;

		document.querySelectorAll('[data-japanese-select-all]').forEach((checkbox) => {
			if (!(checkbox instanceof HTMLInputElement)) return;
			checkbox.checked = allSelected;
			checkbox.indeterminate = partial;
		});
		document.querySelectorAll('[data-japanese-word-select]').forEach((checkbox) => {
			if (!(checkbox instanceof HTMLInputElement)) return;
			const id = Number(checkbox.dataset.wordId);
			checkbox.checked = selectedIds.has(id);
		});
		const count = document.getElementById('japanese-bulk-selected-count');
		if (count) count.textContent = labels.selected(selectedIds.size);
		const button = document.getElementById('japanese-bulk-delete');
		if (button instanceof HTMLButtonElement) {
			button.textContent = labels.deleteSelected;
			button.disabled = selectedIds.size === 0;
		}
		const toolbarLabel = document.getElementById('japanese-bulk-select-all-label');
		if (toolbarLabel) toolbarLabel.textContent = labels.selectAll;
	}

	function toggleAll(checked) {
		for (const row of currentlySelectableRows()) {
			const id = wordIdFromRow(row);
			if (!id) continue;
			if (checked) selectedIds.add(id);
			else selectedIds.delete(id);
		}
		syncSelectionUi();
	}

	function ensureToolbar() {
		if (document.getElementById('japanese-bulk-toolbar')) return;
		const table = document.getElementById('japanese-word-table-wrap');
		if (!table) return;
		const labels = copy();
		const toolbar = document.createElement('div');
		toolbar.id = 'japanese-bulk-toolbar';
		toolbar.className = 'admin-japanese-bulk-toolbar';

		const left = document.createElement('div');
		left.className = 'admin-japanese-bulk-toolbar-left';
		const selectLabel = document.createElement('label');
		selectLabel.className = 'admin-japanese-bulk-select-all';
		const select = document.createElement('input');
		select.type = 'checkbox';
		select.dataset.japaneseSelectAll = 'toolbar';
		select.addEventListener('change', () => toggleAll(select.checked));
		const selectText = document.createElement('span');
		selectText.id = 'japanese-bulk-select-all-label';
		selectText.textContent = labels.selectAll;
		selectLabel.append(select, selectText);
		const count = document.createElement('span');
		count.id = 'japanese-bulk-selected-count';
		count.className = 'admin-japanese-bulk-count';
		count.textContent = labels.selected(0);
		left.append(selectLabel, count);

		const right = document.createElement('div');
		right.className = 'admin-japanese-bulk-toolbar-right';
		const remove = document.createElement('button');
		remove.id = 'japanese-bulk-delete';
		remove.className = 'admin-japanese-bulk-delete';
		remove.type = 'button';
		remove.disabled = true;
		remove.textContent = labels.deleteSelected;
		remove.addEventListener('click', bulkDelete);
		right.appendChild(remove);
		toolbar.append(left, right);
		table.insertAdjacentElement('beforebegin', toolbar);
	}

	function ensureHeaderCheckbox() {
		const row = document.querySelector('.admin-japanese-table thead tr');
		if (!(row instanceof HTMLTableRowElement)) return;
		let cell = row.querySelector('.admin-japanese-table-select-head');
		if (!(cell instanceof HTMLTableCellElement)) {
			cell = document.createElement('th');
			cell.className = 'admin-japanese-table-select-head';
			row.insertBefore(cell, row.firstElementChild);
		}
		if (!cell.querySelector('input')) {
			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.dataset.japaneseSelectAll = 'header';
			checkbox.setAttribute('aria-label', copy().selectAll);
			checkbox.addEventListener('change', () => toggleAll(checkbox.checked));
			cell.appendChild(checkbox);
		}
	}

	function ensureRowControls(row) {
		if (!(row instanceof HTMLTableRowElement)) return;
		const id = wordIdFromRow(row);
		if (!id) return;

		let selectCell = row.querySelector('.admin-japanese-table-select-cell');
		if (!(selectCell instanceof HTMLTableCellElement)) {
			selectCell = document.createElement('td');
			selectCell.className = 'admin-japanese-table-select-cell';
			row.insertBefore(selectCell, row.firstElementChild);
		}
		if (!selectCell.querySelector('input')) {
			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.dataset.japaneseWordSelect = 'true';
			checkbox.dataset.wordId = String(id);
			checkbox.setAttribute('aria-label', `${copy().selectAll} #${id}`);
			checkbox.checked = selectedIds.has(id);
			checkbox.addEventListener('change', () => {
				if (checkbox.checked) selectedIds.add(id);
				else selectedIds.delete(id);
				syncSelectionUi();
			});
			selectCell.appendChild(checkbox);
		}

		const actions = row.querySelector('.admin-japanese-actions');
		if (!(actions instanceof HTMLElement) || actions.querySelector('[data-japanese-history-button]')) return;
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'admin-japanese-action admin-japanese-action-history';
		button.dataset.japaneseHistoryButton = 'true';
		button.dataset.wordId = String(id);
		button.textContent = copy().history;
		button.addEventListener('click', () => openHistory(id));
		const deleteButton = actions.querySelector('.admin-japanese-action-danger');
		if (deleteButton) actions.insertBefore(button, deleteButton);
		else actions.appendChild(button);
	}

	function enhanceTable() {
		if (enhancing) return;
		enhancing = true;
		try {
			ensureToolbar();
			ensureHeaderCheckbox();
			document.querySelectorAll('#japanese-word-table-body > tr').forEach(ensureRowControls);
			syncSelectionUi();
		} finally {
			enhancing = false;
		}
	}

	async function confirmBulkDelete(count) {
		const labels = copy();
		if (window.AdminCommon?.confirm) {
			return window.AdminCommon.confirm({
				titleFallback: labels.deleteTitle,
				messageFallback: labels.deleteMessage(count),
				confirmFallback: labels.deleteConfirm,
				cancelFallback: labels.cancel,
			});
		}
		return window.confirm(labels.deleteMessage(count));
	}

	async function bulkDelete() {
		const ids = [...selectedIds];
		if (!ids.length) return;
		if (!(await confirmBulkDelete(ids.length))) return;
		const button = document.getElementById('japanese-bulk-delete');
		if (button instanceof HTMLButtonElement) button.disabled = true;
		try {
			const response = await fetch(BULK_DELETE_API, {
				method: 'POST',
				credentials: 'same-origin',
				cache: 'no-store',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ids }),
			});
			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error || `HTTP_${response.status}`);
			window.location.reload();
		} catch (error) {
			console.error('Failed to bulk delete Japanese words', error);
			window.alert(copy().deleteFailed);
			if (button instanceof HTMLButtonElement) button.disabled = false;
		}
	}

	function historyActionLabel(action) {
		const labels = copy();
		if (action === 'merge') return labels.actionMerge;
		if (action === 'update') return labels.actionUpdate;
		if (action === 'delete') return labels.actionDelete;
		return labels.actionCreate;
	}

	function historySourceLabel(entry) {
		const labels = copy();
		if (entry?.sourceType === 'file') return labels.sourceFile;
		if (entry?.sourceType === 'legacy') return labels.sourceLegacy;
		return labels.sourceManual;
	}

	function formatHistoryTime(value) {
		const date = new Date(value || '');
		if (Number.isNaN(date.getTime())) return value || '—';
		return new Intl.DateTimeFormat(currentLanguage() === 'ko' ? 'ko-KR' : 'ja-JP', {
			year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
			timeZone: 'Asia/Tokyo',
		}).format(date);
	}

	function closeHistory(backdrop) {
		backdrop.remove();
		document.body.style.removeProperty('overflow');
	}

	function createHistoryModal(wordId) {
		const labels = copy();
		const backdrop = document.createElement('div');
		backdrop.className = 'japanese-word-history-backdrop';
		const modal = document.createElement('section');
		modal.className = 'japanese-word-history-modal';
		modal.setAttribute('role', 'dialog');
		modal.setAttribute('aria-modal', 'true');

		const head = document.createElement('div');
		head.className = 'japanese-word-history-head';
		const heading = document.createElement('div');
		const title = document.createElement('h3');
		title.textContent = labels.historyTitle;
		const meta = document.createElement('p');
		meta.textContent = `#${wordId}`;
		heading.append(title, meta);
		const close = document.createElement('button');
		close.className = 'japanese-word-history-close';
		close.type = 'button';
		close.textContent = '×';
		close.title = labels.close;
		close.setAttribute('aria-label', labels.close);
		close.addEventListener('click', () => closeHistory(backdrop));
		head.append(heading, close);

		const body = document.createElement('div');
		body.className = 'japanese-word-history-body';
		const loading = document.createElement('div');
		loading.className = 'japanese-word-history-loading';
		loading.textContent = labels.historyLoading;
		body.appendChild(loading);
		modal.append(head, body);
		backdrop.appendChild(modal);
		backdrop.addEventListener('mousedown', (event) => {
			if (event.target === backdrop) closeHistory(backdrop);
		});
		document.body.appendChild(backdrop);
		document.body.style.overflow = 'hidden';
		return { backdrop, title, meta, body };
	}

	async function openHistory(wordId) {
		const modal = createHistoryModal(wordId);
		const labels = copy();
		try {
			const response = await fetch(`${HISTORY_API}?id=${encodeURIComponent(wordId)}`, { credentials: 'same-origin', cache: 'no-store' });
			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error || `HTTP_${response.status}`);
			modal.title.textContent = `${result.word?.word || ''} · ${labels.historyTitle}`;
			modal.meta.textContent = [`#${wordId}`, result.word?.reading].filter(Boolean).join(' · ');
			modal.body.replaceChildren();
			const history = Array.isArray(result.history) ? result.history : [];
			if (!history.length) {
				const empty = document.createElement('div');
				empty.className = 'japanese-word-history-empty';
				empty.textContent = labels.historyEmpty;
				modal.body.appendChild(empty);
				return;
			}
			const list = document.createElement('div');
			list.className = 'japanese-word-history-list';
			for (const entry of history) {
				const item = document.createElement('article');
				item.className = 'japanese-word-history-item';
				const time = document.createElement('div');
				time.className = 'japanese-word-history-time';
				time.textContent = formatHistoryTime(entry.createdAt);
				const main = document.createElement('div');
				main.className = 'japanese-word-history-main';
				const titleLine = document.createElement('div');
				titleLine.className = 'japanese-word-history-titleline';
				const action = document.createElement('span');
				action.className = `japanese-word-history-action${entry.action === 'delete' ? ' is-delete' : entry.action === 'merge' ? ' is-merge' : ''}`;
				action.textContent = historyActionLabel(entry.action);
				const source = document.createElement('span');
				source.className = 'japanese-word-history-source';
				source.textContent = historySourceLabel(entry);
				titleLine.append(action, source);
				main.appendChild(titleLine);

				if (entry.sourceType === 'file') {
					const file = document.createElement('strong');
					file.className = 'japanese-word-history-file';
					const rowLabel = labels.fileRow(entry.sourceRow);
					file.textContent = [entry.sourceName || '—', rowLabel].filter(Boolean).join(' · ');
					main.appendChild(file);
				} else if (entry.sourceType === 'legacy') {
					const file = document.createElement('strong');
					file.className = 'japanese-word-history-file';
					file.textContent = labels.sourceLegacyDetail;
					main.appendChild(file);
				}

				const adminName = entry.admin?.displayName || entry.admin?.username || '';
				if (adminName) {
					const admin = document.createElement('span');
					admin.className = 'japanese-word-history-meta';
					admin.textContent = `${labels.admin}: ${adminName}`;
					main.appendChild(admin);
				}
				item.append(time, main);
				list.appendChild(item);
			}
			modal.body.appendChild(list);
		} catch (error) {
			console.error('Failed to load Japanese word history', error);
			modal.body.replaceChildren();
			const errorNode = document.createElement('div');
			errorNode.className = 'japanese-word-history-error';
			errorNode.textContent = labels.historyFailed;
			modal.body.appendChild(errorNode);
		}
	}

	function syncLanguage() {
		document.querySelectorAll('[data-japanese-history-button]').forEach((button) => {
			if (button instanceof HTMLButtonElement) button.textContent = copy().history;
		});
		syncSelectionUi();
	}

	function observeTable() {
		const body = document.getElementById('japanese-word-table-body');
		if (!body || observer) return;
		observer = new MutationObserver(() => window.setTimeout(enhanceTable, 0));
		observer.observe(body, { childList: true, subtree: false });
	}

	async function initialize() {
		injectStyle();
		await Promise.all([window.AdminCommon?.ready, window.AdminI18n?.ready]);
		ensureToolbar();
		observeTable();
		enhanceTable();
		document.addEventListener('adminlanguagechange', syncLanguage);
		document.addEventListener('japaneselearningfilterchange', () => window.setTimeout(syncSelectionUi, 0));
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
