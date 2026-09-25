'use strict';
// ══════════════════════════════════════════════════════
//  BASE64 — DESKTOP OPTIMIZED
// ══════════════════════════════════════════════════════
(function() {
  const inp = $('b64Input'), out = $('b64Output');
  const btnOpenFile = $('b64OpenFile');
  const btnSaveFile = $('b64SaveFile');

  if (!inp || !out) return;

  inp.addEventListener('input', () => save('b64In', inp.value));

  $('b64Encode').onclick = () => {
    try {
      const bytes = new TextEncoder().encode(inp.value);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      out.value = btoa(binary);
    } catch {
      toast('✗ Erro ao codificar Base64', 'del');
    }
  };

  $('b64Decode').onclick = () => {
    try {
      const cleaned = out.value.trim().replace(/^data:.*?;base64,/, '');
      const raw = atob(cleaned);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      inp.value = new TextDecoder().decode(bytes);
      save('b64In', inp.value);
    } catch {
      toast('✗ Base64 inválido para decodificar como texto UTF-8', 'del');
    }
  };

  $('b64Copy').onclick  = () => copy(out.value, '✓ Saída Base64 copiada');
  $('b64Clear').onclick = () => { inp.value = ''; out.value = ''; save('b64In', ''); };

  $('b64PasteClip').onclick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      inp.value = text;
      save('b64In', text);
      toast('✓ Colado da área de transferência');
    } catch {
      toast('✗ Sem acesso à área de transferência', 'del');
    }
  };

  // ── DESKTOP CAPABILITY: Convert Any Computer File to Base64 ──
  if (btnOpenFile) {
    btnOpenFile.onclick = async () => {
      const file = await chooseFileFromComputer({
        title: 'Escolher Qualquer Arquivo para Base64',
        filters: [
          { name: 'Todos os Arquivos (*.*)', extensions: ['*'] }
        ],
        readAs: 'base64'
      });
      if (file?.content) {
        const ext = file.fileName.split('.').pop() || '';
        out.value = file.content;
        inp.value = `[Arquivo carregado: ${file.fileName} (${ext.toUpperCase()})]`;
        toast(`✓ Arquivo "${file.fileName}" convertido para Base64!`, 'ok');
      }
    };
  }

  // ── DESKTOP CAPABILITY: Save Base64 back as Binary File to Computer ──
  if (btnSaveFile) {
    btnSaveFile.onclick = async () => {
      const rawBase64 = out.value.trim().replace(/^data:.*?;base64,/, '');
      if (!rawBase64) {
        toast('Nenhum dado Base64 na saída para salvar', 'warn');
        return;
      }
      await saveFileToComputer({
        title: 'Salvar Base64 como Arquivo no PC',
        defaultPath: 'arquivo_decodificado.bin',
        filters: [{ name: 'Todos os Arquivos', extensions: ['*'] }],
        content: rawBase64,
        isBase64: true
      });
    };
  }
})();
