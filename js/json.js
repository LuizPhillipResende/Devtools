'use strict';
// ══════════════════════════════════════════════════════
//  JSON PRETTY — DESKTOP OPTIMIZED
// ══════════════════════════════════════════════════════
(function() {
  const ed = $('jsonEditor');
  const status = $('jsonStatus');
  const btnOpen = $('jsonOpenFile');
  const btnSave = $('jsonSaveFile');

  if (!ed) return;

  ed.addEventListener('input', () => save('json', ed.value));

  // Tab key inserts spaces instead of focus-jump
  ed.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ed.selectionStart, end = ed.selectionEnd;
      ed.value = ed.value.slice(0,s) + '  ' + ed.value.slice(end);
      ed.selectionStart = ed.selectionEnd = s + 2;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); $('formatJson')?.click(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); btnSave?.click(); }
  });

  function sortKeys(obj) {
    if (Array.isArray(obj)) return obj.map(sortKeys);
    if (obj !== null && typeof obj === 'object') {
      return Object.keys(obj).sort().reduce((acc, k) => { acc[k] = sortKeys(obj[k]); return acc; }, {});
    }
    return obj;
  }

  function setStatus(ok, msg) {
    if (!status) return;
    status.textContent = msg;
    status.style.display = 'block';
    status.style.background = ok ? 'rgba(34,197,94,.15)' : 'rgba(244,63,94,.15)';
    status.style.color = ok ? '#22c55e' : '#f43f5e';
  }

  $('formatJson').onclick = () => {
    try {
      const out = JSON.stringify(JSON.parse(ed.value), null, 2);
      ed.value = out; save('json', out);
      setStatus(true, '✓ JSON Válido');
    } catch(e) {
      ed.style.boxShadow = 'inset 2px 0 0 #f43f5e';
      setTimeout(() => ed.style.boxShadow = '', 900);
      setStatus(false, '✗ ' + e.message.split('\n')[0]);
      toast('✗ Erro de sintaxe no JSON', 'del');
    }
  };

  $('minifyJson').onclick = () => {
    try {
      const out = JSON.stringify(JSON.parse(ed.value));
      ed.value = out; save('json', out);
      setStatus(true, '✓ Minificado');
    } catch {
      toast('✗ JSON inválido para minificar', 'del');
    }
  };

  $('sortJson').onclick = () => {
    try {
      const out = JSON.stringify(sortKeys(JSON.parse(ed.value)), null, 2);
      ed.value = out; save('json', out);
      setStatus(true, '✓ Chaves Ordenadas');
    } catch {
      toast('✗ JSON inválido', 'del');
    }
  };

  $('copyJson').onclick = () => copy(ed.value, '✓ JSON copiado');
  $('clearJson').onclick = () => {
    ed.value = ''; save('json', '');
    if (status) status.style.display = 'none';
  };

  // Open JSON from PC
  if (btnOpen) {
    btnOpen.onclick = async () => {
      const file = await chooseFileFromComputer({
        title: 'Abrir Arquivo JSON',
        filters: [{ name: 'JSON', extensions: ['json'] }, { name: 'Todos os Arquivos', extensions: ['*'] }]
      });
      if (file?.content !== undefined) {
        ed.value = file.content;
        save('json', file.content);
        $('formatJson')?.click();
        toast('✓ Arquivo JSON carregado: ' + file.fileName, 'ok');
      }
    };
  }

  // Save JSON to PC
  if (btnSave) {
    btnSave.onclick = async () => {
      await saveFileToComputer({
        title: 'Salvar Arquivo JSON',
        defaultPath: 'dados.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        content: ed.value,
        mimeType: 'application/json;charset=utf-8'
      });
    };
  }

  // Support drag-and-drop JSON file directly onto editor
  ed.addEventListener('dragover', e => { e.preventDefault(); ed.classList.add('drag-over'); });
  ed.addEventListener('dragleave', () => ed.classList.remove('drag-over'));
  ed.addEventListener('drop', e => {
    e.preventDefault();
    ed.classList.remove('drag-over');
    const files = e.dataTransfer?.files;
    if (files?.length) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = ev => {
        ed.value = ev.target.result;
        save('json', ed.value);
        $('formatJson')?.click();
        toast('✓ Arquivo carregado: ' + file.name, 'ok');
      };
      reader.readAsText(file);
    }
  });
})();
