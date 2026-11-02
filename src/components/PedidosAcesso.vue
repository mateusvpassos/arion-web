<script setup lang="ts">
// Dono do app: quem pediu acesso. Liberar = como convidar, mas sem grupo.
import { cloud, liberarPedido, recusarPedido } from '../cloud';
</script>

<template>
  <div v-if="cloud.pedidos.length" class="card">
    <h3 class="section-title"><span aria-hidden="true" class="ms">how_to_reg</span>Pedidos de acesso ({{ cloud.pedidos.length }})</h3>
    <ul class="pedidos">
      <li v-for="p in cloud.pedidos" :key="p.email">
        <div class="grow">
          <div>{{ p.nome || p.email }}</div>
          <div class="faint small">{{ p.email }}</div>
        </div>
        <button class="btn text" @click="recusarPedido(p)">Recusar</button>
        <button class="btn" @click="liberarPedido(p)">Liberar</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.pedidos { list-style: none; margin: 0; padding: 0; }
.pedidos li { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-top: 1px solid var(--line); }
.pedidos li:first-child { border-top: none; }
.grow { flex: 1; min-width: 0; overflow-wrap: anywhere; }
</style>
