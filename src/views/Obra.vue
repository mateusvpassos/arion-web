<script setup lang="ts">
// Uma música do acervo e suas versões (arranjos): ver, puxar p/ a biblioteca,
// editar/sugerir, nova versão, histórico e permissões.
import { ref, computed } from 'vue';
import AppBar from '../components/AppBar.vue';
import ChordChart from '../components/ChordChart.vue';
import Permissoes from '../components/Permissoes.vue';
import Prompt from '../components/Prompt.vue';
import { abrir, prefs } from '../nav';
import { obras, rotulo, nomeDe, podeEditarA, puxar, novaVersao, setEditoresA } from '../acervo';
import { ativa, cloud } from '../cloud';
import * as be from '../backend';

const props = defineProps<{ obra: string; versaoId?: string }>();
const sel = ref(props.versaoId ?? '');
const vs = computed(() => obras.value[props.obra] ?? []);
const v = computed(() => vs.value.find((x) => x.id === sel.value) ?? vs.value[0]);
const copia = computed(() => (v.value ? be.songs.value.find((s) => s.baseId === v.value!.id) : undefined));
const perm = ref(false);
const nova = ref(false);
const aviso = ref('');

function criar(nome: string) {
  nova.value = false;
  if (!nome || !v.value) return;
  const n = novaVersao(v.value, nome);
  sel.value = n.id;
  abrir({ nome: 'editar', id: n.id, acervo: true });
}
function puxarAqui() {
  const c = puxar(v.value!);
  aviso.value = `“${c.title}” (${rotulo(v.value!)}) está na biblioteca`;
}
</script>

<template>
  <div v-if="!v" class="empty">Música não encontrada</div>
  <div v-else>
    <AppBar :titulo="v.title" :sub="`${rotulo(v)}  •  ${v.key}  •  de ${nomeDe(v.dono)}  •  revisão ${v.versao}`">
      <button class="icon-btn" title="Histórico de revisões" aria-label="Histórico de revisões" @click="abrir({ nome: 'versoes', id: v.id, acervo: true })">
        <span aria-hidden="true" class="ms">history</span>
      </button>
      <button class="icon-btn" title="Dono e quem pode editar" aria-label="Dono e quem pode editar" @click="perm = true">
        <span aria-hidden="true" class="ms">manage_accounts</span>
      </button>
      <button class="icon-btn" :title="podeEditarA(v) ? 'Editar esta versão' : 'Sugerir mudança'" :aria-label="podeEditarA(v) ? 'Editar esta versão' : 'Sugerir mudança'"
        @click="abrir({ nome: 'editar', id: v.id, acervo: true })">
        <span aria-hidden="true" class="ms">{{ podeEditarA(v) ? 'edit' : 'rate_review' }}</span>
      </button>
    </AppBar>
    <div class="wrap">
      <div class="chips">
        <button v-for="x in vs" :key="x.id" class="chip" :class="{ on: x.id === v.id }" @click="sel = x.id">
          <span v-if="x.id === v.id" class="ms">check</span>{{ rotulo(x) }} · {{ nomeDe(x.dono) }}
        </button>
        <button class="chip" @click="nova = true"><span aria-hidden="true" class="ms">add</span>Nova versão</button>
      </div>
      <p v-if="v.notes"><i>{{ v.notes }}</i></p>
      <ChordChart :song="v" :fonte="prefs.fonte" :letra="prefs.soLetra" />
    </div>
    <footer class="rodape no-print">
      <p v-if="aviso" class="ok">{{ aviso }}</p>
      <button v-if="copia" class="btn outlined" @click="abrir({ nome: 'musica', id: copia.id })">
        <span aria-hidden="true" class="ms">library_music</span>{{ ativa ? 'Abrir a cópia do grupo' : 'Abrir na biblioteca' }}
      </button>
      <button v-else-if="be.pronto.value" class="btn" @click="puxarAqui">
        <span aria-hidden="true" class="ms">library_add</span>
        {{ ativa ? `Puxar esta versão para o grupo ${cloud.grupo!.nome}` : 'Puxar esta versão para a biblioteca' }}
      </button>
    </footer>
    <Permissoes v-if="perm" acervo :titulo="`${v.title} — ${rotulo(v)}`" :dono="v.dono" :editores="v.editores"
      @fechar="perm = false" @salvar="(l) => setEditoresA(v!, l)" />
    <Prompt v-if="nova" titulo="Nova versão" dica="Nome (ex.: Simplificada, Versão rcc, Tom de Mi)" ok="Criar"
      @fechar="nova = false" @ok="criar" />
  </div>
</template>

<style scoped>
.wrap { max-width: 1100px; margin: 0 auto; padding: 0 16px 120px; }
.chips { margin: 4px 0 14px; }
.rodape {
  position: fixed; left: 0; right: 0; bottom: 0; padding: 12px; background: var(--surface-1);
  border-top: 1px solid var(--line); display: flex; flex-direction: column; align-items: center; gap: 6px;
}
.rodape .btn { width: min(600px, 100%); }
.ok { margin: 0; color: var(--ok); }
</style>
