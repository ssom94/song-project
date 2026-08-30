(() => {
	const copy = {
		ja: {
			title: 'アクセスコード',
			description: '詳細なスキルシート・職務経歴書は4桁のアクセスコードで保護されています。',
			languageLabel: '文書言語',
			codeLabel: '4桁コード',
			codePlaceholder: '0000',
			submit: '確認',
			skill: 'スキルシート',
			career: '職務経歴書',
			protected: 'Protected',
			registered: '登録済み',
			unregistered: '未登録',
			checking: '確認中…',
			hint: 'コードは選択した言語の文書にのみ有効です。5回連続で失敗すると15分間入力できません。',
			invalid: '4桁の数字を入力してください。',
			failed: 'コードが正しくないか、有効期限が切れています。',
			locked: '入力回数が多すぎます。15分後にもう一度お試しください。',
			loading: '確認中…',
		},
		ko: {
			title: '접근 코드',
			description: '상세 스킬시트·직무경력서는 숫자 4자리 접근 코드로 보호되어 있습니다.',
			languageLabel: '문서 언어',
			codeLabel: '4자리 코드',
			codePlaceholder: '0000',
			submit: '확인',
			skill: '스킬시트',
			career: '직무경력서',
			protected: '보호됨',
			registered: '등록 완료',
			unregistered: '미등록 상태',
			checking: '확인 중…',
			hint: '코드는 선택한 언어의 문서에만 유효합니다. 5회 연속 실패하면 15분 동안 입력할 수 없습니다.',
			invalid: '숫자 4자리를 입력해 주세요.',
			failed: '코드가 올바르지 않거나 만료되었습니다.',
			locked: '입력 실패 횟수가 많습니다. 15분 후 다시 시도해 주세요.',
			loading: '확인 중…',
		},
	};

	let language = new URLSearchParams(location.search).get('lang') === 'ko' ? 'ko' : 'ja';
	let documentStatus = null;
	let statusRequestId = 0;

	function byId(id) { return document.getElementById(id); }
	function text(key) { return copy[language]?.[key] ?? key; }
	function languageButtons() { return document.querySelectorAll('button[data-protected-language]'); }
	function stateNodes() { return [...document.querySelectorAll('[data-protected-state]')]; }

	function renderDocumentStatus() {
		const nodes = stateNodes();
		const values = documentStatus
			? [documentStatus.skillSheet?.registered === true, documentStatus.careerHistory?.registered === true]
			: [null, null];
		nodes.forEach((node, index) => {
			const registered = values[index];
			node.textContent = registered === null ? text('checking') : registered ? text('registered') : text('unregistered');
			node.classList.toggle('is-registered', registered === true);
			node.classList.toggle('is-unregistered', registered === false);
		});
	}

	function applyLanguage() {
		document.documentElement.lang = language;
		document.body.dataset.protectedLanguage = language;
		byId('protected-title').textContent = text('title');
		byId('protected-description').textContent = text('description');
		byId('protected-language-label').textContent = text('languageLabel');
		byId('protected-code-label').textContent = text('codeLabel');
		byId('protected-code').placeholder = text('codePlaceholder');
		byId('protected-submit').textContent = text('submit');
		byId('protected-skill-label').textContent = text('skill');
		byId('protected-career-label').textContent = text('career');
		byId('protected-hint').textContent = text('hint');
		renderDocumentStatus();
		languageButtons().forEach((button) => {
			const active = button.dataset.protectedLanguage === language;
			button.classList.toggle('is-active', active);
			button.setAttribute('aria-pressed', String(active));
		});
		const publicSummary = byId('protected-public-summary');
		if (publicSummary instanceof HTMLAnchorElement) publicSummary.href = `/${language}/skill-sheet/`;
	}

	async function loadDocumentStatus() {
		const requestId = ++statusRequestId;
		documentStatus = null;
		renderDocumentStatus();
		try {
			const response = await fetch(`/api/public/protected/status?lang=${language}`, { cache: 'no-store' });
			const result = await response.json().catch(() => null);
			if (requestId !== statusRequestId) return;
			if (!response.ok || !result?.ok || !result.documents) throw new Error(result?.error || 'STATUS_FAILED');
			documentStatus = result.documents;
		} catch (error) {
			console.warn('Failed to load protected document status', error);
			documentStatus = null;
		} finally {
			if (requestId === statusRequestId) renderDocumentStatus();
		}
	}

	function setMessage(message, isError = false) {
		const node = byId('protected-message');
		node.textContent = message;
		node.hidden = !message;
		node.classList.toggle('is-error', isError);
	}

	function setLanguage(next) {
		if (next !== 'ja' && next !== 'ko') return;
		language = next;
		const url = new URL(location.href);
		url.searchParams.set('lang', language);
		history.replaceState(null, '', url);
		setMessage('');
		applyLanguage();
		loadDocumentStatus();
	}

	async function submit(event) {
		event.preventDefault();
		const input = byId('protected-code');
		const button = byId('protected-submit');
		const code = input.value.replace(/\D/g, '').slice(0, 4);
		input.value = code;
		if (!/^\d{4}$/.test(code)) {
			setMessage(text('invalid'), true);
			input.focus();
			return;
		}

		button.disabled = true;
		button.textContent = text('loading');
		setMessage('');
		try {
			const response = await fetch('/api/protected/auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code, language }),
			});
			const result = await response.json().catch(() => null);
			if (response.status === 429) {
				setMessage(text('locked'), true);
				return;
			}
			if (!response.ok || !result?.ok) {
				setMessage(text('failed'), true);
				input.select();
				return;
			}
			window.location.href = result.redirect || `/protected/viewer/?lang=${language}`;
		} catch (error) {
			console.error('Protected access request failed', error);
			setMessage(text('failed'), true);
		} finally {
			button.disabled = false;
			button.textContent = text('submit');
		}
	}

	function initialize() {
		byId('protected-code')?.addEventListener('input', (event) => {
			event.target.value = event.target.value.replace(/\D/g, '').slice(0, 4);
		});
		byId('protected-code-form')?.addEventListener('submit', submit);
		languageButtons().forEach((button) => {
			button.addEventListener('click', () => setLanguage(button.dataset.protectedLanguage));
		});
		applyLanguage();
		loadDocumentStatus();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
