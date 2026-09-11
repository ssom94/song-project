(() => {
	const API = '/api/admin/database';
	let tables = [], current = '', columns = [], rows = [], offset = 0, hasMore = false;
	const limit = 25;
	const $ = (id) => document.getElementById(id);
	const language = () => window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja';
	const text = (ko, ja) => language() === 'ko' ? ko : ja;

	async function fetchJson(url, options) {
		const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
		if (response.status === 401) { window.location.replace('/admin/login/'); throw new Error('UNAUTHORIZED'); }
		const data = await response.json().catch(() => null);
		if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP_${response.status}`);
		return data;
	}
	function message(value, error = false) { const node = $('db-message'); node.hidden = !value; node.textContent = value || ''; node.classList.toggle('is-error', error); }
	function applyLanguage() { document.querySelectorAll('[data-db-ko]').forEach((node) => { node.textContent = node.dataset[`db${language()[0].toUpperCase()}${language().slice(1)}`] || node.textContent; }); }
	function renderTables() {
		const filter = $('db-table-filter').value.trim().toLowerCase();
		$('db-table-list').replaceChildren(...tables.filter((name) => name.toLowerCase().includes(filter)).map((name) => { const button = document.createElement('button'); button.type='button'; button.textContent=name; button.title=name; button.classList.toggle('is-active', name===current); button.addEventListener('click',()=>loadTable(name,0)); return button; }));
	}
	function displayValue(value) { if (value === null) return 'NULL'; if (typeof value === 'object') return JSON.stringify(value); return String(value); }
	function parseValue(value, original) { if (value === 'NULL') return null; if (typeof original === 'number' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value); return value; }
	function renderData() {
		$('db-current-table').textContent = current || '—'; $('db-page-info').textContent = current ? `${offset + 1}–${offset + rows.length}` : '';
		$('db-prev').disabled = offset === 0; $('db-next').disabled = !hasMore;
		$('db-schema').replaceChildren(...columns.map((column) => { const chip=document.createElement('span'); chip.className=`db-column-chip${column.pk?' is-pk':''}`; chip.textContent=`${column.pk?'🔑 ':''}${column.name} · ${column.type||'ANY'}`; return chip; }));
		const tr=document.createElement('tr'); columns.forEach((column)=>{const th=document.createElement('th');th.textContent=column.name;tr.appendChild(th);});const action=document.createElement('th');action.textContent=text('작업','操作');tr.appendChild(action);$('db-head').replaceChildren(tr);
		$('db-body').replaceChildren(...rows.map((row) => {
			const line=document.createElement('tr'); const draft={};
			columns.forEach((column)=>{const td=document.createElement('td');const cell=document.createElement('div');cell.className=`db-cell${row[column.name]===null?' is-null':''}`;cell.textContent=displayValue(row[column.name]);if(!column.pk){cell.tabIndex=0;cell.addEventListener('click',()=>{cell.contentEditable='true';cell.focus();});cell.addEventListener('blur',()=>{cell.contentEditable='false';const next=parseValue(cell.textContent,row[column.name]);cell.classList.toggle('is-null',next===null);if(next!==row[column.name])draft[column.name]=next;else delete draft[column.name];save.disabled=!Object.keys(draft).length;});}td.appendChild(cell);line.appendChild(td);});
			const td=document.createElement('td');const save=document.createElement('button');save.type='button';save.className='db-save';save.textContent=text('저장','保存');save.disabled=true;save.addEventListener('click',async()=>{save.disabled=true;try{const key=Object.fromEntries(columns.filter(c=>c.pk).map(c=>[c.name,row[c.name]]));await fetchJson(`${API}/row`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({table:current,key,values:draft})});message(text('저장했습니다.','保存しました。'));await loadTable(current,offset);}catch(error){message(error.message,true);save.disabled=false;}});td.appendChild(save);line.appendChild(td);return line;
		}));
	}
	async function loadTables() { message(''); const data=await fetchJson(`${API}/tables`);tables=data.tables||[];renderTables();if(!current&&tables.length)await loadTable(tables[0],0); }
	async function loadTable(name,nextOffset) { message(''); current=name;offset=nextOffset;renderTables();try{const data=await fetchJson(`${API}/table?table=${encodeURIComponent(name)}&limit=${limit}&offset=${offset}`);columns=data.columns||[];rows=data.rows||[];offset=Number(data.page?.offset||0);hasMore=Boolean(data.page?.hasMore);renderData();}catch(error){message(error.message,true);} }
	$('db-refresh').addEventListener('click',loadTables);$('db-table-filter').addEventListener('input',renderTables);$('db-prev').addEventListener('click',()=>loadTable(current,Math.max(0,offset-limit)));$('db-next').addEventListener('click',()=>loadTable(current,offset+limit));window.addEventListener('admin-language-changed',()=>{applyLanguage();renderData();});
	applyLanguage();loadTables().catch((error)=>message(error.message,true));
})();
