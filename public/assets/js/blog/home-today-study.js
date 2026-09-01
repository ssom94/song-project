(() => {
	const byId = (id) => document.getElementById(id);
	const jstToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
	const currentLanguage = () => document.querySelector('[data-home-language].is-active')?.dataset.homeLanguage || document.body.dataset.blogLanguage || 'ja';
	const t = (ko, ja) => currentLanguage() === 'ko' ? ko : ja;

	async function requestJson(url) {
		const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
		const data = await response.json().catch(() => null);
		if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP_${response.status}`);
		return data;
	}

	function injectStyle() {
		if (byId('home-today-study-style')) return;
		const style = document.createElement('style');
		style.id = 'home-today-study-style';
		style.textContent = `
			.home-today-study{margin:18px 0 24px}.home-today-study-head{display:flex;justify-content:space-between;align-items:end;gap:12px;margin-bottom:12px}.home-today-study-head h2{margin:3px 0 0;font-size:1.35rem}.home-today-study-head p{margin:0;color:#6b778c;font-size:.9rem}.home-today-study-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.home-study-card{display:block;padding:18px;border:1px solid #dce3ea;border-radius:16px;background:#fff;color:inherit;text-decoration:none;box-shadow:0 6px 18px rgba(38,54,78,.05);transition:transform .15s ease,box-shadow .15s ease}.home-study-card:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(38,54,78,.1)}.home-study-card-top{display:flex;justify-content:space-between;align-items:center;gap:10px}.home-study-card-kicker{font-size:.76rem;font-weight:900;letter-spacing:.08em;color:#65758b}.home-study-card-state{padding:5px 9px;border-radius:999px;background:#eef3f7;font-size:.76rem;font-weight:800}.home-study-card h3{margin:12px 0 4px;font-size:1.15rem}.home-study-card p{margin:0;color:#68778a;line-height:1.55}.home-study-card-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px}.home-study-card-stats span{padding:9px;border-radius:10px;background:#f7f9fb;text-align:center;font-size:.78rem;color:#66758a}.home-study-card-stats b{display:block;margin-top:3px;color:#26364e;font-size:1rem}.home-study-card-cta{display:block;margin-top:14px;font-weight:900;color:#26364e}.home-today-study-loading{color:#6b778c}.home-today-study-error{color:#9b2c2c}@media(max-width:760px){.home-today-study-grid{grid-template-columns:1fr}.home-today-study-head{align-items:start;flex-direction:column}}
		`;
		document.head.appendChild(style);
	}

	function ensureLayout() {
		const content = document.querySelector('.blog-dashboard-content');
		const heading = content?.querySelector('.home-dashboard-heading');
		const schedule = byId('schedule-manager');
		const topGrid = content?.querySelector('.home-dashboard-grid-top');
		if (!content || !heading || !schedule || !topGrid) return false;

		if (heading.nextElementSibling !== schedule) heading.after(schedule);
		let section = byId('home-today-study');
		if (!section) {
			section = document.createElement('section');
			section.id = 'home-today-study';
			section.className = 'home-today-study';
			schedule.after(section);
		}
		return true;
	}

	function shellHtml() {
		return `<div class="home-today-study-head"><div><span class="home-card-kicker">TODAY STUDY</span><h2>${t('오늘의 학습','今日の学習')}</h2></div><p>${jstToday()}</p></div><div class="home-today-study-grid"><div class="home-study-card home-today-study-loading">${t('학습 데이터를 불러오는 중입니다.','学習データを読み込んでいます。')}</div><div class="home-study-card home-today-study-loading">${t('학습 데이터를 불러오는 중입니다.','学習データを読み込んでいます。')}</div></div>`;
	}

	function jlptCard(data) {
		const lang = currentLanguage();
		const href = lang === 'ko' ? '/ko/japanese/jlpt/' : '/ja/japanese/jlpt/';
		const words = Array.isArray(data?.words) ? data.words.length : 0;
		const questions = Array.isArray(data?.questions) ? data.questions.length : 0;
		const grammar = Array.isArray(data?.grammar) ? data.grammar.length : 0;
		const readings = Array.isArray(data?.readings) ? data.readings.length : 0;
		const available = words + questions + grammar + readings > 0;
		return `<a class="home-study-card" href="${href}"><div class="home-study-card-top"><span class="home-study-card-kicker">JLPT N1</span><span class="home-study-card-state">${available ? t('학습 가능','学習可能') : t('데이터 없음','データなし')}</span></div><h3>${t('오늘의 JLPT N1','今日のJLPT N1')}</h3><p>${t('신규 단어부터 어휘·문법·독해까지 오늘 분량으로 이동합니다.','新規単語から語彙・文法・読解まで今日の学習へ移動します。')}</p><div class="home-study-card-stats"><span>${t('단어','単語')}<b>${words}</b></span><span>${t('문제','問題')}<b>${questions}</b></span><span>${t('문법/독해','文法/読解')}<b>${grammar}/${readings}</b></span></div><span class="home-study-card-cta">${t('JLPT 학습으로 이동 →','JLPT学習へ →')}</span></a>`;
	}

	function apCard(data) {
		const lang = currentLanguage();
		const href = lang === 'ko' ? '/ko/study/ap/' : '/ja/study/ap/';
		const today = data?.today || {};
		const items = Array.isArray(today.items) ? today.items : [];
		const completed = items.filter((item) => item.status === 'completed').length;
		const status = today.status === 'completed' ? t('완료','完了') : today.status === 'not_started' ? t('시작 전','未開始') : t('진행 중','進行中');
		return `<a class="home-study-card" href="${href}"><div class="home-study-card-top"><span class="home-study-card-kicker">AP</span><span class="home-study-card-state">${status}</span></div><h3>${t('오늘의 AP','今日のAP')}</h3><p>${t('복습·개념·科目A·科目B로 구성된 오늘 분량으로 이동합니다.','復習・概念・科目A・科目Bで構成された今日の学習へ移動します。')}</p><div class="home-study-card-stats"><span>${t('항목','項目')}<b>${items.length}</b></span><span>${t('완료','完了')}<b>${completed}</b></span><span>${t('배정시간','予定時間')}<b>${Number(today.targetMinutes || 0)}m</b></span></div><span class="home-study-card-cta">${t('AP 학습으로 이동 →','AP学習へ →')}</span></a>`;
	}

	async function render() {
		if (!ensureLayout()) return;
		injectStyle();
		const section = byId('home-today-study');
		section.innerHTML = shellHtml();
		const grid = section.querySelector('.home-today-study-grid');
		const [jlpt, ap] = await Promise.allSettled([
			requestJson(`/api/public/japanese/jlpt/practice?date=${encodeURIComponent(jstToday())}`),
			requestJson('/api/public/ap/dashboard'),
		]);
		grid.innerHTML = '';
		if (jlpt.status === 'fulfilled') grid.insertAdjacentHTML('beforeend', jlptCard(jlpt.value));
		else grid.insertAdjacentHTML('beforeend', `<div class="home-study-card home-today-study-error"><b>JLPT N1</b><p>${t('오늘의 학습 데이터를 불러오지 못했습니다.','今日の学習データを読み込めませんでした。')}</p></div>`);
		if (ap.status === 'fulfilled') grid.insertAdjacentHTML('beforeend', apCard(ap.value));
		else grid.insertAdjacentHTML('beforeend', `<div class="home-study-card home-today-study-error"><b>AP</b><p>${t('오늘의 학습 데이터를 불러오지 못했습니다.','今日の学習データを読み込めませんでした。')}</p></div>`);
	}

	document.querySelectorAll('[data-home-language]').forEach((button) => button.addEventListener('click', () => setTimeout(render, 0)));
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render, { once: true });
	else render();
})();
