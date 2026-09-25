'use strict';
// ══════════════════════════════════════════════════════
//  VS CODE STYLE DIFF CHECK & CHANGELOG GENERATOR
// ══════════════════════════════════════════════════════
(function() {
  const diffAEl = $('diffA');
  const diffBEl = $('diffB');
  const diffTbody = $('diffTbody');
  const diffStats = $('diffStats');
  const diffMergeWrap = $('diffMergeWrap');

  const btnOpenA = $('diffBtnOpenA');
  const btnOpenB = $('diffBtnOpenB');
  const btnSaveB = $('diffBtnSaveB');
  const btnSwap  = $('swapDiff');
  const btnClear = $('clearDiff');
  const btnCopyDiff = $('copyDiff');
  const btnGenChangeLog = $('diffBtnChangeLog');

  const labelFileA = $('diffLabelA');
  const labelFileB = $('diffLabelB');

  const btnViewSplit   = $('diffViewSplit');
  const btnViewUnified = $('diffViewUnified');

  // ChangeLog Modal
  const modalChangeLog   = $('diffChangeLogModal');
  const clTextarea       = $('diffChangeLogText');
  const btnCopyChangeLog = $('diffBtnCopyCL');
  const btnSaveChangeLog = $('diffBtnSaveCL');
  const btnCloseChangeLog= $('diffBtnCloseCL');

  let fileAName = 'Original (A)';
  let fileBName = 'Modificado (B)';
  let viewMode = 'split'; // 'split' | 'unified'
  let cmMergeView = null;

  // ── CodeMirror MergeView or Classic Gutter Diff ───────────────────────────
  function initMergeView() {
    if (!diffMergeWrap || !window.CodeMirror || !window.diff_match_patch) return false;
    diffMergeWrap.innerHTML = '';
    try {
      cmMergeView = CodeMirror.MergeView(diffMergeWrap, {
        value: diffBEl?.value || '',
        origLeft: null,
        orig: diffAEl?.value || '',
        lineNumbers: true,
        mode: 'javascript',
        highlightDifferences: true,
        connect: 'align',
        collapseIdentical: false,
        revertButtons: true,
        viewportMargin: Infinity
      });

      // Synchronize changes back to hidden textareas for saving
      cmMergeView.editor().on('change', () => {
        if (diffBEl) diffBEl.value = cmMergeView.editor().getValue();
        updateStats();
      });
      cmMergeView.leftOriginal().on('change', () => {
        if (diffAEl) diffAEl.value = cmMergeView.leftOriginal().getValue();
        updateStats();
      });
      return true;
    } catch (e) {
      console.warn('CodeMirror MergeView fallback:', e);
      return false;
    }
  }

  // ── Compute Difference & Stats ────────────────────────────────────────────
  function computeDiff(a, b) {
    const aL = a ? a.split('\n') : [];
    const bL = b ? b.split('\n') : [];
    const m = aL.length, n = bL.length;
    const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = aL[i-1] === bL[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);
      }
    }
    const ops = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && aL[i-1] === bL[j-1]) {
        ops.unshift({ t: 'ctx', v: aL[i-1], lineA: i, lineB: j });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
        ops.unshift({ t: 'add', v: bL[j-1], lineB: j });
        j--;
      } else {
        ops.unshift({ t: 'del', v: aL[i-1], lineA: i });
        i--;
      }
    }
    return ops;
  }

  function renderDiff() {
    const a = diffAEl?.value || '';
    const b = diffBEl?.value || '';
    save('diffA', a); save('diffB', b);

    if (cmMergeView) {
      if (cmMergeView.editor().getValue() !== b) cmMergeView.editor().setValue(b);
      if (cmMergeView.leftOriginal().getValue() !== a) cmMergeView.leftOriginal().setValue(a);
    }

    updateStats();
  }

  function updateStats() {
    const a = diffAEl?.value || '';
    const b = diffBEl?.value || '';
    const ops = computeDiff(a, b);

    let adds = 0, dels = 0;
    ops.forEach(op => {
      if (op.t === 'add') adds++;
      if (op.t === 'del') dels++;
    });

    if (diffStats) {
      diffStats.innerHTML = ops.length
        ? `<span class="badge-add">+${adds}</span> <span class="badge-del">-${dels}</span> <span class="badge-ctx">${ops.length} linhas</span>`
        : '';
    }

    // Render table fallback / side view
    if (diffTbody) {
      let ln = 0;
      const rows = ops.map(op => {
        ln++;
        const cls = op.t === 'add' ? 'r-add' : op.t === 'del' ? 'r-del' : 'r-ctx';
        const pfx = op.t === 'add' ? '+ ' : op.t === 'del' ? '- ' : '  ';
        return `<tr class="${cls}"><td class="ln">${ln}</td><td>${esc(pfx + op.v)}</td></tr>`;
      });
      diffTbody.innerHTML = rows.length
        ? rows.join('')
        : '<tr class="r-ctx"><td class="ln"></td><td>Sem diferenças entre os arquivos.</td></tr>';
    }
  }

  const renderDiffD = debounce(renderDiff, 150);
  if (diffAEl) diffAEl.addEventListener('input', renderDiffD);
  if (diffBEl) diffBEl.addEventListener('input', renderDiffD);

  // ── Open Files from Computer ──────────────────────────────────────────────
  if (btnOpenA) {
    btnOpenA.onclick = async () => {
      const file = await chooseFileFromComputer({
        title: 'Abrir Arquivo Original (A)',
        filters: [
          { name: 'Arquivos de Código/Texto', extensions: ['js', 'ts', 'jsx', 'tsx', 'json', 'html', 'css', 'xml', 'sql', 'md', 'txt', 'py', 'java', 'c', 'cpp'] },
          { name: 'Todos os Arquivos', extensions: ['*'] }
        ]
      });
      if (file?.content !== undefined) {
        fileAName = file.fileName;
        if (labelFileA) labelFileA.textContent = file.fileName;
        if (diffAEl) diffAEl.value = file.content;
        renderDiff();
        toast('✓ Arquivo A carregado: ' + file.fileName, 'ok');
      }
    };
  }

  if (btnOpenB) {
    btnOpenB.onclick = async () => {
      const file = await chooseFileFromComputer({
        title: 'Abrir Arquivo Modificado (B)',
        filters: [
          { name: 'Arquivos de Código/Texto', extensions: ['js', 'ts', 'jsx', 'tsx', 'json', 'html', 'css', 'xml', 'sql', 'md', 'txt', 'py', 'java', 'c', 'cpp'] },
          { name: 'Todos os Arquivos', extensions: ['*'] }
        ]
      });
      if (file?.content !== undefined) {
        fileBName = file.fileName;
        if (labelFileB) labelFileB.textContent = file.fileName;
        if (diffBEl) diffBEl.value = file.content;
        renderDiff();
        toast('✓ Arquivo B carregado: ' + file.fileName, 'ok');
      }
    };
  }

  if (btnSaveB) {
    btnSaveB.onclick = async () => {
      const content = diffBEl?.value || '';
      await saveFileToComputer({
        title: 'Salvar Arquivo Modificado (B)',
        defaultPath: fileBName.includes('.') ? fileBName : 'modificado.txt',
        content
      });
    };
  }

  // ── Drag & Drop Files onto Panels ─────────────────────────────────────────
  function setupDragDrop(panelEl, textareaEl, labelEl, isPanelB) {
    if (!panelEl) return;
    panelEl.addEventListener('dragover', e => { e.preventDefault(); panelEl.classList.add('drag-over'); });
    panelEl.addEventListener('dragleave', () => panelEl.classList.remove('drag-over'));
    panelEl.addEventListener('drop', e => {
      e.preventDefault();
      panelEl.classList.remove('drag-over');
      const files = e.dataTransfer?.files;
      if (files?.length) {
        const file = files[0];
        const reader = new FileReader();
        reader.onload = ev => {
          if (textareaEl) textareaEl.value = ev.target.result;
          if (labelEl) labelEl.textContent = file.name;
          if (isPanelB) fileBName = file.name;
          else fileAName = file.name;
          renderDiff();
          toast(`✓ Arquivo carregado: ${file.name}`, 'ok');
        };
        reader.readAsText(file);
      }
    });
  }

  setupDragDrop($('diffColA'), diffAEl, labelFileA, false);
  setupDragDrop($('diffColB'), diffBEl, labelFileB, true);

  // ── Swap, Copy, Clear ─────────────────────────────────────────────────────
  if (btnSwap) {
    btnSwap.onclick = () => {
      const tmpVal = diffAEl?.value || '';
      if (diffAEl) diffAEl.value = diffBEl?.value || '';
      if (diffBEl) diffBEl.value = tmpVal;

      const tmpName = fileAName;
      fileAName = fileBName;
      fileBName = tmpName;
      if (labelFileA) labelFileA.textContent = fileAName;
      if (labelFileB) labelFileB.textContent = fileBName;

      renderDiff();
      toast('⇄ Arquivos trocados');
    };
  }

  if (btnClear) {
    btnClear.onclick = () => {
      if (diffAEl) diffAEl.value = '';
      if (diffBEl) diffBEl.value = '';
      fileAName = 'Original (A)';
      fileBName = 'Modificado (B)';
      if (labelFileA) labelFileA.textContent = fileAName;
      if (labelFileB) labelFileB.textContent = fileBName;
      renderDiff();
      toast('✓ Diff limpo');
    };
  }

  if (btnCopyDiff) {
    btnCopyDiff.onclick = () => {
      const a = diffAEl?.value || '';
      const b = diffBEl?.value || '';
      const ops = computeDiff(a, b);
      let patch = `--- ${fileAName}\n+++ ${fileBName}\n`;
      ops.forEach(op => {
        const pfx = op.t === 'add' ? '+' : op.t === 'del' ? '-' : ' ';
        patch += `${pfx}${op.v}\n`;
      });
      copy(patch, '✓ Patch Git copiado');
    };
  }

  // ── ChangeLog Generator ───────────────────────────────────────────────────
  function generateChangeLog() {
    const a = diffAEl?.value || '';
    const b = diffBEl?.value || '';
    const ops = computeDiff(a, b);

    let adds = 0, dels = 0;
    const addedLines = [];
    const removedLines = [];

    ops.forEach(op => {
      if (op.t === 'add') {
        adds++;
        if (addedLines.length < 15) addedLines.push(op.v.trim());
      }
      if (op.t === 'del') {
        dels++;
        if (removedLines.length < 15) removedLines.push(op.v.trim());
      }
    });

    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR');

    let cl = `## 📋 ChangeLog de Modificações\n\n`;
    cl += `**Data:** ${dateStr}  \n`;
    cl += `**Comparação:** \`${fileAName}\` ➔ \`${fileBName}\`  \n`;
    cl += `**Impacto:** \`+${adds}\` adições | \`-${dels}\` exclusões  \n\n`;

    cl += `### 📌 Resumo das Alterações\n`;
    if (adds === 0 && dels === 0) {
      cl += `- Nenhuma alteração detectada entre os arquivos.\n`;
    } else {
      if (adds > 0) cl += `- Inclusão de **${adds}** nova(s) linha(s) de código/conteúdo.\n`;
      if (dels > 0) cl += `- Remoção de **${dels}** linha(s) obsoletas ou refatoradas.\n`;
    }

    if (addedLines.length > 0) {
      cl += `\n### 🚀 Novas Funcionalidades / Adições em Destaque\n`;
      addedLines.forEach(l => {
        if (l) cl += `- \`${l.slice(0, 100)}\`\n`;
      });
      if (adds > 15) cl += `*(...mais ${adds - 15} adições omitidas para brevidade)*\n`;
    }

    if (removedLines.length > 0) {
      cl += `\n### 🗑️ Remoções / Refatorações\n`;
      removedLines.forEach(l => {
        if (l) cl += `- \`${l.slice(0, 100)}\`\n`;
      });
      if (dels > 15) cl += `*(...mais ${dels - 15} remoções omitidas)*\n`;
    }

    if (clTextarea) clTextarea.value = cl;
    if (modalChangeLog) {
      modalChangeLog.classList.remove('hidden');
      modalChangeLog.style.display = 'flex';
    }
  }

  if (btnGenChangeLog) btnGenChangeLog.onclick = generateChangeLog;

  if (btnCloseChangeLog) {
    btnCloseChangeLog.onclick = () => {
      if (modalChangeLog) {
        modalChangeLog.classList.add('hidden');
        modalChangeLog.style.display = 'none';
      }
    };
  }

  if (btnCopyChangeLog) {
    btnCopyChangeLog.onclick = () => {
      if (clTextarea) copy(clTextarea.value, '✓ ChangeLog copiado em Markdown!');
    };
  }

  if (btnSaveChangeLog) {
    btnSaveChangeLog.onclick = async () => {
      if (!clTextarea) return;
      await saveFileToComputer({
        title: 'Salvar ChangeLog Markdown',
        defaultPath: 'CHANGELOG.md',
        filters: [{ name: 'Markdown', extensions: ['md'] }],
        content: clTextarea.value
      });
    };
  }

  window.renderDiff = renderDiff;
  window.computeDiff = computeDiff;
})();
