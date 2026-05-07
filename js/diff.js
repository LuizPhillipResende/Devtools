'use strict';
// ══════════════════════════════════════════════════════
//  DIFF
// ══════════════════════════════════════════════════════
function computeDiff(a, b) {
  const aL = a ? a.split('\n') : [];
  const bL = b ? b.split('\n') : [];
  const m = aL.length, n = bL.length;
  const dp = Array.from({length: m+1}, () => new Int32Array(n+1));
  for (let i=1;i<=m;i++)
    for (let j=1;j<=n;j++)
      dp[i][j] = aL[i-1]===bL[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j],dp[i][j-1]);
  const ops=[]; let i=m, j=n;
  while (i>0||j>0) {
    if (i>0&&j>0&&aL[i-1]===bL[j-1]) { ops.unshift({t:'ctx',v:aL[i-1]}); i--;j--; }
    else if (j>0&&(i===0||dp[i][j-1]>=dp[i-1][j])) { ops.unshift({t:'add',v:bL[j-1]}); j--; }
    else { ops.unshift({t:'del',v:aL[i-1]}); i--; }
  }
  return ops;
}

function renderDiff() {
  const a = $('diffA').value, b = $('diffB').value;
  save('diffA', a); save('diffB', b);
  const ops = computeDiff(a, b);
  let adds=0, dels=0, ln=0;
  const rows = ops.map(op => {
    ln++;
    if (op.t==='add') adds++;
    if (op.t==='del') dels++;
    const cls = op.t==='add'?'r-add':op.t==='del'?'r-del':'r-ctx';
    const pfx = op.t==='add'?'+ ':op.t==='del'?'- ':'  ';
    return `<tr class="${cls}"><td class="ln">${ln}</td><td>${esc(pfx+op.v)}</td></tr>`;
  });
  $('diffTbody').innerHTML = rows.length
    ? rows.join('')
    : '<tr class="r-ctx"><td class="ln"></td><td>Sem diferenças.</td></tr>';
  $('diffStats').textContent = ops.length ? ` +${adds} -${dels}` : '';
}
const renderDiffD = debounce(renderDiff, 120);
$('diffA').addEventListener('input', renderDiffD);
$('diffB').addEventListener('input', renderDiffD);

$('copyDiff').onclick = () => {
  const rows = $('diffTbody').querySelectorAll('tr');
  copy(Array.from(rows).map(r => r.querySelectorAll('td')[1]?.textContent||'').join('\n'));
};
$('swapDiff').onclick = () => {
  const tmp = $('diffA').value;
  $('diffA').value = $('diffB').value;
  $('diffB').value = tmp;
  renderDiff();
};
$('clearDiff').onclick = () => {
  $('diffA').value=''; $('diffB').value='';
  $('diffTbody').innerHTML='<tr class="r-ctx"><td class="ln"></td><td>Edite os painéis para ver o diff…</td></tr>';
  $('diffStats').textContent='';
  save('diffA',''); save('diffB','');
};
