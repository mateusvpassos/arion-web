<script setup lang="ts">
import { ref } from 'vue';
import AppBar from '../components/AppBar.vue';
import { abrir } from '../nav';
import { computed } from 'vue';
import {
  eu, cloud, paraDecidir as pdGrupo, minhas as mGrupo, pendentesOutros, escolherGrupo, nomeDoGrupo, type Sugestao,
} from '../cloud';
import { paraDecidirA, minhasA } from '../acervo';
import { fmtQuando } from '../core';
import { statusTexto, statusIcone } from '../sugestoes';

const porData = (a: Sugestao, b: Sugestao) => (b.em?.getTime() ?? 0) - (a.em?.getTime() ?? 0);
// grupo + acervo numa lista só
const paraDecidir = computed(() => [...pdGrupo.value, ...paraDecidirA.value].sort(porData));
const minhas = computed(() => [...mGrupo.value, ...minhasA.value].sort(porData));
// grupos que não estão em uso, com sugestão esperando por mim
const outros = computed(() => cloud.grupos.filter((g) => (pendentesOutros[g.id] ?? 0) > 0));
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
      <div v-for="g in (aba === 'decidir' ? outros : [])" :key="g.id" class="banner outro-grupo">
        <span>{{ pendentesOutros[g.id] }} sugestão(ões) esperando você em <b>{{ nomeDoGrupo(g) }}</b></span>
        <button class="btn text" @click="escolherGrupo(g)">Abrir esse grupo</button>
      </div>
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
.outro-grupo { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.wrap { max-width: 960px; margin: 0 auto; padding: 0 12px 40px; }
.row .ms { margin: 0 4px; }
</style>
