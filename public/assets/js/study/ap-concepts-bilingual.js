(() => {
  const unitJa = { '기초이론':'基礎理論','알고리즘':'アルゴリズム','컴퓨터구성':'コンピュータ構成','시스템':'システム構成','OS':'OS','데이터베이스':'データベース','네트워크':'ネットワーク','보안':'情報セキュリティ','개발':'システム開発','PM':'プロジェクトマネジメント','서비스관리':'サービスマネジメント','감사':'システム監査','전략':'システム戦略・経営戦略','회계':'企業活動・会計','법무':'法務','정보보안':'情報セキュリティ','프로그래밍':'プログラミング・アルゴリズム','시스템구성':'システム構成','시스템개발':'システム開発','전략·경영':'経営戦略' };
  const names = {
    'A-01':'2進数・16進数','A-02':'2の補数','A-03':'論理演算','A-04':'確率','A-05':'情報量・エントロピー','A-06':'浮動小数点・誤差','A-07':'Big-O記法','A-08':'線形探索','A-09':'二分探索','A-10':'スタック・キュー','A-11':'木・二分探索木','A-12':'グラフ BFS・DFS','A-13':'整列アルゴリズム','A-14':'CPU実行時間・CPI','A-15':'パイプライン','A-16':'キャッシュメモリ','A-17':'RAID','A-18':'可用性','A-19':'冗長化・フェイルオーバ','A-20':'プロセス・スレッド','A-21':'CPUスケジューリング','A-22':'仮想記憶・ページング','A-23':'ページフォールト・スラッシング','A-24':'デッドロック','A-25':'主キー・外部キー','A-26':'ERモデル','A-27':'正規化','A-28':'SQL JOIN','A-29':'GROUP BY・HAVING','A-30':'ACID特性','A-31':'ロック・同時実行制御','A-32':'インデックス','A-33':'OSI・TCP/IP','A-34':'IPv4・CIDR','A-35':'サブネット','A-36':'TCP・UDP','A-37':'DNS・DHCP・NAT','A-38':'ルーティング','A-39':'HTTP・HTTPS・TLS','A-40':'共通鍵・公開鍵暗号','A-41':'ハッシュ・ソルト','A-42':'ディジタル署名・PKI','A-43':'MFA・アクセス制御','A-44':'SQLインジェクション','A-45':'XSS・CSRF','A-46':'FW・WAF・IDS・IPS','A-47':'ウォーターフォール・アジャイル','A-48':'要件定義','A-49':'UML','A-50':'テスト工程','A-51':'同値分割・境界値分析','A-52':'レビュー・構成管理','A-53':'PERT・クリティカルパス','A-54':'EVM','A-55':'CPI・SPI','A-56':'リスク管理','A-57':'SLA・SLM','A-58':'インシデント・問題管理','A-59':'システム監査','A-60':'職務分掌・内部統制','A-61':'SWOT分析','A-62':'PPM','A-63':'ファイブフォース分析','A-64':'4P・4C','A-65':'損益分岐点','A-66':'ROI・財務指標','A-67':'著作権・特許権','A-68':'個人情報・標準化',
    'B-01':'Web攻撃分析','B-02':'認証・MFA事故対応','B-03':'TLS・証明書','B-04':'ディジタル署名','B-05':'権限管理・最小権限','B-06':'ログ分析','B-07':'インシデント対応','B-08':'配列・繰返しトレース','B-09':'BFS','B-10':'DFS・再帰','B-11':'二分探索','B-12':'整列トレース','B-13':'動的計画法（DP）','B-14':'計算量分析','B-15':'可用性・冗長化','B-16':'性能・待ち行列','B-17':'サブネット・CIDR計算','B-18':'ルーティングテーブル','B-19':'TCP Seq・ACK','B-20':'DNS障害分析','B-21':'ファイアウォールルール','B-22':'VPN・クラウド接続','B-23':'ER設計','B-24':'SQL結果トレース','B-25':'正規化','B-26':'トランザクション・ロック','B-27':'分離レベルの異常現象','B-28':'インデックス設計','B-29':'要件変更の影響分析','B-30':'テストケース設計','B-31':'障害原因分析','B-32':'レビュー・品質管理','B-33':'クリティカルパス','B-34':'EVM','B-35':'リスク対応','B-36':'インシデント優先度','B-37':'問題管理','B-38':'SLA・可用性','B-39':'職務分掌・監査証拠','B-40':'SWOT・損益分岐点'
  };
  function enhance() {
    const rows = [...document.querySelectorAll('#ap-concept-body tr')];
    if (!rows.length) return false;
    rows.forEach((tr) => {
      if (tr.dataset.bilingual === '1') return;
      tr.dataset.bilingual = '1';
      const cells = tr.children;
      const unitKo = cells[0]?.textContent.trim() || '';
      const no = cells[1]?.textContent.trim() || '';
      const nameKo = cells[2]?.textContent.trim() || '';
      const coreKo = cells[3]?.textContent.trim() || '';
      const nameJa = names[no] || nameKo;
      if (unitKo && cells[0]) cells[0].innerHTML = `<span class="ap-ja-primary">${unitJa[unitKo] || unitKo}</span><span class="ap-ko-secondary" hidden>${unitKo}</span>`;
      if (cells[2]) cells[2].innerHTML = `<strong class="ap-ja-primary">${nameJa}</strong><span class="ap-ko-secondary" hidden>${nameKo}</span>`;
      if (cells[3]) cells[3].innerHTML = `<span class="ap-ja-primary">${nameJa}の定義・特徴・計算方法・出題ポイントを確認する。</span><span class="ap-ko-secondary" hidden>${coreKo}</span>`;
      const part = no.startsWith('B-') ? 'B' : 'A';
      const unit = unitKo || tr.previousElementSibling?.dataset.lastUnit || '';
      tr.dataset.lastUnit = unit;
      const q = `part=${part}&no=${encodeURIComponent(no)}&concept=${encodeURIComponent(nameKo)}&conceptJa=${encodeURIComponent(nameJa)}&unit=${encodeURIComponent(unit)}`;
      if (cells[4]) cells[4].innerHTML = `<div class="ap-concept-actions"><a class="ap-concept-detail-button" href="/ko/study/ap/concepts/detail/?${q}">概念詳細</a><a class="ap-concept-problem-button" href="/ko/study/ap/concepts/problem/?${q}">予想問題</a></div>`;
    });
    const cardHead = document.querySelector('.ap-concept-card-head');
    if (cardHead && !document.getElementById('ap-concept-ko-toggle')) {
      const btn = document.createElement('button');
      btn.id = 'ap-concept-ko-toggle'; btn.type = 'button'; btn.className = 'ap-concept-lang-button'; btn.textContent = '한국어 같이 보기'; btn.setAttribute('aria-pressed','false');
      btn.addEventListener('click', () => {
        const show = btn.getAttribute('aria-pressed') !== 'true';
        btn.setAttribute('aria-pressed', String(show)); btn.textContent = show ? '한국어 숨기기' : '한국어 같이 보기';
        document.querySelectorAll('.ap-ko-secondary').forEach((el) => { el.hidden = !show; });
      });
      cardHead.appendChild(btn);
    }
    return true;
  }
  if (!enhance()) {
    const target = document.getElementById('ap-concept-body');
    if (target) new MutationObserver(() => { if (enhance()) {} }).observe(target,{childList:true});
  }
})();