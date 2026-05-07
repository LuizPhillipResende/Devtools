'use strict';
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
