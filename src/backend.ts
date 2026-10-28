// As telas falam só com isto. Tudo fica no Firebase: a biblioteca é o grupo
// em uso (quem entra sem grupo ganha a "Biblioteca de <nome>" sozinho).
import { computed } from 'vue';
import * as nuvem from './cloud';
import { cloud, ativa } from './cloud';
import type { Song, Setlist } from './types';
import { emptyMeta } from './types';
import { uid } from './chordEngine';

export const modoNuvem = ativa;
export const songs = computed<Song[]>(() => cloud.songs);
export const setlists = computed<Setlist[]>(() => cloud.setlists);
export const pronto = ativa;

export const songById = (id: string) => songs.value.find((s) => s.id === id);
export const setlistById = (id: string) => setlists.value.find((s) => s.id === id);

export const podeEditarSong = nuvem.podeEditarSong;
export const podeEditarSetlist = nuvem.podeEditarSetlist;
export const souDono = nuvem.souDono;

const agora = () => new Date().toISOString();

/** Música nova ainda fora da lista — entra com salvarSong() ao confirmar. */
export function rascunhoSong(): Song {
  return {
    id: uid(), title: '', artist: '', key: 'C', capo: 0,
    sections: [], tags: [], notes: '', bpm: 0, scrollSpeed: 0,
    tempos: [], momentos: [], versao: 0, obra: '', nomeVersao: '', baseId: '', baseRev: 0,
    ...emptyMeta(), updatedAt: agora(),
  };
}

export function salvarSong(s: Song) {
  nuvem.putSong(s);
}

/** Muda campos de ligação (baseId/baseRev) sem contar como edição. */
export function salvarCampos(s: Song, campos: Partial<Song>) {
  Object.assign(s, campos);
  nuvem.setCampos(s, campos);
}

export function excluirSong(id: string) {
  nuvem.deleteSong(id);
  // tira dos meus repertórios também
  for (const sl of cloud.setlists)
    if (sl.songIds.includes(id) && nuvem.podeEditarSetlist(sl))
      nuvem.putSetlist({ ...sl, songIds: sl.songIds.filter((x) => x !== id) });
}

export function salvarSetlist(sl: Setlist) {
  nuvem.putSetlist(sl);
}

export function novoSetlist(name: string, date: string | null): Setlist {
  const sl: Setlist = {
    id: uid(), name, songIds: [], transpose: {}, moments: {}, date,
    ...emptyMeta(), updatedAt: agora(),
  };
  nuvem.putSetlist(sl);
  return sl;
}

export function excluirSetlist(id: string) {
  nuvem.deleteSetlist(id);
}

export function duplicarSong(s: Song): Song {
  const c: Song = {
    ...JSON.parse(JSON.stringify(s)), id: uid(), title: `${s.title} (cópia)`,
    ...emptyMeta(), versao: 0, baseId: '', baseRev: 0, updatedAt: agora(),
  };
  salvarSong(c);
  return c;
}

export function duplicarSetlist(sl: Setlist): Setlist {
  const c: Setlist = {
    ...JSON.parse(JSON.stringify(sl)), id: uid(), name: `${sl.name} (cópia)`,
    ...emptyMeta(), updatedAt: agora(),
  };
  nuvem.putSetlist(c);
  return c;
}
