'use strict';
// ── PRODUTIVIDADE: Épicos, Checklist, Anotações ───────

let prodData = {
  epics: [],          // [{ id, name, color }]
  tasks: [],          // [{ id, epicId, title, details, done, createdAt }]
  notes: [],          // [{ id, epicId, title, content, createdAt, updatedAt }]
  activeEpic: null,   // id | null (null = all)
  activeTab: 'tasks', // 'tasks' | 'notes'
};

const EPIC_COLORS = ['#0EA5E9','#22c55e','#f59e0b','#f43f5e','#a78bfa','#fb923c','#34d399','#818cf8'];

function saveProd() {
  save('productivity', JSON.stringify(prodData));
}

function loadProductivity(r) {
  if (r.productivity) {
    try { Object.assign(prodData, JSON.parse(r.productivity)); } catch {}
  }
  renderProd();
}
window.loadProductivity = loadProductivity;

// ── Helpers ───────────────────────────────────────────
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function getFilteredTasks() {
  return prodData.activeEpic
    ? prodData.tasks.filter(t => t.epicId === prodData.activeEpic)
    : prodData.tasks;
}

function getFilteredNotes() {
  return prodData.activeEpic
    ? prodData.notes.filter(n => n.epicId === prodData.activeEpic)
    : prodData.notes;
}

function epicById(id) { return prodData.epics.find(e => e.id === id); }

function epicColorStyle(epicId) {
  const e = epicById(epicId);
  return e ? e.color : 'var(--muted)';
}

// ── RENDER ────────────────────────────────────────────
function renderProd() {
  renderEpicList();
  renderTabContent();
}

function renderEpicList() {
  const el = $('prodEpicList');
  if (!el) return;
  const all = prodData.epics;

  let html = `<div class="prod-epic-item ${!prodData.activeEpic ? 'active' : ''}" data-epic="all">
    <span class="prod-epic-dot" style="background:var(--accent)"></span>
    <span class="prod-epic-name">Todos</span>
    <span class="prod-epic-count">${prodData.tasks.length}</span>
  </div>`;

  all.forEach(e => {
    const count = prodData.tasks.filter(t => t.epicId === e.id).length;
    html += `<div class="prod-epic-item ${prodData.activeEpic === e.id ? 'active' : ''}" data-epic="${e.id}">
      <span class="prod-epic-dot" style="background:${e.color}"></span>
      <span class="prod-epic-name">${esc(e.name)}</span>
      <span class="prod-epic-count">${count}</span>
      <button class="prod-epic-del" data-id="${e.id}" title="Deletar épico">×</button>
    </div>`;
  });

  el.innerHTML = html;

  el.querySelectorAll('.prod-epic-item').forEach(item => {
    item.onclick = (ev) => {
      if (ev.target.classList.contains('prod-epic-del')) return;
      const val = item.dataset.epic;
      prodData.activeEpic = val === 'all' ? null : val;
      renderProd();
    };
  });
  el.querySelectorAll('.prod-epic-del').forEach(btn => {
    btn.onclick = (ev) => {
      ev.stopPropagation();
      const id = btn.dataset.id;
      if (!confirm('Deletar épico e todas suas tarefas/anotações?')) return;
      prodData.epics  = prodData.epics.filter(e => e.id !== id);
      prodData.tasks  = prodData.tasks.filter(t => t.epicId !== id);
      prodData.notes  = prodData.notes.filter(n => n.epicId !== id);
      if (prodData.activeEpic === id) prodData.activeEpic = null;
      saveProd(); renderProd();
    };
  });
}

function renderTabContent() {
  const tasksTab = $('prodTabTasks');
  const notesTab = $('prodTabNotes');
  if (tasksTab) tasksTab.classList.toggle('active', prodData.activeTab === 'tasks');
  if (notesTab) notesTab.classList.toggle('active', prodData.activeTab === 'notes');

  const content = $('prodContent');
  if (!content) return;

  if (prodData.activeTab === 'tasks') {
    renderTasks(content);
  } else {
    renderNotes(content);
  }
}

function renderTasks(container) {
  const tasks = getFilteredTasks();
  const done  = tasks.filter(t => t.done).length;
  const pct   = tasks.length ? Math.round(done / tasks.length * 100) : 0;

  let html = `
    <div class="prod-toolbar">
      <div class="prod-progress">
        <div class="prod-progress-bar"><div class="prod-progress-fill" style="width:${pct}%"></div></div>
        <span class="prod-progress-lbl">${done}/${tasks.length} concluídas</span>
      </div>
      <button class="prod-add-btn" id="prodAddTaskBtn">+ Tarefa</button>
    </div>
    <div id="prodAddTaskForm" class="prod-add-form" style="display:none">
      <input id="prodTaskTitle" class="prod-inp" placeholder="Título da tarefa…" maxlength="120"/>
      <textarea id="prodTaskDetails" class="prod-txta" placeholder="Detalhes (opcional)…" rows="2"></textarea>
      <div class="prod-form-row">
        <select id="prodTaskEpic" class="prod-select">
          <option value="">— Sem épico —</option>
          ${prodData.epics.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}
        </select>
        <button class="prod-save-btn" id="prodSaveTaskBtn">Salvar</button>
        <button class="prod-cancel-btn" id="prodCancelTaskBtn">Cancelar</button>
      </div>
    </div>
  `;

  if (tasks.length === 0) {
    html += `<div class="prod-empty">Nenhuma tarefa. Clique em "+ Tarefa" para começar.</div>`;
  } else {
    // Group: pending first, done last
    const pending = tasks.filter(t => !t.done);
    const doneArr = tasks.filter(t => t.done);

    html += '<div class="prod-task-list" id="prodTaskList">';
    [...pending, ...doneArr].forEach(t => {
      const epic = epicById(t.epicId);
      html += `
        <div class="prod-task ${t.done ? 'done' : ''}" data-id="${t.id}">
          <div class="prod-task-head">
            <button class="prod-check ${t.done ? 'checked' : ''}" data-id="${t.id}">
              ${t.done ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            </button>
            <span class="prod-task-title ${t.done ? 'strikethrough' : ''}">${esc(t.title)}</span>
            ${epic ? `<span class="prod-task-epic-tag" style="background:${epic.color}22;color:${epic.color};border-color:${epic.color}44">${esc(epic.name)}</span>` : ''}
            <div class="prod-task-actions">
              ${t.details ? `<button class="prod-expand-btn" data-id="${t.id}" title="Ver detalhes">⋯</button>` : ''}
              <button class="prod-edit-btn" data-id="${t.id}" title="Editar">✎</button>
              <button class="prod-del-btn" data-id="${t.id}" title="Deletar">×</button>
            </div>
          </div>
          ${t.details ? `<div class="prod-task-details" id="details-${t.id}" style="display:none">${esc(t.details)}</div>` : ''}
        </div>`;
    });
    html += '</div>';
  }

  container.innerHTML = html;

  // Wire events
  $('prodAddTaskBtn').onclick = () => {
    $('prodAddTaskForm').style.display = 'block';
    $('prodAddTaskBtn').style.display  = 'none';
    $('prodTaskTitle').focus();
    // Pre-select active epic
    if (prodData.activeEpic) $('prodTaskEpic').value = prodData.activeEpic;
  };

  $('prodCancelTaskBtn').onclick = () => {
    $('prodAddTaskForm').style.display = 'none';
    $('prodAddTaskBtn').style.display  = 'block';
    $('prodTaskTitle').value = ''; $('prodTaskDetails').value = '';
  };

  $('prodSaveTaskBtn').onclick = () => {
    const title = $('prodTaskTitle').value.trim();
    if (!title) { $('prodTaskTitle').focus(); return; }
    const task = {
      id: genId(), epicId: $('prodTaskEpic').value || null,
      title, details: $('prodTaskDetails').value.trim(),
      done: false, createdAt: Date.now()
    };
    prodData.tasks.unshift(task);
    saveProd(); renderTasks(container);
  };

  $('prodTaskTitle')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('prodSaveTaskBtn').click(); }
  });

  container.querySelectorAll('.prod-check').forEach(btn => {
    btn.onclick = () => {
      const t = prodData.tasks.find(t => t.id === btn.dataset.id);
      if (t) { t.done = !t.done; saveProd(); renderTasks(container); }
    };
  });

  container.querySelectorAll('.prod-expand-btn').forEach(btn => {
    btn.onclick = () => {
      const det = $(`details-${btn.dataset.id}`);
      if (det) {
        const open = det.style.display !== 'none';
        det.style.display = open ? 'none' : 'block';
        btn.textContent = open ? '⋯' : '⌃';
      }
    };
  });

  container.querySelectorAll('.prod-del-btn').forEach(btn => {
    btn.onclick = () => {
      prodData.tasks = prodData.tasks.filter(t => t.id !== btn.dataset.id);
      saveProd(); renderTasks(container);
    };
  });

  container.querySelectorAll('.prod-edit-btn').forEach(btn => {
    btn.onclick = () => {
      const t = prodData.tasks.find(t => t.id === btn.dataset.id);
      if (!t) return;
      const newTitle = prompt('Editar título:', t.title);
      if (newTitle === null) return;
      if (newTitle.trim()) t.title = newTitle.trim();
      const newDetails = prompt('Editar detalhes:', t.details || '');
      if (newDetails !== null) t.details = newDetails.trim();
      saveProd(); renderTasks(container);
    };
  });
}

function renderNotes(container) {
  const notes = getFilteredNotes();

  let html = `
    <div class="prod-toolbar">
      <span class="prod-note-count">${notes.length} anotaç${notes.length !== 1 ? 'ões' : 'ão'}</span>
      <button class="prod-add-btn" id="prodAddNoteBtn">+ Anotação</button>
    </div>
    <div id="prodAddNoteForm" class="prod-add-form" style="display:none">
      <input id="prodNoteTitle" class="prod-inp" placeholder="Título da anotação…" maxlength="120"/>
      <textarea id="prodNoteContent" class="prod-txta" placeholder="Conteúdo…" rows="4"></textarea>
      <div class="prod-form-row">
        <select id="prodNoteEpic" class="prod-select">
          <option value="">— Sem épico —</option>
          ${prodData.epics.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}
        </select>
        <button class="prod-save-btn" id="prodSaveNoteBtn">Salvar</button>
        <button class="prod-cancel-btn" id="prodCancelNoteBtn">Cancelar</button>
      </div>
    </div>
  `;

  if (notes.length === 0) {
    html += `<div class="prod-empty">Nenhuma anotação. Clique em "+ Anotação" para criar.</div>`;
  } else {
    html += '<div class="prod-notes-grid" id="prodNotesList">';
    notes.forEach(n => {
      const epic = epicById(n.epicId);
      const date = new Date(n.updatedAt || n.createdAt).toLocaleDateString('pt-BR');
      html += `
        <div class="prod-note-card" data-id="${n.id}">
          <div class="prod-note-head">
            <span class="prod-note-title">${esc(n.title)}</span>
            <div class="prod-note-actions">
              <span class="prod-note-date">${date}</span>
              <button class="prod-edit-btn" data-id="${n.id}">✎</button>
              <button class="prod-del-btn" data-id="${n.id}">×</button>
            </div>
          </div>
          ${epic ? `<div class="prod-note-epic" style="color:${epic.color}">${esc(epic.name)}</div>` : ''}
          <div class="prod-note-preview">${esc(n.content.slice(0,180))}${n.content.length > 180 ? '…' : ''}</div>
        </div>`;
    });
    html += '</div>';
  }

  container.innerHTML = html;

  $('prodAddNoteBtn').onclick = () => {
    $('prodAddNoteForm').style.display = 'block';
    $('prodAddNoteBtn').style.display  = 'none';
    $('prodNoteTitle').focus();
    if (prodData.activeEpic) $('prodNoteEpic').value = prodData.activeEpic;
  };

  $('prodCancelNoteBtn').onclick = () => {
    $('prodAddNoteForm').style.display = 'none';
    $('prodAddNoteBtn').style.display  = 'block';
    $('prodNoteTitle').value = ''; $('prodNoteContent').value = '';
  };

  $('prodSaveNoteBtn').onclick = () => {
    const title   = $('prodNoteTitle').value.trim();
    const content = $('prodNoteContent').value.trim();
    if (!title) { $('prodNoteTitle').focus(); return; }
    const note = {
      id: genId(), epicId: $('prodNoteEpic').value || null,
      title, content, createdAt: Date.now(), updatedAt: Date.now()
    };
    prodData.notes.unshift(note);
    saveProd(); renderNotes(container);
  };

  container.querySelectorAll('.prod-del-btn').forEach(btn => {
    btn.onclick = () => {
      prodData.notes = prodData.notes.filter(n => n.id !== btn.dataset.id);
      saveProd(); renderNotes(container);
    };
  });

  container.querySelectorAll('.prod-edit-btn').forEach(btn => {
    btn.onclick = () => {
      const n = prodData.notes.find(n => n.id === btn.dataset.id);
      if (!n) return;
      openNoteEditor(n, () => { saveProd(); renderNotes(container); });
    };
  });

  container.querySelectorAll('.prod-note-card').forEach(card => {
    card.ondblclick = (e) => {
      if (e.target.closest('button')) return;
      const n = prodData.notes.find(n => n.id === card.dataset.id);
      if (n) openNoteEditor(n, () => { saveProd(); renderNotes(container); });
    };
  });
}

// ── Note editor modal ─────────────────────────────────
function openNoteEditor(note, onSave) {
  let modal = $('prodNoteModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'prodNoteModal';
    modal.className = 'prod-modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="prod-modal">
      <div class="prod-modal-head">
        <input id="pmTitle" class="prod-inp" value="${esc(note.title)}" placeholder="Título…"/>
        <button id="pmClose" class="prod-modal-close">×</button>
      </div>
      <div class="prod-modal-epic-row">
        <select id="pmEpic" class="prod-select">
          <option value="">— Sem épico —</option>
          ${prodData.epics.map(e => `<option value="${e.id}" ${note.epicId===e.id?'selected':''}>${esc(e.name)}</option>`).join('')}
        </select>
      </div>
      <textarea id="pmContent" class="prod-modal-ta" placeholder="Conteúdo…">${esc(note.content)}</textarea>
      <div class="prod-modal-foot">
        <span class="prod-modal-date">Atualizado: ${new Date(note.updatedAt||note.createdAt).toLocaleString('pt-BR')}</span>
        <button id="pmSave" class="prod-save-btn">Salvar</button>
      </div>
    </div>
  `;

  modal.style.display = 'flex';

  $('pmClose').onclick = () => { modal.style.display = 'none'; };
  modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };

  $('pmSave').onclick = () => {
    note.title   = $('pmTitle').value.trim() || note.title;
    note.content = $('pmContent').value;
    note.epicId  = $('pmEpic').value || null;
    note.updatedAt = Date.now();
    modal.style.display = 'none';
    onSave();
  };

  $('pmContent').focus();
}

// ── Epic management ───────────────────────────────────
function setupEpicManagement() {
  const addBtn = $('prodAddEpicBtn');
  const inp    = $('prodEpicInput');
  if (!addBtn || !inp) return;

  addBtn.onclick = () => {
    const name = inp.value.trim();
    if (!name) { inp.focus(); return; }
    const color = EPIC_COLORS[prodData.epics.length % EPIC_COLORS.length];
    prodData.epics.push({ id: genId(), name, color });
    inp.value = '';
    saveProd(); renderProd();
  };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') addBtn.click(); });

  $('prodTabTasks')?.addEventListener('click', () => { prodData.activeTab = 'tasks'; renderTabContent(); });
  $('prodTabNotes')?.addEventListener('click', () => { prodData.activeTab = 'notes'; renderTabContent(); });
}

document.addEventListener('DOMContentLoaded', setupEpicManagement);
