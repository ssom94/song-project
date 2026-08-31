(() => {
	const state = {
		cursorEnabled: true,
		cursorTheme: 'blue',
		backgroundKind: 'default',
		backgroundValue: '',
		backgroundOverlay: 12,
		backgroundImageUrl: '',
	};
	let saving = false;

	const BACKGROUNDS = [
		{ kind: 'default', value: '', key: 'siteDesignDefault', preview: "linear-gradient(145deg,#f6f8fc,#eef4ff),url('/assets/images/main_bg.png')" },
		{ kind: 'preset', value: 'soft-blue', key: 'siteDesignSoftBlue', preview: 'linear-gradient(145deg,#eef6ff,#f8fbff 48%,#edf2ff)' },
		{ kind: 'preset', value: 'mint', key: 'siteDesignMint', preview: 'linear-gradient(145deg,#eefbf7,#f8fffc 48%,#e8f8f3)' },
		{ kind: 'preset', value: 'lavender', key: 'siteDesignLavender', preview: 'linear-gradient(145deg,#f4f0ff,#fbf9ff 50%,#eee9ff)' },
		{ kind: 'preset', value: 'sunset', key: 'siteDesignSunset', preview: 'linear-gradient(145deg,#fff1e8,#fff8f2 48%,#f4eaff)' },
		{ kind: 'preset', value: 'night', key: 'siteDesignNight', preview: 'linear-gradient(145deg,#18243c,#263957 52%,#172138)' },
		{ kind: 'preset', value: 'paper-grid', key: 'siteDesignGrid', preview: 'linear-gradient(rgba(86,105,150,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(86,105,150,.12) 1px,transparent 1px),#f7f9ff', size: '18px 18px' },
		{ kind: 'preset', value: 'song-main', key: 'siteDesignSongMain', preview: "url('/assets/images/main_bg.png')" },
		{ kind: 'preset', value: 'couple', key: 'siteDesignCouple', preview: "url('/assets/images/main_couple_bg.png')" },
		{ kind: 'preset', value: 'learning-flags', key: 'siteDesignLearningFlags', preview: "url('/assets/images/learning-flags-bg.svg')" },
	];
	const CURSORS = [
		{ value: 'blue', key: 'siteDesignCursorBlue' },
		{ value: 'navy', key: 'siteDesignCursorNavy' },
		{ value: 'mint', key: 'siteDesignCursorMint' },
	];

	function t(key, fallback = key) {
		const value = window.AdminI18n?.t(key);
		return value && value !== key ? value : fallback;
	}

	function setStatus(key, type) {
		const node = document.getElementById('site-design-status');
		if (!node) return;
		node.hidden = false;
		node.dataset.type = type;
		node.dataset.messageKey = key;
		node.textContent = t(key, key);
	}

	function clearStatus() {
		const node = document.getElementById('site-design-status');
		if (!node) return;
		node.hidden = true;
		delete node.dataset.messageKey;
	}

	function setBusy(value) {
		saving = value;
		for (const id of ['site-design-save', 'site-design-reset', 'site-background-file']) {
			const node = document.getElementById(id);
			if (node) node.disabled = value;
		}
	}

	function selectedBackgroundOption(option) {
		return option.kind === state.backgroundKind && option.value === state.backgroundValue;
	}

	function renderBackgroundOptions() {
		const container = document.getElementById('site-background-options');
		if (!container) return;
		container.replaceChildren();
		for (const option of BACKGROUNDS) {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = `site-design-background-option${selectedBackgroundOption(option) ? ' is-selected' : ''}`;
			button.dataset.backgroundKind = option.kind;
			button.dataset.backgroundValue = option.value;
			const swatch = document.createElement('span');
			swatch.className = 'site-design-background-swatch';
			swatch.style.background = option.preview;
			if (option.size) swatch.style.backgroundSize = option.size;
			else swatch.style.backgroundSize = 'cover';
			const label = document.createElement('b');
			label.textContent = t(option.key, option.value || 'Default');
			button.append(swatch, label);
			button.addEventListener('click', () => {
				state.backgroundKind = option.kind;
				state.backgroundValue = option.value;
				state.backgroundImageUrl = '';
				clearStatus();
				renderBackgroundOptions();
				updatePreview();
			});
			container.appendChild(button);
		}
		if (state.backgroundKind === 'image' && state.backgroundImageUrl) {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'site-design-background-option is-selected';
			const swatch = document.createElement('span');
			swatch.className = 'site-design-background-swatch';
			swatch.style.backgroundImage = `url('${state.backgroundImageUrl.replace(/'/g, '%27')}')`;
			swatch.style.backgroundSize = 'cover';
			const label = document.createElement('b');
			label.textContent = t('siteDesignCustomImage', 'Custom image');
			button.append(swatch, label);
			container.appendChild(button);
		}
	}

	function renderCursorOptions() {
		const container = document.getElementById('site-cursor-options');
		if (!container) return;
		container.replaceChildren();
		for (const option of CURSORS) {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = `site-design-cursor-option${state.cursorTheme === option.value ? ' is-selected' : ''}`;
			const arrow = document.createElement('img');
			arrow.src = `/assets/cursors/arrow-${option.value}.svg`;
			arrow.alt = '';
			const click = document.createElement('img');
			click.src = `/assets/cursors/click-${option.value}.svg`;
			click.alt = '';
			const label = document.createElement('b');
			label.textContent = t(option.key, option.value);
			button.append(arrow, click, label);
			button.addEventListener('click', () => {
				state.cursorTheme = option.value;
				clearStatus();
				renderCursorOptions();
				updatePreview();
			});
			container.appendChild(button);
		}
	}

	function backgroundPreviewLayer() {
		if (state.backgroundKind === 'default') return BACKGROUNDS[0].preview;
		if (state.backgroundKind === 'solid') return state.backgroundValue || '#eef5ff';
		if (state.backgroundKind === 'image' && state.backgroundImageUrl) return `url('${state.backgroundImageUrl.replace(/'/g, '%27')}')`;
		const option = BACKGROUNDS.find((item) => item.kind === state.backgroundKind && item.value === state.backgroundValue);
		return option?.preview || BACKGROUNDS[0].preview;
	}

	function updatePreview() {
		const preview = document.getElementById('site-design-preview');
		if (preview) {
			preview.style.background = backgroundPreviewLayer();
			preview.style.backgroundSize = state.backgroundValue === 'paper-grid' ? '18px 18px' : 'cover';
			preview.style.setProperty('--preview-overlay', String(Math.max(0, Math.min(80, state.backgroundOverlay)) / 100));
		}
		const cursor = document.getElementById('site-design-preview-cursor');
		if (cursor) {
			cursor.src = `/assets/cursors/arrow-${state.cursorTheme}.svg`;
			cursor.hidden = !state.cursorEnabled;
		}
		const enabled = document.getElementById('site-cursor-enabled');
		if (enabled) enabled.checked = state.cursorEnabled;
		const overlay = document.getElementById('site-background-overlay');
		if (overlay) overlay.value = String(state.backgroundOverlay);
		const overlayValue = document.getElementById('site-background-overlay-value');
		if (overlayValue) overlayValue.textContent = `${state.backgroundOverlay}%`;
		const color = document.getElementById('site-background-color');
		if (color && state.backgroundKind === 'solid' && /^#[0-9a-f]{6}$/i.test(state.backgroundValue)) color.value = state.backgroundValue;
	}

	function render() {
		renderBackgroundOptions();
		renderCursorOptions();
		updatePreview();
	}

	async function loadSettings() {
		const response = await fetch('/api/admin/site-visuals', { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
		if (response.status === 401) {
			window.location.replace('/admin/login/');
			return false;
		}
		const result = await response.json().catch(() => null);
		if (!response.ok || !result?.ok) throw new Error('SITE_VISUALS_LOAD_FAILED');
		state.cursorEnabled = result.cursor?.enabled !== false;
		state.cursorTheme = ['blue', 'navy', 'mint'].includes(result.cursor?.theme) ? result.cursor.theme : 'blue';
		state.backgroundKind = ['default', 'solid', 'preset', 'image'].includes(result.background?.kind) ? result.background.kind : 'default';
		state.backgroundValue = typeof result.background?.value === 'string' ? result.background.value : '';
		state.backgroundOverlay = Number.isInteger(Number(result.background?.overlay)) ? Math.max(0, Math.min(80, Number(result.background.overlay))) : 12;
		state.backgroundImageUrl = typeof result.background?.imageUrl === 'string' ? result.background.imageUrl : '';
		render();
		return true;
	}

	async function saveSettings() {
		if (saving) return;
		setBusy(true);
		clearStatus();
		try {
			const response = await fetch('/api/admin/site-visuals', {
				method: 'PATCH',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					cursorEnabled: state.cursorEnabled,
					cursorTheme: state.cursorTheme,
					backgroundKind: state.backgroundKind,
					backgroundValue: state.backgroundValue,
					backgroundOverlay: state.backgroundOverlay,
				}),
			});
			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error || 'SITE_VISUALS_UPDATE_FAILED');
			state.backgroundImageUrl = result.background?.imageUrl || state.backgroundImageUrl;
			setStatus('siteDesignSaved', 'success');
		} catch (error) {
			console.error('Failed to save site design', error);
			setStatus('siteDesignSaveFailed', 'error');
		} finally {
			setBusy(false);
		}
	}

	async function uploadBackground(file) {
		if (!file || saving) return;
		if (file.size > 5 * 1024 * 1024) {
			setStatus('siteDesignUploadFailed', 'error');
			return;
		}
		setBusy(true);
		clearStatus();
		try {
			const form = new FormData();
			form.append('file', file);
			const response = await fetch('/api/admin/site-visuals/background', { method: 'POST', credentials: 'same-origin', body: form });
			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok || !result.key || !result.url) throw new Error(result?.error || 'BACKGROUND_UPLOAD_FAILED');
			state.backgroundKind = 'image';
			state.backgroundValue = result.key;
			state.backgroundImageUrl = result.url;
			render();
		} catch (error) {
			console.error('Failed to upload background', error);
			setStatus('siteDesignUploadFailed', 'error');
		} finally {
			setBusy(false);
		}
	}

	function resetDefaults() {
		state.cursorEnabled = true;
		state.cursorTheme = 'blue';
		state.backgroundKind = 'default';
		state.backgroundValue = '';
		state.backgroundOverlay = 12;
		state.backgroundImageUrl = '';
		clearStatus();
		render();
	}

	async function initialize() {
		const session = await window.AdminCommon?.ready;
		if (!session) return;
		await window.AdminI18n?.ready;
		try {
			await loadSettings();
		} catch (error) {
			console.error('Failed to load site design', error);
			setStatus('siteDesignLoadFailed', 'error');
			render();
		}

		document.getElementById('site-design-save')?.addEventListener('click', saveSettings);
		document.getElementById('site-design-reset')?.addEventListener('click', resetDefaults);
		document.getElementById('site-cursor-enabled')?.addEventListener('change', (event) => {
			state.cursorEnabled = event.currentTarget.checked;
			clearStatus();
			updatePreview();
		});
		document.getElementById('site-background-overlay')?.addEventListener('input', (event) => {
			state.backgroundOverlay = Number(event.currentTarget.value) || 0;
			clearStatus();
			updatePreview();
		});
		document.getElementById('site-background-color')?.addEventListener('input', (event) => {
			state.backgroundKind = 'solid';
			state.backgroundValue = event.currentTarget.value;
			state.backgroundImageUrl = '';
			clearStatus();
			renderBackgroundOptions();
			updatePreview();
		});
		document.getElementById('site-background-file')?.addEventListener('change', (event) => {
			const file = event.currentTarget.files?.[0];
			if (file) uploadBackground(file);
			event.currentTarget.value = '';
		});
		document.addEventListener('adminlanguagechange', () => {
			render();
			const status = document.getElementById('site-design-status');
			if (status?.dataset.messageKey) status.textContent = t(status.dataset.messageKey, status.textContent);
		});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
