'use strict';
// ══════════════════════════════════════════════════════
//  DIAGRAM EDITOR — AUTOMATOS & DATABASE ARCHITECTURE
// ══════════════════════════════════════════════════════
(function() {
  const canvas   = $('diagramCanvas');
  const ctx      = canvas ? canvas.getContext('2d') : null;
  const wrap     = $('diagramCanvasWrap');
  const labelEl  = $('diagramLabelInput');

  // Modal Table Column Editor
  const tableModal   = $('diagramTableModal');
  const tblNameInp   = $('dtmTableName');
  const tblColList   = $('dtmColList');
  const btnAddCol    = $('dtmBtnAddCol');
  const btnSaveTable = $('dtmBtnSave');
  const btnCloseModal= $('dtmBtnClose');

  if (!canvas) return;

  // ── State
  let shapes  = [], nextId = 1;
  let mode    = 'select';    // 'select' | 'rect' | 'circle' | 'diamond' | 'arrow' | 'text' | 'db-table' | 'db-relation' | 'arch-database' | 'arch-server' | 'arch-cloud' | 'arch-cache' | 'arch-queue'
  let sel     = null;
  let drag    = null;        // { shape, ox, oy }
  let resizeH = null;        // { shape, handle }
  let panSt   = null;        // { rx, ry, vx, vy }
  let drawSt  = null;        // { x, y, cx, cy }
  let editSh  = null;
  let editingTable = null;   // Table currently being edited in modal
  let viewX   = 0, viewY = 0, zoom = 1;

  const HS = 6;   // handle half-size
  const GRID = 10;

  // ── Canvas resize
  function resizeCanvas() {
    if (!wrap) return;
    const w = wrap.offsetWidth, h = wrap.offsetHeight;
    if (!w || !h) return;
    canvas.width  = w; canvas.height = h;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    draw();
  }
  window.addEventListener('diagram-visible', () => requestAnimationFrame(() => requestAnimationFrame(resizeCanvas)));
  if (wrap) new ResizeObserver(() => { if (wrap.offsetWidth) resizeCanvas(); }).observe(wrap);

  canvas.setAttribute('tabindex', '0');

  // ── Tool Selection
  document.querySelectorAll('.dtool[data-mode]').forEach(btn => {
    btn.onclick = () => { commitLabel(); setMode(btn.dataset.mode); };
  });

  const MODE_LABELS = {
    select: '',
    rect: 'Retângulo',
    circle: 'Elipse',
    diamond: 'Decisão',
    arrow: 'Seta / Transição',
    text: 'Texto',
    'db-table': 'Tabela de Banco de Dados',
    'db-relation': 'Relacionamento (1:N)',
    'arch-database': 'Nó: Banco de Dados',
    'arch-server': 'Nó: Servidor',
    'arch-cloud': 'Nó: Nuvem',
    'arch-cache': 'Nó: Cache (Redis)',
    'arch-queue': 'Nó: Mensageria (Kafka/RabbitMQ)'
  };

  function setMode(m) {
    mode = m;
    document.querySelectorAll('.dtool[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
    const lbl = $('dModeLabel');
    if (lbl) lbl.textContent = MODE_LABELS[m] || '';
    canvas.style.cursor = m === 'select' ? 'default' : 'crosshair';
  }
  setMode('select');

  // ── Zoom
  $('dZoomIn').onclick    = () => { zoom = Math.min(3, zoom + 0.15); draw(); };
  $('dZoomOut').onclick   = () => { zoom = Math.max(0.25, zoom - 0.15); draw(); };
  $('dZoomReset').onclick = () => { zoom = 1; viewX = 0; viewY = 0; draw(); };

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    zoom = clamp(zoom * factor, 0.25, 3);
    draw();
  }, { passive: false });

  // ── Coordinate & Hit Helpers
  function snap(v) { return Math.round(v / GRID) * GRID; }
  function toWorld(cx, cy) { return { x: (cx - viewX) / zoom, y: (cy - viewY) / zoom }; }

  function mouseWXY(e) {
    const r = canvas.getBoundingClientRect();
    return toWorld(e.clientX - r.left, e.clientY - r.top);
  }
  function mouseRaw(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function getShapeHeight(s) {
    if (s.type === 'db-table') {
      const cols = s.columns || [];
      return Math.max(70, 36 + cols.length * 24);
    }
    return s.h || 60;
  }

  function hitShape(wx, wy) {
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      if (s.type === 'arrow' || s.type === 'db-relation') {
        const dx = s.x2 - s.x1, dy = s.y2 - s.y1, len = Math.hypot(dx, dy);
        if (len < 1) continue;
        const t = ((wx - s.x1) * dx + (wy - s.y1) * dy) / (len * len);
        if (t < 0 || t > 1) continue;
        if (Math.hypot(wx - s.x1 - t * dx, wy - s.y1 - t * dy) < 10 / zoom) return s;
      } else if (s.type === 'text') {
        if (wx >= s.x - 4 && wx <= s.x + s.w + 4 && wy >= s.y - 4 && wy <= s.y + s.h + 4) return s;
      } else {
        const sh = getShapeHeight(s);
        if (wx >= s.x && wx <= s.x + s.w && wy >= s.y && wy <= s.y + sh) return s;
      }
    }
    return null;
  }

  function getHandles(s) {
    if (!s || s.type === 'arrow' || s.type === 'db-relation' || s.type === 'text') return [];
    const { x, y, w } = s;
    const h = getShapeHeight(s);
    return [
      { id: 'nw', cx: x, cy: y },
      { id: 'n',  cx: x + w/2, cy: y },
      { id: 'ne', cx: x + w, cy: y },
      { id: 'e',  cx: x + w, cy: y + h/2 },
      { id: 'se', cx: x + w, cy: y + h },
      { id: 's',  cx: x + w/2, cy: y + h },
      { id: 'sw', cx: x, cy: y + h },
      { id: 'w',  cx: x, cy: y + h/2 }
    ];
  }

  function hitHandle(wx, wy, s) {
    const tol = HS / zoom + 2;
    for (const h of getHandles(s)) {
      if (Math.abs(wx - h.cx) <= tol && Math.abs(wy - h.cy) <= tol) return h;
    }
    return null;
  }

  // ── Render Diagram ────────────────────────────────────────────────────────
  function draw() {
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // Grid dots
    const gap  = GRID * zoom;
    const offX = ((viewX % gap) + gap) % gap;
    const offY = ((viewY % gap) + gap) % gap;
    ctx.fillStyle = '#dde1e7';
    for (let gx = offX; gx < W; gx += gap) {
      for (let gy = offY; gy < H; gy += gap) {
        ctx.fillRect(gx - 0.75, gy - 0.75, 1.5, 1.5);
      }
    }

    ctx.save();
    ctx.translate(viewX, viewY);
    ctx.scale(zoom, zoom);

    // Draw all shapes (selected shape drawn last so it appears on top)
    const order = [...shapes.filter(s => s !== sel), ...(sel ? [sel] : [])];
    order.forEach(s => drawShape(s));

    // Preview during drawing
    if (drawSt && mode !== 'select') drawPreview();

    ctx.restore();
  }

  function drawShape(s) {
    const isSel = s === sel;
    ctx.save();

    // 1. ARROW & DATABASE RELATION
    if (s.type === 'arrow' || s.type === 'db-relation') {
      const isRelation = s.type === 'db-relation';
      ctx.strokeStyle = isSel ? '#0EA5E9' : (s.color || (isRelation ? '#0284C7' : '#374151'));
      ctx.lineWidth   = (isSel ? 2.5 : 2) / zoom;
      ctx.lineCap     = 'round';

      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();

      const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);

      if (isRelation) {
        // Crow's Foot or 1:N indicator
        const card = s.cardinality || '1:N';
        // Label at middle
        const mx = (s.x1 + s.x2) / 2;
        const my = (s.y1 + s.y2) / 2;
        ctx.fillStyle = '#1e293b';
        ctx.font = `bold ${11 / zoom}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(card, mx, my - 4 / zoom);

        // Crow's foot at target
        const hs = 14 / zoom;
        ctx.beginPath();
        ctx.moveTo(s.x2, s.y2);
        ctx.lineTo(s.x2 - hs * Math.cos(angle - 0.5), s.y2 - hs * Math.sin(angle - 0.5));
        ctx.moveTo(s.x2, s.y2);
        ctx.lineTo(s.x2 - hs * Math.cos(angle + 0.5), s.y2 - hs * Math.sin(angle + 0.5));
        ctx.stroke();
      } else {
        // Standard Transition Arrowhead
        const hs = 12 / zoom;
        ctx.fillStyle = isSel ? '#0EA5E9' : (s.color || '#374151');
        ctx.beginPath();
        ctx.moveTo(s.x2, s.y2);
        ctx.lineTo(s.x2 - hs * Math.cos(angle - 0.45), s.y2 - hs * Math.sin(angle - 0.45));
        ctx.lineTo(s.x2 - hs * Math.cos(angle + 0.45), s.y2 - hs * Math.sin(angle + 0.45));
        ctx.closePath();
        ctx.fill();

        // Label if present
        if (s.label) {
          const mx = (s.x1 + s.x2) / 2;
          const my = (s.y1 + s.y2) / 2;
          ctx.fillStyle = '#374151';
          ctx.font = `${11 / zoom}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(s.label, mx, my - 3 / zoom);
        }
      }

      if (isSel) {
        ctx.fillStyle = '#0EA5E9';
        [[s.x1, s.y1], [s.x2, s.y2]].forEach(([px, py]) => {
          ctx.beginPath(); ctx.arc(px, py, 5 / zoom, 0, Math.PI * 2); ctx.fill();
        });
      }

    // 2. DATABASE TABLE ENTITY (ERD)
    } else if (s.type === 'db-table') {
      const w = s.w || 220;
      const cols = s.columns || [];
      const totalH = Math.max(70, 36 + cols.length * 24);
      s.h = totalH;

      if (isSel) {
        ctx.shadowColor = 'rgba(14,165,233,0.35)';
        ctx.shadowBlur = 12 / zoom;
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0.08)';
        ctx.shadowBlur = 6 / zoom;
      }

      // Card Background
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = isSel ? '#0EA5E9' : '#cbd5e1';
      ctx.lineWidth = (isSel ? 2 : 1.5) / zoom;
      ctx.beginPath();
      ctx.roundRect(s.x, s.y, w, totalH, 6 / zoom);
      ctx.fill();
      ctx.stroke();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Table Header Bar
      const headerColor = s.color || '#1e293b';
      ctx.fillStyle = headerColor;
      ctx.beginPath();
      ctx.roundRect(s.x, s.y, w, 32 / zoom, [6 / zoom, 6 / zoom, 0, 0]);
      ctx.fill();

      // Header Icon & Table Name
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${12.5 / zoom}px system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`🗄️ ${s.tableName || s.label || 'Tabela'}`, s.x + 10 / zoom, s.y + 16 / zoom, w - 40 / zoom);

      // Column count badge
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.roundRect(s.x + w - 30 / zoom, s.y + 8 / zoom, 22 / zoom, 16 / zoom, 3 / zoom);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${9.5 / zoom}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(String(cols.length), s.x + w - 19 / zoom, s.y + 16 / zoom);

      // Columns rows
      cols.forEach((col, idx) => {
        const rowY = s.y + 34 / zoom + idx * (24 / zoom);
        // Alternate subtle zebra background
        if (idx % 2 === 1) {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(s.x + 1 / zoom, rowY, w - 2 / zoom, 24 / zoom);
        }

        // Row border
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 1 / zoom;
        ctx.beginPath();
        ctx.moveTo(s.x, rowY + 24 / zoom);
        ctx.lineTo(s.x + w, rowY + 24 / zoom);
        ctx.stroke();

        // Key indicator
        ctx.font = `${10.5 / zoom}px system-ui, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        let nameX = s.x + 10 / zoom;
        if (col.isPk) {
          ctx.fillStyle = '#eab308';
          ctx.fillText('🔑', s.x + 8 / zoom, rowY + 12 / zoom);
          nameX = s.x + 24 / zoom;
        } else if (col.isFk) {
          ctx.fillStyle = '#3b82f6';
          ctx.fillText('🔗', s.x + 8 / zoom, rowY + 12 / zoom);
          nameX = s.x + 24 / zoom;
        }

        // Column Name
        ctx.fillStyle = col.isPk ? '#0f172a' : '#334155';
        ctx.font = col.isPk ? `bold ${11.5 / zoom}px system-ui, sans-serif` : `${11.5 / zoom}px system-ui, sans-serif`;
        ctx.fillText(col.name, nameX, rowY + 12 / zoom, w * 0.5);

        // Column Type
        ctx.fillStyle = '#64748b';
        ctx.font = `${10 / zoom}px 'Cascadia Code', Consolas, monospace`;
        ctx.textAlign = 'right';
        ctx.fillText(col.type || 'TEXT', s.x + w - 10 / zoom, rowY + 12 / zoom);
      });

      // Resize handles
      if (isSel) {
        getHandles(s).forEach(h => {
          ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0EA5E9'; ctx.lineWidth = 1.5 / zoom;
          ctx.fillRect(h.cx - HS/zoom, h.cy - HS/zoom, HS*2/zoom, HS*2/zoom);
          ctx.strokeRect(h.cx - HS/zoom, h.cy - HS/zoom, HS*2/zoom, HS*2/zoom);
        });
      }

    // 3. ARCHITECTURE NODES (Cloud, Database, Server, Cache, Queue)
    } else if (s.type.startsWith('arch-')) {
      const subtype = s.subtype || s.type.replace('arch-', '');
      const w = s.w || 110, h = s.h || 75;

      if (isSel) { ctx.shadowColor = 'rgba(14,165,233,0.3)'; ctx.shadowBlur = 10 / zoom; }
      ctx.fillStyle = s.color || '#f8fafc';
      ctx.strokeStyle = isSel ? '#0EA5E9' : '#94a3b8';
      ctx.lineWidth = (isSel ? 2 : 1.5) / zoom;

      if (subtype === 'database') {
        // 3D Cylinder
        const rx = w / 2, ry = 12 / zoom;
        const cx = s.x + rx;
        // Bottom cap
        ctx.beginPath();
        ctx.ellipse(cx, s.y + h - ry, rx, ry, 0, 0, Math.PI);
        ctx.lineTo(s.x, s.y + ry);
        ctx.ellipse(cx, s.y + ry, rx, ry, 0, Math.PI, 0);
        ctx.lineTo(s.x + w, s.y + h - ry);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Top cap
        ctx.beginPath();
        ctx.ellipse(cx, s.y + ry, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#e2e8f0';
        ctx.fill(); ctx.stroke();

      } else if (subtype === 'cloud') {
        // Cloud silhouette
        const cx = s.x + w/2, cy = s.y + h/2;
        ctx.beginPath();
        ctx.arc(cx - w*0.22, cy, h*0.28, Math.PI * 0.5, Math.PI * 1.5);
        ctx.arc(cx - w*0.08, cy - h*0.2, h*0.32, Math.PI, Math.PI * 2);
        ctx.arc(cx + w*0.18, cy - h*0.12, h*0.28, Math.PI * 1.3, Math.PI * 2.2);
        ctx.arc(cx + w*0.24, cy + h*0.05, h*0.24, Math.PI * 1.7, Math.PI * 0.5);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

      } else if (subtype === 'server') {
        // Rack Server
        ctx.beginPath();
        ctx.roundRect(s.x, s.y, w, h, 6 / zoom);
        ctx.fill(); ctx.stroke();
        // Server drive bays & LEDs
        const bayH = (h - 20 / zoom) / 3;
        for (let i = 0; i < 3; i++) {
          const by = s.y + 8 / zoom + i * bayH;
          ctx.strokeStyle = '#cbd5e1';
          ctx.strokeRect(s.x + 8 / zoom, by, w - 16 / zoom, bayH - 3 / zoom);
          // LED
          ctx.fillStyle = i === 0 ? '#22c55e' : (i === 1 ? '#0ea5e9' : '#f59e0b');
          ctx.beginPath();
          ctx.arc(s.x + w - 16 / zoom, by + bayH / 2 - 1.5 / zoom, 2.5 / zoom, 0, Math.PI * 2);
          ctx.fill();
        }

      } else if (subtype === 'cache') {
        // Cache node (bolt icon)
        ctx.beginPath();
        ctx.roundRect(s.x, s.y, w, h, 8 / zoom);
        ctx.fill(); ctx.stroke();
        // Lightning bolt icon
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        const mx = s.x + w/2, my = s.y + h/2 - 8 / zoom;
        ctx.moveTo(mx + 2/zoom, my - 12/zoom);
        ctx.lineTo(mx - 8/zoom, my + 2/zoom);
        ctx.lineTo(mx - 1/zoom, my + 2/zoom);
        ctx.lineTo(mx - 4/zoom, my + 14/zoom);
        ctx.lineTo(mx + 8/zoom, my - 1/zoom);
        ctx.lineTo(mx + 1/zoom, my - 1/zoom);
        ctx.closePath();
        ctx.fill();

      } else if (subtype === 'queue') {
        // Message Queue / Pipeline buffer
        ctx.beginPath();
        ctx.roundRect(s.x, s.y, w, h, 14 / zoom);
        ctx.fill(); ctx.stroke();
        // Inner message partitions
        const segW = (w - 20 / zoom) / 4;
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.moveTo(s.x + 10 / zoom + (i + 1) * segW, s.y + 6 / zoom);
          ctx.lineTo(s.x + 10 / zoom + (i + 1) * segW, s.y + h - 6 / zoom);
          ctx.stroke();
        }
      }

      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;

      // Label below or centered
      if (s.label && s !== editSh) {
        ctx.fillStyle = '#1e293b';
        ctx.font = `bold ${11.5 / zoom}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.label, s.x + w/2, s.y + h - 12 / zoom, w - 8 / zoom);
      }

      if (isSel) {
        getHandles(s).forEach(h => {
          ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0EA5E9'; ctx.lineWidth = 1.5 / zoom;
          ctx.fillRect(h.cx - HS/zoom, h.cy - HS/zoom, HS*2/zoom, HS*2/zoom);
          ctx.strokeRect(h.cx - HS/zoom, h.cy - HS/zoom, HS*2/zoom, HS*2/zoom);
        });
      }

    // 4. TEXT
    } else if (s.type === 'text') {
      if (s !== editSh) {
        ctx.font = `${(s.fontSize || 14)}px system-ui, sans-serif`;
        ctx.fillStyle = s.color || '#111827';
        ctx.textBaseline = 'top';
        ctx.fillText(s.label || 'Texto', s.x, s.y);
      }
      if (isSel) {
        ctx.strokeStyle = '#0EA5E9'; ctx.lineWidth = 1 / zoom; ctx.setLineDash([4 / zoom, 2 / zoom]);
        ctx.strokeRect(s.x - 2, s.y - 2, s.w + 4, s.h + 4);
        ctx.setLineDash([]);
      }

    // 5. STANDARD AUTOMATA SHAPES (Rect, Circle, Diamond)
    } else {
      if (isSel) { ctx.shadowColor = 'rgba(14,165,233,.25)'; ctx.shadowBlur = 10 / zoom; }
      ctx.fillStyle   = s.color || '#ffffff';
      ctx.strokeStyle = isSel ? '#0EA5E9' : '#9ca3af';
      ctx.lineWidth   = (isSel ? 2 : 1.5) / zoom;

      if (s.type === 'rect') {
        ctx.beginPath(); ctx.roundRect(s.x, s.y, s.w, s.h, 4 / zoom); ctx.fill(); ctx.stroke();
      } else if (s.type === 'circle') {
        ctx.beginPath(); ctx.ellipse(s.x + s.w/2, s.y + s.h/2, s.w/2, s.h/2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else if (s.type === 'diamond') {
        const cx = s.x + s.w/2, cy = s.y + s.h/2;
        ctx.beginPath(); ctx.moveTo(cx, s.y); ctx.lineTo(s.x + s.w, cy); ctx.lineTo(cx, s.y + s.h); ctx.lineTo(s.x, cy); ctx.closePath(); ctx.fill(); ctx.stroke();
      }

      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;

      // Label
      if (s.label && s !== editSh) {
        ctx.fillStyle   = isColorDark(s.color) ? '#f1f5f9' : '#111827';
        ctx.font        = `${13 / zoom}px system-ui, sans-serif`;
        ctx.textAlign   = 'center'; ctx.textBaseline = 'middle';
        ctx.save();
        ctx.beginPath();
        if (s.type === 'rect') ctx.roundRect(s.x + 2, s.y + 2, s.w - 4, s.h - 4, 4 / zoom);
        else if (s.type === 'circle') ctx.ellipse(s.x + s.w/2, s.y + s.h/2, s.w/2 - 2, s.h/2 - 2, 0, 0, Math.PI * 2);
        else ctx.rect(s.x, s.y, s.w, s.h);
        ctx.clip();
        ctx.fillText(s.label, s.x + s.w/2, s.y + s.h/2, (s.w - 8));
        ctx.restore();
      }

      if (isSel) {
        getHandles(s).forEach(h => {
          ctx.fillStyle = '#fff'; ctx.strokeStyle = '#0EA5E9'; ctx.lineWidth = 1.5 / zoom;
          ctx.fillRect(h.cx - HS/zoom, h.cy - HS/zoom, HS*2/zoom, HS*2/zoom);
          ctx.strokeRect(h.cx - HS/zoom, h.cy - HS/zoom, HS*2/zoom, HS*2/zoom);
        });
      }
    }
    ctx.restore();
  }

  function isColorDark(hex) {
    if (!hex || hex === '#ffffff') return false;
    const r = parseInt(hex.slice(1,3) || 'ff', 16), g = parseInt(hex.slice(3,5) || 'ff', 16), b = parseInt(hex.slice(5,7) || 'ff', 16);
    return (0.299*r + 0.587*g + 0.114*b) < 100;
  }

  function drawPreview() {
    const { x: x1, y: y1, cx: cx1, cy: cy1 } = drawSt;
    ctx.save();
    ctx.strokeStyle = '#0EA5E9'; ctx.lineWidth = 1.5 / zoom;
    ctx.setLineDash([5 / zoom, 3 / zoom]);
    ctx.fillStyle = 'rgba(14,165,233,.08)';

    if (mode === 'arrow' || mode === 'db-relation') {
      ctx.setLineDash([]); ctx.lineWidth = 2 / zoom; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(cx1, cy1); ctx.stroke();
    } else {
      const rx = Math.min(x1, cx1), ry = Math.min(y1, cy1);
      const rw = Math.abs(cx1 - x1), rh = Math.abs(cy1 - y1);
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
    }
    ctx.restore();
  }

  // ── Mouse & Drag Handling ─────────────────────────────────────────────────
  canvas.addEventListener('mousedown', e => {
    if (editSh) { commitLabel(); return; }
    canvas.focus();
    const { x, y } = mouseWXY(e);
    const raw = mouseRaw(e);

    if (mode === 'select') {
      if (sel) {
        if (sel.type === 'arrow' || sel.type === 'db-relation') {
          if (Math.hypot(x - sel.x1, y - sel.y1) < 12 / zoom) { drag = { shape: sel, end: 'start' }; return; }
          if (Math.hypot(x - sel.x2, y - sel.y2) < 12 / zoom) { drag = { shape: sel, end: 'end' }; return; }
        }
        const h = hitHandle(x, y, sel);
        if (h) { resizeH = { shape: sel, handle: h, origShape: { ...sel } }; return; }
      }
      const hit = hitShape(x, y);
      if (hit) {
        sel = hit;
        showColorPicker(hit);
        const ox = (hit.type === 'arrow' || hit.type === 'db-relation') ? x - hit.x1 : x - hit.x;
        const oy = (hit.type === 'arrow' || hit.type === 'db-relation') ? y - hit.y1 : y - hit.y;
        drag = { shape: hit, ox, oy };
        draw();
      } else {
        sel = null; hideColorPicker(); draw();
        panSt = { rx: raw.x, ry: raw.y, vx: viewX, vy: viewY };
      }
    } else {
      drawSt = { x: snap(x), y: snap(y), cx: snap(x), cy: snap(y) };
    }
  });

  canvas.addEventListener('mousemove', e => {
    const { x, y } = mouseWXY(e);
    const raw = mouseRaw(e);

    if (resizeH) {
      const { shape: s, handle: h } = resizeH;
      const nx = snap(x), ny = snap(y);
      const orig = resizeH.origShape;
      if (h.id.includes('e')) s.w = Math.max(60, nx - s.x);
      if (h.id.includes('s')) s.h = Math.max(40, ny - s.y);
      if (h.id.includes('w')) { const r = orig.x + orig.w; s.x = Math.min(nx, r - 60); s.w = r - s.x; }
      if (h.id.includes('n')) { const b = orig.y + orig.h; s.y = Math.min(ny, b - 40); s.h = b - s.y; }
      draw(); return;
    }

    if (drag) {
      const { shape: s, ox, oy } = drag;
      if (s.type === 'arrow' || s.type === 'db-relation') {
        if (drag.end === 'start') { s.x1 = snap(x); s.y1 = snap(y); }
        else if (drag.end === 'end') { s.x2 = snap(x); s.y2 = snap(y); }
        else { const dx = snap(x - ox) - s.x1, dy = snap(y - oy) - s.y1; s.x1 += dx; s.y1 += dy; s.x2 += dx; s.y2 += dy; }
      } else {
        s.x = snap(x - ox); s.y = snap(y - oy);
      }
      draw(); return;
    }

    if (panSt) {
      viewX = panSt.vx + raw.x - panSt.rx;
      viewY = panSt.vy + raw.y - panSt.ry;
      draw(); return;
    }

    if (drawSt) { drawSt.cx = snap(x); drawSt.cy = snap(y); draw(); return; }

    if (mode === 'select') {
      if (sel) {
        const h = hitHandle(x, y, sel);
        if (h) {
          const cursors = { n: 'n-resize', s: 's-resize', e: 'e-resize', w: 'w-resize', ne: 'ne-resize', nw: 'nw-resize', se: 'se-resize', sw: 'sw-resize' };
          canvas.style.cursor = cursors[h.id] || 'pointer'; return;
        }
      }
      canvas.style.cursor = hitShape(x, y) ? 'move' : 'default';
    }
  });

  canvas.addEventListener('mouseup', e => {
    const { x, y } = mouseWXY(e);

    if (resizeH) { resizeH = null; saveDiagram(); return; }
    if (drag) { drag = null; saveDiagram(); return; }
    if (panSt) { panSt = null; return; }

    if (drawSt) {
      const x1 = Math.min(drawSt.x, snap(x)), y1 = Math.min(drawSt.y, snap(y));
      const x2 = Math.max(drawSt.x, snap(x)), y2 = Math.max(drawSt.y, snap(y));
      const w = Math.max(x2 - x1, 40), h = Math.max(y2 - y1, 30);
      let newShape = null;

      if ((mode === 'arrow' || mode === 'db-relation') && Math.hypot(snap(x) - drawSt.x, snap(y) - drawSt.y) > 15) {
        newShape = {
          id: nextId++,
          type: mode,
          x1: drawSt.x, y1: drawSt.y,
          x2: snap(x), y2: snap(y),
          cardinality: mode === 'db-relation' ? '1:N' : undefined,
          color: mode === 'db-relation' ? '#0284C7' : '#374151'
        };
      } else if (mode === 'text') {
        newShape = { id: nextId++, type: 'text', x: snap(x), y: snap(y), w: 100, h: 20, label: 'Texto', color: '#111827', fontSize: 14 };
      } else if (mode === 'db-table') {
        newShape = {
          id: nextId++,
          type: 'db-table',
          tableName: 'nova_tabela',
          x: x1, y: y1,
          w: 220, h: 100,
          color: '#1e293b',
          columns: [
            { name: 'id', type: 'BIGINT', isPk: true, isFk: false, isNullable: false },
            { name: 'nome', type: 'VARCHAR(255)', isPk: false, isFk: false, isNullable: false },
            { name: 'criado_em', type: 'TIMESTAMP', isPk: false, isFk: false, isNullable: false }
          ]
        };
      } else if (mode.startsWith('arch-')) {
        const subtype = mode.replace('arch-', '');
        const defaultNames = { database: 'PostgreSQL DB', server: 'App Server', cloud: 'AWS Cloud', cache: 'Redis Cache', queue: 'Kafka Queue' };
        newShape = {
          id: nextId++,
          type: mode,
          subtype,
          x: x1, y: y1,
          w: Math.max(w, 110), h: Math.max(h, 75),
          label: defaultNames[subtype] || subtype,
          color: '#f8fafc'
        };
      } else if (w > 20 && h > 20) {
        const labels = { rect: 'Estado', circle: 'Estado', diamond: 'Decisão' };
        newShape = { id: nextId++, type: mode, x: x1, y: y1, w, h, label: labels[mode] || '', color: '#ffffff' };
      }

      if (newShape) {
        shapes.push(newShape);
        sel = newShape;
        showColorPicker(newShape);
        if (newShape.type === 'db-table') {
          setTimeout(() => openTableModal(newShape), 50);
        } else if (newShape.type !== 'arrow' && newShape.type !== 'db-relation') {
          setTimeout(() => openLabelEditor(newShape), 50);
        }
      }

      drawSt = null; setMode('select'); saveDiagram(); draw();
    }
  });

  canvas.addEventListener('mouseleave', () => { if (drag) { drag = null; saveDiagram(); } });

  canvas.addEventListener('dblclick', e => {
    const { x, y } = mouseWXY(e);
    const hit = hitShape(x, y);
    if (hit) {
      sel = hit;
      if (hit.type === 'db-table') {
        openTableModal(hit);
      } else if (hit.type !== 'arrow') {
        openLabelEditor(hit);
      }
      draw();
    }
  });

  // ── Database Table Modal Editor ───────────────────────────────────────────
  function openTableModal(tableShape) {
    editingTable = tableShape;
    if (!tableModal) return;
    if (tblNameInp) tblNameInp.value = tableShape.tableName || 'tabela';
    renderTableColsInModal();
    tableModal.classList.remove('hidden');
    tableModal.style.display = 'flex';
  }

  function closeTableModal() {
    editingTable = null;
    if (tableModal) {
      tableModal.classList.add('hidden');
      tableModal.style.display = 'none';
    }
    saveDiagram();
    draw();
  }

  function renderTableColsInModal() {
    if (!tblColList || !editingTable) return;
    const cols = editingTable.columns || [];
    tblColList.innerHTML = cols.map((col, idx) => `
      <div class="dtm-col-row" data-idx="${idx}">
        <input class="inp dtm-col-name" value="${esc(col.name)}" placeholder="nome_campo" style="flex:1.5" />
        <select class="inp dtm-col-type" style="flex:1">
          ${['INT','BIGINT','VARCHAR(255)','TEXT','UUID','BOOLEAN','TIMESTAMP','DECIMAL(10,2)','JSONB','FLOAT']
            .map(t => `<option value="${t}" ${col.type === t ? 'selected' : ''}>${t}</option>`).join('')}
        </select>
        <label class="dtm-check-label" title="Chave Primária">
          <input type="checkbox" class="dtm-col-pk" ${col.isPk ? 'checked' : ''} /> PK
        </label>
        <label class="dtm-check-label" title="Chave Estrangeira">
          <input type="checkbox" class="dtm-col-fk" ${col.isFk ? 'checked' : ''} /> FK
        </label>
        <label class="dtm-check-label" title="Não Nulo">
          <input type="checkbox" class="dtm-col-nn" ${col.isNullable ? '' : 'checked'} /> NN
        </label>
        <button class="btn danger dtm-col-del" data-idx="${idx}" title="Remover coluna" style="padding:0 6px">×</button>
      </div>
    `).join('');

    // Bind row updates
    tblColList.querySelectorAll('.dtm-col-row').forEach(row => {
      const idx = parseInt(row.dataset.idx, 10);
      const nameInp = row.querySelector('.dtm-col-name');
      const typeSel = row.querySelector('.dtm-col-type');
      const pkCheck = row.querySelector('.dtm-col-pk');
      const fkCheck = row.querySelector('.dtm-col-fk');
      const nnCheck = row.querySelector('.dtm-col-nn');
      const delBtn  = row.querySelector('.dtm-col-del');

      nameInp.oninput = () => { editingTable.columns[idx].name = nameInp.value; };
      typeSel.onchange = () => { editingTable.columns[idx].type = typeSel.value; };
      pkCheck.onchange = () => { editingTable.columns[idx].isPk = pkCheck.checked; };
      fkCheck.onchange = () => { editingTable.columns[idx].isFk = fkCheck.checked; };
      nnCheck.onchange = () => { editingTable.columns[idx].isNullable = !nnCheck.checked; };
      delBtn.onclick = () => {
        editingTable.columns.splice(idx, 1);
        renderTableColsInModal();
      };
    });
  }

  if (btnAddCol) {
    btnAddCol.onclick = () => {
      if (!editingTable) return;
      editingTable.columns = editingTable.columns || [];
      editingTable.columns.push({ name: 'novo_campo', type: 'VARCHAR(255)', isPk: false, isFk: false, isNullable: true });
      renderTableColsInModal();
    };
  }

  if (btnSaveTable) {
    btnSaveTable.onclick = () => {
      if (editingTable && tblNameInp) {
        editingTable.tableName = tblNameInp.value.trim() || 'tabela';
      }
      closeTableModal();
    };
  }

  if (btnCloseModal) btnCloseModal.onclick = closeTableModal;

  // ── Label Editor (Simple Shapes & Text) ───────────────────────────────────
  function openLabelEditor(s) {
    editSh = s;
    const bx = s.x * zoom + viewX, by = s.y * zoom + viewY;
    const bw = (s.w || 80) * zoom;
    if (!labelEl) return;
    labelEl.style.display = 'block';
    labelEl.style.left   = (bx + bw / 2 - Math.max(80, bw - 10) / 2) + 'px';
    labelEl.style.top    = (by + (s.h || 20) * zoom / 2 - 14) + 'px';
    labelEl.style.width  = Math.max(80, bw - 10) + 'px';
    labelEl.value = s.label || '';
    labelEl.focus(); labelEl.select();
  }

  function commitLabel() {
    if (!editSh) return;
    if (labelEl) editSh.label = labelEl.value;
    if (editSh.type === 'text') {
      ctx.font = `${editSh.fontSize || 14}px system-ui,sans-serif`;
      editSh.w = Math.max(20, ctx.measureText(editSh.label).width + 4);
    }
    editSh = null;
    if (labelEl) labelEl.style.display = 'none';
    saveDiagram(); draw();
  }

  if (labelEl) {
    labelEl.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); commitLabel(); }
      if (e.key === 'Escape') { editSh = null; labelEl.style.display = 'none'; draw(); }
    });
    labelEl.addEventListener('blur', () => { if (editSh) commitLabel(); });
  }

  // ── Color Picker ──────────────────────────────────────────────────────────
  function showColorPicker(s) {
    const cp = $('dColorPick');
    if (!cp) return;
    if (!s) { hideColorPicker(); return; }
    cp.style.display = 'flex';
    const c = s.color || '#ffffff';
    document.querySelectorAll('.d-swatch').forEach(sw => sw.classList.toggle('sel', sw.dataset.color === c));
    const nat = $('dColorNative');
    if (nat) nat.value = c.startsWith('#') && c.length === 7 ? c : '#ffffff';
  }
  function hideColorPicker() { const cp = $('dColorPick'); if (cp) cp.style.display = 'none'; }

  document.querySelectorAll('.d-swatch').forEach(sw => {
    sw.onclick = () => {
      if (!sel) return;
      sel.color = sw.dataset.color;
      document.querySelectorAll('.d-swatch').forEach(s => s.classList.remove('sel'));
      sw.classList.add('sel');
      const nat = $('dColorNative');
      if (nat) nat.value = sw.dataset.color;
      saveDiagram(); draw();
    };
  });

  const dColorNat = $('dColorNative');
  if (dColorNat) {
    dColorNat.addEventListener('input', () => {
      if (!sel) return;
      sel.color = dColorNat.value;
      saveDiagram(); draw();
    });
  }

  // ── Delete / Clear ────────────────────────────────────────────────────────
  $('dDelete').onclick = () => {
    if (sel) {
      shapes = shapes.filter(s => s !== sel);
      sel = null; hideColorPicker(); saveDiagram(); draw();
    }
  };
  $('dClear').onclick = () => {
    if (confirm('Limpar todos os elementos do diagrama?')) {
      shapes = []; sel = null; nextId = 1; hideColorPicker(); saveDiagram(); draw();
    }
  };

  // ── XML IMPORT & EXPORT ───────────────────────────────────────────────────
  function exportDiagramToXML() {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<automatos_diagram version="2.0" timestamp="${new Date().toISOString()}">\n`;
    xml += `  <view zoom="${zoom}" viewX="${viewX}" viewY="${viewY}" />\n`;

    // Database Tables
    xml += `  <database_tables>\n`;
    shapes.filter(s => s.type === 'db-table').forEach(tbl => {
      xml += `    <table id="${tbl.id}" name="${esc(tbl.tableName || 'tabela')}" x="${tbl.x}" y="${tbl.y}" width="${tbl.w}" height="${tbl.h}" color="${tbl.color || '#1e293b'}">\n`;
      xml += `      <columns>\n`;
      (tbl.columns || []).forEach(col => {
        xml += `        <column name="${esc(col.name)}" type="${esc(col.type || 'TEXT')}" pk="${!!col.isPk}" fk="${!!col.isFk}" nullable="${!!col.isNullable}" />\n`;
      });
      xml += `      </columns>\n`;
      xml += `    </table>\n`;
    });
    xml += `  </database_tables>\n`;

    // Database Relations
    xml += `  <relations>\n`;
    shapes.filter(s => s.type === 'db-relation').forEach(rel => {
      xml += `    <relation id="${rel.id}" cardinality="${esc(rel.cardinality || '1:N')}" x1="${rel.x1}" y1="${rel.y1}" x2="${rel.x2}" y2="${rel.y2}" color="${rel.color || '#0284C7'}" />\n`;
    });
    xml += `  </relations>\n`;

    // Architecture Nodes
    xml += `  <architecture_nodes>\n`;
    shapes.filter(s => s.type.startsWith('arch-')).forEach(node => {
      xml += `    <node id="${node.id}" type="${node.type}" subtype="${node.subtype || ''}" label="${esc(node.label || '')}" x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" color="${node.color || '#f8fafc'}" />\n`;
    });
    xml += `  </architecture_nodes>\n`;

    // Standard Shapes & Arrows
    xml += `  <shapes>\n`;
    shapes.filter(s => ['rect', 'circle', 'diamond', 'arrow', 'text'].includes(s.type)).forEach(sh => {
      if (sh.type === 'arrow') {
        xml += `    <arrow id="${sh.id}" label="${esc(sh.label || '')}" x1="${sh.x1}" y1="${sh.y1}" x2="${sh.x2}" y2="${sh.y2}" color="${sh.color || '#374151'}" />\n`;
      } else {
        xml += `    <shape id="${sh.id}" type="${sh.type}" label="${esc(sh.label || '')}" x="${sh.x}" y="${sh.y}" width="${sh.w}" height="${sh.h}" color="${sh.color || '#ffffff'}" />\n`;
      }
    });
    xml += `  </shapes>\n`;

    xml += `</automatos_diagram>\n`;
    return xml;
  }

  const btnExportXML = $('dExportXML');
  if (btnExportXML) {
    btnExportXML.onclick = async () => {
      const xmlData = exportDiagramToXML();
      await saveFileToComputer({
        title: 'Exportar Diagrama em XML',
        defaultPath: 'arquitetura_banco.xml',
        filters: [{ name: 'Arquivo XML', extensions: ['xml'] }],
        content: xmlData,
        mimeType: 'application/xml;charset=utf-8'
      });
    };
  }

  function importDiagramFromXML(xmlText) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'application/xml');
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        throw new Error(parserError.textContent.slice(0, 100));
      }

      const root = doc.querySelector('automatos_diagram');
      if (!root) throw new Error('Elemento raiz <automatos_diagram> não encontrado no XML');

      const importedShapes = [];
      let maxId = 1;

      // View settings
      const viewEl = root.querySelector('view');
      if (viewEl) {
        zoom = parseFloat(viewEl.getAttribute('zoom')) || 1;
        viewX = parseFloat(viewEl.getAttribute('viewX')) || 0;
        viewY = parseFloat(viewEl.getAttribute('viewY')) || 0;
      }

      // Database tables
      root.querySelectorAll('database_tables > table').forEach(tblEl => {
        const id = parseInt(tblEl.getAttribute('id') || '0', 10) || nextId++;
        maxId = Math.max(maxId, id);
        const columns = [];
        tblEl.querySelectorAll('columns > column').forEach(colEl => {
          columns.push({
            name: colEl.getAttribute('name') || 'campo',
            type: colEl.getAttribute('type') || 'TEXT',
            isPk: colEl.getAttribute('pk') === 'true',
            isFk: colEl.getAttribute('fk') === 'true',
            isNullable: colEl.getAttribute('nullable') === 'true'
          });
        });
        importedShapes.push({
          id,
          type: 'db-table',
          tableName: tblEl.getAttribute('name') || 'tabela',
          x: parseFloat(tblEl.getAttribute('x')) || 50,
          y: parseFloat(tblEl.getAttribute('y')) || 50,
          w: parseFloat(tblEl.getAttribute('width')) || 220,
          h: parseFloat(tblEl.getAttribute('height')) || 120,
          color: tblEl.getAttribute('color') || '#1e293b',
          columns
        });
      });

      // Relations
      root.querySelectorAll('relations > relation').forEach(relEl => {
        const id = parseInt(relEl.getAttribute('id') || '0', 10) || nextId++;
        maxId = Math.max(maxId, id);
        importedShapes.push({
          id,
          type: 'db-relation',
          cardinality: relEl.getAttribute('cardinality') || '1:N',
          x1: parseFloat(relEl.getAttribute('x1')) || 50,
          y1: parseFloat(relEl.getAttribute('y1')) || 50,
          x2: parseFloat(relEl.getAttribute('x2')) || 150,
          y2: parseFloat(relEl.getAttribute('y2')) || 150,
          color: relEl.getAttribute('color') || '#0284C7'
        });
      });

      // Architecture nodes
      root.querySelectorAll('architecture_nodes > node').forEach(nEl => {
        const id = parseInt(nEl.getAttribute('id') || '0', 10) || nextId++;
        maxId = Math.max(maxId, id);
        importedShapes.push({
          id,
          type: nEl.getAttribute('type') || 'arch-database',
          subtype: nEl.getAttribute('subtype') || 'database',
          label: nEl.getAttribute('label') || '',
          x: parseFloat(nEl.getAttribute('x')) || 50,
          y: parseFloat(nEl.getAttribute('y')) || 50,
          w: parseFloat(nEl.getAttribute('width')) || 110,
          h: parseFloat(nEl.getAttribute('height')) || 75,
          color: nEl.getAttribute('color') || '#f8fafc'
        });
      });

      // Shapes & Arrows
      root.querySelectorAll('shapes > shape').forEach(sEl => {
        const id = parseInt(sEl.getAttribute('id') || '0', 10) || nextId++;
        maxId = Math.max(maxId, id);
        importedShapes.push({
          id,
          type: sEl.getAttribute('type') || 'rect',
          label: sEl.getAttribute('label') || '',
          x: parseFloat(sEl.getAttribute('x')) || 50,
          y: parseFloat(sEl.getAttribute('y')) || 50,
          w: parseFloat(sEl.getAttribute('width')) || 100,
          h: parseFloat(sEl.getAttribute('height')) || 60,
          color: sEl.getAttribute('color') || '#ffffff'
        });
      });

      root.querySelectorAll('shapes > arrow').forEach(aEl => {
        const id = parseInt(aEl.getAttribute('id') || '0', 10) || nextId++;
        maxId = Math.max(maxId, id);
        importedShapes.push({
          id,
          type: 'arrow',
          label: aEl.getAttribute('label') || '',
          x1: parseFloat(aEl.getAttribute('x1')) || 50,
          y1: parseFloat(aEl.getAttribute('y1')) || 50,
          x2: parseFloat(aEl.getAttribute('x2')) || 150,
          y2: parseFloat(aEl.getAttribute('y2')) || 150,
          color: aEl.getAttribute('color') || '#374151'
        });
      });

      shapes = importedShapes;
      nextId = maxId + 1;
      sel = null;
      hideColorPicker();
      saveDiagram();
      draw();
      toast('✓ Diagrama XML importado com sucesso!', 'ok');
    } catch (err) {
      toast('Erro ao importar XML: ' + err.message, 'del');
    }
  }

  const btnImportXML = $('dImportXML');
  if (btnImportXML) {
    btnImportXML.onclick = async () => {
      const fileRes = await chooseFileFromComputer({
        title: 'Importar Diagrama XML',
        filters: [{ name: 'Arquivo XML', extensions: ['xml'] }]
      });
      if (fileRes?.content) {
        importDiagramFromXML(fileRes.content);
      }
    };
  }

  // ── TEMPLATES (E-Commerce DB, Auth, Microservices) ────────────────────────
  function loadTemplate(tplKey) {
    if (shapes.length > 0 && !confirm('Substituir diagrama atual pelo modelo selecionado?')) return;

    if (tplKey === 'ecommerce') {
      shapes = [
        {
          id: 1, type: 'db-table', tableName: 'users', x: 40, y: 50, w: 220, color: '#1e293b',
          columns: [
            { name: 'id', type: 'BIGINT', isPk: true, isFk: false, isNullable: false },
            { name: 'name', type: 'VARCHAR(150)', isPk: false, isFk: false, isNullable: false },
            { name: 'email', type: 'VARCHAR(255)', isPk: false, isFk: false, isNullable: false },
            { name: 'created_at', type: 'TIMESTAMP', isPk: false, isFk: false, isNullable: false }
          ]
        },
        {
          id: 2, type: 'db-table', tableName: 'orders', x: 340, y: 50, w: 220, color: '#0369a1',
          columns: [
            { name: 'id', type: 'BIGINT', isPk: true, isFk: false, isNullable: false },
            { name: 'user_id', type: 'BIGINT', isPk: false, isFk: true, isNullable: false },
            { name: 'total_amount', type: 'DECIMAL(10,2)', isPk: false, isFk: false, isNullable: false },
            { name: 'status', type: 'VARCHAR(50)', isPk: false, isFk: false, isNullable: false },
            { name: 'created_at', type: 'TIMESTAMP', isPk: false, isFk: false, isNullable: false }
          ]
        },
        {
          id: 3, type: 'db-table', tableName: 'order_items', x: 640, y: 50, w: 220, color: '#0f766e',
          columns: [
            { name: 'id', type: 'BIGINT', isPk: true, isFk: false, isNullable: false },
            { name: 'order_id', type: 'BIGINT', isPk: false, isFk: true, isNullable: false },
            { name: 'product_id', type: 'BIGINT', isPk: false, isFk: true, isNullable: false },
            { name: 'quantity', type: 'INT', isPk: false, isFk: false, isNullable: false },
            { name: 'unit_price', type: 'DECIMAL(10,2)', isPk: false, isFk: false, isNullable: false }
          ]
        },
        {
          id: 4, type: 'db-table', tableName: 'products', x: 640, y: 260, w: 220, color: '#b45309',
          columns: [
            { name: 'id', type: 'BIGINT', isPk: true, isFk: false, isNullable: false },
            { name: 'title', type: 'VARCHAR(200)', isPk: false, isFk: false, isNullable: false },
            { name: 'price', type: 'DECIMAL(10,2)', isPk: false, isFk: false, isNullable: false },
            { name: 'stock', type: 'INT', isPk: false, isFk: false, isNullable: false }
          ]
        },
        {
          id: 5, type: 'db-relation', cardinality: '1:N', x1: 260, y1: 100, x2: 340, y2: 100, color: '#0284C7'
        },
        {
          id: 6, type: 'db-relation', cardinality: '1:N', x1: 560, y1: 100, x2: 640, y2: 100, color: '#0284C7'
        },
        {
          id: 7, type: 'db-relation', cardinality: '1:N', x1: 740, y1: 260, x2: 740, y2: 180, color: '#0284C7'
        }
      ];
      nextId = 8;
    } else if (tplKey === 'microservices') {
      shapes = [
        { id: 1, type: 'arch-cloud', subtype: 'cloud', label: 'Client / Web Apps', x: 40, y: 120, w: 140, h: 90, color: '#f0fdf4' },
        { id: 2, type: 'arch-server', subtype: 'server', label: 'API Gateway', x: 250, y: 125, w: 130, h: 80, color: '#f8fafc' },
        { id: 3, type: 'arch-server', subtype: 'server', label: 'Auth Service', x: 450, y: 40, w: 120, h: 75, color: '#f8fafc' },
        { id: 4, type: 'arch-server', subtype: 'server', label: 'Order Service', x: 450, y: 150, w: 120, h: 75, color: '#f8fafc' },
        { id: 5, type: 'arch-cache', subtype: 'cache', label: 'Redis Cache', x: 640, y: 40, w: 110, h: 75, color: '#fef2f2' },
        { id: 6, type: 'arch-database', subtype: 'database', label: 'PostgreSQL DB', x: 640, y: 150, w: 120, h: 80, color: '#eff6ff' },
        { id: 7, type: 'arch-queue', subtype: 'queue', label: 'Kafka Queue', x: 450, y: 270, w: 160, h: 65, color: '#fffbeb' },
        { id: 8, type: 'arrow', label: 'HTTPS', x1: 180, y1: 165, x2: 250, y2: 165, color: '#0ea5e9' },
        { id: 9, type: 'arrow', label: 'gRPC', x1: 380, y1: 145, x2: 450, y2: 75, color: '#10b981' },
        { id: 10, type: 'arrow', label: 'gRPC', x1: 380, y1: 175, x2: 450, y2: 175, color: '#10b981' },
        { id: 11, type: 'arrow', label: '', x1: 570, y1: 75, x2: 640, y2: 75, color: '#ef4444' },
        { id: 12, type: 'arrow', label: '', x1: 570, y1: 185, x2: 640, y2: 185, color: '#3b82f6' },
        { id: 13, type: 'arrow', label: 'Events', x1: 510, y1: 225, x2: 510, y2: 270, color: '#f59e0b' }
      ];
      nextId = 14;
    }

    zoom = 1; viewX = 20; viewY = 20;
    saveDiagram();
    draw();
    toast('✓ Modelo carregado!', 'ok');
  }

  const dTemplateSel = $('dTemplateSelect');
  if (dTemplateSel) {
    dTemplateSel.onchange = () => {
      const val = dTemplateSel.value;
      if (val) {
        loadTemplate(val);
        dTemplateSel.value = '';
      }
    };
  }

  // ── Export PNG ────────────────────────────────────────────────────────────
  $('dExport').onclick = () => {
    const tmp = document.createElement('canvas');
    tmp.width = canvas.width; tmp.height = canvas.height;
    const tc = tmp.getContext('2d');
    tc.fillStyle = '#ffffff'; tc.fillRect(0, 0, tmp.width, tmp.height);
    tc.drawImage(canvas, 0, 0);
    const dataUrl = tmp.toDataURL('image/png');
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    saveFileToComputer({
      title: 'Exportar Diagrama em PNG',
      defaultPath: 'automatos_arquitetura.png',
      filters: [{ name: 'Imagem PNG', extensions: ['png'] }],
      content: base64,
      isBase64: true
    });
  };

  // ── Keyboard Shortcuts ────────────────────────────────────────────────────
  document.addEventListener('keydown', e => {
    const active = document.activeElement;
    const onCanvas = active === canvas || active === document.body;
    if (!onCanvas && active !== document.body) return;
    if (document.querySelector('#diagramView.hidden')) return;

    if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !editSh && !editingTable) {
      e.preventDefault();
      shapes = shapes.filter(s => s !== sel);
      sel = null; hideColorPicker(); saveDiagram(); draw();
    }
    if (!e.ctrlKey && !e.metaKey && !editSh && !editingTable) {
      const modeMap = { v: 'select', r: 'rect', e: 'circle', d: 'diamond', a: 'arrow', t: 'text' };
      if (modeMap[e.key.toLowerCase()]) { commitLabel(); setMode(modeMap[e.key.toLowerCase()]); }
    }
    if (e.key === 'Escape') {
      commitLabel();
      if (editingTable) closeTableModal();
      setMode('select');
    }
    if (e.key === '+') { zoom = Math.min(3, zoom + 0.15); draw(); }
    if (e.key === '-') { zoom = Math.max(0.25, zoom - 0.15); draw(); }
    if (e.key === '0') { zoom = 1; viewX = 0; viewY = 0; draw(); }
  });

  // ── Persistence ───────────────────────────────────────────────────────────
  function saveDiagram() {
    window.appStorage.set({ diagram: JSON.stringify({ shapes, nextId, viewX, viewY, zoom }) });
  }

  window.appStorage.get('diagram', r => {
    if (r?.diagram) {
      try {
        const d = JSON.parse(r.diagram);
        shapes = d.shapes || []; nextId = d.nextId || 1;
        viewX = d.viewX || 0; viewY = d.viewY || 0; zoom = d.zoom || 1;
      } catch {}
    }
    draw();
  });
})();
