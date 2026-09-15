(() => {
	'use strict';
	const ko = document.body.dataset.blogLanguage === 'ko';
	const t = (koText, jaText) => ko ? koText : jaText;

	const GODAN = {
		う: ['わ', 'い', 'え', 'お', 'って', 'った'], く: ['か', 'き', 'け', 'こ', 'いて', 'いた'],
		ぐ: ['が', 'ぎ', 'げ', 'ご', 'いで', 'いだ'], す: ['さ', 'し', 'せ', 'そ', 'して', 'した'],
		つ: ['た', 'ち', 'て', 'と', 'って', 'った'], ぬ: ['な', 'に', 'ね', 'の', 'んで', 'んだ'],
		ぶ: ['ば', 'び', 'べ', 'ぼ', 'んで', 'んだ'], む: ['ま', 'み', 'め', 'も', 'んで', 'んだ'],
		る: ['ら', 'り', 'れ', 'ろ', 'って', 'った'],
	};

	function isPart(word, name) { return Array.isArray(word.parts) && word.parts.some((part) => part.nameJa === name); }
	function forms(word) {
		const base = String(word.word || '');
		if (isPart(word, 'サ変名詞')) return suruForms(`${base}する`, base);
		if (isPart(word, 'サ変動詞')) {
			if (base.endsWith('ずる')) return zuruForms(base);
			return suruForms(base.endsWith('する') ? base : `${base}する`, base.replace(/する$/, ''));
		}
		if (isPart(word, 'カ変動詞')) return kuruForms(base);
		if (isPart(word, '一段動詞')) {
			const stem = base.endsWith('る') ? base.slice(0, -1) : base;
			return { type: t('1단동사', '一段動詞'), dictionary: base, polite: `${stem}ます`, negative: `${stem}ない`, te: `${stem}て`, past: `${stem}た`, potential: `${stem}られる`, passive: `${stem}られる`, causative: `${stem}させる`, causativePassive: `${stem}させられる`, requestPermission: `${stem}させてください`, volitional: `${stem}よう`, imperative: `${stem}ろ`, conditional: `${stem}れば` };
		}
		if (isPart(word, '五段動詞')) {
			const ending = base.slice(-1), row = GODAN[ending]; if (!row) return null;
			const stem = base.slice(0, -1), [a, i, e, o, te, past] = row;
			const actualTe = base === '行く' ? '行って' : `${stem}${te}`;
			const actualPast = base === '行く' ? '行った' : `${stem}${past}`;
			return { type: t('5단동사', '五段動詞'), dictionary: base, polite: `${stem}${i}ます`, negative: `${stem}${a}ない`, te: actualTe, past: actualPast, potential: `${stem}${e}る`, passive: `${stem}${a}れる`, causative: `${stem}${a}せる`, causativePassive: `${stem}${a}せられる`, requestPermission: `${stem}${a}せてください`, volitional: `${stem}${o}う`, imperative: `${stem}${e}`, conditional: `${stem}${e}ば` };
		}
		return null;
	}
	function suruForms(base, stem) { return { type: t('サ변격 동사', 'サ変動詞'), dictionary: base, polite: `${stem}します`, negative: `${stem}しない`, te: `${stem}して`, past: `${stem}した`, potential: `${stem}できる`, passive: `${stem}される`, causative: `${stem}させる`, causativePassive: `${stem}させられる`, requestPermission: `${stem}させてください`, volitional: `${stem}しよう`, imperative: `${stem}しろ`, conditional: `${stem}すれば` }; }
	function zuruForms(base) { const stem = base.slice(0, -2); return { type: t('サ변격 동사(ずる형)', 'サ変動詞（ずる型）'), dictionary: base, polite: `${stem}じます`, negative: `${stem}じない`, te: `${stem}じて`, past: `${stem}じた`, potential: `${stem}じられる`, passive: `${stem}じられる`, causative: `${stem}じさせる`, causativePassive: `${stem}じさせられる`, requestPermission: `${stem}じさせてください`, volitional: `${stem}じよう`, imperative: `${stem}じろ`, conditional: `${stem}ずれば` }; }
	function kuruForms(base) { const prefix = base.endsWith('来る') ? base.slice(0, -2) : ''; return { type: t('カ변격 동사', 'カ変動詞'), dictionary: base, polite: `${prefix}来ます`, negative: `${prefix}来ない`, te: `${prefix}来て`, past: `${prefix}来た`, potential: `${prefix}来られる`, passive: `${prefix}来られる`, causative: `${prefix}来させる`, causativePassive: `${prefix}来させられる`, requestPermission: `${prefix}来させてください`, volitional: `${prefix}来よう`, imperative: `${prefix}来い`, conditional: `${prefix}来れば` }; }

	function render(word) {
		const values = forms(word); if (!values) return;
		const main = document.querySelector('.jp-word-detail-main'); const example = document.getElementById('jp-word-detail-example')?.closest('.jp-word-detail-section');
		if (!main || !example) return;
		const rows = [
			['dictionary', t('사전형', '辞書形'), t('기본형', '基本形')], ['polite', t('정중형', '丁寧形'), t('~합니다', '〜ます')],
			['negative', t('부정형', '否定形'), t('~하지 않는다', '〜しない')], ['te', 'て형', t('연결·요청의 기본형', '接続・依頼の基本')],
			['past', t('과거형', '過去形'), t('~했다', '〜した')], ['potential', t('가능형', '可能形'), t('~할 수 있다', '〜できる')],
			['passive', t('수동형', '受身形'), t('~당하다·~되다', '〜される')], ['causative', t('사역형', '使役形'), t('~하게 하다', '〜させる')],
			['causativePassive', t('사역수동형', '使役受身形'), t('억지로 ~하게 되다', '無理に〜させられる')], ['requestPermission', t('사역 요청', '使役の依頼'), t('제가 ~하게 해주세요', '私に〜させてください')],
			['volitional', t('의지형', '意向形'), t('~하자·~해야겠다', '〜しよう')], ['imperative', t('명령형', '命令形'), t('~해라', '〜しろ')], ['conditional', t('조건형', '仮定形'), t('~하면', '〜すれば')],
		];
		const section = document.createElement('section'); section.className = 'jp-word-detail-section jp-verb-conjugation';
		section.innerHTML = `<div class="jp-word-detail-section-heading"><h2>${t('동사 활용', '動詞活用')}</h2><span>${values.type}</span></div><p class="jp-verb-note">${t('표준 일본어 활용입니다. 가능형과 수동형이 같은 경우에는 문맥과 조사로 의미를 구분합니다.', '標準的な活用です。可能形と受身形が同形の場合は文脈と助詞で区別します。')}</p><div class="jp-verb-table">${rows.map(([key,label,meaning]) => `<div><b>${label}</b><strong>${values[key]}</strong><span>${meaning}</span></div>`).join('')}</div>`;
		example.insertAdjacentElement('afterend', section);
	}

	window.SongVerbConjugation = { render, forms };
})();
