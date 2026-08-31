(() => {
	function language() {
		return document.body?.dataset?.blogLanguage === 'ja' ? 'ja' : 'ko';
	}

	function t(ko, ja) {
		return language() === 'ja' ? ja : ko;
	}

	async function isAuthenticated() {
		try {
			const response = await fetch('/api/admin/auth/session', { credentials: 'same-origin', cache: 'no-store' });
			const data = await response.json().catch(() => null);
			return response.ok && data?.authenticated === true;
		} catch {
			return false;
		}
	}

	function configureGuestStart() {
		const current = document.getElementById('jlpt-start-button');
		if (!(current instanceof HTMLButtonElement)) return;
		if (current.dataset.guestPractice === 'true') {
			current.disabled = false;
			current.textContent = t('연습 문제로 이동', '練習問題へ移動');
			return;
		}
		const clone = current.cloneNode(true);
		if (!(clone instanceof HTMLButtonElement)) return;
		clone.dataset.guestPractice = 'true';
		clone.disabled = false;
		clone.textContent = t('연습 문제로 이동', '練習問題へ移動');
		clone.removeAttribute('title');
		clone.addEventListener('click', () => {
			const detail = document.getElementById('jlpt-study-detail');
			detail?.classList.remove('jlpt-hidden');
			detail?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		});
		current.replaceWith(clone);
		const copy = document.getElementById('jlpt-start-copy');
		if (copy) copy.textContent = t(
			'로그인 없이 연습 문제를 풀 수 있습니다. 방문자 답안은 관리자 학습 기록에 저장되지 않습니다.',
			'ログインせずに練習問題を解けます。ゲストの回答は管理者の学習記録には保存されません。',
		);
	}

	async function initialize() {
		if (await isAuthenticated()) return;
		configureGuestStart();
		window.setTimeout(configureGuestStart, 500);
		window.setTimeout(configureGuestStart, 1200);
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
