const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const desktopPath = path.join(os.homedir(), 'Desktop');
const targetExe = path.resolve(__dirname, '..', 'dist', 'DevTools CORP-win32-x64', 'DevTools CORP.exe');
const iconPath = path.resolve(__dirname, '..', 'icons', 'icon.ico');
const workDir = path.dirname(targetExe);
const linkPath = path.join(desktopPath, 'DevTools CORP.lnk');

const vbsContent = [
  'Set oWS = WScript.CreateObject("WScript.Shell")',
  'sLinkFile = "' + linkPath.replace(/\\/g, '\\\\') + '"',
  'Set oLink = oWS.CreateShortcut(sLinkFile)',
  'oLink.TargetPath = "' + targetExe.replace(/\\/g, '\\\\') + '"',
  'oLink.WorkingDirectory = "' + workDir.replace(/\\/g, '\\\\') + '"',
  'oLink.IconLocation = "' + iconPath.replace(/\\/g, '\\\\') + ', 0"',
  'oLink.Description = "DevTools CORP Desktop Suite"',
  'oLink.Save'
].join('\r\n');

const tmpVbs = path.join(os.tmpdir(), 'create_desktop_shortcut.vbs');
fs.writeFileSync(tmpVbs, vbsContent, 'utf8');
try {
  execSync('cscript //nologo "' + tmpVbs + '"');
  console.log('✓ Desktop shortcut created/updated successfully at:', linkPath);
} finally {
  if (fs.existsSync(tmpVbs)) fs.unlinkSync(tmpVbs);
}
