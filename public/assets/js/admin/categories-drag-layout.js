(() => {
	// category-appearance.js decorates each rendered row with an icon while also
	// observing the table subtree. Ignore mutations caused only by that decoration
	// so the observer cannot remove/reinsert the same icon forever and freeze the page.
	const NativeMutationObserver = window.MutationObserver;
	if (NativeMutationObserver && !window.__songCategoryMutationGuard) {
		window.__songCategoryMutationGuard = true;
		window.MutationObserver = class extends NativeMutationObserver {
			constructor(callback) {
				super((mutations, observer) => {
					const meaningful = mutations.filter((mutation) => {
						const changed = [...mutation.addedNodes, ...mutation.removedNodes];
						if (!changed.length) return true;
						return changed.some((node) => !(
							node instanceof Element
							&& node.classList.contains('admin-category-row-icon')
						));
					});
					if (meaningful.length) callback(meaningful, observer);
				});
			}
		};
	}

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

	function loadPreviewAssets() {
		if (!document.querySelector('link[data-category-live-preview]')) {
			const style = document.createElement('link');
			style.rel = 'stylesheet';
			style.href = '/assets/css/admin/category-preview.css?v=20260831-1';
			style.dataset.categoryLivePreview = 'true';
			document.head.appendChild(style);
		}
		if (!document.querySelector('script[data-category-live-preview]')) {
			const script = document.createElement('script');
			script.src = '/assets/js/admin/category-preview.js?v=20260831-1';
			script.async = true;
			script.dataset.categoryLivePreview = 'true';
			document.body.appendChild(script);
		}
	}

	function initialize() {
		const body = document.getElementById('category-table-body');
		if (!body) return;
		applyLayout();
		new MutationObserver(applyLayout).observe(body, { childList: true });
		loadPreviewAssets();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize, { once: true });
	} else {
		initialize();
	}
})();