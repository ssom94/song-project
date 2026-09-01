(() => {
	const STORAGE_KEY = 'song_home_roadmap_summary_position_v1';
	const INITIAL_VELOCITY = { x: -18, y: 10 };
	const EDGE_MARGIN = 10;

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
			// Ignore storage failures; dragging still works for the current page.
		}
	}

	function applyPosition(card, position) {
		card.style.setProperty('--roadmap-x', `${Math.round(position.x * 10) / 10}px`);
		card.style.setProperty('--roadmap-y', `${Math.round(position.y * 10) / 10}px`);
	}

	function initialize() {
		const card = document.getElementById('home-roadmap-summary');
		const heading = document.querySelector('.home-dashboard-heading');
		if (!(card instanceof HTMLElement) || !(heading instanceof HTMLElement)) return;

		let position = readSavedPosition();
		let velocity = { ...INITIAL_VELOCITY };
		let dragging = false;
		let pointerId = null;
		let startPointerX = 0;
		let startPointerY = 0;
		let startPosition = { ...position };
		let baseRect = null;
		let lastFrameTime = performance.now();
		let animationFrameId = 0;

		applyPosition(card, position);

		card.title = document.body.dataset.blogLanguage === 'ko'
			? '천천히 이동하며 경계에 닿으면 반사됩니다. 드래그로 옮길 수 있고 더블클릭하면 초기 위치로 돌아갑니다.'
			: 'ゆっくり移動し、端に当たると反射します。ドラッグで移動でき、ダブルクリックで初期位置に戻ります。';

		function measureBaseRect() {
			const rect = card.getBoundingClientRect();
			baseRect = {
				left: rect.left - position.x,
				right: rect.right - position.x,
				top: rect.top - position.y,
				bottom: rect.bottom - position.y,
				width: rect.width,
				height: rect.height,
			};
		}

		function movementBounds() {
			if (!baseRect) measureBaseRect();
			const headingRect = heading.getBoundingClientRect();
			const textBlock = heading.firstElementChild instanceof HTMLElement
				? heading.firstElementChild.getBoundingClientRect()
				: headingRect;

			const arenaLeft = Math.min(
				headingRect.right - baseRect.width - EDGE_MARGIN,
				Math.max(textBlock.right + 24, headingRect.left + headingRect.width * 0.48),
			);
			const arenaRight = headingRect.right - EDGE_MARGIN;
			const arenaTop = Math.max(68 + EDGE_MARGIN, headingRect.top - 12);
			const arenaBottom = headingRect.bottom + 22;

			return {
				minX: arenaLeft - baseRect.left,
				maxX: arenaRight - baseRect.right,
				minY: arenaTop - baseRect.top,
				maxY: arenaBottom - baseRect.bottom,
			};
		}

		function clampToBounds(next, bounds) {
			return {
				x: Math.min(bounds.maxX, Math.max(bounds.minX, next.x)),
				y: Math.min(bounds.maxY, Math.max(bounds.minY, next.y)),
			};
		}

		function tick(now) {
			const elapsed = Math.min(0.05, Math.max(0, (now - lastFrameTime) / 1000));
			lastFrameTime = now;

			if (!dragging && !window.matchMedia('(max-width: 840px)').matches) {
				const bounds = movementBounds();
				let nextX = position.x + velocity.x * elapsed;
				let nextY = position.y + velocity.y * elapsed;

				if (nextX <= bounds.minX) {
					nextX = bounds.minX;
					velocity.x = Math.abs(velocity.x);
				} else if (nextX >= bounds.maxX) {
					nextX = bounds.maxX;
					velocity.x = -Math.abs(velocity.x);
				}

				if (nextY <= bounds.minY) {
					nextY = bounds.minY;
					velocity.y = Math.abs(velocity.y);
				} else if (nextY >= bounds.maxY) {
					nextY = bounds.maxY;
					velocity.y = -Math.abs(velocity.y);
				}

				position = { x: nextX, y: nextY };
				applyPosition(card, position);
			}

			animationFrameId = requestAnimationFrame(tick);
		}

		card.addEventListener('pointerdown', (event) => {
			if (event.button !== 0 || window.matchMedia('(max-width: 840px)').matches) return;
			dragging = true;
			pointerId = event.pointerId;
			startPointerX = event.clientX;
			startPointerY = event.clientY;
			startPosition = { ...position };
			measureBaseRect();
			card.classList.add('is-dragging');
			card.setPointerCapture?.(pointerId);
			event.preventDefault();
		});

		card.addEventListener('pointermove', (event) => {
			if (!dragging || event.pointerId !== pointerId) return;
			const bounds = movementBounds();
			position = clampToBounds({
				x: startPosition.x + event.clientX - startPointerX,
				y: startPosition.y + event.clientY - startPointerY,
			}, bounds);
			applyPosition(card, position);
		});

		function finishDrag(event) {
			if (!dragging || event.pointerId !== pointerId) return;
			dragging = false;
			card.classList.remove('is-dragging');
			card.releasePointerCapture?.(pointerId);
			pointerId = null;
			lastFrameTime = performance.now();
			savePosition(position);
		}

		card.addEventListener('pointerup', finishDrag);
		card.addEventListener('pointercancel', finishDrag);

		card.addEventListener('dblclick', () => {
			position = { x: 0, y: 0 };
			velocity = { ...INITIAL_VELOCITY };
			measureBaseRect();
			position = clampToBounds(position, movementBounds());
			applyPosition(card, position);
			savePosition(position);
		});

		window.addEventListener('resize', () => {
			if (window.matchMedia('(max-width: 840px)').matches) {
				position = { x: 0, y: 0 };
				applyPosition(card, position);
				return;
			}
			measureBaseRect();
			position = clampToBounds(position, movementBounds());
			applyPosition(card, position);
		});

		animationFrameId = requestAnimationFrame(tick);
		window.addEventListener('pagehide', () => cancelAnimationFrame(animationFrameId), { once: true });
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();

if (!document.querySelector('script[data-home-countdown-manager]')) {
	const script = document.createElement('script');
	script.src = '/assets/js/blog/home-countdown.js';
	script.dataset.homeCountdownManager = 'true';
	document.body.appendChild(script);
}

if (!window.SongActionNotice && !document.querySelector('script[data-song-action-notice]')) {
	const script = document.createElement('script');
	script.src = '/assets/js/action-notice.js';
	script.async = false;
	script.dataset.songActionNotice = 'true';
	document.body.appendChild(script);
}

if (!document.querySelector('script[data-jlpt-today-float]')) {
	const script = document.createElement('script');
	script.src = '/assets/js/japanese/today-study-float.js';
	script.dataset.jlptTodayFloat = 'true';
	document.body.appendChild(script);
}

if (!document.querySelector('script[data-home-today-study]')) {
	const script = document.createElement('script');
	script.src = '/assets/js/blog/home-today-study.js?v=20260901-1';
	script.dataset.homeTodayStudy = 'true';
	document.body.appendChild(script);
}
