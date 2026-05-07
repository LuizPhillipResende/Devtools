'use strict';
// ══════════════════════════════════════════════════════
//  TIMESTAMP
// ══════════════════════════════════════════════════════
(function() {
  function relTime(ms) {
    const diff=Date.now()-ms, abs=Math.abs(diff), fut=diff<0;
    const s=Math.floor(abs/1000), m=Math.floor(s/60), h=Math.floor(m/60), d=Math.floor(h/24);
    const str = s<60?`${s}s`:m<60?`${m}min`:h<24?`${h}h`:`${d}d`;
    return fut ? `daqui ${str}` : `há ${str}`;
  }

  let lastTs = null;

  function showTS(unix) {
    lastTs = unix;
    const ms=unix*1000, d=new Date(ms);
    $('tsLocal').textContent    = d.toLocaleString('pt-BR');
    $('tsUTC').textContent      = d.toUTCString();
    $('tsISO').textContent      = d.toISOString();
    $('tsRelative').textContent = relTime(ms);
    $('tsGrid').style.display   = 'grid';
  }

  $('tsConvert').onclick = () => {
    const v = $('tsUnix').value.trim();
    if (!v || isNaN(+v)) { toast('✗ Timestamp inválido','err'); return; }
    save('tsUnix', v); showTS(+v);
  };

  $('tsNow').onclick = () => {
    const now = Math.floor(Date.now()/1000);
    $('tsUnix').value = now;
    save('tsUnix', String(now)); showTS(now);
  };

  $('tsDateConvert').onclick = () => {
    const v = $('tsDate').value;
    if (!v) return;
    const ts = Math.floor(new Date(v).getTime()/1000);
    $('tsDateVal').textContent = ts;
    $('tsDateCard').style.display = 'block';
    lastTs = ts;
  };

  $('tsUnix').addEventListener('keydown', e => { if(e.key==='Enter') $('tsConvert').click(); });

  $('tsCopyUnix').onclick = () => {
    const v = lastTs || $('tsUnix').value;
    if (v) copy(String(v));
  };
  $('tsCopyISO').onclick = () => {
    const iso = $('tsISO').textContent;
    if (iso && iso !== '—') copy(iso);
  };
  $('tsClear').onclick = () => {
    $('tsUnix').value=''; $('tsGrid').style.display='none';
    $('tsDateCard').style.display='none'; lastTs=null;
  };
})();
