import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const isBatch2 = process.argv[2] === 'batch2';
const FILE = path.join(ROOT, 'data', 'jlpt', 'production', 'batches', isBatch2 ? '2026-10-15--2026-10-28.content-draft.json' : '2026-10-01--2026-10-14.content-draft.json');

const batch1Grammar = [
	['〜あっての', '〜이 있어야 비로소', '支えてくれる地域の人々あっての祭りなので、主催者だけの判断では変えられない。', '顧客あっての商売だという基本を忘れてはならない。'],
	['〜いかんでは', '〜여하에 따라서는', '今後の交渉の進み方いかんでは、計画を根本から見直す必要もある。', '検査の結果いかんでは、追加の調査を行うことになる。'],
	['〜いかんにかかわらず', '〜여하에 관계없이', '理由のいかんにかかわらず、許可なく資料を持ち出してはならない。', '経験の有無いかんにかかわらず、応募者には同じ課題が課される。'],
	['〜ずにはおかない', '반드시 〜하게 만들다', '彼の真摯な訴えは、聞く者の心を動かさずにはおかない。', 'この作品は、社会の在り方を考えさせずにはおかない。'],
	['〜ずにはすまない', '〜하지 않고는 끝나지 않다', 'こちらの手違いで迷惑をかけた以上、謝罪せずにはすまない。', '規則に違反したからには、何らかの処分を受けずにはすまない。'],
	['〜そばから', '〜하자마자 곧', '新しい単語を覚えたそばから忘れてしまい、復習の必要性を痛感した。', '片づけるそばから子どもが玩具を出すので、部屋がなかなか整わない。'],
	['〜たところで', '〜해 보아도', '今さら言い訳をしたところで、失った信頼がすぐ戻るわけではない。', '一人で考えたところで解決しないのだから、専門家に相談した方がよい。'],
	['〜だに', '〜하기만 해도', '事故当時の状況は、想像するだに恐ろしい。', '故郷を離れる日のことは、考えるだに寂しくなる。'],
	['〜たりとも', '단 하나라도', '試験中は一秒たりとも気を抜くことができなかった。', '限られた予算なので、一円たりとも無駄にはできない。'],
	['〜であれ', '〜라 할지라도', 'どのような事情であれ、事実を意図的に隠すことは許されない。', '相手が誰であれ、礼儀をもって接するべきだ。'],
	['〜てからというもの', '〜하고 나서부터 줄곧', '子どもが生まれてからというもの、時間の使い方を強く意識するようになった。', '在宅勤務を始めてからというもの、生活のリズムが大きく変わった。'],
	['〜てやまない', '진심으로 계속 〜하다', '被災地が一日も早く復興することを願ってやまない。', '若い研究者の今後の活躍を期待してやまない。'],
	['〜とあって', '〜라는 특별한 상황이라', '連休初日とあって、駅は朝から旅行客で混雑していた。', '人気作家の講演会とあって、会場には大勢の人が集まった。'],
	['〜とあれば', '〜라면', '家族の安全のためとあれば、多少の出費は惜しまない。', '地域の復興に役立つとあれば、喜んで協力したい。'],
	['〜といえども', '〜라 할지라도', '専門家といえども、将来を完全に予測することはできない。', '小さなミスといえども、重大事故につながる可能性がある。'],
	['〜なくして', '〜없이는', '関係者の協力なくして、この大規模な調査は実現しなかった。', '地道な努力なくして、技術の向上は望めない。'],
	['〜ならでは', '〜이기에 가능한', 'これは長年現場を経験した職人ならではの工夫だ。', '四季の変化に富むこの地域ならではの景色を楽しめる。'],
	['〜に即して', '〜에 입각하여', '現場の実情に即して、作業手順を柔軟に見直す必要がある。', '法律の趣旨に即して制度を運用しなければならない。'],
	['〜にたえる', '〜할 가치가 있다', '長年の調査に基づくこの報告書は、十分検討にたえる内容だ。', 'この映画は大人の鑑賞にもたえる完成度を備えている。'],
	['〜に足る', '〜할 만하다', 'その研究成果は、国際的にも評価に足るものだ。', '彼は重要な情報を任せるに足る信頼できる人物だ。'],
	['〜にもまして', '〜보다도 더욱', '今年は昨年にもまして、外国からの観光客が増えている。', '試合の結果にもまして、最後まで諦めない姿勢が印象に残った。'],
	['〜ばこそ', '바로 〜이기 때문에', '信頼していればこそ、問題点も率直に指摘するのだ。', '将来を大切に思えばこそ、今は厳しい判断も必要になる。'],
	['〜べからず', '〜해서는 안 된다', '初心忘るべからずという言葉を胸に、基本を繰り返し確認した。', '関係者以外、ここに立ち入るべからず。'],
	['〜までもない', '〜할 필요도 없다', '結果は言うまでもなく、取り組む過程にも大きな価値がある。', '簡単な計算なので、電卓を使うまでもない。'],
	['〜もさることながら', '〜도 물론이지만', '商品の性能もさることながら、購入後の支援体制も重要だ。', '語彙力もさることながら、文章全体の論理を追う力が求められる。'],
	['〜を皮切りに', '〜을 시작으로', '東京公演を皮切りに、全国十都市を巡るツアーが始まる。', '今回の共同研究を皮切りに、両大学は交流を拡大する方針だ。'],
	['〜を禁じ得ない', '〜을 금할 수 없다', '繰り返される不正の報道に、強い憤りを禁じ得ない。', '彼の置かれた状況を知り、同情を禁じ得なかった。'],
	['〜をものともせず', '〜을 아랑곳하지 않고', '選手たちは激しい雨をものともせず、最後まで走り続けた。', '彼女は周囲の反対をものともせず、新しい事業に挑戦した。'],
];

const batch2Grammar = [
	['〜あまり', '너무 〜한 나머지', '結果を急ぐあまり、確認すべき手順を省いてしまった。', '緊張のあまり、質問にうまく答えられなかった。'],
	['〜あって', '〜이기에; 〜가 있어서', '長年の信頼関係あって、今回の協力が実現した。', '皆の支えあっての成果だと、本人は語った。'],
	['〜いかんだ', '〜에 달려 있다', '計画が成功するかどうかは、準備いかんだ。', '採用するか否かは、面接の内容いかんで決まる。'],
	['〜以上は', '〜한 이상은', '引き受けた以上は、最後まで責任を果たしたい。', '規則を定めた以上は、例外なく守る必要がある。'],
	['〜ようが', '아무리 〜해도', 'どれほど説明しようが、事実そのものは変わらない。', '誰が反対しようが、必要な改革は進めるべきだ。'],
	['〜ようと', '설령 〜하더라도', '事情がどうであろうと、期限は守らなければならない。', 'どんなに困難であろうと、方法を探し続ける。'],
	['〜得る', '〜할 수 있다', 'その判断は、状況によっては十分起こり得る。', 'この装置なら、微小な変化も検出し得る。'],
	['〜かたがた', '〜하는 겸', 'ご報告かたがた、日頃のお礼を申し上げます。', '近況を伺いかたがた、先生を訪ねた。'],
	['〜限りだ', '더없이 〜하다', '長年の努力が認められ、うれしい限りだ。', 'このような機会をいただき、光栄の限りです。'],
	['〜かねない', '〜할 우려가 있다', '曖昧な説明は、かえって誤解を招きかねない。', '小さな不備でも、重大な事故につながりかねない。'],
	['〜かねる', '〜하기 어렵다', 'その件については、今ここでお答えしかねます。', '根拠が不十分なため、結論を出しかねている。'],
	['〜が早いか', '〜하자마자', 'ベルが鳴るが早いか、学生たちは教室を出て行った。', '知らせを聞くが早いか、彼は現場へ向かった。'],
	['〜からある', '무려 〜이나 되는', '会場には千人からある参加者が集まった。', 'この資料には百ページからある詳細な記録が残っている。'],
	['〜きらいがある', '〜하는 경향이 있다', 'この議論は感情的になりきらいがある。', '便利な道具に頼りすぎるきらいがある。'],
	['〜極まる', '극히 〜하다', 'このような対応は失礼極まる。', '安全を軽視するとは、危険極まる行為だ。'],
	['〜ごとき', '〜같은; 〜따위', '私ごとき者に重要な役目が務まるでしょうか。', '一度の失敗ごときで、目標を諦めてはいけない。'],
	['〜始末だ', '결국 〜한 지경이다', '準備を怠った結果、締切に間に合わない始末だ。', '連絡を忘れたばかりに、相手を待たせる始末になった。'],
	['〜ずくめ', '온통 〜뿐', '今日は朝から良い知らせずくめだった。', '旅行中は予想外の出来事ずくめで、忘れられない思い出になった。'],
	['〜すら', '〜조차', '忙しくて昼食を取る時間すらなかった。', '基本的な用語すら理解していない。'],
	['〜そびれる', '〜할 기회를 놓치다', '質問したいことがあったが、聞きそびれてしまった。', '混雑していて、昼食を食べそびれた。'],
	['〜たるもの', '〜인 이상', '指導者たるもの、冷静な判断を示さなければならない。', '専門家たるもの、根拠を明確に説明すべきだ。'],
	['〜たとたん', '〜하자마자', '窓を開けたとたん、強い風が吹き込んできた。', '発表が終わったとたん、会場から質問が相次いだ。'],
	['〜つつある', '점차 〜하고 있다', '社会の価値観は少しずつ変わりつつある。', '技術の進歩によって、働き方も変化しつつある。'],
	['〜てしかるべき', '당연히 〜해야 한다', '重要な変更は、事前に説明されてしかるべきだ。', '努力した人が評価されてしかるべきだ。'],
	['〜ではあるまいし', '〜도 아닌데', '子どもではあるまいし、感情だけで決めるべきではない。', '初めてではあるまいし、手順を確認してから始めよう。'],
	['〜ときたら', '〜라고 하면; 〜는', '今年の夏の暑さときたら、とても外出できるものではなかった。', '彼の記憶力ときたら、誰もが驚くほどだ。'],
	['〜ともなると', '〜정도가 되면', '年末ともなると、街は買い物客で混雑する。', '責任者ともなると、幅広い判断力が求められる。'],
	['〜ないまでも', '〜까지는 아니더라도', '毎日でないまでも、定期的に復習することが大切だ。', '完璧でないまでも、納得できる案をまとめたい。'],
];

const grammar = isBatch2 ? batch2Grammar : batch1Grammar;

const document = JSON.parse(await fs.readFile(FILE, 'utf8'));
const normalize = (value = '') => String(value).normalize('NFKC').replace(/\s+/g, ' ').trim();
function strip(sentence, pattern) {
	const literal = pattern.replace('〜', '');
	const direct = sentence.replace(literal, '（　）');
	if (direct !== sentence) return direct;
	const conjugated = new Map([
		['〜たところで', /(?:た|だ)ところで/u],
		['〜にたえる', /にも?たえる/u],
		['〜までもない', /までもな(?:い|く)/u],
		['〜を禁じ得ない', /を禁じ得な(?:い|かった)/u],
		['〜いかんだ', /いかんで/u],
		['〜ようと', /(?:であろう|だろう)と/u],
		['〜限りだ', /限り(?:だ|です)/u],
		['〜始末だ', /始末(?:だ|になった)/u],
		['〜かねる', /かね(?:ます|ている)/u],
		['〜そびれる', /そびれ(?:た|て)/u],
	]);
	const expression = conjugated.get(pattern);
	return expression ? sentence.replace(expression, '（　）') : sentence;
}

for (let dayIndex = 0; dayIndex < document.days.length; dayIndex += 1) {
	const lessons = grammar.slice(dayIndex * 2, dayIndex * 2 + 2);
	document.days[dayIndex].grammarLessons = lessons.map(([pattern, meaning, first, second], index) => ({
		sequence: index + 1, pattern, meaning_ko: meaning,
		explanation_ko: `${pattern}는 문장 앞뒤의 논리 관계와 접속 형태를 함께 확인해야 하는 N1 문법 표현이다.`,
		examples: [{ ja: first, ko: `문맥에서 ${meaning}의 의미로 쓰였다.` }, { ja: second, ko: `이 문장도 ${meaning}의 용법을 보여 준다.` }],
	}));
	document.days[dayIndex].grammarQuestions = Array.from({ length: 3 }, (_, qIndex) => {
		const answerIndex = (dayIndex * 2 + qIndex) % grammar.length;
		const [answer, meaning, first, second] = grammar[answerIndex];
		const sentence = qIndex === 2 ? second : first;
		const choices = [answer, grammar[(answerIndex + 5) % grammar.length][0], grammar[(answerIndex + 11) % grammar.length][0], grammar[(answerIndex + 19) % grammar.length][0]];
		const shift = (dayIndex + qIndex) % 4;
		return {
			sequence: qIndex + 1,
			prompt: `次の文の（　）に入る表現として最も適切なものを選びなさい。\n${strip(sentence, answer)}`,
			options: choices.slice(shift).concat(choices.slice(0, shift)), answer,
			explanation_ko: `문맥상 ${meaning}를 나타내는 「${answer}」가 알맞다.`,
		};
	});
	for (const item of document.days[dayIndex].grammarQuestions) {
		if ((item.prompt.match(/（　）/gu) ?? []).length < 2) throw new Error(`${document.days[dayIndex].date}: grammar sentence blank was not generated for ${item.answer}`);
	}
}

const signatures = new Set();
for (const day of document.days) {
	if (day.grammarLessons.length !== 2 || day.grammarQuestions.length !== 3) throw new Error(`${day.date}: grammar dimensions`);
	for (const item of day.grammarQuestions) {
		if (item.options.length !== 4 || new Set(item.options.map(normalize)).size !== 4) throw new Error(`${day.date}: duplicate grammar option`);
		if (item.options.filter((value) => value === item.answer).length !== 1) throw new Error(`${day.date}: grammar answer mismatch`);
		const signature = normalize(`${item.prompt}\n${item.options.join('\n')}`);
		if (signatures.has(signature)) throw new Error(`${day.date}: reused grammar MCQ`);
		signatures.add(signature);
	}
}

document.status = 'vocabulary_and_grammar_complete_editorial_review_pending';
document.checks.grammarLessonCount = 28;
document.checks.grammarQuestionCount = 42;
document.checks.uniqueGrammarMcqCount = signatures.size;
document.checks.grammarAnswerChecksPassed = true;
document.checks.grammarAndReadingPending = false;
document.checks.readingPending = true;
await fs.writeFile(FILE, `${JSON.stringify(document, null, 2)}\n`);
console.log(`Added 28 grammar lessons and ${signatures.size} grammar questions.`);
