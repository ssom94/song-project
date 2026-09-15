(() => {
	'use strict';
	const ko = document.documentElement.lang === 'ko';
	const ui = {
		list: document.getElementById('basic-kanji-list'), search: document.getElementById('kanji-search'),
		group: document.getElementById('kanji-group'), state: document.getElementById('kanji-state'),
		total: document.getElementById('kanji-total-count'), mastered: document.getElementById('kanji-mastered-count'),
		save: document.getElementById('kanji-save-state'), memoryStart: document.getElementById('kanji-memory-start'),
	};
	let rows = [], authenticated = false, saveTimer = 0, renderTimer = 0;
	let memoryRows = [], memoryIndex = 0, memoryRevealed = false, memoryMode = 'meaning', memoryOverlay = null;
	const pending = new Map();
	const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
	const text = (kr, ja) => ko ? kr : ja;
	let viewMode = 'kanji';
	const viewKanji=document.getElementById('kanji-view-kanji'), viewRadicals=document.getElementById('kanji-view-radicals'), viewOverview=document.getElementById('kanji-view-overview');
	const RADICAL_STATE_KEY = 'song.basic-kanji.radical-states.v1';
	const KANGXI_RADICALS=Array.from({length:214},(_,index)=>String.fromCodePoint(0x2f00+index));
	let radicalMemoryRows=[], radicalMemoryIndex=0, radicalMemoryRevealed=false, radicalMemoryOverlay=null;
	let radicalStates={};
	const pendingRadicals=new Map(); let radicalSaveTimer=0;
	try { radicalStates=JSON.parse(localStorage.getItem(RADICAL_STATE_KEY)||'{}')||{}; } catch { radicalStates={}; }
	const RADICALS = [["人","亻","사람 인","にんべん","왼쪽","사람·행동","休|体|信|任","休暇|信任|責任"],["水","氵","물 수·삼수변","さんずい","왼쪽","물·액체·흐름","海|河|洗|深|流","海外|河川|洗濯|深刻|交流"],["火","灬","불 화·연화발","ひへん・れっか","왼쪽·아래","불·열·빛","焼|燃|照|熱","燃焼|照明|熱意"],["手","扌","손 수·재방변","てへん","왼쪽","손동작·조작","持|打|投|援","維持|打開|投入|支援"],["心","忄|⺗","마음 심·심방변","りっしんべん・したごころ","왼쪽·아래","감정·의지·정신","情|性|念|慮","感情|性質|概念|配慮"],["言","訁","말씀 언·말씀언변","ごんべん","왼쪽","말·의견·기록","語|説|議|認","語彙|説明|議論|認識"],["糸","糹","실 사·실사변","いとへん","왼쪽","실·연결·계통","組|結|統|緩","組織|結論|統制|緩和"],["金","釒","쇠 금·쇠금변","かねへん","왼쪽","금속·돈·도구","銀|鉄|録|針","銀行|製鉄|記録|方針"],["食","飠","먹을 식·밥식변","しょくへん","왼쪽","먹기·음식","飲|飯|館|養","飲食|炊飯|会館|栄養"],["示","礻","보일 시·보일시변","しめすへん","왼쪽","제사·신·의식","神|社|祈|福","神秘|社会|祈願|福祉"],["衣","衤","옷 의·옷의변","ころもへん","왼쪽","옷·덮기","被|補|裕|裁","被害|補足|余裕|裁判"],["犬","犭","개 견·개사슴록변","けものへん","왼쪽","동물·짐승","犯|状|独|獲","犯罪|状態|独立|獲得"],["艸","艹","풀 초·초두머리","くさかんむり","위","풀·식물·약품","花|草|薬|著","花壇|薬品|著書"],["刀","刂","칼 도·선칼도방","りっとう","오른쪽","자르기·분리","別|制|判|創","区別|制度|判断|創造"],["攴","攵","칠 복·등글월문","ぼくづくり・のぶん","오른쪽","치기·행동·변화","教|改|政|救","教育|改善|政策|救済"],["辵","辶","쉬엄쉬엄갈 착·책받침","しんにょう","왼쪽 아래","이동·진행·길","進|過|達|遺","進展|過程|達成|遺憾"],["阜","阝","언덕 부·좌부변","こざとへん","왼쪽","언덕·장소·단계","階|陸|限|際","階層|大陸|限界|国際"],["邑","阝","고을 읍·우부방","おおざと","오른쪽","마을·지역","部|都|郊|邦","部分|都市|近郊|連邦"],["肉","月","고기 육·육달월","にくづき","왼쪽·아래","몸·기관","胸|脳|肺|臓","胸中|頭脳|肺炎|内臓"],["玉","王","구슬 옥·구슬옥변","たまへん","왼쪽","보석·귀중함","理|現|環|珍","理論|現象|環境|珍重"],["网","罒","그물 망·그물망머리","あみがしら","위","그물·둘러싸기","罪|置|署|羅","犯罪|設置|署名|網羅"],["竹","⺮","대 죽·대죽머리","たけかんむり","위","대나무·도구·문서","筆|答|策|範","執筆|回答|政策|範囲"],["宀","宀","집 면·갓머리","うかんむり","위","집·지붕·안쪽","家|安|定|察","家計|安定|想定|観察"],["广","广","집 엄·엄호","まだれ","왼쪽 위","건물·공간","店|度|庁|廃","店舗|制度|官庁|廃止"],["囗","囗","에워쌀 위·큰입구몸","くにがまえ","둘러싸기","경계·영역","国|囲|団|圏","国家|範囲|団体|圏内"],["木","木","나무 목·나무목변","きへん","왼쪽","나무·재료·구조","林|材|構|権","森林|材料|構成|権利"],["日","日","날 일·날일변","ひへん","왼쪽","해·날·밝음","時|明|映|暦","時期|明白|反映|西暦"],["目","目","눈 목·눈목변","めへん","왼쪽","보기·눈·항목","眼|相|督|瞬","眼科|相違|監督|瞬間"],["足","⻊","발 족·발족변","あしへん","왼쪽","발·이동·충족","路|距|踏|躍","経路|距離|踏襲|活躍"],["車","車","수레 거·수레거변","くるまへん","왼쪽","차·운반·회전","転|輪|軌|輸","転換|車輪|軌道|輸送"],
		["口","口","입 구·입구변","くち・くちへん","왼쪽·둘러싸기","입·말·출입구","味|呼|唱|問","意味|呼吸|合唱|質問"],["土","土","흙 토·흙토변","つちへん","왼쪽·아래","흙·땅·장소","地|城|境|基","土地|城郭|環境|基盤"],["女","女","계집 녀·계집녀변","おんなへん","왼쪽","여성·관계·상태","姉|婚|婦|妥","姉妹|結婚|夫婦|妥当"],["子","子","아들 자·아들자변","こへん","왼쪽·아래","아이·번식·작은 것","孫|存|孤|学","子孫|存在|孤独|学生"],["山","山","메 산·뫼산변","やまへん","왼쪽·위","산·높음·지형","岩|峰|岸|崩","岩石|山峰|沿岸|崩壊"],["石","石","돌 석·돌석변","いしへん","왼쪽","돌·광물·단단함","研|破|確|磁","研究|破壊|確認|磁石"],["禾","禾","벼 화·벼화변","のぎへん","왼쪽","곡식·수확·분량","秋|科|程|税","秋季|科学|程度|税金"],["米","米","쌀 미·쌀미변","こめへん","왼쪽","쌀·알갱이·가공","粉|精|糖|粒","粉末|精神|砂糖|粒子"],["貝","貝","조개 패·조개패변","かいへん","왼쪽·아래","돈·재산·거래","財|費|資|貿","財産|費用|資源|貿易"],["力","力","힘 력·힘력방","ちから","오른쪽·아래","힘·작용·노력","助|効|勤|勢","援助|効果|勤務|勢力"],["弓","弓","활 궁·활궁변","ゆみへん","왼쪽","활·당김·굽음","引|強|張|弾","引用|強化|主張|弾力"],["彳","彳","두인변 척","ぎょうにんべん","왼쪽","걷기·길·행동","行|後|待|律","行動|後退|期待|法律"],["頁","頁","머리 혈·머리혈방","おおがい","오른쪽","머리·얼굴·항목","顔|頭|領|順","顔面|頭脳|領域|順序"],["馬","馬","말 마·말마변","うまへん","왼쪽","말·이동·속도","駅|駆|騒|験","駅前|駆動|騒音|経験"],["魚","魚","물고기 어·물고기어변","うおへん","왼쪽","물고기·수산물","鮮|鯨|鰐|漁","新鮮|捕鯨|鰐口|漁業"],["鳥","鳥","새 조·새조변","とりへん","왼쪽·오른쪽","새·날짐승","鳴|鶏|鶴|鷹","悲鳴|養鶏|千羽鶴|鷹揚"],["雨","雨","비 우·비우머리","あめかんむり","위","비·날씨·하늘 현상","雪|雲|電|震","降雪|雲海|電気|地震"],["門","門","문 문·문문몸","もんがまえ","둘러싸기","문·출입·구분","間|開|閉|関","時間|開始|閉鎖|関係"],["虫","虫","벌레 훼·벌레훼변","むしへん","왼쪽·아래","벌레·작은 생물","蚊|蛇|蜂|融","蚊帳|蛇行|養蜂|融資"],["牛","牜","소 우·소우변","うしへん","왼쪽","소·가축·힘","物|牧|特|牲","物質|牧場|特別|犠牲"],["方","方","모 방·모방변","ほうへん","왼쪽·오른쪽","방향·방법·깃발","放|旅|族|旋","放送|旅行|民族|旋回"],["立","立","설 립·설립변","たつ・たつへん","왼쪽·위","서기·세우기·자리","位|章|端|競","地位|文章|端末|競争"],["老","耂","늙을 로·늙을로머리","おいかんむり","위","늙음·오랜 경험","考|者|孝|老","考慮|著者|孝行|老化"],["耳","耳","귀 이·귀이변","みみへん","왼쪽","귀·듣기·소식","聞|職|聴|聖","新聞|職業|聴取|神聖"],["酉","酉","닭 유·닭유변","とりへん","왼쪽","술·발효·숙성","酒|配|酸|酔","飲酒|配慮|酸素|泥酔"],["隹","隹","새 추·새추변","ふるとり","오른쪽·아래","꼬리가 짧은 새·모임","集|難|雑|離","集合|困難|複雑|離脱"],["穴","穴","구멍 혈·구멍혈머리","あなかんむり","위","구멍·빈 공간·집 안","空|究|窓|突","空間|研究|窓口|突然"],["疒","疒","병들 녁·병질엄","やまいだれ","왼쪽 위","병·증상·몸 상태","病|症|痛|疲","病院|症状|頭痛|疲労"],["厂","厂","기슭 엄·민엄호","がんだれ","왼쪽 위","벼랑·기슭·덮인 공간","原|厚|厳|圧","原因|厚生|厳格|圧力"],["白","白","흰 백·흰백변","しろ・しろへん","왼쪽·위","흰색·밝음·드러남","的|皆|皇|泊","目的|皆無|皇室|宿泊"]];
	RADICALS.push(...[
		["一","一","한 일","いち","위·아래","하나·수평·기준","丁|三|上|下","一定|統一|一層"],["丨","丨","뚫을 곤","ぼう・たてぼう","가운데","세로·관통","中|申|串|旧","中心|申請|一貫"],["丶","丶","점 주","てん","점","점·표시","主|丸|丹|永","主要|丸薬|永続"],["丿","丿","삐침 별","の・はらいぼう","왼쪽","삐침·움직임","乃|久|乏|乗","久々|欠乏|乗車"],["乙","乙|乚","새 을","おつ・おつにょう","아래·굽음","굽음·두 번째","乙|九|乱|乳","甲乙|混乱|乳児"],["亅","亅","갈고리 궐","はねぼう","오른쪽·아래","갈고리·굽힘","了|事|予|争","了解|事情|予算"],["二","二","두 이","に","위·아래","둘·겹침","二|互|井|亜","二重|相互|亜流"],["亠","亠","돼지해머리 두","なべぶた・けいさんかんむり","위","덮개·위","亡|交|京|率","死亡|交流|上京"],["儿","儿","어진사람 인","ひとあし・にんにょう","아래","사람·다리","元|兄|先|光","元来|兄弟|先端"],["入","入","들 입","いる・いりがしら","위·아래","들어감·합류","入|全|内|両","加入|全体|内容"],
		["八","八|丷","여덟 팔","はち・はちがしら","위·아래","나눔·벌어짐","分|公|共|兼","分析|公共|兼任"],["冂","冂","멀 경","けいがまえ・まきがまえ","둘러싸기","바깥 경계·둘레","円|内|再|冊","円滑|内外|再建"],["冖","冖","덮을 멱","わかんむり","위","덮개·가림","冠|冥|写|軍","王冠|写真|軍事"],["冫","冫","얼음 빙·이수변","にすい","왼쪽","얼음·차가움","冷|凍|凝|准","冷静|凍結|凝縮"],["几","几","안석 궤","つくえ・きにょう","둘러싸기·아래","받침·탁자","凡|処|凱|机","平凡|処理|机上"],["凵","凵","입벌릴 감","うけばこ・かんにょう","아래·둘러싸기","움푹한 그릇·구덩이","凶|出|函|凹","凶悪|突出|凹凸"],["勹","勹","쌀 포","つつみがまえ","오른쪽 위","감싸기·포용","包|勺|匂|勿","包括|包囲|匂い"],["匕","匕","비수 비","ひ・さじのひ","오른쪽·아래","숟가락·뒤집힘","化|北|比|旨","変化|北方|比較"],["匚","匚","상자 방","はこがまえ","왼쪽 둘러싸기","상자·감춤","区|医|匠|匿","区域|医療|巨匠"],["十","十","열 십","じゅう","위·가운데","열·교차·모임","千|午|協|博","千載|協議|博識"],
		["卜","卜","점 복","ぼく・ぼくのと","오른쪽·위","점·판단","占|外|卓|上","占有|外交|卓越"],["卩","卩|㔾","병부 절","ふしづくり・まげわりふ","오른쪽·아래","무릎 꿇음·절표","印|危|却|即","印象|危機|却下"],["厶","厶","사사 사","む","아래","개인·굽힌 팔","去|参|私|台","除去|参加|私的"],["又","又","또 우","また","오른쪽·아래","손·되풀이","反|収|取|受","反対|収益|取得"],["士","士","선비 사","さむらい","위·아래","사람·직분","仕|吉|志|売","仕事|吉報|志望"],["夂","夂","뒤져올 치","ふゆがしら・ちかんむり","위·아래","뒤에서 오는 발","冬|各|条|復","冬季|各種|条件"],["夕","夕","저녁 석","ゆうべ・た","왼쪽·위","저녁·밤","外|多|夜|夢","海外|多数|夜間"],["大","大","큰 대","だい・だいかんむり","위·아래","큼·펼친 사람","天|太|失|奪","天候|太陽|喪失"],["小","小|⺌","작을 소","しょう・しょうがしら","위·아래","작음·잘게 나뉨","少|当|尚|党","減少|当然|尚更"],["尸","尸","주검 시","しかばね・しかばねかんむり","왼쪽 위","몸·거처·꼬리","尺|局|居|展","尺度|局面|居住"],
		["巛","巛|川","내 천","まがりかわ・かわ","왼쪽·아래","흐르는 물·내","川|州|巡|巣","河川|九州|巡回"],["工","工","장인 공","たくみ・こう","왼쪽·아래","도구·공작","左|巧|功|攻","左翼|技巧|成功"],["己","己|已|巳","몸 기","おのれ・すでのつくり","오른쪽·아래","몸·굽힌 줄","記|改|配|起","記録|改善|配置"],["巾","巾","수건 건","はば・はばへん","왼쪽·아래","천·표지","布|帆|帳|幕","配布|帳簿|字幕"],["干","干","방패 간","ほす・いちじゅう","위·왼쪽","방패·범하다","刊|汗|幹|平","刊行|発汗|幹部"],["幺","幺","작을 요","よう・いとがしら","왼쪽·아래","가는 실·작음","幻|幼|幽|幾","幻想|幼稚|幽閉"],["廴","廴","길게걸을 인","えんにょう・いんにょう","왼쪽 아래","길게 걷기·늘임","延|建|廷","延期|建設|法廷"],["廾","廾","받들 공","にじゅうあし・こまぬき","아래","두 손으로 받듦","弁|弊|弄|戒","弁護|弊害|戒告"],["弋","弋","주살 익","しきがまえ","둘러싸기","말뚝·주살","式|弐|試|代","形式|試験|代理"],["彡","彡","터럭 삼","さんづくり","오른쪽","털·무늬·빛","形|彩|影|彫","形式|彩色|影響"],
		["戈","戈","창 과","ほこ・ほこづくり","오른쪽·둘러싸기","무기·싸움","成|我|戦|戒","成果|我慢|戦略"],["戶","戸","지게 호","と・とだれ","왼쪽 위","문·집","所|房|扉|戻","場所|暖房|扉口"],["支","支","지탱할 지","しにょう・えだにょう","오른쪽·아래","가지·받침","支|技|枝|鼓","支援|技術|枝葉"],["文","文","글월 문","ぶん・ぶんにょう","위·아래","무늬·글","文|斉|斎|対","文章|一斉|対策"],["斗","斗","말 두","とます・とまつ","오른쪽","국자·용량","料|斜|科|斗","料金|斜面|科学"],["斤","斤","도끼 근","おの・おのづくり","오른쪽","도끼·자르기","近|所|断|新","近接|場所|断念"],["无","无|旡","없을 무","なし・ぶ・すでのつくり","오른쪽·아래","없음·막힘","無|既|概|慨","無効|既存|概念"],["月","月","달 월","つき・つきへん","왼쪽·오른쪽","달·시간","期|朝|朗|望","期間|朝刊|展望"],["欠","欠","하품 흠","あくび・けんづくり","오른쪽","입 벌림·부족","次|欲|歌|欧","次第|欲求|歌唱"],["止","止","그칠 지","とめる・とめへん","아래·왼쪽","발자국·멈춤","正|歩|歴|歯","正常|歩行|歴史"],
		["歹","歹|歺","죽을사변","がつへん・かばねへん","왼쪽","죽음·손상","死|残|殊|殖","死亡|残念|特殊"],["殳","殳","몽둥이 수","るまた・ほこづくり","오른쪽","손에 든 도구·행동","段|殺|殴|設","段階|殺到|建設"],["毋","毋|母","말 무","なかれ・はは","아래·둘러싸기","금지·어머니","母|毎|毒|梅","母体|毎日|中毒"],["比","比","견줄 비","くらべる・ならびひ","왼쪽·오른쪽","나란함·비교","比|皆|批|昆","比較|皆無|批判"],["毛","毛","터럭 모","け・けへん","왼쪽·아래","털·가벼움","毛|毬|耗|尾","毛布|消耗|語尾"],["氏","氏","성씨 씨","うじ・うじへん","왼쪽·아래","씨족·성","氏|民|紙|婚","氏名|国民|用紙"],["气","气","기운 기","きがまえ","둘러싸기","공기·기운","気|汽|氛","気配|汽車|雰囲気"],["爪","爪|爫","손톱 조","つめ・つめかんむり","위·왼쪽","손·붙잡기","受|采|愛|採","受領|採用|愛情"],["父","父","아비 부","ちち","위·아래","아버지·어른","父|交|釜|斧","父母|交流|斧正"],["片","片","조각 편","かた・かたへん","왼쪽","쪼갠 나무·한쪽","版|片|牌|牒","出版|断片|位牌"],
		["玄","玄","검을 현","げん","위·아래","검음·깊고 오묘함","玄|率|畜|弦","玄関|確率|家畜"],["田","田","밭 전","た・たへん","왼쪽·아래","밭·구획","町|界|異|略","町内|境界|異常"],["皿","皿","그릇 명","さら","아래","그릇·담기","益|盛|監|盤","利益|盛況|監督"]
	]);

	const RADICAL_ORIGINS = {
		人:'서 있는 사람의 옆모습', 水:'흐르는 물줄기와 물방울', 火:'위로 타오르는 불꽃', 手:'손바닥과 펼친 손가락', 心:'심장의 생김새', 言:'입에서 말이 나오는 모습', 糸:'실 여러 가닥을 꼬아 묶은 모습', 金:'땅속의 금속·광물을 캐는 모습', 食:'그릇에 담긴 음식을 덮은 모습', 示:'제물을 올리는 제단', 衣:'깃과 소매가 달린 옷', 犬:'꼬리를 세운 개의 옆모습', 艸:'풀이 나란히 돋는 모습', 刀:'날과 자루가 있는 칼', 攴:'손에 막대기를 들고 두드리는 모습', 辵:'길을 뜻하는 彳과 발을 뜻하는 止의 결합', 阜:'층층이 이어진 언덕', 邑:'사람이 모여 사는 성곽과 영역', 肉:'결이 보이는 고깃덩이', 玉:'끈에 꿴 옥구슬', 网:'가로세로로 얽힌 그물', 竹:'잎이 늘어진 대나무 두 줄기', 宀:'집을 덮는 지붕', 广:'절벽이나 지붕 아래 공간', 囗:'지역을 둘러싼 경계', 木:'뿌리·줄기·가지가 있는 나무', 日:'빛나는 해', 目:'사람의 눈을 세로로 돌린 모습', 足:'무릎 아래 다리와 발', 車:'바퀴와 차축이 있는 수레',
		口:'벌린 입', 土:'땅 위로 솟은 흙덩이', 女:'무릎을 꿇고 앉은 사람', 子:'머리와 팔을 벌린 어린아이', 山:'높낮이가 다른 산봉우리', 石:'절벽 아래 놓인 돌', 禾:'이삭이 고개 숙인 곡식', 米:'사방으로 흩어진 낟알', 貝:'화폐로 쓰던 조개', 力:'팔이나 농기구로 힘쓰는 모습', 弓:'굽은 활의 옆모습', 彳:'길을 나타내는 行의 왼쪽 부분', 頁:'큰 머리를 가진 사람', 馬:'갈기·다리·꼬리가 있는 말', 魚:'머리·몸통·지느러미·꼬리가 있는 물고기', 鳥:'부리·날개·다리·꼬리가 있는 새', 雨:'하늘에서 떨어지는 빗방울', 門:'양쪽으로 여는 두 짝 대문', 虫:'몸을 구부린 뱀이나 작은 생물', 牛:'뿔이 난 소의 머리', 方:'방향을 알리는 깃발이나 도구', 立:'땅 위에 두 발로 선 사람', 老:'노인이 지팡이를 짚은 모습', 耳:'귓바퀴', 酉:'술을 발효시키는 항아리', 隹:'꼬리가 짧은 새', 穴:'바위나 땅의 동굴 입구', 疒:'병들어 침상에 누운 사람', 厂:'절벽이나 바위 기슭', 白:'밝게 빛나는 흰색(자원에는 여러 설이 있음)'
	};
	Object.assign(RADICAL_ORIGINS, {
		一:'평평하게 그은 한 획', 丨:'위아래를 뚫는 세로선', 丶:'작게 찍은 점이나 불꽃', 丿:'비스듬히 움직이는 한 획', 乙:'굽거나 휘어진 모양', 亅:'끝이 위로 걸린 갈고리', 二:'두 개의 가로획', 亠:'글자 위를 덮는 짧은 덮개', 儿:'사람의 두 다리', 入:'두 선이 안쪽으로 모이는 모습',
		八:'두 갈래로 벌어지는 모습', 冂:'바깥을 둘러싼 경계', 冖:'물건 위에 덮은 천이나 덮개', 冫:'얼음 결정이나 얼어붙은 물', 几:'다리가 달린 낮은 책상', 凵:'입이 위로 열린 그릇이나 구덩이', 勹:'몸을 굽혀 무언가를 감싸는 모습', 匕:'숟가락 또는 몸을 뒤집은 사람', 匚:'한쪽이 열린 상자', 十:'가로와 세로가 교차한 모습',
		卜:'거북 껍질에 생긴 점괘의 금', 卩:'무릎을 꿇고 앉은 사람', 厶:'팔을 안쪽으로 굽혀 자기 것을 감싼 모습', 又:'오른손을 본뜬 모습', 士:'도끼 모양 또는 일을 맡은 사람의 표지', 夂:'뒤에서 천천히 따라오는 발', 夕:'달빛이 희미한 저녁의 달', 大:'사람이 팔과 다리를 크게 벌린 모습', 小:'작은 점들이 흩어진 모습', 尸:'몸을 굽히거나 옆으로 누운 사람',
		巛:'굽이쳐 흐르는 여러 물줄기', 工:'양끝을 재는 공구나 자', 己:'구부려 감아 놓은 줄', 巾:'아래로 늘어진 천 조각', 干:'손잡이가 달린 방패', 幺:'아주 가느다란 실 한 가닥', 廴:'길게 이어지는 길과 발걸음', 廾:'두 손으로 물건을 받쳐 든 모습', 弋:'줄이 달린 주살이나 말뚝', 彡:'나란히 흐르는 털·무늬·빛',
		戈:'자루와 날이 달린 창', 戶:'한 짝으로 된 문', 支:'손에 나뭇가지를 든 모습', 文:'몸에 그린 무늬나 문신', 斗:'자루가 달린 국자', 斤:'날과 자루가 있는 도끼', 无:'사람이 몸을 굽혀 막힌 모습(자원에는 여러 설이 있음)', 月:'차고 기우는 달의 모습', 欠:'사람이 입을 벌려 하품하는 모습', 止:'발바닥과 발가락을 단순화한 발자국',
		歹:'부서져 남은 뼈', 殳:'손에 막대기나 무기를 든 모습', 毋:'여성의 몸에 금지 표시를 더한 모습(자원에는 여러 설이 있음)', 比:'두 사람이 나란히 선 모습', 毛:'굽은 털 한 올', 氏:'땅에 뿌리내린 씨족을 나타낸 표지(자원에는 여러 설이 있음)', 气:'공기나 수증기가 굽이치는 모습', 爪:'손가락을 아래로 뻗어 집는 손', 父:'손에 도구를 든 어른 남성', 片:'나무를 세로로 쪼갠 한쪽 조각',
		玄:'가늘고 검은 실이 얽힌 모습', 田:'둑으로 네 칸을 나눈 밭', 皿:'음식을 담는 납작한 그릇'
	});
	function radicalOrigin(base, meaning) {
		if (!ko) return `「${base}」の古い字形をもとに、部首として関連する意味を添えます。`;
		return `${RADICAL_ORIGINS[base] || `${base}의 옛 글자 모양`}에서 유래해 ${meaning}의 뜻을 더한다.`;
	}
	const stateRank = { unlearned: 0, unsure: 1, mastered: 2 };
	const stateLabel = (state) => state === 'mastered' ? text('완료','完了') : state === 'unsure' ? text('애매함','曖昧') : text('미학습','未学習');
	function searchable(row) { return [row.kanji,row.meaningKo,row.soundKo,row.meaningJa,row.onyomi,row.kunyomi,row.group,row.compositionNoteKo,row.memoryTip,...row.componentForms,...row.components,...row.relatedWords.flatMap((item)=>[item.word,item.reading])].join(' ').toLocaleLowerCase(); }
	function visibleRows() {
		const query = ui.search.value.trim().toLocaleLowerCase(), group = ui.group.value, state = ui.state.value;
		return rows.filter((row) => (!query || searchable(row).includes(query)) && (!group || row.group === group) && (!state || row.state === state))
			.sort((a,b) => (stateRank[a.state]-stateRank[b.state]) || a.order-b.order);
	}
	function renderKanji() {
		const filtered = visibleRows();
		ui.total.textContent = String(filtered.length);
		ui.mastered.textContent = `${rows.filter((row) => row.state === 'mastered').length} / ${rows.length}`;
		if (!filtered.length) { ui.list.innerHTML = `<div class="jp-card basic-kanji-empty">${text('조건에 맞는 한자가 없습니다.','条件に合う漢字がありません。')}</div>`; return; }
		ui.list.innerHTML = filtered.map((row) => `<article class="basic-kanji-card is-${row.state}" data-kanji="${esc(row.kanji)}">
			<a class="basic-kanji-glyph" href="/${ko?'ko':'ja'}/japanese/kanji-basics/?kanji=${encodeURIComponent(row.kanji)}" aria-label="${esc(row.kanji)} ${text('상세','詳細')}">${esc(row.kanji)}</a><div><div class="basic-kanji-top"><h2>${esc(row.meaningKo)} ${esc(row.soundKo)}</h2><span class="kanji-group-tag">${esc(row.group)}</span></div>
			<div class="basic-kanji-readings"><div><span>${text('일본식 뜻','日本語の意味')}</span><b>${esc(row.meaningJa || '—')}</b></div><div><span>${text('음독','音読み')}</span><b>${esc(row.onyomi || '—')}</b></div><div><span>${text('훈독','訓読み')}</span><b>${esc(row.kunyomi || '—')}</b></div></div>
			<div class="kanji-forms"><span class="kanji-group-tag">${text('구성','構成')}</span>${row.components.map((form) => `<span class="kanji-form">${esc(form)}</span>`).join('')}<span class="kanji-group-tag">${text('변형','変形')}</span>${row.componentForms.map((form) => `<span class="kanji-form">${esc(form)}</span>`).join('')}</div>
			<p class="kanji-formation"><b>${text('조합 원리','組み合わせ')}</b> ${esc(row.compositionNoteKo || '—')}</p><p class="kanji-memory-tip"><b>${text('암기 팁','暗記のコツ')}</b> ${esc(row.memoryTip || '—')}</p><div class="kanji-examples">${row.relatedWords.map((item) => `<a class="kanji-example" href="/${ko?'ko':'ja'}/japanese/words/detail/?word=${encodeURIComponent(item.word)}">${esc(item.word)}${item.reading?` (${esc(item.reading)})`:''}</a>`).join('')}</div></div>
			<div class="kanji-state-actions" aria-label="${text('학습 상태','学習状態')}">${['unlearned','unsure','mastered'].map((state)=>`<button class="kanji-state-button is-${state}${row.state===state?' is-active':''}" data-state="${state}" type="button">${stateLabel(state)}</button>`).join('')}</div></article>`).join('');
	}
	function filteredRadicals() {
		const query=ui.search.value.trim().toLocaleLowerCase(), selectedState=ui.state.value;
		return RADICALS.filter((row)=>{
			const state=radicalStates[row[0]]||'unlearned';
			return (!query||[...row,radicalOrigin(row[0],row[5])].join(' ').toLocaleLowerCase().includes(query))&&(!selectedState||state===selectedState);
		}).sort((a,b)=>stateRank[radicalStates[a[0]]||'unlearned']-stateRank[radicalStates[b[0]]||'unlearned']);
	}
	function renderRadicalOverview() {
		const filtered=filteredRadicals();
		ui.total.textContent=String(filtered.length); ui.mastered.textContent=RADICALS.filter((row)=>(radicalStates[row[0]]||'unlearned')==='mastered').length+' / '+RADICALS.length;
		if(!filtered.length){ui.list.innerHTML='<div class="jp-card basic-kanji-empty">'+text('조건에 맞는 부수가 없습니다.','条件に合う部首がありません。')+'</div>';return;}
		const rowsHtml=filtered.map((row)=>{
			const [base,forms,nameKo,nameJa,,meaning]=row, state=radicalStates[base]||'unlearned';
			return '<article class="radical-overview-row is-'+state+'"><div class="radical-overview-original"><small>'+text('원래 한자','元の漢字')+'</small><strong>'+esc(base)+'</strong></div><div class="radical-overview-form"><small>'+text('부수·이름','部首・名称')+'</small><b>'+esc(forms.split('|').join(' · '))+'</b><span>'+esc(ko?nameKo:nameJa)+'</span></div><div class="radical-overview-meaning"><small>'+text('의미','意味')+'</small><b>'+esc(meaning)+'</b></div><div class="radical-overview-origin"><small>'+text('유래·모양','由来・形')+'</small><span>'+esc(radicalOrigin(base,meaning))+'</span></div></article>';
		}).join('');
		ui.list.innerHTML='<section class="jp-card radical-overview"><div class="radical-overview-title"><div><p class="jp-eyebrow">RADICAL AT A GLANCE</p><h2>'+text('부수 한눈보기','部首早見表')+'</h2><p>'+text('원래 한자에서 부수 모양으로 어떻게 바뀌는지, 의미와 유래를 한 줄로 비교합니다. 자원에는 여러 학설이 있어 학습하기 쉬운 대표 설명으로 표시합니다.','元の漢字から部首形への変化、意味と由来を一覧で比較します。字源には諸説があるため、学習向けの代表的な説明です。')+'</p></div><b>'+filtered.length+text('개','件')+'</b></div><div class="radical-overview-head" aria-hidden="true"><span>'+text('원래 한자','元の漢字')+'</span><span>'+text('부수·이름','部首・名称')+'</span><span>'+text('의미','意味')+'</span><span>'+text('유래·모양','由来・形')+'</span></div><div class="radical-overview-list">'+rowsHtml+'</div></section>';
	}
	function renderRadicals() {
		const filtered=filteredRadicals();
		ui.total.textContent=String(filtered.length); ui.mastered.textContent=RADICALS.filter((row)=>(radicalStates[row[0]]||'unlearned')==='mastered').length+' / '+RADICALS.length;
		const detailed=filtered.map((row)=>{
			const [base,forms,nameKo,nameJa,position,meaning,kanji,words]=row;
			const state=radicalStates[base]||'unlearned';
			const variants=forms.split('|').map((form)=>'<span class="kanji-form">'+esc(form)+'</span>').join('');
			const usedKanji=kanji.split('|').map((item)=>'<span class="kanji-form">'+esc(item)+'</span>').join('');
			const related=words.split('|').map((item)=>'<a class="kanji-example" href="/'+(ko?'ko':'ja')+'/japanese/words/?q='+encodeURIComponent(item)+'">'+esc(item)+'</a>').join('');
			const actions=['unlearned','unsure','mastered'].map((value)=>'<button class="kanji-state-button is-'+value+(state===value?' is-active':'')+'" data-radical-state="'+value+'" type="button">'+stateLabel(value)+'</button>').join('');
			return '<article class="radical-card is-'+state+'" data-radical="'+esc(base)+'"><div class="radical-symbol"><strong>'+esc(base)+'</strong><span>→ '+variants+'</span></div><div><div class="basic-kanji-top"><h2>'+esc(ko?nameKo:nameJa)+'</h2><span class="kanji-group-tag">'+esc(position)+'</span></div><p class="radical-meaning"><b>'+text('기본 의미','基本意味')+'</b> '+esc(meaning)+'</p><div class="radical-flow"><span>'+esc(base)+'</span><b>→</b><span>'+variants+'</span><b>→</b><span>'+text('한자 속 위치에 맞게 좁아지거나 모양이 변합니다.','漢字内の位置に合わせて形が変わります。')+'</span></div><div class="kanji-examples"><b>'+text('활용 한자','使用漢字')+'</b>'+usedKanji+'</div><div class="kanji-examples"><b>'+text('관련 단어','関連語')+'</b>'+related+'</div></div><div class="kanji-state-actions">'+actions+'</div></article>';
		}).join('') || '<div class="jp-card basic-kanji-empty">'+text('조건에 맞는 핵심 부수가 없습니다.','条件に合う主要部首がありません。')+'</div>';
		const reference=!query&&!selectedState?'<section class="jp-card radical-reference"><div><h2>'+text('전체 214부수 참고 목록','全214部首一覧')+'</h2><p>'+text('먼저 아래 핵심 부수 '+RADICALS.length+'개를 학습하고, 전체 모양은 필요할 때 찾아보세요.','まず下の主要'+RADICALS.length+'部首を学び、全体の形は必要な時に参照してください。')+'</p></div><div class="radical-reference-grid">'+KANGXI_RADICALS.map((glyph,index)=>'<span title="'+text((index+1)+'번 부수','部首 '+(index+1))+'">'+esc(glyph)+'</span>').join('')+'</div></section>':'';
		ui.list.innerHTML=reference+detailed;
	}
	function render() {
		const radical=viewMode==='radicals';
		const overview=viewMode==='overview'; viewKanji?.classList.toggle('is-active',viewMode==='kanji'); viewRadicals?.classList.toggle('is-active',radical); viewOverview?.classList.toggle('is-active',overview);
		ui.group.hidden=radical||overview; ui.state.hidden=false; ui.memoryStart.hidden=overview;
		ui.memoryStart.textContent=radical?text('부수 암기 모드','部首暗記モード'):text('암기 모드','暗記モード');
		overview ? renderRadicalOverview() : radical ? renderRadicals() : renderKanji();
	}
	function setSave(message, className = '') { ui.save.textContent = message; ui.save.className = className; }
	async function flush() {
		window.clearTimeout(saveTimer);
		if (!pending.size || !authenticated) return;
		const updates = [...pending.entries()].map(([kanji,state]) => ({ kanji,state })); pending.clear();
		setSave(text('저장 중…','保存中…'), 'kanji-saving');
		try {
			const response = await fetch('/api/japanese/basic-kanji', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({updates}), credentials:'same-origin', keepalive:true });
			if (!response.ok) throw new Error(String(response.status));
			setSave(text('자동 저장됨','自動保存済み'), 'kanji-saved');
		} catch (error) {
			updates.forEach((row) => pending.set(row.kanji,row.state));
			setSave(text('저장 실패 · 다시 시도합니다','保存失敗・再試行します'), 'basic-kanji-error');
			saveTimer = window.setTimeout(flush, 2500);
		}
	}
	function queue(row) { pending.set(row.kanji,row.state); window.clearTimeout(saveTimer); saveTimer = window.setTimeout(flush, 700); }
	function ensureMemoryOverlay() {
		if (memoryOverlay) return memoryOverlay;
		memoryOverlay = document.createElement('div'); memoryOverlay.id='kanji-memory-overlay'; memoryOverlay.className='kanji-memory-overlay'; memoryOverlay.hidden=true;
		memoryOverlay.innerHTML = `<section class="kanji-memory-panel" role="dialog" aria-modal="true" aria-label="${text('기초 한자 암기 모드','基礎漢字暗記モード')}">
			<div class="kanji-memory-head"><b data-memory-count></b><button class="kanji-memory-close" type="button" aria-label="${text('닫기','閉じる')}">×</button></div><div class="kanji-memory-types">${[['meaning','뜻'],['reading','읽기'],['components','구성']].map(([mode,label])=>`<button data-memory-mode="${mode}" type="button">${text(label,mode==='meaning'?'意味':mode==='reading'?'読み':'構成')}</button>`).join('')}</div>
			<div class="kanji-memory-body"></div></section>`;
		document.body.appendChild(memoryOverlay);
		memoryOverlay.addEventListener('click', (event) => {
			if (event.target === memoryOverlay || event.target.closest('.kanji-memory-close')) return closeMemory();
			const modeButton=event.target.closest('[data-memory-mode]'); if (modeButton) { memoryMode=modeButton.dataset.memoryMode; memoryRevealed=false; renderMemory(); return; }
			if (event.target.closest('.kanji-memory-reveal,.kanji-memory-glyph')) { memoryRevealed=true; renderMemory(); return; }
			const nav=event.target.closest('[data-memory-nav]'); if (nav) { moveMemory(Number(nav.dataset.memoryNav)); return; }
			const stateButton=event.target.closest('[data-memory-state]'); if (!stateButton) return;
			if (!authenticated) { setSave(text('관리자 로그인 후 저장할 수 있습니다.','管理者ログイン後に保存できます。'),'basic-kanji-login-warning'); return; }
			const row=memoryRows[memoryIndex]; if (!row) return; row.state=stateButton.dataset.memoryState; queue(row); render(); moveMemory(1);
		});
		return memoryOverlay;
	}
	function renderMemory() {
		const overlay=ensureMemoryOverlay(), body=overlay.querySelector('.kanji-memory-body'), count=overlay.querySelector('[data-memory-count]');
		if (!memoryRows.length) { count.textContent='0 / 0'; body.innerHTML=`<div class="kanji-memory-empty">${text('현재 조건에 맞는 한자가 없습니다.','現在の条件に合う漢字がありません。')}</div>`; return; }
		const row=memoryRows[memoryIndex]; count.textContent=`${memoryIndex+1} / ${memoryRows.length}`;
		overlay.querySelectorAll('[data-memory-mode]').forEach((button)=>button.classList.toggle('is-active',button.dataset.memoryMode===memoryMode));
		const prompt = memoryMode==='components'
			? `<div class="kanji-memory-component-prompt"><small>${text('이 구성으로 만들어진 한자는?','この構成からできる漢字は？')}</small><strong>${row.components.map(esc).join(' + ')}</strong></div>`
			: `<div class="kanji-memory-glyph" role="button" tabindex="0">${esc(row.kanji)}</div>${memoryMode==='reading'?`<p class="kanji-memory-clue">${esc(row.meaningKo)} ${esc(row.soundKo)}</p>`:''}`;
		body.innerHTML=`${prompt}
			<button class="kanji-memory-reveal" type="button" ${memoryRevealed?'hidden':''}>${text('정답 보기','答えを見る')}</button>
			<div class="kanji-memory-answer" ${memoryRevealed?'':'hidden'}><h2>${esc(row.meaningKo)} ${esc(row.soundKo)}</h2>
			<div class="basic-kanji-readings"><div><span>${text('일본식 뜻','日本語の意味')}</span><b>${esc(row.meaningJa||'—')}</b></div><div><span>${text('음독','音読み')}</span><b>${esc(row.onyomi||'—')}</b></div><div><span>${text('훈독','訓読み')}</span><b>${esc(row.kunyomi||'—')}</b></div></div>
			<div class="kanji-forms"><span class="kanji-group-tag">${text('구성','構成')}</span>${row.components.map((form)=>`<span class="kanji-form">${esc(form)}</span>`).join('')}</div><p class="kanji-formation">${esc(row.compositionNoteKo||'')}</p><p class="kanji-memory-tip">${esc(row.memoryTip||'')}</p><div class="kanji-examples">${row.relatedWords.map((item)=>`<span class="kanji-example">${esc(item.word)}${item.reading?` (${esc(item.reading)})`:''}</span>`).join('')}</div>
			<div class="kanji-memory-actions"><button class="kanji-memory-unlearned" data-memory-state="unlearned" type="button">${text('미학습','未学習')}</button><button class="kanji-memory-unsure" data-memory-state="unsure" type="button">${text('애매함','曖昧')}</button><button class="kanji-memory-mastered" data-memory-state="mastered" type="button">${text('완료','完了')}</button></div></div>
			<div class="kanji-memory-nav"><button data-memory-nav="-1" type="button">← ${text('이전','前へ')}</button><button data-memory-nav="1" type="button">${text('다음','次へ')} →</button></div>`;
	}
	function moveMemory(delta) { if (!memoryRows.length) return; memoryIndex=(memoryIndex+delta+memoryRows.length)%memoryRows.length; memoryRevealed=false; renderMemory(); }
	function openMemory() { memoryRows=visibleRows(); memoryIndex=0; memoryRevealed=false; ensureMemoryOverlay().hidden=false; document.body.style.overflow='hidden'; renderMemory(); }
	function closeMemory() { if (!memoryOverlay) return; memoryOverlay.hidden=true; document.body.style.overflow=''; flush(); }
	async function flushRadicalStates() {
		window.clearTimeout(radicalSaveTimer);
		if(!pendingRadicals.size||!authenticated)return;
		const radicalUpdates=[...pendingRadicals.entries()].map(([radical,state])=>({radical,state})); pendingRadicals.clear();
		setSave(text('부수 상태 저장 중…','部首状態を保存中…'),'kanji-saving');
		try {
			const response=await fetch('/api/japanese/basic-kanji',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({radicalUpdates}),credentials:'same-origin',keepalive:true});
			if(!response.ok)throw new Error(String(response.status)); setSave(text('부수 상태 자동 저장됨','部首状態を自動保存しました'),'kanji-saved');
		} catch(error) { radicalUpdates.forEach((row)=>pendingRadicals.set(row.radical,row.state)); setSave(text('부수 상태 저장 실패 · 다시 시도합니다','部首状態の保存失敗・再試行します'),'basic-kanji-error'); radicalSaveTimer=window.setTimeout(flushRadicalStates,2500); }
	}
	function saveRadicalState(base,state) { radicalStates[base]=state; localStorage.setItem(RADICAL_STATE_KEY,JSON.stringify(radicalStates)); if(authenticated){pendingRadicals.set(base,state);window.clearTimeout(radicalSaveTimer);radicalSaveTimer=window.setTimeout(flushRadicalStates,700);} }
	function ensureRadicalMemoryOverlay() {
		if (radicalMemoryOverlay) return radicalMemoryOverlay;
		radicalMemoryOverlay=document.createElement('div'); radicalMemoryOverlay.className='kanji-memory-overlay'; radicalMemoryOverlay.hidden=true;
		radicalMemoryOverlay.innerHTML='<section class="kanji-memory-panel" role="dialog" aria-modal="true"><div class="kanji-memory-head"><b data-radical-memory-count></b><button class="kanji-memory-close" type="button">×</button></div><div class="kanji-memory-body"></div></section>';
		document.body.appendChild(radicalMemoryOverlay);
		radicalMemoryOverlay.addEventListener('click',(event)=>{
			if(event.target===radicalMemoryOverlay||event.target.closest('.kanji-memory-close')) return closeRadicalMemory();
			if(event.target.closest('.kanji-memory-reveal,.radical-memory-symbol')) { radicalMemoryRevealed=true; renderRadicalMemory(); return; }
			const nav=event.target.closest('[data-radical-memory-nav]'); if(nav) { moveRadicalMemory(Number(nav.dataset.radicalMemoryNav)); return; }
			const stateButton=event.target.closest('[data-radical-memory-state]'); if(!stateButton) return;
			const row=radicalMemoryRows[radicalMemoryIndex]; if(!row) return; saveRadicalState(row[0],stateButton.dataset.radicalMemoryState); render(); moveRadicalMemory(1);
		});
		return radicalMemoryOverlay;
	}
	function renderRadicalMemory() {
		const overlay=ensureRadicalMemoryOverlay(),body=overlay.querySelector('.kanji-memory-body'),count=overlay.querySelector('[data-radical-memory-count]');
		if(!radicalMemoryRows.length){count.textContent='0 / 0';body.innerHTML='<div class="kanji-memory-empty">'+text('현재 조건에 맞는 부수가 없습니다.','現在の条件に合う部首がありません。')+'</div>';return;}
		const [base,forms,nameKo,nameJa,position,meaning,kanji,words]=radicalMemoryRows[radicalMemoryIndex]; count.textContent=(radicalMemoryIndex+1)+' / '+radicalMemoryRows.length;
		body.innerHTML='<div class="radical-memory-symbol" role="button" tabindex="0">'+esc(base)+'</div><button class="kanji-memory-reveal" type="button" '+(radicalMemoryRevealed?'hidden':'')+'>'+text('이름·변형 보기','名前・変形を見る')+'</button><div class="kanji-memory-answer" '+(radicalMemoryRevealed?'':'hidden')+'><h2>'+esc(ko?nameKo:nameJa)+'</h2><p class="kanji-memory-clue">'+esc(base)+' → '+esc(forms)+' · '+esc(position)+' · '+esc(meaning)+'</p><div class="kanji-examples">'+kanji.split('|').map((item)=>'<span class="kanji-form">'+esc(item)+'</span>').join('')+'</div><div class="kanji-examples">'+words.split('|').map((item)=>'<span class="kanji-example">'+esc(item)+'</span>').join('')+'</div><div class="kanji-memory-actions"><button class="kanji-memory-unlearned" data-radical-memory-state="unlearned" type="button">'+stateLabel('unlearned')+'</button><button class="kanji-memory-unsure" data-radical-memory-state="unsure" type="button">'+stateLabel('unsure')+'</button><button class="kanji-memory-mastered" data-radical-memory-state="mastered" type="button">'+stateLabel('mastered')+'</button></div></div><div class="kanji-memory-nav"><button data-radical-memory-nav="-1" type="button">← '+text('이전','前へ')+'</button><button data-radical-memory-nav="1" type="button">'+text('다음','次へ')+' →</button></div>';
	}
	function moveRadicalMemory(delta){if(!radicalMemoryRows.length)return;radicalMemoryIndex=(radicalMemoryIndex+delta+radicalMemoryRows.length)%radicalMemoryRows.length;radicalMemoryRevealed=false;renderRadicalMemory();}
	function openRadicalMemory(){radicalMemoryRows=RADICALS.filter((row)=>!ui.state.value||(radicalStates[row[0]]||'unlearned')===ui.state.value).sort((a,b)=>stateRank[radicalStates[a[0]]||'unlearned']-stateRank[radicalStates[b[0]]||'unlearned']);radicalMemoryIndex=0;radicalMemoryRevealed=false;ensureRadicalMemoryOverlay().hidden=false;document.body.style.overflow='hidden';renderRadicalMemory();}
	function closeRadicalMemory(){if(!radicalMemoryOverlay)return;radicalMemoryOverlay.hidden=true;document.body.style.overflow='';}
	async function load() {
		try {
			const pageParams=new URLSearchParams(window.location.search);
			const requestedKanji=pageParams.get('kanji')?.trim()||'';
			const requestedRadical=pageParams.get('radical')?.trim()||'';
			if(pageParams.get('view')==='overview') viewMode='overview';
			const response = await fetch(`/api/japanese/basic-kanji${requestedKanji?`?kanji=${encodeURIComponent(requestedKanji)}`:''}`, { credentials:'same-origin' });
			const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || response.status);
			rows = data.kanji; authenticated = data.authenticated;
			radicalStates={...radicalStates,...(data.radicalStates||{})}; localStorage.setItem(RADICAL_STATE_KEY,JSON.stringify(radicalStates));
			if (requestedKanji) { ui.search.value=requestedKanji; document.title=`${requestedKanji} | ${text('기초 한자 학습','基礎漢字学習')} | SONG`; }
			if (requestedRadical) { viewMode='radicals'; ui.search.value=requestedRadical; document.title=`${requestedRadical} | ${text('부수 학습','部首学習')} | SONG`; }
			[...new Set(rows.map((row) => row.group).filter(Boolean))].forEach((group) => { const option=document.createElement('option');option.value=group;option.textContent=group;ui.group.appendChild(option); });
			setSave(authenticated ? text('상태 자동 저장','状態を自動保存') : text('로그인하면 상태가 저장됩니다','ログインすると状態を保存できます'), authenticated ? '' : 'basic-kanji-login-warning');
			render();
		} catch (error) { ui.list.innerHTML=`<div class="jp-card basic-kanji-empty basic-kanji-error">${text('기초 한자를 불러오지 못했습니다. SQL 적용 여부를 확인해 주세요.','基礎漢字を読み込めませんでした。SQLの適用を確認してください。')}</div>`; setSave(text('불러오기 실패','読み込み失敗'),'basic-kanji-error'); }
	}
	ui.list.addEventListener('click', (event) => {
		const radicalButton=event.target.closest('[data-radical-state]');
		if(radicalButton){const card=radicalButton.closest('[data-radical]');if(card){saveRadicalState(card.dataset.radical,radicalButton.dataset.radicalState);render();}return;}
		const button = event.target.closest('.kanji-state-button'); if (!button) return;
		const card = button.closest('[data-kanji]'), row = rows.find((item) => item.kanji === card?.dataset.kanji); if (!row) return;
		if (!authenticated) { setSave(text('관리자 로그인 후 저장할 수 있습니다.','管理者ログイン後に保存できます。'),'basic-kanji-login-warning'); return; }
		row.state = button.dataset.state; queue(row);
		window.clearTimeout(renderTimer); renderTimer = window.setTimeout(render, 180);
	});
	[ui.search,ui.group,ui.state].forEach((element) => element.addEventListener(element === ui.search ? 'input' : 'change', render));
	viewKanji?.addEventListener('click',()=>{viewMode='kanji';render();});
	viewRadicals?.addEventListener('click',()=>{viewMode='radicals';render();});
	viewOverview?.addEventListener('click',()=>{viewMode='overview';render();});
	ui.memoryStart?.addEventListener('click', ()=>viewMode==='radicals'?openRadicalMemory():openMemory());
	window.addEventListener('keydown', (event) => {
		if (radicalMemoryOverlay && !radicalMemoryOverlay.hidden) {
			if (event.key==='Escape') closeRadicalMemory(); else if (event.key==='ArrowLeft') moveRadicalMemory(-1); else if (event.key==='ArrowRight') moveRadicalMemory(1); else if ((event.key===' '||event.key==='Enter')&&!radicalMemoryRevealed) { event.preventDefault(); radicalMemoryRevealed=true; renderRadicalMemory(); }
			return;
		}
		if (!memoryOverlay || memoryOverlay.hidden) return;
		if (event.key==='Escape') closeMemory(); else if (event.key==='ArrowLeft') moveMemory(-1); else if (event.key==='ArrowRight') moveMemory(1); else if ((event.key===' '||event.key==='Enter')&&!memoryRevealed) { event.preventDefault(); memoryRevealed=true; renderMemory(); }
	});
	window.addEventListener('pagehide', () => {
		if(pendingRadicals.size&&authenticated){const radicalUpdates=[...pendingRadicals.entries()].map(([radical,state])=>({radical,state}));navigator.sendBeacon('/api/japanese/basic-kanji',new Blob([JSON.stringify({radicalUpdates})],{type:'application/json'}));}
		if (!pending.size || !authenticated) return;
		const updates=[...pending.entries()].map(([kanji,state])=>({kanji,state}));
		navigator.sendBeacon('/api/japanese/basic-kanji', new Blob([JSON.stringify({updates})],{type:'application/json'}));
	});
	load();
})();
