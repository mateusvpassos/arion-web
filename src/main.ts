import { createApp } from 'vue'
import './style.css'
import App from './App.vue'

// sem PWA: se algum service worker velho ainda estiver registrado, sai
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(async (rs) => {
    if (!rs.length) return;
    await Promise.all(rs.map((r) => r.unregister()));
    if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
    location.reload();
  });
}

// v-foco: põe o cursor no campo quando ele aparece (o autofocus do HTML só vale
// ao carregar a página, não em tela/diálogo que abre depois). v-foco="false" desliga.
createApp(App)
  .directive('foco', {
    mounted(el: HTMLElement, b: { value?: unknown }) {
      if (b.value !== false) requestAnimationFrame(() => el.focus());
    },
  })
  // item de lista clicável (<li @click>): o teclado não chegava nele. Tab
  // foca, Enter/Espaço abre — só quando o foco é o próprio item, não um botão
  // dentro dele.
  .directive('clicavel', {
    mounted(el: HTMLElement) {
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.addEventListener('keydown', (e) => {
        if (e.target !== el || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        el.click();
      });
    },
  })
  .mount('#app')
