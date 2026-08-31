(() => {
	const PRESET_LAYERS = {
		'soft-blue': 'linear-gradient(145deg, #eef6ff 0%, #f8fbff 48%, #edf2ff 100%)',
		mint: 'linear-gradient(145deg, #eefbf7 0%, #f8fffc 48%, #e8f8f3 100%)',
		lavender: 'linear-gradient(145deg, #f4f0ff 0%, #fbf9ff 50%, #eee9ff 100%)',
		sunset: 'linear-gradient(145deg, #fff1e8 0%, #fff8f2 48%, #f4eaff 100%)',
		night: 'linear-gradient(145deg, #18243c 0%, #263957 52%, #172138 100%)',
		'song-main': "url('/assets/images/main_bg.png')",
		couple: "url('/assets/images/main_couple_bg.png')",
		'learning-flags': "url('/assets/images/learning-flags-bg.svg')",
	};

	function ensureStyles() {
		for (const [href, attr] of [
			['/assets/css/blog/site-cursor.css?v=20260831-2', 'data-song-site-cursor-style'],
			['/assets/css/blog/site-visuals.css?v=20260831-2', 'data-song-site-visuals-style'],
		]) {
			if (document.querySelector(`link[${attr}]`)) continue;
			const link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = href;
			link.setAttribute(attr, 'true');
			document.head.appendChild(link);
		}
	}

	function applyCursor(cursor) {
		const root = document.documentElement;
		const enabled = cursor?.enabled === true && window.matchMedia?.('(pointer: fine)').matches;
		const theme = ['blue', 'navy', 'mint'].includes(cursor?.theme) ? cursor.theme : 'blue';
		root.classList.toggle('song-custom-cursor', enabled);
		root.dataset.songCursorTheme = theme;
	}

	function overlayAlpha(background) {
		const raw = Number(background?.overlay ?? 12);
		const percent = Number.isFinite(raw) ? Math.max(0, Math.min(80, raw)) : 12;
		return percent / 100;
	}

	function withOverlay(layer, alpha) {
		if (alpha <= 0) return layer;
		return `linear-gradient(rgba(255,255,255,${alpha}), rgba(255,255,255,${alpha})), ${layer}`;
	}

	function backgroundSize(background) {
		const mode = ['cover', 'contain', 'custom'].includes(background?.sizeMode) ? background.sizeMode : 'cover';
		if (mode === 'contain') return 'contain';
		if (mode === 'custom') {
			const scale = Math.max(50, Math.min(250, Number(background?.scale) || 100));
			return `${scale}% auto`;
		}
		return 'cover';
	}

	function applyBackground(background) {
		const root = document.documentElement;
		root.classList.remove('song-site-background-custom');
		delete root.dataset.songBackgroundPreset;
		for (const prop of [
			'--song-site-background-layer', '--song-site-background-overlay', '--song-site-background-size',
			'--song-site-background-position-x', '--song-site-background-position-y',
		]) root.style.removeProperty(prop);

		const kind = background?.kind;
		if (!kind || kind === 'default') return;
		const alpha = overlayAlpha(background);
		root.style.setProperty('--song-site-background-overlay', String(alpha));
		root.style.setProperty('--song-site-background-size', backgroundSize(background));
		root.style.setProperty('--song-site-background-position-x', `${Math.max(0, Math.min(100, Number(background?.positionX) || 50))}%`);
		root.style.setProperty('--song-site-background-position-y', `${Math.max(0, Math.min(100, Number(background?.positionY) || 50))}%`);

		let layer = '';
		if (kind === 'solid' && /^#[0-9a-f]{6}$/i.test(String(background?.value || ''))) {
			layer = String(background.value);
		} else if (kind === 'preset') {
			const preset = String(background?.value || '');
			if (preset === 'paper-grid') {
				root.dataset.songBackgroundPreset = 'paper-grid';
				layer = '#f7f9ff';
			} else if (PRESET_LAYERS[preset]) {
				root.dataset.songBackgroundPreset = preset;
				layer = withOverlay(PRESET_LAYERS[preset], alpha);
			}
		} else if (kind === 'image' && typeof background?.imageUrl === 'string' && background.imageUrl.startsWith('/api/public/site-background?')) {
			layer = withOverlay(`url('${background.imageUrl.replace(/'/g, '%27')}')`, alpha);
		}

		if (!layer) return;
		root.style.setProperty('--song-site-background-layer', layer);
		root.classList.add('song-site-background-custom');
	}

	async function initialize() {
		ensureStyles();
		try {
			const response = await fetch('/api/public/site-visuals', { method: 'GET', cache: 'no-store', credentials: 'same-origin' });
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error('SITE_VISUALS_LOAD_FAILED');
			applyCursor(result.cursor);
			applyBackground(result.background);
		} catch (error) {
			console.warn('Failed to load site visual settings', error);
			applyCursor({ enabled: false, theme: 'blue' });
			applyBackground({ kind: 'default' });
		}
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
