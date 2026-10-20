<script setup lang="ts">
// Um grupo: em uso ou não, pessoas, músicas, repertórios e quem edita direto.
// Quem é dono do grupo configura; os outros veem.
import { ref, computed, watch, onUnmounted } from 'vue';
import type { Unsubscribe } from 'firebase/firestore';
import AppBar from '../components/AppBar.vue';
import Prompt from '../components/Prompt.vue';
import {
  cloud, eu, nomeDe, escolherGrupo, convidar, remover, setConfianca, renomearGrupo, apagarGrupo,
  tirarDoGrupo, ouvirMusicasDe, ouvirRepertoriosDe, ouvirConfiancaEm, nomeDoGrupo,
} from '../cloud';
import { abrir, voltar, nav } from '../nav';
import type { Song, Setlist } from '../types';

const props = defineProps<{ id: string }>();
const g = computed(() => cloud.grupos.find((x) => x.id === props.id) ?? null);
const dono = computed(() => g.value?.dono === eu.value);
const emUso = computed(() => cloud.grupo?.id === props.id);

const musicas = ref<Song[] | null>(null);
const repertorios = ref<Setlist[] | null>(null);
const confianca = ref<string[]>([]);
let subs: Unsubscribe[] = [];
watch(() => g.value?.id, (id) => {
  subs.forEach((u) => u());
  subs = [];
  if (!id || !g.value) return;
  subs.push(ouvirMusicasDe(g.value, (l) => { musicas.value = l; }));
  subs.push(ouvirRepertoriosDe(g.value, (l) => { repertorios.value = l; }));
  subs.push(ouvirConfiancaEm(g.value, (l) => { confianca.value = l; }));
}, { immediate: true });
onUnmounted(() => subs.forEach((u) => u()));

const outros = computed(() => (g.value?.membros ?? []).filter((m) => m !== eu.value));
const convite = ref('');
const renomeando = ref(false);
const apagando = ref(false);
const tirarPessoa = ref<string | null>(null);
const tirarMusica = ref<Song | null>(null);

function convida() {
  const e = convite.value.trim().toLowerCase();
  if (e && g.value) convidar(e, g.value);
  convite.value = '';
}
function alternaConfianca(m: string) {
  if (!g.value) return;
  const l = confianca.value;
  setConfianca(l.includes(m) ? l.filter((x) => x !== m) : [...l, m], g.value);
}
function usar() {
  if (!g.value) return;
  escolherGrupo(g.value);
  // volta p/ a tela inicial
  history.go(-(nav.pilha.length - 1));
}
function apagar() {
  apagando.value = false;
  if (g.value) apagarGrupo(g.value);
  voltar();
}
const sub = (s: Song) => [
  s.key, s.artist, s.dono ? (s.dono === eu.value ? 'sua' : `de ${nomeDe(s.dono)}`) : '',
].filter(Boolean).join(' · ');
</script>

<template>
  <div>
    <AppBar :titulo="g ? nomeDoGrupo(g) : 'Grupo'">
      <button v-if="g && dono" class="icon-btn" title="Renomear" @click="renomeando = true">
        <span class="ms">edit</span></button>
    </AppBar>
    <div class="wrap">
      <p v-if="!g" class="muted">Grupo não encontrado (foi apagado ou você saiu).</p>

      <template v-else>
        <!-- em uso -->
        <div class="card">
          <h3 class="section-title"><span class="ms">{{ emUso ? 'check_circle' : 'radio_button_unchecked' }}</span>
            {{ emUso ? 'Em uso no app' : 'Não está em uso' }}</h3>
          <p v-if="emUso">As músicas e os repertórios da tela inicial são deste grupo.</p>
          <template v-else>
            <p>Abra p/ ver as músicas e os repertórios deste grupo na tela inicial e tocar com eles.</p>
            <button class="btn" @click="usar"><span class="ms">open_in_new</span>Usar este grupo</button>
          </template>
        </div>

        <!-- pessoas -->
        <div class="card">
          <h3 class="section-title"><span class="ms">group</span>Pessoas ({{ g.membros.length }})</h3>
          <ul class="lista">
            <li v-for="m in g.membros" :key="m">
              <span class="av">{{ (nomeDe(m)[0] ?? '?').toUpperCase() }}</span>
              <div class="grow"><div>{{ nomeDe(m) }}{{ m === eu ? ' (você)' : '' }}</div>
                <div class="faint small">{{ m }}{{ m === g.dono ? ' · dono do grupo' : '' }}</div></div>
              <button v-if="dono && m !== g.dono" class="icon-btn" title="Tirar do grupo" @click="tirarPessoa = m">
                <span class="ms">person_remove</span></button>
            </li>
          </ul>
          <template v-if="dono">
            <form class="linha" @submit.prevent="convida">
              <input v-model="convite" type="email" placeholder="E-mail Google da pessoa" class="grow" />
              <button class="btn" :disabled="!convite.trim()"><span class="ms">person_add</span>Adicionar</button>
            </form>
            <p class="faint small">A pessoa entra no app com esse e-mail e o grupo aparece na lista dela.</p>
          </template>
        </div>

        <!-- músicas -->
        <div class="card">
          <div class="topo">
            <h3 class="section-title"><span class="ms">library_music</span>
              Músicas{{ musicas ? ` (${musicas.length})` : '' }}</h3>
            <button class="btn text" @click="abrir({ nome: 'grupoAdicionar', id: g.id })">
              <span class="ms">add</span>Adicionar</button>
          </div>
          <p v-if="!musicas" class="faint">Carregando…</p>
          <p v-else-if="!musicas.length" class="faint">Nenhuma música ainda. Clique em Adicionar p/ trazer do acervo.</p>
          <ul v-else class="lista">
            <li v-for="s in musicas" :key="s.id">
              <div class="grow"><div>{{ s.title }}</div><div class="faint small">{{ sub(s) }}</div></div>
              <button v-if="s.dono === eu" class="icon-btn" title="Tirar do grupo" @click="tirarMusica = s">
                <span class="ms">remove_circle_outline</span></button>
            </li>
          </ul>
        </div>

        <!-- repertórios -->
        <div class="card">
          <h3 class="section-title"><span class="ms">queue_music</span>
            Repertórios{{ repertorios ? ` (${repertorios.length})` : '' }}</h3>
          <p v-if="!repertorios" class="faint">Carregando…</p>
          <p v-else-if="!repertorios.length" class="faint">Nenhum repertório ainda.</p>
          <ul v-else class="lista">
            <li v-for="sl in repertorios" :key="sl.id">
              <div class="grow"><div>{{ sl.name }}</div><div class="faint small">{{ sl.songIds.length }} música(s)</div></div>
            </li>
          </ul>
          <p class="faint small">
            {{ emUso ? 'Crie e edite os repertórios na aba Repertórios da tela inicial.'
              : 'P/ criar e editar repertórios, use este grupo (botão lá em cima).' }}
          </p>
        </div>

        <!-- quem edita direto -->
        <div v-if="outros.length" class="card">
          <h3 class="section-title"><span class="ms">edit_note</span>Quem mexe nas suas músicas</h3>
          <p>
            Normalmente os outros só sugerem mudanças nas suas músicas e você aceita ou não. Marque quem pode
            mudar direto, sem pedir:
          </p>
          <div class="chips">
            <button v-for="m in outros" :key="m" class="chip" :class="{ on: confianca.includes(m) }"
              @click="alternaConfianca(m)">
              <span class="ms">{{ confianca.includes(m) ? 'check' : 'add' }}</span>{{ nomeDe(m) }}
            </button>
          </div>
        </div>

        <button v-if="dono && !g.pessoal" class="btn text perigo" @click="apagando = true">
          <span class="ms">delete</span>Apagar grupo</button>
      </template>
      <p v-if="cloud.erro" class="error">{{ cloud.erro }}</p>
    </div>

    <Prompt v-if="renomeando && g" titulo="Nome do grupo" :valor="nomeDoGrupo(g)" ok="Salvar"
      @fechar="renomeando = false" @ok="(n) => { renomeando = false; if (n && g) renomearGrupo(g, n); }" />
    <Prompt v-if="apagando && g" :titulo="`Apagar “${g.nome}”?`" sem-campo ok="Apagar"
      texto="Ninguém mais vê este grupo nem os repertórios dele. As músicas continuam no acervo."
      @fechar="apagando = false" @ok="apagar" />
    <Prompt v-if="tirarPessoa && g" :titulo="`Tirar ${nomeDe(tirarPessoa)} do grupo?`" sem-campo ok="Tirar"
      texto="A pessoa deixa de ver as músicas e os repertórios do grupo."
      @fechar="tirarPessoa = null" @ok="remover(tirarPessoa!, g); tirarPessoa = null" />
    <Prompt v-if="tirarMusica && g" :titulo="`Tirar “${tirarMusica.title}” do grupo?`" sem-campo ok="Tirar"
      texto="Sai do grupo e dos repertórios dele. No acervo continua."
      @fechar="tirarMusica = null" @ok="tirarDoGrupo(g, tirarMusica!); tirarMusica = null" />
  </div>
</template>

<style scoped>
.wrap { max-width: 760px; margin: 0 auto; padding: 0 16px 40px; display: flex; flex-direction: column; gap: 12px; }
.card p { margin: 6px 0 12px; line-height: 1.45; }
.small { font-size: 12px; }
.topo { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.lista { list-style: none; margin: 0 0 8px; padding: 0; }
.lista li { display: flex; align-items: center; gap: 12px; padding: 7px 0; }
.av {
  width: 34px; height: 34px; border-radius: 50%; background: var(--primary-container); color: #fff;
  display: grid; place-items: center; font-weight: 600; flex: none;
}
.grow { flex: 1; min-width: 0; }
.linha { display: flex; gap: 8px; flex-wrap: wrap; }
.perigo { align-self: flex-start; color: var(--error, #e5484d); }
</style>
