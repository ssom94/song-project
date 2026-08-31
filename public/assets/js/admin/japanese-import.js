(() => {
	const IMPORT_API = '/api/admin/japanese/words/import';
	const RESULT_KEY = 'song_japanese_excel_import_result';
	const REQUIRED_HEADERS = ['word', 'reading', 'meaning_ko'];
	const HEADERS = [
		'word',
		'reading',
		'meaning_ko',
		'meaning_ja',
		'jlpt',
		'jlpt_study_date',
		'part_of_speech',
		'category',
		'example_ja',
		'example_reading',
		'example_ko',
		'note',
	];

	let importing = false;
	let selectedFile = null;

	function currentLanguage() {
		return window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja';
	}

	function copy() {
		return currentLanguage() === 'ko'
			? {
				title: 'Excel 일괄 등록',
				hint: '필수 3개 컬럼만 입력해도 등록됩니다. N1 학습용은 jlpt=N1과 jlpt_study_date를 함께 입력하면 해당 날짜 커리큘럼에 자동 연결됩니다.',
				template: 'Excel 템플릿 다운로드',
				choose: 'Excel 파일 선택',
				import: '일괄 등록',
				noFile: '선택된 파일 없음',
				selected: (name) => `선택 파일: ${name}`,
				required: '필수: word / reading / meaning_ko',
				optional: '선택: meaning_ja / jlpt / jlpt_study_date / part_of_speech / category / example_ja / example_reading / example_ko / note',
				multi: '여러 뜻·품사는 한 셀에서 | 로 구분합니다.',
				loadingLibrary: 'Excel 기능을 불러오는 중입니다…',
				invalidHeaders: '필수 컬럼이 없습니다. 템플릿의 1행 컬럼명을 변경하지 마세요.',
				empty: '등록할 데이터 행이 없습니다.',
				tooMany: '한 번에 최대 500행까지 등록할 수 있습니다.',
				reading: (count) => `${count}개 행을 확인했습니다.`,
				importing: '일괄 등록 중입니다…',
				failed: 'Excel 일괄 등록에 실패했습니다.',
				libraryFailed: 'Excel 파일 처리 기능을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.',
				summary: (result) => {
					const enrolled = Array.isArray(result.results) ? result.results.filter((item) => item?.jlptEnrolled).length : 0;
					return `총 ${result.total}건 · 신규 ${result.created}건 · 기존 병합 ${result.merged}건 · 실패 ${result.failed}건${enrolled ? ` · N1 학습등록 ${enrolled}건` : ''}`;
				},
				failedRows: '실패 행',
				ruleSheet: '규칙',
				wordSheet: '단어',
			}
			: {
				title: 'Excel一括登録',
				hint: '必須3列だけでも登録できます。N1学習用は jlpt=N1 と jlpt_study_date を入力すると、その日のカリキュラムへ自動連携します。',
				template: 'Excelテンプレートをダウンロード',
				choose: 'Excelファイル選択',
				import: '一括登録',
				noFile: 'ファイル未選択',
				selected: (name) => `選択ファイル: ${name}`,
				required: '必須: word / reading / meaning_ko',
				optional: '任意: meaning_ja / jlpt / jlpt_study_date / part_of_speech / category / example_ja / example_reading / example_ko / note',
				multi: '複数の意味・品詞は1セル内で | 区切りにします。',
				loadingLibrary: 'Excel機能を読み込んでいます…',
				invalidHeaders: '必須列がありません。テンプレート1行目の列名を変更しないでください。',
				empty: '登録するデータ行がありません。',
				tooMany: '一度に登録できるのは最大500行です。',
				reading: (count) => `${count}行を確認しました。`,
				importing: '一括登録中です…',
				failed: 'Excel一括登録に失敗しました。',
				libraryFailed: 'Excelファイル処理機能を読み込めませんでした。ネット接続を確認してください。',
				summary: (result) => {
					const enrolled = Array.isArray(result.results) ? result.results.filter((item) => item?.jlptEnrolled).length : 0;
					return `合計 ${result.total}件 · 新規 ${result.created}件 · 既存へ統合 ${result.merged}件 · 失敗 ${result.failed}件${enrolled ? ` · N1学習登録 ${enrolled}件` : ''}`;
				},
				failedRows: '失敗行',
				ruleSheet: 'ルール',
				wordSheet: '単語',
			};
	}

	function injectStyle() {
		if (document.querySelector('link[data-japanese-import-style]')) return;
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = '/assets/css/admin/japanese-import.css';
		link.dataset.japaneseImportStyle = 'true';
		document.head.appendChild(link);
	}

	function loadXlsx() {
		if (window.XLSX) return Promise.resolve(window.XLSX);
		return new Promise((resolve, reject) => {
			const existing = document.querySelector('script[data-sheetjs]');
			if (existing) {
				existing.addEventListener('load', () => resolve(window.XLSX), { once: true });
				existing.addEventListener('error', reject, { once: true });
				return;
			}
			const script = document.createElement('script');
			script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
			script.async = true;
			script.dataset.sheetjs = 'true';
			script.addEventListener('load', () => window.XLSX ? resolve(window.XLSX) : reject(new Error('XLSX_UNAVAILABLE')), { once: true });
			script.addEventListener('error', reject, { once: true });
			document.head.appendChild(script);
		});
	}

	function byId(id) {
		return document.getElementById(id);
	}

	function setStatus(message, type = 'info') {
		const status = byId('japanese-excel-import-status');
		if (!status) return;
		status.hidden = !message;
		status.dataset.type = type;
		status.textContent = message || '';
	}

	function setResult(result) {
		const wrap = byId('japanese-excel-import-result');
		if (!wrap) return;
		wrap.replaceChildren();
		if (!result) {
			wrap.hidden = true;
			return;
		}
		wrap.hidden = false;
		const labels = copy();
		const summary = document.createElement('strong');
		summary.textContent = labels.summary(result);
		wrap.appendChild(summary);

		const failures = Array.isArray(result.results)
			? result.results.filter((item) => item?.status === 'failed')
			: [];
		if (failures.length) {
			const detail = document.createElement('details');
			const title = document.createElement('summary');
			title.textContent = `${labels.failedRows} (${failures.length})`;
			const list = document.createElement('ul');
			for (const item of failures.slice(0, 100)) {
				const li = document.createElement('li');
				li.textContent = `${item.rowNumber}행 · ${item.word || '—'} · ${item.error || 'ERROR'}`;
				list.appendChild(li);
			}
			detail.append(title, list);
			wrap.appendChild(detail);
		}
	}

	function buildPanel() {
		if (byId('japanese-excel-import-card')) return;
		const tabs = document.querySelector('.admin-japanese-tabs');
		const layout = byId('admin-japanese-layout');
		if (!tabs || !layout) return;
		const labels = copy();

		const card = document.createElement('section');
		card.id = 'japanese-excel-import-card';
		card.className = 'admin-japanese-card admin-japanese-import-card';

		const heading = document.createElement('div');
		heading.className = 'admin-japanese-import-heading';
		const headingCopy = document.createElement('div');
		const title = document.createElement('h2');
		title.id = 'japanese-excel-import-title';
		title.textContent = labels.title;
		const hint = document.createElement('p');
		hint.id = 'japanese-excel-import-hint';
		hint.textContent = labels.hint;
		headingCopy.append(title, hint);
		const template = document.createElement('button');
		template.id = 'japanese-excel-template';
		template.className = 'admin-japanese-import-template';
		template.type = 'button';
		template.textContent = labels.template;
		heading.append(headingCopy, template);

		const rules = document.createElement('div');
		rules.className = 'admin-japanese-import-rules';
		const required = document.createElement('strong');
		required.id = 'japanese-excel-required';
		required.textContent = labels.required;
		const optional = document.createElement('span');
		optional.id = 'japanese-excel-optional';
		optional.textContent = labels.optional;
		const multi = document.createElement('span');
		multi.id = 'japanese-excel-multi';
		multi.textContent = labels.multi;
		rules.append(required, optional, multi);

		const controls = document.createElement('div');
		controls.className = 'admin-japanese-import-controls';
		const input = document.createElement('input');
		input.id = 'japanese-excel-file';
		input.type = 'file';
		input.accept = '.xlsx,.xls,.csv';
		input.hidden = true;
		const choose = document.createElement('button');
		choose.id = 'japanese-excel-choose';
		choose.className = 'admin-japanese-import-choose';
		choose.type = 'button';
		choose.textContent = labels.choose;
		const fileName = document.createElement('span');
		fileName.id = 'japanese-excel-file-name';
		fileName.textContent = labels.noFile;
		const submit = document.createElement('button');
		submit.id = 'japanese-excel-submit';
		submit.className = 'admin-japanese-import-submit';
		submit.type = 'button';
		submit.disabled = true;
		submit.textContent = labels.import;
		controls.append(input, choose, fileName, submit);

		const status = document.createElement('p');
		status.id = 'japanese-excel-import-status';
		status.className = 'admin-japanese-import-status';
		status.hidden = true;
		const result = document.createElement('div');
		result.id = 'japanese-excel-import-result';
		result.className = 'admin-japanese-import-result';
		result.hidden = true;

		card.append(heading, rules, controls, status, result);
		layout.insertAdjacentElement('beforebegin', card);

		choose.addEventListener('click', () => input.click());
		input.addEventListener('change', () => {
			selectedFile = input.files?.[0] ?? null;
			fileName.textContent = selectedFile ? labels.selected(selectedFile.name) : labels.noFile;
			submit.disabled = !selectedFile || importing;
			setStatus('');
		});
		template.addEventListener('click', downloadTemplate);
		submit.addEventListener('click', importSelectedFile);
	}

	function syncLanguage() {
		const labels = copy();
		const assignments = {
			'japanese-excel-import-title': labels.title,
			'japanese-excel-import-hint': labels.hint,
			'japanese-excel-template': labels.template,
			'japanese-excel-choose': labels.choose,
			'japanese-excel-submit': labels.import,
			'japanese-excel-required': labels.required,
			'japanese-excel-optional': labels.optional,
			'japanese-excel-multi': labels.multi,
		};
		for (const [id, value] of Object.entries(assignments)) {
			const node = byId(id);
			if (node) node.textContent = value;
		}
		const fileName = byId('japanese-excel-file-name');
		if (fileName) fileName.textContent = selectedFile ? labels.selected(selectedFile.name) : labels.noFile;
	}

	async function downloadTemplate() {
		const labels = copy();
		setStatus(labels.loadingLibrary);
		try {
			const XLSX = await loadXlsx();
			const workbook = XLSX.utils.book_new();
			const wordSheet = XLSX.utils.aoa_to_sheet([HEADERS]);
			wordSheet['!cols'] = HEADERS.map((header) => ({ wch: Math.max(14, header.length + 3) }));
			XLSX.utils.book_append_sheet(workbook, wordSheet, labels.wordSheet);

			const ruleRows = currentLanguage() === 'ko'
				? [
					['항목', '규칙'],
					['1행', '컬럼명 고정. 이름을 변경하지 않습니다.'],
					['2행 이후', '한 행에 단어 1개씩 입력합니다.'],
					['필수', 'word / reading / meaning_ko'],
					['선택', '나머지 컬럼은 비워도 됩니다. 값이 있으면 등록됩니다.'],
					['meaning_ko', '뜻이 여러 개면 | 로 구분: 약속|언약'],
					['jlpt', 'N1, N2, N3, N4, N5 중 하나'],
					['jlpt_study_date', 'N1 커리큘럼에 넣을 학습일. YYYY-MM-DD 형식. 예: 2026-09-01'],
					['part_of_speech', '관리자 품사명 사용. 여러 개면 | 로 구분: 명사|サ変名詞'],
					['category', '관리자 학습분류의 일본어명 또는 한국어명 사용'],
					['중복 단어', '신규 생성하지 않고 기존 단어에 뜻·품사·예문을 병합합니다. jlpt_study_date가 있으면 기존 단어도 커리큘럼에 연결합니다.'],
					['최대 행 수', '1회 500행'],
				]
				: [
					['項目', 'ルール'],
					['1行目', '列名は固定です。変更しないでください。'],
					['2行目以降', '1行につき1単語を入力します。'],
					['必須', 'word / reading / meaning_ko'],
					['任意', 'その他の列は空欄でも登録できます。値がある場合のみ反映します。'],
					['meaning_ko', '複数の意味は | 区切り: 약속|언약'],
					['jlpt', 'N1, N2, N3, N4, N5 のいずれか'],
					['jlpt_study_date', 'N1カリキュラムへ登録する学習日。YYYY-MM-DD。例: 2026-09-01'],
					['part_of_speech', '管理画面の品詞名を使用。複数は | 区切り: 名詞|サ変名詞'],
					['category', '管理画面の学習分類の日本語名または韓国語名を使用'],
					['重複単語', '新規作成せず、既存単語へ意味・品詞・例文を統合します。jlpt_study_date があれば既存単語もカリキュラムへ連携します。'],
					['最大行数', '1回500行'],
				];
			const ruleSheet = XLSX.utils.aoa_to_sheet(ruleRows);
			ruleSheet['!cols'] = [{ wch: 20 }, { wch: 78 }];
			XLSX.utils.book_append_sheet(workbook, ruleSheet, labels.ruleSheet);
			XLSX.writeFile(workbook, 'japanese_words_import_template.xlsx');
			setStatus('');
		} catch (error) {
			console.error('Failed to create Japanese Excel template', error);
			setStatus(labels.libraryFailed, 'error');
		}
	}

	function normalizeSheetRow(row, rowNumber) {
		return {
			rowNumber,
			word: String(row.word ?? '').trim(),
			reading: String(row.reading ?? '').trim(),
			meaningKo: String(row.meaning_ko ?? '').trim(),
			meaningJa: String(row.meaning_ja ?? '').trim(),
			jlpt: String(row.jlpt ?? '').trim(),
			jlptStudyDate: String(row.jlpt_study_date ?? '').trim(),
			partOfSpeech: String(row.part_of_speech ?? '').trim(),
			category: String(row.category ?? '').trim(),
			exampleJa: String(row.example_ja ?? '').trim(),
			exampleReading: String(row.example_reading ?? '').trim(),
			exampleKo: String(row.example_ko ?? '').trim(),
			note: String(row.note ?? '').trim(),
		};
	}

	async function readRows(file) {
		const XLSX = await loadXlsx();
		const buffer = await file.arrayBuffer();
		const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
		const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
		if (!firstSheet) return { rows: [], headers: [] };
		const matrix = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '', raw: false });
		const headers = Array.isArray(matrix[0]) ? matrix[0].map((value) => String(value ?? '').trim()) : [];
		const objects = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });
		const rows = objects
			.map((row, index) => normalizeSheetRow(row, index + 2))
			.filter((row) => Object.entries(row).some(([name, value]) => name !== 'rowNumber' && String(value).trim()));
		return { rows, headers };
	}

	async function importSelectedFile() {
		if (!selectedFile || importing) return;
		const labels = copy();
		const submit = byId('japanese-excel-submit');
		importing = true;
		if (submit) submit.disabled = true;
		setResult(null);
		setStatus(labels.loadingLibrary);
		try {
			const { rows, headers } = await readRows(selectedFile);
			const headerSet = new Set(headers);
			if (REQUIRED_HEADERS.some((header) => !headerSet.has(header))) {
				setStatus(labels.invalidHeaders, 'error');
				return;
			}
			if (!rows.length) {
				setStatus(labels.empty, 'error');
				return;
			}
			if (rows.length > 500) {
				setStatus(labels.tooMany, 'error');
				return;
			}
			setStatus(`${labels.reading(rows.length)} ${labels.importing}`);
			const response = await fetch(IMPORT_API, {
				method: 'POST',
				credentials: 'same-origin',
				cache: 'no-store',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ rows }),
			});
			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error || `HTTP_${response.status}`);
			sessionStorage.setItem(RESULT_KEY, JSON.stringify(result));
			window.location.reload();
		} catch (error) {
			console.error('Failed to import Japanese Excel words', error);
			setStatus(window.XLSX ? labels.failed : labels.libraryFailed, 'error');
		} finally {
			importing = false;
			if (submit) submit.disabled = !selectedFile;
		}
	}

	function restoreResult() {
		try {
			const raw = sessionStorage.getItem(RESULT_KEY);
			if (!raw) return;
			sessionStorage.removeItem(RESULT_KEY);
			const result = JSON.parse(raw);
			setResult(result);
			setStatus(copy().summary(result), result.failed > 0 ? 'warning' : 'success');
		} catch {
			// Ignore invalid cached result.
		}
	}

	async function initialize() {
		await Promise.all([window.AdminCommon?.ready, window.AdminI18n?.ready]);
		injectStyle();
		buildPanel();
		restoreResult();
		document.addEventListener('adminlanguagechange', syncLanguage);
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();

if (!document.querySelector('script[data-japanese-timestamps]')) {
	const script = document.createElement('script');
	script.src = '/assets/js/admin/japanese-timestamps.js';
	script.dataset.japaneseTimestamps = 'true';
	document.body.appendChild(script);
}
