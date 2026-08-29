type PublicLanguage = 'ja' | 'ko';

function pageText(language: PublicLanguage) {
	return language === 'ko'
		? {
			pageTitle: '게시글 | SONG',
			home: 'Home',
			posts: '게시글',
			back: '← 게시글 목록',
			loading: '게시글을 불러오는 중…',
		}
		: {
			pageTitle: '投稿 | SONG',
			home: 'Home',
			posts: '投稿',
			back: '← 投稿一覧',
			loading: '投稿を読み込んでいます…',
		};
}

export function renderPublicPostPage(language: PublicLanguage): Response {
	const text = pageText(language);
	const otherLanguage = language === 'ja' ? 'ko' : 'ja';
	const otherLabel = otherLanguage === 'ja' ? '日本語' : '한국어';

	return new Response(`<!doctype html>
<html lang="${language}">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta name="robots" content="index,follow" />
	<title>${text.pageTitle}</title>
	<link rel="stylesheet" href="/assets/css/common.css" />
	<link rel="stylesheet" href="/assets/css/blog/common.css" />
	<link rel="stylesheet" href="/assets/css/blog/post-detail.css" />
	<link rel="stylesheet" href="/assets/css/markdown.css" />
</head>
<body class="blog-page blog-post-page" data-blog-language="${language}">
	<header class="blog-header">
		<div class="blog-header-inner">
			<a class="blog-brand" href="/" aria-label="SONG Home">
				<img src="/assets/logo-song-ym.png" alt="Song YM" />
			</a>
			<nav class="blog-nav" aria-label="Main navigation">
				<a href="/">${text.home}</a>
				<a class="is-active" href="/${language}/posts/">${text.posts}</a>
			</nav>
			<div class="blog-language-switch" aria-label="Language">
				<span class="is-active">${language === 'ja' ? '日本語' : '한국어'}</span>
				<span aria-hidden="true">/</span>
				<a id="post-language-alternate" href="/${otherLanguage}/posts/">${otherLabel}</a>
			</div>
		</div>
	</header>

	<main class="blog-main">
		<article class="blog-post-shell">
			<a class="blog-back-link" href="/${language}/posts/">${text.back}</a>
			<div id="post-detail-loading" class="blog-state">${text.loading}</div>
			<section id="post-detail" hidden>
				<div id="post-detail-meta" class="blog-post-meta"></div>
				<h1 id="post-detail-title" class="blog-post-title"></h1>
				<div id="post-detail-taxonomy" class="blog-post-taxonomy"></div>
				<div id="post-detail-content" class="blog-post-content"></div>
			</section>
			<section id="post-translation-missing" class="blog-state blog-state-card" hidden>
				<h1 id="post-translation-missing-title"></h1>
				<p id="post-translation-missing-message"></p>
				<a id="post-translation-alternate-link" class="blog-primary-link" href="#"></a>
			</section>
			<section id="post-detail-error" class="blog-state blog-state-card" hidden>
				<h1 id="post-detail-error-title"></h1>
				<p id="post-detail-error-message"></p>
			</section>
		</article>
	</main>

	<script src="/assets/js/markdown.js"></script>
	<script src="/assets/js/blog/post-detail.js"></script>
</body>
</html>`, {
		status: 200,
		headers: {
			'Content-Type': 'text/html; charset=UTF-8',
			'Cache-Control': 'public, max-age=60',
		},
	});
}
