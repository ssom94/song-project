(() => {
	const PAGE_SIZE = 50;
	let page = 1;
	let requestId = 0;
	let authenticated = false;
	let searchTimer = 0;

	const body = document.getElementById('example-body');
	const search = document.getElementById('example-search');
	const jlpt = document.getElementById('example-jlpt');
	const state = document.getElementById('example-state');
	const total = document.getElementById('example-total');
	const pager = document.getElementById('example-pagination');
	const loginNote = document.getElementById('example-login-note');
	if (!body || !search || !jlpt || !state || !total || !pager) return;

	async function fetchJson(url, options) {
		const response = await fetch(url, { cache: 'no-store', ...options });
		const result = await response.json().catch(() => null);
		if (!response.ok || !result?.ok) throw new Error(result?.error || `HTTP_${response.status}`);
		return result;
	}

	function stateLabel(value) {
		if (value === 'mastered') return '완벽독해';
		if (value === 'review') return '복습필요';
		return '미학습';
	}

	async function save(item, next = {}) {
		if (!authenticated) {
			loginNote.textContent = '상태 저장은 관리자 로그인 후 가능합니다.';
			return false;
		}
		const payload = {
			exampleId: item.id,
			state: next.state ?? item.state,
			checked: next.checked ?? item.checked,
		};
		try {
			await fetchJson('/api/admin/japanese/examples/state', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			item.state = payload.state;
			item.checked = payload.checked;
			return true;
		} catch (error) {
			console.warn('Failed to save example state', error);
			loginNote.textContent = '상태 저장에 실패했습니다.';
			return false;
		}
	}

	function renderRow(item, number) {
		const tr = document.createElement('tr');
		const checkTd = document.createElement('td');
		checkTd.className = 'col-check';
		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox'; checkbox.className = 'example-checkbox'; checkbox.checked = item.checked;
		checkbox.setAttribute('aria-label', `${number}번 예문 체크`);
		checkbox.addEventListener('change', async () => {
			const ok = await save(item, { checked: checkbox.checked });
			if (!ok) checkbox.checked = item.checked;
		});
		checkTd.appendChild(checkbox);

		const noTd = document.createElement('td'); noTd.className = 'example-number'; noTd.textContent = String(number);
		const wordTd = document.createElement('td'); wordTd.className = 'example-word';
		const strong = document.createElement('strong'); strong.textContent = item.word || '—';
		const small = document.createElement('small'); small.textContent = [item.reading, item.jlpt].filter(Boolean).join(' · ');
		wordTd.append(strong, small);

		const sentenceTd = document.createElement('td');
		const sentence = document.createElement('div'); sentence.className = 'example-sentence'; sentence.textContent = item.sentence || '—';
		sentenceTd.appendChild(sentence);
		if (item.sentenceReading) { const reading = document.createElement('span'); reading.className = 'example-reading'; reading.textContent = item.sentenceReading; sentenceTd.appendChild(reading); }

		const translationTd = document.createElement('td');
		const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'example-translation-btn'; btn.textContent = '한국어 보기';
		const translation = document.createElement('div'); translation.className = 'example-translation'; translation.hidden = true; translation.textContent = item.translationKo || '등록된 번역이 없습니다.';
		btn.addEventListener('click', () => { translation.hidden = !translation.hidden; btn.textContent = translation.hidden ? '한국어 보기' : '한국어 숨기기'; });
		translationTd.append(btn, translation);

		const stateTd = document.createElement('td');
		const select = document.createElement('select'); select.className = `example-state-select state-${item.state}`;
		for (const value of ['mastered', 'review', 'unlearned']) { const option = document.createElement('option'); option.value = value; option.textContent = stateLabel(value); option.selected = item.state === value; select.appendChild(option); }
		select.addEventListener('change', async () => {
			const previous = item.state;
			const ok = await save(item, { state: select.value });
			if (!ok) select.value = previous;
			select.className = `example-state-select state-${select.value}`;
		});
		stateTd.appendChild(select);

		tr.append(checkTd, noTd, wordTd, sentenceTd, translationTd, stateTd);
		return tr;
	}

	function renderPagination(pagination) {
		pager.replaceChildren();
		const pages = Math.max(1, Number(pagination?.totalPages || 1));
		if (pages <= 1) return;
		const add = (label, target, disabled = false, active = false) => {
			const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.disabled = disabled; if (active) b.className = 'is-active';
			b.addEventListener('click', () => { if (disabled || target === page) return; page = target; load(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
			pager.appendChild(b);
		};
		add('이전', page - 1, page <= 1);
		const start = Math.max(1, page - 2), end = Math.min(pages, page + 2);
		for (let n = start; n <= end; n += 1) add(String(n), n, false, n === page);
		add('다음', page + 1, page >= pages);
	}

	async function load() {
		const id = ++requestId;
		body.innerHTML = '<tr><td colspan="6" class="example-empty">예문을 불러오는 중입니다.</td></tr>';
		const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
		if (search.value.trim()) params.set('q', search.value.trim());
		if (jlpt.value) params.set('jlpt', jlpt.value);
		if (state.value) params.set('state', state.value);
		try {
			const result = await fetchJson(`/api/public/japanese/examples?${params}`);
			if (id !== requestId) return;
			authenticated = Boolean(result.authenticated);
			loginNote.textContent = authenticated ? '체크·상태 자동 저장' : '로그인 전에는 상태가 저장되지 않습니다.';
			total.textContent = String(result.pagination?.total ?? 0);
			body.replaceChildren();
			const items = Array.isArray(result.examples) ? result.examples : [];
			if (!items.length) { body.innerHTML = '<tr><td colspan="6" class="example-empty">조건에 맞는 예문이 없습니다.</td></tr>'; renderPagination(result.pagination); return; }
			items.forEach((item, index) => body.appendChild(renderRow(item, ((page - 1) * PAGE_SIZE) + index + 1)));
			renderPagination(result.pagination);
		} catch (error) {
			console.warn('Failed to load examples', error);
			body.innerHTML = '<tr><td colspan="6" class="example-empty">예문을 불러오지 못했습니다.</td></tr>';
		}
	}

	search.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = window.setTimeout(() => { page = 1; load(); }, 250); });
	jlpt.addEventListener('change', () => { page = 1; load(); });
	state.addEventListener('change', () => { page = 1; load(); });
	load();
})();
