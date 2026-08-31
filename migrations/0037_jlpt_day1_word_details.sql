-- 0037_jlpt_day1_word_details.sql
-- JLPT N1 Day 1 단어에 품사와 예문(일본어/읽기/한국어)을 보강한다.
-- 이후 오늘의 학습 신규 단어도 같은 수준의 상세 데이터를 함께 등록한다.

PRAGMA foreign_keys = ON;

WITH details(word, pos_name) AS (
    VALUES
      ('遂げる','一段動詞'),
      ('滞る','五段動詞'),
      ('損なう','五段動詞'),
      ('著しい','い形容詞'),
      ('促す','五段動詞'),
      ('覆す','五段動詞'),
      ('免れる','一段動詞'),
      ('携わる','五段動詞'),
      ('廃れる','一段動詞'),
      ('培う','五段動詞'),
      ('阻む','五段動詞'),
      ('強いる','一段動詞'),
      ('顧みる','一段動詞'),
      ('怠る','五段動詞'),
      ('乏しい','い形容詞'),
      ('紛らわしい','い形容詞'),
      ('夥しい','い形容詞'),
      ('円滑','な形容詞'),
      ('妥当','な形容詞'),
      ('懸念','サ変名詞')
)
INSERT OR IGNORE INTO japanese_word_parts_of_speech (word_id, part_of_speech_id, is_primary, created_at)
SELECT
    w.id,
    p.id,
    CASE WHEN EXISTS (
        SELECT 1 FROM japanese_word_parts_of_speech existing
        WHERE existing.word_id = w.id AND existing.is_primary = 1
    ) THEN 0 ELSE 1 END,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM details AS d
JOIN japanese_words AS w
  ON w.word = d.word
 AND w.deleted_at IS NULL
 AND w.id = (
    SELECT MIN(w2.id) FROM japanese_words AS w2
    WHERE w2.word = d.word AND w2.deleted_at IS NULL
 )
JOIN parts_of_speech AS p
  ON p.name_ja = d.pos_name
 AND p.deleted_at IS NULL;

WITH examples(word, sentence_ja, reading, translation_ko) AS (
    VALUES
      ('遂げる','長年の努力の末、彼はついに目標を遂げた。','ながねんのどりょくのすえ、かれはついにもくひょうをとげた。','오랜 노력 끝에 그는 마침내 목표를 달성했다.'),
      ('滞る','手続きが複雑で、申請の処理が滞っている。','てつづきがふくざつで、しんせいのしょりがとどこおっている。','절차가 복잡해 신청 처리가 지연되고 있다.'),
      ('損なう','睡眠不足は集中力を損なうおそれがある。','すいみんぶそくはしゅうちゅうりょくをそこなうおそれがある。','수면 부족은 집중력을 해칠 우려가 있다.'),
      ('著しい','この地域では人口の減少が著しい。','このちいきではじんこうのげんしょうがいちじるしい。','이 지역은 인구 감소가 현저하다.'),
      ('促す','上司はチームに早めの対応を促した。','じょうしはチームにはやめのたいおうをうながした。','상사는 팀에 빠른 대응을 촉구했다.'),
      ('覆す','新しい証拠がこれまでの判断を覆した。','あたらしいしょうこがこれまでのはんだんをくつがえした。','새로운 증거가 지금까지의 판단을 뒤집었다.'),
      ('免れる','適切な対策によって大きな被害を免れた。','てきせつなたいさくによっておおきなひがいをまぬがれた。','적절한 대책으로 큰 피해를 면했다.'),
      ('携わる','私は金融システムの開発に携わっている。','わたしはきんゆうシステムのかいはつにたずさわっている。','나는 금융 시스템 개발에 종사하고 있다.'),
      ('廃れる','便利な新製品の登場で、その習慣は次第に廃れた。','べんりなしんせいひんのとうじょうで、そのしゅうかんはしだいにすたれた。','편리한 신제품 등장으로 그 관습은 점차 쇠퇴했다.'),
      ('培う','実務経験を通じて問題解決力を培う。','じつむけいけんをつうじてもんだいかいけつりょくをつちかう。','실무 경험을 통해 문제 해결력을 기른다.'),
      ('阻む','大雨が救助活動を阻んだ。','おおあめがきゅうじょかつどうをはばんだ。','폭우가 구조 활동을 가로막았다.'),
      ('強いる','無理な残業を社員に強いるべきではない。','むりなざんぎょうをしゃいんにしいるべきではない。','무리한 야근을 직원에게 강요해서는 안 된다.'),
      ('顧みる','過去の失敗を顧みて、計画を見直した。','かこのしっぱいをかえりみて、けいかくをみなおした。','과거의 실패를 돌아보고 계획을 재검토했다.'),
      ('怠る','定期的なバックアップを怠ってはいけない。','ていきてきなバックアップをおこたってはいけない。','정기적인 백업을 소홀히 해서는 안 된다.'),
      ('乏しい','この地域は水資源に乏しい。','このちいきはみずしげんにとぼしい。','이 지역은 수자원이 부족하다.'),
      ('紛らわしい','この二つの用語は名前が似ていて紛らわしい。','このふたつのようごはなまえがにていてまぎらわしい。','이 두 용어는 이름이 비슷해 헷갈리기 쉽다.'),
      ('夥しい','会場には夥しい数の資料が積まれていた。','かいじょうにはおびただしいかずのしりょうがつまれていた。','행사장에는 엄청난 수의 자료가 쌓여 있었다.'),
      ('円滑','情報共有を徹底し、作業を円滑に進める。','じょうほうきょうゆうをてっていし、さぎょうをえんかつにすすめる。','정보 공유를 철저히 하여 작업을 원활하게 진행한다.'),
      ('妥当','この条件なら、その判断は妥当だと思う。','このじょうけんなら、そのはんだんはだとうだとおもう。','이 조건이라면 그 판단은 타당하다고 생각한다.'),
      ('懸念','個人情報の漏えいが懸念されている。','こじんじょうほうのろうえいがけねんされている。','개인정보 유출이 우려되고 있다.')
)
INSERT INTO japanese_word_examples (
    word_id, sentence_ja, reading, translation_ko, source_type, created_at, updated_at
)
SELECT
    w.id,
    e.sentence_ja,
    e.reading,
    e.translation_ko,
    'manual',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM examples AS e
JOIN japanese_words AS w
  ON w.word = e.word
 AND w.deleted_at IS NULL
 AND w.id = (
    SELECT MIN(w2.id) FROM japanese_words AS w2
    WHERE w2.word = e.word AND w2.deleted_at IS NULL
 )
WHERE NOT EXISTS (
    SELECT 1
    FROM japanese_word_examples AS existing
    WHERE existing.word_id = w.id
      AND existing.sentence_ja = e.sentence_ja
      AND existing.deleted_at IS NULL
);
