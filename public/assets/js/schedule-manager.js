(() => {
	const PUBLIC_API = '/api/public/dashboard/schedules?kind=calendar';
	const ADMIN_API = '/api/admin/dashboard/schedules?kind=calendar';
	const ADMIN_DETAIL_API = '/api/admin/dashboard/schedules/detail?kind=calendar';

	function contextOf(root) {
		return root.dataset.context === 'admin' ? 'admin' : root.dataset.context === 'public' ? 'public' : 'home';
	}

	function languageOf(root) {
		if (contextOf(root) === 'admin') return window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja';
		if (contextOf(root) === 'home') return document.body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
		return root.dataset.language === 'ko' ? 'ko' : 'ja';
	}

	function copy(root) {
		return languageOf(root) === 'ko'
			? {
				kicker: 'SCHEDULE', title: '일정관리', description: '날짜 없음, 하루 일정, 기간 일정을 목록과 월간 달력에서 관리합니다.',
				add: '+ 일정 추가', listTitle: '일정 목록', listHint: '작성일과 내용만 표시',
				created: '작성일', content: '내용', action: '관리', empty: '등록된 일정이 없습니다.',
				today: '오늘', weekdays: ['일', '월', '화', '수', '목', '금', '토'],
				createTitle: '일정 추가', editTitle: '일정 수정', contentLabel: '내용', dateType: '날짜',
				noDate: '날짜 없음', singleDate: '하루 일정', dateRange: '기간 일정', date: '일정일', startDate: '시작일', endDate: '종료일',
				cancel: '취소', save: '저장', remove: '삭제', edit: '일정 수정', selectMonth: '연도와 월 선택',
				deleteConfirm: '이 일정을 삭제할까요?', saveFailed: '일정을 저장하지 못했습니다.', invalidRange: '종료일은 시작일과 같거나 이후여야 합니다.',
				deleteFailed: '일정을 삭제하지 못했습니다.', loadFailed: '일정을 불러오지 못했습니다.',
				dayTitle: (date) => `${date} 일정`, chooseSchedule: '수정할 일정을 선택하세요.', more: (count) => `+${count}개`,
			}
			: {
				kicker: 'SCHEDULE', title: '予定管理', description: '日付なし・1日の予定・期間予定を一覧と月間カレンダーで管理します。',
				add: '+ 予定追加', listTitle: '予定一覧', listHint: '登録日と内容のみ表示',
				created: '登録日', content: '内容', action: '管理', empty: '登録された予定はありません。',
				today: '今日', weekdays: ['日', '月', '火', '水', '木', '金', '土'],
				createTitle: '予定を追加', editTitle: '予定を編集', contentLabel: '内容', dateType: '日付',
				noDate: '日付なし', singleDate: '1日の予定', dateRange: '期間予定', date: '予定日', startDate: '開始日', endDate: '終了日',
				cancel: 'キャンセル', save: '保存', remove: '削除', edit: '予定を編集', selectMonth: '年と月を選択',
				deleteConfirm: 'この予定を削除しますか？', saveFailed: '予定を保存できませんでした。', invalidRange: '終了日は開始日以降を選択してください。',
				deleteFailed: '予定を削除できませんでした。', loadFailed: '予定を読み込めませんでした。',
				dayTitle: (date) => `${date} の予定`, chooseSchedule: '編集する予定を選択してください。', more: (count) => `+${count}件`,
			};
	}

	function tokyoToday() {
		const parts = new Intl.DateTimeFormat('en-CA', {
			timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
		}).formatToParts(new Date());
		const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
		return `${map.year}-${map.month}-${map.day}`;
	}

	function validDate(value) {
		return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
	}

	function shortDate(root, value) {
		if (!value) return '—';
		const source = String(value).slice(0, 10);
		if (!validDate(source)) return source;
		const date = new Date(`${source}T00:00:00Z`);
		return new Intl.DateTimeFormat(languageOf(root) === 'ko' ? 'ko-KR' : 'ja-JP', {
			year: '2-digit', month: '2-digit', day: '2-digit', timeZone: 'UTC',
		}).format(date);
	}

	function fullDate(root, value) {
		if (!validDate(value)) return value || '—';
		const date = new Date(`${value}T00:00:00Z`);
		return new Intl.DateTimeFormat(languageOf(root) === 'ko' ? 'ko-KR' : 'ja-JP', {
			year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC',
		}).format(date);
	}

	function monthLabel(root, date) {
		return new Intl.DateTimeFormat(languageOf(root) === 'ko' ? 'ko-KR' : 'ja-JP', {
			year: 'numeric', month: 'long', timeZone: 'UTC',
		}).format(date);
	}

	function dateKey(date) {
		return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
	}

	function createElement(tag, className, text) {
		const element = document.createElement(tag);
		if (className) element.className = className;
		if (text !== undefined) element.textContent = text;
		return element;
	}

	async function jsonRequest(url, options = {}) {
		const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
		const result = await response.json().catch(() => null);
		if (!response.ok || !result?.ok) throw new Error(result?.error || `HTTP_${response.status}`);
		return result;
	}

	async function resolveAdmin(root) {
		if (contextOf(root) === 'admin') {
			await window.AdminCommon?.ready;
			return true;
		}
		try {
			const response = await fetch('/api/admin/auth/session', { credentials: 'same-origin', cache: 'no-store' });
			const result = await response.json().catch(() => null);
			return response.ok && result?.authenticated === true;
		} catch {
			return false;
		}
	}

	function sorted(items) {
		return [...items].sort((a, b) => {
			const dateA = validDate(a.startDate) ? a.startDate : '9999-12-31';
			const dateB = validDate(b.startDate) ? b.startDate : '9999-12-31';
			if (dateA !== dateB) return dateA.localeCompare(dateB);
			return Number(a.id || 0) - Number(b.id || 0);
		});
	}

	function closeModal(backdrop) {
		backdrop.remove();
		document.body.style.removeProperty('overflow');
	}

	function scheduleMode(item, presetDate) {
		if (!item?.id) return presetDate ? 'single' : 'none';
		if (!validDate(item.startDate)) return 'none';
		return validDate(item.endDate) ? 'range' : 'single';
	}

	function editorModal(root, item, refresh, presetDate = '') {
		const labels = copy(root);
		const editing = Boolean(item?.id);
		const backdrop = createElement('div', 'schedule-modal-backdrop');
		const dialog = createElement('section', 'schedule-modal');
		dialog.setAttribute('role', 'dialog');
		dialog.setAttribute('aria-modal', 'true');
		dialog.append(createElement('h3', '', editing ? labels.editTitle : labels.createTitle));

		const contentLabel = createElement('label', 'schedule-modal-field');
		contentLabel.append(createElement('span', '', labels.contentLabel));
		const contentInput = document.createElement('input');
		contentInput.type = 'text';
		contentInput.maxLength = 500;
		contentInput.value = editing ? String(item.content || '') : '';
		contentLabel.append(contentInput);
		dialog.appendChild(contentLabel);

		const modeField = createElement('fieldset', 'schedule-date-mode');
		const legend = createElement('legend', '', labels.dateType);
		modeField.appendChild(legend);
		const modeName = `schedule-date-mode-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const initialMode = scheduleMode(item, presetDate);
		const radios = new Map();
		for (const [value, labelText] of [['none', labels.noDate], ['single', labels.singleDate], ['range', labels.dateRange]]) {
			const label = createElement('label', 'schedule-date-mode-option');
			const radio = document.createElement('input');
			radio.type = 'radio';
			radio.name = modeName;
			radio.value = value;
			radio.checked = value === initialMode;
			label.append(radio, document.createTextNode(labelText));
			modeField.appendChild(label);
			radios.set(value, radio);
		}
		dialog.appendChild(modeField);

		const singleField = createElement('label', 'schedule-modal-field schedule-date-single');
		singleField.append(createElement('span', '', labels.date));
		const singleInput = document.createElement('input');
		singleInput.type = 'date';
		singleInput.value = initialMode === 'single' ? String(item?.startDate || presetDate || '') : String(presetDate || item?.startDate || '');
		singleField.appendChild(singleInput);

		const rangeFields = createElement('div', 'schedule-date-range-fields');
		const startField = createElement('label', 'schedule-modal-field');
		startField.append(createElement('span', '', labels.startDate));
		const startInput = document.createElement('input');
		startInput.type = 'date';
		startInput.value = String(item?.startDate || presetDate || '');
		startField.appendChild(startInput);
		const endField = createElement('label', 'schedule-modal-field');
		endField.append(createElement('span', '', labels.endDate));
		const endInput = document.createElement('input');
		endInput.type = 'date';
		endInput.value = String(item?.endDate || item?.startDate || presetDate || '');
		endField.appendChild(endInput);
		rangeFields.append(startField, endField);
		dialog.append(singleField, rangeFields);

		function currentMode() {
			return [...radios.entries()].find(([, radio]) => radio.checked)?.[0] || 'none';
		}

		function syncDateFields() {
			const mode = currentMode();
			singleField.hidden = mode !== 'single';
			rangeFields.hidden = mode !== 'range';
			if (mode === 'range' && !startInput.value && singleInput.value) startInput.value = singleInput.value;
			if (mode === 'range' && !endInput.value && startInput.value) endInput.value = startInput.value;
			if (mode === 'single' && !singleInput.value && startInput.value) singleInput.value = startInput.value;
		}
		for (const radio of radios.values()) radio.addEventListener('change', syncDateFields);
		syncDateFields();

		const actions = createElement('div', 'schedule-modal-actions');
		if (editing) {
			const remove = createElement('button', 'is-danger', labels.remove);
			remove.type = 'button';
			remove.addEventListener('click', async () => {
				if (!window.confirm(labels.deleteConfirm)) return;
				remove.disabled = true;
				try {
					await jsonRequest(`${ADMIN_DETAIL_API}&id=${encodeURIComponent(item.id)}`, { method: 'DELETE' });
					closeModal(backdrop);
					await refresh();
				} catch (error) {
					console.error(error);
					window.alert(labels.deleteFailed);
					remove.disabled = false;
				}
			});
			actions.appendChild(remove);
		}

		const cancel = createElement('button', '', labels.cancel);
		cancel.type = 'button';
		cancel.addEventListener('click', () => closeModal(backdrop));
		const save = createElement('button', 'is-primary', labels.save);
		save.type = 'button';
		save.addEventListener('click', async () => {
			const content = contentInput.value.trim();
			if (!content) {
				contentInput.focus();
				return;
			}

			const mode = currentMode();
			let startDate = null;
			let endDate = null;
			if (mode === 'single') {
				if (!singleInput.value) {
					singleInput.focus();
					return;
				}
				startDate = singleInput.value;
			} else if (mode === 'range') {
				if (!startInput.value) {
					startInput.focus();
					return;
				}
				if (!endInput.value) {
					endInput.focus();
					return;
				}
				if (endInput.value < startInput.value) {
					window.alert(labels.invalidRange);
					endInput.focus();
					return;
				}
				startDate = startInput.value;
				endDate = endInput.value;
			}

			save.disabled = true;
			try {
				await jsonRequest(editing ? `${ADMIN_DETAIL_API}&id=${encodeURIComponent(item.id)}` : ADMIN_API, {
					method: editing ? 'PATCH' : 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ content, startDate, endDate }),
				});
				closeModal(backdrop);
				await refresh();
			} catch (error) {
				console.error(error);
				window.alert(labels.saveFailed);
				save.disabled = false;
			}
		});
		actions.append(cancel, save);
		dialog.appendChild(actions);
		backdrop.appendChild(dialog);
		backdrop.addEventListener('mousedown', (event) => {
			if (event.target === backdrop) closeModal(backdrop);
		});
		document.body.appendChild(backdrop);
		document.body.style.overflow = 'hidden';
		window.setTimeout(() => contentInput.focus(), 0);
	}

	function dayChooser(root, date, items, refresh) {
		const labels = copy(root);
		const backdrop = createElement('div', 'schedule-modal-backdrop');
		const dialog = createElement('section', 'schedule-modal schedule-day-chooser');
		dialog.setAttribute('role', 'dialog');
		dialog.setAttribute('aria-modal', 'true');
		dialog.append(createElement('h3', '', labels.dayTitle(fullDate(root, date))));
		dialog.append(createElement('p', 'schedule-day-chooser-hint', labels.chooseSchedule));
		const list = createElement('div', 'schedule-day-chooser-list');
		for (const item of items) {
			const button = createElement('button', 'schedule-day-chooser-item', item.content || '');
			button.type = 'button';
			button.addEventListener('click', () => {
				closeModal(backdrop);
				editorModal(root, item, refresh);
			});
			list.appendChild(button);
		}
		const actions = createElement('div', 'schedule-modal-actions');
		const cancel = createElement('button', '', labels.cancel);
		cancel.type = 'button';
		cancel.addEventListener('click', () => closeModal(backdrop));
		actions.appendChild(cancel);
		dialog.append(list, actions);
		backdrop.appendChild(dialog);
		backdrop.addEventListener('mousedown', (event) => {
			if (event.target === backdrop) closeModal(backdrop);
		});
		document.body.appendChild(backdrop);
		document.body.style.overflow = 'hidden';
	}

	function renderList(root, panel, items, admin, refresh) {
		const labels = copy(root);
		panel.replaceChildren();
		panel.className = `schedule-manager-panel schedule-list-panel${admin ? ' is-admin' : ''}`;

		const header = createElement('div', 'schedule-list-head');
		const heading = createElement('div');
		heading.append(createElement('strong', '', labels.listTitle), createElement('span', '', labels.listHint));
		header.appendChild(heading);
		panel.appendChild(header);

		const tableHead = createElement('div', 'schedule-list-table-head');
		tableHead.append(createElement('span', '', labels.created), createElement('span', '', labels.content));
		if (admin) tableHead.append(createElement('span', '', labels.action));
		panel.appendChild(tableHead);

		const body = createElement('div', 'schedule-list-body');
		if (!items.length) {
			body.append(createElement('div', 'schedule-list-empty', labels.empty));
			panel.appendChild(body);
			return;
		}

		for (const item of items) {
			const row = createElement('div', `schedule-list-row${admin ? ' is-editable' : ''}`);
			row.append(createElement('span', 'schedule-list-date', shortDate(root, item.createdAt)));
			const content = createElement('div', 'schedule-list-content');
			content.append(createElement('strong', '', item.content || ''));
			row.appendChild(content);
			if (admin) {
				const actions = createElement('div', 'schedule-item-actions');
				const edit = createElement('button', 'schedule-item-action schedule-item-gear', '⚙');
				edit.type = 'button';
				edit.title = labels.edit;
				edit.setAttribute('aria-label', labels.edit);
				edit.addEventListener('click', () => editorModal(root, item, refresh));
				actions.appendChild(edit);
				row.appendChild(actions);
			}
			body.appendChild(row);
		}
		panel.appendChild(body);
	}

	function scheduleDates(item) {
		if (!validDate(item?.startDate)) return [];
		const endDate = validDate(item?.endDate) ? item.endDate : item.startDate;
		if (endDate < item.startDate) return [];
		const result = [];
		let current = Date.parse(`${item.startDate}T00:00:00Z`);
		const end = Date.parse(`${endDate}T00:00:00Z`);
		let guard = 0;
		while (current <= end && guard < 3660) {
			result.push(dateKey(new Date(current)));
			current += 86400000;
			guard += 1;
		}
		return result;
	}

	function makeMonthPicker(root, cursor, setCursor) {
		const labels = copy(root);
		const wrap = createElement('div', 'schedule-calendar-month-wrap');
		const button = createElement('button', 'schedule-calendar-month-button', monthLabel(root, cursor));
		button.type = 'button';
		button.title = labels.selectMonth;
		button.setAttribute('aria-label', labels.selectMonth);
		button.setAttribute('aria-expanded', 'false');
		const picker = createElement('div', 'schedule-calendar-month-picker');
		picker.hidden = true;

		const yearSelect = document.createElement('select');
		yearSelect.className = 'schedule-calendar-year-select';
		yearSelect.setAttribute('aria-label', languageOf(root) === 'ko' ? '연도 선택' : '年を選択');
		for (let year = 2000; year <= 2100; year += 1) {
			const option = document.createElement('option');
			option.value = String(year);
			option.textContent = languageOf(root) === 'ko' ? `${year}년` : `${year}年`;
			option.selected = year === cursor.getUTCFullYear();
			yearSelect.appendChild(option);
		}

		const months = createElement('div', 'schedule-calendar-month-grid');
		for (let month = 0; month < 12; month += 1) {
			const monthButton = createElement('button', `schedule-calendar-month-option${month === cursor.getUTCMonth() ? ' is-current' : ''}`, languageOf(root) === 'ko' ? `${month + 1}월` : `${month + 1}月`);
			monthButton.type = 'button';
			monthButton.addEventListener('click', () => {
				const year = Number(yearSelect.value);
				setCursor(new Date(Date.UTC(year, month, 1)));
			});
			months.appendChild(monthButton);
		}
		picker.append(yearSelect, months);
		wrap.append(button, picker);

		button.addEventListener('click', (event) => {
			event.stopPropagation();
			picker.hidden = !picker.hidden;
			button.setAttribute('aria-expanded', picker.hidden ? 'false' : 'true');
		});
		picker.addEventListener('click', (event) => event.stopPropagation());
		document.addEventListener('click', () => {
			if (!picker.hidden) {
				picker.hidden = true;
				button.setAttribute('aria-expanded', 'false');
			}
		}, { once: true });
		return wrap;
	}

	function installSwipe(grid, cursor, setCursor) {
		let pointerId = null;
		let startX = 0;
		let startY = 0;
		let currentX = 0;
		let currentY = 0;

		function clear() {
			pointerId = null;
			grid.classList.remove('is-dragging');
		}

		grid.addEventListener('pointerdown', (event) => {
			if (event.pointerType === 'mouse' && event.button !== 0) return;
			pointerId = event.pointerId;
			startX = currentX = event.clientX;
			startY = currentY = event.clientY;
			try { grid.setPointerCapture(event.pointerId); } catch {}
		});
		grid.addEventListener('pointermove', (event) => {
			if (pointerId !== event.pointerId) return;
			currentX = event.clientX;
			currentY = event.clientY;
			if (Math.abs(currentX - startX) > 12) grid.classList.add('is-dragging');
		});
		grid.addEventListener('pointerup', (event) => {
			if (pointerId !== event.pointerId) return;
			currentX = event.clientX;
			currentY = event.clientY;
			const dx = currentX - startX;
			const dy = currentY - startY;
			clear();
			if (Math.abs(dx) < 55 || Math.abs(dx) <= Math.abs(dy) * 1.15) return;
			const delta = dx < 0 ? 1 : -1;
			setCursor(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + delta, 1)));
		});
		grid.addEventListener('pointercancel', clear);
	}

	function renderCalendar(root, panel, items, admin, refresh, cursor, setCursor) {
		const labels = copy(root);
		panel.replaceChildren();
		panel.className = `schedule-manager-panel schedule-calendar-panel${admin ? ' is-admin' : ''}`;

		const header = createElement('div', 'schedule-calendar-head');
		const monthPicker = makeMonthPicker(root, cursor, setCursor);
		const controls = createElement('div', 'schedule-calendar-controls');
		const prev = createElement('button', 'schedule-calendar-nav', '‹');
		prev.type = 'button';
		prev.setAttribute('aria-label', languageOf(root) === 'ko' ? '이전 달' : '前月');
		const today = createElement('button', 'schedule-manager-today', labels.today);
		today.type = 'button';
		const next = createElement('button', 'schedule-calendar-nav', '›');
		next.type = 'button';
		next.setAttribute('aria-label', languageOf(root) === 'ko' ? '다음 달' : '翌月');
		prev.addEventListener('click', () => setCursor(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - 1, 1))));
		today.addEventListener('click', () => {
			const now = new Date(`${tokyoToday()}T00:00:00Z`);
			setCursor(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
		});
		next.addEventListener('click', () => setCursor(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))));
		controls.append(prev, today, next);
		header.append(monthPicker, controls);
		panel.appendChild(header);

		const weekdays = createElement('div', 'schedule-calendar-weekdays');
		for (const weekday of labels.weekdays) weekdays.append(createElement('span', '', weekday));
		panel.appendChild(weekdays);

		const eventMap = new Map();
		for (const item of items) {
			for (const key of scheduleDates(item)) {
				if (!eventMap.has(key)) eventMap.set(key, []);
				eventMap.get(key).push(item);
			}
		}

		const grid = createElement('div', 'schedule-calendar-grid');
		const year = cursor.getUTCFullYear();
		const month = cursor.getUTCMonth();
		const first = new Date(Date.UTC(year, month, 1));
		const start = new Date(Date.UTC(year, month, 1 - first.getUTCDay()));
		const todayKey = tokyoToday();

		for (let index = 0; index < 42; index += 1) {
			const date = new Date(start.getTime() + index * 86400000);
			const key = dateKey(date);
			const outside = date.getUTCMonth() !== month;
			const day = createElement('div', `schedule-calendar-day${outside ? ' is-outside' : ''}${key === todayKey ? ' is-today' : ''}${admin && !outside ? ' is-clickable' : ''}`);
			day.dataset.date = key;
			day.append(createElement('span', 'schedule-calendar-date', String(date.getUTCDate())));
			const events = createElement('div', 'schedule-calendar-events');
			const dayItems = eventMap.get(key) || [];
			for (const item of dayItems.slice(0, 3)) {
				const ranged = validDate(item.endDate);
				const classes = ['schedule-calendar-event'];
				if (ranged) classes.push('is-range');
				if (ranged && key === item.startDate) classes.push('is-range-start');
				if (ranged && key === item.endDate) classes.push('is-range-end');
				const event = createElement(admin ? 'button' : 'span', classes.join(' '), item.content || '');
				if (event instanceof HTMLButtonElement) {
					event.type = 'button';
					event.addEventListener('click', (clickEvent) => {
						clickEvent.stopPropagation();
						editorModal(root, item, refresh);
					});
				}
				const period = ranged ? `${fullDate(root, item.startDate)} ~ ${fullDate(root, item.endDate)}` : fullDate(root, item.startDate);
				event.title = `${item.content || ''} · ${period}`;
				events.appendChild(event);
			}
			if (dayItems.length > 3) events.append(createElement('span', 'schedule-calendar-more', labels.more(dayItems.length - 3)));
			day.appendChild(events);

			if (admin && !outside) {
				day.setAttribute('role', 'button');
				day.tabIndex = 0;
				const openDay = () => {
					if (grid.classList.contains('is-dragging')) return;
					if (dayItems.length === 0) editorModal(root, null, refresh, key);
					else if (dayItems.length === 1) editorModal(root, dayItems[0], refresh);
					else dayChooser(root, key, dayItems, refresh);
				};
				day.addEventListener('click', openDay);
				day.addEventListener('keydown', (event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						openDay();
					}
				});
			}
			grid.appendChild(day);
		}
		panel.appendChild(grid);
		installSwipe(grid, cursor, setCursor);
	}

	async function initializeRoot(root) {
		let admin = await resolveAdmin(root);
		let cursor = (() => {
			const today = new Date(`${tokyoToday()}T00:00:00Z`);
			return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
		})();
		let items = [];

		root.classList.add('schedule-manager');
		root.classList.toggle('is-embedded-home', contextOf(root) === 'home');
		root.classList.toggle('is-admin-page', contextOf(root) === 'admin');

		async function refresh() {
			const labels = copy(root);
			root.setAttribute('aria-busy', 'true');
			try {
				if (contextOf(root) !== 'admin') admin = await resolveAdmin(root);
				const result = await jsonRequest(admin ? ADMIN_API : PUBLIC_API);
				items = sorted(Array.isArray(result.schedules) ? result.schedules : []);
				render();
			} catch (error) {
				console.error('Failed to load calendar schedules', error);
				root.replaceChildren(createElement('div', 'schedule-list-empty', labels.loadFailed));
			} finally {
				root.removeAttribute('aria-busy');
			}
		}

		function setCursor(nextCursor) {
			cursor = nextCursor;
			render();
		}

		function render() {
			const labels = copy(root);
			root.replaceChildren();
			const head = createElement('div', 'schedule-manager-head');
			const titleWrap = createElement('div');
			titleWrap.append(createElement('span', 'schedule-manager-kicker', labels.kicker), createElement('h2', '', labels.title), createElement('p', '', labels.description));
			head.appendChild(titleWrap);
			if (admin) {
				const actions = createElement('div', 'schedule-manager-actions');
				const add = createElement('button', 'schedule-manager-add', labels.add);
				add.type = 'button';
				add.addEventListener('click', () => editorModal(root, null, refresh));
				actions.appendChild(add);
				head.appendChild(actions);
			}

			const grid = createElement('div', 'schedule-manager-grid');
			const listPanel = createElement('section', 'schedule-manager-panel schedule-list-panel');
			const calendarPanel = createElement('section', 'schedule-manager-panel schedule-calendar-panel');
			grid.append(listPanel, calendarPanel);
			root.append(head, grid);
			renderList(root, listPanel, items, admin, refresh);
			renderCalendar(root, calendarPanel, items, admin, refresh, cursor, setCursor);
		}

		await refresh();
		if (contextOf(root) === 'home') {
			document.querySelectorAll('[data-home-language]').forEach((button) => {
				button.addEventListener('click', () => window.setTimeout(refresh, 30));
			});
		}
		if (contextOf(root) === 'admin') {
			document.addEventListener('adminlanguagechange', () => window.setTimeout(refresh, 0));
		}
	}

	function initialize() {
		document.querySelectorAll('[data-schedule-manager]').forEach((root) => {
			if (root instanceof HTMLElement && root.dataset.scheduleInitialized !== 'true') {
				root.dataset.scheduleInitialized = 'true';
				initializeRoot(root);
			}
		});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
