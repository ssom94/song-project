(() => {
	const API = '/api/admin/dashboard';
	let customGoalSequence = 0;
	let baseline = '';
	let dirty = false;
	let saving = false;
	let hydrating = false;
	let allowNavigation = false;

	const placeholderLearning = {
		registeredWords: 0,
		wrongWords: 0,
	};

	const coreApiKeys = {
		jlpt: 'jlpt-n1',
		ap: 'ap',
		fp: 'fp',
		aws: 'aws-saa',
		portfolio: 'portfolio',
	};

	const coreDomKeys = Object.fromEntries(Object.entries(coreApiKeys).map(([domKey, apiKey]) => [apiKey, domKey]));

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

	function uiCopy() {
		return language() === 'ko'
			? {
				save: '설정 완료', saving: '저장 중...', idle: '수정하면 저장 버튼이 활성화됩니다.', dirty: '저장하지 않은 변경사항이 있습니다.', saved: '저장되었습니다.',
				saveFailed: '설정을 저장하지 못했습니다.', loadFailed: '저장된 목표 설정을 불러오지 못했습니다.',
				leave: '저장하지 않은 변경사항이 있습니다. 페이지를 이동하면 수정한 내용이 사라집니다. 그래도 이동할까요?',
				preview: '저장하면 공개 홈에 바로 반영됩니다.', customGoal: '추가 목표', removeGoal: '삭제', show: '표시', targetDate: '목표일', progress: '진행률', status: '상태', planned: '예정', progressing: '진행 중', done: '완료',
			}
			: {
				save: '設定を保存', saving: '保存中...', idle: '変更すると保存ボタンが有効になります。', dirty: '保存していない変更があります。', saved: '保存しました。',
				saveFailed: '設定を保存できませんでした。', loadFailed: '保存された目標設定を読み込めませんでした。',
				leave: '保存していない変更があります。移動すると編集内容が失われます。このまま移動しますか？',
				preview: '保存すると公開ホームにすぐ反映されます。', customGoal: '追加目標', removeGoal: '削除', show: '表示', targetDate: '目標日', progress: '進捗率', status: '状態', planned: '予定', progressing: '進行中', done: '完了',
			};
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
			year: 'numeric', month: '2-digit', day: '2-digit',
		}).format(date);
	}

	function syncJlptMode() {
		const manual = currentMode() === 'manual';
		const input = byId('jlpt-manual-target');
		if (input) input.disabled = !manual;
	}

	function goalStatusLabel(value) {
		if (value === 'done') return t('statusDone', language() === 'ko' ? '완료' : '完了');
		if (value === 'progress') return t('statusProgress', language() === 'ko' ? '진행 중' : '進行中');
		return t('statusPlanned', language() === 'ko' ? '예정' : '予定');
	}

	function goalProgressForItem(item, jlptProgress) {
		const apiKey = item.dataset.apiGoalKey || coreApiKeys[item.dataset.goalKey] || item.dataset.goalKey;
		if (apiKey === 'jlpt-n1') return jlptProgress.percent;
		if (apiKey === 'portfolio') {
			const completed = Math.max(0, number(byId('portfolio-completed')?.value));
			const target = Math.max(1, number(byId('portfolio-target')?.value, 2));
			return clamp(Math.round((completed / target) * 100), 0, 100);
		}
		return clamp(Math.round(number(item.querySelector('.admin-goal-progress')?.value)), 0, 100);
	}

	function renderJlptPreview(progress) {
		const previewCard = document.querySelector('.admin-goals-preview-jlpt');
		const visibility = byId('jlpt-visible');
		if (previewCard instanceof HTMLElement && visibility instanceof HTMLInputElement) previewCard.hidden = !visibility.checked;

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
		if (source) source.textContent = progress.mode === 'manual'
			? t('previewManual', language() === 'ko' ? '직접 설정' : '直接設定')
			: t('previewAuto', language() === 'ko' ? '자동' : '自動');
		byId('preview-ring')?.style.setProperty('--preview-deg', `${progress.percent * 3.6}deg`);

		const jlptGoal = document.querySelector('[data-goal-key="jlpt"]');
		const progressInput = jlptGoal?.querySelector('.admin-goal-progress');
		if (progressInput instanceof HTMLInputElement) progressInput.value = String(progress.percent);
	}

	function createPreviewRow(item, jlptProgress) {
		const labels = uiCopy();
		const name = item.querySelector('.admin-goal-name')?.value?.trim() || labels.customGoal;
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
		const progress = calculateJlptProgress();
		renderJlptPreview(progress);
		renderGoalPreview(progress);
	}

	function createCustomGoalItem(goal = null) {
		customGoalSequence += 1;
		const labels = uiCopy();
		const item = document.createElement('article');
		item.className = 'admin-goal-editor-item';
		const key = goal?.goalKey || `custom-local-${Date.now().toString(36)}-${customGoalSequence}`;
		item.dataset.goalKey = key;
		item.dataset.apiGoalKey = key;
		if (goal?.id) item.dataset.goalId = String(goal.id);

		const top = document.createElement('div');
		top.className = 'admin-goal-editor-top';
		const icon = document.createElement('span');
		icon.className = 'admin-goal-editor-icon';
		icon.textContent = '+';
		const name = document.createElement('input');
		name.className = 'admin-goal-name';
		name.type = 'text';
		name.maxLength = 120;
		name.value = goal?.title || labels.customGoal;
		const visibleLabel = document.createElement('label');
		visibleLabel.className = 'admin-goals-toggle';
		const visible = document.createElement('input');
		visible.className = 'admin-goal-visible';
		visible.type = 'checkbox';
		visible.checked = goal?.isVisible !== false;
		const visibleText = document.createElement('span');
		visibleText.textContent = labels.show;
		visibleLabel.append(visible, visibleText);
		top.append(icon, name, visibleLabel);

		const fields = document.createElement('div');
		fields.className = 'admin-goal-editor-fields';
		const dateLabel = document.createElement('label');
		const dateText = document.createElement('span');
		dateText.textContent = labels.targetDate;
		const date = document.createElement('input');
		date.className = 'admin-goal-date';
		date.type = 'date';
		date.value = goal?.targetDate || '';
		dateLabel.append(dateText, date);

		const progressLabel = document.createElement('label');
		const progressText = document.createElement('span');
		progressText.textContent = labels.progress;
		const progress = document.createElement('input');
		progress.className = 'admin-goal-progress';
		progress.type = 'number';
		progress.min = '0';
		progress.max = '100';
		progress.value = String(clamp(number(goal?.progressPercent), 0, 100));
		progressLabel.append(progressText, progress);

		const statusLabel = document.createElement('label');
		const statusText = document.createElement('span');
		statusText.textContent = labels.status;
		const status = document.createElement('select');
		status.className = 'admin-goal-status';
		for (const [value, label] of [['planned', labels.planned], ['progress', labels.progressing], ['done', labels.done]]) {
			const option = document.createElement('option');
			option.value = value;
			option.textContent = label;
			status.appendChild(option);
		}
		status.value = goal?.status || 'planned';
		statusLabel.append(statusText, status);
		fields.append(dateLabel, progressLabel, statusLabel);

		const remove = document.createElement('button');
		remove.className = 'admin-goal-remove';
		remove.type = 'button';
		remove.textContent = labels.removeGoal;
		remove.addEventListener('click', () => {
			item.remove();
			renderPreview();
			updateDirtyState();
		});

		item.append(top, fields, remove);
		return item;
	}

	function appendCustomGoal() {
		const item = createCustomGoalItem();
		byId('goal-editor-list')?.appendChild(item);
		item.querySelector('input')?.focus();
		renderPreview();
		updateDirtyState();
	}

	function apiKeyForItem(item) {
		return item.dataset.apiGoalKey || coreApiKeys[item.dataset.goalKey] || item.dataset.goalKey || '';
	}

	function serializeGoal(item, index) {
		const goalKey = apiKeyForItem(item);
		const id = Number(item.dataset.goalId || 0) || undefined;
		const title = item.querySelector('.admin-goal-name')?.value?.trim() || '';
		const targetDate = item.querySelector('.admin-goal-date')?.value || null;
		const status = item.querySelector('.admin-goal-status')?.value || 'planned';
		const visible = item.querySelector('.admin-goal-visible');
		const isVisible = !(visible instanceof HTMLInputElement) || visible.checked;
		const jlptProgress = calculateJlptProgress();
		const progressPercent = goalKey === 'jlpt-n1'
			? jlptProgress.percent
			: goalKey === 'portfolio'
				? goalProgressForItem(item, jlptProgress)
				: clamp(Math.round(number(item.querySelector('.admin-goal-progress')?.value)), 0, 100);

		let goalType = 'percent';
		let targetCount = null;
		let completedCount = 0;
		if (goalKey === 'jlpt-n1') goalType = 'jlpt_auto';
		if (goalKey === 'portfolio') {
			goalType = 'count';
			targetCount = Math.max(1, Math.floor(number(byId('portfolio-target')?.value, 2)));
			completedCount = Math.max(0, Math.floor(number(byId('portfolio-completed')?.value)));
		}

		return {
			...(id ? { id } : {}),
			goalKey,
			title,
			goalType,
			targetDate,
			progressPercent,
			targetCount,
			completedCount,
			status,
			displayOrder: (index + 1) * 10,
			isVisible,
		};
	}

	function serializeSettings() {
		const items = [...document.querySelectorAll('.admin-goal-editor-item')];
		const mode = currentMode();
		const manualTarget = mode === 'manual' ? Math.max(1, Math.floor(number(byId('jlpt-manual-target')?.value, 1))) : null;
		return {
			jlptGoalMode: mode,
			jlptManualTarget: manualTarget,
			showJlpt: byId('jlpt-visible') instanceof HTMLInputElement ? byId('jlpt-visible').checked : true,
			goals: items.map(serializeGoal),
		};
	}

	function snapshot() {
		return JSON.stringify(serializeSettings());
	}

	function syncSaveUi(message = null) {
		const labels = uiCopy();
		const button = byId('dashboard-settings-save');
		const footer = document.querySelector('.admin-goals-footer-actions');
		const note = byId('admin-goals-save-note');
		const previewNote = byId('admin-goals-preview-note');
		if (previewNote) previewNote.textContent = labels.preview;
		if (button instanceof HTMLButtonElement) {
			button.disabled = !dirty || saving;
			button.classList.toggle('is-dirty', dirty && !saving);
			button.classList.toggle('is-saving', saving);
			button.textContent = saving ? labels.saving : labels.save;
		}
		footer?.classList.toggle('is-dirty', dirty);
		if (note) note.textContent = message || (dirty ? labels.dirty : labels.idle);
	}

	function updateDirtyState() {
		if (hydrating) return;
		dirty = baseline !== '' && snapshot() !== baseline;
		syncSaveUi();
	}

	async function requestJson(url, options = {}) {
		const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
		const result = await response.json().catch(() => null);
		if (!response.ok || !result?.ok) throw new Error(result?.error || `HTTP_${response.status}`);
		return result;
	}

	function applyGoalToItem(item, goal) {
		if (!(item instanceof HTMLElement) || !goal) return;
		item.dataset.apiGoalKey = goal.goalKey;
		if (goal.id) item.dataset.goalId = String(goal.id);
		const name = item.querySelector('.admin-goal-name');
		const date = item.querySelector('.admin-goal-date');
		const progress = item.querySelector('.admin-goal-progress');
		const status = item.querySelector('.admin-goal-status');
		const visible = item.querySelector('.admin-goal-visible');
		if (name instanceof HTMLInputElement) name.value = goal.title || '';
		if (date instanceof HTMLInputElement) date.value = goal.targetDate || '';
		if (progress instanceof HTMLInputElement) progress.value = String(clamp(number(goal.progressPercent), 0, 100));
		if (status instanceof HTMLSelectElement) status.value = goal.status || 'planned';
		if (visible instanceof HTMLInputElement) visible.checked = goal.isVisible !== false;
		if (goal.goalKey === 'portfolio') {
			if (byId('portfolio-target') instanceof HTMLInputElement) byId('portfolio-target').value = String(Math.max(1, number(goal.targetCount, 2)));
			if (byId('portfolio-completed') instanceof HTMLInputElement) byId('portfolio-completed').value = String(Math.max(0, number(goal.completedCount)));
		}
	}

	function hydrateDashboard(result) {
		hydrating = true;
		try {
			const settings = result?.settings || {};
			const auto = document.querySelector('input[name="jlpt-goal-mode"][value="auto"]');
			const manual = document.querySelector('input[name="jlpt-goal-mode"][value="manual"]');
			if (auto instanceof HTMLInputElement) auto.checked = settings.jlptGoalMode !== 'manual';
			if (manual instanceof HTMLInputElement) manual.checked = settings.jlptGoalMode === 'manual';
			const target = byId('jlpt-manual-target');
			if (target instanceof HTMLInputElement) target.value = String(settings.jlptManualTarget ?? 2500);
			const showJlpt = byId('jlpt-visible');
			if (showJlpt instanceof HTMLInputElement) showJlpt.checked = settings.showJlpt !== false;

			document.querySelectorAll('.admin-goal-editor-item').forEach((item) => {
				if (!Object.prototype.hasOwnProperty.call(coreApiKeys, item.dataset.goalKey)) item.remove();
			});

			for (const item of document.querySelectorAll('.admin-goal-editor-item')) {
				const apiKey = coreApiKeys[item.dataset.goalKey];
				if (apiKey) item.dataset.apiGoalKey = apiKey;
			}

			for (const goal of Array.isArray(result?.goals) ? result.goals : []) {
				const domKey = coreDomKeys[goal.goalKey];
				let item = domKey ? document.querySelector(`.admin-goal-editor-item[data-goal-key="${domKey}"]`) : null;
				if (!item) {
					item = createCustomGoalItem(goal);
					byId('goal-editor-list')?.appendChild(item);
				}
				applyGoalToItem(item, goal);
			}

			const jlptGoalDate = document.querySelector('[data-goal-key="jlpt"] .admin-goal-date');
			const jlptDate = byId('jlpt-dday');
			if (jlptGoalDate instanceof HTMLInputElement && jlptDate instanceof HTMLInputElement) jlptDate.value = jlptGoalDate.value;
			renderPreview();
		} finally {
			hydrating = false;
		}
		baseline = snapshot();
		dirty = false;
		syncSaveUi();
	}

	async function loadDashboard() {
		try {
			const [result, publicResult] = await Promise.all([
				requestJson(API),
				fetch('/api/public/dashboard', { cache: 'no-store' }).then((response) => response.json()).catch(() => null),
			]);
			if (publicResult?.ok && publicResult.learning) {
				placeholderLearning.registeredWords = Number(publicResult.learning.registeredWords ?? 0);
				placeholderLearning.wrongWords = Number(publicResult.learning.wrongWords ?? 0);
			}
			hydrateDashboard(result);
		} catch (error) {
			console.error('Failed to load dashboard settings', error);
			window.alert(uiCopy().loadFailed);
			baseline = snapshot();
			dirty = false;
			syncSaveUi();
		}
	}

	async function saveDashboard() {
		if (!dirty || saving) return;
		saving = true;
		syncSaveUi();
		try {
			const payload = serializeSettings();
			const result = await requestJson(API, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			hydrateDashboard(result);
			syncSaveUi(uiCopy().saved);
			window.setTimeout(() => {
				if (!dirty) syncSaveUi();
			}, 1400);
		} catch (error) {
			console.error('Failed to save dashboard settings', error);
			window.alert(uiCopy().saveFailed);
		} finally {
			saving = false;
			syncSaveUi();
		}
	}

	function bindLivePreview() {
		const root = document.querySelector('.admin-goals-settings');
		root?.addEventListener('input', (event) => {
			if (event.target instanceof Element && event.target.closest('.admin-goals-display-panel')) return;
			renderPreview();
			updateDirtyState();
		});
		root?.addEventListener('change', (event) => {
			if (event.target instanceof Element && event.target.closest('.admin-goals-display-panel')) return;
			if (event.target instanceof HTMLInputElement && event.target.id === 'jlpt-dday') {
				const goalDate = document.querySelector('[data-goal-key="jlpt"] .admin-goal-date');
				if (goalDate instanceof HTMLInputElement) goalDate.value = event.target.value;
			}
			if (event.target instanceof HTMLInputElement && event.target.classList.contains('admin-goal-date') && event.target.closest('[data-goal-key="jlpt"]')) {
				const jlptDate = byId('jlpt-dday');
				if (jlptDate instanceof HTMLInputElement) jlptDate.value = event.target.value;
			}
			renderPreview();
			updateDirtyState();
		});
		byId('goal-add-button')?.addEventListener('click', appendCustomGoal);
		byId('dashboard-settings-save')?.addEventListener('click', saveDashboard);
	}

	function bindNavigationWarning() {
		window.addEventListener('beforeunload', (event) => {
			if (!dirty || allowNavigation) return;
			event.preventDefault();
			event.returnValue = '';
		});

		document.addEventListener('click', (event) => {
			if (!dirty || allowNavigation || event.defaultPrevented) return;
			if (!(event.target instanceof Element)) return;
			const anchor = event.target.closest('a[href]');
			if (!(anchor instanceof HTMLAnchorElement)) return;
			if (anchor.target === '_blank' || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
			const href = anchor.getAttribute('href') || '';
			if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
			if (!window.confirm(uiCopy().leave)) {
				event.preventDefault();
				event.stopImmediatePropagation();
				return;
			}
			allowNavigation = true;
		}, true);
	}

	function syncLanguageCopy() {
		syncSaveUi();
		for (const item of document.querySelectorAll('.admin-goal-editor-item')) {
			if (Object.prototype.hasOwnProperty.call(coreApiKeys, item.dataset.goalKey)) continue;
			const labels = uiCopy();
			const remove = item.querySelector('.admin-goal-remove');
			if (remove) remove.textContent = labels.removeGoal;
		}
		renderPreview();
	}

	async function initialize() {
		await window.AdminCommon?.ready;
		bindLivePreview();
		bindNavigationWarning();
		document.addEventListener('adminlanguagechange', syncLanguageCopy);
		syncSaveUi();
		await loadDashboard();
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
