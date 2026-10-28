<script setup lang="ts">
// Folha p/ imprimir ou salvar em PDF (pelo diálogo do navegador): a música
// ou o repertório inteiro, no tom do repertório, sem quebrar seção ao meio.
import { computed, onMounted } from 'vue';
import AppBar from '../components/AppBar.vue';
import ChordChart from '../components/ChordChart.vue';
import * as be from '../backend';
import { transposeSong, fmtData } from '../core';
import { prefs } from '../nav';
import type { Song } from '../types';

const props = defineProps<{ setlistId?: string; songId?: string }>();
const sl = computed(() => (props.setlistId ? be.setlistById(props.setlistId) : undefined));
const itens = computed(() => {
  const ids = props.songId ? [props.songId] : sl.value?.songIds ?? [];
  return ids.map((id) => be.songById(id)).filter((s): s is Song => !!s).map((s) => ({
    s: transposeSong(s, sl.value?.transpose[s.id] ?? 0),
  }));
});
const titulo = computed(() => (props.songId ? itens.value[0]?.s.title ?? '' : sl.value?.name ?? ''));
onMounted(() => { document.title = titulo.value; });
const imprimir = () => window.print();
</script>

<template>
  <div>
    <AppBar :titulo="`Imprimir — ${titulo}`" sub="Use “Salvar como PDF” no destino da impressão">
      <button class="btn" @click="imprimir"><span aria-hidden="true" class="ms">print</span>Imprimir / PDF</button>
    </AppBar>
    <div class="folha" :class="{ varias: itens.length > 1 }">
      <header v-if="sl && !props.songId" class="capa">
        <h1>{{ sl.name }}</h1>
        <div v-if="sl.date">{{ fmtData(sl.date) }}</div>
        <ol>
          <li v-for="(x, i) in itens" :key="i">{{ x.s.title }} ({{ x.s.key }})</li>
        </ol>
      </header>
      <article v-for="(x, i) in itens" :key="i" class="musica">
        <h2>{{ props.songId ? '' : `${i + 1}. ` }}{{ x.s.title }}</h2>
        <div class="meta">Tom: {{ x.s.key }}{{ x.s.capo ? ` • capo ${x.s.capo}` : '' }}{{ x.s.artist ? ` • ${x.s.artist}` : '' }}</div>
        <ChordChart :song="x.s" :fonte="0.72" :letra="prefs.soLetra" />
      </article>
    </div>
  </div>
</template>

<style scoped>
.folha { max-width: 900px; margin: 0 auto; padding: 0 20px 40px; }
.capa { margin-bottom: 24px; }
.capa h1 { margin: 0 0 4px; }
h2 { font-size: 18px; margin: 18px 0 2px; }
.meta { color: var(--muted); font-size: 13px; margin-bottom: 4px; }
.musica :deep(.ln), .musica :deep(.sec) { break-inside: avoid; }
@media print {
  .folha { max-width: none; padding: 0; }
  .musica { break-before: page; }
  .capa + .musica { break-before: page; }
  :global(.chart) { color: #000; }
}
</style>
