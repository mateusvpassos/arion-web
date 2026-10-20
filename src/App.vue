<script setup lang="ts">
// Telas empilhadas como no app (src/nav.ts).
import { computed } from 'vue';
import { nav, abrir, trocar, atual } from './nav';
import { ouvir } from './live';
import * as be from './backend';
import { live } from './live';
import Config from './views/Config.vue';
import AoVivo from './views/AoVivo.vue';
import Inicio from './views/Inicio.vue';
import Musica from './views/Musica.vue';
import Editar from './views/Editar.vue';
import Repertorio from './views/Repertorio.vue';
import Sugestoes from './views/Sugestoes.vue';
import Sugestao from './views/Sugestao.vue';
import Versoes from './views/Versoes.vue';
import Grupo from './views/Grupo.vue';
import GrupoDetalhe from './views/GrupoDetalhe.vue';
import GrupoAdicionar from './views/GrupoAdicionar.vue';
import Atividade from './views/Atividade.vue';
import Imprimir from './views/Imprimir.vue';
import Minhas from './views/Minhas.vue';
import Obra from './views/Obra.vue';

const t = computed(() => nav.pilha[nav.pilha.length - 1]);
// chave: trocar de música/repertório recria a tela (estado limpo)
const chave = computed(() => JSON.stringify(t.value));

// ao vivo, seguindo: quem conduz abriu/trocou de música -> abre aqui também
// (no editor não atropela; abre quando voltar p/ a música)
ouvir({
  nav: (n) => {
    const a = atual();
    if (a.nome === 'editar') return;
    if (!be.songById(n.songId) && !live.songs[n.songId]) return;
    const setlistId = n.setlistId ?? undefined;
    if (a.nome === 'musica') {
      if (a.id !== n.songId || a.setlistId !== setlistId) {
        trocar({ nome: 'musica', id: n.songId, setlistId });
        window.scrollTo(0, 0);
      }
    } else abrir({ nome: 'musica', id: n.songId, setlistId });
  },
});
</script>

<template>
  <Inicio v-if="t.nome === 'inicio'" />
  <Musica v-else-if="t.nome === 'musica'" :key="chave" :id="t.id" :setlist-id="t.setlistId" />
  <Editar v-else-if="t.nome === 'editar'" :key="chave" :id="t.id" :nova="t.nova" :acervo="t.acervo" />
  <Minhas v-else-if="t.nome === 'minhas'" />
  <Obra v-else-if="t.nome === 'obra'" :key="chave" :obra="t.obra" :versao-id="t.versaoId" />
  <Repertorio v-else-if="t.nome === 'repertorio'" :key="chave" :id="t.id" />
  <Sugestoes v-else-if="t.nome === 'sugestoes'" />
  <Sugestao v-else-if="t.nome === 'sugestao'" :key="chave" :id="t.id" />
  <Versoes v-else-if="t.nome === 'versoes'" :key="chave" :id="t.id" :acervo="t.acervo" />
  <Grupo v-else-if="t.nome === 'grupo'" />
  <GrupoDetalhe v-else-if="t.nome === 'grupoDetalhe'" :key="chave" :id="t.id" />
  <GrupoAdicionar v-else-if="t.nome === 'grupoAdicionar'" :key="chave" :id="t.id" />
  <Atividade v-else-if="t.nome === 'atividade'" />
  <Config v-else-if="t.nome === 'config'" />
  <AoVivo v-else-if="t.nome === 'aovivo'" />
  <Imprimir v-else-if="t.nome === 'imprimir'" :key="chave" :setlist-id="t.setlistId" :song-id="t.songId" />
</template>
