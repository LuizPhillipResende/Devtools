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
const VIEWS = ['json','diff','mock','base64','url','jwt','regex','timestamp','uuid','hash','color','jsonschema'];

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
  ['json','diffA','diffB','mock','b64In','urlIn','jwtIn','regexPat','regexFlags','regexText','tsUnix','lastView','uuid','hashInput'],
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
//  KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && e.key === 'F') { e.preventDefault(); $('formatJson').click(); }
  if (e.ctrlKey && !e.shiftKey) {
    const map = { '1':'json','2':'diff','3':'mock','4':'base64','5':'url','6':'jwt','7':'regex','8':'timestamp' };
    if (map[e.key]) { e.preventDefault(); switchView(map[e.key]); }
  }
});
