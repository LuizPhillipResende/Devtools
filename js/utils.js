'use strict';
// ── SHARED UTILITIES (loaded first) ──────────────────

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
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
