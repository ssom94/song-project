(() => {
	const PUBLIC_SCHEDULE_API = '/api/public/dashboard/schedules';
	const ADMIN_SCHEDULE_API = '/api/admin/dashboard/schedules';
	const ADMIN_SCHEDULE_DETAIL_API = '/api/admin/dashboard/schedules/detail';
	const CERTIFICATION_API = '/api/public/certifications';
	const AUTO_SCHEDULE_TITLES = new Set(['jlpt n1', 'ap', 'fp', 'aws saa']);

	function normalizeTitle(value) {
		return String(value || '').trim().toLocaleLowerCase();
	}

	function contextOf(root) {
		return root.dataset.context === 'admin'
			? 'admin'
			: root.dataset.context === 'public'
				? 'public'
				: 'home';
	}

	function languageOf(root) {
		if (contextOf(root) === 'admin') return window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja';
		if (contextOf(root) === 'home') return document.body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
		return root.dataset.language === 'ko' ? 'ko' : 'ja';
	}

	function copy(root) {
		return languageOf(root) === 'ko'
			? {
				kicker: 'SCHEDULE', title: '일정관리', description: '다가오는 일정과 D-Day를 목록과 월간 달력에서 함께 확인합니다.',
				add: '+ 일정 추가', listTitle: 'D-Day · 일정 목록', listHint: '날짜가 가까운 순서로 표시',
				registered: '등록일', content: '내용', dday: 'D-Day', action: '관리', empty: '등록된 일정이 없습니다.',
				rolling: '상시', rollingDate: '상시 일정', official: '공식 시험일정', checked: '공식정보 확인',
				noDate: '날짜 미설정', hidden: '홈 비표시', today: '오늘',
				weekdays: ['일', '월', '화', '수', '목', '금', '토'],
				createTitle: '일정 추가', editTitle: '일정 수정', name: '내용', date: '목표일', visible: '홈에 표시',
				cancel: '취소', save: '저장', remove: '삭제', deleteConfirm: '이 일정을 삭제할까요?',
				saveFailed: '일정을 저장하지 못했습니다.', deleteFailed: '일정을 삭제하지 못했습니다.', loadFailed: '일정을 불러오지 못했습니다.',
				editLabel: '수정', deleteLabel: '삭제', more: (count) => `+${count}개`,
			}
			: {
				kicker: 'SCHEDULE', title: '予定管理', description: '今後の予定とD-Dayを一覧と月間カレンダーでまとめて確認します。',
				add: '+ 予定追加', listTitle: 'D-Day・予定一覧', listHint: '日付が近い順に表示',
				registered: '登録日', content: '内容', dday: 'D-Day', action: '管理', empty: '登録された予定はありません。',
				rolling: '随時', rollingDate: '随時受験', official: '公式試験日程', checked: '公式情報確認',
				noDate: '日付未設定', hidden: 'ホーム非表示', today: '今日',
				weekdays: ['日', '月', '火', '水', '木', '金', '土'],
				createTitle: '予定を追加', editTitle: '予定を編集', name: '内容', date: '目標日', visible: 'ホームに表示',
				cancel: 'キャンセル', save: '保存', remove: '削除', deleteConfirm: 'この予定を削除しますか？',
				saveFailed: '予定を保存できませんでした。', deleteFailed: '予定を削除できませんでした。', loadFailed: '予定を読み込めませんでした。',
				editLabel: '編集', deleteLabel: '削除', more: (count) => `+${count}件`,
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

	function dayDiff(targetDate) {
		if (!validDate(targetDate)) return null;
		const today = Date.parse(`${tokyoToday()}T00:00:00Z`);
		const target = Date.parse(`${targetDate}T00:00:00Z`);
		if (!Number.isFinite(today) || !Number.isFinite(target)) return null;
		return Math.round((target - today) / 86400000);
	}

	function ddayLabel(targetDate) {
		const diff = dayDiff(targetDate);
		if (diff === null) return '—';
		if (diff === 0) return 'D-Day';
		return diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
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
		if (!validDate(value)) return value || copy(root).noDate;
		const date = new Date(`${value}T00:00:00Z`);
		return new Intl.DateTimeFormat(languageOf(root) === 'ko' ? 'ko-KR' : 'ja-JP', {
			year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC',
		}).format(date);
	}

	async function jsonRequest(url, options = {}) {
		const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
		const result = await response.json().catch(() => null);
		if (!response.ok || !result?.ok) throw new Error(result?.error || `HTTP_${response.status}`);
		return result;
	}

	async function resolveAdmin(root) {
		if (contextOf(root) === 'admin') {
			const session = await window.AdminCommon?.ready;
			return Boolean(session?.authenticated ?? session?.admin);
		}
		try {
			const response = await fetch('/api/admin/auth/session', { credentials: 'same-origin', cache: 'no-store' });
			const result = await response.json().catch(() => null);
			return response.ok && result?.authenticated === true;
		} catch {
			return false;
		}
	}

	function nearestOfficialSchedule(cert) {
		const today = tokyoToday();
		const schedules = Array.isArray(cert?.schedules) ? cert.schedules : [];
		return schedules
			.filter((schedule) => schedule?.announced !== false)
			.filter((schedule) => {
				const end = schedule?.dateEnd || schedule?.dateStart;
				return validDate(end) && end >= today;
			})
			.sort((a, b) => String(a.dateStart || a.dateEnd).localeCompare(String(b.dateStart || b.dateEnd)))[0] || null;
	}

	function officialItems(root, certificationResult) {
		const list = Array.isArray(certificationResult?.certifications) ? certificationResult.certifications : [];
		const bySlug = new Map(list.map((cert) => [cert.slug, cert]));
		const labels = copy(root);
		const definitions = [
			{ title: 'JLPT N1', slug: 'jlpt-n1', rolling: false, order: 10 },
			{ title: 'AP', slug: 'ap', rolling: false, order: 20 },
			{ title: 'FP', slug: 'fp3', rolling: true, order: 30 },
			{ title: 'AWS SAA', slug: 'aws-saa', rolling: true, order: 40 },
		];

		return definitions.flatMap((definition) => {
			const cert = bySlug.get(definition.slug);
			if (!cert) return [];
			if (definition.rolling) {
				return [{
					id: `official-${definition.slug}`,
					title: definition.title,
					targetDate: null,
					createdAt: cert.sourceCheckedAt || null,
					displayOrder: definition.order,
					rolling: true,
					official: true,
					meta: labels.official,
				}];
			}
			const schedule = nearestOfficialSchedule(cert);
			if (!schedule) return [];
			return [{
				id: `official-${definition.slug}`,
				title: definition.title,
				targetDate: schedule.dateStart || schedule.dateEnd || null,
				createdAt: cert.sourceCheckedAt || null,
				displayOrder: definition.order,
				rolling: false,
				official: true,
				meta: schedule.exam || labels.official,
			}];
		});
	}

	function customItems(root, scheduleResult, admin) {
		const context = contextOf(root);
		const rows = Array.isArray(scheduleResult?.schedules) ? scheduleResult.schedules : [];
		return rows
			.filter((row) => !AUTO_SCHEDULE_TITLES.has(normalizeTitle(row?.title)))
			.filter((row) => context === 'admin' || !admin || row?.isVisible !== false)
			.map((row) => ({
				...row,
				rolling: false,
				official: false,
				meta: row?.isVisible === false ? copy(root).hidden : '',
			}));
	}

	function sortItems(items) {
		return [...items].sort((a, b) => {
			const groupA = validDate(a.targetDate) ? 0 : a.rolling ? 1 : 2;
			const groupB = validDate(b.targetDate) ? 0 : b.rolling ? 1 : 2;
			if (groupA !== groupB) return groupA - groupB;
			if (groupA === 0 && a.targetDate !== b.targetDate) return a.targetDate.localeCompare(b.targetDate);
			const orderA = Number(a.displayOrder ?? 9999);
			const orderB = Number(b.displayOrder ?? 9999);
			if (orderA !== orderB) return orderA - orderB;
			return String(a.title || '').localeCompare(String(b.title || ''));
		});
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

	function modal(root, item, refresh, presetDate = '') {
		const labels = copy(root);
		const editing = Boolean(item && !item.official);
		const backdrop = createElement('div', 'schedule-modal-backdrop');
		const dialog = createElement('section', 'schedule-modal');
		dialog.setAttribute('role', 'dialog');
		dialog.setAttribute('aria-modal', 'true');
		const heading = createElement('h3', '', editing ? labels.editTitle : labels.createTitle);

		const nameLabel = createElement('label', 'schedule-modal-field');
		nameLabel.append(createElement('span', '', labels.name));
		const nameInput = document.createElement('input');
		nameInput.type = 'text';
		nameInput.maxLength = 120;
		nameInput.value = editing ? String(item.title || '') : '';
		nameLabel.append(nameInput);

		const dateLabel = createElement('label', 'schedule-modal-field');
		dateLabel.append(createElement('span', '', labels.date));
		const dateInput = document.createElement('input');
		dateInput.type = 'date';
		dateInput.value = editing ? String(item.targetDate || '') : presetDate;
		dateLabel.append(dateInput);

		const visibleLabel = createElement('label', 'schedule-modal-visible');
		const visibleInput = document.createElement('input');
		visibleInput.type = 'checkbox';
		visibleInput.checked = editing ? item.isVisible !== false : true;
		visibleLabel.append(visibleInput, document.createTextNode(labels.visible));

		const actions = createElement('div', 'schedule-modal-actions');
		if (editing) {
			const remove = createElement('button', 'is-danger', labels.remove);
			remove.type = 'button';
			remove.addEventListener('click', async () => {
				if (!window.confirm(labels.deleteConfirm)) return;
				remove.disabled = true;
				try {
					await jsonRequest(`${ADMIN_SCHEDULE_DETAIL_API}?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' });
					backdrop.remove();
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
		cancel.addEventListener('click', () => backdrop.remove());
		const save = createElement('button', 'is-primary', labels.save);
		save.type = 'button';
		save.addEventListener('click', async () => {
			const title = nameInput.value.trim();
			if (!title) {
				nameInput.focus();
				return;
			}
			save.disabled = true;
			try {
				await jsonRequest(editing ? `${ADMIN_SCHEDULE_DETAIL_API}?id=${encodeURIComponent(item.id)}` : ADMIN_SCHEDULE_API, {
					method: editing ? 'PATCH' : 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ title, targetDate: dateInput.value || null, isVisible: visibleInput.checked }),
				});
				backdrop.remove();
				await refresh();
			} catch (error) {
				console.error(error);
				window.alert(labels.saveFailed);
				save.disabled = false;
			}
		});
		actions.append(cancel, save);
		dialog.append(heading, nameLabel, dateLabel, visibleLabel, actions);
		backdrop.appendChild(dialog);
		backdrop.addEventListener('mousedown', (event) => {
			if (event.target === backdrop) backdrop.remove();
		});
		document.body.appendChild(backdrop);
		window.setTimeout(() => nameInput.focus(), 0);
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
		tableHead.append(
			createElement('span', '', labels.registered),
			createElement('span', '', labels.content),
			createElement('span', '', labels.dday),
		);
		if (admin) tableHead.append(createElement('span', '', labels.action));
		panel.appendChild(tableHead);

		const body = createElement('div', 'schedule-list-body');
		if (!items.length) {
			body.append(createElement('div', 'schedule-list-empty', labels.empty));
			panel.appendChild(body);
			return;
		}

		for (const item of items) {
			const row = createElement('div', `schedule-list-row${admin && !item.official ? ' is-editable' : ''}`);
			const registered = createElement('span', 'schedule-list-date', item.official
				? shortDate(root, item.createdAt)
				: shortDate(root, item.createdAt));
			const content = createElement('div', 'schedule-list-content');
			content.append(createElement('strong', '', item.title || ''));
			const meta = item.rolling
				? labels.rollingDate
				: validDate(item.targetDate)
					? `${fullDate(root, item.targetDate)}${item.meta ? ` · ${item.meta}` : ''}`
					: `${labels.noDate}${item.meta ? ` · ${item.meta}` : ''}`;
			content.append(createElement('small', '', meta));
			const dday = createElement('b', `schedule-list-dday${item.rolling ? ' is-rolling' : ''}`, item.rolling ? labels.rolling : ddayLabel(item.targetDate));
			row.append(registered, content, dday);

			if (admin) {
				const actions = createElement('div', 'schedule-item-actions');
				if (!item.official) {
					const edit = createElement('button', 'schedule-item-action', '✎');
					edit.type = 'button';
					edit.title = labels.editLabel;
					edit.setAttribute('aria-label', labels.editLabel);
					edit.addEventListener('click', () => modal(root, item, refresh));
					const remove = createElement('button', 'schedule-item-action is-delete', '×');
					remove.type = 'button';
					remove.title = labels.deleteLabel;
					remove.setAttribute('aria-label', labels.deleteLabel);
					remove.addEventListener('click', async () => {
						if (!window.confirm(labels.deleteConfirm)) return;
						try {
							await jsonRequest(`${ADMIN_SCHEDULE_DETAIL_API}?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' });
							await refresh();
						} catch (error) {
							console.error(error);
							window.alert(labels.deleteFailed);
						}
					});
					actions.append(edit, remove);
				}
				row.appendChild(actions);
			}
			body.appendChild(row);
		}
		panel.appendChild(body);
	}

	function renderCalendar(root, panel, items, admin, refresh, cursor, setCursor) {
		const labels = copy(root);
		panel.replaceChildren();
		panel.className = 'schedule-manager-panel schedule-calendar-panel';

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
			if (!validDate(item.targetDate)) continue;
			if (!eventMap.has(item.targetDate)) eventMap.set(item.targetDate, []);
			eventMap.get(item.targetDate).push(item);
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
			const day = createElement('div', `schedule-calendar-day${outside ? ' is-outside' : ''}${key === todayKey ? ' is-today' : ''}`);
			day.dataset.date = key;
			day.append(createElement('span', 'schedule-calendar-date', String(date.getUTCDate())));
			const events = createElement('div', 'schedule-calendar-events');
			const dayItems = eventMap.get(key) || [];
			for (const item of dayItems.slice(0, 3)) {
				const event = createElement(admin && !item.official ? 'button' : 'span', `schedule-calendar-event${item.official ? ' is-official' : ''}`, item.title);
				if (event instanceof HTMLButtonElement) {
					event.type = 'button';
					event.addEventListener('click', (clickEvent) => {
						clickEvent.stopPropagation();
						modal(root, item, refresh);
					});
				}
				event.title = `${item.title} · ${fullDate(root, key)}`;
				events.appendChild(event);
			}
			if (dayItems.length > 3) events.append(createElement('span', 'schedule-calendar-more', labels.more(dayItems.length - 3)));
			day.appendChild(events);
			if (admin && !outside) {
				day.addEventListener('dblclick', () => modal(root, null, refresh, key));
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
		root.classList.toggle('is-public-page', contextOf(root) === 'public');

		async function refresh() {
			const labels = copy(root);
			root.setAttribute('aria-busy', 'true');
			try {
				if (contextOf(root) !== 'admin') admin = await resolveAdmin(root);
				const scheduleUrl = admin ? ADMIN_SCHEDULE_API : PUBLIC_SCHEDULE_API;
				const [scheduleResult, certificationResult] = await Promise.all([
					jsonRequest(scheduleUrl),
					jsonRequest(`${CERTIFICATION_API}?lang=${languageOf(root)}`),
				]);
				items = sortItems([
					...officialItems(root, certificationResult),
					...customItems(root, scheduleResult, admin),
				]);
				render();
			} catch (error) {
				console.error('Failed to load schedule manager', error);
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
				add.addEventListener('click', () => modal(root, null, refresh));
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
