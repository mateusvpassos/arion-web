<script setup lang="ts">
// Biblioteca: músicas e repertórios, como a tela inicial do app.
import { ref, computed, watch } from 'vue';
import AppBar from '../components/AppBar.vue';
import Prompt from '../components/Prompt.vue';
import { abrir, prefs } from '../nav';
import * as be from '../backend';
import { cloud, ativa, eu, nomeDe, paraDecidir, disponivel, entrar, nomeDoGrupo, conferirLiberacao } from '../cloud';
import {
  acervo, paraDecidirA, obras, obraDe, rotulo, nomeDe as nomeA, copiaDaObra, puxar, religar, podeEditarA,
} from '../acervo';
import { searchSongs, fold, fmtData } from '../core';
import { usoMusicas, quando } from '../liturgia';
import type { Song, Setlist } from '../types';
import { emulador } from '../firebase';
import { live } from '../live';
// música nova só entra na lista ao salvar (o editor pega daqui)
import { rascunho } from '../rascunho';

const busca = ref('');
const menu = ref<string | null>(null);
const novoRep = ref(false);
const dataNovo = ref(isoDia(new Date()));
const apagar = ref<{ id: string; nome: string } | null>(null);
const aviso = ref('');
const avisar = (t: string) => { aviso.value = t; setTimeout(() => (aviso.value = ''), 3000); };

function isoDia(d: Date) {
  const two = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

const uso = computed(() => usoMusicas(be.setlists.value));

// ---- aba Músicas = acervo geral (uma linha por obra; a versão principal) ----
// se a leitura tinha sido negada, tenta de novo quando o login chega
watch(() => cloud.user, (u) => { if (u && (acervo.erro || !acervo.carregou)) religar(); }, { immediate: true });
const principais = computed(() => Object.values(obras.value).map((l) => l[0]));
const hits = computed(() => {
  const l = searchSongs(principais.value, busca.value);
  if (!busca.value.trim()) l.sort((a, b) => fold(a.song.title).localeCompare(fold(b.song.title)));
  return l;
});
/** Toca a MINHA cópia (tom, anotações, repertórios); sem cópia, a do acervo. */
function tocar(v: Song) {
  const c = copiaDaObra(obraDe(v));
  abrir({ nome: 'musica', id: c?.id ?? v.id });
}
function adicionar(v: Song) {
  const c = puxar(v);
  avisar(`“${c.title}” está nas suas músicas`);
}
const reps = computed(() => {
  const q = fold(busca.value.trim());
  return be.setlists.value
    .filter((s) => !q || fold(s.name).includes(q))
    .sort((a, b) => {
      if (a.date && b.date) return b.date.localeCompare(a.date);
      if (a.date) return -1;
      if (b.date) return 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
});

function meta(v: Song): string {
  const c = copiaDaObra(obraDe(v));
  const u = c ? uso.value[c.id] : undefined;
  const n = obras.value[obraDe(v)]?.length ?? 1;
  return [
    v.artist,
    v.dono && v.dono !== eu.value ? `de ${nomeA(v.dono)}` : '',
    n > 1 ? `${n} versões` : '',
    u ? `tocada ${quando(u.ultima)} (${u.vezes}x)` : '',
  ].filter(Boolean).join('  •  ');
}

function novaMusica() {
  const d = be.rascunhoSong();
  abrir({ nome: 'editar', id: d.id, nova: true });
  rascunho.value = d;
}

function criarRep(nome: string) {
  novoRep.value = false;
  if (!nome) return;
  const sl = be.novoSetlist(nome, dataNovo.value ? `${dataNovo.value}T00:00:00.000` : null);
  abrir({ nome: 'repertorio', id: sl.id });
}

function confirmaApagar() {
  be.excluirSetlist(apagar.value!.id);
  apagar.value = null;
}

const fecharMenu = () => (menu.value = null);
</script>

<template>
  <div @click="fecharMenu">
    <AppBar titulo="Arion" sem-voltar>
      <template #logo><img src="/icon.png" class="logo" alt="" /></template>
      <!-- grupo em uso; clicar abre a lista de grupos -->
      <template v-if="cloud.grupo" #sub>
        <button class="grupo-em-uso" @click="abrir({ nome: 'grupo' })">{{ nomeDoGrupo(cloud.grupo) }} ▾</button>
      </template>
      <button v-if="ativa" class="icon-btn" title="Minhas músicas" @click="abrir({ nome: 'minhas' })">
        <span class="ms">library_music</span>
      </button>
      <button v-if="cloud.user" class="icon-btn" title="Sugestões" @click="abrir({ nome: 'sugestoes' })">
        <span class="ms">inbox</span>
        <span v-if="paraDecidir.length + paraDecidirA.length" class="dot">{{ paraDecidir.length + paraDecidirA.length }}</span>
      </button>
      <button v-if="ativa" class="icon-btn" title="Atividade recente" @click="abrir({ nome: 'atividade' })">
        <span class="ms">history</span>
      </button>
      <button v-if="disponivel" class="icon-btn" title="Grupos" @click="abrir({ nome: 'grupo' })">
        <span class="ms">{{ ativa ? 'group' : 'cloud_off' }}</span>
      </button>
      <button class="icon-btn" :class="{ on: live.ativo }" title="Ao vivo" @click="abrir({ nome: 'aovivo' })">
        <span class="ms">cell_tower</span>
      </button>
      <button class="icon-btn" title="Configurações" @click="abrir({ nome: 'config' })">
        <span class="ms">settings</span>
      </button>
    </AppBar>

    <p v-if="cloud.erro" class="error wrap">⚠ {{ cloud.erro }}</p>

    <div v-if="!be.pronto.value" class="wrap"><div class="entrar card">
      <template v-if="!cloud.user">
        <h2 class="section-title"><span class="ms">login</span>Entrar</h2>
        <p>Entre com a sua conta Google para ver as suas músicas.</p>
        <div class="acoes-entrar">
          <button class="btn" @click="disponivel && (emulador ? abrir({ nome: 'grupo' }) : entrar())">
            <span class="ms">account_circle</span>Entrar com Google
          </button>
        </div>
      </template>
      <template v-else-if="cloud.liberado === false">
        <h2 class="section-title"><span class="ms">lock_clock</span>Acesso ainda não liberado</h2>
        <p>Peça p/ alguém que já usa o Arion te adicionar num grupo (pelo e-mail {{ cloud.user.email }}).
          Ao ser adicionado, o seu acesso é liberado.</p>
        <div class="acoes-entrar">
          <button class="btn" @click="conferirLiberacao()"><span class="ms">refresh</span>Já me adicionaram</button>
        </div>
      </template>
      <p v-else class="muted">Carregando a sua biblioteca…</p>
    </div></div>

    <template v-else>
      <nav class="tabs no-print">
        <button :class="{ on: prefs.aba === 'songs' }" @click="prefs.aba = 'songs'">Músicas</button>
        <button :class="{ on: prefs.aba === 'setlists' }" @click="prefs.aba = 'setlists'">Repertórios</button>
      </nav>
      <div class="wrap">
        <div class="busca">
          <span class="ms">search</span>
          <input v-model="busca" :placeholder="prefs.aba === 'songs' ? 'Buscar no acervo (nome, artista ou trecho da letra)...' : 'Buscar repertório...'" />
        </div>

        <template v-if="prefs.aba === 'songs'">
          <p v-if="acervo.erro" class="error">{{ acervo.erro }}
            <button class="btn text" @click="religar">Tentar de novo</button></p>
          <p v-if="aviso" class="ok">{{ aviso }}</p>
          <ul class="list">
            <li v-for="h in hits" :key="h.song.id" class="row" @click="tocar(h.song)">
              <div class="key-badge">{{ h.song.key }}</div>
              <div class="grow">
                <div class="title">{{ h.song.title }}</div>
                <div v-if="h.snippet" class="sub trecho">“{{ h.snippet }}”</div>
                <div v-if="meta(h.song)" class="sub">{{ meta(h.song) }}</div>
                <div v-if="h.song.tags.length" class="tags">
                  <span v-for="t in h.song.tags.slice(0, 4)" :key="t" class="tag">{{ t }}</span>
                </div>
              </div>
              <span v-if="copiaDaObra(obraDe(h.song))" class="ms tem" title="Está nas suas músicas">library_add_check</span>
              <div class="menu-wrap" @click.stop>
                <button class="icon-btn" @click="menu = menu === h.song.id ? null : h.song.id">
                  <span class="ms">more_vert</span>
                </button>
                <div v-if="menu === h.song.id" class="menu">
                  <button v-if="!copiaDaObra(obraDe(h.song))" @click="adicionar(h.song); fecharMenu()">
                    <span class="ms">library_add</span>Adicionar às minhas músicas</button>
                  <button @click="abrir({ nome: 'obra', obra: obraDe(h.song) }); fecharMenu()">
                    <span class="ms">layers</span>{{ (obras[obraDe(h.song)]?.length ?? 1) > 1 ? 'Ver versões' : 'Versões e detalhes' }}</button>
                  <button @click="abrir({ nome: 'editar', id: h.song.id, acervo: true }); fecharMenu()">
                    <span class="ms">{{ podeEditarA(h.song) ? 'edit' : 'rate_review' }}</span>
                    {{ podeEditarA(h.song) ? `Editar (${rotulo(h.song)})` : 'Sugerir mudança' }}</button>
                </div>
              </div>
            </li>
            <li v-if="!acervo.carregou" class="empty">Carregando…</li>
            <li v-else-if="!hits.length" class="empty">{{ busca ? 'Nada encontrado' : 'Nenhuma música no acervo' }}</li>
          </ul>
        </template>

        <ul v-else class="list">
          <li v-for="sl in reps" :key="sl.id" class="row" @click="abrir({ nome: 'repertorio', id: sl.id })">
            <span class="ms rep-ic">queue_music</span>
            <div class="grow">
              <div class="title">{{ sl.name }}</div>
              <div class="sub">
                {{ [sl.date ? fmtData(sl.date) : '', `${sl.songIds.length} músicas`,
                    ativa && sl.dono && sl.dono !== eu ? `de ${nomeDe(sl.dono)}` : ''].filter(Boolean).join('  •  ') }}
              </div>
            </div>
            <div class="menu-wrap" @click.stop>
              <button class="icon-btn" @click="menu = menu === sl.id ? null : sl.id">
                <span class="ms">more_vert</span>
              </button>
              <div v-if="menu === sl.id" class="menu">
                <button @click="be.duplicarSetlist(sl as Setlist); fecharMenu()">Duplicar</button>
                <button v-if="be.souDono(sl.dono)"
                  @click="apagar = { id: sl.id, nome: sl.name }; fecharMenu()">Excluir</button>
              </div>
            </div>
          </li>
          <li v-if="!reps.length" class="empty">Nenhum repertório</li>
        </ul>
      </div>

      <button class="fab no-print" @click="prefs.aba === 'songs' ? novaMusica() : (novoRep = true)">
        <span class="ms">add</span>{{ prefs.aba === 'songs' ? 'Música' : 'Repertório' }}
      </button>
    </template>

    <Prompt v-if="novoRep" titulo="Novo repertório" dica="Nome" ok="Criar"
      @fechar="novoRep = false" @ok="criarRep">
      <label class="data">
        <span class="ms">event</span>
        <input v-model="dataNovo" type="date" />
        <span class="muted">Data do evento</span>
      </label>
    </Prompt>
    <Prompt v-if="apagar" titulo="Excluir?" :texto="`O repertório “${apagar.nome}” vai sair para todos.`" sem-campo ok="Excluir"
      @fechar="apagar = null" @ok="confirmaApagar" />
  </div>
</template>

<style scoped>
.grupo-em-uso { all: unset; cursor: pointer; font: inherit; color: inherit; }
.grupo-em-uso:hover { color: var(--fg); }
.logo { width: 28px; height: 28px; margin: 0 2px 0 2px; }
.wrap { max-width: 960px; margin: 0 auto; padding: 0 12px 110px; }
.trecho { color: var(--primary); font-style: italic; }
.tags { display: flex; gap: 4px; margin-top: 4px; }
.rep-ic { color: var(--muted); margin: 0 4px; }
.tem { color: var(--accent-text); font-size: 19px; opacity: .8; }
.ok { color: var(--ok); margin: 0 0 8px; }
.menu .ms { font-size: 20px; color: var(--muted); vertical-align: -5px; margin-right: 10px; }
.menu-wrap { position: relative; }
.menu {
  position: absolute; right: 0; top: 44px; z-index: 20; background: var(--card-hi);
  border-radius: 16px; padding: 6px 0; min-width: 190px; box-shadow: 0 8px 24px rgba(0,0,0,.35);
}
.menu button { display: block; width: 100%; text-align: left; background: none; border: 0; padding: 12px 18px; font-size: 15px; }
.menu button:hover { background: var(--chip); }
.drive {
  max-width: 960px; margin: 0 auto 8px; padding: 0 12px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
}
.drive .ms { font-size: 18px; vertical-align: -3px; }
.sujo { color: #ffb74d; font-size: 13px; }
.entrar { margin-top: 24px; }
.acoes-entrar { display: flex; gap: 8px; flex-wrap: wrap; }
.data { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
.data .ms { color: var(--primary); }
</style>
