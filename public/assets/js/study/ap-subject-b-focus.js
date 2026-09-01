(() => {
  const allowed = new Set([
    'B-01','B-02','B-03','B-04','B-05','B-06','B-07',
    'B-08','B-09','B-10','B-11','B-12','B-13','B-14',
    'B-17','B-18','B-19','B-20','B-21','B-22',
    'B-23','B-24','B-25','B-26','B-27','B-28',
    'B-29','B-30','B-31','B-32'
  ]);
  const namesJa = {
    'B-01':'Web攻撃分析','B-02':'認証・MFAインシデント対応','B-03':'TLS・証明書','B-04':'ディジタル署名','B-05':'権限管理・最小権限','B-06':'ログ分析','B-07':'インシデント対応',
    'B-08':'配列・反復Trace','B-09':'BFS','B-10':'DFS・再帰','B-11':'二分探索','B-12':'整列Trace','B-13':'動的計画法DP','B-14':'計算量分析',
    'B-17':'Subnet・CIDR計算','B-18':'Routing Table','B-19':'TCP Seq・ACK','B-20':'DNS障害分析','B-21':'Firewall Rule','B-22':'VPN・Cloud接続',
    'B-23':'ER設計','B-24':'SQL結果Trace','B-25':'正規化','B-26':'Transaction・Lock','B-27':'Isolation異常','B-28':'Index設計',
    'B-29':'要件変更影響分析','B-30':'テストケース設計','B-31':'障害原因分析','B-32':'Review・品質管理'
  };
  const unitsJa = {'정보보안':'情報セキュリティ','프로그래밍':'プログラミング','네트워크':'ネットワーク','데이터베이스':'データベース','시스템개발':'情報システム開発','정보시스템개발':'情報システム開発'};
  function apply(){
    const part = new URLSearchParams(location.search).get('part') || 'A';
    if(part !== 'B') return;
    const body = document.getElementById('ap-concept-body');
    if(!body || !body.children.length) return false;
    [...body.querySelectorAll('tr')].forEach((tr) => {
      const code = tr.children[1]?.textContent.trim() || '';
      if(!allowed.has(code)) { tr.remove(); return; }
      const unitKo = tr.children[0]?.textContent.trim() || '';
      const nameKo = tr.children[2]?.textContent.trim() || '';
      if(tr.children[0]) tr.children[0].innerHTML = `<span class="ap-ja-primary">${unitsJa[unitKo] || unitKo}</span><span class="ap-ko-secondary" hidden>${unitKo}</span>`;
      if(tr.children[2]) tr.children[2].innerHTML = `<strong class="ap-ja-primary">${namesJa[code] || nameKo}</strong><span class="ap-ko-secondary" hidden>${nameKo}</span>`;
      if(tr.children[3]) tr.children[3].innerHTML = `<span class="ap-ja-primary">長文シナリオ、追跡・計算・判断、対策記述まで科目B形式で学習する。</span><span class="ap-ko-secondary" hidden>장문 시나리오, 추적·계산·판단, 대책 서술까지 과목 B 형식으로 학습한다.</span>`;
    });
    const title = document.getElementById('ap-concept-part-title');
    if(title) title.textContent = '科目B 概念整理 · 選択5分野';
    const head = document.querySelector('.ap-concept-card-head > div');
    if(head && !document.getElementById('ap-b-focus-note')) {
      const p = document.createElement('p'); p.id='ap-b-focus-note';
      p.innerHTML = '<span class="ap-ja-primary">必須：情報セキュリティ / 選択：プログラミング・データベース・ネットワーク・情報システム開発</span><span class="ap-ko-secondary" hidden>필수: 정보보안 / 선택: 프로그래밍·데이터베이스·네트워크·정보시스템개발</span>';
      head.appendChild(p);
    }
    return true;
  }
  if(!apply()){
    const body=document.getElementById('ap-concept-body');
    if(body) new MutationObserver(()=>apply()).observe(body,{childList:true});
  }
})();