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
// lista vazia já tem o botão de criar no meio da tela (o flutuante cobria o texto)
const vazia = computed(() => !busca.value && (prefs.aba === 'songs' ? acervo.carregou && !hits.value.length : !reps.value.length));
</script>

<template>
  <div @click="fecharMenu">
    <AppBar titulo="Arion" sem-voltar>
      <template #logo><img src="/icon.png" class="logo" alt="" /></template>
      <!-- grupo em uso; clicar abre a lista de grupos -->
      <template v-if="cloud.grupo" #sub>
        <button class="grupo-em-uso" @click="abrir({ nome: 'grupo' })">{{ nomeDoGrupo(cloud.grupo) }} ▾</button>
      </template>
      <button v-if="ativa" class="icon-btn" title="Minhas músicas" aria-label="Minhas músicas" @click="abrir({ nome: 'minhas' })">
        <span aria-hidden="true" class="ms">library_music</span>
      </button>
      <button v-if="cloud.user" class="icon-btn" title="Sugestões" aria-label="Sugestões" @click="abrir({ nome: 'sugestoes' })">
        <span aria-hidden="true" class="ms">inbox</span>
        <span v-if="paraDecidir.length + paraDecidirA.length" class="dot">{{ paraDecidir.length + paraDecidirA.length }}</span>
      </button>
      <button v-if="ativa" class="icon-btn largo" title="Atividade recente" aria-label="Atividade recente" @click="abrir({ nome: 'atividade' })">
        <span aria-hidden="true" class="ms">history</span>
      </button>
      <button v-if="disponivel" class="icon-btn largo" title="Grupos" aria-label="Grupos" @click="abrir({ nome: 'grupo' })">
        <span aria-hidden="true" class="ms">{{ ativa ? 'group' : 'cloud_off' }}</span>
      </button>
      <button class="icon-btn" :class="{ on: live.ativo }" title="Ao vivo" aria-label="Ao vivo" @click="abrir({ nome: 'aovivo' })">
        <span aria-hidden="true" class="ms">cell_tower</span>
      </button>
      <button class="icon-btn largo" title="Configurações" aria-label="Configurações" @click="abrir({ nome: 'config' })">
        <span aria-hidden="true" class="ms">settings</span>
      </button>
      <!-- celular: o que não cabe na barra vai p/ o menu (senão some o nome do grupo) -->
      <div class="menu-wrap estreito" @click.stop>
        <button class="icon-btn" title="Mais" aria-label="Mais" @click="menu = menu === 'barra' ? null : 'barra'">
          <span aria-hidden="true" class="ms">more_vert</span>
        </button>
        <div v-if="menu === 'barra'" class="menu">
          <button v-if="ativa" @click="abrir({ nome: 'atividade' }); fecharMenu()">
            <span aria-hidden="true" class="ms">history</span>Atividade recente</button>
          <button v-if="disponivel" @click="abrir({ nome: 'grupo' }); fecharMenu()">
            <span aria-hidden="true" class="ms">group</span>Grupos</button>
          <button @click="abrir({ nome: 'config' }); fecharMenu()">
            <span aria-hidden="true" class="ms">settings</span>Configurações</button>
        </div>
      </div>
    </AppBar>

    <p v-if="cloud.erro" class="error wrap">⚠ {{ cloud.erro }}</p>

    <div v-if="!be.pronto.value" class="wrap"><div class="entrar card">
      <template v-if="!cloud.user">
        <h2 class="section-title"><span aria-hidden="true" class="ms">login</span>Entrar</h2>
        <p>O Arion guarda cifras e monta repertórios para tocar ao vivo, sozinho ou com o seu grupo.
          Entre com a sua conta Google para ver as suas músicas.</p>
        <div class="acoes-entrar">
          <button class="btn" @click="disponivel && (emulador ? abrir({ nome: 'grupo' }) : entrar())">
            <span aria-hidden="true" class="ms">account_circle</span>Entrar com Google
          </button>
        </div>
        <p class="faint aceite">
          Ao entrar você aceita os <a href="termos.html" target="_blank">termos de uso</a> e a
          <a href="privacidade.html" target="_blank">política de privacidade</a>.
        </p>
      </template>
      <template v-else-if="cloud.liberado === false">
        <h2 class="section-title"><span aria-hidden="true" class="ms">lock_clock</span>Acesso ainda não liberado</h2>
        <p>Peça p/ alguém que já usa o Arion te adicionar num grupo (pelo e-mail {{ cloud.user.email }}).
          Ao ser adicionado, o seu acesso é liberado.</p>
        <div class="acoes-entrar">
          <button class="btn" @click="conferirLiberacao()"><span aria-hidden="true" class="ms">refresh</span>Já me adicionaram</button>
        </div>
      </template>
      <p v-else class="muted">Carregando a sua biblioteca…</p>
    </div></div>

    <template v-else>
      <nav class="tabs no-print">
        <button :class="{ on: prefs.aba === 'songs' }" @click="prefs.aba = 'songs'">Acervo</button>
        <button :class="{ on: prefs.aba === 'setlists' }" @click="prefs.aba = 'setlists'">Repertórios</button>
      </nav>
      <div class="wrap">
        <div class="busca">
          <span aria-hidden="true" class="ms">search</span>
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
                <button class="icon-btn" title="Mais opções" aria-label="Mais opções" @click="menu = menu === h.song.id ? null : h.song.id">
                  <span aria-hidden="true" class="ms">more_vert</span>
                </button>
                <div v-if="menu === h.song.id" class="menu">
                  <button v-if="!copiaDaObra(obraDe(h.song))" @click="adicionar(h.song); fecharMenu()">
                    <span aria-hidden="true" class="ms">library_add</span>Adicionar às minhas músicas</button>
                  <button @click="abrir({ nome: 'obra', obra: obraDe(h.song) }); fecharMenu()">
                    <span aria-hidden="true" class="ms">layers</span>{{ (obras[obraDe(h.song)]?.length ?? 1) > 1 ? 'Ver versões' : 'Versões e detalhes' }}</button>
                  <button @click="abrir({ nome: 'editar', id: h.song.id, acervo: true }); fecharMenu()">
                    <span aria-hidden="true" class="ms">{{ podeEditarA(h.song) ? 'edit' : 'rate_review' }}</span>
                    {{ podeEditarA(h.song) ? `Editar (${rotulo(h.song)})` : 'Sugerir mudança' }}</button>
                </div>
              </div>
            </li>
            <li v-if="!acervo.carregou" class="empty">Carregando…</li>
            <li v-else-if="busca && !hits.length" class="empty">Nada encontrado</li>
            <li v-else-if="!hits.length" class="vazio">
              <span aria-hidden="true" class="ms">library_music</span>
              <div class="title">O acervo ainda está vazio</div>
              <p class="faint">Cole uma cifra (do Cifra Club, por exemplo) ou digite a sua. Ela fica nas suas músicas
                e no acervo, para o seu grupo tocar junto.</p>
              <button class="btn" @click="novaMusica"><span aria-hidden="true" class="ms">add</span>Criar a primeira música</button>
            </li>
          </ul>
        </template>

        <ul v-else class="list">
          <li v-for="sl in reps" :key="sl.id" class="row" @click="abrir({ nome: 'repertorio', id: sl.id })">
            <span aria-hidden="true" class="ms rep-ic">queue_music</span>
            <div class="grow">
              <div class="title">{{ sl.name }}</div>
              <div class="sub">
                {{ [sl.date ? fmtData(sl.date) : '', `${sl.songIds.length} músicas`,
                    ativa && sl.dono && sl.dono !== eu ? `de ${nomeDe(sl.dono)}` : ''].filter(Boolean).join('  •  ') }}
              </div>
            </div>
            <div class="menu-wrap" @click.stop>
              <button class="icon-btn" title="Mais opções" aria-label="Mais opções" @click="menu = menu === sl.id ? null : sl.id">
                <span aria-hidden="true" class="ms">more_vert</span>
              </button>
              <div v-if="menu === sl.id" class="menu">
                <button @click="be.duplicarSetlist(sl as Setlist); fecharMenu()">Duplicar</button>
                <button v-if="be.souDono(sl.dono)"
                  @click="apagar = { id: sl.id, nome: sl.name }; fecharMenu()">Excluir</button>
              </div>
            </div>
          </li>
          <li v-if="busca && !reps.length" class="empty">Nada encontrado</li>
          <li v-else-if="!reps.length" class="vazio">
            <span aria-hidden="true" class="ms">queue_music</span>
            <div class="title">Nenhum repertório ainda</div>
            <p class="faint">Monte a lista de um culto, show ou ensaio: as músicas na ordem, cada uma no tom do dia.</p>
            <button class="btn" @click.stop="novoRep = true"><span aria-hidden="true" class="ms">add</span>Criar repertório</button>
          </li>
        </ul>
      </div>

      <button v-if="!vazia" class="fab no-print" @click="prefs.aba === 'songs' ? novaMusica() : (novoRep = true)">
        <span aria-hidden="true" class="ms">add</span>{{ prefs.aba === 'songs' ? 'Música' : 'Repertório' }}
      </button>
    </template>

    <Prompt v-if="novoRep" titulo="Novo repertório" dica="Nome" ok="Criar"
      @fechar="novoRep = false" @ok="criarRep">
      <label class="data">
        <span aria-hidden="true" class="ms">event</span>
        <input v-model="dataNovo" type="date" />
        <span class="muted">Data do evento</span>
      </label>
    </Prompt>
    <Prompt v-if="apagar" titulo="Excluir?" :texto="`O repertório “${apagar.nome}” vai sair para todos.`" sem-campo ok="Excluir"
      @fechar="apagar = null" @ok="confirmaApagar" />
  </div>
</template>

<style scoped>
.grupo-em-uso {
  all: unset; cursor: pointer; font: inherit; color: inherit;
  display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.estreito { display: none; }
@media (max-width: 480px) {
  .largo { display: none; }
  .estreito { display: block; }
}
.aceite { font-size: 12px; margin: 10px 0 0; }
.vazio { text-align: center; padding: 32px 16px; list-style: none; }
.vazio > .ms { font-size: 40px; color: var(--primary); }
.vazio .title { font-weight: 650; margin: 8px 0 4px; }
.vazio p { max-width: 420px; margin: 0 auto 14px; font-size: 14px; line-height: 1.45; }
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
.sujo { color: #ffb74d; font-size: 13px; }
.entrar { margin-top: 24px; }
.acoes-entrar { display: flex; gap: 8px; flex-wrap: wrap; }
.data { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
.data .ms { color: var(--primary); }
</style>
