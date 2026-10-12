// Cor do destaque, como no app: as mesmas 8 cores. O verde é o da marca
// (ícone); as outras geram o degradê e os tons a partir do matiz. O fundo é
// sempre o grafite neutro do style.css (família Kino/Strata).

export const MARCA = 0xff4ade80;
export const CORES = [
  MARCA, 0xff3d5afe, 0xff7e57c2, 0xffd81b60,
  0xfff4511e, 0xff00897b, 0xff1e88e5, 0xff8d6e63,
];
/** padrão antigo (índigo do Material): quem nunca escolheu cor passa p/ a marca */
export const PADRAO_ANTIGO = 0xff3d5afe;

export const hexDe = (argb: number) => '#' + (argb & 0xffffff).toString(16).padStart(6, '0');

function hsl(argb: number): [number, number, number] {
  const r = ((argb >> 16) & 255) / 255, g = ((argb >> 8) & 255) / 255, b = (argb & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

const c = (h: number, s: number, l: number) =>
  `hsl(${((h % 360) + 360) % 360} ${Math.round(Math.min(1, s) * 100)}% ${Math.round(l * 1000) / 10}%)`;

const VARS = ['--primary', '--on-primary', '--grad', '--accent-soft', '--accent-ring', '--accent-text',
  '--chord', '--chord-forte', '--tertiary'];

/** Cor forte/escura da cor do tema p/ fundo branco (PDF, Word, imagem). */
export function corForte(argb: number): string {
  const [h, s] = hsl(argb);
  return c(h, Math.min(1, Math.max(0.85, s * 1.25)), 0.42);
}

/** Mesma cor forte em hex (o Word não entende hsl). */
export function corForteHex(argb: number): string {
  const [h, s0] = hsl(argb);
  const s = Math.min(1, Math.max(0.85, s0 * 1.25)), l = 0.42;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function aplicarTema(argb: number, tema: 'dark' | 'light') {
  const st = document.documentElement.style;
  for (const v of VARS) st.removeProperty(v);
  st.setProperty('--chord-forte', corForte(argb));
  if (argb === MARCA) return; // tons da marca já estão no style.css
  const [h, s0] = hsl(argb);
  const s = Math.max(0.55, Math.min(1, s0));
  const a = (l: number, al: number) => `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${l * 100}% / ${al})`;
  const vals: Record<string, string> = {
    // no claro o degradê escurece p/ o texto branco dos botões ler bem
    '--grad': tema === 'dark'
      ? `linear-gradient(135deg, ${c(h - 28, s, 0.7)} 0%, ${c(h, s, 0.6)} 55%, ${c(h + 32, s, 0.52)} 100%)`
      : `linear-gradient(135deg, ${c(h - 20, s, 0.5)} 0%, ${c(h, s, 0.42)} 55%, ${c(h + 28, s, 0.36)} 100%)`,
    '--tertiary': c(h + 32, s, 0.52),
    ...(tema === 'dark'
      ? {
          '--primary': c(h, s, 0.68), '--on-primary': '#0b0c10', '--accent-text': c(h, s, 0.82),
          '--chord': c(h, s, 0.74), '--accent-soft': a(0.62, 0.15), '--accent-ring': a(0.62, 0.34),
        }
      : {
          '--primary': c(h, s, 0.42), '--on-primary': '#ffffff', '--accent-text': c(h, s, 0.3),
          '--chord': corForte(argb), '--accent-soft': a(0.45, 0.12), '--accent-ring': a(0.45, 0.3),
        }),
  };
  for (const [k, v] of Object.entries(vals)) st.setProperty(k, v);
}
