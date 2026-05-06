'use strict';

// ══════════════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════════════
function $(id) { return document.getElementById(id); }

function toast(msg = '✓ Copiado') {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 1800);
}

function copy(text, msg) {
  navigator.clipboard.writeText(text).then(() => toast(msg));
}

function save(key, val) { chrome.storage.local.set({ [key]: val }); }

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// ══════════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════════
const VIEWS = ['json','diff','mock','base64','url','jwt','regex','timestamp','uuid','hash','color','jsonschema','cron','playground','diagram'];

function switchView(view) {
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.view === view)
  );
  VIEWS.forEach(v => $(v + 'View').classList.toggle('hidden', v !== view));
  save('lastView', view);
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.onclick = () => switchView(item.dataset.view);
});

// ══════════════════════════════════════════════════════
//  LOAD SAVED STATE
// ══════════════════════════════════════════════════════
chrome.storage.local.get(
  ['json','diffA','diffB','mock','b64In','urlIn','jwtIn','regexPat','regexFlags','regexText','tsUnix','lastView','uuid','hashInput','playgroundCode','cronExpr','diagram'],
  r => {
    if (r.json)       $('jsonEditor').value  = r.json;
    if (r.diffA)      $('diffA').value        = r.diffA;
    if (r.diffB)      $('diffB').value        = r.diffB;
    if (r.b64In)      $('b64Input').value     = r.b64In;
    if (r.urlIn)      $('urlInput').value     = r.urlIn;
    if (r.jwtIn)      { $('jwtInput').value   = r.jwtIn; decodeJWT(r.jwtIn); }
    if (r.regexPat)   $('regexPattern').value = r.regexPat;
    if (r.regexFlags) $('regexFlags').value   = r.regexFlags;
    if (r.regexText)  $('regexText').value    = r.regexText;
    if (r.tsUnix)     $('tsUnix').value       = r.tsUnix;
    if (r.uuid)       $('uuidOutput').value   = r.uuid;
    if (r.hashInput)  $('hashInput').value    = r.hashInput;
    if (r.playgroundCode) $('playgroundCode').value = r.playgroundCode;
    if (r.cronExpr)   $('cronExprInput').value = r.cronExpr;

    // Load mock from file, fallback to saved
    fetch('mock.html')
      .then(res => res.text())
      .then(html => { $('mockEditor').value = r.mock ?? html; })
      .catch(() => { $('mockEditor').value = r.mock ?? ''; });

    switchView(r.lastView || 'json');

    // Restore live diffs and regex
    if (r.diffA || r.diffB) renderDiff();
    if (r.regexText) runRegex();
  }
);

// ══════════════════════════════════════════════════════
//  JSON PRETTY
// ══════════════════════════════════════════════════════
const jsonEditor = $('jsonEditor');

jsonEditor.addEventListener('input', () => save('json', jsonEditor.value));

$('formatJson').onclick = () => {
  try {
    const out = JSON.stringify(JSON.parse(jsonEditor.value), null, 2);
    jsonEditor.value = out;
    save('json', out);
  } catch {
    jsonEditor.style.boxShadow = 'inset 2px 0 0 #f43f5e';
    setTimeout(() => jsonEditor.style.boxShadow = '', 700);
    toast('✗ JSON inválido');
  }
};

$('minifyJson').onclick = () => {
  try {
    const out = JSON.stringify(JSON.parse(jsonEditor.value));
    jsonEditor.value = out;
    save('json', out);
  } catch {
    toast('✗ JSON inválido');
  }
};

$('copyJson').onclick  = () => copy(jsonEditor.value);
$('clearJson').onclick = () => { jsonEditor.value = ''; save('json', ''); };

// ══════════════════════════════════════════════════════
//  DIFF — TEMPO REAL
// ══════════════════════════════════════════════════════
function computeDiff(a, b) {
  const aLines = a ? a.split('\n') : [];
  const bLines = b ? b.split('\n') : [];
  const m = aLines.length, n = bLines.length;
  // LCS DP
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = aLines[i-1] === bLines[j-1]
        ? dp[i-1][j-1] + 1
        : Math.max(dp[i-1][j], dp[i][j-1]);
  const ops = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aLines[i-1] === bLines[j-1]) {
      ops.unshift({ t: 'ctx', a: aLines[i-1], b: bLines[j-1] }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      ops.unshift({ t: 'add', a: '',            b: bLines[j-1] }); j--;
    } else {
      ops.unshift({ t: 'del', a: aLines[i-1], b: '' }); i--;
    }
  }
  return ops;
}

function renderDiff() {
  const a = $('diffA').value;
  const b = $('diffB').value;
  save('diffA', a); save('diffB', b);

  const ops = computeDiff(a, b);
  if (!ops.length) {
    $('diffTbody').innerHTML = '<tr class="r-ctx"><td class="ln"></td><td>Sem diferenças.</td></tr>';
    return;
  }

  let ln = 0;
  const rows = ops.map(op => {
    ln++;
    const cls = op.t === 'add' ? 'r-add' : op.t === 'del' ? 'r-del' : 'r-ctx';
    const prefix = op.t === 'add' ? '+ ' : op.t === 'del' ? '- ' : '  ';
    const line = op.t === 'del' ? op.a : op.b;
    return `<tr class="${cls}"><td class="ln">${ln}</td><td>${esc(prefix + line)}</td></tr>`;
  });
  $('diffTbody').innerHTML = rows.join('');
}

const renderDiffDebounced = debounce(renderDiff, 120);

$('diffA').addEventListener('input', renderDiffDebounced);
$('diffB').addEventListener('input', renderDiffDebounced);

$('copyDiff').onclick = () => {
  const rows = $('diffTbody').querySelectorAll('tr');
  const text = Array.from(rows).map(r => {
    const tds = r.querySelectorAll('td');
    return tds[1] ? tds[1].textContent : '';
  }).join('\n');
  copy(text);
};

$('clearDiff').onclick = () => {
  $('diffA').value = ''; $('diffB').value = '';
  $('diffTbody').innerHTML = '<tr class="r-ctx"><td class="ln"></td><td>Edite os painéis para ver o diff…</td></tr>';
  save('diffA',''); save('diffB','');
};

// ══════════════════════════════════════════════════════
//  MOCK
// ══════════════════════════════════════════════════════
const mockEditor = $('mockEditor');
mockEditor.addEventListener('input', () => save('mock', mockEditor.value));

$('copyMock').onclick  = () => copy(mockEditor.value);
$('clearMock').onclick = () => { mockEditor.value = ''; save('mock', ''); };
$('reloadMock').onclick = () => {
  fetch('mock.html').then(r => r.text()).then(html => {
    mockEditor.value = html;
    save('mock', html);
    toast('✓ Template resetado');
  });
};

// ══════════════════════════════════════════════════════
//  BASE64
// ══════════════════════════════════════════════════════
$('b64Input').addEventListener('input', () => save('b64In', $('b64Input').value));

$('b64Encode').onclick = () => {
  try {
    const bytes = new TextEncoder().encode($('b64Input').value);
    $('b64Output').value = btoa(String.fromCharCode(...bytes));
  } catch { toast('✗ Erro no encode'); }
};

$('b64Decode').onclick = () => {
  try {
    const bytes = atob($('b64Output').value.trim());
    const text = new TextDecoder().decode(new Uint8Array([...bytes].map(c => c.charCodeAt(0))));
    $('b64Input').value = text;
    save('b64In', $('b64Input').value);
  } catch { toast('✗ Base64 inválido'); }
};

$('b64Copy').onclick  = () => copy($('b64Output').value);
$('b64Clear').onclick = () => { $('b64Input').value = ''; $('b64Output').value = ''; save('b64In',''); };

// ══════════════════════════════════════════════════════
//  URL TOOLS
// ══════════════════════════════════════════════════════
$('urlInput').addEventListener('input', () => save('urlIn', $('urlInput').value));

$('urlEncode').onclick = () => {
  $('urlOutput').value = encodeURIComponent($('urlInput').value);
};
$('urlDecode').onclick = () => {
  try { $('urlOutput').value = decodeURIComponent($('urlInput').value); }
  catch { toast('✗ URL inválida'); }
};
$('urlCopy').onclick = () => copy($('urlOutput').value);

function parseQS(input) {
  let search = input.trim();
  try {
    const url = new URL(search.includes('://') ? search : 'https://x.com?' + search.replace(/^\?/, ''));
    search = url.search;
  } catch { search = '?' + search.replace(/^\?/, ''); }
  const params = new URLSearchParams(search.replace(/^\?/, ''));
  const tbody = $('urlQSTbody');
  tbody.innerHTML = '';
  if ([...params].length === 0) {
    tbody.innerHTML = '<tr><td colspan="2" style="color:var(--muted);text-align:center;padding:10px">Nenhum parâmetro encontrado</td></tr>';
    return;
  }
  params.forEach((v, k) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="qs-key">${esc(k)}</td><td>${esc(decodeURIComponent(v))}</td>`;
    tbody.appendChild(tr);
  });
}

const parseQSDebounced = debounce(() => parseQS($('urlQS').value), 200);
$('urlQS').addEventListener('input', parseQSDebounced);

// ══════════════════════════════════════════════════════
//  JWT DECODER
// ══════════════════════════════════════════════════════
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bytes = atob(str);
  const text = new TextDecoder().decode(new Uint8Array([...bytes].map(c => c.charCodeAt(0))));
  return JSON.parse(text);
}

function decodeJWT(token) {
  token = token.trim();
  if (!token) { $('jwtHeader').textContent = '—'; $('jwtPayload').textContent = '—'; $('jwtExp').textContent = '—'; $('jwtExpBadge').textContent = ''; return; }
  const parts = token.split('.');
  if (parts.length < 2) { $('jwtHeader').textContent = 'Token inválido'; return; }
  try {
    const header  = b64urlDecode(parts[0]);
    const payload = b64urlDecode(parts[1]);

    $('jwtHeader').textContent  = JSON.stringify(header, null, 2);
    $('jwtPayload').textContent = JSON.stringify(payload, null, 2);

    // Exp / iat info
    const lines = [];
    if (payload.iat) lines.push(`iat: ${new Date(payload.iat * 1000).toLocaleString()} (${payload.iat})`);
    if (payload.exp) {
      const expDate = new Date(payload.exp * 1000);
      const expired = Date.now() > payload.exp * 1000;
      lines.push(`exp: ${expDate.toLocaleString()} (${payload.exp})`);
      const badge = $('jwtExpBadge');
      badge.textContent = expired ? '✗ Expirado' : '✓ Válido';
      badge.style.cssText = `background:${expired ? 'rgba(244,63,94,.2);color:#f43f5e' : 'rgba(34,197,94,.2);color:#22c55e'};font-size:9px;font-weight:700;padding:1px 6px;border-radius:3px`;
    }
    if (payload.sub)  lines.push(`sub: ${payload.sub}`);
    if (payload.roles) lines.push(`roles: ${JSON.stringify(payload.roles)}`);
    $('jwtExp').textContent = lines.join('\n') || '—';
  } catch(e) {
    $('jwtHeader').textContent = 'Erro: ' + e.message;
  }
}

$('jwtInput').addEventListener('input', () => {
  const v = $('jwtInput').value;
  save('jwtIn', v);
  decodeJWT(v);
});

$('jwtCopyPayload').onclick = () => {
  const text = $('jwtPayload').textContent;
  if (text && text !== '—') copy(text);
};

$('jwtClear').onclick = () => {
  $('jwtInput').value = '';
  decodeJWT('');
  save('jwtIn', '');
};

// ══════════════════════════════════════════════════════
//  REGEX TESTER
// ══════════════════════════════════════════════════════
// Regex execution counter to avoid duplicate listeners
let regexScrollActive = false;

function runRegex() {
  const pat  = $('regexPattern').value;
  const flags = ($('regexFlags').value || 'g').replace(/[^gimsuy]/g, '');
  const text = $('regexText').value;
  const hl   = $('regexHL');
  const cnt  = $('regexCount');

  save('regexPat',   pat);
  save('regexFlags', $('regexFlags').value);
  save('regexText',  text);

  if (!pat) { hl.textContent = text; cnt.textContent = ''; return; }

  let re;
  try { re = new RegExp(pat, flags.includes('g') ? flags : flags + 'g'); }
  catch { hl.innerHTML = esc(text); cnt.textContent = '✗ Regex inválida'; cnt.style.color='var(--del)'; return; }

  let count = 0;
  const parts = [];
  let last = 0;
  let match;
  const re2 = new RegExp(pat, flags.includes('g') ? flags : flags + 'g');
  while ((match = re2.exec(text)) !== null) {
    parts.push(esc(text.slice(last, match.index)));
    parts.push(`<mark>${esc(match[0])}</mark>`);
    last = match.index + match[0].length;
    count++;
    if (match[0].length === 0) { re2.lastIndex++; }
  }
  parts.push(esc(text.slice(last)));

  hl.innerHTML = parts.join('');
  cnt.textContent = count ? `${count} match${count > 1 ? 'es' : ''}` : 'Sem matches';
  cnt.style.color = count ? 'var(--accent)' : 'var(--del)';

  // Add scroll sync listener only once
  if (!regexScrollActive) {
    $('regexText').addEventListener('scroll', syncScroll, { passive: true });
    regexScrollActive = true;
  }
}

function syncScroll() {
  $('regexHL').scrollTop  = $('regexText').scrollTop;
  $('regexHL').scrollLeft = $('regexText').scrollLeft;
}

const runRegexDebounced = debounce(runRegex, 150);

$('regexPattern').addEventListener('input', runRegexDebounced);
$('regexFlags').addEventListener('input',   runRegexDebounced);
$('regexText').addEventListener('input',    runRegexDebounced);
$('regexText').addEventListener('scroll',   syncScroll);

$('regexCopy').onclick = () => {
  const pat = $('regexPattern').value;
  const text = $('regexText').value;
  if (!pat) return;
  try {
    const re = new RegExp(pat, ($('regexFlags').value || 'g').replace(/[^gimsuy]/g,''));
    const matches = [...text.matchAll(re)].map(m => m[0]);
    copy(matches.join('\n'), `✓ ${matches.length} match${matches.length !== 1 ? 'es' : ''} copiados`);
  } catch { toast('✗ Regex inválida'); }
};

$('regexClear').onclick = () => {
  $('regexPattern').value = ''; $('regexText').value = '';
  $('regexHL').innerHTML = ''; $('regexCount').textContent = '';
  save('regexPat',''); save('regexText','');
};

// ══════════════════════════════════════════════════════
//  TIMESTAMP
// ══════════════════════════════════════════════════════
function relativeTime(ms) {
  const diff = Date.now() - ms;
  const abs  = Math.abs(diff);
  const future = diff < 0;
  const s = Math.floor(abs / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  let str;
  if (s < 60)      str = `${s}s`;
  else if (m < 60) str = `${m}m`;
  else if (h < 24) str = `${h}h`;
  else              str = `${d}d`;
  return future ? `daqui ${str}` : `há ${str}`;
}

function convertTS(unix) {
  const ms = unix * 1000;
  const d  = new Date(ms);
  $('tsLocal').textContent    = d.toLocaleString('pt-BR');
  $('tsUTC').textContent      = d.toUTCString();
  $('tsISO').textContent      = d.toISOString();
  $('tsRelative').textContent = relativeTime(ms);
  $('tsResults').style.display = 'grid';
}

$('tsConvert').onclick = () => {
  const v = $('tsUnix').value.trim();
  if (!v || isNaN(Number(v))) { toast('✗ Timestamp inválido'); return; }
  const ts = Number(v);
  save('tsUnix', v);
  convertTS(ts);
};

$('tsNow').onclick = () => {
  const now = Math.floor(Date.now() / 1000);
  $('tsUnix').value = now;
  save('tsUnix', String(now));
  convertTS(now);
};

$('tsDateConvert').onclick = () => {
  const v = $('tsDate').value;
  if (!v) return;
  const ts = Math.floor(new Date(v).getTime() / 1000);
  $('tsDateVal').textContent = ts;
  $('tsDateResult').style.display = 'block';
};

$('tsCopy').onclick = () => {
  const v = $('tsUnix').value || $('tsDateVal').textContent;
  if (v) copy(v);
};

$('tsUnix').addEventListener('keydown', e => { if(e.key==='Enter') $('tsConvert').click(); });

// ══════════════════════════════════════════════════════
//  UUID GENERATOR
// ══════════════════════════════════════════════════════
function generateUUID(version = 4) {
  if (version === 4) {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  } else if (version === 1) {
    const now = Date.now();
    const timestamp = ((now / 1000 + 12219292800) * 10000).toString(16);
    const clockSeq = (Math.random() * 0x3fff | 0).toString(16).padStart(4, '0');
    const node = Array.from({length: 6}, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
    return [
      timestamp.slice(-8),
      timestamp.slice(-12, -8),
      '1' + timestamp.slice(-15, -12),
      (parseInt(clockSeq.slice(0, 2), 16) | 0x80).toString(16).padStart(2, '0') + clockSeq.slice(2),
      node
    ].join('-');
  }
}

$('uuidV4').onclick = () => { $('uuidV4').classList.add('primary'); $('uuidV1').classList.remove('primary'); };
$('uuidV1').onclick = () => { $('uuidV1').classList.add('primary'); $('uuidV4').classList.remove('primary'); };

$('uuidGen').onclick = () => {
  const count = Math.min(Math.max(1, parseInt($('uuidCount').value) || 1), 100);
  const version = $('uuidV1').classList.contains('primary') ? 1 : 4;
  const uuids = Array.from({length: count}, () => generateUUID(version));
  $('uuidOutput').value = uuids.join('\n');
  save('uuid', $('uuidOutput').value);
};

$('uuidCopy').onclick = () => copy($('uuidOutput').value);
$('uuidClear').onclick = () => { $('uuidOutput').value = ''; $('uuidCount').value = 1; save('uuid', ''); };

// ══════════════════════════════════════════════════════
//  HASH GENERATOR
// ══════════════════════════════════════════════════════
async function hashSHA256(str) {
  const buffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hashMD5(str) {
  // Simple MD5 implementation
  let l=str.length, d=[], x=[], f='0123456789abcdef';
  for(let i=0;i<l;i+=4){
    d[i>>2]=str.charCodeAt(i)+(str.charCodeAt(i+1)?str.charCodeAt(i+1)<<8:0)+(str.charCodeAt(i+2)?str.charCodeAt(i+2)<<16:0)+(str.charCodeAt(i+3)?str.charCodeAt(i+3)<<24:0);
  }
  d[l>>2]|=0x80<<((l%4)*8);
  d[(((l+64)>>>9)<<4)+14]=(l*8);
  let a=1732584193,b=4294967295,c=2718272474,d1=271733878;
  for(let i=0;i<d.length;i+=16){
    let e=a,g=b,h=c,k=d1;
    for(let j=0;j<64;j++){
      let f1,m;
      if(j<16){f1=(g & h)|(~g & k);m=j;}
      else if(j<32){f1=(k & g)|(~k & h);m=(5*j+1)%16;}
      else if(j<48){f1=g^h^k;m=(3*j+5)%16;}
      else{f1=h^(g|~k);m=(7*j)%16;}
      let t1 = ((a + f1 + Math.floor(Math.abs(Math.sin(j+1))*4294967296) + d[i+m]) >>> 0);
      t1 = (j<16 ? ((t1<<7)|(t1>>>25)) : j<32 ? ((t1<<12)|(t1>>>20)) : j<48 ? ((t1<<17)|(t1>>>15)) : ((t1<<22)|(t1>>>10))) >>> 0;
      a = ((k + t1) >>> 0); k = h; h = g; g = b = ((b + t1) >>> 0);
    }
    a = ((a + e) >>> 0); b = ((b + g) >>> 0); c = ((c + h) >>> 0); d1 = ((d1 + k) >>> 0);
  }
  return [a,b,c,d1].map(x => x.toString(16).padStart(8,'0')).join('');
}

$('hashInput').addEventListener('input', async () => {
  const v = $('hashInput').value;
  save('hashInput', v);
  if (v) {
    $('hashSHA256').value = await hashSHA256(v);
    $('hashMD5').value = hashMD5(v);
  }
});

$('hashCopySHA').onclick = () => copy($('hashSHA256').value);
$('hashCopyMD5').onclick = () => copy($('hashMD5').value);
$('hashClear').onclick = () => { $('hashInput').value = ''; $('hashSHA256').value = ''; $('hashMD5').value = ''; save('hashInput', ''); };

// ══════════════════════════════════════════════════════
//  COLOR CONVERTER
// ══════════════════════════════════════════════════════
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})` : null;
}

function rgbToHex(rgb) {
  const matches = rgb.match(/\d+/g);
  if (!matches || matches.length < 3) return null;
  return '#' + [parseInt(matches[0]), parseInt(matches[1]), parseInt(matches[2])].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

function updateColorPreview() {
  const hex = $('colorHex').value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    $('colorPreview').style.background = hex;
    $('colorRGB').value = hexToRgb(hex);
    const rgb = $('colorRGB').value.match(/\d+/g);
    if (rgb) $('colorHSL').value = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  }
}

$('colorHex').addEventListener('input', updateColorPreview);
$('colorCopyHex').onclick = () => copy($('colorHex').value);
$('colorCopyRGB').onclick = () => copy($('colorRGB').value);
$('colorCopyHSL').onclick = () => copy($('colorHSL').value);

$('colorHex').value = '#FF0000';
updateColorPreview();

// ══════════════════════════════════════════════════════
//  JSON SCHEMA VALIDATOR
// ══════════════════════════════════════════════════════
function validateJsonSchema(json, schema) {
  try {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const schemaObj = typeof schema === 'string' ? JSON.parse(schema) : schema;
    
    function validate(value, schema) {
      if (schema.type) {
        const type = Array.isArray(value) ? 'array' : typeof value;
        if (schema.type && schema.type !== type && !(schema.type === 'number' && type === 'number')) {
          return `Type mismatch: expected ${schema.type}, got ${type}`;
        }
      }
      
      if (schema.properties) {
        for (const key in schema.properties) {
          if (!(key in value)) {
            if (schema.required && schema.required.includes(key)) {
              return `Missing required property: ${key}`;
            }
          } else {
            const error = validate(value[key], schema.properties[key]);
            if (error) return `${key}: ${error}`;
          }
        }
      }
      
      if (schema.items && Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const error = validate(value[i], schema.items);
          if (error) return `[${i}]: ${error}`;
        }
      }
      
      if (schema.minLength && typeof value === 'string' && value.length < schema.minLength) {
        return `String too short (min: ${schema.minLength})`;
      }
      if (schema.maxLength && typeof value === 'string' && value.length > schema.maxLength) {
        return `String too long (max: ${schema.maxLength})`;
      }
      
      if (schema.minimum && typeof value === 'number' && value < schema.minimum) {
        return `Number below minimum (${schema.minimum})`;
      }
      if (schema.maximum && typeof value === 'number' && value > schema.maximum) {
        return `Number above maximum (${schema.maximum})`;
      }
      
      if (schema.enum && !schema.enum.includes(value)) {
        return `Value not in enum: ${schema.enum.join(', ')}`;
      }
      
      return null;
    }
    
    const error = validate(data, schemaObj);
    return error ? { valid: false, error } : { valid: true };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

$('schemaValidate').onclick = () => {
  const json = $('schemaJson').value;
  const schema = $('schemaSchema').value;
  const result = validateJsonSchema(json, schema);
  
  if (result.valid) {
    $('schemaResult').textContent = '✓ JSON válido e conforme o schema!';
    $('schemaResult').style.color = 'var(--add)';
  } else {
    $('schemaResult').textContent = '✗ Erro de validação:\n' + result.error;
    $('schemaResult').style.color = 'var(--del)';
  }
};

$('schemaClear').onclick = () => {
  $('schemaJson').value = '';
  $('schemaSchema').value = '';
  $('schemaResult').textContent = 'Validar clicando no botão…';
  $('schemaResult').style.color = 'var(--text)';
};

// ══════════════════════════════════════════════════════
//  CRON QUARTZ PARSER & CALCULATOR
// ══════════════════════════════════════════════════════
function expandCronField(field, min, max) {
  if (field === '*' || field === '?') return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  
  const values = new Set();
  const parts = field.split(',');
  
  for (const part of parts) {
    if (part.includes('/')) {
      const [range, step] = part.split('/');
      const [start, end] = range === '*' 
        ? [min, max]
        : range.includes('-')
        ? range.split('-').map(Number)
        : [Number(range), max];
      
      for (let i = start; i <= end; i += Number(step)) {
        if (i >= min && i <= max) values.add(i);
      }
    } else if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      for (let i = start; i <= end; i++) {
        if (i >= min && i <= max) values.add(i);
      }
    } else {
      const num = Number(part);
      if (num >= min && num <= max) values.add(num);
    }
  }
  
  return Array.from(values).sort((a, b) => a - b);
}

function getNextCronExecutions(cronExpr, count = 10) {
  try {
    const parts = cronExpr.trim().split(/\s+/);
    if (parts.length < 6) return [];
    
    const [sec, min, hour, day, month, dow] = parts;
    
    const secValues = expandCronField(sec, 0, 59);
    const minValues = expandCronField(min, 0, 59);
    const hourValues = expandCronField(hour, 0, 23);
    const dayValues = day === '?' ? null : expandCronField(day, 1, 31);
    const monthValues = expandCronField(month, 1, 12);
    const dowValues = dow === '?' ? null : expandCronField(dow, 0, 6);
    
    const executions = [];
    let current = new Date();
    current.setMilliseconds(0);
    
    // Move to next second
    current.setSeconds(current.getSeconds() + 1);
    
    while (executions.length < count && current.getFullYear() < 2100) {
      const y = current.getFullYear();
      const m = current.getMonth() + 1;
      const d = current.getDate();
      const h = current.getHours();
      const min_now = current.getMinutes();
      const s = current.getSeconds();
      
      let valid = true;
      
      // Check month
      if (!monthValues.includes(m)) {
        current.setMonth(current.getMonth() + 1);
        current.setDate(1);
        current.setHours(0, 0, 0);
        continue;
      }
      
      // Check day and dow
      const dayValid = dayValues === null || dayValues.includes(d);
      const dowValid = dowValues === null || dowValues.includes(current.getDay());
      
      if (!dayValid && !dowValid) {
        current.setDate(current.getDate() + 1);
        current.setHours(0, 0, 0, 0);
        continue;
      }
      
      // Check hour
      if (!hourValues.includes(h)) {
        current.setHours(current.getHours() + 1);
        current.setMinutes(0, 0, 0);
        continue;
      }
      
      // Check minute
      if (!minValues.includes(min_now)) {
        current.setMinutes(current.getMinutes() + 1);
        current.setSeconds(0, 0);
        continue;
      }
      
      // Check second
      if (!secValues.includes(s)) {
        current.setSeconds(current.getSeconds() + 1);
        continue;
      }
      
      executions.push(new Date(current));
      current.setSeconds(current.getSeconds() + 1);
    }
    
    return executions;
  } catch (e) {
    return [];
  }
}

function parseCronExpression(exprString) {
  try {
    const expr = exprString.trim();
    const parts = expr.split(/\s+/);
    
    if (parts.length < 6) return null;
    
    return {
      sec: parts[0],
      min: parts[1],
      hour: parts[2],
      day: parts[3],
      month: parts[4],
      dow: parts[5]
    };
  } catch (e) {
    return null;
  }
}

function generateCronExpression() {
  const sec = $('cronSec').value.trim() || '0';
  const min = $('cronMin').value.trim() || '0';
  const hour = $('cronHour').value.trim() || '*';
  const day = $('cronDay').value.trim() || '*';
  const month = $('cronMonth').value.trim() || '*';
  const dow = $('cronDayOfWeek').value.trim() || '?';
  
  const expr = `${sec} ${min} ${hour} ${day} ${month} ${dow}`;
  $('cronExpression').textContent = expr;
  return expr;
}

function updateCronPreview(cronExpr) {
  try {
    if (!cronExpr || !cronExpr.trim()) {
      $('cronPreview').textContent = 'Expressão cron inválida';
      return;
    }
    
    const parsed = parseCronExpression(cronExpr);
    if (!parsed) {
      $('cronPreview').textContent = 'Expressão cron inválida';
      return;
    }
    
    const executions = getNextCronExecutions(cronExpr, 10);
    
    let preview = '';
    
    // Generate description
    const { sec, min, hour, day, month, dow } = parsed;
    if (sec === '0' && min === '0' && hour === '*' && day === '*' && month === '*' && dow === '?') {
      preview = 'Executa a cada minuto\n';
    } else if (sec === '0' && min === '*/15' && hour === '*' && day === '*' && month === '*' && dow === '?') {
      preview = 'Executa a cada 15 minutos\n';
    } else if (sec === '0' && min === '0' && hour === '*' && day === '*' && month === '*' && dow === '?') {
      preview = 'Executa a cada hora\n';
    } else if (sec === '0' && min === '0' && hour === '12' && day === '*' && month === '*') {
      preview = 'Executa ao meio-dia\n';
    } else if (sec === '0' && min === '0' && hour === '0' && day === '*' && month === '*') {
      preview = 'Executa à meia-noite\n';
    } else if (sec === '0' && min === '0' && hour === '9' && dow === '1-5') {
      preview = 'Executa de segunda a sexta às 9h\n';
    } else {
      preview = 'Expressão personalizada\n';
    }
    
    const output = preview + (executions.length > 0 
      ? 'Próximas 10 execuções:\n' + 
        executions.map(d => `• ${d.toLocaleString('pt-BR')}`).join('\n')
      : 'Nenhuma execução próxima encontrada');
    
    $('cronPreview').textContent = output;
  } catch (e) {
    $('cronPreview').textContent = 'Erro ao processar expressão: ' + e.message;
  }
}

function setupCronHandlers() {
  const inputs = ['cronSec','cronMin','cronHour','cronDay','cronMonth','cronDayOfWeek'];
  inputs.forEach(id => {
    $(id).addEventListener('input', () => {
      const expr = generateCronExpression();
      updateCronPreview(expr);
      save('cronExpr', expr);
    });
  });
}

setupCronHandlers();

$('cronEveryday').onclick = () => {
  $('cronSec').value = '0'; $('cronMin').value = '0'; $('cronHour').value = '*';
  $('cronDay').value = '*'; $('cronMonth').value = '*'; $('cronDayOfWeek').value = '?';
  const expr = generateCronExpression(); updateCronPreview(expr);
};

$('cronEveryHour').onclick = () => {
  $('cronSec').value = '0'; $('cronMin').value = '0'; $('cronHour').value = '*';
  $('cronDay').value = '*'; $('cronMonth').value = '*'; $('cronDayOfWeek').value = '?';
  const expr = generateCronExpression(); updateCronPreview(expr);
};

$('cronEveryWeekday').onclick = () => {
  $('cronSec').value = '0'; $('cronMin').value = '0'; $('cronHour').value = '9';
  $('cronDay').value = '*'; $('cronMonth').value = '*'; $('cronDayOfWeek').value = '1-5';
  const expr = generateCronExpression(); updateCronPreview(expr);
};

$('cronEveryMonday').onclick = () => {
  $('cronSec').value = '0'; $('cronMin').value = '0'; $('cronHour').value = '9';
  $('cronDay').value = '*'; $('cronMonth').value = '*'; $('cronDayOfWeek').value = '1';
  const expr = generateCronExpression(); updateCronPreview(expr);
};

$('cronAtNoon').onclick = () => {
  $('cronSec').value = '0'; $('cronMin').value = '0'; $('cronHour').value = '12';
  $('cronDay').value = '*'; $('cronMonth').value = '*'; $('cronDayOfWeek').value = '?';
  const expr = generateCronExpression(); updateCronPreview(expr);
};

$('cronAtMidnight').onclick = () => {
  $('cronSec').value = '0'; $('cronMin').value = '0'; $('cronHour').value = '0';
  $('cronDay').value = '*'; $('cronMonth').value = '*'; $('cronDayOfWeek').value = '?';
  const expr = generateCronExpression(); updateCronPreview(expr);
};

$('cronCopy').onclick = () => copy($('cronExpression').textContent);
$('cronClear').onclick = () => {
  $('cronSec').value = '0'; $('cronMin').value = '0'; $('cronHour').value = '*';
  $('cronDay').value = '*'; $('cronMonth').value = '*'; $('cronDayOfWeek').value = '?';
  $('cronExprInput').value = '';
  generateCronExpression(); updateCronPreview('0 0 * * * ?');
};

// Bidirectional cron expression support
$('cronExprInput').addEventListener('input', () => {
  const expr = $('cronExprInput').value.trim();
  if (!expr) return;
  
  const parsed = parseCronExpression(expr);
  if (!parsed) {
    toast('✗ Expressão CRON inválida');
    return;
  }
  
  $('cronSec').value = parsed.sec;
  $('cronMin').value = parsed.min;
  $('cronHour').value = parsed.hour;
  $('cronDay').value = parsed.day;
  $('cronMonth').value = parsed.month;
  $('cronDayOfWeek').value = parsed.dow;
  
  generateCronExpression();
  updateCronPreview(expr);
  save('cronExpr', expr);
  toast('✓ Expressão CRON parseada');
});

// Load saved cron expression
chrome.storage.local.get(['cronExpr'], r => {
  if (r.cronExpr) {
    const parts = r.cronExpr.split(/\s+/);
    if (parts.length >= 6) {
      $('cronSec').value = parts[0];
      $('cronMin').value = parts[1];
      $('cronHour').value = parts[2];
      $('cronDay').value = parts[3];
      $('cronMonth').value = parts[4];
      $('cronDayOfWeek').value = parts[5];
      $('cronExprInput').value = r.cronExpr;
      generateCronExpression();
      updateCronPreview(r.cronExpr);
    }
  }
});

// ══════════════════════════════════════════════════════
//  JAVASCRIPT PLAYGROUND (WITH WEB WORKER)
// ══════════════════════════════════════════════════════
let playgroundWorker = null;

// Initialize Web Worker
try {
  playgroundWorker = new Worker('playground-worker.js');
} catch (e) {
  console.warn('Web Worker not available, fallback to eval');
}

function executePlaygroundCode() {
  const code = $('playgroundCode').value;
  const output = $('playgroundOutput');
  
  save('playgroundCode', code);

  if (!code.trim()) {
    output.textContent = '✓ Pronto para executar código';
    output.style.color = '#22c55e';
    return;
  }

  if (playgroundWorker) {
    // Use Web Worker for safe execution
    playgroundWorker.onmessage = function(event) {
      const { success, message, error } = event.data;
      
      if (success) {
        output.textContent = message.map(log => log.content).join('\n') || '✓ Executado com sucesso';
        output.style.color = '#4a9eff';
      } else {
        const errorMsg = error.message || 'Erro desconhecido';
        output.textContent = '✗ Erro:\n\n' + errorMsg;
        output.style.color = '#f43f5e';
      }
    };
    
    playgroundWorker.onerror = function(event) {
      output.textContent = '✗ Erro no Web Worker:\n\n' + event.message;
      output.style.color = '#f43f5e';
    };
    
    playgroundWorker.postMessage({ code });
  } else {
    // Fallback to direct execution (less safe, but works as before)
    const logs = [];
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.log = (...args) => {
      logs.push(args.map(arg => {
        if (typeof arg === 'object') return JSON.stringify(arg, null, 2);
        return String(arg);
      }).join(' '));
    };
    
    console.error = (...args) => {
      logs.push('❌ ' + args.join(' '));
    };
    
    console.warn = (...args) => {
      logs.push('⚠️ ' + args.join(' '));
    };
    
    try {
      const result = eval(code);
      if (result !== undefined) {
        logs.push('↪️ ' + (typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)));
      }
      output.textContent = logs.join('\n') || '✓ Executado com sucesso';
      output.style.color = '#4a9eff';
    } catch (e) {
      output.textContent = '✗ Erro:\n\n' + e.message;
      output.style.color = '#f43f5e';
    } finally {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    }
  }
}

$('playgroundRun').onclick = executePlaygroundCode;

$('playgroundCode').addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    executePlaygroundCode();
  }
});

$('playgroundCopy').onclick = () => copy($('playgroundOutput').textContent);

$('playgroundClear').onclick = () => {
  $('playgroundCode').value = '';
  $('playgroundOutput').textContent = '✓ Limpo';
  $('playgroundOutput').style.color = '#22c55e';
  save('playgroundCode', '');
};

// Load saved playground code
chrome.storage.local.get(['playgroundCode'], r => {
  if (r.playgroundCode) {
    $('playgroundCode').value = r.playgroundCode;
  }
});

// ══════════════════════════════════════════════════════
//  DIAGRAM EDITOR (AUTOMATOS)
// ══════════════════════════════════════════════════════
class DiagramShape {
  constructor(id, type, x, y, w, h, label = '') {
    this.id = id;
    this.type = type; // 'rect', 'circle', 'arrow'
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.label = label;
  }
}

let diagramShapes = [];
let diagramMode = 'select';
let selectedShape = null;
let dragStart = null;
let nextShapeId = 1;

const canvas = $('diagramCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  drawDiagram();
}

function drawDiagram() {
  if (!ctx) return;
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg');
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw grid
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border');
  ctx.lineWidth = 0.5;
  for (let i = 0; i < canvas.width; i += 20) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, canvas.height);
    ctx.stroke();
  }
  for (let i = 0; i < canvas.height; i += 20) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(canvas.width, i);
    ctx.stroke();
  }
  
  // Draw shapes
  diagramShapes.forEach(shape => {
    const isSelected = shape === selectedShape;
    const fillColor = isSelected ? getComputedStyle(document.documentElement).getPropertyValue('--accent') : getComputedStyle(document.documentElement).getPropertyValue('--s2');
    const strokeColor = isSelected ? getComputedStyle(document.documentElement).getPropertyValue('--accent') : getComputedStyle(document.documentElement).getPropertyValue('--border');
    
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.font = '12px var(--font-mono)';
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    if (shape.type === 'rect') {
      ctx.fillStyle = fillColor;
      ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
      ctx.strokeStyle = strokeColor;
      ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
      if (shape.label) {
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text');
        ctx.fillText(shape.label, shape.x + shape.w / 2, shape.y + shape.h / 2);
      }
    } else if (shape.type === 'circle') {
      ctx.fillStyle = fillColor;
      ctx.beginPath();
      ctx.arc(shape.x, shape.y, shape.w, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
      if (shape.label) {
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text');
        ctx.fillText(shape.label, shape.x, shape.y);
      }
    } else if (shape.type === 'arrow') {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(shape.x, shape.y);
      ctx.lineTo(shape.x + shape.w, shape.y + shape.h);
      ctx.stroke();
      
      // Arrow head
      const angle = Math.atan2(shape.h, shape.w);
      const headSize = 10;
      ctx.beginPath();
      ctx.moveTo(shape.x + shape.w, shape.y + shape.h);
      ctx.lineTo(shape.x + shape.w - headSize * Math.cos(angle - Math.PI / 6), shape.y + shape.h - headSize * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(shape.x + shape.w - headSize * Math.cos(angle + Math.PI / 6), shape.y + shape.h - headSize * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }
  });
}

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  if (diagramMode === 'select') {
    selectedShape = diagramShapes.find(s => {
      if (s.type === 'rect') return x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h;
      if (s.type === 'circle') return Math.hypot(x - s.x, y - s.y) <= s.w;
      return false;
    });
    drawDiagram();
  } else {
    dragStart = { x, y };
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (!dragStart) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  if (selectedShape && diagramMode === 'select') {
    selectedShape.x = x - selectedShape.w / 2;
    selectedShape.y = y - selectedShape.h / 2;
    drawDiagram();
  }
});

canvas.addEventListener('mouseup', (e) => {
  if (!dragStart) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const w = Math.abs(x - dragStart.x);
  const h = Math.abs(y - dragStart.y);
  
  if (w > 5 && h > 5) {
    if (diagramMode === 'rect') {
      diagramShapes.push(new DiagramShape(nextShapeId++, 'rect', Math.min(dragStart.x, x), Math.min(dragStart.y, y), w, h, `Ret${nextShapeId}`));
    } else if (diagramMode === 'circle') {
      const radius = Math.max(w, h) / 2;
      diagramShapes.push(new DiagramShape(nextShapeId++, 'circle', (dragStart.x + x) / 2, (dragStart.y + y) / 2, radius, 0, `Cir${nextShapeId}`));
    } else if (diagramMode === 'arrow') {
      diagramShapes.push(new DiagramShape(nextShapeId++, 'arrow', dragStart.x, dragStart.y, x - dragStart.x, y - dragStart.y, ''));
    }
    saveDiagram();
    drawDiagram();
  }
  
  dragStart = null;
});

function saveDiagram() {
  chrome.storage.local.set({ 'diagram': JSON.stringify(diagramShapes) });
}

function loadDiagram() {
  chrome.storage.local.get(['diagram'], r => {
    if (r.diagram) {
      try {
        const data = JSON.parse(r.diagram);
        diagramShapes = data.map(d => new DiagramShape(d.id, d.type, d.x, d.y, d.w, d.h, d.label));
        nextShapeId = Math.max(...diagramShapes.map(s => s.id), 0) + 1;
        drawDiagram();
      } catch (e) {
        console.error('Error loading diagram:', e);
      }
    }
  });
}

$('diagramRect').onclick = () => { diagramMode = 'rect'; $('diagramRect').classList.add('primary'); ['diagramCircle','diagramArrow','diagramSelect'].forEach(id => $(id).classList.remove('primary')); };
$('diagramCircle').onclick = () => { diagramMode = 'circle'; $('diagramCircle').classList.add('primary'); ['diagramRect','diagramArrow','diagramSelect'].forEach(id => $(id).classList.remove('primary')); };
$('diagramArrow').onclick = () => { diagramMode = 'arrow'; $('diagramArrow').classList.add('primary'); ['diagramRect','diagramCircle','diagramSelect'].forEach(id => $(id).classList.remove('primary')); };
$('diagramSelect').onclick = () => { diagramMode = 'select'; $('diagramSelect').classList.add('primary'); ['diagramRect','diagramCircle','diagramArrow'].forEach(id => $(id).classList.remove('primary')); };

$('diagramDelete').onclick = () => {
  if (selectedShape) {
    diagramShapes = diagramShapes.filter(s => s !== selectedShape);
    selectedShape = null;
    saveDiagram();
    drawDiagram();
  }
};

$('diagramRename').onclick = () => {
  if (selectedShape) {
    const newLabel = prompt('Digite o novo nome:', selectedShape.label);
    if (newLabel) {
      selectedShape.label = newLabel;
      saveDiagram();
      drawDiagram();
    }
  }
};

$('diagramClear').onclick = () => {
  if (confirm('Tem certeza que deseja limpar tudo?')) {
    diagramShapes = [];
    selectedShape = null;
    nextShapeId = 1;
    saveDiagram();
    drawDiagram();
  }
};

// Initialize diagram
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
loadDiagram();
$('diagramSelect').classList.add('primary');

// ══════════════════════════════════════════════════════
//  JSON SYNTAX HIGHLIGHTING
// ══════════════════════════════════════════════════════
function highlightJSON(jsonStr) {
  try {
    const obj = JSON.parse(jsonStr);
    return syntaxHighlightJSON(obj);
  } catch (e) {
    return '<span class="json-null">Erro ao fazer parse do JSON</span>';
  }
}

function syntaxHighlightJSON(obj, depth = 0) {
  if (obj === null) return '<span class="json-null">null</span>';
  
  const type = typeof obj;
  
  if (type === 'boolean') return `<span class="json-boolean">${obj}</span>`;
  if (type === 'number') return `<span class="json-number">${obj}</span>`;
  if (type === 'string') return `<span class="json-string">"${obj.replace(/"/g, '\\"')}"</span>`;
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '<span class="json-bracket">[]</span>';
    const indent = '  '.repeat(depth);
    const nextIndent = '  '.repeat(depth + 1);
    const items = obj.map(item => nextIndent + syntaxHighlightJSON(item, depth + 1)).join(',\n');
    return `<span class="json-bracket">[</span>\n${items}\n${indent}<span class="json-bracket">]</span>`;
  }
  
  if (type === 'object') {
    const keys = Object.keys(obj);
    if (keys.length === 0) return '<span class="json-bracket">{}</span>';
    const indent = '  '.repeat(depth);
    const nextIndent = '  '.repeat(depth + 1);
    const items = keys.map(key => 
      nextIndent + `<span class="json-key">"${key}"</span>: ` + syntaxHighlightJSON(obj[key], depth + 1)
    ).join(',\n');
    return `<span class="json-bracket">{</span>\n${items}\n${indent}<span class="json-bracket">}</span>`;
  }
  
  return String(obj);
}

// Add button to toggle JSON syntax highlighting
const editorWrapper = jsonEditor.parentElement;
let jsonHighlightMode = false;

$('formatJson').insertAdjacentHTML('afterend', `
  <button class="btn" id="toggleJsonHL" style="margin-left:4px" title="Toggle syntax highlighting">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    Colorir
  </button>
`);

$('toggleJsonHL').onclick = () => {
  jsonHighlightMode = !jsonHighlightMode;
  $('toggleJsonHL').classList.toggle('primary', jsonHighlightMode);
  
  if (jsonHighlightMode && jsonEditor.value) {
    try {
      const highlighted = highlightJSON(jsonEditor.value);
      const viewer = document.createElement('div');
      viewer.id = 'jsonViewer';
      viewer.className = 'json-viewer';
      viewer.innerHTML = highlighted;
      jsonEditor.style.display = 'none';
      editorWrapper.appendChild(viewer);
    } catch (e) {
      toast('✗ JSON inválido');
      jsonHighlightMode = false;
      $('toggleJsonHL').classList.remove('primary');
    }
  } else {
    const viewer = document.getElementById('jsonViewer');
    if (viewer) viewer.remove();
    jsonEditor.style.display = '';
  }
};

// ══════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && e.key === 'F') { e.preventDefault(); $('formatJson').click(); }
  if (e.ctrlKey && !e.shiftKey) {
    const map = { '1':'json','2':'diff','3':'mock','4':'base64','5':'url','6':'jwt','7':'regex','8':'timestamp' };
    if (map[e.key]) { e.preventDefault(); switchView(map[e.key]); }
  }
});
