<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import Diagrama from '../components/Diagrama.vue';
import { wordMusica, imagemMusica } from '../exportar';
import { live, seguindo, conduzindo, publicarNav, publicarRolagem, ouvir } from '../live';
import AppBar from '../components/AppBar.vue';
import ChordChart from '../components/ChordChart.vue';
import Permissoes from '../components/Permissoes.vue';
import { abrir, trocar, prefs } from '../nav';
import * as be from '../backend';
import { ativa, setEditoresSong, nomeDe, eu, cloud } from '../cloud';
import { acervo, obras, obraDe, rotulo, baseDe, temNovidade, atualizarDoAcervo, publicar, puxar, podeEditarA, nomeDe as nomeA } from '../acervo';
import DiffView from '../components/DiffView.vue';
import Prompt from '../components/Prompt.vue';
import { resumoMudancas } from '../core';
import { transposeSong } from '../core';
import { isChordSymbol } from '../chordEngine';

const props = defineProps<{ id: string; setlistId?: string }>();

// música de quem conduz que não está no meu grupo vem junto da sessão
const doGrupo = computed(() => !!be.songById(props.id));
const song = computed(() => be.songById(props.id) ?? acervo.musicas[props.id] ?? live.songs[props.id]);
// aberta direto do acervo geral (ainda sem cópia nas minhas músicas)
const doAcervo = computed(() => !doGrupo.value && !!acervo.musicas[props.id]);
function adicionarMinhas() {
  const c = puxar(song.value!);
  trocar({ nome: 'musica', id: c.id, setlistId: props.setlistId });
}
const sl = computed(() => (props.setlistId
  ? be.setlistById(props.setlistId) ?? live.setlists[props.setlistId] : undefined));
const podeEditar = computed(() => !!song.value && doGrupo.value && be.podeEditarSong(song.value));
const lista = computed(() => sl.value?.songIds.filter((x) => be.songById(x)) ?? []);
const idx = computed(() => lista.value.indexOf(props.id));

// tom: o salvo no repertório (se veio de um) + o que mexer aqui
const tom = ref(0);
watch(() => [props.id, props.setlistId], () => {
  // seguindo e abrindo a música de quem conduz: já cai no tom dele
  const n = live.nav;
  tom.value = seguindo.value && n?.songId === props.id ? n.transpose : sl.value?.transpose[props.id] ?? 0;
}, { immediate: true });
const comCapo = ref(true);
const mostrada = computed(() => {
  const s = song.value;
  if (!s) return null;
  return transposeSong(s, tom.value - (comCapo.value ? s.capo : 0));
});
const acordes = computed(() => {
  const vistos = new Set<string>();
  for (const sec of mostrada.value?.sections ?? [])
    for (const l of sec.lines) for (const c of l.chords) if (isChordSymbol(c.sym)) vistos.add(c.sym);
  return [...vistos];
});

function setTom(v: number) {
  tom.value = v;
  navAoVivo();
  // repertório que posso editar guarda o tom; o dos outros fica só aqui
  const r = sl.value;
  if (r && be.setlistById(r.id) && !seguindo.value && be.podeEditarSetlist(r)) {
    const t = { ...r.transpose };
    if (v === 0) delete t[props.id]; else t[props.id] = v;
    be.salvarSetlist({ ...r, transpose: t });
  }
}

function ir(i: number) {
  const id = lista.value[i];
  if (id) trocar({ nome: 'musica', id, setlistId: props.setlistId });
  rolando.value = false;
  window.scrollTo(0, 0);
}

// ---- auto-rolagem (velocidade gravada na música, como no app) ----
const rolando = ref(false);
const PADRAO = 28;
const velocidade = computed(() => (song.value?.scrollSpeed || prefs.velocidade || PADRAO));
let raf = 0, ultimo = 0, sobra = 0;
function passo(t: number) {
  if (!rolando.value) return;
  const dt = ultimo ? (t - ultimo) / 1000 : 0;
  ultimo = t;
  sobra += velocidade.value * dt;
  if (sobra >= 1) {
    const px = Math.floor(sobra);
    sobra -= px;
    window.scrollBy(0, px);
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) { rolando.value = false; return; }
  }
  raf = requestAnimationFrame(passo);
}
watch(rolando, (v) => { cancelAnimationFrame(raf); ultimo = 0; sobra = 0; if (v) raf = requestAnimationFrame(passo); });
onBeforeUnmount(() => cancelAnimationFrame(raf));
function setVel(delta: number) {
  const s = song.value;
  if (!s || !podeEditar.value) return;
  be.salvarSong({ ...s, scrollSpeed: Math.min(200, Math.max(4, velocidade.value + delta)) });
}
function velPadrao() {
  const s = song.value;
  if (s?.scrollSpeed && podeEditar.value) be.salvarSong({ ...s, scrollSpeed: 0 });
}
function setCapo(d: number) {
  const s = song.value;
  if (!s || !podeEditar.value || s.capo + d < 0) return;
  be.salvarSong({ ...s, capo: s.capo + d });
}

// ---- metrônomo (clique curto pelo áudio do navegador) ----
const metro = ref(false);
let metroT = 0, audio: AudioContext | null = null;
function clique() {
  audio ??= new AudioContext();
  const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
  o.frequency.value = 1500;
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  o.connect(g).connect(audio.destination);
  o.start(t); o.stop(t + 0.06);
}
function toggleMetro() {
  clearInterval(metroT);
  metro.value = !metro.value && !!song.value?.bpm;
  if (!metro.value) return;
  clique();
  metroT = window.setInterval(clique, 60000 / song.value!.bpm);
}

// ---- diagrama / exportar / tela cheia ----
const diagrama = ref('');
const exportar = ref(false);
const prefixo = computed(() => (lista.value.length > 1 ? `${idx.value + 1}. ` : ''));
function exporta(tipo: 'pdf' | 'docx' | 'img') {
  exportar.value = false;
  const m = mostrada.value!;
  if (tipo === 'pdf') abrir({ nome: 'imprimir', songId: props.id, setlistId: props.setlistId });
  if (tipo === 'docx') wordMusica(m, prefixo.value);
  if (tipo === 'img') imagemMusica(m, prefixo.value);
}
const cheia = ref(false);
function toggleCheia() {
  cheia.value = !cheia.value;
  try {
    if (cheia.value) document.documentElement.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  } catch { /* sem suporte: só esconde as barras */ }
}
const saiuCheia = () => { if (!document.fullscreenElement) cheia.value = false; };

// ---- pedal / teclado (page-turner Bluetooth manda teclas) ----
const PADRAO_NEXT = ['PageDown', 'ArrowDown', 'ArrowRight', 'Space'];
const PADRAO_PREV = ['PageUp', 'ArrowUp', 'ArrowLeft'];
const noFim = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - window.innerHeight * 0.6 - 4;
const noTopo = () => window.scrollY <= 4;
function tecla(e: KeyboardEvent) {
  const alvo = e.target as HTMLElement;
  if (alvo.closest?.('input, textarea, select, [contenteditable]') || e.ctrlKey || e.metaKey || e.altKey) return;
  if (diagrama.value || nomeNova.value || perm.value) return;
  const next = prefs.pedal.next.length ? prefs.pedal.next : PADRAO_NEXT;
  const prev = prefs.pedal.prev.length ? prefs.pedal.prev : PADRAO_PREV;
  const passo = window.innerHeight * prefs.passo;
  if (next.includes(e.code)) {
    e.preventDefault();
    if (lista.value.length > 1 && noFim() && idx.value < lista.value.length - 1) ir(idx.value + 1);
    else window.scrollBy({ top: passo, behavior: 'smooth' });
  } else if (prev.includes(e.code)) {
    e.preventDefault();
    if (lista.value.length > 1 && noTopo() && idx.value > 0) ir(idx.value - 1);
    else window.scrollBy({ top: -passo, behavior: 'smooth' });
  }
}

// ---- sessão ao vivo ----
// rolagem em fração do CONTEÚDO (sem o respiro de 60% no fim), como no app
const alturaConteudo = () => document.documentElement.scrollHeight - window.innerHeight * 0.6;
function navAoVivo() {
  if (song.value) publicarNav(song.value, sl.value, tom.value);
}
let pubT = 0, sujo = false;
function enviarRolagem() {
  const h = alturaConteudo();
  publicarRolagem(props.id, h <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / h)));
}
function aoRolar() {
  if (!conduzindo.value) return;
  if (pubT) { sujo = true; return; }
  enviarRolagem();
  pubT = window.setTimeout(() => { pubT = 0; if (sujo) { sujo = false; enviarRolagem(); } }, 120);
}
function rolarPara(frac: number) {
  window.scrollTo({ top: frac * alturaConteudo(), behavior: 'smooth' });
}
const parar = ouvir({
  // mesma música, outro tom (a troca de música o App.vue faz)
  nav: (n) => { if (n.songId === props.id) tom.value = n.transpose; },
  rolagem: (r) => { if (r.songId === props.id) rolarPara(r.frac); },
});
onMounted(() => {
  window.addEventListener('keydown', tecla);
  window.addEventListener('scroll', aoRolar, { passive: true });
  document.addEventListener('fullscreenchange', saiuCheia);
  nextTick(() => {
    if (conduzindo.value) navAoVivo();
    else if (seguindo.value && live.rolagem?.songId === props.id) rolarPara(live.rolagem.frac);
  });
});
onBeforeUnmount(() => {
  parar();
  clearInterval(metroT);
  clearTimeout(pubT);
  window.removeEventListener('keydown', tecla);
  window.removeEventListener('scroll', aoRolar);
  document.removeEventListener('fullscreenchange', saiuCheia);
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
});

const perm = ref(false);

// ---- acervo geral ----
const origem = computed(() => (song.value ? baseDe(song.value) : undefined));
const novidade = computed(() => !!song.value && temNovidade(song.value));
const verDiff = ref(false);
const nomeNova = ref(false);
const aviso = ref('');
const minha = computed(() => !!song.value && (!song.value.dono || song.value.dono === eu.value));
const diferente = computed(() => !!origem.value && !!song.value && resumoMudancas(origem.value, song.value).length > 0);
function avisar(t: string) { aviso.value = t; setTimeout(() => (aviso.value = ''), 3000); }
function publicarNova(nome: string) {
  nomeNova.value = false;
  if (!nome || !song.value || !origem.value) return;
  publicar(song.value, nome, obraDe(origem.value));
  avisar(`Nova versão “${nome}” publicada no acervo`);
}
const sub = computed(() => {
  const s = song.value, m = mostrada.value;
  if (!s || !m) return '';
  return [
    origem.value && (obras.value[obraDe(origem.value)]?.length ?? 0) > 1 ? rotulo(origem.value) : '',
    m.key,
    s.capo ? `capo ${s.capo}${comCapo.value ? '' : ' (off)'}` : '',
    tom.value ? `${tom.value > 0 ? '+' : ''}${tom.value}` : '',
    s.bpm ? `${s.bpm} BPM` : '',
    lista.value.length > 1 ? `${idx.value + 1}/${lista.value.length}` : '',
    doAcervo.value ? `acervo geral${s.dono && s.dono !== eu.value ? ` · de ${nomeA(s.dono)}` : ''}`
      : ativa.value && s.dono && s.dono !== eu.value ? `de ${nomeDe(s.dono)}` : '',
    live.ativo ? `ao vivo: ${live.reconectando ? 'reconectando…' : live.modo === 'segue' ? 'seguindo' : live.modo}` : '',
  ].filter(Boolean).join('  •  ');
});
</script>

<template>
  <div v-if="!song || !mostrada" class="empty">Música não encontrada</div>
  <div v-else class="tela" :class="{ cheia }" @click="exportar = false">
    <AppBar v-if="!cheia" :titulo="song.title" :sub="sub">
      <div class="menu-wrap">
        <button class="icon-btn" title="Exportar" @click.stop="exportar = !exportar"><span class="ms">ios_share</span></button>
        <div v-if="exportar" class="menu" @click.stop>
          <button @click="exporta('pdf')"><span class="ms">print</span>PDF / Imprimir</button>
          <button @click="exporta('docx')"><span class="ms">description</span>Word (.docx)</button>
          <button @click="exporta('img')"><span class="ms">image</span>Imagem (PNG)</button>
        </div>
      </div>
      <button class="icon-btn" title="Tela cheia" @click="toggleCheia"><span class="ms">fullscreen</span></button>
      <template v-if="doAcervo">
        <button class="icon-btn" title="Adicionar às minhas músicas" @click="adicionarMinhas">
          <span class="ms">library_add</span></button>
        <button class="icon-btn" :title="(obras[obraDe(song)]?.length ?? 1) > 1 ? 'Ver versões' : 'Versões e detalhes'"
          @click="abrir({ nome: 'obra', obra: obraDe(song), versaoId: song.id })"><span class="ms">layers</span></button>
        <button class="icon-btn" title="Histórico de revisões" @click="abrir({ nome: 'versoes', id: song.id, acervo: true })">
          <span class="ms">history</span></button>
        <button class="icon-btn" :title="podeEditarA(song) ? 'Editar' : 'Sugerir mudança'"
          @click="abrir({ nome: 'editar', id: song.id, acervo: true })">
          <span class="ms">{{ podeEditarA(song) ? 'edit' : 'rate_review' }}</span></button>
      </template>
      <button v-else-if="origem" class="icon-btn" :title="`Ver no acervo (${rotulo(origem)} de ${nomeA(origem.dono)})`"
        @click="abrir({ nome: 'obra', obra: obraDe(origem), versaoId: origem.id })"><span class="ms">public</span></button>
      <button v-else-if="cloud.user && minha && doGrupo" class="icon-btn" title="Publicar no acervo geral"
        @click="publicar(song); avisar('Publicada no acervo geral')"><span class="ms">publish</span></button>
      <button v-if="diferente" class="icon-btn" title="Publicar como nova versão no acervo" @click="nomeNova = true">
        <span class="ms">library_add</span></button>
      <template v-if="ativa && doGrupo">
        <button class="icon-btn" title="Histórico de revisões" @click="abrir({ nome: 'versoes', id: song.id })">
          <span class="ms">history</span>
        </button>
        <button class="icon-btn" title="Dono e quem pode editar" @click="perm = true">
          <span class="ms">manage_accounts</span>
        </button>
      </template>
      <button v-if="doGrupo" class="icon-btn" :title="podeEditar ? 'Editar' : 'Sugerir mudança'"
        @click="abrir({ nome: 'editar', id: song.id })">
        <span class="ms">{{ podeEditar ? 'edit' : 'rate_review' }}</span>
      </button>
    </AppBar>
    <div v-else class="flutua no-print">
      <button class="icon-btn" :class="{ on: prefs.soLetra }" title="Só letra" @click="prefs.soLetra = !prefs.soLetra">
        <span class="ms">lyrics</span></button>
      <button class="icon-btn" title="Fonte -" @click="prefs.fonte = Math.max(0.7, +(prefs.fonte - 0.1).toFixed(1))">
        <span class="ms">text_decrease</span></button>
      <button class="icon-btn" title="Fonte +" @click="prefs.fonte = Math.min(2.8, +(prefs.fonte + 0.1).toFixed(1))">
        <span class="ms">text_increase</span></button>
      <button class="icon-btn" title="Sair da tela cheia" @click="toggleCheia"><span class="ms">fullscreen_exit</span></button>
    </div>

    <div v-if="!cheia && !prefs.soLetra && acordes.length" class="acordes no-print">
      <button v-for="c in acordes" :key="c" class="chip ac" title="Ver diagrama" @click="diagrama = c">{{ c }}</button>
    </div>
    <p v-if="live.aviso" class="aviso no-print">{{ live.aviso }}</p>
    <div v-if="!cheia && novidade && origem" class="banner novo no-print">
      <span class="ms">new_releases</span>
      <span class="grow">A versão “{{ rotulo(origem) }}” mudou no acervo (revisão {{ origem.versao }}, por {{ nomeA(origem.por) }}).</span>
      <button class="btn text" @click="verDiff = !verDiff">{{ verDiff ? 'Esconder' : 'Ver o que mudou' }}</button>
      <button class="btn tonal" :disabled="!podeEditar" @click="atualizarDoAcervo(song); avisar('Atualizada com a versão do acervo')">Atualizar</button>
    </div>
    <div v-if="novidade && origem && verDiff" class="cifra"><DiffView :antes="song" :depois="origem" /></div>
    <p v-if="aviso" class="aviso no-print">{{ aviso }}</p>
    <div v-if="!cheia && song.notes" class="nota"><span class="ms">sticky_note_2</span><i>{{ song.notes }}</i></div>

    <main class="cifra">
      <ChordChart :song="mostrada" :fonte="prefs.fonte" :letra="prefs.soLetra" />
    </main>

    <footer v-if="!cheia" class="barra no-print">
      <button class="icon-btn" title="Música anterior" :disabled="idx <= 0" v-if="lista.length > 1" @click="ir(idx - 1)">
        <span class="ms">skip_previous</span>
      </button>
      <button class="icon-btn" title="Tom -" @click="setTom(tom - 1)"><span class="ms">remove</span></button>
      <span class="lbl">Tom</span>
      <button class="icon-btn" title="Tom +" @click="setTom(tom + 1)"><span class="ms">add</span></button>
      <button class="icon-btn" title="Fonte -" @click="prefs.fonte = Math.max(0.7, +(prefs.fonte - 0.1).toFixed(1))">
        <span class="ms">text_decrease</span>
      </button>
      <button class="icon-btn" title="Fonte +" @click="prefs.fonte = Math.min(2.8, +(prefs.fonte + 0.1).toFixed(1))">
        <span class="ms">text_increase</span>
      </button>
      <template v-if="podeEditar">
        <button class="icon-btn" title="Capo -" :disabled="!song.capo" @click="setCapo(-1)"><span class="ms">south</span></button>
        <span class="lbl">Capo {{ song.capo }}</span>
        <button class="icon-btn" title="Capo +" @click="setCapo(1)"><span class="ms">north</span></button>
      </template>
      <button v-if="song.capo" class="icon-btn" :class="{ on: comCapo }" title="Acordes com capo"
        @click="comCapo = !comCapo"><span class="ms">album</span></button>
      <button class="icon-btn" :class="{ on: prefs.soLetra }"
        :title="prefs.soLetra ? 'Mostrar acordes' : 'Só letra (p/ quem canta)'"
        @click="prefs.soLetra = !prefs.soLetra"><span class="ms">lyrics</span></button>
      <button class="icon-btn play" :class="{ on: rolando }" title="Auto-rolagem" @click="rolando = !rolando">
        <span class="ms fill">{{ rolando ? 'pause' : 'play_arrow' }}</span>
      </button>
      <template v-if="rolando">
        <button class="icon-btn" title="Mais devagar" @click="setVel(-4)"><span class="ms">fast_rewind</span></button>
        <span class="lbl vel" :title="song.scrollSpeed ? 'Velocidade desta música (clique p/ voltar à padrão)' : 'Velocidade padrão (das configurações)'"
          @click="velPadrao">
          {{ Math.round(velocidade) }}{{ song.scrollSpeed ? '' : '*' }}
        </span>
        <button class="icon-btn" title="Mais rápido" @click="setVel(4)"><span class="ms">fast_forward</span></button>
      </template>
      <button v-if="song.bpm" class="icon-btn" :class="{ on: metro }" :title="`Metrônomo ${song.bpm}`" @click="toggleMetro">
        <span class="ms">av_timer</span></button>
      <button class="icon-btn" title="Tela cheia" @click="toggleCheia"><span class="ms">fullscreen</span></button>
      <button class="icon-btn" title="Próxima música" v-if="lista.length > 1" :disabled="idx >= lista.length - 1"
        @click="ir(idx + 1)"><span class="ms">skip_next</span></button>
    </footer>

    <div v-if="rolando" class="faixa no-print"></div>

    <Diagrama v-if="diagrama" :sym="diagrama" @fechar="diagrama = ''" />
    <Prompt v-if="nomeNova" titulo="Publicar como nova versão"
      :dica="`Nome da versão (ex.: Versão ${cloud.grupo?.nome ?? 'nossa'}, Simplificada)`" ok="Publicar"
      @fechar="nomeNova = false" @ok="publicarNova" />
    <Permissoes v-if="perm" :titulo="song.title" :dono="song.dono" :editores="song.editores"
      @fechar="perm = false" @salvar="(l) => setEditoresSong(song!, l)" />
  </div>
</template>

<style scoped>
.tela { padding-bottom: 60vh; }
.acordes {
  display: flex; gap: 6px; overflow-x: auto; padding: 8px 12px; margin-top: -12px; background: var(--surface-1);
  border-bottom: 1px solid var(--line);
}
.ac { color: var(--chord); font: 700 13px var(--mono); height: 30px; cursor: pointer; }
.ac:hover { background: var(--card-hi); }
.vel { cursor: pointer; }
.flutua {
  position: fixed; top: 8px; right: 8px; z-index: 20; display: flex; gap: 2px; border-radius: 24px;
  background: color-mix(in srgb, var(--surface-1) 85%, transparent);
}
.tela.cheia { padding-top: 8px; }
.nota {
  display: flex; align-items: center; gap: 8px; margin: 10px 16px 0; padding: 8px 12px;
  background: var(--card); border: 1px solid var(--line); border-left: 3px solid var(--primary);
  border-radius: 8px; font-size: 13.5px; color: var(--muted);
}
.nota .ms { font-size: 18px; }
.cifra { padding: 8px 16px; max-width: 1100px; }
.barra {
  position: fixed; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: safe center;
  gap: 2px; height: 58px; padding: 0 10px; overflow-x: auto;
  background: color-mix(in srgb, var(--surface-1) 92%, transparent); backdrop-filter: blur(10px);
  border-top: 1px solid var(--line);
}
.lbl { font: 600 12px var(--mono); color: var(--muted); padding: 0 4px; white-space: nowrap; }
.novo { display: flex; align-items: center; gap: 10px; border-radius: 0; flex-wrap: wrap; }
.novo .grow { flex: 1; min-width: 200px; }
.aviso { margin: 6px 16px; color: var(--ok); }
.barra .play {
  width: 42px; height: 42px; border-radius: 50%; margin: 0 6px;
  background: var(--grad); color: var(--on-primary);
  box-shadow: 0 6px 16px -6px var(--accent-ring);
}
.barra .play:hover { filter: brightness(1.08); background: var(--grad); color: var(--on-primary); }
.faixa {
  position: fixed; left: 0; right: 0; top: 30vh; height: 3em; pointer-events: none;
  background: color-mix(in srgb, var(--primary) 10%, transparent);
  border-top: 1px solid color-mix(in srgb, var(--primary) 35%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--primary) 35%, transparent);
}
</style>
