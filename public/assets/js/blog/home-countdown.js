(() => {
	const API_PUBLIC = '/api/public/dashboard/schedules';
	const API_GOALS = '/api/public/dashboard';
	const API_ADMIN = '/api/admin/dashboard/schedules';
	const API_ADMIN_DETAIL = '/api/admin/dashboard/schedules/detail';
	const API_ADMIN_GOALS = '/api/admin/dashboard';

	function language() {
		return document.body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
	}

	function copy() {
		return language() === 'ko'
			? {
				add: '+ 추가', edit: '수정', remove: '삭제', noDate: '날짜 미설정', empty: '등록된 일정이 없습니다.',
				addTitle: 'D-Day 일정 추가', editTitle: 'D-Day 일정 수정', goalEditTitle: '시험·목표 수정', deleteTitle: '일정 삭제',
				name: '일정명', date: '목표일', month: '예정 월', targetType: '목표 시점', exactDate: '정확한 날짜', plannedMonth: '월 단위 예정', undecided: '미정',
				visible: '홈에 표시', cancel: '취소', save: '저장', confirmDelete: '삭제', planned: '예정',
				deleteMessage: '이 일정을 삭제할까요? 삭제한 일정은 복구할 수 없습니다.', saveFailed: '일정을 저장하지 못했습니다.', deleteFailed: '일정을 삭제하지 못했습니다.',
				goalSource: '시험일정',
			}
			: {
				add: '+ 追加', edit: '編集', remove: '削除', noDate: '日付未設定', empty: '登録された予定はありません。',
				addTitle: 'D-Day 予定を追加', editTitle: 'D-Day 予定を編集', goalEditTitle: '試験・目標を編集', deleteTitle: '予定を削除',
				name: '予定名', date: '目標日', month: '予定月', targetType: '目標時期', exactDate: '正確な日付', plannedMonth: '月単位の予定', undecided: '未定',
				visible: 'ホームに表示', cancel: 'キャンセル', save: '保存', confirmDelete: '削除', planned: '予定',
				deleteMessage: 'この予定を削除しますか？削除した予定は元に戻せません。', saveFailed: '予定を保存できませんでした。', deleteFailed: '予定を削除できませんでした。',
				goalSource: '試験予定',
			};
	}

	function installStyle() {
		if (document.querySelector('link[data-countdown-admin-style]')) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '/assets/css/blog/countdown-admin.css';
		link.dataset.countdownAdminStyle = 'true';
		document.head.appendChild(link);
	}

	function tokyoToday() {
		const parts = new Intl.DateTimeFormat('en-CA', {
			timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
		}).formatToParts(new Date());
		const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
		return `${map.year}-${map.month}-${map.day}`;
	}

	function dayDiff(targetDate) {
		if (!targetDate) return null;
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

	function dateLabel(targetDate) {
		if (!targetDate) return copy().noDate;
		const date = new Date(`${targetDate}T00:00:00Z`);
		if (Number.isNaN(date.getTime())) return targetDate;
		return new Intl.DateTimeFormat(language() === 'ko' ? 'ko-KR' : 'ja-JP', {
			year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC',
		}).format(date);
	}

	function monthLabel(targetMonth) {
		if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(targetMonth || ''))) return copy().noDate;
		const [year, month] = targetMonth.split('-');
		return language() === 'ko' ? `${year}. ${month}. 예정` : `${year}年${Number(month)}月予定`;
	}

	function targetMeta(item) {
		if (item?.targetDate) return { detail: dateLabel(item.targetDate), value: ddayLabel(item.targetDate) };
		if (item?.targetMonth) {
			const month = item.targetMonth.split('-')[1];
			return {
				detail: monthLabel(item.targetMonth),
				value: language() === 'ko' ? `${Number(month)}월 예정` : `${Number(month)}月予定`,
			};
		}
		return { detail: copy().noDate, value: '—' };
	}

	async function isAdmin() {
		try {
			const response = await fetch('/api/admin/auth/session', { credentials: 'same-origin', cache: 'no-store' });
			const result = await response.json().catch(() => null);
			return response.ok && result?.authenticated === true;
		} catch {
			return false;
		}
	}

	async function requestJson(url, options = {}) {
		const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
		const result = await response.json().catch(() => null);
		if (!response.ok || !result?.ok) throw new Error(result?.error || `HTTP_${response.status}`);
		return result;
	}

	function closeModal(backdrop) {
		backdrop.remove();
		document.body.style.removeProperty('overflow');
	}

	function modalShell(title) {
		const backdrop = document.createElement('div');
		backdrop.className = 'dashboard-schedule-modal-backdrop';
		const modal = document.createElement('div');
		modal.className = 'dashboard-schedule-modal';
		modal.setAttribute('role', 'dialog');
		modal.setAttribute('aria-modal', 'true');
		const heading = document.createElement('h3');
		heading.textContent = title;
		modal.appendChild(heading);
		backdrop.appendChild(modal);
		backdrop.addEventListener('mousedown', (event) => {
			if (event.target === backdrop) closeModal(backdrop);
		});
		document.body.appendChild(backdrop);
		document.body.style.overflow = 'hidden';
		return { backdrop, modal };
	}

	function actionButtons(modal, primaryText, onPrimary, danger = false) {
		const labels = copy();
		const actions = document.createElement('div');
		actions.className = 'dashboard-schedule-modal-actions';
		const cancel = document.createElement('button');
		cancel.type = 'button';
		cancel.textContent = labels.cancel;
		const primary = document.createElement('button');
		primary.type = 'button';
		primary.className = danger ? 'is-danger' : 'is-primary';
		primary.textContent = primaryText;
		actions.append(cancel, primary);
		modal.appendChild(actions);
		cancel.addEventListener('click', () => closeModal(modal.parentElement));
		primary.addEventListener('click', async () => {
			primary.disabled = true;
			cancel.disabled = true;
			try {
				await onPrimary();
			} finally {
				if (document.body.contains(primary)) {
					primary.disabled = false;
					cancel.disabled = false;
				}
			}
		});
	}

	function field(label, input) {
		const node = document.createElement('label');
		node.className = 'dashboard-schedule-field';
		node.textContent = label;
		node.appendChild(input);
		return node;
	}

	async function openEditor(schedule, refresh) {
		const labels = copy();
		const { backdrop, modal } = modalShell(schedule ? labels.editTitle : labels.addTitle);
		const titleInput = document.createElement('input');
		titleInput.type = 'text';
		titleInput.maxLength = 120;
		titleInput.value = schedule?.title ?? '';
		const dateInput = document.createElement('input');
		dateInput.type = 'date';
		dateInput.value = schedule?.targetDate ?? '';
		const visibleLabel = document.createElement('label');
		visibleLabel.className = 'dashboard-schedule-visible-field';
		const visible = document.createElement('input');
		visible.type = 'checkbox';
		visible.checked = schedule?.isVisible !== false;
		visibleLabel.append(visible, document.createTextNode(labels.visible));
		modal.append(field(labels.name, titleInput), field(labels.date, dateInput), visibleLabel);

		actionButtons(modal, labels.save, async () => {
			const title = titleInput.value.trim();
			if (!title) return titleInput.focus();
			try {
				await requestJson(schedule ? `${API_ADMIN_DETAIL}?id=${encodeURIComponent(schedule.id)}` : API_ADMIN, {
					method: schedule ? 'PATCH' : 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ title, targetDate: dateInput.value || null, isVisible: visible.checked }),
				});
				closeModal(backdrop);
				await refresh();
			} catch (error) {
				console.error(error);
				window.alert(labels.saveFailed);
			}
		});
		titleInput.focus();
	}

	async function openGoalEditor(schedule, refresh) {
		const labels = copy();
		let dashboard;
		try {
			dashboard = await requestJson(API_ADMIN_GOALS);
		} catch (error) {
			console.error(error);
			window.alert(labels.saveFailed);
			return;
		}
		const goal = dashboard.goals?.find((item) => item.goalKey === schedule.goalKey);
		if (!goal) return;

		const { backdrop, modal } = modalShell(labels.goalEditTitle);
		const titleInput = document.createElement('input');
		titleInput.type = 'text';
		titleInput.maxLength = 120;
		titleInput.value = goal.title || '';

		const typeSelect = document.createElement('select');
		for (const [value, text] of [['date', labels.exactDate], ['month', labels.plannedMonth], ['none', labels.undecided]]) {
			const option = document.createElement('option');
			option.value = value;
			option.textContent = text;
			typeSelect.appendChild(option);
		}
		typeSelect.value = goal.targetDate ? 'date' : goal.targetMonth ? 'month' : 'none';

		const dateInput = document.createElement('input');
		dateInput.type = 'date';
		dateInput.value = goal.targetDate || '';
		const monthInput = document.createElement('input');
		monthInput.type = 'month';
		monthInput.value = goal.targetMonth || '';
		const dateField = field(labels.date, dateInput);
		const monthField = field(labels.month, monthInput);
		function syncTargetFields() {
			dateField.hidden = typeSelect.value !== 'date';
			monthField.hidden = typeSelect.value !== 'month';
		}
		typeSelect.addEventListener('change', syncTargetFields);
		syncTargetFields();

		const visibleLabel = document.createElement('label');
		visibleLabel.className = 'dashboard-schedule-visible-field';
		const visible = document.createElement('input');
		visible.type = 'checkbox';
		visible.checked = goal.isVisible !== false;
		visibleLabel.append(visible, document.createTextNode(labels.visible));
		modal.append(field(labels.name, titleInput), field(labels.targetType, typeSelect), dateField, monthField, visibleLabel);

		actionButtons(modal, labels.save, async () => {
			const title = titleInput.value.trim();
			if (!title) return titleInput.focus();
			if (typeSelect.value === 'date' && !dateInput.value) return dateInput.focus();
			if (typeSelect.value === 'month' && !monthInput.value) return monthInput.focus();
			const goals = dashboard.goals.map((item) => item.goalKey === goal.goalKey ? {
				...item,
				title,
				targetDate: typeSelect.value === 'date' ? dateInput.value : null,
				targetMonth: typeSelect.value === 'month' ? monthInput.value : null,
				isVisible: visible.checked,
			} : item);
			try {
				await requestJson(API_ADMIN_GOALS, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ ...dashboard.settings, goals }),
				});
				closeModal(backdrop);
				await refresh();
			} catch (error) {
				console.error(error);
				window.alert(labels.saveFailed);
			}
		});
	}

	function openDelete(schedule, refresh) {
		const labels = copy();
		const { backdrop, modal } = modalShell(labels.deleteTitle);
		const message = document.createElement('p');
		message.textContent = `${schedule.title}\n${labels.deleteMessage}`;
		modal.appendChild(message);
		actionButtons(modal, labels.confirmDelete, async () => {
			try {
				await requestJson(`${API_ADMIN_DETAIL}?id=${encodeURIComponent(schedule.id)}`, { method: 'DELETE' });
				closeModal(backdrop);
				await refresh();
			} catch (error) {
				console.error(error);
				window.alert(labels.deleteFailed);
			}
		}, true);
	}

	function normalizedKey(item) {
		return `${String(item?.title || '').trim().toLocaleLowerCase()}\u0000${String(item?.targetDate || '')}`;
	}

	function mergeCountdownItems(scheduleResult, goalResult, admin) {
		const schedules = Array.isArray(scheduleResult?.schedules)
			? scheduleResult.schedules.filter((item) => !admin || item.isVisible !== false).map((item) => ({ ...item, source: 'schedule' }))
			: [];
		const goals = Array.isArray(goalResult?.goals)
			? goalResult.goals
				.filter((goal) => goal?.targetDate || goal?.targetMonth)
				.map((goal) => ({
					id: `goal-${goal.id ?? goal.goalKey}`,
					goalId: goal.id,
					goalKey: goal.goalKey,
					title: goal.title,
					targetDate: goal.targetDate || null,
					targetMonth: goal.targetMonth || null,
					displayOrder: goal.displayOrder ?? 0,
					isVisible: true,
					source: 'goal',
				}))
			: [];

		const goalKeys = new Set(goals.filter((goal) => goal.targetDate).map(normalizedKey));
		const merged = [...goals, ...schedules.filter((schedule) => !goalKeys.has(normalizedKey(schedule)))];
		merged.sort((a, b) => {
			const dateA = a.targetDate || (a.targetMonth ? `${a.targetMonth}-01` : '9999-12-31');
			const dateB = b.targetDate || (b.targetMonth ? `${b.targetMonth}-01` : '9999-12-31');
			if (dateA !== dateB) return dateA.localeCompare(dateB);
			const orderA = Number(a.displayOrder ?? 0);
			const orderB = Number(b.displayOrder ?? 0);
			if (orderA !== orderB) return orderA - orderB;
			return String(a.title || '').localeCompare(String(b.title || ''));
		});
		return merged;
	}

	function createScheduleRow(schedule, admin, refresh) {
		const labels = copy();
		const row = document.createElement('div');
		row.className = `home-dday-item${schedule.source === 'goal' ? ' is-goal-source' : ''}`;
		const details = document.createElement('div');
		details.className = 'home-dday-item-copy';
		const titleLine = document.createElement('div');
		titleLine.className = 'home-dday-title-line';
		const title = document.createElement('strong');
		title.textContent = schedule.title;
		titleLine.appendChild(title);
		if (schedule.source === 'goal') {
			const source = document.createElement('small');
			source.className = 'home-dday-source-badge';
			source.textContent = labels.goalSource;
			titleLine.appendChild(source);
		}
		const meta = targetMeta(schedule);
		const date = document.createElement('span');
		date.textContent = meta.detail;
		details.append(titleLine, date);
		const value = document.createElement('b');
		value.className = 'home-dday-value';
		value.textContent = meta.value;
		row.append(details, value);

		if (admin) {
			const actions = document.createElement('div');
			actions.className = 'home-dday-admin-actions';
			const edit = document.createElement('button');
			edit.type = 'button';
			edit.className = 'home-dday-admin-button';
			edit.textContent = labels.edit;
			edit.addEventListener('click', () => schedule.source === 'goal' ? openGoalEditor(schedule, refresh) : openEditor(schedule, refresh));
			actions.appendChild(edit);
			if (schedule.source !== 'goal') {
				const remove = document.createElement('button');
				remove.type = 'button';
				remove.className = 'home-dday-admin-button is-delete';
				remove.textContent = labels.remove;
				remove.addEventListener('click', () => openDelete(schedule, refresh));
				actions.appendChild(remove);
			}
			row.appendChild(actions);
		}
		return row;
	}

	async function initialize() {
		const list = document.querySelector('.home-dday-list');
		const card = document.querySelector('.home-dday-card');
		if (!(list instanceof HTMLElement) || !(card instanceof HTMLElement)) return;
		installStyle();
		const admin = await isAdmin();

		async function refresh() {
			try {
				const [scheduleResult, goalResult] = await Promise.all([
					requestJson(admin ? API_ADMIN : API_PUBLIC),
					requestJson(API_GOALS),
				]);
				const items = mergeCountdownItems(scheduleResult, goalResult, admin);
				list.replaceChildren();
				if (items.length === 0) {
					const empty = document.createElement('div');
					empty.className = 'home-dday-empty';
					empty.textContent = copy().empty;
					list.appendChild(empty);
				} else {
					for (const item of items) list.appendChild(createScheduleRow(item, admin, refresh));
				}
			} catch (error) {
				console.error('Failed to load D-Day schedules', error);
			}
		}

		let addButton = null;
		if (admin) {
			const heading = card.querySelector('.home-card-heading');
			if (heading && !heading.querySelector('.home-dday-admin-add')) {
				const actions = document.createElement('div');
				actions.className = 'home-dday-heading-actions';
				const add = document.createElement('button');
				add.type = 'button';
				add.className = 'home-dday-admin-add';
				add.textContent = copy().add;
				add.addEventListener('click', () => openEditor(null, refresh));
				actions.appendChild(add);
				heading.appendChild(actions);
				addButton = add;
			}
		}

		await refresh();
		document.querySelectorAll('[data-home-language]').forEach((button) => {
			button.addEventListener('click', () => window.setTimeout(() => {
				if (addButton) addButton.textContent = copy().add;
				refresh();
			}, 0));
		});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
