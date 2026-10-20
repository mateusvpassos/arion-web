// Pilha de telas, como no app (abrir música, repertório, histórico...).
// O "voltar" do navegador volta uma tela.
import { reactive, watch } from 'vue';
import { aplicarTema, MARCA, PADRAO_ANTIGO } from './tema';

export type Tela =
  | { nome: 'inicio' }
  | { nome: 'musica'; id: string; setlistId?: string }
  | { nome: 'editar'; id: string; nova?: boolean; acervo?: boolean }
  | { nome: 'minhas' }
  | { nome: 'obra'; obra: string; versaoId?: string }
  | { nome: 'repertorio'; id: string }
  | { nome: 'sugestoes' }
  | { nome: 'sugestao'; id: string }
  | { nome: 'versoes'; id: string; acervo?: boolean }
  | { nome: 'grupo' }
  | { nome: 'grupoDetalhe'; id: string }
  | { nome: 'grupoAdicionar'; id: string }
  | { nome: 'atividade' }
  | { nome: 'imprimir'; setlistId?: string; songId?: string }
  | { nome: 'config' }
  | { nome: 'aovivo' };

export const nav = reactive({ pilha: [{ nome: 'inicio' }] as Tela[] });

export const atual = () => nav.pilha[nav.pilha.length - 1];

export function abrir(t: Tela) {
  nav.pilha.push(t);
  history.pushState({ n: nav.pilha.length }, '');
  window.scrollTo(0, 0);
}

export function voltar() {
  if (nav.pilha.length > 1) history.back();
}

/** Troca a tela de cima (ex.: próxima música do repertório). */
export function trocar(t: Tela) {
  nav.pilha[nav.pilha.length - 1] = t;
}

window.addEventListener('popstate', () => {
  if (nav.pilha.length > 1) nav.pilha.pop();
});

// ---------- preferências deste navegador ----------

function ler<T>(k: string, padrao: T): T {
  try {
    const v = localStorage.getItem('mymusic.' + k);
    return v === null ? padrao : (JSON.parse(v) as T);
  } catch { return padrao; }
}

export const prefs = reactive({
  tema: ler<'dark' | 'light'>('tema', 'dark'),
  fonte: ler<number>('fonte', 1),
  soLetra: ler<boolean>('soLetra', false),
  aba: ler<'songs' | 'setlists'>('aba', 'songs'),
  /** cor do tema (ARGB, como no app) */
  // quem nunca escolheu cor estava no índigo padrão antigo: passa p/ a marca
  cor: ((c) => (c === PADRAO_ANTIGO ? MARCA : c))(ler<number>('cor', MARCA)),
  /** px/s da auto-rolagem quando a música não tem a sua */
  velocidade: ler<number>('velocidade', 28),
  /** quanto um toque no pedal rola (fração da tela) */
  passo: ler<number>('passo', 0.4),
  /** teclas do pedal (KeyboardEvent.code); vazio = padrão */
  pedal: ler<{ next: string[]; prev: string[] }>('pedal', { next: [], prev: [] }),
  /** nome deste navegador na sessão ao vivo */
  aparelho: ler<string>('aparelho', ''),
});

watch(prefs, (p) => {
  for (const [k, v] of Object.entries(p)) {
    try { localStorage.setItem('mymusic.' + k, JSON.stringify(v)); } catch { /* sem storage */ }
  }
  document.documentElement.dataset.theme = p.tema;
  aplicarTema(p.cor, p.tema);
}, { deep: true, immediate: true });
