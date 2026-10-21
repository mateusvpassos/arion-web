<script setup lang="ts">
// Grupos: quem você é e a lista dos seus grupos (clicar abre o grupo).
import { ref } from 'vue';
import AppBar from '../components/AppBar.vue';
import Prompt from '../components/Prompt.vue';
import {
  cloud, eu, nomeDe, entrar, sair, criarGrupo, disponivel, entrarTeste, ehMinha, nomeDoGrupo, conferirLiberacao,
} from '../cloud';
import { emulador } from '../firebase';
import { abrir } from '../nav';

const emailTeste = ref('');
const nomeTeste = ref('');
const criando = ref(false);
</script>

<template>
  <div>
    <AppBar titulo="Grupos" />
    <div class="wrap">
      <div v-if="!disponivel" class="card">
        <h3 class="section-title"><span class="ms">cloud_off</span>Nuvem ainda não configurada</h3>
        <p>Falta configurar o Firebase.</p>
      </div>

      <div v-else-if="!cloud.user" class="card">
        <h3 class="section-title"><span class="ms">login</span>Entrar</h3>
        <p>Entre com a conta Google p/ ver o acervo e as suas músicas.</p>
        <form v-if="emulador" class="linha" @submit.prevent="entrarTeste(emailTeste, nomeTeste)">
          <input v-model="emailTeste" placeholder="E-mail (teste)" />
          <input v-model="nomeTeste" placeholder="Nome (teste)" />
          <button class="btn">Entrar (emulador)</button>
        </form>
        <button v-else class="btn" @click="entrar"><span class="ms">account_circle</span>Entrar com Google</button>
      </div>

      <template v-else>
        <!-- conta -->
        <div class="card conta">
          <span class="av grande">{{ (cloud.user.nome[0] ?? '?').toUpperCase() }}</span>
          <div class="grow">
            <div class="nome">{{ cloud.user.nome }}</div>
            <div class="faint">{{ cloud.user.email }}</div>
          </div>
          <button class="btn text" @click="sair">Sair</button>
        </div>

        <div v-if="cloud.liberado === false" class="card">
          <h3 class="section-title"><span class="ms">lock_clock</span>Acesso ainda não liberado</h3>
          <p>Peça p/ alguém que já usa o MyMusic te adicionar num grupo (pelo e-mail {{ cloud.user.email }}).
            Ao ser adicionado, o seu acesso é liberado.</p>
          <button class="btn" @click="conferirLiberacao()"><span class="ms">refresh</span>Já me adicionaram</button>
        </div>

        <p v-else-if="!cloud.grupos.length" class="muted">Preparando a sua biblioteca…</p>

        <div v-else class="card">
          <h3 class="section-title"><span class="ms">groups</span>Seus grupos</h3>
          <p class="faint small">
            Cada grupo tem as suas músicas, repertórios e pessoas. O que está em uso aparece na tela inicial.
          </p>
          <ul class="grupos">
            <li v-for="g in cloud.grupos" :key="g.id" @click="abrir({ nome: 'grupoDetalhe', id: g.id })">
              <span class="ms">{{ ehMinha(g) ? 'person' : 'groups' }}</span>
              <div class="grow">
                <div>{{ nomeDoGrupo(g) }}</div>
                <div class="faint small">
                  {{ g.membros.length }} pessoa(s) · {{ g.dono === eu ? 'você é o dono' : `de ${nomeDe(g.dono)}` }}
                </div>
              </div>
              <span v-if="cloud.grupo?.id === g.id" class="chip on">em uso</span>
              <span class="ms faint">chevron_right</span>
            </li>
          </ul>
          <button class="btn" @click="criando = true"><span class="ms">group_add</span>Novo grupo</button>
        </div>

        <div class="card">
          <h3 class="section-title"><span class="ms">public</span>Acervo geral</h3>
          <p>
            É a aba <b>Músicas</b> da tela inicial: todas as músicas de quem usa o app. As suas entram lá
            sozinhas (continuam suas; os outros só sugerem). Ao tocar ou pôr no repertório uma do acervo,
            ela vem p/ as suas músicas como cópia — dá p/ mudar o tom e as anotações sem mexer na original.
          </p>
        </div>
      </template>
      <p v-if="cloud.erro" class="error">{{ cloud.erro }}</p>
    </div>
    <Prompt v-if="criando" titulo="Novo grupo" dica="Nome (ex.: Ministério de música)" ok="Criar"
      @fechar="criando = false" @ok="(n) => { criando = false; if (n) criarGrupo(n); }" />
  </div>
</template>

<style scoped>
.wrap { max-width: 760px; margin: 0 auto; padding: 0 16px 40px; display: flex; flex-direction: column; gap: 12px; }
.card p { margin: 6px 0 12px; line-height: 1.45; }
.conta { display: flex; align-items: center; gap: 14px; }
.nome { font-weight: 700; font-size: 17px; }
.small { font-size: 12px; }
.grupos { list-style: none; margin: 0 0 12px; padding: 0; }
.grupos li {
  display: flex; align-items: center; gap: 12px; padding: 10px 8px; border-radius: 10px; cursor: pointer;
}
.grupos li:hover { background: var(--chip); }
.av {
  width: 34px; height: 34px; border-radius: 50%; background: var(--primary-container); color: #fff;
  display: grid; place-items: center; font-weight: 600; flex: none;
}
.av.grande { width: 46px; height: 46px; font-size: 20px; }
.grow { flex: 1; min-width: 0; }
.linha { display: flex; gap: 8px; flex-wrap: wrap; }
</style>
