<script setup lang="ts">
// Configurações deste navegador, como no app: tema, cor, letra, rolagem,
// pedal e backup (JSON no mesmo formato do app).
import { ref, onBeforeUnmount } from 'vue';
import AppBar from '../components/AppBar.vue';
import { prefs, abrir } from '../nav';
import { CORES, hexDe } from '../tema';
import * as be from '../backend';
import Prompt from '../components/Prompt.vue';
import { cloud, ativa, pedirExclusao } from '../cloud';
import { songToRaw, setlistToRaw, songFromRaw, setlistFromRaw } from '../types';
import type { RawData } from '../types';

const NOMES: Record<string, string> = {
  PageDown: 'Page Down', PageUp: 'Page Up', ArrowDown: 'Seta ↓', ArrowUp: 'Seta ↑',
  ArrowRight: 'Seta →', ArrowLeft: 'Seta ←', Space: 'Espaço', Enter: 'Enter', Backspace: 'Apagar',
  AudioVolumeUp: 'Volume +', AudioVolumeDown: 'Volume −', MediaPlayPause: 'Play/Pause',
  MediaTrackNext: 'Próxima faixa', MediaTrackPrevious: 'Faixa anterior',
};
const PADRAO = { next: ['PageDown', 'ArrowDown', 'ArrowRight', 'Space'], prev: ['PageUp', 'ArrowUp', 'ArrowLeft'] };
const nomeTecla = (c: string) => NOMES[c] ?? c.replace(/^Key|^Digit/, '');
const teclas = (a: 'next' | 'prev') => (prefs.pedal[a].length ? prefs.pedal[a] : PADRAO[a]).map(nomeTecla).join(', ');

// gravar tecla do pedal: a próxima tecla apertada vira a da ação
const gravando = ref<'next' | 'prev' | null>(null);
function grava(e: KeyboardEvent) {
  if (!gravando.value) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.code !== 'Escape') {
    const a = gravando.value;
    const l = prefs.pedal[a].length ? [...prefs.pedal[a]] : [];
    if (!l.includes(e.code)) l.push(e.code);
    prefs.pedal = { ...prefs.pedal, [a]: l };
  }
  gravando.value = null;
}
window.addEventListener('keydown', grava, true);
onBeforeUnmount(() => window.removeEventListener('keydown', grava, true));

// ---------- privacidade ----------
const base = import.meta.env.BASE_URL;
const excluindo = ref(false);
const excluiu = ref(false);
async function excluir() {
  excluindo.value = false;
  excluiu.value = await pedirExclusao();
}

// ---------- backup ----------
const aviso = ref('');
function exportar() {
  const dados: RawData = { songs: be.songs.value.map(songToRaw), setlists: be.setlists.value.map(setlistToRaw) };
  const blob = new Blob([JSON.stringify(dados, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `arion-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const arquivo = ref<HTMLInputElement | null>(null);
async function importar(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  try {
    const j = JSON.parse(await f.text()) as RawData;
    let n = 0, r = 0;
    // mescla: o que já existe só é trocado se o do arquivo for mais novo
    for (const raw of j.songs ?? []) {
      const s = songFromRaw(raw);
      const ja = be.songById(s.id);
      if (ja && (ja.updatedAt >= s.updatedAt || !be.podeEditarSong(ja))) continue;
      be.salvarSong(ja ? { ...s, dono: ja.dono, donoNome: ja.donoNome, editores: ja.editores } : s);
      n++;
    }
    for (const raw of j.setlists ?? []) {
      const sl = setlistFromRaw(raw);
      const ja = be.setlistById(sl.id);
      if (ja && (ja.updatedAt >= sl.updatedAt || !be.podeEditarSetlist(ja))) continue;
      be.salvarSetlist(sl);
      r++;
    }
    aviso.value = `${n} música(s) e ${r} repertório(s) importados`;
  } catch {
    aviso.value = 'JSON inválido';
  }
  (e.target as HTMLInputElement).value = '';
}
</script>

<template>
  <div>
    <AppBar titulo="Configurações" />
    <div class="wrap">
      <section class="card">
        <label class="linha">
          <span class="grow">Tema escuro</span>
          <input type="checkbox" class="switch" :checked="prefs.tema === 'dark'"
            @change="prefs.tema = ($event.target as HTMLInputElement).checked ? 'dark' : 'light'" />
        </label>
        <div class="lbl">Cor do tema</div>
        <div class="cores">
          <button v-for="c in CORES" :key="c" class="cor" :style="{ background: hexDe(c) }"
            :class="{ on: prefs.cor === c }" :title="hexDe(c)" @click="prefs.cor = c">
            <span v-if="prefs.cor === c" class="ms">check</span>
          </button>
        </div>
      </section>

      <section class="card">
        <div class="lbl">Tamanho da letra: {{ Math.round(prefs.fonte * 100) }}%</div>
        <input v-model.number="prefs.fonte" type="range" min="0.7" max="2.8" step="0.1" />
        <div class="lbl">Velocidade auto-rolagem (padrão): {{ Math.round(prefs.velocidade) }}</div>
        <input v-model.number="prefs.velocidade" type="range" min="4" max="200" step="2" />
        <p class="faint dica">Cada música pode ter a sua (◀◀ ▶▶ na tela da música).</p>
      </section>

      <section class="card">
        <h3 class="section-title"><span class="ms">keyboard</span>Pedal / teclado</h3>
        <p class="faint dica">Pedal Bluetooth de virar página manda teclas. Na tela da música: avança rola p/ baixo
          (no fim, vai p/ a próxima do repertório); volta faz o contrário.</p>
        <div class="lbl">Quanto cada toque rola: {{ Math.round(prefs.passo * 100) }}% da tela</div>
        <input v-model.number="prefs.passo" type="range" min="0.1" max="1" step="0.05" />
        <div v-for="a in (['next', 'prev'] as const)" :key="a" class="linha tecla">
          <div class="grow">
            <div>{{ a === 'next' ? 'Avançar' : 'Voltar' }}</div>
            <div class="faint mini">{{ teclas(a) }}</div>
          </div>
          <button class="btn tonal" @click="gravando = a">{{ gravando === a ? 'Aperte a tecla…' : 'Gravar' }}</button>
        </div>
        <button v-if="prefs.pedal.next.length || prefs.pedal.prev.length" class="btn text"
          @click="prefs.pedal = { next: [], prev: [] }">Restaurar padrão</button>
      </section>

      <section class="card">
        <h3 class="section-title"><span class="ms">cell_tower</span>Ao vivo</h3>
        <label class="lbl">Nome deste navegador na sessão</label>
        <input v-model="prefs.aparelho" placeholder="Ex.: Notebook do teclado" class="full" />
        <button class="btn text" @click="abrir({ nome: 'aovivo' })">Abrir sessão ao vivo</button>
      </section>

      <section class="card">
        <h3 class="section-title"><span class="ms">backup</span>Backup</h3>
        <div class="linha">
          <button class="btn tonal" :disabled="!be.songs.value.length" @click="exportar">
            <span class="ms">download</span>Exportar (JSON)</button>
          <button class="btn tonal" :disabled="!ativa" @click="arquivo?.click()">
            <span class="ms">upload</span>Importar (JSON)</button>
          <input ref="arquivo" type="file" accept=".json,application/json" hidden @change="importar" />
        </div>
        <p class="faint dica">Mesmo formato do backup do app. Importar mescla em
          {{ cloud.grupo?.nome ?? 'sua biblioteca' }} (não apaga nada).</p>
        <p v-if="aviso" class="ok">{{ aviso }}</p>
        <button class="btn text" @click="abrir({ nome: 'atividade' })">Ver histórico</button>
      </section>

      <section class="card">
        <h3 class="section-title"><span class="ms">privacy_tip</span>Privacidade</h3>
        <div class="linha">
          <a class="btn tonal" :href="`${base}privacidade.html`" target="_blank">
            <span class="ms">open_in_new</span>Política de privacidade</a>
          <a class="btn tonal" :href="`${base}termos.html`" target="_blank">
            <span class="ms">open_in_new</span>Termos de uso</a>
        </div>
        <template v-if="cloud.user">
          <p class="faint dica">Conta: {{ cloud.user.email }}</p>
          <button class="btn danger" @click="excluindo = true">
            <span class="ms">person_remove</span>Excluir minha conta</button>
        </template>
        <p v-if="excluiu" class="ok">Pedido de exclusão enviado. A conta e os dados somem em até 30 dias.</p>
      </section>
      <Prompt v-if="excluindo" titulo="Excluir minha conta?" sem-campo ok="Excluir"
        texto="Apaga da nuvem a sua conta, as músicas e repertórios que são seus (inclusive nos grupos e no acervo geral), as suas sugestões e o seu nome. Os grupos que são seus passam para outra pessoa do grupo. A exclusão é feita em até 30 dias e não dá para desfazer."
        @fechar="excluindo = false" @ok="excluir" />

      <p class="faint fim">Arion</p>
    </div>
  </div>
</template>

<style scoped>
.wrap { max-width: 720px; margin: 0 auto; padding: 0 16px 40px; display: flex; flex-direction: column; gap: 12px; }
.linha { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.grow { flex: 1; }
.lbl { font-size: 14px; margin: 12px 0 6px; display: block; }
.mini { font-size: 12px; }
.dica { font-size: 13px; margin: 4px 0; }
.cores { display: flex; flex-wrap: wrap; gap: 10px; }
.cor {
  width: 44px; height: 44px; border-radius: 50%; border: 3px solid transparent;
  display: grid; place-items: center; color: #fff;
}
.cor.on { border-color: var(--fg); }
input[type='range'] { width: 100%; padding: 0; accent-color: var(--primary); background: transparent; }
.switch { width: 22px; height: 22px; accent-color: var(--primary); }
.tecla { margin-top: 10px; }
.full { width: 100%; margin-bottom: 6px; }
.ok { color: var(--ok); }
a.btn { text-decoration: none; }
.fim { text-align: center; margin-top: 8px; }
</style>
