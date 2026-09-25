const { app, BrowserWindow, ipcMain, dialog, clipboard, desktopCapturer } = require('electron');
const path = require('path');
const fs = require('fs');

let storeData = {};

ipcMain.handle('storage:get', (event, keys) => {
  if (!keys) return { ...storeData };
  if (typeof keys === 'string') return { [keys]: storeData[keys] };
  if (Array.isArray(keys)) {
    const res = {};
    keys.forEach(k => { res[k] = storeData[k]; });
    return res;
  }
  return { ...storeData };
});

ipcMain.handle('storage:set', (event, items) => {
  if (typeof items === 'object') Object.assign(storeData, items);
  return true;
});

ipcMain.handle('storage:clear', () => {
  storeData = {};
  return true;
});

ipcMain.handle('dialog:openFile', async () => ({ canceled: true }));
ipcMain.handle('dialog:saveFile', async () => ({ canceled: true }));
ipcMain.handle('clipboard:readImage', () => ({ hasImage: false, dataUrl: null }));
ipcMain.handle('clipboard:readText', () => '');
ipcMain.handle('clipboard:writeText', () => true);
ipcMain.handle('desktop:captureScreen', async () => ({ success: true, sources: [] }));
ipcMain.handle('shell:openExternal', () => true);

app.whenReady().then(async () => {
  console.log('--- TEST RUNNER STARTING ---');
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const errors = [];

  win.webContents.on('console-message', (event) => {
    if (event.level === 3) {
      errors.push(event.message);
    }
  });

  await win.loadFile('popup.html');

  // Wait 1.5 seconds for all scripts and DOM to initialize
  await new Promise(r => setTimeout(r, 1500));

  const evaluation = await win.webContents.executeJavaScript(`
    (async () => {
      const results = {};

      // 1. Check window globals & libraries
      results.hasCodeMirror = typeof CodeMirror !== 'undefined';
      results.hasDiffMatchPatch = typeof diff_match_patch !== 'undefined';
      results.hasZXing = typeof ZXing !== 'undefined';
      results.hasQRCode = typeof qrcode !== 'undefined';
      results.hasJsBarcode = typeof JsBarcode !== 'undefined';
      results.hasElectronAPI = typeof window.electronAPI !== 'undefined';
      results.hasAppStorage = typeof window.appStorage !== 'undefined';

      // 2. Test view switching
      const views = [
        'json', 'diff', 'playground', 'diagram', 'productivity',
        'mock', 'qrcode', 'base64', 'url', 'jwt', 'regex',
        'timestamp', 'cron', 'uuid', 'hash', 'color', 'jsonschema', 'settings'
      ];
      results.viewElements = {};
      views.forEach(v => {
        const el = document.getElementById(v + 'View');
        results.viewElements[v] = !!el;
      });

      // 3. Test QR Generator
      try {
        const qr = qrcode(0, 'M');
        qr.addData('https://devtools-corp.local');
        qr.make();
        results.qrGeneratorWorks = qr.getModuleCount() > 0;
      } catch (e) {
        results.qrGeneratorError = e.message;
      }

      // 4. Test Automatos XML export logic
      try {
        const xmlSample = \`<?xml version="1.0" encoding="UTF-8"?>
<automatos_diagram version="2.0">
  <database_tables>
    <table id="1" name="users" x="100" y="100" width="200" height="100">
      <columns>
        <column name="id" type="BIGINT" pk="true" fk="false" />
        <column name="email" type="VARCHAR(255)" pk="false" />
      </columns>
    </table>
  </database_tables>
</automatos_diagram>\`;
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlSample, 'application/xml');
        results.xmlParserWorks = !doc.querySelector('parsererror') && !!doc.querySelector('table');
      } catch (e) {
        results.xmlParserError = e.message;
      }

      // 5. Test Playground async execution function
      try {
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const fn = new AsyncFunction('return 40 + 2');
        const res = await fn();
        results.asyncExecutionWorks = res === 42;
      } catch (e) {
        results.asyncExecutionError = e.message;
      }

      // 6. Test Diff Check computeDiff
      try {
        const ops = window.computeDiff("linha 1\\nlinha 2", "linha 1\\nlinha 2 mod\\nlinha 3");
        results.computeDiffWorks = ops.length >= 2;
      } catch (e) {
        results.computeDiffError = e.message;
      }

      // 7. Test App Storage bridge roundtrip
      try {
        await new Promise(resolve => {
          window.appStorage.set({ test_key: 'test_val' }, () => {
            window.appStorage.get('test_key', val => {
              results.appStorageWorks = val.test_key === 'test_val';
              resolve();
            });
          });
        });
      } catch (e) {
        results.appStorageError = e.message;
      }

      return results;
    })()
  `);

  console.log('TEST RESULTS:\n', JSON.stringify(evaluation, null, 2));

  if (errors.length > 0) {
    console.error('CONSOLE ERRORS DETECTED:', errors);
  } else {
    console.log('✓ PERFECT: ZERO CONSOLE ERRORS DETECTED IN RENDERER PROCESS!');
  }

  const image = await win.webContents.capturePage();
  const screenPath = path.join(__dirname, 'app_screenshot.png');
  fs.writeFileSync(screenPath, image.toPNG());
  console.log('App screenshot saved to:', screenPath);

  app.quit();
});
