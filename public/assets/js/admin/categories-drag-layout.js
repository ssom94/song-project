(() => {
	function moveDragHandleToOwnColumn(row) {
		if (!(row instanceof HTMLTableRowElement)) return;
		const handle = row.querySelector('.admin-category-drag-handle');
		if (!handle) return;

		let dragCell = row.querySelector('.admin-category-drag-column');
		if (!dragCell) {
			dragCell = document.createElement('td');
			dragCell.className = 'admin-category-drag-column';
			row.appendChild(dragCell);
		}

		const orderCell = row.querySelector('.admin-category-order');
		const orderWrap = orderCell?.querySelector('.admin-category-order-cell');
		const orderNumber = orderWrap?.querySelector('span');
		if (orderCell && orderNumber) {
			orderCell.replaceChildren(orderNumber);
		}

		dragCell.replaceChildren(handle);
	}

	function applyLayout() {
		document.querySelectorAll('#category-table-body > tr').forEach(moveDragHandleToOwnColumn);
	}

	function initialize() {
		const body = document.getElementById('category-table-body');
		if (!body) return;
		applyLayout();
		new MutationObserver(applyLayout).observe(body, { childList: true });
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize, { once: true });
	} else {
		initialize();
	}
})();
