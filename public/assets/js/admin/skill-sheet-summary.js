(() => {
	let state = null;
	let saving = false;

	function language() { return window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja'; }
	function text(ja, ko) { return language() === 'ko' ? ko : ja; }
	function byId(id) { return document.getElementById(id); }

	function makeKey() {
		return `section-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
	}

	function emptySection() {
		return {
			sectionKey: makeKey(),
			titleJa: '',
			titleKo: '',
			descriptionJa: '',
			descriptionKo: '',
			skills: [],
			isVisible: true,
		};
	}

	function field(labelText, control) {
		const label = document.createElement('label');
		label.className = 'admin-record-field';
		const span = document.createElement('span');
		span.textContent = labelText;
		label.append(span, control);
		return label;
	}

	function input(value = '') {
		const node = document.createElement('input');
		node.type = 'text';
		node.value = value;
		node.maxLength = 120;
		return node;
	}

	function textarea(value = '', maxLength = 1200) {
		const node = document.createElement('textarea');
		node.value = value;
		node.maxLength = maxLength;
		node.rows = 3;
		return node;
	}

	function button(label, className = 'admin-record-secondary') {
		const node = document.createElement('button');
		node.type = 'button';
		node.className = className;
		node.textContent = label;
		return node;
	}

	function createEditorShell() {
		if (byId('skill-sheet-summary-editor')) return;
		const grid = document.querySelector('.admin-record-grid');
		if (!grid) return;

		const card = document.createElement('section');
		card.id = 'skill-sheet-summary-editor';
		card.className = 'admin-record-card admin-skill-summary-card';
		card.innerHTML = `
			<div class="admin-record-card-heading">
				<div><h2 id="skill-summary-editor-title"></h2><span id="skill-summary-editor-hint"></span></div>
				<span id="skill-summary-updated"></span>
			</div>
			<div id="skill-summary-intro" class="admin-skill-summary-intro"></div>
			<div class="admin-skill-summary-section-heading"><h3 id="skill-summary-sections-title"></h3><button id="skill-summary-add" class="admin-record-secondary" type="button"></button></div>
			<div id="skill-summary-sections" class="admin-skill-summary-sections"></div>
			<div class="admin-skill-summary-footer"><span id="skill-summary-message" class="admin-skill-summary-message"></span><button id="skill-summary-save" class="admin-record-danger" type="button"></button></div>
		`;
		grid.insertAdjacentElement('afterend', card);
		byId('skill-summary-add')?.addEventListener('click', () => {
			captureState();
			state.sections.push(emptySection());
			render();
		});
		byId('skill-summary-save')?.addEventListener('click', save);
	}

	function captureState() {
		if (!state) return;
		const headingJa = byId('skill-summary-heading-ja');
		const headingKo = byId('skill-summary-heading-ko');
		const descriptionJa = byId('skill-summary-description-ja');
		const descriptionKo = byId('skill-summary-description-ko');
		if (headingJa instanceof HTMLInputElement) state.headingJa = headingJa.value;
		if (headingKo instanceof HTMLInputElement) state.headingKo = headingKo.value;
		if (descriptionJa instanceof HTMLTextAreaElement) state.descriptionJa = descriptionJa.value;
		if (descriptionKo instanceof HTMLTextAreaElement) state.descriptionKo = descriptionKo.value;
		const sections = [];
		document.querySelectorAll('[data-skill-summary-section]').forEach((node) => {
			if (!(node instanceof HTMLElement)) return;
			const key = node.dataset.skillSummarySection;
			const existing = state.sections.find((item) => item.sectionKey === key);
			if (!existing) return;
			const read = (selector) => node.querySelector(selector)?.value ?? '';
			sections.push({
				sectionKey: key,
				titleJa: read('[data-field="titleJa"]'),
				titleKo: read('[data-field="titleKo"]'),
				descriptionJa: read('[data-field="descriptionJa"]'),
				descriptionKo: read('[data-field="descriptionKo"]'),
				skills: read('[data-field="skills"]').split(/[\n,|]+/).map((item) => item.trim()).filter(Boolean),
				isVisible: node.querySelector('[data-field="visible"]')?.checked !== false,
			});
		});
		state.sections = sections;
	}

	function moveSection(index, delta) {
		captureState();
		const target = index + delta;
		if (!state || target < 0 || target >= state.sections.length) return;
		[state.sections[index], state.sections[target]] = [state.sections[target], state.sections[index]];
		render();
	}

	async function removeSection(index) {
		captureState();
		if (!state) return;
		const confirmed = window.AdminCommon?.confirm
			? await window.AdminCommon.confirm({
				titleFallback: text('セクションを削除', '섹션 삭제'),
				messageFallback: text('このセクションを削除しますか？', '이 섹션을 삭제할까요?'),
				confirmFallback: text('削除', '삭제'),
				cancelFallback: text('キャンセル', '취소'),
			})
			: window.confirm(text('このセクションを削除しますか？', '이 섹션을 삭제할까요?'));
		if (!confirmed) return;
		state.sections.splice(index, 1);
		render();
	}

	function renderSection(section, index) {
		const root = document.createElement('article');
		root.className = 'admin-skill-summary-section';
		root.dataset.skillSummarySection = section.sectionKey;

		const top = document.createElement('div');
		top.className = 'admin-skill-summary-section-top';
		const title = document.createElement('strong');
		title.textContent = `${text('セクション', '섹션')} ${index + 1}`;
		const actions = document.createElement('div');
		actions.className = 'admin-skill-summary-section-actions';
		const up = button('↑'); up.disabled = index === 0; up.addEventListener('click', () => moveSection(index, -1));
		const down = button('↓'); down.disabled = index === state.sections.length - 1; down.addEventListener('click', () => moveSection(index, 1));
		const remove = button(text('削除', '삭제'), 'admin-record-danger'); remove.addEventListener('click', () => removeSection(index));
		actions.append(up, down, remove);
		top.append(title, actions);

		const grid = document.createElement('div');
		grid.className = 'admin-skill-summary-section-grid';
		const titleJa = input(section.titleJa); titleJa.dataset.field = 'titleJa';
		const titleKo = input(section.titleKo); titleKo.dataset.field = 'titleKo';
		const descriptionJa = textarea(section.descriptionJa, 1000); descriptionJa.dataset.field = 'descriptionJa';
		const descriptionKo = textarea(section.descriptionKo, 1000); descriptionKo.dataset.field = 'descriptionKo';
		const skills = textarea((section.skills ?? []).join('\n'), 4800); skills.dataset.field = 'skills';
		const skillsField = field(text('スキル（1行1件・カンマ区切り可）', '스킬 (한 줄에 하나·쉼표 구분 가능)'), skills);
		skillsField.classList.add('is-wide');

		const visibleLabel = document.createElement('label');
		visibleLabel.className = 'admin-skill-summary-visible is-wide';
		const visible = document.createElement('input');
		visible.type = 'checkbox'; visible.checked = section.isVisible !== false; visible.dataset.field = 'visible';
		visibleLabel.append(visible, document.createTextNode(text('公開ページに表示', '공개 페이지에 표시')));

		grid.append(
			field('Title (JA)', titleJa), field('Title (KO)', titleKo),
			field(text('説明 (JA)', '설명 (JA)'), descriptionJa), field(text('説明 (KO)', '설명 (KO)'), descriptionKo),
			skillsField, visibleLabel,
		);
		root.append(top, grid);
		return root;
	}

	function render() {
		createEditorShell();
		if (!state) return;
		byId('skill-summary-editor-title').textContent = text('スキルシート Web表示内容', '스킬시트 웹 표시 내용');
		byId('skill-summary-editor-hint').textContent = text('Excel原本とは独立して編集できます', 'Excel 원본과 독립적으로 수정할 수 있습니다');
		byId('skill-summary-sections-title').textContent = text('表示セクション', '표시 섹션');
		byId('skill-summary-add').textContent = text('+ セクション追加', '+ 섹션 추가');
		byId('skill-summary-save').textContent = saving ? text('保存中…', '저장 중…') : text('変更を保存', '변경사항 저장');
		byId('skill-summary-save').disabled = saving;
		byId('skill-summary-updated').textContent = state.updatedAt ? `${text('更新', '갱신')} ${new Date(state.updatedAt).toLocaleString(language() === 'ko' ? 'ko-KR' : 'ja-JP')}` : '';

		const intro = byId('skill-summary-intro');
		intro.replaceChildren();
		const headingJa = input(state.headingJa); headingJa.id = 'skill-summary-heading-ja';
		const headingKo = input(state.headingKo); headingKo.id = 'skill-summary-heading-ko';
		const descriptionJa = textarea(state.descriptionJa); descriptionJa.id = 'skill-summary-description-ja';
		const descriptionKo = textarea(state.descriptionKo); descriptionKo.id = 'skill-summary-description-ko';
		intro.append(
			field(text('見出し (JA)', '제목 (JA)'), headingJa),
			field(text('見出し (KO)', '제목 (KO)'), headingKo),
			field(text('紹介文 (JA)', '소개문 (JA)'), descriptionJa),
			field(text('紹介文 (KO)', '소개문 (KO)'), descriptionKo),
		);

		const sections = byId('skill-summary-sections');
		sections.replaceChildren(...state.sections.map(renderSection));
	}

	function setMessage(message, error = false) {
		const node = byId('skill-summary-message');
		if (!node) return;
		node.textContent = message;
		node.classList.toggle('is-error', error);
	}

	async function load() {
		createEditorShell();
		try {
			const response = await fetch('/api/admin/skill-sheet', { credentials: 'same-origin', cache: 'no-store' });
			if (response.status === 401) { window.location.replace('/admin/login/'); return; }
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok || !result.summary) throw new Error(result?.error || 'LOAD_FAILED');
			state = result.summary;
			render();
		} catch (error) {
			console.error('Failed to load skill sheet summary editor', error);
			setMessage(text('Web表示内容を読み込めませんでした。DB migrationを確認してください。', '웹 표시 내용을 불러오지 못했습니다. DB migration을 확인해 주세요.'), true);
		}
	}

	async function save() {
		if (!state || saving) return;
		captureState();
		if (!state.headingJa.trim() || !state.headingKo.trim() || !state.descriptionJa.trim() || !state.descriptionKo.trim()) {
			setMessage(text('見出しと紹介文を入力してください。', '제목과 소개문을 입력해 주세요.'), true);
			return;
		}
		if (state.sections.some((section) => !section.titleJa.trim() || !section.titleKo.trim())) {
			setMessage(text('各セクションのJA/KOタイトルを入力してください。', '각 섹션의 JA/KO 제목을 입력해 주세요.'), true);
			return;
		}
		saving = true;
		render();
		setMessage('');
		try {
			const response = await fetch('/api/admin/skill-sheet', {
				method: 'PATCH',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(state),
			});
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error || 'SAVE_FAILED');
			state.updatedAt = result.updatedAt;
			setMessage(text('保存しました。公開スキルシートにも反映されます。', '저장했습니다. 공개 스킬시트에도 반영됩니다.'));
		} catch (error) {
			console.error('Failed to save skill sheet summary', error);
			setMessage(text('保存に失敗しました。', '저장에 실패했습니다.'), true);
		} finally {
			saving = false;
			render();
		}
	}

	async function initialize() {
		await Promise.all([window.AdminCommon?.ready, window.AdminI18n?.ready]);
		createEditorShell();
		await load();
		document.addEventListener('adminlanguagechange', () => {
			captureState();
			render();
		});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
