<script setup lang="ts">
import { voltar } from '../nav';
defineProps<{ titulo: string; sub?: string; semVoltar?: boolean }>();
</script>

<template>
  <header class="bar no-print">
    <button v-if="!semVoltar" class="icon-btn" title="Voltar" aria-label="Voltar" @click="voltar"><span aria-hidden="true" class="ms">arrow_back</span></button>
    <slot name="logo" />
    <div class="t">
      <div class="titulo">{{ titulo }}</div>
      <div v-if="sub || $slots.sub" class="sub"><slot name="sub">{{ sub }}</slot></div>
    </div>
    <div class="acoes"><slot /></div>
  </header>
</template>

<style scoped>
.bar {
  position: sticky; top: 0; z-index: 10; margin-bottom: 12px;
  background: color-mix(in srgb, var(--surface-1) 88%, transparent); backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--line);
  display: flex; align-items: center; gap: 8px; padding: 8px 10px 8px 12px; min-height: 56px;
}
.t { flex: 1; min-width: 0; }
.titulo { font-size: 17px; font-weight: 650; letter-spacing: -0.3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sub { font-size: 12px; color: var(--muted); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.acoes { display: flex; align-items: center; gap: 2px; }
</style>
