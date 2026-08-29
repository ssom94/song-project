(() => {
	let codes = [];

	function byId(id) { return document.getElementById(id); }
	function language() { return window.AdminI18n?.getLanguage?.() ?? 'ja'; }
	function t(key, ja, ko) {
		const translated = window.AdminI18n?.t?.(key);
		if (translated && translated !== key) return translated;
		return language() === 'ko' ? ko : ja;
	}

	function formatDate(value) {
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '—';
		return new Intl.DateTimeFormat(language() === 'ko' ? 'ko-KR' : 'ja-JP', {
			year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
		}).format(date);
	}

	function defaultExpiryDate() {
		const date = new Date();
		date.setDate(date.getDate() + 30);
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	function permissionLabel(row) {
		const labels = [];
		if (Number(row.allow_skill_sheet) === 1) labels.push(t('skillSheetShort', 'Skill', '스킬'));
		if (Number(row.allow_career_history) === 1) labels.push(t('careerHistoryShort', 'Career', '경력'));
		return labels.join(' + ') || '—';
	}

	function statusLabel(status) {
		if (status === 'revoked') return t('statusRevoked', '失効', '폐기');
		if (status === 'expired') return t('statusExpired', '期限切れ', '만료');
		return t('statusActive', '有効', '유효');
	}

	function statusClass(status) {
		return status === 'active' ? 'is-active' : status === 'expired' ? 'is-expired' : 'is-revoked';
	}

	function showIssueMessage(message, isError = false) {
		const node = byId('access-code-message');
		if (!node) return;
		node.textContent = message;
		node.hidden = !message;
		node.classList.toggle('is-error', isError);
	}

	function renderMetrics(metrics = {}) {
		byId('access-metric-active').textContent = String(Number(metrics.active_count) || 0);
		byId('access-metric-today').textContent = String(Number(metrics.today_access_count) || 0);
		byId('access-metric-revoked').textContent = String(Number(metrics.revoked_count) || 0);
	}

	function matchesFilters(row) {
		const search = String(byId('access-search')?.value || '').trim().toLocaleLowerCase();
		const status = String(byId('access-status-filter')?.value || '');
		const lang = String(byId('access-language-filter')?.value || '');
		if (status && row.status !== status) return false;
		if (lang && row.language !== lang) return false;
		if (!search) return true;
		return [row.label, row.language, permissionLabel(row)].some((value) => String(value || '').toLocaleLowerCase().includes(search));
	}

	function createCell(text) {
		const td = document.createElement('td');
		td.textContent = text;
		return td;
	}

	function renderCodes() {
		const body = byId('access-code-body');
		const empty = byId('access-code-empty');
		if (!body || !empty) return;
		body.replaceChildren();
		const filtered = codes.filter(matchesFilters);
		if (!filtered.length) {
			empty.hidden = false;
			return;
		}
		empty.hidden = true;
		for (const row of filtered) {
			const tr = document.createElement('tr');
			tr.append(
				createCell(String(row.id)),
				createCell(row.label || '—'),
				createCell(String(row.language || 'ja').toUpperCase()),
				createCell(permissionLabel(row)),
				createCell(formatDate(row.expires_at)),
				createCell(String(Number(row.use_count) || 0)),
			);
			const statusCell = document.createElement('td');
			const badge = document.createElement('span');
			badge.className = `admin-record-status ${statusClass(row.status)}`;
			badge.textContent = statusLabel(row.status);
			statusCell.appendChild(badge);
			tr.appendChild(statusCell);
			const action = document.createElement('td');
			if (row.status === 'active') {
				const revoke = document.createElement('button');
				revoke.type = 'button';
				revoke.className = 'admin-record-danger';
				revoke.textContent = t('revoke', '失効', '폐기');
				revoke.addEventListener('click', () => revokeCode(row.id));
				action.appendChild(revoke);
			} else {
				action.textContent = '—';
			}
			tr.appendChild(action);
			body.appendChild(tr);
		}
	}

	async function loadCodes() {
		try {
			const response = await fetch('/api/admin/access-codes', { credentials: 'same-origin', cache: 'no-store' });
			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error || 'ACCESS_CODE_LIST_FAILED');
			codes = Array.isArray(result.codes) ? result.codes : [];
			renderMetrics(result.metrics || {});
			renderCodes();
		} catch (error) {
			console.error('Failed to load access codes', error);
			showIssueMessage(t('loadFailed', 'アクセスコードを読み込めませんでした。', '접근 코드를 불러오지 못했습니다.'), true);
		}
	}

	function showIssuedCode(result) {
		const panel = byId('access-issued-panel');
		panel.hidden = false;
		byId('access-issued-code').textContent = result.value;
		byId('access-issued-meta').textContent = `${String(result.language).toUpperCase()} · ${result.label} · ${formatDate(result.expiresAt)}`;
		panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}

	async function issueCode() {
		const label = String(byId('access-label')?.value || '').trim();
		const expiresAt = String(byId('access-expiry')?.value || '');
		const accessLanguage = String(byId('access-language')?.value || 'ja');
		const allowSkillSheet = Boolean(byId('access-skill')?.checked);
		const allowCareerHistory = Boolean(byId('access-career')?.checked);
		if (!label) {
			showIssueMessage(t('labelRequired', 'ラベルを入力してください。', '라벨을 입력해 주세요.'), true);
			return;
		}
		if (!allowSkillSheet && !allowCareerHistory) {
			showIssueMessage(t('permissionsHint', '最低1つのドキュメント権限が必要です。', '최소 1개 이상의 문서 권한이 필요합니다.'), true);
			return;
		}

		const button = byId('access-issue');
		button.disabled = true;
		showIssueMessage('');
		try {
			const response = await fetch('/api/admin/access-codes', {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ label, language: accessLanguage, expiresAt, allowSkillSheet, allowCareerHistory }),
			});
			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok || !result.code?.value) throw new Error(result?.error || 'ACCESS_CODE_ISSUE_FAILED');
			showIssuedCode(result.code);
			showIssueMessage(t('issueSuccess', '4桁コードを発行しました。必ず今コピーしてください。', '4자리 코드를 발급했습니다. 지금 반드시 복사해 두세요.'));
			await loadCodes();
		} catch (error) {
			console.error('Failed to issue access code', error);
			showIssueMessage(t('issueFailed', 'コード発行に失敗しました。', '코드 발급에 실패했습니다.'), true);
		} finally {
			button.disabled = false;
		}
	}

	async function revokeCode(id) {
		const confirmed = window.AdminCommon?.confirm
			? await window.AdminCommon.confirm({
				titleFallback: language() === 'ko' ? '접근 코드 폐기' : 'アクセスコードを失効',
				messageFallback: language() === 'ko' ? '이 코드를 폐기하면 기존 접근 세션도 사용할 수 없습니다.' : 'このコードを失効すると既存のアクセスセッションも利用できなくなります。',
				confirmFallback: language() === 'ko' ? '폐기' : '失効',
			})
			: window.confirm(t('revokeConfirm', 'このコードを失効しますか？', '이 코드를 폐기할까요?'));
		if (!confirmed) return;
		try {
			const response = await fetch(`/api/admin/access-codes/revoke?id=${encodeURIComponent(id)}`, {
				method: 'POST', credentials: 'same-origin',
			});
			if (response.status === 401) {
				window.location.replace('/admin/login/');
				return;
			}
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error || 'REVOKE_FAILED');
			await loadCodes();
		} catch (error) {
			console.error('Failed to revoke access code', error);
			showIssueMessage(t('revokeFailed', '失効処理に失敗しました。', '폐기 처리에 실패했습니다.'), true);
		}
	}

	async function copyIssuedCode() {
		const code = byId('access-issued-code')?.textContent?.trim();
		if (!code) return;
		try {
			await navigator.clipboard.writeText(code);
			byId('access-copy').textContent = t('copied', 'コピー済み', '복사됨');
		} catch {
			byId('access-copy').textContent = t('copyManually', '手動でコピー', '직접 복사');
		}
	}

	async function initialize() {
		await window.AdminCommon?.ready;
		byId('access-expiry').value = defaultExpiryDate();
		byId('access-issue')?.addEventListener('click', issueCode);
		byId('access-copy')?.addEventListener('click', copyIssuedCode);
		byId('access-refresh')?.addEventListener('click', loadCodes);
		byId('access-search')?.addEventListener('input', renderCodes);
		byId('access-status-filter')?.addEventListener('change', renderCodes);
		byId('access-language-filter')?.addEventListener('change', renderCodes);
		document.addEventListener('adminlanguagechange', () => {
			renderCodes();
		});
		await loadCodes();
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
