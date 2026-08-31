-- 0038_japanese_kanji_korean_reading.sql
-- 일본어 단어에 포함된 한자의 한국식 훈(뜻)·음 정보를 재사용 가능한 사전으로 관리한다.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS japanese_kanji_korean_readings (
    kanji TEXT PRIMARY KEY,
    meaning_ko TEXT NOT NULL,
    sound_ko TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO japanese_kanji_korean_readings (kanji, meaning_ko, sound_ko, note)
VALUES
    ('遂','이룰·드디어','수','遂げる'),
    ('滞','막힐','체','滞る'),
    ('損','덜·손해','손','損なう'),
    ('著','드러날·나타날','저','著しい'),
    ('促','재촉할','촉','促す'),
    ('覆','뒤집을·덮을','복','覆す'),
    ('免','면할','면','免れる'),
    ('携','이끌·가질','휴','携わる'),
    ('廃','폐할','폐','廃れる'),
    ('培','북돋울·기를','배','培う'),
    ('阻','막을','조','阻む'),
    ('強','강할','강','強いる'),
    ('顧','돌아볼','고','顧みる'),
    ('怠','게으를','태','怠る'),
    ('乏','모자랄','핍','乏しい'),
    ('紛','어지러울','분','紛らわしい'),
    ('夥','많을','과','夥しい'),
    ('円','둥글','원','円滑'),
    ('滑','미끄러울','활','円滑'),
    ('妥','온당할','타','妥当'),
    ('当','마땅할','당','妥当'),
    ('懸','매달·걸','현','懸念'),
    ('念','생각','념','懸念')
ON CONFLICT(kanji) DO UPDATE SET
    meaning_ko = excluded.meaning_ko,
    sound_ko = excluded.sound_ko,
    note = excluded.note,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');
