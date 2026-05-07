'use strict';
// ── NAVIGATION & INITIAL STATE ────────────────────────

const VIEWS_ALL = [
  'json','diff','mock','playground','diagram','productivity',
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
}
window.switchView = switchView;

function loadSavedState() {
  chrome.storage.local.get(null, r => {
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

    if (window.applySettings)   applySettings(r);
    if (window.loadProductivity) loadProductivity(r);

    // Handle clear all button
    const clearBtn = $('settingsClearAll');
    if (clearBtn) {
      clearBtn.onclick = () => {
        if (confirm('Limpar TODOS os dados salvos? Esta ação é irreversível.')) {
          chrome.storage.local.clear(() => { toast('✓ Dados limpos', 'ok'); });
        }
      };
    }

    switchView(r.lastView || 'json');
  });
}

document.querySelectorAll('.nav-item[data-view]').forEach(item => {
  item.onclick = () => switchView(item.dataset.view);
});

document.addEventListener('DOMContentLoaded', loadSavedState);
