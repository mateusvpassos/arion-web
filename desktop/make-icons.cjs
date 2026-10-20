// Gera os PNGs do ícone a partir de desktop/icon.svg usando o próprio Electron
// (mesmo jeito do Strata). Uso: npm run icons
//   web: public/icon.png (512)
//   app Android (../mymusic/assets/icon): icon, background, foreground, monochrome
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const svg = fs.readFileSync(path.join(__dirname, 'icon.svg'), 'utf8');
const defs = svg.match(/<defs>[\s\S]*?<\/defs>/)[0];
const monograma = svg.match(/<path d="M152[\s\S]*?\/>/)[0];

// ícone adaptativo do Android: a parte visível é o círculo/quadrado central
// (~66% de 108dp), então o monograma vai menor na frente
const frente = (traco) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}
  <g transform="translate(256 256) scale(.62) translate(-256 -256)">
    ${traco === 'mono' ? monograma.replace('url(#g)', '#fff') : `<circle cx="256" cy="256" r="230" fill="url(#glow)"/>${monograma}`}
  </g></svg>`;
const fundo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}
  <rect width="512" height="512" fill="url(#bg)"/></svg>`;

const saidas = [
  { svg, tam: 512, para: path.join(raiz, 'public', 'icon.png') },
];
const appIcon = path.join(raiz, '..', 'mymusic', 'assets', 'icon');
if (fs.existsSync(appIcon)) {
  saidas.push(
    { svg, tam: 1024, para: path.join(appIcon, 'icon.png') },
    { svg: fundo, tam: 1024, para: path.join(appIcon, 'background.png') },
    { svg: frente('cor'), tam: 1024, para: path.join(appIcon, 'foreground.png') },
    { svg: frente('mono'), tam: 1024, para: path.join(appIcon, 'monochrome.png') },
  );
}

// fecha uma janela por ícone: sem isto o Electron sairia na primeira
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  for (const s of saidas) {
    const win = new BrowserWindow({
      show: false, width: s.tam, height: s.tam, transparent: true, frame: false,
      webPreferences: { offscreen: true },
    });
    const html = `<html><body style="margin:0;background:transparent;overflow:hidden">${
      s.svg.replace('<svg ', `<svg width="${s.tam}" height="${s.tam}" `)}</body></html>`;
    const tmp = path.join(app.getPath('temp'), `mymusic-icon-${s.tam}.html`);
    fs.writeFileSync(tmp, html);
    await win.loadFile(tmp);
    await new Promise((r) => setTimeout(r, 300));
    const img = await win.webContents.capturePage({ x: 0, y: 0, width: s.tam, height: s.tam });
    fs.writeFileSync(s.para, img.resize({ width: s.tam, height: s.tam }).toPNG());
    console.log('gerado', path.relative(path.join(raiz, '..'), s.para));
    win.destroy();
  }
  app.quit();
});
