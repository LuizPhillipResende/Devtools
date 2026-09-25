const { app, BrowserWindow, ipcMain, dialog, clipboard, desktopCapturer, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
const userDataPath = app.getPath('userData');
const storeFilePath = path.join(userDataPath, 'devtools-store.json');

// In-memory cache of stored data
let storeData = {};
try {
  if (fs.existsSync(storeFilePath)) {
    const raw = fs.readFileSync(storeFilePath, 'utf8');
    storeData = JSON.parse(raw);
  }
} catch (e) {
  console.error('Error loading persistent store:', e);
  storeData = {};
}

function persistStore() {
  try {
    fs.writeFileSync(storeFilePath, JSON.stringify(storeData, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving store to disk:', e);
  }
}

function createWindow() {
  const windowState = storeData['__window_state'] || { width: 1280, height: 820 };

  // Remove default white menu bar
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: windowState.width || 1280,
    height: windowState.height || 820,
    minWidth: 980,
    minHeight: 640,
    title: 'DevTools CORP',
    icon: fs.existsSync(path.join(__dirname, 'icons', 'icon.ico'))
      ? path.join(__dirname, 'icons', 'icon.ico')
      : path.join(__dirname, 'icons', 'icon256.png'),
    backgroundColor: '#0b0b0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false
    },
    // Modern Windows titlebar integration: dark background matching theme with embedded native controls
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#111116',
      symbolColor: '#a0a0b8',
      height: 38
    },
    autoHideMenuBar: true
  });

  mainWindow.loadFile('popup.html');

  // Save window size on resize
  mainWindow.on('resize', () => {
    if (!mainWindow.isMaximized()) {
      const [w, h] = mainWindow.getSize();
      storeData['__window_state'] = { width: w, height: h };
      persistStore();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── IPC Handlers ────────────────────────────────────────────────────────────

// 1. File Dialogs & FS operations
ipcMain.handle('dialog:openFile', async (event, options = {}) => {
  const { title = 'Abrir Arquivo', filters = [], readAs = 'utf8' } = options;
  const result = await dialog.showOpenDialog(mainWindow, {
    title,
    filters,
    properties: ['openFile']
  });

  if (result.canceled || !result.filePaths.length) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  try {
    let content;
    if (readAs === 'base64') {
      const buf = await fs.promises.readFile(filePath);
      content = buf.toString('base64');
    } else {
      content = await fs.promises.readFile(filePath, 'utf8');
    }
    return {
      canceled: false,
      filePath,
      fileName: path.basename(filePath),
      content
    };
  } catch (err) {
    return { canceled: false, error: err.message };
  }
});

ipcMain.handle('dialog:saveFile', async (event, options = {}) => {
  const { title = 'Salvar Arquivo', defaultPath = '', filters = [], content = '', isBase64 = false } = options;
  const result = await dialog.showSaveDialog(mainWindow, {
    title,
    defaultPath,
    filters
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  try {
    if (isBase64) {
      const buffer = Buffer.from(content, 'base64');
      await fs.promises.writeFile(result.filePath, buffer);
    } else {
      await fs.promises.writeFile(result.filePath, content, 'utf8');
    }
    return { canceled: false, filePath: result.filePath, fileName: path.basename(result.filePath) };
  } catch (err) {
    return { canceled: false, error: err.message };
  }
});

// 2. Desktop Screenshot Capture (Screen & Window Sources)
ipcMain.handle('desktop:captureScreen', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 1920, height: 1080 }
    });

    const captures = sources.map(s => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL()
    }));

    return { success: true, sources: captures };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 3. Native Clipboard Image
ipcMain.handle('clipboard:readImage', () => {
  try {
    const image = clipboard.readImage();
    if (image.isEmpty()) {
      return { hasImage: false, dataUrl: null };
    }
    return { hasImage: true, dataUrl: image.toDataURL() };
  } catch (err) {
    return { hasImage: false, error: err.message };
  }
});

ipcMain.handle('clipboard:readText', () => {
  return clipboard.readText();
});

ipcMain.handle('clipboard:writeText', (event, text) => {
  clipboard.writeText(text);
  return true;
});

// 4. Persistent Storage (File-backed in %APPDATA%)
ipcMain.handle('storage:get', (event, keys) => {
  if (!keys) return { ...storeData };
  if (typeof keys === 'string') {
    return { [keys]: storeData[keys] };
  }
  if (Array.isArray(keys)) {
    const res = {};
    keys.forEach(k => { res[k] = storeData[k]; });
    return res;
  }
  if (typeof keys === 'object') {
    const res = {};
    Object.keys(keys).forEach(k => {
      res[k] = storeData[k] !== undefined ? storeData[k] : keys[k];
    });
    return res;
  }
  return { ...storeData };
});

ipcMain.handle('storage:set', (event, items) => {
  if (typeof items === 'object') {
    Object.assign(storeData, items);
    persistStore();
  }
  return true;
});

ipcMain.handle('storage:clear', () => {
  storeData = {};
  persistStore();
  return true;
});

// 5. Open External Links
ipcMain.handle('shell:openExternal', (event, url) => {
  shell.openExternal(url);
  return true;
});

// 6. Window Controls
ipcMain.handle('window:minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.handle('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});
ipcMain.handle('window:close', () => { if (mainWindow) mainWindow.close(); });
ipcMain.handle('window:isMaximized', () => mainWindow ? mainWindow.isMaximized() : false);

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
