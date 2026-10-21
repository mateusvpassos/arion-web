// Busca de letra no LRCLIB (lrclib.net): base aberta, sem chave. Só a letra;
// os acordes a pessoa põe no editor. Igual a lib/core/letras.dart.
import type { Section } from './types';

export interface LetraAchada { titulo: string; artista: string; album: string; letra: string }

// "11 - A Barca" / "01. Ressuscita-me" -> sem o número da faixa
const limpaTitulo = (t: string) => t.replace(/^\d{1,3}\s*[-.)]\s*/, '');

/** Resultados com letra, sem repetir a mesma música (o LRCLIB tem várias
 *  cópias da mesma faixa, de álbuns diferentes). */
export async function buscarLetras(termo: string): Promise<LetraAchada[]> {
  const q = termo.trim();
  if (!q) return [];
  // o navegador não deixa mudar o User-Agent; o LRCLIB aceita esse cabeçalho
  const r = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`, {
    headers: { 'Lrclib-Client': 'Arion (cifras e repertorios)' },
  });
  if (!r.ok) throw new Error(`O site de letras respondeu ${r.status}`);
  const vistos = new Set<string>();
  const out: LetraAchada[] = [];
  for (const j of (await r.json()) as Record<string, string | null>[]) {
    const letra = (j.plainLyrics ?? '').trim();
    if (!letra) continue;
    const t = (j.trackName ?? '').trim(), a = (j.artistName ?? '').trim();
    const k = `${t.toLowerCase()}|${a.toLowerCase()}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push({ titulo: limpaTitulo(t), artista: a, album: (j.albumName ?? '').trim(), letra });
  }
  return out;
}

/** Letra -> partes, separadas por linha em branco. Bloco que se repete é o
 *  refrão; os outros, estrofes (p/ copiar acordes de uma p/ outra). */
export function paraSecoes(letra: string): Section[] {
  const blocos = letra.replace(/\r/g, '').split(/\n\s*\n/)
    .map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((b) => b.length);
  const chave = (b: string[]) => b.join('\n').toLowerCase();
  const vezes = new Map<string, number>();
  for (const b of blocos) vezes.set(chave(b), (vezes.get(chave(b)) ?? 0) + 1);
  let estrofe = 0;
  return blocos.map((b) => ({
    name: vezes.get(chave(b))! > 1 ? 'Refrão' : `Estrofe ${++estrofe}`,
    lines: b.map((l) => ({ lyric: l, chords: [] })),
  }));
}
