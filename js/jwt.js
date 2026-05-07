'use strict';
// ══════════════════════════════════════════════════════
//  JWT DECODER
// ══════════════════════════════════════════════════════
function b64urlDecode(str) {
  str = str.replace(/-/g,'+').replace(/_/g,'/');
  while (str.length % 4) str += '=';
  return JSON.parse(new TextDecoder().decode(new Uint8Array([...atob(str)].map(c=>c.charCodeAt(0)))));
}

function decodeJWT(token) {
  token = (token||'').trim();
  if (!token) {
    ['jwtHeader','jwtPayload','jwtExp'].forEach(id => $(id).textContent='—');
    $('jwtExpBadge').innerHTML=''; return;
  }
  const parts = token.split('.');
  if (parts.length < 2) { $('jwtHeader').textContent='Token inválido'; return; }
  try {
    const header  = b64urlDecode(parts[0]);
    const payload = b64urlDecode(parts[1]);
    $('jwtHeader').textContent  = JSON.stringify(header, null, 2);
    $('jwtPayload').textContent = JSON.stringify(payload, null, 2);
    const lines = [];
    if (payload.iat) lines.push(`iat : ${new Date(payload.iat*1000).toLocaleString('pt-BR')}  (${payload.iat})`);
    if (payload.exp) {
      const expired = Date.now() > payload.exp*1000;
      lines.push(`exp : ${new Date(payload.exp*1000).toLocaleString('pt-BR')}  (${payload.exp})`);
      const color = expired ? '#f43f5e' : '#22c55e';
      const bg    = expired ? 'rgba(244,63,94,.15)' : 'rgba(34,197,94,.15)';
      $('jwtExpBadge').innerHTML = `<span style="font-size:9px;font-weight:700;padding:1px 7px;border-radius:3px;background:${bg};color:${color}">${expired?'✗ Expirado':'✓ Válido'}</span>`;
    }
    if (payload.sub)   lines.push(`sub : ${payload.sub}`);
    if (payload.iss)   lines.push(`iss : ${payload.iss}`);
    if (payload.roles) lines.push(`roles : ${JSON.stringify(payload.roles)}`);
    $('jwtExp').textContent = lines.join('\n') || '—';
  } catch(e) {
    $('jwtHeader').textContent = 'Erro: ' + e.message;
    $('jwtPayload').textContent = '—';
    $('jwtExp').textContent = '—';
  }
}

$('jwtInput').addEventListener('input', () => { const v=$('jwtInput').value; save('jwtIn',v); decodeJWT(v); });
$('jwtCopyHeader').onclick  = () => { const t=$('jwtHeader').textContent; if(t&&t!=='—') copy(t); };
$('jwtCopyPayload').onclick = () => { const t=$('jwtPayload').textContent; if(t&&t!=='—') copy(t); };
$('jwtClear').onclick = () => { $('jwtInput').value=''; decodeJWT(''); save('jwtIn',''); };
