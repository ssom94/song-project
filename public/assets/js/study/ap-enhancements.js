(() => {
	const PAGE_SIZE = 10;
	const targetId = 'ap-topic-progress';
	function style() {
		if (document.getElementById('ap-pagination-style')) return;
		const el = document.createElement('style');
		el.id = 'ap-pagination-style';
		el.textContent = '.ap-pager{display:flex;justify-content:center;align-items:center;gap:6px;flex-wrap:wrap;margin:16px 0 2px}.ap-pager button{min-width:38px;min-height:36px;border:1px solid #d4dce5;border-radius:8px;background:#fff;cursor:pointer;font-weight:800}.ap-pager button.is-active{background:#26364e;color:#fff}.ap-page-hidden{display:none!important}.ap-progress-topic strong::before{content:attr(data-number) ". ";color:#66758a}';
		document.head.appendChild(el);
	}
	function render() {
		const target = document.getElementById(targetId); if (!target) return;
		const items = [...target.children].filter((node) => node.classList?.contains('ap-progress-topic'));
		if (!items.length) return;
		let page = Math.max(1, Number(target.dataset.page || 1));
		const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE)); page = Math.min(page, pages); target.dataset.page = String(page);
		items.forEach((item, index) => {
			item.classList.toggle('ap-page-hidden', index < (page - 1) * PAGE_SIZE || index >= page * PAGE_SIZE);
			const strong = item.querySelector('strong'); if (strong) strong.dataset.number = String(index + 1);
		});
		const old = target.nextElementSibling; if (old?.classList.contains('ap-pager')) old.remove();
		if (pages <= 1) return;
		const pager = document.createElement('div'); pager.className = 'ap-pager';
		const add = (label, next, active = false, disabled = false) => { const b = document.createElement('button'); b.type='button'; b.textContent=label; b.disabled=disabled; b.classList.toggle('is-active',active); b.addEventListener('click',()=>{target.dataset.page=String(next);render();}); pager.appendChild(b); };
		add('‹', Math.max(1,page-1), false, page===1); for(let p=1;p<=pages;p+=1)add(String(p),p,p===page); add('›',Math.min(pages,page+1),false,page===pages); target.after(pager);
	}
	function init(){ style(); const target=document.getElementById(targetId); if(!target)return; new MutationObserver(()=>{target.dataset.page='1';queueMicrotask(render);}).observe(target,{childList:true}); render(); }
	if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();