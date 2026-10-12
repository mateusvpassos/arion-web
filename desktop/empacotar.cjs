// Gera o instalador do MyMusic desktop (NSIS) e copia p/ release/.
// Empacota numa pasta temporária: dentro de Documents o Windows bloqueia o
// "rename" da pasta win-unpacked (EPERM) enquanto examina o .exe novo.
const builder = require('electron-builder');
const fs = require('fs');
const os = require('os');
const path = require('path');

const raiz = path.join(__dirname, '..');
const tmp = path.join(os.tmpdir(), 'mymusic-release');
const destino = path.join(raiz, 'release');

(async () => {
  fs.rmSync(tmp, { recursive: true, force: true });
  await builder.build({
    targets: builder.Platform.WINDOWS.createTarget('nsis'),
    projectDir: raiz,
    config: { directories: { output: tmp } },
  });
  fs.mkdirSync(destino, { recursive: true });
  for (const f of fs.readdirSync(tmp).filter((n) => n.endsWith('.exe'))) {
    fs.copyFileSync(path.join(tmp, f), path.join(destino, f));
    console.log('instalador:', path.join('release', f));
  }
})().catch((e) => { console.error(e); process.exit(1); });
