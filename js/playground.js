'use strict';
// ══════════════════════════════════════════════════════
//  JS PLAYGROUND (sandbox iframe)
// ══════════════════════════════════════════════════════
(function() {
  const sandbox = $('jsSandbox');
  const codeEl  = $('playgroundCode');
  const outWrap = $('pgOutput');
  const status  = $('pgRunStatus');
  let pendingResolve = null;
  let wrapEnabled = false;

  window.addEventListener('message', e => {
    if (e.data?.type === 'RESULT' && pendingResolve) {
      pendingResolve(e.data); pendingResolve = null;
    }
  });

  function runInSandbox(code) {
    return new Promise(resolve => {
      pendingResolve = resolve;
      sandbox.contentWindow.postMessage({type:'EXECUTE', code}, '*');
      setTimeout(() => {
        if (pendingResolve) {
          pendingResolve({success:false, logs:[{type:'error', text:'✗ Tempo limite excedido (8s)'}]});
          pendingResolve = null;
        }
      }, 8000);
    });
  }

  const ICONS = { log:'›', info:'ℹ', warn:'⚠', error:'✕', result:'←', stack:' ' };

  function renderOutput(result) {
    if (!result.logs.length && result.success) {
      outWrap.innerHTML = '<div class="pg-out-line pg-log"><span class="pg-icon" style="color:var(--add)">✓</span><span class="pg-text" style="color:var(--add)">Executado com sucesso (sem saída)</span></div>';
      return;
    }
    outWrap.innerHTML = result.logs.map(l => {
      const cls = 'pg-' + (l.type||'log');
      const icon = ICONS[l.type] || '›';
      return `<div class="pg-out-line ${cls}"><span class="pg-icon">${esc(icon)}</span><span class="pg-text">${esc(l.text)}</span></div>`;
    }).join('');
    outWrap.scrollTop = outWrap.scrollHeight;
  }

  async function run() {
    const code = codeEl.value;
    save('playgroundCode', code);
    if (!code.trim()) { outWrap.innerHTML='<div class="pg-empty">Sem código para executar.</div>'; return; }
    status.textContent = '⏳ Executando…';
    outWrap.innerHTML = '<div class="pg-empty" style="color:var(--muted)">⏳ Executando…</div>';
    const t0 = Date.now();
    const result = await runInSandbox(code);
    const elapsed = Date.now() - t0;
    status.textContent = result.success ? `✓ ${elapsed}ms` : `✗ ${elapsed}ms`;
    status.style.color = result.success ? 'var(--add)' : 'var(--del)';
    renderOutput(result);
  }

  $('playgroundRun').onclick = run;

  // Tab key inserts 2 spaces in editor
  codeEl.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s=codeEl.selectionStart, end=codeEl.selectionEnd;
      codeEl.value = codeEl.value.slice(0,s) + '  ' + codeEl.value.slice(end);
      codeEl.selectionStart = codeEl.selectionEnd = s+2;
    }
    if (e.ctrlKey && e.key==='Enter') { e.preventDefault(); run(); }
  });

  $('playgroundCopy').onclick = () => {
    const lines = outWrap.querySelectorAll('.pg-text');
    copy(Array.from(lines).map(l=>l.textContent).join('\n'));
  };

  $('playgroundWrap').onclick = () => {
    wrapEnabled = !wrapEnabled;
    $('playgroundWrap').classList.toggle('primary', wrapEnabled);
    outWrap.querySelectorAll('.pg-text').forEach(el => el.style.whiteSpace = wrapEnabled?'pre-wrap':'pre');
  };

  $('playgroundClear').onclick = () => {
    codeEl.value = ''; save('playgroundCode','');
    outWrap.innerHTML = '<div class="pg-empty">Resultado aparece aqui…</div>';
    status.textContent = '';
  };
})();
