// Confere que o parser web dá exatamente o mesmo resultado do app Flutter.
// Uso: rode antes `flutter test test/parser_parity_test.dart` no arion,
// depois `node scripts/parity.ts`.
import { readFileSync } from 'node:fs';
import { importText, detectMeta, suggestKey, transposeChord } from '../src/chordEngine.ts';

const APP = '../arion';
const cases: string[] = JSON.parse(readFileSync(`${APP}/test/fixtures/parser_cases.json`, 'utf8'));
const dart = JSON.parse(readFileSync(`${APP}/build/parser_dart.json`, 'utf8'));

const dump = (txt: string) =>
  importText(txt)
    .map(
      (s) =>
        `${s.name}:${s.lines
          .map((l) => `${l.lyric.replace(/\s+$/, '')}<${l.chords.map((c) => `${c.sym}@${c.idx}`).join(',')}>`)
          .join(';')}`,
    )
    .join('/');

const web = {
  dumps: cases.map(dump),
  meta: cases.map((c) => {
    const m = detectMeta(c);
    const s = (v: unknown) => (v === undefined ? 'null' : String(v));
    return `${s(m.title)}|${s(m.artist)}|${s(m.key)}|${s(m.capo)}`;
  }),
  keys: cases.map((c) => `${suggestKey(importText(c))}`),
  transp: ['D7/9', 'A7/13', 'Am7/G', 'F#m7(b5)/E', 'Cb', 'E#', 'Bø', '(2x)', 'N.C.', '|', 'B7(4/9)', 'Bb7M(9)'].flatMap(
    (c) => [-3, 1, 2].map((s) => transposeChord(c, s, false)),
  ),
};

let fails = 0;
for (const k of ['dumps', 'meta', 'keys', 'transp'] as const) {
  (web[k] as string[]).forEach((v, i) => {
    if (v !== dart[k][i]) {
      fails++;
      console.log(`DIFERENTE ${k}[${i}]\n  app: ${dart[k][i]}\n  web: ${v}\n  caso: ${JSON.stringify(cases[i] ?? '')}`);
    }
  });
}
console.log(fails ? `${fails} diferença(s)` : `OK: ${cases.length} casos idênticos no app e no web`);
process.exit(fails ? 1 : 0);
