<script setup lang="ts">
import { ref, computed } from 'vue';
import AppBar from '../components/AppBar.vue';
import Permissoes from '../components/Permissoes.vue';
import { abrir } from '../nav';
import * as be from '../backend';
import { ativa, nomeDe, setEditoresSetlist } from '../cloud';
import { fmtData, searchSongs, transposeSong } from '../core';
import { wordRepertorio, imagemRepertorio } from '../exportar';
import { obras, copiaDaObra, puxar } from '../acervo';
import { MOMENTOS, ordem, temposDe, usoMusicas, quando } from '../liturgia';
import type { Setlist, Song } from '../types';

const props = defineProps<{ id: string }>();
const sl = computed(() => be.setlistById(props.id));
const musicas = computed(() =>
  (sl.value?.songIds ?? []).map((id) => be.songById(id)).filter((s): s is Song => !!s));
const pode = computed(() => !!sl.value && be.podeEditarSetlist(sl.value));

function salvar(mud: Partial<Setlist>) {
  if (!sl.value || !pode.value) return;
  be.salvarSetlist({ ...sl.value, ...mud });
}

const nome = ref(sl.value?.name ?? '');
function renomear() { if (nome.value.trim() && nome.value !== sl.value?.name) salvar({ name: nome.value.trim() }); }
const dataIso = computed({
  get: () => (sl.value?.date ?? '').slice(0, 10),
  set: (v: string) => salvar({ date: v ? `${v}T00:00:00.000` : null }),
});

function mover(i: number, d: number) {
  const ids = musicas.value.map((s) => s.id);
  const j = i + d;
  if (j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  salvar({ songIds: [...ids, ...sl.value!.songIds.filter((x) => !ids.includes(x))] });
}
// arrastar p/ reordenar
const arrastando = ref(-1);
function soltar(j: number) {
  const i = arrastando.value;
  arrastando.value = -1;
  if (i < 0 || i === j) return;
  const ids = musicas.value.map((s) => s.id);
  ids.splice(j, 0, ids.splice(i, 1)[0]);
  salvar({ songIds: [...ids, ...sl.value!.songIds.filter((x) => !ids.includes(x))] });
}

function tirar(id: string) {
  const m = { ...sl.value!.moments }; delete m[id];
  const t = { ...sl.value!.transpose }; delete t[id];
  salvar({ songIds: sl.value!.songIds.filter((x) => x !== id), moments: m, transpose: t });
}

function ordenarMissa() {
  const ids = [...sl.value!.songIds];
  const pos = new Map(ids.map((x, i) => [x, i]));
  ids.sort((a, b) => ordem(sl.value!.moments[a]) - ordem(sl.value!.moments[b]) || pos.get(a)! - pos.get(b)!);
  salvar({ songIds: ids });
}

const momentoDe = ref<Song | null>(null);
function setMomento(m: string | null) {
  const id = momentoDe.value!.id;
  momentoDe.value = null;
  const mm = { ...sl.value!.moments };
  if (m) mm[id] = m; else delete mm[id];
  salvar({ moments: mm });
}

// ---- adicionar músicas: sugestões pelo tempo litúrgico e pelo uso ----
const add = ref(false);
const busca = ref('');
const filtroMomento = ref<string | null>(null);
const soTempo = ref(true);
const dataMissa = computed(() => (sl.value?.date ? new Date(sl.value.date) : new Date()));
const tempos = computed(() => temposDe(dataMissa.value));
const uso = computed(() => usoMusicas(be.setlists.value, dataMissa.value, props.id));
const especifica = (s: Song) => s.tempos.some((t) => tempos.value.includes(t));
// minhas músicas + as do acervo que ainda não tenho (entram nas minhas ao marcar)
const doAcervo = computed(() => Object.entries(obras.value)
  .filter(([k]) => !copiaDaObra(k))
  .map(([, vs]) => vs[0]));
const daBiblioteca = (s: Song) => !!be.songById(s.id);
const achadas = computed(() => {
  let l = searchSongs([...be.songs.value, ...doAcervo.value], busca.value);
  if (filtroMomento.value) l = l.filter((h) => h.song.momentos.includes(filtroMomento.value!));
  if (!busca.value.trim()) {
    if (soTempo.value) l = l.filter((h) => !h.song.tempos.length || especifica(h.song));
    const q = (s: Song) => uso.value[s.id]?.ultima ?? 0;
    l.sort((a, b) => (especifica(a.song) ? 0 : 1) - (especifica(b.song) ? 0 : 1) || q(a.song) - q(b.song));
  }
  return l;
});
function marcar(s: Song) {
  if (!daBiblioteca(s)) s = puxar(s);
  const r = sl.value!;
  if (r.songIds.includes(s.id)) { tirar(s.id); return; }
  const m = filtroMomento.value ?? (s.momentos.length === 1 ? s.momentos[0] : null);
  salvar({ songIds: [...r.songIds, s.id], moments: m ? { ...r.moments, [s.id]: m } : r.moments });
}

// ---- exportar ----
// no tom do repertório e com o momento da Missa no título, como no app
const cifras = () => musicas.value.map((s) => {
  const c = transposeSong(s, sl.value!.transpose[s.id] ?? 0);
  const m = sl.value!.moments[s.id];
  return m ? { ...c, title: `${m} · ${c.title}` } : c;
});
const exportar = ref(false);
function exporta(tipo: 'docx' | 'img' | 'txt') {
  exportar.value = false;
  if (tipo === 'docx') wordRepertorio(sl.value!.name, cifras());
  if (tipo === 'img') imagemRepertorio(sl.value!.name, cifras().map((s) => s.title));
  if (tipo === 'txt') baixarLetras();
}
function baixarLetras() {
  const r = sl.value!;
  const txt = [`${r.name}${r.date ? ' — ' + fmtData(r.date) : ''}`, ''];
  musicas.value.forEach((s, i) => {
    const m = r.moments[s.id];
    txt.push(`${i + 1}. ${m ? m + ' · ' : ''}${s.title}`, '');
    for (const sec of s.sections) for (const l of sec.lines) if (l.lyric.trim()) txt.push(l.lyric.trim());
    txt.push('', '');
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt.join('\n')], { type: 'text/plain;charset=utf-8' }));
  a.download = `${r.name} - letras.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}

const perm = ref(false);
</script>

<template>
  <div v-if="!sl" class="empty">Repertório não encontrado</div>
  <div v-else @click="exportar = false">
    <AppBar :titulo="sl.name" :sub="[fmtData(sl.date), sl.date ? tempos[0] : ''].filter(Boolean).join('  •  ')">
      <button v-if="ativa" class="icon-btn" title="Dono e quem pode editar" @click="perm = true">
        <span class="ms">manage_accounts</span>
      </button>
      <button v-if="pode && Object.keys(sl.moments).length" class="icon-btn" title="Ordenar pela ordem da Missa"
        @click="ordenarMissa"><span class="ms">sort</span></button>
      <button class="icon-btn" title="Iniciar" :disabled="!musicas.length"
        @click="abrir({ nome: 'musica', id: musicas[0].id, setlistId: sl.id })">
        <span class="ms fill">play_circle</span>
      </button>
      <button class="icon-btn" title="PDF (todas as cifras, no tom do repertório)" :disabled="!musicas.length"
        @click="abrir({ nome: 'imprimir', setlistId: sl.id })"><span class="ms">print</span></button>
      <div class="menu-wrap">
        <button class="icon-btn" title="Exportar" :disabled="!musicas.length" @click.stop="exportar = !exportar">
          <span class="ms">ios_share</span></button>
        <div v-if="exportar" class="menu" @click.stop>
          <button @click="exportar = false; abrir({ nome: 'imprimir', setlistId: sl.id })"><span class="ms">print</span>PDF (todas as cifras)</button>
          <button @click="exporta('docx')"><span class="ms">description</span>Word (.docx)</button>
          <button @click="exporta('img')"><span class="ms">image</span>Imagem da lista</button>
          <button @click="exporta('txt')"><span class="ms">lyrics</span>Letras (TXT) — cantores</button>
        </div>
      </div>
    </AppBar>

    <div class="wrap">
      <div v-if="!pode" class="banner">
        Repertório de {{ nomeDe(sl.dono) }} — só leitura. Para montar o seu, use Duplicar na lista de repertórios.
      </div>
      <div v-else class="topo">
        <input v-model="nome" class="grow" @blur="renomear" @keyup.enter="renomear" />
        <label class="data"><span class="ms">event</span><input v-model="dataIso" type="date" /></label>
      </div>

      <ol class="list">
        <li v-for="(s, i) in musicas" :key="s.id" class="row" :draggable="pode"
          @dragstart="arrastando = i" @dragover.prevent @drop="soltar(i)"
          @click="abrir({ nome: 'musica', id: s.id, setlistId: sl.id })">
          <span class="num">{{ i + 1 }}</span>
          <div class="grow">
            <div class="title">
              <span v-if="sl.moments[s.id]" class="momento">{{ sl.moments[s.id].toUpperCase() }}</span>{{ s.title }}
            </div>
            <div class="sub">
              {{ [s.key, sl.transpose[s.id] ? `tom ${sl.transpose[s.id] > 0 ? '+' : ''}${sl.transpose[s.id]}` : '', s.artist].filter(Boolean).join('  •  ') }}
            </div>
          </div>
          <template v-if="pode">
            <button class="icon-btn" title="Momento da Missa" @click.stop="momentoDe = s">
              <span class="ms" :class="{ fill: sl.moments[s.id] }">label</span>
            </button>
            <button class="icon-btn" title="Subir" @click.stop="mover(i, -1)"><span class="ms">arrow_upward</span></button>
            <button class="icon-btn" title="Descer" @click.stop="mover(i, 1)"><span class="ms">arrow_downward</span></button>
            <button class="icon-btn" title="Tirar do repertório" @click.stop="tirar(s.id)">
              <span class="ms">remove_circle_outline</span>
            </button>
          </template>
        </li>
        <li v-if="!musicas.length" class="empty">Vazio — adicione músicas</li>
      </ol>
    </div>

    <button v-if="pode" class="fab no-print" @click="add = true"><span class="ms">add</span>Músicas</button>

    <!-- momento -->
    <div v-if="momentoDe" class="scrim" @click.self="momentoDe = null">
      <div class="sheet">
        <h3 class="section-title">{{ momentoDe.title }}</h3>
        <div class="chips">
          <button v-for="m in MOMENTOS" :key="m" class="chip" :class="{ on: sl.moments[momentoDe.id] === m }"
            @click="setMomento(m)">
            <span v-if="momentoDe.momentos.includes(m)" class="ms fill">star</span>{{ m }}
          </button>
          <button v-if="sl.moments[momentoDe.id]" class="chip" @click="setMomento(null)">
            <span class="ms">close</span>Sem momento
          </button>
        </div>
      </div>
    </div>

    <!-- adicionar -->
    <div v-if="add" class="scrim" @click.self="add = false">
      <div class="sheet alta">
        <input v-model="busca" placeholder="Buscar por nome ou trecho da letra..." class="full" autofocus />
        <div class="filtros">
          <button class="chip" :class="{ on: soTempo }" :title="`Só cantos de ${tempos[0]} ou sem tempo marcado`"
            @click="soTempo = !soTempo"><span class="ms">church</span>{{ tempos[0] }}</button>
          <button v-for="m in MOMENTOS" :key="m" class="chip" :class="{ on: filtroMomento === m }"
            @click="filtroMomento = filtroMomento === m ? null : m">{{ m }}</button>
        </div>
        <p v-if="!achadas.length" class="empty">
          {{ filtroMomento ? `Nenhum canto marcado p/ “${filtroMomento}”${soTempo ? ' em ' + tempos[0] : ''}. Marque na edição da música.` : 'Nenhuma música encontrada.' }}
        </p>
        <ul class="list">
          <li v-for="h in achadas" :key="h.song.id" class="row add-row" @click="marcar(h.song)">
            <span class="ms" :class="{ fill: sl.songIds.includes(h.song.id) }" style="color: var(--primary)">
              {{ sl.songIds.includes(h.song.id) ? 'check_box' : 'check_box_outline_blank' }}
            </span>
            <div class="grow">
              <div class="title small">{{ h.song.title }}</div>
              <div class="sub">
                {{ [h.song.key,
                    uso[h.song.id] ? `tocada ${quando(uso[h.song.id].ultima, dataMissa)} (${uso[h.song.id].vezes}x)` : 'nunca tocada',
                    h.snippet ? `“${h.snippet}”` : ''].filter(Boolean).join('  •  ') }}
              </div>
            </div>
            <span v-if="!daBiblioteca(h.song)" class="ms faint" title="Do acervo geral — entra nas suas músicas ao marcar">public</span>
            <span v-if="especifica(h.song)" class="ms" style="color: var(--primary)" title="Do tempo litúrgico">church</span>
          </li>
        </ul>
        <div class="actions"><button class="btn" @click="add = false">Pronto</button></div>
      </div>
    </div>

    <Permissoes v-if="perm" :titulo="sl.name" :dono="sl.dono" :editores="sl.editores"
      @fechar="perm = false" @salvar="(l) => setEditoresSetlist(sl!, l)" />
  </div>
</template>

<style scoped>
.wrap { max-width: 960px; margin: 0 auto; padding: 0 12px 110px; display: flex; flex-direction: column; gap: 10px; }
.topo { display: flex; gap: 8px; align-items: center; }
.grow { flex: 1; min-width: 0; }
.data { display: flex; align-items: center; gap: 6px; }
.data .ms { color: var(--primary); }
.num {
  width: 40px; height: 40px; border-radius: 50%; background: var(--primary-container); color: #fff;
  display: grid; place-items: center; font-weight: 600; flex: none;
}
:root[data-theme='light'] .num { color: #00105c; }
.momento { font-size: 11px; font-weight: 800; letter-spacing: .8px; color: var(--primary); margin-right: 10px; }
.title.small { font-size: 15px; }
.alta { max-height: 90vh; }
.full { width: 100%; }
.filtros { display: flex; gap: 6px; overflow-x: auto; padding: 10px 0; }
.add-row { padding: 8px 12px; }
</style>
