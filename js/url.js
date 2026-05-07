'use strict';
// ══════════════════════════════════════════════════════
//  URL TOOLS
// ══════════════════════════════════════════════════════
(function() {
  const inp = $('urlInput'), out = $('urlOutput');
  inp.addEventListener('input', () => save('urlIn', inp.value));

  $('urlEncode').onclick    = () => { out.value = encodeURI(inp.value); };
  $('urlDecode').onclick    = () => { try { out.value = decodeURI(inp.value); } catch { toast('✗ URI inválida','err'); } };
  $('urlEncodeComp').onclick = () => { out.value = encodeURIComponent(inp.value); };
  $('urlDecodeComp').onclick = () => { try { out.value = decodeURIComponent(inp.value); } catch { toast('✗ URI inválida','err'); } };
  $('urlCopy').onclick      = () => copy(out.value);

  function parseQS(input) {
    const tbody = $('urlQSTbody');
    if (!input.trim()) {
      tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;color:var(--muted);padding:10px">Nenhum parâmetro</td></tr>';
      return;
    }
    let search = input.trim();
    try {
      const url = new URL(search.includes('://') ? search : 'https://x?' + search.replace(/^\?/,''));
      search = url.search;
    } catch { search = '?' + search.replace(/^\?/,''); }
    const params = new URLSearchParams(search.replace(/^\?/,''));
    const entries = [...params];
    if (!entries.length) {
      tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;color:var(--muted);padding:10px">Nenhum parâmetro encontrado</td></tr>';
      return;
    }
    tbody.innerHTML = entries.map(([k,v]) =>
      `<tr><td>${esc(k)}</td><td>${esc(decodeURIComponent(v))}</td></tr>`
    ).join('');
  }

  const parseQSD = debounce(() => parseQS($('urlQS').value), 200);
  $('urlQS').addEventListener('input', parseQSD);
})();
