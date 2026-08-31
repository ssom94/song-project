(() => {
	const language = document.body.dataset.blogLanguage === 'ja' ? 'ja' : 'ko';
	const text = language === 'ja'
		? { login: '管理者ログイン後に誤答ノートを確認できます。', failed: '誤答ノートを読み込めませんでした。', empty: 'まだ誤答履歴がありません。', count: '誤答単語', answer: '最後の自分の答え', correct: '正解', wrongs: '誤答回数', last: '最終誤答' }
		: { login: '관리자 로그인 후 오답노트를 확인할 수 있습니다.', failed: '오답노트를 불러오지 못했습니다.', empty: '아직 오답 이력이 없습니다.', count: '오답 단어', answer: '마지막 내 답', correct: '정답', wrongs: '오답 횟수', last: '마지막 오답' };
	const byId = (id) => document.getElementById(id);
	const escapeHtml = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

	function correctAnswer(note) {
		return note.last_wrong_quiz_type === 'reading' ? (note.reading || '-') : (note.meaning_ko || '-');
	}

	async function load() {
		try {
			const response = await fetch('/api/admin/ap/vocabulary/wrong-notes', { credentials: 'same-origin', cache: 'no-store' });
			const data = await response.json().catch(() => null);
			if (response.status === 401) throw Object.assign(new Error('UNAUTHORIZED'), { status: 401 });
			if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP_${response.status}`);
			byId('ap-wrong-count').textContent = `${text.count} ${data.count}`;
			const list = byId('ap-wrong-list');
			if (!data.notes.length) {
				list.innerHTML = `<p class="ap-vocab-empty">${escapeHtml(text.empty)}</p>`;
				return;
			}
			list.innerHTML = data.notes.map((note) => {
				const topic = language === 'ja' ? note.topic_title_ja : note.topic_title_ko;
				return `<article class="ap-vocab-row">
					<div class="ap-vocab-term"><strong>${escapeHtml(note.term)}</strong><small>${escapeHtml(note.reading || '')}</small></div>
					<div class="ap-vocab-meaning"><b>${escapeHtml(note.meaning_ko || '')}</b><div class="ap-vocab-meta">${escapeHtml(topic || '-')} · ${escapeHtml(text.wrongs)} ${note.wrong_count} · ${escapeHtml(text.last)} ${escapeHtml(note.last_wrong_at || '-')}</div>${note.source_text ? `<div class="ap-vocab-meta">${escapeHtml(note.source_text)}</div>` : ''}<div class="ap-vocab-answer"><b>${escapeHtml(text.answer)}</b> ${escapeHtml(note.last_wrong_answer || '(빈 답안)')}<br/><b>${escapeHtml(text.correct)}</b> ${escapeHtml(correctAnswer(note))}</div></div>
					<span class="ap-vocab-stat">✕ ${note.wrong_count}</span>
				</article>`;
			}).join('');
		} catch (error) {
			console.error('Failed to load AP vocabulary wrong notes', error);
			const target = byId('ap-wrong-error');
			target.textContent = error.status === 401 ? text.login : text.failed;
			target.hidden = false;
		}
	}
	load();
})();
