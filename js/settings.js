'use strict';
// ── SETTINGS ─────────────────────────────────────────

const THEMES = {
  dark: {
    label: 'Dark (padrão)',
    vars: {
      '--accent':'#0EA5E9','--accent-d':'#0284C7',
      '--accent-g':'rgba(14,165,233,.12)','--accent-gb':'rgba(14,165,233,.06)',
      '--bg':'#0b0b0f','--s1':'#111116','--s2':'#18181f','--s3':'#202028','--s4':'#282832',
      '--border':'#25252f','--border2':'#2e2e3a',
      '--text':'#e2e2ec','--text2':'#a0a0b8','--muted':'#52526a',
      '--add':'#22c55e','--add-bg':'rgba(34,197,94,.1)',
      '--del':'#f43f5e','--del-bg':'rgba(244,63,94,.1)',
      '--warn':'#f59e0b',
    }
  },
  midnight: {
    label: 'Midnight Blue',
    vars: {
      '--accent':'#818cf8','--accent-d':'#6366f1',
      '--accent-g':'rgba(129,140,248,.13)','--accent-gb':'rgba(129,140,248,.06)',
      '--bg':'#070b14','--s1':'#0d1220','--s2':'#131929','--s3':'#192133','--s4':'#1f2940',
      '--border':'#1e2d45','--border2':'#253553',
      '--text':'#e0e8ff','--text2':'#8899cc','--muted':'#445577',
      '--add':'#34d399','--add-bg':'rgba(52,211,153,.1)',
      '--del':'#fb7185','--del-bg':'rgba(251,113,133,.1)',
      '--warn':'#fbbf24',
    }
  },
  forest: {
    label: 'Forest Dark',
    vars: {
      '--accent':'#4ade80','--accent-d':'#22c55e',
      '--accent-g':'rgba(74,222,128,.12)','--accent-gb':'rgba(74,222,128,.06)',
      '--bg':'#080f0a','--s1':'#0e1811','--s2':'#142018','--s3':'#1a2a1e','--s4':'#203526',
      '--border':'#1e3022','--border2':'#28402e',
      '--text':'#d4f0dc','--text2':'#7db88e','--muted':'#3d6b4a',
      '--add':'#86efac','--add-bg':'rgba(134,239,172,.1)',
      '--del':'#fca5a5','--del-bg':'rgba(252,165,165,.1)',
      '--warn':'#fde68a',
    }
  },
  sunset: {
    label: 'Sunset',
    vars: {
      '--accent':'#f97316','--accent-d':'#ea580c',
      '--accent-g':'rgba(249,115,22,.12)','--accent-gb':'rgba(249,115,22,.06)',
      '--bg':'#0f0905','--s1':'#1a100a','--s2':'#22160e','--s3':'#2c1d14','--s4':'#38241a',
      '--border':'#3a2010','--border2':'#4a2e1c',
      '--text':'#fde8d8','--text2':'#c4917a','--muted':'#7a4c38',
      '--add':'#86efac','--add-bg':'rgba(134,239,172,.1)',
      '--del':'#fca5a5','--del-bg':'rgba(252,165,165,.1)',
      '--warn':'#fde68a',
    }
  },
  light: {
    label: 'Light',
    vars: {
      '--accent':'#0EA5E9','--accent-d':'#0284C7',
      '--accent-g':'rgba(14,165,233,.1)','--accent-gb':'rgba(14,165,233,.05)',
      '--bg':'#f8fafc','--s1':'#f1f5f9','--s2':'#e8edf4','--s3':'#dde4ee','--s4':'#d0d9e8',
      '--border':'#cbd5e1','--border2':'#b8c4d4',
      '--text':'#0f172a','--text2':'#334155','--muted':'#64748b',
      '--add':'#16a34a','--add-bg':'rgba(22,163,74,.1)',
      '--del':'#dc2626','--del-bg':'rgba(220,38,38,.1)',
      '--warn':'#d97706',
    }
  },
  rose: {
    label: 'Rose Dark',
    vars: {
      '--accent':'#f43f5e','--accent-d':'#e11d48',
      '--accent-g':'rgba(244,63,94,.12)','--accent-gb':'rgba(244,63,94,.06)',
      '--bg':'#0f080b','--s1':'#180d12','--s2':'#201219','--s3':'#2a1822','--s4':'#351e2c',
      '--border':'#3d1f2e','--border2':'#4d2a3d',
      '--text':'#ffe4ec','--text2':'#c98aa0','--muted':'#7a4560',
      '--add':'#86efac','--add-bg':'rgba(134,239,172,.1)',
      '--del':'#fca5a5','--del-bg':'rgba(252,165,165,.1)',
      '--warn':'#fde68a',
    }
  },
};

const POPUP_SIZES = {
  small:   { label: 'Pequeno (700×520)',  w: 700, h: 520 },
  medium:  { label: 'Médio (820×600)',    w: 820, h: 600 },
  large:   { label: 'Grande (1000×680)',  w:1000, h: 680 },
  xlarge:  { label: 'Extra grande (1200×760)', w:1200, h: 760 },
};

// All hideable views with labels
const HIDEABLE_VIEWS = [
  { id:'json',        label:'JSON Pretty',      section:'Core' },
  { id:'diff',        label:'Diff Check',       section:'Core' },
  { id:'mock',        label:'Details Mock',     section:'Core' },
  { id:'playground',  label:'JS Playground',    section:'Core' },
  { id:'diagram',     label:'Automatos',        section:'Core' },
  { id:'productivity',label:'Produtividade',    section:'Core' },
  { id:'base64',      label:'Base64',           section:'Utilitários' },
  { id:'url',         label:'URL Tools',        section:'Utilitários' },
  { id:'jwt',         label:'JWT Decoder',      section:'Utilitários' },
  { id:'regex',       label:'Regex Tester',     section:'Utilitários' },
  { id:'timestamp',   label:'Timestamp',        section:'Utilitários' },
  { id:'cron',        label:'Cron / Quartz',    section:'Utilitários' },
  { id:'uuid',        label:'UUID',             section:'Geradores' },
  { id:'hash',        label:'Hash',             section:'Geradores' },
  { id:'color',       label:'Cores',            section:'Geradores' },
  { id:'jsonschema',  label:'JSON Schema',      section:'Geradores' },
];

let currentSettings = {
  theme: 'dark',
  size: 'medium',
  hidden: [],
  accentCustom: null,
};

// ── Apply settings to DOM ─────────────────────────────
function applySettings(r) {
  const stored = r.settings ? JSON.parse(r.settings) : {};
  currentSettings = { ...currentSettings, ...stored };
  applyTheme(currentSettings.theme, currentSettings.accentCustom);
  applySize(currentSettings.size);
  applyHiddenViews(currentSettings.hidden);
  renderSettingsUI();
}
window.applySettings = applySettings;

function applyTheme(themeKey, accentOverride) {
  const theme = THEMES[themeKey] || THEMES.dark;
  const root  = document.documentElement;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  if (accentOverride) {
    root.style.setProperty('--accent', accentOverride);
    root.style.setProperty('--accent-d', accentOverride);
    root.style.setProperty('--accent-g', accentOverride.replace('#', 'rgba(') + '1a)');
  }
  // Light theme needs special scrollbar + code text color
  if (themeKey === 'light') {
    document.body.classList.add('theme-light');
  } else {
    document.body.classList.remove('theme-light');
  }
}

function applySize(sizeKey) {
  const size = POPUP_SIZES[sizeKey] || POPUP_SIZES.medium;
  document.body.style.width  = size.w + 'px';
  document.body.style.height = size.h + 'px';
  document.documentElement.style.width  = size.w + 'px';
  document.documentElement.style.height = size.h + 'px';
}

function applyHiddenViews(hidden = []) {
  HIDEABLE_VIEWS.forEach(({ id }) => {
    const navItem = document.querySelector(`.nav-item[data-view="${id}"]`);
    if (navItem) navItem.style.display = hidden.includes(id) ? 'none' : '';
  });
}

function saveSettings() {
  save('settings', JSON.stringify(currentSettings));
}

// ── Render Settings UI ────────────────────────────────
function renderSettingsUI() {
  const container = $('settingsThemeGrid');
  if (!container) return;

  // Themes
  container.innerHTML = '';
  Object.entries(THEMES).forEach(([key, theme]) => {
    const v = theme.vars;
    const card = document.createElement('div');
    card.className = 'settings-theme-card' + (currentSettings.theme === key ? ' active' : '');
    card.innerHTML = `
      <div class="stc-preview" style="background:${v['--bg']};border-color:${v['--border2']}">
        <div class="stc-sidebar" style="background:${v['--s1']};border-color:${v['--border']}">
          <div class="stc-dot" style="background:${v['--accent']}"></div>
          <div class="stc-line" style="background:${v['--muted']}"></div>
          <div class="stc-line" style="background:${v['--muted']}"></div>
          <div class="stc-line" style="background:${v['--muted']}"></div>
        </div>
        <div class="stc-main" style="background:${v['--bg']}">
          <div class="stc-head" style="background:${v['--s1']};border-color:${v['--border']}"></div>
          <div class="stc-body">
            <div class="stc-text" style="background:${v['--text2']}"></div>
            <div class="stc-text short" style="background:${v['--muted']}"></div>
            <div class="stc-btn" style="background:${v['--accent']}"></div>
          </div>
        </div>
      </div>
      <div class="stc-label" style="color:var(--text2)">${theme.label}</div>
    `;
    card.onclick = () => {
      currentSettings.theme = key;
      currentSettings.accentCustom = null;
      saveSettings();
      applyTheme(key, null);
      renderSettingsUI();
    };
    container.appendChild(card);
  });

  // Size
  const sizeSelect = $('settingsSizeSelect');
  if (sizeSelect) {
    sizeSelect.innerHTML = Object.entries(POPUP_SIZES)
      .map(([k,v]) => `<option value="${k}" ${currentSettings.size===k?'selected':''}>${v.label}</option>`)
      .join('');
    sizeSelect.onchange = () => {
      currentSettings.size = sizeSelect.value;
      applySize(currentSettings.size);
      saveSettings();
    };
  }

  // Accent override
  const accentInput = $('settingsAccentColor');
  if (accentInput) {
    accentInput.value = currentSettings.accentCustom || THEMES[currentSettings.theme]?.vars['--accent'] || '#0EA5E9';
    accentInput.oninput = () => {
      currentSettings.accentCustom = accentInput.value;
      applyTheme(currentSettings.theme, accentInput.value);
      saveSettings();
    };
  }
  const accentReset = $('settingsAccentReset');
  if (accentReset) {
    accentReset.onclick = () => {
      currentSettings.accentCustom = null;
      saveSettings();
      applyTheme(currentSettings.theme, null);
      if (accentInput) accentInput.value = THEMES[currentSettings.theme]?.vars['--accent'] || '#0EA5E9';
    };
  }

  // Hidden views checkboxes
  const hvContainer = $('settingsHiddenViews');
  if (hvContainer) {
    hvContainer.innerHTML = '';
    let lastSection = '';
    HIDEABLE_VIEWS.forEach(({ id, label, section }) => {
      if (section !== lastSection) {
        const sec = document.createElement('div');
        sec.className = 'settings-section-lbl';
        sec.textContent = section;
        hvContainer.appendChild(sec);
        lastSection = section;
      }
      const row = document.createElement('label');
      row.className = 'settings-toggle-row';
      const checked = !currentSettings.hidden.includes(id);
      row.innerHTML = `
        <span class="settings-toggle-label">${label}</span>
        <span class="stoggle ${checked ? 'on' : ''}" data-id="${id}"></span>
      `;
      row.querySelector('.stoggle').onclick = function() {
        const isOn = this.classList.toggle('on');
        if (isOn) {
          currentSettings.hidden = currentSettings.hidden.filter(v => v !== id);
        } else {
          if (!currentSettings.hidden.includes(id)) currentSettings.hidden.push(id);
        }
        applyHiddenViews(currentSettings.hidden);
        saveSettings();
        // If current view was hidden, go to first visible
        const active = document.querySelector('.nav-item.active');
        if (active && active.style.display === 'none') {
          const first = document.querySelector('.nav-item[data-view]:not([style*="none"])');
          if (first) switchView(first.dataset.view);
        }
      };
      hvContainer.appendChild(row);
    });
  }
}
