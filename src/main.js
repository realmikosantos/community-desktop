/**
 * Podwires Community Desktop — Electron main process.
 *
 * Wraps community.podwires.com in a native desktop window.
 *
 * Mirrors the podwires-desktop wrapper but targets the Next.js community
 * platform at community.podwires.com. Auth is delegated to the site's JWT
 * bridge, so no credentials are stored in the wrapper itself.
 */

'use strict';

const path = require('node:path');
const {
  app,
  BrowserWindow,
  Menu,
  shell,
  nativeTheme,
  dialog,
  session,
} = require('electron');

const Store = require('electron-store');

/* =============================================
   CONFIG
   ============================================= */

const APP_URL        = 'https://community.podwires.com/';
const APP_HOST       = 'community.podwires.com';
const PROTOCOL       = 'podwires-community';
const USER_AGENT_TAG = 'PodwiresCommunityDesktop';

// Allowed navigation hosts — include the WordPress SSO gateway so the JWT
// handshake at podwires.com/go/community/ can complete without bouncing the
// user out to their default browser mid-login.
const INTERNAL_HOSTS = new Set([
  'community.podwires.com',
  'podwires.com',
  'www.podwires.com',
]);

const store = new Store({
  defaults: {
    window: { width: 1200, height: 820, x: undefined, y: undefined, maximized: false },
  },
});

let mainWindow = null;

/* =============================================
   SINGLE-INSTANCE LOCK
   ============================================= */

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

/* =============================================
   PROTOCOL (podwires-community://path)
   ============================================= */

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

/* =============================================
   WINDOW
   ============================================= */

function createWindow() {
  const saved = store.get('window');

  mainWindow = new BrowserWindow({
    width:  saved.width,
    height: saved.height,
    x:      saved.x,
    y:      saved.y,
    minWidth:  860,
    minHeight: 580,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0b1f17' : '#f0faf5',
    title: 'Podwires Community',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: true,
    },
  });

  if (saved.maximized) mainWindow.maximize();

  const ua = `${mainWindow.webContents.getUserAgent()} ${USER_AGENT_TAG}/${app.getVersion()}`;
  mainWindow.webContents.setUserAgent(ua);

  mainWindow.loadURL(APP_URL, { userAgent: ua });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  const saveBounds = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const maximized = mainWindow.isMaximized();
    const bounds = mainWindow.getNormalBounds();
    store.set('window', { ...bounds, maximized });
  };
  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);
  mainWindow.on('close', saveBounds);

  const isInternal = (url) => {
    try {
      const u = new URL(url);
      return INTERNAL_HOSTS.has(u.hostname);
    } catch {
      return false;
    }
  };

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternal(url)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isInternal(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -3) return;
    const html = `<!doctype html><meta charset="utf-8"><title>Community — offline</title>
      <style>
        body { font-family:-apple-system,Segoe UI,Roboto,sans-serif; background:#0b1f17;
               color:#e6fff4; display:flex; align-items:center; justify-content:center;
               height:100vh; margin:0; text-align:center; padding:2rem; }
        .card { max-width: 420px; }
        h1 { font-size: 1.4rem; margin: 0 0 .5rem; }
        p { color:#8cbfa6; line-height:1.6; margin:0 0 1.25rem; }
        button { background:#10B981; color:#fff; border:0; border-radius:10px;
                 padding:.75rem 1.5rem; font-size:.95rem; font-weight:600; cursor:pointer; }
        button:hover { background:#34d399; }
        code { color:#8cbfa6; font-size:.8rem; }
      </style>
      <div class="card">
        <h1>Can't reach Community</h1>
        <p>${errorDescription || 'The site is unreachable right now.'}</p>
        <button onclick="location.href='${APP_URL}'">Try again</button>
        <p><code>${validatedURL || ''}</code></p>
      </div>`;
    mainWindow.webContents.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

/* =============================================
   MENU
   ============================================= */

function buildMenu() {
  const isMac = process.platform === 'darwin';

  /** @type {Electron.MenuItemConstructorOptions[]} */
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Home',   accelerator: 'CmdOrCtrl+H', click: () => mainWindow?.loadURL(APP_URL) },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.webContents.reload() },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
        ...(isMac
          ? [{ role: 'pasteAndMatchStyle' }, { role: 'delete' }, { role: 'selectAll' }]
          : [{ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' }]),
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Toggle Developer Tools', accelerator: isMac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: () => mainWindow?.webContents.toggleDevTools() },
      ],
    },
    {
      label: 'Navigate',
      submenu: [
        { label: 'Back',    accelerator: isMac ? 'Cmd+Left'  : 'Alt+Left',
          click: () => mainWindow?.webContents.navigationHistory.canGoBack()    && mainWindow.webContents.navigationHistory.goBack()    },
        { label: 'Forward', accelerator: isMac ? 'Cmd+Right' : 'Alt+Right',
          click: () => mainWindow?.webContents.navigationHistory.canGoForward() && mainWindow.webContents.navigationHistory.goForward() },
      ],
    },
    {
      role: 'window',
      submenu: [
        { role: 'minimize' }, { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' }, { role: 'front' }, { type: 'separator' }, { role: 'window' }]
          : [{ role: 'close' }]),
      ],
    },
    {
      role: 'help',
      submenu: [
        { label: 'Open community.podwires.com in browser', click: () => shell.openExternal(APP_URL) },
        { label: 'Open Podwires main site',                click: () => shell.openExternal('https://podwires.com/') },
        { type: 'separator' },
        {
          label: 'About Podwires Community Desktop',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Podwires Community Desktop',
              message: `Podwires Community Desktop v${app.getVersion()}`,
              detail: `Electron ${process.versions.electron}\nChromium ${process.versions.chrome}\nNode.js ${process.versions.node}\n\ncommunity.podwires.com`,
              buttons: ['OK'],
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* =============================================
   SECURITY
   ============================================= */

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault());
});

function configurePermissions() {
  const allowed = new Set(['notifications', 'clipboard-sanitized-write', 'fullscreen', 'media', 'mediaKeySystem']);

  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback, details) => {
    try {
      const originHost = new URL(details.requestingUrl).hostname;
      const originOk = INTERNAL_HOSTS.has(originHost);
      callback(originOk && allowed.has(permission));
    } catch {
      callback(false);
    }
  });
}

/* =============================================
   APP LIFECYCLE
   ============================================= */

app.whenReady().then(() => {
  configurePermissions();
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
