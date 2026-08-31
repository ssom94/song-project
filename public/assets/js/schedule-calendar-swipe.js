(() => {
	const GRID_SELECTOR = '.schedule-calendar-panel > .schedule-calendar-grid:not([data-swipe-enhanced])';
	const SNAP_MS = 230;

	function parseDate(value) {
		if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
		const date = new Date(`${value}T00:00:00Z`);
		return Number.isNaN(date.getTime()) ? null : date;
	}

	function dateKey(date) {
		return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
	}

	function addMonth(date, delta) {
		return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
	}

	function currentMonthFromGrid(grid) {
		const currentDay = grid.querySelector('.schedule-calendar-day:not(.is-outside)[data-date]');
		const date = parseDate(currentDay?.dataset?.date);
		return date ? new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)) : null;
	}

	function todayKeyFromGrid(grid) {
		return grid.querySelector('.schedule-calendar-day.is-today[data-date]')?.dataset?.date || '';
	}

	function buildPreviewGrid(monthDate, todayKey) {
		const grid = document.createElement('div');
		grid.className = 'schedule-calendar-grid schedule-calendar-grid-preview';
		grid.dataset.swipePreview = 'true';
		grid.setAttribute('aria-hidden', 'true');

		const year = monthDate.getUTCFullYear();
		const month = monthDate.getUTCMonth();
		const first = new Date(Date.UTC(year, month, 1));
		const start = new Date(Date.UTC(year, month, 1 - first.getUTCDay()));

		for (let index = 0; index < 42; index += 1) {
			const date = new Date(start.getTime() + index * 86400000);
			const key = dateKey(date);
			const outside = date.getUTCMonth() !== month;
			const day = document.createElement('div');
			day.className = `schedule-calendar-day${outside ? ' is-outside' : ''}${key === todayKey ? ' is-today' : ''}`;
			day.dataset.date = key;

			const number = document.createElement('span');
			number.className = 'schedule-calendar-date';
			number.textContent = String(date.getUTCDate());
			day.appendChild(number);

			const hint = document.createElement('span');
			hint.className = 'schedule-calendar-preview-hint';
			day.appendChild(hint);
			grid.appendChild(day);
		}
		return grid;
	}

	function makeSlide(grid, kind) {
		const slide = document.createElement('div');
		slide.className = `schedule-calendar-swipe-slide is-${kind}`;
		slide.appendChild(grid);
		return slide;
	}

	function navButton(panel, direction) {
		const buttons = [...panel.querySelectorAll('.schedule-calendar-controls .schedule-calendar-nav')];
		return direction < 0 ? buttons[0] : buttons[buttons.length - 1];
	}

	function enhanceGrid(grid) {
		if (!(grid instanceof HTMLElement) || grid.dataset.swipeEnhanced === 'true') return;
		const panel = grid.parentElement;
		if (!(panel instanceof HTMLElement) || !panel.classList.contains('schedule-calendar-panel')) return;
		const month = currentMonthFromGrid(grid);
		if (!month) return;

		grid.dataset.swipeEnhanced = 'true';
		const todayKey = todayKeyFromGrid(grid);
		const previousGrid = buildPreviewGrid(addMonth(month, -1), todayKey);
		const nextGrid = buildPreviewGrid(addMonth(month, 1), todayKey);

		const viewport = document.createElement('div');
		viewport.className = 'schedule-calendar-swipe-viewport';
		const track = document.createElement('div');
		track.className = 'schedule-calendar-swipe-track';
		track.append(
			makeSlide(previousGrid, 'previous'),
			makeSlide(grid, 'current'),
			makeSlide(nextGrid, 'next'),
		);
		viewport.appendChild(track);
		panel.appendChild(viewport);

		let pointerId = null;
		let startX = 0;
		let startY = 0;
		let lastX = 0;
		let lastY = 0;
		let horizontal = false;
		let vertical = false;
		let moved = false;
		let suppressClick = false;
		let animating = false;

		function transform(dx, animate = false) {
			track.classList.toggle('is-animating', animate);
			track.style.transform = `translate3d(calc(-33.333333% + ${dx}px), 0, 0)`;
		}

		function resetPointer() {
			pointerId = null;
			horizontal = false;
			vertical = false;
			moved = false;
			viewport.classList.remove('is-dragging');
			grid.classList.remove('is-dragging');
		}

		function settle(direction) {
			if (animating) return;
			animating = true;
			const width = Math.max(1, viewport.clientWidth);
			transform(direction < 0 ? width : -width, true);
			window.setTimeout(() => {
				const button = navButton(panel, direction);
				if (button instanceof HTMLButtonElement) button.click();
				animating = false;
			}, SNAP_MS);
		}

		function bounceBack() {
			transform(0, true);
			window.setTimeout(() => track.classList.remove('is-animating'), SNAP_MS);
		}

		viewport.addEventListener('pointerdown', (event) => {
			if (animating) return;
			if (event.pointerType === 'mouse' && event.button !== 0) return;
			pointerId = event.pointerId;
			startX = lastX = event.clientX;
			startY = lastY = event.clientY;
			horizontal = false;
			vertical = false;
			moved = false;
			track.classList.remove('is-animating');
		}, true);

		viewport.addEventListener('pointermove', (event) => {
			if (event.pointerId !== pointerId || animating) return;
			lastX = event.clientX;
			lastY = event.clientY;
			const dx = lastX - startX;
			const dy = lastY - startY;

			if (!horizontal && !vertical && (Math.abs(dx) > 7 || Math.abs(dy) > 7)) {
				if (Math.abs(dx) > Math.abs(dy) * 1.08) horizontal = true;
				else if (Math.abs(dy) > Math.abs(dx)) vertical = true;
			}
			if (!horizontal) return;

			moved = moved || Math.abs(dx) > 10;
			viewport.classList.add('is-dragging');
			grid.classList.add('is-dragging');
			if (event.cancelable) event.preventDefault();
			const width = Math.max(1, viewport.clientWidth);
			transform(Math.max(-width, Math.min(width, dx)), false);
		}, { capture: true, passive: false });

		viewport.addEventListener('pointerup', (event) => {
			if (event.pointerId !== pointerId || animating) return;
			lastX = event.clientX;
			lastY = event.clientY;
			const dx = lastX - startX;
			const dy = lastY - startY;
			const wasHorizontal = horizontal || (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.08);

			if (!wasHorizontal) {
				resetPointer();
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			suppressClick = moved || Math.abs(dx) > 10;
			const width = Math.max(1, viewport.clientWidth);
			const threshold = Math.min(92, Math.max(56, width * 0.17));
			const qualifies = Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 1.08;
			resetPointer();

			if (qualifies) settle(dx > 0 ? -1 : 1);
			else bounceBack();
			window.setTimeout(() => { suppressClick = false; }, SNAP_MS + 80);
		}, true);

		viewport.addEventListener('pointercancel', (event) => {
			if (event.pointerId !== pointerId) return;
			const shouldBounce = horizontal;
			resetPointer();
			if (shouldBounce) bounceBack();
		}, true);

		viewport.addEventListener('click', (event) => {
			if (!suppressClick) return;
			event.preventDefault();
			event.stopImmediatePropagation();
		}, true);
	}

	function enhanceAll() {
		document.querySelectorAll(GRID_SELECTOR).forEach(enhanceGrid);
	}

	let queued = false;
	const observer = new MutationObserver(() => {
		if (queued) return;
		queued = true;
		queueMicrotask(() => {
			queued = false;
			enhanceAll();
		});
	});

	function initialize() {
		enhanceAll();
		observer.observe(document.body, { childList: true, subtree: true });
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();

(() => {
	const STYLE_ID = 'schedule-list-add-compact-style';

	function installStyle() {
		if (document.getElementById(STYLE_ID)) return;
		const style = document.createElement('style');
		style.id = STYLE_ID;
		style.textContent = `
			.schedule-list-head .schedule-manager-add.schedule-list-add-compact {
				width: 31px;
				height: 31px;
				min-height: 31px;
				padding: 0;
				margin-right: 2px;
				border: 1px solid #d8e2f0;
				border-radius: 9px;
				background: #fff;
				box-shadow: none;
				color: #1f56d8;
				font-size: 20px;
				font-weight: 500;
				line-height: 1;
			}
			.schedule-list-head .schedule-manager-add.schedule-list-add-compact:hover {
				border-color: #9fb6dd;
				background: #f3f6ff;
				color: #1849bd;
			}
			.schedule-manager-actions:empty { display: none !important; }
		`;
		document.head.appendChild(style);
	}

	function compactButton(manager) {
		const header = manager.querySelector('.schedule-list-head');
		const button = manager.querySelector('.schedule-manager-add');
		if (!(header instanceof HTMLElement) || !(button instanceof HTMLButtonElement)) return;

		if (!button.dataset.compactAddLabel) {
			button.dataset.compactAddLabel = button.textContent?.trim() || 'Add schedule';
		}
		const label = button.dataset.compactAddLabel.replace(/^\+\s*/, '');

		if (button.textContent?.trim() !== '+') button.textContent = '+';
		if (button.title !== label) button.title = label;
		if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
		if (!button.classList.contains('schedule-list-add-compact')) button.classList.add('schedule-list-add-compact');
		if (button.parentElement !== header) header.appendChild(button);

		const actions = manager.querySelector('.schedule-manager-actions');
		if (actions instanceof HTMLElement && actions.childElementCount === 0) actions.remove();
	}

	function compactAll() {
		document.querySelectorAll('[data-schedule-manager]').forEach((manager) => {
			if (manager instanceof HTMLElement) compactButton(manager);
		});
	}

	let queued = false;
	const observer = new MutationObserver(() => {
		if (queued) return;
		queued = true;
		queueMicrotask(() => {
			queued = false;
			compactAll();
		});
	});

	function initialize() {
		installStyle();
		compactAll();
		observer.observe(document.body, { childList: true, subtree: true });
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();

(() => {
	if (document.querySelector('script[data-schedule-calendar-local-info]')) return;
	const script = document.createElement('script');
	script.src = '/assets/js/schedule-calendar-local-info.js?v=20260831-2';
	script.async = true;
	script.dataset.scheduleCalendarLocalInfo = 'true';
	document.head.appendChild(script);
})();
