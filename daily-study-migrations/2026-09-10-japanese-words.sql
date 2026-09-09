-- 2026-09-10 JLPT N1 신규 20단어 등록용
PRAGMA foreign_keys = ON;
CREATE TEMP TABLE _jlpt_20260910_words(word TEXT NOT NULL,reading TEXT NOT NULL,meaning_ko TEXT NOT NULL,meaning_ja TEXT NOT NULL,pos_name_ja TEXT NOT NULL,sentence_ja TEXT NOT NULL,example_reading TEXT NOT NULL,translation_ko TEXT NOT NULL,PRIMARY KEY(word,reading)) WITHOUT ROWID;
INSERT INTO _jlpt_20260910_words VALUES
('滞在','たいざい','체류','ある場所にしばらくとどまること。','サ変名詞','海外に滞在する期間が長くなるほど、現地の生活習慣にも慣れてくる。','かいがいにたいざいするきかんがながくなるほど、げんちのせいかつしゅうかんにもなれてくる。','해외에 체류하는 기간이 길어질수록 현지 생활 습관에도 익숙해진다.'),
('滞納','たいのう','체납','納めるべき金銭や料金を期限までに納めないこと。','サ変名詞','税金を滞納したまま放置すると、延滞金が加算されるおそれがある。','ぜいきんをたいのうしたままほうちすると、えんたいきんがかさんされるおそれがある。','세금을 체납한 채 방치하면 연체금이 가산될 우려가 있다.'),
('欠如','けつじょ','결여','必要なものが欠けていること。','サ変名詞','その計画には安全性への配慮が欠如している。','そのけいかくにはあんぜんせいへのはいりょがけつじょしている。','그 계획에는 안전성에 대한 배려가 결여되어 있다.'),
('欠陥','けっかん','결함','本来備わっているべき機能や性質が欠けていること。','普通名詞','製品の欠陥が判明したため、メーカーは自主回収を決めた。','せいひんのけっかんがはんめいしたため、めーかーはじしゅかいしゅうをきめた。','제품의 결함이 밝혀져 제조사는 자발적 회수를 결정했다.'),
('欠かす','かかす','빠뜨리다|거르다','必要なことをしないで済ませる。','五段動詞','健康を維持するには、規則正しい食事を欠かしてはならない。','けんこうをいじするには、きそくただしいしょくじをかかしてはならない。','건강을 유지하려면 규칙적인 식사를 거르면 안 된다.'),
('補償','ほしょう','보상','損害や費用などを補って埋め合わせること。','サ変名詞','事故による損害について、保険会社が補償を行う。','じこによるそんがいについて、ほけんがいしゃがほしょうをおこなう。','사고로 인한 손해에 대해 보험회사가 보상한다.'),
('保障','ほしょう','보장','権利や生活などを守り、確かなものにすること。','サ変名詞','最低限の生活を保障する制度の拡充が求められている。','さいていげんのせいかつをほしょうするせいどのかくじゅうがもとめられている。','최저한의 생활을 보장하는 제도의 확충이 요구되고 있다.'),
('保証','ほしょう','보증','確かであると責任をもって認めること。','サ変名詞','品質を保証するため、出荷前に厳しい検査を実施している。','ひんしつをほしょうするため、しゅっかまえにきびしいけんさをじっししている。','품질을 보증하기 위해 출하 전에 엄격한 검사를 실시하고 있다.'),
('承諾','しょうだく','승낙','申し入れや依頼を受け入れること。','サ変名詞','本人の承諾を得ずに個人情報を第三者へ提供してはならない。','ほんにんのしょうだくをえずにこじんじょうほうをだいさんしゃへていきょうしてはならない。','본인의 승낙 없이 개인정보를 제3자에게 제공해서는 안 된다.'),
('了承','りょうしょう','양해|승낙','事情を理解し、受け入れること。','サ変名詞','日程変更の可能性があることをあらかじめご了承ください。','にっていへんこうのかのうせいがあることをあらかじめごりょうしょうください。','일정 변경 가능성이 있음을 미리 양해해 주십시오.'),
('究明','きゅうめい','규명','原因や真相を詳しく調べて明らかにすること。','サ変名詞','事故の原因究明には、関係者からの聞き取りが欠かせない。','じこのげんいんきゅうめいには、かんけいしゃからのききとりがかかせない。','사고 원인 규명에는 관계자 청취가 필수적이다.'),
('察する','さっする','헤아리다|짐작하다','事情や気持ちを推し量る。','サ変動詞','相手の立場を察して発言を控えることも、時には必要だ。','あいてのたちばをさっしてはつげんをひかえることも、ときにはひつようだ。','상대의 입장을 헤아려 발언을 삼가는 것도 때로는 필요하다.'),
('推測','すいそく','추측','根拠をもとに、事実や状況を推し量ること。','サ変名詞','現段階では原因を推測することしかできない。','げんだんかいではげんいんをすいそくすることしかできない。','현 단계에서는 원인을 추측할 수밖에 없다.'),
('推移','すいい','추이','時間の経過に伴う変化の様子。','サ変名詞','今後の感染状況の推移を見ながら、対策を見直す必要がある。','こんごのかんせんじょうきょうのすいいをみながら、たいさくをみなおすひつようがある。','앞으로의 감염 상황 추이를 보면서 대책을 재검토할 필요가 있다.'),
('推進','すいしん','추진','物事を前へ進めること。','サ変名詞','行政は再生可能エネルギーの導入を推進している。','ぎょうせいはさいせいかのうえねるぎーのどうにゅうをすいしんしている。','행정은 재생 가능 에너지 도입을 추진하고 있다.'),
('円滑化','えんかつか','원활화','物事が滞りなく進むようにすること。','サ変名詞','業務の円滑化を図るため、申請手続きをオンライン化した。','ぎょうむのえんかつかをはかるため、しんせいてつづきをおんらいんかした。','업무의 원활화를 위해 신청 절차를 온라인화했다.'),
('是非','ぜひ','꼭|부디','強く願い、必ず実現したいという気持ちを表す。','副詞','機会があれば、是非一度現地を訪れてみたい。','きかいがあれば、ぜひいちどげんちをおとずれてみたい。','기회가 있다면 꼭 한 번 현지를 방문해 보고 싶다.'),
('まして','まして','더구나|하물며','前の事柄から考えて、それ以上に当然であることを表す。','副詞','子どもでも理解できる内容なのだから、まして専門家に分からないはずがない。','こどもでもりかいできるないようなのだから、ましてせんもんかにわからないはずがない。','아이도 이해할 수 있는 내용이니 하물며 전문가가 모를 리 없다.'),
('適宜','てきぎ','적절히|상황에 따라','その場の状況に応じて適切に。','副詞','必要に応じて、資料の内容は適宜更新してください。','ひつようにおうじて、しりょうのないようはてきぎこうしんしてください。','필요에 따라 자료 내용을 적절히 갱신해 주세요.'),
('随時','ずいじ','수시로|필요할 때마다','決まった時に限らず、都合のよい時にいつでも。','副詞','質問があれば、随時担当者までご連絡ください。','しつもんがあれば、ずいじたんとうしゃまでごれんらくください。','질문이 있으면 언제든 담당자에게 연락해 주세요。');
INSERT INTO japanese_words(word,reading,meaning_ko,meaning_ja,jlpt_level_id,ai_status,note)
SELECT s.word,s.reading,s.meaning_ko,s.meaning_ja,l.id,'reviewed','2026-09-10 오늘의 학습 N1 신규 단어 검증 완료' FROM _jlpt_20260910_words s JOIN jlpt_levels l ON l.code='N1' WHERE NOT EXISTS(SELECT 1 FROM japanese_words w WHERE w.word=s.word AND COALESCE(w.reading,'')=s.reading AND w.deleted_at IS NULL);
UPDATE japanese_words w SET meaning_ko=COALESCE(NULLIF(trim(w.meaning_ko),''),(SELECT s.meaning_ko FROM _jlpt_20260910_words s WHERE s.word=w.word AND s.reading=COALESCE(w.reading,''))),meaning_ja=COALESCE(NULLIF(trim(w.meaning_ja),''),(SELECT s.meaning_ja FROM _jlpt_20260910_words s WHERE s.word=w.word AND s.reading=COALESCE(w.reading,''))),jlpt_level_id=COALESCE(w.jlpt_level_id,(SELECT id FROM jlpt_levels WHERE code='N1')),ai_status=CASE WHEN w.ai_status='not_analyzed' THEN 'reviewed' ELSE w.ai_status END,note=COALESCE(NULLIF(trim(w.note),''),'2026-09-10 오늘의 학습 N1 신규 단어 검증 완료'),updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE EXISTS(SELECT 1 FROM _jlpt_20260910_words s WHERE s.word=w.word AND s.reading=COALESCE(w.reading,''));
INSERT OR IGNORE INTO japanese_word_parts_of_speech(word_id,part_of_speech_id,is_primary) SELECT w.id,p.id,1 FROM _jlpt_20260910_words s JOIN japanese_words w ON w.word=s.word AND COALESCE(w.reading,'')=s.reading AND w.deleted_at IS NULL JOIN parts_of_speech p ON p.name_ja=s.pos_name_ja AND p.deleted_at IS NULL;
INSERT INTO japanese_word_examples(word_id,sentence_ja,reading,translation_ko,note,source_type) SELECT w.id,s.sentence_ja,s.example_reading,s.translation_ko,'2026-09-10 JLPT N1 예문','ai_reviewed' FROM _jlpt_20260910_words s JOIN japanese_words w ON w.word=s.word AND COALESCE(w.reading,'')=s.reading AND w.deleted_at IS NULL WHERE NOT EXISTS(SELECT 1 FROM japanese_word_examples e WHERE e.word_id=w.id AND e.sentence_ja=s.sentence_ja);
