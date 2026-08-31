(() => {
	const DEFAULT_APPEARANCE = { kind: 'preset', value: 'folder', color: '#5b6ee1', imageUrl: null };
	const COLOR_PRESETS = ['#356cc9', '#5b6ee1', '#7157c8', '#b34f8a', '#d45d4c', '#d48732', '#2f8f6b', '#287b72', '#5d6b7a', '#303b59'];
	let appearance = { ...DEFAULT_APPEARANCE };
	let categoryCache = new Map();
	let activeFilter = 'all';
	let uploading = false;
	let cursorSettings = { enabled: true, theme: 'blue' };
	const nativeFetch = window.fetch.bind(window);

	function language() {
		return window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja';
	}

	function copy(ko, ja) {
		return language() === 'ko' ? ko : ja;
	}

	function apiPath(input) {
		try {
			const raw = typeof input === 'string' ? input : input?.url;
			return new URL(raw, window.location.origin).pathname;
		} catch {
			return '';
		}
	}

	function requestMethod(input, init) {
		return String(init?.method || input?.method || 'GET').toUpperCase();
	}

	function appearancePayload() {
		return {
			iconKind: appearance.kind,
			iconValue: appearance.value,
			iconColor: appearance.color,
		};
	}

	window.fetch = async (input, init) => {
		const path = apiPath(input);
		const method = requestMethod(input, init);
		let nextInit = init;
		const categorySave = (path === '/api/admin/categories' && method === 'POST')
			|| (path === '/api/admin/categories/detail' && method === 'PATCH');
		if (categorySave && typeof init?.body === 'string') {
			try {
				const body = JSON.parse(init.body);
				nextInit = { ...init, body: JSON.stringify({ ...body, ...appearancePayload() }) };
			} catch { /* original request will handle invalid JSON */ }
		}

		const response = await nativeFetch(input, nextInit);
		if (path === '/api/admin/categories' && method === 'GET' && response.ok) {
			try {
				const body = await response.clone().json();
				if (Array.isArray(body?.categories)) {
					categoryCache = new Map(body.categories.map((category) => [Number(category.id), category]));
					queueMicrotask(decorateCategoryRows);
				}
			} catch { /* presentation enhancement only */ }
		}
		return response;
	};

	function normalize(next) {
		const helper = window.SongCategoryIcons;
		const normalized = helper?.normalizeAppearance?.(next) || { ...DEFAULT_APPEARANCE };
		return {
			kind: normalized.kind,
			value: normalized.value,
			color: normalized.color,
			imageUrl: normalized.imageUrl || (normalized.kind === 'image' && normalized.value
				? `/api/public/category-icon?key=${encodeURIComponent(normalized.value)}` : null),
		};
	}

	function setAppearance(next, options = {}) {
		appearance = normalize({ ...appearance, ...next });
		const color = document.getElementById('category-icon-color');
		const colorText = document.getElementById('category-icon-color-text');
		if (color instanceof HTMLInputElement) color.value = appearance.color;
		if (colorText instanceof HTMLInputElement) colorText.value = appearance.color;
		renderSelectedPreview();
		renderIconGrid();
		if (!options.keepPanel) closePicker();
	}

	function resetAppearance() {
		appearance = { ...DEFAULT_APPEARANCE };
		setAppearance(appearance, { keepPanel: true });
	}

	function iconElement(value = appearance, className = '') {
		return window.SongCategoryIcons?.createIcon?.(value, { className }) || document.createTextNode('▱');
	}

	function renderSelectedPreview() {
		const preview = document.getElementById('category-icon-selected-preview');
		const label = document.getElementById('category-icon-selected-label');
		if (preview) preview.replaceChildren(iconElement(appearance, 'admin-category-picker-preview-icon'));
		if (!label) return;
		if (appearance.kind === 'preset') {
			const item = window.SongCategoryIcons?.byKey?.get?.(appearance.value);
			label.textContent = item?.label?.[language()] || appearance.value;
		} else if (appearance.kind === 'emoji') label.textContent = `${copy('이모지', '絵文字')} · ${appearance.value}`;
		else if (appearance.kind === 'image') label.textContent = copy('직접 업로드 아이콘', 'アップロード画像');
		else label.textContent = copy('아이콘 없음', 'アイコンなし');
	}

	function openPicker() {
		const panel = document.getElementById('category-icon-picker-panel');
		const button = document.getElementById('category-icon-picker-button');
		if (panel) panel.hidden = false;
		if (button) button.setAttribute('aria-expanded', 'true');
	}

	function closePicker() {
		const panel = document.getElementById('category-icon-picker-panel');
		const button = document.getElementById('category-icon-picker-button');
		if (panel) panel.hidden = true;
		if (button) button.setAttribute('aria-expanded', 'false');
	}

	function renderFilterButtons() {
		const wrap = document.getElementById('category-icon-filter-list');
		if (!wrap) return;
		wrap.replaceChildren();
		const groups = window.SongCategoryIcons?.groups || {};
		for (const key of ['all', 'it', 'work', 'daily', 'people', 'nature', 'country']) {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = `admin-category-icon-filter${activeFilter === key ? ' is-active' : ''}`;
			button.textContent = groups[key]?.[language()] || key;
			button.addEventListener('click', () => {
				activeFilter = key;
				renderFilterButtons();
				renderIconGrid();
			});
			wrap.appendChild(button);
		}
	}

	function renderIconGrid() {
		const grid = document.getElementById('category-icon-grid');
		if (!grid) return;
		grid.replaceChildren();
		const items = window.SongCategoryIcons?.items || [];
		for (const item of items) {
			if (activeFilter !== 'all' && item.group !== activeFilter) continue;
			const button = document.createElement('button');
			button.type = 'button';
			button.className = `admin-category-icon-option${appearance.kind === 'preset' && appearance.value === item.key ? ' is-selected' : ''}`;
			button.title = item.label?.[language()] || item.key;
			button.setAttribute('aria-label', button.title);
			button.appendChild(iconElement({ kind: 'preset', value: item.key, color: appearance.color }));
			const caption = document.createElement('small');
			caption.textContent = item.label?.[language()] || item.key;
			button.appendChild(caption);
			button.addEventListener('click', () => setAppearance({ kind: 'preset', value: item.key }, { keepPanel: true }));
			grid.appendChild(button);
		}
	}

	function renderColorPalette() {
		const wrap = document.getElementById('category-icon-color-palette');
		if (!wrap) return;
		wrap.replaceChildren();
		for (const color of COLOR_PRESETS) {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'admin-category-color-swatch';
			button.style.backgroundColor = color;
			button.title = color;
			button.setAttribute('aria-label', color);
			button.addEventListener('click', () => setAppearance({ color }, { keepPanel: true }));
			wrap.appendChild(button);
		}
	}

	async function uploadIcon(file) {
		if (uploading || !(file instanceof File)) return;
		uploading = true;
		const status = document.getElementById('category-icon-upload-status');
		if (status) status.textContent = copy('업로드 중…', 'アップロード中…');
		try {
			const form = new FormData();
			form.set('file', file);
			const response = await nativeFetch('/api/admin/categories/icon', {
				method: 'POST', credentials: 'same-origin', body: form,
			});
			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok || !result.key) throw new Error(result?.error || 'ICON_UPLOAD_FAILED');
			setAppearance({ kind: 'image', value: result.key, imageUrl: result.url }, { keepPanel: true });
			if (status) status.textContent = copy('업로드 완료', 'アップロード完了');
		} catch (error) {
			console.error('Category icon upload failed', error);
			if (status) status.textContent = copy('업로드에 실패했습니다. PNG/JPG/WebP, 400KB 이하를 사용해 주세요.', 'アップロードに失敗しました。PNG/JPG/WebP、400KB以下をご利用ください。');
		} finally {
			uploading = false;
		}
	}

	function buildPickerUi() {
		const form = document.getElementById('category-form');
		const status = document.getElementById('category-form-status');
		if (!form || document.getElementById('category-icon-field')) return;

		const field = document.createElement('div');
		field.id = 'category-icon-field';
		field.className = 'admin-category-field admin-category-icon-field';
		field.innerHTML = `
			<label>${copy('카테고리 아이콘 · 색상', 'カテゴリーアイコン・色')}</label>
			<div class="admin-category-icon-selected-row">
				<button id="category-icon-picker-button" class="admin-category-icon-picker-button" type="button" aria-expanded="false">
					<span id="category-icon-selected-preview"></span>
					<span id="category-icon-selected-label"></span>
					<span aria-hidden="true">⌄</span>
				</button>
				<div class="admin-category-color-control">
					<input id="category-icon-color" type="color" value="#5b6ee1" aria-label="${copy('아이콘 색상', 'アイコン色')}" />
					<input id="category-icon-color-text" type="text" value="#5b6ee1" maxlength="7" spellcheck="false" aria-label="${copy('아이콘 색상 코드', 'アイコン色コード')}" />
				</div>
			</div>
			<div id="category-icon-color-palette" class="admin-category-color-palette"></div>
			<section id="category-icon-picker-panel" class="admin-category-icon-picker-panel" hidden>
				<div class="admin-category-icon-picker-head">
					<strong>${copy('아이콘 선택', 'アイコンを選択')}</strong>
					<button id="category-icon-picker-close" type="button">×</button>
				</div>
				<div id="category-icon-filter-list" class="admin-category-icon-filters"></div>
				<div id="category-icon-grid" class="admin-category-icon-grid"></div>
				<div class="admin-category-custom-icon-area">
					<div>
						<strong>${copy('이모지 직접 입력', '絵文字を直接入力')}</strong>
						<div class="admin-category-inline-control"><input id="category-icon-emoji" type="text" maxlength="24" placeholder="💻" /><button id="category-icon-emoji-apply" type="button">${copy('적용', '適用')}</button></div>
					</div>
					<div>
						<strong>${copy('이미지 직접 업로드', '画像をアップロード')}</strong>
						<input id="category-icon-upload" type="file" accept="image/png,image/jpeg,image/webp" />
						<small id="category-icon-upload-status">PNG/JPG/WebP · max 400KB</small>
					</div>
					<button id="category-icon-none" class="admin-category-icon-none" type="button">${copy('아이콘 사용 안 함', 'アイコンを使用しない')}</button>
				</div>
			</section>`;
		form.insertBefore(field, status || form.querySelector('.admin-category-form-actions'));

		document.getElementById('category-icon-picker-button')?.addEventListener('click', () => {
			const panel = document.getElementById('category-icon-picker-panel');
			if (panel?.hidden) openPicker(); else closePicker();
		});
		document.getElementById('category-icon-picker-close')?.addEventListener('click', closePicker);
		document.getElementById('category-icon-color')?.addEventListener('input', (event) => {
			setAppearance({ color: event.target.value }, { keepPanel: true });
		});
		document.getElementById('category-icon-color-text')?.addEventListener('change', (event) => {
			const value = String(event.target.value || '').trim();
			if (/^#[0-9a-f]{6}$/i.test(value)) setAppearance({ color: value }, { keepPanel: true });
			else event.target.value = appearance.color;
		});
		document.getElementById('category-icon-emoji-apply')?.addEventListener('click', () => {
			const input = document.getElementById('category-icon-emoji');
			const value = input?.value?.trim();
			if (value) setAppearance({ kind: 'emoji', value }, { keepPanel: true });
		});
		document.getElementById('category-icon-upload')?.addEventListener('change', (event) => {
			const file = event.target.files?.[0];
			if (file) uploadIcon(file);
		});
		document.getElementById('category-icon-none')?.addEventListener('click', () => setAppearance({ kind: 'none', value: '' }, { keepPanel: true }));
		renderFilterButtons();
		renderColorPalette();
		setAppearance(DEFAULT_APPEARANCE, { keepPanel: true });
	}

	function decorateCategoryRows() {
		const tbody = document.getElementById('category-table-body');
		if (!tbody) return;
		for (const row of tbody.querySelectorAll('tr[data-category-id]')) {
			const id = Number(row.dataset.categoryId);
			const category = categoryCache.get(id);
			const tree = row.querySelector('.admin-category-tree-name');
			if (!category || !tree) continue;
			tree.querySelector('.admin-category-row-icon')?.remove();
			const icon = iconElement(category.appearance || DEFAULT_APPEARANCE, 'admin-category-row-icon');
			tree.insertBefore(icon, tree.firstChild);
		}
	}

	function captureEditState(event) {
		const button = event.target.closest?.('.admin-category-action:not(.admin-category-action-danger)');
		if (!button) return;
		const row = button.closest('tr[data-category-id]');
		const category = categoryCache.get(Number(row?.dataset.categoryId));
		if (category?.appearance) setAppearance(category.appearance, { keepPanel: true });
	}

	function previewCursorTheme(theme) {
		const wrap = document.createElement('span');
		wrap.className = 'admin-cursor-theme-preview';
		const arrow = document.createElement('img');
		arrow.src = `/assets/cursors/arrow-${theme}.svg`;
		arrow.alt = '';
		const click = document.createElement('img');
		click.src = `/assets/cursors/click-${theme}.svg`;
		click.alt = '';
		wrap.append(arrow, click);
		return wrap;
	}

	function syncCursorUi() {
		const enabled = document.getElementById('site-cursor-enabled');
		if (enabled instanceof HTMLInputElement) enabled.checked = cursorSettings.enabled;
		document.querySelectorAll('[data-cursor-theme]').forEach((button) => {
			button.classList.toggle('is-selected', button.dataset.cursorTheme === cursorSettings.theme);
		});
	}

	async function loadCursorSettings() {
		try {
			const response = await nativeFetch('/api/admin/site-visuals', { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
			if (response.status === 401) return;
			const result = await response.json().catch(() => null);
			if (response.ok && result?.cursor) {
				cursorSettings = { enabled: result.cursor.enabled === true, theme: ['blue', 'navy', 'mint'].includes(result.cursor.theme) ? result.cursor.theme : 'blue' };
				syncCursorUi();
			}
		} catch (error) {
			console.warn('Failed to load cursor settings', error);
		}
	}

	async function saveCursorSettings() {
		const button = document.getElementById('site-cursor-save');
		const status = document.getElementById('site-cursor-status');
		if (button) button.disabled = true;
		try {
			const response = await nativeFetch('/api/admin/site-visuals', {
				method: 'PATCH', credentials: 'same-origin', cache: 'no-store',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ cursorEnabled: cursorSettings.enabled, cursorTheme: cursorSettings.theme }),
			});
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error || 'SITE_VISUALS_UPDATE_FAILED');
			if (status) status.textContent = copy('커서 설정을 저장했습니다.', 'カーソル設定を保存しました。');
		} catch (error) {
			console.error('Failed to save cursor settings', error);
			if (status) status.textContent = copy('커서 설정 저장에 실패했습니다.', 'カーソル設定の保存に失敗しました。');
		} finally {
			if (button) button.disabled = false;
		}
	}

	function buildCursorUi() {
		const layout = document.querySelector('.admin-category-layout');
		if (!layout || document.getElementById('site-cursor-card')) return;
		const card = document.createElement('section');
		card.id = 'site-cursor-card';
		card.className = 'admin-category-card admin-site-cursor-card';
		const header = document.createElement('div');
		header.className = 'admin-category-card-header';
		header.innerHTML = `<div><h2>${copy('사이트 마우스 커서', 'サイトのマウスカーソル')}</h2><p>${copy('PC에서만 적용됩니다. 기본 화살표와 클릭/선택 커서를 함께 변경합니다.', 'PCでのみ適用されます。通常カーソルとクリック用カーソルをまとめて変更します。')}</p></div>`;
		const body = document.createElement('div');
		body.className = 'admin-site-cursor-body';
		body.innerHTML = `<label class="admin-site-cursor-toggle"><input id="site-cursor-enabled" type="checkbox" /><span>${copy('커스텀 커서 사용', 'カスタムカーソルを使用')}</span></label>`;
		const themes = document.createElement('div');
		themes.className = 'admin-cursor-theme-grid';
		for (const [theme, ko, ja] of [['blue', '소프트 블루', 'ソフトブルー'], ['navy', '네이비', 'ネイビー'], ['mint', '민트', 'ミント']]) {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'admin-cursor-theme-option';
			button.dataset.cursorTheme = theme;
			button.append(previewCursorTheme(theme), document.createTextNode(copy(ko, ja)));
			button.addEventListener('click', () => {
				cursorSettings.theme = theme;
				syncCursorUi();
			});
			themes.appendChild(button);
		}
		const footer = document.createElement('div');
		footer.className = 'admin-site-cursor-actions';
		const status = document.createElement('small');
		status.id = 'site-cursor-status';
		const save = document.createElement('button');
		save.id = 'site-cursor-save';
		save.type = 'button';
		save.className = 'admin-category-button admin-category-button-primary';
		save.textContent = copy('커서 설정 저장', 'カーソル設定を保存');
		save.addEventListener('click', saveCursorSettings);
		footer.append(status, save);
		body.append(themes, footer);
		card.append(header, body);
		layout.appendChild(card);
		document.getElementById('site-cursor-enabled')?.addEventListener('change', (event) => {
			cursorSettings.enabled = event.target.checked;
		});
		loadCursorSettings();
	}

	function refreshLanguage() {
		const current = { ...appearance };
		document.getElementById('category-icon-field')?.remove();
		document.getElementById('site-cursor-card')?.remove();
		buildPickerUi();
		setAppearance(current, { keepPanel: true });
		buildCursorUi();
		decorateCategoryRows();
	}

	function initialize() {
		if (!document.getElementById('category-form')) return;
		buildPickerUi();
		buildCursorUi();
		document.getElementById('category-form')?.addEventListener('reset', () => queueMicrotask(resetAppearance));
		document.getElementById('category-new-button')?.addEventListener('click', resetAppearance, true);
		document.getElementById('category-cancel-button')?.addEventListener('click', resetAppearance, true);
		document.getElementById('category-table-body')?.addEventListener('click', captureEditState, true);
		new MutationObserver(decorateCategoryRows).observe(document.getElementById('category-table-body'), { childList: true, subtree: true });
		document.addEventListener('adminlanguagechange', refreshLanguage);
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();