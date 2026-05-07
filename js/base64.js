'use strict';
// ══════════════════════════════════════════════════════
//  BASE64
// ══════════════════════════════════════════════════════
(function() {
  const inp = $('b64Input'), out = $('b64Output');
  inp.addEventListener('input', () => save('b64In', inp.value));

  $('b64Encode').onclick = () => {
    try {
      const bytes = new TextEncoder().encode(inp.value);
      out.value = btoa(String.fromCharCode(...bytes));
    } catch { toast('✗ Erro no encode','err'); }
  };

  $('b64Decode').onclick = () => {
    try {
      const raw = atob(out.value.trim());
      inp.value = new TextDecoder().decode(new Uint8Array([...raw].map(c=>c.charCodeAt(0))));
      save('b64In', inp.value);
    } catch { toast('✗ Base64 inválido','err'); }
  };

  $('b64Copy').onclick  = () => copy(out.value);
  $('b64Clear').onclick = () => { inp.value=''; out.value=''; save('b64In',''); };

  $('b64PasteClip').onclick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      inp.value = text;
      save('b64In', text);
      toast('✓ Colado da área de transferência');
    } catch { toast('✗ Sem acesso à área de transferência','err'); }
  };
})();
