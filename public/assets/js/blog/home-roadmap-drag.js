(() => {
	const STORAGE_KEY = 'song_home_roadmap_summary_position_v1';

	function readSavedPosition() {
		try {
			const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
			if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return { x: 0, y: 0 };
			return { x: value.x, y: value.y };
		} catch {
			return { x: 0, y: 0 };
		}
	}

	function savePosition(position) {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
		} catch {
			// Ignore storage failures; dragging should still work for the current page.
		}
	}

	function applyPosition(card, position) {
		card.style.setProperty('--roadmap-x', `${Math.round(position.x)}px`);
		card.style.setProperty('--roadmap-y', `${Math.round(position.y)}px`);
	}

	function initialize() {
		const card = document.getElementById('home-roadmap-summary');
		if (!(card instanceof HTMLElement)) return;

		let position = readSavedPosition();
		let dragging = false;
		let pointerId = null;
		let startPointerX = 0;
		let startPointerY = 0;
		let startPosition = { ...position };
		let baseRect = null;
		applyPosition(card, position);

		card.title = document.body.dataset.blogLanguage === 'ko'
			? '드래그해서 위치를 옮길 수 있습니다. 더블클릭하면 원래 위치로 돌아갑니다.'
			: 'ドラッグして移動できます。ダブルクリックで元の位置に戻ります。';

		function clampPosition(next) {
			if (!baseRect) return next;
			const margin = 10;
			const topLimit = 68;
			const minX = margin - baseRect.left;
			const maxX = window.innerWidth - margin - baseRect.right;
			const minY = topLimit - baseRect.top;
			const maxY = window.innerHeight - margin - baseRect.bottom;
			return {
				x: Math.min(maxX, Math.max(minX, next.x)),
				y: Math.min(maxY, Math.max(minY, next.y)),
			};
		}

		card.addEventListener('pointerdown', (event) => {
			if (event.button !== 0 || window.matchMedia('(max-width: 840px)').matches) return;
			dragging = true;
			pointerId = event.pointerId;
			startPointerX = event.clientX;
			startPointerY = event.clientY;
			startPosition = { ...position };
			const rect = card.getBoundingClientRect();
			baseRect = {
				left: rect.left - position.x,
				right: rect.right - position.x,
				top: rect.top - position.y,
				bottom: rect.bottom - position.y,
			};
			card.classList.add('is-dragging');
			card.setPointerCapture?.(pointerId);
			event.preventDefault();
		});

		card.addEventListener('pointermove', (event) => {
			if (!dragging || event.pointerId !== pointerId) return;
			position = clampPosition({
				x: startPosition.x + event.clientX - startPointerX,
				y: startPosition.y + event.clientY - startPointerY,
			});
			applyPosition(card, position);
		});

		function finishDrag(event) {
			if (!dragging || event.pointerId !== pointerId) return;
			dragging = false;
			card.classList.remove('is-dragging');
			card.releasePointerCapture?.(pointerId);
			pointerId = null;
			savePosition(position);
		}

		card.addEventListener('pointerup', finishDrag);
		card.addEventListener('pointercancel', finishDrag);

		card.addEventListener('dblclick', () => {
			position = { x: 0, y: 0 };
			applyPosition(card, position);
			savePosition(position);
		});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
