<script setup lang="ts">
// O que mudou por último no grupo (quem e quando), mais recente primeiro.
import { computed } from 'vue';
import AppBar from '../components/AppBar.vue';
import { abrir } from '../nav';
import { cloud, nomeDe } from '../cloud';
import { fmtQuando } from '../core';

const itens = computed(() => [
  ...cloud.songs.map((s) => ({ tipo: 'musica' as const, id: s.id, t: s.title, por: s.porNome || nomeDe(s.por), em: s.updatedAt, v: s.versao })),
  ...cloud.setlists.map((s) => ({ tipo: 'repertorio' as const, id: s.id, t: s.name, por: s.porNome || nomeDe(s.por), em: s.updatedAt, v: 0 })),
].sort((a, b) => b.em.localeCompare(a.em)).slice(0, 80));
</script>

<template>
  <div>
    <AppBar titulo="Atividade recente" sub="Última mudança de cada música e repertório" />
    <div class="wrap">
      <ul class="list">
        <li v-for="x in itens" :key="x.tipo + x.id" class="row"
          @click="x.tipo === 'musica' ? abrir({ nome: 'versoes', id: x.id }) : abrir({ nome: 'repertorio', id: x.id })">
          <span aria-hidden="true" class="ms ic">{{ x.tipo === 'musica' ? 'music_note' : 'queue_music' }}</span>
          <div class="grow">
            <div class="title small">{{ x.t }}</div>
            <div class="sub">{{ x.por || '—' }} • {{ fmtQuando(x.em) }}{{ x.v ? ` • versão ${x.v}` : '' }}</div>
          </div>
          <span aria-hidden="true" class="ms faint">chevron_right</span>
        </li>
        <li v-if="!itens.length" class="empty">Nada ainda.</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.wrap { max-width: 960px; margin: 0 auto; padding: 0 12px 40px; }
.ic { color: var(--primary); margin: 0 4px; }
.title.small { font-size: 16px; }
</style>
