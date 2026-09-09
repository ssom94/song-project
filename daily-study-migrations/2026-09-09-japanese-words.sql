-- 2026-09-09 JLPT N1 신규 20단어 등록용
-- 원격 D1에는 자동 적용하지 않는다. 기존 word+reading 행은 재사용한다.
PRAGMA foreign_keys = ON;

CREATE TEMP TABLE _jlpt_20260909_words (
  word TEXT NOT NULL,
  reading TEXT NOT NULL,
  meaning_ko TEXT NOT NULL,
  meaning_ja TEXT NOT NULL,
  pos_name_ja TEXT NOT NULL,
  sentence_ja TEXT NOT NULL,
  example_reading TEXT NOT NULL,
  translation_ko TEXT NOT NULL,
  PRIMARY KEY (word, reading)
) WITHOUT ROWID;

INSERT INTO _jlpt_20260909_words
(word, reading, meaning_ko, meaning_ja, pos_name_ja, sentence_ja, example_reading, translation_ko)
VALUES
('怠慢','たいまん','태만|게으름','すべきことを怠り、責任を果たそうとしないこと。','な形容詞','安全確認を怠慢に扱えば、重大な事故につながりかねない。','あんぜんかくにんをたいまんにあつかえば、じゅうだいなじこにつながりかねない。','안전 확인을 태만하게 다루면 중대한 사고로 이어질 수 있다.'),
('膨らむ','ふくらむ','부풀다|늘어나다','物の体積が大きくなる。また、数量や期待などが増す。','五段動詞','原材料費の高騰により、製品価格への懸念が膨らんでいる。','げんざいりょうひのこうとうにより、せいひんかかくへのけねんがふくらんでいる。','원재료비 상승으로 제품 가격에 대한 우려가 커지고 있다.'),
('覆う','おおう','덮다|뒤덮다','表面をすっかり包む。また、見えないように隠す。','五段動詞','厚い雲が空を覆い、辺りは急に暗くなった。','あついくもがそらをおおい、あたりはきゅうにくらくなった。','두꺼운 구름이 하늘을 뒤덮어 주변이 갑자기 어두워졌다.'),
('迫る','せまる','다가오다|재촉하다','時間や期限などが近づく。また、相手に強く要求する。','五段動詞','納期が迫るなか、担当者は最後の確認を急いだ。','のうきがせまるなか、たんとうしゃはさいごのかくにんをいそいだ。','납기가 다가오는 가운데 담당자는 마지막 확인을 서둘렀다.'),
('遂に','ついに','마침내','長い時間や努力の末に、ある結果に至ったさま。','副詞','長年の交渉を経て、遂に両社は合意に達した。','ながねんのこうしょうをへて、ついにりょうしゃはごういにたっした。','수년에 걸친 협상을 거쳐 마침내 양사는 합의에 도달했다.'),
('予め','あらかじめ','미리','前もって。事前に。','副詞','参加者は予め資料に目を通しておいてください。','さんかしゃはあらかじめしりょうにめをとおしておいてください。','참가자는 미리 자료를 읽어 두십시오.'),
('極めて','きわめて','지극히|매우','程度が非常に高いさま。','副詞','この判断は極めて重要な意味を持つ。','このはんだんはきわめてじゅうようないみをもつ。','이 판단은 매우 중요한 의미를 지닌다.'),
('専ら','もっぱら','오로지|주로','他のことをほとんどせず、それだけをするさま。','副詞','現在は専ら海外市場向けの製品開発に力を入れている。','げんざいはもっぱらかいがいしじょうむけのせいひんかいはつにちからをいれている。','현재는 주로 해외 시장용 제품 개발에 힘을 쏟고 있다.'),
('到底','とうてい','도저히','どう考えても、どんなにしても。後に打消しを伴う。','副詞','現状の人員だけでは到底対応しきれない。','げんじょうのじんいんだけではとうていたいおうしきれない。','현재 인원만으로는 도저히 모두 대응할 수 없다.'),
('一概に','いちがいに','일률적으로|무조건','一つの基準だけで、例外なく同じように扱うさま。','副詞','費用が高いからといって、一概に質が高いとは限らない。','ひようがたかいからといって、いちがいにしつがたかいとはかぎらない。','비용이 높다고 해서 무조건 품질이 높다고 할 수는 없다.'),
('相違','そうい','차이|상이','二つ以上のものの間に違いがあること。','サ変名詞','両案には細部に相違があるものの、基本方針は共通している。','りょうあんにはさいぶにそういがあるものの、きほんほうしんはきょうつうしている。','두 안은 세부적인 차이는 있지만 기본 방침은 공통적이다.'),
('矛盾','むじゅん','모순','前後の内容や道理が食い違い、両立しないこと。','サ変名詞','説明の一部に矛盾が見られ、再調査が必要となった。','せつめいのいちぶにむじゅんがみられ、さいちょうさがひつようとなった。','설명의 일부에서 모순이 보여 재조사가 필요해졌다.'),
('妥協','だきょう','타협','対立する双方が互いに譲り合い、折り合いをつけること。','サ変名詞','短期的な解決のために安易な妥協をしてはならない。','たんきてきなかいけつのためにあんいなだきょうをしてはならない。','단기적인 해결을 위해 안이한 타협을 해서는 안 된다.'),
('配慮','はいりょ','배려|고려','相手や事情を考えて、気を配ること。','サ変名詞','利用者への配慮を欠いた設計は、現場で受け入れられにくい。','りようしゃへのはいりょをかいたせっけいは、げんばでうけいれられにくい。','사용자에 대한 배려가 부족한 설계는 현장에서 받아들여지기 어렵다.'),
('措置','そち','조치','事態に応じて取るべき手段や対応。','普通名詞','被害の拡大を防ぐため、直ちに必要な措置を講じた。','ひがいのかくだいをふせぐため、ただちにひつようなそちをこうじた。','피해 확대를 막기 위해 즉시 필요한 조치를 취했다.'),
('趣旨','しゅし','취지','文章や発言などが表そうとしている中心的な意味や目的。','普通名詞','制度の趣旨を踏まえ、申請手続きを簡素化した。','せいどのしゅしをふまえ、しんせいてつづきをかんそかした。','제도의 취지를 바탕으로 신청 절차를 간소화했다.'),
('経緯','けいい','경위|과정','物事が現在の状態に至るまでの事情や流れ。','普通名詞','今回の決定に至った経緯を、関係者に丁寧に説明した。','こんかいのけっていにいたったけいいを、かんけいしゃにていねいにせつめいした。','이번 결정에 이르게 된 경위를 관계자에게 정중히 설명했다.'),
('見解','けんかい','견해','物事に対する見方や考え方。','普通名詞','専門家の見解が分かれ、結論を出すまでに時間を要した。','せんもんかのけんかいがわかれ、けつろんをだすまでにじかんをようした。','전문가의 견해가 갈려 결론을 내리기까지 시간이 걸렸다.'),
('傾向','けいこう','경향','物事がある方向に向かう、全体的なありさま。','普通名詞','近年は若者の読書量が減少する傾向にある。','きんねんはわかもののどくしょりょうがげんしょうするけいこうにある。','최근에는 젊은 층의 독서량이 감소하는 경향이 있다.'),
('兆候','ちょうこう','징후','ある出来事が起こる前に現れるしるし。','普通名詞','症状の改善は、回復の兆候として受け止められた。','しょうじょうのかいぜんは、かいふくのちょうこうとしてうけとめられた。','증상의 개선은 회복의 징후로 받아들여졌다.');

INSERT INTO japanese_words
(word, reading, meaning_ko, meaning_ja, jlpt_level_id, ai_status, note)
SELECT s.word, s.reading, s.meaning_ko, s.meaning_ja, l.id, 'reviewed',
       '2026-09-09 오늘의 학습 N1 신규 단어 검증 완료'
FROM _jlpt_20260909_words AS s
JOIN jlpt_levels AS l ON l.code = 'N1'
WHERE NOT EXISTS (
  SELECT 1 FROM japanese_words AS w
  WHERE w.word = s.word
    AND COALESCE(w.reading, '') = s.reading
    AND w.deleted_at IS NULL
);

UPDATE japanese_words AS w
SET meaning_ko = COALESCE(NULLIF(trim(w.meaning_ko), ''), (SELECT s.meaning_ko FROM _jlpt_20260909_words AS s WHERE s.word = w.word AND s.reading = COALESCE(w.reading, ''))),
    meaning_ja = COALESCE(NULLIF(trim(w.meaning_ja), ''), (SELECT s.meaning_ja FROM _jlpt_20260909_words AS s WHERE s.word = w.word AND s.reading = COALESCE(w.reading, ''))),
    jlpt_level_id = COALESCE(w.jlpt_level_id, (SELECT id FROM jlpt_levels WHERE code = 'N1')),
    ai_status = CASE WHEN w.ai_status = 'not_analyzed' THEN 'reviewed' ELSE w.ai_status END,
    note = COALESCE(NULLIF(trim(w.note), ''), '2026-09-09 오늘의 학습 N1 신규 단어 검증 완료'),
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE EXISTS (
  SELECT 1 FROM _jlpt_20260909_words AS s
  WHERE s.word = w.word AND s.reading = COALESCE(w.reading, '')
);

INSERT OR IGNORE INTO japanese_word_parts_of_speech
(word_id, part_of_speech_id, is_primary)
SELECT w.id, p.id, 1
FROM _jlpt_20260909_words AS s
JOIN japanese_words AS w
  ON w.word = s.word AND COALESCE(w.reading, '') = s.reading AND w.deleted_at IS NULL
JOIN parts_of_speech AS p
  ON p.name_ja = s.pos_name_ja AND p.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM japanese_word_parts_of_speech AS x
  WHERE x.word_id = w.id AND x.part_of_speech_id = p.id
);

INSERT INTO japanese_word_examples
(word_id, sentence_ja, reading, translation_ko, note, source_type)
SELECT w.id, s.sentence_ja, s.example_reading, s.translation_ko,
       '2026-09-09 JLPT N1 예문', 'ai_reviewed'
FROM _jlpt_20260909_words AS s
JOIN japanese_words AS w
  ON w.word = s.word AND COALESCE(w.reading, '') = s.reading AND w.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM japanese_word_examples AS e
  WHERE e.word_id = w.id AND e.sentence_ja = s.sentence_ja
);
