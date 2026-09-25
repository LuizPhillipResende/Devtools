'use strict';
// ── NAVIGATION & INITIAL STATE ────────────────────────

const VIEWS_ALL = [
  'json','diff','mock','playground','diagram','productivity',
  'qrcode',
  'base64','url','jwt','regex','timestamp','cron',
  'uuid','hash','color','jsonschema','settings'
];

function switchView(view) {
  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.view === view)
  );
  VIEWS_ALL.forEach(v => {
    const el = $(v + 'View');
    if (el) el.classList.toggle('hidden', v !== view);
  });
  save('lastView', view);
  if (view === 'diagram') window.dispatchEvent(new CustomEvent('diagram-visible'));
  if (view === 'diff' && window.renderDiff) window.renderDiff();
}
window.switchView = switchView;

function loadSavedState() {
  window.appStorage.get(null, r => {
    if (r.json)           { const el=$('jsonEditor');      if(el) el.value=r.json; }
    if (r.diffA)          { const el=$('diffA');           if(el) el.value=r.diffA; }
    if (r.diffB)          { const el=$('diffB');           if(el) el.value=r.diffB; }
    if (r.b64In)          { const el=$('b64Input');        if(el) el.value=r.b64In; }
    if (r.urlIn)          { const el=$('urlInput');        if(el) el.value=r.urlIn; }
    if (r.jwtIn)          { const el=$('jwtInput');        if(el){ el.value=r.jwtIn; if(window.decodeJWT) decodeJWT(r.jwtIn); } }
    if (r.regexPat)       { const el=$('regexPattern');    if(el) el.value=r.regexPat; }
    if (r.regexFlags)     { const el=$('regexFlags');      if(el) el.value=r.regexFlags; }
    if (r.regexText)      { const el=$('regexText');       if(el) el.value=r.regexText; }
    if (r.tsUnix)         { const el=$('tsUnix');          if(el) el.value=r.tsUnix; }
    if (r.uuidOutput)     { const el=$('uuidOutput');      if(el) el.value=r.uuidOutput; }
    if (r.hashInput)      { const el=$('hashInput');       if(el){ el.value=r.hashInput; if(window.recomputeHash) recomputeHash(r.hashInput); } }
    if (r.playgroundCode) { const el=$('playgroundCode');  if(el) el.value=r.playgroundCode; }
    if (r.colorHex)       { const el=$('colorHex');        if(el){ el.value=r.colorHex; if(window.updateColorFromHex) updateColorFromHex(r.colorHex); } }
    if (r.cronExpr)       { if (window.loadCronExpr) loadCronExpr(r.cronExpr); }

    fetch('mock.html')
      .then(res => res.text())
      .then(html => { const el=$('mockEditor'); if(el) el.value = r.mock ?? html; })
      .catch(() => { const el=$('mockEditor'); if(el) el.value = r.mock ?? ''; });

    if (r.diffA || r.diffB) { if (window.renderDiff) renderDiff(); }
    if (r.regexText)         { if (window.runRegex)   runRegex(); }

    if (window.applySettings)    applySettings(r);
    if (window.loadProductivity) loadProductivity(r);

    // Handle clear all button
    const clearBtn = $('settingsClearAll');
    if (clearBtn) {
      clearBtn.onclick = () => {
        if (confirm('Limpar TODOS os dados salvos? Esta ação é irreversível.')) {
          window.appStorage.clear(() => { toast('✓ Dados limpos', 'ok'); });
        }
      };
    }

    switchView(r.lastView || 'json');
  });
}

document.querySelectorAll('.nav-item[data-view]').forEach(item => {
  item.onclick = () => switchView(item.dataset.view);
});

// Quick Search / Palette in Header
const searchInput = $('globalToolSearch');
if (searchInput) {
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase().trim();
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      const txt = item.textContent.toLowerCase();
      item.style.display = txt.includes(q) ? 'flex' : 'none';
    });
  });

  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const firstVisible = document.querySelector('.nav-item[data-view]:not([style*="display: none"])');
      if (firstVisible) {
        switchView(firstVisible.dataset.view);
        searchInput.blur();
      }
    }
    if (e.key === 'Escape') {
      searchInput.value = '';
      document.querySelectorAll('.nav-item[data-view]').forEach(item => item.style.display = 'flex');
      searchInput.blur();
    }
  });
}

// Global shortcut Ctrl+K to focus search
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (searchInput) { searchInput.focus(); searchInput.select(); }
  }
});

// Window controls (fallback)
if (window.electronAPI) {
  const minBtn = $('winMinBtn');
  const maxBtn = $('winMaxBtn');
  const closeBtn = $('winCloseBtn');
  if (minBtn) minBtn.onclick = () => window.electronAPI.minimize();
  if (maxBtn) maxBtn.onclick = () => window.electronAPI.maximize();
  if (closeBtn) closeBtn.onclick = () => window.electronAPI.close();
}

document.addEventListener('DOMContentLoaded', loadSavedState);
