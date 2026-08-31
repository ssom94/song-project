(() => {
	const API = '/api/admin/certifications';
	const root = document.getElementById('cert-admin-root');
	let certifications = [];
	let selectedId = null;
	let saving = false;

	function language() {
		return window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja';
	}

	function copy() {
		return language() === 'ko' ? {
			title: '자격증·시험 관리', description: '공개 자격증 페이지의 기본 정보, 시험 일정, 출제 범위·학습 정보를 직접 수정합니다.', public: '공개 페이지 보기',
			basic: '기본 정보', schedule: '시험 일정', topics: '출제 범위·학습 정보', addSchedule: '+ 일정 추가', addTopic: '+ 항목 추가', save: '저장', saving: '저장 중...', saved: '저장되었습니다.', failed: '저장에 실패했습니다.', loadFailed: '자격증 정보를 불러오지 못했습니다.', remove: '삭제', active: '공개', announced: '공식 발표',
			noSelection: '왼쪽에서 수정할 자격증을 선택하세요.', scheduleItem: '일정', topicItem: '항목',
		} : {
			title: '資格・試験管理', description: '公開資格ページの基本情報、試験日程、出題範囲・学習情報を直接編集します。', public: '公開ページを見る',
			basic: '基本情報', schedule: '試験日程', topics: '出題範囲・学習情報', addSchedule: '+ 日程追加', addTopic: '+ 項目追加', save: '保存', saving: '保存中...', saved: '保存しました。', failed: '保存に失敗しました。', loadFailed: '資格情報を読み込めませんでした。', remove: '削除', active: '公開', announced: '公式発表',
			noSelection: '左側から編集する資格を選択してください。', scheduleItem: '日程', topicItem: '項目',
		};
	}

	async function requestJson(url, options = {}) {
		const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
		const data = await response.json().catch(() => null);
		if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP_${response.status}`);
		return data;
	}

	function element(tag, className = '', text = '') {
		const node = document.createElement(tag);
		if (className) node.className = className;
		if (text) node.textContent = text;
		return node;
	}

	function inputFor(field, value, kind = 'text') {
		let input;
		if (kind === 'textarea') {
			input = document.createElement('textarea');
			input.value = value ?? '';
		} else if (kind === 'select') {
			input = document.createElement('select');
		} else {
			input = document.createElement('input');
			input.type = kind;
			if (kind === 'checkbox') input.checked = value !== false;
			else input.value = value ?? '';
		}
		input.dataset.field = field;
		return input;
	}

	function field(labelText, fieldName, value, kind = 'text', wide = false, options = []) {
		const label = element('label', `admin-cert-field${wide ? ' is-wide' : ''}`);
		label.appendChild(element('span', '', labelText));
		const input = inputFor(fieldName, value, kind);
		if (kind === 'select') {
			for (const [valueKey, text] of options) {
				const option = document.createElement('option');
				option.value = valueKey;
				option.textContent = text;
				input.appendChild(option);
			}
			input.value = value ?? options[0]?.[0] ?? '';
		}
		label.appendChild(input);
		return label;
	}

	function checkField(labelText, fieldName, checked) {
		const label = element('label', 'admin-cert-check');
		const input = inputFor(fieldName, checked, 'checkbox');
		label.append(input, document.createTextNode(labelText));
		return label;
	}

	function mainFields(cert) {
		const grid = element('div', 'admin-cert-grid');
		const specs = [
			['Slug', 'slug', cert.slug], ['Code', 'code', cert.code], ['Category', 'category', cert.category], ['Accent', 'accentKey', cert.accentKey],
			['日本語タイトル', 'titleJa', cert.titleJa], ['한국어 제목', 'titleKo', cert.titleKo],
			['日本語サブタイトル', 'subtitleJa', cert.subtitleJa], ['한국어 부제', 'subtitleKo', cert.subtitleKo],
			['提供元 日本語', 'providerJa', cert.providerJa], ['제공기관 한국어', 'providerKo', cert.providerKo],
			['概要 日本語', 'summaryJa', cert.summaryJa, 'textarea', true], ['개요 한국어', 'summaryKo', cert.summaryKo, 'textarea', true],
			['試験方式 日本語', 'examModeJa', cert.examModeJa], ['시험 방식 한국어', 'examModeKo', cert.examModeKo],
			['受験料 日本語', 'feeJa', cert.feeJa], ['응시료 한국어', 'feeKo', cert.feeKo],
			['試験時間 日本語', 'durationJa', cert.durationJa], ['시험 시간 한국어', 'durationKo', cert.durationKo],
			['問題数 日本語', 'questionsJa', cert.questionsJa], ['문제 수 한국어', 'questionsKo', cert.questionsKo],
			['合格基準 日本語', 'passJa', cert.passJa], ['합격 기준 한국어', 'passKo', cert.passKo],
			['Official URL', 'officialUrl', cert.officialUrl, 'url', true], ['Guide URL', 'guideUrl', cert.guideUrl, 'url', true],
			['情報確認日', 'sourceCheckedAt', cert.sourceCheckedAt, 'date'], ['表示順', 'displayOrder', cert.displayOrder, 'number'],
		];
		for (const [label, key, value, kind = 'text', wide = false] of specs) grid.appendChild(field(label, key, value, kind, wide));
		grid.appendChild(checkField(copy().active, 'isActive', cert.isActive));
		return grid;
	}

	function scheduleCard(schedule, index) {
		const card = element('article', 'admin-cert-child');
		card.dataset.scheduleItem = 'true';
		const head = element('div', 'admin-cert-child-title');
		head.appendChild(element('span', '', `${copy().scheduleItem} ${index + 1}`));
		const remove = element('button', 'admin-cert-remove', copy().remove);
		remove.type = 'button';
		remove.addEventListener('click', () => { card.remove(); renumberChildren(); });
		head.appendChild(remove);
		card.appendChild(head);
		const grid = element('div', 'admin-cert-grid');
		const specs = [
			['順序', 'sequenceNo', schedule.sequenceNo ?? index + 1, 'number'],
			['ラベル 日本語', 'labelJa', schedule.labelJa], ['라벨 한국어', 'labelKo', schedule.labelKo],
			['申込 日本語', 'applicationJa', schedule.applicationJa, 'textarea'], ['접수 한국어', 'applicationKo', schedule.applicationKo, 'textarea'],
			['試験 日本語', 'examJa', schedule.examJa, 'textarea'], ['시험 한국어', 'examKo', schedule.examKo, 'textarea'],
			['結果 日本語', 'resultJa', schedule.resultJa], ['결과 한국어', 'resultKo', schedule.resultKo],
			['備考 日本語', 'noteJa', schedule.noteJa, 'textarea'], ['비고 한국어', 'noteKo', schedule.noteKo, 'textarea'],
			['開始日', 'dateStart', schedule.dateStart, 'date'], ['終了日', 'dateEnd', schedule.dateEnd, 'date'],
		];
		for (const [label, key, value, kind = 'text'] of specs) grid.appendChild(field(label, key, value, kind));
		grid.appendChild(checkField(copy().announced, 'announced', schedule.announced));
		card.appendChild(grid);
		return card;
	}

	function topicCard(topic, index) {
		const card = element('article', 'admin-cert-child');
		card.dataset.topicItem = 'true';
		const head = element('div', 'admin-cert-child-title');
		head.appendChild(element('span', '', `${copy().topicItem} ${index + 1}`));
		const remove = element('button', 'admin-cert-remove', copy().remove);
		remove.type = 'button';
		remove.addEventListener('click', () => { card.remove(); renumberChildren(); });
		head.appendChild(remove);
		card.appendChild(head);
		const grid = element('div', 'admin-cert-grid');
		grid.appendChild(field('Type', 'type', topic.type || 'concept', 'select', false, [['format','format'],['domain','domain'],['concept','concept'],['study','study']]));
		grid.appendChild(field('表示順', 'displayOrder', topic.displayOrder ?? (index + 1) * 10, 'number'));
		grid.appendChild(field('Weight %', 'weightPercent', topic.weightPercent ?? '', 'number'));
		grid.appendChild(field('タイトル 日本語', 'titleJa', topic.titleJa));
		grid.appendChild(field('제목 한국어', 'titleKo', topic.titleKo));
		grid.appendChild(field('説明 日本語', 'descriptionJa', topic.descriptionJa, 'textarea'));
		grid.appendChild(field('설명 한국어', 'descriptionKo', topic.descriptionKo, 'textarea'));
		grid.appendChild(field('Meta 日本語', 'metaJa', topic.metaJa, 'textarea'));
		grid.appendChild(field('Meta 한국어', 'metaKo', topic.metaKo, 'textarea'));
		card.appendChild(grid);
		return card;
	}

	function section(titleText, addText, onAdd, children) {
		const sectionNode = element('section', 'admin-cert-section');
		const head = element('div', 'admin-cert-section-head');
		head.appendChild(element('h3', '', titleText));
		const add = element('button', 'admin-cert-add', addText);
		add.type = 'button';
		add.addEventListener('click', onAdd);
		head.appendChild(add);
		sectionNode.appendChild(head);
		sectionNode.appendChild(children);
		return sectionNode;
	}

	function selectedCertification() {
		return certifications.find((cert) => cert.id === selectedId) || certifications[0] || null;
	}

	function renumberChildren() {
		document.querySelectorAll('[data-schedule-item]').forEach((card, index) => {
			const label = card.querySelector('.admin-cert-child-title span');
			if (label) label.textContent = `${copy().scheduleItem} ${index + 1}`;
		});
		document.querySelectorAll('[data-topic-item]').forEach((card, index) => {
			const label = card.querySelector('.admin-cert-child-title span');
			if (label) label.textContent = `${copy().topicItem} ${index + 1}`;
		});
	}

	function readFields(container) {
		const result = {};
		container.querySelectorAll(':scope [data-field]').forEach((input) => {
			if (input.closest('[data-schedule-item],[data-topic-item]') && container.classList.contains('admin-cert-editor')) return;
			result[input.dataset.field] = input.type === 'checkbox' ? input.checked : input.value;
		});
		return result;
	}

	function readChild(card) {
		const result = {};
		card.querySelectorAll('[data-field]').forEach((input) => {
			result[input.dataset.field] = input.type === 'checkbox' ? input.checked : input.value;
		});
		return result;
	}

	async function saveCurrent(editor) {
		if (saving) return;
		const cert = selectedCertification();
		if (!cert) return;
		const status = editor.querySelector('.admin-cert-status');
		const button = editor.querySelector('.admin-cert-save');
		saving = true;
		button.disabled = true;
		button.textContent = copy().saving;
		status.className = 'admin-cert-status';
		status.textContent = '';
		const main = readFields(editor);
		const schedules = [...editor.querySelectorAll('[data-schedule-item]')].map(readChild);
		const topics = [...editor.querySelectorAll('[data-topic-item]')].map(readChild);
		try {
			const data = await requestJson(API, {
				method: 'PATCH', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: cert.id, ...main, schedules, topics }),
			});
			certifications = data.certifications || certifications;
			status.className = 'admin-cert-status is-success';
			status.textContent = copy().saved;
			render();
		} catch (error) {
			console.error(error);
			status.className = 'admin-cert-status is-error';
			status.textContent = `${copy().failed} (${error.message})`;
		} finally {
			saving = false;
			if (button.isConnected) { button.disabled = false; button.textContent = copy().save; }
		}
	}

	function renderEditor(cert) {
		if (!cert) return element('div', 'admin-cert-empty', copy().noSelection);
		const editor = element('section', 'admin-cert-editor');
		const head = element('div', 'admin-cert-editor-head');
		head.appendChild(element('h2', '', `${cert.code} · ${language() === 'ko' ? cert.titleKo : cert.titleJa}`));
		const save = element('button', 'admin-cert-save', copy().save);
		save.type = 'button';
		save.addEventListener('click', () => saveCurrent(editor));
		head.appendChild(save);
		editor.appendChild(head);
		const basic = element('section', 'admin-cert-section');
		basic.appendChild(element('h3', '', copy().basic));
		basic.appendChild(mainFields(cert));
		editor.appendChild(basic);

		const schedules = element('div', 'admin-cert-children');
		(cert.schedules || []).forEach((row, index) => schedules.appendChild(scheduleCard(row, index)));
		editor.appendChild(section(copy().schedule, copy().addSchedule, () => {
			schedules.appendChild(scheduleCard({ announced: false }, schedules.children.length));
		}, schedules));

		const topics = element('div', 'admin-cert-children');
		(cert.topics || []).forEach((row, index) => topics.appendChild(topicCard(row, index)));
		editor.appendChild(section(copy().topics, copy().addTopic, () => {
			topics.appendChild(topicCard({ type: 'concept', displayOrder: (topics.children.length + 1) * 10 }, topics.children.length));
		}, topics));
		editor.appendChild(element('div', 'admin-cert-status'));
		return editor;
	}

	function renderList() {
		const list = element('aside', 'admin-cert-list');
		for (const cert of certifications) {
			const button = document.createElement('button');
			button.type = 'button';
			button.classList.toggle('is-active', cert.id === selectedId);
			const name = element('span', '', `${cert.code} · ${language() === 'ko' ? cert.titleKo : cert.titleJa}`);
			const state = element('small', '', cert.isActive ? 'ON' : 'OFF');
			button.append(name, state);
			button.addEventListener('click', () => { selectedId = cert.id; render(); });
			list.appendChild(button);
		}
		return list;
	}

	function syncHeading() {
		const labels = copy();
		const title = document.getElementById('cert-admin-title');
		const description = document.getElementById('cert-admin-description');
		const publicLink = document.querySelector('.admin-cert-public-link');
		if (title) title.textContent = labels.title;
		if (description) description.textContent = labels.description;
		if (publicLink) {
			publicLink.textContent = labels.public;
			publicLink.href = language() === 'ko' ? '/ko/certifications/' : '/ja/certifications/';
		}
	}

	function render() {
		if (!root) return;
		syncHeading();
		if (!selectedId && certifications.length) selectedId = certifications[0].id;
		root.replaceChildren(renderList(), renderEditor(selectedCertification()));
	}

	async function load() {
		try {
			const data = await requestJson(API);
			certifications = data.certifications || [];
			if (!selectedId && certifications.length) selectedId = certifications[0].id;
			render();
		} catch (error) {
			console.error(error);
			if (root) root.replaceChildren(element('div', 'admin-cert-empty', copy().loadFailed));
		}
	}

	async function initialize() {
		await window.AdminCommon?.ready;
		syncHeading();
		await load();
		document.addEventListener('adminlanguagechange', render);
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
