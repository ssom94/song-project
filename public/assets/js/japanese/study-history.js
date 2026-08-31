(() => {
	const API = '/api/public/japanese/jlpt/dashboard';
	const INITIAL_COUNT = 20;
	const STEP_COUNT = 20;
	let items = [];
	let visibleCount = INITIAL_COUNT;

	function language() {
		return document.body.dataset.blogLanguage === 'ja' ? 'ja' : 'ko';
	}

	function copy() {
		return language() === 'ja'
			? {
				empty: 'まだ公開できる学習履歴がありません。',
				loadFailed: '学習履歴を読み込めませんでした。',
				completed: '完了',
				inProgress: '学習中',
				notStarted: '未完了',
				review: '復習',
				newWords: '新規単語',
				vocab: '語彙問題',
				grammar: '文法',
				reading: '読解',
				more: 'さらに表示',
				allShown: 'すべて表示済み',
				recordedDays: '学習記録日',
				completedDays: '完了日',
				totalNewWords: '新規学習単語',
				totalReviews: '復習単語',
			}
			: {
				empty: '아직 공개할 학습 이력이 없습니다.',
				loadFailed: '학습 이력을 불러오지 못했습니다.',
				completed: '완료',
				inProgress: '학습 중',
				notStarted: '미완료',
				review: '복습',
				newWords: '신규 단어',
				vocab: '어휘 문제',
				grammar: '문법',
				reading: '독해',
				more: '더 보기',
				allShown: '전체 표시 완료',
				recordedDays: '학습 기록일',
				completedDays: '완료일',
				totalNewWords: '신규 학습 단어',
				totalReviews: '복습 단어',
			};
	}

	function formatDate(value) {
		const [year, month, day] = String(value || '').split('-');
		if (!year || !month || !day) return value || '—';
		return `${year}.${month}.${day}`;
	}

	function statusLabel(status) {
		const labels = copy();
		if (status === 'completed') return labels.completed;
		if (status === 'in_progress') return labels.inProgress;
		return labels.notStarted;
	}

	function metric(label, data) {
		const wrap = document.createElement('span');
		wrap.className = 'jp-study-history-metric';
		const name = document.createElement('b');
		name.textContent = label;
		const count = document.createElement('span');
		count.textContent = `${Number(data?.completed ?? 0)} / ${Number(data?.target ?? 0)}`;
		wrap.append(name, count);
		return wrap;
	}

	function createRow(item) {
		const labels = copy();
		const row = document.createElement('article');
		row.className = 'jp-study-history-row';
		row.dataset.status = item.status || 'not_started';

		const date = document.createElement('div');
		date.className = 'jp-study-history-date';
		const strong = document.createElement('strong');
		strong.textContent = formatDate(item.date);
		const badge = document.createElement('span');
		badge.className = 'jp-study-history-status';
		badge.textContent = `${statusLabel(item.status)} · ${Number(item.progressPercent ?? 0)}%`;
		date.append(strong, badge);

		const metrics = document.createElement('div');
		metrics.className = 'jp-study-history-metrics';
		metrics.append(
			metric(labels.review, item.review),
			metric(labels.newWords, item.newWords),
			metric(labels.vocab, item.vocabQuestions),
			metric(labels.grammar, item.grammar),
			metric(labels.reading, item.reading),
		);

		const progress = document.createElement('div');
		progress.className = 'jp-study-history-progress';
		const fill = document.createElement('span');
		fill.style.width = `${Math.max(0, Math.min(100, Number(item.progressPercent ?? 0)))}%`;
		progress.appendChild(fill);

		row.append(date, metrics, progress);
		return row;
	}

	function renderSummary(summary) {
		const labels = copy();
		const wrap = document.getElementById('jp-study-history-summary');
		if (!wrap) return;
		wrap.replaceChildren();
		const values = [
			[labels.recordedDays, summary?.recordedDays ?? 0],
			[labels.completedDays, summary?.completedDays ?? 0],
			[labels.totalNewWords, summary?.totalNewWords ?? 0],
			[labels.totalReviews, summary?.totalReviews ?? 0],
		];
		for (const [label, value] of values) {
			const item = document.createElement('div');
			const span = document.createElement('span');
			span.textContent = label;
			const strong = document.createElement('strong');
			strong.textContent = String(value);
			item.append(span, strong);
			wrap.appendChild(item);
		}
	}

	function renderList() {
		const list = document.getElementById('jp-study-history-list');
		const more = document.getElementById('jp-study-history-more');
		if (!list) return;
		list.replaceChildren();
		if (!items.length) {
			const empty = document.createElement('div');
			empty.className = 'jp-empty-state';
			empty.textContent = copy().empty;
			list.appendChild(empty);
			if (more) more.hidden = true;
			return;
		}
		for (const item of items.slice(0, visibleCount)) list.appendChild(createRow(item));
		if (more) {
			more.hidden = false;
			more.disabled = visibleCount >= items.length;
			more.textContent = visibleCount >= items.length ? copy().allShown : copy().more;
		}
	}

	async function initialize() {
		const more = document.getElementById('jp-study-history-more');
		more?.addEventListener('click', () => {
			visibleCount += STEP_COUNT;
			renderList();
		});
		try {
			const response = await fetch(API, { cache: 'no-store', credentials: 'same-origin' });
			const data = await response.json().catch(() => null);
			if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP_${response.status}`);
			items = Array.isArray(data.history) ? data.history : [];
			renderSummary(data.historySummary || {});
			renderList();
		} catch (error) {
			console.error('Failed to load public study history', error);
			const list = document.getElementById('jp-study-history-list');
			if (list) {
				list.replaceChildren();
				const empty = document.createElement('div');
				empty.className = 'jp-empty-state';
				empty.textContent = copy().loadFailed;
				list.appendChild(empty);
			}
		}
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();