// MyMusic desktop: o mesmo app do web numa janela própria (família Kino/Strata).
//
// O build do web (dist/) é servido em http://localhost:47831 — porta FIXA: o
// login e o cache das músicas ficam guardados por origem, e "localhost" já é
// domínio autorizado no Firebase. O Google não deixa entrar com a conta dentro
// do Electron, então o login abre no navegador do sistema (login-desktop.html,
// servido aqui mesmo) e o token volta p/ a janela por um POST local.
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORTA = 47831;
const ORIGEM = `http://localhost:${PORTA}`;
const DIST = path.join(__dirname, '..', 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

let win = null;
let estadoLogin = null; // amarra a resposta do navegador ao pedido feito por esta janela

function corpo(req) {
  return new Promise((ok, erro) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 1e6) req.destroy(); });
    req.on('end', () => ok(s));
    req.on('error', erro);
  });
}

async function servir(req, res) {
  const url = new URL(req.url, ORIGEM);
  if (req.method === 'POST' && url.pathname === '/desktop-login') {
    try {
      const j = JSON.parse(await corpo(req));
      if (!estadoLogin || j.state !== estadoLogin || !j.idToken) {
        res.writeHead(403).end('pedido de login inválido');
        return;
      }
      estadoLogin = null;
      win?.webContents.send('google-token', { idToken: j.idToken, accessToken: j.accessToken ?? null });
      if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
    } catch {
      res.writeHead(400).end();
    }
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const arq = path.join(DIST, path.normalize(p));
  if (!arq.startsWith(DIST)) { res.writeHead(403).end(); return; }
  fs.readFile(arq, (err, dados) => {
    if (err) { res.writeHead(404).end(); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(arq).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : dados);
  });
}

function criarJanela() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    minHeight: 520,
    backgroundColor: '#0d0e13',
    title: 'MyMusic',
    show: !process.env.MYMUSIC_OCULTO, // testes automáticos: sem janela na tela
    // .ico no Windows: vários tamanhos (barra de tarefas, Alt+Tab nítidos)
    icon: path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs') },
  });
  win.removeMenu();
  // link p/ fora (ajuda do Google etc.) abre no navegador
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url) && !url.startsWith(ORIGEM)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(ORIGEM)) { e.preventDefault(); shell.openExternal(url); }
  });
  // F11 tela cheia, F12 ferramentas, Ctrl+R recarrega (sem menu na janela)
  win.webContents.on('before-input-event', (e, i) => {
    if (i.type !== 'keyDown') return;
    if (i.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    else if (i.key === 'F12') { win.webContents.toggleDevTools(); e.preventDefault(); }
    else if (i.control && i.key.toLowerCase() === 'r') { win.webContents.reload(); e.preventDefault(); }
  });
  win.loadURL(ORIGEM + '/');
  win.on('closed', () => { win = null; });
}

ipcMain.handle('entrar-google', async () => {
  estadoLogin = crypto.randomBytes(16).toString('hex');
  await shell.openExternal(`${ORIGEM}/login-desktop.html#${estadoLogin}`);
  return true;
});

// uma instância só (a porta é uma só)
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(() => {
    const srv = http.createServer((req, res) => { servir(req, res).catch(() => res.writeHead(500).end()); });
    srv.on('error', (e) => {
      dialog.showErrorBox('MyMusic', `Não consegui abrir a porta ${PORTA} (${e.code}). Outro programa está usando?`);
      app.quit();
    });
    srv.listen(PORTA, '127.0.0.1', criarJanela);
  });
  app.on('window-all-closed', () => app.quit());
}
