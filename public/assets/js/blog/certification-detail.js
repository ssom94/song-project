(() => {
	const page = document.querySelector('[data-certification-detail]');
	if (!(page instanceof HTMLElement)) return;
	const language = page.dataset.language === 'ko' ? 'ko' : 'ja';
	const labels = language === 'ko'
		? { back:'자격증·시험 목록', next:'가장 가까운 일정', nextAfter:'그 다음 일정', application:'접수', exam:'시험', result:'결과', fee:'응시료', mode:'시험방식', duration:'시험시간', questions:'문제구성', pass:'합격기준', schedules:'시험 일정', format:'시험 구성', domains:'출제 범위', concepts:'핵심 개념', study:'공부 포인트', official:'공식 사이트', guide:'시험 가이드', source:'공식정보 확인일', failed:'시험 정보를 불러오지 못했습니다.' }
		: { back:'資格・試験一覧', next:'最も近い日程', nextAfter:'次の日程', application:'申込', exam:'試験', result:'結果', fee:'受験料', mode:'実施方式', duration:'試験時間', questions:'問題構成', pass:'合格基準', schedules:'試験日程', format:'試験構成', domains:'出題範囲', concepts:'重要概念', study:'学習ポイント', official:'公式サイト', guide:'試験ガイド', source:'公式情報確認日', failed:'試験情報を読み込めませんでした。' };
	const content = document.getElementById('cert-detail-content');
	const slug = new URLSearchParams(location.search).get('slug')?.trim() || '';

	function text(id, value) { const node = document.getElementById(id); if (node) node.textContent = value || '—'; }
	function relevantSchedules(schedules) {
		const today = new Date().toISOString().slice(0, 10);
		const list = Array.isArray(schedules) ? schedules : [];
		const future = list.filter((item) => !item.dateEnd || item.dateEnd >= today);
		return (future.length ? future : list.slice(-2)).slice(0, 2);
	}
	function section(title, kicker) {
		const node = document.createElement('section');
		node.className = 'cert-section';
		node.innerHTML = `<div class="cert-section-heading"><div><span class="cert-section-kicker"></span><h2></h2></div></div>`;
		node.querySelector('.cert-section-kicker').textContent = kicker;
		node.querySelector('h2').textContent = title;
		return node;
	}
	function scheduleCard(item, index) {
		const node = document.createElement('article');
		node.className = `cert-schedule-card${index === 0 ? ' is-primary' : ''}`;
		const rows = [[labels.application,item?.application],[labels.exam,item?.exam],[labels.result,item?.result]].filter(([,v]) => v);
		node.innerHTML = `<span class="cert-schedule-label">${index === 0 ? labels.next : labels.nextAfter}</span><h3></h3>`;
		node.querySelector('h3').textContent = item?.label || '—';
		for (const [label,value] of rows) {
			const row = document.createElement('div'); row.className = 'cert-schedule-row';
			const l = document.createElement('span'); l.textContent = label;
			const v = document.createElement('strong'); v.textContent = value;
			row.append(l,v); node.appendChild(row);
		}
		if (item?.note) { const p = document.createElement('p'); p.className = 'cert-schedule-note'; p.textContent = item.note; node.appendChild(p); }
		return node;
	}
	function topicSection(type, title, topics) {
		if (!topics.length) return null;
		const node = section(title, type.toUpperCase());
		if (type === 'study') {
			const list = document.createElement('div'); list.className = 'cert-study-list';
			topics.forEach((topic,index) => {
				const item = document.createElement('article'); item.className = 'cert-study-item';
				item.innerHTML = `<span class="cert-study-number">${String(index+1).padStart(2,'0')}</span><div><strong></strong><p></p></div>`;
				item.querySelector('strong').textContent = topic.title;
				item.querySelector('p').textContent = topic.description || '';
				list.appendChild(item);
			});
			node.appendChild(list);
			return node;
		}
		const grid = document.createElement('div'); grid.className = 'cert-topic-grid';
		for (const topic of topics) {
			const card = document.createElement('article'); card.className = 'cert-topic-card';
			card.innerHTML = '<h3></h3><p></p>';
			card.querySelector('h3').textContent = topic.title;
			card.querySelector('p').textContent = topic.description || '';
			if (topic.meta) { const meta = document.createElement('span'); meta.className = 'cert-topic-meta'; meta.textContent = topic.meta; card.appendChild(meta); }
			if (topic.weightPercent !== null && Number.isFinite(Number(topic.weightPercent))) {
				const weight = document.createElement('div'); weight.className = 'cert-weight';
				const pct = Math.max(0,Math.min(100,Number(topic.weightPercent)));
				weight.innerHTML = `<div class="cert-weight-track"><div class="cert-weight-fill" style="width:${pct}%"></div></div><b>${pct}%</b>`;
				card.appendChild(weight);
			}
			grid.appendChild(card);
		}
		node.appendChild(grid);
		return node;
	}
	function render(result) {
		const cert = result.certification;
		page.dataset.accent = cert.accentKey || 'blue';
		document.title = `${cert.title} | SONG`;
		text('cert-detail-code', cert.code);
		text('cert-detail-title', cert.title);
		text('cert-detail-subtitle', [cert.subtitle,cert.provider].filter(Boolean).join(' · '));
		text('cert-detail-summary', cert.summary);
		const back = document.getElementById('cert-back-link'); if (back) { back.textContent = `← ${labels.back}`; back.href = `/${language}/certifications/`; }
		const official = document.getElementById('cert-official-link'); if (official) { official.textContent = labels.official; official.href = cert.officialUrl; }
		const guide = document.getElementById('cert-guide-link'); if (guide) { guide.textContent = labels.guide; guide.href = cert.guideUrl || cert.officialUrl; }
		const schedules = relevantSchedules(result.schedules);
		const facts = document.getElementById('cert-facts');
		if (facts) {
			facts.replaceChildren();
			for (const [label,value,accent] of [[labels.next,schedules[0]?.exam,true],[labels.fee,cert.fee,false],[labels.duration,cert.duration,false],[labels.questions,cert.questions,false]]) {
				const fact = document.createElement('div'); fact.className = `cert-fact${accent ? ' is-accent' : ''}`; fact.innerHTML = '<span></span><strong></strong>'; fact.querySelector('span').textContent = label; fact.querySelector('strong').textContent = value || '—'; facts.appendChild(fact);
			}
		}
		if (!content) return;
		content.replaceChildren();
		const scheduleSection = section(labels.schedules,'SCHEDULE');
		const scheduleGrid = document.createElement('div'); scheduleGrid.className = 'cert-schedules'; scheduleGrid.append(scheduleCard(schedules[0],0),scheduleCard(schedules[1],1)); scheduleSection.appendChild(scheduleGrid);
		const pass = document.createElement('div'); pass.className = 'cert-source-box'; pass.style.marginTop = '10px'; pass.innerHTML = '<p></p>'; pass.querySelector('p').textContent = `${labels.pass}: ${cert.pass || '—'} · ${labels.mode}: ${cert.examMode || '—'}`; scheduleSection.appendChild(pass); content.appendChild(scheduleSection);
		const groups = { format:[], domain:[], concept:[], study:[] };
		for (const topic of Array.isArray(result.topics) ? result.topics : []) if (groups[topic.type]) groups[topic.type].push(topic);
		for (const node of [topicSection('format',labels.format,groups.format),topicSection('domain',labels.domains,groups.domain),topicSection('concept',labels.concepts,groups.concept),topicSection('study',labels.study,groups.study)]) if (node) content.appendChild(node);
		const source = section(labels.source,'SOURCE');
		const box = document.createElement('div'); box.className = 'cert-source-box';
		const p = document.createElement('p'); p.textContent = language === 'ko' ? `${cert.sourceCheckedAt} 기준 공식정보입니다. 접수 전 공식 사이트에서 최신 일정을 다시 확인하세요.` : `${cert.sourceCheckedAt} 時点の公式情報です。申込前に公式サイトで最新日程を再確認してください。`;
		const actions = document.createElement('div'); actions.className = 'cert-source-actions';
		for (const [label,href,cls] of [[labels.official,cert.officialUrl,'cert-primary-link'],[labels.guide,cert.guideUrl || cert.officialUrl,'cert-secondary-link']]) { const a = document.createElement('a'); a.className = cls; a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = label; actions.appendChild(a); }
		box.append(p,actions); source.appendChild(box); content.appendChild(source);
	}
	if (!slug) { if (content) content.innerHTML = `<div class="cert-empty">${labels.failed}</div>`; return; }
	fetch(`/api/public/certifications?lang=${language}&slug=${encodeURIComponent(slug)}`, { cache:'no-store' })
		.then(async (response) => { const result = await response.json().catch(() => null); if (!response.ok || !result?.ok) throw new Error(result?.error || `HTTP_${response.status}`); render(result); })
		.catch((error) => { console.error('Failed to load certification detail', error); if (content) content.innerHTML = `<div class="cert-empty">${labels.failed}</div>`; });
})();
