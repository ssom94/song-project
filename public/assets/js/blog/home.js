(() => {
	const STORAGE_KEY = 'song_public_language';
	let language = localStorage.getItem(STORAGE_KEY) === 'ko' ? 'ko' : 'ja';
	let postsRequestId = 0;

	const copy = {
		ja: {
			navHome: 'Home',
			navPosts: '投稿',
			navJapanese: 'Japanese',
			navSkillSheet: 'Skill Sheet',
			navCareer: 'Career History',
			heroTitle: 'Web Application Engineer',
			heroLead: 'Webアプリケーションの設計・実装・運用で得た知識と、学習の記録をまとめています。',
			viewPosts: '投稿を見る',
			viewProfile: 'プロフィール',
			profileStatus: 'Web / Application Engineer',
			profileSummary: 'フロントエンドからバックエンド、DB・運用まで、業務システム開発を中心に経験を積んでいます。',
			aboutTitle: '作るだけで終わらない開発を。',
			aboutBody: '画面実装、API連携、データベース、運用・障害対応までをつなげて考え、使う人と運用する人の両方にとって扱いやすいシステムを目指しています。',
			portfolioTitle: 'コンテンツ',
			portfolioDescription: '技術・学習・経歴を目的別に整理していきます。',
			japaneseTitle: '日本語学習',
			japaneseDescription: '語彙・例文・JLPT学習記録を整理する学習モジュールです。',
			skillTitle: 'Skill Sheet',
			skillDescription: '技術スタックと担当工程を見やすくまとめるスキルシートです。',
			careerTitle: 'Career History',
			careerDescription: 'プロジェクト経験と担当内容を時系列で整理する職務経歴ページです。',
			comingSoon: '準備中',
			latestTitle: '最新の投稿',
			allPosts: 'すべての投稿を見る →',
			postsLoading: '投稿を読み込んでいます…',
			postsEmpty: '公開中の投稿はまだありません。',
			postsError: '投稿を読み込めませんでした。',
			pageDescription: 'Web/Application Engineer SONG のポートフォリオと技術ブログです。',
		},
		ko: {
			navHome: 'Home',
			navPosts: '게시글',
			navJapanese: '일본어 학습',
			navSkillSheet: '스킬시트',
			navCareer: '경력',
			heroTitle: 'Web Application Engineer',
			heroLead: '웹 애플리케이션의 설계·구현·운영 과정에서 얻은 지식과 학습 기록을 정리하고 있습니다.',
			viewPosts: '게시글 보기',
			viewProfile: '프로필',
			profileStatus: '웹 / 애플리케이션 엔지니어',
			profileSummary: '프론트엔드부터 백엔드, DB와 운영까지 업무 시스템 개발을 중심으로 경험을 쌓고 있습니다.',
			aboutTitle: '만드는 것에서 끝나지 않는 개발.',
			aboutBody: '화면 구현, API 연동, 데이터베이스, 운영·장애 대응까지 연결해서 생각하며 사용자와 운영자 모두가 다루기 편한 시스템을 지향합니다.',
			portfolioTitle: '콘텐츠',
			portfolioDescription: '기술·학습·경력을 목적별로 정리해 나갑니다.',
			japaneseTitle: '일본어 학습',
			japaneseDescription: '어휘·예문·JLPT 학습 기록을 정리하는 학습 모듈입니다.',
			skillTitle: 'Skill Sheet',
			skillDescription: '기술 스택과 담당 공정을 보기 쉽게 정리하는 스킬시트입니다.',
			careerTitle: 'Career History',
			careerDescription: '프로젝트 경험과 담당 내용을 시간순으로 정리하는 경력 페이지입니다.',
			comingSoon: '준비 중',
			latestTitle: '최근 게시글',
			allPosts: '전체 게시글 보기 →',
			postsLoading: '게시글을 불러오는 중…',
			postsEmpty: '아직 공개된 게시글이 없습니다.',
			postsError: '게시글을 불러오지 못했습니다.',
			pageDescription: 'Web/Application Engineer SONG의 포트폴리오와 기술 블로그입니다.',
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
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			timeZone: 'Asia/Tokyo',
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
		for (const tag of Array.isArray(post.tags) ? post.tags.slice(0, 5) : []) {
			taxonomy.appendChild(createChip(tag));
		}
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

		for (const id of ['home-posts-nav', 'home-primary-posts-link', 'home-all-posts-link']) {
			const link = document.getElementById(id);
			if (link instanceof HTMLAnchorElement) link.href = `/${language}/posts/`;
		}

		const description = document.querySelector('meta[name="description"]');
		if (description) description.setAttribute('content', text('pageDescription'));
	}

	function setPostState(state) {
		const loading = document.getElementById('home-posts-loading');
		const empty = document.getElementById('home-posts-empty');
		const error = document.getElementById('home-posts-error');
		if (loading) loading.hidden = state !== 'loading';
		if (empty) empty.hidden = state !== 'empty';
		if (error) error.hidden = state !== 'error';
	}

	async function loadLatestPosts() {
		const list = document.getElementById('home-latest-posts');
		if (!list) return;
		const requestId = ++postsRequestId;
		list.replaceChildren();
		setPostState('loading');

		try {
			const response = await fetch(`/api/public/posts?lang=${language}`, {
				method: 'GET',
				cache: 'no-store',
			});
			const result = await response.json().catch(() => null);
			if (requestId !== postsRequestId) return;
			if (!response.ok || !result?.ok || !Array.isArray(result.posts)) {
				throw new Error('Invalid public post list response');
			}

			const posts = result.posts.slice(0, 3);
			if (posts.length === 0) {
				setPostState('empty');
				return;
			}

			const fragment = document.createDocumentFragment();
			for (const post of posts) fragment.appendChild(renderPost(post));
			list.appendChild(fragment);
			setPostState('ready');
		} catch (error) {
			if (requestId !== postsRequestId) return;
			console.error('Failed to load home posts', error);
			setPostState('error');
		}
	}

	function setLanguage(nextLanguage) {
		if (nextLanguage !== 'ja' && nextLanguage !== 'ko') return;
		language = nextLanguage;
		localStorage.setItem(STORAGE_KEY, language);
		applyStaticCopy();
		loadLatestPosts();
	}

	function initialize() {
		document.querySelectorAll('[data-home-language]').forEach((button) => {
			button.addEventListener('click', () => setLanguage(button.dataset.homeLanguage));
		});
		applyStaticCopy();
		loadLatestPosts();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize, { once: true });
	} else {
		initialize();
	}
})();
