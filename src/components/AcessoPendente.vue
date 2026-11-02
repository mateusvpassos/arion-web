<script setup lang="ts">
// Quem entrou mas ainda não foi liberado: pede acesso com um toque (o dono do
// app libera) ou espera alguém convidar p/ um grupo. Liberado, abre sozinho.
import { cloud, conferirLiberacao, pedirAcesso, sair } from '../cloud';
</script>

<template>
  <p v-if="cloud.pedi" class="ok">
    Pedido enviado! Assim que for liberado, esta tela abre sozinha (pode fechar e voltar depois).
  </p>
  <p v-else>
    Toque em “Pedir acesso” e o dono do app libera você. Ou peça p/ alguém que já usa o Arion te adicionar num
    grupo (pelo e-mail {{ cloud.user?.email }}).
  </p>
  <div class="acoes">
    <button v-if="cloud.pedi === false" class="btn" @click="pedirAcesso()">
      <span aria-hidden="true" class="ms">how_to_reg</span>Pedir acesso</button>
    <button class="btn" :class="{ tonal: cloud.pedi === false }" @click="conferirLiberacao()">
      <span aria-hidden="true" class="ms">refresh</span>Já fui liberado</button>
    <!-- entrou com a conta errada: sem isto não havia como trocar -->
    <button class="btn text" @click="sair()"><span aria-hidden="true" class="ms">logout</span>Trocar de conta</button>
  </div>
</template>

<style scoped>
.acoes { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
</style>
