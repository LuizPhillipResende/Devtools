'use strict';
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
