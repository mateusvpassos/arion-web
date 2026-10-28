<script setup lang="ts">
import { ref, computed } from 'vue';
import AppBar from '../components/AppBar.vue';
import DiffView from '../components/DiffView.vue';
import Prompt from '../components/Prompt.vue';
import { voltar } from '../nav';
import { cloud, eu, podeEditarSong, aceitar, recusar, cancelar } from '../cloud';
import { acervo, podeEditarA, aceitarA, recusarA, cancelarA } from '../acervo';
import { fmtQuando } from '../core';
import { statusTexto, statusIcone } from '../sugestoes';

const props = defineProps<{ id: string }>();
const x = computed(() => [...cloud.sugestoes, ...acervo.sugestoes].find((s) => s.id === props.id));
const atual = computed(() => (x.value?.acervo ? acervo.musicas[x.value.songId] : cloud.songs.find((s) => s.id === x.value?.songId)));
const podeDecidir = computed(() =>
  !!x.value && x.value.status === 'pendente' && x.value.por !== eu.value && !!atual.value &&
  (x.value.acervo ? podeEditarA(atual.value) : podeEditarSong(atual.value)));
const minhaPendente = computed(() => !!x.value && x.value.status === 'pendente' && x.value.por === eu.value);
const motivo = ref(false);
</script>

<template>
  <div v-if="!x" class="empty">Sugestão não encontrada</div>
  <div v-else>
    <AppBar :titulo="x.titulo" />
    <div class="wrap">
      <p class="quem">
        <span aria-hidden="true" class="ms fill" :style="{ color: statusIcone(x.status).cor }">{{ statusIcone(x.status).ic }}</span>
        {{ x.porNome || x.por }} sugeriu em {{ fmtQuando(x.em) }}{{ x.status !== 'pendente' ? ' — ' + statusTexto(x) : '' }}
      </p>
      <p v-if="x.nota"><i>“{{ x.nota }}”</i></p>
      <div v-if="atual && x.status === 'pendente' && atual.versao > x.base" class="banner">
        A música mudou depois desta sugestão (versão {{ x.base }} → {{ atual.versao }}). Aceitar troca pela
        versão sugerida inteira — confira as diferenças abaixo.
      </div>
      <h3 class="section-title">O que muda</h3>
      <p v-if="!atual" class="muted">A música não existe mais.</p>
      <DiffView v-else :antes="atual" :depois="x.song" />

      <div v-if="podeDecidir || minhaPendente" class="acoes">
        <template v-if="podeDecidir">
          <button class="btn outlined" @click="motivo = true"><span aria-hidden="true" class="ms">close</span>Recusar</button>
          <button class="btn" @click="(x!.acervo ? aceitarA : aceitar)(x!); voltar()"><span aria-hidden="true" class="ms">check</span>Aceitar</button>
        </template>
        <button v-else class="btn outlined" @click="(x!.acervo ? cancelarA : cancelar)(x!); voltar()">
          <span aria-hidden="true" class="ms">undo</span>Desistir da sugestão
        </button>
      </div>
    </div>
    <Prompt v-if="motivo" titulo="Recusar sugestão" dica="Motivo (opcional)" ok="Recusar"
      @fechar="motivo = false" @ok="(m) => { (x!.acervo ? recusarA : recusar)(x!, m); voltar(); }" />
  </div>
</template>

<style scoped>
.wrap { max-width: 960px; margin: 0 auto; padding: 0 16px 40px; }
.quem { display: flex; align-items: center; gap: 8px; }
.acoes { display: flex; gap: 12px; margin-top: 20px; }
.acoes .btn { flex: 1; padding: 14px; }
</style>
