<script setup lang="ts">
import { ref } from 'vue';
import AppBar from '../components/AppBar.vue';
import { abrir } from '../nav';
import { computed } from 'vue';
import { eu, paraDecidir as pdGrupo, minhas as mGrupo, type Sugestao } from '../cloud';
import { paraDecidirA, minhasA } from '../acervo';
import { fmtQuando } from '../core';
import { statusTexto, statusIcone } from '../sugestoes';

const porData = (a: Sugestao, b: Sugestao) => (b.em?.getTime() ?? 0) - (a.em?.getTime() ?? 0);
// grupo + acervo numa lista só
const paraDecidir = computed(() => [...pdGrupo.value, ...paraDecidirA.value].sort(porData));
const minhas = computed(() => [...mGrupo.value, ...minhasA.value].sort(porData));
const aba = ref<'decidir' | 'minhas'>(paraDecidir.value.length || !minhas.value.length ? 'decidir' : 'minhas');

</script>


<template>
  <div>
    <AppBar titulo="Sugestões" />
    <nav class="tabs">
      <button :class="{ on: aba === 'decidir' }" @click="aba = 'decidir'">Para decidir ({{ paraDecidir.length }})</button>
      <button :class="{ on: aba === 'minhas' }" @click="aba = 'minhas'">Minhas ({{ minhas.length }})</button>
    </nav>
    <div class="wrap">
      <ul class="list">
        <li v-for="x in (aba === 'decidir' ? paraDecidir : minhas)" :key="x.id" class="row"
          @click="abrir({ nome: 'sugestao', id: x.id })">
          <span aria-hidden="true" class="ms fill" :style="{ color: statusIcone(x.status).cor }">{{ statusIcone(x.status).ic }}</span>
          <div class="grow">
            <div class="title">{{ x.acervo ? 'Acervo · ' : '' }}{{ x.titulo }}</div>
            <div class="sub">
              {{ [x.por !== eu ? `de ${x.porNome || x.por}` : '', fmtQuando(x.em),
                  x.status !== 'pendente' ? statusTexto(x) : '', x.nota ? `“${x.nota}”` : ''].filter(Boolean).join('  •  ') }}
            </div>
          </div>
          <span aria-hidden="true" class="ms faint">chevron_right</span>
        </li>
        <li v-if="!(aba === 'decidir' ? paraDecidir : minhas).length" class="empty">
          {{ aba === 'decidir' ? 'Nenhuma sugestão esperando você.' : 'Você ainda não sugeriu nada.' }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.wrap { max-width: 960px; margin: 0 auto; padding: 0 12px 40px; }
.row .ms { margin: 0 4px; }
</style>
