type PublicLanguage = 'ja' | 'ko';

function pageText(language: PublicLanguage) {
	return language === 'ko'
		? {
			pageTitle: '게시글 | SONG', home: '홈', posts: '전체 게시글', japanese: '일본어 학습', skill: '스킬시트', career: '경력', menu: '메뉴', boards: '게시판', quick: '바로가기', categoriesEmpty: '아직 공개된 카테고리가 없습니다.', goals: '2029 목표', dday: 'D-Day', jlptProgress: 'JLPT 진행률', back: '뒤로가기', loading: '게시글을 불러오는 중…', closeMenu: '메뉴 닫기', comments: '댓글', commentCount: '0개', nickname: '닉네임', password: '수정·삭제 비밀번호', commentPlaceholder: '댓글을 입력해 주세요.', commentPolicy: '댓글은 일반 텍스트로 저장되며 HTML은 실행되지 않습니다.', commentSubmit: '댓글 등록', commentsEmpty: '아직 댓글이 없습니다. 첫 댓글을 남겨보세요.',
		}
		: {
			pageTitle: '投稿 | SONG', home: 'Home', posts: '投稿', japanese: '日本語学習', skill: 'Skill Sheet', career: 'Career History', menu: 'Menu', boards: 'Boards', quick: 'Quick', categoriesEmpty: '公開されたカテゴリーはまだありません。', goals: '2029 Goals', dday: 'D-Day', jlptProgress: 'JLPT Progress', back: '戻る', loading: '投稿を読み込んでいます…', closeMenu: 'メニューを閉じる', comments: 'コメント', commentCount: '0件', nickname: 'ニックネーム', password: '編集・削除用パスワード', commentPlaceholder: 'コメントを入力してください。', commentPolicy: 'コメントはプレーンテキストとして保存し、HTMLは実行しません。', commentSubmit: 'コメントを投稿', commentsEmpty: 'まだコメントはありません。最初のコメントを投稿してみてください。',
		};
}

export function renderPublicPostPage(language: PublicLanguage): Response {
	const text = pageText(language);
	const otherLanguage = language === 'ja' ? 'ko' : 'ja';
	const otherLabel = otherLanguage === 'ja' ? '日本語' : '한국어';
	const currentLabel = language === 'ja' ? '日本語' : '한국어';

	return new Response(`<!doctype html>
<html lang="${language}">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<meta name="robots" content="index,follow" />
	<title>${text.pageTitle}</title>
	<link rel="stylesheet" href="/assets/css/common.css" />
	<link rel="stylesheet" href="/assets/css/blog/common.css" />
	<link rel="stylesheet" href="/assets/css/blog/dashboard-shell.css" />
	<link rel="stylesheet" href="/assets/css/blog/post-detail.css" />
	<link rel="stylesheet" href="/assets/css/blog/post-neighbor-compact.css" />
	<link rel="stylesheet" href="/assets/css/blog/comments.css" />
	<link rel="stylesheet" href="/assets/css/markdown.css" />
</head>
<body class="blog-page blog-dashboard-page blog-post-page" data-blog-language="${language}">
	<header class="blog-dashboard-topbar">
		<div class="blog-dashboard-top-actions">
			<button id="blog-dashboard-menu-toggle" class="blog-dashboard-menu-toggle" type="button" aria-label="${text.menu}" aria-expanded="false" aria-controls="blog-dashboard-sidebar"><span></span><span></span><span></span></button>
			<a class="blog-dashboard-brand" href="/"><img src="/assets/logo-song-ym.png" alt="Song YM" /><span>Dashboard & Blog</span></a>
		</div>
		<div class="blog-dashboard-language" aria-label="Language"><span class="is-active">${currentLabel}</span><span aria-hidden="true">/</span><a id="post-language-alternate" href="/${otherLanguage}/posts/">${otherLabel}</a></div>
	</header>

	<div class="blog-dashboard-shell">
		<aside id="blog-dashboard-sidebar" class="blog-dashboard-sidebar">
			<section class="blog-sidebar-section"><p class="blog-sidebar-label">${text.menu}</p><nav class="blog-sidebar-nav">
				<a class="blog-sidebar-link" href="/">${text.home}</a>
				<a class="blog-sidebar-link is-active" href="/${language}/posts/">${text.posts}</a>
				<a class="blog-sidebar-link" href="/${language}/japanese/">${text.japanese}</a>
				<a class="blog-sidebar-link" href="/${language}/skill-sheet/">${text.skill}</a>
				<a class="blog-sidebar-link" href="/${language}/career/">${text.career}</a>
			</nav></section>
			<section class="blog-sidebar-section"><p class="blog-sidebar-label">${text.boards}</p><nav id="blog-sidebar-categories" class="blog-sidebar-nav"></nav><p id="blog-sidebar-categories-empty" class="blog-sidebar-category-empty">${text.categoriesEmpty}</p></section>
			<section class="blog-sidebar-section"><p class="blog-sidebar-label">${text.quick}</p><nav class="blog-sidebar-nav"><a class="blog-sidebar-link" href="/#goals">${text.goals}</a><a class="blog-sidebar-link" href="/#dday">${text.dday}</a><a class="blog-sidebar-link" href="/#jlpt-progress">${text.jlptProgress}</a></nav></section>
			<div class="blog-sidebar-footer">SONG<br />Portfolio · Blog · Learning</div>
		</aside>
		<button id="blog-dashboard-backdrop" class="blog-dashboard-backdrop" type="button" aria-label="${text.closeMenu}" hidden></button>

		<main class="blog-dashboard-main"><div class="blog-dashboard-content blog-post-detail-dashboard-content">
			<article class="blog-post-shell">
				<div class="blog-post-context-row"><a class="blog-back-link" href="/${language}/posts/"><span aria-hidden="true">←</span><b>${text.back}</b></a><span id="post-detail-category-path" class="blog-post-category-path" hidden></span></div>
				<div id="post-detail-loading" class="blog-state">${text.loading}</div>
				<section id="post-detail" hidden><div id="post-detail-meta" class="blog-post-meta"></div><h1 id="post-detail-title" class="blog-post-title"></h1><div id="post-detail-taxonomy" class="blog-post-taxonomy"></div><div id="post-detail-content" class="blog-post-content"></div></section>
				<section id="post-translation-missing" class="blog-state blog-state-card" hidden><h1 id="post-translation-missing-title"></h1><p id="post-translation-missing-message"></p><a id="post-translation-alternate-link" class="blog-primary-link" href="#"></a></section>
				<section id="post-detail-error" class="blog-state blog-state-card" hidden><h1 id="post-detail-error-title"></h1><p id="post-detail-error-message"></p></section>
			</article>

			<section id="blog-comments-section" class="blog-comments" aria-labelledby="blog-comments-title" hidden>
				<div class="blog-comments-heading"><h2 id="blog-comments-title">${text.comments}</h2><span class="blog-comments-count">${text.commentCount}</span></div>
				<form id="public-comment-form" class="blog-comment-form">
					<div class="blog-comment-fields"><input name="nickname" type="text" maxlength="40" placeholder="${text.nickname}" autocomplete="nickname" required /><input name="password" type="password" minlength="4" maxlength="100" placeholder="${text.password}" autocomplete="new-password" required /></div>
					<textarea name="content" maxlength="2000" placeholder="${text.commentPlaceholder}" required></textarea>
					<p id="public-comment-status" class="blog-comment-status" hidden></p>
					<div class="blog-comment-form-footer"><span>${text.commentPolicy}</span><button class="blog-comment-submit" type="submit">${text.commentSubmit}</button></div>
				</form>
				<div id="public-comment-list" class="blog-comment-list"><div class="blog-comments-empty">${text.commentsEmpty}</div></div>
			</section>
		</div></main>
	</div>

	<script src="/assets/js/blog/dashboard-shell.js"></script>
	<script src="/assets/js/markdown.js"></script>
	<script src="/assets/js/blog/comments.js"></script>
	<script src="/assets/js/blog/post-detail.js"></script>
	<script src="/assets/js/blog/post-neighbor-compact.js"></script>
</body>
</html>`, { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'public, max-age=60' } });
}
