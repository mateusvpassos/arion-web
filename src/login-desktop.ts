// Página aberta no navegador do sistema pelo MyMusic desktop: faz o login
// Google aqui (o Google não deixa dentro do Electron) e devolve o token p/ a
// janela do app, que entra com ele. O estado no #hash amarra ao pedido.
import './style.css';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from './firebase';

const estado = location.hash.slice(1);
const msg = document.getElementById('msg')!;
const botao = document.getElementById('entrar') as HTMLButtonElement;

if (!estado) {
  msg.textContent = 'Abra esta página pelo botão “Entrar com Google” do MyMusic no computador.';
  botao.hidden = true;
}

botao.addEventListener('click', async () => {
  if (!auth) return;
  botao.disabled = true;
  msg.textContent = 'Escolha a conta na janela do Google…';
  try {
    const r = await signInWithPopup(auth, new GoogleAuthProvider());
    const cred = GoogleAuthProvider.credentialFromResult(r);
    if (!cred?.idToken) throw new Error('O Google não devolveu o token.');
    const resp = await fetch('/desktop-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: estado, idToken: cred.idToken, accessToken: cred.accessToken }),
    });
    if (!resp.ok) throw new Error('O MyMusic não estava esperando este login. Clique em “Entrar” no app de novo.');
    await signOut(auth); // a sessão fica no app, não neste navegador
    msg.textContent = `Pronto, ${r.user.displayName ?? r.user.email}! Pode fechar esta aba e voltar ao MyMusic.`;
    botao.hidden = true;
  } catch (e) {
    msg.textContent = (e as Error).message;
    botao.disabled = false;
  }
});
