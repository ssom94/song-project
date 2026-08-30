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
				kicker: 'SCHEDULE', title: '일정관리', description: '일정 목록과 월간 달력에서 마감일을 확인합니다.',
				add: '+ 일정 추가', listTitle: '일정 목록', listHint: '마감일이 가까운 순서',
				created: '작성일', content: '내용', action: '관리', empty: '등록된 일정이 없습니다.',
				today: '오늘', weekdays: ['일', '월', '화', '수', '목', '금', '토'],
				createTitle: '일정 추가', editTitle: '일정 수정', contentLabel: '내용', dueDate: '마감일',
				cancel: '취소', save: '저장', remove: '삭제', edit: '일정 수정',
				deleteConfirm: '이 일정을 삭제할까요?', saveFailed: '일정을 저장하지 못했습니다.',
				deleteFailed: '일정을 삭제하지 못했습니다.', loadFailed: '일정을 불러오지 못했습니다.',
				dayTitle: (date) => `${date} 일정`, chooseSchedule: '수정할 일정을 선택하세요.', more: (count) => `+${count}개`,
			}
			: {
				kicker: 'SCHEDULE', title: '予定管理', description: '予定一覧と月間カレンダーで締切日を確認します。',
				add: '+ 予定追加', listTitle: '予定一覧', listHint: '締切日が近い順',
				created: '登録日', content: '内容', action: '管理', empty: '登録された予定はありません。',
				today: '今日', weekdays: ['日', '月', '火', '水', '木', '金', '土'],
				createTitle: '予定を追加', editTitle: '予定を編集', contentLabel: '内容', dueDate: '締切日',
				cancel: 'キャンセル', save: '保存', remove: '削除', edit: '予定を編集',
				deleteConfirm: 'この予定を削除しますか？', saveFailed: '予定を保存できませんでした。',
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
		if (response.status === 401 && contextOf(document.querySelector('[data-schedule-manager]') || document.body) === 'admin') {
			window.location.replace('/admin/login/');
		}
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
			const dateCompare = String(a.dueDate || '9999-12-31').localeCompare(String(b.dueDate || '9999-12-31'));
			if (dateCompare !== 0) return dateCompare;
			return Number(a.id || 0) - Number(b.id || 0);
		});
	}

	function closeModal(backdrop) {
		backdrop.remove();
		document.body.style.removeProperty('overflow');
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

		const dateLabel = createElement('label', 'schedule-modal-field');
		dateLabel.append(createElement('span', '', labels.dueDate));
		const dateInput = document.createElement('input');
		dateInput.type = 'date';
		dateInput.required = true;
		dateInput.value = editing ? String(item.dueDate || '') : presetDate;
		dateLabel.append(dateInput);

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
			if (!dateInput.value) {
				dateInput.focus();
				return;
			}
			save.disabled = true;
			try {
				await jsonRequest(editing ? `${ADMIN_DETAIL_API}&id=${encodeURIComponent(item.id)}` : ADMIN_API, {
					method: editing ? 'PATCH' : 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ content, dueDate: dateInput.value }),
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
		dialog.append(contentLabel, dateLabel, actions);
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

	function renderCalendar(root, panel, items, admin, refresh, cursor, setCursor) {
		const labels = copy(root);
		panel.replaceChildren();
		panel.className = `schedule-manager-panel schedule-calendar-panel${admin ? ' is-admin' : ''}`;

		const header = createElement('div', 'schedule-calendar-head');
		const title = createElement('strong', 'schedule-calendar-month', monthLabel(root, cursor));
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
		header.append(title, controls);
		panel.appendChild(header);

		const weekdays = createElement('div', 'schedule-calendar-weekdays');
		for (const weekday of labels.weekdays) weekdays.append(createElement('span', '', weekday));
		panel.appendChild(weekdays);

		const eventMap = new Map();
		for (const item of items) {
			if (!validDate(item.dueDate)) continue;
			if (!eventMap.has(item.dueDate)) eventMap.set(item.dueDate, []);
			eventMap.get(item.dueDate).push(item);
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
				const event = createElement(admin ? 'button' : 'span', 'schedule-calendar-event', item.content || '');
				if (event instanceof HTMLButtonElement) {
					event.type = 'button';
					event.addEventListener('click', (clickEvent) => {
						clickEvent.stopPropagation();
						editorModal(root, item, refresh);
					});
				}
				event.title = `${item.content || ''} · ${fullDate(root, key)}`;
				events.appendChild(event);
			}
			if (dayItems.length > 3) events.append(createElement('span', 'schedule-calendar-more', labels.more(dayItems.length - 3)));
			day.appendChild(events);

			if (admin && !outside) {
				day.setAttribute('role', 'button');
				day.tabIndex = 0;
				const openDay = () => {
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
