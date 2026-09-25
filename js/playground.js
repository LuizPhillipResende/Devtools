'use strict';
// ══════════════════════════════════════════════════════
//  VS CODE STYLE JS PLAYGROUND & IDE
// ══════════════════════════════════════════════════════
(function() {
  const codeTextarea  = $('playgroundCode');
  const outWrap       = $('pgOutput');
  const statusEl      = $('pgRunStatus');
  const btnRun        = $('playgroundRun');
  const btnCopyOut    = $('playgroundCopy');
  const btnWrapOut    = $('playgroundWrap');
  const btnClearOut   = $('playgroundClear');

  // File explorer & Tabs
  const fileListEl    = $('pgFileList');
  const tabBarEl      = $('pgTabBar');
  const btnNewFile    = $('pgBtnNewFile');
  const btnOpenFile   = $('pgBtnOpenFile');
  const btnSaveFile   = $('pgBtnSaveFile');

  // Terminal Tabs
  const tabConsole    = $('pgTabConsole');
  const tabInspector  = $('pgTabInspector');
  const tabHistory    = $('pgTabHistory');
  const paneConsole   = $('pgPaneConsole');
  const paneInspector = $('pgPaneInspector');
  const paneHistory   = $('pgPaneHistory');
  const inspectorWrap = $('pgInspectorContent');
  const historyWrap   = $('pgHistoryContent');

  let wrapEnabled = false;
  let codeMirrorEditor = null;
  let executionHistory = [];
  let lastReturnedObject = null;

  // Virtual file system for open tabs
  let openFiles = [
    {
      id: 'main_js',
      name: 'main.js',
      path: null,
      content: '// DevTools CORP — JavaScript Playground\n\nconsole.log("Olá, mundo! Executando em ambiente desktop.");\n\nconst dados = {\n  versao: "6.0",\n  plataforma: "Desktop",\n  recursos: ["QR Code", "Automatos ERD", "VS Code Playground", "Diff Check"]\n};\n\nconsole.info("Informações do sistema:", dados);\n\n// Retorno de expressão avaliada\ndados.recursos.map(r => r.toUpperCase());\n',
      isDirty: false
    }
  ];
  let activeFileId = 'main_js';

  function getActiveFile() {
    return openFiles.find(f => f.id === activeFileId) || openFiles[0];
  }

  // ── CodeMirror Editor Initialization ──────────────────────────────────────
  function initCodeMirror() {
    if (!codeTextarea) return;
    if (window.CodeMirror) {
      try {
        codeMirrorEditor = CodeMirror.fromTextArea(codeTextarea, {
          lineNumbers: true,
          mode: 'javascript',
          theme: 'default',
          autoCloseBrackets: true,
          matchBrackets: true,
          indentUnit: 2,
          tabSize: 2,
          lineWrapping: false,
          extraKeys: {
            'Ctrl-Enter': () => runCode(),
            'Cmd-Enter': () => runCode(),
            'F5': () => runCode(),
            'Ctrl-S': () => saveCurrentFile(),
            'Cmd-S': () => saveCurrentFile()
          }
        });

        codeMirrorEditor.on('change', () => {
          const file = getActiveFile();
          if (file) {
            file.content = codeMirrorEditor.getValue();
            file.isDirty = true;
            renderTabs();
            savePlaygroundState();
          }
        });

        // Set initial content
        const file = getActiveFile();
        if (file) codeMirrorEditor.setValue(file.content);
        return;
      } catch (e) {
        console.warn('CodeMirror init failed, falling back to textarea:', e);
      }
    }

    // Textarea fallback
    codeTextarea.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = codeTextarea.selectionStart, end = codeTextarea.selectionEnd;
        codeTextarea.value = codeTextarea.value.slice(0, s) + '  ' + codeTextarea.value.slice(end);
        codeTextarea.selectionStart = codeTextarea.selectionEnd = s + 2;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runCode();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveCurrentFile();
      }
    });

    codeTextarea.addEventListener('input', () => {
      const file = getActiveFile();
      if (file) {
        file.content = codeTextarea.value;
        file.isDirty = true;
        renderTabs();
        savePlaygroundState();
      }
    });
  }

  function getEditorContent() {
    if (codeMirrorEditor) return codeMirrorEditor.getValue();
    return codeTextarea ? codeTextarea.value : '';
  }

  function setEditorContent(text) {
    if (codeMirrorEditor) {
      codeMirrorEditor.setValue(text);
    } else if (codeTextarea) {
      codeTextarea.value = text;
    }
  }

  // ── File Management (Open from PC, Save to PC, Tabs) ───────────────────────
  function renderFilesAndTabs() {
    renderFileList();
    renderTabs();
  }

  function renderFileList() {
    if (!fileListEl) return;
    fileListEl.innerHTML = openFiles.map(file => {
      const isActive = file.id === activeFileId;
      const isJson = file.name.endsWith('.json');
      const icon = isJson ? '🟦' : '🟨';
      return `
        <div class="pg-file-item ${isActive ? 'active' : ''}" data-id="${file.id}">
          <span class="pg-file-icon">${icon}</span>
          <span class="pg-file-name" title="${file.path || file.name}">${esc(file.name)}</span>
          ${file.isDirty ? '<span class="pg-file-dirty">●</span>' : ''}
          ${openFiles.length > 1 ? `<span class="pg-file-close" data-id="${file.id}" title="Fechar arquivo">×</span>` : ''}
        </div>
      `;
    }).join('');

    fileListEl.querySelectorAll('.pg-file-item').forEach(item => {
      item.onclick = ev => {
        if (ev.target.classList.contains('pg-file-close')) return;
        switchFile(item.dataset.id);
      };
    });

    fileListEl.querySelectorAll('.pg-file-close').forEach(btn => {
      btn.onclick = ev => {
        ev.stopPropagation();
        closeFile(btn.dataset.id);
      };
    });
  }

  function renderTabs() {
    if (!tabBarEl) return;
    tabBarEl.innerHTML = openFiles.map(file => {
      const isActive = file.id === activeFileId;
      const isJson = file.name.endsWith('.json');
      const icon = isJson ? '🟦' : '🟨';
      return `
        <div class="pg-tab-item ${isActive ? 'active' : ''}" data-id="${file.id}">
          <span class="pg-tab-icon">${icon}</span>
          <span class="pg-tab-name">${esc(file.name)}</span>
          ${file.isDirty ? '<span class="pg-tab-dirty">●</span>' : ''}
          ${openFiles.length > 1 ? `<span class="pg-tab-close" data-id="${file.id}" title="Fechar">×</span>` : ''}
        </div>
      `;
    }).join('');

    tabBarEl.querySelectorAll('.pg-tab-item').forEach(tab => {
      tab.onclick = ev => {
        if (ev.target.classList.contains('pg-tab-close')) return;
        switchFile(tab.dataset.id);
      };
    });

    tabBarEl.querySelectorAll('.pg-tab-close').forEach(btn => {
      btn.onclick = ev => {
        ev.stopPropagation();
        closeFile(btn.dataset.id);
      };
    });
  }

  function switchFile(fileId) {
    if (activeFileId === fileId) return;
    activeFileId = fileId;
    const file = getActiveFile();
    if (file) {
      setEditorContent(file.content);
      if (codeMirrorEditor) {
        const mode = file.name.endsWith('.json') ? 'application/json' : 'javascript';
        codeMirrorEditor.setOption('mode', mode);
      }
    }
    renderFilesAndTabs();
  }

  function createNewFile() {
    const num = openFiles.length + 1;
    const newFile = {
      id: 'file_' + Date.now(),
      name: `script${num}.js`,
      path: null,
      content: '// Novo script\nconsole.log("Arquivo iniciado");\n',
      isDirty: false
    };
    openFiles.push(newFile);
    activeFileId = newFile.id;
    setEditorContent(newFile.content);
    renderFilesAndTabs();
    toast('✓ Novo arquivo criado', 'ok');
  }

  function closeFile(fileId) {
    const file = openFiles.find(f => f.id === fileId);
    if (file && file.isDirty && !confirm(`Fechar "${file.name}" sem salvar alterações?`)) {
      return;
    }
    openFiles = openFiles.filter(f => f.id !== fileId);
    if (!openFiles.length) {
      createNewFile();
      return;
    }
    if (activeFileId === fileId) {
      activeFileId = openFiles[0].id;
      setEditorContent(getActiveFile().content);
    }
    renderFilesAndTabs();
  }

  async function openFileFromComputer() {
    const res = await chooseFileFromComputer({
      title: 'Abrir Arquivo no Playground',
      filters: [
        { name: 'JavaScript & JSON', extensions: ['js', 'json', 'ts', 'jsx', 'tsx', 'mjs', 'cjs'] },
        { name: 'Todos os Arquivos', extensions: ['*'] }
      ]
    });
    if (res?.content !== undefined) {
      // Check if already open
      let existing = openFiles.find(f => f.path === res.filePath || f.name === res.fileName);
      if (existing) {
        existing.content = res.content;
        existing.isDirty = false;
        activeFileId = existing.id;
      } else {
        const newFile = {
          id: 'file_' + Date.now(),
          name: res.fileName,
          path: res.filePath,
          content: res.content,
          isDirty: false
        };
        openFiles.push(newFile);
        activeFileId = newFile.id;
      }
      setEditorContent(res.content);
      renderFilesAndTabs();
      toast('✓ Arquivo carregado: ' + res.fileName, 'ok');
    }
  }

  async function saveCurrentFile() {
    const file = getActiveFile();
    if (!file) return;
    const content = getEditorContent();
    const res = await saveFileToComputer({
      title: 'Salvar Arquivo',
      defaultPath: file.name,
      filters: [
        { name: 'JavaScript', extensions: ['js'] },
        { name: 'JSON', extensions: ['json'] },
        { name: 'Todos os Arquivos', extensions: ['*'] }
      ],
      content
    });
    if (res?.fileName) {
      file.name = res.fileName;
      file.path = res.filePath || file.path;
      file.isDirty = false;
      renderFilesAndTabs();
    }
  }

  if (btnNewFile) btnNewFile.onclick = createNewFile;
  if (btnOpenFile) btnOpenFile.onclick = openFileFromComputer;
  if (btnSaveFile) btnSaveFile.onclick = saveCurrentFile;

  // ── Code Execution Engine ─────────────────────────────────────────────────
  const ICONS = { log: '›', info: 'ℹ', warn: '⚠', error: '✕', result: '←', table: '▦' };

  function fmtArg(arg) {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg === 'string') return arg;
    if (typeof arg === 'object') {
      try { return JSON.stringify(arg, null, 2); } catch { return String(arg); }
    }
    return String(arg);
  }

  async function executeCodeAsync(code) {
    const logs = [];
    let lastResult = undefined;

    const originalLog   = console.log;
    const originalInfo  = console.info;
    const originalWarn  = console.warn;
    const originalError = console.error;
    const originalTable = console.table;

    console.log   = (...a) => logs.push({ type: 'log',   text: a.map(fmtArg).join(' '), raw: a });
    console.info  = (...a) => logs.push({ type: 'info',  text: 'ℹ ' + a.map(fmtArg).join(' '), raw: a });
    console.warn  = (...a) => logs.push({ type: 'warn',  text: '⚠ ' + a.map(fmtArg).join(' '), raw: a });
    console.error = (...a) => logs.push({ type: 'error', text: '✕ ' + a.map(fmtArg).join(' '), raw: a });
    console.table = (...a) => logs.push({ type: 'table', text: fmtArg(a[0]), raw: a[0] });

    try {
      // Async Function executes modern ES JavaScript with async/await
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction(code);

      // 8 second execution watchdog
      const executionPromise = fn();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Tempo limite de execução excedido (8s)')), 8000)
      );

      lastResult = await Promise.race([executionPromise, timeoutPromise]);
      if (lastResult !== undefined) {
        lastReturnedObject = lastResult;
        logs.push({ type: 'result', text: '↪ ' + fmtArg(lastResult), raw: lastResult });
      }

      return { success: true, logs, result: lastResult };
    } catch (err) {
      logs.push({ type: 'error', text: '✕ ' + err.message, stack: err.stack });
      return { success: false, logs, error: err.message };
    } finally {
      console.log   = originalLog;
      console.info  = originalInfo;
      console.warn  = originalWarn;
      console.error = originalError;
      console.table = originalTable;
    }
  }

  function renderOutput(res) {
    if (!outWrap) return;
    if (!res.logs.length && res.success) {
      outWrap.innerHTML = '<div class="pg-out-line pg-log"><span class="pg-icon" style="color:var(--add)">✓</span><span class="pg-text" style="color:var(--add)">Executado com sucesso (sem saída no console)</span></div>';
      return;
    }

    outWrap.innerHTML = res.logs.map(l => {
      const cls = 'pg-' + (l.type || 'log');
      const icon = ICONS[l.type] || '›';
      return `
        <div class="pg-out-line ${cls}">
          <span class="pg-icon">${esc(icon)}</span>
          <span class="pg-text" style="${wrapEnabled ? 'white-space:pre-wrap' : 'white-space:pre'}">${esc(l.text)}</span>
        </div>
      `;
    }).join('');

    outWrap.scrollTop = outWrap.scrollHeight;

    // Update Object Inspector if result was object
    if (res.result && typeof res.result === 'object') {
      renderInspector(res.result);
    }
  }

  function renderInspector(obj) {
    if (!inspectorWrap) return;
    try {
      inspectorWrap.textContent = JSON.stringify(obj, null, 2);
    } catch {
      inspectorWrap.textContent = String(obj);
    }
  }

  function addToHistory(code, elapsed, success) {
    executionHistory.unshift({
      code: code.slice(0, 120),
      elapsed,
      success,
      timestamp: new Date().toLocaleTimeString('pt-BR')
    });
    executionHistory = executionHistory.slice(0, 25);
    renderHistory();
  }

  function renderHistory() {
    if (!historyWrap) return;
    if (!executionHistory.length) {
      historyWrap.innerHTML = '<div style="color:var(--muted);font-size:11px;padding:10px">Nenhuma execução registrada.</div>';
      return;
    }
    historyWrap.innerHTML = executionHistory.map((item, idx) => `
      <div class="pg-hist-row" data-idx="${idx}">
        <span class="pg-hist-status ${item.success ? 'ok' : 'err'}">${item.success ? '✓' : '✕'}</span>
        <span class="pg-hist-time">${item.timestamp}</span>
        <span class="pg-hist-dur">${item.elapsed}ms</span>
        <span class="pg-hist-code">${esc(item.code)}</span>
      </div>
    `).join('');
  }

  async function runCode() {
    const code = getEditorContent();
    if (!code.trim()) {
      if (outWrap) outWrap.innerHTML = '<div class="pg-empty">Sem código para executar. Digite seu JavaScript acima.</div>';
      return;
    }

    if (statusEl) {
      statusEl.textContent = '⏳ Executando…';
      statusEl.style.color = 'var(--muted)';
    }

    const t0 = performance.now();
    const res = await executeCodeAsync(code);
    const elapsed = Math.round(performance.now() - t0);

    if (statusEl) {
      statusEl.textContent = res.success ? `✓ ${elapsed}ms` : `✗ Erro (${elapsed}ms)`;
      statusEl.style.color = res.success ? 'var(--add)' : 'var(--del)';
    }

    renderOutput(res);
    addToHistory(code, elapsed, res.success);
  }

  if (btnRun) btnRun.onclick = runCode;

  if (btnCopyOut) {
    btnCopyOut.onclick = () => {
      if (!outWrap) return;
      const lines = outWrap.querySelectorAll('.pg-text');
      copy(Array.from(lines).map(l => l.textContent).join('\n'), '✓ Saída copiada!');
    };
  }

  if (btnWrapOut) {
    btnWrapOut.onclick = () => {
      wrapEnabled = !wrapEnabled;
      btnWrapOut.classList.toggle('primary', wrapEnabled);
      if (outWrap) {
        outWrap.querySelectorAll('.pg-text').forEach(el => el.style.whiteSpace = wrapEnabled ? 'pre-wrap' : 'pre');
      }
    };
  }

  if (btnClearOut) {
    btnClearOut.onclick = () => {
      if (outWrap) outWrap.innerHTML = '<div class="pg-empty">Terminal limpo. Pressione Ctrl+Enter para executar.</div>';
      if (statusEl) statusEl.textContent = '';
    };
  }

  // ── Terminal Sub-Tabs Navigation ──────────────────────────────────────────
  const termTabs = [
    { btn: tabConsole,   pane: paneConsole },
    { btn: tabInspector, pane: paneInspector },
    { btn: tabHistory,   pane: paneHistory }
  ];

  termTabs.forEach(t => {
    if (t.btn) {
      t.btn.onclick = () => {
        termTabs.forEach(ot => {
          if (ot.btn) ot.btn.classList.toggle('active', ot === t);
          if (ot.pane) ot.pane.classList.toggle('hidden', ot !== t);
        });
      };
    }
  });

  // ── Persistence ───────────────────────────────────────────────────────────
  function savePlaygroundState() {
    window.appStorage.set({
      playgroundFiles: JSON.stringify(openFiles),
      playgroundActiveId: activeFileId
    });
  }

  function loadPlaygroundState() {
    window.appStorage.get(['playgroundFiles', 'playgroundActiveId', 'playgroundCode'], r => {
      if (r?.playgroundFiles) {
        try {
          const files = JSON.parse(r.playgroundFiles);
          if (Array.isArray(files) && files.length) {
            openFiles = files;
            activeFileId = r.playgroundActiveId || files[0].id;
          }
        } catch {}
      } else if (r?.playgroundCode) {
        openFiles[0].content = r.playgroundCode;
      }

      renderFilesAndTabs();
      const current = getActiveFile();
      if (current) setEditorContent(current.content);
    });
  }

  initCodeMirror();
  loadPlaygroundState();
})();
