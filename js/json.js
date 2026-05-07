'use strict';
// ══════════════════════════════════════════════════════
//  JSON PRETTY
// ══════════════════════════════════════════════════════
(function() {
  const ed = $('jsonEditor');
  const status = $('jsonStatus');

  ed.addEventListener('input', () => save('json', ed.value));

  // Tab key inserts spaces instead of focus-jump
  ed.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ed.selectionStart, end = ed.selectionEnd;
      ed.value = ed.value.slice(0,s) + '  ' + ed.value.slice(end);
      ed.selectionStart = ed.selectionEnd = s + 2;
    }
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); $('formatJson').click(); }
  });

  function sortKeys(obj) {
    if (Array.isArray(obj)) return obj.map(sortKeys);
    if (obj !== null && typeof obj === 'object') {
      return Object.keys(obj).sort().reduce((acc, k) => { acc[k] = sortKeys(obj[k]); return acc; }, {});
    }
    return obj;
  }

  function setStatus(ok, msg) {
    status.textContent = msg;
    status.style.display = 'block';
    status.style.background = ok ? 'rgba(34,197,94,.15)' : 'rgba(244,63,94,.15)';
    status.style.color = ok ? '#22c55e' : '#f43f5e';
  }

  $('formatJson').onclick = () => {
    try {
      const out = JSON.stringify(JSON.parse(ed.value), null, 2);
      ed.value = out; save('json', out);
      setStatus(true, '✓ Válido');
    } catch(e) {
      ed.style.boxShadow = 'inset 2px 0 0 #f43f5e';
      setTimeout(() => ed.style.boxShadow = '', 700);
      setStatus(false, '✗ ' + e.message.split('\n')[0].slice(0,30));
      toast('✗ JSON inválido', 'err');
    }
  };

  $('minifyJson').onclick = () => {
    try { const out = JSON.stringify(JSON.parse(ed.value)); ed.value = out; save('json', out); setStatus(true,'✓ Minificado'); }
    catch { toast('✗ JSON inválido', 'err'); }
  };

  $('sortJson').onclick = () => {
    try { const out = JSON.stringify(sortKeys(JSON.parse(ed.value)), null, 2); ed.value = out; save('json', out); setStatus(true,'✓ Ordenado'); }
    catch { toast('✗ JSON inválido', 'err'); }
  };

  $('copyJson').onclick = () => copy(ed.value);
  $('clearJson').onclick = () => { ed.value = ''; save('json',''); status.style.display='none'; };
})();
