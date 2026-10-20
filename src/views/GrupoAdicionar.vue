<script setup lang="ts">
// Escolhe músicas do acervo p/ pôr no grupo (marca várias de uma vez).
import { ref, computed, onUnmounted } from 'vue';
import AppBar from '../components/AppBar.vue';
import { cloud, adicionarAoGrupo, ouvirMusicasDe, nomeDoGrupo } from '../cloud';
import { acervo, obras, rotulo } from '../acervo';
import { searchSongs, fold } from '../core';
import { voltar } from '../nav';
import type { Song } from '../types';

const props = defineProps<{ id: string }>();
const g = computed(() => cloud.grupos.find((x) => x.id === props.id) ?? null);

// de quais músicas do acervo o grupo já tem cópia
const ja = ref(new Set<string>());
const sub = g.value ? ouvirMusicasDe(g.value, (l) => { ja.value = new Set(l.map((s) => s.baseId).filter(Boolean)); }) : null;
onUnmounted(() => sub?.());

const busca = ref('');
const marcadas = ref(new Map<string, Song>());
const hits = computed(() => {
  const l = searchSongs(Object.values(obras.value).flat(), busca.value);
  if (!busca.value.trim()) l.sort((a, b) => fold(a.song.title).localeCompare(fold(b.song.title)));
  return l;
});
function alterna(s: Song) {
  if (ja.value.has(s.id)) return;
  const m = new Map(marcadas.value);
  if (m.has(s.id)) m.delete(s.id); else m.set(s.id, s);
  marcadas.value = m;
}
async function adicionar() {
  if (!g.value) return;
  await adicionarAoGrupo(g.value, [...marcadas.value.values()], ja.value);
  voltar();
}
const sublinha = (s: Song) => [s.key, s.artist, s.nomeVersao ? rotulo(s) : '', ja.value.has(s.id) ? 'já está no grupo' : '']
  .filter(Boolean).join(' · ');
</script>

<template>
  <div>
    <AppBar :titulo="g ? `Adicionar a ${nomeDoGrupo(g)}` : 'Adicionar'" />
    <div class="wrap">
      <input v-model="busca" autofocus placeholder="Buscar no acervo (título, artista ou trecho)…" class="busca" />
      <p v-if="!acervo.carregou" class="faint">Carregando o acervo…</p>
      <ul class="lista">
        <li v-for="h in hits" :key="h.song.id" :class="{ off: ja.has(h.song.id) }" @click="alterna(h.song)">
          <span class="ms caixa">{{ ja.has(h.song.id) || marcadas.has(h.song.id) ? 'check_box' : 'check_box_outline_blank' }}</span>
          <div class="grow"><div>{{ h.song.title }}</div><div class="faint small">{{ sublinha(h.song) }}</div></div>
        </li>
      </ul>
    </div>
    <button v-if="marcadas.size" class="btn fab" @click="adicionar">
      <span class="ms">check</span>Adicionar {{ marcadas.size }}</button>
  </div>
</template>

<style scoped>
.wrap { max-width: 760px; margin: 0 auto; padding: 0 16px 96px; display: flex; flex-direction: column; gap: 10px; }
.busca { width: 100%; }
.small { font-size: 12px; }
.lista { list-style: none; margin: 0; padding: 0; }
.lista li { display: flex; align-items: center; gap: 12px; padding: 8px 6px; border-radius: 8px; cursor: pointer; }
.lista li:hover { background: var(--chip); }
.lista li.off { opacity: 0.55; cursor: default; }
.caixa { color: var(--primary); }
.grow { flex: 1; min-width: 0; }
.fab { position: fixed; right: 20px; bottom: 20px; }
</style>
