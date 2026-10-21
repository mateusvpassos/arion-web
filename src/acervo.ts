// Acervo geral (lib/cloud/acervo.dart no app): todas as músicas de quem usa o
// app. Cada documento é UMA versão (arranjo) de uma obra. A biblioteca/grupo
// usa CÓPIAS, que guardam de onde vieram (baseId/baseRev).
import { reactive, computed, watch } from 'vue';
import {
  collection, doc, getDocs, getDocsFromCache, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc,
  updateDoc, where, writeBatch, type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { cloud, eu, type Sugestao, type Versao } from './cloud';
import type { Song, RawSong } from './types';
import { songFromRaw, songToRaw } from './types';
import { podeEditar as pode, resumoMudancas } from './core';
import { uid } from './chordEngine';
import * as be from './backend';

export const acervo = reactive({
  musicas: {} as Record<string, Song>,
  confianca: {} as Record<string, string[]>,
  nomes: {} as Record<string, string>,
  sugestoes: [] as Sugestao[],
  carregou: false,
  erro: null as string | null,
});

const ultima = new Map<string, Song>();
let subs: Unsubscribe[] = [];

const falhou = (e: unknown) => {
  const code = (e as { code?: string }).code;
  acervo.erro = code === 'permission-denied'
    ? 'Sem permissão no acervo (regras do Firestore desatualizadas?).' : String((e as Error).message ?? e);
};

export const nomeDe = (email: string) =>
  email === eu.value ? cloud.user?.nome ?? email : acervo.nomes[email] || email.split('@')[0];

const ts = (v: any): Date | null => (v && typeof v.toDate === 'function' ? v.toDate() : null);

function lerSug(d: { id: string; data: () => Record<string, any> }): Sugestao {
  const j = d.data();
  return {
    id: d.id, songId: j.songId ?? '', titulo: j.titulo ?? '', song: songFromRaw(j.song ?? { id: '', title: '' }),
    base: j.base ?? 0, por: j.por ?? '', porNome: j.porNome ?? '', nota: j.nota ?? '', status: j.status ?? 'pendente',
    dono: j.dono ?? '', decididoPor: j.decididoPor ?? '', decididoPorNome: j.decididoPorNome ?? '',
    motivo: j.motivo ?? '', em: ts(j.em), decididoEm: ts(j.decididoEm), acervo: true,
  };
}

// liga/desliga com o login; só p/ quem está liberado (as regras negam o resto)
const quem = computed(() => (cloud.liberado === true ? eu.value : ''));
watch(quem, (email) => ligar(email), { immediate: true });

/** Reabre as leituras (ex.: regras publicadas depois de abrir a página). */
export function religar() {
  acervo.erro = null;
  ligar(quem.value);
}

let geracao = 0;

function ligar(email: string) {
  subs.forEach((u) => u());
  subs = [];
  acervo.musicas = {};
  acervo.sugestoes = [];
  acervo.carregou = false;
  ultima.clear();
  if (!email || !db) return;
  ouvirMusicas(++geracao);
  subs.push(onSnapshot(collection(db, 'confianca'), (q) => {
    acervo.confianca = Object.fromEntries(q.docs.map((d) => [d.id, d.data().editores ?? []]));
  }, falhou));
  subs.push(onSnapshot(collection(db, 'pessoas'), (q) => {
    acervo.nomes = Object.fromEntries(q.docs.map((d) => [d.id, d.data().nome ?? '']));
  }, falhou));
  const pend = new Map<string, Sugestao>(), minhas = new Map<string, Sugestao>();
  const junta = () => {
    acervo.sugestoes = [...new Map([...minhas, ...pend]).values()]
      .sort((a, b) => (b.em?.getTime() ?? 0) - (a.em?.getTime() ?? 0));
  };
  const col = collection(db, 'acervoSugestoes');
  subs.push(onSnapshot(query(col, where('status', '==', 'pendente')), (q) => {
    pend.clear(); q.docs.forEach((d) => pend.set(d.id, lerSug(d))); junta();
  }, falhou));
  subs.push(onSnapshot(query(col, where('por', '==', email)), (q) => {
    minhas.clear(); q.docs.forEach((d) => minhas.set(d.id, lerSug(d))); junta();
  }, falhou));
  setDoc(doc(db, 'pessoas', email), { nome: cloud.user?.nome ?? email, visto: serverTimestamp() }).catch(falhou);
}

/** Lê do cache do navegador o que já tinha e só pede ao servidor o que mudou
 *  desde então (antes cada abertura lia o acervo inteiro: com muita gente
 *  usando, isso gastava a cota diária do Firebase). */
async function ouvirMusicas(g: number) {
  const col = collection(db!, 'acervo');
  const m: Record<string, Song> = {};
  let desde = '';
  try {
    const cache = await getDocsFromCache(col);
    if (g !== geracao) return;
    for (const d of cache.docs) {
      const j = d.data();
      if ((j.updatedAt ?? '') > desde) desde = j.updatedAt;
      if (j.apagada) continue;
      const s = songFromRaw(j as RawSong);
      m[s.id] = s;
      ultima.set(s.id, JSON.parse(JSON.stringify(s)));
    }
    if (Object.keys(m).length) acervo.musicas = { ...m };
  } catch { /* sem cache: lê tudo */ }
  // margem de 2 dias: o updatedAt vem do relógio de cada aparelho
  const t = desde ? new Date(desde) : null;
  const corte = t && !isNaN(t.getTime()) ? new Date(t.getTime() - 2 * 864e5).toISOString() : '';
  const q = corte ? query(col, where('updatedAt', '>', corte)) : col;
  if (g !== geracao) return;
  subs.push(onSnapshot(q, (snap) => {
    for (const ch of snap.docChanges()) {
      const j = ch.doc.data();
      // na consulta "o que mudou", sair do filtro não é apagar
      if (j.apagada || (ch.type === 'removed' && !corte)) { delete m[ch.doc.id]; continue; }
      if (ch.type === 'removed') continue;
      const s = songFromRaw(j as RawSong);
      m[s.id] = s;
      if (!ch.doc.metadata.hasPendingWrites) ultima.set(s.id, JSON.parse(JSON.stringify(s)));
    }
    acervo.musicas = { ...m };
    acervo.carregou = true;
    acervo.erro = null;
  }, falhou));
}

export const ligado = computed(() => !!eu.value && cloud.liberado === true);
/** entrou com o Google mas ainda não foi liberado p/ usar a nuvem */
export const esperandoLiberacao = computed(() => !!eu.value && cloud.liberado === false);

// ---------------- obras e versões ----------------

export const obraDe = (s: Song) => s.obra || s.id;
export const rotulo = (s: Song) => s.nomeVersao || 'Original';

/** obra -> versões (a original primeiro) */
export const obras = computed(() => {
  const m: Record<string, Song[]> = {};
  for (const s of Object.values(acervo.musicas)) (m[obraDe(s)] ??= []).push(s);
  for (const l of Object.values(m))
    l.sort((a, b) => (a.id === obraDe(a) ? -1 : b.id === obraDe(b) ? 1 : a.nomeVersao.localeCompare(b.nomeVersao)));
  return m;
});

/** versão do acervo -> minha cópia dela na biblioteca */
export const copias = computed(() => {
  const m = new Map<string, Song>();
  for (const s of be.songs.value) if (s.baseId) m.set(s.baseId, s);
  return m;
});

/** Minha cópia de qualquer versão da obra (a que eu toco), se houver. */
export const copiaDaObra = (obra: string) =>
  (obras.value[obra] ?? []).map((v) => copias.value.get(v.id)).find((c): c is Song => !!c);

export const podeEditarA = (s: Song) => pode(eu.value, s.dono, s.editores, acervo.confianca);
export const souDonoA = (s: Song) => s.dono === eu.value;

const limpa = (s: Song): Song => JSON.parse(JSON.stringify(s));

/** Grava a versão + uma revisão no histórico, no mesmo lote. */
export function salvarA(s: Song, acao?: string) {
  if (!db || !eu.value) return;
  const antes = ultima.get(s.id);
  const nova = !acervo.musicas[s.id];
  const out: Song = {
    ...limpa(s),
    dono: s.dono || eu.value,
    donoNome: s.dono ? s.donoNome : cloud.user!.nome,
    versao: (antes?.versao ?? s.versao) + 1,
    por: eu.value, porNome: cloud.user!.nome, baseId: '', baseRev: 0,
    updatedAt: new Date().toISOString(),
  };
  const ref = doc(db, 'acervo', out.id);
  const b = writeBatch(db);
  b.set(ref, { ...songToRaw(out), apagada: false });
  b.set(doc(collection(ref, 'versoes')), {
    n: out.versao, song: songToRaw(out), por: eu.value, porNome: cloud.user!.nome,
    em: serverTimestamp(), acao: acao ?? (nova ? 'criou' : 'editou'),
    resumo: antes ? resumoMudancas(antes, out) : [],
  });
  acervo.musicas = { ...acervo.musicas, [out.id]: out };
  ultima.set(out.id, limpa(out));
  b.commit().catch(falhou);
  return out;
}

/** Publica uma música da biblioteca no acervo; a cópia passa a apontar p/ ela. */
export function publicar(local: Song, nomeVersao = '', obra = ''): Song {
  const id = acervo.musicas[local.id] || obra ? uid() : local.id;
  const v = salvarA({
    ...limpa(local), id, obra: obra && obra !== id ? obra : '', nomeVersao,
    dono: '', donoNome: '', editores: [], versao: 0, scrollSpeed: 0,
  }, 'publicou')!;
  be.salvarCampos(local, { baseId: id, baseRev: v.versao });
  return v;
}

export function novaVersao(base: Song, nomeVersao: string): Song {
  return salvarA({
    ...limpa(base), id: uid(), obra: obraDe(base), nomeVersao,
    dono: '', donoNome: '', editores: [], versao: 0,
  }, `criou a versão "${nomeVersao}" a partir de "${rotulo(base)}"`)!;
}

export const naoPublicadas = computed(() => be.songs.value.filter((s) =>
  (!s.baseId || !acervo.musicas[s.baseId]) && (!s.dono || s.dono === eu.value)));

// minhas músicas vão sozinhas p/ o acervo (como no app), quando acervo e
// grupo já carregaram — antes disso tudo pareceria "não publicado"
let publicando = false;
watch(() => [acervo.carregou, cloud.carregou, naoPublicadas.value.length] as const, ([a, c, n]) => {
  if (publicando || !a || !c || !n) return;
  publicando = true;
  try { for (const s of [...naoPublicadas.value]) publicar(s); } finally { publicando = false; }
});

// ---------------- biblioteca <-> acervo ----------------

export function puxar(v: Song): Song {
  const ja = be.songs.value.find((s) => s.baseId === v.id);
  if (ja) return ja;
  const c: Song = {
    ...limpa(v), id: be.songById(v.id) ? uid() : v.id,
    dono: '', donoNome: '', editores: [], versao: 0, por: '', porNome: '',
    baseId: v.id, baseRev: v.versao,
  };
  be.salvarSong(c);
  return c;
}

export const baseDe = (local: Song) => (local.baseId ? acervo.musicas[local.baseId] : undefined);
export const temNovidade = (local: Song) => {
  const b = baseDe(local);
  return !!b && b.versao > local.baseRev;
};

export function atualizarDoAcervo(local: Song) {
  const b = baseDe(local);
  if (!b) return;
  be.salvarSong({
    ...limpa(b), id: local.id, dono: local.dono, donoNome: local.donoNome, editores: [...local.editores],
    versao: local.versao, por: local.por, porNome: local.porNome, scrollSpeed: local.scrollSpeed,
    baseId: b.id, baseRev: b.versao,
  });
}

// ---------------- sugestões, revisões, permissões ----------------

export const paraDecidirA = computed(() => acervo.sugestoes.filter((x) => {
  if (x.status !== 'pendente' || x.por === eu.value) return false;
  const s = acervo.musicas[x.songId];
  return !!s && podeEditarA(s);
}));
export const minhasA = computed(() => acervo.sugestoes.filter((x) => x.por === eu.value));

export async function sugerirA(proposta: Song, nota = '') {
  const atual = acervo.musicas[proposta.id];
  setDoc(doc(collection(db!, 'acervoSugestoes')), {
    songId: proposta.id, titulo: `${proposta.title} (${rotulo(atual ?? proposta)})`, song: songToRaw(proposta),
    base: atual?.versao ?? 0, dono: atual?.dono ?? '', por: eu.value, porNome: cloud.user!.nome,
    nota, em: serverTimestamp(), status: 'pendente',
  }).catch(falhou);
}

export function aceitarA(x: Sugestao) {
  const a = acervo.musicas[x.songId];
  if (!a || !podeEditarA(a)) return;
  salvarA({ ...x.song, id: a.id, obra: a.obra, nomeVersao: a.nomeVersao, dono: a.dono, donoNome: a.donoNome,
    editores: a.editores, versao: a.versao }, `aceitou sugestão de ${x.porNome || x.por}`);
  decidir(x, 'aceita');
}
export const recusarA = (x: Sugestao, motivo = '') => decidir(x, 'recusada', motivo);
function decidir(x: Sugestao, status: string, motivo = '') {
  updateDoc(doc(db!, 'acervoSugestoes', x.id), {
    status, decididoPor: eu.value, decididoPorNome: cloud.user!.nome, decididoEm: serverTimestamp(), motivo,
  }).catch(falhou);
}
export function cancelarA(x: Sugestao) {
  updateDoc(doc(db!, 'acervoSugestoes', x.id), { status: 'cancelada', decididoEm: serverTimestamp() }).catch(falhou);
}

export async function revisoesA(id: string): Promise<Versao[]> {
  const q = await getDocs(query(collection(doc(db!, 'acervo', id), 'versoes'), orderBy('n', 'desc'), limit(100)));
  return q.docs.map((d) => {
    const j = d.data();
    return { id: d.id, n: j.n ?? 0, song: songFromRaw(j.song), por: j.por ?? '', porNome: j.porNome ?? '',
      acao: j.acao ?? '', em: ts(j.em), resumo: j.resumo ?? [] };
  });
}

export function restaurarA(atual: Song, v: Versao) {
  salvarA({ ...v.song, id: atual.id, obra: atual.obra, nomeVersao: atual.nomeVersao, dono: atual.dono,
    donoNome: atual.donoNome, editores: atual.editores, versao: atual.versao }, `voltou para a revisão ${v.n}`);
}

export function setEditoresA(s: Song, emails: string[]) {
  if (!souDonoA(s)) return;
  updateDoc(doc(db!, 'acervo', s.id), { editores: emails }).catch(falhou);
}
