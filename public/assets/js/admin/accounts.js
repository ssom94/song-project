(() => {
	const API = '/api/admin/accounts';
	const DETAIL_API = '/api/admin/accounts/detail';
	let accounts = [];
	let currentAdminId = null;
	let editBaseline = '';
	let editingAccount = null;

	function byId(id) { return document.getElementById(id); }
	function language() { return window.AdminI18n?.getLanguage?.() === 'ko' ? 'ko' : 'ja'; }
	function copy(ko, ja) { return language() === 'ko' ? ko : ja; }
	function t(key, fallback) {
		const value = window.AdminI18n?.t(key);
		return value && value !== key ? value : fallback;
	}

	function formatDate(value) {
		if (!value) return '—';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '—';
		return new Intl.DateTimeFormat(language() === 'ko' ? 'ko-KR' : 'ja-JP', {
			year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
			timeZone: 'Asia/Tokyo', hour12: false,
		}).format(date);
	}

	function errorMessage(code) {
		const messages = {
			INVALID_USERNAME: copy('사용자 ID는 영문·숫자와 . _ - 만 사용해 3~32자로 입력해 주세요.', 'ユーザーIDは半角英数字と . _ - のみで3〜32文字にしてください。'),
			DISPLAY_NAME_REQUIRED: copy('표시명을 입력해 주세요.', '表示名を入力してください。'),
			INVALID_EMAIL: copy('이메일 형식을 확인해 주세요.', 'メール形式を確認してください。'),
			INVALID_PASSWORD: copy('비밀번호는 10자 이상 입력해 주세요.', 'パスワードは10文字以上入力してください。'),
			USERNAME_EXISTS: copy('이미 사용 중인 사용자 ID입니다.', 'すでに使用中のユーザーIDです。'),
			EMAIL_EXISTS: copy('이미 사용 중인 이메일입니다.', 'すでに使用中のメールです。'),
			CANNOT_DISABLE_SELF: copy('현재 로그인 중인 자신의 계정은 비활성화할 수 없습니다.', '現在ログイン中の自分のアカウントは無効にできません。'),
			CANNOT_DISABLE_LAST_ADMIN: copy('마지막 활성 관리자 계정은 비활성화할 수 없습니다.', '最後の有効な管理者アカウントは無効にできません。'),
			ADMIN_NOT_FOUND: copy('관리자 계정을 찾을 수 없습니다.', '管理者アカウントが見つかりません。'),
		};
		return messages[code] || copy('처리하지 못했습니다. 입력 내용과 서버 로그를 확인해 주세요.', '処理できませんでした。入力内容とサーバーログを確認してください。');
	}

	async function requestJson(url, options = {}) {
		const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
		const result = await response.json().catch(() => null);
		if (response.status === 401) {
			window.location.replace('/admin/login/');
			throw new Error('UNAUTHORIZED');
		}
		if (!response.ok || !result?.ok) {
			const error = new Error(result?.error || `HTTP_${response.status}`);
			error.code = result?.error || '';
			throw error;
		}
		return result;
	}

	function setMessage(node, message, type = '') {
		if (!node) return;
		node.textContent = message || '';
		node.hidden = !message;
		node.classList.toggle('is-error', type === 'error');
		node.classList.toggle('is-success', type === 'success');
	}

	function renderMetrics() {
		byId('account-total').textContent = String(accounts.length);
		byId('account-active').textContent = String(accounts.filter((item) => item.status === 'active').length);
		byId('account-disabled').textContent = String(accounts.filter((item) => item.status === 'disabled').length);
		const current = accounts.find((item) => item.id === currentAdminId);
		byId('account-current').textContent = current?.displayName || current?.username || '—';
	}

	function filteredAccounts() {
		const keyword = String(byId('account-search')?.value || '').trim().toLocaleLowerCase();
		const status = byId('account-status-filter')?.value || '';
		return accounts.filter((item) => {
			if (status && item.status !== status) return false;
			if (!keyword) return true;
			return [item.username, item.displayName, item.email].some((value) => String(value || '').toLocaleLowerCase().includes(keyword));
		});
	}

	function statusBadge(account) {
		const badge = document.createElement('span');
		badge.className = `admin-account-status ${account.status === 'active' ? 'is-active' : 'is-disabled'}`;
		badge.textContent = account.status === 'active' ? t('statusActive', '有効') : t('statusDisabled', '無効');
		return badge;
	}

	function renderAccounts() {
		const body = byId('account-list-body');
		if (!body) return;
		const list = filteredAccounts();
		body.replaceChildren();
		for (const [index, account] of list.entries()) {
			const row = document.createElement('tr');
			const no = document.createElement('td'); no.textContent = String(index + 1);
			const username = document.createElement('td');
			const userStrong = document.createElement('strong'); userStrong.textContent = account.username;
			username.appendChild(userStrong);
			if (account.isCurrent) {
				const current = document.createElement('span');
				current.className = 'admin-account-current';
				current.textContent = copy('현재', '現在');
				username.appendChild(current);
			}
			const display = document.createElement('td'); display.textContent = account.displayName || '—';
			const email = document.createElement('td'); email.textContent = account.email || '—';
			const status = document.createElement('td'); status.appendChild(statusBadge(account));
			const lastLogin = document.createElement('td'); lastLogin.textContent = formatDate(account.lastLoginAt);
			const created = document.createElement('td'); created.textContent = formatDate(account.createdAt);
			const action = document.createElement('td');
			const edit = document.createElement('button');
			edit.type = 'button';
			edit.className = 'admin-account-edit-button';
			edit.textContent = t('editButton', '編集');
			edit.addEventListener('click', () => openEdit(account));
			action.appendChild(edit);
			row.append(no, username, display, email, status, lastLogin, created, action);
			body.appendChild(row);
		}
		byId('account-list-empty').hidden = list.length !== 0;
		renderMetrics();
	}

	async function loadAccounts() {
		byId('account-list-loading').hidden = false;
		byId('account-list-empty').hidden = true;
		byId('account-list-error').hidden = true;
		try {
			const result = await requestJson(API);
			accounts = Array.isArray(result.accounts) ? result.accounts : [];
			currentAdminId = Number(result.currentAdminId) || null;
			byId('account-list-loading').hidden = true;
			renderAccounts();
		} catch (error) {
			console.error('Failed to load admin accounts', error);
			byId('account-list-loading').hidden = true;
			byId('account-list-error').hidden = false;
		}
	}

	function createPayload() {
		return {
			username: byId('account-username').value.trim(),
			displayName: byId('account-display-name').value.trim(),
			email: byId('account-email').value.trim(),
			status: byId('account-status').value,
			password: byId('account-password').value,
		};
	}

	async function createAccount(event) {
		event.preventDefault();
		const message = byId('account-create-message');
		const button = byId('account-create-button');
		setMessage(message, '');
		if (byId('account-password').value !== byId('account-password-confirm').value) {
			setMessage(message, copy('비밀번호 확인이 일치하지 않습니다.', 'パスワード確認が一致しません。'), 'error');
			return;
		}
		button.disabled = true;
		try {
			await requestJson(API, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(createPayload()),
			});
			byId('admin-account-create-form').reset();
			byId('account-status').value = 'active';
			setMessage(message, copy('관리자 계정을 등록했습니다.', '管理者アカウントを登録しました。'), 'success');
			await loadAccounts();
		} catch (error) {
			console.error('Failed to create admin account', error);
			setMessage(message, errorMessage(error.code), 'error');
		} finally {
			button.disabled = false;
		}
	}

	function editSnapshot() {
		return JSON.stringify({
			displayName: byId('account-edit-display-name').value.trim(),
			email: byId('account-edit-email').value.trim(),
			status: byId('account-edit-status').value,
			password: byId('account-edit-password').value,
		});
	}

	function updateEditDirty() {
		const button = byId('account-edit-save');
		if (!button) return;
		button.disabled = !editBaseline || editSnapshot() === editBaseline;
	}

	function openEdit(account) {
		editingAccount = account;
		byId('account-edit-id').value = String(account.id);
		byId('account-edit-username').textContent = `@${account.username}`;
		byId('account-edit-display-name').value = account.displayName || '';
		byId('account-edit-email').value = account.email || '';
		byId('account-edit-status').value = account.status;
		byId('account-edit-password').value = '';
		const self = account.id === currentAdminId;
		byId('account-edit-status').querySelector('option[value="disabled"]').disabled = self;
		byId('account-edit-self-note').hidden = !self;
		setMessage(byId('account-edit-message'), '');
		editBaseline = editSnapshot();
		updateEditDirty();
		byId('account-edit-backdrop').hidden = false;
		document.body.classList.add('admin-modal-open');
		byId('account-edit-display-name').focus();
	}

	function closeEdit() {
		byId('account-edit-backdrop').hidden = true;
		document.body.classList.remove('admin-modal-open');
		editingAccount = null;
		editBaseline = '';
	}

	async function saveEdit(event) {
		event.preventDefault();
		if (!editingAccount || editSnapshot() === editBaseline) return;
		const nextStatus = byId('account-edit-status').value;
		if (editingAccount.status === 'active' && nextStatus === 'disabled') {
			const confirmed = await window.AdminCommon?.confirm?.({
				titleFallback: copy('관리자 계정 비활성화', '管理者アカウントを無効化'),
				messageFallback: copy(`${editingAccount.displayName || editingAccount.username} 계정을 비활성화하면 해당 계정의 로그인 세션이 종료됩니다. 계속할까요?`, `${editingAccount.displayName || editingAccount.username} を無効にすると、そのアカウントのログインセッションが終了します。続けますか？`),
				confirmFallback: copy('비활성화', '無効にする'),
				cancelFallback: copy('취소', 'キャンセル'),
			});
			if (!confirmed) return;
		}
		const button = byId('account-edit-save');
		button.disabled = true;
		setMessage(byId('account-edit-message'), '');
		try {
			await requestJson(DETAIL_API, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: editingAccount.id,
					displayName: byId('account-edit-display-name').value.trim(),
					email: byId('account-edit-email').value.trim(),
					status: nextStatus,
					password: byId('account-edit-password').value || undefined,
				}),
			});
			closeEdit();
			await loadAccounts();
		} catch (error) {
			console.error('Failed to update admin account', error);
			setMessage(byId('account-edit-message'), errorMessage(error.code), 'error');
			updateEditDirty();
		}
	}

	function bind() {
		byId('admin-account-create-form')?.addEventListener('submit', createAccount);
		byId('account-refresh')?.addEventListener('click', loadAccounts);
		byId('account-search')?.addEventListener('input', renderAccounts);
		byId('account-status-filter')?.addEventListener('change', renderAccounts);
		byId('account-edit-form')?.addEventListener('submit', saveEdit);
		byId('account-edit-close')?.addEventListener('click', closeEdit);
		byId('account-edit-cancel')?.addEventListener('click', closeEdit);
		byId('account-edit-backdrop')?.addEventListener('click', (event) => { if (event.target === byId('account-edit-backdrop')) closeEdit(); });
		['account-edit-display-name', 'account-edit-email', 'account-edit-status', 'account-edit-password'].forEach((id) => {
			byId(id)?.addEventListener('input', updateEditDirty);
			byId(id)?.addEventListener('change', updateEditDirty);
		});
		document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !byId('account-edit-backdrop')?.hidden) closeEdit(); });
		document.addEventListener('adminlanguagechange', () => { renderAccounts(); renderMetrics(); });
	}

	async function initialize() {
		await window.AdminCommon?.ready;
		bind();
		await loadAccounts();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
