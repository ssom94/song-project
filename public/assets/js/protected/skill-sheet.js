(() => {
	function language() {
		return document.body?.dataset.blogLanguage === 'ko' || window.location.pathname.startsWith('/ko/') ? 'ko' : 'ja';
	}

	function copy() {
		return language() === 'ko'
			? {
				registered: 'Excel 등록 완료',
				unregistered: 'Excel 미등록 상태',
				detail: '상세 스킬시트 열기',
				detailUnavailable: '상세 스킬시트 미등록',
				loadFailed: '스킬시트 정보를 불러오지 못했습니다.',
				sheets: '개 시트',
			}
			: {
				registered: 'Excel 登録済み',
				unregistered: 'Excel 未登録',
				detail: '詳細スキルシートを開く',
				detailUnavailable: '詳細スキルシート 未登録',
				loadFailed: 'スキルシート情報を読み込めませんでした。',
				sheets: 'シート',
			};
	}

	function byId(id) { return document.getElementById(id); }

	function renderSections(sections) {
		const grid = byId('skill-sheet-sections');
		if (!grid) return;
		grid.replaceChildren();
		for (const section of Array.isArray(sections) ? sections : []) {
			const card = document.createElement('article');
			card.className = 'protected-card';
			const title = document.createElement('h2');
			title.textContent = section.title ?? '';
			const description = document.createElement('p');
			description.textContent = section.description ?? '';
			const chips = document.createElement('div');
			chips.className = 'protected-chip-list';
			for (const skill of Array.isArray(section.skills) ? section.skills : []) {
				const chip = document.createElement('span');
				chip.className = 'protected-chip';
				chip.textContent = String(skill);
				chips.appendChild(chip);
			}
			card.append(title, description, chips);
			grid.appendChild(card);
		}
	}

	function renderExcel(excel) {
		const labels = copy();
		const status = byId('skill-sheet-excel-status');
		const meta = byId('skill-sheet-excel-meta');
		const detail = byId('skill-sheet-detail-link');
		const registered = excel?.registered === true;
		if (status) {
			status.textContent = registered ? labels.registered : labels.unregistered;
			status.classList.toggle('is-registered', registered);
			status.classList.toggle('is-unregistered', !registered);
		}
		if (meta) {
			meta.textContent = registered
				? `v${excel.versionNo} · ${excel.fileName ?? ''} · ${excel.sheetCount ?? 0}${labels.sheets}`
				: '';
		}
		if (detail instanceof HTMLAnchorElement) {
			detail.textContent = registered ? labels.detail : labels.detailUnavailable;
			detail.classList.toggle('is-disabled', !registered);
			detail.setAttribute('aria-disabled', String(!registered));
			detail.tabIndex = registered ? 0 : -1;
			if (registered) detail.href = `/protected/?lang=${language()}`;
			else detail.removeAttribute('href');
		}
	}

	async function initialize() {
		const labels = copy();
		try {
			const response = await fetch(`/api/public/skill-sheet?lang=${language()}`, { cache: 'no-store' });
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok || !result.summary) throw new Error(result?.error || 'LOAD_FAILED');
			const heading = byId('skill-sheet-heading');
			const description = byId('skill-sheet-description');
			if (heading) heading.textContent = result.summary.heading ?? '';
			if (description) description.textContent = result.summary.description ?? '';
			renderSections(result.summary.sections);
			renderExcel(result.excel);
		} catch (error) {
			console.warn('Failed to load public skill sheet', error);
			renderExcel({ registered: false });
			const grid = byId('skill-sheet-sections');
			if (grid && !grid.children.length) {
				const failed = document.createElement('p');
				failed.className = 'protected-skill-load-error';
				failed.textContent = labels.loadFailed;
				grid.appendChild(failed);
			}
		}
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
