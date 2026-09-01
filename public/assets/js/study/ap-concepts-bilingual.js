(() => {
  const unitJa = { '기초이론':'基礎理論','알고리즘':'アルゴリズム','컴퓨터구성':'コンピュータ構成','시스템':'システム構成','OS':'OS','데이터베이스':'データベース','네트워크':'ネットワーク','보안':'情報セキュリティ','개발':'システム開発','PM':'プロジェクトマネジメント','서비스관리':'サービスマネジメント','감사':'システム監査','전략':'システム戦略・経営戦略','회계':'企業活動・会計','법무':'法務','정보보안':'情報セキュリティ','프로그래밍':'プログラミング・アルゴリズム','시스템구성':'システム構成','시스템개발':'システム開発','전략·경영':'経営戦略' };
  const names = {
    'A-01':'2進数・16進数','A-02':'2の補数','A-03':'論理演算','A-04':'確率','A-05':'情報量・エントロピー','A-06':'浮動小数点・誤差','A-07':'Big-O記法','A-08':'線形探索','A-09':'二分探索','A-10':'スタック・キュー','A-11':'木・二分探索木','A-12':'グラフ BFS・DFS','A-13':'整列アルゴリズム','A-14':'CPU実行時間・CPI','A-15':'パイプライン','A-16':'キャッシュメモリ','A-17':'RAID','A-18':'可用性','A-19':'冗長化・フェイルオーバ','A-20':'プロセス・スレッド','A-21':'CPUスケジューリング','A-22':'仮想記憶・ページング','A-23':'ページフォールト・スラッシング','A-24':'デッドロック','A-25':'主キー・外部キー','A-26':'ERモデル','A-27':'正規化','A-28':'SQL JOIN','A-29':'GROUP BY・HAVING','A-30':'ACID特性','A-31':'ロック・同時実行制御','A-32':'インデックス','A-33':'OSI・TCP/IP','A-34':'IPv4・CIDR','A-35':'サブネット','A-36':'TCP・UDP','A-37':'DNS・DHCP・NAT','A-38':'ルーティング','A-39':'HTTP・HTTPS・TLS','A-40':'共通鍵・公開鍵暗号','A-41':'ハッシュ・ソルト','A-42':'ディジタル署名・PKI','A-43':'MFA・アクセス制御','A-44':'SQLインジェクション','A-45':'XSS・CSRF','A-46':'FW・WAF・IDS・IPS','A-47':'ウォーターフォール・アジャイル','A-48':'要件定義','A-49':'UML','A-50':'テスト工程','A-51':'同値分割・境界値分析','A-52':'レビュー・構成管理','A-53':'PERT・クリティカルパス','A-54':'EVM','A-55':'CPI・SPI','A-56':'リスク管理','A-57':'SLA・SLM','A-58':'インシデント・問題管理','A-59':'システム監査','A-60':'職務分掌・内部統制','A-61':'SWOT分析','A-62':'PPM','A-63':'ファイブフォース分析','A-64':'4P・4C','A-65':'損益分岐点','A-66':'ROI・財務指標','A-67':'著作権・特許権','A-68':'個人情報・標準化'
  };
  function enhance() {
    const rows=[...document.querySelectorAll('#ap-concept-body tr')];
    if(!rows.length) return false;
    const lang=document.body?.dataset?.blogLanguage==='ja'?'ja':'ko';
    const prefix=`/${lang}/study/ap/concepts`;
    rows.forEach((tr)=>{
      if(tr.dataset.bilingual==='1') return;
      tr.dataset.bilingual='1';
      const cells=tr.children;
      const unitKo=cells[0]?.textContent.trim()||'';
      const no=cells[1]?.textContent.trim()||'';
      const nameKo=cells[2]?.textContent.trim()||'';
      const coreKo=cells[3]?.textContent.trim()||'';
      const nameJa=names[no]||nameKo;
      if(cells[0]) cells[0].innerHTML=`<span class="ap-ja-primary">${unitJa[unitKo]||unitKo}</span><span class="ap-ko-secondary" hidden>${unitKo}</span>`;
      if(cells[2]) cells[2].innerHTML=`<strong class="ap-ja-primary">${nameJa}</strong><span class="ap-ko-secondary" hidden>${nameKo}</span>`;
      if(cells[3]) cells[3].innerHTML=`<span class="ap-ja-primary">${nameJa}の定義・原理・計算/判断方法・試験の罠・暗記ポイントを確認する。</span><span class="ap-ko-secondary" hidden>${coreKo}</span>`;
      if(cells[4]) cells[4].innerHTML=`<div class="ap-concept-actions"><a class="ap-concept-detail-button" href="${prefix}/detail/?code=${encodeURIComponent(no)}">概念詳細</a><a class="ap-concept-problem-button" href="${prefix}/problem/?code=${encodeURIComponent(no)}">予想問題</a></div>`;
    });
    const head=document.querySelector('.ap-concept-card-head');
    if(head&&!document.getElementById('ap-concept-ko-toggle')){
      const btn=document.createElement('button'); btn.id='ap-concept-ko-toggle'; btn.type='button'; btn.className='ap-concept-lang-button'; btn.textContent='한국어 같이 보기'; btn.setAttribute('aria-pressed','false');
      btn.addEventListener('click',()=>{const show=btn.getAttribute('aria-pressed')!=='true';btn.setAttribute('aria-pressed',String(show));btn.textContent=show?'한국어 숨기기':'한국어 같이 보기';document.querySelectorAll('.ap-ko-secondary').forEach((el)=>{el.hidden=!show;});});
      head.appendChild(btn);
    }
    return true;
  }
  if(!enhance()){const target=document.getElementById('ap-concept-body');if(target)new MutationObserver(enhance).observe(target,{childList:true});}
})();