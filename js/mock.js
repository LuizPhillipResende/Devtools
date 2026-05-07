'use strict';
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
