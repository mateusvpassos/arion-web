# 🎵 Arion — Web

Versão web do [**Arion**](https://github.com/mateusvpassos/arion) (cifras, acordes e repertórios p/ tocar ao vivo):
mesma nuvem, mesmos grupos e o mesmo visual do app, no navegador.

**No ar:** https://mateusvpassos.github.io/arion-web/ (publicado pelo GitHub Pages a cada push na `main`).

![Vue](https://img.shields.io/badge/Vue-3-42b883?logo=vuedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-ffca28?logo=firebase&logoColor=black)

---

## ✨ O que faz

- **Músicas:** título, artista, tom, capo, BPM, **tags** e a cifra; editor por **texto** (com prévia) ou **acordes**
  (toque no acorde e depois na sílaba, ou arraste; a paleta segue o tom)
- **Importa cifra** colada no formato "acorde acima da letra" (Cifra Club) **ou** ChordPro `[G]letra`;
  `Tom:`, `Capo` e `{title:}` no texto preenchem os campos
- **Buscar letra** no [LRCLIB](https://lrclib.net) e **copiar acordes** de uma estrofe p/ outra
- **Repertórios:** reordenar, **tom por música**, filtro por tag e "tocada há X"; imprimir/PDF no tom do repertório,
  Word, imagem da lista e TXT de letras
- **Acervo geral** e **grupos** (lista, criar, renomear, apagar, pessoas e músicas do grupo)
- **Sugestões** (aceitar/recusar vendo a diferença), **histórico de versões**, permissões e atividade recente
- **Sessão ao vivo:** entra pelo código/IP da sessão criada no tablet e acompanha quem conduz

> O motor de cifras é uma **porta fiel** do app Flutter (`src/chordEngine.ts`), gerando o **mesmo formato JSON**.

---

## 🔐 Acesso

- Entra com a **conta Google**; mas só usa a nuvem quem foi **convidado p/ um grupo** por alguém que já usa o Arion
  (quem não foi vê "Acesso ainda não liberado"). Detalhes e regras no repo do app:
  [`docs/FIREBASE.md`](https://github.com/mateusvpassos/arion/blob/main/docs/FIREBASE.md).
- A config do Firebase em `src/firebase.ts` é **pública por design**: quem protege os dados são as regras do Firestore.
- Política de privacidade: [`public/privacidade.html`](public/privacidade.html) →
  https://mateusvpassos.github.io/arion-web/privacidade.html

---

## 🚀 Rodar (local)

Pré-requisito: Node.js.

```bash
npm install
npm run dev      # http://localhost:4173
```

Ou **duplo-clique em `start.bat`** (abre o navegador e liga o servidor; feche a janela para parar).

```bash
npm run build    # gera dist/ (o mesmo que o GitHub Pages publica)
npm run dev:emu  # porta 4174 contra o emulador do Firebase (rode `npm run emu` em arion/firebase)
npm run icons    # gera os PNGs do ícone (web e app) a partir de desktop/icon.svg
```

Conferir que o parser bate com o do app:
```bash
# no repo do app
flutter test test/parser_parity_test.dart
# aqui
node scripts/parity.ts
```

---

## 🧱 Estrutura

```
src/
├── firebase.ts      # liga o Firebase (projeto arion-cifras) ou o emulador
├── cloud.ts         # login, liberação, grupos, músicas/repertórios do grupo, sugestões, versões
├── acervo.ts        # acervo geral (lê do cache e só busca o que mudou)
├── backend.ts       # ponte entre as telas e a nuvem
├── chordEngine.ts   # parser/serialize/import de cifra, campo harmônico (porta do Dart)
├── letras.ts        # busca de letra (LRCLIB)
├── live.ts          # sessão ao vivo (WebSocket)
├── exportar.ts      # Word, imagem
├── nav.ts           # pilha de telas + preferências do navegador (arion.*)
├── types.ts         # tipos + conversão p/ o JSON do app
└── views/           # telas (início, música, editor, repertório, grupos, ao vivo...)
desktop/
├── icon.svg         # o ícone "A"
└── make-icons.cjs   # gera os PNGs (npm run icons)
public/
└── privacidade.html # política de privacidade (link da tela de login do Google)
```

---

<p align="center"><i>Companheiro web do app <a href="https://github.com/mateusvpassos/arion">Arion</a>.</i></p>
