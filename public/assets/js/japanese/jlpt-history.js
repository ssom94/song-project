(() => {
	const API = '/api/public/japanese/jlpt/dashboard';

	function lang() {
		return document.body.dataset.blogLanguage === 'ja' ? 'ja' : 'ko';
	}

	function t(ko, ja) {
		return lang() === 'ja' ? ja : ko;
	}

	function byId(id) {
		return document.getElementById(id);
	}

	function formatDate(value) {
		if (!value) return '—';
		const [year, month, day] = String(value).split('-');
		return year && month && day ? `${year}.${month}.${day}` : String(value);
	}

	function detailText(item) {
		const parts = [];
		if (item.newWords > 0) parts.push(`${t('신규', '新規')} ${item.newWords}`);
		if (item.review > 0) parts.push(`${t('복습', '復習')} ${item.review}`);
		if (item.vocabQuestions > 0) parts.push(`${t('어휘 문제', '語彙問題')} ${item.vocabQuestions}`);
		if (item.grammar > 0) parts.push(`${t('문법', '文法')} ${item.grammar}`);
		if (item.reading > 0) parts.push(`${t('독해', '読解')} ${item.reading}`);
		return parts.length ? parts.join(' · ') : t('학습 진행', '学習実施');
	}

	function renderDetailedSummary(summary) {
		const wrap = byId('jlpt-history-summary');
		if (!wrap) return;
		wrap.replaceChildren();
		const items = [
			[t('현재 연속 학습', '現在の連続学習'), summary.currentStreak, t('일', '日')],
			[t('최장 연속 학습', '最長連続学習'), summary.longestStreak, t('일', '日')],
			[t('총 학습일', '総学習日数'), summary.totalStudyDays, t('일', '日')],
			[t('누적 신규 단어', '累計新規単語'), summary.newWords, t('개', '語')],
		];
		for (const [label, value, unit] of items) {
			const card = document.createElement('article');
			const span = document.createElement('span');
			span.textContent = label;
			const strong = document.createElement('strong');
			strong.textContent = String(value ?? 0);
			const small = document.createElement('small');
			small.textContent = unit;
			card.append(span, strong, small);
			wrap.appendChild(card);
		}
	}

	function renderDetailedList(history) {
		const wrap = byId('jlpt-history-list');
		if (!wrap) return;
		wrap.replaceChildren();
		if (!history.length) {
			const empty = document.createElement('div');
			empty.className = 'jlpt-history-empty';
			empty.textContent = t('아직 JLPT 학습 이력이 없습니다. 학습을 시작하면 날짜별로 자동 누적됩니다.', 'JLPT学習履歴はまだありません。学習を開始すると日付ごとに自動で蓄積されます。');
			wrap.appendChild(empty);
			return;
		}
		for (const item of history) {
			const row = document.createElement('article');
			row.className = 'jlpt-history-row';
			const date = document.createElement('time');
			date.className = 'jlpt-history-date';
			date.dateTime = item.date;
			date.textContent = formatDate(item.date);
			const detail = document.createElement('div');
			detail.className = 'jlpt-history-detail';
			for (const part of detailText(item).split(' · ')) {
				const span = document.createElement('span');
				span.textContent = part;
				detail.appendChild(span);
			}
			const progress = document.createElement('span');
			progress.className = 'jlpt-history-progress';
			progress.textContent = `${item.progressPercent}%`;
			row.append(date, detail, progress);
			wrap.appendChild(row);
		}
	}

	function renderHomeSummary(summary) {
		const wrap = byId('jp-recent-study-summary');
		if (!wrap) return;
		wrap.replaceChildren();
		const labels = [
			`${t('연속', '連続')} ${summary.currentStreak ?? 0}${t('일', '日')}`,
			`${t('총 학습', '総学習')} ${summary.totalStudyDays ?? 0}${t('일', '日')}`,
			`${t('신규 단어', '新規単語')} ${summary.newWords ?? 0}${t('개', '語')}`,
		];
		for (const label of labels) {
			const chip = document.createElement('span');
			chip.textContent = label;
			wrap.appendChild(chip);
		}
	}

	function renderHomeList(history) {
		const wrap = byId('jp-recent-study-list');
		if (!wrap) return;
		wrap.replaceChildren();
		const recent = history.slice(0, 8);
		if (!recent.length) {
			const empty = document.createElement('div');
			empty.className = 'jp-empty-state';
			empty.textContent = t('학습을 시작하면 날짜별 기록이 이곳에 남습니다.', '学習を開始すると日付ごとの記録がここに残ります。');
			wrap.appendChild(empty);
			return;
		}
		for (const item of recent) {
			const row = document.createElement('article');
			row.className = 'jp-public-history-row';
			const time = document.createElement('time');
			time.dateTime = item.date;
			time.textContent = formatDate(item.date);
			const copy = document.createElement('p');
			copy.textContent = `${detailText(item)} · ${item.progressPercent}%`;
			row.append(time, copy);
			wrap.appendChild(row);
		}
	}

	async function initialize() {
		if (!byId('jlpt-history-list') && !byId('jp-recent-study-list')) return;
		try {
			const response = await fetch(API, { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
			const data = await response.json().catch(() => null);
			if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP_${response.status}`);
			const summary = data.historySummary || {};
			const history = Array.isArray(data.history) ? data.history : [];
			renderDetailedSummary(summary);
			renderDetailedList(history);
			renderHomeSummary(summary);
			renderHomeList(history);
		} catch (error) {
			console.error('Failed to load JLPT study history', error);
			const detailed = byId('jlpt-history-list');
			if (detailed) detailed.textContent = t('학습 이력을 불러오지 못했습니다.', '学習履歴を読み込めませんでした。');
			const home = byId('jp-recent-study-list');
			if (home) home.textContent = t('학습 이력을 불러오지 못했습니다.', '学習履歴を読み込めませんでした。');
		}
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();