'use strict';
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
