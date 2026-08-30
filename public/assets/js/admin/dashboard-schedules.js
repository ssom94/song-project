(() => {
	const API = '/api/admin/dashboard/schedules';
	const DETAIL = '/api/admin/dashboard/schedules/detail';

	function lang() {
		return window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja';
	}

	function c() {
		return lang() === 'ko'
			? { title: 'D-Day 일정 관리', desc: '공개 홈 COUNTDOWN에 표시할 일정을 추가·수정·삭제합니다.', add: '일정 추가', edit: '수정', remove: '삭제', noDate: '날짜 미설정', empty: '등록된 일정이 없습니다.', addTitle: 'D-Day 일정 추가', editTitle: 'D-Day 일정 수정', deleteTitle: '일정 삭제', name: '일정명', date: '목표일', visible: '홈에 표시', cancel: '취소', save: '저장', confirm: '삭제', deleteMessage: '이 일정을 삭제할까요? 삭제 후에는 복구할 수 없습니다.', loadFailed: '일정 목록을 불러오지 못했습니다.', saveFailed: '일정을 저장하지 못했습니다.', deleteFailed: '일정을 삭제하지 못했습니다.' }
			: { title: 'D-Day 予定管理', desc: '公開ホームの COUNTDOWN に表示する予定を追加・編集・削除します。', add: '予定を追加', edit: '編集', remove: '削除', noDate: '日付未設定', empty: '登録された予定はありません。', addTitle: 'D-Day 予定を追加', editTitle: 'D-Day 予定を編集', deleteTitle: '予定を削除', name: '予定名', date: '目標日', visible: 'ホームに表示', cancel: 'キャンセル', save: '保存', confirm: '削除', deleteMessage: 'この予定を削除しますか？削除後は元に戻せません。', loadFailed: '予定一覧を読み込めませんでした。', saveFailed: '予定を保存できませんでした。', deleteFailed: '予定を削除できませんでした。' };
	}

	function installStyle() {
		if (document.querySelector('link[data-admin-schedule-style]')) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '/assets/css/admin/dashboard-schedules.css';
		link.dataset.adminScheduleStyle = 'true';
		document.head.appendChild(link);
	}

	async function requestJson(url, options = {}) {
		const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
		const result = await response.json().catch(() => null);
		if (!response.ok || !result?.ok) throw new Error(result?.error || `HTTP_${response.status}`);
		return result;
	}

	function tokyoToday() {
		const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
		const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
		return `${values.year}-${values.month}-${values.day}`;
	}

	function dday(value) {
		if (!value) return '—';
		const today = Date.parse(`${tokyoToday()}T00:00:00Z`);
		const target = Date.parse(`${value}T00:00:00Z`);
		if (!Number.isFinite(target)) return '—';
		const diff = Math.round((target - today) / 86400000);
		if (diff === 0) return 'D-Day';
		return diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
	}

	function dateText(value) {
		if (!value) return c().noDate;
		const date = new Date(`${value}T00:00:00Z`);
		if (Number.isNaN(date.getTime())) return value;
		return new Intl.DateTimeFormat(lang() === 'ko' ? 'ko-KR' : 'ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }).format(date);
	}

	function closeModal(backdrop) {
		backdrop.remove();
		document.body.style.removeProperty('overflow');
	}

	function modal(title) {
		const backdrop = document.createElement('div');
		backdrop.className = 'admin-schedule-modal-backdrop';
		const box = document.createElement('div');
		box.className = 'admin-schedule-modal';
		box.setAttribute('role', 'dialog');
		box.setAttribute('aria-modal', 'true');
		const heading = document.createElement('h3');
		heading.textContent = title;
		box.appendChild(heading);
		backdrop.appendChild(box);
		backdrop.addEventListener('mousedown', (event) => {
			if (event.target === backdrop) closeModal(backdrop);
		});
		document.body.appendChild(backdrop);
		document.body.style.overflow = 'hidden';
		return { backdrop, box };
	}

	function buttons(box, primaryText, run, danger = false) {
		const labels = c();
		const actions = document.createElement('div');
		actions.className = 'admin-schedule-modal-actions';
		const cancel = document.createElement('button');
		cancel.type = 'button';
		cancel.textContent = labels.cancel;
		const primary = document.createElement('button');
		primary.type = 'button';
		primary.className = danger ? 'is-danger' : 'is-primary';
		primary.textContent = primaryText;
		actions.append(cancel, primary);
		box.appendChild(actions);
		cancel.addEventListener('click', () => closeModal(box.parentElement));
		primary.addEventListener('click', async () => {
			primary.disabled = cancel.disabled = true;
			try { await run(); } finally {
				if (document.body.contains(primary)) primary.disabled = cancel.disabled = false;
			}
		});
	}

	function openEditor(schedule, reload) {
		const labels = c();
		const { backdrop, box } = modal(schedule ? labels.editTitle : labels.addTitle);
		const nameLabel = document.createElement('label');
		nameLabel.textContent = labels.name;
		const name = document.createElement('input');
		name.type = 'text'; name.maxLength = 120; name.value = schedule?.title ?? '';
		nameLabel.appendChild(name);
		const dateLabel = document.createElement('label');
		dateLabel.textContent = labels.date;
		const date = document.createElement('input');
		date.type = 'date'; date.value = schedule?.targetDate ?? '';
		dateLabel.appendChild(date);
		const visibleLabel = document.createElement('label');
		visibleLabel.className = 'admin-schedule-check';
		const visible = document.createElement('input');
		visible.type = 'checkbox'; visible.checked = schedule?.isVisible !== false;
		visibleLabel.append(visible, document.createTextNode(labels.visible));
		box.append(nameLabel, dateLabel, visibleLabel);
		buttons(box, labels.save, async () => {
			const title = name.value.trim();
			if (!title) { name.focus(); return; }
			try {
				await requestJson(schedule ? `${DETAIL}?id=${schedule.id}` : API, {
					method: schedule ? 'PATCH' : 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ title, targetDate: date.value || null, isVisible: visible.checked }),
				});
				closeModal(backdrop);
				await reload();
			} catch (error) {
				console.error(error); window.alert(labels.saveFailed);
			}
		});
		name.focus();
	}

	function openDelete(schedule, reload) {
		const labels = c();
		const { backdrop, box } = modal(labels.deleteTitle);
		const message = document.createElement('p');
		message.textContent = `${schedule.title}\n${labels.deleteMessage}`;
		box.appendChild(message);
		buttons(box, labels.confirm, async () => {
			try {
				await requestJson(`${DETAIL}?id=${schedule.id}`, { method: 'DELETE' });
				closeModal(backdrop);
				await reload();
			} catch (error) {
				console.error(error); window.alert(labels.deleteFailed);
			}
		}, true);
	}

	function buildPanel() {
		const settings = document.querySelector('.admin-goals-settings');
		if (!(settings instanceof HTMLElement) || document.getElementById('admin-schedule-panel')) return null;
		const roadmap = document.getElementById('goal-add-button')?.closest('.admin-goals-panel');
		const panel = document.createElement('section');
		panel.id = 'admin-schedule-panel';
		panel.className = 'admin-goals-panel';
		panel.innerHTML = `
			<div class="admin-goals-panel-heading">
				<div><span class="admin-goals-eyebrow">COUNTDOWN</span><h2 id="admin-schedule-title"></h2></div>
				<button id="admin-schedule-add" class="admin-goals-small-button" type="button"></button>
			</div>
			<p id="admin-schedule-description" class="admin-goals-panel-description"></p>
			<div id="admin-schedule-list" class="admin-schedule-list"></div>
		`;
		if (roadmap) settings.insertBefore(panel, roadmap); else settings.appendChild(panel);
		return panel;
	}

	function syncCopy() {
		const labels = c();
		const title = document.getElementById('admin-schedule-title');
		const desc = document.getElementById('admin-schedule-description');
		const add = document.getElementById('admin-schedule-add');
		if (title) title.textContent = labels.title;
		if (desc) desc.textContent = labels.desc;
		if (add) add.textContent = labels.add;
	}

	async function initialize() {
		await window.AdminCommon?.ready;
		installStyle();
		const panel = buildPanel();
		if (!panel) return;
		syncCopy();
		const list = document.getElementById('admin-schedule-list');

		async function reload() {
			if (!(list instanceof HTMLElement)) return;
			try {
				const result = await requestJson(API);
				const schedules = Array.isArray(result.schedules) ? result.schedules : [];
				list.replaceChildren();
				if (schedules.length === 0) {
					const empty = document.createElement('div');
					empty.className = 'admin-schedule-empty'; empty.textContent = c().empty; list.appendChild(empty); return;
				}
				for (const schedule of schedules) {
					const row = document.createElement('div'); row.className = 'admin-schedule-item';
					const text = document.createElement('div'); text.className = 'admin-schedule-copy';
					const title = document.createElement('strong'); title.textContent = schedule.title;
					const meta = document.createElement('span'); meta.textContent = `${dateText(schedule.targetDate)}${schedule.isVisible === false ? ' · hidden' : ''}`;
					text.append(title, meta);
					const value = document.createElement('b'); value.className = 'admin-schedule-dday'; value.textContent = dday(schedule.targetDate);
					const actions = document.createElement('div'); actions.className = 'admin-schedule-actions';
					const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'admin-schedule-action'; edit.textContent = c().edit; edit.addEventListener('click', () => openEditor(schedule, reload));
					const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'admin-schedule-action is-delete'; remove.textContent = c().remove; remove.addEventListener('click', () => openDelete(schedule, reload));
					actions.append(edit, remove); row.append(text, value, actions); list.appendChild(row);
				}
			} catch (error) {
				console.error(error); list.textContent = c().loadFailed;
			}
		}

		document.getElementById('admin-schedule-add')?.addEventListener('click', () => openEditor(null, reload));
		document.addEventListener('adminlanguagechange', () => { syncCopy(); reload(); });
		await reload();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
