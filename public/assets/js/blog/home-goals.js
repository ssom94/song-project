(() => {
	let dashboardSnapshot = null;

	function language() {
		return document.body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
	}

	function copy() {
		return language() === 'ko'
			? {
				progress: '진행률', planned: '예정', progressing: '진행 중', done: '완료',
				dateNotSet: '목표일 미설정', goals: (count) => `${count}개 목표`, empty: '표시 중인 목표가 없습니다.',
				details: {
					'jlpt-n1': '단어 학습 + 시험 합격',
					ap: '응용정보기술자시험',
					fp: 'FP 자격 취득',
					'aws-saa': 'Solutions Architect – Associate',
					portfolio: '포트폴리오 완성',
				},
			}
			: {
				progress: '進捗', planned: '予定', progressing: '進行中', done: '完了',
				dateNotSet: '目標日未設定', goals: (count) => `${count} Goals`, empty: '表示中の目標はありません。',
				details: {
					'jlpt-n1': '語彙学習 + 試験合格',
					ap: '応用情報技術者試験',
					fp: 'FP 資格取得',
					'aws-saa': 'Solutions Architect – Associate',
					portfolio: 'ポートフォリオ完成',
				},
			};
	}

	function clampPercent(value) {
		const parsed = Number(value);
		if (!Number.isFinite(parsed)) return 0;
		return Math.max(0, Math.min(100, Math.round(parsed)));
	}

	function formatDate(value) {
		if (!value) return '';
		const date = new Date(`${value}T00:00:00Z`);
		if (Number.isNaN(date.getTime())) return '';
		return new Intl.DateTimeFormat(language() === 'ko' ? 'ko-KR' : 'ja-JP', {
			year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC',
		}).format(date);
	}

	function iconForGoal(goal) {
		const fixed = {
			'jlpt-n1': 'N1', ap: 'AP', fp: 'FP', 'aws-saa': 'AWS', portfolio: 'PF',
		};
		if (fixed[goal.goalKey]) return fixed[goal.goalKey];
		const source = String(goal.title || '+').trim();
		return source.slice(0, 2).toUpperCase() || '+';
	}

	function detailForGoal(goal) {
		const labels = copy();
		const base = labels.details[goal.goalKey] || '';
		const date = formatDate(goal.targetDate);
		if (base && date) return `${base} · ${date}`;
		if (base) return base;
		if (date) return date;
		return labels.dateNotSet;
	}

	function statusForGoal(goal) {
		const labels = copy();
		if (goal.status === 'done') return labels.done;
		if (goal.status === 'progress') return labels.progressing;
		return labels.planned;
	}

	function createGoalRow(goal) {
		const labels = copy();
		const percent = clampPercent(goal.progressPercent);
		const row = document.createElement('article');
		row.className = `home-goal-item home-goal-status-${goal.status || 'planned'}`;
		row.dataset.goalKey = goal.goalKey || '';
		const main = document.createElement('div');
		main.className = 'home-goal-main';
		const icon = document.createElement('span');
		icon.className = 'home-goal-icon';
		icon.textContent = iconForGoal(goal);
		const mainCopy = document.createElement('div');
		const title = document.createElement('strong');
		title.textContent = goal.title || '';
		const detail = document.createElement('small');
		detail.textContent = detailForGoal(goal);
		mainCopy.append(title, detail);
		main.append(icon, mainCopy);
		const progressWrap = document.createElement('div');
		progressWrap.className = 'home-goal-progress';
		const progressHead = document.createElement('div');
		const progressLabel = document.createElement('span');
		const percentLabel = document.createElement('b');
		percentLabel.textContent = `${percent}%`;
		const progress = document.createElement('progress');
		if (goal.goalType === 'count' && Number(goal.targetCount) > 0) {
			const target = Math.max(1, Number(goal.targetCount));
			const completed = Math.max(0, Math.min(target, Number(goal.completedCount) || 0));
			progressLabel.textContent = `${completed} / ${target}`;
			progress.max = target;
			progress.value = completed;
		} else {
			progressLabel.textContent = labels.progress;
			progress.max = 100;
			progress.value = percent;
		}
		progressHead.append(progressLabel, percentLabel);
		progressWrap.append(progressHead, progress);
		const state = document.createElement('span');
		state.className = 'home-goal-state';
		state.textContent = statusForGoal(goal);
		row.append(main, progressWrap, state);
		return row;
	}

	function renderDashboard(result) {
		dashboardSnapshot = result;
		const goals = Array.isArray(result?.goals) ? result.goals : [];
		const list = document.querySelector('#goals .home-goal-list');
		if (list instanceof HTMLElement) {
			list.replaceChildren();
			if (goals.length === 0) {
				const empty = document.createElement('div');
				empty.className = 'home-goal-empty';
				empty.textContent = copy().empty;
				list.appendChild(empty);
			} else {
				const fragment = document.createDocumentFragment();
				for (const goal of goals) fragment.appendChild(createGoalRow(goal));
				list.appendChild(fragment);
			}
		}
		const count = document.querySelector('#goals .home-goal-count');
		if (count) count.textContent = copy().goals(goals.length);
		const completed = goals.filter((goal) => goal?.status === 'done').length;
		const completedNode = document.getElementById('home-completed-goals');
		const totalNode = document.getElementById('home-total-goals');
		if (completedNode) completedNode.textContent = String(completed);
		if (totalNode) totalNode.textContent = String(goals.length);
		const jlptSection = document.getElementById('jlpt-progress');
		if (jlptSection instanceof HTMLElement) jlptSection.hidden = result?.settings?.showJlpt === false;
		if (result?.learning) {
			window.HomeDashboard?.setLearningSnapshot?.({
				goalMode: result?.settings?.jlptGoalMode === 'manual' ? 'manual' : 'auto',
				manualTarget: result?.settings?.jlptManualTarget ?? null,
				registeredWords: Number(result.learning.registeredWords ?? 0),
				masteredWords: Number(result.learning.masteredWords ?? 0),
				uncertainWords: Number(result.learning.uncertainWords ?? 0),
				unlearnedWords: Number(result.learning.unlearnedWords ?? 0),
			});
		}
	}

	async function loadDashboard() {
		try {
			const response = await fetch('/api/public/dashboard', { method: 'GET', cache: 'no-store', credentials: 'same-origin' });
			const result = await response.json().catch(() => null);
			if (!response.ok || !result?.ok) throw new Error(result?.error || `HTTP_${response.status}`);
			renderDashboard(result);
		} catch (error) {
			console.error('Failed to load public goal dashboard', error);
		}
	}

	function rerenderForLanguage() {
		if (dashboardSnapshot) renderDashboard(dashboardSnapshot);
	}

	function initialize() {
		loadDashboard();
		document.querySelectorAll('[data-home-language]').forEach((button) => {
			button.addEventListener('click', () => window.setTimeout(rerenderForLanguage, 0));
		});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
	else initialize();
})();
