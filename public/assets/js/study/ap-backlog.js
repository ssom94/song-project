(() => {
	const language = document.body.dataset.blogLanguage === 'ja' ? 'ja' : 'ko';
	const text = language === 'ja'
		? { title: '未学習・再学習', description: '前日までに学習できなかった項目は、日付が変わってもここから再学習できます。', empty: '未学習の持ち越し項目はありません。', date: '元の学習日', correct: '理解・正解', partial: '曖昧', wrong: '誤答', complete: '完了', score: '点数' }
		: { title: '미학습·재학습', description: '이전에 학습하지 못한 항목은 날짜가 지나도 여기에서 다시 학습할 수 있습니다.', empty: '미학습으로 남아 있는 이월 항목이 없습니다.', date: '원래 학습일', correct: '이해/정답', partial: '애매함', wrong: '오답', complete: '완료', score: '점수' };
	const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
	const titleOf = (item) => language === 'ja' ? item.titleJa : item.titleKo;
	const descriptionOf = (item) => language === 'ja' ? item.descriptionJa : item.descriptionKo;
	async function load() {
		const response = await fetch('/api/public/ap/dashboard', { credentials: 'same-origin', cache: 'no-store' });
		const data = await response.json();
		if (!response.ok || !data?.ok) throw new Error(data?.error || 'AP_DASHBOARD_FAILED');
		const todayCard = document.querySelector('.ap-today-card');
		if (!todayCard) return;
		let section = document.getElementById('ap-backlog-card');
		if (!section) {
			section = document.createElement('section');
			section.id = 'ap-backlog-card';
			section.className = 'ap-card';
			todayCard.insertAdjacentElement('afterend', section);
		}
		const items = Array.isArray(data.backlog) ? data.backlog : [];
		section.innerHTML = `<div class="ap-section-head"><div><p class="ap-section-eyebrow">CARRY-OVER STUDY</p><h2>${esc(text.title)}</h2><p>${esc(text.description)}</p></div><strong>${items.length}</strong></div>` + (items.length ? `<div class="ap-today-items">${items.map(renderItem).join('')}</div>` : `<p class="ap-empty">${esc(text.empty)}</p>`);
		section.querySelectorAll('[data-ap-carry-result]').forEach((button) => button.addEventListener('click', complete));
	}
	function renderItem(item) {
		const test = item.itemKind === 'weekly_test' || item.itemKind === 'monthly_test';
		const buttons = test
			? `<button type="button" data-ap-carry-result="completed" data-ap-carry-item="${item.id}">${esc(text.complete)}</button>`
			: `<button type="button" data-ap-carry-result="correct" data-ap-carry-item="${item.id}">${esc(text.correct)}</button><button type="button" data-ap-carry-result="partial" data-ap-carry-item="${item.id}">${esc(text.partial)}</button><button type="button" data-ap-carry-result="wrong" data-ap-carry-item="${item.id}">${esc(text.wrong)}</button>`;
		return `<article class="ap-today-item"><div class="ap-item-main"><span class="ap-item-kind">${esc(item.itemKind)} · ${esc(text.date)} ${esc(item.studyDate)}</span><strong>${esc(titleOf(item))}</strong><p>${esc(descriptionOf(item))}</p></div><div class="ap-item-meta"><b>${Number(item.targetMinutes)}m</b><div class="ap-item-result"><label>${esc(text.score)} <input type="number" min="0" max="100" inputmode="numeric" data-ap-carry-score="${item.id}" /></label>${buttons}</div></div></article>`;
	}
	async function complete(event) {
		const button = event.currentTarget;
		const itemId = Number(button.dataset.apCarryItem);
		const result = button.dataset.apCarryResult;
		const input = document.querySelector(`[data-ap-carry-score="${itemId}"]`);
		const score = input?.value === '' ? null : Number(input?.value);
		button.disabled = true;
		try {
			const response = await fetch('/api/admin/ap/item/complete', { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId, result, score }) });
			const data = await response.json();
			if (!response.ok || !data?.ok) throw new Error(data?.error || 'AP_ITEM_COMPLETE_FAILED');
			await load();
		} catch (error) {
			console.error('Failed to complete carried-over AP item', error);
			button.disabled = false;
		}
	}
	load().catch((error) => console.error('Failed to load carried-over AP items', error));
})();
