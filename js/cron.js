'use strict';
// ══════════════════════════════════════════════════════
//  CRON / QUARTZ
// ══════════════════════════════════════════════════════
(function() {
  const fields = ['cronSec','cronMin','cronHour','cronDay','cronMonth','cronDayOfWeek'];

  function getExpr() {
    return fields.map(id => $(id).value.trim()||'*').join(' ');
  }

  function setFields(expr) {
    const parts = expr.trim().split(/\s+/);
    if (parts.length >= 6) {
      fields.forEach((id,i) => $(id).value = parts[i]);
    }
  }

  function expandField(f, lo, hi) {
    if (f==='*'||f==='?') return Array.from({length:hi-lo+1},(_,i)=>lo+i);
    const vals = new Set();
    f.split(',').forEach(p => {
      if (p.includes('/')) {
        const [rng, step] = p.split('/');
        const [a,b] = rng==='*' ? [lo,hi] : rng.includes('-') ? rng.split('-').map(Number) : [+rng,hi];
        for (let i=a;i<=b;i+=+step) if(i>=lo&&i<=hi) vals.add(i);
      } else if (p.includes('-')) {
        const [a,b]=p.split('-').map(Number);
        for(let i=a;i<=b;i++) vals.add(i);
      } else if (!isNaN(+p)) vals.add(+p);
    });
    return [...vals].sort((a,b)=>a-b);
  }

  function nextExecutions(expr, count=8) {
    try {
      const parts = expr.trim().split(/\s+/);
      if (parts.length < 6) return [];
      const [sec,min,hour,day,month,dow] = parts;
      const secV   = expandField(sec,0,59);
      const minV   = expandField(min,0,59);
      const hourV  = expandField(hour,0,23);
      const dayV   = day==='?'  ? null : expandField(day,1,31);
      const monV   = expandField(month,1,12);
      const dowV   = dow==='?'  ? null : expandField(dow,0,6);
      const results=[], cur=new Date(); cur.setMilliseconds(0); cur.setSeconds(cur.getSeconds()+1);
      while (results.length<count && cur.getFullYear()<2100) {
        if (!monV.includes(cur.getMonth()+1)) { cur.setMonth(cur.getMonth()+1); cur.setDate(1); cur.setHours(0,0,0); continue; }
        const dOk = !dayV || dayV.includes(cur.getDate());
        const wOk = !dowV || dowV.includes(cur.getDay());
        if (!dOk&&!wOk) { cur.setDate(cur.getDate()+1); cur.setHours(0,0,0,0); continue; }
        if (!hourV.includes(cur.getHours())) { cur.setHours(cur.getHours()+1); cur.setMinutes(0,0,0); continue; }
        if (!minV.includes(cur.getMinutes())) { cur.setMinutes(cur.getMinutes()+1); cur.setSeconds(0,0); continue; }
        if (!secV.includes(cur.getSeconds())) { cur.setSeconds(cur.getSeconds()+1); continue; }
        results.push(new Date(cur)); cur.setSeconds(cur.getSeconds()+1);
      }
      return results;
    } catch { return []; }
  }

  function describeExpr(expr) {
    const [s,m,h,d,mo,dow] = expr.trim().split(/\s+/);
    if (s==='0'&&m==='*'&&h==='*') return 'A cada minuto';
    if (s==='0'&&m==='0'&&h==='*'&&(dow==='?'||dow==='*')) return 'A cada hora (no minuto 00)';
    if (s==='0'&&m==='0'&&h==='0'&&(dow==='?'||dow==='*')) return 'Todo dia à meia-noite (00:00)';
    if (s==='0'&&m==='0'&&h==='12') return 'Todo dia ao meio-dia (12:00)';
    if (s==='0'&&m==='0'&&h==='9'&&(dow==='1-5'||dow==='MON-FRI')) return 'Seg–Sex às 09:00';
    if (s==='0'&&m==='0'&&h==='9'&&dow==='1') return 'Toda segunda-feira às 09:00';
    return 'Expressão personalizada';
  }

  function updatePreview() {
    const expr = getExpr();
    $('cronExpression').textContent = expr;
    const execs = nextExecutions(expr);
    const desc  = describeExpr(expr);
    $('cronPreview').textContent = desc + '\n\nPróximas execuções:\n' +
      (execs.length ? execs.map(d=>`• ${d.toLocaleString('pt-BR')}`).join('\n') : 'Nenhuma encontrada');
    save('cronExpr', expr);
  }

  fields.forEach(id => $(id).addEventListener('input', updatePreview));

  const PRESETS = {
    cronEveryMin:      ['0','*','*','*','*','?'],
    cronEveryHour:     ['0','0','*','*','*','?'],
    cronEveryday:      ['0','0','0','*','*','?'],
    cronAtNoon:        ['0','0','12','*','*','?'],
    cronEveryWeekday:  ['0','0','9','*','*','1-5'],
    cronEveryMonday:   ['0','0','9','*','*','1'],
  };
  Object.entries(PRESETS).forEach(([id, vals]) => {
    $(id).onclick = () => { fields.forEach((f,i) => $(f).value=vals[i]); updatePreview(); };
  });

  function loadCronExpr(expr) {
    setFields(expr); $('cronExprInput').value=expr; updatePreview();
  }
  window.loadCronExpr = loadCronExpr;

  $('cronExprInput').addEventListener('input', debounce(() => {
    const expr = $('cronExprInput').value.trim();
    if (!expr) return;
    setFields(expr); updatePreview();
  }, 300));

  $('cronCopy').onclick = () => copy($('cronExpression').textContent);
  $('cronClear').onclick = () => {
    fields.forEach((id,i) => $(id).value = ['0','0','*','*','*','?'][i]);
    $('cronExprInput').value=''; updatePreview();
  };

  updatePreview();
})();
