// Portas de lib/core/{search,diff}.dart, transposeSong e o resumo de mudanças
// (models/audit.dart) — mesmo comportamento do app.
import type { Song, Section } from './types';
import { transposeChord, cifraEmCima } from './chordEngine';

// ---------------- transposição ----------------

const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

export function transposeSong(song: Song, steps: number): Song {
  if (steps === 0) return song;
  const key = song.key || 'C';
  const useFlat = FLAT_KEYS.has(transposeChord(key, steps, true));
  const out: Song = JSON.parse(JSON.stringify(song));
  out.key = transposeChord(key, steps, useFlat);
  for (const sec of out.sections)
    for (const ln of sec.lines)
      for (const c of ln.chords) c.sym = transposeChord(c.sym, steps, useFlat);
  return out;
}

// ---------------- busca ----------------

const DE = 'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ';
const PARA = 'aaaaaaeeeeiiiiooooouuuucnyy';

export function fold(s: string): string {
  let out = '';
  for (const ch of s.toLowerCase()) {
    const i = DE.indexOf(ch);
    out += i >= 0 ? PARA[i] : ch;
  }
  return out;
}

export interface SongHit { song: Song; snippet?: string }

/** Título/artista/tag primeiro; depois quem só tem o trecho na letra. */
export function searchSongs(songs: Song[], query: string): SongHit[] {
  const q = fold(query.trim());
  if (!q) return songs.map((song) => ({ song }));
  const words = q.split(/\s+/);
  const porNome: SongHit[] = [], porLetra: SongHit[] = [];
  for (const s of songs) {
    const meta = fold(`${s.title} ${s.artist} ${s.tags.join(' ')}`);
    if (words.every((w) => meta.includes(w))) {
      porNome.push({ song: s });
      continue;
    }
    outer: for (const sec of s.sections)
      for (const l of sec.lines)
        if (fold(l.lyric).includes(q)) {
          porLetra.push({ song: s, snippet: l.lyric.trim() });
          break outer;
        }
  }
  return [...porNome, ...porLetra];
}

// ---------------- comparação ----------------

export interface DiffLine { text: string; tipo: number } // 0 igual, 1 entrou, -1 saiu

export function diffLinhas(antes: string, depois: string): DiffLine[] {
  const a = antes.split('\n'), b = depois.split('\n');
  const n = a.length, m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ text: a[i], tipo: 0 }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) out.push({ text: a[i++], tipo: -1 });
    else out.push({ text: b[j++], tipo: 1 });
  }
  while (i < n) out.push({ text: a[i++], tipo: -1 });
  while (j < m) out.push({ text: b[j++], tipo: 1 });
  return out;
}

/** Só o que mudou, com [contexto] linhas em volta (null = trecho escondido). */
export function diffResumo(d: DiffLine[], contexto = 2): (DiffLine | null)[] {
  const mostra = new Array<boolean>(d.length).fill(false);
  d.forEach((x, k) => {
    if (x.tipo === 0) return;
    for (let c = k - contexto; c <= k + contexto; c++) if (c >= 0 && c < d.length) mostra[c] = true;
  });
  const out: (DiffLine | null)[] = [];
  let pulou = false;
  d.forEach((x, k) => {
    if (mostra[k]) { if (pulou) out.push(null); out.push(x); pulou = false; }
    else pulou = true;
  });
  if (pulou && out.length) out.push(null);
  return out;
}

// acorde em cima da letra: é o que se compara e se mostra
export const textoDa = (s: Song) => cifraEmCima(s.sections);

function hash(s: Song): string {
  return JSON.stringify(s.sections.map((sec) => [sec.name, sec.lines.map((l) => [l.lyric, l.chords])]));
}

/** "Tom: C → D", "Cifra alterada"... (mesmo texto do app). */
export function resumoMudancas(a: Song, b: Song): string[] {
  const d: string[] = [];
  const cmp = (label: string, x: unknown, y: unknown) => { if (x !== y) d.push(`${label}: ${x} → ${y}`); };
  const vazio = (v: string) => (v ? v : '—');
  cmp('Título', a.title, b.title);
  cmp('Artista', vazio(a.artist), vazio(b.artist));
  cmp('Tom', a.key, b.key);
  cmp('Capo', a.capo, b.capo);
  cmp('BPM', a.bpm, b.bpm);
  cmp('Tags', vazio([...a.tags].sort().join(', ')), vazio([...b.tags].sort().join(', ')));
  cmp('Tempos', vazio(a.tempos.join(', ')), vazio(b.tempos.join(', ')));
  cmp('Momentos', vazio(a.momentos.join(', ')), vazio(b.momentos.join(', ')));
  if (a.notes !== b.notes)
    d.push(a.notes.length <= 60 && b.notes.length <= 60
      ? `Anotações: ${vazio(a.notes)} → ${vazio(b.notes)}`
      : 'Anotações alteradas');
  if (hash(a) !== hash(b)) {
    const la = a.sections.reduce((n, s) => n + s.lines.length, 0);
    const lb = b.sections.reduce((n, s) => n + s.lines.length, 0);
    d.push(la === lb ? 'Cifra alterada' : `Cifra alterada (${la} → ${lb} linhas)`);
  }
  return d;
}

// ---------------- permissão (espelho de firebase/firestore.rules) ----------------

export function podeEditar(eu: string, dono: string, editores: string[],
  confianca: Record<string, string[]>): boolean {
  if (!eu) return false;
  if (!dono || dono === eu) return true;
  return editores.includes(eu) || (confianca[dono]?.includes(eu) ?? false);
}

// ---------------- só letra ----------------

/** Seções sem as linhas que só têm acorde (intro, solo) e sem as que ficaram vazias. */
export function soLetra(song: Song): Section[] {
  const out: Section[] = [];
  for (const sec of song.sections) {
    const linhas: { lyric: string; chords: [] }[] = [];
    for (const l of sec.lines) {
      const t = l.lyric.trim();
      if (!t && l.chords.length) continue;
      if (!t && (!linhas.length || !linhas[linhas.length - 1].lyric)) continue;
      linhas.push({ lyric: t, chords: [] });
    }
    while (linhas.length && !linhas[linhas.length - 1].lyric) linhas.pop();
    if (linhas.length) out.push({ name: sec.name, lines: linhas });
  }
  return out;
}

export const isRefrao = (name: string) => /refr|chorus|coro/i.test(name);

export function fmtQuando(d: Date | string | null | undefined): string {
  if (!d) return 'agora';
  const l = typeof d === 'string' ? new Date(d) : d;
  const two = (v: number) => String(v).padStart(2, '0');
  return `${two(l.getDate())}/${two(l.getMonth() + 1)}/${l.getFullYear()} ${two(l.getHours())}:${two(l.getMinutes())}`;
}

export function fmtData(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const two = (v: number) => String(v).padStart(2, '0');
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`;
}
