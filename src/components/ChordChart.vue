<script setup lang="ts">
// Acorde sobre a letra (monoespaçada = alinha pela coluna), como no app.
// "Só letra": fonte comum, refrão em negrito, sem as linhas só de acorde.
import { computed } from 'vue';
import type { Song, SongLine } from '../types';
import { soLetra, isRefrao } from '../core';

const props = defineProps<{ song: Song; fonte?: number; letra?: boolean }>();
const tam = computed(() => 18 * (props.fonte ?? 1) * (props.letra ? 1.3 : 1));

function chordRow(line: SongLine): string {
  let row = '';
  for (const c of [...line.chords].sort((a, b) => a.idx - b.idx)) {
    if (row.length < c.idx) row = row.padEnd(c.idx);
    else if (row.length > 0) row += ' '; // não deixa um acorde encostar no outro
    row += c.sym;
  }
  return row;
}

// linhas em branco no fim da seção são sobra (a seção seguinte já tem espaço)
function linhas(ls: SongLine[]): SongLine[] {
  let fim = ls.length;
  while (fim > 0 && !ls[fim - 1].chords.length && !ls[fim - 1].lyric.trim()) fim--;
  return ls.slice(0, fim);
}

const secoes = computed(() => (props.letra ? soLetra(props.song) : props.song.sections));
</script>

<template>
  <div class="chart" :class="{ letra }" :style="{ fontSize: tam + 'px' }">
    <template v-for="(sec, si) in secoes" :key="si">
      <div v-if="sec.name" class="sec" :class="{ refrao: isRefrao(sec.name) && !letra }">
        {{ sec.name.toUpperCase() }}
      </div>
      <div v-else-if="letra && si > 0" class="gap"></div>
      <template v-if="letra">
        <div v-for="(l, li) in sec.lines" :key="li" class="lyr" :class="{ forte: isRefrao(sec.name) }">
          {{ l.lyric || ' ' }}
        </div>
      </template>
      <template v-else>
        <div v-for="(l, li) in linhas(sec.lines)" :key="li" class="ln">
          <div v-if="l.chords.length" class="ch">{{ chordRow(l) }}</div>
          <div class="ly">{{ l.lyric || ' ' }}</div>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.chart { font-family: var(--mono); overflow-x: auto; padding-bottom: 8px; }
.ln { line-height: 1.25; }
.ch { color: var(--chord); font-weight: 700; white-space: pre; font-size: .92em; line-height: 1.1; }
.ly { white-space: pre; }
.sec {
  font-family: 'Geist', system-ui, sans-serif; font-size: .7em; font-weight: 800; letter-spacing: 1.2px;
  color: var(--chord); margin: 18px 0 4px; display: inline-block;
}
.sec.refrao {
  background: color-mix(in srgb, var(--chord) 16%, transparent); padding: 3px 8px; border-radius: 6px;
}
.letra { font-family: 'Geist', system-ui, sans-serif; }
.letra .sec { font-size: .55em; margin-top: .9em; display: block; }
.lyr { line-height: 1.3; white-space: pre-wrap; }
.lyr.forte { font-weight: 700; }
.gap { height: .6em; }
@media print {
  .chart { overflow: visible; }
}
</style>
