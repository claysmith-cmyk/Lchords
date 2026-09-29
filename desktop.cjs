const { app, BrowserWindow, dialog, protocol, session } = require('electron');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

const origin = 'chordquest://app';
const files = { '/index.html': 'text/html', '/style.css': 'text/css', '/app.js': 'text/javascript', '/music.js': 'text/javascript' };
const policy = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
let window;

app.setName('Chord Quest');
protocol.registerSchemesAsPrivileged([{ scheme: 'chordquest', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (window?.isMinimized()) window.restore();
    window?.focus();
  });
  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(async () => {
    protocol.handle('chordquest', async request => {
      const url = new URL(request.url);
      const name = url.pathname === '/' ? '/index.html' : url.pathname;
      if (url.host !== 'app' || request.method !== 'GET' || !Object.hasOwn(files, name)) return new Response('Not found', { status: 404 });
      try {
        return new Response(await readFile(path.join(__dirname, name.slice(1))), {
          headers: { 'Content-Type': `${files[name]}; charset=utf-8`, 'Content-Security-Policy': policy },
        });
      } catch {
        return new Response('Could not load game', { status: 500 });
      }
    });
    // Electron also asks for midiSysex when sysex:false. Only the bundled page gets MIDI.
    const isMidi = permission => permission === 'midi' || permission === 'midiSysex';
    session.defaultSession.setPermissionCheckHandler((contents, permission, requestingOrigin, details) =>
      contents === window?.webContents && isMidi(permission) && details.isMainFrame &&
      (requestingOrigin === origin || requestingOrigin === `${origin}/`));
    session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) =>
      callback(contents === window?.webContents && isMidi(permission) && details.isMainFrame && details.requestingUrl?.startsWith(`${origin}/`)));

    window = new BrowserWindow({
      title: 'Chord Quest', width: 1280, height: 900, minWidth: 800, minHeight: 600,
      backgroundColor: '#111b24', show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    window.removeMenu();
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.once('ready-to-show', () => window.show());
    await window.loadURL(`${origin}/index.html`);
  }).catch(error => {
    dialog.showErrorBox('Chord Quest could not start', error.message);
    app.exit(1);
  });
}
