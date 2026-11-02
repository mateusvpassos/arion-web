<script setup lang="ts">
// Diálogo simples com um campo (nome, motivo, recado...).
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps<{ titulo: string; texto?: string; valor?: string; dica?: string; ok?: string; semCampo?: boolean }>();
const emit = defineEmits<{ fechar: []; ok: [valor: string] }>();
const v = ref(props.valor ?? '');

// "autofocus" do HTML só vale ao carregar a página: num diálogo que abre
// depois o cursor não ia p/ o campo e o que se digitava se perdia
const campo = ref<HTMLInputElement | null>(null);
const botaoOk = ref<HTMLButtonElement | null>(null);
const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') emit('fechar'); };
onMounted(() => {
  if (campo.value) { campo.value.focus(); campo.value.select(); } else botaoOk.value?.focus();
  document.addEventListener('keydown', esc);
});
onUnmounted(() => document.removeEventListener('keydown', esc));
</script>

<template>
  <div class="scrim center" @click.self="emit('fechar')">
    <form class="dialog" @submit.prevent="emit('ok', v.trim())">
      <h3>{{ titulo }}</h3>
      <p v-if="texto" class="muted">{{ texto }}</p>
      <input v-if="!semCampo" ref="campo" v-model="v" :placeholder="dica" style="width: 100%" />
      <slot />
      <div class="actions">
        <button type="button" class="btn text" @click="emit('fechar')">Cancelar</button>
        <button ref="botaoOk" type="submit" class="btn">{{ ok ?? 'OK' }}</button>
      </div>
    </form>
  </div>
</template>
