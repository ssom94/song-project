(() => {
	const page = document.querySelector('[data-certification-list]');
	if (!(page instanceof HTMLElement)) return;
	const language = page.dataset.language === 'ko' ? 'ko' : 'ja';
	const labels = language === 'ko'
		? { all:'전체', language:'어학', it:'IT', finance:'금융', cloud:'Cloud', next:'가장 가까운 일정', fee:'응시료', details:'상세보기', updated:'공식정보 확인', failed:'시험 정보를 불러오지 못했습니다.' }
		: { all:'すべて', language:'語学', it:'IT', finance:'金融', cloud:'Cloud', next:'最も近い日程', fee:'受験料', details:'詳細を見る', updated:'公式情報確認', failed:'試験情報を読み込めませんでした。' };
	const root = document.getElementById('cert-list');
	const count = document.getElementById('cert-count');
	let items = [];
	let filter = 'all';

	function relevantSchedule(schedules) {
		const today = new Date().toISOString().slice(0, 10);
		const list = Array.isArray(schedules) ? schedules : [];
		return list.find((item) => !item.dateEnd || item.dateEnd >= today) || list[0] || null;
	}

	function card(cert) {
		const el = document.createElement('article');
		el.className = 'cert-card';
		el.dataset.accent = cert.accentKey || 'blue';
		el.id = `cert-${cert.slug}`;
		const schedule = relevantSchedule(cert.schedules);
		el.innerHTML = `
			<div class="cert-card-top">
				<div><h2></h2><p class="cert-card-provider"></p></div>
				<span class="cert-code"></span>
			</div>
			<p class="cert-card-summary"></p>
			<div class="cert-card-metrics">
				<div class="cert-mini-metric"><span>${labels.next}</span><strong data-next></strong></div>
				<div class="cert-mini-metric"><span>${labels.fee}</span><strong data-fee></strong></div>
			</div>
			<div class="cert-card-footer"><span class="cert-updated"></span><a class="cert-detail-link"></a></div>`;
		el.querySelector('h2').textContent = cert.title || '';
		el.querySelector('.cert-card-provider').textContent = cert.provider || '';
		el.querySelector('.cert-code').textContent = cert.code || '';
		el.querySelector('.cert-card-summary').textContent = cert.summary || '';
		el.querySelector('[data-next]').textContent = schedule?.exam || '—';
		el.querySelector('[data-fee]').textContent = cert.fee || '—';
		el.querySelector('.cert-updated').textContent = `${labels.updated} ${cert.sourceCheckedAt || '—'}`;
		const link = el.querySelector('.cert-detail-link');
		link.textContent = `${labels.details} ›`;
		link.href = `/${language}/certifications/detail/?slug=${encodeURIComponent(cert.slug)}`;
		return el;
	}

	function render() {
		if (!root) return;
		const visible = filter === 'all' ? items : items.filter((item) => item.category === filter);
		root.replaceChildren(...visible.map(card));
		if (count) count.textContent = language === 'ko' ? `${visible.length}개 시험` : `${visible.length} Exams`;
	}

	document.querySelectorAll('[data-cert-filter]').forEach((button) => {
		if (!(button instanceof HTMLButtonElement)) return;
		const key = button.dataset.certFilter || 'all';
		button.textContent = labels[key] || key;
		button.addEventListener('click', () => {
			filter = key;
			document.querySelectorAll('[data-cert-filter]').forEach((node) => node.classList.toggle('is-active', node === button));
			render();
		});
	});

	fetch(`/api/public/certifications?lang=${language}`, { cache:'no-store' })
		.then(async (response) => {
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error || `HTTP_${response.status}`);
			items = Array.isArray(result.certifications) ? result.certifications : [];
			render();
		})
		.catch((error) => {
			console.error('Failed to load certifications', error);
			if (root) root.innerHTML = `<div class="cert-empty">${labels.failed}</div>`;
		});
})();
