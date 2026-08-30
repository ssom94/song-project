(() => {
	let comments = [];
	let searchTimer = 0;

	function t(key, fallback) {
		const value = window.AdminI18n?.t?.(key);
		return value && value !== key ? value : fallback;
	}

	function language() {
		return window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja';
	}

	function formatDate(value) {
		if (!value) return '—';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return String(value);
		return new Intl.DateTimeFormat(language() === 'ko' ? 'ko-KR' : 'ja-JP', {
			year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo',
		}).format(date);
	}

	function currentFilters() {
		return {
			q: document.getElementById('comment-search')?.value?.trim() ?? '',
			status: document.getElementById('comment-status-filter')?.value ?? '',
			lang: document.getElementById('comment-language-filter')?.value ?? '',
		};
	}

	function postTitle(comment) {
		return language() === 'ko'
			? comment.titleKo ?? comment.titleJa ?? `#${comment.postId}`
			: comment.titleJa ?? comment.titleKo ?? `#${comment.postId}`;
	}

	function statusLabel(status) {
		if (status === 'visible') return t('statusVisible', language() === 'ko' ? '공개' : '公開');
		if (status === 'hidden') return t('statusHidden', language() === 'ko' ? '숨김' : '非表示');
		return t('statusSpam', language() === 'ko' ? '스팸' : 'スパム');
	}

	function createButton(label, className, onClick) {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = className;
		button.textContent = label;
		button.addEventListener('click', onClick);
		return button;
	}

	async function updateStatus(commentId, status) {
		const response = await fetch(`/api/admin/comments/detail?id=${encodeURIComponent(commentId)}`, {
			method: 'PATCH',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status }),
		});
		const result = await response.json().catch(() => null);
		if (!response.ok || !result?.ok) throw new Error(result?.error ?? 'COMMENT_STATUS_UPDATE_FAILED');
		await loadComments();
	}

	async function deleteComment(comment) {
		const confirmed = await window.AdminCommon?.confirm?.({
			titleKey: 'deleteTitle',
			messageKey: 'deleteConfirm',
			titleFallback: language() === 'ko' ? '댓글 삭제' : 'コメント削除',
			messageFallback: language() === 'ko' ? '이 댓글을 삭제하시겠습니까?' : 'このコメントを削除しますか？',
			confirmKey: 'delete',
			confirmFallback: language() === 'ko' ? '삭제' : '削除',
		});
		if (!confirmed) return;

		const response = await fetch(`/api/admin/comments/detail?id=${encodeURIComponent(comment.id)}`, {
			method: 'DELETE',
			credentials: 'same-origin',
		});
		const result = await response.json().catch(() => null);
		if (!response.ok || !result?.ok) throw new Error(result?.error ?? 'COMMENT_DELETE_FAILED');
		await loadComments();
	}

	function renderMetrics(metrics = {}) {
		const mapping = { all: 'comment-metric-all', visible: 'comment-metric-visible', hidden: 'comment-metric-hidden', spam: 'comment-metric-spam' };
		for (const [key, id] of Object.entries(mapping)) {
			const node = document.getElementById(id);
			if (node) node.textContent = String(metrics[key] ?? 0);
		}
	}

	function renderComments() {
		const tbody = document.getElementById('comment-table-body');
		if (!tbody) return;
		tbody.replaceChildren();

		if (comments.length === 0) {
			const row = document.createElement('tr');
			const cell = document.createElement('td');
			cell.colSpan = 7;
			cell.className = 'admin-record-empty';
			cell.textContent = t('empty', language() === 'ko' ? '등록된 댓글이 없습니다.' : 'コメントはありません。');
			row.appendChild(cell);
			tbody.appendChild(row);
			return;
		}

		const fragment = document.createDocumentFragment();
		for (const comment of comments) {
			const row = document.createElement('tr');

			const idCell = document.createElement('td');
			idCell.textContent = String(comment.id);

			const postCell = document.createElement('td');
			const postTitleNode = document.createElement('strong');
			postTitleNode.textContent = `${comment.parentId ? '↳ ' : ''}${postTitle(comment)}`;
			const lang = document.createElement('small');
			lang.textContent = comment.languageCode === 'ko' ? '한국어' : '日本語';
			postCell.append(postTitleNode, lang);

			const authorCell = document.createElement('td');
			const author = document.createElement('strong');
			author.textContent = comment.nickname;
			authorCell.appendChild(author);
			if (comment.ipMasked) {
				const ip = document.createElement('small');
				ip.textContent = comment.ipMasked;
				authorCell.appendChild(ip);
			}

			const commentCell = document.createElement('td');
			commentCell.className = 'admin-comment-content-cell';
			commentCell.textContent = comment.content;

			const statusCell = document.createElement('td');
			const status = document.createElement('span');
			status.className = `admin-record-status is-${comment.status}`;
			status.textContent = statusLabel(comment.status);
			statusCell.appendChild(status);

			const dateCell = document.createElement('td');
			dateCell.textContent = formatDate(comment.createdAt);

			const actionCell = document.createElement('td');
			const actions = document.createElement('div');
			actions.className = 'admin-comment-actions';
			if (comment.status !== 'visible') actions.appendChild(createButton(t('show', language() === 'ko' ? '공개' : '公開'), 'admin-record-primary', () => updateStatus(comment.id, 'visible').catch(console.error)));
			if (comment.status !== 'hidden') actions.appendChild(createButton(t('hide', language() === 'ko' ? '숨김' : '非表示'), 'admin-record-secondary', () => updateStatus(comment.id, 'hidden').catch(console.error)));
			if (comment.status !== 'spam') actions.appendChild(createButton(t('markSpam', language() === 'ko' ? '스팸' : 'スパム'), 'admin-record-secondary', () => updateStatus(comment.id, 'spam').catch(console.error)));
			actions.appendChild(createButton(t('delete', language() === 'ko' ? '삭제' : '削除'), 'admin-record-danger admin-comment-delete-button', () => deleteComment(comment).catch(console.error)));
			actionCell.appendChild(actions);

			row.append(idCell, postCell, authorCell, commentCell, statusCell, dateCell, actionCell);
			fragment.appendChild(row);
		}
		tbody.appendChild(fragment);
	}

	async function loadComments() {
		const filters = currentFilters();
		const params = new URLSearchParams();
		if (filters.q) params.set('q', filters.q);
		if (filters.status) params.set('status', filters.status);
		if (filters.lang) params.set('lang', filters.lang);
		const response = await fetch(`/api/admin/comments?${params.toString()}`, {
			method: 'GET', credentials: 'same-origin', cache: 'no-store',
		});
		const result = await response.json().catch(() => null);
		if (!response.ok || !result?.ok || !Array.isArray(result.comments)) throw new Error(result?.error ?? 'COMMENT_LIST_FAILED');
		comments = result.comments;
		renderMetrics(result.metrics);
		renderComments();
	}

	function bind() {
		const search = document.getElementById('comment-search');
		search?.addEventListener('input', () => {
			window.clearTimeout(searchTimer);
			searchTimer = window.setTimeout(() => loadComments().catch(console.error), 220);
		});
		document.getElementById('comment-status-filter')?.addEventListener('change', () => loadComments().catch(console.error));
		document.getElementById('comment-language-filter')?.addEventListener('change', () => loadComments().catch(console.error));
		document.getElementById('comment-refresh')?.addEventListener('click', () => loadComments().catch(console.error));
		document.addEventListener('adminlanguagechange', renderComments);
	}

	async function initialize() {
		const session = await window.AdminCommon?.ready;
		if (!session) return;
		bind();
		await loadComments();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
