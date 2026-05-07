'use strict';
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
