// Grupo compartilhado no Firestore — mesmo modelo do app (lib/cloud/cloud_state.dart):
// quem cria é o dono, os outros sugerem, toda gravação vira uma versão.
import { reactive, computed } from 'vue';
import {
  GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signInWithPopup, signOut, updateProfile,
  type User,
} from 'firebase/auth';
import {
  arrayRemove, arrayUnion, collection, doc, getDocs, limit, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where, writeBatch, type Timestamp, type Unsubscribe,
} from 'firebase/firestore';
import { auth, db, disponivel } from './firebase';
export { disponivel };
import type { Song, Setlist, RawSong, RawSetlist } from './types';
import { songFromRaw, songToRaw, setlistFromRaw, setlistToRaw } from './types';
import { podeEditar as pode, resumoMudancas } from './core';

export interface Grupo { id: string; nome: string; dono: string; membros: string[] }

export interface Sugestao {
  id: string; songId: string; titulo: string; song: Song; base: number;
  por: string; porNome: string; nota: string; status: string; dono: string;
  decididoPor: string; decididoPorNome: string; motivo: string;
  em: Date | null; decididoEm: Date | null;
  /** sugestão p/ o acervo geral (não p/ o grupo) */
  acervo?: boolean;
}

export interface Versao {
  id: string; n: number; song: Song; por: string; porNome: string; acao: string;
  em: Date | null; resumo: string[];
}

const ts = (v: unknown): Date | null =>
  v && typeof (v as Timestamp).toDate === 'function' ? (v as Timestamp).toDate() : null;

const PREF = 'mymusic.grupo';
// cada aba lembra o grupo escolhido (preferência deste navegador)
function lerPref(): string { try { return localStorage.getItem(PREF) ?? ''; } catch { return ''; } }
function gravarPref(id: string) { try { localStorage.setItem(PREF, id); } catch { /* sem storage */ } }

export const cloud = reactive({
  disponivel,
  user: null as { email: string; nome: string } | null,
  grupos: [] as Grupo[],
  grupo: null as Grupo | null,
  songs: [] as Song[],
  setlists: [] as Setlist[],
  confianca: {} as Record<string, string[]>,
  nomes: {} as Record<string, string>,
  sugestoes: [] as Sugestao[],
  carregou: false,
  erro: null as string | null,
});

export const ativa = computed(() => !!cloud.user && !!cloud.grupo);
export const eu = computed(() => cloud.user?.email ?? '');
export const souDonoDoGrupo = computed(() => !!cloud.grupo && cloud.grupo.dono === eu.value);

export function nomeDe(email: string): string {
  if (!email) return '';
  if (email === eu.value) return cloud.user?.nome ?? email;
  return cloud.nomes[email] || email.split('@')[0];
}

const naNuvem = { songs: new Set<string>(), sets: new Set<string>() };
const ultima = new Map<string, Song>(); // última versão vinda da nuvem (p/ resumo da mudança)
let subs: Unsubscribe[] = [];
let subGrupos: Unsubscribe | null = null;

function falhou(e: unknown) {
  const code = (e as { code?: string }).code;
  cloud.erro = code === 'permission-denied'
    ? 'Sem permissão para essa mudança — ela foi desfeita.'
    : String((e as Error).message ?? e);
}

// ---------------- login ----------------

if (auth) {
  onAuthStateChanged(auth, (u: User | null) => {
    cloud.user = u?.email
      ? { email: u.email.toLowerCase(), nome: u.displayName || u.email.split('@')[0] }
      : null;
    ouvirGrupos();
  });
}

export async function entrar() {
  if (!auth) return;
  cloud.erro = null;
  try {
    const r = await signInWithPopup(auth, new GoogleAuthProvider());
    if (!r.user.displayName && r.user.email) {
      await updateProfile(r.user, { displayName: r.user.email.split('@')[0] });
    }
  } catch (e) { falhou(e); }
}

/** Só no emulador do Firebase: entra com qualquer e-mail (sem Google). */
export async function entrarTeste(email: string, nome: string) {
  if (!auth) return;
  const e = email.trim().toLowerCase();
  const cred = GoogleAuthProvider.credential(JSON.stringify({ sub: e, email: e, email_verified: true, name: nome }));
  const r = await signInWithCredential(auth, cred);
  if (!r.user.displayName) {
    await updateProfile(r.user, { displayName: nome });
    cloud.user = { email: e, nome };
  }
}

export async function sair() {
  if (!auth) return;
  pararGrupo();
  gravarPref('');
  await signOut(auth);
}

// ---------------- grupos ----------------

function ouvirGrupos() {
  subGrupos?.();
  subGrupos = null;
  if (!cloud.user || !db) { pararGrupo(); cloud.grupos = []; return; }
  subGrupos = onSnapshot(
    query(collection(db, 'grupos'), where('membros', 'array-contains', eu.value)),
    (q) => {
      // grupo recém-criado ainda não confirmado: abrir já daria "sem permissão"
      if (q.metadata.hasPendingWrites) return;
      // sem grupo nenhum (confirmado pelo servidor): cria a biblioteca pessoal
      if (!q.docs.length && !q.metadata.fromCache && !criando) {
        criando = true;
        criarGrupo(`Biblioteca de ${cloud.user!.nome}`).finally(() => { criando = false; });
        return;
      }
      cloud.grupos = q.docs.map((d) => ({
        id: d.id,
        nome: d.data().nome ?? '',
        dono: d.data().dono ?? '',
        membros: d.data().membros ?? [],
      })).sort((a, b) => a.nome.localeCompare(b.nome));
      const atual = cloud.grupo && cloud.grupos.find((g) => g.id === cloud.grupo!.id);
      if (cloud.grupo && !atual) pararGrupo(); // tiraram do grupo
      else if (atual) cloud.grupo = atual;
      else {
        const salvo = cloud.grupos.find((g) => g.id === lerPref());
        const g = salvo ?? (cloud.grupos.length === 1 ? cloud.grupos[0] : null);
        if (g) abrirGrupo(g);
      }
    },
    falhou,
  );
}

let criando = false;

export async function criarGrupo(nome: string) {
  if (!db || !cloud.user) return;
  const ref = doc(collection(db, 'grupos'));
  // espera o servidor: ler o grupo antes dele existir lá dá "permission denied"
  try {
    await setDoc(ref, { nome, dono: eu.value, membros: [eu.value], criadoEm: serverTimestamp() });
  } catch (e) { falhou(e); return; }
  abrirGrupo({ id: ref.id, nome, dono: eu.value, membros: [eu.value] });
}

export function escolherGrupo(g: Grupo) {
  if (cloud.grupo?.id === g.id) return;
  pararGrupo();
  abrirGrupo(g);
}

const gRef = () => doc(db!, 'grupos', cloud.grupo!.id);
const col = (nome: string) => collection(db!, 'grupos', cloud.grupo!.id, nome);

export async function convidar(email: string) {
  const e = email.trim().toLowerCase();
  if (!cloud.grupo || !e || cloud.grupo.membros.includes(e)) return;
  updateDoc(gRef(), { membros: arrayUnion(e) }).catch(falhou);
}

export async function remover(email: string) {
  if (!cloud.grupo || email === cloud.grupo.dono) return;
  updateDoc(gRef(), { membros: arrayRemove(email) }).catch(falhou);
}

export async function setConfianca(emails: string[]) {
  if (!cloud.user || !db) return;
  // vale p/ o acervo geral e p/ o grupo
  setDoc(doc(db, 'confianca', eu.value), { editores: emails }).catch(falhou);
  if (!ativa.value) return;
  setDoc(doc(col('confianca'), eu.value), { editores: emails }).catch(falhou);
}

/** Só campos de ligação (de qual versão do acervo veio), sem revisão nova. */
export function setCampos(s: Song, campos: Record<string, unknown>) {
  if (!ativa.value || !naNuvem.songs.has(s.id) || !podeEditarSong(s)) return;
  updateDoc(doc(col('musicas'), s.id), campos).catch(falhou);
}

// leitura negada logo após criar/entrar no grupo (regras ainda não veem o
// membro): tenta de novo algumas vezes antes de mostrar erro, como o app
let tentativas = 0, retryT = 0;
function erroOuvinte(e: unknown) {
  const g = cloud.grupo;
  if ((e as { code?: string }).code === 'permission-denied' && g && tentativas < 4) {
    clearTimeout(retryT);
    retryT = window.setTimeout(() => { if (cloud.grupo?.id === g.id) abrirGrupo(g, true); }, 1000 * 2 ** tentativas++);
    return;
  }
  falhou(e);
}

function abrirGrupo(g: Grupo, retentativa = false) {
  if (!retentativa) tentativas = 0;
  if (cloud.grupo?.id === g.id && subs.length && !retentativa) { cloud.grupo = g; return; }
  subs.forEach((u) => u());
  subs = [];
  cloud.grupo = g;
  cloud.carregou = false;
  gravarPref(g.id);
  subs.push(onSnapshot(col('musicas'), (q) => {
    const vivos: Song[] = [];
    for (const d of q.docs) {
      naNuvem.songs.add(d.id);
      const j = d.data();
      if (j.apagada) continue;
      const s = songFromRaw(j as RawSong);
      if (!d.metadata.hasPendingWrites) ultima.set(d.id, JSON.parse(JSON.stringify(s)));
      vivos.push(s);
    }
    cloud.songs = vivos;
    cloud.carregou = true;
    tentativas = 0;
  }, erroOuvinte));
  subs.push(onSnapshot(col('repertorios'), (q) => {
    const vivos: Setlist[] = [];
    for (const d of q.docs) {
      naNuvem.sets.add(d.id);
      if (!d.data().apagada) vivos.push(setlistFromRaw(d.data() as RawSetlist));
    }
    cloud.setlists = vivos;
  }, erroOuvinte));
  subs.push(onSnapshot(col('confianca'), (q) => {
    cloud.confianca = Object.fromEntries(q.docs.map((d) => [d.id, d.data().editores ?? []]));
  }, erroOuvinte));
  subs.push(onSnapshot(col('pessoas'), (q) => {
    cloud.nomes = Object.fromEntries(q.docs.map((d) => [d.id, d.data().nome ?? '']));
  }, erroOuvinte));
  // pendentes (p/ quem decide) + as minhas, de qualquer situação
  const pend = new Map<string, Sugestao>(), minhas = new Map<string, Sugestao>();
  const junta = () => {
    cloud.sugestoes = [...new Map([...minhas, ...pend]).values()]
      .sort((a, b) => (b.em?.getTime() ?? 0) - (a.em?.getTime() ?? 0));
  };
  const lerSug = (d: { id: string; data: () => Record<string, any> }): Sugestao => {
    const j = d.data();
    return {
      id: d.id, songId: j.songId ?? '', titulo: j.titulo ?? '',
      song: songFromRaw(j.song ?? { id: '', title: '' }), base: j.base ?? 0,
      por: j.por ?? '', porNome: j.porNome ?? '', nota: j.nota ?? '', status: j.status ?? 'pendente',
      dono: j.dono ?? '', decididoPor: j.decididoPor ?? '', decididoPorNome: j.decididoPorNome ?? '',
      motivo: j.motivo ?? '', em: ts(j.em), decididoEm: ts(j.decididoEm),
    };
  };
  subs.push(onSnapshot(query(col('sugestoes'), where('status', '==', 'pendente')), (q) => {
    pend.clear(); q.docs.forEach((d) => pend.set(d.id, lerSug(d))); junta();
  }, erroOuvinte));
  subs.push(onSnapshot(query(col('sugestoes'), where('por', '==', eu.value)), (q) => {
    minhas.clear(); q.docs.forEach((d) => minhas.set(d.id, lerSug(d))); junta();
  }, erroOuvinte));
  setDoc(doc(col('pessoas'), eu.value), { nome: cloud.user!.nome, visto: serverTimestamp() })
    .catch(falhou);
}

function pararGrupo() {
  subs.forEach((u) => u());
  subs = [];
  cloud.grupo = null;
  cloud.songs = [];
  cloud.setlists = [];
  cloud.sugestoes = [];
  cloud.confianca = {};
  naNuvem.songs.clear();
  naNuvem.sets.clear();
  ultima.clear();
  cloud.carregou = false;
}

// ---------------- permissões ----------------

export const podeEditarSong = (s: Song) =>
  !ativa.value || pode(eu.value, s.dono, s.editores, cloud.confianca);
export const podeEditarSetlist = (sl: Setlist) =>
  !ativa.value || pode(eu.value, sl.dono, sl.editores, cloud.confianca);
export const souDono = (dono: string) => !ativa.value || !dono || dono === eu.value;

export async function setEditoresSong(s: Song, emails: string[]) {
  if (!souDono(s.dono)) return;
  updateDoc(doc(col('musicas'), s.id), { editores: emails }).catch(falhou);
}

export async function setEditoresSetlist(sl: Setlist, emails: string[]) {
  if (!souDono(sl.dono)) return;
  updateDoc(doc(col('repertorios'), sl.id), { editores: emails }).catch(falhou);
}

// ---------------- gravar ----------------

/** Grava a música + um retrato no histórico, no mesmo lote. */
export function putSong(s: Song, acao?: string) {
  if (!ativa.value || !podeEditarSong(s)) return;
  const nova = !naNuvem.songs.has(s.id);
  const antes = ultima.get(s.id);
  const out: Song = {
    ...s,
    dono: s.dono || eu.value,
    donoNome: s.dono ? s.donoNome : cloud.user!.nome,
    versao: (antes?.versao ?? s.versao) + 1,
    por: eu.value,
    porNome: cloud.user!.nome,
    updatedAt: new Date().toISOString(),
  };
  const ref = doc(col('musicas'), s.id);
  const b = writeBatch(db!);
  b.set(ref, { ...songToRaw(out), apagada: false });
  b.set(doc(collection(ref, 'versoes')), {
    n: out.versao, song: songToRaw(out), por: eu.value, porNome: cloud.user!.nome,
    em: serverTimestamp(), acao: acao ?? (nova ? 'criou' : 'editou'),
    resumo: antes ? resumoMudancas(antes, out) : [],
  });
  naNuvem.songs.add(s.id);
  b.commit().catch(falhou);
}

export function deleteSong(id: string) {
  updateDoc(doc(col('musicas'), id), {
    apagada: true, apagadaPor: eu.value, apagadaPorNome: cloud.user!.nome,
    updatedAt: new Date().toISOString(),
  }).catch(falhou);
}

export function putSetlist(sl: Setlist) {
  if (!ativa.value || !podeEditarSetlist(sl)) return;
  const out: Setlist = {
    ...sl,
    dono: sl.dono || eu.value,
    donoNome: sl.dono ? sl.donoNome : cloud.user!.nome,
    por: eu.value,
    porNome: cloud.user!.nome,
    updatedAt: new Date().toISOString(),
  };
  naNuvem.sets.add(sl.id);
  setDoc(doc(col('repertorios'), sl.id), { ...setlistToRaw(out), apagada: false }).catch(falhou);
}

export function deleteSetlist(id: string) {
  updateDoc(doc(col('repertorios'), id), {
    apagada: true, apagadaPor: eu.value, apagadaPorNome: cloud.user!.nome,
    updatedAt: new Date().toISOString(),
  }).catch(falhou);
}

/** Migração: manda p/ o grupo o que ainda não está nele (quem manda vira o dono). */
export function enviar(songs: Song[], setlists: Setlist[]): { songs: number; sets: number } {
  let ns = 0, nr = 0;
  for (const s of songs) if (!naNuvem.songs.has(s.id)) { putSong({ ...s, dono: '', donoNome: '', editores: [] }); ns++; }
  for (const sl of setlists) if (!naNuvem.sets.has(sl.id)) { putSetlist({ ...sl, dono: '', donoNome: '', editores: [] }); nr++; }
  return { songs: ns, sets: nr };
}

export const naoEstaoNoGrupo = (songs: Song[], setlists: Setlist[]) => ({
  songs: songs.filter((s) => !naNuvem.songs.has(s.id)).length,
  sets: setlists.filter((s) => !naNuvem.sets.has(s.id)).length,
});

// ---------------- sugestões ----------------

export const paraDecidir = computed(() => cloud.sugestoes.filter((x) => {
  if (x.status !== 'pendente' || x.por === eu.value) return false;
  const s = cloud.songs.find((m) => m.id === x.songId);
  return !!s && podeEditarSong(s);
}));
export const minhas = computed(() => cloud.sugestoes.filter((x) => x.por === eu.value));

export async function sugerir(proposta: Song, nota = '') {
  const atual = cloud.songs.find((s) => s.id === proposta.id);
  setDoc(doc(col('sugestoes')), {
    songId: proposta.id, titulo: proposta.title, song: songToRaw(proposta),
    base: atual?.versao ?? 0, dono: atual?.dono ?? '', por: eu.value, porNome: cloud.user!.nome,
    nota, em: serverTimestamp(), status: 'pendente',
  }).catch(falhou);
}

export async function aceitar(x: Sugestao) {
  const atual = cloud.songs.find((s) => s.id === x.songId);
  if (!atual || !podeEditarSong(atual)) return;
  putSong({ ...x.song, dono: atual.dono, donoNome: atual.donoNome, editores: atual.editores, versao: atual.versao },
    `aceitou sugestão de ${x.porNome || x.por}`);
  decidir(x, 'aceita');
}

export const recusar = (x: Sugestao, motivo = '') => decidir(x, 'recusada', motivo);

function decidir(x: Sugestao, status: string, motivo = '') {
  updateDoc(doc(col('sugestoes'), x.id), {
    status, decididoPor: eu.value, decididoPorNome: cloud.user!.nome,
    decididoEm: serverTimestamp(), motivo,
  }).catch(falhou);
}

export function cancelar(x: Sugestao) {
  updateDoc(doc(col('sugestoes'), x.id), { status: 'cancelada', decididoEm: serverTimestamp() })
    .catch(falhou);
}

// ---------------- versões ----------------

export async function versoes(songId: string): Promise<Versao[]> {
  if (!ativa.value) return [];
  const q = await getDocs(query(collection(doc(col('musicas'), songId), 'versoes'),
    orderBy('n', 'desc'), limit(100)));
  return q.docs.map((d) => {
    const j = d.data();
    return {
      id: d.id, n: j.n ?? 0, song: songFromRaw(j.song), por: j.por ?? '', porNome: j.porNome ?? '',
      acao: j.acao ?? '', em: ts(j.em), resumo: j.resumo ?? [],
    };
  });
}

/** Volta p/ uma versão antiga (vira uma versão nova; nada se perde). */
export function restaurar(atual: Song, v: Versao) {
  putSong({ ...v.song, dono: atual.dono, donoNome: atual.donoNome, editores: atual.editores, versao: atual.versao },
    `voltou para a versão ${v.n}`);
}
