<script setup lang="ts">
// O que muda de [antes] p/ [depois]: campos e cifra linha a linha.
import { computed } from 'vue';
import type { Song } from '../types';
import { diffLinhas, diffResumo, resumoMudancas, textoDa } from '../core';

const props = defineProps<{ antes: Song; depois: Song }>();
const campos = computed(() =>
  resumoMudancas(props.antes, props.depois).filter((d) => !d.startsWith('Cifra alterada')));
const linhas = computed(() => diffResumo(diffLinhas(textoDa(props.antes), textoDa(props.depois))));
</script>

<template>
  <div>
    <div v-for="c in campos" :key="c" class="campo">
      <span aria-hidden="true" class="ms">edit_note</span>{{ c }}
    </div>
    <p v-if="!linhas.length" class="muted">A cifra (letra e acordes) não muda.</p>
    <div v-else class="diff">
      <template v-for="(l, i) in linhas" :key="i">
        <div v-if="l === null" class="skip">⋯</div>
        <div v-else :class="['l', l.tipo > 0 ? 'add' : l.tipo < 0 ? 'del' : '']">
          {{ l.tipo > 0 ? '+' : l.tipo < 0 ? '−' : ' ' }} {{ l.text }}
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.campo { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.campo .ms { color: var(--primary); font-size: 20px; }
.diff {
  background: var(--card-hi); border-radius: 12px; padding: 8px 0; margin-top: 8px;
  font-family: var(--mono); font-size: 13px; line-height: 1.4; overflow-x: auto;
}
.l, .skip { padding: 0 12px; white-space: pre; }
.skip { color: var(--faint); }
.add { background: var(--add-bg); }
.del { background: var(--del-bg); text-decoration: line-through; text-decoration-color: var(--error); }
</style>
