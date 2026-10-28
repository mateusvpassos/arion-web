<script setup lang="ts">
// Minhas músicas: a biblioteca (cópias próprias), com editar/duplicar/excluir.
import { ref, computed } from 'vue';
import AppBar from '../components/AppBar.vue';
import Prompt from '../components/Prompt.vue';
import { abrir } from '../nav';
import * as be from '../backend';
import { ativa, eu, nomeDe, cloud } from '../cloud';
import { searchSongs, fold } from '../core';
import { usoMusicas, quando } from '../liturgia';
import type { Song } from '../types';
import { rascunho } from '../rascunho';

const busca = ref('');
const menu = ref<string | null>(null);
const apagar = ref<{ id: string; nome: string } | null>(null);

const uso = computed(() => usoMusicas(be.setlists.value));
const hits = computed(() => {
  const l = searchSongs(be.songs.value, busca.value);
  if (!busca.value.trim()) l.sort((a, b) => fold(a.song.title).localeCompare(fold(b.song.title)));
  return l;
});

function meta(s: Song): string {
  const u = uso.value[s.id];
  return [
    ativa.value && s.dono && s.dono !== eu.value ? `de ${nomeDe(s.dono)}` : '',
    s.artist,
    s.bpm ? `${s.bpm} BPM` : '',
    u ? `tocada ${quando(u.ultima)} (${u.vezes}x)` : '',
  ].filter(Boolean).join('  •  ');
}

function novaMusica() {
  const d = be.rascunhoSong();
  abrir({ nome: 'editar', id: d.id, nova: true });
  rascunho.value = d;
}
</script>

<template>
  <div @click="menu = null">
    <AppBar titulo="Minhas músicas" :sub="`${be.songs.value.length} na ${cloud.grupo?.nome ?? 'biblioteca'}`" />
    <div class="wrap">
      <div class="busca">
        <span aria-hidden="true" class="ms">search</span>
        <input v-model="busca" placeholder="Buscar (nome, artista ou trecho da letra)..." />
      </div>
      <ul class="list">
        <li v-for="h in hits" :key="h.song.id" class="row" @click="abrir({ nome: 'musica', id: h.song.id })">
          <div class="key-badge">{{ h.song.key }}</div>
          <div class="grow">
            <div class="title">{{ h.song.title }}</div>
            <div v-if="h.snippet" class="sub trecho">“{{ h.snippet }}”</div>
            <div v-if="meta(h.song)" class="sub">{{ meta(h.song) }}</div>
            <div v-if="h.song.tags.length" class="tags">
              <span v-for="t in h.song.tags.slice(0, 4)" :key="t" class="tag">{{ t }}</span>
            </div>
          </div>
          <div class="menu-wrap" @click.stop>
            <button class="icon-btn" title="Mais opções" aria-label="Mais opções" @click="menu = menu === h.song.id ? null : h.song.id">
              <span aria-hidden="true" class="ms">more_vert</span>
            </button>
            <div v-if="menu === h.song.id" class="menu">
              <button @click="abrir({ nome: 'editar', id: h.song.id }); menu = null">
                <span aria-hidden="true" class="ms">{{ be.podeEditarSong(h.song) ? 'edit' : 'rate_review' }}</span>
                {{ be.podeEditarSong(h.song) ? 'Editar' : 'Sugerir mudança' }}
              </button>
              <button @click="be.duplicarSong(h.song); menu = null"><span aria-hidden="true" class="ms">content_copy</span>Duplicar</button>
              <button v-if="be.souDono(h.song.dono)" @click="apagar = { id: h.song.id, nome: h.song.title }; menu = null">
                <span aria-hidden="true" class="ms">delete</span>Excluir</button>
            </div>
          </div>
        </li>
        <li v-if="!hits.length" class="empty">{{ busca ? 'Nada encontrado' : 'Nenhuma música ainda' }}</li>
      </ul>
    </div>
    <button class="fab no-print" @click="novaMusica"><span aria-hidden="true" class="ms">add</span>Música</button>
    <Prompt v-if="apagar" titulo="Excluir?" :texto="`“${apagar.nome}” sai da sua biblioteca (o acervo geral não muda).`"
      sem-campo ok="Excluir" @fechar="apagar = null" @ok="be.excluirSong(apagar!.id); apagar = null" />
  </div>
</template>

<style scoped>
.wrap { max-width: 960px; margin: 0 auto; padding: 0 12px 110px; }
.trecho { color: var(--primary); font-style: italic; }
.tags { display: flex; gap: 4px; margin-top: 4px; }
</style>
