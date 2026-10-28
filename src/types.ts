// Tipos do app + formato JSON IDÊNTICO ao app Flutter (chaves compactas).

export interface Chord { sym: string; idx: number }
export interface SongLine { lyric: string; chords: Chord[] }
export interface Section { name: string; lines: SongLine[] }

/** Campos da nuvem (grupo compartilhado). Vazios = só local. */
export interface CloudMeta {
  dono: string;
  donoNome: string;
  editores: string[];
  por: string;
  porNome: string;
}

export interface Song extends CloudMeta {
  id: string;
  title: string;
  artist: string;
  key: string;
  capo: number;
  sections: Section[];
  tags: string[];
  notes: string;
  bpm: number;
  /** px/s da auto-rolagem desta música; 0 = a das configurações */
  scrollSpeed: number;
  /** tempos litúrgicos (vazio = qualquer) e momentos da Missa */
  tempos: string[];
  momentos: string[];
  versao: number;
  /** acervo: a mesma obra pode ter várias versões (arranjos); vazio = é a própria */
  obra: string;
  nomeVersao: string;
  /** de qual versão do acervo esta cópia veio (e em que revisão) */
  baseId: string;
  baseRev: number;
  updatedAt: string; // ISO8601
}

export interface Setlist extends CloudMeta {
  id: string;
  name: string;
  songIds: string[];
  transpose: Record<string, number>;
  /** songId -> momento da Missa */
  moments: Record<string, string>;
  date: string | null;
  updatedAt: string;
}

export interface AppSettings {
  seedColor: number;
  dark: boolean;
  fontScale: number;
  scrollSpeed: number;
  pedalKeys: Record<string, number[]>;
}

export interface AppData {
  songs: Song[];
  setlists: Setlist[];
  settings: AppSettings;
}

// ---- JSON bruto (como gravado no backup / Firestore) ----
export interface RawChord { s: string; i: number }
export interface RawLine { l: string; c: RawChord[] }
export interface RawSection { n: string; l: RawLine[] }
interface RawMeta {
  dono?: string; donoNome?: string; editores?: string[]; por?: string; porNome?: string;
}
export interface RawSong extends RawMeta {
  id: string; title: string; artist?: string; key?: string; capo?: number;
  sections?: RawSection[]; tags?: string[]; notes?: string; bpm?: number; updatedAt?: string;
  scrollSpeed?: number; tempos?: string[]; momentos?: string[]; versao?: number;
  obra?: string; nomeVersao?: string; baseId?: string; baseRev?: number;
}
export interface RawSetlist extends RawMeta {
  id: string; name: string; songIds?: string[];
  transpose?: Record<string, number>; date?: string | null; updatedAt?: string;
  moments?: Record<string, string>;
}
export interface RawData {
  songs?: RawSong[];
  setlists?: RawSetlist[];
  settings?: AppSettings;
  /** histórico do app — o web só repassa */
  audit?: unknown[];
  /** lápides de exclusão: 'song:<id>' / 'setlist:<id>' -> ISO */
  deleted?: Record<string, string>;
}

function metaFromRaw(j: RawMeta): CloudMeta {
  return {
    dono: j.dono ?? '',
    donoNome: j.donoNome ?? '',
    editores: j.editores ?? [],
    por: j.por ?? '',
    porNome: j.porNome ?? '',
  };
}

// mesmas regras do app: só grava quando tem valor
function metaToRaw(m: CloudMeta): RawMeta {
  return {
    ...(m.dono ? { dono: m.dono } : {}),
    ...(m.donoNome ? { donoNome: m.donoNome } : {}),
    ...(m.editores.length ? { editores: m.editores } : {}),
    ...(m.por ? { por: m.por } : {}),
    ...(m.porNome ? { porNome: m.porNome } : {}),
  };
}

export function songFromRaw(j: RawSong): Song {
  return {
    id: j.id,
    title: j.title,
    artist: j.artist ?? '',
    key: j.key ?? 'C',
    capo: j.capo ?? 0,
    sections: (j.sections ?? []).map((s) => ({
      name: s.n,
      lines: (s.l ?? []).map((l) => ({
        lyric: l.l,
        chords: (l.c ?? []).map((c) => ({ sym: c.s, idx: c.i })),
      })),
    })),
    tags: j.tags ?? [],
    notes: j.notes ?? '',
    bpm: j.bpm ?? 0,
    scrollSpeed: j.scrollSpeed ?? 0,
    tempos: j.tempos ?? [],
    momentos: j.momentos ?? [],
    versao: j.versao ?? 0,
    obra: j.obra ?? '',
    nomeVersao: j.nomeVersao ?? '',
    baseId: j.baseId ?? '',
    baseRev: j.baseRev ?? 0,
    ...metaFromRaw(j),
    updatedAt: j.updatedAt ?? new Date().toISOString(),
  };
}

export function songToRaw(s: Song): RawSong {
  return {
    id: s.id,
    title: s.title,
    artist: s.artist,
    key: s.key,
    capo: s.capo,
    sections: s.sections.map((sec) => ({
      n: sec.name,
      l: sec.lines.map((l) => ({
        l: l.lyric,
        c: l.chords.map((c) => ({ s: c.sym, i: c.idx })),
      })),
    })),
    tags: s.tags,
    notes: s.notes,
    bpm: s.bpm,
    ...(s.scrollSpeed > 0 ? { scrollSpeed: s.scrollSpeed } : {}),
    ...(s.tempos.length ? { tempos: s.tempos } : {}),
    ...(s.momentos.length ? { momentos: s.momentos } : {}),
    ...metaToRaw(s),
    ...(s.versao > 0 ? { versao: s.versao } : {}),
    ...(s.obra ? { obra: s.obra } : {}),
    ...(s.nomeVersao ? { nomeVersao: s.nomeVersao } : {}),
    ...(s.baseId ? { baseId: s.baseId } : {}),
    ...(s.baseRev > 0 ? { baseRev: s.baseRev } : {}),
    updatedAt: s.updatedAt,
  };
}

export function setlistFromRaw(j: RawSetlist): Setlist {
  return {
    id: j.id,
    name: j.name,
    songIds: j.songIds ?? [],
    transpose: j.transpose ?? {},
    moments: j.moments ?? {},
    date: j.date ?? null,
    ...metaFromRaw(j),
    updatedAt: j.updatedAt ?? new Date().toISOString(),
  };
}

export function setlistToRaw(s: Setlist): RawSetlist {
  return {
    id: s.id, name: s.name, songIds: s.songIds,
    transpose: s.transpose,
    ...(Object.keys(s.moments).length ? { moments: s.moments } : {}),
    ...metaToRaw(s),
    date: s.date, updatedAt: s.updatedAt,
  };
}

export const emptyMeta = (): CloudMeta => ({
  dono: '', donoNome: '', editores: [], por: '', porNome: '',
});

export const defaultSettings = (): AppSettings => ({
  seedColor: 0xff3d5afe,
  dark: true,
  fontScale: 1.0,
  scrollSpeed: 28,
  pedalKeys: {},
});
