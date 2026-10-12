<script setup lang="ts">
// Editor: trabalha numa CÓPIA (Cancelar desfaz tudo). Música de outra pessoa
// sem permissão: salvar vira sugestão, como no app.
// Dois modos, como no app: Texto (colar/digitar a cifra) e Acordes (arrastar
// acordes da paleta p/ cima da sílaba, mover, trocar, organizar seções).
import { ref, computed, watch, nextTick } from 'vue';
import AppBar from '../components/AppBar.vue';
import ChordChart from '../components/ChordChart.vue';
import Prompt from '../components/Prompt.vue';
import { voltar } from '../nav';
import * as be from '../backend';
import { sugerir, nomeDe as nomeGrupo } from '../cloud';
import { acervo, salvarA, sugerirA, podeEditarA, nomeDe as nomeAcervo, rotulo } from '../acervo';
import { rascunho } from '../rascunho';
import { serializeSections, importText, suggestKey, detectMeta, isChordSymbol } from '../chordEngine';
import { TEMPOS, MOMENTOS } from '../liturgia';
import type { Song, Section, SongLine, Chord } from '../types';

const props = defineProps<{ id: string; nova?: boolean; acervo?: boolean }>();

const origem = props.acervo ? acervo.musicas[props.id] : props.nova ? rascunho.value : be.songById(props.id);
const nomeDe = (e: string) => (props.acervo ? nomeAcervo(e) : nomeGrupo(e));
const s = ref<Song | null>(origem ? JSON.parse(JSON.stringify(origem)) : null);
const texto = ref(origem ? serializeSections(origem.sections) : '');
const tag = ref('');
const sugestao = computed(() => !props.nova && !!origem &&
  !(props.acervo ? podeEditarA(origem) : be.podeEditarSong(origem)));
const pedirNota = ref(false);
const enviado = ref(false);
const aviso = ref('');
const avisar = (t: string) => { aviso.value = t; setTimeout(() => (aviso.value = ''), 2500); };

const previa = computed<Song | null>(() => (s.value ? { ...s.value, sections: importText(texto.value) } : null));

function toggle(list: string[], v: string, ordem: readonly string[]) {
  const i = list.indexOf(v);
  if (i >= 0) list.splice(i, 1);
  else { list.push(v); list.sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b)); }
}

function addTag() {
  const t = tag.value.trim().toLowerCase();
  if (t && s.value && !s.value.tags.includes(t)) s.value.tags.push(t);
  tag.value = '';
}

// ---- tap tempo ----
let taps: number[] = [];
function tapTempo() {
  const agora = performance.now();
  if (taps.length && agora - taps[taps.length - 1] > 2000) taps = [];
  taps.push(agora);
  if (taps.length >= 2 && s.value) {
    const media = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
    s.value.bpm = Math.round(60000 / media);
  }
  if (taps.length > 6) taps.shift();
}

// ---- desfazer (agrupa digitação seguida) ----
const historico = ref<string[]>([]);
let desfazendo = false, rajada = 0;
watch(texto, (_v, antes) => {
  if (desfazendo) return;
  if (!rajada) {
    historico.value.push(antes);
    if (historico.value.length > 40) historico.value.shift();
  }
  clearTimeout(rajada);
  rajada = window.setTimeout(() => (rajada = 0), 800);
});
function desfazer() {
  const t = historico.value.pop();
  if (t === undefined) return;
  desfazendo = true;
  texto.value = t;
  if (modo.value === 'acordes') secs.value = importText(t);
  nextTick(() => (desfazendo = false));
}

async function copiar() {
  try { await navigator.clipboard.writeText(texto.value); avisar('Cifra copiada (texto)'); }
  catch { avisar('Não deu p/ copiar'); }
}

// ---- modo Acordes ----
const modo = ref<'texto' | 'acordes'>('texto');
const secs = ref<Section[]>([]);
function setModo(m: 'texto' | 'acordes') {
  if (m === 'acordes') secs.value = importText(texto.value);
  modo.value = m;
  armado.value = '';
}
// toda mudança no visual vira texto (é o texto que salva)
function mudou() {
  clearTimeout(rajada); rajada = 0;
  texto.value = serializeSections(secs.value);
}

// digitando a letra: agrupa no desfazer como no modo texto
const mudouLetra = () => { texto.value = serializeSections(secs.value); };

const PALETA = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Cm', 'Dm', 'Em', 'Fm', 'Gm', 'Am', 'Bm',
  'C7', 'D7', 'E7', 'G7', 'A7', 'B7', 'Cmaj7', 'Dm7', 'Em7', 'Gsus4'];
const extras = ref<string[]>([]);
// acordes desta música primeiro (é o que mais se usa ao acertar a cifra)
const paleta = computed(() => {
  const da = new Set<string>();
  for (const sec of secs.value) for (const l of sec.lines) for (const c of l.chords) if (isChordSymbol(c.sym)) da.add(c.sym);
  return [...new Set([...extras.value, ...da, ...PALETA])];
});
const novoAcorde = ref(false);
function addExtra(v: string) {
  novoAcorde.value = false;
  if (v && !extras.value.includes(v)) extras.value.unshift(v);
  if (v) armado.value = v;
}

// sem arrastar (toque): clica no acorde da paleta e depois na sílaba
const armado = ref('');

// posição em colunas: a letra é monoespaçada, então 1 caractere = 1ch
const medida = ref<HTMLElement | null>(null);
const larguraChar = () => (medida.value ? medida.value.getBoundingClientRect().width / 10 : 9.6);
function coluna(e: MouseEvent | DragEvent, el: HTMLElement, l: SongLine) {
  const x = e.clientX - el.getBoundingClientRect().left + el.scrollLeft - 12; // 12 = padding da linha
  return Math.max(0, Math.min(l.lyric.length, Math.round(x / larguraChar())));
}

// acordes sem encostar um no outro (empurra p/ direita), em ch
function posicoes(l: SongLine): Map<Chord, number> {
  const m = new Map<Chord, number>();
  let dir = -1e9;
  for (const c of [...l.chords].sort((a, b) => a.idx - b.idx)) {
    const x = Math.max(Math.min(c.idx, l.lyric.length), dir + 1);
    m.set(c, x);
    dir = x + c.sym.length;
  }
  return m;
}

interface Arrasto { sym: string; si?: number; li?: number; ci?: number }
let arrasto: Arrasto | null = null;
const sobre = ref('');
function pegar(e: DragEvent, a: Arrasto) {
  arrasto = a;
  e.dataTransfer?.setData('text/plain', a.sym);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
}
function soltar(e: DragEvent, si: number, li: number) {
  sobre.value = '';
  const a = arrasto;
  arrasto = null;
  if (!a) return;
  const l = secs.value[si].lines[li];
  const idx = coluna(e, e.currentTarget as HTMLElement, l);
  if (a.si !== undefined) secs.value[a.si].lines[a.li!].chords.splice(a.ci!, 1);
  l.chords.push({ sym: a.sym, idx });
  mudou();
}
function cliqueLinha(e: MouseEvent, si: number, li: number) {
  if (!armado.value) return;
  e.preventDefault();
  const l = secs.value[si].lines[li];
  l.chords.push({ sym: armado.value, idx: coluna(e, e.currentTarget as HTMLElement, l) });
  mudou();
}

const editando = ref<{ si: number; li: number; ci: number } | null>(null);
function salvarAcorde(v: string) {
  const e = editando.value!;
  editando.value = null;
  if (v) { secs.value[e.si].lines[e.li].chords[e.ci].sym = v; mudou(); }
}
function apagarAcorde() {
  const e = editando.value!;
  editando.value = null;
  secs.value[e.si].lines[e.li].chords.splice(e.ci, 1);
  mudou();
}

const renomear = ref<number | null>(null);
function nomeSecao(v: string) {
  secs.value[renomear.value!].name = v;
  renomear.value = null;
  mudou();
}
function moverSecao(si: number, d: number) {
  const l = secs.value, j = si + d;
  if (j < 0 || j >= l.length) return;
  [l[si], l[j]] = [l[j], l[si]];
  mudou();
}
function duplicarSecao(si: number) {
  secs.value.splice(si + 1, 0, JSON.parse(JSON.stringify(secs.value[si])));
  mudou();
}
function apagarSecao(si: number) {
  secs.value.splice(si, 1);
  mudou();
}
function novaSecao() {
  secs.value.push({ name: 'Nova seção', lines: [{ lyric: '', chords: [] }] });
  mudou();
}
const menuSec = ref<number | null>(null);

function montar(): Song {
  const x = s.value!;
  x.sections = importText(texto.value);
  // "Tom: G", "Capo 2", {title: ...} no texto colado preenchem os campos
  const meta = detectMeta(texto.value);
  if (meta.title && (!x.title.trim() || x.title === 'Nova música')) x.title = meta.title;
  if (meta.artist && !x.artist.trim()) x.artist = meta.artist;
  if (meta.capo !== undefined) x.capo = meta.capo;
  if (meta.key) x.key = meta.key;
  else if (!x.key.trim() || x.key.trim() === 'C') {
    const k = suggestKey(x.sections);
    if (k) x.key = k;
  }
  x.title = x.title.trim() || 'Sem título';
  return x;
}

function salvar() {
  if (sugestao.value) { pedirNota.value = true; return; }
  if (props.acervo) salvarA(montar());
  else be.salvarSong(montar());
  if (props.nova) rascunho.value = null;
  voltar();
}

function enviar(nota: string) {
  pedirNota.value = false;
  (props.acervo ? sugerirA : sugerir)(montar(), nota);
  enviado.value = true;
  setTimeout(voltar, 1200);
}
</script>

<template>
  <div v-if="!s" class="empty">Música não encontrada</div>
  <div v-else @click="menuSec = null">
    <AppBar :titulo="sugestao ? 'Sugerir mudança' : props.nova ? 'Nova música' : 'Editar'"
      :sub="props.acervo && origem ? `Acervo — ${rotulo(origem)}` : ''">
      <button class="icon-btn" title="Desfazer" :disabled="!historico.length" @click="desfazer"><span class="ms">undo</span></button>
      <button class="icon-btn" title="Copiar como texto" @click="copiar"><span class="ms">content_copy</span></button>
      <button class="btn text" @click="voltar">Cancelar</button>
      <button class="btn" @click="salvar">
        <span class="ms">{{ sugestao ? 'outgoing_mail' : 'check' }}</span>{{ sugestao ? 'Enviar sugestão' : 'Salvar' }}
      </button>
    </AppBar>
    <div class="wrap">
      <div v-if="sugestao" class="banner">
        Esta música é de {{ nomeDe(origem!.dono) }}. O que você mudar vai como sugestão —
        {{ nomeDe(origem!.dono) }} aceita ou não.
      </div>
      <div v-if="enviado" class="banner ok">Sugestão enviada — {{ nomeDe(origem!.dono) }} decide se aceita.</div>
      <p v-if="aviso" class="okt">{{ aviso }}</p>

      <input v-model="s.title" class="titulo" placeholder="Título" />
      <div class="linha">
        <input v-model="s.artist" placeholder="Artista" class="grow" />
        <label class="mini">Tom<input v-model="s.key" /></label>
        <label class="mini">Capo<input v-model.number="s.capo" type="number" min="0" /></label>
        <label class="mini">BPM<input v-model.number="s.bpm" type="number" min="0" /></label>
        <button class="btn outlined tap" title="Toque no ritmo da música" @click="tapTempo">
          <span class="ms">touch_app</span>Tap tempo</button>
      </div>
      <div class="chips tags">
        <button v-for="t in s.tags" :key="t" class="chip" @click="s.tags = s.tags.filter((x) => x !== t)">
          {{ t }}<span class="ms">close</span>
        </button>
        <input v-model="tag" placeholder="+ tag" class="tag-in" @keyup.enter="addTag" @blur="addTag" />
      </div>
      <input v-model="s.notes" placeholder="Anotações (ex.: entra suave, repete 2x)" class="full" />

      <details class="lit" :open="!!(s.tempos.length || s.momentos.length)">
        <summary>
          <span class="ms">church</span>
          {{ [...s.tempos, ...s.momentos].join(' · ') || 'Tempo litúrgico e momento da Missa' }}
        </summary>
        <div class="faint lbl">Tempo litúrgico (nenhum = qualquer tempo)</div>
        <div class="chips">
          <button v-for="t in TEMPOS" :key="t" class="chip" :class="{ on: s.tempos.includes(t) }"
            @click="toggle(s.tempos, t, TEMPOS)">
            <span v-if="s.tempos.includes(t)" class="ms">check</span>{{ t }}
          </button>
        </div>
        <div class="faint lbl">Momento da Missa</div>
        <div class="chips">
          <button v-for="m in MOMENTOS" :key="m" class="chip" :class="{ on: s.momentos.includes(m) }"
            @click="toggle(s.momentos, m, MOMENTOS)">
            <span v-if="s.momentos.includes(m)" class="ms">check</span>{{ m }}
          </button>
        </div>
      </details>

      <div class="modos">
        <button class="seg" :class="{ on: modo === 'acordes' }" @click="setModo('acordes')">
          <span class="ms">piano</span>Acordes</button>
        <button class="seg" :class="{ on: modo === 'texto' }" @click="setModo('texto')">
          <span class="ms">notes</span>Texto</button>
      </div>

      <template v-if="modo === 'texto'">
        <p class="faint dica">
          Cifra: acordes acima da letra (cole do Cifra Club) ou <code>[G]</code> antes da sílaba;
          <code>#Refrão</code> = seção.
        </p>
        <div class="split">
          <textarea v-model="texto" spellcheck="false" placeholder="Cole a cifra aqui…"></textarea>
          <div class="previa card">
            <div class="faint lbl">Prévia</div>
            <ChordChart v-if="previa && previa.sections.length" :song="previa" :fonte="0.8" />
            <div v-else class="faint">A prévia aparece aqui…</div>
          </div>
        </div>
      </template>

      <template v-else>
        <p class="faint dica">
          Arraste um acorde da paleta (ou clique nele e depois na sílaba) p/ colocar. Arraste um acorde da
          cifra p/ mover; clique nele p/ trocar ou excluir. A letra dá p/ editar direto.
        </p>
        <span ref="medida" class="medida">MMMMMMMMMM</span>
        <div v-for="(sec, si) in secs" :key="si" class="card secao">
          <div class="sec-topo">
            <button class="sec-nome" @click="renomear = si">{{ sec.name ? sec.name.toUpperCase() : '(sem nome)' }}</button>
            <button class="icon-btn" title="Subir" :disabled="si === 0" @click="moverSecao(si, -1)"><span class="ms">arrow_upward</span></button>
            <button class="icon-btn" title="Descer" :disabled="si === secs.length - 1" @click="moverSecao(si, 1)"><span class="ms">arrow_downward</span></button>
            <div class="menu-wrap">
              <button class="icon-btn" title="Mais" @click.stop="menuSec = menuSec === si ? null : si"><span class="ms">more_vert</span></button>
              <div v-if="menuSec === si" class="menu" @click.stop="menuSec = null">
                <button @click="renomear = si"><span class="ms">edit</span>Renomear</button>
                <button @click="duplicarSecao(si)"><span class="ms">content_copy</span>Duplicar</button>
                <button @click="apagarSecao(si)"><span class="ms">delete</span>Excluir</button>
              </div>
            </div>
          </div>
          <div v-for="(l, li) in sec.lines" :key="li" class="vl" :class="{ sobre: sobre === `${si}.${li}`, armado }"
            @dragover.prevent="sobre = `${si}.${li}`" @dragleave="sobre = ''" @drop.prevent="soltar($event, si, li)"
            @click="cliqueLinha($event, si, li)">
            <div class="vac">
              <span v-for="[c, x] in posicoes(l)" :key="l.chords.indexOf(c) + c.sym" class="vch" :style="{ left: x + 'ch' }"
                draggable="true" title="Arraste p/ mover; clique p/ trocar"
                @dragstart="pegar($event, { sym: c.sym, si, li, ci: l.chords.indexOf(c) })"
                @click.stop="editando = { si, li, ci: l.chords.indexOf(c) }">{{ c.sym }}</span>
            </div>
            <input v-model="l.lyric" class="vletra" spellcheck="false" placeholder="(só acordes)"
              :style="{ width: `max(100%, ${l.lyric.length + 2}ch)` }" :readonly="!!armado" @input="mudouLetra" />
          </div>
          <button class="btn text" @click="sec.lines.push({ lyric: '', chords: [] }); mudou()">
            <span class="ms">add</span>linha</button>
        </div>
        <button class="btn tonal" @click="novaSecao"><span class="ms">add</span>Adicionar seção</button>

        <div class="paleta">
          <span class="plbl">Acordes</span>
          <div class="pchips">
            <button v-for="c in paleta" :key="c" class="chip pc" :class="{ on: armado === c }" draggable="true"
              @dragstart="pegar($event, { sym: c })" @click="armado = armado === c ? '' : c">{{ c }}</button>
            <button class="chip" title="Outro acorde" @click="novoAcorde = true"><span class="ms">add</span></button>
          </div>
          <button v-if="armado" class="btn text" @click="armado = ''">Soltar {{ armado }}</button>
        </div>
      </template>
    </div>
    <Prompt v-if="pedirNota" titulo="Enviar sugestão" dica="Recado p/ o dono (opcional) — ex.: acorde errado no refrão"
      ok="Enviar" @fechar="pedirNota = false" @ok="enviar" />
    <Prompt v-if="novoAcorde" titulo="Acorde" dica="Ex.: F#m7" ok="Usar" @fechar="novoAcorde = false" @ok="addExtra" />
    <Prompt v-if="editando" titulo="Editar acorde" ok="OK"
      :valor="secs[editando.si].lines[editando.li].chords[editando.ci]?.sym" @fechar="editando = null" @ok="salvarAcorde">
      <button type="button" class="btn danger del" @click="apagarAcorde"><span class="ms">delete</span>Excluir</button>
    </Prompt>
    <Prompt v-if="renomear !== null" titulo="Nome da seção" ok="OK" :valor="secs[renomear]?.name"
      @fechar="renomear = null" @ok="nomeSecao" />
  </div>
</template>

<style scoped>
.wrap { max-width: 1200px; margin: 0 auto; padding: 0 16px 120px; display: flex; flex-direction: column; gap: 10px; }
.titulo { font-size: 20px; font-weight: 700; }
.linha { display: flex; gap: 8px; flex-wrap: wrap; align-items: flex-end; }
.grow { flex: 1; min-width: 200px; }
.mini { display: flex; flex-direction: column; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .6px; color: var(--faint); gap: 4px; }
.mini input { width: 84px; text-align: center; padding: 8px; }
.tap { padding: 9px 14px; }
.tags { align-items: center; }
.tag-in { width: 110px; padding: 7px 12px; }
.full { width: 100%; }
.lit summary { cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 6px 0; }
.lit summary .ms { color: var(--primary); font-size: 20px; }
.lbl { font-size: 12px; margin: 8px 0 4px; }
.dica { margin: 4px 0 0; font-size: 13px; }
.split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; min-height: 60vh; }
textarea { font-family: var(--mono); font-size: 14px; line-height: 1.45; min-height: 60vh; }
.previa { overflow: auto; max-height: 75vh; }
.banner.ok { background: color-mix(in srgb, var(--ok) 25%, transparent); color: var(--fg); }
.okt { color: var(--ok); margin: 0; }
.modos { display: inline-flex; align-self: flex-start; gap: 4px; padding: 4px; background: var(--surface-1); border: 1px solid var(--line); border-radius: 11px; }
.seg { display: inline-flex; align-items: center; gap: 6px; height: 32px; border: 0; border-radius: 8px; background: transparent; padding: 0 14px; font-size: 13.5px; color: var(--muted); }
.seg:hover { color: var(--fg); }
.seg.on { background: var(--chip); color: var(--fg); box-shadow: inset 0 0 0 1px var(--line-2); }
.seg .ms { font-size: 18px; }

/* modo Acordes */
.medida { position: absolute; visibility: hidden; font-family: var(--mono); font-size: 16px; white-space: pre; }
.secao { padding: 6px 8px 8px; }
.sec-topo { display: flex; align-items: center; gap: 2px; }
.sec-nome {
  flex: 1; text-align: left; border: 0; background: transparent; color: var(--primary);
  font-size: 13px; font-weight: 800; letter-spacing: 1px; padding: 8px 4px;
}
.vl { padding: 2px 12px; border-radius: 8px; font-family: var(--mono); font-size: 16px; overflow-x: auto; }
.vl.sobre { background: color-mix(in srgb, var(--primary) 12%, transparent); }
.vl.armado { cursor: crosshair; }
.vl.armado .vletra { cursor: crosshair; }
.vac { position: relative; height: 22px; white-space: pre; }
.vch {
  position: absolute; top: 0; color: var(--chord); font-weight: 700; cursor: grab; line-height: 22px;
  border-radius: 4px; padding: 0 1px; margin-left: -1px;
}
.vch:hover { background: var(--chip); }
.vletra {
  display: block; width: 100%; font-family: var(--mono); font-size: 16px; padding: 0; border: 0;
  border-radius: 0; background: transparent; line-height: 1.25; letter-spacing: 0;
}
.vletra:focus { border-bottom: 1px solid var(--primary); }
.paleta {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 15; display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; background: var(--surface-1); border-top: 1px solid var(--line);
}
.plbl { font-weight: 700; flex: none; }
.pchips { display: flex; gap: 6px; overflow-x: auto; flex: 1; padding-bottom: 2px; }
.pc { color: var(--chord); font-weight: 700; cursor: grab; }
.pc.on { color: #fff; }
.del { margin-top: 12px; }
@media (max-width: 760px) { .split { grid-template-columns: 1fr; } }
</style>
