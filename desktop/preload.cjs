// Ponte mínima da janela desktop: pedir login no navegador e receber o token.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mymusicDesktop', {
  entrarGoogle: () => ipcRenderer.invoke('entrar-google'),
  aoToken: (cb) => ipcRenderer.on('google-token', (_e, t) => cb(t)),
});
