(() => {
	const GROUP_LABELS = {
		all: { ko: '전체', ja: 'すべて' },
		it: { ko: 'IT · 개발', ja: 'IT・開発' },
		work: { ko: '현장 · 업무', ja: '現場・業務' },
		daily: { ko: '일상', ja: '日常' },
		people: { ko: '사람', ja: '人物' },
		nature: { ko: '풍경 · 여행', ja: '風景・旅行' },
		country: { ko: '국가', ja: '国・地域' },
	};

	const ITEMS = [
		['folder', 'it', '▱', '폴더', 'フォルダー'],
		['code', 'it', '</>', '코드', 'コード'], ['terminal', 'it', '>_', '터미널', 'ターミナル'],
		['database', 'it', 'DB', '데이터베이스', 'データベース'], ['server', 'it', '▦', '서버', 'サーバー'],
		['cloud', 'it', '☁', '클라우드', 'クラウド'], ['network', 'it', '⌘', '네트워크', 'ネットワーク'],
		['chip', 'it', '▣', '칩', 'チップ'], ['bug', 'it', '※', '버그', 'バグ'],
		['lock', 'it', '⌑', '보안', 'セキュリティ'], ['api', 'it', 'API', 'API', 'API'],
		['git', 'it', '⑂', 'Git', 'Git'], ['monitor', 'it', '▤', '모니터', 'モニター'],
		['briefcase', 'work', '▰', '업무', '仕事'], ['building', 'work', '▥', '회사', '会社'],
		['factory', 'work', '⚙', '현장', '現場'], ['wrench', 'work', '⌕', '정비', '整備'],
		['tools', 'work', '⚒', '도구', 'ツール'], ['clipboard', 'work', '☷', '문서', '書類'],
		['truck', 'work', '▸', '물류', '物流'], ['warehouse', 'work', '⌂', '창고', '倉庫'],
		['chart', 'work', '↗', '분석', '分析'], ['calendar', 'work', '▦', '일정', '予定'],
		['headset', 'work', '◖', '지원', 'サポート'],
		['home', 'daily', '⌂', '집', '家'], ['coffee', 'daily', '♨', '커피', 'コーヒー'],
		['food', 'daily', '♢', '음식', '食事'], ['car', 'daily', '▱', '자동차', '車'],
		['train', 'daily', '▥', '전철', '電車'], ['shopping', 'daily', '□', '쇼핑', '買い物'],
		['book', 'daily', '▤', '책', '本'], ['music', 'daily', '♪', '음악', '音楽'],
		['game', 'daily', '◇', '게임', 'ゲーム'], ['camera', 'daily', '◉', '사진', '写真'],
		['gift', 'daily', '⊞', '선물', 'プレゼント'], ['heart', 'daily', '♥', '마음', 'ハート'],
		['star', 'daily', '★', '즐겨찾기', 'スター'],
		['person', 'people', '●', '사람', '人物'], ['users', 'people', '●●', '사람들', 'グループ'],
		['baby', 'people', '◡', '아이', '子ども'], ['family', 'people', '♙', '가족', '家族'],
		['smile', 'people', '☺', '미소', 'スマイル'], ['student', 'people', '♢', '학생', '学生'],
		['office-person', 'people', '♜', '직장인', '会社員'],
		['sun', 'nature', '☀', '태양', '太陽'], ['moon', 'nature', '☾', '달', '月'],
		['mountain', 'nature', '▲', '산', '山'], ['tree', 'nature', '♣', '나무', '木'],
		['leaf', 'nature', '❧', '잎', '葉'], ['flower', 'nature', '✿', '꽃', '花'],
		['waves', 'nature', '≈', '바다', '海'], ['plane', 'nature', '✈', '비행기', '飛行機'],
		['map', 'nature', '⌘', '지도', '地図'], ['pin', 'nature', '◆', '위치', '場所'],
		['globe', 'nature', '◎', '세계', '世界'],
		['flag-kr', 'country', '🇰🇷', '한국', '韓国'], ['flag-jp', 'country', '🇯🇵', '일본', '日本'],
		['flag-us', 'country', '🇺🇸', '미국', 'アメリカ'], ['flag-cn', 'country', '🇨🇳', '중국', '中国'],
		['flag-gb', 'country', '🇬🇧', '영국', 'イギリス'], ['flag-fr', 'country', '🇫🇷', '프랑스', 'フランス'],
		['flag-de', 'country', '🇩🇪', '독일', 'ドイツ'], ['flag-ca', 'country', '🇨🇦', '캐나다', 'カナダ'],
		['flag-au', 'country', '🇦🇺', '호주', 'オーストラリア'], ['flag-sg', 'country', '🇸🇬', '싱가포르', 'シンガポール'],
	].map(([key, group, glyph, ko, ja]) => ({ key, group, glyph, label: { ko, ja } }));

	const BY_KEY = new Map(ITEMS.map((item) => [item.key, item]));

	function normalizeAppearance(appearance) {
		const value = appearance && typeof appearance === 'object' ? appearance : {};
		const kind = ['preset', 'emoji', 'image', 'none'].includes(value.kind) ? value.kind : 'preset';
		return {
			kind,
			value: typeof value.value === 'string' ? value.value : kind === 'preset' ? 'folder' : '',
			color: /^#[0-9a-f]{6}$/i.test(String(value.color || '')) ? String(value.color) : '#5b6ee1',
			imageUrl: typeof value.imageUrl === 'string' ? value.imageUrl : '',
		};
	}

	function createIcon(appearance, options = {}) {
		const normalized = normalizeAppearance(appearance);
		const icon = document.createElement('span');
		icon.className = `song-category-icon is-${normalized.kind}`;
		if (options.className) icon.classList.add(options.className);
		icon.style.setProperty('--song-category-color', normalized.color);
		icon.setAttribute('aria-hidden', 'true');
		if (normalized.kind === 'none') {
			icon.hidden = true;
			return icon;
		}
		if (normalized.kind === 'image' && normalized.imageUrl) {
			const image = document.createElement('img');
			image.src = normalized.imageUrl;
			image.alt = '';
			image.loading = 'lazy';
			icon.appendChild(image);
			return icon;
		}
		if (normalized.kind === 'emoji') {
			icon.textContent = normalized.value || '✨';
			return icon;
		}
		const item = BY_KEY.get(normalized.value) || BY_KEY.get('folder');
		icon.textContent = item?.glyph || '▱';
		if (item?.group === 'country') icon.classList.add('is-flag');
		if ((item?.glyph || '').length > 2) icon.classList.add('is-wide');
		return icon;
	}

	function hydratePlaceholder(node) {
		if (!(node instanceof HTMLElement) || node.dataset.categoryIconHydrated === 'true') return;
		const appearance = {
			kind: node.dataset.categoryIconKind,
			value: node.dataset.categoryIconValue,
			color: node.dataset.categoryIconColor,
			imageUrl: node.dataset.categoryIconImageUrl,
		};
		const replacement = createIcon(appearance, { className: node.dataset.categoryIconClass || '' });
		node.replaceWith(replacement);
	}

	function hydrate(root = document) {
		root.querySelectorAll?.('[data-category-icon-kind]').forEach(hydratePlaceholder);
	}

	const observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				if (!(node instanceof HTMLElement)) continue;
				if (node.matches('[data-category-icon-kind]')) hydratePlaceholder(node);
				hydrate(node);
			}
		}
	});

	window.SongCategoryIcons = {
		groups: GROUP_LABELS,
		items: ITEMS,
		byKey: BY_KEY,
		createIcon,
		normalizeAppearance,
		hydrate,
	};

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => hydrate(), { once: true });
	else hydrate();
	observer.observe(document.documentElement, { childList: true, subtree: true });
	document.dispatchEvent(new CustomEvent('song:category-icons-ready'));
})();