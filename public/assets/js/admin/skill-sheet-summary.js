(() => {
	let state = null;
	let catalog = [];
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
			selectedSkillIds: [],
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

	function catalogById(id) {
		return catalog.find((item) => Number(item.id) === Number(id)) ?? null;
	}

	function normalizeSections(sections) {
		return (Array.isArray(sections) ? sections : []).map((section) => ({
			...section,
			selectedSkillIds: Array.isArray(section.selectedSkillIds)
				? section.selectedSkillIds.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0)
				: [],
		}));
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
				selectedSkillIds: [...(existing.selectedSkillIds ?? [])],
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

	function removeSkill(sectionIndex, skillId) {
		captureState();
		const section = state?.sections?.[sectionIndex];
		if (!section) return;
		section.selectedSkillIds = (section.selectedSkillIds ?? []).filter((id) => Number(id) !== Number(skillId));
		render();
	}

	function renderSelectedSkills(section, index) {
		const wrap = document.createElement('div');
		wrap.className = 'admin-skill-selection';
		const head = document.createElement('div');
		head.className = 'admin-skill-selection-head';
		const copy = document.createElement('div');
		const strong = document.createElement('strong');
		strong.textContent = text('選択済みスキル', '선택된 스킬');
		const small = document.createElement('small');
		small.textContent = text('IT Skill Catalogから選択した項目だけが公開ページに表示されます。', 'IT Skill Catalog에서 선택한 항목만 공개 페이지에 표시됩니다.');
		copy.append(strong, small);
		const choose = button(text('カタログから選択', '카탈로그에서 선택'));
		choose.addEventListener('click', () => openCatalogPicker(index));
		head.append(copy, choose);

		const list = document.createElement('div');
		list.className = 'admin-skill-selected-list';
		const selected = (section.selectedSkillIds ?? []).map(catalogById).filter(Boolean);
		if (!selected.length) {
			const empty = document.createElement('span');
			empty.className = 'admin-skill-selected-empty';
			empty.textContent = text('まだスキルを選択していません。', '아직 선택한 스킬이 없습니다.');
			list.appendChild(empty);
		} else {
			for (const skill of selected) {
				const chip = document.createElement('span');
				chip.className = 'admin-skill-selected-chip';
				const label = document.createElement('span'); label.textContent = skill.name;
				const remove = document.createElement('button');
				remove.type = 'button'; remove.textContent = '×'; remove.title = text('選択解除', '선택 해제');
				remove.addEventListener('click', () => removeSkill(index, skill.id));
				chip.append(label, remove); list.appendChild(chip);
			}
		}
		wrap.append(head, list);
		return wrap;
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

		const visibleLabel = document.createElement('label');
		visibleLabel.className = 'admin-skill-summary-visible is-wide';
		const visible = document.createElement('input');
		visible.type = 'checkbox'; visible.checked = section.isVisible !== false; visible.dataset.field = 'visible';
		visibleLabel.append(visible, document.createTextNode(text('公開ページに表示', '공개 페이지에 표시')));

		grid.append(
			field('Title (JA)', titleJa), field('Title (KO)', titleKo),
			field(text('説明 (JA)', '설명 (JA)'), descriptionJa), field(text('説明 (KO)', '설명 (KO)'), descriptionKo),
			renderSelectedSkills(section, index), visibleLabel,
		);
		root.append(top, grid);
		return root;
	}

	function uniqueSorted(values) {
		return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
	}

	function openCatalogPicker(sectionIndex) {
		captureState();
		const section = state?.sections?.[sectionIndex];
		if (!section) return;
		const working = new Set((section.selectedSkillIds ?? []).map(Number));

		const backdrop = document.createElement('div');
		backdrop.className = 'admin-skill-catalog-backdrop';
		const dialog = document.createElement('section');
		dialog.className = 'admin-skill-catalog-dialog';
		dialog.setAttribute('role', 'dialog');
		dialog.setAttribute('aria-modal', 'true');

		const header = document.createElement('div');
		header.className = 'admin-skill-catalog-header';
		const heading = document.createElement('div');
		const title = document.createElement('strong');
		title.textContent = 'IT Skill Catalog';
		const subtitle = document.createElement('small');
		subtitle.textContent = text(`${catalog.length}件のITスキルから検索・選択できます。`, `IT 스킬 ${catalog.length}개에서 검색·선택할 수 있습니다.`);
		heading.append(title, subtitle);
		const close = document.createElement('button');
		close.type = 'button'; close.className = 'admin-skill-catalog-close'; close.textContent = '×';
		header.append(heading, close);

		const filters = document.createElement('div');
		filters.className = 'admin-skill-catalog-filters';
		const search = document.createElement('input');
		search.type = 'search'; search.placeholder = text('スキル名・用途・別名を検索', '스킬명·용도·별칭 검색');
		const category = document.createElement('select');
		const type = document.createElement('select');
		const makeOptions = (select, first, values) => {
			const all = document.createElement('option'); all.value = ''; all.textContent = first; select.appendChild(all);
			for (const value of values) { const option = document.createElement('option'); option.value = value; option.textContent = value; select.appendChild(option); }
		};
		makeOptions(category, text('すべての分野', '전체 분야'), uniqueSorted(catalog.map((item) => item.category)));
		makeOptions(type, text('すべてのタイプ', '전체 유형'), uniqueSorted(catalog.map((item) => item.type)));
		filters.append(search, category, type);

		const list = document.createElement('div');
		list.className = 'admin-skill-catalog-list';
		const footer = document.createElement('div'); footer.className = 'admin-skill-catalog-footer';
		const count = document.createElement('span'); count.className = 'admin-skill-catalog-count';
		const actions = document.createElement('div'); actions.className = 'admin-skill-catalog-actions';
		const cancel = button(text('キャンセル', '취소'));
		const apply = button(text('選択を反映', '선택 반영'), 'admin-record-danger');
		actions.append(cancel, apply); footer.append(count, actions);

		function matches(item) {
			const q = search.value.trim().toLocaleLowerCase();
			if (category.value && item.category !== category.value) return false;
			if (type.value && item.type !== type.value) return false;
			if (!q) return true;
			const haystack = [item.name, item.category, item.type, item.usageArea, item.aliases, item.descriptionJa, item.descriptionKo].join(' ').toLocaleLowerCase();
			return haystack.includes(q);
		}

		function updateCount() {
			count.textContent = text(`選択中 ${working.size}件 / 最大100件`, `선택 중 ${working.size}개 / 최대 100개`);
			apply.disabled = working.size > 100;
		}

		function renderList() {
			list.replaceChildren();
			const visible = catalog.filter(matches);
			if (!visible.length) {
				const empty = document.createElement('p'); empty.className = 'admin-skill-catalog-empty';
				empty.textContent = text('条件に一致するスキルがありません。', '조건에 맞는 스킬이 없습니다.');
				list.appendChild(empty); updateCount(); return;
			}
			for (const item of visible) {
				const row = document.createElement('label');
				row.className = `admin-skill-catalog-item${working.has(Number(item.id)) ? ' is-selected' : ''}`;
				const checkbox = document.createElement('input');
				checkbox.type = 'checkbox'; checkbox.checked = working.has(Number(item.id));
				checkbox.addEventListener('change', () => {
					if (checkbox.checked) working.add(Number(item.id)); else working.delete(Number(item.id));
					row.classList.toggle('is-selected', checkbox.checked); updateCount();
				});
				const name = document.createElement('div'); name.className = 'admin-skill-catalog-name';
				const strong = document.createElement('strong'); strong.textContent = item.name;
				const aliases = document.createElement('small'); aliases.textContent = item.aliases || '—';
				name.append(strong, aliases);
				const meta = document.createElement('div'); meta.className = 'admin-skill-catalog-meta';
				for (const value of [item.category, item.type]) { const badge = document.createElement('span'); badge.className = 'admin-skill-catalog-badge'; badge.textContent = value; meta.appendChild(badge); }
				const usage = document.createElement('div'); usage.className = 'admin-skill-catalog-usage'; usage.textContent = item.usageArea || '—';
				const description = document.createElement('div'); description.className = 'admin-skill-catalog-description'; description.textContent = language() === 'ko' ? item.descriptionKo : item.descriptionJa;
				row.append(checkbox, name, meta, usage, description); list.appendChild(row);
			}
			updateCount();
		}

		function finish(applySelection) {
			if (applySelection && working.size <= 100) {
				section.selectedSkillIds = catalog.filter((item) => working.has(Number(item.id))).map((item) => Number(item.id));
			}
			backdrop.remove(); document.body.classList.remove('admin-modal-open'); document.removeEventListener('keydown', onKeydown);
			if (applySelection) render();
		}
		function onKeydown(event) { if (event.key === 'Escape') finish(false); }
		search.addEventListener('input', renderList); category.addEventListener('change', renderList); type.addEventListener('change', renderList);
		close.addEventListener('click', () => finish(false)); cancel.addEventListener('click', () => finish(false)); apply.addEventListener('click', () => finish(true));
		backdrop.addEventListener('click', (event) => { if (event.target === backdrop) finish(false); });
		document.addEventListener('keydown', onKeydown);
		dialog.append(header, filters, list, footer); backdrop.appendChild(dialog); document.body.appendChild(backdrop); document.body.classList.add('admin-modal-open');
		renderList(); requestAnimationFrame(() => search.focus());
	}

	function render() {
		createEditorShell();
		if (!state) return;
		byId('skill-summary-editor-title').textContent = text('スキルシート Web表示内容', '스킬시트 웹 표시 내용');
		byId('skill-summary-editor-hint').textContent = text('Excel原本とは独立して編集。スキルはDBのIT Skill Catalogから選択します。', 'Excel 원본과 독립적으로 수정하며 스킬은 DB의 IT Skill Catalog에서 선택합니다.');
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
			field(text('見出し (JA)', '제목 (JA)'), headingJa), field(text('見出し (KO)', '제목 (KO)'), headingKo),
			field(text('紹介文 (JA)', '소개문 (JA)'), descriptionJa), field(text('紹介文 (KO)', '소개문 (KO)'), descriptionKo),
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
			if (!response.ok || !result?.ok || !result.summary || !Array.isArray(result.catalog)) throw new Error(result?.error || 'LOAD_FAILED');
			catalog = result.catalog;
			state = { ...result.summary, sections: normalizeSections(result.summary.sections) };
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
			setMessage(text('見出しと紹介文を入力してください。', '제목과 소개문을 입력해 주세요.'), true); return;
		}
		if (state.sections.some((section) => !section.titleJa.trim() || !section.titleKo.trim())) {
			setMessage(text('各セクションのJA/KOタイトルを入力してください。', '각 섹션의 JA/KO 제목을 입력해 주세요.'), true); return;
		}
		saving = true; render(); setMessage('');
		try {
			const response = await fetch('/api/admin/skill-sheet', {
				method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state),
			});
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error || 'SAVE_FAILED');
			state.updatedAt = result.updatedAt;
			setMessage(text('保存しました。公開スキルシートにも反映されます。', '저장했습니다. 공개 스킬시트에도 반영됩니다.'));
		} catch (error) {
			console.error('Failed to save skill sheet summary', error);
			setMessage(text('保存に失敗しました。', '저장에 실패했습니다.'), true);
		} finally { saving = false; render(); }
	}

	async function initialize() {
		await Promise.all([window.AdminCommon?.ready, window.AdminI18n?.ready]);
		createEditorShell(); await load();
		document.addEventListener('adminlanguagechange', () => { captureState(); render(); });
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
