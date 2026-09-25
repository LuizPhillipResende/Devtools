const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 256,
    height: 256,
    useContentSize: true,
    transparent: true,
    frame: false,
    webPreferences: {
      offscreen: true
    }
  });

  const svgContent = fs.readFileSync(path.join(__dirname, '..', 'assets', 'logo.svg'), 'utf8');

  const sizes = [16, 32, 48, 64, 128, 256];
  for (const sz of sizes) {
    win.setContentSize(sz, sz);
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { width: ${sz}px; height: ${sz}px; overflow: hidden; background: transparent; }
            svg { width: 100%; height: 100%; display: block; }
          </style>
        </head>
        <body>
          ${svgContent}
        </body>
      </html>
    `;
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    await new Promise(r => setTimeout(r, 250));

    const image = await win.webContents.capturePage({ x: 0, y: 0, width: sz, height: sz });
    const pngBuf = image.toPNG();
    const dest = path.join(__dirname, '..', 'icons', `icon${sz}.png`);
    fs.writeFileSync(dest, pngBuf);
    console.log(`Generated: ${dest} (${sz}x${sz}, ${pngBuf.length} bytes)`);
  }

  // Also copy icon.svg to icons/
  fs.writeFileSync(path.join(__dirname, '..', 'icons', 'icon.svg'), svgContent);

  app.quit();
});
