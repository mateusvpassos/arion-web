<script setup lang="ts">
// Sessão ao vivo pelo navegador: entra na sessão criada no tablet/celular
// (Ao vivo → Criar sessão lá; o endereço aparece na tela do app).
import { ref } from 'vue';
import AppBar from '../components/AppBar.vue';
import { prefs, abrir } from '../nav';
import { live, entrar, sair, setModo, meuNome } from '../live';
import type { Modo } from '../live';
import * as be from '../backend';

function ultima() {
  try { return localStorage.getItem('arion.ultimaSessao') ?? ''; } catch { return ''; }
}
const endereco = ref(ultima());
async function conectar() {
  if (await entrar(endereco.value)) {
    try { localStorage.setItem('arion.ultimaSessao', endereco.value.trim()); } catch { /* sem storage */ }
    // já tem música aberta lá: abre aqui também
    const n = live.nav;
    if (n && live.modo === 'segue' && (be.songById(n.songId) || live.songs[n.songId]))
      abrir({ nome: 'musica', id: n.songId, setlistId: n.setlistId ?? undefined });
  }
}
const MODOS: { m: Modo; icone: string; nome: string; dica: string }[] = [
  { m: 'conduz', icone: 'campaign', nome: 'Conduz', dica: 'O que você abre, o tom e a rolagem vão p/ os outros' },
  { m: 'segue', icone: 'visibility', nome: 'Segue', dica: 'Acompanha quem conduz (música, tom e rolagem)' },
  { m: 'livre', icone: 'do_not_disturb_on', nome: 'Livre', dica: 'Fica na sessão sem acompanhar ninguém' },
];
const ICONE: Record<Modo, string> = { conduz: 'campaign', segue: 'visibility', livre: 'do_not_disturb_on' };
meuNome();
</script>

<template>
  <div>
    <AppBar titulo="Ao vivo" :sub="live.ativo ? `Conectado a ${live.host || live.endereco}` : ''" />
    <div class="wrap">
      <template v-if="!live.ativo">
        <div class="card">
          <h3 class="section-title"><span aria-hidden="true" class="ms">cell_tower</span>Entrar numa sessão</h3>
          <p class="muted">Crie a sessão no tablet ou celular (Arion → <b>Ao vivo</b> → Criar sessão) e
            digite aqui o <b>código</b> que aparece lá. Este computador precisa estar na mesma rede (Wi-Fi).</p>
          <form class="linha" @submit.prevent="conectar">
            <input v-model="endereco" placeholder="Código (ex.: 4821) ou endereço" inputmode="decimal" class="grow" autofocus />
            <button class="btn" :disabled="live.conectando || !endereco.trim()">
              <span aria-hidden="true" class="ms">login</span>{{ live.conectando ? 'Conectando…' : 'Entrar' }}
            </button>
          </form>
          <p v-if="live.erro" class="error">{{ live.erro }}</p>
          <p class="faint dica">O navegador só entra em sessão; criar e achar sozinho na rede é pelo app.</p>
        </div>
      </template>

      <template v-else>
        <div v-if="live.reconectando" class="banner">Conexão caiu — tentando voltar…</div>
        <p v-if="live.aviso" class="ok">{{ live.aviso }}</p>
        <div class="card">
          <h3 class="section-title"><span aria-hidden="true" class="ms">computer</span>Este navegador</h3>
          <div class="modos">
            <button v-for="x in MODOS" :key="x.m" class="chip" :class="{ on: live.modo === x.m }" :title="x.dica"
              @click="setModo(x.m)"><span aria-hidden="true" class="ms">{{ x.icone }}</span>{{ x.nome }}</button>
          </div>
          <p class="faint dica">{{ MODOS.find((x) => x.m === live.modo)!.dica }}</p>
        </div>
        <div class="card">
          <h3 class="section-title"><span aria-hidden="true" class="ms">devices</span>Aparelhos ({{ live.peers.length }})</h3>
          <ul class="list">
            <li v-for="p in live.peers" :key="p.id" class="peer">
              <span aria-hidden="true" class="ms">{{ ICONE[p.mode] }}</span>
              <span class="grow">{{ p.name }}{{ p.name === prefs.aparelho ? ' (este)' : '' }}</span>
              <span class="faint">{{ p.mode === 'conduz' ? 'conduz' : p.mode === 'segue' ? 'segue' : 'livre' }}</span>
            </li>
          </ul>
        </div>
        <div class="linha">
          <button v-if="live.nav && (be.songById(live.nav.songId) || live.songs[live.nav.songId])" class="btn tonal"
            @click="abrir({ nome: 'musica', id: live.nav.songId, setlistId: live.nav.setlistId ?? undefined })">
            <span aria-hidden="true" class="ms">music_note</span>Abrir a música atual</button>
          <button class="btn danger" @click="sair"><span aria-hidden="true" class="ms">logout</span>Sair da sessão</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.wrap { max-width: 720px; margin: 0 auto; padding: 0 16px 40px; display: flex; flex-direction: column; gap: 12px; }
.linha { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.grow { flex: 1; min-width: 160px; }
.dica { font-size: 13px; margin: 8px 0 0; }
.modos { display: flex; gap: 6px; flex-wrap: wrap; }
.peer { display: flex; align-items: center; gap: 12px; padding: 8px 4px; }
.peer .ms { color: var(--primary); }
.ok { color: var(--ok); margin: 0; }
</style>
