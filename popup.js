'use strict';

// ══════════════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════════════
const $ = id => document.getElementById(id);

function toast(msg, type = 'ok') {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.className = ''; }, 2000);
}

function copy(text, msg = '✓ Copiado') {
  if (!text) return;
  navigator.clipboard.writeText(String(text)).then(() => toast(msg, 'ok'));
}

function save(key, val) {
  chrome.storage.local.set({ [key]: val });
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ══════════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════════
const VIEWS = ['json','diff','mock','base64','url','jwt','regex','timestamp',
               'uuid','hash','color','jsonschema','cron','playground','diagram'];

function switchView(view) {
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.view === view)
  );
  VIEWS.forEach(v => $(v + 'View').classList.toggle('hidden', v !== view));
  save('lastView', view);
  if (view === 'diagram') window.dispatchEvent(new CustomEvent('diagram-visible'));
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.onclick = () => switchView(item.dataset.view);
});

// ══════════════════════════════════════════════════════
//  LOAD SAVED STATE
// ══════════════════════════════════════════════════════
chrome.storage.local.get(null, r => {
  if (r.json)            $('jsonEditor').value      = r.json;
  if (r.diffA)           $('diffA').value           = r.diffA;
  if (r.diffB)           $('diffB').value           = r.diffB;
  if (r.b64In)           $('b64Input').value        = r.b64In;
  if (r.urlIn)           $('urlInput').value        = r.urlIn;
  if (r.jwtIn)         { $('jwtInput').value        = r.jwtIn; decodeJWT(r.jwtIn); }
  if (r.regexPat)        $('regexPattern').value    = r.regexPat;
  if (r.regexFlags)      $('regexFlags').value      = r.regexFlags;
  if (r.regexText)       $('regexText').value       = r.regexText;
  if (r.tsUnix)          $('tsUnix').value          = r.tsUnix;
  if (r.uuidOutput)      $('uuidOutput').value      = r.uuidOutput;
  if (r.hashInput)       $('hashInput').value       = r.hashInput;
  if (r.playgroundCode)  $('playgroundCode').value  = r.playgroundCode;
  if (r.colorHex)      { $('colorHex').value = r.colorHex; updateColorFromHex(r.colorHex); }
  if (r.cronExpr)        loadCronExpr(r.cronExpr);

  fetch('mock.html')
    .then(res => res.text())
    .then(html => { $('mockEditor').value = r.mock ?? html; })
    .catch(() => { $('mockEditor').value = r.mock ?? ''; });

  if (r.hashInput) recomputeHash(r.hashInput);
  if (r.diffA || r.diffB) renderDiff();
  if (r.regexText) runRegex();

  switchView(r.lastView || 'json');
});

// ══════════════════════════════════════════════════════
//  JSON PRETTY
// ══════════════════════════════════════════════════════
(function() {
  const ed = $('jsonEditor');
  const status = $('jsonStatus');

  ed.addEventListener('input', () => save('json', ed.value));

  // Tab key inserts spaces instead of focus-jump
  ed.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ed.selectionStart, end = ed.selectionEnd;
      ed.value = ed.value.slice(0,s) + '  ' + ed.value.slice(end);
      ed.selectionStart = ed.selectionEnd = s + 2;
    }
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); $('formatJson').click(); }
  });

  function sortKeys(obj) {
    if (Array.isArray(obj)) return obj.map(sortKeys);
    if (obj !== null && typeof obj === 'object') {
      return Object.keys(obj).sort().reduce((acc, k) => { acc[k] = sortKeys(obj[k]); return acc; }, {});
    }
    return obj;
  }

  function setStatus(ok, msg) {
    status.textContent = msg;
    status.style.display = 'block';
    status.style.background = ok ? 'rgba(34,197,94,.15)' : 'rgba(244,63,94,.15)';
    status.style.color = ok ? '#22c55e' : '#f43f5e';
  }

  $('formatJson').onclick = () => {
    try {
      const out = JSON.stringify(JSON.parse(ed.value), null, 2);
      ed.value = out; save('json', out);
      setStatus(true, '✓ Válido');
    } catch(e) {
      ed.style.boxShadow = 'inset 2px 0 0 #f43f5e';
      setTimeout(() => ed.style.boxShadow = '', 700);
      setStatus(false, '✗ ' + e.message.split('\n')[0].slice(0,30));
      toast('✗ JSON inválido', 'err');
    }
  };

  $('minifyJson').onclick = () => {
    try { const out = JSON.stringify(JSON.parse(ed.value)); ed.value = out; save('json', out); setStatus(true,'✓ Minificado'); }
    catch { toast('✗ JSON inválido', 'err'); }
  };

  $('sortJson').onclick = () => {
    try { const out = JSON.stringify(sortKeys(JSON.parse(ed.value)), null, 2); ed.value = out; save('json', out); setStatus(true,'✓ Ordenado'); }
    catch { toast('✗ JSON inválido', 'err'); }
  };

  $('copyJson').onclick = () => copy(ed.value);
  $('clearJson').onclick = () => { ed.value = ''; save('json',''); status.style.display='none'; };
})();

// ══════════════════════════════════════════════════════
//  DIFF
// ══════════════════════════════════════════════════════
function computeDiff(a, b) {
  const aL = a ? a.split('\n') : [];
  const bL = b ? b.split('\n') : [];
  const m = aL.length, n = bL.length;
  const dp = Array.from({length: m+1}, () => new Int32Array(n+1));
  for (let i=1;i<=m;i++)
    for (let j=1;j<=n;j++)
      dp[i][j] = aL[i-1]===bL[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j],dp[i][j-1]);
  const ops=[]; let i=m, j=n;
  while (i>0||j>0) {
    if (i>0&&j>0&&aL[i-1]===bL[j-1]) { ops.unshift({t:'ctx',v:aL[i-1]}); i--;j--; }
    else if (j>0&&(i===0||dp[i][j-1]>=dp[i-1][j])) { ops.unshift({t:'add',v:bL[j-1]}); j--; }
    else { ops.unshift({t:'del',v:aL[i-1]}); i--; }
  }
  return ops;
}

function renderDiff() {
  const a = $('diffA').value, b = $('diffB').value;
  save('diffA', a); save('diffB', b);
  const ops = computeDiff(a, b);
  let adds=0, dels=0, ln=0;
  const rows = ops.map(op => {
    ln++;
    if (op.t==='add') adds++;
    if (op.t==='del') dels++;
    const cls = op.t==='add'?'r-add':op.t==='del'?'r-del':'r-ctx';
    const pfx = op.t==='add'?'+ ':op.t==='del'?'- ':'  ';
    return `<tr class="${cls}"><td class="ln">${ln}</td><td>${esc(pfx+op.v)}</td></tr>`;
  });
  $('diffTbody').innerHTML = rows.length
    ? rows.join('')
    : '<tr class="r-ctx"><td class="ln"></td><td>Sem diferenças.</td></tr>';
  $('diffStats').textContent = ops.length ? ` +${adds} -${dels}` : '';
}
const renderDiffD = debounce(renderDiff, 120);
$('diffA').addEventListener('input', renderDiffD);
$('diffB').addEventListener('input', renderDiffD);

$('copyDiff').onclick = () => {
  const rows = $('diffTbody').querySelectorAll('tr');
  copy(Array.from(rows).map(r => r.querySelectorAll('td')[1]?.textContent||'').join('\n'));
};
$('swapDiff').onclick = () => {
  const tmp = $('diffA').value;
  $('diffA').value = $('diffB').value;
  $('diffB').value = tmp;
  renderDiff();
};
$('clearDiff').onclick = () => {
  $('diffA').value=''; $('diffB').value='';
  $('diffTbody').innerHTML='<tr class="r-ctx"><td class="ln"></td><td>Edite os painéis para ver o diff…</td></tr>';
  $('diffStats').textContent='';
  save('diffA',''); save('diffB','');
};

// ══════════════════════════════════════════════════════
//  MOCK
// ══════════════════════════════════════════════════════
(function() {
  const ed = $('mockEditor');
  ed.addEventListener('input', () => save('mock', ed.value));
  $('copyMock').onclick   = () => copy(ed.value);
  $('clearMock').onclick  = () => { ed.value=''; save('mock',''); };
  $('reloadMock').onclick = () => {
    fetch('mock.html').then(r=>r.text()).then(h => { ed.value=h; save('mock',h); toast('✓ Template resetado'); });
  };
  $('previewMock').onclick = () => {
    const w = window.open('', '_blank', 'width=900,height=600');
    w.document.write(ed.value);
    w.document.close();
  };
})();

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

// ══════════════════════════════════════════════════════
//  REGEX TESTER
// ══════════════════════════════════════════════════════
(function() {
  let scrollSync = false;

  function runRegex() {
    const pat   = $('regexPattern').value;
    const flags = ($('regexFlags').value || 'g').replace(/[^gimsuy]/g,'');
    const text  = $('regexText').value;
    const hl    = $('regexHL');
    const cnt   = $('regexCount');

    save('regexPat', pat); save('regexFlags', $('regexFlags').value); save('regexText', text);

    if (!pat) { hl.textContent = text; cnt.textContent=''; return; }

    let re;
    try { re = new RegExp(pat, flags.includes('g') ? flags : flags+'g'); }
    catch { hl.innerHTML=esc(text); cnt.textContent='✗ Regex inválida'; cnt.style.color='var(--del)'; return; }

    let count=0, last=0;
    const parts=[];
    const re2 = new RegExp(pat, flags.includes('g') ? flags : flags+'g');
    let match;
    while ((match=re2.exec(text))!==null) {
      parts.push(esc(text.slice(last, match.index)));
      parts.push(`<mark>${esc(match[0])}</mark>`);
      last = match.index + match[0].length;
      count++;
      if (match[0].length===0) re2.lastIndex++;
    }
    parts.push(esc(text.slice(last)));
    hl.innerHTML = parts.join('');
    cnt.textContent = count ? `${count} match${count>1?'es':''}` : 'Sem matches';
    cnt.style.color = count ? 'var(--accent)' : 'var(--del)';

    if (!scrollSync) {
      $('regexText').addEventListener('scroll', () => {
        hl.scrollTop=$('regexText').scrollTop; hl.scrollLeft=$('regexText').scrollLeft;
      }, {passive:true});
      scrollSync = true;
    }
  }

  const runD = debounce(runRegex, 150);
  $('regexPattern').addEventListener('input', runD);
  $('regexFlags').addEventListener('input', runD);
  $('regexText').addEventListener('input', runD);

  $('regexCopyMatches').onclick = () => {
    const pat = $('regexPattern').value, text = $('regexText').value;
    if (!pat) return;
    try {
      const re = new RegExp(pat, ($('regexFlags').value||'g').replace(/[^gimsuy]/g,''));
      const matches = [...text.matchAll(re)].map(m=>m[0]);
      copy(matches.join('\n'), `✓ ${matches.length} match${matches.length!==1?'es':''} copiados`);
    } catch { toast('✗ Regex inválida','err'); }
  };

  $('regexCopyPattern').onclick = () => {
    const p=$('regexPattern').value, f=$('regexFlags').value;
    if (p) copy(`/${p}/${f}`);
  };

  $('regexClear').onclick = () => {
    $('regexPattern').value=''; $('regexText').value='';
    $('regexHL').innerHTML=''; $('regexCount').textContent='';
    save('regexPat',''); save('regexText','');
  };
})();

// ══════════════════════════════════════════════════════
//  TIMESTAMP
// ══════════════════════════════════════════════════════
(function() {
  function relTime(ms) {
    const diff=Date.now()-ms, abs=Math.abs(diff), fut=diff<0;
    const s=Math.floor(abs/1000), m=Math.floor(s/60), h=Math.floor(m/60), d=Math.floor(h/24);
    const str = s<60?`${s}s`:m<60?`${m}min`:h<24?`${h}h`:`${d}d`;
    return fut ? `daqui ${str}` : `há ${str}`;
  }

  let lastTs = null;

  function showTS(unix) {
    lastTs = unix;
    const ms=unix*1000, d=new Date(ms);
    $('tsLocal').textContent    = d.toLocaleString('pt-BR');
    $('tsUTC').textContent      = d.toUTCString();
    $('tsISO').textContent      = d.toISOString();
    $('tsRelative').textContent = relTime(ms);
    $('tsGrid').style.display   = 'grid';
  }

  $('tsConvert').onclick = () => {
    const v = $('tsUnix').value.trim();
    if (!v || isNaN(+v)) { toast('✗ Timestamp inválido','err'); return; }
    save('tsUnix', v); showTS(+v);
  };

  $('tsNow').onclick = () => {
    const now = Math.floor(Date.now()/1000);
    $('tsUnix').value = now;
    save('tsUnix', String(now)); showTS(now);
  };

  $('tsDateConvert').onclick = () => {
    const v = $('tsDate').value;
    if (!v) return;
    const ts = Math.floor(new Date(v).getTime()/1000);
    $('tsDateVal').textContent = ts;
    $('tsDateCard').style.display = 'block';
    lastTs = ts;
  };

  $('tsUnix').addEventListener('keydown', e => { if(e.key==='Enter') $('tsConvert').click(); });

  $('tsCopyUnix').onclick = () => {
    const v = lastTs || $('tsUnix').value;
    if (v) copy(String(v));
  };
  $('tsCopyISO').onclick = () => {
    const iso = $('tsISO').textContent;
    if (iso && iso !== '—') copy(iso);
  };
  $('tsClear').onclick = () => {
    $('tsUnix').value=''; $('tsGrid').style.display='none';
    $('tsDateCard').style.display='none'; lastTs=null;
  };
})();

// ══════════════════════════════════════════════════════
//  UUID GENERATOR
// ══════════════════════════════════════════════════════
(function() {
  let selectedVer = 4;

  const verBtns = { 4: $('uuidV4btn'), 7: $('uuidV7btn'), 1: $('uuidV1btn') };
  Object.entries(verBtns).forEach(([v, btn]) => {
    btn.onclick = () => {
      selectedVer = +v;
      Object.values(verBtns).forEach(b => b.classList.remove('primary'));
      btn.classList.add('primary');
    };
  });

  function uuidV4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = crypto.getRandomValues(new Uint8Array(1))[0];
      const v = c==='x' ? (r & 0x0f) : ((r & 0x03) | 0x08);
      return v.toString(16);
    });
  }

  function uuidV1() {
    // Realistic v1 (time-based)
    const now = Date.now();
    const t = BigInt(now) * 10000n + 122192928000000000n;
    const th = Number((t >> 32n) & 0xFFFFFFFFn).toString(16).padStart(8,'0');
    const tm = Number((t >> 16n) & 0xFFFFn).toString(16).padStart(4,'0');
    const tl = Number(t & 0xFFFFn).toString(16).padStart(4,'0');
    const clockSeq = (crypto.getRandomValues(new Uint16Array(1))[0] & 0x3fff | 0x8000).toString(16).padStart(4,'0');
    const node = Array.from(crypto.getRandomValues(new Uint8Array(6))).map(b=>b.toString(16).padStart(2,'0')).join('');
    return `${th}-${tm}-1${tl.slice(1)}-${clockSeq}-${node}`;
  }

  function uuidV7() {
    // UUID v7: time-ordered, random suffix
    const ms = BigInt(Date.now());
    const rand = crypto.getRandomValues(new Uint8Array(10));
    const msHex = ms.toString(16).padStart(12,'0');
    const a = msHex.slice(0,8);
    const b = msHex.slice(8,12);
    const c = '7' + (rand[0] & 0x0f).toString(16).padStart(3,'0').slice(0,3);
    const d = ((rand[1] & 0x3f) | 0x80).toString(16).padStart(2,'0') +
              Array.from(rand.slice(2,4)).map(b=>b.toString(16).padStart(2,'0')).join('');
    const e = Array.from(rand.slice(4)).map(b=>b.toString(16).padStart(2,'0')).join('');
    return `${a}-${b}-${c}-${d}-${e}`;
  }

  function gen() { return selectedVer===4?uuidV4():selectedVer===7?uuidV7():uuidV1(); }

  $('uuidGen').onclick = () => {
    const count = clamp(+$('uuidCount').value||1, 1, 100);
    const result = Array.from({length:count}, gen).join('\n');
    $('uuidOutput').value = result;
    save('uuidOutput', result);
  };

  $('uuidCopy').onclick      = () => copy($('uuidOutput').value);
  $('uuidCopyFirst').onclick = () => copy($('uuidOutput').value.split('\n')[0]);
  $('uuidClear').onclick     = () => { $('uuidOutput').value=''; save('uuidOutput',''); };
})();

// ══════════════════════════════════════════════════════
//  HASH GENERATOR  (SHA-256, SHA-1 via SubtleCrypto; MD5 correct impl)
// ══════════════════════════════════════════════════════
(function() {
  async function sha(algo, str) {
    const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  // Correct MD5 using safe variable naming
  function md5(str) {
    function safeAdd(x, y) { const lsw=(x&0xffff)+(y&0xffff); return ((x>>16)+(y>>16)+(lsw>>16))<<16|lsw&0xffff; }
    function bitRotLeft(num, cnt) { return num<<cnt|num>>>32-cnt; }
    function md5cmn(q,a,b,x,s,t) { return safeAdd(bitRotLeft(safeAdd(safeAdd(a,q),safeAdd(x,t)),s),b); }
    function md5ff(a,b,c,d,x,s,t) { return md5cmn(b&c|~b&d,a,b,x,s,t); }
    function md5gg(a,b,c,d,x,s,t) { return md5cmn(b&d|c&~d,a,b,x,s,t); }
    function md5hh(a,b,c,d,x,s,t) { return md5cmn(b^c^d,a,b,x,s,t); }
    function md5ii(a,b,c,d,x,s,t) { return md5cmn(c^(b|~d),a,b,x,s,t); }

    function str2blks(str) {
      const nblk=((str.length+8)>>6)+1, blks=new Array(nblk*16).fill(0);
      for(let i=0;i<str.length;i++) blks[i>>2]|=str.charCodeAt(i)<<(i%4)*8;
      blks[str.length>>2]|=0x80<<(str.length%4)*8;
      blks[nblk*16-2]=str.length*8;
      return blks;
    }

    const x = str2blks(str);
    let a=1732584193, b=-271733879, c=-1732584194, d=271733878;
    for(let i=0;i<x.length;i+=16){
      const [oa,ob,oc,od]=[a,b,c,d];
      a=md5ff(a,b,c,d,x[i],7,-680876936);d=md5ff(d,a,b,c,x[i+1],12,-389564586);c=md5ff(c,d,a,b,x[i+2],17,606105819);b=md5ff(b,c,d,a,x[i+3],22,-1044525330);
      a=md5ff(a,b,c,d,x[i+4],7,-176418897);d=md5ff(d,a,b,c,x[i+5],12,1200080426);c=md5ff(c,d,a,b,x[i+6],17,-1473231341);b=md5ff(b,c,d,a,x[i+7],22,-45705983);
      a=md5ff(a,b,c,d,x[i+8],7,1770035416);d=md5ff(d,a,b,c,x[i+9],12,-1958414417);c=md5ff(c,d,a,b,x[i+10],17,-42063);b=md5ff(b,c,d,a,x[i+11],22,-1990404162);
      a=md5ff(a,b,c,d,x[i+12],7,1804603682);d=md5ff(d,a,b,c,x[i+13],12,-40341101);c=md5ff(c,d,a,b,x[i+14],17,-1502002290);b=md5ff(b,c,d,a,x[i+15],22,1236535329);
      a=md5gg(a,b,c,d,x[i+1],5,-165796510);d=md5gg(d,a,b,c,x[i+6],9,-1069501632);c=md5gg(c,d,a,b,x[i+11],14,643717713);b=md5gg(b,c,d,a,x[i],20,-373897302);
      a=md5gg(a,b,c,d,x[i+5],5,-701558691);d=md5gg(d,a,b,c,x[i+10],9,38016083);c=md5gg(c,d,a,b,x[i+15],14,-660478335);b=md5gg(b,c,d,a,x[i+4],20,-405537848);
      a=md5gg(a,b,c,d,x[i+9],5,568446438);d=md5gg(d,a,b,c,x[i+14],9,-1019803690);c=md5gg(c,d,a,b,x[i+3],14,-187363961);b=md5gg(b,c,d,a,x[i+8],20,1163531501);
      a=md5gg(a,b,c,d,x[i+13],5,-1444681467);d=md5gg(d,a,b,c,x[i+2],9,-51403784);c=md5gg(c,d,a,b,x[i+7],14,1735328473);b=md5gg(b,c,d,a,x[i+12],20,-1926607734);
      a=md5hh(a,b,c,d,x[i+5],4,-378558);d=md5hh(d,a,b,c,x[i+8],11,-2022574463);c=md5hh(c,d,a,b,x[i+11],16,1839030562);b=md5hh(b,c,d,a,x[i+14],23,-35309556);
      a=md5hh(a,b,c,d,x[i+1],4,-1530992060);d=md5hh(d,a,b,c,x[i+4],11,1272893353);c=md5hh(c,d,a,b,x[i+7],16,-155497632);b=md5hh(b,c,d,a,x[i+10],23,-1094730640);
      a=md5hh(a,b,c,d,x[i+13],4,681279174);d=md5hh(d,a,b,c,x[i],11,-358537222);c=md5hh(c,d,a,b,x[i+3],16,-722521979);b=md5hh(b,c,d,a,x[i+6],23,76029189);
      a=md5hh(a,b,c,d,x[i+9],4,-640364487);d=md5hh(d,a,b,c,x[i+12],11,-421815835);c=md5hh(c,d,a,b,x[i+15],16,530742520);b=md5hh(b,c,d,a,x[i+2],23,-995338651);
      a=md5ii(a,b,c,d,x[i],6,-198630844);d=md5ii(d,a,b,c,x[i+7],10,1126891415);c=md5ii(c,d,a,b,x[i+14],15,-1416354905);b=md5ii(b,c,d,a,x[i+5],21,-57434055);
      a=md5ii(a,b,c,d,x[i+12],6,1700485571);d=md5ii(d,a,b,c,x[i+3],10,-1894986606);c=md5ii(c,d,a,b,x[i+10],15,-1051523);b=md5ii(b,c,d,a,x[i+1],21,-2054922799);
      a=md5ii(a,b,c,d,x[i+8],6,1873313359);d=md5ii(d,a,b,c,x[i+15],10,-30611744);c=md5ii(c,d,a,b,x[i+6],15,-1560198380);b=md5ii(b,c,d,a,x[i+13],21,1309151649);
      a=md5ii(a,b,c,d,x[i+4],6,-145523070);d=md5ii(d,a,b,c,x[i+11],10,-1120210379);c=md5ii(c,d,a,b,x[i+2],15,718787259);b=md5ii(b,c,d,a,x[i+9],21,-343485551);
      a=safeAdd(a,oa);b=safeAdd(b,ob);c=safeAdd(c,oc);d=safeAdd(d,od);
    }

    function toLe(n) { return [(n)&0xff,(n>>8)&0xff,(n>>16)&0xff,(n>>24)&0xff]; }
    return [...toLe(a),...toLe(b),...toLe(c),...toLe(d)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  async function recomputeHash(text) {
    if (!text) { $('hashSHA256').value=''; $('hashSHA1').value=''; $('hashMD5').value=''; return; }
    $('hashMD5').value = md5(text);
    $('hashSHA256').value = await sha('SHA-256', text);
    $('hashSHA1').value   = await sha('SHA-1',   text);
  }

  // expose for load
  window.recomputeHash = recomputeHash;

  $('hashInput').addEventListener('input', async () => {
    const v = $('hashInput').value;
    save('hashInput', v);
    await recomputeHash(v);
  });

  $('hashCopySHA').onclick  = () => copy($('hashSHA256').value);
  $('hashCopySHA1').onclick = () => copy($('hashSHA1').value);
  $('hashCopyMD5').onclick  = () => copy($('hashMD5').value);
  $('hashClear').onclick = () => {
    $('hashInput').value=''; recomputeHash(''); save('hashInput','');
  };
})();

// ══════════════════════════════════════════════════════
//  COLOR CONVERTER  (all directions)
// ══════════════════════════════════════════════════════
(function() {
  let alpha = 1;

  function parseHex(h) {
    h = h.trim().replace(/^#/,'');
    if (h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }

  function parseRGB(s) {
    const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    return m ? [+m[1],+m[2],+m[3]] : null;
  }

  function parseHSL(s) {
    const m = s.match(/hsla?\(\s*(\d+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/i);
    if (!m) return null;
    let h=+m[1]/360, s2=+m[2]/100, l=+m[3]/100;
    if (s2===0) { const v=Math.round(l*255); return [v,v,v]; }
    const q = l<0.5 ? l*(1+s2) : l+s2-l*s2;
    const p = 2*l-q;
    const hue2rgb = (p,q,t) => {
      if(t<0)t+=1; if(t>1)t-=1;
      if(t<1/6)return p+(q-p)*6*t;
      if(t<1/2)return q;
      if(t<2/3)return p+(q-p)*(2/3-t)*6;
      return p;
    };
    return [Math.round(hue2rgb(p,q,h+1/3)*255), Math.round(hue2rgb(p,q,h)*255), Math.round(hue2rgb(p,q,h-1/3)*255)];
  }

  function rgbToHex([r,g,b]) { return '#'+[r,g,b].map(v=>clamp(v,0,255).toString(16).padStart(2,'0')).join('').toUpperCase(); }

  function rgbToHSL([r,g,b]) {
    r/=255; g/=255; b/=255;
    const max=Math.max(r,g,b), min=Math.min(r,g,b);
    let h, s, l=(max+min)/2;
    if (max===min) { h=s=0; } else {
      const d=max-min;
      s = l>0.5 ? d/(2-max-min) : d/(max+min);
      switch(max) {
        case r: h=((g-b)/d+(g<b?6:0))/6; break;
        case g: h=((b-r)/d+2)/6; break;
        case b: h=((r-g)/d+4)/6; break;
      }
    }
    return `hsl(${Math.round(h*360)}, ${Math.round(s*100)}%, ${Math.round(l*100)}%)`;
  }

  function rgbToRGB([r,g,b]) { return `rgb(${r}, ${g}, ${b})`; }

  function updateUI(rgb) {
    if (!rgb) return;
    const hex = rgbToHex(rgb);
    const hsl = rgbToHSL(rgb);
    const rgbStr = rgbToRGB(rgb);
    $('colorHex').value = hex;
    $('colorRGB').value = rgbStr;
    $('colorHSL').value = hsl;
    $('colorNative').value = hex.toLowerCase();
    const bg = alpha < 1 ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})` : hex;
    $('colorPreview').style.background = bg;
    $('colorChipHex').textContent = hex;
    $('colorChipRGB').textContent = rgbStr;
    $('colorChipHSL').textContent = hsl;
    if (alpha < 1) {
      $('colorRGBAField').style.display = 'block';
      $('colorRGBA').value = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha.toFixed(2)})`;
    } else {
      $('colorRGBAField').style.display = 'none';
    }
    save('colorHex', hex);
  }

  window.updateColorFromHex = (hex) => { const rgb=parseHex(hex); if(rgb) updateUI(rgb); };

  $('colorHex').addEventListener('input', () => { const rgb=parseHex($('colorHex').value); if(rgb) updateUI(rgb); });
  $('colorRGB').addEventListener('input', () => { const rgb=parseRGB($('colorRGB').value); if(rgb) updateUI(rgb); });
  $('colorHSL').addEventListener('input', () => { const rgb=parseHSL($('colorHSL').value); if(rgb) updateUI(rgb); });
  $('colorNative').addEventListener('input', () => { const rgb=parseHex($('colorNative').value); if(rgb) updateUI(rgb); });

  $('colorAlpha').addEventListener('input', () => {
    alpha = +$('colorAlpha').value / 100;
    $('colorAlphaVal').textContent = Math.round(alpha*100) + '%';
    const rgb = parseHex($('colorHex').value);
    if (rgb) updateUI(rgb);
  });

  ['colorChipHex','colorChipRGB','colorChipHSL'].forEach((id,i) => {
    $(id).onclick = () => copy([
      $('colorHex').value, $('colorRGB').value, $('colorHSL').value
    ][i]);
  });

  updateColorFromHex('#3b82f6');
})();

// ══════════════════════════════════════════════════════
//  JSON SCHEMA VALIDATOR (improved)
// ══════════════════════════════════════════════════════
(function() {
  const EXAMPLE_JSON   = '{\n  "name": "João",\n  "age": 30,\n  "email": "joao@exemplo.com"\n}';
  const EXAMPLE_SCHEMA = '{\n  "type": "object",\n  "required": ["name", "age"],\n  "properties": {\n    "name":  { "type": "string",  "minLength": 1 },\n    "age":   { "type": "number",  "minimum": 0, "maximum": 150 },\n    "email": { "type": "string" }\n  },\n  "additionalProperties": false\n}';

  function validate(data, schema, path='root') {
    const errors = [];

    if (schema.type) {
      const types = Array.isArray(schema.type) ? schema.type : [schema.type];
      const actual = data===null ? 'null' : Array.isArray(data) ? 'array' : typeof data;
      if (!types.includes(actual)) {
        errors.push(`[${path}] tipo esperado: ${types.join('|')}, recebido: ${actual}`);
        return errors;
      }
    }

    if (typeof data === 'string') {
      if (schema.minLength && data.length < schema.minLength)
        errors.push(`[${path}] string muito curta (mín: ${schema.minLength})`);
      if (schema.maxLength && data.length > schema.maxLength)
        errors.push(`[${path}] string muito longa (máx: ${schema.maxLength})`);
      if (schema.pattern && !new RegExp(schema.pattern).test(data))
        errors.push(`[${path}] não corresponde ao padrão: ${schema.pattern}`);
      if (schema.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data))
        errors.push(`[${path}] formato de email inválido`);
    }

    if (typeof data === 'number') {
      if (schema.minimum !== undefined && data < schema.minimum) errors.push(`[${path}] valor abaixo do mínimo (${schema.minimum})`);
      if (schema.maximum !== undefined && data > schema.maximum) errors.push(`[${path}] valor acima do máximo (${schema.maximum})`);
      if (schema.multipleOf && data % schema.multipleOf !== 0) errors.push(`[${path}] não é múltiplo de ${schema.multipleOf}`);
    }

    if (Array.isArray(data)) {
      if (schema.minItems !== undefined && data.length < schema.minItems) errors.push(`[${path}] array muito curto (mín: ${schema.minItems})`);
      if (schema.maxItems !== undefined && data.length > schema.maxItems) errors.push(`[${path}] array muito longo (máx: ${schema.maxItems})`);
      if (schema.items) data.forEach((item,i) => errors.push(...validate(item, schema.items, `${path}[${i}]`)));
    }

    if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
      const required = schema.required || [];
      required.forEach(k => { if (!(k in data)) errors.push(`[${path}] propriedade obrigatória ausente: "${k}"`); });

      if (schema.properties) {
        Object.entries(schema.properties).forEach(([k, subSchema]) => {
          if (k in data) errors.push(...validate(data[k], subSchema, `${path}.${k}`));
        });
      }

      if (schema.additionalProperties === false && schema.properties) {
        const allowed = new Set(Object.keys(schema.properties));
        Object.keys(data).forEach(k => {
          if (!allowed.has(k)) errors.push(`[${path}] propriedade adicional não permitida: "${k}"`);
        });
      }
    }

    if (schema.enum !== undefined && !schema.enum.some(v => JSON.stringify(v)===JSON.stringify(data)))
      errors.push(`[${path}] valor não está no enum: [${schema.enum.map(v=>JSON.stringify(v)).join(', ')}]`);

    if (schema.const !== undefined && JSON.stringify(data) !== JSON.stringify(schema.const))
      errors.push(`[${path}] valor deve ser exatamente: ${JSON.stringify(schema.const)}`);

    return errors;
  }

  $('schemaValidate').onclick = () => {
    const el = $('schemaResult');
    try {
      const data   = JSON.parse($('schemaJson').value);
      const schema = JSON.parse($('schemaSchema').value);
      const errors = validate(data, schema);
      if (!errors.length) {
        el.textContent = '✓ JSON válido e conforme o schema!';
        el.className = 'schema-result-ok';
      } else {
        el.textContent = `✗ ${errors.length} erro${errors.length>1?'s':''} encontrado${errors.length>1?'s':''}:\n\n` + errors.join('\n');
        el.className = 'schema-result-err';
      }
    } catch(e) {
      el.textContent = '✗ JSON ou Schema inválido:\n' + e.message;
      el.className = 'schema-result-err';
    }
  };

  $('schemaExample').onclick = () => {
    $('schemaJson').value   = EXAMPLE_JSON;
    $('schemaSchema').value = EXAMPLE_SCHEMA;
    $('schemaResult').textContent = 'Clique em Validar…';
    $('schemaResult').className = '';
  };

  $('schemaClear').onclick = () => {
    $('schemaJson').value=''; $('schemaSchema').value='';
    $('schemaResult').textContent='Preencha os painéis e clique em Validar…';
    $('schemaResult').className='';
  };
})();

// ══════════════════════════════════════════════════════
//  CRON / QUARTZ
// ══════════════════════════════════════════════════════
(function() {
  const fields = ['cronSec','cronMin','cronHour','cronDay','cronMonth','cronDayOfWeek'];

  function getExpr() {
    return fields.map(id => $(id).value.trim()||'*').join(' ');
  }

  function setFields(expr) {
    const parts = expr.trim().split(/\s+/);
    if (parts.length >= 6) {
      fields.forEach((id,i) => $(id).value = parts[i]);
    }
  }

  function expandField(f, lo, hi) {
    if (f==='*'||f==='?') return Array.from({length:hi-lo+1},(_,i)=>lo+i);
    const vals = new Set();
    f.split(',').forEach(p => {
      if (p.includes('/')) {
        const [rng, step] = p.split('/');
        const [a,b] = rng==='*' ? [lo,hi] : rng.includes('-') ? rng.split('-').map(Number) : [+rng,hi];
        for (let i=a;i<=b;i+=+step) if(i>=lo&&i<=hi) vals.add(i);
      } else if (p.includes('-')) {
        const [a,b]=p.split('-').map(Number);
        for(let i=a;i<=b;i++) vals.add(i);
      } else if (!isNaN(+p)) vals.add(+p);
    });
    return [...vals].sort((a,b)=>a-b);
  }

  function nextExecutions(expr, count=8) {
    try {
      const parts = expr.trim().split(/\s+/);
      if (parts.length < 6) return [];
      const [sec,min,hour,day,month,dow] = parts;
      const secV   = expandField(sec,0,59);
      const minV   = expandField(min,0,59);
      const hourV  = expandField(hour,0,23);
      const dayV   = day==='?'  ? null : expandField(day,1,31);
      const monV   = expandField(month,1,12);
      const dowV   = dow==='?'  ? null : expandField(dow,0,6);
      const results=[], cur=new Date(); cur.setMilliseconds(0); cur.setSeconds(cur.getSeconds()+1);
      while (results.length<count && cur.getFullYear()<2100) {
        if (!monV.includes(cur.getMonth()+1)) { cur.setMonth(cur.getMonth()+1); cur.setDate(1); cur.setHours(0,0,0); continue; }
        const dOk = !dayV || dayV.includes(cur.getDate());
        const wOk = !dowV || dowV.includes(cur.getDay());
        if (!dOk&&!wOk) { cur.setDate(cur.getDate()+1); cur.setHours(0,0,0,0); continue; }
        if (!hourV.includes(cur.getHours())) { cur.setHours(cur.getHours()+1); cur.setMinutes(0,0,0); continue; }
        if (!minV.includes(cur.getMinutes())) { cur.setMinutes(cur.getMinutes()+1); cur.setSeconds(0,0); continue; }
        if (!secV.includes(cur.getSeconds())) { cur.setSeconds(cur.getSeconds()+1); continue; }
        results.push(new Date(cur)); cur.setSeconds(cur.getSeconds()+1);
      }
      return results;
    } catch { return []; }
  }

  function describeExpr(expr) {
    const [s,m,h,d,mo,dow] = expr.trim().split(/\s+/);
    if (s==='0'&&m==='*'&&h==='*') return 'A cada minuto';
    if (s==='0'&&m==='0'&&h==='*'&&(dow==='?'||dow==='*')) return 'A cada hora (no minuto 00)';
    if (s==='0'&&m==='0'&&h==='0'&&(dow==='?'||dow==='*')) return 'Todo dia à meia-noite (00:00)';
    if (s==='0'&&m==='0'&&h==='12') return 'Todo dia ao meio-dia (12:00)';
    if (s==='0'&&m==='0'&&h==='9'&&(dow==='1-5'||dow==='MON-FRI')) return 'Seg–Sex às 09:00';
    if (s==='0'&&m==='0'&&h==='9'&&dow==='1') return 'Toda segunda-feira às 09:00';
    return 'Expressão personalizada';
  }

  function updatePreview() {
    const expr = getExpr();
    $('cronExpression').textContent = expr;
    const execs = nextExecutions(expr);
    const desc  = describeExpr(expr);
    $('cronPreview').textContent = desc + '\n\nPróximas execuções:\n' +
      (execs.length ? execs.map(d=>`• ${d.toLocaleString('pt-BR')}`).join('\n') : 'Nenhuma encontrada');
    save('cronExpr', expr);
  }

  fields.forEach(id => $(id).addEventListener('input', updatePreview));

  const PRESETS = {
    cronEveryMin:      ['0','*','*','*','*','?'],
    cronEveryHour:     ['0','0','*','*','*','?'],
    cronEveryday:      ['0','0','0','*','*','?'],
    cronAtNoon:        ['0','0','12','*','*','?'],
    cronEveryWeekday:  ['0','0','9','*','*','1-5'],
    cronEveryMonday:   ['0','0','9','*','*','1'],
  };
  Object.entries(PRESETS).forEach(([id, vals]) => {
    $(id).onclick = () => { fields.forEach((f,i) => $(f).value=vals[i]); updatePreview(); };
  });

  function loadCronExpr(expr) {
    setFields(expr); $('cronExprInput').value=expr; updatePreview();
  }
  window.loadCronExpr = loadCronExpr;

  $('cronExprInput').addEventListener('input', debounce(() => {
    const expr = $('cronExprInput').value.trim();
    if (!expr) return;
    setFields(expr); updatePreview();
  }, 300));

  $('cronCopy').onclick = () => copy($('cronExpression').textContent);
  $('cronClear').onclick = () => {
    fields.forEach((id,i) => $(id).value = ['0','0','*','*','*','?'][i]);
    $('cronExprInput').value=''; updatePreview();
  };

  updatePreview();
})();

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

// ══════════════════════════════════════════════════════
//  DIAGRAM EDITOR — AUTOMATOS (Figma/draw.io style)
// ══════════════════════════════════════════════════════
(function() {
  const canvas   = $('diagramCanvas');
  const ctx      = canvas.getContext('2d');
  const wrap     = $('diagramCanvasWrap');
  const labelEl  = $('diagramLabelInput');

  // ── State
  let shapes  = [], nextId = 1;
  let mode    = 'select';
  let sel     = null;
  let drag    = null;        // { shape, ox, oy }
  let resizeH = null;        // { shape, handle }
  let panSt   = null;        // { rx, ry, vx, vy }
  let drawSt  = null;        // { x, y, cx, cy }
  let editSh  = null;
  let viewX   = 0, viewY = 0, zoom = 1;

  const HS = 6;   // handle half-size
  const GRID = 10;

  // ── Canvas resize
  function resizeCanvas() {
    const w = wrap.offsetWidth, h = wrap.offsetHeight;
    if (!w || !h) return;
    canvas.width  = w; canvas.height = h;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    draw();
  }
  window.addEventListener('diagram-visible', () => requestAnimationFrame(() => requestAnimationFrame(resizeCanvas)));
  new ResizeObserver(() => { if (wrap.offsetWidth) resizeCanvas(); }).observe(wrap);

  // Make canvas focusable so keyboard events work
  canvas.setAttribute('tabindex', '0');

  // ── Tools
  document.querySelectorAll('.dtool[data-mode]').forEach(btn => {
    btn.onclick = () => { commitLabel(); setMode(btn.dataset.mode); };
  });

  function setMode(m) {
    mode = m;
    document.querySelectorAll('.dtool[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode===m));
    $('dModeLabel').textContent = {select:'',rect:'Retângulo',circle:'Elipse',diamond:'Diamante',arrow:'Seta',text:'Texto'}[m]||'';
    canvas.style.cursor = m==='select' ? 'default' : 'crosshair';
  }
  setMode('select');

  // ── Zoom
  $('dZoomIn').onclick    = () => { zoom = Math.min(3, zoom+0.15); draw(); };
  $('dZoomOut').onclick   = () => { zoom = Math.max(0.25, zoom-0.15); draw(); };
  $('dZoomReset').onclick = () => { zoom=1; viewX=0; viewY=0; draw(); };

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    zoom = clamp(zoom * factor, 0.25, 3);
    draw();
  }, {passive: false});

  // ── Grid snap
  function snap(v) { return Math.round(v / GRID) * GRID; }

  // ── Coordinate helpers
  function toWorld(cx, cy) { return { x: (cx - viewX) / zoom, y: (cy - viewY) / zoom }; }

  function mouseWXY(e) {
    const r = canvas.getBoundingClientRect();
    return toWorld(e.clientX - r.left, e.clientY - r.top);
  }
  function mouseRaw(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // ── Hit testing
  function hitShape(wx, wy) {
    for (let i = shapes.length-1; i>=0; i--) {
      const s = shapes[i];
      if (s.type==='arrow') {
        const dx=s.x2-s.x1, dy=s.y2-s.y1, len=Math.hypot(dx,dy);
        if (len<1) continue;
        const t = ((wx-s.x1)*dx+(wy-s.y1)*dy)/(len*len);
        if (t<0||t>1) continue;
        if (Math.hypot(wx-s.x1-t*dx, wy-s.y1-t*dy) < 8/zoom) return s;
      } else if (s.type==='text') {
        if (wx>=s.x-4 && wx<=s.x+s.w+4 && wy>=s.y-4 && wy<=s.y+s.h+4) return s;
      } else {
        if (wx>=s.x && wx<=s.x+s.w && wy>=s.y && wy<=s.y+s.h) return s;
      }
    }
    return null;
  }

  function getHandles(s) {
    if (!s || s.type==='arrow' || s.type==='text') return [];
    const {x,y,w,h} = s;
    return [
      {id:'nw',cx:x,cy:y},{id:'n',cx:x+w/2,cy:y},{id:'ne',cx:x+w,cy:y},
      {id:'e',cx:x+w,cy:y+h/2},{id:'se',cx:x+w,cy:y+h},
      {id:'s',cx:x+w/2,cy:y+h},{id:'sw',cx:x,cy:y+h},{id:'w',cx:x,cy:y+h/2}
    ];
  }

  function hitHandle(wx, wy, s) {
    const tol = HS / zoom + 2;
    for (const h of getHandles(s))
      if (Math.abs(wx-h.cx)<=tol && Math.abs(wy-h.cy)<=tol) return h;
    return null;
  }

  // ── Draw
  function draw() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0,0,W,H);

    // Dot grid
    const gap  = GRID * zoom;
    const offX = ((viewX % gap) + gap) % gap;
    const offY = ((viewY % gap) + gap) % gap;
    ctx.fillStyle = '#dde1e7';
    for (let gx=offX; gx<W; gx+=gap)
      for (let gy=offY; gy<H; gy+=gap)
        ctx.fillRect(gx-0.75, gy-0.75, 1.5, 1.5);

    ctx.save();
    ctx.translate(viewX, viewY);
    ctx.scale(zoom, zoom);

    const order = [...shapes.filter(s=>s!==sel), ...(sel?[sel]:[])];
    order.forEach(s => drawShape(s));

    // Draw preview
    if (drawSt && mode!=='select') drawPreview();

    ctx.restore();
  }

  function drawShape(s) {
    const isSel = s===sel;
    ctx.save();

    if (s.type==='arrow') {
      ctx.strokeStyle = isSel ? '#0EA5E9' : (s.color||'#374151');
      ctx.lineWidth   = (isSel ? 2.5 : 2) / zoom;
      ctx.lineCap     = 'round';
      ctx.beginPath(); ctx.moveTo(s.x1,s.y1); ctx.lineTo(s.x2,s.y2); ctx.stroke();
      const angle = Math.atan2(s.y2-s.y1, s.x2-s.x1);
      const hs = 12/zoom;
      ctx.fillStyle = isSel ? '#0EA5E9' : (s.color||'#374151');
      ctx.beginPath();
      ctx.moveTo(s.x2,s.y2);
      ctx.lineTo(s.x2-hs*Math.cos(angle-0.45), s.y2-hs*Math.sin(angle-0.45));
      ctx.lineTo(s.x2-hs*Math.cos(angle+0.45), s.y2-hs*Math.sin(angle+0.45));
      ctx.closePath(); ctx.fill();
      if (isSel) {
        ctx.fillStyle='#0EA5E9';
        [[s.x1,s.y1],[s.x2,s.y2]].forEach(([px,py])=>{
          ctx.beginPath(); ctx.arc(px,py,5/zoom,0,Math.PI*2); ctx.fill();
        });
      }

    } else if (s.type==='text') {
      if (s!==editSh) {
        ctx.font = `${(s.fontSize||14)}px system-ui, sans-serif`;
        ctx.fillStyle = s.color || '#111827';
        ctx.textBaseline = 'top';
        ctx.fillText(s.label||'Texto', s.x, s.y);
      }
      if (isSel) {
        ctx.strokeStyle='#0EA5E9'; ctx.lineWidth=1/zoom; ctx.setLineDash([4/zoom,2/zoom]);
        ctx.strokeRect(s.x-2, s.y-2, s.w+4, s.h+4);
        ctx.setLineDash([]);
      }

    } else {
      // Shadow
      if (isSel) { ctx.shadowColor='rgba(14,165,233,.25)'; ctx.shadowBlur=10/zoom; }
      ctx.fillStyle   = s.color || '#ffffff';
      ctx.strokeStyle = isSel ? '#0EA5E9' : '#9ca3af';
      ctx.lineWidth   = (isSel ? 2 : 1.5) / zoom;

      if (s.type==='rect') {
        ctx.beginPath(); ctx.roundRect(s.x,s.y,s.w,s.h,4/zoom); ctx.fill(); ctx.stroke();
      } else if (s.type==='circle') {
        ctx.beginPath(); ctx.ellipse(s.x+s.w/2,s.y+s.h/2,s.w/2,s.h/2,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
      } else if (s.type==='diamond') {
        const cx=s.x+s.w/2, cy=s.y+s.h/2;
        ctx.beginPath(); ctx.moveTo(cx,s.y); ctx.lineTo(s.x+s.w,cy); ctx.lineTo(cx,s.y+s.h); ctx.lineTo(s.x,cy); ctx.closePath(); ctx.fill(); ctx.stroke();
      }

      ctx.shadowColor='transparent'; ctx.shadowBlur=0;

      // Label
      if (s.label && s!==editSh) {
        ctx.fillStyle   = isColorDark(s.color) ? '#f1f5f9' : '#111827';
        ctx.font        = `${13/zoom}px system-ui, sans-serif`;
        ctx.textAlign   = 'center'; ctx.textBaseline='middle';
        ctx.save();
        ctx.beginPath();
        if (s.type==='rect') ctx.roundRect(s.x+2,s.y+2,s.w-4,s.h-4,4/zoom);
        else if (s.type==='circle') ctx.ellipse(s.x+s.w/2,s.y+s.h/2,s.w/2-2,s.h/2-2,0,0,Math.PI*2);
        else ctx.rect(s.x,s.y,s.w,s.h);
        ctx.clip();
        ctx.fillText(s.label, s.x+s.w/2, s.y+s.h/2, (s.w-8));
        ctx.restore();
      }

      // Resize handles
      if (isSel) {
        getHandles(s).forEach(h => {
          ctx.fillStyle='#fff'; ctx.strokeStyle='#0EA5E9'; ctx.lineWidth=1.5/zoom;
          ctx.shadowColor='transparent';
          ctx.fillRect(h.cx-HS/zoom, h.cy-HS/zoom, HS*2/zoom, HS*2/zoom);
          ctx.strokeRect(h.cx-HS/zoom, h.cy-HS/zoom, HS*2/zoom, HS*2/zoom);
        });
      }
    }
    ctx.restore();
  }

  function isColorDark(hex) {
    if (!hex || hex==='#ffffff') return false;
    const r=parseInt(hex.slice(1,3)||'ff',16), g=parseInt(hex.slice(3,5)||'ff',16), b=parseInt(hex.slice(5,7)||'ff',16);
    return (0.299*r + 0.587*g + 0.114*b) < 100;
  }

  function drawPreview() {
    const {x:x1,y:y1,cx,cy} = drawSt;
    ctx.save();
    ctx.strokeStyle='#0EA5E9'; ctx.lineWidth=1.5/zoom;
    ctx.setLineDash([5/zoom,3/zoom]);
    ctx.fillStyle='rgba(14,165,233,.07)';

    if (mode==='arrow') {
      ctx.setLineDash([]); ctx.lineWidth=2/zoom; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(cx,cy); ctx.stroke();
    } else if (mode==='rect') {
      ctx.fillRect(Math.min(x1,cx),Math.min(y1,cy),Math.abs(cx-x1),Math.abs(cy-y1));
      ctx.strokeRect(Math.min(x1,cx),Math.min(y1,cy),Math.abs(cx-x1),Math.abs(cy-y1));
    } else if (mode==='circle') {
      ctx.beginPath(); ctx.ellipse((x1+cx)/2,(y1+cy)/2,Math.abs(cx-x1)/2,Math.abs(cy-y1)/2,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
    } else if (mode==='diamond') {
      const mx=(x1+cx)/2, my=(y1+cy)/2;
      ctx.beginPath(); ctx.moveTo(mx,y1); ctx.lineTo(cx,my); ctx.lineTo(mx,cy); ctx.lineTo(x1,my); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  // ── Mouse events
  canvas.addEventListener('mousedown', e => {
    if (editSh) { commitLabel(); return; }
    canvas.focus();
    const {x,y} = mouseWXY(e);
    const raw   = mouseRaw(e);

    if (mode==='select') {
      if (sel) {
        // Arrow endpoint drag
        if (sel.type==='arrow') {
          if (Math.hypot(x-sel.x1,y-sel.y1)<10/zoom) { drag={shape:sel,end:'start'}; return; }
          if (Math.hypot(x-sel.x2,y-sel.y2)<10/zoom) { drag={shape:sel,end:'end'}; return; }
        }
        const h = hitHandle(x,y,sel);
        if (h) { resizeH={shape:sel,handle:h,origShape:{...sel}}; return; }
      }
      const hit = hitShape(x,y);
      if (hit) {
        sel = hit;
        showColorPicker(hit);
        const ox = hit.type==='arrow' ? x-hit.x1 : x-hit.x;
        const oy = hit.type==='arrow' ? y-hit.y1 : y-hit.y;
        drag = {shape:hit, ox, oy};
        draw();
      } else {
        sel=null; hideColorPicker(); draw();
        panSt={rx:raw.x,ry:raw.y,vx:viewX,vy:viewY};
      }
    } else {
      drawSt={x:snap(x),y:snap(y),cx:snap(x),cy:snap(y)};
    }
  });

  canvas.addEventListener('mousemove', e => {
    const {x,y} = mouseWXY(e);
    const raw   = mouseRaw(e);

    if (resizeH) {
      const {shape:s, handle:h} = resizeH;
      const nx=snap(x), ny=snap(y);
      const orig = resizeH.origShape;
      if (h.id.includes('e')) s.w = Math.max(40, nx - s.x);
      if (h.id.includes('s')) s.h = Math.max(30, ny - s.y);
      if (h.id.includes('w')) { const r=orig.x+orig.w; s.x=Math.min(nx,r-40); s.w=r-s.x; }
      if (h.id.includes('n')) { const b=orig.y+orig.h; s.y=Math.min(ny,b-30); s.h=b-s.y; }
      draw(); return;
    }

    if (drag) {
      const {shape:s, ox, oy} = drag;
      if (s.type==='arrow') {
        if (drag.end==='start') { s.x1=snap(x); s.y1=snap(y); }
        else if (drag.end==='end')  { s.x2=snap(x); s.y2=snap(y); }
        else { const dx=snap(x-ox)-s.x1, dy=snap(y-oy)-s.y1; s.x1+=dx; s.y1+=dy; s.x2+=dx; s.y2+=dy; }
      } else { s.x=snap(x-ox); s.y=snap(y-oy); }
      draw(); return;
    }

    if (panSt) {
      viewX = panSt.vx + raw.x - panSt.rx;
      viewY = panSt.vy + raw.y - panSt.ry;
      draw(); return;
    }

    if (drawSt) { drawSt.cx=snap(x); drawSt.cy=snap(y); draw(); return; }

    // Cursor update
    if (mode==='select') {
      if (sel) {
        const h = hitHandle(x,y,sel);
        if (h) {
          const cursors={n:'n-resize',s:'s-resize',e:'e-resize',w:'w-resize',ne:'ne-resize',nw:'nw-resize',se:'se-resize',sw:'sw-resize'};
          canvas.style.cursor=cursors[h.id]||'pointer'; return;
        }
      }
      canvas.style.cursor = hitShape(x,y) ? 'move' : 'default';
    }
  });

  canvas.addEventListener('mouseup', e => {
    const {x,y}=mouseWXY(e);

    if (resizeH) { resizeH=null; saveDiagram(); return; }
    if (drag) { drag=null; saveDiagram(); return; }
    if (panSt) { panSt=null; return; }

    if (drawSt) {
      const x1=Math.min(drawSt.x,snap(x)), y1=Math.min(drawSt.y,snap(y));
      const x2=Math.max(drawSt.x,snap(x)), y2=Math.max(drawSt.y,snap(y));
      const w=x2-x1, h=y2-y1;
      let newShape=null;

      if (mode==='arrow' && Math.hypot(snap(x)-drawSt.x,snap(y)-drawSt.y)>15) {
        newShape={id:nextId++,type:'arrow',x1:drawSt.x,y1:drawSt.y,x2:snap(x),y2:snap(y),color:'#374151'};
      } else if (mode==='text') {
        const tx=snap(x), ty=snap(y);
        newShape={id:nextId++,type:'text',x:tx,y:ty,w:100,h:20,label:'Texto',color:'#111827',fontSize:14};
      } else if (w>20 && h>20) {
        const labels={rect:'Estado',circle:'Estado',diamond:'Decisão'};
        newShape={id:nextId++,type:mode,x:x1,y:y1,w,h,label:labels[mode]||'',color:'#ffffff'};
      }

      if (newShape) {
        shapes.push(newShape); sel=newShape;
        showColorPicker(newShape);
        if (newShape.type!=='arrow') setTimeout(()=>openLabelEditor(newShape),50);
      }

      drawSt=null; setMode('select'); saveDiagram(); draw();
    }
  });

  canvas.addEventListener('mouseleave', () => { if (drag) { drag=null; saveDiagram(); } });

  canvas.addEventListener('dblclick', e => {
    const {x,y}=mouseWXY(e);
    const hit=hitShape(x,y);
    if (hit && hit.type!=='arrow') { sel=hit; openLabelEditor(hit); draw(); }
  });

  // ── Label editor
  function openLabelEditor(s) {
    editSh=s;
    const bx=s.x*zoom+viewX, by=s.y*zoom+viewY;
    const bw = (s.w||80)*zoom;
    labelEl.style.display='block';
    labelEl.style.left   = (bx + bw/2 - Math.max(80,bw-10)/2) + 'px';
    labelEl.style.top    = (by + (s.h||20)*zoom/2 - 14) + 'px';
    labelEl.style.width  = Math.max(80, bw-10) + 'px';
    labelEl.value = s.label||'';
    labelEl.focus(); labelEl.select();
  }

  function commitLabel() {
    if (!editSh) return;
    editSh.label=labelEl.value;
    // Update text shape width
    if (editSh.type==='text') {
      ctx.font=`${editSh.fontSize||14}px system-ui,sans-serif`;
      editSh.w=Math.max(20, ctx.measureText(editSh.label).width+4);
    }
    editSh=null; labelEl.style.display='none';
    saveDiagram(); draw();
  }

  labelEl.addEventListener('keydown', e => {
    if (e.key==='Enter') { e.preventDefault(); commitLabel(); }
    if (e.key==='Escape') { editSh=null; labelEl.style.display='none'; draw(); }
  });
  labelEl.addEventListener('blur', () => { if (editSh) commitLabel(); });

  // ── Color picker
  function showColorPicker(s) {
    if (!s||s.type==='arrow') { hideColorPicker(); return; }
    $('dColorPick').style.display='flex';
    const c=s.color||'#ffffff';
    document.querySelectorAll('.d-swatch').forEach(sw=>sw.classList.toggle('sel',sw.dataset.color===c));
    $('dColorNative').value=c.startsWith('#')&&c.length===7?c:'#ffffff';
  }
  function hideColorPicker() { $('dColorPick').style.display='none'; }

  document.querySelectorAll('.d-swatch').forEach(sw => {
    sw.onclick=()=>{
      if(!sel||sel.type==='arrow') return;
      sel.color=sw.dataset.color;
      document.querySelectorAll('.d-swatch').forEach(s=>s.classList.remove('sel'));
      sw.classList.add('sel');
      $('dColorNative').value=sw.dataset.color;
      saveDiagram(); draw();
    };
  });

  $('dColorNative').addEventListener('input', () => {
    if (!sel||sel.type==='arrow') return;
    sel.color=$('dColorNative').value;
    saveDiagram(); draw();
  });

  // ── Delete / Clear
  $('dDelete').onclick = () => {
    if (sel) { shapes=shapes.filter(s=>s!==sel); sel=null; hideColorPicker(); saveDiagram(); draw(); }
  };
  $('dClear').onclick = () => {
    if (confirm('Limpar todos os elementos?')) {
      shapes=[]; sel=null; nextId=1; hideColorPicker(); saveDiagram(); draw();
    }
  };

  // ── Export PNG
  $('dExport').onclick = () => {
    const tmp=document.createElement('canvas');
    tmp.width=canvas.width; tmp.height=canvas.height;
    const tc=tmp.getContext('2d');
    tc.fillStyle='#ffffff'; tc.fillRect(0,0,tmp.width,tmp.height);
    tc.drawImage(canvas,0,0);
    const a=document.createElement('a');
    a.download='automatos.png'; a.href=tmp.toDataURL('image/png'); a.click();
  };

  // ── Keyboard shortcuts (canvas must be focused OR body)
  document.addEventListener('keydown', e => {
    const active=document.activeElement;
    const onCanvas = active===canvas || active===document.body;
    if (!onCanvas && active!==document.body) return;

    if (document.querySelector('#diagramView.hidden')) return; // only when visible

    if ((e.key==='Delete'||e.key==='Backspace') && sel && !editSh) {
      e.preventDefault();
      shapes=shapes.filter(s=>s!==sel); sel=null; hideColorPicker(); saveDiagram(); draw();
    }
    if (!e.ctrlKey && !e.metaKey) {
      const modeMap={v:'select',r:'rect',e:'circle',d:'diamond',a:'arrow',t:'text'};
      if (modeMap[e.key.toLowerCase()]) { commitLabel(); setMode(modeMap[e.key.toLowerCase()]); }
    }
    if (e.key==='Escape') { commitLabel(); setMode('select'); }
    if (e.key==='+') { zoom=Math.min(3,zoom+0.15); draw(); }
    if (e.key==='-') { zoom=Math.max(0.25,zoom-0.15); draw(); }
    if (e.key==='0') { zoom=1; viewX=0; viewY=0; draw(); }
    // Arrow nudge
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key) && sel) {
      e.preventDefault();
      const d=e.shiftKey?10:1;
      if (sel.type==='arrow') { sel.x1+=e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0; sel.y1+=e.key==='ArrowUp'?-d:e.key==='ArrowDown'?d:0; sel.x2+=e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0; sel.y2+=e.key==='ArrowUp'?-d:e.key==='ArrowDown'?d:0; }
      else { sel.x+=e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0; sel.y+=e.key==='ArrowUp'?-d:e.key==='ArrowDown'?d:0; }
      saveDiagram(); draw();
    }
  });

  // ── Persist
  function saveDiagram() {
    chrome.storage.local.set({diagram: JSON.stringify({shapes,nextId,viewX,viewY,zoom})});
  }

  chrome.storage.local.get(['diagram'], r => {
    if (r.diagram) {
      try {
        const d=JSON.parse(r.diagram);
        shapes=d.shapes||[]; nextId=d.nextId||1;
        viewX=d.viewX||0; viewY=d.viewY||0; zoom=d.zoom||1;
      } catch {}
    }
    draw();
  });

  setMode('select');
})();

// ══════════════════════════════════════════════════════
//  GLOBAL KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && e.key==='F') { e.preventDefault(); $('formatJson').click(); }
  if (e.ctrlKey && !e.shiftKey && !e.altKey) {
    const map={'1':'json','2':'diff','3':'mock','4':'playground','5':'diagram',
               '6':'base64','7':'url','8':'jwt','9':'regex'};
    if (map[e.key]) { e.preventDefault(); switchView(map[e.key]); }
  }
});