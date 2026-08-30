(() => {
	const API_CERTIFICATIONS = '/api/public/certifications';
	const AUTOMATIC_ROWS = new Map([
		['JLPT N1', { slug: 'jlpt-n1', rolling: false }],
		['AP', { slug: 'ap', rolling: false }],
		['FP', { slug: 'fp3', rolling: true }],
		['AWS SAA', { slug: 'aws-saa', rolling: true }],
	]);

	let snapshot = new Map();
	let observer = null;
	let applying = false;

	function language() {
		return document.body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
	}

	function labels() {
		return language() === 'ko'
			? { rollingDate: '상시 일정', rollingValue: '상시', source: '시험 일정' }
			: { rollingDate: '随時受験', rollingValue: '随時', source: '試験日程' };
	}

	function tokyoToday() {
		const parts = new Intl.DateTimeFormat('en-CA', {
			timeZone: 'Asia/Tokyo',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}).formatToParts(new Date());
		const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
		return `${map.year}-${map.month}-${map.day}`;
	}

	function dayDiff(targetDate) {
		if (!targetDate) return null;
		const today = Date.parse(`${tokyoToday()}T00:00:00Z`);
		const target = Date.parse(`${targetDate}T00:00:00Z`);
		if (!Number.isFinite(today) || !Number.isFinite(target)) return null;
		return Math.round((target - today) / 86400000);
	}

	function ddayLabel(targetDate) {
		const diff = dayDiff(targetDate);
		if (diff === null) return '—';
		if (diff === 0) return 'D-Day';
		return diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
	}

	function dateLabel(targetDate) {
		if (!targetDate) return '—';
		const date = new Date(`${targetDate}T00:00:00Z`);
		if (Number.isNaN(date.getTime())) return targetDate;
		return new Intl.DateTimeFormat(language() === 'ko' ? 'ko-KR' : 'ja-JP', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			timeZone: 'UTC',
		}).format(date);
	}

	function nearestSchedule(certification) {
		const today = tokyoToday();
		const schedules = Array.isArray(certification?.schedules) ? certification.schedules : [];
		return schedules
			.filter((schedule) => schedule?.announced !== false)
			.filter((schedule) => {
				const end = schedule?.dateEnd || schedule?.dateStart;
				return typeof end === 'string' && end >= today;
			})
			.sort((a, b) => {
				const dateA = a?.dateStart || a?.dateEnd || '9999-12-31';
				const dateB = b?.dateStart || b?.dateEnd || '9999-12-31';
				return dateA.localeCompare(dateB);
			})[0] || null;
	}

	function buildSnapshot(result) {
		const certs = Array.isArray(result?.certifications) ? result.certifications : [];
		const bySlug = new Map(certs.map((cert) => [String(cert?.slug || ''), cert]));
		const next = new Map();

		for (const [title, rule] of AUTOMATIC_ROWS.entries()) {
			const cert = bySlug.get(rule.slug);
			if (!cert) continue;
			if (rule.rolling) {
				next.set(title, { rolling: true, targetDate: null });
				continue;
			}
			const schedule = nearestSchedule(cert);
			if (!schedule) continue;
			const targetDate = schedule.dateStart || schedule.dateEnd || null;
			if (targetDate) next.set(title, { rolling: false, targetDate });
		}
		return next;
	}

	function ensureSourceBadge(titleLine) {
		if (!(titleLine instanceof HTMLElement)) return;
		let badge = titleLine.querySelector('[data-cert-countdown-source]');
		if (!(badge instanceof HTMLElement)) {
			badge = document.createElement('small');
			badge.dataset.certCountdownSource = 'true';
			badge.className = 'home-dday-source-badge';
			titleLine.appendChild(badge);
		}
		badge.textContent = labels().source;
	}

	function applySnapshot() {
		if (applying || snapshot.size === 0) return;
		const list = document.querySelector('.home-dday-list');
		if (!(list instanceof HTMLElement)) return;
		applying = true;
		try {
			for (const row of list.querySelectorAll('.home-dday-item')) {
				const titleNode = row.querySelector('.home-dday-title-line strong');
				if (!(titleNode instanceof HTMLElement)) continue;
				const info = snapshot.get(titleNode.textContent?.trim() || '');
				if (!info) continue;

				row.classList.add('is-certification-source');
				row.querySelector('.home-dday-admin-actions')?.remove();
				ensureSourceBadge(row.querySelector('.home-dday-title-line'));

				const dateNode = row.querySelector('.home-dday-item-copy > span');
				const valueNode = row.querySelector('.home-dday-value');
				if (info.rolling) {
					if (dateNode instanceof HTMLElement) dateNode.textContent = labels().rollingDate;
					if (valueNode instanceof HTMLElement) valueNode.textContent = labels().rollingValue;
				} else {
					if (dateNode instanceof HTMLElement) dateNode.textContent = dateLabel(info.targetDate);
					if (valueNode instanceof HTMLElement) valueNode.textContent = ddayLabel(info.targetDate);
				}
			}
		} finally {
			applying = false;
		}
	}

	async function load() {
		try {
			const response = await fetch(`${API_CERTIFICATIONS}?lang=${language()}`, {
				credentials: 'same-origin',
				cache: 'no-store',
			});
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error || `HTTP_${response.status}`);
			snapshot = buildSnapshot(result);
			applySnapshot();
		} catch (error) {
			console.warn('Failed to sync certification countdown', error);
		}
	}

	function initialize() {
		const list = document.querySelector('.home-dday-list');
		if (!(list instanceof HTMLElement)) return;
		observer = new MutationObserver(() => window.setTimeout(applySnapshot, 0));
		observer.observe(list, { childList: true, subtree: true });
		load();
		document.querySelectorAll('[data-home-language]').forEach((button) => {
			button.addEventListener('click', () => window.setTimeout(load, 30));
		});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
