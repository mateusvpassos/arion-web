<script setup lang="ts">
// Diagrama do acorde (o mesmo desenho do app), em SVG.
import { computed } from 'vue';
import { formaDe } from '../acordes';

const props = defineProps<{ sym: string }>();
const emit = defineEmits<{ fechar: [] }>();
const f = computed(() => formaDe(props.sym));

const W = 160, H = 184, L = W * 0.12, T = H * 0.12, LW = W * 0.76, LH = H * 0.7;
const dx = LW / 5, dy = LH / 5;
const pontos = computed(() => (f.value?.casas ?? []).map((casa, i) => {
  const x = L + dx * i;
  if (casa < 0) return { x, tipo: 'x' as const, y: T - H * 0.06 };
  if (casa === 0) return { x, tipo: 'o' as const, y: T - H * 0.055 };
  const rel = f.value!.base === 0 ? casa : casa - f.value!.base + 1;
  return { x, tipo: 'd' as const, y: T + dy * (rel - 0.5) };
}));
</script>

<template>
  <div class="scrim center" @click.self="emit('fechar')">
    <div class="dialog">
      <h3>{{ sym }}</h3>
      <p v-if="!f" class="muted">Forma não disponível</p>
      <template v-else>
        <svg :viewBox="`0 0 ${W} ${H}`" :width="W * 1.3" :height="H * 1.3" class="braco">
          <rect v-if="f.base === 0" :x="L" :y="T - 3" :width="LW" height="3.5" class="cheio" />
          <text v-else :x="L - W * 0.07" :y="T + dy / 2 + 4" class="fr" text-anchor="middle">{{ f.base }}fr</text>
          <line v-for="i in 6" :key="'h' + i" :x1="L" :x2="L + LW" :y1="T + dy * (i - 1)" :y2="T + dy * (i - 1)" />
          <line v-for="i in 6" :key="'v' + i" :x1="L + dx * (i - 1)" :x2="L + dx * (i - 1)" :y1="T" :y2="T + LH" />
          <template v-for="(p, i) in pontos" :key="i">
            <text v-if="p.tipo === 'x'" :x="p.x" :y="p.y + 4" class="fr" text-anchor="middle">×</text>
            <circle v-else-if="p.tipo === 'o'" :cx="p.x" :cy="p.y" r="4" class="solta" />
            <circle v-else :cx="p.x" :cy="p.y" :r="dx * 0.32" class="cheio" />
          </template>
        </svg>
        <div class="faint nota">forma aproximada</div>
      </template>
      <div class="actions"><button class="btn text" @click="emit('fechar')">Fechar</button></div>
    </div>
  </div>
</template>

<style scoped>
.dialog { width: auto; min-width: 260px; text-align: center; }
.braco { display: block; margin: 8px auto 0; }
line { stroke: color-mix(in srgb, var(--primary) 60%, transparent); stroke-width: 1.4; }
.cheio { fill: var(--primary); }
.solta { fill: none; stroke: var(--primary); stroke-width: 1.5; }
.fr { fill: var(--primary); font-size: 12px; font-weight: 700; font-family: 'Geist', sans-serif; }
.nota { font-size: 11px; }
</style>
