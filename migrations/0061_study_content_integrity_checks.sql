-- 0061_study_content_integrity_checks.sql
-- Repair the September N1 word shortage, rebuild affected vocab questions,
-- then verify JLPT/AP restart coverage with named CHECK constraints.

DROP TABLE IF EXISTS _jlpt_seed_0061;
CREATE TABLE _jlpt_seed_0061 (
  ord INTEGER PRIMARY KEY,
  word TEXT NOT NULL,
  reading TEXT NOT NULL,
  meaning_ko TEXT NOT NULL
);

INSERT INTO _jlpt_seed_0061(ord,word,reading,meaning_ko) VALUES
(1,'あえて','あえて','굳이'),
(2,'あくまで','あくまで','어디까지나'),
(3,'あらかた','あらかた','대강'),
(4,'あらゆる','あらゆる','모든'),
(5,'いかにも','いかにも','과연|참으로'),
(6,'いずれ','いずれ','어느 쪽이든|머지않아'),
(7,'いっそ','いっそ','차라리'),
(8,'おろそか','おろそか','소홀함'),
(9,'かえって','かえって','오히려'),
(10,'かろうじて','かろうじて','간신히'),
(11,'くれぐれも','くれぐれも','부디|거듭'),
(12,'ことごとく','ことごとく','모조리'),
(13,'さほど','さほど','그다지'),
(14,'しいて','しいて','굳이'),
(15,'しきりに','しきりに','자꾸|끊임없이'),
(16,'すこぶる','すこぶる','대단히'),
(17,'すんなり','すんなり','순조롭게'),
(18,'そもそも','そもそも','애초에'),
(19,'たちまち','たちまち','순식간에'),
(20,'てっきり','てっきり','틀림없이'),
(21,'とっさに','とっさに','순간적으로'),
(22,'ひいては','ひいては','더 나아가'),
(23,'ひたすら','ひたすら','오로지'),
(24,'ひとまず','ひとまず','일단'),
(25,'まるっきり','まるっきり','전혀'),
(26,'やたら','やたら','마구|몹시'),
(27,'ゆくゆく','ゆくゆく','장차'),
(28,'ろくに','ろくに','제대로'),
(29,'一挙に','いっきょに','일거에'),
(30,'一律','いちりつ','일률'),
(31,'一連','いちれん','일련'),
(32,'一変','いっぺん','일변|완전한 변화'),
(33,'一役','ひとやく','한몫'),
(34,'一帯','いったい','일대'),
(35,'一端','いったん','한 부분'),
(36,'一任','いちにん','일임'),
(37,'一括','いっかつ','일괄'),
(38,'一掃','いっそう','일소'),
(39,'一貫','いっかん','일관'),
(40,'一環','いっかん','일환'),
(41,'一躍','いちやく','일약'),
(42,'一転','いってん','급변'),
(43,'一斉','いっせい','일제히'),
(44,'一際','ひときわ','유난히|한층 더'),
(45,'丁重','ていちょう','정중함'),
(46,'不意','ふい','뜻밖'),
(47,'不振','ふしん','부진'),
(48,'不当','ふとう','부당'),
(49,'不備','ふび','미비'),
(50,'不服','ふふく','불복|불만'),
(51,'不審','ふしん','수상함'),
(52,'不祥事','ふしょうじ','불상사'),
(53,'不手際','ふてぎわ','서투른 처리'),
(54,'不本意','ふほんい','본의 아님'),
(55,'不透明','ふとうめい','불투명'),
(56,'不問','ふもん','불문'),
(57,'不規則','ふきそく','불규칙'),
(58,'不況','ふきょう','불황'),
(59,'不調','ふちょう','부진|이상'),
(60,'不採算','ふさいさん','채산성 없음'),
(61,'不一致','ふいっち','불일치'),
(62,'不特定','ふとくてい','불특정'),
(63,'不慮','ふりょ','뜻밖'),
(64,'不毛','ふもう','불모'),
(65,'不朽','ふきゅう','불후'),
(66,'不屈','ふくつ','불굴'),
(67,'不和','ふわ','불화'),
(68,'不覚','ふかく','불찰'),
(69,'不合理','ふごうり','불합리'),
(70,'不寛容','ふかんよう','불관용'),
(71,'不履行','ふりこう','불이행'),
(72,'不信','ふしん','불신'),
(73,'不測','ふそく','예측 불가'),
(74,'不正','ふせい','부정'),
(75,'不適切','ふてきせつ','부적절'),
(76,'不適合','ふてきごう','부적합'),
(77,'不均衡','ふきんこう','불균형'),
(78,'不均一','ふきんいつ','불균일'),
(79,'並行','へいこう','병행'),
(80,'並列','へいれつ','병렬'),
(81,'両立','りょうりつ','양립'),
(82,'中枢','ちゅうすう','중추'),
(83,'中断','ちゅうだん','중단'),
(84,'中立','ちゅうりつ','중립'),
(85,'中継','ちゅうけい','중계'),
(86,'中傷','ちゅうしょう','중상|비방'),
(87,'中核','ちゅうかく','중핵'),
(88,'中堅','ちゅうけん','중견'),
(89,'中途半端','ちゅうとはんぱ','어중간함'),
(90,'主催','しゅさい','주최'),
(91,'主導','しゅどう','주도'),
(92,'主体','しゅたい','주체'),
(93,'主眼','しゅがん','주안점'),
(94,'主観','しゅかん','주관'),
(95,'主流','しゅりゅう','주류'),
(96,'主力','しゅりょく','주력'),
(97,'主権','しゅけん','주권'),
(98,'主因','しゅいん','주요 원인'),
(99,'乏しい','とぼしい','부족하다'),
(100,'乱用','らんよう','남용'),
(101,'乱立','らんりつ','난립'),
(102,'予見','よけん','예견'),
(103,'予期','よき','예기'),
(104,'予兆','よちょう','전조'),
(105,'予断','よだん','예단'),
(106,'交錯','こうさく','뒤얽힘'),
(107,'交付','こうふ','교부'),
(108,'交易','こうえき','교역'),
(109,'享受','きょうじゅ','향유'),
(110,'介抱','かいほう','간호|돌봄'),
(111,'介する','かいする','거치다|개재하다'),
(112,'仕組み','しくみ','구조|장치'),
(113,'仕切る','しきる','구획하다|총괄하다'),
(114,'仕掛け','しかけ','장치|수법'),
(115,'仕向ける','しむける','유도하다'),
(116,'仕立てる','したてる','만들어 내다'),
(117,'仕業','しわざ','소행'),
(118,'代替','だいたい','대체'),
(119,'代行','だいこう','대행'),
(120,'代償','だいしょう','대가|보상'),
(121,'代弁','だいべん','대변'),
(122,'代謝','たいしゃ','대사'),
(123,'仮定','かてい','가정'),
(124,'仮説','かせつ','가설'),
(125,'仮称','かしょう','가칭'),
(126,'仮設','かせつ','임시 설치'),
(127,'仮想','かそう','가상'),
(128,'任務','にんむ','임무'),
(129,'任命','にんめい','임명'),
(130,'任意','にんい','임의'),
(131,'任用','にんよう','임용'),
(132,'企てる','くわだてる','꾀하다'),
(133,'企図','きと','기도|계획'),
(134,'企み','たくらみ','계략'),
(135,'休止','きゅうし','중지'),
(136,'休眠','きゅうみん','휴면'),
(137,'会見','かいけん','회견'),
(138,'会合','かいごう','회합'),
(139,'会談','かいだん','회담'),
(140,'伴奏','ばんそう','반주'),
(141,'伸縮','しんしゅく','신축'),
(142,'伸び悩む','のびなやむ','성장이 정체되다'),
(143,'位置づける','いちづける','자리매김하다'),
(144,'低迷','ていめい','침체'),
(145,'低俗','ていぞく','저속'),
(146,'低調','ていちょう','저조'),
(147,'低廉','ていれん','저렴'),
(148,'低減','ていげん','저감'),
(149,'体裁','ていさい','겉모양|체재'),
(150,'体得','たいとく','체득'),
(151,'体現','たいげん','체현'),
(152,'余地','よち','여지'),
(153,'余儀ない','よぎない','어쩔 수 없다'),
(154,'余波','よは','여파'),
(155,'余念','よねん','다른 생각'),
(156,'余剰','よじょう','잉여'),
(157,'作為','さくい','작위|고의'),
(158,'作動','さどう','작동'),
(159,'作法','さほう','작법|예절'),
(160,'使途','しと','용도'),
(161,'使い勝手','つかいがって','사용 편의성'),
(162,'使い分ける','つかいわける','구분해서 사용하다'),
(163,'侮る','あなどる','얕보다'),
(164,'侮辱','ぶじょく','모욕'),
(165,'侵す','おかす','침범하다'),
(166,'侵害','しんがい','침해'),
(167,'侵食','しんしょく','침식'),
(168,'促す','うながす','촉구하다'),
(169,'保全','ほぜん','보전'),
(170,'保留','ほりゅう','보류'),
(171,'信任','しんにん','신임'),
(172,'信奉','しんぽう','신봉'),
(173,'信憑性','しんぴょうせい','신빙성'),
(174,'修復','しゅうふく','복구|수복'),
(175,'修繕','しゅうぜん','수선'),
(176,'修飾','しゅうしょく','수식'),
(177,'俯瞰','ふかん','조감'),
(178,'倣う','ならう','본뜨다|따르다'),
(179,'倒産','とうさん','도산'),
(180,'倒壊','とうかい','붕괴'),
(181,'倒錯','とうさく','뒤바뀜|도착'),
(182,'候補','こうほ','후보'),
(183,'偏る','かたよる','치우치다'),
(184,'偏見','へんけん','편견'),
(185,'偏在','へんざい','편재'),
(186,'偏重','へんちょう','편중'),
(187,'偏差','へんさ','편차'),
(188,'健全','けんぜん','건전'),
(189,'偶発','ぐうはつ','우발'),
(190,'傍観','ぼうかん','방관'),
(191,'傍聴','ぼうちょう','방청'),
(192,'傾斜','けいしゃ','경사'),
(193,'傾注','けいちゅう','집중'),
(194,'傾倒','けいとう','심취'),
(195,'催す','もよおす','개최하다|느끼다'),
(196,'催促','さいそく','재촉'),
(197,'債権','さいけん','채권'),
(198,'債務','さいむ','채무'),
(199,'僅か','わずか','불과|조금'),
(200,'儀礼','ぎれい','의례'),
(201,'優位','ゆうい','우위'),
(202,'優遇','ゆうぐう','우대'),
(203,'優勢','ゆうせい','우세'),
(204,'優越','ゆうえつ','우월'),
(205,'充当','じゅうとう','충당'),
(206,'充足','じゅうそく','충족'),
(207,'免れる','まぬかれる','면하다|피하다'),
(208,'党派','とうは','당파'),
(209,'入念','にゅうねん','꼼꼼함'),
(210,'入札','にゅうさつ','입찰'),
(211,'全貌','ぜんぼう','전모'),
(212,'全盛','ぜんせい','전성'),
(213,'全容','ぜんよう','전모'),
(214,'全滅','ぜんめつ','전멸'),
(215,'兼用','けんよう','겸용'),
(216,'内訳','うちわけ','내역'),
(217,'内定','ないてい','내정'),
(218,'内密','ないみつ','내밀'),
(219,'内需','ないじゅ','내수'),
(220,'内輪','うちわ','내부|가까운 사이'),
(221,'再三','さいさん','재삼'),
(222,'再建','さいけん','재건'),
(223,'再編','さいへん','재편'),
(224,'再考','さいこう','재고'),
(225,'冒頭','ぼうとう','서두'),
(226,'冒す','おかす','무릅쓰다|범하다'),
(227,'冗長','じょうちょう','장황함|중복'),
(228,'冷遇','れいぐう','냉대'),
(229,'冷淡','れいたん','냉담'),
(230,'凍結','とうけつ','동결'),
(231,'凝縮','ぎょうしゅく','응축'),
(232,'凝視','ぎょうし','응시'),
(233,'凝集','ぎょうしゅう','응집'),
(234,'凡庸','ぼんよう','평범'),
(235,'処遇','しょぐう','처우'),
(236,'処置','しょち','처치'),
(237,'切実','せつじつ','절실'),
(238,'切迫','せっぱく','절박'),
(239,'切り抜ける','きりぬける','헤쳐 나가다'),
(240,'刊行','かんこう','간행'),
(241,'刑罰','けいばつ','형벌'),
(242,'判明','はんめい','판명'),
(243,'判例','はんれい','판례'),
(244,'判別','はんべつ','판별'),
(245,'利害','りがい','이해관계'),
(246,'利便','りべん','편의'),
(247,'到達','とうたつ','도달'),
(248,'到来','とうらい','도래'),
(249,'制約','せいやく','제약'),
(250,'制裁','せいさい','제재'),
(251,'制御','せいぎょ','제어'),
(252,'剥奪','はくだつ','박탈'),
(253,'剥離','はくり','박리'),
(254,'剰余','じょうよ','잉여'),
(255,'創設','そうせつ','창설'),
(256,'創出','そうしゅつ','창출'),
(257,'創意','そうい','창의'),
(258,'功績','こうせき','공적'),
(259,'効力','こうりょく','효력'),
(260,'効用','こうよう','효용'),
(261,'勘案','かんあん','감안'),
(262,'勧告','かんこく','권고'),
(263,'勧誘','かんゆう','권유'),
(264,'勾配','こうばい','기울기'),
(265,'包容','ほうよう','포용'),
(266,'包括','ほうかつ','포괄'),
(267,'包囲','ほうい','포위'),
(268,'匹敵','ひってき','필적'),
(269,'卓越','たくえつ','탁월'),
(270,'協議','きょうぎ','협의'),
(271,'協定','きょうてい','협정'),
(272,'協働','きょうどう','협동'),
(273,'卑劣','ひれつ','비열'),
(274,'卑屈','ひくつ','비굴'),
(275,'即座','そくざ','즉시'),
(276,'即応','そくおう','즉응'),
(277,'卸売','おろしうり','도매'),
(278,'厳選','げんせん','엄선'),
(279,'原案','げんあん','원안'),
(280,'原型','げんけい','원형'),
(281,'参入','さんにゅう','진입'),
(282,'参画','さんかく','참여'),
(283,'反響','はんきょう','반향'),
(284,'反発','はんぱつ','반발'),
(285,'反論','はんろん','반론'),
(286,'反転','はんてん','반전'),
(287,'収拾','しゅうしゅう','수습'),
(288,'収容','しゅうよう','수용'),
(289,'収益','しゅうえき','수익'),
(290,'収支','しゅうし','수지'),
(291,'取り締まる','とりしまる','단속하다'),
(292,'受諾','じゅだく','수락'),
(293,'受領','じゅりょう','수령'),
(294,'受託','じゅたく','수탁'),
(295,'口頭','こうとう','구두'),
(296,'名目','めいもく','명목'),
(297,'名残','なごり','자취|아쉬움'),
(298,'名簿','めいぼ','명부'),
(299,'名義','めいぎ','명의'),
(300,'同調','どうちょう','동조'),
(301,'同伴','どうはん','동반'),
(302,'同封','どうふう','동봉'),
(303,'吟味','ぎんみ','음미|검토'),
(304,'否認','ひにん','부인'),
(305,'含蓄','がんちく','함축'),
(306,'告知','こくち','고지'),
(307,'周知','しゅうち','널리 알림'),
(308,'周到','しゅうとう','주도면밀'),
(309,'呼応','こおう','호응'),
(310,'和解','わかい','화해'),
(311,'品位','ひんい','품위'),
(312,'品格','ひんかく','품격'),
(313,'唐突','とうとつ','갑작스러움'),
(314,'啓発','けいはつ','계발'),
(315,'善処','ぜんしょ','선처'),
(316,'喚起','かんき','환기'),
(317,'喪失','そうしつ','상실'),
(318,'営む','いとなむ','영위하다'),
(319,'嗜好','しこう','기호'),
(320,'嘆く','なげく','탄식하다'),
(321,'回避','かいひ','회피'),
(322,'回収','かいしゅう','회수'),
(323,'回顧','かいこ','회고'),
(324,'固執','こしつ','고집'),
(325,'圧倒','あっとう','압도'),
(326,'圧迫','あっぱく','압박'),
(327,'在任','ざいにん','재임'),
(328,'在留','ざいりゅう','체류'),
(329,'地盤','じばん','기반|지반'),
(330,'均衡','きんこう','균형'),
(331,'執着','しゅうちゃく','집착'),
(332,'執筆','しっぴつ','집필'),
(333,'執行','しっこう','집행'),
(334,'培う','つちかう','기르다|배양하다'),
(335,'堅実','けんじつ','견실'),
(336,'堅持','けんじ','견지'),
(337,'堅牢','けんろう','견고'),
(338,'堕落','だらく','타락'),
(339,'境遇','きょうぐう','처지'),
(340,'増強','ぞうきょう','증강'),
(341,'増進','ぞうしん','증진'),
(342,'増幅','ぞうふく','증폭'),
(343,'壮大','そうだい','장대'),
(344,'変遷','へんせん','변천'),
(345,'外観','がいかん','외관'),
(346,'多岐','たき','다방면'),
(347,'妥当','だとう','타당'),
(348,'妥結','だけつ','타결'),
(349,'威圧','いあつ','위압'),
(350,'威厳','いげん','위엄'),
(351,'威嚇','いかく','위협'),
(352,'安易','あんい','안이'),
(353,'安堵','あんど','안도'),
(354,'定着','ていちゃく','정착'),
(355,'定款','ていかん','정관'),
(356,'実態','じったい','실태'),
(357,'実証','じっしょう','실증'),
(358,'容認','ようにん','용인'),
(359,'密接','みっせつ','밀접'),
(360,'密集','みっしゅう','밀집'),
(361,'富む','とむ','풍부하다'),
(362,'対価','たいか','대가'),
(363,'対比','たいひ','대비'),
(364,'対抗','たいこう','대항'),
(365,'専念','せんねん','전념'),
(366,'専任','せんにん','전임'),
(367,'封じる','ふうじる','봉쇄하다'),
(368,'封鎖','ふうさ','봉쇄'),
(369,'尊重','そんちょう','존중'),
(370,'尊厳','そんげん','존엄'),
(371,'導く','みちびく','이끌다'),
(372,'導出','どうしゅつ','도출'),
(373,'尽力','じんりょく','진력'),
(374,'局面','きょくめん','국면'),
(375,'局所','きょくしょ','국소'),
(376,'巧み','たくみ','교묘함|능숙함'),
(377,'差し支える','さしつかえる','지장이 있다'),
(378,'差額','さがく','차액'),
(379,'干渉','かんしょう','간섭'),
(380,'平穏','へいおん','평온'),
(381,'広範','こうはん','광범위'),
(382,'広義','こうぎ','광의'),
(383,'弁明','べんめい','변명'),
(384,'弁護','べんご','변호'),
(385,'弊害','へいがい','폐해'),
(386,'強硬','きょうこう','강경'),
(387,'強靭','きょうじん','강인'),
(388,'当面','とうめん','당분간'),
(389,'当該','とうがい','해당'),
(390,'当初','とうしょ','당초'),
(391,'当事者','とうじしゃ','당사자'),
(392,'当惑','とうわく','당혹'),
(393,'形骸化','けいがいか','형해화'),
(394,'従事','じゅうじ','종사'),
(395,'従来','じゅうらい','종래'),
(396,'従属','じゅうぞく','종속'),
(397,'得策','とくさく','상책'),
(398,'復旧','ふっきゅう','복구'),
(399,'徴収','ちょうしゅう','징수'),
(400,'恒久','こうきゅう','항구적');

INSERT INTO japanese_words(word,reading,meaning_ko,jlpt_level_id,ai_status,note)
SELECT s.word,s.reading,s.meaning_ko,l.id,'reviewed','JLPT N1 September 2026 curated seed'
FROM _jlpt_seed_0061 s
JOIN jlpt_levels l ON l.code='N1'
WHERE NOT EXISTS (
  SELECT 1 FROM japanese_words w
  WHERE w.deleted_at IS NULL
    AND w.word=s.word
    AND COALESCE(w.reading,'')=s.reading
);

DELETE FROM japanese_jlpt_curriculum_words
WHERE plan_id IN (SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL')
  AND introduced_on BETWEEN '2026-09-15' AND '2026-09-30';

WITH plan AS (
  SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL' LIMIT 1
), seed_word AS (
  SELECT s.ord,
         (SELECT MIN(w.id)
          FROM japanese_words w
          JOIN jlpt_levels l ON l.id=w.jlpt_level_id AND l.code='N1'
          WHERE w.deleted_at IS NULL
            AND w.word=s.word
            AND COALESCE(w.reading,'')=s.reading) AS word_id
  FROM _jlpt_seed_0061 s
), eligible AS (
  SELECT sw.ord,sw.word_id
  FROM seed_word sw, plan p
  WHERE sw.word_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM japanese_jlpt_curriculum_words c
      WHERE c.plan_id=p.id AND c.word_id=sw.word_id
    )
), picked AS (
  SELECT ord,word_id,ROW_NUMBER() OVER(ORDER BY ord) AS rn
  FROM eligible
  ORDER BY ord
  LIMIT 320
), base AS (
  SELECT p.id AS plan_id,COALESCE(MAX(c.sort_order),0) AS base_order
  FROM plan p
  LEFT JOIN japanese_jlpt_curriculum_words c ON c.plan_id=p.id
  GROUP BY p.id
)
INSERT INTO japanese_jlpt_curriculum_words(plan_id,word_id,sort_order,introduced_on)
SELECT b.plan_id,p.word_id,b.base_order+p.rn,
       date('2026-09-15','+'||CAST((p.rn-1)/20 AS INTEGER)||' day')
FROM picked p CROSS JOIN base b;

DELETE FROM japanese_jlpt_daily_contents
WHERE plan_id IN (SELECT id FROM japanese_jlpt_study_plans WHERE plan_code='N1_2027_JUL')
  AND study_date BETWEEN '2026-09-15' AND '2026-09-30'
  AND content_type='vocab_question';

WITH ranked AS (
  SELECT c.plan_id,c.introduced_on AS study_date,w.word,
         COALESCE(NULLIF(w.reading,''),w.word) AS reading,
         COALESCE(NULLIF(w.meaning_ko,''),'뜻 확인') AS meaning_ko,
         ROW_NUMBER() OVER(PARTITION BY c.plan_id,c.introduced_on ORDER BY c.sort_order) AS rn
  FROM japanese_jlpt_curriculum_words c
  JOIN japanese_words w ON w.id=c.word_id AND w.deleted_at IS NULL
  JOIN japanese_jlpt_study_plans p ON p.id=c.plan_id
  WHERE p.plan_code='N1_2027_JUL'
    AND c.introduced_on BETWEEN '2026-09-15' AND '2026-09-30'
), q AS (
  SELECT r.*,
    CASE ((rn-1)%5)
      WHEN 0 THEN '漢字読み'
      WHEN 1 THEN '表記'
      WHEN 2 THEN '文脈規定'
      WHEN 3 THEN '言い換え類義'
      ELSE '用法確認'
    END AS subtype
  FROM ranked r
  WHERE rn<=15
)
INSERT INTO japanese_jlpt_daily_contents(plan_id,study_date,content_type,sequence_no,title,payload_json)
SELECT q.plan_id,q.study_date,'vocab_question',q.rn,'文字・語彙：'||q.subtype,
  CASE q.subtype
    WHEN '漢字読み' THEN json_object(
      'prompt','「'||q.word||'」の読み方として最も適切なものを選びなさい。',
      'options',json_array(q.reading,
        COALESCE((SELECT reading FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn)%20)+1),q.word),
        COALESCE((SELECT reading FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn+1)%20)+1),q.word),
        COALESCE((SELECT reading FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn+2)%20)+1),q.word)),
      'answer',q.reading,
      'explanation','「'||q.word||'」は「'||q.reading||'」と読む。한국어 뜻: '||q.meaning_ko)
    WHEN '表記' THEN json_object(
      'prompt','「'||q.reading||'」と読む語として最も適切なものを選びなさい。',
      'options',json_array(q.word,
        COALESCE((SELECT word FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn)%20)+1),q.reading),
        COALESCE((SELECT word FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn+1)%20)+1),q.reading),
        COALESCE((SELECT word FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn+2)%20)+1),q.reading)),
      'answer',q.word,
      'explanation','正しい表記は「'||q.word||'」。読みは「'||q.reading||'」。한국어 뜻: '||q.meaning_ko)
    WHEN '文脈規定' THEN json_object(
      'prompt','次の意味に最も近い語を選びなさい：「'||q.meaning_ko||'」',
      'options',json_array(q.word,
        COALESCE((SELECT word FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn)%20)+1),q.word),
        COALESCE((SELECT word FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn+1)%20)+1),q.word),
        COALESCE((SELECT word FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn+2)%20)+1),q.word)),
      'answer',q.word,
      'explanation','문맥 의미와 어휘의 대응을 확인하는 문제. 정답은 「'||q.word||'」。')
    WHEN '言い換え類義' THEN json_object(
      'prompt','「'||q.word||'」の意味として最も近いものを選びなさい。',
      'options',json_array(q.meaning_ko,
        COALESCE((SELECT meaning_ko FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn)%20)+1),'다른 의미'),
        COALESCE((SELECT meaning_ko FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn+1)%20)+1),'관련 의미'),
        COALESCE((SELECT meaning_ko FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn+2)%20)+1),'반대 의미')),
      'answer',q.meaning_ko,
      'explanation','「'||q.word||'」의 핵심 의미는 「'||q.meaning_ko||'」。')
    ELSE json_object(
      'prompt','「'||q.word||'」について、読みと意味の組合せとして最も適切なものを選びなさい。',
      'options',json_array(q.reading||' / '||q.meaning_ko,
        q.reading||' / 다른 의미',
        COALESCE((SELECT reading FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn)%20)+1),q.reading)||' / '||q.meaning_ko,
        COALESCE((SELECT reading FROM ranked x WHERE x.plan_id=q.plan_id AND x.study_date=q.study_date AND x.rn=((q.rn+1)%20)+1),q.reading)||' / 다른 의미'),
      'answer',q.reading||' / '||q.meaning_ko,
      'explanation','읽기와 의미를 함께 확인한다. 읽기: '||q.reading||', 뜻: '||q.meaning_ko)
  END
FROM q;

DROP TABLE _jlpt_seed_0061;

CREATE TABLE _assert_jlpt_start (
  ok INTEGER NOT NULL,
  CONSTRAINT jlpt_start_date_20260907 CHECK (ok = 1)
);
INSERT INTO _assert_jlpt_start(ok)
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM japanese_jlpt_study_plans
  WHERE plan_code='N1_2027_JUL' AND study_start_date='2026-09-07'
) THEN 1 ELSE 0 END;
DROP TABLE _assert_jlpt_start;

CREATE TABLE _assert_jlpt_words (
  ok INTEGER NOT NULL,
  CONSTRAINT jlpt_daily_words_20_each_day CHECK (ok = 1)
);
WITH RECURSIVE dates(d) AS (
  SELECT '2026-09-07'
  UNION ALL SELECT date(d,'+1 day') FROM dates WHERE d<'2026-09-30'
)
INSERT INTO _assert_jlpt_words(ok)
SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM dates
  WHERE (
    SELECT COUNT(*)
    FROM japanese_jlpt_curriculum_words c
    JOIN japanese_jlpt_study_plans p ON p.id=c.plan_id
    WHERE p.plan_code='N1_2027_JUL' AND c.introduced_on=dates.d
  ) <> 20
) THEN 1 ELSE 0 END;
DROP TABLE _assert_jlpt_words;

CREATE TABLE _assert_jlpt_vocab (
  ok INTEGER NOT NULL,
  CONSTRAINT jlpt_vocab_questions_15_each_day CHECK (ok = 1)
);
WITH RECURSIVE dates(d) AS (
  SELECT '2026-09-07'
  UNION ALL SELECT date(d,'+1 day') FROM dates WHERE d<'2026-09-30'
)
INSERT INTO _assert_jlpt_vocab(ok)
SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM dates
  WHERE (
    SELECT COUNT(*) FROM japanese_jlpt_daily_contents x
    JOIN japanese_jlpt_study_plans p ON p.id=x.plan_id
    WHERE p.plan_code='N1_2027_JUL' AND x.study_date=dates.d AND x.content_type='vocab_question'
  ) <> 15
) THEN 1 ELSE 0 END;
DROP TABLE _assert_jlpt_vocab;

CREATE TABLE _assert_jlpt_grammar (
  ok INTEGER NOT NULL,
  CONSTRAINT jlpt_grammar_2_and_questions_3_each_day CHECK (ok = 1)
);
WITH RECURSIVE dates(d) AS (
  SELECT '2026-09-07'
  UNION ALL SELECT date(d,'+1 day') FROM dates WHERE d<'2026-09-30'
)
INSERT INTO _assert_jlpt_grammar(ok)
SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM dates
  WHERE (
    SELECT COUNT(*) FROM japanese_jlpt_daily_contents x
    JOIN japanese_jlpt_study_plans p ON p.id=x.plan_id
    WHERE p.plan_code='N1_2027_JUL' AND x.study_date=dates.d AND x.content_type='grammar'
  ) <> 2
  OR (
    SELECT COUNT(*) FROM japanese_jlpt_daily_contents x
    JOIN japanese_jlpt_study_plans p ON p.id=x.plan_id
    WHERE p.plan_code='N1_2027_JUL' AND x.study_date=dates.d AND x.content_type='grammar_question'
  ) <> 3
) THEN 1 ELSE 0 END;
DROP TABLE _assert_jlpt_grammar;

CREATE TABLE _assert_jlpt_reading (
  ok INTEGER NOT NULL,
  CONSTRAINT jlpt_reading_1_each_day CHECK (ok = 1)
);
WITH RECURSIVE dates(d) AS (
  SELECT '2026-09-07'
  UNION ALL SELECT date(d,'+1 day') FROM dates WHERE d<'2026-09-30'
)
INSERT INTO _assert_jlpt_reading(ok)
SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM dates
  WHERE (
    SELECT COUNT(*) FROM japanese_jlpt_daily_contents x
    JOIN japanese_jlpt_study_plans p ON p.id=x.plan_id
    WHERE p.plan_code='N1_2027_JUL' AND x.study_date=dates.d AND x.content_type='reading'
  ) <> 1
) THEN 1 ELSE 0 END;
DROP TABLE _assert_jlpt_reading;

CREATE TABLE _assert_ap_start (
  ok INTEGER NOT NULL,
  CONSTRAINT ap_start_date_20261001 CHECK (ok = 1)
);
INSERT INTO _assert_ap_start(ok)
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM ap_study_plans WHERE plan_code='AP_2026_H2' AND study_start_date='2026-10-01'
) THEN 1 ELSE 0 END;
DROP TABLE _assert_ap_start;

CREATE TABLE _assert_ap_reset (
  ok INTEGER NOT NULL,
  CONSTRAINT ap_old_progress_history_cleared CHECK (ok = 1)
);
INSERT INTO _assert_ap_reset(ok)
SELECT CASE WHEN
  NOT EXISTS (SELECT 1 FROM ap_topic_progress tp JOIN ap_study_plans p ON p.id=tp.plan_id WHERE p.plan_code='AP_2026_H2')
  AND NOT EXISTS (SELECT 1 FROM ap_daily_sessions s JOIN ap_study_plans p ON p.id=s.plan_id WHERE p.plan_code='AP_2026_H2')
  AND NOT EXISTS (SELECT 1 FROM ap_study_attempts a JOIN ap_study_plans p ON p.id=a.plan_id WHERE p.plan_code='AP_2026_H2')
  AND NOT EXISTS (SELECT 1 FROM ap_question_attempts a JOIN ap_study_plans p ON p.id=a.plan_id WHERE p.plan_code='AP_2026_H2')
  AND NOT EXISTS (SELECT 1 FROM ap_wrong_notes w JOIN ap_study_plans p ON p.id=w.plan_id WHERE p.plan_code='AP_2026_H2')
THEN 1 ELSE 0 END;
DROP TABLE _assert_ap_reset;

CREATE TABLE _assert_ap_week (
  ok INTEGER NOT NULL,
  CONSTRAINT ap_week_concept1_a10_b1_each_day CHECK (ok = 1)
);
WITH RECURSIVE dates(d) AS (
  SELECT '2026-10-01'
  UNION ALL SELECT date(d,'+1 day') FROM dates WHERE d<'2026-10-07'
)
INSERT INTO _assert_ap_week(ok)
SELECT CASE WHEN NOT EXISTS (
  SELECT 1 FROM dates
  WHERE (
    SELECT COUNT(*) FROM ap_daily_contents x JOIN ap_study_plans p ON p.id=x.plan_id
    WHERE p.plan_code='AP_2026_H2' AND x.study_date=dates.d AND x.content_type='concept'
  ) <> 1
  OR (
    SELECT COUNT(*) FROM ap_daily_contents x JOIN ap_study_plans p ON p.id=x.plan_id
    WHERE p.plan_code='AP_2026_H2' AND x.study_date=dates.d AND x.content_type='subject_a_question'
  ) <> 10
  OR (
    SELECT COUNT(*) FROM ap_daily_contents x JOIN ap_study_plans p ON p.id=x.plan_id
    WHERE p.plan_code='AP_2026_H2' AND x.study_date=dates.d AND x.content_type='subject_b_scenario'
  ) <> 1
) THEN 1 ELSE 0 END;
DROP TABLE _assert_ap_week;
