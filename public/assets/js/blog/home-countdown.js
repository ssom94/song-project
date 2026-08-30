(() => {
	const API_PUBLIC = '/api/public/dashboard/schedules';
	const API_ADMIN = '/api/admin/dashboard/schedules';
	const API_ADMIN_DETAIL = '/api/admin/dashboard/schedules/detail';

	function language() {
		return document.body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
	}

	function copy() {
		return language() === 'ko'
			? {
				add: '+ 추가', edit: '수정', remove: '삭제', noDate: '날짜 미설정', empty: '등록된 일정이 없습니다.',
				addTitle: 'D-Day 일정 추가', editTitle: 'D-Day 일정 수정', deleteTitle: '일정 삭제',
				name: '일정명', date: '목표일', visible: '홈에 표시', cancel: '취소', save: '저장', confirmDelete: '삭제',
				deleteMessage: '이 일정을 삭제할까요? 삭제한 일정은 복구할 수 없습니다.', saveFailed: '일정을 저장하지 못했습니다.', deleteFailed: '일정을 삭제하지 못했습니다.',
			}
			: {
				add: '+ 追加', edit: '編集', remove: '削除', noDate: '日付未設定', empty: '登録された予定はありません。',
				addTitle: 'D-Day 予定を追加', editTitle: 'D-Day 予定を編集', deleteTitle: '予定を削除',
				name: '予定名', date: '目標日', visible: 'ホームに表示', cancel: 'キャンセル', save: '保存', confirmDelete: '削除',
				deleteMessage: 'この予定を削除しますか？削除した予定は元に戻せません。', saveFailed: '予定を保存できませんでした。', deleteFailed: '予定を削除できませんでした。',
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

	async function openEditor(schedule, refresh) {
		const labels = copy();
		const { backdrop, modal } = modalShell(schedule ? labels.editTitle : labels.addTitle);
		const titleLabel = document.createElement('label');
		titleLabel.className = 'dashboard-schedule-field';
		titleLabel.textContent = labels.name;
		const titleInput = document.createElement('input');
		titleInput.type = 'text';
		titleInput.maxLength = 120;
		titleInput.value = schedule?.title ?? '';
		titleLabel.appendChild(titleInput);

		const dateLabelNode = document.createElement('label');
		dateLabelNode.className = 'dashboard-schedule-field';
		dateLabelNode.textContent = labels.date;
		const dateInput = document.createElement('input');
		dateInput.type = 'date';
		dateInput.value = schedule?.targetDate ?? '';
		dateLabelNode.appendChild(dateInput);

		const visibleLabel = document.createElement('label');
		visibleLabel.className = 'dashboard-schedule-visible-field';
		const visible = document.createElement('input');
		visible.type = 'checkbox';
		visible.checked = schedule?.isVisible !== false;
		visibleLabel.append(visible, document.createTextNode(labels.visible));
		modal.append(titleLabel, dateLabelNode, visibleLabel);

		actionButtons(modal, labels.save, async () => {
			const title = titleInput.value.trim();
			if (!title) {
				titleInput.focus();
				return;
			}
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

	function createScheduleRow(schedule, admin, refresh) {
		const labels = copy();
		const row = document.createElement('div');
		row.className = 'home-dday-item';
		const details = document.createElement('div');
		details.className = 'home-dday-item-copy';
		const title = document.createElement('strong');
		title.textContent = schedule.title;
		const date = document.createElement('span');
		date.textContent = dateLabel(schedule.targetDate);
		details.append(title, date);

		const value = document.createElement('b');
		value.className = 'home-dday-value';
		value.textContent = ddayLabel(schedule.targetDate);
		row.append(details, value);

		if (admin) {
			const actions = document.createElement('div');
			actions.className = 'home-dday-admin-actions';
			const edit = document.createElement('button');
			edit.type = 'button';
			edit.className = 'home-dday-admin-button';
			edit.textContent = labels.edit;
			edit.addEventListener('click', () => openEditor(schedule, refresh));
			const remove = document.createElement('button');
			remove.type = 'button';
			remove.className = 'home-dday-admin-button is-delete';
			remove.textContent = labels.remove;
			remove.addEventListener('click', () => openDelete(schedule, refresh));
			actions.append(edit, remove);
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
				const result = await requestJson(admin ? API_ADMIN : API_PUBLIC);
				const schedules = Array.isArray(result.schedules)
					? result.schedules.filter((item) => !admin || item.isVisible !== false)
					: [];
				list.replaceChildren();
				if (schedules.length === 0) {
					const empty = document.createElement('div');
					empty.className = 'home-dday-empty';
					empty.textContent = copy().empty;
					list.appendChild(empty);
				} else {
					for (const schedule of schedules) list.appendChild(createScheduleRow(schedule, admin, refresh));
				}
			} catch (error) {
				console.error('Failed to load D-Day schedules', error);
			}
		}

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
			}
		}

		await refresh();
		document.addEventListener('songpubliclanguagechange', refresh);
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
