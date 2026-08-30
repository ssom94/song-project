(() => {
	let customGoalSequence = 0;
	const placeholderLearning = {
		registeredWords: 0,
		wrongWords: 0,
	};

	function byId(id) {
		return document.getElementById(id);
	}

	function t(key, fallback) {
		const value = window.AdminI18n?.t?.(key);
		return value && value !== key ? value : fallback;
	}

	function language() {
		return window.AdminI18n?.getLanguage?.() ?? 'ja';
	}

	function number(value, fallback = 0) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : fallback;
	}

	function clamp(value, min, max) {
		return Math.min(max, Math.max(min, value));
	}

	function formatNumber(value) {
		return new Intl.NumberFormat(language() === 'ko' ? 'ko-KR' : 'ja-JP').format(Math.max(0, Math.floor(number(value))));
	}

	function currentMode() {
		return document.querySelector('input[name="jlpt-goal-mode"]:checked')?.value === 'manual' ? 'manual' : 'auto';
	}

	function calculateJlptProgress() {
		const registered = Math.max(0, Math.floor(number(placeholderLearning.registeredWords)));
		const wrong = clamp(Math.floor(number(placeholderLearning.wrongWords)), 0, registered);
		const mastered = Math.max(0, registered - wrong);
		const mode = currentMode();
		const manualTarget = Math.max(0, Math.floor(number(byId('jlpt-manual-target')?.value)));
		const target = mode === 'manual' && manualTarget > 0 ? manualTarget : registered;
		const achieved = target > 0 ? Math.min(mastered, target) : 0;
		const remaining = Math.max(0, target - achieved);
		const percent = target > 0 ? clamp(Math.round((achieved / target) * 100), 0, 100) : 0;
		return { registered, wrong, mastered, target, achieved, remaining, percent, mode };
	}

	function formatGoalDate(value) {
		if (!value) return t('noDate', language() === 'ko' ? '날짜 미설정' : '日付未設定');
		const date = new Date(`${value}T00:00:00`);
		if (Number.isNaN(date.getTime())) return value;
		return new Intl.DateTimeFormat(language() === 'ko' ? 'ko-KR' : 'ja-JP', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}).format(date);
	}

	function syncJlptMode() {
		const manual = currentMode() === 'manual';
		const input = byId('jlpt-manual-target');
		if (input) input.disabled = !manual;
	}

	function syncJlptDateToGoal() {
		const jlptGoal = document.querySelector('[data-goal-key="jlpt"]');
		const goalDate = jlptGoal?.querySelector('.admin-goal-date');
		const jlptDate = byId('jlpt-dday');
		if (goalDate instanceof HTMLInputElement && jlptDate instanceof HTMLInputElement && document.activeElement === jlptDate) {
			goalDate.value = jlptDate.value;
		}
	}

	function goalStatusLabel(value) {
		if (value === 'done') return t('statusDone', language() === 'ko' ? '완료' : '完了');
		if (value === 'progress') return t('statusProgress', language() === 'ko' ? '진행 중' : '進行中');
		return t('statusPlanned', language() === 'ko' ? '예정' : '予定');
	}

	function goalProgressForItem(item, jlptProgress) {
		const key = item.dataset.goalKey;
		if (key === 'jlpt') return jlptProgress.percent;
		if (key === 'portfolio') {
			const completed = Math.max(0, number(byId('portfolio-completed')?.value));
			const target = Math.max(1, number(byId('portfolio-target')?.value, 2));
			return clamp(Math.round((completed / target) * 100), 0, 100);
		}
		return clamp(Math.round(number(item.querySelector('.admin-goal-progress')?.value)), 0, 100);
	}

	function renderJlptPreview(progress) {
		const previewCard = document.querySelector('.admin-goals-preview-jlpt');
		const visibility = byId('jlpt-visible');
		if (previewCard instanceof HTMLElement && visibility instanceof HTMLInputElement) {
			previewCard.hidden = !visibility.checked;
		}

		const values = {
			'preview-registered': formatNumber(progress.registered),
			'preview-wrong': formatNumber(progress.wrong),
			'preview-mastered': formatNumber(progress.mastered),
			'preview-target': formatNumber(progress.target),
			'preview-percent': `${progress.percent}%`,
			'preview-achieved': formatNumber(progress.achieved),
			'preview-goal-target': formatNumber(progress.target),
			'preview-remaining': formatNumber(progress.remaining),
		};
		for (const [id, value] of Object.entries(values)) {
			const node = byId(id);
			if (node) node.textContent = value;
		}

		const source = byId('preview-goal-source');
		if (source) {
			source.textContent = progress.mode === 'manual'
				? t('previewManual', language() === 'ko' ? '직접 설정' : '直接設定')
				: t('previewAuto', language() === 'ko' ? '자동' : '自動');
		}
		byId('preview-ring')?.style.setProperty('--preview-deg', `${progress.percent * 3.6}deg`);

		const jlptGoal = document.querySelector('[data-goal-key="jlpt"]');
		const progressInput = jlptGoal?.querySelector('.admin-goal-progress');
		if (progressInput instanceof HTMLInputElement) progressInput.value = String(progress.percent);
	}

	function createPreviewRow(item, jlptProgress) {
		const name = item.querySelector('.admin-goal-name')?.value?.trim() || t('customGoal', language() === 'ko' ? '추가 목표' : '追加目標');
		const date = item.querySelector('.admin-goal-date')?.value || '';
		const status = item.querySelector('.admin-goal-status')?.value || 'planned';
		const progress = goalProgressForItem(item, jlptProgress);

		const row = document.createElement('div');
		row.className = 'admin-goal-preview-row';
		const copy = document.createElement('div');
		const title = document.createElement('strong');
		title.textContent = name;
		const meta = document.createElement('small');
		meta.textContent = `${formatGoalDate(date)} · ${goalStatusLabel(status)}`;
		copy.append(title, meta);
		const percent = document.createElement('b');
		percent.textContent = `${progress}%`;
		row.append(copy, percent);
		return row;
	}

	function renderGoalPreview(jlptProgress) {
		const list = byId('goal-preview-list');
		if (!list) return;
		list.replaceChildren();
		const visibleItems = [...document.querySelectorAll('.admin-goal-editor-item')].filter((item) => {
			const checkbox = item.querySelector('.admin-goal-visible');
			return !(checkbox instanceof HTMLInputElement) || checkbox.checked;
		});
		for (const item of visibleItems) list.appendChild(createPreviewRow(item, jlptProgress));
		const count = byId('preview-goal-count');
		if (count) count.textContent = String(visibleItems.length);
	}

	function renderPreview() {
		syncJlptMode();
		syncJlptDateToGoal();
		const progress = calculateJlptProgress();
		renderJlptPreview(progress);
		renderGoalPreview(progress);
	}

	function appendCustomGoal() {
		customGoalSequence += 1;
		const item = document.createElement('article');
		item.className = 'admin-goal-editor-item';
		item.dataset.goalKey = `custom-${customGoalSequence}`;

		const top = document.createElement('div');
		top.className = 'admin-goal-editor-top';
		const icon = document.createElement('span');
		icon.className = 'admin-goal-editor-icon';
		icon.textContent = '+';
		const name = document.createElement('input');
		name.className = 'admin-goal-name';
		name.type = 'text';
		name.value = t('customGoal', language() === 'ko' ? '추가 목표' : '追加目標');
		const visibleLabel = document.createElement('label');
		visibleLabel.className = 'admin-goals-toggle';
		const visible = document.createElement('input');
		visible.className = 'admin-goal-visible';
		visible.type = 'checkbox';
		visible.checked = true;
		const visibleText = document.createElement('span');
		visibleText.textContent = t('show', language() === 'ko' ? '표시' : '表示');
		visibleLabel.append(visible, visibleText);
		top.append(icon, name, visibleLabel);

		const fields = document.createElement('div');
		fields.className = 'admin-goal-editor-fields';
		const dateLabel = document.createElement('label');
		const dateText = document.createElement('span');
		dateText.textContent = t('targetDate', language() === 'ko' ? '목표일' : '目標日');
		const date = document.createElement('input');
		date.className = 'admin-goal-date';
		date.type = 'date';
		dateLabel.append(dateText, date);

		const progressLabel = document.createElement('label');
		const progressText = document.createElement('span');
		progressText.textContent = t('progressPercent', language() === 'ko' ? '진행률' : '進捗率');
		const progress = document.createElement('input');
		progress.className = 'admin-goal-progress';
		progress.type = 'number';
		progress.min = '0';
		progress.max = '100';
		progress.value = '0';
		progressLabel.append(progressText, progress);

		const statusLabel = document.createElement('label');
		const statusText = document.createElement('span');
		statusText.textContent = t('goalStatus', language() === 'ko' ? '상태' : '状態');
		const status = document.createElement('select');
		status.className = 'admin-goal-status';
		for (const [value, key, fallback] of [
			['planned', 'statusPlanned', language() === 'ko' ? '예정' : '予定'],
			['progress', 'statusProgress', language() === 'ko' ? '진행 중' : '進行中'],
			['done', 'statusDone', language() === 'ko' ? '완료' : '完了'],
		]) {
			const option = document.createElement('option');
			option.value = value;
			option.textContent = t(key, fallback);
			status.appendChild(option);
		}
		statusLabel.append(statusText, status);
		fields.append(dateLabel, progressLabel, statusLabel);

		const remove = document.createElement('button');
		remove.className = 'admin-goal-remove';
		remove.type = 'button';
		remove.textContent = t('removeGoal', language() === 'ko' ? '삭제' : '削除');
		remove.addEventListener('click', () => {
			item.remove();
			renderPreview();
		});

		item.append(top, fields, remove);
		byId('goal-editor-list')?.appendChild(item);
		item.querySelector('input')?.focus();
		renderPreview();
	}

	function bindLivePreview() {
		const root = document.querySelector('.admin-goals-settings');
		root?.addEventListener('input', renderPreview);
		root?.addEventListener('change', renderPreview);
		byId('jlpt-dday')?.addEventListener('change', () => {
			const goalDate = document.querySelector('[data-goal-key="jlpt"] .admin-goal-date');
			if (goalDate instanceof HTMLInputElement) goalDate.value = byId('jlpt-dday')?.value || '';
			renderPreview();
		});
		byId('goal-add-button')?.addEventListener('click', appendCustomGoal);
	}

	async function initialize() {
		await window.AdminCommon?.ready;
		bindLivePreview();
		document.addEventListener('adminlanguagechange', renderPreview);
		renderPreview();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();

if (!document.querySelector('script[data-admin-dashboard-schedules]')) {
	const script = document.createElement('script');
	script.src = '/assets/js/admin/dashboard-schedules.js';
	script.dataset.adminDashboardSchedules = 'true';
	document.body.appendChild(script);
}
