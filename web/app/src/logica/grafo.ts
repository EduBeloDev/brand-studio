import type { ArestaGrafo, NoGrafo } from '../../../../core/conteudo/ligacoes.ts';

/** Cores dos grupos (pasta de primeiro nível) no grafo, dentro da paleta da marca. */
export const PALETA = ['#b44dff', '#ff3dca', '#ffcc33', '#3ee0a0', '#5ab4ff', '#ff8a4d', '#c9b8ff', '#7a2cff'];

export interface NoDesenho extends NoGrafo {
  grau: number;
  raio: number;
  cor: string;
}

function corDoGrupo(grupo: string): string {
  let h = 0;
  for (const ch of grupo) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length]!;
}

export function prepararGrafo(d: { nos: NoGrafo[]; arestas: ArestaGrafo[] }) {
  const grau = new Map<string, number>();
  for (const a of d.arestas) {
    grau.set(a.de, (grau.get(a.de) ?? 0) + 1);
    grau.set(a.para, (grau.get(a.para) ?? 0) + 1);
  }
  const nos: NoDesenho[] = d.nos.map((n) => {
    const g = grau.get(n.id) ?? 0;
    return { ...n, grau: g, raio: 5 + Math.min(14, Math.sqrt(g) * 3.2), cor: n.tipo === 'pendente' ? '#6a5a92' : corDoGrupo(n.grupo) };
  });
  return { nos, arestas: d.arestas };
}

export function vizinhos(arestas: ArestaGrafo[], id: string): Set<string> {
  const r = new Set<string>();
  for (const a of arestas) {
    if (a.de === id) r.add(a.para);
    if (a.para === id) r.add(a.de);
  }
  return r;
}

export function filtrarGrupos<N extends NoGrafo>(d: { nos: N[]; arestas: ArestaGrafo[] }, grupos: Set<string>) {
  const nos = d.nos.filter((n) => grupos.has(n.grupo));
  const ids = new Set(nos.map((n) => n.id));
  return { nos, arestas: d.arestas.filter((a) => ids.has(a.de) && ids.has(a.para)) };
}
