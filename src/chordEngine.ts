// Porta do chord_engine.dart — parser ChordPro + acorde-sobre-letra, serialize, import.
// Mudança lá tem que vir pra cá também (o app e o editor web gravam o mesmo JSON).
import type { Section, SongLine, Chord } from './types';

export interface SongMeta {
  title?: string;
  artist?: string;
  key?: string;
  capo?: number;
}

const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const ENHARM: Record<string, number> = { Cb: 11, Fb: 4, 'E#': 5, 'B#': 0 };

function noteId(n: string): number {
  const i = SHARP.indexOf(n);
  if (i >= 0) return i;
  const j = FLAT.indexOf(n);
  return j >= 0 ? j : ENHARM[n] ?? -1;
}

export function transposeNote(note: string, steps: number, useFlat: boolean): string {
  const i = noteId(note);
  if (i < 0) return note;
  const j = (((i + steps) % 12) + 12) % 12;
  return (useFlat ? FLAT : SHARP)[j];
}

// Raiz + qualidade + baixo opcional. O meio é preguiçoso e o baixo só conta
// se for uma NOTA: "D7/9" é tensão, "D/F#" é baixo.
const PARTS = /^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/;

// aceita sufixos em qualquer ordem: G7M, D9, D4, G7+, B7(4/9), A/C#, Cmaj7,
// D7/9 (tensão com barra), Bø, Cº...
const CHORD_TOK =
  /^[A-G][#b]?(?:maj|min|m|M|dim|aug|sus|add|º|°|ø|[0-9]+|[+\-]|[#b][0-9]+|\([^)]*\)|\/[A-G][#b]?|\/[#b+\-]?[0-9]+[+\-]?)*$/;

// marcações no meio das linhas de acorde: (2x), x2, bis, |, -, /, N.C., %
const ANNOT_TOK =
  /^(?:\(?\s*(?:\d+\s*[xX]|[xX]\s*\d+|bis|Bis|BIS)\s*\)?|\|+:?|:?\|+|[-–—]+|\/+|\.{2,}|%|N\.?C\.?)$/;

function isChord(t: string): boolean {
  return t.length > 0 && CHORD_TOK.test(t);
}
/** Acorde de verdade (não marcação tipo (2x), |, N.C.) — barra de acordes da tela. */
export const isChordSymbol = (t: string) => isChord(t);

function isAnnot(t: string): boolean {
  return t.length > 0 && ANNOT_TOK.test(t);
}

export function transposeChord(sym: string, steps: number, useFlat: boolean): string {
  if (!isChord(sym)) return sym;
  const m = PARTS.exec(sym);
  if (!m) return sym;
  const bass = m[3] ? '/' + transposeNote(m[3], steps, useFlat) : '';
  return transposeNote(m[1], steps, useFlat) + (m[2] ?? '') + bass;
}

// remove parêntese DESBALANCEADO de um token: "(D9"->"D9", "D4)"->"D4";
// mantém balanceados: "B7(4/9)" e "A7(13)" intactos.
function fixParens(t: string): string {
  if (t.startsWith('(') && !t.includes(')')) t = t.slice(1);
  if (t.endsWith(')') && !t.slice(0, -1).includes('(')) t = t.slice(0, -1);
  return t;
}

/** Linha só de acordes (e marcações), com pelo menos um acorde de verdade. */
function isChordLine(line: string): boolean {
  const toks = line.match(/\S+/g);
  if (!toks || toks.length === 0) return false;
  let temAcorde = false;
  for (const t of toks) {
    if (isAnnot(t)) continue;
    if (!isChord(fixParens(t))) return false;
    temAcorde = true;
  }
  return temAcorde;
}

function mergeChordLyric(chordLine: string, lyric: string): SongLine {
  const chords: Chord[] = [];
  let maxCol = 0;
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chordLine)) !== null) {
    chords.push({ sym: isAnnot(m[0]) ? m[0] : fixParens(m[0]), idx: m.index });
    if (m.index > maxCol) maxCol = m.index;
  }
  let lyr = lyric;
  if (lyr.length < maxCol) lyr = lyr.padEnd(maxCol);
  return { lyric: lyr, chords };
}

// ---- colchetes inline ([G]letra) ----

// "[Bis]", "[Fim]", "[Ad lib]" no meio da letra são texto, não acorde.
const PALAVRA = /^[A-Za-zÀ-ÿ][a-zà-ÿ]{2,}$/;
function bracketIsText(c: string): boolean {
  if (isChord(fixParens(c))) return false;
  return c.trim() === '' || /\s/.test(c) || PALAVRA.test(c);
}

function hasInlineChord(line: string): boolean {
  const re = /\[([^\]]*)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) if (!bracketIsText(m[1])) return true;
  return false;
}

export function parseLine(raw: string): SongLine {
  const chords: Chord[] = [];
  let lyric = '';
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === '[') {
      const end = raw.indexOf(']', i);
      if (end > i) {
        const c = raw.slice(i + 1, end);
        if (!bracketIsText(c)) {
          chords.push({ sym: c, idx: lyric.length });
          i = end + 1;
          continue;
        }
      }
    }
    lyric += raw[i];
    i++;
  }
  return { lyric, chords };
}

export function serializeLine(line: SongLine): string {
  const sorted = [...line.chords].sort((a, b) => a.idx - b.idx);
  let out = '';
  let pos = 0;
  for (const c of sorted) {
    const at = Math.max(0, Math.min(c.idx, line.lyric.length));
    out += line.lyric.slice(pos, at) + '[' + c.sym + ']';
    pos = at;
  }
  out += line.lyric.slice(pos);
  return out;
}

export function serializeSections(sections: Section[]): string {
  return sections
    .map((s) => {
      const head = s.name ? '#' + s.name + '\n' : '';
      return head + s.lines.map(serializeLine).join('\n');
    })
    .join('\n\n');
}

// ---- limpeza do texto colado ----

const INLINE_CHORD = /\[[A-G][#b]?[^\]]*\]/;
const SECTION_HEAD = /^\s*\[([^\]]+)\]\s*(.*)$/;
const HTML_TAG = /<[^>]*>/g;
const TAG_RESIDUE = /^[^<>]*>/;
const CC_TRAILING = /^\s*["']?>\s*(\S.*)$/;

// TAB vira espaço até a próxima parada de 4 colunas — igual nas duas linhas.
function expandTabs(s: string): string {
  if (!s.includes('\t')) return s;
  let b = '';
  for (const ch of s) b += ch === '\t' ? ' '.repeat(4 - (b.length % 4)) : ch;
  return b;
}

// Tags viram espaços p/ preservar a coluna do acorde; entidades decodificadas.
function stripTags(line: string): string {
  return expandTabs(
    line
      .replace(HTML_TAG, (m) => ' '.repeat(m.length))
      .replace(/&nbsp;/g, ' ')
      .replace(/ /g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"),
  );
}

// Rede de segurança: sobrou fragmento de tag antes de um acorde -> vira espaço.
function stripResidue(line: string): string {
  const m = TAG_RESIDUE.exec(line);
  if (!m) return line;
  const cand = ' '.repeat(m[0].length) + line.slice(m[0].length);
  return isChordLine(cand) ? cand : line;
}

// ---- seções escritas em texto ----

// "Refrão:", "REFRÃO", "1ª Parte", "Parte 2", "Primeira parte", "Intro: C G".
// Só com palavra-chave conhecida, p/ "E Jesus disse:" continuar letra.
const TEXT_HEAD = new RegExp(
  '^\\s*((?:(?:\\d+\\s*[ªºa°]?|primeira|segunda|terceira|quarta|quinta|sexta|' +
    's[ée]tima|[úu]ltima)\\s+)?' +
    '(?:intro(?:du[çc][ãa]o)?|refr[ãa]o|pr[ée][-\\s]?refr[ãa]o|coro|ponte|solo|' +
    'final|verso|estrofe|parte|interl[úu]dio|outro|chorus|verse|bridge|riff|pré|pre)' +
    '(?:\\s*\\d+)?(?:\\s*\\([^)]*\\))?)\\s*:?(.*)$',
  'i',
);

function textSection(line: string): [string, string] | null {
  const m = TEXT_HEAD.exec(line);
  if (!m) return null;
  const rest = m[2];
  if (rest.trim() !== '' && !isChordLine(rest)) return null;
  return [m[1].trim(), rest];
}

/** "[Refrão]" / "[Intro] C G". Não vale p/ "[|] [C] [|]" (linha ChordPro). */
function bracketSection(line: string): [string, string] | null {
  const m = SECTION_HEAD.exec(line);
  if (!m) return null;
  const name = m[1].trim();
  const rest = m[2];
  if (isChord(fixParens(name)) || isAnnot(name) || hasInlineChord(rest)) return null;
  return [name, rest];
}

function isSectionLine(l: string): boolean {
  return l.startsWith('#') || bracketSection(l) !== null || textSection(l) !== null;
}

// ---- metadados ----

const DIRECTIVE = /^\s*\{\s*([A-Za-z_]+)\s*(?::\s*([^}]*))?\}\s*$/;
const TOM_LINE = /^\s*tom\s*:\s*([A-G][#b]?m?)\b/i;
const CAPO_LINE = /^\s*capo(?:traste)?\b[^0-9\n]{0,20}(\d{1,2})/i;

/** Título/artista/tom/capo achados no texto (ChordPro ou "Tom: G"). */
export function detectMeta(text: string): SongMeta {
  const meta: SongMeta = {};
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const d = DIRECTIVE.exec(raw);
    if (d) {
      const k = d[1].toLowerCase();
      const v = (d[2] ?? '').trim();
      if (!v) continue;
      if (k === 'title' || k === 't') meta.title ??= v;
      if (k === 'subtitle' || k === 'st' || k === 'artist') meta.artist ??= v;
      if (k === 'key') meta.key ??= v;
      if (k === 'capo') meta.capo ??= parseInt(v, 10) || undefined;
      continue;
    }
    const t = TOM_LINE.exec(raw);
    if (t) {
      meta.key ??= t[1];
      continue;
    }
    const c = CAPO_LINE.exec(raw);
    if (c) meta.capo ??= parseInt(c[1], 10);
  }
  return meta;
}

// Conserta o artefato de copiar/colar do Cifra Club: acorde que cairia depois
// do fim da letra vem em linha própria prefixada por `">`, seguido de uma
// repetição do trecho inteiro. Junta o acorde e descarta a duplicata.
function fixCifraClub(lines: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const m = CC_TRAILING.exec(lines[i]);
    const sym = m ? m[1].replace(/\s+$/, '') : null;
    if (sym === null || !isChordLine(sym)) {
      out.push(lines[i++]);
      continue;
    }

    let j = out.length - 1;
    while (j >= 0 && (out[j].trim() === '' || isSectionLine(out[j]))) j--;
    if (j < 0 || isChordLine(out[j])) {
      out.push(lines[i++]);
      continue;
    }
    const lyric = out[j];
    const block = out.slice(j + 1);

    let k = i + 1;
    let dup = k < lines.length && lines[k] === lyric;
    if (dup) {
      k++;
      for (const b of block) {
        if (k >= lines.length || lines[k] !== b) {
          dup = false;
          break;
        }
        k++;
      }
    }
    if (!dup) {
      out.push(lines[i++]);
      continue;
    }

    const col = lyric.length + 1;
    if (j > 0 && isChordLine(out[j - 1])) {
      out[j - 1] = out[j - 1].padEnd(col) + sym;
    } else {
      out.splice(j, 0, ''.padEnd(col) + sym);
    }
    i = k;
  }
  return out;
}

const DIR_SECAO = new Set(['comment', 'c', 'ci', 'cb', 'comment_italic', 'comment_box', 'highlight']);

// Aceita ChordPro [C]letra OU "acorde acima da letra" (Cifra Club).
export function importText(text: string): Section[] {
  const raw = fixCifraClub(text.replace(/\r/g, '').split('\n').map(stripTags)).map(stripResidue);
  const sections: Section[] = [];
  let cur: Section = { name: '', lines: [] };
  let started = false;
  // linha em branco no fim da seção é só o separador; sem tirar, cada ida e
  // volta texto<->modelo somava mais uma
  const close = () => {
    while (
      cur.lines.length &&
      cur.lines[cur.lines.length - 1].chords.length === 0 &&
      cur.lines[cur.lines.length - 1].lyric.trim() === ''
    )
      cur.lines.pop();
    // seção sem nome e sem linha (sobra de metadado) não vira seção vazia
    if (cur.name || cur.lines.length) sections.push(cur);
  };
  const newSection = (name: string) => {
    if (started) close();
    cur = { name, lines: [] };
    started = true;
  };
  const isLyric = (l: string | null) =>
    l !== null && l.trim() !== '' && !isChordLine(l) && !isSectionLine(l) && !DIRECTIVE.test(l);

  for (let i = 0; i < raw.length; i++) {
    let line = raw[i];

    const d = DIRECTIVE.exec(line);
    if (d) {
      const k = d[1].toLowerCase();
      const v = (d[2] ?? '').trim();
      if (DIR_SECAO.has(k) && v) newSection(v);
      else if (k === 'start_of_chorus' || k === 'soc') newSection(v || 'Refrão');
      else if (k === 'start_of_bridge' || k === 'sob') newSection(v || 'Ponte');
      else if (k === 'start_of_verse' || k === 'sov') newSection(v);
      continue;
    }

    if (TOM_LINE.test(line) || CAPO_LINE.test(line)) continue;

    if (line.startsWith('#')) {
      newSection(line.slice(1).trim());
      continue;
    }
    const bs = bracketSection(line);
    if (bs) {
      newSection(bs[0]);
      if (bs[1].trim() === '') continue;
      line = bs[1];
    } else {
      const ts = textSection(line);
      if (ts) {
        newSection(ts[0]);
        if (ts[1].trim() === '') continue;
        line = ts[1].trim();
      }
    }

    if (INLINE_CHORD.test(line) && hasInlineChord(line)) {
      cur.lines.push(parseLine(line));
      started = true;
      continue;
    }

    if (isChordLine(line)) {
      const next = i + 1 < raw.length ? raw[i + 1] : null;
      if (isLyric(next)) {
        cur.lines.push(mergeChordLyric(line, next!));
        i++;
      } else {
        cur.lines.push(mergeChordLyric(line, ''));
      }
      started = true;
      continue;
    }

    cur.lines.push(parseLine(line));
    started = true;
  }
  if (started) close();
  return sections;
}

/** Primeiro acorde de verdade (pula (2x), |, N.C.). */
export function firstChord(sections: Section[]): string | null {
  for (const s of sections)
    for (const l of s.lines)
      for (const c of [...l.chords].sort((a, b) => a.idx - b.idx)) if (isChord(c.sym)) return c.sym;
  return null;
}

export function suggestKey(sections: Section[]): string | null {
  const fc = firstChord(sections);
  if (!fc) return null;
  const m = PARTS.exec(fc);
  if (!m) return fc;
  const root = m[1];
  const qual = m[2] ?? '';
  const minor = qual.startsWith('m') && !qual.startsWith('maj');
  return minor ? root + 'm' : root;
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// ---- criar cifra (igual a chord_engine.dart) ----

const TONS_BEMOL = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

/** Acordes do tom (campo harmônico) + os de passagem mais comuns, p/ a paleta.
 *  Ex.: G -> G Am Bm C D Em F#° D7 ... ; Em -> Em F#° G Am Bm C D B7 ... */
export function campoHarmonico(key: string): string[] {
  const m = PARTS.exec(key.trim());
  if (!m || noteId(m[1]) < 0) return [];
  const root = m[1];
  const qual = m[2] ?? '';
  const menor = qual.startsWith('m') && !qual.startsWith('maj');
  const bemol = TONS_BEMOL.has(menor ? `${root}m` : root);
  const n = (st: number) => transposeNote(root, st, bemol);
  const l = menor
    // i ii° III iv v VI VII + V7 (harmônica) e iv7/i7
    ? [`${n(0)}m`, `${n(2)}°`, n(3), `${n(5)}m`, `${n(7)}m`, n(8), n(10), `${n(7)}7`, n(7), `${n(0)}m7`, `${n(5)}m7`]
    // I ii iii IV V vi vii° + V7, I7 (vai p/ IV), II7 (vai p/ V), I/3 e V/7
    : [n(0), `${n(2)}m`, `${n(4)}m`, n(5), n(7), `${n(9)}m`, `${n(11)}°`, `${n(7)}7`, `${n(0)}7`, `${n(2)}7`,
      `${n(0)}/${n(4)}`, `${n(7)}/${n(11)}`, `${n(2)}m7`, `${n(9)}m7`, `${n(7)}sus4`];
  return [...new Set(l)];
}

// posição -> começo da palavra mais perto (ou a própria, se já for)
function inicioDaPalavra(s: string, i: number): number {
  if (i >= s.length || i === 0 || s[i - 1] === ' ') return i;
  let a = i, b = i;
  while (a > 0 && s[a - 1] !== ' ') a--;
  while (b < s.length && s[b] !== ' ') b++;
  if (b < s.length) b++; // começo da próxima palavra
  return i - a <= b - i || b >= s.length ? a : b;
}

/** Acordes da linha [src] na linha [dst] (estrofes com a mesma melodia):
 *  mesma proporção na linha, encostando no começo da palavra. */
export function copiarAcordes(src: SongLine, dst: SongLine): Chord[] {
  const ls = src.lyric.length, ld = dst.lyric.length;
  const out: Chord[] = [];
  for (const c of src.chords) {
    let i = ls === 0 || ld === 0 ? Math.min(c.idx, ld) : Math.round((c.idx * ld) / ls);
    i = inicioDaPalavra(dst.lyric, Math.max(0, Math.min(ld, i)));
    // dois acordes não ficam na mesma letra
    while (out.some((o) => o.idx === i) && i < ld) i++;
    out.push({ sym: c.sym, idx: i });
  }
  return out;
}
