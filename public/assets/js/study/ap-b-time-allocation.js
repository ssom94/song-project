(() => {
  const body = document.body;
  if (!body || body.dataset.apMockPage !== 'list') return;
  const lang = body.dataset.blogLanguage === 'ko' ? 'ko' : 'ja';
  const t = (ko, ja) => lang === 'ko' ? ko : ja;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const PERFORMANCE_KEY = 'song:ap:b-reinforcement-performance:v1';
  const CHANGE_EVENT = 'song:ap:b-performance-changed';
  const TOTAL_MINUTES = 150;
  const REVIEW_MINUTES = 10;
  const QUESTION_POOL_MINUTES = TOTAL_MINUTES - REVIEW_MINUTES;
  const fieldNames = {
    1:['정보보안','情報セキュリティ'],2:['경영전략','経営戦略'],3:['프로그래밍','プログラミング'],4:['시스템 아키텍처','システムアーキテクチャ'],5:['네트워크','ネットワーク'],6:['데이터베이스','データベース'],7:['임베디드 시스템','組込みシステム'],8:['시스템 개발','システム開発'],9:['프로젝트 관리','プロジェクトマネジメント'],10:['서비스 관리','サービスマネジメント'],11:['시스템 감사','システム監査']
  };

  function subjectFromUrl() { return new URLSearchParams(location.search).get('subject') === 'B' ? 'B' : 'A'; }
  function fieldName(no) { const pair=fieldNames[no]||[`Q${no}`,`Q${no}`]; return t(pair[0],pair[1]); }
  function clamp(value,min,max) { return Math.max(min,Math.min(max,value)); }
  function readAttempts() {
    try {
      const data=JSON.parse(localStorage.getItem(PERFORMANCE_KEY)||'{}');
      return Array.isArray(data?.attempts)?data.attempts.slice(-20):[];
    } catch { return []; }
  }
  function normalizeTimedAttempt(attempt) {
    if (attempt?.source!=='simulation' || !attempt?.questionSeconds || typeof attempt.questionSeconds!=='object') return null;
    const selected=(Array.isArray(attempt.selected)?attempt.selected:[]).map(Number).filter((no,i,a)=>no>=1&&no<=11&&a.indexOf(no)===i).sort((a,b)=>a-b);
    if (selected.length!==5 || !selected.includes(1)) return null;
    const scores={}, seconds={};
    for (const no of selected) {
      const score=Number(attempt?.scores?.[no] ?? attempt?.scores?.[String(no)]);
      const sec=Number(attempt.questionSeconds?.[no] ?? attempt.questionSeconds?.[String(no)]);
      if (Number.isFinite(score)) scores[no]=clamp(score,0,20);
      if (Number.isFinite(sec)) seconds[no]=clamp(Math.round(sec),0,TOTAL_MINUTES*60);
    }
    if (!Object.keys(seconds).length) return null;
    return { at:attempt.at, selected, scores, seconds, total:Number(attempt.total)||0, timedOut:Boolean(attempt.timedOut) };
  }
  function buildStats(attempts) {
    const buckets={};
    for (let no=1;no<=11;no+=1) buckets[no]=[];
    for (const attempt of attempts) {
      for (const no of attempt.selected) {
        const score=attempt.scores[no], seconds=attempt.seconds[no];
        if (!Number.isFinite(score) || !Number.isFinite(seconds) || seconds<=0) continue;
        buckets[no].push({score,seconds,at:attempt.at});
      }
    }
    const stats={};
    for (let no=1;no<=11;no+=1) {
      const rows=buckets[no];
      if (!rows.length) { stats[no]=null; continue; }
      const avgScore=rows.reduce((sum,row)=>sum+row.score,0)/rows.length;
      const avgSeconds=rows.reduce((sum,row)=>sum+row.seconds,0)/rows.length;
      const avgMinutes=avgSeconds/60;
      const pointsPerMinute=avgScore/Math.max(avgMinutes,0.5);
      const timePerPoint=avgMinutes/Math.max(avgScore,1);
      const reliability=Math.min(1,rows.length/3);
      const priority=avgScore*0.78 + pointsPerMinute*3.2 + reliability*1.5 - Math.max(0,avgMinutes-28)*0.18;
      stats[no]={count:rows.length,avgScore,avgSeconds,avgMinutes,pointsPerMinute,timePerPoint,priority,latest:rows[rows.length-1]};
    }
    return stats;
  }
  function recommendedOptionals(stats, latest) {
    const measured=[];
    for (let no=2;no<=11;no+=1) if (stats[no]) measured.push({no,...stats[no]});
    measured.sort((a,b)=>b.priority-a.priority || b.avgScore-a.avgScore || a.avgMinutes-b.avgMinutes || a.no-b.no);
    const result=measured.map((row)=>row.no).slice(0,4);
    for (const no of (latest?.selected||[]).filter((no)=>no!==1)) if (!result.includes(no)&&result.length<4) result.push(no);
    for (let no=2;no<=11&&result.length<4;no+=1) if (!result.includes(no)) result.push(no);
    return result.slice(0,4);
  }
  function allocationFor(selected,stats,latest) {
    const raws=selected.map((no)=>{
      const latestMin=Number(latest?.seconds?.[no]||0)/60;
      const avgMin=stats[no]?.avgMinutes;
      return {no,weight:clamp(Number.isFinite(avgMin)?avgMin:(latestMin>0?latestMin:28),15,45)};
    });
    const sum=raws.reduce((s,row)=>s+row.weight,0)||1;
    const provisional=raws.map((row)=>({no:row.no,raw:row.weight/sum*QUESTION_POOL_MINUTES}));
    const result=provisional.map((row)=>({no:row.no,minutes:Math.floor(row.raw),fraction:row.raw-Math.floor(row.raw)}));
    let remaining=QUESTION_POOL_MINUTES-result.reduce((s,row)=>s+row.minutes,0);
    result.slice().sort((a,b)=>b.fraction-a.fraction||a.no-b.no).forEach((row)=>{ if (remaining>0) { const target=result.find((x)=>x.no===row.no); target.minutes+=1; remaining-=1; } });
    return result;
  }
  function statusLabel(stat) {
    if (!stat) return t('미측정','未測定');
    if (stat.avgMinutes>=35 && stat.avgScore<14) return t('느리고 점수 낮음','遅く得点も低い');
    if (stat.avgMinutes>=35) return t('시간 초과 위험','時間超過リスク');
    if (stat.avgScore<12) return t('정확도 보강','正確性を補強');
    if (stat.avgScore>=16 && stat.avgMinutes<=28) return t('시간 효율 좋음','時間効率良好');
    return t('유지·관찰','維持・観察');
  }
  function locate() {
    let el=document.getElementById('ap-b-time-allocation');
    if (el) return el;
    const goal=document.getElementById('ap-b-score-goal');
    const history=document.getElementById('ap-b-learning-history');
    const progress=document.getElementById('ap-b-progress-trends');
    const anchor=goal||history||progress;
    if (!anchor?.parentElement) return null;
    el=document.createElement('section');
    el.id='ap-b-time-allocation';
    el.className='ap-mock-section';
    anchor.parentElement.insertBefore(el,anchor.nextSibling);
    return el;
  }
  function render() {
    const existing=document.getElementById('ap-b-time-allocation');
    if (subjectFromUrl()!=='B') { if (existing) existing.hidden=true; return; }
    const el=locate();
    if (!el) return;
    el.hidden=false;
    const timed=readAttempts().map(normalizeTimedAttempt).filter(Boolean);
    if (!timed.length) {
      el.innerHTML=`<div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">SUBJECT B TIME ALLOCATION</p><h2>${esc(t('科目B 문항별 시간배분 분석','科目B 問題別時間配分分析'))}</h2></div><p>${esc(t('측정 데이터 없음','計測データなし'))}</p></div><section class="ap-mock-card"><p class="ap-past-guide">${esc(t('문항별 시간 분석은 150분 실전 시뮬레이션에서 각 문제를 실제로 보고 입력한 시간을 자동 측정한 뒤 생성됩니다.','問題別時間分析は、150分実戦シミュレーションで各問題を実際に見て入力していた時間を自動計測した後に生成されます。'))}</p><div class="ap-past-actions"><a class="ap-mock-button" href="/${lang}/study/ap/reinforcement/simulation/">${esc(t('150분 실전으로 시간 측정 시작','150分実戦で時間計測を開始'))}</a></div></section>`;
      return;
    }
    const stats=buildStats(timed);
    const latest=timed[timed.length-1];
    const recommended=recommendedOptionals(stats,latest);
    const selected=[1,...recommended].sort((a,b)=>a-b);
    const budgets=allocationFor(selected,stats,latest);
    const rankedSelected=selected.map((no)=>({no,stat:stats[no]})).sort((a,b)=>(b.stat?.priority??-999)-(a.stat?.priority??-999)||a.no-b.no);
    const orderMap=new Map(rankedSelected.map((row,index)=>[row.no,index]));
    const measured=[];
    for (let no=1;no<=11;no+=1) if (stats[no]) measured.push({no,...stats[no]});
    measured.sort((a,b)=>a.no-b.no);
    const slowest=measured.slice().sort((a,b)=>b.timePerPoint-a.timePerPoint||b.avgMinutes-a.avgMinutes).slice(0,2);
    const rows=measured.map((row)=>{
      const order=orderMap.get(row.no);
      const orderText=order==null?t('예비·교체 후보','予備・交代候補'):order<2?t('먼저 풀기','先に解く'):order<4?t('중간','中盤'):t('뒤로 미루기','後回し');
      return `<tr><td><strong>Q${row.no} ${esc(fieldName(row.no))}</strong></td><td>${row.avgScore.toFixed(1)}/20</td><td>${(row.avgSeconds/60).toFixed(1)}${esc(t('분','分'))}</td><td>${row.pointsPerMinute.toFixed(2)}</td><td>${row.count}</td><td>${esc(statusLabel(row))}</td><td>${esc(orderText)}</td></tr>`;
    }).join('');
    const budgetRows=budgets.map((row)=>`<tr><td><strong>Q${row.no} ${esc(fieldName(row.no))}</strong></td><td>${stats[row.no]?`${stats[row.no].avgMinutes.toFixed(1)}${esc(t('분','分'))}`:esc(t('미측정','未測定'))}</td><td><strong>${row.minutes}${esc(t('분','分'))}</strong></td></tr>`).join('');
    const optionals=selected.filter((no)=>no!==1);
    const focusLink=`/${lang}/study/ap/reinforcement/simulation/?focus=${encodeURIComponent(optionals.join(','))}`;
    const slowText=slowest.map((row)=>`Q${row.no} ${fieldName(row.no)} (${row.avgScore.toFixed(1)}/20 · ${row.avgMinutes.toFixed(1)}${t('분','分')})`).join(' · ');
    const first=rankedSelected.slice(0,2).map((row)=>`Q${row.no} ${fieldName(row.no)}`).join(' → ');
    const last=rankedSelected[rankedSelected.length-1];
    el.innerHTML=`<div class="ap-mock-section-head"><div><p class="ap-mock-section-kicker">SUBJECT B TIME ALLOCATION</p><h2>${esc(t('科目B 문항별 시간배분 분석','科目B 問題別時間配分分析'))}</h2></div><p>${esc(t(`시간측정 실전 ${timed.length}회`,`時間計測実戦 ${timed.length}回`))}</p></div><section class="ap-mock-card"><p class="ap-past-guide"><strong>${esc(t('점수 대비 시간이 가장 긴 분야','得点に対して時間が長い分野'))}:</strong> ${esc(slowText||'-')}</p><p class="ap-mock-note"><strong>${esc(t('현재 추천 풀이순서','現在の推薦解答順'))}:</strong> ${esc(first)} · … · <strong>${esc(t('후순위','後回し'))}:</strong> ${last?esc(`Q${last.no} ${fieldName(last.no)}`):'-'}</p><p class="ap-mock-note">${esc(t('점수 수준을 가장 크게 보고, 점수당 소요시간과 반복 측정 횟수를 함께 반영한 학습용 추천입니다. 실제 시험에서는 문제를 읽은 뒤 당일 체감 난이도에 따라 순서를 바꿔도 됩니다.','得点水準を最も重く見つつ、得点当たりの所要時間と測定回数も反映した学習用推薦です。本番では問題を読んだ後、その日の体感難易度に応じて順序を変えて構いません。'))}</p><div class="ap-mock-table-wrap"><table class="ap-mock-table"><thead><tr><th>${esc(t('분야','分野'))}</th><th>${esc(t('평균 점수','平均得点'))}</th><th>${esc(t('평균 시간','平均時間'))}</th><th>${esc(t('점/분','点/分'))}</th><th>${esc(t('측정','計測'))}</th><th>${esc(t('판정','判定'))}</th><th>${esc(t('풀이순서','解答順'))}</th></tr></thead><tbody>${rows}</tbody></table></div><h3>${esc(t('150분 권장 시간배분','150分 推奨時間配分'))}</h3><p class="ap-mock-note">${esc(t(`선택 5문제에 ${QUESTION_POOL_MINUTES}분을 배분하고 마지막 ${REVIEW_MINUTES}분은 검토·미작성 확인용으로 남깁니다. 최근 측정시간 비율을 기준으로 자동 조정합니다.`,`選択5問に${QUESTION_POOL_MINUTES}分を配分し、最後の${REVIEW_MINUTES}分は見直し・未記入確認用に残します。直近の計測時間比率を基準に自動調整します。`))}</p><div class="ap-mock-table-wrap"><table class="ap-mock-table"><thead><tr><th>${esc(t('분야','分野'))}</th><th>${esc(t('실측 평균','実測平均'))}</th><th>${esc(t('권장 한도','推奨上限'))}</th></tr></thead><tbody>${budgetRows}<tr><td><strong>${esc(t('최종 검토','最終見直し'))}</strong></td><td>-</td><td><strong>${REVIEW_MINUTES}${esc(t('분','分'))}</strong></td></tr></tbody></table></div><div class="ap-past-actions"><a class="ap-mock-button" href="${esc(focusLink)}">${esc(t('시간효율 추천 4개로 150분 실전','時間効率推薦4分野で150分実戦'))}</a></div></section>`;
  }

  window.addEventListener('popstate',render);
  window.addEventListener('storage',(event)=>{ if (event.key===PERFORMANCE_KEY) render(); });
  window.addEventListener(CHANGE_EVENT,render);
  document.addEventListener('click',(event)=>{ if (event.target.closest?.('[data-ap-mock-subject]')) setTimeout(render,0); });
  const observer=new MutationObserver(()=>{ if (subjectFromUrl()==='B' && !document.getElementById('ap-b-time-allocation')) render(); });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  render();
})();
