# 🎵 Arion — Editor Web

Editor leve (roda **local**, no navegador) para cadastrar **músicas** e **repertórios** e salvar direto no **Google Drive** — sincroniza automático com o app de tablet [**arion**](https://github.com/mateusvpassos/arion).

A ideia: configurar tudo no PC com teclado, salvar, e abrir pronto no tablet.

![Vue](https://img.shields.io/badge/Vue-3-42b883?logo=vuedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)
![Local](https://img.shields.io/badge/uso-local-lightgrey)

---

## ✨ O que faz

- **Músicas:** título, artista, tom, capo, **tags** e a cifra em texto
- **Importa cifra** colada no formato "acorde acima da letra" (Cifra Club) **ou** ChordPro `[G]letra` — com **prévia ao vivo**; `Tom:`, `Capo` e `{title:}` no texto preenchem os campos
- **Repertórios:** adicionar/remover, reordenar e **tom por música**
- **Mesmo visual e recursos do app**: tela da música (tom, capo, fonte, só letra, rolagem com velocidade por música), repertório com filtro por tags e "tocada há X", imprimir/PDF no tom do repertório e TXT de letras
- **Grupo compartilhado (Firebase)**: dono, **sugestões** (aceitar/recusar vendo a diferença), **histórico de versões** e voltar versão, **permissões**, atividade recente, e **trazer do Drive** para o grupo
- **Sem o grupo**: modo antigo — salva no Google Drive (pasta privada `appDataFolder`) e o tablet mescla
- Testar contra o emulador local do Firebase: `npm run dev:emu` (porta 4174; emulador em `arion/firebase`, `npm run emu`)

> O motor de cifras é uma **porta fiel** do app Flutter (`src/chordEngine.ts`), gerando o **mesmo formato JSON** — por isso web e tablet leem o mesmo arquivo.

---

## 🚀 Rodar (local)

Pré-requisito: Node.js.

```bash
npm install
npm run dev      # abre em http://localhost:4173
```

Ou só **duplo-clique em `start.bat`** (abre o navegador e liga o servidor; feche a janela para parar).

Build de produção:
```bash
npm run build    # gera dist/
```

---

## 🔐 Privacidade & segurança

- **Roda só no seu PC** (`localhost`) — não é hospedado, ninguém de fora acessa.
- Os dados ficam no **seu Drive**, acessíveis só com **login Google**. O app OAuth está em modo *Testing* — apenas o usuário de teste cadastrado consegue autenticar.
- O `client_id` no código é **público por design** (não é segredo) e não dá acesso a nada sem o login do dono.

---

## ☁️ Como o sync funciona

Web e tablet usam o **mesmo projeto Google Cloud**, então compartilham o mesmo `appDataFolder` do Drive:

```
Editor Web  ──salva──►  Drive (arion_data.json)  ◄──baixa──  App Tablet
```

Cada save atualiza o `updatedAt`; **dos dois lados** o salvar baixa o que está no Drive, mescla (a versão mais recente vence) e só então sobe — um não apaga o que o outro acabou de gravar. Exclusões viajam como "lápides" (`deleted` no JSON), então música apagada não ressuscita no próximo sync. Config e histórico do app passam intactos pelo web.

O parser (`src/chordEngine.ts`) é cópia do `chord_engine.dart` do app. Pra conferir que os dois dão o mesmo resultado:

```bash
# no repo do app
flutter test test/parser_parity_test.dart
# aqui
node scripts/parity.ts
```

### Configuração OAuth (uma vez)
- **OAuth Client tipo Web** no mesmo projeto do client Android (`333951307134`)
  - Origem JavaScript autorizada: `http://localhost:4173`
- **Google Drive API** ativada
- Escopo `.../auth/drive.appdata` + seu e-mail como **usuário de teste**

O `client_id` fica em [`src/config.ts`](src/config.ts).

---

## 🧱 Estrutura

```
src/
├── config.ts        # client_id, escopo, nome do arquivo
├── types.ts         # tipos + conversão p/ o JSON do app (chaves s/i/l/c/n)
├── chordEngine.ts   # parser/serialize/import de cifra (porta do Dart)
├── drive.ts         # login Google (GIS) + Drive REST (appDataFolder)
├── store.ts         # estado reativo + load/save + CRUD
└── App.vue          # UI (músicas, repertórios, editores)
```

---

<p align="center"><i>Companheiro web do app <a href="https://github.com/mateusvpassos/arion">arion</a>.</i></p>
