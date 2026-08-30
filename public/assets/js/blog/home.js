(() => {
	const STORAGE_KEY = 'song_public_language';
	let language = localStorage.getItem(STORAGE_KEY) === 'ko' ? 'ko' : 'ja';
	let postsRequestId = 0;

	let learningSnapshot = {
		goalMode: 'auto',
		manualTarget: null,
		registeredWords: 0,
		masteredWords: 0,
		uncertainWords: 0,
		unlearnedWords: 0,
		todayWords: 0,
		weekly: [0, 0, 0, 0, 0, 0, 0],
	};

	const copy = {
		ja: {
			sidebarMenu: 'Menu', sidebarBoards: 'Boards', sidebarQuick: 'Quick',
			navHome: 'Home', navPosts: '投稿', navJapanese: '日本語学習', navSkillSheet: 'Skill Sheet', navCareer: 'Career History',
			categoriesEmpty: '公開されたカテゴリーはまだありません。', quickGoals: '2029 Goals', quickDday: 'D-Day', quickJlpt: 'JLPT Progress',
			dashboardTitle: '学習と開発の記録', dashboardLead: 'ブログ、資格、JLPT、ポートフォリオの進捗を一つの画面で確認します。',
			roadmapLabel: '2029年までの目標', roadmapHint: '達成状況は管理画面の設定と学習データから更新します。',
			latestTitle: '最新の投稿', allPosts: 'すべて見る →', postsLoading: '投稿を読み込んでいます…', postsEmpty: '公開中の投稿はまだありません。', postsError: '投稿を読み込めませんでした。',
			dateNotSet: '日付未設定', jlptTitle: '語彙学習の進捗', complete: '習得済み', wordsUnit: '語',
			todayWords: '今日', registeredWords: '登録単語', remainingWords: '習得済み', wrongWords: 'あいまい', weeklyStudy: '今週の学習量', waitingData: 'データ待ち',
			goalSourceAuto: '自動 · 学習状態基準', goalSourceManual: '直接設定', progressing: '学習中',
			goalsTitle: '2029年までに達成する目標', goalJlptDetail: '語彙学習 + 試験合格', goalApDetail: '応用情報技術者試験', goalFpDetail: '級・受験日は後で設定',
			portfolioGoal: 'Portfolio × 2', goalPortfolioDetail: '2つのポートフォリオを完成', progress: '進捗', planned: '予定', inProgress: '進行予定',
			mastered: '習得済み', uncertain: 'あいまい', unlearned: '未習得',
			pageDescription: 'Web/Application Engineer SONG のポートフォリオ、技術ブログ、学習目標をまとめたダッシュボードです。',
		},
		ko: {
			sidebarMenu: '메뉴', sidebarBoards: '게시판', sidebarQuick: '바로가기',
			navHome: '홈', navPosts: '전체 게시글', navJapanese: '일본어 학습', navSkillSheet: '스킬시트', navCareer: '경력',
			categoriesEmpty: '아직 공개된 카테고리가 없습니다.', quickGoals: '2029 목표', quickDday: 'D-Day', quickJlpt: 'JLPT 진행률',
			dashboardTitle: '학습과 개발 기록', dashboardLead: '블로그, 자격증, JLPT, 포트폴리오 진행 상황을 한 화면에서 확인합니다.',
			roadmapLabel: '2029년까지의 목표', roadmapHint: '달성 현황은 관리자 설정과 학습 데이터에서 갱신합니다.',
			latestTitle: '최근 게시글', allPosts: '전체 보기 →', postsLoading: '게시글을 불러오는 중…', postsEmpty: '아직 공개된 게시글이 없습니다.', postsError: '게시글을 불러오지 못했습니다.',
			dateNotSet: '날짜 미설정', jlptTitle: '단어 학습 진행률', complete: '암기 완료', wordsUnit: '단어',
			todayWords: '오늘', registeredWords: '등록 단어', remainingWords: '암기 완료', wrongWords: '애매함', weeklyStudy: '이번 주 학습량', waitingData: '데이터 대기',
			goalSourceAuto: '자동 · 학습상태 기준', goalSourceManual: '직접 설정', progressing: '학습 중',
			goalsTitle: '2029년까지 달성할 목표', goalJlptDetail: '단어 학습 + 시험 합격', goalApDetail: '응용정보기술자시험', goalFpDetail: '급수·시험일은 추후 설정',
			portfolioGoal: '포트폴리오 × 2', goalPortfolioDetail: '포트폴리오 2개 완성', progress: '진행률', planned: '예정', inProgress: '진행 예정',
			mastered: '암기 완료', uncertain: '애매함', unlearned: '미학습',
			pageDescription: 'Web/Application Engineer SONG의 포트폴리오, 기술 블로그, 학습 목표를 정리한 대시보드입니다.',
		},
	};

	function text(key) { return copy[language]?.[key] ?? copy.ja[key] ?? key; }
	function byId(id) { return document.getElementById(id); }
	function number(value) {
		const parsed = Number(value);
		return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
	}
	function formatNumber(value) {
		return new Intl.NumberFormat(language === 'ko' ? 'ko-KR' : 'ja-JP').format(number(value));
	}
	function formatDate(value) {
		if (!value) return '';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return new Intl.DateTimeFormat(language === 'ko' ? 'ko-KR' : 'ja-JP', {
			year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tokyo',
		}).format(date);
	}

	function ensureTitleLink(textKey, route) {
		const heading = document.querySelector(`.home-card-heading h2[data-home-text="${textKey}"]`);
		if (!heading || heading.querySelector('.home-section-title-link')) return;
		heading.removeAttribute('data-home-text');
		const link = document.createElement('a');
		link.className = 'home-section-title-link';
		link.dataset.homeText = textKey;
		link.dataset.homeRoute = route;
		link.textContent = text(textKey);
		heading.replaceChildren(link);
	}

	function ensureTitleLinks() {
		ensureTitleLink('latestTitle', 'posts');
		ensureTitleLink('jlptTitle', 'japanese');
	}

	function syncTitleLinks() {
		const routes = {
			posts: `/${language}/posts/`, japanese: `/${language}/japanese/`,
			skill: `/${language}/skill-sheet/`, career: `/${language}/career/`,
		};
		document.querySelectorAll('[data-home-route]').forEach((link) => {
			if (!(link instanceof HTMLAnchorElement)) return;
			const href = routes[link.dataset.homeRoute];
			if (href) link.href = href;
		});
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

	function calculateLearningProgress(snapshot) {
		const registeredWords = number(snapshot.registeredWords);
		const masteredWords = Math.min(number(snapshot.masteredWords), registeredWords);
		const uncertainWords = Math.min(number(snapshot.uncertainWords), Math.max(0, registeredWords - masteredWords));
		const unlearnedWords = Math.max(0, registeredWords - masteredWords - uncertainWords);
		const percent = registeredWords > 0 ? Math.min(100, Math.round((masteredWords / registeredWords) * 100)) : 0;
		const uncertainPercent = registeredWords > 0 ? Math.min(100 - percent, Math.round((uncertainWords / registeredWords) * 100)) : 0;
		const unlearnedPercent = registeredWords > 0 ? Math.max(0, 100 - percent - uncertainPercent) : 0;
		const manualTarget = number(snapshot.manualTarget);
		const manualMode = snapshot.goalMode === 'manual' && manualTarget > 0;
		const targetWords = manualMode ? manualTarget : registeredWords;
		const goalPercent = targetWords > 0 ? Math.min(100, Math.round((Math.min(masteredWords, targetWords) / targetWords) * 100)) : 0;
		return {
			manualMode, registeredWords, masteredWords, uncertainWords, unlearnedWords,
			percent, uncertainPercent, unlearnedPercent, targetWords, goalPercent,
		};
	}

	function renderWeeklyChart(values) {
		const bars = [...document.querySelectorAll('#home-weekly-chart i')];
		const normalized = Array.from({ length: 7 }, (_, index) => number(Array.isArray(values) ? values[index] : 0));
		const max = Math.max(1, ...normalized);
		bars.forEach((bar, index) => {
			const value = normalized[index] ?? 0;
			const height = value > 0 ? Math.max(10, Math.round((value / max) * 82)) : 4;
			bar.style.setProperty('--home-bar-height', `${height}px`);
			bar.title = `${formatNumber(value)} ${text('wordsUnit')}`;
		});
	}

	function ensureLearningLegend() {
		const wrap = document.querySelector('.home-progress-ring-wrap');
		if (!wrap || byId('home-learning-legend')) return;
		const legend = document.createElement('div');
		legend.id = 'home-learning-legend';
		legend.className = 'home-learning-legend';
		for (const state of ['mastered', 'uncertain', 'unlearned']) {
			const item = document.createElement('div');
			item.dataset.learningLegend = state;
			const dot = document.createElement('i');
			const label = document.createElement('span');
			label.dataset.learningLegendLabel = state;
			const value = document.createElement('b');
			value.dataset.learningLegendValue = state;
			item.append(dot, label, value);
			legend.appendChild(item);
		}
		wrap.appendChild(legend);
	}

	function renderLearningLegend(progress) {
		ensureLearningLegend();
		const values = {
			mastered: [progress.masteredWords, progress.percent],
			uncertain: [progress.uncertainWords, progress.uncertainPercent],
			unlearned: [progress.unlearnedWords, progress.unlearnedPercent],
		};
		for (const [state, [count, percent]] of Object.entries(values)) {
			const label = document.querySelector(`[data-learning-legend-label="${state}"]`);
			const value = document.querySelector(`[data-learning-legend-value="${state}"]`);
			if (label) label.textContent = text(state);
			if (value) value.textContent = `${formatNumber(count)} · ${percent}%`;
		}
	}

	function renderLearningProgress() {
		const progress = calculateLearningProgress(learningSnapshot);
		const todayWords = number(learningSnapshot.todayWords);
		const source = byId('home-jlpt-source');
		const status = byId('home-jlpt-status');
		const ring = byId('home-jlpt-ring');
		if (source) {
			source.textContent = progress.manualMode
				? `${text('goalSourceManual')} · ${formatNumber(progress.targetWords)} ${text('wordsUnit')}`
				: text('goalSourceAuto');
		}
		if (status) status.textContent = progress.registeredWords === 0 ? text('waitingData') : progress.percent >= 100 ? text('complete') : text('progressing');
		if (ring) {
			const masteredDeg = progress.percent * 3.6;
			const uncertainEndDeg = Math.min(360, masteredDeg + progress.uncertainPercent * 3.6);
			ring.style.setProperty('--home-mastered-deg', `${masteredDeg}deg`);
			ring.style.setProperty('--home-uncertain-end-deg', `${uncertainEndDeg}deg`);
		}
		const values = {
			'home-jlpt-percent': `${progress.percent}%`,
			'home-jlpt-learned': formatNumber(progress.masteredWords),
			'home-jlpt-target': formatNumber(progress.registeredWords),
			'home-jlpt-today': formatNumber(todayWords),
			'home-jlpt-total': formatNumber(progress.registeredWords),
			'home-jlpt-remaining': formatNumber(progress.masteredWords),
			'home-jlpt-wrong': formatNumber(progress.uncertainWords),
			'home-goal-jlpt-percent': `${progress.goalPercent}%`,
		};
		for (const [id, value] of Object.entries(values)) {
			const node = byId(id);
			if (node) node.textContent = value;
		}
		const goalProgress = byId('home-goal-jlpt-progress');
		if (goalProgress instanceof HTMLProgressElement) goalProgress.value = progress.goalPercent;
		renderLearningLegend(progress);
		renderWeeklyChart(learningSnapshot.weekly);
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
			const link = byId(id);
			if (link instanceof HTMLAnchorElement) link.href = `/${language}/posts/`;
		}
		syncTitleLinks();
		window.BlogDashboard?.syncHomeModuleLinks?.();
		const description = document.querySelector('meta[name="description"]');
		if (description) description.setAttribute('content', text('pageDescription'));
		renderLearningProgress();
	}

	function setPostState(state) {
		for (const [id, target] of [['home-posts-loading', 'loading'], ['home-posts-empty', 'empty'], ['home-posts-error', 'error']]) {
			const node = byId(id);
			if (node) node.hidden = state !== target;
		}
	}

	async function loadDashboardPosts() {
		const list = byId('home-latest-posts');
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

	async function loadLearningStats() {
		try {
			const response = await fetch('/api/public/japanese/stats', { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok || !result.stats) throw new Error('Invalid Japanese stats response');
			learningSnapshot = {
				...learningSnapshot,
				registeredWords: Number(result.stats.registeredWords ?? 0),
				masteredWords: Number(result.stats.masteredWords ?? 0),
				uncertainWords: Number(result.stats.uncertainWords ?? 0),
				unlearnedWords: Number(result.stats.unlearnedWords ?? 0),
				todayWords: Number(result.stats.todayAttempts ?? 0),
				weekly: Array.isArray(result.stats.weekly) ? result.stats.weekly : learningSnapshot.weekly,
			};
			renderLearningProgress();
		} catch (error) {
			console.warn('Failed to load home Japanese stats', error);
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
		ensureTitleLinks();
		ensureLearningLegend();
		document.querySelectorAll('[data-home-language]').forEach((button) => {
			button.addEventListener('click', () => setLanguage(button.dataset.homeLanguage));
		});
		applyStaticCopy();
		Promise.allSettled([loadDashboardPosts(), loadLearningStats()]);
	}

	window.HomeDashboard = {
		setLearningSnapshot(nextSnapshot) {
			if (!nextSnapshot || typeof nextSnapshot !== 'object') return;
			learningSnapshot = { ...learningSnapshot, ...nextSnapshot };
			renderLearningProgress();
		},
	};

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
