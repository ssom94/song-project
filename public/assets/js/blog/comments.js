(() => {
	let postId = null;
	let busy = false;

	function language() {
		return document.body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
	}

	function copy() {
		return language() === 'ko'
			? {
				empty: '아직 댓글이 없습니다. 첫 댓글을 남겨보세요.',
				loading: '댓글을 불러오는 중입니다…',
				loadFailed: '댓글을 불러오지 못했습니다.',
				registerFailed: '댓글 등록에 실패했습니다.',
				nicknameRequired: '닉네임을 입력해 주세요.',
				passwordRequired: '비밀번호는 4자 이상 입력해 주세요.',
				contentRequired: '댓글 내용을 입력해 주세요.',
				admin: '관리자',
				count: (value) => `${value}개`,
			}
			: {
				empty: 'まだコメントはありません。最初のコメントを投稿してみてください。',
				loading: 'コメントを読み込んでいます…',
				loadFailed: 'コメントを読み込めませんでした。',
				registerFailed: 'コメントの投稿に失敗しました。',
				nicknameRequired: 'ニックネームを入力してください。',
				passwordRequired: 'パスワードは4文字以上入力してください。',
				contentRequired: 'コメントを入力してください。',
				admin: '管理者',
				count: (value) => `${value}件`,
			};
	}

	function form() {
		return document.getElementById('public-comment-form');
	}

	function statusNode() {
		return document.getElementById('public-comment-status');
	}

	function setStatus(message = '', isError = false) {
		const node = statusNode();
		if (!node) return;
		node.textContent = message;
		node.hidden = !message;
		node.classList.toggle('is-error', isError);
	}

	function updateCount(value) {
		const node = document.querySelector('.blog-comments-count');
		if (node) node.textContent = copy().count(value);
	}

	function formatDate(value) {
		if (!value) return '';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return new Intl.DateTimeFormat(language() === 'ko' ? 'ko-KR' : 'ja-JP', {
			year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo',
		}).format(date);
	}

	function render(comments) {
		const list = document.getElementById('public-comment-list');
		if (!list) return;
		list.replaceChildren();
		updateCount(comments.length);
		if (comments.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'blog-comments-empty';
			empty.textContent = copy().empty;
			list.appendChild(empty);
			return;
		}

		const fragment = document.createDocumentFragment();
		for (const comment of comments) {
			const item = document.createElement('article');
			item.className = `blog-comment-item${comment.parentId ? ' blog-comment-reply' : ''}`;
			const meta = document.createElement('div');
			meta.className = 'blog-comment-meta';
			const author = document.createElement('strong');
			author.textContent = comment.isAdmin ? `${comment.nickname} · ${copy().admin}` : comment.nickname;
			const time = document.createElement('time');
			time.dateTime = comment.createdAt ?? '';
			time.textContent = formatDate(comment.createdAt);
			meta.append(author, time);
			const body = document.createElement('p');
			body.className = 'blog-comment-body';
			body.textContent = comment.content ?? '';
			item.append(meta, body);
			fragment.appendChild(item);
		}
		list.appendChild(fragment);
	}

	async function fetchCommentsForLanguage(commentLanguage) {
		const response = await fetch(`/api/public/comments?postId=${encodeURIComponent(postId)}&lang=${commentLanguage}`, {
			method: 'GET', cache: 'no-store',
		});
		const result = await response.json().catch(() => null);
		if (!response.ok || !result?.ok || !Array.isArray(result.comments)) throw new Error('COMMENT_LIST_FAILED');
		return result.comments;
	}

	async function loadComments() {
		if (!postId) return;
		const list = document.getElementById('public-comment-list');
		if (list) list.innerHTML = `<div class="blog-comments-empty">${copy().loading}</div>`;
		try {
			const [japaneseComments, koreanComments] = await Promise.all([
				fetchCommentsForLanguage('ja'),
				fetchCommentsForLanguage('ko'),
			]);
			const merged = new Map();
			for (const comment of [...japaneseComments, ...koreanComments]) merged.set(Number(comment.id), comment);
			const comments = [...merged.values()].sort((left, right) => {
				const leftTime = Date.parse(left.createdAt ?? '') || 0;
				const rightTime = Date.parse(right.createdAt ?? '') || 0;
				return leftTime - rightTime || Number(left.id) - Number(right.id);
			});
			render(comments);
		} catch (error) {
			console.error('Failed to load comments', error);
			if (list) list.innerHTML = `<div class="blog-comments-empty">${copy().loadFailed}</div>`;
		}
	}

	async function submitComment(event) {
		event.preventDefault();
		if (!postId || busy) return;
		const currentForm = form();
		if (!(currentForm instanceof HTMLFormElement)) return;
		const nickname = currentForm.querySelector('[name="nickname"]')?.value?.trim() ?? '';
		const password = currentForm.querySelector('[name="password"]')?.value ?? '';
		const content = currentForm.querySelector('[name="content"]')?.value?.trim() ?? '';
		if (!nickname) return setStatus(copy().nicknameRequired, true);
		if (password.length < 4) return setStatus(copy().passwordRequired, true);
		if (!content) return setStatus(copy().contentRequired, true);

		busy = true;
		setStatus('');
		const button = currentForm.querySelector('.blog-comment-submit');
		if (button instanceof HTMLButtonElement) button.disabled = true;
		try {
			const response = await fetch('/api/public/comments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ postId, language: language(), nickname, password, content }),
			});
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error ?? 'COMMENT_CREATE_FAILED');
			currentForm.reset();
			await loadComments();
		} catch (error) {
			console.error('Failed to create comment', error);
			setStatus(copy().registerFailed, true);
		} finally {
			busy = false;
			if (button instanceof HTMLButtonElement) button.disabled = false;
		}
	}

	function activate(id) {
		const parsed = Number(id);
		if (!Number.isSafeInteger(parsed) || parsed <= 0) return;
		postId = parsed;
		const section = document.getElementById('blog-comments-section');
		if (section) section.hidden = false;
		loadComments();
	}

	const currentForm = form();
	if (currentForm) currentForm.addEventListener('submit', submitComment);
	document.addEventListener('song:post-ready', (event) => activate(event.detail?.postId));
	if (document.body.dataset.postId) activate(document.body.dataset.postId);
})();
