// Monta a cifra ("acorde acima da letra") a partir das palavras que um OCR
// leu numa imagem, usando a posição de cada uma: é a posição na tela que diz
// em qual sílaba cada acorde cai. Igual a lib/core/ocr_cifra.dart do app.
import { isChordSymbol } from './chordEngine';

export interface PalavraOcr { texto: string; esq: number; topo: number; dir: number; base: number }

/** Erros típicos de OCR em acorde ("F#m" lido "Fim", "A/C#" lido "A/CH",
 *  "G" lido "6", "Bm" lido "Bn"): troca e só aceita se virar acorde. */
export function corrigirAcorde(t: string): string {
  if (isChordSymbol(t)) return t;
  const raiz: Record<string, string> = { O: 'D', '0': 'D', '8': 'B', '6': 'G' };
  let r = t;
  if (r && raiz[r[0]]) r = raiz[r[0]] + r.slice(1);
  if (isChordSymbol(r)) return r;
  for (const [de, para] of [['H', '#'], ['i', '#'], ['l', '#'], ['f', '#'], ['t', '#'], ['rn', 'm'], ['n', 'm']]) {
    if (r.length < 2) break;
    const c = r[0] + r.slice(1).split(de).join(para);
    if (isChordSymbol(c)) return c;
  }
  return t;
}

const mediana = (v: number[]) => (v.length ? [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] : 0);
const ehAcorde = (p: PalavraOcr) => isChordSymbol(corrigirAcorde(p.texto));

/** Linha de acordes: a maioria dos tokens é acorde (o OCR às vezes lê um
 *  borrão); 1 token só precisa ser acorde. */
function ehLinhaDeAcorde(l: PalavraOcr[]): boolean {
  const n = l.filter(ehAcorde).length;
  return n > 0 && (n === l.length || (l.length >= 2 && n / l.length >= 0.6));
}

function agruparLinhas(ps: PalavraOcr[]): PalavraOcr[][] {
  const cy = (p: PalavraOcr) => (p.topo + p.base) / 2;
  const h = mediana(ps.map((p) => p.base - p.topo));
  const linhas: PalavraOcr[][] = [];
  for (const p of [...ps].sort((a, b) => cy(a) - cy(b))) {
    const atual = linhas[linhas.length - 1];
    if (atual) {
      const c = atual.reduce((s, x) => s + cy(x), 0) / atual.length;
      if (Math.abs(cy(p) - c) < h * 0.5) { atual.push(p); continue; }
    }
    linhas.push([p]);
  }
  for (const l of linhas) l.sort((a, b) => a.esq - b.esq);
  return linhas;
}

/** Foto torta: uma linha de acordes sai partida em duas (o lado direito mais
 *  baixo). Duas linhas de acorde seguidas, perto na altura e sem se sobrepor
 *  na horizontal, viram uma. */
function juntarAcordesPartidos(linhas: PalavraOcr[][]): PalavraOcr[][] {
  const cy = (p: PalavraOcr) => (p.topo + p.base) / 2;
  const media = (l: PalavraOcr[]) => l.reduce((s, p) => s + cy(p), 0) / l.length;
  const h = mediana(linhas.flat().map((p) => p.base - p.topo));
  const out: PalavraOcr[][] = [];
  for (const l of linhas) {
    const ant = out[out.length - 1];
    if (ant && ehLinhaDeAcorde(ant) && ehLinhaDeAcorde(l)) {
      const sobrepoe = l.some((p) => ant.some((q) => p.esq < q.dir && q.esq < p.dir));
      if (!sobrepoe && Math.abs(media(l) - media(ant)) < h * 1.3) {
        ant.push(...l);
        ant.sort((a, b) => a.esq - b.esq);
        continue;
      }
    }
    out.push(l);
  }
  return out;
}

/** Acordes em colunas que caem na sílaba certa da letra de baixo (montada
 *  com um espaço entre palavras). */
function linhaDeAcordes(acordes: PalavraOcr[], letra: PalavraOcr[] | null, cw: number, margem: number): string {
  const inicios: number[] = [];
  let pos = 0;
  for (const p of letra ?? []) { inicios.push(pos); pos += p.texto.length + 1; }
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const coluna = (x: number): number => {
    if (!letra?.length) return clamp(Math.round((x - margem) / cw), 0, 400);
    if (x < letra[0].esq) return 0;
    for (let k = letra.length - 1; k >= 0; k--) {
      const w = letra[k];
      if (x >= w.esq - cw / 2) {
        if (x <= w.dir) {
          const larg = w.dir - w.esq;
          const frac = larg <= 0 ? 0 : (x - w.esq) / larg;
          return inicios[k] + clamp(Math.round(frac * w.texto.length), 0, w.texto.length);
        }
        // no vão depois da palavra (ou além do fim da letra)
        return inicios[k] + w.texto.length + 1 + clamp(Math.floor((x - w.dir) / cw), 0, 400);
      }
    }
    return 0;
  };
  let out = '';
  // o que não é acorde numa linha de acordes é lixo do OCR
  for (const a of acordes.filter(ehAcorde)) {
    let col = coluna(a.esq);
    if (out.length && col <= out.length) col = out.length + 1;
    out = out.padEnd(col) + corrigirAcorde(a.texto);
  }
  return out;
}

/** Texto da cifra, pronto p/ o importador (que entende partes, "Tom:" etc.). */
export function montarCifra(palavras: PalavraOcr[]): string {
  const ps = palavras.filter((p) => p.texto.trim());
  if (!ps.length) return '';
  const linhas = juntarAcordesPartidos(agruparLinhas(ps));
  const acorde = linhas.map(ehLinhaDeAcorde);
  const larguras = linhas.flatMap((l, i) => (acorde[i] ? [] : l.filter((p) => p.texto.length > 1)
    .map((p) => (p.dir - p.esq) / p.texto.length)));
  const cw = larguras.length ? mediana(larguras) : 10;
  const margem = Math.min(...ps.map((p) => p.esq));
  // linha em branco onde o espaço entre linhas é bem maior que o normal
  const vaos = linhas.slice(1).map((l, i) => l[0].topo - Math.max(...linhas[i].map((p) => p.base)));
  const vaoNormal = mediana(vaos);
  const out: string[] = [];
  linhas.forEach((l, i) => {
    if (i > 0 && vaos[i - 1] > vaoNormal * 2.2 && vaos[i - 1] > cw) out.push('');
    if (!acorde[i]) { out.push(l.map((p) => p.texto).join(' ')); return; }
    const abaixo = i + 1 < linhas.length && !acorde[i + 1] ? linhas[i + 1] : null;
    out.push(linhaDeAcordes(l, abaixo, cw, margem));
  });
  return out.join('\n');
}

/** Lê a imagem no navegador (Tesseract, português, modo "texto espalhado",
 *  que pega os acordes soltos) e monta a cifra. */
export async function lerCifraDeImagem(arquivo: Blob, progresso?: (p: number) => void): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const w = await createWorker('por', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') progresso?.(m.progress);
    },
  });
  try {
    await w.setParameters({ tessedit_pageseg_mode: '11' as never });
    const { data } = await w.recognize(arquivo);
    return montarCifra(data.words.map((x) => ({
      texto: x.text, esq: x.bbox.x0, topo: x.bbox.y0, dir: x.bbox.x1, base: x.bbox.y1,
    })));
  } finally {
    await w.terminate();
  }
}
