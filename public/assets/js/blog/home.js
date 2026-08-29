(() => {
	const STORAGE_KEY = 'song_public_language';
	let language = localStorage.getItem(STORAGE_KEY) === 'ko' ? 'ko' : 'ja';
	let postsRequestId = 0;

	const copy = {
		ja: {
			sidebarMenu: 'Menu', sidebarBoards: 'Boards', sidebarQuick: 'Quick',
			navHome: 'Home', navPosts: '投稿', navJapanese: '日本語学習', navSkillSheet: 'Skill Sheet', navCareer: 'Career History',
			categoriesEmpty: '公開されたカテゴリーはまだありません。', quickGoals: '2029 Goals', quickDday: 'D-Day', quickJlpt: 'JLPT Progress',
			dashboardTitle: '学習と開発の記録', dashboardLead: 'ブログ、資格、JLPT、ポートフォリオの進捗を一つの画面で確認します。',
			roadmapLabel: '2029年までの目標', roadmapHint: '達成状況は今後、管理画面から更新します。',
			latestTitle: '最新の投稿', allPosts: 'すべて見る →', postsLoading: '投稿を読み込んでいます…', postsEmpty: '公開中の投稿はまだありません。', postsError: '投稿を読み込めませんでした。',
			dateNotSet: '日付未設定', jlptTitle: '2,500語 暗記プロジェクト', notStarted: '未開始', complete: '達成', wordsUnit: '語',
			todayWords: '今日', totalWords: '累計', remainingWords: '残り', wrongWords: '誤答', weeklyStudy: '今週の学習量', waitingData: 'データ待ち',
			goalsTitle: '2029年までに達成する目標', goalJlptDetail: '2,500語 + 試験合格', goalApDetail: '応用情報技術者試験', goalFpDetail: '級・受験日は後で設定',
			portfolioGoal: 'Portfolio × 2', goalPortfolioDetail: '2つのポートフォリオを完成', progress: '進捗', planned: '予定', inProgress: '進行予定',
			pageDescription: 'Web/Application Engineer SONG のポートフォリオ、技術ブログ、学習目標をまとめたダッシュボードです。',
		},
		ko: {
			sidebarMenu: '메뉴', sidebarBoards: '게시판', sidebarQuick: '바로가기',
			navHome: '홈', navPosts: '전체 게시글', navJapanese: '일본어 학습', navSkillSheet: '스킬시트', navCareer: '경력',
			categoriesEmpty: '아직 공개된 카테고리가 없습니다.', quickGoals: '2029 목표', quickDday: 'D-Day', quickJlpt: 'JLPT 진행률',
			dashboardTitle: '학습과 개발 기록', dashboardLead: '블로그, 자격증, JLPT, 포트폴리오 진행 상황을 한 화면에서 확인합니다.',
			roadmapLabel: '2029년까지의 목표', roadmapHint: '달성 현황은 추후 관리자 화면에서 갱신합니다.',
			latestTitle: '최근 게시글', allPosts: '전체 보기 →', postsLoading: '게시글을 불러오는 중…', postsEmpty: '아직 공개된 게시글이 없습니다.', postsError: '게시글을 불러오지 못했습니다.',
			dateNotSet: '날짜 미설정', jlptTitle: '2,500단어 암기 프로젝트', notStarted: '시작 전', complete: '달성', wordsUnit: '단어',
			todayWords: '오늘', totalWords: '누적', remainingWords: '남은 단어', wrongWords: '오답', weeklyStudy: '이번 주 학습량', waitingData: '데이터 대기',
			goalsTitle: '2029년까지 달성할 목표', goalJlptDetail: '2,500단어 + 시험 합격', goalApDetail: '응용정보기술자시험', goalFpDetail: '급수·시험일은 추후 설정',
			portfolioGoal: '포트폴리오 × 2', goalPortfolioDetail: '포트폴리오 2개 완성', progress: '진행률', planned: '예정', inProgress: '진행 예정',
			pageDescription: 'Web/Application Engineer SONG의 포트폴리오, 기술 블로그, 학습 목표를 정리한 대시보드입니다.',
		},
	};

	function text(key) {
		return copy[language]?.[key] ?? copy.ja[key] ?? key;
	}

	function formatDate(value) {
		if (!value) return '';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return new Intl.DateTimeFormat(language === 'ko' ? 'ko-KR' : 'ja-JP', {
			year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tokyo',
		}).format(date);
	}

	function createChip(value, category = false) {
		const chip = document.createElement('span');
		chip.className = `blog-chip${category ? ' blog-chip-category' : ''}`;
		chip.textContent = value;
		return chip;
	}

	function renderPost(post) {
		const card = document.createElement('a');
		card.className = 'blog-post-card';
		card.href = `/${language}/posts/${encodeURIComponent(post.slug)}`;

		const meta = document.createElement('div');
		meta.className = 'blog-post-card-meta';
		const formattedDate = formatDate(post.publishedAt ?? post.updatedAt);
		if (formattedDate) {
			const time = document.createElement('time');
			time.dateTime = post.publishedAt ?? post.updatedAt ?? '';
			time.textContent = formattedDate;
			meta.appendChild(time);
		}

		const title = document.createElement('h3');
		title.className = 'blog-post-card-title';
		title.textContent = post.title ?? '';
		card.append(meta, title);

		if (post.excerpt) {
			const excerpt = document.createElement('p');
			excerpt.className = 'blog-post-card-excerpt';
			excerpt.textContent = post.excerpt;
			card.appendChild(excerpt);
		}

		const taxonomy = document.createElement('div');
		taxonomy.className = 'blog-post-card-taxonomy';
		if (post.category) taxonomy.appendChild(createChip(post.category, true));
		for (const tag of Array.isArray(post.tags) ? post.tags.slice(0, 3) : []) taxonomy.appendChild(createChip(tag));
		if (taxonomy.childElementCount > 0) card.appendChild(taxonomy);
		return card;
	}

	function applyStaticCopy() {
		document.documentElement.lang = language;
		document.body.dataset.blogLanguage = language;
		document.querySelectorAll('[data-home-text]').forEach((element) => {
			const key = element.dataset.homeText;
			if (key) element.textContent = text(key);
		});
		document.querySelectorAll('[data-home-language]').forEach((button) => {
			const active = button.dataset.homeLanguage === language;
			button.classList.toggle('is-active', active);
			button.setAttribute('aria-pressed', String(active));
		});
		for (const id of ['home-posts-nav', 'home-all-posts-link']) {
			const link = document.getElementById(id);
			if (link instanceof HTMLAnchorElement) link.href = `/${language}/posts/`;
		}
		const description = document.querySelector('meta[name="description"]');
		if (description) description.setAttribute('content', text('pageDescription'));
	}

	function setPostState(state) {
		for (const [id, target] of [['home-posts-loading', 'loading'], ['home-posts-empty', 'empty'], ['home-posts-error', 'error']]) {
			const node = document.getElementById(id);
			if (node) node.hidden = state !== target;
		}
	}

	async function loadDashboardPosts() {
		const list = document.getElementById('home-latest-posts');
		if (!list) return;
		const requestId = ++postsRequestId;
		list.replaceChildren();
		setPostState('loading');
		try {
			const response = await fetch(`/api/public/posts?lang=${language}`, { method: 'GET', cache: 'no-store' });
			const result = await response.json().catch(() => null);
			if (requestId !== postsRequestId) return;
			if (!response.ok || !result?.ok || !Array.isArray(result.posts)) throw new Error('Invalid public post list response');

			window.BlogDashboard?.renderCategories?.(result.posts, language);
			const recent = result.posts.slice(0, 4);
			if (recent.length === 0) {
				setPostState('empty');
				return;
			}
			const fragment = document.createDocumentFragment();
			for (const post of recent) fragment.appendChild(renderPost(post));
			list.appendChild(fragment);
			setPostState('ready');
		} catch (error) {
			if (requestId !== postsRequestId) return;
			console.error('Failed to load home dashboard posts', error);
			setPostState('error');
		}
	}

	function setLanguage(nextLanguage) {
		if (nextLanguage !== 'ja' && nextLanguage !== 'ko') return;
		language = nextLanguage;
		localStorage.setItem(STORAGE_KEY, language);
		applyStaticCopy();
		loadDashboardPosts();
	}

	function initialize() {
		document.querySelectorAll('[data-home-language]').forEach((button) => {
			button.addEventListener('click', () => setLanguage(button.dataset.homeLanguage));
		});
		applyStaticCopy();
		loadDashboardPosts();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
