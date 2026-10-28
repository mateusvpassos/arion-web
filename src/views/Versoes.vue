<script setup lang="ts">
// Histórico da música: cada gravação, quem fez e o que mudou; voltar a uma versão.
import { ref, computed, onMounted } from 'vue';
import AppBar from '../components/AppBar.vue';
import ChordChart from '../components/ChordChart.vue';
import DiffView from '../components/DiffView.vue';
import Prompt from '../components/Prompt.vue';
import { versoes, restaurar, sugerir, podeEditarSong, nomeDe as nomeGrupo, type Versao } from '../cloud';
import { acervo, revisoesA, restaurarA, sugerirA, podeEditarA, nomeDe as nomeAcervo, rotulo } from '../acervo';
import * as be from '../backend';
import { fmtQuando } from '../core';

const props = defineProps<{ id: string; acervo?: boolean }>();
const song = computed(() => (props.acervo ? acervo.musicas[props.id] : be.songById(props.id)));
const nomeDe = (e: string) => (props.acervo ? nomeAcervo(e) : nomeGrupo(e));
const lista = ref<Versao[] | null>(null);
const erro = ref('');
const sel = ref<Versao | null>(null);
const modo = ref<'diff' | 'cifra'>('diff');
const confirma = ref(false);

async function carregar() {
  try { lista.value = await (props.acervo ? revisoesA(props.id) : versoes(props.id)); } catch (e) { erro.value = String(e); }
}
onMounted(carregar);

const pode = computed(() => !!song.value && (props.acervo ? podeEditarA(song.value) : podeEditarSong(song.value)));
function confirmar() {
  confirma.value = false;
  const s = song.value!, v = sel.value!;
  if (pode.value) (props.acervo ? restaurarA : restaurar)(s, v);
  else (props.acervo ? sugerirA : sugerir)({ ...v.song, id: s.id }, `Voltar para a revisão ${v.n}`);
  sel.value = null;
  setTimeout(carregar, 600);
}
</script>

<template>
  <div>
    <AppBar :titulo="sel ? `Revisão ${sel.n}` : `Histórico — ${song?.title ?? ''}`"
      :sub="props.acervo && song ? `Acervo — ${rotulo(song)}` : ''">
      <button v-if="sel" class="btn text" @click="sel = null">Lista</button>
      <button v-else class="icon-btn" title="Atualizar" aria-label="Atualizar" @click="carregar"><span aria-hidden="true" class="ms">refresh</span></button>
    </AppBar>
    <div class="wrap">
      <p v-if="erro" class="error">{{ erro }}</p>

      <template v-if="!sel">
        <p v-if="song" class="muted">
          Dono: {{ nomeDe(song.dono) }}{{ song.editores.length ? '  •  podem editar: ' + song.editores.map(nomeDe).join(', ') : '' }}
        </p>
        <p v-if="!lista" class="faint">Carregando…</p>
        <p v-else-if="!lista.length" class="faint">Sem revisões guardadas ainda.</p>
        <ul class="list">
          <li v-for="v in lista ?? []" :key="v.id" class="row" @click="sel = v; modo = 'diff'">
            <span class="n" :class="{ atual: v.n === song?.versao }">{{ v.n }}</span>
            <div class="grow">
              <div class="title small">{{ v.porNome || v.por }} {{ v.acao }}</div>
              <div class="sub">{{ fmtQuando(v.em) }}{{ v.n === song?.versao ? '  •  revisão atual' : '' }}</div>
              <div v-for="r in v.resumo" :key="r" class="resumo">{{ r }}</div>
            </div>
          </li>
        </ul>
      </template>

      <template v-else>
        <p class="muted">{{ sel.porNome || sel.por }} {{ sel.acao }} — {{ fmtQuando(sel.em) }}</p>
        <div class="seg">
          <button :class="{ on: modo === 'diff' }" @click="modo = 'diff'">Diferença p/ atual</button>
          <button :class="{ on: modo === 'cifra' }" @click="modo = 'cifra'">Cifra desta revisão</button>
        </div>
        <template v-if="modo === 'diff'">
          <p v-if="!song" class="muted">A música não existe mais.</p>
          <p v-else-if="song.versao === sel.n" class="muted">Esta é a revisão atual.</p>
          <DiffView v-else :antes="song" :depois="sel.song" />
        </template>
        <div v-else class="card"><ChordChart :song="sel.song" :fonte="0.9" /></div>
        <button v-if="song && song.versao !== sel.n" class="btn grande" @click="confirma = true">
          <span aria-hidden="true" class="ms">{{ pode ? 'restore' : 'outgoing_mail' }}</span>
          {{ pode ? 'Voltar para esta revisão' : 'Sugerir voltar para esta revisão' }}
        </button>
      </template>
    </div>
    <Prompt v-if="confirma && sel" :titulo="pode ? `Voltar para a revisão ${sel.n}?` : `Sugerir a revisão ${sel.n}?`"
      :texto="pode ? 'A música fica igual a esta revisão. A atual continua no histórico — dá para voltar de novo.'
        : `O dono (${nomeDe(song!.dono)}) decide se aceita.`"
      sem-campo ok="Confirmar" @fechar="confirma = false" @ok="confirmar" />
  </div>
</template>

<style scoped>
.wrap { max-width: 960px; margin: 0 auto; padding: 0 16px 40px; }
.n {
  width: 40px; height: 40px; border-radius: 50%; background: var(--chip); display: grid; place-items: center;
  font-weight: 600; flex: none;
}
.n.atual { background: var(--primary); color: var(--on-primary); }
.title.small { font-size: 16px; }
.resumo { font-size: 13px; color: var(--muted); }
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 20px; overflow: hidden; margin-bottom: 14px; }
.seg button { background: none; border: 0; padding: 8px 16px; }
.seg button.on { background: var(--chip); color: var(--primary); }
.grande { width: 100%; margin-top: 20px; padding: 14px; }
</style>
