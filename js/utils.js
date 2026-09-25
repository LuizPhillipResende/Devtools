'use strict';
// ── SHARED UTILITIES & DESKTOP BRIDGE (loaded first) ──

const $ = id => document.getElementById(id);

function toast(msg, type = 'ok') {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'show ' + type;
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.className = ''; }, 2200);
}

function copy(text, msg = '✓ Copiado') {
  if (!text && text !== '') return;
  if (window.electronAPI?.writeClipboardText) {
    window.electronAPI.writeClipboardText(String(text));
    toast(msg, 'ok');
    return;
  }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(String(text)).then(() => toast(msg, 'ok'));
  }
}

// ── Universal Storage Bridge (Electron AppData + LocalStorage + Chrome Storage) ──
window.appStorage = {
  get: function(keys, callback) {
    if (window.electronAPI?.storageGet) {
      window.electronAPI.storageGet(keys).then(res => {
        if (callback) callback(res || {});
      });
      return;
    }
    if (typeof chrome !== 'undefined' && chrome.storage?.local && chrome.storage.local !== window.appStorage) {
      chrome.storage.local.get(keys, callback);
      return;
    }
    const res = {};
    if (!keys) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        try { res[k] = JSON.parse(localStorage.getItem(k)); } catch { res[k] = localStorage.getItem(k); }
      }
    } else if (typeof keys === 'string') {
      try { res[keys] = JSON.parse(localStorage.getItem(keys)); } catch { res[keys] = localStorage.getItem(keys); }
    } else if (Array.isArray(keys)) {
      keys.forEach(k => {
        try { res[k] = JSON.parse(localStorage.getItem(k)); } catch { res[k] = localStorage.getItem(k); }
      });
    }
    if (callback) callback(res);
  },
  set: function(items, callback) {
    if (items && typeof items === 'object') {
      Object.entries(items).forEach(([k, v]) => {
        try {
          localStorage.setItem(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
        } catch {}
      });
    }
    if (window.electronAPI?.storageSet) {
      window.electronAPI.storageSet(items).then(() => {
        if (callback) callback();
      });
      return;
    }
    if (typeof chrome !== 'undefined' && chrome.storage?.local && chrome.storage.local !== window.appStorage) {
      chrome.storage.local.set(items, callback);
      return;
    }
    if (callback) callback();
  },
  clear: function(callback) {
    localStorage.clear();
    if (window.electronAPI?.storageClear) {
      window.electronAPI.storageClear().then(() => {
        if (callback) callback();
      });
      return;
    }
    if (typeof chrome !== 'undefined' && chrome.storage?.local && chrome.storage.local !== window.appStorage) {
      chrome.storage.local.clear(callback);
      return;
    }
    if (callback) callback();
  }
};

// Polyfill chrome.storage.local so all existing code works transparently
if (typeof window.chrome === 'undefined' || !window.chrome.storage) {
  window.chrome = window.chrome || {};
  window.chrome.storage = {
    local: window.appStorage
  };
}

function save(key, val) {
  window.appStorage.set({ [key]: val });
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

// ── Native File Dialogs (Desktop with Web Fallback) ──
async function chooseFileFromComputer(options = {}) {
  const { title = 'Abrir Arquivo', filters = [], accept = '*/*', readAs = 'utf8' } = options;
  if (window.electronAPI?.openFileDialog) {
    const res = await window.electronAPI.openFileDialog({ title, filters, readAs });
    if (res.canceled) return null;
    if (res.error) {
      toast('Erro ao abrir arquivo: ' + res.error, 'del');
      return null;
    }
    return res; // { filePath, fileName, content }
  }

  // Browser input fallback
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = ev => {
        let content = ev.target.result;
        if (readAs === 'base64') {
          // Remove data:*/*;base64, prefix if needed or keep
          const idx = content.indexOf(',');
          content = idx >= 0 ? content.slice(idx + 1) : content;
        }
        resolve({
          filePath: file.name,
          fileName: file.name,
          content
        });
      };
      if (readAs === 'base64') {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    };
    input.click();
  });
}

async function saveFileToComputer(options = {}) {
  const {
    title = 'Salvar Arquivo',
    defaultPath = 'arquivo.txt',
    filters = [],
    content = '',
    mimeType = 'text/plain;charset=utf-8',
    isBase64 = false
  } = options;

  if (window.electronAPI?.saveFileDialog) {
    const res = await window.electronAPI.saveFileDialog({ title, defaultPath, filters, content, isBase64 });
    if (res.canceled) return null;
    if (res.error) {
      toast('Erro ao salvar: ' + res.error, 'del');
      return null;
    }
    toast('✓ Arquivo salvo em ' + res.fileName, 'ok');
    return res;
  }

  // Browser download fallback
  try {
    let blob;
    if (isBase64) {
      const byteChars = atob(content);
      const byteNums = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
      blob = new Blob([new Uint8Array(byteNums)], { type: mimeType });
    } else {
      blob = new Blob([content], { type: mimeType });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultPath.split(/[/\\]/).pop() || 'download';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('✓ Download iniciado: ' + a.download, 'ok');
    return { fileName: a.download };
  } catch (err) {
    toast('Erro ao salvar: ' + err.message, 'del');
    return null;
  }
}
