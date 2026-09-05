(() => {
	function initialize() {
		const form = document.getElementById('login-form');
		const usernameInput = document.getElementById('username');
		const passwordInput = document.getElementById('password');
		const passwordToggle = document.getElementById('password-toggle');
		const rememberInput = document.getElementById('remember-me');
		const submitButton = document.getElementById('submit-button');
		const status = document.getElementById('status');

		if (!form || !usernameInput || !passwordInput || !passwordToggle || !rememberInput || !submitButton || !status) {
			return;
		}

		function setStatus(message, success = false) {
			status.textContent = message;
			status.classList.toggle('success', success);
		}

		passwordToggle.addEventListener('click', () => {
			const showPassword = passwordInput.type === 'password';
			passwordInput.type = showPassword ? 'text' : 'password';
			passwordToggle.classList.toggle('is-visible', showPassword);
			passwordToggle.setAttribute('aria-pressed', String(showPassword));
			passwordToggle.setAttribute('aria-label', showPassword ? 'パスワードを非表示' : 'パスワードを表示');
			passwordInput.focus({ preventScroll: true });
		});

		async function checkSession() {
			try {
				const response = await fetch('/api/admin/auth/session', {
					method: 'GET',
					credentials: 'same-origin',
					cache: 'no-store',
				});
				if (!response.ok) return;
				const data = await response.json();
				if (data.authenticated) {
					window.location.replace('/admin/');
				}
			} catch {
				// Keep the login form usable if the session check fails.
			}
		}

		form.addEventListener('submit', async (event) => {
			event.preventDefault();
			setStatus('');

			const username = usernameInput.value.trim();
			const password = passwordInput.value;
			if (!username || !password) {
				setStatus('ユーザー名とパスワードを入力してください。');
				return;
			}

			submitButton.disabled = true;
			submitButton.textContent = 'ログイン中…';

			try {
				const response = await fetch('/api/admin/auth/login', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'same-origin',
					body: JSON.stringify({
						username,
						password,
						rememberMe: rememberInput.checked,
					}),
				});
				const requestId = response.headers.get('X-Request-Id');
				const data = await response.json().catch(() => ({}));

				if (response.ok && data.authenticated) {
					passwordInput.value = '';
					window.location.replace('/admin/');
					return;
				}

				if (response.status === 403 && data.error === 'TWO_FACTOR_REQUIRED') {
					setStatus('2段階認証が必要です。');
					return;
				}

				if (response.status === 401 && data.error === 'INVALID_CREDENTIALS') {
					setStatus('ユーザー名またはパスワードが正しくありません。');
					return;
				}

				if (response.status === 400) {
					setStatus('ログイン要求の形式が正しくありません。');
					return;
				}

				if (response.status >= 500) {
					const suffix = requestId ? ` (ID: ${requestId})` : '';
					setStatus(`ログインAPIでサーバーエラーが発生しました。HTTP ${response.status}${suffix}`);
					console.error('Admin login API server error', { status: response.status, error: data.error, requestId });
					return;
				}

				const suffix = requestId ? ` (ID: ${requestId})` : '';
				setStatus(`ログインに失敗しました。HTTP ${response.status}${suffix}`);
				console.error('Admin login API unexpected response', { status: response.status, error: data.error, requestId });
			} catch (error) {
				console.error('Admin login request failed', error);
				setStatus('通信に失敗しました。しばらくしてから再度お試しください。');
			} finally {
				submitButton.disabled = false;
				submitButton.textContent = 'ログイン';
			}
		});

		checkSession();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initialize, { once: true });
	} else {
		initialize();
	}
})();
