-- 2026-09-08-japanese-words.sql
-- 2026-09-08 JLPT N1 신규 20단어 -> 일본어학습 등록용
-- 원격 D1에는 자동 적용하지 않는다. 기존 word+reading 행은 재사용한다.
PRAGMA foreign_keys = ON;

CREATE TEMP TABLE _jlpt_20260908_words (
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

INSERT INTO _jlpt_20260908_words
(word, reading, meaning_ko, meaning_ja, pos_name_ja, sentence_ja, example_reading, translation_ko)
VALUES
('妨げる','さまたげる','방해하다|가로막다','物事の進行や実現を邪魔して、うまく進まないようにする。','一段動詞','過度な手続は迅速な意思決定を妨げるおそれがある。','かどなてつづきはじんそくないしけっていをさまたげるおそれがある。','과도한 절차는 신속한 의사결정을 방해할 우려가 있다.'),
('伴う','ともなう','수반하다|동반하다','ある物事に付随して、別の物事が一緒に起こる。','五段動詞','制度の変更には一定の混乱を伴う可能性がある。','せいどのへんこうにはいっていのこんらんをともなうかのうせいがある。','제도 변경에는 일정한 혼란이 수반될 가능성이 있다.'),
('促進','そくしん','촉진','物事が早く進むように働きかけること。','サ変名詞','自治体は地域産業のデジタル化を促進する施策を打ち出した。','じちたいはちいきさんぎょうのでじたるかをそくしんするしさくをうちだした。','지자체는 지역 산업의 디지털화를 촉진하는 시책을 내놓았다.'),
('削減','さくげん','삭감|감축','数量や費用などを減らすこと。','サ変名詞','運用コストを削減しても品質を維持できる仕組みが必要だ。','うんようこすとをさくげんしてもひんしつをいじできるしくみがひつようだ。','운영 비용을 감축하더라도 품질을 유지할 수 있는 구조가 필요하다.'),
('徹底','てってい','철저함|철저히 하다','方針や方法などを中途半端にせず、すみずみまで行き届かせること。','サ変名詞','再発防止のため、作業手順の確認を全員に徹底した。','さいはつぼうしのため、さぎょうてじゅんのかくにんをぜんいんにてっていした。','재발 방지를 위해 작업 절차 확인을 전원에게 철저히 하도록 했다.'),
('兼ねる','かねる','겸하다|~하기 어렵다','一つのものが二つ以上の役割を持つ。また、補助動詞として「できない」の意を丁寧に表す。','一段動詞','この会議室は来客用の応接室も兼ねている。','このかいぎしつはらいきゃくようのおうせつしつもかねている。','이 회의실은 방문객용 응접실도 겸하고 있다.'),
('見込む','みこむ','예상하다|내다보다','将来の結果や数量などを予想する。また、可能性があると判断する。','五段動詞','今年度は利用者数が前年を上回ると見込んでいる。','こんねんどはりようしゃすうがぜんねんをうわまわるとみこんでいる。','올해는 이용자 수가 전년을 웃돌 것으로 예상하고 있다.'),
('損失','そんしつ','손실','利益や財産などを失うこと。また、失ったもの。','普通名詞','障害による業務停止が長引けば大きな損失につながる。','しょうがいによるぎょうむていしがながびけばおおきなそんしつにつながる。','장애로 인한 업무 중단이 길어지면 큰 손실로 이어진다.'),
('懸命','けんめい','필사적임|열심임','力の限り努力するさま。一生懸命であるさま。','な形容詞','担当者たちは復旧に向けて懸命な作業を続けた。','たんとうしゃたちはふっきゅうにむけてけんめいなさぎょうをつづけた。','담당자들은 복구를 위해 필사적으로 작업을 계속했다.'),
('敏感','びんかん','민감함','わずかな変化や刺激にもすぐ反応するさま。','な形容詞','市場は金利の変化に敏感に反応する傾向がある。','しじょうはきんりのへんかにびんかんにはんのうするけいこうがある。','시장은 금리 변화에 민감하게 반응하는 경향이 있다.'),
('排除','はいじょ','배제','不要なものや妨げとなるものを取り除くこと。','サ変名詞','不正なアクセスを排除するために認証方式を見直した。','ふせいなあくせすをはいじょするためににんしょうほうしきをみなおした。','부정한 접근을 배제하기 위해 인증 방식을 재검토했다.'),
('整備','せいび','정비','必要なものを整え、いつでも使える状態にすること。','サ変名詞','災害時にも業務を継続できる体制を整備する必要がある。','さいがいじにもぎょうむをけいぞくできるたいせいをせいびするひつようがある。','재해 시에도 업무를 지속할 수 있는 체계를 정비할 필요가 있다.'),
('兆し','きざし','조짐|징조','物事が起こりそうであることを示す気配。','普通名詞','長く低迷していた市場にも回復の兆しが見え始めた。','ながくていめいしていたしじょうにもかいふくのきざしがみえはじめた。','오랫동안 침체되어 있던 시장에도 회복의 조짐이 보이기 시작했다.'),
('著す','あらわす','저술하다|책을 쓰다','書物を書いて世に出す。著作する。','五段動詞','彼は長年の研究成果を一冊の本に著した。','かれはながねんのけんきゅうせいかをいっさつのほんにあらわした。','그는 오랜 연구 성과를 한 권의 책으로 저술했다.'),
('免除','めんじょ','면제','義務や負担などを課さず、しなくてもよいことにすること。','サ変名詞','一定の条件を満たす場合は受験料が免除される。','いっていのじょうけんをみたすばあいはじゅけんりょうがめんじょされる。','일정 조건을 충족하는 경우 응시료가 면제된다.'),
('権限','けんげん','권한','職務上、ある行為を行うことができる権利や範囲。','普通名詞','重要な設定変更は管理者権限を持つ担当者だけが行える。','じゅうようなせっていへんこうはかんりしゃけんげんをもつたんとうしゃだけがおこなえる。','중요한 설정 변경은 관리자 권한을 가진 담당자만 할 수 있다.'),
('収束','しゅうそく','수습|수렴','混乱や事態などが落ち着いて終わりに向かうこと。また、一つに集まること。','サ変名詞','関係部署の対応によって障害はようやく収束に向かった。','かんけいぶしょのたいおうによってしょうがいはようやくしゅうそくにむかった。','관련 부서의 대응으로 장애는 마침내 수습 국면에 들어갔다.'),
('円満','えんまん','원만함','人間関係などが穏やかで、争いがなく満ち足りているさま。','な形容詞','双方が条件を譲歩し、交渉は円満にまとまった。','そうほうがじょうけんをじょうほし、こうしょうはえんまんにまとまった。','양측이 조건을 양보하여 협상은 원만하게 마무리되었다.'),
('迅速','じんそく','신속함','物事の進み方や処理が非常に速いさま。','な形容詞','事故発生時には正確かつ迅速な情報共有が欠かせない。','じこはっせいじにはせいかくかつじんそくなじょうほうきょうゆうがかかせない。','사고 발생 시에는 정확하고 신속한 정보 공유가 필수적이다.'),
('打開','だかい','타개','行き詰まった状態を切り開いて解決への道を作ること。','サ変名詞','膠着した状況を打開するため、新たな提案を示した。','こうちゃくしたじょうきょうをだかいするため、あらたなていあんをしめした。','교착된 상황을 타개하기 위해 새로운 제안을 제시했다.');

INSERT INTO japanese_words
(word, reading, meaning_ko, meaning_ja, jlpt_level_id, ai_status, note)
SELECT s.word, s.reading, s.meaning_ko, s.meaning_ja, l.id, 'reviewed',
       '2026-09-08 오늘의 학습 N1 신규 단어 검증 완료'
FROM _jlpt_20260908_words AS s
JOIN jlpt_levels AS l ON l.code = 'N1'
WHERE NOT EXISTS (
  SELECT 1 FROM japanese_words AS w
  WHERE w.word = s.word
    AND COALESCE(w.reading, '') = s.reading
    AND w.deleted_at IS NULL
);

UPDATE japanese_words AS w
SET meaning_ko = CASE WHEN w.meaning_ko IS NULL OR trim(w.meaning_ko) = '' THEN
      (SELECT s.meaning_ko FROM _jlpt_20260908_words AS s WHERE s.word = w.word AND s.reading = COALESCE(w.reading, ''))
      ELSE w.meaning_ko END,
    meaning_ja = CASE WHEN w.meaning_ja IS NULL OR trim(w.meaning_ja) = '' THEN
      (SELECT s.meaning_ja FROM _jlpt_20260908_words AS s WHERE s.word = w.word AND s.reading = COALESCE(w.reading, ''))
      ELSE w.meaning_ja END,
    jlpt_level_id = COALESCE(w.jlpt_level_id, (SELECT id FROM jlpt_levels WHERE code = 'N1')),
    ai_status = CASE WHEN w.ai_status = 'not_analyzed' THEN 'reviewed' ELSE w.ai_status END,
    note = CASE WHEN w.note IS NULL OR trim(w.note) = '' THEN '2026-09-08 오늘의 학습 N1 신규 단어 검증 완료' ELSE w.note END,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE EXISTS (
  SELECT 1 FROM _jlpt_20260908_words AS s
  WHERE s.word = w.word AND s.reading = COALESCE(w.reading, '')
);

INSERT OR IGNORE INTO japanese_word_parts_of_speech
(word_id, part_of_speech_id, is_primary)
SELECT MIN(w.id), p.id, 1
FROM _jlpt_20260908_words AS s
JOIN japanese_words AS w
  ON w.word = s.word AND COALESCE(w.reading, '') = s.reading AND w.deleted_at IS NULL
JOIN parts_of_speech AS p
  ON p.name_ja = s.pos_name_ja AND p.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM japanese_word_parts_of_speech AS x
  WHERE x.word_id = w.id AND x.is_primary = 1
)
GROUP BY s.word, s.reading, p.id;

INSERT INTO japanese_word_examples
(word_id, sentence_ja, reading, translation_ko, note, source_type)
SELECT MIN(w.id), s.sentence_ja, s.example_reading, s.translation_ko,
       '2026-09-08 오늘의 학습 검증 예문', 'manual'
FROM _jlpt_20260908_words AS s
JOIN japanese_words AS w
  ON w.word = s.word AND COALESCE(w.reading, '') = s.reading AND w.deleted_at IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM japanese_word_examples AS e
  WHERE e.word_id = w.id
    AND e.sentence_ja = s.sentence_ja
    AND e.deleted_at IS NULL
)
GROUP BY s.word, s.reading, s.sentence_ja, s.example_reading, s.translation_ko;

DROP TABLE _jlpt_20260908_words;
