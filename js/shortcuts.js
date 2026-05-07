'use strict';
// ── GLOBAL KEYBOARD SHORTCUTS ─────────────────────────

document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && e.key === 'F') {
    e.preventDefault(); $('formatJson')?.click();
  }
  if (e.ctrlKey && !e.shiftKey && !e.altKey) {
    const map = {
      '1':'json', '2':'diff', '3':'mock',
      '4':'playground', '5':'diagram', '6':'productivity',
      '7':'base64', '8':'url', '9':'jwt',
    };
    if (map[e.key]) { e.preventDefault(); switchView(map[e.key]); }
  }
});
